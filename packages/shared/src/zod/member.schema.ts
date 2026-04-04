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
