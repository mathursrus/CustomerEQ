# Issue #420 — feature-implementation Phase 12 Handoff (manual-testing entry)

**Issue**: [#420](https://github.com/mathursrus/CustomerEQ/issues/420) — Send Survey Emails via CustomerEQ (ACS)
**PR**: [#497](https://github.com/mathursrus/CustomerEQ/pull/497) (Draft per Rule 27)
**Branch**: `feature/420-use-azure-communication-services-to-send-survey-emails` (HEAD: `478c809`)
**Worktree**: `C:\Github\mathursrus\CustomerEQ - Issue 420`
**FRAIM job**: `feature-implementation`. Phase 12 `address-feedback` is **still in progress — NOT complete**. Only `seekMentoring(implement-architecture-update, status='complete')` has been called (post-F.2). The `address-feedback` close and the `implement-submission` (Item H re-validation) are **held** pending user manual-test feedback.
**Session paused**: 2026-05-23 ~23:00 UTC — user starting manual local-environment testing in a new session.

---

## Why the session was paused

User instructed: *"Please complete F.2 and G. I will review those. H — you can combine with any other comments and my test results. After you are done with F.2 and G, we will start testing in local environment."* F.2 and G landed (commits `9b51b66` + `478c809`). All `.env` files copied/created in this worktree. User is starting manual testing in a new session — handoff is for that session to pick up cleanly.

---

## What's landed since the prior handoff (commit `73533ab`) — 22 new commits, all pushed

| SHA | Item | Summary |
|---|---|---|
| `8ce04c4` | docs | Item M mock-walkthrough audit doc (261 lines, every drift cited with mock-line + impl file:line) |
| `fcf60e9` | M1 | Scene 1 entry tile — both buttons outline-primary peers, `📧→📨`, copy aligned with mock framing |
| `4ae9f0b` | M2 | Scene 6 Responses header — caption + dropdown verbiage match mock; `sendMode` plumbed end-to-end so dropdown shows `(CustomerEQ Email)` / `(Self-serve)` |
| `7f0198b` | M3 | Scene 2/3/5A pre-submit recap rows + Generate-CTA `→` arrow + Done-button as primary |
| `97b41ff` | M4 | Scene 3 default subject `Quick question:` + default body with `{{brand_logo}}` + `{{brand_name}}` header |
| `1be11e1` | M5 | LoopMonitor — `<SendModePill>` inline on Survey-Sent subline + lifetime-anchor note |
| `7d36b3a` | M6 | Wave Detail — mode-conditional Sent-semantics box + Self-serve "no platform send log" amber warning |
| `8d4181b` | mock-update | Scene 6 line 1087 R40 fix + Scene 7B extended to depict Composer Snapshot + Send Log blocks + V0/V1 framing removed from 7B scene-note |
| `8e53190` | docs | audit doc closure-status update (M1–M6) |
| `0ae6360` | **spec patch** | R32 split into R32a–f; R30a–e added for live preview pane (R30e marks color-mapping legend `(design-only, no SHALL)` per user); R31a added; Mock-to-R cross-reference table appended at end of spec |
| `8b462e6` | M7 | SELF_SERVE confirmation modal (centered + backdrop + Self-Serve tag heading + summary block + strong-warning + Yes/Cancel) — was missing entirely. MANAGED_EMAIL confirm converted from inline section to centered modal with full From/Subject/Survey-name/Links-expire/Recipients summary block. R32a–f cited in code comments. |
| `cbe32db` | M8 | Scene 3 right-column live email preview pane (R30a–d) — new EmailPreviewCard.tsx (235 lines) + 9 unit tests. ManagedEmailFlow Compose section now 2-column grid. Brand context plumbed to include name + logoUrl. Sample recipient = first selected audience member. Theme color legend skipped per user (R30e). |
| `20230c8` | docs | audit doc closure-status update (M7 + M8 + spec-patch + user deferrals on 5A.2 / 5B.* / 5C.*) |
| `7807a27` | learning | Raw coaching moment file — `mocks-are-not-summarizable-design-artifacts` |
| `9b51b66` | **F.2** | `architecture.md` §6 two-gate suppression entry extended with Gate 1 canonical paths (shared classifier + API surfaces + frontend disabled-checkbox enforcement). `seekMentoring(implement-architecture-update, status='complete')` called after this commit per handoff procedure. |
| `478c809` | **G** | evidence-doc rewrite + work-list forward guards. "Known V0 simplifications" → "External blockers" (V15 only). All 9 Round-1 Partials lifted to Met with commit citations. Round 2 + Round 3 added to Feedback Completeness table. Work-list reorganized into External blockers / Spec-level non-goals / Forward guards (3 rules captured from this PR's coaching artifacts). |

**Plus** earlier in this session: Items C (`ed0afac`), D (`1df5cb2`), D.2 (`da92799`), and the prior-prior handoff doc supersession.

---

## Coaching events this PR — three artifacts that future you MUST honor

All three are recorded in user-memory + as raw coaching files committed in `fraim/personalized-employee/learnings/raw/`:

1. **No implementer-initiated demotion of in-scope SHALL requirements.** Round 1, 2026-05-23.
   - File: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md`
   - Rule: there is no sanctioned `feature-implementation` process to demote a numbered R-statement to a follow-up issue. Legitimate carve-outs only: **external blockers** with the dependency cited verbatim (V15), or **spec-level non-goals** that the spec author already decided. Everything else lifts in the same PR.

2. **Grep before claiming backend state.** Round 2, 2026-05-23.
   - File: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T18-14-24-trusted-spec-prose-without-grepping-route.md`
   - Rule: any factual claim about backend state ("X is SSE", "Y already supports Z", "would require a new endpoint") must be verified against code / schema / migration before stating it. Spec prose is NOT a source of truth for capability claims.

3. **Spec prose is not a deliverable; only R-statements are SHALL.** Round 3, 2026-05-23. **This is the load-bearing one for the rest of this PR.**
   - File: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T21-51-24-mocks-are-not-summarizable-design-artifacts.md`
   - Rule: mocks are non-summarizable design artifacts; the spec format must enforce mock-to-R traceability with every visible affordance R-numbered or explicitly marked `(design-only, no SHALL)`.
   - User-memory `[[always_open_html_mocks]]` was sharpened on this turn — read every scene end-to-end before the first code edit, not just the scenes touching the current item.
   - User-memory `[[spec_prose_is_not_a_deliverable]]` was added — only R-statements are SHALL; prose-only mock affordances mean the spec is incomplete; compound R-statements must be split.
   - Structural fix at the FRAIM-job-template level: **FRAIM issue #473** — `feature-specification` job template restructure to brief-prose + scene-by-scene R-statements + mock-to-R cross-reference table as `spec-finalize` precondition + R-granularity rule rejecting compound SHALLs at author-time. **NOT in scope for #420 PR #497**; that's a separate piece of work on the FRAIM repo.

---

## Local-test environment — what's ready

`.env` files present (verified 2026-05-23):

| Path | Source | Purpose |
|---|---|---|
| `.env` (worktree root) | Copied from main worktree | `DATABASE_URL` (Postgres), `QUEUE_MODE=inline`, `EMAIL_PROVIDER=stub`, `CLERK_*` (test mode), `CEQ_*` |
| `apps/web/.env` | Copied from main worktree | Same env, Next.js dev server picks it up |
| `apps/api/.env` | Copied from main worktree | API server picks up via `dotenv -e .env -- tsx watch` |
| `apps/worker/.env` | **Copied from root `.env` this session** | `QUEUE_MODE=inline` here causes the worker to log `Worker not needed in inline mode — exiting cleanly` (apps/worker/src/index.ts:28-31). Without this, `pnpm dev` would fail on the worker subprocess. |
| `packages/database/.env` | Copied from main worktree | Prisma reads `DATABASE_URL` from here |

**Effect**: `pnpm dev` from the worktree root should bring up:
- API server on `http://127.0.0.1:4000` (inline queue mode — managed-email jobs run synchronously inside the API process)
- Web server on `http://localhost:3000` (with Clerk auth in test mode)
- Worker exits cleanly (no separate worker process needed for inline mode)
- Stub email connector (no real ACS emails — every send is logged + a fake messageId returned)

**Auth bypass for headless testing**: if the user wants to skip Clerk login for screenshot/playwright work, run the web dev with `NEXT_PUBLIC_DEV_BYPASS_AUTH=true PLAYWRIGHT_TEST=true` set on the web subprocess. Middleware short-circuits Clerk and admin routes render directly. **API still requires `DEV_BYPASS_AUTH=true` on the API process** to grant brand-scope without a Bearer token — set this too if hitting `/v1/...` routes from the bypass-mode web app. The API auto-picks the first Brand in the DB (`apps/api/src/plugins/auth.ts:46-55`) so a Brand row must exist in Postgres.

**Seeding test data**: `pnpm seed:demo` exists at the repo root. It needs an API key (`DEMO_API_KEY` or `MCP_API_KEY` env) or `X-Test-Brand-Id` test bypass. If the dev DB is empty, the simplest paths:
1. Set `DEV_BYPASS_AUTH=true` + a `DEV_BRAND_ID` env, sign in via Clerk dev mode, navigate to `/admin/surveys/new`, create a survey by hand.
2. Or seed the demo brand via direct Prisma write (`prisma studio` or a one-off script) — `DEMO_BRAND_ID=cmn689ibu000089tqad1g234t` is the default the seed script assumes.

---

## What I'd test manually if I were the user

The new session should walk every scene of `docs/feature-specs/mocks/420-send-via-customereq-acs.html` and verify the implementation matches. The Item-M audit at `docs/evidence/420-mock-walkthrough-audit.md` is the live closure record; cross-reference it during testing. Items flagged in the audit as **deferred per user 2026-05-23** ("revisit during manual testing") are the highest-priority discovery candidates:

- **5A.2** — CSV preview pane on SELF_SERVE Success state (mock lines 900–911). Is the absence acceptable, or does it impede the operator's workflow?
- **5B.1 / 5B.2 / 5B.4** — Sending-state headline (`Sending… N of M complete`), visual progress bar, "you can leave this page" reassurance copy (mock lines 947–967). Currently the implementation shows 4 Stat tiles + the SendProgressTable; how does it feel during an actual stub-send?
- **5C.1 / 5C.2 / 5C.3 / 5C.4** — Sent-state header text, sub-line, amber warning banner for partial failure, post-action context link (mock lines 991–1015).
- **5B.5** — SendProgressTable column count + visual fidelity vs mock recipient table (mock lines 952–962).
- **2B** — Custom-list paste against a non-email-keyed brand (mock #scene-2b). The Group headers + recovery hint were noted as needing visual confirmation against a seeded non-email-primary-id brand.
- **R7 mode-switch preserve-state** — switch mode mid-flow with a built audience; verify the audience + Survey Batch details survive the switch (ModeRouter primitive at `apps/web/src/components/mode-router/`).
- **R30a–d Live preview pane (M8 new surface)** — keystroke-driven, sample recipient is the first selected audience member. Verify the preview updates instantly on body/subject/sender edits and that `{{first_name}}` substitutes with the real first selected member's name.
- **R32a–f Confirmation modals (M7 new surfaces)** — both SELF_SERVE and MANAGED_EMAIL. Verify centered backdrop + summary block contents + warnings + Cancel/Yes buttons.
- **V13 emailOptIn exemption** — create a Member with `emailOptIn=false` and `consentGivenAt=now()` + `unsubscribedSurveysAt=null` and confirm the worker still sends to them (legitimate-interest exemption).

When the manual walkthrough produces issues, file them on this PR (don't split to follow-ups per Rule 26 + `[[fraim_phase11_stay_on_pr]]`). The user explicitly held Item H specifically to combine those findings with the existing 5 PR comments cited in `docs/evidence/420-feature-implementation-feedback.md`.

---

## What's still owed before Phase 12 can close

Only **Item H** remains. From the prior handoff:

> Post per-thread replies to the 5 review comments cited in the Round 1 feedback file at `docs/evidence/420-feature-implementation-feedback.md`. Each reply names the resolving commit SHA + a one-line summary. Per `[[check_pr_comments_before_merge]]`.
>
> Then call `seekMentoring(currentPhase='address-feedback', status='failure', findings={feedbackFile, roundNumber: 2, itemsAddressed: 5+})` to trigger the re-validation loop. **Phase 12 is a hold-point per Rule 25a — only `seekMentoring(status='complete')` after the user explicitly approves the round.**

**User's modification on 2026-05-23**: *"H — you can combine with any other comments and my test results."* So H now means: the agent waits for the user to produce a list of manual-test findings, combines that list with the 5 existing PR review comments, posts per-thread replies on each, then calls `seekMentoring(status='failure')` to trigger re-validation. The roundNumber and itemsAddressed counts shift to reflect the combined list.

**PR comments to address** (cheat sheet from the prior handoff — verify each resolution before posting):

| ID | File / line | Comment | Most likely resolving commit(s) |
|---|---|---|---|
| `r3292385788` | evidence-doc line 119 | "This needs to be implemented now. Cannot move to v1.1" | `459235f` (TipTap) + `7b8848e` (audience builder) + `1df5cb2` + `da92799` + `8b462e6` (M7 confirm modals) + `cbe32db` (M8 live preview) — every Round-1 Partial is now Met |
| `r3292386828` | evidence-doc line 120 | "How are scope modification decisions made in feature-implementation?" | Process answer in feedback doc + ALL deferrals lifted across this PR's commits + coaching artifacts captured + FRAIM #473 filed for the structural fix |
| `r3292070992` | RFC line 565 | "This is factually incorrect..." | `849ad17` (RFC factual fix) |
| `r3292073383` | RFC line 570 | "Lift it now. Don't punt architectural shortcuts based on 1st usage." | `9237905` + `69f69c1` + `ce11220` + `7b8848e` + `da92799` |
| `r3292074338` | RFC line 571 | "Not as a follow-up issue, but as an end of the feature implementation" | Same as `r3292073383` + `9b51b66` (F.2 §6 entry) |

When replying to `r3292386828`, include the coaching artifacts + FRAIM #473 link as evidence of the forward guard at the framework level — the user explicitly asked how scope modification decisions are made; the answer is: they aren't, except via external-blocker or spec-level-non-goal carve-outs documented in `420-implement-work-list.md`.

---

## How to resume

1. `cd "C:\Github\mathursrus\CustomerEQ - Issue 420"`.
2. `git pull` — sanity check; should be a no-op (push completed at session end).
3. Read **this handoff doc top-to-bottom**.
4. Read `fraim/personalized-employee/rules/project_rules.md` rules 24–27 (Rule 25a hold-point, Rule 26 one-PR-per-issue, Rule 27 Draft-until-completion).
5. Read `MEMORY.md` at `C:\Users\manoh\.claude\projects\C--Github-mathursrus-CustomerEQ\memory\` — pay particular attention to `[[always_open_html_mocks]]` (sharpened this session) and `[[spec_prose_is_not_a_deliverable]]` (new this session).
6. `mcp__fraim__fraim_connect` + `mcp__fraim__seekMentoring({ currentPhase: 'address-feedback', status: 'incomplete' })` (NOT `starting` — we're mid-round).
7. **Do NOT immediately re-run the audit.** The audit is closed at `docs/evidence/420-mock-walkthrough-audit.md`; the user is now doing manual testing, not Item-M-style walkthrough. Wait for the user's findings before doing anything else.
8. When the user reports findings:
   - **Log each finding to a running list — do NOT start fixing or analyzing immediately.** Capture what you need from transient data while it's still on screen (console messages, network responses, currently-rendered Playwright snapshot, the exact URL the user is on, screenshot if attached), because that data evaporates as the user keeps testing. **But don't analyze, don't propose fixes, don't dive into source code.** Just record the finding and wait for the next one. Continue logging until the user says *"fix these now"* (or equivalent batch-go signal) OR reports a blocking issue that stops all further testing — in which case fix that one blocker immediately so testing can resume, then keep logging the rest. Default behavior between findings is **silent capture**, not eager response. Rationale: the user is in a flow state walking the app; interrupting that flow with per-finding analysis costs throughput. Batch the analysis once the user signals they're done collecting.
   - When the user signals batch-go: classify each finding. If a finding lands within the deferred-per-user items (5A.2 / 5B.* / 5C.*), build the fix on the same branch — don't split.
   - If a finding surfaces drift the audit missed, file it as a row in the audit doc + close it in a commit + push.
   - Once all findings are addressed: build the combined Item-H reply list (manual-test findings + the 5 existing PR comments above), post per-thread replies citing resolving commits, then call `seekMentoring(currentPhase='address-feedback', status='failure', findings={…})` to trigger re-validation. **Do NOT call `status='complete'` until the user explicitly approves.**
9. After re-validation passes and user approves, that's when `seekMentoring(status='complete')` runs, which advances the workflow to `implement-submission`, which finally to `work-completion` (where `gh pr ready` flips Draft → Ready and merge is allowed).

---

## Non-negotiable rules to honor

- **No V0/follow-up framing.** Round-1 coaching, load-bearing.
- **Grep before claiming.** Round-2 coaching. Any factual claim about backend state must be verified against code / schema / migration.
- **Mocks are non-summarizable.** Round-3 coaching. Read every scene end-to-end before any code edit. Every visible affordance is in-scope unless explicitly flagged design-only.
- **Spec prose is not a deliverable.** Only R-statements are SHALL.
- **V15 cross-client real-inbox check** stays in §"External blockers" with the dependency cited verbatim ("no ACS production sender domain registered + no shared test inbox").
- **Rule 26 — one PR per issue.** No chore-issue splits.
- **Rule 25a — `address-feedback` is a hold-point.** Do not call `seekMentoring(status='complete')` until the user explicitly approves.
- **Rule 27 — PR stays Draft.** Auto-merge only flips to Ready via `gh pr ready` at `work-completion` time. Don't run `gh pr ready` from address-feedback.
- **`[[mock_drift_is_my_responsibility]]`** — close mock-to-implementation drift on this PR proactively. No follow-up issues for drift.
- **`[[validate_phase_must_run_build]]`** — `pnpm --filter @customerEQ/web build` (not just `tsc --noEmit`) before every commit.
- **`[[kill_dev_servers_from_top_of_process_tree]]`** — kill stale dev-server processes from this worktree only (filter CommandLine for `Issue 420`); top-of-tree, not listening leaves. `apps/worker/.env` is now present so `pnpm dev` won't crash on the worker subprocess (the worker exits cleanly under `QUEUE_MODE=inline`).
- **`[[check_pr_comments_before_merge]]`** — per-thread replies on PR comments at resolution time, citing the resolving commit SHA.
- **`[[no_ask_user_question_dialog]]`** — present choices as plain-text lists in chat; never use `AskUserQuestion`.

---

## File / path cheat sheet (current as of 2026-05-23 23:00 UTC)

| Concern | Path |
|---|---|
| **Item M audit doc** | `docs/evidence/420-mock-walkthrough-audit.md` (live closure-status record — read first) |
| **Item G evidence-doc** | `docs/evidence/420-feature-implementation-evidence.md` (Round-2 + Round-3 markers; 0 Unmet across both matrices; only V15 Partial) |
| **Item G work-list** | `docs/evidence/420-implement-work-list.md` (External blockers + Spec-level non-goals + Forward guards) |
| **Spec** | `docs/feature-specs/420-send-via-customereq-acs.md` (R1–R45 + R30a–e + R31a + R32a–f + Mock-to-R cross-reference table at bottom) |
| **Spec mock** | `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (11 scenes; Scene 7B extended in commit `8d4181b` to depict Composer Snapshot + Send Log) |
| **RFC** | `docs/rfcs/420-send-via-customereq-acs.md` |
| **Feedback doc (Round 1 sources)** | `docs/evidence/420-feature-implementation-feedback.md` |
| **Architecture doc** | `docs/architecture/architecture.md` (§3.1 ModeRouter + usePollingQuery; §6 two-gate suppression with Gate 1 paths) |
| **Mode-router primitive** | `apps/web/src/components/mode-router/{ModeRouter.tsx,index.ts,ModeRouter.test.tsx}` |
| **MustacheEditor (TipTap composer)** | `apps/web/src/components/managed-email-composer/{MustacheEditor,MustacheSuggestionList,mustacheTokens}.{ts,tsx}` |
| **EmailPreviewCard (R30a–d, new in M8)** | `apps/web/src/components/managed-email-composer/EmailPreviewCard.{tsx,test.tsx}` |
| **Polling hook** | `apps/web/src/lib/hooks/usePollingQuery.{ts,test.ts}` |
| **Shared send-mode pill** | `apps/web/src/components/surveys/SendModePill.{tsx,test.tsx}` |
| **Shared send-progress table** | `apps/web/src/components/surveys/SendProgressTable.{tsx,test.tsx}` |
| **Loop Monitor (R39 + M5)** | `apps/web/src/components/surveys/LoopMonitor.{tsx,test.tsx}` |
| **Audience builder** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/...` |
| **Shared Survey Batch details** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SurveyBatchDetailsCard.{tsx,test.tsx}` |
| **Shared suppression helper** | `packages/shared/src/distributionSuppression.{ts,test.ts}` |
| **SelfServeFlow (with M7 confirm modal)** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SelfServeFlow.tsx` |
| **ManagedEmailFlow (with M7 confirm modal + M8 preview)** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx` |
| **Survey-detail page (Scene 6 surfaces)** | `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` |
| **Responses header strip (R40)** | `apps/web/src/app/(admin)/admin/surveys/[id]/components/SurveyResponsesHeaderStrip.{tsx,test.tsx}` |
| **Wave Detail page (R-Wave-Detail surfaces)** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` |
| **Composer snapshot block (Item D)** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/ComposerSnapshotBlock.{tsx,test.tsx}` |
| **Recipient send log block (Item D.2)** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/RecipientSendLogBlock.tsx` |
| **Distribution Batches API** | `apps/api/src/routes/distributionBatches.ts` (GET list at line 798 with `sendMode` field; GET detail at line 848; `/send-progress` GET at line 1172) |
| **Loop Monitor API handler** | `apps/api/src/routes/surveys.ts` (`/loop-monitor`) |
| **Members API (R17 glob + R22 suppression)** | `apps/api/src/routes/members.ts` |
| **Worker — managed-email-send (Gate 2)** | `apps/worker/src/processors/managedEmailSend.ts` (`checkSuppression`) |
| **Batch schemas** | `packages/shared/src/zod/distributionBatch.schema.ts` |
| **Coaching artifacts (3 raw moments from this PR)** | `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T*-*.md` |
| **FRAIM-level structural fix** | https://github.com/mathursrus/FRAIM/issues/473 (`feature-specification` template restructure — out of #420's scope) |

---

## Environment state at handoff

- 22 commits on the feature branch since prior handoff `73533ab`, all pushed to `origin/feature/420-...`.
- Working tree: contains `.claude/scheduled_tasks.lock` (untracked, ignore — harness state).
- `pnpm-lock.yaml` is in sync with `package.json` (TipTap family + `@dnd-kit` deps from prior rounds; nothing new this session).
- All 5 `.env` files present in the worktree (see local-test environment section above).
- **No dev servers running** in this worktree at session end.
- `pnpm --filter @customerEQ/web build` was last run clean after commit `cbe32db` (M8).
- Vitest scoped runs: `EmailPreviewCard.test.tsx` 9/9, `SurveyResponsesHeaderStrip.test.tsx` 11/11, `LoopMonitor.test.tsx` 4/4, `DistributionSection.test.tsx` 9/9, plus existing suites all green on touched files.

Phase 12 status: **address-feedback INCOMPLETE — held pending user manual-test feedback**. `implement-architecture-update` complete (commit `9b51b66`). Coaching job `analyze-why-you-messed-up` complete in this session (FRAIM #473 filed; 3 raw coaching artifacts committed). PR stays Draft per Rule 27.
