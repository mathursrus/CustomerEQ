import { z } from 'zod'

export const EnrollMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional(),
  consentGivenAt: z.string().datetime({ message: 'consentGivenAt must be an ISO 8601 datetime' }),
  consentVersion: z.string().max(20).optional().default('1.0'),
  programId: z.string().min(1, 'programId is required'),
})

export type EnrollMemberInput = z.infer<typeof EnrollMemberSchema>
