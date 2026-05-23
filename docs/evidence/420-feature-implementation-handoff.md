# Issue #420 — feature-implementation Phase 12 Handoff

**Issue**: [#420](https://github.com/mathursrus/CustomerEQ/issues/420) — Send Survey Emails via CustomerEQ (ACS)
**PR**: [#497](https://github.com/mathursrus/CustomerEQ/pull/497) (Draft)
**Branch**: `feature/420-use-azure-communication-services-to-send-survey-emails`
**Worktree**: `C:\Github\mathursrus\CustomerEQ - Issue 420`
**FRAIM job**: `feature-implementation`, currently in **Phase 12 `address-feedback`** mid-round.
**Session paused**: 2026-05-23 ~10:50 UTC. Reason: Items A / F.1 / B landed; remaining work (C, D, E, M, F.2, G, H) split across sessions.

---

## Why the session was paused

User explicitly asked the resuming session to "Start with Item A and B per the recommended order in §Recommended order". A and B are now done (plus the partial F.1 doc update that A unblocked). The marathon Item E (audience builder rebuild, 6–8h) and the remaining smaller items (C, D, M, F.2, G, H) carry over.

**Critical context** — the prior session captured a coaching moment at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md`. The implementer (Claude) had invented a "V0 simplification" tier to demote 11 in-scope SHALL requirements without process authority. There is **no sanctioned `feature-implementation` process** for an implementer to do that. **Do not re-introduce that framing in any artifact.** Every in-scope SHALL requirement is either Met or it's still owed in this PR. The only legitimate carve-out is a real external blocker named verbatim (V15 cross-client real-inbox check — no ACS production sender domain registered + no shared test inbox).

---

## What's landed on the branch (6 commits — all pushed to origin)

| SHA | Summary | Closes review comment |
|---|---|---|
| `9237905` | `<ModeRouter>` primitive + 9 tests; `apps/web/src/components/mode-router/`. Extracted `SelfServeFlow` (~890 LoC) into `_components/`. Page.tsx is now a 33-line entry point. ManagedEmailFlow's "Switch to my email tool" anchor is now a `useModeRouter().switchTo` button. | `r3292073383` + `r3292074338` |
| `849ad17` | RFC §11.2 factual fix — removed fabricated peers (`/admin/surveys/new` vs `/edit`, `/admin/campaigns/[id]/preview`); named real precedent (`/admin/programs/new/page.tsx` uses `<ProgramWizard mode="create" />`); adopted "lift in this PR" framing for ModeRouter / `usePollingQuery` / two-gate suppression — all three land here, not as follow-up issues. | `r3292070992` |
| `459235f` | TipTap composer + Mention palette. New `apps/web/src/components/managed-email-composer/`: `MustacheEditor.tsx` (StarterKit + Link + custom Mention with `renderHTML/renderText` → literal `{{id}}`), `MustacheSuggestionList.tsx`, `mustacheTokens.ts` (single-source palette of 6 tokens). 13 tests. ManagedEmailFlow textarea replaced. New deps in `apps/web/package.json`: `@tiptap/react@3.23.6`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-mention`, `@tiptap/suggestion`, `tippy.js`. | `r3292385788` |
| `b60ff8f` | Phase 12 session handoff doc + Round 1 feedback file (5 comments transcribed) + coaching-moment capture. | n/a |
| `69f69c1` | **Item A** — `usePollingQuery` hook + 2 callsites refactor. `apps/web/src/lib/hooks/usePollingQuery.ts` + 9 hook tests (immediate-fetch, cadence, disabled, flip-on/flip-off, error→recovery, refetch, post-unmount no-setState, fetchFn swap). `ManagedEmailFlow.tsx` Sending-state poll + `LoopMonitor.tsx` 60s refresh both now use the hook. **Also folded in:** the `pnpm-lock.yaml` entries that commit `459235f`'s package.json change required but never committed — the branch was uninstallable under `--frozen-lockfile`. | continues lift commitment from `849ad17` / r3292073383+r3292074338 |
| `ce11220` | **Item F.1** — Architecture doc §3.1 gains `<ModeRouter>` + `usePollingQuery` entries. The §6 Compliance two-gate suppression entry is held for F.2 (after Item E lands Gate 1 in code). | n/a |
| `703427f` | **Item B** — Loop Monitor Survey Sent surface gains the R39 per-mode breakdown sub-line + drawer-pill breakdown. Backend `GET /v1/surveys/:id/loop-monitor` adds `pipeline.surveysSentByMode: { MANAGED_EMAIL, SELF_SERVE }` via `SurveyDistribution.groupBy('sendMode')` (uses the dedicated `(surveyId, sendMode, sentAt)` and `(...deliveredAt)` indexes from the #420 migration). New shared `<SendModePill>` component (Managed indigo / Self-serve amber) reused by Item D. Tests: 3 LoopMonitor + 3 SendModePill + 1 API integration. Label updated to "Survey Sent" (singular) per spec mock §4.1. | n/a |

**Validation evidence at pause time** (post-`703427f`):
- `pnpm --filter @customerEQ/web exec tsc --noEmit` — clean.
- `pnpm --filter @customerEQ/api exec tsc --noEmit` — clean.
- `pnpm --filter @customerEQ/web build` — clean (Next 15.5.18 production build + lint-as-error).
- Web vitest (full suite) — 347/351 passing; same 4 pre-existing flakes (`PoweredByFooter`, `[id]/page.test.tsx`, `[id]/edit/page.test.tsx`) — **no #420 regressions**.
- API integration (full suite) — 427/428 passing; the 1 failure is in `apps/api/test/integration/events.test.ts > does not re-accept the same idempotencyKey` (idempotency-key flake, unrelated to #420 — pre-existing).
- New tests added this session: `usePollingQuery` (9), `SendModePill` (3), `LoopMonitor` (3 — R39 subline, drawer pills, fallback), API `surveysSentByMode` integration (1). All passing.

---

## What's still owed before Phase 12 can complete

User confirmed only **V15 (cross-client real-inbox check)** is a legitimate external blocker (no ACS production sender domain registered yet, no test inbox available). Everything else **must land in this PR** before `address-feedback` can call `seekMentoring(status='failure')` (which triggers re-validation) — and ultimately `seekMentoring(status='complete')` only after the user explicitly approves the round per Rule 25a.

Estimated effort to finish: **~9–11 hours of focused work**, dominated by the audience-builder rebuild.

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

### Item M — **NEW**: Mock-walkthrough UX audit (~1–2h)

**Trigger**: After Items B + C + D + E are all in (i.e., every UX-touching commit). User added this step explicitly: *"Audit implemented UX with an actual mock walk-thru and correct any drift."*

**Procedure**:

1. Open `docs/feature-specs/mocks/420-send-via-customereq-acs.html` in a browser. Walk **every scene** — Scene 1 (entry tiles), Scene 2 (SELF_SERVE audience+batch+CSV), Scene 2B (Custom List + email-routing), Scene 3 (MANAGED_EMAIL composer + audience + confirm + Sending + Sent), Scene 4 (Wave Detail), Scene 5 (Loop Monitor Survey Sent breakdown), Scene 6 (Responses header strip), Scene 7 (Configuration summary post-send line).
2. For each scene, side-by-side compare the actual implemented page in the running dev server. Run via `pnpm dev` from this worktree (kill stale dev servers per `[[kill_dev_servers_from_top_of_process_tree]]` first — filter to processes whose CommandLine contains `Issue 420`; leave other worktrees alone).
3. File a per-scene drift checklist on disk at `docs/evidence/420-mock-walkthrough-audit.md`. For each drift item: scene name, mock line citation, implementation file:line, drift description, severity (verbiage / icon / layout / color / affordance / missing).
4. Close every drift item proactively on this PR per `[[mock_drift_is_my_responsibility]]` (drift is mine to close after the functional pass — no permission needed from user). One commit per scene or per drift class; don't bundle.
5. Re-run `pnpm --filter @customerEQ/web build` after each commit. Re-walk any scene that was edited.

**Why this step exists**: prior session evidence at `docs/evidence/420-feature-implementation-evidence.md` shows multiple instances where the implemented page diverged from the mock on verbiage, icon choice, or affordance ordering — caught only at user-review time. This audit closes those gaps **before** the round goes back to the user, reducing iteration count.

### Item F.2 — Phase 10 `implement-architecture-update` (complete) (~30m)

`docs/architecture/architecture.md` updates (already committed-to in commit `849ad17` and partially landed in commit `ce11220`):
- §6 (Compliance) — add subsection naming the **two-gate suppression model** (audience-builder Gate 1 + worker pre-dispatch Gate 2). This is the entry that depends on Gate 1 being in code, which Item E lands.

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

1. **Push order**: E (audience-builder rebuild — the marathon) → C (Responses header strip) → D (Wave Detail extensions) → **M (Mock-walkthrough UX audit — NEW)** → F.2 (arch doc, complete) → G (evidence rewrite) → H (replies + revalidation).
2. Item E is the biggest piece — do it first while mental context is fresh. Don't sandwich it between many small items (mental-context cost). One full session block on Item E is realistic.
3. C + D are small and both touch surfaces Item E may have already modified (the distribute path); doing them after E means you're editing the post-E state, not racing it.
4. Item M depends on E + C + D being in. It's a separate audit pass, not bundled with the implementation commits — drift fixes ride on their own per-scene commits per `[[mock_drift_is_my_responsibility]]`.
5. Commit after each logical unit; push every 2–3 commits so the user has rolling visibility.
6. Run `pnpm --filter @customerEQ/web build` after EVERY commit (per `[[validate_phase_must_run_build]]` — lint-as-error only fires inside `next build`, not `tsc --noEmit`).

---

## Non-negotiable rules to honor

- **No "V0 simplifications" / "V0 acceptable Partial" / "V1 polish" / "follow-up issue" framings.** This is the core coaching moment from the prior session and the user re-emphasized it in this session's resume prompt. Every in-scope SHALL requirement is either Met or it's still owed in this PR. The only legitimate carve-out is a real external blocker named verbatim (V15 cross-client inbox is the only one for #420).
- **V15 cross-client real-inbox check stays in §"External blockers"** with the dependency named (no ACS production sender domain registered + no shared test inbox). Do not relabel this as "V0 simplification" or expand it to cover anything else.
- **Rule 26 — one PR per issue, all phase artifacts ride on this branch.** No "chore-issue for the audience-builder rebuild" — it's another commit on this branch.
- **Rule 25a — address-feedback is a hold-point.** Do not call `seekMentoring(status='complete')` until the user explicitly says "proceed" / "approved" / "PR ready" after they've reviewed the full remediation. `status='failure'` triggers the re-validation loop; `status='complete'` is the only thing the user authorizes explicitly. (The F.2 `seekMentoring(implement-architecture-update, status='complete')` is the **only** transition allowed before that point.)
- **Rule 27 — PR stays Draft.** The auto-merge workflow only flips to Ready via `gh pr ready` at `work-completion` time. Don't run `gh pr ready` from address-feedback.
- **`[[always_open_html_mocks]]`** — open `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (Scene 2 + 2B + 3 for Item E, Scene 4 for Item D, all scenes for Item M) BEFORE writing any UI. Don't trust summaries.
- **`[[mock_drift_is_my_responsibility]]`** — close mock-to-implementation drift proactively after the functional pass. Item M is the explicit pass for this; do not skip it.
- **`[[validate_phase_must_run_build]]`** — `pnpm build` (not just `tsc --noEmit`) before every commit.
- **`[[kill_dev_servers_from_top_of_process_tree]]`** — if installing deps fails with EPERM on Windows, kill stale dev-server processes from the top of the process tree (the pnpm wrapper PIDs), not the listening leaves. Filter to only **this worktree's** processes (CommandLine contains `Issue 420`); leave other worktrees + MCP servers alone.
- **`[[check_pr_comments_before_merge]]`** — per-thread replies on PR comments at resolution time, citing the resolving commit SHA. The feedback file is the evidence record; PR-thread replies are the live communication channel.
- **`[[no_ask_user_question_dialog]]`** — present choices as plain-text lists in chat. Never use the `AskUserQuestion` tool.
- **`[[merit_over_ease]]`** — never frame a deferred SHALL as "ease" or "drop-in swap". Lift it.

---

## File / path cheat sheet

| Concern | Path |
|---|---|
| Mode-router primitive | `apps/web/src/components/mode-router/{ModeRouter.tsx,index.ts,ModeRouter.test.tsx}` |
| Managed-email composer | `apps/web/src/components/managed-email-composer/{MustacheEditor,MustacheSuggestionList,mustacheTokens}.{ts,tsx}` |
| Polling hook (Item A) | `apps/web/src/lib/hooks/usePollingQuery.{ts,test.ts}` |
| Shared send-mode pill (Item B) | `apps/web/src/components/surveys/SendModePill.{tsx,test.tsx}` |
| Loop Monitor (R39 breakdown) | `apps/web/src/components/surveys/LoopMonitor.{tsx,test.tsx}` |
| Self-serve flow (extracted) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SelfServeFlow.tsx` |
| Managed-email flow | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx` |
| Distribute page (entry) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` |
| Mode types | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/modes.ts` |
| Survey-detail page (Item C target) | `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` |
| Wave Detail page (Item D target) | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` |
| Loop Monitor API handler | `apps/api/src/routes/surveys.ts` (search `loop-monitor`) |
| Distribution Batches API (Item C check) | `apps/api/src/routes/distributionBatches.ts` |
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
| `r3292385788` | evidence-doc line 119 | "This needs to be implemented now. Cannot move to v1.1" | `459235f` (TipTap) + this PR's Items A–E lift the rest |
| `r3292386828` | evidence-doc line 120 | "How are scope modification decisions made in feature-implementation?" | Process answer in feedback doc + ALL deferrals lifted across this PR's commits |
| `r3292070992` | RFC line 565 | "This is factually incorrect. /admin/surveys/new redirects to /admin/surveys/[id]/edit today. Verify in code." | `849ad17` |
| `r3292073383` | RFC line 570 | "Lift it now. Don't punt architectural shortcuts based on 1st usage." | `9237905` (ModeRouter primitive + tests) + `69f69c1` (`usePollingQuery` lift) + `ce11220` (arch doc §3.1 entries) |
| `r3292074338` | RFC line 571 | "Not as a follow-up issue, but as an end of the feature implementation" | `9237905` + `69f69c1` + `ce11220` + planned F.2 (arch doc §6 two-gate suppression after E lands) |

When replying to `r3292386828` specifically, the answer needs to include:
1. **Process answer**: there is no sanctioned process — surfaced as a coaching moment (path cited).
2. **Concrete delivery**: enumerate every previously-Partial item and its disposition (Met-this-session via commit SHA, Met-this-PR via planned items in the work-list, External blocker with dependency named for V15 only).
3. **Forward guard**: the work-list at `docs/evidence/420-implement-work-list.md` now documents the rule (no implementer-initiated demotion) so the same gap can't recur on the next FRAIM-tracked feature.

---

## Environment state at handoff

- 6 commits on the feature branch, all pushed to `origin/feature/420-...`.
- Working tree **clean** — no uncommitted files.
- `pnpm-lock.yaml` is now in sync with `package.json` (the missing TipTap entries from `459235f` were folded into `69f69c1`). Branch is installable under `--frozen-lockfile`.
- Prisma client regenerated cleanly via the root `postinstall` hook.
- **No dev servers running** in this worktree — kill any leftover ones (per `[[kill_dev_servers_from_top_of_process_tree]]`) before starting fresh ones for Item E or Item M.
- Other worktrees (`CustomerEQ`, `CustomerEQ - Issue 413`) may still have their dev servers running — those are not mine to kill.

---

## How to resume

1. `cd "C:\Github\mathursrus\CustomerEQ - Issue 420"`
2. `git pull` (sanity check — should be a no-op since we just pushed)
3. Read this handoff doc top-to-bottom.
4. Read `fraim/personalized-employee/rules/project_rules.md` rules 24–27 (FRAIM mandate, hold-point discipline, one-PR-per-issue, draft-PR workflow).
5. Read `MEMORY.md` at `C:\Users\manoh\.claude\projects\C--Github-mathursrus-CustomerEQ\memory\`.
6. `mcp__fraim__fraim_connect` → `mcp__fraim__seekMentoring({ currentPhase: 'address-feedback', status: 'incomplete' })` to re-anchor in the phase rules.
7. Open the spec mock at `docs/feature-specs/mocks/420-send-via-customereq-acs.html` in a browser BEFORE starting Item E (audience-builder rebuild).
8. Start with **Item E** (the marathon) — the recommended order has Item E first now, since A/B/F.1 are done.
9. After each commit: `pnpm --filter @customerEQ/web build && pnpm --filter @customerEQ/web exec vitest run`. Don't skip the build.
10. Push every 2–3 commits.
11. After Items B + C + D + E are all in (Items B is already in), run **Item M** — the mock-walkthrough UX audit. File `docs/evidence/420-mock-walkthrough-audit.md` and close drift items in their own commits.
12. After Item M: F.2 → G → H. When everything is done: post the 5 PR replies (Item H), then call `seekMentoring(currentPhase='address-feedback', status='failure', findings={...})` to trigger the re-validation loop. Do NOT call `status='complete'` until the user explicitly approves the round (Rule 25a hold-point).
