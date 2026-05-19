# Feature: Survey Response Review v1 — per-member tabular view, basic filters, wave filtering, Excel export

Issue: [#423](https://github.com/mathursrus/CustomerEQ/issues/423)
Parent: [#235](https://github.com/mathursrus/CustomerEQ/issues/235) (Survey response review & analysis umbrella)
Owner: manohar.madhira@outlook.com
Status: **Draft — feature-specification Phase 2 (`spec-drafting`).**
Last touched: 2026-05-18

---

## Customer

The primary persona is the **Survey Owner** — the brand admin / CX operator who launched a survey from `/admin/surveys/[id]/edit` (or the equivalent #241 editor) and now wants to know what their customers said. They are not an analyst with SQL access; they are reading raw answers, judging "what's the gist," and often exporting to Excel so they can paste into the same spreadsheet they keep their NPS history in.

A secondary persona is the **operations admin** who only logs in after a wave finishes (often via the existing `/admin/surveys/[id]/distribute/batches/[batchId]` detail page — #378) and wants to drill into that wave's responses specifically. The wave filter shipped by #378 lives above the Response section already; this issue wires its selection state into the Response table.

The respondent persona (the customer answering the survey) is **out of scope** — they never see this surface.

---

## Customer's Desired Outcome

1. **See who answered and what they said** — one row per response, member identity in the first column, every survey question rendered as a column, the member's verbatim answer in each cell. Open the survey detail page, scroll to the Response section, read.
2. **Filter to the slice that matters** — when investigating "what did Q2 NPS say?" filter to that wave; when investigating "what's been coming in this week?" filter the date range; when investigating "what did the in-app respondents say vs. the email respondents?" filter the channel.
3. **Read in the brand's time, not UTC** — every timestamp, every date filter, every header tooltip uses `Brand.timezone` and `Brand.locale`. The operator should never have to do mental UTC arithmetic to decide whether a response landed on Monday or Tuesday in their workday.
4. **Read full text without losing the row context** — long verbatim answers and long question wording stay readable. Truncate inline, expand on hover or click — the operator's eye stays on the row.
5. **Export to Excel and keep working** — a single `.xlsx` download that contains exactly the rows the operator is looking at on screen (filters applied), plus a small cover block stating which filters were active at export time so a stakeholder receiving the file knows the slice. Free-text answers are preserved verbatim — Excel becomes the operator's analysis workbench.
6. **No premature analytics** — Phase 1 deliberately does not surface AI-derived columns (sentiment / topic / summary), aggregate charts, or per-question synthesis. Those live in successor sub-issues of #235. This surface is the raw substrate the rest of #235 will build on.

---

## Customer Problem being solved

The survey detail page (`/admin/surveys/[id]`) ships an empty Response section today. The placeholder body at `apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseSection.tsx:11–13` explicitly punts to "a sibling sub-issue to #235." Today, when a Survey Owner asks the simplest question — *"what did my customers say?"* — the platform's only answers are:

1. **Hand-roll a DB query** — `SurveyResponse.answers` is JSON of `{ questionId: answer }` per the schema (`packages/database/prisma/schema.prisma:759`); the verbatim text is captured by the public widget per question and stored intact, but nothing on the admin UI renders it. Operators have no path here.
2. **Hover over the row sparkline on CX Insights** — verbatim *is* shown there per the audit notes on #235 (Gap 19), but it lives on a different surface (CX Insights) and only for the AI-clustered subset; it's not the per-survey-by-survey view a Survey Owner reaches from the survey detail page.
3. **Read AI-extracted topic chips** — the `topics` and `sentiment` columns are populated for free-text answers, but they sit on top of `extractOpenEndedText()` which concatenates *all* free-text answers into one blob before sending to the analyzer (`apps/api/src/utils/survey.ts:1–13`). Topics are computed for the combined string, not per question. So even the AI-derived columns are misleading for multi-question surveys.

The cumulative effect: an operator who runs a 4-question NPS survey, gets 200 responses, and asks "what did the detractors say?" must either build a SQL query or accept that the platform shows them topic tags computed for the answers smushed together. Neither answers the question. And without Phase 1, none of the successor sub-issues on #235 (per-question AI synthesis, peaks/pits/requests, aggregate views) have a surface to attach to.

The four narrower problems Phase 1 addresses, in the language of the Survey Owner:

1. **"I can't see what they wrote."** Verbatim text is captured but unrendered on the survey detail page. The whole Response section is a placeholder.
2. **"I can't filter to the wave I just sent."** #378 shipped the wave selector above the section (`DistributionBatchesFilter.tsx`); its `onChange` is unwired. So even when the operator selects "Q2 2026 NPS · 2026-04-15 · 87 / 100," nothing happens.
3. **"I read dates in my time zone, not UTC."** The few timestamps that currently surface on the response area come back as the raw `completedAt` ISO string. Brand timezone and locale are already stored on `Brand` (per Issue #277) and already used by `DistributionBatchesFilter` for date formatting — but the response data is not formatted with them.
4. **"I can't take this anywhere."** No export. No "give it to my VP" path that doesn't involve a screenshot.

---

## User Experience that will solve the problem

The mock at [`mocks/423-survey-response-review-v1.html`](mocks/423-survey-response-review-v1.html) is the working artifact — walk the scenes in-browser. Sections below describe the experience at the level of specific steps the operator takes; the mock is the source of truth for visual layout, copy, and affordances.

### §1. Entry point

- **Path**: `/admin/surveys/[id]` — no new route. The Response section already exists in the DOM; this issue replaces its placeholder body. Default expansion state per #241 R32: expanded when `responsesCount > 0`, collapsed when `responsesCount === 0`.
- **The wave selector from #378 is already above the section** (`apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx:181–188`). The Response section consumes its selection state. No new wave UI inside the section.

### §2. The Response section — at a glance

When the operator expands the Response section on a survey with responses, they see (top-to-bottom):

1. **Section header**: title `Response`, count badge `87 responses` (the filtered total, recomputed when filters change), and **`Export to Excel`** action button at the right edge.
2. **Filter row** (chip-style, matching `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx` semantics): `Submitted: Last 7 days · Last 30 days · Last 90 days · All time · Custom`, then `Channel: email · in_app · link · sms · review`.
   - Filters intersect across groups, union within a group. Defaults: `All time` and all channels selected.
   - Date filter is **date-only granularity** (no time-of-day). The operator picks two dates; the server interprets `submittedTo` as inclusive through end-of-day in `Brand.timezone`. Helper text below the custom range reads *"All dates in `<Brand.timezone>`"*.
3. **Table**, one row per response. Columns:
   - **Member** — `Member.firstName Member.lastName (<Brand.memberIdentifierKind value>)`. For an `email`-keyed brand, that reads `Jane Doe (jane@example.com)`. For an `external_id`-keyed brand: `Jane Doe (cust_92413)`. Anonymous rows (e.g., Google Reviews import — `memberId IS NULL`) render `—`. If first/last name are both null, the parenthesized identifier stands alone: `(jane@example.com)`.
   - **Channel** — the raw `SurveyResponse.channel` value.
   - **Submitted** — formatted in `Brand.timezone` + `Brand.locale`. For live rows, `SurveyResponse.completedAt`; for historical-import rows, `SurveyResponse.importedAt`. Cell tooltip on hover shows both, prefixed `Live submitted at …` or `Imported, original timestamp …`, again in brand TZ.
   - **Score** — `SurveyResponse.score` rendered raw with a small inline scale annotation (`8 / 10` for NPS, `4 / 5` for CSAT, `5 / 7` for CES). The annotation is derived from `Survey.type` — single survey, single type, no chip needed.
   - **One column per question in `Survey.questions` order** — header is the question text, cell is the verbatim value from `SurveyResponse.answers[questionId]`.
     - Long question headers truncate at ~28 characters, the full text revealed on hover. The truncated display is also `aria-describedby` the full text for keyboard / screen-reader access.
     - Long cell values truncate at ~120 characters with an inline `… more` affordance; clicking the affordance expands the row to reveal the full text (single-row expansion, the rest of the table is unaffected). Hover on the truncated text shows a tooltip with the same content (faster glance path for short verbatims; click path for longer ones).
     - Numeric answers render raw. Choice answers render the option label, not the option value (e.g., `Very satisfied`, not `4`).
4. **Pagination footer**: page-size selector `25 · 50 · 100` (default 25, choice persists for the session, reload resets to 25), prev / next, `Page X of Y · N responses` text. Counters reflect the filtered total.

### §3. Walking the operator through a typical session

The mock walks five scenes. The narrative version:

1. **Land on the survey detail page.** The Survey Owner clicks a survey in `/admin/surveys`, lands on `/admin/surveys/[id]`. The Response section is auto-expanded (responses exist). They see the table loaded with the most recent 25 rows, default sort by `Submitted` descending.
2. **Filter to a wave.** They click the wave dropdown above the section (the #378 selector). Choose `Q2 2026 NPS · 2026-04-15 · 87 / 100`. The Response section's table refetches, the count badge updates from `412 responses` to `87 responses`.
3. **Filter to detractors-only date range.** They click `Custom` in the Submitted preset row, pick `Apr 15 → Apr 22`. The submitted-to date is interpreted as `end-of-day Apr 22 in Brand.timezone`. Count updates to `54 responses`.
4. **Expand a long verbatim.** A detractor row's open-ended answer is truncated to *"The reps were polite but I waited 40 minutes for someone to acknowledge…"* The operator clicks `more`. The row expands in place, the full text renders. They read it, click `less` (or anywhere else on the row), the row collapses.
5. **Export to Excel.** They click `Export to Excel`. A file `survey-Q2-2026-NPS-responses-2026-05-18.xlsx` downloads. They open it. The first 6 rows are the cover block (survey id, type, export timestamp in brand TZ, exporter email, active wave label, active date range, active channels, total row count). The data sheet starts at row 8 with full question headers and full verbatim answers.

### §4. Empty states and edge cases

- **Zero responses on the survey.** Section collapses by default (#241 R32). When the operator expands it, the body shows a single non-table empty state: *"No responses yet — distribute the survey or run a historical import to populate this view."* The Export button is disabled with tooltip *"Nothing to export — this survey has no responses."*
- **Filters yield zero responses (survey itself has responses).** Table area shows *"No responses match the current filters."* with a single subtle `Clear filters` link. The Export button is disabled with tooltip *"Nothing to export — current filters yield 0 responses."*
- **Anonymous responses (Google Reviews import etc., `memberId IS NULL`).** Member column renders `—`. The export cell is empty. The row is otherwise treated identically — same channel/score/answer rendering.
- **A historical-import response with `completedAt` null.** Submitted column uses `importedAt`; tooltip says *"Imported response, original timestamp …"*. The date-range filter checks the row in against `COALESCE(completedAt, importedAt)` (server-side) so the operator filtering by "Apr 15 → Apr 22" sees historical rows whose original timestamp falls inside the window.
- **A question was added to the survey after some responses were captured.** The new question's column shows `—` for the older responses that don't have that key in `answers`. The header is unchanged.
- **A question was removed from the survey after some responses were captured.** Phase 1 reads `Survey.questions` for column structure; if `answers` has keys not in `Survey.questions` they are not rendered. (The full data is still in the database — out of scope for this phase to surface deleted-question values.)
- **Brand without `timezone` / `locale` configured.** `Brand.timezone` defaults to `"UTC"` and `Brand.locale` defaults to `"en-US"` in the schema (`packages/database/prisma/schema.prisma:212–213`). The operator gets `UTC` + `en-US` formatting until they configure on `/admin/settings/organization`. No code path needs to defend against null values.

---

## Functional requirements

All requirements use SHALL-style language. Traceability tags map to acceptance criteria on issue #423.

### Display

- **R1.** The Response section SHALL render a paginated table with one row per `SurveyResponse` for the survey, scoped to `request.brandId`.
- **R2.** Each row SHALL show: Member, Channel, Submitted, Score, and **one column per question** in `Survey.questions` order, the cell containing the verbatim value from `SurveyResponse.answers[questionId]`.
- **R3.** The Member column SHALL render as `Member.firstName Member.lastName (<identifier value>)` where identifier value is selected by `Brand.memberIdentifierKind` (EMAIL → `Member.email`, PHONE → `Member.phone`, EXTERNAL_ID → `Member.externalId`, MEMBER_ID → `Member.id`). If both firstName and lastName are null, the parenthesized identifier stands alone. If `memberId IS NULL`, the cell renders `—`.
- **R4.** Free-text cell values longer than 120 characters SHALL truncate inline with a `… more` affordance; clicking the affordance SHALL expand the row to reveal the full text without disrupting other rows. Hovering the truncated text SHALL show a tooltip containing the full text.
- **R5.** Question-column headers SHALL carry the full question text. When the header text exceeds the column visual budget (~28 characters in the default layout) it SHALL truncate inline with the full text revealed on hover. The truncated header SHALL be associated with the full text via `aria-describedby` for keyboard / screen-reader access.
- **R6.** All displayed dates and times (Submitted column, header tooltips, filter inputs, filter chip labels, pagination footer, export filename, export cover block) SHALL be formatted in `Brand.timezone` using `Brand.locale`. No UTC display SHALL appear on this surface.

### Filtering

- **R7.** The Response section SHALL consume the wave selection from `DistributionBatchesFilter.tsx` (already in the DOM above the section). Selection lifts to the detail page; the Response section receives it as a prop and refetches when it changes. The Response section SHALL NOT render its own wave chip.
- **R8.** Submitted date range filter SHALL accept presets `Last 7 days · Last 30 days · Last 90 days · All time · Custom`. Custom mode SHALL accept two date inputs (date-only granularity, no time-of-day). The `submittedTo` date SHALL be interpreted server-side as inclusive through end-of-day in `Brand.timezone`. The filter SHALL apply to `COALESCE(completedAt, importedAt)`.
- **R9.** Channel multi-select chips SHALL filter the table server-side, with options from the distinct `channel` values present on the survey's response set. Semantics SHALL match `apps/web/src/app/(admin)/admin/surveys/components/filter-chips.logic.ts` (intersect across groups, union within group).
- **R10.** Wave + Submitted + Channel filters SHALL compose by intersection — a response appears iff it matches the wave selection AND the submitted range AND the channel set.

### Pagination

- **R11.** The pagination control SHALL provide a page-size selector with values `25 (default) · 50 · 100`. The choice SHALL persist for the operator's session on the page and reset to 25 on full page reload.
- **R12.** `total` and `totalPages` in the pagination footer SHALL come from the server response and reflect the **filtered** total (not the survey's full response count). The count badge in the section header SHALL match `total`.

### Export

- **R13.** The Response section header SHALL include an `Export to Excel` button. Clicking it SHALL download an `.xlsx` matching the current filter set (not just the current page).
- **R14.** The export filename SHALL follow the pattern `survey-<safeSlug>-responses-<YYYY-MM-DD>.xlsx`, where `safeSlug` is the survey name slugified for filesystem-safe characters and the date is rendered in `Brand.timezone` using `Brand.locale`.
- **R15.** The exported workbook SHALL begin with a cover block (rows 1–6) containing, one labeled key-value pair per row in order: **Survey** (`name · type · id`), **Exported at** (timestamp in brand TZ + locale), **Exported by** (operator email), **Wave** (active wave selection label — `All waves and direct responses`, the batch label, or `Direct responses`), **Submitted range** (date range as displayed, brand TZ), **Channels** (comma-separated active channels, or `All channels` when none deselected), **Total rows** (the filtered total). Row 7 is intentionally blank; data starts at row 8.
- **R16.** Exported column headers SHALL contain the **full** question text (no truncation). Free-text answers SHALL be preserved verbatim (no truncation, no AI synthesis applied).
- **R17.** All dates and times in the exported workbook (cover block and data area) SHALL be rendered in `Brand.timezone` using `Brand.locale`. ISO-8601 strings SHALL NOT appear except in the survey-id row of the cover block.
- **R18.** The Export button SHALL be disabled when the filtered total is zero, with a tooltip explaining why.

### API

- **R19.** A new route `GET /v1/surveys/:id/responses` SHALL be added. Query params: `page` (int ≥ 1, default 1), `pageSize` (`25 | 50 | 100`, default 25), `wave` (`all | direct | <batchId>`, default `all`), `submittedFrom` (date `YYYY-MM-DD`, optional), `submittedTo` (date `YYYY-MM-DD`, optional, expanded server-side to end-of-day in `Brand.timezone`), `channels[]` (optional; when omitted, all channels). Response: `{ data: ResponseRow[], total, page, pageSize, totalPages }`. Each `ResponseRow` includes `id`, `answers`, `member: { firstName, lastName, identifierValue } | null`, `distributionBatchId`, `distributionBatch.label`, `importBatchId`, `importBatch.name`, `channel`, `completedAt`, `importedAt`, `score`. Tenant scoping: `WHERE brandId = request.brandId` enforced via the existing Prisma middleware; cross-tenant requests return 404 (Issue #332 pattern).
- **R20.** A new route `GET /v1/surveys/:id/responses.xlsx` SHALL accept the same filter query params (no `page` / `pageSize` — all matching rows are exported). The response Content-Type SHALL be `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. The Content-Disposition header SHALL be `attachment; filename="<R14 pattern>"`. The cover block (R15) and data sheet (R16) SHALL be assembled server-side; the client SHALL NOT transform the response.
- **R21.** The existing `GET /v1/surveys/:id` SHALL NOT be modified by this issue. (Its inline 20-row response list stays as-is; this surface migrates to the new endpoint.)
- **R22.** All new endpoints SHALL log a structured audit entry via the existing audit plugin (`auditAction: 'survey.responses.list'` and `'survey.responses.export'`, `auditResourceType: 'survey'`, allowlist: `wave`, `submittedFrom`, `submittedTo`, `channels`, `total`, `requestIp`). The export audit entry SHALL capture the operator's email for SOC2-aligned traceability.

### Empty / error states

- **R23.** When the survey has zero responses, the section SHALL render the empty-state body specified in §4 (non-table). The Export button SHALL be disabled.
- **R24.** When the filtered set is zero (survey has responses), the table area SHALL render the filtered-empty body specified in §4. The Export button SHALL be disabled.
- **R25.** Anonymous responses (`memberId IS NULL`) SHALL render `—` in the Member column on screen and an empty cell in the export.
- **R26.** A response missing the `completedAt` value SHALL fall back to `importedAt` for both display and filtering.

---

## Compliance Requirements

This surface displays and exports member PII (name + identifier per `Brand.memberIdentifierKind` — typically email) and verbatim survey answers (which may contain PII the customer typed). The applicable controls follow from `fraim/config.json.customizations.compliance.regulations`: GDPR (in-scope), CCPA (in-scope), SOC2 (target month 12), PCI-DSS (minimal scope).

### GDPR

- **GDPR Art. 5(1)(a) — lawfulness, fairness, transparency.** Display and export are read-by-the-data-controller actions, not new processing surfaces — the lawful basis for processing the data was established at collection (consent captured via `Member.consentGivenAt` and `Survey.consentMode`). No additional disclosure required to the data subject for this surface.
- **GDPR Art. 5(1)(c) — data minimization.** The export includes only the fields needed for the operator's analysis task. AI-derived columns (sentiment / topic / summary), which are out of Phase 1 scope, do not appear in the export — keeping the file's PII surface tight. The export cover block includes operator email + export timestamp so a downstream possessor knows the chain of custody.
- **GDPR Art. 5(1)(f) — integrity and confidentiality.** API access is tenant-scoped via `request.brandId` from the JWT (project rule R6). Cross-tenant requests return 404 (Issue #332 pattern). The export endpoint inherits the same auth.
- **GDPR Art. 15 — right of access.** Out of scope: this is the brand-operator-facing read surface, not the data-subject's right-of-access route.
- **GDPR Art. 17 — right to erasure.** Soft-deleted responses (`SurveyResponse.deletedAt IS NOT NULL`) SHALL be excluded from list and export results, inheriting the existing pattern at `apps/api/src/routes/surveys.ts:103` and `apps/api/src/routes/surveys.ts:124` (Issue #332). Members whose records have been zeroed by the erasure worker SHALL render with whatever non-null fields remain after erasure (typically `—` Member cells) without throwing.
- **GDPR Art. 30 — record of processing activities.** The export audit entry (R22) records who exported what, when, and from which IP, contributing to the existing audit-log trail.

### CCPA

- **CCPA §1798.100 — right to know.** Same as GDPR Art. 15 — out of scope for this read surface.
- **CCPA §1798.105 — right to delete.** Same as GDPR Art. 17 — soft-delete filter inherited.

### SOC2 (target month 12)

- **CC6.1 / CC6.6 — logical access controls.** Tenant scoping per R6; auth via Clerk JWT.
- **CC7.2 — system monitoring.** Audit entries per R22 capture all list and export operations.
- **PI1.1 / PI1.4 — input and processing integrity.** The export rendering pipeline is server-side; client cannot alter the cover block or smuggle in extra columns. The `.xlsx` produced is a faithful representation of the filter set at export time.

### PCI-DSS (minimal scope)

- The survey response surface does not handle payment card data. No PCI controls apply.

### Compliance Validation

- **GDPR Art. 5(1)(c) test** — Manual workbook inspection: open the exported `.xlsx`, confirm columns are limited to Member, Channel, Submitted, Score, and one column per question (no AI columns, no internal IDs except in the survey-id cover row).
- **GDPR Art. 5(1)(f) test** — Integration test: a Brand A token requesting `GET /v1/surveys/<Brand-B-survey-id>/responses` SHALL return HTTP 404. A Brand A token requesting `GET /v1/surveys/<Brand-B-survey-id>/responses.xlsx` SHALL return HTTP 404.
- **GDPR Art. 17 test** — Integration test: a soft-deleted `SurveyResponse` SHALL be absent from both the list endpoint and the export endpoint.
- **Audit test** — Integration test: invoking the export endpoint SHALL write an audit row with `action='survey.responses.export'`, `metadata.total ≥ 0`, `metadata.requestIp` populated.

---

## Validation Plan

### Unit tests (Vitest, `pnpm test:smoke`)

- Member-column rendering: `(firstName, lastName, identifierValue, identifierKind)` × cases (both names present / both null / null member) → expected display string.
- Date formatting helper: given `(iso, timezone, locale)`, render expected string. The brand-TZ formatter pattern is the same one in `DistributionBatchesFilter.fmtDate` — promote to a shared helper at `packages/shared/src/datetime.ts` if not already there, reuse.
- Filter composition: given a wave selection, a date range, a channel set → resolved Prisma `where` clause shape (snapshot test).
- Excel cover-block builder: given `(survey, exporter, filterState, totalRows)` → expected cell map for rows 1–7.

### Integration tests (Vitest + supertest against test DB, `pnpm test:integration`)

- `GET /v1/surveys/:id/responses` happy path: response includes verbatim from `answers`, member-identity fields, batch label, channel, score, submitted.
- Tenant isolation: cross-tenant 404 for both endpoints.
- Wave filter: `wave=all`, `wave=direct`, `wave=<batchId>` each return the expected slice.
- Date filter: `submittedTo=2026-05-18` includes a response with `completedAt = 2026-05-18T23:50:00Z` when `Brand.timezone = 'UTC'`, excludes it when `Brand.timezone = 'America/Los_Angeles'` (because 23:50 UTC is `16:50 PST` next day's bucket — wait, that's wrong direction; let me reverse: a response at `completedAt = 2026-05-19T06:00:00Z` is `2026-05-18 23:00 PST` and SHALL be included for `submittedTo=2026-05-18` under `Brand.timezone='America/Los_Angeles'`). The brand-TZ end-of-day expansion is the critical correctness path.
- Channel filter: multi-select returns the union; empty selection (all chips off) returns 0 rows.
- Pagination: `pageSize=50&page=2` returns rows 51–100; `pageSize=100&page=1` returns rows 1–100.
- Anonymous member rendering: a response with `memberId IS NULL` appears in the list with `member: null`; export sheet has an empty Member cell.
- Soft-delete: a response with `deletedAt IS NOT NULL` does not appear in either endpoint.
- Audit: the export endpoint writes an audit row with the expected action and metadata.
- XLSX shape: parse the `.xlsx` body in the test, assert cover-block contents and the data sheet header row.

### E2E tests (Playwright, `pnpm test:e2e`)

- **Happy path** — log in as a brand admin, navigate to `/admin/surveys/<id>`, expand Response, see the table loaded with 25 rows; change page size to 50; navigate to page 2; verify 50 rows are visible.
- **Wave filter wiring** — select a batch from the #378 selector, verify the Response table's count badge updates and the rows reflect the selection.
- **Date filter** — choose `Custom`, pick a 7-day range, verify the count badge updates and out-of-range rows are gone.
- **Cell expansion** — locate a truncated free-text cell, click `more`, verify full text becomes visible.
- **Header tooltip** — hover a truncated header, verify the full question text appears in a tooltip.
- **Export** — click `Export to Excel`, intercept the download, parse the bytes server-side via Vitest helper, verify cover block + data sheet headers.
- **Empty state** — navigate to a survey with zero responses, expand the section, verify the non-table empty state and disabled Export button.

### Manual verification (browser)

The FRAIM Phase 11 (`address-feedback` after implementation) verification checklist:

- Open the survey detail page in two browser tabs side by side — one as Brand A admin, one as Brand B admin. Confirm each sees only their own surveys' responses.
- Configure Brand A's timezone to `America/Los_Angeles`. Submit a test response right now (UTC time captured in `completedAt`). Reload — the Submitted column should show the PST/PDT time corresponding to "right now," not the UTC time.
- Run a CSV-import historical wave (#262) into a survey. Confirm the historical rows render with `importedAt` and the Submitted column tooltip says "Imported response."
- Export. Open the `.xlsx` in actual Excel (not just programmatic parsing). Confirm the cover block reads naturally, dates are in the brand's local format, free-text answers are intact across line breaks.

---

## Alternatives

| Alternative | Why discard? |
|---|---|
| **Render the table inside the existing `GET /v1/surveys/:id` response (no new endpoint).** | The current shape returns the last 20 responses inline without `answers` (the verbatim payload). Loading all responses into the detail-page initial fetch would balloon the response size and tie display pagination to detail-page pagination. The new endpoint cleanly separates "survey identity / config" from "response listing" and supports paging without rewriting the detail page. |
| **Run the export client-side from the current page's data.** | Would only export the visible page, not the filtered set. Operators want the export to mean "everything in my filter," not "the 25 rows I happen to be looking at." Server-side rendering also keeps the cover-block authorship and audit trail under server control, which the GDPR / SOC2 sections rely on. |
| **Use the existing `XLSX` generator from `apps/api/src/routes/...` if one exists.** | A repo scan finds no existing `.xlsx` generator in the API layer (CSV-only at `apps/api/src/routes/...` and `worker` import paths). Adding `exceljs` as a new dep is the cheapest path. ExcelJS is the established node-side library that handles cell-level formatting (the cover block needs label/value cells with light styling); SheetJS is the alternative and is also acceptable. Decision deferred to RFC — both are reasonable; the spec mandates server-side server-XLSX assembly, not the specific library. |
| **Surface AI-derived columns (sentiment / topic / summary) in this Phase 1.** | The AI pipeline today runs on the concatenated blob (`extractOpenEndedText` joins all answers). Surfacing those columns now would be wrong-by-construction for multi-question surveys. Successor sub-issues of #235 will fix the AI pipeline (per-question synthesis with question text in the prompt) and then surface columns; Phase 1 is the raw substrate for that work, not the analytic layer. |
| **Combine Wave filter into the Response section's chip row (de-dup the #378 dropdown).** | The #378 wave selector is already implemented, already in the DOM, and is part of a richer batch-aware affordance (it links to the batch detail page when a specific batch is selected). Re-implementing it as a chip inside the Response section would be churn for no operator benefit and would lose the batch-detail link. Wiring the existing selector's `onChange` is the cheapest path. |
| **Add a dedicated `/admin/surveys/[id]/responses/[responseId]` detail route for long answers.** | Row-expand handles the long-text problem without a route change, and the inline placement keeps the operator's eye on the row context (which member, which other answers, which score). A detail route can be added later as a successor sub-issue if expand-in-row proves insufficient — the spec calls it out as a deferred enhancement, not a Phase 1 deliverable. |

---

## Competitive Analysis

### Configured Competitors Analysis

| Competitor | Current Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|---|---|---|---|---|---|
| **SurveyMonkey** | Per-survey "Analyze Results" tab with an Individual Responses sub-tab; one card per response with all Q/A pairs; bulk export to XLSX or CSV. | Mature; row-expand pattern; well-known XLSX export with question text as headers; per-respondent permalink. | "One card per response" requires scrolling for tabular survey-wide comparison; export workflow well-trodden but the analytics layer is a separate product (SurveyMonkey Genius). | Survey owners overwhelmingly use SurveyMonkey's individual-responses + XLSX export as their analysis primitive — anchors the operator expectation. | Market leader for general-purpose surveys; ~$1B revenue. |
| **Qualtrics XM** | Per-survey "Data & Analysis" workspace; live filtering, response stream, "Crosstab" pivots, export to XLSX/SPSS/CSV. | Powerful filters across response and member attributes; preserves response metadata; enterprise-grade XLSX with embedded codebook. | Heavy UI, steep learning curve; the export's metadata sheets are often noise for a mid-market operator who just wants the rows. | Considered the gold standard for enterprise CX; but typically over-spec for a mid-market Survey Owner doing "what did they say this quarter?" | Enterprise leader; ~$1.5B revenue. |
| **Delighted** | "Responses" tab with infinite scroll, basic filters (date, channel, segment); CSV export. | Clean, minimal; date and channel filters are first-class. | No XLSX export with cover block / filter provenance; no per-question column layout for multi-question surveys (Delighted is NPS-first). | Loved for simplicity; users hit limits when they want multi-question NPS variants with full Q/A export. | Mid-market NPS focus; SurveyMonkey-owned. |
| **Medallia** | Action-management oriented; "Closed Loop" inbox with response detail; less of a tabular per-survey export pattern. | Workflow-centric; routes responses to action owners. | The "see all responses tabular and export" workflow is buried under action workflows. | Operators describe Medallia as "great for closing the loop, bad for casual analysis." | Enterprise leader. |
| **HubSpot Service Hub** | Per-survey results page with a stat header + an Individual Responses table; export to CSV. | Tied to CRM; per-respondent enrichment from HubSpot contact. | XLSX export not first-class (CSV only); no filter persistence on export; no per-wave concept (no #378 analog). | Users like the CRM integration but report exporting to spreadsheet to do real comparison. | Mid-market bundle player. |
| **Typeform** | Per-form "Results → Responses" tab; row-per-response table; XLSX, CSV, and Sheets export. | Strong XLSX export with question text as headers; row-expand for long answers; clean column layout. | Limited filter sophistication; no first-class wave concept beyond date filters. | Highly rated for the response-review workflow specifically; sets a high bar for ergonomics. | Mid-market form-builder; ~$300M revenue. |
| **AskNicely** | "Feedback" stream with filters (NPS bucket, date, custom properties); CSV/XLSX export. | NPS bucket filter is standard; per-segment views. | NPS-only mental model; multi-question surveys are afterthought. | NPS-only fans love it; users running mixed survey types outgrow it. | Mid-market NPS-focused. |
| **GetFeedback** | Salesforce-native; response review inside Salesforce as a related list. | Tight CRM context. | Salesforce-bound; the operator who wants to read in a browser tab during a coffee break is forced through Salesforce. | Operators describe as "the right tool for sales-led organizations, the wrong tool for product-led ones." | Enterprise / Salesforce-native. |

### Competitive Positioning Strategy

#### Our Differentiation

- **Brand-time-first by default.** Every competitor renders timestamps in either UTC or the viewer's browser TZ — never the brand's own TZ. For a mid-market team operating in a single market, that's a constant friction tax. We get this for free because `Brand.timezone` is already on the schema and used by `DistributionBatchesFilter`.
- **Filter provenance baked into the export.** SurveyMonkey, Typeform, HubSpot all let you export the filtered set, but the resulting `.xlsx` doesn't *say* which filters were applied — receivers have to ask the sender. Our cover block makes the slice self-describing. This matters most when the receiver is an exec who didn't run the export.
- **The wave concept (#378) is first-class in the filter model.** SurveyMonkey's "collector" comes closest but doesn't track per-wave response attribution at the granularity we do. The Survey Owner who runs quarterly NPS to the same audience can answer "Q2 vs. Q1 by member" without leaving the response table — once successor #235 sub-issues add aggregate views on top of this substrate, that becomes a category-leading affordance.
- **Sub-issue of an analytics umbrella, not a one-shot feature.** Competitors ship the response-list and the analytics surface together (and usually skin them differently for different segments). Our staged approach (Phase 1: raw rows; later phases: per-question synthesis, peaks/pits/requests, aggregates) lets the operator anchor every successor capability against the verbatim they're already reading — so synthesis quality is more obvious because the raw substrate is one click away.

#### Competitive Response Strategy

- **If SurveyMonkey adds brand-TZ defaults**: matches our positioning but doesn't unwind our wave-first filter model. Continue investing in successor #235 capabilities (per-question AI, aggregates) which compound on the raw substrate.
- **If Typeform adds filter-provenance in exports**: parity move; continue investing in wave-aware aggregates that Typeform can't ship without a #378 equivalent.

#### Market Positioning

- **Target Segment**: Mid-market Survey Owner (Issue #235 umbrella's persona) operating in a single business timezone, running multi-question NPS/CSAT/CES with quarterly or monthly cadence and per-recipient distribution via mail-merge from their own ESP.
- **Value Proposition**: *"See what your customers said — in your time zone, on your screen, in your spreadsheet — without writing a query and without losing track of which wave you're looking at."*
- **Pricing Strategy**: Response-review baseline is included in the standard plan; advanced analytics (successor #235 sub-issues) are the differentiator that justifies the platform tier.

### Research Sources

- SurveyMonkey help center: https://help.surveymonkey.com/en/analyze/individual-responses-section/ (last reviewed 2026-05-18).
- Qualtrics XM Data & Analysis docs: https://www.qualtrics.com/support/survey-platform/data-and-analysis-module/ (last reviewed 2026-05-18).
- Delighted help: https://help.delighted.com/article/189-export-feedback (last reviewed 2026-05-18).
- HubSpot Feedback Surveys: https://knowledge.hubspot.com/feedback/use-customer-feedback-surveys (last reviewed 2026-05-18).
- Typeform Results docs: https://www.typeform.com/help/a/seeing-responses-360029259592/ (last reviewed 2026-05-18).
- AskNicely overview: https://www.asknicely.com/product (last reviewed 2026-05-18).
- GetFeedback for Salesforce: https://www.getfeedback.com/products/getfeedback-for-salesforce/ (last reviewed 2026-05-18).
- Medallia Action workflows: https://www.medallia.com/platform/ (last reviewed 2026-05-18).
- Research methodology: vendor docs review + an open-web search for "individual responses" + "export to Excel" patterns on each platform. No private accounts opened; references rely on publicly accessible product documentation.

---

## Design Standards Applied

Mocks at [`mocks/423-survey-response-review-v1.html`](mocks/423-survey-response-review-v1.html) reuse the design-token set from `docs/feature-specs/mocks/378-distribute-flow.html` (the most recent admin-surface mock on the survey detail page) to keep visual continuity between adjacent sections — Distribution batches filter, the new Response section, and the Configuration summary section share a single visual idiom. Design source: `docs/architecture/architecture.md` §2 (Tech Stack: Tailwind v4 + shadcn) and §3.1 (Presentation Layer — Standard CRUD admin pattern).

The chip-style filter UI in the mock matches the live `FilterChips.tsx` component at `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx` — same chip shape, same colour token (`var(--primary)` for the active chip border), same `aria-pressed` semantics. Implementation SHALL reuse the existing component, not a new one.

---

## Open Questions

None at this draft. Two minor questions ride into RFC / implementation:

- **OQ-1 (RFC):** ExcelJS vs. SheetJS for the server-side `.xlsx` builder. Both are acceptable; preferred path is whichever has the cheaper bundle weight in the API container — to be confirmed in the RFC's library-decision section.
- **OQ-2 (RFC):** When a brand's `memberIdentifierKind` changes mid-survey (operator changes the brand setting after responses are captured), should the Member column reflect the new kind retroactively (re-resolves on each render) or pin to the kind that was active when the response was captured? Default leaning: retroactive (single source of truth in `Brand.memberIdentifierKind`); RFC to confirm.

---

## Non-goals (Phase 1)

- AI-derived columns (sentiment, topic, summary, peaks/pits/requests) — successor sub-issues of #235.
- Aggregate views (score histogram, topic clouds, sentiment distribution) — successor sub-issues of #235.
- Per-response detail route (`/admin/surveys/[id]/responses/[responseId]`) — successor sub-issue if expand-in-row proves insufficient.
- `extractOpenEndedText` refactor to `Record<questionId, string>` — successor sub-issue with the first AI pipeline phase that needs it.
- Wizard Review-step verbatim/points-awarded/question-preview — the original narrow #235 scope, will be re-filed as its own sub-issue.
- CSV export — operators asked for Excel specifically; CSV export can be a follow-up if a use case surfaces.
- Sortable columns — Phase 1 sorts by Submitted descending; multi-column sort is a follow-up if asked.
- Row-level multi-select + bulk-action (e.g., bulk export selected) — not asked for in Phase 1.
- Inline editing of `Member.firstName / lastName` from the response row — out of scope; edit via members admin.

---

## Phase coverage matrix (this draft)

| Issue AC | Spec R# | Validation tier |
|---|---|---|
| AC1 — table renders, brandId scoped | R1 | Integration (cross-tenant 404) + E2E (table loads) |
| AC2 — columns: Member, Channel, Submitted, Score, per-question | R2, R3 | Unit (Member render) + E2E (table shape) |
| AC3 — long cell truncate + hover/click expand | R4 | E2E (click `more` reveals full text) |
| AC4 — long header truncate + hover/click expand | R5 | Unit (truncation helper) + E2E (hover tooltip) |
| AC5 — brand TZ + locale everywhere | R6, R17 | Integration (TZ end-of-day expansion) + Manual (Excel file inspection) |
| AC6 — wave filter consumed from #378 selector | R7 | E2E (select batch, badge updates) |
| AC7 — submitted date-range filter, date-only, brand TZ | R8 | Integration (boundary day) + E2E (custom range) |
| AC8 — channel multi-select | R9 | Integration (union/intersect) + E2E |
| AC9 — pagination 25/50/100 | R11, R12 | E2E (size selector, page 2) |
| AC10 — export to .xlsx, filename pattern | R13, R14, R18 | E2E (download + filename) + Integration (parse bytes) |
| AC11 — cover block + full question headers | R15, R16, R17 | Integration (parse `.xlsx`, assert cover rows) + Manual (open in Excel) |
| AC12 — cross-tenant 404 for both endpoints | R19, R20 | Integration |
| AC13 — empty state (zero responses or filtered to zero) | R23, R24 | E2E (zero-response survey + zero-filter case) |
| AC14 — anonymous rows render `—` and empty cell | R25 | Unit (Member render) + Integration (export shape) |
