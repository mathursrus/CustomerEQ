# Implementation Work List — Issue #170

Standing work list for the multi-PR implementation of the onboarding & first-run experience shared spine, per `docs/rfcs/170-onboarding-first-run.md` (merged via PR #196).

Sub-issues #171, #172, #173 own archetype-specific connect/verify flows and are out of scope for this work list. #189 (team-management) and #190 (brand-settings) are parallel; spine creates the data they consume.

## Issue Type

**feature** (epic; new shared infrastructure across data, API, web, worker, plus a new external abstraction layer)

## Validation Requirements

- `uiValidationRequired`: **yes** — touches `/signup`, `/signup/finish`, `/admin/onboarding/profile`, `/admin/onboarding`, `/admin` (dashboard), and a new internal route
- `mobileValidationRequired`: **no** — admin portal is desktop-first per project convention; the marketing/auth pages should still render correctly at narrow widths but no emulator profile is required
- Browser baseline: Chromium (Playwright default), per `apps/web/playwright.config.ts`
- Test environments expected to be reachable: local Postgres (Docker), Redis, dev server (`pnpm dev`), local Clerk dev keys
- UI polish evidence artifact (per FRAIM convention for heavy UI work): **yes** — auth/onboarding journey is greenfield; `docs/evidence/170-ui-polish-validation.md` will be added before submitting the UI-heavy PRs (PR 2 and PR 3)
- Pre-existing CI gate: `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke` (R11)

## Priority & Test Coverage

Issue #170 is a **P0 epic** — by R9, every shipping PR requires unit + integration + E2E tests. E2E tests live in `apps/web/test/e2e/` (per `apps/web/playwright.config.ts`).

---

## PR Plan (6 PRs — approved 2026-04-27)

> **Phase Splitting Candidate (skill rule)**: enumerated file count >> 15. User approved a 6-PR slice on 2026-04-27 — splitting both the auth and the onboarding-admin slices into API-only and UI-only PRs for tighter review boundaries. Dependency chain is linear (PR 1 → 2 → 3 → 4 → 5 → 6); each PR is reviewable in one sitting (~7–14 files).
>
> Resolved decisions (2026-04-27):
> 1. Slicing — **6 PRs** (this layout)
> 2. Sign-in — **keep Clerk catch-all** `[[...sign-in]]/page.tsx`; only `/signup` is custom-chrome
> 3. API route layout — **flat** under `apps/api/src/routes/` per existing convention
> 4. Architecture-doc updates + ADR 0004 — **bundled with PR 1**

### PR 1 — Foundation: data layer + IdentityProvider abstraction

Branch: `feature/170-onboarding-shared-spine` (current branch — extend with subsequent PR branches off `main`)

Smallest, blocks all the others. Establishes the schema and the Clerk-replaceability abstraction.

**Estimated files**: ~14

- [ ] `packages/database/prisma/schema.prisma` — add `OnboardingState`, `OnboardingActivationEvent` models; new `Brand` fields (`siteDomain`, `logoUrl`, `defaultThemeId`, `sizeCategory`); new enums (`OrgSizeCategory`, `OnboardingStep`, `UseCasePath`); extend `ExternalSignalSourceType` with `APPLICATION`; add `ApiKey.externalSignalSourceId`. Per RFC §2.
- [ ] `packages/database/prisma/migrations/20260427000000_onboarding_first_run/migration.sql` — single migration with all of the above. Per RFC §2.5.
- [ ] (Backfill) embedded in the migration: insert `OnboardingState` rows + `OnboardingActivationEvent { step: 'account_created' }` for every existing Brand. Idempotent on `OnboardingState.brandId` unique. Per RFC §2.5.
- [ ] NEW `apps/api/src/auth/identity-provider.ts` — interface with the 11 methods + `NormalizedProviderEvent` discriminated union. Per RFC §3.1.
- [ ] NEW `apps/api/src/auth/clerk-identity-provider.ts` — Clerk implementation wrapping `@clerk/clerk-sdk-node` and `svix`. Honors the `createUserWithOrg` cleanup contract. Per RFC §3.2.
- [ ] NEW `apps/api/src/auth/clerk-identity-provider.test.ts` — unit tests for the implementation (mocking Clerk SDK + svix) covering: `parseWebhook` signature happy/unhappy paths; `createUserWithOrg` happy path + partial-failure cleanup; `getSession` → `{ userId, orgId: null }` new-user case; `beginOAuth` URL shape.
- [ ] (`apps/api/src/auth/identity-provider.contract.test.ts`) optional — interface contract test that any future implementation must satisfy. Defer to PR 1 follow-up if scope is tight.
- [ ] `eslint.config.mjs` (or root `.eslintrc.cjs`) — add `no-restricted-imports` rule for `@clerk/*` patterns with override for `clerk-identity-provider.ts`. Per RFC §3.3.
- [ ] `apps/api/src/plugins/auth.ts` — refactor existing `verifyToken` plugin to call `IdentityProvider.getSession` instead of importing `@clerk/backend` directly. The plugin keeps its public shape (the `request.brandId` decoration); only the internals change.
- [ ] `apps/api/src/plugins/auth.test.ts` — extend existing tests with the new abstraction in place; no behavioral change expected.
- [ ] NEW `docs/architecture/adr/0004-onboarding-activation-funnel-and-identity-provider.md` — ADR covering OD-4 (dedicated `OnboardingActivationEvent` model) + OD-5 (IdentityProvider abstraction with ESLint enforcement). Per RFC §15 + Round 2 reviewer decision (one ADR).
- [ ] `docs/architecture/architecture.md` — add the IdentityProvider-abstraction pattern + funnel-event-model pattern; reference ADR 0004. Per RFC §15.
- [ ] (Validation script) verify the ESLint rule actually catches a violating import — adds a one-line test fixture or asserts via `pnpm lint` exit code in PR description.

**Validation**:
- `pnpm prisma migrate dev` (creates the migration; verifies SQL is well-formed)
- `pnpm typecheck` (the abstraction's type signatures bind every callsite of the auth plugin)
- `pnpm lint` (ESLint must catch any `@clerk/*` import outside `clerk-identity-provider.ts`; if it doesn't, the rule isn't wired)
- `pnpm test:smoke` (must pass; no regressions in auth plugin behavior)
- `pnpm test:integration` for the auth path (existing JWT-based tests still pass through the abstraction)
- Manual: connect to local DB, confirm migration ran, confirm `OnboardingState` row exists for every existing Brand

**Validation map (RFC plan rows covered)**:
- Row 13 (no `@clerk/*` imports outside the impl file) — ESLint
- (DB-level shape only; behavioral validation rows defer to PR 2+)

---

### PR 2 — Auth API: routes + webhook handler

Branch: `feature/170-onboarding-auth-api`

Builds on PR 1's data + abstraction. API-only — no UI.

**Estimated files**: ~9

- [ ] NEW `apps/api/src/routes/auth.ts` (or `auth-onboarding.ts` to avoid colliding with any future `auth.ts`) — registers POST `/api/auth/signup`, GET `/api/auth/oauth/:provider/start`, POST `/api/auth/signup/finish`. **Convention decision**: existing routes are flat under `apps/api/src/routes/` (no subdirectories). Pinning to flat convention; consolidate the three handlers into one route module. Per RFC §4.
- [ ] NEW `apps/api/src/routes/auth.test.ts` — integration tests for each endpoint covering happy path + the failure modes from RFC §10 (rate-limit, partial-failure, email-duplicate, OAuth new-user-without-org).
- [ ] NEW `apps/api/src/routes/identityProviderWebhook.ts` — POST `/api/webhooks/identity-provider`. Verifies signature via `IdentityProvider.parseWebhook`; acts on `organization.created` / `organization.updated` / `organization.deleted` / `user.deleted`. Per RFC §5.
- [ ] NEW `apps/api/src/routes/identityProviderWebhook.test.ts` — tests covering the full webhook table from RFC §5 + signature-rejection (validation row 11).
- [ ] NEW `packages/shared/src/zod/onboarding.ts` — shared Zod schemas (`signupRequestSchema`, `oauthFinishRequestSchema`, plus stubs for the schemas PR 3 will fill in to keep one source of truth). Per RFC §4.1.
- [ ] `apps/api/src/server.ts` (or `app.ts`) — register the two new route modules.
- [ ] NEW `apps/api/src/services/onboarding.ts` (initial slice) — exports `emitActivationStep(brandId, step, metadata?)` helper. Used by `/api/auth/signup` and the webhook handler (`account_created` emission). Full helper implementation (worker re-export) lands in PR 4 / PR 6.

**Validation (PR 2 — API only)**:
- `pnpm test:smoke` + `pnpm test:integration` (auth + webhook routes)
- Manual: trigger a Clerk webhook locally (svix CLI or Clerk dashboard) and confirm 401 on bad signature, 200 on good
- Browser-level signup-flow validation deferred to PR 3 (where the UI lands)

**Validation map**: rows 1 (DB-level), 2 (DB-level), 11 from RFC validation plan.

---

### PR 3 — Signup UI: `/signup`, `/signup/finish`, OAuth button row

Branch: `feature/170-onboarding-signup-ui`

Builds on PR 2's auth API. Web-only — no API changes.

**Estimated files**: ~7

- [ ] NEW `apps/web/src/app/(auth)/signup/page.tsx` — SignupPage server component. Wraps `<SignupForm />` + `<OAuthButtonRow />`.
- [ ] NEW `apps/web/src/app/(auth)/signup/_components/SignupForm.tsx` — react-hook-form + Zod (shared from `packages/shared/src/zod/onboarding`).
- [ ] NEW `apps/web/src/app/(auth)/signup/_components/OAuthButtonRow.tsx` — reads `IdentityProvider.listSupportedOAuthProviders()` server-side, renders client buttons.
- [ ] NEW `apps/web/src/app/(auth)/signup/finish/page.tsx` — OAuth-path convergence form (org-name only, email/name pre-filled from `IdentityProvider.getUser`).
- [ ] `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx` — keep Clerk catch-all (per resolved decision); add `<OAuthButtonRow />` parity only.
- [ ] `apps/web/src/middleware.ts` — handle post-OAuth-redirect: if `getSession` returns `{ userId, orgId: null }` redirect to `/signup/finish`. Per RFC §4 oauth-callback row.
- [ ] NEW `apps/web/test/e2e/signup-paths.spec.ts` — Playwright E2E covering validation rows #1, #2 (signup happy path, OAuth happy path with mocked provider).

**Validation (PR 3 — UI)**:
- `pnpm test:smoke` (component-level if any)
- `pnpm test:e2e -- signup-paths.spec.ts`
- Manual: signup flow in browser end-to-end against a fresh local DB (R18 — full user-flow validation, not API-shortcut)
- UI polish artifact: `docs/evidence/170-ui-polish-validation.md` for `/signup` + `/signup/finish`

**Validation map**: rows 1, 2 (full E2E end-to-end with PR 2's APIs).

---

### PR 4 — Onboarding state API + emit helper + provider-sync queue

Branch: `feature/170-onboarding-state-api`

API + worker only — no UI. Lands the data-mutation surfaces and the cross-app emission helper.

**Estimated files**: ~10

API:
- [ ] NEW `apps/api/src/routes/onboarding.ts` — registers GET `/v1/admin/onboarding/state`, PATCH `/v1/admin/onboarding/profile`, PATCH `/v1/admin/onboarding/checklist`. All Zod-validated. Per RFC §4.
- [ ] NEW `apps/api/src/routes/onboarding.test.ts` — integration tests covering rows #3 (org-profile), #4 (skip-and-add-later), #5 (path picks ×4), #6 (precondition rejection), #7 (full activation sequence) from RFC validation plan.
- [ ] NEW `apps/api/src/routes/adminBrand.ts` — PATCH `/v1/admin/brand`. Updates `Brand.name` locally; enqueues `IdentityProvider.updateOrgName` retry job. Per RFC §4.
- [ ] NEW `apps/api/src/routes/adminBrand.test.ts` — covers row #10 (provider-side update failure → retry queue).
- [ ] `apps/api/src/services/onboarding.ts` — extend `emitActivationStep` with full body (lookup previous event → compute `dwellMs` → insert + idempotent on `(brandId, step)` → also write `AuditEvent`). Per RFC §7.1.
- [ ] `apps/api/src/services/onboarding.test.ts` — helper unit tests including idempotency.
- [ ] `apps/api/src/queues/` (existing pattern — find correct file) — register `onboarding-provider-sync` queue + retry-policy. Used by PATCH `/v1/admin/brand` for provider-name retries. Per RFC §10.
- [ ] `apps/worker/src/processors/onboardingProviderSync.ts` (NEW) + `.test.ts` — worker processor for the queue. Calls `IdentityProvider.updateOrgName`; logs and retries with exponential backoff.
- [ ] `apps/worker/src/queues/definitions.ts` — register the new queue.
- [ ] `packages/shared/src/zod/onboarding.ts` — fill in `onboardingProfilePatchSchema`, `onboardingChecklistPatchSchema`, `brandPatchSchema` (PR 2 shipped the auth ones).
- [ ] `apps/api/src/server.ts` — register the two new route modules.

**Validation (PR 4 — API + worker)**:
- `pnpm test:smoke` + `pnpm test:integration` (onboarding routes + adminBrand route + onboardingProviderSync worker)
- Browser-level admin-flow validation deferred to PR 5 (where the UI lands)

**Validation map**: rows 6 (precondition rejection — API-level), 7 (activation completion — DB-level), 10 (provider failure → retry queue) from RFC validation plan.

---

### PR 5 — Onboarding admin UI: Step 1.5 + use-case picker + checklist widget + dashboard CTAs

Branch: `feature/170-onboarding-admin-ui`

Builds on PR 4's APIs. Web-only — no API changes.

**Estimated files**: ~13

- [ ] NEW `apps/web/src/app/(admin)/admin/onboarding/profile/page.tsx` — Step 1.5 form route.
- [ ] NEW `apps/web/src/app/(admin)/admin/onboarding/_components/OrgProfileForm.tsx` — react-hook-form + Zod; `mode="create"` from #157 CRUD pattern. Includes file-upload for logo.
- [ ] NEW `apps/web/src/app/(admin)/admin/onboarding/_components/ThemePicker.tsx` — 4 default themes + 5th "Custom" swatch (per spec Round 2 fix).
- [ ] NEW `apps/web/src/app/(admin)/admin/onboarding/_components/ThemePreviewPanel.tsx` — real-time preview using existing `Theme` model.
- [ ] NEW `apps/web/src/app/(admin)/admin/onboarding/page.tsx` — Use-case picker route.
- [ ] NEW `apps/web/src/app/(admin)/admin/onboarding/_components/UseCasePicker.tsx` — 3 cards + skip + cohort hint reading `Brand.sizeCategory`.
- [ ] NEW `apps/web/src/components/onboarding/FirstRunChecklistWidget.tsx` — per RFC §6.1 (3 sub-states for row 5; aria attrs; collapse/dismiss).
- [ ] NEW `apps/web/src/lib/hooks/useOnboardingChecklist.ts` — SWR + optimistic updates.
- [ ] `apps/web/src/app/(admin)/admin/page.tsx` — modify: render `<FirstRunChecklistWidget />` at top; pass `archetype` prop to `<CXHealthPanel />` and `<LoyaltyHealthPanel />`. Per RFC §8.
- [ ] (`apps/web/src/app/(admin)/admin/_components/CXHealthPanel.tsx` and `LoyaltyHealthPanel.tsx` — modify: archetype-aware empty-state CTAs) — verify exact paths during implementation; the existing dashboard implementation may need to be located.
- [ ] NEW `apps/web/test/e2e/onboarding-admin-flow.spec.ts` — E2E covering rows #3, #5, #7, #8 (Step 1.5 happy path; picker for each archetype; activation completion; archetype-aware dashboard CTA).

**Validation (PR 5 — UI)**:
- `pnpm test:e2e -- onboarding-admin-flow.spec.ts`
- Manual browser walk-through: signup (from PR 3) → Step 1.5 → picker → land on `/admin` and confirm widget renders + dashboard CTAs match the picked path
- UI polish artifact updated for `/admin/onboarding/*` and the `/admin` widget

**Validation map**: rows 3, 4, 5, 7 (UX-level), 8 from RFC validation plan.

---

### PR 6 — Step instrumentation + GDPR cascade + internal funnel

Branch: `feature/170-onboarding-instrumentation-and-funnel`

Final wiring layer. Cross-cutting — touches existing route handlers, worker processors, and adds the internal-only surface.

**Estimated files**: ~12

Step emission additions to existing handlers:
- [ ] `apps/api/src/routes/events.ts` — at end of successful event-ingest, call `emitActivationStep(brandId, 'first_event_received')` if not already emitted. Idempotent. Per RFC §7.
- [ ] `apps/api/src/routes/events.test.ts` — extend with assertion that emission fires once on first event, not on subsequent.
- [ ] `apps/api/src/routes/surveys.ts` — on survey transition to `status: 'live'`, call `emitActivationStep(brandId, 'first_survey_published')`.
- [ ] `apps/api/src/routes/surveys.test.ts` — extend.
- [ ] `apps/api/src/routes/programs.ts` — on first program creation, call `emitActivationStep(brandId, 'program_created')`.
- [ ] (`apps/api/src/routes/programs.test.ts`) — currently no `programs.test.ts` file in glob; verify whether tests live elsewhere or need to be added.
- [ ] `apps/worker/src/processors/campaignTriggers.ts` — on first action triggered for a Brand, call `emitActivationStep(brandId, 'first_action_triggered')`. Cross-app emission. Per RFC §7 + Confidence-level note.
- [ ] `apps/worker/src/processors/campaignTriggers.test.ts` — extend.
- [ ] NEW `packages/shared/src/onboarding/emit-activation-step.ts` — extract the helper from `apps/api/src/services/onboarding.ts` so the worker can import it. The api-side service becomes a re-export. Per RFC §7.1.

GDPR cascade:
- [ ] `apps/worker/src/processors/erasure.ts` — **uncertainty**: RFC §9 references this file as "existing" but it does not appear in the worker glob. Verify during PR 4 implementation: it may live under a different name (e.g., processor in another file) or may genuinely need to be created. Action items added on top of whatever exists per RFC §9: delete `OnboardingActivationEvent` rows; rely on cascade for `OnboardingState`; delete logo from object storage; call `IdentityProvider.deleteUser` + `deleteOrg`; emit `AuditEvent` for the erasure.
- [ ] `apps/worker/src/processors/erasure.test.ts` — covers row #12 from RFC validation plan.

Internal funnel:
- [ ] NEW `apps/api/src/routes/onboardingFunnel.ts` — GET `/v1/admin/internal/onboarding-funnel`. Aggregation query against `OnboardingActivationEvent`. Gated behind feature flag `INTERNAL_ANALYTICS_ENABLED`. Per RFC §4 + §11.2.
- [ ] NEW `apps/api/src/routes/onboardingFunnel.test.ts` — covers row #19 (funnel query latency p99 < 1s for 1k brands × 9 events).
- [ ] NEW `apps/web/src/app/(admin)/admin/internal/onboarding-funnel/page.tsx` — page route, gated.
- [ ] NEW `apps/web/src/components/onboarding/OnboardingFunnelChart.tsx` — chart component.
- [ ] `apps/web/src/middleware.ts` — extend: return 404 for `/admin/internal/*` when `INTERNAL_ANALYTICS_ENABLED` is unset/false. Per RFC §11.2.
- [ ] `apps/api/src/server.ts` — register the funnel route.

**Validation**:
- `pnpm test:smoke` + `pnpm test:integration` (cross-app emission, erasure cascade, funnel aggregation)
- `pnpm test:e2e` for any flow that crosses the new emission paths
- Manual: send an event for a Brand mid-onboarding, verify `first_event_received` flips on `OnboardingState`
- Manual: trigger erasure on a test Brand, verify cascade
- Performance: run a seed of 1k brands × 9 events, time the funnel query (validation row #19)

**Validation map**: rows 9, 12, 14, 19 from RFC validation plan.

---

### Cross-cutting (after all 4 PRs merge)

- [ ] Performance check on `/v1/admin/internal/onboarding-funnel` against a larger seed (validation row 19, post-merge).
- [ ] Webhook latency check (validation row 18) — measured via API observability dashboards post-deploy.
- [ ] Pricing-strategy job revisit-point reminder — when pricing model is finalized, the schema (`Brand.planTier` or whatever shape) and Step 0 UI both need to land. Tracked via `project_pricing_not_finalized.md` memory.

---

## Open Questions / Deferrals

1. ~~**Subdirectory convention for new API routes**~~ — **RESOLVED 2026-04-27**: stay flat under `apps/api/src/routes/` per existing convention. Single-file route modules per concern.
2. **`apps/worker/src/processors/erasure.ts` existence** — RFC references it as existing; not present in current glob. Verify location during PR 6; if it genuinely doesn't exist, the GDPR cascade is greenfield and the PR scope expands by 1 file (acceptable).
3. ~~**Sign-in page strategy**~~ — **RESOLVED 2026-04-27**: keep Clerk's catch-all `[[...sign-in]]/page.tsx`; add `<OAuthButtonRow />` parity only.
4. **Programs route test coverage** — `apps/api/src/routes/programs.ts` exists but no `programs.test.ts` in current glob. PR 6 either adds the test (preferred per R9 P0 coverage) or finds existing coverage in another path.
5. **Existing dashboard panel paths** — RFC §8 mutates `<CXHealthPanel />` and `<LoyaltyHealthPanel />`. Exact file locations to be confirmed in PR 5 implementation.

---

## Phase Tracking (FRAIM job phases for this implementation)

Phase 1 (`implement-scoping`): complete — this document.
Phase 2 (`implement-repro`): N/A (feature, not bug).
Phases 3–13: per-PR. Each of the 6 PRs above runs the same Phase 3 → Phase 13 sub-cycle. Architecture-doc updates + ADR 0004 (Phase 10) bundled with PR 1 per resolved decision.
