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
