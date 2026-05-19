/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockPrisma } from '@customerEQ/config/test-utils'

vi.mock('@customerEQ/database', async () => {
  const { databaseMockFactory } = await import('@customerEQ/config/test-utils')
  return databaseMockFactory()
})

const { deliverNotification } = vi.hoisted(() => ({
  deliverNotification: vi.fn(),
}))

vi.mock('@customerEQ/connectors', () => ({
  deliverNotification,
}))

import { prisma } from '@customerEQ/database'
import { processNotification } from './notifications.js'

const mockPrisma = prisma as unknown as MockPrisma

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      memberId: 'member-001',
      brandId: 'brand-xyz',
      message: 'Your order has shipped!',
      channel: 'email',
      ...overrides,
    },
  }
}

describe('processNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.member.findUnique.mockResolvedValue({ email: 'member@example.com' })
  })

  it('returns the shared delivery result shape', async () => {
    deliverNotification.mockResolvedValue({
      sent: true,
      provider: 'azure-communication-services',
      memberId: 'member-001',
      channel: 'email',
      recipient: 'member@example.com',
      operationId: 'operation-123',
    })

    const result = await processNotification(makeJob() as never)

    expect(result).toEqual({
      sent: true,
      reason: undefined,
      memberId: 'member-001',
      channel: 'email',
    })
  })

  it('looks up the recipient email through Prisma before delivery', async () => {
    deliverNotification.mockImplementation(async (payload, options) => {
      const recipient = await options.resolveRecipientEmail(payload)
      return {
        sent: Boolean(recipient),
        reason: recipient ? undefined : 'recipient_missing',
        provider: 'azure-communication-services',
        memberId: payload.memberId,
        channel: payload.channel,
        recipient: recipient ?? undefined,
      }
    })

    await processNotification(makeJob() as never)

    expect(mockPrisma.member.findUnique).toHaveBeenCalledWith({
      where: { id: 'member-001' },
      select: { email: true },
    })
  })

  it('returns recipient_missing when the member record has no email', async () => {
    mockPrisma.member.findUnique.mockResolvedValue({ email: null })
    deliverNotification.mockImplementation(async (payload, options) => {
      const recipient = await options.resolveRecipientEmail(payload)
      return {
        sent: false,
        reason: recipient ? undefined : 'recipient_missing',
        provider: 'azure-communication-services',
        memberId: payload.memberId,
        channel: payload.channel,
      }
    })

    const result = await processNotification(makeJob() as never)

    expect(result).toEqual({
      sent: false,
      reason: 'recipient_missing',
      memberId: 'member-001',
      channel: 'email',
    })
  })

  it('passes sms payloads through to the shared delivery helper', async () => {
    deliverNotification.mockResolvedValue({
      sent: false,
      reason: 'channel_not_supported',
      provider: 'stub',
      memberId: 'member-001',
      channel: 'sms',
    })

    const result = await processNotification(makeJob({ channel: 'sms' }) as never)

    expect(deliverNotification).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'sms' }),
      expect.objectContaining({ resolveRecipientEmail: expect.any(Function) }),
    )
    expect(result).toEqual({
      sent: false,
      reason: 'channel_not_supported',
      memberId: 'member-001',
      channel: 'sms',
    })
  })
})
