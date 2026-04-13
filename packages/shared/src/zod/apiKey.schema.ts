import { z } from 'zod'

// POST /v1/api-keys — create a new API key. Server returns the plaintext
// once; the admin UI shows it in a modal with a copy button, and it cannot
// be retrieved again after that.
export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
})
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>

// Response shape for key list + create. Plaintext `key` only present on
// the create response.
export const ApiKeySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
})
export type ApiKeySummary = z.infer<typeof ApiKeySummarySchema>

export const CreatedApiKeySchema = ApiKeySummarySchema.extend({
  key: z.string(), // plaintext — only present on create response
})
