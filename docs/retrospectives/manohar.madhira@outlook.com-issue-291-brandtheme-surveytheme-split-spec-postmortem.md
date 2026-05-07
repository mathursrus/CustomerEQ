---
author: manohar.madhira@outlook.com
date: 2026-05-07
synthesized:
---

# Postmortem: Split brand-level theme from per-survey overrides — Issue #291 (spec phase)

**Date**: 2026-05-07
**Duration**: ~24 hours wall-clock across two sessions (round-1 push 2026-05-06, rounds 2–4 on 2026-05-07)
**Objective**: Produce a feature spec + HTML mock that decomposes `SurveyTheme`'s 6 cross-concern fields into the right entities (Brand / Survey / `Brand.defaultThemeId` FK), unblocking #277's Organization Settings page from a wrong-shape FK lock-in.
**Outcome**: Success — spec accepted across 4 review rounds with all 11 inline comments resolved and DR1/DR2/DR3 confirmed by reviewer. PR #295 ready to merge once technical-design RFC lands on the same branch.

## Executive Summary

Spec went through four review rounds. Round-1 review pushed back on UI scope balloon (a survey-builder admin form section that wasn't asked for). Round-2 review surfaced 10 inline comments asking for empirical verification of which dropped fields are actually used + a mock filename convention fix. The agent misread reviewer's "data preservation is not critical" as "the schema move can be deferred entirely," and produced a round-2 spec that dropped the Survey-side schema. Reviewer corrected: "if data shows the fields are used, we need to migrate and backfill — not defer." Round-3 restored the schema move + added explicit backfill, with all round-2 mechanical fixes preserved. Round-4 confirmed DR3 (Survey columns) inline. Net cost of the round-2 misread: one extra full-spec rewrite cycle plus the per-thread reply round it generated. Coaching moment captured durably.

## Architectural Impact

**Has Architectural Impact**: Yes (modest — a refactor of an existing model, not a new architectural decision)

**Sections to be updated in implementation PR**: `docs/architecture/architecture.md` may want a note that `Brand` owns identity (logo, name, default theme FK) and `BrandTheme` is the brand-level visual style — separate from `Survey`-level overrides. The architectural decision is not "one-way door"; ADR not warranted unless implementation surfaces a non-obvious constraint.

**Changes Made**: Schema rename `SurveyTheme` → `BrandTheme` + `Brand.defaultThemeId` FK relation restored + three new `Survey` columns. The change clarifies entity boundaries (brand-level identity vs. per-survey configuration) without introducing new patterns.

**Rationale**: PR #290 review surfaced the conflation; #277 needs a stable theme-model FK target.

**Updated in PR**: Architecture-doc updates land with the technical-design RFC (next phase), not in the spec phase.

## Timeline of Events

### Phase 1: context-gathering (one round, clean)
- ✅ **Read project rules + load issue + check fraim/config.json compliance**: ran in parallel; surfaced GDPR/CCPA/SOC2/PCI-DSS configured at lines 49-66 (the mentor's "compliance not configured" warning is a known false-positive — captured in `reference_fraim_connect_overdue_learnings_false_positive.md`).
- ✅ **Empirical schema/migration/code surface enumeration**: Read `SurveyTheme` definition, `Brand`/`Survey` definitions, the `survey_themes` CREATE TABLE migration, the drift-restoration migration, the admin theme editor, the public renderer, and the existing themes API.
- ✅ **Identified the schema-vs-migrations drift comment** at `schema.prisma:206-210` is now stale (table IS in migration history at `20260427200452_add_survey_distribution`).

### Phase 2: spec-drafting (round 1)
- ✅ **Drafted spec with R1–R14 SHALL-style requirements + traceability table + compliance treatment**.
- ❌ **Drafted Surface 2 (survey builder) and `R11` (admin survey-builder Thank-you section)** — round-1 reviewer pushback called this "scope balloon."
- ❌ **Mock used a tab-based layout** based on #36 spec language without verifying actual `ThemeForm.tsx` (which is flat-sections). Caught and corrected in round 2.
- ❌ **Mock filename `291-view.html`** instead of `291-brandtheme-surveytheme-split.html` to match #277's spec-slug convention. Caught in round 2.

### Phase 3: competitor-analysis
- ✅ **Stated N/A** — internal data-model refactor, no new competitive surface; deferred to #36's existing matrix. Did not generate a duplicate matrix (avoided "Overcorrected toward generating unnecessary artifacts" L1 mistake-pattern).

### Phase 4: spec-completeness-review
- ✅ **Traceability matrix**: all 6 issue ACs mapped to R1–R14.
- ✅ **Mock-vs-spec sync sweep**: addressed at the time, but the underlying mock chrome was wrong (tabs vs flat sections). The sync sweep's blind spot: comparing scenes-against-spec but not scenes-against-implementation.

### Phase 5: spec-submission
- ✅ **Evidence doc + commit + push + PR + comment**: clean.
- ✅ **Decisions block at the top of PR body** with `← recommended` defaults for one-round resolution (a validated pattern — fired correctly in rounds 2 and 4).

### Phase 6: address-feedback (rounds 1, 2, 3, 4)
- ✅ **Round 1 (chat correction during PR review, before round-2 inline comments)**: dropped survey-builder UI surface + R11; per-row drop list mapped to `ThemeForm.tsx` line numbers; mock rewritten as flat-sections side-by-side BEFORE/AFTER. Resolved cleanly.
- ❌ **Round 2 misread**: 10 inline comments interpreted as "scope-tighten by deferring the entire Survey-side schema." Pushed a round-2 spec that dropped R3, R8, R11 schema/API/renderer scope. Reviewer corrected: "if data shows the fields are used, migrate and backfill — not defer."
- ✅ **Round 3 (corrective)**: restored schema move + added explicit backfill SQL (R5 backfills `survey_themes` rows onto `surveys` and `brands` before column drop). Round-2 mechanical fixes preserved (mock filename, false examples removed, `_count.surveys` clarified). Coaching moment captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-07T08-00-00-misread-data-preservation-not-critical-as-defer-instead-of-backfill.md`.
- ✅ **Round 4**: DR3 confirmed inline by reviewer ("Directly on Survey as columns"). One-line spec edit + per-thread reply.
- ✅ **Per-thread replies posted at resolution time** for all 11 comments, each citing the resolving SHA — validated pattern firing.

### Phase 7: retrospective (this document)

## Root Cause Analysis

### 1. **Primary Cause: Misread "data preservation not critical" as "the schema move can be deferred"**

**Problem**: Round-2 reviewer comments (4 of 10) framed the question as "is X actually used today?" with the caveat *"all surveys today are test surveys, data preservation is not critical."* The agent collapsed two distinct decisions into one:
- (a) Migration-rigor: how careful does the backfill need to be? (answer: not very, since it's only demos)
- (b) Schema-move scope: should the Survey-side columns ship in #291 at all? (answer: yes, if demos use the fields)

Treating (a)'s answer ("not very critical") as also resolving (b) ("therefore defer entirely") collapsed the dimensions and lost the load-bearing argument: demos use these fields → schema move must ship + backfill must run, even though the rigor bar for the backfill is low.

**Impact**: One extra full-spec rewrite cycle (round-2 push, then round-3 corrective push) plus the per-thread reply round it generated. Cost: ~30-45 minutes of agent time + reviewer's time to deliver the corrective chat message + the agent's time to re-pivot.

### 2. **Contributing Factor: Single-frame interpretation of reviewer feedback**

**Problem**: The agent did not surface BOTH possible interpretations of "data preservation is not critical" before acting. The two possible reads (defer schema move vs. relax backfill rigor) had very different scope implications, and only one of them was correct. Sister-pattern to existing L1 entry *"Single-frame strategic recommendation buries the cleaner answer (silent sunk-cost weighting)"* — same shape (one-sided framing without naming the alternative), applied this time to interpreting reviewer feedback rather than to design recommendations.

**Impact**: Same as primary cause; the cost was paid in the round-2 rewrite + round-3 corrective.

### 3. **Contributing Factor: Mock chrome drawn from spec text instead of implementation**

**Problem**: Round-1 mock implied a tab-based theme editor because #36's spec text used the word "tabs." The actual `ThemeForm.tsx` implementation went with flat sections. Caught in round 2 when the mock was redrawn after reading the actual component file. L1 mistake-pattern firing (the existing entry already covers it; this was its UI-layer manifestation).

**Impact**: One full mock rewrite. Modest cost relative to the spec rewrite.

## What Went Wrong

1. **Round-2 misread of "data preservation not critical"** — collapsed migration-rigor and schema-move-scope into one decision; dropped Survey-side schema unnecessarily.
2. **Round-1 mock used tab layout from #36 spec text** without reading actual `ThemeForm.tsx` — the implementation is flat-sections.
3. **Round-1 spec drafted Surface 2 (survey builder) and R11 (admin survey-builder UI)** — scope balloon, reviewer pushback in round 1.
4. **Round-1 mock filename `291-view.html`** instead of the slug-matching `291-brandtheme-surveytheme-split.html` — caught in round 2.
5. **Round-1 spec carried invented examples** (`/rewards`, `/account` for `thankYouRedirectUrl`; "NPS vs CSAT post-purchase" for `thankYouMessage`) — not grounded in #36's text. L1 mistake-pattern firing applied to product-context examples.

## What Went Right

1. **FRAIM phase loop followed end-to-end** — each phase gated by `seekMentoring`; no phases skipped or invented (sister-pattern to existing L1 *"Skipped FRAIM seekMentoring loop after completing discovery"* — that pattern did NOT fire this cycle, the loop was held).
2. **Empirical schema check ran before drafting the migration** — surfaced the stale drift comment at `schema.prisma:206-210` (table is now in migration history) and the demo `themeId` references in three seed scripts.
3. **Decisions block at top of PR body with `← recommended` defaults** — fired correctly in rounds 2 and 4; reviewer answered DR2 and DR3 in single one-line replies as predicted by the validated pattern.
4. **Per-thread replies at resolution time citing the resolving SHA** — all 11 comments got their own reply at the moment they were addressed; validated-pattern firing (P-HIGH 8.0 in L1).
5. **Coaching moment captured durably for the round-2 misread** — the same misinterpretation pattern won't ship without surfacing the alternative interpretation explicitly next time.
6. **No package-lock.json pollution** — branch was set up cleanly; `git status` checked before each stage. `prep-issue.sh` did not run for this issue (manual branch setup).
7. **Round-3 corrective preserved round-2 mechanical fixes** rather than reverting wholesale — the mock-filename rename, false-example removal, and `_count.surveys` clarification carried forward into the corrected spec, so round-3 was a re-pivot, not a redo.
8. **R21 (one issue per branch) held** — no off-scope commits landed on this branch. The stale drift comment at `schema.prisma:206-210` will be removed in the implementation PR (it's in scope for #291), not as a side-quest in this spec branch.

## What I Almost Did Wrong But Caught

1. **Almost wrote a duplicate competitive-analysis matrix in Phase 3** when #36 already has one. Caught by checking the existing spec; stated N/A instead. (Existing L1 mistake-pattern *"Overcorrected toward generating unnecessary artifacts on broad approvals"* fired correctly.)
2. **Almost applied repo-level labels (`status:needs-review`, `phase:spec`)** in Phase 5 because the FRAIM job's submit instructions said to. Caught by reading PR #290 (the most recent merged spec+design PR in this repo) which had no labels — repo doesn't use that label scheme. Followed actual repo convention instead of the generic FRAIM directive.
3. **Did NOT defer the FRAIM phase loop** even on a small refactor spec. The L1 mistake-pattern *"Skipped FRAIM `seekMentoring` loop after completing discovery"* was a candidate trap (this is a small-scope refactor that could feel "too small" for the loop). The loop ran end-to-end and produced clean phase transitions.

## Where Past Learnings Actually Fired

1. **L1 *"FRAIM discovery before any non-trivial action"*** — Started the session with `read project_rules.md` → `fraim_connect` → `list_fraim_jobs` → `get_fraim_job("feature-specification")` → `seekMentoring(starting)`. No plan-mode entered, no Explore agents launched ahead of FRAIM context. Clean run.
2. **L1 *"Open decisions framed with ← recommended get one-round answers"*** (P-HIGH 8.0, 8 recurrences) — DR1/DR2/DR3 surfaced as numbered table at top of PR body; reviewer answered DR2 with one-word "Agree with rename" and DR3 with one-word "Directly on Survey as columns" inline.
3. **L1 *"Per-thread PR replies at resolution time"*** (P-HIGH 8.0, 4 recurrences) — All 11 review comments got their own reply with resolving SHA at the moment they were addressed. No comments left in "abandoned" state.
4. **L1 *"Filing backlog issues proactively for deferred work"*** (P-MED 5.0, 9 recurrences) — Out of Scope section explicitly defers per-region variants, theme inheritance, packages/consent-text decoupling, and the four-default-themes seed (each with its owner cited). Did NOT file premature backlog issues; the deferrals will be picked up by their natural owners (#241 for survey admin UX, #277 for the seed). Restraint pattern firing.
5. **L1 *"Tight PR scope — no opportunistic scope creep"*** (P-HIGH 8.0, 8 recurrences) — Branch carries only #291 work. The stale drift comment at `schema.prisma:206-210` is in scope for #291's implementation phase (because removing it is the natural consequence of restoring the `@relation`). Resisted the urge to fix it on this branch as a side-quest.
6. **L1 *"Asserted facts about file/config without reading the primary source first"*** (P-HIGH 8.0, 3 recurrences) — Fired in **two directions** this cycle: (a) the agent verified `fraim/config.json` directly when the FRAIM mentor said "compliance not configured" (correct firing — primary source over secondary signal); (b) the agent did NOT verify the `ThemeForm.tsx` layout when drawing the round-1 mock, leaning on #36's spec language instead (the pattern's *missed* firing — caught in round 2).
7. **L1 *"Single-frame strategic recommendation buries the cleaner answer"*** (P-HIGH 8.0) — This pattern's load-bearing miss was the round-2 "data preservation is not critical" interpretation. The pattern's L1 entry is about presenting design recommendations; the application here was to interpreting reviewer feedback. Sister-pattern recorded in the new coaching moment for sleep-on-learnings to synthesize.

## Lessons Learned

1. **For ambiguous reviewer phrases that could resolve in two scope directions, surface BOTH frames before acting.** "Data preservation is not critical" can mean (a) "the rigor bar for preservation is low" or (b) "the entire schema move that requires preservation is unnecessary." These have very different scope implications. Default response: a one-question follow-up confirming which frame applies, before producing a multi-section spec rewrite.
2. **Mock chrome must mirror the implementation, not the spec text.** When mocking a surface that already has an implementation, read the actual component file and reproduce its layout. Spec language ("tabs") may have decayed into a different implementation reality (flat sections).
3. **For UI-touching refactor specs, default to "drop the inputs, layout unchanged" unless the reviewer explicitly asks for a redesign.** Round-1 surface-by-surface UX framing should already distinguish "consequence-of-change UI work" (renderer rebind, set-default action target swap) from "new-affordance UI work" (admin form section that exposes new fields). Defer the latter to a follow-on issue by default.
4. **Demo seeds are first-class consumers for migration backfill decisions.** The agent's empirical check ran for *which fields are populated* in demos, but the framing initially omitted *which fields the renderer reads from those demos*. Both questions matter; the answer to the second resolves the renderer-rebind necessity question.
5. **Per-thread replies with resolving SHAs scale to any review-round size** (this cycle: 11 comments, all replied in parallel). Cost: ~5 minutes for the parallel batch. Benefit: every thread reads as actively closed; no comments orphan into "abandoned" state.
6. **The competitive-analysis phase is appropriately N/A for internal data-model refactors.** The right move is to cite the parent feature's existing matrix and state explicitly that no new competitive surface is introduced — not to generate a duplicate matrix.

## Agent Rule Updates Made to avoid recurrence

1. **Coaching moment captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-07T08-00-00-misread-data-preservation-not-critical-as-defer-instead-of-backfill.md`** — flags the round-2 single-frame misread of "data preservation is not critical" as a candidate for synthesis into a feedback-memory rule on sister-pattern terms with the existing *"Single-frame strategic recommendation buries the cleaner answer"* L1 entry. Sleep-on-learnings will decide whether to promote into a standalone L1 entry or extend the existing one.
2. **No FRAIM rule changes proposed at this layer.** The phase-loop discipline held; the existing rules are sufficient. The miss was at the interpretation layer (how to read reviewer phrasing), not at the workflow layer.

## Enforcement Updates Made to avoid recurrence

1. **For any future spec-rewrite triggered by reviewer comments that have a "is X needed?" framing**, add a pre-execution checkpoint: enumerate at least two possible interpretations of the comment in the agent's findings before pivoting the spec scope. The cost (one extra paragraph in the seekMentoring evidence) is small relative to the cost of a full-spec rewrite cycle.
2. **For any UI mock that depicts an existing surface, read the actual implementation file before drawing the chrome.** This was already a sister-rule of the L1 *"Asserted facts about file/config without reading the primary source first"* entry; the mock-layer manifestation is now explicitly recorded in this retrospective.
3. **Continue the per-thread reply discipline at resolution time** — confirmed scaling to 11 comments in parallel. No enforcement change needed; the practice is already a P-HIGH validated pattern.
