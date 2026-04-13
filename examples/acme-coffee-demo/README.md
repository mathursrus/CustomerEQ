# Acme Coffee — CustomerEQ integration demo

This is a fictional online coffee shop. **Every interaction here calls the real CustomerEQ HTTP API.** Use it during sales / partnership demos to show prospects exactly what their integration will look like — what they call, what they get back, and how it shows up in the CustomerEQ admin.

It's intentionally tiny: ~600 lines of HTML/CSS/JS + a 200-line Express backend + a 150-line SDK wrapper. A real customer's product would be larger, but the integration code is the same.

## What it demonstrates

| # | Customer flow | CustomerEQ endpoint | Where in this app |
|---|---|---|---|
| 1 | Sign up | `POST /v1/members/enroll` (public) | Header → "Sign up" button |
| 2 | Buy coffee | `POST /v1/events` with `eventType: purchase` | "Shop & Checkout" section |
| 3 | View account | `GET /v1/members/:id/360` + `/balance` | "My Account" section |
| 4 | Redeem reward | `GET /v1/rewards` + `POST /v1/redemptions` | "Redeem Rewards" section |
| 5 | Submit feedback | Embedded `<script src=".../widget.js">` | "Feedback" section |
| 6 | Server-trigger CSAT survey after a ticket closes | `POST /v1/public/surveys/trigger` | "Feedback" → "Simulate ticket resolved" |
| 7 | Self-serve help (RAG over KB) | `POST /v1/kb/search` | "Help" section |
| 8 | Internal CX ops dashboard | `GET /v1/analytics/cx` | "Ops Dashboard" section |

The tag line above each section (`CustomerEQ → POST /v1/events`) tells the audience exactly which endpoint is firing.

## Run it

### 1. Get credentials from CustomerEQ

Log into your CustomerEQ admin and open the **Developer** page (sidebar → Settings → Developer). Everything you need is on one screen:

- **Brand ID** — top of the page, next to "Your Organization". Click **Copy**.
- **API key** — click **Generate New Key**, give it a name (e.g. "Acme backend"), copy the plaintext from the reveal modal. **You'll only see it once** — paste it into your `.env` immediately.
- **Survey embed snippet** — each active survey has a copy-able `<script>` tag. Grab the survey ID from the snippet (it's the segment after `/v1/public/surveys/`).
- **External signal webhook URL** — if Acme uses Google Reviews or a custom source, its webhook URL + signed-secret indicator is on the same page.

If you prefer the CLI, `node seed-acme.mjs` (from this directory) creates the brand, program, surveys, and external signal source in one step and prints all the IDs you need into a `.env` snippet.

### 2. Configure

```bash
cd examples/acme-coffee-demo
cp .env.example .env
# Edit .env and fill in CUSTOMEREQ_API_KEY, CUSTOMEREQ_BRAND_ID, etc.
```

### 3. Install & run

```bash
npm install
npm start
# → ☕ Acme Coffee demo running at http://localhost:5000
```

Open <http://localhost:5000> in a browser.

## Demo flow (5 minutes)

1. **Sign up** as a fake customer (e.g. `chris.demo@acmecoffee.io`). The member appears in CustomerEQ admin → Members instantly.
2. **Add a "Cold Brew Kit" + 2x "House Blend"** to the cart and **Checkout**. Show the JSON response — `eventType: purchase`, points awarded, campaign jobs queued. Switch to CustomerEQ admin → Members → the new member: balance updated, event in the timeline.
3. **My Account → Refresh from CustomerEQ**. Points balance, recent events, surveys. This is `/v1/members/:id/360` rendered straight through — no Acme database involved.
4. **Redeem Rewards → Load reward catalog**. Show that Acme is reading the catalog from CustomerEQ. Click Redeem on a reward; show the atomic ledger update on the member.
5. **Feedback → embedded survey**. The widget is a single `<script>` tag — no SDK install. Submit a 9 score and a positive comment. Switch to admin → CX Analytics: NPS just moved.
6. **Simulate "ticket resolved"** to fire `POST /v1/public/surveys/trigger`. Show the email-trigger flow that a real helpdesk would use.
7. **Help → search "How do I redeem points?"** Demonstrates KB RAG search.
8. **Ops Dashboard → Pull analytics**. Acme's internal team sees live CX numbers from CustomerEQ.

## File map

```
acme-coffee-demo/
├── server.js              # Express backend; one route per integration
├── lib/customereq.js      # Tiny CustomerEQ SDK (copy-paste-friendly)
├── public/
│   ├── index.html         # Single-page customer storefront
│   ├── app.js             # Frontend glue, vanilla JS
│   └── styles.css         # Just enough styling to look like a real shop
├── .env.example           # All env vars with comments
├── package.json
└── README.md
```

## What this app is NOT

- It's not a production-ready integration. There's no real auth, no DB, no error UX.
- It's not a CustomerEQ SDK — `lib/customereq.js` is illustrative; for real integrations, use the typed `@customerEQ/mcp-server` or write your own.
- It's not a full storefront. Cart state lives in browser memory; refresh = lost.

## Notes for the live demo

- **Run CustomerEQ locally** before starting Acme: `pnpm dev` from the repo root. Acme assumes the API is up at `http://localhost:4000`.
- **Seed data** helps: run `node scripts/seed-demo-rich.mjs` so there's a program, surveys, rewards, and analytics already populated.
- **Two browser windows side by side** is the best layout — Acme on the left, CustomerEQ admin on the right. Walk through each section and switch contexts to show the data landing.
- The demo script that walks through this app lives at `docs/DEMO-SCRIPT.md`.
