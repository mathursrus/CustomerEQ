/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createSurvey,
  createMember,
  authenticatedRequest,
  unauthenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

// Issue #378 — token-authorized public submit + token-status.
//
// Uses the admin POST /distribution-batches to mint a real batch + tokens
// (rather than constructing rows directly), so the test exercises the full
// path including hash-at-rest semantics.

async function generateBatchAndCaptureTokens(
  brandId: string,
  surveyId: string,
): Promise<{ batchId: string; tokens: { plaintext: string; memberId: string }[] }> {
  const adminRequest = authenticatedRequest(brandId)
  const res = await adminRequest.post(`/v1/surveys/${surveyId}/distribution-batches`).send({
    surveyNameInMail: 'Test wave',
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    audience: { mode: 'existing_members', strategy: 'count', value: 2 },
  })
  if (res.status !== 201) {
    throw new Error(`Failed to generate batch in test setup: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return {
    batchId: res.body.batchId,
    tokens: res.body.tokens.map((t: { plaintext: string; memberId: string }) => ({
      plaintext: t.plaintext,
      memberId: t.memberId,
    })),
  }
}

describe('GET /v1/public/surveys/:id/token-status (Issue #378)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('returns state=valid for a freshly minted token', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const { tokens } = await generateBatchAndCaptureTokens(brand.id, survey.id)

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest
      .get(`/v1/public/surveys/${survey.id}/token-status`)
      .query({ token: tokens[0].plaintext })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('valid')
    // Body must NOT carry identifying fields.
    expect(JSON.stringify(res.body)).not.toContain('memberId')
    expect(JSON.stringify(res.body)).not.toContain('batchId')
  })

  it('returns state=invalid for a malformed / unknown token', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest
      .get(`/v1/public/surveys/${survey.id}/token-status`)
      .query({ token: 'GARBAGE_TOKEN_VALUE' })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('invalid')
  })

  it('returns state=invalid when the token is missing', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest.get(`/v1/public/surveys/${survey.id}/token-status`)
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('invalid')
  })

  it('returns state=invalid for a token belonging to a different survey', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const surveyA = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const surveyB = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const { tokens } = await generateBatchAndCaptureTokens(brand.id, surveyA.id)

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest
      .get(`/v1/public/surveys/${surveyB.id}/token-status`)
      .query({ token: tokens[0].plaintext })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('invalid')
  })

  it('returns state=expired when token.expiresAt < now', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const { batchId, tokens } = await generateBatchAndCaptureTokens(brand.id, survey.id)
    // Backdate the token's expiry.
    await getTestPrisma().surveyDistributionToken.updateMany({
      where: { batchId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest
      .get(`/v1/public/surveys/${survey.id}/token-status`)
      .query({ token: tokens[0].plaintext })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('expired')
  })

  it('returns state=survey-not-open when parent survey is STOPPED', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const { tokens } = await generateBatchAndCaptureTokens(brand.id, survey.id)

    await getTestPrisma().survey.update({ where: { id: survey.id }, data: { status: 'STOPPED' } })

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest
      .get(`/v1/public/surveys/${survey.id}/token-status`)
      .query({ token: tokens[0].plaintext })
    expect(res.status).toBe(200)
    expect(res.body.state).toBe('survey-not-open')
  })
})

describe('POST /v1/public/surveys/:id/respond — token path (Issue #378)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('accepts a tokenized response and binds distributionBatchId + distributionTokenId', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const { batchId, tokens } = await generateBatchAndCaptureTokens(brand.id, survey.id)

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest.post(`/v1/public/surveys/${survey.id}/respond`).send({
      token: tokens[0].plaintext,
      answers: { q1: 'Great', q2: 9 },
      score: 9,
      channel: 'link',
      consent: true,
    })
    expect(res.status).toBe(201)
    expect(res.body.surveyResponseId).toBeTruthy()

    const prisma = getTestPrisma()
    const responseRow = await prisma.surveyResponse.findUnique({
      where: { id: res.body.surveyResponseId },
      select: { distributionBatchId: true, distributionTokenId: true, memberId: true },
    })
    expect(responseRow?.distributionBatchId).toBe(batchId)
    expect(responseRow?.distributionTokenId).toBeTruthy()
    expect(responseRow?.memberId).toBe(tokens[0].memberId)

    // Token's consumedAt was set in the same transaction.
    const hash = createHash('sha256').update(tokens[0].plaintext).digest('hex')
    const tokenRow = await prisma.surveyDistributionToken.findUnique({
      where: { tokenHash: hash },
      select: { consumedAt: true },
    })
    expect(tokenRow?.consumedAt).toBeTruthy()
  })

  it('rejects a second submit with the same token (409 responded)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      status: 'ACTIVE',
      responsePolicy: 'MULTIPLE',
    })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const { tokens } = await generateBatchAndCaptureTokens(brand.id, survey.id)

    const publicRequest = unauthenticatedRequest()
    const first = await publicRequest.post(`/v1/public/surveys/${survey.id}/respond`).send({
      token: tokens[0].plaintext,
      answers: { q1: 'Good' },
      score: 8,
      channel: 'link',
      consent: true,
    })
    expect(first.status).toBe(201)

    const second = await publicRequest.post(`/v1/public/surveys/${survey.id}/respond`).send({
      token: tokens[0].plaintext,
      answers: { q1: 'Wait' },
      score: 5,
      channel: 'link',
      consent: true,
    })
    expect(second.status).toBe(409)
    expect(second.body.state).toBe('responded')
  })

  it('rejects expired token with 410 (expired)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const { batchId, tokens } = await generateBatchAndCaptureTokens(brand.id, survey.id)
    await getTestPrisma().surveyDistributionToken.updateMany({
      where: { batchId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest.post(`/v1/public/surveys/${survey.id}/respond`).send({
      token: tokens[0].plaintext,
      answers: { q1: 'Late' },
      score: 7,
      channel: 'link',
      consent: true,
    })
    expect(res.status).toBe(410)
    expect(res.body.state).toBe('expired')
  })

  it('rejects token whose parent survey is STOPPED with 410 survey-not-open', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const { tokens } = await generateBatchAndCaptureTokens(brand.id, survey.id)
    await getTestPrisma().survey.update({ where: { id: survey.id }, data: { status: 'STOPPED' } })

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest.post(`/v1/public/surveys/${survey.id}/respond`).send({
      token: tokens[0].plaintext,
      answers: { q1: 'Hello' },
      score: 6,
      channel: 'link',
      consent: true,
    })
    expect(res.status).toBe(410)
    expect(res.body.state).toBe('survey-not-open')
  })

  it('rejects body identifier mismatch with 422 IDENTIFIER_MISMATCH', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    await createMember({ brandId: brand.id })
    await createMember({ brandId: brand.id })
    const { tokens } = await generateBatchAndCaptureTokens(brand.id, survey.id)

    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest.post(`/v1/public/surveys/${survey.id}/respond`).send({
      token: tokens[0].plaintext,
      memberEmail: 'someone-else@example.com',
      answers: { q1: 'Mismatch' },
      score: 6,
      channel: 'link',
      consent: true,
    })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('IDENTIFIER_MISMATCH')
  })
})

describe('POST /v1/public/surveys/trigger — RETIRED in #378', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('no longer accepts requests (route deleted)', async () => {
    // Fastify's auth plugin preHandler runs before route resolution, so an
    // unmatched POST under /v1/public/surveys/* returns 401 (no Authorization
    // header on an unrecognised route). Either 401 or 404 confirms the
    // endpoint is gone — the assertion is that it no longer returns 2xx.
    const publicRequest = unauthenticatedRequest()
    const res = await publicRequest.post(`/v1/public/surveys/trigger`).send({
      memberEmail: 'test@example.com',
      surveyId: 'srv_123',
    })
    expect([401, 404]).toContain(res.status)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('admin integrations endpoint no longer advertises surveyTrigger URL', async () => {
    const brand = await createBrand()
    const adminRequest = authenticatedRequest(brand.id)
    const res = await adminRequest.get('/v1/admin/integrations').send()
    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('surveyTrigger')
  })
})
