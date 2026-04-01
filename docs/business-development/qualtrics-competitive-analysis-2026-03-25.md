# Qualtrics Competitive Analysis & Feature Strategy

**Date**: 2026-03-25
**Objective**: Identify the highest-value Qualtrics CX features to build into CustomerEQ, leveraging our existing loyalty engine to capture 25% of Qualtrics' addressable mid-market segment.

---

## Executive Summary

Qualtrics ($2.57B revenue, ~$12.5B valuation) dominates enterprise experience management but has a structural weakness: **it measures experience but cannot operationalize loyalty**. Their platform ends at "insight" — dashboards, tickets, and reports. The bridge from "customer gave us a 3/10 CSAT" to "immediately trigger a retention campaign with 500 bonus points" does not exist.

CustomerEQ already has the loyalty engine (points, rewards, campaigns, event queue). By building Qualtrics' highest-value CX capabilities **natively integrated with our loyalty engine**, we create a category that Qualtrics cannot match without acquiring or building an entire loyalty stack — something they've failed to do in 15+ years.

### The Prize

- Qualtrics mid-market segment: ~$640M annually (25% of ~$2.57B revenue)
- Target: 25% of Qualtrics' mid-market = **~$160M addressable opportunity**
- Our weapon: unified CX + loyalty in one platform at mid-market pricing ($25K-$50K/yr vs. Qualtrics' $25K-$100K+ for CX alone)

---

## What Qualtrics Does (and Doesn't Do)

### What They Do Well
1. **Survey Design & Distribution** — Multi-channel (email, SMS, in-app, web intercept, QR), branching logic, 16-language support
2. **Text Analytics (Text iQ)** — NLP-powered sentiment scoring, topic detection, open-ended response analysis
3. **Statistical Analysis (Stats iQ)** — Automated regression, significance testing, key driver analysis
4. **Predictive Models (Predict iQ)** — Churn risk scoring from behavioral + feedback signals
5. **Dashboards** — Role-based reporting, cross-program analytics

### What They Do NOT Do
1. **No loyalty program engine** — zero points, tiers, rewards, or earn/burn mechanics
2. **No real-time feedback-to-action** — closed-loop tickets target 5-day SLA, not 15 minutes
3. **Only 1-2% of feedback gets acted on** — Qualtrics themselves admit this "action gap"
4. **No campaign automation from CX signals** — can't auto-trigger loyalty offers from survey responses
5. **No reward fulfillment** — relies on Annex Cloud or BHN for basic survey incentives
6. **Poor mid-market fit** — too complex, too expensive, requires dedicated admins

### Qualtrics' Five Biggest Customer Complaints
1. **Slow deployment** — weeks/months to launch programs (vs. same-day competitors)
2. **Admin burden** — requires "survey engineers" and dedicated staff
3. **Insight-to-action gap** — dashboards don't provide clear next steps
4. **Expensive & opaque pricing** — no public pricing, constant upselling
5. **Poor support** — declining account management quality

---

## Strategic Thesis: Build the "Action Layer" Qualtrics Lacks

Qualtrics' architecture has a fundamental gap:

```
QUALTRICS TODAY:
  Collect Feedback → Analyze → Dashboard → Ticket → Manual Follow-up (5+ days)
                                              ↓
                                        (1-2% acted on)

CUSTOMEREQ UNIFIED:
  Collect Feedback → Analyze → Auto-trigger Loyalty Action (<15 min)
                                              ↓
                                        (100% acted on by rules engine)
```

We don't need to out-Qualtrics Qualtrics on survey design or statistical analysis. We need to build the **CX collection and analysis features that feed our existing loyalty engine** — then let the unified platform be the sales story.

---

## Feature Selection: What to Build

### Selection Criteria
1. **Synergy with existing loyalty engine** — Does it feed or enhance our earn/burn/campaign pipeline?
2. **Mid-market value** — Does it solve a problem mid-market teams actually have?
3. **Action-oriented** — Does it close the insight-to-action gap (our differentiator)?
4. **Build feasibility** — Can we build an 80% solution without Qualtrics' 15 years of survey R&D?
5. **Revenue impact** — Does it justify $25K-$50K/yr pricing?

### Tier 1: Build Now (Extends MVP Differentiator) — Est. 12-16 weeks

These features plug directly into our existing event pipeline and campaign engine.

| # | Feature | Why It's High-Value | Maps To Existing |
|---|---------|-------------------|-----------------|
| Q-1 | **Transactional NPS/CSAT/CES Surveys** | The #1 CX signal source. Without native survey collection, we depend on CRM webhooks. Native surveys = 10x more CX data flowing into our campaign engine. | `POST /v1/events` ingestion pipeline |
| Q-2 | **Automated Sentiment Analysis** | Turn open-ended text ("shipping was terrible") into actionable signals. Qualtrics' Text iQ is their crown jewel — we need a focused version. | Campaign `triggerCondition` evaluation |
| Q-3 | **Closed-Loop Action Engine** | Auto-trigger loyalty actions from CX signals: detractor → retention offer, promoter → referral invite, neutral → engagement campaign. This is Issue #6 on steroids. | `campaign-triggers` queue + campaigns |
| Q-4 | **CX-Loyalty Unified Dashboard** | Show CX metrics (NPS trend, CSAT, sentiment) alongside loyalty metrics (points issued, redemption rate, ROI) in ONE view. Qualtrics can't do this. | `GET /v1/analytics` extension |

**Why these four**: They complete the CX-to-Loyalty loop end-to-end. A customer fills out an NPS survey (Q-1), sentiment is analyzed (Q-2), a low score auto-triggers a loyalty campaign (Q-3), and the admin sees the full picture (Q-4). This is the workflow Qualtrics can't offer.

### Tier 2: Build Next (Deepens CX Moat) — Est. 12-16 weeks

| # | Feature | Why It's High-Value | Maps To Existing |
|---|---------|-------------------|-----------------|
| Q-5 | **Multi-Channel Survey Distribution** | Email, SMS, in-app widget, post-purchase. More channels = more CX data = more campaign triggers. Mid-market needs at least email + in-app. | Notifications queue (extend from stub) |
| Q-6 | **Key Driver Analysis (Simplified)** | "What matters most to your customers?" — automated correlation of CX attributes to loyalty outcomes. Replace Stats iQ with an actionable, mid-market-friendly version. | Analytics engine extension |
| Q-7 | **Churn Risk Scoring** | Predict which members will churn based on CX signals + loyalty behavior (declining engagement + low NPS = high risk). Qualtrics has Predict iQ but can't act on it. We can auto-trigger retention campaigns. | Member model + campaign triggers |
| Q-8 | **Survey Incentive Engine** | "Complete this survey, earn 100 points." Native integration between survey completion and loyalty points — what Annex Cloud's Qualtrics integration tries to do, but ours is built-in. | Earn Points pipeline |

### Tier 3: Build Later (Enterprise Expansion) — Est. 16-20 weeks

| # | Feature | Why It's High-Value | Maps To Existing |
|---|---------|-------------------|-----------------|
| Q-9 | **Journey Touchpoint Mapping** | Visualize the customer journey with CX scores at each touchpoint. Mid-market version of Qualtrics' journey optimization. | New module |
| Q-10 | **AI-Powered Response Suggestions** | When a detractor submits feedback, AI suggests the best loyalty action (points bonus vs. reward vs. personal outreach) based on member history. | Campaign engine + AI layer |
| Q-11 | **Benchmarking** | "Your NPS is 32. Industry average is 41." Comparative analytics that mid-market teams crave but can't get without expensive Qualtrics licenses. | Analytics extension |
| Q-12 | **Voice of Customer Hub** | Aggregate feedback from surveys, support tickets, social mentions, reviews into one feed. Each signal can trigger loyalty actions. | Event ingestion extension |

---

## Revenue Model: How This Captures 25% of Qualtrics Mid-Market

### Current Qualtrics Mid-Market Economics
- Median Qualtrics buyer pays **$28,533/year** (source: Vendr)
- Mid-market range: **$25,000 - $100,000/year** for CX alone
- No loyalty capabilities included — separate Annex Cloud contract ($15K-$50K/year)
- Total CX + Loyalty cost for mid-market: **$40K-$150K/year**

### CustomerEQ Unified Pricing (Proposed)

| Tier | Includes | Price |
|------|----------|-------|
| **Growth** | Loyalty engine + 2 survey types (NPS, CSAT) + basic sentiment + 3 campaign rules + dashboard | $25,000/yr |
| **Professional** | Everything in Growth + all survey types + full sentiment analysis + unlimited campaigns + churn scoring + CRM integrations | $45,000/yr |
| **Enterprise** | Everything in Pro + journey mapping + AI suggestions + benchmarking + VoC hub + multi-brand | $85,000/yr |

**Value proposition**: "Everything Qualtrics CX does for mid-market + a full loyalty engine, in one platform, at half the price, with 100x faster time-to-action."

### Path to 25% Market Capture

| Year | Target Customers | ACV | ARR |
|------|-----------------|-----|-----|
| Y1 | 50 | $35K | $1.75M |
| Y2 | 200 | $40K | $8M |
| Y3 | 600 | $45K | $27M |
| Y4 | 1,500 | $50K | $75M |
| Y5 | 3,200 | $50K | $160M |

$160M = ~25% of Qualtrics' estimated mid-market revenue (~$640M).

---

## Competitive Moat: Why Qualtrics Can't Respond

1. **Architectural lock-in**: Qualtrics is built as a measurement platform. Adding a loyalty engine requires building points ledgers, transaction integrity, real-time event processing, reward fulfillment — an entirely different technical stack. Their acquisition of Press Ganey Forsta ($6.75B) doubled down on measurement, not action.

2. **Pricing structure**: Qualtrics charges premium prices for analytics. Offering loyalty features would cannibalize their consulting/services revenue and require simpler UX that undermines their enterprise positioning.

3. **Integration dependency**: The Annex Cloud partnership is their loyalty answer. Building native loyalty would break that partnership and require years of development.

4. **Mid-market blind spot**: Qualtrics is moving upmarket (Silver Lake PE ownership demands margins). Mid-market is being deprioritized, creating a vacuum.

5. **Wall Street skepticism**: The rejected $5.3B debt package signals investor concern about AI disruption to Qualtrics' model. Our AI-native approach is exactly the disruption they fear.

---

## Implementation Priority & Architecture Impact

### What We Already Have (Annex Cloud Replication)
- Points earn/burn engine with earning rules
- Campaign automation with trigger conditions
- Member enrollment and profile management
- Reward catalog and redemption (transactional)
- CRM webhooks (Salesforce, HubSpot)
- Analytics dashboard (ROI, campaign performance)
- Event-driven pipeline (BullMQ, <15-min SLA)

### What We Need to Add (Qualtrics CX Layer)

```
NEW MODULES:
├── Survey Engine
│   ├── Survey builder (NPS, CSAT, CES templates)
│   ├── Distribution (email, in-app widget, link)
│   ├── Response collection → event pipeline
│   └── Survey incentive (complete = earn points)
│
├── Sentiment Analysis
│   ├── Text analysis (OpenAI/Claude API)
│   ├── Sentiment scoring (-1 to +1)
│   ├── Topic extraction
│   └── Feed results into campaign trigger conditions
│
├── CX Analytics
│   ├── NPS/CSAT/CES trend dashboards
│   ├── Key driver analysis (simplified)
│   ├── Churn risk scoring
│   └── Unified CX + loyalty reporting
│
└── Extended Campaign Triggers
    ├── Survey response triggers (NPS < 7, CSAT < 3)
    ├── Sentiment-based triggers (negative sentiment → retention)
    ├── Churn risk triggers (high risk → win-back)
    └── Multi-signal triggers (low NPS + declining engagement)
```

### Database Schema Additions (Estimated)

```prisma
model Survey {
  id            String   @id @default(cuid())
  brandId       String
  programId     String
  name          String
  type          SurveyType  // NPS, CSAT, CES, CUSTOM
  questions     Json        // Question definitions
  settings      Json        // Distribution settings, incentive config
  status        SurveyStatus // DRAFT, ACTIVE, PAUSED, CLOSED
  responsesCount Int       @default(0)
  incentivePoints Int?     // Points awarded for completion
  createdAt     DateTime  @default(now())

  brand         Brand     @relation(fields: [brandId], references: [id])
  program       Program   @relation(fields: [programId], references: [id])
  responses     SurveyResponse[]
}

model SurveyResponse {
  id            String   @id @default(cuid())
  surveyId      String
  memberId      String
  brandId       String
  answers       Json        // { questionId: answer }
  score         Float?      // NPS/CSAT/CES numeric score
  sentiment     Float?      // -1.0 to 1.0 (AI-analyzed)
  topics        String[]    // AI-extracted topics
  channel       String      // email, in_app, link, sms
  completedAt   DateTime
  createdAt     DateTime  @default(now())

  survey        Survey    @relation(fields: [surveyId], references: [id])
  member        Member    @relation(fields: [memberId], references: [id])
  @@unique([surveyId, memberId])  // One response per member per survey
  @@index([brandId, completedAt])
}

model ChurnRiskScore {
  id            String   @id @default(cuid())
  memberId      String
  brandId       String
  score         Float       // 0.0 (safe) to 1.0 (high risk)
  factors       Json        // { nps_trend: -15, engagement_decline: true, ... }
  calculatedAt  DateTime  @default(now())

  member        Member    @relation(fields: [memberId], references: [id])
  @@index([brandId, score])
}
```

### New Event Types

| Event Type | Source | Campaign Trigger Example |
|---|---|---|
| `cx.survey_completed` | Survey engine | Award incentive points |
| `cx.nps_response` | NPS survey | NPS <= 6 → detractor retention campaign |
| `cx.csat_response` | CSAT survey | CSAT <= 2 → escalation + bonus points |
| `cx.sentiment_negative` | Sentiment analysis | Auto-enqueue win-back campaign |
| `cx.churn_risk_high` | Churn scoring job | High risk → VIP retention offer |
| `cx.promoter_identified` | NPS survey | NPS >= 9 → referral invitation campaign |

These all flow through the existing `POST /v1/events` → BullMQ → campaign trigger pipeline. **No architectural changes needed** — just new event types and trigger conditions.

---

## Build Sequence (Proposed)

### Phase A: Survey Engine + Sentiment (Weeks 1-8)
*Gives us native CX data collection — no more dependency on CRM webhooks as the only CX signal source*

1. **Survey builder** — NPS, CSAT, CES templates with customizable questions
2. **Survey distribution** — Email + shareable link (in-app widget in Phase B)
3. **Response collection** — Responses flow into event pipeline as `cx.nps_response`, `cx.csat_response`
4. **Sentiment analysis** — OpenAI/Claude API integration for open-ended response analysis
5. **Survey incentives** — "Complete this survey, earn 100 points" (native, not bolted on)

### Phase B: Closed-Loop Action Engine (Weeks 6-12)
*The killer feature: automatic CX-to-loyalty action that Qualtrics can't match*

1. **Extended campaign triggers** — Survey score-based triggers (NPS < 7, CSAT < 3)
2. **Sentiment-based triggers** — Negative sentiment auto-triggers retention campaigns
3. **Promoter identification** — NPS >= 9 auto-triggers referral/advocacy campaigns
4. **Multi-signal triggers** — Combine CX score + loyalty data (e.g., "NPS < 7 AND member > 6 months AND pointsBalance > 1000 → VIP retention offer")

### Phase C: CX Analytics + Churn Scoring (Weeks 10-16)
*Proves ROI and replaces Qualtrics' dashboard value*

1. **CX dashboards** — NPS/CSAT/CES trends, response rates, distribution by score
2. **Unified CX + Loyalty view** — Single dashboard showing CX metrics alongside loyalty KPIs
3. **Key driver analysis** — "What factors correlate most with high/low NPS?"
4. **Churn risk scoring** — Periodic job that scores members based on CX + loyalty signals
5. **Churn-triggered campaigns** — High-risk members auto-enrolled in retention campaigns

### Phase D: Multi-Channel + Advanced (Weeks 14-20)
*Deepens the moat and justifies Professional/Enterprise pricing tiers*

1. **In-app survey widget** — Embeddable JavaScript widget for post-interaction surveys
2. **SMS distribution** — Survey via text message
3. **AI response suggestions** — "For this detractor, we recommend: 500 bonus points + personal email from CSM"
4. **Journey touchpoint mapping** — Visualize CX scores across the customer lifecycle
5. **Benchmarking** — Industry comparison data

---

## Success Metrics

| Metric | Target | Why |
|---|---|---|
| Survey response rate | > 25% | Industry avg is 15-25%; higher proves value of integrated incentives |
| Feedback-to-action time | < 15 minutes | 100x faster than Qualtrics' 5-day SLA |
| % of feedback acted on | > 80% | vs. Qualtrics' 1-2% (their own admission) |
| NPS improvement for customers | +10 points in 90 days | Proves the CX-loyalty loop works |
| Customer acquisition cost | < $5K | Self-serve + PLG motion for mid-market |
| Net revenue retention | > 120% | Expansion from Growth → Professional → Enterprise |
| Time to first survey sent | < 1 hour | vs. Qualtrics' weeks-long deployment |

---

## Risks

| Risk | Probability | Mitigation |
|---|---|---|
| Survey engine UX can't compete with Qualtrics' 15 years of survey R&D | 60% | Don't try. Build 3 excellent templates (NPS, CSAT, CES) not 300 question types. Mid-market needs simple, not comprehensive. |
| Sentiment analysis accuracy lags Text iQ | 40% | Use frontier LLMs (Claude/GPT-4o) which match or exceed Text iQ for sentiment. Our advantage: results feed directly into loyalty actions. |
| Qualtrics builds/acquires loyalty capabilities | 30% | Their Press Ganey Forsta deal ($6.75B) signals they're doubling down on measurement, not action. Acquisition integration takes 2-3 years minimum. |
| Feature parity trap v2 | 70% | Same risk as Annex Cloud. Resist building advanced survey logic, complex branching, multi-language support until revenue justifies it. |
| Mid-market customers want Qualtrics' brand credibility | 50% | Lead with ROI proof: "Your feedback-to-action time went from 5 days to 15 minutes." Results > brand. |

---

## Conclusion

The highest-value Qualtrics features to build are not their analytical depth (Text iQ, Stats iQ) — it's their **CX data collection capabilities** (surveys, sentiment) **integrated with our existing loyalty action engine**. This combination creates a product category that doesn't exist today:

> **"The platform that doesn't just measure customer experience — it automatically acts on it."**

Qualtrics measures. We act. That's the pitch.

---

*References: Qualtrics public materials, G2 reviews, Gartner Magic Quadrant (March 2026), Vendr pricing data, Trustpilot reviews, industry analyst reports. See research notes for full citation list.*
