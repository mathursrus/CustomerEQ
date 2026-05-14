import { z } from 'zod'

export const WidgetPositionSchema = z.enum(['BOTTOM_RIGHT', 'BOTTOM_LEFT'])
export type WidgetPosition = z.infer<typeof WidgetPositionSchema>

export const SupportWidgetConfigSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  position: WidgetPositionSchema,
  launcherIconUrl: z.string().nullable(),
  darkModeAuto: z.boolean(),
  greeting: z.string(),
  offlineMessage: z.string(),
  csatPromptText: z.string(),
  escalateButtonText: z.string(),
  showCsatAfterAi: z.boolean(),
  csatTimeoutSeconds: z.number().int().positive(),
  anonAllowed: z.boolean(),
})
export type SupportWidgetConfig = z.infer<typeof SupportWidgetConfigSchema>

export const UpdateSupportWidgetConfigSchema = z.object({
  position: WidgetPositionSchema.optional(),
  launcherIconUrl: z.string().url().nullable().optional(),
  darkModeAuto: z.boolean().optional(),
  greeting: z.string().min(1).max(500).optional(),
  offlineMessage: z.string().min(1).max(500).optional(),
  csatPromptText: z.string().min(1).max(200).optional(),
  escalateButtonText: z.string().min(1).max(100).optional(),
  showCsatAfterAi: z.boolean().optional(),
  csatTimeoutSeconds: z.number().int().min(5).max(600).optional(),
  anonAllowed: z.boolean().optional(),
})
export type UpdateSupportWidgetConfigInput = z.infer<typeof UpdateSupportWidgetConfigSchema>

export const PublicWidgetBootSchema = z.object({
  brandId: z.string(),
  brandName: z.string(),
  theme: z.object({
    primaryColor: z.string(),
    accentColor: z.string(),
    backgroundColor: z.string(),
    textColor: z.string(),
    buttonColor: z.string(),
    buttonTextColor: z.string(),
    fontFamily: z.string(),
    borderRadius: z.string(),
  }),
  widget: SupportWidgetConfigSchema.omit({ id: true, brandId: true }),
})
export type PublicWidgetBoot = z.infer<typeof PublicWidgetBootSchema>
