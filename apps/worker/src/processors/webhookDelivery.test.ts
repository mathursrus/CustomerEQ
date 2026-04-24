/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { processWebhookDeliveryWithPrisma } from './webhookDelivery.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIGNING_SECRET = 'test-signing-secret-32-chars-long'
const ENDPOINT_ID = 'endpoint-001'
const BRAND_ID = 'brand-001'
const CASE_ID = 'case-001'

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-001',
    attemptsMade: 0,
    data: {
      webhookEndpointId: ENDPOINT_ID,
      brandId: BRAND_ID,
      event: 'case.created',
      caseId: CASE_ID,
      data: { status: 'OPEN' },
    },
    ...overrides,
  }
}

function makePrisma(endpointOverride?: Record<string, unknown> | null) {
  const defaultEndpoint = {
    id: ENDPOINT_ID,
    brandId: BRAND_ID,
    url: 'https://example.com/webhook',
    signingSecret: SIGNING_SECRET,
    active: true,
  }
  return {
    webhookEndpoint: {
      findFirst: vi.fn().mockResolvedValue(
        endpointOverride === null ? null : { ...defaultEndpoint, ...endpointOverride },
      ),
    },
    webhookDeliveryLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-001' }),
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processWebhookDeliveryWithPrisma', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns early without writing a log when endpoint is not found', async () => {
    const prisma = makePrisma(null)
    const result = await processWebhookDeliveryWithPrisma(makeJob() as never, prisma as never)

    expect(result.success).toBe(false)
    expect(result.latencyMs).toBe(0)
    expect(prisma.webhookDeliveryLog.create).not.toHaveBeenCalled()
  })

  it('returns early without writing a log when endpoint is inactive', async () => {
    const prisma = makePrisma({ active: false })
    const result = await processWebhookDeliveryWithPrisma(makeJob() as never, prisma as never)

    expect(result.success).toBe(false)
    expect(result.latencyMs).toBe(0)
    expect(prisma.webhookDeliveryLog.create).not.toHaveBeenCalled()
  })

  it('sends a POST with correct HMAC-SHA256 signature header', async () => {
    let capturedRequestBody = ''
    let capturedTimestamp = ''

    global.fetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
      capturedRequestBody = opts.body as string
      capturedTimestamp = (opts.headers as Record<string, string>)['X-CustomerEQ-Timestamp']
      const sig = (opts.headers as Record<string, string>)['X-CustomerEQ-Signature']
      const expected = `sha256=${createHmac('sha256', SIGNING_SECRET).update(`${capturedTimestamp}.${capturedRequestBody}`).digest('hex')}`
      expect(sig).toBe(expected)
      return { ok: true, status: 200, text: async () => 'OK' }
    }) as never

    const prisma = makePrisma()
    await processWebhookDeliveryWithPrisma(makeJob() as never, prisma as never)

    expect(capturedTimestamp).toBeDefined()
    expect(capturedRequestBody).toContain('"event":"case.created"')
  })

  it('writes a success log on 2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'OK' }) as never

    const prisma = makePrisma()
    const result = await processWebhookDeliveryWithPrisma(makeJob() as never, prisma as never)

    expect(result.success).toBe(true)
    expect(result.httpStatus).toBe(200)
    expect(prisma.webhookDeliveryLog.create).toHaveBeenCalledOnce()
    const logData = prisma.webhookDeliveryLog.create.mock.calls[0][0].data
    expect(logData.success).toBe(true)
    expect(logData.httpStatus).toBe(200)
    expect(logData.event).toBe('case.created')
    expect(logData.caseId).toBe(CASE_ID)
    expect(logData.brandId).toBe(BRAND_ID)
  })

  it('writes a failure log and throws on 4xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' }) as never

    const prisma = makePrisma()
    await expect(
      processWebhookDeliveryWithPrisma(makeJob() as never, prisma as never),
    ).rejects.toThrow('HTTP 400')

    expect(prisma.webhookDeliveryLog.create).toHaveBeenCalledOnce()
    const logData = prisma.webhookDeliveryLog.create.mock.calls[0][0].data
    expect(logData.success).toBe(false)
    expect(logData.httpStatus).toBe(400)
  })

  it('writes a failure log and throws on 5xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => 'Service Unavailable' }) as never

    const prisma = makePrisma()
    await expect(
      processWebhookDeliveryWithPrisma(makeJob() as never, prisma as never),
    ).rejects.toThrow('HTTP 503')

    const logData = prisma.webhookDeliveryLog.create.mock.calls[0][0].data
    expect(logData.success).toBe(false)
    expect(logData.httpStatus).toBe(503)
  })

  it('writes a failure log and throws on network/timeout error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed: connection refused')) as never

    const prisma = makePrisma()
    await expect(
      processWebhookDeliveryWithPrisma(makeJob() as never, prisma as never),
    ).rejects.toThrow('fetch failed')

    expect(prisma.webhookDeliveryLog.create).toHaveBeenCalledOnce()
    const logData = prisma.webhookDeliveryLog.create.mock.calls[0][0].data
    expect(logData.success).toBe(false)
    expect(logData.httpStatus).toBeUndefined()
    expect(logData.responseBody).toContain('fetch failed')
  })

  it('records attempt number as attemptsMade + 1', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'OK' }) as never

    const prisma = makePrisma()
    // attemptsMade=2 means this is the 3rd attempt
    await processWebhookDeliveryWithPrisma({ ...makeJob(), attemptsMade: 2 } as never, prisma as never)

    const logData = prisma.webhookDeliveryLog.create.mock.calls[0][0].data
    expect(logData.attempt).toBe(3)
  })

  it('includes the event type in the signed payload body', async () => {
    let capturedBody = ''
    global.fetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
      capturedBody = opts.body as string
      return { ok: true, status: 200, text: async () => 'OK' }
    }) as never

    const prisma = makePrisma()
    await processWebhookDeliveryWithPrisma(makeJob() as never, prisma as never)

    const parsed = JSON.parse(capturedBody)
    expect(parsed.event).toBe('case.created')
    expect(parsed.data.caseId).toBe(CASE_ID)
  })
})
