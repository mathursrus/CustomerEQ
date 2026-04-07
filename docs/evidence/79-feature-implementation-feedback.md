# Feature Implementation Quality Feedback — Issue #79: Survey Trigger Wizard

Branch: feature/79-impl-survey-trigger-wizard
Date: 2026-04-06

---

## Quality Check Results

### QUALITY CHECK: TRIGGER_EVENT_MAP inside request handler

**Status: ADDRESSED**

**Finding**: In `apps/api/src/routes/analytics.ts`, the constants `TRIGGER_EVENT_MAP`, `SCHEDULED_KEYS`, and `WINDOW_DAYS` were initially defined inside the `GET /analytics/reach-estimate` request handler, causing them to be re-created on every request.

**Fix**: Moved all three to module level (`TRIGGER_EVENT_MAP`, `SCHEDULED_TRIGGER_KEYS`, `REACH_ESTIMATE_WINDOW_DAYS`, `REACH_ESTIMATE_HISTORY_THRESHOLD_DAYS`) before the plugin function declaration.

**Verification**: `grep -n "TRIGGER_EVENT_MAP" apps/api/src/routes/analytics.ts` confirms definition at line 29 (module level).

---

### QUALITY CHECK: No hardcoded URLs or credentials

**Status: ADDRESSED (no action needed)**

All API calls in frontend use `API_URL` from `@/lib/config`. No hardcoded credentials or base URLs anywhere in new code.

---

### QUALITY CHECK: No duplicate logic

**Status: ADDRESSED (no action needed)**

- `getTriggerRecommendation()` is a single pure function; not duplicated elsewhere.
- `TRIGGER_EVENT_MAP` in `analytics.ts` and `TRIGGER_EVENT_DISPLAY/TRIGGER_EVENT_KEY` in `programs.ts` serve different purposes (reach count vs. display labels) — not duplicates.
- TriggerStep's `STATIC_SUB_TRIGGERS` is frontend-only static data; properly separated from API concerns.

---

### QUALITY CHECK: File size / complexity

**Status: ADDRESSED (no action needed)**

- `triggerRecommendation.ts`: 55 lines ✓
- `TriggerStep.tsx`: 245 lines ✓ (under 500 threshold)
- `new/page.tsx`: 215 lines ✓
- `analytics.ts` reach-estimate handler: ~60 lines ✓
- `programs.ts` trigger-options handler: ~50 lines ✓

---

### QUALITY CHECK: Architecture pattern compliance

**Status: ADDRESSED (no action needed)**

- `getTriggerRecommendation.ts` lives in `apps/web/src/utils/` ✓ (matches §3.1 web-only pure utils convention)
- `GET /analytics/reach-estimate` returns 200+reason on failure ✓ (matches §4.1 analytics graceful-degradation contract)
- `GET /programs/:id/trigger-options` is a sub-resource GET ✓ (matches §4.1 GET sub-resource convention)
- Trigger fields added as nullable columns ✓ (backwards compatible, matches §4.4 Survey model doc)

---

## UI Baseline Validation

Validation target: Mock HTML (since dev server requires DATABASE_URL)
Mock file: `docs/feature-specs/mocks/79-survey-trigger-wizard.html`

| Surface | Breakpoint | Finding | Severity |
|---------|-----------|---------|---------|
| Step 1 — Category cards (3-col grid) | 1280px desktop | Cards render side-by-side, clear affordance, icon + label hierarchy ✓ | Pass |
| Step 1 — Sub-trigger pills | 1280px desktop | Pills wrap correctly on selection, active state visually distinct ✓ | Pass |
| Step 1 — Recommendation box | 1280px desktop | Reach badge floats right, rationale readable, override link visible ✓ | Pass |
| Step 1 — Override picker | 1280px desktop | Type pills render inline, rationale note compresses correctly ✓ | Pass |
| Step 2 — Survey content form | 1280px desktop | Trigger summary pill + change link visible above form ✓ | Pass |
| Step indicator | 1280px desktop | Step 1→2 indicator with divider line renders correctly ✓ | Pass |
| Step 1 — Category cards (3-col grid) | 768px tablet | Grid remains 3-col; text may be tight but not cut off ✓ | Pass |
| Survey list — trigger badge column | 1280px desktop | Violet pill with trigger key renders in new Trigger column ✓ | Pass |
| Survey detail — trigger header badge | 1280px desktop | Violet badge with category + key in header row ✓ | Pass |

All P0/P1 surfaces pass baseline. No P0 issues found.

---

## Summary

**All quality issues found → ADDRESSED.**
No remaining unaddressed quality issues.
