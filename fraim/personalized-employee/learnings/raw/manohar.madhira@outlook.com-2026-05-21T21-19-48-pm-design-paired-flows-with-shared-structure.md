---
author: manohar.madhira@outlook.com
date: 2026-05-21
context: issue-420 / feature-specification phase 6 address-feedback
---

# Coaching Moment: pm-design-paired-flows-with-shared-structure

## What happened

I drafted the #420 spec + 7-scene mock around only the new `Send via CustomerEQ` path. The issue explicitly framed two peer flows ("Send via CustomerEQ and Send via my email tool. Both buttons use the same structure for filtering") and even called out that they "must share the inputs." Despite that, my mock showed only the new flow's audience builder, composer, confirm modal, sending state, and sent state. The pre-existing `Send via my email tool` (#378) flow appeared only as a tile button in scene 1; I never illustrated what the BYO page itself looks like under the new shared audience builder. Worse, I omitted the **shared inputs** the user named — `Survey name in mail` and `Links expire on` (#378's existing common fields, §2.2) — from every scene of my mock. The reviewer pushed back: *"think as a PM — how the two scenarios should overlap and where they diverge. Don't design / re-design in isolation."*

## What was learned

When an issue introduces a UX change that touches a surface used by multiple flows, the spec and mock must frame the design as **one shared structure with explicit divergence points**, and the mock must show both flows side-by-side — not just the new one.

## What the agent should have done

- Read the issue body twice with a PM lens before drafting: *"What surface does each path use? What inputs are shared? Where do they diverge?"*
- Authored a **shared-vs-divergent** section in the spec up-front (one block listing every input/affordance and tagging it `shared` or `mode-specific`) before writing any §-numbered UX walk-through.
- Authored mock scenes as **mode-aware variants** (e.g., scene 3 has 3A for self-serve composer and 3B for managed-ACS composer) so reviewers see the symmetry — not just the new path.
- Pulled the shared inputs (`Survey name in mail`, `Links expire on`, auto-enroll toggle) into a dedicated `Common fields` mock card that appears in both flow variants identically.
- For #420 specifically: shown the `Send via my email tool` page reshape (under the new shared audience builder) as its own mock scene set — that's [[mock-spec-parity-sweep-at-spec-only-rounds]] applied at the spec level, not just at impl-vs-spec.
