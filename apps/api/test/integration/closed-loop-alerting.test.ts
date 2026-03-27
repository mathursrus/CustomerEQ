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
        surveyResponseId: 'fake-response-id',
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
        surveyResponseId: 'fake-response-id',
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
        surveyResponseId: 'response-1',
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
        surveyResponseId: 'response-2',
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
