// @ts-nocheck — CaseFollowUp model requires prisma generate (blocked by OneDrive file lock locally)
import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { UpdateCaseStatusSchema, AddCaseNoteSchema } from '@customerEQ/shared'

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
      },
    })

    // Compute SLA status for each case
    const now = new Date()
    const enriched = cases.map((c) => ({
      ...c,
      slaStatus: c.slaDeadline
        ? now > c.slaDeadline && c.status === 'OPEN'
          ? 'OVERDUE'
          : 'ON_TRACK'
        : null,
    }))

    // Compute summary stats
    const stats = {
      open: cases.filter((c) => c.status === 'OPEN').length,
      contacted: cases.filter((c) => c.status === 'CONTACTED').length,
      resolved: cases.filter((c) => c.status === 'RESOLVED').length,
      closed: cases.filter((c) => c.status === 'CLOSED').length,
      overdue: enriched.filter((c) => c.slaStatus === 'OVERDUE').length,
    }

    return reply.status(200).send({ cases: enriched, stats })
  })

  // GET /v1/cases/:id — get case detail with timeline
  fastify.get('/cases/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const caseRecord = await fastify.prisma.caseFollowUp.findFirst({
      where: { id, brandId: request.brandId },
      include: {
        alertRule: { select: { name: true, slaHours: true } },
      },
    })
    if (!caseRecord) return reply.status(404).send({ error: 'Case not found' })

    // Compute SLA status
    const now = new Date()
    const slaStatus = caseRecord.slaDeadline
      ? now > caseRecord.slaDeadline && (caseRecord.status === 'OPEN' || caseRecord.status === 'CONTACTED')
        ? 'OVERDUE'
        : 'ON_TRACK'
      : null

    return reply.status(200).send({ ...caseRecord, slaStatus })
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
