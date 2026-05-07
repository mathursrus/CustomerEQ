---
author: manohar.madhira@outlook.com
date: 2026-05-07
synthesized:
---

# Postmortem: RFC #277 made aspirational "existing X" claims that did not match the codebase — Issue #301 (analyze-why-you-messed-up)

**Date**: 2026-05-07
**Duration**: ~30 minutes wall-clock, mid-session of FRAIM `feature-implementation` Slice 3 of #292
**Objective**: Run the FRAIM `analyze-why-you-messed-up` job on the discovery (during implement-scoping for Slice 3 of #292) that the RFC at `docs/rfcs/277-organization-settings.md` (committed in PR #290 as `906cdb4`) made multiple supporting-infrastructure claims in the prose voice of *"existing pattern"* / *"reuses pattern from #N"* / *"applied"* without verifying citations against the codebase. Capture the learning durably before resuming Slice 3.
**Outcome**: RCA + raw coaching moment + postmortem captured. Process-level preventive controls defined. Slice 3 work list updated with verified findings. Slice 3 implementation paused pending user direction on the four open decisions (now backed by primary-source citations).

## Executive Summary

The RFC for #277 (Organization Settings page) was authored by an earlier session of the same FRAIM identity. It included a "Patterns Correctly Followed" table and an "Architecture-doc updates — applied" section that read as audited; they were not. Five of six supporting-infrastructure claims were aspirational at the codebase level. The L1 mistake-pattern *"Asserted facts about file/config/external-state contents without reading the primary source first"* (score 8.0, 3 recurrences) was loaded into context when the RFC was authored — it did not fire because its bullet-form mitigation language enumerates only *"modify X / extend Y"* RFC table claims, not the *"existing X / reuses Y / applied"* phrasings the RFC actually used. The umbrella rule was correct; the bullet-form mitigation didn't generalize.

User pushback was direct: *"This is very bad — how can RFC claim so many things wrong? What is the point of RFC if it hallucinates and assumes?"* and *"There is no point in capturing mistakes if you keep making them without reading or integrity. run fraim job why you messed up and capture learnings correctly first."*

A separate failure shape surfaced during the verifying pass: `docs/architecture/architecture.md:212` documents the per-route audit-metadata-allowlist pattern *as applied for #276 + #277* though the code change in `apps/api/src/plugins/audit.ts` was deferred. **Architecture-doc-vs-code drift** — the documentation went aspirational alongside the RFC, generating a self-confirming artifact.

## Architectural Impact

**Has Architectural Impact**: No (this RCA does not change architecture; it changes process).

The architectural patterns documented at `architecture.md:40, 48, 59, 66, 212` are correct as designs. The drift at L212 is between *what the doc asserts is applied* and *what the code actually does*. The fix is not to remove the L212 row — that pattern is correct and Slice 3 of #292 will land its code. The fix is to never document a pattern as applied before its code lands.

## Timeline of Events

### Trigger — implement-scoping for Slice 3 of #292

While doing FRAIM `feature-implementation` `implement-scoping` on the new branch `feature/issue-292-org-settings-api`, primary-source verification of the RFC's supporting-infrastructure claims surfaced gaps. Initial response was to surface the gaps as four open decisions to the user (Q1: logo upload scope, Q2: identity-provider write-through, Q3: admin-role gate, Q4: URL-scheme refinement). The framing implicitly accepted "there are gaps; let me ask the user how to handle each" rather than "the RFC failed at primary-source verification; let me capture the learning and adjust process before any further design questions."

### User pushback (round 1)

*"This is very bad — how can RFC claim so many things wrong? What is the point of RFC if it hallucinates and assumes?"*

Acknowledged the failure honestly, framed it as L228's umbrella firing at the RFC layer, and proposed two paths: (A) patch-and-ship via the four open decisions, (B) reopen the RFC for a verification pass. Recommended Option A.

### User pushback (round 2)

*"There is no point in capturing mistakes if you keep making them without reading or integrity. run fraim job why you messed up and capture learnings correctly first. Either way it becomes a multi-day exercise whether we balloon Slice 3 now, or defer them to later issues - the latter occupying my bandwidth as well. For the first question on logo upload - first verify how file upload is working in the Survey Builder - to make sure that it is really an issue and not your miss again."*

Three corrections in one message:
1. The L1 memory channel is not working if mistakes recur — capture this learning durably **before** any further work.
2. Both Slice 3 options have multi-day cost; deferring is not free for the user either.
3. Even within the verifying pass, don't claim "the codebase has no X" without checking the most-likely place X would already exist (Survey Builder upload mechanism for the logo case).

### `analyze-why-you-messed-up` Phase 1: analyze-gap

Wrote inline RCA with 7 RFC claims tabulated as Verified Aspirational / Verified Exists, plus root-cause analysis (L228 mitigation language scoped too narrowly; FRAIM technical-design phase has no explicit verifying-pass step) and confirmed ownership without deflection.

### Phase 2: document-learnings

Captured raw coaching moment at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-07T21-34-35-rfc-existing-claims-unverified.md`. Format: per skill template (frontmatter + What happened / What was learned / What the agent should have done) — no synthesis, no scoring (those are sleep-on-learnings' job).

### Phase 3: fix-it — verifying pass on Q1 (logo upload) per user instruction

Read `apps/web/src/components/themes/ThemeForm.tsx` (post-#291 — explicit comments at lines 12, 336 confirm logo/brandName fields *moved off* the theme model with no replacement upload UI). Read `apps/web/src/app/(admin)/admin/survey-builder/page.tsx:831–854` — `file_upload` is a question-type definition with config (max size, allowed types) but no actual upload mechanism. Read `apps/web/src/app/survey/[id]/page.tsx:992–1024` — the responder-side renders a `<input type="file">` and calls `setAnswer(q.id, { text: file.name, value: file.name })` — **only the filename is captured**, the file bytes are dropped. No `FormData`, no fetch with multipart body, no upload endpoint. The Survey Builder's "file upload" is a UI stub.

Conclusion: the user's hypothesis ("verify before claiming") yielded a definitive answer — there is no file-upload mechanism in CustomerEQ today, anywhere. The original Q1 finding was correct. As a side effect, surfaced a separate product-level finding worth a future issue: the Survey Builder ships a UI control that does not actually upload bytes.

### Phase 3 continued: doc-vs-code drift discovery

Verifying-grep against `docs/architecture/architecture.md` for the five RFC-claimed architecture-doc updates:
- ✅ `Forms` row at L40 — landed
- ✅ `Domain-narrow runtime packages` at L48 — landed
- ✅ `Post-create landing for new Clerk organizations` at L59 — landed
- ✅ `Lazy-upsert provisioning pattern` at L66 — landed
- ⚠ `Per-route metadata allowlist` at L212 — **landed in doc, NOT in code**

This is a new failure shape. The doc text says the pattern is applied; the code says otherwise. A doc-vs-code drift surfaces only on the next slice's implement-scoping when the agent verifies against the code.

### Phase 4: submit

Filed issue #301, wrote this postmortem, branched `feature/issue-301-rfc-existing-claims-rca` off freshly-fetched `origin/main` (which had advanced 9 commits during this session — unrelated demo-storefront fixes), committed the raw coaching moment + postmortem, opened PR.

## What Went Well

- **Honest acknowledgment without deflection.** No framing of "the RFC author was a different session"; the FRAIM identity is shared, the L1 channel is shared, the failure is one failure.
- **Verifying pass produced citations, not assertions.** Every RFC claim now has a file:line citation or a "verified absent" with the search command.
- **User instruction was followed in order.** "Capture learnings correctly first" → ran `analyze-why-you-messed-up` end-to-end before resuming Slice 3 scoping. "Verify file upload in Survey Builder" → produced concrete file:line evidence (`apps/web/src/app/survey/[id]/page.tsx:1015`) before reopening Q1.
- **Discovered a sibling failure shape mid-RCA** (architecture-doc-vs-code drift on L212 audit-allowlist row). Captured as part of the same RCA rather than punting.

## What Went Wrong

- **L1 mitigation didn't generalize.** L228 captured the failure shape correctly at the umbrella level but the bullet-form concrete-checks language was scoped to *"modify X / extend Y"* tables — leaving *"existing X / reuses Y / applied"* phrasings uncovered. A more general phrase enumeration would have caught this at RFC drafting time.
- **No FRAIM technical-design phase step enforces the verifying pass.** The job has phases for design and architecture-gap-review but no "for every 'existing X' assertion, run a primary-source verification" pre-submit check. Reliance on the agent reading L228 well enough to apply it across phrasings was insufficient.
- **Cross-session entry-time check missed.** Today's session began drafting the Slice 3 work list without first running the verifying-grep pass over the RFC. The gaps were discovered during decision-surfacing rather than at scoping entry.
- **Initial response framed the gaps as decisions for the user** rather than as a mistake-pattern recurrence. Needed user pushback to redirect to the RCA path. The "patch-and-ship" recommendation was right *eventually*, but offering it before capturing the learning treated the learning channel as optional.

## Lessons Learned

1. **Any RFC sentence containing *"existing X"* / *"the existing Y"* / *"reuses pattern from #N"* / *"already shipped"* / *"already applied"* / *"the pattern from #N"* is a primary-source claim that must carry a verifying citation in the same drafting pass — otherwise the row is aspirational, not designed.**
2. **Architecture-doc rows describe what the code does, not what the RFC plans.** When an architecture-doc edit lands in the same PR as an RFC, the doc text must wait for the code change. Otherwise the next implementation session faces a self-confirming artifact.
3. **L1 mitigations need explicit trigger-phrase enumeration.** Umbrella rules ("primary-source read before assertion") are correct but not load-bearing without concrete phrase-level enumeration. A pattern that fires on *"modify X"* but not on *"existing X"* is incomplete.

## Process Improvements

1. **RFC verifying-pass at end of `technical-design`.** Before reporting design phase complete, grep the RFC body for the four trigger phrases — *"existing X"*, *"reuses (pattern from #N)"*, *"already (applied / shipped)"*, *"the pattern from #N"*. For every match, produce one of: (a) a citation entry (file:line proving X exists), (b) a scope rewrite naming X as net-new, or (c) a Decision-for-the-reviewer surfacing the gap. No "Patterns Correctly Followed" row may ship without a citation column.
2. **Architecture-doc drift check.** When an architecture-doc update lands in the same PR as an RFC, the doc text describes what the code does, not what the RFC plans. The audit-allowlist row at `architecture.md:212` is a concrete miss. Architecture-doc rows wait for the code, not before.
3. **Cross-session RFC verification at entry.** When entering implementation against an RFC the agent itself authored in a prior session, run the verifying-grep pass as the **first** step of `implement-scoping`, before drafting the work list.
4. **Promote new mistake-pattern at next sleep-on-learnings.** Synthesize the raw coaching-moment file into a sister-of-L228 entry with explicit trigger-phrase enumeration. Score 8.0, recurrence 1 at the RFC layer; promote on next firing.

## Where Past Learnings Actually Fired (and didn't)

| L1 entry | Status in this session |
|---|---|
| L228 *"Asserted facts about file/config/external-state contents without reading the primary source first"* (score 8.0) | **Did not fire at RFC drafting time** — concrete-check language too narrow. Did fire correctly at today's verifying-pass time (caught the gaps). |
| L1 P-HIGH *"FRAIM discovery flow before any non-trivial action"* (score 9.0) | Fired correctly — discovery + project_rules read happened at session start. |
| L1 P-HIGH *"Tight PR scope — no opportunistic scope creep"* (score 8.0) | Fired correctly — RCA filed as separate issue #301 + branch + PR rather than bundling onto Slice 3 branch. |
| L1 P-MED *"Caught package-lock.json pollution via git status pre-stage check"* (score 5.0) | Fired correctly — `git status` before staging caught the worktree state cleanly; nothing unintended in the commit. |
| L1 P-HIGH *"Asked user to confirm deviation from unambiguous project rules"* (score 8.0) | Did **not** misfire — proceeded with R10/R21 (file issue, branch, PR) without asking permission. |
| L1 P-HIGH *"Single-frame strategic recommendation buries the cleaner answer (silent sunk-cost weighting)"* (score 8.0) | Fired correctly in the round-1 response to user pushback — surfaced both Option A (patch-and-ship) and Option B (reopen RFC) with the deciding tradeoff named. |

## Follow-ups

- **Slice 3 of #292** resumes after this PR lands. The Slice 3 work list at `docs/evidence/292-slice-3-implement-work-list.md` (on the Slice 3 branch, untouched by this PR) now reflects verified findings on every RFC claim. The four open decisions are unchanged in shape but each is backed by primary-source evidence.
- **Three sub-issues** referenced in Slice 3's open decisions get filed when the user resolves Q1–Q3: logo-upload + storage-backend, identity-provider-retry-queue, formal-admin-role-gate.
- **Sleep-on-learnings synthesis** picks up the raw coaching moment + this postmortem on the next cycle. The L228 entry should be extended (concrete-checks language) or a sister-entry filed (RFC-layer specific) — synthesis decides which shape best captures the rule.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
