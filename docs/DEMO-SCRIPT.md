# CustomerEQ Demo Script

**Duration:** 15-20 minutes
**Last Updated:** 2026-03-29

---

## Login

**URL:** https://customereq.wellnessatwork.me
**Sign in:** Click "Sign In" → use your Clerk credentials (the account tied to the `CustomerEQ Demo` org)

---

## Demo Data Summary

| Survey | Type | Responses | Pattern |
|--------|------|-----------|---------|
| Post-Purchase Experience | NPS | 110 | Shipping anomaly spike in last 20 responses |
| Customer Support Satisfaction | CSAT | 110 | Sentiment declining over time |
| Website Usability | CES | 110 | Sudden improvement after "redesign" at response 75 |
| Product Quality Feedback | CUSTOM | 110 | Bimodal — people love it or hate it |
| Onboarding Experience | NPS | 110 | Steadily improving scores |
| **Total** | | **563** | 150 demo members enrolled |

**Program:** Diamond Loyalty Club (ACTIVE, "Diamonds" currency)
**Theme:** Diamond Brand Theme (blue/gold, Inter font)
**Alert Rule:** NPS Detractor Alert (score 0-6, 4h SLA)
**Campaign:** Detractor Recovery — 200 bonus Diamonds for NPS ≤ 6

---

## Opening (30 seconds)

> "CustomerEQ is an AI-native CX-to-loyalty platform. Unlike Qualtrics or SurveyMonkey which just collect feedback, CustomerEQ automatically turns every customer signal into the right loyalty action. Let me show you the full journey — from survey creation to closed-loop follow-up."

---

## Act 1: Survey Creation & Theming (3 min)

### The Survey Builder

1. Navigate to **https://customereq.wellnessatwork.me/admin/survey-builder**
2. Walk through the 3-panel layout:
   - **Left panel:** "We support 11 question types — rating, text, multiple choice, matrix, ranking, slider, Likert, and more."
   - Click **Rating** → a question appears on the canvas
   - Click **Multiple Choice** → add another
   - **Right panel:** Click a question → show config: skip logic rules, type-specific settings

> "Every survey supports conditional branching — detractors get follow-up questions, promoters don't."

### Branded Theming

3. Navigate to **https://customereq.wellnessatwork.me/admin/settings/themes**
4. Click **Diamond Brand Theme**:
   - Show color pickers, font selector, layout options
   - Point out the **live preview** updating in real time
   - Show the custom thank-you message

> "Every survey matches your brand identity. The live preview shows exactly what customers will see."

---

## Act 2: The Customer Experience (2 min)

### Live Survey Submission

5. Open the public survey link (share on screen or open in a new tab):
   **https://customereq.wellnessatwork.me/survey/cmnbazt3900cj6oe0amcjddda**

6. Walk through:
   - "Notice the Diamond branding — blue/gold theme, Inter font, brand name"
   - "Earn 50 points for completing this survey!" banner
   - NPS rating buttons 0-10, text feedback, multiple choice
   - Enter an email of an enrolled member (e.g. `emma.smith.0@demo.customereq.com`)
   - Give score of 3, type "Shipping was terrible, waited 3 weeks"
   - Submit → **"Thank You! You earned 50 points!"**

> "The customer just earned loyalty Diamonds for giving feedback. That's the first connection between CX and loyalty."

### Other Survey Types

7. Briefly show the other public survey links:
   - **CSAT:** https://customereq.wellnessatwork.me/survey/cmnbb0hky00lt6oe0mzw4253p
   - **CES:** https://customereq.wellnessatwork.me/survey/cmnbb15ry00v36oe0qp4awa05

> "We support NPS, CSAT, CES, and fully custom survey types."

---

## Act 3: Analytics & AI Insights (4 min)

### Survey Dashboard

8. Navigate to **https://customereq.wellnessatwork.me/admin/surveys**
9. Show the table: 5 active surveys with 110 responses each
10. Click **"Post-Purchase Experience (NPS)"**:
    - Response count: 110
    - NPS score calculation
    - Response table with individual scores

> "Real-time analytics as responses come in. 563 responses across 5 surveys."

### CX Analytics

11. Navigate to **https://customereq.wellnessatwork.me/admin/analytics/cx**
12. Highlight:
    - **NPS score** across all surveys
    - **CSAT average**
    - **Sentiment distribution** — positive / neutral / negative
    - **Top topics** extracted by AI

> "Every response is automatically analyzed — sentiment scored, topics extracted, and clustered into themes. No manual tagging."

### Key Talking Points by Survey

| Survey | What to Highlight |
|--------|-------------------|
| Post-Purchase NPS | "Notice the shipping complaints spike in recent responses — that's an anomaly the system detected" |
| Support CSAT | "Sentiment is declining over time — support quality needs attention" |
| Website CES | "Scores suddenly improved after response 75 — that's when the redesign launched" |
| Product Quality | "Bimodal distribution — customers either love or hate the product. Quality consistency issue." |
| Onboarding NPS | "Steadily improving — the onboarding team is getting better over time" |

---

## Act 4: Closed-Loop Alerting (3 min)

### Alert Rules

13. Navigate to **https://customereq.wellnessatwork.me/admin/alerts/rules**
14. Show the **"NPS Detractor Alert"** rule:
    - Triggers on NPS score 0-6
    - Sends email to cx-team@customereq.demo
    - Default assignee: Sarah K. (CX Lead)
    - Topic-based routing: shipping → Ops Team, support → Support Manager
    - 4-hour SLA target

> "When a detractor submits feedback, something actually happens. An alert fires, a case is created, and someone is accountable."

### Case Management

15. Navigate to **https://customereq.wellnessatwork.me/admin/alerts/cases**
16. Walk through:
    - Stats cards: Open, Contacted, Resolved, SLA compliance
    - Case table with status badges, assignees, SLA indicators
    - Click a case → timeline, respondent info, action buttons

> "Every detractor becomes a tracked case. Mark Contacted, add notes, Mark Resolved. SLA enforcement ensures no one falls through the cracks."

---

## Act 5: The Loyalty Loop (2 min)

### Campaign Engine

17. Navigate to **https://customereq.wellnessatwork.me/admin/campaigns**
18. Show **"Detractor Recovery — 2x Points"**:
    - Trigger: NPS ≤ 6
    - Action: Award 200 bonus Diamonds
    - Budget: $10,000 cap with tracking

> "Here's the magic. When a detractor responds, they don't just trigger an alert — they automatically receive 200 bonus loyalty Diamonds. The feedback-to-loyalty loop closes itself."

### Program Overview

19. Navigate to **https://customereq.wellnessatwork.me/admin/programs**
20. Show **Diamond Loyalty Club**:
    - "Diamonds" currency
    - Earning rules
    - Active status

> "Points, earning rules, campaigns — all natively connected to the CX data."

---

## Act 6: The AI-Agent Angle (1 min)

> "One more thing. CustomerEQ has a native MCP server — meaning AI agents can manage your entire CX program programmatically."

21. Demonstrate by saying:
    - "I can ask my AI: 'What's our NPS this month?' and it queries the API directly"
    - "Or: 'Create a follow-up survey for detractors' — and it does"
    - Show the MCP tools: `create_survey`, `get_cx_analytics`, `enroll_member`, `ingest_event`

> "No other CX platform is AI-agent-native. Your AI assistant is a first-class operator."

---

## Closing (30 seconds)

> "What you just saw:
> 1. **Create** — Visual survey builder with 11 question types, skip logic, branded theming
> 2. **Collect** — 563 responses across 5 survey types, customers earn loyalty points
> 3. **Analyze** — AI scores sentiment, extracts topics, clusters feedback, detects anomalies
> 4. **Act** — Detractors trigger real-time alerts, cases tracked to resolution with SLA
> 5. **Retain** — Loyalty campaigns automatically award recovery points
>
> Five steps, one platform, zero duct tape. That's CustomerEQ."

---

## Quick Reference

### URLs

| Page | URL |
|------|-----|
| Homepage | https://customereq.wellnessatwork.me |
| Admin Dashboard | https://customereq.wellnessatwork.me/admin/surveys |
| Survey Builder | https://customereq.wellnessatwork.me/admin/survey-builder |
| Themes | https://customereq.wellnessatwork.me/admin/settings/themes |
| CX Analytics | https://customereq.wellnessatwork.me/admin/analytics/cx |
| Alert Rules | https://customereq.wellnessatwork.me/admin/alerts/rules |
| Case Management | https://customereq.wellnessatwork.me/admin/alerts/cases |
| Campaigns | https://customereq.wellnessatwork.me/admin/campaigns |
| Programs | https://customereq.wellnessatwork.me/admin/programs |
| Public NPS | https://customereq.wellnessatwork.me/survey/cmnbazt3900cj6oe0amcjddda |
| Public CSAT | https://customereq.wellnessatwork.me/survey/cmnbb0hky00lt6oe0mzw4253p |
| Public CES | https://customereq.wellnessatwork.me/survey/cmnbb15ry00v36oe0qp4awa05 |

### Demo Members (for live survey submission)

Any of these emails work (150 total, pattern: `firstname.lastname.N@demo.customereq.com`):
- `emma.smith.0@demo.customereq.com`
- `liam.johnson.1@demo.customereq.com`
- `olivia.williams.2@demo.customereq.com`
- `noah.brown.3@demo.customereq.com`

### Reseed Data

```bash
node scripts/seed-demo-rich.mjs    # 5 surveys × 110 responses
node scripts/seed-demo-prod.mjs    # Basic setup (program, theme, alerts, campaign)
```

### Competitive Differentiators to Emphasize

| vs Qualtrics | vs SurveyMonkey | vs Medallia |
|-------------|-----------------|-------------|
| CX-to-loyalty loop (they can't) | Skip logic + theming (they limit) | 10x cheaper, same closed-loop |
| AI-native (not a bolt-on) | AI sentiment built-in (they charge extra) | Weeks to deploy (not months) |
| MCP-agent compatible (they don't have) | Alert + case management (they don't have) | Mid-market price (not enterprise-only) |
