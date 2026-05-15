---
author: manohar.madhira@outlook.com
date: 2026-05-07
synthesized: 2026-05-14
---

# Postmortem: Split brand-level theme from per-survey overrides — Issue #291 (technical-design phase)

**Date**: 2026-05-07
**Duration**: ~90 minutes wall-clock (single session, sequential to the spec phase)
**Objective**: Author the technical-design RFC for #291's schema split — translating the merged-spec requirements (R1–R13, with DR1/DR2/DR3 already resolved) into a concrete migration SQL + file-level change list + validation plan.
**Outcome**: Success — RFC accepted in a single round (one inline comment, resolved cleanly). All 11 spec comments + 1 design comment now resolved on PR #295. Awaiting merge per the user's direction.

## Executive Summary

The design phase ran cleanly compared to the spec phase: one review round, one inline comment ("Agreed" on the architecture-doc question), no scope drift, no misreads. The spec phase did the heavy lifting — DR1/DR2/DR3 resolved, demos enumerated, file-level surfaces verified — so the RFC was largely a translation exercise: spec R1–R13 → Prisma schema delta + 6-block migration SQL + file-level change list + validation plan. The architecture-gap analysis surfaced two patterns ("hand-edited Prisma migrations via `--create-only`" and "backfill-before-drop ordering") missing from architecture.md; reviewer agreed to land the doc edit on this PR rather than file separately, and a 4th bullet was added to §3.4 Data Layer with concrete reference examples in-tree.

## Architectural Impact

**Has Architectural Impact**: Yes (modest)

**Sections Updated**: `docs/architecture/architecture.md` §3.4 Data Layer.

**Changes Made**: Added a fourth bullet documenting the hand-edited Prisma migration pattern (`prisma migrate dev --create-only` + manual SQL edit), the canonical `ADD → BACKFILL → DROP` ordering with renames preceding backfills, and the in-tree reference examples (`20260430000000_patch_survey_distribution_gap` for partial-migration recovery; `<timestamp>_brandtheme_surveytheme_split` once #291 implementation lands).

**Rationale**: Both patterns are repo-correct (used in two existing migrations) but were undocumented. The RFC's architecture-gap analysis surfaced them; reviewer's "Agreed" on the Recommendation paragraph confirmed the doc edit should land on this PR.

**Updated in PR**: Yes — applied in the address-feedback round (`b11e055`).

## Timeline of Events

### Phase 1: requirements-analysis (clean)
- ✅ **Loaded spec context** (was still in window from the spec session); confirmed R1–R13 + DR1/DR2/DR3 resolutions.
- ✅ **Read architecture.md** for relevant patterns; identified spike candidates (Prisma rename, backfill ordering) — both answerable via doc-and-codebase scope, no PoC needed.

### Phase 2: design-authoring (clean)
- ✅ **No design-feedback file** existed (first RFC round).
- ✅ **Spike decision**: documented-and-codebase scope — `prisma migrate dev --create-only` + hand-edit. No PoC needed. Set `phaseOutcome: default`.
- ✅ **Drafted RFC** with full Prisma model definitions, 6-block ordered migration SQL, file-level change list across 16 files (line numbers verified at HEAD), validation plan, test matrix, 7-row risks table, design-standards section.
- ✅ **Spike Findings section**: documented the doc-and-codebase reasoning rather than leaving "N/A" — per validated pattern *"Spike-skip rationale recorded explicitly when no PoC is needed."*

### Phase 3: technical-spike (skipped — conditional)
- ✅ **Skipped** per phase-2 outcome `default`. Confidence buffer (10/100) held for the two narrow risks (Prisma rename behavior, FK auto-retarget on rename) — both verifiable on real DB during implementation per spec R13.

### Phase 4: architecture-gap-review (clean)
- ✅ **Three-bucket classification** completed: 7 patterns correctly followed, 2 missing from architecture, 0 incorrectly followed. A third candidate (public survey API select-set) was deferred as single-data-point.
- ✅ **Architecture Analysis section** added to RFC. Doc edit deferred per FRAIM phase instruction ("no architecture updates yet — they happen during address-feedback") — surfaced as a Recommendation-paragraph question for the reviewer.

### Phase 5: design-completeness-review (clean)
- ✅ **Traceability matrix** built: all 13 spec requirements mapped to RFC sections; zero Unmet rows.
- ✅ **Design-evidence file** created at `docs/evidence/291-technical-design-evidence.md` with the matrix + due-diligence + prototype/validation evidence + continuous-learning rows.

### Phase 6: design-submission (clean)
- ✅ **Commit + push**: `d84ed4f` — RFC + design-evidence as one commit; PR comment added with the open architecture-doc question highlighted.

### Phase 7: address-feedback (one round, clean)
- ✅ **Single inline comment**: reviewer "Agreed" on the architecture-doc Recommendation paragraph (RFC line 310, comment `r3199895853`).
- ✅ **Applied architecture.md §3.4 sub-section** in the same address-feedback commit (`b11e055`); RFC Recommendation paragraph updated to reflect the doc edit landed and cite the resolving thread; round-1 design-feedback file created at `docs/evidence/291-technical-design-feedback.md`.
- ✅ **Per-thread reply** posted with the resolving SHA, per validated pattern.

### Phase 8: retrospective (this document)

## Root Cause Analysis

### 1. **No problems to root-cause.**

The design phase ran without rework. The closest thing to a root-cause is a *non-event*: the round-2 misread that hit the spec phase ("data preservation is not critical" → "defer the schema move") did not repeat at the design layer. Design phase took the spec's resolved DR1 (backfill before drop) at face value and translated it into 6-block migration SQL with explicit `UPDATE` statements between `ADD` and `DROP`. The coaching moment captured durably from the spec phase appears to have firewalled the same shape from recurring at the design layer in the same session.

## What Went Wrong

Nothing material. Two minor friction points worth noting:

1. **Initial RFC mock filename habit** — when authoring the RFC's reference to the spec mock, the agent typed `mocks/291-view.html` (the round-1 spec mock filename) before catching that it had been renamed to `mocks/291-brandtheme-surveytheme-split.html` in the spec phase. Caught and corrected before push, but illustrates how "old" filenames linger in working memory across phases. No reviewer-visible impact.
2. **Architecture-doc question was framed as "decision needed"** in the PR comment, when the RFC's Recommendation paragraph already pointed at "(a) recommended" / "(b) alternative" implicitly. The reviewer correctly answered "Agreed" anyway — but the framing could have been a single sentence at the bottom of the PR comment using the established `← recommended` shape. Minor; reviewer-resolved in one word regardless.

## What Went Right

1. **Spec-phase work paid forward at design.** DR1/DR2/DR3 resolved + demos enumerated + file-level surfaces verified at HEAD with line numbers — the RFC could lean on all of this without re-running the empirical checks. Design RFC was largely a translation step rather than discovery + design.
2. **Architecture-gap analysis produced concrete recommendations, not vague observations.** Two real patterns surfaced (`--create-only` + hand-edit; backfill-before-drop ordering); each with a "where this RFC follows it" or "why this RFC needs it" + "suggested architecture update" cell. The third candidate (public survey select-set) was correctly deferred as single-data-point — restraint pattern firing.
3. **Hand-edited migration mitigation captured up front.** The two narrow risks (Prisma rename auto-gen, FK auto-retarget) were captured in the Risks table with concrete mitigations (`--create-only` + hand-edit; verify on real DB per spec R13) — not waved at, not deferred.
4. **Confidence rating with explicit reasoning.** 90/100 stated; the 10-point buffer documented two specific narrow risks rather than a vague "other unknowns" framing.
5. **One-round design-feedback resolution.** The architecture-doc question was a single sentence with a concrete recommendation; reviewer answered "Agreed" in one word; resolution applied in the same address-feedback commit. This is the validated `← recommended` pattern firing at design layer.
6. **The traceability matrix at design phase complemented the spec phase's matrix.** Spec matrix mapped issue ACs → spec R-tags; design matrix mapped spec R-tags → RFC sections. Both passed independently with zero Unmet rows.
7. **R21 held.** Branch carries spec + RFC + architecture.md edit only — no off-scope side-quests despite the architecture.md edit's tempting "while we're here, fix the drift comment" potential. The drift comment removal stays in scope for the implementation phase (where it's the natural consequence of restoring `@relation`).

## What I Almost Did Wrong But Caught

1. **Almost set `findings.issueType` to `spike_needed` because the FRAIM mentor's `enum: ["spike_needed"]` framing implied a spike was the default expectation.** Caught by reading the phase-2 instruction more carefully — `spike_needed` is the *outcome* if uncertainty is High, not the default. Set to `default` instead; the next phase mentor advanced to architecture-gap-review correctly.
2. **Almost wrote a longer "What Went Wrong" section to balance the structure.** Would have padded with manufactured concerns. Resisted; the section honestly reflects that two minor friction points are it. Sister-pattern of L1 *"Overcorrected toward generating unnecessary artifacts on broad approvals"* — restraint applied.

## Where Past Learnings Actually Fired

1. **L1 *"Documentation-and-codebase spike (no PoC) is sufficient for many abstraction-shape questions"*** (P-HIGH 8.0, 2 recurrences) — Phase 2's spike-decision used this directly: the two questions about Prisma 5.x rename behavior and migration ordering are doc-and-codebase scope; no PoC needed. Phase 2 declared `default` outcome; phase 3 was correctly skipped.
2. **L1 *"Spike-skip rationale recorded explicitly when no PoC is needed"*** (P-MED 5.0) — RFC's Spike Findings section documents the skip rationale in the ~50-word form rather than leaving "N/A," so a future reviewer can confirm the skip rather than wondering why no PoC was built.
3. **L1 *"Three-bucket architecture-gap classification structures the gap-review"*** (P-MED 5.0, 3 recurrences before this) — Phase 4 used the structure exactly: 7 / 2 / 0 buckets, with the third "Patterns Missing" candidate sub-classified as "deferred as single-data-point" rather than promoted prematurely. Restraint pattern firing.
4. **L1 *"Open decisions framed with `← recommended` get one-round answers"*** (P-HIGH 8.0, 8 recurrences) — The architecture-doc question in the PR comment used the shape; reviewer answered "Agreed" in one word.
5. **L1 *"Per-thread PR replies posted at resolution time"*** (P-HIGH 8.0, 4 recurrences before this) — Phase 7's single thread got its reply with `b11e055` SHA at resolution time. No comment left in "abandoned" state.
6. **Coaching moment from spec phase ("misread data preservation not critical as defer instead of backfill") firewalled the design phase from the same shape.** The spec phase's round-2 misread had the agent collapse migration-rigor and schema-move-scope into one decision; the design phase took DR1's backfill resolution at face value and emitted the 6-block migration SQL with explicit `UPDATE` statements. Sister-pattern recall fired in the right direction.
7. **L1 *"Tight PR scope — no opportunistic scope creep"*** (P-HIGH 8.0) — The drift comment at `schema.prisma:206-210` is in implementation scope, not design scope. Resisted touching it on this branch.

## Lessons Learned

1. **A clean spec phase produces a clean design phase.** The DR1/DR2/DR3 resolutions + the empirical-state section ("Demos affected") in the spec became the load-bearing inputs for the RFC. When the spec phase carries decision resolution + empirical verification + scope discipline, the RFC is largely a translation step. Conversely, a vague spec produces a vague RFC.
2. **The FRAIM "no architecture updates yet — they happen during address-feedback" instruction is correct.** Surfacing the architecture-doc gap as a question in the Recommendation paragraph (rather than just applying the doc edit unilaterally in the design-authoring phase) gave the reviewer a clean choice. Single-word "Agreed" closed it. If the agent had pre-emptively edited architecture.md in the design-authoring phase, the doc edit might have been the wrong shape or redundant.
3. **Doc-and-codebase spikes save real time on Prisma-shaped questions.** Both my spike candidates (Prisma rename behavior, migration ordering) had answers in Prisma's documentation + the existing codebase pattern (`20260430000000_patch_survey_distribution_gap` is the canonical hand-written migration in this repo). 5 minutes of doc reading vs. the alternative of writing a runnable PoC against a Docker-backed DB. Cost-quality tradeoff favored the doc spike heavily.
4. **The architecture-gap "deferred as single-data-point" sub-classification is durable.** This is the third recurrence of the three-bucket structure with sub-classifications; it consistently produces actionable output without forcing premature pattern-promotion. The third "missing" candidate (public survey API select-set) was correctly deferred — a future architecture-gap retrospective will revisit if it recurs.
5. **Confidence ratings benefit from itemizing the buffer.** The 10/100 buffer on the design RFC was attributed to two specific narrow risks (Prisma rename auto-gen, FK auto-retarget). A vague "10 points for unknowns" would have been less reviewable. Itemized buffers help reviewers understand exactly what would push confidence higher (a real-DB validation per spec R13).

## Agent Rule Updates Made to avoid recurrence

1. **No new rules proposed.** The FRAIM phase loop, three-bucket architecture-gap structure, decisions-with-`← recommended`, per-thread replies at resolution time, doc-and-codebase spikes, and tight-scope discipline all fired correctly without needing reinforcement.
2. **Coaching moment from spec phase remains the only durable artifact** from this issue's session — covers the "misread reviewer feedback's data-preservation phrase" pattern and is awaiting `sleep-on-learnings` synthesis.

## Enforcement Updates Made to avoid recurrence

1. **No enforcement changes.** The design phase's clean run is the outcome the existing rules + patterns are designed to produce. The non-event of the round-2 spec misread *not* recurring at design layer is itself the validation of the coaching-moment + retrospective discipline from the spec phase.
2. **Future RFC sessions can lean harder on validated-pattern recall** — particularly the three-bucket architecture-gap structure, doc-and-codebase spike reasoning, and the `← recommended` decisions block for any RFC-level architectural question. These are now consistently producing one-round resolution.
