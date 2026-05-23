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
  /** Custom-List only: total entries the parser produced from the input body
   * (matched + unmatched). Lets the UI surface "Parsed N entries from your
   * input" so silent body-size truncations (browser/clipboard quirks) are
   * visible against the operator's expected count. Omitted for Existing
   * Members where the concept doesn't apply. */
  parsedRowCount: z.number().int().nonnegative().optional(),
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

// ─── Issue #420: Send via CustomerEQ (MANAGED_EMAIL) extensions ────────────────

/**
 * sendMode mirrors the Prisma enum; the API accepts both modes on the
 * POST /distribution-batches endpoint with composer required when MANAGED_EMAIL.
 */
export const SurveySendModeSchema = z.enum(['SELF_SERVE', 'MANAGED_EMAIL'])
export type SurveySendMode = z.infer<typeof SurveySendModeSchema>

/**
 * Composer body for MANAGED_EMAIL. The body field MUST contain the literal
 * `{{survey_link}}` mustache token; the worker fails the dispatch with a
 * validation error otherwise.
 */
export const ManagedEmailComposerSchema = z.object({
  senderName: z.string().min(1).max(50),
  // Local part of the sender email (`{senderAlias}@{senderDomain}`). Per R24 the
  // operator can customize this; the domain is resolved by the API per R25.
  senderAlias: z.string().regex(/^[a-z0-9._-]+$/, 'alias must be lowercase alphanumeric + dot/underscore/dash'),
  subject: z.string().min(1).max(200),
  body: z
    .string()
    .min(1)
    .refine((s) => /\{\{\s*survey_link\s*\}\}/.test(s), {
      message: 'body must contain {{survey_link}} so the per-recipient URL can be rendered',
    }),
}).strict()

export type ManagedEmailComposer = z.infer<typeof ManagedEmailComposerSchema>

/**
 * Extended Generate request — discriminator on sendMode.
 * - SELF_SERVE (default; preserves #378 contract): no composer, optional format
 * - MANAGED_EMAIL: composer required, format absent
 */
export const GenerateBatchRequestV2Schema = z.discriminatedUnion('sendMode', [
  z.object({
    sendMode: z.literal('SELF_SERVE'),
    surveyNameInMail: z.string().min(1).max(80),
    expiresAt: z.string().datetime(),
    audience: AudienceSpecSchema,
    format: DistributionFormatSchema.optional(),
  }).strict(),
  z.object({
    sendMode: z.literal('MANAGED_EMAIL'),
    surveyNameInMail: z.string().min(1).max(80),
    expiresAt: z.string().datetime(),
    audience: AudienceSpecSchema,
    composer: ManagedEmailComposerSchema,
  }).strict(),
])

export type GenerateBatchRequestV2 = z.infer<typeof GenerateBatchRequestV2Schema>

/**
 * mark-csv-downloaded — idempotent.
 */
export const MarkCsvDownloadedResponseSchema = z.object({
  batchId: z.string(),
  sentAt: z.string().datetime(),
  sentCountDelta: z.number().int().nonnegative(),
  surveySentCount: z.number().int().nonnegative(),
})

export type MarkCsvDownloadedResponse = z.infer<typeof MarkCsvDownloadedResponseSchema>

/**
 * send-progress — polled by ManagedEmailProgress.tsx during the Sending state.
 */
const SendProgressRecipientStatus = z.enum(['queued', 'sending', 'sent', 'failed'])

const SendProgressRecipient = z.object({
  memberId: z.string(),
  identifier: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  status: SendProgressRecipientStatus,
  deliveredAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),
})

export const SendProgressResponseSchema = z.object({
  batchId: z.string(),
  recipientCount: z.number().int().nonnegative(),
  queuedCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  isComplete: z.boolean(),
  recipients: z.array(SendProgressRecipient),
})

export type SendProgressResponse = z.infer<typeof SendProgressResponseSchema>

/**
 * retry-failed — re-enqueue rows whose failureReason is retryable
 * (bounce / transient_error_after_retries). Excludes skipped_* (suppression-driven).
 */
export const RetryFailedResponseSchema = z.object({
  batchId: z.string(),
  retriedCount: z.number().int().nonnegative(),
})

export type RetryFailedResponse = z.infer<typeof RetryFailedResponseSchema>

/**
 * Unsubscribe public endpoints — GET /u/:token returns a uniform render-state
 * shape (similar to TokenStatusResponse), and POST /u/:token/confirm is idempotent.
 */
export const UnsubscribeStateSchema = z.enum(['valid', 'already-confirmed', 'invalid'])
export type UnsubscribeState = z.infer<typeof UnsubscribeStateSchema>

export const UnsubscribeTokenViewResponseSchema = z.object({
  state: UnsubscribeStateSchema,
  brandName: z.string().optional(), // present when state=valid or already-confirmed
}).strict()

export type UnsubscribeTokenViewResponse = z.infer<typeof UnsubscribeTokenViewResponseSchema>

export const UnsubscribeConfirmResponseSchema = z.object({
  state: z.enum(['confirmed', 'already-confirmed']),
}).strict()

export type UnsubscribeConfirmResponse = z.infer<typeof UnsubscribeConfirmResponseSchema>
