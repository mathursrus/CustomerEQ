---
author: manohar.madhira@outlook.com
date: 2026-05-27
context: issue-495 / author-project-rules (pre-issue) → work-completion
---

# Coaching Moment: rule-edit-begun-on-main-before-issue-filed

## What happened

For issue #495 (a project-rules change), I began editing `fraim/personalized-employee/rules/project_rules.md` directly in the `main` worktree, in-conversation, **before any GitHub issue existed and before a feature branch / isolated worktree was created**. This violates Rule 10 ("File the issue first, then branch"; "Never commit directly to `main`") and the per-issue topology in Rules 21 and 26 (one isolated worktree + feature branch per issue, created by `~/.fraim/scripts/prep-issue.sh`).

No commit ever landed on `main` — the working-tree diff was caught and `git stash`ed before any commit, then issue #495 was filed, `prep-issue.sh 495` created the `feature/495-…` worktree, and `git stash apply` reattached the diff there. So the damage was contained to working-tree state, not history. But the work was *started* in the wrong place, and only luck (catching it before `git commit`) kept it from polluting `main`.

## What was learned

The trigger that should fire is: **"I'm about to edit a tracked file as task work" → first confirm "is there an issue + feature branch + isolated worktree for this?"** If not, stop and run `issue-preparation` (file issue → `prep-issue.sh` → branch in worktree) **before the first edit**. Editing in the `main` worktree is never the starting move — not even for a one-line docs / rule change that "feels trivial."

This is a **"smallness" trap**: the change felt small (a single rule addition), and small changes are exactly when the file-issue-first discipline gets skipped. Rule 21 is explicit — *"Unrelated fixes — even small ones — get their own issue and branch."* Size is not an exemption; a rule-only edit is still task work.

Same shape as prior coaching moments where the workflow's prescribed first move was skipped in favor of acting directly:
- `code-changes-in-spec-phase-pr` — put work in the wrong phase/place rather than where the workflow specifies.
- `self-imposed-pause-mid-phase-instead-of-following-fraim-flow` — substituted my own judgment for the FRAIM job's prescribed flow.
- **This one** — substituted "just start editing" for "file the issue and branch first."

## What the agent should have done

- At the first signal that this is task work (not a throwaway exploration), run `issue-preparation`: file the issue, let `prep-issue.sh` create the isolated worktree + feature branch, then make the first edit there. The branch/worktree must exist **before the first keystroke into a tracked file**.
- If an edit has already begun on `main` (as here), the recovery is exactly what was done: `git stash` (never `git commit` to `main`) → file the issue → `prep-issue.sh` → `git stash apply` in the new worktree. The right lesson, though, is to not need the recovery.
- Capture the slip as a coaching moment (this file) and let it ride on the issue's PR per Rule 26 — which is why this lands as a commit on `feature/495-…` before `work-completion` flips the PR to Ready, not as a separate chore-issue.
- `sleep-on-learnings` should synthesize this with the two related slugs above under the shared shape *follow the workflow's prescribed first move before acting directly*.
