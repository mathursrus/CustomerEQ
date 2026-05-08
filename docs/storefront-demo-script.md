# StarBrew Coffee — Demo Script

**Duration:** 18–22 minutes  
**Last Updated:** 2026-05-07  
**Format:** Two browser tabs side by side. **StarBrew storefront** (left), **CustomerEQ admin** (right). Every customer action on the storefront is immediately followed by switching to admin to show the data land in real time.

> **The frame:** StarBrew Coffee is a fictional coffee-shop chain. They integrated CustomerEQ in a day — one API key, a few HTTP calls, and the survey embed. Everything you're about to see is live against a real database.

---

## Setup (before the audience joins)

| What | URL |
|---|---|
| StarBrew storefront | https://customereq-demo.salmonsea-4eb14bdc.eastus.azurecontainerapps.io |
| CustomerEQ admin | https://customereq.wellnessatwork.me/admin |

- [ ] Sign in to the admin (Clerk — use the CustomerEQ Demo org)
- [ ] Open the storefront in a second tab
- [ ] Confirm the Demo persona dropdown shows "— choose a persona —"
- [ ] Run a reset if needed (see [Reset](#reset-between-runs))

---

## Opening (45 seconds)

> "Most CX platforms — Qualtrics, Medallia, SurveyMonkey — are silos. They collect feedback, show you a dashboard, and stop. They don't talk to your loyalty system or your support team. So when an unhappy customer fills out a survey, nothing happens automatically — someone has to read the report, find the customer, and decide what to do.
>
> CustomerEQ is one platform where loyalty, surveys, alerts, and campaigns are all connected. StarBrew Coffee set this up in a day. I'll show you both sides: how StarBrew's team configured it, and what their customers experience."

---

## Act 1 — The integration (2 min)

**Admin tab.** Navigate: **Settings → Developer**.

Point at the page top to bottom:

- **Brand ID + API base URL** — "This is everything StarBrew's backend team needed to get started. One API key, one base URL."
- **API Keys** — click **Generate New Key**, name it "Demo key". Show the one-time reveal modal. > "Stored as a SHA-256 hash — if you lose it, revoke it and make a new one. No shared credentials."
- **Survey Embeds** — each active survey has a ready-to-paste `<script>` tag. > "StarBrew dropped this one tag on their post-checkout page. That's the entire survey integration."
- **Webhook URLs** — show the Google Business Profile webhook URL. > "StarBrew's ops team pointed their Google Reviews feed at this. Every new review is automatically ingested, sentiment-scored, and tied to the Customer 360."

> "That's the whole integration. An afternoon of engineering, not a six-month project."

---

## Act 2 — Loyal regular earns points (3 min)

**Storefront tab.** Select **Alex Chen** from the Demo persona dropdown (Gold, 5 visits).

The header shows Alex's points balance and Gold badge immediately.

1. Add a **Tall Drip Coffee** to the cart → checkout.
2. Confirm: "Order placed! +500 StarPoints earned."
3. The inline NPS widget appears directly on the confirmation page: **"Quick — how was your visit?"**
4. Click **9** on the scale.
5. Confirm: "+50 StarPoints earned for your feedback!"

> "Two things just happened in under 2 seconds. StarBrew's POS fired a `purchase` event — CustomerEQ calculated 500 points. Then the survey embed fired a `survey_response` event — 50 bonus points. Alex didn't go to a separate survey page. It was right there."

**Switch to admin tab.**

6. Navigate: **Customers** → search "Alex Chen" → open his profile.
7. Points balance updated. Scroll to **Recent Activity** — show the `purchase` event and the `survey_response` event both in the timeline.

> "One HTTP call per event from StarBrew's server. The Customer 360 builds itself."

---

## Act 3 — New customer joins live (2 min)

**Storefront tab.** In the Demo persona dropdown, scroll to the bottom and select **New customer…**

A sign-up modal appears.

1. Fill in: First name **Jordan**, Last name **Lee**, Email **jordan.lee@example.com**.
2. Click **Join StarBrew Rewards**.
3. The modal closes. The header now shows Jordan's name with 0 points and Bronze tier.

> "That just called `POST /v1/members/enroll` on CustomerEQ's API. GDPR consent tracked, loyalty account created, Bronze tier assigned — one call."

4. Add any item to the cart → checkout.
5. Confirm: "+500 StarPoints earned!"

**Switch to admin tab.**

6. Navigate: **Customers** → search "Jordan" → show the new member record with 1 purchase and 500 points.

> "From zero to enrolled, first purchase recorded, points awarded — all in about 30 seconds. That's the onboarding loop."

---

## Act 4 — At-risk high-value customer (2 min)

**Storefront tab.** Switch to **James Park** (Platinum, 12 visits).

The header shows a high points balance and Platinum badge.

**Switch to admin tab.**

1. Navigate: **Customers** → James Park → open his profile.
2. Show his long purchase history and Platinum tier.

> "James is StarBrew's highest-value member — 12 visits, Platinum tier. In a real deployment you'd see a 45-day recency gap where he went quiet. That alone is enough to trigger a win-back workflow."

3. Navigate: **Campaigns** → show **"Detractor Recovery — 200 Bonus StarPoints"**.

> "This is an event-triggered campaign. Whenever an NPS score of 6 or below is submitted, 200 recovery points are automatically awarded. StarBrew configured this once."

4. Click **Alerts** → **Manage Rules** (top right) → show **"NPS Detractor Alert"**.

> "Every detractor score also opens a case for the CX team with a 4-hour SLA. One submission, two loops — loyalty recovery and human follow-up — both fire automatically."

---

## Act 5 — NPS detractor + closed-loop recovery (5 min)

This is the hero scene.

**Storefront tab.** Switch to **Sara Kim** (Bronze, dissatisfied — recovery target).

1. Click **Surveys** in the storefront nav.
2. Click **Take survey** next to **Post-Visit NPS** (Sara's email is pre-filled).
3. Click **3** on the NPS scale — a clear detractor.
4. In the text field, type: **"Coffee was cold and the staff was rude."**
5. Click **Submit Feedback**.
6. Confirm: "+50 StarPoints earned!"

**Switch to admin tab.**

7. Navigate: **Customers** → Sara Kim → open her profile.
8. Point at **Open Cases** — a HIGH priority case just appeared, assigned to the CX Team, 4-hour SLA countdown running.

> "Sara submitted NPS 3. CustomerEQ:
>
> 1. Stored the response
> 2. Matched the 'NPS Detractor Alert' rule (score 0–6)
> 3. Auto-opened a HIGH priority case — 4-hour SLA, routed to the CX Team
> 4. Awarded 50 survey completion points
> 5. Fired the 'Detractor Recovery' campaign — 200 bonus points queued
>
> All in under 2 seconds. Nobody on StarBrew's team wrote alerting or routing code."

9. Navigate: **Alerts** → show Sara's open case, SLA timer, assignee.
10. Navigate: **Campaigns** → show the Detractor Recovery campaign's triggered count.

> "The CX team sees the case. The loyalty team sees the campaign fire. One submission, both loops closed."

---

## Act 6 — CX Intelligence (2 min)

**Admin tab.** Navigate: **CX Insights**.

Point at:
- **NPS trend** — score movement over time
- **Sentiment distribution** — positive/negative/neutral breakdown
- **Topic clusters** — Sara's "cold coffee / staff" feedback already appears here

> "As responses accumulate, CustomerEQ clusters feedback by topic using AI and runs sentiment analysis. No BI pipeline, no manual tagging. The team sees what's trending before it becomes a crisis."

Navigate to **CX Insights → External Signals** section (or scroll down on the CX Insights page).

> "StarBrew's Google Business Profile webhook feeds reviews directly into this view — same sentiment scoring, same topic extraction. You get one CX picture across survey responses and public reviews. Not a dashboard per source."

---

## Act 7 — AI-Agent Native (1 min)

> "One more thing. Every endpoint we just showed is also exposed as a native MCP tool. So if StarBrew's CX team uses Claude or any AI assistant, they can ask:
>
> - *'What's our NPS this week?'*
> - *'Show me all open detractor cases assigned to the CX Team.'*
> - *'Create a follow-up CSAT survey for everyone who submitted NPS below 7 this month.'*
>
> And the agent does it — no dashboard navigation, no exports. CustomerEQ is the first CX platform built to be AI-agent native."

---

## Closing (45 seconds)

> "What you just saw, end to end:
>
> 1. **Integration in a day** — API key, one embed tag, one webhook URL
> 2. **Loyal member earns points** — one `purchase` event, NPS captured inline, Customer 360 updated automatically
> 3. **New member enrolled live** — one HTTP call, GDPR consent tracked, loyalty account active immediately
> 4. **At-risk Platinum identified** — win-back campaign ready to fire the moment they re-engage
> 5. **Detractor triggers cascade** — case opened, SLA started, recovery points awarded, all in 2 seconds
> 6. **Cross-channel CX intelligence** — surveys + reviews in one AI-scored view
>
> Compare that to Qualtrics + Salesforce Loyalty + a custom alert layer + a BI pipeline. That's 6 months and $500k. StarBrew had this running in a day. **One platform. One API.**"

---

## Reset between runs

**Partial reset** (quick — just switch personas, cart clears automatically):
- Use the Demo persona dropdown. No other action needed.

**Full reset** (wipes all demo data and restores original balances):

```powershell
# Run from repo root
$env:DEMO_API_URL = "https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io"
$env:DEMO_API_KEY = $(az keyvault secret show --vault-name customereq-kv --name mcp-api-key --query value -o tsv)
pnpm seed:demo
```

> **Note:** `seed:demo` is additive — it skips existing members and deduplicates purchases. For a completely clean slate (clear extra purchases, survey responses, and alert cases), delete the five demo personas from **Admin → Customers** first, then re-run the seed. Any "New customer" persona added during the demo (e.g. Jordan Lee) should also be deleted.

---

## Quick reference

### Personas

| Persona | Tier | Story | Scene |
|---|---|---|---|
| Alex Chen | Gold | Happy regular, 5 visits | Act 2 |
| Jordan Lee (live) | Bronze | Enrolled fresh during the demo | Act 3 |
| James Park | Platinum | High-value, at-risk | Act 4 |
| Sara Kim | Bronze | NPS detractor, recovery target | Act 5 |
| Maria Lopez | Bronze | New member, 1 visit | Optional |
| David Wu | Gold | Active redeemer, 4 visits | Optional |

### Key admin paths

| What to show | Path |
|---|---|
| Integration setup | Settings → Developer |
| Member profile + Recent Activity | Customers → [search] → profile |
| Alert cases | Alerts (sidebar) |
| Alert rules | Alerts → "Manage Rules" button (top right) |
| Recovery campaign | Campaigns → "Detractor Recovery — 200 Bonus StarPoints" |
| NPS survey (via storefront) | Storefront header → Surveys → "Take survey" |
| Sentiment + topic clusters | CX Insights |
| External signals (Google reviews) | CX Insights → External Signals section |

### Talking points

| Theme | Sound bite |
|---|---|
| Integration speed | "An afternoon of engineering — API key, one embed tag, one webhook. Not a six-month project." |
| Closed loop | "A complaining customer gets 200 recovery points in 2 seconds. Most stay because they complained." |
| Single platform | "Loyalty + CX alerts + case routing + campaigns — one data model, not four tools." |
| AI-native | "Every endpoint is an MCP tool. Your AI assistant queries customer state and creates campaigns by voice." |
| Competitive | "Same closed-loop as Medallia, 10× cheaper, weeks not months to deploy." |
