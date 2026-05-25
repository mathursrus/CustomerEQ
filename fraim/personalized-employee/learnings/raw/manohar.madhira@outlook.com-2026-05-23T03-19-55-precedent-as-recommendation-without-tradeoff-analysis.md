---
author: manohar.madhira@outlook.com
date: 2026-05-23
context: issue-420 / technical-design phase 7 address-feedback
---

# Coaching Moment: precedent-as-recommendation-without-tradeoff-analysis

## What happened

In the #420 RFC, I made several design recommendations whose primary justification was "matches existing precedent in this codebase": polling-over-SSE (D3) cited *"no SSE precedent in `apps/api/src/routes/`"*; rich-text editor TipTap (D4) cited *"no existing rich-text editor in the codebase to fight against"*; worker concurrency = 5 (D5) cited *"matches `notifications` queue convention"*. The reviewer pushed back on all three with three different shapes of the same correction: *"No precedence is NOT a good reason for a V1 product"* (D3); *"Shouldn't you give me pros and cons of these vs saying nothing is used?"* (D4); *"5 is fine. But do give more justification than precedence when recommending values or solutions"* (D5). I also wrote *"Round-6 verified absent in codebase: no SSE precedent... → defaulted to polling"* — which is a true codebase fact but the *wrong* basis for a V1 product decision; absence of precedent says nothing about which choice is better for the operator.

## What was learned

Codebase precedent is a *constraint on cost* (this is how the codebase does X, copying it is cheap), not a *justification for design quality*. RFC recommendations need pros/cons + long-term cost analysis, not "this matches X in the codebase."

## What the agent should have done

- For each open decision, draft a small pros/cons table comparing 2–3 real alternatives, with axes that matter to the operator and the long-term product (UX quality, deliverability, performance, dev cost, ops cost, migration risk). Cite precedent as one input to the "dev cost" column, never as the recommendation by itself.
- Specifically for D3 (polling vs SSE): the right framing is *"what does the operator's experience cost in each variant, and what does the platform's infra cost over time?"* — not *"do we have SSE today?"*
- For D4 (TipTap vs alternatives): pick the top 3 (TipTap, Lexical, ProseMirror direct) and compare on bundle size, accessibility, extension ecosystem, maintenance pulse. Recommend with reasoning.
- For D5 (concurrency = 5): ground the number in expected V0 send volume × per-send latency × ACS rate limits, not in "the `notifications` queue uses 5."
- This sister-shapes with [[hallucinated-claims-without-codebase-verification]] from R6: that was about *what exists in the codebase*; this is about *whether what exists is the right justification*. The fix is the same shape — show your reasoning, name the deciding axis, don't substitute a low-effort proxy (precedent, existence) for the analysis.
