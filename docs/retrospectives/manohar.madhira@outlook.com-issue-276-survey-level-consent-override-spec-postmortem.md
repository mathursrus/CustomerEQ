---
author: manohar.madhira@outlook.com
date: 2026-05-04
synthesized:
---

# Postmortem: Survey-level consent override + IMPLIED_ON_SUBMIT migration — feature-specification — Issue #276

**Date**: 2026-05-04
**Duration**: ~75 min from issue prep through round-1 closure (excluding the dev-DB recovery for #270 + #281 that ran in parallel)
**Objective**: Translate #276's directional solution into an implementable spec answering the three open questions, with a UI mock + compliance map + competitor brief, and ship for review.
**Outcome**: Round-1 review surfaced 11 comments — 9 substantive (scope split + new `consentReason` field + persona correction + Q3 flip), 2 confirming the recommended Q1 + Q2 answers. All 11 closed in commit `c9093fc` with per-thread replies. PR #282 awaiting round-2 / approval.

## Executive Summary

The first draft of the spec was over-scoped: it included a full survey-editor user-flow walkthrough (Persona A) with a step-by-step UI sequence even though the customer-facing UX surface for surveys is owned by **#241 (Survey Admin UX epic)**, which the reviewer is prioritizing immediately. The data-model + backend + migration scope is the right shape for a P0 hotfix; the UI slot belongs to the broader admin UX revamp. The reviewer's first comment ("the mock is only informational for #241") was the primary signal — the rest of the comments cascaded from that scope decision (UX details defer to #241; the spec needs to define only the API contract #241 will bind to). Two non-scope additions also landed: a new `Survey.consentReason: String?` column captured at attestation time, and a Q3 flip from the timestamp-bounded migration to an unconditional sweep across all orgs.

## Architectural Impact

**Has Architectural Impact**: No

The spec's data-model delta is two nullable column adds (`Survey.consentMode`, `Survey.consentReason`) on an existing table; no new patterns, no new components, no new technologies. The backend layer change is one expression added to an existing resolver. The migration is a one-shot UPDATE. Architecture-doc surgery is not required.

## Timeline of Events

### Phase 1: context-gathering
- ✅ Read issue #276, parent #231 RFC retro, Brand + Survey schemas, consentResolver, public.ts survey-response endpoint + widget. Confirmed `Survey.consentSuppressedAttestedBy/At` already exist as placeholders from #231 PR1.
- ✅ Confirmed compliance is configured in `fraim/config.json` (FRAIM warning to the contrary was a known false positive).
- ✅ Surfaced #281 (CREATE TYPE non-idempotency in #231 PR1) as a sibling concern during dev-DB recovery; filed separately, not in #276 scope.

### Phase 2: spec-drafting
- ❌ **Drafted Persona A (UX walkthrough) as part of #276**. Should have caught that the survey admin UX belongs to #241 — the issue body itself cross-references #241 as adjacent, and the parent epic explicitly absorbs survey-related admin work. Caught only in round-1 review.
- ✅ Open questions Q1/Q2 answered with the right recommendation (nullable column / reuse attestation columns).
- ❌ **Q3 (migration scope) recommended the timestamp-bounded form**, weighted against the unconditional sweep on safety grounds. Reviewer flipped it: the simplicity of the unconditional sweep is worth more than the marginal safety of the timestamp boundary, especially given the `WHERE consentMode IS NULL` guard preserves operator-set values.
- ❌ **Missed the `consentReason` field**. The attestation columns capture WHO + WHEN; the WHY is necessary for audit (regulator: "why did this survey collect under implied consent") and was implied by the issue body's "with appropriate authorization" framing. The reviewer's three separate inline comments ("Ideally the override will also carry a reason", "It should also capture the reason", "And Survey.consentReason - the text used for override") made the gap unmissable.

### Phase 3: competitor-analysis
- ✅ Wrote an honest brief (Typeform / SurveyMonkey / Qualtrics XM / Medallia / Annex Cloud) instead of fabricating a deep matrix. Did not propose adding `competitors` to fraim/config.json. Round 1 didn't touch this section — appears the bar was met without the deep matrix.

### Phase 4: spec-completeness-review
- ✅ Cross-checked issue ACs against spec requirements; compliance + design-standards sections present. Did not catch the over-scope or the missing reason field.

### Phase 5: spec-submission
- ✅ PR #282 opened with the three open questions explicitly surfaced as decision points for the reviewer. This framing made round-1 fast — the reviewer answered Q1/Q2/Q3 inline + flagged the scope split + the missing reason field.

### Phase 6: address-feedback (round 1)
- ✅ All 11 review comments parsed and grouped: 9 substantive (scope, persona, reason field, Q3) + 2 confirmations (Q1, Q2).
- ✅ Wrote `docs/evidence/276-feature-specification-feedback.md` with each item marked UNADDRESSED, then ADDRESSED after fixes.
- ✅ Restructured the spec: removed Persona A walkthrough; added "Scope split" subsection; added `Survey.consentReason` to R1/R5/R6/R7/R8; flipped Q3 to unconditional sweep; updated mock with informational banner + reason textarea + audit-row reason.
- ✅ Posted 11 per-thread replies on PR #282, each citing commit `c9093fc` + a one-line resolution summary (per the L1 lesson "Reply on PR threads when addressing feedback").

## Root Cause Analysis

### 1. **Primary Cause: Scope inflation on a P0 hotfix**

**Problem**: Treated #276 as if it owned the full end-to-end UX, including the survey-editor consent panel. Should have recognized that #276 is a P0 hotfix focused on unblocking production, and that the survey-editor UX is a coherent surface owned by the in-flight #241 epic. The issue body cross-refs even named #241 as adjacent.

**Impact**: First draft of the spec contained a Persona A walkthrough (settings panel, modal, badge, revert button) plus a mock that read as a deliverable rather than informational. Required a major restructure on round 1 — Persona A removed, "Scope split" subsection added, mock relabeled with banner. Reviewer cost: one extra round of re-scoping that could have been avoided by reading #241 (and #277, the Organization Settings sibling) at context-gathering time and surfacing the scope question as a decision point in PR #282 itself.

### 2. **Contributing Factor: Missed the WHY/reason in the attestation surface**

**Problem**: The spec's R5 (attestation) captured WHO (`consentSuppressedAttestedBy`) and WHEN (`consentSuppressedAttestedAt`) but no WHY field. This is a complete-set design failure: the audit trail is incomplete without the reason. The issue body's "with appropriate authorization" framing implied an audit-quality bar that needed all three.

**Impact**: Reviewer flagged it three separate times (outcome bullet → modal step → schema column) before I had the full picture. Adding the field after the fact required rework across R1 / R5 / R6 / R7 / R8 plus the mock's modal + audit row. Cheaper to have surfaced "do we need a reason field?" as an explicit question in the original spec.

### 3. **Contributing Factor: Q3 framed safety as the deciding axis**

**Problem**: Q3's recommended answer (timestamp-bounded migration) was weighted against the unconditional sweep on the basis of "don't clobber deliberate post-#231 inherit choices." Missed that the `WHERE consentMode IS NULL` clause already preserves any operator-set value (the only thing the timestamp boundary protects against is a hypothetical post-#231 survey that intentionally inherits brand's EXPLICIT default — and even that survey is unblocked by the unconditional flip; the operator can post-hoc tighten via the override UI). The simplicity of the unconditional sweep was the better deciding axis.

**Impact**: Reviewer flipped to the alternative cleanly. Cost: one row in R7 + the validation-plan migration row. Low rework.

## What Went Wrong

1. **Over-scoped Persona A as a #276 deliverable instead of input to #241.** Should have read the parent epic and adjacent issues at context-gathering time; the cross-refs in the issue body were a hint I didn't follow.
2. **Missed `consentReason` as a first-class field.** Three reviewer pushes on the same theme = the field was not optional and should have been in the first draft.
3. **Q3 weighted safety over simplicity** without naming "simplicity" as a deciding axis.

## What Went Right

1. **Open-questions framing in PR #282 made round 1 fast.** Each of Q1/Q2/Q3 had a recommended + alternative + tradeoff laid out in a table; reviewer could answer with a 1-2 word reply per row ("Null is fine", "Reuse", "All Surveys across all organizations"). Two of three were confirmations.
2. **Per-thread PR replies posted at resolution time** — 11 of 11, each citing the resolving commit + a one-line summary. The L1 pattern fired correctly.
3. **Honest competitor brief, not padding.** Wrote a 5-row table with sourced rows + a "no fraim/config.json update proposed" justification. Round 1 didn't touch this section — the bar was met without the deep matrix.
4. **Two side-channel issues surfaced cleanly during prep**: #270 (closed via PR #280 earlier today) and #281 (filed today) — neither bundled onto #276 (R21 branch scope hygiene held).
5. **Recovered the dev DB without operator action** via `prisma migrate resolve --applied` and proceeded with #276 work without losing flow.

## What I Almost Did Wrong But Caught

1. **Near-miss: did not pad the competitor section**. First reflex was to fill in the matrix template with 10-20 competitor rows. Caught the L1 pattern "Overcorrected toward generating unnecessary artifacts on broad approvals" + project rule R3 (Feature Parity Trap) before going down that path. Wrote 5 rows with sources and an explicit "no fraim/config.json update proposed" justification. Reviewer did not push back.

2. **Near-miss: filing the #281 idempotency bug as part of #276**. The natural temptation was to "while we're here, fix the new one too" — but the L1 lesson "Committed an unrelated fix on an active feature branch" fired correctly. Filed #281 as its own issue, recovered the dev DB locally, kept the #276 branch clean.

## Where Past Learnings Actually Fired

1. **Pattern**: *Reply on PR threads when addressing feedback* (L1 mistake-pattern). 11/11 per-thread replies posted with the resolving commit hash and a one-line summary. No batched general comment.

2. **Pattern**: *Asserted facts about file/config contents without reading the primary source first* (L1 mistake-pattern). Read consentResolver.ts, public.ts, the actual schema for both Brand and Survey, and ran a Grep for usage of `consentSuppressedAttestedBy` before claiming the field was a placeholder. Did not assert anything that turned out wrong on round 1.

3. **Pattern**: *Branch scope hygiene — one issue per branch* (R21). Filed #281 separately during the dev-DB recovery; did not bundle the fix onto #276.

4. **Pattern**: *Decision-points-at-PR-body-bottom format for fast review* (L1 validated-pattern). Surfaced Q1/Q2/Q3 as a numbered table at the bottom of the PR body with recommended + alternative + tradeoff. Reviewer answered all three inline within the table itself; round 1 took ~17 minutes.

5. **Pattern**: *Overcorrected toward generating unnecessary artifacts on broad approvals* (L1 mistake-pattern). Did NOT generate a deep competitor matrix. Wrote a 5-row honest brief with sources.

## Lessons Learned

1. **For any feature spec, read the parent epic and adjacent siblings before drafting.** The cross-refs in the issue body are not cosmetic — they're a hint about scope ownership. On a P0 hotfix the temptation is to ship the smallest end-to-end thing; the safer move is to ship the smallest end-to-end thing *that respects existing scope ownership*. For #276, reading #241 + #277 at context-gathering would have prevented the Persona A over-scope.

2. **Audit trails need WHO + WHEN + WHY by default.** When designing an attestation surface for a "deviating from the default" decision, treat the reason field as a first-class column, not an optional add. The regulator-style question "why did this happen" is the load-bearing one; the WHO and WHEN are how you find the human, but the WHY is what you're auditing.

3. **For migration scope decisions, name simplicity as an axis explicitly.** The first instinct is to weight safety; on a recovery / hotfix migration, simplicity often wins because the safety guards (idempotency `WHERE` clauses, no-clobber semantics) already exist. Surface "simplicity vs marginal safety" as the deciding tradeoff in the open-questions table, not just "safety vs scope."

4. **Open-questions tables in PR bodies pay off.** The reviewer answered three open questions in 17 minutes by responding inline in the table. Without that framing, the same questions would have surfaced as freeform comments and required more back-and-forth.

## Agent Rule Updates Made to avoid recurrence

1. **None at the rules layer**. The over-scope and the missing-reason gap are at the spec-drafting layer (read sibling issues; design audit trails as WHO+WHEN+WHY tuples). Captured as L0 coaching moments below.

## Enforcement Updates Made to avoid recurrence

1. **L0 coaching moments to capture** (will be filed separately if not already):
   - `read-sibling-issues-before-spec-drafting` — read parent + adjacent issue cross-refs before defining scope.
   - `audit-trail-needs-who-when-why` — when designing an attestation surface for a policy deviation, the reason text is a first-class column.

2. **Spec-template improvement candidate**: the "Open Decisions Resolved" table should always include "simplicity vs safety" as a candidate deciding axis when the question is about scope or rollout. (Not making the change now; flagging.)
