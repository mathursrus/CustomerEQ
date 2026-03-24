import { z } from 'zod'

export const CreateProgramSchema = z.object({
  name: z.string().min(1, 'Program name is required').max(100),
  description: z.string().max(500).optional(),
  pointCurrencyName: z.string().min(1).max(30).optional().default('Points'),
  pointToCurrencyRatio: z.number().positive('Point-to-currency ratio must be positive').optional().default(0.01),
})

export const UpdateProgramSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  pointCurrencyName: z.string().min(1).max(30).optional(),
  pointToCurrencyRatio: z.number().positive().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
})

export type CreateProgramInput = z.infer<typeof CreateProgramSchema>
export type UpdateProgramInput = z.infer<typeof UpdateProgramSchema>
