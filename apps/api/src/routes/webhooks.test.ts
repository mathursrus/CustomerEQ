import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  verifySalesforceSignature,
  verifyHubSpotSignature,
  normalizeSalesforcePayload,
  normalizeHubSpotPayload,
} from './webhooks.js'

const SFDC_SECRET = 'test_salesforce_secret'
const HUBSPOT_SECRET = 'test_hubspot_secret'

function makeSfdcSig(body: string, secret = SFDC_SECRET): string {
  return crypto.createHmac('sha256', secret).update(Buffer.from(body)).digest('base64')
}

function makeHubSpotSig(method: string, uri: string, body: string, ts: string, secret = HUBSPOT_SECRET): string {
  return crypto.createHmac('sha256', secret).update(method + uri + body + ts).digest('hex')
}

describe('verifySalesforceSignature', () => {
  it('returns true for a valid HMAC-SHA256 base64 signature', () => {
    const body = '{"npsScore":4}'
    const sig = makeSfdcSig(body)
    expect(verifySalesforceSignature(Buffer.from(body), sig, SFDC_SECRET)).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    const body = '{"npsScore":4}'
    expect(verifySalesforceSignature(Buffer.from(body), 'invalidsig==', SFDC_SECRET)).toBe(false)
  })

  it('returns false when body has been tampered', () => {
    const originalBody = '{"npsScore":4}'
    const tamperedBody = '{"npsScore":10}'
    const sig = makeSfdcSig(originalBody)
    expect(verifySalesforceSignature(Buffer.from(tamperedBody), sig, SFDC_SECRET)).toBe(false)
  })

  it('returns false for empty signature string', () => {
    const body = '{"npsScore":4}'
    expect(verifySalesforceSignature(Buffer.from(body), '', SFDC_SECRET)).toBe(false)
  })
})

describe('verifyHubSpotSignature', () => {
  it('returns true for a valid HMAC-SHA256 hex signature', () => {
    const method = 'POST'
    const uri = '/v1/integrations/webhooks/hubspot'
    const body = '{"subscriptionType":"ticket.propertyChange"}'
    const ts = '1234567890'
    const sig = makeHubSpotSig(method, uri, body, ts)
    expect(verifyHubSpotSignature(method, uri, body, ts, sig, HUBSPOT_SECRET)).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    expect(verifyHubSpotSignature('POST', '/v1/integrations/webhooks/hubspot', '{}', '123', 'invalidsig', HUBSPOT_SECRET)).toBe(false)
  })

  it('returns false when timestamp is changed', () => {
    const method = 'POST'
    const uri = '/v1/integrations/webhooks/hubspot'
    const body = '{}'
    const ts = '1000'
    const sig = makeHubSpotSig(method, uri, body, ts)
    // Change timestamp
    expect(verifyHubSpotSignature(method, uri, body, '9999', sig, HUBSPOT_SECRET)).toBe(false)
  })
})

describe('normalizeSalesforcePayload', () => {
  it('maps npsScore to cx.nps_submitted event type', () => {
    const payload = { contactEmail: 'user@test.com', npsScore: 4, caseId: 'case_123' }
    const result = normalizeSalesforcePayload(payload)
    expect(result.type).toBe('cx.nps_submitted')
    expect(result.memberEmail).toBe('user@test.com')
    expect(result.externalId).toBe('case_123')
    expect((result.payload as { nps_score: number }).nps_score).toBe(4)
  })

  it('falls back to surveyResponseId when caseId is absent', () => {
    const payload = { contactEmail: 'user@test.com', npsScore: 9, surveyResponseId: 'survey_456' }
    const result = normalizeSalesforcePayload(payload)
    expect(result.externalId).toBe('survey_456')
  })
})

describe('normalizeHubSpotPayload', () => {
  it('maps ticket.propertyChange to cx.ticket_resolved', () => {
    const payload = {
      subscriptionType: 'ticket.propertyChange',
      objectId: 789,
      contactEmail: 'cust@test.com',
    }
    const result = normalizeHubSpotPayload(payload)
    expect(result.type).toBe('cx.ticket_resolved')
    expect(result.externalId).toBe('789')
  })

  it('maps deal.propertyChange to cx.deal_closed', () => {
    const payload = { subscriptionType: 'deal.propertyChange', objectId: 100, contactEmail: 'sales@test.com' }
    const result = normalizeHubSpotPayload(payload)
    expect(result.type).toBe('cx.deal_closed')
  })

  it('maps unknown subscription types to cx.unknown', () => {
    const payload = { subscriptionType: 'contact.creation', objectId: 1, contactEmail: 'x@test.com' }
    const result = normalizeHubSpotPayload(payload)
    expect(result.type).toBe('cx.unknown')
  })

  it('extracts memberEmail from propertyValue.email when present', () => {
    const payload = {
      subscriptionType: 'ticket.propertyChange',
      objectId: 1,
      propertyValue: { email: 'from_property@test.com' },
    }
    const result = normalizeHubSpotPayload(payload)
    expect(result.memberEmail).toBe('from_property@test.com')
  })
})
