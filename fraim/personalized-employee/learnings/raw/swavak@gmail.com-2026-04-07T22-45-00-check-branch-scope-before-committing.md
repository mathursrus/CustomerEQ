---
author: swavak@gmail.com
date: 2026-04-07
context: issue-80
---

# Coaching Moment: check-branch-scope-before-committing

## What happened

After a session resumed mid-spec for Issue #80, the agent found untracked #80 spec files on disk and immediately staged and committed them to the current branch (`feature/79-impl-survey-trigger-wizard`) without checking whether that branch was the right scope for the new issue's work. The user pointed out that the #79 branch should have been left alone after #79 was complete, and a new `feature/80-...` branch should have been created before any #80 commits were made.

## What was learned

On session resume, always verify the current branch name and confirm it matches the issue being worked on before making any commit.

## What the agent should have done

Before committing any #80 artifacts, run `git branch` to check the current branch, recognise it belongs to #79, then create `feature/80-response-to-action-rule-builder` from `main` and commit the #80 work there.
