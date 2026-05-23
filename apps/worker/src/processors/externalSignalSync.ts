import type { Job, ConnectionOptions } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import { Prisma } from '@prisma/client'
import type { ExternalSignalSyncPayload } from '@customerEQ/shared'
import { extractExternalSignalDeliveries } from '@customerEQ/shared'
import { enqueueExternalSignalIngestion } from '../queues/producers.js'
import { CONNECTORS, ConnectorAuthError, ConnectorRateLimitError } from '@customerEQ/connectors'

const logger = pino({ name: 'external-signal-sync' })

export function createExternalSignalSyncProcessor(connection: ConnectionOptions) {
  return async function processExternalSignalSync(
    job: Job<ExternalSignalSyncPayload>,
  ) {
    const source = await prisma.externalSignalSource.findFirst({
      where: { id: job.data.sourceId, brandId: job.data.brandId },
      select: {
        id: true,
        sourceType: true,
        scopeConfig: true,
        credentialRef: true,
        lastCursor: true,
      },
    })

    if (!source) {
      throw new Error(`External signal source ${job.data.sourceId} not found`)
    }

    const scopeConfig = (source.scopeConfig ?? {}) as Record<string, unknown>
    const connector = CONNECTORS[source.sourceType]

    // If a native connector exists, use it; otherwise fall back to samplePayloads
    if (connector) {
      return await syncViaConnector(
        connection,
        job.data,
        source as {
          id: string
          sourceType: string
          scopeConfig: unknown
          credentialRef: string | null
          lastCursor: unknown
        },
        connector,
      )
    }

    // Fallback: read samplePayloads / seedSignals from scopeConfig
    return await syncViaSamplePayloads(connection, job.data, source.id, scopeConfig)
  }
}

async function syncViaConnector(
  connection: ConnectionOptions,
  jobData: ExternalSignalSyncPayload,
  source: {
    id: string
    sourceType: string
    scopeConfig: unknown
    credentialRef: string | null
    lastCursor: unknown
  },
  connector: NonNullable<(typeof CONNECTORS)[string]>,
) {
  const scopeConfig = (source.scopeConfig ?? {}) as Record<string, unknown>
  const lastCursor = (source.lastCursor ?? null) as Record<string, unknown> | null

  try {
    const result = await connector({
      sourceId: source.id,
      brandId: jobData.brandId,
      scopeConfig,
      lastCursor,
      credentialRef: source.credentialRef,
    })

    if (result.deliveries.length === 0) {
      logger.info({ sourceId: source.id }, 'external_source.sync_no_new_data')

      // Update cursor even if no deliveries (so next poll starts from correct position)
      if (result.nextCursor) {
        await prisma.externalSignalSource.update({
          where: { id: source.id },
          data: {
            lastCursor: result.nextCursor as Prisma.InputJsonValue,
            lastSyncAt: new Date(),
          },
        })
      }

      return { queued: 0 }
    }

    await enqueueExternalSignalIngestion(connection, {
      brandId: jobData.brandId,
      sourceId: source.id,
      deliveries: result.deliveries,
      receivedAt: new Date().toISOString(),
      deliveryType: 'sync',
    })

    const updateData: Record<string, unknown> = {
      lastSyncAt: new Date(),
    }
    if (result.nextCursor) {
      updateData.lastCursor = result.nextCursor
    }
    if (result.updatedCredentials) {
      updateData.scopeConfig = {
        ...scopeConfig,
        credentials: result.updatedCredentials,
      }
    }

    await prisma.externalSignalSource.update({
      where: { id: source.id },
      data: updateData,
    })

    logger.info(
      { sourceId: source.id, queued: result.deliveries.length },
      'external_source.sync_started',
    )

    return { queued: result.deliveries.length }
  } catch (err) {
    if (err instanceof ConnectorAuthError) {
      // Auth errors need human intervention — don't retry.
      // Still persist any refreshed credentials so subsequent retries don't
      // hit a second token-refresh failure after the real error is resolved.
      const authErrUpdate: Record<string, unknown> = {
        healthStatus: 'auth_error',
        lastError: err.message,
        lastErrorAt: new Date(),
        lastSyncAt: new Date(),
      }
      if (err.updatedCredentials) {
        authErrUpdate.scopeConfig = { ...scopeConfig, credentials: err.updatedCredentials }
      }
      await prisma.externalSignalSource.update({
        where: { id: source.id },
        data: authErrUpdate,
      })
      logger.error({ sourceId: source.id, err: err.message }, 'external_source.auth_error')
      return { queued: 0, error: err.message }
    }

    if (err instanceof ConnectorRateLimitError) {
      // Rate limit — rethrow so BullMQ retries after backoff
      logger.warn(
        { sourceId: source.id, retryAfterMs: err.retryAfterMs },
        'external_source.rate_limited',
      )
      throw err
    }

    // Other errors — mark unhealthy and rethrow for retry
    await prisma.externalSignalSource.update({
      where: { id: source.id },
      data: {
        healthStatus: 'error',
        lastError: err instanceof Error ? err.message : 'Unknown sync error',
        lastErrorAt: new Date(),
        lastSyncAt: new Date(),
      },
    })
    throw err
  }
}

async function syncViaSamplePayloads(
  connection: ConnectionOptions,
  jobData: ExternalSignalSyncPayload,
  sourceId: string,
  scopeConfig: Record<string, unknown>,
) {
  const deliveries = extractExternalSignalDeliveries(
    scopeConfig.samplePayloads ?? scopeConfig.seedSignals ?? [],
  )

  if (deliveries.length === 0) {
    await prisma.externalSignalSource.update({
      where: { id: sourceId },
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
    brandId: jobData.brandId,
    sourceId,
    deliveries,
    receivedAt: new Date().toISOString(),
    deliveryType: 'sync',
  })

  logger.info({ sourceId, queued: deliveries.length }, 'external_source.sync_started')

  return { queued: deliveries.length }
}
