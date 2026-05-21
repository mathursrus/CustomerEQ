# CustomerEQ Strategy & Positioning — Strawman

**Status**: Strawman for team iteration. Not a decision. Edit freely.
**Audience**: CustomerEQ team (product, engineering, GTM, exec). Will eventually be the basis for an investor / hiring narrative.
**Date**: 2026-05-11
**Author**: Manohar + Claude (late-night capture; iterate together).
**Companion docs**:
- [programs-vs-campaigns-customer-usage-2026-05-02.md](./programs-vs-campaigns-customer-usage-2026-05-02.md) — describes the *current* loyalty Program / Campaign semantics. This strategy doc proposes an outcome-layer wrapper around it.
- [business-validation-report-cx-loyalty-platform-2026-03-24.md](../business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md) — ICP, differentiator, risks.
- [IMPLEMENTATION_ROADMAP.md](../replicate/IMPLEMENTATION_ROADMAP.md) — feature prioritization.
**Related issue**: #316.

---

## 0. Is it too early to write this?

Direct answer: **no for the vision, parts of the Phase 1 plan, and the validation criteria. Yes for committing to Phase 2+ details.** This doc is therefore:

- **Confident** on the strategic thesis and the conceptual frame.
- **Detailed** on Phase 1 (Loyalty Program), since it is current focus.
- **Directional** on Phase 2 candidates — not committed.
- **Gestural** on Phase 3+ — a list of options, not a plan.
- **Explicit** on the kill / pivot / advance criteria at each phase.

The honest risk of writing this now is **strategy-as-procrastination** — burning founder time on planning while Phase 1 features ship slowly. The mitigation: this doc has a hard ceiling of 4 hours of total invested time. After that, every additional hour goes into shipping Phase 1.

---

## 1. TL;DR (the bet, in three lines)

1. CustomerEQ becomes the platform that wraps the CX/loyalty/support tool stack inside **Programs** (org-level outcomes) and **Campaigns** (cross-tool actions), with **ROI rolling up to the Program KPI** the executive cares about.
2. **Phase 1** ships the **Loyalty Program** outcome layer on top of our existing surveys + loyalty engine + support, with the Issue #6 real-time CX-to-loyalty loop as the proof point.
3. **Phase 2** picks one adjacent Program (likely Customer Support cost-to-serve, possibly Sales) once Phase 1 has paying-customer evidence. **Phase 3+** is gestural.

---

## 2. The thesis

### 2.1 The problem we are solving

Brands today own a CX stack assembled from disconnected tool vendors:

- Surveys (Qualtrics, Medallia, SurveyMonkey)
- Support (Zendesk, Intercom)
- Loyalty (Yotpo, Annex Cloud, Smile.io)
- Help / KB (Zendesk Guide, Intercom)
- Reviews / UGC (Yotpo, Bazaarvoice)

Each tool is *locally optimal* but *globally disconnected*. The signal a survey captures rarely triggers a loyalty action in time to recover the customer. Support tickets do not roll up to the Loyalty KPI. The CFO cannot get a single answer to "did we move 12-month retention this year, and what did we spend to move it?"

This is the **CX disintermediation tax**: high spend on tools, low orchestration value, no executive-grade accountability.

### 2.2 The bet

A platform that:

1. **Owns the outcome layer** — Programs scoped to executive KPIs (loyalty, retention, sales, support cost-to-serve, employee engagement).
2. **Coordinates the tool layer** — Surveys, Loyalty Engine, Support, KB, etc. plug in as composable Tools; cross-tool Campaigns are first-class.
3. **Rolls ROI up the stack** — Campaign spend → Program KPI movement → executive dashboard. Single accountability line.
4. **Acts in real time** — Issue #6's <15-min CX-signal-to-action SLA is the differentiator vs every tool vendor (whose webhooks ship signal but not the action).

### 2.3 What this is *not*

- Not a CDP. CDPs ship pipes; this ships outcomes.
- Not a CX point tool. We are not a better SurveyMonkey.
- Not just an integration layer. The Campaign + Program logic is native, not iPaaS glue.
- Not vertical-specific (yet). We start with broad-applicability Programs.

---

## 3. Conceptual frame (condensed)

The three-layer hierarchy:

| Layer | Definition | Examples | Buyer |
|---|---|---|---|
| **Program** | An org-level outcome the brand commits to, with a KPI, baseline, target, budget, and executive owner. Long-lived (12+ months). | Loyalty Program, Customer Support Program, Sales Program, Employee Happiness Program | Executive (VP / C-suite) |
| **Campaign** | An action — possibly cross-tool — taken to move a Program's KPI. Time-bound or always-on. | "Detractor Recovery" (Survey + Loyalty + Support), "Black Friday 2× Points" (Loyalty only), "At-Risk Win-back" (Loyalty + KB) | Program manager (CX Ops, Loyalty Manager, etc.) |
| **Tool** | An instrument that senses customer signal and enacts value. Tools plug into Campaigns. | Surveys, Loyalty Engine, Support, KB, Reviews, future: Community, Voice, Social | Specialist (Survey Designer, Loyalty Admin, Support Lead) |

**Key property**: Campaigns are *cross-tool by default*. This is the platform thesis. A single-tool vendor cannot natively run a Campaign that senses with a Survey, rewards with a Loyalty Engine, and routes to Support — they ship integrations and hope.

We commit to **clean-slate refactor** of today's `Program` (loyalty rulebook) to make room for this. Today's `Program` becomes `LoyaltyPlan` (or `LoyaltyEngineConfig`, naming TBD), and the new top-level `Program` model is the outcome container. See §13 for the rename decision still to be made.

Detail on the *current* (pre-refactor) loyalty Program / Campaign object semantics: [programs-vs-campaigns-customer-usage-2026-05-02.md](./programs-vs-campaigns-customer-usage-2026-05-02.md). That doc remains accurate for the current codebase and should be updated post-refactor.

---

## 4. Why us — unfair advantage

Strategy docs without a "why us" feel hollow. Honest assessment:

| Asset | What it gives us |
|---|---|
| **Event-driven architecture, already shipping** | Project rule 5 enforces every loyalty action through BullMQ. The <15-min real-time loop (Issue #6) is not aspirational — it is the architecture. Tool-vendor competitors retrofitting this would have to rewrite their data path. |
| **Multi-tool surface already in the product** | We are not a survey company adding loyalty, or a loyalty company adding surveys. The unified data model is in the schema today (`LoyaltyEvent` is the connecting thread). |
| **Multi-tenant from day one** | `brandId` discipline (rule 6) means we can scale across brands without retrofitting tenancy. |
| **PostgreSQL ledger integrity** | Earn/burn transactional discipline (rule 7) gives us audit-grade ROI math. Most loyalty tools have eventual-consistency reconciliation hell. |
| **Architecture clarity** | `docs/architecture/architecture.md` is authoritative; ADRs are real. We can change direction without rediscovering why decisions were made. |
| **Small team, no legacy customers** | We can refactor. Incumbents cannot. |

**Honest limits of "why us":**
- No customer evidence yet that buyers want the outcome layer (see §11).
- Team is small; multi-buyer GTM expansion is years out, not quarters.
- No proprietary data network effect (yet). The moat is built, not inherited.

---

## 5. Phase 1: Loyalty Program (current focus)

### 5.1 Scope

**Ship the Loyalty Program as a Program** — i.e., the org-outcome container — composing all our current tools:

- **Outcome KPI(s)**: NPS, 12-month retention rate, repeat-purchase rate, ARPU. Brands pick which to commit to.
- **Tools in scope**: Surveys (signal capture), Loyalty Engine (rules/tiers/rewards/budget), Support (routing for low-NPS responders), KB (deflection for known issues), basic event ingestion.
- **Campaigns in scope**: Existing trigger/condition/action engine, with cross-tool actions enabled. Detractor Recovery (Issue #6) is the headline campaign.
- **Refactor**: today's `Program` becomes `LoyaltyPlan` (or similar). New `Program` model wraps it as the outcome layer.

### 5.2 The headline play

The **Real-Time Detractor Recovery Campaign** under the Loyalty Program is what we sell. It is concretely:

> "Within 15 minutes of a customer giving NPS ≤ 6 on any survey, CustomerEQ awards a $10 recovery coupon, routes the response to a human if NPS ≤ 4, and logs the spend against the Loyalty Program's budget. End of quarter, you can answer 'did detractor recovery move 12-month retention?' with a number, not a slide."

This is the wedge. It is concrete, narrow enough to demo, broad enough to expand from.

### 5.3 Phase 1 buyer & motion

- **Primary buyer**: VP Customer / VP CX / CMO at mid-market DTC brands with $20M–$200M revenue.
- **Secondary stakeholder**: CFO / COO (signs off on the program budget, wants ROI roll-up).
- **Wedge entry**: Detractor Recovery (concrete, fast time-to-value), then expansion into broader Loyalty Program (tiers, multi-campaign, ROI dashboard).
- **Sales motion**: Founder-led for first ~10 customers. Document the repeatable conversation. Hand off to sales only after the conversation is canned.

### 5.4 Phase 1 deliverables (engineering)

This is the high-level sequence; exact issue list lives in `docs/replicate/IMPLEMENTATION_ROADMAP.md`.

1. Refactor `Program` model: rename existing → `LoyaltyPlan`; create new `Program` (outcome) with KPI, baseline, target, budget, owner.
2. Wire Campaign → Program FK so every campaign rolls up to a Program.
3. ROI dashboard at the Program level (spend vs KPI movement).
4. Cross-tool Campaign actions (a single Campaign can simultaneously: award points, send survey, route to support, link to KB).
5. Issue #6 hero loop hardened, SLA-monitored, demoable.
6. Onboarding flow: new brand picks a Program type → sets KPI + baseline + target → walks into existing tool config.

### 5.5 Phase 1 validation criteria (kill / pivot / advance)

We do not advance to Phase 2 until **all** of the below are true:

| Criterion | Bar | Why it matters |
|---|---|---|
| **Paying customers** | ≥ 5 paying brands on the Loyalty Program | Real revenue is the only validation that matters |
| **Outcome-layer adoption** | Of those, ≥ 3 are actively using the Program-level KPI roll-up (not just the loyalty engine alone) | Tests whether the outcome layer is the actual value, vs. just bundled tools |
| **SLA proven** | Issue #6's <15-min loop sustained in production for ≥ 90 days across ≥ 3 brands | Differentiator must be real, not staged |
| **Cross-tool Campaigns in use** | At least one brand runs a Campaign that uses ≥ 2 Tools (e.g., Survey + Loyalty) | Validates the platform thesis, not just the tool bundle |
| **Repeatable sales** | Last 3 deals closed using the same 60-min pitch | We have a motion, not 5 bespoke wins |
| **Net dollar retention** | ≥ 110% trailing-quarter, or signs of expansion conversation | Customers grow the relationship, not just stay |

**Kill / pivot conditions** (any one triggers a strategy reset):

- < 3 paying customers after 9 months of GTM effort.
- Customers buy the loyalty engine *only*, ignore the Program layer. (Then we are a loyalty tool, not a platform — bigger pivot.)
- Detractor Recovery does not measurably move NPS or retention in the first cohort. (Then the hero loop is theater, not value.)

---

## 6. Phase 2: directional, not committed

When Phase 1 clears the validation bar, we pick **one** adjacent Program. We do not run two new Programs in parallel — the team will fracture.

### 6.1 Candidate Phase 2 Programs

| Candidate | Buyer | KPI | Tool reuse | Why it might be next | Why it might not |
|---|---|---|---|---|---|
| **Customer Support Program** (cost-to-serve) | COO / VP Support | Deflection rate, CSAT, cost per ticket | High — reuses KB + Support + Surveys we already have | Lowest engineering cost; same VP Customer buyer often owns Support; KB is partly built | Less differentiated narrative ("we are not Zendesk") |
| **Sales Program** (revenue growth) | CRO | Win rate, deal velocity, upsell ARR | Medium — needs CRM ingestion (Salesforce, HubSpot) | Biggest TAM; CRO is a high-budget buyer | Different buyer; needs new integrations; we'd compete with Gong / Salesforce |
| **Employee Happiness Program** (engagement) | CHRO | eNPS, retention | Low — needs internal-survey, HRIS ingestion | Trend tailwind (engagement is hot) | Completely different buyer + data model; dilutes focus |
| **Win-back / Reactivation Program** | VP Customer (same buyer) | Reactivation rate, churn save | High — same tools as Loyalty | Cheapest expansion; same buyer | Might be a *Campaign* under Loyalty, not a Program — needs separation rigor |

**My weak prior**: Customer Support Program is most likely Phase 2 — same buyer, highest tool reuse, lowest engineering cost, fastest expansion. But we hold the decision until Phase 1 evidence is in.

### 6.2 Phase 2 selection criteria

We choose Phase 2 based on, in priority order:

1. **Customer pull** — what are Phase 1 customers asking us to do next? (Highest signal.)
2. **Tool reuse** — how much of what we have already built applies?
3. **Buyer adjacency** — same buyer or an easy hand-off?
4. **TAM and pricing power** — bigger budget, faster sales cycles.
5. **Differentiation** — can we tell a story no incumbent can?

---

## 7. Phase 3+: gestural

Once two Programs are in market, the addressable Programs become:

- Employee Happiness / Engagement
- Sales / Revenue growth
- Brand / Reputation Program (reviews + UGC + social listening)
- Compliance / Trust Program (audit-grade CX data for regulated industries)
- Vertical-specific Programs (healthcare patient experience, financial-services member experience, etc.)

We list these to keep options open, not to commit. The platform architecture has to support adding a Program type without a rewrite; that is the long-term test of the strategy.

---

## 8. Commercial model — open question

This is unsolved. Three models, with first-pass thinking:

| Model | How it works | Pro | Con |
|---|---|---|---|
| **Per-Program subscription** | Customer subscribes to a Program (Loyalty Program $X/mo, Support Program $Y/mo); Tools are included | Aligns price with the value layer; supports multi-Program expansion narrative | New to buyers; no industry benchmark; risk of "I only want surveys, not the Program" pushback |
| **Per-active-member + Program tier** | Volume-based base (per loyalty member), tier upgrade for Program features | Familiar (Yotpo / Annex Cloud model); easy to grow ACV with the customer | Anchors us to per-member competitor pricing; doesn't capture cross-tool value |
| **Hybrid: platform fee + usage** | Flat platform fee for the Program layer; usage charges for high-volume tools (events, members, tickets) | Reflects platform + tool value separately; predictable revenue + usage upside | Complex to explain; risk of pricing-page abandonment |

**Decision criteria (not yet made):**

- Which model maps to a 60-min pitch the buyer accepts on the call?
- Which model survives a CFO procurement review without legal back-and-forth?
- Which model lets us 10× revenue without a price renegotiation?

I'd start with **per-Program subscription** for the first 5 customers (founder-led, custom pricing acceptable) and converge on a published model after observing what closes.

---

## 9. Competitive position & moat

### 9.1 Vendor landscape — where we sit

```
                              outcome layer (Programs)
                                      ⬆
                            [ CustomerEQ — whitespace ]
                                      ⬆
                          orchestration / campaigns
                          (Braze, Iterable, SFMC)
                                      ⬆
                                  tool layer
            (Qualtrics, Zendesk, Yotpo, Annex Cloud, Bazaarvoice)
                                      ⬆
                                   data layer
                          (Segment, mParticle, Snowflake)
```

- **Tool vendors** sell into a specialist buyer. They cannot natively own the outcome layer; their data model is tool-shaped.
- **Campaign / orchestration vendors** (Braze, Iterable) are closest. They can orchestrate cross-channel. But they do not own the *KPI roll-up* and do not own the *loyalty ledger*. We sit one layer above them in the value chain.
- **CDPs** sell pipes. Different business.

### 9.2 Moat — what we accumulate

**Short-term (0–18 months)**: speed to market + the real-time architecture. Easy to copy in 24 months if a competitor decides to.

**Long-term (18+ months)**: the moat has to be one of:

1. **Cross-tool customer signal data** — every brand on CustomerEQ has its CX signal unified in one ledger. Switching costs grow with time-on-platform. (Strongest candidate.)
2. **ROI benchmark data** — we know what NPS lift typical Detractor Recovery Campaigns deliver, by vertical, by spend. Buyers will pay to access the benchmark.
3. **Network effect across brands** — weaker for this category; CX is private data.

**Plan**: invest in the signal-ledger as the durable asset. Every product decision should ask "does this deepen the unified ledger, or just add a tool?" Adding a tool that does not unify signal is a checkbox feature, not a moat.

### 9.3 Competitive response

Honest assumption: if we succeed publicly, Qualtrics or Yotpo adds a "Programs" layer in 18 months. Our defense:

- **Speed**: ship Phase 1 + Phase 2 before they react.
- **Architecture**: their data model is tool-shaped; ours is event-shaped. Hard to retrofit.
- **Customer lock-in via ROI history**: brands won't switch off the system that holds their last 24 months of program ROI data.

If we lose the speed race, we lose. That is the real risk.

---

## 10. Tools — build vs partner vs acquire

We cannot build every Tool natively. Decision framework:

- **Build native** if the Tool is *core to the differentiator* (Surveys, Loyalty Engine, real-time campaign engine).
- **Partner / integrate** if the Tool is mature, commodity, and the brand already has a vendor (CRM, marketing automation, email send).
- **Acquire** rarely, and only when there is a strategic Tool with no defensible build-or-partner path (probably not in Phase 1 or 2).

Current state: Surveys, Loyalty, Support, KB are all native. That is a heavy bet — it pays off only if the cross-tool integration is the real value. (See §11, hole #2.)

---

## 11. Holes I am poking at this strategy

Listing these explicitly so we do not pretend they are not there.

1. **Loyalty-Program vs Detractor-Recovery messaging tension.** Phase 1 says "Loyalty Program." Issue #6 hero says "Real-Time CX-to-Loyalty." The sales pitch needs both — Loyalty Program is the *what we sell*, Detractor Recovery is the *what makes it different*. Lead with Loyalty Program, prove with Detractor Recovery. Get this wrong and either (a) we sound like every loyalty vendor or (b) we sound like a narrow point tool.
2. **Tool-layer commoditization.** Surveys, support, loyalty — all crowded markets. If our cross-tool composition is not visibly better than three integrated tools, we are a bundle play that loses on point-feature depth. The hero campaign has to be a *concrete demo*, not a slide.
3. **No customer evidence yet for the outcome layer.** The pitch tests well in conversation; it has not been tested at point-of-sale. We could be selling a frame buyers say "yes" to and then ignore in practice. The Phase 1 validation criteria are designed to catch this — but we should be ready to pivot the messaging if customers buy the loyalty engine and shrug at the Program layer.
4. **Multi-buyer GTM dilution.** Phase 2 candidate buyers (CRO, COO, CHRO) are different humans with different procurement paths. A small team cannot run three sales motions. Phase 2 selection has to be ruthless. If we pick "Sales Program" out of TAM-greed, we will end up half-built in two markets.
5. **Pricing-model unknown.** We are committing to a strategy without a commercial model. That is normal pre-PMF, but it means Phase 1 customer-acquisition cost data will be noisy until pricing converges.
6. **Moat erosion timeline.** Optimistic case: incumbents take 18 months to react. Pessimistic: 6 months for a Programs-layer marketing push (no engineering depth, but customer mind-share). We need a thought-leadership / content motion that brands the *frame* before the tool vendors do. Otherwise they recolonize the language.
7. **Refactor cost is real.** Renaming `Program` → `LoyaltyPlan` and promoting `Program` to outcome layer touches Prisma, admin UI, customer-facing docs, sales decks, FRAIM specs. We estimated this as cheaper than carrying the dual meaning forever — but the actual cost is non-trivial. Phase 1 timeline absorbs it; we should not underestimate.
8. **Strategy-as-procrastination risk.** This doc, useful as it is, is not a customer. Spending more than 4 hours per quarter on strategy iteration is a signal to stop and ship.
9. **Phase 1 success ≠ Phase 2 readiness.** Even if Phase 1 hits all validation bars, the team may not be ready to run a second motion. Phase 2 launch may be a *hire* (a second product/engineering lead, a sales hire), not a *ship*.
10. **No proprietary data network effect today.** The moat is data accumulation *over time*. Until we have ≥ 18 months of multi-brand data, we are running on architecture and speed alone. That is fine, but it has to be acknowledged.

---

## 12. Capital / runway implications (light touch)

Strategy docs without a financial frame are decoration. High-level only — leaving the spreadsheet to a separate doc.

- **Phase 1 cost**: probably bootstrappable through founder time + small team. The expensive line is GTM (founder-led sales is opportunity cost, not cash).
- **Phase 2 trigger**: ≥ $X ARR or ≥ 10 paying customers is the moment we either raise or stay capital-efficient for Phase 2. The choice is downstream of how much engineering is required to add a second Program type.
- **Investors will buy the frame, not the loyalty engine.** If we raise, the deck is the strategy doc, not the feature list. Therefore the strategy needs to be *legible to investors* (one-pager + this doc), even if we never raise.
- **No raise plan committed.** This is a stay-capital-efficient default with optionality.

---

## 13. Open questions / decisions needed

Listed roughly in priority order. Each gets resolved either inline in this doc or via a follow-up RFC.

1. **What is `LoyaltyPlan` named?** Loyalty Plan, Loyalty Engine, Rewards Engine, Loyalty Config? Customer-facing name matters.
2. **Strategic Campaign vs Tactical Campaign — one word or two?** Keep "Campaign" with qualifiers, or introduce "Initiative" for the strategic layer?
3. **What is the published Phase 1 commercial model?** Pick one of the three in §8 and commit by customer #6.
4. **Phase 2 candidate — what would change our prior toward "Customer Support Program"?** Define what would push us toward Sales or Win-back instead.
5. **How long is Phase 1?** Soft target?
6. **Who owns this strategy doc?** Single editor (the founder) with team comment, or shared editing? Strategy docs with too many cooks turn into mush.
7. **How do we measure that the outcome layer is the actual value, not the tools below?** §5.5 criteria are a start. Are they sufficient?
8. **Build-vs-partner decision for the next Tool added.** Pre-commit: Phase 2 reuses existing Tools, no new tool builds.
9. **What do we *say no to* during Phase 1?** Pre-commit: any feature that does not (a) move the Loyalty Program KPI, (b) tighten the Issue #6 SLA, or (c) reduce Phase 1 customer onboarding friction.
10. **How does this frame land on the marketing site / pitch deck?** Separate doc, separate review, but the language convergence happens here first.

---

## 14. Next steps if we choose to move forward

1. Team async-comment pass on this doc within 1 week (target: 2026-05-18).
2. Resolve open questions §13.1–§13.3 in line.
3. File a separate RFC for the `Program` → `LoyaltyPlan` rename with migration plan.
4. Pin Phase 1 validation bar §5.5 into `docs/replicate/IMPLEMENTATION_ROADMAP.md`.
5. Founder writes the 60-min Phase 1 pitch deck against this doc.
6. Quarterly review of the strategy doc against actual customer evidence.

If after the team pass we decide the outcome-layer framing is overreach, we revert to the narrower [programs-vs-campaigns-customer-usage-2026-05-02.md](./programs-vs-campaigns-customer-usage-2026-05-02.md) semantics and ship Phase 1 as a "better loyalty + CX product" without the platform claim. That fallback is fine. The point of writing this doc is to make the choice visible, not to commit prematurely.
