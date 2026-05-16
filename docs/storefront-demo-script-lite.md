# StarBrew Coffee — Storefront Demo Script (Lite)

**Duration:** 12–15 minutes  
**Last Updated:** 2026-05-15  
**Format:** Two browser tabs side by side. **StarBrew storefront** on the left, **CustomerEQ admin** on the right. Every customer action on the storefront is immediately followed by switching to admin to show the data land in real time.

> **The frame:** StarBrew Coffee is a fictional coffee-shop chain. They've integrated CustomerEQ to run their loyalty program, surveys, and CX alerts. You play the role of their CX team watching signals arrive live.

---

## Setup (before the audience joins)

### URLs

| What | URL |
|---|---|
| StarBrew storefront | https://customereq-demo.salmonsea-4eb14bdc.eastus.azurecontainerapps.io |
| CustomerEQ admin | https://customereq.wellnessatwork.me/admin |

### Pre-flight checklist

- [ ] Sign in to the admin at `customereq.wellnessatwork.me` (Clerk auth — use the **StarBrew** org)
- [ ] Open the storefront in a second tab
- [ ] Run a demo reset if needed (see [Reset](#reset-between-runs) below)
- [ ] Select **Alex Chen** from the Demo persona dropdown to pre-load Scene 1

---

## Opening (30 seconds)

> "StarBrew Coffee has five real customers in their loyalty program right now. I'm going to switch into each of their shoes and show you what CustomerEQ sees on the other side — in real time, no mocking."

---

## Scene 1 — Happy regular earns points (3 min)

**Storefront tab.** Select **Alex Chen** from the Demo persona dropdown (Gold member, 5 visits).

The header immediately shows Alex's points balance and Gold badge.

1. Add a **Tall Drip Coffee** to the cart.
2. Go to cart → **Checkout**.
3. Confirm: "Order placed! +500 StarPoints earned." (The header balance may take a moment to refresh — the confirmation message is the authoritative signal.)

**Switch to admin tab.**

4. Navigate: **Customers** → search **"alex"** → click **View** on Alex Chen's row.
5. Point at the **points balance** — it just increased by 500.
6. Scroll down to **Recent Activity** and show the `purchase` event that just landed.

> "One HTTP call from StarBrew's POS — `POST /v1/events` with `eventType: purchase` — and CustomerEQ handled the rest: calculated points, updated the tier, logged the event to the Customer 360. Their engineering team wrote that one call. Everything else is CustomerEQ."

---

## Scene 2 — New Bronze member's first visit (2 min)

**Storefront tab.** Switch the Demo persona dropdown to **Maria Lopez** (Bronze member, 1 prior visit).

> Note: switching persona automatically clears the cart so Alex's order doesn't carry over.

The header updates instantly — low point balance, Bronze badge.

1. Add any item to the cart → checkout.
2. Show: "+500 StarPoints earned!" — same earning rule fires for every member.

**Switch to admin tab.**

3. Navigate: **Customers** → search **"maria"** → click **View** on Maria Lopez's row. Show her thin purchase history (2 visits now) and Bronze tier.

> "Maria is one visit old. StarBrew knows exactly where she is in the loyalty funnel. If she goes quiet, a win-back campaign can fire automatically."

---

## Scene 3 — High-value at-risk customer (2 min)

**Storefront tab.** Switch to **James Park** (Platinum, 12 visits).

The header shows a high points balance and Platinum badge immediately.

**Switch to admin tab.**

1. Navigate: **Customers** → search **"james"** → click **View** on James Park's row to open his profile.
2. Show his long purchase history and Platinum tier.

> "James is StarBrew's highest-value member — 12 visits, Platinum tier, thousands of points. In a real deployment you'd see a 45-day gap in this timeline where he went quiet. That gap alone is enough to trigger a win-back workflow."

3. Navigate: **Campaigns** → show the **"Detractor Recovery — 200 Bonus StarPoints"** campaign. (Use the top entry if there are duplicates — it's the active one dated 5/7/2026.)

> "This is a CX-triggered campaign. It fires whenever an NPS score of 6 or below is submitted and automatically awards 200 recovery points. StarBrew configured this once."

4. Navigate: **Alerts** → click **"Manage Rules"** (top right) → show the **"NPS Detractor Alert"** rule. (Use the top entry if there are duplicates.)

> "Every detractor also opens a case for the CX team with a 4-hour SLA. One bad score triggers both a loyalty recovery and a human follow-up. Automatically."

---

## Scene 4 — NPS detractor + closed-loop recovery (4 min)

This is the hero scene. Take your time.

**Storefront tab.** Switch to **Sara Kim** (Bronze member, dissatisfied — recovery target).

1. Click **Surveys** in the storefront nav.
2. Click **Take survey** next to **Post-Visit NPS** (Sara's email is pre-filled).
3. Click **3** on the NPS scale — a clear detractor.
4. Skip the radio-button follow-up question (any selection or skip is fine).
5. In the open-text field (**"Tell us more"** or similar label), type: **"Coffee was cold and the staff was rude."**
6. Click **Submit Feedback**.
7. Confirm: "+50 StarPoints earned!"

**Switch to admin tab.**

8. Navigate: **Customers** → search **"sara"** → click **View** on Sara Kim's row.
9. Point at **Open Cases** — a new HIGH priority case just appeared, assigned to the CX Team. The SLA column shows the **deadline timestamp**. (Sara may have earlier open cases from prior runs — the new one is the most recent.)

> "Sara submitted NPS 3. CustomerEQ:
>
> 1. Stored the response with AI-scored sentiment
> 2. Classified it as a detractor (score 0–6)
> 3. Matched the 'NPS Detractor Alert' rule
> 4. Auto-opened a HIGH priority case — 4-hour SLA deadline, routed to the CX Team
> 5. Awarded 50 survey completion points
> 6. Fired the 'Detractor Recovery' campaign — 200 bonus points queued
>
> All of that happened in under 2 seconds, with zero code from StarBrew."

10. Navigate: **Alerts** → show Sara's open case with SLA deadline and assignee.
11. Navigate: **Campaigns** → show the Detractor Recovery campaign's **triggered count** incremented.

> "The CX team sees the case. The loyalty team sees the campaign fire. One submission, both loops closed."

---

## Scene 5 — CX Insights (1 min, optional)

**Admin tab.** Navigate: **CX Insights**.

Point at:
- **NPS Score** — aggregate score across all survey responses
- **Per-Survey Breakdown** — score and response count per active survey
- **Feedback Clusters** — Sara's "cold coffee / staff" feedback already grouped here by topic

> "As responses accumulate, CustomerEQ automatically clusters feedback by topic and runs sentiment analysis. No BI pipeline, no manual tagging. The team sees what's trending before it becomes a crisis."

Scroll to **External Signals**.

> "StarBrew's Google Business Profile webhook feeds reviews into this same view — same sentiment scoring, same topic extraction. One CX picture across survey responses and public reviews."

---

## Closing (30 seconds)

> "Five customers. Four scenes. One platform.
>
> StarBrew's engineers wrote one HTTP call per purchase event and dropped one survey embed tag. CustomerEQ handled the loyalty math, the CX alerting, the case routing, and the recovery campaigns — all automatically.
>
> That's the integration. Hours, not months."

---

## Reset between runs

**Partial reset** (points accumulate but program state is preserved — fine for sequential scenes in one session):
- Just switch personas using the dropdown. The cart clears automatically.

**Standard reset** (closes open cases, pauses campaigns, recreates alert rules and surveys):

```powershell
# Run from repo root
$env:DEMO_API_URL = "https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io"
$env:DEMO_API_KEY = $(az keyvault secret show --vault-name customereq-kv --name demo-starbrew-api-key --query value -o tsv)
pnpm seed:demo -- --reset
```

**Full reset** (completely clean slate — use when member state has drifted):
1. In **Admin → Customers** (StarBrew org), delete all members — every row in this org is demo data, so bulk-delete is safe.
2. Re-run `pnpm seed:demo` (without `--reset`) to recreate everything fresh.

> **Note:** The StarBrew org is isolated — it contains only demo data. You can delete any or all of its members, cases, and surveys without risk of touching other orgs.

---

## Quick reference

### Personas

| Persona | Email | Tier | Story |
|---|---|---|---|
| Alex Chen | alex.chen@starbrew.demo | Gold | Happy regular, 5 visits — Scene 1 |
| Maria Lopez | maria.lopez@starbrew.demo | Bronze | New member, 1 visit — Scene 2 |
| James Park | james.park@starbrew.demo | Platinum | High-value, at-risk — Scene 3 |
| Sara Kim | sara.kim@starbrew.demo | Bronze | NPS detractor, recovery target — Scene 4 |
| David Wu | david.wu@starbrew.demo | Gold | Active redeemer, 4 visits — optional |

### Key admin paths

| What to show | Admin path |
|---|---|
| Member profile + Recent Activity | Customers → search (partial name) → View → profile |
| Alert cases | Alerts (sidebar) |
| Alert rules | Alerts → "Manage Rules" button (top right) |
| Recovery campaign | Campaigns → "Detractor Recovery — 200 Bonus StarPoints" (top/latest entry) |
| NPS survey | Storefront header → Surveys → "Take survey" next to Post-Visit NPS |
| NPS score + feedback clusters | CX Insights |
| External signals (Google reviews) | CX Insights → External Signals section |

### Talking points

| Theme | Sound bite |
|---|---|
| Integration speed | "One HTTP call per purchase event. Everything else is CustomerEQ." |
| Closed loop | "A complaining customer gets a recovery campaign in 2 seconds. Most stay because they complained." |
| Single platform | "Loyalty + CX alerts + case routing + campaigns — one data model, not four tools." |
| AI-native | "Every endpoint is also an MCP tool. Your AI assistant can query customer state or create campaigns by voice." |
