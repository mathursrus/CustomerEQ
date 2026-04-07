# Feature: Survey Trigger Wizard — Technical Design

Issue: #79
Owner: swavaktp

---

## Customer

Marketing Manager who needs the platform to guide them on when to send a survey and what type — based on loyalty program context — before they write a single question.

## Customer Problem Being Solved

The current `POST /v1/surveys → /admin/surveys/new` flow is a single-step form with no trigger guidance. Managers must choose survey type blind (no rationale), have no loyalty moment awareness, and get no reach estimate. This produces low-response-rate batch sends that are disconnected from loyalty lifecycle moments.

## User Experience That Will Solve the Problem

1. Manager navigates to `/admin/surveys/new`
2. **Step 1 (NEW)**: Trigger wizard renders — three category cards (Loyalty Moment, CX Risk, Scheduled). No question editor visible.
3. Manager selects category → sub-trigger picker appears (dynamic for Loyalty Moment from earn rules, static for CX Risk / Scheduled)
4. Manager selects sub-trigger → recommendation box shows type + rationale (computed client-side from static map)
5. Reach estimate fetched from `GET /v1/analytics/reach-estimate?triggerKey=<key>&programId=<id>` → badge rendered
6. Manager optionally overrides survey type (inline picker, rationale preserved)
7. Manager clicks "Continue" → Step 2 (existing survey builder content) with trigger + type pre-filled
8. On submit → `POST /v1/surveys` with `triggerCategory`, `triggerKey`, `surveyType` fields included
9. Survey list + detail pages surface "Loyalty Moment: Tier Upgrade · CSAT" badge from persisted fields

---

## Technical Details

### UI Changes

#### `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — Full Refactor

Current: single-step form (`name`, `programId`, `type`, `incentivePoints`).

New: 2-step wizard:
- **Step 1** (`TriggerStep` component): category cards → sub-trigger pills → recommendation box → reach estimate → override picker → "Continue"
- **Step 2** (`ContentStep` component): existing form fields (`name`, `programId`, `incentivePoints`, question preview) → "Create Survey"

State shape:
```typescript
type WizardStep = 1 | 2

interface TriggerState {
  category: 'loyalty' | 'cx_risk' | 'scheduled' | null
  triggerKey: string | null          // e.g. 'tier_upgrade'
  recommendedType: SurveyType        // from getTriggerRecommendation()
  selectedType: SurveyType           // recommended or overridden
  overrideOpen: boolean
}
```

Step 1 does NOT submit; it validates locally and sets `TriggerState`, then advances to Step 2.
Step 2 submits with all fields including `triggerCategory`, `triggerKey`, `surveyType`.

#### New file: `apps/web/src/components/surveys/TriggerStep.tsx`

Pure presentational component. Props:
```typescript
interface TriggerStepProps {
  programId: string                  // needed for reach estimate fetch
  onComplete: (trigger: TriggerState) => void
}
```

Sub-components (all in same file or co-located):
- `CategoryCard` — clickable card with icon, title, description
- `SubTriggerPills` — pill buttons; loyalty moment pills loaded from API, others static
- `RecommendationBox` — green box with type, rationale, override link
- `OverridePicker` — inline type selector (NPS/CSAT/CES/Custom), rationale note
- `ReachBadge` — reach count or unavailable fallback

#### New file: `apps/web/src/utils/triggerRecommendation.ts`

Pure client-side lookup (no API call for R32). Mirrors the 11-row table from the spec:

```typescript
export interface TriggerRecommendation {
  type: 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'
  rationale: string
  isDefault?: boolean
}

export function getTriggerRecommendation(triggerKey: string): TriggerRecommendation
```

Static map — no server round-trip. Fallback: `{ type: 'NPS', rationale: 'NPS is the standard default for unmapped triggers.', isDefault: true }`.

#### `apps/web/src/app/(admin)/admin/surveys/page.tsx` — Trigger badge

Add `triggerCategory` + `triggerKey` display to each survey card (e.g. "⭐ Tier Upgrade · CSAT"). Reads from survey list API response (no additional fetch).

#### `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — Trigger header

Add trigger + type display to survey detail page header.

---

### API Surface Changes

#### 1. New endpoint: `GET /v1/analytics/reach-estimate`

Added to `apps/api/src/routes/analytics.ts`.

**Request**:
```
GET /v1/analytics/reach-estimate?triggerKey=tier_upgrade&programId=<id>
Authorization: Bearer <clerk-jwt>
```

**Response** (200):
```json
{
  "estimatedCount": 47,
  "channels": { "email": 47, "inApp": 38, "sms": 12 },
  "windowDays": 30
}
```

**Response** — insufficient history (200, not error):
```json
{
  "estimatedCount": null,
  "reason": "insufficient_history",
  "channels": null,
  "windowDays": 30
}
```

**Implementation** — query strategy:

```typescript
// Trigger key → LoyaltyEvent.eventType mapping
const TRIGGER_EVENT_MAP: Record<string, string> = {
  tier_upgrade:        'tier.upgraded',
  first_redemption:    'redemption.first',
  '5th_purchase':      'purchase',   // filtered by count
  enrollment:          'member.enrolled',
  anniversary:         'member.anniversary',
  inactive_30d:        'member.inactive',
  after_support:       'cx.support_closed',
  nps_drop:            'cx.nps_drop',
  quarterly_pulse:     null,          // scheduled → count all active members
  monthly_csat:        null,
  annual_program:      null,
}
```

For event-based triggers: count `LoyaltyEvent` rows where `eventType = <mapped>` AND `brandId = req.brandId` AND `programId = <id>` AND `createdAt >= now() - 30d`. Divide by 30 to get daily rate, multiply by 30 = projected 30-day reach.

For scheduled triggers: count active members in the program (`Member.status = ACTIVE`).

History sufficiency check: if oldest `LoyaltyEvent` for this program is < 7 days ago → return `insufficient_history`.

Channel breakdown: count members in result set with `emailOptIn = true`, `smsOptIn = true` for the respective channels. In-app = all (all members receive in-app).

**Performance**: `LoyaltyEvent` already has index `(brandId, createdAt)` — range scan is fast. Add `(brandId, programId, eventType, createdAt)` composite index for this query pattern (new migration).

**Error handling**: any DB failure → return `{ estimatedCount: null, reason: 'query_error' }` — never block the UI.

#### 2. New endpoint: `GET /v1/programs/:id/trigger-options`

Added to `apps/api/src/routes/programs.ts`.

Returns dynamic sub-trigger options for the Loyalty Moment category based on configured earn rules (R37).

**Response** (200):
```json
{
  "loyaltyMoments": [
    { "key": "tier_upgrade", "label": "Tier Upgrade", "icon": "🏆" },
    { "key": "first_redemption", "label": "First Redemption", "icon": "🎁" },
    { "key": "enrollment", "label": "Enrollment", "icon": "✅" }
  ],
  "hasEarnRules": true
}
```

**Implementation**: query `EarningRule` where `programId = id AND status = ACTIVE`. Map `triggerEvent` strings to display labels via a static `TRIGGER_LABEL_MAP`. Deduplicate by `triggerEvent`. If no rules → return `{ loyaltyMoments: [], hasEarnRules: false }`.

Static map covers known `triggerEvent` values (`purchase`, `survey_complete`, `enrollment`, `tier.upgraded`, `redemption.first`, `member.anniversary`). Unknown values surfaced as `{ key: triggerEvent, label: triggerEvent, icon: '⚡' }` — not dropped.

CX Risk and Scheduled sub-triggers are **static** (hardcoded in frontend) — no API needed.

#### 3. Extended `POST /v1/surveys` body

No route signature change. `CreateSurveySchema` gains optional trigger fields (existing surveys without triggers still work):

```typescript
// packages/shared/src/zod/survey.schema.ts — additions to CreateSurveySchema
triggerCategory: z.enum(['loyalty', 'cx_risk', 'scheduled']).optional(),
triggerKey: z.string().max(50).optional(),
surveyTypeOverride: z.enum(['NPS', 'CSAT', 'CES', 'CUSTOM']).nullable().optional(),
```

The `type` field continues to drive the actual survey type (NPS/CSAT/CES/CUSTOM). `surveyTypeOverride` captures whether the manager deviated from the recommendation (analytics use case — not required for MVP).

Route handler passes new fields to `prisma.survey.create`.

---

### Data Model Changes

#### `packages/database/prisma/schema.prisma` — Survey model additions

```prisma
model Survey {
  // ... existing fields ...

  // Trigger wizard fields (Issue #79)
  triggerCategory    String?  // 'loyalty' | 'cx_risk' | 'scheduled'
  triggerKey         String?  // e.g. 'tier_upgrade', 'after_support'
  surveyTypeOverride String?  // non-null only when manager overrode recommendation

  // ... rest of existing fields ...
}
```

All three fields nullable — fully backwards-compatible. No existing surveys affected.

**Migration**: `prisma migrate dev --name add_survey_trigger_fields`

#### New DB index

```prisma
// packages/database/prisma/schema.prisma — LoyaltyEvent
@@index([brandId, programId, eventType, createdAt])
```

Needed for the reach estimate query. Current `(brandId, createdAt)` index will be used as fallback until migration runs.

---

### Pure Function: `getTriggerRecommendation`

Lives in `apps/web/src/utils/triggerRecommendation.ts`. Client-side only. No API call.

Full 11-entry static map:

```typescript
const RECOMMENDATIONS: Record<string, TriggerRecommendation> = {
  tier_upgrade:      { type: 'CSAT', rationale: 'After a tier upgrade, members are at peak engagement. CSAT measures upgrade experience quality — not overall relationship health.' },
  first_redemption:  { type: 'CSAT', rationale: 'First redemption is peak satisfaction. CSAT captures reward experience quality at the moment members are most positive.' },
  '5th_purchase':    { type: 'CSAT', rationale: 'A milestone purchase measures interaction quality at a defined engagement threshold. CSAT is ideal for moment-level feedback.' },
  enrollment:        { type: 'CES', rationale: 'Enrollment friction predicts early churn. CES measures how easy the process was — the primary signal at onboarding.' },
  anniversary:       { type: 'NPS', rationale: 'After one year, a relationship health check is appropriate. NPS measures loyalty and likelihood to recommend.' },
  inactive_30d:      { type: 'NPS', rationale: 'Inactive members need a relationship health signal. NPS reveals whether disengagement is transient or structural.' },
  after_support:     { type: 'CES', rationale: 'Post-support, effort is the key signal. CES measures how easy resolution was — low effort drives retention.' },
  nps_drop:          { type: 'NPS', rationale: 'A follow-up NPS confirms whether the drop was transient or structural — the same metric for direct comparison.' },
  quarterly_pulse:   { type: 'NPS', rationale: 'Quarterly benchmarking uses NPS as the standard relationship health metric across the industry.' },
  monthly_csat:      { type: 'CSAT', rationale: 'Monthly CSAT tracks satisfaction trends at a shorter window — better for detecting product-level changes.' },
  annual_program:    { type: 'NPS', rationale: 'Annual program satisfaction is a strategic health check. NPS captures overall loyalty and advocacy signals.' },
}
```

Unit-testable in isolation. Zero dependencies.

---

### Failure Modes & Timeouts

| Scenario | Behavior |
|----------|----------|
| `GET /v1/analytics/reach-estimate` timeout (> 5s) | Frontend shows "Reach estimate unavailable" — does not block Continue |
| `GET /v1/programs/:id/trigger-options` fails | Frontend shows static fallback Loyalty Moment options (tier_upgrade, first_redemption, enrollment) — logs warning |
| `POST /v1/surveys` with trigger fields — validation fails | 422 with Zod errors; trigger fields are optional so only fails on invalid enum values |
| Manager proceeds without selecting a sub-trigger | Frontend blocks Continue with inline validation — never reaches API |
| Survey created without trigger fields (old path) | `triggerCategory = null` — no display in survey list/detail. Graceful. |

---

### Telemetry & Analytics

- Log `triggerKey` and `surveyTypeOverride` (non-null = manager deviated from recommendation) in the `POST /v1/surveys` audit event. Already handled by the existing audit plugin.
- `GET /v1/analytics/reach-estimate`: log query duration with Pino at debug level. No new metric emission needed for MVP.

---

## Confidence Level

**90/100** — All patterns are established:
- Wizard step pattern: mirrors `CampaignForm` refactor from Issue #78
- Reach estimate pattern: mirrors `computeInsights()` DB queries from Issue #78
- Schema extension: nullable columns, non-breaking migration
- Pure function recommendation: same pattern as `computeInsights()`

Remaining 10% uncertainty: reach estimate query performance on large programs before the new composite index is available. Mitigated by 5s timeout + graceful fallback.

---

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|--------------|-----------------|-------------------|
| Manager clicks "+ New Survey" | Step 1 (trigger wizard) renders, no question editor visible | E2E: assert `data-testid="trigger-step"` present, `data-testid="survey-content-step"` absent |
| Manager selects "Loyalty Moment" | Sub-trigger pills appear, dynamically loaded from earn rules API | Integration: GET /v1/programs/:id/trigger-options returns array from DB |
| Manager selects "Tier Upgrade" | Recommendation box shows CSAT + rationale | Unit: getTriggerRecommendation('tier_upgrade').type === 'CSAT' |
| Sub-trigger selected → reach badge | Badge shows count or "unavailable" fallback | Integration: GET /v1/analytics/reach-estimate returns estimatedCount |
| Reach estimate API fails | "Reach estimate unavailable" shown, Continue not blocked | Unit/Integration: mock API failure → badge shows fallback |
| Manager overrides to NPS, clicks Continue | Step 2 loads with type=NPS pre-filled | E2E: override → continue → assert survey-type-select value=NPS |
| Manager submits survey | POST /v1/surveys includes triggerCategory, triggerKey | Integration: DB survey row has trigger fields populated |
| Survey list page | "⭐ Tier Upgrade · CSAT" badge visible on survey card | E2E: assert survey card trigger badge text |
| Program with no earn rules | Loyalty Moment sub-picker shows empty state with link | Integration: GET /v1/programs/:id/trigger-options → hasEarnRules=false |
| triggerKey not in recommendation map | Fallback NPS returned with isDefault=true | Unit: getTriggerRecommendation('unknown_key').isDefault === true |

---

## Test Matrix

### Unit Tests

**New file**: `apps/web/src/utils/triggerRecommendation.test.ts`
- All 11 trigger keys return correct type + non-empty rationale
- Unknown key returns NPS fallback with `isDefault: true`
- Types are one of 'NPS' | 'CSAT' | 'CES' | 'CUSTOM'

**New file**: `apps/api/src/utils/triggerRecommendation.test.ts` (if server-side copy needed for future)
- Mirrors client-side tests for server-side reach estimate key mapping

### Integration Tests

**Modify**: `apps/api/test/integration/analytics.test.ts`
- `GET /v1/analytics/reach-estimate?triggerKey=tier_upgrade&programId=<id>` → 200 `{ estimatedCount: N, channels: {...} }`
- `GET /v1/analytics/reach-estimate?triggerKey=tier_upgrade&programId=<id>` with no history → 200 `{ estimatedCount: null, reason: 'insufficient_history' }`
- `GET /v1/analytics/reach-estimate?triggerKey=quarterly_pulse&programId=<id>` → counts active members
- Missing `triggerKey` param → 400

**Modify**: `apps/api/test/integration/programs.test.ts`
- `GET /v1/programs/:id/trigger-options` with earn rules → returns `loyaltyMoments` array, `hasEarnRules: true`
- `GET /v1/programs/:id/trigger-options` with no earn rules → `{ loyaltyMoments: [], hasEarnRules: false }`

**Modify**: `apps/api/test/integration/surveys.test.ts`
- `POST /v1/surveys` with `triggerCategory`, `triggerKey` → survey created with trigger fields in DB
- `POST /v1/surveys` without trigger fields → still succeeds (backwards compat)
- `POST /v1/surveys` with invalid `triggerCategory` → 422

### E2E Tests

**New file**: `apps/web/test/e2e/survey-trigger-wizard.spec.ts`

One E2E test covering the happy path end-to-end (all API calls mocked via `page.route()`):
1. Navigate to `/admin/surveys/new`
2. Assert trigger step visible, no content step
3. Select "Loyalty Moment" → assert sub-trigger pills appear
4. Select "Tier Upgrade" → assert recommendation box shows "CSAT"
5. Assert reach badge appears
6. Click "Continue" → assert content step (name input) visible
7. Fill name → submit → assert redirect to `/admin/surveys/<id>`

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Reach estimate query slow on large programs (missing composite index) | Medium | Low (non-blocking UI) | 5s timeout + graceful fallback; composite index added in same migration |
| `EarningRule.triggerEvent` values don't match `TRIGGER_EVENT_MAP` keys | Low | Medium (reach estimate returns 0) | Map covers all known values; unknown keys → scheduled query fallback (active member count) |
| `CreateSurveySchema` change breaks existing survey creation integrations | Low | High | All new fields are `optional()` — existing `POST /v1/surveys` calls unaffected |
| Step 1 → Step 2 state lost on browser back | Low | Low | Wizard state held in React state (same page component, not separate routes) — back button not applicable |
| Dynamic sub-triggers empty for new programs | High (expected) | Low | R37 specifies empty state with link — implemented as Scenario D in mock |

---

## Observability

- **Pino audit log**: `POST /v1/surveys` audit event includes `triggerCategory`, `triggerKey`, `surveyTypeOverride` fields when present (via existing audit plugin — no code change needed)
- **Reach estimate query duration**: logged at debug level in analytics route handler: `fastify.log.debug({ triggerKey, durationMs }, 'reach-estimate query')`
- **Override tracking**: `surveyTypeOverride !== null` in the DB is the signal that a manager deviated — queryable for future product analytics

---

## Architecture Analysis

### Patterns Correctly Followed

| Pattern | How This Design Follows It |
|---------|---------------------------|
| Clerk JWT auth on all `/v1/*` routes | `GET /v1/analytics/reach-estimate` and `GET /v1/programs/:id/trigger-options` go through the existing `auth` + `multiTenant` preHandler plugins — no special handling needed |
| Zod schema validation on API requests | `CreateSurveySchema` extended with optional fields; new query params (`triggerKey`, `programId`) validated with `z.string()` before DB access |
| Multi-tenant `brandId` scoping | All new DB queries filter by `request.brandId` from JWT — never from request body (multiTenant plugin enforces this) |
| `Promise.all` for parallel analytics sub-queries | Reach estimate is a single query — no parallelism needed. If future sub-queries are added, `Promise.all` pattern from `computeInsights()` applies |
| Audit plugin fire-and-forget | `POST /v1/surveys` audit capture picks up new trigger fields automatically — no code change needed |
| Client `'use client'` directive for interactive forms | `TriggerStep` and the refactored `new/page.tsx` are client components — matches survey builder, campaign builder conventions |
| Nullable schema migrations for new model fields | All three new Survey columns (`triggerCategory`, `triggerKey`, `surveyTypeOverride`) are nullable — fully backwards compatible, existing surveys unaffected |
| `searchParams` pre-fill for context-aware navigation | Not directly used here, but the `getTriggerRecommendation()` pure function follows the same pattern as `computeInsights()` — deterministic, no side effects |

### Patterns Missing from Architecture

| Pattern | Description | Suggested Architecture Doc Update |
|---------|-------------|----------------------------------|
| **Web app utility functions in `apps/web/src/utils/`** | `getTriggerRecommendation()` is a pure client-side recommendation function. The architecture doc documents shared utilities in `packages/shared/src/` but does not mention `apps/web/src/utils/` as a location for web-only pure functions. This pattern already exists (e.g. `apps/web/src/lib/config.ts`) but is undocumented. | Add to §3.1 (Presentation Layer): "Client-side utilities co-located in `apps/web/src/utils/` for pure functions that are web-only (e.g. recommendation lookups, formatting helpers) — not exported to packages/shared." |
| **Non-blocking analytics endpoints with graceful fallback** | `GET /v1/analytics/reach-estimate` returns a structured "unavailable" response on DB failure or timeout, rather than a 500. This pattern (used previously in `program-health`) is not documented as an architectural standard. | Add to §4.1 (API Routes): note that analytics sub-query endpoints follow a graceful-degradation contract: DB/timeout failures return `{ estimatedCount: null, reason: '...' }` (200) rather than 5xx — preventing UI blocking on non-critical reads. |
| **`GET` sub-resources on programs route for configuration data** | `GET /v1/programs/:id/trigger-options` is a new read-only sub-resource returning computed configuration (earn rule → display label mapping). The architecture doc describes `/v1/programs` as "CRUD for loyalty programs + earning rules + tiers..." but doesn't mention the pattern of adding read-only sub-resource endpoints for derived/computed program data. | Add to §4.1: "Sub-resource endpoints on `/v1/programs/:id/` for computed/derived configuration data (e.g. `trigger-options`, future `segment-preview`) follow GET-only, no-pagination convention." |

### Patterns Incorrectly Followed

None identified. All design decisions follow established patterns from the codebase and architecture document.

---

## Architecture Doc Update

**Section 4.1 (API Routes)** — update `/v1/analytics` row:

> `GET /v1/analytics/reach-estimate` — projected member reach for a given trigger key over the next 30 days (Issue #79)

Add to `/v1/programs` row:

> `GET /v1/programs/:id/trigger-options` — dynamic loyalty moment sub-trigger options from configured earn rules (Issue #79)

**Section 4.4 (Database Models)** — Survey model entry: add "New (Issue #79): `triggerCategory`, `triggerKey`, `surveyTypeOverride` (nullable) — persists trigger wizard selections."
