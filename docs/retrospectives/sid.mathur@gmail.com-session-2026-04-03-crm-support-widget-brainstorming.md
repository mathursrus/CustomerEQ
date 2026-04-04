---
author: sid.mathur@gmail.com
date: 2026-04-03
synthesized:
---

# Postmortem: CRM & Support Widget Distance Assessment — Brainstorming Session

**Date**: 2026-04-03
**Duration**: ~20 minutes
**Objective**: Evaluate how far CustomerEQ is from (1) a lightweight CRM with LLM "Know Your Customer" flow, and (2) an AI-powered support widget with knowledge bases and intent-based rules.
**Outcome**: Success

## Executive Summary

Completed a structured codebase analysis and gap assessment for two strategic goals. The analysis revealed CustomerEQ is ~60-70% toward a lightweight CRM (data model is ready, missing synthesis layer) and ~30-40% toward a support widget (strong foundations but missing KB, chat UI, intent classification). Delivered 8 grounded, evidence-backed suggestions with a phased implementation roadmap.

## Architectural Impact

**Has Architectural Impact**: No

## Timeline of Events

### Phase 1: Codebase Analysis
- ✅ **Parallel exploration**: Launched 3 concurrent agents to cover API/MCP, frontend/UI, and data/analytics layers
- ✅ **Complete inventory**: Mapped 35+ API routes, 16 MCP tools, 20+ Prisma models, 3 BAML functions, 37 page routes, 6 BullMQ queues

### Phase 2: Categorized Analysis
- ✅ **CRM gap assessment**: Identified 5 specific gaps (no Customer 360, no LLM synthesis, no search, no health score, no interaction logging)
- ✅ **Support widget gap assessment**: Identified 7 specific gaps (no KB, no RAG, no intent classification, no chat UI, no conversation model, no rule engine, no context injection)
- ✅ **Key insight**: Goal 1 is prerequisite for Goal 2

### Phase 3: Grounded Suggestions
- ✅ **8 suggestions drafted**: Each anchored to specific file paths and existing patterns
- ✅ **Dependency graph**: Mapped inter-suggestion dependencies
- ✅ **Phased roadmap**: A-D phases with sprint estimates

### Phase 4: Verification
- ✅ **Spot-checked claims**: Verified `GET /members/:id` returns flat record (no joins), confirmed MCP tool locations, confirmed widget.js endpoint exists
- ✅ **Quality gates**: All 5 gates passed

### Phase 5: Document Delivery
- ✅ **Artifact written**: `docs/brainstorming/codebase-brainstorming-2026-04-03.md`

## Root Cause Analysis

### 1. **Primary Cause**
N/A — no failures in this session.

### 2. **Contributing Factors**
N/A

## What Went Wrong

1. Nothing significant went wrong in this session.

## What Went Right

1. **Parallel agent strategy**: Running 3 exploration agents concurrently gave comprehensive coverage of API, frontend, and analytics layers simultaneously, significantly reducing wall-clock time.
2. **Evidence-first approach**: Verifying claims against actual code (e.g., confirming members.ts:198 returns flat record) before writing suggestions prevented fabrication.
3. **User's focused framing**: The two-goal structure (CRM + Support Widget) made the analysis sharply targeted rather than diffuse.
4. **Existing codebase maturity**: The well-structured multi-tenant data model with consistent `memberId` foreign keys made gap analysis straightforward — the data relationships are already there.

## Lessons Learned

1. **Synthesis layers are the high-value gap**: When a codebase has rich data models but no aggregation endpoints, the highest-leverage suggestion is always "join the data first" before adding intelligence on top.
2. **Prerequisite ordering matters**: Identifying that CRM (Goal 1) enables Support Widget (Goal 2) changed the roadmap from parallel to sequential — this dependency insight is more valuable than any individual suggestion.

## Agent Rule Updates Made to avoid recurrence

1. No rule updates needed — session executed cleanly.

## Enforcement Updates Made to avoid recurrence

1. No enforcement updates needed.
