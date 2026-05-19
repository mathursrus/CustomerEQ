---
author: manohar.madhira@outlook.com
date: 2026-05-19
context: issue-423 / feature-specification / phase-7-retrospective handoff
---

# Coaching Moment: rule-26-violation-worktree-cleanup-suggestion

## What happened

At the end of the FRAIM `feature-specification` job for #423 (Phase 7 complete, PR #426 ready for merge), I closed the session summary with this guidance to the user:

> *"Closing the worktree is up to you when you're ready (`git worktree remove "C:/Github/mathursrus/CustomerEQ - Issue 423"`). The new technical-design session can start fresh from `main` after PR #426 merges, or operate on the same feature branch — your call."*

The user replied *"Haven't you read Project Rules?"* — pointed correction. The guidance violates **Rule 26 (One PR Per Phase Artifact)** in `fraim/personalized-employee/rules/project_rules.md`, which mandates:

> *One issue number `{N}` spans spec → RFC → impl → Phase 13 (retro + work-list cleanup) → coaching-moment capture. One isolated worktree (`{REPO} - Issue {N}`). One feature branch. Each phase artifact ships in **one PR** … **Sub-PRs within a single issue continue on sub-branches off the feature branch in the same worktree — never in spawned chore worktrees.***

Specifically: technical-design is the next phase artifact of issue #423, NOT a new issue. It rides in the **same worktree** on a **sub-branch off the existing feature branch**, shipping as a separate PR. Telling the user to close the worktree and "start fresh from main" was three errors compounded: (a) the worktree must persist across all phase artifacts of the issue, (b) the next session must NOT prep a new worktree, (c) any framing of "after PR #426 merges" implied the spec PR is a gate for the next phase when in fact the RFC sub-branch cuts from the feature-branch HEAD and ships independently.

## What was learned

End-of-phase handoff guidance is exactly where Rule 26 violations leak in — the "everything's done, ready for the next session" moment is when I reach for a clean-state mental model that contradicts the one-issue-one-worktree-many-PRs discipline.

## What the agent should have done

End the `feature-specification` job summary with explicit Rule 26 handoff instructions:

1. **Keep the worktree** at `C:/Github/mathursrus/CustomerEQ - Issue 423`. It persists across every phase artifact of #423 — spec, RFC, impl, Phase 13 retro.
2. **Do NOT run `prep-issue.sh` for #423 again.** The worktree, feature branch, and PR already exist.
3. **For the RFC**: cut a sub-branch off the existing feature branch HEAD (e.g., `feature/423-rfc-…`), draft `docs/rfcs/423-survey-response-review-v1.md`, open a separate PR against `main` so the RFC diff is reviewable in isolation. The sub-branch inherits the spec via its parent so the RFC PR doesn't gate on #426 merging.
4. **work-completion job runs once at the very end** (after the last phase artifact ships), handling `resolution-merge` → `resolution-verification` → `resolution-cleanup` for the whole issue.

The coaching-moment capture for this miss rides on PR #426 per Rule 26 itself — no chore-issue split, no spawned worktree.
