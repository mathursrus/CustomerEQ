# Issue #434 — Implementation Work List
# ci: upgrade GitHub Actions to Node.js 24 before June 2 deadline

**Issue**: #434  
**Branch**: `feature/434-upgrade-actions-node24`  
**Deadline**: June 2, 2026  
**Issue type**: feature (CI infrastructure)

---

## Scope

GitHub Actions forces all actions to run on Node.js 24 starting June 2, 2026. The fix is to update
`actions/checkout`, `actions/setup-node`, and `pnpm/action-setup` to their v6 major versions, which
use the Node.js 24 runtime internally.

**Not in scope**: bumping `node-version: '22'` (sets project Node version, not action runtime),
or bumping `node-version: '20'` in iOS/EAS workflows (EAS/Expo compatibility question).

---

## Version mapping

| Action | Current | Target | Node runtime |
|--------|---------|--------|-------------|
| `actions/checkout` | `@v4` | `@v6` | Node 24 (v5.0.0 was first, v6 is latest) |
| `actions/setup-node` | `@v4` | `@v6` | Node 24 |
| `pnpm/action-setup` | `@v4` | `@v6` | Node 24 (v5.0.0 was first, v6 is latest) |

**Breaking changes assessed:**
- `actions/checkout@v6`: credentials stored in `$RUNNER_TEMP` instead of git config — requires
  runner v2.329.0+. GitHub-hosted runners are always current. No impact.
- `actions/setup-node@v6`: `always-auth` input removed — not used in any workflow. No impact.
  `cache: 'pnpm'` still supported (opt-in, as our workflows already configure it). No impact.
- `pnpm/action-setup@v6`: no breaking changes relevant to our usage pattern.

---

## File inventory (27 edits across 11 files)

| File | Lines to change | Actions |
|------|----------------|---------|
| `.github/workflows/ci.yml` | 84, 113, 117, 233, 259, 263 | checkout×2, pnpm×2, setup-node×2 |
| `.github/workflows/nightly-regression.yml` | 19, 20, 21 | checkout, pnpm, setup-node |
| `.github/workflows/security-audit.yml` | 13, 14, 15 | checkout, pnpm, setup-node |
| `.github/workflows/demo-sanity.yml` | 41, 44, 47 | checkout, pnpm, setup-node |
| `.github/workflows/ci-metrics.yml` | 19, 25 | checkout, setup-node |
| `.github/workflows/cd-metrics.yml` | 20, 25 | checkout, setup-node |
| `.github/workflows/dashboard-deploy.yml` | 21 | checkout |
| `.github/workflows/deploy.yml` | 40 | checkout |
| `.github/workflows/eas-update.yml` | 19, 21 | checkout, setup-node |
| `.github/workflows/ios-simulator-build.yml` | 17, 19 | checkout, setup-node |
| `.github/workflows/ios-testflight.yml` | 14, 20 | checkout, setup-node |

**Excluded**: `auto-merge.yml` — uses `actions/github-script@v7` only, no affected actions.

---

## Implementation decisions

- Use `replace_all: true` with Edit tool to batch-update each action string across each file.
- `node-version: '20'` in iOS/EAS workflows is intentional — leave unchanged (EAS compatibility).
- `node-version: '22'` is the project build Node version — leave unchanged.
- Opt-in env var `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` is NOT needed once action versions
  are bumped to v6 (the new runtime is built in to the action binary).

---

## Validation plan

- [ ] `uiValidationRequired`: No
- [ ] `mobileValidationRequired`: No
- [ ] Push branch, open draft PR, CI must pass green with zero Node.js 20 deprecation warnings
- [ ] Confirm all 5 issue ACs met:
  - `actions/checkout` pinned to Node.js 24-compatible version
  - `actions/setup-node` pinned to Node.js 24-compatible version
  - `pnpm/action-setup` pinned to Node.js 24-compatible version
  - No Node.js 20 deprecation warnings in any workflow run
  - All listed workflows updated

---

## Phase N/A declarations

- **implement-repro** (Phase 2): N/A — this is a feature (CI version bump), not a bug fix.
- **implement-tests** (Phase 3): N/A — no application logic changed; no unit/integration tests
  applicable. Validation is CI run passing without deprecation warnings.
