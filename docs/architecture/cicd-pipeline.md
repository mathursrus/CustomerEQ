# CI/CD Pipeline — Technical Design

**Last updated:** 2026-05-20
**Owner:** swavak@gmail.com
**Epic:** #391 (CI/CD pipeline improvements)

---

## 1. Overview

The CustomerEQ pipeline has two distinct phases:

- **CI** — validates every pull request before merge (correctness, tests, lint, Docker probe)
- **CD** — deploys every merged commit to production on Azure Container Apps

They are connected by a `workflow_run` trigger: CD fires automatically after CI succeeds on `main`. This ensures no commit reaches production without passing the full test gate.

```
PR opened / pushed
       │
       ▼
  ┌─────────────────────────────────────┐
  │              CI (ci.yml)            │
  │  ┌─────────────┐  ┌──────────────┐  │
  │  │ Build & Test │  │     Lint     │  │  ← parallel jobs
  │  └──────┬──────┘  └──────────────┘  │
  │         │                           │
  │  ┌──────▼──────┐                    │
  │  │ docker-build │                   │  ← PR only; needs Build & Test
  │  └─────────────┘                    │
  └─────────────────────────────────────┘
       │  (merge to main)
       ▼
  ┌─────────────────────────────────────┐
  │           CD (deploy.yml)           │
  │  Build images → Migrate → Deploy    │
  │  → Verify SHAs → Health → Canary    │
  └─────────────────────────────────────┘
```

---

## 2. Why CI triggers on both `pull_request` and `push` to `main`

`ci.yml` runs on both events. The `push: branches: [main]` trigger was added in fix(#451) and is load-bearing for the CD pipeline.

`deploy.yml` uses a `workflow_run` trigger, which fires after a named workflow completes on a branch. Without the `push` trigger on `ci.yml`, no CI workflow completes on `main` pushes, so `workflow_run` never fires and production never gets deployed after a merge.

The `docker-build` job is gated by `if: github.event_name == 'pull_request'` so it only runs on PRs — not on main pushes — since the CD pipeline builds and pushes the real production images.

---

## 3. Three-tier test model

Tests are split across three workflows by cost and cadence:

| Tier | Workflow | Cadence | Gate | Constraint |
|------|----------|---------|------|-----------|
| **Smoke** | `ci.yml` | Every PR | Required | No LLM API keys, no paid services |
| **Nightly regression** | `nightly-regression.yml` | 02:00 UTC | Advisory | Requires `AZURE_OPENAI_API_KEY` |
| **Weekly ops** | `security-audit.yml` | Mon 09:00 UTC | Advisory | npm registry access |
| **Weekly sanity** | `demo-sanity.yml` | Mon 09:00 UTC | Advisory | Requires running storefront |

**Rule 11a:** Tests must never skip silently. If a dependency (API key, DB, server) is missing, the test must fail loudly with a clear error.

See [test-plan.md](../project-management/test-plan.md) for the full test inventory and tier-assignment decision guide.

---

## 4. CI pipeline (`ci.yml`)

### 4.1 Doc-only skip

Doc-only changes use a two-layer approach — trigger-level filtering (primary) plus in-job path filtering (belt-and-braces).

**Layer 1 — trigger-level `paths-ignore` (#488):** Both `on.push` and `on.pull_request` declare `paths-ignore` covering `*.md`, `docs/**`, template files, `CODEOWNERS`, `.gitattributes`, and `LICENSE`. When every changed file matches these patterns, GitHub never queues the workflow at all — no runner is allocated and no service containers start. This eliminates the ~29s postgres + redis startup cost that was previously paid on every doc-only run before the in-job filter could skip.

**Why trigger-level is safe:** The `main` branch has no required status checks configured in branch protection. A CI check not appearing for doc-only PRs does not block merges.

**Layer 2 — in-job `dorny/paths-filter@v3`:** Remains as belt-and-braces for any push that passes the trigger filter but is later determined to be doc-only (edge cases, mixed squash commits). Uses a leading `'**'` pattern to seed the match set, then subtracts exclusions. The leading `'**'` is required because negation-only patterns default to `true` in dorny (#351). New top-level directories are default-included.

**Under-skipping vs over-skipping:** Under-skipping (spurious CI run on a doc change) is acceptable waste; over-skipping (real change treated as doc-only) is a real bug. The trigger-level filter is intentionally conservative — it only skips when *all* changed files match the ignore list.

### 4.2 Build & Test job

Sequential steps within the job:

| Step | Purpose | Duration (typical) |
|------|---------|-------------------|
| Initialize containers | postgres + redis service startup | ~26s |
| Checkout | `fetch-depth: 2` (required for paths-filter diff on push events) | ~3s |
| Install dependencies | `pnpm install --frozen-lockfile` | ~7s |
| Validate Prisma schema | `prisma validate` — catches schema syntax errors early | ~1s |
| Check enum migration coverage | Ensures every new enum has a migration (#enum-coverage) | ~0s |
| Generate Prisma client | `pnpm db:generate` — required before build (#383) | ~2s |
| Run migrations | Full `prisma migrate deploy` against empty postgres (#270) | ~2s |
| **Build** | `pnpm build` via Turbo remote cache | **~321s** |
| **Type check** | `pnpm typecheck` via Turbo | **~221s** |
| Install Playwright browsers | Chromium only | ~22s |
| Smoke Test Suite | `pnpm test:smoke` | **~70s** |
| Upload coverage | Codecov (non-blocking) | ~3s |

**Why migrations run on every PR (#270):** A prior gap allowed non-idempotent migrations to merge because CI never ran `migrate deploy`. The regression gate catches that class by running the full migration history against a fresh empty database on every PR.

**Turbo remote cache:** Build and typecheck use Turbo with `TURBO_TOKEN` / `TURBO_API` / `TURBO_TEAM` secrets pointing at a self-hosted cache server (`customereq-turbo-cache` Container App). Cache keys are based on source file hashes + declared env vars. Unchanged packages hit the cache; changed packages and their dependents rebuild.

### 4.3 Lint job

Runs in parallel with Build & Test — no `needs:` dependency. Uses the same doc-only skip and Turbo remote cache. Typical duration: ~176s (2m56s), always finishing inside the ~12m Build & Test window so it is never on the critical path to first signal.

**Why separate:** Before #395, lint ran inside the single monolithic job. Time to first lint failure was ~15m27s (full build had to finish first). As a parallel job, lint fails in ~2m56s — a 12m improvement in feedback speed.

### 4.4 docker-build job

Runs after Build & Test (`needs: ci`), on PR events only.

Builds api, worker, and web images locally on the GHA runner using `docker/build-push-action@v6` with `push: false`. Images are **never pushed** and are discarded when the job ends. GitHub Actions layer cache (`type=gha`, scoped per image) is used to speed up rebuilds.

**Purpose — module-resolution probe (#273):** After each image builds, CI runs:
```bash
docker run --rm --entrypoint node ceq-api:<sha> \
  --input-type=module \
  -e "await import('/app/packages/ai/dist/index.js')..."
```
This catches a specific failure class: BAML generates ESM files with `.js` extension imports. pnpm workspace hoisting places packages at `packages/ai/` locally, but inside the container they live at `/app/packages/ai/`. If any `FROM`/`COPY` step in the Dockerfile disrupts that layout, the ESM resolver fails at container startup. This failure is invisible to `pnpm build` on the GHA runner — it only manifests inside the container. One real incident (#273) caused this gate to exist.

**Web image uses a dummy Clerk key:** `@clerk/nextjs` decodes the publishable key at Next.js build time to validate its format. The real key is not available in CI for security reasons. The dummy value `pk_test_Y2xlcmsuZXhhbXBsZS5jb20k` (decodes to `clerk.example.com$`) satisfies the format check without granting any functional Clerk access.

**Typical duration:** 730–968s (13–16m). This job is not on the critical path to merge (only Build & Test and Lint are required gates), but it does add wall clock time for PR authors waiting for full green.

---

## 5. CD pipeline (`deploy.yml`)

### 5.1 Triggers

| Trigger | When | Notes |
|---------|------|-------|
| `workflow_run` on CI | After CI succeeds on `main` | Head SHA resolved via `github.event.workflow_run.head_sha` — not `github.sha`, which points at the default branch tip at dispatch time, not the CI-tested commit |
| `workflow_dispatch` | Manual | Forces full rebuild regardless of diff; used for hotfix / recovery |

Deploys are serialized via `concurrency: group: deploy-prod, cancel-in-progress: false` — back-to-back merges queue rather than race.

### 5.2 Doc-only skip

Uses a direct `git diff HEAD~1 HEAD` shell step rather than `dorny/paths-filter`. Reason: `workflow_run` events use a detached-HEAD-by-SHA checkout; dorny's `base: HEAD~1` also tries to resolve `main` as a merge-base anchor, which fails because `main` isn't a local ref in that checkout (#347). The `git diff` shell approach is semantically equivalent with no third-party action or merge-base resolution.

`workflow_dispatch` always forces `build=true` to ensure manual recovery runs always proceed.

### 5.3 Image build and push

Uses `az acr build` — builds run **on Azure Container Registry's cloud infrastructure**, not on the GHA runner. Images are pushed to `customereqcr.azurecr.io` with both a commit SHA tag and `:latest`.

| Image | Dockerfile | Selective? | Notes |
|-------|-----------|------------|-------|
| `customereq-api` | `Dockerfile.api` | No — always built | |
| `customereq-worker` | `Dockerfile.worker` | No — always built | |
| `customereq-web` | `Dockerfile.web` | No — always built | Requires live API FQDN as build arg |
| `customereq-demo` | `Dockerfile.demo-storefront` | Yes — `demo_build` flag (#449) | Only when `apps/demo-storefront/`, workspace files, or its Dockerfile change |
| `customereq-turbo-cache` | `Dockerfile.turbo-cache` | No — always built | Should be selective; tracked in #461 |

**Why `az acr build` instead of `docker/build-push-action`:** ACR builds run on Azure compute, eliminating egress from the GHA runner and removing the need to store ACR admin credentials in GitHub secrets (which would violate the production secrets policy — see CLAUDE.md).

**Why images are built again in CD:** CI builds Docker images for the module-resolution probe but does not push them to ACR (`push: false`). CD rebuilds from source because: (a) the GHA layer cache is not accessible from ACR's cloud build infrastructure, and (b) the web image requires different build args (real Clerk key, live API FQDN) that are not available in CI.

**Base image rate limiting:** ACR tasks pull base images from Docker Hub anonymously by default. Docker Hub rate-limits unauthenticated pulls to 100 per 6 hours. A failed deploy in May 2026 was caused by the fourth sequential `az acr build` task hitting this limit (#449/#451). Mitigated by mirroring the `node` base image into ACR. All Dockerfiles should consistently use `customereqcr.azurecr.io/node:...` rather than Docker Hub directly (#466).

### 5.4 Deploy sequence

```
Build all images (sequential today; #460 proposes parallel)
       │
       ▼
Run database migrations (ACA Job: customereq-migrate)
  └─ Polls every 15s up to 5 min
  └─ If failed/timed-out: pipeline fails, old containers remain live
       │
       ▼
az containerapp update (sequential today; #462 proposes partial parallel)
  API → Worker → Web → Demo → Turbo Cache
       │
       ▼
Verify deployed image SHAs (all 4 main apps)
       │
       ▼
API health check (GET /healthz, 5 retries × 10s)
       │
       ▼
Canary probes (P0 routes: /healthz, /v1/programs, /v1/surveys, POST /v1/events)
              (P1 schema-sensitive: /v1/surveys/_canary_/imports, /v1/members/me/balance, /v1/analytics/cx)
```

**Canary probe strategy:** Routes return 200, 401, 202, or 404 as pass signals. 500 or connection errors are failure signals. No test credentials needed — 401 on authenticated routes confirms auth middleware is wired, not that auth is broken.

**Incompatibility window:** Between the API update and the Worker update, old Worker processes run against the new API. This is safe as long as API/Worker contracts are backward-compatible across a single deploy. A blue-green revision strategy (#465) would eliminate this window entirely.

---

## 6. Docker: CI vs CD — the duplication

This is the most important architectural clarification in the current pipeline.

| | CI `docker-build` | CD `build-and-deploy` |
|---|---|---|
| **When** | Every PR (pull_request event) | Every merge to main (via workflow_run) |
| **Where builds run** | GitHub Actions runner | Azure ACR cloud infrastructure |
| **Pushed to ACR** | No | Yes |
| **Layer cache** | GHA cache (type=gha) | None — cloud-side, no access to GHA cache |
| **Images built** | api, worker, web | api, worker, web, demo*, turbo-cache |
| **Web build args** | Dummy Clerk key | Real Clerk key + live API FQDN |
| **Primary purpose** | Module-resolution probe | Production deployment |
| **Typical duration** | 730–968s | Not measured in GHA steps (cloud-side) |

*demo: conditional on `demo_build` flag

**The duplication:** api and worker are built twice per merged PR (once in CI for the probe, once in CD to deploy). They use the same source but different infrastructure and caches — the CI images cannot be promoted to ACR. The web image is intentionally different between CI and CD (dummy vs real Clerk key), so it must always be rebuilt in CD.

**Proposal (#467):** Replace the docker-build job with a lightweight node probe that runs directly on the GHA runner against the built `dist/` from `pnpm build`. This catches the same ESM resolution failures in ~2s instead of 730–968s, and eliminates the duplication entirely. Dockerfile regression risk shifts to the CD pipeline (acceptable — Dockerfile changes are visible in the diff and fast to fix).

---

## 7. Performance baselines (as of 2026-05-20)

### CI — Build & Test job (critical path)

| Metric | Value | Notes |
|--------|-------|-------|
| Average wall clock | **12.1m** (727s) | 10-run average post-sprint |
| Range | 689–766s | Low variance — consistent |
| Build step | ~321s (46%) | Turbo remote cache active |
| Type check step | ~221s (32%) | |
| Smoke Test Suite | ~70s (10%) | |
| Infrastructure overhead | ~48s (7%) | Containers, checkout, node, install |
| Prisma / migrations | ~6s (1%) | |

Build + typecheck together = **78% of the critical path**.

### CI — Lint job (parallel)

| Metric | Value |
|--------|-------|
| Average duration | ~176s (2m56s) |
| On critical path? | Never — always finishes inside B&T window |

### CI — docker-build job (PR only, not on merge critical path)

| Metric | Value |
|--------|-------|
| Typical duration | 730–968s |

### Smoke test suite — before and after sprint

| Period | Smoke duration | Notes |
|--------|---------------|-------|
| Pre-sprint (baseline) | ~140–151s | BAML evals + demo-storefront E2E in smoke |
| Post-sprint | ~70s | BAML moved to nightly, demo-storefront moved to weekly |
| Delta | **−70s (−50%)** | |

### Overall CI improvement from sprint

| Metric | Before sprint | After sprint | Delta |
|--------|--------------|--------------|-------|
| Wall clock to all-green | ~15m27s | ~12.1m | **−3.4m (−22%)** |
| Time to first lint signal | ~15m27s | ~2m56s | **−12m31s** |
| LLM calls per PR | 1 eval file | 0 | **Eliminated** |
| Doc-only PR cost | ~15m27s | 0s (workflow skipped at trigger; #488) | **−100%** |
| `pnpm audit` per PR | ~1m | 0 | **Moved to weekly** |

---

## 8. Completed improvements

| Issue | Change | Merged |
|-------|--------|--------|
| #392 | Enable Turbo remote cache | 2026-05-18 |
| #393 | Skip CI on doc-only commits | 2026-05-18 |
| #394 | Move `pnpm audit` to weekly workflow | 2026-05-18 |
| #395 | Split lint into parallel job | 2026-05-18 |
| #425 | Remove demo-storefront from smoke; add weekly sanity | 2026-05-18 |
| #428 | Move BAML evals to nightly regression tier | 2026-05-18 |
| #431 | Fix missing `AZURE_OPENAI_BASE_URL` in nightly workflow | 2026-05-19 |
| #449 | Selective demo-storefront rebuild in CD | 2026-05-19 |
| #451 | Restore `push: main` CI trigger; add `fetch-depth: 2`; gate docker-build on PR only | 2026-05-19 |
| #488 | Trigger-level `paths-ignore` to eliminate ~29s container startup on doc-only runs | 2026-05-20 |

---

## 9. Proposed improvements

### 9.1 CI — build & typecheck speed

Build (321s) and typecheck (221s) account for 78% of the critical path. Three options in effort order:

| Issue | Proposal | Effort | Expected saving |
|-------|---------|--------|----------------|
| #457 | Merge build + typecheck into single Turbo invocation | Low (2-line CI change) | ~1–2m — Turbo interleaves per-package |
| #458 | Add `"outputs": []` to typecheck in `turbo.json` | Low (1-line) | Potentially large — enables remote cache hits for typecheck |
| #459 | TypeScript project references for incremental typechecking | High | ~30–50% typecheck reduction |
| #468 | Affected-only builds: `turbo run build --filter=[HEAD^1]...` | Medium | ~200–260s on focused PRs; requires main cache seeding job |

**#457 reliability note:** Merging into a single Turbo invocation carries no reliability risk — the dependency graph (`dependsOn: ["^build"]`) is already modeled in `turbo.json` and Turbo respects it regardless of how many CLI invocations you use. The only downside is reduced observability: build and typecheck output merges into one GHA step, losing separate step-level timing in the UI.

**#458 reliability note:** Adding `"outputs": []` changes how Turbo writes and restores cache entries. If the input hash misses a relevant file (e.g., a generated file not tracked in the hash), Turbo would restore a stale "success" and skip typecheck incorrectly. Recommend monitoring cache-hit runs manually for the first week after deploying.

### 9.2 CI — Docker build replacement

| Issue | Proposal | Effort | Expected saving |
|-------|---------|--------|----------------|
| #467 | Replace docker-build job with lightweight node module-resolution probe | Low | Eliminates 730–968s from PR wall clock |
| #466 | Audit and enforce ACR-mirrored base images (prerequisite for #467) | Low | Reliability — prevents rate limit failures in CD |

**Recommended order:** Land #466 first to ensure CD is resilient to Docker Hub rate limits before removing the PR-time Docker gate.

### 9.3 CD — deploy pipeline improvements

| Issue | Proposal | Effort | Impact |
|-------|---------|--------|--------|
| #460 | Parallelize ACR image builds | Medium | High — halves image build time |
| #461 | Selective turbo-cache image rebuild | Low | Medium — removes wasted build per commit |
| #462 | Parallelize container app updates post-API-swap | Low | Medium — faster rollout |
| #463 | Automatic rollback on health/canary failure | Medium | High — production safety |
| #464 | Store API FQDN as Actions variable; remove redundant SUPPORT_EMAIL step | Trivial | Low — housekeeping |
| #465 | Blue-green revision deployment | High | High — eliminates API/Worker incompatibility window |
| #466 | Audit ACR-mirrored base images | Low | Reliability |

**Recommended sequencing:** #466 → #460 (parallelising builds amplifies rate limit risk if any Dockerfile still hits Docker Hub) → #461 + #462 (low-effort wins) → #463 (safety) → #464 (housekeeping) → #465 (architectural, long-term).

---

## 10. Observability — dashboards and alerting

The pipeline currently produces no structured metrics. Step durations are visible in the GitHub Actions UI per-run but are not aggregated or trended. The following instrumentation is needed.

### 10.1 CI dashboard

**Data source:** GitHub Actions API (`/repos/{owner}/{repo}/actions/runs`, `/actions/jobs/{job_id}`)

**Required metrics:**

| Metric | How to capture |
|--------|---------------|
| Total CI wall clock (B&T job) | `job.completedAt - job.startedAt` |
| Per-step durations | `step.completedAt - step.startedAt` for each step |
| Build step duration | "Build" step in B&T job |
| Typecheck step duration | "Type check" step in B&T job |
| Smoke Test Suite duration | "Smoke Test Suite" step in B&T job |
| Lint job duration | Lint job total |
| docker-build job duration | docker-build job total |
| Turbo cache hit rate | `TURBO_REMOTE_CACHE_HITS` / total tasks (add `--summarize` output parsing) |
| CI success/failure rate | `run.conclusion == 'success'` count / total |
| P50 / P90 / P99 CI wall clock | Rolling 30-day window |

**Alerting thresholds:**

| Signal | Threshold | Action |
|--------|-----------|--------|
| B&T job duration | > P90 (~14m based on current data) | Slack alert |
| CI failure rate (rolling 7d) | > 10% | Slack alert |
| Turbo cache hit rate | < 50% on build task | Investigate cache invalidation |

### 10.2 CD dashboard

**Data source:** GitHub Actions API (workflow_run events for deploy.yml) + Azure Monitor (Container Apps)

**Required metrics:**

| Metric | How to capture |
|--------|---------------|
| Total CD wall clock | `job.completedAt - job.startedAt` for build-and-deploy job |
| Image build phase duration | Sum of `az acr build` step durations |
| Migration duration | Migration polling loop elapsed time |
| Container update phase duration | Sum of `az containerapp update` step durations |
| Health check duration | Health + canary step durations |
| CD success/failure rate | `run.conclusion` |
| P50 / P90 CD wall clock | Rolling 30-day window |
| Time from merge to production live | `deploy.completedAt - pr.mergedAt` |

**Alerting thresholds:**

| Signal | Threshold | Action |
|--------|-----------|--------|
| CD wall clock | > P90 | Slack alert |
| CD failure | Any | Immediate Slack alert (production impact) |
| Time from merge to live | > 30m | Investigate CD bottleneck |

### 10.3 Combined view

A single dashboard page should show:

- CI and CD wall clock trend (line graph, last 30 days)
- Step-level breakdown bar chart (Build, Typecheck, Smoke, docker-build, ACR builds, Deploy) — stacked per run
- Success/failure rate heatmap by day
- Table: last 20 runs with outcome, wall clock, and any anomaly flags

**Implementation options:** GitHub Actions job summaries (markdown tables in `$GITHUB_STEP_SUMMARY`) for per-run breakdowns; a separate aggregation job or GitHub App for trending. Tracked in CI dashboard issue (filed separately under epic #427).

---

## 11. Key architectural decisions and constraints

| Decision | Rationale |
|----------|-----------|
| `workflow_run` for CD trigger | Ensures CD only fires after CI passes; prevents deploying commits that fail tests |
| `concurrency: cancel-in-progress: false` on deploy | Every merged commit ships; back-to-back merges queue in order rather than race |
| `az acr build` in CD (not `docker/build-push-action`) | Builds run on Azure compute; no ACR admin credentials needed in GitHub secrets; consistent with production secrets policy (CLAUDE.md) |
| Migrations before container swap | If migration fails, old containers remain live — no partial state where new app runs against old schema |
| Separate CI and CD Docker builds | CI images use dummy credentials and are verification-only; CD images use real credentials and are deployable. CI images cannot be promoted directly |
| `fetch-depth: 2` on all checkouts | Required for `dorny/paths-filter` diff on push events and for `git diff HEAD~1 HEAD` in CD doc-only skip |
| No skip logic in smoke path for missing secrets | Rule 11a — tests must fail loudly if dependencies are missing, never skip silently |
