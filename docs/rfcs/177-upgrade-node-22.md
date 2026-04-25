# Upgrade Node.js 20 → 22 across runtime, CI, and base images — Technical Design

Issue: #177
Owner: manohar.madhira@outlook.com

---

## Customer

Two audiences are affected:

- **CustomerEQ operators of the production stack** (`customereq-api`, `customereq-web`, `customereq-worker` in the `customereq-prod` Azure Container Apps environment). They depend on the runtime continuing to receive upstream security patches.
- **Engineers and AI agents** running `pnpm dev` and CI locally. They need a single declared Node version that local installs, CI runs, and the production image all agree on.

## Customer Problem Being Solved

Node.js 20 reaches upstream end-of-life on **April 30, 2026**. After that date the OpenJS Foundation stops shipping security patches for the 20.x line. CustomerEQ runs Node 20 in three places:

| Surface                          | Pin                                          | Effect after 2026-04-30                |
| :------------------------------- | :------------------------------------------- | :------------------------------------- |
| Production runtime (containers)  | `Dockerfile.api`/`Dockerfile.web`/`Dockerfile.worker` → `node:20-slim` (builder + runner) | New CVEs in Node 20 will not be patched; image rebuilds keep shipping unpatched binaries |
| CI                               | `.github/workflows/ci.yml` → `node-version: '20'` | Same — CI keeps validating against an EOL runtime |
| Declared local runtime           | `package.json` → `"engines.node": ">=20.0.0"`, `"@types/node": "^20.0.0"` | New contributors install Node 20 by default; `@types/node` lags behind Node 22 stdlib changes |
| Documentation                    | `docs/architecture/architecture.md` §2 ("Node.js >= 20"), `docs/getting-started.md` §Prerequisites ("Node.js \| >= 20") | Drift between docs and the production image once we bump |

Azure App Service's Node 20 deprecation notice does not apply to us directly (we run on Container Apps with custom images), but the upstream Node 20 EOL date is the real driver: Container Apps does not fix the runtime for us. Bumping to Node 22 (current LTS, supported through April 2027) restores upstream patch coverage.

The bump is also a good moment to fix a smaller drift: `engines.node` is set to `">=20.0.0"`, which permits Node 20, 22, and 24 simultaneously. The Dockerfile is the source of truth for production; the engines floor should track it so a contributor on Node 18 fails fast instead of building an image that does not match their local runtime.

## User Experience That Will Solve the Problem

For an **operator**, nothing visibly changes. The three Container Apps continue to build and deploy from the same Dockerfiles; the runtime underneath is Node 22 instead of Node 20. `/healthz` still returns the same shape.

For an **engineer / AI agent**, the workflow becomes:
- `nvm install 22 && nvm use 22` (or whatever they use) — or accept the `engines` warning.
- `corepack enable && corepack prepare pnpm@9 --activate` — unchanged.
- `docker compose up -d && pnpm install && pnpm db:migrate && pnpm dev` — unchanged.
- CI on PR runs `pnpm build && pnpm typecheck && pnpm lint && pnpm test` against Node 22 instead of Node 20. The set of commands is unchanged.
- The production Dockerfiles build with Node 22 so the image matches what local dev builds against.

A new CI step is added: `docker build` of all three Dockerfiles on PR. This is independent of the version bump in motivation but mandatory in scope because today nothing exercises the Dockerfiles before they hit Azure ACR (see Risks below). Without it, the first Node-22 image build is also the first prod deploy — a class of risk this RFC is explicitly trying to remove.

---

## Technical Details

### Inventory of Node 20 references (audit findings)

The codebase audit found exactly the surfaces below. There are no `.nvmrc`, `.tool-versions`, `.node-version`, devcontainer, Volta block, or Bicep/Terraform files that pin Node — so the surface is small and discrete.

| File                                 | Line(s)            | Current                                | Target                                  |
| :----------------------------------- | :----------------- | :------------------------------------- | :-------------------------------------- |
| `Dockerfile.api`                     | 2, 29              | `FROM node:20-slim`                    | `FROM node:22-slim`                     |
| `Dockerfile.web`                     | 2, 37              | `FROM node:20-slim`                    | `FROM node:22-slim`                     |
| `Dockerfile.worker`                  | 2, 29              | `FROM node:20-slim`                    | `FROM node:22-slim`                     |
| `.github/workflows/ci.yml`           | 49                 | `node-version: '20'`                   | `node-version: '22'`                    |
| `package.json`                       | 7                  | `"node": ">=20.0.0"`                   | `"node": ">=22.0.0"`                    |
| `package.json`                       | 36                 | `"@types/node": "^20.0.0"`             | `"@types/node": "^22.0.0"`              |
| `docs/architecture/architecture.md`  | 28 (table row)     | `Node.js >= 20`                        | `Node.js >= 22`                         |
| `docs/getting-started.md`            | 11 (table row)     | `Node.js \| >= 20 \| nvm install 20`   | `Node.js \| >= 22 \| nvm install 22`    |

Per-app `package.json` files (`apps/api`, `apps/web`, `apps/worker`, `apps/mcp-server`) and per-package files (`packages/{database,shared,config,connectors,ui,ai,embed}`) have no `engines` block — they inherit from the root. No change needed there.

`docs/evidence/28-deploy-evidence.md:58` mentions `node:20-alpine` historically (Alpine OpenSSL 3 context). This is a frozen evidence document for an already-merged issue; we do not rewrite past evidence.

### Dependency compatibility analysis

The `node:22-slim` image carries Node 22 (current LTS at time of writing) on Debian slim with OpenSSL 3.x — same OS family and OpenSSL major as `node:20-slim`. Native-binding compatibility is therefore the only realistic break surface.

**Direct dependencies with native bindings: zero.** The audit scanned the lockfile for `bcrypt`, `bcryptjs`, `sharp`, `better-sqlite3`, `lmdb`, `node-gyp`, `canvas`, `node-sass`, `sqlite3`, `node-pty`, `argon2`, `re2` as direct deps — none are present.

**Transitive native bindings that matter:**

| Package | Where it loads native code | Node 22 risk |
| :--- | :--- | :--- |
| `@prisma/client` 5.13 (engine) | Linux-musl-openssl-3.0.x and debian-openssl-3.0.x prebuilt query engines (`packages/database/prisma/schema.prisma:7`) | Prisma 5.13 (released May 2024) targets Node 22 in its release matrix. The engine binaries are statically linked Rust against OpenSSL 3 — they do not use Node N-API and are insensitive to the Node ABI version. Risk: low. Verification: section "Validation Plan" below. |
| `ioredis` 5.10.1 (pinned via root `pnpm.overrides`) | Pure JS; no native code paths used by us | None. |
| `bullmq` (worker queue) | Pure JS over `ioredis` | None. |
| `sharp` (transitive via `next` 15) | Native libvips bindings via `@img/sharp-*` prebuilt platform packages | `sharp` ≥ 0.33 supports Node ≥ 18 with prebuilt binaries for `linux-x64`/`linux-arm64`. The version pulled via `next` is `0.34.5` per the audit — Node 22 is supported. Risk: low. Image build will exercise this on Linux. |
| `@boundaryml/baml` 0.211 | Prebuilt platform binary; not used at runtime in containers (only at codegen) | Not in the runtime path; not affected by base-image bump. |

There are no `process.version` checks or V8 flags anywhere in the source tree (audit confirmed zero hits).

### CI/CD impact

`.github/workflows/ci.yml` runs on PR + push to feature branches. It currently does not build the production Dockerfiles. `.github/workflows/deploy.yml` builds them via `az acr build` and deploys to Azure Container Apps — only on `main` after CI passes.

This is the central risk in the upgrade: the **first time anyone builds the Node 22 production image is the prod deploy job**. If a Node 22 ABI mismatch hits Prisma's prebuilt engine on linux-musl, or `sharp`'s prebuilt libvips bindings, the failure surfaces against ACR after merge to main, not on the PR.

This RFC proposes adding a Docker-build step to CI alongside the version bump. That makes the image bump verifiable on the same PR that introduces it.

```yaml
# .github/workflows/ci.yml — new job, runs after the existing ci job

  docker-build:
    name: Build production images
    runs-on: ubuntu-latest
    needs: ci
    steps:
      - uses: actions/checkout@v4
      - name: Build api image
        run: docker build -f Dockerfile.api -t ceq-api:${{ github.sha }} .
      - name: Build worker image
        run: docker build -f Dockerfile.worker -t ceq-worker:${{ github.sha }} .
      - name: Build web image
        run: docker build -f Dockerfile.web -t ceq-web:${{ github.sha }} \
          --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 \
          --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dummy .
```

The web image takes two build-args (`NEXT_PUBLIC_*` are inlined at Next build time, `Dockerfile.web:5–8`). For a CI build-only smoke we can pass dummies — runtime correctness is exercised by the existing API/health checks on deploy, and what we are validating in this CI step is that `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm turbo run build`, and the runner-stage `apt-get install` all succeed against Node 22 base. We are not validating that the running container serves traffic.

### Files NOT changed

- `apps/{api,web,worker,mcp-server}/package.json` — no `engines`; inherits root.
- `packages/*/package.json` — same.
- `pnpm-lock.yaml` — `pnpm install --frozen-lockfile` against the new `@types/node` version requires regenerating the lockfile. This is a routine update that will land in the same commit as the `package.json` change.
- `docker-compose.yml` — does not reference Node.
- `turbo.json`, root `tsconfig.json` — Node-version-agnostic.
- `pnpm@9.0.0` — kept; Node 22 + pnpm 9 is fully supported (pnpm 9 requires Node ≥ 18).

### Failure Modes

- **Prisma engine fails to load on Node 22**: would surface as `Cannot find module '.../query-engine-debian-openssl-3.0.x'` or `dlopen` error at API/worker start. Caught by the new CI Docker-build step (build will succeed but `pnpm db:generate` runs in the builder stage); caught more directly by booting the image and hitting `/healthz` (out of scope for this RFC; see Risks for why).
- **Sharp prebuilt binary mismatch on Node 22**: would surface during `pnpm turbo run build --filter=@customerEQ/web` (Next compiles routes that import images). Caught in the new CI Docker-build step.
- **`@types/node ^22` introduces a TS type breakage**: caught by `pnpm typecheck` in CI. Likely surface area is very small — most stdlib type changes between 20 → 22 are additive.
- **Local dev on Node 20 breaks once `engines` floor moves to 22**: pnpm by default warns rather than fails on `engines` mismatch, so this is a soft signal. To convert it to a hard signal a contributor would set `engine-strict=true` in `.npmrc` — not proposed here.
- **Engineers running multiple repos at different Node majors**: out of scope. They already manage this with `nvm`/`fnm`/Volta.

### Telemetry & Analytics

No new telemetry. The runtime change is invisible to logs and metrics — same Pino structured logs, same Fastify routes, same BullMQ workers.

---

## Confidence Level

**90.** Five reasons:

1. The change set is mechanical (8 files, ~10 line edits) and the surface area is fully enumerated.
2. There are zero direct native dependencies — the only native code in the runtime path is Prisma's prebuilt engine and `sharp`'s prebuilt libvips, both of which support Node 22 in their current versions.
3. The Node 22 release line has been GA for over a year, so any regressions would be widely reported.
4. Adding Docker-build-on-PR converts the highest residual risk (image build only validated on prod deploy) into a normal CI failure.
5. The 10-point reduction from 100 reflects honest residual risk: we are not booting the built image and hitting `/healthz` in CI (deferred — see Risks). A logically possible but historically rare class of failure (image builds, container fails to start) would still escape to deploy. Mitigated by the existing deploy-time `/healthz` check (`.github/workflows/deploy.yml:102–115`) but not eliminated.

## Validation Plan

| Scenario | Expected outcome | Validation |
| :--- | :--- | :--- |
| `pnpm install --frozen-lockfile` on a fresh checkout with Node 22 | Resolves successfully; `@types/node@22` lands; no peer-dep warnings escalated to errors | Local + CI step "Install dependencies" |
| `pnpm typecheck` against `@types/node ^22` | Zero TypeScript errors | CI step "Type check" |
| `pnpm lint`, `pnpm test`, `pnpm test:integration` against Node 22 | All green | CI step "Unit & Integration Tests" |
| `docker build -f Dockerfile.api`, `Dockerfile.worker`, `Dockerfile.web` against `node:22-slim` base | All three images build successfully (builder + runner stages) | NEW CI job `docker-build` (proposed above) |
| `pnpm db:generate` runs inside the Node 22 builder stage | Prisma 5.13 engine artefacts produced for `linux-musl-openssl-3.0.x` and `debian-openssl-3.0.x` | Same docker-build job — `pnpm db:generate` is inlined at `Dockerfile.api:25`, `Dockerfile.worker:25`, `Dockerfile.web:33` |
| Container starts and `/healthz` returns 200 with `database.ok` and `redis.ok` | Existing post-deploy step in `deploy.yml:102–115` verifies — same behavior on Node 22 | Deploy workflow against staging — manual gate before promoting to prod |
| `pnpm test:e2e` (Playwright against `pnpm dev`) | All e2e specs pass against Node 22 dev server | Run locally before merge; not part of CI today (out of scope to add) |

## Test Matrix

The Node version bump itself is verified by the validation plan above (build + typecheck + tests + image build all running against Node 22). No new unit tests are warranted — we are not adding logic, we are changing the runtime under existing logic.

The audit identified test gaps that are **adjacent** to this work (no real Prisma engine load test in CI, no real BullMQ-against-Redis test, no e2e-in-CI). These are pre-existing gaps. Adding them inside this PR would expand the change beyond the issue's stated scope and slow down a security-driven update. They are tracked separately:

| Pre-existing gap | Why not addressed here | Recommendation |
| :--- | :--- | :--- |
| CI does not run `pnpm test:e2e` | Playwright requires the dev server + Clerk fixtures; standing those up is its own infra problem | File a separate issue: "Add Playwright e2e to CI" |
| Integration tests mock BullMQ/Redis instead of running real ones | Real-Redis tests were intentionally avoided to keep CI fast and deterministic | Track in same separate issue if real-runtime validation is desired |
| No image-boot smoke (`docker run` + `curl /healthz`) in CI | Requires DB/Redis services co-resident with the test step + secrets handling for Clerk; overlaps with the e2e work | Defer to the same separate issue |

The single test addition this RFC proposes is **the `docker-build` CI job** described in the Technical Details section. It validates exactly the new break-surface introduced by the version bump (`pnpm install`, `pnpm db:generate`, `pnpm turbo run build`, runner-stage `apt-get install`) against the new base image without expanding scope to runtime smoke.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| **Prisma engine binary fails to dlopen on Node 22** at API/worker start | Low | High (production outage on deploy) | Prisma 5.13 release notes confirm Node 22 support. The Prisma engine is statically linked Rust against OpenSSL 3 and does not use Node N-API, so the Node ABI is not a load-time concern. CI `docker-build` step exercises `pnpm db:generate` inside the Node 22 builder so binary download is verified. Existing deploy-time `/healthz` is the last-line check. |
| **Sharp prebuilt binary mismatch under `next build`** in `Dockerfile.web` | Low | High (web image build fails on Azure ACR) | The new CI `docker-build` job runs the same `pnpm turbo run build --filter=@customerEQ/web` and surfaces the failure on the PR rather than on prod deploy. Sharp 0.33+ supports Node ≥ 18 with broad platform coverage. |
| **`@types/node ^22` introduces a TypeScript breakage** in app or package code | Medium | Low | `pnpm typecheck` is the gate. Most 20→22 type changes are additive (new APIs); breaking changes are rare and easy to fix. If a fix is non-trivial we can pin `@types/node` to the latest 20.x and revisit — that does not block the Node 22 *runtime* upgrade. |
| **Image builds in CI but fails to start as a container** | Very low | High (would only be caught on deploy) | Existing `deploy.yml:102` `/healthz` check is the last-line guard — staging deploy must succeed before promoting. We do not add an image-boot smoke to CI in this PR (see Test Matrix); accepted residual risk, called out for transparency. |
| **`pnpm-lock.yaml` regeneration churn** introduces unrelated dep updates | Low | Medium (review surface bloat) | The `engines` and `@types/node` bumps regenerate only the lockfile entries for `@types/node` and any peer-dep adjustments. We will avoid `pnpm update` and use targeted `pnpm install` so the diff stays minimal. |
| **Local dev on Node 20 stops working after `engines` floor moves** | Low | Low | pnpm warns rather than fails on `engines` mismatch by default; contributor workflow is `nvm install 22 && nvm use 22`. Update `docs/getting-started.md` in the same PR so the instructions match. |
| **Azure Container Apps runtime image (host kernel) does not support `node:22-slim`** | Very low | Low | `node:22-slim` is a Debian-based userland container — it runs on any kernel ≥ 3.10. Azure Container Apps runs modern Linux kernels; not a real concern. |

## Spike Findings

Not applicable. The change is a well-defined infrastructure bump with a fully-enumerated change set. No technology, integration, or vendor uncertainty.

## Observability (logs, metrics, alerts)

No new observability needed. Existing Pino-structured logs include Node version implicitly (process metadata) but not in a way that anyone alerts on. The deploy job's `/healthz` retry loop is the operational signal that the new image starts and is healthy.

If desired, a one-line addition to `apps/api/src/routes/healthz.ts` to include `node: process.version` in the response payload would make any future runtime drift visible at a glance — proposed but not required.

---

## Architecture Analysis

Comparison of this RFC against `docs/architecture/architecture.md` and `fraim/personalized-employee/rules/project_rules.md`.

### Patterns Correctly Followed

- **Architecture document is authoritative** (project rule #4). The RFC explicitly proposes the `architecture.md` line update so the doc and the runtime stay aligned. The current `>= 20` line is the source of architectural truth; the bump updates that line.
- **Validation gate** (project rule #11). The PR will pass the standard CI gate (`pnpm build && pnpm typecheck && pnpm lint && pnpm test`) plus the new `docker-build` job; nothing skips a check.
- **Tests must never skip** (project rule #11a). No skipped tests — and the RFC explicitly opts out of *adding* skipped/scaffolded tests for the deferred runtime-validation gaps. The test matrix calls out what is and is not covered, with rationale.
- **Multi-tenant `brandId` scoping** (project rule #6). N/A — this is a runtime upgrade and does not touch any tenant-scoped data path.
- **Event-driven loyalty actions** (project rule #5). N/A — no loyalty state changes.
- **Transactions for ledger** (project rule #7). N/A — no ledger writes.
- **GDPR/CCPA** (project rule #13). N/A — no PII handling change.
- **Secrets management** (project rule #12). N/A — no new secrets.

### Patterns Missing from Architecture

| Pattern | Why it's relevant | Suggested resolution |
| :--- | :--- | :--- |
| **Stated Node LTS upgrade cadence** | The architecture doc records the runtime as `Node.js >= 20` but does not state the upgrade rule (e.g., "track Node LTS — bump within ~6 months of upstream EOL"). Without it, the next bump (Node 22 → 24, around April 2027) will be re-litigated from scratch. | One-sentence addition to `architecture.md` §2 noting the LTS-tracking convention. Optional — included in the proposed update for reviewer's call. |
| **Single source of truth for the Node version** | Today the version appears in 8 places (Dockerfiles ×6, CI workflow, package.json engines, plus docs). They have already drifted before (audit showed `@types/node ^20` mismatches the runtime in spirit). | Out of scope for this RFC — would require a build-time templating mechanism. Acceptable to keep the small-N duplication and rely on a checklist (this RFC's audit serves as that checklist). |

### Patterns Incorrectly Followed

None identified. The RFC does not violate any documented architecture rule or project rule.

---

## Architecture Updates (proposed)

The following documentation edits are part of this PR's deliverables. They land alongside the code changes (single PR, single review) since they are doc-only and tightly coupled to the code.

### Update 1 — `docs/architecture/architecture.md` §2 row 28

```diff
- | **Runtime** | Node.js >= 20 | LTS with native ESM support; shared runtime across API, worker, and frontend SSR |
+ | **Runtime** | Node.js >= 22 | LTS with native ESM support; shared runtime across API, worker, and frontend SSR. Track upstream Node LTS — bump within ~6 months of EOL. |
```

### Update 2 — `docs/getting-started.md` Prerequisites table row 11

```diff
- | **Node.js** | >= 20 | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
+ | **Node.js** | >= 22 | [nodejs.org](https://nodejs.org/) or `nvm install 22` |
```

No new ADR. Project rule #4 requires an ADR for one-way doors; an LTS bump is not a one-way door — it is the regular tracking of upstream LTS. The architecture-doc edit captures the convention so the next bump does not need re-litigation.

---

## Out of Scope

- **Adding Playwright e2e to CI**, **adding real-Redis integration tests**, **adding image-boot smoke tests**. All three are real test-coverage gaps surfaced by the audit but pre-date this issue and are not necessary to ship the Node 22 bump safely (CI typecheck + Docker build + deploy-time `/healthz` is sufficient). File as a separate issue.
- **Bumping pnpm from 9 to 10**. pnpm 9 supports Node 22; the corepack pin (`pnpm@9.0.0`) stays. Separate issue if desired.
- **Bumping Prisma, Fastify, Next.js, BullMQ, ioredis or other deps**. Out of scope; Node 22 supports all current versions.
- **Switching to `node:22-alpine`**. We deliberately use Debian slim because of the Prisma OpenSSL 3 episode documented in `docs/evidence/28-deploy-evidence.md:58`. Not changing the distro.
- **Rewriting `docs/evidence/28-deploy-evidence.md`** to update the `node:20-alpine` historical reference. Evidence docs are immutable records; we do not edit them.
