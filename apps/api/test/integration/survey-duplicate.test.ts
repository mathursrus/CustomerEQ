/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createSurvey,
  authenticatedRequest,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

/**
 * Issue #332 (#241 Slice 2 follow-up) — POST /v1/surveys/:id/duplicate.
 *
 * Clones a survey into a new DRAFT under the same brand. Consent override
 * fields are intentionally reset to brand defaults so any new launch carries
 * a fresh attestation under the operator who launches it (audit-trail
 * integrity — see issue body for the bypass scenario this prevents).
 */

describe('POST /v1/surveys/:id/duplicate (Issue #332)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  it('clones an ACTIVE survey into a new DRAFT under the same brand', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const source = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      name: 'Q2 NPS',
      status: 'ACTIVE',
    })
    const request = authenticatedRequest(brand.id)

    const res = await request.post(`/v1/surveys/${source.id}/duplicate`).send({})

    expect(res.status).toBe(201)
    expect(res.body.id).not.toBe(source.id)
    expect(res.body.brandId).toBe(brand.id)
    expect(res.body.programId).toBe(source.programId)
    expect(res.body.type).toBe(source.type)
    expect(res.body.status).toBe('DRAFT')
    expect(res.body.name).toBe('Q2 NPS (copy)')
  })

  it('resets consent override fields to brand defaults on the clone (audit-bypass guard)', async () => {
    // Brand default is EXPLICIT; source survey was overridden to IMPLIED with
    // a recorded attestation. Clone must NOT inherit either the more-permissive
    // mode or the attestation row — the clone's operator is responsible for
    // re-attesting under their own clerkUserId via PATCH /:id/consent-mode.
    const brand = await createBrand({ consentMode: 'EXPLICIT' })
    const program = await createProgram({ brandId: brand.id })
    const source = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    // Apply override on source
    await request
      .patch(`/v1/surveys/${source.id}/consent-mode`)
      .send({
        consentMode: 'IMPLIED_ON_SUBMIT',
        consentReason: 'Legal approved for this audience',
        attestation: { confirmed: true, reason: 'Approved by legal — 2026-05-11' },
      })

    const sourceAfter = await getTestPrisma().survey.findUnique({ where: { id: source.id } })
    expect(sourceAfter?.consentMode).toBe('IMPLIED_ON_SUBMIT')
    expect(sourceAfter?.consentSuppressedAttestedBy).toBeTruthy()

    const res = await request.post(`/v1/surveys/${source.id}/duplicate`).send({})

    expect(res.status).toBe(201)
    expect(res.body.consentMode).toBeNull()
    expect(res.body.consentReason).toBeNull()
    expect(res.body.consentTextOverride).toBeNull()
    expect(res.body.consentSuppressedAttestedBy).toBeNull()
    expect(res.body.consentSuppressedAttestedAt).toBeNull()
  })

  it('carries over title, description, questions, responsePolicy, thank-you copy/url', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const source = await createSurvey({
      brandId: brand.id,
      programId: program.id,
      name: 'Original',
      title: 'How was your visit?',
      description: 'Q2 post-purchase NPS',
      responsePolicy: 'ONCE',
      thankYouMessage: 'Thanks!',
      thankYouRedirectUrl: 'https://example.com/thanks',
    })
    const request = authenticatedRequest(brand.id)

    const res = await request.post(`/v1/surveys/${source.id}/duplicate`).send({})

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('How was your visit?')
    expect(res.body.description).toBe('Q2 post-purchase NPS')
    expect(res.body.responsePolicy).toBe('ONCE')
    expect(res.body.thankYouMessage).toBe('Thanks!')
    expect(res.body.thankYouRedirectUrl).toBe('https://example.com/thanks')
    expect(Array.isArray(res.body.questions)).toBe(true)
  })

  it('returns 404 when duplicating another brand’s survey', async () => {
    const brandA = await createBrand()
    const programA = await createProgram({ brandId: brandA.id })
    const surveyA = await createSurvey({ brandId: brandA.id, programId: programA.id })
    const brandB = await createBrand()
    const requestAsBrandB = authenticatedRequest(brandB.id)

    const res = await requestAsBrandB.post(`/v1/surveys/${surveyA.id}/duplicate`).send({})

    expect(res.status).toBe(404)
  })

  it('returns 404 when duplicating a soft-deleted survey', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    // DRAFT so DELETE succeeds (ACTIVE would return 409 per state guard).
    const source = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const request = authenticatedRequest(brand.id)

    await request.delete(`/v1/surveys/${source.id}`).send()
    const res = await request.post(`/v1/surveys/${source.id}/duplicate`).send({})

    expect(res.status).toBe(404)
  })
})
