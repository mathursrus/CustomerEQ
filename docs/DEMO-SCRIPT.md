# CustomerEQ Demo Script

**Duration:** 12-15 minutes
**Prerequisites:** Dev servers running (`pnpm dev`), demo data seeded (`node scripts/seed-demo.mjs`)

---

## Opening (30 seconds)

> "CustomerEQ is an AI-native CX-to-loyalty platform. Unlike pure survey tools like Qualtrics or SurveyMonkey, CustomerEQ doesn't just collect feedback — it automatically turns insights into loyalty actions. Let me show you the full journey."

---

## Act 1: Survey Creation (2 min)

### Show the Survey Builder

1. Navigate to **http://localhost:3003/admin/survey-builder**
2. Walk through the 3-panel layout:
   - **Left:** "We support 11 question types — from basic rating and text to matrix, ranking, slider, Likert scale, even image choice and file upload."
   - **Center:** Click **Rating** to add a question. Click **Text** to add another. Show the question cards with drag handles and type badges.
   - **Right:** Click a question to show the config panel. Show skip logic: "+ Add Rule" → "Show this question IF Q1 is less than 7" → "This means detractors get a follow-up question, promoters don't."

> "Every survey can have conditional logic — no more one-size-fits-all surveys."

### Show Theming

3. Navigate to **http://localhost:3003/admin/settings/themes**
4. Click on "Diamond Brand Theme" (or create new):
   - Show the live preview updating as you change colors
   - Point out: logo, brand name, custom fonts, thank-you message with `{{points}}` piping

> "Every survey matches your brand. The live preview shows exactly what customers will see."

---

## Act 2: The Customer Experience (2 min)

### Show the Public Survey

5. Open **http://localhost:3003/survey/{NPS_SURVEY_ID}** (use the ID from seed output)
6. Walk through:
   - "Notice the Diamond branding — logo, colors, fonts all from the theme"
   - Answer the NPS question (give it a 3 — to trigger the detractor flow)
   - Answer the follow-up text question: "Shipping was really slow, took 3 weeks"
   - Answer the multiple choice: select "Shipping Speed"
   - Submit → show the branded thank-you page: "You earned 50 Diamonds!"

> "The customer just earned loyalty points for completing the survey. That's the first connection between feedback and loyalty."

### Show the Widget Embed

7. Go back to the admin: **Surveys** → click on "Post-Purchase NPS Survey"
8. Show the Share Link and Embed Widget sections

> "Embed this with one line of JavaScript on your website, or share the link via email."

---

## Act 3: Analytics & AI Insights (3 min)

### Survey Analytics

9. Navigate to **http://localhost:3003/admin/surveys/{NPS_SURVEY_ID}**
10. Show:
    - Response count (8 responses)
    - Average score
    - NPS score calculation (promoters minus detractors)
    - Response table with scores

> "Real-time analytics as responses come in."

### CX Analytics Dashboard

11. Navigate to **http://localhost:3003/admin/analytics/cx**
12. Show:
    - NPS score, CSAT average, CES average
    - Sentiment distribution (positive/neutral/negative)
    - Top topics extracted by AI
    - Feedback clusters — "The AI automatically groups feedback into themes like 'Shipping Delays' and 'Customer Support Issues'"

> "Every response is automatically analyzed by AI — sentiment scored, topics extracted, and clustered into themes. No manual tagging needed."

### Anomaly Detection

13. Point to the anomalies section (if any exist):

> "The system continuously monitors for anomalies — volume spikes, sentiment drops, new emerging themes. If shipping complaints suddenly triple, you'll know immediately."

---

## Act 4: Closed-Loop Alerting (3 min)

### Show Alert Rules

14. Navigate to **http://localhost:3003/admin/alerts/rules**
15. Show the "NPS Detractor Alert" rule:
    - "When any NPS response scores 0-6..."
    - "Alert goes to cx-team@customereq.demo via email"
    - "Cases assigned to Sarah K. (CX Lead) by default, or to Ops Team for shipping topics"
    - "4-hour SLA — if not contacted within 4 hours, it's flagged as overdue"

> "This is where CustomerEQ is fundamentally different from Qualtrics. When a detractor submits feedback, something actually happens."

### Show Case Management

16. Navigate to **http://localhost:3003/admin/alerts/cases**
17. Walk through:
    - Stats cards: Open cases, Contacted, Resolved, SLA compliance
    - Case table: click on a case
    - Case detail: respondent info, score badge, feedback text, sentiment, topics
    - Timeline: "Case opened → Slack alert sent → Assigned to Sarah K."
    - Action buttons: "Mark Contacted", "Mark Resolved", "Add Note"

> "Every detractor becomes a case. No one falls through the cracks. You can track from alert to resolution with SLA enforcement."

---

## Act 5: The Loyalty Loop (2 min)

### Show the Campaign

18. Navigate to **http://localhost:3003/admin/campaigns**
19. Show "Detractor Recovery — 2x Points" campaign:
    - Trigger: NPS ≤ 6
    - Action: Award 200 bonus Diamonds
    - Budget tracking

> "Here's the magic. When a detractor responds, they don't just trigger an alert — they also automatically receive 200 bonus loyalty points. The feedback-to-loyalty loop closes itself."

### Show Member Points

20. Navigate to **http://localhost:3003/admin/analytics**
21. Show:
    - Total members enrolled
    - Points issued / redeemed
    - "Notice — Emma Wilson gave an NPS of 3 about shipping. She triggered the detractor alert AND received 200 recovery points. The CX team follows up, she feels heard, and the loyalty points give her a reason to come back."

---

## Act 6: The AI-Agent Angle (1 min)

> "One more thing. CustomerEQ is the first CX platform with a native MCP server. That means AI agents can create surveys, analyze feedback, and manage loyalty programs programmatically."

22. Show the MCP tools list (from earlier in this conversation):
    - `create_survey`, `get_cx_analytics`, `enroll_member`, `ingest_event`...

> "Your AI assistant can ask: 'What's our NPS this month?' or 'Create a follow-up survey for detractors' — and it just works."

---

## Closing (30 seconds)

> "To summarize what you just saw:
> 1. **Create** — Visual survey builder with 11 question types, skip logic, and branded theming
> 2. **Collect** — Customers complete surveys and earn loyalty points
> 3. **Analyze** — AI automatically scores sentiment, extracts topics, and clusters feedback
> 4. **Act** — Detractors trigger real-time alerts, cases are tracked to resolution
> 5. **Retain** — Loyalty campaigns award recovery points, closing the loop
>
> No other platform connects all five steps. That's CustomerEQ."

---

## Demo Data Reference

| Asset | Value |
|-------|-------|
| NPS Survey ID | `cmn9jqepr000ctieexypio6be` |
| CSAT Survey ID | `cmn9jqepw000ftiee7910u3sd` |
| Program | Diamond Loyalty Club |
| Theme | Diamond Brand Theme |
| Members | 8 (sarah.johnson, mike.chen, emma.wilson, james.rodriguez, lisa.park, david.kim, anna.martinez, tom.brown @example.com) |
| NPS Responses | 8 (scores: 9, 10, 3, 2, 8, 1, 7, 6) |
| CSAT Responses | 4 (scores: 1, 2, 5, 4) |
| Alert Rule | NPS Detractor Alert (score 0-6, 4h SLA) |
| Campaign | Detractor Recovery — 2x Points (200 Diamonds for NPS ≤ 6) |

### Key Demo Moments

| Moment | What Happens | Differentiator |
|--------|-------------|----------------|
| Customer submits NPS 3 | Response stored, sentiment analyzed, topics extracted | AI-native (competitors need separate tools) |
| Score ≤ 6 detected | Alert rule fires, case created, Slack/email notification | Automatic closed-loop (competitors need manual setup) |
| Case assigned | Routed to right team based on topic | Smart assignment rules |
| Campaign triggers | 200 bonus Diamonds awarded automatically | CX-to-loyalty loop (no competitor does this) |
| Survey completion | 50 incentive Diamonds earned | Built-in loyalty integration |
