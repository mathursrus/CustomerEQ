# Technical Design: Scratch-Off Card Campaign + SDK Formalization

Issue: #84 + #82
Owner: Claude (technical-design job)
Spec: `docs/feature-specs/84-scratch-off-card-campaign.md`

## Customer

Marketing managers who want a second interactive campaign type. Loyalty members who want a tactile scratch-to-reveal experience.

## Customer Problem Being Solved

Brands need campaign variety beyond spin wheels. Scratch cards are mobile-first (touch-to-scratch) and ideal for email/SMS re-engagement links.

## User Experience That Will Solve the Problem

- Admin: Select "Scratch Card" → configure prize pool → pick card style → get embed code/link
- Member: Click link in email → enter email → scratch the card → reveal prize → congratulations

## Technical Details

### 1. Schema Changes

#### 1.1 Zod: `ScratchCardConfigSchema`

**File**: `packages/shared/src/zod/campaign.schema.ts`

```typescript
export const ScratchCardPrizeSchema = z.object({
  rewardId: z.string().optional(),
  points: z.number().int().nonnegative().optional(),
  probability: z.number().min(0).max(100),
  label: z.string().min(1).max(50),
}).refine(
  (d) => d.rewardId !== undefined || (d.points !== undefined && d.points > 0),
  { message: 'Prize must have rewardId or positive points' }
)

export const ScratchCardConfigSchema = z.object({
  prizes: z.array(ScratchCardPrizeSchema).min(2).max(8),
  cardStyle: z.enum(['gold', 'silver', 'holiday', 'branded']).default('gold'),
  scratchText: z.string().max(50).default('Scratch to reveal!'),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine(
  (d) => Math.abs(d.prizes.reduce((sum, p) => sum + p.probability, 0) - 100) < 0.01,
  { message: 'Prize probabilities must sum to 100%' }
)
```

#### 1.2 Extend `CreateCampaignSchema`

Add `'scratch_card'` to `CAMPAIGN_ACTION_TYPES`. Add `ScratchCardConfigSchema` to the `z.union` on `actionConfig`. Extend `superRefine` to validate `scratch_card` → `ScratchCardConfigSchema`.

#### 1.3 No DB Migration Required

`CampaignEvent.result` JSON field already exists from #83. `scratch_card` stores the same shape: `{ winningIndex, rewardId, points, label }`.

### 2. API Changes

#### 2.1 Campaign trigger processor

**File**: `apps/worker/src/processors/campaignTriggers.ts`

Rename `executeSpinWheel()` to `executeInteractiveCampaign()` (or add `scratch_card` to the existing `if` block). The logic is identical:
1. `selectWeightedRandom(config.prizes)` — same function, different field name (`prizes` vs `segments`)
2. Store result in `CampaignEvent.result`
3. Award points or create redemption
4. Update budget
5. Enqueue notification: "You earned a scratch card!"

**Change**: Extract shared logic into a helper that both `spin_wheel` and `scratch_card` call, parameterized by the prize/segment array field name.

#### 2.2 Play endpoint

**File**: `apps/api/src/routes/campaignPlay.ts`

Add `scratch_card` branch after the existing `spin_wheel` branch:

```typescript
if (campaign.actionType === 'scratch_card') {
  const config = campaign.actionConfig as ScratchCardConfig
  return reply.status(200).send({
    alreadyPlayed: false,
    campaignType: 'scratch_card',
    cardStyle: config.cardStyle ?? 'gold',
    scratchText: config.scratchText ?? 'Scratch to reveal!',
    brandColor: config.brandColor ?? null,
    prize: {
      type: resultData.rewardId ? 'reward' : 'points',
      points: resultData.points,
      label: resultData.label,
      rewardId: resultData.rewardId,
    },
  })
}
```

### 3. Admin UI Changes

**File**: `apps/web/src/app/(admin)/admin/campaigns/new/page.tsx`

Add `scratch_card` conditional block (same pattern as `spin_wheel`):
- Prize pool builder: same as segment builder but simpler (no color per prize — color comes from card style)
- Card style picker: 4 options (gold, silver, holiday, branded) with metallic gradient swatches
- Scratch text input
- Brand color picker (visible only when style = "branded")

**Reusable components**: The probability sum display, add/remove buttons, and style picker patterns from spin wheel can be reused directly.

### 4. Member-Facing Page

**File**: `apps/web/src/app/scratch/[id]/page.tsx` (new)

Same pattern as `/spin/[id]/page.tsx`:
1. Email entry screen
2. Call play endpoint
3. Render scratch card (Canvas overlay + hidden prize)
4. Track scratch percentage
5. Auto-reveal at 60% + confetti
6. Already-played state

### 5. Embeddable Web Component

**File**: `packages/embed/src/ceq-scratch-card.ts` (new)

```typescript
class CeqScratchCard extends HTMLElement {
  static observedAttributes = ['campaign-id', 'token', 'api-base']

  // Shadow DOM with:
  // - Prize layer (bottom): text/emoji showing the prize
  // - Scratch layer (top): Canvas with metallic gradient overlay
  // - Touch/mouse event handlers for scratch interaction
  // - Percentage tracking via getImageData() pixel counting
  // - Auto-reveal at 60% with fade transition
  // - ceq:card-revealed CustomEvent on completion
}
```

**Canvas scratch implementation**:
- `globalCompositeOperation = 'destination-out'` erases the overlay where touched
- Circle brush (radius ~20px) for natural scratch feel
- Soft edge: second, larger, semi-transparent circle for smoother scratching
- Percentage calculation: count transparent pixels in `getImageData()` / total pixels
- Performance: sample every 5th scratch event (not every pixel) to avoid jank

**Card style rendering**:
| Style | Overlay |
|---|---|
| gold | Linear gradient: #D4AF37 → #F5E6A3 → #D4AF37 → #C5982C |
| silver | Linear gradient: #C0C0C0 → #E8E8E8 → #C0C0C0 → #A8A8A8 |
| holiday | Linear gradient: #c41e3a → #2d5a27 → #c41e3a (red/green) |
| branded | Solid `brandColor` with subtle noise texture |

### 6. SDK Formalization

**Files**: `packages/embed/src/shared/` (new directory)

#### 6.1 Shared API Client

```typescript
// packages/embed/src/shared/api-client.ts
export async function callPlayEndpoint(
  apiBase: string, campaignId: string, token: string
): Promise<PlayResponse> {
  const res = await fetch(`${apiBase}/v1/public/campaigns/${campaignId}/play`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new PlayError(res.status, await res.json())
  return res.json()
}
```

#### 6.2 Shared Theming

```typescript
// packages/embed/src/shared/theming.ts
export const CEQ_CSS_VARS = `
  --ceq-font-family: 'Inter', system-ui, sans-serif;
  --ceq-primary-color: #4F46E5;
  --ceq-background-color: #1e1b4b;
  --ceq-success-color: #10B981;
  --ceq-text-color: #ffffff;
`
```

#### 6.3 Shared Events

```typescript
// packages/embed/src/shared/events.ts
export function fireEvent(element: HTMLElement, name: string, detail: unknown) {
  element.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }))
}
```

#### 6.4 Multi-Entry Build

**File**: `packages/embed/vite.config.ts`

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        'ceq-spin-wheel': 'src/ceq-spin-wheel.ts',
        'ceq-scratch-card': 'src/ceq-scratch-card.ts',
        'ceq-components': 'src/index.ts', // all-in-one
      },
      output: { entryFileNames: '[name].js', format: 'iife' },
    },
    outDir: 'dist',
    minify: true,
    target: 'es2020',
  },
})
```

### 7. Implementation Order

| Step | Description | Files | Depends On |
|---|---|---|---|
| 1 | Zod schemas: ScratchCardPrizeSchema, ScratchCardConfigSchema, extend CreateCampaignSchema | campaign.schema.ts | Nothing |
| 2 | Campaign trigger: scratch_card branch (reuse selectWeightedRandom) | campaignTriggers.ts | Step 1 |
| 3 | Play endpoint: scratch_card response branch | campaignPlay.ts | Step 1 |
| 4 | SDK shared utilities extraction | packages/embed/src/shared/ | Nothing |
| 5 | ceq-scratch-card Web Component | packages/embed/src/ceq-scratch-card.ts | Step 4 |
| 6 | Multi-entry Vite build | packages/embed/vite.config.ts | Steps 4-5 |
| 7 | Admin UI: prize pool builder + card style picker | campaigns/new/page.tsx | Step 1 |
| 8 | Member page: /scratch/:id | apps/web/src/app/scratch/[id]/page.tsx | Step 3 |
| 9 | Middleware: add /scratch(..) to public routes | middleware.ts | Step 8 |

Steps 1-4 can run in parallel. Steps 7-9 can run in parallel once dependencies are met.

## Confidence Level

**90/100**

Very high confidence because:
- All patterns established and proven in #83 (trigger processor, play endpoint, admin UI, member page, embed component)
- Canvas scratch interaction proven in HTML mock
- `selectWeightedRandom()` already exists and tested
- Only genuinely new code: Canvas scratch overlay + percentage tracking + ceq-scratch-card component

## Validation Plan

| Scenario | Expected Outcome | Method |
|---|---|---|
| Create scratch_card campaign | 201, stored with ScratchCardConfig | API test |
| Probabilities don't sum to 100% | 422 rejection | API test |
| Trigger fires for scratch_card | CampaignEvent with result JSON | Integration test |
| Play endpoint returns scratch_card config | cardStyle, scratchText, prize | API test |
| Already-played returns previous prize | alreadyPlayed: true | API test |
| Admin selects Scratch Card action type | Prize pool builder appears | E2E test |
| Member scratches 60%+ | Auto-reveal + ceq:card-revealed event | E2E test |
| ceq-scratch-card builds | dist/ceq-scratch-card.js output | Build test |
| All-in-one bundle builds | dist/ceq-components.js output | Build test |

## Test Matrix

### Unit Tests
- `ScratchCardConfigSchema` validation (valid configs, probability sum, card styles)
- `ScratchCardPrizeSchema` (rewardId vs points)
- Existing `selectWeightedRandom` tests cover prize selection

**Suite**: extend `campaign.schema.test.ts`

### Integration Tests
- Campaign creation with `scratch_card` actionType
- Play endpoint with `scratch_card` campaign

**Suite**: extend `campaigns.test.ts`, `play.test.ts` (if exists)

### E2E Tests (real app)
- Admin creates scratch card campaign (prize pool, card style, submit)
- Member scratches card and sees prize (mocked play endpoint)

**Suite**: new `scratch-card-campaign.spec.ts`, `scratch-card-member.spec.ts`

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Canvas getImageData() performance on large cards | Low | Medium | Sample every 5th event. Use requestAnimationFrame for percentage calc. |
| Touch events conflict with page scroll | Medium | Medium | `touch-action: none` on canvas. `e.preventDefault()` on touchmove. |
| Multi-entry Vite build breaks existing ceq-spin-wheel | Low | High | Test both per-component and all-in-one bundles. |
| Shared utility extraction breaks ceq-spin-wheel imports | Low | Medium | Refactor ceq-spin-wheel to use shared utilities in same PR. |

## Spike Findings

No spike needed. Canvas scratch interaction proven in HTML mock. All other patterns proven in #83.

## Observability

Same as #83:
- `campaign.scratch_card.triggered` — when trigger selects prize
- `campaign.scratch_card.played` — when play endpoint called
- Play endpoint latency logged

## Architecture Analysis

### Patterns Correctly Followed
All patterns from #83 apply unchanged: Fastify routes, Zod validation, BullMQ processor, Prisma transactions, multi-tenant scoping, shared package utilities, embed package with Shadow DOM.

### Patterns Missing from Architecture
None new — all gaps identified in #83 (member auth, embed layer, rate limiting) have been documented.

### Patterns Incorrectly Followed
None.

## Design Standards

Generic UI baseline. Admin follows #83 campaign form patterns. Member page follows #83 `/spin/:id` pattern.
