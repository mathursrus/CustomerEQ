import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import type { MemberIdentifierMigration, MigrationOldKeyIngress } from '@prisma/client'
import { z } from 'zod'
import {
  parseMappingCsv,
  buildFastPathRows,
  validatePreflight,
  type PreflightMember,
  type MappingRow,
  type MigrationPreflightResult,
} from '../services/migrationPreflight.js'
import { normalizeExternalId } from '../services/memberResolution.js'
import { enqueueMemberIdentifierMigration } from '../queues/bullmq.js'

// Issue #524 — Switch member identifier kind (Slice 1: CUSTOMER_ID → EMAIL).
//
// All routes are admin-only (brand scoped via request.brandId from the auth
// plugin), tenant-isolated (R27), and audited. Status-code conventions match the
// sibling admin-brand-profile route: 422 = zod/CSV parse, 400/409 = business
// rule, 410 = deprecated-after-grace.

const CUSTOMER_ID = 'CUSTOMER_ID'
const EMAIL = 'EMAIL'

// Non-terminal states — at most one such migration per brand at a time.
const ACTIVE_STATUSES = [
  'PENDING_VALIDATION',
  'VALIDATED',
  'PROCESSING',
  'REKEY_COMPLETE_IN_GRACE',
] as const

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function migrationsBase(): string {
  return '/admin/brand/migrations'
}

// Shared canonical-key derivation — see normalizeExternalId (memberResolution).
const norm = normalizeExternalId

// Per-surface cutover guidance for the impact preview (R30).
const BRAND_SIDE_ACTION: Record<string, string> = {
  embedded_forms: 'Update your host application’s `?member_id=` URL parameter to pass email.',
  manual_api_enroll: 'Update your backend `POST /v1/members/enroll` calls to send email as the member id.',
  custom_list: 'Upload Custom List distribution audiences keyed by email going forward.',
  share_link: 'Update share-link survey distributions to identify respondents by email.',
  outbound_webhooks: 'Your webhook consumers will receive the member’s email in place of the customer id — no action required, informational.',
}

// ───────────────────────────── helpers ─────────────────────────────────────

async function loadOwnedMigration(
  prisma: import('@prisma/client').PrismaClient,
  brandId: string,
  id: string,
  reply: FastifyReply,
): Promise<MemberIdentifierMigration | null> {
  const migration = await prisma.memberIdentifierMigration.findFirst({ where: { id, brandId } })
  if (!migration) {
    reply.status(404).send({ error: 'Migration not found', code: 'MIGRATION_NOT_FOUND' })
    return null
  }
  return migration
}

/** Eligible loyalty members for migration: live (not erased / not soft-deleted). */
async function loadEligibleMembers(
  prisma: import('@prisma/client').PrismaClient,
  brandId: string,
): Promise<Array<{ id: string; externalId: string; email: string | null }>> {
  return prisma.member.findMany({
    where: { brandId, deletedAt: null, erased: false },
    select: { id: true, externalId: true, email: true },
  })
}

function toPreflightMembers(
  members: Array<{ id: string; externalId: string; email: string | null }>,
): PreflightMember[] {
  return members.map((m) => ({ memberId: m.id, customerId: m.externalId, email: m.email }))
}

async function oldKeyCountsByIngress(
  prisma: import('@prisma/client').PrismaClient,
  migrationId: string,
  since?: Date,
): Promise<Record<MigrationOldKeyIngress, number>> {
  const rows = await prisma.memberIdentifierMigrationOldKeyUsage.groupBy({
    by: ['ingress'],
    where: { migrationId, ...(since ? { dayBucket: { gte: since } } : {}) },
    _sum: { count: true },
  })
  const out = {
    PUBLIC_SURVEY_RESPOND: 0,
    API_MEMBERS_ENROLL: 0,
    DISTRIBUTION_BATCH: 0,
  } as Record<MigrationOldKeyIngress, number>
  for (const r of rows) out[r.ingress] = r._sum.count ?? 0
  return out
}

// Per-member error rows for a FAILED migration (R24 — show per-member errors).
async function loadErrorRows(
  prisma: import('@prisma/client').PrismaClient,
  migrationId: string,
): Promise<Array<{ customerId: string; newEmail: string; error: string }>> {
  const rows = await prisma.memberIdentifierMigrationMapping.findMany({
    where: { migrationId, errorReason: { not: null } },
    select: { oldExternalId: true, newExternalId: true, errorReason: true },
    take: 200,
  })
  return rows.map((r) => ({ customerId: r.oldExternalId, newEmail: r.newExternalId, error: r.errorReason ?? '' }))
}

function serializeMigration(
  m: MemberIdentifierMigration,
  oldKeyCounts: Record<MigrationOldKeyIngress, number>,
  errorRows: Array<{ customerId: string; newEmail: string; error: string }> = [],
): Record<string, unknown> {
  return {
    id: m.id,
    status: m.status,
    fromKind: m.fromKind,
    toKind: m.toKind,
    totalMembers: m.totalMembers,
    processedMembers: m.processedMembers,
    failedMembers: m.failedMembers,
    reconciledMembers: m.reconciledMembers,
    remainingMembers: Math.max(0, m.totalMembers - m.processedMembers - m.failedMembers),
    rekeyCompletedAt: m.rekeyCompletedAt?.toISOString() ?? null,
    graceExpiresAt: m.graceExpiresAt?.toISOString() ?? null,
    graceExtensions: m.graceExtensions,
    oldKeyUsage: oldKeyCounts,
    errorRows,
    createdAt: m.createdAt.toISOString(),
  }
}

// ───────────────────────────── route module ────────────────────────────────

const adminBrandMigrationsRoutes: FastifyPluginAsync = async (fastify) => {
  const base = migrationsBase()

  // Mapping uploads arrive as text/csv (mode=csv). Register the parser in this
  // plugin's encapsulated scope so it doesn't collide with other plugins. JSON
  // (mode=from_existing_emails) still parses via the default parser.
  fastify.addContentTypeParser('text/csv', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body)
  })

  // GET preflight-context — fast-path signals + impact preview (R28/R29/R30).
  fastify.get(`${base}/preflight-context`, async (request, reply) => {
    const brandId = request.brandId
    const members = await loadEligibleMembers(fastify.prisma, brandId)

    let withEmail = 0
    let withoutEmail = 0
    const emailGroups = new Map<string, number>()
    let invalidShape = 0
    const { EMAIL_RE } = await import('../services/memberResolution.js')
    for (const m of members) {
      if (m.email && m.email.trim().length > 0) {
        withEmail++
        const k = norm(m.email)
        emailGroups.set(k, (emailGroups.get(k) ?? 0) + 1)
        if (!EMAIL_RE.test(m.email.trim())) invalidShape++
      } else {
        withoutEmail++
      }
    }
    let collisionGroups = 0
    for (const [, c] of emailGroups) if (c > 1) collisionGroups++

    const fastPathAvailable = withoutEmail === 0 && collisionGroups === 0 && invalidShape === 0

    const impactPreview = await buildImpactPreview(fastify.prisma, brandId)

    return reply.status(200).send({
      counts: { total: members.length, withEmail, withoutEmail, collisionGroups, invalidShape },
      fastPathAvailable,
      impactPreview,
    })
  })

  // GET mapping-template.csv — pre-filled template (R4).
  fastify.get(`${base}/mapping-template.csv`, async (request, reply) => {
    const brandId = request.brandId
    const members = await loadEligibleMembers(fastify.prisma, brandId)
    const lines = ['customer_id,new_email']
    for (const m of members) {
      lines.push(`${csvCell(m.externalId)},${csvCell(m.email ?? '')}`)
    }
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="member-identifier-mapping.csv"')
      .status(200)
      .send(lines.join('\r\n') + '\r\n')
  })

  // POST /migrations — create (R1–R3; 409 if an active migration exists).
  fastify.post(
    base,
    { config: { auditAction: 'brand.identifier_migration.created', auditResourceType: 'member_identifier_migration', auditAllowlist: ['migrationId', 'fromKind', 'toKind'] } },
    async (request, reply) => {
      const brandId = request.brandId
      const brand = await fastify.prisma.brand.findUniqueOrThrow({
        where: { id: brandId },
        select: { memberIdentifierKind: true },
      })
      // Slice 1 only supports CUSTOMER_ID → EMAIL.
      if (brand.memberIdentifierKind !== CUSTOMER_ID) {
        return reply.status(400).send({
          error: `Slice 1 supports migrating from CUSTOMER_ID only; this brand is ${brand.memberIdentifierKind}.`,
          code: 'UNSUPPORTED_MIGRATION_DIRECTION',
        })
      }
      const active = await fastify.prisma.memberIdentifierMigration.findFirst({
        where: { brandId, status: { in: [...ACTIVE_STATUSES] } },
        select: { id: true },
      })
      if (active) {
        return reply.status(409).send({
          error: 'A migration is already in progress for this organization.',
          code: 'MIGRATION_ALREADY_IN_PROGRESS',
          migrationId: active.id,
          redirectTo: `/admin/settings/organization/migrations/${active.id}`,
        })
      }
      const created = await fastify.prisma.memberIdentifierMigration.create({
        data: { brandId, fromKind: CUSTOMER_ID, toKind: EMAIL, status: 'PENDING_VALIDATION' },
      })
      request.audit = {
        metadata: { migrationId: created.id, fromKind: CUSTOMER_ID, toKind: EMAIL },
      }
      const counts = await oldKeyCountsByIngress(fastify.prisma, created.id)
      return reply.status(201).send(serializeMigration(created, counts))
    },
  )

  // POST /:id/mapping — submit mapping + run pre-flight (R4–R12, R28, R29).
  fastify.post(
    `${base}/:id/mapping`,
    {
      config: { auditAction: 'brand.identifier_migration.validated', auditResourceType: 'member_identifier_migration', auditAllowlist: ['migrationId', 'counts'] },
      bodyLimit: 11 * 1024 * 1024,
    },
    async (request, reply) => {
      const brandId = request.brandId
      const { id } = request.params as { id: string }
      const migration = await loadOwnedMigration(fastify.prisma, brandId, id, reply)
      if (!migration) return
      if (migration.status !== 'PENDING_VALIDATION' && migration.status !== 'VALIDATED') {
        return reply.status(409).send({
          error: `Mapping can only be submitted before the migration starts (current: ${migration.status}).`,
          code: 'MIGRATION_NOT_EDITABLE',
        })
      }

      const members = await loadEligibleMembers(fastify.prisma, brandId)
      const preMembers = toPreflightMembers(members)

      // Mode: explicit body { mode: 'from_existing_emails' } (JSON) or a text/csv body.
      const contentType = request.headers['content-type'] ?? ''
      let rows: MappingRow[]
      if (contentType.includes('text/csv')) {
        const parsed = parseMappingCsv(String(request.body ?? ''))
        if (parsed.error) {
          return reply.status(422).send({ error: parsed.error, code: 'CSV_PARSE_ERROR' })
        }
        rows = parsed.rows
      } else {
        const body = (request.body ?? {}) as { mode?: string }
        if (body.mode !== 'from_existing_emails') {
          return reply.status(422).send({
            error: 'Provide a text/csv mapping body or JSON { mode: "from_existing_emails" }.',
            code: 'MAPPING_MODE_REQUIRED',
          })
        }
        rows = buildFastPathRows(preMembers)
      }

      const result: MigrationPreflightResult = validatePreflight(preMembers, rows)

      if (result.ok) {
        // Persist mappings (replace any prior attempt) + transition to VALIDATED.
        const rowByCustomerId = new Map<string, MappingRow>()
        for (const r of rows) rowByCustomerId.set(norm(r.customerId), r)
        const mappingData = members.map((m) => ({
          migrationId: id,
          memberId: m.id,
          oldExternalId: m.externalId,
          newExternalId: norm(rowByCustomerId.get(norm(m.externalId))!.newEmail),
          oldEmail: m.email,
        }))
        await fastify.prisma.$transaction([
          fastify.prisma.memberIdentifierMigrationMapping.deleteMany({ where: { migrationId: id } }),
          fastify.prisma.memberIdentifierMigrationMapping.createMany({ data: mappingData }),
          fastify.prisma.memberIdentifierMigration.update({
            where: { id },
            data: { status: 'VALIDATED', totalMembers: members.length },
          }),
        ])
        request.audit = { metadata: { migrationId: id, counts: result.counts } }
      }

      return reply.status(200).send(result)
    },
  )

  // GET /current — the brand's most recent non-cancelled migration (drives the
  // Member identification section's inline state), or null. Declared before
  // `/:id` so "current" isn't captured as an id param.
  fastify.get(`${base}/current`, async (request, reply) => {
    const brandId = request.brandId
    const migration = await fastify.prisma.memberIdentifierMigration.findFirst({
      where: { brandId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
    })
    if (!migration) return reply.status(200).send(null)
    const counts = await oldKeyCountsByIngress(fastify.prisma, migration.id)
    const errorRows = migration.status === 'FAILED' ? await loadErrorRows(fastify.prisma, migration.id) : []
    return reply.status(200).send(serializeMigration(migration, counts, errorRows))
  })

  // GET /:id — status + counters + grace + per-ingress old-key counts (polling).
  fastify.get(`${base}/:id`, async (request, reply) => {
    const brandId = request.brandId
    const { id } = request.params as { id: string }
    const migration = await loadOwnedMigration(fastify.prisma, brandId, id, reply)
    if (!migration) return
    const counts = await oldKeyCountsByIngress(fastify.prisma, id)
    const errorRows = migration.status === 'FAILED' ? await loadErrorRows(fastify.prisma, id) : []
    return reply.status(200).send(serializeMigration(migration, counts, errorRows))
  })

  // POST /:id/start — attestation + enqueue (R13, R14, R15). Retries a FAILED one.
  const StartSchema = z.object({
    attestationText: z.string().min(1).max(2000),
    confirmed: z.literal(true),
  })
  fastify.post(
    `${base}/:id/start`,
    { config: { auditAction: 'brand.identifier_migration.started', auditResourceType: 'member_identifier_migration', auditAllowlist: ['migrationId', 'attestedByClerkUserId', 'attestationText', 'attestedAt'] } },
    async (request, reply) => {
      const brandId = request.brandId
      const { id } = request.params as { id: string }
      const parse = StartSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({
          error: 'Attestation is required to start the migration.',
          code: 'ATTESTATION_REQUIRED',
          details: parse.error.errors,
        })
      }
      const migration = await loadOwnedMigration(fastify.prisma, brandId, id, reply)
      if (!migration) return

      if (migration.status === 'PROCESSING') {
        return reply.status(202).send({ status: 'PROCESSING', migrationId: id }) // idempotent
      }
      if (migration.status !== 'VALIDATED' && migration.status !== 'FAILED') {
        return reply.status(409).send({
          error: `Migration cannot be started from status ${migration.status}.`,
          code: 'MIGRATION_NOT_STARTABLE',
        })
      }

      const attestedAt = new Date()
      // For a FAILED retry (R24): clear prior per-member errors + counters so the
      // worker reprocesses every member.
      if (migration.status === 'FAILED') {
        await fastify.prisma.$transaction([
          fastify.prisma.memberIdentifierMigrationMapping.updateMany({
            where: { migrationId: id },
            data: { errorReason: null, appliedAt: null },
          }),
          fastify.prisma.memberIdentifierMigration.update({
            where: { id },
            data: { failedMembers: 0, processedMembers: 0 },
          }),
        ])
      }
      await fastify.prisma.memberIdentifierMigration.update({
        where: { id },
        data: {
          status: 'VALIDATED',
          attestedByClerkUserId: request.clerkUserId,
          attestationText: parse.data.attestationText,
          attestedAt,
        },
      })
      request.audit = {
        metadata: {
          migrationId: id,
          attestedByClerkUserId: request.clerkUserId,
          attestationText: parse.data.attestationText,
          attestedAt: attestedAt.toISOString(),
        },
      }
      await enqueueMemberIdentifierMigration({ migrationId: id })
      return reply.status(202).send({ status: 'PROCESSING', migrationId: id })
    },
  )

  // POST /:id/extend-grace — simple admin action, audited, no attestation (R34).
  const ExtendSchema = z.object({ deltaDays: z.number().int().positive().max(365) })
  fastify.post(
    `${base}/:id/extend-grace`,
    { config: { auditAction: 'brand.identifier_migration.grace_extended', auditResourceType: 'member_identifier_migration', auditAllowlist: ['migrationId', 'deltaDays', 'newGraceExpiresAt', 'by'] } },
    async (request, reply) => {
      const brandId = request.brandId
      const { id } = request.params as { id: string }
      const parse = ExtendSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.status(422).send({ error: 'deltaDays (positive integer) required.', code: 'INVALID_EXTENSION', details: parse.error.errors })
      }
      const migration = await loadOwnedMigration(fastify.prisma, brandId, id, reply)
      if (!migration) return
      if (migration.status !== 'REKEY_COMPLETE_IN_GRACE' || !migration.graceExpiresAt) {
        return reply.status(409).send({ error: 'No active grace window to extend.', code: 'NO_ACTIVE_GRACE' })
      }
      const at = new Date()
      const newGraceExpiresAt = new Date(migration.graceExpiresAt.getTime() + parse.data.deltaDays * DAY_MS)
      const extensions = Array.isArray(migration.graceExtensions) ? migration.graceExtensions : []
      await fastify.prisma.memberIdentifierMigration.update({
        where: { id },
        data: {
          graceExpiresAt: newGraceExpiresAt,
          graceExtensions: [...extensions, { by: request.clerkUserId, at: at.toISOString(), deltaDays: parse.data.deltaDays }],
        },
      })
      request.audit = {
        metadata: { migrationId: id, deltaDays: parse.data.deltaDays, newGraceExpiresAt: newGraceExpiresAt.toISOString(), by: request.clerkUserId },
      }
      return reply.status(200).send({ graceExpiresAt: newGraceExpiresAt.toISOString() })
    },
  )

  // POST /:id/cancel — only before any write (PENDING_VALIDATION | VALIDATED).
  fastify.post(
    `${base}/:id/cancel`,
    { config: { auditAction: 'brand.identifier_migration.cancelled', auditResourceType: 'member_identifier_migration', auditAllowlist: ['migrationId'] } },
    async (request, reply) => {
      const brandId = request.brandId
      const { id } = request.params as { id: string }
      const migration = await loadOwnedMigration(fastify.prisma, brandId, id, reply)
      if (!migration) return
      if (migration.status !== 'PENDING_VALIDATION' && migration.status !== 'VALIDATED') {
        return reply.status(409).send({ error: `Cannot cancel a migration in status ${migration.status}.`, code: 'MIGRATION_NOT_CANCELLABLE' })
      }
      await fastify.prisma.memberIdentifierMigration.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      })
      request.audit = { metadata: { migrationId: id } }
      return reply.status(200).send({ status: 'CANCELLED' })
    },
  )

  // GET /admin/brand/usage-warnings — brand-wide pre-expiry warning (R37).
  fastify.get('/admin/brand/usage-warnings', async (request, reply) => {
    const brandId = request.brandId
    const migration = await fastify.prisma.memberIdentifierMigration.findFirst({
      where: { brandId, status: 'REKEY_COMPLETE_IN_GRACE' },
      orderBy: { createdAt: 'desc' },
    })
    if (!migration || !migration.graceExpiresAt) return reply.status(200).send(null)

    const daysRemaining = Math.ceil((migration.graceExpiresAt.getTime() - Date.now()) / DAY_MS)
    if (daysRemaining > 7) return reply.status(200).send(null)

    const since7d = new Date(Date.now() - 7 * DAY_MS)
    const counts = await oldKeyCountsByIngress(fastify.prisma, migration.id, since7d)
    const active = (Object.entries(counts) as Array<[MigrationOldKeyIngress, number]>)
      .filter(([, c]) => c > 0)
      .map(([ingress, count7d]) => ({ ingress, count7d }))
    if (active.length === 0) return reply.status(200).send(null)

    return reply.status(200).send({
      kind: 'IDENTIFIER_MIGRATION_PRE_EXPIRY',
      migrationId: migration.id,
      graceExpiresAt: migration.graceExpiresAt.toISOString(),
      daysRemaining,
      oldKeyIngressesActive: active,
    })
  })
}

// ───────────────────────────── impact preview (R30/§H) ─────────────────────

type ImpactRow = { surface: string; lastSeenAt: string | null; count30d: number; brandSideAction: string }

async function buildImpactPreview(
  prisma: import('@prisma/client').PrismaClient,
  brandId: string,
): Promise<ImpactRow[]> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS)
  const rows: ImpactRow[] = []

  const [embedded, shareLink, manualApi, customList, webhooks] = await Promise.all([
    prisma.surveyResponse.aggregate({ where: { brandId, channel: 'in_app', createdAt: { gte: since } }, _count: true, _max: { createdAt: true } }),
    prisma.surveyResponse.aggregate({ where: { brandId, channel: 'link', createdAt: { gte: since } }, _count: true, _max: { createdAt: true } }),
    prisma.member.aggregate({ where: { brandId, enrolledVia: 'MANUAL_API', createdAt: { gte: since }, deletedAt: null }, _count: true, _max: { createdAt: true } }),
    prisma.distributionBatch.aggregate({ where: { brandId, createdAt: { gte: since }, audienceSpec: { path: ['mode'], equals: 'custom_list' } }, _count: true, _max: { createdAt: true } }),
    prisma.webhookEndpoint.count({ where: { brandId, active: true } }),
  ])

  const push = (surface: string, count: number, lastSeenAt: Date | null) => {
    if (count > 0) rows.push({ surface, count30d: count, lastSeenAt: lastSeenAt?.toISOString() ?? null, brandSideAction: BRAND_SIDE_ACTION[surface] })
  }
  push('embedded_forms', embedded._count, embedded._max.createdAt)
  push('share_link', shareLink._count, shareLink._max.createdAt)
  push('manual_api_enroll', manualApi._count, manualApi._max.createdAt)
  push('custom_list', customList._count, customList._max.createdAt)
  // Outbound webhooks: informational; no last-seen timestamp.
  if (webhooks > 0) rows.push({ surface: 'outbound_webhooks', count30d: webhooks, lastSeenAt: null, brandSideAction: BRAND_SIDE_ACTION.outbound_webhooks })

  // Most-recent activity first; informational (null lastSeenAt) sinks to the end.
  rows.sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''))
  return rows
}

function csvCell(value: string): string {
  // CSV formula-injection hardening: a cell beginning with = + - @ (or a control
  // char) can execute as a formula when the downloaded file is opened in Excel /
  // Sheets. Member external ids and emails are brand-supplied, so neutralize by
  // prefixing a single quote before quoting/escaping.
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export default adminBrandMigrationsRoutes
