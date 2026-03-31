# Feature: Member Enrollment — Technical Design Evidence
Issue: #3
Feature Spec: [docs/feature-specs/3-member-enrollment.md](../feature-specs/3-member-enrollment.md)
RFC: [docs/rfcs/3-member-enrollment.md](../rfcs/3-member-enrollment.md)
PR: TBD

## Completeness Evidence
- Issue tagged with label `phase:design`: Yes
- Issue tagged with label `status:needs-review`: No (will be applied on PR creation)
- All files committed/synced to branch: No (pending PR creation)
- PR comments addressed: N/A (design not yet submitted for review)

### Traceability Matrix

| Requirement / User Story | RFC Section / Data Model | Status | Validation Plan Alignment |
|--------------------------|--------------------------|--------|--------------------------|
| **R1** — Member SHALL enroll via email + password | Frontend: `EnrollmentForm.tsx` with Clerk `useSignUp()`. API: `POST /v1/members/enroll` with `email`, `consentGiven`, etc. | ✅ Met | Integration: POST /v1/members/enroll with valid payload → 201; E2E: full email enrollment flow |
| **R2** — Member SHALL enroll via Google or Facebook SSO | Deferred per spec OQ-2 ("Recommend shipping email-only first; Clerk supports it natively"). Not in this RFC. | ⏭ Deferred | N/A — follow-up issue post-MVP |
| **R3** — Email uniqueness enforced per brandId, helpful error on duplicate | `Member @@unique([brandId, email])` constraint + route catches `P2002` → 409 `EMAIL_ALREADY_ENROLLED` | ✅ Met | Integration: duplicate email → 409; E2E: re-enroll shows error message |
| **R4** — Consent required before creating Member record | `EnrollMemberSchema.consentGiven: z.literal(true)` — form submission blocked; API returns 422 `CONSENT_REQUIRED` if absent | ✅ Met | Integration: missing consent → 422; E2E: submit without checkbox → blocked |
| **R5** — Record `consentGivenAt` (datetime) and `consentVersion` (string) on Member | `EnrollMemberSchema` fields: `consentGivenAt`, `consentVersion`. Stored on `Member` model at creation. | ✅ Met | Integration: confirm `consentGivenAt` NOT NULL after enrollment |
| **R6** — `brandId` from verified JWT / program context, never from body | Enrollment is public route; `brandId` derived from `programId` lookup server-side. `multiTenant` plugin rejects `brandId` in body. | ✅ Met | Integration: `brandId` in body → 422 |
| **R7** — Publish `ENROLLMENT` event to BullMQ after Member creation | `enqueueEvent({ eventType: 'enrollment', memberId, brandId, idempotencyKey })` called after `member.create`, non-blocking | ✅ Met | Integration: verify BullMQ job enqueued (via `InMemoryQueue` mock in test) |
| **R8** — Worker evaluates enrollment bonus rules atomically | Existing `processLoyaltyEvent` handles `enrollment` eventType via `evaluateRulesWithIds()` + `$transaction(LoyaltyEvent + pointsBalance)` | ✅ Met | Worker unit: enrollment event + matching rule → atomic award; no rule → 0 points |
| **R9** — Send welcome email after successful enrollment | `enqueueNotification({ channel: 'email', memberId, message })` called after member creation; processed by notifications worker (stub in MVP) | ✅ Met | Worker unit: notification enqueued; E2E: welcome screen shows (email delivery is stub in MVP) |
| **R10** — Redirect member to loyalty dashboard after enrollment | `WelcomeScreen.tsx` shows "Go to my Dashboard" CTA → navigates to `/dashboard`. `dashboard/page.tsx` calls `GET /v1/members/me`. | ✅ Met | E2E: click CTA → `/dashboard` accessible, authenticated |
| **R11** — Write `AuditEvent` on every Member creation | Audit plugin (`onResponse`) fires automatically on `POST /v1/members/enroll` mutation | ✅ Met | Integration: verify `AuditEvent` written with `action=members/enroll` after enrollment |
| **R12** — `Member.email` unique within `brandId` scope | `@@unique([brandId, email])` already in schema. No change needed. | ✅ Met | DB integration: duplicate insert → unique constraint violation |
| **R13** — `Member.pointsBalance` only modified inside transaction with `LoyaltyEvent` | Worker uses `prisma.$transaction([loyaltyEvent.create, member.update])` | ✅ Met | Worker unit: atomic transaction test |
| **R14** — `Member.emailOptIn`, `smsOptIn` default `false`, set only by explicit member action | New fields added: `emailOptIn Boolean @default(false)`, `smsOptIn Boolean @default(false)`. `EnrollMemberSchema` accepts both (default `false`). | ✅ Met | Integration: enrolled member has `emailOptIn = false`, `smsOptIn = false` unless explicitly set |
| **R15** — `Member.deletedAt` for soft deletes; no hard deletion except GDPR erasure | `Member.deletedAt DateTime?` already in schema. All queries filter `deletedAt: null`. | ✅ Met | Existing test coverage for soft delete pattern |
| **R16** — Enrollment form submission < 3s under normal load | Fastify schema-first routes, Prisma indexed queries, non-blocking BullMQ enqueue | ✅ Met (NFR) | Azure Monitor: P99 latency alert on `POST /v1/members/enroll` |
| **R17** — Enrollment bonus within 15 min of Member creation | BullMQ `loyalty-events` queue, concurrency 5, existing platform SLA | ✅ Met (NFR) | Worker unit + BullMQ queue depth alert |
| **R18** — WCAG 2.1 AA: keyboard navigable, ARIA labels | `EnrollmentForm.tsx` uses shadcn/ui (Radix UI primitives) — all Radix components are ARIA-compliant; Tailwind for layout | ✅ Met (NFR) | E2E: keyboard navigation test in Playwright |
| **R19** — Responsive, usable on mobile ≥ 375px | Tailwind CSS v4 utility classes; enrollment form uses single-column stack layout on mobile | ✅ Met (NFR) | E2E: Playwright viewport test at 375px |
| **AC: Email verification sent within 30 seconds** | Handled by Clerk SDK natively — Clerk sends verification email on `signUp.create()` with email+password. No custom implementation needed. | ✅ Met (via Clerk) | Manual: verify Clerk sends verification email during sign-up |
| **AC: Enrollment bonus points awarded per program config** | Worker evaluates `ACTIVE` EarningRules with `triggerEvent === 'enrollment'` against program config | ✅ Met | Worker unit: bonus rule present → points awarded |
| **AC: Duplicate enrollment prevented with merge/login prompt** | 409 response with `EMAIL_ALREADY_ENROLLED`; frontend shows "Already have an account? [Sign in]" error state | ✅ Met | E2E: re-enroll with same email → error with sign-in link |

**Traceability Matrix Result**: ✅ PASS — All requirements met or explicitly deferred with documented rationale (R2 / SSO deferred per spec OQ-2).

---

## Architecture Gaps Requiring User Decision

Two gaps flagged in [RFC Architecture Analysis](../rfcs/3-member-enrollment.md#architecture-analysis) need product decisions before implementation:

| Gap | Decision Required | RFC Section |
|-----|------------------|-------------|
| **Enrollment URL design**: `/enroll/{programId}` vs `/{brandSlug}/enroll` (requires `Brand.slug` field) | Choose Option A (programId), B (Brand.slug), or C (Program.slug) | §3a |
| **Breaking change**: duplicate email → 409 instead of current 200 idempotent | Confirm acceptable; assess any existing integrations relying on 200 | §3b |

---

## Due Diligence Evidence
- Reviewed feature spec in detail: Yes — all R1–R19 + acceptance criteria traced
- Reviewed codebase in detail: Yes — auth plugin, members route, BullMQ queue, worker, Prisma schema, shared schemas, existing tests
- Included detailed design, validation plan, test strategy in RFC: Yes

## Prototype & Validation Evidence
- [ ] Built simple proof-of-concept that works end-to-end
- [ ] Manually tested complete user flow (browser/curl)
- [x] Verified implementation patterns from existing analogous routes (`public.ts`, `events.ts`)
- [x] Identified minimal viable implementation (no auth plugin changes needed)
- [x] Documented what is new vs. reuse of existing patterns

## Continuous Learning
| Learning | Agent Rule Updates |
|----------|--------------------|
| Auth plugin falls back to `payload.sub` in dev but still does DB brand lookup — user-level JWTs fail for new members in all envs | No rule update needed — documented in RFC auth design section |
| `Brand` model has no slug field — enrollment URL assumed by spec doesn't map to actual schema | No rule update needed — flagged as architecture gap in RFC |
| `POST /v1/members/enroll` existing 200 idempotency is intentional design but conflicts with spec 409 requirement | No rule update needed — documented as breaking change in RFC |
