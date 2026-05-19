---
author: swavak@gmail.com
date: 2026-05-18
synthesized: 2026-05-18
---

# Postmortem: CD: add dedicated Prisma migration stage to deploy pipeline - Issue #386

**Date**: 2026-05-18
**Duration**: ~2 sessions (context compaction occurred mid-work)
**Objective**: Move `prisma migrate deploy` out of container startup into a dedicated Azure Container Apps Job that runs before any `az containerapp update`, so a failed migration fails the pipeline instead of silently deploying a broken container.
**Outcome**: Success — all 5 ACs met, PR #411 merged, `customereq-migrate` ACA Job provisioned in prod.

## Executive Summary

Implemented a fail-fast migration gate by adding a new ACA Job (`customereq-migrate`) that runs `prisma migrate deploy` plus a `_prisma_migrations` completeness assertion before the deploy pipeline swaps containers. Infrastructure provisioning required multiple workarounds due to Windows Git Bash path expansion, an opaque Azure CLI RBAC error, and disk space exhaustion. Code implementation itself was clean (0 security findings, 0 quality issues, all ACs met in first pass).

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Updated**: §7.4 (CD pipeline shape diagram), §8 (infrastructure table — new `customereq-migrate` ACA Job row)
**Changes Made**: Added `customereq-migrate` Manual-trigger ACA Job to the infrastructure table; added CD pipeline shape diagram showing migration gate ordering relative to container updates.
**Rationale**: A new persistent infrastructure component requires documentation so the next engineer understands what `customereq-migrate` is and why it exists.
**Updated in PR**: yes

## Timeline of Events

### Phase 1: Scoping
- ✅ **Discovered AC #4 already resolved**: Issue #389 (closed) removed the erroneous unique index — no migration rework needed. Avoided implementing unnecessary work.
- ✅ **Identified chicken-and-egg constraint**: ACA Job must be created before principal ID is known; AcrPull must be assigned before image can be pulled. Planned two-step provisioning: placeholder image → role assignment → image update.

### Phase 2: Implementation
- ✅ **Created `docker-entrypoint-migrate.sh`**: Migration-only entrypoint; does not start API server.
- ✅ **Created `verify-migrations.mjs`**: Queries `_prisma_migrations` for incomplete rows; exits 1 on any.
- ✅ **Created `provision-migrate-job.sh`**: One-time ACA Job provisioner using Key Vault `keyvaultref:` secrets and `--registry-identity system`.
- ✅ **Modified `deploy.yml`**: Migration step between image pushes and container updates.
- ✅ **Modified `Dockerfile.api`**: `chmod +x` both entrypoints.
- ❌ **Disk space exhausted mid-session**: `pnpm store prune` freed 356 MB; blocking.

### Phase 3: Provisioning
- ❌ **Ran provision script in PowerShell**: Not recognized; must use bash. Switched to Git Bash.
- ❌ **Git Bash expanded `/app/...` to `C:/Program Files/Git/app/...`**: ACA Job stored wrong entrypoint command.
- ❌ **`az role assignment create` returned `MissingSubscription`**: Persistent across all flag variations (`--assignee-object-id`, explicit `--subscription`, scope from `az acr show`). Root cause opaque.
- ✅ **Workaround via `az rest`**: Direct RBAC API call succeeded where CLI wrapper failed.
- ✅ **Discovered AcrPull already assigned**: `RoleAssignmentExists` from `az rest` confirmed prior run completed it.
- ✅ **Fixed path expansion bug via PATCH**: Used `az rest PATCH` to correct entrypoint command and set registry config.

### Phase 4: Validation
- ✅ **Image pull succeeded**: "Successfully pulled image `customereq-api:latest` in 13.05s" — ACR auth working.
- ❌ **Job execution failed**: `no such file or directory: /app/apps/api/docker-entrypoint-migrate.sh` — expected; `latest` image predates the branch.
- ✅ **Recognized expected failure**: Script is added by this PR's `COPY . .`; failure is a pre-merge state artifact, not a defect.
- ✅ **CI validated after merge**: "Build production images" SUCCESS; new image (containing the script) now in ACR.

## Root Cause Analysis

### 1. **Git Bash path expansion corrupted ACA Job entrypoint**
**Problem**: `provision-migrate-job.sh` passed `--args /app/apps/api/docker-entrypoint-migrate.sh`; Git Bash on Windows expanded `/app/...` to `C:/Program Files/Git/app/...` before the value reached `az CLI`.
**What drove it**: No corpus entry covers this — the Windows Git Bash POSIX-path-to-Win-path translation behavior (`MSYS_NO_PATHCONV`) is not in validated-patterns or mistake-patterns. Script was authored knowing it would run in bash, but not accounting for the Git Bash variant of bash on Windows.
**Corpus conflict**: none — this is a new failure mode not previously encountered in this project.
**Impact**: ACA Job stored wrong entrypoint; execution would have failed in production without the PATCH fix. Caught via Log Analytics system logs after first test run.

### 2. **`az role assignment create` silently failing on this subscription**
**Problem**: Every form of `az role assignment create` (with/without `--assignee-object-id`, with/without explicit `--subscription`, at ACR scope or subscription scope) returned `MissingSubscription`. `az role assignment list` at same scope succeeded.
**What drove it**: Unknown CLI/ARM routing issue. No corpus entry covers this. The error message is misleading — subscription ID was correct and confirmed active. The `az rest` fallback was the correct pivot.
**Corpus conflict**: none.
**Impact**: Role assignment blocked for ~30 min until `az rest` workaround found. No production impact (AcrPull was already assigned from earlier run).

### 3. **Disk space exhausted mid-implementation**
**Problem**: pnpm global store filled the disk (100%) during dependency resolution; `git commit` and `pnpm typecheck` both blocked.
**What drove it**: Pre-existing condition in the dev environment. No corpus entry covers disk hygiene. `pnpm store prune` is the fix but was not in the session's initial checklist.
**Corpus conflict**: none.
**Impact**: ~10 min blocked; `pnpm test:smoke` and `pnpm build` could not run locally for the rest of the session (pre-existing env condition; CI validates instead).

## What Went Wrong

1. **Git Bash path expansion on Windows**: Running `provision-migrate-job.sh` in Git Bash on Windows caused `/app/...` paths to be expanded to `C:/Program Files/Git/app/...` before reaching the Azure CLI. The ACA Job was created with the wrong entrypoint command.
2. **`az role assignment create` opaque error**: `MissingSubscription` appeared on every invocation regardless of parameter variation. Required falling back to raw `az rest` REST calls to complete role assignment.
3. **Disk space exhaustion**: pnpm cache filled the volume mid-session, blocking commit and typecheck.
4. **Provision script run in PowerShell first**: Wasted a retry cycle; provision scripts requiring bash must be run in Git Bash (or WSL), not PowerShell.

## What Went Right

1. **AC #4 scoping**: Checked issue #389 before attempting to rework the migration — discovered it was already resolved, avoided unnecessary implementation work.
2. **Security posture**: All secrets via Key Vault `keyvaultref:`, system-assigned managed identity for ACR pull, minimum-privilege RBAC. Security review: 0 findings.
3. **Chicken-and-egg handled correctly**: Anticipated the ACA Job creation / role assignment ordering constraint upfront; used placeholder image to get the job created, then assigned roles separately.
4. **Log Analytics diagnosis**: Queried `ContainerAppSystemLogs_CL` after the first execution failure and found the exact OCI error message immediately, identifying the entrypoint path corruption.
5. **CI green on first push**: All checks passed including "Build production images" without any iteration.
6. **PR merged without feedback rounds**: No review comments; clean first submission.

## What I Almost Did Wrong But Caught

1. **Almost declared provisioning done after AcrPull error**: The `az role assignment create` failure loop could have led to giving up and leaving the job without the role. Caught by trying `az rest` as an alternative before declaring it broken. Also discovered AcrPull was already assigned from a partial prior run.
2. **Almost missed the entrypoint path bug**: The first two execution failures showed only `Failed` status with no replica logs available. Caught by querying `ContainerAppSystemLogs_CL` rather than accepting "the image pull probably works, let CI validate."

## Where Past Learnings Actually Fired

1. **[VP-HIGH] Read codebase before designing**: Fired during scoping when checking the status of AC #4. Reading the closed issue #389 and its PR before implementing prevented unnecessary work on the migration rework.
2. **[P-HIGH] Merging PR with failing CI**: Confirmed CI green (all checks SUCCESS) before executing the merge command. The `--squash --auto` merge only proceeded after verifying the status check rollup.

## Lessons Learned

1. **On Windows, set `MSYS_NO_PATHCONV=1` before running bash provisioning scripts that pass absolute Linux paths to CLI tools.** Without it, Git Bash silently rewrites `/app/...` to `C:/Program Files/Git/app/...`. Add this env var to the script header or document it prominently in the one-time provisioning runbook.
2. **`az role assignment create` can silently fail on some subscriptions; `az rest` is the reliable fallback.** When `MissingSubscription` appears despite a correct scope and active subscription, skip CLI wrapper variants and go directly to `PUT https://management.azure.com/{scope}/providers/Microsoft.Authorization/roleAssignments/{guid}?api-version=2022-04-01`.
3. **Always verify ACA Job config (registry, command, image) with `az containerapp job show` after creation.** The creation may accept the request but fail to persist some fields (e.g., `registries: null` when the image pull fails during provisioning). This is especially true for the registry identity field.
4. **`ContainerAppSystemLogs_CL` in Log Analytics is the fastest path to ACA Job execution failure diagnosis.** Console logs (`ContainerAppConsoleLogs_CL`) require the container to have started; system logs capture OCI runtime errors before the container process starts.
5. **ACA Job test runs against `latest` before the feature branch is merged will fail if the new image assets aren't in `latest` yet.** This is expected behavior, not a defect. The correct validation is to note the image pull succeeded and defer entrypoint validation to post-merge CI.

## Agent Rule Updates Made to avoid recurrence

1. **Provision scripts that pass absolute POSIX paths to az CLI**: Add `export MSYS_NO_PATHCONV=1` at the top of any `.sh` script that will be run on Windows Git Bash and passes paths like `/app/...` as arguments to CLI tools.
2. **ACA Job provisioning pattern**: Document and follow the two-step creation pattern: (1) create with `mcr.microsoft.com/k8se/quickstart:latest` placeholder, (2) assign roles via `az rest` if `az role assignment create` fails, (3) update image + registry + command via `az rest PATCH`.

## Enforcement Updates Made to avoid recurrence

1. **Add to `provision-migrate-job.sh` header**: `export MSYS_NO_PATHCONV=1` as first line after shebang, with a comment explaining it prevents Git Bash on Windows from translating `/app/...` paths.
2. **Post-job verification step in provision scripts**: After `az containerapp job create`, always run `az containerapp job show --query "properties.template"` to assert the command and image are set correctly before proceeding.
