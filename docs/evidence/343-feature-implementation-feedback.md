# Feedback / Quality Findings — Issue #343

## A. Phase 8 — `implement-quality` findings

Diff scope: `.github/workflows/ci.yml` (+21 lines), `.github/workflows/deploy.yml` (+26 lines). YAML-only.

### A1. Hardcoded values

| Location | Value | Verdict |
|---|---|---|
| `ci.yml` + `deploy.yml` | `dorny/paths-filter@v3` action pin | **OK** — consistent with repo convention (major-version pinning for all marketplace actions). |
| `deploy.yml` `fetch-depth: 2` | Numeric literal | **OK** — documented in inline comment: "Need HEAD~1 locally for the paths-filter base comparison below". 2 is the minimum value that makes `HEAD~1` resolvable. |
| `deploy.yml` `base: HEAD~1` | Git ref expression | **OK** — documented in inline comment as relying on squash-merge convention to main. |

No hardcoded URLs, API keys, credentials, colors, sizes, or magic numbers introduced.

### A2. Duplicate code / DRY

**Finding A2.1**: The 7-pattern skip-list (`!**/*.md`, `!docs/**`, `!.github/ISSUE_TEMPLATE/**`, `!.github/pull_request_template.md`, `!CODEOWNERS`, `!.gitattributes`, `!LICENSE`) is duplicated verbatim between `ci.yml` and `deploy.yml`.

**Severity**: MINOR.

**Status**: **ADDRESSED in-design** (no code change needed). Disposition was set in the issue #343 body before implementation:

> Issue #343 §"Out of scope":
> *"Skip set is not configurable via repo variable — committed inline in both workflows. If duplication becomes painful (3rd workflow or more), promote to a reusable workflow."*

And restated as D-343-implicit in `docs/evidence/343-implement-work-list.md` §"In-flight decisions / deferrals":
> *"Skip set is not configurable via repo variable — committed inline in both workflows. If duplication becomes painful (3rd workflow or more), promote to a reusable workflow. Out of scope for this PR."*

Per FRAIM Constitution principle IV (Simplicity & Minimalism — "Choose the simplest path that fully satisfies the requirements"), two duplicated 7-line lists with documented promotion criteria is the right level for the current scope. The user pre-approved this disposition in the issue body itself; this is not a new agent-self-resolved finding.

If a third workflow file needs the same skip-list, the appropriate response is to promote to a `.github/workflows/_doc-only-filter.yml` reusable workflow at that time, not now.

### A3. Missed reusability

None new. The skip-list duplication is the only reuse-adjacent observation, addressed in A2.1 above.

### A4. Standards compliance

- No credentials in code: ✓
- No environment variables introduced: ✓ (no `.env` changes)
- Function / file sizes: ✓ (`ci.yml` 196 lines, `deploy.yml` 173 lines, both well under the 500-line threshold)

### A5. Monolithic files

N/A. Neither file is monolithic.

### A6. Overly complex logic

N/A. The added logic is `if: steps.changes.outputs.build == 'true'` — a simple boolean. No nested conditionals, no high cyclomatic complexity, no long parameter lists.

### A7. Architecture health

- New dependency: `dorny/paths-filter@v3` GitHub Action. Vetted in §D (Security Review) of the evidence doc — reputable maintainer, current stable major, consistent with repo's existing major-version pinning convention.
- No new npm dependencies.
- No circular import concerns (no source code changes).

---

## B. Quality verdict

PASS. Single finding (A2.1) was pre-disposed in the issue body and work-list as "duplication accepted; promote at 3+ workflows". No agent-self-resolved findings. No `QUALITY CHECK FAILURE` items remaining.

---

## C. Round 1 feedback (post-PR-open)

### C1. CI on PR #346 failed — `dorny/paths-filter@v3` lacked `pull-requests: read`

**Reviewer**: manohar.madhira@outlook.com
**Date**: 2026-05-12
**Comment**: *"Why does CI say failed? It didn't run Deploy as expected, but should it not succeed?"*

**Surfaced by**: PR #346 CI run `25763238161` (the `pull_request`-event run that fires alongside the `push`-event run). The `Build production images` job's first step (`Determine if build is needed`) failed at 12s with:

```
##[group]Fetching list of changed files for PR#346 from Github API
Invoking listFiles(pull_number: 346, per_page: 100)
##[error]Resource not accessible by integration
```

The companion run `25763219624` (the `push`-event run) succeeded in 2m16s — confirming this is event-type-dependent.

**Root cause**: `dorny/paths-filter@v3` uses two different mechanisms to compute the changed file set:
- On `push` events → local `git diff`.
- On `pull_request` events → GitHub REST API `listFiles(pull_number=...)`.

The default `GITHUB_TOKEN` for this repo does not grant `pull-requests: read`, so the API call is rejected. The fix is a per-job `permissions:` block.

**Status**: ADDRESSED.

**Resolution**:

Added to `.github/workflows/ci.yml` `docker-build` job:

```yaml
permissions:
  contents: read
  pull-requests: read
```

`contents: read` is the default but stated explicitly for clarity. `pull-requests: read` is the minimum scope `dorny/paths-filter` needs on PR events.

`deploy.yml` is unaffected — it runs on `workflow_run`, not `pull_request`, so the API path is never taken. The local git diff via `base: HEAD~1` was working correctly in the design.

**Re-validation**:

- YAML parse: PASS (`permissions: {'contents': 'read', 'pull-requests': 'read'}` resolves cleanly).
- Local Rule 11 gates from Phase 5 remain green (workflow YAML changes don't affect them).
- Real-world re-validation: the next PR-event run on the updated branch should resolve the filter step to `build: true` (since `.github/workflows/**` is not in the skip set) and proceed with the full image build.

**Status**: ADDRESSED.
