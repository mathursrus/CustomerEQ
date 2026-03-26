---
author: sid.mathur@gmail.com
date: 2026-03-26
context: surveys feature — ui-polish-validation + user-testing-and-bug-bash
synthesized:
---

# Retrospective: Surveys UI Polish & Bug Bash

## What Went Well
- Found and fixed 2 P0 crashes before they could reach production (TypeError on public survey page, missing auth headers on all admin pages)
- Comprehensive browser validation with Playwright caught real runtime issues that unit tests missed
- All 8 bugs fixed in a single session with zero regressions (124 tests still passing)
- Evidence captured systematically with screenshots at all breakpoints

## What Went Poorly
- Could not browser-test admin pages due to Clerk OAuth — Playwright can't complete Google OAuth sign-in flow
- Only NPS survey type tested because all test data was NPS; CSAT/CES/CUSTOM types remain untested in browser
- The public survey page crash (BUG-001) was a fundamental API contract mismatch that should have been caught during initial development

## Root Cause Analysis
- **BUG-001 (TypeError crash)**: The survey feature was built with an assumption about question type values (`nps`/`csat`/`ces`) that didn't match the actual API response (`rating`/`text`). The root cause is that the API stores questions with generic types while the frontend assumed survey-level type names. No integration test validated the full roundtrip.
- **BUG-002 (Missing auth)**: The survey admin pages were likely developed and tested without auth enforcement (during local dev). The existing admin pages (programs, campaigns, analytics) all follow the `useAuth`/`getToken` pattern, but survey pages were created without referencing that pattern.
- **BUG-003 (Shape mismatch)**: Prisma `include: { _count: ... }` returns a nested `_count` object, but the frontend was written expecting a flat `responseCount` field. This is a common Prisma gotcha when you don't have end-to-end type sharing.

## Key Learnings
- Always verify API response shapes match frontend interfaces before declaring a feature complete — a quick `curl` check would have caught BUG-001 and BUG-003
- When adding new admin pages, check existing pages for auth patterns rather than starting from scratch
- Playwright browser testing catches real issues that static analysis and unit tests miss (especially API contract mismatches)

## Prevention Measures
- Add a shared types package or API client that enforces response shapes at build time
- Create a "new admin page" checklist that includes: auth headers, API shape validation, all existing patterns (useAuth, error states, loading states)
- Seed CSAT, CES, and CUSTOM survey types in test data for broader coverage
- Consider adding a Clerk test account with email/password login for automated browser testing

## Process Improvements
- The FRAIM ui-polish-validation job was thorough but the 12-phase structure adds overhead when many phases have no findings. Consider allowing phase batching for clean results.
- Bug bash and UI polish validation overlap significantly — running them together (as done here) is more efficient than separately.
