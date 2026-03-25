---
author: sid.mathur@gmail.com
date: 2026-03-24
synthesized:
---

# Postmortem: MVP Build — Full Loyalty Platform Specification — Issue #23

**Date**: 2026-03-24
**Duration**: Single session
**Objective**: Produce a complete feature specification for the full CustomerEQ MVP (Phase 0 + issues #2–#9) with HTML/CSS mocks, requirement traceability, competitive analysis, and compliance controls before any implementation begins.
**Outcome**: Success — spec approved, PR #25 merged

## Executive Summary

Produced a 35-requirement feature specification covering all 9 feature areas of the CustomerEQ MVP with interactive HTML/CSS mocks for the 4 primary UI surfaces. Competitive research confirmed the core product thesis: no current loyalty platform routes CX events to loyalty actions automatically. The spec was reviewed and approved in a single round with no revision requests.

## Architectural Impact

**Has Architectural Impact**: No

The spec consumed the architecture document as input. No architectural decisions were changed during this spec phase. Any implementation decisions that differ from the approved architecture should generate an ADR in `docs/architecture/adr/`.

## Timeline of Events

### Phase 1: context-gathering
- ✅ **Action**: Loaded issue #23 from GitHub — identified umbrella issue covering 8 sub-issues
- ✅ **Action**: Read architecture doc, use cases, data models, project rules, implementation roadmap in parallel
- ✅ **Action**: Identified GDPR/CCPA + SOC2 as applicable compliance from project_rules.md (no fraim/config.json formal config)

### Phase 2: spec-drafting
- ✅ **Action**: Created `docs/feature-specs/23-mvp-loyalty-platform.md` with 35 requirements using SHALL-style language with R-tags
- ✅ **Action**: Created 4 interactive HTML/CSS mocks (admin wizard, member portal, campaign builder, analytics dashboard)
- ✅ **Action**: Applied generic UI baseline (indigo/violet, Inter, shadcn/ui-style components) consistently across all mocks

### Phase 3: competitor-analysis
- ✅ **Action**: Web-searched Annex Cloud, Yotpo, Smile.io, LoyaltyLion for CX integration capabilities
- ✅ **Action**: Confirmed critical finding: all 4 competitors flow loyalty→CRM for email; none flow CX→loyalty for automatic rewards
- ✅ **Action**: Updated competitive analysis section with sourced URLs and explicit integration direction gap documentation

### Phase 4: spec-completeness-review
- ✅ **Action**: Served mocks locally via `npx serve` and validated all 4 in Playwright browser
- ⚠️ **Action**: Found P1 issue — analytics dashboard campaign table overflowed viewport (last 2 columns clipped)
- ✅ **Action**: Fixed with `overflow-x: auto` wrapper + `min-width: 700px` on table element
- ✅ **Action**: Re-validated analytics dashboard — all columns visible and scrollable

### Phase 5: spec-submission
- ✅ **Action**: Created evidence document `docs/evidence/23-spec-evidence.md`
- ✅ **Action**: Committed and pushed 6 files to feature branch
- ⚠️ **Action**: First PR creation attempt failed via MCP GitHub tool (422 validation error)
- ✅ **Action**: Fallback to `gh pr create` CLI — succeeded, PR #25 created
- ✅ **Action**: Added PR comment and issue comment with evidence links

### Phase 6: address-feedback
- ✅ **Action**: PR approved by owner with no revision requests — zero feedback rounds

## Root Cause Analysis

### 1. **P1 Mock Defect (Table Overflow)**
**Problem**: The analytics dashboard campaign table had no `overflow-x` wrapping, causing the last 2 columns (Budget Used, Avg. Response) to be clipped at the 900px Playwright viewport.
**Impact**: Minor — would have caused confusion when a reviewer opened the mock. Fixed before submission.
**Root Cause**: HTML/CSS table overflow is a common edge case that requires explicit wrapping. When building data-dense mocks, always wrap wide tables in `overflow-x: auto` containers by default.

### 2. **MCP GitHub PR Creation Failure**
**Problem**: `mcp__github__create_pull_request` with `head: "feature/23--mvp-build-full-loyalty-platform-issues-2-9-in-one-pass"` returned 422.
**Impact**: Minor — added one retry cycle. Fallback to `gh pr create` CLI succeeded immediately.
**Root Cause**: The MCP GitHub `create_pull_request` tool may require the `head` field in `owner:branch` format (e.g., `mathursrus:feature/23--...`) for cross-repo disambiguation, even when working within the same repo. The `gh` CLI infers this from the current branch automatically.

### 3. **Missing fraim/config.json Compliance Config**
**Problem**: Compliance regulations and competitors were not configured in `fraim/config.json`, triggering FRAIM warnings on every phase.
**Impact**: Cosmetic — required manually inferring compliance from `project_rules.md` and architecture doc rather than reading from config.
**Root Cause**: Project onboarding did not populate `fraim/config.json` with the `compliance` and `competitors` fields. This is a one-time setup gap.

## What Went Wrong

1. **Table overflow not caught during initial mock authoring**: The analytics dashboard table was written without overflow handling. Should be a default pattern for any HTML mock with a multi-column data table.
2. **MCP PR creation tool requires `owner:branch` head format**: Not obvious from the tool schema. Cost one retry cycle.
3. **No `fraim/config.json` compliance/competitors config**: Generates noise warnings throughout the spec job. Should be resolved in project onboarding.

## What Went Right

1. **Parallel document reads in context-gathering**: Loading architecture doc, use cases, data models, and project rules simultaneously saved significant time.
2. **Competitive research confirmed the thesis**: Web search validated the core product hypothesis (no competitor does CX→loyalty automation) with specific, sourced evidence rather than relying solely on existing analysis docs.
3. **Playwright mock validation caught the P1 defect**: Browser validation of mocks before submission is essential — the table overflow was invisible in the code review but obvious in the rendered page.
4. **Generic UI baseline applied consistently**: Using a single indigo/violet + Inter + shadcn-style system across all 4 mocks produces a coherent visual language without a design system config.
5. **R-tag traceability on all 35 requirements**: Every acceptance criteria maps to a requirement ID, making implementation-vs-spec review mechanical rather than interpretive.
6. **Single spec for umbrella issue**: Covering all 9 areas in one document with consistent formatting is more useful than 9 separate specs for a single-agent build pass.

## Lessons Learned

1. **Always wrap wide HTML tables in `overflow-x: auto`**: Any mock table with more than 5 columns should have an overflow wrapper as a default, not as a fix.
2. **Use `gh` CLI for PR creation, not MCP GitHub tool**: The `gh` CLI infers current branch context automatically. The MCP tool requires explicit `owner:branch` formatting that isn't obvious from the schema.
3. **Validate mocks in browser before reporting phase complete**: The Playwright validation step is not optional — it found a real rendering defect that code review would miss.
4. **Confirm fraim/config.json is populated before starting spec jobs**: Missing `compliance` and `competitors` config generates per-phase warnings. Recommend running project-onboarding job first to populate these.
5. **Document integration direction, not just integration existence**: The competitive analysis is more valuable when it specifies the direction of data flow (loyalty→CRM vs CX→loyalty) rather than just whether an integration exists.

## Agent Rule Updates Made to avoid recurrence

1. **HTML Mock Table Rule**: When writing HTML mocks containing data tables with more than 4 columns, wrap the table in `<div style="overflow-x:auto">` and add `min-width` to the table. Apply this by default, not as a fix after validation.
2. **PR Creation Rule**: Prefer `gh pr create` (without `--head`) over `mcp__github__create_pull_request` when working from the correct feature branch. The CLI infers the head branch automatically and avoids 422 validation errors from malformed head references.

## Enforcement Updates Made to avoid recurrence

1. **Mock completeness checklist in spec-completeness-review**: Add an explicit check — "Does any mock contain a data table with >4 columns? If yes, confirm overflow-x wrapping exists." This prevents the table overflow class of defect before browser validation.
2. **Project onboarding gate**: Before starting feature-specification on a new project, confirm `fraim/config.json` has `compliance` and `competitors` populated. If missing, prompt to run project-onboarding job first.
