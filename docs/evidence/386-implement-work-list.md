# Issue #386 — Implementation Work List

**Title**: CD: add dedicated Prisma migration stage to deploy pipeline (fail-fast before container swap)
**Type**: feature
**Branch**: `feature/386-cd-add-dedicated-prisma-migration-stage-to-deploy-pipeline-fail-fast-before-container-swap`

---

## Acceptance Criteria

| # | AC | Status |
|---|----|----|
| 1 | `prisma migrate deploy` runs as a named pipeline step before any `az containerapp update` | **DONE** — "Run database migrations" step in deploy.yml at line 155, before Deploy API at line 198 |
| 2 | Pipeline fails and containers are not swapped if any migration step fails | **DONE** — polling loop exits 1 on Failed/Stopped/timeout; GitHub Actions stops subsequent steps |
| 3 | `_prisma_migrations` queried post-migration to assert `applied_steps_count == steps_count` | **DONE** — `packages/database/scripts/verify-migrations.mjs` via `prisma.$queryRaw` |
| 4 | `20260505000000_survey_import_batch` reworked to dedup before unique index | **DONE** — resolved by closed issue #389; unique index was wrong by design (contradicts `responsePolicy=MULTIPLE`) and was removed. Drop migration `20260514120000_drop_live_dedup_unique` cleans up any environment where it was applied. No further action needed. |
| 5 | `workflow_dispatch` (manual hotfix path) also runs the migration gate | **DONE** — migration step is in the single `build-and-deploy` job shared by both `workflow_run` and `workflow_dispatch` triggers |

---

## Implementation Checklist

### Files to Create

- [x] `apps/api/docker-entrypoint-migrate.sh` — Migration-only container entrypoint. Runs `prisma migrate deploy` then calls the verify script. Does NOT start API server. Exits non-zero on any failure.
- [x] `packages/database/scripts/verify-migrations.mjs` — Queries `_prisma_migrations` via Prisma `$queryRaw` and exits 1 if any row has `applied_steps_count < steps_count` or is stuck in a started-but-never-finished state.
- [x] `scripts/provision-migrate-job.sh` — One-time provisioning of the `customereq-migrate` Azure Container Apps Job. Uses system-assigned managed identity for ACR pull and Key Vault `database-url` secret (per CLAUDE.md secrets policy).

### Files to Modify

- [x] `Dockerfile.api` — Add `chmod +x` for `docker-entrypoint-migrate.sh` alongside existing entrypoint.
- [x] `.github/workflows/deploy.yml` — Insert "Run database migrations" step between image pushes and first `az containerapp update`. Step: update job image → start execution → poll until Succeeded/Failed → fail pipeline if not Succeeded.

---

## Validation Requirements

- `uiValidationRequired`: false (no UI changes)
- `mobileValidationRequired`: false
- `pnpm build` must pass (no TypeScript source changed)
- `pnpm typecheck` must pass
- `pnpm lint` must pass
- `pnpm test:smoke` must pass (no application logic changed)
- Pipeline validation: YAML linting + end-to-end deploy run on next merge to main

---

## Architecture Notes

- No new Terraform/Bicep — consistent with repo pattern of `az` CLI scripts for infra.
- The ACA Job `customereq-migrate` is provisioned once via `scripts/provision-migrate-job.sh`; the deploy pipeline updates its image on each run.
- `workflow_dispatch` path shares the same job steps as `workflow_run`, so the migration gate applies automatically to both (AC #5).
- Secrets policy (CLAUDE.md §Production Secrets): `DATABASE_URL` bound via `keyvaultref:` + `identityref:system`. No plain-value secrets.
