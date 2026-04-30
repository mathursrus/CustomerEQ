/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedTestDb,
  createBrand,
  authenticatedRequest,
  InMemoryQueue,
  getTestPrisma,
} from '@customerEQ/config/test-utils'

describe('Outbound Webhooks — endpoint management + delivery hooks', () => {
  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  const endpointPayload = {
    label: 'My CRM Webhook',
    url: 'https://crm.example.com/webhook',
    events: ['case.created', 'case.status_changed'],
  }

  // ---------------------------------------------------------------------------
  // 1. Create endpoint
  // ---------------------------------------------------------------------------

  it('creates a webhook endpoint via POST /v1/webhooks', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/webhooks').send(endpointPayload)

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.label).toBe('My CRM Webhook')
    expect(res.body.url).toBe('https://crm.example.com/webhook')
    expect(res.body.events).toEqual(['case.created', 'case.status_changed'])
    expect(res.body.active).toBe(true)
    // signingSecret is only present on creation response
    expect(res.body.signingSecret).toBeDefined()
    expect(res.body.signingSecret).toMatch(/^[0-9a-f]{64}$/)
  })

  it('rejects endpoint creation with non-HTTPS URL', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/webhooks').send({
      ...endpointPayload,
      url: 'http://crm.example.com/webhook',
    })

    expect(res.status).toBe(422)
    expect(res.body.error).toBeDefined()
  })

  it('rejects endpoint creation with no events', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.post('/v1/webhooks').send({
      ...endpointPayload,
      events: [],
    })

    expect(res.status).toBe(422)
  })

  // ---------------------------------------------------------------------------
  // 2. Signing secret only returned on creation
  // ---------------------------------------------------------------------------

  it('does not return signingSecret in GET /v1/webhooks list', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    await request.post('/v1/webhooks').send(endpointPayload)

    const res = await request.get('/v1/webhooks')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.endpoints)).toBe(true)
    expect(res.body.endpoints.length).toBe(1)
    expect(res.body.endpoints[0].signingSecret).toBeUndefined()
  })

  it('does not return signingSecret in GET /v1/webhooks/:id detail', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/webhooks').send(endpointPayload)
    const id = createRes.body.id

    const res = await request.get(`/v1/webhooks/${id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(id)
    expect(res.body.signingSecret).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // 3. List, get, update, delete
  // ---------------------------------------------------------------------------

  it('lists webhook endpoints via GET /v1/webhooks', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    await request.post('/v1/webhooks').send(endpointPayload)
    await request.post('/v1/webhooks').send({
      ...endpointPayload,
      label: 'Second Endpoint',
      url: 'https://second.example.com/hook',
    })

    const res = await request.get('/v1/webhooks')

    expect(res.status).toBe(200)
    expect(res.body.endpoints).toHaveLength(2)
    const labels = res.body.endpoints.map((e: { label: string }) => e.label)
    expect(labels).toContain('My CRM Webhook')
    expect(labels).toContain('Second Endpoint')
  })

  it('updates a webhook endpoint via PATCH /v1/webhooks/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/webhooks').send(endpointPayload)
    const id = createRes.body.id

    const patchRes = await request.patch(`/v1/webhooks/${id}`).send({
      label: 'Updated Label',
      active: false,
    })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.label).toBe('Updated Label')
    expect(patchRes.body.active).toBe(false)
    expect(patchRes.body.signingSecret).toBeUndefined()
  })

  it('deletes a webhook endpoint via DELETE /v1/webhooks/:id', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/webhooks').send(endpointPayload)
    const id = createRes.body.id

    const deleteRes = await request.delete(`/v1/webhooks/${id}`)
    expect([204, 200]).toContain(deleteRes.status)

    const getRes = await request.get(`/v1/webhooks/${id}`)
    expect(getRes.status).toBe(404)
  })

  it('returns 404 for unknown endpoint', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const res = await request.get('/v1/webhooks/nonexistent-id')
    expect(res.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // 4. Multi-tenant isolation
  // ---------------------------------------------------------------------------

  it('brand A cannot see brand B webhooks', async () => {
    const brandA = await createBrand()
    const brandB = await createBrand()

    const requestA = authenticatedRequest(brandA.id)
    const requestB = authenticatedRequest(brandB.id)

    await requestB.post('/v1/webhooks').send(endpointPayload)

    const res = await requestA.get('/v1/webhooks')
    expect(res.status).toBe(200)
    expect(res.body.endpoints).toHaveLength(0)
  })

  it('brand A cannot delete brand B endpoint', async () => {
    const brandA = await createBrand()
    const brandB = await createBrand()

    const requestA = authenticatedRequest(brandA.id)
    const requestB = authenticatedRequest(brandB.id)

    const createRes = await requestB.post('/v1/webhooks').send(endpointPayload)
    const id = createRes.body.id

    const deleteRes = await requestA.delete(`/v1/webhooks/${id}`)
    expect(deleteRes.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // 5. Delivery log endpoint
  // ---------------------------------------------------------------------------

  it('returns delivery logs via GET /v1/webhooks/:id/deliveries', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    const createRes = await request.post('/v1/webhooks').send(endpointPayload)
    const endpointId = createRes.body.id

    // Seed a delivery log directly
    await prisma.webhookDeliveryLog.create({
      data: {
        webhookEndpointId: endpointId,
        brandId: brand.id,
        event: 'case.created',
        caseId: 'case-abc',
        success: true,
        httpStatus: 200,
        latencyMs: 142,
        attempt: 1,
        requestPayload: { event: 'case.created' },
        responseBody: 'OK',
        deliveredAt: new Date(),
      },
    })

    const res = await request.get(`/v1/webhooks/${endpointId}/deliveries`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.deliveries)).toBe(true)
    expect(res.body.deliveries).toHaveLength(1)
    expect(res.body.deliveries[0].event).toBe('case.created')
    expect(res.body.deliveries[0].success).toBe(true)
    expect(res.body.deliveries[0].httpStatus).toBe(200)
  })

  // ---------------------------------------------------------------------------
  // 6. Test fire endpoint
  // ---------------------------------------------------------------------------

  it('queues a test delivery via POST /v1/webhooks/:id/test', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)

    const createRes = await request.post('/v1/webhooks').send(endpointPayload)
    const id = createRes.body.id

    const res = await request.post(`/v1/webhooks/${id}/test`)

    expect(res.status).toBe(202)
    expect(res.body.queued).toBe(true)

    // Verify it was enqueued
    const queued = InMemoryQueue.getJobs('webhook-delivery')
    expect(queued).toHaveLength(1)
    expect((queued[0].data as { webhookEndpointId: string }).webhookEndpointId).toBe(id)
    expect((queued[0].data as { event: string }).event).toBe('case.created')
  })

  // ---------------------------------------------------------------------------
  // 7. case.status_changed enqueues delivery
  // ---------------------------------------------------------------------------

  it('enqueues case.status_changed delivery when case status is updated', async () => {
    const brand = await createBrand()
    const request = authenticatedRequest(brand.id)
    const prisma = getTestPrisma()

    // Create a webhook endpoint subscribed to case.status_changed
    await prisma.webhookEndpoint.create({
      data: {
        brandId: brand.id,
        label: 'Status Hook',
        url: 'https://example.com/status',
        signingSecret: 'test-secret',
        events: ['case.status_changed'],
        active: true,
      },
    })

    // Create a case
    const alertRule = await prisma.alertRule.create({
      data: { brandId: brand.id, name: 'Test Rule', defaultAssignee: 'ops@test.com' },
    })
    const caseRecord = await prisma.caseFollowUp.create({
      data: {
        brandId: brand.id,
        alertRuleId: alertRule.id,
        memberId: 'fake-member',
        status: 'OPEN',
        assignee: 'ops@test.com',
        priority: 'MEDIUM',
      },
    })

    const res = await request
      .patch(`/v1/cases/${caseRecord.id}/status`)
      .send({ status: 'CONTACTED' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CONTACTED')

    // Delivery should have been enqueued
    const queued = InMemoryQueue.getJobs('webhook-delivery')
    expect(queued.length).toBeGreaterThanOrEqual(1)
    const delivery = queued.find((q) => {
      const d = q.data as { event: string; caseId: string }
      return d.event === 'case.status_changed' && d.caseId === caseRecord.id
    })
    expect(delivery).toBeDefined()
    expect((delivery?.data as { brandId: string }).brandId).toBe(brand.id)
  })
})
