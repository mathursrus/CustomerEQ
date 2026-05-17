# Issue #378 — Implementation Standing Work List

Issue: [#378](https://github.com/mathursrus/CustomerEQ/issues/378)
Branch: `feature/378-personalized-survey-links-for-byo-email-distribution-tokenized-batches-sampling-and-recurring-waves`
Spec: [`docs/feature-specs/378-personalized-survey-links-byo-email.md`](../feature-specs/378-personalized-survey-links-byo-email.md)
RFC: [`docs/rfcs/378-personalized-survey-links-byo-email.md`](../rfcs/378-personalized-survey-links-byo-email.md)
Owner: Claude (claude-opus-4-7) / manohar.madhira@outlook.com
Phase: implement-scoping ✅ → implement-tests
Last touched: 2026-05-17

This file is the durable working memory for #378 implementation scope, validation requirements, and in-flight decisions until `work-completion` cleans up.

---

## Scope size + slicing posture

**File modifications projected: ~26** (well above the scope-slicing skill's 15-file threshold). This is a Phase-Splitting Candidate per the skill; per project Rule 26 splitting into multiple PRs is forbidden — all phase artifacts ship in one PR for one issue. The split happens at the **commit-slice** layer inside this PR, not at the PR layer.

**Commit-slice plan (sequenced; each is a `git commit` on this branch):**

| Slice | Commit subject prefix | Files touched | Why this order |
|---|---|---|---|
| S1 | `impl(#378): schema + migration` | `packages/database/prisma/schema.prisma` + new migration dir | Migration must land first; Prisma client regen everywhere depends on it |
| S2 | `impl(#378): shared utils — tokens, datetime, zod` | `packages/shared/src/{distributionTokens.ts,datetime.ts,zod/distributionBatch.schema.ts}` + tests + `package.json` (`date-fns-tz`) | Pure functions; everything downstream imports from here |
| S3 | `impl(#378): API admin routes` | `apps/api/src/routes/distributionBatches.ts` + `utils/distributionListParser.ts` + `app.ts` register + integration tests | All 5 admin endpoints (preview / generate / list / detail / regenerate / expiry-edit); transactional core |
| S4 | `impl(#378): API public token + respond` | `apps/api/src/routes/public.ts` (additive token field + GET token-status + DELETE trigger endpoint) + integration tests | Pairs with S3 mints; deletion of trigger is part of D5/R3-15 |
| S5 | `impl(#378): web admin Distribute pages` | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/**` + components + DistributionSection tile + filter row | Pure UI; consumes S3 endpoints |
| S6 | `impl(#378): web respondent tokenized form` | `apps/web/src/app/survey/[id]/r/[token]/page.tsx` + `apps/web/src/app/survey/[id]/page.tsx` PII-removal | Pairs with S4 |
| S7 | `impl(#378): demo storefront migration + config` | `examples/acme-coffee-demo/**` + `fraim/config.json` | Per Rule 26; landed on same PR |
| S8 | `impl(#378): E2E + manual validation evidence` | `apps/web/test/e2e/**` + `docs/evidence/378-ui-polish-validation.md` | After UI is built |
| S9 | `impl(#378): architecture.md updates (M-1..M-4)` | `docs/architecture/architecture.md` | Phase 10 artifact |
| S10 | `retro(#378)` | `docs/retrospectives/manohar.madhira@outlook.com-issue-378-implement-postmortem.md` + L0 coaching moments | Phase 13 artifact |

Each slice ends green: typecheck + lint + smoke tests. Integration tests for new endpoints land in the same slice that introduces them.

---

## Validation Requirements

Recorded per `implement-scoping` skill step #4.

| Requirement | Value | Reason |
|---|---|---|
| `uiValidationRequired` | **YES** | New admin pages (Distribute, Batch detail), new admin filter row, new respondent route; spec §1–§5; mock at `docs/feature-specs/mocks/378-distribute-flow.html` |
| `mobileValidationRequired` | **NO** | Admin surface is desktop-first per `docs/architecture/architecture.md`; respondent form is responsive but no emulator/device-profile validation called out by spec |
| `browserBaselineRequired` | **YES (responsive)** | Respondent form is mobile-responsive (existing #241 standalone-form chrome reused); Distribute admin page tested at ≥1280px desktop only per existing admin convention |
| Browser targets | Chrome (Playwright default), one Firefox + WebKit smoke per surface | Matches existing E2E config |
| Backend validation | **REQUIRED** — `pnpm test:integration` against real Postgres (Docker) | Migration moves a unique constraint on a live table — per RFC R-A (high-severity risk) and L1 mistake-pattern recurrence #170 PR1; mock DB is insufficient |
| Type/lint validation | `pnpm build && pnpm typecheck && pnpm lint` zero-error | Project Rule 11 |
| Smoke gate | `pnpm test:smoke` green | Project Rule 11 |
| BAML eval validation | N/A | No LLM call paths touched in #378 |
| Security review (Phase 6) | **REQUIRED** | Token-authorized public endpoint + hash-at-rest credential + RBAC introduction (`survey.distribute`) — exactly the class of change `/security-review` exists to gate |
| Manual browser validation | **REQUIRED** for the happy-path operator journey + 4 respondent error states | Spec V0 acceptance signal; project Rule 18 (no API-shortcut "validation") |

UI Polish Validation evidence will land at `docs/evidence/378-ui-polish-validation.md` (Phase 5 deliverable).

---

## Implementation Checklist

Items are tagged with the spec Requirement ID (R1–R29) and/or RFC section they trace to. **All items below must be marked `[x]` before Phase 9 (implement-completeness-review) can pass.**

### S1 — Schema + migration

- [ ] `packages/database/prisma/schema.prisma` — add `DistributionBatch` model per RFC §Schema (cuid id, `surveyId`, `brandId`, `label`, `surveyNameInMail`, `audienceSpec` JSON, `expiresAt`, `samplingSeed?`, `createdBy`, `createdAt`, indexes on `[surveyId, createdAt]` + `[brandId, expiresAt]`, `@@map("distribution_batches")`)
- [ ] schema.prisma — add `SurveyDistributionToken` model (`batchId`, `memberId`, `brandId`, `tokenHash` unique, `tokenPrefix`, `expiresAt`, `consumedAt?`, unique `[batchId, memberId]`, indexes on `[tokenHash]` + `[batchId, consumedAt]`, `@@map("survey_distribution_tokens")`)
- [ ] schema.prisma — modify `SurveyDistribution`: add `batchId String?` + relation; **drop `@@unique([surveyId, memberId])`**, add `@@unique([batchId, memberId])` (Postgres NULL-distinct semantics preserve legacy rows)
- [ ] schema.prisma — modify `SurveyResponse`: add `distributionBatchId String?` + `distributionTokenId String?` + relations + new index `[distributionBatchId, completedAt]`
- [ ] schema.prisma — add `BULK_DISTRIBUTION` to `MemberEnrolledVia` enum
- [ ] schema.prisma — add back-relations on `Survey` (→ `DistributionBatch[]`) and `Member` (→ `SurveyDistributionToken[]`)
- [ ] `packages/database/prisma/migrations/<YYYYMMDDNNNNNN>_distribution_batches/migration.sql` — hand-written DDL per RFC §Migration (claim a fresh timestamp **after** `20260514120000`; verify no collision via `git log origin/main --oneline -- packages/database/prisma/migrations/` per Rule R22c)
- [ ] Run `pnpm db:generate` (Prisma client codegen) — required because root `package.json` postinstall depends on it (per project CLAUDE.md "Fresh Worktree / Prisma Client")
- [ ] Run `pnpm prisma migrate dev --name distribution_batches` against the Docker Postgres — verifies the migration applies cleanly on a populated dev DB

### S2 — Shared utils

- [ ] `packages/shared/src/distributionTokens.ts` — `mintToken()` returns `{ plaintext, hash, prefix }` (24 random bytes base64url, SHA-256 hash, first-8 prefix); `hashToken(plaintext)` helper
- [ ] `packages/shared/src/distributionTokens.test.ts` — unit: entropy bound (length, charset), hash determinism, prefix length
- [ ] `packages/shared/src/datetime.ts` — `formatInBrandTz(date, brandTimezone, brandLocale, format?)` and `endOfDayInBrandTz(localDate, brandTimezone)` wrapping `date-fns-tz`; `resolveLocale(bcp47)` switch with fallback to `enUS`
- [ ] `packages/shared/src/datetime.test.ts` — unit: 15 spike cases (DST forward/back, IST half-hour, NZ Southern-hemisphere, boundary days) — copy fixture from `docs/evidence/378-tz-spike/spike.mjs`
- [ ] `packages/shared/src/zod/distributionBatch.schema.ts` — Zod schemas: `PreviewBatchRequest` (discriminated by `mode`), `GenerateBatchResponse`, `EditExpiryRequest`, `RegenerateTokensRequest`, `RegenerateTokensResponse`, `BatchDetailResponse`, `TokenStatusResponse` (uniform shape, varying state enum)
- [ ] `packages/shared/src/zod/distributionBatch.schema.test.ts` — schema unit tests (round-trip + `.strict()` rejection of stray fields, esp. `plaintext` on `BatchDetailResponse`)
- [ ] `packages/shared/src/zod/responseSubmit.schema.ts` — extend `PublicSurveyResponseSchema` with optional `token` field (export as `PublicSurveyResponseSchemaV2 = PublicSurveyResponseSchema.extend({ token: z.string().optional() })`)
- [ ] `packages/shared/package.json` — add `date-fns-tz` + `date-fns` as runtime deps
- [ ] `packages/shared/src/index.ts` — re-export new modules

### S3 — API admin routes

- [ ] `apps/api/src/utils/distributionListParser.ts` — new parser: paste shape (newline/comma/semicolon split + `Name <email>` form + `Brand.memberIdentifierKind` tie-breaker) + CSV header inference (aliases per spec R6) + per-cell fallback. Returns `{ rows: { identifier, identifierKind, firstName?, lastName? }[], unmatched: string[] }`. Reuses `parseCsvRaw` from `apps/api/src/utils/csvParser.ts`.
- [ ] `apps/api/src/utils/distributionListParser.test.ts` — unit tests: brand-kind tie-breaker (R6 ACs), `Name <email>` single + multi-token parsing, separator mixes, OQ-S4 empty-column fallback, 10k paste cap, 100k CSV cap, header alias coverage
- [ ] `apps/api/src/routes/distributionBatches.ts` — new route module with 6 admin endpoints:
  - `POST /v1/surveys/:id/distribution-batches/preview` — idempotent (no rows); CSV upload via `text/csv` raw body + `?filename=...` query param; 11MB bodyLimit
  - `POST /v1/surveys/:id/distribution-batches` — atomic `prisma.$transaction()`: write batch + resolve-or-enroll Custom List + mint tokens + write distribution rows; returns plaintext URLs **once**
  - `GET /v1/surveys/:id/distribution-batches` — list with `{ sentCount, respondedCount, awaitingCount, expiredCount }` per batch; standard pagination envelope
  - `GET /v1/surveys/:id/distribution-batches/:batchId` — detail; **no plaintext**; tokens table paginated
  - `POST /v1/surveys/:id/distribution-batches/:batchId/regenerate-tokens` — replaces tokenHash for every `(batchId, memberId)`; preserves `consumedAt`; requires `confirmAcknowledge: true` body
  - `PATCH /v1/surveys/:id/distribution-batches/:batchId/expiry` — both directions; constraint `expiresAt ≥ now()` + `Survey.status === 'ACTIVE'`; transactional propagation to all child tokens
- [ ] distributionBatches.ts — per-route `config.auditAction` / `auditAllowlist` per RFC §Audit-log declarations
- [ ] distributionBatches.ts — explicit handler-level `where: { brandId: request.brandId }` on all Prisma calls (Survey-side convention per RFC §Tenant-scoping)
- [ ] distributionBatches.ts — in-handler rate-limit (`INCR + EXPIRE`) on `POST .../distribution-batches`, with `QUEUE_MODE=inline` graceful-degradation (`fastify.redis === null` → structured-log warn)
- [ ] distributionBatches.ts — RBAC: gate `survey.distribute` permission on Generate / Regenerate / Edit-Expiry; `survey.read` on List / Detail
- [ ] `apps/api/src/services/memberResolution.ts` — accept `BULK_DISTRIBUTION` in `enrolledVia` (type widening; runtime path likely already a passthrough); add unit-test case
- [ ] `apps/api/src/app.ts` — register the new `distributionBatches` route module
- [ ] `apps/api/test/integration/distributionBatches.test.ts` — integration coverage: 6 endpoints × happy path + cross-brand 404 + RBAC denial + auto-enroll + atomicity rollback + rate-limit; assertions against the real Docker Postgres
- [ ] **RBAC permission addition** — add `'survey.distribute'` to the permission set in whatever module owns role definitions (verify location during S3; existing `survey.edit` is the reference); grant to the same role(s) for V0

### S4 — API public token + respond

- [ ] `apps/api/src/routes/public.ts` — extend existing `PublicSurveyResponseSchema` (line 30) with optional `token` field; in respond handler: when `token` present, validate via `hashToken` → `findUnique({ where: { tokenHash } })` → branch on token state (`invalid`/`expired`/`responded`/`survey-not-open`) returning the appropriate HTTP code; on accept, single `prisma.$transaction()` writes `SurveyResponse` (with `distributionBatchId` + `distributionTokenId`) AND conditional `UPDATE survey_distribution_tokens SET consumedAt = now() WHERE id = ? AND consumedAt IS NULL` — second submit's 0-row update returns 409
- [ ] public.ts — assign `request.brandId = survey.brandId` after token validates and before `reply.send` so the audit plugin's `onResponse` hook persists the token-respond audit row (per RFC §Audit-log declarations — Public-route audit handling note)
- [ ] public.ts — add `GET /v1/public/surveys/:id/token-status?token=...` returning uniform body `{ state: 'valid' | 'expired' | 'responded' | 'survey-not-open' | 'invalid' }`
- [ ] public.ts — **DELETE the trigger endpoint** (`fastify.post('/public/surveys/trigger', ...)` ~line 604 through ~line 679) and remove the index entry at line 133 (`surveyTrigger: ...` URL key); also remove the stale comment at line 248
- [ ] `apps/api/src/routes/public.test.ts` — modify existing test suites: add `token` body path; assert `trigger` route now returns 404; assert no `surveyTrigger` field in the index response
- [ ] `apps/api/test/integration/public-respond-token.test.ts` — new integration suite: 4 token states (valid/expired/responded/invalid) + survey-not-open + responsePolicy interactions (R22/R22b/R22c) + identifier-mismatch (HTTP 422) + atomicity race + no-PII assertion in all error response bodies
- [ ] `apps/api/test/integration/public-trigger.test.ts` (likely existing) — modify to assert HTTP 404 after deletion

### S5 — Web admin

- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx` — add third tile **"Send via my email tool →"** alongside Share link + Embed snippet (R1); copy verbatim *"Generate per-recipient links for mail-merge applications like Mailchimp, or use the links to send individual mails."*; disabled-state tooltips keyed to `Survey.status` (R2)
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` — new single-page Configure ↔ Success surface (R3); two visual states on same route; no wizard / no Back-Continue / no separate Confirm
- [ ] `apps/web/src/components/distribution/AudienceModeChooser.tsx` — radio cards (R4); Existing Members card hidden when N === 0; Percent/Count toggle (R5)
- [ ] `apps/web/src/components/distribution/CustomListInput.tsx` — paste textarea (10k cap) + CSV upload (100k cap, 11MB body); auto-enroll checkbox default-ON (R6, R7); unmatched section
- [ ] `apps/web/src/components/distribution/LivePreview.tsx` — summary line + 4-column table (Name / Identifier / Last response · this survey / Last response · all surveys, brand-TZ formatted); pagination per R12 (Existing Members: 50; Custom List: 500)
- [ ] `apps/web/src/components/distribution/CommonFields.tsx` — Survey-name-in-mail input (default to `Survey.title` per R10) + Links-expire-on preset select (R11) with brand-TZ label
- [ ] `apps/web/src/components/distribution/GenerateButton.tsx` — disabled gates (R13); loading state with rule-of-thumb estimate + step progress line; transaction-atomicity copy
- [ ] `apps/web/src/components/distribution/SuccessState.tsx` — banner + info line + amber STRONG WARNING + format dropdown (Generic default / Mailchimp / HubSpot / Klaviyo) + Download CSV button + Done link (R16, R17)
- [ ] `apps/web/src/components/distribution/csvFormatter.ts` — client-side CSV materializer (6 columns, format-keyed headers per spec §2.6); single transmission of plaintext URLs
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` — batch detail (R24)
- [ ] `apps/web/src/components/distribution/EditExpiryControl.tsx` — date+time picker with brand-TZ helper text; both-directions edits (R26)
- [ ] `apps/web/src/components/distribution/RegenerateConfirmationModal.tsx` — modal with strong-warning copy verbatim (R29); confirm sends `confirmAcknowledge: true`
- [ ] `apps/web/src/components/distribution/DistributionBatchesFilter.tsx` — filter row between Loop Monitor and Response (R23); "Direct responses (share link / embed)" option shown only when ≥1 such response exists; hidden entirely when no batches + no direct
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — insert filter row between Loop Monitor and Response sections
- [ ] `apps/web/src/lib/datetime.ts` — re-export from `@customerEQ/shared/datetime` for web consumers
- [ ] Component unit tests (one `.test.tsx` per new component) — happy path + key edge cases per spec ACs

### S6 — Web respondent

- [ ] `apps/web/src/app/survey/[id]/r/[token]/page.tsx` — new nested dynamic route; calls `GET /v1/public/surveys/:id/token-status?token=...` on mount; renders the standalone form (state=`valid` — member-id field suppressed) or one of the 4 error states with verbatim copy per spec §4 / R19
- [ ] `apps/web/src/app/survey/[id]/page.tsx` — remove the `?email=` query-param prefill behavior (per R3-15 / D5); share-link path stays functional
- [ ] E2E test pre-coverage in `apps/web/test/e2e/distribute-error-states.e2e.ts` for the 4 token-error pages with no-PII-in-DOM assertion (R19)

### S7 — Demo storefront + config

- [ ] `examples/acme-coffee-demo/lib/customereq.js:124` — replace `POST /v1/public/surveys/trigger` call with `POST /v1/surveys/:id/distribution-batches` (Custom List of one identifier — demo's single test recipient)
- [ ] `examples/acme-coffee-demo/server.js:11` — doc-string update
- [ ] `examples/acme-coffee-demo/README.md:16,60` — API table + demo-flow doc update
- [ ] `fraim/config.json` — add `competitors` array (8 vendors per spec R3-30); confirm key shape matches FRAIM-side schema

### S8 — E2E + manual validation evidence

- [ ] `apps/web/test/e2e/distribute-flow.e2e.ts` — happy path: Configure → Generate → CSV download → respondent submits via tokenized URL → DB assertion of single-transaction writes
- [ ] `apps/web/test/e2e/distribute-error-states.e2e.ts` (already noted in S6) — 4 token-error pages, no-PII-in-DOM
- [ ] `docs/evidence/378-ui-polish-validation.md` — manual browser verification log per Phase 5 (UI Polish Validation skill): all happy-path + edge cases walked in Chrome 1280px+ desktop, expectation evidence (screenshots + DOM assertions) attached

### S9 — Architecture updates

- [ ] `docs/architecture/architecture.md` — add doc-rows per RFC Architecture Analysis: M-1 (Hash-at-rest tokenized public endpoint), M-2 (Brand-TZ + locale display utility), M-3 (In-handler rate-limit with QUEUE_MODE parity), M-4 (Re-download = regenerate semantics for one-time secrets). **M-5 deferred** per reviewer R1-15. No new ADRs (none of M-1..M-4 crosses a one-way door beyond what existing ADRs cover — verify during Phase 10).

### S10 — Retrospective

- [ ] `docs/retrospectives/manohar.madhira@outlook.com-issue-378-implement-postmortem.md` — Phase 13 retro covering: what went right, what surprised, what got pushed back on review, what to encode as L0 coaching moments
- [ ] L0 coaching-moment files captured under `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-*.md` when applicable

---

## Pattern discovery — codebase patterns to follow

Per `codebase-pattern-discovery` skill output (Phase 1 #3):

### Environment patterns
- `apps/api`: reads `process.env.QUEUE_MODE` (`redis` | `inline`), `process.env.DATABASE_URL`, `process.env.REDIS_URL`, `process.env.CLERK_PUBLISHABLE_KEY`, `process.env.NEXT_PUBLIC_FRONTEND_URL`.
- `apps/web`: reads `NEXT_PUBLIC_*` only on the client; admin pages use server-side env via Next.js `process.env` (no `REACT_APP_` prefix — this is Next.js, not CRA).
- **#378 adds zero new env vars.** The rate-limit constants (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS`) are inlined per RFC OD-3a; no env override needed for V0.

### Constants inventory
- `packages/shared/src/constants.ts` — repo-wide constants. **#378 does not need to add to this file** — domain-specific constants (rate-limit, paste/CSV caps) live next to the consumer in `apps/api/src/routes/distributionBatches.ts`.
- Repo-side colors / themes live in Tailwind config + shadcn/ui tokens; #378 reuses existing admin chrome.

### Utility functions
- `apps/api/src/utils/csvParser.ts` exports `parseCsvRaw(body)` — **reused** by `distributionListParser.ts` (not duplicated).
- `apps/api/src/services/memberResolution.ts` exports `resolveOrEnrollMember()` — **reused** by S3 Custom List auto-enroll path (no parallel implementation).
- `apps/api/src/plugins/audit.ts` — per-route allowlist + `onResponse` hook — #378 follows the per-route `config: { auditAction, auditResourceType, auditAllowlist }` shape.
- `apps/api/src/plugins/multiTenant.ts` — `preValidation` body-`brandId` rejection — #378 inherits via plugin; no per-route opt-in needed.
- `apps/api/src/plugins/auth.ts:69` — ApiKey hash-at-rest precedent — `SurveyDistributionToken.tokenHash` mirrors this pattern exactly.

### Architectural patterns observed
- Admin routes under `/admin/{entity}` and `/admin/{entity}/[id]/{sub}` per architecture §3.1 (Standard CRUD admin pattern) — `/admin/surveys/[id]/distribute` extends this.
- API routes under `/v1/{resource}` for tenant-scoped admin and `/v1/public/{resource}` for unauth respondent paths — #378 follows.
- Survey-side models use **explicit handler-level `where: { brandId }`** (not the auto-scoping middleware that 9 loyalty-side models use). #378's new survey-adjacent models follow the local convention per RFC §Tenant-scoping.
- Hand-written Prisma migrations for any constraint-relocation per architecture §3.4 — #378 follows.
- shadcn/ui + Tailwind v4 + Radix primitives — all new components consume these.

---

## Test Strategy (Phase 3 — implement-tests)

Per the job principle "For features, write tests alongside code," #378's test files land in the same commit-slice as the production module they exercise (see slice items above). The strategy is recorded here so Phase 9 (implement-completeness-review) can verify nothing was skipped.

### Authoritative sources for what to test
- **Spec §Validation Plan** (`docs/feature-specs/378-personalized-survey-links-byo-email.md` §Validation Plan, ~12 thematic sections) — operator-facing scenarios with expected outcomes
- **RFC §Validation Plan + §Test Matrix** (`docs/rfcs/378-personalized-survey-links-byo-email.md` lines 569–597) — RFC-level mapping of scenario → layer (unit/integration/E2E) → assertion

### Test pyramid for #378

| Layer | Allocation | Coverage target |
|---|---|---|
| **Unit** (~70%) | Pure functions in `packages/shared/src/{distributionTokens.ts,datetime.ts}`, `apps/api/src/utils/distributionListParser.ts`, `apps/web/src/components/distribution/csvFormatter.ts`, Zod schemas | All spec-locked input/output pairs; edge cases per spec §Validation Plan |
| **Integration** (~20%) | All 6 admin endpoints + 2 public endpoints against real Postgres (Docker); RBAC denial paths; cross-brand 404; atomicity rollback; rate-limit; race window NFR-S6 | RFC §Test Matrix integration row |
| **E2E** (~10%) | Distribute happy path (configure → generate → CSV download → respondent submits); 4 token-error pages with no-PII-in-DOM | RFC §Test Matrix E2E row |

### Test placement (per slice)

| Slice | Test files added |
|---|---|
| S2 | `packages/shared/src/distributionTokens.test.ts`, `packages/shared/src/datetime.test.ts`, `packages/shared/src/zod/distributionBatch.schema.test.ts` |
| S3 | `apps/api/src/utils/distributionListParser.test.ts`, `apps/api/test/integration/distributionBatches.test.ts`, `apps/api/src/services/memberResolution.test.ts` (modify — add BULK_DISTRIBUTION case) |
| S4 | `apps/api/test/integration/public-respond-token.test.ts`, `apps/api/src/routes/public.test.ts` (modify — add token path + trigger-404) |
| S5 | One `.test.tsx` per new component, named `<Component>.test.tsx` next to source (matches existing admin convention) |
| S6 | `apps/web/test/e2e/distribute-error-states.e2e.ts` (the no-PII-in-DOM gate covers respondent surface in this slice) |
| S8 | `apps/web/test/e2e/distribute-flow.e2e.ts` (happy path); `docs/evidence/378-ui-polish-validation.md` (manual evidence) |

### Fixtures + factories

- All mocks/factories/fixtures use `@customerEQ/config/test-utils` per project Rule 8 — **no inline mocks**. If a factory does not exist yet for a new model, add it to the shared test-utils package first.
- Brand-TZ test fixture: copy the 15-case spike data from `docs/evidence/378-tz-spike/spike.mjs` verbatim into `datetime.test.ts`.
- Postgres integration tests use the existing Docker compose Postgres (project Rule 19) — no SQLite shim, no mocked Prisma. Test isolation via unique brandId per test run.
- E2E tests against the running `pnpm dev` stack (project Rule 11a — fail loudly when prerequisites are missing).

### Quality gates per test layer

- Unit tests assert behavior (state transitions, return values, error codes), not structure (interface shape — TypeScript already covers that per project testing-standards Rule 3).
- Integration tests assert: HTTP status + response body shape (Zod parse + `.not.toHaveProperty('plaintext')` for GET endpoints per RFC §Confidence Level item 1) + DB state after the call (count + relation joins) + audit row presence with correct metadata + cross-brand 404 (not 403) for tenant isolation.
- E2E tests assert: full URL path traversal, no `member_id` / `email` / `?token=` leakage to network or DOM, CSV download contents match the chosen format's column-naming.

### Failure mode discipline

Per project Rule 11a + CLAUDE.md "Testing Rules": tests fail loudly when prerequisites are missing. No `it.skip` / `test.skip` patterns. If `DATABASE_URL` is unset, integration tests error with a clear message. If Playwright can't reach the dev server, E2E tests error with a clear message.

---

## Known deferrals / open questions

Carried forward from spec / RFC so later phases don't lose them.

| # | Item | Disposition |
|---|---|---|
| 1 | V1 audience-spec primitive (filter predicates: sentiment, NPS range, tier, etc.) | **Deferred — separate scoping**, see spec §V1.x desired outcome and Non-goals |
| 2 | V1 "Generate new tokens for same audience" (Re-run) affordance | **Deferred — separate scoping**, see spec R27 + R3-14 |
| 3 | #264 worker erasure job extension (`audienceSpec.identifiersResolved[].identifier → '[redacted]'`) | **Scoped out** of #378 per locked D18; #264's AC has been augmented (PR #385 comment 2026-05-17) — no code change in this PR |
| 4 | `@fastify/rate-limit` plugin migration (#218) | **Deferred**; in-handler implementation is the V0 durable answer; adoption trigger recorded on #218 |
| 5 | `Brand.supportEmail` for respondent error-copy | **Tracked in #403**; V0 uses fallback copy *"contact the sender"* per spec §4 / R3-16 |
| 6 | Architecture pattern M-5 (detail-page filter-row UX) doc-row | **Deferred** per reviewer R1-15 — wait for a second feature with the same shape before documenting |

---

## Phase progress

| Phase | Status |
|---|---|
| 1 — implement-scoping | ✅ this file |
| 2 — implement-repro (Bugs only) | **N/A — feature, not bug** (per implement-scoping outcome `issueType=feature`) |
| 3 — implement-tests | ⏳ pending — tests interleaved per-slice (test-driven principle) |
| 4 — implement-code | ⏳ pending — sliced S1..S7 |
| 5 — implement-validate | ⏳ pending — `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke && pnpm test:integration` + manual browser walk + `docs/evidence/378-ui-polish-validation.md` |
| 6 — implement-security-review | ⏳ pending — token + RBAC + hash-at-rest are the surface area |
| 7 — implement-regression | ⏳ pending — full `pnpm test:integration` regression + E2E |
| 8 — implement-quality | ⏳ pending — simplify / dedupe / naming pass |
| 9 — implement-completeness-review | ⏳ pending — verify every R-tag (R1–R29) + NFR (NFR-P1..P5, NFR-S1..S8, NFR-R1..R4, NFR-SC1..SC3, NFR-A1..A4, NFR-O1..O3) lands |
| 10 — implement-architecture-update | ⏳ pending — S9 |
| 11 — implement-submission | ⏳ pending — PR open / refresh on this branch |
| 12 — address-feedback | ⏳ hold-point per Rule 25a — waits for explicit user signal |
| 13 — retrospective | ⏳ pending — S10 |
