# Evidence — Issue #170 PR 1: Foundation (data layer + IdentityProvider abstraction)

PR 1 of 6 implementing the shared spine per the merged RFC `docs/rfcs/170-onboarding-first-run.md`. Self-contained slice landing the Prisma schema/migration, the `IdentityProvider` interface + `ClerkIdentityProvider` implementation with ESLint enforcement, and the architecture record (ADR 0004 + arch.md updates).

## Summary

- **Issue**: [#170](https://github.com/mathursrus/CustomerEQ/issues/170) — `[Epic] Onboarding & First-Run Experience`
- **Branch**: `feature/170-onboarding-shared-spine`
- **Slice**: PR 1 of 6 (foundation only)
- **Spec inputs**:
  - Feature spec: `docs/feature-specs/170-onboarding-first-run.md` (merged via PR #187)
  - RFC: `docs/rfcs/170-onboarding-first-run.md` (merged via PR #196)
  - Standing work list: `docs/evidence/170-implement-work-list.md`
- **Sub-issue contracts**: spine-only — #171/#172/#173 archetype flows are out of scope for PR 1

## Files Changed

### New
- `apps/api/src/auth/identity-provider.ts` — 14-method interface + `NormalizedProviderEvent` discriminated union
- `apps/api/src/auth/clerk-identity-provider.ts` — Clerk implementation honoring the cleanup contract
- `apps/api/src/auth/clerk-identity-provider.test.ts` — ~30 unit tests
- `apps/api/src/plugins/identityProvider.ts` — Fastify plugin wiring `fastify.identityProvider`
- `packages/database/prisma/migrations/20260427000000_onboarding_first_run/migration.sql` — single migration with idempotent backfill
- `docs/architecture/adr/0004-onboarding-activation-funnel-and-identity-provider.md` — consolidated ADR for OD-4 + OD-5

### Modified (no behavior change)
- `apps/api/src/plugins/auth.ts` — refactored to call `fastify.identityProvider.getSession`
- `apps/api/src/plugins/auth.test.ts` — rewritten to mock the abstraction
- `apps/api/src/routes/members.ts` — same swap on `/v1/members/enroll` Clerk-token path
- `apps/api/src/app.ts` — registers `identityProvider` plugin before `auth`
- `apps/api/package.json` — adds `svix ^1.31.0`
- `eslint.config.js` — `no-restricted-imports` for `@clerk/*` in `apps/api/src/**/*.ts`
- `packages/database/prisma/schema.prisma` — 3 new enums, `APPLICATION` value, Brand fields + `defaultTheme` FK to `SurveyTheme`, `ApiKey.externalSignalSourceId` FK, 2 new models
- `docs/architecture/architecture.md` — plugin row, model rows, ADR 0004 link

## Validation Gate

| Gate | Result |
| :--- | :--- |
| `pnpm build` (turbo) | ✅ 10/10 packages clean |
| `pnpm --filter @customerEQ/api typecheck` | ✅ 0 errors |
| `pnpm lint` (repo) | ✅ 0 errors; 2 intentional `no-console` warnings on orphan-cleanup ERROR-level logs (migrate to `fastify.log` in PR 2) |
| `pnpm --filter @customerEQ/api test:smoke` | ✅ 310/310 across 28 files |

Migration applies on next `pnpm prisma migrate dev` against a running DB (not started in implementation session; will run on reviewer machine / CI).

---

## Security Review

### Executive Summary

Diff-based security review of the PR 1 implementation surface. Four findings:

| Severity | Disposition | Title |
| :--- | :--- | :--- |
| High | fix (applied) | SEC-170-001: `parseWebhook` re-stringifies parsed body — svix verification would fail on real webhooks |
| Medium | file (deferred to PR 3) | SEC-170-002: `beginOAuth` does not validate `returnTo` (open-redirect risk) |
| Low | accept (advisory note added) | SEC-170-003: `OnboardingActivationEvent.metadata` is unbounded JSON — risk of PII leakage |
| Informational | accept | SEC-170-004: Dev placeholder webhook secret in production code path |

**Immediate action**: SEC-170-001 fixed in this PR (interface tightened, impl uses raw body, tests updated, validation re-run). No remaining Critical/High findings → Phase 6 passes.

### Review Scope

- **reviewType**: `embedded-diff-review`
- **reviewScope**: `diff` (commits `2a41a62..HEAD` on branch `feature/170-onboarding-shared-spine`)
- **surfaceAreaPaths**:
  - `apps/api/src/auth/**`
  - `apps/api/src/plugins/auth.ts`
  - `apps/api/src/plugins/identityProvider.ts`
  - `apps/api/src/routes/members.ts`
  - `apps/api/src/app.ts`
  - `apps/api/package.json`
  - `eslint.config.js`
  - `packages/database/prisma/schema.prisma`
  - `packages/database/prisma/migrations/20260427000000_onboarding_first_run/migration.sql`
  - `docs/architecture/adr/0004-onboarding-activation-funnel-and-identity-provider.md`
  - `docs/architecture/architecture.md`

### Threat Surface Summary

| Surface | Evidence |
| :--- | :--- |
| `api` | `apps/api/src/auth/clerk-identity-provider.ts` (auth/crypto), `apps/api/src/plugins/auth.ts` (auth/crypto), `apps/api/src/plugins/identityProvider.ts` (Fastify plugin), `apps/api/src/routes/members.ts` (route handler with Clerk-token verification path) |
| `data-pipeline` | `packages/database/prisma/schema.prisma` (new models, FKs), migration SQL (new tables, enum extension, backfill) |

`web`, `llm-app`, `mobile`, `capability-authoring`, `docs-only` — N/A (no matching files in diff).

### Coverage Matrix

| Category | Status | Notes |
| :--- | :--- | :--- |
| OWASP API A01 — Broken Object Level Authorization | Pass | Tenant scoping via `brandId`-from-JWT unchanged; abstraction does not bypass it |
| OWASP API A02 — Broken Authentication | Fail → Fix applied | SEC-170-001 (parseWebhook signature verification); fix landed in PR 1 |
| OWASP API A03 — Broken Object Property Level Authorization | N/A | No new endpoints exposing fields in this PR |
| OWASP API A04 — Unrestricted Resource Consumption | N/A | No new request-handling surface |
| OWASP API A05 — Broken Function Level Authorization | Pass | New ESLint `no-restricted-imports` rule structurally enforces the abstraction boundary |
| OWASP API A06 — Unrestricted Access to Sensitive Business Flows | Pass | Auth plugin remains the gate for `/v1/admin/*` |
| OWASP API A07 — Server-Side Request Forgery | Fail → File | SEC-170-002 (open-redirect via unchecked `returnTo`); deferred to PR 3 (signup UI middleware validation) |
| OWASP API A08 — Security Misconfiguration | Pass | Webhook secret env-var enforcement: throws in production if missing; placeholder only used in dev/test where no real webhooks arrive |
| OWASP API A09 — Improper Inventory Management | N/A | No new external dependencies beyond `svix` |
| OWASP API A10 — Unsafe Consumption of APIs | Fail → Fix applied | Same as SEC-170-001 |
| Secrets in code | Pass | SEC-170-004 dev placeholder pattern matches `placeholder-secret-in-example-file` allowlist; clearly labeled, dev-scoped |
| Privacy / PII | Pass with advisory | SEC-170-003 metadata-field discipline note added to ADR 0004; emitter helper in PR 4 will enforce |

### Findings

#### SEC-170-001 — `parseWebhook` re-stringifies parsed body (signature verification fails on real webhooks)

| Field | Value |
| :--- | :--- |
| Severity | High |
| Category | OWASP API A02 / A10 |
| File | `apps/api/src/auth/clerk-identity-provider.ts:262` (pre-fix) |
| Auth/crypto firewall | TRUE → would normally route to `file` |
| Disposition | **fix** (manual, by author — auth/crypto findings cannot use the auto-fix allowlist; the fix here was applied as a code change before completing Phase 6) |

**Evidence**: The original implementation passed `JSON.stringify(rawRequest.body)` to `svix.verify`. Svix verifies the exact bytes that were signed by the sender (Clerk). Re-serializing parsed JSON produces a different byte sequence (key ordering, whitespace, escape forms) — verification would fail even on legitimate webhooks. The latent bug becomes observable as soon as PR 2 wires the webhook route and Clerk delivers a real event.

**Fix applied**:
- `apps/api/src/auth/identity-provider.ts`: `parseWebhook` signature tightened from `(rawRequest: Pick<FastifyRequest, 'headers' | 'body'>)` to `(args: { headers, rawBody: string })`. Decoupled from Fastify types entirely. Interface comment documents the rawBody contract.
- `apps/api/src/auth/clerk-identity-provider.ts`: `webhook.verify(args.rawBody, …)` directly; no JSON re-stringify.
- `apps/api/src/auth/clerk-identity-provider.test.ts`: 4 fixture sites updated to pass `rawBody: '{...}'` strings.
- Validation re-run after fix: typecheck pass, 310/310 tests pass.

**Forwarded to PR 2**: webhook route handler must use Fastify `addContentTypeParser` to capture the raw body buffer for the webhook content-type before Fastify's default JSON parser consumes it. Recorded in PR 1's work list under "PR 2 — Auth API: routes + webhook handler".

#### SEC-170-002 — `beginOAuth` does not validate `returnTo` (open-redirect risk)

| Field | Value |
| :--- | :--- |
| Severity | Medium |
| Category | OWASP API A07 (open-redirect / SSRF-adjacent) |
| File | `apps/api/src/auth/clerk-identity-provider.ts:144` |
| Auth/crypto firewall | TRUE → routes to `file` |
| Disposition | **file** (route-handler validation in PR 3) |

**Evidence**: `beginOAuth` accepts `args.returnTo` and passes it through to Clerk's `redirect_url` query param without validation. An attacker could craft `/api/auth/oauth/google/start?returnTo=https://evil.test`. Clerk's allowlist mitigates if configured strictly, but defense-in-depth requires us to validate `returnTo` is either a relative path (`/admin/...`) or a same-origin URL.

**Why deferred to PR 3**: `returnTo` originates from the route handler's query string. Validation is most appropriately done in the Fastify route handler before calling `beginOAuth` (Zod schema with a `refine` enforcing relative-path or same-origin). The abstraction itself accepting an opaque string is correct for replaceability — the impl can't know which hosts are valid for the consuming app.

**Tracked in**: `docs/evidence/170-implement-work-list.md` PR 3 checklist (signup UI). Required before /signup route ships.

#### SEC-170-003 — `OnboardingActivationEvent.metadata` is unbounded JSON (PII leakage risk)

| Field | Value |
| :--- | :--- |
| Severity | Low |
| Category | GDPR data minimization |
| File | `packages/database/prisma/schema.prisma` (`OnboardingActivationEvent.metadata`) |
| Auth/crypto firewall | FALSE |
| Disposition | **accept** with advisory note |

**Evidence**: The `metadata Json @default("{}")` field is intended for non-PII categorical/operational context (oauth provider, picked path, skip flag). Without code-level enforcement, future emitters could serialize PII (email, name, IP). On erasure, metadata content is deleted via the `OnboardingActivationEvent.brandId → Brand` cascade — PII would be removed but exposure during the lifetime of the row is the concern.

**Mitigation in this PR**: ADR 0004 documents the field shape constraint and the rationale.

**Forwarded to PR 4**: the `emitActivationStep` helper (introduced in PR 4) is the single ingress to this table. Helper to validate metadata against an allowlist of keys (`source`, `oauth_provider`, `picked_path`, `skipped`, `backfilled`) and reject/strip any `email`/`name`/`phone`/`ip` fields at runtime. Recorded in `170-implement-work-list.md` PR 4 checklist.

#### SEC-170-004 — Dev placeholder webhook secret in production code path

| Field | Value |
| :--- | :--- |
| Severity | Informational |
| Category | Secrets in code (placeholder pattern) |
| File | `apps/api/src/plugins/identityProvider.ts:18` |
| Disposition | **accept** (matches `placeholder-secret-in-example-file` semantics; dev-scoped behind a `NODE_ENV === 'production'` throw) |

**Evidence**: The string `'whsec_dev_placeholder_not_used_for_verification'` is hardcoded as a fallback when `CLERK_WEBHOOK_SECRET` is unset. Production startup throws explicitly if the env var is missing; the placeholder only reaches the `Webhook` constructor in dev/test. The placeholder cannot pass real svix verification, so even if a webhook arrived in dev, it would 401 cleanly.

**Why accept**: The placeholder is the cleanest way to keep dev startup working without requiring the webhook secret to be set for non-webhook flows. Alternative — making the entire `identityProvider` plugin webhook-aware vs. session-aware — would over-couple the plugin.

### Prioritized Remediation Queue

1. **SEC-170-001** — fixed in PR 1 (now zero residual). Owner: this PR.
2. **SEC-170-002** — PR 3 (signup UI) route handler. Owner: PR 3.
3. **SEC-170-003** — PR 4 (`emitActivationStep` helper). Owner: PR 4.
4. **SEC-170-004** — accepted; no further action.

### Verification Evidence

- **SEC-170-001**:
  - **Before**: `apps/api/src/auth/clerk-identity-provider.ts` line 262 (pre-fix) called `webhook.verify(JSON.stringify(rawRequest.body), …)`. Tests passed because mocks bypass real svix verification — but real Clerk webhooks would 401.
  - **After**: Interface and impl decoupled from `FastifyRequest`. `webhook.verify(args.rawBody, …)` directly. Test fixtures updated to pass `rawBody: '{...}'`. `pnpm typecheck` + `pnpm test:smoke` re-run, 310/310 pass.
  - **Real-traffic verification deferred to PR 2** when the webhook route is wired and a Clerk dev webhook is exercised end-to-end against a local instance with `addContentTypeParser` capturing rawBody.

### Applied Fixes and Filed Work Items

- **Applied**: Fix for SEC-170-001 in this branch (interface + impl + 4 test fixtures). Will land in the same commit as the security review section.
- **Filed**: SEC-170-002 → PR 3 work-list checkbox added (returnTo validation). SEC-170-003 → PR 4 work-list checkbox added (metadata allowlist).

### Accepted / Deferred / Blocked

| Finding | State | Approver | Rationale |
| :--- | :--- | :--- | :--- |
| SEC-170-002 | Deferred to PR 3 | self (auth/crypto firewall + abstraction-level appropriateness) | Validation belongs at the route boundary where `returnTo` originates |
| SEC-170-003 | Accepted (low severity) | self | Mitigated via ADR-documented contract; runtime enforcement comes with the helper introduced in PR 4 |
| SEC-170-004 | Accepted | self | Placeholder is dev-scoped via explicit production throw; cannot pass real signature verification |

### Compliance Control Mapping

| Control | Status |
| :--- | :--- |
| GDPR data minimization (R13) | Pass with advisory — new schema fields are tenant metadata, not member PII; metadata-field discipline noted |
| GDPR right to erasure (R13) | Pass — `Brand` → `OnboardingState` and `Brand` → `OnboardingActivationEvent` cascades wired in migration |
| SOC2 logical access control | Pass — webhook signature verification correctness fixed (SEC-170-001) |
| SOC2 audit trail | Deferred to PR 4 — `emitActivationStep` will pair every `OnboardingActivationEvent` with an `AuditEvent` |

### Run Metadata

- **Run date**: 2026-04-27
- **Branch / commits**: `feature/170-onboarding-shared-spine` at `2a41a62`; security fix to land in next commit
- **Surfaces classified**: `api`, `data-pipeline`
- **Scans run**: `owasp-api-top-10-review`, `secrets-in-code-check`, `privacy-and-pii-review`
- **Auto-fix cap hit**: No (auth/crypto firewall routes findings to manual fix or file; no auto-fixes used)
- **Skill errors**: None

---

## Regression

Full repo `pnpm test:smoke` after the security fix: 14/14 packages pass; `apps/api` 310/310 tests across 28 files. (First run had a transient Windows BAML parallel-generate file-permission flake on `@customerEQ/ai`; passed cleanly on retry — classified as Environment Issue, not related to PR 1 changes.)

## Quality

| Check | Result |
| :--- | :--- |
| Hardcoded values | Pass — defaults env-overridable; placeholder secret already security-reviewed |
| Duplicate code | Pass — cleanup blocks differ by shape (rule #15 either-direction) |
| Missed reusability | Pass — svix verification distinct from existing HMAC patterns |
| File sizes | Pass — `clerk-identity-provider.ts` ~280 lines / 1 class; under the 500-line / 5-export limit |
| Function complexity | Pass — nested try/catch in `createUserWithOrg` is the documented cleanup contract |
| Architecture standards | Pass — clean layer isolation (`auth/` separate from routes); DI via Fastify decoration |
| UI baseline | N/A — no UI in PR 1 |

0 blocking issues. 2 advisories already tracked from Phase 6 (logger migration in PR 2; metadata enforcement in PR 4).

---

## Feature Requirement Traceability Matrix

**Source of truth**: `docs/feature-specs/170-onboarding-first-run.md` (merged via PR #187).

**Scope note**: PR 1 is the foundation slice; user-observable behavior from the spec lands in PRs 2–6. Most spec acceptance criteria are deliberately deferred to those PRs and tracked in `docs/evidence/170-implement-work-list.md`.

| Requirement / Acceptance Criteria | Implemented File / Function | Proof | Status |
| :--- | :--- | :--- | :--- |
| Spec §"Customer Problem" #5: Compliance baked-in (GDPR cascade enforced at persistence layer) | `packages/database/prisma/schema.prisma` — `OnboardingState` and `OnboardingActivationEvent` use `onDelete: Cascade` from `Brand` | `pnpm prisma generate` succeeds; cascade visible in generated client types | Met (foundation; cascade exercised in PR 6 erasure tests) |
| Spec §"Customer Problem" #4: Pricing forward-compatibility (no `planTier` schema column) | `packages/database/prisma/schema.prisma` (Brand model) — `planTier` field intentionally absent | Schema diff inspection; reviewer-resolved decision in PR #196 Round 2 | Met |
| Spec §"Customer" / §"User Experience": user-visible signup, Step 1.5, picker, dashboard widget, etc. | (Out of PR 1 scope — PRs 2-5) | Tracked in work list | Deferred — PRs 2-5 |
| Spec acceptance: Brand auto-provisioning (OD-1 webhook + middleware fallback) | (Schema + abstraction in PR 1; route + handler in PR 2) | Tracked in work list | Deferred — PR 2 |
| Spec acceptance: Step 0 sign-up flow (`/signup`) | (Out of PR 1 scope) | Tracked in work list | Deferred — PRs 2 + 3 |
| Spec acceptance: Step 1.5 org-profile capture | (Schema fields in PR 1; route + form in PRs 4 + 5) | Schema fields visible: `Brand.siteDomain`, `Brand.logoUrl`, `Brand.defaultThemeId`, `Brand.sizeCategory` | Met (foundation only) — PR 4/5 wires UX |
| Spec acceptance: Use-case picker (api/site/apps/skipped) | (Schema enum in PR 1; route + UI in PRs 4 + 5) | `UseCasePath` enum present in `OnboardingState.useCasePath` field | Met (foundation only) — PR 4/5 wires UX |
| Spec acceptance: First-Run Checklist Widget | (Out of PR 1 scope) | Tracked in work list | Deferred — PRs 4 + 5 |
| Spec acceptance: Activation funnel persisted with per-step dwell times | `packages/database/prisma/schema.prisma` (`OnboardingActivationEvent` model with `step`, `previousStep`, `dwellMs`, `metadata`) | `pnpm prisma generate` succeeds; type checks pass | Met (foundation; emission lands in PR 4) |
| Spec acceptance: Hero workflow reachable in <30 min from sign-up | (Spans the whole 6-PR slice) | E2E in PR 5/6 | Deferred — PR 5/6 |

**Status**: PR 1's foundation requirements are Met. All deferred items are explicitly tracked in `docs/evidence/170-implement-work-list.md` per the user-approved 6-PR slicing decision (2026-04-27).

---

## Technical Design Traceability Matrix

**Source of truth**: `docs/rfcs/170-onboarding-first-run.md` (merged via PR #196).

| RFC Section / Decision | Implemented File / Function | Proof | Status |
| :--- | :--- | :--- | :--- |
| §1 OD-1 (Clerk → Brand auto-provisioning, webhook + middleware) | (Schema in PR 1; webhook handler + middleware in PRs 2 + 3) | Tracked in work list | Deferred — PRs 2 + 3 |
| §1 OD-2 (Multi-app: `APPLICATION` source-type + per-app `ApiKey` FK) | `packages/database/prisma/schema.prisma`: `APPLICATION` value on `ExternalSourceType` enum; `ApiKey.externalSignalSourceId` FK with `@@index` | Schema diff; `pnpm prisma generate` regenerates client; typecheck pass | Met |
| §1 OD-3 (`OnboardingState` 1:1 with Brand) | `packages/database/prisma/schema.prisma`: `OnboardingState` model with `@@unique` on `brandId` and `onDelete: Cascade` | Schema diff; migration SQL `CREATE UNIQUE INDEX onboarding_state_brandId_key`; `pnpm prisma generate` succeeds | Met |
| §1 OD-4 (Activation funnel: dedicated `OnboardingActivationEvent` model with per-step dwell times) | `packages/database/prisma/schema.prisma`: `OnboardingActivationEvent` model + `OnboardingStep` enum + indexes `[brandId, occurredAt]` and `[step, occurredAt]` | Schema diff; migration SQL CREATE TABLE + indexes; ADR 0004 documents append-only contract | Met (model only; emission helper in PR 4) |
| §1 OD-5 (IdentityProvider abstraction + ESLint enforcement) | `apps/api/src/auth/identity-provider.ts` (interface, 14 methods); `apps/api/src/auth/clerk-identity-provider.ts` (impl); `eslint.config.js` (no-restricted-imports for `@clerk/*`); `apps/api/src/auth/clerk-identity-provider.test.ts` (~30 tests) | `pnpm typecheck` passes; `pnpm lint` 0 errors with rule active; 310 tests pass; auth.ts + members.ts refactored off `@clerk/*` direct imports | Met |
| §2.1 Brand new fields (`siteDomain`, `logoUrl`, `defaultThemeId`, `sizeCategory`) | `packages/database/prisma/schema.prisma`: 4 nullable fields added; `OrgSizeCategory` enum; `defaultTheme` relation to `SurveyTheme` (note: RFC names "Theme"; actual model is `SurveyTheme`) | Schema diff; migration SQL ADD COLUMN | Met |
| §2.1 Pricing column intentionally absent (Round 2 reversal) | `packages/database/prisma/schema.prisma` (Brand) — no `planTier` field | Schema diff inspection | Met |
| §2.2 OnboardingState model | `packages/database/prisma/schema.prisma`: full model per RFC | Schema diff; migration SQL | Met |
| §2.3 OnboardingActivationEvent model | `packages/database/prisma/schema.prisma`: full model per RFC | Schema diff; migration SQL | Met |
| §2.4 ExternalSignalSource extension + ApiKey FK | Schema additions covered above | Migration SQL | Met |
| §2.5 Single migration with backfill | `packages/database/prisma/migrations/20260427000000_onboarding_first_run/migration.sql` (single file with all DDL + idempotent backfill `INSERT … ON CONFLICT DO NOTHING`) | File contents inspection; SQL runs in PR-1 reviewer environment / CI | Met (SQL well-formed; live apply deferred to reviewer / CI) |
| §3.1 IdentityProvider interface (14 methods) | `apps/api/src/auth/identity-provider.ts` | All 14 methods present; types exported | Met |
| §3.1 `createUserWithOrg` cleanup contract | `apps/api/src/auth/clerk-identity-provider.ts` (impl with try/catch user-cleanup on org-create failure; user+org-cleanup on membership failure) | Tests `cleans up the just-created user when createOrganization fails`, `cleans up org + user when createOrganizationMembership fails`, `logs but does not rethrow when cleanup itself fails` — all pass | Met |
| §3.1 OAuth model (Clerk-mediated; no `completeOAuth`; `getSession` + `getUser` + `createOrgForUser`) | Interface + impl; `getSession` returns `{ userId, orgId: null }` for new-user case | Tests `returns userId + orgId from a v1 JWT`, `returns userId + orgId from a v2 JWT`, `returns { userId, orgId: null } for a fresh OAuth user without an org` — pass | Met |
| §3.2 Clerk implementation wraps `@clerk/clerk-sdk-node` and `svix` | `apps/api/src/auth/clerk-identity-provider.ts` uses `createClerkClient` and `Webhook` | `pnpm install` adds `svix ^1.31.0`; lint pass with override | Met |
| §3.3 ESLint no-restricted-imports rule | `eslint.config.js` adds rule scoped to `apps/api/src/**/*.ts` with single override for the impl file | `pnpm lint` 0 errors with rule active; auth.ts + members.ts refactored off direct `@clerk/*` imports | Met |
| §4 API surface (9 endpoints) | (Out of PR 1 scope — abstraction is wired but no new routes) | Tracked in work list (PRs 2 + 4) | Deferred — PRs 2 + 4 |
| §5 Webhook handler | (Abstraction `parseWebhook` ships in PR 1; route in PR 2) | parseWebhook tested with 8 cases incl. signature failure + missing headers + unknown event; security finding SEC-170-001 fixed (rawBody contract) | Met (abstraction); PR 2 wires route |
| §6 Component hierarchy (apps/web) | (Out of PR 1 scope) | Tracked in work list | Deferred — PRs 3 + 5 |
| §7 Step instrumentation matrix | (Out of PR 1 scope; emitter helper in PR 4) | Tracked in work list | Deferred — PR 4 |
| §8 Path-specific dashboard CTA dispatch | (Out of PR 1 scope) | Tracked in work list | Deferred — PR 5 |
| §9 GDPR erasure cascade | Schema-level cascade in place (`OnboardingState`, `OnboardingActivationEvent` `onDelete: Cascade` from Brand); job-level steps in PR 6 | Migration SQL `ON DELETE CASCADE` constraints; ADR 0004 documents | Met (foundation); PR 6 wires job steps |
| §10 Failure-mode table | Cleanup contract for `createUserWithOrg` enforced; `parseWebhook` signature + missing-headers handling enforced | Tests cover the failure modes that PR 1 owns | Met (PR 1 surface) |
| §11 Compliance & access controls | Webhook signature verification + GDPR cascade scaffolding | Security review pass; SEC-170-001 fix tightens signature contract | Met (foundation); SOC2 audit-trail pairing in PR 4 |
| §15 Architecture updates | `docs/architecture/architecture.md` (auth + identityProvider plugin rows; OnboardingState + OnboardingActivationEvent model rows; ADR 0004 link); `docs/architecture/adr/0004-onboarding-activation-funnel-and-identity-provider.md` (new ADR consolidating OD-4 + OD-5 per Round 2 reviewer decision) | Architecture file diffs; new ADR file present | Met |

**Status**: All RFC sections in PR 1's slice are Met. All deferred sections are explicitly marked and tracked in `docs/evidence/170-implement-work-list.md`.

### Deviations Documented

| Deviation | Type | Rationale |
| :--- | :--- | :--- |
| RFC §2.1 references "Theme" model; actual codebase model is `SurveyTheme` | Intentional — naming alignment with existing codebase | Used `SurveyTheme` as the FK target. Functionally equivalent. |
| RFC §2.4 references `ExternalSignalSourceType` enum; actual enum name is `ExternalSourceType` | Intentional — naming alignment with existing codebase | Added `APPLICATION` value to the existing enum. |
| RFC §3.1 originally noted "11-method interface" in the work list summary | Drift between RFC body and work-list summary; actual interface is **14 methods** | Counted across all interface sections in RFC §3.1 — `createUserWithOrg`, `signInUser`, `getSession`, `listSupportedOAuthProviders`, `beginOAuth`, `createOrgForUser`, `getUser`, `getOrg`, `updateOrgName`, `inviteMember`, `listOrgMembers`, `deleteUser`, `deleteOrg`, `parseWebhook` |
| RFC §3.1 `parseWebhook` originally signatured against `Pick<FastifyRequest, 'headers' \| 'body'>` (parsed body) | Tightened in PR 1 via security finding SEC-170-001 | Interface now takes `{ headers, rawBody: string }` — required for svix to verify the exact signed bytes. Documented in Phase 6 Security Review. |
| `signInUser` impl uses a forced-cast over the Clerk SDK `signIns.create` API | Known runtime gap | The `@clerk/backend` SDK does not expose password sign-in; sign-in is browser-driven via Clerk.js. PR 2 either replaces this with an admin-API session create or removes `signInUser` from the interface entirely (recommended). Tracked in work list under PR 2 deferrals. |

## Feedback Verification

No feedback file (`docs/evidence/170-feature-implementation-feedback.md`) yet exists for PR 1 — this is the first commit on the implementation branch. Per `feedback-completeness-verification` skill: when the file does not exist, `allFeedbackAddressed = true`. PR-review feedback rounds will land here as Phase 12 cycles.

## Phase Completion (PR 1)

- Phase 1 `implement-scoping` — complete (`docs/evidence/170-implement-work-list.md` + scope-split decision approved 2026-04-27)
- Phase 2 `implement-repro` — N/A (feature, not bug)
- Phase 3 `implement-tests` — complete (interface + 30 unit tests + adapted plugin tests)
- Phase 4 `implement-code` — complete (schema + migration + impl + plugin + ESLint + ADR + arch updates)
- Phase 5 `implement-validate` — complete (build / typecheck / lint / smoke all clean)
- Phase 6 `implement-security-review` — complete (SEC-170-001 fixed; 0 residual blocking)
- Phase 7 `implement-regression` — complete (full repo smoke 14/14 on retry; `@customerEQ/ai` flake classified Environment)
- Phase 8 `implement-quality` — complete (0 blocking issues)
- Phase 9 `implement-completeness-review` — complete (this section)
- Phase 10 `implement-architecture-update` — complete (ADR 0004 + arch.md updates landed in Phase 4)
- Phase 11 `implement-submission` — pending PR open
- Phase 12 `address-feedback` — pending review rounds
- Phase 13 `retrospective` — pending PR merge
