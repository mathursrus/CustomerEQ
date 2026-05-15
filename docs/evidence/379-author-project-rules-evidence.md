# Issue #379 — `author-project-rules` Evidence

## Summary

**Issue**: #379 — `project-rules: add Rule 26 (One PR Per Phase Artifact) + extinguish "chore-issue" split fabrication pattern`
**Workflow**: `author-project-rules` (Phases: inventory-project-expectations → draft-project-rules → validate-project-rules → submit)
**Branch**: `feature/379-project-rules-add-rule-26-one-pr-per-phase-artifact-extinguish-chore-issue-split-fabrication-pattern`
**Worktree**: `C:/Github/mathursrus/CustomerEQ - Issue 379`
**Base**: `main` (commit `96334de`)

Adds a single project-wide rule (Rule 26) plus the supporting agent-side artifacts (mistake-pattern, rejected-proposal, retrospective correction footers, auto-memory + cross-link) so the "fabricated chore-issue framing" failure shape is extinguished for every agent in this repo, not just one user-pairing.

## Work Completed

### Centerpiece — Rule 26 in `project_rules.md`

`fraim/personalized-employee/rules/project_rules.md` — added Rule 26 "One PR Per Phase Artifact (No 'Chore-Issue' Splits)" at line 195 (file grew from 193 → 228 lines).

Rule structure:
1. **Default topology**: one issue / one isolated worktree / one feature branch / one PR per phase artifact; merge + cleanup via `work-completion`.
2. **Forbidden patterns**: 4 named negative-example PRs (#345, #350, #355, #373) + 4 forbidden phrases (*"chore-issue for #N"*, *"Phase 13 cleanup chore-issue"*, *"chore-issue body"*, *"Follows the convention used by [other chore PRs]"*).
3. **Allowed exceptions (3)**: post-merge regression (with merge SHA + signal citation), off-scope unrelated fix (per Rule 21), ops artifact outside original ACs. Each requires written reason in PR body.
4. **Cited authority**: verbatim quotes from FRAIM `issue-preparation` Phase 1 Step 5 (*"Do not fall back to manual in-place branch creation"*), Phase 2 Step 4 (*"Do not hand-roll git branch steps"*), and the Phase 1–2 outcomes naming *"an isolated issue worktree"* and *"feature branch exists, is checked out in the isolated worktree."*
5. **Why this rule exists**: evidence + cost framing (four worktrees for one CI/CD workstream; two on-disk retros encoded fabrication as a "win").
6. **Priority order (root-cause fix)**: FRAIM-verified-this-turn > Default > Unverified paraphrase.

### Ancillary edits (riding on same branch per Rule 26 itself)

| File | Change |
|---|---|
| `fraim/personalized-employee/learnings/manohar.madhira@outlook.com-mistake-patterns.md` | New `[P-HIGH]` entry "Fabricated 'chore-issue' framing to split phase artifacts across PRs" (score 30.0 matching cross-repo synthesis); cites all evidence PRs + #343→#347→#349→#351 chain + adjacent signal from sid.mathur 2026-04-07 raw L0. |
| `fraim/personalized-employee/learnings/manohar.madhira@outlook.com-rejected-proposals.md` | New `[P-HIGH-REJECTED-AS-LEGITIMATE]` entry under `## 2026-05-15` listing the forbidden phrases; instructs sleep-on-learnings to skip future L0s matching this shape and treat distinct shapes (e.g. "Phase 8 findings deserve their own issue") as fresh L0s. |
| `docs/retrospectives/manohar.madhira@outlook.com-issue-343-...-postmortem.md` | Appended `## Correction (2026-05-15, per Rule 26)` footer reframing the "filed chore issue (#349) + branch + PR for the retrospective" entry on line 193 as a violation. Names the missed third option: push the retro commit to `feature/343-...` (the impl branch). |
| `docs/retrospectives/manohar.madhira@outlook.com-issue-335-...-postmortem.md` | Same correction footer reframing the "chore-issue #354 body" references on lines 230, 256. Clarifies that the [[feedback-show-artifact-before-publishing]] memory firing was correct on its own terms, but the action it fired on (creating issue #354) was the underlying violation. |
| `~/.claude/projects/C--Github-mathursrus-CustomerEQ/memory/feedback_one_pr_per_phase_artifact.md` (new) | Cross-session fast-recall memory pointing at Rule 26 + listing forbidden phrases + 5-step "how to apply" procedure + `[[fraim-phase11-stay-on-pr]]` cross-link. |
| `~/.claude/projects/C--Github-mathursrus-CustomerEQ/memory/MEMORY.md` | Index pointer added for the new memory. |
| `~/.claude/projects/C--Github-mathursrus-CustomerEQ/memory/feedback_fraim_phase11_stay_on_pr.md` | Appended "Broader rule" footer linking forward to `[[one-pr-per-phase-artifact]]` so the narrower Phase-11-specific memory points at the broader rule. |

## Validation

### Rule-file integrity
- `project_rules.md` total: 228 lines (was 193).
- Rule 26 placement: line 195, after Rule 25.
- No conflicts with R10 (one issue per branch), R21 (unrelated-scope splits — cited as exception path), R24 (FRAIM mandate — R26 enforces a default R24 implies), R25 (operational discipline — sister rule).

### Anti-recurrence layer check
| Layer | Channel | Reach | Confirmed |
|---|---|---|---|
| Repo-wide rule | `project_rules.md` Rule 26 | Every FRAIM-equipped agent in this repo | Yes — file edited |
| Synthesized learning | `mistake-patterns.md` + `rejected-proposals.md` | sleep-on-learnings cycle | Yes — both files edited |
| Retro contamination cleared | Correction footers on retros #343 + #335 | Future agents reading those retros for context | Yes — both footers appended |
| Personal fast-recall | `feedback_one_pr_per_phase_artifact.md` + cross-link from `feedback_fraim_phase11_stay_on_pr.md` | This user-pairing across sessions | Yes — auto-memory written, MEMORY.md indexed, Phase-11 memory cross-linked |

### Execution self-check against Rule 26
This PR itself respects Rule 26:
- One issue (#379), one worktree (`Issue 379`), one feature branch, one PR (this one).
- The temptation to split "rule edit" from "retro corrections" from "auto-memory updates" into a "chore-issue trio" was the exact failure shape the rule extinguishes — and was deliberately resisted as the test case for whether the rule has teeth.

## Feedback History

N/A — first PR submission for this issue. Feedback file (`docs/evidence/379-author-project-rules-feedback.md`) will be created if reviewer items emerge during PR review.

## Quality Checks

- [x] Centerpiece rule added with verbatim FRAIM citation + named negative examples + 3 named exceptions
- [x] Mistake-pattern entry cites all evidence PRs (#345, #350, #355, #373) and the #343→#347→#349→#351 chain
- [x] Rejected-proposal entry blocks future re-synthesis with explicit forbidden-phrase list
- [x] Both retro correction footers reference Rule 26 by number and explain *why* the original framing was wrong, plus name the missed correct action
- [x] New auto-memory created with `[[fraim-phase11-stay-on-pr]]` cross-link; existing Phase 11 memory cross-links forward to `[[one-pr-per-phase-artifact]]`; MEMORY.md indexes the new memory
- [x] All artifacts ship in one PR on one branch in one worktree

## Phase Completion

- Phase 1 (inventory-project-expectations): complete — gap analysis vs. R10/R21/R24/R25 confirmed Rule 26 fills an orthogonal slot with no conflicts.
- Phase 2 (draft-project-rules): complete — rule body written using the structural pattern shared with R16/R25 (default + forbidden + exceptions + authority + why + priority order).
- Phase 3 (validate-project-rules): complete — concision, redundancy, and enforceability all passed.
- Phase 4 (submit): in progress — this evidence doc + commit + push + PR + labels.
