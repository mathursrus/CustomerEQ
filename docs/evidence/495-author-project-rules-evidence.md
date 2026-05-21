# Issue #495 — author-project-rules Evidence

## Summary

- **Issue**: #495 — Adopt Draft-PR workflow: all FRAIM-phase PRs open as Draft; work-completion flips to Ready
- **Workflow type**: `author-project-rules` (FRAIM job)
- **Outcome**: New **Rule 28 — "PRs Stay Draft Until Work Completion (FRAIM-Tracked Issues)"** added to `fraim/personalized-employee/rules/project_rules.md`, plus a cross-reference bullet on Rule 10. `Last updated` header bumped to 2026-05-27.

## Rework note — reconciled with Rule 27 (Issue #498)

This branch was originally cut (2026-05-21) when the highest-numbered rule was 26, and it added the draft-PR rule as **Rule 27**. Before it merged, **Issue #498 / PR #499 landed its own Rule 27** ("Merging PRs — Draft PRs + Auto-Merge Workflow", 2026-05-22), claiming the Rule 27 slot. This branch was rebased onto current `origin/main` and reworked:

- **Renumbered** the draft-PR rule from 27 → **28** (no collision).
- **Stripped the now-duplicated mechanics** that #498's Rule 27 already covers (the auto-merge workflow description and the `gh pr merge` prohibition). Rule 28 references Rule 27 for those instead of re-explaining them.
- **Added an explicit reconciliation / override clause.** #498's Rule 27 frames draft as *recommended* (a CI-cost optimization) and explicitly *permits non-draft PRs* that auto-merge the moment CI passes. That permission has a latent conflict with Rule 26: a non-draft PR can auto-merge after the impl commit but **before** the Phase-13 retro / coaching-moment commits land. Rule 28 closes that gap — for FRAIM-tracked issues, draft is **mandatory** and the PR must not become Ready (and therefore must not auto-merge) until `work-completion`. Where the two rules conflict for a FRAIM-tracked issue, Rule 28 wins.

The unique normative core 495 was filed to add — mandatory draft, draft-until-all-phase-artifacts-land (Rule 26 binding), the review-scrutiny / one-shot-notification rationale, and the premature-Ready prohibitions — is preserved. It is exactly the half #498's Rule 27 does not cover.

## Work Completed

### Key files changed

- `fraim/personalized-employee/rules/project_rules.md`
  - Line 4: `Last updated` bumped to `2026-05-27`.
  - Rule 10: new bullet cross-referencing Rule 28 (and noting Rule 27 governs the underlying mechanics).
  - End of file: **New Rule 28 — "PRs Stay Draft Until Work Completion (FRAIM-Tracked Issues)"**. Sections: reconciliation lead (tightens Rule 27), lifecycle paragraph, *Creating the PR*, *Marking Ready-for-review*, *Forbidden*, *Why this rule exists*.

### Approach taken

`author-project-rules` job was the appropriate FRAIM entry point — this is a single repo-wide rule addition, not a feature implementation. The `feature-implementation` job (13 phases, includes implement-tests / implement-security-review / implement-regression) was considered and rejected because the change is docs-only and those phases are N/A.

The branch was rebased onto `origin/main` (36 commits behind at rework time) so it carries #498's Rule 27 and is mergeable. The rebase applied 495's original hunks cleanly, producing a duplicate `## 27`; the duplicate was resolved by renumbering to Rule 28 and reconciling against #498's Rule 27 as described above, then amended into the single branch commit.

### Validation completed

- `git status` in the worktree shows only the two expected changed files (`project_rules.md`, this evidence doc).
- Headings scan confirms exactly one `## 27` (#498) and one `## 28` (this rule); no duplicate.
- Rule 10 + Rule 27 + Rule 28 read cleanly together; Rule 28 cross-references Rule 26 (one-PR-per-issue), Rule 27 (mechanics it tightens), and Rule 25 (wait + verify) where the rationale connects.
- The auto-draft GitHub Action that #498 originally scoped (`auto-draft.yml`) was dropped on the GitHub Free plan, so there is **no automated enforcement** of draft state — the only enforcement is the rule text, and #498's Rule 27 makes draft merely "recommended". Rule 28 is the layer that makes it mandatory for FRAIM-tracked issues.

## Validation

### How validated

- **Behavior change**: Rule 28 forces `--draft` on every FRAIM-phase PR open and reserves the Draft → Ready transition exclusively for `work-completion`'s `resolution-merge`, which is also what arms #498's auto-merge. Concrete enforcement commands cited.
- **Non-redundancy (re-checked against #498's Rule 27)**: Rule 27 now *does* mention draft state — but as a *recommended* CI-cost optimization that permits non-draft PRs. Rule 28 is non-redundant because it (a) makes draft *mandatory* for FRAIM-tracked issues, (b) binds draft duration to Rule 26 (all phase artifacts must land before Ready), (c) supplies a distinct rationale (review scrutiny + one-shot `ready_for_review` notification), and (d) closes the auto-merge-before-retro gap Rule 27's permission leaves open. None of these are in Rule 27.
- **Enforceable**: All actions cite exact commands (`gh pr create --draft`, `gh pr ready`, `gh pr ready --undo`, `mcp__github__create_pull_request({ draft: true })`).
- **Aligned with repo reality**: With no auto-draft Action on the Free plan, agents create PRs manually; Rule 28 governs that exact surface and removes the "non-draft is fine" ambiguity Rule 27 left for FRAIM work.

### Dogfooding

The PR for this issue is **itself opened as Draft** and stays Draft until `work-completion` — the rule's first subject is the rule's own PR.

## Quality Checks

- [x] Single-rule scope (Rule 28 only).
- [x] No duplicate rule number (one `## 27`, one `## 28`).
- [x] Explicitly reconciled with the conflicting rule (#498's Rule 27) rather than silently contradicting it.
- [x] No aspirational language — every requirement maps to a runnable command.
- [x] Cross-references existing rules (10, 25, 26, 27) where overlap exists.
- [x] Follows file convention (numbered heading + bolded subsections + "Why this rule exists" closer).
- [x] `Last updated` header bumped.
- [x] All artifacts ride on a single PR per Rule 26.

## Phase Completion

| Phase | Status | Notes |
|---|---|---|
| `inventory-project-expectations` | ✅ complete | Single new rule, repo-wide scope; non-redundancy re-checked against #498's Rule 27. |
| `draft-project-rules` | ✅ complete | Rule 28 authored; reconciliation/override clause added vs Rule 27. |
| `validate-project-rules` | ✅ complete | Behavior-changing, non-redundant, enforceable, reconciled with Rule 27, aligned with repo reality. |
| `submit` | ✅ complete (this doc) | Evidence written; PR stays Draft per Rule 28. |

## Related artifacts

- Issue: https://github.com/mathursrus/CustomerEQ/issues/495
- PR: #496 (Draft)
- Reconciled-with: Issue #498 / PR #499 (Rule 27 — auto-merge workflow)

## Non-FRAIM provenance note

The issue body captures the late filing of issue #495 (the in-conversation rule edit was begun on `main`). A coaching-moment will be captured in Phase 13 of `work-completion` for this Rule 10 violation, and will ride on this same PR per Rule 26.
