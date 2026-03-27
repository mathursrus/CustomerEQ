# Implementation Work List — Issue #2: Configure Loyalty Program

**RFC**: `docs/rfcs/2-configure-loyalty-program.md` (Status: Approved)
**Branch**: `feature/2-issue-2`
**Last updated**: 2026-03-27

---

## ⚠️ Phase Splitting Candidate

Total targeted file modifications: **42+** (threshold: 15). This issue requires splitting into milestones. See proposed split below.

---

## Proposed Milestone Split

| Milestone | Scope | Files | Deliverable |
|---|---|---|---|
| **M1 — Backend Foundation** | Schema + Zod + API + Worker + Tests | ~12 | API fully functional; wizard can be built against real endpoints |
| **M2 — Shared UI Library** | 10 shared components + programs landing | ~12 | Design system established; landing page live |
| **M3 — 7-Step Wizard** | Wizard shell + steps + modals + page routes | ~14 | Full wizard working end-to-end |
| **M4 — Design System Rollout + E2E** | Apply components to other pages; E2E tests | ~6 | Site-wide consistency; automated test coverage |

---

## Milestone 1 — Backend Foundation

### DB Schema (`packages/database/prisma/`)
- [x] `schema.prisma` — Add enums (`ProgramType`, `HaltBehavior`, `RewardType`); update `Program`, `EarningRule`, `Reward`; add `Tier`, `ProgramVersion`; add `Member.currentTierId`
- [ ] Run `pnpm db:migrate` to generate migration + Prisma client ⚠️ Deferred: requires running Postgres (Docker not available in this environment; migration file will be generated when DB is available)

### Shared Zod Schemas (`packages/shared/src/zod/`)
- [x] `program.schema.ts` — Add `type`, `startDate`, `endDate`, `budgetUsdCents`, `monthlyBudgetUsdCents`, `alertThresholdPct`, `haltBehavior` to `CreateProgramSchema`; add `SimulateSchema`; add `UpdateProgramStatusSchema`
- [x] `tier.schema.ts` — NEW: `CreateTierSchema`, `UpdateTierSchema`
- [x] `reward.schema.ts` — NEW: `CreateRewardSchema` with `type`, `availableFrom`, `availableTo`, `eligibleTierIds`; `RetireRewardSchema` with optional `expireAt`
- [x] `index.ts` — Export new schemas

### API Routes (`apps/api/src/routes/`)
- [x] `programs.ts` — Update `GET /programs` (filter + pagination envelope); update `GET /programs/:id` (include tiers + rewards); add `PUT /programs/:id/status`; add tier CRUD; add `DELETE /programs/:id/rewards/:rwId`; add `POST /programs/:id/simulate`; add `GET /programs/:id/versions[/:versionId]`; explicit-save creates `ProgramVersion`
- [x] `campaigns.ts` — Backfill pagination envelope `{ data, total, page, pageSize, totalPages }` on `GET /v1/campaigns`
- [x] `members.ts` — No list endpoint exists (confirmed); no change needed
- [x] `surveys.ts` — Backfill pagination envelope on `GET /v1/surveys` (done)
- [x] `app.ts` — All routes registered inline in programs.ts (no new route files needed)

### Worker (`apps/worker/src/processors/`)
- [x] `loyaltyEvents.ts` — Add `evaluateConditions(conditions, payload)` pure function; export `evaluateRulesWithIds()` with priority ordering (ASC), first-match-wins (stackable opt-in), per-rule `budgetCapPoints` check, program-level `budgetUsdCents` check

### Tests
- [x] `apps/worker/src/processors/loyaltyEvents.test.ts` — Unit tests for `evaluateConditions` (AND/OR, null, numeric operators) + `evaluateRulesWithIds` (priority, stackable, budget caps) — **87/87 passing**
- [x] `packages/shared/src/zod/program.schema.test.ts` — NEW: test updated schemas + new tier/reward/simulate schemas — **140/140 passing**
- [x] `apps/api/test/integration/programs.test.ts` — Extend: test pagination, filter, tier CRUD, reward retire, simulate, version, status transition, cross-tenant 404 ⚠️ Integration tests require DB (pending migration)
- [x] `packages/config/src/test-utils/` — Added `createTier()`, updated `createProgram()` to accept `type` field

### Validation Requirements (M1)
- `uiValidationRequired`: No (API only)
- `mobileValidationRequired`: No
- Manual: `curl` test all new endpoints with `X-Test-Brand-Id` header
- Run: `pnpm test` (no regressions), `pnpm typecheck`

---

## Milestone 2 — Shared UI Library + Programs Landing

### Shared Components (`apps/web/src/components/ui/`)
- [ ] `wizard-stepper.tsx` — Step indicator with checkmarks for completed steps, current step highlight
- [ ] `status-badge.tsx` — `StatusBadge` component with color by status (DRAFT=gray, ACTIVE=green, PAUSED=yellow, ARCHIVED=red)
- [ ] `paginated-table.tsx` — `PaginatedTable` with configurable columns, pageSize selector (10/25/50/100), onRowDoubleClick, renderRowActions
- [ ] `filter-bar.tsx` — `FilterBar` with search input + dropdown filters (Status, Type)
- [ ] `modal.tsx` — `Modal` with title, children, footer actions, ESC/overlay close
- [ ] `form-group.tsx` — `FormGroup` label + input wrapper with inline error display
- [ ] `condition-builder.tsx` — `ConditionBuilder`: AND/OR operator selector + dynamic condition rows (field/operator/value), add/remove row
- [ ] `view-only-banner.tsx` — `ViewOnlyBanner`: yellow warning banner with "✏️ Edit Program" button
- [ ] `budget-bar.tsx` — `BudgetBar`: progress bar showing budget used % with color thresholds
- [ ] `phone-preview.tsx` — `PhonePreview`: phone frame with member name, point balance, tier progress bar, rewards list

### Programs Landing Page
- [ ] `apps/web/src/app/(admin)/admin/programs/page.tsx` — Refactor: `FilterBar` (search/status/type) + `PaginatedTable` (name/type/status/dates/members/budget) + row actions (Edit/Pause/Reactivate/Delete drafts) + double-click → view-only

### Validation Requirements (M2)
- `uiValidationRequired`: Yes — Programs landing at all viewports (1280px, 768px, 375px)
- `mobileValidationRequired`: No (desktop-first per spec)
- Evidence: `docs/evidence/2-ui-polish-validation.md`

---

## Milestone 3 — 7-Step Wizard

### Page Routes (`apps/web/src/app/(admin)/admin/programs/`)
- [ ] `new/page.tsx` — Redirect to step 1 of wizard (or render wizard in create mode)
- [ ] `[id]/page.tsx` — View-only mode wrapper: render wizard with `isViewOnly=true`
- [ ] `[id]/edit/page.tsx` — Edit mode wrapper: render wizard with `isViewOnly=false`

### Wizard Shell (`apps/web/src/app/(admin)/admin/programs/_components/`)
- [ ] `program-wizard.tsx` — `useReducer` with `WizardState` (programId, currentStep, isViewOnly, isDirty, form, saveStatus); auto-save on step change (debounced 500ms, `source: auto_save`); explicit save (`source: explicit_save`); wizard header with inline date range; `WizardStepper`

### Wizard Steps (`apps/web/src/app/(admin)/admin/programs/_components/wizard-steps/`)
- [ ] `step1-type.tsx` — Program type selector: 4 cards (POINTS, TIERED, CASHBACK, HYBRID) with icons and descriptions
- [ ] `step2-basic-info.tsx` — Name, description, start/end dates, point currency name + ratio
- [ ] `step3-earning-rules.tsx` — Rule list with priority, stackable badge, `ConditionBuilder`; add/edit/delete rules
- [ ] `step4-tiers.tsx` — Tier ladder (Bronze→Platinum, ↓ arrows, drag-reorder); add/edit/delete tiers via `TierModal`
- [ ] `step5-rewards.tsx` — Rewards catalog; add/edit/retire rewards via `RewardModal` + `ExpireModal`
- [ ] `step6-budget.tsx` — Budget hard cap, monthly cap, alert threshold %, halt behavior selector
- [ ] `step7-preview.tsx` — Simulation panel (event type + payload inputs, Run Simulation button); `PhonePreview` with accumulating balance; activate checklist + `ActivateModal`

### Modals (`apps/web/src/app/(admin)/admin/programs/_components/modals/`)
- [ ] `tier-modal.tsx` — Tier name, icon picker (12 emoji presets), rank, minPoints, minSpendCents, benefits list, multiplier
- [ ] `reward-modal.tsx` — Reward name, description, type, pointsCost, stock, availableFrom/To, eligibleTierIds
- [ ] `expire-modal.tsx` — Radio: "Expire now" | "Expire on a future date" + date picker
- [ ] `activate-modal.tsx` — Pre-activation checklist (has rules, has name); confirm + submit

### Validation Requirements (M3)
- `uiValidationRequired`: Yes — all 7 wizard steps at 1280px and 768px
- Manual: complete full wizard flow (create → activate); verify auto-save; verify view-only mode
- Evidence: append to `docs/evidence/2-ui-polish-validation.md`

---

## Milestone 4 — Design System Rollout + E2E

### Apply to Other Admin Pages
- [ ] `apps/web/src/app/(admin)/admin/campaigns/page.tsx` — Apply `FilterBar`, `PaginatedTable`, `StatusBadge`
- [ ] `apps/web/src/app/(admin)/admin/surveys/page.tsx` — Apply `FilterBar`, `PaginatedTable`, `StatusBadge`

### E2E Tests
- [ ] `apps/web/test/e2e/critical-path.spec.ts` — Complete wizard (all 7 steps) → activate → verify on landing; simulate + verify phone preview; double-click → view-only; click Edit → edit mode

### Validation Requirements (M4)
- Run `pnpm test:e2e` and capture output as evidence
- `mobileValidationRequired`: No (desktop-first per spec)

---

## Quality Checklist (all milestones)

- [ ] No `TODO` / `FIXME` in committed code
- [ ] `pnpm typecheck` passes (zero errors)
- [ ] `pnpm test` passes (zero regressions)
- [ ] `pnpm lint` passes
- [ ] `brandId` never accepted from request body (JWT only)
- [ ] All new mutations emit audit events
- [ ] All new DB columns have defaults or are nullable (no data loss migration)

---

## Known Deferrals (out of scope for this issue)

| Item | Deferred to |
|---|---|
| Tier upgrade/downgrade logic (assigning `currentTierId` on point award) | Issue #4 (Earn Points) |
| Tier removal blocked if members in tier — guard wired but tier assignment in Issue #4 | Issue #4 |
| Phase 2 extraction of shared components to `packages/ui` | Issue #34 |
| Nested AND/OR condition groups | Issue #32 |
| ProgramVersion cleanup job | Phase 2 |
| Full mobile admin wizard | Phase 2 |
