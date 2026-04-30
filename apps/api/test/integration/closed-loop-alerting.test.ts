/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  createProgram,
  authenticatedRequest,
  InMemoryQueue,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('Closed-Loop Alerting — alert rules + case management', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  const alertRulePayload = {
    name: 'NPS Detractor Alert',
    surveyTypes: ['NPS'],
    scoreMin: 0,
    scoreMax: 6,
    slackWebhookUrl: 'https://hooks.slack.com/services/test/test/test',
    slackChannelName: '#cx-alerts',
    emailRecipients: ['team@test.com'],
    defaultAssignee: 'cx-lead@test.com',
    assignmentRules: [{ topic: 'shipping', assignee: 'ops@test.com' }],
    slaHours: 4,
  }

  // ---------------------------------------------------------------------------
  // Alert Rules CRUD
  // ---------------------------------------------------------------------------

  // 1. Create alert rule
  // ---------------------------------------------------------------------------

  it('creates an alert rule via POST /v1/alert-rules', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/alert-rules').send(alertRulePayload)

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.name).toBe('NPS Detractor Alert')
    expect(res.body.status).toBe('ACTIVE')
    expect(res.body.brandId).toBe(brand.id)
    expect(res.body.surveyTypes).toEqual(['NPS'])
    expect(res.body.scoreMin).toBe(0)
    expect(res.body.scoreMax).toBe(6)
    expect(res.body.defaultAssignee).toBe('cx-lead@test.com')
    expect(res.body.slaHours).toBe(4)
  })

  // ---------------------------------------------------------------------------
  // 2. List alert rules
  // ---------------------------------------------------------------------------

  it('lists alert rules via GET /v1/alert-rules', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    // Create two alert rules
    await request.post('/v1/alert-rules').send(alertRulePayload)
    await request.post('/v1/alert-rules').send({
      ...alertRulePayload,
      name: 'CSAT Low Score Alert',
      surveyTypes: ['CSAT'],
    })

    const res = await request.get('/v1/alert-rules')

    expect(res.status).toBe(200)
    const rules = res.body.rules ?? res.body.alertRules ?? res.body
    expect(Array.isArray(rules)).toBe(true)
    expect(rules.length).toBeGreaterThanOrEqual(2)
    const names = rules.map((r: { name: string }) => r.name)
    expect(names).toContain('NPS Detractor Alert')
    expect(names).toContain('CSAT Low Score Alert')
  })

  // ---------------------------------------------------------------------------
  // 3. Get alert rule detail with masked credentials
  // ---------------------------------------------------------------------------

  it('gets alert rule detail with masked credentials via GET /v1/alert-rules/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/alert-rules').send(alertRulePayload)
    const ruleId = createRes.body.id

    const res = await request.get(`/v1/alert-rules/${ruleId}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(ruleId)
    expect(res.body.name).toBe('NPS Detractor Alert')
    // Webhook URL should be masked in detail response
    if (res.body.slackWebhookUrl) {
      expect(res.body.slackWebhookUrl).not.toBe(
        'https://hooks.slack.com/services/test/test/test',
      )
      expect(res.body.slackWebhookUrl).toMatch(/\*+/)
    }
  })

  // ---------------------------------------------------------------------------
  // 4. Update an alert rule
  // ---------------------------------------------------------------------------

  it('updates an alert rule via PATCH /v1/alert-rules/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/alert-rules').send(alertRulePayload)
    const ruleId = createRes.body.id

    const res = await request.patch(`/v1/alert-rules/${ruleId}`).send({
      name: 'Updated Detractor Alert',
      scoreMax: 5,
      slaHours: 2,
    })

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(ruleId)
    expect(res.body.name).toBe('Updated Detractor Alert')
    expect(res.body.scoreMax).toBe(5)
    expect(res.body.slaHours).toBe(2)
  })

  // ---------------------------------------------------------------------------
  // 4a. Webhook-mask preservation (Issue #157)
  //
  // The admin UI loads masked webhook URLs and leaves them blank on the form.
  // When the user saves without typing a new URL, the client omits the key
  // from the PATCH body so the DB value is preserved. Verify the end-to-end
  // contract: omitting the key does not null the column.
  // ---------------------------------------------------------------------------

  it('preserves slackWebhookUrl when PATCH omits the key (issue #157 mask-round-trip)', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/alert-rules').send(alertRulePayload)
    const ruleId = createRes.body.id

    // PATCH without slackWebhookUrl in the body — should preserve the existing value.
    const patchRes = await request.patch(`/v1/alert-rules/${ruleId}`).send({
      name: 'Renamed',
    })
    expect(patchRes.status).toBe(200)

    // GET the rule again — masked URL should still be present (not null).
    const getRes = await request.get(`/v1/alert-rules/${ruleId}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.slackWebhookUrl).not.toBeNull()
    expect(getRes.body.slackWebhookUrl).toMatch(/\*+/)
    // Last 8 chars of the original ('test/test') should still match the mask.
    expect(getRes.body.slackWebhookUrl).toMatch(/est\/test$/)
  })

  it('clears slackWebhookUrl when PATCH sends null explicitly (issue #157)', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/alert-rules').send(alertRulePayload)
    const ruleId = createRes.body.id

    const patchRes = await request.patch(`/v1/alert-rules/${ruleId}`).send({
      slackWebhookUrl: null,
    })
    expect(patchRes.status).toBe(200)

    const getRes = await request.get(`/v1/alert-rules/${ruleId}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.slackWebhookUrl).toBeNull()
  })

  it('replaces slackWebhookUrl when PATCH sends a new URL (issue #157)', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/alert-rules').send(alertRulePayload)
    const ruleId = createRes.body.id

    const newUrl = 'https://hooks.slack.com/services/new/webhook/12345678'
    const patchRes = await request.patch(`/v1/alert-rules/${ruleId}`).send({
      slackWebhookUrl: newUrl,
    })
    expect(patchRes.status).toBe(200)

    const getRes = await request.get(`/v1/alert-rules/${ruleId}`)
    expect(getRes.status).toBe(200)
    // Masked, but should reflect the NEW last-8 chars — not the original.
    expect(getRes.body.slackWebhookUrl).toMatch(/\*+/)
    expect(getRes.body.slackWebhookUrl).toMatch(/12345678$/)
  })

  // ---------------------------------------------------------------------------
  // 5. Activate / pause a rule
  // ---------------------------------------------------------------------------

  it('activates and pauses a rule via PATCH /v1/alert-rules/:id/status', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/alert-rules').send(alertRulePayload)
    const ruleId = createRes.body.id

    // Pause
    const pauseRes = await request
      .patch(`/v1/alert-rules/${ruleId}/status`)
      .send({ status: 'PAUSED' })

    expect(pauseRes.status).toBe(200)
    expect(pauseRes.body.status).toBe('PAUSED')

    // Re-activate
    const activateRes = await request
      .patch(`/v1/alert-rules/${ruleId}/status`)
      .send({ status: 'ACTIVE' })

    expect(activateRes.status).toBe(200)
    expect(activateRes.body.status).toBe('ACTIVE')
  })

  // ---------------------------------------------------------------------------
  // 6. Delete a rule
  // ---------------------------------------------------------------------------

  it('deletes a rule via DELETE /v1/alert-rules/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/alert-rules').send(alertRulePayload)
    const ruleId = createRes.body.id

    const deleteRes = await request.delete(`/v1/alert-rules/${ruleId}`).set('Content-Type', 'text/plain')
    expect([200, 204]).toContain(deleteRes.status)

    // Verify it's gone
    const getRes = await request.get(`/v1/alert-rules/${ruleId}`)
    expect(getRes.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // 7. Reject invalid alert rule (empty name)
  // ---------------------------------------------------------------------------

  it('rejects invalid alert rule (empty name) with 422', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/alert-rules').send({
      ...alertRulePayload,
      name: '',
    })

    expect(res.status).toBe(422)
    expect(res.body.error).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Case Management
  // ---------------------------------------------------------------------------

  // 8. List cases (empty initially)
  // ---------------------------------------------------------------------------

  it('lists cases (empty initially) via GET /v1/cases', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.get('/v1/cases')

    expect(res.status).toBe(200)
    const cases = res.body.cases ?? res.body
    expect(Array.isArray(cases)).toBe(true)
    expect(cases).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // 8c. List cases with survey data (Bug Repro)
  // ---------------------------------------------------------------------------

  it('lists cases with survey response data via GET /v1/cases', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    const program = await createProgram({ brandId: brand.id })

    const member = await prisma.member.create({
      data: { brandId: brand.id, email: 'survey-member@test.com' },
    })

    const survey = await prisma.survey.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'List Survey',
        type: 'NPS',
        questions: [],
      }
    })

    const surveyResponse = await prisma.surveyResponse.create({
      data: {
        brandId: brand.id,
        surveyId: survey.id,
        memberId: member.id,
        score: 5,
        sentiment: -0.2,
        topics: ['price'],
        answers: { q1: 'Way too expensive' }
      }
    })

    const alertRule = await prisma.alertRule.create({
      data: {
        brandId: brand.id,
        name: 'List Rule',
        defaultAssignee: 'ops@test.com',
      },
    })

    const caseRecord = await prisma.caseFollowUp.create({
      data: {
        brandId: brand.id,
        alertRuleId: alertRule.id,
        surveyResponseId: surveyResponse.id,
        memberId: member.id,
        status: 'OPEN',
        assignee: 'ops@test.com',
        priority: 'MEDIUM',
      },
    })

    const res = await request.get('/v1/cases')

    expect(res.status).toBe(200)
    const cases = res.body.cases ?? res.body
    expect(cases).toHaveLength(1)

    // UI expects these properties
    expect(cases[0].id).toBe(caseRecord.id)
    expect(cases[0].score).toBe(5)
    expect(cases[0].surveyName).toBe('List Survey')
    expect(cases[0].feedback).toBe('Way too expensive')
  })

  // ---------------------------------------------------------------------------
  // 8b. Get case detail with survey data (Bug Repro)
  // ---------------------------------------------------------------------------

  it('gets case detail with survey response data via GET /v1/cases/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    const program = await createProgram({ brandId: brand.id })

    const member = await prisma.member.create({
      data: { brandId: brand.id, email: 'case-detail-member@test.com' },
    })

    // Create survey and response
    const survey = await prisma.survey.create({
      data: {
        brandId: brand.id,
        programId: program.id,
        name: 'NPS Survey',
        type: 'NPS',
        questions: [],
      }
    })

    const surveyResponse = await prisma.surveyResponse.create({
      data: {
        brandId: brand.id,
        surveyId: survey.id,
        memberId: member.id,
        score: 4,
        sentiment: -0.8,
        topics: ['shipping', 'pricing'],
        answers: { q1: 'Terrible experience' }
      }
    })

    const alertRule = await prisma.alertRule.create({
      data: {
        brandId: brand.id,
        name: 'Test Rule',
        defaultAssignee: 'cx-lead@test.com',
      },
    })

    const caseRecord = await prisma.caseFollowUp.create({
      data: {
        brandId: brand.id,
        alertRuleId: alertRule.id,
        surveyResponseId: surveyResponse.id,
        memberId: member.id,
        status: 'OPEN',
        assignee: 'cx-lead@test.com',
        priority: 'HIGH',
      },
    })

    const res = await request.get(`/v1/cases/${caseRecord.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(caseRecord.id)
    expect(res.body.score).toBe(4)
    expect(res.body.sentiment).toBe(-0.8)
    expect(res.body.topics).toEqual(['shipping', 'pricing'])
    expect(res.body.feedback).toBe('Terrible experience')  // mapped from answers or summary
  })

  // ---------------------------------------------------------------------------
  // 9. Update case status
  // ---------------------------------------------------------------------------

  it('updates case status via PATCH /v1/cases/:id/status', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    // Create an alert rule in the DB
    const alertRule = await prisma.alertRule.create({
      data: {
        brandId: brand.id,
        name: 'Test Rule',
        defaultAssignee: 'cx-lead@test.com',
      },
    })

    // Create a case directly via prisma
    const caseRecord = await prisma.caseFollowUp.create({
      data: {
        brandId: brand.id,
        alertRuleId: alertRule.id,
        memberId: 'fake-member-id',
        status: 'OPEN',
        assignee: 'cx-lead@test.com',
        priority: 'HIGH',
      },
    })

    const res = await request
      .patch(`/v1/cases/${caseRecord.id}/status`)
      .send({ status: 'CONTACTED' })

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(caseRecord.id)
    expect(res.body.status).toBe('CONTACTED')
  })

  // ---------------------------------------------------------------------------
  // 10. Add a note to a case
  // ---------------------------------------------------------------------------

  it('adds a note to a case via POST /v1/cases/:id/notes', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    const alertRule = await prisma.alertRule.create({
      data: {
        brandId: brand.id,
        name: 'Test Rule',
        defaultAssignee: 'cx-lead@test.com',
      },
    })

    const caseRecord = await prisma.caseFollowUp.create({
      data: {
        brandId: brand.id,
        alertRuleId: alertRule.id,
        memberId: 'fake-member-id',
        status: 'OPEN',
        assignee: 'cx-lead@test.com',
        priority: 'MEDIUM',
      },
    })

    const res = await request
      .post(`/v1/cases/${caseRecord.id}/notes`)
      .send({ text: 'Called customer, left voicemail', author: 'cx-lead@test.com' })

    expect(res.status).toBe(200)
    expect(res.body.notes).toBeDefined()
    expect(Array.isArray(res.body.notes)).toBe(true)
    const lastNote = res.body.notes[res.body.notes.length - 1]
    expect(lastNote.text).toBe('Called customer, left voicemail')
    expect(lastNote.author).toBe('cx-lead@test.com')
  })

  // ---------------------------------------------------------------------------
  // 11. Filter cases by status
  // ---------------------------------------------------------------------------

  it('filters cases by status via GET /v1/cases?status=OPEN', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    const alertRule = await prisma.alertRule.create({
      data: {
        brandId: brand.id,
        name: 'Test Rule',
        defaultAssignee: 'cx-lead@test.com',
      },
    })

    // Create one OPEN and one RESOLVED case
    await prisma.caseFollowUp.create({
      data: {
        brandId: brand.id,
        alertRuleId: alertRule.id,
        memberId: 'member-1',
        status: 'OPEN',
        assignee: 'cx-lead@test.com',
        priority: 'HIGH',
      },
    })

    await prisma.caseFollowUp.create({
      data: {
        brandId: brand.id,
        alertRuleId: alertRule.id,
        memberId: 'member-2',
        status: 'RESOLVED',
        assignee: 'cx-lead@test.com',
        priority: 'LOW',
        resolvedAt: new Date(),
      },
    })

    const res = await request.get('/v1/cases?status=OPEN')

    expect(res.status).toBe(200)
    const cases = res.body.cases ?? res.body
    expect(Array.isArray(cases)).toBe(true)
    expect(cases.length).toBe(1)
    expect(cases[0].status).toBe('OPEN')
  })
})
