# 513 — CustomerEQ Mobile App for CX Managers (React Native)

## Overview

A React Native (Expo) mobile companion app for **CustomerEQ product owners and CX managers** — the B2B subscribers who manage their customer experience program. The app surfaces survey results, AI feedback clustering, anomaly alerts, and Google Reviews in a mobile-first experience optimized for a CX manager on the go.

This is the **operator app**, not a consumer loyalty wallet.

---

## Persona

**Sarah Chen** — Head of Customer Experience, ACME Coffee (30 locations).

Sarah monitors NPS during her morning commute, investigates why "Checkout Speed" spiked on a Tuesday afternoon, and responds to a 2-star Google Review before her 9am standup. She has access to the CustomerEQ web dashboard but needs key signals pushed to her phone so she can act before the day gets away.

---

## MVP Scope

### In Scope

| Feature Area | Description |
|---|---|
| **Surveys** | Browse active/paused/completed surveys; NPS/CSAT distribution; recent verbatims |
| **Results & Analytics** | NPS hero card with 7-week sparkline, response rate, week-over-week delta |
| **AI Clustering / Insights** | AI-grouped feedback themes ranked by volume; trend direction; anomaly badges |
| **Review Integration** | Google Reviews feed; star distribution; compose and submit replies from mobile |
| **Anomaly Alerts** | Push notifications + in-app banners when a cluster spikes >2σ |

### Coming Soon (not in MVP)

- 🎁 Loyalty Program Management (points ledger, campaign builder, tier config)
- 💬 Support Queue (case list, assign/resolve, SLA monitor)

---

## Navigation

Five-tab bottom bar:

| Tab | Screen | Purpose |
|---|---|---|
| Home | Dashboard | NPS hero, response rate, anomaly alert, recent verbatims |
| Surveys | Survey List | All surveys with score/status; tap → distribution + verbatims |
| Insights | AI Clusters | Cluster cards with trend; tap → quotes + sentiment + AI summary |
| Reviews | Google Reviews | Review feed with star distribution; tap → reply composer |
| Profile | Account | Brand selector, integrations, notifications, Coming Soon section |

---

## Screen Specifications

### Home Screen

**Header row**: CustomerEQ logo (left) + notification bell with badge count (right)

**Greeting**: "Good morning, Sarah" · today's date (e.g., "Friday, May 23")

**NPS Hero Card** (indigo `#4F46E5` gradient):
- Large NPS score (e.g., "62") centered
- Week-over-week delta chip: "↑4 pts vs last week" (green) or "↓2 pts" (red)
- 7-week sparkline SVG directly below score
- Subtitle: "142 responses · 38% response rate this week"

**Anomaly Banner** (shown when active, amber pulse border):
- "⚠ Checkout Speed spiked 47% in 24h" → chevron → taps to Insights tab, cluster pre-selected

**Recent Verbatims** (last 3 survey responses):
- Star rating · sentiment chip (Positive / Neutral / Negative) · quote text (2 lines max)

**Quick Links row**: "All Surveys →" · "AI Insights →" · "Reviews →"

---

### Surveys Screen

**Filter chip row**: All · Active · Paused · Completed

**Survey card** (per survey):
- Survey name (bold)
- Type badge: NPS (indigo) / CSAT (sky) / 5★ (amber)
- Response count · current score · status chip (Active=green / Paused=amber / Completed=gray)
- Time since last response (e.g., "2h ago")

**Survey Detail Sheet** (slides up from bottom, 80% height):
- Survey name + type + total response count
- **Score distribution** bar chart:
  - NPS: Promoters (%) green / Passives (%) yellow / Detractors (%) red — stacked horizontal bar
  - CSAT: 5-bar horizontal distribution (1★–5★)
- **NPS number** calculated from distribution
- **7-week trend line** (SVG path, last 7 weeks)
- **Recent verbatims** list: 5 most recent — star · sentiment chip · quote text

---

### Insights Screen

**Anomaly Card** (shown when active — red left border, pulse animation):
- "🔴 ANOMALY DETECTED"
- Cluster name · spike percentage · time elapsed
- "View Cluster →" CTA

**Cluster cards** (ranked by response volume, all clusters):

| Field | Detail |
|---|---|
| Cluster name | e.g., "Checkout Speed" |
| Response count | e.g., "47 responses" |
| Trend chip | "↑23% this week" (red) or "↓8%" (green) or "±2%" (gray) |
| Status badge | 🔴 Spiking / 🟡 Growing / 🟢 Stable / ⬇ Declining |

**Cluster Detail Sheet** (slides up from bottom, 85% height):
- Cluster name + response count + last update time
- **AI summary**: 1–2 sentence plain-language description of the theme
- **Sentiment breakdown** horizontal bar: Positive % · Neutral % · Negative %
- **Sample verbatims** (3–5): star rating · sentiment chip · quote text
- **"View in Dashboard →"** button (deep-links to web dashboard for full data)

---

### Reviews Screen

**Platform tabs**: Google (active) · Yelp ("Coming Soon" chip, disabled)

**Score Card**:
- Overall rating: "4.3" large + filled star display + "(127 reviews)"
- **Star distribution** horizontal bars: 5★ 58% / 4★ 22% / 3★ 11% / 2★ 5% / 1★ 4%

**Review List** (paginated, most recent first):
- Initials avatar (colored per initial) · reviewer name · date (relative)
- Star rating (filled/empty stars)
- Review text (2-line truncate; tap to expand full text)
- "Replied ✓" chip (green) if responded · "Reply" button if not

**Reply Sheet** (slides up when "Reply" tapped, 70% height):
- Quoted review at top (gray background, 2-line truncate)
- Text area: "Write your response..."
- Character count (max 1500)
- "Submit Reply" button (calls `POST /v1/reviews/:id/reply`)
- On success: sheet closes + "Reply submitted ✓" toast for 2s

---

### Profile Screen

**Brand selector pill**: "ACME Coffee ▾" (tappable — multi-brand accounts see picker)

**Account row**: initials avatar · name · email

**Integrations section**:
- Google Business — Connected ✓ (green dot)
- Zapier — Not connected (gray dot)

**Notification preferences** (toggle rows):
- Anomaly alerts: ON
- Weekly NPS digest: ON
- New review received: ON

**Coming Soon section** (disabled, 50% opacity, lock icon):
- 🎁 Loyalty Program Management
- 💬 Support Queue

**Sign Out** (red text, bottom)

---

## New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/mobile/dashboard` | Consolidated: NPS score + 7-week trend array, response rate, response count, active anomaly summary — single call for home screen initial render |
| `GET` | `/v1/reviews` | Paginated Google Reviews for `brandId` from JWT; returns `id`, `author`, `rating`, `text`, `date`, `replied: boolean` |
| `POST` | `/v1/reviews/:reviewId/reply` | Submit reply text; proxies to Google Business Profile API; enforces `brandId` ownership check |

### Multi-tenancy (Rule 6)
All three new endpoints derive `brandId` from the Clerk JWT (`session.publicMetadata.brandId`). It is never accepted from the request body or query string.

---

## Existing Endpoints Used

| Endpoint | Mobile Screen |
|----------|--------------|
| `GET /v1/analytics/cx` | Home sparkline + Surveys |
| `GET /v1/feedback/clusters` | Insights cluster list |
| `GET /v1/anomalies` | Home banner + Insights alert card |
| `GET /v1/surveys` | Surveys list |
| `GET /v1/surveys/:id` | Survey detail sheet |
| `GET /v1/surveys/:id/responses` | Survey verbatims |

---

## Compliance

The app operates as a **B2B operator interface** over aggregated feedback data — it does not introduce new PII pipelines beyond the web app. BrandId JWT scoping (Rule 6) ensures operators cannot access another brand's data.

Push notifications to the product owner (anomaly alerts, NPS digest):
- OS consent gate before registering device token (`expo-notifications`)
- Device token stored with `brandId` + `userId` scoping
- Deregistered on sign-out
- 90-day pruning cron job on `operator_device_token` table

---

## Acceptance Criteria

- **AC1** — Home screen renders NPS score, 7-week sparkline, response rate, and any active anomaly alert within 2s of completing sign-in.
- **AC2** — Surveys screen lists all surveys (active, paused, completed) with type badge, response count, current score, and status.
- **AC3** — Tapping a survey opens a detail sheet with NPS/CSAT score distribution bars and at least 5 recent verbatims.
- **AC4** — Insights screen shows AI clusters ranked by response volume with trend direction and magnitude.
- **AC5** — Tapping a cluster opens a detail sheet with an AI-generated 1-sentence summary, sentiment breakdown chart, and 3–5 sample verbatims.
- **AC6** — When a cluster exceeds the anomaly threshold, a pulsing alert banner appears on Home and Insights and links to the relevant cluster detail.
- **AC7** — Reviews screen renders the Google Reviews feed with star ratings, reviewer name, date, and truncated review text.
- **AC8** — Tapping "Reply" opens a reply sheet; submitting calls `POST /v1/reviews/:id/reply` and shows a success toast; `brandId` scoping enforced server-side.
- **AC9** — `GET /v1/mobile/dashboard`, `GET /v1/reviews`, and `POST /v1/reviews/:id/reply` are implemented, unit-tested, and enforce `brandId` from Clerk JWT.
- **AC10** — Loyalty and Support tabs display non-functional "Coming Soon" placeholder screens with a lock indicator.

---

## Technical Stack

| Layer | Choice |
|---|---|
| Runtime | Expo SDK 52, managed workflow |
| Navigation | Expo Router (file-based, mirrors Next.js) |
| Server state | TanStack Query v5 |
| UI state | Zustand |
| Styling | NativeWind 4 (Tailwind for React Native) |
| Auth | `@clerk/clerk-expo` |
| Push | `expo-notifications` + Expo Push Service |
| Testing | Jest + RNTL (unit); Maestro (E2E) |
| Build | EAS Build |

---

## Monorepo Layout

```
apps/mobile/
├── app/
│   ├── (auth)/
│   │   └── sign-in.tsx
│   └── (tabs)/
│       ├── index.tsx          # Home dashboard
│       ├── surveys.tsx        # Surveys list
│       ├── insights.tsx       # AI clustering
│       ├── reviews.tsx        # Google Reviews
│       └── profile.tsx        # Profile + Coming Soon
├── components/
│   ├── NpsSparkline.tsx       # SVG sparkline
│   ├── ClusterCard.tsx        # Cluster summary card
│   ├── ReviewCard.tsx         # Review row
│   ├── SurveyDetailSheet.tsx  # Distribution + verbatims
│   ├── ClusterDetailSheet.tsx # AI summary + quotes
│   └── ReplySheet.tsx         # Review reply composer
├── hooks/
│   ├── useDashboard.ts        # /v1/mobile/dashboard
│   ├── useSurveys.ts          # /v1/surveys
│   ├── useClusters.ts         # /v1/feedback/clusters + /v1/anomalies
│   └── useReviews.ts          # /v1/reviews
└── store/
    └── ui.ts                  # Active sheet, selected cluster/survey/review
```

---

## Competitive Context

| Competitor | Mobile Operator App? | Notes |
|---|---|---|
| Qualtrics XM | Yes (limited) | Dashboard read-only; no review integration |
| Medallia | Yes | Full-featured; enterprise only |
| Delighted | No | Web-only dashboard |
| AskNicely | Yes | NPS-focused; no clustering |
| Fivestars / Punchh | No operator app | Consumer loyalty only |

CustomerEQ differentiator: **AI clustering + anomaly push alerts + Google Review reply** in a single mobile operator app — no competitor at the mid-market tier offers this combination.
