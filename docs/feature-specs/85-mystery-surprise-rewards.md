# Feature: Mystery/Surprise Rewards — Hidden Reward Reveal

Issue: #85
Owner: Claude (feature-specification job)

## Customer

**Marketing Managers** who want the simplest gamification mechanic — a mystery box that creates anticipation without requiring interactive game mechanics.

**Loyalty Members** who want the thrill of discovering what they won, rather than seeing "You earned 100 points" instantly.

## Customer's Desired Outcome

**Marketing Manager**: "I want to wrap my rewards in a mystery box. When a member earns a reward, they see a gift box and tap to open it. Simple, satisfying, drives click-through."

**Loyalty Member**: "I earned something! What's inside? *tap* ... 500 Points! Yes!"

## Customer Problem Being Solved

Spin wheels and scratch cards are great for high-engagement campaigns, but they're overkill for everyday reward delivery. Mystery boxes solve:
- **Everyday reward excitement**: Turn routine point awards into moments of surprise
- **Lowest implementation effort**: No canvas rendering, no scratch tracking — just a CSS animation
- **Email/SMS click-through**: "You have a mystery reward waiting!" drives 2-3x higher open rates
- **Complements existing campaigns**: Can be combined with any campaign trigger, not just special promotions

## User Experience That Will Solve the Problem

### UX Flow

#### 1. Admin Creates a Mystery Box Campaign (`/admin/campaigns/new`)

Select "Mystery Box" as the action type:

**Prize Pool** (same builder as scratch card):
- 2-8 prizes with rewardId or points, probability, label
- Probabilities must sum to 100%

**Box Style**: Gift Wrap (red/gold ribbon) | Treasure Chest (wooden/gold) | Branded (custom color)

**No scratch text or complex config** — simpler than scratch card.

**Mock**: [85-admin-mystery-box-builder.html](mocks/85-admin-mystery-box-builder.html)

#### 2. Member Opens the Mystery Box (`/mystery/:campaignId`)

1. Enter email → call play endpoint
2. See a wrapped gift box with "Tap to open!" prompt and subtle bounce animation
3. Tap/click the box
4. Box open animation: lid lifts, confetti bursts out, prize rises from inside
5. "Congratulations! You won: Free Coffee!"
6. Already-opened state shows the unwrapped box with prize visible

**Mock**: [85-member-mystery-box.html](mocks/85-member-mystery-box.html)

### Data Model Changes

#### Zod Schema: `MysteryBoxConfigSchema`

```
MysteryBoxPrizeSchema = z.object({
  rewardId: z.string().optional(),
  points: z.number().int().nonneg().optional(),
  probability: z.number().min(0).max(100),
  label: z.string().min(1).max(50),
}).refine(d => d.rewardId !== undefined || (d.points !== undefined && d.points > 0))

MysteryBoxConfigSchema = z.object({
  prizes: z.array(MysteryBoxPrizeSchema).min(2).max(8),
  boxStyle: z.enum(['gift', 'treasure', 'branded']).default('gift'),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine(d => Math.abs(d.prizes.reduce((sum, p) => sum + p.probability, 0) - 100) < 0.01)
```

#### Modified: `CreateCampaignSchema`

Add `'mystery_box'` to `CAMPAIGN_ACTION_TYPES`. Add `MysteryBoxConfigSchema` to actionConfig union + superRefine.

### API Changes

- Play endpoint: add `mystery_box` branch returning `{ campaignType: "mystery_box", boxStyle, prize }`
- Trigger processor: `mystery_box` handled by existing `executeInteractiveCampaign()` (same as spin_wheel + scratch_card)

### Requirements

**R1** — Accept `actionType: "mystery_box"` with 2-8 prizes, probabilities summing to 100%, boxStyle.
**R2** — Weighted random selection at trigger time, stored in `CampaignEvent.result`.
**R3** — Play endpoint returns `campaignType: "mystery_box"` with boxStyle and prize.
**R4** — Admin shows prize pool builder + box style picker when `mystery_box` selected.
**R5** — Member page at `/mystery/:campaignId` with email entry → box → tap → reveal → congratulations.
**R6** — Already-opened state shows prize without animation.
**R7** — Box open animation: CSS transform (lid lift + confetti).
**R8** — Added to Clerk middleware public routes.

### Edge Cases

Same as scratch card — probability validation, consent, already-played, budget cap, expired campaign.

## Compliance Requirements

Same as #83/#84 — GDPR consent check, data minimization, audit trail, crypto-secure random.

## Design Standards

Generic UI baseline. Follows #83/#84 patterns exactly.

## Validation Plan

1. API: Create mystery_box campaign (201), play endpoint returns correct response
2. E2E: Admin selects Mystery Box, sees prize builder + box styles. Member opens box.
3. Manual: Start dev server from worktree, test real member flow end-to-end.

## Competitive Analysis

Same landscape as #83/#84. Mystery box is a common mechanic (Gameball has it). Our edge: CX-event-triggered mystery boxes embedded in brand sites.

## Architecture Flow

Same as spin_wheel/scratch_card — event → trigger eval → weighted random → CampaignEvent → notification → member opens → play endpoint → animation → reveal.
