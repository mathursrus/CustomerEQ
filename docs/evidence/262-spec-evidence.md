# Evidence: Feature Specification — Issue #262

**Issue**: #262 — Historical Survey Data Import  
**Workflow**: feature-specification  
**Date**: 2026-05-03  
**Branch**: feature/issue-262-historical-survey-import  
**Status**: DRAFT — Awaiting owner answers to 3 blocking open questions

---

## Summary

Completed full feature specification for the historical survey data import feature. The spec defines the customer problem, proposes two design approaches with a recommendation, identifies three blocking open questions that must be answered before implementation begins, covers GDPR/CCPA compliance requirements, and includes a 9-scenario validation plan.

An interactive HTML/CSS mock was created showing all UI states.

---

## Work Completed

### Spec Document

**File**: `docs/feature-specs/262-historical-survey-data-import.md`

- Customer definition: CustomerEQ admin / operator (not end-consumer)
- Three customer problems documented: blank analytics on day one, lost member continuity, manual re-entry not scalable
- Three blocking open questions called out explicitly before any UX was drafted:
  - **OQ-1**: Which survey tools do target clients export from? (blocks column definitions)
  - **OQ-2**: Fixed CSV template (Option A) vs column-mapping wizard (Option B)? (blocks UX scope)
  - **OQ-3**: Analytics continuity only, or should historical sentiment influence the loyalty engine? (blocks technical scope)
- Draft UX flow (5 steps) assuming Option A + analytics continuity
- CSV template: `email` (required), `score`, `verbatim`, `completed_at`, `channel`, `external_id`
- GDPR/CCPA compliance section with 4 controls
- 9-scenario validation plan
- Alternatives analysis (4 alternatives discarded with reasoning)
- Competitive analysis: Medallia, Qualtrics, Delighted, SurveyMonkey Engage

### Interactive Mock

**File**: `docs/feature-specs/mocks/262-import-flow.html`

4 states rendered in HTML/CSS (Tailwind):
1. Survey detail page with "Import Historical Data" button added to header
2. Import modal — empty (file not yet selected)
2b. Import modal — file selected, "Start Import" active
2c. Import modal — upload complete (batch ID + row count + validation error summary)
3. Import History tab with batch status table
4. Responses tab showing "historical" and "live" source badges

---

## Feedback History

_No prior feedback on this spec. First submission._

---

## Validation

### Completeness review results

| Check | Status | Notes |
|-------|--------|-------|
| Mock HTML exists and renders | ✓ Pass | 4+ states covered |
| Customer problems defined | ✓ Pass | 3 problems |
| UX flow documented | ✓ Pass | 5 steps |
| CSV template specified | ✓ Pass | 6 columns |
| Compliance section | ✓ Pass | GDPR/CCPA, 4 controls |
| Validation plan | ✓ Pass | 9 test scenarios |
| Alternatives documented | ✓ Pass | 4 alternatives discarded |
| Competitive analysis | ✓ Pass | 4 competitors |
| Design standards match | ✓ Pass | Tailwind + indigo, consistent with architecture.md |
| Explicit Acceptance Criteria header | ⚠ Gap | Validation Plan serves this role |
| Open questions explicitly blocked | ✓ Pass | OQ-1/2/3 listed as blocking |

---

## Quality Checks

- ✅ Spec uses present-tense, user-facing language (not implementation language)
- ✅ Blocking unknowns are surfaced before any UX is finalized
- ✅ Two design options presented with explicit recommendation and tradeoffs
- ✅ Compliance requirements derived from project Rule 13 (GDPR/CCPA)
- ✅ Mock follows project design system (Tailwind CSS v4 + indigo palette)
- ✅ Status marked DRAFT with explicit gate on OQ answers

---

## Phase Completion

| Phase | Status |
|-------|--------|
| context-gathering | ✓ Complete |
| spec-drafting | ✓ Complete |
| competitor-analysis | ✓ Complete |
| spec-completeness-review | ✓ Complete |
| spec-submission | In progress |

---

## Next Steps (Blocking)

Implementation cannot begin until the following are answered:

1. **OQ-1** — Which survey tools do the first 3–5 target clients export from? Can we get one anonymised sample export?
2. **OQ-2** — Is Option A (fixed CSV template) acceptable, or must the product handle raw exports from any tool?
3. **OQ-3** — Should historical sentiment influence the real-time loyalty engine (health score / campaign priority), or is analytics continuity the only requirement?

Owner: swavak@gmail.com
