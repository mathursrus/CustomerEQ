import { z } from 'zod'

export const TriggerConditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'contains']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown())]),
})

export const ActionConfigSchema = z.object({
  points: z.number().int().positive().optional(),
  rewardId: z.string().optional(),
  message: z.string().max(500).optional(),
}).refine(
  (data) => data.points !== undefined || data.rewardId !== undefined || data.message !== undefined,
  { message: 'actionConfig must include points, rewardId, or message' }
)

// --- Spin Wheel Schemas ---

export const SpinWheelSegmentSchema = z.object({
  rewardId: z.string().optional(),
  points: z.number().int().nonnegative().optional(),
  probability: z.number().min(0).max(100),
  label: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #4F46E5)'),
}).refine(
  (data) => data.rewardId !== undefined || (data.points !== undefined && data.points > 0),
  { message: 'Segment must have rewardId or positive points' }
)

export const SpinWheelConfigSchema = z.object({
  segments: z.array(SpinWheelSegmentSchema).min(2, 'Wheel must have at least 2 segments').max(8, 'Wheel can have at most 8 segments'),
  wheelStyle: z.enum(['classic', 'neon', 'minimal']).default('classic'),
}).refine(
  (data) => Math.abs(data.segments.reduce((sum, s) => sum + s.probability, 0) - 100) < 0.01,
  { message: 'Segment probabilities must sum to 100%' }
)

// --- Scratch Card Schemas ---

export const ScratchCardPrizeSchema = z.object({
  rewardId: z.string().optional(),
  points: z.number().int().nonnegative().optional(),
  probability: z.number().min(0).max(100),
  label: z.string().min(1).max(50),
}).refine(
  (data) => data.rewardId !== undefined || (data.points !== undefined && data.points > 0),
  { message: 'Prize must have rewardId or positive points' }
)

export const ScratchCardConfigSchema = z.object({
  prizes: z.array(ScratchCardPrizeSchema).min(2, 'Card must have at least 2 prizes').max(8, 'Card can have at most 8 prizes'),
  cardStyle: z.enum(['gold', 'silver', 'holiday', 'branded']).default('gold'),
  scratchText: z.string().max(50).default('Scratch to reveal!'),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine(
  (data) => Math.abs(data.prizes.reduce((sum, p) => sum + p.probability, 0) - 100) < 0.01,
  { message: 'Prize probabilities must sum to 100%' }
)

// --- Mystery Box Schemas ---

export const MysteryBoxPrizeSchema = z.object({
  rewardId: z.string().optional(),
  points: z.number().int().nonnegative().optional(),
  probability: z.number().min(0).max(100),
  label: z.string().min(1).max(50),
}).refine(
  (data) => data.rewardId !== undefined || (data.points !== undefined && data.points > 0),
  { message: 'Prize must have rewardId or positive points' }
)

export const MysteryBoxConfigSchema = z.object({
  prizes: z.array(MysteryBoxPrizeSchema).min(2, 'Box must have at least 2 prizes').max(8, 'Box can have at most 8 prizes'),
  boxStyle: z.enum(['gift', 'treasure', 'branded']).default('gift'),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine(
  (data) => Math.abs(data.prizes.reduce((sum, p) => sum + p.probability, 0) - 100) < 0.01,
  { message: 'Prize probabilities must sum to 100%' }
)

// --- Campaign Action Types ---

export const CAMPAIGN_ACTION_TYPES = ['award_points', 'award_reward', 'send_message', 'spin_wheel', 'scratch_card', 'mystery_box'] as const
export type CampaignActionType = typeof CAMPAIGN_ACTION_TYPES[number]

export const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100),
  programId: z.string().min(1),
  triggerType: z.string().min(1, 'triggerType is required'),
  triggerCondition: TriggerConditionSchema.optional(),
  actionType: z.enum(CAMPAIGN_ACTION_TYPES),
  actionConfig: z.union([ActionConfigSchema, SpinWheelConfigSchema, ScratchCardConfigSchema, MysteryBoxConfigSchema]),
  budgetCap: z.number().positive().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
}).superRefine((data, ctx) => {
  if (data.actionType === 'spin_wheel') {
    const result = SpinWheelConfigSchema.safeParse(data.actionConfig)
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['actionConfig', ...issue.path] })
      }
    }
  } else if (data.actionType === 'scratch_card') {
    const result = ScratchCardConfigSchema.safeParse(data.actionConfig)
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['actionConfig', ...issue.path] })
      }
    }
  } else if (data.actionType === 'mystery_box') {
    const result = MysteryBoxConfigSchema.safeParse(data.actionConfig)
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['actionConfig', ...issue.path] })
      }
    }
  } else {
    const result = ActionConfigSchema.safeParse(data.actionConfig)
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['actionConfig', ...issue.path] })
      }
    }
  }
})

export const UpdateCampaignStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']),
})

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>
export type UpdateCampaignStatusInput = z.infer<typeof UpdateCampaignStatusSchema>
export type TriggerCondition = z.infer<typeof TriggerConditionSchema>
export type ActionConfig = z.infer<typeof ActionConfigSchema>
export type SpinWheelSegment = z.infer<typeof SpinWheelSegmentSchema>
export type SpinWheelConfig = z.infer<typeof SpinWheelConfigSchema>
export type ScratchCardPrize = z.infer<typeof ScratchCardPrizeSchema>
export type ScratchCardConfig = z.infer<typeof ScratchCardConfigSchema>
export type MysteryBoxPrize = z.infer<typeof MysteryBoxPrizeSchema>
export type MysteryBoxConfig = z.infer<typeof MysteryBoxConfigSchema>
