# Implementation Work List — Issue #262: Historical Survey Data Import

**Branch**: feature/issue-262-historical-survey-import  
**Spec**: docs/feature-specs/262-historical-survey-data-import.md  
**Type**: Feature  
**Priority**: P1 (unit + integration tests required)

---

## Critical Dependency

> **Auto-enrollment is landing tonight** in the survey response submission handler (`POST /v1/surveys/:id/responses`). The import worker's member-handling MUST use the same code path once that PR merges — do NOT implement a separate member stub creation pattern. Leave a clearly marked integration point and fill it in after the merge.

---

## Architecture Summary

**Pattern**: Source adapter library. Each source type (Google Reviews, Excel) defines its own column mapping and normalisation. The import API accepts a `sourceType` parameter, picks the correct adapter, maps rows to a canonical internal format, then feeds each row through the same async pipeline as a live survey response.

**Column mapping philosophy**: Match headers case-insensitively by name across multiple known variants. Order-independent — position never matters. Missing optional columns use defaults. Unknown columns stored in `answers` JSONB under their original name (preserving provenance). `user`/`email` column is the member-matching key for Excel; Google Reviews has no email so uses `memberId = null`.

**Canonical row format** (output of every adapter):
```typescript
{
  email: string | null        // null for Google Reviews
  score: number | null        // always 0-10 after normalisation
  verbatim: string | null
  completedAt: Date
  channel: string             // defaults: 'review' (Google) or 'link' (Excel)
  externalId: string | null   // source dedup key
  rawAnswers: Record<string, unknown>  // all source columns, keyed by original header
  sourceType: 'google_reviews' | 'excel'
}
```

---

## Column Mapping Reference

### Excel / Generic CSV adapter

| Recognised header variants (case-insensitive) | Maps to |
|-----------------------------------------------|---------|
| `user`, `email`, `email address`, `respondent_email`, `customer_email` | member lookup |
| `date`, `completed_at`, `response_date`, `submitted_at`, `timestamp` | `completedAt` |
| `score`, `nps`, `nps_score`, `rating`, `csat`, `ces` | `score` (auto-normalise: ≤5→×2, ≤7→×1.43) |
| `verbatim`, `comment`, `feedback`, `review`, `open_ended`, `response` | `verbatim` |
| `program`, `product`, `program_product` | stored in `rawAnswers` as context |
| `channel`, `source`, `medium` | `channel` |
| `external_id`, `id`, `respondent_id`, `response_id` | `externalId` |

Unknown columns: stored in `rawAnswers` under their original header name.

### Google Reviews adapter

| Google column | Maps to |
|---------------|---------|
| `Reviewer` | `rawAnswers.reviewer_name` — display only |
| `Star Rating` | `score` (×2 → 0-10) |
| `Review` | `verbatim` |
| `Date` | `completedAt` |
| `Review ID` *(if present)* | `externalId` |
| *(none)* | `channel` = `'review'` (hardcoded) |
| `email` | `null` (Google does not export email) |

---

## Implementation Checklist

### Layer 1 — Database (blocking)

- [ ] `packages/database/prisma/schema.prisma`
  - Add `SurveyImportBatch` model (`id`, `surveyId`, `brandId`, `sourceType`, `filename`, `status`, `totalRows`, `processedRows`, `failedRows`, `errors Json[]`, `createdAt`, `updatedAt`, soft-delete `deletedAt`)
  - Add to `SurveyResponse`: `importBatchId String?`, `importedAt DateTime?`, `externalRespondentId String?`  
  - Change unique: `@@unique([surveyId, memberId])` → partial unique index `WHERE "import_batch_id" IS NULL` (live dedup) + `@@unique([surveyId, memberId, importBatchId])` (historical dedup)  
  - Add `importBatches SurveyImportBatch[]` relation to `Survey`
  - Make `memberId` nullable on `SurveyResponse` (Google Reviews → `null`)

- [ ] `packages/database/prisma/migrations/20260504000000_survey_import_batch/migration.sql`
  - Manual SQL (shadow DB workaround still applies)
  - Drop old `survey_responses_survey_id_member_id_key` unique index
  - Create partial unique: `CREATE UNIQUE INDEX ... WHERE import_batch_id IS NULL`
  - Create compound unique for historical records
  - Create `survey_import_batches` table

### Layer 2 — Shared types (blocking for API + worker)

- [ ] `packages/shared/src/queues.ts`
  - Add `SURVEY_IMPORT: 'survey-import'`

- [ ] `packages/shared/src/types/index.ts`
  - Add `SurveyImportRowPayload` interface: `{ batchId, surveyId, brandId, rowIndex, sourceType, email?, score?, verbatim?, completedAt, channel, externalId?, rawAnswers }`

- [ ] `packages/shared/src/zod/survey.schema.ts`
  - Add `IMPORT_BATCH_STATUSES` enum (`pending`, `processing`, `complete`, `failed`)
  - Add `SOURCE_TYPES` const (`google_reviews`, `excel`)
  - Add `InitiateImportSchema`: `{ sourceType: z.enum(SOURCE_TYPES) }`

### Layer 3 — Source adapters (independent, parallelisable)

- [ ] `apps/api/src/utils/importAdapters/types.ts`
  - `CanonicalImportRow` interface (the normalised format above)
  - `SourceAdapter` interface: `{ sourceType, parse(rows: string[][], headers: string[]): CanonicalImportRow[] }`
  - `ColumnMapper` utility: `matchHeader(variants: string[], headers: string[]): number | null`

- [ ] `apps/api/src/utils/importAdapters/excelAdapter.ts`
  - Implements `SourceAdapter` for `excel`
  - Case-insensitive, order-independent header matching using `ColumnMapper`
  - Auto-scale normalisation for score (≤5→×2, ≤7→×1.43, else as-is)
  - Required: at least one of `user`/`email` variants present
  - Unknown columns forwarded to `rawAnswers`

- [ ] `apps/api/src/utils/importAdapters/googleReviewsAdapter.ts`
  - Implements `SourceAdapter` for `google_reviews`
  - Fixed column mapping (Star Rating, Review, Date, Reviewer, Review ID)
  - `email = null`, `channel = 'review'`

- [ ] `apps/api/src/utils/importAdapters/index.ts`
  - `getAdapter(sourceType: string): SourceAdapter` factory

- [ ] `apps/api/src/utils/csvParser.ts` *(reuse/update from stash)*
  - RFC 4180 parser, returns `{ headers: string[], rows: string[][] }`
  - Ensure it is order-agnostic (pass headers separately)
  - Unit tests already in stash (`csvParser.test.ts`) — verify they still pass

### Layer 4 — API routes (depends on Layer 1+2+3)

- [ ] `apps/api/src/routes/surveys.ts`
  - `POST /v1/surveys/:id/import` — multipart or `text/plain` with `?sourceType=excel|google_reviews`
    - Validate file size (≤10 MB), `sourceType` required
    - Parse CSV with `parseCsv()`, pass to adapter, validate ≥1 row
    - Create `SurveyImportBatch` record
    - Enqueue one `SurveyImportRowPayload` per canonical row
    - Return 202 with `{ batchId, rowCount, validationErrors }`
  - `GET /v1/surveys/:id/imports` — list batches for survey (ordered by `createdAt desc`)
  - `GET /v1/surveys/:id/imports/:batchId` — batch detail + `errors` array

### Layer 5 — Queue wiring (depends on Layer 2)

- [ ] `apps/api/src/queues/bullmq.ts`
  - Add `_surveyImportQueue`, `getSurveyImportQueue()`
  - Add inline processor `inlineSurveyImportRow()` — calls same member auto-enrollment path as live submission (**fill in once auto-enrollment PR merges tonight**)
  - Add `enqueueSurveyImportRow()` export
  - Update `initQueues()`

### Layer 6 — Worker processor (depends on Layer 1+2, and auto-enrollment PR)

- [ ] `apps/worker/src/processors/surveyImport.ts`
  - BullMQ processor for `SURVEY_IMPORT` queue
  - Member resolution: **call same auto-enrollment utility** as `POST /:id/responses` (do not inline stub creation — wire to the shared function from tonight's PR)
  - For Google Reviews rows (`email = null`): `memberId = null`, skip auto-enrollment
  - Create `SurveyResponse` with `importBatchId`, `importedAt = completedAt`, `externalRespondentId`
  - Enqueue sentiment analysis (same as live path)
  - Update `SurveyImportBatch` progress (`processedRows++` or `failedRows++`)
  - On row failure: append to `batch.errors` JSONB, do not abort batch

- [ ] `apps/worker/src/index.ts`
  - Register `surveyImportWorker` with `concurrency: 5`

### Layer 7 — Web UI (depends on Layer 4)

- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx`
  - Add "Import Historical Data" button to survey header
  - `ImportModal` component: source type selector, file picker, validation error display, success state (batch ID + row count)
  - "Import History" tab: table of batches with status, progress, error count, source type badge
  - Responses tab: "historical" badge + source type on imported responses
  - Update mock to match [docs/feature-specs/mocks/262-import-flow.html](docs/feature-specs/mocks/262-import-flow.html)

---

## Tests Required (P1 — unit + integration)

- [ ] `apps/api/src/utils/importAdapters/excelAdapter.test.ts`
  - Column order independence (shuffle headers, verify mapping)
  - Case-insensitive header matching
  - Score auto-normalisation (1-5 scale, 1-7 scale, 0-10 passthrough)
  - Missing optional columns default correctly
  - Unknown columns forwarded to `rawAnswers`
  - Missing email/user column → validation error

- [ ] `apps/api/src/utils/importAdapters/googleReviewsAdapter.test.ts`
  - Star rating 1-5 → 0-10 normalisation
  - `email = null`, `channel = 'review'`
  - Missing `Review ID` → `externalId = null`

- [ ] `apps/api/src/utils/csvParser.test.ts` *(from stash — verify still pass)*

- [ ] `apps/api/test/integration/surveyImport.test.ts`
  - `POST /import` with valid Excel CSV → 202, batch created, rows enqueued
  - `POST /import` with Google Reviews CSV → 202, rows have `memberId = null`
  - `POST /import` missing `sourceType` → 422
  - `POST /import` file > 10MB → 413
  - `POST /import` missing user/email column (Excel) → 422
  - `GET /imports` → lists batches ordered newest-first
  - `GET /imports/:batchId` → batch detail with error rows

---

## Validation Requirements

- `uiValidationRequired`: yes — import modal, history tab, response source badges
- `mobileValidationRequired`: no (admin-only feature)
- Target journeys: upload Excel CSV → verify batch created → verify responses appear with "historical" tag; upload Google Reviews CSV → verify anonymous records appear in analytics
- Breakpoints: 1280px desktop only (admin UI)
- Evidence artifact: `docs/evidence/262-ui-polish-validation.md`

---

## Known Deferrals

| Item | Deferred to |
|------|-------------|
| Loyalty engine influence for historical data | Future feature (OQ-3 resolved as out of scope for v1) |
| SurveyMonkey / Typeform / Qualtrics adapters | Future adapters — framework exists, add when a client needs them |
| Column-mapping wizard UI (drag-and-drop) | Future if clients consistently struggle with adapter matching |
| Automated Google Business Profile API pull | Future — high build cost, onboarding-only workflow |

---

## Execution Order

Build in this sequence to unblock layers:

1. Prisma schema + migration → unblocks everything
2. Shared types (queues, payload, zod) → unblocks API + worker
3. Source adapters + CSV parser → can run in parallel with #2
4. API routes → needs #1+2+3
5. Queue wiring (partial) → needs #2, leave auto-enrollment hook open
6. **Wait for auto-enrollment PR tonight → fill in member-resolution in worker**
7. Worker processor → needs #1+2 + auto-enrollment PR
8. Web UI → needs #4
9. Tests → write alongside each layer

**File count**: 14 files modified/created. Within single-branch scope.
