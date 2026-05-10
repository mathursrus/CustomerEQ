# Feedback for Issue #291 — Technical-Design Workflow

## Round 1 Feedback

*Received: 2026-05-07T08:12:48Z*

### Comment 1 — ADDRESSED (architecture-doc edit)

- **Author**: rmadhira86
- **Type**: review_comment, [r3199895853](https://github.com/mathursrus/CustomerEQ/pull/295#discussion_r3199895853)
- **File**: `docs/rfcs/291-brandtheme-surveytheme-split.md`
- **Line**: 310 (the *Recommendation* paragraph in the Architecture Analysis section)
- **Comment**:
  > Agreed
- **Status**: ADDRESSED
- **How addressed**: Reviewer agreed to apply the architecture-doc edit on this branch rather than filing a separate issue. Concrete actions:
  - **Edited `docs/architecture/architecture.md` §3.4 Data Layer**: added a fourth bullet describing the hand-edited Prisma migration flow (`prisma migrate dev --create-only` + manual SQL edit), the canonical ordering (ADD → BACKFILL → DROP, with renames preceding backfills), and the in-tree reference examples (`20260430000000_patch_survey_distribution_gap/migration.sql` for partial-migration recovery via idempotent `DO $$ ... END $$` PL/pgSQL guards; `<timestamp>_brandtheme_surveytheme_split/migration.sql` for the rename + backfill + drop shape #291 introduces).
  - **Edited the RFC's Architecture Analysis Recommendation paragraph** to reflect that the doc edit landed in this PR. The paragraph now cites the resolving thread (`r3199895853`) and quotes the architecture.md addition.
  - The third candidate from the architecture-gap analysis ("public survey API select-set as a versioned contract") remains explicitly deferred per the original RFC framing — single-data-point pattern; promote only if a second renderer issue raises the same question.

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| One-word reviewer responses ("Agreed") on Recommendation paragraphs that surface a binary doc-update question are unambiguous and resolve in one round. The pattern of presenting the choice as "(a) add to this PR ← recommended / (b) file separate issue" with a reasoned default fired correctly here — sister-firing of L1 *"Open decisions framed with `← recommended` get one-round answers"* (P-HIGH 8.0). | No rule change — this is the pattern firing as expected. |
