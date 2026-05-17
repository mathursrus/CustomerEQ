// Issue #378 — Zod schemas for the distribution-batches API surface.
//
// Request shapes for: POST .../preview (idempotent), POST .../ (mint), PATCH
// .../expiry, POST .../regenerate-tokens.
// Response shapes for: preview output, generate output (with one-time
// plaintext URLs), batch list, batch detail (NO plaintext), regenerate output
// (with one-time plaintext), and token-status (uniform body per state).

import { z } from 'zod'

// ─── Common ───────────────────────────────────────────────────────────────────

export const DistributionFormatSchema = z.enum(['generic', 'mailchimp', 'hubspot', 'klaviyo'])
export type DistributionFormat = z.infer<typeof DistributionFormatSchema>

const ExistingMembersAudience = z.object({
  mode: z.literal('existing_members'),
  strategy: z.enum(['percent', 'count']),
  value: z.number().int().positive(),
})

const CustomListAudience = z.object({
  mode: z.literal('custom_list'),
  // Operator's paste body. Server splits + parses per
  // `apps/api/src/utils/distributionListParser.ts`. Cap matches spec R6 ×
  // average row size (200 chars) — server enforces per-row count = 10k.
  identifiers: z.string().max(10_000 * 200),
  autoEnroll: z.boolean().default(true),
})

export const AudienceSpecSchema = z.discriminatedUnion('mode', [
  ExistingMembersAudience,
  CustomListAudience,
])

// ─── Preview / Generate request ───────────────────────────────────────────────

export const PreviewBatchRequestSchema = z.object({
  surveyNameInMail: z.string().min(1).max(80),
  expiresAt: z.string().datetime(),
  audience: AudienceSpecSchema,
}).strict()

export type PreviewBatchRequest = z.infer<typeof PreviewBatchRequestSchema>

// Generate uses the same body shape as Preview — what's persisted is the
// mint side-effect plus the one-time response.
export const GenerateBatchRequestSchema = PreviewBatchRequestSchema

export type GenerateBatchRequest = z.infer<typeof GenerateBatchRequestSchema>

// ─── Preview response (no DB rows) ────────────────────────────────────────────

const PreviewMemberRow = z.object({
  memberId: z.string().nullable(),                    // null for unmatched / auto-enroll-skipped
  identifier: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  lastResponseThisSurvey: z.string().datetime().nullable(),
  lastResponseAnySurvey: z.string().datetime().nullable(),
  willAutoEnroll: z.boolean().optional(),             // Custom List + autoEnroll ON + unknown identifier
})

export const PreviewBatchResponseSchema = z.object({
  audienceCount: z.number().int().nonnegative(),
  willAutoEnrollCount: z.number().int().nonnegative(),
  unmatchedCount: z.number().int().nonnegative(),
  members: z.array(PreviewMemberRow),                 // Existing Members: first-50 cap; Custom List: up to 500
  unmatched: z.array(z.string()),                     // raw identifier strings that didn't resolve
  totalRows: z.number().int().nonnegative(),          // for pagination — total before slicing
})

export type PreviewBatchResponse = z.infer<typeof PreviewBatchResponseSchema>

// ─── Generate response (the one-time plaintext transmission) ──────────────────

const GeneratedTokenRow = z.object({
  memberId: z.string(),
  identifier: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  /** The only field whose value never appears again on any GET endpoint. */
  plaintext: z.string(),
})

export const GenerateBatchResponseSchema = z.object({
  batchId: z.string(),
  label: z.string(),
  expiresAt: z.string().datetime(),
  tokenCount: z.number().int().nonnegative(),
  autoEnrolledMemberIds: z.array(z.string()),
  unmatched: z.array(z.string()),
  tokens: z.array(GeneratedTokenRow),
})

export type GenerateBatchResponse = z.infer<typeof GenerateBatchResponseSchema>

// ─── List batches response ────────────────────────────────────────────────────

const BatchSummary = z.object({
  id: z.string(),
  surveyId: z.string(),
  label: z.string(),
  surveyNameInMail: z.string(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  createdBy: z.string(),
  audienceMode: z.enum(['existing_members', 'custom_list']),
  sentCount: z.number().int().nonnegative(),
  respondedCount: z.number().int().nonnegative(),
  awaitingCount: z.number().int().nonnegative(),
  expiredCount: z.number().int().nonnegative(),
})

export const ListBatchesResponseSchema = z.object({
  data: z.array(BatchSummary),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
})

export type ListBatchesResponse = z.infer<typeof ListBatchesResponseSchema>

// ─── Batch detail response (NO plaintext) ─────────────────────────────────────

// .strict() on every nested row so a leaked `plaintext` (or any other field
// outside the declared shape) fails parse at the source. RFC §Confidence Level
// item 1: this is load-bearing for the contract that plaintext only ever
// appears in Generate / Regenerate response bodies.
const BatchTokenRow = z.object({
  memberId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  identifier: z.string(),
  tokenPrefix: z.string(),
  status: z.enum(['awaiting_response', 'responded', 'expired']),
  respondedAt: z.string().datetime().nullable(),
}).strict()

export const BatchDetailResponseSchema = z.object({
  id: z.string(),
  surveyId: z.string(),
  label: z.string(),
  surveyNameInMail: z.string(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  createdBy: z.string(),
  audienceSpec: z.object({
    mode: z.enum(['existing_members', 'custom_list']),
    description: z.string(),                          // operator-friendly summary, e.g. "Count = 100" or "47 identifiers (4 auto-enrolled)"
    memberCountAtSendTime: z.number().int().nonnegative(),
    memberCountNow: z.number().int().nonnegative(),
  }),
  counters: z.object({
    sentCount: z.number().int().nonnegative(),
    respondedCount: z.number().int().nonnegative(),
    awaitingCount: z.number().int().nonnegative(),
    expiredCount: z.number().int().nonnegative(),
  }),
  tokens: z.object({
    data: z.array(BatchTokenRow),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  }),
}).strict()                                            // strict() rejects any stray `plaintext` field — load-bearing per RFC §Confidence Level item 1

export type BatchDetailResponse = z.infer<typeof BatchDetailResponseSchema>

// ─── Edit Expiry ──────────────────────────────────────────────────────────────

export const EditExpiryRequestSchema = z.object({
  expiresAt: z.string().datetime(),
}).strict()

export type EditExpiryRequest = z.infer<typeof EditExpiryRequestSchema>

export const EditExpiryResponseSchema = z.object({
  batchId: z.string(),
  expiresAt: z.string().datetime(),
  affectedTokenCount: z.number().int().nonnegative(),
})

export type EditExpiryResponse = z.infer<typeof EditExpiryResponseSchema>

// ─── Regenerate tokens ────────────────────────────────────────────────────────

export const RegenerateTokensRequestSchema = z.object({
  format: DistributionFormatSchema,
  /** Server-side proof that the operator accepted the strong-warning modal. */
  confirmAcknowledge: z.literal(true),
}).strict()

export type RegenerateTokensRequest = z.infer<typeof RegenerateTokensRequestSchema>

export const RegenerateTokensResponseSchema = z.object({
  batchId: z.string(),
  regeneratedCount: z.number().int().nonnegative(),
  tokens: z.array(GeneratedTokenRow),                 // SAME shape as Generate — one-time plaintext transmission
})

export type RegenerateTokensResponse = z.infer<typeof RegenerateTokensResponseSchema>

// ─── Token status (uniform body shape per state) ──────────────────────────────

export const TokenStateSchema = z.enum([
  'valid',
  'expired',
  'responded',
  'survey-not-open',
  'invalid',
])

export type TokenState = z.infer<typeof TokenStateSchema>

export const TokenStatusResponseSchema = z.object({
  state: TokenStateSchema,
  // No memberId, no batchId, no surveyTitle — uniform across all states (NFR-S4 / NFR-S5).
}).strict()

export type TokenStatusResponse = z.infer<typeof TokenStatusResponseSchema>
