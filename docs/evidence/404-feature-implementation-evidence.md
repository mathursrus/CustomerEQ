# Feature Implementation Evidence — Issue #404

**Issue**: [#404](https://github.com/mathursrus/CustomerEQ/issues/404) — Reword Rule 26: "one PR per phase artifact" is misleading
**Branch**: `feature/404-reword-rule-26-one-pr-per-phase-artifact-is-misleading-should-be-all-artifacts-ship-in-one-pr-per-issue`
**Worktree**: `C:/Github/mathursrus/CustomerEQ - Issue 404`
**Issue type**: feature (documentation-only — rule wording correction)

---

## Phase 1 — implement-scoping

**Artifact**: [`docs/evidence/404-implement-work-list.md`](./404-implement-work-list.md) — 2 in-scope files, 5 confirmed-out-of-scope locations with rationale, validation-by-regrep plan.

## Phase 2 — implement-tests

**No test surface.** Documentation-only rewording. Per CLAUDE.md "tests must never skip" — this is the absence of a test surface to author against, not a skipped test. Validation method (re-grep + read-through) replaces test coverage in this phase.

## Phase 3 — implement-code

**Edits applied:**

1. `fraim/personalized-employee/rules/project_rules.md` — 5 locations rewritten + 1 new paragraph inserted:
   - Line 195 (heading): "One PR Per Phase Artifact" → "All Phase Artifacts Ship in One PR Per Issue"
   - Line 197 (intro): "**one PR per phase artifact within that issue**" → "**all phase artifacts for that issue ship in one PR** (with multiple phase-aligned commits as needed)" + explicit "not one PR per phase" negation
   - Line 203 (load-bearing bullet): rewrote to "**One PR** for the whole issue, containing one commit per phase artifact as needed (spec, RFC, impl, evidence, retro, coaching-moment capture) ..."
   - Line 205 (NEW companion paragraph): "**How to read Rule 26.** The unit of shipping is the **issue**, not the phase ..." — prose clarification so future agents cannot misread.
   - Line 223 (cadence ref): "The per-phase-artifact PR cadence" → "The single-PR-per-issue cadence (with phase artifacts arriving as additional commits on that PR's branch)"
   - Line 229 (priority-order default): "one issue / one branch / one PR per phase artifact" → "one issue / one branch / one PR for all phase artifacts, with multiple phase-aligned commits as needed"

2. `fraim/personalized-employee/learnings/manohar.madhira@outlook.com-mistake-patterns.md` — 1 location:
   - Line 32 (Default-when-FRAIM-is-silent under the chore-issue-fabrication mistake-pattern): reworded to match corrected Rule 26 + added "as additional commits on the same branch" clarification.

## Phase 4 — implement-validate

**Working tree** (post-edit): only the two intended files modified, +8 / -6 lines across 2 files. Untracked: `docs/evidence/404-implement-work-list.md` and this evidence doc — both intentional Phase 1 / Phase 5 artifacts.

**Re-grep validation:**

```
$ rg "one PR per phase artifact|per-phase-artifact PR|PR per phase artifact" fraim/
# zero matches
```

The misleading phrasings are fully extinguished from `fraim/`. Surviving "per phase artifact" matches are:
- `project_rules.md:197` — "not one PR per phase" (negation; load-bearing)
- `project_rules.md:203` — "one commit per phase artifact" (correct usage: commit granularity, not PR cadence)
- `mistake-patterns.md:35` — `[[feedback-one-pr-per-phase-artifact]]` auto-memory pointer name (off-repo; out-of-scope per work list)

**No UI / no mobile / no API surface** — validation by re-grep + read-through is sufficient.

---

## Security Review

### Executive Summary

- **Surface**: `capability-authoring` (rules + learnings under FRAIM personalized tree)
- **Findings**: 0
- **Severities**: Critical 0, High 0, Medium 0, Low 0
- **Dispositions**: N/A (no findings)
- **Escalations**: None

### Review Scope

- `reviewType`: `embedded-diff-review`
- `reviewScope`: `diff`
- `surfaceAreaPaths`:
  - `fraim/personalized-employee/rules/project_rules.md`
  - `fraim/personalized-employee/learnings/manohar.madhira@outlook.com-mistake-patterns.md`
- Branch: `feature/404-reword-rule-26-...`
- Diff stat: 2 files changed, +8 / -6 lines

### Threat Surface Summary

| Surface | Evidence |
|---------|----------|
| `capability-authoring` | `rules/project_rules.md` matches the `**/rules/**/*.md` glob; `learnings/...mistake-patterns.md` matches the `**/personalized-employee/learnings/**/*.md` glob. |

No `web`, `api`, `llm-app`, `data-pipeline`, `mobile`, or pure-`docs-only` surface present.

### Coverage Matrix

| Check | Applies to | Status | Notes |
|-------|------------|--------|-------|
| R1 — explicit injection framing | Skills/Jobs reading external content | N/A | No skill/job content in diff. |
| R2 — write-action user approval | Skills/Jobs authorizing writes | N/A | No skill/job content in diff. |
| R3 — volume cap on artifacts | Skills/Jobs authorizing writes | N/A | No skill/job content in diff. |
| R4 — source attribution required | Skills/Jobs authorizing writes | N/A | No skill/job content in diff. |
| R5 — credential redaction | Skills/Jobs processing external content | N/A | No skill/job content in diff. |
| **R6 — rule weakens existing constraint** | Rules | **Pass** | Diff *strengthens* Rule 26 by extinguishing the literal-misread vector (split-per-phase fabrication). New wording explicitly forbids "one PR per phase". No constraint loosened, no tool allowlist widened, no instruction-hierarchy downgrade. |
| **R7 — new rule grants broad capability without compensating control** | Rules | **Pass** | No new rule added. The "How to read Rule 26" companion paragraph is prose clarification of the existing rule, not a new agent capability. |
| **R8 — injection tokens in learnings** | Learnings | **Pass** | The reworded line 32 of `mistake-patterns.md` contains none of the flagged tokens (`<system>`, `[SYSTEM]`, "ignore prior instructions", "IMPORTANT: you must", "disregard previous", first-person imperative directives). |
| **R9 — citation traceability** | Learnings | **Pass** | The reworded line cites Rule 26 in `project_rules.md` (in-tree, traceable). |
| R10 — injection tokens in templates | Templates | N/A | No template files in diff. |
| Secrets-in-code | All non-docs surfaces | N/A | Surface = `capability-authoring`; per the skill, secrets check is loaded only for "every non-`docs-only`" — capability-authoring counts. Manual re-grep of diff confirms no API keys, tokens, passwords, or credential-shaped strings. |
| Privacy / PII | All non-docs surfaces | N/A | Diff contains no personal data, email addresses (the filename `manohar.madhira@outlook.com-mistake-patterns.md` is the user's own personalized-learning file, not third-party PII), or identifiers. |

### Findings

None.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- Manual re-read of Rule 26 (lines 195–230) post-edit — semantic check that the reworded rule preserves intent and tightens the misread vector.
- `git diff` review — confirmed only the 5 targeted spots in `project_rules.md` and the 1 targeted spot in `mistake-patterns.md` changed.
- `rg "one PR per phase artifact|per-phase-artifact PR|PR per phase artifact" fraim/` — zero matches, confirming extinction of the misread phrasings.
- `git status --short` post-edit:
  ```
   M fraim/personalized-employee/learnings/manohar.madhira@outlook.com-mistake-patterns.md
   M fraim/personalized-employee/rules/project_rules.md
  ?? docs/evidence/404-implement-work-list.md
  ```
  Only intended modifications.

### Applied Fixes and Filed Work Items

None (no findings).

### Accepted / Deferred / Blocked

None.

### Compliance Control Mapping

N/A — no active compliance regulation flagged for this issue.

### Run Metadata

- **Run date**: 2026-05-17
- **Commit SHA at scan**: (pre-commit; diff inspected directly)
- **Skill errors**: None.
- **Caps hit**: None.
- **Environment**: Isolated worktree `C:/Github/mathursrus/CustomerEQ - Issue 404` on branch `feature/404-reword-rule-26-...`. FRAIM session `07c34c67-90da-47d5-b017-7251ea0bbe0a`.
- **Reviewer note**: This is a self-correcting wording fix to a rule that was itself authored to prevent a fabrication pattern (Rule 26). The skill's R6 check explicitly looks for "loosening" — the diff does the opposite by adding belt-and-suspenders prose ("**How to read Rule 26**") to close the misread vector. Rated **Pass with high confidence**.

---

## Phase 5 — implement-completeness-review

### Source of truth

No separate feature spec or RFC for #404 — this is a documentation rewording issue. The **issue body** is the source of truth for commitments. Acceptance criteria copied verbatim below.

### Feature Requirement Traceability Matrix

| Requirement / Acceptance Criteria | Implemented File / Function | Proof (validation method) | Status |
|---|---|---|---|
| **AC1**: Rule 26 reworded so the four ambiguous phrasings (lines 197, 203, 221, 227 as of `48b34a8`) read unambiguously as "one PR per issue; all phase artifacts ship as commits on that PR's branch." | `fraim/personalized-employee/rules/project_rules.md` lines 195 (heading), 197 (intro), 203 (load-bearing bullet), 223 (cadence ref), 229 (priority-order default) | `rg "one PR per phase artifact\|per-phase-artifact PR\|PR per phase artifact" fraim/` → zero matches. Manual re-read of lines 195–230 confirms unambiguous wording. | **Met** |
| **AC2**: Sweep — every other doc / skill / rule that references the per-phase-artifact PR cadence is checked and reworded if it carries the drift. | Sweep performed in scoping phase; documented in `docs/evidence/404-implement-work-list.md` "Sweep — confirmed in-scope after triage" table. In-scope correction: `mistake-patterns.md` line 32. All other matches triaged as describing the *failure* (retros, mistake-pattern title) or as off-repo pointers (auto-memory name) — out-of-scope with rationale. | Work-list table at lines 33–44; `mistake-patterns.md:32` re-grep shows the corrected phrasing post-edit. | **Met** |
| **AC3**: Corrected wording verified against the #379 design session (the user has memory of the design diverging from the merged text — verify by reading #379's PR / spec / RFC if archived). | Verified during scoping: read PR #380 body (the merge PR for #379). Confirmed the design prose described the correct invariant — *"every phase artifact within a single issue rides on one branch + one PR"* — but the merged rule text drifted to "one PR per phase artifact". The corrected wording in this PR restores the original design intent. | Recorded in `docs/evidence/404-implement-work-list.md` Context section (paragraph 1). | **Met** |
| **AC4**: A short "How to read Rule 26" companion section may help — a literal "one issue → one branch → one PR → many commits" diagram in prose. | New paragraph inserted at `project_rules.md` line 205: *"**How to read Rule 26.** The unit of shipping is the **issue**, not the phase ..."* | Direct read of new paragraph; verifies "one issue → one branch → one PR" topology stated in prose. | **Met** |

### Technical Design Traceability Matrix

| Material Architectural Decision / Constraint / Named Callout | Implementation | Proof | Status |
|---|---|---|---|
| (No RFC / technical design for this issue.) | n/a — documentation-only rule rewording; no architectural surface. | Issue body explicitly scopes the change: *"Scope is the rule wording — not the underlying behavior."* | **N/A** |

**Alternate design source of truth declared**: The issue body itself, treated as both feature-requirement source and design source for this documentation-only change.

### Feedback verification

`docs/evidence/404-feature-implementation-feedback.md`: **does not exist** — no human or quality-check feedback rounds have been opened against this implementation (the PR has not been submitted yet). Per `feedback-completeness-verification` skill step 1: "If file doesn't exist, return `allFeedbackAddressed: true` (no feedback to address)."

`allFeedbackAddressed`: **true** (vacuously)
`unaddressedItems`: []
`totalFeedbackItems`: 0

### Standing Work List validation cross-check

Work list `Validation Requirements`:
- `uiValidationRequired: false` — **N/A confirmed** (no UI surface).
- `mobileValidationRequired: false` — **N/A confirmed** (no mobile surface).
- Validation method: re-grep + read-through — **executed** (recorded in Phase 4 above).
- Test surface: none — **executed** as zero-test (recorded in Phase 2 above) with rationale per CLAUDE.md.

### Blocking conditions

- Feature-requirement Traceability Matrix: no `Partial` / `Unmet` rows. **Pass.**
- Technical-design Traceability Matrix: explicitly N/A with declared alternate source. **Pass.**
- Named design callouts: none in scope. **Pass.**
- Feedback: zero items, vacuous pass. **Pass.**
- Standing Work List validation types: all executed or N/A with rationale. **Pass.**

**Completeness review verdict**: **Pass.**
