# Issue #328 — Slice 2: API surface + consent-mode endpoint + audit extension

**Umbrella**: [#324](https://github.com/mathursrus/CustomerEQ/issues/324)
**Spec**: [docs/feature-specs/241-survey-admin-ux.md](../feature-specs/241-survey-admin-ux.md)
**Design**: [docs/rfcs/241-survey-admin-ux.md](../rfcs/241-survey-admin-ux.md) §API Surface, §"State-aware field editability", §"Endpoint error contracts", §Audit Plugin Extension
**Issue type**: feature
**Branch (planned)**: `feature/241-slice-2-api-surface` off `main`
**Prerequisite landed**: Slice 1 (#326, commit `ea2a97e`) — schema deltas; RFC clarification (#327, `93b92d4`) — attribution rule documented

---

## Implementation Checklist

### A. New endpoint — `PATCH /v1/surveys/:id/consent-mode`

- [ ] Add route in `apps/api/src/routes/surveys.ts` (or a small new module if growth warrants — keep it in `surveys.ts` for now per existing pattern)
- [ ] Zod schema: `UpdateConsentModeSchema` in `packages/shared/src/zod/survey.schema.ts`:
  - `consentMode: z.enum(['EXPLICIT', 'IMPLIED_ON_SUBMIT']).nullable()` (`null` = inherit from `Brand.consentMode`)
  - `consentReason: z.string().max(500).optional()`
  - `attestation: z.object({ confirmed: z.boolean(), reason: z.string().min(1).max(500) }).optional()`
- [ ] Handler enforces attestation gate (R10):
  - Compute `effectiveBrandMode = brand.consentMode`. The "more permissive" direction is `EXPLICIT → IMPLIED_ON_SUBMIT` (because IMPLIED collects fewer affirmative gestures from respondents).
  - If `requested.consentMode === 'IMPLIED_ON_SUBMIT'` AND `effectiveBrandMode === 'EXPLICIT'`: require `attestation.confirmed === true && attestation.reason.length > 0`. Missing → HTTP 422 `{ code: 'ATTESTATION_REQUIRED', details: { brandMode, requestedMode } }`.
- [ ] On a valid override write, server-stamps:
  - `consentSuppressedAttestedBy = request.clerkUserId`
  - `consentSuppressedAttestedAt = new Date()`
- [ ] On override-to-stricter (R11): no attestation required, but audit row still fires.
- [ ] Per-route audit config: `auditAction: 'survey.consent.update'`, `auditAllowlist: ['consentMode', 'consentReason', 'attestation', 'requestIp']`.
- [ ] Cross-brand check: 404 (return-404-on-cross-brand pattern from existing routes).

### B. General `PATCH /v1/surveys/:id` — `.strict()` + state-aware allowlist

- [ ] `packages/shared/src/zod/survey.schema.ts`:
  - Add `.strict()` on `UpdateSurveySchema` so unknown keys return 422 `{ code: 'FIELD_DISALLOWED', field }`. Consent-override fields (`consentMode`, `consentReason`, `consentSuppressedAttestedBy`, `consentSuppressedAttestedAt`) stay out by absence → reach the strict reject.
  - Add new optional fields: `title?` (string ≤200), `description?` (string ≤1000, nullable), `responsePolicy?` (`z.enum([...])`), `consentTextOverride?` (string ≤5000, nullable).
  - Same fields added to `CreateSurveySchema` (so create + update accept them).
- [ ] State-aware allowlist in `apps/api/src/routes/surveys.ts` PATCH handler (R29 / R30). Encoded as a const table:

  ```ts
  const FIELD_EDITABILITY: Record<string, (state: SurveyStatus, ctx: { responsesCount: number }) => boolean> = {
    name:        (s) => s !== 'STOPPED',
    title:       (s) => s !== 'STOPPED',
    description: (s) => s !== 'STOPPED',
    type:        (s) => s === 'DRAFT',
    programId:   (s) => s === 'DRAFT',
    responsePolicy: (s, ctx) => s === 'DRAFT' && ctx.responsesCount === 0,
    questions:   (s) => s === 'DRAFT',
    themeId:     (s) => s !== 'STOPPED',
    settings:    (s) => s !== 'STOPPED',
    thankYouMessage:     (s) => s !== 'STOPPED',
    thankYouRedirectUrl: (s) => s !== 'STOPPED',
    consentTextOverride: (s) => s !== 'STOPPED',
  }
  ```

  For each key present in the body, look up the rule; reject the first violation with HTTP 409 `{ code: 'FIELD_NOT_EDITABLE_IN_STATE', field, currentState }` (per RFC §"State-aware field editability").

- [ ] Per-route audit config: `auditAction: 'survey.update'`, `auditAllowlist: ['title', 'description', 'responsePolicy', 'consentTextOverride', 'themeId', 'thankYouMessage', 'thankYouRedirectUrl', 'requestIp']`.

### C. Response handler — `POST /v1/surveys/:id/responses` (auth) + `/v1/public/surveys/:id/respond`

- [ ] **Single-event emit**: Slice 1 already removed the secondary emit on both paths. Slice 2 verifies the cx event type mapping is correct and tightens to *exactly one* emit per submission. Map `SurveyType` → `eventType`:
  ```
  NPS    → 'cx.nps_response'
  CSAT   → 'cx.csat_response'
  CES    → 'cx.ces_response'
  CUSTOM → 'cx.survey_completed'
  ```
- [ ] **`responsePolicy` enforcement** (R8):
  - `ONCE`: lookup `(surveyId, memberId)` in `surveyResponses`; if present → HTTP 409 `{ error: 'You have already responded.', code: 'POLICY_ONCE_DUPLICATE' }`.
  - `LATEST_OVERWRITES`: `upsert` on `(surveyId, memberId)` — replaces `answers`, `score`, `completedAt`, `channel`. **Requires a partial unique index** on `(surveyId, memberId) WHERE memberId IS NOT NULL` (added in #262 PR1 — verify presence; if absent, file as a finding for Slice 2 vs separate migration).
  - `MULTIPLE` (default): always insert.
  - Imported responses (`memberId IS NULL`) bypass policy — already handled.
- [ ] **`enrolledVia` channel-attribution swap** (RFC update in #327):
  - Remove the `queryMemberId` branch from `public.ts:225-238`.
  - Replace with `const enrolledVia = data.channel === 'in_app' ? 'EMBEDDED_FORM' : 'SURVEY_RESPONSE'`.
  - Drop the `queryParse` lookup of `member_id` from the URL query.
  - Note: the `?email=` / `?member_id=` page-handler URL plumbing on the `apps/web` side stays until Slice 5 retires it. This change is API-side only.
- [ ] **`score` field semantics**: present only for surveys with at least one question marked `isScoreField: true`. For Custom surveys with no marked question: omit `score` from emitted event payload; `SurveyResponse.score = null` (per RFC §"Primary score field resolution").

### D. `isScoreField` per-question Zod validation

- [ ] `packages/shared/src/zod/survey.schema.ts`:
  - Extend `SurveyQuestionSchema` with `isScoreField: z.boolean().optional()`.
  - Add a `CreateSurveySchema.superRefine((data, ctx) => { ... })` block:
    - At most one question may have `isScoreField === true`. Multiple → `ctx.addIssue` with `code: 'too_many_score_fields'` → returns HTTP 422.
    - The marked question's type must be in `{ NPS, CSAT, CES, RATING }`. Likert (and text/choice/etc.) → `ctx.addIssue` with `code: 'isScoreFieldInvalidType'`.
  - Same superRefine on `UpdateSurveySchema` when `questions` is being updated.

### E. Audit plugin extension — `request.ip` capture

- [ ] `apps/api/src/plugins/audit.ts`:
  - Inside the `onResponse` hook, BEFORE the `filterMetadata` call, enrich `request.audit.metadata` with `requestIp: request.ip ?? null`.
  - If `request.ip` is unavailable (trust-proxy misconfigured): log a structured WARN `{ event: 'audit.ip_unavailable', route, brandId }`. Audit row is never blocked.
- [ ] Add `'requestIp'` to the `auditAllowlist` of every route that should capture it:
  - `PATCH /surveys/:id`
  - `PATCH /surveys/:id/status`
  - `PATCH /surveys/:id/consent-mode` (new)
  - Existing `PATCH /admin/brand/profile` already has it indirectly via #292; verify and leave alone if already correct.

### F. Endpoint error contracts (per RFC §"Endpoint error contracts")

- [ ] Tighten existing handlers to match the RFC's documented error shapes:
  - Activate clicked with `questions.length === 0` → 422 `{ code: 'NO_QUESTIONS' }`.
  - Activate with required Basics fields empty → 422 `{ code: 'MISSING_REQUIRED_FIELD', fields: [...] }`.
  - Cross-brand PATCH attempt → 403 `{ error: 'Not found' }` (existing pattern).
  - Disclosure-text override > 500 chars → 422 with Zod `details` (handled at parse).
  - Disallowed field on general PATCH (e.g., `consentMode`) → 422 `{ code: 'FIELD_DISALLOWED', field }`.
- [ ] Each error code maps 1:1 to a test case.

### G. Local gates (before push)

- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm build` clean
- [ ] `pnpm test` (unit) green
- [ ] `pnpm test:integration` green (incl. all new integration tests)
- [ ] `pnpm db:migrate` clean on fresh DB (no schema migration in Slice 2; just verify no regression)
- [ ] `pnpm audit --audit-level=high` still 0 highs
- [ ] Grep verification: zero remaining production references to URL-query `member_id` extraction in `public.ts`.

---

## Validation Requirements

- `uiValidationRequired`: **No**. Slice 2 is API surface only; UI changes belong to Slices 3 / 4.
- `mobileValidationRequired`: No.
- Database validation: not applicable (no schema deltas).
- Manual validation: `curl` smoke tests against each new endpoint + each state-aware allowlist case + each policy case + audit-row inspection.

---

## Patterns Discovered (codebase-pattern-discovery)

**Audit plugin** (`apps/api/src/plugins/audit.ts:93-159`):
- `onResponse` hook gates on method ∈ `{POST, PATCH, DELETE, PUT}`, brandId present, 2xx response.
- Per-route metadata via `config.auditAllowlist` + handler-populated `request.audit.metadata`.
- Fire-and-forget: catches and logs errors but doesn't block the response.
- The `filterMetadata` helper at `apps/api/src/plugins/audit.ts:78-91` is where `requestIp` injection slots in.

**Existing route pattern with audit + Zod + multi-tenant** (`apps/api/src/routes/admin-brand-profile.ts`):
- Imports Zod schemas from `@customerEQ/shared`, validates with `.safeParse`, returns 422 on failure with `details: parse.error.errors`.
- Calls `request.brandId` for tenancy scoping; relies on `multiTenant` plugin.
- Sets `request.audit = { metadata: { changedFields, before, after } }` before reply.
- Per-route `config: { auditAction: '...', auditAllowlist: [...] }`.

**Existing PATCH /status precedent** (`apps/api/src/routes/surveys.ts` current handler):
- Uses `request.brandId` + `findFirst({ where: { id, brandId } })` → 404 if not found.
- Status transition validation lives in the handler.
- Adds the audit metadata after a successful update.

**Test infra**:
- Integration tests live in `apps/api/test/integration/*.test.ts`, scaffold via `setupTestDb` + `setTestApp` + `authenticatedRequest`.
- The `surveyLifecycle.test.ts` + `public-survey.test.ts` are the closest precedents for Slice 2's tests.

**Environment variables**: no new ones introduced. Trust-proxy config (`FASTIFY_TRUST_PROXY`) already exists for `request.ip` to honor X-Forwarded-For.

**Zod superRefine pattern**: precedent in `admin-brand-profile.ts` schema for cross-field validation (URL scheme refinement). Same pattern applies to `isScoreField` validation.

---

## Open Questions / Deferrals

- **Q1 (verify, not block)**: Is the partial unique index `(surveyId, memberId) WHERE memberId IS NOT NULL` already in place from #231 PR1? If yes → `LATEST_OVERWRITES` upsert works as-is. If no → file a follow-up migration; for Slice 2, implement upsert defensively via `findFirst → update | create` rather than `prisma.upsert` to avoid the index dependency.
- **Architecture-doc updates** (RFC §"Patterns Missing from Architecture"): three new patterns surface in Slice 2 (MA2 state-aware PATCH field allowlist; MA3 `AuditEvent.metadata.requestIp` capture pattern). Phase 10 of this workflow will decide whether to document them inline in `apps/web/architecture.md` now or file a doc-only follow-up after Slice 2 lands and the patterns are concretely visible in code.
- **Deferred to Slice 3/4**: All UI work — editor tabs, consent-mode UI, attestation modal, state-aware disabling of editor inputs — is owned by Slice 4. Slice 2 only ships the server-side contract. UI smoke tests stay deferred until Slice 4.

---

## Phase log

- 2026-05-11 — FRAIM phase 1 (implement-scoping) complete.
