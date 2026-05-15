---
author: manohar.madhira@outlook.com
date: 2026-05-11
context: issue-241 spec authorship (PR #314, R6 conversation-level review)
---

# Coaching Moment: fraim-template-compliance-at-submit

## What happened

On PR #314, after declaring the spec "Ready for review (R4 converged)", the user asked at R6: *"Why are requirement not as SHALL statements as required by FRAIM? Competitor analysis also doesn't seem to match FRAIM's standard."* The spec had described behaviors only in narrative §1–§7 sections — no Functional Requirements section with SHALL + Given/When/Then + traceability tags, and no Open Questions block. The Competitive Analysis section had an off-template structure (Industry shape + Positioning + Sources) instead of FRAIM's prescribed four-section shape (Configured Competitors Analysis + Additional Competitors Analysis + Competitive Positioning Strategy with three named subsections + Research Sources). I had read `templates/specs/FEATURESPEC-TEMPLATE.md` and `skills/<…>/requirement-extraction.md` during context-gathering, but did not run a compliance pass against them before submission. R6 required a substantial retrofit: a 28-row SHALL table + a full Competitive Analysis restructure.

## What was learned

FRAIM template compliance must be a submit-time verification pass, not a draft-time recollection. Reading the template once at context-gathering and shaping the spec from memory produces off-template output. The template is the contract; the prose explains *why*.

## What the agent should have done

Before declaring any FRAIM-job spec "converged", run a compliance pass: re-open `templates/specs/FEATURESPEC-TEMPLATE.md` via `get_fraim_file`, walk every prescribed section, and verify the rewritten spec contains each section by name with the prescribed structure. Specifically: a Functional Requirements section with SHALL + Given/When/Then + R-tags + Open Questions; a Competitive Analysis section with Configured + Additional + three-subsection Positioning Strategy + Research Sources. The pass is ~5 minutes and catches the entire R6 conversation-level miss. Apply to `requirement-extraction` skill the same way: read it, draft SHALL statements from R0, don't retrofit.
