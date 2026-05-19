# Sprint Plan — CustomerEQ CI/CD Improvements — 2026-05-14

## Sprint Goal

Reduce CI wall time and close the most visible pipeline gaps by landing four targeted changes to `.github/workflows/ci.yml`. Gap-coverage items are filed under the same epic and parked for a dedicated follow-up round.

## Capacity and Assumptions

| Item | Value |
|------|-------|
| Owner | swavak@gmail.com |
| Deadline | None (backlog; pick up as available) |
| Team size | Solo |
| Branching model | One issue per branch per R10/R21 |
| Risk assumption | Turbo Cloud account or self-hosted remote cache required before item A can land |

## Candidate Backlog — WSJF Scores

Scale: BV / TC / RR on 1–13 Fibonacci. WSJF = (BV + TC + RR) / Size.

| ID | Item | BV | TC | RR | Size | WSJF | Bucket |
|----|------|----|----|----|------|------|--------|
| D | Doc-only CI skip (main `ci` job) | 4 | 3 | 2 | 1 | 9.0 | ✅ Done 2026-05-19 |
| E | Move `pnpm audit` to weekly schedule | 3 | 2 | 3 | 1 | 8.0 | ✅ Done 2026-05-19 |
| A | Enable Turbo remote cache | 8 | 6 | 5 | 2 | 9.5 | ✅ Done 2026-05-18 |
| C | Split `lint` into parallel job | 5 | 4 | 3 | 2 | 6.0 | ✅ Done 2026-05-19 |
| G | Codecov coverage threshold | 5 | 3 | 6 | 1 | 14.0 | Parked — gap round |
| B | Add `test:integration` to CI gate | 9 | 7 | 9 | 3 | 8.3 | Parked — gap round |
| J | Move BAML LLM evals out of smoke path | 6 | 5 | 4 | 2 | 7.5 | ✅ Done 2026-05-19 (combined with I — #428) |
| I | Nightly `test:baml` scheduled job | 5 | 3 | 5 | 5 | 2.6 | ✅ Done 2026-05-19 (combined with J — #428) |
| F | Parallel Docker builds (matrix) | 5 | 3 | 3 | 5 | 2.2 | Parked — gap round |
| H | Nightly E2E job | 8 | 4 | 8 | 13 | 1.5 | Parked — gap round |

**WSJF overrides documented:**
- G (14.0) and B (8.3) score above some committed items. Both parked by strategic decision: gap items addressed in a dedicated follow-up round, not interleaved with speed wins.
- G is a pull-forward candidate (separate file, ~10 lines, no `ci.yml` conflict) if the gap round starts soon.

## Committed Scope

Sequenced by dependency and size. All four touch `.github/workflows/ci.yml` — implement on four separate branches per R10/R21, fast-followed.

| # | ID | GitHub Issue | Sequence rationale |
|---|----|--------------|--------------------|
| 1 | D | `ci: skip main CI job on doc-only commits` | Isolated `paths-filter` block; no other file touched; easiest to verify |
| 2 | E | `ci: move pnpm audit to weekly scheduled workflow` | Removes one step from `ci.yml`; adds new `security-audit.yml`; independent of A/C |
| 3 | A | `ci: enable Turbo remote cache` | Needs `TURBO_TOKEN`/`TURBO_TEAM` secrets; `turbo.json` + `ci.yml` env vars; biggest speed win |
| 4 | C | `ci: split lint into its own parallel job` | Restructures `ci` job topology; best done after A/E reduce job complexity |

**Completion signal per item:** CI green on a PR that only touches the described files; no regression to existing gates.

## Parked / Not-in-Sprint

Filed under the epic with label `status: future`. Ranked by WSJF within the parked set.

| ID | Item | WSJF | Blocking condition |
|----|------|------|--------------------|
| G | Codecov coverage threshold | 14.0 | — (trivial; pull forward if gap round starts) |
| B | `test:integration` in CI gate | 8.3 | — (DB already available in CI; needs step + config) |
| J | Move BAML LLM evals out of smoke path | 7.5 | BAML evals currently block every CI run (~LLM RTT × 11 tests). Moving them to a dedicated optional/nightly job restores the ~33% wall-time saving that Turbo remote cache was expected to deliver but couldn't because tests dominate. Discovered 2026-05-18 during warm-cache measurement. |
| I | Nightly `test:baml` scheduled job | 2.6 | `OPENAI_API_KEY` secret + spending cap policy |
| F | Parallel Docker builds (matrix) | 2.2 | Medium refactor; validate cache coherence |
| H | Nightly E2E job | 1.5 | High complexity; requires full stack + auth in CI |

## Dependency and RAID Notes

| Type | Item | Owner | Status |
|------|------|-------|--------|
| **Risk** | Item A requires Turbo Cloud account (`TURBO_TOKEN` + `TURBO_TEAM`). Without secrets, Turbo degrades gracefully (no-op, no CI failure) but cache won't work. | swavak | Verify before implementing A |
| **Assumption** | GitHub Actions secret permissions are available to add `TURBO_TOKEN` on the repo | swavak | Confirm before A |
| **Decision** | Gap items (B, G, H, I, F) parked despite high WSJF — strategic choice to separate speed-win and coverage-gap rounds | swavak | Documented |
| **Decision** | A, C, D, E all touch `ci.yml` — four separate branches per R10/R21; fast-followed acceptable | swavak | — |

## Cost of Delay for Deferred Items

- **B (test:integration):** Every PR merged without running integration tests carries silent regression risk. The CI step is named "Unit & Integration Tests" but only runs unit tests — the gap is invisible to reviewers.
- **G (Codecov threshold):** Coverage can drop to 0% with no CI failure. Low cost to add but no urgency gate.
- **H (Nightly E2E):** Rule R9 requires E2E for P0 features; no E2E run in CI means P0 coverage is only verified locally.
