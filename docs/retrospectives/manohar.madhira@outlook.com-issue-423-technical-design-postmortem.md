---
author: manohar.madhira@outlook.com
date: 2026-05-19
synthesized:
---

# Postmortem: Survey Response Review v1 — Technical Design — Issue #423

**Date**: 2026-05-19
**Duration**: ~1 session (Phases 1–7 of `technical-design` job)
**Objective**: Translate the #423 feature spec (Phase 1 of #235 — per-member tabular response review, basic filters, wave filtering, Excel export) into an implementable RFC with full traceability and architecture-gap surfacing.
**Outcome**: Success — RFC committed (`fd6355b`) to the existing feature-423 branch, traceability evidence file written, PR #426 updated with summary + 11 architecture gaps surfaced for review, design approved by the user.

## Executive Summary

The `technical-design` job ran cleanly Phases 1 → 7 on top of a spec that was already Round-3 verified clean. Phase 3 (`technical-spike`) was skipped (no high-uncertainty items requiring a separate spike branch). The RFC resolved all 5 open questions (2 from spec, 3 newly surfaced) and landed a §13 Architecture Analysis section surfacing 11 patterns missing from `architecture.md`. The user approved with "looks good. Continue" — 0 design-phase feedback rounds.

## Architectural Impact

**Has Architectural Impact**: Yes (documented but **not yet applied to `architecture.md`**)

**Sections Updated**: None this phase (deferred — see rationale below).
**Changes Made**: 11 missing-from-architecture patterns documented in RFC §13.2; suggested resolutions noted for each.
**Rationale**: Skill guardrail `architecture-documentation.Accuracy First` says "Architecture document must accurately reflect the actual codebase, not aspirational architecture." The 11 patterns are correct *for the design* but not yet present in code. Applying them to `architecture.md` before the impl PR ships the code would make the architecture doc aspirational. Per Rule 26 (one PR per issue), the architecture-doc edits land as additional commits on the same feature/423 branch when the impl phase actually adds the code. Each pattern carries its `architecture.md` location and exact wording in RFC §13.2 — so the impl phase has the edit set pre-baked.
**Updated in PR**: No — pending impl-phase commit.

## Timeline of Events

### Phase 1: requirements-analysis
- ✅ **Loaded issue #423** — 14 ACs read end-to-end via `mcp__github__issue_read`.
- ✅ **Read spec end-to-end** — 418-line spec (`docs/feature-specs/423-survey-response-review-v1.md`), 30+ R# requirements, Compliance section, Validation Plan, Phase coverage matrix.
- ✅ **Read PR #426 review state** — 25 inline comments across 3 spec rounds, all ADDRESSED; no design-phase feedback waiting.
- ✅ **Loaded `architecture.md` §1-§3 + §4 + §6** — Tech Stack, Layers, API Routes, Plugins, Design Patterns.
- ✅ **Cataloged 4 ADRs** + 11 surveys-related design patterns relevant to the RFC.
- ✅ **Inspected implementation surface** — existing `surveys.ts` routes + audit allowlist convention, `ResponseSection` placeholder, unwired `DistributionBatchesFilter.onChange`, existing `FilterChips.tsx` + `filter-chips.logic.ts`, `packages/shared/src/datetime.ts`, `packages/shared/src/constants.ts` (`SENTIMENT` + `NPS` — 5 cross-cutting consumers), `apps/api/src/utils/survey.ts:extractOpenEndedText`, Prisma `SurveyResponse` model (lines 805-852).
- ✅ **Surfaced two cross-cutting tensions** — (a) spec mandates `SENTIMENT.POSITIVE_THRESHOLD = +0.33` but constant is `0.3` with 5 strict-`<` consumers; (b) spec references `SurveyResponse.deletedAt` but no such column exists.

### Phase 2: design-authoring
- ✅ **No prior design-feedback file** — first design-phase artifact.
- ✅ **Identified ambiguities** — ExcelJS vs SheetJS (OQ-1 from spec), member-identifier retroactivity (OQ-2 from spec), SENTIMENT threshold drift (newly surfaced), browser-issued download auth (newly surfaced), `SurveyResponse.deletedAt` schema reference (newly surfaced).
- ✅ **Spike decision: `default` (no spike)** — both degrees of freedom (library choice, auth path) are well-bounded; verification is a single `du -sh node_modules/.pnpm/exceljs@*` command, not a separate spike branch.
- ✅ **Authored RFC** — 14 sections + traceability matrix; followed house style from `docs/rfcs/241-survey-admin-ux.md` rather than the bare TECHSPEC template.
- ✅ **Issue label moved phase:spec → phase:design** via `mcp__github__issue_write`.

### Phase 3: technical-spike (skipped — conditional)
- ✅ **Skipped per `phaseOutcome: default`** — verification commands inlined in RFC §9.5 as a pre-merge check, not a separate spike branch.

### Phase 4: architecture-gap-review
- ✅ **Re-read `architecture.md` §4-§7** — confirmed full pattern surface.
- ✅ **Classified 25+ patterns** into three buckets: 12 correctly followed, 11 missing from architecture, 0 incorrectly followed.
- ✅ **Appended RFC §13 Architecture Analysis** — each missing pattern named with its impact and suggested resolution; no architecture-doc edits yet (per FRAIM workflow — those happen later).

### Phase 5: design-completeness-review
- ✅ **Wrote `docs/evidence/423-technical-design-evidence.md`** — traceability matrix mapping every R# (R1-R26 + R6a/R9a-d/R11a/R18a) and every AC (AC1-AC15) and every Compliance row to an RFC section + named test tier; 0 Unmet rows.
- ✅ **Documented 11 architecture gaps** for PR review.

### Phase 6: design-submission
- ✅ **Single commit `fd6355b`** — RFC + evidence on the existing feature-423 branch (Rule 26 — no new branch, no new PR).
- ✅ **Pushed to origin** — PR #426 updated.
- ✅ **PR comment added** with headline decisions + 11 architecture gaps + traceability summary.

### Phase 7: address-feedback
- ✅ **Held on user signal per Rule 25a** — did not poll; waited for explicit user direction.
- ✅ **User responded "looks good. Continue"** — Rule 25a hold-point exit criterion met.
- ✅ **Re-read PR for new feedback** — 25 inline threads are all spec-phase (commits `e26eaf1` / `b38760c` / `8c42d3d`), all ADDRESSED; 0 comments on RFC commit `fd6355b`.
- ✅ **PR label moved phase:spec → phase:design** via `gh pr edit`.
- ✅ **Reported `evidence.approved: true, feedbackRounds: 0`** to FRAIM.

## Root Cause Analysis

### 1. **Primary Cause**

No primary cause to report — the design-phase work landed cleanly with zero feedback rounds.

### 2. **Contributing Factors / Risks Avoided**

The Phase-1 requirements analysis surfaced *three* cross-cutting integrity tensions before the RFC was authored — each could have become an impl-phase incident if the RFC had silently propagated the spec text:

**Risk A: spec/constants drift (SENTIMENT threshold).**
- *What it would have caused*: If the impl phase had blindly written `POSITIVE_THRESHOLD = 0.33` per spec, 5 unrelated analytics surfaces (`worker sentimentAnalysis`, `analytics.ts` × 3, `cx/page.tsx`, `cx/clusters/[id]/page.tsx`, `members/[id]/page.tsx`) would have reclassified borderline rows with no operator-visible benefit. A silent analytics regression.
- *What drove the catch*: cross-reference grep on `SENTIMENT.` before assuming the spec was self-consistent. Memory entry `feedback_merit_over_ease.md` ("never optimize for development time or 'drop-in swap' framing — recommend long-term-best on merit first") cued the merit check.
- *Corpus conflict*: none — this is exactly the kind of cross-impact validation that the validated pattern *verify-platform-state-claims-against-primary-source* (archived 2026-05-11) prescribes.

**Risk B: schema column referenced that doesn't exist (`SurveyResponse.deletedAt`).**
- *What it would have caused*: A schema migration whose only purpose is to match spec text — wasted impl-phase work, plus a new soft-delete column whose semantics conflict with the actual erasure model (zero-out-and-anonymize via member-FK nulling).
- *What drove the catch*: grep'd schema.prisma for `deletedAt` on `SurveyResponse` after spec's GDPR Art. 17 passage referenced it; only `Survey.deletedAt` exists.
- *Corpus conflict*: none — also covered by *verify-platform-state-claims-against-primary-source*.

**Risk C: erasure worker is referenced but doesn't exist.**
- *What it would have caused*: An impl-phase commit attempting to amend a non-existent worker; or worse, a fabricated worker scaffolding committed without an actual eraser. Either way, the spec's R-erasure clause would have ridden the impl PR as broken work.
- *What drove the catch*: grep across `apps/worker/src/processors/` showed only `externalSignalIngestion` reads `consentGivenAt`; no `erasure`/`forget` processor exists.
- *Corpus conflict*: none — same validated-pattern as A and B.

All three were resolved in the RFC as *closed open-questions* with rationale + the cheaper-to-fix side (one-line spec edits or forward-only deferrals) — no impl-phase contamination.

## What Went Wrong

1. **Initial RFC overlength.** First-pass draft was ~3,200 words before the traceability matrix; trimmed during writing once §11 was assembled and several earlier sections were redundant with it. Not a delivery problem — more an internal-workflow note that I drafted prose before the matrix and the matrix shrunk the prose.

## What Went Right

1. **Phase-1 cross-reference depth.** Reading code (5 surfaces) before writing the RFC caught all three integrity tensions before they could compound into impl-phase risk.
2. **Zero feedback rounds.** RFC submission passed user review on first read.
3. **Traceability matrix as both completeness check and structuring tool.** Authoring the §11 matrix late in Phase 2 surfaced two RFC sections that were missing details (audit-allowlist for the list endpoint; the explicit OQ-3 sentiment-threshold resolution); both were added before submission.
4. **Architecture-gap detection found real gaps.** 11 patterns is a meaningful surface area; surfacing them as forward-pointers (rather than hand-waving) means the impl phase has a pre-baked edit set for `architecture.md`.
5. **Deferred aspirational architecture-doc edits to impl PR.** Following the `architecture-documentation.Accuracy First` guardrail rather than the literal Phase-8 instruction "Post-Approval Architecture Updates" — wrote the retrospective explaining the deferral instead.

## What I Almost Did Wrong But Caught

1. **Almost wrote the architecture.md updates in Phase 8.** The FRAIM retrospective phase says "Use architecture-document-update-drafting skill to implement approved patterns." I almost did it — but the skill's own guardrail (`Accuracy First — must accurately reflect the actual codebase, not aspirational architecture`) overrides. The patterns aren't in code yet. Deferral to impl PR is the merit-first call.
2. **Almost propagated the spec's `0.33` SENTIMENT value verbatim.** Caught by the grep that surfaced 5 consumers using `0.3`. Without the cross-reference, the constant change would have shipped silently.

## Where Past Learnings Actually Fired

1. **Memory: `feedback_merit_over_ease.md`** — *"never optimize for development time, diff size, or 'drop-in swap' framing; recommend long-term-best on merit first"* — fired when I weighed "just change the constant to match the spec" against "five consumers with strict-`<` semantics get reclassified for no operator benefit." Picked the spec-corrigendum side; documented as RFC OQ-3.
2. **Memory: `feedback_one_pr_per_phase_artifact.md` (Rule 26)** — *"all phase artifacts for the issue ship in one PR (with multiple phase-aligned commits as needed), not one PR per phase"* — fired at Phase 6 submission. Single commit on the existing feature-423 branch; same PR (#426); no spawning of a sibling RFC PR.
3. **Memory: `feedback_check_pr_comments_before_merge.md`** — *"always read inline review comments before merging; status-checks-green is not enough"* — fired at Phase 7 when the user said "Continue". Pulled all 25 inline comments + all reviews via three parallel `mcp__github__pull_request_read` calls instead of trusting the PR-summary cache.
4. **Archived learning: `verify-platform-state-claims-against-primary-source` (2026-05-11)** — fired three times (SENTIMENT constant, `SurveyResponse.deletedAt`, erasure worker existence). Without this discipline, the RFC would have propagated three integrity issues from the spec.

## Lessons Learned

1. **Spec text can drift from constants between rounds.** Spec rounds 1/2/3 closed with the spec text claiming `SENTIMENT.POSITIVE_THRESHOLD = +0.33` because the spec author cross-referenced the *intent* of the constant, not its *value*. Future technical-design jobs should grep every constant the spec names before promoting it into the RFC.
2. **A spec self-audit (Round 3) catches 5 line-number drifts but won't catch value drifts.** The self-audit confirmed the constant name exists; it didn't confirm the value matched. The technical-design phase is the right seat for that.
3. **"Missing from architecture" is the dominant gap class for first-of-kind features.** 11 of the RFC's patterns were *novel* — server-side `.xlsx`, query-token auth, shared filter family, URL-state codec, etc. This is expected; the architecture doc grows as the codebase grows. The lesson is to *document* them in the RFC even if the architecture-doc edit is deferred to impl.
4. **Skill guardrails (Accuracy First) trump workflow-step literal text.** Phase 8 says "Post-Approval Architecture Updates"; the skill guardrail says "not aspirational". The latter wins.

## Agent Rule Updates Made to avoid recurrence

1. **No new permanent rules needed.** The patterns that fired here (cross-reference verification, merit-over-ease, Rule 26, check-PR-comments) are already in `MEMORY.md`. No new rule warrants adding — the existing corpus handled the work.

## Enforcement Updates Made to avoid recurrence

1. **None.** The retrospective recommends keeping the spec/RFC two-phase separation: spec phase establishes intent and the cross-cutting requirements; the RFC phase grounds those requirements against the actual repo state. Either layer alone is insufficient.
