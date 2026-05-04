# Issue #273 — Implementation Work List

**Issue type**: bug
**RFC**: `docs/rfcs/273-baml-esm-imports.md`
**Branch**: `feature/issue-273-baml-js-extensions` (already prepped)
**Scope**: Build-pipeline fix (BAML codegen) + CI safety net + architecture-doc updates.

## Standing Work List

### Production code changes

- [ ] `packages/ai/baml_src/generators.baml` — add `module_format "esm"` line inside the `generator target` block.

### CI changes

- [ ] `.github/workflows/ci.yml` — in the `docker-build` job, after `Build api image`, add step `Verify API image module resolution` that runs `node --input-type=module -e "await import('@customerEQ/ai').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"` against `ceq-api:${{ github.sha }}`.
- [ ] `.github/workflows/ci.yml` — same step pattern after `Build worker image` (`Verify Worker image module resolution`) against `ceq-worker:${{ github.sha }}`.
- [ ] Web image is exempt — `apps/web` does not depend on `@customerEQ/ai`.

### Architecture doc updates (deferred to `implement-architecture-update` phase)

- [ ] `docs/architecture/architecture.md` §3.5 (Shared Layer) or §6 (Design Patterns) — document that `@customerEQ/ai`'s `src/generated/baml_client/` is gitignored and regenerated on every build via `npx @boundaryml/baml@<pinned-version> generate`; that `module_format "esm"` is required for Node 22 ESM resolution; that BAML version is pinned in both `package.json` and `generators.baml` and must be bumped together.
- [ ] `docs/architecture/architecture.md` §11 (Validation Commands) — document the "built-image module-resolution probe" CI gate, with the narrow-target principle (probe `@customerEQ/ai` not `server.js`).

### Validation Requirements

- [ ] **UI validation**: not required (no UI changes; `apps/web` not touched).
- [ ] **Mobile validation**: not required (no mobile surface).
- [ ] **Browser validation**: not required.
- [ ] **Code-load probe (local)**: `pnpm --filter @customerEQ/ai run generate` then `grep -nE 'from "\\./[a-z_]+"' packages/ai/src/generated/baml_client/index.ts` returns no extensionless imports.
- [ ] **Built-image probe (local)**: `docker build -f Dockerfile.api -t ceq-api:test .` then `docker run --rm --entrypoint node ceq-api:test --input-type=module -e "await import('@customerEQ/ai').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"` exits 0.
- [ ] **CI green**: PR's CI run shows `Verify API image module resolution` and `Verify Worker image module resolution` steps both passing.
- [ ] **Existing CI gates still green**: `pnpm typecheck`, `pnpm lint`, `pnpm test:smoke`, `docker-build` job all pass.
- [ ] **Smoke test (post-merge, deferred to CD)**: existing `Verify API health` step in `deploy.yml` returns 200 from a new `customereq-api--<NNNN>` revision serving the new image.

### Patterns Discovered (codebase-pattern-discovery)

- **BAML codegen invocation**: `pnpm --filter @customerEQ/ai run generate` (alias for `npx @boundaryml/baml@0.211.0 generate`). Already wired into `pnpm build` via `packages/ai/package.json`'s build script.
- **Docker image build pattern in CI**: `docker/build-push-action@v6` is used for api/worker/web in `.github/workflows/ci.yml` `docker-build` job, with `push: false` and tags `ceq-{api,worker,web}:${{ github.sha }}`. The new probe steps go right after these `Build {api,worker} image` steps so the probe runs against the just-built image.
- **No new dependencies needed**: the probe uses `node` (already in the runtime image) + `docker run` (already used implicitly by `docker/build-push-action`'s tags).

### Open questions / known deferrals

- BAML CLI's `module_format` validation behavior across upgrades — **not in scope here**. Pinned version makes this deterministic until a deliberate bump.
- Worker container's `QUEUE_MODE=inline` deploy state contradicting `architecture.md:69` — **out of scope** (#274).
- Demo-storefront Container App provisioning — **out of scope** (#272). Until that's fixed, `Verify API health` in CD will continue to skip (orthogonal to this PR's success criteria).

### Phase splitting check

Total file modifications: **3 files** (generators.baml, ci.yml, architecture.md). Well under the 15-file split threshold. Single PR.
