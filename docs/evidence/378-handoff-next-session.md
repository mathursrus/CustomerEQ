# Issue #378 — Session handoff for next session

**Where this session ended**: Phase 12 (`address-feedback`) hold-point — work is submitted on PR #385, two reviewer trade-offs resolved (1 RBAC accepted for V0, 2 CSV-injection accepted with explicit non-re-litigation rationale, 3 broken test filed as #414). Waiting on manual UI walk-through.

**Where the next session starts**: manual UI walk-through of the Distribute / Batch detail / Respondent flows + close any mock-to-implementation drift the user identifies.

---

## Required first-turn actions (next session)

1. **Skim this handoff doc first** so context is loaded.
2. **Skim** `docs/evidence/378-feature-implementation-evidence.md` for the per-phase summary + traceability matrices.
3. **Skim** `docs/feature-specs/mocks/378-distribute-flow.html` to internalise the visual source of truth (per L1 preference `feedback_always_open_html_mocks` — open the mock; do NOT rely on a summary).
4. Wait for the user to walk the flow in a browser. Do NOT auto-poll or auto-advance.

---

## State at handoff

### Branch
- `feature/378-personalized-survey-links-for-byo-email-distribution-tokenized-batches-sampling-and-recurring-waves`
- 18 commits ahead of `origin/main`, all pushed to remote.
- Latest commit: `f110d3f docs(#378): trade-offs 2 + 3 resolved post-review`

### PR
- **#385** — title: `impl(#378): personalized survey links for BYO-email — tokenized batches, sampling, and recurring waves`
- Labels: `status:needs-review`
- Body still reflects the spec phase (carried over from when the PR was opened during `feature-specification`). When the issue ships, `work-completion` will rewrite the body. For now, the most current summary is the PR comment posted at `https://github.com/mathursrus/CustomerEQ/pull/385#issuecomment-4472923759`.

### Issue
- **#378** — labels: `phase:implement`, `status:needs-review`

### Related issues opened during this session
- **#414** — `fix: survey-lifecycle.test.ts 'activates a DRAFT survey' fails due to factory title:null vs #241 MISSING_TITLE activation gate`. Filed per Rule 21 to keep #378 clean. Not blocking #378 merge; can be tackled on its own branch.

### FRAIM phase ledger
| Phase | Status |
|---|---|
| 1 — implement-scoping | ✓ done |
| 2 — implement-repro | N/A (feature, not bug) |
| 3 — implement-tests | ✓ done (strategy in work list; tests landed per-slice) |
| 4 — implement-code | ✓ done (S1–S7 of S10 — backend + frontend complete) |
| 5 — implement-validate | ✓ done (build + typecheck + lint + unit + integration all green for #378-specific surfaces; 1 pre-existing failure tracked in #414) |
| 6 — implement-security-review | ✓ done (0 Critical/High; 4 findings dispositioned) |
| 7 — implement-regression | ✓ done (17/17 turbo unit tests; 407/408 integration; `pnpm audit` clean for new deps) |
| 8 — implement-quality | ✓ done (Q-1 fixed; Q-2/3/4 record-only with V1 destinations) |
| 9 — implement-completeness-review | ✓ done (51/51 feature R-tags + NFRs Met; 17/17 design commitments Met) |
| 10 — implement-architecture-update | ✓ done (M-1..M-4 added to architecture.md §6) |
| 11 — implement-submission | ✓ done (push + PR retitle + label updates + PR comment) |
| **12 — address-feedback** | **↻ hold-point — current state of session** |
| 13 — retrospective | pending — runs after merge per Rule 26 |

### Resolved post-review trade-offs

| # | Trade-off | Disposition |
|---|---|---|
| 1 | `survey.distribute` RBAC not enforced (no permission layer in codebase yet) | **Accepted for V0** by reviewer. V0 gating matches existing `/v1/surveys/*` routes. |
| 2 | CSV-as-Excel-formula injection (`'`-prefix mitigation) | **Accept; do not re-litigate.** The `'`-prefix is Excel-specific (Excel strips `'` on read); Python `csv` / pandas / mail-merge templates read the literal `'` and would corrupt every name to `'Carlos`. Applying the mitigation actively breaks the primary use case (operator pipes CSV → Mailchimp/HubSpot/Klaviyo). Documented in the Security Review Accepted section. |
| 3 | `survey-lifecycle.test.ts` "activates DRAFT" pre-existing failure | **Filed as #414.** Verified scope: exactly one test in the codebase is broken; all other PATCH-to-ACTIVE tests target different entity activation gates. Out of scope for #378 per Rule 21. |
| 4 | Manual UI walk-through | **Pending — next session.** |

---

## What to do in the next session

### Step 1: User walks the flow

Per L1 preference `feedback_mock_drift_is_my_responsibility`, the user tests functionality directly. Wait for them. Likely walk-through (from the work list S5/S6 footprint):

1. **Configure → Generate happy path** (`/admin/surveys/<id>/distribute`)
   - Open an ACTIVE survey's detail page → click "Send via my email tool →"
   - Pick Existing Members (Count=N) OR Custom List (paste / CSV upload)
   - Live preview should populate with name + identifier + last-response columns
   - Click `Generate N links` → page transitions in place to Success state
2. **Success state**
   - Green banner with token count + expiry in brand TZ
   - Info line ("respond only once in this wave")
   - Amber STRONG WARNING banner
   - Format dropdown (Generic / Mailchimp / HubSpot / Klaviyo) + Download CSV
   - CSV downloads with 6 columns; `mergeTagUrl` contains `https://<host>/survey/<surveyId>/r/<token>`
3. **Respondent walk**
   - Open one of the CSV URLs in a fresh tab
   - Form loads; member-id field suppressed
   - Submit → thank-you screen
   - Re-click same URL → "This survey has already been submitted. Thank you for your response!"
4. **4 token-error pages with no-PII-in-DOM**
   - Expired: backdate batch's expiresAt in DB, click any URL
   - Survey-not-open: STOP the parent survey, click any URL
   - Invalid: hit `/survey/<id>/r/GARBAGE`
   - Inspect DOM in each error state — must contain no `memberId`, identifier, batch label
5. **Batch detail** (`/admin/surveys/<id>/distribute/batches/<batchId>`)
   - Header (label + status + counters)
   - Audience block (at-send-time + now counts)
   - Edit Expiry control (both directions)
   - Tokens table with friendly state labels
   - Regenerate links + download CSV → modal → confirm regenerates + downloads new CSV
6. **Filter row** on the survey detail page
   - Hidden when 0 batches + 0 direct responses
   - Shows batch options sorted createdAt DESC after a batch is created
   - "Direct responses (share link / embed)" option appears when share-link responses exist

### Step 2: I close drift

After the user reports back from the walk-through, I (next session) proactively close any visible drift between the mock at `docs/feature-specs/mocks/378-distribute-flow.html` and the implementation. No per-item ask — close drift directly. Most likely sources of drift:

- Copy verbatim mismatches (button labels, warning text)
- Status pill styling on the batch detail header
- Color choices (the spec mock uses amber for the warning banner; my impl should too — verify)
- Order of UI sections in the Success state per R16 (banner → info → amber warning → format → button → done link)
- Whether the "Wave: " label on the filter row matches the mock exactly

### Step 3: After drift is closed

- Run `pnpm exec turbo run build` + `pnpm typecheck` to confirm nothing broke
- Push fresh commits to PR #385
- Add a PR comment summarising the drift-closure pass
- Resume Phase 12 hold-point waiting for the user's signal to merge

### Step 4: Phase 13 retrospective (runs after merge per Rule 26)

When the user says "merge" or signals approval:
- Use `gh pr merge 385 --squash --delete-branch=false` OR `git merge` per the user's preferred merge strategy
- Run the FRAIM `work-completion` job (`resolution-merge` → `resolution-verification` → `resolution-cleanup`)
- Then run Phase 13 retrospective per `feature-implementation` workflow — write to `docs/retrospectives/manohar.madhira@outlook.com-issue-378-implement-postmortem.md`
- Capture any L0 coaching moments discovered during the walk-through to `fraim/personalized-employee/learnings/raw/`

---

## Files / locations the next session will most likely touch

| Area | Files |
|---|---|
| Mock reference (read-only — visual source of truth) | `docs/feature-specs/mocks/378-distribute-flow.html` |
| Distribute admin page | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` |
| Batch detail page | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` |
| Filter row | `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionBatchesFilter.tsx` |
| "Send via my email tool" tile | `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx` |
| Respondent tokenized page | `apps/web/src/app/survey/[id]/r/[token]/page.tsx` |
| Web datetime re-exports | `apps/web/src/lib/datetime.ts` (use `formatBrandAbsolute` for any new brand-TZ strings) |

---

## Pinned context the next session must NOT forget

1. **Rule 25a — Phase 12 is the only sanctioned hold-point.** Mid-phase commit-boundary pauses are over-gating (captured as L0 `2026-05-17T19-30-00-over-gated-mid-phase-commits-as-asking-for-deviation.md`).
2. **Rule 26 — One PR per issue.** Any commits arising from the mock-drift sweep land on this branch + this PR, not on spawned chore-issues.
3. **L1 preference: `feedback_mock_drift_is_my_responsibility`** — close drift proactively after the functional pass; no per-item ask.
4. **L1 preference: `feedback_always_open_html_mocks`** — read the mock directly; never rely on a summary for verbiage/icons/layout.
5. **Pre-existing test failure** is intentionally NOT fixed in #378; it lives on #414.
6. **CSV `'`-prefix mitigation is rejected on merit** — the documented decision in the Security Review Accepted section. Do not re-litigate.
7. **`survey.distribute` RBAC** — reviewer-accepted V0 trade-off. Do not implement a permission layer in this branch.

---

## Quick reference — running the dev stack locally

```bash
# from C:/Github/mathursrus/CustomerEQ - Issue 378
docker compose up -d              # Postgres + Redis must be up
pnpm install                       # postinstall runs db:generate (Issue #383)
pnpm db:migrate                    # ensures the 20260517000000_distribution_batches migration is applied
pnpm dev                           # starts API on :4000, web on :3000
```

Open `http://localhost:3000/admin/surveys` after signing in via Clerk → pick an ACTIVE survey → click "Send via my email tool →".

If Clerk auth is the friction point, the integration-test bypass header `X-Test-Brand-Id: <brandId>` works in `NODE_ENV=test` only; for dev use the normal Clerk session.
