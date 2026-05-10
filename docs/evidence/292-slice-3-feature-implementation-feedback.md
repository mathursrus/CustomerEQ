# Quality Feedback — Issue #292 Slice 3

Branch: `feature/issue-292-org-settings-api`
Diff: `apps/api/src/routes/admin-brand-profile.ts` (new, ~290 LOC), `apps/api/src/lib/consent.ts` (new, 10 LOC), 8 modified files (auth.ts, audit.ts, audit.test.ts, app.ts, package.json, .env.example, integration/setup.ts, pnpm-lock.yaml).

## Quality Checks

| Check | Status | Notes |
|---|---|---|
| Hardcoded values (URLs / API keys / credentials) | **PASS** | `SUPPORT_EMAIL_FALLBACK = 'support@customereq.com'` is a named fallback for `process.env.SUPPORT_EMAIL` (R12). `DEFAULT_CONSENT_TEXT` is a named exported constant in `lib/consent.ts`. No hardcoded credentials, API keys, or JWT secrets. |
| Magic numbers | **PASS** | HTTP status codes (200, 400, 401, 409, 422) are Fastify idiom. Zod constraints (max(120) for name, max(500) for justification, regex literals) trace directly to RFC §4.2 / spec values. The 80-char inner-string cap inside `zConsentText` is owned by `@customerEQ/consent-text`'s `tokens.ts` (R18). |
| Duplicate code | **ADDRESSED — was FAIL, fixed in scoping commit** | Initial draft had the 14-field Brand `select` shape duplicated across 3 callsites in `admin-brand-profile.ts` (GET response, PATCH read-current, PATCH update return). **Fix**: extracted `BRAND_PROFILE_SELECT` constant; all 3 callsites now reference it. Single source of truth ensures the response shape stays consistent across reads and writes. Verified: typecheck 0 errors; integration tests 318/318 passing post-refactor. |
| Missed reusability | **PASS** | `filterMetadata` is a new pure function specific to the audit-allowlist pattern; no existing utility duplicates it (verified via grep for `filterMetadata` / `allowlist` / `pickKeys` across repo). `HttpsUrl` and `AttestationSchema` Zod helpers stay local to the route file per R15 ("stay where the variance lives") — promoting them to `@customerEQ/shared` would over-abstract for a single consumer. |
| Quality standards compliance (architecture-standards rule) | **PASS** | All exported functions/handlers have single responsibility. PATCH handler is one Fastify route handler covering parse → cross-field validate → read-current → diff → update → audit-decoration; sequential and readable. No DI is required because the route uses `fastify.prisma` (decorator pattern) — consistent with all 24 sibling route files. No env vars accessed directly except `process.env.SUPPORT_EMAIL` (with documented fallback in `.env.example`). |
| Monolithic files | **PASS** | `admin-brand-profile.ts` is 274 LOC after the BRAND_PROFILE_SELECT extraction. Single export. Well under the 500-LOC limit. `audit.ts` is 159 LOC, 4 named exports + 1 default — under limits. `auth.ts` is 184 LOC after the +25 LOC delta — under limits. |
| Overly complex logic | **NOTE (justified)** | PATCH handler is ~110 LOC after refactor. **Justification**: single REST-handler responsibility with sequential validation + execution flow; splitting into helpers (`computeChangeset`, `applyCrossFieldRules`) would introduce indirection without separating concerns that vary independently. The handler reads top-to-bottom: parse → cross-field rule 1 → cross-field rule 2 → diff → no-op shortcut → update → audit. Per architecture-standards rule "Functions over 50 lines require justification" — justified here. Max nesting depth: 3 (handler → if → for → if). Max parameters: 2 (request, reply). Cyclomatic complexity ≤ 6. |
| Architecture health (imports + circular deps) | **PASS** | Import graph: `routes/admin-brand-profile.ts → {fastify, @prisma/client, zod, @customerEQ/consent-text, ../lib/consent}`; `lib/consent.ts → {}` (zero imports); `plugins/audit.ts → {fastify-plugin, fastify, @prisma/client}`; `plugins/auth.ts → {fastify-plugin, node:crypto, fastify}`. No circular dependencies. The new `@customerEQ/consent-text` workspace dependency on `apps/api/package.json` is consistent with the established workspace-link convention; lock-file delta bounded to +3 lines. |
| UI baseline validation | **N/A** | Slice 3 ships zero UI surface. UI baseline checks return in Slice 4 (admin page consuming PATCH /profile). |

## QUALITY CHECK FAILURES

**1. Duplicate `select` shape on Brand** (RESOLVED in same phase)

- **Severity**: Minor
- **Initial state**: 3 occurrences of identical 14-field `select: { id: true, clerkOrgId: true, name: true, ... }` object across `admin-brand-profile.ts` GET handler, PATCH read-current, and PATCH update return.
- **Fix**: Extracted `BRAND_PROFILE_SELECT` `as const` at the top of the file; all 3 callsites now reference it.
- **Evidence**:
  - Pre-fix: 4 inline `select: {` blocks (3 of them duplicating the 14-field shape; the 4th is the smaller brandTheme select).
  - Post-fix: 1 named constant + `select: BRAND_PROFILE_SELECT` at 3 callsites + 1 inline brandTheme select.
- **Status**: ADDRESSED.

**2. PATCH handler size — 110 LOC** (DOCUMENTED, not a defect)

- **Severity**: Note (not a failure)
- **Detail**: PATCH handler exceeds the architecture-standards 50-LOC heuristic.
- **Justification**: Single REST endpoint with sequential request-validation flow. Splitting into helpers would introduce indirection without separating concerns. Architecture-standards explicitly allows >50 LOC with justification; this is the documented justification.
- **Status**: ACCEPTED — documented as a deliberate architectural choice. Re-examine if a second similar PATCH endpoint emerges (R15 — abstract when there's variance to share).

## Resolution Status

- 1 quality finding raised (duplicate select shape) → ADDRESSED in same phase via `BRAND_PROFILE_SELECT` extraction.
- 1 note logged (PATCH handler size) → ACCEPTED with documented justification.
- 0 unresolved findings remain.

Phase passes; no return to `implement-code` required.
