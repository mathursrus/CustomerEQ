# Implementation Work List — Issue #157

This file is the durable working memory for the four-PR implementation of the standard CRUD admin pattern (per `docs/rfcs/157-standardize-list-view-edit-pattern.md`).

## Issue Type

**feature** (UX standardization across multiple entities + new architecture standard)

## Validation Requirements

- `uiValidationRequired`: **yes** — all 4 PRs touch admin pages
- `mobileValidationRequired`: **no** — admin portal is desktop-first per project convention
- Browser baseline: Chromium (Playwright default)
- Test environments expected to be reachable: local Postgres, Redis (when `QUEUE_MODE=redis`), dev server (`pnpm dev`)
- UI polish evidence artifact (per FRAIM convention if heavy UI work): not required for the prop-widening PR; will be added for entity PRs that introduce new pages

---

## PR Plan (4 PRs)

### PR 1 — `feature/issue-157-pattern-arch-docs` (LEAD; in progress)

Smallest, blocks the others. Establishes the standard.

- [ ] `apps/web/src/components/ui/view-only-banner.tsx` — widen prop signature: add required `entityLabel: string`. Use it in both message and button label. Keep `onEdit` unchanged.
- [ ] `apps/web/src/app/(admin)/admin/programs/_components/program-wizard.tsx` — update existing `<ViewOnlyBanner …/>` call site to pass `entityLabel="Program"`. Also fixes the rendered banner copy regressing for Programs.

**Skipped: unit test for `view-only-banner.tsx`** — `apps/web` has no React Testing Library and no JSX-test infrastructure (existing `*.test.ts` files in `apps/web` only cover pure reducers/utilities). The prop widening is type-safe (TypeScript catches the existing call site at typecheck), the rendered output is verified manually in the browser, and the entity-PR Playwright E2E (`admin-crud-navigation.spec.ts` in PR 4) exercises the banner end-to-end. Adding RTL solely for this one-line interpolation is out-of-scope for PR 1.
- [ ] `docs/architecture/architecture.md` §3.1 — insert "Standard CRUD admin pattern" paragraph (text from RFC Architecture Updates → Update 1).
- [ ] `docs/architecture/adr/0001-admin-crud-route-pattern.md` — NEW ADR. Captures decision, alternatives (single combined view+edit; modal-based view), consequences (URL contracts; new entities require 4 route files), and Issue #157 as establishing context.

Validation:
- `pnpm typecheck` (the prop addition will surface every existing call site that misses `entityLabel`)
- `pnpm test:smoke` (covers the new unit test)
- Manual browser check: load `/admin/programs/{id}` (any draft program) and verify the banner still says "Edit Program"

Quality requirements (from project rules):
- TypeScript strict (#11)
- Tests must never skip (#11a)

### PR 2 — `feature/issue-157-alert-rules-pattern`

- [ ] NEW `apps/web/src/components/alert-rules/AlertRuleForm.tsx` — extract from current `new/page.tsx` and `[id]/edit/page.tsx`. Mode prop `'create' | 'edit' | 'view'`. Preserve webhook-mask behavior (`isMasked()`, `slackAlreadySet`/`teamsAlreadySet`).
- [ ] NEW `apps/web/src/components/alert-rules/AlertRuleForm.test.tsx` — unit tests for mode disabling, POST vs PATCH branching, mask preservation.
- [ ] `apps/web/src/app/(admin)/admin/alerts/rules/new/page.tsx` — replace inline form with `<AlertRuleForm mode="create" />`.
- [ ] `apps/web/src/app/(admin)/admin/alerts/rules/[id]/edit/page.tsx` — replace inline form with `<AlertRuleForm mode="edit" ruleId={id} initialData={…} />`.
- [ ] NEW `apps/web/src/app/(admin)/admin/alerts/rules/[id]/page.tsx` — RSC view-only route. ViewOnlyBanner + `<AlertRuleForm mode="view" …/>`.
- [ ] `apps/web/src/app/(admin)/admin/alerts/rules/page.tsx` — name as `Link` to `/admin/alerts/rules/{id}`; add separate "Edit" link in row actions.
- [ ] **Integration test (rule #11a)**: `apps/api/test/routes/alert-rules.test.ts` — append a case asserting PATCH with omitted `slackWebhookUrl` does not null the existing column value.

### PR 3 — `feature/issue-157-campaigns-pattern`

- [ ] `apps/web/src/components/campaigns/CampaignForm.tsx` — widen `mode` from `'create' | 'edit'` to `'create' | 'edit' | 'view'`; derive `isViewOnly`; apply `disabled` to controls; hide submit row.
- [ ] `apps/web/src/components/campaigns/CampaignForm.test.tsx` (modify or NEW) — add `mode='view'` cases.
- [ ] NEW `apps/web/src/app/(admin)/admin/campaigns/[id]/page.tsx` — RSC view-only route + ViewOnlyBanner.
- [ ] `apps/web/src/app/(admin)/admin/campaigns/page.tsx` — wrap campaign name in `<Link>` to `/campaigns/{id}`.
- [ ] `apps/web/src/app/(admin)/admin/campaigns/CampaignActions.tsx` — promote "View" as primary; demote "Edit" to secondary.

### PR 4 — `feature/issue-157-themes-pattern`

- [ ] NEW `apps/web/src/components/themes/ThemeForm.tsx` — extract form + helpers (`SurveyPreview`, `ColorInput`, `ChipGroup`). Mode prop.
- [ ] NEW `apps/web/src/components/themes/ThemeForm.test.tsx` — mode disabling, default-on-create state, save/delete button visibility per mode.
- [ ] `apps/web/src/app/(admin)/admin/settings/themes/new/page.tsx` — replace inline form with `<ThemeForm mode="create" />`.
- [ ] `apps/web/src/app/(admin)/admin/settings/themes/[id]/page.tsx` — refactor to view-only + ViewOnlyBanner.
- [ ] NEW `apps/web/src/app/(admin)/admin/settings/themes/[id]/edit/page.tsx` — `<ThemeForm mode="edit" themeId={id} initialData={…} />`.

### Cross-cutting (after all 4 PRs)

- [ ] NEW `apps/web/e2e/admin-crud-navigation.spec.ts` — single E2E spec covering the navigation pattern across all three new entities (list → name click → view → banner-click → edit → list-row-edit). Bundled with PR 4 since it depends on all routes existing.

---

## Open Questions / Deferrals

- **None blocking PR 1.**
- For PR 2 (Alert Rules): the existing edit-page logic for assignment-rule add/remove uses local state mutators; in view mode the +/× buttons must be disabled. Verify during implementation that no `useEffect` accidentally triggers writes when the form is mounted in view mode.
- For PR 4 (Themes): `SurveyPreview` always renders interactively (it's a visual preview, not user input). The `isViewOnly` flag must NOT propagate into the preview component.

---

## Pattern Discovery Notes (from prior reading)

- **API base + auth token**: every admin page already uses `import { API_URL, getAuthToken } from '@/lib/config'` with `useAuth()` (client) or `auth()` (server). New view RSCs follow the Programs server-side pattern (`auth()` → `getToken()` → `fetch(..., { cache: 'no-store', headers })`).
- **Test factories (rule #8)**: any new factory used by `AlertRuleForm.test.tsx` / `ThemeForm.test.tsx` must live in `packages/config/src/test-utils/`, imported via `@customerEQ/config/test-utils`.
- **Tailwind utility vocabulary**: existing forms use `rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500` for inputs. Preserve verbatim during extraction so visual diff is zero.
- **404 handling on view RSCs**: mirror Programs pattern — `if (!entity) notFound()` from `next/navigation`.
- **No new env vars needed.**
- **No new constants files needed.**
