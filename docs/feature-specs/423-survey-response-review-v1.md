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

The survey detail page (`/admin/surveys/[id]`) ships an empty Response section today. The placeholder body at `apps/web/src/app/(admin)/admin/surveys/[id]/components/ResponseSection.tsx:10–13` explicitly punts to "a sibling sub-issue to #235." Today, when a Survey Owner asks the simplest question — *"what did my customers say?"* — the platform's only answers are:

1. **Hand-roll a DB query** — `SurveyResponse.answers` is JSON of `{ questionId: answer }` per the schema (`packages/database/prisma/schema.prisma:812`); the verbatim text is captured by the public widget per question and stored intact, but nothing on the admin UI renders it. Operators have no path here.
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
2. **Filter row** — chip-style, lifted to **shared filter modules** so every future surface (cluster detail, member detail, CX Insights, etc.) consumes the same primitives instead of forking. **Default order:** `Score band · Sentiment band · Submitted · Channel`.
   - **Score band** — chip options derived from `Survey.type` at render time. Constants live in `packages/shared/src/constants.ts` (extends the existing `NPS` constant with sibling `CSAT` and `CES`, each shaped to support multiple scales — see below).
     - NPS (0–10, current) → `Promoter (9–10) · Passive (7–8) · Detractor (0–6)`. *Future 1–5 scale (recorded for the constants design — not in this issue's scope): Promoter (5) · Passive (4) · Detractor (1–3).*
     - CSAT (1–5) → `Satisfied (4–5) · Neutral (3) · Dissatisfied (1–2)` (top-2-box / bottom-2-box).
     - CES (1–7, current) → `Easy (5–7) · Neutral (4) · Hard (1–3)` (modern CES 2.0 — *"the company made it easy"*, high = good). *Future 1–5 scale: Easy (5) · Neutral (4) · Hard (1–3).*
     - Constants in `packages/shared/src/constants.ts` SHALL be designed to accept multiple scale shapes per type (e.g., `NPS.bandsForScale(scale)` returns the active band table keyed on `Survey.scoreScale` or the existing `Survey.type` + a future scale-discriminator), so the per-render band table is data-driven, not hard-coded to a single scale.
     - Group label is *"Score band"*, never *"Type"* — the survey type is fixed.
     - **Visibility rule**: the Score band chip group SHALL be rendered **only when `Survey.type ∈ {NPS, CSAT, CES}`**. For Custom (and any non-standard) survey types the chip group is hidden entirely — bands are not meaningful without a scoring scale.
   - **Sentiment band** — chip options `Positive · Neutral · Negative`, derived from the stored `SurveyResponse.sentiment` float using thresholds in `packages/shared/src/constants.ts` (`SENTIMENT.POSITIVE_THRESHOLD = +0.33`, `SENTIMENT.NEGATIVE_THRESHOLD = -0.33`).
     - **Visibility rule**: the Sentiment band chip group SHALL be hidden when *either* (a) the survey has zero open-ended text questions (sentiment is never populated), *or* (b) `Survey.type ∉ {NPS, CSAT, CES}` (band-style filtering is reserved for the standard CX survey types in Phase 1; custom-type surveys read the AI columns directly without the band filter).
     - A small info icon next to the group label surfaces the multi-text-question caveat (see column section below).
   - **Submitted** — preset chips `Last 7 days · Last 30 days · Last 90 days · All time · Custom`. Custom opens two date inputs (date-only granularity, no time-of-day). Helper text *"All dates in `<Brand.timezone>`"*. Built on the existing `packages/shared/src/datetime.ts` primitives — `formatInBrandTz`, `endOfDayInBrandTz`, `addDaysInBrandTz` — no per-page formatter.
   - **Channel** — multi-select chips over the distinct `channel` values present (`email · in_app · link · sms · review`).
   - **Filter row stays one row.** With Score Band and Sentiment Band hidden for non-CX survey types, custom surveys typically render only `Submitted · Channel` and have plenty of horizontal room. For CX surveys, if the four-group row would wrap at default page width, **Channel** collapses behind a `More filters ↓` popover (least analytically critical of the four).
   - Filters intersect across groups, union within a group. Defaults: all Score Bands selected (when shown), all Sentiment Bands selected (when shown), `All time`, all Channels selected.
3. **Table**, one row per response. Columns (left to right):
   - **Member** — `Member.firstName Member.lastName (<Brand.memberIdentifierKind value>)`. For an `email`-keyed brand, `Jane Doe (jane@example.com)`. For an `external_id`-keyed brand: `Jane Doe (cust_92413)`. Anonymous rows (e.g., Google Reviews import — `memberId IS NULL`) render `—`. If both names are null, the parenthesized identifier stands alone: `(jane@example.com)`.
   - **Channel** — the raw `SurveyResponse.channel` value.
   - **Submitted** — `formatInBrandTz(completedAt, brand.timezone, brand.locale, 'MMM d, yyyy h:mm a zzz')` from the shared datetime module. For historical-import rows the value is `importedAt`. Cell tooltip on hover shows both, prefixed `Live submitted at …` or `Imported, original timestamp …`, again in brand TZ.
   - **Score** — `SurveyResponse.score` rendered raw with a small inline scale annotation (`8 / 10` for NPS, `4 / 5` for CSAT, `5 / 7` for CES). Cell background tinted by score band (Promoter/Satisfied/Easy → green, Passive/Neutral → amber, Detractor/Dissatisfied/Hard → red) so the operator's eye finds the band at a glance.
   - **AI · Sentiment** — column header carries the explicit `AI ·` prefix so the operator never confuses derived data for entered data. Cell renders a small colored chip from the stored `SurveyResponse.sentiment` float bucketed via the `SENTIMENT` constant: `Positive` (green), `Neutral` (slate), `Negative` (red). Raw float visible on hover (`+0.62`, two decimals). Empty when the response has no open-ended text. The AI-group header (Sentiment + Topics + Summary) renders with a subtle tinted background to read as a logical group at a glance.
   - **AI · Topics** — `AI ·` prefix on the column header. Cell renders up to 3 chips from `SurveyResponse.topics` (alphabetised). `+N` overflow chip when there are more; hover reveals the full list. Empty when `topics` is an empty array.
   - **AI · Summary** — `AI ·` prefix on the column header. Cell renders `SurveyResponse.summary` (one short prose line). Truncate + click-to-expand-in-row like other free-text cells. Empty when null.
   - **One column per question in `Survey.questions` order** — header is the question text (no prefix — these are the customer's actual questions, not AI output). Cell is the verbatim value from `SurveyResponse.answers[questionId]`.
     - Long question headers truncate at ~28 characters; full text revealed on hover. `aria-describedby` carries the full text for screen-reader access.
     - Long cell values truncate at ~120 characters with an inline `… more` affordance; clicking expands the row in place (single-row expansion). Hover on the truncated text shows a tooltip.
     - Numeric answers render raw. Choice answers render the option label.
   - **AI-column caveat indicator.** A small info-icon sits at the right edge of the AI column-group header, surfacing on hover: *"AI-derived columns (Sentiment, Topics, AI Summary) are computed across all open-ended answers on each response. For standard NPS / CSAT / CES surveys with one open-ended question, the values are correct. For multi-text-question surveys, interpret with caution — later phases of this product surface will continue refining these AI-derived values to improve accuracy."* The caveat is also written into the export cover block (R15). No internal issue numbers or sub-issue references appear in operator-facing copy.
4. **Pagination footer**: page-size selector `25 · 50 · 100` (default 25, choice persists for the session, reload resets to 25), prev / next, `Page X of Y · N responses` text. Counters reflect the filtered total.

### §3. Walking the operator through a typical session

The mock walks the scenes. The narrative version:

1. **Land on the survey detail page.** The Survey Owner clicks a survey in `/admin/surveys`, lands on `/admin/surveys/[id]`. The Response section is auto-expanded (responses exist). They see the table loaded with the most recent 25 rows — Member, Channel, Submitted, Score (tinted by band), **AI · Sentiment, AI · Topics, AI · Summary** (the AI-derived column group is visibly distinct — tinted header background + explicit `AI ·` prefix), then per-question columns. Filter row order is **Score band · Sentiment band · Submitted · Channel**. Default sort by `Submitted` descending.
2. **Filter to detractors.** They click `Detractor` in the **Score band** chip group (leftmost). Count badge updates from `412 responses` to `89 responses`. Score-cell tints in the table are all red now.
3. **Narrow further to Negative sentiment.** They click `Negative` in the **Sentiment band** group. Count drops to `54`. The `AI · Sentiment` chips visible in the column are all red.
4. **Filter to a wave.** They click the wave dropdown above the section (the existing distribution-batches selector). Choose `Q2 2026 NPS · Gold-tier · Apr 15`. Count drops to `31` — the detractors with negative sentiment inside the Gold-tier wave.
5. **Filter to a date range.** They click `Custom` in the Submitted preset row, pick `Apr 15 → Apr 22`. The submitted-to date is interpreted as `end-of-day Apr 22 in Brand.timezone`. Count: `18 responses`.
6. **Expand a long verbatim.** A detractor row's open-ended answer is truncated. The operator clicks `more`. The row expands in place, the full text renders alongside the AI summary one-liner ("Customer frustrated with support response time despite polite agents"). They click `less`; the row collapses.
7. **Read the AI-column caveat.** Hovering the info-icon next to the AI column-group header surfaces the generic multi-text-question caveat (no internal issue references). This survey has one open-ended question, so the operator trusts the AI columns directly.
8. **Custom-type survey detour.** They open a custom-type survey (`Survey.type = 'CUSTOM'`). The Score band and Sentiment band chip groups are hidden — only Submitted and Channel render. The Score column also hides because there's no defined score for a custom survey. The AI columns remain (sentiment and topics still derive from open-ended text).
9. **Export to Excel.** They click `Export to Excel`. File `survey-q2-2026-customer-pulse-responses-2026-05-19.xlsx` downloads. The cover block (rows 1–11) lists Survey name, Survey type, Survey ID, Exported at, Exported by, Wave, Submitted range, Score band (`Detractor`), Sentiment band (`Negative`), Channels, Total rows (`18`). Row 13 is the AI-derived disclaimer. Row 14 reads *"Powered by CustomerEQ"* with the brand word hyperlinked to `https://customereq.wellnessatwork.me`. Data sheet starts row 16 with column headers including `AI · Sentiment` / `AI · Topics` / `AI · Summary` and the full question text for each survey question.

### §4. Empty states and edge cases

- **Zero responses on the survey.** Section collapses by default (#241 R32). When the operator expands it, the body shows a single non-table empty state: *"No responses yet — distribute the survey or run a historical import to populate this view."* The Export button is disabled with tooltip *"Nothing to export — this survey has no responses."*
- **Filters yield zero responses (survey itself has responses).** Table area shows *"No responses match the current filters."* with a single subtle `Clear filters` link. The Export button is disabled with tooltip *"Nothing to export — current filters yield 0 responses."*
- **Anonymous responses (Google Reviews import etc., `memberId IS NULL`).** Member column renders `—`. The export cell is empty. The row is otherwise treated identically — same channel/score/answer rendering.
- **A historical-import response with `completedAt` null.** Submitted column uses `importedAt`; tooltip says *"Imported response, original timestamp …"*. The date-range filter checks the row in against `COALESCE(completedAt, importedAt)` (server-side) so the operator filtering by "Apr 15 → Apr 22" sees historical rows whose original timestamp falls inside the window.
- **A question was added to the survey after some responses were captured.** The new question's column shows `—` for the older responses that don't have that key in `answers`. The header is unchanged.
- **A question was removed from the survey after some responses were captured.** Phase 1 reads `Survey.questions` for column structure; if `answers` has keys not in `Survey.questions` they are not rendered. (The full data is still in the database — out of scope for this phase to surface deleted-question values.)
- **Brand without `timezone` / `locale` configured.** `Brand.timezone` defaults to `"UTC"` and `Brand.locale` defaults to `"en-US"` in the schema (`packages/database/prisma/schema.prisma:213–214`). The operator gets `UTC` + `en-US` formatting until they configure on `/admin/settings/organization`. No code path needs to defend against null values.
- **Multi-text-question survey + AI-derived columns.** Stored `sentiment / topics / summary` values today are computed on the *concatenated* answer blob via `extractOpenEndedText()` (`apps/api/src/utils/survey.ts:5–13`). For surveys with one open-ended question (standard NPS / CSAT / CES) the concatenation is a no-op and the values are correct. For surveys with multiple open-ended questions, the values reflect the joined text. Phase 1 surfaces the data with the explicit `AI ·` column-header prefix + inline info-icon caveat (§2.3) + the AI-fields disclaimer row in the export's cover block; the per-question synthesis refactor (rewrite `extractOpenEndedText`, change BAML signature to accept Q/A pairs, backfill historical rows) is a successor product-development phase. Operator-facing copy does not name internal issue numbers.
- **Filter row overflow.** If the filter bar's four chip groups (`Score band · Sentiment band · Submitted · Channel`) wrap past one row at the default 1280px page width, **Channel** collapses behind a `More filters ↓` popover. The popover renders the same chip group inside; semantics identical. Channel chip selection state is preserved across collapse/expand.
- **Export filter set exceeds the 50,000-row cap.** `GET /v1/surveys/:id/responses.xlsx` returns HTTP 413 `{ code: 'EXPORT_TOO_LARGE', total, capacity: 50000 }`. The UI listens for the count badge total to cross 50k and pre-emptively disables the Export button with a tooltip *"Filtered set is N responses — narrow the filters (try a date range or a single wave) and try again."* The 50k cap is a Phase-1 reasoned choice (see R18a's rationale) and lives in `packages/shared/src/constants.ts` as a single constant so a future audit-driven adjustment changes one line. Excel's per-sheet hard limit is 1,048,576, so 50k is well within what receivers can open.

---

## Functional requirements

All requirements use SHALL-style language. Traceability tags map to acceptance criteria on issue #423.

### Display

- **R1.** The Response section SHALL render a paginated table with one row per `SurveyResponse` for the survey, scoped to `request.brandId`.
- **R2.** Each row SHALL show: Member, Channel, Submitted, Score (when survey type has a score; see R9a), **AI · Sentiment** (chip from `SurveyResponse.sentiment`), **AI · Topics** (chip list from `SurveyResponse.topics`), **AI · Summary** (one-line text from `SurveyResponse.summary`), and **one column per question** in `Survey.questions` order. Column headers for AI-derived columns SHALL carry the explicit `AI ·` prefix so the operator never confuses derived data for entered data; per-question column headers SHALL NOT carry the prefix (those are customer questions, not AI output).
- **R3.** The Member column SHALL render as `Member.firstName Member.lastName (<identifier value>)` where identifier value is selected by `Brand.memberIdentifierKind` (EMAIL → `Member.email`, PHONE → `Member.phone`, EXTERNAL_ID → `Member.externalId`, MEMBER_ID → `Member.id`). If both firstName and lastName are null, the parenthesized identifier stands alone. If `memberId IS NULL`, the cell renders `—`.
- **R4.** Free-text cell values longer than 120 characters SHALL truncate inline with a `… more` affordance; clicking the affordance SHALL expand the row to reveal the full text without disrupting other rows. Hovering the truncated text SHALL show a tooltip containing the full text.
- **R5.** Question-column headers SHALL carry the full question text. When the header text exceeds the column visual budget (~28 characters in the default layout) it SHALL truncate inline with the full text revealed on hover. The truncated header SHALL be associated with the full text via `aria-describedby` for keyboard / screen-reader access.
- **R6.** All displayed dates and times (Submitted column, header tooltips, filter inputs, filter chip labels, pagination footer, export filename, export cover block) SHALL be formatted via the shared `packages/shared/src/datetime.ts` primitives (`formatInBrandTz`, `endOfDayInBrandTz`, `addDaysInBrandTz`, `resolveLocale`) using `Brand.timezone` and `Brand.locale`. No per-page date formatter SHALL be introduced. No UTC display SHALL appear on this surface.
- **R6a.** The AI-derived columns (`AI · Sentiment`, `AI · Topics`, `AI · Summary`) SHALL render the stored `SurveyResponse.sentiment / topics / summary` values directly — no re-analysis on display. The column headers SHALL carry the `AI ·` prefix. The AI-column-group header SHALL render with a subtle tinted background and an inline info-icon that surfaces the multi-text-question caveat described in §2.3. The caveat copy SHALL NOT name internal issue numbers; operator-facing language is *"later phases of this product surface will continue refining these AI-derived values to improve accuracy."*

### Filtering

- **R7.** The Response section SHALL consume the wave selection from `DistributionBatchesFilter.tsx` (already in the DOM above the section). Selection lifts to the detail page; the Response section receives it as a prop and refetches when it changes. The Response section SHALL NOT render its own wave chip.
- **R8.** Submitted date range filter SHALL accept presets `Last 7 days · Last 30 days · Last 90 days · All time · Custom`. Custom mode SHALL accept two date inputs (date-only granularity, no time-of-day). The `submittedTo` date SHALL be interpreted server-side as inclusive through end-of-day in `Brand.timezone` via `endOfDayInBrandTz`. The filter SHALL apply to `COALESCE(completedAt, importedAt)`.
- **R9.** Channel multi-select chips SHALL filter the table server-side, with options from the distinct `channel` values present on the survey's response set. Semantics SHALL match the chip-group library (intersect across groups, union within group).
- **R9a.** A **Score Band** chip group SHALL filter the table server-side **when `Survey.type ∈ {NPS, CSAT, CES}`**, and SHALL be hidden entirely for any other survey type (Custom etc.). Chip options SHALL be derived from `Survey.type` at render time: NPS (0–10) → `Promoter (9–10) / Passive (7–8) / Detractor (0–6)`; CSAT (1–5) → `Satisfied (4–5) / Neutral (3) / Dissatisfied (1–2)`; CES (1–7) → `Easy (5–7) / Neutral (4) / Hard (1–3)` (modern CES 2.0). Band-to-score boundaries SHALL come from `packages/shared/src/constants.ts` (`NPS`, `CSAT`, `CES` constants added in this issue's impl phase, paralleling the existing `NPS` constant). The constants SHALL be designed to **accept multiple scale shapes per type** (e.g., `NPS.bandsForScale('0_10')` vs. `NPS.bandsForScale('1_5')` — Promoter (5) / Passive (4) / Detractor (1–3) reserved for the 1–5 NPS scale; CES `1_5` → Easy (5) / Neutral (4) / Hard (1–3) reserved for the 1–5 CES scale), so when a future product change introduces a new scale on an existing type, only the constants and the score-band derivation need updating — the filter UI is data-driven.
- **R9b.** A **Sentiment Band** chip group SHALL filter the table server-side. Chips: `Positive (sentiment ≥ SENTIMENT.POSITIVE_THRESHOLD)`, `Neutral (between thresholds)`, `Negative (sentiment ≤ SENTIMENT.NEGATIVE_THRESHOLD)`. Boundaries SHALL come from `packages/shared/src/constants.ts.SENTIMENT` (`POSITIVE_THRESHOLD = +0.33`, `NEGATIVE_THRESHOLD = -0.33`). The chip group SHALL be hidden when **either** (a) the survey has zero open-ended text questions, **or** (b) `Survey.type ∉ {NPS, CSAT, CES}` — band-style filtering is reserved for the standard CX survey types in Phase 1.
- **R9c.** The filter primitives — `FilterChipGroup`, `SubmittedDateRange`, `FilterBar` composer, and the Zod `responseFilters` schema — SHALL live in shared modules consumable by future analytics surfaces (cluster detail, member detail, CX Insights, etc.). No per-page chip code SHALL be forked. The existing `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx` migrates into the shared module in this impl phase; no copy stays behind.
- **R9d.** The filter bar SHALL render its chip groups on a single row at default detail-page widths in the default order **`Score band · Sentiment band · Submitted · Channel`**. If the wrap-aware row would exceed one row, **Channel** SHALL collapse behind a `More filters ↓` popover. Channel chip selection state SHALL be preserved across collapse/expand.
- **R10.** Wave + Score Band + Sentiment Band + Submitted + Channel filters SHALL compose by intersection — a response appears iff it matches every active group.

### Pagination

- **R11.** The pagination control (UI consumer) SHALL provide a page-size selector with values `25 (default) · 50 · 100`. The choice SHALL persist for the operator's session on the page and reset to 25 on full page reload.
- **R11a.** Direct API consumers (brand backends hitting `GET /v1/surveys/:id/responses` programmatically) MAY request `pageSize` up to a hard cap of `500`. The Zod schema SHALL enforce `pageSize ∈ [1, 500]` server-side; the UI chip selector is the only mechanism that emits 25/50/100. Direct consumers needing the full set SHALL use the export endpoint (`GET /v1/surveys/:id/responses.xlsx`), not paginate to exhaustion.
- **R12.** `total` and `totalPages` in the pagination footer SHALL come from the server response and reflect the **filtered** total (not the survey's full response count). The count badge in the section header SHALL match `total`.

### Export

- **R13.** The Response section header SHALL include an `Export to Excel` button. Clicking it SHALL download an `.xlsx` matching the current filter set (not just the current page).
- **R14.** The export filename SHALL follow the pattern `survey-<safeSlug>-responses-<YYYY-MM-DD>.xlsx`, where `safeSlug` is the survey name slugified for filesystem-safe characters and the date is rendered in `Brand.timezone` using `Brand.locale`.
- **R15.** The exported workbook SHALL begin with a cover block (rows 1–11) containing, one labeled key-value pair per row in order:
  1. **Survey** — the survey name (verbatim from `Survey.name`).
  2. **Survey type** — `NPS` / `CSAT` / `CES` / `Custom` / etc., from `Survey.type`.
  3. **Survey ID** — `Survey.id` (cuid; the only ISO-8601 / opaque-id field in the block).
  4. **Exported at** — timestamp in `Brand.timezone` + `Brand.locale`.
  5. **Exported by** — operator email.
  6. **Wave** — active wave selection label (`All waves and direct responses`, the batch label, or `Direct responses`).
  7. **Submitted range** — date range as displayed, brand TZ.
  8. **Score band** — comma-separated active bands or `All bands`; `N/A` when `Survey.type ∉ {NPS, CSAT, CES}`.
  9. **Sentiment band** — comma-separated active bands or `All sentiments`; `N/A` when the chip group was hidden (see R9b).
  10. **Channels** — comma-separated active channels, or `All channels` when none deselected.
  11. **Total rows** — the filtered total.

  Row 12 is intentionally blank. Row 13 is a single italicised disclaimer cell: *"AI-derived columns (AI · Sentiment, AI · Topics, AI · Summary) are computed across all open-ended answers per response. For standard NPS / CSAT / CES surveys with one open-ended question, the values are correct. For multi-text-question surveys, interpret with caution — later phases of this product surface will continue refining these AI-derived values to improve accuracy."* Row 14 is a single cell: *"Powered by CustomerEQ"* with the word `CustomerEQ` rendered as a hyperlink to `https://customereq.wellnessatwork.me` (the canonical production host — read from a single shared constant, not duplicated in the cover-block builder; if the deployed host changes the constant changes once and the export inherits). Row 15 is blank; data starts at row 16.
- **R16.** Exported column headers SHALL contain the **full** question text (no truncation) for the per-question columns. The exported sheet SHALL include the three AI-derived columns labeled exactly **`AI · Sentiment`**, **`AI · Topics`**, **`AI · Summary`** so the operator reading the file in Excel sees the AI origin in every column heading (not just the cover block). Free-text answers SHALL be preserved verbatim (no truncation, no AI re-synthesis applied at export time).
- **R17.** All dates and times in the exported workbook (cover block and data area) SHALL be rendered via `formatInBrandTz` in `Brand.timezone` using `Brand.locale`. ISO-8601 strings SHALL NOT appear except in the Survey ID row of the cover block.
- **R18.** The Export button SHALL be disabled when the filtered total is zero, with a tooltip explaining why.
- **R18a.** The Export endpoint SHALL refuse to render an `.xlsx` for a filter set whose `total > 50000` and return HTTP 413 with body `{ code: 'EXPORT_TOO_LARGE', total, capacity: 50000, message: '<filter help>' }`. The UI SHALL pre-emptively disable the Export button when the filtered total exceeds 50,000 (the count badge already knows it), avoiding the wasted round-trip. **Rationale for 50,000:** balances operator access to large slices against producing files Excel can open quickly and reviewers can scroll — well within Excel's 1,048,576 sheet limit but conservative enough that ExcelJS / SheetJS render times stay under a few seconds on a typical API container. The cap is a single constant in `packages/shared/src/constants.ts` so a future evidence-driven adjustment (e.g., if the audit row shows users hitting it frequently) changes one line.

### API

- **R19.** A new route `GET /v1/surveys/:id/responses` SHALL be added. Query params: `page` (int ≥ 1, default 1), `pageSize` (int ∈ `[1, 500]`, default 25 — see R11/R11a for the split between UI and direct-API consumers), `wave` (`all | direct | <batchId>`, default `all`), `submittedFrom` (date `YYYY-MM-DD`, optional), `submittedTo` (date `YYYY-MM-DD`, optional, expanded server-side to end-of-day in `Brand.timezone`), `scoreBands[]` (optional; values per `Survey.type`: NPS `promoter | passive | detractor`; CSAT `satisfied | neutral | dissatisfied`; CES `easy | neutral | hard`), `sentimentBands[]` (optional; values `positive | neutral | negative`), `channels[]` (optional; when omitted, all channels). All filter params SHALL be validated via the shared `packages/shared/src/zod/responseFilters.schema.ts` so the same shape reuses for every future analytics endpoint that filters responses. Response: `{ data: ResponseRow[], total, page, pageSize, totalPages }`. Each `ResponseRow` includes `id`, `answers`, `member: { firstName, lastName, identifierValue } | null`, `distributionBatchId`, `distributionBatch.label`, `importBatchId`, `importBatch.name`, `channel`, `completedAt`, `importedAt`, `score`, `sentiment`, `confidence`, `topics`, `summary`. Tenant scoping: `WHERE brandId = request.brandId` enforced via the existing Prisma middleware; cross-tenant requests return 404 (Issue #332 pattern).
- **R20.** A new route `GET /v1/surveys/:id/responses.xlsx` SHALL accept the same filter query params (no `page` / `pageSize` — all matching rows up to the 50,000-row cap are exported, see R18a). The response Content-Type SHALL be `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. The Content-Disposition header SHALL be `attachment; filename="<R14 pattern>"`. The cover block (R15) and data sheet (R16) SHALL be assembled server-side; the client SHALL NOT transform the response.
- **R21.** This issue's impl phase SHALL remove the vestigial inline `responses: { take: 20, … }` block from `apps/api/src/routes/surveys.ts:129–144` on the existing `GET /v1/surveys/:id` endpoint. Audit (this issue) confirms no consumer in `apps/web/src` reads `survey.responses` from that payload — only `survey._count.responses` is used (for the count badge). The Response section migrates entirely to the new `GET /v1/surveys/:id/responses` endpoint. Integration test added to assert the field is absent post-change.
- **R22.** All new endpoints SHALL log a structured audit entry via the existing audit plugin (`auditAction: 'survey.responses.list'` and `'survey.responses.export'`, `auditResourceType: 'survey'`, allowlist: `wave`, `submittedFrom`, `submittedTo`, `scoreBands`, `sentimentBands`, `channels`, `total`, `requestIp`). The export audit entry SHALL capture the operator's email for SOC2-aligned traceability, AND the AI-fields vintage (a count of how many returned rows had non-null `sentiment` / `topics` / `summary`) so a downstream possessor can correlate the file with model state.

### Empty / error states

- **R23.** When the survey has zero responses, the section SHALL render the empty-state body specified in §4 (non-table). The Export button SHALL be disabled.
- **R24.** When the filtered set is zero (survey has responses), the table area SHALL render the filtered-empty body specified in §4. The Export button SHALL be disabled.
- **R25.** Anonymous responses (`memberId IS NULL`) SHALL render `—` in the Member column on screen and an empty cell in the export.
- **R26.** A response missing the `completedAt` value SHALL fall back to `importedAt` for both display and filtering.

---

## Compliance Requirements

This surface displays and exports member PII (name + identifier per `Brand.memberIdentifierKind` — typically email) and verbatim survey answers (which may contain PII the customer typed). The applicable controls follow from `fraim/config.json.customizations.compliance.regulations`: GDPR (in-scope), CCPA (in-scope), SOC2 (target month 12), PCI-DSS (minimal scope).

### GDPR

- **GDPR Art. 4(4) — profiling.** Sentiment / topics / summary are AI-derived fields computed from the data subject's free-text input. Phase 1 *displays* and *exports* these stored values; it does not run a new inference at read time. Surfacing pre-computed derived data to the data controller is a read, not new processing. No new lawful-basis disclosure to the data subject is required.
- **GDPR Art. 5(1)(a) — lawfulness, fairness, transparency.** Lawful basis was established at collection (consent captured via `Member.consentGivenAt` and `Survey.consentMode`). The mock and the export cover block carry an explicit "AI-derived columns are computed across all open-ended answers" disclaimer so the operator (acting as data controller) interprets the data with accurate context — the fairness limb of Art. 5(1)(a).
- **GDPR Art. 5(1)(c) — data minimization.** The export includes only fields the operator's analysis task needs. The AI-derived columns are included because they materially aid the analysis task (the entire purpose of #235 is making this signal usable); the row-level data they contain is *derivative of* PII the operator already has access to, not new PII. The export cover block includes operator email + export timestamp so a downstream possessor knows the chain of custody.
- **GDPR Art. 5(1)(d) — accuracy.** Today's `sentiment / topics / summary` are computed on the concatenated answer blob — correct for single-text-question surveys (the common shape: NPS / CSAT / CES with one "why" question), reflecting joined text for multi-text-question surveys (the known #235 gap). The accuracy limb is satisfied via the user-facing caveat indicator (R2/§2.3) and the export cover-block disclaimer (R15). The durable fix is the successor-phase per-question synthesis refactor of `extractOpenEndedText()`.
- **GDPR Art. 5(1)(f) — integrity and confidentiality.** API access is tenant-scoped via `request.brandId` from the JWT (project rule R6). Cross-tenant requests return 404 (Issue #332 pattern). The export endpoint inherits the same auth.
- **GDPR Art. 15 — right of access.** Out of scope: this is the brand-operator-facing read surface, not the data-subject's right-of-access route.
- **GDPR Art. 17 — right to erasure.** Soft-deleted responses (`SurveyResponse.deletedAt IS NOT NULL`) SHALL be excluded from list and export results, inheriting the existing pattern at `apps/api/src/routes/surveys.ts:103` (list endpoint) and `apps/api/src/routes/surveys.ts:125` (detail endpoint) — Issue #332 comments at lines 102 and 124 mark the rationale. The erasure worker `apps/worker/src/processors/...` SHALL additionally zero the AI-derived columns (`sentiment = NULL`, `confidence = NULL`, `topics = []`, `summary = NULL`, `clusterId = NULL`) on every `SurveyResponse` belonging to an erased member — because these derived columns retain analytical fingerprints of the original PII text. **Captured as a Phase-1-blocking acceptance criterion on the erasure worker change**; if the worker doesn't already zero these fields, this issue's impl phase amends it (or files a tight cross-issue dependency PR ahead of merge).
- **GDPR Art. 22 — automated decision-making.** Phase 1's display does NOT make decisions that produce legal or similarly significant effects on the data subject. The AI-derived columns are informational — the operator reads them. No user-facing action gates on them. *Forward-pointer:* if a successor sub-issue of #235 ties an automated effect to sentiment (e.g., auto-fire a winback campaign when `sentiment ≤ NEGATIVE_THRESHOLD`), that surface invokes Art. 22 and adds human-in-the-loop safeguards. The boundary is recorded here so it doesn't drift unnoticed.
- **GDPR Art. 30 — record of processing activities.** The export audit entry (R22) records who exported what, when, from which IP, with which filter set, *and* the AI-field vintage — contributing to the existing audit-log trail.

### CCPA

- **CCPA §1798.100 — right to know.** Same as GDPR Art. 15 — out of scope for this read surface.
- **CCPA §1798.105 — right to delete.** Same as GDPR Art. 17 — soft-delete filter inherited.

### SOC2 (target month 12)

- **CC6.1 / CC6.6 — logical access controls.** Tenant scoping per R6; auth via Clerk JWT.
- **CC7.2 — system monitoring.** Audit entries per R22 capture all list and export operations.
- **PI1.1 / PI1.4 — input and processing integrity.** The export rendering pipeline is server-side; client cannot alter the cover block or smuggle in extra columns. The `.xlsx` produced is a faithful representation of the filter set at export time. The AI-derived columns are a *cache* of the AI run at response-capture time; the audit row records the AI-field vintage so a downstream possessor can correlate the export with the model state. If the AI prompt or model changes materially, the impact on Phase 1 is limited to *new* responses; *prior* exports remain accurate snapshots of their own moment.

### PCI-DSS (minimal scope)

- The survey response surface does not handle payment card data. No PCI controls apply.

### Compliance Validation

- **GDPR Art. 5(1)(c) test** — Manual workbook inspection: open the exported `.xlsx`, confirm columns are limited to Member, Channel, Submitted, Score, the three AI-derived columns (Sentiment, Topics, AI summary), one column per question, and that the cover block lists every active filter group including the AI-fields disclaimer. No internal IDs leak except in the survey-id cover row.
- **GDPR Art. 5(1)(d) test** — UI test: hover the info-icon at the AI column-group header; confirm the multi-text-question caveat copy is visible and links to #235.
- **GDPR Art. 5(1)(f) test** — Integration test: a Brand A token requesting `GET /v1/surveys/<Brand-B-survey-id>/responses` SHALL return HTTP 404. A Brand A token requesting `GET /v1/surveys/<Brand-B-survey-id>/responses.xlsx` SHALL return HTTP 404.
- **GDPR Art. 17 test** — Integration test: a soft-deleted `SurveyResponse` SHALL be absent from both the list endpoint and the export endpoint. Erasure-worker test: a member whose record was erased SHALL have `sentiment / confidence / topics / summary / clusterId` zeroed on every response, AND those responses still surface on the list endpoint with `member: null` and empty AI-column cells.
- **GDPR Art. 22 test** — Code review: no code path on this surface uses `sentiment / topics / summary` to gate a user-facing action; the columns are display-only.
- **Audit test** — Integration test: invoking the export endpoint SHALL write an audit row with `action='survey.responses.export'`, `metadata.total ≥ 0`, `metadata.requestIp` populated, `metadata.aiVintageNonNullCount ≥ 0`.

---

## Validation Plan

### Unit tests (Vitest, `pnpm test:smoke`)

- Member-column rendering: `(firstName, lastName, identifierValue, identifierKind)` × cases (both names present / both null / null member) → expected display string.
- Date formatting via `packages/shared/src/datetime.ts.formatInBrandTz` — reused from #378; no new helper.
- **Score-band derivation:** for each `Survey.type ∈ {NPS, CSAT, CES}`, `bandOf(score, scale)` SHALL return the expected band per the constants in `packages/shared/src/constants.ts`. Boundary cases for the current scales: NPS-0-10 `6 → Detractor, 7 → Passive, 8 → Passive, 9 → Promoter`; CSAT-1-5 `2 → Dissatisfied, 3 → Neutral, 4 → Satisfied`; CES-1-7 `3 → Hard, 4 → Neutral, 5 → Easy`. Constant shape tests assert the future NPS-1-5 and CES-1-5 tables are addressable via `NPS.bandsForScale('1_5')` / `CES.bandsForScale('1_5')` even if those scales are not yet wired into `Survey.scoreScale`.
- **Survey-type-gated visibility:** `shouldShowScoreBand(surveyType)` returns `true` only for `NPS | CSAT | CES`; `shouldShowSentimentBand(surveyType, hasTextQuestion)` returns `true` only when both hold.
- **Sentiment-band derivation:** `sentimentBandOf(float)` SHALL return `Positive | Neutral | Negative` using `SENTIMENT.POSITIVE_THRESHOLD = +0.33` and `SENTIMENT.NEGATIVE_THRESHOLD = -0.33`. Boundary cases: `+0.33 → Positive` (inclusive), `+0.32 → Neutral`, `-0.33 → Negative` (inclusive), `-0.32 → Neutral`, `null → null` (sentiment absent — chip hidden).
- Filter composition: given a wave selection, a date range, score-band set, sentiment-band set, channel set → resolved Prisma `where` clause shape (snapshot test).
- Filter row overflow: given a renderable width and four chip groups → expected layout (one row with Channel inline) vs. (one row with `More filters ↓` popover hosting Channel).
- Excel cover-block builder: given `(survey, exporter, filterState, totalRows)` → expected cell map for rows 1–12 including the AI-fields disclaimer row.

### Integration tests (Vitest + supertest against test DB, `pnpm test:integration`)

- `GET /v1/surveys/:id/responses` happy path: response includes verbatim from `answers`, member-identity fields, batch label, channel, score, submitted, **and the AI-derived fields `sentiment / confidence / topics / summary`**.
- Tenant isolation: cross-tenant 404 for both endpoints.
- **Wave + Score-band + Sentiment-band + Submitted + Channel composition**: any subset combination returns rows where every active filter holds. E.g., `scoreBands=detractor & sentimentBands=negative & wave=<batch>` returns only rows whose `score ≤ 6` AND `sentiment ≤ -0.33` AND `distributionBatchId = <batch>`.
- **Score-band correctness per type**: NPS rows scored `9-10` appear under `scoreBands=promoter`, `7-8` under `passive`, `0-6` under `detractor`. CSAT and CES analogues per their boundaries.
- **Sentiment-band correctness**: a response with `sentiment = +0.33` SHALL appear under `sentimentBands=positive`; `sentiment = +0.32` SHALL appear under `neutral`; `sentiment = -0.33` SHALL appear under `negative`; null sentiment SHALL appear under no sentiment-band filter (silently dropped).
- Date filter (brand-TZ end-of-day expansion): a response at `completedAt = 2026-05-19T06:00:00Z` is `2026-05-18 23:00 PST` and SHALL be included for `submittedTo=2026-05-18` under `Brand.timezone='America/Los_Angeles'`.
- Channel filter: multi-select returns the union; empty selection (all chips off) returns 0 rows.
- Pagination cap (UI tier): `pageSize=200` from the UI is rejected with 422; pagination is bounded to `[25, 50, 100]` at the UI binding layer.
- Pagination cap (direct-API tier): `pageSize=500` accepted; `pageSize=501` returns 422.
- Export cap: filter set with `total > 50000` SHALL return HTTP 413 with `{ code: 'EXPORT_TOO_LARGE', total, capacity: 50000 }`.
- Anonymous member rendering: a response with `memberId IS NULL` appears in the list with `member: null`; export sheet has an empty Member cell.
- Soft-delete: a response with `deletedAt IS NOT NULL` does not appear in either endpoint.
- **Erasure side-effect**: after the erasure worker runs against a memberId, every `SurveyResponse` with that `memberId` SHALL have `sentiment = NULL, topics = [], summary = NULL, clusterId = NULL`. The list endpoint still surfaces those rows with empty AI cells; the export does the same.
- **Custom-type survey filter visibility**: a survey with `Survey.type = 'CUSTOM'` (or any type not in `{NPS, CSAT, CES}`) returns a response payload where the chip-group config indicates `scoreBand: { hidden: true }` and `sentimentBand: { hidden: true }`; UI test confirms the chip groups are absent from the DOM; export cover block lists `Score band: N/A` and `Sentiment band: N/A`.
- Audit: the export endpoint writes an audit row with the expected action and metadata, including `metadata.aiVintageNonNullCount`.
- XLSX shape: parse the `.xlsx` body in the test, assert (a) cover-block rows 1–11 contain the named labels including Survey, Survey type, Survey ID, Powered-by, etc.; (b) row 13 contains the AI-fields disclaimer; (c) row 14 contains the `Powered by CustomerEQ` cell with the brand word hyperlinked to `https://customereq.wellnessatwork.me`; (d) the data header row at row 16 contains `AI · Sentiment`, `AI · Topics`, `AI · Summary` literal headers in addition to per-question headers; (e) the `Powered by` host URL is sourced from a single shared constant, not duplicated inside the cover-block builder.
- **Removal of vestigial inline rows**: `GET /v1/surveys/:id` response SHALL NOT contain a `responses` array (only `_count.responses`).

### E2E tests (Playwright, `pnpm test:e2e`)

- **Happy path** — log in as a brand admin, navigate to `/admin/surveys/<id>`, expand Response, see the table loaded with 25 rows including Sentiment / Topics / AI summary columns; change page size to 50; navigate to page 2; verify 50 rows are visible.
- **Wave filter wiring** — select a batch from the #378 selector, verify the Response table's count badge updates and the rows reflect the selection.
- **Score band filter** — click `Detractor`, verify only NPS rows with `score ≤ 6` remain; score-cell tints are all red.
- **Sentiment band filter** — click `Negative`, verify only rows with Sentiment chip = red remain.
- **Date filter** — choose `Custom`, pick a 7-day range, verify the count badge updates and out-of-range rows are gone.
- **Cell expansion** — locate a truncated free-text cell, click `more`, verify full text becomes visible.
- **Header tooltip** — hover a truncated header, verify the full question text appears in a tooltip.
- **AI caveat indicator** — hover the info-icon next to the AI-column group header, verify the multi-text-question caveat copy is visible.
- **Filter row overflow** — resize the viewport narrow enough to force overflow; verify Channel collapses behind a `More filters ↓` popover; click into the popover, verify channel chips work the same; restore width, verify Channel chips return inline.
- **Export** — click `Export to Excel`, intercept the download, parse the bytes server-side via Vitest helper, verify cover block + data sheet headers including AI columns + the AI-fields disclaimer row.
- **Export-cap UI** — apply filters that yield `total > 50000`; verify the Export button is disabled with the count-aware tooltip.
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
| **Withhold AI-derived columns (sentiment / topic / summary) until per-question synthesis is fixed.** | *Inverted in round-1 review.* The stored sentiment/topics/summary are correct for the common single-text-question survey shape (NPS / CSAT / CES with one "why" question — the concatenation in `extractOpenEndedText` is a no-op on a single string). Withholding them until per-question synthesis lands hides operator value from the majority of surveys. Phase 1 surfaces the stored values with an inline multi-text-question caveat indicator (R6a / §2.3) and a cover-block disclaimer in the export. Successor sub-issues of #235 refactor `extractOpenEndedText` to per-question and the column shape doesn't change — only the underlying value gets more accurate for multi-text-question surveys. De-risks the later rollout (UI never shifts under operators between phases) and gives operators day-one analytic value. |
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

The chip-style filter UI in the mock matches the live `FilterChips.tsx` component at `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx`. Per R9c, this issue's impl phase **lifts** that component into a shared `apps/web/src/components/filters/FilterChipGroup.tsx` and composes it with sibling `SubmittedDateRange` and `FilterBar` modules. The existing call site migrates to the shared module; no copy stays behind. Score-band, sentiment-band, and channel chip groups all consume the same primitive.

Date formatting uses the existing `packages/shared/src/datetime.ts` (added by #378). No per-page formatter — the spec is explicit that any new datetime primitive needed by future analytics surfaces extends `datetime.ts` rather than re-implementing.

---

## Open Questions

None at this draft. Two minor questions ride into RFC / implementation:

- **OQ-1 (RFC):** ExcelJS vs. SheetJS for the server-side `.xlsx` builder. Both are acceptable; preferred path is whichever has the cheaper bundle weight in the API container — to be confirmed in the RFC's library-decision section.
- **OQ-2 (RFC):** When a brand's `memberIdentifierKind` changes mid-survey (operator changes the brand setting after responses are captured), should the Member column reflect the new kind retroactively (re-resolves on each render) or pin to the kind that was active when the response was captured? Default leaning: retroactive (single source of truth in `Brand.memberIdentifierKind`); RFC to confirm.

---

## Non-goals (Phase 1)

- **Per-question AI synthesis** (peaks/pits/requests, per-question sentiment, per-question topic clusters) — successor sub-issues of #235. Phase 1 surfaces the stored *concatenated-blob* sentiment / topics / summary with a caveat indicator; the refactor of `extractOpenEndedText` to `Record<questionId, string>` and the corresponding BAML signature change land in a successor.
- **Aggregate views** (score histogram, topic clouds, sentiment distribution) — successor sub-issues of #235.
- **Per-response detail route** (`/admin/surveys/[id]/responses/[responseId]`) — successor sub-issue if expand-in-row proves insufficient.
- **Cluster drill-through.** `SurveyResponse.clusterId` is stored but not surfaced as a column in Phase 1 — clicking through to `/admin/analytics/cx/clusters/[id]` belongs with the aggregate-view phase.
- **Excel-style per-column filtering** (click a column header → filter chips for that column's distinct values). V1.x successor — consumes the same `FilterChipGroup` primitive at the column level; deferred so Phase 1 ships.
- **NLP / natural-language filter** (*"show me detractors who mentioned billing in the last week"*). V2 successor on the same `responseFilters.schema.ts` contract.
- **Wizard Review-step verbatim/points-awarded/question-preview** — the original narrow #235 scope, will be re-filed as its own sub-issue.
- **CSV export** — operators asked for Excel specifically; CSV can be a follow-up if a use case surfaces.
- **Sortable columns** — Phase 1 sorts by Submitted descending; multi-column sort is a follow-up.
- **Row-level multi-select + bulk-action** (e.g., bulk export selected) — not asked for in Phase 1.
- **Inline editing of `Member.firstName / lastName`** from the response row — out of scope; edit via members admin.
- **Chunked / async-job export** for very large filter sets — Phase 1 enforces a 50,000-row cap and returns 413 beyond it. If audit data shows the cap being hit frequently, V1.x can add an async-job path that emails the export when ready.

---

## Phase coverage matrix (this draft)

| Issue AC | Spec R# | Validation tier |
|---|---|---|
| AC1 — table renders, brandId scoped | R1 | Integration (cross-tenant 404) + E2E (table loads) |
| AC2 — columns: Member, Channel, Submitted, Score, Sentiment, Topics, AI summary, per-question | R2, R3 | Unit (Member render, AI cell render) + E2E (table shape) |
| AC3 — long cell truncate + hover/click expand | R4 | E2E (click `more` reveals full text) |
| AC4 — long header truncate + hover/click expand | R5 | Unit (truncation helper) + E2E (hover tooltip) |
| AC5 — brand TZ + locale everywhere via shared `datetime.ts` | R6, R6a, R17 | Integration (TZ end-of-day expansion) + Manual (Excel file inspection) |
| AC6 — wave filter consumed from #378 selector | R7 | E2E (select batch, badge updates) |
| AC7 — submitted date-range filter, date-only, brand TZ | R8 | Integration (boundary day) + E2E (custom range) |
| AC8 — channel multi-select | R9 | Integration (union/intersect) + E2E |
| AC8a — score band filter (chat + PR feedback #1/#15) | R9a | Unit (band-mapper boundary) + Integration (band correctness per type) + E2E |
| AC8b — sentiment band filter (PR feedback #3) | R9b | Unit (sentiment-band boundary) + Integration + E2E |
| AC8c — shared filter modules (PR feedback #2) | R9c | Code review + Unit (FilterBar composition) |
| AC8d — filter row overflow (PR feedback #5) | R9d | E2E (resize viewport, More filters popover) |
| AC9 — pagination 25/50/100 (UI) | R11, R12 | E2E (size selector, page 2) |
| AC9a — direct-API pageSize cap 500 (PR feedback #8) | R11a | Integration (pageSize=500 ok, 501 rejected) |
| AC10 — export to .xlsx, filename pattern | R13, R14, R18 | E2E (download + filename) + Integration (parse bytes) |
| AC10a — export 50k cap (PR feedback #9) | R18a | Integration (413 + UI disabled) |
| AC11 — cover block + AI columns + full question headers + AI caveat (PR feedback #4/#7/#11/#13/#14) | R15, R16, R17 | Integration (parse `.xlsx`, assert cover rows + disclaimer) + Manual (open in Excel) |
| AC12 — cross-tenant 404 for both endpoints | R19, R20 | Integration |
| AC12a — vestigial 20-row removed from GET /v1/surveys/:id (PR feedback #10) | R21 | Integration (`survey.responses` field absent) |
| AC13 — empty state (zero responses or filtered to zero) | R23, R24 | E2E (zero-response survey + zero-filter case) |
| AC14 — anonymous rows render `—` and empty cell | R25 | Unit (Member render) + Integration (export shape) |
| AC15 — erasure zeroes AI columns (compliance, PR feedback #11) | GDPR Art. 17 in Compliance section | Integration (erasure worker side-effect) |
