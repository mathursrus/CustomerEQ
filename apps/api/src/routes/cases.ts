import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { UpdateCaseStatusSchema, AddCaseNoteSchema } from '@customerEQ/shared'
import { enqueueWebhookDelivery } from '../queues/bullmq.js'

/**
 * Extract a human-readable feedback string from a survey response.
 * Looks for the first open-ended text answer in the answers JSON, falling back
 * to summary if present, or an empty string.
 */
function extractFeedback(
  answers: Record<string, unknown> | null | undefined,
  summary: string | null | undefined,
): string {
  if (answers && typeof answers === 'object') {
    const values = Object.values(answers)
    const text = values.find((v) => typeof v === 'string' && (v as string).trim().length > 0)
    if (text) return text as string
  }
  return summary ?? ''
}

const casesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/cases — list cases with filters
  fastify.get('/cases', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>
    const where: Prisma.CaseFollowUpWhereInput = { brandId: request.brandId }

    if (query.status) where.status = query.status
    if (query.assignee) where.assignee = query.assignee
    if (query.alertRuleId) where.alertRuleId = query.alertRuleId

    // Date range filter
    if (query.startDate || query.endDate) {
      where.createdAt = {}
      if (query.startDate) where.createdAt.gte = new Date(query.startDate)
      if (query.endDate) where.createdAt.lte = new Date(query.endDate)
    }

    const cases = await fastify.prisma.caseFollowUp.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        alertRule: { select: { name: true, slaHours: true } },
        // Include survey response so the list can show score / feedback / survey name
        surveyResponse: {
          select: {
            score: true,
            sentiment: true,
            topics: true,
            summary: true,
            answers: true,
            survey: { select: { name: true } },
          },
        },
      },
    })

    // Compute SLA status for each case
    const now = new Date()
    // Derive element type from the Prisma findMany result to satisfy strict noImplicitAny
    type CaseRow = (typeof cases)[number]
    const enriched = cases.map((c: CaseRow) => {
      const sr = c.surveyResponse
      return {
        ...c,
        // Flatten survey response fields onto the case for the UI
        score: sr?.score ?? null,
        sentiment: sr?.sentiment ?? null,
        topics: sr?.topics ?? [],
        surveyName: sr?.survey?.name ?? null,
        feedback: extractFeedback(
          sr?.answers as Record<string, unknown> | null,
          sr?.summary,
        ),
        slaTarget: c.slaDeadline?.toISOString() ?? null,
        alertRuleName: c.alertRule?.name ?? null,
        channelsNotified: [] as never[],  // populated by alerting worker; not in DB yet
        slaStatus: c.slaDeadline
          ? now > c.slaDeadline && c.status === 'OPEN'
            ? 'OVERDUE'
            : 'ON_TRACK'
          : null,
      }
    })

    // Compute summary stats using raw cases (Prisma-typed)
    const open = cases.filter((c: CaseRow) => c.status === 'OPEN').length
    const contacted = cases.filter((c: CaseRow) => c.status === 'CONTACTED').length
    const resolved = cases.filter((c: CaseRow) => c.status === 'RESOLVED').length
    const closed = cases.filter((c: CaseRow) => c.status === 'CLOSED').length
    type EnrichedRow = (typeof enriched)[number]
    const overdue = enriched.filter(
      (c: EnrichedRow): boolean => c.slaStatus === 'OVERDUE',
    ).length
    const stats = { open, contacted, resolved, closed, overdue }

    return reply.status(200).send({ cases: enriched, stats })
  })

  // GET /v1/cases/:id — get case detail with timeline
  fastify.get('/cases/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const caseRecord = await fastify.prisma.caseFollowUp.findFirst({
      where: { id, brandId: request.brandId },
      include: {
        alertRule: { select: { name: true, slaHours: true } },
        // Include survey response for the detail view
        surveyResponse: {
          select: {
            score: true,
            sentiment: true,
            topics: true,
            summary: true,
            answers: true,
            survey: { select: { name: true } },
          },
        },
      },
    })
    if (!caseRecord) return reply.status(404).send({ error: 'Case not found' })

    // Compute SLA status
    const now = new Date()
    const slaStatus = caseRecord.slaDeadline
      ? now > caseRecord.slaDeadline &&
        (caseRecord.status === 'OPEN' || caseRecord.status === 'CONTACTED')
        ? 'OVERDUE'
        : 'ON_TRACK'
      : null

    const sr = caseRecord.surveyResponse

    return reply.status(200).send({
      ...caseRecord,
      // Flatten survey response data so the UI doesn't need to traverse the relation
      score: sr?.score ?? null,
      sentiment: sr?.sentiment ?? null,
      topics: sr?.topics ?? [],
      surveyName: sr?.survey?.name ?? null,
      feedback: extractFeedback(
        sr?.answers as Record<string, unknown> | null,
        sr?.summary,
      ),
      // slaTarget is what the UI uses; map from slaDeadline
      slaTarget: caseRecord.slaDeadline?.toISOString() ?? null,
      alertRuleName: caseRecord.alertRule?.name ?? null,
      // channelsNotified is populated by the alerting worker; not stored in DB yet
      channelsNotified: [],
      notes: (caseRecord.notes as Array<Record<string, unknown>>) ?? [],
      slaStatus,
    })
  })

  // PATCH /v1/cases/:id/status — update case status
  fastify.patch('/cases/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = UpdateCaseStatusSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const caseRecord = await fastify.prisma.caseFollowUp.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!caseRecord) return reply.status(404).send({ error: 'Case not found' })

    const data: Prisma.CaseFollowUpUpdateInput = { status: parse.data.status }

    // Set lifecycle timestamps
    if (parse.data.status === 'CONTACTED') data.contactedAt = new Date()
    if (parse.data.status === 'RESOLVED') data.resolvedAt = new Date()
    if (parse.data.status === 'CLOSED') data.closedAt = new Date()

    // Add status change to notes
    const notes = (caseRecord.notes as Array<Record<string, unknown>>) ?? []
    notes.push({
      text: `Status changed to ${parse.data.status}`,
      author: 'system',
      timestamp: new Date().toISOString(),
      statusChange: { from: caseRecord.status, to: parse.data.status },
    })
    data.notes = notes as unknown as Prisma.InputJsonValue

    const updated = await fastify.prisma.caseFollowUp.update({
      where: { id },
      data,
    })

    // Enqueue outbound webhook delivery for case.status_changed event (non-blocking)
    fastify.prisma.webhookEndpoint.findMany({
      where: { brandId: request.brandId, active: true, events: { has: 'case.status_changed' } },
      select: { id: true },
    }).then((endpoints) => {
      for (const ep of endpoints) {
        enqueueWebhookDelivery({
          webhookEndpointId: ep.id,
          brandId: request.brandId,
          event: 'case.status_changed',
          caseId: id,
          data: { status: updated.status, previousStatus: caseRecord.status },
        }).catch(() => { /* best-effort */ })
      }
    }).catch(() => { /* best-effort */ })

    return reply.status(200).send(updated)
  })

  // POST /v1/cases/:id/notes — add a note to a case
  fastify.post('/cases/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parse = AddCaseNoteSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.status(422).send({
        error: 'Validation failed',
        message: parse.error.errors.map((e) => e.message).join(', '),
      })
    }

    const caseRecord = await fastify.prisma.caseFollowUp.findFirst({
      where: { id, brandId: request.brandId },
    })
    if (!caseRecord) return reply.status(404).send({ error: 'Case not found' })

    const notes = (caseRecord.notes as Array<Record<string, unknown>>) ?? []
    notes.push({
      text: parse.data.text,
      author: parse.data.author,
      timestamp: new Date().toISOString(),
    })

    const updated = await fastify.prisma.caseFollowUp.update({
      where: { id },
      data: { notes: notes as unknown as Prisma.InputJsonValue },
    })

    return reply.status(200).send(updated)
  })
}

export default casesRoutes
