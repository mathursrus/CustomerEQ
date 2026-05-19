import { prisma } from '@customerEQ/database'
import type { LoyaltyEventPayload } from '@customerEQ/shared'

export interface ResolveInput {
  conversationId: string
  source: 'CSAT' | 'AI_TIMEOUT' | 'AGENT'
  csat?: { rating: 'THUMBS_UP' | 'THUMBS_DOWN'; comment?: string | null }
}

export interface ResolveResult {
  conversationId: string
  resolutionSource: 'CSAT' | 'AI_TIMEOUT' | 'AGENT'
  resolvedAt: Date
  loyaltyEventEmitted: boolean
}

/**
 * Dependencies passed in by the caller. `enqueueLoyaltyEvent` is the only
 * piece that varies between api and worker — the api wires up to its own
 * bullmq helper, the worker creates its own Queue. Passing the function in
 * keeps this module free of queue/redis imports and breaks the previous
 * api↔worker workspace dependency cycle.
 */
export interface ResolveConversationDeps {
  enqueueLoyaltyEvent: (payload: LoyaltyEventPayload) => Promise<void>
}

/**
 * Resolve a support conversation. Single source of truth for the
 * CSAT / AI_TIMEOUT / AGENT resolution paths. Previously duplicated at
 * apps/api/src/lib/resolveConversation.ts and apps/worker/src/lib/
 * resolveConversation.ts; collapsed per issue #443.
 */
export async function resolveConversation(
  input: ResolveInput,
  deps: ResolveConversationDeps,
): Promise<ResolveResult> {
  const conv = await prisma.conversation.findUniqueOrThrow({
    where: { id: input.conversationId },
    select: {
      id: true,
      brandId: true,
      memberId: true,
      status: true,
      csatResponse: { select: { id: true } },
    },
  })

  // Idempotency guard — already terminal
  if (conv.status === 'RESOLVED' || conv.status === 'CLOSED') {
    return {
      conversationId: conv.id,
      resolutionSource: input.source,
      resolvedAt: new Date(),
      loyaltyEventEmitted: false,
    }
  }

  const resolvedAt = new Date()

  await prisma.$transaction(async (tx) => {
    if (input.source === 'CSAT' && input.csat && !conv.csatResponse) {
      await tx.cSATResponse.create({
        data: {
          conversationId: conv.id,
          brandId: conv.brandId,
          rating: input.csat.rating,
          comment: input.csat.comment ?? null,
        },
      })
    }
    await tx.conversation.update({
      where: { id: conv.id },
      data: {
        status: 'RESOLVED',
        resolutionSource: input.source,
        resolvedAt,
      },
    })
  })

  // THUMBS_DOWN reopens the conversation — overrides the resolve we just wrote
  if (input.source === 'CSAT' && input.csat?.rating === 'THUMBS_DOWN') {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { status: 'WAITING_ON_CUSTOMER', resolutionSource: null, resolvedAt: null },
    })
    return {
      conversationId: conv.id,
      resolutionSource: 'CSAT',
      resolvedAt,
      loyaltyEventEmitted: false,
    }
  }

  // Loyalty bridge — only for identified (non-anonymous) members
  let loyaltyEventEmitted = false
  if (conv.memberId) {
    await deps.enqueueLoyaltyEvent({
      brandId: conv.brandId,
      memberId: conv.memberId,
      eventType: 'cx.ticket_resolved',
      payload: { conversationId: conv.id, resolutionSource: input.source },
      idempotencyKey: `cx.ticket_resolved:${conv.id}`,
      ingestedAt: resolvedAt.toISOString(),
    })
    loyaltyEventEmitted = true
  }

  return {
    conversationId: conv.id,
    resolutionSource: input.source,
    resolvedAt,
    loyaltyEventEmitted,
  }
}
