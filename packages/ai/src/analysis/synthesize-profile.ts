import { b } from '../generated/baml_client/index.js'
import type { Customer360Response } from '@customerEQ/shared'

export interface CustomerContext {
  memberStatus: string
  pointsBalance: number
  tierName: string | null
  totalEvents: number
  totalSurveyResponses: number
  averageSentiment: number | null
  totalPointsEarned: number
  totalPointsRedeemed: number
  recentEventTypes: string[]
  recentSentiments: number[]
  recentNpsScores: number[]
  recentTopics: string[][]
  hasOpenCases: boolean
  openCaseCount: number
  daysSinceEnrollment: number
  daysSinceLastEvent: number | null
}

export interface CustomerProfileSynthesis {
  engagementLevel: 'high' | 'medium' | 'low' | 'dormant'
  sentimentTrajectory: 'improving' | 'stable' | 'declining'
  preferences: string[]
  riskSignals: string[]
  recommendedActions: string[]
  summary: string
}

/**
 * Transform a Customer 360 API response into the context needed for BAML synthesis.
 * Strips all PII to comply with C-GDPR-4.
 */
export function buildCustomerContext(data: Customer360Response): CustomerContext {
  const now = new Date()
  const enrollmentDate = new Date(data.member.enrollmentDate)
  const lastEventDate = data.recentEvents.items[0]?.createdAt
    ? new Date(data.recentEvents.items[0].createdAt)
    : null

  return {
    memberStatus: data.member.status,
    pointsBalance: data.member.pointsBalance,
    tierName: data.member.tier?.name ?? null,
    totalEvents: data.stats.totalEvents,
    totalSurveyResponses: data.stats.totalSurveyResponses,
    averageSentiment: data.stats.averageSentiment,
    totalPointsEarned: data.stats.totalPointsEarned,
    totalPointsRedeemed: data.stats.totalPointsRedeemed,
    recentEventTypes: data.recentEvents.items.map((e) => e.eventType),
    recentSentiments: data.surveyResponses.items
      .filter((s) => s.sentiment !== null)
      .map((s) => s.sentiment!),
    recentNpsScores: data.surveyResponses.items
      .filter((s) => s.score !== null)
      .map((s) => s.score!),
    recentTopics: data.surveyResponses.items.map((s) => s.topics),
    hasOpenCases: data.openCases.length > 0,
    openCaseCount: data.openCases.length,
    daysSinceEnrollment: Math.floor((now.getTime() - enrollmentDate.getTime()) / 86400000),
    daysSinceLastEvent: lastEventDate
      ? Math.floor((now.getTime() - lastEventDate.getTime()) / 86400000)
      : null,
  }
}

/**
 * Synthesize a KYC profile from Customer 360 data using GPT-4o via BAML.
 */
export async function synthesizeCustomerProfile(
  data: Customer360Response,
): Promise<CustomerProfileSynthesis> {
  const context = buildCustomerContext(data)
  const result = await b.SynthesizeCustomerProfile({
    member_status: context.memberStatus,
    points_balance: context.pointsBalance,
    tier_name: context.tierName,
    total_events: context.totalEvents,
    total_survey_responses: context.totalSurveyResponses,
    average_sentiment: context.averageSentiment,
    total_points_earned: context.totalPointsEarned,
    total_points_redeemed: context.totalPointsRedeemed,
    recent_event_types: context.recentEventTypes,
    recent_sentiments: context.recentSentiments,
    recent_nps_scores: context.recentNpsScores,
    recent_topics: context.recentTopics,
    has_open_cases: context.hasOpenCases,
    open_case_count: context.openCaseCount,
    days_since_enrollment: context.daysSinceEnrollment,
    days_since_last_event: context.daysSinceLastEvent,
  })

  return {
    engagementLevel: result.engagement_level as CustomerProfileSynthesis['engagementLevel'],
    sentimentTrajectory: result.sentiment_trajectory as CustomerProfileSynthesis['sentimentTrajectory'],
    preferences: result.preferences,
    riskSignals: result.risk_signals,
    recommendedActions: result.recommended_actions,
    summary: result.summary,
  }
}
