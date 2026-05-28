# Validated Patterns — swavak@gmail.com

**Last synthesized**: 2026-05-22 (1 new entry added, 2 entries updated)

Durable judgment calls and successful unusual-but-correct decisions worth reproducing.

---

#### [VP-HIGH] Use `cmd /c rmdir /s /q` to delete worktree directories on Windows

**Score**: 8.0
**Last seen**: 2026-05-18
**Recurrences**: 3
**First synthesized**: 2026-05-18

The FRAIM `cleanup-branch.ts` script consistently fails to delete worktree directories on Windows with "Filename too long" or "Directory not empty" errors. This is caused by deeply nested `node_modules` paths inside the worktree that exceed Windows MAX_PATH limits. PowerShell's `Remove-Item -Recurse -Force` hits the same limit. The reliable workaround is `cmd /c "rmdir /s /q \"<path>\""` — cmd's `rmdir` uses a different path traversal that bypasses the MAX_PATH restriction. Apply this immediately after the cleanup script fails on the worktree removal step.

---

#### [VP-HIGH] Read codebase before designing — prevents designing against wrong assumptions

**Score**: 22.1
**Last seen**: 2026-05-22
**Recurrences**: 6
**First synthesized**: 2026-05-08

Before drafting an RFC or technical design, reading relevant codebase files (auth plugin, existing routes, Prisma schema, worker code) surfaces all significant gaps before they become design assumptions. Fired in Issue #3 (caught auth plugin gap and missing slug fields before writing RFC), Issue #156 (confirmed `slaBreachedAt` already existed, preventing a redundant migration), Issue #386 (discovered AC #4 already resolved by closed Issue #389 before implementing), Issue #388 (confirmed all 6 canary endpoints exist in route files before writing the CI step), Issue #389 (reading `schema.prisma` revealed the drop migration already existed on main, preventing a duplicate), and Issue #457 (reading `ci.yml` before writing found the BAML verification step that needed explicit handling in the work-list — prevented a missed step placement). This pattern has prevented rework in both backend design and implementation phases across six separate issues.

---

#### [VP-HIGH] Branch verification before first commit fires correctly at session resume

**Score**: 18.3
**Last seen**: 2026-05-22
**Recurrences**: 4
**First synthesized**: 2026-05-08

When resuming a session where unrelated files are staged or a different issue's branch is checked out, verifying the current branch before staging any work prevents cross-contamination. Fired correctly in Issue #155 (session started on issue-156 branch; caught before staging any changes), Issue #156 (only staged the two new RFC files, leaving pre-existing modified files from other issues unstaged), Issue #387 (confirmed the worktree was on feature/387 branch before any edits), and Issue #457 (verified `feature/457-turbo-build-typecheck-merge` was active — not the stale `feature/493-*` branch — before staging any files). The mistake-patterns entry for this behavior is actively working as a self-check.

---

#### [VP-MED] Use unauthenticatedRequest() for public route integration tests

**Score**: 4.4
**Last seen**: 2026-04-02
**Recurrences**: 1
**First synthesized**: 2026-05-08

When writing integration tests for a route that is unauthenticated (e.g., `POST /v1/members/enroll`), the correct request helper is `unauthenticatedRequest()`, not the standard authenticated one. Recognized immediately in Issue #3 implementation when enrollment tests were first written — the fix was applied before any tests were committed with the wrong helper.

---

#### [VP-MED] Explicitly surface open questions in RFC rather than resolving with assumptions

**Score**: 4.3
**Last seen**: 2026-03-31
**Recurrences**: 1
**First synthesized**: 2026-05-08

When two significant design decisions (enrollment URL slug anchor, auth strategy for new members) could not be resolved with confidence from the codebase alone, documenting them as open questions in the RFC rather than guessing led to a single focused feedback round that resolved both cleanly (Issue #3 technical design). Speculative resolution would have required broader rework once the user's actual preference was known.

---

#### [VP-MED] ACA Job two-step provisioning: placeholder → `az rest` roles → image PATCH

**Score**: 5.0
**Last seen**: 2026-05-18
**Recurrences**: 1
**First synthesized**: 2026-05-18

When provisioning an Azure Container Apps Job with a system-assigned managed identity that needs AcrPull: (1) create the job with `mcr.microsoft.com/k8se/quickstart:latest` to get a principal ID without needing ACR access, (2) assign AcrPull via `az rest PUT` (not `az role assignment create`, which may return `MissingSubscription`), (3) update the image, registry, and command via `az rest PATCH`. After creation, always run `az containerapp job show --query "properties.template"` to verify the command and registry identity persisted — the create call may accept but not persist some fields. Discovered in Issue #386.

---

#### [VP-MED] Staging only spec/evidence files during spec commit — not untracked implementation files

**Score**: 5.0
**Last seen**: 2026-05-04
**Recurrences**: 1
**First synthesized**: 2026-05-18

When the spec phase runs after an aborted implementation spike (stashed or left untracked), implementation files remain visible in `git status`. When staging the spec commit, explicitly check `git status` and add only spec, mock, and evidence files — leave implementation files untracked for the future `feature-implementation` job. In Issue #262, correctly staging only spec/mock/evidence files prevented mixing implementation artifacts into the spec commit despite nine untracked implementation files being visible at the time.

---

#### [VP-LOW] `ContainerAppSystemLogs_CL` in Log Analytics for ACA Job execution failure diagnosis

**Score**: 3.0
**Last seen**: 2026-05-18
**Recurrences**: 1
**First synthesized**: 2026-05-18

When an Azure Container Apps Job execution shows `Failed` status with no replica logs available, query `ContainerAppSystemLogs_CL` in Log Analytics rather than `ContainerAppConsoleLogs_CL`. Console logs require the container process to have started; system logs capture OCI runtime errors (wrong entrypoint path, missing registry credentials) before the container starts. In Issue #386, this query identified the Git Bash path expansion bug immediately after the first test run. Query: `ContainerAppSystemLogs_CL | where RevisionName_s == "<job-name>" | order by TimeGenerated desc`.

---

#### [VP-MED] turborepo-remote-cache Azure env vars are non-obvious — always verify from source

**Score**: 5.0
**Last seen**: 2026-05-22
**Recurrences**: 1
**First synthesized**: 2026-05-22

The `ducktors/turborepo-remote-cache` library uses `ABS_CONNECTION_STRING` (not `AZURE_STORAGE_CONNECTION_STRING`) for the Azure Blob Storage connection string, and `STORAGE_PATH` (not `AZURE_STORAGE_CONTAINER`) for the blob container name. The default `STORAGE_PATH` is `turborepocache` — not `turbo-cache`. The Container App `customereq-turbo-cache` was deployed with wrong names from day 1 and was silently unhealthy for 4 days; CI showed 0% cache hit rate with no obvious diagnostic signal. The correct names are only visible in `src/env.ts` in the library source. Before deploying or reconfiguring `turborepo-remote-cache`, fetch `src/env.ts` from the GitHub repo to confirm env var names. After any fix, verify blob artifact count in the storage container — not just Container App health state.

---
