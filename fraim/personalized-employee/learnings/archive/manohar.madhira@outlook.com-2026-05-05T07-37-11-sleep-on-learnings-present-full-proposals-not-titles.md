---
author: manohar.madhira@outlook.com
date: 2026-05-05
context: sleep-on-learnings job / review-pending phase
---

# Coaching Moment: sleep-on-learnings-present-full-proposals-not-titles

## What happened

In the `review-pending` phase of `sleep-on-learnings`, the agent presented the 11 proposals as a compressed summary list — entry titles + 1-line gist + "see the L1 file for full text" — instead of inlining the full proposed entry bodies in the chat. The user pushed back: *"normally you list the proposals here for my review."* The agent had written full final-format bodies into each L1 file's `## ⏳ Pending Review` section (per the skill's end-of-day half), but failed to INLINE those bodies into the chat for the start-of-day review half. The skill literally describes the start-of-day output as "the full proposed entry text ready to approve" — the user should not need to open 4 files to evaluate 11 proposals. The summary form forced the user to either trust the agent's compression or open each file to verify.

## What was learned

In `sleep-on-learnings` review-pending, present each full proposed entry inline in chat (not compressed titles + 1-liners), so the user can approve/edit/reject without leaving the chat surface or opening L1 files.

## What the agent should have done

When entering review-pending, paste each proposed entry's full body inline in the chat — copy from the `## ⏳ Pending Review` section the agent just wrote, with light grouping (per file) and clear approve/edit/reject prompts at the end. The user already accepted writing them to files (end-of-day half); the inline presentation is the start-of-day half's purpose. If the proposal set is large enough that pasting all bodies would exceed comfortable scroll length, batch by file (`mistake-patterns first` → ask → `validated-patterns next` → ask) — but never collapse to titles-only. The skill's `When context = "start-of-day"` step 3 is explicit: "For each proposal, present it clearly and ask for a decision."
