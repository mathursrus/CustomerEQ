---
author: manohar.madhira@outlook.com
date: 2026-05-11
context: issue-241 spec authorship (PR #314, R7 meta-RCA — mock-spec memory at 8.0 still didn't fire)
---

# Coaching Moment: mock-spec-parity-sweep-at-spec-only-rounds

## What happened

R7 of the #241 spec added a Non-Functional Requirements section, Error States subsection, and several new UI behaviors: a live character counter on the disclosure-text override (per NFR-S3 + Error States table), a "Save failed — retrying..." auto-save indicator (per NFR-R3), an embedded-mode member-ID prompt-fallback state (per R16), and an audit badge for blank-disclosure surveys (per R13). None of these were added to the mock at `docs/feature-specs/mocks/241-survey-admin-ux.html`. The retrospective sweep during the meta-RCA caught all four. The existing L1 memory entry `feedback_audit_mock_vs_spec_at_every_round.md` at score 8.0 ("Spec text edits that have visual analogs require same-commit mock updates; sweep mock-vs-spec end-to-end before reporting any feedback round addressed") was supposed to fire here. It didn't.

## What was learned

A high-scored L1 memory entry is necessary but not sufficient to drive behavior change — the memory must be paired with an operational checkpoint that explicitly triggers it. For #241's R7 round, the trigger should have been "any new spec-side UI behavior requires a same-round mock update OR an explicit 'mock will follow' callout".

## What the agent should have done

At the end of any spec-content round, run a mock-vs-spec parity sweep: for each spec change in the diff, identify whether it describes a UI element / state / interaction; for each such item, confirm the mock at `docs/feature-specs/mocks/<issue>-*.html` reflects it in at least one scene. If the mock doesn't yet reflect it, either update the mock in the same commit or explicitly write a "Mock follow-up needed: <items>" callout in the spec status line. For R7 specifically, this would have caught all four parity gaps before submit. Make this an explicit checklist step at spec-round close, not a memory-fire-and-hope.
