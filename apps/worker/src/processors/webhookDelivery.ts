import type { Job } from 'bullmq'
import { createHmac } from 'node:crypto'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type { WebhookDeliveryPayload } from '@customerEQ/shared'

const logger = pino({ name: 'webhook-delivery' })

const DELIVERY_TIMEOUT_MS = 10_000

/**
 * Webhook Delivery Processor
 *
 * Loads the endpoint, HMAC-signs the payload (Stripe pattern), POSTs with a
 * 10s timeout, and writes a WebhookDeliveryLog entry. Throws on failure so
 * BullMQ applies the configured retry/backoff policy.
 */
export async function processWebhookDelivery(
  job: Job<WebhookDeliveryPayload>,
): Promise<{ success: boolean; httpStatus?: number; latencyMs: number }> {
  const { webhookEndpointId, brandId, event, caseId, data } = job.data
  const attempt = (job.attemptsMade ?? 0) + 1

  // Load endpoint — deleted endpoints are silently skipped (not a retry-worthy error)
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: webhookEndpointId, brandId },
  })
  if (!endpoint) {
    logger.warn({ webhookEndpointId, brandId }, 'Webhook endpoint not found — skipping delivery')
    return { success: false, latencyMs: 0 }
  }
  if (!endpoint.active) {
    logger.info({ webhookEndpointId }, 'Webhook endpoint inactive — skipping delivery')
    return { success: false, latencyMs: 0 }
  }

  // Build payload
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const requestPayload = {
    id: job.id ?? `inline-${Date.now()}`,
    event,
    timestamp,
    data: { caseId, brandId, ...data },
  }
  const body = JSON.stringify(requestPayload)

  // HMAC-SHA256 sign: sha256=<hmac(timestamp.body)>
  const signedString = `${timestamp}.${body}`
  const signature = `sha256=${createHmac('sha256', endpoint.signingSecret).update(signedString).digest('hex')}`

  // POST with timeout
  const startMs = Date.now()
  let httpStatus: number | undefined
  let responseBody: string | undefined
  let success!: boolean

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CustomerEQ-Signature': signature,
          'X-CustomerEQ-Timestamp': timestamp,
        },
        body,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    httpStatus = res.status
    try {
      responseBody = await res.text()
    } catch {
      // ignore read errors
    }
    success = res.ok
  } catch (err) {
    const latencyMs = Date.now() - startMs
    logger.error({ webhookEndpointId, event, caseId, attempt, err }, 'Webhook delivery fetch failed')

    await prisma.webhookDeliveryLog.create({
      data: {
        webhookEndpointId,
        brandId,
        event,
        caseId,
        success: false,
        attempt,
        requestPayload: requestPayload as never,
        responseBody: err instanceof Error ? err.message : String(err),
        latencyMs,
        deliveredAt: new Date(),
      },
    })

    // Throw so BullMQ retries
    throw err
  }

  const latencyMs = Date.now() - startMs

  await prisma.webhookDeliveryLog.create({
    data: {
      webhookEndpointId,
      brandId,
      event,
      caseId,
      httpStatus,
      latencyMs,
      success,
      attempt,
      requestPayload: requestPayload as never,
      responseBody: responseBody ?? null,
      deliveredAt: new Date(),
    },
  })

  if (!success) {
    logger.warn({ webhookEndpointId, event, caseId, httpStatus, attempt }, 'Webhook delivery failed — non-2xx response')
    // Throw so BullMQ retries (both 4xx and 5xx — endpoint may be misconfigured or temporarily unavailable)
    throw new Error(`Webhook delivery failed: HTTP ${httpStatus}`)
  }

  logger.info({ webhookEndpointId, event, caseId, httpStatus, latencyMs }, 'Webhook delivered successfully')
  return { success: true, httpStatus, latencyMs }
}

// Export a testable variant that accepts an injected prisma client
// (used by unit tests only — production code uses the module-level prisma import above)
export async function processWebhookDeliveryWithPrisma(
  job: Job<WebhookDeliveryPayload>,
  injectedPrisma: typeof prisma,
): ReturnType<typeof processWebhookDelivery> {
  const { webhookEndpointId, brandId, event, caseId, data } = job.data
  const attempt = (job.attemptsMade ?? 0) + 1

  const endpoint = await injectedPrisma.webhookEndpoint.findFirst({
    where: { id: webhookEndpointId, brandId },
  })
  if (!endpoint) {
    logger.warn({ webhookEndpointId, brandId }, 'Webhook endpoint not found — skipping delivery')
    return { success: false, latencyMs: 0 }
  }
  if (!endpoint.active) {
    logger.info({ webhookEndpointId }, 'Webhook endpoint inactive — skipping delivery')
    return { success: false, latencyMs: 0 }
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const requestPayload = {
    id: job.id ?? `inline-${Date.now()}`,
    event,
    timestamp,
    data: { caseId, brandId, ...data },
  }
  const body = JSON.stringify(requestPayload)
  const signedString = `${timestamp}.${body}`
  const signature = `sha256=${createHmac('sha256', endpoint.signingSecret).update(signedString).digest('hex')}`

  const startMs = Date.now()
  let httpStatus: number | undefined
  let responseBody: string | undefined
  let success!: boolean

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CustomerEQ-Signature': signature,
          'X-CustomerEQ-Timestamp': timestamp,
        },
        body,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
    httpStatus = res.status
    try { responseBody = await res.text() } catch { /* ignore */ }
    success = res.ok
  } catch (err) {
    const latencyMs = Date.now() - startMs
    logger.error({ webhookEndpointId, event, caseId, attempt, err }, 'Webhook delivery fetch failed')
    await injectedPrisma.webhookDeliveryLog.create({
      data: { webhookEndpointId, brandId, event, caseId, success: false, attempt, requestPayload: requestPayload as never, responseBody: err instanceof Error ? err.message : String(err), latencyMs, deliveredAt: new Date() },
    })
    throw err
  }

  const latencyMs = Date.now() - startMs
  await injectedPrisma.webhookDeliveryLog.create({
    data: { webhookEndpointId, brandId, event, caseId, httpStatus, latencyMs, success, attempt, requestPayload: requestPayload as never, responseBody: responseBody ?? null, deliveredAt: new Date() },
  })
  if (!success) throw new Error(`Webhook delivery failed: HTTP ${httpStatus}`)
  return { success: true, httpStatus, latencyMs }
}
