---
author: sid.mathur@gmail.com
date: 2026-04-02
synthesized:
---

# Postmortem: Scratch-Off Card Implementation - Issue #84 + #82

**Date**: 2026-04-02
**Duration**: ~45 minutes (spec + design + implementation)
**Objective**: Scratch card campaign type + SDK formalization
**Outcome**: Success — spec, RFC, implementation, UI validation, zero feedback rounds

## Executive Summary

Delivered scratch_card as the second interactive campaign type, reusing ~80% of #83 patterns. Combined with #82 SDK formalization. Full spec-to-merge pipeline in one session. Key lesson: always run manual UI validation against real API before claiming done — first attempt hit a 500 error because the API was running from wrong workspace.

## Architectural Impact

**Has Architectural Impact**: Minor — renamed executeSpinWheel to executeInteractiveCampaign (shared handler for both types).

## What Went Right

1. **Pattern reuse was massive**: Spec took 15 min, design 10 min, implementation 20 min — vs ~3 hours for #83. The first interactive campaign established all patterns.
2. **Did manual validation this time**: After being called out on #83 for not testing, proactively ran the real app in Playwright and caught the 500 error before user found it.
3. **Shared handler refactor**: Renaming executeSpinWheel to executeInteractiveCampaign with parameterized prize/segment array was cleaner than adding a duplicate function.

## What Went Wrong

1. **API running from wrong workspace**: First manual test hit 500 because the API server was running from main workspace (which doesn't have scratch_card code). Had to kill it and restart from Issue 84 worktree. Should have started both web + API from worktree upfront.
2. **Prisma client stale**: Main workspace Prisma client didn't know about the `result` field until regenerated. This is a recurring issue with worktree-based development.

## Lessons Learned

1. **When testing worktree code, run ALL servers from the worktree** — not just the web frontend. The API must also run from the worktree for new endpoint code to work.
2. **Prisma client must be regenerated in whichever workspace the server runs from** after schema changes.

## Agent Rule Updates Made to avoid recurrence

No new rules — the "test real code" and "don't defer tests" learnings from #83 were applied correctly here.

## Enforcement Updates Made to avoid recurrence

No updates needed.
