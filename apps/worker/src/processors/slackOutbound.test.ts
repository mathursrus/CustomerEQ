import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks — must be before processor import.
const prismaMock = vi.hoisted(() => ({
  brand: { findUnique: vi.fn() },
}))
vi.mock('@customerEQ/database', () => ({ prisma: prismaMock }))

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', fetchMock)

import { processSlackOutbound } from './slackOutbound.js'

const baseJob = {
  data: {
    brandId: 'brand1',
    conversationId: 'conv1',
    kind: 'DRAFT_READY' as const,
    text: 'AI draft ready for review',
  },
} as never

beforeEach(() => {
  prismaMock.brand.findUnique.mockReset()
  fetchMock.mockReset()
})

describe('slackOutbound processor', () => {
  it('posts to the webhook URL when brand has one configured', async () => {
    prismaMock.brand.findUnique.mockResolvedValue({
      slackSupportWebhookUrl: 'https://hooks.slack.com/test',
      name: 'AcmeCo',
    })
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    await processSlackOutbound(baseJob)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('AcmeCo'),
      }),
    )
  })

  it('skips fetch entirely when brand has no webhook URL configured', async () => {
    prismaMock.brand.findUnique.mockResolvedValue({
      slackSupportWebhookUrl: null,
      name: 'NoBotCo',
    })

    await processSlackOutbound(baseJob)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when the webhook returns a non-ok status so BullMQ retries', async () => {
    prismaMock.brand.findUnique.mockResolvedValue({
      slackSupportWebhookUrl: 'https://hooks.slack.com/test',
      name: 'AcmeCo',
    })
    fetchMock.mockResolvedValue({ ok: false, status: 503 })

    await expect(processSlackOutbound(baseJob)).rejects.toThrow('Slack webhook returned 503')
  })
})
