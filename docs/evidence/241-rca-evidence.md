# RCA Evidence: Spec authorship misses on PR #314

**Issue**: [#241](https://github.com/mathursrus/CustomerEQ/issues/241) (Survey Admin UX Epic)
**PR**: [#314](https://github.com/mathursrus/CustomerEQ/pull/314)
**Workflow type**: RCA / coaching analysis
**Author**: manohar.madhira@outlook.com
**Date**: 2026-05-11
**FRAIM job**: `analyze-why-you-messed-up`

---

## Summary

Reviewer corrections on PR #314 came in two batches past the "R4 converged" claim. **R5** was a full architectural reversal (D40 — earning consolidation direction was flipped from `Survey.incentivePoints` canonical to `EarningRule(triggerEvent='survey_completion')` canonical). **R6** was 8 distinct catches across one review pass: FRAIM SHALL format missing, blank-disclosure handling wrong, non-existent erasure job referenced, member-ID capture missing entirely, internal-only variables in respondent variable picker, no audit log on state changes, weak Terms-URL conditional, off-template Competitive Analysis structure. The PR needed 2 additional commits (`b0bff81`, `23268bb`) past the claimed convergence.

This evidence document records the RCA, the immediate corrections applied, the process-level preventive controls defined, and the raw learning signals filed for `sleep-on-learnings` synthesis.

## Failure characterization

**Two distinct failure modes**, both surfacing on the same spec cycle:

### Failure mode A — Assertion errors (4 of 8 R6 misses + the D40 reversal)
Claims about platform state and data-model surface area written without primary-source verification.
- Claimed "existing `apps/worker` erasure job pattern" — no such job (#264 P1 tracks the unbuilt work).
- Listed `{{memberName}}` as a thank-you variable — name not guaranteed on Member record.
- Stated "disclosure text is always shown to the respondent" — blank is a valid setting for out-of-scope regions.
- D40 reversal — locked in the issue body's R0 direction as authoritative without surfacing the architectural choice as an Open Decision.

Recurrence of an existing L1 mistake-pattern at score 8.0: *"Asserted facts about file / config / external-state contents without reading the primary source first"*. Pattern is in memory; still firing.

### Failure mode B — Template-as-inspiration, not contract (4 of 8 R6 misses)
Working understanding of the FRAIM spec format but no submit-time compliance pass.
- Functional Requirements section absent from R0–R5 — described behaviors in prose §1–§7 sections instead.
- Competitive Analysis structured around my own framing instead of the FRAIM template's four-section shape.
- Member-ID capture missing entirely from §2.3 and the mock — focused on multi-channel abstraction, missed the response-form input axis.
- Survey-state audit-logging missing — added audit for consent-mode but didn't extrapolate the principle to other transitions.

## Root causes

1. **Trusted derived signals (architecture.md aspirational language) over primary sources (codebase / Prisma schema).**
2. **Treated issue-body design intent as binding rather than as a starting hypothesis** — D4 in R0 should have been Open Decision OD-N with two alternatives.
3. **Treated the FRAIM template as a reference document read at start, not a contract checked at submit.** Read `FEATURESPEC-TEMPLATE.md` during context-gathering; never returned to it at submit time.
4. **Didn't enumerate orthogonal axes per section.** Consent mode (axis) covered, but text-set/text-blank (orthogonal axis) missed; state-transition verbs covered, audit-logging missed; etc.
5. **Tried to do too much in one Write.** Rewrite + FRAIM-format-check + primary-source-verify + orthogonal-axis pass all in parallel; checklist work fits better as a separate pass.

## Immediate corrections (applied on PR #314)

| Action | Commit | Status |
|---|---|---|
| D40 architectural reversal: programs own earning, surveys consume (§2.4, §4, Migration, Alternatives, Decision Log) | `b0bff81` | ✓ Done |
| Mock points field switched to read-only inherit-row + program link | `b0bff81` | ✓ Done |
| R6 inline fixes (C1–C7): blank disclosure, #264 reference, preview-card empty state, Terms URL conditional, member-ID capture, variable picker cleanup, state-change audit logging | `23268bb` | ✓ Done |
| Functional Requirements section (R1–R28 SHALL + Given/When/Then + Open Questions OQ1–OQ3) added | `23268bb` | ✓ Done |
| Competitive Analysis restructured to FRAIM template (Configured + Additional + 3-subsection Positioning Strategy + Research Sources) | `23268bb` | ✓ Done |
| Decision Log entries D41–D46 added | `23268bb` | ✓ Done |
| Per-thread PR replies on all 7 inline comments + 1 conversation comment posted with SHA citations | n/a (gh api) | ✓ Done |
| PR description revised | n/a (gh pr edit) | ✓ Done |

## Process-level preventive controls

| Control | Trigger | Action |
|---|---|---|
| **CTRL-1** — Issue-body-direction Open Decision | Drafting R0 of any spec where the issue body contains strategic phrasings ("becomes the source of truth", "we eliminate X", "X is canonical", "consolidate to Y") | Surface as OD-N in the rough draft Decision Log with two alternatives + recommended option. Never lock direction from issue-body language alone. |
| **CTRL-2** — FRAIM template compliance pass at submit | Before declaring any FRAIM-job spec "converged" or pushing the spec commit | `get_fraim_file(FEATURESPEC-TEMPLATE.md)`; walk every prescribed section; verify presence + structure. Same discipline for `requirement-extraction` skill — produce SHALL + G/W/T + R-tags + Open Questions in initial draft. |
| **CTRL-3** — Primary-source verification before assertion | Any sentence containing "existing X" / "the X pattern" / "we have Y" / specific component name | Grep / Read / schema-check **before writing**. Architecture-doc claims are aspirational by default. |
| **CTRL-4** — Per-section orthogonal-axis pass | After each spec section is drafted | Name the axis covered; ask "what's the perpendicular axis?" 1-minute deliberate step per section. |

## Raw learning signals (for `sleep-on-learnings` synthesis)

Four files written under `fraim/personalized-employee/learnings/raw/`, one per distinct corrective pattern. No synthesis or scoring (per `capture-coaching-moment` skill guardrail).

1. [`...2026-05-11T05-37-30-issue-body-direction-as-open-decision.md`](../../fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-11T05-37-30-issue-body-direction-as-open-decision.md) — covers D40 reversal context.
2. [`...2026-05-11T05-37-31-fraim-template-compliance-at-submit.md`](../../fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-11T05-37-31-fraim-template-compliance-at-submit.md) — covers FRAIM SHALL + Competitive Analysis structure misses.
3. [`...2026-05-11T05-37-32-verify-platform-state-claims-against-primary-source.md`](../../fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-11T05-37-32-verify-platform-state-claims-against-primary-source.md) — covers the erasure-job and memberName assertions. **Recurrence** of L1 pattern at score 8.0 — likely promotion in next synthesis cycle.
4. [`...2026-05-11T05-37-33-enumerate-orthogonal-axes-per-section.md`](../../fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-11T05-37-33-enumerate-orthogonal-axes-per-section.md) — covers C1/C3/C5/C7 (blank disclosure, member-ID, audit-on-state, variables).

## Validation

- **Spec content verified**: `docs/feature-specs/241-survey-admin-ux.md` at commit `23268bb` contains the Functional Requirements section (28 rows R1–R28 + Open Questions block) and the FRAIM-templated Competitive Analysis (4 named sections including 3-subsection Positioning Strategy). Verified via grep:
  ```
  grep -c "^| \*\*R" docs/feature-specs/241-survey-admin-ux.md  → 28
  grep -c "^### Configured Competitors Analysis" → 1
  grep -c "^### Additional Competitors Analysis" → 1
  grep -c "^#### Our Differentiation" → 1
  grep -c "^#### Competitive Response Strategy" → 1
  grep -c "^#### Market Positioning" → 1
  ```
- **Per-thread replies verified**: 7 inline replies posted with `in_reply_to_id` matching original C1–C7 comment IDs. Conversation reply posted at `pull/314#issuecomment-4417841165`.
- **PR description verified**: `gh pr view 314 --json title` shows updated title; body reflects D40 reversal + D45 format additions.

## Ownership

This was my miss, in two distinct flavors. The reviewer's feedback was correct and well-scoped; the corrective controls above (CTRL-1 through CTRL-4) are mine to apply on every future spec. No deflection to architecture-doc framing, issue-body framing, or rewrite-volume — those are explanations of *why* the misses happened, not justifications.

---

🤖 Generated via FRAIM `analyze-why-you-messed-up` job. RCA + 4 raw learnings + 4 preventive controls. Ready for `sleep-on-learnings` synthesis.
