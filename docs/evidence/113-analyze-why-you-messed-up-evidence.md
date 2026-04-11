# Issue #113 Coaching Evidence

## Summary

- Issue number and title: `#113` — Ingest reviews from social channels
- Workflow type: coaching / analyze-why-you-messed-up
- Brief description of work completed: analyzed the PR-flow mistake, captured a coaching moment, moved the technical RFC back into PR `#114`, and closed the unnecessary follow-on PR `#115`

## Work Completed

- Identified the failure precisely:
  - I created PR `#115` for the technical design instead of updating the existing user-watched PR `#114`
- Recorded the coaching moment in:
  - `fraim/personalized-employee/learnings/raw/sid.mathur@gmail.com-2026-04-07T19-05-00-dont-split-pr-without-confirmation.md`
- Executed corrective actions:
  - cherry-picked the RFC and design evidence onto `feature/issue-113-social-review-ingestion-spec`
  - pushed the spec branch so PR `#114` now contains the RFC and both design evidence files
  - updated PR `#114` body and added a comment making it the canonical review thread
  - commented on and closed PR `#115`

## Validation

- Verified PR `#114` is open and now includes the RFC/design deliverables
- Verified PR `#115` is closed
- Verified the PR `#114` body explicitly references:
  - `docs/rfcs/113-social-review-ingestion.md`
  - `docs/evidence/113-design-evidence.md`
  - `docs/evidence/113-technical-design-evidence.md`
- Verified the correction comment exists on PR `#114`

## Quality Checks

- All deliverables complete: Yes
- Documentation clear and professional: Yes
- Work ready for review: Yes

## Phase Completion

- `analyze-gap`: complete
- `document-learnings`: complete
- `fix-it`: complete
- `submit`: complete

## Preventive Controls

- If the user is already reviewing a specific PR, that PR remains the default review artifact.
- Do not create a new stacked PR without explicit confirmation from the user.
- Before opening a new PR for the same issue, check whether the user has already anchored review expectations to an existing PR.

## Remote Status

- Canonical PR: https://github.com/mathursrus/CustomerEQ/pull/114
- Closed corrective PR: https://github.com/mathursrus/CustomerEQ/pull/115

---

# Coaching Session 2: OAuth Flow False Validation (2026-04-08)

## Failure

OAuth authorize endpoint required Clerk JWT auth but was called via browser redirect (`window.location.href`), which cannot attach auth headers. Result: `401 "Authorization header is required"` when user clicked "Connect Google Account." Agent repeatedly claimed "validated" based on API-level curl tests that bypass Clerk auth.

## Root Causes

1. OAuth authorize route behind Clerk auth but accessed via browser redirect — architecturally impossible.
2. Validated via `curl` with `X-Test-Brand-Id` headers instead of actual browser user flow.
3. Playwright Clerk auth failures dismissed as "limitation" instead of signal about the real flow.

## Fix Applied

- Changed authorize endpoint to return `{ authorizationUrl }` JSON instead of 302 redirect.
- Frontend calls it via authenticated `fetch()`, gets URL, then redirects via `window.location.href`.
- Verified: API returns correct Google authorization URL with `client_id`, `access_type=offline`, signed state.

## Preventive Controls

- Added project rule #18: "Validate User Flows End-to-End — Not API Shortcuts."
- Coaching moment: `fraim/personalized-employee/learnings/raw/sid.mathur@gmail.com-2026-04-08T19-55-00-validate-real-user-flow-not-api-shortcuts.md`

## Honest Disclosure

The full browser OAuth flow (user clicks → Google consent → callback → tokens stored) has NOT been tested end-to-end because it requires manual browser interaction with Clerk auth. The API-level flow is verified. The browser redirect to Google is verified. The callback token exchange logic is implemented but untested against a real Google account.
