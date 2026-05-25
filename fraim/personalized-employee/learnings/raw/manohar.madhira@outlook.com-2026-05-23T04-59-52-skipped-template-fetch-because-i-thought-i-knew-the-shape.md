---
author: manohar.madhira@outlook.com
date: 2026-05-23
context: issue-420 / technical-design phase 7 address-feedback
---

# Coaching Moment: skipped-template-fetch-because-i-thought-i-knew-the-shape

## What happened

In the #420 technical-design phase, I drafted the RFC at `docs/rfcs/420-send-via-customereq-acs.md` directly — using a structure I "knew" was right from #378 and prior RFC patterns — without first fetching `templates/specs/TECHSPEC-TEMPLATE.md` as the `design-authoring` phase Step 4 explicitly instructs. Result: the Round-1 RFC shipped missing **four** template-required sections:

1. **Confidence Level** (0–100 with rationale) — template line *"On a scale of 0 to 100, how confident are you that your solution will work?"*
2. **Spike Findings** (when applicable, with What-was-spiked / Findings / Design Impact) — template requires this whenever uncertainty exists, even just to declare "no spike needed and here's the ambiguities table that justifies it"
3. **Validation Plan** (user-scenario × expected-outcome × validation-method table) — template line *"Table with following columns: User Scenario / Expected outcome / Validation method"*. I labeled my §7 "Validation Plan" but it was actually the Test Matrix.
4. **Observability** (logs, metrics, alerts) — template's final section. Pieces were scattered through the RFC (the `email.sender_domain.fallback` warn log, `managed_email.send_attempt` audit, BullMQ retry counters mentioned in D5) but never consolidated.

The reviewer surfaced #1 and #2 in Round 2 review with *"I don't see a confidence score and any spikes needed. The whole section seems missing."* and prompted the RCA. I then discovered #3 and #4 during the RCA scan.

## What was learned

When a FRAIM job's phase instructions name a template file (`templates/specs/TECHSPEC-TEMPLATE.md`), fetch the template *before* drafting the artifact — not as a check-against after the fact. "I know what an RFC contains from prior repos" is a low-effort proxy that substitutes general familiarity for the specific contract this project's TECHSPEC defines. Confidence Level, Spike Findings, Validation-Plan-as-user-scenario-table, and Observability are project-specific contract items that don't appear in generic RFC templates I've seen elsewhere — but they're explicit in this template and the reviewer relies on them.

This is the same low-effort-proxy shape as [[hallucinated-claims-without-codebase-verification]] (R6: substituted assumed codebase state for grep) and [[precedent-as-recommendation-without-tradeoff-analysis]] (Round 2: substituted precedent for pros/cons analysis). Same fix shape: don't substitute the proxy for the source. The source here is the template file; the proxy was prior-RFC familiarity.

## What the agent should have done

- At the start of `design-authoring`, before any RFC drafting: call `get_fraim_file({ path: "templates/specs/TECHSPEC-TEMPLATE.md" })` and structure the RFC headings **directly from the template**. Any section absent in my draft that exists in the template = a flag, even if I "know" it's not needed (e.g., Observability for a feature with audit + 1 warn log still warrants the section, even just to declare what's there).
- Same shape for every FRAIM phase whose instructions cite a template/skill/rule file: `feature-specification` cites `templates/specs/FEATURE-SPEC-TEMPLATE.md`, `feature-implementation` will cite an implementation template, etc. Fetch first, draft second.
- Forcing function for next session: at the start of any FRAIM-phase artifact authoring, list the templates the phase instructions name + fetch each one before writing anything. Make the fetch step a literal todo item in the task list, not an "I'll skim if needed" intent.
- The evidence document had `technical-spike: N/A (Skipped — no high-uncertainty items)` — that's workflow-phase scaffolding, not a substitute for the RFC's §9 Spike Decision. The RFC is the persisted artifact the reviewer reads; the evidence doc is internal. Don't conflate "phase outcome captured in workflow evidence" with "section present in the deliverable."
