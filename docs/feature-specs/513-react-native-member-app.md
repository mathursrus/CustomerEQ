# Feature: CustomerEQ Member Mobile App (React Native)

Issue: #513  
Owner: FRAIM feature-specification job (claude-sonnet-4-6)  
Status: Draft — 2026-05-23

---

## Customer

**Loyalty program members** — end consumers of brands (coffee shops, retail, e-commerce, restaurants) that use CustomerEQ as their loyalty platform. These members enrolled in a brand's program via web, POS, or referral link and want to engage with their rewards on the device they carry everywhere.

Representative personas:

| Persona | Context | Mobile need |
|---------|---------|-------------|
| Sarah, 28 | Visits ACME Coffee 4×/week | Checks Stars balance at register; wants push notification when she hits Gold |
| Marcus, 34 | Shops at mid-market retailer | Wants to redeem a birthday reward; has no laptop at the store |
| Dana, 42 | Busy professional | Gets an NPS survey notification, taps, answers in 15 seconds while commuting |
| Priya, 25 | Engages heavily with spin-wheel campaigns | Plays campaign games; scratching a card on a phone touchscreen feels natural |

---

## Customer's Desired Outcome

A member can, from their iOS or Android phone:

1. **See their balance** — current points, active tier, and tier progress bar in real time
2. **Browse and redeem rewards** — catalog with tier-gate filtering; one-tap redemption; in-store QR code
3. **Complete surveys inline** — NPS/CSAT without leaving the app or opening a link in Safari
4. **Play campaign games** — spin wheel, scratch card, mystery box designed for touch
5. **Receive push notifications** — earned points, tier upgrade, expiring reward, new campaign available
6. **View activity history** — full earn/burn ledger with context labels

---

## Customer Problem Being Solved

The existing CustomerEQ member portal is web-only (`/dashboard`, `/rewards`, `/history`). Members face three measurable problems:

**P1 — Push notification gap kills hero-loop visibility**  
Issue #6's real-time CX→loyalty loop fires correctly at the backend. But without push notifications, a member who earns 50 bonus points from a negative NPS response never *feels* the brand responding in real time. The emotional impact — the very thing that drives repeat purchase — is lost. Industry data: loyalty programs with push notifications see 2.3× higher monthly active usage.

**P2 — In-store redemption is friction-heavy**  
Pulling up the web portal at a POS checkout requires a browser, a load, a sign-in, and navigation. QR-code redemption from a native app takes one tap and shows a full-screen code. Abandonment at checkout from web flow: ~40% per CustomerEQ's own demo data.

**P3 — Mobile survey response rates degrade on email links**  
Survey response rates from email links on mobile hover around 8–12% because they open a browser tab in an unfamiliar context. In-app surveys (rendered natively, triggered by push) achieve 35–45% response rates (Qualtrics 2024 benchmark). Lower response rates degrade CX signal quality, weakening the entire feedback loop.

---

## User Experience

### Information Architecture

```
Bottom Tab Bar — 5 tabs:
  ┌─────────┬──────────┬──────────┬──────────┬──────────┐
  │  Home   │ Rewards  │ Activity │ Surveys  │ Profile  │
  └─────────┴──────────┴──────────┴──────────┴──────────┘

Each tab = root screen + push stack for detail screens.
Modal sheets used for: redemption confirmation, QR code display,
push notification permission request.
```

### Screens

#### 1. Onboarding & Sign-In

- Branded splash (brand logo + background color from `BrandTheme.primaryColor`)
- Sign-in options: **Email magic link** (Clerk passwordless) + **Google SSO** if brand has it configured
- First-time users see a 3-card swiper: "Earn points → Reach tiers → Redeem rewards"
- After auth, Clerk JWT + `orgId` (= `brandId`) establishes brand context — no `brandId` ever sent in body (Rule 6)

#### 2. Home Tab

Header strip:
- Brand logo top-left; notification bell top-right (badge count)
- "Hi, {firstName}" greeting

Points hero card (full-width, branded gradient):
- Large animated counter: **{pointsBalance} pts**
- Current tier badge (Bronze / Silver / Gold / Platinum) with icon
- Tier progress bar: `{pts} / {nextTierThreshold}` with label "to {nextTier}"

Quick action row (horizontal scroll):
- 🎁 **Redeem** → Rewards tab
- 📊 **Survey** → active survey if pending, else Surveys tab
- 🎰 **Play** → active campaign if any
- 📜 **History** → Activity tab

Recent activity strip (last 3 earn/burn events):
- Each row: icon + label + `+/-N pts` + timestamp
- "See all" link → Activity tab

Active campaign card (shown only when a campaign is live):
- Campaign thumbnail + name + "Play now" CTA

#### 3. Rewards Tab

Top controls:
- Tier filter chip row: All / Reachable / {tier names}
- Search bar (fuzzy match on reward name)

Reward card grid (2-col):
- Reward image (or branded placeholder)
- Reward name
- Points cost badge
- Lock icon overlay if member tier < required tier; tooltip "Reach {tier} to unlock"
- "Redeem" button (disabled if insufficient points, shows deficit)

**Redemption flow** (modal sheet):
1. Confirmation card: reward details + point cost + new balance preview
2. Tap "Confirm" → `POST /v1/redemptions` → success state
3. Success sheet: animated checkmark → transition to **QR Code screen**

**QR Code screen** (full-screen):
- Large QR code (time-bound JWT, 90-second expiry with live countdown ring)
- Merchant instruction: "Show to cashier to redeem {rewardName}"
- Auto-dismiss on expiry; option to regenerate (if reward allows)
- Brightness auto-max while QR is displayed

#### 4. Activity Tab

Header: total points earned lifetime + current balance

Timeline list (infinite scroll, paginated):
- Each row:
  - Icon (earn = green arrow up, burn = orange arrow down, campaign = star, tier change = badge)
  - Label: e.g., "Earned for survey response" / "Redeemed: Free Coffee"
  - `+75 pts` or `-250 pts` (color-coded)
  - Date + time

Filter bar (sticky):
- All / Earn / Redeem / Campaign / Tier

Empty state: branded illustration + "Start earning by shopping with {brandName}"

#### 5. Surveys Tab

Pending surveys list:
- Each card: survey title + type badge (NPS / CSAT / CES) + estimated time
- "Points reward" chip if survey has a points-on-completion rule
- Tap → inline survey screen

**Inline survey screen** (replaces tab content):
- Progress bar (question N of M)
- NPS: number scale 0–10 with emoji gradients (😟 → 😐 → 😊)
- CSAT: 5-star or 5-emoji scale
- Open text: optional "Tell us more" textarea
- Submit → thank-you animation + points earned toast if applicable
- On submit → `POST /v1/events` with `type: SURVEY_RESPONSE`

Completed surveys section (collapsed by default):
- Shows last 5 completed surveys with date + score

#### 6. Profile Tab

Top card:
- Avatar (initials fallback) + name + email
- Enrolled programs list (tap to switch active program if multi-enrolled)

Tier progress section:
- Circular progress ring (SVG animated): current pts of next-tier threshold
- Tier history: sparkline of tier changes over 6 months

Notifications section:
- Toggle: "Push notifications" (triggers OS permission request if not yet granted)
- Individual toggles: Points earned / Tier change / Expiring reward / New campaign / Survey available

Account section:
- Edit profile (name/phone)
- Privacy: "Download my data" + "Delete my account" (GDPR/CCPA required)
- Sign out

---

### Push Notification Types & Deep Links

| Trigger | Copy (example) | Deep link |
|---------|----------------|-----------|
| Points earned | "You earned 75 pts from your survey! 🎉" | `/activity` |
| Tier upgrade | "You reached Gold tier! 🏆 Unlock new rewards" | `/profile` |
| Tier at-risk | "You have 30 days before Silver renewal — earn 200 pts" | `/home` |
| Expiring reward | "Your Free Coffee reward expires in 2 days" | `/rewards` |
| New campaign | "Spin the wheel and win up to 500 pts! 🎰" | `/campaign/{id}` |
| Survey available | "Quick question from ACME Coffee — earn 50 pts for answering" | `/surveys/{id}` |

---

## Technical Constraints

### Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Expo SDK 52** (managed workflow) | OTA updates via EAS Update; Expo Go for development; no Mac required for Android testing |
| Language | TypeScript 5.x strict | Matches monorepo |
| Navigation | **Expo Router** (file-based) | Mirrors Next.js `app/` conventions — team already knows the mental model; deep-link support built in |
| State — server | **TanStack Query v5** | Identical to web app; reuse `@customerEQ/shared` query key factories |
| State — client | **Zustand** | Auth state, active brand, notification prefs; minimal surface |
| Auth | **@clerk/clerk-expo** | Same Clerk org → JWT → `brandId` path as web; session stored in iOS Keychain / Android Keystore |
| Styling | **NativeWind 4** (Tailwind for RN) | Color tokens from `docs/architecture/architecture.md` design system; visual parity with web |
| HTTP | Native `fetch` with thin `apiClient` wrapper | Injects Clerk `getToken()` as Bearer; handles 401 → sign-out |
| Push notifications | **expo-notifications** + Expo Push Service | Abstracts APNs/FCM certificate management; server sends via Expo Push Ticket API |
| Forms | **react-hook-form** + zod resolver | Reuses `@customerEQ/shared` Zod schemas where RN-compatible |
| Testing | **Jest** + **React Native Testing Library** | Unit/component; **Maestro** for E2E flows on device |
| Build | **EAS Build** (managed) | CI via `eas build --platform all --non-interactive`; profiles: dev / preview (TestFlight) / production |

### Monorepo Integration

New workspace: `apps/mobile/`

```
apps/
  mobile/
    app.config.ts           # Expo config (reads EXPO_PUBLIC_* env vars)
    eas.json                # EAS build profiles
    package.json
    src/
      api/                  # apiClient + per-resource React Query hooks
      auth/                 # ClerkProvider, useAuth wrapper
      components/           # Shared UI components
        PointsHeroCard.tsx
        RewardCard.tsx
        TierProgressRing.tsx
        SurveyQuestion.tsx
        CampaignPlayCard.tsx
        QRCodeDisplay.tsx
        NotificationItem.tsx
      screens/              # One folder per Expo Router segment
        (tabs)/
          home/index.tsx
          rewards/index.tsx
          rewards/[id]/index.tsx    # reward detail
          activity/index.tsx
          surveys/index.tsx
          surveys/[id]/index.tsx    # inline survey
          profile/index.tsx
        sign-in.tsx
        onboarding.tsx
        campaign/[id].tsx           # campaign play (full-screen)
      lib/
        apiClient.ts
        config.ts           # EXPO_PUBLIC_API_URL
        queryKeys.ts
        formatters.ts
      hooks/
        usePointsBalance.ts
        useRewardsCatalog.ts
        useActivityFeed.ts
        useActiveSurveys.ts
        useActiveCampaign.ts
```

Turborepo additions: `mobile#dev`, `mobile#typecheck`, `mobile#lint`, `mobile#test:smoke`
Root `pnpm typecheck` and `pnpm lint` pick up mobile via `turbo.json` tasks.

### New API Endpoints Required

All existing `/v1/` member endpoints serve data correctly; three new endpoints are needed:

| Endpoint | Purpose | Rule constraint |
|----------|---------|----------------|
| `POST /v1/members/device-token` | Register Expo push token for the authenticated member | `brandId` from JWT only (Rule 6) |
| `DELETE /v1/members/device-token` | Deregister on sign-out | Same |
| `POST /v1/rewards/:id/qr-code` | Generate a time-bound signed JWT token for in-store redemption; returns `{ token, expiresAt }` | `brandId` from JWT; idempotent per reward per member per 90s window |

Worker addition: **push-notification processor** (new BullMQ queue `push-notifications`) triggered by existing loyalty-event, tier-change, and campaign event processors. Uses Expo Push Ticket API.

### Multi-Tenancy (Rule 6 — non-negotiable)

- The mobile app sends **zero `brandId` fields in any request body**. `brandId` is resolved server-side from `jwt.orgId` via the existing auth plugin
- Expo's Clerk `setActiveOrganization()` (if member is enrolled in multiple brands' programs) invalidates all TanStack Query caches before re-fetching under the new org context

### Hero Pipeline Protection (Rule 2)

The mobile app **reads** loyalty balances and redeems rewards via `POST /v1/redemptions`. It never writes directly to the loyalty ledger. Redemptions enqueue a `REDEMPTION_REQUESTED` BullMQ event via the existing pipeline. The mobile app has no direct DB access and no worker-bypass paths.

### GDPR / CCPA Compliance

The mobile app processes PII (member name, email, device token, location-adjacent timing data). Required controls:

- **R1 — Consent gate**: App shall not collect device token until member explicitly enables push notifications (OS permission dialog + in-app toggle)
- **R2 — Data access**: Profile tab shall expose "Download my data" that calls the existing GDPR export endpoint
- **R3 — Erasure**: Profile tab "Delete my account" shall call the existing erasure endpoint; app shall sign out and clear local cache on completion
- **R4 — Device token scope**: Stored `device_token` records shall carry `brandId` and `memberId`; no cross-brand fan-out possible
- **R5 — Soft delete**: `device_token` record shall be soft-deleted (not hard-deleted) unless an erasure request removes it with the member record
- **R6 — Retention**: Device tokens older than 90 days without a push event shall be pruned by a new worker scheduled job

---

## Validation Plan

| Acceptance Criterion | Validation Method |
|----------------------|-------------------|
| AC1 — Member can sign in via Clerk and sees their points balance | Maestro flow: sign-in → home screen → verify points counter matches `GET /v1/members/me` response |
| AC2 — Push notification delivered within 60s of loyalty event | Integration test: enqueue loyalty-event → verify Expo Push Ticket API called; manual test with physical device |
| AC3 — Campaign play from mobile records result identically to web | Playwright comparison: same `POST /v1/campaign-plays/:id` response from both mobile (Maestro) and web |
| AC4 — NPS survey submits via `POST /v1/events` within 30s | Maestro flow: tap survey → answer → submit → verify event in DB; check `sentAt` timestamp |
| AC5 — QR redemption code displays for 90 seconds then expires | Jest: token TTL assertion; Maestro: timer countdown visual verification |
| AC6 — App reflects brand theme within 1 render of sign-in | Unit test: render `<HomeScreen>` with mock brand theme → snapshot matches primaryColor |
| AC7 — Device token endpoints enforce multi-tenant scoping | Integration test: call `POST /v1/members/device-token` with JWT for brand A → verify token stored with brand A's `brandId` only |
| AC8 — Push processor handles loyalty-event worker output | Unit test: mock loyalty-event processor → verify `push-notifications` queue receives correct payload |
| AC9 — `eas build` compiles for iOS + Android, zero type errors | CI: `eas build --platform all --non-interactive --profile preview`; `pnpm typecheck` |
| AC10 — All new API routes pass smoke tests | `pnpm test:smoke` runs new route tests without database |

---

## UI Mocks

All mocks are in `docs/feature-specs/mocks/513-*/`. Open the interactive prototype to navigate all screens:

- **[Interactive Prototype](mocks/513-prototype.html)** — Full app simulation in a browser, all screens navigable. Open this first.
- [Home Screen](mocks/513-home.html) — Points hero card, tier progress, quick actions
- [Rewards Catalog](mocks/513-rewards.html) — Grid, tier filters, redemption flow, QR code screen
- [NPS Survey](mocks/513-survey.html) — Inline survey question, emoji scale, thank-you state
- [Spin Wheel Campaign](mocks/513-campaign-spin.html) — Full-screen campaign play with animation
- [Profile & Tier Progress](mocks/513-profile.html) — Circular tier ring, notification toggles, GDPR actions

### Design Standards Applied

Mocks follow the CustomerEQ design system documented in `docs/architecture/architecture.md`:
- **Colors**: Brand primary pulled from `BrandTheme.primaryColor`; semantic tokens (success = #22c55e, warning = #f59e0b, error = #ef4444) matching Tailwind v4 defaults used in web
- **Typography**: System font stack (SF Pro / Roboto) — no custom font to load; matches native feel
- **Spacing**: 4px base unit, consistent with Tailwind's 4/8/12/16/24/32 scale
- **Radius**: 12px card corners, 24px bottom sheet handles — matches shadcn/Radix card primitives on web
- **Brand accent**: mocks default to ACME Coffee (emerald `#059669`) as demo brand; all colors are runtime-injected from the API

---

## Alternatives

| Alternative | Why Discarded |
|-------------|--------------|
| Responsive PWA (just polish the existing Next.js member portal) | No push notifications on iOS PWAs (Apple restricts Web Push on iOS < 16.4; still requires explicit "Add to Home Screen" — adoption <3%). No native QR scanner. No biometric auth. |
| React Native (bare workflow without Expo) | Requires macOS + Xcode + Android Studio setup; no OTA updates; significantly higher operational cost for a small team. Expo Managed is strictly better given current team size. |
| Flutter | Different language (Dart); team has zero Flutter experience; shares no code with existing TypeScript monorepo. Training cost is prohibitive. |
| Capacitor/Ionic wrapping the existing Next.js app | Hybrid apps have known performance issues for animation-heavy features (spin wheel, scratch card, tier progress rings). Campaign plays require 60fps touch; Capacitor cannot reliably deliver that. |
| Native Swift/Kotlin | Maximum performance but zero code sharing with the monorepo; doubles the codebase surface; impossible to staff at current team size. |

---

## Competitive Analysis

### Loyalty Mobile App Benchmarks

| Competitor | Mobile App | Strengths | Weaknesses | Positioning vs CustomerEQ |
|------------|-----------|-----------|------------|--------------------------|
| **Starbucks** | Native iOS+Android, best-in-class | Push notifications, stored-value card, AR rewards, mobile order | B2C only, single brand, extremely high eng investment | Sets the gold standard UX benchmark for our members |
| **Yotpo Loyalty** | No native member app; web widgets only | Strong B2B analytics, Shopify integration | Members interact via email links and embedded widgets; no native push | We beat them on member engagement channel |
| **Smile.io** | No native member app; web portal | Wide Shopify ecosystem, referral programs | No push notifications; no in-store QR; no native campaign plays | Direct gap we fill |
| **Annex Cloud** | Admin-only mobile app; no member app | Enterprise feature depth | No mobile member experience; 82-hour feedback loop | Our real-time loop + mobile is a category difference |
| **Fivestars** | Native member app (iOS+Android) | Push notifications, in-store check-in, small biz focus | No CX signal ingestion; no NPS-to-loyalty automation; aging UI | Closest native competitor; we beat them on CX integration |
| **Punchh** | Native member app (iOS+Android) | Strong restaurant vertical, gamification | Restaurant-only; no generic CX ingestion; heavy implementation | Vertical competitor; CustomerEQ is horizontal |

### Competitive Positioning Strategy

**Key Differentiator**: No competitor connects CX feedback (NPS, support, reviews) to loyalty rewards and delivers that loop to the member on their phone in real time. Starbucks has the best app but no CX layer. Yotpo/Smile have the CX tools but no native app. CustomerEQ is the only platform that closes the loop in both directions natively.

**Target**: Mid-market brands (not Starbucks-scale) who need the experience quality of Starbucks but can't build their own app. CustomerEQ's white-label mobile shell is their Starbucks app.

**Pricing lever**: "Your customers get an app like Starbucks, powered by your brand, in 2 weeks — without hiring mobile engineers."

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Expo Managed workflow hits a native module blocker (e.g., NFC, background location) | Low | Med | Neither feature is in v1 scope; if needed later, eject to bare workflow at that point |
| NativeWind v4 RN compatibility issues (some Tailwind classes unsupported on RN) | Med | Low | Maintain a UI component library with explicit fallbacks; mock tests catch class mismatches at build |
| Clerk Expo SDK token refresh timing causes 401 on app resume | Med | High | Implement `useAuth().getToken({ skipCache: true })` on app foreground (AppState listener); existing web pattern adapted |
| Expo push token invalidation (APNs token rotation) | Med | Med | Handle `ExpoError.DeviceNotRegistered` in push processor; soft-delete stale tokens |
| QR code redemption race condition (two scans of same code) | Low | High | QR JWT contains a `jti` (JWT ID); redemption endpoint uses Postgres `INSERT ... ON CONFLICT DO NOTHING` on `jti` |
| Monorepo `pnpm install` picks up RN-specific packages that break web/api/worker builds | Low | High | Mobile's `package.json` scoped; Turborepo pipeline isolation; no `@react-native-*` packages in shared packages |
| App Store review: privacy nutrition label + ATT prompt from Sentry | High | Med | Configure Sentry with ATT-denied path from day 1; add NSPrivacyCollectedDataTypes to `Info.plist`; no ad tracking SDKs |

---

## Open Questions

| # | Question | Owner | Default if unresolved |
|---|----------|-------|----------------------|
| Q1 | Should members enrolled in multiple brands' programs see a brand switcher on Home, or land on a single "primary" brand? | Product | Brand switcher; power users enroll in 2+ programs |
| Q2 | Push notification sound/vibration per type — should high-value events (tier upgrade) use a distinct sound? | Design | Yes; use system "success" haptic + sound; configurable in v2 |
| Q3 | Should the QR code redemption token also be usable by a merchant-side scanner (QR scan at POS), or only display for visual verification? | Product | Display-only for v1; bidirectional scan tracked as v2 |
| Q4 | Do we support Android in v1 or iOS-only? | Product | Both; EAS Build handles both platforms with one codebase |
| Q5 | Should the worker push-notification processor be a new queue or fan-out from existing loyalty-events processor? | Engineering | Separate queue (`push-notifications`); decouples push failures from loyalty event processing |
