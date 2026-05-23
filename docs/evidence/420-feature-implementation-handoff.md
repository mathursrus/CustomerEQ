# Issue #420 — feature-implementation Phase 12 Handoff

**Issue**: [#420](https://github.com/mathursrus/CustomerEQ/issues/420) — Send Survey Emails via CustomerEQ (ACS)
**PR**: [#497](https://github.com/mathursrus/CustomerEQ/pull/497) (Draft)
**Branch**: `feature/420-use-azure-communication-services-to-send-survey-emails`
**Worktree**: `C:\Github\mathursrus\CustomerEQ - Issue 420`
**FRAIM job**: `feature-implementation`, currently in **Phase 12 `address-feedback`** mid-round.
**Session paused**: 2026-05-23 ~10:00 UTC. Reason: Items A / F.1 / B / **E** landed; remaining work (C, D, M, F.2, G, H) split across sessions.

---

## Why the session was paused

User explicitly asked the resuming session to "Start with Item E (audience-builder rebuild — the marathon) per the recommended order and pause after it is complete." Item E is now done; the smaller items (C, D, M, F.2, G, H) carry over.

**Critical context** — the prior session captured a coaching moment at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md`. The implementer (Claude) had invented a "V0 simplification" tier to demote 11 in-scope SHALL requirements without process authority. There is **no sanctioned `feature-implementation` process` for an implementer to do that. **Do not re-introduce that framing in any artifact.** Every in-scope SHALL requirement is either Met or it's still owed in this PR. The only legitimate carve-out is a real external blocker named verbatim (V15 cross-client real-inbox check — no ACS production sender domain registered + no shared test inbox).

---

## What's landed on the branch (7 commits — all pushed to origin)

| SHA | Summary | Closes review comment |
|---|---|---|
| `9237905` | `<ModeRouter>` primitive + 9 tests; `apps/web/src/components/mode-router/`. Extracted `SelfServeFlow` (~890 LoC) into `_components/`. Page.tsx is now a 33-line entry point. ManagedEmailFlow's "Switch to my email tool" anchor is now a `useModeRouter().switchTo` button. | `r3292073383` + `r3292074338` |
| `849ad17` | RFC §11.2 factual fix — removed fabricated peers; named real precedent (`/admin/programs/new/page.tsx` uses `<ProgramWizard mode="create" />`); adopted "lift in this PR" framing for ModeRouter / `usePollingQuery` / two-gate suppression. | `r3292070992` |
| `459235f` | TipTap composer + Mention palette. New `apps/web/src/components/managed-email-composer/`: `MustacheEditor.tsx`, `MustacheSuggestionList.tsx`, `mustacheTokens.ts`. 13 tests. | `r3292385788` |
| `69f69c1` | **Item A** — `usePollingQuery` hook + 2 callsites refactor + folded-in pnpm-lock for TipTap deps. | continues lift commitment from `849ad17` |
| `ce11220` | **Item F.1** — Architecture doc §3.1 gains `<ModeRouter>` + `usePollingQuery` entries. The §6 Compliance two-gate suppression entry is held for F.2 (after Gate 1 is in code, which Item E delivered). | n/a |
| `703427f` | **Item B** — Loop Monitor Survey Sent surface gains the R39 per-mode breakdown sub-line + drawer-pill breakdown. Backend `GET /v1/surveys/:id/loop-monitor` adds `pipeline.surveysSentByMode`. New shared `<SendModePill>` component. | n/a |
| `7b8848e` | **Item E** — shared `<AudienceBuilder>` (R16/R18/R20/R22/R23/R43). Two side-by-side cards (Add from Existing Members w/ Search + Random Sample tabs; Add from Custom List). Accumulated list w/ Status chips, disabled checkboxes for suppressed rows, 25/50 pagination, bulk actions. Lifted `<SurveyBatchDetailsCard>`. Both flows refactored. Backend: `GET /v1/members` + `/preview` extended with `suppressionStatus` + `suppressionSince` per row (handoff's prior "backend already supports" claim was wrong — fixed in this commit). New `packages/shared/distributionSuppression.ts` single-source-of-truth (mirrors R44 dispatch-time check; `emailOptIn` intentionally excluded). 29 new tests, all passing. | n/a (lift commitment) |

**Validation evidence at pause time** (post-`7b8848e`):
- `pnpm --filter @customerEQ/shared exec tsc --noEmit` — clean.
- `pnpm --filter @customerEQ/web exec tsc --noEmit` — clean.
- `pnpm --filter @customerEQ/api exec tsc --noEmit` — clean.
- `pnpm --filter @customerEQ/web build` — clean (Next 15.5.18 production build + lint-as-error).
- Web vitest (full suite) — 372/375 passing. Same 3 pre-existing flakes (`PoweredByFooter`, `[id]/page.test.tsx`, `[id]/edit/page.test.tsx`) — **no #420 regressions**.
- API vitest (full suite) — 528/529 passing. The 1 failure is in `src/plugins/redis.test.ts` (Redis quit mock-null), pre-existing and unrelated to #420.
- Shared vitest — 724/724 passing (includes the 11 new `distributionSuppression` tests).
- New tests added this session: `distributionSuppression` (11), `suppressionChips` (5), `AudienceList` (8), `AudienceBuilder` integration (2), `SurveyBatchDetailsCard` (3). All passing.

---

## What's still owed before Phase 12 can complete

User confirmed only **V15 (cross-client real-inbox check)** is a legitimate external blocker (no ACS production sender domain registered yet, no test inbox available). Everything else **must land in this PR** before `address-feedback` can call `seekMentoring(status='failure')` (which triggers re-validation) — and ultimately `seekMentoring(status='complete')` only after the user explicitly approves the round per Rule 25a.

Estimated effort to finish: **~3–4 hours of focused work**.

### Item C — Survey-detail Responses-section header strip (R40, V9) (~1h)

`apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx`'s Responses section gets a header strip showing **Wave-filtered Sent + Responses**. Per spec §4.2 + R40:
- Wave filter affects BOTH Sent and Responses (when an operator picks a Wave).
- Response-only filters (date range, sentiment scope) affect Responses only — Sent stays anchored to Wave.
- Loop Monitor §4.1 lifetime stat is unchanged (filter-agnostic).

API side: the existing Wave-detail query probably already exposes per-wave Sent count. Verify at `apps/api/src/routes/distributionBatches.ts`'s GET handlers — grep first; don't trust this line citation.

Mock reference: lines 1077–1104 of `docs/feature-specs/mocks/420-send-via-customereq-acs.html` show the exact header-strip layout (Sent count | divider | Responses (filtered) | flex-spacer | Wave dropdown).

### Item D — Wave Detail page extensions (~1h)

`apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx`:
- Add **sendMode pill** at the top of the page — reuse the `<SendModePill>` from `apps/web/src/components/surveys/SendModePill.tsx` that Item B introduced. Use `size="md"` for the top-of-page header.
- For `MANAGED_EMAIL` batches, add a **Composer snapshot block** showing the operator's snapshotted Sender name / alias / subject / body (`composerSnapshot` JSON on `DistributionBatch`). Spec mock layout at `docs/feature-specs/mocks/420-send-via-customereq-acs.html` — open before writing per `[[always_open_html_mocks]]`.
- Preserve all existing #378 SELF_SERVE affordances unchanged (Tokens table, Edit Expiry, Regenerate Links, Download CSV).

### Item M — Mock-walkthrough UX audit (~1–2h)

**Trigger**: All UX-touching commits (B + C + D + E) are now in once C+D land.

**Procedure**:

1. Open `docs/feature-specs/mocks/420-send-via-customereq-acs.html` in a browser. Walk **every scene** — Scene 1 (entry tiles), Scene 2 (SELF_SERVE audience+batch+CSV), Scene 2B (Custom List + email-routing), Scene 3 (MANAGED_EMAIL composer + audience + confirm + Sending + Sent), Scene 4 (Wave Detail), Scene 5 (Loop Monitor Survey Sent breakdown), Scene 6 (Responses header strip), Scene 7 (Configuration summary post-send line).
2. For each scene, side-by-side compare the actual implemented page in the running dev server. Run via `pnpm dev` from this worktree (kill stale dev servers per `[[kill_dev_servers_from_top_of_process_tree]]` first — filter to processes whose CommandLine contains `Issue 420`; leave other worktrees alone).
3. File a per-scene drift checklist on disk at `docs/evidence/420-mock-walkthrough-audit.md`. For each drift item: scene name, mock line citation, implementation file:line, drift description, severity (verbiage / icon / layout / color / affordance / missing).
4. Close every drift item proactively on this PR per `[[mock_drift_is_my_responsibility]]` (drift is mine to close after the functional pass — no permission needed from user). One commit per scene or per drift class; don't bundle.
5. Re-run `pnpm --filter @customerEQ/web build` after each commit. Re-walk any scene that was edited.

**Particularly check for Item E drift**: the new audience-builder uses Tailwind chip styling (e.g., `bg-amber-50 text-amber-700`) — verify color contrast and chip shape match the mock's `var(--warning-soft)` / `var(--warning-strong)` palette. The mock's secondary-tabs styling is `class="secondary-tabs"` (no Tailwind equivalent yet) — verify the implemented tab toggle reads as clearly as the mock.

### Item F.2 — Phase 10 `implement-architecture-update` (complete) (~30m)

`docs/architecture/architecture.md` updates (already committed-to in commit `849ad17` and partially landed in commit `ce11220`):
- §6 (Compliance) — add subsection naming the **two-gate suppression model** (audience-builder Gate 1 + worker pre-dispatch Gate 2). Gate 1 landed in Item E (`packages/shared/distributionSuppression.ts` + `/v1/members` + `/preview` annotations + frontend disabled-checkbox enforcement).

This is a doc-only commit. Call `seekMentoring(currentPhase='implement-architecture-update', status='complete')` after — this is the **only** seekMentoring transition allowed before Item H (the address-feedback re-validation loop).

### Item G — Evidence-doc rewrite (~30m)

`docs/evidence/420-feature-implementation-evidence.md`:
- **Delete** the entire §"Known V0 simplifications" block (lines 117–125).
- **Replace** with §"External blockers" containing only V15 (cross-client real-inbox check) with the dependency cited verbatim ("no ACS production sender domain registered; no shared test inbox").
- **Update the Traceability Matrix** — every Partial row that's been lifted must flip to **Met** with the new evidence path. Items still Partial after this session: only V15 (cross-client real-inbox).
- Add a Round-2 / Round-3 marker to the §Feedback Completeness Verification table.

Also update `docs/evidence/420-implement-work-list.md` — strip "V0 simplifications" language; document the implementer-no-demotion rule as a forward guard.

### Item H — Per-thread PR replies + revalidation (~30m)

Post per-thread replies to the 5 review comments cited in the Round 1 feedback file at `docs/evidence/420-feature-implementation-feedback.md`. Each reply names the resolving commit SHA + a one-line summary. Per `[[check_pr_comments_before_merge]]`.

Then call `seekMentoring(currentPhase='address-feedback', status='failure', findings={feedbackFile, roundNumber: 1, itemsAddressed: 5})` to trigger the re-validation loop. **Phase 12 is a hold-point per Rule 25a — only `seekMentoring(status='complete')` after the user explicitly approves the round.**

---

## Recommended order for the next session

1. **Push order**: C (Responses header strip) → D (Wave Detail extensions) → **M (Mock-walkthrough UX audit)** → F.2 (arch doc, complete) → G (evidence rewrite) → H (replies + revalidation).
2. C + D are small and both touch surfaces Item E may have modified (the distribute path). Item D in particular consumes the `<SendModePill>` Item B already shipped.
3. Item M depends on C + D being in. It's a separate audit pass, not bundled with the implementation commits — drift fixes ride on their own per-scene commits per `[[mock_drift_is_my_responsibility]]`.
4. Commit after each logical unit; push every 2–3 commits so the user has rolling visibility.
5. Run `pnpm --filter @customerEQ/web build` after EVERY commit (per `[[validate_phase_must_run_build]]` — lint-as-error only fires inside `next build`, not `tsc --noEmit`).

---

## Non-negotiable rules to honor

- **No "V0 simplifications" / "V0 acceptable Partial" / "V1 polish" / "follow-up issue" framings.** This is the core coaching moment from the prior session and the user re-emphasized it in the resume prompt that kicked off Item E. Every in-scope SHALL requirement is either Met or it's still owed in this PR. The only legitimate carve-out is a real external blocker named verbatim (V15 cross-client inbox is the only one for #420).
- **V15 cross-client real-inbox check stays in §"External blockers"** with the dependency named (no ACS production sender domain registered + no shared test inbox). Do not relabel this as "V0 simplification" or expand it to cover anything else.
- **Rule 26 — one PR per issue, all phase artifacts ride on this branch.** No "chore-issue for the audit" — it's another commit on this branch.
- **Rule 25a — address-feedback is a hold-point.** Do not call `seekMentoring(status='complete')` until the user explicitly says "proceed" / "approved" / "PR ready" after they've reviewed the full remediation. `status='failure'` triggers the re-validation loop; `status='complete'` is the only thing the user authorizes explicitly. (The F.2 `seekMentoring(implement-architecture-update, status='complete')` is the **only** transition allowed before that point.)
- **Rule 27 — PR stays Draft.** The auto-merge workflow only flips to Ready via `gh pr ready` at `work-completion` time. Don't run `gh pr ready` from address-feedback.
- **`[[always_open_html_mocks]]`** — open `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (Scene 4 for Item D, Scene 6 for Item C, all scenes for Item M) BEFORE writing any UI. Don't trust summaries.
- **`[[mock_drift_is_my_responsibility]]`** — close mock-to-implementation drift proactively after the functional pass. Item M is the explicit pass for this; do not skip it.
- **`[[validate_phase_must_run_build]]`** — `pnpm build` (not just `tsc --noEmit`) before every commit.
- **`[[kill_dev_servers_from_top_of_process_tree]]`** — if installing deps fails with EPERM on Windows, kill stale dev-server processes from the top of the process tree (the pnpm wrapper PIDs), not the listening leaves. Filter to only **this worktree's** processes (CommandLine contains `Issue 420`); leave other worktrees + MCP servers alone.
- **`[[check_pr_comments_before_merge]]`** — per-thread replies on PR comments at resolution time, citing the resolving commit SHA. The feedback file is the evidence record; PR-thread replies are the live communication channel.
- **`[[no_ask_user_question_dialog]]`** — present choices as plain-text lists in chat. Never use the `AskUserQuestion` tool.
- **`[[merit_over_ease]]`** — never frame a deferred SHALL as "ease" or "drop-in swap". Lift it. (Item E backend extension is a concrete instance — the prior handoff incorrectly claimed "backend already supports", but the Status chip required `/v1/members` + `/preview` extension. That was lifted in `7b8848e`.)

---

## File / path cheat sheet

| Concern | Path |
|---|---|
| Mode-router primitive | `apps/web/src/components/mode-router/{ModeRouter.tsx,index.ts,ModeRouter.test.tsx}` |
| Managed-email composer | `apps/web/src/components/managed-email-composer/{MustacheEditor,MustacheSuggestionList,mustacheTokens}.{ts,tsx}` |
| Polling hook (Item A) | `apps/web/src/lib/hooks/usePollingQuery.{ts,test.ts}` |
| Shared send-mode pill (Item B) | `apps/web/src/components/surveys/SendModePill.{tsx,test.tsx}` |
| Loop Monitor (R39 breakdown) | `apps/web/src/components/surveys/LoopMonitor.{tsx,test.tsx}` |
| **Audience builder (Item E)** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/audience-builder/{AudienceBuilder,AddFromExistingMembersCard,SearchTab,RandomSampleTab,AddFromCustomListCard,AudienceList,suppressionChips,types,index}.{ts,tsx}` |
| **Shared Survey Batch details (Item E)** | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SurveyBatchDetailsCard.{tsx,test.tsx}` |
| **Shared suppression helper (Item E)** | `packages/shared/src/distributionSuppression.{ts,test.ts}` |
| Self-serve flow (refactored, Item E) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SelfServeFlow.tsx` |
| Managed-email flow (refactored, Item E) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx` |
| Distribute page (entry) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` |
| Mode types | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/modes.ts` |
| Survey-detail page (Item C target) | `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` |
| Wave Detail page (Item D target) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` |
| Loop Monitor API handler | `apps/api/src/routes/surveys.ts` (search `loop-monitor`) |
| Distribution Batches API (extended in Item E) | `apps/api/src/routes/distributionBatches.ts` |
| Members API (extended in Item E) | `apps/api/src/routes/members.ts` |
| Spec | `docs/feature-specs/420-send-via-customereq-acs.md` (R1–R45 traceable requirements) |
| Spec mock (open before UI work) | `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (7 scenes) |
| RFC | `docs/rfcs/420-send-via-customereq-acs.md` (§5 frontend hierarchy; §11.2 lift commitments) |
| Evidence doc (to rewrite — Item G) | `docs/evidence/420-feature-implementation-evidence.md` |
| Feedback doc (Round 1 in progress) | `docs/evidence/420-feature-implementation-feedback.md` |
| Work-list (update during Item G) | `docs/evidence/420-implement-work-list.md` |
| Mock-audit checklist (Item M output) | `docs/evidence/420-mock-walkthrough-audit.md` (new file — created by Item M) |
| Coaching moment from prior session | `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md` |
| Architecture doc (Phase 10 target — F.2 §6 entry) | `docs/architecture/architecture.md` |
| Backend glob translator | `packages/shared/src/distributionGlob.ts` (used by `GET /v1/members?q=`) |
| Backend ManagedEmailComposerSchema | `packages/shared/src/zod/distributionBatch.schema.ts` (body capped at 50 KB after #420-SR-001) |
| Backend renderTemplate (mustache substitution) | `packages/shared/src/email/renderTemplate.ts` |

---

## PR review-comment cheat sheet (5 comments to reply to during Item H)

| ID | File / line | Comment | Resolving commit(s) |
|---|---|---|---|
| `r3292385788` | evidence-doc line 119 | "This needs to be implemented now. Cannot move to v1.1" | `459235f` (TipTap) + `7b8848e` (audience builder) |
| `r3292386828` | evidence-doc line 120 | "How are scope modification decisions made in feature-implementation?" | Process answer in feedback doc + ALL deferrals lifted across this PR's commits |
| `r3292070992` | RFC line 565 | "This is factually incorrect. /admin/surveys/new redirects to /admin/surveys/[id]/edit today. Verify in code." | `849ad17` |
| `r3292073383` | RFC line 570 | "Lift it now. Don't punt architectural shortcuts based on 1st usage." | `9237905` (ModeRouter primitive) + `69f69c1` (usePollingQuery lift) + `ce11220` (arch doc §3.1) + `7b8848e` (shared audience-builder + SurveyBatchDetailsCard lift) |
| `r3292074338` | RFC line 571 | "Not as a follow-up issue, but as an end of the feature implementation" | `9237905` + `69f69c1` + `ce11220` + `7b8848e` + planned F.2 (arch doc §6 two-gate suppression — Gate 1 already in code via Item E) |

When replying to `r3292386828` specifically, the answer needs to include:
1. **Process answer**: there is no sanctioned process — surfaced as a coaching moment (path cited).
2. **Concrete delivery**: enumerate every previously-Partial item and its disposition (Met-this-session via commit SHA, Met-this-PR via planned items in the work-list, External blocker with dependency named for V15 only).
3. **Forward guard**: the work-list at `docs/evidence/420-implement-work-list.md` now documents the rule (no implementer-initiated demotion) so the same gap can't recur on the next FRAIM-tracked feature.

---

## Item E session — bugs surfaced + diagnostic notes

Two non-obvious issues hit during Item E that the next session should know about:

1. **Handoff-doc claim "backend already supports the Status response shape" was wrong.** Neither `GET /v1/members` nor `/preview` returned `unsubscribedSurveysAt` / `consentGivenAt` / suppression annotations per row. Item E extended both endpoints (~50 LoC backend) — `packages/shared/distributionSuppression.ts` is the single source of truth that mirrors the worker's R44 dispatch-time check. If you find yourself trusting a handoff-doc claim about backend state, **grep first** before assuming.

2. **Test-mock pitfall — useAuth() returning a fresh `getToken` reference each render.** The first AudienceBuilder integration test hung indefinitely because `vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'test-token' }) }))` creates a new `async` function on every `useAuth()` call. SearchTab's `useEffect(..., [..., getToken])` then re-fires every render → fetch starts → aborts → starts → infinite loop. Fix: hoist `mockGetToken` to a stable reference outside the mock factory. **If any future test mounts a component that destructures from `useAuth()`, do the same hoist.**

---

## Environment state at handoff

- 7 commits on the feature branch, all pushed to `origin/feature/420-...`.
- Working tree: contains `.claude/scheduled_tasks.lock` (untracked, ignore — harness state).
- `pnpm-lock.yaml` is in sync with `package.json`. Branch is installable under `--frozen-lockfile`.
- Prisma client regenerated cleanly via the root `postinstall` hook.
- **No dev servers running** in this worktree — kill any leftover ones (per `[[kill_dev_servers_from_top_of_process_tree]]`) before starting fresh ones for Item M.
- Other worktrees (`CustomerEQ`, `CustomerEQ - Issue 413`) may still have their dev servers running — those are not mine to kill.

---

## How to resume

1. `cd "C:\Github\mathursrus\CustomerEQ - Issue 420"`
2. `git pull` (sanity check — should be a no-op since we just pushed)
3. Read this handoff doc top-to-bottom.
4. Read `fraim/personalized-employee/rules/project_rules.md` rules 24–27 (FRAIM mandate, hold-point discipline, one-PR-per-issue, draft-PR workflow).
5. Read `MEMORY.md` at `C:\Users\manoh\.claude\projects\C--Github-mathursrus-CustomerEQ\memory\`.
6. `mcp__fraim__fraim_connect` → `mcp__fraim__seekMentoring({ currentPhase: 'address-feedback', status: 'incomplete' })` to re-anchor in the phase rules.
7. Open the spec mock at `docs/feature-specs/mocks/420-send-via-customereq-acs.html` in a browser BEFORE starting Item C (Scene 6) and Item D (Scene 4).
8. Start with **Item C** (Responses header strip) — it's the smallest unit that touches a surface Item E may have already modified, and unblocks Item D + Item M.
9. After each commit: `pnpm --filter @customerEQ/web build && pnpm --filter @customerEQ/web exec vitest run`. Don't skip the build.
10. Push every 2–3 commits.
11. After Items C + D are in, run **Item M** — the mock-walkthrough UX audit. File `docs/evidence/420-mock-walkthrough-audit.md` and close drift items in their own commits.
12. After Item M: F.2 → G → H. When everything is done: post the 5 PR replies (Item H), then call `seekMentoring(currentPhase='address-feedback', status='failure', findings={...})` to trigger the re-validation loop. Do NOT call `status='complete'` until the user explicitly approves the round (Rule 25a hold-point).
