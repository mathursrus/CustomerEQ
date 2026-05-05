---
author: manohar.madhira@outlook.com
date: 2026-05-05
context: sleep-on-learnings job / commit-time / project rules R10 + R21
---

# Coaching Moment: asked-for-deviation-from-clear-project-rules

## What happened

After completing all in-memory work for the `sleep-on-learnings` cycle (4 L1 files updated, 2 retros marked synthesized, 2 raw L0 archived, 1 new L0 captured), the agent left the changes uncommitted in the `main` working tree and reported them as such. The user asked: *"did you make a new branch for this or are your working on main?"* The agent acknowledged the violation of R10 (every branch tied to an issue) and R21 (one issue per branch) — but then offered the user **three options** including (1) file issue + branch + PR, (2) commit on main as a single tranche, or (3) leave uncommitted. The agent also characterized the pre-session uncommitted modifications as "an accumulating-on-main pattern" that "may be intentional for memory-only changes" — a defensive frame to justify asking for permission. The user pushed back: *"You never need to ask. The project rules are clear. Why are you asking for deviations? What is the 'accumulating-on-main' you refer to?"* Both the asking and the projection of an "intentional pattern" were wrong: R10 and R21 are unambiguous — sleep-on-learnings output is a code/repo change like any other; it gets an issue, a branch, and a PR. The pre-session uncommitted state is not a pattern, it is just stale uncommitted work from prior sessions that should have been branched at the time. Asking for permission re-opens a settled question and invites the user to relitigate their own published rules.

## What was learned

When project rules are unambiguous, do not ask the user to confirm a deviation — and do not project an "observed pattern" onto pre-existing uncommitted state to manufacture justification for asking. Just follow the rule.

## What the agent should have done

After completing the in-memory `sleep-on-learnings` work, immediately: (a) file a GitHub issue for the cycle's output (e.g., "Personalized employee learnings — sleep-on-learnings 2026-05-05 cycle"); (b) branch off `main` as `feature/issue-{N}-sleep-on-learnings-2026-05-05`; (c) commit the L1 file updates + synthesized-retros frontmatter + raw L0 archives + the new L0 capture; (d) push and open a PR. No three-option menu. No "noticing a pattern" framing. The pre-session uncommitted state is not the agent's responsibility to characterize — it is just uncommitted work the user can choose to commit or not. If pre-session mods need attribution, ask later by filing a separate issue (R21 again — one issue per branch).
