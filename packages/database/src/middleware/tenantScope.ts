import { PrismaClient } from '@prisma/client'

const TENANT_SCOPED_MODELS = new Set([
  'Program',
  'EarningRule',
  'Member',
  'LoyaltyEvent',
  'Reward',
  'Redemption',
  'Campaign',
  'CampaignEvent',
  'AuditEvent',
])

/**
 * Creates a Prisma client extension that automatically scopes all queries
 * to the requesting brand's data. The brandId is injected via a closure
 * bound to the Fastify request object — one per request, never shared.
 *
 * Implements R3.5, C-05: brandId from JWT only, never from request body.
 */
export function applyTenantScope(prisma: PrismaClient, getBrandId: () => string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string | undefined
          operation: string
          args: Record<string, unknown>
          query: (args: Record<string, unknown>) => Promise<unknown>
        }) {
          if (!TENANT_SCOPED_MODELS.has(model!)) return query(args)

          const brandId = getBrandId()

          if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            args.where = { ...(args.where ?? {}), brandId }
          }

          if (operation === 'create') {
            args.data = { ...(args.data ?? {}), brandId }
          }

          if (operation === 'createMany') {
            const data = (args.data as Record<string, unknown>[]) ?? []
            args.data = data.map((item) => ({ ...item, brandId }))
          }

          if (['update', 'delete', 'upsert'].includes(operation)) {
            args.where = { ...(args.where ?? {}), brandId }
          }

          if (['updateMany', 'deleteMany'].includes(operation)) {
            args.where = { ...(args.where ?? {}), brandId }
          }

          return query(args)
        },
      },
    },
  })
}
