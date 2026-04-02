# Implementation Work List — Issue #83: Spin-the-Wheel Campaign

**Issue type**: feature
**Branch**: `feature/83-feat-spin-the-wheel-campaign-interactive-weighted-random-reward-selection`
**Worktree**: `/c/Users/sidma/OneDrive/Code/CustomerEQ - Issue 83`
**RFC**: `docs/rfcs/83-spin-the-wheel-campaign.md`
**Spec**: `docs/feature-specs/83-spin-the-wheel-campaign.md`

---

## Implementation Checklist

### Step 1: Schema Migration (R1, R3)
- [ ] `packages/database/prisma/schema.prisma` — Add `result Json?` field to `CampaignEvent` model
- [ ] Run `pnpm db:migrate` to generate migration
- [ ] Verify migration is non-breaking (existing rows get `result = NULL`)

### Step 2: Zod Schema Extensions (R1, R2)
- [ ] `packages/shared/src/zod/campaign.schema.ts` — Add `SpinWheelSegmentSchema`
- [ ] `packages/shared/src/zod/campaign.schema.ts` — Add `SpinWheelConfigSchema` with probability sum refinement
- [ ] `packages/shared/src/zod/campaign.schema.ts` — Extend `CreateCampaignSchema` actionType to include `'spin_wheel'`
- [ ] `packages/shared/src/zod/campaign.schema.ts` — Add `superRefine` to validate actionConfig against correct schema based on actionType
- [ ] `packages/shared/src/zod/campaign.schema.test.ts` — Add tests for new schemas

### Step 3: Weighted Random Utility (R4)
- [ ] `packages/shared/src/random.ts` — Create `selectWeightedRandom()` with `crypto.randomInt`
- [ ] `packages/shared/src/random.test.ts` — Unit tests (fairness over 10K iterations, edge cases)

### Step 4: Campaign Trigger Processor — spin_wheel branch (R3, R8, R9, R10)
- [ ] `apps/worker/src/processors/campaignTriggers.ts` — Add spin_wheel action handler
- [ ] `apps/worker/src/processors/campaignTriggers.test.ts` — Tests for spin_wheel trigger (weighted selection, points award, redemption creation, budget tracking)

### Step 5: Member Auth Helper (R5)
- [ ] `apps/api/src/plugins/memberAuth.ts` — Create `extractMemberJwt()` helper using Clerk `verifyToken()`
- [ ] Unit test for memberAuth helper

### Step 6: Play Endpoint (R5, R6, R7, R19)
- [ ] `apps/api/src/routes/public.ts` — Add `POST /v1/public/campaigns/:id/play`
- [ ] Install and configure `fastify-rate-limit` for play endpoint (10 req/min per member)
- [ ] `apps/api/test/integration/play.test.ts` — Integration tests (first play, already-played, no consent, expired, rate limit)

### Step 7: Admin UI — Segment Builder + Preview + Embed Code (R11, R12, R13, R14)
- [ ] `apps/web/src/components/ui/SpinWheelSegmentBuilder.tsx` — Segment add/remove, probability/label/color editors
- [ ] `apps/web/src/components/ui/SpinWheelPreview.tsx` — Canvas wheel rendering with test spin
- [ ] `apps/web/src/components/ui/EmbedCodeDisplay.tsx` — Code block with copy button
- [ ] `apps/web/src/app/(admin)/admin/campaigns/new/page.tsx` — Integrate new components, extend form state and payload transformation

### Step 8: Embeddable Web Component Package (R15, R16, R17, R18)
- [ ] `packages/embed/package.json` — Package config
- [ ] `packages/embed/tsconfig.json` — TypeScript config
- [ ] `packages/embed/vite.config.ts` — Vite library mode, IIFE output
- [ ] `packages/embed/src/ceq-spin-wheel.ts` — Web Component class with Shadow DOM
- [ ] `packages/embed/src/wheel-renderer.ts` — Canvas drawing logic
- [ ] `packages/embed/src/api-client.ts` — Fetch wrapper for play endpoint
- [ ] `packages/embed/src/styles.ts` — CSS-in-JS for Shadow DOM
- [ ] Add to `pnpm-workspace.yaml`

---

## Validation Requirements

- `uiValidationRequired`: true — admin campaign builder with segment editor
- `mobileValidationRequired`: false — admin is desktop-only; embed component mobile testing deferred to embed SDK issue (#82)
- `browserValidation`: Playwright at 1280x800 for admin UI
- `apiValidation`: Supertest for play endpoint + campaign creation
- `unitTests`: random utility, Zod schemas, campaign trigger processor
- `integrationTests`: play endpoint, campaign trigger with spin_wheel

## Quality Constraints (from project rules)

- Tests must never skip (Rule 11a)
- All mocks in `packages/config/src/test-utils/` (Rule 8)
- Transactions for points earn/burn (Rule 7)
- brandId on everything, never from request body (Rule 6)
- Event-driven: loyalty actions through BullMQ (Rule 5)

## Deferrals / Open Questions

- **Q1 (from spec)**: Multiple spins per campaign — deferred to Phase 2. Current: one-play-per-member.
- **Q2 (from spec)**: Spin result in trigger notification — current: notification says "You earned a spin!" without revealing result.
- **CDN deployment**: Build pipeline for `packages/embed` will output dist, but actual CDN deployment config deferred to #82.
- **Architecture doc updates**: 3 new patterns (member auth, packages/embed, rate limiting) to be updated in implement-architecture-update phase.
