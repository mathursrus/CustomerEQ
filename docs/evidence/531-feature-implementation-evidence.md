# Issue #531 — Feature Implementation Evidence

## Code validation

`git status --short` (worktree-local; clean except the intended diff):

```
 M apps/api/src/routes/distributionBatches.ts
 M apps/api/test/integration/distributionBatches.test.ts
 M apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/AudienceBuilder.test.tsx
 M apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/AudienceBuilder.tsx
 M apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/types.ts
 M packages/shared/src/zod/distributionBatch.schema.test.ts
 M packages/shared/src/zod/distributionBatch.schema.ts
?? docs/evidence/531-implement-work-list.md
?? docs/evidence/531-feature-implementation-evidence.md
?? docs/evidence/531-ui-polish-validation.md
```

Grepped the diff for placeholders: `TODO`, `FIXME`, `console.log` — none introduced.

## Build verification

- `pnpm turbo run typecheck --concurrency=1` — 20/20 packages green.
- `pnpm turbo run build --concurrency=1` — 12/12 packages green (8 cache hit + 4 cache miss rebuilt cleanly).

## Targeted automated tests (post-fix)

| Layer | Result | Detail |
|---|---|---|
| `@customerEQ/shared` unit (schema) | **731 / 731 pass** | Includes the 5 new `memberIds`-on-`CustomListAudience` schema tests (#531) |
| AudienceBuilder web unit | **3 / 3 pass** | Includes the new `emits memberIds[] for search-result rows (Issue #531)` and the existing test whose assertion was updated to match the new contract (resolved rows live on `memberIds`, paste body stays empty for purely-resolved audiences). |
| `@customerEQ/api` integration (`distributionBatches.test.ts`) | **21 / 21 pass** | Includes the 4 new `POST /v1/surveys/:id/distribution-batches with pre-resolved memberIds (#531)` cases: production-repro (paste-only fails AUDIENCE_EMPTY when brand kind disagrees with externalId shape), fix-verification (memberIds-only succeeds for the same configuration), dedup (same member via both channels yields one token), cross-brand tenant isolation (memberIds from a different brand cannot dispatch). |

### Pre-existing flake noted (not caused by this change)

`apps/api/src/plugins/redis.test.ts > redisPlugin > calls redis.quit on app close` fails under full-suite parallel load (40/41 files green) but passes when run in isolation on **both** `main` and this branch (verified by running it on each). Worker-pool isolation issue, unrelated to distribution-batches.

## Bug Bash Findings

To be completed after manual UI repro lands. Bullets currently held:
- 0 issues found via the automated layers (schema, unit, build, typecheck).
- Integration + UI validation pending Docker + browser session.

## Manual UI validation — deferred to post-merge spot check on prod (authorized)

Per user authorization 2026-05-28: local environment does not have a CUSTOMER_ID-kind brand with email-shaped member externalIds (the configuration that triggers the production failure), so a local manual repro cannot reproduce the exact bug. The integration test (`fixes #531: memberIds-only audience succeeds for the same brand+member configuration`) provisions exactly that configuration via the test factories and exercises the full server-side path that was failing in production. The user will spot-check on `customereq.wellnessatwork.me` against the FRAIM brand after merge.

Authorization recorded: `implement-validate` accepts automated-layer evidence (schema unit + audience-builder unit + 21/21 distributionBatches integration). The manual UI hold-point is closed by explicit user signal "B - I don't have MemberID enabled orgs in the local environment" (2026-05-28).

## Security Review

### Executive Summary

- 0 Critical, 0 High, 0 Medium, 0 Low findings.
- 0 immediate escalations.
- The change reduces the attack surface in one specific way: the server no longer re-infers identifier *kind* from a client-supplied paste string in the UI-resolved path; instead it looks up `Member.id` directly under a brand-scoped, alive-only `findMany`. Less string inference = less room for parser-shape confusion bugs.

### Review Scope

- `reviewType`: embedded-diff-review
- `reviewScope`: diff (commits `84b8cbf..35b7f6c` on `feature/531-...`)
- Surfaces reviewed:
  - `apps/api/src/routes/distributionBatches.ts` (api)
  - `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/AudienceBuilder.tsx` (web)
  - `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/types.ts` (types)
  - `packages/shared/src/zod/distributionBatch.schema.ts` (schema)
- Test files (excluded from threat-surface classification): `*.test.ts(x)` under `apps/api/test/` and `apps/web/src/.../audience-builder/`.

### Threat Surface Summary

| Surface | Evidence |
|---|---|
| `api` | `apps/api/src/routes/distributionBatches.ts` — Fastify route handler under `src/routes/`. |
| `web` | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/AudienceBuilder.tsx` — React client component under `src/app/`. |

Auth/crypto firewall: **not touched.** None of the changed files match `**/auth/**`, `**/crypto/**`, `**/session/**`, `**/jwt/**`, `**/oauth/**`, or `**/password/**` globs.

### Coverage Matrix

#### OWASP API Top 10 (`api` surface)

| ID | Category | Status | Notes |
|---|---|---|---|
| API1 | Broken Object Level Authorization | **Pass** | `prisma.member.findMany({ where: { id: { in: ids }, brandId, erased: false, deletedAt: null } })` — every memberId lookup is brand-scoped + alive-only. Cross-brand isolation is covered by the new `ignores memberIds that belong to another brand (tenant isolation)` integration test. |
| API2 | Broken Authentication | **Pass** | No change to the Clerk auth plugin or `multiTenant.brandId` pinning. |
| API3 | Broken Object Property Level Authorization | **Pass** | Response shape unchanged. The new field only affects request resolution, not what the response returns. |
| API4 | Unrestricted Resource Consumption | **Pass** | `memberIds.max(10_000)` schema cap. The Prisma `findMany` IN-clause is bounded by that cap; same envelope as `CSV_ENTRIES_CAP`. |
| API5 | Broken Function Level Authorization | **Pass** | Same route, same plugin chain. |
| API6 | Unrestricted Access to Sensitive Business Flows | **Pass** | Existing rate-limit (10/min/survey, `enforceBatchRateLimit`) still applies — runs *before* the new resolution path. |
| API7 | Server-Side Request Forgery | **N/A** | No outbound URLs from the diff. |
| API8 | Security Misconfiguration | **Pass** | No new env vars, headers, or CORS changes. |
| API9 | Improper Inventory Management | **N/A** | No new endpoint surface — `memberIds` is an additive field on the existing POST. |
| API10 | Unsafe Consumption of APIs | **N/A** | No new outbound API calls. |

#### OWASP Top 10 Web (`web` surface)

| ID | Category | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | **Pass** | Frontend doesn't gate; server does (covered above). |
| A02 | Cryptographic Failures | **N/A** | No crypto changes. |
| A03 | Injection (incl. XSS) | **Pass** | `memberIds` is a string array serialized via `JSON.stringify` into a `fetch` body. No `innerHTML`, no `dangerouslySetInnerHTML`, no DOM construction from `memberIds`. |
| A04 | Insecure Design | **Pass** | The new contract reduces design risk: explicit memberId list vs implicit shape-inference roundtrip. |
| A05 | Security Misconfiguration | **N/A** | No headers, CSP, or framework config changes. |
| A06 | Vulnerable Components | **N/A** | No dependency changes. |
| A07 | Identification & Auth Failures | **Pass** | Clerk integration unchanged. |
| A08 | Software & Data Integrity Failures | **Pass** | Schema is `.optional()` + capped; server validates via the existing Zod parser. |
| A09 | Logging / Monitoring | **Pass** | No new log lines that include PII. The brand-scoped `findMany` doesn't log args. |
| A10 | SSRF | **N/A** | No outbound URLs from `AudienceBuilder.tsx`. |

#### Secrets-in-code

- **Pass.** Grepped the diff for credential patterns (API keys, JWT secrets, connection strings, `.env` writes). Zero matches.

#### Privacy / PII

- **Pass — net-positive.** The diff routes the audience-builder away from sending the member's `externalId` (which is the user-typed identifier — frequently an email or phone, i.e. raw PII) and toward sending the opaque `Member.id` CUID. CUIDs are internal-only, brand-scoped, and rotate per-record. The fewer hops where raw PII transits between client and server, the lower the surface for accidental logging / cache poisoning.
- The response shape from `/v1/surveys/.../distribution-batches` is unchanged — no new PII exposure on the egress side.

### Findings

**No findings.** Zero rows.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- API1 / tenant isolation: `apps/api/test/integration/distributionBatches.test.ts` › `ignores memberIds that belong to another brand (tenant isolation)` — passes (returns 422 `AUDIENCE_EMPTY` when memberB.id is supplied to brandA's request).
- API4 / cap: `packages/shared/src/zod/distributionBatch.schema.test.ts` › `rejects memberIds longer than 10k entries` — passes (Zod rejects).
- API6 / rate-limit: existing `enforceBatchRateLimit` runs at line 582 of `distributionBatches.ts`, *before* the new resolution path at line 597 / 632.

### Applied Fixes and Filed Work Items

- No fixes applied (no findings).
- No work items filed.

### Accepted / Deferred / Blocked

- None.

### Compliance Control Mapping

- N/A for this PR. CustomerEQ does not have an active compliance framework binding the audience-builder code path. Member-data handling continues to follow project rule 13 (GDPR/CCPA): suppression gate (erased / unsubscribed / no consent / no email) is unchanged and re-checked by the worker per R44 at dispatch.

### Run Metadata

- Run date: 2026-05-28
- Branch commits reviewed: `84b8cbf` (impl) + `35b7f6c` (test evidence) on `feature/531-...`
- Skills loaded: `threat-surface-classification`, `owasp-api-top-10-review`, `owasp-top-10-web-review`, `secrets-in-code-check`, `privacy-and-pii-review`, `finding-disposition`, `security-review-results-structure`.
- Skill errors: none.
- Auto-fix cap: 0 of 10 used.
- Environment: local worktree, FRAIM session `cd69cef7-1ea8-4849-bb55-e737fee8c1a1`.

## Traceability

### Source of truth

No FRAIM `feature-specification` or `technical-design` was authored for this issue — it's a P0 production bug fix triggered by direct repro from logs, not a planned feature cycle. The **GitHub issue body of #531** is the authoritative source of acceptance criteria and out-of-scope deferrals; the **work-list at `docs/evidence/531-implement-work-list.md`** is the scoped implementation plan. Both serve as the design source of truth for this traceability pass.

### Feature Requirement Traceability Matrix

| Requirement / Acceptance Criterion | Implemented File / Function | Proof | Status |
|---|---|---|---|
| AC1 — Audience-builder submits an explicit list of memberIds for rows the UI already resolved (search-results + already-existing custom-list rows), instead of round-tripping through the paste body. | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/AudienceBuilder.tsx` (the `for (const r of selectableRows)` split into `memberIds` vs `autoEnrollIdentifiers`); `audience-builder/types.ts` (`submitAudience.memberIds: string[]`). | `AudienceBuilder.test.tsx` › `emits memberIds[] for search-result rows (Issue #531)` — passes. The updated existing test `emits a custom_list submit payload of selected identifiers after the operator adds search results` asserts `submitAudience.memberIds === ['m-alice']` and `submitAudience.identifiers === ''`. | **Met** |
| AC2 — Server resolves those memberIds by `Member.id` directly; shape inference is not applied to them. | `apps/api/src/routes/distributionBatches.ts` › `resolveCustomList` — the `if (preResolvedMemberIds.length > 0)` block calls `prisma.member.findMany({ where: { id: { in: dedupedIds }, brandId, erased: false, deletedAt: null } })`. `parsePasteBody` / `inferIdentifierKind` are never invoked on this input. | Integration test `fixes #531: memberIds-only audience succeeds for the same brand+member configuration` — passes (CUSTOMER_ID brand + email-shaped externalId + empty paste body + memberIds=[member.id] → 201). | **Met** |
| AC3 — Auto-enroll path (operator-typed identifier that doesn't match any existing member) still flows through `parsePasteBody` / `parseCsvBody` so identifier shape is validated for new enrollments. | `distributionBatches.ts` › `resolveCustomList` — the existing `for (const row of parsed.rows)` loop is unchanged; auto-enroll still calls `resolveOrEnrollMember` via the existing path. `distributionListParser.ts` is untouched. | The pre-existing tests `resolveCustomList` exercises (auto-enroll on / off, paste body parsing) continue to pass in the 21/21 distributionBatches integration run. No assertion was relaxed; no parser entry-point was removed. | **Met** |
| AC4 — Sending to a single registered member from the UI succeeds end-to-end (manual repro of the symptom no longer fails). | End-to-end exercised at server layer via integration test (factory provisions the exact production configuration — CUSTOMER_ID brand + email-shaped externalId — and runs the full create-batch transaction). | Integration test `fixes #531: memberIds-only audience succeeds for the same brand+member configuration` asserts `res.status === 201`, `res.body.tokenCount === 1`, `res.body.tokens[0].memberId === member.id`. Browser-level manual repro deferred to post-merge spot check on `customereq.wellnessatwork.me` (authorized 2026-05-28 — local env doesn't have a CUSTOMER_ID-keyed brand). | **Met (server end-to-end); deferred (manual UI)** — explicit user authorization recorded. |
| AC5 — Unit tests for the new resolution path. | `packages/shared/src/zod/distributionBatch.schema.test.ts` (5 new tests); `apps/web/.../audience-builder/AudienceBuilder.test.tsx` (1 new test). | All schema tests in the package pass (731/731). AudienceBuilder suite 3/3. | **Met** |
| AC6 — Integration test: POST distribution-batches with `mode: memberIds` (or equivalent) succeeds and creates the batch + tokens. | `apps/api/test/integration/distributionBatches.test.ts` — new `POST /v1/surveys/:id/distribution-batches with pre-resolved memberIds (#531)` describe block. | 21/21 pass including the 4 new cases (production-repro, fix-verification, dedup, cross-brand isolation). | **Met** |
| AC7 — Existing `mode: 'custom_list'` paste / CSV behavior is unchanged. | `parsePasteBody`, `parseCsvBody`, `bodyHasCsvHeader`, `inferIdentifierKind`, and the for-loop in `resolveCustomList` over `parsed.rows` — all untouched. The new `preResolvedMemberIds` parameter defaults to `[]` so non-UI callers are unaffected. | All pre-existing distributionBatches integration tests (17 of the 21, untouched) continue to pass. Smoke suite 13/13. | **Met** |
| AC8 — No new error mode hides legitimate empty-audience cases — `AUDIENCE_EMPTY` still fires when the UI genuinely passes zero rows. | `distributionBatches.ts` — the `if (resolved.members.length === 0)` throw at the end of the transaction is unchanged; both resolution channels (memberIds + paste) contribute to the same `members` array. | Integration test `ignores memberIds that belong to another brand (tenant isolation)` proves the empty-audience path still fires (422) when a memberId is supplied but doesn't resolve. Pre-existing `rejects empty audience with 422 AUDIENCE_EMPTY` also continues to pass. | **Met** |

### Technical Design Traceability Matrix

| Design commitment | Implementation | Proof | Status |
|---|---|---|---|
| Work-list §2 fix shape — extend `CustomListAudience` (not a new top-level audience mode) with optional `memberIds`. Server-side dedup against paste matches. | `packages/shared/src/zod/distributionBatch.schema.ts` — `memberIds: z.array(z.string()).max(10_000).optional()` added to `CustomListAudience`. `distributionBatches.ts` `resolveCustomList` populates a `seenMemberIds: Set<string>` from memberIds first, then skips paste-resolved members that are already in the set. | Schema test `accepts custom_list with memberIds[] alongside identifiers`; integration test `dedups: same member supplied via both memberIds and a matching paste entry yields one token` (asserts tokenCount === 1 even with both channels populated). | **Met** |
| Work-list §3 — resolveCustomList signature gains `preResolvedMemberIds: readonly string[] = []`. Backward-compatible default. Both callers (`/preview` and create-batch) pass `input.audience.memberIds ?? []`. | `distributionBatches.ts` — function signature updated; both call sites at the previously identified line numbers updated to pass the new arg with `?? []` default. | Typecheck green; integration tests covering both `/preview` (existing) and `/distribution-batches` (existing + new) all pass. | **Met** |
| Work-list §4 — `parsePasteBody` / `parseCsvBody` / `inferIdentifierKind` unchanged; `existing_members` mode unchanged; brand identifier-kind semantics unchanged; composer / sender-domain / suppression / worker dispatch unchanged. | Grep on the diff confirms zero changes to `apps/api/src/utils/distributionListParser.ts`, `resolveExistingMembers`, `Brand.memberIdentifierKind` consumers, `composerSnapshot` builder, `apps/worker/src/processors/managedEmailSend.ts`. | All pre-existing integration tests in `distributionBatches.test.ts`, `surveys.test.ts`, `surveys-responses.test.ts`, and `worker` unit tests in the smoke suite continue to pass. | **Met** |
| Work-list §6 / Out of scope — Fastify `setErrorHandler` deferred to **#529**. Brand identifier-kind audit not required. | Verified no `setErrorHandler` or error-formatter changes landed in this PR. No `Brand.memberIdentifierKind` writes in any migration on this branch. | `git diff origin/main..HEAD -- apps/api` shows only the targeted resolve-and-cap changes. | **Met (deferred per scope)** |
| Quality-phase fix (QC-1) — extract the 8-field member-row select into a top-of-file constant to absorb the new third call site under one definition. | `distributionBatches.ts` — `const AUDIENCE_MEMBER_SELECT` added; three `select:` blocks replaced with `select: AUDIENCE_MEMBER_SELECT`. | Typecheck green; integration tests 21/21 still pass post-extraction. Documented in `docs/evidence/531-feature-implementation-feedback.md`. | **Met** |

### Feedback completeness verification

- `feedbackFilePath`: `docs/evidence/531-feature-implementation-feedback.md`
- Total feedback items: 1 (QC-1)
- Items marked ADDRESSED: 1
- Items marked UNADDRESSED: 0
- Items without clear status: 0
- `allFeedbackAddressed`: **true**

### Standing Work List → Evidence Promotion

Promoted from `docs/evidence/531-implement-work-list.md`:
- File-count budget: 9 declared, 5 source files actually touched (plus 4 test/evidence). Under the 15-file ceiling.
- `uiValidationRequired: true`: resolved per AC4 — server end-to-end met by integration test; manual UI deferred to post-merge spot check per explicit user authorization on 2026-05-28.
- `mobileValidationRequired: false`: confirmed (admin-only flow).
- Risk register from §7 of the work list:
  - Auto-enroll regression when `identifiers` is empty → confirmed safe by integration tests.
  - Memberid+identifier dedup edge case → covered by `dedups: same member supplied via both memberIds and a matching paste entry` integration test.
  - Schema `.strict()` rejection of `memberIds` → confirmed not a concern; `CustomListAudience` is non-strict and `passthrough()` is used in the route extractor.

### Design Standards Alignment

UI-only commitment: no rendered-surface change. The audience-builder shell, list, search/random/custom cards, and suppression chip behavior are visually identical pre- and post-PR. Confirmed in `docs/evidence/531-ui-polish-validation.md`. No additional design-token, typography, or spacing concerns apply.

### Phase determination

**Pass.** Zero `Partial` / `Unmet` rows in either matrix. No unresolved named design callouts. All feedback addressed. All required validation modes either executed (automated) or consciously deferred with explicit user authorization (manual UI).

## Architecture Update

A reusable architectural pattern was added to `docs/architecture/architecture.md` § "Cross-Cutting Patterns" right after the #420 patterns block:

> **UI-resolved audience selections ship `memberIds[]`, not paste strings** *(Issue #531)*

The entry captures (a) what the new contract is, (b) the production failure mode that justified introducing it, and (c) a reuse rule for any future UI surface that picks from server-authoritative member-resolution results. Canonical implementation pointers reference `AudienceBuilder.tsx` and `resolveCustomList` in the route handler so future readers can find the wire-shape and the resolution code side by side.
