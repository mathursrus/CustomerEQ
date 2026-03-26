# Evidence: Deploy CustomerEQ MVP to Azure (Issue #28)

## Summary
- **Issue**: #28 — Deploy CustomerEQ MVP to Azure (Container Apps + PostgreSQL)
- **Workflow**: cloud-application-deployment
- **Date**: 2026-03-25

## Infrastructure Provisioned

| Resource | Name | Location | SKU |
|----------|------|----------|-----|
| Resource Group | customereq-prod | East US | — |
| Container Registry | customereqcr.azurecr.io | East US | Basic |
| PostgreSQL Flexible Server | customereq-db | Central US | Burstable B1ms |
| Container Apps Environment | customereq-env | East US | Consumption |

**Note:** PostgreSQL was placed in Central US because East US and East US 2 were restricted for flex server provisioning.

## Services Deployed

| Service | Container App | Image | Ingress | URL |
|---------|--------------|-------|---------|-----|
| API (Fastify v5) | customereq-api | customereq-api:v2 | External, port 4000 | https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io |
| Web (Next.js 15) | customereq-web | customereq-web:latest | External, port 3000 | https://customereq-web.salmonsea-4eb14bdc.eastus.azurecontainerapps.io |
| Worker (BullMQ) | customereq-worker | customereq-worker:v2 | None (background) | — |

## Files Changed

### New Files
- `Dockerfile.api` — Multi-stage Docker build for API service
- `Dockerfile.web` — Multi-stage Docker build for Web service (Next.js standalone)
- `Dockerfile.worker` — Multi-stage Docker build for Worker service
- `.dockerignore` — Excludes node_modules, .git, docs, fraim
- `.github/workflows/deploy.yml` — GitHub Actions CI/CD pipeline for Azure deployment
- `docs/evidence/28-deploy-evidence.md` — This file

### Modified Files
- `apps/web/next.config.ts` — Added `output: 'standalone'` for Docker support
- `apps/api/src/app.ts` — Added Azure Container Apps domain to CORS origins
- `apps/api/src/routes/analytics.ts` — Fixed implicit `any` type annotations (TS strict mode)
- `packages/database/prisma/schema.prisma` — Added `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`

## Validation Results

| Check | Result |
|-------|--------|
| API `/healthz` | `{"status":"ok","services":{"database":"ok","redis":"ok","api":"ok"}}` |
| Web `/` | HTTP 200 |
| Web `/sign-in` | HTTP 200 |
| Unauthenticated `/v1/programs` | HTTP 401 (correctly rejected) |
| Webhook endpoint POST | HTTP 401 (auth required) |
| Worker status | Healthy, RunningAtMaxScale |

## Issues Encountered & Resolved

1. **Azure CLI encoding bug on Windows** — `az acr build` log streaming crashes with `UnicodeEncodeError` due to pnpm progress bar Unicode chars. Workaround: used `--no-logs` and fetched logs via REST API.
2. **PostgreSQL region restriction** — East US blocked for flex servers. Deployed to Central US instead.
3. **Prisma OpenSSL mismatch** — Alpine Linux (node:20-alpine) ships OpenSSL 3, but Prisma 5.22 defaulted to OpenSSL 1.1 binary. Fixed by adding `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to schema.
4. **TypeScript strict mode errors** — `analytics.ts` had implicit `any` parameters in arrow functions. Added explicit type annotations.
5. **Next.js standalone output** — Required `output: 'standalone'` in next.config.ts for Docker deployment.
6. **Windows MAX_PATH** — `az acr build` tar failed with deep pnpm node_modules paths. Resolved by removing local node_modules before building.

## Related Issues Filed
- [#29](https://github.com/mathursrus/CustomerEQ/issues/29) — Isolate dev and prod Redis (Upstash) instances
