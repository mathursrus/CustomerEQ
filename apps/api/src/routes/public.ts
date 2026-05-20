import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { DemoRequestSchema, NPS, evaluateSurveyRule } from '@customerEQ/shared'
import { hashToken } from '@customerEQ/shared/distributionTokens'
import {
  buildFooterHref,
  POWERED_BY_ARIA_LABEL,
  POWERED_BY_LINK_TEXT,
  POWERED_BY_PREFIX,
} from '@customerEQ/shared/footer'
import { enqueueEvent, enqueueSentimentAnalysis, enqueueAlertEvaluation, enqueueCampaignTrigger } from '../queues/bullmq.js'
import { extractOpenEndedText } from '../utils/survey.js'
import { resolveOrEnrollMember } from '../services/memberResolution.js'
import { getConsentTextForSurvey } from '../services/consentResolver.js'
import { buildEnrollmentSignals } from '../services/enrollmentSignals.js'
import { FALLBACK_RESPONDENT_THEME } from '../lib/default-themes.js'

const API_BASE_URL =
  process.env.API_BASE_URL ?? 'https://api.customerEQ.io'

// Issue #231 PR2 — survey response submission schema.
//
// Identifier shape:
//   - `memberId` (request body) is optional because the URL query param
//     `member_id` is an equally valid carrier (used by host-embedded surveys
//     where the host SDK supplies identity in the URL). The handler enforces
//     "at least one of URL query / body memberId is required" — see channel
//     attribution rule.
//   - `memberEmail` is preserved for back-compat with the existing widget.js
//     embed payload, which today posts `{ memberEmail, answers, score }`.
//     Treated as the memberId when no explicit memberId is supplied.
//
// Consent:
//   - `consent: true` is required when Brand.consentMode = EXPLICIT and the
//     survey isn't using the R17 attest-and-suppress empty-string override.
//     Otherwise consent is server-stamped (R8).
const PublicSurveyResponseSchema = z.object({
  memberId: z.string().min(1).optional(),
  // Legacy back-compat: existing widget.js sends this; treat as memberId.
  memberEmail: z.string().email().optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  consent: z.boolean().optional(),
  consentVersion: z.string().max(20).optional(),
  answers: z.record(z.unknown()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'At least one answer is required' },
  ),
  score: z.number().min(0, 'Score must be at least 0').max(10, 'Score must be at most 10').optional(),
  channel: z.enum(['email', 'in_app', 'link', 'sms']).default('link'),
  // Issue #378 — optional distribution token. When present, supersedes
  // body memberId / memberEmail for member identification and binds the
  // response to the originating DistributionBatch.
  token: z.string().optional(),
})

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/public/programs/by-slug/:slug — resolve program info for enrollment page
  fastify.get<{ Params: { slug: string } }>(
    '/public/programs/by-slug/:slug',
    { config: { public: true } },
    async (request, reply) => {
      const { slug } = request.params

      const program = await fastify.prisma.program.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          brandId: true,
          brand: { select: { name: true } },
        },
      })

      if (!program || program.status !== 'ACTIVE') {
        return reply.status(404).send({ error: 'Program not found or not active' })
      }

      return reply.status(200).send({
        programId: program.id,
        programName: program.name,
        programSlug: program.slug,
        brandId: program.brandId,
        brandName: program.brand.name,
      })
    },
  )

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
    // Issue #378 — surveyTrigger URL removed. The public trigger endpoint
    // was deleted; brands send surveys via /v1/surveys/:id/distribution-batches.
    return reply.status(200).send({
      salesforce: `${API_BASE_URL}/v1/integrations/webhooks/salesforce`,
      hubspot: `${API_BASE_URL}/v1/integrations/webhooks/hubspot`,
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
          // Issue #241 — title is respondent-facing chrome (R7) so the
          // public renderer must read it.
          title: true,
          description: true,
          type: true,
          status: true,
          programId: true,
          themeId: true,
          questions: true,
          // Issue #241 — settings carries chromeMatrix (R18) that the
          // respondent renderer reads at render time.
          settings: true,
          responsePolicy: true,
          // Issue #241 — consent override (R12 / R14). When null the
          // renderer inherits the brand default.
          consentMode: true,
          consentTextOverride: true,
          // Issue #291 — per-survey thank-you copy/routing moved from BrandTheme to Survey.
          // Issue #241 — `showIncentivePoints` and `incentivePoints` removed (D19/D40/D50):
          // points never appear on the form; earning is driven by EarningRule cx events.
          thankYouMessage: true,
          thankYouRedirectUrl: true,
          // Issue #241 — brand carries the fields BrandLite expects for the
          // SurveyFormRenderer: consentMode/text default, terms/privacy
          // URLs, memberIdentifierKind. R15 / R17 depend on these.
          // Issue #405 — also include `defaultTheme` (relation to BrandTheme
          // via Brand.defaultThemeId) so the public renderer can fall back
          // to the brand's chosen default when the survey itself has no
          // theme picked.
          brand: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              consentMode: true,
              consentTextDefault: true,
              termsUrl: true,
              privacyPolicyUrl: true,
              memberIdentifierKind: true,
              defaultTheme: true,
            },
          },
          theme: true,
          _count: { select: { surveyRules: true } },
        },
      })

      if (!survey) {
        return reply.status(404).send({ error: 'Survey not found or not active' })
      }

      // Issue #405 — three-tier theme resolution:
      //   1. Survey.themeId (operator picked per-survey override)
      //   2. Brand.defaultThemeId (brand-wide default)
      //   3. FALLBACK_RESPONDENT_THEME (canonical CustomerEQ Indigo, built
      //      from DEFAULT_THEMES[0])
      //
      // Pre-#405 the route only resolved tier 1 and returned `theme: null`
      // when the survey had no themeId. The client at
      // `apps/web/src/app/survey/[id]/page.tsx` then fell back to a
      // *separate* hardcoded constant — a divergent second source of truth
      // that silently masked themeless-brand bugs at the customer-facing
      // surface for as long as the bug shape existed. This route now
      // guarantees a non-null `theme` so the client can render it directly.
      const { _count, brand, ...surveyData } = survey
      const { defaultTheme: brandDefaultTheme, ...brandLite } = brand
      const resolvedTheme = surveyData.theme ?? brandDefaultTheme ?? FALLBACK_RESPONDENT_THEME

      return reply.status(200).send({
        ...surveyData,
        brand: brandLite,
        theme: resolvedTheme,
        hasCxRules: _count.surveyRules > 0,
      })
    },
  )

  // GET /v1/public/surveys/:id/token-status — uniform-body pre-render check
  //
  // Issue #378 — the standalone form at /survey/:surveyId/r/:token calls this
  // on mount to decide whether to render the form (state=valid) or one of the
  // four error states. Response body is uniform across states (per NFR-S5)
  // so a token-existence-leak timing attack can't distinguish.
  fastify.get(
    '/public/surveys/:id/token-status',
    { config: { public: true } },
    async (request, reply) => {
      const { id: surveyId } = request.params as { id: string }
      const token = (request.query as { token?: string }).token
      if (!token || token.length === 0) {
        return reply.status(200).send({ state: 'invalid' })
      }
      const hash = hashToken(token)
      const row = await fastify.prisma.surveyDistributionToken.findUnique({
        where: { tokenHash: hash },
        select: { expiresAt: true, consumedAt: true, batch: { select: { surveyId: true, survey: { select: { status: true } } } } },
      })
      if (!row) return reply.status(200).send({ state: 'invalid' })
      if (row.batch.surveyId !== surveyId) {
        // Token doesn't belong to the survey in the URL. Don't reveal existence.
        return reply.status(200).send({ state: 'invalid' })
      }
      if (row.consumedAt) return reply.status(200).send({ state: 'responded' })
      if (row.expiresAt < new Date()) return reply.status(200).send({ state: 'expired' })
      if (row.batch.survey.status !== 'ACTIVE') return reply.status(200).send({ state: 'survey-not-open' })
      return reply.status(200).send({ state: 'valid' })
    },
  )

  // POST /v1/public/surveys/:id/respond — submit response (public, no auth)
  //
  // Issue #231 PR2 — auto-enroll on first response + responsePolicy enforcement.
  //
  // Channel attribution rule (R10/R15) — the `enrolledVia` set on a newly
  // auto-enrolled member depends on where the identifier was supplied:
  //
  //   - URL query `?member_id=…`        → EMBEDDED_FORM
  //   - Request body `memberId`         → SURVEY_RESPONSE
  //   - URL query takes priority when both are present.
  //   - Legacy `memberEmail` body field is treated as a body-supplied memberId.
  //
  // The names describe the *channel*: EMBEDDED_FORM = host application embedded
  // the survey and supplied identity; SURVEY_RESPONSE = standalone survey link
  // and the responder self-identified on the form. URL-vs-body is the detection
  // signal, not a security gate.
  //
  // responsePolicy enforcement (R3):
  //   ONCE              → 409 if a prior response exists.
  //   MULTIPLE          → always insert a new row (default for new surveys).
  //   LATEST_OVERWRITES → upsert: keep one row per member, replacing answers/score.
  //
  // R18 enrollment-signal capture: the auto-enroll loyalty event payload
  // includes `enrollmentSignals = { ipHash, ipCountryIso, capturedAt }`.
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

      const data = parse.data
      const bodyMemberId = (data.memberId ?? data.memberEmail ?? '').trim()

      // Issue #378 — token-authorized path. When body.token is present, the
      // token resolves the member authoritatively (R20a) and the response is
      // written with distributionBatchId + distributionTokenId. Token state
      // failures map to: 410 expired / 410 survey-not-open / 410 invalid /
      // 409 responded.
      let tokenContext: {
        tokenId: string
        memberId: string
        batchId: string
        brandId: string
        surveyId: string
      } | null = null
      if (data.token && data.token.length > 0) {
        const hash = hashToken(data.token)
        const tokenRow = await fastify.prisma.surveyDistributionToken.findUnique({
          where: { tokenHash: hash },
          select: {
            id: true,
            memberId: true,
            batchId: true,
            brandId: true,
            expiresAt: true,
            consumedAt: true,
            batch: { select: { surveyId: true, survey: { select: { status: true, brandId: true } } } },
          },
        })
        if (!tokenRow || tokenRow.batch.surveyId !== surveyId) {
          return reply.status(410).send({ state: 'invalid' })
        }
        if (tokenRow.consumedAt) {
          return reply.status(409).send({ state: 'responded' })
        }
        if (tokenRow.expiresAt < new Date()) {
          return reply.status(410).send({ state: 'expired' })
        }
        if (tokenRow.batch.survey.status !== 'ACTIVE') {
          return reply.status(410).send({ state: 'survey-not-open' })
        }
        tokenContext = {
          tokenId: tokenRow.id,
          memberId: tokenRow.memberId,
          batchId: tokenRow.batchId,
          brandId: tokenRow.brandId,
          surveyId: tokenRow.batch.surveyId,
        }
        // Set request.brandId so the audit plugin's onResponse hook fires
        // for the token-respond audit row (audit plugin short-circuits when
        // brandId is unset on public routes).
        request.brandId = tokenContext.brandId
      }

      // Issue #241 Slice 2 (RFC clarification, PR #327) — channel attribution
      // now derives from the request body's `channel` field rather than the
      // URL-vs-body heuristic. The widget hardcodes `channel: 'in_app'`
      // (verified at public.ts widget JS template); standalone defaults to
      // `'link'`. The `?email=` / `?member_id=` URL plumbing is gone from the
      // page handler in Slice 5; this server endpoint stops reading those.
      if (!bodyMemberId && !tokenContext) {
        return reply.status(400).send({
          error: 'NO_IDENTIFIER',
          message: 'Survey response requires an identifier — supply memberId, memberEmail, or token in the body.',
        })
      }
      const identifierValue = bodyMemberId
      const enrolledVia: 'EMBEDDED_FORM' | 'SURVEY_RESPONSE' =
        data.channel === 'in_app' ? 'EMBEDDED_FORM' : 'SURVEY_RESPONSE'

      const { answers, score, channel } = data

      // Find the survey (must be active) — also need brand consent fields.
      const survey = await fastify.prisma.survey.findFirst({
        where: { id: surveyId, status: 'ACTIVE' },
        include: {
          brand: {
            select: {
              id: true,
              consentMode: true,
              consentTextDefault: true,
              privacyPolicyUrl: true,
              termsUrl: true,
              memberIdentifierKind: true,
            },
          },
        },
      })
      if (!survey) {
        return reply.status(404).send({ error: 'Survey not found or not active' })
      }

      const brandId = survey.brandId

      // Resolve consent expectations for this survey × brand pair.
      // survey.consentMode (Issue #276) overrides brand.consentMode when non-null.
      const consentResolution = getConsentTextForSurvey(
        { consentTextOverride: survey.consentTextOverride, consentMode: survey.consentMode },
        survey.brand,
      )

      // EXPLICIT mode + not suppressed → consent boolean is required in body.
      // The R17 attest-and-suppress path bypasses this requirement (the brand
      // admin attested in writing during survey setup that responders have
      // prior consent in their own system).
      if (consentResolution.requiresExplicitConsent && data.consent !== true) {
        return reply.status(400).send({
          error: 'CONSENT_REQUIRED',
          message:
            'This survey requires explicit consent. Set "consent": true in the request body.',
        })
      }

      // Issue #378 — token-authorized path bypasses resolveOrEnrollMember.
      // The token already binds (batch, member); we just load the member.
      // If the body also supplies an identifier, it must match the
      // token-resolved member (R20 IDENTIFIER_MISMATCH).
      let member: { id: string; externalId: string; consentGivenAt: Date | null } & {
        firstName: string | null
        lastName: string | null
        email: string | null
      }
      let autoEnrolled = false
      if (tokenContext) {
        const tokenMember = await fastify.prisma.member.findUnique({
          where: { id: tokenContext.memberId },
          select: {
            id: true,
            externalId: true,
            firstName: true,
            lastName: true,
            email: true,
            consentGivenAt: true,
          },
        })
        if (!tokenMember) {
          return reply.status(410).send({ state: 'invalid' })
        }
        if (bodyMemberId.length > 0 && bodyMemberId.toLowerCase() !== tokenMember.externalId) {
          return reply.status(422).send({
            error: 'IDENTIFIER_MISMATCH',
            message: 'Body identifier does not match the token-resolved member.',
            code: 'IDENTIFIER_MISMATCH',
          })
        }
        member = tokenMember
      } else {
        // Auto-enroll or resolve existing member. The `consentGivenAt` is
        // server-stamped to now() on first enrollment (R8 + Compliance §);
        // existing members' consentGivenAt is preserved unless the integrator
        // re-attests by sending an explicit consentGivenAt (not exposed on
        // this public-form path).
        const enrollResult = await resolveOrEnrollMember(fastify.prisma, brandId, {
          memberId: identifierValue,
          email: data.email,
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          consentVersion: data.consentVersion,
          enrolledVia,
        })

        if (!enrollResult.ok) {
          return reply.status(400).send({
            error: enrollResult.error.code,
            message: enrollResult.error.message,
            expectedKind: enrollResult.error.expectedKind,
          })
        }

        member = enrollResult.member
        autoEnrolled = enrollResult.created
      }

      // R3 — responsePolicy enforcement. Default is MULTIPLE for new surveys
      // (see migration 20260504000000); legacy unique constraint already
      // dropped in PR1.
      const policy = survey.responsePolicy ?? 'MULTIPLE'
      let priorResponse: { id: string } | null = null
      if (policy === 'ONCE' || policy === 'LATEST_OVERWRITES') {
        priorResponse = await fastify.prisma.surveyResponse.findFirst({
          where: { surveyId, memberId: member.id },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        })
      }
      if (policy === 'ONCE' && priorResponse) {
        return reply.status(409).send({
          // Issue #241 Slice 2 — error code per RFC §"Endpoint error contracts".
          error: 'You have already responded.',
          code: 'POLICY_ONCE_DUPLICATE',
          // duplicate:true signals the respondent page to render the
          // "Already responded" screen rather than a generic error banner.
          // The P2002 race-condition path below sends the same flag so
          // both routes look identical to the client.
          duplicate: true,
          priorResponseId: priorResponse.id,
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

      // Create or overwrite response, plus increment responsesCount on new rows.
      // Issue #378: when token-authorized, the response carries
      // distributionBatchId + distributionTokenId, and the token's consumedAt
      // is set in the same transaction with a conditional update guarded by
      // `consumedAt: null` so a concurrent submit's race resolves to a clean 409.
      let response: { id: string }
      if (policy === 'LATEST_OVERWRITES' && priorResponse) {
        // Update in place — single row per member-survey under this policy.
        response = await fastify.prisma.surveyResponse.update({
          where: { id: priorResponse.id },
          data: {
            answers: answers as Prisma.InputJsonValue,
            score: score ?? null,
            channel,
            distributionBatchId: tokenContext?.batchId ?? undefined,
            distributionTokenId: tokenContext?.tokenId ?? undefined,
          },
          select: { id: true },
        })
        // For LATEST_OVERWRITES + token, mark the new token as consumed.
        if (tokenContext) {
          await fastify.prisma.surveyDistributionToken.updateMany({
            where: { id: tokenContext.tokenId, consumedAt: null },
            data: { consumedAt: new Date() },
          })
        }
      } else {
        try {
          const writes: Prisma.PrismaPromise<unknown>[] = [
            fastify.prisma.surveyResponse.create({
              data: {
                surveyId,
                memberId: member.id,
                brandId,
                answers: answers as Prisma.InputJsonValue,
                score: score ?? null,
                channel,
                distributionBatchId: tokenContext?.batchId ?? undefined,
                distributionTokenId: tokenContext?.tokenId ?? undefined,
              },
            }),
            fastify.prisma.survey.update({
              where: { id: surveyId },
              data: { responsesCount: { increment: 1 } },
            }),
          ]
          if (tokenContext) {
            // Conditional UPDATE — if a concurrent submit already set
            // consumedAt, this affects 0 rows; the response create above will
            // still succeed (responsePolicy enforcement runs after this).
            // For the second-submit-rejection path we rely on the prior
            // tokenContext.consumedAt check at the top of the handler.
            writes.push(
              fastify.prisma.surveyDistributionToken.updateMany({
                where: { id: tokenContext.tokenId, consumedAt: null },
                data: { consumedAt: new Date() },
              }),
            )
          }
          const created = await fastify.prisma.$transaction(writes)
          response = created[0] as { id: string }
        } catch (err) {
          // The partial unique index `survey_responses_live_dedup` (migration
          // 20260505000000_survey_import_batch/migration.sql:36) enforces
          // one live response per (surveyId, memberId) regardless of
          // Survey.responsePolicy. Hitting it here means we raced with a
          // prior submit (or the ONCE-policy priorResponse lookup missed
          // because it happened between our SELECT and INSERT). Return a
          // clean 409 with `duplicate: true` so the respondent page renders
          // the "Already responded" screen instead of an opaque 500.
          if (
            typeof err === 'object' &&
            err !== null &&
            (err as { code?: string }).code === 'P2002'
          ) {
            const existing = await fastify.prisma.surveyResponse.findFirst({
              where: { surveyId, memberId: member.id, importBatchId: null },
              select: { id: true },
            })
            return reply.status(409).send({
              error: 'You have already responded.',
              code: 'POLICY_ONCE_DUPLICATE',
              duplicate: true,
              priorResponseId: existing?.id ?? null,
            })
          }
          throw err
        }
      }

      const ingestedAt = new Date().toISOString()

      // R18 — capture enrollment signals on auto-enroll *only*. Existing
      // members' enrollment signals were captured at their original enroll
      // moment; we don't re-capture on every survey response.
      if (autoEnrolled) {
        const ip = (request.ip ?? null) as string | null
        const ipCountryIso = await fastify.ipGeoProvider.getCountryFromIp(ip ?? '')
        const enrollmentSignals = buildEnrollmentSignals({
          ip,
          brandId,
          ipCountryIso,
        })

        // Synchronous-fork-of-event-driven (architecture §6 — to be added in
        // PR2): the auto-enroll DB insert + this enrollment loyalty event are
        // gated by the resolveOrEnrollMember call above so the rule pipeline
        // sees a coherent member-then-event ordering.
        enqueueEvent({
          brandId,
          memberId: member.id,
          eventType: 'enrollment',
          payload: {
            programId: null,
            programName: null,
            autoEnrolled: true,
            enrolledVia,
            surveyId,
            enrollmentSignals,
          },
          idempotencyKey: `enrollment:${member.id}`,
          ingestedAt,
        }).catch((err: unknown) => {
          fastify.log.error(
            { err, memberId: member.id, brandId, surveyId },
            'Failed to enqueue auto-enrollment event',
          )
        })

        fastify.log.info(
          { memberId: member.id, brandId, enrolledVia, surveyId, ipCountryIso },
          'member.auto_enrolled',
        )
      }

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

      // Enqueue CX event into the loyalty pipeline (non-blocking — response is already saved)
      let jobId: string | null = null
      try {
        const job = await enqueueEvent({
          brandId,
          memberId: member.id,
          eventType,
          payload: eventPayload,
          idempotencyKey: `survey:${surveyId}:${member.id}`,
          ingestedAt,
        })
        jobId = job.id ?? null
      } catch (err: unknown) {
        fastify.log.error({ err, surveyId, memberId: member.id }, 'Failed to enqueue CX event (response saved)')
      }

      // Issue #241 — the prior second-event emission ("cx.survey_completed"
      // when survey.incentivePoints > 0) is removed. `Survey.incentivePoints`
      // is gone; earning is driven by EarningRule rows keyed on the cx event
      // we already emit above (D50 fan-out). Slice 2 (#241) will further
      // tighten emission semantics + responsePolicy enforcement.

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
      if (survey.type === 'NPS' && score !== undefined && NPS.isPromoter(score)) {
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

      // ── Alert evaluation for closed-loop ──
      enqueueAlertEvaluation({
        surveyResponseId: response.id,
        brandId: survey.brandId,
        memberId: member.id,
        surveyId,
        surveyType: survey.type,
        score: score ?? null,
        sentiment: null,
        topics: [],
      }).catch((err: unknown) => {
        fastify.log.error({ err }, 'Failed to enqueue alert evaluation')
      })

      // ── Response-to-action rule evaluation (Issue #80) ──
      // Non-blocking: trigger failures do not block the response submission 201
      if (score !== null && score !== undefined) {
        fastify.prisma.surveyRule.findMany({
          where: { surveyId, brandId: survey.brandId },
          include: { campaign: { select: { id: true, status: true } } },
        }).then(async (surveyRules: Array<{ id: string; campaignId: string; scoreMin: number; scoreMax: number; campaign: { id: string; status: string } }>) => {
          const matchingRules = surveyRules.filter(
            (rule) => rule.campaign.status === 'ACTIVE' && evaluateSurveyRule(rule, score),
          )
          fastify.log.info(
            { surveyId, memberId: member.id, score, rulesMatched: matchingRules.length, triggersEnqueued: matchingRules.length },
            'survey.rules_evaluated',
          )
          for (const rule of matchingRules) {
            try {
              await enqueueCampaignTrigger({
                campaignId: rule.campaignId,
                memberId: member.id,
                brandId: survey.brandId,
                eventIngestedAt: new Date().toISOString(),
                surveyResponseId: response.id,
              })
            } catch (err: unknown) {
              fastify.log.error(
                { err, surveyId, ruleId: rule.id, memberId: member.id },
                'campaign_trigger.enqueue_failed',
              )
            }
          }
        }).catch((err: unknown) => {
          fastify.log.error({ err, surveyId, memberId: member.id }, 'Failed to evaluate survey rules')
        })
      }

      const wasOverwrite = policy === 'LATEST_OVERWRITES' && Boolean(priorResponse)

      return reply.status(201).send({
        surveyResponseId: response.id,
        memberId: member.id,
        autoEnrolled,
        enrolledVia: autoEnrolled ? enrolledVia : null,
        responsePolicy: policy,
        overwrote: wasOverwrite,
        jobId,
        message: 'Thank you for your feedback!',
      })
    },
  )

  // Issue #378 — POST /v1/public/surveys/trigger DELETED.
  //
  // The endpoint previously built outbound URLs of shape
  // `/survey/<surveyId>?email=<encoded>`, which conflicts with #378's
  // no-PII-in-URL invariant (the page handler stopped reading the URL
  // param in #241 Slice 5 — this endpoint was the last writer). Brands
  // that need to send a survey to a specific recipient now POST to
  // /v1/surveys/:id/distribution-batches (Clerk-authenticated; Custom
  // List of one identifier; tokenized URL returned in the response
  // body). External callers will receive HTTP 404 after merge.

  // GET /v1/public/surveys/:id/widget.js — embeddable JavaScript widget
  fastify.get(
    '/public/surveys/:id/widget.js',
    { config: { public: true } },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const survey = await fastify.prisma.survey.findFirst({
        where: { id, status: 'ACTIVE' },
        select: { id: true, name: true, type: true, questions: true, brand: { select: { name: true } } },
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
  survey: { id: string; name: string; type: string; questions: unknown; brand: { name: string } },
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
    questions,
  })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

  // Issue #413 \u2014 "Powered by CustomerEQ" attribution footer for the embedded
  // widget. Inlined into the generated JS string with hardcoded HTML + CSS
  // because the widget runs on host pages that don't load apps/web's
  // globals.css. Copy / aria-label / UTM href come from the shared
  // @customerEQ/shared/footer module so this surface stays in lockstep with
  // the React <PoweredByFooter> within #413's own scope. Cross-surface DOM
  // consolidation onto a single helper is the subject of #476.
  //
  // The CSS rule set mirrors the neutral variant in apps/web/src/app/globals.css.
  // Single quotes wrap the JS string; double quotes are safe inside.
  const footerCss =
    '.ceq-powered-by{text-align:center;padding:12px 16px;margin:0;border-top:1px solid rgba(0,0,0,0.04)}' +
    '.ceq-powered-by--neutral{color:#6b7280;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:11px}' +
    '.ceq-powered-by--neutral a{color:#374151;text-decoration:none}' +
    '.ceq-powered-by a:hover,.ceq-powered-by a:focus-visible{text-decoration:underline}' +
    '.ceq-powered-by--neutral a:focus-visible{outline:2px solid #6366f1;outline-offset:2px;border-radius:2px}'

  // The footer HTML string. UTM medium = 'embed' for the widget channel
  // per R4. Used in two places at runtime (R3): (1) appended to the widget
  // container after the form, (2) re-included inside the thank-you
  // container.innerHTML swap so the post-submit replacement doesn't drop
  // the footer.
  const footerHtml =
    '<p class="ceq-powered-by ceq-powered-by--neutral" data-survey-footer>' +
    POWERED_BY_PREFIX +
    '<a href="' + buildFooterHref('embed') + '" target="_blank" rel="noopener noreferrer" ' +
    'aria-label="' + POWERED_BY_ARIA_LABEL + '">' +
    POWERED_BY_LINK_TEXT +
    '</a></p>'

  return `(function() {
  if (document.getElementById('ceq-survey-widget-${survey.id}')) return;

  // Issue #413 — inject the footer CSS rules into the host page's <head>
  // once per page. Subsequent widget instances on the same page see the
  // existing <style> id and skip re-injection. Mirrors the .ceq-powered-by
  // class family in apps/web/src/app/globals.css.
  if (!document.getElementById('ceq-survey-widget-styles')) {
    var ceqStyleEl = document.createElement('style');
    ceqStyleEl.id = 'ceq-survey-widget-styles';
    ceqStyleEl.textContent = '${footerCss}';
    document.head.appendChild(ceqStyleEl);
  }

  var survey = ${surveyJson};
  var apiUrl = '${apiBaseUrl}/v1/public/surveys/${survey.id}/respond';

  var container = document.createElement('div');
  container.id = 'ceq-survey-widget-${survey.id}';
  container.style.cssText = 'font-family:system-ui,sans-serif;max-width:480px;margin:20px auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1);';

  var title = document.createElement('h3');
  title.textContent = survey.name;
  title.style.cssText = 'margin:0 0 4px;font-size:18px;font-weight:600;color:#111827;';
  container.appendChild(title);

  // Issue #241 — incentive-points badge removed (D19): points never appear on the form.

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
        // Issue #413 R3 — the thank-you DOM swap replaces container's
        // innerHTML, which would otherwise drop the footer that was
        // appended after the form. Re-include the footer markup so it
        // persists on the post-submit surface.
        container.innerHTML = '<div style="text-align:center;padding:24px;"><div style="font-size:32px;margin-bottom:8px;">✓</div><h3 style="margin:0 0 8px;font-size:18px;color:#111827;">Thank you!</h3><p style="margin:0;font-size:14px;color:#6b7280;">Your feedback has been recorded.</p></div>' + '${footerHtml}';
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

  // Issue #413 R3 — append the attribution footer to the widget container
  // after the form. insertAdjacentHTML keeps the form intact (unlike
  // innerHTML which would wipe it) and lets the footer share the same
  // hardcoded HTML string used by the thank-you swap above.
  container.insertAdjacentHTML('beforeend', '${footerHtml}');

  var target = document.getElementById('customerEQ-survey') || document.body;
  target.appendChild(container);
})();`
}

export { generateWidgetJs, PublicSurveyResponseSchema }
export default publicRoutes
