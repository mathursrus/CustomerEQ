# Quality Feedback — Issue #524 (Switch Member Identifier Kind, Slice 1)

`deep-code-quality-checks` against architecture-standards + discovered patterns. Each finding tagged `QUALITY CHECK FAILURE`; resolution status tracked.

## Findings

### Q-1 — Duplicated canonical-key normalization (DRY) — `QUALITY CHECK FAILURE` — **ADDRESSED**
The `value.trim().toLowerCase()` external-id key derivation (a domain invariant: live enrollment, pre-flight, re-key worker, and routes must all key identically or dual-key/collision logic drifts) was re-implemented in 3 places: `memberResolution` (inline), `migrationPreflight.normalize`, and `adminBrandMigrations.norm`. Rule 15 (fix at the right abstraction level) + architecture-standards DRY.
**Resolution:** Extracted `export function normalizeExternalId(value)` in `memberResolution.ts` (single source). `migrationPreflight` and `adminBrandMigrations` now import it; `memberResolution`'s own `externalId` derivation uses it. Behavior-preserving: 72 service unit tests + 10 integration tests green after the change.

### Q-2 — `adminBrandMigrations.ts` exceeds the 500-line guideline — `QUALITY CHECK FAILURE` — **ADDRESSED (justified)**
~535 lines. Architecture-standards: "files over 500 lines require justification."
**Resolution / justification:** the file is one cohesive route surface — 9 admin REST endpoints for a single feature plus their local helpers (preflight-context, mapping-template, create, mapping, current, :id, start, extend-grace, cancel, usage-warnings, impact-preview). Splitting one feature's routes across files would fragment the surface and obscure the shared helpers/audit configs. Kept as one module by design; helpers are small and single-purpose. No further action.

### Q-3 — `dispatchMemberIdentifierMigration` exceeds the 50-line guideline — `QUALITY CHECK FAILURE` — **ADDRESSED (justified)**
~90 lines. Architecture-standards: "functions over 50 lines require justification."
**Resolution / justification:** it is the re-key state machine (PROCESSING → chunked re-key → terminal success-flip OR compensating-rollback → audit + reconcile). The transactional flow is a single responsibility; the compensating rollback is already extracted to `rollbackAppliedMembers`, and reconciliation to `reconcileMigration`. Further splitting would scatter the atomic flow across functions and hurt readability. Kept as one cohesive orchestrator.

## Other checks (Pass — no findings)
- **Hardcoded values:** none — `GRACE_DAYS`, `CHUNK`, `THIRTY_DAYS_MS`, `DAY_MS`, poll intervals are named constants; no URLs/secrets/credentials; `API_URL` is the existing public env var; per-surface `brandSideAction` copy is intentionally API-layer-baked (RFC §H).
- **Missed reuse:** `EMAIL_RE` exported + reused (no regex drift); `usePollingQuery`, `getAuthToken`, `API_URL`, `ImpliedAttestationModal`/`ManagedEmailFlow` patterns, test factories all reused rather than re-created.
- **Architecture health:** correct layering — reconciliation lives in the worker (worker never imports `apps/api`); api→worker dispatch import is the established managed-email pattern; no circular deps (typecheck green); worker dispatch uses DI (injectable Prisma) for testability per architecture-standards §3.
- **Complexity:** max nesting ≤3; route handlers do validate→guard→persist→respond linearly; no >4-param functions.

## Status: all findings ADDRESSED. Phase not blocked.
