# Issue #420 — feature-implementation Phase 12 Handoff

**Issue**: [#420](https://github.com/mathursrus/CustomerEQ/issues/420) — Send Survey Emails via CustomerEQ (ACS)
**PR**: [#497](https://github.com/mathursrus/CustomerEQ/pull/497) (Draft)
**Branch**: `feature/420-use-azure-communication-services-to-send-survey-emails`
**Worktree**: `C:\Github\mathursrus\CustomerEQ - Issue 420`
**FRAIM job**: `feature-implementation`, currently in **Phase 12 `address-feedback`** mid-round.
**Session paused**: 2026-05-23 ~18:20 UTC. Reason: Items C + D + D.2 landed; remaining work (M / F.2 / G / H) carry over. User explicitly asked to pause before Item M.

---

## Why the session was paused

User asked Round 2 of Phase 12 to land C + D and pause for review before Item M (the mock-walkthrough UX audit). C + D + D.2 are in (D.2 is a spec §3.2 surface that the prior pause-summary almost demoted to a follow-up; it's now landed).

**Critical context** — the prior session captured a coaching moment at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md`. There is **no sanctioned `feature-implementation` process for an implementer to demote in-scope SHALL requirements without process authority. Do not re-introduce that framing.** Every in-scope SHALL requirement is either Met or it's still owed in this PR. The only legitimate carve-out is a real external blocker named verbatim (V15 cross-client real-inbox check — no ACS production sender domain registered + no shared test inbox).

**Newer coaching moment** (Round 2, this session) at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T18-14-24-trusted-spec-prose-without-grepping-route.md`. I claimed `/send-progress` was "SSE-only" based on spec prose without grepping the route. Reality: it's a plain GET polled at 2s. User caught it; the lift took 30 minutes. Rule for next session: **any factual claim about backend state must be grepped at source before stating it**, especially when the claim gates a scope decision.

---

## What's landed on the branch (10 commits — all pushed to origin)

| SHA | Summary |
|---|---|
| `9237905` | `<ModeRouter>` primitive + 9 tests; refactor of distribute page to 33-line entry; ManagedEmailFlow "Switch" wired via `useModeRouter().switchTo`. (Round 1 R3 lift) |
| `849ad17` | RFC §11.2 factual fix — real precedent cited; "lift in this PR" framing for ModeRouter / usePollingQuery / two-gate suppression. (Round 1 r3292070992) |
| `459235f` | TipTap composer + Mention palette; `apps/web/src/components/managed-email-composer/`. 13 tests. |
| `69f69c1` | **Item A** — `usePollingQuery` hook + 2 callsites refactor + pnpm-lock for TipTap. |
| `ce11220` | **Item F.1** — architecture doc §3.1 entries for `<ModeRouter>` + `usePollingQuery`. |
| `703427f` | **Item B** — Loop Monitor R39 per-mode breakdown + drawer-pill breakdown + shared `<SendModePill>`. |
| `7b8848e` | **Item E** — shared `<AudienceBuilder>` (R16/R18/R20/R22/R23/R43) + lifted `<SurveyBatchDetailsCard>` + new `packages/shared/distributionSuppression.ts` (Gate 1 of the two-gate suppression). 29 new tests. |
| `2b92502` | (Prior session handoff doc — superseded by THIS file.) |
| `ed0afac` | **Item C** (R40 / V9) — `<SurveyResponsesHeaderStrip>` consolidates Sent + filtered Responses + Wave dropdown into one row at the top of Responses. Replaces the standalone `<DistributionBatchesFilter>` (deleted). 9 tests. |
| `1df5cb2` | **Item D** (§3.2) — Wave Detail mode pill (`<SendModePill size="md">`) + read-only `<ComposerSnapshotBlock>` for MANAGED_EMAIL batches + Regenerate-Links hidden for MANAGED_EMAIL. Backend extends `GET /distribution-batches/:batchId` with `sendMode + composerSnapshot`. 5 unit + 1 schema + 2 API integration tests. |
| `da92799` | **Item D.2** (§3.2) — per-recipient send log on Wave Detail. Extracts `<SendProgressTable>` out of `ManagedEmailFlow` into `apps/web/src/components/surveys/`, reused by both the live Sending state and the new historical `<RecipientSendLogBlock>` on Wave Detail. Polling auto-stops on `isComplete`. 9 new tests. Includes the SSE/polling coaching moment. |

**Validation evidence at pause time** (post-`da92799`):
- `pnpm --filter @customerEQ/shared exec tsc --noEmit` — clean.
- `pnpm --filter @customerEQ/web exec tsc --noEmit` — clean.
- `pnpm --filter @customerEQ/api exec tsc --noEmit` — clean.
- `pnpm --filter @customerEQ/web build` — clean (Next 15.5.18 production build + lint-as-error).
- Shared vitest — 725/725 passing.
- Web vitest scoped runs — every new file's tests pass; `page.test.tsx` is the known pre-existing flake (handoff Round 1 noted it; passes in isolation).
- New tests this session: `SurveyResponsesHeaderStrip` (9), `ComposerSnapshotBlock` (5), `SendProgressTable` (9), `distributionBatch.schema` (+1), `distributionBatches.test.ts` (+2).

---

## What's still owed before Phase 12 can complete

V15 (cross-client real-inbox check) is the only legitimate external blocker. Everything else **must land in this PR** before `address-feedback` can call `seekMentoring(status='failure')` (which triggers re-validation) — and ultimately `seekMentoring(status='complete')` only after the user explicitly approves the round per Rule 25a.

Estimated effort to finish: **~2.5–3 hours of focused work**.

### Item M — Mock-walkthrough UX audit (~1–2h)

**Trigger**: All UX-touching commits (B + C + D + D.2 + E) are now in.

**Procedure**:

1. Open `docs/feature-specs/mocks/420-send-via-customereq-acs.html` in a browser. Walk **every scene** — Scene 1 (entry tiles), Scene 2 (SELF_SERVE audience+batch+CSV), Scene 2B (Custom List + email-routing), Scene 3 (MANAGED_EMAIL composer + audience + confirm + Sending + Sent), Scene 4 (Wave Detail SELF_SERVE — `#scene-7a`), Scene 4B (Wave Detail MANAGED_EMAIL — `#scene-7b`), Scene 5 (Loop Monitor Survey Sent breakdown), Scene 6 (Responses header strip — lines 1077–1104), Scene 7 (Configuration summary post-send line).
2. Side-by-side compare the actual dev-server pages. Start dev via `pnpm dev` from this worktree (kill stale dev servers from this worktree first per `[[kill_dev_servers_from_top_of_process_tree]]` — filter to processes whose CommandLine contains `Issue 420`; leave other worktrees alone).
3. File the audit at `docs/evidence/420-mock-walkthrough-audit.md`. For each drift item: scene name, mock line citation, implementation file:line, drift description, severity (verbiage / icon / layout / color / affordance / missing).
4. Close every drift item proactively on this PR per `[[mock_drift_is_my_responsibility]]`. One commit per scene or per drift class; don't bundle.
5. Re-run `pnpm --filter @customerEQ/web build` after each commit. Re-walk any edited scene.

**Particular drift to look for** in scenes touched this session:
- **Scene 6 (Responses strip)**: the mock at line 1087 says *"(lifetime · not affected by Wave filter)"* — that is **mock drift from the spec post-Round-6 clarification**. The implementation correctly follows spec R40 (Wave filter affects BOTH Sent and Responses). Mock should be updated to match spec, not the other way around — file as drift, fix the mock.
- **Scene 4 (Self-serve Wave Detail)**: SendModePill is new (md size). Verify the pill color matches the mock's `mode-self-serve` chip (amber-50/700).
- **Scene 4B (Managed Wave Detail)**: ComposerSnapshotBlock + RecipientSendLogBlock are new. The mock at `#scene-7b` cuts off (lines 1265–1335) before depicting these blocks — that's mock incompleteness, not implementation drift. Either extend the mock to depict the new blocks or note the gap in the audit doc.
- **Scene 5 (Loop Monitor breakdown)**: verify drawer-pill breakdown styling matches the mock at lines 1050–1054.

### Item F.2 — Phase 10 `implement-architecture-update` (complete) (~30m)

`docs/architecture/architecture.md` updates (already committed-to in commit `849ad17` and partially landed in commit `ce11220`):
- §6 (Compliance) — add subsection naming the **two-gate suppression model** (audience-builder Gate 1 + worker pre-dispatch Gate 2). Gate 1 landed in Item E (`packages/shared/distributionSuppression.ts` + `/v1/members` + `/preview` annotations + frontend disabled-checkbox enforcement). Gate 2 is the worker pre-dispatch check (already implemented in `apps/worker/src/processors/managedEmailSend.ts`).

Doc-only commit. After landing, call `seekMentoring(currentPhase='implement-architecture-update', status='complete')` — this is the **only** seekMentoring transition allowed before Item H.

### Item G — Evidence-doc rewrite (~30m)

`docs/evidence/420-feature-implementation-evidence.md`:
- **Delete** the entire §"Known V0 simplifications" block.
- **Replace** with §"External blockers" containing only V15 (cross-client real-inbox check) with the dependency cited verbatim ("no ACS production sender domain registered; no shared test inbox").
- **Update the Traceability Matrix** — every Partial row that's been lifted must flip to **Met** with the new evidence path. After this session: only V15 remains Partial.
- Add a Round-2 / Round-3 marker to the §Feedback Completeness Verification table. Round 2 = this session (Items C/D/D.2 + the SSE coaching moment).

Also update `docs/evidence/420-implement-work-list.md` — strip "V0 simplifications" language; document the implementer-no-demotion rule AND the spec-prose-vs-grep rule as forward guards.

### Item H — Per-thread PR replies + revalidation (~30m)

Post per-thread replies to the 5 review comments cited in the Round 1 feedback file at `docs/evidence/420-feature-implementation-feedback.md`. Each reply names the resolving commit SHA + a one-line summary. Per `[[check_pr_comments_before_merge]]`.

Then call `seekMentoring(currentPhase='address-feedback', status='failure', findings={feedbackFile, roundNumber: 2, itemsAddressed: 5+})` to trigger the re-validation loop. **Phase 12 is a hold-point per Rule 25a — only `seekMentoring(status='complete')` after the user explicitly approves the round.**

---

## Recommended order for the next session

1. **Push order**: M (audit) → F.2 (arch doc complete) → G (evidence rewrite) → H (PR replies + revalidation).
2. Item M now has the full surface — every UX-touching commit (B/C/D/D.2/E) is in. Don't skip; this is the drift-closure pass.
3. Run `pnpm --filter @customerEQ/web build` after EVERY commit (per `[[validate_phase_must_run_build]]`).
4. Push every 2–3 commits.
5. The handoff doc itself is now in commit history (`2b92502` was the prior version; this file supersedes it).

---

## Non-negotiable rules to honor

- **No "V0 simplifications" / "follow-up issue" framing.** Coaching moment from Round 1, still load-bearing.
- **Grep before claiming.** Coaching moment from Round 2 — any factual claim about backend state ("X is SSE", "Y already supports Z", "would require a new endpoint") must be verified against code, schema, or migration. Spec prose is NOT a source of truth for capability claims.
- **V15 cross-client real-inbox check stays in §"External blockers"** with the dependency named (no ACS production sender domain registered + no shared test inbox).
- **Rule 26 — one PR per issue.** No chore-issue splits.
- **Rule 25a — address-feedback is a hold-point.** Do not call `seekMentoring(status='complete')` until the user explicitly approves. The F.2 `seekMentoring(implement-architecture-update, status='complete')` is the **only** transition allowed before that point.
- **Rule 27 — PR stays Draft.** Auto-merge only flips to Ready via `gh pr ready` at `work-completion` time. Don't run `gh pr ready` from address-feedback.
- **`[[always_open_html_mocks]]`** — open `docs/feature-specs/mocks/420-send-via-customereq-acs.html` BEFORE Item M; don't trust summaries.
- **`[[mock_drift_is_my_responsibility]]`** — close mock-to-implementation drift proactively after the functional pass. Item M is the explicit pass for this.
- **`[[validate_phase_must_run_build]]`** — `pnpm build` (not just `tsc --noEmit`) before every commit.
- **`[[kill_dev_servers_from_top_of_process_tree]]`** — when starting dev for Item M, kill stale dev-server processes from this worktree only (filter CommandLine for `Issue 420`).
- **`[[check_pr_comments_before_merge]]`** — per-thread replies on PR comments at resolution time, citing the resolving commit SHA.
- **`[[no_ask_user_question_dialog]]`** — present choices as plain-text lists; never use `AskUserQuestion`.

---

## File / path cheat sheet

| Concern | Path |
|---|---|
| Mode-router primitive | `apps/web/src/components/mode-router/{ModeRouter.tsx,index.ts,ModeRouter.test.tsx}` |
| Managed-email composer | `apps/web/src/components/managed-email-composer/{MustacheEditor,MustacheSuggestionList,mustacheTokens}.{ts,tsx}` |
| Polling hook | `apps/web/src/lib/hooks/usePollingQuery.{ts,test.ts}` |
| Shared send-mode pill | `apps/web/src/components/surveys/SendModePill.{tsx,test.tsx}` |
| **Shared send-progress table (Item D.2)** | `apps/web/src/components/surveys/SendProgressTable.{tsx,test.tsx}` |
| Loop Monitor (R39 breakdown) | `apps/web/src/components/surveys/LoopMonitor.{tsx,test.tsx}` |
| Audience builder | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/...` |
| Shared Survey Batch details | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SurveyBatchDetailsCard.{tsx,test.tsx}` |
| Shared suppression helper | `packages/shared/src/distributionSuppression.{ts,test.ts}` |
| Self-serve flow | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SelfServeFlow.tsx` |
| Managed-email flow | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx` |
| Distribute page (entry) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` |
| **Survey-detail page** (Item C target) | `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` |
| **Responses header strip (Item C)** | `apps/web/src/app/(admin)/admin/surveys/[id]/components/SurveyResponsesHeaderStrip.{tsx,test.tsx}` + `waveTypes.ts` |
| **Wave Detail page** (Item D target) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` |
| **Composer snapshot block (Item D)** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/ComposerSnapshotBlock.{tsx,test.tsx}` |
| **Recipient send log block (Item D.2)** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/RecipientSendLogBlock.tsx` |
| Distribution Batches API | `apps/api/src/routes/distributionBatches.ts` (GET detail at line 848; `/send-progress` GET at line 1172) |
| Loop Monitor API handler | `apps/api/src/routes/surveys.ts` (`/loop-monitor`) |
| Members API | `apps/api/src/routes/members.ts` |
| Batch schemas | `packages/shared/src/zod/distributionBatch.schema.ts` |
| Spec | `docs/feature-specs/420-send-via-customereq-acs.md` (R1–R45 traceable requirements) |
| Spec mock | `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (7 scenes) |
| RFC | `docs/rfcs/420-send-via-customereq-acs.md` |
| Evidence doc (to rewrite — Item G) | `docs/evidence/420-feature-implementation-evidence.md` |
| Feedback doc (Round 2) | `docs/evidence/420-feature-implementation-feedback.md` |
| Work-list (update during Item G) | `docs/evidence/420-implement-work-list.md` |
| Mock-audit checklist (Item M output — new file) | `docs/evidence/420-mock-walkthrough-audit.md` |
| Architecture doc (F.2 target) | `docs/architecture/architecture.md` |
| Coaching moments (this PR has 2) | `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T*-*.md` |

---

## PR review-comment cheat sheet (5 comments to reply to during Item H)

| ID | File / line | Comment | Resolving commit(s) |
|---|---|---|---|
| `r3292385788` | evidence-doc line 119 | "This needs to be implemented now. Cannot move to v1.1" | `459235f` (TipTap) + `7b8848e` (audience builder) + `1df5cb2` + `da92799` (Wave Detail surfaces) |
| `r3292386828` | evidence-doc line 120 | "How are scope modification decisions made in feature-implementation?" | Process answer in feedback doc + ALL deferrals lifted across this PR's commits |
| `r3292070992` | RFC line 565 | "This is factually incorrect..." | `849ad17` |
| `r3292073383` | RFC line 570 | "Lift it now. Don't punt architectural shortcuts based on 1st usage." | `9237905` (ModeRouter) + `69f69c1` (usePollingQuery) + `ce11220` (arch doc) + `7b8848e` (AudienceBuilder + SurveyBatchDetailsCard) + `da92799` (SendProgressTable extraction) |
| `r3292074338` | RFC line 571 | "Not as a follow-up issue, but as an end of the feature implementation" | Same as r3292073383 + planned F.2 (arch §6 two-gate suppression) |

When replying to `r3292386828` specifically, include:
1. **Process answer**: no sanctioned implementer-initiated demotion process — coaching moment cited (Round 1 + Round 2).
2. **Concrete delivery**: enumerate every previously-Partial item and its disposition (Met-this-session via commit SHA, Met-this-PR, or External blocker with dependency named for V15 only).
3. **Forward guard**: work-list documents the no-demotion rule AND the grep-before-claiming rule so the same gaps can't recur.

---

## Round 2 session — bugs surfaced + diagnostic notes

1. **`/send-progress` is plain GET polled at 2s, NOT SSE.** I claimed the opposite in my pause-summary based on spec-prose ("API endpoints describes it as SSE"). User caught it; cost a round. The lift took 30 min. Coaching moment at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T18-14-24-trusted-spec-prose-without-grepping-route.md`. Rule for next session: **grep before claiming backend state**.

2. **`Survey.distributionCount` vs `Survey.sentCount` may be a discrepancy.** Loop Monitor (`apps/api/src/routes/surveys.ts:1142`) reports `surveysSent: survey.distributionCount`, but spec R36 designates `Survey.sentCount` as the canonical denormalized aggregate. The Responses header strip (Item C) uses `survey.sentCount` per spec. If both columns drift, Loop Monitor + Responses-strip will show different lifetime values. Verify during Item M whether they're maintained in lockstep (worker writes to both? or just sentCount? — grep `distributionCount` and `sentCount` writers).

3. **The `DistributionBatchesFilter` standalone row is deleted** (consolidated into the header strip). If any future code/tests reference it, they'll need updating. Grep already confirmed only docs/retrospectives mention it now.

---

## Environment state at handoff

- 10 commits on the feature branch, all pushed to `origin/feature/420-...`.
- Working tree: contains `.claude/scheduled_tasks.lock` (untracked, ignore — harness state).
- `pnpm-lock.yaml` is in sync with `package.json`. Branch is installable under `--frozen-lockfile`.
- Prisma client regenerated cleanly via the root `postinstall` hook.
- **No dev servers running** in this worktree.

---

## How to resume

1. `cd "C:\Github\mathursrus\CustomerEQ - Issue 420"`
2. `git pull` (sanity check — should be a no-op since we just pushed).
3. Read this handoff doc top-to-bottom.
4. Read `fraim/personalized-employee/rules/project_rules.md` rules 24–27.
5. Read `MEMORY.md` at `C:\Users\manoh\.claude\projects\C--Github-mathursrus-CustomerEQ\memory\`.
6. `mcp__fraim__fraim_connect` → `mcp__fraim__seekMentoring({ currentPhase: 'address-feedback', status: 'incomplete' })`.
7. Open the spec mock at `docs/feature-specs/mocks/420-send-via-customereq-acs.html` in a browser BEFORE starting Item M.
8. Start with **Item M** — walk every scene, file the audit at `docs/evidence/420-mock-walkthrough-audit.md`, close each drift in its own commit.
9. After each commit: `pnpm --filter @customerEQ/web build`. Don't skip the build.
10. Push every 2–3 commits.
11. After Item M: F.2 → G → H. When everything is done: post the 5 PR replies (Item H), then call `seekMentoring(currentPhase='address-feedback', status='failure', findings={...})` to trigger the re-validation loop. Do NOT call `status='complete'` until the user explicitly approves the round (Rule 25a hold-point).
