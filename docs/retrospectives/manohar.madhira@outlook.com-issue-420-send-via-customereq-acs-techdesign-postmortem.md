---
author: manohar.madhira@outlook.com
date: 2026-05-23
synthesized:
---

# Postmortem: Send Survey Emails via CustomerEQ (ACS) — Issue #420 (technical-design phase)

**Date**: 2026-05-22 → 2026-05-23
**Duration**: ~24 hours, 3 RFC rounds (R1 → R2 with 12 inline review comments → R2.1 with 2 template-gap fixes + RCA → R2.2 with cross-client rendering spike)
**Objective**: Author the technical RFC for #420 building on the signed-off spec (R7)
**Outcome**: RFC approved at R2.2; spike ran and findings integrated; D1–D6 all resolved; PR #497 stays Draft per Rule 27; ready to start feature-implementation on the same branch per Rule 26

## Executive Summary

The RFC went through 3 substantive rounds. R1 had pros/cons-on-precedent reasoning the reviewer pushed back on across D3/D4/D5 + a missed `SurveyDistribution.sentAt` nullability decision + a missed `Survey.sentCount` backfill. R2 fixed all 12 review comments + ran a codebase-verification pass that reshaped the data model (`deliveredAt` instead of nullable sentAt; no backfill matching `Survey.responsesCount` pattern at `schema.prisma:614-615`). Reviewer then asked for an RCA on missing Confidence + Spike sections; that RCA surfaced TWO more template-required sections (Validation Plan user-scenario table + Observability) also missed. R2.2 ran the cross-client rendering spike per `rules/spike-first-development.md` + integrated findings into §6 / §8 / §9.1 / §9.4. Three coaching moments captured.

## Quick RCA Card

**What failed**: I shipped Round-1 RFC missing FOUR TECHSPEC-template-required sections (Confidence Level, Spike Decision, Validation Plan as user-scenario table, Observability) because I substituted prior-RFC familiarity for fetching `templates/specs/TECHSPEC-TEMPLATE.md` at the start of `design-authoring`.
**Impact**: 12 inline comments in Round 2 review on top of the missing-section gap; user had to explicitly ask "any other sections missed?" before the latter two surfaced. Reviewer trust hit twice in one phase.
**What should have happened**: At the start of every FRAIM phase that names a template file in its instructions, fetch the template and structure the artifact's headings directly from it — *before* writing any content.
**What changes next time**: Forcing function: a task-list todo at every phase start: "fetch templates the phase names + structure artifact from them." No drafting before fetch.
**Example**: `design-authoring` phase Step 4 literally says *"Fetch Template: Call `get_fraim_file({ path: 'templates/specs/TECHSPEC-TEMPLATE.md' })`"* — I treated this as advisory.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: Architecture doc will gain (post-impl):
- §3.1 — mode-parameterized React page component pattern (`<DistributePage mode={...}/>`) with 4 documented surfaces that could adopt it (survey edit/new, program edit/new, campaign preview/live, future draft+publish)
- §3.3 — new BullMQ queue `managed-email-send` (distinct from existing `SURVEY_DISTRIBUTE` at `packages/shared/src/queues.ts:14` which is #117's event-trigger queue)
- §6 (Compliance) — two-gate suppression model (UI surfacing + worker pre-dispatch re-check)
- §3.2 — note for the future when SSE candidate threshold is crossed (batch sizes >5k or concurrent operators >10)

**Changes Made**: Five model modifications (Brand.managedEmailSenderDomain, Member.unsubscribedSurveysAt, Survey.sentCount, DistributionBatch.{sendMode, composerSnapshot}, SurveyDistribution.{enqueuedAt, deliveredAt, failedAt, failureReason, sendMode}); one new model (MemberUnsubscribeToken); one new enum (SurveySendMode). Single hand-edited migration; forward-only.

**Rationale**: The spec's shared-vs-divergent commitment for SELF_SERVE (#378) and MANAGED_EMAIL (#420) drove the schema additions; the `deliveredAt` separation (vs the Round-1 sentAt-nullable proposal) preserves #378's historical-truth contract while adding the per-recipient delivery signal #420 needs.

**Updated in PR**: yes (RFC at `docs/rfcs/420-send-via-customereq-acs.md` on PR #497; arch-doc updates will follow during impl).

## Timeline of Events

### Phase 1: requirements-analysis
- [done] Read spec R7 + 45 SHALL requirements
- [done] Read architecture §3.2/§3.3/§3.4/§4.3
- [done] Identified shared-vs-divergent UX surface from spec §0

### Phase 2: design-authoring
- [missed] **Did NOT fetch `templates/specs/TECHSPEC-TEMPLATE.md` before drafting** — this is the root failure of the phase
- [done] Drafted §1–§11 from prior-RFC familiarity (#378, #117 retros)
- [done] Codebase-verification pass on cited columns/endpoints/queues — every claim cites file/line
- [missed] Confidence Level section
- [missed] Spike Decision / Spike Findings section
- [missed] Validation Plan as user-scenario table (template's first cut; my §7 was Test Matrix)
- [missed] Observability section

### Phase 3: technical-spike (not entered until R2.2)
- [missed-r1] Did not formally identify ambiguities at design-authoring; jumped to drafting
- [done-r22] Spike A1 (cross-client theme rendering) executed per `rules/spike-first-development.md`
- [done-r22] Chromium rendering validated at desktop + mobile widths
- [done-r22] Real-inbox check flagged as Help-needed per the rule

### Phase 4: architecture-gap-review
- [done] §11 (now §12) Architecture Analysis section with 3 buckets (followed, missing, incorrectly-followed)

### Phase 5: design-completeness-review
- [done] §12 (now §13) Requirements Traceability R1..R45

### Phase 6: design-submission
- [done] Round-1 RFC submitted; PR #497 stays Draft per Rule 27

### Phase 7: address-feedback
- [done] R2: 12 inline replies + Round-2 RFC with pros/cons tables for D3/D4/D5
- [done] R2.1: 4 missing template sections fixed (§9 Confidence + Spike, §7.0 Validation Plan, §13 Observability); RCA coaching moment captured
- [done] R2.2: §9.3 spike executed + integrated; D6 resolved
- [done] Coaching moment 1: `precedent-as-recommendation-without-tradeoff-analysis`
- [done] Coaching moment 2: `skipped-template-fetch-because-i-thought-i-knew-the-shape`

### Phase 8: retrospective (this document)

## Root Cause Analysis

### 1. **Primary Cause**
**Problem**: Round-1 RFC shipped missing 4 TECHSPEC-template-required sections.
**What drove it**: Familiarity bias — I substituted "I know what an RFC contains from prior repos / #378 / #117" for fetching the canonical template. The `design-authoring` phase instructions Step 4 explicitly say *"Fetch Template: Call `get_fraim_file({ path: 'templates/specs/TECHSPEC-TEMPLATE.md' })`"* but I treated this as advisory rather than mandatory. This is the same shape as the R6-spec coaching moment `hallucinated-claims-without-codebase-verification` (substituted assumed codebase state for grep) and the Round-2 RFC coaching moment `precedent-as-recommendation-without-tradeoff-analysis` (substituted precedent for pros/cons analysis). Three different shapes, one root cause: **substituting a low-effort proxy for the source**.
**Corpus conflict**: None. My `mistake-patterns.md` entry *"L1 rule in memory but doesn't fire at the load-bearing decision moment"* (score 9.0 per my MEMORY.md) describes exactly this pattern. I knew the rule shape; I just didn't fire it at the load-bearing moment when authoring the RFC. The corpus correctly warned; I didn't apply.
**Impact**: 12 inline comments in Round 2 review on top of the structural gap; user had to ask "any other sections missed?" before two more (Validation Plan, Observability) surfaced.

### 2. **Contributing Factors**
**Problem**: D3/D4/D5 Round-1 recommendations leaned on "no SSE precedent in codebase," "no existing rich-text editor," "matches notifications queue convention" — citing precedent as the recommendation rather than as one input.
**What drove it**: Same low-effort-proxy shape. Codebase precedent is cheap to cite; pros/cons analysis with axes (UX latency, bandwidth, server CPU, ACS rate limits, etc.) is more work but is the actual answer. I picked the cheap citation.
**Impact**: Reviewer pushback on all three with three different rephrasings of the same critique (*"No precedence is NOT a good reason for a V1 product"* / *"Shouldn't you give me pros and cons?"* / *"give more justification than precedence"*).

### 3. **Contributing Factors**
**Problem**: Round-1 RFC's data model proposed `SurveyDistribution.sentAt` becoming nullable to carry MANAGED_EMAIL's "actually-sent" semantic.
**What drove it**: I designed the per-mode semantic onto the existing column instead of adding a new one. This collided with #378's historical-truth contract (historical rows have `sentAt` = creation time per `@default(now())`).
**Corpus conflict**: None directly. The fix (separate `deliveredAt` column) is consistent with the `Survey.responsesCount` / `distributionCount` no-backfill pattern at `schema.prisma:614-615` — but I didn't reach for that analog at design time. Reviewer surfaced it: *"Historical Sent At can be the date row was created. Need not say sentAt = NULL."*
**Impact**: Round-2 simplification removed the entire `ALTER COLUMN sentAt DROP NOT NULL` migration step; cleaner design.

## What Went Wrong

1. **Skipped template fetch at `design-authoring` start**; primary root cause.
2. **Designed `SurveyDistribution.sentAt` nullable** instead of adding `deliveredAt`; cost: one round of model rework.
3. **Proposed backfill for `Survey.sentCount`** when the no-backfill pattern was right there in `Survey.responsesCount`; cost: one inline review comment.
4. **Used `SendMode` instead of `SurveySendMode`**; cost: trivial rename but signals I didn't think ahead to "later we may send many things."
5. **Wrote D3/D4/D5 recommendations citing precedent**; cost: full Round-2 rewrite of all three with pros/cons tables.
6. **Round-1 RFC said "validate in staging"** when there is no staging environment in this repo; cost: one inline review comment + Round-2 rewrite of Risk #1 mitigation.
7. **Marked the new queue `survey-distribution-send`** before checking the existing `SURVEY_DISTRIBUTE` queue name; the existing queue is #117's event-trigger path so a distinct name (`managed-email-send`) was needed. Fortunately caught during the codebase-verification pass.

## What Went Right

1. **Codebase verification pass in Round 2** caught the existing `SURVEY_DISTRIBUTE` queue, the `Survey.responsesCount` / `distributionCount` no-backfill pattern, and the `Brand.defaultThemeId` at `schema.prisma:209` — verified before claims shipped, not after.
2. **The §9.3 spike actually executed** per the FRAIM rule's mandate — code in `spike/420-cross-client-rendering/`, Chromium screenshots, FINDINGS.md, RFC integration. Spike rule's *"Help needed"* convention honored for the real-inbox check that requires user inboxes.
3. **D6 resolution via spike** rather than deferring to impl — the §9 changes (link auto-styling helper, Outlook button VML escape hatch) landed in the RFC, not just in `FINDINGS.md`.
4. **Three coaching moments captured** as L0 signals — all sister-shaped (substituting a low-effort proxy for the source):
   - `precedent-as-recommendation-without-tradeoff-analysis`
   - `skipped-template-fetch-because-i-thought-i-knew-the-shape`
   - (And from the spec phase: `hallucinated-claims-without-codebase-verification`)
5. **Rule 27 (Draft until work-completion)** held — PR #497 stayed Draft through all RFC rounds.
6. **Codebase-verification pass surfaced the V0/V1 separation cleanly**: `Brand.managedEmailSenderDomain` ships with code wiring but stays null in V0; `Member.unsubscribedSurveysAt` is separate from `Member.emailOptIn`; surveys exempt from marketing opt-out per legitimate-interest. None of this was assumed; all verified.
7. **One PR (Rule 26)**: spec + RFC + spike all on PR #497; ready to keep impl on the same branch.

## What I Almost Did Wrong But Caught

1. **Near-miss**: Almost called the new BullMQ queue `survey-distribution-send`. Caught by the Round-2 codebase-verification pass that found the EXISTING `SURVEY_DISTRIBUTE` queue used by 3 callers in `apps/worker/src/*` (#117's path). Renamed to `managed-email-send` to keep #117 and #420 cleanly separated.
2. **Near-miss**: Almost left D3/D4/D5 with the "precedent" justifications even after reviewer pushback on D4 — the reviewer accepted TipTap so I could have just confirmed without analysis. The Round-2 rewrite pros/cons tables across all three because the lesson was *the framing*, not the conclusion.
3. **Near-miss**: Almost ran the spike *after* writing the worker, which would have made any template-structure adjustment a re-write. Caught by the FRAIM rule's mandate "spike before complex integration" — spike ran on its own branch in `spike/`, no schema/worker/API changes, code clean for the impl phase.

## Where Past Learnings Actually Fired

1. **Pattern**: *Codebase-verification-before-asserting* — fired during Round-2 RFC rewrite. Each cited file/line was grepped before landing in the RFC. The `mistake-patterns.md` entry on "L1 rule in memory but doesn't fire at the load-bearing decision moment" applied — this round, the rule fired.
2. **Pattern**: *Don't substitute the proxy for the source* (cross-coaching-moment shape recognition) — fired during the §9.3 spike when I caught myself starting to write "the template renders correctly because Gmail and Outlook are well-documented" as a substitute for actually rendering the HTML. Stopped, wrote `render-template.ts`, rendered it, screenshotted it.
3. **Pattern**: *Check PR comments before declaring done* (`feedback_check_pr_comments_before_merge`) — fired throughout. 12 inline replies posted in Round 2 before the top-level summary.
4. **Pattern**: *Draft PR until work-completion* (Rule 27) — fired correctly; PR stayed Draft.
5. **Pattern**: *Validate phase must run build* (preference) — N/A this phase (no code changes outside the spike); will fire during impl.

## Lessons Learned

1. **Template fetch is mandatory, not advisory.** Every FRAIM phase that names a template file is naming the contract for the deliverable. Structuring the artifact's headings from the template first is cheaper than the multi-round review-then-add cycle that happens when sections are missed.
2. **Codebase precedent ≠ recommendation justification.** Precedent is one input to "dev cost"; it's never the answer to "what's the right design." Pros/cons table with axes that matter to the operator + the long-term product is the actual answer.
3. **Spike before complex integration is real, not nominal.** Running the §9.3 spike upfront (≤2 hours) was cheaper than fixing the worker if the spike had failed. The same logic applies to any V1 product surface where the customer outcome depends on a fragile integration.
4. **Distinct semantic concepts deserve distinct columns.** `sentAt` (mint-time) and `deliveredAt` (provider-confirmed) are two different things; conflating them onto a nullable column lost #378's historical-truth contract and added migration complexity.
5. **Sister-shape coaching moments are valuable.** Three different-looking mistakes shared one root cause (substituting a low-effort proxy for the source). Naming the shape in the new coaching moment + cross-linking to the prior ones is the right L0 signal for `sleep-on-learnings` to synthesize into a higher-score L1 pattern.

## Agent Rule Updates Made to avoid recurrence

1. **Coaching moment `precedent-as-recommendation-without-tradeoff-analysis`** — captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T03-19-55-…`. Forcing function: *for each open RFC decision, draft a small pros/cons table comparing 2–3 real alternatives with axes that matter to the operator and the long-term product; cite precedent as one input to the "dev cost" column, never as the recommendation by itself.*
2. **Coaching moment `skipped-template-fetch-because-i-thought-i-knew-the-shape`** — captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T04-59-52-…`. Forcing function: *at the start of any FRAIM-phase artifact authoring, list the templates the phase instructions name + fetch each one before drafting any content; structure the artifact's headings directly from the template.*
3. Both coaching moments cross-link to the prior `hallucinated-claims-without-codebase-verification` from the spec phase. The shared shape is: **substituting a low-effort proxy for the source**. `sleep-on-learnings` should synthesize these three into a higher-score L1 mistake-pattern entry with that explicit framing.

## Enforcement Updates Made to avoid recurrence

1. **Template-fetch as a phase-start todo**: when entering any FRAIM phase, the first item in the task list should be "fetch templates / skills / rules the phase instructions name." No drafting before fetch. If the phase instructions are silent about templates (rare), the first item is "scan phase instructions for any file-path references and fetch them."
2. **Pros/cons table as RFC default**: any RFC open decision (D-anything) requires a pros/cons table with at least 2 alternatives and at least 3 axes — even when the recommendation is obvious. The table is for the reviewer's benefit, not mine.
3. **Spike-first as the rule, not the exception**: per `rules/spike-first-development.md`, the *"any complex integration / any unfamiliar technology / any architectural change"* enforcement triggers should be evaluated as a hard gate at `design-authoring` end, not as a soft "consider it." For #420 the gate fired correctly (theme rendering) but only after the user prompted "run the spike now."
4. **Distinct columns for distinct semantics** — heuristic for future Prisma model changes: if two callers want to write different values at different times, that's two columns, not one nullable column with a per-mode interpretation.
