# Programs / Campaigns / Tools — Positioning Strawman

**Status**: Strawman for team iteration. Not a decision. Not a spec.
**Audience**: CustomerEQ team (product, engineering, GTM, exec).
**Date**: 2026-05-11
**Author**: Manohar + Claude (late-night capture; expect rough edges, edit freely).
**Extends, does not replace**: [programs-vs-campaigns-customer-usage-2026-05-02.md](./programs-vs-campaigns-customer-usage-2026-05-02.md). That doc defines today's lower-level split (Program = loyalty rulebook, Campaign = trigger/condition/action). This doc proposes a *broader* outcome-first frame that wraps around it.
**Related issue**: #316.

---

## TL;DR

We are considering reframing CustomerEQ's top-level concept hierarchy:

| Layer | Today (de facto) | Proposed |
|---|---|---|
| **Program** | A configured loyalty rulebook (rules, tiers, rewards, budget) — a *thing the admin builds* | An **org-level outcome the brand wants** (Increase Loyalty, Increase Sales, Increase Employee Happiness). Long-lived. Owned by an executive sponsor. Has a measurable KPI. |
| **Campaign** | A time-bound trigger/condition/action lever inside a loyalty program | An **action a brand takes to move a Program's KPI**. Time-bound or always-on. May span multiple tools. |
| **Tools** | Implicit — surveys, loyalty engine, support, KB are just features of the app | Explicit, named layer: **the instruments that sense customer signal and enact value**. Today: Survey, Loyalty, Support, KB. Tomorrow: Community, Social Listening, Voice, anything we plug in. |

The thesis: **competitors sell tools; nobody sells the outcome layer.** Qualtrics sells surveys. Zendesk sells support. Yotpo sells a loyalty engine. CustomerEQ becomes the platform that wraps tools inside Campaigns inside Programs, with the Program scored against an executive-level KPI.

This is a strawman. We have not decided anything yet. The rest of this doc is what resonates, where the frame strains, and the two architectural framings we need to choose between.

---

## What resonates about the new frame

1. **It matches how executives talk.** A CRO says "our retention program." A CHRO says "our employee engagement program." A VP Customer says "our voice-of-customer program." Today our product UI uses "Program" to mean *one configured loyalty rulebook*, which is not how the buyer uses the word.

2. **ROI gets a natural home.** Today, ROI lives at the Campaign level ("did Black Friday 2× points pay back?"). That answer is local. With Programs at the top, ROI rolls up: "did the Loyalty Program move 12-month retention by 3pp?" The CFO question gets a CFO answer. This maps directly to the **ROI visibility** differentiator in `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md`.

3. **It positions CustomerEQ as a platform, not a tool.** The platform thesis only works if there is a coordinating concept *above* the tools. Programs are that concept. Without them, we are a bundle of features in search of a story.

4. **It owns competitive whitespace.** A back-of-envelope vendor map:
   - **Tool-layer vendors**: Qualtrics, Medallia, SurveyMonkey (surveys); Zendesk, Intercom, Front (support); Yotpo, Annex Cloud, Smile.io (loyalty); Zendesk Guide, Intercom Help Center (KB).
   - **Campaign-layer vendors**: Braze, Iterable, Customer.io (orchestration); Salesforce Marketing Cloud.
   - **Program-layer vendors**: ~nobody. CDPs (Segment, mParticle) come closest but they sell *data pipes*, not goal-bound programs.
   The Program layer is the whitespace.

5. **Extensibility for free.** Any new module slots in as a Tool. A Campaign composes Tools. A Program contains Campaigns. We do not need a new top-level concept every time we add a capability.

6. **It separates strategy from configuration.** Today "configure a Program" is a 7-step wizard about rules and tiers — i.e., configuration. In the new frame, "create a Program" is a strategic act ("we are going to invest in Loyalty this year, here is the KPI, here is the budget envelope"). Different action, different user, different cadence. The current 7-step wizard becomes "configure the Loyalty *Tool* under this Program."

---

## Where the frame strains

### 1. Naming collision with today's `Program`

This is the single biggest issue. In the current codebase:

- `packages/database/prisma/schema.prisma` has a `Program` model = loyalty rulebook (rules, tiers, rewards).
- `apps/web/admin/programs` is a 7-step wizard to *build* one.
- Customer-facing copy, sales decks, demos, and the existing concept doc all use "Program" in that narrower sense.

If we promote "Program" to mean *org-level outcome*, then today's `Program` is actually a **Tool configuration** in the new world — specifically, the configuration of the Loyalty Tool under the Loyalty Program.

Two meanings of the same word will hurt onboarding, sales conversations, and internal alignment. We have to choose a path (see "Two framings" below).

### 2. "Tools just measure" understates Surveys and Support

The current sketch says "tools to measure and provide value." That is half right. In CustomerEQ specifically, tools both:

- **Sense** — a survey captures NPS; support tickets surface friction; reviews surface delight.
- **Enact** — a survey *is* an engagement touch (we asked, the customer felt heard); support resolves a problem (value delivery); loyalty awards a reward (value delivery).

Issue #6 (the hero) is precisely this — a survey both *senses* (NPS ≤ 6) and *triggers* (campaign fires within 15 min). If we frame Tools as "measurement," we lose that loop in the language. Better language: **Tools sense signal and enact value. Campaigns coordinate them.**

### 3. Campaign got broader, and that needs disambiguation

The old doc defines Campaign as a *trigger/condition/action lever* — a concrete object with `triggerCondition`, `actionType`, `actionConfig`. In the new frame, "Campaign" expands to "any action a brand takes to move a Program KPI" — which now includes things like "launch a knowledge base," "run a referral promotion this quarter," "deploy quarterly NPS surveys." Those are not the same kind of object.

We probably need two flavors:
- **Strategic campaign** (a.k.a. *Initiative*): a quarterly program of work, possibly composing multiple Tools and multiple Tactical campaigns. "Q3 Detractor Recovery push."
- **Tactical campaign**: the existing trigger/condition/action engine. "If NPS ≤ 6, award $10 coupon within 15 min."

Open question: do we call both "Campaign," or do we reserve "Campaign" for one and use "Initiative" / "Play" / "Motion" for the other?

### 4. Programs are slogans until they have a KPI

"Increase Loyalty" is not a program; it is a wish. A Program needs:

- A **KPI** (NPS, 12-month retention, NRR, eNPS, ARPU, repeat-purchase rate).
- A **baseline** (where the KPI is today).
- A **target** (where the brand wants it).
- A **budget envelope** (so Campaigns underneath can charge against it).
- An **executive owner** (the person on the hook).

Without these, the Program layer is decorative. With them, it is a contract.

### 5. Multi-buyer GTM is a feature *and* a bug

Loyalty → VP Customer / CMO. Sales → CRO. Employee Happiness → CHRO. Customer Support quality → COO / VP Support. The new frame implicitly says "CustomerEQ is for any of these buyers."

- **Feature**: bigger TAM, more expansion paths inside an account, more strategic positioning.
- **Bug**: sales motion has to be focused. We do not have the field team to chase four buyers today. We probably pick one Program type as the *wedge* (Loyalty or Detractor Recovery, given Issue #6) and expand the surface only once that motion is repeatable.

### 6. The buyer does not start at the top

Customers do not show up saying "I need a Loyalty Program." They show up saying "my NPS is bad" or "I need to send surveys" or "my churn is too high." They buy a **Tool**. Then they add a Campaign. Then they realize they have a Program.

The framework has to be **top-down for vision, bottom-up for onboarding**. Pricing, marketing, and the admin UX have to start at the Tool and surface the Program over time. If we make customers think strategy-first on day one, we lose them.

---

## Two framings — pick one (this is the decision the team needs to make)

Both honor the org-goal-first hierarchy. They differ in how much surgery we do on today's `Program` concept.

### Framing A — *Respect sunk cost*

**Move**: Keep `Program` = loyalty rulebook (existing semantics, existing model, existing UI). Add a *new* layer above called **Initiative** or **Outcome** that represents the org-level goal. Today's `Program` becomes one of several "instruments" that an Initiative may use.

**Pros**
- Minimal rename. No Prisma migration. No admin URL changes. No retraining of sales decks.
- Ships fast — could be a doc + a thin DB model for `Initiative` linking many `Program` and many `Campaign` rows.
- Existing customers see no breaking change.

**Cons**
- Permanently conflates two meanings of "Program" — the executive's "Loyalty Program" and our internal `Program` object. Every customer call, every onboarding session, every doc has to disambiguate.
- "Initiative" is a weaker word than "Program" for the top layer. Marketing will fight us on it.
- We have signaled that the platform thesis is real but we have not committed to it in the schema. The model stays loyalty-centric.

### Framing B — *Clean slate*

**Move**: Rename today's `Program` to **Loyalty Plan** (or **Loyalty Engine**, **Loyalty Program** as a *type*, etc.). Promote **Program** to the org-goal layer. Restructure the data model so Brand → Program → Campaign → Tool config.

**Pros**
- Cleanest mental model. The word "Program" means the same thing in the product, in the schema, and in the executive's mouth.
- Future-proofs the platform thesis. Adding the Support Program or the Employee Happiness Program is symmetrical to the Loyalty Program.
- The admin nav and information architecture become outcome-first ("Loyalty Program" with sub-areas Surveys, Rewards, Campaigns, Members, Reporting) instead of feature-first.

**Cons**
- Large rename across code, migrations, admin UI, customer-facing copy, marketing site, sales collateral, FRAIM specs, RFCs, and historic concept docs.
- Migration risk for existing customer data and saved URLs.
- Several months of language drift inside the team before the new vocabulary sticks.

### The deciding question

> Is the platform thesis our actual product story, or is it a future option we want to keep open?

- If **actual product story** → Framing B. The cost is real but it is one-time, and every quarter we delay it is another quarter of conceptual debt.
- If **future option** → Framing A. Reserve the cleaner version for the day we decide. Ship the Initiative layer now as a low-risk wrapper.

My weak prior is Framing B *if* we are confident in the platform pivot — the conceptual debt of two meanings of "Program" will quietly tax every customer conversation for years. But Framing A is the right call if we are still pressure-testing the thesis. The right answer depends on a conversation we have not had yet.

---

## How the layers compose (worked example)

Using the **Loyalty Program** as the example, in Framing B's vocabulary:

```
Program: "Increase 12-month customer retention from 62% to 72% by EOY"
├── KPI: 12-month retention
├── Owner: VP Customer
├── Budget: $X/quarter
└── Campaigns:
    ├── Detractor Recovery  (Issue #6 hero)
    │   └── Tools: Survey (sense NPS ≤ 6), Loyalty (reward $10 coupon), Support (route to human if NPS ≤ 4)
    ├── Black Friday 2× Points
    │   └── Tools: Loyalty
    ├── At-Risk Win-back
    │   └── Tools: Loyalty, KB (suggest help article first)
    └── VIP Birthday
        └── Tools: Loyalty, Survey (post-birthday satisfaction check)
```

Key observation: **Campaigns compose multiple Tools.** The Detractor Recovery campaign is not a "loyalty campaign" or a "survey campaign" — it is a cross-tool play that exists at the Campaign layer. This is exactly the platform thesis. No single-tool vendor can build that natively; they ship integrations and hope.

---

## Persona / buyer mapping

| Layer | Persona | Cadence | Question they ask |
|---|---|---|---|
| **Program** | Executive sponsor (VP / C-suite) | Quarterly | "Did the Loyalty Program move retention?" |
| **Campaign** | Program manager (CX Ops, Loyalty Manager, Marketing Manager) | Weekly | "Which campaign is paying back? Which to kill?" |
| **Tool** | Specialist (Survey Designer, Support Lead, Loyalty Admin) | Daily | "Is this survey going out? Is this ticket triaged? Is this reward earning?" |

The product UX should give each of these a home view, with the Program view being the one we lead the sales conversation with.

---

## Forward compatibility

In the new frame, any future module just plugs in as a Tool. Some near-term candidates (none committed):

- **Knowledge Base** (already partly in flight) — Tool that senses self-serve content gaps and enacts deflection.
- **Community / Forum** — Tool that senses engagement signal and enacts peer-to-peer support.
- **Voice / Call Analytics** — Tool that senses call sentiment and enacts coaching or rescue campaigns.
- **Social Listening** — Tool that senses brand mentions and enacts reply or escalation campaigns.
- **Reviews / UGC** — Tool that senses public sentiment and enacts thank-you or recovery campaigns.

None of these need a new top-level concept. They are all Tools available to all Programs.

---

## What this doc is *not*

- Not a spec. No acceptance criteria.
- Not a Prisma migration plan. We have not decided on Framing A vs B.
- Not a marketing repositioning. That follows once we converge.
- Not a deletion of [programs-vs-campaigns-customer-usage-2026-05-02.md](./programs-vs-campaigns-customer-usage-2026-05-02.md). That doc still describes the *current* loyalty Program / Campaign semantics correctly. This one wraps an outcome layer around it.

---

## Open questions for the team

1. **Framing A or Framing B?** Or a hybrid (e.g., introduce `Program` as the top layer in product surface but leave the Prisma model name alone for now)?
2. **What do we call the layer that today's `Program` becomes?** Loyalty Plan, Loyalty Engine, Loyalty Program (as a *type*), Rewards Engine? Naming matters; customers will read it.
3. **One word or two for Campaigns?** Keep "Campaign" as the umbrella with "strategic" and "tactical" qualifiers, or split into **Initiative** (strategic) + **Campaign** (tactical)?
4. **Do Programs need budgets in the schema?** If yes, where does that money roll up from — per-Campaign caps, per-Tool spend, or both?
5. **What is the wedge Program?** Which Program type do we lead with in GTM? Almost certainly Loyalty or Detractor Recovery (per Issue #6), but worth saying out loud.
6. **How does pricing change?** Does CustomerEQ price per Program, per Tool, per active member, per event volume? This affects the framework's pull on commercials.
7. **What changes for the admin UX in v1?** Probably very little; the framework is a vocabulary shift first, a code shift later. But we should agree on the rollout.

---

## Next steps if we want to move forward

1. Team review of this doc (async comments or 30-min sync).
2. Pick Framing A or B (or hybrid). Record decision in this doc.
3. If B (or hybrid that includes a rename): file the rename as its own issue with a migration plan, not as part of this concept.
4. Update marketing language strawman (separate doc, separate review).
5. Decide wedge Program for GTM and align sales motion.
6. Revisit `docs/replicate/IMPLEMENTATION_ROADMAP.md` for any reordering implied by the new framing.

Nothing in this list is committed. We can also decide the new frame is overreach and stop here.
