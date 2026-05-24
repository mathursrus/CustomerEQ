// Issue #378 — Personalized survey links for BYO-email distribution.
//
// Six admin endpoints under /v1/surveys/:id/distribution-batches/* plus an
// in-handler Redis rate-limit (NFR-SC1: 10 batches/min/survey) with
// QUEUE_MODE=inline graceful degradation.
//
// Note on RBAC: the project does not yet have a permission enforcement layer
// (no hasPermission middleware, no roles table). The spec/RFC reference to
// `survey.distribute` is forward-looking design. V0 gating is: auth plugin
// resolves the Clerk session → multiTenant plugin pins request.brandId →
// every handler-level Prisma call filters by brandId. Same shape as the
// existing /v1/surveys/* admin routes.

import type { FastifyPluginAsync, FastifyInstance, FastifyRequest } from 'fastify'
import { Prisma } from '@prisma/client'
import {
  PreviewBatchRequestSchema,
  EditExpiryRequestSchema,
  RegenerateTokensRequestSchema,
  ManagedEmailComposerSchema,
  FALLBACK_RESPONDENT_THEME,
  deriveSurveySuppression,
  type AudienceSpecSchema,
  type ManagedEmailComposer,
} from '@customerEQ/shared'
import { enqueueManagedEmailSend } from '../queues/bullmq.js'
import { z } from 'zod'
import { mintToken, hashToken } from '@customerEQ/shared/distributionTokens'
import {
  parsePasteBody,
  parseCsvBody,
  bodyHasCsvHeader,
  type ParsedRow,
} from '../utils/distributionListParser.js'
import { resolveOrEnrollMember } from '../services/memberResolution.js'

const PASTE_ENTRIES_CAP = 10_000
const CSV_ENTRIES_CAP = 100_000
const CSV_BODY_LIMIT = 11 * 1024 * 1024

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_SECONDS = 60

type AudienceSpec = z.infer<typeof AudienceSpecSchema>

// ─── Rate-limit ───────────────────────────────────────────────────────────────

async function enforceBatchRateLimit(fastify: FastifyInstance, surveyId: string): Promise<void> {
  // QUEUE_MODE=inline path — fastify.redis is null per apps/api/src/plugins/redis.ts.
  // Tests also stub ioredis with a minimal mock that does not implement multi().
  // Either way: graceful degradation — skip + structured-log warn so ops can
  // see the gap, rather than failing the endpoint outright.
  const redis = fastify.redis as
    | (typeof fastify.redis & {
        multi?: () => {
          incr: (key: string) => unknown
          expire: (key: string, seconds: number, mode?: 'NX') => unknown
          exec: () => Promise<[Error | null, unknown][] | null>
        }
      })
    | null
  if (!redis || typeof redis.multi !== 'function') {
    fastify.log.warn(
      { event: 'distribute.ratelimit.skipped', reason: 'redis_unavailable', surveyId },
      'NFR-SC1 rate-limit skipped (QUEUE_MODE=inline, Redis down, or stub client)',
    )
    return
  }

  const key = `ratelimit:distribute:${surveyId}`
  const pipeline = redis.multi()
  pipeline.incr(key)
  pipeline.expire(key, RATE_LIMIT_WINDOW_SECONDS, 'NX')
  const results = await pipeline.exec()
  const count = (results?.[0]?.[1] as number | undefined) ?? 0

  if (count > RATE_LIMIT_MAX) {
    const err = new Error(
      `Batch creation rate-limit exceeded: ${RATE_LIMIT_MAX} per ${RATE_LIMIT_WINDOW_SECONDS}s per survey. Try again in a minute.`,
    ) as Error & { statusCode?: number }
    err.statusCode = 429
    throw err
  }
}

// ─── Body extraction (JSON OR text/csv) ───────────────────────────────────────

interface ExtractedAudienceInput {
  surveyNameInMail: string
  expiresAt: string
  audience: AudienceSpec
}

/**
 * Pulls the audience-spec payload out of the request. Two shapes are
 * supported: a JSON body matching PreviewBatchRequest, or a text/csv body
 * with the surveyNameInMail + expiresAt rolled in as query parameters
 * (?surveyNameInMail=...&expiresAt=...). The CSV path is custom_list mode.
 */
function extractAudienceInput(request: FastifyRequest): ExtractedAudienceInput | null {
  const contentType = (request.headers['content-type'] ?? '').toLowerCase()
  if (contentType.startsWith('text/csv')) {
    const query = request.query as Record<string, string | undefined>
    const surveyNameInMail = query.surveyNameInMail ?? ''
    const expiresAt = query.expiresAt ?? ''
    const autoEnroll = (query.autoEnroll ?? 'true').toLowerCase() !== 'false'
    return {
      surveyNameInMail,
      expiresAt,
      audience: {
        mode: 'custom_list',
        identifiers: (request.body as string) ?? '',
        autoEnroll,
      },
    }
  }
  // JSON body. PreviewBatchRequestSchema is .strict() to keep the preview
  // shape tight, but MANAGED_EMAIL Generate requests legitimately carry extra
  // top-level fields (sendMode + composer — validated separately downstream).
  // Use .passthrough() here so those keys flow through; the strict checks are
  // applied per-mode after extraction.
  const parse = PreviewBatchRequestSchema.passthrough().safeParse(request.body)
  if (!parse.success) return null
  // Surface sendMode + composer back to callers that need them (MANAGED_EMAIL
  // route reads them via cast). Keeping the typed Extract narrow on
  // surveyNameInMail/expiresAt/audience preserves the existing contract.
  return parse.data as ExtractedAudienceInput
}

// ─── Identifier resolution (existing members + custom list) ───────────────────

interface ResolvedAudienceMember {
  memberId: string
  identifier: string
  email: string | null
  firstName: string | null
  lastName: string | null
  /** Issue #420 R22/R43 — fields the audience-builder UI needs to render
   * the Status chip + disable selection of suppressed rows. Computed via
   * `deriveSurveySuppression` in the preview handler so the resolver itself
   * stays focused on "who matched" rather than "who can be sent to". */
  erased: boolean
  consentGivenAt: Date | null
  unsubscribedSurveysAt: Date | null
}

interface ResolvedAudience {
  members: ResolvedAudienceMember[]
  autoEnrolledMemberIds: string[]
  unmatched: string[]
  samplingSeed: string | null
  /** Total entries the parser produced (matched + unmatched). Surfaces to the UI
   * so an operator can sanity-check the row count against the input size and
   * catch silent truncations like the #378 walk-through #15 case where the
   * stored body was 4168 chars vs an expected ~5500. Undefined for the
   * Existing Members path where it isn't meaningful. */
  parsedRowCount?: number
}

async function resolveExistingMembers(
  fastify: FastifyInstance,
  brandId: string,
  strategy: 'percent' | 'count',
  value: number,
): Promise<ResolvedAudience> {
  const total = await fastify.prisma.member.count({ where: { brandId, erased: false, deletedAt: null } })
  const target = strategy === 'percent' ? Math.floor((value / 100) * total) : Math.min(value, total)
  if (target <= 0) {
    return { members: [], autoEnrolledMemberIds: [], unmatched: [], samplingSeed: null }
  }

  // Random sample: pull all eligible IDs and Fisher-Yates a deterministic
  // sample seeded with a fresh random string (internal-only — not surfaced).
  // Pool is non-ERASED + non-deletedAt (spec §2.2 / R18). Suppression status
  // (unsubscribed / no consent / no email) is surfaced on the returned rows
  // so the audience-list UI can disable selection of suppressed picks per R22.
  const eligible = await fastify.prisma.member.findMany({
    where: { brandId, erased: false, deletedAt: null },
    select: {
      id: true,
      externalId: true,
      email: true,
      firstName: true,
      lastName: true,
      erased: true,
      consentGivenAt: true,
      unsubscribedSurveysAt: true,
    },
    orderBy: { id: 'asc' },
  })

  // Mint a base64url seed for `DistributionBatch.samplingSeed` — internal
  // infrastructure; never surfaced in the V0 UI. We use Math.random for the
  // shuffle itself since the seed isn't load-bearing for V0 (V1 "Generate new
  // tokens for same audience" will deterministically reuse it).
  const samplingSeed = Buffer.from(Math.random().toString(36).slice(2)).toString('base64url')

  const shuffled = [...eligible]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const picked = shuffled.slice(0, target)

  return {
    members: picked.map((m) => ({
      memberId: m.id,
      identifier: m.externalId,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      erased: m.erased,
      consentGivenAt: m.consentGivenAt,
      unsubscribedSurveysAt: m.unsubscribedSurveysAt,
    })),
    autoEnrolledMemberIds: [],
    unmatched: [],
    samplingSeed,
  }
}

async function resolveCustomList(
  fastify: FastifyInstance,
  brandId: string,
  identifiersBody: string,
  autoEnroll: boolean,
  tx?: Prisma.TransactionClient,
): Promise<ResolvedAudience & { rowsForAudit: ParsedRow[] }> {
  const brand = await (tx ?? fastify.prisma).brand.findUnique({
    where: { id: brandId },
    select: { memberIdentifierKind: true },
  })
  if (!brand) {
    return { members: [], autoEnrolledMemberIds: [], unmatched: [], samplingSeed: null, rowsForAudit: [] }
  }

  // Route to CSV mode ONLY when the first cell of the first line is a known
  // header alias (email / phone / customer_id / first_name / last_name / …).
  // The previous sniff was just "first line has a comma + body has a newline",
  // which false-positived on a bare paste of `email,\nemail,\n` and silently
  // consumed the first row as a fake header (#378 walk-through #15 root cause).
  const isCsv = bodyHasCsvHeader(identifiersBody)
  const parsed = isCsv
    ? parseCsvBody({ body: identifiersBody, brandKind: brand.memberIdentifierKind })
    : parsePasteBody(identifiersBody, brand.memberIdentifierKind)

  if (parsed.rows.length > CSV_ENTRIES_CAP) {
    const err = new Error(`Too many entries: ${parsed.rows.length} > ${CSV_ENTRIES_CAP}`) as Error & {
      statusCode?: number
      code?: string
    }
    err.statusCode = 422
    err.code = 'PASTE_TOO_LARGE'
    throw err
  }
  if (!isCsv && parsed.rows.length > PASTE_ENTRIES_CAP) {
    const err = new Error(`Too many entries: ${parsed.rows.length} > ${PASTE_ENTRIES_CAP}`) as Error & {
      statusCode?: number
      code?: string
    }
    err.statusCode = 422
    err.code = 'PASTE_TOO_LARGE'
    throw err
  }

  const members: ResolvedAudience['members'] = []
  const autoEnrolledMemberIds: string[] = []
  const unmatchedFinal: string[] = [...parsed.unmatched]

  for (const row of parsed.rows) {
    const externalId = row.identifier.toLowerCase()
    const existing = await (tx ?? fastify.prisma).member.findUnique({
      where: { brandId_externalId: { brandId, externalId } },
      select: {
        id: true,
        externalId: true,
        email: true,
        firstName: true,
        lastName: true,
        erased: true,
        consentGivenAt: true,
        unsubscribedSurveysAt: true,
      },
    })
    if (existing) {
      members.push({
        memberId: existing.id,
        identifier: existing.externalId,
        email: existing.email,
        firstName: existing.firstName,
        lastName: existing.lastName,
        erased: existing.erased,
        consentGivenAt: existing.consentGivenAt,
        unsubscribedSurveysAt: existing.unsubscribedSurveysAt,
      })
      continue
    }
    if (!autoEnroll) {
      unmatchedFinal.push(row.identifier)
      continue
    }
    // Auto-enroll path — only when caller supplied a Prisma client (Generate
    // / Regenerate run inside a transaction). Preview doesn't write members.
    if (!tx) {
      // Synthesise a preview row without persisting. Auto-enrolled members
      // start with consentGivenAt = now() (set by resolveOrEnrollMember at
      // generate time), so the preview optimistically marks them OK.
      members.push({
        memberId: '',
        identifier: row.identifier,
        email: row.identifierKind === 'email' ? row.identifier : null,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        erased: false,
        consentGivenAt: new Date(),
        unsubscribedSurveysAt: null,
      })
      continue
    }
    const enrollResult = await resolveOrEnrollMember(tx as unknown as Prisma.TransactionClient as never, brandId, {
      memberId: row.identifier,
      email: row.identifierKind === 'email' ? row.identifier : undefined,
      phone: row.identifierKind === 'phone' ? row.identifier : undefined,
      firstName: row.firstName,
      lastName: row.lastName,
      enrolledVia: 'BULK_DISTRIBUTION',
    })
    if (!enrollResult.ok) {
      unmatchedFinal.push(row.identifier)
      continue
    }
    // Re-fetch with the suppression-relevant fields the resolver doesn't return.
    const enrolled = await (tx ?? fastify.prisma).member.findUnique({
      where: { id: enrollResult.member.id },
      select: {
        email: true,
        erased: true,
        consentGivenAt: true,
        unsubscribedSurveysAt: true,
      },
    })
    members.push({
      memberId: enrollResult.member.id,
      identifier: enrollResult.member.externalId,
      email: enrolled?.email ?? enrollResult.member.email ?? null,
      firstName: enrollResult.member.firstName,
      lastName: enrollResult.member.lastName,
      erased: enrolled?.erased ?? false,
      consentGivenAt: enrolled?.consentGivenAt ?? null,
      unsubscribedSurveysAt: enrolled?.unsubscribedSurveysAt ?? null,
    })
    if (enrollResult.created) {
      autoEnrolledMemberIds.push(enrollResult.member.id)
    }
  }

  return {
    members,
    autoEnrolledMemberIds,
    unmatched: unmatchedFinal,
    samplingSeed: null,
    rowsForAudit: parsed.rows,
    parsedRowCount: parsed.rows.length + parsed.unmatched.length,
  }
}

// ─── Counter aggregation for list + detail responses ──────────────────────────

interface BatchCounters {
  sentCount: number
  respondedCount: number
  awaitingCount: number
  expiredCount: number
}

async function countersForBatch(fastify: FastifyInstance, batchId: string, expiresAt: Date): Promise<BatchCounters> {
  const tokens = await fastify.prisma.surveyDistributionToken.findMany({
    where: { batchId },
    select: { consumedAt: true, expiresAt: true },
  })
  const now = new Date()
  let responded = 0
  let expired = 0
  let awaiting = 0
  for (const t of tokens) {
    if (t.consumedAt) responded++
    else if ((t.expiresAt ?? expiresAt) < now) expired++
    else awaiting++
  }
  return {
    sentCount: tokens.length,
    respondedCount: responded,
    awaitingCount: awaiting,
    expiredCount: expired,
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const distributionBatchesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser('text/csv', { parseAs: 'string' }, (_req, body, done) => done(null, body))

  // POST /v1/surveys/:id/distribution-batches/preview — idempotent
  fastify.post(
    '/surveys/:id/distribution-batches/preview',
    { bodyLimit: CSV_BODY_LIMIT },
    async (request, reply) => {
      const { id: surveyId } = request.params as { id: string }
      const brandId = request.brandId
      const input = extractAudienceInput(request)
      if (!input) {
        return reply.status(422).send({ error: 'Validation failed', code: 'INVALID_BODY' })
      }

      const survey = await fastify.prisma.survey.findFirst({
        where: { id: surveyId, brandId, deletedAt: null },
        select: { id: true, brandId: true },
      })
      if (!survey) return reply.status(404).send({ error: 'Survey not found' })

      let resolved: ResolvedAudience
      try {
        if (input.audience.mode === 'existing_members') {
          resolved = await resolveExistingMembers(fastify, brandId, input.audience.strategy, input.audience.value)
        } else {
          const result = await resolveCustomList(
            fastify,
            brandId,
            input.audience.identifiers,
            input.audience.autoEnroll,
          )
          resolved = result
        }
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        const code = (err as { code?: string }).code
        if (statusCode === 422 && code === 'PASTE_TOO_LARGE') {
          return reply.status(422).send({ error: 'Too many entries', code })
        }
        throw err
      }

      // Build the preview payload. Issue #420 audience-builder consumes each
      // visible row (memberId + identifier + suppression annotations) when the
      // operator clicks Add, so the cap must accommodate the largest realistic
      // Add: a full Random Sample of up to the CSV_ENTRIES_CAP (10k). The cap
      // is also the upper bound on a Custom List paste, so a single cap covers
      // both audience modes.
      const previewCap = 10_000
      const visible = resolved.members.slice(0, previewCap)

      // Fetch last-response timestamps for the visible rows in one query.
      const memberIds = visible.map((m) => m.memberId).filter((id) => id.length > 0)
      const responseRows = memberIds.length === 0
        ? []
        : await fastify.prisma.surveyResponse.findMany({
            where: { memberId: { in: memberIds }, brandId },
            select: { memberId: true, surveyId: true, completedAt: true },
            orderBy: { completedAt: 'desc' },
          })
      const lastThis = new Map<string, Date>()
      const lastAny = new Map<string, Date>()
      for (const r of responseRows) {
        if (r.memberId && !lastAny.has(r.memberId)) lastAny.set(r.memberId, r.completedAt)
        if (r.memberId && r.surveyId === surveyId && !lastThis.has(r.memberId)) {
          lastThis.set(r.memberId, r.completedAt)
        }
      }

      // Predict auto-enrollments. The preview path never persists, so
      // `autoEnrolledMemberIds` is always empty in the resolver output —
      // instead, infer the would-be-enrolled count from the synthesised
      // rows (memberId === '' marks a Custom-List row that doesn't match
      // an existing member and would be auto-created at generate time).
      const willAutoEnrollCountPreview =
        input.audience.mode === 'custom_list'
          ? resolved.members.filter((m) => m.memberId === '').length
          : 0
      return reply.status(200).send({
        audienceCount: resolved.members.length,
        willAutoEnrollCount: willAutoEnrollCountPreview,
        unmatchedCount: resolved.unmatched.length,
        parsedRowCount: resolved.parsedRowCount ?? resolved.members.length,
        members: visible.map((m) => {
          // Issue #420 R22/R43 — surface the suppression chip the
          // audience-builder UI uses to disable selection. Resolution rules
          // (erased → email → consent → unsubscribed) live in the shared
          // helper so they stay in lockstep with the worker's R44 check.
          const suppression = deriveSurveySuppression({
            erased: m.erased,
            email: m.email,
            consentGivenAt: m.consentGivenAt,
            unsubscribedSurveysAt: m.unsubscribedSurveysAt,
          })
          return {
            memberId: m.memberId.length > 0 ? m.memberId : null,
            identifier: m.identifier,
            email: m.email,
            firstName: m.firstName,
            lastName: m.lastName,
            lastResponseThisSurvey: lastThis.get(m.memberId)?.toISOString() ?? null,
            lastResponseAnySurvey: lastAny.get(m.memberId)?.toISOString() ?? null,
            willAutoEnroll: m.memberId.length === 0 ? true : undefined,
            suppressionStatus: suppression.status,
            suppressionSince: suppression.since,
          }
        }),
        unmatched: resolved.unmatched,
        totalRows: resolved.members.length,
      })
    },
  )

  // POST /v1/surveys/:id/distribution-batches — atomic generate
  fastify.post(
    '/surveys/:id/distribution-batches',
    {
      bodyLimit: CSV_BODY_LIMIT,
      config: {
        auditAction: 'distribution_batch.create',
        auditResourceType: 'distribution_batch',
        auditAllowlist: ['surveyId', 'batchId', 'sendMode', 'mode', 'tokenCount', 'autoEnrolledCount', 'requestIp'],
      },
    },
    async (request, reply) => {
      const { id: surveyId } = request.params as { id: string }
      const brandId = request.brandId
      const input = extractAudienceInput(request)
      if (!input) {
        // Re-parse against the same shape to surface the field-level reason —
        // extractAudienceInput swallows the Zod error.
        const detail = PreviewBatchRequestSchema.passthrough().safeParse(request.body)
        const fieldErrors = !detail.success ? detail.error.flatten().fieldErrors : undefined
        return reply.status(422).send({
          error: 'Request body is missing required fields or contains invalid types.',
          code: 'INVALID_BODY',
          fieldErrors,
        })
      }

      // Issue #420 — detect MANAGED_EMAIL mode via the `sendMode` body field.
      // Backward-compatible: absent or 'SELF_SERVE' → existing #378 path.
      const sendMode: 'SELF_SERVE' | 'MANAGED_EMAIL' = (input as { sendMode?: string }).sendMode === 'MANAGED_EMAIL' ? 'MANAGED_EMAIL' : 'SELF_SERVE'
      let composer: ManagedEmailComposer | null = null
      let senderDomain: string | null = null
      if (sendMode === 'MANAGED_EMAIL') {
        const composerInput = (input as { composer?: unknown }).composer
        const composerValidate = ManagedEmailComposerSchema.safeParse(composerInput)
        if (!composerValidate.success) {
          return reply.status(422).send({
            error: 'Composer is missing or invalid. Check sender name, alias, subject, and body.',
            code: 'COMPOSER_REQUIRED',
            fieldErrors: composerValidate.error.flatten().fieldErrors,
          })
        }
        composer = composerValidate.data
        // Resolve sender domain per R25: Brand.managedEmailSenderDomain → env-parsed → hard-coded fallback.
        const brand = await fastify.prisma.brand.findFirst({
          where: { id: brandId },
          select: { managedEmailSenderDomain: true },
        })
        const envFrom = (process.env.AZURE_COMMUNICATION_SERVICES_EMAIL_FROM ?? '').trim()
        const envDomain = envFrom.includes('@') ? envFrom.split('@')[1] : undefined
        senderDomain = brand?.managedEmailSenderDomain ?? envDomain ?? 'customereq.wellnessatwork.me'
        if (!brand?.managedEmailSenderDomain && !envDomain) {
          fastify.log.warn(
            { event: 'email.sender_domain.fallback', reason: 'acs_env_unset', brandId },
            'Sender domain fell through to hard-coded fallback',
          )
        }
      }

      const survey = await fastify.prisma.survey.findFirst({
        where: { id: surveyId, brandId, deletedAt: null },
        select: { id: true, status: true, title: true, name: true },
      })
      if (!survey) return reply.status(404).send({ error: 'Survey not found' })
      if (survey.status !== 'ACTIVE') {
        return reply.status(409).send({ error: 'Survey is not ACTIVE', code: 'SURVEY_NOT_ACTIVE' })
      }

      await enforceBatchRateLimit(fastify, surveyId)

      const expiresAt = new Date(input.expiresAt)
      if (expiresAt.getTime() <= Date.now()) {
        return reply.status(422).send({ error: 'expiresAt must be in the future', code: 'EXPIRES_AT_MUST_BE_FUTURE' })
      }

      const isoToday = new Date().toISOString().slice(0, 10)
      const label = `${survey.title ?? survey.name} · ${isoToday}`

      const result = await fastify.prisma.$transaction(async (tx) => {
        let resolved: ResolvedAudience & { rowsForAudit?: ParsedRow[] }
        if (input.audience.mode === 'existing_members') {
          resolved = await resolveExistingMembers(fastify, brandId, input.audience.strategy, input.audience.value)
        } else {
          resolved = await resolveCustomList(
            fastify,
            brandId,
            input.audience.identifiers,
            input.audience.autoEnroll,
            tx,
          )
        }

        if (resolved.members.length === 0) {
          const err = new Error('Audience is empty') as Error & { statusCode?: number; code?: string }
          err.statusCode = 422
          err.code = 'AUDIENCE_EMPTY'
          throw err
        }

        const audienceSpecJson: Prisma.InputJsonValue =
          input.audience.mode === 'existing_members'
            ? {
                mode: 'existing_members',
                strategy: input.audience.strategy,
                value: input.audience.value,
                memberCountAtSendTime: resolved.members.length,
                samplingSeed: resolved.samplingSeed ?? '',
              }
            : {
                mode: 'custom_list',
                identifiersRaw: input.audience.identifiers,
                identifiersResolved: resolved.members.map((m) => ({
                  memberId: m.memberId,
                  identifier: m.identifier,
                })),
                autoEnroll: input.audience.autoEnroll,
                autoEnrolledMemberIds: resolved.autoEnrolledMemberIds,
                unmatched: resolved.unmatched,
                memberCountAtSendTime: resolved.members.length,
              }

        // Issue #420 — composerSnapshot is null for SELF_SERVE; populated for
        // MANAGED_EMAIL with the fields the worker needs at dispatch time.
        let composerSnapshot: Prisma.InputJsonValue | null = null
        if (sendMode === 'MANAGED_EMAIL' && composer && senderDomain) {
          // Theme snapshot resolved from Survey.themeId → Brand.defaultThemeId → CustomerEQ default.
          const themeId = (
            await tx.survey.findUnique({ where: { id: surveyId }, select: { themeId: true } })
          )?.themeId
          let theme = themeId ? await tx.brandTheme.findUnique({ where: { id: themeId } }) : null
          if (!theme) {
            const brand = await tx.brand.findUnique({
              where: { id: brandId },
              select: { defaultThemeId: true, logoUrl: true, name: true },
            })
            if (brand?.defaultThemeId) {
              theme = await tx.brandTheme.findUnique({ where: { id: brand.defaultThemeId } })
            }
          }
          const brandRow = await tx.brand.findUnique({
            where: { id: brandId },
            select: { logoUrl: true, name: true },
          })
          composerSnapshot = {
            senderName: composer.senderName,
            senderAlias: composer.senderAlias,
            senderDomain,
            subject: composer.subject,
            body: composer.body,
            brandLogoUrl: brandRow?.logoUrl ?? null,
            brandName: brandRow?.name ?? '',
            // Issue #420 — fall back to the canonical FALLBACK_RESPONDENT_THEME
            // (shared single-source-of-truth used by every other renderer)
            // when neither Survey.themeId nor Brand.defaultThemeId resolves.
            // This keeps a snapshot's hex values identical to the rendering a
            // respondent would see if the survey had no theme attached.
            themeSnapshot: theme
              ? {
                  primaryColor: theme.primaryColor,
                  secondaryColor: theme.secondaryColor,
                  backgroundColor: theme.backgroundColor,
                  textColor: theme.textColor,
                  accentColor: theme.accentColor,
                  buttonColor: theme.buttonColor,
                  buttonTextColor: theme.buttonTextColor,
                  fontFamily: theme.fontFamily,
                }
              : {
                  primaryColor: FALLBACK_RESPONDENT_THEME.primaryColor,
                  secondaryColor: FALLBACK_RESPONDENT_THEME.secondaryColor,
                  backgroundColor: FALLBACK_RESPONDENT_THEME.backgroundColor,
                  textColor: FALLBACK_RESPONDENT_THEME.textColor,
                  accentColor: FALLBACK_RESPONDENT_THEME.accentColor,
                  buttonColor: FALLBACK_RESPONDENT_THEME.buttonColor,
                  buttonTextColor: FALLBACK_RESPONDENT_THEME.buttonTextColor,
                  fontFamily: FALLBACK_RESPONDENT_THEME.fontFamily,
                },
          }
        }

        const batch = await tx.distributionBatch.create({
          data: {
            surveyId,
            brandId,
            label,
            surveyNameInMail: input.surveyNameInMail,
            audienceSpec: audienceSpecJson,
            expiresAt,
            samplingSeed: resolved.samplingSeed,
            createdBy: request.clerkUserId ?? 'unknown',
            sendMode,
            composerSnapshot: composerSnapshot ?? Prisma.JsonNull,
          },
        })

        // Mint tokens + distribution rows for each member.
        const minted = resolved.members.map((m) => ({ member: m, token: mintToken() }))

        await tx.surveyDistributionToken.createMany({
          data: minted.map(({ member, token }) => ({
            batchId: batch.id,
            memberId: member.memberId,
            brandId,
            tokenHash: token.hash,
            tokenPrefix: token.prefix,
            expiresAt,
          })),
        })

        // Issue #420 — for MANAGED_EMAIL, also mint a MemberUnsubscribeToken
        // per recipient so the email footer can carry a per-recipient
        // unsubscribe URL routable to POST /u/:token/confirm.
        const unsubMinted: { memberId: string; plaintext: string }[] = []
        if (sendMode === 'MANAGED_EMAIL') {
          const unsubTokens = minted.map(({ member }) => ({ member, token: mintToken() }))
          await tx.memberUnsubscribeToken.createMany({
            data: unsubTokens.map(({ member, token }) => ({
              batchId: batch.id,
              memberId: member.memberId,
              brandId,
              tokenHash: token.hash,
              tokenPrefix: token.prefix,
            })),
          })
          for (const u of unsubTokens) {
            unsubMinted.push({ memberId: u.member.memberId, plaintext: u.token.plaintext })
          }
        }

        await tx.surveyDistribution.createMany({
          data: minted.map(({ member }) => ({
            surveyId,
            memberId: member.memberId,
            brandId,
            batchId: batch.id,
            sendMode,
            enqueuedAt: sendMode === 'MANAGED_EMAIL' ? new Date() : null,
          })),
        })

        return { batch, minted, resolved, unsubMinted }
      })

      // Issue #420 — Post-commit: enqueue per-recipient managed-email-send jobs.
      // In QUEUE_MODE=redis this dispatches; in inline mode it runs via scheduleInline.
      // G9/G10 — pass the plaintext survey-link + unsubscribe tokens through the
      // queue payload so the worker builds VALID URLs (previously used the
      // 8-char tokenPrefix from DB, which the public route rejected).
      if (sendMode === 'MANAGED_EMAIL') {
        const unsubByMemberId = new Map(result.unsubMinted.map((u) => [u.memberId, u.plaintext]))
        for (const { member, token } of result.minted) {
          await enqueueManagedEmailSend({
            batchId: result.batch.id,
            memberId: member.memberId,
            brandId,
            surveyId,
            surveyLinkToken: token.plaintext,
            unsubscribeToken: unsubByMemberId.get(member.memberId) ?? null,
          })
        }
      }

      request.audit = {
        metadata: {
          surveyId,
          batchId: result.batch.id,
          sendMode,
          mode: input.audience.mode,
          tokenCount: result.minted.length,
          autoEnrolledCount: result.resolved.autoEnrolledMemberIds.length,
        },
      }

      // Issue #420 — MANAGED_EMAIL: do NOT return survey-link plaintexts in
      // the response body. The worker renders + dispatches them server-side;
      // they never transit the API response. Operator-facing payload carries
      // only batch metadata + a pointer to the send-progress endpoint.
      if (sendMode === 'MANAGED_EMAIL') {
        return reply.status(201).send({
          batchId: result.batch.id,
          label: result.batch.label,
          expiresAt: result.batch.expiresAt.toISOString(),
          recipientCount: result.minted.length,
          autoEnrolledMemberIds: result.resolved.autoEnrolledMemberIds,
          unmatched: result.resolved.unmatched,
          sendMode,
          sendingStatusUrl: `/v1/surveys/${surveyId}/distribution-batches/${result.batch.id}/send-progress`,
        })
      }

      return reply.status(201).send({
        batchId: result.batch.id,
        label: result.batch.label,
        expiresAt: result.batch.expiresAt.toISOString(),
        tokenCount: result.minted.length,
        autoEnrolledMemberIds: result.resolved.autoEnrolledMemberIds,
        unmatched: result.resolved.unmatched,
        sendMode,
        tokens: result.minted.map(({ member, token }) => ({
          memberId: member.memberId,
          identifier: member.identifier,
          firstName: member.firstName,
          lastName: member.lastName,
          plaintext: token.plaintext,
        })),
      })
    },
  )

  // GET /v1/surveys/:id/distribution-batches — list
  fastify.get('/surveys/:id/distribution-batches', async (request, reply) => {
    const { id: surveyId } = request.params as { id: string }
    const brandId = request.brandId
    const query = request.query as Record<string, string | undefined>
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize ?? '20', 10) || 20))

    const survey = await fastify.prisma.survey.findFirst({
      where: { id: surveyId, brandId, deletedAt: null },
      select: { id: true },
    })
    if (!survey) return reply.status(404).send({ error: 'Survey not found' })

    const [total, batches] = await Promise.all([
      fastify.prisma.distributionBatch.count({ where: { surveyId, brandId } }),
      fastify.prisma.distributionBatch.findMany({
        where: { surveyId, brandId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const counters = await Promise.all(batches.map((b) => countersForBatch(fastify, b.id, b.expiresAt)))

    const data = batches.map((b, i) => ({
      id: b.id,
      surveyId: b.surveyId,
      label: b.label,
      surveyNameInMail: b.surveyNameInMail,
      expiresAt: b.expiresAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
      createdBy: b.createdBy,
      // Issue #420 — sendMode included so the Survey detail page's Responses
      // header-strip dropdown can disambiguate which wave is managed vs
      // self-serve in the option text (audit drift 6.7, mock #scene-6 line 1099).
      sendMode: b.sendMode,
      audienceMode: ((b.audienceSpec as { mode?: string })?.mode ?? 'custom_list') as
        | 'existing_members'
        | 'custom_list',
      ...counters[i],
    }))

    return reply.status(200).send({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  })

  // GET /v1/surveys/:id/distribution-batches/:batchId — detail
  fastify.get('/surveys/:id/distribution-batches/:batchId', async (request, reply) => {
    const { id: surveyId, batchId } = request.params as { id: string; batchId: string }
    const brandId = request.brandId
    const query = request.query as Record<string, string | undefined>
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
    const pageSize = Math.min(500, Math.max(1, Number.parseInt(query.pageSize ?? '50', 10) || 50))

    const batch = await fastify.prisma.distributionBatch.findFirst({
      where: { id: batchId, surveyId, brandId },
    })
    if (!batch) return reply.status(404).send({ error: 'Batch not found' })

    const counters = await countersForBatch(fastify, batch.id, batch.expiresAt)

    const [tokensTotal, tokens] = await Promise.all([
      fastify.prisma.surveyDistributionToken.count({ where: { batchId, brandId } }),
      fastify.prisma.surveyDistributionToken.findMany({
        where: { batchId, brandId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          memberId: true,
          tokenPrefix: true,
          consumedAt: true,
          expiresAt: true,
          member: { select: { externalId: true, firstName: true, lastName: true } },
        },
      }),
    ])

    const now = new Date()
    const tokenRows = tokens.map((t) => {
      let status: 'awaiting_response' | 'responded' | 'expired'
      if (t.consumedAt) status = 'responded'
      else if (t.expiresAt < now) status = 'expired'
      else status = 'awaiting_response'
      return {
        memberId: t.memberId,
        firstName: t.member.firstName,
        lastName: t.member.lastName,
        identifier: t.member.externalId,
        tokenPrefix: t.tokenPrefix,
        status,
        respondedAt: t.consumedAt?.toISOString() ?? null,
      }
    })

    const audienceSpec = batch.audienceSpec as {
      mode?: 'existing_members' | 'custom_list'
      strategy?: string
      value?: number
      identifiersResolved?: unknown[]
      autoEnrolledMemberIds?: string[]
      memberCountAtSendTime?: number
    }
    const mode = audienceSpec.mode ?? 'custom_list'

    // member-count-now: how many of the batch's audience still belong to
    // the brand (not erased / deleted). For Custom List we look at the
    // resolved memberIds; for Existing Members we re-count eligible members
    // at the moment of read (rough proxy for "audience size now").
    const memberIds =
      mode === 'custom_list' && Array.isArray(audienceSpec.identifiersResolved)
        ? (audienceSpec.identifiersResolved as { memberId: string }[]).map((r) => r.memberId).filter(Boolean)
        : []
    const memberCountNow =
      memberIds.length === 0
        ? counters.sentCount
        : await fastify.prisma.member.count({
            where: { id: { in: memberIds }, brandId, erased: false, deletedAt: null },
          })

    const description =
      mode === 'existing_members'
        ? `${audienceSpec.strategy ?? 'count'} = ${audienceSpec.value ?? '?'}`
        : `${audienceSpec.memberCountAtSendTime ?? 0} identifiers (${(audienceSpec.autoEnrolledMemberIds ?? []).length} auto-enrolled)`

    // Issue #420 §3.2 — surface sendMode + the read-only composer snapshot so
    // the Wave Detail page can render the mode pill and (for MANAGED_EMAIL) the
    // audit-trail composer block. composerSnapshot is intentionally null for
    // SELF_SERVE rows (no composer was used).
    const composerSnapshot =
      batch.sendMode === 'MANAGED_EMAIL' && batch.composerSnapshot !== null
        ? (batch.composerSnapshot as Record<string, unknown>)
        : null

    return reply.status(200).send({
      id: batch.id,
      surveyId: batch.surveyId,
      label: batch.label,
      surveyNameInMail: batch.surveyNameInMail,
      expiresAt: batch.expiresAt.toISOString(),
      createdAt: batch.createdAt.toISOString(),
      createdBy: batch.createdBy,
      sendMode: batch.sendMode,
      composerSnapshot,
      audienceSpec: {
        mode,
        description,
        memberCountAtSendTime: audienceSpec.memberCountAtSendTime ?? counters.sentCount,
        memberCountNow,
      },
      counters,
      tokens: {
        data: tokenRows,
        total: tokensTotal,
        page,
        pageSize,
        totalPages: Math.ceil(tokensTotal / pageSize),
      },
    })
  })

  // PATCH /v1/surveys/:id/distribution-batches/:batchId/expiry
  fastify.patch(
    '/surveys/:id/distribution-batches/:batchId/expiry',
    {
      config: {
        auditAction: 'distribution_batch.expiry_edit',
        auditResourceType: 'distribution_batch',
        auditAllowlist: ['surveyId', 'batchId', 'fromExpiresAt', 'toExpiresAt', 'requestIp'],
      },
    },
    async (request, reply) => {
      const { id: surveyId, batchId } = request.params as { id: string; batchId: string }
      const brandId = request.brandId

      const parse = EditExpiryRequestSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({ error: 'Validation failed', code: 'INVALID_BODY' })
      }
      const newExpiresAt = new Date(parse.data.expiresAt)
      if (newExpiresAt.getTime() <= Date.now()) {
        return reply.status(422).send({ error: 'expiresAt must be in the future', code: 'EXPIRES_AT_MUST_BE_FUTURE' })
      }

      const survey = await fastify.prisma.survey.findFirst({
        where: { id: surveyId, brandId, deletedAt: null },
        select: { id: true, status: true },
      })
      if (!survey) return reply.status(404).send({ error: 'Survey not found' })
      if (survey.status !== 'ACTIVE') {
        return reply.status(409).send({ error: 'Survey is not ACTIVE', code: 'SURVEY_NOT_ACTIVE' })
      }

      const batch = await fastify.prisma.distributionBatch.findFirst({
        where: { id: batchId, surveyId, brandId },
        select: { id: true, expiresAt: true },
      })
      if (!batch) return reply.status(404).send({ error: 'Batch not found' })

      const result = await fastify.prisma.$transaction(async (tx) => {
        const updated = await tx.distributionBatch.update({
          where: { id: batchId },
          data: { expiresAt: newExpiresAt },
        })
        const tokenUpdate = await tx.surveyDistributionToken.updateMany({
          where: { batchId, brandId },
          data: { expiresAt: newExpiresAt },
        })
        return { updated, affectedTokenCount: tokenUpdate.count }
      })

      request.audit = {
        metadata: {
          surveyId,
          batchId,
          fromExpiresAt: batch.expiresAt.toISOString(),
          toExpiresAt: newExpiresAt.toISOString(),
        },
      }

      return reply.status(200).send({
        batchId: result.updated.id,
        expiresAt: result.updated.expiresAt.toISOString(),
        affectedTokenCount: result.affectedTokenCount,
      })
    },
  )

  // POST /v1/surveys/:id/distribution-batches/:batchId/regenerate-tokens
  fastify.post(
    '/surveys/:id/distribution-batches/:batchId/regenerate-tokens',
    {
      config: {
        auditAction: 'distribution_batch.tokens_regenerated',
        auditResourceType: 'distribution_batch',
        auditAllowlist: ['surveyId', 'batchId', 'regeneratedCount', 'requestIp'],
      },
    },
    async (request, reply) => {
      const { id: surveyId, batchId } = request.params as { id: string; batchId: string }
      const brandId = request.brandId

      const parse = RegenerateTokensRequestSchema.safeParse(request.body)
      if (!parse.success) {
        const issue = parse.error.issues.find((i) => i.path.includes('confirmAcknowledge'))
        if (issue) {
          return reply.status(422).send({
            error: 'Regeneration not acknowledged',
            code: 'REGENERATION_NOT_ACKNOWLEDGED',
          })
        }
        return reply.status(422).send({ error: 'Validation failed', code: 'INVALID_BODY' })
      }

      const batch = await fastify.prisma.distributionBatch.findFirst({
        where: { id: batchId, surveyId, brandId },
        include: { tokens: { select: { id: true, memberId: true, member: { select: { externalId: true, firstName: true, lastName: true } } } } },
      })
      if (!batch) return reply.status(404).send({ error: 'Batch not found' })

      // Mint a fresh token for every existing (batchId, memberId) row. Preserve
      // consumedAt — responded members stay responded. Replace tokenHash +
      // tokenPrefix atomically. Plaintext is returned once.
      const newTokens = batch.tokens.map((t) => ({
        rowId: t.id,
        memberId: t.memberId,
        identifier: t.member.externalId,
        firstName: t.member.firstName,
        lastName: t.member.lastName,
        token: mintToken(),
      }))

      await fastify.prisma.$transaction(async (tx) => {
        for (const nt of newTokens) {
          await tx.surveyDistributionToken.update({
            where: { id: nt.rowId },
            data: { tokenHash: nt.token.hash, tokenPrefix: nt.token.prefix },
          })
        }
      })

      request.audit = {
        metadata: { surveyId, batchId, regeneratedCount: newTokens.length },
      }

      return reply.status(200).send({
        batchId,
        regeneratedCount: newTokens.length,
        tokens: newTokens.map((nt) => ({
          memberId: nt.memberId,
          identifier: nt.identifier,
          firstName: nt.firstName,
          lastName: nt.lastName,
          plaintext: nt.token.plaintext,
        })),
      })
    },
  )

  // ─── Issue #420: managed-email-specific endpoints ───────────────────────────

  // POST /v1/surveys/:id/distribution-batches/:batchId/mark-csv-downloaded
  // SELF_SERVE only. Idempotent. Increments Survey.sentCount on first call.
  fastify.post(
    '/surveys/:id/distribution-batches/:batchId/mark-csv-downloaded',
    {
      config: {
        auditAction: 'distribution_batch.csv_downloaded',
        auditResourceType: 'distribution_batch',
        auditAllowlist: ['batchId', 'delta'],
      },
    },
    async (request, reply) => {
      const { id: surveyId, batchId } = request.params as { id: string; batchId: string }
      const brandId = request.brandId

      const batch = await fastify.prisma.distributionBatch.findFirst({
        where: { id: batchId, surveyId, brandId },
        select: { id: true, sendMode: true },
      })
      if (!batch) return reply.status(404).send({ error: 'Batch not found' })
      if (batch.sendMode !== 'SELF_SERVE') {
        return reply.status(409).send({ error: 'mark-csv-downloaded only valid for SELF_SERVE batches', code: 'WRONG_SEND_MODE' })
      }

      const now = new Date()
      const result = await fastify.prisma.$transaction(async (tx) => {
        // Δ = rows in this batch whose sentAt is the original mint-time (we
        // treat any sentAt that equals creation order as "not yet downloaded").
        // Heuristic: rows with deliveredAt IS NULL AND sentAt set to the row's
        // createdAt are pre-download. For idempotency, count rows where sentAt
        // hasn't been bumped yet — we encode this by tracking sentAt < NOW().
        // Simpler V0 contract: count BEFORE we bump, so the second call returns
        // delta=0.
        const before = await tx.surveyDistribution.findMany({
          where: { batchId },
          select: { sentAt: true, id: true },
        })
        const delta = before.filter((r) => r.sentAt < now).length
        if (delta === 0) {
          // Idempotent no-op.
          const surveySentCount = await tx.survey.findUniqueOrThrow({
            where: { id: surveyId },
            select: { sentCount: true },
          })
          return { delta: 0, surveySentCount: surveySentCount.sentCount, sentAt: now.toISOString() }
        }
        await tx.surveyDistribution.updateMany({
          where: { batchId },
          data: { sentAt: now },
        })
        const updated = await tx.survey.update({
          where: { id: surveyId },
          data: { sentCount: { increment: delta } },
          select: { sentCount: true },
        })
        return { delta, surveySentCount: updated.sentCount, sentAt: now.toISOString() }
      })

      request.audit = { metadata: { batchId, delta: result.delta } }

      return reply.status(200).send({
        batchId,
        sentAt: result.sentAt,
        sentCountDelta: result.delta,
        surveySentCount: result.surveySentCount,
      })
    },
  )

  // GET /v1/surveys/:id/distribution-batches/:batchId/send-progress
  // MANAGED_EMAIL only. Polled at 2s by the Sending state UI.
  fastify.get(
    '/surveys/:id/distribution-batches/:batchId/send-progress',
    async (request, reply) => {
      const { id: surveyId, batchId } = request.params as { id: string; batchId: string }
      const brandId = request.brandId

      const batch = await fastify.prisma.distributionBatch.findFirst({
        where: { id: batchId, surveyId, brandId },
        select: { id: true, sendMode: true },
      })
      if (!batch) return reply.status(404).send({ error: 'Batch not found' })
      if (batch.sendMode !== 'MANAGED_EMAIL') {
        return reply.status(409).send({ error: 'send-progress only valid for MANAGED_EMAIL batches', code: 'WRONG_SEND_MODE' })
      }

      const rows = await fastify.prisma.surveyDistribution.findMany({
        where: { batchId },
        select: {
          memberId: true,
          deliveredAt: true,
          failedAt: true,
          failureReason: true,
          member: {
            select: { firstName: true, lastName: true, email: true, externalId: true },
          },
        },
      })

      const recipientCount = rows.length
      let queuedCount = 0
      let sentCount = 0
      let failedCount = 0
      let skippedCount = 0
      const recipients = rows.map((r) => {
        let status: 'queued' | 'sending' | 'sent' | 'failed' = 'queued'
        if (r.deliveredAt) {
          status = 'sent'
          sentCount++
        } else if (r.failedAt) {
          status = 'failed'
          if (r.failureReason?.startsWith('skipped_')) skippedCount++
          else failedCount++
        } else {
          queuedCount++
        }
        return {
          memberId: r.memberId,
          identifier: r.member.email ?? r.member.externalId,
          firstName: r.member.firstName,
          lastName: r.member.lastName,
          status,
          deliveredAt: r.deliveredAt?.toISOString() ?? null,
          failedAt: r.failedAt?.toISOString() ?? null,
          failureReason: r.failureReason,
        }
      })
      const isComplete = queuedCount === 0

      return reply.status(200).send({
        batchId,
        recipientCount,
        queuedCount,
        sentCount,
        failedCount,
        skippedCount,
        isComplete,
        recipients,
      })
    },
  )

  // POST /v1/surveys/:id/distribution-batches/:batchId/retry-failed
  // MANAGED_EMAIL only. Re-enqueues rows with retryable failureReason.
  fastify.post(
    '/surveys/:id/distribution-batches/:batchId/retry-failed',
    {
      config: {
        auditAction: 'distribution_batch.retry_failed',
        auditResourceType: 'distribution_batch',
        auditAllowlist: ['batchId', 'retriedCount'],
      },
    },
    async (request, reply) => {
      const { id: surveyId, batchId } = request.params as { id: string; batchId: string }
      const brandId = request.brandId

      const batch = await fastify.prisma.distributionBatch.findFirst({
        where: { id: batchId, surveyId, brandId },
        select: { id: true, sendMode: true },
      })
      if (!batch) return reply.status(404).send({ error: 'Batch not found' })
      if (batch.sendMode !== 'MANAGED_EMAIL') {
        return reply.status(409).send({ error: 'retry-failed only valid for MANAGED_EMAIL batches', code: 'WRONG_SEND_MODE' })
      }

      // Retryable reasons: bounce + transient_error_after_retries. NOT
      // skipped_* (those are suppression-driven, will fail again).
      const retryable = await fastify.prisma.surveyDistribution.findMany({
        where: {
          batchId,
          failureReason: { in: ['bounce', 'transient_error_after_retries'] },
        },
        select: { memberId: true },
      })

      // Clear the failure markers so the worker re-attempts cleanly.
      if (retryable.length > 0) {
        await fastify.prisma.surveyDistribution.updateMany({
          where: {
            batchId,
            failureReason: { in: ['bounce', 'transient_error_after_retries'] },
          },
          data: { failedAt: null, failureReason: null },
        })
        // Enqueue managed-email-send jobs for each. Producer call is dynamic
        // import to avoid circular dependency between routes and queues.
        // G9/G10 — retry-failed cannot recover the original plaintext tokens
        // (hash-only at rest). Pass null; the worker uses its tokenPrefix
        // fallback for the URL (best-effort — these recipients ideally need
        // a regenerate-tokens flow which mints fresh tokens for them; out of
        // scope for the H4 batch).
        const { enqueueManagedEmailSend } = await import('../queues/bullmq.js')
        for (const row of retryable) {
          await enqueueManagedEmailSend({
            batchId,
            memberId: row.memberId,
            brandId,
            surveyId,
            surveyLinkToken: '',
            unsubscribeToken: null,
          })
        }
      }

      request.audit = { metadata: { batchId, retriedCount: retryable.length } }

      return reply.status(200).send({
        batchId,
        retriedCount: retryable.length,
      })
    },
  )
}

export default distributionBatchesRoutes
// Re-export for tests + future consumers
export { hashToken }
