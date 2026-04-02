# Implementation Work List — Issue #3: Member Enrollment

**Branch**: `feature/3-issue-3`
**Worktree**: `CustomerEQ - Issue 3`
**RFC**: `docs/rfcs/3-member-enrollment.md`
**Spec**: `docs/feature-specs/3-member-enrollment.md`
**Issue type**: Feature

---

## Scope Summary

9 files to create or modify across 3 layers (DB, API, Web). Not a phase-split candidate.

### Design decisions locked in RFC:
- Duplicate email → **409** (change from current 200 in members.ts:38)
- Auth strategy → `{ config: { public: true } }` + body `clerkToken` verification (no auth plugin changes)
- `brandId` → always derived from `programId` lookup, never from request body
- Endpoint → `POST /v1/members/enroll` (existing route, not `/v1/auth/enroll` which spec draft used)
- SSO (Google/Facebook) → **deferred** per OQ-2; email+password only for MVP

---

## Implementation Checklist

### Layer 1: Database / Schema

- [x] `packages/database/prisma/schema.prisma`
  - `emailOptIn Boolean @default(false)` on `Member` — ✅ confirmed present
  - `smsOptIn Boolean @default(false)` on `Member` — ✅ confirmed present
  - `slug String? @unique` on `Program` — ✅ confirmed present

- [x] `packages/database/prisma/migrations/`
  - Migrations already present for all three fields

### Layer 2: Shared Schemas

- [x] `packages/shared/src/zod/member.schema.ts`
  - `emailOptIn`, `smsOptIn`, `consentGiven`, `clerkToken` all present
  - `EnrollMemberResponseSchema` (memberId, email, firstName, pointsBalance, programName, enrollmentBonusPending) present

### Layer 3: API

- [x] `apps/api/src/routes/members.ts`
  - `POST /v1/members/enroll` marked `{ config: { public: true } }`
  - Clerk token verified from body to extract `clerkUserId`
  - `brandId` derived from `programId` lookup
  - Duplicate email → 409 `EMAIL_ALREADY_ENROLLED`
  - After `member.create`: `enqueueEvent('enrollment')` non-blocking
  - After `member.create`: `enqueueNotification` (welcome) non-blocking
  - Returns `EnrollMemberResponse` shape (201)
  - Returns 422 `CONSENT_REQUIRED` if `consentGiven !== true`
  - `GET /v1/members/me` endpoint (auth required, returns full profile)

- [x] `apps/api/src/routes/public.ts`
  - `GET /v1/public/programs/by-slug/:slug` — no auth, returns programId, programName, brandId, brandName

### Layer 4: Frontend (Next.js)

- [x] `apps/web/src/app/(member)/[programSlug]/enroll/page.tsx`
  - Server component: fetches program info via `GET /v1/public/programs/by-slug/:slug`
  - Renders 404 if not found; renders `<EnrollmentForm>` if found

- [x] `apps/web/src/app/(member)/[programSlug]/enroll/EnrollmentForm.tsx`
  - Client component with Clerk `useSignUp()` form
  - Fields: email, password, firstName (required), lastName (required), phone (optional)
  - emailOptIn toggle (default off), smsOptIn toggle (default off)
  - Consent checkbox (required) with Privacy Policy + Terms links
  - Handles 409 → "Already enrolled? Sign in" message
  - Handles 422 → consent error

- [x] `apps/web/src/app/(member)/[programSlug]/enroll/WelcomeScreen.tsx`
  - Shows program name, member first name, enrollment bonus pending state
  - CTA: "Go to my Dashboard" → `/dashboard`

- [x] `apps/web/src/app/(member)/dashboard/page.tsx`
  - Client component: calls `GET /v1/members/me/balance` for points balance
  - Renders points balance card + recent activity table

- [x] `apps/web/src/middleware.ts`
  - Added `'/(.*)/enroll'` to `isPublicRoute` matcher so unauthenticated users can reach enrollment pages

### Layer 5: Tests

- [x] `apps/api/test/integration/members.test.ts`
  - Fixed: duplicate-email → 409 `EMAIL_ALREADY_ENROLLED` (was 200)
  - Added: valid payload → 201 EnrollMemberResponse shape
  - Added: `consentGivenAt NOT NULL` DB assertion
  - Added: `consentGiven: false` → 422 `CONSENT_REQUIRED`
  - Added: missing `consentGivenAt` → 422
  - Added: cross-brand same email → 201 (different memberId)
  - Added: invalid `programId` → 404
  - Added: `GET /v1/members/me` valid auth → 200 full profile
  - Added: `GET /v1/members/me` no member → 404
  - Added: `emailOptIn`/`smsOptIn` DB persistence check

- [x] `packages/shared/src/zod/member.schema.test.ts`
  - `consentGiven: true` → valid (26 tests total, all passing)
  - `consentGiven: false` → invalid (CONSENT_REQUIRED)
  - `emailOptIn` defaults to `false`
  - `smsOptIn` defaults to `false`

- [x] `apps/web/test/e2e/enrollment.spec.ts` (new file, 10 tests)
  - Required-field validation
  - Consent gate blocks submit
  - 409 duplicate → error banner + sign-in link
  - Happy path → welcome screen
  - "Go to my Dashboard" → /dashboard
  - Unknown slug → 404
  - Responsive: 375px, 768px, 1280px

---

## CI Gate Results (Phase 4)

| Command | Result |
|---------|--------|
| `pnpm test:smoke` | ✅ 8/8 packages, all tests passing |
| `pnpm typecheck` | ✅ 13/13 packages |
| `pnpm lint` | ✅ 3/3 packages |
| `pnpm test:integration` | ⚠️ DB offline in dev env — expected per CLAUDE.md |
| `pnpm test:e2e` | ⚠️ Requires dev server — not run in CI without server |

---

## Validation Requirements

| Type | Required | Status |
|------|----------|--------|
| `uiValidationRequired` | ✅ Yes | Pending — see `docs/evidence/3-ui-polish-validation.md` |
| `mobileValidationRequired` | ✅ Yes | E2E tests cover 375px, 768px, 1280px viewports |
| Integration tests | ✅ Yes | Written; run with live DB |
| Unit tests | ✅ Yes | 240/240 passing |
| E2E tests | ✅ Yes | 10 tests written in enrollment.spec.ts |
| Smoke (`pnpm test:smoke`) | ✅ Yes | Passing |

---

## Known Deferrals / Open Questions

| ID | Decision |
|----|----------|
| OQ-2 | Social login (Google/Facebook OAuth) — **deferred to Phase 2** |
| OQ-1 | Phone field — **optional** per spec |
| OQ-3 | `consentVersion` — default `'privacy-v1.0'` hardcoded in schema; SystemConfig table deferred |
| OQ-4 | Embeddable widget — **deferred to Phase 2**; CustomerEQ-hosted portal only for MVP |
