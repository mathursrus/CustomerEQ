# Technical Design: [UC-09] Configure Loyalty Program

Issue: #2
PR: *(see below — created as part of this submission)*
Branch: `feature/2-issue-2`
Date: 2026-03-26
Agent: manohar.madhira@outlook.com

---

## Completeness Evidence

- Issue tagged with label `phase:design`: No — label does not exist in repo yet; `enhancement`, `p0`, `loyalty-engine`, `admin`, `phase-1` are present
- Issue tagged with label `status:needs-review`: Yes — being added as part of this submission
- All design documents committed/synced to branch: **Yes** (see Work Completed below)

### Work Completed

| File | Description |
|------|-------------|
| `docs/rfcs/2-configure-loyalty-program.md` | Full RFC covering Customer, Problem, UX, Technical Details (design system, schema, API, worker, UI), Failure Modes, Telemetry, Confidence Level, Validation Plan, Test Matrix, Risks, Architecture Analysis, Observability, Implementation Order |

### Approach

1. **Context gathering**: Read existing programs routes, worker rule evaluator, Prisma schema, shared Zod schemas, architecture doc, feature spec, interactive mock, and project rules before designing.
2. **Schema design**: Identified 5 models requiring changes (Program, EarningRule, Reward, Member) and 3 new models (Tier, ProgramVersion) plus 3 new enums (ProgramType, HaltBehavior, RewardType). All migrations are additive.
3. **API design**: Designed 9 new/updated API groups following existing REST patterns; introduced pagination envelope, simulate dry-run endpoint, and explicit save/version endpoint.
4. **Worker design**: Replaced all-fire rule evaluation with priority-ordered, first-match-wins (stackable opt-in) evaluation with per-rule and program-level budget caps.
5. **UI design**: Designed 7-step wizard file structure, `useReducer` state model, auto-save with debounce, view-only mode, and 10 reusable shared components for site-wide design system adoption.
6. **Architecture gap analysis**: Identified 6 patterns missing from architecture doc and 2 incorrectly followed patterns; proposed resolutions for all.

### PR Comment History

| PR Comment | How Addressed |
|------------|---------------|
| *(Design phase — initial RFC submission)* | N/A |

---

## Traceability Matrix

Every requirement from `docs/feature-specs/2-configure-loyalty-program.md` is mapped below to the RFC section that addresses it, with validation plan alignment.

### Functional Requirements

| Req ID | Requirement | RFC Section | Status | Validation |
|--------|-------------|-------------|--------|------------|
| R-01 | Program types: POINTS, TIERED, CASHBACK, HYBRID selectable in Step 1 | §2a `ProgramType` enum + §5 `step1-type.tsx` | ✅ Met | Integration: POST /programs with each type |
| R-02 | 7-step guided wizard (Type → Basic Info → Earning Rules → Tiers → Rewards → Budget → Preview) | §5 File structure + wizard-steps directory | ✅ Met | E2E: Complete wizard all 7 steps |
| R-03a | Earning rules: trigger event, points, multiplier | §2b EarningRule model (existing fields) + §3e rule endpoints | ✅ Met | Integration: PUT /programs/:id/rules/:ruleId |
| R-03b | Earning rules: AND/OR condition groups with field/operator/value | §2b `conditions` JSONB + §4 `evaluateConditions()` + §5 `ConditionBuilder` | ✅ Met | Unit: evaluateConditions() full coverage |
| R-03c | Earning rules: priority ordering (lower = evaluated first) | §2b `priority` field + §4 worker priority ordering | ✅ Met | Unit: evaluateRulesWithIds() priority ordering |
| R-03d | Earning rules: stackable flag (fires even after first match) | §2b `stackable` field + §4 first-match-wins logic | ✅ Met | Unit: stackable rule continues after first match |
| R-03e | Earning rules: per-rule budget cap (max points this rule awards) | §2b `budgetCapPoints` + `budgetUsedPoints` + §4 worker check | ✅ Met | Unit: evaluateRulesWithIds() budget cap per rule |
| R-04a | Tier configuration: name, icon, rank (drag-reorder) | §2c Tier model (rank, name, icon) + §3c tier endpoints + §5 `step4-tiers.tsx` | ✅ Met | Integration: POST /tiers; GET sorted by rank |
| R-04b | Tier entry criteria: min points OR min cumulative spend | §2c `minPoints`, `minSpendCents` fields | ✅ Met | Integration: POST /tiers with both criteria |
| R-04c | Tier benefits (freeform strings) and point multiplier | §2c `benefits[]`, `multiplier` fields | ✅ Met | Integration: GET /programs/:id includes tiers with benefits |
| R-04d | Tier removal blocked if members currently in that tier | §2a `Member.currentTierId` + §3c DELETE 409 guard | ✅ Met | Integration: DELETE /tiers/:id returns 409 when members present |
| R-05a | Rewards catalog: name, description, type, points cost, stock | §2d Reward model (type, pointsCost, stock) + §3d reward endpoints | ✅ Met | Integration: POST /programs/:id/rewards |
| R-05b | Rewards: availability dates (availableFrom, availableTo) | §2d `availableFrom`, `availableTo` + §7 scheduled expiry at read time | ✅ Met | Integration: GET /programs/:id filters expired rewards |
| R-05c | Rewards: eligible tier restriction | §2d `eligibleTierIds[]` field | ✅ Met | Integration: GET returns eligibleTierIds; redemption route checks |
| R-05d | Rewards: retire with Expire Now or scheduled future date | §3d DELETE endpoint with `{ expireAt }` body + §7 failure modes | ✅ Met | Integration: DELETE /rewards/:id → isAvailable=false |
| R-06a | Budget: lifetime hard cap (USD) | §2a `budgetUsdCents` + §4 worker pre-award check | ✅ Met | Unit: budget cap enforced; Integration: POST /programs with budget |
| R-06b | Budget: monthly rolling cap | §2a `monthlyBudgetUsdCents` field | ✅ Met | Integration: POST /programs with monthlyBudget |
| R-06c | Budget: alert threshold % with in-app + email alert | §2a `alertThresholdPct` + §8 telemetry + §7 failure modes | ✅ Met | Validation: Worker checks budgetSpentCents; notification enqueued |
| R-06d | Budget: halt behavior on cap hit (pause program or pause rules) | §2a `haltBehavior` enum (PAUSE_PROGRAM, PAUSE_RULES) + §4 worker | ✅ Met | Unit: budget_cap_enforced log; halt behavior branches |
| R-07a | Preview: simulate a purchase event (Step 7) | §3f POST /programs/:id/simulate endpoint | ✅ Met | Integration: simulate returns rulesMatched + totalPoints |
| R-07b | Preview: phone preview shows live member state | §5 `step7-preview.tsx` + `PhonePreview` component | ✅ Met | E2E: Step 7 phone preview updates on simulation |
| R-07c | Activate: requires ≥1 earning rule (checklist validation) | §3h status transition guard + §7 failure modes | ✅ Met | Integration: PUT /status → ACTIVE returns 422 if no rules |
| R-08a | Programs landing: table with name, type, status, dates, members, budget bar | §5 PaginatedTable + `programs-table.tsx` | ✅ Met | E2E: Programs landing shows all columns |
| R-08b | Programs landing: filter by name search, status, type | §3a GET /programs query params + §5 FilterBar | ✅ Met | Integration: GET /programs?status=ACTIVE&type=POINTS |
| R-08c | Programs landing: configurable pagination (10/25/50/100, default 25) | §3a pagination envelope + §5 PaginatedTable | ✅ Met | Integration: GET /programs?page=2&pageSize=10 |
| R-08d | Programs landing: row actions (Edit, Pause/Reactivate, Continue Setup, Delete drafts) | §5 programs-table renderRowActions + §3h status endpoint | ✅ Met | E2E: Row actions visible per status |

### UX Requirements

| Req ID | Requirement | RFC Section | Status | Validation |
|--------|-------------|-------------|--------|------------|
| UX-01 | Auto-save on step navigation (silent, no toast on success) | §5 WizardState + auto-save with `source: auto_save` + debounce 500ms | ✅ Met | UI: Navigate away mid-wizard, return, verify fields intact |
| UX-02 | View-only mode — yellow banner + Edit button; all inputs disabled | §5 ViewOnlyBanner + `isViewOnly` state | ✅ Met | E2E: Double-click program row → view-only mode |
| UX-03 | Inline date range in wizard header | §5 Wizard header snippet | ✅ Met | UI: Date range shown inline below program name |
| UX-04 | Double-click row → opens program in view-only mode | §5 PaginatedTable `onRowDoubleClick` | ✅ Met | E2E: Double-click opens ViewOnlyBanner |
| UX-05 | Explicit save → creates ProgramVersion snapshot | §3g POST /programs/:id/versions + §5 "Save as Draft" button | ✅ Met | DB: program_versions row created; auto-save does not create row |
| UX-06 | Stackable badge shown on rule header when stackable=true | Mock: badge visible on Step 3 rule header | ✅ Met | UI: Stackable badge present when checkbox checked |
| UX-07 | Tier arrows show progression direction (Bronze → Platinum) | Mock: ↓ arrows, Bronze at top (entry) → Platinum at bottom | ✅ Met | UI: Tier list order in Step 4 |
| UX-08 | Retire reward modal (Expire Now / Expire on future date) | Mock + §3d DELETE endpoint with expireAt | ✅ Met | UI: Retire modal opens; both options functional |

### Compliance Requirements

| Req ID | Requirement | RFC Section | Status | Validation |
|--------|-------------|-------------|--------|------------|
| C-01 | Multi-tenant: brandId from JWT only, never from request body | §3 "All new endpoints inherit brandId from request.brandId" | ✅ Met | Integration: Cross-tenant 404 test |
| C-02 | Soft deletes on Program, Tier, Reward | §2a `deletedAt` on Program; §2c on Tier; §2d on Reward | ✅ Met | Integration: DELETE sets deletedAt; excluded from GET |
| C-03 | Audit trail for all mutations | §8 Telemetry — all 13 audit events listed | ✅ Met | Integration: audit_events row created per mutation |
| C-04 | No data loss on program pause/unpause | §3h status transitions — PAUSED → ACTIVE allowed | ✅ Met | Integration: Pause then reactivate program; all data intact |
| C-05 | In-progress redemptions honored through retire | §3d "In-progress redemptions honored through completion" + §7 failure modes | ✅ Met | Integration: PENDING redemptions unaffected by reward retire |

### Non-Functional Requirements

| Req ID | Requirement | RFC Section | Status | Validation |
|--------|-------------|-------------|--------|------------|
| NFR-01 | Mobile responsiveness — wizard usable on mobile viewports | Mock: responsive CSS + spec note | ✅ Met | E2E: Playwright mobile viewport test |
| NFR-02 | Rule evaluation correctness on priority + stackable change | §4 worker changes + §4 unit tests | ✅ Met | Unit: 8 evaluateConditions + 5 evaluateRulesWithIds cases |
| NFR-03 | No regression on existing all-fire behavior for existing rules | §Risks: "existing rules default to stackable=false via migration" | ✅ Met | Integration: Existing DB rules unaffected |
| NFR-04 | Simulate endpoint is non-mutating (no DB writes, no queue) | §3f "does NOT write any records" | ✅ Met | Integration: No LoyaltyEvent row after simulate call |
| NFR-05 | Pagination on all list endpoints follows standard envelope | §7 gap: pagination envelope + ⚠️ open decision on backfill | ⚠️ Partial | Decision needed: backfill campaigns/members/surveys? |

---

## Architectural Gaps

The following gaps were identified during architecture analysis (RFC Section "Patterns Missing from Architecture"). These are documented here for reviewer action.

### Gap 1 — Shared UI Component Library placement (⚠️ Decision Needed)
- **RFC proposes**: Components in `apps/web/src/components/ui/` (app-local)
- **Architecture says**: `packages/ui` is the shared UI layer
- **Risk**: App-local components cannot be consumed by future `apps/mobile` or `apps/admin-v2`
- **Proposed resolution**: Keep in `apps/web/src/components/ui/` for MVP; extract to `packages/ui` in Phase 2 when second consumer exists
- **Action**: Reviewer to confirm on PR

### Gap 2 — Multi-Step Wizard with Auto-Save (Missing Pattern)
- **What's new**: `useReducer`-based wizard with silent auto-save on step navigation
- **Architecture gap**: No documented pattern for multi-step forms or client-side auto-save
- **Proposed addition to arch doc**: "Multi-step admin forms use `useReducer` state with debounced auto-save (`PUT` with `source: auto_save`) and explicit version snapshots (`PUT` with `source: explicit_save`)."

### Gap 3 — Pagination Envelope (⚠️ Decision Needed)
- **RFC proposes**: `{ programs, total, page, pageSize, totalPages }` on GET /programs
- **Architecture gap**: No pagination standard exists; existing endpoints return flat arrays
- **Risk**: If not standardized now, future issues will invent inconsistent envelopes
- **Proposed resolution**: Adopt `{ data: [], total, page, pageSize, totalPages }` as the standard for all list endpoints
- **Action**: Reviewer to decide whether existing endpoints (campaigns, members) are updated now or deferred

### Gap 4 — Simulation / Dry-Run Endpoint Pattern (Missing Pattern)
- **What's new**: `POST /v1/programs/:id/simulate` — command-style RPC, no side effects
- **Architecture gap**: Architecture documents CRUD REST and event-ingestion but not dry-run command endpoints
- **Proposed addition**: "Read-only simulation endpoints use `POST` (to accept a payload), are suffixed `/simulate`, never write to DB or enqueue jobs, and include `dry_run: true` in response."

### Gap 5 — Scheduled Soft-Expiry for Rewards (Missing Pattern)
- **What's new**: `availableTo` on Reward — enforced at query time, not by background scheduler
- **Architecture gap**: No documented pattern for time-based state transitions
- **Proposed resolution (MVP)**: Enforce at read time — `GET /v1/programs/:id` filters `availableTo < now()`. No background scheduler needed.

### Gap 6 — Program-Level Budget Enforcement in Worker (Missing Pattern)
- **What's new**: Worker checks `program.budgetUsdCents` and `program.budgetSpentCents` before awarding
- **Architecture gap**: Architecture documents campaign-level budget caps only
- **Proposed addition**: "The loyalty events worker enforces both program-level budget caps and per-rule budget caps independently."

---

## Open Decisions

| # | Decision | Options | Owner | Status |
|---|----------|---------|-------|--------|
| OD-1 | Shared UI components: `apps/web/src/components/ui/` vs `packages/ui` | (A) Keep in apps/web for MVP; (B) Move to packages/ui now | Reviewer | ⏳ Pending |
| OD-2 | Pagination backfill: update existing list endpoints now or defer | (A) Defer to each issue; (B) Backfill campaigns/members now | Reviewer | ⏳ Pending |
