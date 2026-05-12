# Slice 3 — Surveys list page rewrite — Work List

**Issue**: #331 (sub-issue of umbrella #324)
**Slice**: 3 of 5 for #241 (Survey Admin UX)
**Branch**: TBD (will be `feature/241-slice-3-surveys-list`)
**FRAIM job**: feature-implementation, session 8559b791-b862-4957-a05a-bbe0ba9af882

Pre-conditions met: Slice 1 (PR #326, merged) + Slice 2 (PR #329, merged) both on main. `Survey.title` / `Survey.description` columns exist; `SurveyStatus.STOPPED` enum exists; PATCH endpoints + `responsePolicy` enforcement live.

---

## Goals (verbatim from #331 / spec §1 / RFC §"Surveys list")

1. Rewrite `apps/web/src/app/(admin)/admin/surveys/page.tsx` with new column set: **Name** (with description + program meta line) · **Type** pill · **Status** badge · **Responses** · **Updated** · row actions.
2. Add filter chips/dropdowns for **Status** (All / Draft / Active / Stopped — note Paused is omitted from chips per spec, but reachable via All) and **Type** (NPS / CSAT / CES / Custom).
3. Introduce `<SurveyRowMenu>` for state-aware `⋯` menu: Duplicate (always) · Discard draft (DRAFT only) · Pause (ACTIVE only) · Stop (ACTIVE/PAUSED only) · Restart (STOPPED only) · Delete (STOPPED only, with confirm).
4. Replace `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` (currently 462-line wizard) with thin Server Component that POSTs `/v1/surveys` and `redirect()`s to `/admin/surveys/[id]/edit?tab=basics`.
5. Drop dead columns from current list (`Trigger`, `Incentive Points`, the standalone `Copy widget` button).
6. Preserve ADR 0001's four-route layout.
7. Independent of editor/detail (Slice 4 lands those).

---

## Pattern Discovery

Established platform conventions to reuse (verified in `apps/web/src/app/(admin)/admin/programs/page.tsx`):

| Pattern | Component | Location |
|---|---|---|
| Filter row | `<FilterBar search filters filterValues onFilterChange/>` (select dropdowns) | `apps/web/src/components/ui/filter-bar.tsx` |
| Table | `<PaginatedTable<T>>` with `Column<T>[]` + `renderRowActions` + `onRowDoubleClick` | `apps/web/src/components/ui/paginated-table.tsx` |
| Status pill | `<StatusBadge status="DRAFT" />` (auto-capitalizes; styles for ACTIVE/DRAFT/PAUSED/ARCHIVED) | `apps/web/src/components/ui/status-badge.tsx` |
| Confirm modal | `<Modal>` for delete confirmation | `apps/web/src/components/ui/modal.tsx` |
| API helper | `getAuthToken(getToken)` + `fetch(\`${API_URL}/v1/...\`, { headers })` | `apps/web/src/lib/config.ts` |

Constants & file conventions:
- All admin pages are client components today (`'use client'`); SSR is opt-in.
- Server-side `redirect()` in App Router: `import { redirect } from 'next/navigation'`. Server components only.
- Test convention: `*.test.tsx` co-located OR under `test/`; vitest + `@testing-library/react`.

Gaps requiring new code:
- `StatusBadge` has no `STOPPED` style — needs adding.
- No existing dropdown-menu primitive — `SurveyRowMenu` carries its own minimal popover (CSS-only, no new dep).

---

## Resolved Decisions

### D-S3.1 — Filter UI: chips (build new)

Build a small `<FilterChips>` component colocated under `surveys/components/`. Multi-select within group, intersect across groups. Visually matches spec §1 / mock. ~50 lines. Programs page unaffected; can adopt chips later if useful.

### D-S3.2 — Row click: keep platform pattern (Name = single Link, body = double-click)

No change to shared `<PaginatedTable>`. The Name column wraps each survey name in `<Link>` (single-click navigates), and `onRowDoubleClick` navigates the row body — matching the Programs/Members convention. This is the project's intentional two-affordance pattern (saved in memory: `feedback_admin_list_row_clicks.md`). The "row click" language in spec §1 is interpreted as this two-affordance pattern.

### D-S3.3 — `/admin/surveys/new` Server Component

Server Component fetches `/v1/programs` (Clerk Bearer via `@clerk/nextjs/server`'s `auth()`), picks the first program, POSTs `/v1/surveys` with `{ name: 'Untitled survey', programId, type: 'NPS' }`, then `redirect()`s to `/admin/surveys/[id]/edit?tab=basics`. Assumption: brand always has ≥1 program (onboarding creates one). If zero, redirect to `/admin/surveys?error=no-program` with an inline notice.

### D-S3.4 — Duplicate / Delete API endpoints — landed in #333

`POST /v1/surveys/:id/duplicate` and `DELETE /v1/surveys/:id` were missing from Slice 2 and have now landed via the follow-up PR #333 (issue #332). `<SurveyRowMenu>` wires:
- Duplicate → `POST /v1/surveys/:id/duplicate`
- Discard draft (DRAFT) → `DELETE /v1/surveys/:id`
- Delete (STOPPED) → `DELETE /v1/surveys/:id` (with confirm modal)
- Pause / Stop / Restart → `PATCH /v1/surveys/:id/status`

All menu items per spec §1 are now backed by endpoints. No items deferred.

### D-S3.5 — `GET /v1/surveys` list shape

Phase-2 verification: the current handler at `apps/api/src/routes/surveys.ts:96` returns `Survey` rows + `_count.responses` but does NOT join `program` and may not include `description`/`updatedAt`. Plan: additive list-shape update — add `description` (already a column from Slice 2) + `updatedAt` (already a column) to the returned fields via Prisma `select` or default; include `program: { select: { name: true } }`. Purely additive, no breaking change to existing callers.

---

## Implementation Checklist (file-by-file)

### Code

- [ ] `apps/web/src/app/(admin)/admin/surveys/page.tsx` — REWRITE as client component (matching Programs/Members convention). Page shell + chip-filter state + `<PaginatedTable>` + `<NewSurveyButton>` + `<SurveyRowMenu>` per row. Removes: `CopyWidgetButton`, `Trigger` column, `Incentive Points` column, inline status colors map.
- [ ] `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — REWRITE as thin Server Component (~40 lines): `auth()` from `@clerk/nextjs/server`, GET `/v1/programs` (server-side fetch with the bearer), POST `/v1/surveys` with `{ name: 'Untitled survey', programId: first, type: 'NPS' }`, `redirect()` to `/admin/surveys/[id]/edit?tab=basics`. Per D-S3.3.
- [ ] `apps/web/src/app/(admin)/admin/surveys/components/SurveysList.tsx` — NEW. Client component owning filter state + table.
- [ ] `apps/web/src/app/(admin)/admin/surveys/components/SurveyRowMenu.tsx` — NEW. Client component with state-aware item visibility; backs Duplicate / Pause / Stop / Restart / Discard / Delete by calling existing endpoints (Slice 2 status PATCH + #333 duplicate/delete).
- [ ] `apps/web/src/app/(admin)/admin/surveys/components/NewSurveyButton.tsx` — NEW. Single `<Link href="/admin/surveys/new">` styled as primary CTA.
- [ ] `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.tsx` — NEW. Pill-button group with multi-select per group + intersect across groups; URL `?status=&type=` round-trip via `useSearchParams`/`router.replace`.
- [ ] `apps/web/src/components/ui/status-badge.tsx` — MODIFY. Add `STOPPED: 'bg-red-100 text-red-600'` to the styles map.
- [ ] `apps/api/src/routes/surveys.ts` — MODIFY `GET /v1/surveys` to include `description`, `updatedAt` (already columns; may already be returned by default Prisma select), and add `program: { select: { name: true } }` so the list page can render the meta line without a second fetch. Purely additive.

### Tests

- [ ] `apps/web/src/app/(admin)/admin/surveys/components/SurveyRowMenu.test.tsx` — NEW. RTL. State × menu-item visibility matrix (4 states × 6 items = 24 cases; collapsed to 4 tests each asserting allowed-items per state).
- [ ] `apps/web/src/app/(admin)/admin/surveys/components/FilterChips.test.tsx` — NEW. Chip selection → callback fires; multi-select within group; cross-group intersect.
- [ ] `apps/web/src/app/(admin)/admin/surveys/page.test.tsx` — NEW (page-level RTL with mocked fetch). Renders columns; status badge vocabulary uses Stopped (not Closed); filter narrows row count.
- [ ] `apps/web/src/app/(admin)/admin/surveys/new/page.test.tsx` — NEW. The `/new` Server Component path: POST is fired once, `redirect()` called with correct URL. Mock `next/navigation`'s `redirect` and `fetch`.
- [ ] `apps/api/test/integration/survey-routes.test.ts` — POSSIBLE EXTENSION if OQ-S3.5 needs API list shape change.

### Files removed (deferred to Slice 4 per #331 §"Out of scope")

- `apps/web/src/app/(admin)/admin/survey-builder/page.tsx` — kept; Slice 4 deletes.
- `apps/web/src/components/surveys/{TriggerStep,RuleBuilderStep,ReviewLaunchStep}.tsx` — kept on disk, un-imported by Slice 3's new redirect handler.
- `apps/web/src/utils/triggerRecommendation.ts` — kept; un-imported.

These leftover files will fail dead-code-detection (DCD) in lint if such a rule exists. Will verify in phase 5.

---

## Validation Requirements

- `uiValidationRequired`: **YES** — `/admin/surveys` list page is rewritten.
  - **Target journeys**: (a) load list with surveys in DRAFT/ACTIVE/PAUSED/STOPPED — verify each status badge. (b) click filter chip → list narrows. (c) click `⋯` on each status — verify allowed items. (d) click `+ New survey` → land on editor with new draft created. (e) browser back from editor then forward — verify no second draft. (f) visit `/admin/surveys/new` directly twice in a row — verify two drafts NOT created on refresh (POST-redirect-GET).
  - **Breakpoints**: 360 / 768 / 1280 — table is the load-bearing element. Below 768 the table collapses to a card list (or accept horizontal scroll — TBD in phase 5).
  - **Browser baseline**: Chromium via Playwright (existing CI gate).
  - **Evidence artifact**: `docs/evidence/331-ui-polish-validation.md`.
- `mobileValidationRequired`: NO (admin surface, desktop-first per platform convention).
- **Local pre-push gates**: `pnpm typecheck && pnpm lint && pnpm build && pnpm test && pnpm test:integration` all green.
- **CI on PR**: Build/Lint/Test + Build production images, both green.

---

## Complexity Assessment

File modifications: 5 new + 3 modifications + 1 possible API tweak = 9 files.

Below the 15-file phase-split threshold. Single-slice ship.

---

## In-flight decisions / deferrals

- **No new npm deps**. State-aware `⋯` menu uses native CSS popover or simple absolute-positioned div with click-outside handler — no `@radix-ui/react-dropdown-menu` or similar.
- **Filter URL round-trip**: phase 4 decides whether to use `?status=&type=` query strings (per #331 §B) or in-memory state. Recommendation: query strings for shareability. Implementation cost is one `useSearchParams` + one `router.replace` call.
- **Pagination**: PaginatedTable already paginates; default `pageSize=25` matching NFR-SC3.

---

## Phase-2 entry criteria

Before starting phase 2 (implement-tests):
1. User has confirmed the 5 open questions above (or accepted recommendations).
2. Branch `feature/241-slice-3-surveys-list` is created off main.
3. (Implicit) Slice 1+2 verified green on main — done.
