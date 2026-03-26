import type { Job } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'
import pino from 'pino'
import { prisma } from '@customerEQ/database'
import type { SentimentAnalysisPayload } from '@customerEQ/shared'
import { analyzeResponse } from '@customerEQ/ai'
import type { FeedbackAnalysisResult } from '@customerEQ/ai'
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
// BullMQ processor
// ---------------------------------------------------------------------------

export function createSentimentProcessor(connection: ConnectionOptions) {
  return async function processSentimentAnalysis(job: Job<SentimentAnalysisPayload>): Promise<{
    sentiment: number
    topics: string[]
    eventEnqueued: boolean
  }> {
    const { surveyResponseId, brandId, memberId, text, eventType, score } = job.data

    // 1. Fetch existing clusters for the brand so the AI can assign/suggest
    const existingClusters = await prisma.feedbackCluster.findMany({
      where: { brandId, isActive: true },
      select: { label: true, description: true },
    })

    // 2. Analyze the text with a 30-second timeout using the AI client
    const SENTIMENT_TIMEOUT_MS = 30_000
    const aiResult = await Promise.race([
      analyzeResponse(text, {
        surveyType: eventType,
        numericScore: score,
        existingClusters: existingClusters.map((c) => ({
          label: c.label,
          description: c.description ?? '',
        })),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sentiment analysis timed out after 30s')), SENTIMENT_TIMEOUT_MS),
      ),
    ]) as FeedbackAnalysisResult

    // Map the rich AI result to the backward-compat SentimentResult
    const result: SentimentResult = {
      sentiment: aiResult.sentiment,
      topics: aiResult.topics,
    }

    // 3. Resolve cluster assignment
    let clusterId: string | null = null

    // If AI assigned an existing cluster, look it up
    if (aiResult.assignedClusterLabel) {
      const cluster = await prisma.feedbackCluster.findUnique({
        where: { brandId_label: { brandId, label: aiResult.assignedClusterLabel } },
        select: { id: true },
      })
      if (cluster) {
        clusterId = cluster.id
      }
    }

    // If AI suggested a new cluster and no assignment was made, create it
    if (!clusterId && aiResult.suggestedNewClusterLabel) {
      const existing = await prisma.feedbackCluster.findUnique({
        where: { brandId_label: { brandId, label: aiResult.suggestedNewClusterLabel } },
        select: { id: true },
      })
      if (existing) {
        clusterId = existing.id
      } else {
        const newCluster = await prisma.feedbackCluster.create({
          data: {
            brandId,
            label: aiResult.suggestedNewClusterLabel,
            description: aiResult.summary,
            keywords: aiResult.topics,
            responseCount: 0,
          },
        })
        clusterId = newCluster.id
        logger.info(
          { brandId, label: aiResult.suggestedNewClusterLabel, clusterId },
          'Created new feedback cluster from AI suggestion',
        )
      }
    }

    // 4. Update the SurveyResponse with sentiment, confidence, topics, summary, clusterId
    try {
      await prisma.surveyResponse.update({
        where: { id: surveyResponseId },
        data: {
          sentiment: aiResult.sentiment,
          confidence: aiResult.confidence,
          topics: aiResult.topics,
          summary: aiResult.summary,
          clusterId,
        },
      })
    } catch (dbErr) {
      logger.error(
        { err: dbErr, surveyResponseId, sentiment: aiResult.sentiment },
        'Failed to update survey response with sentiment data',
      )
      throw dbErr
    }

    logger.info(
      { surveyResponseId, sentiment: result.sentiment, topics: result.topics, clusterId },
      'Sentiment analysis complete',
    )

    // 5. If sentiment is strongly negative, enqueue a cx.sentiment_negative event
    // This feeds into the campaign trigger engine for automated retention actions
    let eventEnqueued = false
    if (result.sentiment <= -0.3) {
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
