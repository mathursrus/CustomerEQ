// Shared sentiment analysis processing logic
// Used by both the BullMQ worker and inline (no-Redis) mode
// to avoid code duplication.

import type { FeedbackAnalysisResult, ExistingCluster } from '../types.js'
import { analyzeResponse } from './sentiment.js'

export interface SentimentProcessPayload {
  surveyResponseId: string
  brandId: string
  memberId: string
  text: string
  eventType: string
  score?: number
}

export interface SentimentProcessResult {
  sentiment: number
  confidence: number
  topics: string[]
  summary: string
  clusterId: string | null
  aiResult: FeedbackAnalysisResult
}

/**
 * Prisma-like interface so we don't depend on the concrete PrismaClient type.
 * Both the worker (which imports @customerEQ/database) and the API can satisfy
 * this interface with their prisma instance.
 */
export interface SentimentPrisma {
  feedbackCluster: {
    findMany(args: {
      where: { brandId: string; isActive: boolean }
      select: { label: boolean; description: boolean }
    }): Promise<Array<{ label: string; description: string | null }>>

    findUnique(args: {
      where: { brandId_label: { brandId: string; label: string } }
      select: { id: boolean }
    }): Promise<{ id: string } | null>

    create(args: {
      data: {
        brandId: string
        label: string
        description: string | null
        keywords: string[]
        responseCount: number
      }
    }): Promise<{ id: string }>
  }

  surveyResponse: {
    update(args: {
      where: { id: string }
      data: {
        sentiment: number
        confidence: number
        topics: string[]
        summary: string
        clusterId: string | null
      }
    }): Promise<unknown>
  }
}

const SENTIMENT_TIMEOUT_MS = 30_000

/**
 * Core sentiment processing: AI analysis → cluster resolution → DB update.
 * Shared between the BullMQ worker processor and the inline queue path.
 */
export async function processSentimentForResponse(
  payload: SentimentProcessPayload,
  db: SentimentPrisma,
): Promise<SentimentProcessResult> {
  const { surveyResponseId, brandId, text, eventType, score } = payload

  // 1. Fetch existing clusters for the brand so the AI can assign/suggest
  const existingClusters = await db.feedbackCluster.findMany({
    where: { brandId, isActive: true },
    select: { label: true, description: true },
  })

  // 2. Analyze the text with a 30-second timeout
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

  // 3. Resolve cluster assignment
  let clusterId: string | null = null

  if (aiResult.assignedClusterLabel) {
    const cluster = await db.feedbackCluster.findUnique({
      where: { brandId_label: { brandId, label: aiResult.assignedClusterLabel } },
      select: { id: true },
    })
    if (cluster) {
      clusterId = cluster.id
    }
  }

  if (!clusterId && aiResult.suggestedNewClusterLabel) {
    const existing = await db.feedbackCluster.findUnique({
      where: { brandId_label: { brandId, label: aiResult.suggestedNewClusterLabel } },
      select: { id: true },
    })
    if (existing) {
      clusterId = existing.id
    } else {
      const newCluster = await db.feedbackCluster.create({
        data: {
          brandId,
          label: aiResult.suggestedNewClusterLabel,
          description: aiResult.summary,
          keywords: aiResult.topics,
          responseCount: 0,
        },
      })
      clusterId = newCluster.id
    }
  }

  // 4. Update the SurveyResponse
  await db.surveyResponse.update({
    where: { id: surveyResponseId },
    data: {
      sentiment: aiResult.sentiment,
      confidence: aiResult.confidence,
      topics: aiResult.topics,
      summary: aiResult.summary,
      clusterId,
    },
  })

  return {
    sentiment: aiResult.sentiment,
    confidence: aiResult.confidence,
    topics: aiResult.topics,
    summary: aiResult.summary,
    clusterId,
    aiResult,
  }
}
