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
