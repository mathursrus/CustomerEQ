/// <reference types="vitest" />
// Issue #524 — Switch member identifier kind (Slice 1: CUSTOMER_ID → EMAIL).
// Integration tests against a real Postgres schema. The async re-key is driven
// directly via the worker dispatch (injected with the test prisma) since the
// route's enqueue is mocked to an InMemoryQueue in setup.ts.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createSurvey,
  createSurveyResponse,
  createErasedMember,
  createMemberIdentifierMigration,
  createMigrationMapping,
  authenticatedRequest,
  getTestPrisma,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'
import {
  dispatchMemberIdentifierMigration,
  dispatchGraceExpirySweep,
} from '@customerEQ/worker/processors/memberIdentifierMigration'

const DAY = 24 * 60 * 60 * 1000

async function seedCustomerIdBrand(name: string) {
  return createBrand({ name, memberIdentifierKind: 'CUSTOMER_ID' })
}

// Helper: a CUSTOMER_ID-keyed member with a customer-id externalId + email on file.
async function seedCustomerMember(brandId: string, customerId: string, email: string | null) {
  const prisma = getTestPrisma()
  return prisma.member.create({
    data: {
      brandId,
      externalId: customerId,
      email,
      enrolledVia: 'MANUAL_API',
      consentGivenAt: new Date(),
    },
  })
}

describe('Member identifier migration — CUSTOMER_ID → EMAIL', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // ── Happy path: fast-path → re-key → grace (R16/R17/R25/R28) ──────────────
  it('re-keys all members via the fast path and flips the kind only on success', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    await seedCustomerMember(brand.id, 'cust_1', 'alice@acme.com')
    await seedCustomerMember(brand.id, 'cust_2', 'bob@acme.com')
    const req = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    // Fast path is available (all have unique valid emails).
    const ctx = await req.get('/v1/admin/brand/migrations/preflight-context')
    expect(ctx.status).toBe(200)
    expect(ctx.body.fastPathAvailable).toBe(true)
    expect(ctx.body.counts.total).toBe(2)

    const created = await req.post('/v1/admin/brand/migrations').send({})
    expect(created.status).toBe(201)
    const migrationId = created.body.id

    const mapping = await req
      .post(`/v1/admin/brand/migrations/${migrationId}/mapping`)
      .send({ mode: 'from_existing_emails' })
    expect(mapping.status).toBe(200)
    expect(mapping.body.ok).toBe(true)
    expect(mapping.body.counts.membersMatched).toBe(2)

    const start = await req
      .post(`/v1/admin/brand/migrations/${migrationId}/start`)
      .send({ attestationText: 'I have permission to use these emails.', confirmed: true })
    expect(start.status).toBe(202)

    // Drive the re-key (worker) against the test schema.
    const result = await dispatchMemberIdentifierMigration({ migrationId }, prisma)
    expect(result.status).toBe('REKEY_COMPLETE_IN_GRACE')

    // Members re-keyed: externalId == email.
    const m1 = await prisma.member.findFirstOrThrow({ where: { brandId: brand.id, email: 'alice@acme.com' } })
    expect(m1.externalId).toBe('alice@acme.com')

    // Kind flipped, grace started.
    const refreshed = await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } })
    expect(refreshed.memberIdentifierKind).toBe('EMAIL')
    const mig = await prisma.memberIdentifierMigration.findUniqueOrThrow({ where: { id: migrationId } })
    expect(mig.status).toBe('REKEY_COMPLETE_IN_GRACE')
    expect(mig.graceExpiresAt).not.toBeNull()

    // Audit row (R25).
    const audit = await prisma.auditEvent.findFirst({
      where: { brandId: brand.id, action: 'brand.identifier_migration.completed' },
    })
    expect(audit).not.toBeNull()
  })

  // ── Pre-flight blocks an unmapped member (R8/R11) ─────────────────────────
  it('blocks the migration when an uploaded CSV omits a member', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    await seedCustomerMember(brand.id, 'cust_1', null)
    await seedCustomerMember(brand.id, 'cust_2', null)
    const req = authenticatedRequest(brand.id)

    const created = await req.post('/v1/admin/brand/migrations').send({})
    const migrationId = created.body.id

    // CSV maps only cust_1 (cust_2 missing).
    const csv = 'customer_id,new_email\ncust_1,alice@acme.com\n'
    const res = await req
      .post(`/v1/admin/brand/migrations/${migrationId}/mapping`)
      .set('Content-Type', 'text/csv')
      .send(csv)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.counts.unmappedMembers).toBe(1)

    const mig = await getTestPrisma().memberIdentifierMigration.findUniqueOrThrow({ where: { id: migrationId } })
    expect(mig.status).toBe('PENDING_VALIDATION') // not advanced to VALIDATED
  })

  // ── Failure rollback: members stay on their original key (R23) ────────────
  it('rolls members back to their original key when the re-key fails partway', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    const prisma = getTestPrisma()
    // m1 will re-key to clash@acme.com; a pre-existing m2 already holds that
    // externalId → the worker UPDATE collides (unique brandId+externalId) → fail.
    const m1 = await seedCustomerMember(brand.id, 'cust_1', 'clash@acme.com')
    await prisma.member.create({
      data: { brandId: brand.id, externalId: 'clash@acme.com', email: 'clash@acme.com', enrolledVia: 'MANUAL_API', consentGivenAt: new Date() },
    })

    const migration = await createMemberIdentifierMigration({ brandId: brand.id, status: 'VALIDATED', totalMembers: 1 })
    await createMigrationMapping({
      migrationId: migration.id,
      memberId: m1.id,
      oldExternalId: 'cust_1',
      newExternalId: 'clash@acme.com',
      oldEmail: 'clash@acme.com',
    })

    const result = await dispatchMemberIdentifierMigration({ migrationId: migration.id }, prisma)
    expect(result.status).toBe('FAILED')

    // m1 is back on its original key; kind never flipped.
    const m1After = await prisma.member.findUniqueOrThrow({ where: { id: m1.id } })
    expect(m1After.externalId).toBe('cust_1')
    const brandAfter = await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } })
    expect(brandAfter.memberIdentifierKind).toBe('CUSTOMER_ID')
    const migAfter = await prisma.memberIdentifierMigration.findUniqueOrThrow({ where: { id: migration.id } })
    expect(migAfter.status).toBe('FAILED')

    // R24 — per-member errors are surfaced via the status endpoint.
    const status = await authenticatedRequest(brand.id).get(`/v1/admin/brand/migrations/${migration.id}`)
    expect(status.status).toBe(200)
    expect(status.body.errorRows.length).toBeGreaterThanOrEqual(1)
    expect(status.body.errorRows[0].customerId).toBe('cust_1')
  })

  // ── Dual-key resolution during PROCESSING (R19/R32/R33) ───────────────────
  it('resolves the old customer_id to the migrated member during the window and counts old-key usage', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const prisma = getTestPrisma()
    // Member already re-keyed (externalId = email); migration still PROCESSING.
    const m = await seedCustomerMember(brand.id, 'alice@acme.com', 'alice@acme.com')
    const migration = await createMemberIdentifierMigration({ brandId: brand.id, status: 'PROCESSING', totalMembers: 1 })
    await createMigrationMapping({
      migrationId: migration.id,
      memberId: m.id,
      oldExternalId: 'cust_1',
      newExternalId: 'alice@acme.com',
      oldEmail: 'alice@acme.com',
      appliedAt: new Date(),
    })

    const req = authenticatedRequest(brand.id)
    const res = await req.post('/v1/members/enroll').send({ memberId: 'cust_1', programId: program.id, firstName: 'Alice' })
    expect(res.status).toBe(200)
    // Resolved to the SAME member — no duplicate created.
    const count = await prisma.member.count({ where: { brandId: brand.id } })
    expect(count).toBe(1)

    // Old-key usage recorded for the enroll ingress (R33).
    const usage = await prisma.memberIdentifierMigrationOldKeyUsage.findFirst({
      where: { migrationId: migration.id, ingress: 'API_MEMBERS_ENROLL' },
    })
    expect(usage?.count).toBe(1)
  })

  // ── Reconciliation of a late old-key enrollment (R20) ─────────────────────
  it('reconciles a member enrolled on the old key during the window with no duplicate', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const prisma = getTestPrisma()
    const m = await seedCustomerMember(brand.id, 'cust_1', 'alice@acme.com')

    const created = await authenticatedRequest(brand.id).post('/v1/admin/brand/migrations').send({})
    const migrationId = created.body.id
    await authenticatedRequest(brand.id)
      .post(`/v1/admin/brand/migrations/${migrationId}/mapping`)
      .send({ mode: 'from_existing_emails' })
    // Force PROCESSING and a brand-new old-key enrollment mid-window.
    await prisma.memberIdentifierMigration.update({ where: { id: migrationId }, data: { status: 'PROCESSING' } })
    const enr = await authenticatedRequest(brand.id).post('/v1/members/enroll').send({ memberId: 'cust_NEW', programId: program.id, firstName: 'New' })
    expect(enr.status).toBeGreaterThanOrEqual(200)
    expect(enr.status).toBeLessThan(300)

    // Finish the re-key (member m re-keyed; the new one reconciled).
    await prisma.memberIdentifierMigration.update({ where: { id: migrationId }, data: { status: 'VALIDATED' } })
    const result = await dispatchMemberIdentifierMigration({ migrationId }, prisma)
    expect(result.status).toBe('REKEY_COMPLETE_IN_GRACE')

    const mig = await prisma.memberIdentifierMigration.findUniqueOrThrow({ where: { id: migrationId } })
    expect(mig.reconciledMembers).toBeGreaterThanOrEqual(1)
    // The new member exists exactly once.
    expect(await prisma.member.count({ where: { brandId: brand.id, externalId: 'cust_new' } })).toBe(1)
    void m
  })

  // ── Grace expiry → deprecated error (R35a) + unknown-shape (R35b) ─────────
  it('rejects an old id after grace expiry with the deprecated error', async () => {
    const prisma = getTestPrisma()
    // Brand already flipped to EMAIL; migration in grace, deadline in the past.
    const brand = await createBrand({ name: 'Acme', memberIdentifierKind: 'EMAIL' })
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const m = await seedCustomerMember(brand.id, 'alice@acme.com', 'alice@acme.com')
    const migration = await createMemberIdentifierMigration({
      brandId: brand.id,
      status: 'REKEY_COMPLETE_IN_GRACE',
      rekeyCompletedAt: new Date(Date.now() - 31 * DAY),
      graceExpiresAt: new Date(Date.now() - 1 * DAY),
    })
    await createMigrationMapping({
      migrationId: migration.id,
      memberId: m.id,
      oldExternalId: 'cust_1',
      newExternalId: 'alice@acme.com',
      oldEmail: 'alice@acme.com',
      appliedAt: new Date(),
    })

    const sweep = await dispatchGraceExpirySweep(new Date(), prisma)
    expect(sweep.expired).toBe(1)
    const migAfter = await prisma.memberIdentifierMigration.findUniqueOrThrow({ where: { id: migration.id } })
    expect(migAfter.status).toBe('GRACE_EXPIRED')

    const req = authenticatedRequest(brand.id)
    // (a) Old id of a migrated member → 410 deprecated.
    const dep = await req.post('/v1/members/enroll').send({ memberId: 'cust_1', programId: program.id })
    expect(dep.status).toBe(410)
    expect(dep.body.error).toBe('IDENTIFIER_DEPRECATED_AFTER_MIGRATION')

    // (b) Unknown old-shape id → rejected, no member created.
    const before = await prisma.member.count({ where: { brandId: brand.id } })
    const unknown = await req.post('/v1/members/enroll').send({ memberId: 'cust_NEVER', programId: program.id })
    expect(unknown.status).toBeGreaterThanOrEqual(400)
    expect(await prisma.member.count({ where: { brandId: brand.id } })).toBe(before)
  })

  // ── Erased / soft-deleted members are excluded (R26) ──────────────────────
  it('excludes erased and soft-deleted members from coverage and re-key', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    const prisma = getTestPrisma()
    await seedCustomerMember(brand.id, 'cust_1', 'alice@acme.com')
    await createErasedMember({ brandId: brand.id })
    await prisma.member.create({
      data: { brandId: brand.id, externalId: 'cust_deleted', email: 'del@acme.com', enrolledVia: 'MANUAL_API', deletedAt: new Date() },
    })

    const ctx = await authenticatedRequest(brand.id).get('/v1/admin/brand/migrations/preflight-context')
    // Only the one live member is counted.
    expect(ctx.body.counts.total).toBe(1)
  })

  // ── Preserves clerkUserId across re-key (R36) ─────────────────────────────
  it('preserves a loyalty member clerkUserId across the re-key', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    const prisma = getTestPrisma()
    await prisma.member.create({
      data: { brandId: brand.id, externalId: 'cust_1', email: 'alice@acme.com', enrolledVia: 'MANUAL_API', clerkUserId: 'user_self_enrolled', consentGivenAt: new Date() },
    })

    const req = authenticatedRequest(brand.id)
    const created = await req.post('/v1/admin/brand/migrations').send({})
    const migrationId = created.body.id
    await req.post(`/v1/admin/brand/migrations/${migrationId}/mapping`).send({ mode: 'from_existing_emails' })
    await dispatchMemberIdentifierMigration({ migrationId }, prisma)

    const after = await prisma.member.findFirstOrThrow({ where: { brandId: brand.id, externalId: 'alice@acme.com' } })
    expect(after.clerkUserId).toBe('user_self_enrolled')
  })

  // ── Tenant isolation: cannot read another brand's migration (R27) ─────────
  it('returns 404 for a migration owned by another brand', async () => {
    const brandA = await seedCustomerIdBrand('A')
    const brandB = await seedCustomerIdBrand('B')
    const migB = await createMemberIdentifierMigration({ brandId: brandB.id })
    const res = await authenticatedRequest(brandA.id).get(`/v1/admin/brand/migrations/${migB.id}`)
    expect(res.status).toBe(404)
  })

  // ── Pre-expiry warning surfaces when ≤7d remain + active old-key (R37) ────
  it('surfaces a pre-expiry usage warning when grace is closing and the old key is active', async () => {
    const brand = await createBrand({ name: 'Acme', memberIdentifierKind: 'EMAIL' })
    const prisma = getTestPrisma()
    const migration = await createMemberIdentifierMigration({
      brandId: brand.id,
      status: 'REKEY_COMPLETE_IN_GRACE',
      rekeyCompletedAt: new Date(Date.now() - 27 * DAY),
      graceExpiresAt: new Date(Date.now() + 3 * DAY),
    })
    const today = new Date()
    const dayBucket = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    await prisma.memberIdentifierMigrationOldKeyUsage.create({
      data: { migrationId: migration.id, brandId: brand.id, ingress: 'API_MEMBERS_ENROLL', dayBucket, count: 5 },
    })

    const res = await authenticatedRequest(brand.id).get('/v1/admin/brand/usage-warnings')
    expect(res.status).toBe(200)
    expect(res.body).not.toBeNull()
    expect(res.body.kind).toBe('IDENTIFIER_MIGRATION_PRE_EXPIRY')
    expect(res.body.daysRemaining).toBeLessThanOrEqual(7)
    expect(res.body.oldKeyIngressesActive[0].ingress).toBe('API_MEMBERS_ENROLL')
  })

  // ── Mapping template is pre-filled from existing emails (R4) ──────────────
  it('downloads a mapping template pre-filled with customer_id + existing email', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    await seedCustomerMember(brand.id, 'cust_1', 'alice@acme.com')
    await seedCustomerMember(brand.id, 'cust_2', null)
    const res = await authenticatedRequest(brand.id).get('/v1/admin/brand/migrations/mapping-template.csv')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    const body = res.text
    expect(body).toContain('customer_id,new_email')
    expect(body).toContain('cust_1,alice@acme.com')
    expect(body).toMatch(/cust_2,\s*(\r|\n|$)/) // cust_2 row has a blank email
  })

  // ── Impact preview lists active surfaces, omits /v1/events (R30 / §M) ──────
  it('lists embedded-form activity in the impact preview and never lists /v1/events', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
    const member = await seedCustomerMember(brand.id, 'cust_1', 'alice@acme.com')
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createSurveyResponse({ surveyId: survey.id, memberId: member.id, brandId: brand.id, channel: 'in_app' })

    const ctx = await authenticatedRequest(brand.id).get('/v1/admin/brand/migrations/preflight-context')
    expect(ctx.status).toBe(200)
    const surfaces = (ctx.body.impactPreview as Array<{ surface: string }>).map((r) => r.surface)
    expect(surfaces).toContain('embedded_forms')
    // /v1/events is internal-id keyed and migration-stable — never listed (§M).
    expect(surfaces.join(',')).not.toMatch(/events/i)
  })

  // ── Extend grace is a simple audited action (R34/R25) ─────────────────────
  it('extends the grace window and appends an audit entry', async () => {
    const brand = await createBrand({ name: 'Acme', memberIdentifierKind: 'EMAIL' })
    const prisma = getTestPrisma()
    const originalDeadline = new Date(Date.now() + 5 * DAY)
    const migration = await createMemberIdentifierMigration({
      brandId: brand.id,
      status: 'REKEY_COMPLETE_IN_GRACE',
      rekeyCompletedAt: new Date(Date.now() - 25 * DAY),
      graceExpiresAt: originalDeadline,
    })
    const res = await authenticatedRequest(brand.id)
      .post(`/v1/admin/brand/migrations/${migration.id}/extend-grace`)
      .send({ deltaDays: 30 })
    expect(res.status).toBe(200)
    const after = await prisma.memberIdentifierMigration.findUniqueOrThrow({ where: { id: migration.id } })
    expect(after.graceExpiresAt!.getTime()).toBeGreaterThan(originalDeadline.getTime())
    expect((after.graceExtensions as unknown[]).length).toBe(1)
    const audit = await prisma.auditEvent.findFirst({
      where: { brandId: brand.id, action: 'brand.identifier_migration.grace_extended' },
    })
    expect(audit).not.toBeNull()
  })

  // ── Attestation is persisted to the audit log on start (R13/R25) ──────────
  it('persists the attestation text + admin + timestamp in the audit log on start', async () => {
    const brand = await seedCustomerIdBrand('Acme')
    await seedCustomerMember(brand.id, 'cust_1', 'alice@acme.com')
    const prisma = getTestPrisma()
    const req = authenticatedRequest(brand.id)
    const created = await req.post('/v1/admin/brand/migrations').send({})
    const migrationId = created.body.id
    await req.post(`/v1/admin/brand/migrations/${migrationId}/mapping`).send({ mode: 'from_existing_emails' })
    const attestationText = 'I confirm I have permission to use these emails.'
    const start = await req
      .post(`/v1/admin/brand/migrations/${migrationId}/start`)
      .send({ attestationText, confirmed: true })
    expect(start.status).toBe(202)
    const audit = await prisma.auditEvent.findFirst({
      where: { brandId: brand.id, action: 'brand.identifier_migration.started' },
    })
    expect(audit).not.toBeNull()
    expect((audit!.metadata as Record<string, unknown>).attestationText).toBe(attestationText)
  })
})
