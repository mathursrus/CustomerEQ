---
author: manohar.madhira@outlook.com
date: 2026-05-23
context: issue-420
---

# Coaching Moment: mocks-are-not-summarizable-design-artifacts

## What happened

During Phase-12 address-feedback Item-M on Issue #420 / PR #497, the mock-walkthrough audit found 8 substantial mock surfaces missing from implementation across Scenes 3/4/5 of `docs/feature-specs/mocks/420-send-via-customereq-acs.html` — including the live email preview pane (mock lines 747–800), the SELF_SERVE confirmation modal (mock lines 818–833), the MANAGED_EMAIL centered confirm modal with summary block (mock lines 835–849), the Sending-state progress bar copy (mock line 948), the CSV preview pane (mock lines 900–911), and the auto-appended footer preview (mock lines 740–744). The Item-M audit was the first time across all of #420's commits that the mock was walked end-to-end; every prior commit during Items A–E + C/D/D.2 had read only the scenes touching that item's surface and treated the rest as summarizable / referenceable on demand. The user corrected with: *"you mess up on this repeatedly — never reading the mocks. Mocks are design artifacts — you cannot just summarize them to get a gist."* The user then escalated the RCA over four iterations: (1) my initial framing pointed at implementer reading-behavior; (2) user pushed it upstream to spec-authoring incompleteness; (3) user pushed further to the spec-finalize step being the gap origin; (4) user pushed further to the spec FORMAT being inherently drift-prone because prose AND R-statements describe the same behavior in parallel — and added that the `feature-specification` job's first-pass output on #420 contained no R-statements at all (the R1–R45 list was only produced when the user explicitly asked). The structural fix was filed as FRAIM issue #473 (job-template restructure to brief-prose + scene-by-scene R-statements + mock-to-R cross-reference table as `spec-finalize` precondition + R-granularity rule rejecting compound SHALLs at author-time).

## What was learned

Mocks are non-summarizable design artifacts — every visual element must either trace to an R-statement or be explicitly marked "design-only"; treating mocks as reference documentation to consult per-surface, and accepting prose-only spec affordances as deliverable, manufactures the gaps that appear at PR review.

## What the agent should have done

Before the first code edit on any UI-touching issue, read the spec mock end-to-end (every scene, every line) — not "skim scene anchors and titles" and not "read the scenes for the surfaces I'm about to touch." During the spec phase (or, retroactively, at the start of implementation), build a mock-to-R cross-reference table mapping every mock line/element to either an R-id or an explicit "design-only, no SHALL" marker — refuse to call `spec-finalize` complete if the table has holes. When an R-statement compounds multiple sub-clauses (e.g., R32: `modal with shape A + summary B containing audience count + common fields + composer values + warnings`), split it into independently-traceable sub-R-numbers at author-time so each sub-clause has its own evidence point. Treat spec prose as orientation only, not as a deliverable: only R-statements are SHALL, prose is not.
