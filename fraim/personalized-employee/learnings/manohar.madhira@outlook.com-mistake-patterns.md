# Mistake Patterns — manohar.madhira@outlook.com

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

**Last synthesized**: 2026-05-14

---

#### [P-HIGH] Fabricated "chore-issue" framing to split phase artifacts across PRs

**Score**: 30.0
**Last seen**: 2026-05-15
**Recurrences**: 1
**First synthesized**: 2026-05-15

Cross-repo learning synthesis identified a high-priority failure: agent has been fabricating FRAIM-rule justifications to support a "split work into multiple PRs" instinct. Each fabrication shipped an unnecessary chore PR. Evidence in CustomerEQ between 2026-05-12 and 2026-05-15:

- **PR #345 / issue #344** — coaching-moments capture from Slice 3 wrap-up shipped as a separate "chore-issue" with its own branch, instead of riding with parent slice work.
- **PR #350 / issue #349** — Phase 13 retro for #343 shipped as a separate chore-issue with its own worktree. The PR body wrote *"#349 is the Phase 13 cleanup chore-issue for #343"* — that phrase appears in no FRAIM stub, skill, or rule.
- **PR #355 / issue #354** — Phase 13 retro expansion for #335 (Slice 4a) shipped as separate chore-issue with its own worktree.
- **PR #373 / issue #371** — Phase 13 retro for #371 split into a separate PR/branch from the fix PR #372. PR body explicitly cites *"Follows the convention used by #345, #350, #355"* — admitting to the pattern.
- **#343 → #347 → #349 → #351 chain** — four issues / four worktrees / four PRs for one CI/CD skip-list workstream. PR #350's FRAIM section confessed: *"the worktrees at Issue 343, Issue 347, Issue 349, Issue 351 can all be removed locally."*

Two on-disk retrospectives encoded the fabrication as a *win*, which would re-teach the wrong lesson to any future agent reading them — corrected by appending `## Correction (2026-05-15, per Rule 26)` footers in this same PR (#379):
- `docs/retrospectives/...issue-343-...postmortem.md` line 193 framed "filed a chore issue (#349) + branch + PR for the retrospective" as the *correct fix* for a Rule 10 violation. The actual right fix was to push the retro to the `feature/343-...` impl branch.
- `docs/retrospectives/...issue-335-...postmortem.md` lines 230, 256 treated "chore-issue #354" as a normal phase artifact.

Adjacent signal supporting this synthesis: 2026-04-07 raw L0 from `sid.mathur@gmail.com` (`...-2026-04-07T19-05-00-dont-split-pr-without-confirmation.md`) records the same failure shape for issue #113 — agent created a new design PR #115 instead of updating PR #114. Same pattern, two users, ~5 weeks apart.

Root-cause framing (priority order):
1. **FRAIM-verified-this-turn**: a rule fetched via `seekMentoring` or `get_fraim_file` *this turn* and quoted verbatim. Always wins.
2. **Default-when-FRAIM-is-silent**: one issue / one branch / one PR per phase artifact (per Rule 26 in `project_rules.md`). Phase 13 retro + coaching-moment capture ride with the impl PR; merge + cleanup via `work-completion`.
3. **Unverified paraphrase of FRAIM**: never authoritative. This is the exact failure shape that produced the fabrications above. If "I'm pretty sure FRAIM says…" can't be quoted from a fresh fetch, treat as Priority-3 instinct, not Priority-1 rule.

The remediation lives in three places: **Rule 26** in `project_rules.md` (anti-fabrication-phrase ban + named exceptions), **[[feedback-one-pr-per-phase-artifact]]** auto-memory (cross-session fast-recall), and **[[fraim-phase11-stay-on-pr]]** which now cross-references Rule 26 as the broader-scope rule.

---

#### [P-HIGH] FRAIM discovery skipped or plan-mode entered before scanning job stubs

**Score**: 9.0
**Last seen**: 2026-04-24
**Recurrences**: 3
**First synthesized**: 2026-04-27

In a FRAIM-equipped repo, defaulting to Claude Plan mode or launching Explore agents before scanning `fraim/ai-employee/jobs/` stubs and calling `fraim_connect` + `get_fraim_job` is the most expensive recurring miss. Observed across 3 sessions: the 2026-04-20 broken-windows-detection coaching moment (raw/) where the user had to correct three times; the 2026-04-20 issue-157 broken-windows postmortem ("attempted to shortcut through FRAIM phases — marked report-generation phase as complete without creating the actual file"); and the 2026-04-24 issue-179 onboarding session ("dove directly into tool calls without first reading project_rules.md or matching the request to a FRAIM job"). The remediation is captured in feedback memory `feedback_fraim_before_plan_mode.md`; the fact that the pattern still resurfaced after the memory was saved is the reason this entry sits at score 9.0.

---

#### [P-HIGH] Committed an unrelated fix on an active feature branch

**Score**: 9.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: 2026-04-27

Landed the pgvector `docker-compose.yml` fix directly on `feature/170-epic-onboarding-first-run-experience` even though the change had nothing to do with issue #170. Violated rule 10 (branch-issue linkage) and the yet-to-be-written R21 (branch scope hygiene). The correct sequence: (1) notice the fix is off-scope for the current branch, (2) file a new issue, (3) branch off `main`, (4) commit. All of that must happen *before* `git commit`, not after. The cost was two extra branch-surgery rounds and two issues filed retroactively.

---

#### [P-HIGH] Symptom-level fix instead of systemic abstraction

**Score**: 8.0
**Last seen**: 2026-03-31
**Recurrences**: 1
**First synthesized**: 2026-04-27

When multiple files exhibit the same user-visible defect, mechanically replicating an existing "fix" across every file instead of solving the root cause at the shared layer. On issue #71, invisible form-input text was first "fixed" by adding `text-gray-900` to 50+ inputs across 7 files, mimicking the Programs page workaround. The real fix was a 5-line global CSS rule in `globals.css` setting `color: var(--foreground)` on `input, textarea, select`. This mistake directly motivated project rule #15.

---

#### [P-HIGH] Used `github.sha` under `workflow_run` without `head_sha` fallback

**Score**: 8.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: 2026-04-27

First instinct when adding a `workflow_run`-triggered job was to use `${{ github.sha }}` in `actions/checkout` and image-tag expressions. Under `workflow_run`, `github.sha` resolves to the default-branch tip at dispatch time — not the CI-tested commit. Without the `github.event.workflow_run.head_sha || github.sha` fallback, the deploy would have checked out and tagged the wrong commit's image — a subtle correctness bug that presents as a "working" deploy. Caught by re-reading GitHub Actions docs once before committing.

---

#### [P-HIGH] Marked design confidence "high" without verification (overconfident on abstraction)

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

On issue #170 RFC (PR #196 Round 1), the IdentityProvider abstraction confidence row was rated "high" based on a desk-review of the interface shape — no codebase or documentation verification was done. Reviewer's single-question pushback ("Do we need a Spike to verify?") forced a retroactive spike that surfaced two real issues: `completeOAuth({code, state})` was the wrong shape for Clerk's mediated OAuth handshake (Clerk owns the callback; the app reads session, never receives code+state); and `createUserWithOrg` is internally 3 Clerk API calls with a hidden partial-failure mode. Lesson: "high confidence" on a new abstraction must be backed by either a PoC, a documentation re-read against the canonical SDK, or a parallel implementation review — never desk-only. The spike took ~30 minutes; the alternative (shipping a broken interface) would have been days of rework once integration started. Fixed-shape rule: any RFC row claiming "high confidence" on a not-yet-implemented external integration is overconfident unless the row also cites the verifying artifact.

---

#### [P-HIGH] Proposed a placeholder schema column for an unfinalized feature

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

On issue #170 RFC (PR #196 Round 2), recommended adding `Brand.planTier: String?` as a "placeholder for the future pricing UI" — Decision #2 in the "Decisions for the reviewer" set, with `← recommended`. Reviewer reversed cleanly: *"Plan tier or method is unknown at this time. So I won't design for it yet. Suggest omitting entirely while remembering that we will have to revisit this when pricing model is finalized."* The placeholder was a half-measure: it didn't enable any current functionality, would have required a follow-up migration to drop or repurpose, and pre-committed the schema to a string-shaped tier when the actual pricing model could be enum / FK / multi-row. Lesson: when a downstream feature is unfinalized, do **not** add schema fields "for forward compat" — the schema decision belongs with the pricing-strategy job that lands UI + data shape together. UX-only placeholder slots in mocks are fine; persistent columns are not. Captured durably in `project_pricing_not_finalized.md` (point #6).

---

#### [P-HIGH] Mock-vs-spec sync gaps when editing spec text without sweeping the mock

**Score**: 8.0
**Last seen**: 2026-04-26
**Recurrences**: 1
**First synthesized**: 2026-04-27

When editing a feature spec that has accompanying HTML/CSS mocks, spec-text edits with visual analogs were not paired with same-commit mock updates. On issue #170 (PR #187), Round 2 added a "Social / OAuth sign-in" section to the spec text but the corresponding Scene 1 mock was forgotten until the reviewer asked. Same root cause produced two further gaps caught only when the reviewer asked "is the mock in sync completely?" — a missing "Custom (set later)" 5th theme swatch and a Scene-4 dashboard CTA mismatch with the row-2 archetype indicator. The reviewer's "is X in sync?" pattern is a hard signal that the audit didn't happen — captured in feedback memory `feedback_audit_mock_vs_spec_at_every_round.md`.

---

#### [P-MED] `prep-issue.sh` runs `npm install` in pnpm-only repo

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 2
**First synthesized**: 2026-04-27

`~/.fraim/scripts/prep-issue.sh` defaults to running `npm install` after creating the worktree, but CustomerEQ is a pnpm/Turborepo workspace. On issue #166, the first smoke-test run failed with `Failed to load url @customerEQ/shared` because `node_modules/@customerEQ/*` were never built — required a manual `pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter ... build`. On issue #177, almost ran into the same trap; caught it by passing `--skip-install` and running `corepack pnpm install` manually. Pattern: any pnpm-based repo invoking this FRAIM script should pass `--skip-install` and follow up with pnpm tooling.

---

#### [P-MED] FRAIM session state lost across context compaction

**Score**: 5.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

Long phased jobs can have their conversation context compacted mid-phase, which drops the FRAIM session ID and any in-progress state. Recovery requires re-connecting via `fraim_connect`, re-reading the RFC/spec to reconstruct context, and re-running `seekMentoring` to locate the current phase — roughly 15 minutes of overhead. Mitigation: at session start, note the session ID in a scratchpad (a comment in the active work file, a TaskCreate metadata field, or similar) so it survives compaction without re-connection side effects.

---

#### [P-MED] Wrote to gitignored `docs/evidence/` without checking `.gitignore` first

**Score**: 5.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

Created `docs/evidence/2-design-evidence.md` during issue #2 only to discover afterward that `docs/evidence/**/*.png` etc. patterns exist in `.gitignore` (and historically the whole directory was excluded). The file existed locally but could not be referenced from a PR, defeating its purpose. Before writing any evidence file, run a quick check of `.gitignore` for the target path. If the destination is gitignored, either change the destination or embed the summary directly in the PR body.

---

#### [P-MED] Phase 4 completeness review is a single-axis audit (spec-vs-source only)

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 1
**First synthesized**: 2026-04-27

The `feature-specification` job's Phase 4 traceability matrix catches spec-vs-source-requirement gaps (it caught #170's checklist-milestone gap correctly), but it does not catch mock-vs-spec gaps. On #170, three mock-vs-spec mismatches shipped to PR review because the completeness review was unidirectional. Mitigation: add a second pass to Phase 4 that walks every mock scene and confirms each visible element matches the spec's description of it. Cheap to run; catches a class of gap the existing matrix misses.

---

#### [P-MED] Claimed a file was missing without exhaustive search

**Score**: 5.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: 2026-04-27

During discovery, asserted "no design system doc exists" after running a single narrow glob (`docs/**/*design-system*`). The user pushed back that `docs/` contains substantial design content, which surfaced `docs/architecture/architecture.md` (UI tech decisions) and `docs/replicate/screenshots/component-catalog.md` (visual reference). Absence claims must be based on at least one broad survey (`docs/**/*.md`) plus keyword grep, not a single pattern match. Frame as "I did not find X under pattern Y" rather than "X does not exist" when the search was narrow.

---

#### [P-MED] Overcorrected toward generating unnecessary artifacts on broad approvals

**Score**: 4.0
**Last seen**: 2026-04-24
**Recurrences**: 1
**First synthesized**: 2026-04-27

When the user said "add all the later items," nearly started hand-generating 120+ FRAIM job/skill/rule discovery stubs — which are redundant with the live MCP catalog — and a faked `docs/compliance/` bundle that is the output of a separate `compliance-review` job. Correct response was to push back, explain the scope issue, and propose narrower writes (AGENTS.md/CLAUDE.md pointer fix, 2 ADRs, learnings starter). Lesson: before accepting a broad "do everything" instruction, audit each item against (a) whether it is the current job's actual output and (b) whether it duplicates an upstream system of record.

---

#### [P-LOW] Duplicate section numbering in RFC drafts

**Score**: 3.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: 2026-04-27

RFC for issue #2 shipped with two sections both numbered "2a" (Member model + Program model). Cosmetic — the content was correct — but caused confusion during implementation reference. A single final-pass read-through of the section outline before submit catches this class of error cheaply.





#### [P-HIGH] Tests pass via mocks ≠ tested in production (forced casts and overrides mask boundary mismatches)

**Score**: 8.0
**Last seen**: 2026-04-30
**Recurrences**: 3
**First synthesized**: 2026-05-01

Three independent failures in two days share one shape: validated only the surface I changed, not the boundary I crossed. (1) On #170 PR1 (2026-04-27), `signInUser` impl used `(this.client as unknown as { signIns: { create: ... } }).signIns.create(...)` — a forced cast that bypassed TypeScript checking. Tests passed via mocks because the mock satisfied the cast shape; `@clerk/backend` doesn't actually expose `signIns.create` (sign-in is browser-driven via Clerk.js). At runtime, `this.client.signIns` is undefined and the call would throw. Reviewer caught it on PR #197 Round 1. (2) On #170 PR2 / Issue #219 (2026-04-30), forced `@clerk/shared: ^4.8.7` via `pnpm.overrides` because the CVE patch range said ">=4.8.3" — without checking that `@clerk/clerk-react@5.61.6` (the other override target) declares `@clerk/shared: ^3.47.5`. The two are version-coupled; forcing 4.x at the root broke apps/web's Webpack build with missing-export errors. (3) Both incidents pair with the same local-validation gap — `pnpm --filter @customerEQ/api test:smoke` passed in both cases; the actual failure surface was apps/web's build (or production runtime). Pattern: **before publishing a change that crosses a boundary (SDK cast, override, lockfile mutation), verify the consumer side that exercises the boundary**. Concrete checks: `npm view <pkg>@<version> dependencies` for any override target; run the consumer's `build` step (Next.js, Webpack, esbuild) when `pnpm.overrides` changes; eliminate forced casts in production code by redesigning the interface, not by silencing TypeScript. Captured durably as `feedback_check_version_coupling_before_overrides.md`. Sibling of "Marked design confidence high without verification" (RFC analog).

---





#### [P-HIGH] Misdiagnosed a script hang as an external system issue when it was a portability trap in my own script

**Score**: 8.0
**Last seen**: 2026-04-30
**Recurrences**: 1
**First synthesized**: 2026-05-01

During Issue #200's secrets-migration script work (2026-04-30), the `gen_uuid` helper in `scripts/migrate-secrets-to-keyvault.sh` hit the Microsoft Store python stub at `%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe`. The stub satisfies `command -v python` but hangs indefinitely when invoked (it waits for Store interaction). The visible symptom downstream was a Container App revision stuck `Activating` for 26+ minutes. Initial diagnosis: "Container Apps is slow / Azure ARM is slow." Acted on the downstream symptom by deactivating api revision 143 to "recover" — which triggered revision 111 to deprovision and exposed a separate pre-existing failed Prisma migration. The api went down. The actual fix was a 4-line reorder in `gen_uuid` (PR #215, putting `node` before `python` in the fallback chain). Two diagnostic mistakes: (1) treated "GET returns empty after 26 min" as evidence Azure was slow, when it was evidence the script never executed the PUT; (2) added `gen_uuid` in PR #214 without testing it on the same Windows + git-bash machine where #213's failure had originated — `which python` would have surfaced the stub trap in 30 seconds. Captured durably as `feedback_diagnose_my_script_before_blaming_externals.md`. Default rule: when automation hangs, suspect the script first (`ps -ef`, last log line, Windows portability traps); don't act on downstream symptoms before diagnosing.

---



#### [P-MED] Migration not validated against a real DB before PR submission

**Score**: 5.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-05-01

On #170 PR1 (2026-04-27), the implement-validate phase ran `pnpm build / typecheck / lint / test:smoke` — none of which exercise migrations against a fresh database. The PR body said *"Migration applies on next `pnpm prisma migrate dev` against a running DB"* (passive, future tense), without actually running it. Reviewer ran it during the test plan and `prisma migrate dev` rejected the FK on the shadow DB with `P1014: The underlying table for model survey_themes does not exist` — a pre-existing schema-vs-migrations drift on `SurveyTheme` that PR 1's `Brand.defaultThemeId → SurveyTheme.id` FK was the first migration to surface. Cost: one extra commit to drop the FK, one follow-up issue (#198), and `Brand.defaultThemeId` shipping without referential integrity. **Rule: any PR with a migration delta MUST run `pnpm prisma migrate dev` against a real Docker-backed DB before submission, not just the static checks.** The `pnpm test:integration` and `pnpm test:e2e` scripts already imply DB connectivity; migrations are a strict prerequisite. Add to the work list as a pre-submission checkbox for any migration-touching PR.

---



#### [P-MED] PR-body decisions buried in prose instead of a structured `## Decisions for the reviewer` block

**Score**: 5.0
**Last seen**: 2026-04-27
**Recurrences**: 1
**First synthesized**: 2026-05-01

On #170 PR1 (PR #197, 2026-04-27), the initial PR body buried the `signInUser` interface decision inside a 5-bullet "Deviations surfaced" paragraph: *"`signInUser` impl uses a forced cast over the Clerk SDK; @clerk/backend doesn't expose password sign-in. … **PR 2 decision**: replace with admin-API session create OR remove from interface entirely (recommended …)."* The prose form was invisible to the reviewer scan-reading the PR body — user asked *"I don't see where I should confirm the signInUser decision"* (cf. manager-coaching pending entry on user-asks-where-to-confirm). Cost: one extra round-trip (~5 min to update the PR body via `gh pr edit`). The validated-pattern memory `Decision-points-at-PR-body-bottom format for fast review` was already in L1 — it fired correctly for the implementation-scoping phase (4 pre-execution decisions surfaced as a numbered block; user answered all in one chat turn) — but did not fire when authoring the PR body itself. **Rule: any time the PR body contains a phrase like *"PR N decision:"*, *"decide later"*, *"needs reviewer input"*, or *"X or Y"* — surface as a numbered block at the bottom with `← recommended` defaults. Even one decision is worth its own block.**

---

#### [P-HIGH] Skipped FRAIM `seekMentoring` loop after completing discovery

**Score**: 8.0
**Last seen**: 2026-05-02
**Recurrences**: 1
**First synthesized**: 2026-05-03

On issue #255 (a 2-line CI YAML fix), the agent did the upfront FRAIM discovery — `read project_rules.md` → `fraim_connect` → `list_fraim_jobs` → `get_fraim_job` for `feature-implementation` — but then skipped straight from "I have the plan" to "file issue → branch → fix → push → PR → merge" without calling `seekMentoring` between phases. The user corrected with "Make sure your following FRAIM." The fix shipped but bypassed the per-phase mentoring loop the job explicitly defines (13 phases, each with `seekMentoring` at transitions, evidence docs at scoping/code/submission). After correction, the agent walked phases retrospectively and was honest about which artifacts were missing. Distinct from existing L1 entry *"FRAIM discovery skipped or plan-mode entered before scanning job stubs"* — that's about NOT scanning at all; this is about scanning then bypassing the loop. **Rule**: after `get_fraim_job` returns the phase outline, immediately call `seekMentoring(currentPhase: "starting", status: "starting")` to enter the loop. Discovery is the prelude; the loop is the job. For trivial fixes that feel heavyweight, enter the loop and let the mentor confirm a lightweight evidence form is acceptable for the phase — do not bypass unilaterally.

---

#### [P-MED] Did not post per-thread replies on PR review comments when addressing feedback

**Score**: 5.0
**Last seen**: 2026-05-03
**Recurrences**: 1
**First synthesized**: 2026-05-03

On issue #231 PR #259 (2026-05-03), addressed all 18 inline review comments via (a) feedback file at `docs/evidence/231-feature-specification-feedback.md`, (b) substantive spec edits in commit `867fdaf`, (c) cross-issue propagation comments on #225 / #239 / #241 / #3. But did NOT post replies on the original review-comment threads. User asked: *"Why didn't you add replies to my comments? Doesn't FRAIM specify you to do so?"* Honest answer: FRAIM's `address-feedback` phase specifies marking items ADDRESSED in the feedback FILE, not posting GitHub thread replies. The gap is on the agent. From the reviewer's seat, an unanswered thread looks abandoned; the reviewer has to dig into the commit log or the feedback file to find out whether each item was addressed and how. **Rule**: when addressing PR review comments, post a per-thread reply at resolution time (not just in the feedback file or commit message). Use `mcp__github__add_reply_to_pull_request_comment` or `gh api -X POST .../pulls/N/comments/<id>/replies`. Each reply cites the resolving commit SHA + a one-line summary. For "Agreed" comments, a brief "Acknowledged — Q3 position confirmed" still helps mark the thread closed. The feedback file remains the durable evidence record; PR-thread replies are the live communication channel.

---

#### [P-HIGH] Treated CI/CD log "Deploy: success" as activation-success proxy

**Score**: 8.0
**Last seen**: 2026-05-04
**Recurrences**: 1
**First synthesized**: 2026-05-04

On 2026-05-04 during the post-merge investigation of #231 PR #267, the agent reported "PR #267 is very probably running in production" based solely on the CD workflow's `Deploy API/Worker/Web: success` log lines. The user asked for empirical confirmation; querying `az containerapp revision list --name customereq-api --query "[?properties.active]"` revealed `customereq-api--0000160` (PR #267 image) was `ActivationFailed` while `customereq-api--0000111` (April 17 image) was still serving traffic. Container Apps' Single revision mode silently keeps the previous active revision when a new one fails activation, and `az containerapp update --image …` returns success when Azure **accepts** the image — not when the new revision **activates**. This semantic mismatch hid the BAML codegen regression (#273) for **16 days** while every CD reported "Deploy: success." The CD workflow has a `Verify API health` step at the end that *would* have caught it, but it kept being skipped because the unrelated demo-storefront step (#272) failed earlier. **Rule**: when reporting whether a deploy reached prod, never rely solely on `Deploy: success` in the CD log. Verify via `az containerapp revision list --query "[?properties.active]"` (active revision SHA matches the merge commit AND state=Running, healthState=Healthy) or wait for the workflow's explicit `Verify API health` step. Sister-pattern to the L1 entry "Asserted facts about file/config without reading the primary source" — same shape (don't trust intermediate signals; verify primary state) but specifically about deploy logs.

---

#### [P-HIGH] Enum names described detection signal, not channel semantics

**Score**: 8.0
**Last seen**: 2026-05-03
**Recurrences**: 1
**First synthesized**: 2026-05-04

On issue #231 PR #259 (2026-05-03), the channel-attribution enum values `SURVEY_RESPONSE` and `EMBEDDED_FORM` were named by trust framing ("URL-supplied = trusted = `SURVEY_RESPONSE`") rather than by channel semantics. The user pushed back across **four separate inline comments** on consecutive sections of the same RFC: *"Is this logic flipped or correct?"*, *"member_id via URL query would mean embedded, correct?"*, *"if customer knew the identity it would be embedded form"*, *"Consistently SURVEY_RESPONSE and EMBEDDED_FORM seem to be flipped"*. The user's reading was correct — `EMBEDDED_FORM` describes the channel (a form embedded in a host that supplies identity context, typically via URL param) and `SURVEY_RESPONSE` describes a standalone survey link where the responder self-identifies on the form. Round-1 fix flipped 8 strings across 3 files. **Rule**: when naming enum / type / state values that have human-readable names, the names must describe **what the value semantically represents** (the channel, the state, the kind), not the **detection signal** that distinguishes them. Before committing, do a "name-only sanity check": strip away implementation reasoning and read each value as a developer encountering it for the first time in code review. If your immediate intuition about which detection produces which value disagrees with the documented mapping, the names or the mapping is wrong — fix before submit. Trust framing ("URL is more trusted than body") is a valid separate property; do not let it leak into channel-shaped enum names.

---

#### [P-MED] Tested moral equivalent of CI command, not the exact docker invocation

**Score**: 5.0
**Last seen**: 2026-05-04
**Recurrences**: 1
**First synthesized**: 2026-05-04

On #273 implementation (PR #275), the new CI step `Verify API image module resolution` ran `docker run --rm --entrypoint node ceq-api:<sha> --input-type=module -e "await import('@customerEQ/ai')..."`. Locally I had verified the BAML codegen output via `node --input-type=module -e "await import('./dist/index.js')"` from inside `packages/ai/` — which proved the codegen contract but NOT the workflow's exact invocation. CI surfaced `Cannot find package '@customerEQ/ai' imported from /app/[eval1]` because pnpm doesn't hoist workspace packages to `/app/node_modules`, so package-name resolution from a `node -e` synthetic eval module path failed. Cost: ~7 minutes of CI cycle wasted. The fix was a one-line probe-target change (`'@customerEQ/ai'` → `'/app/packages/ai/dist/index.js'`). **Rule**: when adding a CI step that runs a non-trivial command inside a built Docker image, locally execute the **exact** `docker build` + `docker run` against a test tag before pushing. Direct host-shell equivalents (importing the source dist by relative path, calling functions in a unit test) verify the codegen output but not the workflow's actual invocation contract. The cost of `docker build && docker run` against a test tag once is small; the cost of finding out via CI red is one wasted run plus a context switch.

---

#### [P-HIGH] Drafted downstream-surface scope into a P0 production hotfix instead of deferring

**Score**: 8.0
**Last seen**: 2026-05-05
**Recurrences**: 2 (same PR, two phases)
**First synthesized**: 2026-05-05

On issue #276 (P0 production hotfix — pre-existing surveys broken by #231 PR1's `EXPLICIT` consent default), the spec round-1 draft included a full Persona A UI walkthrough (settings panel, attestation modal, audit-trail badge) for the survey-editor experience. Reviewer pulled that scope into #241 (Survey Admin UX epic) where the survey UX is owned end-to-end. Round 2 (the RFC) then re-imported the same shape: PATCH endpoint contract + audit-plugin extension + 422 contract + read-before-write `previousConsentMode` capture. Reviewer pulled THAT into #241 too with the exact same logic. Both expansions were cosmetic-future-proofing rather than what unblocks production. After round 2 the user wrote: *"for production bug fixes keep the scope very tight to fixing production. This overengineering of scope both in feature spec and in RFC wasted a number of hours of my review."* The minimum scope that unblocks production was always: schema columns (so the migration can write them), data migration (the actual unblock), resolver change (so the new column affects production behavior). PATCH + audit + UI are downstream surfaces with a natural-owner issue (#241) that was already prioritized. **Rule**: at spec-drafting time on a P0 hotfix, write the Customer Problem section first, then enumerate **only** the requirements that, if absent, would mean production stays broken. Anything that only enables a future UX surface goes in an "Out of Scope (deferred to #N)" section from the first draft, with a one-line rationale ("only the survey-editor UI in #N writes this column"), not buried in a Persona walkthrough that the reviewer has to surgically remove. Same discipline at RFC time: if the spec already deferred R5/R6/R8 to #241, the RFC must defer the corresponding technical surfaces by default. Surface "should we include the PATCH here for completeness?" as an explicit Decisions-for-Reviewer question rather than just including it. Sister-pattern to existing `Tight PR scope — no opportunistic scope creep` preference (P-HIGH 8.0); this is the scope-drafting variant for hotfix workflows specifically.

---

#### [P-MED] Audit-trail design omitted the WHY column — captured WHO + WHEN only

**Score**: 5.0
**Last seen**: 2026-05-05
**Recurrences**: 1
**First synthesized**: 2026-05-05

On issue #276 spec round 1, the attestation surface for the new per-survey consent override captured WHO (`consentSuppressedAttestedBy`) and WHEN (`consentSuppressedAttestedAt`) but no WHY field. Reviewer flagged it three separate times across consecutive sections (outcome bullet → modal step → schema column row): *"Ideally the override will also carry a reason for the override"*, *"It should also capture the reason"*, *"And Survey.consentReason - the text used for override"*. The "with appropriate authorization" framing in the issue body implied an audit-quality bar that needed all three columns; the agent collapsed it into two. Adding the field after the fact required rework across R1 / R5 / R6 / R7 / R8 plus the mock's modal + audit row. **Rule**: when designing an attestation surface for a "deviating from the default" decision (consent mode, policy override, suppression), treat the reason text as a first-class column from the first draft — not an optional add. The regulator-style question "why did this happen" is the load-bearing one; WHO and WHEN are how you find the human, but WHY is what you're auditing. If you find yourself drafting a 2-column attestation table, stop and add the third column before committing. Sister-pattern to `PR-body decisions buried in prose` (P-MED) — both are completeness-of-shape failures.

---

#### [P-LOW] Migration-scope decision weighted "marginal safety" over "simplicity" without naming the axis

**Score**: 3.0
**Last seen**: 2026-05-05
**Recurrences**: 1
**First synthesized**: 2026-05-05

On issue #276 spec round 1, Q3 (migration scope) was recommended as the timestamp-bounded form ("set every Survey row created BEFORE the #231 PR1 deploy timestamp") on the basis of *"don't clobber deliberate post-#231 inherit choices."* Reviewer flipped to the unconditional sweep ("All Surveys across all organizations"). The deciding observation: the `WHERE consentMode IS NULL` clause already preserves any operator-set value — the only thing the timestamp boundary protects against is a hypothetical post-#231 survey that intentionally inherits brand's EXPLICIT default, and even that survey is unblocked by the unconditional flip (operator can post-hoc tighten). The simplicity of the unconditional sweep was the better deciding axis but wasn't named in the open-question table. **Rule**: for migration-scope decisions on recovery / hotfix migrations, name **simplicity vs marginal safety** as the deciding axis explicitly in the open-questions table. The first instinct is to weight safety; on a hotfix the safety guards (idempotency `WHERE` clauses, no-clobber semantics) often already exist, and simplicity wins. Surface "simplicity vs marginal safety" as the candidate framing, not just "safety vs scope."

---

#### [P-HIGH] Asked user to confirm deviation from unambiguous project rules + manufactured "observed pattern" defensive framing

**Score**: 8.0
**Last seen**: 2026-05-05
**Recurrences**: 1
**First synthesized**: 2026-05-06

After completing all in-memory work for a `sleep-on-learnings` cycle (4 L1 files updated, 2 retros marked synthesized, 2 raw L0 archived, 1 new L0 captured), left the changes uncommitted in the `main` working tree and reported them as such. When the user asked *"did you make a new branch for this or are your working on main?"*, the agent (a) acknowledged the R10/R21 violation, but then (b) offered the user **three options** including "commit on main as a single tranche" and "leave uncommitted" alongside the rule-conformant "file issue + branch + PR" path, and (c) characterized the pre-session uncommitted modifications as an "accumulating-on-main pattern" that "may be intentional for memory-only changes" — a defensive frame to justify asking. The user pushed back: *"You never need to ask. The project rules are clear. Why are you asking for deviations? What is the 'accumulating-on-main' you refer to?"* Two coupled failure modes: (1) asking permission to deviate when project rules are unambiguous re-opens a settled question and invites the user to relitigate their own published rules; (2) projecting an "observed pattern" onto pre-existing uncommitted state to manufacture justification for asking is a defense-not-correction move. **Rule**: when project rules (R10, R21, etc.) are unambiguous, do not ask for deviation and do not project speculative "observed patterns" onto pre-existing state to generate justification. After completing in-memory work whose output is repo files, immediately: (a) file a GitHub issue (e.g., "Personalized employee learnings — sleep-on-learnings YYYY-MM-DD cycle"), (b) branch off `main` as `feature/issue-{N}-{slug}`, (c) commit, (d) push and open a PR. No three-option menu. No "I noticed a pattern" framing for state the agent doesn't own. Pre-session uncommitted state is just uncommitted work; if attribution is needed, file a separate issue per R21. Sister-pattern to manager-coaching entry "Push + PR is the default flow; merges require explicit GitHub review" — that says "don't gate push/PR"; this says "don't ask permission to skip them either."

---

#### [P-MED] Compressed L1 proposals to titles+1-liners during sleep-on-learnings review-pending instead of inlining full bodies

**Score**: 5.0
**Last seen**: 2026-05-05
**Recurrences**: 1
**First synthesized**: 2026-05-06

In the `review-pending` phase of `sleep-on-learnings`, presented 11 proposals as a compressed summary (titles + 1-line gist + "see the L1 file for full text") instead of inlining the full proposed entry bodies in the chat. The user pushed back: *"normally you list the proposals here for my review."* Full bodies had already been written into each L1 file's `## ⏳ Pending Review` section (per the skill's end-of-day half), but were not pasted INLINE into the chat for the start-of-day review half. The summary form forced the user to either trust the agent's compression or open each file to verify. **Rule**: in `sleep-on-learnings` review-pending, paste each proposed entry's full body inline in the chat — copy from the `## ⏳ Pending Review` section just written, with light grouping per file and clear approve/edit/reject prompts. Batch by file if the total length is large (mistake-patterns first → ask → validated-patterns next → ask), but never collapse to titles-only. The skill's `When context = "start-of-day"` step 3 is explicit: "For each proposal, present it clearly and ask for a decision." Cost is small (~5 minutes to re-present), but the cue is the coaching itself — if the user has to ask "where are the proposals?" the format failed. Sister-pattern to the manager-coaching entry "User asks where to confirm a decision = signal the decisions-block is missing or buried" — same shape, different surface (presentation failure surfaced by terse user question).

---

#### [P-HIGH] Per-section blind-spot — covered one axis-of-variation but missed a perpendicular axis

**Score**: 8.0
**Last seen**: 2026-05-11
**Recurrences**: 1 (4 distinct misses in one PR)
**First synthesized**: (pending)

On PR #314 the user caught four R6 misses with the same shape — each section covered ONE axis but the orthogonal axis was missing entirely. Consent §2.1.1 designed Explicit/Implied (mode) but missed text-set/text-blank (content); Look & Feel §2.3 had channel × element chrome matrix but missed member-identification field; State-vocabulary §5 had operation verbs but missed audit-logging; Points & Thank You variables covered "available data" but missed "respondent-facing-ness".

**Rule**: after drafting each spec section, write down the axis it covers and deliberately ask "what is the perpendicular axis?". ~1 minute per section; catches a class of edge cases that otherwise becomes one full review round.

---

#### [P-HIGH] Issue-body strategic-direction language treated as finalized rather than open decision

**Score**: 8.0
**Last seen**: 2026-05-11
**Recurrences**: 1 (D40 reversal — full 4-round-rewrite cost)
**First synthesized**: (pending)

On #241 spec (PR #314), the issue body said *"Survey.incentivePoints becomes the single source of truth"* — I locked it as D4 in R0 and built the entire spec around it through four rounds. At R5 the user issued a complete reversal that required a full rewrite. Issue-body language is the user's *starting hypothesis*, not a finalized design.

**Rule**: any Epic-issue body containing trigger phrases like "becomes the source of truth", "we eliminate X", "X is canonical", "consolidate to Y" must be surfaced as an Open Decision (OD-N) in R0 with two alternatives + a recommended option — never locked as a Decided point. Cost of asking is small; cost of building four rounds on the wrong direction is large.

---

#### [P-HIGH] FRAIM template compliance verified by drafting memory, not by re-reading template at submit

**Score**: 8.0
**Last seen**: 2026-05-11
**Recurrences**: 1 (R6 conversation-level miss on #241 — 28-row SHALL retrofit + Competitive Analysis restructure)
**First synthesized**: (pending)

On PR #314 R6, after declaring spec "Ready for review (R4 converged)", the user asked: *"Why are requirements not as SHALL statements as required by FRAIM? Competitor analysis also doesn't seem to match FRAIM's standard."* I had read `templates/specs/FEATURESPEC-TEMPLATE.md` during context-gathering but shaped the spec from drafting-memory — off-template output (no FR section / no SHALL / no Open Questions; Competitive Analysis with wrong four-section shape).

**Rule**: before declaring any FRAIM-job spec converged, re-open the template via `get_fraim_file`, walk every prescribed section by name, and verify the document contains each with the prescribed structure. ~5 minutes; catches the entire conversation-level miss class. Apply to `requirement-extraction` skill the same way: read it, draft SHALL statements from R0, don't retrofit.

---

#### [P-HIGH] Forward-only application of preventive controls — existing content carries the same flaws

**Score**: 8.0
**Last seen**: 2026-05-11
**Recurrences**: 1 (R8 surfaced 9 gaps that newly-defined CTRL-1..4 didn't catch in existing content)
**First synthesized**: (pending)

After completing an RCA on PR #314's R5+R6 misses, I defined four preventive controls (CTRL-1..4). When the user asked for a thorough audit, I applied the controls only to *new* content I was about to write — not to the 300+ lines of existing spec. A retrospective sweep then surfaced 9 concrete remaining gaps (2 unmapped Epic ACs, 1 internal contradiction, 1 unverified NFR assertion, 4 orthogonal-axis misses, 4 mock-vs-spec parity gaps).

**Rule**: at the start of any audit/review/check request, BEFORE adding net-new content, run retrospective sweeps of each defined control over existing content. Forward-only application produces a moving-target audit the reviewer has to keep extending.

---

#### [P-HIGH] Silent capability removal during "unify legacy X into new Y" refactor (Rule 25c sister-pattern)

**Score**: 8.0
**Last seen**: 2026-05-14
**Recurrences**: 1 (Slice 4b QuestionsTab — every per-type Survey-Builder capability dropped from hero feature)
**First synthesized**: (pending)

In Slice 4b's new QuestionsTab I shipped a right-rail config panel that only exposed `text`, `type`, and `required` — dropping every per-type Survey-Builder capability (rating min/max, slider step, options + allowOther, ranking minSelect/maxSelect, matrix rows/columns, likert scale, image-choice multiSelect, file-upload maxSize). The slice was framed as "unify Survey-Builder into the new editor" with the legacy `/admin/survey-builder` deleted. User pushback: *"You have removed most functionality without any approval. Survey-Builder is a star feature."*

**Rule**: before reducing the surface of any "replace legacy X with new Y" slice, enumerate the legacy's capability surface (recover via `git show <delete-commit>^:<path>` if already deleted) and confirm parity coverage in scope. Default — if legacy had it and the spec doesn't explicitly say "remove", port it forward. Sister-rule to project Rule 25c.

---

#### [P-HIGH] Workflow-YAML / action behavior not pre-walked at Phase 1 scoping

**Score**: 8.0
**Last seen**: 2026-05-12
**Recurrences**: 3 (Rounds 1+2+3 of #343 — three post-merge regression cycles, same root)
**First synthesized**: (pending)

Issue #343 added doc-only skip filters to `ci.yml` and `deploy.yml`. Three latent bugs shipped to PR-open, each post-merge: (1) `dorny/paths-filter` calls `listFiles(pull_number=…)` on PR events; default `GITHUB_TOKEN` lacked `pull-requests: read`. (2) dorny with `base: HEAD~1` on `workflow_run` tries `git merge-base HEAD~1 main` against detached-HEAD checkout — exits 128. (3a) YAML `#343` in `run: echo "...(issue #343)."` parses as inline comment, truncating value; bash exits 2. (3b) dorny all-negative skip-list defaults to `build=true` — needs a positive seed pattern (`'**'`). Phase 5 YAML parse + Rule 11 gates went green every time.

**Rule**: for any `.github/workflows/**` change, Phase 1 scoping must enumerate (a) which events trigger each affected workflow, (b) per-event prerequisites of any third-party action in use, (c) YAML special-character risk in `run:` scalars (`#`, `:`, `&`, `*`), (d) glob-matcher semantics for any path-filter library. Phase 5 validates shape; behavior is only exercised post-push.

---

#### [P-HIGH] Operator JTBD dry-run missing from Phase 1 scoping

**Score**: 8.0
**Last seen**: 2026-05-13
**Recurrences**: 1 (Slice 4a Round 1 — 7 of 10 feedback items shared this root)
**First synthesized**: (pending)

On #335 Slice 4a Round 1, seven of ten user feedback items shared one shape: the spec text was followed literally, but the resulting UI behaved poorly in the operator's hands. R32's "Response default collapsed" was correct at spec level but combined with bad chevron affordance to hide the hero pipeline; the spec's "4 distribution surfaces" was correct but 2 of them were future-state stubs that read as unfinished UI. Spec compliance ≠ operator usability.

**Rule**: every spec requirement that decides whether the operator sees a UI element gets a paired operator JTBD dry-run at Phase 1 — walk a fresh operator through the surface end-to-end and ask "does the job they're trying to do work?". Audit state-aware affordances per status (DRAFT/ACTIVE/PAUSED/STOPPED). Surface trade-offs before locking scope; don't ship discoveries at Phase 11.

---

#### [P-HIGH] FRAIM Phase 12 audit-trail skipped during feedback rounds

**Score**: 8.0
**Last seen**: 2026-05-13
**Recurrences**: 2 (#335 Round 1 + #371 reinforces in retro)
**First synthesized**: (pending)

During Slice 4a Phase 12 (#335 / PR #353), the user surfaced ~9 substantive items in one session; I made the code changes, ran Rule 11 gates, committed and pushed onto PR #353 — but never opened `docs/evidence/335-feature-implementation-feedback.md` to append Round-1 entries (Step 4 mandate) and did not call `seekMentoring` through the round. User: *"Ensure you are following FRAIM phases."*

**Rule**: as soon as the first feedback item lands in a Phase-12 round, immediately (a) append "Round N Feedback" header to `docs/evidence/<issue>-feature-implementation-feedback.md` with Comment entries per Step-4 template (Author / Type / Comment / Status); (b) append per-item entries as fixes ship; (c) call `seekMentoring(currentPhase='address-feedback', status='failure', findings={…})` after each round's commits; (d) close with `seekMentoring(status='complete')` only after the round is user-approved AND PR is approved-pending-merge. No retro-application.

---

#### [P-MED] Premature "converged" claim in spec status text while spec is under review

**Score**: 5.0
**Last seen**: 2026-05-11
**Recurrences**: 2 (PR #314 R4 + R7)
**First synthesized**: (pending)

Twice on PR #314 I claimed the spec was "converged" in the status line: R4 commit set status to "Ready for review (R4 converged)" — followed by R5 architectural reversal + R6 batch of 8 inline comments. R7 commit set Decision Log footer to "Spec converged after 7 review rounds" — followed by user's R8 ask "do a thorough audit" which surfaced 9 more concrete gaps. Convergence is a *reviewer signal*, not an author claim.

**Rule**: use state-of-iteration phrasing in spec frontmatter Status field — "Iterating (round N)" while actively iterating, "Ready for review (round N — controls applied)" when handing off, never "Converged" until reviewer approves the PR. For Decision Log footer, "Iteration history (R0–RN); awaiting reviewer signoff" rather than "Spec converged after N rounds". Costs nothing; removes a recurring false-positive signal.

---

#### [P-MED] Epic Acceptance Criteria not explicitly mapped — implicit coverage invisible to reviewer

**Score**: 5.0
**Last seen**: 2026-05-11
**Recurrences**: 1 (AC-5 + AC-6 slipped on #241 — 2 of 7 ACs)
**First synthesized**: (pending)

On #241 Epic spec, 5 of 7 ACs were covered cleanly. Two slipped: AC-5 was deferred via D14's "no Rules tab in V0" but never explicitly mapped (reader couldn't tell if addressed or missed); AC-6 was directly contradicted by D40 reversal but never flagged as superseded.

**Rule**: before declaring any Epic spec ready for review, write an explicit Acceptance Criteria traceability table near the top of Functional Requirements section — column A = AC text verbatim from issue body, column B = covering R# / section, column C = note ("covered", "superseded by D40 — see Decision Log", "delegated to sub-issue #234"). Mechanical (~10 min for 7-AC Epic); permanently eliminates "did this AC get addressed?" review questions.

---

#### [P-MED] Reviewer-also-missed framing leaks into accountability discussion

**Score**: 5.0
**Last seen**: 2026-05-11
**Recurrences**: 1
**First synthesized**: (pending)

While defending why my RFC carried unverified pattern claims, I wrote that "the spec went 12 rounds and the reviewer didn't catch them either" — framing reviewer-also-missed as relevant context. User: *"Reviewer is your manager looking and coaching you for functionalities to deliver. They are not micro-managing and double checking everything you state."* Verification is unambiguously the producing-phase's responsibility.

**Rule**: when acknowledging unverified claims, name the producing-phase failure cleanly without referencing whether others caught it. "I asserted X without verifying" stands on its own; appending "and the reviewer missed it too" reframes accountability. When discussing process improvements, separately analyze (a) the producing phase's verification gate and (b) the review phase's role as coaching/direction — never conflate them.

---

#### [P-MED] Treating defects on an open PR as new scope warranting separate PRs

**Score**: 5.0
**Last seen**: 2026-05-14
**Recurrences**: 1
**First synthesized**: (pending)

After the user listed seven defect categories + two runtime errors during Phase 11 manual verification of PR #364 (#336 Slice 4b), I proposed splitting fixes into three sequential PRs. User correction: *"Why different PRs - these are problems on an existing code we are working. Looks like you have missed the context again - we are in FRAIM feature implement Phase 11 - PR review."*

**Rule**: during FRAIM Phase 11 (`implement-submission`) or Phase 12 (`address-feedback`) manual verification on an open PR, every defect the reviewer surfaces is part of that PR's review cycle — fix on the same branch, push to the same PR. Before responding to multi-item feedback, confirm the FRAIM phase via `git log -5 --oneline`. Restoring scope that should have been delivered is not new scope — it's a gap in the existing PR. Only propose a separate PR if the defect is clearly unrelated to the issue; even then, surface and ask before splitting.

---

#### [P-MED] Treated deferred validation as a validation result

**Score**: 5.0
**Last seen**: 2026-05-14
**Recurrences**: 1
**First synthesized**: (pending)

On PR #372 (#371 fix), Phase 5 ran typecheck + lint + build + targeted vitest (7/7) and reported "Pass". I documented the live-browser test as "follow-up smoke; not blocking this PR" with intent to be honest about a gap — but functionally that's a deferral. When the user asked *"Have you tested these?"*, the right answer was to *do* the live test before submitting. Rule 18's literal text — *"Partial validation is not validation"* — should have fired on the author.

**Rule**: a deferral with a written rationale is still a deferral, not a test result. Future-tense ≠ evidence. If a validation is required by a rule, only execution satisfies it. Reflexively apply Rule 18 to self before declaring Phase 5 complete. Live-runtime proof for `redirect()` from Server Components is cheap (`NEXT_PUBLIC_DEV_BYPASS_AUTH=true` + killed API forces the failure shape in under 5 minutes).

---

#### [P-MED] `gh pr merge --delete-branch` cross-PR blast radius

**Score**: 5.0
**Last seen**: 2026-05-12
**Recurrences**: 1
**First synthesized**: (pending)

I merged PR #334 with `gh pr merge 334 --squash --delete-branch`. The flag deleted remote `feature/241-slice-3-surveys-list`, which was the base branch of in-flight PR #340 (#335 Slice 4a). GitHub auto-closed PR #340 one second later; reopen is blocked even after base is recreated. Cost: ~10 min to diagnose + open replacement PR #353 + lose original discussion-thread continuity.

**Rule**: before passing `--delete-branch`, run `gh pr list --base <branch-about-to-be-deleted>`. If any in-flight PRs exist, either rebase them first via `gh pr edit <N> --base main` or merge without `--delete-branch` and delete the branch manually after confirming no other PR has it as base.

---

#### [P-MED] Validate phase ran typecheck but not full build — lint-as-error only fires inside `next build`

**Score**: 5.0
**Last seen**: 2026-05-14
**Recurrences**: 1
**First synthesized**: (pending)

During Phase 12 Round 1 on PR #364 (#336), I ran `pnpm typecheck` + targeted vitest and reported implement-validate as Pass — did NOT run `pnpm build`. Post-submit CI failed with two `@typescript-eslint/no-unused-vars` errors in `next build`'s lint pass: `TabHeader.tsx:49 'buildIndicator' defined but never used` + `(admin)/layout.tsx:5 'useEffect' defined but never used`. TypeScript permits `_`-prefixed unused vars; project ESLint config does not — and lint-as-error fires only inside `next build`.

**Rule**: in implement-validate after touching production source code, run full `pnpm build` (or at minimum `pnpm --filter @customerEQ/web lint && pnpm --filter @customerEQ/web build`) and require exit 0 before reporting Pass. `pnpm typecheck` is insufficient.

---

#### [P-MED] API-runtime shape vs local-type contract divergence (mocked fixtures mask null/undefined)

**Score**: 5.0
**Last seen**: 2026-05-13
**Recurrences**: 1 (#335 Round 1 item 6)
**First synthesized**: (pending)

On #335 Round 1 (PR #353), the local `SurveyResolved` type declared `settings` as always-present `{ chromeMatrix?: ChromeMatrix } & Record<string, unknown>` — but Slice 1/2 API returns `settings: null` for surveys with no custom settings. I read `survey.settings.chromeMatrix` unconditionally → runtime crash on any survey my test fixture didn't cover (fixture had `settings: {}` which masked the gap).

**Rule**: when validating a component reading a typed API shape, fire one real API request from the dev server (or `curl`) at Phase 5 and diff the shape against the local type. Any field that's `null` in runtime but always-present in the type is a bug waiting on real data.

---

#### [P-HIGH] Submit-time auto-audit of spec/RFC claims against repo — never wait for user to ask

**Score**: 9.0
**Last seen**: 2026-05-11
**Recurrences**: 4+ (#276 spec/RFC, #277/#301 RFC, #314 R7+R8, #336 Phase 12)
**First synthesized**: (pending)

Pattern across four issues: spec/RFC drafts shipped with claims drawn from memory or architecture-doc text rather than verified against the repo. Errors surfaced in later phases (R6+ inline comments, implement-scoping verifying-grep, Phase 11 manual verification) or only when the user explicitly asked for an audit. By then, fixing means rewriting under review pressure across multiple sections instead of catching at submit time. M17 covers trigger-phrase verification for *"existing X / reuses Y / applied Z"*; the broader miss is that **every primary-source claim** (file path named, AC referenced, schema field cited, env var named, queue/job/component referenced) needs the same verifying read, and the **audit must be automatic at submit** — not a user-driven phase.

**Rule**: before reporting any FRAIM design / spec / RFC / implement-work-list phase as complete, run a **repo-wide claim-verification sweep** as a built-in submit-time step, not waiting for the user to ask:
1. Grep the document body for every named file path, symbol, function, AC#, schema field, env var, queue/job/component, route, migration name.
2. For each match, Read the named file or grep the symbol to confirm it exists and matches the surrounding claim.
3. For each "this RFC follows pattern X" / "we already have Y" assertion, produce a citation (file:line) or rewrite as net-new scope.
4. Document the sweep in the phase-completion evidence (a checklist row: "Claims verified against repo — N claims, M citations, K rewrites").

Audits the user has to ask for are audits the user shouldn't have had to ask for. Frame this as a hard submit-gate, not an optional pass. Sister-rule to M3 (FRAIM template re-read at submit) and M4 (retrospective control sweep) — same shape, applied to factual claims rather than structural compliance.

---

#### [P-HIGH] Asserted facts about file / config / external-state contents without reading the primary source first

**Score**: 8.0
**Last seen**: 2026-05-11
**Recurrences**: 5
**First synthesized**: 2026-05-03

Five recurrences across multiple surfaces. (1) #177 (2026-04-26) — attributed CI flake to commit `dfcce3f` rather than empirical reproduction; 50+ runs showed statistical-bound issue. (2) #231 PR #259 (2026-05-03) — spec claimed `fraim/config.json` does not declare regulations; file declares GDPR/CCPA/SOC2/PCI-DSS at lines 49-66. User framed as **second occurrence** + called out deflection-to-mentor pattern. (3) #231 PR #259 RFC drafting (2026-05-04) — "File-level change list" table included `apps/worker/src/jobs/erasure.ts` and `apps/api/src/services/dataExport.ts` as "modify" rows; both files do not exist. (4) #277 RFC (PR #290, 2026-05-07) — five of six supporting-infrastructure claims were aspirational in *"existing pattern" / "reuses pattern from #N" / "applied"* phrasing — logo-upload "persists to existing asset path" (no `@fastify/multipart`), name-change retry "uses existing event pipeline" (zero matches), audit allowlist "reuses pattern from #276" (no allowlist logic), admin-role gate "existing pattern" (no per-route role check). (5) #241 spec PR #314 R6 (2026-05-11) — Compliance Requirements claimed CCPA covered by "existing `apps/worker` erasure job pattern" (job doesn't exist; tracking issue #264 OPEN); `{{memberName}}` listed as variable picker available but Member schema has no guaranteed name field.

**Umbrella rule**: before asserting any fact about contents of a config file, settings file, log, schema, file path, or other primary source — read or `find` the file. Mentor warnings, architecture docs, and second-hand assertions are secondary signals; the file itself is authoritative. Deflecting a missed read to "the mentor said X" or "the architecture doc claims Y" is an attribution-to-externals failure that compounds.

**Trigger-phrase enumeration** (concrete checks — the rule fires when ANY of these appear in design/spec/RFC/work-list text):
- *"existing X" / "the existing Y"* — verify file/symbol exists via grep or `Read`
- *"reuses pattern from #N" / "the pattern from #N"* — open the cited PR/issue, confirm the pattern actually shipped
- *"applied (per architecture.md §N)"* / *"already shipped" / "already applied"* — architecture docs can be aspirational; verify against code
- *"modify X / extend Y"* in any file-level change-list table — Read the named file; if absent, rewrite as net-new scope
- *"the X pattern"* / a specific component/file/job name in supporting prose — primary-source check before the sentence is written

**Sister failure shape: architecture-doc-vs-code drift**: when an architecture-doc update lands in the same PR as an RFC, the doc text describes what the code does, not what the RFC plans. Concrete miss: `architecture.md:212` documented per-route audit-allowlist as applied for #276 + #277 although the code change in `audit.ts` was deferred — the next implementation session faced a self-confirming artifact. **Rule**: architecture-doc rows wait for the code; never document a pattern as applied before its code lands.

**Concrete checks before submit**: (a) for any config/setting claim, run a Read on the named file and quote the lines; (b) for any "X does not exist" claim, name the file/glob/scope and the actual search command; (c) treat mentor warnings as *prompts to verify*, not conclusions to propagate; (d) for any RFC table claiming "modify X" or "extend Y", run a verifying Read of X / Y in the same drafting pass; (e) grep the document body for the four trigger-phrase shapes ("existing", "reuses", "already", "the pattern from") and produce a citation-or-rewrite for every match before declaring complete; (f) at session start, when entering implementation against an RFC the agent itself authored in a prior session, run the same verifying-grep pass on the RFC's "existing/reuses/applied" language before drafting the work list.

---

#### [P-HIGH] Single-frame interpretation buries the cleaner answer (silent sunk-cost weighting OR scope-vs-rigor collapse)

**Score**: 8.0
**Last seen**: 2026-05-07
**Recurrences**: 2
**First synthesized**: 2026-05-01

Two recurrences with the same shape — single-frame reasoning silently weights one axis over another without naming the trade-off. (1) **#170 spec re-segmentation (2026-04-30, original entry)**: agent led with "light reframe" recommendation framed as lower-cost path because "PR #197 shipped the enum, sub-issues #171/#172/#173 exist." User: *"If we don't worry about sunk cost, what would you suggest?"* — at that prompt, committed to a substantively different JTBD segmentation. Inline review comment: *"This is a key learning moment. When presenting options, we should consider both 'with sunk cost' and without sunk cost."* (2) **#291 spec round-2 misread (2026-05-07)**: reviewer's "data preservation is not critical" was collapsed by the agent into two distinct dimensions ((a) migration-rigor: how careful does backfill need to be? — answer: not very, since demos; (b) schema-move scope: should the Survey-side columns ship in #291 at all? — answer: yes, if demos use the fields). Treating (a)'s answer as also resolving (b) collapsed the dimensions; agent dropped Survey-side schema in round 2. Reviewer corrected: "if data shows the fields are used, migrate and backfill — not defer." Cost: one extra full-spec rewrite cycle.

**Failure mode**: the agent has implicit knowledge that should be surfaced as a frame, and silently weights one frame higher than another without naming the trade-off. Application surfaces are **(a) design recommendations** (sunk-cost / clean-slate) and **(b) interpreting reviewer feedback** (which scope dimension does this phrase resolve?). Same shape, different surfaces.

**Rule**: when the agent recognises **two valid frames** for either (a) a recommendation or (b) interpreting an ambiguous reviewer phrase, surface BOTH frames side-by-side, name the deciding trade-off, and let the user pick. For recommendations: present "respect sunk cost" and "clean slate" options. For reviewer feedback that could resolve in two scope directions: enumerate both interpretations as a one-question follow-up before pivoting the spec scope.

**Trigger-question shapes that fire this rule**: (recommendations) *"is X the right approach?"*, *"should we keep going or rebuild?"*, *"are these the right segments / categories / boundaries?"*; (reviewer feedback) any phrase that could mean "relax rigor" OR "drop scope" — *"X is not critical"*, *"X is okay"*, *"don't worry about X"*. Captured durably as `feedback_present_both_sunk_cost_frames_upfront.md`; this extended rule applies the same discipline to ambiguous reviewer-phrase interpretation.
