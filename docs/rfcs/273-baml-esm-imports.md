# Feature: BAML codegen — ESM-friendly relative imports

Issue: #273
Owner: manohar.madhira@outlook.com

## Customer

Internal — CustomerEQ engineering. No direct end-user customer for this fix; the affected actor is the deploy pipeline and anyone trying to ship code to prod after 2026-04-17.

## Customer Problem being solved

Every `customereq-api` and `customereq-worker` container image built since 2026-04-18 fails activation with `ERR_MODULE_NOT_FOUND` on `/app/packages/ai/dist/generated/baml_client/async_client` (and four sibling extensionless imports). Container Apps falls back to the previous active revision (`customereq-api--0000111`, built 2026-04-17 19:14 UTC) and silently keeps it serving traffic. Net effect: **no code merged to main since 2026-04-17 has reached prod for the API for ~16 days**, despite every CD reporting `Deploy: success`. The reason no one noticed is twofold:

1. `az containerapp update --image …` returns success on image-accept, not activation. Activation is asynchronous.
2. The CD workflow's `Verify API health` step (which would have caught this) has been skipped on every run because the unrelated `Deploy Demo Storefront` step (#272) fails earlier and short-circuits the workflow.

## User Experience that will solve the problem

This is a build-pipeline / refactoring fix; the developer-facing experience is:

1. Edit BAML definitions in `packages/ai/baml_src/*.baml`.
2. Run `pnpm build` (or let Docker do it). BAML codegen emits TypeScript with `.js` extensions on every relative import. `tsc` preserves the paths verbatim. Node 22 ESM resolver finds the modules.
3. The next API/Worker container revision activates cleanly. CD's `Verify API health` step turns green again, and "Deploy: success" starts meaning what it says.

## Technical Details

### Root cause (recap from #273)

Commit `bdfadf0` (Sid Mathur, 2026-04-17 18:13 PDT = 2026-04-18 01:13 UTC) "chore(ai): generate baml client at build time and switch evals to azure" did three coupled things:

1. Deleted the 13 committed files in `packages/ai/src/generated/baml_client/` (~3300 lines).
2. Gitignored the directory.
3. Changed `packages/ai/package.json` so `build` runs `pnpm run generate && tsc` — i.e., BAML codegen happens at every Docker build.

The earlier fix `8fd2786` ("add .js extensions to BAML client imports for Node ESM") patched the *committed* generated files to use `from "./async_client.js"` (with extension) so Node 22's ESM strict resolver could find them. Once `bdfadf0` deleted those files and made codegen recreate them on every build, the patch was wiped. BAML 0.211.0's *default* emitter writes `from "./async_client"` (no extension); `tsc` preserves the path verbatim; Node 22 ESM rejects it.

### The fix — single line in `generators.baml`

BAML 0.211.0 has a first-class `module_format` option in the generator block, with valid values `cjs` or `esm`. Setting `module_format "esm"` makes BAML emit `.js` extensions natively across all 13 generated files. **The entire production code change is one new line:**

```diff
 generator target {
   output_type "typescript"
   output_dir "../src/generated"
   version "0.211.0"
+  module_format "esm"
 }
```

(See Spike Findings below for empirical proof and the rejected alternative.)

### CI safety net — new step in `.github/workflows/ci.yml`

Acceptance criterion #3 in #273 says: *"CI gains a step that runs the built API image's entrypoint long enough to confirm `@customerEQ/ai` imports resolve cleanly — so this regression is caught next time before reaching prod."*

The existing CI runs lint, typecheck, unit tests, and `docker build`, but **never executes** the built image. Module-resolution errors at module-load time are invisible until Container Apps tries to activate the revision in prod.

#### CI vs CD — what each gate is responsible for

The repo already has a CD-side gate: `Verify API health` in `.github/workflows/deploy.yml:119-132` curls `/healthz` against the deployed revision until it returns 200. That step has been **silently skipped on every CD since 2026-05-03** because the unrelated `Deploy Demo Storefront` step (#272) fails earlier and short-circuits the workflow. Relying on a CD-only gate has empirically proven fragile in this exact way.

This RFC adds a **complementary**, not redundant, gate on the CI side. The two probes answer different questions:

| | CI module-resolution probe (this RFC) | CD `Verify API health` (existing) |
|---|---|---|
| What it tests | Does the image's **code** load cleanly in isolation? | Does the **deployed revision** serve traffic against real prod infra? |
| Catches | `ERR_MODULE_NOT_FOUND`, missing dist files, broken imports, syntax errors at module-load | Env-var misconfiguration, Key Vault/identity issues, DB/Redis connectivity, port/ingress wiring |
| Runs against | Image just built in the same job, no real env | Deployed Container App revision against real Azure infra |
| Cost | ~2 seconds, no DB / Redis / secrets | Real revision activation deadline (minutes) |
| Failure mode | PR red, blocks merge | CD red, code already in main → revert/forward-fix |
| Coverage of BAML-class regression | Yes, at PR time (shift-left) | Yes, at deploy time |
| Coverage of env / secret / connectivity issues | No | Yes |

CI alone would have caught the BAML regression on the PR that introduced it. CD alone is what's needed for the prod infra side and cannot be replaced by CI. **Both stay** — they're load-bearing for different failure modes.

#### Probe target — narrow to `@customerEQ/ai`, not the whole app entry

The probe **must not** import `apps/api/dist/server.js` (the full app entry). Importing that runs the entire module-load tree, including any module-load-time `process.env.X` reads, dotenv loads, or Fastify plugin initializations. In a CI job without prod env-vars, those would fail for reasons unrelated to module resolution and produce false positives.

The CI probe imports `@customerEQ/ai` directly. That is the narrowest target that exercises the regression class we actually had (BAML codegen output's relative imports). It has no side effects beyond pure import resolution. Other packages' module-load contracts are already enforced by `pnpm build && pnpm typecheck` at the source level — adding a runtime equivalent for every package is overengineering for this fix.

```yaml
- name: Verify API image module resolution
  run: |
    docker run --rm --entrypoint node ceq-api:${{ github.sha }} \
      --input-type=module \
      -e "await import('@customerEQ/ai').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"
```

The same step is added for `ceq-worker:${{ github.sha }}` — the worker has the same dependency on `@customerEQ/ai` and would surface the same regression independently.

Each runs in <2 seconds, has no DB/Redis/env dependency, and fails the CI job on any `ERR_MODULE_NOT_FOUND` / circular-import / missing-dist-file inside the BAML codegen output or the `@customerEQ/ai` package's own module tree. Stops the entire class of regression at PR time.

If the regression class ever broadens (e.g., a different package's codegen breaks similarly), add a second narrow probe for that package — don't widen this one to include unrelated module trees.

### Files modified

| File | Change |
|---|---|
| `packages/ai/baml_src/generators.baml` | Add `module_format "esm"` line |
| `.github/workflows/ci.yml` | Add `Verify API image module resolution` and `Verify Worker image module resolution` steps in the `docker-build` job |

That's it. No new files, no new scripts, no new dependencies.

### What this fix does NOT touch

- **`apps/worker/src/index.ts`** — the worker's `QUEUE_MODE=inline` early-exit and crash-loop is tracked separately in #274. The BAML fix here will let the worker image *load* its modules, but the worker container will still exit (cleanly or otherwise) per its current logic. That's #274's domain.
- **`scripts/provision-demo-storefront.sh`** — the missing `customereq-demo` Container App provisioning is #272. Its CD step will keep failing until that issue is closed; this RFC does not unblock it.
- **The committed-vs-generated decision** — `bdfadf0`'s call to gitignore the generated files and codegen-at-build-time is preserved. Reverting that decision is a larger architectural choice not in scope here.

### Failure modes & timeouts

- **Misconfigured option**: BAML rejects invalid `module_format` values at `pnpm run generate` time with a clear validation error (empirically confirmed in spike: `'totally_invalid_option_xyz' is not supported. Use one of: 'cjs' or 'esm'`). Failure is fail-fast, build-time, loud.
- **BAML version drift**: BAML version is pinned in two places — `packages/ai/package.json` (`@boundaryml/baml: 0.211.0`) and `generators.baml` (`version "0.211.0"`). A future BAML upgrade is deliberate and will exercise the new CI module-resolution step.
- **Module-resolution probe times out**: the `docker run` step uses Docker's default container start timeout. Probe completes in <2s when modules resolve; if it hangs, CI's job-level timeout (default 6h, but typically capped at 30 min in practice) will fail the run.
- **Future codegen regression**: caught at PR time by the new CI step. Failure mode is a red CI status, not a silent prod fallback to a stale revision.

### Telemetry & analytics

None added. The fix surfaces in:
- CI/CD logs (existing).
- Container Apps revision activation status (`az containerapp revision list`, existing).
- The CD workflow's `Verify API health` step (existing, currently masked behind #272).

No metrics, no alerts. The failure mode is binary and the existing tooling already surfaces it once it's not masked.

## Confidence Level

**95.** Spike empirically confirmed:
- BAML accepts the option (and validates it).
- Output is correct across all 13 generated files (5 distinct relative-import patterns, all rewritten to include `.js`).
- Misconfiguration fails loud at build time.

The remaining 5% is the unlikely possibility that some downstream consumer of `@customerEQ/ai` has a CommonJS-only assumption that breaks with extension-bearing imports. Verified `apps/api`, `apps/worker`, and `packages/ai`'s own tests all declare `"type": "module"`. Risk is low and is caught by the new CI step on first PR build.

## Validation Plan

| User Scenario | Expected Outcome | Validation Method |
|---|---|---|
| BAML regenerated locally with new `module_format` | All relative imports in `src/generated/baml_client/*.ts` end in `.js` | Local: `pnpm --filter @customerEQ/ai run generate && grep -REn 'from "\\./[a-z_]+"' packages/ai/src/generated/baml_client/` returns no matches |
| BAML rejects bogus value | Codegen errors fail-fast with a useful message | Spike confirmed (manual one-off) |
| API/Worker images load `@customerEQ/ai` cleanly with the new BAML output | `node --input-type=module -e "await import('@customerEQ/ai')"` exits 0 without `ERR_MODULE_NOT_FOUND` | New CI step `Verify API image module resolution` (and worker equivalent). Local: `docker build -f Dockerfile.api -t ceq-api:test . && docker run --rm --entrypoint node ceq-api:test --input-type=module -e "await import('@customerEQ/ai').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"` |
| API container deployed to prod activates cleanly | New revision `customereq-api--<NNNN>` reaches `Running, Healthy`; `0000111` deactivates | Post-merge: `az containerapp revision list --name customereq-api --query "[?properties.active]"` returns the new revision only |
| CD's `Verify API health` step passes | `/healthz` returns 200 from the new revision | Post-merge: CD job log shows "API health check passed" |
| Existing `@customerEQ/ai` consumers continue to work | All `packages/ai` unit + smoke tests pass; `apps/api` and `apps/worker` typecheck and build | Existing CI: `pnpm typecheck`, `pnpm test:smoke`, `docker-build` job |

## Test Matrix

| Layer | Coverage |
|---|---|
| **Unit** | No new unit tests required. The change is configuration of an external code generator; its emitted output is itself the contract. Verifying the output by grep is more useful than mocking the generator. Existing `packages/ai` unit tests (`sentiment-baml-wiring.test.ts`, `sentiment.test.ts`, `analyzeResponse → BAML wiring` suites) continue to import from `@customerEQ/ai` and implicitly verify the import contract. |
| **Integration** | **New CI steps in `.github/workflows/ci.yml` `docker-build` job**: `Verify API image module resolution` and `Verify Worker image module resolution`. Each builds the production image and runs `node --input-type=module -e "await import('@customerEQ/ai')"` against it to confirm `@customerEQ/ai`'s module tree (including BAML codegen output) loads cleanly. No DB, no Redis, no env vars, no real boot. Probe target is **deliberately narrow** to `@customerEQ/ai` — the regression class this RFC fixes — so CI doesn't false-positive on env-var reads in unrelated module-load paths. |
| **E2E** | Post-merge: the existing `Verify API health` step in `deploy.yml` (lines 119-132) curls `/healthz` with retries. No new E2E test needed; the gap was that this step kept being skipped, not that it was missing. |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| BAML `module_format` is renamed or removed in a future version | Low | Medium | BAML version pinned in two places (`package.json` + `generators.baml`). Upgrades exercise the new CI step. |
| Some consumer of `@customerEQ/ai` requires CJS-style imports | Very low | High | All consumers declare `"type": "module"`. New CI step catches any regression on first build. |
| Merging unblocks 2.5 weeks of accumulated changes hitting prod simultaneously | High | Medium | Inevitable once the dam breaks. Merge during low-traffic window. Roll-back path: `az containerapp revision activate --name customereq-api --resource-group customereq-prod --revision customereq-api--0000111` (the April 17 revision is still resident in Container Apps history). |
| The fix is in the build pipeline, so any test of "does it work" requires a real Docker build | Low | Low | The new CI step *is* the test. Local repro is `pnpm --filter @customerEQ/ai run generate && grep ...` for the codegen change, and `docker build && docker run` for the runtime contract. Both are scripted in the validation table above. |
| A separate codegen tool also emits BAML-style extensionless imports somewhere else in the repo | Very low | Medium | Verified via `grep -RE 'from "\\./[a-z_]+(?<!\\.js)"' packages/ -- '*.ts'` after the fix lands — should return zero matches in any committed `dist/` or generated source. |

## Spike Findings

### What Was Spiked

Whether BAML 0.211.0 has a generator-block option to emit ESM-friendly imports natively, so we can avoid maintaining a custom post-process patch script (the approach sketched in the issue body).

### Findings

- **`module_format` is a real, validated BAML 0.211.0 generator option**, with valid values `cjs` or `esm`.
- Setting `module_format "esm"` in `generators.baml` produces correct output across **all 13 generated files** (`async_client.ts`, `async_request.ts`, `config.ts`, `globals.ts`, `index.ts`, `inlinedbaml.ts`, `parser.ts`, `partial_types.ts`, `sync_client.ts`, `sync_request.ts`, `tracing.ts`, `type_builder.ts`, `types.ts`). Every relative import is rewritten to include `.js`.
- BAML rejects invalid `module_format` values at codegen time. Empirically: setting `module_format "totally_invalid_option_xyz"` produced `Error validating: 'totally_invalid_option_xyz' is not supported. Use one of: 'cjs' or 'esm'`. So misconfiguration fails loudly at build time, not silently at runtime.

### Design Impact

The fix is materially smaller and safer than the alternative the issue body sketched (a custom `scripts/patch-baml-imports.mjs` chained into `pnpm run generate`):

| Dimension | Native `module_format "esm"` | Post-process patch script |
|---|---|---|
| Lines of new code | 1 | ~30–50 |
| New files / dependencies | 0 | 1 mjs file + node-fs use |
| Maintenance | Survives BAML regenerations and version bumps automatically | Must be re-validated on every BAML upgrade (output structure can change) |
| Failure mode if input changes | BAML rejects at codegen with clear error | Patch silently no-ops on unexpected file shapes |
| Cost of being wrong | None — the new CI step catches it | A subtle skip leaves prod broken, exactly the failure mode this RFC is fixing |

→ The native option is unambiguously the right choice. The issue body's sketched approach is **not adopted**.

## Observability (logs, metrics, alerts)

- **Existing, sufficient**:
  - Container Apps revision activation state (Azure portal + `az containerapp revision list`).
  - CD workflow logs (`Build, Lint, Test`, `Deploy *`, `Verify API health`).
  - `customereq-worker` system + console logs in Log Analytics — KQL surfaces `ContainerTerminated` events broken down by exit code (used during root-cause investigation; will continue to be the canonical signal for #274).
- **Currently masked but unlocked by this RFC**: `Verify API health` step in `deploy.yml`. Once this fix and #272 land, that step runs on every deploy and provides the post-deploy gate that's been missing for 16 days.
- **No new metrics, dashboards, or alerts.** The failure mode is binary (image's modules resolve or don't) and the existing tooling surfaces it cleanly once it's not being short-circuited by upstream workflow failures.

---

## Architecture Analysis

Comparison of this RFC against `docs/architecture/architecture.md`.

### Patterns Correctly Followed

| Pattern | Location in architecture.md | How this RFC follows it |
|---|---|---|
| Node.js >= 22 with native ESM support | §2 Tech Stack, line 28 | The `module_format "esm"` setting emits imports compatible with Node 22 ESM strict resolution. Restores conformance that was silently broken by `bdfadf0`. |
| Synchronous `@customerEQ/ai` load contract | §6 Design Patterns & Principles, line 401 (`POST /v1/members/:id/notes` calls `@customerEQ/ai` synchronously) | The API process must be able to import `@customerEQ/ai` at startup. This RFC restores that ability. |
| Turborepo + pnpm 9 build orchestration | §2 Tech Stack, line 37 | No change to build orchestration — fix is purely in BAML codegen output emitted *by* the existing turbo-driven build. |
| Smoke test before deploy | §11 Validation Commands area, line 474 (`pnpm build && pnpm typecheck && pnpm test`) | The new CI step (`Verify * image module resolution`) is a build-stage extension of the same principle: verify *load-time* contracts before shipping, not just compile-time and test-time. |
| Single revision mode + post-deploy health gate | §8 Infrastructure (Container Apps deploy.yml `Verify API health`) | This RFC unblocks the existing health-gate step that has been silently skipped due to upstream workflow failures. No new pattern introduced. |

### Patterns Missing from Architecture

| Pattern | Why it matters | Suggested resolution |
|---|---|---|
| BAML codegen-at-build-time as a build-pipeline contract | After `bdfadf0`, `@customerEQ/ai` is built via `pnpm run generate && tsc`, where `generate` runs `npx @boundaryml/baml@<version> generate` and depends on the BAML version pinned in two places (`packages/ai/package.json` and `packages/ai/baml_src/generators.baml`). This non-obvious build behavior is **not documented in §3.5 (Shared Layer) or §6 (Design Patterns)**. The fact that the generated source is gitignored means a fresh checkout has no BAML output until `pnpm install` + a build runs — surprising for new contributors. | Add a sub-bullet to §3.5 or §6 in `architecture.md` documenting: (1) `@customerEQ/ai`'s `src/generated/baml_client/` is gitignored and regenerated on every build via `npx @boundaryml/baml@<pinned-version> generate`; (2) the `module_format "esm"` setting is required for Node 22 ESM resolution; (3) BAML version is pinned in both package.json and generators.baml and must be bumped together. Defer the actual edit to the address-feedback phase per FRAIM job rules. |
| CI gate: built-image module-resolution probe | This RFC adds a new CI pattern — running the built Docker image with a one-shot dynamic-import probe to catch module-resolution failures before they reach prod. This pattern doesn't exist in §11 Validation Commands. It bridges the gap between unit tests (which run against source TS) and prod activation (which fails silently). | Add to §11 Validation Commands: a "Built-image module-resolution probe" step is part of CI's docker-build job for any service that ships a Node ESM bundle. Defer the architecture doc edit to address-feedback. |

### Patterns Incorrectly Followed

This RFC's design follows architecture.md correctly. **However**, while reviewing for gaps, surfaced one **production-state** violation of architecture.md that is *not* in scope here but is worth recording for traceability:

- **§3.3 line 69** says: *"The worker process exists to drain BullMQ queues and is only deployed when `QUEUE_MODE=redis`. In `QUEUE_MODE=inline`, the same processor logic is invoked in-process from the API … the worker is not needed and is not run."*
- **Production state**: `customereq-worker` Container App is provisioned and running with `QUEUE_MODE=inline`. It crash-loops continuously (#274 documents 290+ daily exits since 2026-04-18).
- **Resolution**: Tracked in #274. Not in scope for this RFC. The CI step this RFC adds for the *worker image* serves as a regression-catcher for the day `QUEUE_MODE` flips back to `redis`; it does not justify or contradict the worker's current deployment state.

## Cross-references

- **Source issue**: #273
- **Related issues**:
  - #272 — `customereq-demo` Container App not provisioned. Independent fix; both are needed for the CD workflow to reach `Verify API health`.
  - #274 — Worker crash-loop + `QUEUE_MODE=inline` deploy gate. The BAML fix here unblocks the worker's *image build*, but the worker is still expected to exit early in inline mode — the architectural cleanup belongs in #274.
- **Architecture touchpoints**:
  - `docs/architecture/architecture.md:28` — Node.js 22 + native ESM. The fix conforms.
  - `docs/architecture/architecture.md:69` — worker deploy contract. Production violates it; tracked in #274.
  - `docs/architecture/architecture.md:401` — `@customerEQ/ai` synchronous load contract. The fix restores it.
- **Originating regression**: `bdfadf0` (2026-04-17), with `8fd2786`'s patch lost as collateral damage.
