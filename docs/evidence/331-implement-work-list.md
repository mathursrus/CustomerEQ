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

### D-S3.3 — `/admin/surveys/new` Server Component — DEFERRED TO SLICE 4

Initially rewrote `/new` as a Server Component (auth → POST `/v1/surveys` → `redirect()` to `/[id]/edit?tab=basics`). During local review, two production-break concerns surfaced:

1. The legacy wizard's **trigger / rules / launch** wizard steps would be lost, but the spec-mandated replacement (Slice 4's 4-tab editor + Activate flow) doesn't exist yet.
2. The Server Component hardcoded **`type: 'NPS'`** at creation time; the legacy survey-builder (the current `/edit` redirect target) can edit questions but not change the type — operator would be stuck.

Both pointed at the same fix: `/new` should keep doing what it does today (the wizard) until Slice 4 lands the new editor that owns both the create flow and the edit flow.

**Decision**: revert just `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` to the existing client-side wizard. Keep everything else in Slice 3 (list rewrite, chips, ⋯ menu, StatusBadge `STOPPED`, vitest harness, disabled-button + empty-state when no programs). Slice 4 owns the `/new` AND `/edit` rewrites together — natural pairing since the Basics tab IS the new `/new` landing target.

The Server Component implementation is preserved in git history (commit `2ffa607` on this branch) and can be lifted into Slice 4 cleanly.

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
- [x] ~~`apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — REWRITE as thin Server Component~~ **DEFERRED TO SLICE 4 per D-S3.3.** The existing client-side wizard stays on `/new` until Slice 4 lands the new editor.
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

---

## Test Coverage Map (FRAIM phase 3 catch-up — 2026-05-12)

This map was added retroactively after the user flagged that I skipped phases. Walks every acceptance bullet in #331 + every line item in spec §1; maps to test coverage.

### Acceptance criteria from #331 → tests

| Acceptance bullet | Test(s) | Status |
|---|---|---|
| `/admin/surveys` renders new column set (Name + meta · Type pill · Status badge · Responses · Updated · row actions) | (none directly — no RTL harness) + manual validation | **Manual-only**; document deferral |
| Filter chips (Status + Type) filter correctly; URL `?status=&type=` round-trips | `STATUS_GROUP` + `TYPE_GROUP` config tests (new in phase-3 catch-up); URL round-trip exercised manually | **Partial** — config tested; URL round-trip is manual |
| `<SurveyRowMenu>` shows state-allowed items per Survey.status | `SurveyRowMenu.test.ts` — 4 visibility tests covering DRAFT/ACTIVE/PAUSED/STOPPED | **Covered** |
| `+ New survey` click → POST + redirect to `/[id]/edit?tab=basics` with exactly one row created | **Deferred to Slice 4** (Server Component reverted) | **Deferred** |
| Back/forward nav from `/new` does NOT create duplicate drafts | **Deferred to Slice 4** | **Deferred** |
| Status badge vocabulary `Draft / Active / Paused / Stopped` (no `Closed`) | `STATUS_GROUP` config test (verifies enum values); `StatusBadge` renders `Stopped` text from `STOPPED` enum via existing logic | **Covered** |
| All local gates pass | typecheck + lint + 1083 unit + 380 integration | **Covered** |
| CI green | pending PR review | **Pending** |

### Spec §1 requirements → tests

| Spec line | Test(s) | Status |
|---|---|---|
| Path `/admin/surveys` | next-app routing, no test needed | N/A (framework) |
| Single primary CTA `+ New survey` | manual + disabled-state logic test | **Manual + indirect** |
| Columns left-to-right (Name + meta · Type · Status · Responses · Updated · row actions) | `relTime` helper tested for Updated column; column rendering itself is JSX-coupled | **Partial** — helper covered; layout is manual |
| Row click → detail (Programs/Members convention) | `<Link>` href + onRowDoubleClick passed through to PaginatedTable | **Manual** |
| Row actions ✎ + ⋯ | menu visibility tests cover ⋯; ✎ is a static Link | **Covered** |
| ⋯ menu state-aware items (Duplicate/Discard/Pause/Stop/Restart/Delete) | `SurveyRowMenu.test.ts` visibility + action tests (16 cases) | **Covered** |
| Filter chips Status (All/Draft/Active/Stopped) + Type (NPS/CSAT/CES/Custom) — NO Trigger or Distribution chips | `STATUS_GROUP` + `TYPE_GROUP` config tests (new) | **Covered** |
| Status badges = converged vocab Draft/Active/Paused/Stopped (no CLOSED) | `STATUS_GROUP` config test asserts STOPPED present, CLOSED absent | **Covered** |

### Gaps + actions

Three gaps were addressable as pure-helper tests (no RTL):

1. **`relTime` helper** — extracted to `list-page.logic.ts` + tested. Covers just-now, minutes, hours, days, >30d fallback.
2. **`STATUS_GROUP` + `TYPE_GROUP` config** — extracted to `list-page.logic.ts` + tested. Asserts spec §1 compliance: no PAUSED in chips, no CLOSED anywhere, all 4 types listed.
3. **Server Component flow (`/new` POST + redirect, back/forward nav)** — code is reverted to legacy wizard; tests deferred to Slice 4 when the rewrite lands.

Remaining "manual-only" items (column rendering layout, URL round-trip, row click navigation): require an RTL/jsdom harness that the web package doesn't have today. Out of scope for Slice 3 catch-up — Slice 4 will need this harness for the editor anyway, so adding RTL there is more natural.

### Test-first discipline

This audit was retroactive. Tests for Slice 3 were written *after* implementation, not against the spec first. For Slice 4 onward: tests against acceptance criteria authored before code, watched fail, then implemented.
