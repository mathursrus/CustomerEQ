# Feature Implementation Evidence — Issue #336

**Issue**: #336 — Slice 4b: full editor (4 tabs) + `/new` Server Component + legacy survey-builder cleanup
**Branch**: `feature/336-impl-241-slice-4b-full-editor-4-tabs-new-server-component-legacy-survey-builder-cleanup`

This document carries the standing evidence appendices for the implementation workflow on this branch. The phase-by-phase artifacts live alongside it in `docs/evidence/`:

- Phase 1 work-list: `336-implement-work-list.md`
- Phase 5 validation report: `336-implement-validate.md`
- Phase 6 security review: §below

---

## Security Review

### Executive Summary

| Severity | Count | Disposition |
|---|---|---|
| Critical | 0 | — |
| High | 1 | inline fix (A04-001) |
| Medium | 0 | — |
| Low | 1 | accept (test-fixture suppression) |

**Headline**: One High finding (A04-001) — a client/server wire-format mismatch in the newly-wired Phase 5 ConsentAttestationModal. R10 server-side enforcement remained intact (fail-closed), but the feature was unusable end-to-end. Fixed inline; covered by RTL + e2e regression tests. No Critical findings, no secrets in the diff, no XSS / injection / SSRF / IDOR vectors.

### Review Scope

- **reviewType**: `embedded-diff-review`
- **reviewScope**: `diff` (i.e., `git diff origin/main...HEAD`)
- **target**: 6 commits ahead of `origin/main` covering Phases 3–6 on this branch
- **surfaceAreaPaths**:
  - Source: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/**` (added) · `apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.tsx` (modified) · `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` (rewritten) · `apps/web/src/app/(admin)/admin/survey-builder/page.tsx` (deleted) · `apps/web/src/components/surveys/{TriggerStep,RuleBuilderStep,ReviewLaunchStep}.tsx` (deleted) · `apps/web/src/utils/triggerRecommendation.{ts,test.ts}` (deleted)
  - Tests: `apps/web/test/e2e/336-{survey-editor,surveys-list}.spec.ts` (added)
  - Docs: `docs/evidence/336-implement-{work-list,validate}.md`
- **Referenced (not reviewed)**: `apps/api/src/routes/surveys.ts` and `packages/shared/src/zod/survey.schema.ts` were read to verify server-side enforcement of R10 attestation; outside review scope but load-bearing for A04-001 disposition.

### Threat Surface Summary

| Surface | Detected? | Evidence |
|---|---|---|
| web | ✅ | All changed source files under `apps/web/src/app/(admin)/admin/surveys/**` — Next.js App Router admin pages. |
| api | ❌ | No changes under `apps/api/src/routes/**`. |
| llm-app | ❌ | No `anthropic`, `openai`, or other LLM SDK imports. |
| data-pipeline | ❌ | No script entrypoints or DB driver imports. |
| mobile | ❌ | No `ios/` or `android/` files. |
| capability-authoring | ❌ | No `fraim/{skills,jobs,rules}` or `.claude/{skills,rules}` files. |
| docs-only | ❌ | Source files present — docs-only does not apply. |

### Coverage Matrix

OWASP Top 10 (web), 2021 edition:

| Code | Category | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | Pass | Server-side authorization (Clerk middleware + `request.brandId`) is authoritative; client uses Bearer tokens from `getAuthToken(getToken)`. `isReadOnly` client gate is defense-in-depth — server's `FIELD_NOT_EDITABLE_IN_STATE` (409) is the enforcer. The `/new` Server Component pulls auth from `@clerk/nextjs/server` correctly. |
| A02 | Cryptographic Failures | N/A | No crypto code, no password handling, no key material in diff. |
| A03 | Injection | Pass | No raw SQL, no `innerHTML`, no `eval`, no `Function()`, no shell exec in the diff. All operator input flows through React's JSX text rendering or as parameters to typed `fetch()` bodies. `dangerouslySetInnerHTML` count in diff: 0. |
| A04 | Insecure Design | **Fail** | **A04-001** — see §Findings. |
| A05 | Security Misconfiguration | Pass | No new config in diff. `clerkPublishableKey` fallback for Playwright is gated on `NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true'` (verified in `apps/web/src/app/layout.tsx`, unchanged in this slice). |
| A06 | Vulnerable & Outdated Components | Pass | No new package dependencies added in Slice 4b (verified against work-list §B "Slice 4b adds no … no new package dependency"). |
| A07 | Identification & Authentication Failures | Pass | Editor uses Clerk's `useAuth()` for tokens and `useUser()` for `attestedBy` display. `attestedBy` is **display-only** — the server stamps `consentSuppressedAttestedBy = request.clerkUserId` from the verified session, not the client-provided email. Client impersonation is impossible. |
| A08 | Software & Data Integrity Failures | Pass | No untrusted deserialization, no plugin loading, no auto-update mechanism in this UI diff. |
| A09 | Security Logging & Monitoring Failures | Pass | Audit rows for survey mutations are server-stamped (Slice 2's `auditAction` route config for `PATCH /surveys/:id`, `PATCH /surveys/:id/status`, `PATCH /surveys/:id/consent-mode`, `DELETE /surveys/:id`). No client-side logging of secrets. Phase 5 swept for `console.error/warn/log` — zero in the diff. |
| A10 | SSRF | Pass | No URL-from-user-input forwarded to backend fetches. `thankYouRedirectUrl` is stored as string and persisted; URL fetching (if it ever happens) is API-side. |
| SEC-LEAK | Secrets in code | Pass | Diff swept against the secrets-in-code-check pattern table — zero matches in source. One test-fixture occurrence (`'test-token'` in `page.test.tsx:29`) — Low severity, accepted (test-fixture suppression per disposition skill step 2). |
| PRIVACY | Privacy / PII | Pass (with note) | Consent override flow per R10 has both client-side gate (open modal on more-permissive) and server-side enforcement (`ATTESTATION_REQUIRED` 422). Modal's `reasonHasPii()` soft-warns on email/phone/SSN shapes in the audit reason — good defense against accidental PII leakage into the audit row. See A04-001 finding for the wire-format consequence that initially broke this flow end-to-end. |

### Findings

| ID | Severity | OWASP | File:Line | Summary | Disposition |
|---|---|---|---|---|---|
| A04-001 | High | A04 | `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/ConsentAttestationModal.tsx:23-34` and `SurveyEditorForm.tsx:187-213` | Phase 5's ConsentAttestationModal wiring sent `{ consentMode, consentReason, attestedBy }` to `PATCH /v1/surveys/:id/consent-mode`. Server schema `UpdateConsentModeSchema.strict()` in `packages/shared/src/zod/survey.schema.ts:164` requires `{ consentMode, consentReason, attestation: { confirmed: boolean, reason: string } }`. The `attestedBy` key would have been rejected with 422 `FIELD_DISALLOWED`, and the absence of `attestation.confirmed=true` would have triggered 422 `ATTESTATION_REQUIRED`. **R10 server enforcement remained intact (fail-closed)** but the feature was unusable end-to-end — an operator could never commit a more-permissive consent override through the UI. e2e mocks accepted any body, so this didn't surface in Phase 5 validation. | **fix (inline)** |
| SEC-LEAK-001 | Low | SEC-LEAK | `apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.test.tsx:29` | `const STABLE_GET_TOKEN = async () => 'test-token'` — placeholder bearer used by RTL Clerk mock. Pattern matches the broad token detector. Value `'test-token'` is a deterministic placeholder, not a production secret. | **accept** (test-fixture suppression per disposition skill step 2) |

### Prioritized Remediation Queue

1. **A04-001 — High — fixed in this session.** Inline fix continues B1 (Phase 5's ConsentAttestationModal wiring). Defensible because: (a) server fail-closed kept the feature safe rather than exposed during the gap; (b) the fix is a wire-format correction, not a security policy change; (c) regression tests at unit + e2e layers now lock the contract.

### Verification Evidence

**A04-001 — pre-fix failure mode (reasoned, not reproduced live)**:
- Static read of `packages/shared/src/zod/survey.schema.ts:164` shows `UpdateConsentModeSchema` is `.strict()` and accepts `{ consentMode, consentReason?, attestation? }`. No `attestedBy` field.
- Static read of `apps/api/src/routes/surveys.ts:300-342` shows the handler returns 422 `ATTESTATION_REQUIRED` if `attestation.confirmed !== true` for a more-permissive override.
- The pre-fix client body would have been `{ consentMode, consentReason, attestedBy }` (no `attestation`) — both `.strict()` rejection and `ATTESTATION_REQUIRED` would fire.

**A04-001 — post-fix passing proof**:
- `ConsentAttestationModal.test.tsx` "sends consentMode + reason + attestation envelope matching UpdateConsentModeSchema" now asserts the exact wire shape `{ consentMode, consentReason, attestation: { confirmed: true, reason } }` (no `attestedBy`).
- `SurveyEditorForm.test.tsx` "confirming the attestation routes through patchConsentMode with the schema-correct attestation envelope" makes the same assertion at the wiring level.
- `336-survey-editor.spec.ts` "Consent override: more-permissive selection opens ConsentAttestationModal; confirm PATCHes /consent-mode" now asserts `body.attestation = { confirmed: true, reason: <contains 'Compliance'> }` against the captured `page.route()` mock.
- Run results post-fix: `apps/web` vitest **256/256** green across 29 files; Playwright e2e **17/17** green; typecheck clean.

**A04-001 — server-side enforcement preserved**:
- `apps/api/src/routes/surveys.ts:332-342` `isMorePermissive && !(att?.confirmed === true)` → `422 ATTESTATION_REQUIRED` remains the authoritative gate. The client fix is presentation only; no server change.

### Applied Fixes and Filed Work Items

| ID | Type | Reference | Notes |
|---|---|---|---|
| A04-001 | inline fix | Files: `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/{ConsentAttestationModal.tsx,SurveyEditorForm.tsx}` + `page.tsx` (callback signature) + 3 test files (1 modal + 1 form + 1 e2e). Commit (this session): `security(A04-001): fix consent attestation wire-format to match UpdateConsentModeSchema`. | Fixed outside the auto-fix allowlist per user authorization (Phase 6 AskUserQuestion this session). Justification documented in the commit message and §Run Metadata. |
| SEC-LEAK-001 | accept | n/a | Test-fixture suppression per `finding-disposition` skill step 2. No issue filed. |

### Accepted / Deferred / Blocked

- **SEC-LEAK-001** — accepted (test-fixture suppression). Approver: this review.

### Compliance Control Mapping

| Framework | Control | Mapped Findings | Status |
|---|---|---|---|
| GDPR | Art. 7 (Conditions for consent) | A04-001 (R10 attestation pipeline) | Resolved — R10 attestation now both client-gated AND server-enforced with the schema-correct wire shape. |
| CCPA | §1798.130(a)(5)(C) (Records of consent decisions) | A04-001 — audit metadata captured server-side via `auditAllowlist: ['consentMode', 'consentReason', 'attestation', 'requestIp']`. | Resolved. |
| Project Rule R13 (GDPR/CCPA — Baked In) | Soft deletes; consent respect; erasure-job coverage | N/A for this diff — no PII processing changes in Slice 4b admin UI. Soft-delete path (DELETE /v1/surveys/:id) lives in Slice 2 and is referenced unchanged. | N/A |

### Run Metadata

| Field | Value |
|---|---|
| Run date | 2026-05-13 |
| Branch | `feature/336-impl-241-slice-4b-full-editor-4-tabs-new-server-component-legacy-survey-builder-cleanup` |
| Commit at start of review | `6df9f78` (Phase 5 implement-validate) |
| Commit at end of review (with A04-001 fix) | (this session's security commit) |
| Skills loaded | `threat-surface-classification`, `owasp-top-10-web-review`, `secrets-in-code-check`, `finding-disposition`, `security-review-results-structure` |
| Skills not available | `privacy-and-pii-review.md` not found in the FRAIM MCP catalog at `skills/security/` (also tried `skills/quality/`). Privacy/PII review performed against project rule R13 + OWASP A04 framing instead. |
| Auto-fix cap | 0 of 10 used (A04-001 was outside the auto-fix allowlist; applied inline only with explicit user authorization). |
| Auth/crypto firewall hits | 0 — `/consent-mode` is not in the firewall path list. |
| Environment notes | Static review against repo at the worktree path; live API not exercised. The static A04-001 finding was confirmed by reading `packages/shared/src/zod/survey.schema.ts` and `apps/api/src/routes/surveys.ts` against the client wire shape. |

---

## Phase ledger (extract)

| Phase | Status |
|---|---|
| 5 — implement-validate | Complete (see `336-implement-validate.md`) |
| 6 — implement-security-review | **Complete (this session)** — 1 High + 1 Low; High inline-fixed; no blocking findings remain. |
| 7 — implement-regression | Next |
