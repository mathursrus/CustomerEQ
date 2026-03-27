import { z } from 'zod'

export const CreateProgramSchema = z.object({
  name: z.string().min(1, 'Program name is required').max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['POINTS', 'TIERED', 'CASHBACK', 'HYBRID']).optional().default('POINTS'),
  pointCurrencyName: z.string().min(1).max(30).optional().default('Points'),
  pointToCurrencyRatio: z.number().positive('Point-to-currency ratio must be positive').optional().default(0.01),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budgetUsdCents: z.number().int().positive().optional(),
  monthlyBudgetUsdCents: z.number().int().positive().optional(),
  alertThresholdPct: z.number().min(0).max(100).optional(),
  haltBehavior: z.enum(['PAUSE_PROGRAM', 'PAUSE_RULES']).optional(),
})

export const UpdateProgramSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  pointCurrencyName: z.string().min(1).max(30).optional(),
  pointToCurrencyRatio: z.number().positive().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
})

export const UpdateProgramStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
})

export const SimulateSchema = z.object({
  eventType: z.string().min(1, 'eventType is required'),
  payload: z.record(z.unknown()).optional().default({}),
})

export type CreateProgramInput = z.infer<typeof CreateProgramSchema>
export type UpdateProgramInput = z.infer<typeof UpdateProgramSchema>
export type UpdateProgramStatusInput = z.infer<typeof UpdateProgramStatusSchema>
export type SimulateInput = z.infer<typeof SimulateSchema>
