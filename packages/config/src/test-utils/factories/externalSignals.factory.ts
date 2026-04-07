import { getTestPrisma } from '../db/setup.js'
import { Prisma } from '@prisma/client'
import type {
  ExternalMatchStatus,
  ExternalSignalStatus,
  ExternalSourceType,
  ExternalSyncMode,
} from '@customerEQ/shared'

let counter = 0

export async function createExternalSignalSource(opts: {
  brandId: string
  name?: string
  sourceType?: ExternalSourceType
  connectionMethod?: string
  syncMode?: ExternalSyncMode
  enabled?: boolean
  scopeConfig?: Record<string, unknown>
  filterConfig?: Record<string, unknown> | null
  matchingConfig?: Record<string, unknown> | null
  credentialRef?: string | null
  healthStatus?: string
  lastCursor?: Record<string, unknown> | null
  lastSyncAt?: Date | null
  lastSuccessAt?: Date | null
  lastImportCount?: number | null
  lastError?: string | null
  lastErrorAt?: Date | null
}) {
  const prisma = getTestPrisma()
  counter += 1

  return prisma.externalSignalSource.create({
    data: {
      brandId: opts.brandId,
      name: opts.name ?? `Source ${counter}`,
      sourceType: opts.sourceType ?? 'GENERIC_WEBHOOK',
      connectionMethod: opts.connectionMethod ?? 'webhook_secret',
      syncMode: opts.syncMode ?? 'WEBHOOK',
      enabled: opts.enabled ?? true,
      scopeConfig: (opts.scopeConfig ?? { topic: `scope-${counter}` }) as Prisma.InputJsonValue,
      filterConfig: opts.filterConfig == null ? Prisma.JsonNull : (opts.filterConfig as Prisma.InputJsonValue),
      matchingConfig:
        opts.matchingConfig == null
          ? Prisma.JsonNull
          : (opts.matchingConfig as Prisma.InputJsonValue),
      credentialRef: opts.credentialRef ?? null,
      healthStatus: opts.healthStatus ?? 'healthy',
      lastCursor:
        opts.lastCursor == null ? Prisma.JsonNull : (opts.lastCursor as Prisma.InputJsonValue),
      lastSyncAt: opts.lastSyncAt ?? null,
      lastSuccessAt: opts.lastSuccessAt ?? null,
      lastImportCount: opts.lastImportCount ?? null,
      lastError: opts.lastError ?? null,
      lastErrorAt: opts.lastErrorAt ?? null,
    },
  })
}

export async function createExternalSignal(opts: {
  brandId: string
  sourceId: string
  memberId?: string | null
  sourceType?: ExternalSourceType
  externalId?: string
  status?: ExternalSignalStatus
  matchStatus?: ExternalMatchStatus
  matchConfidence?: number | null
  matchMethod?: string | null
  body?: string
  summary?: string | null
  rating?: number | null
  sentiment?: number | null
  confidence?: number | null
  topics?: string[]
  canonicalUrl?: string | null
  externalAuthorHandle?: string | null
  externalAuthorLabel?: string | null
  subjectType?: string | null
  subjectKey?: string | null
  subjectLabel?: string | null
  providerStatus?: string | null
  providerMetadata?: Record<string, unknown> | null
  rawPayload?: Record<string, unknown>
  postedAt?: Date | null
}) {
  const prisma = getTestPrisma()
  counter += 1

  return prisma.externalSignal.create({
    data: {
      brandId: opts.brandId,
      sourceId: opts.sourceId,
      memberId: opts.memberId ?? null,
      sourceType: opts.sourceType ?? 'GENERIC_WEBHOOK',
      externalId: opts.externalId ?? `ext_${counter}`,
      status: opts.status ?? 'ACTIVE',
      matchStatus: opts.matchStatus ?? (opts.memberId ? 'MATCHED' : 'UNMATCHED'),
      matchConfidence: opts.matchConfidence ?? (opts.memberId ? 1 : null),
      matchMethod: opts.matchMethod ?? (opts.memberId ? 'email_exact' : null),
      body: opts.body ?? `External signal body ${counter}`,
      summary: opts.summary ?? null,
      rating: opts.rating ?? null,
      sentiment: opts.sentiment ?? null,
      confidence: opts.confidence ?? null,
      topics: opts.topics ?? [],
      canonicalUrl: opts.canonicalUrl ?? null,
      externalAuthorHandle: opts.externalAuthorHandle ?? null,
      externalAuthorLabel: opts.externalAuthorLabel ?? null,
      subjectType: opts.subjectType ?? null,
      subjectKey: opts.subjectKey ?? null,
      subjectLabel: opts.subjectLabel ?? null,
      providerStatus: opts.providerStatus ?? null,
      statusHistory: [],
      providerMetadata:
        opts.providerMetadata == null
          ? Prisma.JsonNull
          : (opts.providerMetadata as Prisma.InputJsonValue),
      rawPayload: (opts.rawPayload ?? { sourceId: opts.sourceId, counter }) as Prisma.InputJsonValue,
      postedAt: opts.postedAt ?? new Date(),
    },
  })
}
