# UI Polish Validation Evidence - Issue #113: External Signal Hub

Issue: `113`
Branch: `feature/issue-113-social-review-ingestion-spec`

## Quality Contract

### Target Pages
| Page | URL Path | Description |
|---|---|---|
| Integrations (Source Registry) | `/admin/integrations` | External signal source CRUD, health badges, preview, sync |
| CX Analytics | `/admin/analytics/cx` | External signal counts, filters, analytics feed |
| Customer 360 | `/admin/members/[id]` | Matched external signals in member detail |

### Required User Journeys
1. **Source CRUD**: Create a new external signal source, edit config, toggle enabled, delete
2. **Source Preview/Test**: Test a configured source and view normalized preview records
3. **Manual Sync**: Trigger a manual source sync and observe health badge update
4. **Analytics Feed**: View external signals in CX analytics, apply filters (source type, sentiment, date)
5. **Customer 360**: Navigate to a member and view matched external signals section

### Required UI States
- Loading (skeleton/spinner)
- Empty (no sources configured, no signals ingested)
- Error (API failure, invalid config)
- Success (source created, sync triggered)
- Populated (multiple sources with health data, signal feed with entries)

### Breakpoints
| Breakpoint | Viewport | Device Class |
|---|---|---|
| Mobile | 375x812 | iPhone 13/14 |
| Tablet | 768x1024 | iPad |
| Desktop | 1280x800 | Laptop |

### Browser Matrix
- Chromium (primary)

### Design Standards
- Generic UI baseline (no project-specific design system configured)
- Tailwind CSS utility classes (consistent with existing admin pages)
- Existing admin page conventions for cards, tables, badges, forms, modals

### Severity Policy
| Severity | Definition |
|---|---|
| P0 | Core flow blocked or severe visual corruption |
| P1 | Obvious polish regression in major flow |
| P2 | Minor visual inconsistency |

### Artifact Directory
- Screenshots and browser artifacts: `docs/evidence/ui-polish/113/`

---

## Findings Summary

| Severity | Found | Fixed | Remaining |
|---|---|---|---|
| P0 | 3 | 3 | 0 |
| P1 | 8 | 8 | 0 |
| P2 | 10 | 4 | 6 |

## P0 Fixes Applied

| ID | File | Issue | Fix |
|---|---|---|---|
| P0-1 | `integrations/page.tsx:281` | CopyButton `mt-10` hack breaks on mobile | Changed to `self-end` on flex container |
| P0-2 | `integrations/page.tsx:289` | Two-column grid only activates at `xl`, stacked 768–1279px | Changed to `lg:grid-cols-[1.2fr,0.8fr]` |
| P0-3 | `external-signal-source-form.tsx:171-216` | JSON textareas missing focus ring | Added `focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500` |

## P1 Fixes Applied

| ID | File | Issue | Fix |
|---|---|---|---|
| P1-1 | `integrations/page.tsx:335-338` | Webhook URL display uses JSX concatenation (potential slash mismatch with CopyButton) | Changed to template literal `${API_URL}${source.webhookPath}` |
| P1-2 | `analytics/cx/page.tsx:298` | Header filter row overflows on mobile | Changed outer div to `flex-col gap-4 sm:flex-row sm:items-start sm:justify-between` |
| P1-3 | `analytics/cx/page.tsx:306` | Survey select misindented outside its flex wrapper | Fixed indentation so all 3 selects are siblings inside the flex container |
| P1-4 | `integrations/page.tsx:399` | Raw backtick in visible text for `scopeConfig` | Replaced with inline `<code>` tag |
| P1-5 | `members/[id]/page.tsx:954` | Sentiment threshold hardcoded `>= 0`; no neutral band | Imported `SENTIMENT` constants from shared, added yellow neutral band |
| P1-6 | `integrations/page.tsx:343-358` | Test/Sync buttons have no loading/disabled state per-row | Added `actionSourceId` state; buttons disabled + show loading text during request |
| P1-7 | `analytics/cx/page.tsx:256-273` | `fetchExternalSignals` silently swallows errors | Added `externalSignalsError` state + error banner in External Signals section |
| P1-8 | `analytics/cx/page.tsx:600-618` | Pagination stale closure bug | Changed to use `responses.page` (server-confirmed) instead of `responsesPage` state |

## P2 Fixes Applied

| ID | File | Issue | Fix |
|---|---|---|---|
| P2-4 | `analytics/cx/page.tsx:136-142` | Spinner missing `role="status"` and screen reader text | Added `role="status"` and `<span className="sr-only">Loading...</span>` |
| P2-6 | `external-signal-source-form.tsx:70-115` | Select elements missing focus styles | Added focus ring styles to both selects |
| P2-9 | `integrations/page.tsx:362-390` | Test preview panel has no dismiss control | Added close button inside preview card heading |
| P2-10 | `analytics/cx/page.tsx:369-397` | "Brand or product scope" label confusing | Renamed to "Unmatched (brand-level)" with tooltip |

## P2 Remaining (Deferred)

| ID | File | Issue | Reason |
|---|---|---|---|
| P2-1 | `external-signal-source-form.tsx:153-165` | Checkbox missing `id`/`htmlFor` | Functional, low risk |
| P2-2 | `integrations/page.tsx:68-91` | CopyButton swallows clipboard errors | Matches existing pattern in surveys page |
| P2-3 | `integrations/page.tsx:81-91` | CopyButton missing `aria-label` | Pre-existing pattern, not regression |
| P2-5 | `members/[id]/page.tsx` | Inconsistent `rounded-lg` vs `rounded-xl` | Pre-existing page, not new code |
| P2-7 | `analytics/cx/page.tsx:345` | `grid-cols-2` clips at 320px | Edge case, most users on 375px+ |
| P2-8 | `members/[id]/page.tsx:752-769` | Note edit/delete buttons keyboard-inaccessible | Pre-existing code, not part of #113 |
