---
author: manohar.madhira@outlook.com
date: 2026-05-05
context: issue-276 / feature-specification + technical-design / PR #282
---

# Coaching Moment: production-bug-fix-scope-minimum

## What happened

On a P0 production hotfix (issue #276 — pre-existing surveys broken by #231 PR1's `EXPLICIT` consent default), the spec round-1 draft included a full Persona A UI walkthrough (settings panel, attestation modal, audit-trail badge) for the survey-editor experience. The reviewer pulled that scope into #241 (Survey Admin UX epic) where the survey UX is owned end-to-end. Round 2 (the RFC) then re-imported the same shape: a full PATCH endpoint contract + audit-plugin extension + 422 contract + read-before-write `previousConsentMode` capture. Reviewer pulled THAT into #241 too with the exact same logic. Both expansions were cosmetic-future-proofing rather than what unblocks production. After round 2 the user wrote: *"for production bug fixes keep the scope very tight to fixing production. This overengineering of scope both in feature spec and in RFC wasted a number of hours of my review."*

The minimum scope that unblocks production was always: schema columns (so the migration can write them), data migration (the actual unblock), resolver change (so the new column affects production behavior). PATCH + audit + UI are downstream surfaces with a natural-owner issue (#241) that was already prioritized. The agent should have defaulted to that minimum from the spec onward and surfaced "should we also include X here?" as an explicit scope question rather than drafting it in.

## What was learned

For a P0 production bug fix, default scope is the smallest diff that makes the bug stop happening; any related surface that only gets called by a downstream issue's UI/API/etc belongs with that downstream issue, even if it feels "natural" to bundle with the data fix.

## What the agent should have done

At spec-drafting time on a P0 hotfix, write the Customer Problem section first, then enumerate **only** the requirements that, if absent, would mean production stays broken. For #276 that was: schema + resolver + migration. Anything that only enables a future UX surface (PATCH endpoint, attestation modal, audit-log payload, badge) goes in an "Out of Scope (deferred to #N)" section from the first draft, with a one-line rationale ("only the survey-editor UI in #N writes this column"), not buried in a Persona walkthrough that the reviewer has to surgically remove. Same discipline at RFC time: if the spec already deferred R5/R6/R8 to #241, the RFC must defer the corresponding technical surfaces (PATCH contract, audit-plugin extension) by default and only re-include them if the spec was wrong. Surface "should we include the PATCH here for completeness?" as an explicit Decisions-for-Reviewer question rather than just including it.
