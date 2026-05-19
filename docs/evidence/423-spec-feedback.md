# Feedback for Issue #423 — feature-specification Workflow

## Round 1 Feedback
*Received: 2026-05-19 (PR [#426](https://github.com/mathursrus/CustomerEQ/pull/426) review by @rmadhira86, plus 2 chat-thread items captured the same day)*

Round 1 covers all comments left on commit `e26eaf1` plus two chat-thread design decisions that flow into the same edit pass.

---

### Comment 1 — ADDRESSED · score-band filter
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:65`
- **Comment**: *"Filter row should also include: Type of responses: e.g. Promoters / Passives / Detractors for NPS Survey, and other industry accepted bands for CSAT and CES Surveys. If Pills become complex for layout, suggest alternative. Filter row should not take more than a row."*
- **Resolution**: Added a **Score Band** chip group whose chip options are derived from `Survey.type` at render time. NPS → `Promoter (9–10) · Passive (7–8) · Detractor (0–6)` using the existing `NPS.PROMOTER_THRESHOLD = 9` / `NPS.DETRACTOR_THRESHOLD = 6` constants at `packages/shared/src/constants.ts`. CSAT (1–5) → `Satisfied (4–5) · Neutral (3) · Dissatisfied (1–2)` (top-2-box / bottom-2-box). CES (1–7) → `Easy (5–7) · Neutral (4) · Hard (1–3)` using the modern CES 2.0 framing (high = good). Constants for CSAT + CES live alongside the existing `NPS` constant in `packages/shared/src/constants.ts` so API filters, UI chips, future aggregate-view phases, and the export builder all read from the same source. Multi-select within the group, intersect across groups (same `filter-chips.logic.ts` semantics). Group label is **"Score band"** (not "Type") so the operator never thinks they're switching survey type. Layout safeguard captured in Comment 5 resolution.

### Comment 2 — ADDRESSED · filters as reusable shared modules
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:67`
- **Comment**: *"These filters are expected to be used in many other places in future. Tech Design should plan for reusability and plug and play instead of creating copies."*
- **Resolution**: Spec now records that the **filter primitives lift into shared modules** the impl phase will consume:
  - `packages/shared/src/constants.ts` — `NPS`, `CSAT`, `CES`, `SENTIMENT` band thresholds + `*.bandOf(score)` helpers, single source of truth for any platform surface that buckets a score.
  - `apps/web/src/components/filters/FilterChipGroup.tsx` — generalised version of the existing `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx`, parameterised on `{ key, label, options[], multiSelect }`. The existing component migrates here so it doesn't fork.
  - `apps/web/src/components/filters/SubmittedDateRange.tsx` — date-range picker built atop `packages/shared/src/datetime.ts` (see Comment 6) — date-only inputs, `submittedTo` expanded to end-of-day in brand TZ at the server.
  - `apps/web/src/components/filters/FilterBar.tsx` — composes any subset of `{ScoreBand, SentimentBand, Channel, SubmittedDateRange, ...}`, accepts an `onChange(filterState)` callback, handles overflow (Comment 5).
  - `packages/shared/src/zod/responseFilters.schema.ts` — single Zod schema reused by the new list/export endpoints plus any future analytics endpoint that filters responses (cluster-detail, member-detail, CX Insights).
  
  The shape lets future surfaces (cluster detail, member detail, CX Insights, etc.) drop in `<FilterBar groups={['scoreBand', 'sentimentBand']} />` without copying chip code, and the API filter contract is one schema everywhere. The RFC will pick the exact module boundaries; the spec records the obligation.

### Comment 3 — ADDRESSED · sentiment filter
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:67`
- **Comment**: *"Allow for Sentiment Filters."*
- **Resolution**: Added a **Sentiment Band** chip group filtering on the stored `SurveyResponse.sentiment` float (-1.0 → 1.0). Bands: `Positive (≥ +0.33) · Neutral (-0.33 … +0.33) · Negative (≤ -0.33)`. Boundaries codified in `packages/shared/src/constants.ts` as `SENTIMENT` (paralleling `NPS`). Chip group is hidden when the survey has zero open-ended text questions (sentiment is never populated for those). Multi-text-question caveat indicator (see Comment 4) sits next to the chip group label so operators understand the today-vs-later quality of the underlying signal.

### Comment 4 — ADDRESSED · AI-derived columns now (table shape)
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:72`
- **Comment**: *"Add AI generated columns that are available today."*
- **Resolution**: Phase 1 surfaces three already-stored AI-derived columns:
  - **Sentiment** — colored chip derived from `SurveyResponse.sentiment` (`Positive / Neutral / Negative`) with the raw float on hover.
  - **Topics** — comma-separated chip list from `SurveyResponse.topics` (max 3 chips visible, `+N` overflow with full list on hover).
  - **AI summary** — `SurveyResponse.summary` (one prose line). Truncate + hover/click expand like other free-text cells.

  The fourth AI-derived field (`clusterId`) is deferred — it's relational and the drill-through belongs with the aggregate-view phase. A small info-icon next to the AI column-header group surfaces the caveat: *"Computed across all open-ended answers — per-question synthesis lands in a later phase of #235. For standard NPS / CSAT / CES surveys with one text question, the values are correct as computed."* The caveat is also written into the export cover block so downstream possessors of the file see it (see Comment 11 for the compliance angle).

### Comment 5 — ADDRESSED · layout safeguards if filters overflow
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:65`
- **Comment**: *"If design / layout issues become a challenge, Channel filter can be dropped. Alternatively, Excel style column filtering can be applied (either now or V1 depending on complexity), or a NLP based filter in V2."*
- **Resolution**: Spec records a three-tier layout policy:
  1. **Default (single row, ≥ 1280px detail page width)**: render `Submitted · Score band · Sentiment band · Channel` as four chip groups in one wrap-aware row. Empirically four groups fit (Channel has up to 5 chips; the rest have 3–4).
  2. **Overflow rule**: if the four-group row wraps past one row at the default page width, the **Channel** group collapses behind a `More filters ↓` dropdown (popover with the four channel chips inside). Channel is the candidate per Comment 5 ("Channel filter can be dropped" — we soft-drop into overflow rather than removing entirely).
  3. **Future evolution (V1.x / V2)**: V1.x can add **Excel-style per-column filtering** (click a column header → filter chips for that column's distinct values — same FilterChipGroup primitive consumed at the column level, no new code path). V2 can add **NLP / natural-language filter** *("show me detractors who mentioned billing in the last week")* atop the same `responseFilters.schema.ts` contract. Both deferred to successor sub-issues of #235; recorded in Non-goals.

### Comment 6 — ADDRESSED · shared datetime module
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:97`
- **Comment**: *"As I mentioned - these should be common modules that are used across the site for display and selection of date and date times. Each page should not reinvent these rules."*
- **Resolution**: Spec now points explicitly at the existing `packages/shared/src/datetime.ts` (added by #378) which already exports `formatInBrandTz`, `endOfDayInBrandTz`, `addDaysInBrandTz`, `resolveLocale`. Both the new Response section and the (lifted) `SubmittedDateRange` component consume those primitives — no per-page formatter. The Excel cover-block builder also calls `formatInBrandTz` on the server. If a primitive is missing for some future page (e.g., a localised week-of-quarter), it is added to `datetime.ts`, never reinvented. RFC will name the primitive list it expects; impl PR keeps the shared module honest.

### Comment 7 — ADDRESSED · AI columns in UX walkthrough
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:108`
- **Comment**: *"Include AI generated columns available today."*
- **Resolution**: The §3 walkthrough (scenes 1–5) now references Sentiment / Topics / AI summary as visible columns. New scenes added to the mock to show the AI columns at default, the sentiment chip color states, the topic-overflow `+N` affordance, and the AI-column caveat info-icon. See Comment 4 for the data-shape detail.

### Comment 8 — ADDRESSED · API pageSize for direct consumers
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:137`
- **Comment**: *"Should the API allow for a larger value for Page size if Brands are connected directly to API or should we direct them to the response.xlsx route if they want all responses."*
- **Resolution**: Two-tier policy:
  - **UI consumer** (the admin Response section): `pageSize ∈ {25, 50, 100}` enforced by the chip selector. No way to send larger from the UI.
  - **Direct API consumer** (a brand's backend hitting `GET /v1/surveys/:id/responses`): the Zod schema accepts `pageSize` in the range `[1, 500]`. 500 is the documented cap for paginated JSON. Direct consumers needing all responses are pointed at `GET /v1/surveys/:id/responses.xlsx` (which streams a single file with no pagination). Spec adds an OpenAPI-style note that documents this; the Zod schema's `.max(500)` is the enforcement.

### Comment 9 — ADDRESSED · safety cap for million-row export
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:138`
- **Comment**: *"What would happen if they caller forgets a filter and there a million rows in the response?"*
- **Resolution**: Two safety caps land in Phase 1:
  - **List endpoint** (`/responses`): paginated by `pageSize ≤ 500`; no risk of a million-row body. A caller iterating pages is welcome.
  - **Export endpoint** (`/responses.xlsx`): server enforces a **50,000-row export cap** (matches the existing `SurveyImportBatch` row cap from #262, so platform-wide limits stay consistent). If the filter set's `total > 50000`, the endpoint returns **HTTP 413 Payload Too Large** with a JSON body `{ code: 'EXPORT_TOO_LARGE', total, capacity: 50000, message: '<filter help>' }`. The UI listens for 413, disables the Export button when the filtered total exceeds 50k, and surfaces an inline message: *"Filtered set is 1,247,033 responses — narrow the filters (try a date range or a single wave) and try again."* This protects both the API worker and the user from a Mb-scale XLSX they can't open in Excel anyway (Excel's hard limit is 1,048,576 rows per sheet).
  - **Audit signal**: every export attempt — successful or 413-rejected — writes an audit row, so we can spot "users keep hitting the cap" as a real signal for V1.x (chunked or async-job export).

### Comment 10 — ADDRESSED · vestigial 20-row inline on `GET /v1/surveys/:id`
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:139`
- **Comment**: *"Is this the endpoint that gives the current Survey Page? If so, why does it need 20-row of responses? Where is it used?"*
- **Resolution**: Audited. The endpoint **is** the survey detail page's primary fetch (`apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx:83`). It includes `responses: { take: 20, select: { id, memberId, score, sentiment, topics, channel, completedAt, clusterId, cluster.label, importBatchId } }` (`apps/api/src/routes/surveys.ts:129–144`). Grep across `apps/web/src` confirms **no consumer reads `survey.responses` from this payload** — the page uses `survey._count.responses` only, for the count badge. The inline 20-row block is vestigial — likely from an earlier iteration of the detail page that previewed responses inline before the placeholder Response section landed in #241 Slice 4a. Spec now records:
  - **Phase 1 impl** removes the `responses: { take: 20, ... }` from `apps/api/src/routes/surveys.ts:129–144`. The Response section's new endpoint is the single source.
  - The change is wire-compatible — existing consumers don't read the field, so this is a strict shape reduction. Integration test added: `survey.responses` should NOT be in the `GET /v1/surveys/:id` payload after this PR.
  - The original concern in the comment (*"why does it need 20-row of responses?"*) is now answered as: it doesn't, and we're removing it. Less surface area, no consumer impact.

### Comment 11 — ADDRESSED · compliance for AI-derived fields
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:158`
- **Comment**: *"AI derived information should be included. Highlight if Compliance changes."*
- **Resolution**: Compliance section now covers the AI-derived columns explicitly:
  - **GDPR Art. 4(4) — profiling.** Sentiment and topics are derived from the data subject's input. Surfacing them on the operator-facing detail page is a *read* of derived data the platform already stores; it is not a new processing operation. No new lawful-basis disclosure is required to the data subject (the lawful basis was established at collection).
  - **GDPR Art. 22 — automated decision-making.** Phase 1's display does **not** make automated decisions producing legal or similarly significant effects on the data subject. Sentiment/topics/summary are informational columns the operator reads; they do not gate any user-facing action. If a successor phase ties an automated action to sentiment (e.g., auto-fire a winback campaign on Negative), that surface invokes Art. 22 and adds human-in-the-loop safeguards — recorded as a forward-pointer here so the boundary doesn't drift unnoticed.
  - **GDPR Art. 5(1)(d) — accuracy.** The per-question synthesis gap (audit comment on #235) means today's `sentiment / topics / summary` values are computed on the *concatenated* answer blob for multi-text-question surveys. The AI-column caveat indicator (Comment 4) is the user-facing accuracy disclosure that Article 5(1)(d) anticipates. The successor sub-issue of #235 that refactors `extractOpenEndedText()` to per-question is the durable fix; the caveat is the interim mitigation.
  - **GDPR Art. 17 — right to erasure.** When the worker zeroes a member's PII on erasure, it must also zero `SurveyResponse.sentiment / confidence / topics / summary / clusterId` (or set `sentiment=NULL, topics=[], summary=NULL`) on every response with `memberId = <erased>`. Captured as an **acceptance criterion on the erasure worker change**, not on this issue, but recorded here so the cross-issue dependency is explicit. Filed as a follow-up note in the spec; the existing erasure worker `apps/worker/src/processors/...` needs to be checked against this rule.
  - **SOC2 PI1.4 — processing integrity.** Stored AI-derived columns are a *cache* of the AI run; if the AI prompt or model changes, the cached values are stale. Spec records that the impl phase adds a `SurveyResponse.aiAnalyzedAt` timestamp (or reads existing equivalent) and the audit row for the export captures the *vintage* of the AI fields included, so a downstream possessor can correlate the file with the model state.

### Comment 12 — ADDRESSED · validation plan covers new filters
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:214`
- **Comment**: *"Why are other filters not included?"*
- **Resolution**: Validation plan now adds integration test cases for: `wave + scoreBand + sentimentBand + submitted + channels` composition; per-band correctness (an NPS=10 row is `Promoter`, NPS=7 is `Passive`, NPS=4 is `Detractor`); Sentiment band boundaries (`-0.33` and `+0.33` boundaries inclusive on the negative/positive sides); empty Sentiment band for surveys without text questions; overflow chip group when `>4 groups` in the filter bar (UX-level). Unit tests added for the band-mapper helpers and the FilterBar composition.

### Comment 13 — ADDRESSED · AI columns in Alternatives table
- **Author**: @rmadhira86
- **Type**: review_comment
- **File / line**: `docs/feature-specs/423-survey-response-review-v1.md:312`
- **Comment**: *"Include the current AI-derived columns now. Future iterations may modify the same columns or add new ones."*
- **Resolution**: The Alternatives table row *"Surface AI-derived columns in Phase 1"* — previously listed as a discarded alternative — is **inverted** to the chosen path. Spec now records the merit-over-ease reasoning (the same logic captured in chat: stored values are correct for the majority single-text-question surveys; column-shape stays stable when the per-question synthesis lands; operators get day-one analytic value; columns can be improved without re-shaping the table later). The deferred items in the row become specifically: the `extractOpenEndedText()` per-question refactor and the BAML signature change.

### Comment 14 — ADDRESSED · AI-derived columns (chat-thread)
- **Author**: @rmadhira86 (chat thread, this session)
- **Type**: chat decision
- **Comment**: *"Is it too much work to expose them in the display now and improve on them later?"*
- **Resolution**: Same change as Comments 4, 7, 11, 13. Sentiment / Topics / AI summary columns added to Phase 1 with the multi-question caveat indicator. Counts as one logical change, recorded against all four GitHub comments for traceability.

### Comment 15 — ADDRESSED · score-band filter naming (chat-thread)
- **Author**: @rmadhira86 (chat thread, this session)
- **Type**: chat decision
- **Comment**: *"Earlier in the issue creation you had another filter for categories of responses: Promoters, Detractors, Passive for NPS. What were the categories for CSAT and CES Surveys, why is that filter missing now in the issue?"*
- **Resolution**: Same change as Comment 1. Filter named **Score band** (not "Type") so the operator never thinks they're switching survey type. Categories per type: NPS / CSAT / CES bands as defined under Comment 1. CSAT and CES band constants added to `packages/shared/src/constants.ts` in the impl PR.

---

## Round 1 — Re-validation evidence

- All 15 items marked ADDRESSED above.
- Spec edited (sections: §2 surface, §2.2 filter row, §2.3 columns including AI fields + Sentiment + Topics + Summary, §2.4 pagination cap, §2.5 export cap + 413, §3 walkthrough scenes, §4 edge cases, Functional Requirements R# table extended, API §R19/R20 with caps, Compliance section incorporating Art. 4(4)/22/5(1)(d)/17 + SOC2 PI1.4, Validation Plan covering new filter compositions + band boundaries, Alternatives table updated, Non-goals list now records cluster-drill-through + Excel-style per-column filter V1.x + NLP filter V2).
- Mock updated: 3 new columns (Sentiment chip / Topics chips / AI Summary), Score Band chip group, Sentiment Band chip group, caveat info-icon next to AI columns header group, overflow `More filters` chip-group state, 50k-row export-cap inline message.
- Evidence doc reflects round-1 scope.
- Re-pushed to feature branch; PR conversation thread will resolve each comment with a per-line reply.
