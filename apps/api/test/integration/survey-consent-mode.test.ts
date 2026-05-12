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
 * Issue #241 Slice 2 — Survey consent-mode override endpoint (absorbs #283).
 *
 * Per RFC §API surface, this is the **only** path that writes `Survey.consentMode`,
 * `consentReason`, `consentSuppressedAttestedBy`, `consentSuppressedAttestedAt`.
 * The general PATCH `/v1/surveys/:id` rejects those fields via `.strict()`.
 *
 * Attestation gate (R10): if the requested mode is more permissive than
 * `Brand.consentMode` (i.e., `IMPLIED_ON_SUBMIT` when brand is `EXPLICIT`),
 * the body MUST carry a valid attestation; otherwise 422.
 *
 * Override-to-stricter (R11): no attestation required, but audit row still fires.
 */

describe('PATCH /v1/surveys/:id/consent-mode (Issue #241 Slice 2 / R10 / R11)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  // ─── Happy paths ───────────────────────────────────────────────────────────

  it('allows override-to-stricter (IMPLIED brand → EXPLICIT survey) without attestation', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({ consentMode: 'EXPLICIT', consentReason: 'Tightening for this audience' })

    expect(res.status).toBe(200)
    expect(res.body.survey.consentMode).toBe('EXPLICIT')
    expect(res.body.survey.consentReason).toBe('Tightening for this audience')
    // attestedBy/At populated even on override-to-stricter (audit trail)
    expect(res.body.survey.consentSuppressedAttestedBy).toBeTruthy()
    expect(res.body.survey.consentSuppressedAttestedAt).toBeTruthy()
  })

  it('allows override-to-more-permissive (EXPLICIT brand → IMPLIED survey) with valid attestation', async () => {
    const brand = await createBrand({ consentMode: 'EXPLICIT' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({
        consentMode: 'IMPLIED_ON_SUBMIT',
        consentReason: 'Legal counsel approved for our jurisdiction',
        attestation: { confirmed: true, reason: 'Approved by legal — 2026-05-11' },
      })

    expect(res.status).toBe(200)
    expect(res.body.survey.consentMode).toBe('IMPLIED_ON_SUBMIT')
    expect(res.body.survey.consentSuppressedAttestedBy).toBeTruthy()
  })

  it('clears the override (consentMode: null) so survey inherits Brand.consentMode', async () => {
    const brand = await createBrand({ consentMode: 'EXPLICIT' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    // First set an override (to stricter — no attestation needed)
    await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({ consentMode: 'EXPLICIT', consentReason: 'set then clear' })

    // Then clear it
    const res = await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({ consentMode: null })

    expect(res.status).toBe(200)
    expect(res.body.survey.consentMode).toBeNull()
  })

  // ─── Attestation gate ──────────────────────────────────────────────────────

  it('rejects override-to-more-permissive without attestation (422 ATTESTATION_REQUIRED)', async () => {
    const brand = await createBrand({ consentMode: 'EXPLICIT' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({ consentMode: 'IMPLIED_ON_SUBMIT', consentReason: 'no attestation block here' })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('ATTESTATION_REQUIRED')
    expect(res.body.details).toMatchObject({
      brandMode: 'EXPLICIT',
      requestedMode: 'IMPLIED_ON_SUBMIT',
    })
  })

  it('rejects attestation with confirmed=false (422)', async () => {
    const brand = await createBrand({ consentMode: 'EXPLICIT' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({
        consentMode: 'IMPLIED_ON_SUBMIT',
        consentReason: 'reason',
        attestation: { confirmed: false, reason: 'still thinking' },
      })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('ATTESTATION_REQUIRED')
  })

  it('rejects attestation with empty reason (422 via Zod)', async () => {
    const brand = await createBrand({ consentMode: 'EXPLICIT' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({
        consentMode: 'IMPLIED_ON_SUBMIT',
        consentReason: 'reason',
        attestation: { confirmed: true, reason: '' },
      })

    expect(res.status).toBe(422)
  })

  // ─── Validation ────────────────────────────────────────────────────────────

  it('rejects consentReason > 500 chars (Zod)', async () => {
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({ consentMode: 'EXPLICIT', consentReason: 'X'.repeat(501) })

    expect(res.status).toBe(422)
  })

  it('returns 404 for a survey belonging to a different brand', async () => {
    const brandA = await createBrand()
    const brandB = await createBrand()
    const program = await createProgram({ brandId: brandA.id })
    const survey = await createSurvey({ brandId: brandA.id, programId: program.id })

    const request = authenticatedRequest(brandB.id)
    const res = await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({ consentMode: 'EXPLICIT' })

    expect(res.status).toBe(404)
  })

  // ─── Audit ─────────────────────────────────────────────────────────────────

  it('writes an AuditEvent row with allowlisted metadata on successful override', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand({ consentMode: 'IMPLIED_ON_SUBMIT' })
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const beforeCount = await prisma.auditEvent.count({ where: { brandId: brand.id } })

    const res = await request
      .patch(`/v1/surveys/${survey.id}/consent-mode`)
      .send({ consentMode: 'EXPLICIT', consentReason: 'tightening' })
    expect(res.status).toBe(200)

    // audit is fire-and-forget — give it a tick
    await new Promise((r) => setTimeout(r, 50))

    const events = await prisma.auditEvent.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: 'desc' },
    })
    expect(events.length).toBeGreaterThan(beforeCount)
    const ev = events[0]!
    expect(ev.action).toBe('survey.consent.update')
    expect(ev.resourceType).toBe('survey')
    expect(ev.resourceId).toBe(survey.id)
    const meta = ev.metadata as Record<string, unknown>
    expect(meta).toHaveProperty('consentMode', 'EXPLICIT')
    expect(meta).toHaveProperty('consentReason', 'tightening')
    expect(meta).toHaveProperty('requestIp')
  })
})

/**
 * Issue #241 Slice 2 — General PATCH /v1/surveys/:id strict() rejection +
 * state-aware allowlist (R29 / R30).
 *
 * `UpdateSurveySchema.strict()` returns 422 with `details.fieldDisallowed` for
 * unknown keys; the consent-override fields (consentMode, consentReason,
 * consentSuppressedAttestedBy, consentSuppressedAttestedAt) are stripped from
 * UpdateSurveySchema and therefore fall through to the strict reject.
 *
 * State-aware allowlist gates per-field editability based on current
 * `Survey.status` and `responsesCount` (for responsePolicy lock).
 */

describe('PATCH /v1/surveys/:id — strict() + state-aware allowlist (Issue #241 Slice 2 / R29 / R30)', () => {
  beforeEach(async () => {
    await seedTestDb()
  })

  // ─── strict() — disallowed fields ──────────────────────────────────────────

  it('rejects consentMode on general PATCH (422 FIELD_DISALLOWED)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({ consentMode: 'IMPLIED_ON_SUBMIT' })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('FIELD_DISALLOWED')
    expect(res.body.field).toBe('consentMode')
  })

  it('rejects consentSuppressedAttestedBy on general PATCH (422 FIELD_DISALLOWED)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({ consentSuppressedAttestedBy: 'spoofed_user' })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('FIELD_DISALLOWED')
  })

  // ─── New fields accepted ────────────────────────────────────────────────

  it('accepts title, description, responsePolicy, consentTextOverride on PATCH', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({
        title: 'How likely are you to recommend us?',
        description: 'Quarterly NPS check',
        responsePolicy: 'ONCE',
        consentTextOverride: 'I agree to the {{privacy}} terms.',
      })

    expect(res.status).toBe(200)
    // PATCH /:id returns the survey flat (existing convention; preserves
    // backwards-compat with admin UI callers). The new /:id/consent-mode
    // endpoint returns it wrapped in `{ survey }` since it's new in Slice 2.
    expect(res.body.title).toBe('How likely are you to recommend us?')
    expect(res.body.description).toBe('Quarterly NPS check')
    expect(res.body.responsePolicy).toBe('ONCE')
    expect(res.body.consentTextOverride).toBe('I agree to the {{privacy}} terms.')
  })

  // ─── State-aware allowlist ─────────────────────────────────────────────────

  it('rejects type change on an ACTIVE survey (409 FIELD_NOT_EDITABLE_IN_STATE)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({ type: 'CSAT' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('FIELD_NOT_EDITABLE_IN_STATE')
    expect(res.body.field).toBe('type')
    expect(res.body.currentState).toBe('ACTIVE')
  })

  it('rejects programId change on a PAUSED survey (409)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'PAUSED' })
    const request = authenticatedRequest(brand.id)

    const otherProgram = await createProgram({ brandId: brand.id })
    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({ programId: otherProgram.id })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('FIELD_NOT_EDITABLE_IN_STATE')
  })

  it('rejects questions change on an ACTIVE survey (409)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({
        questions: [
          { id: 'q1', text: 'New question?', type: 'rating', required: true },
        ],
      })

    expect(res.status).toBe(409)
    expect(res.body.field).toBe('questions')
  })

  it('allows responsePolicy change on a DRAFT survey with zero responses', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({ responsePolicy: 'LATEST_OVERWRITES' })

    expect(res.status).toBe(200)
    expect(res.body.responsePolicy).toBe('LATEST_OVERWRITES')
  })

  it('rejects responsePolicy change on a DRAFT survey with responsesCount > 0 (409)', async () => {
    const prisma = getTestPrisma()
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'DRAFT' })
    // Simulate a responsesCount > 0 (R30 lock)
    await prisma.survey.update({ where: { id: survey.id }, data: { responsesCount: 3 } })

    const request = authenticatedRequest(brand.id)
    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({ responsePolicy: 'LATEST_OVERWRITES' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('FIELD_NOT_EDITABLE_IN_STATE')
    expect(res.body.field).toBe('responsePolicy')
  })

  it('rejects any field change on a STOPPED survey (409)', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'STOPPED' })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({ name: 'New name' })

    expect(res.status).toBe(409)
    expect(res.body.currentState).toBe('STOPPED')
  })

  it('allows title + thankYouMessage updates in ACTIVE state', async () => {
    const brand = await createBrand()
    const program = await createProgram({ brandId: brand.id })
    const survey = await createSurvey({ brandId: brand.id, programId: program.id, status: 'ACTIVE' })
    const request = authenticatedRequest(brand.id)

    const res = await request
      .patch(`/v1/surveys/${survey.id}`)
      .send({ title: 'Updated title', thankYouMessage: 'New thanks!' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated title')
    expect(res.body.thankYouMessage).toBe('New thanks!')
  })
})
