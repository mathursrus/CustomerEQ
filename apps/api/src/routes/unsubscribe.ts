// Issue #420 — Public unsubscribe endpoints. No auth (per RFC §3.6).
// GET  /u/:token         — render-state lookup (used by the unsubscribe landing page)
// POST /u/:token/confirm — idempotent unsubscribe confirmation
//
// Compliance contract:
// - Sets Member.unsubscribedSurveysAt (NOT Member.emailOptIn — those are
//   separate per Round-7 reviewer decision)
// - Idempotent: second confirm preserves the original timestamp via COALESCE
// - The token plaintext is never stored — we hash the URL-provided token and
//   match by tokenHash + tokenPrefix
import type { FastifyPluginAsync } from 'fastify'
import { hashToken } from '@customerEQ/shared/distributionTokens'
import {
  UnsubscribeTokenViewResponseSchema,
  UnsubscribeConfirmResponseSchema,
} from '@customerEQ/shared'

const unsubscribeRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /u/:token — public render-state lookup
  fastify.get(
    '/u/:token',
    {
      config: { public: true },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string }
      if (!token) {
        return reply.status(200).send({ state: 'invalid' })
      }
      const hash = hashToken(token)
      const record = await fastify.prisma.memberUnsubscribeToken.findFirst({
        where: { tokenHash: hash },
        select: { consumedAt: true, brandId: true },
      })
      if (!record) {
        return reply.status(200).send({ state: 'invalid' })
      }
      const brand = await fastify.prisma.brand.findUnique({
        where: { id: record.brandId },
        select: { name: true },
      })
      const state = record.consumedAt ? 'already-confirmed' : 'valid'
      return reply.status(200).send({
        state,
        brandName: brand?.name ?? undefined,
      } satisfies (typeof UnsubscribeTokenViewResponseSchema)['_output'])
    },
  )

  // POST /u/:token/confirm — idempotent. No auth.
  fastify.post(
    '/u/:token/confirm',
    {
      config: {
        public: true,
        auditAction: 'member.unsubscribed_surveys',
        auditResourceType: 'member',
        auditAllowlist: ['memberId', 'brandId', 'batchId', 'tokenPrefix'],
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string }
      if (!token) {
        return reply.status(400).send({ error: 'Invalid token' })
      }
      const hash = hashToken(token)
      const record = await fastify.prisma.memberUnsubscribeToken.findFirst({
        where: { tokenHash: hash },
        select: {
          id: true,
          memberId: true,
          brandId: true,
          batchId: true,
          tokenPrefix: true,
          consumedAt: true,
        },
      })
      if (!record) {
        return reply.status(404).send({ error: 'Unknown token' })
      }

      if (record.consumedAt) {
        // Idempotent — second call is a no-op. Member.unsubscribedSurveysAt
        // already set on the first call; preserved by COALESCE below regardless.
        return reply.status(200).send({
          state: 'already-confirmed',
        } satisfies (typeof UnsubscribeConfirmResponseSchema)['_output'])
      }

      // COALESCE preserves the original timestamp if a race condition (or a
      // hand-set value) already populated it; second confirm is still a no-op.
      await fastify.prisma.$transaction([
        fastify.prisma.$executeRaw`
          UPDATE "members"
          SET "unsubscribedSurveysAt" = COALESCE("unsubscribedSurveysAt", NOW())
          WHERE "id" = ${record.memberId}
        `,
        fastify.prisma.memberUnsubscribeToken.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        }),
      ])

      // Set request.brandId so the audit plugin can pin the audit row
      // (public routes don't have multiTenant resolution).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(request as any).brandId = record.brandId
      request.audit = {
        metadata: {
          memberId: record.memberId,
          brandId: record.brandId,
          batchId: record.batchId,
          tokenPrefix: record.tokenPrefix,
        },
      }

      return reply.status(200).send({
        state: 'confirmed',
      } satisfies (typeof UnsubscribeConfirmResponseSchema)['_output'])
    },
  )
}

export default unsubscribeRoutes
