---
author: manohar.madhira@outlook.com
date: 2026-05-14
context: issue-336
---

# Coaching Moment: mock-drift-is-my-responsibility

## What happened

After a session of repeatedly missing mock-fidelity details on Issue #336 PR #364 (verbiage of type cards, "Not sure which to pick?" affordance, numbered tabs, theme swatch cards, chrome toggle switches, question card chrome), and after I had asked the user "Two things I need from you before I start: confirm order, or tell me to merge B into A" and similar "want me to also fix the theme picker / chrome matrix / page header layout?" gate questions, the user issued a directive: *"I will now only test functionality and trust you to fix the mock to implementation drift after we have all functionality fixed."* Their manual-verification capacity is for functional correctness — not pixel-by-pixel mock comparison.

## What was learned

For UI work in this repo with an HTML mock under `docs/feature-specs/mocks/`, the agent owns closing mock-to-implementation drift end to end — the user owns functional verification. Asking permission per mock-deviation item ("want me to fix the theme picker too?") is the wrong shape; the answer is always yes and the asking itself slows the loop.

## What the agent should have done

Default plan for UX work in this repo: first close every functional defect the user reports, then **before** declaring done, run a self-driven mock-conformance sweep — open `docs/feature-specs/mocks/<issue>-*.html`, walk it end to end, and check every visible element against the implementation (headings, buttons, badges, helper text, layouts, numbered indicators, icons, hover / active / empty states, modals, tab nav footers, preview chrome, theme pickers, chrome matrices, banners, copy). Fix every diff. Don't ask "want me to also fix the X?" once functionality is settled — the user has pre-authorised this work. Surface a deviation only if it's genuinely infeasible (missing infra, blocked by another issue) with a specific alternative. Batch related changes together so the user can re-verify in one pass.
