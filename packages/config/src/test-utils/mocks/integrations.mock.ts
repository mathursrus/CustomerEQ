import crypto from 'crypto'

/**
 * Creates a test Salesforce NPS webhook payload with a valid HMAC signature.
 */
export function salesforceNpsPayload(
  npsScore: number,
  contactEmail: string,
  secret = 'test_salesforce_secret'
): { body: unknown; headers: Record<string, string> } {
  const body = {
    caseId: 'case_001',
    contactEmail,
    npsScore,
    comment: 'Test NPS response',
    surveyResponseId: 'survey_001',
  }
  const rawBody = JSON.stringify(body)
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')

  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-SFDC-Signature': signature,
    },
  }
}

/**
 * Creates a test HubSpot ticket resolved webhook payload with a valid HMAC signature.
 */
export function hubspotTicketPayload(
  contactEmail: string,
  secret = 'test_hubspot_secret'
): { body: unknown; headers: Record<string, string> } {
  const method = 'POST'
  const uri = '/v1/integrations/webhooks/hubspot'
  const body = {
    subscriptionType: 'ticket.propertyChange',
    objectId: 12345,
    propertyName: 'hs_pipeline_stage',
    propertyValue: { email: contactEmail },
    contactEmail,
  }
  const rawBody = JSON.stringify(body)
  const timestamp = Date.now().toString()
  const sigPayload = method + uri + rawBody + timestamp
  const signature = crypto.createHmac('sha256', secret).update(sigPayload).digest('hex')

  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-HubSpot-Signature-v3': signature,
      'X-HubSpot-Request-Timestamp': timestamp,
    },
  }
}

/**
 * Creates a webhook payload with an INVALID signature for rejection testing.
 */
export function invalidSignatureHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-SFDC-Signature': 'invalid_signature',
    'X-HubSpot-Signature-v3': 'invalid_signature',
  }
}
