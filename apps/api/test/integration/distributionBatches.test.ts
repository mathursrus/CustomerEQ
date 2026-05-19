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
