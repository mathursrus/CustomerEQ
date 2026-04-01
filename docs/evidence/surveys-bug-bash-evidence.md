# Bug Bash Report: Surveys Feature

## Summary
- **Date**: 2026-03-26
- **Scope**: Surveys & Sentiment Analysis feature (full stack)
- **Total Issues Found**: 8
- **Fixed**: 8
- **Open**: 0

## Bug Inventory

### Critical (P0) — Core flow blocked

| ID | Title | Category | Steps to Reproduce | Expected | Actual | Status |
|----|-------|----------|-------------------|----------|--------|--------|
| BUG-001 | Public survey page crashes with TypeError | Functionality | 1. Navigate to `/survey/{id}` for any active survey | Survey form renders with NPS 0-10 scale | `TypeError: Cannot read properties of undefined (reading 'map')` at `page.tsx:270` — `ratingRange(q.type)` returns undefined | **FIXED** — Changed to use `survey.type` (uppercase) instead of `q.type` ('rating'), added CUSTOM default case, fixed `brand.name` path |
| BUG-002 | Admin survey pages fail 401 in production | Functionality | 1. Sign into admin 2. Navigate to `/admin/surveys` | Survey list loads with data | API returns 401 because no Authorization header sent | **FIXED** — Added `useAuth`/`getToken` from `@clerk/nextjs` to all 3 admin survey pages (list, detail, create) |

### High (P1) — Major data issues

| ID | Title | Category | Steps to Reproduce | Expected | Actual | Status |
|----|-------|----------|-------------------|----------|--------|--------|
| BUG-003 | Admin pages show wrong response count and dates | Data | 1. View survey detail page | Response count and dates display correctly | `responseCount` is undefined (API returns `_count.responses`), response dates wrong (`createdAt` vs `completedAt`) | **FIXED** — Updated interfaces and field references in list and detail pages |

### Medium (P2) — Security & validation

| ID | Title | Category | Steps to Reproduce | Expected | Actual | Status |
|----|-------|----------|-------------------|----------|--------|--------|
| BUG-004 | XSS in embeddable widget code | Security | 1. Create survey with name containing `</script>` 2. Generate widget code | Widget code is safe | Injected script tags execute in host page | **FIXED** — Added HTML entity escaping for `<`, `>`, `&`, `'`, Unicode line terminators in `generateWidgetJs` |
| BUG-005 | NPS/CSAT/CES score not range-validated | Data | 1. Submit survey response with score=999 | Rejected as invalid | Accepted and stored | **FIXED** — Added `.min(0).max(10)` to `SubmitSurveyResponseSchema` and `PublicSurveyResponseSchema` |
| BUG-006 | Insufficient error logging on event enqueue | Observability | N/A (operational) | Error logs include context | Only `err` logged, no `surveyId`/`memberId`/`score` | **FIXED** — Added context fields to catch block |
| BUG-007 | Sentiment analysis can hang indefinitely | Reliability | N/A (operational) | Timeout after reasonable period | No timeout on `analyzeSentiment()` call | **FIXED** — Added 30s `Promise.race` timeout, try-catch on DB update |
| BUG-008 | Duplicate text extraction logic | Code Quality | N/A (maintenance) | Shared utility | Same logic in `surveys.ts` and `public.ts` | **FIXED** — Extracted to `apps/api/src/utils/survey.ts` |

## Passed Tests

| Test | Result | Notes |
|------|--------|-------|
| Public survey form renders (desktop/tablet/mobile) | PASS | All 3 breakpoints clean |
| NPS 0-10 scale displays correctly | PASS | Buttons wrap on mobile |
| Score selection highlights (indigo-600) | PASS | Scale-110 animation works |
| Survey submission success flow | PASS | Green checkmark + points badge |
| Duplicate response detection | PASS | Amber "Already Responded" screen |
| Survey not found error state | PASS | Red error box centered |
| Member not found error | PASS | Inline error message displayed |
| Incentive points in header and success | PASS | Both locations render correctly |
| Text question textarea works | PASS | Input captured and submitted |
| Loading spinner during fetch | PASS | Indigo spinner shown |
| Typography consistency (Inter font) | PASS | All elements use Inter |
| Keyboard navigation (Tab/Enter) | PASS | Focus rings visible |
| Zero horizontal overflow at all breakpoints | PASS | Programmatically verified |
| Console: zero errors | PASS | Only Clerk dev warnings |
| Network: all requests 200 OK | PASS | API healthy |
| Unit tests: 124 passing | PASS | 67 API + 57 worker |
| Build: all packages | PASS | 6/6 successful |

## Files Modified

### Security & Validation
- `apps/api/src/routes/public.ts` — XSS escaping in widget, score validation
- `packages/shared/src/zod/survey.schema.ts` — Score `.min(0).max(10)`, incentivePoints `.max(100000)`

### Bug Fixes
- `apps/web/src/app/survey/[id]/page.tsx` — Fixed `ratingRange` to use survey-level type (uppercase), `brand.name` path, `CUSTOM` default
- `apps/web/src/app/(admin)/surveys/page.tsx` — Added auth headers, fixed `_count.responses`
- `apps/web/src/app/(admin)/surveys/[id]/page.tsx` — Added auth headers, fixed `_count.responses`, `completedAt`
- `apps/web/src/app/(admin)/surveys/new/page.tsx` — Added auth headers to program fetch and survey create

### Code Quality
- `apps/api/src/routes/surveys.ts` — Better error logging context
- `apps/api/src/utils/survey.ts` — New shared utility for text extraction
- `apps/worker/src/processors/sentimentAnalysis.ts` — 30s timeout, try-catch on DB update
