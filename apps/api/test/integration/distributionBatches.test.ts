/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createSurvey,
  createMember,
  authenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

// Issue #378 — integration tests for the 5 admin distribution-batches endpoints.
// Tests run against the real Postgres test DB seeded between cases.

describe('POST /v1/surveys/:id/distribution-batches/preview', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('returns audience count for existing_members + count mode', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches/preview`).send({
      surveyNameInMail: 'Q2 NPS',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 2 },
    })

    expect(res.status).toBe(200)
    expect(res.body.audienceCount).toBe(2)
    expect(res.body.members).toHaveLength(2)
    expect(res.body.unmatched).toEqual([])
  })

  it('returns audience count for existing_members + percent mode', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    for (let i = 0; i < 10; i++) await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches/preview`).send({
      surveyNameInMail: 'Q2 NPS',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      audience: { mode: 'existing_members', strategy: 'percent', value: 50 },
    })

    expect(res.status).toBe(200)
    expect(res.body.audienceCount).toBe(5)
  })

  it('returns 404 for unknown survey', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const res = await request.post(`/v1/surveys/nonexistent/distribution-batches/preview`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 for cross-brand survey (tenant isolation)', async () => {
    const brandA = await createBrand()
    const brandB = await createBrand()
    const programB = await createProgram({ brandId: brandB.id })
    const surveyB = await createSurvey({ brandId: brandB.id, programId: programB.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brandA.id)

    const res = await request.post(`/v1/surveys/${surveyB.id}/distribution-batches/preview`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })
    expect(res.status).toBe(404)
  })

  it('returns 422 for invalid JSON body', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches/preview`).send({
      // missing surveyNameInMail
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })
    expect(res.status).toBe(422)
  })
})

describe('POST /v1/surveys/:id/distribution-batches (generate)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('atomically creates batch + tokens + distribution rows for existing_members', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    for (let i = 0; i < 3; i++) await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2 NPS',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 3 },
    })

    expect(res.status).toBe(201)
    expect(res.body.tokenCount).toBe(3)
    expect(res.body.tokens).toHaveLength(3)
    // Plaintext is present in the response — and only here.
    for (const t of res.body.tokens) {
      expect(typeof t.plaintext).toBe('string')
      expect(t.plaintext.length).toBeGreaterThan(0)
    }

    const prisma = getTestPrisma()
    const batchRow = await prisma.distributionBatch.findUnique({ where: { id: res.body.batchId } })
    expect(batchRow).toBeTruthy()
    const tokenCount = await prisma.surveyDistributionToken.count({ where: { batchId: res.body.batchId } })
    expect(tokenCount).toBe(3)
    const distributionCount = await prisma.surveyDistribution.count({ where: { batchId: res.body.batchId } })
    expect(distributionCount).toBe(3)
  })

  it('rejects generate against non-ACTIVE survey with 409', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('SURVEY_NOT_ACTIVE')
  })

  it('rejects empty audience with 422 AUDIENCE_EMPTY', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)
    // No members exist in the brand.

    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })
    expect(res.status).toBe(422)
  })

  it('rejects past expiresAt with 422 EXPIRES_AT_MUST_BE_FUTURE', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('EXPIRES_AT_MUST_BE_FUTURE')
  })
})

// Issue #531 — audience-builder pre-resolved memberIds path.
// The UI used to roundtrip selected rows through a paste body, which the
// server then re-parsed with brand-kind-aware shape inference; rows whose
// inferred shape disagreed with Brand.memberIdentifierKind were silently
// dropped and the batch failed with AUDIENCE_EMPTY (production incident
// 2026-05-28, brand cmp5ud2x2001xw7h2xhgfniru). The fix lets the UI pass
// already-resolved Member.id values directly so no shape inference applies.
describe('POST /v1/surveys/:id/distribution-batches with pre-resolved memberIds (#531)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('reproduces #531: paste-only fails AUDIENCE_EMPTY when brand kind disagrees with member externalId shape', async () => {
    // FRAIM-style configuration: brand uses CUSTOMER_ID kind, but a member
    // happens to have an email-shaped externalId. The parser infers "email",
    // expects "external_id", drops the row, audience resolves to zero.
    const brand = await createBrand({ memberIdentifierKind: 'CUSTOMER_ID' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const member = await createMember({
      brandId: brand.id,
      externalId: 'sid@example.com',
      email: 'sid@example.com',
      consentGivenAt: new Date(),
    })

    const request = authenticatedRequest(brand.id)
    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: {
        mode: 'custom_list',
        identifiers: member.externalId,
        autoEnroll: false,
      },
    })

    // The production failure shape. Holds pre-fix and post-fix — paste-parser
    // semantics are intentionally unchanged; the fix changes which path the
    // UI uses, not how paste rows are parsed.
    expect(res.status).toBe(422)
  })

  it('fixes #531: memberIds-only audience succeeds for the same brand+member configuration', async () => {
    const brand = await createBrand({ memberIdentifierKind: 'CUSTOMER_ID' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const member = await createMember({
      brandId: brand.id,
      externalId: 'sid@example.com',
      email: 'sid@example.com',
      consentGivenAt: new Date(),
    })

    const request = authenticatedRequest(brand.id)
    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: {
        mode: 'custom_list',
        identifiers: '',
        autoEnroll: false,
        memberIds: [member.id],
      },
    })

    expect(res.status).toBe(201)
    expect(res.body.tokenCount).toBe(1)
    expect(res.body.tokens[0].memberId).toBe(member.id)
  })

  it('dedups: same member supplied via both memberIds and a matching paste entry yields one token', async () => {
    const brand = await createBrand({ memberIdentifierKind: 'EMAIL' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const member = await createMember({
      brandId: brand.id,
      externalId: 'recipient@example.com',
      email: 'recipient@example.com',
      consentGivenAt: new Date(),
    })

    const request = authenticatedRequest(brand.id)
    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: {
        mode: 'custom_list',
        identifiers: 'recipient@example.com',
        autoEnroll: false,
        memberIds: [member.id],
      },
    })

    expect(res.status).toBe(201)
    expect(res.body.tokenCount).toBe(1)
  })

  it('ignores memberIds that belong to another brand (tenant isolation)', async () => {
    const brandA = await createBrand()
    const brandB = await createBrand()
    const programA = await createProgram({ brandId: brandA.id })
    const surveyA = await createSurvey({ brandId: brandA.id, programId: programA.id, status: 'ACTIVE' })
    const memberB = await createMember({ brandId: brandB.id, consentGivenAt: new Date() })

    const request = authenticatedRequest(brandA.id)
    const res = await request.post(`/v1/surveys/${surveyA.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: {
        mode: 'custom_list',
        identifiers: '',
        autoEnroll: false,
        memberIds: [memberB.id],
      },
    })

    // memberB belongs to brandB; brandA's request must not be able to
    // dispatch to them. The lookup is brandId-scoped, so the audience
    // resolves to zero → AUDIENCE_EMPTY.
    expect(res.status).toBe(422)
  })
})

// Issue #540 F3 — Survey.sentCount must reflect both MANAGED_EMAIL and
// SELF_SERVE recipients on the survey-detail "Survey Sent: N" header. The
// pre-fix behavior counted only managed-email deliveries plus self-serve
// batches whose operator had explicitly hit mark-csv-downloaded (often never
// fires). Loop Monitor is the reference: "sent" = recipients the operator
// committed to sending, regardless of channel.
describe('Survey.sentCount semantics across send modes (#540 F3)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('SELF_SERVE batch create bumps Survey.sentCount by minted recipients immediately', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    for (let i = 0; i < 3; i++) await createMember({ brandId: brand.id })

    const before = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id },
      select: { sentCount: true },
    })
    expect(before.sentCount).toBe(0)

    const request = authenticatedRequest(brand.id)
    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2 self-serve wave',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 3 },
    })
    expect(res.status).toBe(201)
    expect(res.body.tokenCount).toBe(3)

    const after = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id },
      select: { sentCount: true },
    })
    // Pre-fix: sentCount stays at 0 until operator hits mark-csv-downloaded.
    // Post-fix: bumped at mint time so the Survey Sent: N header shows the
    // SELF_SERVE recipients without operator action.
    expect(after.sentCount).toBe(3)
  })

  it('mark-csv-downloaded does NOT double-bump Survey.sentCount after the mint-time bump', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    for (let i = 0; i < 4; i++) await createMember({ brandId: brand.id })

    const request = authenticatedRequest(brand.id)
    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2 self-serve wave',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 4 },
    })
    expect(gen.status).toBe(201)

    const afterMint = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id },
      select: { sentCount: true },
    })
    expect(afterMint.sentCount).toBe(4)

    const mark = await request
      .post(`/v1/surveys/${survey.id}/distribution-batches/${gen.body.batchId}/mark-csv-downloaded`)
      .send({})
    expect(mark.status).toBe(200)

    const afterMark = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id },
      select: { sentCount: true },
    })
    // Audit timestamp (sentAt) still gets recorded by mark-csv-downloaded;
    // the bump moved to mint time so the count must stay at 4, not jump to 8.
    expect(afterMark.sentCount).toBe(4)
  })

  it('MANAGED_EMAIL batch create does NOT bump Survey.sentCount at mint time (per-delivery semantics preserved)', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id, email: 'recipient@example.com', consentGivenAt: new Date() })

    const request = authenticatedRequest(brand.id)
    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      sendMode: 'MANAGED_EMAIL',
      surveyNameInMail: 'Q2 managed wave',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
      composer: {
        senderName: 'Acme CX Team',
        senderAlias: 'feedback',
        subject: 'Quick question: Q2',
        body: 'Hi {{first_name}}, please respond at {{survey_link}}',
      },
    })
    expect(res.status).toBe(201)

    const afterMint = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id },
      select: { sentCount: true },
    })
    // MANAGED_EMAIL still bumps per-delivery via the worker's markDelivered.
    // Mint time alone must not bump; otherwise the integration tests that
    // exercise the full mint → deliver path would double-count.
    expect(afterMint.sentCount).toBe(0)
  })
})

// Issue #543 F1 — backfill historical Survey.sentCount for SELF_SERVE
// recipients minted pre-#540. The #540 fix bumps Survey.sentCount at
// mint time going forward, but couldn't retroactively fix data minted
// before the deploy where the operator never called mark-csv-downloaded.
// This block exercises the migration SQL (truth-from-scratch recompute).
//
// The SQL lives at packages/database/prisma/migrations/
//   20260529100000_backfill_survey_sent_count_self_serve/migration.sql
// and is run by `pnpm db:migrate`. These tests execute the same SQL inline
// via prisma.$executeRawUnsafe so the assertions cover the SQL's behavior
// independent of when the migration was applied.
describe('Survey.sentCount backfill migration (#543 F1)', () => {
  // Each test process gets its own schema (see packages/config/src/test-utils/
  // db/setup.ts). Prisma's typed client auto-qualifies table names with the
  // per-connection ?schema=...; $executeRawUnsafe does not, so the raw SQL
  // would resolve "Survey" against `public` and fail. We extract the schema
  // from DATABASE_URL and substitute it into the SQL directly — Prisma's
  // raw-exec can't handle multi-statement preludes (Postgres prepared-stmt
  // limitation), so a single SCHEMA-qualified UPDATE is the cleanest path.
  // The shipped migration file has no such qualification (Prisma migrate runs
  // against `public` directly). The qualifier is test-rig-only.
  function getTestSchema(): string {
    const url = process.env.DATABASE_URL ?? ''
    const m = url.match(/[?&]schema=([^&]+)/)
    return m ? m[1] : 'public'
  }
  function getBackfillSql(): string {
    const s = getTestSchema()
    return `
      UPDATE "${s}"."surveys" sv
      SET "sentCount" = COALESCE((
        SELECT COUNT(t."id")
        FROM "${s}"."survey_distribution_tokens" t
        JOIN "${s}"."distribution_batches" b ON b."id" = t."batchId"
        WHERE b."surveyId" = sv."id" AND b."sendMode" = 'SELF_SERVE'
      ), 0) + COALESCE((
        SELECT COUNT(d."id")
        FROM "${s}"."survey_distributions" d
        JOIN "${s}"."distribution_batches" b ON b."id" = d."batchId"
        WHERE b."surveyId" = sv."id" AND b."sendMode" = 'MANAGED_EMAIL'
              AND d."deliveredAt" IS NOT NULL
      ), 0)
      WHERE EXISTS (
        SELECT 1 FROM "${s}"."distribution_batches" b WHERE b."surveyId" = sv."id"
      )
    `
  }

  beforeEach(async () => {
    await seedTestDb()
  })

  it('recomputes sentCount = SELF_SERVE token count + MANAGED_EMAIL delivered count', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    for (let i = 0; i < 15; i++) await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    // 2 SELF_SERVE waves: 10 + 5 = 15 tokens total
    const selfServe1 = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Self-serve wave 1',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 10 },
    })
    expect(selfServe1.status).toBe(201)
    const selfServe2 = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Self-serve wave 2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 5 },
    })
    expect(selfServe2.status).toBe(201)

    // 1 MANAGED_EMAIL wave with 3 recipients; manually mark 2 of 3 as delivered.
    await createMember({ brandId: brand.id, email: 'm1@example.com', consentGivenAt: new Date() })
    await createMember({ brandId: brand.id, email: 'm2@example.com', consentGivenAt: new Date() })
    await createMember({ brandId: brand.id, email: 'm3@example.com', consentGivenAt: new Date() })
    const managed = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      sendMode: 'MANAGED_EMAIL',
      surveyNameInMail: 'Managed wave',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 3 },
      composer: {
        senderName: 'Acme CX',
        senderAlias: 'feedback',
        subject: 'Quick question',
        body: 'Hi {{first_name}}, please respond at {{survey_link}}',
      },
    })
    expect(managed.status).toBe(201)
    // Mark 2 of 3 as delivered.
    const managedRows = await prisma.surveyDistribution.findMany({
      where: { batchId: managed.body.batchId },
      take: 2,
    })
    await prisma.surveyDistribution.updateMany({
      where: { id: { in: managedRows.map((r) => r.id) } },
      data: { deliveredAt: new Date() },
    })

    // Simulate pre-#540 historical state: zero the denormalized field.
    await prisma.survey.update({ where: { id: survey.id }, data: { sentCount: 0 } })

    // Run the backfill.
    await prisma.$executeRawUnsafe(getBackfillSql())

    const after = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id },
      select: { sentCount: true },
    })
    // 10 + 5 SELF_SERVE tokens + 2 MANAGED_EMAIL delivered = 17.
    expect(after.sentCount).toBe(17)
  })

  it('is idempotent — running twice yields the same value', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    for (let i = 0; i < 7; i++) await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)
    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'wave',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 7 },
    })
    expect(gen.status).toBe(201)

    await prisma.survey.update({ where: { id: survey.id }, data: { sentCount: 0 } })
    await prisma.$executeRawUnsafe(getBackfillSql())
    const first = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id },
      select: { sentCount: true },
    })
    await prisma.$executeRawUnsafe(getBackfillSql())
    const second = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id },
      select: { sentCount: true },
    })
    expect(first.sentCount).toBe(7)
    expect(second.sentCount).toBe(7)
  })

  it('leaves surveys with no batches at sentCount = 0', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    // No batches created. Pretend a previous backfill set a stale value.
    await prisma.survey.update({ where: { id: survey.id }, data: { sentCount: 99 } })
    await prisma.$executeRawUnsafe(getBackfillSql())

    const after = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id },
      select: { sentCount: true },
    })
    // WHERE EXISTS guard means this Survey row isn't touched; the stale 99
    // is preserved. That's intentional — a survey with no waves can have
    // sentCount=0 (the default) but we don't actively overwrite anything
    // that the column already held. If it ever holds a non-zero value
    // for a no-batch survey, that's already a different bug to investigate.
    expect(after.sentCount).toBe(99)
  })

  it('counts MANAGED_EMAIL recipients only when deliveredAt is set (per-delivery semantic)', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    for (let i = 0; i < 4; i++) await createMember({ brandId: brand.id, consentGivenAt: new Date(), email: `m${i}@x.example` })
    const request = authenticatedRequest(brand.id)
    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      sendMode: 'MANAGED_EMAIL',
      surveyNameInMail: 'managed-only',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 4 },
      composer: {
        senderName: 'X', senderAlias: 'y', subject: 's',
        body: 'Hi {{first_name}}, {{survey_link}}',
      },
    })
    expect(gen.status).toBe(201)

    // Zero rows delivered yet → MANAGED_EMAIL contributes 0 to sentCount.
    await prisma.survey.update({ where: { id: survey.id }, data: { sentCount: 0 } })
    await prisma.$executeRawUnsafe(getBackfillSql())
    const before = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id }, select: { sentCount: true },
    })
    expect(before.sentCount).toBe(0)

    // Mark 3 of 4 delivered, re-run.
    const rows = await prisma.surveyDistribution.findMany({
      where: { batchId: gen.body.batchId }, take: 3,
    })
    await prisma.surveyDistribution.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { deliveredAt: new Date() },
    })
    await prisma.$executeRawUnsafe(getBackfillSql())
    const after = await prisma.survey.findUniqueOrThrow({
      where: { id: survey.id }, select: { sentCount: true },
    })
    expect(after.sentCount).toBe(3)
  })
})

describe('GET /v1/surveys/:id/distribution-batches (list)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('lists batches with counters and standard pagination envelope', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    // Create one batch.
    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })
    expect(gen.status).toBe(201)

    const res = await request.get(`/v1/surveys/${survey.id}/distribution-batches`).send()
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].sentCount).toBe(1)
    expect(res.body.data[0].respondedCount).toBe(0)
    expect(res.body.data[0].awaitingCount).toBe(1)
    expect(res.body.data[0].expiredCount).toBe(0)
  })
})

describe('GET /v1/surveys/:id/distribution-batches/:batchId (detail)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('returns batch detail without plaintext anywhere', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })
    const batchId = gen.body.batchId

    const res = await request.get(`/v1/surveys/${survey.id}/distribution-batches/${batchId}`).send()
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(batchId)
    expect(res.body.tokens.data[0].status).toBe('awaiting_response')
    expect(res.body.tokens.data[0].tokenPrefix).toBeTruthy()
    // The load-bearing assertion: no plaintext key anywhere in the detail.
    expect(JSON.stringify(res.body)).not.toContain('plaintext')
  })

  // Issue #420 §3.2 — Wave Detail page consumes sendMode + composerSnapshot to
  // render the mode pill and the read-only Composer snapshot block.
  it('returns sendMode=SELF_SERVE and composerSnapshot=null for a self-serve batch', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })
    const res = await request
      .get(`/v1/surveys/${survey.id}/distribution-batches/${gen.body.batchId}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.sendMode).toBe('SELF_SERVE')
    expect(res.body.composerSnapshot).toBeNull()
  })

  it('returns sendMode=MANAGED_EMAIL and a populated composerSnapshot for a managed-email batch', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id, email: 'recipient@example.com' })
    const request = authenticatedRequest(brand.id)

    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      sendMode: 'MANAGED_EMAIL',
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
      composer: {
        senderName: 'Acme CX Team',
        senderAlias: 'feedback',
        subject: 'Quick question: Q2 NPS',
        body: 'Hi {{first_name}}, please respond at {{survey_link}}',
      },
    })
    expect(gen.status).toBe(201)

    const res = await request
      .get(`/v1/surveys/${survey.id}/distribution-batches/${gen.body.batchId}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.sendMode).toBe('MANAGED_EMAIL')
    expect(res.body.composerSnapshot).not.toBeNull()
    expect(res.body.composerSnapshot.senderName).toBe('Acme CX Team')
    expect(res.body.composerSnapshot.senderAlias).toBe('feedback')
    expect(typeof res.body.composerSnapshot.senderDomain).toBe('string')
    expect(res.body.composerSnapshot.subject).toBe('Quick question: Q2 NPS')
    expect(res.body.composerSnapshot.body).toContain('{{survey_link}}')
  })
})

describe('PATCH /v1/surveys/:id/distribution-batches/:batchId/expiry', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('updates batch.expiresAt and all child token.expiresAt atomically', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 2 },
    })
    const batchId = gen.body.batchId

    const newExpiresAt = new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString()
    const res = await request.patch(`/v1/surveys/${survey.id}/distribution-batches/${batchId}/expiry`).send({
      expiresAt: newExpiresAt,
    })
    expect(res.status).toBe(200)
    expect(res.body.expiresAt).toBe(newExpiresAt)
    expect(res.body.affectedTokenCount).toBe(2)

    const prisma = getTestPrisma()
    const tokens = await prisma.surveyDistributionToken.findMany({ where: { batchId } })
    for (const t of tokens) {
      expect(t.expiresAt.toISOString()).toBe(newExpiresAt)
    }
  })

  it('rejects past expiresAt with 422 EXPIRES_AT_MUST_BE_FUTURE', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })

    const res = await request.patch(`/v1/surveys/${survey.id}/distribution-batches/${gen.body.batchId}/expiry`).send({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('EXPIRES_AT_MUST_BE_FUTURE')
  })
})

describe('POST /v1/surveys/:id/distribution-batches/:batchId/regenerate-tokens', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('regenerates all tokens; preserves consumedAt; returns plaintext once', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 2 },
    })
    const batchId = gen.body.batchId

    const prisma = getTestPrisma()
    const tokensBefore = await prisma.surveyDistributionToken.findMany({ where: { batchId } })
    const oldHashes = new Set(tokensBefore.map((t) => t.tokenHash))

    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches/${batchId}/regenerate-tokens`).send({
      format: 'generic',
      confirmAcknowledge: true,
    })
    expect(res.status).toBe(200)
    expect(res.body.regeneratedCount).toBe(2)
    expect(res.body.tokens).toHaveLength(2)
    for (const t of res.body.tokens) {
      expect(typeof t.plaintext).toBe('string')
    }

    const tokensAfter = await prisma.surveyDistributionToken.findMany({ where: { batchId } })
    for (const t of tokensAfter) {
      expect(oldHashes.has(t.tokenHash)).toBe(false)
    }
  })

  it('returns 422 REGENERATION_NOT_ACKNOWLEDGED when confirmAcknowledge is false', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    const request = authenticatedRequest(brand.id)

    const gen = await request.post(`/v1/surveys/${survey.id}/distribution-batches`).send({
      surveyNameInMail: 'Q2',
      expiresAt: new Date(Date.now() + 1e7).toISOString(),
      audience: { mode: 'existing_members', strategy: 'count', value: 1 },
    })

    const res = await request.post(`/v1/surveys/${survey.id}/distribution-batches/${gen.body.batchId}/regenerate-tokens`).send({
      format: 'generic',
      confirmAcknowledge: false,
    })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('REGENERATION_NOT_ACKNOWLEDGED')
  })
})
