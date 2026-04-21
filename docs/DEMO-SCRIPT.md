# CustomerEQ Demo Script — Full Onboarding + Customer Journey

**Duration:** 20–25 minutes
**Last Updated:** 2026-04-12
**Format:** Two browser windows, side by side. **Acme Coffee storefront** (the prospect's product) on the left, **CustomerEQ admin** on the right. Every customer action on the storefront is followed by switching to admin to show the data land in real time.

> **The frame:** Acme Coffee is a fictional online coffee store. They just signed up for CustomerEQ to run their loyalty program, surveys, support, and CX analytics. Everything you're about to see would apply to any company integrating CustomerEQ — Acme is the shortest possible stand-in for "your customer."

---

## Setup (before the prospect joins)

### 1. Start the stack

```bash
# Terminal 1 — the API (single instance, handles both admin Clerk auth and Acme's API key)
QUEUE_MODE=inline \
  MCP_API_KEY=acme-demo-key-change-me \
  MCP_BRAND_ID=acme-coffee-brand \
  API_PORT=4000 \
  API_BASE_URL=http://localhost:4000 \
  ADMIN_UI_BASE_URL=http://localhost:3000 \
  DATABASE_URL="postgresql://customereq:customereq@localhost:5432/customereq" \
  pnpm --filter @customerEQ/api dev

# Terminal 2 — the CustomerEQ admin web UI
pnpm --filter @customerEQ/web dev

# Terminal 3 — the Acme Coffee storefront (seeded separately)
cd examples/acme-coffee-demo
node seed-acme.mjs    # first time only — creates the Acme brand + program + surveys
npm install && npm start
```

Open:
- **Acme Coffee storefront**: <http://localhost:5050>
- **CustomerEQ admin**: <http://localhost:3000/admin/developer>

Pin the two windows side by side. Acme left, admin right. Clear the Acme browser's localStorage so you start as a fresh visitor.

### 2. Make sure you're in the Acme Coffee org

The admin portal is multi-tenant via Clerk. Click the **organization switcher** at the top of the admin sidebar and select **Acme Coffee**. Everything below is now scoped to Acme's data.

---

## Opening (45 seconds)

> "Most CX platforms — Qualtrics, Medallia, SurveyMonkey — are silos. They collect feedback, give you a dashboard, and stop. They don't talk to your loyalty system, your support tool, or your product. So when an unhappy customer fills out a survey, *nothing happens* — somebody on your team has to read the dashboard, find the customer, and decide what to do.
>
> CustomerEQ is built differently. It's one platform where Acme's team creates surveys, loyalty campaigns, alert rules, support workflows — and drops a few snippets into their own site to have every customer signal flow back into CustomerEQ automatically. The integration takes hours, not months.
>
> I'll show you both sides: **Acme's admin** setting up the integration in CustomerEQ, then **Acme's customer** experiencing the result on Acme's own site."

---

## Act 1: Acme's admin onboards on CustomerEQ (4 min)

**Start on the admin tab.** You should already be signed in as Acme Coffee's admin.

### The Developer page

1. Click **Developer** in the sidebar under **Settings**.
2. Walk through the sections top to bottom:

**Your Organization**
- Brand name: Acme Coffee
- Brand ID: `acme-coffee-brand`
- API base URL: the backend that Acme's server will POST events to

> "This page is where Acme's engineering team grabs everything they need to wire CustomerEQ into their product. API key, embed snippets, webhook URLs, ready-to-paste curl commands. They get this in minutes, not a multi-week integration project."

**API Keys**
3. Click **Generate New Key**. Name it "Production backend". Click **Create**.
4. A modal pops up: **"This is the only time you'll see this key."** Copy it.

> "Notice how the plaintext is only shown once. It's stored as a SHA-256 hash in the database — if you lose it, you revoke it and make a new one. This is how every serious SaaS does API keys."

5. Close the modal. The list shows the key with its prefix, creation date, and a Revoke button.

**Survey Embeds**
6. Scroll down to **Survey Embeds**. Each active survey has a copy-able `<script>` tag.

> "When Acme's admin creates a survey in the builder and launches it, it shows up here automatically with a ready-to-paste embed snippet. One `<script>` tag and your site has a themed CustomerEQ survey. No iframe, no React component, no SDK install."

7. Click **Copy Snippet** on the Post-Purchase NPS survey.

**External Signal Webhooks**
8. Scroll down further to show the Google Business Profile webhook URL with an **HMAC signed** badge.

> "Acme's ops team points their Google reviews feed at this URL. CustomerEQ verifies the HMAC signature, normalizes the review, runs sentiment analysis, and threads it into the Customer 360. Same for Reddit, X, Zendesk — any source that can POST a webhook."

**Quick-Start Snippets**
9. Scroll to the bottom. Show the curl command for `POST /v1/events`.

> "That's the one HTTP call Acme's backend makes for every purchase, every campaign trigger, every loyalty moment. Everything else — points calculation, campaign evaluation, tier upgrades, alert routing — happens automatically on CustomerEQ's side."

---

## Act 2: Acme's customer signs up and shops (3 min)

**Switch to the Acme Coffee tab.** You should see the hero with "Hand-roasted coffee, delivered to your door."

1. Click **Join Acme Rewards — It's Free**.
2. Sign up as `maya.patel@gmail.com`, "Maya", "Patel". Click **Create Account**.
3. A toast appears: "Welcome, Maya! You're now earning Beans." Header now shows **0 Beans** + "Maya".

> "Behind the scenes, Acme's server called `POST /v1/members/enroll` on CustomerEQ. One HTTP call. Member record created, GDPR consent tracked, enrollment bonus queued."

4. Add **2× Single Origin** + **1× Cold Brew Kit** to the cart. A black bar pops up at the bottom: "3 items — $80.97 · Place Order".
5. Click **Place Order**.

The page flips to a thank-you panel:
- **✓ Thanks for your order!** with order ID + subtotal
- **+50 Beans earned on this order!**
- **Quick — how are we doing?** — an NPS widget appears inline

> "Acme's backend fired `POST /v1/events` with `eventType: purchase`. CustomerEQ's earning rule awarded 50 Beans. The post-checkout page then drops the NPS embed snippet — the one we copied from the admin Developer page a minute ago — right into the thank-you page. Zero extra work for Acme's engineers."

---

## Act 3: The detractor survey + closed-loop alerting (4 min)

This is the hero moment. Take your time.

1. On Acme's thank-you page, click NPS **3** (a detractor).
2. Type: "Shipping took 2 weeks and the coffee was stale when it arrived. Really disappointing for the price."
3. Enter email: `maya.patel@gmail.com`. Click **Submit Feedback**.
4. Widget shows "Thank you! You earned 50 points!"

**Switch to the admin tab.** Navigate: **Customers** → search "maya" → click Maya Patel.

Point at:
- **Points balance** — updated (100 Beans: 50 purchase + 50 survey)
- **Open Cases (1)** — **CRITICAL**, 4-hour SLA, assigned to the CX lead

> "Look what just happened. Maya submitted an NPS 3, and CustomerEQ:
>
> 1. Stored the response with AI-scored sentiment (−0.32 negative)
> 2. Extracted topics: *shipping delays*, *pricing*, *website experience*
> 3. Matched the alert rule for NPS ≤ 6
> 4. Auto-created a case with 4-hour SLA
> 5. Routed it to Sarah K., Acme's CX lead, based on topic filters
> 6. Awarded 50 bonus Beans via the incentive program
>
> All in under 2 seconds. Nobody on Acme's team wrote a single line of alerting, routing, or reconciliation code. They just created an alert rule once in the admin."

**Click Alerts in the sidebar → Cases.** Show the case detail, SLA countdown, and assignee.

**Click CX Insights in the sidebar** → point at the dashboard:
- NPS drops
- Sentiment distribution
- Top topics include "shipping delays"
- Anomaly alerts if any cluster tripped a threshold

> "The CX team has the full picture — aggregated analytics, per-survey breakdown, anomaly detection — without wiring up a single BI pipeline."

---

## Act 4: Support chat with AI triage (3 min)

**Switch back to the Acme storefront.** Scroll to find the chat launcher at the bottom-right.

1. Click **Open support chat**.
2. Type: "My coffee was stale and the bag was torn. I need a refund."
3. Click **Send**.

Maya's message appears in the panel. A second later, the **AI reply** appears: "I'm sorry to hear about your experience. Your feedback is important to us, and I'm connecting you with a specialist who can help."

> "The support widget is a single Web Component — `<ceq-support-chat>` — that Acme dropped into their site. The customer types, CustomerEQ classifies intent with GPT-4o, matches any support rules Acme's team has configured, generates a branded response, and if needed escalates to a human with full context. Every message feeds back into the Customer 360."

**Switch to admin** → **Conversations** in the sidebar. Jane's conversation is at the top:
- Status: **ACTIVE**
- Intent: **billing** (auto-classified)
- Topic: **order**
- Message count: 2

Click into the conversation. Walk through the timeline: customer message, AI response, metadata.

> "Your agents see every customer message in context — the member's loyalty status, recent purchases, open cases, past surveys. Not just 'Jane wants a refund' — 'Jane is a 100-point member who just submitted NPS 3 about shipping and now wants a refund on her Cold Brew Kit.' That context is the difference between a one-off ticket and actually saving the customer."

---

## Act 5: Loyalty campaigns + the Customer 360 (2 min)

**Back in admin**, click **Campaigns** in the sidebar.

Show any configured campaign (e.g., "Detractor Recovery — 200 Beans").

> "This is how Acme closes the loop. The detractor submission we just saw? There's a campaign configured to automatically award 200 recovery Beans whenever NPS ≤ 6. Your unhappy customer complained — and 2 seconds later they're richer. Most of them stick around *because* they complained."

Click **Programs** → Acme Rewards. Show:
- Currency: Beans
- Earning rules: 50 pts per purchase
- Active campaigns

> "All loyalty state — points, tiers, rewards, campaign history, budgets — is natively connected to the CX signals we just walked through. Not bolted on. One data model."

**Switch back to Maya's Customer 360** (Customers → Maya). Point at the Recent Activity timeline:
- Purchase (+50 Beans)
- Survey completion (+50 Beans)
- Case (NPS Detractor Alert)
- Conversation (billing intent)

All from two actions on Acme's storefront.

---

## Act 6: Reviews + External Signals (1.5 min)

**Switch to Acme Coffee storefront.** (This section requires the review webhook demonstration UI — if removed, skip.)

Alternatively, demonstrate the webhook on the **admin Developer page**: point at the Google Business Profile webhook URL.

> "Acme's ops team configured a webhook on their Google Business Profile. Every new review Google publishes is POSTed to that URL. CustomerEQ scores sentiment, extracts topics, matches it to a member if the email is a known customer, and feeds it into CX Insights. Reddit mentions, X posts, Zendesk tickets — any source with a webhook works the same way."

**Switch to admin → CX Insights.** Point at the **External Signals** section showing reviews counted alongside survey responses.

> "You get one CX picture across every channel. Not a dashboard per source."

---

## Act 7: AI-Agent Native (1 min)

> "One more thing. Every endpoint we just showed is also exposed as a native MCP tool. So if Acme's CX team uses Claude or any AI assistant, they can ask:
>
> - *'What's our NPS this month?'*
> - *'Show me detractors who haven't been contacted yet.'*
> - *'Create a follow-up survey for low-score responses.'*
>
> And the agent does it. No other CX platform is AI-agent-native."

---

## Closing (60 seconds)

> "What you just saw, end to end:
>
> 1. **Acme's admin** logged in, generated an API key, and copied a few snippets
> 2. **Acme's customer** signed up, bought coffee, earned Beans — one HTTP call from Acme's server
> 3. **Submitted an NPS detractor** via an embedded widget — one `<script>` tag on Acme's site
> 4. **Triggered an alert cascade** — case created, routed, SLA started, recovery campaign fired — all automatic
> 5. **Opened a support chat** — AI classified, responded, logged with full context
> 6. **Appeared in analytics** — sentiment scored, topics extracted, cross-channel view
>
> All the integration code Acme wrote fits in about 200 lines of backend plus one `<script>` tag per survey. You can read it under `examples/acme-coffee-demo/` in the repo.
>
> Compare that to standing up Qualtrics + Salesforce Loyalty + a custom alert layer + a separate BI pipeline. That's 6 months and $500k for something Acme just had up and running in under a day. **One platform. One API. No glue code.**"

---

## Quick Reference

### URLs

| What | Where |
|---|---|
| Acme Coffee storefront (the customer-facing product) | <http://localhost:5050> |
| CustomerEQ admin — Developer page | <http://localhost:3000/admin/developer> |
| Customers | <http://localhost:3000/admin/members> |
| CX Insights | <http://localhost:3000/admin/analytics/cx> |
| Cases | <http://localhost:3000/admin/alerts/cases> |
| Conversations | <http://localhost:3000/admin/support/conversations> |
| Programs | <http://localhost:3000/admin/programs> |
| Campaigns | <http://localhost:3000/admin/campaigns> |

### Fresh-demo reset

```bash
# Reset Maya (or whoever you demoed as) + re-seed the brand
PGPASSWORD=customereq psql -U customereq -h localhost -d customereq \
  -c "DELETE FROM members WHERE email IN ('maya.patel@gmail.com', 'jane.walker@gmail.com');"
# In the Acme storefront browser, click Reset Session or clear localStorage
```

### Competitive talking points

| Theme | Sound bite |
|---|---|
| Integration speed | "~200 lines of code, one week of work — vs 6 months for Qualtrics + Salesforce + custom" |
| Single source of truth | "Acme stores nothing about customer state. Customer 360 is one HTTP call." |
| Closed loop | "A complaining customer gets 200 recovery Beans in 2 seconds. Nobody else has that loop." |
| AI-native | "Every endpoint is also an MCP tool. Your AI assistant is a first-class operator — not a chatbot." |
| Mid-market price | "Same closed-loop as Medallia, 10x cheaper, weeks not months." |
| Self-serve onboarding | "The Developer page in the admin gives engineers everything they need in one screen. No sales call required." |

### Competitive contrasts

| vs Qualtrics | vs SurveyMonkey | vs Medallia |
|---|---|---|
| CX-to-loyalty loop (they can't) | Skip logic + theming (they limit) | 10× cheaper, same closed-loop |
| AI-native (not a bolt-on) | AI sentiment built-in (they charge extra) | Weeks to deploy, not months |
| MCP-agent compatible | Alert + case management included | Mid-market price, not enterprise-only |
| Self-serve integration | Self-serve integration | Self-serve integration |
