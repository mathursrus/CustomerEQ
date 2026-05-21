# Issue #493 — Turbo Build+Typecheck Merge: Work List

## Summary
Merge the separate `pnpm build` and `pnpm typecheck` CI steps into a single `turbo run build typecheck` invocation, and add `"outputs": []` to the `typecheck` task in `turbo.json` to enable Turbo remote cache hits. Expected saving: ~1–2 minutes wall clock on every CI run; potentially eliminates typecheck time entirely on cache-warm runs.

## Issue Type: feature

## Consolidates
- Closes #457 — merge build+typecheck into single Turbo invocation
- Closes #458 — add outputs:[] to typecheck task in turbo.json

## Scope Analysis

Two files touched, three logical changes:

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Rename "Build" step → "Build and type check"; change `pnpm build` → `pnpm exec turbo run build typecheck` |
| `.github/workflows/ci.yml` | Remove the standalone "Type check" step |
| `turbo.json` | Add `"outputs": []` to `typecheck` task |

Total: 3 lines changed across 2 files. Well under the 15-file Phase Splitting threshold.

## Implementation Checklist

- [x] `turbo.json` — add `"outputs": []` to `typecheck` task
- [x] `.github/workflows/ci.yml` — rename "Build" step, change `run: pnpm build` → `run: pnpm exec turbo run build typecheck`
- [x] `.github/workflows/ci.yml` — remove the standalone "Type check" step (4 lines)
- [x] Verify "Verify BAML module resolution" step remains after the combined step (correct position — build outputs exist before typecheck runs)

## Validation Requirements
- `uiValidationRequired`: false (no UI changes)
- `mobileValidationRequired`: false
- `ciValidationRequired`: true — the PR itself changes ci.yml; passing CI on the PR is the proof
- Local validation: `pnpm build` + `pnpm typecheck` must both pass before push

## Phase Notes

### Phase 3 (implement-tests): N/A
CI configuration changes have no unit tests. The CI pipeline itself is the test harness.

### Phase 6 (implement-security-review)
Changes touch only task scheduling flags and step ordering. No secrets introduced. Production secrets policy not impacted — TURBO_TOKEN/TURBO_API/TURBO_TEAM are already in env block via existing secrets references, unchanged.

## Post-ship Monitoring
After merging, monitor cache-hit CI runs for the first week. Changing `outputs` on `typecheck` affects how Turbo writes/restores cache entries. A cache miss on the first post-merge run is expected (cold write); subsequent runs with unchanged source should hit cache.

## Known Constraints
- `pnpm exec turbo run build typecheck` is used (not `pnpm turbo`) for explicit pnpm-workspace-aware invocation. `turbo` is in root devDependencies so this resolves correctly.
- The "Verify BAML module resolution" step stays in its current position (after the combined build+typecheck step) — `packages/ai/dist/index.js` is guaranteed to exist since build tasks complete before the combined step exits.
