import type { Job } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import { Prisma } from '@prisma/client'
import type { ExternalSignalIngestionPayload } from '@customerEQ/shared'
import {
  deriveExternalSignalStatus,
  extractExternalSignalDeliveries,
  normalizeExternalSignalCandidate,
} from '@customerEQ/shared'

const logger = pino({ name: 'external-signal-ingestion' })

async function resolveExternalSignalMember(
  brandId: string,
  sourceMatchingConfig: Prisma.JsonValue | null | undefined,
  memberEmail: string | null,
) {
  const matchingConfig = (sourceMatchingConfig ?? {}) as Record<string, unknown>
  if (matchingConfig.memberResolutionEnabled === false || !memberEmail) {
    return {
      memberId: null,
      matchStatus: 'UNMATCHED' as const,
      matchConfidence: null,
      matchMethod: null,
    }
  }

  const member = await prisma.member.findUnique({
    where: { brandId_email: { brandId, email: memberEmail } },
    select: { id: true, consentGivenAt: true },
  })

  if (!member || !member.consentGivenAt) {
    return {
      memberId: null,
      matchStatus: 'UNMATCHED' as const,
      matchConfidence: null,
      matchMethod: null,
    }
  }

  return {
    memberId: member.id,
    matchStatus: 'MATCHED' as const,
    matchConfidence: 1,
    matchMethod: 'email_exact',
  }
}

export async function processExternalSignalIngestion(
  job: Job<ExternalSignalIngestionPayload>,
) {
  const source = await prisma.externalSignalSource.findFirst({
    where: { id: job.data.sourceId, brandId: job.data.brandId },
  })
  if (!source) {
    throw new Error(`External signal source ${job.data.sourceId} not found`)
  }

  await prisma.externalSignalSource.update({
    where: { id: source.id },
    data: { lastSyncAt: new Date(job.data.receivedAt) },
  })

  const deliveries = extractExternalSignalDeliveries(job.data.deliveries)
  let importedCount = 0

  for (const record of deliveries) {
    const candidate = normalizeExternalSignalCandidate(record)
    const body = candidate.body || candidate.summary || '[No body provided]'
    const match = await resolveExternalSignalMember(
      job.data.brandId,
      source.matchingConfig,
      candidate.memberEmail,
    )

    const nextStatus = deriveExternalSignalStatus(candidate.providerStatus)
    const postedAt = candidate.postedAt ? new Date(candidate.postedAt) : null

    const sharedData = {
      memberId: match.memberId,
      status: nextStatus,
      matchStatus: match.matchStatus,
      matchConfidence: match.matchConfidence,
      matchMethod: match.matchMethod,
      body,
      summary: candidate.summary,
      rating: candidate.rating,
      sentiment: candidate.sentiment,
      confidence: candidate.confidence,
      topics: candidate.topics,
      canonicalUrl: candidate.canonicalUrl,
      externalAuthorHandle: candidate.externalAuthorHandle,
      externalAuthorLabel: candidate.externalAuthorLabel,
      subjectType: candidate.subjectType,
      subjectKey: candidate.subjectKey,
      subjectLabel: candidate.subjectLabel,
      providerStatus: candidate.providerStatus,
      providerMetadata:
        candidate.providerMetadata == null
          ? Prisma.JsonNull
          : (candidate.providerMetadata as Prisma.InputJsonValue),
      rawPayload: candidate.rawPayload as Prisma.InputJsonValue,
      postedAt,
    }

    const MAX_STATUS_HISTORY = 50

    // Look up existing record for status history computation
    const existing = await prisma.externalSignal.findUnique({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: candidate.externalId,
        },
      },
      select: { providerStatus: true, statusHistory: true },
    })

    const nextStatusHistory = Array.isArray(existing?.statusHistory)
      ? [...existing.statusHistory]
      : []
    if (candidate.providerStatus && existing?.providerStatus !== candidate.providerStatus) {
      nextStatusHistory.push({
        providerStatus: candidate.providerStatus,
        changedAt: new Date(job.data.receivedAt).toISOString(),
      })
    }
    // Cap status history to prevent unbounded growth
    const cappedHistory = nextStatusHistory.slice(-MAX_STATUS_HISTORY)

    // Use upsert for atomic dedupe — avoids P2002 race under concurrent syncs
    await prisma.externalSignal.upsert({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: candidate.externalId,
        },
      },
      update: {
        ...sharedData,
        statusHistory: cappedHistory as Prisma.InputJsonValue[],
      },
      create: {
        brandId: job.data.brandId,
        sourceId: source.id,
        sourceType: source.sourceType,
        externalId: candidate.externalId,
        ingestedAt: new Date(job.data.receivedAt),
        statusHistory: cappedHistory as unknown as Prisma.InputJsonValue,
        ...sharedData,
      },
    })

    importedCount += 1
  }

  await prisma.externalSignalSource.update({
    where: { id: source.id },
    data: {
      healthStatus: 'healthy',
      lastSuccessAt: new Date(job.data.receivedAt),
      lastImportCount: importedCount,
      lastError: null,
      lastErrorAt: null,
    },
  })

  logger.info({ sourceId: source.id, importedCount }, 'external_signal.ingested')

  return { importedCount }
}
