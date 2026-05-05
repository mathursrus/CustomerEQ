# Mistake Patterns — manohar.madhira@outlook.com

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

**Last synthesized**: 2026-05-05

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



#### [P-HIGH] Single-frame strategic recommendation buries the cleaner answer (silent sunk-cost weighting)

**Score**: 8.0
**Last seen**: 2026-04-30
**Recurrences**: 1
**First synthesized**: 2026-05-01

On the #170 spec re-segmentation discussion (2026-04-30), the user asked whether the current "Own application / Static site / Multiple applications" picker was the right segmentation. The agent led with a "light reframe" recommendation (preserve the existing enum, three sub-issues, and three-bucket structure; repurpose #172 as a SaaS-connector hub) — explicitly framed as the lower-cost path because *"PR #197 shipped the enum, sub-issues #171/#172/#173 exist."* The user responded with *"If we don't worry about sunk cost, what would you suggest?"* — and at that prompt the agent committed to the JTBD-based segmentation (winback / listen / reward), which was a substantively different and arguably better recommendation. On reviewing the resulting retrospective PR #222, the user left an inline comment: *"This is a key learning moment. When presenting options, we should consider both 'with sunk cost' and without sunk cost."* Failure mode: the agent had implicit knowledge of in-flight work (the enum, the sub-issues, the existing spec) and silently weighted "minimize churn" higher than "give the right answer" without naming the trade-off to the user. The correct response to a strategic / design / scoping question is to surface **both** the "respect sunk cost" and "clean slate" recommendations side-by-side, name the deciding trade-off, and let the user pick the frame. Captured durably as `feedback_present_both_sunk_cost_frames_upfront.md`. Trigger-question shapes that fire this rule: *"is X the right approach?"*, *"should we keep going or rebuild?"*, *"are these the right segments / categories / boundaries?"*

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

#### [P-HIGH] Asserted facts about file / config / external-state contents without reading the primary source first

**Score**: 8.0
**Last seen**: 2026-05-04
**Recurrences**: 3
**First synthesized**: 2026-05-03

Three recurrences in 8 days, plus a same-family pattern already in L1. (1) On issue #177 (2026-04-26), diagnosed a CI flake by attribution to commit `dfcce3f` — the commit that originally added the failing test — rather than running the test repeatedly under matching conditions and computing the theoretical failure rate. The user pushed back; empirical reproduction across 50+ runs showed the failure was a statistical-bound issue, not feature #83's. (2) On #231 PR #259 (2026-05-03), wrote in the spec: *"`fraim/config.json` does not declare regulations explicitly"* — false. The file declares GDPR/CCPA/SOC2/PCI-DSS at lines 49-66. Relied on a misleading FRAIM mentor warning ("regulations not configured") and propagated it as fact. The user explicitly framed this as the **second occurrence** and called out the deflection-to-the-mentor pattern. (3) On #231 PR #259 RFC drafting (2026-05-04), wrote a "File-level change list" table that included `apps/worker/src/jobs/erasure.ts` and `apps/api/src/services/dataExport.ts` as "modify" rows. Both files do not exist — the architecture doc claim about GDPR erasure/export was aspirational, not delivered. Caught only during phase-4 implementation pattern discovery via `find apps/worker/src -name "*.ts"`. Forced a mid-implementation re-scope plus a P1 follow-up issue. Sibling pattern in L1: *"Misdiagnosed a script hang as an external system issue"* (P-HIGH 8.0, #200) — same shape (don't trust externals; verify primary source) but specifically about script-debugging. **Umbrella rule**: before asserting any fact about the contents of a config file, settings file, log, schema, file path, or other primary source — read or `find` the file. Mentor warnings, architecture docs, and second-hand assertions are secondary signals; the file itself is authoritative. Deflecting a missed read to "the mentor said X" or "the architecture doc claims Y" is an attribution-to-externals failure mode that compounds. **Concrete checks**: (a) for any config/setting claim, run a Read on the named file and quote the relevant lines; (b) for any "X does not exist" claim, name the file/glob/scope and the actual search; (c) treat mentor warnings as *prompts to verify*, not conclusions to propagate; (d) **for any RFC table that claims "modify X" or "extend Y", run a verifying read of X / Y in the same drafting pass** — architecture documentation can be aspirational, its claims about delivered infrastructure are not a substitute for verifying the codebase.

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
