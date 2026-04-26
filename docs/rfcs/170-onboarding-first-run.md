# Feature: Onboarding & First-Run Experience — Technical Design

Issue: #170 (epic)
Owner: Claude (technical-design job)

> This RFC translates the feature spec at `docs/feature-specs/170-onboarding-first-run.md` into an implementable technical architecture. It pins the five open architectural decisions (OD-1 through OD-5) raised during the spec phase, specifies the data models and API surfaces the implementation will land, and defines the validation plan. Archetype connect/verify flows (#171, #172, #173) get their own RFCs; this RFC owns the **shared spine** they all plug into.

---

## Customer

The first admin of a new CustomerEQ tenant — a mid-market user (per ICP in the business validation report) who is technical enough to install a snippet or generate an API key, who is on a 6–12 month evaluation cycle with internal pressure to show a working prototype fast, and who is evaluating CustomerEQ against keeping their existing fragmented stack. See spec §"Customer" for the full persona; this RFC inherits it.

## Customer Problem being solved

The spec captures the customer-facing problem in detail. From a *technical* design perspective the problem reduces to five constraints that this RFC must hold simultaneously:

1. **Self-serve provisioning at first sign-in** — no manual `onboard-org.mjs` step; a `Brand` exists by the time the admin lands on `/admin`.
2. **Identity-provider replaceability** — every Clerk SDK call lives behind a single interface so swapping providers later is a port-only effort.
3. **Per-step activation funnel from day one** — not a single TTFV value, but per-step dwell times persisted in a query-friendly model so we can identify *where* onboarding sticks.
4. **Pricing forward-compatibility** — the spec reserves a plan-selection slot today; the data model and API surfaces must accept a future `Subscription`/`Plan` layer without restructuring.
5. **Compliance baked-in** — GDPR erasure cascades, SOC2 audit trail, and idempotent provisioning all enforced at the persistence layer, not bolted on.

## User Experience that will solve the problem

Defers to the spec (§"User Experience That Will Solve the Problem"). The RFC's UI inventory below maps each spec-defined surface to its component file and route file. No new UX is introduced here that is not already in the spec.

---

## Technical Details

### 1. Open architectural decisions — pinned

| OD | Decision | Spec recommendation | Reviewer outcome (PR #187) | RFC pin |
| :-: | :--- | :--- | :--- | :--- |
| **OD-1** | Clerk → Brand auto-provisioning | Webhook primary + middleware fallback | Agreed | Implement both. Webhook is the steady-state path; middleware fallback covers webhook-delivery lag and browser-crash-between-Step-0-and-redirect. |
| **OD-2** | Multi-app data model (#173) | Extend `ExternalSignalSource.sourceType` with `APPLICATION` | Agreed | Add `APPLICATION` to the `ExternalSignalSourceType` enum. App metadata (display name, type, icon) goes into `scopeConfig: Json`. Per-app `apiKeyId` is referenced via existing `ApiKey.externalSignalSourceId` (new optional FK). |
| **OD-3** | `OnboardingState` persistence | New 1:1 model with Brand | Agreed | Dedicated Prisma model. See §2. |
| **OD-4** | Activation funnel storage | Dedicated `OnboardingActivationEvent` model with per-step dwell times (flipped from initial spec recommendation during review Round 1) | Agreed | Dedicated model. `AuditEvent` is also written but for forensics, not aggregation. See §2. |
| **OD-5** | IdentityProvider abstraction | 8-method interface + 4 OAuth methods added in Round 2 | Agreed | Define `IdentityProvider` interface in `apps/api/src/auth/identity-provider.ts`; `ClerkIdentityProvider` is the only implementation today. Every CustomerEQ call site imports the interface, never `@clerk/*` directly (lint-enforced — see §11). |

### 2. Data model changes (Prisma)

#### 2.1 `Brand` — new fields

```prisma
model Brand {
  // existing fields unchanged...
  id          String   @id @default(cuid())
  clerkOrgId  String   @unique
  name        String
  createdAt   DateTime @default(now())
  // ... existing relations ...

  // NEW (Step 1.5 org-profile capture)
  siteDomain        String?
  logoUrl           String?           // object-storage URL
  defaultThemeId    String?           // FK → Theme (existing model from #157/ADR 0001)
  sizeCategory      OrgSizeCategory?  // NEW enum, see below

  // NEW relations
  defaultTheme        Theme?                       @relation("DefaultTheme", fields: [defaultThemeId], references: [id], onDelete: SetNull)
  onboardingState     OnboardingState?
  activationEvents    OnboardingActivationEvent[]
}

enum OrgSizeCategory {
  SIZE_1_10
  SIZE_11_50
  SIZE_51_200
  SIZE_201_PLUS
  PREFER_NOT_TO_SAY
}
```

**No pricing/subscription column today** *(reviewer decision PR #196 Round 2)*: pricing model is not finalized (project memory `project_pricing_not_finalized.md`), so the RFC does **not** add a placeholder column. The pricing-strategy job will land both the data shape (column, FK to `Subscription`, or other) and the corresponding API/UI surfaces together when it runs. The Step 0 form retains a visual "Reserved for plan selection" slot per the spec, but that slot is UX-only and writes nothing to the schema. **Revisit point**: when pricing is finalized, this RFC's data-model section needs an addendum (or a follow-up RFC) covering the schema and migration.

#### 2.2 `OnboardingState` — new 1:1 model (OD-3)

```prisma
model OnboardingState {
  id                    String   @id @default(cuid())
  brandId               String   @unique
  brand                 Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)

  useCasePath           UseCasePath?    // null until Step 2 picker
  checklist             Json     @default("{}")
                                        // shape: {
                                        //   brandCreated: bool,
                                        //   dataSourceConnected: bool,
                                        //   firstEventReceived: bool,
                                        //   firstSurveyLive: bool,
                                        //   firstActionTriggered: bool,
                                        //   programCreated: bool      // gates row 5; see spec
                                        // }
  dismissedByUserIds    String[] @default([])   // Clerk user IDs that dismissed the widget post-activation
  invitedAdminUserIds   String[] @default([])   // populated by #189; consumed by spine to skip Step 0/picker

  activatedAt           DateTime?         // set exactly once when all 5 milestones first complete
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([activatedAt])     // for funnel cohort queries on activated brands
}

enum UseCasePath {
  api
  site
  apps
  skipped
}
```

**Validation rule (Zod, enforced in `PATCH /v1/admin/onboarding/checklist`)**: `firstActionTriggered` cannot transition to `true` while `programCreated` is `false` — the row-5 precondition from the spec. The endpoint returns 400 on violation.

#### 2.3 `OnboardingActivationEvent` — new append-only model (OD-4)

```prisma
model OnboardingActivationEvent {
  id            String           @id @default(cuid())
  brandId       String
  brand         Brand            @relation(fields: [brandId], references: [id], onDelete: Cascade)

  step          OnboardingStep
  previousStep  OnboardingStep?  // null on the first event (account_created)
  occurredAt    DateTime         @default(now())
  dwellMs       Int?             // ms since previousStep.occurredAt; null on the first event
  metadata      Json             @default("{}")    // free-form per-step context

  @@index([brandId, occurredAt])
  @@index([step, occurredAt])    // funnel aggregation queries
}

enum OnboardingStep {
  account_created
  org_profile_completed
  path_chosen
  data_source_connected
  first_event_received
  first_survey_published
  program_created
  first_action_triggered
  activated                       // emitted exactly once when all 5 checklist milestones complete
}
```

**Append-only contract**: never `update` or `delete` rows in this table outside of the GDPR erasure job. Ensures the funnel truth never rewrites history.

**TTFV computation**: `(activated.occurredAt - account_created.occurredAt)` per Brand, computed on demand from these rows; not stored.

#### 2.4 `ExternalSignalSource` — extend `sourceType` (OD-2)

```prisma
enum ExternalSignalSourceType {
  // existing values...
  GOOGLE_BUSINESS_PROFILE
  LINKEDIN_ORG
  REDDIT
  X
  GENERIC_WEBHOOK
  GENERIC_API
  // NEW
  APPLICATION
}
```

Per-app metadata uses the existing `scopeConfig: Json` field with shape `{ appType: 'web' | 'mobile' | 'backend' | 'other', appIcon?: string }`. Per-app API keys reuse the existing `ApiKey` model with a new optional FK:

```prisma
model ApiKey {
  // existing fields...
  externalSignalSourceId  String?
  externalSignalSource    ExternalSignalSource?  @relation(fields: [externalSignalSourceId], references: [id], onDelete: SetNull)

  @@index([externalSignalSourceId])
}
```

The #173 RFC will pin per-app verification semantics; this RFC only adds the structural support.

#### 2.5 Migration strategy

- **One migration** at the start of implementation: `20260427000000_onboarding_first_run` adds all of the above (`OnboardingState`, `OnboardingActivationEvent`, `Brand` field additions [`siteDomain`, `logoUrl`, `defaultThemeId`, `sizeCategory`], `OrgSizeCategory` enum, `OnboardingStep` enum, `UseCasePath` enum, `APPLICATION` source-type enum value, `ApiKey.externalSignalSourceId`). No `planTier` column — see §2.1.
- All new fields on `Brand` are nullable to avoid blocking existing rows; migration does **not** backfill `siteDomain`/`logoUrl`/etc. — existing brands keep nulls and the org-profile route allows them to populate at any time.
- For existing Brands, a one-shot data backfill creates `OnboardingState` rows with `checklist = { brandCreated: true, /* rest false */ }` and emits a single `OnboardingActivationEvent { step: 'account_created' }`. Run as part of the migration (Prisma `migrate deploy` with a follow-up SQL script invoked from the API on first boot of the new release; idempotent on `OnboardingState.brandId` unique).

### 3. IdentityProvider abstraction (OD-5)

#### 3.1 Interface (`apps/api/src/auth/identity-provider.ts`)

```typescript
export type ProviderUserId = string;
export type ProviderOrgId = string;

export interface IdentityProvider {
  // — Account lifecycle —
  // Internally 3 provider calls (createUser + createOrganization + addMembership
  // for Clerk per scripts/onboard-org.mjs). On any sub-step failure, the
  // implementation MUST clean up partial state — e.g., delete the just-created
  // user if org-create fails — so the caller sees a binary success/failure.
  // This contract is part of the interface, not an implementation detail.
  createUserWithOrg(args: {
    email: string;
    password: string;
    name: string;
    orgName: string;
  }): Promise<{ userId: ProviderUserId; orgId: ProviderOrgId }>;

  signInUser(args: {
    email: string;
    password: string;
  }): Promise<{ sessionToken: string }>;

  // — Session —
  getSession(sessionToken: string): Promise<{ userId: ProviderUserId; orgId: ProviderOrgId } | null>;

  // — OAuth (added in spec Round 2; revised post-spike 2026-04-26) —
  // Provider mediates the OAuth handshake (Clerk-hosted today). App does NOT
  // receive an OAuth code + state — `beginOAuth` returns the provider's
  // entry-point URL, the browser is redirected through it, and the provider
  // sets a session cookie before redirecting back. After redirect-back,
  // `getSession` reads that session as usual. There is no `completeOAuth`
  // method because the app is not in the code-exchange path.
  listSupportedOAuthProviders(): Promise<Array<'google' | 'github' | 'microsoft' | string>>;
  beginOAuth(args: { provider: string; returnTo: string }): Promise<{ authorizationUrl: string }>;
  // For the new-user-without-org path: after a fresh OAuth sign-up, the
  // session has a `userId` but no `orgId`. Caller detects `orgId === null` on
  // /signup/finish and calls createOrgForUser to provision the org.
  createOrgForUser(args: { userId: ProviderUserId; orgName: string }): Promise<{ orgId: ProviderOrgId }>;
  // Profile fetch — used by the OAuth path to pre-fill the name/email on
  // /signup/finish and by erasure to confirm we have the right user.
  getUser(userId: ProviderUserId): Promise<{ email: string; name: string } | null>;

  // — Org lifecycle —
  getOrg(orgId: ProviderOrgId): Promise<{ id: ProviderOrgId; name: string }>;
  updateOrgName(args: { orgId: ProviderOrgId; name: string }): Promise<void>;

  // — Members —
  inviteMember(args: { orgId: ProviderOrgId; email: string; role: 'admin' }): Promise<{ invitationId: string }>;
  listOrgMembers(orgId: ProviderOrgId): Promise<Array<{ userId: ProviderUserId; email: string; role: string }>>;

  // — Erasure (GDPR) —
  deleteUser(userId: ProviderUserId): Promise<void>;
  deleteOrg(orgId: ProviderOrgId): Promise<void>;

  // — Webhook normalization —
  parseWebhook(rawRequest: Request): Promise<NormalizedProviderEvent | null>;
}

export type NormalizedProviderEvent =
  | { type: 'organization.created'; orgId: ProviderOrgId; orgName: string; createdByUserId: ProviderUserId }
  | { type: 'organization.updated'; orgId: ProviderOrgId; orgName: string }
  | { type: 'organization.deleted'; orgId: ProviderOrgId }
  | { type: 'user.created'; userId: ProviderUserId; email: string }
  | { type: 'user.deleted'; userId: ProviderUserId };
```

#### 3.2 Clerk implementation (`apps/api/src/auth/clerk-identity-provider.ts`)

Wraps `@clerk/clerk-sdk-node` and `svix` (signature verification). Webhook parsing rejects unsigned/invalid requests inside this module; nothing outside the abstraction sees a Clerk SDK object.

#### 3.3 Lint enforcement

Add an ESLint rule (`no-restricted-imports`) at repo root:

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["@clerk/*"],
        "message": "Import the IdentityProvider abstraction from apps/api/src/auth/identity-provider.ts instead. Direct @clerk/* imports are only allowed in clerk-identity-provider.ts."
      }]
    }]
  },
  "overrides": [{
    "files": ["apps/api/src/auth/clerk-identity-provider.ts"],
    "rules": { "no-restricted-imports": "off" }
  }]
}
```

This is the structural test that makes the abstraction durable.

### 4. API surface

| Route | Method | Auth | Body / Query | Response | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/signup` | POST | Public | `{ email, password, name, orgName, agreedToTos: true }` | `{ redirectTo: '/admin/onboarding/profile' }` | Calls `IdentityProvider.createUserWithOrg`, inserts Brand + OnboardingState + first OnboardingActivationEvent in one transaction, signs the user in. Step 0 entry. |
| `/api/auth/oauth/:provider/start` | GET | Public | `?returnTo=...` (optional) | 302 to `IdentityProvider.beginOAuth(...)`'s `authorizationUrl` | The provider (Clerk today) handles the entire OAuth handshake; `returnTo` is propagated through Clerk's redirect flow back to our app. |
| `/api/auth/oauth/callback` | — | (no app-side handler needed) | — | — | Clerk's hosted OAuth handler is the actual callback target. The browser lands back on our app with a session cookie set by Clerk; the existing auth middleware reads the session via `IdentityProvider.getSession`. The app middleware checks: if `getSession` returns `{ userId, orgId: null }` (new-user case), redirect to `/signup/finish`; if `{ userId, orgId }` (existing user), redirect to `/admin`. **No app-side `code` exchange.** |
| `/api/auth/signup/finish` | POST | Auth (post-OAuth session) | `{ orgName }` | `{ redirectTo: '/admin/onboarding/profile' }` | New-user-without-org convergence point. Calls `IdentityProvider.getUser(userId)` for email/name (pre-filled from OAuth profile) + `IdentityProvider.createOrgForUser({ userId, orgName })`, then provisions Brand row + OnboardingState + first OnboardingActivationEvent (same shape as `/api/auth/signup`). |
| `/api/webhooks/identity-provider` | POST | Signed (via abstraction) | provider raw body | 200/204 | `IdentityProvider.parseWebhook` validates signature; only `organization.created` is acted on for provisioning (idempotent upsert on `clerkOrgId`). |
| `/v1/admin/onboarding/profile` | PATCH | Admin (Clerk JWT) | `{ name?, logoUrl?, siteDomain?, defaultThemeId?, sizeCategory? }` (Zod) | `{ brand, onboardingState }` | Step 1.5 submit + post-onboarding edits (called by both onboarding form and the future #190 settings page). Emits `OnboardingActivationEvent { step: 'org_profile_completed' }` only on first save (idempotent on `OnboardingState.checklist.org_profile_completed`). |
| `/v1/admin/onboarding/checklist` | PATCH | Admin (Clerk JWT) | `{ useCasePath?, checklist?: Partial<ChecklistShape> }` (Zod) | `{ onboardingState }` | Validated transitions per spec. Emits the matching `OnboardingActivationEvent` on each flag flip. Sets `activatedAt` when all 5 milestones first complete (in same transaction; emits `activated` event). |
| `/v1/admin/brand` | PATCH | Admin (Clerk JWT) | `{ name? }` (Zod) | `{ brand }` | Brand-name change: updates `Brand.name` first (DB is source of truth), enqueues a `IdentityProvider.updateOrgName` retry job. Owned by #190 long-term; spine implements the route since the data is on `Brand`. |
| `/v1/admin/onboarding/state` | GET | Admin (Clerk JWT) | — | `{ onboardingState }` | Read endpoint for the checklist widget. |
| `/v1/admin/internal/onboarding-funnel` | GET | Admin + internal-only feature flag | `?from=...&to=...&useCasePath=...&sizeCategory=...` | Aggregated step-by-step counts + p50/p90/p99 dwell times | Internal CustomerEQ team only; gated by feature flag (RFC §11). |

#### 4.1 Zod schemas (`packages/shared/src/zod/onboarding.ts` — new file)

Five schemas: `signupRequestSchema`, `oauthFinishRequestSchema`, `onboardingProfilePatchSchema`, `onboardingChecklistPatchSchema`, `brandPatchSchema`. Each is shared between API request validation (Fastify route schemas) and frontend form validation (react-hook-form / shadcn forms). Field-level validations:

- `email`: RFC 5322 + duplicate check (DB query before provider call to give a fast inline error).
- `password`: min 8 chars + complexity; client-side and server-side.
- `name` / `orgName`: trim + non-empty + ≤ 100 chars.
- `siteDomain`: format only (no DNS lookup; that's #172's job).
- `logoUrl`: only the API endpoint accepts it post-upload; uploads go through `/v1/uploads/logo` (existing — see §6).
- `defaultThemeId`: must be a `Theme.id` owned by the calling Brand (tenant-scoped lookup before write).
- `checklist` patch: enforce `firstActionTriggered=true → programCreated=true` precondition; reject otherwise with 400.

### 5. Webhook handler

`/api/webhooks/identity-provider` receives raw Clerk events, runs them through `IdentityProvider.parseWebhook` (which verifies the Svix signature), then acts on the normalized event:

| Normalized event | Action |
| :--- | :--- |
| `organization.created` | Upsert `Brand` keyed on `clerkOrgId` (idempotent — Step 0's synchronous flow has likely already created it). If `Brand` was just created here (rare race), also create `OnboardingState` + first `OnboardingActivationEvent`. |
| `organization.updated` | If `Brand.name` differs, **do not** sync from provider — CustomerEQ DB is the source of truth (per OD-5; spec edge case "Brand name change after onboarding"). Log only. |
| `organization.deleted` | Soft-delete `Brand` (set `deletedAt`); cascade is handled by the GDPR erasure job (§9). |
| `user.created` | No-op for the spine; #189 may consume this to track invited-admin acceptance. |
| `user.deleted` | Trigger GDPR erasure for that user's owned brands (if sole admin) and remove from `OnboardingState.dismissedByUserIds` / `invitedAdminUserIds`. |

### 6. Component hierarchy (apps/web)

| Surface | Path | Components | Notes |
| :--- | :--- | :--- | :--- |
| `/signup` | `apps/web/src/app/(auth)/signup/page.tsx` | `<SignupPage />` (server) → `<SignupForm />` (client) + `<OAuthButtonRow />` (reads `IdentityProvider.listSupportedOAuthProviders()` server-side, renders client-side) | Pure CustomerEQ chrome; no Clerk hosted UI. |
| `/sign-in` | `apps/web/src/app/(auth)/sign-in/page.tsx` (existing — minor edits) | `<SignInForm />` + `<OAuthButtonRow />` (reused) | Existing route gains the same OAuth row for parity. |
| `/signup/finish` | `apps/web/src/app/(auth)/signup/finish/page.tsx` (new) | `<OAuthFinishForm />` (org-name only) | OAuth-path convergence point. |
| `/accept-invite/[token]` | new (owned by #189) | — | Out of scope for spine RFC; #189's RFC pins it. |
| `/admin/onboarding/profile` | `apps/web/src/app/(admin)/admin/onboarding/profile/page.tsx` | `<OrgProfileForm />` + `<ThemePicker />` + `<ThemePreviewPanel />` | Uses `<form mode="create" />` from #157's CRUD pattern (mode prop). |
| `/admin/onboarding` | `apps/web/src/app/(admin)/admin/onboarding/page.tsx` | `<UseCasePicker />` (3 cards + skip + cohort hint) | Cohort hint reads `Brand.sizeCategory` server-side. |
| `/admin/onboarding/api` `/admin/onboarding/site` `/admin/onboarding/apps` | (owned by #171/#172/#173) | — | Out of scope for spine RFC. |
| `/admin` | `apps/web/src/app/(admin)/admin/page.tsx` (existing — minor edits) | `<FirstRunChecklistWidget />` (NEW, top of page) + existing `<CXHealthPanel />` + `<LoyaltyHealthPanel />` (props extended for path-specific empty-states) | Widget reads `OnboardingState` via SWR; updates via `useOnboardingChecklist()` hook. |
| `/admin/internal/onboarding-funnel` | `apps/web/src/app/(admin)/admin/internal/onboarding-funnel/page.tsx` (NEW) | `<OnboardingFunnelChart />` + filter controls | Internal-only; gated. |

#### 6.1 `<FirstRunChecklistWidget />`

- Single source of truth: reads `OnboardingState` server-side; client-side mutations call `PATCH /v1/admin/onboarding/checklist`.
- Three sub-states for row 5 (per spec Round 1 fix): `programCreated=false` → "Create a loyalty program →"; `programCreated=true && firstActionTriggered=false` → "Create your first campaign →"; `firstActionTriggered=true` → checked.
- Collapse/dismiss: dismissal stored in `OnboardingState.dismissedByUserIds` (per-user); only available post-`activatedAt`.
- Aria attributes: `aria-expanded` on the header, `aria-valuenow`/`aria-valuemax` on the progress bar, `aria-label` on icon-only chevron buttons.

#### 6.2 `useOnboardingChecklist()` hook

Returns `{ state, updateChecklist, isLoading, error }`. Wraps SWR for read + optimistic updates on PATCH. Used by every place that needs to advance a checklist flag (#171, #172, #173 archetype flows, post-onboarding admin pages).

### 7. Step instrumentation matrix (where each `OnboardingActivationEvent` is emitted from)

The matrix below is the contract every implementation PR must honor. If a step is emitted from multiple places, the emitter that fires *first* for a given Brand wins (idempotent on `(brandId, step)` — duplicate emission is a no-op).

| Step | Emitter location | Trigger |
| :--- | :--- | :--- |
| `account_created` | `apps/api/src/routes/auth/signup.ts` (POST `/api/auth/signup` handler) and `apps/api/src/routes/auth/oauth-finish.ts` (POST `/api/auth/oauth/finish` handler) | First write of the `Brand` row |
| `org_profile_completed` | `apps/api/src/routes/onboarding/profile.ts` (PATCH `/v1/admin/onboarding/profile`) | First save (idempotent on the matching checklist flag) |
| `path_chosen` | `apps/api/src/routes/onboarding/checklist.ts` | When `useCasePath` transitions from null to non-null |
| `data_source_connected` | Owned by #171/#172/#173 archetype flows; they call `PATCH /v1/admin/onboarding/checklist` with `{ checklist: { dataSourceConnected: true } }` |
| `first_event_received` | `apps/api/src/routes/v1/events.ts` (existing event-ingest endpoint) — when the first event arrives for a Brand whose checklist flag is still false |
| `first_survey_published` | `apps/api/src/routes/v1/surveys.ts` (existing survey-publish handler) — when a survey transitions to `status: 'live'` for the first time on this Brand |
| `program_created` | `apps/api/src/routes/v1/programs.ts` (existing program-create handler) — first program for this Brand |
| `first_action_triggered` | `apps/worker/src/processors/campaignTriggers.ts` (existing) — on the first action it fires for this Brand |
| `activated` | `apps/api/src/routes/onboarding/checklist.ts` — emitted exactly once when the patch handler detects all 5 checklist milestones have transitioned to `true`; `activatedAt` is set in the same transaction |

#### 7.1 Emission helper

A small helper `emitActivationStep(brandId, step, metadata?)` in `apps/api/src/services/onboarding.ts` encapsulates:
1. Lookup the previous event for this Brand → compute `dwellMs`.
2. Insert `OnboardingActivationEvent` row (idempotent on `(brandId, step)` — silently no-op if duplicate).
3. Also emit a parallel `AuditEvent` row for forensics (action = `'onboarding.<step>'`).

Cross-app emission (worker calls into the helper from `campaignTriggers.ts`): the helper is exported from `packages/shared` so worker and api both import the same function. The function uses Prisma directly (idempotency guarantees safety from concurrent emission).

### 8. Path-specific dashboard CTA dispatch

`apps/web/src/app/(admin)/admin/page.tsx` reads `OnboardingState.useCasePath` server-side and passes a `archetype` prop to `<CXHealthPanel />` and `<LoyaltyHealthPanel />`. Each panel renders its own per-archetype empty-state copy via a small inline switch:

```tsx
function CXHealthEmpty({ archetype }: { archetype: UseCasePath | null }) {
  switch (archetype) {
    case 'api':     return <EmptyCTA href="/admin/developer" label="Send a CX event via API" />;
    case 'site':    return <EmptyCTA href="/admin/surveys/new" label="Add another survey to your site" />;
    case 'apps':    return <EmptyCTA href="/admin/integrations" label="Send a CX event from another app" />;
    default:        return <EmptyCTA href="/admin/surveys/new" label="Create your first survey" />;  // skipped/null
  }
}
```

Sidebar quick-add (in admin layout): same archetype-aware switch for the "+" menu's first item.

### 9. GDPR erasure cascade

When an erasure request is filed for a Brand or User, the existing erasure job (`apps/worker/src/processors/erasure.ts`) gains the following steps in order:

1. **`OnboardingActivationEvent`**: `DELETE FROM "OnboardingActivationEvent" WHERE "brandId" = $1` — straightforward; no cross-table FKs from this side.
2. **`OnboardingState`**: cascade-delete via the existing `Brand` → `OnboardingState` `onDelete: Cascade` relation, OR explicit `DELETE` if Brand is being soft-deleted only.
3. **Logo asset**: object-storage delete on `Brand.logoUrl` (best-effort; logged if fails).
4. **Provider-side erasure**: `IdentityProvider.deleteUser(userId)` and `IdentityProvider.deleteOrg(orgId)` for the Brand's `clerkOrgId` and any owned Clerk users. Best-effort with retry queue; eventual consistency.
5. **Audit trail**: per existing pattern, the erasure itself writes an `AuditEvent` (and an `OnboardingActivationEvent` is *not* emitted for erasures — only for activation lifecycle).

### 10. Failure modes & retries

| Failure | Where | Behavior |
| :--- | :--- | :--- |
| `IdentityProvider.createUserWithOrg` rate-limit | Step 0 / `/api/auth/signup` | 429 to the form; admin sees "We can't create your account right now…" banner with Retry button (per spec). Brand row is never created (transaction rolls back). |
| `IdentityProvider.createUserWithOrg` network error | Same | Same banner; client auto-retries up to 3× before surfacing manual retry. |
| `IdentityProvider.createUserWithOrg` partial failure (user created, org-create fails) | Inside `clerk-identity-provider.ts` | The implementation MUST clean up: delete the just-created Clerk user before re-raising, so the caller's transaction sees a clean failure. Per the interface contract (§3.1 comment). If the cleanup itself fails, log the orphaned user ID at ERROR with `{ orphanedUserId, originalError }`; manual janitor sweep handles eventually-consistent deletion. |
| OAuth flow returns to app with `getSession` showing `{ userId, orgId: null }` | Middleware on the post-OAuth-redirect route | Redirect to `/signup/finish` (new-user-without-org path). `IdentityProvider.getUser(userId)` retrieves the profile to pre-fill the org-name form. |
| `IdentityProvider.createOrgForUser` fails on `/api/auth/signup/finish` | OAuth path | Same banner pattern as Step 0 errors. The Clerk user already exists (created during OAuth); the user can retry the org-name form. No cleanup needed because the user can re-attempt without re-doing OAuth. |
| Webhook signature verification fails | `/api/webhooks/identity-provider` | 401; no DB write. Logged with the request's signature header for support. |
| Webhook handler crash mid-write | Same | Idempotent upsert on `clerkOrgId` ensures replay is safe. The webhook delivery service retries (Svix exponential backoff). |
| `IdentityProvider.updateOrgName` fails | `/v1/admin/brand` PATCH | Brand row already updated locally; enqueue retry job (`onboarding-provider-sync` queue, max 5 retries with exponential backoff). Admin sees no error. |
| Concurrent admin updates to `OnboardingState.checklist` | `/v1/admin/onboarding/checklist` | Serialized via Postgres row-level lock on the `OnboardingState` row inside the patch transaction. Idempotent step-emission means no duplicate events. |
| Worker emits `first_action_triggered` but checklist already shows it | Cross-app emission | Idempotent on `(brandId, step)`; the second emit silently no-ops. |
| Brand has multiple admins racing to dismiss the widget | `/v1/admin/onboarding/checklist` | `dismissedByUserIds` is a `String[]` — array union is commutative, no ordering required. |

### 11. Compliance & access controls

#### 11.1 Mapped to spec's compliance section

| Control | RFC implementation |
| :--- | :--- |
| GDPR data minimization | Zod schemas on Step 0 / Step 1.5 explicitly enumerate fields; no extra capture. End-user PII not collected during admin onboarding. |
| GDPR right to erasure | §9 cascade. Run on the existing erasure-job schedule. |
| GDPR transparency | The marketing-site privacy page update is out of scope for engineering; tracked as a docs follow-up. |
| SOC2 logical access control | Webhook signature (Svix) verified inside `clerk-identity-provider.ts`; `/api/auth/signup` validates email-syntax + duplicate-check before any provider call. |
| SOC2 audit trail | Every `OnboardingActivationEvent` row is paired with an `AuditEvent` (forensic record) per §7.1. |
| SOC2 change management | Single migration (§2.5) follows the standard Prisma review path. |

#### 11.2 Internal-only funnel surface

`/admin/internal/onboarding-funnel` is gated by a feature flag `INTERNAL_ANALYTICS_ENABLED` set per-environment (`true` for prod / staging used by CustomerEQ employees only, `false` everywhere else). The route's middleware (`apps/web/src/middleware.ts`) returns 404 when the flag is off, so the surface is invisible — not just unauthorized — to customer admins.

### 12. Dependencies on other issues

| Issue | What this RFC needs from it | Blocking? |
| :--- | :--- | :--- |
| **#157** (CRUD pattern + ADR 0001) | `mode` prop convention on form components (used by Step 1.5 form); `Theme` model | Already merged; no block |
| **#171** API/SDK archetype | Implements `data_source_connected` / `first_event_received` emission for the api path | Parallel; #170 spine ships first |
| **#172** Static-site archetype | Implements `data_source_connected` / `first_survey_published` emission for the site path; consumes `Brand.siteDomain` | Parallel |
| **#173** Multi-app archetype | Consumes `ExternalSignalSource.sourceType = APPLICATION` extension (RFC pins the structural support) | Parallel |
| **#189** Team-management | Owns `/admin/team`, `/accept-invite/<token>`, `OnboardingState.invitedAdminUserIds` writes | Parallel; spine creates the field, #189 writes to it |
| **#190** Brand settings page | Owns `/admin/settings/brand`; consumes `PATCH /v1/admin/brand` (which spine implements) and `PATCH /v1/admin/onboarding/profile` (reused) | Parallel; spine ships the routes |
| **Issue #6** (hero workflow) | Must remain reachable in <30 min from sign-up — see Validation Plan #1 | Already shipped; constraint not block |

### 13. Out of scope

- **Plan / pricing UI in Step 0** — visual placeholder slot only (no schema field); the pricing-strategy job lands both the UI and the data shape together when pricing is finalized.
- **Multi-org / enterprise hierarchy** — gated on #19 / #44.
- **SSO** — gated on #45.
- **Custom theme creation** — uses existing `Theme` CRUD entity from #157; no new theme-builder UX in this RFC.
- **First-class SDK packages (npm/pypi)** — #171's RFC handles this; copy-paste snippets only for spine.

---

## Confidence Level

**90** *(revised post-spike from 85)*.

Confidence breakdown:
- **Data models**: high — fields enumerated; Prisma syntax is mechanical; new enum values are additive.
- **IdentityProvider abstraction**: **high** *(post-spike)* — the spike (see Spike Findings) verified the 4 highest-uncertainty methods against Clerk's documented surface. `parseWebhook` and `updateOrgName` map cleanly; `createUserWithOrg`'s internal-cleanup contract is now spec'd as part of the interface; `completeOAuth` was removed in favor of the `getSession` + `getUser` pattern that matches Clerk's actual OAuth model. The ESLint rule then structurally enforces the boundary on the corrected interface.
- **Per-step funnel emission**: medium-high — cross-app emission via shared helper is a known pattern, but the worker-side emission (`campaignTriggers.ts` → `emitActivationStep`) crosses an app boundary that doesn't currently emit `AuditEvent` from the worker. May need a minor refactor of the audit-event plumbing; lowering confidence slightly.
- **OAuth flow**: high *(post-spike)* — the abstraction now matches Clerk's actual OAuth model (Clerk-mediated handshake; app reads session). The `/signup/finish` convergence-point UX still hasn't been mocked, but the structural design is clean.
- **GDPR cascade order**: high — straightforward additive steps to an existing job.

The remaining residual risk is the cross-app emission of `first_action_triggered` from `apps/worker` (Risks #1). That alone keeps overall confidence at 90 rather than 95.

---

## Validation Plan

| User scenario | Expected outcome | Validation method |
| :--- | :--- | :--- |
| 1. Anonymous user lands on `/signup`, signs up via email/password, lands on `/admin/onboarding/profile` | `Brand` exists with admin-typed name; `OnboardingState` exists with `brandCreated: true`; first `OnboardingActivationEvent { step: 'account_created' }` row exists | E2E (Playwright) + DB assertion |
| 2. Anonymous user clicks "Continue with Google", completes OAuth, hits `/signup/finish`, fills org name, lands on `/admin/onboarding/profile` | Same DB state as #1; `metadata: { source: 'oauth_google' }` on the activation event | E2E (Playwright with mocked OAuth callback) + DB assertion |
| 3. Admin fills Step 1.5 form (all fields), saves | All five `Brand` fields persist; logo uploaded to object storage; `OnboardingActivationEvent { step: 'org_profile_completed' }` emitted | Integration test |
| 4. Admin clicks "Skip and add later" on Step 1.5 | Same persistence with default values; same activation event with `metadata: { skipped: true }` | Integration test |
| 5. Admin picks each of 4 path values (api/site/apps/skipped) on use-case picker | `OnboardingState.useCasePath` set; `path_chosen` event with `metadata: { path }` | Integration test (one per path) |
| 6. Admin hits `PATCH /v1/admin/onboarding/checklist` with `firstActionTriggered: true` while `programCreated: false` | 400 response with explicit error message; no DB write; no event emitted | Integration test |
| 7. All 5 milestones flipped to `true` (including the program-created precondition) over a sequence of patches | `activatedAt` set exactly once at the moment of the 5th flip; `activated` event emitted exactly once; TTFV computable from row deltas | Integration test |
| 8. Admin lands on `/admin` with `useCasePath = 'api'` | CX Health empty-state shows "Send a CX event via API"; Loyalty Health empty-state shows "Trigger a campaign from a CX event" | E2E (Playwright) |
| 9. Admin invites teammate (#189), invitee accepts, lands on `/admin` of the same Brand | `OnboardingState.invitedAdminUserIds` includes the invitee; if `activatedAt IS NOT NULL`, invitee skips picker | E2E (Playwright) — co-owned with #189 |
| 10. Brand-name change via `/v1/admin/brand` while `IdentityProvider.updateOrgName` fails | `Brand.name` updates immediately; retry job enqueued; admin sees no error | Integration test (mock provider failure) |
| 11. Webhook delivered with invalid Svix signature | 401 response; no DB write | Integration test |
| 12. Erasure job run on a Brand with full onboarding history | All `OnboardingActivationEvent` rows deleted; `OnboardingState` cascade-deleted; logo removed from object storage; `IdentityProvider.deleteOrg` called | Integration test |
| 13. Code-level invariant: no `@clerk/*` imports outside `clerk-identity-provider.ts` | ESLint passes | Unit (lint) |
| 14. Hero workflow reachable in <30 min from sign-up for at least one archetype | Wall-clock measurement from signup → first-action-triggered for #171 archetype | E2E (Playwright; same E2E as #170 AC6) |

### Compliance validation

15. **GDPR erasure** integration test (covered above as #12).
16. **SOC2 audit trail**: every endpoint in `/v1/admin/onboarding/*` and `/v1/admin/brand` emits at least one `AuditEvent`; verified by querying after each test in scenarios 3, 5, 6, 7.
17. **Webhook signature rejection**: scenario #11 above.

### Performance validation

18. **Webhook latency**: `IdentityProvider.parseWebhook` + DB upsert should complete in p99 < 500ms. Measured via API observability dashboards post-deploy.
19. **Funnel query latency**: `/v1/admin/internal/onboarding-funnel` aggregation should complete in p99 < 1s for 30-day windows over 1k brands. Measured locally with a seed of 1k brands × 9 events each.

---

## Test Matrix

### Unit (mocking allowed)

- `clerk-identity-provider.ts` — every method, including `parseWebhook` signature-verification failure paths. Mocks `@clerk/clerk-sdk-node` and `svix`.
- `emitActivationStep` helper — idempotency on `(brandId, step)`; correct `dwellMs` computation.
- Zod schemas (`packages/shared/src/zod/onboarding.ts`) — every field's validation + the cross-field `firstActionTriggered → programCreated` precondition.
- Path-specific dashboard CTA switch — every archetype variant + the null/skipped fallback.
- New unit tests added in: `apps/api/src/auth/__tests__/clerk-identity-provider.test.ts`, `apps/api/src/services/__tests__/onboarding.test.ts`, `packages/shared/src/zod/__tests__/onboarding.test.ts`.

### Integration (only mock external services — Clerk + email provider)

- `/api/auth/signup` happy path + 4 error states (email-in-use, password-weak, provider-rate-limit, provider-unreachable).
- `/api/auth/oauth/google/callback` happy path (new user → `/signup/finish` → org-name capture → Brand provisioned).
- Webhook handler: valid signature → upsert; invalid signature → 401; idempotent re-delivery.
- `PATCH /v1/admin/onboarding/profile` happy path + skip path; both emit the right activation event.
- `PATCH /v1/admin/onboarding/checklist` for each of the 8 step transitions; rejection on `firstActionTriggered=true && programCreated=false`.
- Activation detection: flip all 5 flags in sequence; assert single `activated` event + `activatedAt` set once.
- `PATCH /v1/admin/brand` provider-failure path + retry queue.
- Cross-admin visibility: Admin A advances checklist; Admin B sees the same state.
- Erasure cascade: full Brand erasure including `OnboardingActivationEvent` rows + provider calls.
- New integration tests added under `apps/api/src/__tests__/integration/onboarding/`.

### E2E (Playwright; no mocking of CustomerEQ; OAuth provider mocked at network layer)

- **One required E2E** per #170 AC6: signup → pick api path → connect (#171's flow if available, else snippet drop) → first event → first survey → program → first action → activation banner shows. This is the hero E2E; it transitively validates the spine + at least one archetype + the hero workflow's <30-min reachability constraint.
- **Recommended additional E2E** (best-effort, not blocking): the OAuth happy path through Google with a mocked authorization endpoint.

### Visual / mock validation

- Re-validate the spec's 5 mock scenes in Playwright at 1440×900 + 375×667 (mobile is unverified per spec; this RFC commits to mobile validation during implementation).
- Per-archetype `/admin` empty-state CTAs match the spec's path-specific matrix.

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| **Worker-side emission of `first_action_triggered` requires touching app/worker plumbing that doesn't emit `AuditEvent` today** | Medium | The `emitActivationStep` helper is exported from `packages/shared` so worker imports it directly. Worker already imports Prisma; this is a function-import addition, not a plumbing redesign. |
| **OAuth flow has a UX gap at `/signup/finish`** | Medium | Spec's mocks don't cover this convergence point. Implementation PR will add Scene 1.b to the mock file before submitting; reviewer can sign off there. |
| **Webhook delivery lag could race with Step 0's synchronous Brand insert** | Low | Idempotent upsert on `Brand.clerkOrgId` unique constraint. Worst case: webhook insert is a no-op. Tested in integration scenario #11. |
| **`Brand.name` divergence between CustomerEQ DB and provider during retry-job lag** | Low | Spec accepted this trade-off (DB is source of truth). UI never reads from provider in the request path, so user-visible inconsistency is impossible. |
| **`OnboardingActivationEvent` table grows large over time** | Low | ~9 rows per Brand for activation flow + ~1 row for any state change; pessimistically ~50 rows × 100k brands = 5M rows over years. Indexes on `(brandId, occurredAt)` and `(step, occurredAt)` keep funnel queries fast. Partitioning is unnecessary at this scale. |
| **GDPR erasure provider-side calls fail** | Low | Best-effort with retry. Accepted because the local DB rows are deleted (the canonical compliance obligation); provider-side removal is a hygiene step that can be retried on a schedule. |
| **Pricing-strategy work needs a fresh schema decision later** *(reviewer reversal in PR #196 Round 2)* | Low | No `planTier` column in this RFC, so there is nothing to migrate or drop later. When pricing lands, the pricing-strategy RFC owns the schema design end-to-end (column, FK to `Subscription`, or other). The only obligation here is to revisit this RFC's `Brand` section then. |
| **Lint rule `no-restricted-imports` is bypassed by `// eslint-disable-next-line` in a sub-issue PR** | Low | Add a CI check that `git grep -E "@clerk/(?!.*identity-provider)"` returns zero results outside the abstraction file. Failsafe over lint comments. |
| **Concurrent activation: two admins flip the last checklist item at the same time** | Low | Postgres row-level lock on `OnboardingState` during the PATCH transaction. The first transaction wins; the second sees the row already activated and is a no-op. |
| **Cross-archetype path-switch loses progress** | Low | Per spec: switching paths is additive — existing progress (API key generated, survey published) is preserved. The `useCasePath` field is set freely; checklist flags are not reset. |

---

## Spike Findings

A focused spike was run on **2026-04-26** in response to reviewer pushback on the RFC's "high" confidence rating for the IdentityProvider abstraction (PR #196 review comment on line 450).

### What was spiked

Verified the four highest-uncertainty methods of the `IdentityProvider` interface against (a) the existing repo's Clerk usage, (b) the existing `scripts/onboard-org.mjs` for actual API patterns, (c) the installed `@clerk/backend` v3.2.12 and `@clerk/nextjs` v5.7.6 surface, and (d) Clerk's documented OAuth model.

### Findings

| Method | Result | Action |
| :--- | :--- | :--- |
| **`parseWebhook`** | ✅ **Clean.** Clerk's webhook payloads (delivered via Svix) match the proposed `NormalizedProviderEvent` union. `organization.created.created_by` is present and maps to `createdByUserId`. The 5 event types we use all exist in Clerk's spec. | None — interface kept as-is. |
| **`updateOrgName`** | ✅ **Clean.** Single API call: `clerkClient.organizations.updateOrganization(orgId, { name })`. Returns the updated org. Maps 1:1. | None — interface kept as-is. |
| **`createUserWithOrg`** | ⚠️ **Internally 3 Clerk API calls** (`createUser` + `createOrganization` + `createOrganizationMembership`) per the existing `scripts/onboard-org.mjs`. Hides a real partial-failure mode where the user is created but org-create fails. | Interface kept, but contract clarified: the implementation MUST clean up the just-created user on org-create failure so the caller sees a clean binary success/failure. Documented in §3.1 interface comment + §10 failure-modes table. |
| **`completeOAuth({ code, state })`** | 🔴 **Wrong shape for Clerk.** Clerk owns the entire OAuth handshake (browser → Clerk's hosted OAuth → Google → Clerk's hosted callback → app's `returnTo`). The app **never receives an OAuth `code` or `state` directly**; it receives a session cookie set by Clerk. The original interface assumed app-driven code-exchange — that pattern doesn't apply to Clerk-mediated OAuth. | **Removed `completeOAuth` from the interface.** Replaced with the existing `getSession` (read the session after redirect-back) plus a new `getUser` method (retrieve email/name profile for the new-user-without-org path). The OAuth API surface (`§4`) updated: `/api/auth/oauth/:provider/start` calls `beginOAuth` and redirects; the callback is Clerk-hosted (no app-side handler); the app's existing auth middleware reads the session and routes new-users to `/signup/finish`. |

### Design impact

- **§3.1 Interface**: removed `completeOAuth`; added `getUser(userId) → { email, name } | null`; documented `createUserWithOrg`'s internal cleanup contract as part of the interface comment.
- **§4 API surface**: `/api/auth/oauth/:provider/callback` row removed (Clerk owns it). `/api/auth/signup/finish` row clarified for the new-user-without-org path; explicitly notes that profile pre-fill comes from `IdentityProvider.getUser(userId)`, not from a `code` exchange.
- **§10 Failure modes**: added 3 rows — `createUserWithOrg` partial failure (with user-cleanup contract), OAuth `getSession` returning `orgId: null` for new users, `createOrgForUser` failure on `/api/auth/signup/finish`.
- **§"Confidence Level"**: revised — see below.

### Spike rationale

The spike was the right call. Without it, we would have shipped an interface with a 12-method shape that included a method (`completeOAuth({ code, state })`) that doesn't exist in Clerk's OAuth model — the implementation would have either had to fake it or required a redesign mid-implementation, and any sub-issue depending on the OAuth flow (#171 / #172 / #173 archetype connect flows that gate on a logged-in admin) could have been misled by the wrong contract.

The same pattern would have shipped the `createUserWithOrg` partial-failure mode silently, which would have produced orphaned Clerk users on the rare provider-failure paths until a janitor task was added later.

The cost of the spike was ~30 minutes of code-and-docs review; the cost of catching these in implementation would have been a partial RFC rewrite + sub-issue rework.

---

## Architecture Updates

Proposed (will land in the implementation PR, not this RFC PR):

- **`docs/architecture/architecture.md` §3.1 (Presentation Layer)** — append a new bullet: *"`/signup` and `/sign-in` are CustomerEQ-owned authentication surfaces; the `IdentityProvider` abstraction (per ADR 0004 below) ensures the underlying provider — Clerk today — is never directly imported outside the auth package."*
- **`docs/architecture/architecture.md` §3.2 (API Layer)** — append the onboarding spine route group: `/api/auth/*`, `/v1/admin/onboarding/*`, `/v1/admin/internal/onboarding-funnel`. Append a one-line note that `OnboardingActivationEvent` is the authoritative funnel-aggregation source; `AuditEvent` mirrors a subset for forensics.
- **New ADR `0004-identity-provider-abstraction.md`** — captures OD-5: why we abstract, the 12-method interface, the lint-rule enforcement, and the provider-swap procedure (port-only). Establishing context: this RFC + #170.
- **New ADR `0005-onboarding-activation-funnel.md`** (lower priority — could roll into ADR 0004) — captures OD-4: dedicated event model with per-step dwell times, append-only contract, internal-only funnel surface.

The two new ADRs follow the format established by ADR 0001.

### Three-bucket architecture-gap classification

#### Patterns correctly followed

1. **Multi-tenant `brandId` on every entity** — `OnboardingState`, `OnboardingActivationEvent`, and the `Brand` field additions all carry `brandId` correctly.
2. **Prisma migrations as source of truth** — single coherent migration; new enums + relations follow existing repo conventions.
3. **Zod for shared validation** — request schemas in `packages/shared/src/zod/onboarding.ts` reused by API and frontend.
4. **Append-only event tables for audit/analytics** — `OnboardingActivationEvent` mirrors the `AuditEvent` pattern.
5. **BullMQ for retryable async work** — Brand-name provider-sync retry uses an existing queue pattern.
6. **Standard CRUD admin pattern (ADR 0001)** — Step 1.5 form uses `mode='create' | 'edit'` per the convention; #190 inherits it.
7. **No direct DB writes from request body** — all mutations go through Zod-validated handlers; tenant scoping enforced via Clerk JWT → Brand resolution in middleware.
8. **GDPR-aware schema design** — every new model has an erasure path; no silent PII fields.

#### Patterns missing from architecture (proposed additions)

1. **CustomerEQ-owned auth surfaces wrapping a provider abstraction** — this RFC introduces it; ADR 0004 codifies.
2. **Per-step activation funnel as a first-class data shape** — this RFC introduces it; ADR 0005 (or a section in 0004) codifies.
3. **Internal-only admin surfaces gated by feature flag** — `/admin/internal/onboarding-funnel` is the first; pattern can be reused by future internal tooling.

#### Patterns incorrectly followed

None identified.

---

## Observability

### Logs

- Every `OnboardingActivationEvent` emission logs at INFO with `{ brandId, step, dwellMs }` (structured Pino; tenant-scoped).
- Webhook handler logs at INFO on each event received with `{ eventType, orgId }`; at WARN on signature-verification failure with the request's signature header redacted hash.
- IdentityProvider retry-queue logs at INFO on each attempt and at WARN on final failure with the underlying provider error code.

### Metrics

- `onboarding.signup.duration_ms` — `/api/auth/signup` p50/p90/p99.
- `onboarding.webhook.duration_ms` — webhook handler p50/p90/p99.
- `onboarding.checklist_patch.duration_ms` — `/v1/admin/onboarding/checklist` p50/p90/p99.
- `onboarding.activation.dwell_ms` — per-step dwell time histogram (tagged by `step`).
- `onboarding.ttfv.seconds` — full-flow TTFV (tagged by `useCasePath`, `sizeCategory`).

### Alerts (post-deploy, not in RFC scope)

- Page on `onboarding.signup.duration_ms` p99 > 5s for 5 consecutive minutes.
- Page on webhook handler 401 rate > 1% (could indicate signature-secret rotation issue).
- Slack on activation conversion drop > 20% week-over-week (informational, not paging).

---

## Decisions for the reviewer — RESOLVED in PR #196 Round 2

1. ✅ **Single migration vs. phased migrations** — Resolved: **single migration**. (Reviewer: "Agreed".) RFC unchanged.
2. 🔄 **`Brand.planTier: String?` placeholder vs. omit entirely** — Resolved: **omit entirely**. *(Reviewer: "Plan tier or method is unknown at this time. So I won't design for it yet. Suggest omitting entirely while remembering that we will have to revisit this when pricing model is finalized.")* RFC §2.1 updated: `planTier` removed; revisit-point flagged for the pricing-strategy job. §13 updated to clarify the slot is UX-only. Risks table item updated.
3. ✅ **ADR scope** — Resolved: **one ADR**. (Reviewer: "One ADR is fine".) ADR 0004 covers both OD-4 (activation funnel) and OD-5 (IdentityProvider abstraction). The optional ADR 0005 is dropped from the architecture-updates plan.
4. ✅ **Worker-side emission of `first_action_triggered`** — Resolved: **direct emission from the worker**. (Reviewer: "Agreed".) RFC unchanged.
