import { z } from 'zod'

export const WebhookEventType = z.enum([
  'case.created',
  'case.status_changed',
  'case.overdue',
])

export type WebhookEventTypeValue = z.infer<typeof WebhookEventType>

export const CreateWebhookEndpointSchema = z.object({
  label: z.string().min(1, 'Label is required').max(200),
  url: z.string().url('Must be a valid HTTPS URL').refine(
    (u) => u.startsWith('https://'),
    'URL must use HTTPS',
  ),
  events: z.array(WebhookEventType).min(1, 'At least one event type is required'),
})

export const UpdateWebhookEndpointSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  url: z.string().url().refine((u) => u.startsWith('https://'), 'URL must use HTTPS').optional(),
  events: z.array(WebhookEventType).min(1).optional(),
  active: z.boolean().optional(),
})

export type CreateWebhookEndpointInput = z.infer<typeof CreateWebhookEndpointSchema>
export type UpdateWebhookEndpointInput = z.infer<typeof UpdateWebhookEndpointSchema>
