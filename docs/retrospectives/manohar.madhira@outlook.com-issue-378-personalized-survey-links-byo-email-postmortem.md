---
author: manohar.madhira@outlook.com
date: 2026-05-17
synthesized:
---

# Postmortem: Personalized survey links for BYO-email distribution — Issue #378

**Date**: 2026-05-17
**Duration**: 2 days (2026-05-15 → 2026-05-17), feature-specification phases 1–7
**Objective**: Spec the BYO-email survey-link distribution surface — tokenized batches, sampling primitive, recurring waves with one-per-wave attribution, audit-clean URL shape with no PII
**Outcome**: success — spec, mock, evidence, and feedback files landed on PR #385; RFC scheduled for a new session

## Executive Summary

The feature-specification job for #378 ran end-to-end across 4 review rounds (R1 → R2 → R2.1 → R3 → R3.1) over 2 days, addressing 56 feedback items total. The spec is in good shape — but the cost of getting there exposed a recurring "shortcut" pattern in my recommendations that the user named explicitly: I had been optimizing for diff size / "minimal delta" / "drop-in swap" framings instead of long-term-correct shapes, which created two visible misses on this issue (R3-9 invented host + path, R3.1 followup proposed `?t={token}` query-param) and one Rule-26 misread (R3 bundled production code edits into a spec-phase commit). All three were caught by user pushback rather than by my own pre-submit audit. A new feedback memory (`merit-over-ease`) was added during this issue to cover the family.

## Architectural Impact

**Has Architectural Impact**: No

The spec phase produced design-level decisions (token table, distribution-batch entity, unique-constraint move, opaque token URL shape) that will hit the architecture doc at RFC / impl time. No architecture-doc edits required at the spec stage; the design just declares what the impl will land.

## Timeline of Events

### Phase 1 — context-gathering (2026-05-15)
- ✅ **Read issue body + comments**: 4 problem statements, 4 success criteria, explicit "Spec via FRAIM" directive in issue body.
- ✅ **Cross-referenced #241** (survey admin UX) for existing share-link, embedded, and trigger flows.
- ✅ **Loaded business context**: replicate roadmap, architecture doc, business-validation report per Rule 17.

### Phase 2 — spec-drafting (2026-05-15)
- ✅ **Initial 30-requirement spec** with 4-step wizard, sampling-seed UI, filter predicate, Revoke remaining, Re-run-with-same-audience, 3 download cards, standalone Distribution batches section.
- ❌ **Invented URL shape `/s/{id}/r/{token}` and host `acmecoffee.customereq.io` without checking how URLs are actually constructed in code.** This drift persisted unnoticed through R1 → R2 → R2.1 (caught at R3-9 with the wrong correction, then properly at R3.1).
- ✅ **High-fidelity HTML mock** at `docs/feature-specs/mocks/378-distribute-flow.html` (9 scenes) — no markdown mocks per spec-job principle.

### Phase 3 — competitor-analysis (2026-05-15)
- ✅ **Researched 8 vendors** (SurveyMonkey, Qualtrics XM, Delighted, Medallia, HubSpot Service Hub, Typeform, AskNicely, GetFeedback). Documented the BYO-email-with-tokenized-CSV gap in the mid-market tier.
- ✅ **Live evidence from three vendor docs** converging on `/r/<token>` path shape (the correct shape) — which makes the R1 invention more glaring in hindsight: I HAD the evidence that `/r/<token>` was the convention; I just attached it to a wrong prefix (`/s/` instead of `/survey/`).
- ✅ **Recommended `fraim/config.json.competitors` addition** (deferred to impl-phase commit per Rule 26 in R3.5).

### Phase 4 — spec-completeness-review (2026-05-15)
- ✅ **L1 self-audit fired**: surfaced two perpendicular-axis gaps (responsePolicy=LATEST_OVERWRITES × tokenized batches, batch-revoke audit captured WHO/WHEN but not WHY). Added R21b + R26 WHY-column before user asked. Captured in commit 6546825.
- ✅ **Coverage matrix** in evidence doc — every issue Problem and Success Criterion mapped to one or more R# entries.

### Phase 5 — spec-submission (2026-05-15)
- ❌ **Over-gated push+PR on first attempt** — asked user to confirm before pushing, despite Rule that "push + PR is the default flow." User invoked `follow-your-mentor`; L1 correction landed without user re-coaching. Coaching moment captured.
- ✅ **PR #385 opened** with full spec, mock, evidence, feedback file, and per-comment threading scaffolding.

### Phase 6 — address-feedback (2026-05-15 → 2026-05-17)
- ✅ **Round 2 (2026-05-15)**: 20 chat-based UX iteration items addressed in commit 3c8f037 — collapsed wizard to single short page, dropped predicate (V1.x), dropped Revoke remaining (replaced with Edit Expiry), token-state vocabulary made operator-friendly.
- ✅ **Round 2.1 (2026-05-15)**: 6 mock-review items addressed in commit cb00c7c — Decision A locked (mutually exclusive audience modes), Custom List paste accepts `Name <email>` form, preview columns updated.
- ❌ **Round 3 commit 72d1c5a (2026-05-17 00:46)**: addressed 30 PR review comments AND bundled production code edits (trigger endpoint deletion in `apps/api/src/routes/public.ts`, demo SDK migration in `examples/acme-coffee-demo`, `fraim/config.json` competitors block) — **misread Rule 26 phase discipline**. User caught it: *"Why did you make Code changes in this commit? Did you not follow FRAIM?"*
- ✅ **Round 3.5 revert (2026-05-17 08:04)**: commit 48b34a8 reverted the 6 non-spec files, softened spec text from "deleted in this PR" → "lands in impl-phase commits on this same PR." Raw learning captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-17T07-44-28-code-changes-in-spec-phase-pr.md`.
- ❌ **Round 3.1 URL correction prompted (2026-05-17 08:37)**: user pushback *"app.customereq.io is NOT the correct domain. Check how the Survey distribution URLs are created."* Round 3 R3-9 reply was wrong on TWO axes (subdomain + path).
- ❌ **R3.1 first response slip (`?t={token}` proposal)**: when correcting, I initially suggested `/survey/{id}?t={token}` as "minimal route delta drop-in for the retiring `?email=`." Internally inconsistent — the same query-string-as-credential leakage arguments that justify retiring `?email=` apply identically to `?t={token}`. User caught it: *"So why did you suggest ?t= - knowing that we were retiring ?email=?"*
- ❌ **Asked-instead-of-looked slip**: when picking the production host, asked user for direction when `customereq.wellnessatwork.me` was already in the grep results I had just fetched (apps/demo-storefront/.../page.tsx:8 fallback). User correction: *"Why do you ask me instead of looking in the current Survey Distribution links?"*
- ✅ **New feedback memory landed mid-session**: `merit-over-ease` (`feedback_merit_over_ease.md`) at user's direct instruction: *"Don't optimize for development time or ease. Aim for what is best in long term... You give me shortcuts all the time and then cause problems down the road. The issue list is ballooning for this reason."* Indexed in MEMORY.md.
- ✅ **R3.1 commit d922428**: 13 URL/path refs in spec + 5 mock URLs + 2 evidence/feedback entries updated. Per-thread reply posted with full file:line citation chain.
- ✅ **Hold-point release signal**: user signaled *"I am done on the review. Will start RFC in a new session"* (2026-05-17). Per Rule 25a, address-feedback closes on explicit signal — closed via seekMentoring.

### Phase 7 — retrospective (2026-05-17, this document)

## Root Cause Analysis

### 1. **Primary Cause — Shortcut-shaped recommendations**
**Problem**: Across two consecutive R3.1 turns, I proposed inferior shapes (`app.customereq.io/s/{id}/r/{token}` host+path, then `?t={token}` query param) as "drop-in" / "minimal-delta" fixes. Both required user pushback to redirect to the right answer.
**What drove it**: Framing the decision around code-change-size and cosmetic compatibility with the existing API surface, instead of around the underlying merit axis (security / leakage / convention / long-term clarity). Specifically: I had the right arguments — the query-string-leakage points that justify retiring `?email=`, the SurveyMonkey/GetFeedback/Typeform path-segment convention citations — sitting in my response from competitor-analysis, but I didn't apply them to my own counter-proposals.
**Corpus conflict**: No prior corpus entry endorsed shortcuts directly, but the absence of an explicit "merit before ease" rule allowed the pattern to recur. User created the rule mid-session (`feedback_merit_over_ease.md`) precisely because corrections were happening repeatedly across this issue and prior ones. This is the canonical "missing rule" pattern — the corpus had nothing to fire against the wrong reasoning.
**Impact**: 2 extra correction turns + 1 new memory entry written; user explicitly named issue-list ballooning as the downstream cost across sessions.

### 2. **Contributing Factor — Inventing shapes without checking existing code**
**Problem**: R1's spec invented `acmecoffee.customereq.io/s/<surveyId>/r/<token>` from whole cloth. The wrong shape rode through R2, R2.1, into R3 where I "corrected" it to a different wrong shape (`app.customereq.io/s/{id}/r/{token}`), without grepping the codebase for the actual URL constructors. The right answer was on disk the entire time at five different files (`DistributionSection.tsx:109`, `developer.ts:43`, `public.ts:657`, `loyaltyEvents.ts:333`, demo-storefront fallback `:8`).
**What drove it**: Treating spec-phase URL shapes as design-fiction (something to design fresh) instead of as spec-phase contracts that must match what the impl will land. The `mock-drift-is-my-responsibility` memory exists for post-impl drift but I read it as not applying during spec-phase. It does — the inverse direction is just as binding (spec must match what code already does for shared shapes).
**Corpus conflict**: `feedback_mock_drift_is_my_responsibility` arguably should have fired earlier — it's about HTML mocks vs implementation, not URL specs, but the principle is the same. The new `merit-over-ease` memory point #4 ("Before inventing a new shape, grep the codebase for the same area first") now covers this explicitly.
**Impact**: 4 review rounds spent with wrong URL shape; 13 spec references + 5 mock URLs to fix in R3.1.

### 3. **Contributing Factor — Misread of Rule 26 phase discipline**
**Problem**: R3 commit 72d1c5a bundled production code edits (trigger endpoint deletion, demo SDK migration, fraim/config.json competitors block) into the spec-phase artifact, framed as "all artifacts ship in one PR for the issue." The text was right (one PR for the issue) but the interpretation was wrong (every phase commit is restricted to its phase artifact; code goes in impl-phase commits, not spec-phase commits).
**What drove it**: I had `feedback_one_pr_per_phase_artifact` in MEMORY.md but interpreted "phase artifact" loosely — as if the spec PHASE could carry code under the issue's PR umbrella. The corrected reading: spec phase = spec text + mock + evidence + feedback file; impl phase = production code; both ride on the same branch in distinct commits.
**Corpus conflict**: `feedback_one_pr_per_phase_artifact` description was clear (the title literally says "one PR per phase artifact") but my reading drifted. The fix is to read the memory body, not just the title.
**Impact**: 1 revert commit + user time spent flagging + spec text softening from "deleted in this PR" → "lands in impl-phase commits on this same PR" in 3 sections.

## What Went Wrong

1. **URL shape invented in R1 stayed wrong through R3**: should have grepped for distribution-URL constructors at spec-drafting time. 5 codebase sites construct survey URLs; none use `/s/` or `app.` subdomain. Spec was internally consistent but disconnected from code.
2. **R3 spec commit bundled production code**: misread Rule 26 as permitting code-in-spec-PR. User pushback prompted a same-day revert.
3. **R3.1 first response slip (`?t={token}`)**: proposed query-param token as drop-in for retiring `?email=`. Same leakage shape, different label. User caught the logical inconsistency in one turn.
4. **Asked user for host name I already had**: data was in my grep output minutes before the question. Wasted a turn.
5. **R3 R3-9 reply got both axes wrong**: tried to fix `acmecoffee.customereq.io` by inventing `app.customereq.io` instead of reading code; landed wrong subdomain AND wrong path in the reply text that the user later cited verbatim.

## What Went Right

1. **L1 self-audit at Phase 4 caught 2 perpendicular gaps without user prompt**: responsePolicy=LATEST_OVERWRITES × tokenized batches (R21b) and audit-trail WHO/WHEN-but-not-WHY (R26 reason column). These would have shipped silently otherwise.
2. **R3.5 revert was prompt**: user flagged the code-in-spec-commit at ~07:44; revert + spec-softening shipped by 08:04. No defensive framing or rationalization attempt.
3. **R3.1 URL correction was thorough**: once redirected, audited 5 code construction sites and fixed 13 spec refs + 5 mock URLs + 2 evidence entries + new R3.1 iteration-history row in a single commit. Per-thread PR reply included full file:line citation chain.
4. **Hold-point discipline held**: did not auto-close Phase 6 address-feedback on quiet stretches between rounds. Waited for explicit *"done on the review"* signal per Rule 25a.
5. **New feedback memory landed mid-session**: `merit-over-ease` was written at user's direct instruction, indexed in MEMORY.md, and applied retroactively to the R3.1 correction work in the same session.
6. **56 feedback items addressed across 4 rounds with per-thread replies**: every inline review comment got a reply citing the resolving commit, not bulk acknowledgments.

## What I Almost Did Wrong But Caught

1. **Near-miss — almost merged competitor-analysis insight into the wrong axis**: during competitor research at Phase 3, I documented SurveyMonkey / GetFeedback / Typeform converging on `/r/<token>` path segment as industry convention. That evidence was sitting in §6 of the spec the whole time. When I "fixed" the URL in R3-9, I picked `/s/` instead of `/survey/` and didn't even check the convention I had just documented. The catch was external (user pushback), not internal — I almost rode out of spec-phase with the wrong path locked in.

## Where Past Learnings Actually Fired

1. **`one-pr-per-phase-artifact` (Rule 26)** — fired in R3.5 after the user's *"Why did you make Code changes in this commit?"* prompt. Recognized the misread, reverted within 20 minutes, captured raw learning. Same-session course-correction without re-coaching.
2. **L1 mistake-pattern "Per-section blind-spot"** — fired at Phase 4 self-audit, surfaced R21b + R26 WHY-column gaps before submission.
3. **L1 mistake-pattern "Submit-time auto-audit of spec/RFC claims"** — fired at Phase 4 evidence-doc check, prompted me to verify Brand.timezone exists in schema (it does — schema.prisma:212 from #277) before claiming it as a dependency.
4. **`feedback_fraim_phase11_stay_on_pr` / hold-point discipline (Rule 25a)** — fired across all 4 review rounds. Did not auto-close phase or split fix-forward work into separate PRs.
5. **`feedback_check_pr_comments_before_merge`** — applied when transitioning from R3 → R3.5. Read inline comments before responding rather than relying on a status summary.

## Lessons Learned

1. **URL / route / host / config-key shapes are pre-existing contracts, not design fiction.** Even at spec-phase. Before declaring any shape that touches an area already implemented (admin URL construction, route paths, env var names, config-file keys), grep the codebase for current constructors. The right shape is on disk.
2. **Shortcut-shaped framings in my own language are red flags** that need explicit upstream justification. Words to audit: "drop-in", "minimal delta", "smallest diff", "easier to extend", "for now", "reuse existing", "cheapest", "quick win". Each one either has a named blocker reason or it gets cut.
3. **Self-audit BEFORE submitting** by re-reading my own arguments against the action being recommended. If the action contradicts the argument (R3.1 `?t={token}` proposal contradicting the query-string-leakage argument I'd JUST made for path segments), escalate to the long-term-best position before sending.
4. **"Phase artifact" in Rule 26 means strictly the phase's artifact** — spec phase ships spec + mock + evidence + feedback file; impl phase ships production code; both ride on the same branch via distinct commits. Carrying code into a spec-phase commit is a misread, regardless of how convenient the bundling seems.
5. **Asked-instead-of-looked is a tell**. If the answer to a question I'm about to ask the user is in code or in data I've already fetched this turn, look first. The user's correction *"Why do you ask me instead of looking?"* is the canonical phrasing.

## Agent Rule Updates Made to avoid recurrence

1. **`feedback_merit_over_ease.md` created mid-session** — full rule + Why + How-to-apply structure. Indexed in MEMORY.md. Covers: evaluate on long-term merit first, name a specific blocker if a short-term alternate is genuinely required, grep codebase before inventing shapes, audit own language for shortcut signatures. Authoritative.
2. **`feedback_one_pr_per_phase_artifact.md` reading clarification** — no file edit needed; the memory's title and body already say it correctly. The lesson is: read the body, not just the title. Captured in this retrospective for future agents.
3. **`feedback_mock_drift_is_my_responsibility` scope** — currently scoped to post-impl mock vs code drift. This issue showed the inverse direction is also binding (spec-phase URL/route/host shapes must match existing code constructors). No memory edit needed yet — wait to see if it repeats before generalizing the memory.

## Enforcement Updates Made to avoid recurrence

1. **Spec-phase pre-submission grep check**: before committing any spec that names URL paths, route shapes, env var names, or config keys, grep the codebase for the same identifier and verify the spec matches the existing constructors. This is mechanical and would have caught R1's wrong URL shape immediately. Worth adding as a step in the FRAIM `spec-completeness-review` skill (suggest at retrospective synthesis time).
2. **Linguistic shortcut audit**: before sending a recommendation, scan response text for shortcut-shaped phrases ("drop-in", "minimal delta", "reuse existing", etc.) per `merit-over-ease` point #5. Each phrase either has a named blocker reason or gets cut.
3. **`?t=` / query-string-credential pattern is now explicitly anti-recommended** — by transitive application of the no-PII-in-URL invariant: bearer tokens in query strings have the same leakage surface as PII in query strings. Spec text now codifies this in the Alternatives table and §4 URL-shape rationale.
4. **Round-3.1 commit message + PR-thread reply both include the full causal chain** — file:line citations of the 5 construction sites, the path-vs-query reasoning, and the user's pushback quoted verbatim. This is the audit trail a future spec-phase reviewer can follow.
