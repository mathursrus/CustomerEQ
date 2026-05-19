# Issue #423 — Implementation Work List

Feature: Survey Response Review v1 — per-member tabular view, basic filters, wave filtering, Excel export
Spec: [`docs/feature-specs/423-survey-response-review-v1.md`](../feature-specs/423-survey-response-review-v1.md)
RFC: [`docs/rfcs/423-survey-response-review-v1.md`](../rfcs/423-survey-response-review-v1.md)
Mock: [`docs/feature-specs/mocks/423-survey-response-review-v1.html`](../feature-specs/mocks/423-survey-response-review-v1.html)
Branch: `feature/423-...` · PR: [#426](https://github.com/mathursrus/CustomerEQ/pull/426)
Issue type: **feature**

---

## Validation Requirements

- **uiValidationRequired**: yes — major new admin UI surface; verify against 13 mock scenes.
- **mobileValidationRequired**: no — admin survey detail page is not a mobile surface (#241 design).
- **Responsive validation**: yes — filter row overflow → popover at narrow widths (R9d).
- **Browser baseline**: Chrome latest (Playwright default).
- **Test-environment expectations**:
  - `pnpm test:smoke` — unit tests (shared constants, filter-chip logic, member-render, band derivation, Excel cover builder, filename slug).
  - `pnpm test:integration` — API tests against test DB (filter composition, cross-tenant 404, export cap, XLSX shape parse, audit row).
  - `pnpm test:e2e` — Playwright (12 scenes from mock + R5 header tooltip + R11 page-size reset).
- **Manual verification (Phase 11)**: two-tab cross-tenant, brand-TZ wall-clock, historical-import row, open `.xlsx` in actual Excel.
- **Evidence artifact**: `docs/evidence/423-ui-polish-validation.md` for UI polish; `docs/evidence/423-feature-implementation-evidence.md` for the impl record.

---

## Implementation Order (RFC §12 — same branch / same PR per Rule 26)

### 1. Shared constants & Zod schema (`packages/shared/`)

- [ ] `packages/shared/src/constants.ts` — extend with:
  - `CSAT`, `CES` band tables paralleling existing `NPS`.
  - `bandsForScale(scale)` accessor on each type (no-throw addressable for `'1_5'` future scales on NPS and CES even if not API-selected).
  - `defaultScaleForType(type)` resolver.
  - `shouldShowScoreBand(type)` and `shouldShowSentimentBand(type, hasOpenEndedQuestion)` helpers.
  - `EXPORT_ROW_CAP = 50_000`.
  - `EXPORTS_POWERED_BY_URL = 'https://customereq.wellnessatwork.me'`.
  - `AI_FIELDS_CAVEAT` — exact tooltip + cover-block disclaimer copy (single source of truth).
  - `SENTIMENT` retained at current `0.3` thresholds (OQ-3 resolution).
- [ ] `packages/shared/src/zod/responseFilters.schema.ts` — new file. `ResponseFilters` + `ResponseListQuery` + `ResponseExportQuery`. Wave union (`all | direct | <cuid>`). Date-only strings. Bands enums. `pageSize.max(500)` (UI tier caps to 25/50/100 in the chip selector).
- [ ] `packages/shared/src/index.ts` — export `./zod/responseFilters.schema.js`.
- [ ] Unit tests:
  - `packages/shared/src/constants.test.ts` — band derivation (NPS 0–10, CSAT 1–5, CES 1–7); future-scale addressable tables; `shouldShow*` helpers; sentiment-band classification with current `0.3` thresholds + `null` handling.
  - `packages/shared/src/zod/responseFilters.schema.test.ts` — `ResponseListQuery` parses page/pageSize coercion, rejects `pageSize=501`, accepts wave variants, etc.

### 2. `GET /v1/surveys/:id/responses` — list endpoint (R1, R3, R12, R19, R22)

- [ ] `apps/api/src/routes/surveys.ts` — register new route with `config: { auditAction: 'survey.responses.list', auditResourceType: 'survey', auditAllowlist: [...] }` (NB: audit plugin only logs *mutation* methods; we'll add a small extension or use existing pattern).
  - **Audit note**: existing audit plugin (`apps/api/src/plugins/audit.ts:96`) only fires on `MUTATION_METHODS`. The spec/RFC require audit on GET list/export. Decision: extend the audit plugin to allow `auditAction` configured GETs through the gate. This is a generic extension, not feature-specific.
- [ ] `buildResponseWhere` helper colocated next to the route (or in a small util) — translates `ResponseFilters` into Prisma `where` shape per RFC §4.1. Soft-delete inherited via `survey: { deletedAt: null }`. Type-gated band filters. `COALESCE(completedAt, importedAt)` in submitted range.
- [ ] `SURVEY_RESPONSE_ROW_SELECT` constant — Prisma select shape per RFC §4.1.
- [ ] `projectResponseRow` helper — resolves `member.identifierValue` from `Brand.memberIdentifierKind`. Returns `member: null` for `memberId === null`.
- [ ] Response envelope includes a `filters` echo block (R4.4) with `scoreBandGate.hidden` / `sentimentBandGate.hidden`.
- [ ] Integration tests (`apps/api/test/integration/surveys-responses.test.ts` new file):
  - Happy path (rows with AI fields).
  - Cross-tenant 404.
  - Wave / submitted / score-band / sentiment-band / channel composition.
  - Score-band correctness per type (NPS, CSAT, CES boundary).
  - Sentiment-band correctness (0.31 → positive; 0.30 → neutral; -0.31 → negative).
  - Date filter brand-TZ end-of-day expansion.
  - `COALESCE(completedAt, importedAt)` for historical-import rows.
  - Channel multi-select.
  - PageSize tiers: UI tier (25/50/100), direct-API tier (≤500), reject 501.
  - Anonymous member rendering (`member: null`).
  - Survey-level soft-delete → 404.
  - Custom-type survey → `scoreBandGate.hidden: true`, `sentimentBandGate.hidden: true`.
  - Audit row written on success (after audit-plugin extension).

### 3. R21 — remove vestigial `responses: { take: 20, ... }` from `GET /v1/surveys/:id`

- [ ] Drop the `responses: { ... }` inclusion in `apps/api/src/routes/surveys.ts:129-144`.
- [ ] Integration test in `surveys.test.ts` (or new) — assert `body.responses === undefined` and `body._count.responses` retained.

### 4. `GET /v1/surveys/:id/responses.xlsx` — export endpoint (R13–R18a, R20, R22)

- [ ] Add `exceljs` to `apps/api/package.json`.
- [ ] `apps/api/src/utils/excelExport.ts` — `renderResponsesXlsx({ survey, brand, filters, rows, total, operatorEmail })` returns `Buffer`. Cover-block rows 1–11 (with `N/A` for hidden gates); blank row 12; AI-fields disclaimer row 13 (italic, merged); `Powered by CustomerEQ` row 14 with hyperlink to `EXPORTS_POWERED_BY_URL`; blank row 15; header row 16 (`Member, Channel, Submitted, Score, AI · Sentiment, AI · Topics, AI · Summary, <Q1>, <Q2>, ...`); data rows 17+. Custom-type survey omits the Score column.
- [ ] `exportFilename(survey, brand)` helper — `survey-<safeSlug>-responses-<YYYY-MM-DD>.xlsx`, slug 60-char cap. Unit-tested.
- [ ] Auth-plugin extension — accept `?token=<jwt>` as fallback when `Authorization` header missing (RFC OQ-4). Treat as identical to `Authorization: Bearer <jwt>`.
- [ ] `apps/api/src/routes/surveys.ts` — register `GET /v1/surveys/:id/responses.xlsx`. Early 413 on `total > EXPORT_ROW_CAP`. Compute `aiVintageNonNullCount`. Set Content-Type + Content-Disposition. Stamp `request.audit.metadata`.
- [ ] Integration tests:
  - Happy path — parse `.xlsx` bytes; assert cover-block rows 1–11 labels match; row 13 disclaimer exact text from `AI_FIELDS_CAVEAT`; row 14 hyperlink to `EXPORTS_POWERED_BY_URL`; header row 16 contains `AI · Sentiment / AI · Topics / AI · Summary` and full question text.
  - 50k cap → HTTP 413 with `{ code: 'EXPORT_TOO_LARGE', total, capacity: 50000, message }`.
  - Cross-tenant 404.
  - Custom-type survey → cover block has `Score band: N/A` and `Sentiment band: N/A`.
  - Anonymous row → empty Member cell.
  - Filename pattern (boundary slug cases).
  - Audit row written with `metadata.aiVintageNonNullCount` and `metadata.total`.
  - All dates in brand TZ (no ISO leakage).

### 5. Shared filter components (`apps/web/src/components/filters/`)

- [ ] Create directory `apps/web/src/components/filters/` with:
  - `FilterChipGroup.tsx` — primitive lifted from `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx`. Accepts `{ key, label, options[], selected[], onChange, helpText?, helperIcon? }`. The helper-icon slot carries the sentiment-band caveat indicator inline.
  - `SubmittedDateRange.tsx` — preset chips (7d/30d/90d/All time/Custom) + custom-date inputs (date-only). Built on `packages/shared/src/datetime.ts`.
  - `FilterBar.tsx` — composer with resize-observer overflow → Channel-into-popover (R9d). Fallback to Tailwind `lg:` media query at <1024px.
  - `filter-chips.logic.ts` — re-export existing `toggleChip` plus add `bandChipsForType(type)`.
  - `responseFilters.url.ts` — `encodeFiltersToQs` / `decodeFiltersFromQs`. Decoder validates via the shared Zod schema; unknown values silently drop to defaults.
- [ ] Migrate the existing `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx` consumer at `apps/web/src/app/(admin)/admin/surveys/page.tsx:266` to use the new `<FilterBar groups={...} />` (or single `<FilterChipGroup>`s) — **no copy stays behind** (R9c). Delete the old `FilterChips.tsx` and `FilterChips.test.ts` after migration; preserve test coverage in the new location.
- [ ] Unit tests:
  - `FilterChipGroup.test.ts` — toggle, multi/single, count badge.
  - `SubmittedDateRange.test.ts` — preset selection emits the right date range.
  - `FilterBar.test.ts` — overflow detection + popover.
  - `filter-chips.logic.test.ts` — retain `toggleChip` cases; add `bandChipsForType(type)` cases.
  - `responseFilters.url.test.ts` — round-trip encode/decode for every combination; invalid values drop silently.

### 6. `DistributionBatchesFilter` — controlled prop (R7)

- [ ] Add optional `value` prop to `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionBatchesFilter.tsx`. Falls back to uncontrolled local state when `value` is `undefined` (preserves back-compat).

### 7. `ResponseSection` rewrite + survey-detail page state lift

- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — lift wave state (`useState<WaveSelection>('all')`). Pass `value={wave}` and `onChange={setWave}` to `DistributionBatchesFilter`. Pass full props to `ResponseSection` (surveyType, surveyName, brandTimezone, brandLocale, memberIdentifierKind, responsesCount, questions, wave).
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseSection.tsx` — rewrite end-to-end. Stateful client component owning: filter state (synced to URL), pageSize (sessionStorage, reset to 25 on full reload), page, expandedRowId, fetch lifecycle.
- [ ] New colocated subcomponents:
  - `ResponseTable.tsx` — table renderer; Member / Channel / Submitted / Score (tinted by band; hidden when `shouldShowScoreBand === false`) / AI · Sentiment / AI · Topics / AI · Summary / per-question columns. Long cell truncate + expand-in-row. Long header truncate + tooltip + `aria-describedby`.
  - `ResponsePagination.tsx` — page-size selector (25/50/100, default 25, session persist, reload reset to 25) + prev/next + `Page X of Y · N responses`.
  - `AiCaveatIndicator.tsx` — info icon at AI column-group header; tooltip text from shared `AI_FIELDS_CAVEAT`.
  - `EmptyState.tsx` (or inline) — zero-response + zero-filtered empty bodies.
- [ ] Export trigger — `<a href="...responses.xlsx?token=<jwt>&...filters">Export to Excel</a>`. Disabled state when `total === 0` or `total > EXPORT_ROW_CAP` (pre-emptive). Tooltips per spec.
- [ ] Unit/component tests:
  - Member-column render (firstName+lastName+identifier; both names null; `memberId === null`).
  - Expand-in-row behavior.
  - Export-button disabled states.
  - Empty / zero-filter empty state copy.

### 8. E2E tests (`apps/web/tests/e2e/423-response-review.spec.ts`)

One test per mock scene per RFC §9.3:
- Scene 1 — happy path (table loads with AI cols, 25 rows).
- Scene 2 — wave filter wiring (count badge + rows).
- Scene 3 — date + channel filter narrow.
- Scene 4 — expand row.
- Scene 5 — header tooltip.
- Scene 6 — page size 100 + reload reset to 25.
- Scene 7 — Excel export download (intercept download, parse bytes).
- Scene 8 — zero-response empty state + disabled Export.
- Scene 9 — zero-filtered empty state + Clear filters.
- Scene 10 — anonymous row renders `—`.
- Scene 11 — filter row overflow → More filters popover.
- Scene 12 — export-cap UI (count > 50k → Export disabled).
- Scene 13 — custom-type survey (Score band + Sentiment band + Score column hidden).
- Plus R-tag tests: Score-band tints (red on Detractor), Sentiment-band filter, AI-caveat indicator hover.

### 9. Spec / RFC corrigenda (one-line edits riding on impl PR)

- [ ] Spec `R9b` and §Validation: replace `+0.33` / `-0.33` with `+0.3` / `-0.3` (OQ-3 resolution).
- [ ] Spec Compliance §GDPR Art. 17: replace `SurveyResponse.deletedAt` reference with the `Survey.deletedAt` inheritance clarifier (OQ-5 resolution).

---

## Quality Requirements (from `codebase-pattern-discovery`)

- **Environment patterns**: existing `API_URL` / `getAuthToken` in `apps/web/src/lib/config.ts`; no new env vars introduced this phase (the Powered-by host is a hardcoded shared constant per R15).
- **Constants inventory**: extend `packages/shared/src/constants.ts` flat surface (no split into `branding.ts` yet — RFC §6.4 explicit).
- **Utility functions**:
  - Reuse `formatInBrandTz`, `endOfDayInBrandTz` from `packages/shared/src/datetime.ts` everywhere; **no per-page formatter** (R6).
  - Reuse `toggleChip` from existing `filter-chips.logic.ts`.
  - Audit plugin: extend to allow `auditAction`-configured GETs (generic, not feature-specific).
- **Architectural patterns followed**:
  - Multi-tenant isolation via `request.brandId` (project rule R6).
  - Standard pagination envelope `{ data, total, page, pageSize, totalPages }`.
  - Cross-tenant returns 404 (Issue #332 pattern).
  - Per-route audit metadata allowlist + `requestIp` enrichment.
  - Zod schema-first request validation (architecture §2; shared between API + web).
  - Pure-logic + React-shell file split (filter-chips.logic / .tsx; responseFilters.url.ts).
  - Brand-TZ display utility chain (R6).
  - Shared test-utils for fixtures/mocks per project rule R8.

---

## Known deferrals / open questions (out of scope, recorded so later phases don't re-open them)

- Per-question AI synthesis (refactor `extractOpenEndedText`, BAML signature change) — successor sub-issue of #235.
- Aggregate views (score histogram, topic clouds, etc.).
- `/admin/surveys/[id]/responses/[responseId]` detail route — expand-in-row covers Phase 1.
- Cluster drill-through column.
- Sortable columns; row-level multi-select; inline member edit.
- Async-job export for >50k row sets — Phase 1 returns 413.
- Erasure worker — does not exist today; Phase 1 surface inherits correct null-FK rendering. Future worker zeroes `memberId`, `sentiment`, `confidence`, `topics`, `summary`, `clusterId` (RFC §8.4).
- `SurveyResponse.deletedAt` column — not added; inheritance via `Survey.deletedAt` is sufficient (OQ-5).

---

## Phase coverage commitment

Every requirement listed in the spec/RFC `R#` traceability matrix maps to one or more checklist items above. The implementation phases (4 → 5 → 6 → 7 → 8 in this list — RFC §12 ordering) land in commits on this same branch / same PR per Rule 26.
