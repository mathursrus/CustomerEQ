# Feature: Unified CX+Loyalty Operator Dashboard

Issue: #78
Owner: swavaktp
Date: 2026-04-03
Status: Draft

---

## Customer

**Marketing Manager / Admin (Operator)** — a mid-market brand operator using CustomerEQ to manage their loyalty program and CX feedback. Currently must switch between the CX section and the Loyalty section of the admin portal to correlate how member sentiment connects to program health.

---

## Customer Problem Being Solved

The operator's admin home shows CX health and loyalty program health as two disconnected sections. There is no single view that answers "how are my members feeling, and what is my loyalty program doing about it?" Marketing managers must mentally correlate NPS scores from one table and redemption rates from another. Gap F11 in Issue #75 spec.

---

## User Experience That Will Solve the Problem

### Step-by-step workflow

1. Marketing Manager logs into CustomerEQ → lands on `/admin` (the admin home dashboard — currently a redirect to analytics)
2. Home dashboard displays **two side-by-side panels**:
   - **CX Health panel** (left): avg NPS, active surveys, 30-day response rate, at-risk member count (NPS < 7)
   - **Loyalty Health panel** (right): active members, points issued this week, redemption rate (last 30 days), active campaigns
3. Below the panels, an **Insights** section shows 1–3 pre-computed rule-based insights connecting CX data to loyalty outcomes, e.g.:
   - "18 detractors (NPS < 7) have not redeemed a reward in the last 30 days — consider a win-back campaign"
   - "Members who completed a survey this month earned 2.1× more points on average"
4. Manager clicks the "18 detractors" badge → navigates to `/admin/campaigns/new?filter=detractors&minNps=0&maxNps=6`, where the campaign builder pre-populates the segment condition
5. Dashboard loads within 3 seconds via a single API call (`GET /v1/analytics/program-health`) that runs all DB queries in parallel

### Empty states

- No surveys → CX Health panel shows "No surveys yet — create your first survey to start collecting member feedback" with a "Create survey" CTA
- No campaigns → Loyalty Health panel shows "No campaigns active — set up a campaign to start rewarding members" with a "Create campaign" CTA
- No members → both panels show minimal zero-state with onboarding nudge

---

## Technical Details

### UI Changes

**New route: `apps/web/src/app/(admin)/admin/page.tsx`** (replaces current redirect to `/admin/analytics`)

This becomes the operator home dashboard — a React Server Component (RSC) that fetches `/v1/analytics/program-health` server-side using the Clerk auth token.

**Component structure:**
```
AdminHomePage (RSC — server-fetches /v1/analytics/program-health)
├── ProgramHealthPanels (client — two-column grid)
│   ├── CXHealthPanel
│   │   ├── StatCard (avg NPS)
│   │   ├── StatCard (active surveys)
│   │   ├── StatCard (response rate)
│   │   └── AtRiskBadge (clickable → /admin/campaigns/new?filter=detractors)
│   └── LoyaltyHealthPanel
│       ├── StatCard (active members)
│       ├── StatCard (points this week)
│       ├── StatCard (redemption rate)
│       └── StatCard (active campaigns)
└── InsightsSection
    └── InsightCard[] (1–3 rule-based insights, each with optional CTA)
```

**Modified: `apps/web/src/app/(admin)/admin/campaigns/new/page.tsx`**
- Accept `filter`, `minNps`, `maxNps` query params via `searchParams`
- Pre-populate the Audience / Conditions section of the campaign builder with a condition group: `nps_score BETWEEN minNps AND maxNps` when `filter=detractors`

### API Surface Changes

**New endpoint: `GET /v1/analytics/program-health`**

No query params — always returns last 30 days for CX Health and last 7 days for Loyalty Health (fixed windows match the UX copy).

Response shape:
```typescript
{
  cxHealth: {
    avgNps: number | null          // NPS score (-100 to 100)
    activeSurveys: number          // surveys with status ACTIVE
    responseRate: number           // % of invited members who responded (0–100)
    atRiskCount: number            // members with NPS < 7 in last 30 days
  }
  loyaltyHealth: {
    activeMembers: number          // Member.status = ACTIVE
    pointsIssuedThisWeek: number   // sum(LoyaltyEvent.pointsEarned > 0) last 7 days
    redemptionRate: number         // redemptions / activeMembers * 100
    activeCampaigns: number        // Campaign.status = ACTIVE
  }
  insights: Array<{
    id: string                     // stable rule ID for deduplication
    message: string                // human-readable insight string
    ctaLabel?: string              // e.g. "Create win-back campaign"
    ctaHref?: string               // e.g. "/admin/campaigns/new?filter=detractors"
    severity: 'info' | 'warning'   // warning = action recommended
  }>
}
```

**File: `apps/api/src/routes/analytics.ts`** — add handler for `GET /analytics/program-health`

All four data blocks are fetched in parallel via `Promise.all`:
```
Promise.all([
  cxHealthQuery(brandId),       // SurveyResponse join, last 30d
  loyaltyHealthQuery(brandId),  // Member count + LoyaltyEvent aggregates, last 7d
  atRiskQuery(brandId),         // detractors with no redemption last 30d
  insightRulesEngine(brandId),  // applies 3 rule templates against DB data
])
```

### Data Model / Schema Changes

**No new Prisma models required.** All data is computable from existing tables:

| Data point | Source |
|---|---|
| `avgNps` | `SurveyResponse.score` where `Survey.type = NPS` and `createdAt > -30d` |
| `activeSurveys` | `Survey.status = ACTIVE` count |
| `responseRate` | `SurveyResponse` count / `Member.status = ACTIVE` count (approximation) |
| `atRiskCount` | distinct `SurveyResponse.memberId` where `score < 7` and `createdAt > -30d` |
| `activeMembers` | `Member.status = ACTIVE` |
| `pointsIssuedThisWeek` | `SUM(LoyaltyEvent.pointsEarned) WHERE pointsEarned > 0 AND createdAt > -7d` |
| `redemptionRate` | `COUNT(Redemption) / COUNT(Member.status=ACTIVE) * 100` |
| `activeCampaigns` | `Campaign.status = ACTIVE` |

**At-risk insight query** (rule ID `detractors-no-redemption`):
```sql
SELECT COUNT(DISTINCT sr."memberId")
FROM survey_responses sr
JOIN members m ON sr."memberId" = m.id
LEFT JOIN redemptions r ON r."memberId" = m.id 
  AND r."createdAt" > NOW() - INTERVAL '30 days'
WHERE sr."brandId" = $brandId
  AND sr.score < 7
  AND sr."createdAt" > NOW() - INTERVAL '30 days'
  AND r.id IS NULL
```

**Survey-to-points multiplier insight** (rule ID `survey-completers-earn-more`):
Compares `AVG(member.pointsBalance)` for members with a SurveyResponse in last 30 days vs members without. Only surfaces if multiplier ≥ 1.5×.

### Insights Rules Engine

Three deterministic rules run at request time (no LLM, no async job):

| Rule ID | Condition | Message template | CTA |
|---|---|---|---|
| `detractors-no-redemption` | atRiskCount > 0 | "{{n}} detractors (NPS < 7) have not redeemed a reward in 30 days" | Create win-back campaign → `/admin/campaigns/new?filter=detractors&maxNps=6` |
| `survey-completers-earn-more` | multiplier ≥ 1.5 | "Members who completed a survey earned {{n}}× more points this month" | Create survey → `/admin/surveys/new` |
| `low-response-rate` | responseRate < 20% AND activeSurveys > 0 | "Your survey response rate is {{n}}% — consider adding a reward incentive" | Add reward → `/admin/rewards/new` |

Rules are evaluated in priority order; at most 3 insights are shown. Rules with no qualifying data are omitted silently.

**Future**: LLM-generated insights (BAML call with CX+loyalty context) can replace or augment rule-based insights in a follow-on issue. The `insights[]` array shape is forward-compatible.

### Failure Modes & Timeouts

- `GET /v1/analytics/program-health` has a 5-second timeout (Fastify `requestTimeout`)
- If any sub-query fails, the handler returns partial data with that field set to `null` and a `warnings[]` array noting the failure — never a 5xx for a stat that's unavailable
- UI panels render with `—` for null values (same as existing analytics KPI cards)
- Insights section is omitted if the insights query fails

### Design Standards

Generic UI baseline applied: Tailwind CSS v4 + shadcn/ui (Radix primitives). Components follow existing `apps/web/src/` patterns:
- Two-column panel grid uses `grid grid-cols-1 md:grid-cols-2 gap-6` (consistent with existing analytics grid)
- Stat cards reuse the `KPICard` pattern from `analytics/page.tsx`
- Insights cards use `rounded-xl border bg-white p-4` with a colored left border (`border-l-4 border-amber-400` for warnings, `border-indigo-400` for info)
- At-risk badge is a clickable `<a>` (not a button) for accessibility and SEO

---

## Confidence Level

**88 / 100**

High confidence. All data exists in current DB schema. Pattern matches existing `analytics.ts` raw query approach. Main uncertainty: `responseRate` computation — the spec says "response rate" but the exact denominator isn't defined. Using `responses / activeMembers` as approximation; if a `SurveyInvite` table is added later this can be refined without breaking the API contract.

---

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---|---|---|
| Manager opens admin home | CX Health + Loyalty Health panels render side by side | Browser (Playwright): assert panels `data-testid="cx-health-panel"` and `data-testid="loyalty-health-panel"` visible |
| No surveys exist | CX Health panel shows "No surveys yet" empty state | Browser: assert `data-testid="cx-health-empty"` visible |
| No campaigns exist | Loyalty Health panel shows "No campaigns active" | Browser: assert `data-testid="loyalty-health-empty"` visible |
| 18 detractors with no redemption | Insight shows "18 detractors ... have not redeemed" | API: `GET /v1/analytics/program-health` with seeded data, assert `insights[0].id = "detractors-no-redemption"` and `message` contains "18" |
| Click "18 detractors" CTA | Navigates to campaign builder with `filter=detractors` pre-populated | Browser: click badge, assert URL contains `filter=detractors`, assert campaign builder condition input populated |
| Dashboard load time | Responds in < 3s | API integration test: assert response time < 3000ms |
| API sub-query failure | Returns partial data, not 5xx | API: mock one sub-query to fail, assert 200 with `warnings` array |

---

## Test Matrix

**Unit tests** (`packages/shared` or `apps/api/src/`)
- Insights rules engine: `computeInsights()` pure function with mocked inputs
  - `detractors-no-redemption` fires when `atRiskCount > 0`
  - `survey-completers-earn-more` fires when `multiplier >= 1.5`
  - `low-response-rate` fires when `responseRate < 20` and `activeSurveys > 0`
  - At most 3 insights returned
  - Rules with no qualifying data omitted

**Integration tests** (`apps/api/test/integration/analytics.test.ts`)
- `GET /v1/analytics/program-health` → 200 with correct shape
- CX Health: seeded NPS responses → correct `avgNps` and `atRiskCount`
- Loyalty Health: seeded loyalty events → correct `pointsIssuedThisWeek`
- Insights: seeded detractors with no redemption → `detractors-no-redemption` in response
- Empty brand → all counts = 0, insights = []
- Partial failure (mocked query timeout) → 200 with `warnings` array

**E2E test** (`apps/web/test/e2e/unified-dashboard.spec.ts`)
- Mock `GET /v1/analytics/program-health` response via `page.route()`
- Assert CX Health panel visible with mocked NPS
- Assert Loyalty Health panel visible with mocked member count
- Assert insight card visible with CTA link
- Click CTA → assert navigation to pre-filtered campaign builder URL
- Assert `< 3s` load: measure `performance.timing` in browser

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `responseRate` denominator undefined in spec | Medium | Use `activeMembers` as denominator for MVP; document assumption; refine if `SurveyInvite` table added |
| DB query performance with large datasets | Medium | All queries use `brandId` index (existing); `atRiskCount` cross-join query may be slow at scale → add `LIMIT 1000` guard and async pre-computation if needed |
| `program-health` endpoint missing from admin nav | Low | Home dashboard is the new `/admin` route — replaces current redirect. No nav change needed. |
| Campaign builder `searchParams` pre-fill bypassed by user | Low | Pre-fill is UX convenience only, not security-relevant — operator is already authenticated |
| Insights rules surfacing misleading data | Medium | Cap display at 3 insights; only surface rules with statistically significant counts (atRiskCount ≥ 5, multiplier based on ≥ 10 members). Thresholds configurable as constants. |
| LLM insights deferred | Low | Rule-based system is fully specified. LLM enhancement is a follow-on issue, not a blocker. |

---

## Observability

- Fastify route log on `GET /v1/analytics/program-health`: log `brandId`, query duration (ms per sub-query), insights count
- If any sub-query exceeds 2s, log at `warn` level with query name
- `insights.generated` counter metric (per rule ID) for tracking which insights are most commonly surfaced — add to existing Pino structured log
- Dashboard render time tracked by existing Vercel analytics (no new instrumentation needed)

---

## Architecture Analysis

### Patterns Correctly Followed

| Pattern | Architecture Reference | How Design Follows It |
|---|---|---|
| RSC server-side data fetching with Clerk token | §3.1 "Server components fetch with Clerk token" | `AdminHomePage` is an RSC that fetches `/v1/analytics/program-health` server-side using `getAuthToken()` before rendering |
| New route under `/v1/analytics/*` | §4.1 Route table — `/v1/analytics` row | `GET /v1/analytics/program-health` added to existing `analyticsRoutes` Fastify plugin |
| Parallel DB queries via `Promise.all` | Pattern in existing `analytics.ts:117` | All four sub-queries run concurrently; no sequential waterfalls |
| `brandId` from JWT only, never request body | §4.2 `multiTenant` plugin | All queries scoped to `request.brandId` derived from JWT; no brand param in query string |
| Tailwind utility-first CSS | §2 UI stack: "Tailwind CSS v4 + shadcn/ui" | Components use `grid`, `rounded-xl`, `border` Tailwind utilities; no inline styles |
| Additive-only schema change | Convention established in prior issues | No new Prisma models; all data computable from existing tables |

### Patterns Missing from Architecture

| Pattern | Description | Suggested Resolution |
|---|---|---|
| **Admin home route** | §3.1 documents `(admin)/` module group but does not call out `/admin/page.tsx` as the operator home entry point. The architecture implies `/admin/analytics` is the home but this changes with #78. | Update §3.1 to note `/admin/page.tsx` as operator home dashboard; `/admin/analytics` remains as drill-down analytics. |
| **Rule-based insights engine** | The design introduces a deterministic, in-process computation layer (`computeInsights()`) that joins CX + loyalty data to surface actionable strings. This is a new computational pattern not covered in §3.2 or §3.3. | Add a note in §4.1 analytics route section: "Insights are computed in-process by a rule engine (`computeInsights()`) reading CX + loyalty aggregates. Rules are deterministic; LLM generation is a deferred enhancement." |
| **URL-state-to-form-preload pattern** | The design uses `searchParams` (`filter=detractors&maxNps=6`) to pre-populate the campaign builder form. This is a new UX pattern (metric click-through → pre-filtered builder) not documented in the architecture. | Add to §3.1 Web App patterns: "Context-aware navigation: CX metric click-throughs use `searchParams` to pre-populate campaign/survey builder forms without a separate API round-trip." |

### Patterns Incorrectly Followed

None found. The design correctly applies all documented architectural patterns.

---

## Open Questions

| ID | Question | Decision |
|---|---|---|
| OQ-1 | Should the home dashboard replace `/admin/analytics` or coexist alongside it? | **Decision**: Replace — the new dashboard subsumes the existing KPI cards + adds CX/insights. The existing analytics page becomes deeper drill-down (keep at `/admin/analytics`). Home dashboard at `/admin`. |
| OQ-2 | LLM-generated insights vs rule-based? | **Decision**: Rule-based for MVP (no latency, no API cost, deterministic). LLM enhancement deferred to a follow-on issue. |
| OQ-3 | `responseRate` denominator — invited members or active members? | **Decision**: `activeMembers` (approximation) for MVP. Note in code. |
