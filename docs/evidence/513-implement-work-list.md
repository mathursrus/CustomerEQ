# Issue #513 — Implementation Work List
# CustomerEQ Mobile App for CX Managers (React Native)

**Issue type**: Feature  
**Branch**: `feature/513-feat-customereq-member-mobile-app-react-native`  
**Phase**: implement-scoping → implement-tests → implement-code

---

## Scope Assessment

File modification count: **28+ files** — exceeds the 15-file Phase Splitting Candidate threshold.  
**Decision**: Proceeding with full execution per user instruction (preferences: "execute all phases to completion without intermediate pauses").

---

## Deliverables by AC

| AC | Deliverable | Layer |
|----|-------------|-------|
| AC9 | `GET /v1/mobile/dashboard` endpoint | API |
| AC9 | `GET /v1/reviews` endpoint | API |
| AC9 | `POST /v1/reviews/:reviewId/reply` endpoint | API |
| AC1 | Home screen (NPS hero, sparkline, anomaly) | Mobile |
| AC2 | Surveys screen (list with filter chips) | Mobile |
| AC3 | Survey detail sheet (distribution + verbatims) | Mobile |
| AC4 | Insights screen (cluster list ranked by volume) | Mobile |
| AC5 | Cluster detail sheet (AI summary, sentiment, verbatims) | Mobile |
| AC6 | Anomaly alert banner — Home + Insights | Mobile |
| AC7 | Reviews screen (Google Reviews feed) | Mobile |
| AC8 | Reply sheet + POST /reviews/:id/reply integration | Mobile |
| AC10 | Profile screen + Coming Soon placeholders | Mobile |

---

## Implementation Checklist

### Backend — API Routes

- [ ] `apps/api/src/routes/mobile.ts` — 3 new endpoints  
  - `GET /mobile/dashboard` — weekly NPS buckets (7 weeks) + response rate + active anomaly  
  - `GET /reviews` — paginated ExternalSignal (GOOGLE_BUSINESS_PROFILE), brandId from JWT  
  - `POST /reviews/:reviewId/reply` — update providerStatus='replied', append statusHistory  
- [ ] `apps/api/src/app.ts` — register `mobileRoutes` with `/v1` prefix  
- [ ] `apps/api/src/routes/mobile.test.ts` — unit tests for pure helpers (NPS weekly calc, pagination, reply logic)  

### Mobile App — `apps/mobile/`

**Config & Setup**
- [ ] `apps/mobile/package.json` — Expo SDK 52 dependencies
- [ ] `apps/mobile/app.json` — Expo config (slug, name, bundleId, scheme)
- [ ] `apps/mobile/tsconfig.json` — extends root tsconfig
- [ ] `apps/mobile/babel.config.js` — babel-preset-expo + NativeWind
- [ ] `apps/mobile/tailwind.config.js` — NativeWind 4 config
- [ ] `apps/mobile/metro.config.js` — NativeWind metro transform
- [ ] `apps/mobile/.env.example` — EXPO_PUBLIC_API_URL, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

**App Shell**
- [ ] `apps/mobile/app/_layout.tsx` — ClerkProvider + QueryClientProvider + Zustand store hydration
- [ ] `apps/mobile/app/(auth)/sign-in.tsx` — Clerk sign-in with @clerk/clerk-expo
- [ ] `apps/mobile/app/(tabs)/_layout.tsx` — 5-tab bottom bar (Home, Surveys, Insights, Reviews, Profile)

**Screens**
- [ ] `apps/mobile/app/(tabs)/index.tsx` — Home: NPS hero card, sparkline, anomaly banner, verbatims
- [ ] `apps/mobile/app/(tabs)/surveys.tsx` — Surveys: filter chips, survey cards, create sheet
- [ ] `apps/mobile/app/(tabs)/insights.tsx` — Insights: anomaly card, cluster cards
- [ ] `apps/mobile/app/(tabs)/reviews.tsx` — Reviews: score card, review list, reply sheet
- [ ] `apps/mobile/app/(tabs)/profile.tsx` — Profile: account, integrations, notifications, Coming Soon

**Components**
- [ ] `apps/mobile/components/NpsSparkline.tsx` — SVG 7-week sparkline
- [ ] `apps/mobile/components/SurveyDetailSheet.tsx` — distribution bars + multi-question accordion + verbatims
- [ ] `apps/mobile/components/ClusterCard.tsx` — cluster summary card with trend chip
- [ ] `apps/mobile/components/ClusterDetailSheet.tsx` — AI summary + sentiment bar + verbatims
- [ ] `apps/mobile/components/ReviewCard.tsx` — review row with reply button
- [ ] `apps/mobile/components/ReplySheet.tsx` — reply composer with char count + submit
- [ ] `apps/mobile/components/AnomalyBanner.tsx` — pulsing alert banner (Home + Insights)

**Hooks**
- [ ] `apps/mobile/hooks/useDashboard.ts` — TanStack Query: GET /v1/mobile/dashboard
- [ ] `apps/mobile/hooks/useSurveys.ts` — TanStack Query: GET /v1/surveys + /v1/surveys/:id
- [ ] `apps/mobile/hooks/useClusters.ts` — TanStack Query: GET /v1/analytics/cx/clusters + anomalies
- [ ] `apps/mobile/hooks/useReviews.ts` — TanStack Query: GET /v1/reviews + POST reply

**State**
- [ ] `apps/mobile/store/ui.ts` — Zustand: active sheet, selected IDs

**Tests**
- [ ] `apps/mobile/__tests__/NpsSparkline.test.tsx` — RNTL unit test
- [ ] `apps/mobile/__tests__/hooks/useDashboard.test.ts` — hook unit test with mocked fetch

---

## Validation Requirements

- `uiValidationRequired`: true (React Native screens — Metro + Expo Go or emulator)
- `mobileValidationRequired`: true (Metro bundler must start cleanly; screens must render on iOS/Android emulator or Expo Go)
- `apiValidationRequired`: true (unit tests must pass: `pnpm test:smoke`)
- `typecheckRequired`: true (`pnpm typecheck` zero errors)

---

## Multi-Tenancy (Rule 6)

All 3 new endpoints derive `brandId` from `request.brandId` (set by `multiTenantPlugin` from Clerk JWT). Never accept from body/query.

## Data Model Notes

- Reviews = `ExternalSignal` where `sourceType = 'GOOGLE_BUSINESS_PROFILE'`
- `replied` derived from `providerStatus === 'replied'`
- Clusters = `FeedbackCluster` (existing); Anomalies = `FeedbackAnomaly` (existing)
- NPS weekly buckets: group `SurveyResponse` by week bucket, compute NPS per bucket

## Deferrals (Out of MVP)

- Actual Google Business Profile API proxy call on reply (deferred — stored as providerStatus='replied' locally)
- Expo push notification device token registration (deferred — complex prod setup)
- EAS Build CI integration (deferred — tracked by `mobile-app-submission` FRAIM job)
- App Store submission (out of scope per issue)
