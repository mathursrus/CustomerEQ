import { z } from 'zod'
import {
  EXTERNAL_MATCH_STATUSES,
  EXTERNAL_SIGNAL_STATUSES,
  EXTERNAL_SOURCE_TYPES,
  EXTERNAL_SYNC_MODES,
} from '../externalSignals.js'

const JsonRecordSchema: z.ZodType<Record<string, unknown>> = z.record(z.unknown())

export const ExternalSourceTypeSchema = z.enum(EXTERNAL_SOURCE_TYPES)
export const ExternalSyncModeSchema = z.enum(EXTERNAL_SYNC_MODES)
export const ExternalSignalStatusSchema = z.enum(EXTERNAL_SIGNAL_STATUSES)
export const ExternalMatchStatusSchema = z.enum(EXTERNAL_MATCH_STATUSES)

export const CreateExternalSignalSourceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sourceType: ExternalSourceTypeSchema,
  connectionMethod: z.string().trim().min(1).max(60),
  syncMode: ExternalSyncModeSchema,
  enabled: z.boolean().default(false),
  scopeConfig: JsonRecordSchema.default({}),
  filterConfig: JsonRecordSchema.nullable().optional().default(null),
  matchingConfig: JsonRecordSchema.nullable().optional().default(null),
  credentialRef: z.string().trim().max(200).nullable().optional().default(null),
})

export const UpdateExternalSignalSourceSchema = CreateExternalSignalSourceSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be provided' },
)

export const TestExternalSignalSourceSchema = z.object({
  samplePayloads: z.array(JsonRecordSchema).optional(),
})

export const ExternalSignalSourceListQuerySchema = z.object({
  sourceType: ExternalSourceTypeSchema.optional(),
  enabled: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const ExternalSignalsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sourceType: ExternalSourceTypeSchema.optional(),
  matchStatus: ExternalMatchStatusSchema.optional(),
  resolved: z.enum(['true', 'false']).optional(),
  ratingMin: z.coerce.number().min(0).max(5).optional(),
  ratingMax: z.coerce.number().min(0).max(5).optional(),
  sentimentMin: z.coerce.number().min(-1).max(1).optional(),
  sentimentMax: z.coerce.number().min(-1).max(1).optional(),
  search: z.string().trim().optional(),
  subjectKey: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export const Customer360ExternalSignalSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceType: ExternalSourceTypeSchema,
  sourceName: z.string(),
  body: z.string(),
  summary: z.string().nullable(),
  rating: z.number().nullable(),
  sentiment: z.number().nullable(),
  topics: z.array(z.string()),
  canonicalUrl: z.string().nullable(),
  externalAuthorLabel: z.string().nullable(),
  subjectLabel: z.string().nullable(),
  postedAt: z.union([z.string(), z.date()]).nullable(),
  matchConfidence: z.number().nullable(),
})
