---
author: manohar.madhira@outlook.com
date: 2026-04-20
synthesized: 2026-04-27
---

# Postmortem: Standardize list → view → edit pattern (technical design) — Issue #157

**Date**: 2026-04-20
**Duration**: Single session
**Objective**: Author the technical design (RFC) for standardizing the list → view → edit navigation pattern across Alert Rules, Campaigns, and Themes — particularly any architecture updates
**Outcome**: Success — RFC and evidence committed to PR #158, approved with no feedback rounds

## Executive Summary

Authored `docs/rfcs/157-standardize-list-view-edit-pattern.md` and `docs/evidence/157-technical-design-evidence.md`, both bundled into existing PR #158 at user request. The RFC translates the four-route Programs reference into per-entity changes for Alert Rules, Campaigns, and Themes; it also surfaces a hidden architectural risk (the duplicated forms in Alert Rules and Themes) and proposes both an `architecture.md` §3.1 update and the first ADR for the repo. PR was approved with zero feedback rounds.

## Architectural Impact

**Has Architectural Impact**: Yes (proposed; updates land in implementation PR per FRAIM convention)

**Sections Updated** (proposed in RFC, not yet applied):
- `docs/architecture/architecture.md` §3.1 — new "Standard CRUD admin pattern" paragraph documenting the four-route layout (`/admin/{entity}` + `/new` + `/[id]` + `/[id]/edit`), the `mode: 'create' | 'edit' | 'view'` form-prop convention, `ViewOnlyBanner` as the standard read-mode chrome, and Programs as the reference implementation.
- New `docs/architecture/adr/` directory + `0001-admin-crud-route-pattern.md` — captures the decision, alternatives considered (single combined view+edit; modal-based view), consequences for URL contracts, and Issue #157 as the establishing context.

**Rationale**: Three of five route-based admin entities currently deviate from the Programs pattern. Without documenting the standard, future entities will continue to drift and AI agents will pattern-match whichever variant they see first. The Themes URL contract change (`/themes/{id}` going from editable to view-only) qualifies as a one-way door per project rule #4, which mandates an ADR.

**Updated in PR**: Will be — implementation PR (not this design PR) per FRAIM's address-feedback / implementation phase split.

## Timeline of Events

### Phase 1: requirements-analysis
- ✅ **Loaded issue context**: Read GitHub issue #157, broken-windows report (`docs/bootstrap/broken-windows-report-2026-04-20.md`), evidence doc, and prior retrospective. Confirmed no `docs/feature-specs/157-*.md` exists — issue body is the spec.
- ✅ **Loaded architecture context**: Read `docs/architecture/architecture.md` §1–§4 plus `fraim/personalized-employee/rules/project_rules.md` (all 18 rules).
- ✅ **Studied the reference**: Read all Programs files (`programs/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `_components/program-wizard-loader.tsx`, `program-wizard.tsx`) plus `view-only-banner.tsx`. Confirmed the `mode: 'create' | 'edit' | 'view'` + `isViewOnly` pattern.
- ✅ **Studied the deviating entities**: Read Alert Rules, Campaigns, Themes pages — discovered Alert Rules and Themes have ~450–500 line forms duplicated across `new/page.tsx` and the edit page. Discovered Campaigns already has shared `CampaignForm` (`mode: 'create' | 'edit'`).

### Phase 2: design-authoring
- ✅ **Decided no spike needed**: Pattern is fully validated by Programs (in production since Issue #2). All transformations are mechanical translations of an existing, working pattern.
- ✅ **Fetched RFC template** and authored full RFC covering Customer/Problem/UX/Technical Details (route layout, ViewOnlyBanner generalization, AlertRuleForm/ThemeForm extraction, CampaignForm widening), API surface (no changes), Architecture Updates (the §3.1 paragraph + ADR), Failure Modes, Telemetry (none), Confidence (95), Validation Plan, Test Matrix, Risks & Mitigations, Observability.
- ✅ **Applied `phase:design` label** via `mcp_github_issue_write`.

### Phase 3: technical-spike
- ✅ **Skipped**: No high-uncertainty risks. Pattern is proven by Programs.

### Phase 4: architecture-gap-review
- ✅ **Three-bucket classification appended to RFC**: 7 patterns Correctly Followed (Next.js admin layout, RSC + Clerk token, multi-tenant `brandId`, Tailwind/shadcn, TypeScript strict, P2 test coverage, rule #15), 5 patterns Missing from Architecture (CRUD route layout, form mode prop, ViewOnlyBanner standard, ADR directory, shared test utils application), 0 Incorrectly Followed.

### Phase 5: design-completeness-review
- ✅ **Traceability matrix authored**: Mapped every AC from issue #157 (4 ACs × Alert Rules, 4 × Campaigns, 3 × Themes, plus the Pattern Standard table) to specific RFC sections. All 12 rows Met. No spec file → mapped from issue body directly.
- ✅ **Evidence file written**: `docs/evidence/157-technical-design-evidence.md` with traceability matrix + architectural-gaps subsection.

### Phase 6: design-submission
- ✅ **Paused for user input**: Surfaced 3 options for submission (new branch+PR, add to PR #158, leave local). User chose "add to PR #158".
- ✅ **Committed**: `934084d` — staged only the two new files, kept `.claude/settings.local.json` and `fraim/` untracked changes out of the commit (they are not part of this work).
- ✅ **Pushed and updated PR #158**: New title bundling broken-windows + design; new body summarizing both workflows; comment posted with deliverable links.
- ✅ **Updated issue labels**: `["status:needs-review", "phase:design", "ux", "broken-window"]`.

### Phase 7: address-feedback
- ✅ **Approved with zero feedback rounds**: User confirmed "PR 158 looks good".

## Root Cause Analysis

Not applicable in the failure sense — the work succeeded on the first pass. The root-cause-style insight worth recording is on the *issue scope*:

### 1. **Hidden Architectural Risk Beyond the Stated ACs**
**Problem**: Issue #157's ACs talk only about navigation (add view route, update list href, mode prop on form). They do not call out that two of the three entities have ~450-line forms duplicated between `new/page.tsx` and the edit page. A literal reading of the ACs would have produced a third copy of each form (the view variant) — tripling the duplication.
**Impact**: Without the second-order observation, the implementation would compound the rule #15 violation rather than resolve it. The RFC explicitly elevates the form extraction to a primary deliverable rather than a side cleanup.

### 2. **No ADR Directory Existed**
**Problem**: Project rule #4 mandates ADRs for one-way doors, but `docs/architecture/adr/` did not exist. The Themes URL contract change is the first one-way door encountered post-rule.
**Impact**: This RFC creates the directory and seeds it with the first ADR, establishing the convention.

## What Went Wrong

1. **Started Phase 6 without surfacing the submission-strategy choice early enough**. I composed the commit and was about to push before recognizing that PR #158 already existed for a different workflow on the same branch. Caught it before pushing and asked the user — got the answer ("add to PR #158") in one round, but the RFC was already written assuming a clean separation. No actual harm done because the user chose to bundle.

## What Went Right

1. **FRAIM-first discipline**: Per the recent coaching moment, I scanned job stubs and called `fraim_connect` + `get_fraim_job` as the first action. No plan-mode entry, no Explore-agent shortcuts. Phases progressed cleanly through `seekMentoring`.
2. **Read enough to find the second-order problem**: Reading the duplicate `new/page.tsx` and edit page implementations for Alert Rules surfaced the ~450 LOC × 2 form duplication. A surface-level reading of just the navigation files would have missed it.
3. **Used the existing reference implementation as the spec**: ProgramWizard's `mode: 'create' | 'edit' | 'view'` + `isViewOnly` is the validated pattern. The RFC explicitly cites the file path and line number (`program-wizard.tsx:189`) so the implementation PR has a concrete template.
4. **Generalization caught a hidden bug surface**: `ViewOnlyBanner` hardcodes "Edit Program" — propagating to other entities without widening would have shipped "Edit Program" buttons on Alert Rules, Campaigns, and Themes pages. RFC widens the prop signature so TypeScript catches the existing call site.
5. **Tight scoping**: Inline-editing entities (KB Articles, Support Rules, Integrations) were already scoped out by the broken-windows report — RFC respects that boundary rather than re-litigating it.

## What I Almost Did Wrong But Caught

1. **Almost auto-pushed the design commit**: I was preparing the commit + push + PR comment in one batch when I noticed PR #158 was already open for the broken-windows-detection workflow on the same branch. Stopped and asked the user how to handle the submission. The user picked option 2 (bundle into #158), which would not have been the option I'd have picked unilaterally.
2. **Almost duplicated the broken-windows evidence as the technical-design evidence**: Initial draft of the evidence file was about to copy the broken-windows narrative. Caught it and reframed around the traceability matrix, which is what FRAIM's `Design-Evidence.md` template actually wants.

## Where Past Learnings Actually Fired

1. **`feedback_fraim_before_plan_mode.md`** (today's coaching moment): The trigger fired immediately on the user's first message — I scanned job stubs, called `fraim_connect`, fetched `get_fraim_job` for `technical-design`, and worked through phases via `seekMentoring`. No plan mode, no Explore agents launched ahead of FRAIM. Outcome: the entire job ran cleanly through 8 phases with no rework.
2. **Project rule #15 (Fix at the right abstraction level)**: Triggered when I saw `~450 LOC` duplicated between `new/page.tsx` and `[id]/edit/page.tsx` for Alert Rules. Made `AlertRuleForm`/`ThemeForm` extraction a primary RFC deliverable rather than implicit cleanup.
3. **Project rule #4 (Architecture document is authoritative + ADR for one-way doors)**: Triggered when I noticed Themes URL contract change is a one-way door and that no ADR directory exists yet. Added "create ADR directory + 0001-admin-crud-route-pattern.md" as Update 2 of the architecture changes.
4. **Project rule #11 (validation gate)**: Used implicitly when reasoning about safety of widening `ViewOnlyBanner` — required prop addition means `pnpm typecheck` will catch the existing call site automatically.

## Lessons Learned

1. **For pattern-standardization issues, the navigation fix is rarely the biggest architectural concern**. The form-deduplication is. When standardizing a pattern across N entities, always check whether each entity's existing implementation has its own internal duplication that the standardization would compound.
2. **A "no architectural impact" classification in a prior phase doesn't mean a follow-up phase has no architectural impact**. The broken-windows detection retrospective marked architectural impact as "No" (correctly — detection alone doesn't change architecture). The technical-design phase that followed *does* have architectural impact (proposing two doc updates). Don't carry forward the prior phase's classification.
3. **When an existing PR is open on the current branch for a different workflow, surface the submission strategy choice to the user before committing**. The decision affects branch hygiene, reviewer load, and merge order — none of which are the agent's call.

## Agent Rule Updates Made to avoid recurrence

1. **None**: All learnings above are either already covered by existing rules (#4, #11, #15 in `project_rules.md`; the FRAIM-before-plan-mode feedback memory) or are situational rather than rule-worthy.

## Enforcement Updates Made to avoid recurrence

1. **None**: No automated enforcement changes. Recommended for future consideration: a lightweight check (CI script or pre-commit hook) that fails when a new admin route group is added without all four canonical files (`page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`). Out of scope for this RFC.
