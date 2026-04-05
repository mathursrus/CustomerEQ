import { z } from 'zod'

// ---------------------------------------------------------------------------
// Health Score Schemas
// ---------------------------------------------------------------------------

export const HealthScoreWeightsSchema = z.object({
  recency: z.number().min(0).max(1).default(0.25),
  frequency: z.number().min(0).max(1).default(0.20),
  sentiment: z.number().min(0).max(1).default(0.25),
  nps: z.number().min(0).max(1).default(0.15),
  engagement: z.number().min(0).max(1).default(0.15),
}).refine(
  (w) => Math.abs(w.recency + w.frequency + w.sentiment + w.nps + w.engagement - 1.0) < 0.001,
  { message: 'Weights must sum to 1.0' }
)

export const HealthScoreFilterSchema = z.object({
  healthScoreMin: z.coerce.number().int().min(0).max(100).optional(),
  healthScoreMax: z.coerce.number().int().min(0).max(100).optional(),
})

export const RecomputeHealthScoreSchema = z.object({
  memberId: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Enrollment Schemas
// ---------------------------------------------------------------------------

export const EnrollMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional(),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: 'CONSENT_REQUIRED' }),
  }),
  consentGivenAt: z.string().datetime({ message: 'consentGivenAt must be an ISO 8601 datetime' }),
  consentVersion: z.string().max(20).optional().default('privacy-v1.0'),
  programId: z.string().min(1, 'programId is required'),
  emailOptIn: z.boolean().default(false),
  smsOptIn: z.boolean().default(false),
  clerkToken: z.string().optional(),
})

export type EnrollMemberInput = z.infer<typeof EnrollMemberSchema>

export const EnrollMemberResponseSchema = z.object({
  memberId: z.string(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  pointsBalance: z.number(),
  programName: z.string(),
  enrollmentBonusPending: z.boolean(),
})

export type EnrollMemberResponse = z.infer<typeof EnrollMemberResponseSchema>

// ---------------------------------------------------------------------------
// Customer 360 & Search — Issue #98
// ---------------------------------------------------------------------------

/** Query params for GET /v1/members (search endpoint) */
export const SearchMembersQuerySchema = z.object({
  q: z.string().optional(),
  tier: z.string().optional(),
  sentimentMin: z.coerce.number().min(-1).max(1).optional(),
  sentimentMax: z.coerce.number().min(-1).max(1).optional(),
  npsMin: z.coerce.number().min(0).max(10).optional(),
  npsMax: z.coerce.number().min(0).max(10).optional(),
  balanceMin: z.coerce.number().int().min(0).optional(),
  balanceMax: z.coerce.number().int().min(0).optional(),
  healthScoreMin: z.coerce.number().int().min(0).max(100).optional(),
  healthScoreMax: z.coerce.number().int().min(0).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ERASED']).optional(),
  enrolledAfter: z.string().datetime().optional(),
  enrolledBefore: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'email', 'pointsBalance', 'createdAt', 'sentiment', 'healthScore']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type SearchMembersQuery = z.infer<typeof SearchMembersQuerySchema>

/** Query params for GET /v1/members/:id/360 */
export const Customer360QuerySchema = z.object({
  eventsLimit: z.coerce.number().int().min(1).max(100).default(20),
  surveysLimit: z.coerce.number().int().min(1).max(50).default(10),
  redemptionsLimit: z.coerce.number().int().min(1).max(50).default(10),
  campaignEventsLimit: z.coerce.number().int().min(1).max(50).default(10),
})

export type Customer360Query = z.infer<typeof Customer360QuerySchema>

/** Response shape for GET /v1/members/:id/360 */
export interface Customer360Response {
  member: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    phone: string | null
    pointsBalance: number
    status: string
    enrollmentDate: string | Date
    consentGivenAt: string | Date | null
    consentVersion: string | null
    tier: {
      id: string
      name: string
      rank: number
      benefits: unknown
      multiplier: number
    } | null
    healthScore: number | null
    healthScoreUpdatedAt: string | Date | null
  }
  recentEvents: {
    items: Array<{
      id: string
      eventType: string
      pointsEarned: number
      payload: unknown
      createdAt: string | Date
    }>
    hasMore: boolean
    total: number
  }
  surveyResponses: {
    items: Array<{
      id: string
      surveyName: string
      surveyType: string
      score: number | null
      sentiment: number | null
      topics: string[]
      summary: string | null
      completedAt: string | Date | null
    }>
    hasMore: boolean
    total: number
  }
  redemptions: {
    items: Array<{
      id: string
      rewardName: string
      pointsSpent: number
      status: string
      createdAt: string | Date
    }>
    hasMore: boolean
    total: number
  }
  campaignEvents: {
    items: Array<{
      id: string
      campaignName: string
      triggeredAt: string | Date
      status: string
      result: unknown
    }>
    hasMore: boolean
    total: number
  }
  openCases: Array<{
    id: string
    status: string
    priority: string
    assignee: string
    slaDeadline: string | Date | null
    createdAt: string | Date
  }>
  stats: {
    totalEvents: number
    totalSurveyResponses: number
    averageSentiment: number | null
    totalPointsEarned: number
    totalPointsRedeemed: number
  }
}

// ---------------------------------------------------------------------------
// CRM Notes Schemas
// ---------------------------------------------------------------------------

export const MEMBER_NOTE_CATEGORIES = ['call', 'email', 'meeting', 'note', 'escalation', 'win-back'] as const
export const MEMBER_NOTE_SENTIMENTS = ['very_negative', 'negative', 'neutral', 'positive', 'very_positive'] as const

export const CreateMemberNoteSchema = z.object({
  body: z.string().trim().min(1, 'body is required').max(4000, 'body must be <= 4000 characters'),
  category: z.enum(MEMBER_NOTE_CATEGORIES).optional(),
  sentiment: z.enum(MEMBER_NOTE_SENTIMENTS).optional(),
  author: z.string().trim().max(200).optional(),
})

export type CreateMemberNoteInput = z.infer<typeof CreateMemberNoteSchema>
export type MemberNoteCategory = typeof MEMBER_NOTE_CATEGORIES[number]
export type MemberNoteSentiment = typeof MEMBER_NOTE_SENTIMENTS[number]
