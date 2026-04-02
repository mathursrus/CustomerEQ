# Technical Design: Spin-the-Wheel Campaign

Issue: #83
Owner: Claude (technical-design job)
Spec: `docs/feature-specs/83-spin-the-wheel-campaign.md`

## Customer

Marketing managers who want interactive, gamified campaign rewards. Loyalty members who want a fun spin-to-win experience instead of silent point deposits.

## Customer Problem Being Solved

Campaign rewards are invisible — members get silent point deposits with no interactive moment. This feature adds a `spin_wheel` action type that presents members with an animated prize wheel where they spin to reveal their reward, driving 30-50% higher engagement.

## User Experience That Will Solve the Problem

### Admin Flow
1. Navigate to `/admin/campaigns/new`
2. Select "Spin Wheel" as action type
3. Configure 2-8 wheel segments (reward, probability, label, color)
4. See live wheel preview updating in real-time
5. Save as draft, then activate
6. Copy embed code snippet for brand's website

### Member Flow
1. Qualifying event triggers campaign (e.g., purchase, NPS survey)
2. System performs weighted random selection, stores result in `CampaignEvent.result`
3. Member receives notification with spin link
4. Member visits brand site with embedded `<ceq-spin-wheel>` component
5. Component calls `POST /v1/public/campaigns/:id/play` with member JWT
6. Wheel animates and lands on pre-determined winning segment
7. Reward is displayed with celebration animation

## Technical Details

### 1. Schema Changes

#### 1.1 Prisma Migration: Add `result` to CampaignEvent

```prisma
model CampaignEvent {
  // ...existing fields...
  result      Json?     // NEW: { winningIndex, rewardId?, points?, label }
}
```

**Migration**: `ALTER TABLE campaign_events ADD COLUMN result JSONB;`
Non-breaking — existing rows have `result = NULL`.

**File**: `packages/database/prisma/schema.prisma`

#### 1.2 No New Models Required

The spin wheel reuses existing models:
- `Campaign` — `actionType: "spin_wheel"`, `actionConfig` holds wheel config
- `CampaignEvent` — `result` JSON stores pre-determined outcome
- `Reward` — existing catalog items become wheel segments
- `Redemption` — created when winning segment has a rewardId
- `LoyaltyEvent` — created when winning segment has points
- `Member` — pointsBalance incremented for points-based wins

### 2. Zod Schema Changes

**File**: `packages/shared/src/zod/campaign.schema.ts`

```typescript
// NEW: Spin wheel segment schema
export const SpinWheelSegmentSchema = z.object({
  rewardId: z.string().optional(),
  points: z.number().int().nonnegative().optional(),
  probability: z.number().min(0).max(100),
  label: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
}).refine(
  (d) => d.rewardId !== undefined || d.points !== undefined,
  { message: 'Segment must have rewardId or points' }
)

// NEW: Spin wheel config schema
export const SpinWheelConfigSchema = z.object({
  segments: z.array(SpinWheelSegmentSchema).min(2).max(8),
  wheelStyle: z.enum(['classic', 'neon', 'minimal']).default('classic'),
}).refine(
  (d) => Math.abs(d.segments.reduce((sum, s) => sum + s.probability, 0) - 100) < 0.01,
  { message: 'Segment probabilities must sum to 100%' }
)

// MODIFIED: Extend actionType enum
export const CreateCampaignSchema = z.object({
  // ...existing fields...
  actionType: z.enum(['award_points', 'award_reward', 'send_message', 'spin_wheel']),
  actionConfig: z.union([ActionConfigSchema, SpinWheelConfigSchema]),
  // ...existing fields...
})
```

**Validation approach**: Use `z.union` with discriminated refinement — when `actionType === 'spin_wheel'`, validate `actionConfig` against `SpinWheelConfigSchema`; otherwise use existing `ActionConfigSchema`. Implement via `.superRefine()` on `CreateCampaignSchema`.

### 3. API Changes

#### 3.1 Modified: `POST /v1/campaigns` (admin)

**File**: `apps/api/src/routes/campaigns.ts`

No route changes needed — the existing route already accepts `actionType` as a string and `actionConfig` as JSON. The Zod schema extension handles validation. One change: import and use the updated `CreateCampaignSchema`.

#### 3.2 New: `POST /v1/public/campaigns/:id/play` (member)

**File**: `apps/api/src/routes/public.ts` (add to existing public routes file)

```typescript
fastify.post(
  '/public/campaigns/:id/play',
  { config: { public: true } },
  async (request, reply) => {
    // 1. Extract member identity from JWT (Authorization: Bearer <token>)
    //    Use Clerk's verifyToken() for member JWT
    //    Unlike admin routes, this is a member token, not an org token
    const memberToken = extractMemberJwt(request)
    if (!memberToken) return reply.code(401).send({ error: 'Authentication required' })

    // 2. Look up member by email from JWT claims
    const member = await fastify.prisma.member.findFirst({
      where: { email: memberToken.email, deletedAt: null },
      select: { id: true, brandId: true, consentGivenAt: true, erased: true }
    })
    if (!member || member.erased) return reply.code(404).send({ error: 'Not found' })
    if (!member.consentGivenAt) return reply.code(403).send({ error: 'Consent required' })

    // 3. Fetch campaign + validate
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id: request.params.id, brandId: member.brandId, status: 'ACTIVE' }
    })
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' })
    if (campaign.endDate && campaign.endDate < new Date())
      return reply.code(410).send({ error: 'Campaign has ended' })
    if (campaign.actionType !== 'spin_wheel')
      return reply.code(404).send({ error: 'Not a spin wheel campaign' })

    // 4. Check already-played (dedup)
    const existing = await fastify.prisma.campaignEvent.findFirst({
      where: { campaignId: campaign.id, memberId: member.id }
    })
    if (existing) {
      return { alreadyPlayed: true, reward: existing.result }
    }

    // 5. Return wheel config + pre-determined result
    const config = campaign.actionConfig as SpinWheelConfig
    const event = await fastify.prisma.campaignEvent.findFirst({
      where: { campaignId: campaign.id, memberId: member.id }
    })
    return {
      alreadyPlayed: false,
      segments: config.segments.map((s, i) => ({
        label: s.label, color: s.color, index: i
      })),
      winningIndex: (event?.result as any)?.winningIndex,
      wheelStyle: config.wheelStyle,
      reward: (event?.result as any)
    }
  }
)
```

**Auth pattern**: The existing public routes use `{ config: { public: true } }` which bypasses Clerk org-level auth. For member-facing endpoints, we introduce a lightweight `extractMemberJwt()` helper that:
- Reads `Authorization: Bearer <token>` header
- Verifies with Clerk's `verifyToken()` (same underlying Clerk SDK)
- Returns `{ email, sub }` claims — no org context needed
- Returns `null` if missing/invalid (route handles 401)

**File**: `apps/api/src/plugins/memberAuth.ts` (new helper, ~30 lines)

**Rate limiting**: Add `fastify-rate-limit` plugin scoped to `/public/campaigns/*/play` with `max: 10, timeWindow: '1 minute'`, keyed by member JWT `sub` claim.

#### 3.3 Modified: Campaign trigger processor

**File**: `apps/worker/src/processors/campaignTriggers.ts`

Add a new branch in the processor for `actionType === 'spin_wheel'`:

```typescript
if (campaign.actionType === 'spin_wheel') {
  const config = campaign.actionConfig as SpinWheelConfig
  
  // Weighted random selection using crypto
  const winningSegment = selectWeightedRandom(config.segments)
  const winningIndex = config.segments.indexOf(winningSegment)
  
  // Store result in CampaignEvent
  const result = {
    winningIndex,
    rewardId: winningSegment.rewardId ?? null,
    points: winningSegment.points ?? 0,
    label: winningSegment.label
  }
  
  await prisma.$transaction(async (tx) => {
    // Create CampaignEvent with result
    await tx.campaignEvent.create({
      data: {
        campaignId, memberId, brandId,
        executedAt: new Date(),
        latencyMs,
        result // NEW field
      }
    })
    
    // Award points if applicable
    if (winningSegment.points && winningSegment.points > 0) {
      await tx.loyaltyEvent.create({
        data: { memberId, brandId, eventType: 'campaign_award',
                pointsEarned: winningSegment.points, campaignId }
      })
      await tx.member.update({
        where: { id: memberId },
        data: { pointsBalance: { increment: winningSegment.points } }
      })
    }
    
    // Create redemption if reward-based
    if (winningSegment.rewardId) {
      await tx.redemption.create({
        data: { memberId, rewardId: winningSegment.rewardId,
                brandId, pointsSpent: 0, status: 'PENDING' }
      })
      // Decrement stock if tracked
      await tx.reward.updateMany({
        where: { id: winningSegment.rewardId, stock: { not: null } },
        data: { stock: { decrement: 1 } }
      })
    }
    
    // Update budget
    const cost = calculateCost(winningSegment, program.pointToCurrencyRatio)
    await tx.campaign.update({
      where: { id: campaignId },
      data: { budgetSpent: { increment: cost } }
    })
  })
  
  // Enqueue notification with spin link
  await enqueueNotification({
    memberId, brandId, type: 'spin_wheel_ready',
    message: 'You earned a spin! Tap to play.',
    link: `/spin/${campaignId}` // brand configures base URL
  })
}
```

#### 3.4 New: Weighted random selection utility

**File**: `packages/shared/src/random.ts`

```typescript
import { randomInt } from 'node:crypto'

export interface WeightedItem { probability: number }

export function selectWeightedRandom<T extends WeightedItem>(items: T[]): T {
  // Scale probabilities to integers (0-10000) for crypto.randomInt
  const totalWeight = items.reduce((sum, item) => sum + item.probability * 100, 0)
  const roll = randomInt(0, totalWeight) // crypto-secure, [0, totalWeight)
  
  let cumulative = 0
  for (const item of items) {
    cumulative += item.probability * 100
    if (roll < cumulative) return item
  }
  return items[items.length - 1] // fallback (rounding edge case)
}
```

Unit tests: 10K iterations, verify distribution is within statistical tolerance (chi-squared test).

### 4. Frontend Changes

#### 4.1 Admin Campaign Creation Form

**File**: `apps/web/src/app/(admin)/admin/campaigns/new/page.tsx`

Changes:
1. Add `'spin_wheel'` to action type dropdown options
2. Conditional render: when `actionType === 'spin_wheel'`, show segment builder instead of points/message fields
3. **Segment builder component** (`SpinWheelSegmentBuilder`):
   - State: `segments: Array<{ rewardId?, points?, probability, label, color }>`
   - Add/remove segment buttons (min 2, max 8)
   - Per-segment: reward dropdown (from existing catalog), probability input, label input, color picker
   - Real-time probability sum validation with inline error
4. **Live wheel preview** (`SpinWheelPreview`):
   - Canvas-based wheel rendering (same approach as HTML mock)
   - Updates on every segment state change
   - "Test Spin" button for preview animation
5. **Embed code section** (post-save):
   - Display after campaign is saved (has an ID)
   - Show `<script>` + `<ceq-spin-wheel>` snippet
   - Copy button

**New components** (co-located in `apps/web/src/components/ui/`):
- `SpinWheelSegmentBuilder.tsx` (~150 lines)
- `SpinWheelPreview.tsx` (~100 lines, canvas rendering)
- `EmbedCodeDisplay.tsx` (~40 lines, code block + copy)

#### 4.2 Payload transformation

Extend the form's `handleSubmit` to build `actionConfig` as `SpinWheelConfig` when `actionType === 'spin_wheel'`:

```typescript
const payload = {
  ...basePayload,
  actionType: form.actionType,
  actionConfig: form.actionType === 'spin_wheel'
    ? { segments: form.segments, wheelStyle: form.wheelStyle }
    : form.actionType === 'award_points'
      ? { points: Number(form.actionPoints) }
      : { message: form.actionMessage },
}
```

### 5. Embeddable Web Component

#### 5.1 Package Structure

**New package**: `packages/embed/`

```
packages/embed/
├── package.json
├── tsconfig.json
├── vite.config.ts          # Build config: lib mode, IIFE output
├── src/
│   ├── ceq-spin-wheel.ts   # Web Component class
│   ├── wheel-renderer.ts   # Canvas drawing logic
│   ├── api-client.ts       # Fetch wrapper for play endpoint
│   └── styles.ts           # CSS-in-JS (shadow DOM scoped)
└── dist/
    └── ceq-spin-wheel.js   # Built output (~15KB gzipped)
```

#### 5.2 Component Implementation

```typescript
// ceq-spin-wheel.ts
class CeqSpinWheel extends HTMLElement {
  static observedAttributes = ['campaign-id', 'token', 'api-base']
  
  private shadow: ShadowRoot
  private canvas: HTMLCanvasElement
  private state: 'loading' | 'ready' | 'spinning' | 'done' | 'error' | 'already-played'
  
  connectedCallback() {
    this.shadow = this.attachShadow({ mode: 'open' })
    this.render()  // loading state
    this.fetchConfig()
  }
  
  async fetchConfig() {
    const res = await fetch(`${this.apiBase}/v1/public/campaigns/${this.campaignId}/play`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.alreadyPlayed) {
        this.state = 'already-played'
        this.renderAlreadyPlayed(data.reward)
      } else {
        this.state = 'ready'
        this.renderWheel(data.segments, data.winningIndex, data.wheelStyle)
      }
    } else {
      this.state = 'error'
      this.renderError(res.status)
    }
  }
  
  spin(winningIndex: number) {
    this.state = 'spinning'
    // Animate: 4-5 full rotations + offset to winning segment
    // Duration: 4-5 seconds, cubic-bezier easing
    // On complete: fire ceq:reward-won event, show result
  }
}

customElements.define('ceq-spin-wheel', CeqSpinWheel)
```

#### 5.3 Build Pipeline

- **Vite** in library mode, IIFE format (no module system needed — `<script>` tag)
- Output: single `ceq-spin-wheel.js` file
- **Shadow DOM** for style isolation — component styles don't leak into host page
- **CSS custom properties** pierce shadow DOM for brand theming:
  - `--ceq-font-family`
  - `--ceq-primary-color`
  - `--ceq-background-color`
- Target: ES2020 (covers 97%+ browsers)

#### 5.4 Turborepo Integration

Add `packages/embed` to Turborepo pipeline:
- `turbo.json`: add `embed#build` task
- `pnpm-workspace.yaml`: include `packages/embed`
- No dependency on other packages at build time (standalone JS)

### 6. Implementation Order

| Step | Description | Files | Depends On |
|---|---|---|---|
| 1 | Schema migration: add `result` to CampaignEvent | `schema.prisma`, migration | Nothing |
| 2 | Zod schemas: SpinWheelSegmentSchema, SpinWheelConfigSchema, extend CreateCampaignSchema | `campaign.schema.ts` | Nothing |
| 3 | Weighted random utility | `packages/shared/src/random.ts` | Nothing |
| 4 | Campaign trigger processor: spin_wheel branch | `campaignTriggers.ts` | Steps 1-3 |
| 5 | Member auth helper | `apps/api/src/plugins/memberAuth.ts` | Nothing |
| 6 | Play endpoint | `apps/api/src/routes/public.ts` | Steps 1, 5 |
| 7 | Admin UI: segment builder + preview + embed code | `apps/web/.../campaigns/new/page.tsx` + new components | Step 2 |
| 8 | Embeddable Web Component package | `packages/embed/` | Step 6 |

Steps 1-3 can be done in parallel. Steps 5-6 can be done in parallel with Step 4. Step 7 and 8 can be done in parallel once their dependencies are met.

## Confidence Level

**85/100**

High confidence because:
- Core patterns (campaign triggers, Zod schemas, Prisma, BullMQ) are well-established in the codebase
- Weighted random selection is a solved problem
- Canvas rendering is proven in the HTML mocks
- Web Components are a stable browser standard

Medium areas:
- Member JWT auth on public endpoints is a new pattern (but Clerk SDK supports it)
- `packages/embed` build pipeline is new (but Vite library mode is well-documented)
- Rate limiting setup for the play endpoint (fastify-rate-limit is mature)

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---|---|---|
| Admin creates spin_wheel campaign with 4 segments | 201, campaign stored with SpinWheelConfig | API test (Supertest) |
| Admin submits probabilities that don't sum to 100% | 422 with "probabilities must sum to 100%" | API test |
| Qualifying event triggers for member | CampaignEvent created with result JSON | Integration test |
| Weighted random produces fair distribution | Chi-squared test over 10K iterations within tolerance | Unit test |
| Member calls play endpoint first time | Returns wheel config + winningIndex | API test |
| Member calls play endpoint second time | Returns alreadyPlayed: true + previous result | API test |
| Member without consent calls play | 403 | API test |
| Unauthenticated call to play | 401 | API test |
| Campaign has ended | 410 | API test |
| Admin sees segment builder when spin_wheel selected | Segments UI appears, preview updates | E2E test (Playwright) |
| Member spins wheel in embed component | Animation plays, lands on correct segment, event fires | Browser test (manual + E2E) |

## Test Matrix

### Unit Tests (packages/shared, packages/embed)
- `selectWeightedRandom()` — fairness over 10K iterations, edge cases (1 segment, 0-probability segment, all-equal probabilities)
- `SpinWheelConfigSchema` validation — valid configs, probability sum errors, min/max segments, color format
- `SpinWheelSegmentSchema` — rewardId vs points requirement
- Wheel canvas rendering — segment arc angles match probabilities (test via pixel sampling or geometric calculation)

**Suite**: `packages/shared/src/random.test.ts` (new), extend `packages/shared/src/zod/campaign.schema.test.ts`

### Integration Tests (apps/api)
- `POST /v1/campaigns` with `actionType: spin_wheel` — create, validate, reject bad configs
- `POST /v1/public/campaigns/:id/play` — first play, already-played, no consent, expired campaign, rate limit
- Campaign trigger processor with `spin_wheel` — verify CampaignEvent.result populated, points awarded, redemption created, budget updated

**Suite**: extend `apps/api/test/integration/campaigns.test.ts`, new `apps/api/test/integration/play.test.ts`

### E2E Test (apps/web — 1 test)
- Admin creates spin_wheel campaign → sees segment builder → saves → embed code shown → activate → verify campaign appears in list with ACTIVE status

**Suite**: new `apps/web/test/e2e/spin-wheel-campaign.spec.ts`

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Member JWT auth pattern doesn't work with Clerk | Low | High | Clerk's `verifyToken()` works with any Clerk-issued JWT. Fall back to API key-based member auth if needed. |
| Canvas rendering differs across browsers | Low | Medium | Use standard Canvas 2D API only. Test in Chrome, Firefox, Safari. Shadow DOM isolates styles. |
| Race condition: two play requests for same member | Low | Medium | `CampaignEvent` unique constraint on `(campaignId, memberId)` prevents double creation. Second request returns already-played. |
| Budget overspend on high-concurrency triggers | Medium | Medium | Existing pattern: budget check before transaction + auto-pause. Same as current campaign triggers. One extra trigger may execute before pause — acceptable (documented in spec). |
| Web Component not loading in older browsers | Low | Low | Target ES2020 (97%+ coverage). Add `nomodule` fallback message. |
| `packages/embed` build breaks Turborepo cache | Low | Low | Standalone package with no cross-package imports at build time. Vite outputs to `dist/`. |

## Spike Findings

No spike was required. All technologies involved are well-established:
- Canvas 2D API: proven in HTML mocks
- `crypto.randomInt`: Node.js built-in, synchronous
- Web Components / Custom Elements: stable browser standard since 2020
- Clerk `verifyToken()`: documented in Clerk SDK
- Vite library mode: widely used for component distribution

## Observability

### Logs (Pino)
- `campaign.spin_wheel.triggered` — when trigger processor selects a winning segment (includes campaignId, memberId, winningIndex)
- `campaign.spin_wheel.played` — when play endpoint is called (includes campaignId, memberId, alreadyPlayed)
- `campaign.spin_wheel.error` — any error in trigger or play flow

### Metrics (future — not in MVP)
- Spin completion rate (played / triggered)
- Average time from trigger to play
- Reward distribution vs configured probabilities (fairness monitoring)
- Play endpoint latency (P50/P95)

### Alerts
- Budget auto-pause events (existing campaign budget alert)
- Play endpoint error rate > 5% (new)

## Architecture Analysis

### Patterns Correctly Followed
1. **Fastify route registration** — play endpoint uses `{ config: { public: true } }` pattern from `public.ts`
2. **Zod validation** — new schemas extend `campaign.schema.ts` with same conventions
3. **BullMQ processor pattern** — spin_wheel branch in `campaignTriggers.ts` follows existing processor structure
4. **Prisma transactional writes** — `$transaction()` for atomic award, same as existing campaign triggers
5. **Multi-tenant scoping** — `brandId` from JWT (admin) or member lookup (public), never from request body
6. **Shared package utilities** — `selectWeightedRandom()` in `packages/shared/src/random.ts` follows `conditions.ts` pattern
7. **Component co-location** — new UI components in `apps/web/src/components/ui/` per Issue #34 decision
8. **Redis dedup** — `CampaignEvent` unique constraint `(campaignId, memberId)`, same pattern

### Patterns Missing from Architecture (Need Documentation)

**1. Member-Authenticated Public Endpoints**
- **What**: The architecture doc (Section 4.2) describes two auth patterns: admin JWT (Clerk org token via auth plugin) and fully public (no auth, `{ config: { public: true } }`). The play endpoint introduces a **third pattern**: member JWT auth on public routes.
- **Why**: Members need authenticated access to their campaign data without admin org-level permissions.
- **Suggested resolution**: Add a "Member Auth" row to the Fastify Plugins table in architecture doc. Document `extractMemberJwt()` helper and when to use it vs admin auth.

**2. Embeddable Component Package (`packages/embed/`)**
- **What**: The architecture doc (Section 3) describes 6 layers. `packages/embed/` is a new layer: CDN-distributed, standalone JS using Web Components with Shadow DOM.
- **Why**: Member-facing interactive experiences need to be embeddable in brand websites, not served from our Next.js app.
- **Suggested resolution**: Add a "3.7 Embed Layer (packages/embed)" section to the architecture doc describing the Web Component approach, build pipeline (Vite IIFE), Shadow DOM isolation, and CDN distribution pattern.

**3. Rate Limiting**
- **What**: `fastify-rate-limit` is not mentioned in the architecture doc. The play endpoint introduces per-member rate limiting (10 req/min).
- **Why**: Public-facing endpoints need abuse protection. Admin endpoints are already protected by Clerk auth + org scoping.
- **Suggested resolution**: Add rate limiting to the Fastify Plugins table. Document the pattern for public endpoints.

### Patterns Incorrectly Followed
None identified. The design follows all existing architectural patterns correctly.

---

## Design Standards

Admin UI components follow the generic UI baseline: indigo/violet color scheme, Inter font, Tailwind v4, shadcn/ui-style components. New components (`SpinWheelSegmentBuilder`, `SpinWheelPreview`, `EmbedCodeDisplay`) co-located in `apps/web/src/components/ui/` per existing pattern (Issue #34 defers extraction to `packages/ui`).

The embeddable `<ceq-spin-wheel>` component uses a neutral default theme with CSS custom properties for brand customization. Shadow DOM ensures no style leakage.
