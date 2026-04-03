import type { Job } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type { SentimentAnalysisPayload } from '@customerEQ/shared'
import { SENTIMENT } from '@customerEQ/shared'
import { processSentimentForResponse } from '@customerEQ/ai'
import { enqueueEvent } from '../queues/producers.js'

const logger = pino({ name: 'sentiment-analysis' })

// ---------------------------------------------------------------------------
// Sentiment analysis result interface (backward-compat)
// ---------------------------------------------------------------------------

export interface SentimentResult {
  sentiment: number // -1.0 to 1.0
  topics: string[] // extracted topics
}

// ---------------------------------------------------------------------------
// Pluggable analyzer — defaults to simple heuristic; replaced by AI in prod
// ---------------------------------------------------------------------------

/**
 * Default heuristic analyzer. In production, set SENTIMENT_PROVIDER=openai
 * to use the AI-powered analyzer. This heuristic is deterministic and
 * suitable for tests and environments without AI API access.
 */
export function heuristicAnalyze(text: string): SentimentResult {
  const lower = text.toLowerCase()

  // Simple keyword-based sentiment scoring
  const positiveWords = ['great', 'excellent', 'amazing', 'love', 'fantastic', 'wonderful', 'happy', 'fast', 'easy', 'helpful', 'recommend', 'best', 'perfect', 'awesome', 'satisfied']
  const negativeWords = ['terrible', 'awful', 'horrible', 'hate', 'worst', 'slow', 'broken', 'frustrating', 'disappointed', 'poor', 'bad', 'difficult', 'confusing', 'annoying', 'never']

  let score = 0
  for (const word of positiveWords) {
    if (lower.includes(word)) score += 0.2
  }
  for (const word of negativeWords) {
    if (lower.includes(word)) score -= 0.2
  }

  // Clamp to [-1, 1]
  const sentiment = Math.max(-1, Math.min(1, score))

  // Extract topics from common CX categories
  const topicKeywords: Record<string, string[]> = {
    shipping: ['shipping', 'delivery', 'package', 'shipped', 'tracking'],
    support: ['support', 'help', 'agent', 'representative', 'ticket', 'service'],
    pricing: ['price', 'cost', 'expensive', 'cheap', 'value', 'billing'],
    product: ['product', 'quality', 'feature', 'broken', 'defective', 'item'],
    experience: ['experience', 'website', 'app', 'interface', 'checkout', 'process'],
  }

  const topics: string[] = []
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      topics.push(topic)
    }
  }

  return { sentiment: Math.round(sentiment * 100) / 100, topics }
}

// ---------------------------------------------------------------------------
// Pluggable analyzer — defaults to AI-powered; can be replaced in tests
// ---------------------------------------------------------------------------

// Exported for testing — tests can replace this with vi.fn()
export let analyzeSentiment: (text: string) => Promise<SentimentResult> = async (text) => {
  return heuristicAnalyze(text)
}

/**
 * Replace the sentiment analyzer (e.g., in tests or for AI provider integration).
 */
export function setAnalyzer(fn: (text: string) => Promise<SentimentResult>): void {
  analyzeSentiment = fn
}

// ---------------------------------------------------------------------------
// BullMQ processor — delegates to shared processSentimentForResponse
// ---------------------------------------------------------------------------

export function createSentimentProcessor(connection: ConnectionOptions) {
  return async function processSentimentAnalysis(job: Job<SentimentAnalysisPayload>): Promise<{
    sentiment: number
    topics: string[]
    eventEnqueued: boolean
  }> {
    const { surveyResponseId, brandId, memberId, text, eventType, score } = job.data

    const result = await processSentimentForResponse(
      { surveyResponseId, brandId, memberId, text, eventType, score },
      prisma,
    )

    logger.info(
      { surveyResponseId, sentiment: result.sentiment, topics: result.topics, clusterId: result.clusterId },
      'Sentiment analysis complete',
    )

    // If sentiment is strongly negative, enqueue a cx.sentiment_negative event
    let eventEnqueued = false
    if (result.sentiment <= SENTIMENT.NEGATIVE_THRESHOLD) {
      await enqueueEvent(connection, {
        brandId,
        memberId,
        eventType: 'cx.sentiment_negative',
        payload: {
          originalEventType: eventType,
          sentiment: result.sentiment,
          topics: result.topics,
          score: score ?? null,
          surveyResponseId,
        },
        idempotencyKey: `sentiment:${surveyResponseId}`,
        ingestedAt: new Date().toISOString(),
      })
      eventEnqueued = true
      logger.info({ surveyResponseId, sentiment: result.sentiment }, 'Negative sentiment event enqueued')
    }

    return { sentiment: result.sentiment, topics: result.topics, eventEnqueued }
  }
}
