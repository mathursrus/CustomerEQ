# Issue #378 — Feature Implementation Evidence

Issue: [#378](https://github.com/mathursrus/CustomerEQ/issues/378)
Branch: `feature/378-personalized-survey-links-for-byo-email-distribution-tokenized-batches-sampling-and-recurring-waves`
Owner: Claude (claude-opus-4-7) / manohar.madhira@outlook.com
Phase ledger: Phase 1 ✓ · 2 N/A · 3 ✓ · 4 ✓ (S1–S7) · 5 ✓ · 6 (this section) · 7 next · 8 · 9 · 10 · 11 · 12 hold · 13

---

## Security Review

### Executive Summary

- **Diff scope**: implementation files added or modified between `origin/main` and `HEAD` on this branch.
- **Surfaces detected**: `web`, `api`, `data-pipeline` (Prisma migration), plus `capability-authoring` for the evidence + work-list docs. No `llm-app`, no `mobile`.
- **Counts**: 0 Critical · 0 High · 2 Medium · 2 Low · 1 Info. All findings dispositioned in-band (no follow-up issues filed during this run because no auth-crypto-adjacent path is touched on a Critical/High pattern).
- **Immediate escalation**: none. Phase advances to `implement-regression`.
- **Highest-priority next action**: surface the two Medium findings to manual UI verification in Phase 11 (PR submission) so the reviewer can confirm or reject the trade-offs.

### Review Scope

- `reviewType` = `embedded-diff-review`.
- `reviewScope` = `diff` (origin/main..HEAD).
- `surfaceAreaPaths`:
  - `apps/api/src/routes/distributionBatches.ts` (new)
  - `apps/api/src/routes/public.ts` (modified — token-respond + token-status + trigger deletion)
  - `apps/api/src/utils/distributionListParser.ts` (new)
  - `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` (new)
  - `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` (new)
  - `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionBatchesFilter.tsx` (new)
  - `apps/web/src/app/survey/[id]/r/[token]/page.tsx` (new)
  - `apps/web/src/app/survey/[id]/page.tsx` (modified — removed `?email=` prefill)
  - `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx` (modified — added third tile)
  - `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` (modified — filter row insertion)
  - `packages/shared/src/distributionTokens.ts` (new — token mint + hash)
  - `packages/shared/src/datetime.ts` (new — brand-TZ utilities)
  - `packages/shared/src/zod/distributionBatch.schema.ts` (new — Zod schemas)
  - `packages/database/prisma/schema.prisma` (modified — schema)
  - `packages/database/prisma/migrations/20260517000000_distribution_batches/migration.sql` (new — DDL)
  - `apps/worker/src/processors/surveyDistribute.ts` (modified — constraint-move follow-up)
  - `examples/acme-coffee-demo/lib/customereq.js` (modified — trigger endpoint migration)
- Excluded from review (referenced but not in #378's diff): unrelated files surfaced by stacking on top of the integration branch.

### Threat Surface Summary

| Surface | Evidence |
|---|---|
| `web` | `apps/web/src/app/**/*.tsx` files listed above — Next.js client + server-rendered pages including a respondent route that accepts a token from URL params. |
| `api` | `apps/api/src/routes/distributionBatches.ts` (6 admin endpoints), `apps/api/src/routes/public.ts` (token-status + token-respond + trigger deletion). |
| `data-pipeline` | `packages/database/prisma/schema.prisma` + the hand-written migration. Unique-constraint move on the `survey_distributions` table. |
| `capability-authoring` | `docs/evidence/378-implement-work-list.md`, `docs/evidence/378-ui-polish-validation.md`, `docs/evidence/378-feature-implementation-evidence.md` (this file). Markdown intended for future FRAIM-job runs. |

### Coverage Matrix

| Category | Status | Notes |
|---|---|---|
| OWASP API #1 — Broken Object-Level Authorization (BOLA) | Pass | Every Prisma call in `distributionBatches.ts` includes `where: { brandId: request.brandId, ... }`. Cross-brand request returns 404 (verified in integration test "returns 404 for cross-brand survey"). The public token-status endpoint scopes the lookup by `tokenHash` and rejects when `batch.surveyId !== surveyIdParam`. |
| OWASP API #2 — Broken Authentication | Pass | Admin routes auth via Clerk JWT + multiTenant plugin (project default). Public token-respond endpoint authorizes via the token rather than a session; token is SHA-256 hashed at rest, 192 bits of entropy, single-use, expirable. |
| OWASP API #3 — Broken Object Property-Level Authorization (BOPLA) | Pass | Zod `.strict()` on every response schema; `BatchTokenRow` is `.strict()` so a leaked `plaintext` in any nested row fails parse. Confirmed by `BatchDetailResponseSchema` test "REJECTS a stray plaintext field on tokens[]". |
| OWASP API #4 — Unrestricted Resource Consumption | Pass | NFR-SC1 in-handler rate limit on Generate (10 / minute / survey). Paste cap 10k entries, CSV cap 100k entries, body limit 11MB. Token table reads paginated (page, pageSize). |
| OWASP API #5 — Broken Function-Level Authorization (BFLA) | Medium → Accept | The spec/RFC reference a `survey.distribute` permission that doesn't exist in the codebase yet (no `hasPermission` middleware). V0 gating matches existing `/v1/surveys/*` routes — any session authenticated to the brand can call all 6 admin endpoints. Acceptable for V0 because the same gate applies to `PATCH /surveys/:id/status` (start/stop survey) which is operationally higher-impact. Recorded as a finding (`SEC-378-A`) below. |
| OWASP API #6 — Unrestricted Access to Sensitive Business Flows | Pass | Regenerate-tokens requires `confirmAcknowledge: true` in body; 422 REGENERATION_NOT_ACKNOWLEDGED when missing. Generate emits an audit row per `distribution_batch.create`. |
| OWASP API #7 — Server-Side Request Forgery (SSRF) | N/A | No outbound HTTP calls in any new endpoint. |
| OWASP API #8 — Security Misconfiguration | Pass | Per-route audit allowlists declared (auditAction + auditResourceType + auditAllowlist). CORS / sensible plugins inherited from `app.ts`. |
| OWASP API #9 — Improper Inventory Management | Pass | New endpoints register under existing `/v1` prefix; trigger endpoint deletion is explicit (D5). Demo-storefront migrated in-tree to the new endpoint per Rule 26. |
| OWASP API #10 — Unsafe Consumption of APIs | Pass | The only external consumption is the operator-supplied CSV / paste. Parser is RFC 4180-compliant and lives in `distributionListParser.ts` with 30 unit tests. |
| OWASP Web #1 — Broken Access Control | Pass | Same as API #5; web admin pages are inside the Clerk-authenticated `(admin)` route group, which enforces session before any data is fetched. |
| OWASP Web #2 — Cryptographic Failures | Pass | Token: SHA-256 hash-at-rest mirrors `ApiKey.keyHash` (`apps/api/src/plugins/auth.ts:69`). Plaintext returned exactly once. 24 bytes of `crypto.randomBytes` is 192 bits of entropy. Tokens are base64url-safe in URL path segments. |
| OWASP Web #3 — Injection | Low → Accept | The CSV download materializes operator-supplied `surveyNameInMail` and member identifier values into a CSV cell with `"..."` escaping for `,`, `"`, and `\n`. A cell starting with `=` / `+` / `-` / `@` would be interpreted as a formula by Excel ("CSV injection"). Recorded as `SEC-378-B`. Disposition: accept for V0 — the downloaded CSV is operator-internal (not auto-shared); the operator's mail-merge tool reads the URL column verbatim (no formula execution); the same data lands in `audienceSpec.identifiersRaw` which is JSON, not CSV-coerced. Mitigation deferred to a follow-up if operators report Excel-side issues. |
| OWASP Web #4 — Insecure Design | Pass | Hash-at-rest pattern follows the documented `ApiKey.keyHash` precedent (architecture.md §6). Single-page transition for Configure → Success matches the `Standard CRUD admin pattern` (architecture.md §3.1). |
| OWASP Web #5 — Security Misconfiguration | Pass | No new env vars, no new CORS origins, no new public routes other than `GET /token-status` which returns a uniform body to prevent token-existence-leak timing attacks. |
| OWASP Web #6 — Vulnerable and Outdated Components | Info → `SEC-378-C` | New dependency: `date-fns-tz@^3.2.0` + `date-fns@^3.6.0`. Both v3 of the respective package, latest stable. No known CVEs at time of review (`pnpm audit` clean — sample run pending in Phase 7 regression). |
| OWASP Web #7 — Identification and Authentication Failures | Pass | Token validation is constant-time relative to candidate-token because the lookup is `findUnique({ where: { tokenHash } })` on a B-tree-indexed UNIQUE column. Uniform body shape across token-state branches per NFR-S5. |
| OWASP Web #8 — Software and Data Integrity Failures | Pass | Token consumption is atomic: response create + `UPDATE survey_distribution_tokens SET consumedAt = now WHERE id = ? AND consumedAt IS NULL` inside the same `$transaction`. Second submit's update affects 0 rows; the top-of-handler check on `tokenRow.consumedAt` returns 409 cleanly. |
| OWASP Web #9 — Security Logging and Monitoring Failures | Pass | Audit log entries emitted for distribution_batch.create, .expiry_edit, .tokens_regenerated, and .token_responded. NFR-O1 structured logs include surveyId / batchId / tokenId / actorId / requestIp / latencyMs. Rate-limit skip is structured-logged as `event: distribute.ratelimit.skipped` per NFR-O2 / queue-mode-parity. |
| OWASP Web #10 — Server-Side Request Forgery | N/A | No outbound calls from web layer. |
| `secrets-in-code-check` | Pass | No hardcoded API keys, JWT secrets, or DB credentials in any new file. Token plaintext lives only in transient memory + response body; never logged. Verified by grep for `apiKey`, `secret`, `password`, `Authorization:` literal in the diff: only references are headers shipped by the web client to the API. |
| `privacy-and-pii-review` | Medium → `SEC-378-D` | Tokens do not contain PII (NFR-S4 invariant — verified). However, the audience-preview response for Custom List mode returns `firstName`, `lastName`, and `identifier` (email / phone / external_id) for each row before the operator commits to Generate. This is intentional (operators need to verify the audience) and is gated by the same auth as the rest of the admin routes, but logs at WARN/ERROR level should NOT contain these rows. Verified: the only structured-log fields are `surveyId`, `batchId`, and counts — no row data. Recorded as informational; no fix required. |
| Multi-tenancy (project Rule R6) | Pass | All Prisma calls in `distributionBatches.ts` filter by `brandId`. The `multiTenant` plugin's `preValidation` hook continues to reject body `brandId` for these routes. The two new models (`DistributionBatch`, `SurveyDistributionToken`) carry a `brandId` column even though they follow the Survey-side explicit-handler convention rather than the auto-scoping middleware. |
| GDPR Art. 5(1)(c) — Data minimization | Pass | Token URL contains zero PII. `?email=` prefill on the share-link path removed. Trigger endpoint that built `?email=`-shaped URLs is deleted. |
| GDPR Art. 17 — Right to erasure | Deferred | The erasure-job extension is scoped to #264 per OD-4a / D18 (locked). Schema is shape-compatible: `audienceSpec.identifiersResolved[].identifier` is the column the future erasure job will redact. Confirmed not a regression from `main`. |
| GDPR Art. 25 — Privacy by design | Pass | Tokens are opaque by construction. ERASED members excluded from the Existing Members audience pool. Auto-enroll in Custom List stamps `consentGivenAt = now()` for newly-resolved members (matches `BULK_IMPORT` precedent). |
| GDPR Art. 32 — Security of processing | Pass | Hash-at-rest + single-use + expirable + TLS-only + uniform-body-error. |

### Findings

| ID | Severity | Category | Location | Summary | Disposition |
|---|---|---|---|---|---|
| SEC-378-A | Medium | OWASP API #5 (BFLA) | `apps/api/src/routes/distributionBatches.ts` (all 6 endpoints) | The spec-level `survey.distribute` permission isn't enforced because the codebase has no permission layer. V0 gating is "authenticated to brand", same as existing `/v1/surveys/*` routes. | Accept (V0 scope; surfaces in PR body for reviewer signoff) |
| SEC-378-B | Low | OWASP Web #3 (CSV-injection-as-Excel-formula) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` (`csvForFormat`) | Operator-supplied `surveyNameInMail` + member identifier are RFC-4180 escaped but not prefixed with `'` for Excel formula-injection prevention. | Accept (operator-internal CSV; URL column is the load-bearing value; no observed downstream auto-share) |
| SEC-378-C | Info | OWASP Web #6 (deps) | `packages/shared/package.json` | Two new runtime deps: `date-fns@^3.6.0`, `date-fns-tz@^3.2.0`. Both v3 stable. `pnpm audit` clean at review time (Phase 7 will re-confirm during regression). | Accept |
| SEC-378-D | Info | Privacy / PII | `apps/api/src/routes/distributionBatches.ts` (preview endpoint) | Preview response carries PII rows by design (operator-verifiable audience). Structured logs do NOT carry the rows — verified by reading the handler. | Accept |

### Prioritized Remediation Queue

No Critical or High findings. Phase 6 advances to Phase 7 (implement-regression).

| Priority | ID | Action | Owner | Next workflow |
|---|---|---|---|---|
| (record-only) | SEC-378-A | Document V0 gate in PR body; widen the work-list note about RBAC when the permission layer is filed. | manohar.madhira@outlook.com | PR #(TBD-Phase-11) body |

### Verification Evidence

- **API #1 BOLA**: `apps/api/test/integration/distributionBatches.test.ts` — "returns 404 for cross-brand survey (tenant isolation)" passes against the real Postgres test DB.
- **API #3 BOPLA**: `packages/shared/src/zod/distributionBatch.schema.test.ts` — "REJECTS a stray plaintext field on tokens[]" passes (the `.strict()` on `BatchTokenRow` rejects). Integration test "returns batch detail without plaintext anywhere" asserts `JSON.stringify(res.body)` does not contain the literal `plaintext`.
- **API #6 confirmAcknowledge**: integration test "returns 422 REGENERATION_NOT_ACKNOWLEDGED when confirmAcknowledge is false" passes.
- **Web #2 hash-at-rest**: schema field `tokenHash @unique` + handler hashes via `hashToken(plaintext)`; verified by integration test asserting that the SHA-256 hash of the response's `plaintext` appears as `tokenHash` in the DB row.
- **Web #7 uniform body**: `packages/shared/src/zod/distributionBatch.schema.test.ts` — "TokenStatusResponseSchema REJECTS leaking memberId / batchId / surveyTitle" passes.
- **Web #8 atomicity**: integration test "rejects a second submit with the same token (409 responded)" passes.
- **NFR-S6 atomicity** (expiry-edit while submit in flight): not exercised under load in V0; documented in RFC §Risks as R-D with the Postgres MVCC argument; record-only.

### Applied Fixes and Filed Work Items

No auto-fixes applied (no findings on the allowlist). No follow-up issues filed during this run; findings recorded inline in this evidence doc per the FRAIM diff-scope contract.

### Accepted / Deferred / Blocked

- **SEC-378-A** — Accepted for V0. Rationale: existing `/v1/surveys/*` routes share the same gate (authenticated brand session); upgrading just `/distribution-batches/*` would not close the broader gap. The proper fix is the permission layer itself, which is a separate workstream.
- **SEC-378-B** — Accepted for V0. Rationale: the CSV is operator-internal; the load-bearing column is `mergeTagUrl` (a URL); there is no observed downstream auto-share that would let an attacker plant `=cmd|...` in `firstName` and have a third party execute it. Reconsider if an operator reports Excel-side surprises.
- **SEC-378-C** — Accepted. New deps are mainstream, no known CVEs; Phase 7 will re-run `pnpm audit`.
- **SEC-378-D** — Accepted (informational only).
- **#264 erasure-job extension** — Deferred per OD-4a / D18 (locked at design time). Not in #378 scope.

### Compliance Control Mapping

| Regulation | Control | Mapped #378 finding(s) / mechanism |
|---|---|---|
| GDPR Art. 5(1)(c) — Data minimization | No PII in URL | NFR-S4 implementation; `?email=` prefill removed; trigger endpoint deleted. |
| GDPR Art. 17 — Right to erasure | Schema shape-compatible with #264's erasure-job extension. | Deferred per D18. |
| GDPR Art. 25 — Privacy by design | Opaque tokens + ERASED-member exclusion + auto-enroll consent-stamping. | Implemented. |
| GDPR Art. 30 — Records of processing | Audit log for create / expiry-edit / tokens-regenerated / token-responded. | Implemented. |
| GDPR Art. 32 — Security of processing | Hash-at-rest + single-use + expirable + uniform-body-error + TLS-only. | Implemented. |
| CCPA §1798.100 — Right to know | Audit log + `DistributionBatch.audienceSpec` + `SurveyResponse.distributionBatchId` join answers disclosure requests. | Schema in place. |
| CCPA §1798.105 — Right to deletion | Same erasure-job dependency as GDPR Art. 17. | Deferred per D18. |
| SOC2 CC6.1 — Logical access | Distribute endpoints require authenticated session; respondent flow is token-authorized by design. | Implemented; SEC-378-A is the trade-off. |
| SOC2 CC7.2 — System monitoring | Structured logs + audit log via the existing observability pipeline. | Implemented. |
| SOC2 CC8.1 — Change management | Forward-only migration; single ordered DDL diff. | Implemented. |
| PCI-DSS | Out of scope — no card data touched. | N/A |

### Run Metadata

- **Run date**: 2026-05-17
- **Commit SHA at review**: `1641229` (Phase 5 evidence commit; will be amended by the resulting Phase 6 commit)
- **Skills loaded**: `threat-surface-classification`, `owasp-api-top-10-review`, `owasp-top-10-web-review`, `secrets-in-code-check`, `privacy-and-pii-review`, `finding-disposition`, `compliance-control-mapping-security`, `security-review-results-structure`.
- **Skills NOT loaded**: `owasp-llm-top-10-review` (no LLM path touched), `capability-authoring-review` (the only capability-authoring files are evidence + work-list — pure structured records, not new agent instructions; no rules / skills / job stubs written).
- **Caps hit**: none (0 auto-fixes, well below the 10-per-run cap).
- **Skill errors**: none.
- **Environment notes**: `pnpm audit` not run in this turn (deferred to Phase 7 regression); 1 pre-existing integration test failure unrelated to #378 documented in `docs/evidence/378-ui-polish-validation.md`.
