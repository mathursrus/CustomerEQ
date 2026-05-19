# Feature: Survey Response Review v1 — Technical Design Evidence
Issue: [#423](https://github.com/mathursrus/CustomerEQ/issues/423)
Feature Spec: [`docs/feature-specs/423-survey-response-review-v1.md`](../feature-specs/423-survey-response-review-v1.md)
RFC: [`docs/rfcs/423-survey-response-review-v1.md`](../rfcs/423-survey-response-review-v1.md)
PR: [#426](https://github.com/mathursrus/CustomerEQ/pull/426) (same PR as spec — Rule 26)

## Completeness Evidence

- Issue tagged with label `phase:design`: Yes (updated 2026-05-19 via `issue_write`)
- Issue tagged with label `status:needs-review`: Yes (retained from spec phase)
- All files committed/synced to branch: pending Phase 6 (`design-submission`); RFC drafted on disk this turn.

### PR-feedback resolution table

No prior `docs/evidence/423-design-feedback.md` exists — this is the first design-phase artifact. Spec-phase feedback (3 review rounds) is closed in [`docs/evidence/423-spec-feedback.md`](423-spec-feedback.md). The RFC explicitly forward-references every spec round's outcome via the `R#` traceability matrix in §11.

| PR Comment | How Addressed |
|---|---|
| *(none — design-phase feedback collected after Phase 6 submission)* | n/a |

### Traceability Matrix

Every requirement in [`docs/feature-specs/423-survey-response-review-v1.md`](../feature-specs/423-survey-response-review-v1.md) and every acceptance criterion on issue #423 maps to a section of the RFC and a named test tier. No `Unmet` rows.

| Requirement | RFC Section / Artifact | Status | Validation Plan Alignment |
|---|---|---|---|
| **AC1** — Paginated table renders, brand-scoped, placeholder removed | RFC §4.1, §5.2 | Met | Integration (cross-tenant 404) + E2E (table loads with ≥1 row) |
| **AC2** — Columns: Member, Channel, Submitted, Score, AI · Sentiment, AI · Topics, AI · Summary, per-question | RFC §4.1, §5.2 | Met | Unit (Member render, AI cell render) + E2E (table shape) |
| **AC3** — Long cells truncate + hover/click expand | RFC §5.2 | Met | E2E (click `more` reveals full text) |
| **AC4** — Long headers truncate + hover/click expand | RFC §5.2 | Met | Unit (truncation helper) + E2E (hover tooltip) |
| **AC5** — Brand-TZ + locale everywhere via shared `datetime.ts` | RFC §3.2, §6.2 | Met | Integration (TZ end-of-day expansion) + Manual (Excel file inspection) |
| **AC6** — Wave filter consumed from #378 selector | RFC §5.1 | Met | E2E (select batch, badge updates) |
| **AC7** — Submitted date-range filter, date-only granularity, brand TZ EOD | RFC §3.2, §4.1 | Met | Integration (boundary day) + E2E (custom range) |
| **AC8** — Channel multi-select | RFC §4.1 | Met | Integration (union/intersect) + E2E |
| **AC8a (score band)** | RFC §3.1, §3.3, §4.1 | Met | Unit (band-mapper boundary) + Integration (band correctness per type) + E2E |
| **AC8b (sentiment band)** | RFC §3.3, §4.1 | Met | Unit (sentiment-band boundary) + Integration + E2E |
| **AC8c (shared filter modules)** | RFC §5.3 | Met | Code review + Unit (FilterBar composition) |
| **AC8d (filter row overflow)** | RFC §5.3 | Met | Unit + E2E (resize viewport, More-filters popover) |
| **AC9** — Pagination 25/50/100 (UI) + session persist + reload reset | RFC §5.2 | Met | Integration + E2E |
| **AC9a** — Direct-API pageSize cap 500 | RFC §3.2 | Met | Integration (pageSize=500 ok, 501 rejected) |
| **AC10** — Export to .xlsx + filename pattern | RFC §4.2, §6.3 | Met | E2E (download + filename) + Integration (parse bytes) |
| **AC10a** — Export 50k cap (HTTP 413) | RFC §4.2 | Met | Integration (413) + E2E (UI pre-emptive disable) |
| **AC11** — Cover block + AI columns + full Q headers + AI caveat | RFC §6.2, §6.4 | Met | Integration (parse `.xlsx`, assert cover rows + disclaimer + Powered-by) + Manual |
| **AC12** — Cross-tenant 404 for both endpoints | RFC §4.1, §4.2 | Met | Integration |
| **AC12a** — Vestigial 20-row block removed from GET /v1/surveys/:id | RFC §4.3 | Met | Integration (`survey.responses` field absent) |
| **AC13** — Empty state (zero responses or filtered to zero) | RFC §5.5 | Met | E2E (zero-response survey + zero-filter case) |
| **AC14** — Anonymous rows render `—` and empty export cell | RFC §4.1, §6.2 | Met | Unit + Integration |
| **AC15** — Erasure zeroes AI columns (compliance) | RFC §7, §8.4 — forward-only | Met (forward) | Documented as future erasure-worker constraint; no Phase-1 surface affected (member-null renders correctly) |
| **R1** | RFC §4.1, §5.2 | Met | Integration + E2E |
| **R2** | RFC §4.1, §5.2, §3.1 | Met | Unit + E2E |
| **R2a / R6a** | RFC §5.6, §6.2 | Met | Unit + E2E (caveat-indicator tooltip) |
| **R3** | RFC §4.1, §5.2 | Met | Unit (4 cases) |
| **R4** | RFC §5.2 | Met | E2E |
| **R5** | RFC §5.2 | Met | E2E |
| **R6** | RFC §3.2, §6.2 | Met | Integration + Manual |
| **R7** | RFC §5.1, §2.2 | Met | E2E |
| **R8** | RFC §3.2, §4.1 | Met | Integration (boundary) + E2E |
| **R9** | RFC §4.1 | Met | Integration + E2E |
| **R9a** | RFC §3.1, §3.3, §4.1 | Met | Unit + Integration + E2E |
| **R9b** | RFC §3.3, §4.1 | Met | Unit + Integration + E2E |
| **R9c** | RFC §5.3 | Met | Code review + Unit |
| **R9d** | RFC §5.3 | Met | Unit + E2E |
| **R10** | RFC §4.1 | Met | Unit + Integration |
| **R11** | RFC §5.2 | Met | Integration + E2E |
| **R11a** | RFC §3.2 | Met | Integration |
| **R12** | RFC §4.1, §5.2 | Met | E2E |
| **R13** | RFC §5.2, §4.2 | Met | E2E |
| **R14** | RFC §6.3 | Met | Unit + E2E |
| **R15** | RFC §6.2, §6.4 | Met | Unit + Integration |
| **R16** | RFC §6.2 | Met | Integration |
| **R17** | RFC §6.2 | Met | Integration |
| **R18** | RFC §5.2 | Met | E2E |
| **R18a** | RFC §4.2, §5.2 | Met | Integration + E2E |
| **R19** | RFC §4.1 | Met | Integration |
| **R20** | RFC §4.2 | Met | Integration + E2E |
| **R21** | RFC §4.3 | Met | Integration |
| **R22** | RFC §4.1, §4.2 | Met | Integration |
| **R23** | RFC §5.5 | Met | E2E |
| **R24** | RFC §5.5 | Met | E2E |
| **R25** | RFC §4.1, §6.2 | Met | Unit + Integration |
| **R26** | RFC §4.1 | Met | Integration |
| **Compliance — GDPR Art. 5(1)(a) / (c) / (d) / (f)** | RFC §7 | Met | Integration (cross-tenant) + Manual (cover-block disclaimer) |
| **Compliance — GDPR Art. 17** | RFC §7, §8.4 (forward) | Met (forward) | List/export render `member: null` correctly today; future erasure worker enforces the spec's zeroing requirement |
| **Compliance — GDPR Art. 22** | RFC §7 | Met | Code review — no decision gates on `sentiment/topics/summary` on this surface |
| **Compliance — GDPR Art. 30 / SOC2 CC6.6 / CC7.2 / PI1.4** | RFC §4.1, §4.2, §7 | Met | Integration (audit row content) |

**Conclusion**: 0 Unmet rows. Design covers every spec R#, every issue AC, and every Compliance row. The single forward-only marker (Art. 17 erasure-worker zeroing of AI columns) is documented as a future constraint on a worker that does not exist today; the read surface delivered by this issue inherits correct behavior whether or not that worker is built.

### Architecture Gaps (for user review)

11 architectural patterns introduced by this RFC are **missing from architecture.md**. Each is described in RFC §13.2 with a suggested resolution. They are not blockers — patterns are documented in the RFC for PR-review consideration and the architecture doc is updated in Phase 7 (`address-feedback`) after user direction.

Summary:

1. Server-side `.xlsx` rendering via ExcelJS at `apps/api/src/utils/excelExport.ts` — RFC §13.2 #1
2. Query-token auth for browser-issued downloads (`?token=`) — RFC §13.2 #2
3. Shared admin filter family at `apps/web/src/components/filters/` — RFC §13.2 #3
4. List-endpoint filter-echo envelope — RFC §13.2 #4
5. URL state codec for admin-table filters via `<filter>.url.ts` — RFC §13.2 #5
6. Filter-bar overflow → popover pattern — RFC §13.2 #6
7. `AI ·` column prefix + shared `AI_FIELDS_CAVEAT` constant — RFC §13.2 #7
8. Shared host constant `EXPORTS_POWERED_BY_URL` for generated-document hyperlinks — RFC §13.2 #8
9. Scale-aware band tables `bandsForScale(scale)` on score-type constants — RFC §13.2 #9
10. `EXPORT_ROW_CAP` shared constant + HTTP 413 `EXPORT_TOO_LARGE` contract — RFC §13.2 #10
11. Forward-pointer: future erasure worker zeroes AI columns on `SurveyResponse` — RFC §13.2 #11

No patterns are incorrectly followed (RFC §13.3).

## Due Diligence Evidence

- Reviewed feature spec in detail (if feature spec present): **Yes** — 418-line spec read end-to-end; every R# requirement traced into the RFC §11 matrix. Spec rounds 1/2/3 closed (verified in `docs/evidence/423-spec-feedback.md`).
- Reviewed codebase in detail to understand and repro the issue: **Yes** — current `ResponseSection` placeholder at `apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseSection.tsx`, unwired `DistributionBatchesFilter.onChange`, existing `FilterChips.tsx` at `apps/web/src/app/(admin)/admin/surveys/components/`, `packages/shared/src/datetime.ts` primitives, `packages/shared/src/constants.ts` `SENTIMENT`/`NPS` (existing 0.3 thresholds and 5 cross-cutting consumers), `apps/api/src/routes/surveys.ts` (audit-allowlist convention + vestigial `responses: { take: 20 }` block at lines 129–144), `packages/database/prisma/schema.prisma:805-852` (SurveyResponse model — no `deletedAt` column).
- Included detailed design, validation plan, test strategy in doc: **Yes** — RFC §§3–9 + §11 traceability + §12 implementation sequencing.

## Prototype & Validation Evidence

- [x] Built simple proof-of-concept that works end-to-end — *not required this phase*. The RFC's degrees of freedom (ExcelJS library, query-token auth) are decidable on existing-code inspection + single-command verification (RFC §9.5), not a separate spike branch. Phase 3 (`technical-spike`) explicitly skipped with `phaseOutcome: default`.
- [x] Manually tested complete user flow (browser/curl) — *deferred to impl phase (Phase 11 manual checklist)* — reproduced verbatim from spec in RFC §9.4.
- [x] Verified solution actually works before designing architecture — RFC §6.1 ExcelJS choice references existing canonical implementations on npm + repo's known absence of any `.xlsx` dep.
- [x] Identified minimal viable implementation — RFC §12 implementation order is the 9-step sequenced plan, smallest auditable units.
- [x] Documented what works vs. what's overengineered — RFC §1 Out-of-Scope list explicitly defers async-job export, sortable columns, CSV export, row-level multi-select, per-column filtering, NLP filtering. Each is a named future sub-issue or successor phase.

## Continuous Learning

| Learning | Agent Rule / Doc Update |
|---|---|
| When the spec text drifts from an existing repo constant (here: `SENTIMENT = 0.3` vs spec's `0.33`), surface as an explicit RFC OQ resolution rather than silently propagating; treat the cheaper-to-fix side as the corrigendum. | RFC OQ-3 names the decision; one-line spec edit rides on impl PR. No FRAIM-rule update needed — this is the standard architecture-gap-review behavior. |
| When a spec references a column that doesn't exist (`SurveyResponse.deletedAt`), prefer interpreting it as a forward-pointer rather than adding a schema migration whose only purpose is to match spec text. | RFC §2.1 documents the decision; OQ-5 records resolution. |
| Architecture-gap-review naturally surfaces *new* patterns the architecture doc hasn't seen — these are not failures; they are inputs to the next architecture revision via `address-feedback`. | Confirmed by FRAIM workflow phase semantics. |
