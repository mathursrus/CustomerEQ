# Preferences — manohar.madhira@outlook.com

Patterns that describe how this user prefers to work, interact, and approach recurring decisions.

**Last synthesized**: 2026-05-17

---

#### [P-HIGH] Browser validation of UI changes before submit is non-negotiable

**Score**: 8.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: 2026-04-27

For any UI-facing change, the user expects actual browser testing (Playwright or manual) before the implementation phase is reported as complete. Typecheck + build + smoke-test passing is not sufficient validation for React state sync, form population, rendering, or styling. On issue #153, the user's pushback ("Have you tested these?") forced full local-env setup and browser validation — which then confirmed the fix worked end-to-end. Default behavior should be to set up whatever is needed (Docker, local DB, Clerk, browser) rather than relying on compile-time checks.

---

#### [P-HIGH] Tight PR scope — no opportunistic scope creep

**Score**: 8.0
**Last seen**: 2026-04-30
**Recurrences**: 8
**First synthesized**: 2026-04-27

The user values PRs that do exactly one thing. Issue #166 was a `deploy.yml` hardening: +29/-7 on one file, with a tangentially related concern (third-party action SHA-pinning) deferred to a follow-up. Issue #177 (Node 22 bump) explicitly deferred three pre-existing test-coverage gaps into a "Pre-existing gap → Why not addressed here → Recommendation" table. On issue #170 spec, when prompted for "all the later items" the agent had to push back and trim to in-scope items. On issue #170 implementation phase 1, the user chose 6 PRs over a mega-PR — splitting both auth and onboarding-admin into API-only + UI-only slices. **PR1 (#197) added a 5th recurrence**: SurveyTheme schema-vs-migrations drift surfaced mid-implementation; rather than bundling the fix into PR #197, agent filed #198 as a separate issue + branch, dropped the FK from PR 1's migration, and documented the workaround. **PR2 (#201) added 6th-8th recurrences**: three side-quests interrupted the address-feedback phase (fresh-published Clerk CVE blocking the audit gate, an override-fix hotfix iteration, JTBD spec re-segmentation discussion) — all three got their own issues (#219, #221's parent #219 reused, #217) and branches per R21. PR #201 stayed scoped to its original 15-file API-only slice (+2345/-13). Default stance: if a fix is discovered mid-task but outside the issue's acceptance criteria, file a separate issue, do not bundle. Related: project rule R21 (one issue per branch) formalizes the branch-level version of this preference.

---

#### [P-HIGH] Prefer systemic fixes over per-file fixes for cross-cutting issues

**Score**: 8.0
**Last seen**: 2026-03-31
**Recurrences**: 1
**First synthesized**: 2026-04-27

When a bug affects multiple files with the same root cause, the user expects the fix to live at the shared layer — `globals.css`, a shared component, a utility, or a config — not replicated per file. On issue #71, the user's one-line pushback ("Why are you individually updating style in each file? Isn't having global style a better pattern?") triggered a full revert of a 7-file change in favor of a 5-line global CSS rule. This preference is now formalized as project rule #15.

---

#### [P-HIGH] Surface open decisions with recommended defaults for one-round resolution

**Score**: 8.0
**Last seen**: 2026-04-27
**Recurrences**: 4
**First synthesized**: 2026-04-27

When presenting design decisions for reviewer sign-off (RFC review, architectural tradeoffs), the user responds fastest when each open decision is framed as a small set of concrete options with one marked `← recommended`. On issue #2, both open decisions resolved in a single round because each had a recommended default. On issue #170 spec, OD-1 through OD-5 (five open architectural decisions) all resolved in single review rounds — three came back as one-word "Agreed", one was reversed cleanly with a one-line rationale, one was added new in response to a theme. On issue #170 RFC PR #196, four "Decisions for the reviewer" got four answers in two batches across Round 1 + Round 2. On issue #170 implementation phase 1 (2026-04-27), four pre-execution decisions (slicing, sign-in, API layout, ADR placement) got four answers in a single chat turn. On issue #177, three "Decisions for you" at the bottom of the PR body got three answers in a single chat turn. Default presentation format: numbered binary/ternary choice, one-line tradeoff per option, explicit `← recommended` on the preferred path.

---

#### [P-MED] Pre-execution confirmation on multi-section rewrites

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 1
**First synthesized**: 2026-04-27

Before executing a multi-section rewrite of a spec or RFC, ask 1–3 pre-execution questions and wait for shorthand answers ("yes to all", "1b/2a/3b" style). On issue #170 spec, both Round 1 and Round 2 used this pattern and converted what would have been 30+ message round-trips into single-message direction. Don't dive into a multi-section rewrite without pre-confirmed direction — the cost of asking is small relative to the cost of rewriting twice.

---

#### [P-MED] Thorough parallel context-gathering before design

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 3
**First synthesized**: 2026-04-27

For design and RFC phases, reading all relevant context files (schema, existing routes, worker code, shared types, architecture doc, project rules, UI mocks) in parallel at the start of the phase produces better outcomes than sequential/on-demand reads. On issue #2, reading 8 key files upfront captured the `brandId`-from-JWT pattern, soft-delete approach, BullMQ split, and existing rule evaluator behavior — all of which shaped the RFC correctly on the first draft. On issues #170 and #177, parallel Explore subagents ran a full surface enumeration in one round and produced exactly the inputs the RFC needed (no back-and-forth, no missed surfaces).

---

#### [P-MED] User confirms quickly with shorthand once direction is clear

**Score**: 5.0
**Last seen**: 2026-04-26
**Recurrences**: 1
**First synthesized**: 2026-04-27

When given a structured list of pre-execution questions or open decisions, the user responds with terse shorthand ("yes to all", "1b/2a/3b", "Agreed"). On issue #170 spec, multiple rounds of multi-question direction-setting got single-message answers. Optimize for this pattern: prefer batched questions over interleaved confirmations; use numbered/lettered options that the user can reference compactly.

---

#### [P-MED] User does not manually close issues or PRs

**Score**: 5.0
**Last seen**: 2026-04-25
**Recurrences**: 1
**First synthesized**: 2026-04-27

The user does not manually close GitHub issues or PRs from the UI; closes happen either via merge auto-close (`Closes #N` in PR body) or via explicit asks ("merge and close"). On 2026-04-25, the agent incorrectly described issue #157 as having been "closed manually" based on a `commit_id: null` close event; the user clarified that this is never the case for them. Captured in feedback memory `feedback_user_does_not_manually_close.md`. Implication: when investigating a closed-without-merge state, do not jump to "user clicked close in UI" — the actor is more likely a CLI/script call from a previous session or another tool.

---

#### [P-MED] Treat documented baseline (CLAUDE.md / project_rules / .env.example) as given — don't ask the user to re-confirm

**Score**: 5.0
**Last seen**: 2026-05-05
**Recurrences**: 3 (cumulative; 2026-04-20 origin + #270 prep + #276 prep both as no-ask wins)
**First synthesized**: 2026-05-05

On 2026-04-20 the agent asked the user whether the local DB and dev server were reachable for integration/E2E tests. The user pushed back: *"You already know that there is a local dev environment and dev server. Why are you asking me?"* The repo's project rules (#11 validation commands, #11a tests-must-never-skip), CLAUDE.md testing-rules section, and the open `.env.example` file all establish that a local dev environment and dev server exist; asking again wasted a turn and treated the user as a configuration source instead of consulting the documented baseline. The 2026-05-05 #270 prep and #276 prep cycles both validated the rule firing in the right direction: docker compose was already running from a prior session, the .env existed in the main workspace, and project rule R19 declares Docker-first local dev as the baseline — agent proceeded without re-asking. **Rule**: in a project whose CLAUDE.md / project_rules / `.env.example` already establish a baseline dev environment, treat that baseline as given. Before asking any setup question, check whether the repo's documentation already answers it: (a) CLAUDE.md test commands (`pnpm test:integration`, `pnpm test:e2e`) imply DB and dev server are part of the standard local environment; (b) `project_rules.md` rule #11 enumerates the four validation commands and #11a confirms tests fail (don't skip) when their dependencies are missing — meaning the dependencies are expected to be present; (c) `.env.example` exists with `DATABASE_URL` and similar placeholders. When all three signals point the same direction, just proceed. If a contributor's environment is misconfigured, that's the contributor's signal to fix their environment — not the agent's signal to have asked first. Captured durably in `feedback_dont_ask_about_baseline_dev_env.md`. Sister-pattern to existing `FRAIM discovery flow before any non-trivial action` (P-HIGH) — both are about consulting documented context before asking the user.

---

#### [P-HIGH] Read HTML mocks directly before any UI work — never rely on agent summaries

**Score**: 8.0
**Last seen**: 2026-05-14
**Recurrences**: 2 (#336 Slice 4b BasicsTab type-cards + #335 Round 1 mock-fidelity items)
**First synthesized**: (pending)

On Phase 12 verification of PR #364 (#336 Slice 4b), I built the Survey Type cards in BasicsTab from spec prose + an Explore-agent's summary of `docs/feature-specs/mocks/241-survey-admin-ux.html` rather than opening the mock directly. Cards read "NPS — Net Promoter Score — 0 to 10" instead of mock's iterated verbiage ("NPS · Net Promoter — Loyalty health — would you recommend us? — 1 standard question + 1 follow-up"); different icons; missed "Not sure which to pick?" collapsible quick guide entirely. User: *"For the exact verbiage for the NPS, CSAT, CES and custom and the included 'Not sure which to pick'. These were deliberately designed and iterated to get information and icons right. Why do you keep ignoring the mock? Me pointing out mock deviations is waste of my time."* Third correction in one session on mock fidelity.

**Rule**: when a feature has an HTML mock under `docs/feature-specs/mocks/<issue>-*.html`, open it with the `Read` tool BEFORE writing any UI. Match exactly: card labels, helper text, icons (the specific glyph, not equivalents), tab layout including numbered indicators, affordances like "Not sure which to pick?". Agent summaries always drop microcopy and deliberate affordances. After implementing, re-open and diff before declaring ready. If the user says "same as <other feature>" (e.g. "tabs same as Program"), also open the referenced page's component and mirror that layout (`WizardStepper` for numbered tabs).

---

#### [P-HIGH] Mock-to-implementation drift is the agent's responsibility, not the user's

**Score**: 8.0
**Last seen**: 2026-05-14
**Recurrences**: 1 (explicit user directive 2026-05-14)
**First synthesized**: (pending)

After repeatedly missing mock-fidelity details on PR #364, the user issued a directive: *"I will now only test functionality and trust you to fix the mock to implementation drift after we have all functionality fixed."* Manual-verification capacity is for functional correctness — not pixel-by-pixel mock comparison.

**Default plan for UX work in this repo**: (1) close every functional defect the user reports; (2) BEFORE declaring done, run a self-driven mock-conformance sweep — open `docs/feature-specs/mocks/<issue>-*.html`, walk it end-to-end, and check every visible element against implementation (headings, buttons, badges, helper text, layouts, numbered indicators, icons, hover/active/empty states, modals, tab nav footers, preview chrome, theme pickers, chrome matrices, banners, copy). Fix every diff. Don't ask "want me to also fix X?" once functionality is settled — pre-authorised. Surface a deviation only if genuinely infeasible (missing infra, blocked by another issue) with a specific alternative. Batch related changes so user can re-verify in one pass.

---

#### [P-HIGH] Show full draft before publishing to external surfaces

**Score**: 8.0
**Last seen**: 2026-05-12
**Recurrences**: 1
**First synthesized**: (pending)

During Slice 3 wrap-up, the user agreed to "file the issue as a follow-up after retrospective wraps." I provided a high-level proposal in conversation, the user gave feedback on the draft, I said "I'll keep this draft ready and file the issue once retrospective completes." After Phase 13 closed, I ran `gh issue create` with a fully-fleshed body — substantially expanded beyond the in-chat summary, ostensibly incorporating user's feedback — and posted issue #343 without surfacing the revised body first. User: *"I thought you will show me a revised draft."*

**Rule**: when an action publishes content to a shared/external surface where the user can't easily iterate post-publish (GitHub issue body, comment on issue or PR, Slack message, email), the user must see the *final* artifact body before the publishing call — even when they have authorized the multi-step flow that ends in publishing, and especially when they have given feedback on a draft along the way. Write the full body locally (or paste into chat as a fenced block), say "here's the body I'd file as #X — review and tell me what to change", and only call `gh issue create` / `gh issue comment` / `gh pr comment` / Slack-or-email after the user signals OK or hands back an edited version. **Exception**: `gh pr create` and `gh pr review` do not require pre-show — the user can review and comment on the PR or review through the PR itself after submission. "Authorization to file as follow-up" is authorization for the *plan*, not pre-authorization for the *exact words I happen to choose at file time*.

---

#### [P-HIGH] Copy .env files from main worktree before pnpm dev in fresh worktrees

**Score**: 8.0
**Last seen**: 2026-05-14
**Recurrences**: 2 (#291 impl PR #296 + #336 session start)
**First synthesized**: (pending)

When the working directory is a git worktree alongside a primary checkout (e.g. `CustomerEQ - Issue 336` next to `CustomerEQ`), gitignored `.env` files (root `.env`, `apps/*/.env`, `apps/*/.env.local`) live only in the primary checkout and are missing in the fresh worktree. Starting `pnpm dev` without copying them produces a "looks healthy" output (web binds :3000) while API and worker silently fail on database init. On #291 implementation (PR #296), I declared "integration tests not run locally" as an infra gap without first copying the working `.env` from the main worktree — reviewer pushback required correction. On #336 session start, I ran `pnpm dev` and reported "Dev is up: web :3000, api :4000" — but `apps/api`/`apps/worker` had crashed at startup with `Environment variable not found: DATABASE_URL`. User: *"This is a consistent miss you make during prep. You need to copy those from the main worktree."*

**Rule**: as part of "start local dev in a worktree" prep, BEFORE running `pnpm dev`: (1) detect main worktree path with `git worktree list`; (2) for each `.env` / `.env.local` that exists in the main worktree under root and `apps/*/`, copy it into the current worktree at the same path; (3) don't fall back to `.env.example` — it lacks locally-configured Clerk keys + other secrets; (4) only then start `pnpm dev`, and verify `apps/api` doesn't log `Fatal error during startup` before declaring the server ready.

---

#### [P-MED] Answer "why" questions with explanations only — don't preemptively act

**Score**: 5.0
**Last seen**: 2026-05-07
**Recurrences**: 1 (#291 impl session)
**First synthesized**: (pending)

When the user asked *"Why isn't the dev server starting?"* during #291 implementation, I answered the why ("I killed it earlier with `taskkill` after running e2e tests") and then immediately restarted the dev server in the same response. User: *"clean up. I missed that it was from your kill. When I ask a why question just give me an answer, not 'fix' it."* The user asks why-questions for diagnostic understanding, not as a setup for an action.

**Rule**: when the user asks a why-question, the response is the explanation only. Stop after the explanation. Don't preemptively act on a predicted follow-up — let the user decide what to do with the explanation. Same applies to "how does X work?", "where is Y?", and similar diagnostic questions. If a fix is obvious and trivial, surface the option in a sentence ("Want me to restart it?") rather than executing it.

---

#### [P-HIGH] Mock is the Spec — UI implementation must match mock element-for-element

**Score**: 9.0
**Last seen**: 2026-05-14
**Recurrences**: 4+ rounds in one session (#336 Slice 4b)
**First synthesized**: (pending)

Existing entries cover *reading* mocks directly and *closing drift* — but the user's framing is stronger: **the mock IS the spec for UI**, not a supplement. When the spec prose and the mock disagree, the mock wins (it's the iterated, design-resolved artifact). Cost on #336 Slice 4b: **four rounds of feedback handholding** on mock fidelity (type-card verbiage, "Not sure which to pick?", numbered tabs, theme swatch cards, chrome toggles, question card chrome) — and even after all corrections, production still lacks elements that the mock had. User directive: *"Me pointing out mock deviations is waste of my time."*

**Rule**:
1. **Mock has equal-or-greater authority than spec prose.** When mock and spec text disagree on UI verbiage, icons, layout, numbered indicators, helper text, affordances, modal copy, or empty-state messages — the mock wins.
2. **Mock-element checklist before declaring UI work done**: walk the HTML mock scene-by-scene; for every visible element, confirm presence + verbiage + icon + position + state-variation in the implementation. Missing elements are bugs, not "out of scope unless asked".
3. **No summary substitutes for the mock.** Explore-agent summaries, memory recall, spec text quotations — all drop microcopy and deliberate affordances. The `Read` tool on `docs/feature-specs/mocks/<issue>-*.html` is the only authoritative entry point.
4. **Closing mock-to-implementation drift is a Phase-11 submit gate**, not a Phase-12 round-trip. The user does functional verification; the agent owns mock fidelity end-to-end.

Sister-rule to "Read HTML mocks directly" + "Mock-to-implementation drift is the agent's responsibility" — this entry adds the **authority + completeness framing**: mock IS spec, every mock element must ship.

---

#### [P-HIGH] FRAIM discovery flow before any non-trivial action

**Score**: 9.0
**Last seen**: 2026-05-12
**Recurrences**: 7
**First synthesized**: 2026-04-27

Before executing any non-trivial user request in this repo, start the FRAIM discovery flow: **(1) read `fraim/personalized-employee/rules/project_rules.md`** (the entry-point checklist — CLAUDE.md prologue directs this; failing it leaves the agent operating without project guardrails, surfacing later as concrete rule violations), (2) match the request to a FRAIM job via `mcp__fraim__list_fraim_jobs`, (3) call `mcp__fraim__get_fraim_job` for the full phased instructions, (4) follow phases via `seekMentoring`. Do not enter Claude Plan mode; do not launch Explore agents ahead of FRAIM context. Confirmed across multiple sessions in 2026-04 (issues #157 broken-windows, #166, #170 spec, #170 RFC, #170 implementation phase 1, #177, #179) — when this flow is followed, jobs run cleanly through their phases with zero rework. **#331 Slice 3 wrap-up (2026-05-12) added a 7th recurrence with a concrete failure cost**: agent skipped reading `project_rules.md` at session start; several hours later during Phase 13 retrospective cleanup, committed directly to `main` (commit `7def500`) — a Rule 10 violation (*"Never commit directly to `main`"*). The retrospective being a 208-line doc-only commit did not exempt it from Rule 10; had project_rules.md been in working memory at the moment `gh pr merge --delete-branch` auto-switched to `main`, the right action (`git switch -c chore/...` before any commit) would have been the default. **Strengthening after recurrence #7**: treat the CLAUDE.md prologue list (currently: `project_rules.md`) as a hard pre-condition before any tool call against the user's actual ask — not advisory. When the flow is skipped, work lands on wrong branches, phases are falsely marked complete, project rules get violated, and recovery costs accumulate.

---

#### [P-HIGH] Merit over ease — recommend long-term-best on merit; cite a specific blocker if a short-term alternate is genuinely required

**Score**: 8.0
**Last seen**: 2026-05-17
**Recurrences**: 2
**First synthesized**: 2026-05-17 (promoted to L1 from auto-memory `feedback_merit_over_ease.md`, originally saved 2026-05-14)

User directive (verbatim, 2026-05-14): *"Don't optimize for development time or ease. Aim for what is best in long term... You give me shortcuts all the time and then cause problems down the road. The issue list is ballooning for this reason."* The rule lives in user-side auto-memory as `feedback_merit_over_ease.md` and is being promoted to L1 here after two recurrences in the 2026-05-17 #378 session despite the rule existing in memory.

**Recurrence 1 — OD-2 (Brand-TZ library), 2026-05-17**: agent drafted Open Decision OD-2 with **2a (native `Intl.DateTimeFormat` + ~30-line `endOfDayInBrandTz` helper) ← recommended**, citing *"zero new dependency, Node 22's ICU includes IANA TZ data, sufficient for the 5 display sites + 1 EOD-arithmetic site #378 needs."* Reviewer Q2 response (paraphrasing the rule back): *"long term stability and direction should be preferred over short term. Especially for 1st time implementation of a solution, when product is just being built new, first time usage should not mean take shortcuts. That then introduces a precendence and finally we are in a death spiral of keep writing shortcuts."* Phase 3 spike confirmed all three candidate approaches converge correctness-wise (15/15 pass); library wins on ergonomics. OD-2 reversed to 2b post-spike. Captured in raw `2026-05-17T17-00-00-merit-over-ease-misfired-on-od-2.md`.

**Recurrence 2 — #378 spec R3.1 URL corrections, 2026-05-17**: agent proposed inferior URL shapes (`app.customereq.io/s/{id}/r/{token}` host+path, then `?t={token}` query param) as "drop-in" / "minimal-delta" fixes. Both required user pushback. Same shortcut-shaped framing. Captured in `2026-05-17` spec retrospective.

**Rule** (canonical statement):

1. **Never optimize for development time, diff size, or "drop-in swap" framing.** Recommend the long-term-best option on merit first.
2. **Cite a specific blocker** if a short-term alternate is genuinely required (runtime incompatibility, license, footprint that materially matters). "No new dep" is not by itself a blocker.
3. **Shortcuts have ballooned the issue list across prior sessions.** The cost is not a single bad recommendation; it is the precedent of shortcut-shaped reasoning that compounds across the product's first-time decisions.

**Forcing function — apply at the moment of writing "← recommended"**: before writing "← recommended" on any decision option, paste the candidate options side-by-side and write the deciding axis in one explicit line. If the axis is shortcut-shaped (one of the trigger phrases below), the recommendation is wrong by this rule and must be flipped to the long-term-durable option unless a specific blocker against that option can be cited.

**Linguistic shortcut-trigger phrases to audit**: "drop-in," "minimal delta," "smallest diff," "easier to extend," "for now," "reuse existing," "cheapest," "quick win," "zero new dependency," "fewer lines of code," "smallest change," "no new package," "minimal route delta." Each phrase either has a named blocker reason justifying it, or it gets cut and the recommendation flipped.

**Companion mistake-pattern**: *"L1 rule in memory but doesn't fire at the load-bearing decision moment"* (P-HIGH 9.0). The forcing function above is the prevention for the present rule and the umbrella pattern for the other two 2026-05-17 violations (drafted-from-summary, Rule-26-misread). Captured durably in user-side auto-memory `feedback_merit_over_ease.md` (still authoritative) and now in L1 preferences with the forcing function added.

---

#### [P-MED] Rebase feature branch onto main before any structural decision based on rule wording

**Score**: 5.0
**Last seen**: 2026-05-17
**Recurrences**: 1
**First synthesized**: 2026-05-17

On #378 design phase (2026-05-17), the agent's feature branch was cut on 2026-05-15 — **before** PR #406 (reword of Rule 26) merged on 2026-05-17T11:05. The agent read the locally-checked-out `project_rules.md` to inform a structural decision (whether the RFC ships in its own PR or commits to the existing feature branch), got the ambiguous pre-#406 wording, misread it, and opened PR #407. The user corrected: *"#404 also fixed this confusion. So rebase to main, so that this doesn't repeat."*

**Rule**: at session start of any phase that will make a structural decision (open a PR, name a branch, choose worktree layout, decide whether to split artifacts), run two commands before reading any rule file:

```bash
git fetch origin
git log origin/main..HEAD -- fraim/personalized-employee/rules/project_rules.md docs/architecture/architecture.md CLAUDE.md
```

If the upstream files have moved on `main` since the feature branch was cut (the `log` shows commits on main that the branch doesn't have), **rebase the feature branch onto main before reading the rule**. The corrected wording is on `main`; the local checkout is stale until rebased.

**Cost / benefit**: ~30 seconds at session start vs. a force-push + PR cleanup cycle + erosion of trust if a just-fixed rule gets re-violated. Sister-rule to mistake-pattern *"Stale local rule text from feature-branch divergence re-triggers an extinguished failure mode"*. Authoritative version of the forcing function lives in this preference; the mistake-pattern entry catalogs the failure mode it prevents.

**Applies to all rule-bearing files**: `fraim/personalized-employee/rules/project_rules.md` (project rules), `docs/architecture/architecture.md` (architectural conventions), `CLAUDE.md` (project guardrails), `fraim/personalized-employee/learnings/*` (L1 corpus — should also be re-pulled for stale entries, though synthesis cycles are slower than rule fixes).
