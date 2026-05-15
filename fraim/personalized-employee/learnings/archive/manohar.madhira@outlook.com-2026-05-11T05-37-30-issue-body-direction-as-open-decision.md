---
author: manohar.madhira@outlook.com
date: 2026-05-11
context: issue-241 spec authorship (PR #314, R5 reversal)
---

# Coaching Moment: surface-issue-body-direction-as-open-decision

## What happened

On PR #314 (Issue #241 Survey Admin UX spec), I locked in D4 in the rough draft based on the issue body's R0 framing: *"Survey.incentivePoints becomes the single source of truth: when set, it credits via the program / campaign pipeline directly."* I treated this as the authoritative direction and built the entire spec around it through four review rounds. At R5, the user issued a complete architectural reversal: "Survey.incentivePoints is NOT the single source of truth. Earning consolidates to programs-only and earning rule has to be triggerEvent='survey_completion'. The points shown in the mock at Points and Thank you should come from the program & campaign point evaluation for survey completion." The reversal required a full rewrite of §2.4, §4, the migration plan, and the alternatives section. The user said this was "a major miss".

## What was learned

Strategic-direction language in an Epic issue body (especially phrasings like "becomes the source of truth", "we eliminate X", "X is canonical") is the user's *starting hypothesis*, not a finalized design — it must be surfaced as an Open Decision in R0 with at least two alternatives + a recommended option, even when the issue body sounds decided.

## What the agent should have done

In the R0 rough draft Decision Log, list D4 as an Open Decision (OD-1):

> **OD-1**: Earning-consolidation canonical path — (A) `Survey.incentivePoints` is canonical (per issue body) vs. (B) program's `EarningRule(triggerEvent='survey_completion')` is canonical, survey reads from it. **Recommended: (B)** — programs own earning configuration per the loyalty-domain RBAC split; surveys consume earning configuration. Issue body's language was the user's starting hypothesis; flag for confirmation before locking the spec.

Trigger: any Epic-issue body containing words like "becomes the source of truth", "we eliminate X", "X is canonical", "consolidate to Y" — surface as OD-N in R0 with two alternatives. Cost of asking is small; cost of building four rounds on the wrong direction is large.
