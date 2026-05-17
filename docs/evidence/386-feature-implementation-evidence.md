# Issue #386 — Feature Implementation Evidence

**Title**: CD: add dedicated Prisma migration stage to deploy pipeline
**Branch**: `feature/386-cd-add-dedicated-prisma-migration-stage-to-deploy-pipeline-fail-fast-before-container-swap`
**Commit**: 92c9d2f (impl) + 4298529 (work list update)

---

## Completeness Review

### Feature Requirement Traceability Matrix

| Requirement (Issue AC) | Implemented File/Function | Proof | Status |
|---|---|---|---|
| AC1: `prisma migrate deploy` runs as named pipeline step before any `az containerapp update` | `.github/workflows/deploy.yml` — "Run database migrations" step (lines 151-196) | Step at line 155, before "Deploy API" at line 198 — git diff confirms ordering | Met |
| AC2: Pipeline fails and containers are not swapped if migration fails | `.github/workflows/deploy.yml` — polling loop exits 1 on Failed/Stopped/timeout | `exit 1` at deploy.yml lines 187-188 (Failed/Stopped) and 194-195 (timeout); GHA stops subsequent steps on exit 1 | Met |
| AC3: `_prisma_migrations` queried to assert `applied_steps_count == steps_count` | `packages/database/scripts/verify-migrations.mjs` via `prisma.$queryRaw` | SQL WHERE clause checks `applied_steps_count < steps_count` OR stuck-started condition; exits 1 if any incomplete row | Met |
| AC4: `20260505000000_survey_import_batch` reworked to dedup before unique index | N/A — resolved by closed issue #389 | Issue #389 (closed): index was wrong by design, removed from migration; `20260514120000_drop_live_dedup_unique` cleans up | Met (external) |
| AC5: `workflow_dispatch` also runs the migration gate | `.github/workflows/deploy.yml` — migration step in single `build-and-deploy` job | `on: workflow_run + workflow_dispatch` both route to same job with migration step | Met |

### Technical Design Traceability Matrix

Source of truth: issue #386 body "Proposed Fix" section (no formal RFC exists).

| Design Commitment | Implemented File | Proof | Status |
|---|---|---|---|
| Move migrate deploy out of container startup | `docker-entrypoint-migrate.sh` does NOT exec API server; deploy.yml runs migrate before update | Entrypoint ends after verify; no `exec node apps/api/...` | Met |
| Run ephemeral ACA Job using the API image | `scripts/provision-migrate-job.sh` | `az containerapp job create --trigger-type Manual --image customereq-api:latest` | Met |
| Executes `prisma migrate deploy` | `apps/api/docker-entrypoint-migrate.sh` line 14 | `$PRISMA migrate deploy` | Met |
| Queries `_prisma_migrations` to assert no rows with `finished_at IS NULL` | `packages/database/scripts/verify-migrations.mjs` | WHERE includes `finished_at IS NULL AND rolled_back_at IS NULL AND started_at IS NOT NULL` | Met |
| Exits non-zero on failure → containers not swapped | `docker-entrypoint-migrate.sh` (set -e), `verify-migrations.mjs` (process.exit(1)), deploy.yml (exit 1) | All three exit paths covered | Met |
| `az containerapp job start` pipeline pattern | `.github/workflows/deploy.yml` lines 167-170 | `az containerapp job start --name customereq-migrate` with execution polling | Met |
| Migration SQL hardening (dedup before index) | N/A — addressed by #389 | Closed issue #389: erroneous index removed | Met (external) |
| DATABASE_URL from Key Vault (no plain-value) | `scripts/provision-migrate-job.sh` | `--secrets "database-url=keyvaultref:..."` + `--env-vars "DATABASE_URL=secretref:database-url"` | Met |
| ACR pull via managed identity | `scripts/provision-migrate-job.sh` | `--registry-identity system` — no username/password | Met |

### Feedback Completeness

- Quality feedback file: `docs/evidence/386-feature-implementation-feedback.md` — 0 issues, all checks PASS or N/A. No UNADDRESSED items.
- Human feedback: none (first submission).

### Validation Completeness

| Validation type | Status |
|---|---|
| UI validation | N/A — no UI changes |
| Mobile validation | N/A |
| pnpm lint | PASS (0 errors) |
| pnpm typecheck | PASS (19/19) |
| pnpm test:smoke | Blocked by DB not running locally — pre-existing env condition; CI validates |
| Shell syntax (bash -n) | PASS |
| YAML syntax | PASS (no tabs, 324 lines) |

---

## Security Review

### Executive Summary

Diff-scoped review of 5 changed files (deploy.yml, Dockerfile.api, docker-entrypoint-migrate.sh, verify-migrations.mjs, provision-migrate-job.sh). **0 findings** across all severity levels. No action required before submission.

### Review Scope

- `reviewType`: embedded-diff-review
- `reviewScope`: diff
- `surfaceAreaPaths`: `.github/workflows/deploy.yml`, `apps/api/docker-entrypoint-migrate.sh`, `packages/database/scripts/verify-migrations.mjs`, `scripts/provision-migrate-job.sh`, `Dockerfile.api`
- Base: `origin/main`

### Threat Surface Summary

| Surface | File | Heuristic |
|---------|------|-----------|
| `data-pipeline` | `packages/database/scripts/verify-migrations.mjs` | Imports `@prisma/client`, runs SQL directly against DB |

Surfaces not detected: `web`, `api`, `llm-app`, `mobile`, `capability-authoring`.

### Coverage Matrix

| Category | Status | Notes |
|----------|--------|-------|
| Secrets in code | Pass | All secrets via Key Vault `keyvaultref:` references — no plain values |
| SQL / NoSQL injection (A03) | Pass | `$queryRaw` template literal — Prisma parameterizes; no user input flows in |
| Shell injection (GHA) | Pass | `IMAGE_TAG` from GitHub-controlled SHA; `EXECUTION`/`STATUS` from Azure CLI controlled output |
| Privacy / PII | Pass | `_prisma_migrations` contains migration metadata only — no personal data |
| Privilege escalation | Pass | `Key Vault Secrets User` (read-only) + `AcrPull` (read-only) — minimum required |
| Broken access control (A01) | N/A | No new API endpoints or auth changes |
| OWASP Web Top 10 | N/A | No web surface in diff |
| OWASP API Top 10 | N/A | No API surface in diff |
| OWASP LLM Top 10 | N/A | No LLM surface in diff |

### Findings

None.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

No findings to verify.

### Applied Fixes and Filed Work Items

None required.

### Accepted / Deferred / Blocked

None.

### Compliance Control Mapping

N/A — no compliance framework active for this issue.

### Run Metadata

- Date: 2026-05-17
- Commit reviewed: 92c9d2f
- Reviewer: Claude Sonnet 4.6
- Caps hit: none
- Errors: none
