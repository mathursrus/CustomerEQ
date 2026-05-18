# Issue #378 — Session handoff for next session (post-restart)

**Where this session ended**: Phase 12 (`address-feedback`) — fixed 14 of 15 walk-through issues from the manual UI pass. 2 commits unpushed on the local branch. Dev stack is down (user is restarting the machine). User has NOT re-verified the fixes yet.

**Where the next session starts**: bring the dev stack back up, ask the user to re-walk the same flow with focus on the items they already reported (especially the 100-email paste → expect "Parsed 100 entries"), close any remaining drift, then push.

---

## Required first-turn actions (next session)

1. **Skim this handoff doc first** so context is loaded.
2. **Skim** `docs/evidence/378-walkthrough-issues.md` — the running issue log with the user's verbatim reports + my per-issue resolution notes.
3. **Skim** `docs/feature-specs/mocks/378-distribute-flow.html` (L1 preference `feedback_always_open_html_mocks` — open the mock; do NOT rely on a summary).
4. **Verify .env files** are still present in the worktree (root, `apps/api`, `apps/web`); they should be — they were already in place this session and are gitignored.
5. **Bring the dev stack back up** (steps below). Do NOT auto-poll the live page or auto-advance — wait for the user to walk the flow.

---

## Bringing the dev stack back up

The Postgres + Redis containers may have been auto-started by Docker Desktop, OR they may need re-starting (they're shared between this worktree and the `mathursrus/CustomerEQ` main worktree).

```bash
# from C:/Github/mathursrus/CustomerEQ - Issue 378
docker compose ps                              # check if containers are already up
docker compose up -d                           # start postgres + redis if needed
pnpm dev                                       # next dev (web :3000), tsx watch (api :4000), worker, etc.
```

Watch for:
- **API** ready: `Server listening at http://127.0.0.1:4000`
- **Web** ready: `✓ Ready in N.Ns` on http://localhost:3000

Known pre-existing noise (NOT a regression — same in main worktree):
- Worker logs a Prisma `DATABASE_URL` error on the repeating `sla-breach-check` job. No `apps/worker/.env` exists in either worktree; the `survey-distribute` queue (#378's queue) still registers fine.
- Next.js dev shows `Route "/survey/[id]/r/[token]" used headers() …` warnings. Same warning fires on `/` and `/admin/.../batches/[batchId]` — shared middleware/CSP, not #378-specific. Tracked as walk-through issue #12 and deliberately deferred.

---

## State at handoff

### Branch
- `feature/378-personalized-survey-links-for-byo-email-distribution-tokenized-batches-sampling-and-recurring-waves`
- **20 commits ahead of `origin/main`**; **2 of those are NOT pushed yet** (`f19ab7c` and `37d00d4`).
- Working tree clean apart from an untracked `405-survey-edit-look-feel-attempt.png` screenshot left over from before this session — unrelated to #378, leave it alone.

### Unpushed commits (in order)

| SHA | Subject |
|---|---|
| `f19ab7c` | `fix(#378): walk-through drift closures — distribution, audience, CSV, respondent` |
| `37d00d4` | `fix(#378): paste truncation root cause — tighten CSV-mode sniff + surface parsed-row count` |

**Do NOT push these yet.** The user explicitly held off pushing so they could re-test on the hot-reloaded local dev. Once the dev stack is back up and the user re-walks the flow, push when they signal "looks good" or "ship it":

```bash
git push origin feature/378-personalized-survey-links-for-byo-email-distribution-tokenized-batches-sampling-and-recurring-waves
```

After pushing, add a PR comment on #385 summarising the drift-closure pass — bullet points should match the table below.

### PR
- **#385** — title: `impl(#378): personalized survey links for BYO-email — tokenized batches, sampling, and recurring waves`
- Labels: `status:needs-review`

### Issue
- **#378** — labels: `phase:implement`, `status:needs-review`

### Related issues opened earlier in #378's life (still open)
- **#414** — `survey-lifecycle.test.ts "activates DRAFT" pre-existing failure`. Not blocking #378.

### FRAIM phase ledger
| Phase | Status |
|---|---|
| 1–11 | ✓ done (see previous handoff) |
| **12 — address-feedback** | **↻ hold-point — current state.** 14/15 issues resolved on the local branch; need user re-verification + push. |
| 13 — retrospective | pending — runs after merge per Rule 26 |

---

## Walk-through issues — resolution status

Detail in `docs/evidence/378-walkthrough-issues.md`. Short version:

| # | Issue | Resolution | Commit |
|---|---|---|---|
| 1 | DistributionSection — 3-tile grid, "Send via email" right slot | ✅ Fixed | `f19ab7c` |
| 2 | Embed `{{...}}` hint scoped inside Embed tile | ✅ Fixed | `f19ab7c` |
| 3 | Icons on 3 tiles (🔗 / 🧩 / 📧) | ✅ Fixed | `f19ab7c` |
| 4 | Audience picker — both cards on one row | ✅ Fixed | `f19ab7c` |
| 5 | Count clamped to brand member total | ✅ Fixed | `f19ab7c` |
| 6 | Leading-zero UX (string-backed input) | ✅ Fixed | `f19ab7c` |
| 7 | Live preview stale on Count change | ✅ Fixed (AbortController) | `f19ab7c` |
| 8 | Percent/Count pill + dynamic helper text | ✅ Fixed | `f19ab7c` |
| 9 | CSV upload affordance | ✅ Fixed | `f19ab7c` |
| 10 | **[SPEC]** drop internal `memberId`, identifier = brand's term | ✅ Fixed (distribute + batch-detail regenerate) | `f19ab7c` |
| 11 | Duplicate Consent/Submit on respondent page | ✅ Fixed (wired SurveyFormRenderer props) | `f19ab7c` |
| 12 | Next.js `headers()` async warnings | ⏸ **Deferred** — fires on unrelated routes too; not #378-specific | — |
| 13 | `regenerated-<safeName>-<yyyymmdd>-links.csv` filename | ✅ Fixed | `f19ab7c` |
| 14 | Global `button { cursor: pointer }` + canonical CTA | ✅ Fixed (globals.css + DistributionSection) | `f19ab7c` |
| 15 | Paste truncation 100 → 75 | ✅ Fixed (parser bug) + ⚠ surfaced (body truncation) | `37d00d4` |

**Drive-by also in `f19ab7c`**: fixed CUSTOMER_ID → external_id mapping bug (the previous `.toLowerCase().replace('_', '_')` was a no-op leaving CUSTOMER_ID brands with a runtime `customer_id` value while the type said `external_id`).

---

## The story on issue 15 (the most subtle one)

The user pasted 100 valid emails and saw 75 stored. After empirical investigation:

1. **Hard cause** — `looksLikeCsv` sniff was too aggressive (`firstLine.includes(',') && body.includes('\n')`). A bare-email paste with trailing commas trivially matched and routed through `parseCsvBody`, which treats line 1 as a header row. **Lost 1 email** (the first). Fixed: new `bodyHasCsvHeader()` in `apps/api/src/utils/distributionListParser.ts` requires the first cell to be in `HEADER_ALIASES`. Regression test added.

2. **Soft cause** — the stored body was 4168 chars (ended mid-paste at `short076@dom.io`), so the API only received ~76 lines, not 100. **24 emails lost** somewhere between the user's clipboard and the JSON fetch. Couldn't reproduce in isolation; suspect a Windows + Chromium paste edge case into a `<textarea rows={6}>`. **Made the symptom impossible to miss**: API now returns `parsedRowCount` and the live preview renders "Parsed N entries from your input". If a re-paste shows "Parsed 76 entries" when the user thought they pasted 100, the operator sees it immediately and re-pastes.

### Verification request from the user

**Before pushing**, ask the user to:

1. Re-paste the same 100-email block (it's in `docs/evidence/378-walkthrough-issues.md` if needed — actually it's only in the chat history, not the file). Confirm the preview shows "100 members will receive · 100 will be auto-enrolled · Parsed 100 entries from your input."
2. If it shows fewer ("Parsed 76 entries…"), that's the still-unfixed body-truncation symptom — file a follow-up issue and dig deeper (likely needs a Playwright repro on the actual page in Windows+Chromium).
3. Walk the rest of the flow to confirm issues 1–14 are visually closed against `docs/feature-specs/mocks/378-distribute-flow.html`.

---

## Files changed in this session

```
apps/web/src/app/globals.css
apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx
apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx
apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx
apps/web/src/app/survey/[id]/r/[token]/page.tsx
apps/api/src/routes/distributionBatches.ts
apps/api/src/utils/distributionListParser.ts
apps/api/src/utils/distributionListParser.test.ts
packages/shared/src/zod/distributionBatch.schema.ts
docs/evidence/378-walkthrough-issues.md  (new — running issue log)
docs/evidence/378-handoff-next-session.md  (this file, rewritten)
```

Validation that passed at session end:
- `pnpm --filter @customerEQ/api exec tsc --noEmit` → green
- `pnpm --filter @customerEQ/web exec tsc --noEmit` → green
- `pnpm --filter @customerEQ/web build` (next build w/ lint-as-error) → green
- `pnpm --filter @customerEQ/web exec eslint src/` → 0 errors (10 pre-existing warnings unrelated to #378)
- `pnpm --filter @customerEQ/api test:smoke -- src/utils/distributionListParser.test.ts` → 490/490 pass (including 4 new `bodyHasCsvHeader` cases)

---

## Pinned context the next session must NOT forget

1. **Rule 25a — Phase 12 is the only sanctioned hold-point.** Mid-phase commit-boundary pauses are over-gating.
2. **Rule 26 — One PR per issue.** Any new drift-closure commits land on this branch + this PR.
3. **L1 preference `feedback_mock_drift_is_my_responsibility`** — close drift proactively after the user's functional pass; no per-item ask.
4. **L1 preference `feedback_always_open_html_mocks`** — read the mock directly.
5. **L1 preference `feedback_fraim_phase11_stay_on_pr`** — Phase 12 defects ride this PR; don't spawn chore-issues.
6. **L1 preference `feedback_validate_phase_must_run_build`** — `pnpm --filter @customerEQ/web build` (not just typecheck) before declaring done.
7. **Pre-existing test failure (#414)** is intentionally NOT fixed in #378.
8. **CSV `'`-prefix mitigation is rejected on merit** — Security Review Accepted section, do not re-litigate.
9. **`survey.distribute` RBAC** — reviewer-accepted V0 trade-off; do not implement a permission layer in this branch.
10. **The 2 unpushed commits await user verification** — do not push without their signal.

---

## After the user signals approval

1. `git push origin feature/378-personalized-survey-links-for-byo-email-distribution-tokenized-batches-sampling-and-recurring-waves`
2. Add a PR comment on #385 summarizing the drift-closure pass — paste the resolution-status table above.
3. Stay at the Phase 12 hold-point waiting for the merge signal.
4. On "merge": run `gh pr merge 385 --squash --delete-branch=false` (or git merge per user's preferred strategy), then the FRAIM `work-completion` job.
5. Phase 13 retrospective per `feature-implementation` workflow → write to `docs/retrospectives/manohar.madhira@outlook.com-issue-378-implement-postmortem.md`.
6. Capture any L0 coaching moments to `fraim/personalized-employee/learnings/raw/`.
