# Issue #457 — Merge build+typecheck into a single Turbo invocation: Work List

## Summary
Replace the sequential `pnpm build` + `pnpm typecheck` CI steps with a single `pnpm turbo run build typecheck` invocation. Turbo will interleave per-package builds and typechecks using the dependency graph instead of serializing all builds before any typecheck starts.

## Issue Type: feature

## Context
- `typecheck` has `dependsOn: ["^build"]` in turbo.json — Turbo already knows the correct ordering.
- A single invocation allows package A's typecheck to start as soon as package A builds, while package B is still building.
- On cache hits (remote cache now working as of 2026-05-22 fix), the interleaving also reduces scheduling overhead.
- No silent failure risk: Turbo exits non-zero if any task fails; overall CI step still fails correctly.

## Scope
- **Files changed**: 1 (`/.github/workflows/ci.yml`)
- **Lines changed**: ~6 (merge two steps into one; move BAML verification after merged step)

## Implementation Checklist

### `.github/workflows/ci.yml`
- [x] Replace `- name: Build` step (`run: pnpm build`) and `- name: Type check` step (`run: pnpm typecheck`) with a single `- name: Build & type check` step (`run: pnpm turbo run build typecheck`)
- [x] Move `- name: Verify BAML module resolution` to immediately after the merged step (it was between build and typecheck; build still completes before typecheck due to the Turbo dependency graph, so the BAML dist check remains valid)

## Validation Requirements
- `uiValidationRequired`: false — no UI changes
- `mobileValidationRequired`: false
- `ciValidationRequired`: true — the PR itself changes ci.yml; CI must pass via the merged step

## Phase Notes

### Phase 3 (implement-tests): N/A
The change is a CI YAML configuration file only — no production code, no business logic, no functions. There is nothing to unit-test. Validation is CI itself: the merged step must pass on the PR, which is the proof the change is correct.

## Known Constraints
- The `Verify BAML module resolution` step (Issue #467) must remain after build completes. With `turbo run build typecheck`, all builds complete before any typecheck starts (guaranteed by `dependsOn: ["^build"]`), so placing BAML verification after the merged step is correct.
- `pnpm turbo run` and `pnpm build` (which calls `turbo run build`) are equivalent; using the explicit form avoids ambiguity about which script is running.
