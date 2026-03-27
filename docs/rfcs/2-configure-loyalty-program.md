# RFC: Configure Loyalty Program (Issue #2)

Issue: #2
Owner: manohar.madhira@outlook.com
Status: Draft
Date: 2026-03-26

---

## Customer

**Admin / Program Owner** — a brand's loyalty or marketing operations manager. Moderate technical familiarity; understands business rules but should not need engineering support to configure a program.

---

## Customer Problem Being Solved

Loyalty program configuration today is fragmented and high-friction. Competitors (Annex Cloud, Antavo) require professional services engagements measured in weeks. The admin cannot get from "idea" to "running program" in a single session. This is the foundational blocker — no other loyalty feature (earn points, redeem rewards, campaigns) can work without a configured program.

---

## User Experience That Will Solve the Problem

The admin navigates to **Admin Portal → Programs** and uses a 7-step guided wizard to configure a program in under 30 minutes. Every step auto-saves. Programs can be paused, reactivated, or deleted (drafts only) from the landing page. Double-clicking a program opens it in view-only mode.

**Entry → Wizard flow:**
1. Admin Dashboard → sidebar "Programs" → Programs landing page
2. Click "+ Create New Program" → Step 1: Program Type
3. Steps 2–6: Basic Info → Earning Rules → Tier Config → Rewards Catalog → Budget & Spend Controls
4. Step 7: Preview & Activate — simulate a purchase, see live member preview, activate

**Programs landing page features:**
- Table: name, type, status badge, date range, member count, budget bar
- Filter bar: search by name, dropdowns for Status and Type
- Configurable pagination: 10/25/50/100 rows per page (default 25), sorted by last-modified
- Row actions: Edit, Pause/Reactivate, Continue Setup, Delete (drafts only)
- Double-click → view-only mode with yellow banner + "✏️ Edit Program" button

---

## Technical Details

### 1. Design System — Site-Wide Standard

The look and feel defined in `docs/feature-specs/mocks/2-view.html` becomes the **site-wide UI baseline** for all admin portal pages across all issues. This ensures visual consistency across Programs, Campaigns, Surveys, Analytics, and Integrations.

#### Design Tokens (from mock → `apps/web/src/app/globals.css`)

Already defined — no change needed:
```css
--color-primary: #6366f1;      /* indigo-500 */
--color-primary-dark: #4f46e5; /* indigo-600 */
--background: #f8fafc;          /* slate-50 */
--foreground: #0f172a;          /* slate-900 */
```

#### Shared Component Library — `apps/web/src/components/ui/`

The following components are extracted from the mock and made reusable across all admin pages:

| Component | File | Used In |
|---|---|---|
| `WizardStepper` | `wizard-stepper.tsx` | Programs wizard, Campaigns builder, Survey builder |
| `StatusBadge` | `status-badge.tsx` | Programs table, Campaigns table, Surveys table |
| `PaginatedTable` | `paginated-table.tsx` | Programs, Members, Campaigns, Surveys landing pages |
| `FilterBar` | `filter-bar.tsx` | Programs, Campaigns, Surveys landing pages |
| `Modal` | `modal.tsx` | Tier modal, Reward modal, Expire modal, Activate modal |
| `FormGroup` | `form-group.tsx` | All wizard steps, Campaign builder |
| `ConditionBuilder` | `condition-builder.tsx` | Step 3 (Earning Rules), Campaign trigger config |
| `ViewOnlyBanner` | `view-only-banner.tsx` | Program view mode |
| `BudgetBar` | `budget-bar.tsx` | Programs table, Campaign budget display |
| `PhonePreview` | `phone-preview.tsx` | Step 7 simulation |

**Design rules enforced in all admin pages:**
- Cards: `rounded-xl border border-gray-200 bg-white` with `p-6`
- Primary button: `bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium`
- Ghost button: `text-gray-600 hover:bg-gray-100 rounded-lg`
- Table header: `bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide`
- Status badges: `rounded-full px-2.5 py-0.5 text-xs font-medium` with color by status
- Page layout: sidebar (220px) + main content (max-w-960px, p-8)

All existing pages (Campaigns, Surveys, Analytics, Integrations) will be updated to use these shared components in the implementation phase.

---

### 2. Database Schema Changes

#### 2a. Member model — add `currentTierId`

The spec requires "tier removal blocked if any members currently hold that tier." The current `Member` model has no `currentTier` field. Adding:

```prisma
model Member {
  // ... existing fields ...
  currentTierId  String?   // NEW — updated by worker when tier upgrades/downgrades
  currentTier    Tier?     @relation(fields: [currentTierId], references: [id])
  // ...
}
```

The worker updates `currentTierId` atomically as part of the point-award transaction when the new balance crosses a tier threshold. The tier removal endpoint checks `Tier._count.members > 0` before allowing deletion.

> **Note**: Tier upgrade/downgrade logic belongs in Issue #4 (Earn Points). For MVP in this issue, `currentTierId` is added to the schema and the tier removal guard is wired. Tier assignment itself is implemented in Issue #4.

---

#### 2a. Program model — add missing fields

```prisma
// New enum
enum ProgramType {
  POINTS
  TIERED
  CASHBACK
  HYBRID
}

enum HaltBehavior {
  PAUSE_PROGRAM
  PAUSE_RULES
}

// Updated Program model
model Program {
  id                   String        @id @default(cuid())
  brandId              String
  brand                Brand         @relation(fields: [brandId], references: [id])
  name                 String
  description          String?
  type                 ProgramType   @default(POINTS)          // NEW
  pointCurrencyName    String        @default("Points")
  pointToCurrencyRatio Float         @default(0.01)
  status               ProgramStatus @default(DRAFT)
  startDate            DateTime?                               // NEW
  endDate              DateTime?                               // NEW
  budgetUsdCents       Int?                                    // NEW — hard cap
  monthlyBudgetUsdCents Int?                                   // NEW — rolling cap
  alertThresholdPct    Int           @default(80)              // NEW — 0-100
  haltBehavior         HaltBehavior  @default(PAUSE_RULES)     // NEW
  budgetSpentCents     Int           @default(0)               // NEW — tracked by worker
  deletedAt            DateTime?                               // NEW — soft delete
  earningRules         EarningRule[]
  tiers                Tier[]                                  // NEW relation
  campaigns            Campaign[]
  rewards              Reward[]
  versions             ProgramVersion[]                        // NEW relation
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  @@index([brandId, status])
  @@index([brandId, deletedAt])
  @@map("programs")
}
```

#### 2b. EarningRule model — add priority, stackable, budgetCap, conditions evaluation

```prisma
model EarningRule {
  id               String     @id @default(cuid())
  programId        String
  program          Program    @relation(fields: [programId], references: [id])
  brandId          String
  name             String
  triggerEvent     String
  pointsAwarded    Int
  multiplier       Float      @default(1.0)
  conditions       Json?      // JSONB: { op: "AND"|"OR", items: [{ field, operator, value }] }
  priority         Int        @default(10)                    // NEW — lower = evaluated first
  stackable        Boolean    @default(false)                 // NEW — fires even after first match
  budgetCapPoints  Int?                                       // NEW — max points this rule awards
  budgetUsedPoints Int        @default(0)                     // NEW — tracked by worker
  maxUsesPerMember Int?
  status           RuleStatus @default(ACTIVE)
  validFrom        DateTime   @default(now())
  validTo          DateTime?
  createdAt        DateTime   @default(now())

  @@index([programId, status, priority])
  @@index([brandId])
  @@map("earning_rules")
}
```

#### 2c. Tier model — new

```prisma
model Tier {
  id            String   @id @default(cuid())
  brandId       String
  programId     String
  program       Program  @relation(fields: [programId], references: [id])
  rank          Int      // 1 = entry (Bronze), higher = more prestigious (Platinum)
  name          String
  icon          String   @default("🥉")
  minPoints     Int?     // entry criteria: min points balance
  minSpendCents Int?     // entry criteria: min cumulative spend in cents
  benefits      String[] // freeform benefit strings
  multiplier    Float    @default(1.0)
  deletedAt     DateTime?

  @@index([programId, rank])
  @@index([brandId])
  @@map("tiers")
}
```

#### 2d. Reward model — add type, availability dates, eligible tiers, soft-delete

```prisma
enum RewardType {
  DISCOUNT_CODE
  FREE_PRODUCT
  CASHBACK
  GIFT_CARD
  EXPERIENCE
}

model Reward {
  id              String       @id @default(cuid())
  brandId         String
  programId       String
  program         Program      @relation(fields: [programId], references: [id])
  name            String
  description     String?
  type            RewardType   @default(DISCOUNT_CODE)        // NEW
  pointsCost      Int
  stock           Int?
  isAvailable     Boolean      @default(true)
  availableFrom   DateTime?                                   // NEW
  availableTo     DateTime?                                   // NEW — scheduled expiry
  eligibleTierIds String[]     @default([])                   // NEW — empty = all tiers
  deletedAt       DateTime?                                   // NEW — soft delete
  retiredAt       DateTime?                                   // NEW — when retired
  redemptions     Redemption[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([brandId, isAvailable])
  @@index([programId, deletedAt])
  @@map("rewards")
}
```

#### 2e. ProgramVersion model — new (explicit save snapshots)

```prisma
model ProgramVersion {
  id        String   @id @default(cuid())
  programId String
  program   Program  @relation(fields: [programId], references: [id])
  brandId   String
  actorId   String   // Clerk user ID
  snapshot  Json     // Full program + rules + tiers + rewards at time of save
  createdAt DateTime @default(now())

  @@index([programId, createdAt])
  @@map("program_versions")
}
```

**Migration strategy:** All migrations are additive. New columns have defaults or are nullable — no data loss on existing records. Migration file: `packages/database/prisma/migrations/YYYYMMDD_issue2_program_wizard/`.

---

### 3. API Changes

#### 3a. Updated `GET /v1/programs`

Add filter/pagination query params:

```
GET /v1/programs?status=ACTIVE&type=POINTS&search=summer&page=1&pageSize=25&sortBy=updatedAt&sortOrder=desc
```

Response:
```json
{
  "programs": [...],
  "total": 47,
  "page": 1,
  "pageSize": 25,
  "totalPages": 2
}
```

#### 3b. Updated `GET /v1/programs/:id`

Include tiers and rewards in response:
```json
{
  "id": "...",
  "earningRules": [...],
  "tiers": [...],
  "rewards": [...]
}
```

#### 3c. New Tier endpoints

```
POST   /v1/programs/:id/tiers               → 201 tierId
PUT    /v1/programs/:id/tiers/:tierId       → 200
DELETE /v1/programs/:id/tiers/:tierId       → 200 (soft delete; blocked if members in tier — Phase 2)
GET    /v1/programs/:id/tiers               → 200 array sorted by rank
```

Tier body schema (Zod):
```typescript
const CreateTierSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).optional().default('🥉'),
  rank: z.number().int().positive(),
  minPoints: z.number().int().nonnegative().optional(),
  minSpendCents: z.number().int().nonnegative().optional(),
  benefits: z.array(z.string().max(100)).max(20).optional().default([]),
  multiplier: z.number().positive().optional().default(1.0),
})
```

#### 3d. Updated Reward endpoints

```
POST   /v1/programs/:id/rewards             → 201
PUT    /v1/programs/:id/rewards/:rwId       → 200
DELETE /v1/programs/:id/rewards/:rwId       → 200 (soft delete / retire)
  Optional body: { expireAt: "now" | ISO-date-string }
  - omitted or "now" → sets deletedAt = now(), isAvailable = false immediately
  - ISO date → sets availableTo = date; reward stays active until then (enforced at read time)
  In-progress redemptions honored through completion in all cases.
```

#### 3e. Updated Earning Rule endpoints

```
PUT    /v1/programs/:id/rules/:ruleId       → 200
DELETE /v1/programs/:id/rules/:ruleId       → 200 (soft delete via status=INACTIVE)
```

Rule schema updated to include `priority`, `stackable`, `budgetCapPoints`.

#### 3f. New Simulate endpoint

```
POST /v1/programs/:id/simulate
Body: {
  memberId?: string    // optional — use mock member if omitted
  eventType: string   // e.g. "purchase"
  payload: object     // e.g. { amount: 150, category: "Electronics", channel: "web" }
}
Response: {
  rulesMatched: [{ ruleId, ruleName, pointsAwarded, stackable }],
  totalPoints: number,
  firstMatchOnly: boolean,   // true if first-match-wins stopped evaluation
  simulatedBalance: number,  // member's current balance + totalPoints
  tierAfter: { name, icon } | null
}
```

The simulate endpoint runs the same `evaluateRulesWithIds` logic synchronously (no queue) against a hypothetical payload. It does NOT write any records.

#### 3g. New Program Version endpoint

```
GET /v1/programs/:id/versions               → list of snapshots (actorId, createdAt)
GET /v1/programs/:id/versions/:versionId    → full snapshot payload
```

Versions are created by the API on every explicit `PUT /v1/programs/:id` with `source: "explicit_save"` in the request body. Auto-saves (from step navigation) pass `source: "auto_save"` and skip version creation.

#### 3h. Status transition endpoint

```
PUT /v1/programs/:id/status
Body: { status: "ACTIVE" | "PAUSED" | "ARCHIVED" }
Guards:
  - DRAFT → ACTIVE: requires ≥1 earning rule
  - ACTIVE → PAUSED: allowed
  - PAUSED → ACTIVE: allowed (no data loss)
  - * → ARCHIVED: not reversible; soft-delete programs instead for drafts
```

---

### 4. Worker Changes — Rule Evaluation Engine Upgrade

File: `apps/worker/src/processors/loyaltyEvents.ts`

**Current behavior:** All matching rules fire (all-stackable). No condition evaluation. No priority ordering. No budget caps per rule.

**New behavior:**

```
1. Fetch earning rules ordered by priority ASC
2. For each rule (in priority order):
   a. Check triggerEvent matches
   b. Evaluate conditions JSONB against payload (new: evaluateConditions())
   c. Check maxUsesPerMember
   d. Check rule.budgetCapPoints
   e. If rule matches:
      - Add to firedRules[]
      - If rule.stackable === false: STOP (first-match-wins)
      - If rule.stackable === true: CONTINUE to next rule
3. Sum points from all firedRules
4. Check program.budgetUsdCents cap before awarding
5. Atomic transaction: LoyaltyEvent + pointsBalance increment
```

New `evaluateConditions()` pure function:
```typescript
// Evaluates a ConditionGroup against an event payload
// { op: "AND"|"OR", items: [{ field: string, operator: "="|"!="|">="|"<="|">"|"<", value: unknown }] }
export function evaluateConditions(
  conditions: ConditionGroup | null,
  payload: Record<string, unknown>
): boolean
```

This function is unit-tested exhaustively in `loyaltyEvents.test.ts`.

---

### 5. UI Changes — Programs Wizard (7 Steps)

#### File structure

```
apps/web/src/app/(admin)/admin/programs/
  page.tsx                    ← Programs landing (refactor existing)
  new/
    page.tsx                  ← Redirect to wizard step 1
  [id]/
    page.tsx                  ← View-only mode wrapper
    edit/
      page.tsx                ← Edit mode wrapper
  _components/
    programs-table.tsx        ← Paginated, filterable table
    program-wizard.tsx        ← 7-step wizard shell (client component)
    wizard-steps/
      step1-type.tsx          ← Program type selector
      step2-basic-info.tsx    ← Name, description, dates, currency
      step3-earning-rules.tsx ← Rule builder with ConditionBuilder
      step4-tiers.tsx         ← Tier ladder with TierModal
      step5-rewards.tsx       ← Rewards catalog with RewardModal + ExpireModal
      step6-budget.tsx        ← Budget controls
      step7-preview.tsx       ← Simulation + activate
    modals/
      tier-modal.tsx
      reward-modal.tsx
      expire-modal.tsx
      activate-modal.tsx
```

#### Wizard state management

The wizard uses a React `useReducer` with auto-save on step navigation:

```typescript
type WizardState = {
  programId: string | null   // null for new programs
  currentStep: number        // 1-7
  isViewOnly: boolean
  isDirty: boolean
  form: WizardFormData
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
}
```

Auto-save triggers `PUT /v1/programs/:id` with `source: "auto_save"` when `isDirty === true` and step changes. No toast on success; toast only on error.

Explicit "Save as Draft" triggers `PUT /v1/programs/:id` with `source: "explicit_save"` → API creates `ProgramVersion` snapshot.

#### Wizard header (inline date range)

```tsx
// Shown when editing/viewing (all steps) or creating (step 3+)
<div className="flex items-baseline gap-3 flex-wrap">
  <h1 className="text-2xl font-bold">{programName || 'Configure Loyalty Program'}</h1>
  {dateRange && (
    <span className="text-sm text-gray-500 font-normal">{dateRange}</span>
  )}
</div>
```

#### View-only mode

```tsx
// Yellow banner shown in view-only mode
<ViewOnlyBanner onEdit={() => router.push(`/admin/programs/${id}/edit`)} />
// All inputs disabled; action buttons hidden
```

#### Programs landing page refactor

```tsx
// Filter bar: search + status dropdown + type dropdown
<FilterBar ... />

// Table with pagination
<PaginatedTable
  columns={['Name', 'Type', 'Status', 'Date Range', 'Members', 'Budget', 'Actions']}
  pageSize={pageSize}          // configurable: 10/25/50/100
  onRowDoubleClick={openViewOnly}
  renderRowActions={(program) => (
    <>
      <EditButton />
      {program.status === 'ACTIVE' && <PauseButton />}
      {program.status === 'PAUSED' && <ReactivateButton />}
      {program.status === 'DRAFT' && <DeleteButton />}
    </>
  )}
/>
```

---

### 6. Design System — Application to Other Issues

The shared components from Section 1 apply to these existing admin pages:

| Issue | Page | Shared Component Adoption |
|---|---|---|
| #3 Member Portal | `(member)/dashboard/page.tsx` | `StatusBadge`, `PhonePreview` styling |
| #4 Earn Points | Worker UI feedback | `BudgetBar` for rule budget display |
| #5 Redeem Rewards | `(member)/rewards/page.tsx` | `PaginatedTable`, `StatusBadge` |
| #6 Campaign Builder | `(admin)/admin/campaigns/` | `WizardStepper`, `FilterBar`, `ConditionBuilder`, `PaginatedTable`, `Modal` |
| #7 Admin Notifications | Alert threshold UI | `FormGroup`, `Modal` |
| #9 CRM Integration | `(admin)/admin/integrations/` | `FormGroup`, `StatusBadge` |

The `apps/web/src/components/ui/` directory is created once during Issue #2 implementation and imported by all subsequent issue implementations.

---

### 7. Failure Modes & Timeouts

| Scenario | Behavior |
|---|---|
| Auto-save fails (network) | Toast error: "Auto-save failed — changes may be lost. Save manually." |
| Activation with no rules | API returns 422; wizard shows inline error on Step 7 checklist |
| Tier removal blocked (members in tier) | API returns 409 with `memberCount`; UI shows confirmation: "X members are in this tier — removal blocked." |
| Reward retire — in-progress redemptions | Redemptions with `status: PENDING` continue to `FULFILLED`; new redemptions blocked after `retiredAt` |
| Budget cap reached during rule evaluation | Worker checks `program.budgetSpentCents >= program.budgetUsdCents * 100` before awarding; if halt behavior is `PAUSE_RULES`, skips rule evaluation; if `PAUSE_PROGRAM`, queues status update to PAUSED |
| Simulate with no rules | Returns `{ rulesMatched: [], totalPoints: 0 }` with 200 (not an error) |

---

### 8. Telemetry & Analytics

New audit events emitted via existing `audit` plugin:

| Event | Trigger |
|---|---|
| `program.create` | POST /programs |
| `program.update` | PUT /programs/:id (both auto and explicit saves) |
| `program.activate` | PUT /programs/:id/status → ACTIVE |
| `program.pause` | PUT /programs/:id/status → PAUSED |
| `program.delete` | DELETE /programs/:id |
| `program.version.create` | Explicit save (source=explicit_save) |
| `rule.create` | POST /programs/:id/rules |
| `rule.update` | PUT /programs/:id/rules/:ruleId |
| `tier.create` | POST /programs/:id/tiers |
| `tier.update` | PUT /programs/:id/tiers/:tierId |
| `reward.create` | POST /programs/:id/rewards |
| `reward.retire` | POST /programs/:id/rewards/:rwId/retire |
| `program.simulate` | POST /programs/:id/simulate (non-mutating, still logged for usage analytics) |

---

## Confidence Level

**85/100.**

High confidence on schema, API, and worker changes — all follow established patterns in the codebase. The `ConditionBuilder` UI component is the most complex frontend piece but is well-specified by the mock. The simulation endpoint is a synchronous read-only path through existing rule evaluation logic — low risk.

Uncertainty (-15): The `eligibleTierIds` filter on rewards (checking member tier at redemption time) requires the worker to fetch the member's current tier, which depends on the Tier model being populated. This creates a dependency ordering constraint: tiers must be configured before rewards referencing them can be enforced.

---

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---|---|---|
| Admin creates a POINTS program via 7-step wizard | Program created with DRAFT status, all fields persisted | UI + API: `GET /v1/programs/:id` returns full program |
| Admin navigates away mid-wizard, returns later | Program auto-saved; all fields intact on return | UI: refresh between steps, verify form pre-populated |
| Admin adds 2 earning rules with priority + stackable | Rules saved with correct priority/stackable values | API: `GET /v1/programs/:id` includes earningRules with priority/stackable |
| Simulate purchase with Electronics rule (Stackable) + base rule | Both rules fire; totalPoints = sum; firstMatchOnly = false | API: `POST /v1/programs/:id/simulate` response |
| Simulate purchase without Electronics match | Only base rule fires; firstMatchOnly = true | API: simulate response rulesMatched length = 1 |
| Admin adds Bronze/Silver/Gold tiers | Tiers saved with correct rank, icon, multiplier | API + DB: `GET /v1/programs/:id` includes tiers array sorted by rank |
| Admin tries to remove Silver tier (23 members in tier) | 409 response; UI shows blocking message | API: DELETE /tiers/:id returns 409 |
| Admin retires a reward with Expire Now | Reward isAvailable = false immediately | API: `GET /v1/programs/:id` reward.isAvailable = false |
| Admin retires a reward with future date | Reward isAvailable = true until date | DB: reward.availableTo = future date; worker-scheduled check |
| Program reaches 80% budget threshold | Admin receives in-app + email alert | Worker: `processLoyaltyEvent` checks budgetSpentCents; Notification enqueued |
| Admin activates program with no rules | 422 response; checklist item in wizard shows error | API + UI validation |
| Admin double-clicks program row | Opens wizard in view-only mode | UI: ViewOnlyBanner shown; all inputs disabled |
| Admin saves draft explicitly | ProgramVersion record created | DB: `program_versions` table has new row |
| Auto-save does not create version | No ProgramVersion row on step navigation | DB: no new `program_versions` row after auto-save |
| Filter programs by status=ACTIVE | Only ACTIVE programs returned | API: `GET /v1/programs?status=ACTIVE` |
| Pagination: page 2, 10 per page | Second page of results | API: `GET /v1/programs?page=2&pageSize=10` |
| Cross-tenant isolation | Brand A cannot see Brand B's programs | API: 404 on cross-brand program ID |

---

## Test Matrix

### Unit Tests (`apps/worker/src/processors/loyaltyEvents.test.ts`)

- `evaluateConditions()`: AND group — all match, partial match, none match
- `evaluateConditions()`: OR group — one match, none match
- `evaluateConditions()`: null conditions → always true
- `evaluateConditions()`: numeric operators (≥, ≤, >, <)
- `evaluateRulesWithIds()`: priority ordering — first-match-wins stops at priority 1
- `evaluateRulesWithIds()`: stackable rule continues after first match
- `evaluateRulesWithIds()`: budget cap per rule — stops awarding when `budgetUsedPoints >= budgetCapPoints`
- `evaluateRulesWithIds()`: program budget cap — skips all rules when `budgetSpentCents >= budgetUsdCents * 100`

### Unit Tests (`packages/shared/src/zod/program.schema.test.ts`)

- Updated `CreateProgramSchema` with type, startDate, endDate, budgetUsdCents
- New `CreateTierSchema`, `UpdateTierSchema`
- Updated `CreateRewardSchema` with type, availableFrom, availableTo, eligibleTierIds
- New `SimulateSchema`

### Integration Tests (`apps/api/test/integration/programs.test.ts`)

- POST /programs: creates with all new fields (type, dates, budget)
- GET /programs: includes tiers and rewards in response
- GET /programs: filter by status, type, search
- GET /programs: pagination (page, pageSize)
- POST /programs/:id/tiers: creates tier; GET returns sorted by rank
- DELETE /programs/:id/tiers/:tierId: soft-delete (sets deletedAt); excluded from GET
- PUT /programs/:id/rules/:ruleId: updates priority and stackable
- POST /programs/:id/rewards/:rwId/retire: sets deletedAt + isAvailable=false
- POST /programs/:id/simulate: returns correct rulesMatched and totalPoints
- PUT /programs/:id/status → ACTIVE: creates ProgramVersion snapshot
- GET /programs/:id/versions: returns version list
- Cross-tenant: 404 when brandId doesn't match

### E2E Test (`apps/web/test/e2e/critical-path.spec.ts`)

- Complete wizard for a POINTS program (all 7 steps), activate, verify in Programs landing
- Add 2 earning rules, run simulation in Step 7, verify phone preview updates
- Double-click program → view-only mode; click Edit → edit mode

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Schema migration breaks existing programs data | Low | High | Additive-only migration; new columns have defaults or are nullable. Run migration in staging first. |
| Worker rule evaluation regression (existing all-fire behavior → first-match-wins) | Medium | High | The new evaluator is behind `stackable` flag. Default `stackable=false` gives first-match-wins for new rules. Existing rules in DB will default to `stackable=false` via migration default. Comprehensive unit tests cover edge cases. |
| `eligibleTierIds` filter causes redemption errors when no tiers configured | Medium | Medium | If `eligibleTierIds` is empty, all tiers are eligible (no filtering). Redemption route checks this before blocking. |
| Auto-save causes API rate limiting or data races (rapid step navigation) | Low | Low | Debounce auto-save calls by 500ms on the client. Only one in-flight save request at a time. |
| ProgramVersion snapshots grow large (JSON of full program) | Low | Low | Version size is bounded by program complexity (~5KB typical). No pagination needed for MVP. Add cleanup job in Phase 2. |
| Budget threshold notification delivery fails | Low | Medium | Notification is fire-and-forget via BullMQ; if notification worker fails, it retries. Budget tracking itself is unaffected. |

---

## Observability

### Logs (Pino structured JSON)

```json
// Rule evaluation — logged per event in worker
{ "level": "info", "event": "rules_evaluated", "programId": "...", "rulesMatched": 2, "totalPoints": 300, "firstMatchWins": false }

// Budget threshold hit
{ "level": "warn", "event": "budget_threshold_reached", "programId": "...", "pct": 82 }

// Budget hard cap hit
{ "level": "warn", "event": "budget_cap_enforced", "programId": "...", "haltBehavior": "PAUSE_RULES" }

// Simulation request
{ "level": "info", "event": "simulate_request", "programId": "...", "eventType": "purchase", "rulesMatched": 2 }
```

### Metrics (Azure Application Insights)

- `programs.created` counter
- `programs.activated` counter
- `programs.simulated` counter (usage signal)
- `rules.evaluated.per_event` histogram
- `budget.threshold.alerts` counter

---

## Architecture Analysis

### Patterns Correctly Followed

| Pattern | Architecture Source | How RFC Applies It |
|---|---|---|
| Multi-tenant `brandId` from JWT only | Section 6, Plugin 4.2 | All new endpoints (tiers, rewards, simulate) inherit `brandId` from `request.brandId`; never accepted from request body |
| Append-only loyalty ledger + atomic `pointsBalance` | Section 6, ADR-002 | Worker changes preserve `$transaction(LoyaltyEvent + member.pointsBalance)` |
| Event-driven: config = sync DB write; loyalty actions = BullMQ | Section 6 | Program/tier/reward CRUD writes directly to DB; point awards continue through BullMQ worker |
| Soft deletes | Section 10 (GDPR) | `deletedAt` added to Program, Reward, Tier — consistent with Member pattern |
| Shared Zod schemas in `packages/shared` | Section 3.5 | All new schemas (CreateTierSchema, CreateRewardSchema, SimulateSchema) added to `packages/shared/src/zod/` |
| Audit trail via audit plugin | Section 4.2 | All new mutations (tier create/update, reward retire, simulate) emit audit events via existing `audit` plugin |
| Centralized test utils in `packages/config` | Section 9.2, ADR-006 | Integration tests use existing factories from `@customerEQ/config/test-utils`; new factories (createTier, createReward) added there |
| Idempotency via Redis | Section 6 | Simulate endpoint is non-mutating; no idempotency key needed — correctly excluded |
| Pino structured logging | Section 2 | Worker logs use existing `job.log()` pattern with structured JSON fields |

---

### Patterns Missing from Architecture

The following patterns are introduced by this RFC but are not yet documented in `docs/architecture/architecture.md`. These should be added to the architecture doc during the address-feedback phase.

**1. Shared UI Component Library**
- **What**: RFC introduces `apps/web/src/components/ui/` as a site-wide design system component library (WizardStepper, PaginatedTable, FilterBar, Modal, etc.)
- **Gap**: Architecture Section 3.6 mentions `packages/ui` as only providing `cn()`. No pattern exists for where admin portal components live or how they're shared across admin pages.
- **Suggested resolution**: Document that shared UI primitives (layout-agnostic: Button, Badge, Modal, FormGroup) go in `packages/ui/src/components/`; feature-adjacent admin components go in `apps/web/src/components/ui/`. RFC uses the latter.

**2. Multi-Step Wizard with Auto-Save**
- **What**: RFC introduces a `useReducer`-based wizard with silent auto-save on step navigation and explicit save-and-version on "Save as Draft" click.
- **Gap**: Architecture has no documented pattern for multi-step forms, step state management, or client-side auto-save behavior.
- **Suggested resolution**: Document as a frontend pattern: "Multi-step admin forms use `useReducer` state with debounced auto-save (`PUT` with `source: auto_save`) and explicit version snapshots (`PUT` with `source: explicit_save`)."

**3. List Endpoint Pagination Envelope**
- **What**: RFC introduces `{ programs, total, page, pageSize, totalPages }` response shape on `GET /v1/programs`.
- **Gap**: No pagination pattern exists anywhere in the API today. Existing list endpoints return flat `{ programs: [...] }`. This RFC's envelope will set the precedent for all future list endpoints (campaigns, members, surveys).
- **Suggested resolution**: Adopt this as the standard paginated list envelope across all list endpoints. Add to architecture doc: "All list endpoints support `?page=1&pageSize=25&sortBy=updatedAt&sortOrder=desc` query params and return `{ data: [], total, page, pageSize, totalPages }`."
- **⚠️ Decision needed**: Should existing list endpoints (campaigns, members) be updated to this envelope at the same time, or deferred to their own issues? Please comment on the PR.

**4. Simulation / Dry-Run Endpoint Pattern**
- **What**: RFC introduces `POST /v1/programs/:id/simulate` — a command-style RPC endpoint that runs business logic synchronously without side effects.
- **Gap**: Architecture documents CRUD REST and event-ingestion (`POST /v1/events`) but not command-style dry-run endpoints.
- **Suggested resolution**: Document as: "Read-only simulation endpoints use `POST` (to accept a payload) and are suffixed `/simulate`. They never write to DB or enqueue jobs. Response includes a `dry_run: true` flag."

**5. Scheduled Soft-Expiry for Rewards**
- **What**: RFC introduces `availableTo` on Reward — when a date-based retire is set, the reward stays active until that date.
- **Gap**: Architecture has no documented pattern for time-based state transitions (scheduled expiry). Currently no scheduler exists.
- **Suggested resolution for MVP**: Enforce `availableTo` at read time — `GET /v1/programs/:id` filters out rewards where `availableTo < now()`. No background scheduler needed. Document as: "Scheduled availability is enforced at query time, not by a background job."

**6. Program-Level Budget Enforcement in Worker**
- **What**: RFC adds `program.budgetUsdCents` and `program.budgetSpentCents` that the loyalty events worker checks before awarding points.
- **Gap**: Architecture documents campaign-level budget caps in the worker but not program-level caps. The two systems coexist but are distinct.
- **Suggested resolution**: Document in worker section: "The loyalty events worker enforces both program-level budget caps (halt on `budgetSpentCents >= budgetUsdCents * 100`) and per-rule budget caps (`rule.budgetUsedPoints >= rule.budgetCapPoints`)."

---

### Patterns Incorrectly Followed

**1. Retire Endpoint Inconsistency with REST DELETE**
- **What**: RFC proposes `POST /v1/programs/:id/rewards/:rwId/retire` as a separate action endpoint.
- **Problem**: The existing architecture uses `DELETE` for soft-deletes uniformly (members, programs, rules). A separate `/retire` action creates an inconsistency in the API surface.
- **Resolution (pre-submission fix)**: Collapse retire into `DELETE /v1/programs/:id/rewards/:rwId` with an optional body `{ expireAt: "now" | ISO-date-string }`. If `expireAt` is omitted, defaults to "now". The API route is already being added — no net new endpoint.

**2. `packages/ui` vs `apps/web/src/components/ui/` split**
- **What**: RFC places shared components in `apps/web/src/components/ui/` (app-local).
- **Problem**: Architecture Section 3.6 shows `packages/ui` as the shared UI layer. Components placed in `apps/web` cannot be consumed by future `apps/mobile` or `apps/admin-v2` apps.
- **Resolution (open for discussion)**: For MVP where there is only one web app, `apps/web/src/components/ui/` is pragmatic. The risk of premature extraction to `packages/ui` is over-engineering. Recommending: keep components in `apps/web/src/components/ui/` now, note in architecture that extraction to `packages/ui` is a Phase 2 task when a second consumer exists.
- **⚠️ Decision needed**: Please confirm whether to keep in `apps/web` or move to `packages/ui` now.

---

## Implementation Order

1. **Prisma schema migration** — new enums, updated Program/EarningRule/Reward models, new Tier + ProgramVersion models
2. **Shared Zod schemas** — update `packages/shared/src/zod/program.schema.ts`; add tier, reward, simulate schemas
3. **Shared UI components** — create `apps/web/src/components/ui/` library (WizardStepper, StatusBadge, PaginatedTable, FilterBar, Modal, FormGroup, ConditionBuilder, ViewOnlyBanner, BudgetBar, PhonePreview)
4. **API — Programs routes** — filter/pagination on GET /programs; full response on GET/:id; new tier/reward/simulate/version endpoints; retire reward endpoint
5. **Worker — Rule evaluation engine** — `evaluateConditions()`, priority ordering, stackable, budget cap per rule + program
6. **UI — Programs landing page** — filter bar, pagination, view-only mode, draft deletion
7. **UI — 7-step wizard** — WizardFormState, auto-save, 7 step components, modals
8. **Apply design system to other admin pages** — update Campaigns, Surveys, Analytics, Integrations pages to use shared components
9. **Tests** — unit (evaluateConditions, schemas), integration (all new endpoints), E2E (wizard flow)
