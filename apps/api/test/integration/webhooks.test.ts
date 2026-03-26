/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import {
  seedTestDb,
  createBrand,
  createProgram,
  createConsentedMember,
  authenticatedRequest,
  unauthenticatedRequest,
  InMemoryQueue,
} from '@customerEQ/config/test-utils'

// ---------------------------------------------------------------------------
// Helper: sign a webhook payload to match the API's verification
// ---------------------------------------------------------------------------

/** Salesforce uses base64 HMAC-SHA256 of the raw JSON body */
function signSalesforcePayload(body: unknown, secret: string): string {
  const raw = JSON.stringify(body)
  return crypto.createHmac('sha256', secret).update(raw).digest('base64')
}

describe('Webhooks API — /v1/integrations/webhooks', () => {
  // These must match env vars (or defaults) in the API
  const SALESFORCE_WEBHOOK_SECRET = process.env.SALESFORCE_WEBHOOK_SECRET ?? ''
  const HUBSPOT_WEBHOOK_SECRET = process.env.HUBSPOT_WEBHOOK_SECRET ?? ''

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
      const request = unauthenticatedRequest()

      const body = {
        caseId: 'case_001',
        contactEmail: member.email,
        npsScore: 8,
        comment: 'Very happy',
      }
      const signature = signSalesforcePayload(body, SALESFORCE_WEBHOOK_SECRET)

      const res = await request
        .post('/v1/integrations/webhooks/salesforce')
        .set('X-SFDC-Signature', signature)
        .set('X-Brand-Id', brand.id)
        .set('Content-Type', 'application/json')
        .send(body)

      expect(res.status).toBe(200)
    })

    it('returns 401 when the Salesforce HMAC signature is invalid', async () => {
      const brand = await createBrand()
      const request = unauthenticatedRequest()

      const body = {
        caseId: 'case_bad',
        contactEmail: 'attacker@example.com',
        npsScore: 10,
      }

      const res = await request
        .post('/v1/integrations/webhooks/salesforce')
        .set('X-SFDC-Signature', 'invalid-signature-xxxxxx')
        .set('X-Brand-Id', brand.id)
        .set('Content-Type', 'application/json')
        .send(body)

      expect(res.status).toBe(401)
    })

    it('returns 200 and logs the webhook when the email does not match any member', async () => {
      const brand = await createBrand()
      const request = unauthenticatedRequest()

      const body = {
        caseId: 'case_003',
        contactEmail: 'unknown-member@example.com',
        npsScore: 6,
      }
      const signature = signSalesforcePayload(body, SALESFORCE_WEBHOOK_SECRET)

      const res = await request
        .post('/v1/integrations/webhooks/salesforce')
        .set('X-SFDC-Signature', signature)
        .set('X-Brand-Id', brand.id)
        .set('Content-Type', 'application/json')
        .send(body)

      // Should acknowledge receipt without error (logged but not processed)
      expect(res.status).toBe(200)
    })
  })

  // -------------------------------------------------------------------------
  // POST /v1/integrations/webhooks/hubspot
  // -------------------------------------------------------------------------

  describe('POST /v1/integrations/webhooks/hubspot', () => {
    // HubSpot verification: HMAC-SHA256(method + uri + body + timestamp) as hex
    function makeHubSpotRequest(
      request: ReturnType<typeof unauthenticatedRequest>,
      body: unknown,
      brandId: string,
    ) {
      const method = 'POST'
      const rawBody = JSON.stringify(body)
      const timestamp = Date.now().toString()

      // The URI is constructed by the server as protocol + host + url.
      // For tests via supertest over HTTP to 127.0.0.1, the exact URI is unpredictable.
      // We'll just test that the endpoint exists and returns proper status codes.
      // For signature tests, we test that an INVALID signature returns 401.
      return { rawBody, timestamp, method }
    }

    it('returns 401 when the HubSpot HMAC signature is invalid', async () => {
      const brand = await createBrand()
      const request = unauthenticatedRequest()

      const body = {
        subscriptionType: 'ticket.propertyChange',
        objectId: 12345,
        propertyName: 'hs_pipeline_stage',
        propertyValue: 'resolved',
        contactEmail: 'attacker@example.com',
      }

      const res = await request
        .post('/v1/integrations/webhooks/hubspot')
        .set('X-HubSpot-Signature-v3', 'bad-signature-xxxx')
        .set('X-HubSpot-Request-Timestamp', Date.now().toString())
        .set('X-Brand-Id', brand.id)
        .set('Content-Type', 'application/json')
        .send(body)

      expect(res.status).toBe(401)
    })

    it('returns 401 when HubSpot signature headers are missing', async () => {
      const brand = await createBrand()
      const request = unauthenticatedRequest()

      const body = {
        subscriptionType: 'ticket.propertyChange',
        objectId: 12345,
        propertyName: 'hs_pipeline_stage',
        propertyValue: 'resolved',
        contactEmail: 'test@example.com',
      }

      const res = await request
        .post('/v1/integrations/webhooks/hubspot')
        .set('X-Brand-Id', brand.id)
        .set('Content-Type', 'application/json')
        .send(body)

      // Missing signature headers should result in 401
      expect(res.status).toBe(401)
    })
  })
})
