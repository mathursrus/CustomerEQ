# Issue #420 — feature-implementation Phase 12 Handoff

**Issue**: [#420](https://github.com/mathursrus/CustomerEQ/issues/420) — Send Survey Emails via CustomerEQ (ACS)
**PR**: [#497](https://github.com/mathursrus/CustomerEQ/pull/497) (Draft)
**Branch**: `feature/420-use-azure-communication-services-to-send-survey-emails`
**Worktree**: `C:\Github\mathursrus\CustomerEQ - Issue 420`
**FRAIM job**: `feature-implementation`, currently in **Phase 12 `address-feedback`** mid-round.
**Session paused**: 2026-05-23 ~08:55 UTC. Reason: ~11–13h of remediation work remaining; user opted to split across sessions.

---

## The session this was paused mid-way through

Reviewer rejected the scope decisions captured in `docs/evidence/420-feature-implementation-evidence.md`'s §"Known V0 simplifications" block via PR review comments `r3292385788` (TipTap punt is unacceptable) and `r3292386828` ("How are scope modification decisions made in feature-implementation?"). Plus three RFC comments on §11.2: `r3292070992` (factual error about `/admin/surveys/new`), `r3292073383` (lift mode-parameterized pattern now), `r3292074338` (in this PR, not a follow-up issue).

Honest root-cause synthesis: the implementer (me) invented a "V0 simplification" tier to demote 11 in-scope SHALL requirements from spec/RFC without authority. There is **no sanctioned `feature-implementation` process** for an implementer to do that — `implement-scoping` locks scope from spec + RFC; `implement-completeness-review` audits it; nothing between authorizes a unilateral demotion. The framing was a recurrence of the `[[merit-over-ease]]` shortcut-shaped pattern, dressed in process language.

Coaching moment captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md`. **Do not re-introduce that framing.**

---

## What's landed on the branch this session (3 commits — pushed to origin)

| SHA | Summary | Closes review comment |
|---|---|---|
| `9237905` | `<ModeRouter>` primitive + 9 tests; `apps/web/src/components/mode-router/`. Extracted `SelfServeFlow` (~890 LoC) into `_components/`. Page.tsx is now a 33-line entry point. ManagedEmailFlow's "Switch to my email tool" anchor is now a `useModeRouter().switchTo` button. | `r3292073383` + `r3292074338` |
| `849ad17` | RFC §11.2 factual fix — removed fabricated peers (`/admin/surveys/new` vs `/edit`, `/admin/campaigns/[id]/preview`); named real precedent (`/admin/programs/new/page.tsx` uses `<ProgramWizard mode="create" />`); adopted "lift in this PR" framing for ModeRouter / `usePollingQuery` / two-gate suppression — all three land here, not as follow-up issues. | `r3292070992` |
| `459235f` | TipTap composer + Mention palette. New `apps/web/src/components/managed-email-composer/`: `MustacheEditor.tsx` (StarterKit + Link + custom Mention with `renderHTML/renderText` → literal `{{id}}`), `MustacheSuggestionList.tsx`, `mustacheTokens.ts` (single-source palette of 6 tokens). 13 tests. ManagedEmailFlow textarea replaced. New deps in `apps/web/package.json`: `@tiptap/react@3.23.6`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-mention`, `@tiptap/suggestion`, `tippy.js`. | `r3292385788` |

**Plus on disk, not committed yet:**
- `docs/evidence/420-feature-implementation-feedback.md` — Round 1 entries appended (5 comments transcribed; coaching moment cited).

**Validation evidence at pause time:**
- `pnpm --filter @customerEQ/web exec tsc --noEmit` — clean.
- `pnpm --filter @customerEQ/web build` — clean (Next 15.5.18 production build + lint-as-error).
- `pnpm --filter @customerEQ/web exec vitest run src/components/mode-router src/components/managed-email-composer` — **22/22 passing**.
- Full web test suite — 324/329 passing; same 5 pre-existing flakes (`PoweredByFooter`, `[id]/page.test.tsx`, `[id]/edit/page.test.tsx`) documented in regression report at lines 232–293 of `420-feature-implementation-evidence.md`. **No #420 regressions.**

---

## What's still owed before Phase 12 can complete

User confirmed only **item 12 (cross-client real-inbox check)** is a legitimate external blocker (no ACS production sender domain registered yet, no test inbox available). Everything else **must land in this PR** before `address-feedback` can call `seekMentoring(status='complete')`.

Estimated effort to finish: **~11–13 hours of focused work**, dominated by the audience-builder rebuild.

### Item A — Extract `usePollingQuery` hook + update 2 callsites (~1h)

Per the RFC §11.2 commitment in commit `849ad17`: there are now 2 consumers of `useEffect`-based polling (managed-email Sending state at `ManagedEmailFlow.tsx:208-239`, Loop Monitor at `LoopMonitor.tsx:89-97`). The shared hook lands in **this PR**, not a follow-up. Recommended location: `apps/web/src/lib/hooks/usePollingQuery.ts`.

**Test the hook directly** (jsdom-friendly: a hook returning `data` / `loading` / `error` / `refetch` with controllable poll interval). Then refactor both callsites + run the existing tests around them.

### Item B — Loop Monitor lifetime "Survey Sent" stat-card + sendMode breakdown (R39, V8) (~1h)

`apps/web/src/components/surveys/LoopMonitor.tsx`'s `stages[]` array already has a `surveysSent` stage but doesn't break it down by `sendMode`. Per spec §4.1 + R39: the lifetime-Sent surface gets a **mode-breakdown sub-line** (e.g., `12,341 sent · 8,210 via CustomerEQ · 4,131 via my email tool`). The drawer for `surveysSent` should also show the breakdown.

API side: `GET /v1/surveys/:id/loop-monitor` returns `pipeline.surveysSent` today as a single integer. Extend the response to include `pipeline.surveysSentByMode: { MANAGED_EMAIL: number; SELF_SERVE: number }`. Verify at `apps/api/src/routes/loopMonitor.ts` (or wherever the handler lives — grep first; don't trust this line citation 5 days later).

### Item C — Survey-detail Responses-section header strip (R40, V9) (~1h)

`apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx`'s Responses section gets a header strip showing **Wave-filtered Sent + Responses**. Per spec §4.2 + R40:
- Wave filter affects BOTH Sent and Responses (when an operator picks a Wave).
- Response-only filters (date range, sentiment scope) affect Responses only — Sent stays anchored to Wave.
- Loop Monitor §4.1 lifetime stat is unchanged (filter-agnostic).

API side: the existing Wave-detail query probably already exposes per-wave Sent count. Verify at `apps/api/src/routes/distributionBatches.ts`'s GET handlers.

### Item D — Wave Detail page extensions (~1h)

`apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx`:
- Add sendMode pill at the top (SELF_SERVE / MANAGED_EMAIL).
- For MANAGED_EMAIL batches, add a **Composer snapshot block** showing the operator's snapshotted Sender name / alias / subject / body (`composerSnapshot` JSON on `DistributionBatch`). Spec mock at `docs/feature-specs/mocks/420-send-via-customereq-acs.html` shows the layout — open before writing per `[[always_open_html_mocks]]`.
- Preserve all existing #378 SELF_SERVE affordances unchanged (Tokens table, Edit Expiry, Regenerate Links, Download CSV).

### Item E — **Audience builder rebuild** (R16, R18, R20, R22, R23, R43) (~6–8h) ★ Biggest piece

Currently both `SelfServeFlow.tsx`'s `<ModeChooser>` and `ManagedEmailFlow.tsx`'s inline audience UI implement audience selection in incompatible ways. Per spec §2.2 + R16/R18/R20/R22/R23/R43, both flows must **share** an audience builder shaped as:

- **Two cards side-by-side** (R16): Add from Existing Members + Add from Custom List. Today it's a radio-toggle between them.
- **Add from Existing Members** card has two tabs:
  - **Search** tab — wildcard (`*` / `?`) supported via backend `GET /v1/members?q=` which already calls `distributionGlob.globToSqlLike()`. Results in a table; operator multi-selects then clicks **Add N members**.
  - **Random Sample** tab — operator picks count/percent of all eligible non-ERASED members, sees a preview count, clicks **Add N members** (R18 — explicit Add button, not auto-add).
- **Add from Custom List** card — paste / CSV upload (today's `<CustomListBody>` shape is close; just needs to fit in the side-by-side grid).
- **25/50 pagination** (R20) on search results.
- **Accumulated audience list** below the two cards — every `Add` appends; operator can deselect individual rows or use bulk actions (R23).
- **Status column with chips** (R22, R43): `OK` / `Unsubscribed` / `No consent` / `Erased`. Suppressed rows render with checkbox **unchecked AND disabled**, opacity reduced, hover-tooltip explaining why and when (e.g., *"Hannah Mehta unsubscribed on 2026-04-12. Cannot receive survey emails until she resubscribes."*).
- **Shared between SELF_SERVE & MANAGED_EMAIL** — per spec §2 ordering ("Define batch attributes → Select members → Send"), the audience builder + the Survey Batch details card sit above the mode-specific composer. This means the **Survey Batch details card (surveyNameInMail + expiryPreset)** also needs to lift out of both flows' local state into a shared parent — or the audience builder + batch-details lift into a third shared container above both flows.

**Open the spec mock at `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (Scene 2 + 2B) BEFORE writing UI** per `[[always_open_html_mocks]]` and `[[mock_drift_is_my_responsibility]]`. The mock is the source of truth for verbiage, icons, layout, and the Status-chip styling.

Backend already supports the Status response shape (the audience-resolution path already returns suppressed reasons). Frontend wiring is the lift.

**Suggested file layout:**

```
apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/
  audience-builder/
    AudienceBuilder.tsx          # shell + accumulated-list state
    AddFromExistingMembersCard.tsx  # Search + Random Sample tabs
    SearchTab.tsx                # wildcard search + 25/50 pagination
    RandomSampleTab.tsx          # count/percent + explicit Add N button
    AddFromCustomListCard.tsx    # paste + upload (lifted from SelfServeFlow's CustomListBody)
    AudienceList.tsx             # accumulated list w/ Status chips + deselect + bulk
    suppressionChips.ts          # Status-chip vocabulary + colors
  SurveyBatchDetailsCard.tsx     # surveyNameInMail + expiryPreset (lifted)
```

Then refactor BOTH `SelfServeFlow.tsx` and `ManagedEmailFlow.tsx` to render the shared `<SurveyBatchDetailsCard>` + `<AudienceBuilder>` above their mode-specific composer/CTA.

### Item F — Phase 10 `implement-architecture-update` (~30m)

`docs/architecture/architecture.md` updates (already committed-to in commit `849ad17`):
- §3.1 — add entry for `<ModeRouter>` primitive (path: `apps/web/src/components/mode-router/`).
- §3.1 — add entry for `usePollingQuery` hook (once Item A lands).
- §6 (Compliance) — add subsection naming the two-gate suppression model (audience-builder Gate 1 + worker pre-dispatch Gate 2).

This is a doc-only commit. Call `seekMentoring(currentPhase='implement-architecture-update', status='complete')` after.

### Item G — Evidence-doc rewrite (~30m)

`docs/evidence/420-feature-implementation-evidence.md`:
- **Delete** the entire §"Known V0 simplifications" block (lines 117–125).
- **Replace** with §"External blockers" containing only item 12 (cross-client real-inbox check) with the dependency cited verbatim ("no ACS production sender domain registered; no shared test inbox").
- **Update the Traceability Matrix** — every Partial row that's been lifted must flip to **Met** with the new evidence path. Items still Partial after this session: only V15 (cross-client real-inbox).
- Add a Round-2 / Round-3 marker to the §Feedback Completeness Verification table.

### Item H — Per-thread PR replies + revalidation (~30m)

Post per-thread replies to the 5 review comments cited in the Round 1 feedback file at `docs/evidence/420-feature-implementation-feedback.md`. Each reply names the resolving commit SHA + a one-line summary. Per `[[check_pr_comments_before_merge]]`.

Then call `seekMentoring(currentPhase='address-feedback', status='failure', findings={feedbackFile, roundNumber: 1, itemsAddressed: 5})` to trigger the re-validation loop. Phase 12 is a hold-point per Rule 25a — only `seekMentoring(status='complete')` after the user **explicitly approves** the round.

---

## Recommended order for the next session

1. **Push order**: A (usePollingQuery) → F (arch doc, partial) → E (audience-builder rebuild — the marathon) → B (Loop Monitor card) → C (Responses header strip) → D (Wave Detail extensions) → F (arch doc, complete) → G (evidence rewrite) → H (replies + revalidation).
2. Items A + B + C all touch the polling pattern + Loop Monitor; doing A first means B and C build on the shared hook.
3. Item E is the biggest piece — start it after A/F so the foundation is solid, but don't sandwich it between many small items (mental-context cost). One full session block on Item E is realistic.
4. Commit after each logical unit; push every 2–3 commits so the user has rolling visibility.
5. Run `pnpm --filter @customerEQ/web build` after EVERY commit (per `[[validate_phase_must_run_build]]` — lint-as-error only fires inside `next build`, not `tsc --noEmit`).

---

## Non-negotiable rules to honor

- **No "V0 simplifications" / "V0 acceptable Partial" / "V1 polish" / "follow-up issue" framings.** This is the core coaching moment from this session. Every in-scope SHALL requirement is either Met or it's still owed in this PR. The only legitimate carve-out is a real external blocker named verbatim (item 12 cross-client inbox is the only one for #420).
- **Item 12 cross-client real-inbox check stays in §"External blockers"** with the dependency named (no ACS production sender domain registered + no shared test inbox). Do not relabel this as "V0 simplification" or expand it to cover anything else.
- **Rule 26 — one PR per issue, all phase artifacts ride on this branch.** No "chore-issue for the audience-builder rebuild" — it's another commit on this branch.
- **Rule 25a — address-feedback is a hold-point.** Do not call `seekMentoring(status='complete')` until the user explicitly says "proceed" / "approved" / "PR ready" after they've reviewed the full remediation. `status='failure'` triggers the re-validation loop; `status='complete'` is the only thing the user authorizes explicitly.
- **Rule 27 — PR stays Draft.** The auto-merge workflow only flips to Ready via `gh pr ready` at `work-completion` time. Don't run `gh pr ready` from address-feedback.
- **`[[always_open_html_mocks]]`** — open `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (Scene 2 + 2B + 3) BEFORE writing any audience-builder or composer UI. Don't trust summaries.
- **`[[mock_drift_is_my_responsibility]]`** — close mock-to-implementation drift proactively after the functional pass.
- **`[[validate_phase_must_run_build]]`** — `pnpm build` (not just `tsc --noEmit`) before every commit.
- **`[[kill_dev_servers_from_top_of_process_tree]]`** — if installing deps fails with EPERM on Windows, kill stale dev-server processes from the top of the process tree (the pnpm wrapper PIDs), not the listening leaves. Filter to only **this worktree's** processes (CommandLine contains `Issue 420`); leave other worktrees + MCP servers alone.
- **`[[check_pr_comments_before_merge]]`** — per-thread replies on PR comments at resolution time, citing the resolving commit SHA. The feedback file is the evidence record; PR-thread replies are the live communication channel.
- **`[[no_ask_user_question_dialog]]`** — present choices as plain-text lists in chat. Never use the `AskUserQuestion` tool.

---

## File / path cheat sheet

| Concern | Path |
|---|---|
| Mode-router primitive | `apps/web/src/components/mode-router/{ModeRouter.tsx,index.ts,ModeRouter.test.tsx}` |
| Managed-email composer | `apps/web/src/components/managed-email-composer/{MustacheEditor,MustacheSuggestionList,mustacheTokens}.{ts,tsx}` |
| Self-serve flow (extracted) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SelfServeFlow.tsx` |
| Managed-email flow | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx` |
| Distribute page (entry) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` |
| Mode types | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/modes.ts` |
| Loop Monitor | `apps/web/src/components/surveys/LoopMonitor.tsx` |
| Survey-detail page | `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` |
| Wave Detail page | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` |
| Spec | `docs/feature-specs/420-send-via-customereq-acs.md` (R1–R45 traceable requirements) |
| Spec mock (open before UI work) | `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (7 scenes) |
| RFC | `docs/rfcs/420-send-via-customereq-acs.md` (§5 frontend hierarchy; §11.2 lift commitments) |
| Evidence doc (to rewrite) | `docs/evidence/420-feature-implementation-evidence.md` |
| Feedback doc (Round 1 in progress) | `docs/evidence/420-feature-implementation-feedback.md` |
| Work-list (still references demoted items as "V0 simplifications" — update during Item G) | `docs/evidence/420-implement-work-list.md` |
| Coaching moment from this session | `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md` |
| Architecture doc (Phase 10 target) | `docs/architecture/architecture.md` |
| Backend glob translator | `packages/shared/src/distributionGlob.ts` (used by `GET /v1/members?q=`) |
| Backend ManagedEmailComposerSchema | `packages/shared/src/zod/distributionBatch.schema.ts` (body capped at 50 KB after #420-SR-001) |
| Backend renderTemplate (mustache substitution) | `packages/shared/src/email/renderTemplate.ts` |

---

## PR review-comment cheat sheet (5 comments to reply to during Item H)

| ID | File / line | Comment | Resolving commit |
|---|---|---|---|
| `r3292385788` | evidence-doc line 119 | "This needs to be implemented now. Cannot move to v1.1" | `459235f` |
| `r3292386828` | evidence-doc line 120 | "How are scope modification decisions made in feature-implementation?" | Process answer in feedback doc + ALL deferrals lifted across the session's commits |
| `r3292070992` | RFC line 565 | "This is factually incorrect. /admin/surveys/new redirects to /admin/surveys/[id]/edit today. Verify in code." | `849ad17` |
| `r3292073383` | RFC line 570 | "Lift it now. Don't punt architectural shortcuts based on 1st usage." | `9237905` (ModeRouter primitive + tests) |
| `r3292074338` | RFC line 571 | "Not as a follow-up issue, but as an end of the feature implementation" | `9237905` + planned Phase 10 arch update + `usePollingQuery` lift + two-gate suppression entry |

When replying to `r3292386828` specifically, the answer needs to include:
1. **Process answer**: there is no sanctioned process — surfaced as a coaching moment (path cited).
2. **Concrete delivery**: enumerate every previously-Partial item and its disposition (Met-this-session via commit SHA, Met-this-PR via planned items in the work-list, External blocker with dependency named for item 12 only).
3. **Forward guard**: the work-list at `docs/evidence/420-implement-work-list.md` now documents the rule (no implementer-initiated demotion) so the same gap can't recur on the next FRAIM-tracked feature.

---

## Environment state at handoff

- 3 local commits pushed to `origin/feature/420-...`. Working tree clean except `docs/evidence/420-feature-implementation-feedback.md` (Round 1 entries) + the coaching moment file — both intentional, not yet committed (commit them at the start of next session along with the work-list update from Item G).
- TipTap deps installed in `pnpm-lock.yaml` (the commit `459235f` includes it).
- Prisma client regenerated cleanly after stale-dev-server cleanup.
- **All Issue-420 dev servers were killed** during the session to release Prisma file locks. Next session can re-start them via `pnpm dev` when needed for verification.
- Other worktrees (`CustomerEQ`, `CustomerEQ - Issue 413`) still have their dev servers running — those are not mine to kill.

---

## How to resume

1. `cd "C:\Github\mathursrus\CustomerEQ - Issue 420"`
2. `git pull` (sanity check — should be a no-op since we just pushed)
3. Read this handoff doc top-to-bottom.
4. Read `fraim/personalized-employee/rules/project_rules.md` rules 24–27 (FRAIM mandate, hold-point discipline, one-PR-per-issue, draft-PR workflow).
5. Read `MEMORY.md` at `C:\Users\manoh\.claude\projects\C--Github-mathursrus-CustomerEQ\memory\`.
6. `mcp__fraim__fraim_connect` → `mcp__fraim__seekMentoring({ currentPhase: 'address-feedback', status: 'incomplete' })` to re-anchor in the phase rules.
7. Open the spec mock at `docs/feature-specs/mocks/420-send-via-customereq-acs.html` in a browser BEFORE starting Item E (audience-builder rebuild).
8. Start with Item A (usePollingQuery extraction) — small, builds confidence; A enables clean B/C work.
9. After each commit: `pnpm --filter @customerEQ/web build && pnpm --filter @customerEQ/web test`. Don't skip the build.
10. Push every 2–3 commits.
11. When everything in Items A–G is done: post the 5 PR replies (Item H), then call `seekMentoring(currentPhase='address-feedback', status='failure', findings={...})` to trigger the re-validation loop. Do NOT call `status='complete'` until the user explicitly approves the round (Rule 25a hold-point).
