import { z } from 'zod'

export const IngestEventSchema = z.object({
  eventType: z.string().min(1, 'eventType is required'),
  memberId: z.string().min(1, 'memberId is required'),
  payload: z.record(z.unknown()).optional().default({}),
  idempotencyKey: z.string().max(128).optional(),
})

export type IngestEventInput = z.infer<typeof IngestEventSchema>
