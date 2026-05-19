---
author: swavak@gmail.com
date: 2026-05-03
context: issue-262
---

# Coaching Moment: spec-before-impl-on-external-data

## What happened

The user described a need to import historical survey data from clients into CustomerEQ. The agent proposed an architectural direction (CSV import pipeline with async queue processing) and the user said "yes." The agent immediately filed a GitHub issue, created a branch, and wrote ~600 lines of code across 10 files — schema migration, BullMQ queue, API routes, worker processor, and admin UI — all based on a hardcoded CSV column contract (`email`, `score`, `verbatim`, `completed_at`) that was never validated against real client data. The user caught this mid-stream and correctly pointed out that data from real tools (SurveyMonkey, Typeform, Qualtrics) would not match the assumed shape, that data cleansing and semantic normalization had not been considered, and that customer validation had not happened. The agent had ignored the explicit preference on file ("Approval Gates: Prefers plan approval before significant codebase mutation") and misread "yes to the direction" as "yes to skip the spec phase."

## What was learned

When a feature ingests external data of unknown shape, data format and mapping are blocking unknowns that must be resolved through a feature-specification conversation before any schema or API is designed.

## What the agent should have done

After the user said "yes, build it," the agent should have asked 2–3 grounding questions about what tools clients use, what a real export looks like, and what "connect with future surveys" means in practice — then run the `feature-specification` job to produce a written spec with explicit data mapping assumptions — and only proceeded to `feature-implementation` after the user signed off on the spec.
