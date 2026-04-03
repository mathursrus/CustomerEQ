---
author: sid.mathur@gmail.com
date: 2026-04-03
context: issue-85 / feature-implementation
---

# Coaching Moment: preview-must-match-campaign-type

## What happened

The admin campaign builder's live preview panel showed the scratch card preview for mystery box campaigns because both types shared the same `(isScratchCard || isMysteryBox)` condition. Additionally, the scratch card preview was a static colored div instead of an interactive canvas like the HTML mock. E2E tests only checked that a preview element existed, not that it showed the correct content for each campaign type.

## What was learned

When adding a new variant to a shared UI pattern, test that the variant-specific content renders correctly — not just that a container exists. Preview panels must show content matching the selected campaign type.

## What the agent should have done

1. Added a separate mystery box preview (gift box visual) instead of reusing the scratch card preview
2. Made the scratch card preview interactive (canvas-based) like the HTML mock
3. Written E2E tests that verify preview content changes when switching between action types
