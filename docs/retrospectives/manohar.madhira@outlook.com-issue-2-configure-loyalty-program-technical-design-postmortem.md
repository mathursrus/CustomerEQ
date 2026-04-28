---
author: manohar.madhira@outlook.com
date: 2026-03-27
synthesized: 2026-04-27
---

# Postmortem: Configure Loyalty Program Technical Design - Issue #2

**Date**: 2026-03-27
**Duration**: ~2 sessions spanning 2026-03-26 to 2026-03-27
**Objective**: Produce a complete RFC for [UC-09] Configure Loyalty Program covering schema, API, worker, and UI changes — including architecture gap analysis and design evidence
**Outcome**: Success — RFC merged into PR #22, all open decisions resolved, technical design phase complete

---

## Executive Summary

The technical design for Issue #2 (Configure Loyalty Program) was completed across two sessions. The RFC (`docs/rfcs/2-configure-loyalty-program.md`) covers all 33 spec requirements, introduces 5 schema model changes, 9 API groups, worker rule evaluation engine upgrades, and a 7-step wizard UI with a site-wide shared component library. Architecture gap analysis identified 6 missing patterns and 2 open decisions; both were resolved by the reviewer within the same session. Context compaction between sessions caused loss of the FRAIM session ID and some in-progress state, but recovery was smooth.

---

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: Architecture doc not yet updated (documented as a gap in RFC Section "Patterns Missing from Architecture") — updates are deferred to the implementation phase per RFC

**Changes Made**:
- Identified 6 patterns missing from `docs/architecture/architecture.md`: shared UI component library placement, multi-step wizard auto-save pattern, pagination envelope standard, simulation dry-run endpoint pattern, scheduled soft-expiry pattern, program-level budget enforcement in worker
- Identified 2 patterns incorrectly followed: retire endpoint (fixed to use DELETE), packages/ui placement (deferred to Phase 2)

**Rationale**: RFC-stage gap analysis is preferable to architecture doc updates — the doc should be updated at implementation time when code evidence exists, not at design time

**Updated in PR**: No — architecture doc updates deferred to implementation phase

---

## Timeline of Events

### Phase 1: context-gathering
- ✅ Read 8 key files: schema.prisma, programs routes, worker loyaltyEvents.ts, shared Zod schemas, globals.css, architecture.md, feature spec, project rules
- ✅ Read interactive mock `2-view.html` to understand full wizard UX
- ✅ Identified existing patterns to follow and gaps to fill

### Phase 2: design-rfc
- ✅ Drafted full RFC with schema changes (5 model updates, 3 new models, 3 new enums)
- ✅ Designed 9 API groups following REST patterns and existing conventions
- ✅ Specified worker rule evaluation engine upgrade (priority, stackable, budget caps)
- ✅ Designed 7-step wizard file structure with useReducer auto-save pattern
- ✅ Identified 10 shared UI components for site-wide design system
- ✅ Documented architecture gap analysis with 6 missing + 2 incorrectly followed patterns

### Phase 3: design-completeness-review
- ✅ Created `docs/evidence/2-design-evidence.md` with full traceability matrix (33 requirements)
- ✅ 32/33 requirements fully met; 1 partial (pagination backfill — open decision)
- ✅ 6 architectural gaps documented with proposed resolutions
- ✅ 2 open decisions surfaced for reviewer (OD-1: packages/ui vs apps/web; OD-2: pagination backfill scope)

### Phase 4: design-submission
- ✅ RFC committed and pushed (`25b922c`)
- ✅ PR #22 comment posted with design summary and open decisions
- ✅ Issue #2 labeled `status:needs-review`

### Phase 5: address-feedback (round 1)
- ✅ Reviewer answered OD-1: keep in apps/web, backlog Phase 2 migration
- ✅ Reviewer answered OD-2: backfill existing list endpoints at the same time
- ✅ RFC updated (`dfaba64`): decisions documented, pagination backfill added to Implementation Order
- ✅ Backlog issue #34 created for Phase 2 packages/ui extraction
- ✅ Threads replied to; summary PR comment posted

---

## Root Cause Analysis

### 1. Context Window Compaction Between Sessions
**Problem**: Session context was compacted, losing the FRAIM session ID and some in-progress state (design-completeness-review had been started but the evidence file not yet written).
**Impact**: Required re-connecting FRAIM, re-reading the RFC and spec to reconstruct context, and re-running seekMentoring to determine current phase. Added ~15 minutes of recovery overhead.

### 2. Evidence Directory in .gitignore
**Problem**: `docs/evidence/` is in `.gitignore`, which was not known until after writing `2-design-evidence.md`. The file exists on disk but cannot be committed.
**Impact**: Evidence file cannot be reviewed via PR. Reviewers must trust the agent's summary in PR comments rather than reading the evidence document directly.

---

## What Went Wrong

1. **Session interruption lost FRAIM state**: The design-completeness-review phase was interrupted by context compaction. This required manual reconstruction of current FRAIM phase from the summary, which was accurate but added recovery time.

2. **Evidence directory gitignored**: Did not check `.gitignore` before creating `docs/evidence/2-design-evidence.md`. The file is useful locally but not in the PR review flow.

3. **Two-section numbering collision in RFC**: The RFC contained two sections both numbered "2a" (Member model + Program model). This was a drafting error that would cause confusion during implementation. The content is correct but the numbering is inconsistent.

---

## What Went Right

1. **Thorough context gathering before design**: Reading 8 files before writing the RFC avoided common pitfalls — the `brandId`-from-JWT pattern, existing soft-delete approach, BullMQ vs direct DB split, and current rule evaluator behavior were all captured correctly.

2. **Architecture gap analysis was complete and actionable**: All 6 gaps had concrete proposed resolutions and were framed as "missing from architecture" vs "incorrectly followed" — making it easy for the reviewer to act on each.

3. **Open decisions surfaced cleanly**: By surfacing OD-1 and OD-2 explicitly with recommended options in the PR comment, the reviewer could respond with one-line answers rather than having to engage in back-and-forth discussion. Both were resolved in a single round.

4. **Backlog issue filed proactively**: Created #34 for Phase 2 packages/ui extraction without being asked, which gives the team a concrete artifact to act on and avoids the decision being forgotten.

5. **Pagination backfill decision immediately integrated**: OD-2 (backfill existing endpoints) was captured not just as a comment but as a concrete step (4a) in the Implementation Order section of the RFC — ensuring it can't be missed during implementation.

6. **`Member.currentTierId` gap caught during review**: The traceability matrix process caught that "tier removal blocked if members in tier" had no implementation path (Member model had no `currentTierId`). This would have been a blocker discovered at implementation time.

---

## Lessons Learned

1. **Check .gitignore before writing evidence files**: Run `grep -r evidence .gitignore` at the start of any phase that writes to `docs/evidence/`. If gitignored, summarize evidence in the PR comment directly rather than filing the document and referencing it.

2. **Save FRAIM session ID to a scratchpad at session start**: Context compaction is unpredictable. After calling `fraim_connect`, note the session ID in a temporary local note so it can be recovered without re-connecting in a new session.

3. **Verify RFC section numbering before submission**: Simple sequential numbering errors (two "2a" sections) are easy to make during drafting and easy to catch with a quick read-through. Add a final self-review pass on section numbering before committing.

4. **Surface open decisions with recommended options**: The reviewer answered OD-1 and OD-2 in a single round because each had a recommended option (`← recommended`). Decisions framed as binary choices with a recommended default require minimal reviewer effort.

5. **Pagination backfill decision has downstream scope**: When a new API pattern (pagination envelope) is introduced that applies to existing endpoints, the RFC should explicitly list which endpoints are in scope. The reviewer's answer here ("update existing at the same time") has implementation cost implications that should be flagged in the Implementation Order.

---

## Agent Rule Updates Made to avoid recurrence

1. **Pre-evidence-write**: Always `grep docs/evidence .gitignore` before writing to `docs/evidence/`. If gitignored, embed evidence summary in the PR comment body instead of referencing a file path.

2. **RFC self-review checklist**: Before committing an RFC, verify: (a) section numbers are sequential and unique, (b) all `⚠️ Decision needed` items are documented as open decisions, (c) new patterns introduced are listed in Architecture Gap Analysis.

---

## Enforcement Updates Made to avoid recurrence

1. **FRAIM session recovery**: When resuming from a compacted context, the first tool call should be `fraim_connect` to obtain a fresh session ID. Do not attempt `seekMentoring` without a valid session ID — it will fail silently or with confusing errors.

2. **Traceability matrix as mandatory output**: The design-completeness-review phase must produce a traceability matrix before advancing. The matrix reliably surfaces gaps (as it did for `Member.currentTierId`) that pure design review misses.
