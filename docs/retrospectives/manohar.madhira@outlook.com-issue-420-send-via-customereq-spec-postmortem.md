---
author: manohar.madhira@outlook.com
date: 2026-05-22
synthesized:
---

# Postmortem: Send Survey Emails via CustomerEQ (ACS) — Issue #420 (spec phase)

**Date**: 2026-05-21 → 2026-05-22
**Duration**: 2 days, 7 rounds of spec/mock iteration
**Objective**: Author the feature spec for #420 (Send Survey Emails via CustomerEQ Email)
**Outcome**: spec + mock signed off ("looks good") at Round 7; ready for technical-design phase. PR #497 stays Draft per Rule 27.

## Executive Summary

The spec went through 7 rounds. R1 was acceptable but described the new path in isolation; R2–R5 reframed around shared structure / divergent endpoints + operator-facing terminology. R6 took 24 inline review comments and required a codebase-verification pass plus SHALL-style R1..R45 requirements. R7 added survey-specific opt-out semantics (`Member.unsubscribedSurveysAt` distinct from `Member.emailOptIn`). Three coaching moments were captured along the way.

## Quick RCA Card

**What failed**: I drafted multiple spec sections from assumed codebase state and from prior-spec language instead of verifying against schema.prisma / source.
**Impact**: 24 inline review comments in R6; an explicit *"Don't hallucinate. Verify each claim with actual code base."* coaching moment.
**What should have happened**: Every claim of the form *"X exists today"* or *"X is V1.x"* should have been a grep against the relevant file before landing in the spec.
**What changes next time**: At spec-drafting time, run codebase verification on every cited column / endpoint / behavior before committing. Treat *"does X exist"* as a lookup, never an OQ.
**Example**: Line 46 claimed *"current member-list page has filters by attribute (tier, sentiment, health-score)..."* — fabricated; no such filters exist. OQ-7 marked `Brand.logoUrl` as *"assumed to exist"* — it was right there at `schema.prisma:201`.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: Data Model added 7 new columns (`Brand.managedEmailSenderDomain`, `Member.unsubscribedSurveysAt`, `DistributionBatch.sendMode`, `DistributionBatch.composerSnapshot`, `Survey.sentCount`, new `MemberUnsubscribeToken` table, modified `SurveyDistribution` semantics). Architecture section adds a new BullMQ queue `survey-distribution-send` + new public unsubscribe route `/u/:token`.

**Changes Made**: Both Send paths render the same `<DistributePage mode={...}/>` component parameterized by `?mode=` URL param. The `feature-implementation` phase will land migrations + worker + endpoints in commits on this same branch / PR per Rule 26.

**Rationale**: The shared-component-mode-parameterized commitment prevents drift between the SELF_SERVE (#378) and MANAGED_EMAIL (#420) flows.

**Updated in PR**: yes (spec is on PR #497; impl will follow on the same PR).

## Timeline of Events

### Phase 1: context-gathering
- [done] Read issue #420 body
- [done] Mapped existing surface area (#378 distribute page, ACS connector, distributionBatches.ts)
- [missed] **Did NOT verify codebase claims that were inherited from #378 spec language** — this surfaced as R6 hallucination findings

### Phase 2: spec-drafting (R1)
- [done] Authored 7-scene mock + spec body
- [missed] Treated the design as one-flow (managed-ACS) instead of two-flow with shared surface

### Phase 6: address-feedback (R2 through R7)
- [done] R2: reframed around shared structure
- [done] R3: brand logo + parser relaxation
- [done] R4: logo preview only, Sent semantics, Loop Monitor surfacing
- [done] R5: ACS → CustomerEQ Email + Wave Detail preservation
- [done] R6: 24 inline review comments + codebase verification + R1..R45 SHALL requirements
- [done] R6.5: theme visualization + Common-fields-above-audience reorder + suppressed-member rows
- [done] R7: Survey Batch details rename + side-by-side spec wording + unsubscribedSurveysAt
- [missed] In Round 6 I posted only top-level summary comments; did NOT reply on individual review threads until the user pushed back. Memory rule [[reply-on-pr-threads-when-addressing-feedback]] should have fired earlier.

## Root Cause Analysis

### 1. **Primary Cause**
**Problem**: I asserted codebase facts (existence of filter-by-attribute audience targeting; `Brand.logoUrl` existence; `SurveyTheme` vs `BrandTheme`; `Brand.displayName` vs `Brand.name`) without verifying against `schema.prisma` or the relevant source files.
**What drove it**: I inherited language from #378's spec without re-grepping the codebase for each claim. The `mistake-patterns.md` entry *"L1 rule in memory but doesn't fire at the load-bearing decision moment"* (score 9.0) describes exactly this — I knew the verify-before-asserting rule existed but didn't apply it during drafting.
**Corpus conflict**: None. The corpus *correctly* warned against this pattern; I just didn't fire the rule at draft time.
**Impact**: 24 inline comments in R6 including the explicit *"Don't hallucinate"* correction.

### 2. **Contributing Factors**
**Problem**: Reply pass on PR threads was skipped in Round 6 — I posted top-level summary comments but not inline thread replies.
**What drove it**: I treated the top-level summary as sufficient; missed that the memory rule [[reply-on-pr-threads-when-addressing-feedback]] applies at thread granularity, not just round granularity.
**Impact**: User had to push back ("Last round you didn't post replies to my comments") before I posted the 27 inline replies.

### 3. **Contributing Factors**
**Problem**: Stale local rule text at session start — `feature/420` was cut before Rule 26 was reworded by #406 and before Rule 27 (auto-merge) landed in #498.
**What drove it**: Did not run `git fetch + git log origin/main..HEAD -- fraim/personalized-employee/rules/` at session start.
**Corpus conflict**: None. The corpus entry *"Stale local rule text from feature-branch divergence re-triggers an extinguished failure mode"* explicitly prescribes the fetch-before-structural-decision check. The rule did not fire at session start.
**Impact**: Could have led to misapplying stale Rule 27 (which I authored on PR #496) vs the in-main Rule 27 (auto-merge). User caught it by asking me to rebase before proceeding.

## What Went Wrong

1. **Hallucinated codebase capability** (Customer Problem #3 filter-by-attribute claim).
2. **Asked instead of looked** (OQ-7 about `Brand.logoUrl` — should have been a grep, not a reviewer question).
3. **Wrong column name** (`Brand.displayName` — column is `Brand.name`).
4. **Inherited #378 spec language without re-verifying** (compounding source of #1 and #3).
5. **Skipped inline reply pass** in Round 6 — top-level summary only.
6. **Defaulted to "vertical" in spec text** when mock CSS was already side-by-side (R7 catch).
7. **Conflated `Member.emailOptIn` with `Member.unsubscribedAt`** in the dispatcher gate — should have separated marketing-opt-out from survey-opt-out from the start.

## What Went Right

1. **Codebase verification pass in R6** caught and corrected the hallucinations + Brand.name rename + BrandTheme rename in one consolidated round.
2. **Shared-vs-divergent table (§0)** got introduced in R2 and held up across all 5 subsequent rounds — the architectural commitment to one component / mode-parameterized rendered the rest of the spec coherent.
3. **R1..R45 SHALL requirements** added in R6 provide direct traceability for the RFC + impl phases.
4. **Three coaching moments captured** as raw L0 signals:
   - `pm-design-paired-flows-with-shared-structure`
   - `parser-grammar-vs-brand-primary-identifier`
   - `hallucinated-claims-without-codebase-verification`
5. **Rebase before structural decisions** — when the user asked me to rebase + re-read rules before R6, I caught that local Rule 27 was stale (mine vs main's auto-merge Rule 27) before it could cause a Rule-26 misread.

## What I Almost Did Wrong But Caught

1. **Near-miss**: Almost left `Member.emailOptIn === true` in the dispatcher gate in R6. The R7 reviewer comment forced me to think through the marketing-vs-survey distinction — emailOptIn is marketing-channel; surveys are legitimate-interest. Removed `emailOptIn` from the survey-send check, kept it for the (separate) marketing channel.
2. **Near-miss**: When the user said "now update the feature spec" at R5, I almost wrote a fresh spec from scratch instead of consolidating the 4 rounds of mock changes into the existing spec. Reading the request literally caught this — *"update"* means edit the existing document.

## Where Past Learnings Actually Fired

1. **Pattern**: *"Stale local rule text from feature-branch divergence re-triggers an extinguished failure mode"* (`mistake-patterns.md`) — fired when user asked me to rebase. Caught local-vs-main Rule 27 divergence before it caused a Rule-26 misread.
2. **Pattern**: *"Always open HTML mocks"* (`preferences.md`) — fired every time I touched mock-related design; saved me from describing UI from a stale summary.
3. **Pattern**: *"One PR per issue all phase artifacts"* (Rule 26) — fired correctly throughout — all 7 rounds + RFC + impl plan to land on PR #497.
4. **Pattern**: *"Surface open decisions with recommended defaults"* (`preferences.md`) — fired in R6 for OQ-1 through OQ-7, but OQ-7 was the wrong shape (existence question, not design question) — coaching moment captured.

## Lessons Learned

1. **Codebase verification is a draft-time activity, not a review-time activity.** Run grep/Read for every cited column / endpoint / behavior before the spec ships, not after the reviewer points out the fabrication.
2. **OQs are for design decisions, not existence questions.** "Does X exist?" → grep the codebase. "Should X be brand-wide or per-survey?" → OQ.
3. **Reply on inline PR threads, not only top-level summaries.** Memory rule [[reply-on-pr-threads-when-addressing-feedback]] applies at thread granularity; missing it cost user trust in this session.
4. **Inherited spec language carries inherited assumptions.** When reusing patterns from a prior spec (#378), re-verify every codebase claim against current state — the source spec may have been accurate at its time and stale now, or never accurate.
5. **Distinct concepts deserve distinct columns.** `emailOptIn` (marketing channel preference) and `unsubscribedSurveysAt` (survey-specific opt-out) are two different things; conflating them in the dispatcher gate would have prevented operators from running surveys to marketing-opted-out customers (a legitimate use case).

## Agent Rule Updates Made to avoid recurrence

1. **Coaching moment `hallucinated-claims-without-codebase-verification`** captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-22T17-13-10-hallucinated-claims-without-codebase-verification.md` — will get synthesized into a P-HIGH mistake-pattern by `sleep-on-learnings`, with the forcing-function *"every assertion of codebase state requires a grep this turn before it ships"*.
2. **Coaching moment `parser-grammar-vs-brand-primary-identifier`** captured at the corresponding raw file — forcing function: *"design parser rules around the operator's broader use case, not just brand-primary-identifier semantics"*.
3. **Coaching moment `pm-design-paired-flows-with-shared-structure`** captured — forcing function: *"when a feature touches a shared surface, design the shared structure first, then articulate divergence points; show both flows in the mock."*

## Enforcement Updates Made to avoid recurrence

1. **Spec-drafting checklist** (proposal for future spec jobs): before phase-2 completion, list every codebase claim cited in the spec and grep each one. If any cannot be verified, demote to OQ or remove.
2. **Inline-reply forcing function**: at end of every address-feedback round, before posting the top-level summary, post inline replies on every thread that was addressed. Memory rule already exists; sleep-on-learnings synthesis should bump its score.
3. **Rebase-at-session-start**: when starting any structural work, run `git fetch origin && git log origin/main..HEAD -- fraim/personalized-employee/rules/` as a forcing-function in the prep-issue path. Sister coaching moment from #378 already documented this; the forcing function did not have to fire here because the user prompted it, but next time it should fire unprompted.
