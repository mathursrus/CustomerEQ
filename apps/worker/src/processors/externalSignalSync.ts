import type { Job, ConnectionOptions } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type { ExternalSignalSyncPayload } from '@customerEQ/shared'
import { extractExternalSignalDeliveries } from '@customerEQ/shared'
import { enqueueExternalSignalIngestion } from '../queues/producers.js'

const logger = pino({ name: 'external-signal-sync' })

export function createExternalSignalSyncProcessor(connection: ConnectionOptions) {
  return async function processExternalSignalSync(
    job: Job<ExternalSignalSyncPayload>,
  ) {
    const source = await prisma.externalSignalSource.findFirst({
      where: { id: job.data.sourceId, brandId: job.data.brandId },
      select: {
        id: true,
        scopeConfig: true,
      },
    })

    if (!source) {
      throw new Error(`External signal source ${job.data.sourceId} not found`)
    }

    const scopeConfig = (source.scopeConfig ?? {}) as Record<string, unknown>
    const deliveries = extractExternalSignalDeliveries(
      scopeConfig.samplePayloads ?? scopeConfig.seedSignals ?? [],
    )

    if (deliveries.length === 0) {
      await prisma.externalSignalSource.update({
        where: { id: source.id },
        data: {
          healthStatus: 'error',
          lastError: 'No sample payloads configured for this source sync.',
          lastErrorAt: new Date(),
          lastSyncAt: new Date(),
        },
      })

      return { queued: 0 }
    }

    await enqueueExternalSignalIngestion(connection, {
      brandId: job.data.brandId,
      sourceId: source.id,
      deliveries,
      receivedAt: new Date().toISOString(),
      deliveryType: 'sync',
    })

    logger.info({ sourceId: source.id, queued: deliveries.length }, 'external_source.sync_started')

    return { queued: deliveries.length }
  }
}
