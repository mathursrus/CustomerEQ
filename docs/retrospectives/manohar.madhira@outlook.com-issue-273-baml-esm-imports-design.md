---
author: manohar.madhira@outlook.com
date: 2026-05-04
synthesized:
---

# Postmortem: BAML codegen ESM-friendly imports (technical-design phase) — Issue #273

**Date**: 2026-05-04
**Duration**: ~1 hour from spike to PR-ready, plus ~15 minutes for Round 1 feedback
**Objective**: Produce a technical design (RFC) for fixing the BAML codegen `.js` extension regression that has frozen the API revision at the April-17 image for 16 days.
**Outcome**: Success — RFC + evidence + traceability landed; design approved for implementation in 1 feedback round.

## Executive Summary

A 3-minute spike replaced what would have been a ~50-line custom post-process patch script with a 1-line BAML config option (`module_format "esm"`). User feedback in Round 1 sharpened the CI safety-net design from a broad "import the whole app" probe to a narrow "import `@customerEQ/ai`" probe and made the CI-vs-CD relationship explicit. Net design footprint: 1 line of production config + ~10 lines of CI yaml.

## Architectural Impact

**Has Architectural Impact**: Yes (deferred)

**Sections to update during implementation phase**: §3.5 Shared Layer or §6 Design Patterns (document BAML codegen-at-build-time + version pinning); §11 Validation Commands (document built-image module-resolution probe).

**Rationale**: These are now documented patterns the codebase relies on; missing them in `architecture.md` creates the same kind of "surprise" that produced this regression in the first place (when `bdfadf0` deleted the committed BAML files, the `.js`-extension fix from `8fd2786` silently disappeared because nothing in the architecture doc named the contract that fix was preserving).

**Updated in PR**: Pending — done during implementation per FRAIM rules.

## Timeline of Events

### Phase 1: requirements-analysis
- ✅ **Issue context loaded**: read #273 body + acceptance criteria; no feature-spec exists (bug fix); architecture doc relevance found at line 401 (`@customerEQ/ai` synchronous load).
- ✅ **Open question identified**: does BAML 0.211.0 have a generator-block option for ESM-style imports? Rated as high-uncertainty per spike-first rule.

### Phase 2: design-authoring
- ✅ **Spike decision**: opted for spike-first based on the open question above.

### Phase 3: technical-spike
- ✅ **Hypothesis empirically tested**: set `module_format "esm"` on the generator block, ran `npx @boundaryml/baml@0.211.0 generate`, grepped output. All 13 generated files emit extension-bearing imports.
- ✅ **Robustness check**: set `module_format "totally_invalid_option_xyz"`, BAML errored with `'totally_invalid_option_xyz' is not supported. Use one of: 'cjs' or 'esm'`. Confirms the option is real and validated.
- ✅ **Spike concluded in <3 minutes** — saved ~50 lines of custom code.

### Phase 4: architecture-gap-review
- ✅ **5 patterns correctly followed** (Node 22 ESM, `@customerEQ/ai` synchronous load, Turbo+pnpm build, smoke-before-deploy, single revision + health gate).
- ✅ **2 patterns missing from architecture** (BAML codegen-at-build-time; built-image module-resolution probe).
- ✅ **1 incorrectly-followed pattern surfaced** — but in *production state*, not in this RFC's design (worker deployed in `QUEUE_MODE=inline` despite §3.3 saying it isn't). Deferred to #274.

### Phase 5: design-completeness-review
- ✅ **Traceability matrix built**: 4/4 acceptance criteria from #273 mapped to RFC sections, 0 unmet rows.

### Phase 6: design-submission
- ✅ **PR #275 opened** (branch renamed from auto-generated 173-char name to `feature/issue-273-baml-js-extensions`).
- ✅ **Issue labeled** `phase:design`, `status:needs-review`.

### Phase 7: address-feedback (Round 1)
- ✅ **Round 1**: user asked "should the probe be in CI or CD?" and (derived) flagged the broad probe target.
- ✅ **CI vs CD carve-out**: added explicit comparison table — CI = code-load gate, CD = deployed-revision gate. Both stay; complementary not redundant.
- ✅ **Probe narrowed**: from `apps/api/dist/server.js` to `@customerEQ/ai` directly. Avoids env-var false positives.
- ✅ **Round 1 feedback file** created and inlined into evidence per FRAIM design-submission step 1.

## Root Cause Analysis

The retrospective is for the **design-phase work**, not the underlying code regression (which is documented in #273 itself).

### 1. **Why the design was non-obvious in advance**
**Problem**: The issue body sketched a custom post-process patch script as the recommended fix path. Both authors (the issue's filer and the design phase entry) initially assumed BAML 0.211.0 didn't have a native ESM imports option.
**Impact**: Without the spike, the design would have specified a custom `scripts/patch-baml-imports.mjs` (~50 lines + a new file + ongoing maintenance). The spike replaced that with one config line.

### 2. **Why the CI safety net needed a Round 1 sharpening**
**Problem**: The first-pass CI design imported `apps/api/dist/server.js` (the full app entry). That couples the test to env-var reads and Fastify plugin module-load behavior — both legitimate and unrelated to the BAML regression class.
**Impact**: Without Round 1's narrowing, the CI step would have been a flaky false-positive generator. User correctly pushed back.

## What Went Wrong

1. **Initial probe scope was too broad**. I picked the application entry point (`server.js`) for the CI probe without thinking about what *exactly* needs to be exercised vs. what's incidental. User caught this in Round 1; the right answer was the narrower `@customerEQ/ai` import. Lesson: when designing a regression-specific test, scope it to the regression class, not to "everything that could go wrong."
2. **Didn't surface the CI vs CD relationship explicitly until asked**. The first-pass RFC said "add a CI step" without comparing to the existing CD `Verify API health` step. Reader-prompted disambiguation is a smell — that comparison should have been in the first draft.

## What Went Right

1. **Spike-first paid off concretely**. Three minutes of empirical testing replaced ~50 lines of custom code. The user-memory rule "FRAIM discovery before any action" / spike-first-development.md was the right call here and the data validated it.
2. **Architecture-gap analysis surfaced a separate cross-issue finding** — production violates §3.3 line 69 by deploying the worker in `QUEUE_MODE=inline`. Out of scope for #273, but worth recording so #274 has the architecture-doc reference baked in.
3. **Empirical reproduction in the worktree** before designing — `pnpm --filter @customerEQ/ai run generate` + grep confirmed the bug locally and made the spike's positive result that much more credible.
4. **Branch rename done immediately** when user asked. The 173-char auto-generated name was unwieldy; a clean `feature/issue-273-baml-js-extensions` makes the rest of the workflow legible.

## What I Almost Did Wrong But Caught

1. **Almost reported PR #267 as "running in production"** based solely on `Deploy: success` from the CD log. Caught when user asked for empirical confirmation, then queried Container Apps and found the active revision was still `0000111` from April 17. *Signal*: user asking for verification rather than accepting my "very probably yes." *What I did instead*: ran `az containerapp revision list` and gave the empirical state. This wasn't a #273 design moment per se, but it was the moment that exposed the BAML defect that became #273.

## Where Past Learnings Actually Fired

1. **"Diagnose my own script before blaming externals"**: when local `pnpm db:reset` failed with `relation already exists`, I stopped to read the migration SQL rather than reaching for a workaround. That kept the focus on the real bug (#270 idempotency) instead of fighting the migration runner.
2. **"Prove root cause empirically not by attribution"**: confirmed BAML's `module_format "esm"` actually produces `.js`-extended imports across all 13 files via `grep`, not via "the option name suggests it should work." Also confirmed BAML rejects bogus values with a real error, not silently no-ops.
3. **"Read config before asserting its contents"**: read the actual `generators.baml` and confirmed `module_format` is not currently set, before claiming "we just need to set it." Trivial check, but it caught an assumption I would otherwise have made.
4. **"Present both sunk-cost frames upfront"**: the RFC's "Spike Findings → Design Impact" table presents the native-option vs. patch-script alternatives side-by-side with the deciding tradeoff named (maintenance + failure-mode), not buried behind a follow-up prompt.

## Lessons Learned

1. **For build-pipeline fixes, check the generator's options before designing a workaround**. BAML's `module_format` was a 3-minute spike away; the issue body's sketched patch-script approach would have been ~50 lines and a maintenance burden. Generalizes: any time a fix touches generated code, the generator's emit options are the first place to look.
2. **Probe targets in CI should be the narrowest thing that exercises the regression class**. Importing `server.js` made the test broader than needed. The narrower `@customerEQ/ai` import is precisely the regression contract and has zero side effects. Over-broad CI tests become flaky and devalue the signal.
3. **CI and CD gates answer different questions**. CI = "does the code load?" CD = "does the deployed revision serve traffic with real prod infra?" Treating them as substitutes (or one as redundant) is wrong. Document the carve-out explicitly so the next design doesn't relitigate it.
4. **`az containerapp update --image` reporting "success" means image-accept, not activation**. CD logs that say "Deploy: success" are not deploy-confirms-traffic. Either chain on `Verify API health` (existing in `deploy.yml`) or query revision state explicitly.

## Agent Rule Updates Made to avoid recurrence

1. **None as part of this design phase**. The architecture-doc updates (BAML codegen-at-build-time pattern; built-image probe pattern) are deferred to the implementation phase per FRAIM rules. Once those land, future agents reading `architecture.md` will know to look for the BAML emit contract before designing patch scripts.
2. **Recommended (not yet committed)**: a CLAUDE.md or operational note that `az containerapp update --image` returning `0` is *not* a deploy-confirms. This is a recurring source of confusion (it's how this whole bug hid for 16 days). Worth surfacing as a project rule if the user agrees.

## Enforcement Updates Made to avoid recurrence

1. **CI module-resolution probe** (this RFC, deferred to implementation): a runtime gate at PR time will catch the next BAML-class regression before it reaches main. The previous defense was "smoke tests" which run against source TS and don't exercise the built dist's import resolution.
2. **Architecture-doc cross-references in commit messages** (recommended, not yet adopted): when a commit modifies a build pipeline contract that was previously implicit, the commit message should reference the architecture section it documents. `bdfadf0` did not — it deleted the committed BAML files and made codegen run at build time, but didn't add a corresponding architecture-doc note. That made the implicit contract invisible to subsequent reviewers, including me.
