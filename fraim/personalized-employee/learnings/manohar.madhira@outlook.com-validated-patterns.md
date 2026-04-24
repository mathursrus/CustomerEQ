# Validated Patterns — manohar.madhira@outlook.com

Durable judgment calls and successful unusual-but-correct decisions worth reproducing.

---

## ⏳ Pending Review — 2026-04-24

### Proposed new entries

#### [P-HIGH] User pushback "Have you tested these?" caught a near-miss of an unvalidated UI fix

**Score**: 8.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: (pending)

On issue #153, the agent was ready to submit a React state-sync fix based on typecheck + build + smoke-test passing — none of which can validate a UI state sync. The user's single-line pushback forced full local env setup (Postgres, Prisma migrations, brand seeding, Clerk auth, org ID mapping) and Playwright validation, which then confirmed the fix worked for both Programs and Campaigns. Validated principle: compile-time checks and unit tests do not validate user-facing React state behavior; browser testing is mandatory for any UI bug. This principle prevented shipping an unvalidated fix that could have broken both workflows.

---

#### [P-HIGH] Caught `github.sha` / `head_sha` trap by re-reading GitHub Actions docs before submit

**Score**: 8.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

On issue #166, the initial deploy.yml edit would have used `${{ github.sha }}` throughout. Re-reading GitHub Actions `workflow_run` semantics once before committing surfaced that `github.sha` resolves to the default-branch tip at dispatch time, not the CI-tested commit. Switched to `${{ github.event.workflow_run.head_sha || github.sha }}` for all 7 SHA references. Validated principle: for workflow YAML with non-obvious trigger semantics (`workflow_run`, `pull_request_target`, `schedule`), budget one documentation re-read before committing. Cost: ~5 minutes; alternative cost (wrong-commit deploy tag): hours of prod debugging.

---

#### [P-HIGH] FRAIM-first + don't-ask-baseline-dev-env feedback memories fired correctly

**Score**: 8.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

On issue #166, two existing memories — `feedback_fraim_before_plan_mode` and `feedback_dont_ask_about_baseline_dev_env` — triggered at the right moments: went straight into the FRAIM `feature-implementation` job without plan mode, and silently recovered from a workspace-deps issue (ran `pnpm install` + workspace build) instead of asking the user to verify their dev env. Validated principle: memory retrieval is working for this user; the two existing feedback memories reliably prevent the specific detours they describe. Continue investing in that channel — it produces measurable efficiency gains.

---

#### [P-HIGH] Traceability matrix caught Member.currentTierId gap that pure design review missed

**Score**: 8.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: (pending)

During design-completeness-review for issue #2, the requirements traceability matrix surfaced that "tier removal blocked if members in tier" had no implementation path — the `Member` model had no `currentTierId` field. A pure design-review narrative would not have caught this; the structured requirement-to-implementation mapping did. Validated principle: traceability matrices are not redundant with design review; they catch a specific class of gap (AC → schema field coverage) that prose review misses. Treat the matrix as a mandatory artifact for any design-completeness-review phase with >10 requirements.

---

#### [P-MED] Caught `package-lock.json` pollution via `git status` pre-stage check

**Score**: 5.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

On issue #166, `~/.fraim/scripts/prep-issue.sh` ran `npm install` and modified `package-lock.json` with 221 lines of unrelated churn. A quick `git status` before staging surfaced the pollution; `git checkout -- package-lock.json` cleaned it, then staged only the three intentional files. Validated principle: always run `git status` — never `git add -A` or `git add .` — immediately before staging, regardless of how confident you are in what the diff contains. Prep scripts and tooling routinely modify files you don't expect.

---

#### [P-MED] Rule #15 applied in reverse on #153 — kept per-component fix when it was the correct level

**Score**: 5.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: (pending)

Rule #15 ("fix at the right abstraction level") is usually applied to promote up — 7 per-file edits become one global rule. On issue #153, the rule was applied in reverse: evaluated whether four per-component state-sync fixes should be extracted to a shared hook, concluded no (each component uses a different state-management pattern — `useReducer` for ProgramWizard, `useState` for CampaignForm), per-component was the right level. Validated principle: "right abstraction level" is not always "highest" — sometimes it's "stay at the level where the variance actually lives." Always ask in both directions.

---

#### [P-MED] Rule #15 applied on #166 — rejected YAML anchors; 7x inlining was the right level

**Score**: 5.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

On issue #166, the `head_sha || github.sha` expression appears 7 times in `deploy.yml`. A YAML anchor would reduce repetition but GitHub Actions does not fully support YAML anchors, and inlining 7x in a 100-line file is readable. Validated principle: abstractions have a readability cost; when the tool/platform doesn't support the abstraction cleanly or the ceremony exceeds the saving, inlining is correct. Rule #15 is about the *right* level, not the *smallest*.

---

#### [P-MED] Bundling related issues in the same component tree was efficient (#133/#134 with #153)

**Score**: 5.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: (pending)

On issue #153, two related minor bugs (#133 step label, #134 hardcoded eligibleTiers) lived in the same component tree as the primary state-sync fix. Bundling all three into one PR was efficient because the files overlapped, the browser validation covered all three at once, and the rework cost if bundled wrong was low. Validated principle: bundle when (a) files overlap, (b) a single validation pass covers all fixes, (c) the bundle is still cleanly reviewable, and (d) the issues share a natural root cause or component. Do NOT bundle to save PR count — bundle when the validation and review are genuinely shared.

---

#### [P-MED] Filing a backlog issue proactively for deferred Phase 2 work

**Score**: 5.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: (pending)

On issue #2, the reviewer decided to keep shared UI components in `apps/web` for Phase 1 and migrate to `packages/ui` later. Rather than leave this as a comment in the RFC, filed backlog issue #34 immediately so the decision survived beyond the review thread. Validated principle: whenever a design review defers a decision to a future phase, create the corresponding tracking artifact (GitHub issue, ADR-future, roadmap entry) at decision time, not "when we get there." Deferrals without trackers decay into lost context.
