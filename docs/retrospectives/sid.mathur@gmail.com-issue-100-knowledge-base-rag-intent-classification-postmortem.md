---
author: sid.mathur@gmail.com
date: 2026-04-03
synthesized: 2026-04-09
---

# Postmortem: Phase C: Support Foundation — Knowledge Base with RAG and Intent Classification - Issue #100

**Date**: 2026-04-03
**Duration**: ~100 minutes total (issue-preparation + feature-specification + technical-design + feature-implementation)
**Objective**: Spec, design, and implement KB with RAG and intent classification (Phase C: Support Foundation)
**Outcome**: Success — spec, RFC, and full backend implementation delivered; PR #104 updated with evidence

## Executive Summary

Completed the `issue-preparation`, `feature-specification`, `technical-design`, and `feature-implementation` FRAIM jobs for issue #100. The implementation phase produced 41 file changes with 1943 insertions across 6 layers (database, shared, AI, API, worker, MCP). All validation gates pass: build (9/9), typecheck (13/13), lint (3/3), 645 unit tests (0 failures, 81 new). The traceability matrix shows 24/24 implementation requirements Met. pgvector is the only new technology, with all other components following proven codebase patterns.

## Architectural Impact

**Has Architectural Impact**: Yes

**Sections Needing Update**: Tech Stack (pgvector), Architectural Layers (AI package, MCP server), Worker Queues (count mismatch 3 vs 7), Database Models (KBArticle), Environment Variables (OPENAI_API_KEY)
**Changes Made**: Gaps documented in RFC "Architecture Analysis" section -- no architecture doc updates yet
**Rationale**: Architecture doc predates issues #35-#41 (AI layer, MCP server, additional workers) plus this issue adds pgvector
**Updated in PR**: Pending -- deferred to address-feedback phase after user approval

## Timeline of Events

### Phase 1: Issue Preparation — Environment Setup
- Loaded local-development rules
- Ran `prep-issue.sh 100` successfully
- Worktree created at `/c/Users/sidma/OneDrive/Code/CustomerEQ - Issue 100`
- Branch `feature/100-phase-c-support-foundation-knowledge-base-with-rag-and-intent-classification` created and pushed

### Phase 2: Issue Preparation — Branch Creation
- Verified branch name and upstream tracking
- Branch correctly tracks origin

### Phase 3: Issue Preparation — Workspace Verification
- Verified worktree directory, branch context, and config integrity
- `fraim/config.json` and `docs/architecture/architecture.md` confirmed present

### Phase 4: Feature Spec — Context Gathering
- Read issue #100 from GitHub
- Analyzed existing codebase: Prisma schema (22 models), BAML functions (AnalyzeFeedback pattern), API routes (surveys.ts pattern), MCP tools (surveys.ts pattern)
- Read architecture doc and brainstorming doc for context
- Extracted 8 functional requirements, 4 data constraints, 4 non-functional requirements
- Identified 5 open questions for human review

### Phase 5: Feature Spec — Spec Drafting
- Created full spec (427 lines) following FRAIM template
- Designed Prisma schema with pgvector `Unsupported("vector(1536)")` type
- Designed `ClassifyIntent` BAML function following `AnalyzeFeedback` pattern
- Defined 7 API endpoints and 3 MCP tools
- Created interactive HTML mock with 4 views (article list, editor, semantic search, intent classification)
- Documented compliance controls (GDPR, CCPA, SOC2)

### Phase 6: Feature Spec — Competitor Analysis
- Researched Zendesk Guide + Advanced AI, Intercom Fin AI Engine, Freshdesk Freddy AI, Annex Cloud
- Sourced pricing: Zendesk $165+/agent/mo, Intercom $0.99/resolution, Freshdesk included in plans
- Documented differentiation: unified CX-loyalty-support, cost-effective AI, MCP-native

### Phase 7: Feature Spec — Completeness Review
- Verified mock HTML file exists
- Mapped all 9 issue ACs to spec requirements (100% coverage)
- Confirmed compliance and design standards sections present

### Phase 8: Feature Spec -- Submission
- Committed 3 files (spec, mock, evidence)
- Pushed to remote, created PR #104
- Updated issue labels: `phase:spec`, `status:needs-review`
- Added PR comment with deliverable links

### Phase 9: Technical Design -- Requirements Analysis
- Loaded all context in parallel (spec, architecture, project rules, learning context, codebase patterns)
- Read 8 existing source files to understand patterns (schema.prisma, surveys.ts, bullmq.ts, sentimentAnalysis.ts, analytics.ts MCP, campaigns.ts MCP, clients.baml, ai/index.ts)

### Phase 10: Technical Design -- Design Authoring
- No prior design feedback file existed
- Assessed 3 technical ambiguities (pgvector Medium, OpenAI embeddings Low, BullMQ Low) -- no spike needed
- Applied `phase:design` label
- Wrote full RFC: 8 technical sections + observability + file change summary (16 new files, 8 modified files)

### Phase 11: Technical Design -- Architecture Gap Review
- Compared RFC against architecture.md
- Identified 11 patterns correctly followed, 6 missing from architecture, 0 incorrectly followed
- Added "Architecture Analysis" section to RFC with three-bucket classification

### Phase 12: Technical Design -- Design Completeness Review
- Executed traceability matrix: 34/34 requirements Met -- PASS
- Created evidence file (docs/evidence/100-technical-design-evidence.md)

### Phase 13: Technical Design -- Design Submission
- Committed RFC + evidence to feature branch
- Pushed with worktree-safe `HEAD:<branch>` pattern
- Added PR #104 comment with summary and architecture gaps
- Updated issue labels to `phase:design` + `status:needs-review`

### Phase 14: Technical Design -- Address Feedback
- Checked PR for reviews/comments -- no feedback received yet
- Reported phase complete (awaiting human review)

### Phase 15: Feature Implementation -- Scoping
- Loaded RFC, spec, project rules, FRAIM rules (constitution, testing-standards, architecture-standards)
- Discovered codebase patterns across 6 layers via 10+ file reads
- Created standing work list (22 files across 6 layers)

### Phase 16: Feature Implementation -- Tests
- Wrote 81 tests across 7 test files (all passing on first run)
- BAML eval tests (12) for intent classification accuracy

### Phase 17: Feature Implementation -- Code
- Built bottom-up: database -> shared -> AI -> API -> worker -> MCP
- Fixed 3 minor issues: BAML import path, missing openai dependency, implicit any type
- Generated Prisma client and BAML client after schema changes

### Phase 18: Feature Implementation -- Validation
- Build (9/9), typecheck (13/13), lint (3/3), no debug artifacts

### Phase 19: Feature Implementation -- Regression
- Full suite: 645 tests, 0 failures

### Phase 20: Feature Implementation -- Quality
- All quality checks pass, no unaddressed issues

### Phase 21: Feature Implementation -- Completeness Review
- 24/24 implementation requirements traced and met

### Phase 22: Feature Implementation -- Submission
- Committed 41 files (1943 insertions), pushed, PR #104 comment added

## Root Cause Analysis

No failures occurred. This section documents potential risks identified.

### 1. **pgvector Dependency Risk**
**Problem**: The spec assumes pgvector extension is available in PostgreSQL. Not all environments (local dev, CI) may have it.
**Mitigation**: Spec documents that migration must fail loudly if extension is unavailable. Implementation should test for this.

### 2. **Embedding Cost Control**
**Problem**: OpenAI embedding API calls on every article create/update could be expensive at scale.
**Mitigation**: Spec includes NF2 requiring BullMQ queuing for resilience and rate limiting consideration in open questions.

## What Went Wrong (Implementation)

1. **BAML import path assumption**: Assumed `../generated/index.js` but actual path was `../generated/baml_client/index.js`. Required inspecting the actual generated directory structure.
2. **Missing openai dependency**: RFC stated openai was "already a dependency via BAML" but it was not in package.json. Had to explicitly `pnpm add openai`.
3. **Implicit any in TypeScript strict mode**: The `.filter()` callback on `suggested_article_ids` needed explicit `(id: string)` type annotation.

## What Went Wrong (Spec/Design)

1. **Feature spec not on main branch**: The spec only exists on the feature branch worktree, not on main. The initial read from the main repo path failed, requiring a second read from the worktree path. Minor friction but avoidable.
2. **Architecture doc significantly out of date**: 6 gaps found. The doc was last updated 2026-03-25 and does not reflect work from issues #35-#41. This is pre-existing debt, not a failure of this job, but it adds review burden.
3. **Missing competitors in config**: `fraim/config.json` has no `competitors` field configured, requiring manual research. This is a known gap flagged by FRAIM.

## What Went Right (Implementation)

1. **Bottom-up implementation order**: Building from database -> shared -> AI -> API -> worker -> MCP meant each layer's dependencies were ready before it was built.
2. **RFC precision**: The RFC specified exact SQL queries, exact file paths, and exact function signatures, making implementation mechanical rather than creative.
3. **Test-first approach**: Writing schema validation tests first caught edge cases early.
4. **Existing pattern consistency**: Every new component (route, queue, BAML, MCP tool, worker) followed a proven pattern with zero integration issues.

## What Went Right (Spec/Design)

1. **Pattern reuse**: Existing codebase patterns (Prisma models, BAML functions, API routes, MCP tools) provided clear templates for both spec and RFC, ensuring consistency.
2. **Parallel context loading**: Reading spec, architecture doc, project rules, BAML files, route patterns, MCP tools, and queue infrastructure in parallel collapsed ~10 sequential reads into 3 parallel batches.
3. **Observability included from the start**: Per learned mistake pattern (P-MED), included structured logging, metrics, and DLQ strategy in the first RFC draft rather than as a later revision.
4. **Worktree push pattern**: Used `git push origin HEAD:<branch>` per learned mistake pattern, avoiding the "src refspec does not match" error.
5. **Comprehensive traceability**: 34 requirements mapped line-by-line in traceability matrix, providing high confidence in completeness.
6. **No spike needed**: All 3 technical ambiguities assessed as Medium or Low uncertainty, avoiding the overhead of a spike phase.

## Lessons Learned (Implementation)

1. **Verify npm dependencies explicitly**: Even when an RFC says a dependency is transitively available, always check package.json before importing.
2. **Check generated code import paths**: BAML/Prisma generated code paths may differ from assumed patterns. Always inspect the actual generated directory structure.
3. **Windows Prisma segfault is cosmetic**: Exit code 3221225477 does not indicate test failure. All tests pass before the process exit crash.
4. **Detailed RFCs accelerate implementation**: When the RFC includes exact file paths, SQL queries, and function signatures, implementation becomes almost mechanical.

## Lessons Learned (Spec/Design)

1. **Prisma `Unsupported()` type for pgvector**: Prisma does not natively support vector types. The `Unsupported("vector(1536)")` workaround works for column definition but requires raw SQL for similarity queries. Encapsulate all raw SQL in a single service file to limit the blast radius.
2. **Architecture doc maintenance is a growing debt**: 6 gaps across 5 sections. Each new feature that adds a layer or technology widens the gap. The architecture doc should be updated as part of each feature's implementation, not as a separate task.
3. **Feature spec on feature branch only creates friction**: The technical-design job runs from the main repo initially, but the spec only exists on the feature branch worktree. A convention to merge specs to main before starting design would eliminate this friction.
4. **BAML function design benefits from existing examples**: Having `AnalyzeFeedback` as a reference made designing `ClassifyIntent` straightforward. Maintaining well-documented BAML examples is valuable.
5. **Traceability matrix catches completeness gaps early**: Mapping every requirement, AC, data constraint, and error scenario to an RFC section ensures nothing is missed before submission.

## Agent Rule Updates Made to avoid recurrence

1. No rule updates needed — workflow executed within existing rules.

## Enforcement Updates Made to avoid recurrence

1. No enforcement updates needed.
