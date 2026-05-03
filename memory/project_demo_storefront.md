---
name: Demo Storefront (#230)
description: Status and key facts about the apps/demo-storefront app built for issue #230
type: project
---

apps/demo-storefront is a standalone Next.js app (port 3002) serving as the customer-facing StarBrew Coffee demo site.

**Why:** Allows client demos where a prospect can watch the full CX-to-loyalty loop live in a browser — buy a drink, leave a low NPS, see the recovery campaign fire.

**Key facts:**
- Depends on #229 seed data (personas + program) being in the DB before it's useful
- No real auth — uses a persona picker dropdown (localStorage) to switch between the 5 seeded demo members
- API calls to protected endpoints (`/v1/events`, `/v1/members`) go through Next.js API proxy routes at `/api/storefront/*` which inject `X-Test-Brand-Id` headers
- Public endpoints (`/v1/public/surveys/:id/respond`) are called directly from the browser
- Brand name/color driven by `NEXT_PUBLIC_DEMO_BRAND_*` env vars (defaults: StarBrew Coffee / #00704A)
- `DEMO_API_URL` and `DEMO_BRAND_ID` are server-side only env vars for the proxy routes
- Points balance and tier shown in LoyaltyBar component in header (custom React, not the embed web component)
- E2E test: `pnpm test:e2e:demo` — runs checkout.spec.ts which verifies persona → cart → checkout → points increase in DB

**Start command:** `pnpm demo` or `pnpm --filter @customerEQ/demo-storefront dev`

**How to apply:** When asked about the demo flow, demo setup, or issue #230, reference this app at `apps/demo-storefront/`.
