import { z } from 'zod'

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
  status: z.enum(['ACTIVE', 'INACTIVE', 'ERASED']).optional(),
  enrolledAfter: z.string().datetime().optional(),
  enrolledBefore: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'email', 'pointsBalance', 'createdAt', 'sentiment']).default('createdAt'),
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
