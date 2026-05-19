# Feature: Survey Response Review v1 — Technical Design

Issue: [#423](https://github.com/mathursrus/CustomerEQ/issues/423)
Parent: [#235](https://github.com/mathursrus/CustomerEQ/issues/235) — Survey response review & analysis (umbrella)
Spec: [`docs/feature-specs/423-survey-response-review-v1.md`](../feature-specs/423-survey-response-review-v1.md)
Mock: [`docs/feature-specs/mocks/423-survey-response-review-v1.html`](../feature-specs/mocks/423-survey-response-review-v1.html)
Branch: `feature/423-p0-survey-response-review-v1-...` (same branch as the spec — Rule 26)
PR: [#426](https://github.com/mathursrus/CustomerEQ/pull/426) (same PR — Rule 26)
Owner: manohar.madhira@outlook.com
Status: Draft — `technical-design` Phase 2 (`design-authoring`)
Last touched: 2026-05-19

---

## 1. Scope

This RFC translates every R-tagged requirement in the spec into an implementable plan: schema (no new columns required in Phase 1; one new shared constant set), one new shared-filter module family, one new shared Zod schema, two new API routes plus one vestigial-removal on an existing route, one Excel render path (server-side), one frontend rewrite of `ResponseSection`, and one state lift from `DistributionBatchesFilter`. Audit and compliance are addressed inline with the surfaces they touch.

**In scope (every R, mapped 1:1 in §11):**

- **Schema**: no new columns (the spec's R-erasure references a `SurveyResponse.deletedAt` that does not exist — see §2.1 for why we don't add it in this issue).
- **Shared constants** (`packages/shared/src/constants.ts`): `CSAT`, `CES`, scale-aware `bandsForScale(...)` helpers added alongside the existing `NPS`. `SENTIMENT` retained at the current `0.3` thresholds with strict `< / >` semantics; the spec's `0.33` value is treated as a typo and recorded as a closed open-question in §10 (changing the constant cross-cuts 5 unrelated surfaces and offers no operator benefit at this band-width).
- **Shared filter modules** (`apps/web/src/components/filters/`): `FilterChipGroup`, `SubmittedDateRange`, `FilterBar`, plus the lifted `filter-chips.logic.ts` (existing) extended for the new chip types. The existing `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx` call site migrates here; no copy stays behind (R9c).
- **Shared Zod schema** (`packages/shared/src/zod/responseFilters.schema.ts`): single source of truth for the `wave / submittedFrom / submittedTo / scoreBands / sentimentBands / channels` filter contract, consumed by both new routes and the web client.
- **API**: `GET /v1/surveys/:id/responses` (list) and `GET /v1/surveys/:id/responses.xlsx` (export) on `apps/api/src/routes/surveys.ts`. Plus R21 — remove the vestigial `responses: { take: 20, … }` `include` on the existing `GET /v1/surveys/:id` (audit confirms no web consumer reads `survey.responses[]`).
- **Excel rendering** (server-side): ExcelJS (decision §6.1) drives the 14-row cover block, AI-fields disclaimer row, Powered-by row, and the data sheet starting row 16. A single `EXPORTS_POWERED_BY_URL` constant in `packages/shared/src/constants.ts` (or `packages/shared/src/branding.ts` — see §6.4) holds the hyperlinked host so the cover-block builder never duplicates the literal.
- **Frontend**: `ResponseSection` rewrite — table, filter bar, pagination footer, expand-in-row, AI-column caveat indicator, empty/zero-filter empty states. Wave selection lifts from `DistributionBatchesFilter` to the survey-detail page and is passed to `ResponseSection`.
- **Audit**: two new actions — `survey.responses.list` and `survey.responses.export` — written via the existing per-route `auditAction` / `auditResourceType` / `auditAllowlist` pattern (R22). Export-row audit also captures `aiVintageNonNullCount`.
- **Tests**: unit (filter-chip composition, band derivation, sentiment-band derivation, Excel cover-block builder, member-column rendering), integration (every API filter combination + cross-tenant 404 + 50k export cap + vestigial-row absence + audit row shape), E2E (the 11 spec mock scenes incl. filter-overflow + custom-type-survey).

**Out of scope (deferred — every Phase-2-of-#235 line item is named in the spec's Non-goals; reproduced here so the RFC handoff is unambiguous):**

- Per-question AI synthesis pipeline / `extractOpenEndedText` refactor / BAML signature change.
- Peaks / pits / requests structured fields.
- Aggregate views (score histogram, topic clouds, per-question sentiment distribution).
- Per-response detail route `/admin/surveys/[id]/responses/[responseId]`.
- Cluster drill-through column linking `SurveyResponse.clusterId` → `/admin/analytics/cx/clusters/[id]`.
- Excel-style per-column filtering (click header → filter for that column's distinct values).
- NLP / natural-language filter input.
- CSV export.
- Sortable columns (Phase 1: server returns `completedAt DESC` only).
- Row-level multi-select + bulk-action (no operator request).
- Inline editing of `Member.firstName / lastName` from the response row.
- Chunked / async-job export for filter sets > 50,000 rows — Phase 1 returns HTTP 413; the cap lives in `packages/shared/src/constants.ts` as `EXPORT_ROW_CAP = 50_000` so a single-line change shifts it if evidence warrants.
- **Erasure worker**: no `memberErasure` / `gdprErasure` processor exists today (see §8.4). The erasure side of the spec's GDPR Art. 17 treatment is recorded here as a forward-looking design constraint on the future erasure worker; this issue's impl phase **does not** ship the worker. The list and export endpoints render `member: null` correctly when `memberId IS NULL`, which is the operator-visible behavior whether erasure zeroes the FK now or later.

---

## 2. Design Overview

Five things change at architecture level; everything else is mechanical.

1. **Two new GET endpoints on `/v1/surveys/:id`**, both tenant-scoped via the existing Prisma middleware and the same `WHERE brandId = request.brandId AND deletedAt IS NULL` shape the detail endpoint already uses (R19, R20). The list endpoint paginates with the standard envelope (`{ data, total, page, pageSize, totalPages }`); the export endpoint streams an `.xlsx` body. Both consume the same Zod schema (`responseFilters.schema.ts`); their shared filter-translation helper compiles filter state into a single Prisma `where` shape.
2. **One filter contract, one Zod schema, three new shared filter components** under `apps/web/src/components/filters/`. The existing `FilterChips.tsx` on the survey list page migrates here (R9c). Score Band and Sentiment Band chip groups are data-driven from the `NPS / CSAT / CES / SENTIMENT` constants and are gated on `Survey.type ∈ {NPS, CSAT, CES}` plus (for sentiment) `survey has ≥1 text question`. Filter row overflow collapses **Channel** behind a `More filters ↓` popover at narrow widths (R9d).
3. **Wave selection lifts from `DistributionBatchesFilter` to the detail page** and is passed down to both that filter (kept-up-to-date via controlled `value` + `onChange`) and the new `ResponseSection`. No new wave chip inside the Response section (R7). The `DistributionBatchesFilter` component gets one minor prop addition: `value` (controlled), so the parent owns selection state.
4. **`ResponseSection` is rewritten end-to-end** as a stateful client component that owns: filter state, pagination state, table rendering, export trigger, expand-in-row state, AI-caveat tooltip. It fetches from `GET /v1/surveys/:id/responses` (replacing the placeholder body) and triggers the export by `<a href>` to `GET /v1/surveys/:id/responses.xlsx?…` (so the browser handles the download lifecycle — see §5.2).
5. **Server-side `.xlsx` rendering is owned by a single module** (`apps/api/src/utils/excelExport.ts`) that ExcelJS-builds the 14-row cover block, the AI-fields disclaimer row, the Powered-by row, and the data sheet. The cover-block builder reads the Powered-by host from a single shared constant (R15 explicit). No client transforms the response.

### 2.1 What does NOT change

- **No schema migration.** Phase 1 reads `SurveyResponse` end-to-end. No new columns. The spec's R-erasure passage references `SurveyResponse.deletedAt` — that column does not exist (only `Survey.deletedAt` exists). We do **not** add `SurveyResponse.deletedAt` here because:
  - The Phase-1 read surface relies on `Survey.deletedAt IS NULL` (inherited via the join from `Survey`) and `Member.deletedAt IS NULL` (where applicable, though Member has no soft-delete column either — see §8.4). Soft-deleting individual responses is not in scope.
  - The erasure model is *zero-out-and-anonymize* (zero `memberId`, `sentiment`, `confidence`, `topics`, `summary`, `clusterId`), not *soft-delete the row*. The data is retained for analytical aggregates with PII removed — consistent with how anonymous Google-Reviews rows already render today.
  - Adding a `deletedAt` column now would force a migration whose only consumer is a hypothetical future filter the spec doesn't propose.
  - The spec's wording is recorded as a small wording drift in §10 (closed).
- **No worker changes.** `apps/worker/src/processors/` is untouched. No erasure worker exists today (§8.4); see Out-of-scope above for the deferral.
- **No public API changes.** `/v1/public/surveys/:id/respond` and the rest of the public surface are unmodified.
- **No widget / embed changes.** `packages/embed` is untouched.

### 2.2 High-level component map

```mermaid
graph TD
    subgraph apps/web
        DP[/admin/surveys/[id]/page.tsx<br/>owns wave + filter state]
        DBF[DistributionBatchesFilter<br/>controlled, lifted state]
        RS[ResponseSection<br/>rewritten]
        FB[FilterBar]
        FCG[FilterChipGroup]
        SDR[SubmittedDateRange]
        DP --> DBF
        DP --> RS
        RS --> FB
        FB --> FCG
        FB --> SDR
    end

    subgraph apps/api
        SR[surveys.ts]
        LIST[/GET /v1/surveys/:id/responses/<br/>NEW]
        XLS[/GET /v1/surveys/:id/responses.xlsx/<br/>NEW]
        DETAIL[/GET /v1/surveys/:id/<br/>responses inline removed R21/]
        XU[utils/excelExport.ts<br/>NEW]
        SR --> LIST
        SR --> XLS
        SR --> DETAIL
        XLS --> XU
    end

    subgraph packages/shared
        ZS[zod/responseFilters.schema.ts<br/>NEW]
        CONST[constants.ts<br/>+CSAT +CES +bandsForScale<br/>+EXPORT_ROW_CAP<br/>+EXPORTS_POWERED_BY_URL]
        DT[datetime.ts<br/>existing — no change]
    end

    LIST -.- ZS
    XLS -.- ZS
    RS -.- ZS
    FB -.- CONST
    XU -.- CONST
    XU -.- DT
    SDR -.- DT

    subgraph packages/database
        PR[(Prisma · SurveyResponse<br/>no schema change)]
    end

    LIST --> PR
    XLS --> PR
```

---

## 3. Shared data, constants, and Zod contracts

### 3.1 `packages/shared/src/constants.ts` — additions

Today the file holds `SENTIMENT` (thresholds `0.3` / `-0.3`) and `NPS` (`PROMOTER_THRESHOLD = 9`, `DETRACTOR_THRESHOLD = 6`). The RFC adds:

```ts
// CSAT and CES bands — Phase 1 supports the current scales; bandsForScale()
// is the extension point for future scales (e.g., NPS 1–5, CES 1–5) so the
// chip UI and the API filter translator never hard-code a scale shape.

export type ScoreScale = '0_10' | '1_5' | '1_7'
export type BandKey =
  | 'promoter' | 'passive' | 'detractor'
  | 'satisfied' | 'neutral' | 'dissatisfied'
  | 'easy' | 'hard'

interface BandTable {
  // ordered for display (left-to-right in chips)
  bands: Array<{ key: BandKey; label: string; min: number; max: number }>
  // band lookup for a numeric score
  bandOf(score: number): BandKey | null
}

export const NPS = {
  // existing — kept for back-compat with current consumers
  PROMOTER_THRESHOLD: 9,
  DETRACTOR_THRESHOLD: 6,
  isPromoter(score: number): boolean { return score >= 9 },
  isDetractor(score: number): boolean { return score <= 6 },
  // new — scale-aware band table
  bandsForScale(scale: ScoreScale): BandTable { /* ... */ },
} as const

export const CSAT = {
  bandsForScale(scale: ScoreScale): BandTable { /* ... */ },
} as const

export const CES = {
  bandsForScale(scale: ScoreScale): BandTable { /* ... */ },
} as const

// Single source of truth: type → default scale (Phase 1 is the only scale)
// When future scales arrive on Survey.scoreScale, this resolver consults the
// column; Phase 1 has no such column so it returns the current default.
export function defaultScaleForType(type: 'NPS' | 'CSAT' | 'CES'): ScoreScale {
  switch (type) {
    case 'NPS': return '0_10'
    case 'CSAT': return '1_5'
    case 'CES': return '1_7'
  }
}

// SENTIMENT — unchanged from today. See §10 OQ resolution.

// Export controls
export const EXPORT_ROW_CAP = 50_000
export const EXPORTS_POWERED_BY_URL = 'https://customereq.wellnessatwork.me'
```

**Phase 1 band tables (verbatim from the spec):**

| Type | Scale | Promoter / Satisfied / Easy | Passive / Neutral / (Neutral) | Detractor / Dissatisfied / Hard |
|---|---|---|---|---|
| NPS | 0–10 | 9–10 | 7–8 | 0–6 |
| CSAT | 1–5 | 4–5 | 3 | 1–2 |
| CES | 1–7 | 5–7 | 4 | 1–3 |

`bandsForScale('1_5')` for NPS and CES is reserved as a no-throw lookup that returns the future tables (`Promoter (5) / Passive (4) / Detractor (1–3)`; `Easy (5) / Neutral (4) / Hard (1–3)`) so the unit tests can address them; the API never selects them until `Survey.scoreScale` ships in a successor phase.

### 3.2 `packages/shared/src/zod/responseFilters.schema.ts` — new

```ts
import { z } from 'zod'

export const WaveSelection = z.union([
  z.literal('all'),
  z.literal('direct'),
  z.string().regex(/^c[a-z0-9]{24,}$/),    // cuid for a batchId
])

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')

export const ScoreBand = z.enum([
  'promoter', 'passive', 'detractor',
  'satisfied', 'neutral', 'dissatisfied',
  'easy', 'hard',
])
export const SentimentBand = z.enum(['positive', 'neutral', 'negative'])

export const ResponseFilters = z.object({
  wave: WaveSelection.default('all'),
  submittedFrom: dateOnly.optional(),
  submittedTo: dateOnly.optional(),
  scoreBands: z.array(ScoreBand).optional(),
  sentimentBands: z.array(SentimentBand).optional(),
  channels: z.array(z.string()).optional(),
})

export const ResponseListQuery = ResponseFilters.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
})

export const ResponseExportQuery = ResponseFilters  // no page/pageSize
export type ResponseFilters = z.infer<typeof ResponseFilters>
```

Notes:

- `pageSize` accepts `[1, 500]` server-side (R11a) — the UI chip selector emits only 25/50/100; tests cover both UI and direct-API tiers.
- `Survey.type ∈ {NPS, CSAT, CES}` gate on `scoreBands` / `sentimentBands` is enforced at the route handler (not the schema), because the schema is generic across endpoints and the gate depends on the survey row.
- The `submittedTo` end-of-day expansion runs in the route handler using `endOfDayInBrandTz(parseISODateAsLocal(submittedTo), brand.timezone)` — no schema-level mutation.

### 3.3 Type-derived band gating helpers

Two pure helpers ship alongside the constants (used by web + API):

```ts
export function shouldShowScoreBand(type: string): boolean {
  return type === 'NPS' || type === 'CSAT' || type === 'CES'
}

export function shouldShowSentimentBand(
  type: string,
  hasOpenEndedQuestion: boolean,
): boolean {
  return shouldShowScoreBand(type) && hasOpenEndedQuestion
}
```

These live next to the constants so unit tests catch any drift between the chip-group visibility rules and the gates the cover-block builder uses to write `Score band: N/A` / `Sentiment band: N/A` (R15).

---

## 4. API design

### 4.1 `GET /v1/surveys/:id/responses` — list

**Location**: `apps/api/src/routes/surveys.ts`, registered alongside the existing `GET /v1/surveys/:id`.

**Auth**: existing Clerk JWT plus `multiTenant` plugin populates `request.brandId`.

**Audit**:

```ts
config: {
  auditAction: 'survey.responses.list',
  auditResourceType: 'survey',
  auditAllowlist: [
    'wave', 'submittedFrom', 'submittedTo',
    'scoreBands', 'sentimentBands', 'channels',
    'page', 'pageSize', 'total', 'requestIp',
  ],
}
```

**Handler outline**:

```ts
const query = ResponseListQuery.parse(request.query)

const survey = await fastify.prisma.survey.findFirst({
  where: { id, brandId: request.brandId, deletedAt: null },
  select: { id: true, type: true, brandId: true, questions: true, scoreScale: false /* not in schema */ },
})
if (!survey) return reply.status(404).send({ error: 'Survey not found' })

const brand = await fastify.prisma.brand.findUnique({
  where: { id: request.brandId },
  select: { timezone: true, locale: true, memberIdentifierKind: true },
})
// brand is guaranteed by multiTenant plugin

const where = buildResponseWhere({ surveyId: id, brandId: request.brandId, filters: query, survey, brand })

const [total, rows] = await Promise.all([
  fastify.prisma.surveyResponse.count({ where }),
  fastify.prisma.surveyResponse.findMany({
    where,
    orderBy: { completedAt: 'desc' },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    select: SURVEY_RESPONSE_ROW_SELECT,
  }),
])

const data = rows.map((r) => projectResponseRow(r, brand))
return reply.status(200).send({
  data, total, page: query.page, pageSize: query.pageSize,
  totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
})
```

`SURVEY_RESPONSE_ROW_SELECT` returns: `id, answers, score, sentiment, confidence, topics, summary, channel, completedAt, importedAt, distributionBatchId, importBatchId, memberId, member { firstName, lastName, email, phone, externalId }, distributionBatch { label }, importBatch { name }`. The web payload (`ResponseRow`) is the post-`projectResponseRow` shape with `member.identifierValue` resolved via `brand.memberIdentifierKind` so the client never reads PII it isn't supposed to (avoids leaking `phone` to an EXTERNAL_ID-keyed brand).

**Filter translation** (`buildResponseWhere`):

```ts
function buildResponseWhere(args): Prisma.SurveyResponseWhereInput {
  const { surveyId, brandId, filters, survey, brand } = args
  const where: Prisma.SurveyResponseWhereInput = {
    surveyId,
    brandId,                     // Rule 6: tenant scope (also enforced by middleware)
    survey: { deletedAt: null }, // Issue #332 pattern — survey-level soft-delete
  }

  // Wave
  if (filters.wave === 'direct') {
    where.distributionBatchId = null
    where.importBatchId = null      // direct = neither batch nor import
  } else if (filters.wave === 'all') {
    // no-op
  } else {
    where.distributionBatchId = filters.wave   // batchId
  }

  // Submitted range (COALESCE(completedAt, importedAt) in brand TZ)
  if (filters.submittedFrom || filters.submittedTo) {
    const submittedOr: Prisma.SurveyResponseWhereInput[] = []
    const from = filters.submittedFrom
      ? startOfDayInBrandTz(parseISODateAsLocal(filters.submittedFrom), brand.timezone)
      : undefined
    const to = filters.submittedTo
      ? endOfDayInBrandTz(parseISODateAsLocal(filters.submittedTo), brand.timezone)
      : undefined
    submittedOr.push({ completedAt: { gte: from, lte: to } })
    submittedOr.push({
      completedAt: null,
      importedAt: { gte: from, lte: to },
    })
    where.OR = submittedOr
  }

  // Score band (gated by type)
  if (filters.scoreBands?.length && shouldShowScoreBand(survey.type)) {
    const scale = defaultScaleForType(survey.type)
    const ranges = filters.scoreBands.map((k) => bandRangeFor(survey.type, scale, k))
    where.OR = (where.OR ?? []).concat(
      ranges.map(({ min, max }) => ({ score: { gte: min, lte: max } })),
    )
  }

  // Sentiment band
  if (filters.sentimentBands?.length) {
    const sentOR: Prisma.SurveyResponseWhereInput[] = filters.sentimentBands.flatMap((b) => {
      if (b === 'positive') return [{ sentiment: { gt: SENTIMENT.POSITIVE_THRESHOLD } }]
      if (b === 'negative') return [{ sentiment: { lt: SENTIMENT.NEGATIVE_THRESHOLD } }]
      // neutral
      return [{ sentiment: { gte: SENTIMENT.NEGATIVE_THRESHOLD, lte: SENTIMENT.POSITIVE_THRESHOLD } }]
    })
    // intersect with prior OR group: we use `AND` to enforce the spec's "intersect across groups"
    where.AND = (where.AND ?? []).concat({ OR: sentOR })
  }

  // Channels (multi-select, intersect-across)
  if (filters.channels?.length) {
    where.channel = { in: filters.channels }
  }

  return where
}
```

The "intersect across groups, union within group" semantics map to Prisma as: each group becomes either a top-level field (`channel: { in }`) or an `AND.{ OR: [...] }` block. The wave + submitted + score-band ORs share the top-level `OR` only when they're a single group; the multi-group case folds into `AND.{ OR: [...] }`. The `compositeOr` helper inside `buildResponseWhere` keeps this clean; unit tests snapshot the resolved `where` for each combination (see §9.1).

**404 contract**: cross-tenant returns 404 (R19, Issue #332 pattern) — verified by checking `survey.brandId === request.brandId` is implicit in the `findFirst({ where: { id, brandId: request.brandId, deletedAt: null } })` filter.

**Custom-type survey contract** (PR-feedback R-Round2): if `Survey.type ∉ {NPS, CSAT, CES}` and the client sent `scoreBands` or `sentimentBands`, the route silently ignores those filters (does not 422). The reasoning: the client-side UI hides the chip groups for custom-type surveys (per `shouldShow*` gates), so a payload that includes them is necessarily a stale local state from a type swap. 422 would surface as a visible error to a user who didn't do anything wrong; silent ignore matches the chip-group hidden state. The response payload's filter echo (used by the export cover block) marks `Score band: N/A` / `Sentiment band: N/A` (R15) so a downstream possessor sees the actual scope.

### 4.2 `GET /v1/surveys/:id/responses.xlsx` — export

Same filter inputs (`ResponseExportQuery`); no `page/pageSize`. Cap check happens early:

```ts
const total = await fastify.prisma.surveyResponse.count({ where })
if (total > EXPORT_ROW_CAP) {
  return reply.status(413).send({
    code: 'EXPORT_TOO_LARGE',
    total, capacity: EXPORT_ROW_CAP,
    message: `Filtered set is ${total} responses — narrow the filters (try a date range or a single wave) and try again.`,
  })
}

const rows = await fastify.prisma.surveyResponse.findMany({
  where,
  orderBy: { completedAt: 'desc' },
  select: SURVEY_RESPONSE_ROW_SELECT,
})

const operatorEmail = await resolveOperatorEmail(request)   // see §4.2.1
const buffer = await renderResponsesXlsx({
  survey, brand, filters: query, rows, total, operatorEmail,
})

reply
  .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  .header('Content-Disposition', `attachment; filename="${exportFilename(survey, brand)}"`)
  .send(buffer)

// audit (handled by per-route plugin):
//   action: 'survey.responses.export'
//   metadata.aiVintageNonNullCount: rows.filter(r => r.sentiment !== null || (r.topics?.length ?? 0) > 0 || r.summary != null).length
//   metadata: { wave, submittedFrom, submittedTo, scoreBands, sentimentBands, channels, total, requestIp }
```

The `aiVintageNonNullCount` is computed once and passed into the audit plugin via the existing `request.auditExtra` extension point (set in the handler before reply.send — same pattern surveys.ts uses for `priorState` on delete).

#### 4.2.1 Operator email resolution

The audit plugin already captures `requestIp` via the per-route allowlist (`requestIp` listed). Operator email is on the Clerk session token claims — `request.user.email` per the auth plugin contract. The export cover block reads the same value: one resolution per request. No DB lookup needed.

### 4.3 R21 — remove vestigial inline `responses: { take: 20, ... }`

Existing `GET /v1/surveys/:id` returns inline `responses` payload (`apps/api/src/routes/surveys.ts:129–144`) that no web consumer reads. The RFC removes it in this issue's impl commit; the only consumer of `/v1/surveys/:id`'s response-side data is the count badge (`_count.responses`), which is retained. Integration test asserts the field is absent post-change (already in spec §Validation Plan).

### 4.4 Filter row echo in the list response

To make the export cover block deterministic without re-parsing the query string, the **list endpoint** echoes the *effective* (post-gate) filters on every response:

```json
{
  "data": [...],
  "total": 412,
  "page": 1,
  "pageSize": 25,
  "totalPages": 17,
  "filters": {
    "wave": "all",
    "submittedFrom": null,
    "submittedTo": null,
    "scoreBands": [],
    "sentimentBands": [],
    "channels": [],
    "scoreBandGate": { "hidden": false },
    "sentimentBandGate": { "hidden": false }
  }
}
```

The export endpoint computes the same `filters` shape and feeds it into the cover-block builder. The web client uses `filters.scoreBandGate.hidden` / `sentimentBandGate.hidden` to drive the chip-group visibility (R9a, R9b) without reading `Survey.type` in two places.

---

## 5. Frontend design

### 5.1 State lift to `/admin/surveys/[id]/page.tsx`

```tsx
// New top-level state on the detail page:
const [wave, setWave] = useState<WaveSelection>('all')
const [hasOpenEndedQuestion, setHasOpenEndedQuestion] = useState(false)  // derived from survey.questions
const [responseSectionVisible, setResponseSectionVisible] = useState(responsesCount > 0)

// Lift to DistributionBatchesFilter (new controlled API):
<DistributionBatchesFilter
  surveyId={surveyId}
  brandTimezone={effectiveBrand.timezone ?? 'UTC'}
  brandLocale={effectiveBrand.locale ?? 'en-US'}
  hasDirectResponses={responsesCount > 0}
  value={wave}
  onChange={setWave}
/>

// And down to ResponseSection (new):
<ResponseSection
  surveyId={surveyId}
  surveyType={survey.type}
  surveyName={survey.name}
  brandTimezone={effectiveBrand.timezone ?? 'UTC'}
  brandLocale={effectiveBrand.locale ?? 'en-US'}
  memberIdentifierKind={effectiveBrand.memberIdentifierKind}
  responsesCount={responsesCount}
  questions={(survey.questions as Question[])}
  wave={wave}
/>
```

`DistributionBatchesFilter` gets one new optional prop (`value`) and remains backwards-compatible with uncontrolled use elsewhere. The local `selection` `useState` falls back to `value ?? 'all'` when `value` is provided (controlled mode).

### 5.2 `ResponseSection` — rewritten

A single-file component (with three colocated subcomponents for testability — see §5.3):

```
apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseSection.tsx     (rewrite)
apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseTable.tsx       (NEW)
apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponsePagination.tsx  (NEW)
apps/web/src/app/(admin)/admin/surveys/[id]/components/AiCaveatIndicator.tsx   (NEW)
```

**State owned by `ResponseSection`**:

- `filters: ResponseFilters` (synced with URL query string via `useSearchParams` for shareability — see §5.4)
- `pageSize: 25 | 50 | 100` (sessionStorage-backed for the page session per R11)
- `page: number`
- `expandedRowId: string | null` (single-row expand-in-row)
- `data, total, totalPages, filtersEcho`: from latest fetch
- `loading, error`

**Effect**: `useEffect(() => { fetch(...) }, [surveyId, wave, filters, page, pageSize])`.

`wave` is a prop from the parent; everything else is local.

**Export trigger** (R13): a single `<a>` anchor:

```tsx
<a
  href={`${API_URL}/v1/surveys/${surveyId}/responses.xlsx?${buildExportQs({ wave, ...filters })}`}
  download
  className={isExportDisabled ? 'pointer-events-none opacity-50' : ''}
  aria-disabled={isExportDisabled}
  title={
    total === 0
      ? 'Nothing to export — current filters yield 0 responses.'
      : total > EXPORT_ROW_CAP
        ? `Filtered set is ${total} responses — narrow the filters (try a date range or a single wave) and try again.`
        : 'Exports rows matching current filters.'
  }
>
  Export to Excel
</a>
```

**Authorization for the download** — the browser-issued GET on the `<a href>` does not carry a Bearer header. Two options:

- **Option A (chosen)**: append `?token=<JWT>` to the URL and have the route accept `?token=` as an auth credential. The auth plugin already supports this for the Clerk lazy-upsert callbacks — verify by re-reading `apps/api/src/plugins/auth.ts` in the impl phase. If the plugin only accepts `Authorization: Bearer`, the impl phase extends it (lives next to existing token-from-query support, ~10 lines).
- **Option B**: a one-shot `POST /v1/surveys/:id/responses.xlsx/sign` returns a short-lived signed URL the `<a href>` consumes. Heavier; deferred unless Option A turns out to be infeasible after the auth-plugin re-read.

This is the same shape #18 (project rule on "validate end-to-end") warns about — the browser issues the GET, so Bearer-in-header is not an option, and Playwright E2E must exercise the auth path. The chosen approach (A) is verified by the existing `getAuthToken(getToken)` helper at `apps/web/src/lib/config.ts` returning a token usable in URL or header.

### 5.3 Filter components (new, shared)

```
apps/web/src/components/filters/
├── FilterChipGroup.tsx     (lifted from existing FilterChips.tsx — extends to support multi/single + count-badge)
├── SubmittedDateRange.tsx  (NEW — built on packages/shared/src/datetime.ts)
├── FilterBar.tsx           (NEW — overflow-aware composer; collapses Channel into More-filters popover)
├── filter-chips.logic.ts   (lifted — `toggleChip` retained; add `bandChipsForType(type, scale)`)
└── responseFilters.url.ts  (NEW — URL-state codec; pairs query-string round-trip with the Zod schema)
```

`FilterChipGroup` accepts `{ key, label, options[], selected[], onChange, helpText? }`. The score-band and sentiment-band groups are stamped from `bandChipsForType(survey.type)` and the SENTIMENT constants respectively. `FilterBar` composes the four groups in the spec's order (`Score band · Sentiment band · Submitted · Channel`); the wave selector is **not** part of `FilterBar` — it lives in the parent.

`FilterBar` overflow: a single `useEffect`-driven resize observer measures the bar; if it overflows the container at the current viewport, **Channel** moves into a popover with the same `FilterChipGroup` inside (R9d). The other three groups never collapse (Score Band first per default order; Submitted is the natural anchor; Sentiment Band fits comfortably).

The existing surveys-list `FilterChips.tsx` usage at `/admin/surveys` migrates to `FilterChipGroup` in the same commit; the old component file is deleted (no copy remains — R9c explicit).

### 5.4 URL state for filters

Filters serialise into the URL query string so a deep-linked filter view is shareable inside a brand. `responseFilters.url.ts` provides:

```ts
export function encodeFiltersToQs(state: ResponseFilters): string
export function decodeFiltersFromQs(qs: URLSearchParams): ResponseFilters
```

The encoder emits `?scoreBands=detractor,passive&channels=email,sms&submittedFrom=2026-04-15&submittedTo=2026-04-22`. The decoder validates via the same Zod schema the API uses (`responseFilters.schema.ts`) — invalid values silently drop to defaults (e.g., an unknown band key produces no filter, not a render error).

### 5.5 Empty / error states

- **Zero responses (survey-level)** — when the parent's `responsesCount === 0`, `ResponseSection` renders a non-table `EmptyState` body (R23). The table is not mounted (no fetch). The Export `<a>` is disabled with the disabled tooltip.
- **Zero filtered results** — when `total === 0` from a successful fetch, the table area renders the "No responses match the current filters." copy plus a "Clear filters" link that resets local filter state to defaults (R24). The Export `<a>` is disabled.
- **Network error** — a single retryable `ErrorState` ("Failed to load responses — try again") with a retry button. Same shape as the existing LoopMonitorSection error state.
- **AI cells empty** — when `sentiment / topics / summary` are null/empty, the cell is empty (no chip, no `—`); the AI-column-group caveat indicator (`AiCaveatIndicator`) is always visible at the column-group header regardless of cell content.

### 5.6 AI caveat indicator

A small `<button>` (info icon) with a tooltip (`apps/web/src/components/ui/tooltip.tsx` existing) carrying the verbatim caveat copy (R2a, R6a). No internal issue numbers. The same copy is written into `excelExport.ts` row 13 — both sites read the literal from a single string constant `AI_FIELDS_CAVEAT` exported from `packages/shared/src/constants.ts` to avoid drift.

---

## 6. Excel rendering

### 6.1 Library — ExcelJS

**Choice**: ExcelJS (`exceljs` on npm, ~1.3MB packaged size, no DOM deps, MIT). Resolves OQ-1.

**Why ExcelJS over SheetJS (`xlsx`)**:

- ExcelJS is a Node-native streaming writer; SheetJS's free build requires the whole workbook in memory. At our 50K-row cap × ~20 columns × occasional long verbatim, ExcelJS's `WorkbookWriter` (`writeXLSX`) keeps memory bounded.
- ExcelJS's cell-level styling (`alignment.wrapText`, `fill.fgColor`, hyperlinks via `cell.value = { text, hyperlink }`) is built-in and well-documented — needed for the 14-row cover block + Powered-by hyperlink.
- SheetJS's free build (`xlsx`) has been on a deprecation path for cell styling (paid-only features); avoiding the upsell is healthier.
- Both are MIT and active. Decision is non-reversible at low cost (the cover-block builder is ~150 lines of code; swapping libraries is a 1-day rewrite if needed).

**Risk**: ExcelJS has had two CVEs in the past 18 months (prototype-pollution-adjacent; patched within 30 days each). Mitigation: pin to the latest minor (`exceljs@^4.4.0` at time of writing) and let Dependabot bump. The cover-block builder doesn't accept user-supplied template input that could exploit prototype-pollution; the input is always our own typed `RenderInput`.

**Verification step before merge**:

```bash
pnpm add -F @customerEQ/api exceljs
du -sh node_modules/.pnpm/exceljs@*/  # expect ~1.3MB
```

Recorded as a single check in §9 validation plan.

### 6.2 Module: `apps/api/src/utils/excelExport.ts`

```ts
export interface RenderInput {
  survey: { id: string; name: string; type: string; questions: Question[] }
  brand: { timezone: string; locale: string; memberIdentifierKind: MemberIdentifierKind }
  filters: ResponseFilters & {
    scoreBandGate: { hidden: boolean }
    sentimentBandGate: { hidden: boolean }
  }
  rows: ResponseRow[]   // server-projected (member.identifierValue already resolved)
  total: number
  operatorEmail: string
}

export async function renderResponsesXlsx(input: RenderInput): Promise<Buffer>
```

**Cover block (rows 1–14)** — keyed by labels in column A, values in column B; row 12 blank; row 13 the AI-fields disclaimer (italicised, merged across A–N or so); row 14 the Powered-by row with `EXPORTS_POWERED_BY_URL` hyperlink on the word `CustomerEQ`:

| Row | A (label) | B (value) |
|---|---|---|
| 1 | Survey | `<survey.name>` |
| 2 | Survey type | `NPS` / `CSAT` / `CES` / `Custom` |
| 3 | Survey ID | `<survey.id>` |
| 4 | Exported at | `formatInBrandTz(now, tz, locale, 'MMM d, yyyy h:mm a zzz')` |
| 5 | Exported by | `<operatorEmail>` |
| 6 | Wave | `All waves and direct responses` / `<batch.label>` / `Direct responses` |
| 7 | Submitted range | `<from> – <to>` in brand TZ, or `All time` |
| 8 | Score band | `Detractor, Passive` etc., or `All bands`, or `N/A` (when `scoreBandGate.hidden`) |
| 9 | Sentiment band | `Negative` etc., or `All sentiments`, or `N/A` (when `sentimentBandGate.hidden`) |
| 10 | Channels | `email, sms` etc., or `All channels` |
| 11 | Total rows | `<total>` |
| 12 | *(blank)* | |
| 13 | *(merged italicised)* | AI-fields disclaimer (verbatim from `AI_FIELDS_CAVEAT`) |
| 14 | *(merged)* | `Powered by` + hyperlink `CustomerEQ` → `EXPORTS_POWERED_BY_URL` |
| 15 | *(blank)* | |

**Data sheet (row 16 onward)**:

- Row 16: column headers. Static columns first: `Member, Channel, Submitted, Score, AI · Sentiment, AI · Topics, AI · Summary`. Then one column per `survey.questions[i]` with the **full** question text as the header (no truncation, no AI prefix — these are the customer's questions).
- Row 17+: data rows.
  - **Member**: `firstName + ' ' + lastName + ' (' + identifierValue + ')'` per `Brand.memberIdentifierKind`; empty cell when `memberId IS NULL` (anonymous).
  - **Channel**: raw `SurveyResponse.channel`.
  - **Submitted**: `formatInBrandTz(row.completedAt ?? row.importedAt, tz, locale, 'MMM d, yyyy h:mm a zzz')`.
  - **Score**: numeric; cell format `0` (no decimals).
  - **AI · Sentiment**: `Positive` / `Neutral` / `Negative` text (not the chip — Excel can't render colored chips well across viewers; the text label is the durable signal).
  - **AI · Topics**: comma-joined list.
  - **AI · Summary**: `summary` text; `wrapText: true` so long summaries flow.
  - **Per-question cells**: `String(row.answers[question.id] ?? '')` — for numeric / choice answers the renderer relies on `String()` to produce the literal stored value. The cover-block header notes the AI columns; per-question columns carry the customer's literal answer.

**Cell width / wrap**: column widths default to 20 except for free-text columns (Summary + per-question text questions) which default to 60 with `wrapText: true`. Question-text headers wrap into the header row (height auto).

**Memory bounds**: ExcelJS's `Workbook` (in-memory) handles 50K × 20 cells at ~250–400 MB RSS — within container limits (containers are 2GB). If a future audit shows memory pressure, swap to `WorkbookWriter` streaming, which keeps RSS below 100 MB at the cost of slightly slower cell-styling. The constant-cap approach lets us pick this up later without changing the response contract.

### 6.3 Filename

```ts
export function exportFilename(survey: { name: string }, brand: { timezone: string; locale: string }): string {
  const date = formatInBrandTz(new Date(), brand.timezone, brand.locale, 'yyyy-MM-dd')
  const safeSlug = survey.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `survey-${safeSlug}-responses-${date}.xlsx`
}
```

The 60-char slug cap defends against pathological survey names; tests cover boundary cases (empty name, all-special-chars, 200-char name).

### 6.4 Powered-by host constant

`EXPORTS_POWERED_BY_URL` lives in `packages/shared/src/constants.ts` (not `branding.ts` — keeping the constants surface flat for now; can split later when more branding constants accrue). The cover-block builder reads it; no other site reads it for export purposes. The existing `apps/web/src/app/layout.tsx` "Powered by CustomerEQ" copy is unrelated (it's the marketing-page footer); spec self-audit Round 3 already verified the host name's provenance.

---

## 7. Compliance & audit

All compliance treatments from the spec map to the surfaces already named:

- **GDPR Art. 5(1)(f) (integrity & confidentiality)** — both endpoints filter on `request.brandId`; cross-tenant returns 404 (integration test).
- **GDPR Art. 5(1)(a) / Art. 22** — AI columns rendered with explicit `AI ·` prefix on screen and in `.xlsx`; cover-block row 13 disclaimer; no automated decision is gated on `sentiment / topics / summary` in this surface (display-only).
- **GDPR Art. 17 (right to erasure)** — *forward-looking*. The erasure worker does not exist today (§8.4). Phase 1 surfaces inherit *survey-level* soft-delete via `Survey.deletedAt IS NULL`. Anonymous rows render `member: null` → `—` in UI / empty Member cell in export. When the future erasure worker ships, zeroing `memberId + sentiment + confidence + topics + summary + clusterId` produces correct downstream behavior **without changes to this surface**.
- **GDPR Art. 30 / SOC2 CC6.6, CC7.2, PI1.4** — audit rows on both endpoints; export audit captures `aiVintageNonNullCount`, `requestIp`, exporter email (in the audit `userId` field already populated by auth plugin), and the entire filter set via the allowlist.
- **CCPA §1798.105** — same coverage as GDPR Art. 17 (survey-level soft-delete inherited; row-level soft-delete is out of scope).

---

## 8. Risks & mitigations

### 8.1 ExcelJS memory pressure under simultaneous large exports

**Risk**: two operators triggering 50K-row exports in the same minute push the API container's RSS over the budget.
**Mitigation**: column-text-length budgeting (cell content is bounded by `Member.email` field-length + answer text), per-request memory ceiling at the runtime (Node `--max-old-space-size`), and the 50K cap itself. If audit shows the spike pattern (`aiVintageNonNullCount` paired with `total > 30000`) hitting frequently, swap ExcelJS's `Workbook` → `WorkbookWriter` (streaming) — a same-shape API.
**Severity**: low (no two operators have ever triggered concurrent 50K exports in production). Monitor via the audit row's `total` field.

### 8.2 Filter-row overflow false positives

**Risk**: the resize-observer-driven overflow detection misclassifies in unusual viewports (e.g., DevTools open).
**Mitigation**: the overflow detection is debounced by 100ms; Channel always collapses last (so other groups remain inline at all viewports). The fallback is `lg:` Tailwind breakpoint media query at <1024px → Channel-in-popover unconditionally.
**Severity**: low (cosmetic).

### 8.3 Date filter timezone boundary correctness

**Risk**: a brand that switches `Brand.timezone` mid-day produces stale `endOfDayInBrandTz` results for already-cached query strings (e.g., the user's open tab still holds the old TZ in URL state).
**Mitigation**: the URL state holds the *date string only*; the server interprets it in the *current* `Brand.timezone`. A mid-day TZ change rebounds correctly on next fetch.
**Severity**: very low.

### 8.4 Erasure worker dependency

**Risk**: the spec's R-erasure passage implies an erasure worker change; no such worker exists. The risk is that a downstream possessor expects PII zeroing when none happens.
**Mitigation**: the RFC names this as a forward-looking constraint and explicitly does **not** ship the worker. The list endpoint already renders `member: null` correctly; the export already renders an empty Member cell; both inherit "right behavior on null FK" without needing the worker to exist. When the worker is built (a future issue under #235 or a dedicated compliance ticket), it adds the zeroing logic without touching this surface.
**Severity**: low (regulatory-stance risk only — the surface doesn't *exfiltrate* PII for non-consenting members because consent is enforced upstream at `/v1/public/surveys/:id/respond`).

### 8.5 SENTIMENT threshold drift

**Risk**: the spec mandates `0.33` thresholds; we keep `0.3`. Auditors comparing the spec to the code will see drift.
**Mitigation**: the RFC §10 records this explicitly with a permanent decision; the spec is amended in this commit to match (one-line edit). The 5 other surfaces using SENTIMENT consume the same constant; keeping them aligned is the operative reason for the decision.
**Severity**: very low.

### 8.6 ExcelJS CVE history

Already covered in §6.1. Pin minor, monitor Dependabot.

### 8.7 Bundle weight (web)

`ResponseSection` adds a moderate amount of client JS (filter components + the ExcelJS dep is server-only, not bundled in the web app). Existing admin pages already ship with the survey-form preview renderer; the marginal bundle increase is ~15 KB gzipped (estimated from the FilterChipGroup and SubmittedDateRange code sizes). No code-split necessary; the existing `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` is already a client component.

---

## 9. Validation Plan

Test names use the spec's `R<num>` tags so anyone reading the test list can map back to a spec line.

### 9.1 Unit (Vitest, `pnpm test:smoke`)

| Test | Covers |
|---|---|
| Member-column render — both names present | R3 |
| Member-column render — both names null (parenthesized identifier stands alone) | R3 |
| Member-column render — `memberId IS NULL` → `—` | R3, R25 |
| Score-band derivation — NPS 0-10 (6→Detractor, 7→Passive, 8→Passive, 9→Promoter) | R9a |
| Score-band derivation — CSAT 1-5 (2→Dissatisfied, 3→Neutral, 4→Satisfied) | R9a |
| Score-band derivation — CES 1-7 (3→Hard, 4→Neutral, 5→Easy) | R9a |
| Score-band derivation — `bandsForScale('1_5')` addressable on NPS + CES (future scale) | R9a |
| `shouldShowScoreBand(type)` — true only for NPS/CSAT/CES | R9a, §3.3 |
| `shouldShowSentimentBand(type, hasText)` — true only when both hold | R9b |
| Sentiment-band derivation — `0.31 → positive`, `0.30 → neutral`, `0.29 → neutral`, `-0.30 → neutral`, `-0.31 → negative`, `null → null` | R9b (with current 0.3 thresholds) |
| `buildResponseWhere` — snapshot for each filter combination (wave + score + sentiment + submitted + channel) | R7-R10 |
| Filter-bar overflow — given a renderable width and 4 groups, expect Channel inline vs in popover | R9d |
| Excel cover-block builder — rows 1–14 cell map for `(survey, brand, filters, total, operatorEmail)` including the AI-fields disclaimer row and Powered-by hyperlink | R15 |
| `exportFilename` — boundary cases (empty name, special chars, long names) | R14 |
| URL codec — round-trip `{wave, ...filters}` for every combination | §5.4 |
| `toggleChip` — existing test retained after migration | R9c |

### 9.2 Integration (Vitest + Supertest, `pnpm test:integration`)

| Test | Covers |
|---|---|
| `GET /v1/surveys/:id/responses` happy path — payload includes `answers`, member identity, batch label, channel, score, completedAt, importedAt, **sentiment / confidence / topics / summary** | R19 |
| Tenant isolation — cross-tenant 404 (Brand A token → Brand B survey) for both endpoints | R12, R19, R20 |
| Wave + score-band + sentiment-band + submitted + channel composition — any subset returns rows where every active filter holds | R7-R10 |
| Score-band correctness — NPS rows scored 9-10 under `scoreBands=promoter`, 7-8 under `passive`, 0-6 under `detractor`; analogous for CSAT and CES | R9a |
| Sentiment-band correctness — boundary rows under each band (using current 0.3 thresholds) | R9b |
| Date filter TZ end-of-day expansion — response at `completedAt=2026-05-19T06:00:00Z` (PT = May 18, 23:00) included for `submittedTo=2026-05-18` under `Brand.timezone='America/Los_Angeles'` | R8 |
| Date filter — `COALESCE(completedAt, importedAt)` applied for historical-import rows | R8, R26 |
| Channel filter — multi-select union; empty selection (all channels deselected) returns 0 rows | R9 |
| Pagination — `pageSize=200` from UI tier rejected (422); `[25,50,100]` accepted | R11 |
| Pagination — direct-API tier `pageSize=500` accepted; `pageSize=501` rejected (422) | R11a |
| Export cap — filter set with `total > 50000` returns 413 `{code: 'EXPORT_TOO_LARGE', total, capacity: 50000, message}` | R18a |
| Anonymous member — `memberId IS NULL` row appears with `member: null`; export Member cell empty | R14, R25 |
| Survey-level soft-delete — soft-deleted survey returns 404 for both endpoints | Rule 26 / Issue #332 |
| Custom-type survey — `Survey.type = 'CUSTOM'` returns `filters.scoreBandGate.hidden: true` and `filters.sentimentBandGate.hidden: true`; export cover block has `Score band: N/A` and `Sentiment band: N/A` | R9a, R9b, R15 |
| Audit — export endpoint writes audit row with `action='survey.responses.export'`, `metadata.total ≥ 0`, `metadata.aiVintageNonNullCount ≥ 0`, `metadata.requestIp` populated | R22 |
| Audit — list endpoint writes audit row with `action='survey.responses.list'` | R22 |
| R21 — `GET /v1/surveys/:id` response no longer contains `responses` array; `_count.responses` retained | R21 |
| XLSX shape — parse export body, assert (a) rows 1–11 contain expected labels, (b) row 13 = AI-fields disclaimer copy, (c) row 14 contains `Powered by CustomerEQ` with hyperlink to `EXPORTS_POWERED_BY_URL`, (d) data header row 16 contains `AI · Sentiment`, `AI · Topics`, `AI · Summary` and full per-question text headers, (e) Powered-by URL is sourced from the shared constant (verified by reading the constant in the same test) | R15, R16 |
| XLSX shape — free-text answer cells preserve verbatim (no truncation) | R16 |
| XLSX shape — every date/timestamp in the file uses brand TZ + locale | R17 |
| XLSX shape — 60-char safe-slug cap in filename | R14 |

### 9.3 E2E (Playwright, `pnpm test:e2e`) — one test per mock scene

| Test | Covers (mock scene) |
|---|---|
| Land on detail page; Response section auto-expanded with 25 rows incl. AI columns | Scene 1 |
| Filter to Detractor — score column tinted red | Scene 2 |
| Filter to Negative sentiment | Scene 3 |
| Filter to a specific wave | Scene 4 |
| Filter to a custom date range | Scene 5 |
| Expand long verbatim — row expands in place | Scene 6 |
| Hover AI-caveat info icon — tooltip shows multi-text-question caveat | Scene 7 |
| Open custom-type survey — Score band and Sentiment band chip groups absent; AI columns retained; Score column hidden | Scene 8 |
| Export — download intercepted, parse bytes, verify cover block + AI columns + disclaimer + Powered-by row | Scene 9 |
| Filter row overflow — narrow viewport; Channel collapses to `More filters ↓` popover; channel chips work inside popover; restore width; Channel returns inline | Scene 11 |
| Export-cap UI — apply filters yielding `total > 50000`; Export button disabled with count-aware tooltip | Scene 12 |
| Header tooltip — hover truncated question header, full text visible | R5 |
| Page-size selector — change 25 → 50 → 100; reload; verify reset to 25 | R11 |

### 9.4 Manual verification (Phase 11 / `address-feedback` checklist)

Reproduced from the spec verbatim (browser-first, two-tab cross-tenant check, brand-TZ wall-clock check, historical-import row check, open the `.xlsx` in actual Excel).

### 9.5 Dependency-add verification (pre-merge)

```
pnpm add -F @customerEQ/api exceljs@^4.4.0
du -sh node_modules/.pnpm/exceljs@*    # ≤ 2MB expected
```

Recorded once in evidence; not a recurring test.

---

## 10. Open questions — resolutions

### OQ-1 (from spec) — ExcelJS vs SheetJS

**Resolved**: ExcelJS. Rationale in §6.1. Verification step §9.5.

### OQ-2 (from spec) — Member-identifier-kind retroactivity

**Resolved**: retroactive. The Member column re-resolves `identifierValue` on every render using the **current** `Brand.memberIdentifierKind`. Rationale:

- The single source of truth is `Brand.memberIdentifierKind`; pinning to capture-time kind would require a new column on `SurveyResponse` storing the kind at capture time, which we don't have and don't want to add for a rare edge.
- The change is operator-facing only — a brand admin who changes `memberIdentifierKind` is intentionally restating how members are identified for the whole brand; expecting historical responses to follow is the principle of least surprise.
- The exported `.xlsx` reflects the rendering moment (per §6.4 cover block — `Exported at`). A receiver knows the export reflects the brand state at export time.

### OQ-3 (new, surfaced during RFC) — SENTIMENT threshold value

**Resolved**: keep `0.3` (current constant). The spec text `+0.33` is a typo — corrected in the spec body (one-line edit ride on this RFC commit). 5 unrelated surfaces (`apps/worker/src/processors/sentimentAnalysis.ts`, `apps/api/src/routes/analytics.ts` × 3 sites, `apps/web/src/app/(admin)/admin/analytics/cx/{page,clusters/[id]/page}.tsx`, `apps/web/src/app/(admin)/admin/members/[id]/page.tsx`) consume the constant with strict `< / >` semantics. Changing the value reclassifies rows in those analytics surfaces with no operator benefit at the ±0.03 band. Inclusive vs exclusive at the band boundary is similarly retained (`>`, `<`). The new `sentimentBand` filter in `buildResponseWhere` uses `gt` / `lt` for positive/negative and `gte/lte` for neutral — consistent with the existing `analytics.ts` consumer.

### OQ-4 (new, surfaced during RFC) — Export auth via query token

**Resolved**: Option A (query-token auth on the `.xlsx` route). The auth plugin's existing query-string-token support is verified in the impl phase before the cover-block builder is written; if missing, the plugin extension is part of the impl commit (~10 lines). Option B (signed URL) is held in reserve and would only be picked up if Option A surfaces a security review concern (none currently identified — the JWT scoping is identical whether the token rides in a header or the query string; cookies on the same origin would be the strictly-safer option but require Clerk session-cookie configuration we don't have today).

### OQ-5 (new, surfaced during RFC) — `SurveyResponse.deletedAt` column

**Resolved**: not added in this issue. Reasoning §2.1. The spec text referencing it is corrected to clarify it inherits via `Survey.deletedAt` (one-line spec edit on this commit).

---

## 11. Traceability matrix

| Spec R# | RFC §  | Impl artifact(s) | Test tier |
|---|---|---|---|
| R1 (paginated table, brandId-scoped) | §4.1, §5.2 | `GET /v1/surveys/:id/responses` handler + `ResponseSection` rewrite | Integration + E2E |
| R2 (columns: Member, Channel, Submitted, Score, AI cols, per-Q) | §4.1, §5.2, §3.1 | `SURVEY_RESPONSE_ROW_SELECT`, `ResponseTable` | Unit + E2E |
| R2a / R6a (AI prefix + caveat indicator) | §5.6, §6.2 | `AiCaveatIndicator` + `AI_FIELDS_CAVEAT` constant | Unit + E2E |
| R3 (Member render with identifierValue per kind) | §4.1, §5.2 | `projectResponseRow` | Unit (4 cases) |
| R4 (long cell truncate + expand) | §5.2 | `ResponseTable` row-expand | E2E |
| R5 (long header truncate + tooltip) | §5.2 | `ResponseTable` header | E2E |
| R6 (brand-TZ everywhere via shared datetime.ts) | §3.2, §6.2 | `formatInBrandTz` consumers | Integration + Manual |
| R7 (consume #378 wave selector) | §5.1, §2.2 | State lift on detail page; `DistributionBatchesFilter` controlled prop | E2E |
| R8 (submitted date range, date-only, brand-TZ EOD) | §3.2, §4.1 | `buildResponseWhere` + `endOfDayInBrandTz` | Integration (boundary) + E2E |
| R9 (channel multi-select) | §4.1 | `buildResponseWhere` `channel.in` | Integration + E2E |
| R9a (score band, type-gated) | §3.1, §3.3, §4.1 | `bandsForScale`, `shouldShowScoreBand` | Unit + Integration + E2E |
| R9b (sentiment band, type-gated + text-Q-gated) | §3.3, §4.1 | `shouldShowSentimentBand`, sentiment OR-branch in `buildResponseWhere` | Unit + Integration + E2E |
| R9c (shared filter modules; no copy left) | §5.3 | `apps/web/src/components/filters/*`, deletion of old `FilterChips.tsx` | Code review + Unit |
| R9d (filter row overflow → More filters popover) | §5.3 | `FilterBar` resize observer + Tailwind `lg:` fallback | Unit + E2E |
| R10 (wave + score + sentiment + submitted + channel compose) | §4.1 | `buildResponseWhere` snapshot tests | Unit + Integration |
| R11 (UI pageSize 25/50/100 + session persist + reload reset) | §5.2 | `sessionStorage`-backed pageSize | Integration + E2E |
| R11a (direct API pageSize cap 500) | §3.2 | Zod `pageSize.max(500)` | Integration |
| R12 (total/totalPages from server, badge matches) | §4.1, §5.2 | List envelope | E2E |
| R13 (Export button → `.xlsx`) | §5.2, §4.2 | `<a href>` + `.xlsx` route | E2E |
| R14 (filename `survey-<slug>-responses-<YYYY-MM-DD>.xlsx`) | §6.3 | `exportFilename` | Unit + E2E |
| R15 (14-row cover block + disclaimer row 13 + Powered-by row 14) | §6.2, §6.4 | `renderResponsesXlsx` + `EXPORTS_POWERED_BY_URL` | Unit + Integration |
| R16 (full Q text headers, AI columns labeled, verbatim free-text) | §6.2 | `renderResponsesXlsx` | Integration |
| R17 (all dates brand-TZ in workbook) | §6.2 | `formatInBrandTz` consumers in export | Integration |
| R18 (Export disabled when total=0) | §5.2 | `<a>` `aria-disabled` + tooltip | E2E |
| R18a (50k cap → 413; UI pre-emptive disable) | §4.2, §5.2 | `EXPORT_ROW_CAP` constant + early-return + UI check | Integration + E2E |
| R19 (`GET /v1/surveys/:id/responses` spec) | §4.1 | Route + Zod schema | Integration |
| R20 (`GET /v1/surveys/:id/responses.xlsx` spec) | §4.2 | Route | Integration + E2E |
| R21 (remove vestigial inline `responses` from `/v1/surveys/:id`) | §4.3 | Survey-detail handler edit | Integration |
| R22 (audit on both endpoints + `aiVintageNonNullCount`) | §4.1, §4.2 | Audit allowlist + `request.auditExtra` | Integration |
| R23 (zero-response empty state) | §5.5 | `EmptyState` body | E2E |
| R24 (zero-filtered empty state) | §5.5 | `EmptyState` body | E2E |
| R25 (anonymous `—` in UI / empty in export) | §4.1, §6.2 | `projectResponseRow` + `renderResponsesXlsx` | Unit + Integration |
| R26 (`COALESCE(completedAt, importedAt)`) | §4.1 | `buildResponseWhere` OR-branch | Integration |
| GDPR Art. 17 (erasure side-effect) | §7, §8.4 | **Forward-only** — handled by future erasure worker; this surface inherits correctness automatically | Forward |

---

## 12. Implementation order — minimal-risk sequencing for the impl phase

The impl phase (Phase 3 of `feature-implementation` job, on the same branch) lands in this order. Each step is independently testable; together they are one PR (Rule 26).

1. **Constants & Zod schema** — add `CSAT`, `CES`, `bandsForScale`, `EXPORT_ROW_CAP`, `EXPORTS_POWERED_BY_URL`, `AI_FIELDS_CAVEAT`, `shouldShow*` helpers; add `responseFilters.schema.ts`. Unit tests land in the same commit.
2. **`GET /v1/surveys/:id/responses`** — handler, `buildResponseWhere`, `projectResponseRow`, integration tests. R12 / R19 / R22 covered.
3. **R21 removal** — drop `responses: { take: 20 }`, add integration test asserting absence. Standalone commit so the diff is auditable.
4. **`GET /v1/surveys/:id/responses.xlsx`** — `excelExport.ts`, route, integration tests including XLSX shape parsing. R13-R18a / R20 covered.
5. **Shared filter components** — `FilterChipGroup`, `SubmittedDateRange`, `FilterBar`, `responseFilters.url.ts`, migrate `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx` consumer and delete it. R9c covered.
6. **`ResponseSection` rewrite** — table, pagination footer, expand-in-row, AI caveat indicator, empty/error states, URL-state sync. Integrate with state-lifted `wave` from `page.tsx`. R1-R6 / R7 / R23-R25 covered.
7. **E2E** — Playwright tests (12 scenes, R-mapped).
8. **Manual Phase 11** — two-tab cross-tenant, brand-TZ wall-clock, historical-import, open `.xlsx` in actual Excel.
9. **Spec corrigenda** (one-line edits riding on the impl PR) — fix `+0.33 → +0.30` in spec R9b and §Validation, replace `SurveyResponse.deletedAt` reference with `Survey.deletedAt` clarifier in Compliance §GDPR Art. 17.

---

## 13. Architecture Analysis

Comparing this RFC against [`docs/architecture/architecture.md`](../architecture/architecture.md) and the ADRs in `docs/architecture/adr/`. The RFC does **not** update the architecture doc — that happens in the `address-feedback` phase after PR review.

### 13.1 Patterns correctly followed

| Pattern | Architecture reference | RFC site |
|---|---|---|
| Multi-Tenant Isolation — `brandId` from JWT, never request body, all queries scoped | §6 "Multi-Tenant Isolation"; project rule R6 | §4.1 `where: { id, brandId: request.brandId, deletedAt: null }` |
| Standard pagination envelope `{ data, total, page, pageSize, totalPages }` | §4.1 "All list endpoints return a standard pagination envelope" | §4.1 list endpoint return shape |
| Cross-tenant returns 404 (Issue #332 pattern) | §4.4 model entries reference `deletedAt`; project rule R6 | §4.1 implicit via `findFirst` filter; integration test R12 |
| Survey-level soft-delete via `Survey.deletedAt IS NULL` | §4.4 Survey model entry; existing handlers at `surveys.ts:103,125` | §4.1 `survey: { deletedAt: null }` |
| Per-route audit metadata allowlist (`auditAction` / `auditResourceType` / `auditAllowlist`) with `requestIp` enrichment | §4.2 audit plugin row | §4.1, §4.2, §7 — `survey.responses.list` + `survey.responses.export` audit configs |
| Zod schema-first request validation (architecture §2 Validation row) | §2 Tech Stack — `Zod 3.23 — Runtime schema validation shared between API request parsing and frontend forms` | §3.2 `responseFilters.schema.ts` reused by API + web |
| Versioned API at `/v1/` (§3.2) | §3.2 API Layer | §4.1, §4.2 routes prefixed `/v1/surveys/:id/...` |
| Brand-timezone + locale display utility (#378) | §6 "Brand-timezone + locale display utility" | §3.2 schema EOD expansion; §6.2 cover-block builder reuses `formatInBrandTz` |
| Pure-logic + React-shell file split for testable components (#241 Slice 3) | §6 "Pure-logic + React-shell file split" | §5.3 `filter-chips.logic.ts` retained; `responseFilters.url.ts` is a new pure-logic sibling |
| Chevron-collapsible section primitive (#241 Slice 4a) | §6 "Chevron-collapsible section primitive" | §5.2 retains existing `<CollapsibleSection>` wrapper |
| Shared test-utils for fixtures and mocks (ADR-006; project rule R8) | §9.2; ADR-006 | §9 unit / integration test plan stipulates factories from `@customerEQ/config/test-utils` |
| `Survey.questions` JSON read-as-source-of-truth for column structure | §4.4 Survey model entry — `Extended questions JSON supports 11 question types` | §4.1 `select.questions` + §5.2 dynamic per-question columns |

### 13.2 Patterns missing from architecture (RFC introduces; architecture should adopt)

These are patterns the RFC needs and that no current architecture doc entry covers. They are documented here for PR-review consideration; the architecture doc edits land in `address-feedback` (Phase 7) after user direction.

1. **Server-side `.xlsx` rendering**
   - **Pattern**: Office-document responses (`.xlsx` today; potentially `.docx` / `.pdf` later) assembled server-side via `apps/api/src/utils/<format>Export.ts`. Library choice: ExcelJS (`exceljs`). Response uses `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` + `Content-Disposition: attachment; filename="…"`. Browser-issued GET (anchor click); no client transformation.
   - **Why needed**: First server-rendered Office document in the repo. Architecture is silent on Office-format generation today.
   - **Suggested resolution**: Add a §6 "Server-side document rendering" design-pattern entry citing the canonical implementation (`apps/api/src/utils/excelExport.ts` after #423 lands) and the library decision (ExcelJS over SheetJS — rationale §6.1 of this RFC).

2. **Query-token auth for browser-issued downloads**
   - **Pattern**: Browser `<a href>` downloads that need auth (no header injection possible from anchor clicks) pass the Clerk JWT as `?token=<jwt>` on the URL. The auth plugin treats `?token=` identically to `Authorization: Bearer …`. The token lives in the URL only as long as the anchor click; the response sets `Content-Disposition: attachment` so nothing renders in the browser tab.
   - **Why needed**: The `.xlsx` export must carry the operator's JWT. Bearer-in-header is unreachable from an `<a href>` click.
   - **Suggested resolution**: Add a §4.2 auth-plugin row note: "Accepts `?token=` query parameter as an alternative to `Authorization: Bearer …` for browser-issued downloads. Tokens MUST be short-lived (Clerk JWTs default to 60s). Audit captures the token's user ID identically." Verify the existing auth plugin already supports this; if not, the impl phase adds it (~10 lines).

3. **Shared admin filter-component family** (`apps/web/src/components/filters/`)
   - **Pattern**: Generic filter primitives (`FilterChipGroup`, `SubmittedDateRange`, `FilterBar`) live at `apps/web/src/components/filters/` and are consumed by any admin surface that needs a filter row. Per-page filter code that used to be on `apps/web/src/app/(admin)/admin/<surface>/components/FilterChips.tsx` migrates here in the same commit that introduces the shared component.
   - **Why needed**: Today's `FilterChips.tsx` is per-surface (surveys list). #235 successor sub-issues (cluster detail, member detail, CX Insights, aggregate views) will all need filter rows; without a shared family they will fork chip code.
   - **Suggested resolution**: Add to §3.1 Presentation Layer or §6 design-patterns: "Admin filter primitives live at `apps/web/src/components/filters/`. Any new admin surface needing a chip-style filter row consumes them via `<FilterBar groups={…} />`. Surface-specific filter logic stays out of the shared family — only generic primitives live here."

4. **List-endpoint filter-echo envelope**
   - **Pattern**: When a list endpoint composes a stateful filter UI that also drives a sibling export, the response envelope augments the standard `{ data, total, page, pageSize, totalPages }` with a `filters` block echoing the effective (post-gate) filter state. The export endpoint reads the same shape.
   - **Why needed**: The export cover block (R15) must record what the operator actually had selected when they clicked export, including server-side gating (`Score band: N/A` when hidden). Computing this on the client is fragile — it would duplicate `shouldShowScoreBand` logic.
   - **Suggested resolution**: Extend the §4.1 envelope sentence: "List endpoints whose filter state drives a sibling export endpoint MAY include a `filters` block echoing the effective filter state and any visibility gates."

5. **URL state for admin-table filters**
   - **Pattern**: Filter state on admin tables serialises into the URL query string via a colocated codec (e.g., `responseFilters.url.ts`). The decoder validates via the same Zod schema the API uses; invalid values silently drop to defaults rather than rendering an error.
   - **Why needed**: Operators share filtered views with colleagues by copying the URL. Without URL state, sharing requires a screen recording.
   - **Suggested resolution**: Add §3.1 entry: "Admin filter surfaces serialise filter state into the URL query string via a `<filter>.url.ts` codec. The codec validates via the same Zod schema the API consumes; unknown values silently drop to defaults."

6. **Filter-bar overflow → popover pattern**
   - **Pattern**: A filter bar with ≥3 chip groups that may overflow the container collapses its least-analytically-critical group behind a `More filters ↓` popover. The popover renders the same `FilterChipGroup` inside with identical semantics. Detection: resize-observer-driven; fallback: Tailwind `lg:` media query at <1024px → unconditional collapse.
   - **Why needed**: Filter rows can grow to 4+ groups as analytics surfaces expand. Wrapping would push the table down; collapsing one group preserves the row.
   - **Suggested resolution**: Add §6 design-pattern entry — "Filter bars with overflow risk collapse their least-critical group behind a `More filters ↓` popover. The collapsed group MUST share the same `FilterChipGroup` component; selection state preserves across collapse/expand."

7. **`AI ·` column prefix + shared caveat constant**
   - **Pattern**: AI-derived columns rendered to operator surfaces carry the explicit `AI ·` prefix on the column header. The caveat tooltip text and any matching disclaimer-row text in exports read from a single shared constant (`AI_FIELDS_CAVEAT` in `packages/shared/src/constants.ts`). No internal issue numbers appear in operator-facing copy.
   - **Why needed**: AI-derived data (sentiment, topics, summary) needs to be visually distinguished from customer-entered data. Drift between UI tooltip and export disclaimer text would erode trust.
   - **Suggested resolution**: Add to §3.8 AI Layer or §6 design-patterns: "Operator-facing surfaces that display AI-derived columns prefix the column header with `AI ·`. The cover-block disclaimer and the UI caveat tooltip read from a single shared `AI_FIELDS_CAVEAT` constant. Operator-facing copy never names internal issue numbers."

8. **Single shared host constant for "Powered by" hyperlinks**
   - **Pattern**: Canonical app-host URLs that appear inside generated documents (exports, emails, PDFs) live as named constants in `packages/shared/src/constants.ts` (`EXPORTS_POWERED_BY_URL`, etc.). The cover-block / template builders read the constant; literals never duplicate.
   - **Why needed**: If the production host ever changes, a single edit propagates to every generated document. Today, only this issue's export needs it; future generated documents will reuse.
   - **Suggested resolution**: Add to §6: "Canonical app-host URLs referenced in generated documents (exports, emails, PDFs) MUST live as named constants in `packages/shared/src/constants.ts`."

9. **Scale-aware band tables on score constants**
   - **Pattern**: When a survey scoring type (NPS / CSAT / CES) admits more than one scale, the constants for that type expose `bandsForScale(scale)` returning the per-scale band table. Phase 1 supports the current scales; future scales (NPS 1-5, CES 1-5) are addressable on the same surface without UI/API refactors.
   - **Why needed**: Spec R9a explicitly requires multi-scale flexibility. The existing `NPS.PROMOTER_THRESHOLD` flat constants don't generalise.
   - **Suggested resolution**: Add to §6: "Score-band constants for survey types expose `bandsForScale(scale)` returning the per-scale band table. Filter UIs and API filter translators consume the same table — no hard-coded scale shapes."

10. **Export-cap constant + HTTP 413 contract**
    - **Pattern**: Bulk-export endpoints cap output via a single `EXPORT_ROW_CAP` constant in `packages/shared/src/constants.ts`. Beyond the cap, the server returns HTTP 413 with body `{ code: 'EXPORT_TOO_LARGE', total, capacity, message }`. The UI pre-emptively disables the Export button when the count badge exceeds the cap. Async-job export is a deferred V1.x option.
    - **Why needed**: First bulk-export endpoint. Architecture is silent.
    - **Suggested resolution**: Add to §6: "Bulk-export endpoints cap output via a single `EXPORT_ROW_CAP` shared constant. Beyond the cap → HTTP 413 `EXPORT_TOO_LARGE` `{total, capacity, message}`; the operator's UI pre-emptively disables Export based on the count badge."

11. **Forward-pointer: future erasure worker is the GDPR Art. 17 enforcement seat for `SurveyResponse` AI columns**
    - **Pattern**: When/if an erasure worker is built for `Member` records, it zeroes `SurveyResponse.{memberId, sentiment, confidence, topics, summary, clusterId}` for every response belonging to the erased member. The list and export surfaces inherit correct behavior automatically (member-null → `—`, AI cells empty).
    - **Why needed**: The Compliance Architecture table (§10) says "GDPR Art. 17 — erasure job" but no such job exists today. The spec for #423 records the AI-column-zeroing requirement; the architecture doc should record where that requirement will land.
    - **Suggested resolution**: Add to §10 Compliance Architecture or a new §6 entry: "When the GDPR Art. 17 erasure worker is built, it zeroes AI-derived columns (`sentiment`, `confidence`, `topics`, `summary`, `clusterId`) on every `SurveyResponse` belonging to an erased member, in addition to clearing `memberId`. The downstream read surfaces inherit member-anonymous rendering."

### 13.3 Patterns incorrectly followed

None observed. The RFC does not re-implement an existing pattern in a non-standard way. The closest call is the `SENTIMENT` threshold drift between spec (`0.33`) and existing constant (`0.3`) — addressed in OQ-3 by treating the spec text as a typo (one-line corrigendum) and retaining the existing `0.3` constant so the 5 existing consumers stay consistent.

### 13.4 Forward-pointers — schema columns the RFC reads but the spec implies

| Reference | Where it appears | Current state | Treatment |
|---|---|---|---|
| `Survey.scoreScale` | RFC §3.1 `defaultScaleForType` mentions it as a future column | Not in schema today | RFC reads `Survey.type` only; `bandsForScale('0_10')` etc. are hard-coded defaults at the spec's named Phase-1 scales. The `scoreScale` column lands with a successor sub-issue if/when a brand needs a non-default scale. |
| `SurveyResponse.deletedAt` | Spec Compliance §GDPR Art. 17 references | Not in schema today | RFC §2.1 explicitly does NOT add the column; the erasure model is zero-out-and-anonymize, not row-soft-delete. Spec corrigendum rides on impl PR. |

---

## 14. Confidence

**95** on a 0–100 scale.

The two design degrees of freedom (ExcelJS choice, query-token auth for the `.xlsx` route) are both retrievable; the underlying Prisma query shape is well within the team's existing patterns; the test plan exercises every spec R via a named test. The remaining 5% covers the surface-area risk of unexpected interactions when migrating the surveys-list `FilterChips.tsx` to the shared module (low — it's a near-mechanical refactor with the same `toggleChip` API surface).
