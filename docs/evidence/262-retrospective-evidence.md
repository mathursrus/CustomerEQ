# Evidence: Issue #262 — analyze-why-you-messed-up

**Issue**: #262 — Historical survey data import  
**Workflow**: coaching / analyze-why-you-messed-up  
**Date**: 2026-05-03

---

## Summary

The agent jumped directly into full implementation of issue #262 without running `feature-specification` first. The user caught this mid-stream. This document records the retrospective and the corrective actions taken.

---

## Work Completed

### Root Cause Analysis (Phase: analyze-gap)

**Failure**: Agent began full implementation (schema migration, BullMQ queue, API routes, worker processor, admin UI — ~600 lines across 10 files) after user said "yes" to an architectural sketch, without validating data format assumptions or running `feature-specification`.

**Root causes identified**:
1. Wrong FRAIM job selected — `feature-implementation` used instead of `feature-specification`
2. Misread "yes to direction" as "yes to skip the discovery/spec phase entirely"
3. Ignored explicit preference on file: *"Approval Gates: Prefers plan approval before significant codebase mutation"*
4. Never surfaced the blocking unknown: what does real client export data actually look like?

**Impact**: ~600 lines of code written against wrong assumptions (hardcoded CSV columns that will not match SurveyMonkey/Typeform/Qualtrics exports); branch and migration that need cleanup; user had to intervene mid-stream.

---

### Coaching Moment Recorded (Phase: document-learnings)

**File**: `fraim/personalized-employee/learnings/raw/swavak@gmail.com-2026-05-03T00-00-00-spec-before-impl-on-external-data.md`

**Learned**: When a feature ingests external data of unknown shape, data format and mapping are blocking unknowns that must be resolved through `feature-specification` before any schema or API is designed.

---

### Corrective Actions Executed (Phase: fix-it)

| Action | Status |
|--------|--------|
| Updated `swavak@gmail.com-preferences.md` — added explicit rule for external-data features | Done |
| Recommended abandoning `feature/issue-262-historical-survey-import` branch without merging | Communicated |
| Redirected issue #262 to `feature-specification` job as next step | Communicated |

---

## Validation

- Coaching moment file written to `fraim/personalized-employee/learnings/raw/`
- Preferences file updated with two new rules (approval gates clarification + external data gate)
- Both files ready for synthesis by `sleep-on-learnings`

---

## Next Steps

1. Abandon or stash current implementation branch
2. Run `feature-specification` for issue #262 — start with discovery questions about real client data formats
3. Re-implement only after spec is approved by user
