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

Add a step to the `docker-build` job in `ci.yml` that runs the built image with a one-shot import probe:

```yaml
- name: Verify API image module resolution
  run: |
    docker run --rm --entrypoint node ceq-api:${{ github.sha }} \
      --input-type=module \
      -e "await import('/app/apps/api/dist/server.js').catch(e => { console.error(e); process.exit(1) })"
```

The same step is added for `ceq-worker:${{ github.sha }}`. Each runs in <2 seconds, has no DB/Redis dependency, and fails the CI job on any `ERR_MODULE_NOT_FOUND` / circular-import / missing-dist-file at module-load time. Stops the entire class of regression at PR time.

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
| API/Worker images build and start with new BAML output | `node dist/server.js` (or worker entry) reaches the application's first log line without `ERR_MODULE_NOT_FOUND` | New CI step `Verify API image module resolution` (and worker equivalent). Local: `docker build -f Dockerfile.api -t ceq-api:test . && docker run --rm --entrypoint node ceq-api:test --input-type=module -e "await import('/app/apps/api/dist/server.js').catch(e => { console.error(e); process.exit(1) })"` |
| API container deployed to prod activates cleanly | New revision `customereq-api--<NNNN>` reaches `Running, Healthy`; `0000111` deactivates | Post-merge: `az containerapp revision list --name customereq-api --query "[?properties.active]"` returns the new revision only |
| CD's `Verify API health` step passes | `/healthz` returns 200 from the new revision | Post-merge: CD job log shows "API health check passed" |
| Existing `@customerEQ/ai` consumers continue to work | All `packages/ai` unit + smoke tests pass; `apps/api` and `apps/worker` typecheck and build | Existing CI: `pnpm typecheck`, `pnpm test:smoke`, `docker-build` job |

## Test Matrix

| Layer | Coverage |
|---|---|
| **Unit** | No new unit tests required. The change is configuration of an external code generator; its emitted output is itself the contract. Verifying the output by grep is more useful than mocking the generator. Existing `packages/ai` unit tests (`sentiment-baml-wiring.test.ts`, `sentiment.test.ts`, `analyzeResponse → BAML wiring` suites) continue to import from `@customerEQ/ai` and implicitly verify the import contract. |
| **Integration** | **New CI steps in `.github/workflows/ci.yml` `docker-build` job**: `Verify API image module resolution` and `Verify Worker image module resolution`. Each builds the production image and runs `node --input-type=module -e "await import(<dist-entry>).catch(...)"` to confirm module-load succeeds. No DB, no Redis, no real boot. Fails CI on any module-resolution error at any layer. |
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

## Cross-references

- **Source issue**: #273
- **Related issues**:
  - #272 — `customereq-demo` Container App not provisioned. Independent fix; both are needed for the CD workflow to reach `Verify API health`.
  - #274 — Worker crash-loop + `QUEUE_MODE=inline` deploy gate. The BAML fix here unblocks the worker's *image build*, but the worker is still expected to exit early in inline mode — the architectural cleanup belongs in #274.
- **Architecture touchpoints**:
  - `docs/architecture/architecture.md:401` — `@customerEQ/ai` is called synchronously from `POST /v1/members/:id/notes` for sentiment analysis. The API process *must* be able to load `@customerEQ/ai` at startup; this fix restores that.
- **Originating regression**: `bdfadf0` (2026-04-17), with `8fd2786`'s patch lost as collateral damage.
