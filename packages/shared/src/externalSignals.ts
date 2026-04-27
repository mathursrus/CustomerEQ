export const EXTERNAL_SOURCE_TYPES = [
  'GOOGLE_BUSINESS_PROFILE',
  'LINKEDIN_ORG',
  'REDDIT',
  'X',
  'GENERIC_WEBHOOK',
  'GENERIC_API',
] as const

export const EXTERNAL_SYNC_MODES = ['WEBHOOK', 'POLL', 'MANUAL'] as const
export const EXTERNAL_SIGNAL_STATUSES = ['ACTIVE', 'HIDDEN', 'DELETED'] as const
export const EXTERNAL_MATCH_STATUSES = ['UNMATCHED', 'CANDIDATE', 'MATCHED', 'REJECTED'] as const

export type ExternalSourceType = (typeof EXTERNAL_SOURCE_TYPES)[number]
export type ExternalSyncMode = (typeof EXTERNAL_SYNC_MODES)[number]
export type ExternalSignalStatus = (typeof EXTERNAL_SIGNAL_STATUSES)[number]
export type ExternalMatchStatus = (typeof EXTERNAL_MATCH_STATUSES)[number]

export interface ExternalSignalCandidate {
  externalId: string
  body: string
  summary: string | null
  rating: number | null
  sentiment: number | null
  confidence: number | null
  topics: string[]
  canonicalUrl: string | null
  externalAuthorHandle: string | null
  externalAuthorLabel: string | null
  subjectType: string | null
  subjectKey: string | null
  subjectLabel: string | null
  providerStatus: string | null
  providerMetadata: Record<string, unknown> | null
  postedAt: string | null
  memberEmail: string | null
  rawPayload: Record<string, unknown>
}

export function extractExternalSignalDeliveries(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) {
    return input.map((item) => toRecord(item))
  }

  const record = toRecord(input)
  if (Array.isArray(record.items)) {
    return record.items.map((item) => toRecord(item))
  }
  if (Array.isArray(record.records)) {
    return record.records.map((item) => toRecord(item))
  }
  if (Array.isArray(record.deliveries)) {
    return record.deliveries.map((item) => toRecord(item))
  }
  return [record]
}

export function deriveExternalSignalStatus(providerStatus: string | null): ExternalSignalStatus {
  const normalized = providerStatus?.toLowerCase() ?? ''
  if (normalized.includes('delete')) return 'DELETED'
  if (normalized.includes('hidden')) return 'HIDDEN'
  return 'ACTIVE'
}

function readString(
  value: unknown,
  fallback: string | null = null,
): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }
  return fallback
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => readString(item))
    .filter((item): item is string => Boolean(item))
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function buildFallbackExternalId(record: Record<string, unknown>): string {
  const serialized = JSON.stringify(record)
  let hash = 0
  for (let i = 0; i < serialized.length; i += 1) {
    hash = (hash * 31 + serialized.charCodeAt(i)) >>> 0
  }
  return `sig_${hash.toString(16)}`
}

export function normalizeExternalSignalCandidate(
  raw: unknown,
): ExternalSignalCandidate {
  const record = toRecord(raw)
  const body =
    readString(record.body) ??
    readString(record.text) ??
    readString(record.content) ??
    readString(record.message) ??
    readString(record.reviewText) ??
    readString(record.comment) ??
    ''

  const externalId =
    readString(record.externalId) ??
    readString(record.id) ??
    readString(record.providerId) ??
    readString(record.reviewId) ??
    buildFallbackExternalId(record)

  return {
    externalId,
    body,
    summary:
      readString(record.summary) ??
      readString(record.snippet),
    rating:
      readNumber(record.rating) ??
      readNumber(record.stars) ??
      readNumber(record.score),
    sentiment: readNumber(record.sentiment),
    confidence: readNumber(record.confidence),
    topics: readStringArray(record.topics),
    canonicalUrl:
      readString(record.canonicalUrl) ??
      readString(record.url) ??
      readString(record.link),
    externalAuthorHandle:
      readString(record.externalAuthorHandle) ??
      readString(record.authorHandle) ??
      readString(record.author_username) ??
      readString(record.handle),
    externalAuthorLabel:
      readString(record.externalAuthorLabel) ??
      readString(record.authorLabel) ??
      readString(record.author) ??
      readString(record.displayName),
    subjectType:
      readString(record.subjectType) ??
      readString(record.productType) ??
      readString(record.scopeType),
    subjectKey:
      readString(record.subjectKey) ??
      readString(record.productKey) ??
      readString(record.scopeKey),
    subjectLabel:
      readString(record.subjectLabel) ??
      readString(record.productLabel) ??
      readString(record.locationLabel),
    providerStatus:
      readString(record.providerStatus) ??
      readString(record.status),
    providerMetadata: toRecord(record.providerMetadata),
    postedAt:
      readString(record.postedAt) ??
      readString(record.createdAt) ??
      readString(record.publishedAt),
    memberEmail:
      readString(record.memberEmail) ??
      readString(record.email),
    rawPayload: record,
  }
}
