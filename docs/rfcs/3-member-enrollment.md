# RFC: Member Enrollment

Issue: #3
Owner: Claude (FRAIM technical-design job)
Date: 2026-03-31
Status: Draft

---

## Customer

**Loyalty Member** — A customer of a mid-market brand who arrives at the brand's CustomerEQ portal via post-purchase email, in-store QR code, or marketing campaign. They want to join the loyalty program to start earning points.

**Secondary actor**: **Admin / Program Owner** — has already configured the loyalty program (Issue #2) including any enrollment bonus rules.

---

## Customer Problem Being Solved

Without enrollment, a customer has no identity in the loyalty system. The enrollment flow is the zero moment of truth: a frictionless sign-up experience determines whether a new member engages or abandons. The current code has a partially implemented skeleton but is missing the event pipeline (enrollment bonus), correct duplicate handling, required schema fields, and the frontend flow entirely.

---

## User Experience That Will Solve the Problem

### API flow (happy path)

1. Member navigates to `/{programSlug}/enroll` in their browser (e.g., `/acme-rewards-us/enroll`).
2. Next.js page calls `GET /v1/public/programs/by-slug/{programSlug}` to fetch program name and branding (no auth).
3. Member fills in email + password (or clicks Google/Facebook — deferred per OQ-2).
4. Next.js calls Clerk's `signUp.create()` → Clerk returns a `sessionToken` (user-level JWT).
5. Next.js calls `POST /v1/members/enroll` with the Clerk token in the `Authorization: Bearer` header plus enrollment fields.
6. API verifies the Clerk token, derives `brandId` from `programId`, creates the `Member` record, enqueues an `enrollment` loyalty event, and enqueues a welcome notification.
7. API responds `201` with `{ memberId, email, firstName, pointsBalance: 0, programName, enrollmentBonusPending: true }`.
8. Next.js shows the Welcome Screen with the points balance (or pending-bonus state).
9. Member clicks "Go to my Dashboard" → navigates to `/dashboard`.
10. Within 15 minutes, the BullMQ worker processes the `enrollment` event, awards bonus points (if an `ENROLLMENT` EarningRule exists), and dispatches the welcome email notification.

### Duplicate enrollment

If `POST /v1/members/enroll` is called with an email already enrolled under the same `brandId`, the API returns `409` with `{ error: "EMAIL_ALREADY_ENROLLED", message: "..." }` — member is prompted to sign in.

---

## Technical Details

### Files to create or modify

| File | Change |
|------|--------|
| `packages/database/prisma/schema.prisma` | Add `emailOptIn Boolean @default(false)`, `smsOptIn Boolean @default(false)` to `Member` model; add `slug String? @unique` to `Program` model |
| `packages/database/prisma/migrations/` | Two migrations: `add_member_opt_in_fields`, `add_program_slug` |
| `packages/shared/src/zod/member.schema.ts` | Add `emailOptIn`, `smsOptIn`, `consentGiven` to `EnrollMemberSchema`; add `EnrollMemberResponseSchema` |
| `apps/api/src/routes/members.ts` | (1) Change duplicate-email handling from `200` to `409`. (2) Enqueue `enrollment` loyalty event after member creation. (3) Enqueue welcome notification. (4) Return `EnrollMemberResponse` shape. (5) Add `GET /v1/members/me` full profile endpoint. (6) Change auth strategy for enrollment (see Auth Design below). |
| `apps/api/src/routes/public.ts` | Add `GET /v1/public/programs?brandSlug={slug}` — returns `{ programId, programName, brandName, brandId }` (no auth). |
| `apps/api/src/plugins/auth.ts` | Handle enrollment route: accept user-level Clerk JWT (without org claim) and set `request.brandId = null`; route derives brandId from programId. |
| `apps/web/src/app/(member)/[programSlug]/enroll/page.tsx` | Server component — fetches program info via `GET /v1/public/programs/by-slug/:slug`, renders enrollment form |
| `apps/web/src/app/(member)/[programSlug]/enroll/EnrollmentForm.tsx` | Client component — Clerk `useSignUp()` form: email, password, firstName, lastName, opt-ins, consent checkbox |
| `apps/web/src/app/(member)/[programSlug]/enroll/WelcomeScreen.tsx` | Client component — shown on successful enrollment; displays points balance + pending bonus state |
| `apps/web/src/app/(member)/dashboard/page.tsx` | Member dashboard shell — authenticated, shows balance (calls `GET /v1/members/me`) |
| `apps/api/test/integration/members.test.ts` | Update duplicate-email test from `200` to `409`; add tests for new response shape, enrollment event enqueueing |
| `apps/web/test/e2e/enrollment.test.ts` | New E2E: full enrollment flow — enroll, see welcome screen, navigate to dashboard |
| `packages/config/src/test-utils/factories.ts` | Verify `createMember` / `createConsentedMember` still work after schema migration |

### API Surface Changes

#### Modified: `POST /v1/members/enroll`

**Auth**: Accepts a Clerk user-level JWT (not org JWT). `brandId` is derived server-side from `programId` lookup — never from request body.

**Request** (updated schema):
```json
{
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+1-555-0100",
  "programId": "prog_xxx",
  "emailOptIn": false,
  "smsOptIn": false,
  "consentGiven": true,
  "consentGivenAt": "2026-03-31T10:00:00Z",
  "consentVersion": "privacy-v1.0"
}
```

**Validation rules** (Zod):
- `email`: required, valid email format
- `consentGiven`: must be `true` (if `false` or absent → 422 `CONSENT_REQUIRED`)
- `consentGivenAt`: required ISO 8601 datetime
- `programId`: required
- `firstName`, `lastName`: optional string max 50
- `emailOptIn`, `smsOptIn`: boolean, default `false`

**Responses**:

`201 Created` (new enrollment):
```json
{
  "memberId": "mbr_xxx",
  "email": "jane@example.com",
  "firstName": "Jane",
  "pointsBalance": 0,
  "programName": "Acme Rewards",
  "enrollmentBonusPending": true
}
```

`409 Conflict` (duplicate email within brandId):
```json
{
  "error": "EMAIL_ALREADY_ENROLLED",
  "message": "This email is already enrolled in this program."
}
```

`422 Unprocessable Entity` (consent not given, missing required fields):
```json
{
  "error": "CONSENT_REQUIRED",
  "message": "You must accept the privacy policy and terms to enroll."
}
```

`404 Not Found` (programId not found for brandId):
```json
{ "error": "Program not found" }
```

#### New: `GET /v1/public/programs/by-slug/:slug`

No auth. Returns program info for the enrollment page. Uses `Program.slug` — the human-readable, globally unique program identifier (e.g., `acme-rewards-us`).

```
GET /v1/public/programs/by-slug/acme-rewards-us

→ 200 OK
{
  "programId": "prog_xxx",
  "programName": "Acme Rewards US",
  "programSlug": "acme-rewards-us",
  "brandId": "brand_xxx",
  "brandName": "Acme Corp"
}

→ 404 Not Found (slug not found or program not ACTIVE)
```

#### New: `GET /v1/members/me`

Auth: Clerk org JWT (member is enrolled). Returns full member profile.

```
GET /v1/members/me
Authorization: Bearer <member-org-jwt>

→ 200 OK
{
  "id": "mbr_xxx",
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "pointsBalance": 500,
  "tier": null,
  "enrollmentDate": "2026-03-31T10:00:00Z",
  "emailOptIn": false,
  "smsOptIn": false
}
```

### Data Model / Schema Changes

**`Member` model** — add two fields:

```prisma
emailOptIn  Boolean  @default(false)
smsOptIn    Boolean  @default(false)
```

Migration: `ALTER TABLE members ADD COLUMN email_opt_in BOOLEAN NOT NULL DEFAULT false, ADD COLUMN sms_opt_in BOOLEAN NOT NULL DEFAULT false;`

No changes to indexes needed (these fields are not queried by filter).

**`Program` model** — add slug field:

```prisma
slug  String?  @unique
```

Migration: `ALTER TABLE programs ADD COLUMN slug VARCHAR(100) UNIQUE;`

Nullable for backwards-compatibility with existing programs. Required for new programs. Auto-generated from `name` on creation (e.g., "Acme Rewards US" → `acme-rewards-us`), editable by admin. The enrollment URL `/{programSlug}/enroll` is only live once a slug is set on the program.

### Auth Design for Enrollment Endpoint

The enrollment endpoint is a special case: the member is NEW and does not yet have a Clerk organization membership (needed for the standard `brandId`-from-org-JWT pattern). Reading `apps/api/src/plugins/auth.ts` confirms that even the dev-mode fallback resolves `brandId` from `clerkOrgId` — a user-level sub won't match, so org-JWT auth fails for a brand-new member regardless of environment.

**Design decision**: Mark `POST /v1/members/enroll` as `{ config: { public: true } }`. The route accepts an optional `clerkToken` in the request body, calls `verifyToken(clerkToken)` internally to extract `clerkUserId`, and derives `brandId` from the `programId` lookup. No auth plugin changes are needed.

This is consistent with the existing public route pattern (`/v1/public/surveys/:id/respond` also verifies caller identity from the request body rather than a header JWT). After member creation, the frontend uses standard org-JWT auth for all subsequent member routes (`GET /v1/members/me`, etc.).

### Event Pipeline

After `member.create` succeeds, the API fires two non-blocking enqueue calls:

```typescript
// 1. Enrollment bonus pipeline
enqueueEvent({
  brandId,
  memberId: member.id,
  eventType: 'enrollment',
  payload: { programId, programName },
  idempotencyKey: `enrollment:${member.id}`,
  ingestedAt: new Date().toISOString(),
}).catch((err) => log.error({ err }, 'Failed to enqueue enrollment event'))

// 2. Welcome notification
enqueueNotification({
  memberId: member.id,
  brandId,
  channel: 'email',
  message: `Welcome to ${program.name}! You're now enrolled.`,
  metadata: { programName: program.name, enrollmentBonusPending: true },
}).catch((err) => log.error({ err }, 'Failed to enqueue welcome notification'))
```

The existing `processLoyaltyEvent` worker handles the `enrollment` eventType naturally — it evaluates all `ACTIVE` EarningRules with `triggerEvent === 'enrollment'` and awards points atomically. No worker changes needed.

### Failure Modes & Timeouts

| Scenario | Behavior |
|----------|----------|
| BullMQ enqueue fails after member created | Member record exists, bonus not awarded. Non-blocking catch logs the error. The idempotency key prevents double-award if re-enqueued manually. |
| Clerk token verification fails | 401 `UNAUTHORIZED`. Member record not created. |
| Duplicate `programId` + `email` race condition | DB `@@unique([brandId, email])` constraint throws `P2002` → catch and return `409`. |
| Prisma transaction fails (transient DB error) | 500. Member not created, no events enqueued. Client can retry. |
| Email provider down | Welcome notification job will retry via BullMQ backoff policy. Enrollment itself succeeds. |

### Telemetry

- Pino structured log on member creation: `{ event: 'member.enrolled', memberId, brandId, programId }`
- Pino structured log on enrollment event enqueue: `{ event: 'enrollment.event.enqueued', memberId, jobId }`
- Existing `AuditEvent` plugin fires automatically on `POST /v1/members/enroll` (action=`members/enroll`, resourceId=`memberId`)

---

## Confidence Level

**90 / 100**

All implementation decisions are clear from codebase analysis. The 10-point gap is for the Clerk user-level JWT without org claim in production — the auth plugin extension is designed but untested against real Clerk in the multi-tenant enrollment scenario. This is low-risk and can be validated with a single manual curl test before the feature ships.

---

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---------------|-----------------|-------------------|
| New member submits valid email+password form | 201, Member record in DB, enrollment event enqueued | Integration: POST /v1/members/enroll |
| Member submits without checking consent checkbox | 422 CONSENT_REQUIRED | Integration + E2E |
| Member submits duplicate email for same brand | 409 EMAIL_ALREADY_ENROLLED | Integration |
| Member submits duplicate email for different brand | 201, separate member record | Integration |
| Enrollment event processed by worker | LoyaltyEvent written, pointsBalance updated atomically | Worker unit test |
| No enrollment bonus rule configured | pointsBalance = 0, no LoyaltyEvent | Worker unit test |
| Enrollment bonus rule exists | pointsBalance = bonus points, LoyaltyEvent with rulesApplied | Worker unit test |
| brandId injected from request body | 422 (rejected by multiTenant plugin) | Integration |
| GET /v1/members/me with valid JWT | 200 with full member profile | Integration |
| Full enrollment E2E | Welcome screen shown, dashboard accessible | E2E (Playwright) |

---

## Test Matrix

### Unit (Vitest — `packages/shared` and `apps/worker`)
- `EnrollMemberSchema`: validates `consentGiven: true` required; rejects false/absent; validates `emailOptIn`, `smsOptIn` defaults
- `EnrollMemberSchema`: validates `email` format, `programId` required, `consentGivenAt` ISO 8601
- `processLoyaltyEvent` with `eventType: 'enrollment'` and matching EarningRule → awards points atomically (existing test suite covers this pattern — add `enrollment` variant)
- `processLoyaltyEvent` with `eventType: 'enrollment'` and no matching rule → 0 points, no LoyaltyEvent

### Integration (Vitest + Supertest — `apps/api/test/integration/members.test.ts`)
- `POST /v1/members/enroll` — valid payload → 201, Member in DB, `consentGivenAt` set
- `POST /v1/members/enroll` — duplicate email same brand → 409 `EMAIL_ALREADY_ENROLLED` (**update existing 200 test**)
- `POST /v1/members/enroll` — duplicate email different brand → 201
- `POST /v1/members/enroll` — `consentGiven: false` → 422
- `POST /v1/members/enroll` — missing `consentGivenAt` → 422
- `POST /v1/members/enroll` — invalid `programId` → 404
- `GET /v1/members/me` — valid org JWT → 200 with full profile
- `GET /v1/members/me` — no matching member → 404
- `GET /v1/public/programs/by-slug/:slug` — found → 200; not found → 404
- Confirm `consentGivenAt` is NOT NULL after enrollment
- Confirm `@@unique([brandId, email])` blocks duplicate insert

### E2E (Playwright — `apps/web/test/e2e/enrollment.test.ts`)
- Navigate to `/{programSlug}/enroll` → enrollment form visible
- Submit valid email+password+consent → welcome screen shown with points balance
- Click "Go to my Dashboard" → dashboard accessible, authenticated
- Attempt to re-enroll with same email → error message shown ("Already enrolled")
- Attempt to submit without consent checkbox → submit blocked (form validation)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Clerk `verifyToken()` in public enrollment route fails on token format changes | Low | Medium | Enrollment route handles its own Clerk token verification (no auth plugin involvement); validate with manual curl pre-ship |
| Race condition on duplicate enrollment (two concurrent POST requests) | Low | Medium | DB `@@unique([brandId, email])` catches at Prisma level; catch `P2002` error code and return 409 |
| Enrollment bonus awarded twice (retry + idempotency failure) | Low | Medium | `idempotencyKey: enrollment:${memberId}` on the BullMQ job; worker checks existing `LoyaltyEvent` with same key before processing |
| Worker down → enrollment bonus never awarded | Low | Low | BullMQ job persists in Redis; worker retries on restart. Alert if loyalty-events queue depth grows >100 |
| `emailOptIn` / `smsOptIn` migration fails on existing members | Low | Low | `DEFAULT false` is backwards-compatible; existing rows get `false` with zero downtime |
| Breaking change: duplicate email now 409 instead of 200 | Certain | Low | Update the one existing integration test (`members.test.ts:43`) that expects 200 |

---

## Spike Findings

No spike required. All implementation patterns are established in the codebase:
- BullMQ enqueueing pattern: see `apps/api/src/routes/public.ts` → `enqueueEvent()`
- Auth plugin extension: see `apps/api/src/plugins/auth.ts` (test mode header pattern shows the plugin is already designed for extensibility)
- Prisma unique constraint error handling: `P2002` error code used in `redemptions.ts`
- Notification enqueueing: see `apps/api/src/routes/public.ts` → `enqueueNotification()`

The only non-trivial design decision is the Clerk enrollment auth strategy, which is resolved by design (body token + programId-derived brandId) without needing a code proof-of-concept.

---

## Observability

| Signal | Details |
|--------|---------|
| Structured log | `member.enrolled` on successful creation (Pino, level `info`) |
| Structured log | `enrollment.event.enqueue.failed` on BullMQ failure (Pino, level `error`) |
| AuditEvent | Automatic via audit plugin on every `POST /v1/members/enroll` mutation |
| BullMQ dashboard | `loyalty-events` queue depth and job success/failure rates (existing) |
| Azure Monitor | API response time for `POST /v1/members/enroll` — P99 target < 3s (NFR R16) |

---

## Architecture Analysis

### 1. Patterns Correctly Followed

| Pattern | Architecture Source | How RFC Follows It |
|---------|--------------------|--------------------|
| Event-driven processing | §6 Design Patterns | Enrollment event enqueued via `enqueueEvent()` after member creation; API returns immediately without waiting for worker |
| Append-only loyalty ledger | §6 Design Patterns | Enrollment bonus processed by existing `processLoyaltyEvent` worker; `LoyaltyEvent` + `pointsBalance` updated atomically in `$transaction` |
| Multi-tenant isolation | §6 Design Patterns | `brandId` derived server-side from `programId` lookup, never accepted from request body |
| Zod validation (shared schemas) | §2 Tech Stack | `EnrollMemberSchema` in `packages/shared/src/zod/member.schema.ts` |
| Audit logging | §4.2 Fastify Plugins | Audit plugin fires automatically on every `POST /v1/members/enroll` mutation |
| GDPR/CCPA by default | §6 + §10 | `consentGivenAt`, `consentVersion`, soft delete, opt-in defaults `false` |
| Centralized test infrastructure | §9.2 | Uses `createMember`, `createConsentedMember` from `@customerEQ/config/test-utils` |
| Public route pattern | §4.1 API Routes | Enrollment uses `{ config: { public: true } }`, consistent with `/v1/public/*` |
| Idempotency | §6 Design Patterns | `idempotencyKey: enrollment:${memberId}` prevents double-award on retry |
| Notification pipeline | §4.3 BullMQ Workers | Welcome email enqueued to `notifications` queue — processed by existing stub worker |

---

### 2. Patterns Missing from Architecture

These are patterns introduced by this RFC that the architecture document does not yet cover. They should be added to `docs/architecture/architecture.md` during the address-feedback phase.

#### 2a. Public enrollment route with internal Clerk token verification

**What**: A route that is publicly accessible (`{ config: { public: true } }`) but optionally verifies a Clerk user-level JWT from the request body (not a header org token) to obtain `clerkUserId`. `brandId` is derived from the `programId` parameter, not from the JWT.

**Why needed**: New members enrolling for the first time have no Clerk organization membership yet — they cannot produce an org-scoped JWT. This pattern covers the bootstrapping case between Clerk user creation and org membership assignment.

**Suggested architecture doc addition**: Add a note to §4.2 Fastify Plugins and §4.1 API Routes describing the "enrollment public route" variant: public route that optionally accepts a Clerk user JWT in the request body for `clerkUserId` extraction only.

#### 2b. `emailOptIn` and `smsOptIn` on Member model

**What**: Two GDPR/CCPA-required opt-in flags on the `Member` model, both defaulting to `false` and only set to `true` by explicit member action at enrollment time.

**Why needed**: Required for CCPA compliance (right to opt out of marketing communications) and good practice under GDPR. The architecture §10 Compliance Architecture references GDPR/CCPA requirements but the `Member` model description in §4.4 does not list these fields.

**Suggested architecture doc addition**: Update `Member` model description in §4.4 to include `emailOptIn`, `smsOptIn`.

---

### 3. Patterns Incorrectly Followed (Design Gaps Requiring Decision)

#### 3a. `Program.slug` field does not exist — ✅ RESOLVED

**Decision**: Add `Program.slug String @unique` (globally unique, set by admin at program creation, auto-generated from program name).

**Rationale**: A brand may operate multiple simultaneous programs for different geographies, user segments, or benefit structures (e.g., a tiered bonus program for premium customers alongside a simple points program for general customers). Using a brand-level slug (`Brand.slug`) would require a secondary selector or query param to identify *which* program a member is enrolling in — eliminating the benefit of a human-readable URL.

Program-level slugs (`/acme-rewards-us/enroll`, `/acme-elite/enroll`) encode exactly what the member is enrolling in, with no ambiguity. Each QR code, marketing link, or in-store placard points to a specific program. Global uniqueness is chosen over brand-scoped uniqueness to keep URLs to a single path segment — admin-set slugs are brand-prefixed by convention (e.g., `acme-gold`, not just `gold`), making collisions unlikely in practice.

**Schema change**: `Program.slug String? @unique` (nullable for existing programs; required for new programs going forward).

**Migration**: `ALTER TABLE programs ADD COLUMN slug VARCHAR(100) UNIQUE;` — nullable, backwards-compatible. Existing programs will need slugs set before their enrollment URLs go live.

**URL structure**: `/{programSlug}/enroll` (e.g., `/acme-rewards-us/enroll`)

**Files updated below** to reflect this decision.

#### 3b. `POST /v1/members/enroll` duplicate-email behavior — ✅ RESOLVED

**Decision**: Proceed with 409. The 200 idempotent behavior was an internal implementation detail not exposed to any external integration. The one test asserting 200 (`members.test.ts:43`) will be updated to expect 409. The member-facing enrollment form should respond to 409 by showing "Already have an account? Sign in instead."
