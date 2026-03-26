import { z } from 'zod'

// ─── Survey Question Schema ─────────────────────────────────────────────────

export const SurveyQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, 'Question text is required'),
  type: z.enum(['rating', 'text', 'choice']),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(), // for choice type
})

// ─── Survey CRUD ─────────────────────────────────────────────────────────────

export const CreateSurveySchema = z.object({
  name: z.string().min(1, 'Survey name is required').max(200),
  programId: z.string().min(1),
  type: z.enum(['NPS', 'CSAT', 'CES', 'CUSTOM']),
  questions: z.array(SurveyQuestionSchema).min(1, 'At least one question is required'),
  settings: z.record(z.unknown()).optional(),
  incentivePoints: z.number().int().positive().max(100000, 'Incentive points cannot exceed 100,000').optional(),
})

export const UpdateSurveyStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']),
})

// ─── Survey Response Submission ──────────────────────────────────────────────

export const SubmitSurveyResponseSchema = z.object({
  memberId: z.string().min(1, 'memberId is required'),
  answers: z.record(z.unknown()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'At least one answer is required' },
  ),
  score: z.number().min(0, 'Score must be at least 0').max(10, 'Score must be at most 10').optional(), // NPS: 0-10, CSAT: 1-5, CES: 1-7
  channel: z.enum(['email', 'in_app', 'link', 'sms']).default('link'),
})

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CreateSurveyInput = z.infer<typeof CreateSurveySchema>
export type UpdateSurveyStatusInput = z.infer<typeof UpdateSurveyStatusSchema>
export type SubmitSurveyResponseInput = z.infer<typeof SubmitSurveyResponseSchema>
export type SurveyQuestion = z.infer<typeof SurveyQuestionSchema>
