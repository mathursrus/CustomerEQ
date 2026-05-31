# Feature Implementation Evidence — Issue #524 (Switch Member Identifier Kind, Slice 1)

See `524-implement-evidence.md` for the Rule 11 gate results, test inventory, and key decisions. This file records the implement-validate bug bash.

## Validation summary
- Build: ✅ `pnpm build` 12/12. Typecheck: ✅ 20/20. Lint: ✅ 0 errors. `test:smoke`: ✅. Integration: ✅ 10/10 (live Postgres).
- Code hygiene: no `console.log` / TODO / FIXME / placeholder in #524 source; clean working tree.
- UI baseline: `524-ui-polish-validation.md` (no P0/P1).

## Bug Bash Findings

Edge-case, boundary, and adjacent-flow exploration (code-level + integration-backed), since the Clerk-authed UI is the user's live functional pass.

| ID | Severity | Area | Finding | Disposition |
|---|---|---|---|---|
| B-1 | High → fixed (pre-validate) | worker | RFC §D's no-rollback failure path would strand re-keyed members on failure (violates R23). | Fixed in implement-code: compensating rollback + `mapping.oldEmail`; covered by the failure-rollback integration test. |
| B-2 | Low → fixed | web | `[id]` page polled terminal migrations forever. | Fixed: status-derived `enabled`. |
| B-3 | Info | api | Empty / malformed / wrong-column CSV upload → `422 CSV_PARSE_ERROR`; nothing written (R6). | Verified in `parseMappingCsv` unit tests + route guard. |
| B-4 | Info | api | Second migration while one is active → `409 MIGRATION_ALREADY_IN_PROGRESS` with `redirectTo`; wizard redirects. | Verified (route guard + UI `MigrationInProgressError`). |
| B-5 | Info | api | Non-CUSTOMER_ID brand creating a migration → `400 UNSUPPORTED_MIGRATION_DIRECTION`. | Verified (route guard). |
| B-6 | Info | api | `extend-grace` outside grace → `409 NO_ACTIVE_GRACE`; `cancel` after PROCESSING → `409 MIGRATION_NOT_CANCELLABLE`; `start` without attestation → `422`. | Verified (route guards). |
| B-7 | Info | worker | Crash mid-batch is resumable — the re-key cursor only selects `appliedAt IS NULL AND errorReason IS NULL`, so a restart continues where it stopped (idempotent). | By design; not separately reproduced (would need a forced crash). |
| B-8 | Info | api | Grace-expiry sweep handles multiple due migrations in one pass; request-time R35 rejection gates on `status`, not `now()`, so ≤15-min sweep lag is safe. | Verified (grace-expiry integration test). |
| B-9 | Info | engine | Dual-key fallback fires only on a primary-lookup MISS and only when an active migration exists → hero `/v1/events` path (internal-id) pays nothing. | By design (§E/§M.2); dual-key path covered by the PROCESSING integration test. |

**Result: 0 Critical/High bugs open after edge-case, boundary, and adjacent-flow exploration** (B-1 was found and fixed in implement-code; B-2 fixed in implement-validate). Phase not blocked.
