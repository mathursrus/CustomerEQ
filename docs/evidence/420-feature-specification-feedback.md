# Feedback for Issue #420 — feature-specification Workflow

## Round 2 Feedback
*Received: 2026-05-21 (in-conversation review of PR #497 spec round 1)*

### Comment 1 — UNADDRESSED → ADDRESSED (Round 2)
- **Author**: manohar.madhira@outlook.com
- **Type**: pr_review (conversational, transcribed to this file)
- **File**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html` + `docs/feature-specs/420-send-via-customereq-acs.md`
- **Comment**:
  > The mock doesn't include how the Send via Email tool would change based on this. This issue should cover both send scenarios, because they must share the inputs. Survey Title and Link Expiry are not shown in the mocks. Think as a PM — how the two scenarios should overlap and where they diverge. Don't design / re-design in isolation.
- **What was wrong**:
  1. Mock only showed the new `Send via CustomerEQ` flow. The existing `Send via my email tool` flow (#378) was visible only as a button in scene 1; its page-level surface under the new shared audience builder was never illustrated.
  2. `Survey name in mail` (#378 §2.2 — operator-facing survey name flowing into the CSV/email) and `Links expire on` (#378 §2.2 — wave expiry) were omitted from every scene. Both are **shared inputs** consumed by both flows.
  3. The spec described the audience builder as shared (good) but never framed the design as *one shared structure with explicit divergence points* — instead it described one new flow with a parenthetical "shared with #378."
- **Resolution (Round 2 changes)**:
  - **Spec changes**:
    - Added a new §0 *"Shared surface vs path-specific divergence"* block up-front. Tags every input/affordance as `Shared (both modes)` / `Mode-specific (MANAGED_ACS)` / `Mode-specific (SELF_SERVE)`.
    - Inserted a new §2.2 *"Configure state — Common fields (shared with both modes)"* covering `Survey name in mail`, `Links expire on`, and auto-enroll toggle — verbatim semantics inherited from #378 §2.2 / §2.4, applied identically in both modes.
    - Renumbered the previous §2.2 (Composer) → §2.3 and explicitly marked it `Mode-specific (MANAGED_ACS)`.
    - Added §2.4a *"Configure state — Generate (SELF_SERVE mode)"* describing the BYO path's Generate-Links CTA under the new shared structure.
    - Updated §2.5/§2.6 to show both modes' Success states side-by-side (Self-serve = Download CSV per #378; Managed-ACS = Sending/Sent progress per Round 1's §2.4–2.5).
    - Updated §3 (#378 reshape) to enumerate the post-reshape #378 surface: it now uses the §2.1 audience builder + §2.2 common fields + §2.4a SELF_SERVE Generate-Links section — i.e., #378's distribute page is now a `mode=SELF_SERVE` instance of the same single-page component.
    - Added an architectural note: both paths render the same React page component (`<DistributePage mode={...}/>`) parameterized by `mode` query param; the divergent sections are isolated subcomponents (`<SelfServeComposer/>` vs `<ManagedAcsComposer/>`).
  - **Mock changes**:
    - Scene 1 (Distribution tile): button labels and styling unchanged but both are made equal-weight (both `outline-primary`) since the issue body presents them as two peer choices, not primary/secondary.
    - Scene 2 (Audience builder): added the **Common fields** card (Survey name in mail + Links expire on + auto-enroll already on the Custom List card) BELOW the audience list and ABOVE the path-specific area — visible regardless of mode.
    - Scene 3 split into Scene 3A (`Send via my email tool` composer = format dropdown + Generate Links CTA per #378) and Scene 3B (`Send via CustomerEQ` composer = sender + body + send CTA, formerly the only Scene 3).
    - Scenes 4–6 became mode-aware: Scene 4 confirm modal is shown in both variants; Scene 5/6 success states show CSV-download variant alongside Sending/Sent variant.
    - Added a header banner at the top of the mock explicitly labelling **"Shared scenes: 1, 2 · Divergent scenes: 3A vs 3B, 5/6 modes"** so reviewers see the symmetry at a glance.
  - **Coaching moment**: captured at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-21T21-19-48-pm-design-paired-flows-with-shared-structure.md`.
- **Status**: ADDRESSED (Round 2)
