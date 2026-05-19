import type { Job, ConnectionOptions } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import { classifyResolution } from '@customerEQ/ai/src/support/resolution.js'
import { resolveConversation } from '@customerEQ/ai'
import { enqueueEvent } from '../queues/producers.js'

const logger = pino({ name: 'support-timeout-classifier' })

const HOURS_THRESHOLD = 24
const MIN_CONFIDENCE = 0.7

export function createSupportTimeoutClassifierProcessor(conn: ConnectionOptions) {
  return (_job: Job<Record<string, never>>) => processSupportTimeoutClassifier(conn)
}

export async function processSupportTimeoutClassifier(conn?: ConnectionOptions): Promise<void> {
  const cutoff = new Date(Date.now() - HOURS_THRESHOLD * 60 * 60 * 1000)

  const candidates = await prisma.conversation.findMany({
    where: {
      status: { in: ['ACTIVE', 'WAITING_ON_CUSTOMER'] },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      brandId: true,
      memberId: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true, createdAt: true },
      },
    },
    take: 100,
  })

  logger.info({ candidateCount: candidates.length }, 'timeout scan')

  for (const conv of candidates) {
    if (conv.messages.length === 0) continue
    const last = conv.messages[conv.messages.length - 1]
    if (last.role === 'CUSTOMER') continue // customer just spoke; not idle from their side
    const hoursSinceLast = (Date.now() - last.createdAt.getTime()) / (60 * 60 * 1000)
    if (hoursSinceLast < HOURS_THRESHOLD) continue

    try {
      const result = await classifyResolution({
        messages: conv.messages.map((m) => ({ role: m.role as 'CUSTOMER' | 'AI' | 'AGENT', content: m.content })),
        hoursSinceLast,
      })
      if (result.resolved && result.confidence >= MIN_CONFIDENCE) {
        logger.info({ conversationId: conv.id, confidence: result.confidence }, 'auto-resolving via timeout')
        if (!conn) {
          throw new Error('processSupportTimeoutClassifier: ConnectionOptions required to enqueue loyalty events')
        }
        await resolveConversation(
          { conversationId: conv.id, source: 'AI_TIMEOUT' },
          { enqueueLoyaltyEvent: (payload) => enqueueEvent(conn, payload).then(() => undefined) },
        )
      } else {
        logger.info(
          { conversationId: conv.id, confidence: result.confidence, resolved: result.resolved },
          'skip — below confidence threshold or not resolved',
        )
      }
    } catch (err) {
      logger.error({ err, conversationId: conv.id }, 'classifier failed for conversation')
    }
  }
}
