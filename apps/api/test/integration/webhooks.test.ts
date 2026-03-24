/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import {
  setupTestDb,
  teardownTestDb,
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  authenticatedRequest,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'

// ---------------------------------------------------------------------------
// Helper: sign a webhook payload the same way Salesforce / HubSpot does
// ---------------------------------------------------------------------------

function signSalesforcePayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function signHubSpotPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

describe('Webhooks API — /v1/integrations/webhooks', () => {
  const SALESFORCE_WEBHOOK_SECRET = 'test-salesforce-secret'
  const HUBSPOT_WEBHOOK_SECRET = 'test-hubspot-secret'

  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await seedTestDb()
    InMemoryQueue.clear()
  })

  // -------------------------------------------------------------------------
  // POST /v1/integrations/webhooks/salesforce
  // -------------------------------------------------------------------------

  describe('POST /v1/integrations/webhooks/salesforce', () => {
    it('accepts a valid Salesforce webhook with correct HMAC signature and returns 200', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      // Use public request — webhooks are unauthenticated but signature-verified
      const request = await authenticatedRequest(brand.id)

      const payload = JSON.stringify({
        event: 'nps_survey_completed',
        email: member.email,
        brandId: brand.id,
        data: { score: 8, comment: 'Very happy' },
      })
      const signature = signSalesforcePayload(payload, SALESFORCE_WEBHOOK_SECRET)

      const res = await request
        .post('/v1/integrations/webhooks/salesforce')
        .set('x-salesforce-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(res.status).toBe(200)
    })

    it('returns 401 when the Salesforce HMAC signature is invalid', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const payload = JSON.stringify({
        event: 'nps_survey_completed',
        email: 'attacker@example.com',
        brandId: brand.id,
        data: { score: 10 },
      })

      const res = await request
        .post('/v1/integrations/webhooks/salesforce')
        .set('x-salesforce-signature', 'invalid-signature-xxxxxx')
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(res.status).toBe(401)
    })

    it('normalizes a Salesforce NPS payload to the cx.nps_submitted event type', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const request = await authenticatedRequest(brand.id)

      const payload = JSON.stringify({
        event: 'nps_survey_completed',
        email: member.email,
        brandId: brand.id,
        data: { score: 7, comment: 'Good product' },
      })
      const signature = signSalesforcePayload(payload, SALESFORCE_WEBHOOK_SECRET)

      await request
        .post('/v1/integrations/webhooks/salesforce')
        .set('x-salesforce-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload)

      await InMemoryQueue.drain('loyalty-events')

      const jobs = InMemoryQueue.getProcessedJobs('loyalty-events')
      const normalizedJob = jobs.find(
        (j) => j.data.memberId === member.id && j.data.type === 'cx.nps_submitted',
      )

      expect(normalizedJob).toBeDefined()
      expect(normalizedJob!.data.type).toBe('cx.nps_submitted')
      expect(normalizedJob!.data.payload.score).toBe(7)
    })

    it('returns 200 and logs the webhook when the email does not match any member', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const payload = JSON.stringify({
        event: 'nps_survey_completed',
        email: 'unknown-member@example.com',
        brandId: brand.id,
        data: { score: 6 },
      })
      const signature = signSalesforcePayload(payload, SALESFORCE_WEBHOOK_SECRET)

      const res = await request
        .post('/v1/integrations/webhooks/salesforce')
        .set('x-salesforce-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload)

      // Should acknowledge receipt without error (logged but not processed)
      expect(res.status).toBe(200)
    })
  })

  // -------------------------------------------------------------------------
  // POST /v1/integrations/webhooks/hubspot
  // -------------------------------------------------------------------------

  describe('POST /v1/integrations/webhooks/hubspot', () => {
    it('accepts a valid HubSpot webhook with correct HMAC signature and returns 200', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const request = await authenticatedRequest(brand.id)

      const payload = JSON.stringify({
        subscriptionType: 'ticket.propertyChange',
        objectId: 'ticket_001',
        propertyName: 'hs_pipeline_stage',
        propertyValue: 'resolved',
        email: member.email,
        brandId: brand.id,
      })
      const signature = signHubSpotPayload(payload, HUBSPOT_WEBHOOK_SECRET)

      const res = await request
        .post('/v1/integrations/webhooks/hubspot')
        .set('x-hubspot-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(res.status).toBe(200)
    })

    it('returns 401 when the HubSpot HMAC signature is invalid', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const payload = JSON.stringify({
        subscriptionType: 'ticket.propertyChange',
        objectId: 'ticket_bad',
        propertyName: 'hs_pipeline_stage',
        propertyValue: 'resolved',
        email: 'attacker@example.com',
        brandId: brand.id,
      })

      const res = await request
        .post('/v1/integrations/webhooks/hubspot')
        .set('x-hubspot-signature', 'bad-signature-xxxx')
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(res.status).toBe(401)
    })

    it('processes a HubSpot ticket-resolved webhook and enqueues the event', async () => {
      const brand = await createBrand()
      const program = await createProgram({ brandId: brand.id, status: 'ACTIVE' })
      const member = await createConsentedMember({ brandId: brand.id, programId: program.id })
      const request = await authenticatedRequest(brand.id)

      const payload = JSON.stringify({
        subscriptionType: 'ticket.propertyChange',
        objectId: 'ticket_002',
        propertyName: 'hs_pipeline_stage',
        propertyValue: 'resolved',
        email: member.email,
        brandId: brand.id,
      })
      const signature = signHubSpotPayload(payload, HUBSPOT_WEBHOOK_SECRET)

      await request
        .post('/v1/integrations/webhooks/hubspot')
        .set('x-hubspot-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload)

      const jobs = InMemoryQueue.getJobs('loyalty-events')
      const matchingJob = jobs.find((j) => j.data.memberId === member.id)

      expect(matchingJob).toBeDefined()
      expect(matchingJob!.data.type).toBe('cx.ticket_resolved')
    })

    it('returns 200 and logs the webhook when the email does not match any member', async () => {
      const brand = await createBrand()
      const request = await authenticatedRequest(brand.id)

      const payload = JSON.stringify({
        subscriptionType: 'ticket.propertyChange',
        objectId: 'ticket_003',
        propertyName: 'hs_pipeline_stage',
        propertyValue: 'resolved',
        email: 'ghost@example.com',
        brandId: brand.id,
      })
      const signature = signHubSpotPayload(payload, HUBSPOT_WEBHOOK_SECRET)

      const res = await request
        .post('/v1/integrations/webhooks/hubspot')
        .set('x-hubspot-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(res.status).toBe(200)
    })
  })
})
