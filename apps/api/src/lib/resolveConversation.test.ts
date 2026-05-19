import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks — must be declared before any module imports.
const prismaMock = vi.hoisted(() => {
  const cSATResponse = { create: vi.fn() }
  const conversation = { findUniqueOrThrow: vi.fn(), update: vi.fn() }
  return {
    cSATResponse,
    conversation,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ cSATResponse, conversation }),
    ),
  }
})
vi.mock('@customerEQ/database', () => ({ prisma: prismaMock }))

const queuesMock = vi.hoisted(() => ({ enqueueEvent: vi.fn() }))
vi.mock('../queues/bullmq.js', () => queuesMock)

import { resolveConversation } from './resolveConversation.js'

beforeEach(() => {
  prismaMock.conversation.findUniqueOrThrow.mockReset()
  prismaMock.conversation.update.mockReset()
  prismaMock.cSATResponse.create.mockReset()
  prismaMock.$transaction.mockReset().mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ cSATResponse: prismaMock.cSATResponse, conversation: prismaMock.conversation }),
  )
  queuesMock.enqueueEvent.mockReset()
})

// ---------------------------------------------------------------------------
// Test 1: AGENT path — identified member → RESOLVED + loyalty event emitted
// ---------------------------------------------------------------------------
describe('resolveConversation — AGENT path', () => {
  it('resolves an identified conversation and emits a loyalty event', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv1',
      brandId: 'brand1',
      memberId: 'member1',
      status: 'ACTIVE',
      csatResponse: null,
    })
    prismaMock.conversation.update.mockResolvedValue({})

    const result = await resolveConversation({
      conversationId: 'conv1',
      source: 'AGENT',
    })

    expect(result.conversationId).toBe('conv1')
    expect(result.resolutionSource).toBe('AGENT')
    expect(result.loyaltyEventEmitted).toBe(true)
    expect(prismaMock.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv1' },
        data: expect.objectContaining({ status: 'RESOLVED', resolutionSource: 'AGENT' }),
      }),
    )
    expect(queuesMock.enqueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: 'brand1',
        memberId: 'member1',
        eventType: 'cx.ticket_resolved',
        idempotencyKey: 'cx.ticket_resolved:conv1',
      }),
    )
  })

  // -------------------------------------------------------------------------
  // Test 2: AGENT path — anonymous conversation (memberId null) → no loyalty event
  // -------------------------------------------------------------------------
  it('resolves an anonymous conversation without emitting a loyalty event', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv-anon',
      brandId: 'brand1',
      memberId: null,
      status: 'ACTIVE',
      csatResponse: null,
    })
    prismaMock.conversation.update.mockResolvedValue({})

    const result = await resolveConversation({
      conversationId: 'conv-anon',
      source: 'AGENT',
    })

    expect(result.loyaltyEventEmitted).toBe(false)
    expect(queuesMock.enqueueEvent).not.toHaveBeenCalled()
    expect(result.resolutionSource).toBe('AGENT')
  })
})

// ---------------------------------------------------------------------------
// Test 3: AI_TIMEOUT path — identified → RESOLVED + loyalty event
// ---------------------------------------------------------------------------
describe('resolveConversation — AI_TIMEOUT path', () => {
  it('resolves via AI_TIMEOUT and emits a loyalty event for an identified member', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv2',
      brandId: 'brand2',
      memberId: 'member2',
      status: 'WAITING_ON_CUSTOMER',
      csatResponse: null,
    })
    prismaMock.conversation.update.mockResolvedValue({})

    const result = await resolveConversation({
      conversationId: 'conv2',
      source: 'AI_TIMEOUT',
    })

    expect(result.resolutionSource).toBe('AI_TIMEOUT')
    expect(result.loyaltyEventEmitted).toBe(true)
    expect(queuesMock.enqueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: 'brand2',
        memberId: 'member2',
        eventType: 'cx.ticket_resolved',
        idempotencyKey: 'cx.ticket_resolved:conv2',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Test 4: CSAT THUMBS_UP — writes CSATResponse + RESOLVED + loyalty event
// ---------------------------------------------------------------------------
describe('resolveConversation — CSAT THUMBS_UP', () => {
  it('creates a CSATResponse, resolves, and emits loyalty event on THUMBS_UP', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv3',
      brandId: 'brand3',
      memberId: 'member3',
      status: 'ACTIVE',
      csatResponse: null,
    })
    prismaMock.cSATResponse.create.mockResolvedValue({ id: 'csat1' })
    prismaMock.conversation.update.mockResolvedValue({})

    const result = await resolveConversation({
      conversationId: 'conv3',
      source: 'CSAT',
      csat: { rating: 'THUMBS_UP', comment: 'Great support!' },
    })

    expect(result.resolutionSource).toBe('CSAT')
    expect(result.loyaltyEventEmitted).toBe(true)
    expect(prismaMock.cSATResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'conv3',
          brandId: 'brand3',
          rating: 'THUMBS_UP',
          comment: 'Great support!',
        }),
      }),
    )
    expect(queuesMock.enqueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'cx.ticket_resolved', memberId: 'member3' }),
    )
  })
})

// ---------------------------------------------------------------------------
// Test 5: CSAT THUMBS_DOWN — writes CSATResponse but DOES NOT resolve
//         status → WAITING_ON_CUSTOMER, no loyalty event
// ---------------------------------------------------------------------------
describe('resolveConversation — CSAT THUMBS_DOWN', () => {
  it('creates CSATResponse and flips status back to WAITING_ON_CUSTOMER; no loyalty event', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv4',
      brandId: 'brand4',
      memberId: 'member4',
      status: 'ACTIVE',
      csatResponse: null,
    })
    prismaMock.cSATResponse.create.mockResolvedValue({ id: 'csat2' })
    prismaMock.conversation.update.mockResolvedValue({})

    const result = await resolveConversation({
      conversationId: 'conv4',
      source: 'CSAT',
      csat: { rating: 'THUMBS_DOWN' },
    })

    expect(result.loyaltyEventEmitted).toBe(false)
    expect(queuesMock.enqueueEvent).not.toHaveBeenCalled()
    // The final update (reopen) must be called after the transaction
    expect(prismaMock.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv4' },
        data: expect.objectContaining({ status: 'WAITING_ON_CUSTOMER' }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Test 6: Idempotent — already RESOLVED → returns early, no double-emit
// ---------------------------------------------------------------------------
describe('resolveConversation — idempotency', () => {
  it('returns early without emitting or updating when conversation is already RESOLVED', async () => {
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conv5',
      brandId: 'brand5',
      memberId: 'member5',
      status: 'RESOLVED',
      csatResponse: null,
    })

    const result = await resolveConversation({
      conversationId: 'conv5',
      source: 'AGENT',
    })

    expect(result.loyaltyEventEmitted).toBe(false)
    expect(queuesMock.enqueueEvent).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.conversation.update).not.toHaveBeenCalled()
  })
})
