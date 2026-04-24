import type { ConnectionOptions } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type { WebhookDeliveryPayload } from '@customerEQ/shared'
import { enqueueWebhookDelivery } from '../queues/producers.js'

const logger = pino({ name: 'sla-breach-check' })

type EnqueueFn = (payload: WebhookDeliveryPayload) => Promise<unknown>

/**
 * Core SLA breach check logic — finds overdue CaseFollowUp records and
 * enqueues case.overdue webhook deliveries.
 *
 * Accepts injected dependencies so the logic is unit-testable without a
 * real database or queue connection.
 */
export async function runSlaBreachCheck(
  db: typeof prisma,
  enqueue: EnqueueFn,
): Promise<{ processed: number }> {
  const now = new Date()

  const overdueCases = await db.caseFollowUp.findMany({
    where: {
      slaDeadline: { lt: now },
      slaBreachedAt: null,
      status: { in: ['OPEN', 'CONTACTED'] },
    },
    select: { id: true, brandId: true },
  })

  if (overdueCases.length === 0) return { processed: 0 }

  let processed = 0

  for (const c of overdueCases) {
    // Set slaBreachedAt first — acts as dedup guard against concurrent runs
    await db.caseFollowUp.update({
      where: { id: c.id },
      data: { slaBreachedAt: now },
    })

    // Load active endpoints subscribed to case.overdue for this brand
    const endpoints = await db.webhookEndpoint.findMany({
      where: {
        brandId: c.brandId,
        active: true,
        events: { has: 'case.overdue' },
      },
      select: { id: true },
    })

    for (const endpoint of endpoints) {
      try {
        await enqueue({
          webhookEndpointId: endpoint.id,
          brandId: c.brandId,
          event: 'case.overdue',
          caseId: c.id,
          data: { slaBreachedAt: now.toISOString() },
        })
      } catch (err) {
        logger.error({ caseId: c.id, webhookEndpointId: endpoint.id, err }, 'Failed to enqueue case.overdue delivery')
      }
    }

    processed++
  }

  logger.info({ processed }, 'SLA breach check complete')
  return { processed }
}

/**
 * BullMQ-compatible processor factory.
 * In QUEUE_MODE=redis the repeating job calls this function.
 * In QUEUE_MODE=inline this is not used — the SLA breach check can be
 * called directly via runSlaBreachCheck() in tests or a test helper.
 */
export function createSlaBreachCheckProcessor(connection: ConnectionOptions) {
  return async function processSlaBreachCheck() {
    const enqueue = (payload: WebhookDeliveryPayload) =>
      enqueueWebhookDelivery(connection, payload)
    return runSlaBreachCheck(prisma, enqueue)
  }
}
