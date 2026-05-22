# Issue #492 — Merge Queue CI Optimization: Work List

## Summary
Replace per-commit CI (64% waste) with GitHub Merge Queue: CI runs exactly once per PR on the final merge commit. Eliminates redundant `pull_request` and `push: main` triggers.

## Context
- 64 of last 100 CI runs were from `pull_request` trigger (feature branch pushes with open PRs)
- 24 were redundant post-merge `push: main` runs
- Two branches alone caused 34 CI runs (~6 hours waste): feature/423 (19×), feature/413 (15×)
- Branch protection currently disabled — safe to enable Ruleset
- Nightly metrics workflows push directly to main — will be exempted via github-actions[bot] bypass actor

## Issue Type: feature

## Implementation Checklist

### 1. ci.yml — swap triggers
- [ ] `.github/workflows/ci.yml` — remove `pull_request: branches: [main]` trigger
- [ ] `.github/workflows/ci.yml` — remove `push: branches: [main]` trigger
- [ ] `.github/workflows/ci.yml` — add `merge_group: branches: [main]` trigger
- [ ] `.github/workflows/ci.yml` — keep `paths-ignore` on `merge_group` for doc-only merges (nightly bot creates doc-only PRs; paths-ignore + bot bypass = no CI waste)
- [ ] `.github/workflows/ci.yml` — keep `workflow_dispatch` for manual runs

### 2. GitHub Ruleset — create via API
- [ ] Create Ruleset "Merge Queue Protection" via `gh api`
- [ ] Target: `refs/heads/main`
- [ ] Rule: `merge_queue` (squash merge, min 1 entry, max 5)
- [ ] Rule: `required_status_checks` → "Build & Test" + "Lint"
- [ ] Bypass actor: RepositoryRole admin (actor_id=5, bypass_mode=always) — hotfix path, shows red Rulesets warning banner
- [ ] Bypass actor: GitHub Actions integration (actor_id=15368, bypass_mode=always) — nightly bots

### 3. Design doc update
- [ ] `docs/architecture/cicd-pipeline.md` — update §4.1 to document merge_group trigger
- [ ] `docs/architecture/cicd-pipeline.md` — update CI run count table (CI on main: eliminated for regular merges)
- [ ] `docs/architecture/cicd-pipeline.md` — add §4.x Merge Queue + admin bypass procedure
- [ ] `docs/architecture/cicd-pipeline.md` — update completed improvements table with #492

## Validation Requirements
- `uiValidationRequired`: false (no UI changes)
- `mobileValidationRequired`: false
- `ciValidationRequired`: true — the PR itself changes ci.yml, so CI runs via merge_group; passing CI is the proof

## Known Constraints
- `dorny/paths-filter` behavior on `merge_group` events: may not support merge_group natively. Keeping in-job filter as belt-and-braces; full CI run (~37s skip) is acceptable for the once-per-PR merge queue execution.
- `github-actions[bot]` Integration ID: 15368 (GitHub's well-known Actions app ID). If API call fails, will verify and retry.
- Ruleset creation requires admin token — `GITHUB_TOKEN` in the current session has admin via owner access.

## Deferrals
- Removing in-job `dorny/paths-filter` from `ci` and `lint` jobs: kept as belt-and-braces; can be cleaned up after validating merge_group behavior
- `workflow_dispatch` trigger: kept for manual CI runs during incidents
