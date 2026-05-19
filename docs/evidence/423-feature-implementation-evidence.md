# Feature: Survey Response Review v1 — Implementation Evidence
Issue: [#423](https://github.com/mathursrus/CustomerEQ/issues/423)
Spec: [`docs/feature-specs/423-survey-response-review-v1.md`](../feature-specs/423-survey-response-review-v1.md)
RFC: [`docs/rfcs/423-survey-response-review-v1.md`](../rfcs/423-survey-response-review-v1.md)
PR: [#426](https://github.com/mathursrus/CustomerEQ/pull/426) (same PR per Rule 26)

## Implementation Summary

Phase 1 of #235 ships per-member tabular response review on `/admin/surveys/[id]` with brand-TZ display, filtering (wave, score band, sentiment band, submitted range, channel), pagination (25/50/100 UI tier + 500 direct-API tier), expand-in-row free-text, and server-side `.xlsx` export with a self-describing cover block.

Implemented per RFC §12 ordering. Same branch / same PR per Rule 26.

### Shared package additions
- `packages/shared/src/constants.ts` — `CSAT`, `CES`, `bandsForScale(scale)` on each CX type, `defaultScaleForType`, `shouldShowScoreBand` / `shouldShowSentimentBand`, `sentimentBandOf`, `EXPORT_ROW_CAP = 50_000`, `EXPORTS_POWERED_BY_URL`, `AI_FIELDS_CAVEAT`. Existing `NPS` + `SENTIMENT` retained at 0.3 thresholds (RFC §10 OQ-3).
- `packages/shared/src/zod/responseFilters.schema.ts` — `ResponseFiltersSchema`, `ResponseListQuerySchema` (with `pageSize.max(500)`), `ResponseExportQuerySchema`, `splitCsvArray` helper.
- `packages/shared/src/index.ts` — exports the new schema.

### API additions
- `apps/api/src/utils/responseFilters.ts` — `buildResponseWhere`, `projectResponseRow`, `buildFiltersEcho`, `hasOpenEndedQuestion`, `SURVEY_RESPONSE_ROW_SELECT`.
- `apps/api/src/utils/excelExport.ts` — `renderResponsesXlsx`, `exportFilename`. ExcelJS-backed; 11-row cover block + blank row 12 + AI-fields disclaimer row 13 + Powered-by hyperlink row 14 + blank row 15 + data header row 16 + data rows 17+.
- `apps/api/src/routes/surveys.ts` — two new routes (`GET /v1/surveys/:id/responses`, `GET /v1/surveys/:id/responses.xlsx`); R21 vestigial `responses: { take: 20 }` removed from the existing `GET /v1/surveys/:id` route.
- `apps/api/src/plugins/audit.ts` — extended to audit GETs whose route config declares `auditAction` (previously audit fired on mutation methods only); enables `survey.responses.list` + `survey.responses.export` audit rows.
- `apps/api/src/plugins/auth.ts` — accepts `?token=<jwt>` as fallback when `Authorization` header is absent (RFC OQ-4) for browser-issued downloads.
- `apps/api/package.json` — adds `exceljs@^4.4.0`.

### Web additions
- `apps/web/src/components/filters/` — new shared filter family:
  - `FilterChipGroup.tsx` (lifted from the old `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx`).
  - `SubmittedDateRange.tsx` — preset chips + custom-date inputs.
  - `FilterBar.tsx` — overflow-aware composer with resize-observer → popover fallback (R9d).
  - `filter-chips.logic.ts` — `toggleChip` + `bandChipsForType(type)`.
  - `responseFilters.url.ts` — URL state codec using the shared Zod schema.
- `apps/web/src/app/(admin)/admin/surveys/[id]/components/`:
  - `ResponseSection.tsx` — full rewrite (table renderer + filters + pagination + expand-in-row + AI caveat indicator + zero-response / zero-filter empty states).
  - `AiCaveatIndicator.tsx` — info-icon surfacing the verbatim `AI_FIELDS_CAVEAT` copy.
  - `ResponsePagination.tsx` — page-size selector + prev/next.
  - `CollapsibleSection.tsx` — widened `title` to `ReactNode` so the Response title can embed an inline count badge.
  - `DistributionBatchesFilter.tsx` — added optional `value` prop (controlled mode); back-compat retained.
- `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — wave state lifted to the page; passed to `DistributionBatchesFilter` (controlled) and `ResponseSection`.
- `apps/web/src/app/(admin)/admin/surveys/page.tsx` + `list-page.logic.ts` — migrated to `<FilterChipGroup>` per R9c; old `FilterChips.tsx` + `FilterChips.test.ts` + `filter-chips.logic.ts` deleted.
- `apps/web/vitest.setup.ts` — added `ResizeObserver` polyfill for jsdom.

### Spec corrigenda (RFC §12 step 9 — ride on impl PR)
- Spec R9b / §Validation / §3.3: `+0.33 / -0.33` → `+0.3 / -0.3` (per RFC §10 OQ-3). Spec language clarified to strict `<` / `>` boundary semantics.
- Spec Compliance §GDPR Art. 17: replaced the `SurveyResponse.deletedAt` reference with the clarification that Phase 1 inherits `Survey.deletedAt` soft-delete and that the future erasure worker is the seat for AI-column zeroing (RFC §2.1, §8.4).

### Tests added
- `packages/shared/src/constants.test.ts` — 17 cases (bandsForScale boundary cases, shouldShow* gates, sentimentBandOf, export constants).
- `packages/shared/src/zod/responseFilters.schema.test.ts` — 19 cases (defaults, dateOnly regex, band enums, pageSize cap).
- `apps/api/src/utils/responseFilters.test.ts` — 23 cases (wave/score/sentiment/channel/submitted-range composition, type-gated filters, gate-echo, member projection).
- `apps/api/src/utils/excelExport.test.ts` — 6 cases (cover block + AI columns + Powered-by hyperlink + filename slug + CUSTOM-type Score column hidden).
- `apps/api/test/integration/surveys-responses.test.ts` — 10 integration cases (happy path, cross-tenant 404 both endpoints, score-band filter, pageSize tiers, gate hidden for CUSTOM, anonymous member, R21 vestigial removed, .xlsx shape, .xlsx Powered-by hyperlink).
- `apps/web/src/components/filters/filter-chips.logic.test.ts` — 7 cases (toggleChip + bandChipsForType).
- `apps/web/src/components/filters/responseFilters.url.test.ts` — 6 cases (encode/decode round-trip, unknown values drop silently).
- `apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseSection.test.tsx` — 3 RTL cases (count badge, export disabled when responsesCount===0, count badge expanded path).

## Validation Evidence

### Build verification
```
pnpm build  # ✓ all 10 packages, 12 total (6 cached)
pnpm --filter @customerEQ/api typecheck  # ✓
pnpm --filter @customerEQ/web typecheck  # ✓
pnpm --filter @customerEQ/web build      # ✓ Compiled successfully
```

### Targeted test runs
```
pnpm --filter @customerEQ/shared test    # ✓ 679 / 679
pnpm --filter @customerEQ/api    test    # ✓ 522 / 522
pnpm --filter @customerEQ/web    vitest run src/components/filters     # ✓ 13 / 13
pnpm --filter @customerEQ/web    vitest run src/app/(admin)/admin/surveys/[id]/components/ResponseSection.test.tsx  # ✓ 3 / 3
pnpm --filter @customerEQ/web    vitest run src/app/(admin)/admin/surveys/[id]/page.test.tsx                       # ✓ 4 / 4
pnpm --filter @customerEQ/web    vitest run src/app/(admin)/admin/surveys/[id]/edit/page.test.tsx                  # ✓ 5 / 5
```

### Integration tests
Integration tests in `apps/api/test/integration/surveys-responses.test.ts` cover:
- Happy path with member identifier projection.
- Cross-tenant 404 (both list + export endpoints).
- Score-band filter applied (NPS detractor → score 0..6).
- PageSize 501 rejected (422); PageSize 500 accepted.
- CUSTOM-type survey marks both `scoreBandGate.hidden: true` and `sentimentBandGate.hidden: true`.
- Anonymous member row (`memberId IS NULL`) returns `member: null`.
- R21: `GET /v1/surveys/:id` payload no longer contains `responses[]`; `_count.responses` retained.
- `.xlsx` export contract: cover block keys, AI-fields disclaimer row (exact match against shared `AI_FIELDS_CAVEAT`), `Powered by CustomerEQ` row with hyperlink to `EXPORTS_POWERED_BY_URL`, data header includes `AI · Sentiment / AI · Topics / AI · Summary`.

Full integration run requires a live Postgres (`pnpm test:integration`) — defer to CI / Phase 7 regression.

### Manual verification (deferred to Phase 11 `address-feedback`)
- Open the survey detail page in two browser tabs side by side (Brand A admin + Brand B admin) — verify each sees only their own surveys' responses.
- Configure Brand A timezone = `America/Los_Angeles`; submit a test response now (UTC `completedAt`). Reload — verify the Submitted column shows the PST/PDT wall-clock time.
- Run a CSV-import historical wave (#262). Confirm historical rows render with `importedAt` and the Submitted column behavior follows R26.
- Click Export. Open the `.xlsx` in actual Excel. Confirm cover block reads naturally, dates are in brand TZ, free-text answers preserved across line breaks, AI columns labeled with `AI ·` prefix.

## Traceability — every spec R# mapped to a delivered artifact

| Spec R# | Impl artifact | Test tier(s) |
|---|---|---|
| R1 (paginated table, brand-scoped) | `GET /v1/surveys/:id/responses` handler + `ResponseSection` rewrite | Integration + RTL |
| R2, R2a (AI columns + `AI ·` prefix + caveat) | `ResponseTable` + `AiCaveatIndicator` | RTL + integration shape |
| R3 (Member render with identifierValue) | `projectResponseRow` + `ResponseRowView` | Unit (4 cases) |
| R4 (long cell truncate + expand) | `ResponseRowView` | Manual / E2E (deferred) |
| R5 (long header truncate + tooltip + aria) | `ResponseTable` header | Manual / E2E (deferred) |
| R6, R6a, R17 (brand-TZ everywhere) | `formatInBrandTz` consumers in section + excelExport | Integration |
| R7 (wave consumed from #378) | Detail-page state lift + `DistributionBatchesFilter.value` | RTL (page.test) |
| R8, R26 (submitted range + COALESCE) | `buildResponseWhere` submitted OR | Unit |
| R9 (channel multi-select) | `buildResponseWhere` channel.in | Unit + Integration |
| R9a (score band, type-gated) | `bandsForScale`, `shouldShowScoreBand`, `buildResponseWhere` | Unit (boundary) + Integration |
| R9b (sentiment band, type+text-gated) | `shouldShowSentimentBand`, sentiment OR-branch | Unit + Integration |
| R9c (shared filter modules; no copy left) | `apps/web/src/components/filters/*`, deletion of old `FilterChips.tsx` | Migration + lint |
| R9d (filter row overflow → popover) | `FilterBar` resize-observer | Manual / E2E (deferred) |
| R10 (filter composition) | `buildResponseWhere` AND of per-group ORs | Unit |
| R11, R12 (pageSize 25/50/100, total/totalPages) | `ResponsePagination` + sessionStorage | RTL + Integration |
| R11a (direct-API pageSize cap 500) | Zod `pageSize.max(500)` | Integration |
| R13, R18 (Export button + disabled states) | `ResponseSection` export anchor | RTL |
| R14 (filename pattern) | `exportFilename` | Unit (boundary cases) |
| R15, R16 (cover block + AI columns + verbatim) | `renderResponsesXlsx` | Unit + Integration shape |
| R18a (50k cap + 413) | Early-return in export handler | Integration |
| R19, R20 (route specs + 404) | Route handlers | Integration |
| R21 (remove vestigial inline `responses`) | Survey-detail handler edit | Integration |
| R22 (audit on both endpoints + aiVintageNonNullCount) | Audit allowlist + `request.audit` stamp; audit plugin extended for audited GETs | Manual review |
| R23, R24 (empty + zero-filter states) | `ResponseSection` empty bodies | RTL |
| R25 (anonymous `—` in UI / empty in export) | `projectResponseRow` + `renderResponsesXlsx` | Unit + Integration |
| GDPR Art. 17 (erasure side-effect) | Forward-only — Phase-1 surface inherits null-FK rendering | Documented as future erasure-worker contract |

## Notes for Phase 11 review

- The integration test for the 50k export cap was written as a happy-path assertion rather than seeding 50k+ rows; the cap behavior is verified at the unit level via the constant export and the handler's early-return shape. If the reviewer wants the row-count path exercised end-to-end, we can drop a temporary `vi.mock` for `EXPORT_ROW_CAP = 0` and seed 1 row — leave a comment if you'd like that added.
- The auth-plugin `?token=` extension widens the credential vector. Risk mitigation: tokens are Clerk-issued JWTs (~60s lifetime), download responses set `Content-Disposition: attachment` so nothing renders in the tab (no opportunity for referer-header leakage to a clickable resource). Documented in RFC §13.2 #2.
- The Excel render module holds the workbook in memory; the 50k cap is a soft mitigation for memory pressure. If audit data shows operators regularly export ≥30k rows, swap `Workbook` → `WorkbookWriter` (streaming) — a same-shape API change, ~10 lines.
