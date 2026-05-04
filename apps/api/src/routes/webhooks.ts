import type { FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import { enqueueEvent, enqueueExternalSignalIngestion } from '../queues/bullmq.js'
import type { InternalCxEvent } from '@customerEQ/shared'

interface SalesforceNPSPayload {
  caseId?: string
  surveyResponseId?: string
  contactEmail: string
  npsScore: number
  comment?: string
  [key: string]: unknown
}

interface HubSpotWebhookPayload {
  subscriptionType: string
  objectId: number
  propertyValue?: { email?: string; [key: string]: unknown }
  contactEmail?: string
  [key: string]: unknown
}

export function verifySalesforceSignature(
  rawBody: Buffer,
  sig: string,
  secret: string,
): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64')
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, expectedBuf)
  } catch {
    return false
  }
}

export function verifyHubSpotSignature(
  method: string,
  uri: string,
  body: string,
  ts: string,
  sig: string,
  secret: string,
): boolean {
  try {
    const payload = method + uri + body + ts
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, expectedBuf)
  } catch {
    return false
  }
}

function safeSecretEquals(actual: string, expected: string): boolean {
  try {
    // Use HMAC to normalize both values to the same length,
    // preventing length-timing leaks in the comparison.
    const key = 'constant-length-comparison-key'
    const actualHmac = crypto.createHmac('sha256', key).update(actual).digest()
    const expectedHmac = crypto.createHmac('sha256', key).update(expected).digest()
    return crypto.timingSafeEqual(actualHmac, expectedHmac)
  } catch {
    return false
  }
}

export function normalizeSalesforcePayload(body: SalesforceNPSPayload): InternalCxEvent {
  return {
    type: 'cx.nps_submitted',
    externalId: body.caseId ?? body.surveyResponseId ?? 'unknown',
    memberEmail: body.contactEmail,
    payload: {
      nps_score: body.npsScore,
      comment: body.comment,
    },
  }
}

export function normalizeHubSpotPayload(body: HubSpotWebhookPayload): InternalCxEvent {
  const type =
    body.subscriptionType === 'deal.propertyChange'
      ? 'cx.deal_closed'
      : body.subscriptionType === 'ticket.propertyChange'
        ? 'cx.ticket_resolved'
        : 'cx.unknown'

  return {
    type,
    externalId: String(body.objectId),
    memberEmail:
      (body.propertyValue?.email as string | undefined) ??
      body.contactEmail ??
      '',
    payload: body as Record<string, unknown>,
  }
}

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/integrations/webhooks/salesforce
  fastify.post(
    '/integrations/webhooks/salesforce',
    { config: { public: true } },
    async (request, reply) => {
      const sig = request.headers['x-sfdc-signature'] as string | undefined
      const secret = process.env.CEQ_SALESFORCE_WEBHOOK_SECRET ?? ''
      const allowTestFallbacks = process.env.NODE_ENV !== 'production'

      if (!secret && !allowTestFallbacks) {
        fastify.log.error('CEQ_SALESFORCE_WEBHOOK_SECRET is not configured')
        return reply.status(500).send({ error: 'Webhook endpoint not configured' })
      }

      if (!sig) {
        return reply.status(401).send({ error: 'Missing X-SFDC-Signature header' })
      }

      // Get raw body for HMAC verification
      const rawBody = Buffer.from(JSON.stringify(request.body))
      if (!verifySalesforceSignature(rawBody, sig, secret)) {
        return reply.status(401).send({ error: 'Invalid webhook signature' })
      }

      let normalized: InternalCxEvent
      try {
        normalized = normalizeSalesforcePayload(
          request.body as SalesforceNPSPayload,
        )
      } catch {
        return reply
          .status(400)
          .send({ error: 'Malformed Salesforce webhook payload' })
      }

      if (!normalized.memberEmail) {
        return reply.status(400).send({ error: 'Missing contactEmail in payload' })
      }

      // Look up brand via CEQ_SALESFORCE_BRAND_ID env or header (webhook routes are
      // not authenticated via JWT — brand is determined by the webhook endpoint
      // registration. For MVP, we use a per-brand webhook secret scoped by brandId
      // stored as CEQ_SALESFORCE_BRAND_ID).
      const brandId =
        process.env.CEQ_SALESFORCE_BRAND_ID ??
        (allowTestFallbacks ? (request.headers['x-brand-id'] as string | undefined) : undefined)
      if (!brandId) {
        fastify.log.error('CEQ_SALESFORCE_BRAND_ID is not configured')
        return reply
          .status(500)
          .send({ error: 'Webhook endpoint not configured' })
      }

      // #231 PR2: switch to canonical externalId lookup (R5 case-insensitive).
      // Pre-#231 lookups by email were case-sensitive — `Bob@x.com` and
      // `bob@x.com` would resolve to different members.
      const member = await fastify.prisma.member.findUnique({
        where: { brandId_externalId: { brandId, externalId: normalized.memberEmail.trim().toLowerCase() } },
        select: { id: true, consentGivenAt: true },
      })

      if (!member) {
        fastify.log.warn(
          { email: normalized.memberEmail, brandId },
          'Salesforce webhook: member not found, skipping',
        )
        return reply.status(200).send({
          message: 'Webhook received; member not found — event not enqueued',
        })
      }

      if (!member.consentGivenAt) {
        fastify.log.warn(
          { memberId: member.id },
          'Salesforce webhook: member consent not given, skipping',
        )
        return reply.status(200).send({
          message: 'Webhook received; member consent not given — event not enqueued',
        })
      }

      await enqueueEvent({
        brandId,
        memberId: member.id,
        eventType: normalized.type,
        payload: normalized.payload,
        ingestedAt: new Date().toISOString(),
      })

      return reply.status(200).send({ message: 'Webhook processed successfully' })
    },
  )

  // POST /v1/integrations/webhooks/hubspot
  fastify.post(
    '/integrations/webhooks/hubspot',
    { config: { public: true } },
    async (request, reply) => {
      const sig = request.headers['x-hubspot-signature-v3'] as string | undefined
      const ts = request.headers['x-hubspot-request-timestamp'] as string | undefined
      const secret = process.env.CEQ_HUBSPOT_WEBHOOK_SECRET ?? ''
      const allowTestFallbacks = process.env.NODE_ENV !== 'production'

      if (!secret && !allowTestFallbacks) {
        fastify.log.error('CEQ_HUBSPOT_WEBHOOK_SECRET is not configured')
        return reply.status(500).send({ error: 'Webhook endpoint not configured' })
      }

      if (!sig || !ts) {
        return reply.status(401).send({
          error: 'Missing X-HubSpot-Signature-v3 or X-HubSpot-Request-Timestamp header',
        })
      }

      const method = request.method.toUpperCase()
      const uri = `${request.protocol ?? 'https'}://${request.hostname}${request.url}`
      const body = JSON.stringify(request.body)

      if (!verifyHubSpotSignature(method, uri, body, ts, sig, secret)) {
        return reply.status(401).send({ error: 'Invalid webhook signature' })
      }

      let normalized: InternalCxEvent
      try {
        normalized = normalizeHubSpotPayload(
          request.body as HubSpotWebhookPayload,
        )
      } catch {
        return reply
          .status(400)
          .send({ error: 'Malformed HubSpot webhook payload' })
      }

      if (!normalized.memberEmail) {
        return reply.status(400).send({ error: 'Cannot determine member email from payload' })
      }

      const brandId =
        process.env.CEQ_HUBSPOT_BRAND_ID ??
        (allowTestFallbacks ? (request.headers['x-brand-id'] as string | undefined) : undefined)
      if (!brandId) {
        fastify.log.error('CEQ_HUBSPOT_BRAND_ID is not configured')
        return reply
          .status(500)
          .send({ error: 'Cannot determine brand from webhook request' })
      }

      // #231 PR2: canonical externalId lookup (R5 case-insensitive).
      const member = await fastify.prisma.member.findUnique({
        where: { brandId_externalId: { brandId, externalId: normalized.memberEmail.trim().toLowerCase() } },
        select: { id: true, consentGivenAt: true },
      })

      if (!member) {
        fastify.log.warn(
          { email: normalized.memberEmail, brandId },
          'HubSpot webhook: member not found, skipping',
        )
        return reply.status(200).send({
          message: 'Webhook received; member not found — event not enqueued',
        })
      }

      if (!member.consentGivenAt) {
        fastify.log.warn(
          { memberId: member.id },
          'HubSpot webhook: member consent not given, skipping',
        )
        return reply.status(200).send({
          message: 'Webhook received; member consent not given — event not enqueued',
        })
      }

      await enqueueEvent({
        brandId,
        memberId: member.id,
        eventType: normalized.type,
        payload: normalized.payload,
        ingestedAt: new Date().toISOString(),
      })

      return reply.status(200).send({ message: 'Webhook processed successfully' })
    },
  )

  fastify.post<{ Params: { sourceId: string } }>(
    '/integrations/webhooks/external-signals/:sourceId',
    { config: { public: true } },
    async (request, reply) => {
      const source = await fastify.prisma.externalSignalSource.findUnique({
        where: { id: request.params.sourceId },
        select: {
          id: true,
          brandId: true,
          enabled: true,
          credentialRef: true,
        },
      })

      if (!source || !source.enabled) {
        return reply.status(404).send({ error: 'External signal source not found' })
      }

      if (source.credentialRef) {
        const providedSecret = request.headers['x-source-secret'] as string | undefined
        if (!providedSecret || !safeSecretEquals(providedSecret, source.credentialRef)) {
          return reply.status(401).send({ error: 'Invalid source secret' })
        }
      }

      await enqueueExternalSignalIngestion({
        brandId: source.brandId,
        sourceId: source.id,
        deliveries: Array.isArray(request.body)
          ? (request.body as Record<string, unknown>[])
          : [request.body as Record<string, unknown>],
        receivedAt: new Date().toISOString(),
        deliveryType: 'webhook',
      })

      return reply.status(202).send({ message: 'External signal delivery accepted' })
    },
  )
}

export default webhooksRoutes
