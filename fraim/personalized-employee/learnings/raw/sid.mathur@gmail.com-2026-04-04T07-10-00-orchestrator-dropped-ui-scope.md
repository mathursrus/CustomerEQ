---
author: sid.mathur@gmail.com
date: 2026-04-04
context: issues 98-101 / feature-implementation / analyze-why-you-messed-up
---

# Coaching Moment: orchestrator-dropped-ui-scope

## What happened

When orchestrating parallel feature implementation across 4 issues (#98-#101), the agent wrote implementation prompts that listed only backend deliverables (API endpoints, Prisma models, BAML functions, MCP tools) despite the feature specs containing explicit UI acceptance criteria and HTML mocks for admin pages. The agent then reviewed the technical design RFCs without cross-referencing the original GitHub issue acceptance criteria or feature spec UI sections. The traceability matrices reported by sub-agents were accepted at face value ("29/29 Met") without verifying that the requirement lists included UI items. The result was 4 features deployed to production with full backend APIs but zero admin UI — features are functionally complete but operationally invisible to users. The user discovered the gap when checking the admin navigation.

## What was learned

When orchestrating multi-agent work, the orchestrator must cross-reference the original source of truth (issue ACs + feature spec) at every gate — not just the derived artifacts (RFC) — and must explicitly include ALL deliverable types (backend + frontend + tests) in agent prompts.

## What the agent should have done

1. Before writing implementation prompts, read each feature spec and issue AC list, and include ALL deliverables (admin pages, UI components, frontend routes) alongside backend items. 2. When reviewing technical design RFCs, compare them against the original issue ACs — if "Admin UI for creating/editing support rules" is in the issue but not the RFC, fail the design review. 3. When receiving traceability matrices from sub-agents, read the actual requirement rows to verify they match the issue ACs, not a backend-only subset. 4. Include "verify all acceptance criteria from the GitHub issue are implemented" in QA/bug-bash agent prompts.
