# Meta-RCA Evidence: R7 audit incomplete despite R6 RCA

**Issue**: [#241](https://github.com/mathursrus/CustomerEQ/issues/241)
**PR**: [#314](https://github.com/mathursrus/CustomerEQ/pull/314)
**Workflow type**: Meta-RCA (RCA on the R7 audit that the R6 RCA was supposed to prevent)
**Author**: manohar.madhira@outlook.com
**Date**: 2026-05-11
**FRAIM job**: `analyze-why-you-messed-up` (second invocation)

---

## Summary

User asked for a meta-RCA: "do an RCA for why you messed up even after I asked you to check for some misses I identified and do an RCA." The R6 RCA had defined four preventive controls (CTRL-1–CTRL-4). The R7 audit applied **only CTRL-2 thoroughly**; CTRL-3 and CTRL-4 were applied only to the new sections (NFRs / Error States / Schema-API Summary) I was about to write, not retrospectively to the existing 300+ lines of spec. A retrospective sweep during the meta-RCA surfaced **9 concrete gaps** across 7 categories. All 9 are now fixed in commit `<this PR commit>`; four new preventive controls (CTRL-5, CTRL-6, CTRL-7, CTRL-2 amendment) are filed in raw learnings for `sleep-on-learnings` synthesis.

## Failure characterization

**Meta-failure**: Preventive controls defined as forward-looking actions ("before writing the sentence", "after each section is drafted") fire only on new content. When the user asks for a thorough audit, controls must be applied *retrospectively* across the entire existing document. The R7 audit followed the letter of the controls and missed the intent.

**Concrete gaps the retrospective sweep found (now fixed)**:

| # | Category | Gap | Fix |
|---|---|---|---|
| 1 | Epic AC traceability | AC-5 (rule-action picker contract) not mapped to coverage decision | New "Epic Acceptance Criteria — traceability map" table at top of FRs; AC-5 explicitly flagged as superseded by D14 (Rules tab deferred) with future commitment |
| 2 | Epic AC traceability | AC-6 (Survey.incentivePoints crediting) contradicted by D40 reversal | Same table; AC-6 explicitly flagged as superseded by D40; replacement criteria pointed to R22 |
| 3 | Internal contradiction | §4 said "applies any active campaign multipliers" but OQ3 says this is unresolved | §4 rewritten: campaign multipliers NOT layered in V0; pointer to OQ3 for RFC decision |
| 4 | Unverified assertion (CTRL-3 miss) | NFR-BC1 referenced `scripts/check-migration-idempotency.sh` which doesn't exist (same shape as the erasure-job miss in R6) | Verified `.github/workflows/ci.yml:75` is the actual gate (comment at L70-72 cites #270); NFR-BC1 updated with the real reference |
| 5 | Orthogonal axis (CTRL-4 miss) | R20: what happens when `EarningRule.pointsAwarded` changes after survey activation? | R20 extended with G/W/T: display reflects current rate at page load; already-credited rows retain original `pointsEarned` (no retroactive recalc) |
| 6 | Orthogonal axis (CTRL-4 miss) | R8: anonymous responses (`memberId IS NULL`) interaction with responsePolicy | R8 extended: anonymous responses bypass responsePolicy entirely (no member identity to enforce uniqueness against); G/W/T added |
| 7 | Orthogonal axis (CTRL-4 miss) | Schema deltas: brands with neither `Survey.incentivePoints` nor `EarningRule(triggerEvent='survey_completion')` | Schema deltas table extended with the no-op case |
| 8 | Orthogonal axis (CTRL-4 miss) | NFR-R2 covered request-retry idempotency but not pipeline resilience under worker downtime / queue backpressure | New NFR-R5: survey-completion event handles backpressure via existing BullMQ queue + DLQ; sync SurveyResponse write, async LoyaltyEvent; idempotency-key recovery |
| 9 | Ambiguous statement | NFR-S5 "IP (if available)" — vague language requirement-extraction skill warns against | NFR-S5 rewritten with definitive `requestIp` from `request.ip` + trust-proxy chain; null + structured-log warning fallback (never blocks audit row) |

**Plus mock-vs-spec parity** (CTRL-7 retrospective application — existing L1 memory at score 8.0 failed to fire in R7):
- Disclosure-text live char counter + maxlength=500 added to mock
- "Save failed — retrying…" indicator + recovery affordance added to Basics tab footer (with simulate buttons for reviewer)
- Embedded-mode member-ID pill now toggles to show the URL-missing-fallback state per R16

**Plus convergence vocabulary fix** (CTRL-2 amendment):
- Status changed from "Ready for review (R4 converged)" to "Ready for review (round 8 — RCA preventive controls applied retrospectively; awaiting reviewer signoff)"
- Decision Log footer changed from "Spec converged after 7 review rounds" to "Iteration history: R0–R8. Convergence is the reviewer's call"

## Root causes

1. **R6 controls were forward-looking only.** CTRL-3 "before writing the sentence", CTRL-4 "after each section is drafted" — both phrasings implicitly applied only to new content. When the user asked for "thorough audit", I needed retrospective application; the control text didn't tell me to.
2. **L1 memory at score 8.0 didn't drive behavior.** `feedback_audit_mock_vs_spec_at_every_round.md` was already in memory; still didn't fire in R7. Memory-channel reliability remains a known issue — same shape as the original R6 RCA's primary observation about the assertion-pattern memory.
3. **Epic-AC traceability had no control.** AC-5 and AC-6 slipped because no rule said "explicitly map every Epic AC to a section before declaring ready for review".
4. **Convergence vocabulary not addressed.** R6 controls defined 4 forward actions; didn't prohibit unilateral convergence claims. R4 and R7 both made the same mistake.

## New preventive controls (filed for `sleep-on-learnings` synthesis)

| Control | Trigger | Action |
|---|---|---|
| **CTRL-5** Retrospective sweep | User asks for audit / review / check | Apply CTRL-3 (grep for trigger phrases; verify each match) and CTRL-4 (walk every R# / NFR# asking "perpendicular axis?") to the **entire existing document** before adding new content |
| **CTRL-6** Epic AC traceability map | Before declaring any Epic spec ready for review | Write table mapping every AC in the Epic issue body to a covering R# / section / Decision Log entry; superseded ACs explicitly flagged |
| **CTRL-7** Mock-vs-spec parity sweep | After any spec content round | For each spec change describing a UI element / state / interaction, confirm mock reflects it OR write explicit "mock follow-up needed" callout |
| **CTRL-2 amendment** No unilateral convergence | Setting spec Status field while under review | Use "Iterating (round N)" or "Ready for review (round N — controls applied)" — NEVER "converged" until reviewer approves |

## Raw learning signals

Four files written under `fraim/personalized-employee/learnings/raw/` (no synthesis, per skill guardrail):

1. `manohar.madhira@outlook.com-2026-05-11T06-00-00-apply-controls-retrospectively-on-audit-requests.md`
2. `manohar.madhira@outlook.com-2026-05-11T06-00-01-epic-ac-traceability-map.md`
3. `manohar.madhira@outlook.com-2026-05-11T06-00-02-mock-spec-parity-sweep-at-spec-only-rounds.md`
4. `manohar.madhira@outlook.com-2026-05-11T06-00-03-no-unilateral-convergence-claim.md`

## Validation

**Verified before writing** (CTRL-3 applied properly this time):
- `.github/workflows/ci.yml:75` exists and contains `pnpm db:migrate` step; comment at L70-72 cites #270 as the regression-prevention rationale.
- `scripts/check-migration-idempotency.sh` does NOT exist (confirming the gap that needed fixing).

**Spec structure check** (after fixes):
```
grep -c "^## " docs/feature-specs/241-survey-admin-ux.md  → 14 H2 sections (matches expected: Customer/Outcome/Problem/UX/FRs/NFRs/Schema/Compliance/Validation/Alternatives/OOS/Competitive/Cross-refs/Appendix)
```

**Mock interactivity check**:
- Disclosure textarea has `maxlength="500"` attribute; counter element `#disclosure-counter` updates on input via `updateConsentPreview()`.
- Basics tab footer has `[simulate save-fail]` button calling `simulateSaveFail()` which flips indicator to danger state with `[recover]` affordance.
- Embedded preview pills are clickable (`onclick="toggleEmbeddedFallback(this)"`) and reveal hidden `data-fallback="true"` block.

## Ownership

This was my miss, twice over:
1. **R7 misapplication of controls**: applied forward-only when user's "thorough audit" required retrospective application.
2. **R6 control authorship gap**: defined controls without explicit retrospective scope.

The 9 spec gaps are now fixed; the 4 new controls cover the meta-cause. No deflection — the user's ask was unambiguous; my interpretation was narrow. **The pattern of "controls fire only on new content, not on existing content" is now itself the corrective lesson** (CTRL-5).

---

🤖 Generated via FRAIM `analyze-why-you-messed-up` (second invocation). Meta-RCA + 4 raw learnings + 4 new preventive controls. Ready for `sleep-on-learnings` synthesis. **Convergence pending reviewer signoff** (per CTRL-2 amendment).
