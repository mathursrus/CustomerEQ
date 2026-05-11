---
author: manohar.madhira@outlook.com
date: 2026-05-11
context: issue-241 spec authorship (PR #314, R7 meta-RCA — AC-5 and AC-6 slipped)
---

# Coaching Moment: epic-ac-traceability-map

## What happened

The #241 Epic issue body lists 7 Acceptance Criteria under "## Acceptance (epic-level)". The spec I wrote covered 5 of 7 cleanly through R1-R28 SHALL statements and §1-§7 UX prose. Two slipped: (a) AC-5 "Action-type dropdown contains only types that work end-to-end (others removed until built)" — my D14 deferred the Rules tab entirely from V0; spec never explicitly mapped this AC to my "no Rules tab in V0" decision so a reader can't tell if I addressed it or missed it. (b) AC-6 "Setting `Survey.incentivePoints` credits the configured currency on response submission via programs/campaigns; the `survey_completion` EarningRule path is gone" — directly contradicted by D40 reversal (now `incentivePoints` is dropped and `survey_completion` EarningRule is canonical); spec does not flag that this AC is superseded so a future reader could think it's unmet. Discovered during the R7 meta-RCA retrospective sweep. Neither slip would have happened with a deliberate AC-traceability pass.

## What was learned

The Epic issue body's "Acceptance" section is the authoritative scope statement of the feature; every AC must be explicitly mapped to a covering R# / section / decision in the spec, or flagged as superseded by a specific Decision Log entry — implicit coverage is invisible to the reviewer.

## What the agent should have done

Before declaring any Epic spec ready for review, write an explicit Acceptance Criteria traceability table near the top of the Functional Requirements section: column A = AC text (verbatim from issue body), column B = covering R# / section, column C = note (e.g., "covered", "superseded by D40 — see Decision Log", "delegated to sub-issue #234"). For #241 specifically, the table would have made AC-5's delegation to a future Rules-tab sub-issue explicit and AC-6's D40 supersession unmistakable. The pass is mechanical (~10 minutes for a 7-AC Epic); it permanently eliminates the "did this AC get addressed?" review question.
