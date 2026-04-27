# ADR 0004 — Onboarding Activation Funnel + IdentityProvider Abstraction

**Status**: Accepted
**Date**: 2026-04-27
**Deciders**: CustomerEQ engineering, reviewer (PR #196)
**Establishing context**: Issue #170 — Onboarding & First-Run Experience epic
**Related RFC**: `docs/rfcs/170-onboarding-first-run.md`

---

## Context

Issue #170 introduces the shared spine for self-serve onboarding. Two cross-cutting decisions surfaced during design (OD-4 and OD-5 in the RFC) that warrant explicit architectural records because they shape every subsequent feature in the area:

1. **How do we measure onboarding success?** The spec needs a per-step funnel — *where* admins drop off, not just whether they activate. A single TTFV value or a flat boolean column on `Brand` would lose the temporal data needed for drop-off cohort analysis.
2. **How do we keep ourselves replaceable from Clerk?** The current codebase imports `@clerk/backend` directly from auth plugins, route handlers, and webhook handlers. Switching identity providers later (commercial pressure, pricing changes, compliance requirements) would mean touching every callsite.

Both decisions are one-way doors: the funnel data model becomes load-bearing for analytics dashboards (any later schema migration would need to backfill historical events), and the IdentityProvider boundary either holds at the abstraction or it doesn't (mixed direct/abstracted callsites defeat the purpose).

This ADR consolidates both decisions into a single record per the PR #196 Round 2 reviewer guidance ("One ADR is fine"). The optional second ADR proposed in the RFC's architecture-updates section was dropped.

## Decision

### Decision A — `OnboardingActivationEvent` model (OD-4)

Onboarding milestones are persisted as **append-only** rows in a dedicated `OnboardingActivationEvent` table:

```prisma
model OnboardingActivationEvent {
  id           String          @id @default(cuid())
  brandId      String
  step         OnboardingStep
  previousStep OnboardingStep?
  occurredAt   DateTime        @default(now())
  dwellMs      Int?
  metadata     Json            @default("{}")
}
```

Rules:

- **Append-only**: never `UPDATE` or `DELETE` outside the GDPR erasure path.
- **Idempotent emission on `(brandId, step)`**: duplicate emit is a silent no-op so cross-app emitters (worker → API) can fire safely.
- **`OnboardingState` is the mutable mirror**: a 1:1 row per Brand that tracks current checklist state, picked use-case path, dismissal-by-user, and `activatedAt`. Mutations to `OnboardingState` always pair with a same-transaction `OnboardingActivationEvent` insert.
- **`AuditEvent` parallel write**: every activation event is also written to the existing `AuditEvent` model for SOC2 forensics. The funnel model is for aggregation; the audit model is for forensic record. Different tables, different indexes, different access patterns.
- **TTFV is computed, not stored**: `(activated.occurredAt - account_created.occurredAt)` per Brand, computed on demand from these rows.

### Decision B — `IdentityProvider` abstraction (OD-5)

All identity-provider interactions in `apps/api` go through a single TypeScript interface:

```ts
// apps/api/src/auth/identity-provider.ts
export interface IdentityProvider {
  createUserWithOrg(...): Promise<{ userId; orgId }>
  signInUser(...): Promise<{ sessionToken }>
  getSession(token): Promise<{ userId; orgId | null } | null>
  listSupportedOAuthProviders(): Promise<string[]>
  beginOAuth(...): Promise<{ authorizationUrl }>
  createOrgForUser(...): Promise<{ orgId }>
  getUser(userId): Promise<{ email; name } | null>
  getOrg(orgId): Promise<{ id; name }>
  updateOrgName(...): Promise<void>
  inviteMember(...): Promise<{ invitationId }>
  listOrgMembers(orgId): Promise<Array<{ userId; email; role }>>
  deleteUser(userId): Promise<void>
  deleteOrg(orgId): Promise<void>
  parseWebhook(rawRequest): Promise<NormalizedProviderEvent | null>
}
```

Rules:

- **`ClerkIdentityProvider`** (`apps/api/src/auth/clerk-identity-provider.ts`) is the only concrete implementation today. It is the only file in `apps/api` allowed to import `@clerk/*` directly.
- **Lint enforcement**: `eslint.config.js` adds `no-restricted-imports` for `@clerk/*` patterns scoped to `apps/api/src/**/*.ts`, with a single override for the impl file. The boundary is structural, not honor-system.
- **Fastify decoration**: registered as `fastify.identityProvider` so route handlers and the auth plugin call `fastify.identityProvider.<method>` with no module-level imports.
- **`createUserWithOrg` cleanup contract**: the implementation MUST clean up partial state (delete the just-created user if org creation fails; delete user + org if membership creation fails) so callers see a binary success/failure. This contract is documented in the interface, not the implementation.
- **OAuth model**: Clerk-mediated handshake (Clerk owns the callback). `beginOAuth` returns an authorization URL; the browser is redirected through it; on the way back, `getSession` reads the cookie Clerk set. The app never receives `code+state` — there is no `completeOAuth` method.

## Alternatives Considered

### A. Funnel: flat columns on `Brand` (e.g. `accountCreatedAt`, `firstEventReceivedAt`, ...)

Rejected. Adding a column per milestone makes future milestones a schema migration. Funnel queries need step-level GROUP BY which works against rows-per-step, not columns-per-step. Cohort analysis (drop-off between step N and N+1 split by `useCasePath`) is a SQL window-function over rows, awkward over columns.

### B. Funnel: re-use the existing `AuditEvent` table for aggregation

Rejected. `AuditEvent` is action-keyed (e.g. `'program.create'`) and free-form-payload; aggregation queries over a string column are slower than over a `OnboardingStep` enum, and the audit table grows with every privileged action — not just onboarding. Keeping the funnel separate gives index locality (`@@index([brandId, occurredAt])`, `@@index([step, occurredAt])`) and a clean GDPR cascade path. We still write to `AuditEvent` in parallel for forensics.

### C. IdentityProvider abstraction: thin wrapper over Clerk SDK only

Rejected as insufficient. A thin wrapper that just re-exports Clerk types still leaks the provider-specific shape (e.g. `OrganizationMembership` from `@clerk/backend`) into call sites, defeating the replaceability goal. The interface returns CustomerEQ-shaped types (`ProviderUserId`, `ProviderOrgId`, `NormalizedProviderEvent`), and the impl adapts.

### D. IdentityProvider: enforce via code-review, no lint rule

Rejected. Code review catches some violations; agents and contributors copy-paste-add Clerk imports. The ESLint rule is the structural test — without it, the abstraction would erode.

### E. IdentityProvider: include OAuth `completeOAuth({code, state})` method

Rejected after the PR #196 Round 1 spike. Clerk mediates the OAuth handshake — the app does NOT receive a code+state. `getSession` + `getUser` cover the post-redirect flow; `createOrgForUser` covers the new-user-without-org case on `/signup/finish`. Including a `completeOAuth` method would have shipped a wrong-shape interface and leaked through every OAuth callsite during implementation.

## Consequences

### Positive

- **Funnel queries are SQL one-liners** — `GROUP BY step` over `OnboardingActivationEvent` produces step counts, p50/p90/p99 dwell times, and cohort splits. The internal `/v1/admin/internal/onboarding-funnel` endpoint is a thin wrapper over this.
- **Provider replaceability is enforced** — adding a non-Clerk provider is `apps/api/src/auth/<new>-identity-provider.ts` and a configuration flip; no callsite churn.
- **GDPR cascade is straightforward** — both `OnboardingState` and `OnboardingActivationEvent` cascade-delete from `Brand`. The existing erasure job adds a single deletion step.
- **Cross-app emission is safe** — `apps/worker/src/processors/campaignTriggers.ts` can emit `first_action_triggered` directly via the shared `emitActivationStep` helper; idempotency on `(brandId, step)` makes duplicate emission safe under retries.

### Negative

- **Two writes per milestone** (`OnboardingActivationEvent` + `AuditEvent`) — slightly higher write throughput vs. a single audit write. The instrumentation matrix has 9 emission sites and the volume is bounded by Brand count, so the cost is small.
- **Interface surface ⇒ test surface** — 14 methods × representative tests means the `clerk-identity-provider.test.ts` is non-trivial. Future provider implementations must satisfy the same contract; this is the price of structural replaceability.
- **Spike-before-design discipline required** — the abstraction shape was wrong (`completeOAuth`) before the Round 1 spike. Future external-integration interfaces must include a documentation-and-codebase spike against the actual SDK surface before being marked "high confidence." Captured in mistake-pattern memory.

## References

- RFC: `docs/rfcs/170-onboarding-first-run.md` (§2 data models, §3 IdentityProvider, §7 instrumentation matrix, §11 compliance)
- Spec: `docs/feature-specs/170-onboarding-first-run.md` (OD-4 and OD-5 surfaced during spec review)
- Round 1 spike findings: `docs/evidence/170-design-feedback.md`
- Round 2 reviewer reversals: `docs/evidence/170-design-feedback.md`
- ESLint rule: `eslint.config.js` (no-restricted-imports for `@clerk/*` in `apps/api/src/**/*.ts`)
- Reference implementation: `apps/api/src/auth/clerk-identity-provider.ts`
