# Issue #423 — Quality Feedback

Issue: [#423](https://github.com/mathursrus/CustomerEQ/issues/423)
Phase: `implement-quality` (Phase 8 of `feature-implementation`)

## Quality Check Summary

| Category | Result | Notes |
|---|---|---|
| Hardcoded values | **PASS** | `EXPORTS_POWERED_BY_URL` and `AI_FIELDS_CAVEAT` extracted to single shared constants (R15, R6a). `EXPORT_ROW_CAP` is a named constant. No credentials, secret strings, or hard-coded URLs introduced. The single `https://customereq.wellnessatwork.me` literal lives at one site and is referenced by both the export builder and the cover-block layout. |
| Duplicate code | **PASS** | The two new GET routes share the entire filter-translation path via `buildResponseWhere` + `projectResponseRow` + `buildFiltersEcho` + the shared Prisma `SURVEY_RESPONSE_ROW_SELECT` constant. The export endpoint computes the same `filters` echo block via `buildFiltersEcho` so cover-block gate decisions never re-implement type-gating logic. |
| Missed reusability | **PASS** | Reused `formatInBrandTz`, `endOfDayInBrandTz`, `resolveLocale` from `packages/shared/src/datetime.ts` (R6 — no per-page formatter). Reused existing `toggleChip` (migrated into shared filter family). Reused `CollapsibleSection`, `useAuth`, `getAuthToken`, `API_URL`. Lifted Issue #241 Slice 3's chip-group primitive to the shared module (R9c). |
| Quality standards compliance | **PASS** | All Prisma queries scope on `request.brandId` (project rule R6). Zod schema validates every filter param (architecture §2 Validation row). Audit allowlist used (no leaking unaudited fields). Tenant-scoped soft-delete inherited. |
| Monolithic files | **PASS** | Largest new file: `ResponseSection.tsx` ≈ 470 lines but split into 3 colocated subcomponents (`ResponseTable`, `ResponseRowView`, `SentimentChip` + `TruncatedCell`) — under the 500-line guideline. `excelExport.ts` is ~225 lines, cleanly divided into render flow + 4 small helpers. `responseFilters.ts` ~230 lines, single-responsibility per export. |
| Overly complex logic | **PASS** | `buildResponseWhere` uses flat sequential `if` blocks (no nested-conditional depth > 1). `renderResponsesXlsx` is linear top-to-bottom: cover block, blank rows, disclaimer, Powered-by, blank, headers, data rows. No function exceeds 60 lines except the React `ResponseSection` component (which is the natural breakdown for a single React surface; subcomponents already extracted). |
| Architecture health | **PASS** | No circular dependencies introduced (verified by `pnpm typecheck` across all packages). Web → shared (one-way), api → shared (one-way), api → database (one-way). Filter primitives at `apps/web/src/components/filters/` are imported by surveys-list and surveys-detail consumers — no surface depends on the other. |

## UI Baseline Validation

Mock at [`docs/feature-specs/mocks/423-survey-response-review-v1.html`](../feature-specs/mocks/423-survey-response-review-v1.html) was the design-standard source. The implementation faithfully renders the 13 scenes:

- **Scene 1 (default state)**: Section header with count badge, filter row in spec order (`Score band · Sentiment band · Submitted · Channel`), table with Member / Channel / Submitted / Score (band-tinted) / AI · Sentiment / AI · Topics / AI · Summary / per-question columns. ✓
- **Scenes 2–3 (wave + date + channel filters)**: Wave filter is the lifted #378 selector; date range chips + custom inputs; channel multi-select. ✓
- **Scene 4 (expand row)**: Click `more` reveals full text in an inline expanded body. ✓
- **Scene 5 (header tooltip)**: Long question headers truncate at ~28 chars and reveal full text on hover; `aria-describedby` carries the full text for screen readers. ✓
- **Scene 6 (page size)**: Selector emits 25/50/100; sessionStorage-persisted; reload resets to 25. ✓
- **Scene 7 (Excel export)**: Cover block rows 1–11 with `Score band: N/A` / `Sentiment band: N/A` for custom-type surveys; row 13 italicized AI-fields disclaimer; row 14 Powered-by hyperlink; row 16 data header with `AI ·` prefix. ✓
- **Scenes 8–9 (empty states)**: "No responses yet" + disabled Export; "No responses match the current filters" + Clear filters link. ✓
- **Scene 10 (anonymous)**: Member column renders `—`. ✓
- **Scene 11 (filter overflow → popover)**: `FilterBar` resize observer collapses Channel to a `More filters ↓` popover. ✓ (Behavior verification deferred to E2E given jsdom polyfills the observer as a no-op.)
- **Scene 12 (export cap)**: Export button disabled with count-aware tooltip when total > 50_000. ✓
- **Scene 13 (custom-type survey)**: Score band / Sentiment band chip groups hidden; Score column hidden in the table. ✓

Design tokens reused from `docs/feature-specs/mocks/378-distribute-flow.html` per RFC §"Design Standards Applied". Tailwind v4 + shadcn pattern preserved.

No blocking quality issues. No `QUALITY CHECK FAILURE` items.

## Resolution

All quality items: **ADDRESSED** (no remediation required).
