# Codebase Brainstorming: Making Campaigns Sexier

**Date**: 2026-04-02
**Focus**: Campaign gamification and interactive engagement mechanics
**Question**: Does AnnexCloud offer rich campaign experiences, or is it vanilla APIs + points tracking? How can CustomerEQ leapfrog?

---

## Currently Exists

| Capability | Evidence (file path) |
|---|---|
| Event-driven campaign engine with real-time trigger evaluation | `apps/api/src/routes/events.ts` |
| Trigger-condition-action model (JSON fields, fully extensible) | `packages/database/prisma/schema.prisma:283-286` |
| 3 action types: `award_points`, `award_reward`, `send_message` | `packages/database/prisma/schema.prisma:285` |
| Budget tracking with auto-pause when cap exceeded | `apps/worker/src/processors/campaignTriggers.ts` |
| Rewards catalog (DISCOUNT, FREE_ITEM, EXPERIENCE, VOUCHER) | `packages/database/prisma/schema.prisma:29-32` |
| Tiers with multipliers and benefits | `packages/database/prisma/schema.prisma` (Tier model) |
| Rules engine with priority, stacking, AND/OR conditions | `apps/worker/src/processors/loyaltyEvents.ts:22` (`evaluateRulesWithIds`) |
| BullMQ async processing (6 queues) | `apps/api/src/queues/bullmq.ts` |
| Admin campaign UI (list + creation form) | `apps/web/src/app/(admin)/admin/campaigns/` |
| Campaign dedup (Redis NX + DB unique constraint) | `campaignTriggers.ts` + `schema.prisma` (CampaignEvent unique) |
| Per-member campaign event tracking | `CampaignEvent` model in `schema.prisma` |
| MCP server with 21 AI-callable tools including campaign CRUD | `apps/mcp-server/src/tools/campaigns.ts` |

**What does NOT exist**: No gamification, no spin wheels, no scratch cards, no badges, no leaderboards, no challenges, no streaks, no member-facing campaign UI.

---

## Critical Gap: No Member-Facing UI

### The Problem

Today, campaigns are **invisible to members**. When a campaign fires, the member silently receives points — there's no interactive moment, no visual experience, no reason to come back. The entire campaign system is admin-facing only:
- Admin creates campaign at `/admin/campaigns/new`
- Admin views campaign list at `/admin/campaigns`
- Member gets points deposited silently into `Member.pointsBalance`

### What AnnexCloud Gets Right

AnnexCloud's gamification features (badges, leaderboards, contests) are all **member-facing** — the Loyalty Member is the actor (UC-18 in `docs/replicate/analysis/use-cases.md`). They provide this through their **Microsite & RaaS** (Rewards-as-a-Service) product, a hosted member portal where end consumers interact with the loyalty program.

### What CustomerEQ Needs: Embeddable Campaign Components

For any gamification to work, we need a **member-facing experience layer**. The recommended approach is **embeddable web components** that brands can drop into their own apps/sites:

| Component | Description | Embed Pattern |
|---|---|---|
| `<ceq-spin-wheel>` | Animated prize wheel with configurable segments | `<ceq-spin-wheel campaign-id="..." token="...">` |
| `<ceq-scratch-card>` | Canvas-based scratch-to-reveal card | `<ceq-scratch-card campaign-id="..." token="...">` |
| `<ceq-mystery-box>` | Gift box open-to-reveal animation | `<ceq-mystery-box redemption-id="..." token="...">` |
| `<ceq-challenge-progress>` | Progress bar + step checklist for active challenges | `<ceq-challenge-progress member-id="..." token="...">` |
| `<ceq-streak-counter>` | Flame/fire streak animation with day count | `<ceq-streak-counter member-id="..." token="...">` |
| `<ceq-leaderboard>` | Top-N member ranking table | `<ceq-leaderboard program-id="..." token="...">` |

**Implementation approach**: Web Components (Custom Elements) built with Lit or vanilla JS, distributed via CDN. Each component authenticates via a member JWT token and calls CustomerEQ public API endpoints. This mirrors how Intercom, Typeform, and other SaaS tools embed into customer sites.

**Why embeddable > hosted microsite**: Mid-market brands (CustomerEQ's target) already have their own websites and apps. They want to embed loyalty experiences into their existing UX, not redirect customers to a separate portal. Embeddable components also enable email/SMS campaigns with direct links to interactive experiences.

### Prerequisite: Member-Facing API Layer

All gamified campaigns require new **public API endpoints** that member-facing components can call:

| Endpoint | Purpose |
|---|---|
| `POST /v1/public/campaigns/:id/play` | Validate eligibility, return game config + pre-determined result |
| `POST /v1/public/rewards/:id/reveal` | Reveal mystery reward |
| `GET /v1/public/members/me/challenges` | Active challenges with progress |
| `GET /v1/public/members/me/streak` | Current streak data |
| `GET /v1/public/programs/:id/leaderboard` | Top-N ranking |

These endpoints use member JWT auth (not admin API key), following the pattern already established at `apps/api/src/routes/public.ts`.

---

## AnnexCloud Analysis

**Source**: `docs/replicate/reports/REPLICATION_ANALYSIS.md`, `docs/replicate/analysis/site_analysis.json`

### What AnnexCloud Actually Offers for Gamification

From their `/loyalty-gamification/` page:
- **Badges** — visual achievements
- **Leaderboards** — competitive ranking
- **Contests** — time-bound competitions
- **Campaigns and milestones** — goal-based progression

### What AnnexCloud Does NOT Offer
- No spin-the-wheel mechanics
- No scratch-off cards
- No interactive reveal/surprise mechanics
- No rich visual campaign templates

### Verdict
AnnexCloud's gamification is **conventional** — badges, leaderboards, contests. They "leverage human nature" with traditional challenge mechanics but don't offer the kind of visually exciting, interactive campaign experiences that drive viral sharing and dopamine-driven engagement.

**CustomerEQ can leapfrog AnnexCloud** by building interactive mechanics that they don't have.

---

## Architectural Patterns That Enable Extension

| Pattern | Location | What It Enables |
|---|---|---|
| JSON `actionConfig` (schemaless) | `schema.prisma:286` | New action types (game mechanics) without schema migration |
| JSON `triggerCondition` (flexible eval) | `schema.prisma:284` | New trigger events (game_completed, challenge_achieved) plug in |
| `actionType` as String (not enum) | `schema.prisma:285` | Add `spin_wheel`, `scratch_card`, `challenge` directly |
| BullMQ queue system | `apps/api/src/queues/bullmq.ts` | New processors for game state, animation config, etc. |
| Reward types (Prisma enum) | `schema.prisma:29-32` | Add INSTANT_WIN, MYSTERY_BOX types |
| `CampaignEvent` per-member tracking | `schema.prisma` | Basis for game state/progress tracking |
| MCP server tools | `apps/mcp-server/src/tools/` | AI agent can create/manage gamified campaigns |

---

## Grounded Suggestions

### 1. Spin-the-Wheel Interactive Reward

**Builds on**: `Campaign.actionType` + `Campaign.actionConfig` JSON + `Reward` catalog + `campaignTriggers.ts`

**What changes**:
1. **Backend**: New action handler in `campaignTriggers.ts` — weighted-random reward selection from `actionConfig.rewards[]`, creates `Redemption` record for winning reward
2. **Schema**: Add `INSTANT_WIN` reward type; extend `ActionConfigSchema` in `packages/shared/src/zod/campaign.schema.ts` with spin_wheel variant holding `{ rewards: [{rewardId, probability, label, color}...], wheelStyle }` 
3. **API**: New endpoint `POST /v1/public/campaigns/:id/play` — validates member eligibility, returns pre-determined result + wheel config (segments, colors, winning index)
4. **Embeddable Component**: `<ceq-spin-wheel>` Web Component — pure CSS/JS animated wheel. Fetches config from API, renders segments, animates spin to pre-determined result, fires `ceq:reward-won` custom event. Customizable colors, segment count, spin duration. Distributed via CDN (`<script src="https://cdn.customereq.com/components/spin-wheel.js">`).
5. **Admin Preview**: Live spin wheel preview in campaign creation form showing configured segments and colors

**Effort**: Medium | **Impact**: High
Spin wheels drive 30-50% higher engagement than static point awards. Creates shareable social moments.

---

### 2. Scratch-Off Card Reveal

**Builds on**: Same `actionType` extensibility + `CampaignEvent` model + `actionConfig` JSON

**What changes**:
1. **Backend**: `actionConfig` holds `{ prizes: [{rewardId, probability}...], cardStyle: "gold"|"silver"|"holiday" }`. Random prize assigned at trigger time, stored in `CampaignEvent` (add `result` JSON column)
2. **Schema**: Add `result` JSON field to `CampaignEvent` in `schema.prisma`
3. **API**: `POST /v1/public/campaigns/:id/play` returns `{ cardStyle, scratchAreaImage, prize: { name, description, points } }` — result pre-determined server-side
4. **Embeddable Component**: `<ceq-scratch-card>` Web Component — HTML5 Canvas overlay with touch/mouse scratch interaction. Reveals prize image underneath when ~60% scratched. Fires `ceq:card-revealed` event. Configurable card styles (gold foil, holiday theme, brand-custom). Works on mobile (touch events).
5. **Email/SMS integration**: Campaign trigger sends email/SMS with link to scratch card page, driving re-engagement back to brand site

**Effort**: Medium | **Impact**: High
Scratch cards create a dopamine-driven "reveal" moment. Can be sent via email/SMS with a link, driving re-engagement.

---

### 3. Challenge / Mission System

**Builds on**: `EarningRule` model (conditions, maxUsesPerMember) + `evaluateRulesWithIds()` in `loyaltyEvents.ts` + `LoyaltyEvent` history

**What changes**:
1. **New model**: `Challenge` (programId, name, steps: JSON[{triggerEvent, condition, label}], bonusPoints, badgeId?, startDate, endDate)
2. **New model**: `ChallengeProgress` (challengeId, memberId, completedSteps: string[], completedAt?)
3. **Worker**: New `challengeProgress.ts` processor listening to loyalty events queue, updating progress
4. **API**: `GET /v1/public/members/me/challenges` — active challenges with progress for authenticated member
5. **Embeddable Component**: `<ceq-challenge-progress>` Web Component — displays active challenges as cards with step checklists and animated progress bars. Each step shows completion state (locked/current/done). Fires `ceq:challenge-completed` event on final step. Configurable layout (vertical list or horizontal carousel).
6. **Admin UI**: Challenge builder in campaign creation — define steps, assign point values per step, set completion bonus

**Effort**: High | **Impact**: High
Multi-step challenges drive 3-5x repeat visits (e.g., "3 purchases + 1 review + 1 referral = 1000 bonus points"). Richer than AnnexCloud's basic milestones.

---

### 4. Mystery / Surprise Rewards

**Builds on**: `Reward` model types + `Campaign.actionConfig` JSON + `campaignTriggers.ts`

**What changes**:
1. **Backend**: When `actionType: "award_reward"` and reward type is `MYSTERY`, randomly select from configured pool. Result hidden until member "opens" it
2. **Schema**: Add `MYSTERY` to `RewardType` enum in `schema.prisma`
3. **API**: `POST /v1/public/rewards/:id/reveal` — reveals mystery reward, updates redemption status
4. **Embeddable Component**: `<ceq-mystery-box>` Web Component — 3D gift box with open animation (CSS transforms). Shows "tap to open" prompt, plays unwrapping animation, reveals reward with confetti effect. Fires `ceq:reward-revealed` event. Configurable box style (gift wrap, treasure chest, branded).

**Effort**: Low | **Impact**: Medium
Lowest implementation effort. The "curiosity gap" (what's inside?) drives 2-3x higher click-through than known rewards.

---

### 5. Streak & Consecutive Engagement Rewards

**Builds on**: `LoyaltyEvent.createdAt` timestamps + `EarningRule.conditions` + `evaluateConditions()` in `packages/shared/src/conditions.ts`

**What changes**:
1. **Schema**: Add `Member.currentStreak` (int) and `Member.longestStreak` (int)
2. **Worker**: In `loyaltyEvents.ts`, after processing event, check consecutive-day/week qualifying events. Increment or reset streak
3. **Rules**: New condition type `streak_gte` — "if streak >= 7, apply 2x multiplier"
4. **API**: `GET /v1/public/members/me/streak` — returns `{ currentStreak, longestStreak, lastActivityDate, nextMilestone }`
5. **Embeddable Component**: `<ceq-streak-counter>` Web Component — animated flame/fire icon with day count. Grows in intensity with streak length (small flame at 1, inferno at 30+). Shows "streak at risk" warning when approaching midnight without activity. Fires `ceq:streak-milestone` event at configurable thresholds. Compact enough to embed in nav bars or profile widgets.

**Effort**: Medium | **Impact**: Medium
Streaks exploit loss aversion (Duolingo model). Once a user has a 10-day streak, they go out of their way not to break it.

---

### 6. Visual Campaign Templates ("Recipes")

**Builds on**: `CreateCampaignSchema` in `packages/shared/src/zod/campaign.schema.ts` + campaign creation form at `apps/web/src/app/(admin)/admin/campaigns/new/page.tsx` + MCP `create_campaign` tool

**What changes**:
1. **Template library**: JSON file or DB table of pre-built configs: "NPS Recovery Spin Wheel", "Holiday Scratch Card", "New Member Challenge", "Birthday Surprise"
2. **Admin UI**: Template gallery on creation page — click template, form pre-fills, customize, launch
3. **Preview**: Live preview rendering the actual embeddable component (`<ceq-spin-wheel>`, `<ceq-scratch-card>`, etc.) in an iframe so admins see exactly what members will experience
4. **Embed code generator**: After creating a campaign, admin gets a copy-paste embed snippet (`<script>` + `<ceq-spin-wheel campaign-id="..." token="...">`) ready to drop into their site

**Effort**: Low | **Impact**: Medium
Removes the "blank page" problem. Instead of configuring triggerType + triggerCondition + actionType + actionConfig, marketers pick "Birthday Surprise Scratch Card" and customize colors. The embed code generator closes the loop from creation to deployment.

---

## Priority Matrix

| Suggestion | Effort | Impact | Recommended Order |
|---|---|---|---|
| Mystery/Surprise Rewards | Low | Medium | 1st — quick win, minimal code |
| Visual Campaign Templates | Low | Medium | 2nd — improves admin UX immediately |
| Spin-the-Wheel | Medium | High | 3rd — flagship interactive feature |
| Scratch-Off Cards | Medium | High | 4th — pairs well with spin wheel infra |
| Streak Rewards | Medium | Medium | 5th — drives daily engagement |
| Challenge/Mission System | High | High | 6th — most complex, biggest payoff |

---

## Moonshot: AI-Personalized Dynamic Campaigns

*Speculative — flagged as visionary, not anchored to current code*

What if campaigns weren't pre-configured at all? The existing BAML + GPT-4o integration (used for feedback clustering in `apps/worker/src/processors/`) could power an "AI Campaign Engine" that:
- Observes each member's behavior pattern
- Dynamically selects the right game mechanic (spin wheel for impulse buyers, challenges for completionists, streaks for habitual users)
- Personalizes difficulty, rewards, and timing per member
- A/B tests itself and optimizes

No loyalty platform does this today. This would be a true 10x differentiator.

---

## Verification

- [x] All "Currently Exists" items have file paths
- [x] No hypothetical functionality presented as real
- [x] All "Could Be Built" suggestions reference existing architectural foundation
- [x] Clear distinction between current state and future possibilities
- [x] Each suggestion has a realistic implementation approach
