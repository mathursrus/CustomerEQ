# Issue #343 — CI/CD: skip image build + deploy on doc-only commits — Work List

**Issue**: #343 ([link](https://github.com/mathursrus/CustomerEQ/issues/343))
**Type**: feature (CI/CD tooling improvement; not a bug)
**Branch**: `feature/343-ci-cd-skip-image-build-deploy-on-doc-only-commits`
**FRAIM job**: `feature-implementation`, session `3ca13545-5092-43ef-bd7e-f5be90c1b678`

The issue body already contains a fleshed-out proposal with the proposed YAML, skip set, risks, and out-of-scope items. No separate spec/design docs exist — the issue body is the spec.

---

## Goals (verbatim from #343)

1. Gate `.github/workflows/ci.yml`'s `docker-build` job behind a `dorny/paths-filter@v3` check using **skip-list (negation)** patterns.
2. Gate `.github/workflows/deploy.yml`'s `build-and-deploy` job's first step the same way (with `base: HEAD~1` to handle `workflow_run` lacking a natural diff baseline).
3. Keep the `ci` job (typecheck/lint/build/test/audit) unfiltered — it runs on every commit.
4. Net effect: doc-only commits skip image build (~17 min) and deploy (~5-10 min).

## Skip set (final, per #343)

```
**/*.md
docs/**
.github/ISSUE_TEMPLATE/**
.github/pull_request_template.md
CODEOWNERS
.gitattributes
LICENSE
```

Anything else triggers build/deploy. New top-level directories are default-included with no filter maintenance.

## Pattern Discovery

Existing CI/CD patterns in this repo:

| Pattern | Location | Notes |
|---|---|---|
| GitHub Actions workflows | `.github/workflows/{ci,deploy}.yml` | Two files total |
| `dorny/paths-filter` | not currently used | New action dependency; well-maintained (v3) |
| `workflow_run` trigger with `head_sha` fallback | `deploy.yml:43-44` | `github.event.workflow_run.head_sha \|\| github.sha` — must preserve |
| Job-level `if:` gating | `deploy.yml:31` | Existing pattern — extend with `steps.changes.outputs.build == 'true'` |
| `concurrency:` block | `deploy.yml:17-19` | Per ADR/retro #166; do not disturb |

No constants file or shared config affects this — workflow YAML is self-contained.

## Resolved Decisions

### D-343.1 — Use skip-list (negation), not whitelist

Per issue #343 §"Proposed change" rationale: skip-list miss = over-build (visible, recoverable); whitelist miss = silent skip = stale-image deploy. Use `dorny/paths-filter`'s `!`-prefixed pattern syntax — all entries negative, no positive include patterns.

### D-343.2 — Gate per-step in `docker-build`, not at the job level

The `ci.yml` `docker-build` job has 6 steps (checkout, buildx setup, 3 × `docker build`, 2 × module-resolution probes). The path-filter step itself must always run (it's how we decide), so gating the *job* with `if:` would prevent the filter from evaluating. Instead, the filter step runs unconditionally, and every subsequent build step gates on `steps.changes.outputs.build == 'true'`.

### D-343.3 — `deploy.yml` uses `base: HEAD~1`

Per #343 §"deploy.yml": `workflow_run` triggers cannot use `paths-ignore` at the trigger level. The workaround is a guard step inside `build-and-deploy` that runs `dorny/paths-filter` with `base: HEAD~1` (every main commit is a squash merge, so the diff against the immediate parent gives us the merged content). Subsequent deploy steps gate on the same `steps.changes.outputs.build == 'true'` check.

### D-343.4 — `paths-ignore` at the workflow trigger level is NOT used

Rejected because:
- For `ci.yml`: would skip the `ci` job too (we want typecheck/lint/test on every commit).
- For `deploy.yml`: GitHub Actions does not honor `paths-ignore` on `workflow_run` triggers.

### D-343.5 — Skip set scope (no `.png`/`.jpg` global skip)

Per issue body §"On `.png`/`.jpg`" discussion: do not list image file extensions globally in the skip set. Path-prefix handles it correctly — `apps/web/public/logo.png` doesn't match any skip pattern → build triggers (Next.js bakes the asset into the image). `docs/screenshot.png` matches `docs/**` → skip. No special-case needed.

---

## Implementation Checklist

### Code

- [ ] `.github/workflows/ci.yml` — MODIFY `docker-build` job:
  - Insert `dorny/paths-filter@v3` step after the `Checkout` step, output id `changes`, all-negative filter patterns.
  - Add a no-op `Skip if doc-only` step that prints a message when `steps.changes.outputs.build == 'false'`.
  - Add `if: steps.changes.outputs.build == 'true'` to each of: `Set up Docker Buildx`, `Build api image`, `Verify API image module resolution`, `Build worker image`, `Verify Worker image module resolution`, `Build web image`.
- [ ] `.github/workflows/deploy.yml` — MODIFY `build-and-deploy` job:
  - Insert `dorny/paths-filter@v3` step after the `Checkout` step (uses the `head_sha` ref already configured) with `base: HEAD~1` and the same skip set.
  - Add a `Skip if doc-only` step that exits 0 with a message when `steps.changes.outputs.build == 'false'`.
  - Add `if: steps.changes.outputs.build == 'true'` to each subsequent step (login + acr build × 4 + containerapp update × 5 + healthcheck).

### Tests

YAML changes are not testable via the project's `pnpm test:smoke` (no test harness for `.github/workflows/`). Per #166 / #255 retrospective precedent, validation is:

- [ ] `js-yaml` parse via inline node command to verify YAML is well-formed.
- [ ] Visual review of the diff for correctness against #343 §"Proposed change".
- [ ] Post-merge: the PR for this issue itself is the first test case — it's a `.yml`-only change that *should* trigger image-build (because `.github/workflows/**` is NOT in the skip set; workflow edits always rebuild per issue #343 risk #3). PR #345 (coaching moments, content-only) once it lands on main will be the second test case.

### Files removed

None — both workflows are modified in place.

### Files NOT touched

- `docs/architecture/architecture.md` — workflow YAML changes don't introduce a new architectural pattern. Per the #166 retrospective: "`docs/architecture/architecture.md` does not currently document the CI/CD pipeline" — no doc update needed.
- `package.json` / `pnpm-lock.yaml` — `dorny/paths-filter` is a GitHub Action, not an npm dep.

---

## Validation Requirements

- **`uiValidationRequired`**: NO. No UI surface.
- **`mobileValidationRequired`**: NO.
- **YAML validity**: required. Parse via `js-yaml` after edits.
- **Local pre-push gates per Rule 11**: `pnpm typecheck && pnpm lint && pnpm build && pnpm test:smoke` should pass — these are unaffected by workflow YAML changes but Rule 11 requires running them anyway as a regression guard.
- **CI on PR**: the PR for this very change will be the first real-world test of the new filter logic.

---

## Complexity Assessment

File modifications: 2 (both YAML).

Below the 15-file phase-split threshold. Single-slice ship.

---

## In-flight decisions / deferrals

- **No new npm deps**. Only a new GitHub Action (`dorny/paths-filter@v3`).
- **Skip set is not configurable via repo variable** — committed inline in both workflows. If duplication becomes painful (3rd workflow or more), promote to a reusable workflow. Out of scope for this PR.
- **Architecture doc update**: skipped. The #166 retrospective notes the architecture doc doesn't cover CI/CD; this PR doesn't change that.

---

## Phase-2 entry criteria

Before starting phase 2 (`implement-repro`):
- Issue type = feature (not bug), so phase 2 is skipped per workflow definition.
- Branch is on `feature/343-ci-cd-skip-image-build-deploy-on-doc-only-commits`, isolated worktree at `/c/Github/mathursrus/CustomerEQ - Issue 343`.
