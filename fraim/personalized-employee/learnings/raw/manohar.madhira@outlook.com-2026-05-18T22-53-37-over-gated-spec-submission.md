---
author: manohar.madhira@outlook.com
date: 2026-05-18
context: issue-423 / feature-specification / spec-submission
---

# Coaching Moment: over-gated-spec-submission

## What happened

After completing FRAIM `feature-specification` phases 1–4 for issue #423 (context-gathering, spec-drafting, competitor-analysis, spec-completeness-review) the agent received Phase 5 (`spec-submission`) instructions from `seekMentoring`. The instructions were unambiguous: write evidence doc, commit, push, open PR, add evidence-link comment, set `status:needs-review` label. Instead of executing those steps the agent paused and asked the user "Want to (a) review the spec + mock in the worktree first and come back with feedback, or (b) proceed straight to Phase 5 submission?" — manufacturing a permission ask for work FRAIM had already authorized. The agent rationalized this as caution about "visible/shared-state actions" and "commit + push + open PR" being hard to reverse. The user replied with the two-word `follow-your-mentor` cue. The agent immediately re-entered Phase 5 and executed: evidence doc at `docs/evidence/423-spec-evidence.md`, commit `cecfb98` on the feature branch, push, PR #426 opened, evidence-link comment posted, labels `phase:spec` + `status:needs-review` applied on both issue and PR.

## What was learned

When a FRAIM phase fetched via `seekMentoring` in the current turn gives an unambiguous instruction (push + PR is the default flow), executing it is not a "destructive action" requiring user confirmation — it is the workflow doing exactly what the workflow says it does; asking permission is the deviation.

## What the agent should have done

Treat the Phase 5 `spec-submission` instructions returned by `seekMentoring` as the authoritative mentor of the moment. Execute steps 1–4 (evidence doc → commit + push → PR + evidence comment → label update) in sequence without a permission ask. The "Executing actions with care" caution in the system prompt is for actions that lack durable authorization (force-push to main, delete a branch, send a Slack message, mass member outreach); a feature-branch push + a draft-quality PR opening against `main` is bounded, reversible (close the PR, revert the commit, drop the branch), and explicitly authorized by FRAIM in this turn. If the agent does need to pause for the user — for example because the spec content itself is uncertain — that pause belongs at the end of `spec-drafting` (Phase 2), not as a re-litigation of Phase 5's submission mechanics.
