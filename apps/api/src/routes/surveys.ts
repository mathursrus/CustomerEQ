import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import {
  CreateSurveySchema,
  UpdateSurveyStatusSchema,
  SubmitSurveyResponseSchema,
  NPS,
} from '@customerEQ/shared'
import { enqueueEvent, enqueueSentimentAnalysis } from '../queues/bullmq.js'
import { extractOpenEndedText } from '../utils/survey.js'

const surveysRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/surveys — create a new survey
  fastify.post('/surveys', async (request, reply) => {
    const parse = CreateSurveySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const brandId = request.brandId
    const { name, programId, type, questions, settings, incentivePoints } = parse.data

    // Verify program belongs to this brand
    const program = await fastify.prisma.program.findFirst({
      where: { id: programId, brandId },
    })
    if (!program) {
      return reply.status(404).send({ error: 'Program not found' })
    }

    const survey = await fastify.prisma.survey.create({
      data: {
        brandId,
        programId,
        name,
        type,
        questions,
        settings: (settings ?? undefined) as Prisma.InputJsonValue | undefined,
        incentivePoints: incentivePoints ?? null,
      },
    })

    return reply.status(201).send(survey)
  })

  // GET /v1/surveys — list surveys for the brand
  fastify.get('/surveys', async (request, reply) => {
    const surveys = await fastify.prisma.survey.findMany({
      where: { brandId: request.brandId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { responses: true } } },
    })

    return reply.status(200).send({ surveys })
  })

  // GET /v1/surveys/:id — get survey with response stats
  fastify.get('/surveys/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const survey = await fastify.prisma.survey.findFirst({
      where: { id, brandId: request.brandId },
      include: {
        _count: { select: { responses: true } },
        responses: {
          orderBy: { completedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            memberId: true,
            score: true,
            sentiment: true,
            topics: true,
            channel: true,
            completedAt: true,
          },
        },
      },
    })

    if (!survey) {
      return reply.status(404).send({ error: 'Survey not found' })
    }

    return reply.status(200).send(survey)
  })

  // PATCH /v1/surveys/:id/status — activate, pause, or close a survey
  fastify.patch('/surveys/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = UpdateSurveyStatusSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const survey = await fastify.prisma.survey.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!survey) {
      return reply.status(404).send({ error: 'Survey not found' })
    }

    // Activation requires at least one question
    if (parse.data.status === 'ACTIVE') {
      const questions = survey.questions as unknown[]
      if (!Array.isArray(questions) || questions.length === 0) {
        return reply.status(422).send({ error: 'Survey must have at least one question to activate' })
      }
    }

    const updated = await fastify.prisma.survey.update({
      where: { id },
      data: { status: parse.data.status },
    })

    return reply.status(200).send(updated)
  })

  // POST /v1/surveys/:id/responses — submit a survey response
  // This is the critical integration point: response → event pipeline → campaign triggers
  fastify.post('/surveys/:id/responses', async (request, reply) => {
    const { id: surveyId } = request.params as { id: string }
    const parse = SubmitSurveyResponseSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const brandId = request.brandId
    const { memberId, answers, score, channel } = parse.data

    // Verify survey exists, is active, and belongs to brand
    const survey = await fastify.prisma.survey.findFirst({
      where: { id: surveyId, brandId, status: 'ACTIVE' },
    })
    if (!survey) {
      return reply.status(404).send({ error: 'Survey not found or not active' })
    }

    // Verify member exists and has consent
    const member = await fastify.prisma.member.findFirst({
      where: { id: memberId, brandId, deletedAt: null },
      select: { id: true, consentGivenAt: true },
    })
    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }
    if (!member.consentGivenAt) {
      return reply.status(422).send({ error: 'Member consent required' })
    }

    // Check for duplicate response
    const existing = await fastify.prisma.surveyResponse.findUnique({
      where: { surveyId_memberId: { surveyId, memberId } },
    })
    if (existing) {
      return reply.status(200).send({ duplicate: true, responseId: existing.id })
    }

    // Determine the CX event type based on survey type
    const eventTypeMap: Record<string, string> = {
      NPS: 'cx.nps_response',
      CSAT: 'cx.csat_response',
      CES: 'cx.ces_response',
      CUSTOM: 'cx.survey_completed',
    }
    const eventType = eventTypeMap[survey.type] ?? 'cx.survey_completed'

    // Extract open-ended text for sentiment analysis
    const openEndedText = extractOpenEndedText(answers)

    // Create the response and update response count in a transaction
    const [response] = await fastify.prisma.$transaction([
      fastify.prisma.surveyResponse.create({
        data: {
          surveyId,
          memberId,
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

    // ── Integration Point 1: Enqueue CX event into the loyalty pipeline ──
    // This feeds directly into the existing campaign trigger evaluation
    const eventPayload: Record<string, unknown> = {
      surveyId,
      surveyType: survey.type,
      surveyName: survey.name,
      ...answers,
    }
    if (score !== undefined) {
      // Map score to field names the campaign trigger engine expects
      if (survey.type === 'NPS') eventPayload.nps_score = score
      else if (survey.type === 'CSAT') eventPayload.csat_score = score
      else if (survey.type === 'CES') eventPayload.ces_score = score
      eventPayload.score = score
    }

    const ingestedAt = new Date().toISOString()

    // Enqueue events (non-blocking — response is already saved to DB)
    let jobId: string | null = null
    try {
      const job = await enqueueEvent({
        brandId,
        memberId,
        eventType,
        payload: eventPayload,
        idempotencyKey: `survey:${surveyId}:${memberId}`,
        ingestedAt,
      })
      jobId = job.id
    } catch (err: unknown) {
      fastify.log.error({ err, surveyId, memberId }, 'Failed to enqueue CX event (response saved)')
    }

    // ── Integration Point 2: Survey incentive points ──
    if (survey.incentivePoints && survey.incentivePoints > 0) {
      enqueueEvent({
        brandId,
        memberId,
        eventType: 'cx.survey_completed',
        payload: { surveyId, surveyName: survey.name, incentive: true },
        idempotencyKey: `survey-incentive:${surveyId}:${memberId}`,
        ingestedAt,
      }).catch((err: unknown) => {
        fastify.log.error({ err, surveyId, memberId }, 'Failed to enqueue survey incentive event')
      })
    }

    // ── Integration Point 3: Sentiment analysis for open-ended text ──
    if (openEndedText) {
      enqueueSentimentAnalysis({
        surveyResponseId: response.id,
        brandId,
        memberId,
        surveyId,
        text: openEndedText,
        eventType,
        score: score ?? undefined,
      }).catch((err: unknown) => {
        fastify.log.error({ err, surveyId, memberId }, 'Failed to enqueue sentiment analysis')
      })
    }

    // ── Integration Point 4: Promoter identification ──
    if (survey.type === 'NPS' && score !== undefined && NPS.isPromoter(score)) {
      enqueueEvent({
        brandId,
        memberId,
        eventType: 'cx.promoter_identified',
        payload: { surveyId, nps_score: score, surveyName: survey.name },
        idempotencyKey: `promoter:${surveyId}:${memberId}`,
        ingestedAt,
      }).catch((err: unknown) => {
        fastify.log.error({ err, surveyId, memberId, score }, 'Failed to enqueue promoter event')
      })
    }

    return reply.status(201).send({
      responseId: response.id,
      jobId,
      message: 'Survey response recorded and events enqueued',
    })
  })
}

export default surveysRoutes
