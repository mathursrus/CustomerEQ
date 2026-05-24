# Feature: iOS React Native App — Minimal Admin Surface

Issue: TBD (file before implementation per project Rule 10)
Owner: Drafted ad-hoc under user authorization (FRAIM MCP unavailable in remote session; Rule 24 waived for this spec only)
Status: Draft

## Customer

CustomerEQ brand administrators (CX program managers at mid-market companies) who need on-the-go visibility into customer signals and the ability to spin up surveys without sitting at a desk. Today they operate exclusively through the Next.js admin web app and have no native mobile surface.

## Customer's Desired Outcome

A brand admin can, from their iPhone:
1. Spin up a new survey from a preset (NPS / CSAT / CES) in under 60 seconds and ship the share link.
2. Confirm that their review-platform integrations (Google Business Profile, X, Reddit, LinkedIn, webhooks) are healthy and see the latest external signals.
3. Glance at survey-response analytics for the last 7 / 30 / 90 days — total responses, NPS score, sentiment distribution, top topics.
4. See clear "Coming soon" affordances for **Support** and **Loyalty** so they know the platform's full surface is on the way but are not blocked waiting for it.

## Customer Problem Being Solved

CX leaders react to customer signal *between* desk sessions — in elevators, between meetings, during commutes. The current web app is responsive but heavy and assumes a keyboard. Three concrete pain points:

- **No spot-check for survey health.** Admins can't quickly answer "is my NPS slipping this week?" from their phone without VPN + laptop.
- **No mobile survey creation.** Launching a one-off CSAT pulse during a meeting requires waiting until the admin gets back to a workstation.
- **No mobile integration health.** When a Google Business Profile poll silently fails, admins discover it days later when reviews stop appearing in the dashboard.

Loyalty and Support are intentionally out of v1 scope because their workflows (campaign authoring, ticket triage) are heavier and benefit from desktop ergonomics. We surface them as "Coming soon" tiles to set expectations and gather waitlist signal.

## Scope

### In Scope (v1)

1. **Authentication** — Clerk sign-in (email magic link + SSO if the brand has it configured), org switcher if user belongs to multiple brands.
2. **Survey creation** — preset-based (NPS / CSAT / CES); name + program selection + thank-you message; save as DRAFT; one-tap "Activate" to publish.
3. **Survey list** — list of the brand's surveys with status (DRAFT / ACTIVE / PAUSED / STOPPED), response count, and last-response timestamp.
4. **Review integrations** — list of `ExternalSignalSource` records with health status; ability to enable/disable a source and trigger a manual "Test connection."
5. **Survey response analytics** — date-range picker (7d / 30d / 90d), aggregate cards (total responses, NPS, CSAT, CES, sentiment distribution), top-5 topics, per-survey breakdown.
6. **"Coming soon" tiles** — two non-interactive cards on Home for **Support** and **Loyalty** with a single-tap "Notify me" CTA that writes to a `mobile_feature_waitlist` table (or no-op for v1 with local-only opt-in if the waitlist table is deferred).

### Explicitly Out of Scope (v1)

- Custom survey builder (drag/drop, skip logic) — preset-only on mobile; admins use web for custom builds.
- Sending survey invitations (email/SMS/in-app) from the phone.
- Editing or responding to individual customer responses.
- Creating, editing, or testing campaigns (Rule 2 hero pipeline) from mobile.
- Loyalty member management, points adjustments, reward redemptions.
- Support ticket triage / closed-loop alerting workflows.
- Push notifications. (See Open Question #3.)
- Android build. iOS-first; Android tracked separately if v1 succeeds.
- Offline-first / write queuing. v1 is online-only; show a clear offline banner.

## User Experience

### App Information Architecture

```
Bottom Tab Bar (4 tabs):
  ┌─────────┬─────────┬──────────────┬──────────────┐
  │  Home   │ Surveys │ Integrations │  Analytics   │
  └─────────┴─────────┴──────────────┴──────────────┘

Home tab:
  - Greeting + active brand name (with org switcher)
  - Quick stat strip: today's response count, current NPS
  - "Coming soon" tiles: Support, Loyalty (each with Notify Me)
  - Recent activity feed (last 5 survey responses with sentiment chip)

Surveys tab:
  - List: each row = { name, status badge, responsesCount, lastResponseAt }
  - FAB: "+ New survey"
  - Tap row → Survey detail (read-only summary; "Open in web" link for editing)

Integrations tab:
  - List grouped by sourceType (GOOGLE_BUSINESS_PROFILE, X, REDDIT, LINKEDIN_ORG, GENERIC_WEBHOOK, GENERIC_API)
  - Each row: { sourceType icon, label, healthStatus dot, lastSyncAt }
  - Tap row → Integration detail: toggle enabled, "Test connection" button, view last 5 signals

Analytics tab:
  - Date range chip group: 7d / 30d / 90d (default 30d)
  - Optional Survey filter (multi-select)
  - Cards: Total Responses, NPS (with promoters/passives/detractors mini-bar), CSAT avg, CES avg
  - Sentiment distribution: horizontal stacked bar (positive/neutral/negative)
  - Top topics: top-5 list with counts
  - Per-survey breakdown: collapsible list
```

### Survey Creation Flow (v1 preset path)

1. Surveys tab → tap FAB "+ New survey"
2. **Step 1: Choose preset** — full-screen list: NPS, CSAT, CES, Custom (Custom is disabled with "Use web app for custom builds")
3. **Step 2: Basics** — fields: Name (required), Program (single-select from brand's programs, required), Thank-you message (optional textarea)
4. **Step 3: Review & save** — read-only summary of preset questions; primary button "Save as draft", secondary button "Save & activate"
5. Success state: confirmation screen with the share link (tap to copy), CTA to "View survey" (jumps to Survey detail)

Validation: Name 1–120 chars; Program required; thank-you message ≤ 500 chars. Errors shown inline with iOS-native haptic.

### Integration Health Detail Flow

1. Integrations tab → tap an integration row
2. Detail screen shows: source label, healthStatus (color-coded dot + text), lastSyncAt, connectionMethod (WEBHOOK / POLL / MANUAL), syncMode
3. Toggle: Enabled (true/false) — flips immediately, optimistic UI, rolls back on API failure
4. Button: "Test connection" — calls `POST /admin/external-signal-sources/:id/test`, shows result inline
5. Section: "Recent signals (last 5)" — list of `ExternalSignal` summaries with sentiment chip and timestamp

### "Coming Soon" Tile Behavior

- Tile shows: feature name, one-line teaser, "Notify me" button
- Tap "Notify me" → local state flips to "We'll let you know" with a checkmark; record sent to `POST /v1/mobile/waitlist { feature: 'support' | 'loyalty' }` (graceful no-op on 404 if endpoint deferred)
- No deep links; the tile is purely informational

## Technical Considerations

### Stack

- **Framework**: React Native via **Expo SDK 51+** (managed workflow). Rationale: faster iteration, OTA updates via EAS Update, no need for a Mac to run dev builds (Expo Go on physical device).
- **Language**: TypeScript strict mode (matches monorepo).
- **Navigation**: `@react-navigation/native` with bottom tabs + native stack.
- **State / data**: TanStack Query (React Query) for server state; Zustand for the slim client state we have (active brand, auth).
- **HTTP**: `fetch` with a thin `apiClient` wrapper that injects Clerk JWT.
- **Auth**: `@clerk/clerk-expo` for sign-in, session persistence in iOS Keychain (Clerk default).
- **Forms**: `react-hook-form` + `zod` resolver; reuse shared `@customerEQ/shared/zod` schemas where possible (after verifying RN compatibility).
- **UI**: NativeWind (Tailwind for RN) to keep visual parity with web; design tokens pulled from `docs/architecture/architecture.md` design system.

### Repository Layout

Add a new app under the monorepo:

```
apps/
  mobile/
    app.json                  # Expo config
    eas.json                  # EAS build config
    package.json
    src/
      api/                    # apiClient + per-resource hooks
      auth/                   # Clerk provider, sign-in screen
      components/
      screens/
        Home/
        Surveys/
        Integrations/
        Analytics/
      navigation/
      lib/                    # config (API_URL), formatters
    ios/                      # generated by `expo prebuild` for native bits
```

Turborepo task additions: `mobile#dev` (Expo start), `mobile#typecheck`, `mobile#lint`, `mobile#test:smoke` (Jest + react-native-testing-library).

### API Surface Used (no new endpoints required for v1)

All endpoints already exist; cited from recon against current codebase:

| Screen / action | Method + path | Notes |
|-----------------|---------------|-------|
| Survey list | `GET /v1/surveys?brandId=<jwt-derived>` | Pagination |
| Create survey | `POST /v1/surveys` | Body: `{ name, programId, type, questions, settings?, thankYouMessage? }` |
| Activate survey | `PATCH /v1/surveys/:id/status` | Body: `{ status: 'ACTIVE' }` |
| Programs (for picker) | `GET /v1/programs` | Existing |
| Integrations list | `GET /admin/external-signal-sources` | Filter by `enabled`, `sourceType` |
| Toggle integration | `PATCH /admin/external-signal-sources/:id` | Body: `{ enabled: bool }` |
| Test integration | `POST /admin/external-signal-sources/:id/test` | Returns connection status |
| Analytics CX | `GET /v1/analytics/cx?startDate=&endDate=&surveyId=` | Returns NPS / CSAT / CES / sentiment / topics |
| Recent activity | `GET /v1/analytics/cx` + last-N `SurveyResponse` (existing) | Reuse |
| Waitlist (optional) | `POST /v1/mobile/waitlist` | New endpoint **iff** we want server-side capture; otherwise local-only |

### Tenancy (Rule 6 — non-negotiable)

- `brandId` is **never** sent in request bodies from the mobile app. The API resolves it from the Clerk JWT's `orgId` via the existing auth plugin.
- Org switcher in the mobile app calls Clerk's `setActive({ organization })` and triggers a TanStack Query cache invalidation. No `brandId` ever leaves the client.

### Hero Pipeline Protection (Rule 2)

The mobile app **reads** survey responses and analytics aggregations but does not write campaign actions, points adjustments, or any loyalty events. Read-only on the hero pipeline. If a future "Quick action on signal" feature is added, it must enqueue a BullMQ event via the API — never write directly.

### Auth Specifics

- Clerk Expo SDK handles biometric session unlock after first sign-in.
- JWT auto-refresh on app foreground.
- On 401, drop to sign-in screen with toast "Session expired."

### Config / Build

- API URL via Expo `app.config.ts` reading `EXPO_PUBLIC_API_URL` (per-env: dev / staging / prod).
- Sensitive Clerk keys go through `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Secrets (none in v1 since Clerk handles auth, no API keys ship in the app) follow Rule 12.
- EAS Build profiles: `development`, `preview` (TestFlight), `production` (App Store).

### Observability

- Sentry React Native SDK (matches whatever the web uses; check `apps/web` config). Tag events with `brandId` (from session, not body) and screen name.

## Test Coverage

Per project Rule 9 — this would be P1 (admin-facing, not loyalty pipeline). Required:

- **Unit tests (Jest + react-native-testing-library)**: each screen renders all states (loading, empty, populated, error); form validators; apiClient JWT injection.
- **Integration tests**: api/ hooks against a mocked API (MSW for RN) covering happy path + 401 + 5xx for each endpoint.
- E2E (deferred): Detox or Maestro pass on TestFlight build before App Store release; not gated by this spec.
- All tests must fail loudly per Rule 11a (no skipped tests for missing config).

## Acceptance Criteria

1. Admin can sign in via Clerk and lands on Home with their brand name displayed.
2. Admin can create a DRAFT survey from an NPS preset, name it, attach a program, and save it — and the survey appears in Surveys list within 2 seconds.
3. Admin can activate a DRAFT survey from the mobile detail screen; web admin reflects the status change.
4. Admin sees a list of their `ExternalSignalSource` records with accurate healthStatus matching what the web admin shows.
5. Admin can toggle a source's `enabled` flag from mobile and see the change reflected in the web admin.
6. Admin can pick a 7d / 30d / 90d window and see NPS, CSAT, CES, total responses, sentiment distribution, and top-5 topics matching `GET /v1/analytics/cx` for the same window.
7. Home shows "Coming soon" tiles for Support and Loyalty with a working "Notify me" affordance.
8. `brandId` does not appear in any outbound request body (verified via Charles / network log inspection).
9. Smoke tests (`pnpm --filter @customerEQ/mobile test:smoke`) pass; new mobile app is wired into the root `pnpm typecheck` + `pnpm lint` (Rule 11).
10. App builds successfully as a TestFlight `preview` via EAS.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Adding a new app to the monorepo trips up the postinstall / Prisma client hook (Rule 23 / Issue #383) | Mobile app declares no `@prisma/client` dep; verify `pnpm install` from a fresh worktree still completes. |
| Clerk Expo SDK behavior diverges from web Clerk for org switching | Add an integration test stub; ship behind a feature flag if discrepancy found. |
| Bundle size from NativeWind + RN core | Measure with `expo export`; budget < 30MB; trim icon libs aggressively. |
| Webhook test endpoint hits external services unintentionally | The "Test connection" button calls the existing test endpoint as-is — no new exposure, but confirm it's already idempotent before shipping. |
| App Store review friction (privacy nutrition label, App Tracking Transparency) | Sentry init must respect ATT denied state; ship privacy manifest in Info.plist; no third-party SDK that requires ATT prompt in v1. |
| Loyalty/Support waitlist endpoint introduces a Rule 6 boundary surface | Either ship without the server endpoint (local-only) or add the endpoint behind the auth plugin so it auto-scopes by brand. |

## Open Questions

1. **Org switcher visibility**: do admins routinely belong to multiple brands, or is single-brand the norm? If single-brand is 95%, hide the switcher behind a kebab menu instead of putting it on Home.
2. **Custom surveys on mobile**: confirmed out of scope for v1, but should we let admins *view* (read-only) a custom survey created on web, or hide them from the mobile list entirely?
3. **Push notifications**: out of scope for v1, but if we want them in v2 we'll need an APNs setup + a new `device_tokens` table. Worth deciding now whether to provision the schema in v1's migration to avoid a follow-up migration.
4. **Waitlist persistence**: do we want server-side capture of "Notify me" signals (new endpoint + table), or is a local opt-in (stored in AsyncStorage) enough for v1 signal-gathering?
5. **Design system parity**: the web app uses shadcn + Tailwind v4. NativeWind covers Tailwind classes but not shadcn primitives. Do we re-skin to native components (recommended) or invest in cross-platform primitives (heavier)?
6. **GitHub issue**: this spec was drafted without an issue number — per Rule 10 the issue should be filed before any implementation branch is cut. Owner to confirm and link.

## Follow-ups Once This Spec is Approved

- File a GitHub issue and replace `TBD` above (Rule 10).
- Author an RFC under `docs/rfcs/` covering: Expo vs bare RN tradeoffs, NativeWind vs other styling, Clerk Expo session model, EAS Build pipeline, monorepo integration plan.
- Update `docs/architecture/architecture.md` with the mobile-app stack decision (ADR if any one-way doors are crossed — e.g., Expo Managed workflow vs bare).
- Update `docs/replicate/IMPLEMENTATION_ROADMAP.md` if mobile becomes a roadmap line-item.

## Authorship & Process Notes

This document was drafted ad-hoc in a remote Claude Code session where the FRAIM MCP server was not available. Project Rule 24 mandates the `feature-specification` FRAIM job for this kind of work; the user explicitly waived the rule for this single draft after the FRAIM environment could not be brought up in the ephemeral container (rationale: `~/.fraim` setup needs API key + GitHub token interactively, MCP servers don't hot-load mid-session, and container state is non-persistent). Before this spec moves to RFC, it should be reviewed against the FRAIM `feature-specification` job's phase checklist from a local session and any missing phase artifacts should be backfilled.
