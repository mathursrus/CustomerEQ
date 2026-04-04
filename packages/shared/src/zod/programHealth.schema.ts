import { z } from 'zod'

export const InsightSchema = z.object({
  id: z.string(),
  message: z.string(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  severity: z.enum(['info', 'warning']),
})

export const CxHealthSchema = z.object({
  avgNps: z.number().nullable(),
  activeSurveys: z.number().int().nonnegative(),
  responseRate: z.number().nonnegative(),
  atRiskCount: z.number().int().nonnegative(),
})

export const LoyaltyHealthSchema = z.object({
  activeMembers: z.number().int().nonnegative(),
  pointsIssuedThisWeek: z.number().int().nonnegative(),
  redemptionRate: z.number().nonnegative(),
  activeCampaigns: z.number().int().nonnegative(),
})

export const ProgramHealthResponseSchema = z.object({
  cxHealth: CxHealthSchema.nullable(),
  loyaltyHealth: LoyaltyHealthSchema.nullable(),
  insights: z.array(InsightSchema),
  warnings: z.array(z.string()).optional(),
})

export type Insight = z.infer<typeof InsightSchema>
export type CxHealth = z.infer<typeof CxHealthSchema>
export type LoyaltyHealth = z.infer<typeof LoyaltyHealthSchema>
export type ProgramHealthResponse = z.infer<typeof ProgramHealthResponseSchema>
