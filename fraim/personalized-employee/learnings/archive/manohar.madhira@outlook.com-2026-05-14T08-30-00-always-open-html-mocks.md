---
author: manohar.madhira@outlook.com
date: 2026-05-14
context: issue-336
---

# Coaching Moment: always-open-html-mocks

## What happened

During Phase 12 manual verification of PR #364 (Issue #336 Slice 4b), I built the Survey Type cards in BasicsTab from spec prose plus an Explore-agent's summary of `docs/feature-specs/mocks/241-survey-admin-ux.html` rather than opening the mock file directly. I produced cards that read "NPS — Net Promoter Score — 0 to 10" instead of the mock's iterated verbiage ("NPS · Net Promoter — Loyalty health — would you recommend us? — 1 standard question + 1 follow-up"), used different icons, and omitted the "Not sure which to pick?" collapsible quick guide entirely. The user pushed back: *"Check the mock - For the exact verbiage for the NPS, CSAT, CES and custom and the included 'Not sure which to pick'. These were deliberately designed and iterated to get information and icons right. Why do you keep ignoring the mock? ... Please follow the mock exactly for layout, unless technically it is not feasible. Me pointing out mock deviations is waste of my time."* This was the third time in one session they had to correct me on mock fidelity (first: "Read the spec and mock"; second: "No Divergence - stay with spec and mock"; third: this).

## What was learned

When a feature has an HTML mock under `docs/feature-specs/mocks/<issue>-*.html`, the mock is the canonical source for verbiage, icons, layout, numbered tabs, helper text, and affordances — agent summaries of it always drop the microcopy and the deliberate affordances, and reconstructing UI from spec prose alone produces "almost right" output that the user has to point at one line at a time.

## What the agent should have done

Before writing any UI for a feature with a mock, open `docs/feature-specs/mocks/<issue>-*.html` directly with the `Read` tool and scan the relevant scene block. Match exactly: card labels, helper text, icons (the specific glyph, not equivalents), tab layout including numbered indicators, affordances like "Not sure which to pick?". After implementing, before declaring ready, re-open the mock and check the diff — if any of {card copy, icons, helper text, tab numbers, affordance buttons} differs from the mock, fix it before handing back. If the user says "same as &lt;other feature&gt;" (e.g. "tabs same as Program"), also open the referenced page's component and mirror that layout / component (`WizardStepper` for numbered tabs).
