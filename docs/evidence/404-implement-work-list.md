# Implementation Work List — Issue #404

**Issue**: [#404](https://github.com/mathursrus/CustomerEQ/issues/404) — Reword Rule 26: "one PR per phase artifact" is misleading
**Branch**: `feature/404-reword-rule-26-one-pr-per-phase-artifact-is-misleading-should-be-all-artifacts-ship-in-one-pr-per-issue`
**Worktree**: `C:/Github/mathursrus/CustomerEQ - Issue 404`
**Issue type**: feature (documentation-only — rule wording correction)

## Context

Rule 26 in `fraim/personalized-employee/rules/project_rules.md` was authored in PR #380 (issue #379) to extinguish "chore-issue" fabrication splits. The PR #380 body's prose described the correct invariant — *"every phase artifact within a single issue rides on one branch + one PR in one isolated worktree"* — but the rule text that landed drifted to the literal phrasing *"one PR per phase artifact"*, which reads naturally as "split each phase into its own PR" — the exact anti-pattern Rule 26 was authored to prevent.

User memory of the #379 design confirms this drift: the design talked about *"all phase artifacts ride on one PR"*; the merged text reads *"one PR per phase artifact"*.

Triggered by PR #385 round 3 (issue #378), where the agent read the rule literally and proposed splitting trigger-endpoint retirement into a chore-issue + chore-PR — exactly the fabrication Rule 26 was meant to prevent. Coaching moment captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-17T07-44-28-code-changes-in-spec-phase-pr.md`.

## Scope

### In-scope edits

1. **`fraim/personalized-employee/rules/project_rules.md`** — Rule 26 wording correction (5 locations):
   - [ ] Line 195 — section heading
   - [ ] Line 197 — intro sentence "one PR per phase artifact within that issue"
   - [ ] Line 203 — load-bearing rule "Each phase artifact ships in **one PR**"
   - [ ] Line 221 — "per-phase-artifact PR cadence"
   - [ ] Line 227 — priority-order default "one issue / one branch / one PR per phase artifact"
   - [ ] NEW companion paragraph — "How to read Rule 26" — explicitly state the topology in prose so future agents can't misread

2. **`fraim/personalized-employee/learnings/manohar.madhira@outlook.com-mistake-patterns.md`** — line 32 (Default-when-FRAIM-is-silent priority entry under the chore-issue-fabrication mistake-pattern):
   - [ ] Reword to match corrected Rule 26 phrasing

3. **Evidence doc** — `docs/evidence/404-implement-evidence.md` (will be created at submission)

### Sweep — confirmed in-scope after triage

A `grep` for `one PR per phase|phase artifact|per-phase-artifact|phase artifacts` across the repo found 6 locations beyond `project_rules.md`:

| File | Lines | Triage |
|---|---|---|
| `docs/retrospectives/...issue-343-...postmortem.md` | 259, 261 | **Out of scope** — references "phase artifacts" in the context of describing the *failure* (correctly). Pointer to `[[one-pr-per-phase-artifact]]` auto-memory is an external-memory pointer; renaming that file is user's off-repo concern. |
| `docs/retrospectives/...issue-335-...postmortem.md` | 270, 283, 285 | **Out of scope** — same as #343 retro: describes the failure, not the correct state. Auto-memory pointer left alone. |
| `fraim/personalized-employee/learnings/manohar.madhira@outlook.com-rejected-proposals.md` | 26 | **Out of scope** — references the mistake-pattern entry title, which accurately describes the *wrong behavior* (splitting). Not the misread vector. |
| `fraim/personalized-employee/learnings/manohar.madhira@outlook.com-mistake-patterns.md` | 9 (title), 26, 32, 35 | **Line 32 in scope** (Default-when-FRAIM-is-silent description — reinforces the misread); lines 9 (entry title) / 26 (describes the failure) / 35 (auto-memory pointer) accurately describe the wrong behavior — out of scope. |
| `docs/evidence/336-feature-implementation-evidence.md` | 6 | **Out of scope** — historical evidence doc using "phase-by-phase artifacts" generically (not the Rule 26 phrasing). |
| `docs/evidence/379-author-project-rules-evidence.md` | 7, 20, 31, 37, 69 | **Out of scope** — historical evidence doc of the prior rule-authoring PR; revisionist to edit after merge. |

### Out of scope

- PR #380 title ("Rule 26 — One PR Per Phase Artifact + extinguish chore-issue fabrication") — already merged; immutable.
- The off-repo auto-memory file `~/.claude/projects/.../memory/feedback_one_pr_per_phase_artifact.md` — user's local Claude memory; not under this repo's purview.
- Renaming the `[[one-pr-per-phase-artifact]]` auto-memory pointer — same as above.
- The "Fabricated 'chore-issue' framing to split phase artifacts across PRs" mistake-pattern title (line 9) — accurately describes the *wrong behavior*; the title using "phase artifacts" is descriptive of what gets split, not prescriptive of what should be split.

## Validation Requirements

- [ ] `uiValidationRequired`: **false** (documentation-only edit; no UI)
- [ ] `mobileValidationRequired`: **false**
- [ ] **Validation method**: re-grep for the misleading phrasings in `project_rules.md` after edits; verify the rule's behavior intent is preserved (one issue / one branch / one PR, multiple phase-aligned commits); confirm no test surface needs to be touched.
- [ ] **Test surface**: none — no code change. Validation is by re-grep + read-through of the new wording.

## Open Questions

None at scoping time. The user's directive in chat is clear; the issue body's proposed reword is concrete and accepted as the basis for the edits.

## Forward-references for Phase 13 / coaching capture

- This PR's retro should note: the original rule's wording was the load-bearing artifact for the chore-issue-fabrication-extinction rule, but its phrasing self-invited the misread. The lesson — **when a rule is authored to prevent a fabrication pattern, double-check that the rule's own wording isn't ambiguous in the direction of the pattern it's preventing.**
