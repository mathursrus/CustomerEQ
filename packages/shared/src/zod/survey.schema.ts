import { z } from 'zod'

// ─── Question Types ─────────────────────────────────────────────────────────

export const QUESTION_TYPES = [
  'rating', 'text', 'choice',  // legacy types (backward compatible)
  'multiple_choice', 'checkbox', 'dropdown',
  'matrix', 'ranking', 'slider', 'likert',
  'image_choice', 'file_upload',
] as const

export type QuestionType = (typeof QUESTION_TYPES)[number]

// ─── Skip Logic ─────────────────────────────────────────────────────────────

export const SkipConditionSchema = z.object({
  sourceQuestionId: z.string().min(1),
  operator: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'contains', 'not_contains', 'is_empty', 'is_not_empty']),
  value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
})

export const SkipRuleSchema = z.object({
  targetQuestionId: z.string().min(1),
  action: z.enum(['show', 'hide']),
  conditions: z.array(SkipConditionSchema).min(1),
  conditionLogic: z.enum(['AND', 'OR']).default('AND'),
})

// ─── Question Config ────────────────────────────────────────────────────────

export const QuestionConfigSchema = z.object({
  options: z.array(z.string()).optional(),
  allowOther: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  labels: z.object({ left: z.string().optional(), right: z.string().optional() }).optional(),
  scale: z.array(z.string()).optional(),
  rows: z.array(z.string()).optional(),
  columns: z.array(z.string()).optional(),
  maxLength: z.number().optional(),
  multiline: z.boolean().optional(),
  minSelect: z.number().optional(),
  maxSelect: z.number().optional(),
  imageOptions: z.array(z.object({ label: z.string(), imageUrl: z.string() })).optional(),
  multiSelect: z.boolean().optional(),
  maxSizeMB: z.number().optional(),
  allowedTypes: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
}).optional()

// ─── Survey Question Schema ─────────────────────────────────────────────────

export const SurveyQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, 'Question text is required'),
  type: z.enum(QUESTION_TYPES),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(), // backward compat for legacy choice type
  config: QuestionConfigSchema,
  skipRules: z.array(SkipRuleSchema).optional(),
})

// ─── Survey CRUD ─────────────────────────────────────────────────────────────

export const CreateSurveySchema = z.object({
  name: z.string().min(1, 'Survey name is required').max(200),
  programId: z.string().min(1),
  type: z.enum(['NPS', 'CSAT', 'CES', 'CUSTOM']),
  questions: z.array(SurveyQuestionSchema).min(1, 'At least one question is required'),
  settings: z.record(z.unknown()).optional(),
  incentivePoints: z.number().int().positive().max(100000, 'Incentive points cannot exceed 100,000').optional(),
  themeId: z.string().optional(),
  // Issue #79 — trigger wizard fields (all optional for backwards compatibility)
  triggerCategory: z.enum(['loyalty', 'cx_risk', 'scheduled']).optional(),
  triggerKey: z.string().optional(),
  surveyTypeOverride: z.enum(['NPS', 'CSAT', 'CES', 'CUSTOM']).optional(),
})

export const UpdateSurveySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  questions: z.array(SurveyQuestionSchema).min(1).optional(),
  settings: z.record(z.unknown()).optional(),
  incentivePoints: z.number().int().positive().max(100000).nullable().optional(),
  themeId: z.string().nullable().optional(),
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

// ─── Survey Theme ────────────────────────────────────────────────────────────

const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
const hexColor = z.string().regex(hexColorRegex, 'Must be a valid hex color (e.g. #1a56db)')

export const CreateSurveyThemeSchema = z.object({
  name: z.string().min(1, 'Theme name is required').max(100),
  isDefault: z.boolean().default(false),

  logoUrl: z.string().url().startsWith('https://', 'Logo URL must use HTTPS').nullable().optional(),
  brandName: z.string().max(100).nullable().optional(),

  primaryColor: hexColor.default('#6366f1'),
  secondaryColor: hexColor.default('#818cf8'),
  backgroundColor: hexColor.default('#ffffff'),
  textColor: hexColor.default('#111827'),
  buttonColor: hexColor.default('#6366f1'),
  buttonTextColor: hexColor.default('#ffffff'),
  accentColor: hexColor.default('#6366f1'),

  fontFamily: z.string().default('system-ui'),
  headingSize: z.enum(['sm', 'md', 'lg']).default('md'),
  bodySize: z.enum(['sm', 'md', 'lg']).default('md'),

  backgroundImageUrl: z.string().url().startsWith('https://').nullable().optional(),
  cardStyle: z.enum(['flat', 'shadow', 'border']).default('shadow'),
  borderRadius: z.enum(['none', 'sm', 'md', 'lg']).default('md'),
  maxWidth: z.enum(['sm', 'md', 'lg']).default('md'),

  thankYouMessage: z.string().max(500).default('Thank you for your feedback!'),
  thankYouRedirectUrl: z.string().url().nullable().optional(),
  showIncentivePoints: z.boolean().default(true),
})

export const UpdateSurveyThemeSchema = CreateSurveyThemeSchema.partial().omit({ isDefault: true })

// ─── Question Template (Library) ─────────────────────────────────────────────

export const CreateQuestionTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  question: SurveyQuestionSchema,
  tags: z.array(z.string()).default([]),
})

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CreateSurveyInput = z.infer<typeof CreateSurveySchema>
export type UpdateSurveyInput = z.infer<typeof UpdateSurveySchema>
export type UpdateSurveyStatusInput = z.infer<typeof UpdateSurveyStatusSchema>
export type SubmitSurveyResponseInput = z.infer<typeof SubmitSurveyResponseSchema>
export type SurveyQuestion = z.infer<typeof SurveyQuestionSchema>
export type SkipRule = z.infer<typeof SkipRuleSchema>
export type SkipCondition = z.infer<typeof SkipConditionSchema>
export type QuestionConfig = z.infer<typeof QuestionConfigSchema>
export type CreateSurveyThemeInput = z.infer<typeof CreateSurveyThemeSchema>
export type UpdateSurveyThemeInput = z.infer<typeof UpdateSurveyThemeSchema>
export type CreateQuestionTemplateInput = z.infer<typeof CreateQuestionTemplateSchema>
