---
author: sid.mathur@gmail.com
date: 2026-04-07
context: issue-113 / analyze-why-you-messed-up
---

# Coaching Moment: dont-split-pr-without-confirmation

## What happened

While moving issue `#113` from spec into technical design, the agent created a new design PR (`#115`) instead of updating the existing user-watched PR (`#114`). The user then pointed out that they could not see the RFC in PR `#114`, which exposed that the agent had changed the review artifact without confirming that a stacked PR was actually desired.

## What was learned

When a user is already reviewing a specific PR, preserve that PR as the canonical review thread unless the user explicitly approves splitting the work into another PR.

## What the agent should have done

The agent should have updated PR `#114` directly with the RFC, or stopped and asked before creating a second PR so the review flow stayed aligned with the user's expectation.
