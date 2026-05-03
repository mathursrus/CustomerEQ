# Programs vs Campaigns — How Customers Use Them

**Audience**: CustomerEQ team (product, engineering, GTM, support)
**Purpose**: Shared mental model for how brands deploy Programs and Campaigns. Use this when scoping features, framing demos, writing docs, or onboarding new teammates.
**Date**: 2026-05-02
**Sources**: Annex Cloud replication ([../replicate/reports/REPLICATION_ANALYSIS.md](../replicate/reports/REPLICATION_ANALYSIS.md), [../replicate/analysis/use-cases.md](../replicate/analysis/use-cases.md)), Configure Program spec ([../feature-specs/2-configure-loyalty-program.md](../feature-specs/2-configure-loyalty-program.md)), campaign brainstorm ([../brainstorming/codebase-brainstorming-2026-04-02.md](../brainstorming/codebase-brainstorming-2026-04-02.md)).

---

## The conceptual split (and where competitors blur it)

- **Program** = the *rulebook*. A long-running container with: program type (Points / Tiered / Cashback / Hybrid), always-on earning rules, tiers, the rewards catalog, and a budget. Configured once, runs for years. Owned by the **Admin / Program Owner** (UC-09).
- **Campaign** = a *lever* on top of the rulebook. Time-bound, segment-targeted, trigger → condition → action. Stacks on the program; the program keeps running normally underneath. Owned by the **Marketing Manager** (UC-10). Architecturally it is the trigger/condition/action engine in the `Campaign` model with JSON `actionConfig` for extensibility.

Annex Cloud markets "Engage / Personalize / Retain / Advocate" as four pillars but the underlying split is the same: a configured program plus N campaigns and journeys layered on top. Where they are weak is the **real-time CX → campaign loop** — that is CustomerEQ's hero (Issue #6, the <15-min detractor-to-action SLA).

A useful analogy: the **Program is your tax code**. The **Campaigns are this quarter's stimulus checks**.

---

## Why one company runs *multiple* Programs

A program is bounded by audience + region + economic model. The moment any of those diverge, you need a second program — not just another set of rules.

### Example A — Specialty footwear brand, $80M revenue, US + UK, DTC + wholesale

| Program | Type | Why a separate program |
|---|---|---|
| **ShoeCo Rewards — US** | Tiered (Bronze/Silver/Gold/Platinum), USD, 1 pt per $1 | Region: USD currency, CCPA, US-specific reward catalog (Visa gift cards) |
| **ShoeCo Rewards — UK** | Tiered, GBP, slightly higher tier thresholds | GDPR consent strictness, different reward fulfillment vendors, VAT-inclusive pricing |
| **ShoeCo VIP B2B** | Cashback, net-30 settlement | Wholesale buyers redeem dollar-for-dollar against next invoice — completely different economics from a consumer points program |

This mirrors UC-19 (Multi-Brand / Multi-Region). Trying to cram all three into one program ends with a `regionId` field smeared through every rule and a budget that cannot be allocated cleanly.

### Example B — Grocery chain, omnichannel

| Program | Reason it stands alone |
|---|---|
| **GroceryClub Individual** (Points) | Single shopper, online + in-store receipts |
| **GroceryClub Family** (Hybrid) | Linked household — earnings pool across members; tier is shared |
| **GroceryClub for Business** (Cashback) | Small-business buyers; quarterly rebate against future orders, no tiering |

Same brand, three economic models. The earning rules, redemption catalog, and ROI math all differ.

### Example C — SaaS / subscription company (CustomerEQ's actual ICP)

Often **one Program is enough**: "ProductPulse Rewards" — Hybrid, where points come from renewal milestones, referrals, and survey completions, and tiers reflect tenure (1yr, 3yr, 5yr). The action is in the campaigns, not the rulebook.

---

## Why one Program runs *many* Campaigns

A campaign exists for one of five reasons: **time-bound promotion**, **CX signal response**, **lifecycle moment**, **segment-specific accelerator**, or **gamified engagement**. A healthy program runs 5–15 active or scheduled campaigns at any time.

Using **ShoeCo Rewards — US** as the parent program:

| # | Campaign | Trigger → Action | Reason it is a campaign, not a rule |
|---|---|---|---|
| 1 | **Black Friday 2× Points** | `purchase` event during 11/24–11/30 → multiplier on base earn | Time-bound; ends automatically; does not change the rulebook |
| 2 | **Detractor Recovery** *(Issue #6 hero)* | `survey_completed` with NPS ≤ 6 → award $10 coupon + send recovery message within 15 min | Reactive to a CX signal; this is the differentiator vs. Annex Cloud, which routes survey data manually through a separate workflow tool |
| 3 | **VIP Birthday Spin Wheel** | `member.birthday == today AND tier ∈ {Gold, Platinum}` → spin-the-wheel for 100–1000 bonus points (per [../feature-specs/83-spin-the-wheel-campaign.md](../feature-specs/83-spin-the-wheel-campaign.md)) | Segment-specific; gamified moment; only fires once per member per year |
| 4 | **Win-back At-Risk** | `days_since_last_purchase >= 90` → 250 bonus points + email | Member-state-driven; should auto-disable when the member returns |
| 5 | **Refer-a-Friend Boost** | `referral_converted` in March → 500 pts each side (vs. base 200) | Promotional ramp on top of the always-on referral rule in the program |
| 6 | **Review-with-Photo Bonus** | `review_submitted AND has_image` → scratch-off card ([../feature-specs/84-scratch-off-card-campaign.md](../feature-specs/84-scratch-off-card-campaign.md)) | Behavior-shaping; experiment for 30 days, A/B vs. flat 50-pt award |
| 7 | **Cart Abandonment Rescue** | `cart_abandoned AND tier ≥ Silver` → 200 pts + 24-hr coupon | Tier-gated, time-windowed, ROI-tracked separately |

Each one has its own budget cap, can be paused mid-flight, and produces its own performance number. The base program keeps running unchanged under all of them.

---

## The deciding tradeoff

The instinct to "just add another rule to the program" is the trap. Rules are forever; campaigns are disposable. If you put a Black Friday multiplier in the rulebook, someone will forget it on December 1st. If you put a detractor-recovery action in the rulebook, you cannot A/B test it, cannot budget-cap it separately, and cannot iterate fast.

**Heuristic for the team**: if it has a start-and-end date, a target segment, or a CX signal as its trigger — it is a **Campaign**. If it is part of "how earning works at this brand, full stop" — it is the **Program**.

---

## How this maps to the CustomerEQ data model

| Concept | Prisma model(s) | Owner UI |
|---|---|---|
| Program | `Program` + child `Rule`, `Tier`, `Reward` | `/admin/programs` (7-step wizard, Issue #2) |
| Campaign | `Campaign` (JSON `triggerCondition` + `actionType` + `actionConfig`), `CampaignEvent` for per-member dedup | `/admin/campaigns` |
| The connecting thread | `LoyaltyEvent` — every earn/burn writes one, regardless of whether a Program rule or a Campaign produced it | n/a |

Both flow through the BullMQ event queue per project rule 5 ("Event-Driven First — No Direct Writes for Loyalty Actions"). Both carry `brandId` per project rule 6 (multi-tenant).
