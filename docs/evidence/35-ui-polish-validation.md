# UI Polish Validation — #35 Survey Builder + #36 Survey Theming
Issue: #35, #36
Date: 2026-03-27

## Quality Contract

### Target Pages
| Page | URL | Auth Required | Priority |
|------|-----|---------------|----------|
| Public survey (NPS) | `http://localhost:3003/survey/{id}` | No | P0 — customer-facing |
| Survey builder | `http://localhost:3003/admin/surveys/builder` | Yes (Clerk) | P1 — admin tool |
| Theme editor | `http://localhost:3003/admin/settings/themes/new` | Yes (Clerk) | P1 — admin tool |
| Theme list | `http://localhost:3003/admin/settings/themes` | Yes (Clerk) | P2 — admin list |

### Required User Journeys
1. Respondent loads public survey → sees themed branding → answers questions → submits → sees thank-you
2. Admin opens builder → adds questions → configures skip logic → saves survey
3. Admin creates theme → sees live preview update → saves theme

### Required UI States
- Loading (spinner while data fetches)
- Empty (no questions, no themes)
- Populated (survey with questions, themes with data)
- Error (API failure)

### Breakpoints
- Desktop: 1280x800
- Tablet: 768x1024
- Mobile: 375x812

### Browser Matrix
- Chromium (via Playwright MCP)

### Design Standards
- Generic UI baseline: Tailwind CSS, indigo-600 primary, rounded-lg borders, text-sm base
- Consistent spacing, typography hierarchy, no overlap/clipping

### Severity Policy
- **P0**: Core flow blocked or severe visual corruption
- **P1**: Obvious polish regression in major flow
- **P2**: Minor visual inconsistency

### Screenshot Directory
`docs/evidence/ui-polish/35/`

---

## Evidence Matrix

| Check | Page | Status | Evidence |
|-------|------|--------|----------|
| Theme list renders with table + empty state | `/admin/settings/themes` | PASS | Playwright snapshot: heading, table columns, empty state with create link |
| Theme creator two-panel layout | `/admin/settings/themes/new` | PASS | Playwright snapshot: full form (brand, colors, typography, layout, thank-you) + live preview |
| Theme editor color pickers | `/admin/settings/themes/new` | PASS | 7 color inputs with hex values and color type inputs |
| Theme editor chip selectors | `/admin/settings/themes/new` | PASS | sm/md/lg buttons for heading size, body size, card style, border radius, max width |
| Theme live preview shows NPS question | `/admin/settings/themes/new` | PASS | Rating buttons 0-10, text area, submit button, thank-you message visible |
| Admin sidebar has Settings link | All admin pages | PASS | "Settings" nav link visible pointing to /admin/settings/themes |
| Builder page exists (auth-protected) | `/admin/surveys/builder` | PASS (structure) | Admin layout renders, content blocked by Clerk auth (expected) |
| No console JS errors | All validated pages | PASS | Only Clerk dev warnings + React DevTools info (expected) |
| Public survey (no active surveys to test) | `/survey/{id}` | DEFERRED | No active surveys in database — requires seeded data for full validation |
| Skip logic client-side evaluation | `/survey/{id}` | DEFERRED | Requires active survey with skip rules |
| Responsive mobile layout | All pages @ 375x812 | DEFERRED | Requires auth session for admin pages |

---

## Blocking Findings

None — all validated pages render correctly.

---

## Defect Log

| # | Severity | Page | Description | Status |
|---|----------|------|-------------|--------|
| 1 | P2 | `/admin/surveys/builder` | Builder content not visible without Clerk auth — this is correct behavior but means builder UI requires manual testing with a logged-in session | EXPECTED |
| 2 | P2 | `/survey/{id}` | No active surveys in database to validate public survey rendering — need to seed test data or create a survey first | DEFERRED |

---

## Summary

**Validated via Playwright MCP:**
- Theme list page: table structure, empty state, navigation
- Theme creator: complete two-panel layout with 7 color pickers, typography/layout chips, live survey preview with NPS question
- Admin sidebar: Settings nav link correctly added
- Zero JavaScript errors across all validated pages

**Deferred (requires test data / auth session):**
- Public survey page with all 11 question types, skip logic, and theming
- Survey builder 3-panel interactive UI
- Responsive layout validation at mobile/tablet breakpoints

**Recommendation:** These deferred items should be validated during a manual QA session with a logged-in admin who can create surveys and themes, or via E2E tests with mocked auth.
