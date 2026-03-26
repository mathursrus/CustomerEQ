import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { DemoRequestSchema } from '@customerEQ/shared'
import { enqueueEvent, enqueueSentimentAnalysis } from '../queues/bullmq.js'
import { extractOpenEndedText } from '../utils/survey.js'

const API_BASE_URL =
  process.env.API_BASE_URL ?? 'https://api.customerEQ.io'

// Schema for public survey response submission (uses memberEmail, not memberId)
const PublicSurveyResponseSchema = z.object({
  memberEmail: z.string().email('Valid email is required'),
  answers: z.record(z.unknown()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'At least one answer is required' },
  ),
  score: z.number().min(0, 'Score must be at least 0').max(10, 'Score must be at most 10').optional(),
  channel: z.enum(['email', 'in_app', 'link', 'sms']).default('link'),
})

// Schema for webhook-triggered survey distribution
const SurveyTriggerSchema = z.object({
  memberEmail: z.string().email('Valid email is required'),
  surveyId: z.string().min(1),
  source: z.string().optional(), // e.g. "zendesk", "intercom"
})

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/public/demo-requests — no auth required
  fastify.post(
    '/public/demo-requests',
    { config: { public: true } },
    async (request, reply) => {
      const parse = DemoRequestSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }

      const data = parse.data
      const demoRequest = await fastify.prisma.demoRequest.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          workEmail: data.workEmail,
          companyName: data.companyName,
          companySize: data.companySize ?? undefined,
          message: data.message ?? undefined,
        },
      })

      return reply.status(201).send(demoRequest)
    },
  )

  // GET /v1/admin/demo-requests — admin JWT required
  fastify.get('/admin/demo-requests', async (_request, reply) => {
    const demoRequests = await fastify.prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return reply.status(200).send(demoRequests)
  })

  // GET /v1/admin/integrations — admin JWT required
  fastify.get('/admin/integrations', async (_request, reply) => {
    return reply.status(200).send({
      salesforce: `${API_BASE_URL}/v1/integrations/webhooks/salesforce`,
      hubspot: `${API_BASE_URL}/v1/integrations/webhooks/hubspot`,
      surveyTrigger: `${API_BASE_URL}/v1/public/surveys/trigger`,
    })
  })

  // ─── Public Survey Endpoints ────────────────────────────────────────────────

  // GET /v1/public/surveys/:id — get survey questions (public, no auth)
  fastify.get(
    '/public/surveys/:id',
    { config: { public: true } },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const survey = await fastify.prisma.survey.findFirst({
        where: { id, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          type: true,
          questions: true,
          incentivePoints: true,
          brand: { select: { name: true } },
        },
      })

      if (!survey) {
        return reply.status(404).send({ error: 'Survey not found or not active' })
      }

      return reply.status(200).send(survey)
    },
  )

  // POST /v1/public/surveys/:id/respond — submit response (public, no auth)
  // Uses memberEmail to look up member instead of JWT-based memberId
  fastify.post(
    '/public/surveys/:id/respond',
    { config: { public: true } },
    async (request, reply) => {
      const { id: surveyId } = request.params as { id: string }
      const parse = PublicSurveyResponseSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
          details: parse.error.errors,
        })
      }

      const { memberEmail, answers, score, channel } = parse.data

      // Find the survey (must be active)
      const survey = await fastify.prisma.survey.findFirst({
        where: { id: surveyId, status: 'ACTIVE' },
      })
      if (!survey) {
        return reply.status(404).send({ error: 'Survey not found or not active' })
      }

      const brandId = survey.brandId

      // Look up member by email within the survey's brand
      const member = await fastify.prisma.member.findFirst({
        where: { email: memberEmail, brandId, deletedAt: null },
        select: { id: true, consentGivenAt: true },
      })
      if (!member) {
        return reply.status(404).send({ error: 'Member not found for this email' })
      }
      if (!member.consentGivenAt) {
        return reply.status(422).send({ error: 'Member consent required' })
      }

      // Check for duplicate response
      const existing = await fastify.prisma.surveyResponse.findUnique({
        where: { surveyId_memberId: { surveyId, memberId: member.id } },
      })
      if (existing) {
        return reply.status(200).send({
          duplicate: true,
          responseId: existing.id,
          message: 'You have already responded to this survey',
        })
      }

      // Determine event type
      const eventTypeMap: Record<string, string> = {
        NPS: 'cx.nps_response',
        CSAT: 'cx.csat_response',
        CES: 'cx.ces_response',
        CUSTOM: 'cx.survey_completed',
      }
      const eventType = eventTypeMap[survey.type] ?? 'cx.survey_completed'

      // Extract open-ended text
      const openEndedText = extractOpenEndedText(answers)

      // Create response + update count in transaction
      const [response] = await fastify.prisma.$transaction([
        fastify.prisma.surveyResponse.create({
          data: {
            surveyId,
            memberId: member.id,
            brandId,
            answers: answers as Prisma.InputJsonValue,
            score: score ?? null,
            channel,
          },
        }),
        fastify.prisma.survey.update({
          where: { id: surveyId },
          data: { responsesCount: { increment: 1 } },
        }),
      ])

      const ingestedAt = new Date().toISOString()

      // Build event payload with score fields for campaign triggers
      const eventPayload: Record<string, unknown> = {
        surveyId,
        surveyType: survey.type,
        surveyName: survey.name,
        ...answers,
      }
      if (score !== undefined) {
        if (survey.type === 'NPS') eventPayload.nps_score = score
        else if (survey.type === 'CSAT') eventPayload.csat_score = score
        else if (survey.type === 'CES') eventPayload.ces_score = score
        eventPayload.score = score
      }

      // Enqueue CX event into the loyalty pipeline
      const job = await enqueueEvent({
        brandId,
        memberId: member.id,
        eventType,
        payload: eventPayload,
        idempotencyKey: `survey:${surveyId}:${member.id}`,
        ingestedAt,
      })

      // Survey incentive points
      if (survey.incentivePoints && survey.incentivePoints > 0) {
        enqueueEvent({
          brandId,
          memberId: member.id,
          eventType: 'cx.survey_completed',
          payload: { surveyId, surveyName: survey.name, incentive: true },
          idempotencyKey: `survey-incentive:${surveyId}:${member.id}`,
          ingestedAt,
        }).catch((err: unknown) => {
          fastify.log.error({ err }, 'Failed to enqueue survey incentive event')
        })
      }

      // Sentiment analysis for open-ended text
      if (openEndedText) {
        enqueueSentimentAnalysis({
          surveyResponseId: response.id,
          brandId,
          memberId: member.id,
          surveyId,
          text: openEndedText,
          eventType,
          score: score ?? undefined,
        }).catch((err: unknown) => {
          fastify.log.error({ err }, 'Failed to enqueue sentiment analysis')
        })
      }

      // Promoter identification
      if (survey.type === 'NPS' && score !== undefined && score >= 9) {
        enqueueEvent({
          brandId,
          memberId: member.id,
          eventType: 'cx.promoter_identified',
          payload: { surveyId, nps_score: score, surveyName: survey.name },
          idempotencyKey: `promoter:${surveyId}:${member.id}`,
          ingestedAt,
        }).catch((err: unknown) => {
          fastify.log.error({ err }, 'Failed to enqueue promoter event')
        })
      }

      return reply.status(201).send({
        responseId: response.id,
        jobId: job.id,
        message: 'Thank you for your feedback!',
        incentivePoints: survey.incentivePoints ?? 0,
      })
    },
  )

  // POST /v1/public/surveys/trigger — webhook to trigger survey distribution
  // External systems (Zendesk, Intercom) call this to send a survey to a member
  fastify.post(
    '/public/surveys/trigger',
    { config: { public: true } },
    async (request, reply) => {
      const parse = SurveyTriggerSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Validation failed',
          message: parse.error.errors.map((e) => e.message).join(', '),
        })
      }

      const { memberEmail, surveyId, source } = parse.data

      // Find survey
      const survey = await fastify.prisma.survey.findFirst({
        where: { id: surveyId, status: 'ACTIVE' },
        select: { id: true, name: true, brandId: true, incentivePoints: true },
      })
      if (!survey) {
        return reply.status(404).send({ error: 'Survey not found or not active' })
      }

      // Find member
      const member = await fastify.prisma.member.findFirst({
        where: { email: memberEmail, brandId: survey.brandId, deletedAt: null },
        select: { id: true, consentGivenAt: true, email: true },
      })
      if (!member) {
        return reply.status(200).send({ skipped: true, reason: 'member_not_found' })
      }
      if (!member.consentGivenAt) {
        return reply.status(200).send({ skipped: true, reason: 'no_consent' })
      }

      // Check if already responded
      const existing = await fastify.prisma.surveyResponse.findUnique({
        where: { surveyId_memberId: { surveyId, memberId: member.id } },
      })
      if (existing) {
        return reply.status(200).send({ skipped: true, reason: 'already_responded' })
      }

      // Build survey link
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000'
      const surveyLink = `${frontendUrl}/survey/${surveyId}?email=${encodeURIComponent(memberEmail)}`

      const incentiveMsg = survey.incentivePoints
        ? ` Complete it to earn ${survey.incentivePoints} bonus points!`
        : ''

      // Enqueue notification to send survey link
      const { enqueueNotification } = await import('../queues/bullmq.js')
      await enqueueNotification({
        memberId: member.id,
        brandId: survey.brandId,
        message: `We'd love your feedback! Please take our survey "${survey.name}": ${surveyLink}${incentiveMsg}`,
        channel: 'email',
        metadata: { surveyId, surveyLink, source: source ?? 'api' },
      })

      return reply.status(202).send({
        triggered: true,
        surveyLink,
        message: 'Survey notification queued',
      })
    },
  )

  // GET /v1/public/surveys/:id/widget.js — embeddable JavaScript widget
  fastify.get(
    '/public/surveys/:id/widget.js',
    { config: { public: true } },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const survey = await fastify.prisma.survey.findFirst({
        where: { id, status: 'ACTIVE' },
        select: { id: true, name: true, type: true, questions: true, incentivePoints: true, brand: { select: { name: true } } },
      })

      if (!survey) {
        return reply.status(404).type('application/javascript').send('console.warn("CustomerEQ: Survey not found or not active");')
      }

      const widgetJs = generateWidgetJs(survey, API_BASE_URL)
      return reply.status(200).type('application/javascript').send(widgetJs)
    },
  )
}

/**
 * Generates a self-contained JavaScript widget that renders a survey form.
 */
function generateWidgetJs(
  survey: { id: string; name: string; type: string; questions: unknown; incentivePoints: number | null; brand: { name: string } },
  apiBaseUrl: string,
): string {
  const questions = survey.questions as Array<{ id: string; text: string; type: string; required?: boolean; options?: string[] }>
  // Escape the JSON string to prevent XSS via </script> tags, HTML entities,
  // and Unicode line terminators that could break out of the JS context.
  const surveyJson = JSON.stringify({
    id: survey.id,
    name: survey.name,
    type: survey.type,
    brandName: survey.brand.name,
    incentivePoints: survey.incentivePoints,
    questions,
  })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

  return `(function() {
  if (document.getElementById('ceq-survey-widget-${survey.id}')) return;

  var survey = ${surveyJson};
  var apiUrl = '${apiBaseUrl}/v1/public/surveys/${survey.id}/respond';

  var container = document.createElement('div');
  container.id = 'ceq-survey-widget-${survey.id}';
  container.style.cssText = 'font-family:system-ui,sans-serif;max-width:480px;margin:20px auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);';

  var title = document.createElement('h3');
  title.textContent = survey.name;
  title.style.cssText = 'margin:0 0 4px;font-size:18px;font-weight:600;color:#111827;';
  container.appendChild(title);

  if (survey.incentivePoints) {
    var badge = document.createElement('p');
    badge.textContent = 'Earn ' + survey.incentivePoints + ' points for completing this survey!';
    badge.style.cssText = 'margin:0 0 16px;font-size:13px;color:#6366f1;font-weight:500;';
    container.appendChild(badge);
  }

  var form = document.createElement('form');
  var inputs = {};

  survey.questions.forEach(function(q) {
    var label = document.createElement('label');
    label.textContent = q.text;
    label.style.cssText = 'display:block;margin-bottom:4px;font-size:14px;font-weight:500;color:#374151;';
    form.appendChild(label);

    if (q.type === 'rating') {
      var ratingDiv = document.createElement('div');
      ratingDiv.style.cssText = 'display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;';
      var max = survey.type === 'NPS' ? 10 : survey.type === 'CES' ? 7 : 5;
      var min = survey.type === 'NPS' ? 0 : 1;
      for (var i = min; i <= max; i++) {
        (function(val) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = val;
          btn.style.cssText = 'width:36px;height:36px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;transition:all 0.15s;';
          btn.onmouseover = function() { if (!btn.dataset.selected) btn.style.background = '#eef2ff'; };
          btn.onmouseout = function() { if (!btn.dataset.selected) btn.style.background = '#fff'; };
          btn.onclick = function() {
            ratingDiv.querySelectorAll('button').forEach(function(b) { b.style.background = '#fff'; b.style.borderColor = '#d1d5db'; b.style.color = '#374151'; b.dataset.selected = ''; });
            btn.style.background = '#6366f1';
            btn.style.borderColor = '#6366f1';
            btn.style.color = '#fff';
            btn.dataset.selected = 'true';
            inputs[q.id] = val;
          };
          ratingDiv.appendChild(btn);
        })(i);
      }
      form.appendChild(ratingDiv);
    } else if (q.type === 'text') {
      var textarea = document.createElement('textarea');
      textarea.placeholder = 'Your feedback...';
      textarea.rows = 3;
      textarea.style.cssText = 'width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:16px;resize:vertical;box-sizing:border-box;';
      textarea.oninput = function() { inputs[q.id] = textarea.value; };
      form.appendChild(textarea);
    } else if (q.type === 'choice' && q.options) {
      var selectDiv = document.createElement('div');
      selectDiv.style.cssText = 'margin-bottom:16px;';
      q.options.forEach(function(opt) {
        var optLabel = document.createElement('label');
        optLabel.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;font-size:14px;cursor:pointer;color:#374151;';
        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = q.id;
        radio.value = opt;
        radio.onchange = function() { inputs[q.id] = opt; };
        optLabel.appendChild(radio);
        optLabel.appendChild(document.createTextNode(opt));
        selectDiv.appendChild(optLabel);
      });
      form.appendChild(selectDiv);
    }
  });

  var emailLabel = document.createElement('label');
  emailLabel.textContent = 'Your email';
  emailLabel.style.cssText = 'display:block;margin-bottom:4px;font-size:14px;font-weight:500;color:#374151;';
  form.appendChild(emailLabel);

  var emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.placeholder = 'you@company.com';
  emailInput.required = true;
  emailInput.style.cssText = 'width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:16px;box-sizing:border-box;';
  form.appendChild(emailInput);

  var submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit Feedback';
  submitBtn.style.cssText = 'width:100%;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;transition:background 0.15s;';
  submitBtn.onmouseover = function() { submitBtn.style.background = '#4f46e5'; };
  submitBtn.onmouseout = function() { submitBtn.style.background = '#6366f1'; };
  form.appendChild(submitBtn);

  var msgDiv = document.createElement('div');
  msgDiv.style.cssText = 'margin-top:12px;font-size:14px;display:none;';
  form.appendChild(msgDiv);

  form.onsubmit = function(e) {
    e.preventDefault();
    if (!emailInput.value) { msgDiv.style.display = 'block'; msgDiv.style.color = '#dc2626'; msgDiv.textContent = 'Please enter your email.'; return; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    var ratingQ = survey.questions.find(function(q) { return q.type === 'rating'; });
    var scoreVal = ratingQ && inputs[ratingQ.id] !== undefined ? Number(inputs[ratingQ.id]) : undefined;

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberEmail: emailInput.value, answers: inputs, score: scoreVal, channel: 'in_app' })
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      if (res.ok || res.data.duplicate) {
        container.innerHTML = '<div style="text-align:center;padding:24px;"><div style="font-size:32px;margin-bottom:8px;">✓</div><h3 style="margin:0 0 8px;font-size:18px;color:#111827;">Thank you!</h3><p style="margin:0;font-size:14px;color:#6b7280;">Your feedback has been recorded.' + (survey.incentivePoints ? ' You earned ' + survey.incentivePoints + ' points!' : '') + '</p></div>';
      } else {
        msgDiv.style.display = 'block';
        msgDiv.style.color = '#dc2626';
        msgDiv.textContent = res.data.error || 'Something went wrong. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
      }
    })
    .catch(function() {
      msgDiv.style.display = 'block';
      msgDiv.style.color = '#dc2626';
      msgDiv.textContent = 'Network error. Please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Feedback';
    });
  };

  container.appendChild(form);

  var target = document.getElementById('customerEQ-survey') || document.body;
  target.appendChild(container);
})();`
}

export default publicRoutes
