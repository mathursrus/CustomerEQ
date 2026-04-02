# Feature: Scratch-Off Card Campaign + Embeddable SDK Formalization

Issues: #84 (Scratch-Off Card) + #82 (Embeddable SDK)
Owner: Claude (feature-specification job)
Parent: #82 (Embeddable Campaign Components SDK)

## Customer

**Marketing Managers** who want a second interactive campaign type beyond spin-the-wheel — one that can be delivered via email/SMS links to drive re-engagement back to the brand's site.

**Loyalty Members** who want a fun, tactile reward reveal experience — scratching a virtual card to discover their prize, like a real lottery scratch-off.

## Customer's Desired Outcome

**Marketing Manager**: "I want to create a scratch-off card campaign where members scratch to reveal their prize. I want to pick a card style (gold, silver, holiday), set up the prize pool with probabilities, and get an embed code or a shareable link I can put in our emails."

**Loyalty Member**: "After earning a reward, I want to scratch a shiny card with my finger (on mobile) or mouse (on desktop) to discover what I won. It should feel real and satisfying."

## Customer Problem Being Solved

The spin-the-wheel campaign (#83) proved that interactive reward mechanics drive higher engagement than silent point deposits. But spin wheels are only one mechanic — brands need variety to keep members engaged across multiple campaigns without fatigue.

Scratch-off cards specifically solve:
- **Email/SMS re-engagement**: A scratch card link in an email drives 2-3x higher click-through than "You earned 100 points"
- **Mobile-first interaction**: Touch-to-scratch is the most natural mobile gesture — more intuitive than tapping "SPIN"
- **Dopamine reveal**: The progressive scratch-to-reveal creates anticipation that a single spin animation doesn't
- **Campaign variety**: Brands can alternate spin wheels and scratch cards to avoid engagement fatigue

### SDK Formalization (from #82)

Issue #83 created the initial `packages/embed/` with `<ceq-spin-wheel>`. This spec formalizes the SDK to properly support multiple components:
- Shared build pipeline producing per-component + all-in-one bundles
- Shared theming system (CSS custom properties)
- Shared API client for the play endpoint
- Shared event system (`ceq:*` custom DOM events)

## User Experience That Will Solve the Problem

### UX Flow

#### 1. Admin Creates a Scratch Card Campaign (`/admin/campaigns/new`)

Admin navigates to the campaign creation page and selects "Scratch Card" as the action type:

**Step 1 — Campaign Basics** (same as spin wheel):
- Campaign name, program, trigger type, trigger condition, dates, budget cap

**Step 2 — Prize Pool** (new section, appears when `actionType = "scratch_card"`):
- **Prize builder**: Add 2-8 prizes. Each prize has:
  - Reward: select from rewards catalog, or "Bonus Points" with custom amount
  - Probability: percentage (all must sum to 100%)
  - Display name: text shown under the scratch area (e.g., "Free Coffee!", "500 Points!")
- **Card style**: Gold Foil | Silver | Holiday | Branded (with color picker)
- **Scratch area text**: Text visible on top of the scratch layer (e.g., "Scratch to reveal!", "Your prize awaits...")

**Step 3 — Embed & Launch**:
- After saving (status = DRAFT), admin sees:
  - Embed code snippet: `<script src="..."></script><ceq-scratch-card campaign-id="..." token="{{MEMBER_TOKEN}}"></ceq-scratch-card>`
  - Direct link URL: `https://brand.com/scratch/{campaignId}`
  - Email template snippet with CTA button linking to the scratch page

**Mock**: [84-admin-scratch-card-builder.html](mocks/84-admin-scratch-card-builder.html)

#### 2. Member Triggers the Campaign

Same flow as spin wheel:
1. Qualifying event → campaign trigger evaluates → weighted random selects prize
2. `CampaignEvent` created with `result` JSON storing pre-determined prize
3. Notification: "You've earned a scratch card! 🎫" with link to scratch page

#### 3. Member Scratches the Card (`/scratch/:campaignId`)

Member clicks the link or encounters the embedded `<ceq-scratch-card>` component:

1. Component calls `POST /v1/public/campaigns/:id/play` with member email token
2. API validates (same as spin wheel: consent, campaign active, not already played)
3. API returns card config + pre-determined result:
   ```json
   {
     "alreadyPlayed": false,
     "campaignType": "scratch_card",
     "cardStyle": "gold",
     "scratchText": "Scratch to reveal!",
     "prize": { "type": "points", "points": 500, "label": "500 Points!" }
   }
   ```
4. Component renders:
   - **Bottom layer**: Prize image/text (hidden initially)
   - **Top layer**: Scratch overlay (metallic texture matching card style)
   - **Instructions**: "Scratch to reveal your prize!"
5. Member scratches with finger (touch) or mouse drag:
   - Canvas erases the top layer progressively where touched
   - Scratch area tracks percentage revealed
6. When ~60% is scratched:
   - Remaining overlay fades away automatically
   - Sparkle/confetti animation plays
   - Prize is revealed with celebration text
   - Component fires `ceq:card-revealed` DOM event
7. Member sees: "You won: 500 Points! 🎉"

**Mock**: [84-member-scratch-card.html](mocks/84-member-scratch-card.html)

#### 4. Already-Played State

If member revisits after already scratching:
1. API returns `{ alreadyPlayed: true, prize: { ... } }`
2. Component shows the card fully revealed with: "You already scratched! Your prize: 500 Points!"

### Data Model Changes

#### Zod Schema: `ScratchCardConfigSchema`

```
ScratchCardPrizeSchema = z.object({
  rewardId: z.string().optional(),
  points: z.number().int().nonneg().optional(),
  probability: z.number().min(0).max(100),
  label: z.string().min(1).max(50),
}).refine(
  d => d.rewardId !== undefined || (d.points !== undefined && d.points > 0),
  { message: 'Prize must have rewardId or positive points' }
)

ScratchCardConfigSchema = z.object({
  prizes: z.array(ScratchCardPrizeSchema).min(2).max(8),
  cardStyle: z.enum(['gold', 'silver', 'holiday', 'branded']).default('gold'),
  scratchText: z.string().max(50).default('Scratch to reveal!'),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine(
  d => Math.abs(d.prizes.reduce((sum, p) => sum + p.probability, 0) - 100) < 0.01,
  { message: 'Prize probabilities must sum to 100%' }
)
```

#### Modified: `CreateCampaignSchema`

Extend `actionType` to include `'scratch_card'`. When `actionType === 'scratch_card'`, validate `actionConfig` against `ScratchCardConfigSchema`.

#### No New DB Models

Reuses existing `Campaign`, `CampaignEvent` (with `result` JSON), `Reward`, `Redemption` — same as spin wheel.

### API Changes

#### Modified: `POST /v1/public/campaigns/:id/play`

Already exists from #83. Add `scratch_card` branch in the response handler:

```json
// When campaign.actionType === 'scratch_card':
{
  "alreadyPlayed": false,
  "campaignType": "scratch_card",
  "cardStyle": "gold",
  "scratchText": "Scratch to reveal!",
  "brandColor": "#D4AF37",
  "prize": {
    "type": "points",
    "points": 500,
    "label": "500 Points!"
  }
}
```

#### Modified: Campaign trigger processor

Add `scratch_card` branch in `executeSpinWheel` (rename to `executeInteractiveCampaign` or add separate handler). Same weighted random selection logic — reuse `selectWeightedRandom()`.

### SDK Formalization (from #82)

#### Multi-Component Build Pipeline

```
packages/embed/
├── src/
│   ├── shared/
│   │   ├── api-client.ts     # Shared fetch wrapper for play endpoint
│   │   ├── theming.ts        # CSS custom properties system
│   │   └── events.ts         # ceq:* event helpers
│   ├── ceq-spin-wheel.ts     # Existing (from #83)
│   ├── ceq-scratch-card.ts   # NEW
│   └── index.ts              # All-in-one entry point
├── vite.config.ts             # Multi-entry build
└── dist/
    ├── ceq-spin-wheel.js     # Per-component (~7KB)
    ├── ceq-scratch-card.js   # Per-component (~10KB)
    └── ceq-components.js     # All-in-one bundle
```

#### Shared CSS Custom Properties

```css
--ceq-font-family: 'Inter', system-ui, sans-serif;
--ceq-primary-color: #4F46E5;
--ceq-background-color: #1e1b4b;
--ceq-success-color: #10B981;
--ceq-text-color: #ffffff;
```

### Requirements

**R1** — The system SHALL accept `actionType: "scratch_card"` when creating a campaign, with `actionConfig` containing 2-8 prizes (each with rewardId or points, probability, label), a cardStyle, and optional scratchText and brandColor.

**R2** — Prize probabilities SHALL sum to 100% (within 0.01 tolerance). The API SHALL reject creation if they do not.

**R3** — When a `scratch_card` campaign triggers for a member, the system SHALL perform weighted random selection and store the result in `CampaignEvent.result` JSON.

**R4** — `POST /v1/public/campaigns/:id/play` SHALL return `campaignType: "scratch_card"` with cardStyle, scratchText, and the pre-determined prize for scratch card campaigns.

**R5** — The `<ceq-scratch-card>` Web Component SHALL render a scratch overlay (Canvas) on top of the hidden prize. The overlay SHALL match the configured cardStyle (gold metallic, silver, holiday pattern, or branded color).

**R6** — The scratch interaction SHALL work with both mouse drag (desktop) and touch move (mobile). The component SHALL track the percentage of area scratched.

**R7** — When approximately 60% of the scratch area has been revealed, the component SHALL auto-reveal the remaining area with a fade animation and play a sparkle/confetti effect.

**R8** — The component SHALL fire a `ceq:card-revealed` CustomEvent on the DOM after the prize is fully revealed, with prize details in `event.detail`.

**R9** — The component SHALL support CSS custom properties for brand theming (same set as spin wheel).

**R10** — The already-played state SHALL show the card fully revealed with the previously won prize and a "You already scratched!" message.

**R11** — The admin campaign form SHALL show a prize pool builder (similar to spin wheel segment builder) when `actionType = "scratch_card"` is selected, plus a card style picker and scratch text input.

**R12** — After scratch card campaign creation, the admin SHALL see an embed code snippet and direct link URL.

**R13** — The member-facing page at `/scratch/:campaignId` SHALL provide the full scratch experience (email entry → scratch card → reveal → congratulations), following the same pattern as `/spin/:id`.

**R14** — The `packages/embed/` build pipeline SHALL produce individual component bundles AND an all-in-one `ceq-components.js` bundle.

**R15** — Shared SDK utilities (API client, theming, events) SHALL be extracted into `packages/embed/src/shared/` and used by both `ceq-spin-wheel` and `ceq-scratch-card`.

### Edge Cases & Error States

| Scenario | Expected Behavior |
|---|---|
| Probabilities don't sum to 100% | API rejects with 422 |
| Campaign is PAUSED or COMPLETED | Play endpoint returns 404 |
| Member has no consent | Play endpoint returns 403 |
| Member already scratched | Returns 200 with alreadyPlayed: true + previous prize |
| Budget cap exceeded | Campaign auto-pauses |
| Touch event outside scratch area | Ignored |
| Very fast scratch (< 1 second) | Still requires 60% threshold |
| Network error during scratch | Scratch is cosmetic; prize was pre-determined. Show retry for play endpoint call. |
| Member JWT expired | Show "Session expired" |
| Card style "branded" without brandColor | Fall back to gold |

### Open Questions

- **Q1**: Should we support custom scratch overlay images (brand logo as scratch texture)? Deferred — use solid metallic colors for MVP.
- **Q2**: Sound effects on scratch? Deferred — adds complexity and autoplay restrictions on mobile.

## Compliance Requirements

Same as #83 (inferred from project context):
- **GDPR/CCPA**: Play endpoint verifies `Member.consentGivenAt`. Erased members get 404.
- **Data Minimization**: Play endpoint returns only card config and prize — no PII.
- **Audit Trail**: All results in `CampaignEvent.result` with timestamps.
- **Fairness**: Weighted random via `crypto.randomInt` — server-side, not client.
- **SOC2**: Play endpoint access logged.

## Design Standards

Generic UI baseline: indigo/violet, Inter font, Tailwind v4, shadcn/ui-style. Admin follows campaign creation form patterns from #83.

## Validation Plan

1. **API**: Create scratch_card campaign, verify 201. Verify probability rejection (422). Call play endpoint — verify scratch card response.
2. **Browser**: Serve admin mock — verify prize pool builder, card style picker. Serve member mock — verify scratch interaction at desktop and mobile viewport.
3. **E2E**: Admin creates scratch card campaign (real app, mocked API). Member scratches card (real app, mocked play endpoint). Already-played shows previous prize.
4. **Compliance**: No-auth → 401. No-consent → 403. Expired campaign → 410.

## Alternatives

| Alternative | Why Discard? |
|---|---|
| Click-to-reveal (no scratch) | Loses the tactile, dopamine-driven interaction. Just another button click. |
| Client-side prize determination | Security risk. Members could inspect JS to see prize before scratching. |
| Server-rendered scratch card image | Slow, no interactivity, can't work offline after load. |
| React component (not Web Component) | Brands using Vue/Angular/vanilla can't embed. Web Components are framework-agnostic. |

## Competitive Analysis

Same competitive landscape as #83 (documented in `docs/feature-specs/83-spin-the-wheel-campaign.md`). Key additions:

| Competitor | Scratch Card? | Notes |
|---|---|---|
| Gameball | Yes — in-app scratch card | Shopify popup-based, not embeddable. No CX trigger. $34-599/mo. |
| BRAME | Yes — browser scratch card | Marketing-only, no loyalty engine. Enterprise pricing. |
| Antavo | No — badges/challenges only | No interactive reveal mechanics. |
| Playzo | Yes — 50+ game types | Lead-gen focused, no loyalty integration. |
| AnnexCloud | No | Traditional gamification only. |

**Our edge**: CX-event-triggered scratch cards embedded in brand sites. No competitor connects NPS → scratch card automatically.

### Research Sources
- Gameball games: https://www.gameball.co/games-and-gamification (2026-04-02)
- BRAME scratch card: https://www.brame.io/game-concept/scratch-card (2026-04-02)
- Previous research from #83 spec

## Architecture Flow

```mermaid
graph TD
    A[CX Event: POST /v1/events] --> B{Campaign Trigger Eval}
    B -->|scratch_card matches| C[Weighted Random Prize Selection]
    C --> D[CampaignEvent with result JSON]
    D --> E[Notification: 'You earned a scratch card!']
    E --> F[Member clicks link in email/SMS]
    F --> G[/scratch/:campaignId page]
    G --> H[Enter email → POST /play]
    H --> I{Validation}
    I -->|First play| J[Return card config + prize]
    I -->|Already played| K[Return alreadyPlayed + prize]
    J --> L[ceq-scratch-card renders]
    L --> M[Member scratches 60%+]
    M --> N[Auto-reveal + confetti]
    N --> O[ceq:card-revealed event]
```
