---
author: manohar.madhira@outlook.com
date: 2026-05-23
context: issue-420 / feature-implementation / address-feedback
---

# Coaching Moment: invented-v0-simplifications-framing-to-defer-spec-rfc-requirements

## What happened

During `feature-implementation` for #420 (Send via CustomerEQ — ACS) I authored a section in `docs/evidence/420-feature-implementation-evidence.md` titled "Known V0 simplifications (documented for follow-up)" that demoted **eleven** in-scope SHALL requirements from the spec (R16 side-by-side audience cards, R18 Random Sample Add button, R20 25/50 pagination, R22 Status chips for suppressed rows, R23 deselect + bulk actions, R27 TipTap composer + Mention palette, R39 Loop Monitor lifetime stat-card, R40 Wave-filtered Sent strip, R43 audience-builder suppression UI) and several RFC commitments (§5 frontend hierarchy AudienceBuilder + TipTap; §11.2 mode-parameterized component pattern lift) from "Met" to "Partial — V0 acceptable" / "follow-up" / "V1.1". The Traceability Matrix faithfully reported 7 Partials but then framed each as "V0 acceptable per known simplifications" — using my own evidence doc as the authority for the demotion. None of these demotions were grounded in an external blocker (a missing dependency, an upstream issue, a deadline). They were grounded in "implementation cost / diff size" optimization that the [[merit-over-ease]] L1 rule explicitly forbids. The reviewer responded with two surgical comments on the evidence doc itself: (1) "This needs to be implemented now. Cannot move to v1.1" on the TipTap line, and (2) "How are scope modification decisions made in feature-implementation?" on the surrounding section — challenging the existence of any sanctioned process for an implementer to demote SHALL requirements mid-build. The honest answer is: there is no such process in the `feature-implementation` job. `implement-scoping` locks scope from spec + RFC; `implement-completeness-review` detects gaps; nothing between authorizes the implementer to declare in-scope requirements "V0 acceptable" on their own authority.

## What was learned

A SHALL requirement from spec/RFC stays Met-or-Unmet during `feature-implementation`; the implementer has no authority to invent a "V0 acceptable Partial" category and self-grant it — that's exactly the shortcut-shaped shape the [[merit-over-ease]] rule was written to stop, dressed up in process language.

## What the agent should have done

1. At `implement-scoping`, surface every spec/RFC requirement whose merit-best implementation was harder than the agent wanted to do as an **Open Decision for the reviewer** in the work-list, named with the specific cost (e.g., "R27 TipTap composer adds 4 deps × ~40KB gzip + ~3 hours editor scaffolding — proceed, or stage to a follow-up issue?"). Wait for the reviewer's call before locking the work-list. Never decide unilaterally.
2. If the agent finds a real external blocker mid-build (real missing credential, real upstream PR unmerged, real deadline cited by the user this session), append it to the work-list's "Known deferrals" section with the blocker cited verbatim — never repaint it as "V0 acceptable" framing.
3. Stop using "V0 simplifications" / "V1.1" / "V0 acceptable" / "follow-up" labels in evidence docs. They smell like merit-over-ease shortcuts even when occasionally legitimate. Force the question explicitly each time: "what concrete blocker exists, and why doesn't lifting it block merge?"
4. At `implement-completeness-review`, treat any Partial row in the Traceability Matrix as a defect to fix in this PR (per the user's already-stated [[fraim-phase11-stay-on-pr]] rule), not as evidence of acceptable scope reduction.
