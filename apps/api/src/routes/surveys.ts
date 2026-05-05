import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import {
  CreateSurveySchema,
  UpdateSurveySchema,
  UpdateSurveyStatusSchema,
  SubmitSurveyResponseSchema,
  LaunchSurveySchema,
  validateRuleOverlap,
  NPS,
  SOURCE_TYPES,
} from '@customerEQ/shared'
import { enqueueEvent, enqueueSentimentAnalysis, enqueueAlertEvaluation, enqueueSurveyImportRow } from '../queues/bullmq.js'
import { extractOpenEndedText } from '../utils/survey.js'
import { computeLoopMonitorWarning } from '@customerEQ/shared'
import { parseCsvRaw } from '../utils/csvParser.js'
import { runAdapter } from '../utils/importAdapters/index.js'
import type { ImportSourceType } from '../utils/importAdapters/index.js'

const surveysRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/surveys — create a new survey
  fastify.post('/surveys', async (request, reply) => {
    const parse = CreateSurveySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e: { message: string }) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const brandId = request.brandId
    const { name, programId, type, questions, settings, incentivePoints, themeId, triggerCategory, triggerKey, surveyTypeOverride } = parse.data

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
        themeId: themeId ?? null,
        triggerCategory: triggerCategory ?? null,
        triggerKey: triggerKey ?? null,
        surveyTypeOverride: surveyTypeOverride ?? null,
      },
    })

    return reply.status(201).send(survey)
  })

  // GET /v1/surveys — list surveys for the brand
  fastify.get('/surveys', async (request, reply) => {
    const page = 1
    const pageSize = 25
    const where = { brandId: request.brandId }

    const [total, data] = await Promise.all([
      fastify.prisma.survey.count({ where }),
      fastify.prisma.survey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { responses: true } } },
      }),
    ])

    return reply.status(200).send({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  })

  // GET /v1/surveys/:id — get survey with response stats
  fastify.get('/surveys/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const survey = await fastify.prisma.survey.findFirst({
      where: { id, brandId: request.brandId },
      include: {
        _count: { select: { responses: true } },
        theme: true,
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
            clusterId: true,
            cluster: { select: { label: true } },
            importBatchId: true,
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
        message: parse.error.errors.map((e: { message: string }) => e.message).join(', '),
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

  // PATCH /v1/surveys/:id — update survey details (name, questions, theme, etc.)
  fastify.patch('/surveys/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = UpdateSurveySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e: { message: string }) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const survey = await fastify.prisma.survey.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!survey) {
      return reply.status(404).send({ error: 'Survey not found' })
    }

    // Verify theme belongs to brand if provided
    if (parse.data.themeId) {
      const theme = await fastify.prisma.surveyTheme.findFirst({
        where: { id: parse.data.themeId, brandId: request.brandId },
      })
      if (!theme) {
        return reply.status(404).send({ error: 'Theme not found' })
      }
    }

    const updated = await fastify.prisma.survey.update({
      where: { id },
      data: parse.data as Prisma.SurveyUpdateInput,
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
        message: parse.error.errors.map((e: { message: string }) => e.message).join(', '),
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

    // Check for duplicate live response (partial index covers importBatchId IS NULL)
    const existing = await fastify.prisma.surveyResponse.findFirst({
      where: { surveyId, memberId, importBatchId: null },
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
      jobId = job.id ?? null
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

    // ── Integration Point 5: Alert evaluation for closed-loop ──
    enqueueAlertEvaluation({
      surveyResponseId: response.id,
      brandId,
      memberId,
      surveyId,
      surveyType: survey.type,
      score: score ?? null,
      sentiment: null, // sentiment not yet available; will be re-evaluated after analysis
      topics: [],
    }).catch((err: unknown) => {
      fastify.log.error({ err, surveyId, memberId }, 'Failed to enqueue alert evaluation')
    })

    return reply.status(201).send({
      responseId: response.id,
      jobId,
      message: 'Survey response recorded and events enqueued',
    })
  })

  // POST /v1/surveys/:id/launch — activate survey + create campaigns for each rule (Issue #80)
  // Pattern: side-effect-bearing status transition uses dedicated POST endpoint (not PATCH status)
  fastify.post('/surveys/:id/launch', async (request, reply) => {
    const { id: surveyId } = request.params as { id: string }
    const brandId = request.brandId

    const parse = LaunchSurveySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e: { message: string }) => e.message).join(', '),
        details: parse.error.errors,
      })
    }

    const { rules } = parse.data

    // Validate no overlapping score ranges before touching DB
    if (rules.length > 0) {
      const overlapErrors = validateRuleOverlap(rules)
      if (overlapErrors.length > 0) {
        return reply.status(422).send({
          error: 'Rule overlap',
          message: 'Score ranges must not overlap between rules',
          overlaps: overlapErrors,
        })
      }
    }

    const survey = await fastify.prisma.survey.findFirst({
      where: { id: surveyId, brandId },
    })
    if (!survey) {
      return reply.status(404).send({ error: 'Survey not found' })
    }

    // Idempotent: if already ACTIVE, return 200 without re-creating campaigns
    if (survey.status === 'ACTIVE') {
      const existingRuleCount = await fastify.prisma.surveyRule.count({ where: { surveyId } })
      return reply.status(200).send({ surveyId, campaignsCreated: existingRuleCount, idempotent: true })
    }

    // Transactionally: set status ACTIVE + create Campaign + SurveyRule per rule
    const campaignsCreated = await fastify.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.survey.update({
        where: { id: surveyId },
        data: { status: 'ACTIVE' },
      })

      let count = 0
      for (const rule of rules) {
        const campaign = await tx.campaign.create({
          data: {
            brandId,
            programId: survey.programId,
            name: rule.ruleLabel ?? `${survey.name} — Rule ${count + 1}`,
            triggerType: 'cx.survey_response',
            triggerCondition: { surveyId, scoreMin: rule.scoreMin, scoreMax: rule.scoreMax },
            actionType: rule.actionType,
            actionConfig: rule.actionConfig as Prisma.InputJsonValue,
            status: 'ACTIVE',
            startDate: new Date(),
            surveyId,
          },
        })
        await tx.surveyRule.create({
          data: {
            brandId,
            surveyId,
            campaignId: campaign.id,
            scoreMin: rule.scoreMin,
            scoreMax: rule.scoreMax,
            actionType: rule.actionType,
            actionConfig: rule.actionConfig as Prisma.InputJsonValue,
            ruleLabel: rule.ruleLabel ?? null,
          },
        })
        count++
      }
      return count
    })

    return reply.status(200).send({ surveyId, campaignsCreated })
  })

  // GET /v1/surveys/:id/loop-monitor — 5-stage pipeline view (Issue #80)
  // Graceful-degradation contract: Promise.all, never 5xx, null sub-fields on sub-query failure
  fastify.get('/surveys/:id/loop-monitor', async (request, reply) => {
    const { id: surveyId } = request.params as { id: string }
    const brandId = request.brandId

    const survey = await fastify.prisma.survey.findFirst({
      where: { id: surveyId, brandId },
      select: { id: true, status: true, distributionCount: true },
    })
    if (!survey) {
      return reply.status(404).send({ error: 'Survey not found' })
    }

    if (survey.status !== 'ACTIVE') {
      return reply.status(200).send({
        surveyId,
        generatedAt: new Date().toISOString(),
        status: survey.status,
        placeholder: true,
        message: 'Loop Monitor activates when the survey is live.',
      })
    }

    const generatedAt = new Date().toISOString()

    // Fetch campaign IDs linked to this survey
    const linkedCampaigns = await fastify.prisma.campaign.findMany({
      where: { surveyId, brandId },
      select: { id: true },
    })
    const campaignIds = linkedCampaigns.map((c: { id: string }) => c.id)

    // All sub-queries run in Promise.all — individual failures return null (graceful degradation)
    const [
      responsesResult,
      scoreDistResult,
      rulesMatchedResult,
      campaignsTriggeredResult,
      loyaltyOutcomesResult,
      latencyResult,
      firstResponseResult,
    ] = await Promise.allSettled([
      // responsesReceived
      fastify.prisma.surveyResponse.count({ where: { surveyId, brandId } }),
      // scoreDistribution — raw NPS buckets
      fastify.prisma.surveyResponse.groupBy({
        by: ['score'],
        where: { surveyId, brandId, score: { not: null } },
        _count: { score: true },
      }),
      // rulesMatched: CampaignEvents with surveyResponseId set (rule fired)
      campaignIds.length > 0
        ? fastify.prisma.campaignEvent.count({
            where: { campaignId: { in: campaignIds }, surveyResponseId: { not: null } },
          })
        : Promise.resolve(0),
      // campaignsTriggered: CampaignEvents with status = 'executed'
      campaignIds.length > 0
        ? fastify.prisma.campaignEvent.count({
            where: { campaignId: { in: campaignIds }, surveyResponseId: { not: null }, status: 'executed' },
          })
        : Promise.resolve(0),
      // loyaltyOutcomes.pointsAwarded
      campaignIds.length > 0
        ? fastify.prisma.loyaltyEvent.aggregate({
            where: { campaignId: { in: campaignIds } },
            _sum: { pointsEarned: true },
          })
        : Promise.resolve({ _sum: { pointsEarned: 0 } }),
      // latency percentiles via raw SQL
      campaignIds.length > 0
        ? fastify.prisma.$queryRaw<Array<{ p50: number | null; p95: number | null; sample_size: bigint }>>`
            SELECT
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "latencyMs") AS p50,
              PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs") AS p95,
              COUNT(*) AS sample_size
            FROM "campaign_events"
            WHERE "campaignId" = ANY(${campaignIds})
              AND "latencyMs" IS NOT NULL
          `
        : Promise.resolve([{ p50: null, p95: null, sample_size: BigInt(0) }]),
      // first response timestamp for 48h warning
      fastify.prisma.surveyResponse.findFirst({
        where: { surveyId, brandId },
        orderBy: { completedAt: 'asc' },
        select: { completedAt: true },
      }),
    ])

    const responsesReceived = responsesResult.status === 'fulfilled' ? responsesResult.value : null
    const scoreDistRows = scoreDistResult.status === 'fulfilled' ? scoreDistResult.value : []
    const rulesMatched = rulesMatchedResult.status === 'fulfilled' ? rulesMatchedResult.value : null
    const campaignsTriggered = campaignsTriggeredResult.status === 'fulfilled' ? campaignsTriggeredResult.value : null
    const loyaltyAgg = loyaltyOutcomesResult.status === 'fulfilled' ? loyaltyOutcomesResult.value : null
    const latencyRows = latencyResult.status === 'fulfilled' ? latencyResult.value : []
    const firstResponse = firstResponseResult.status === 'fulfilled' ? firstResponseResult.value : null

    // Build score distribution buckets for NPS (0–6, 7–8, 9–10)
    const scoreDistribution: Record<string, number> = { '0-6': 0, '7-8': 0, '9-10': 0 }
    for (const row of scoreDistRows) {
      const s = row.score as number
      if (s <= 6) scoreDistribution['0-6'] += row._count.score
      else if (s <= 8) scoreDistribution['7-8'] += row._count.score
      else scoreDistribution['9-10'] += row._count.score
    }

    // Latency
    const latencyRow = latencyRows[0] ?? { p50: null, p95: null, sample_size: BigInt(0) }
    const sampleSize = Number(latencyRow.sample_size)
    const p50Ms = sampleSize >= 10 && latencyRow.p50 !== null ? Math.round(latencyRow.p50) : null
    const p95Ms = sampleSize >= 10 && latencyRow.p95 !== null ? Math.round(latencyRow.p95) : null
    const SLA_OK_MS = 15 * 60 * 1000
    const SLA_WARN_MS = 30 * 60 * 1000
    let slaStatus: 'ok' | 'warning' | 'breach' = 'ok'
    if (p95Ms !== null) {
      if (p95Ms > SLA_WARN_MS) slaStatus = 'breach'
      else if (p95Ms > SLA_OK_MS) slaStatus = 'warning'
    }

    // 48h warning
    const firstResponseAt = firstResponse?.completedAt ?? null
    const warning = computeLoopMonitorWarning(firstResponseAt, campaignsTriggered ?? 0)

    return reply.status(200).send({
      surveyId,
      generatedAt,
      pipeline: {
        surveysSent: survey.distributionCount,
        responsesReceived,
        scoreDistribution,
        rulesMatched,
        campaignsTriggered,
        loyaltyOutcomes: {
          pointsAwarded: loyaltyAgg?._sum?.pointsEarned ?? null,
          rewardsIssued: null, // future: count redemptions linked to these campaigns
          retentionDelta: null, // deferred — requires cohort query
        },
      },
      latency: {
        p50Ms,
        p95Ms,
        sampleSize,
        slaStatus,
      },
      warning,
    })
  })

  // ─── Issue #262: Historical Survey Data Import ───────────────────────────────

  // POST /v1/surveys/:id/import — upload a CSV of historical responses
  fastify.addContentTypeParser('text/csv', { parseAs: 'string' }, (_req, body, done) => done(null, body))

  fastify.post('/surveys/:id/import', async (request, reply) => {
    const { id: surveyId } = request.params as { id: string }
    const brandId = request.brandId
    const sourceType = (request.query as Record<string, string>)['sourceType'] as ImportSourceType | undefined

    if (!sourceType || !(SOURCE_TYPES as readonly string[]).includes(sourceType)) {
      return reply.status(422).send({
        error: 'Validation Error',
        message: `sourceType is required. Must be one of: ${SOURCE_TYPES.join(', ')}`,
      })
    }

    const body = request.body as string
    if (!body || Buffer.byteLength(body, 'utf8') > 10 * 1024 * 1024) {
      return reply.status(413).send({ error: 'Payload Too Large', message: 'File must be ≤ 10 MB' })
    }

    const survey = await fastify.prisma.survey.findFirst({ where: { id: surveyId, brandId } })
    if (!survey) return reply.status(404).send({ error: 'Not Found', message: 'Survey not found' })

    const { headers, rows } = parseCsvRaw(body)
    if (rows.length === 0) {
      return reply.status(422).send({ error: 'Validation Error', message: 'CSV contains no data rows' })
    }

    const { rows: canonical, validationErrors } = runAdapter(sourceType, headers, rows, new Date())
    if (validationErrors.length > 0) {
      return reply.status(422).send({ error: 'Validation Error', message: validationErrors[0] })
    }

    const batch = await fastify.prisma.surveyImportBatch.create({
      data: {
        surveyId,
        brandId,
        sourceType,
        totalRows: canonical.length,
        status: 'pending',
      },
    })

    await Promise.all(
      canonical.map((row, i) =>
        enqueueSurveyImportRow({
          batchId: batch.id,
          surveyId,
          brandId,
          rowIndex: i,
          sourceType: row.sourceType,
          email: row.email,
          score: row.score,
          verbatim: row.verbatim,
          completedAt: row.completedAt.toISOString(),
          channel: row.channel,
          externalId: row.externalId,
          rawAnswers: row.rawAnswers,
        }),
      ),
    )

    return reply.status(202).send({
      batchId: batch.id,
      rowCount: canonical.length,
      validationErrors: [],
    })
  })

  // GET /v1/surveys/:id/imports — list import batches for a survey
  fastify.get('/surveys/:id/imports', async (request, reply) => {
    const { id: surveyId } = request.params as { id: string }
    const brandId = request.brandId

    const survey = await fastify.prisma.survey.findFirst({ where: { id: surveyId, brandId } })
    if (!survey) return reply.status(404).send({ error: 'Not Found', message: 'Survey not found' })

    const batches = await fastify.prisma.surveyImportBatch.findMany({
      where: { surveyId, brandId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceType: true,
        status: true,
        totalRows: true,
        processedRows: true,
        failedRows: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return reply.send(batches)
  })

  // GET /v1/surveys/:id/imports/:batchId — batch detail with error log
  fastify.get('/surveys/:id/imports/:batchId', async (request, reply) => {
    const { id: surveyId, batchId } = request.params as { id: string; batchId: string }
    const brandId = request.brandId

    const batch = await fastify.prisma.surveyImportBatch.findFirst({
      where: { id: batchId, surveyId, brandId, deletedAt: null },
    })
    if (!batch) return reply.status(404).send({ error: 'Not Found', message: 'Import batch not found' })

    return reply.send(batch)
  })
}

export default surveysRoutes
