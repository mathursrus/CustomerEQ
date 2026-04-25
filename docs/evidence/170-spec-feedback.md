# Feedback for Issue #170 — Spec Workflow

## Round 1 Feedback

*Received: 2026-04-25 16:51 → 19:50 UTC. Reviewer: rmadhira86. PR #187. Commit reviewed: 105b26c.*

### Acknowledgements (4) — no changes needed; resolve threads on next push

| # | Line | Comment | Status |
| :-: | :-: | :--- | :---: |
| 9 | 131 | "This is good." (subtitle on use-case picker) | ADDRESSED (no change required) |
| 11 | 285 | "Agree with the recommendation" (OD-1 webhook + middleware fallback) | ADDRESSED (no change required) |
| 12 | 291 | "Agreed" (OD-2 extend `ExternalSignalSource`) | ADDRESSED (no change required) |
| 13 | 297 | "Agreed" (OD-3 new `OnboardingState` model) | ADDRESSED (no change required) |

### Substantive feedback (10) — spec changes required

#### Comment 1 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 72 (high-level flow — "Auto-provisioning (server)")
- **Comment**: "I don't see the mock for this signup. Should there be a custom signup page that admin comes to that updates Clerk? In future this signup page may start with pricing plan offerings and admin may start with a priced plan, or get started for Free option. These elements can't / shouldn't be tied to the Clerk Signup."
- **Status**: ADDRESSED
- **Theme**: A — Custom signup page + Clerk decoupling.

#### Comment 2 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 100 (routes table — `/admin` row)
- **Comment**: "Would this dashboard have different states based on the path chosen, or is it same for all experiences?"
- **Status**: ADDRESSED
- **Theme**: B — Path-specific dashboard states.

#### Comment 3 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 96 (routes table — `/admin/onboarding` row)
- **Comment**: "Should a common onboarding page exist that captures organization name, brand, logo, website etc. for the organization signing up? Should it also expose a default theme to choose? Explore what elements of an organization we need across the site and propose."
- **Status**: ADDRESSED
- **Theme**: C — Org profile capture step.

#### Comment 4 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 110 ("Clerk's default post-sign-up behavior creates a personal org…")
- **Comment**: "We should hide this 'My Organization' behavior from Admin. Admin should be able to specify the organization name and we silently update the name. Similarly, review the Clerk signup page to ensure that confusing prompts are not shown to admin when signing up."
- **Status**: ADDRESSED
- **Theme**: A — Custom signup page + Clerk decoupling.

#### Comment 5 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 119 ("Clerk org creation fails for billing or account reasons: admin sees the standard Clerk error — not this epic's concern.")
- **Comment**: "What does this mean? How is the error handled? What is the Admin's course of action?"
- **Status**: ADDRESSED
- **Theme**: D — Error & edge-case specification.

#### Comment 6 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 120 ("User invited to an existing org…")
- **Comment**: "How is a user invited to an existing org, elaborate on which feature or page is covering this experience."
- **Status**: ADDRESSED
- **Theme**: D — Error & edge-case specification.

#### Comment 7 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 121 ("Brand.name changes later: the webhook handler also listens to organization.updated and syncs name…")
- **Comment**: "Is this name changed on Clerk? How do we maintain loose coupling with Clerk to swap out clerk if needed in the future?"
- **Status**: ADDRESSED
- **Theme**: A — Custom signup page + Clerk decoupling.

#### Comment 8 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 130 (use-case picker title — "How do you want to use CustomerEQ?")
- **Comment**: "Instead should the title be something like: Tell us more about your org size? This is not about how they want to use CustomerEQ, but more about the way the customer's organization."
- **Status**: ADDRESSED
- **Theme**: E — Reframe use-case picker as org-shape question (overlaps with C).

#### Comment 10 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 187 (checklist row — "Receive your first event")
- **Comment**: "Does the Admin have to create a program or campaign before waiting for an event? At what stage should we direct them to create Program or Campaign?"
- **Status**: ADDRESSED
- **Theme**: F — Program/Campaign timing in the activation sequence.

#### Comment 14 — UNADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/170-onboarding-first-run.md`
- **Line**: 299 (OD-4 — TTFV via AuditEvent vs dedicated model)
- **Comment**: "Should this be a funnel? How do we know the different times spent by a customer? What if integrating into their app is cumbersome? How do we identify it for future improvements?"
- **Status**: ADDRESSED
- **Theme**: G — Activation funnel (per-step timing) instead of a single TTFV metric. Effectively reverses the recommendation in OD-4.

---

## Theme summary

| Theme | Comments | Scope of change |
| :--- | :--- | :--- |
| **A — Custom signup page + Clerk decoupling** | #1, #4, #7 | New section "Step 0 — Sign-up page (CustomerEQ-owned)"; Identity Provider abstraction layer; new mock for the signup page; pricing-plan extension hook (Free / paid SKU placeholder, no specific tiers invented per project memo). |
| **B — Path-specific dashboard states** | #2 | Add a sub-section under Step 5 explaining how the dashboard differs by archetype after activation (or that it doesn't). |
| **C — Org profile capture step** | #3 | New "Step 1.5 — Org profile" section listing fields (name, brand display name, logo URL, website domain, default theme, optionally org-size category). Schema additions to `Brand` flagged for RFC. |
| **D — Error & edge-case specification** | #5, #6 | Replace the two terse edge-case lines with concrete "what the admin sees / what they can do" UX, plus where the invited-admin flow lives. |
| **E — Reframe use-case picker** | #8 | Change picker title + framing; consider folding into Step 1.5 (theme C) since both are about understanding the organization. Keep the 3 paths but introduce them as one part of the larger "tell us about your org" flow. |
| **F — Program/Campaign timing** | #10 | Clarify the prerequisites: a Program is required before any campaign action; surface this in the checklist (probably as a sub-step on row 5 or a precondition). |
| **G — Activation funnel** | #14 | Change OD-4 recommendation: switch primary recommendation to **dedicated `OnboardingActivationEvent` model** so per-step dwell times are first-class from MVP, not a future-add. Add an internal-analytics surface showing per-step funnel. |
| Acknowledgements | #9, #11, #12, #13 | No spec change. Reply on the threads to confirm + thank. |

## Proposed approach (for reviewer approval before edits)

1. **Add Step 0** — CustomerEQ-owned signup page that wraps Clerk's user-creation but presents only CustomerEQ branding, captures org info, and exposes a plan-selection slot (kept simple for now; explicit "Free" today, structured to accept paid SKUs later without UI rework). Suppress Clerk org-naming UI; we name the org silently from the form input.
2. **Add Identity-Provider abstraction** — name the abstraction (e.g., `IdentityProvider` interface in `apps/api/src/auth/`); enumerate the methods (sign-up, sign-in, get-session, get-org, update-org-name, invite-member, list-members) so swapping Clerk later is a port-only effort. Land as an architectural decision under OD-5 (new).
3. **Reframe Step 2 (use-case picker)** — make it part of a broader org-onboarding form and rename the picker title to something org-shape-oriented ("Tell us about your team and how you'll use CustomerEQ"). Keep 3 archetype cards.
4. **Add Step 1.5** (Org profile) — required fields: org/brand display name, logo, website, default theme; enumerate which surfaces consume each field (admin chrome, member portal header, embed components, email templates, default survey theme). Schema additions flagged for RFC.
5. **Expand edge-case section** — concrete UX for (a) Clerk failure during signup with retry / contact-support actions, (b) invited-member-to-existing-org route with where-they-land semantics, (c) Brand name change going through our DB → Identity Provider abstraction, not directly to Clerk.
6. **Add Path-specific dashboard sub-section** under Step 5 — currently CX Health and Loyalty Health panels apply uniformly; clarify whether archetype influences default panels and CTAs.
7. **Clarify Program/Campaign sequencing** — explicit "Create your program" precondition before "Trigger your first action" can be reached; either as a 6th checklist row OR as an inline prerequisite on row 5.
8. **Update OD-4** — switch recommendation to dedicated `OnboardingActivationEvent` model with per-step dwell-time fields; the funnel surface is part of internal analytics from day one.
9. **Update HTML mocks** — add Scene 0 (signup page) and Scene 1.5 (org profile capture). Re-validate in Playwright.
10. **Refresh traceability matrix + open-decisions table** — add OD-5 (Identity Provider abstraction).
11. **Resolve agreement threads** (#9, #11, #12, #13) on push.

### Estimated impact on the spec

- New sections: 2 (Step 0, Step 1.5).
- Reframed sections: 2 (Step 2 use-case picker, OD-4).
- Expanded sections: 2 (edge cases, Step 5 dashboard states + checklist sequencing).
- New ADR-eligible decision: 1 (OD-5 Identity-Provider abstraction).
- Mock additions: 2 scenes + re-validation.
- Net document growth: ~30-40% larger.

### Pre-execution questions — answered (2026-04-25)

- **Q1 — Pricing plan in Step 0**: *Deferred.* Step 0 ships as account + org-info only; the spec reserves a small visual slot in the form layout (rendered as a dashed placeholder in Scene 1 — "Reserved for plan selection · added in a future epic · today everyone starts on Free") so the plan-selection UI can be added later without restructuring the form.
- **Q2 — Activation funnel storage**: *Switch to dedicated model now.* OD-4 recommendation flipped from `AuditEvent` piggyback to a dedicated `OnboardingActivationEvent` model with `step`, `previousStep`, `dwellMs`, `metadata`. Confirmed by reviewer; no expected drastic impact from a future pricing/subscription model since the two are orthogonal lifecycles.

---

## Where each addressed item landed

| # | Theme | Spec section(s) updated | Mock change |
| :-: | :--- | :--- | :--- |
| 1 | A | New "Step 0 — CustomerEQ-owned signup page" with rationale + form fields + error states; routes table updated; OD-5 added (IdentityProvider abstraction) | New Scene 1 — `#scene-signup` |
| 2 | B | "Path-specific dashboard states" sub-section under Step 5 with archetype × CTA matrix | (Existing Scene 5 already shows post-activation dashboard; archetype variation documented in spec) |
| 3 | C | New "Step 1.5 — Org profile capture" with full field × consumer-surface table | New Scene 2 — `#scene-org-profile` |
| 4 | A | Step 0 captures org name as CustomerEQ field; Step 1 explicitly uses admin-typed name; OD-5 prevents Clerk org-naming UI from surfacing | Scene 1 — no Clerk chrome anywhere |
| 5 | D | Step 0 "Error states" section — 4 concrete categories with admin recovery copy and behavior | (No mock for error states this round; would be a follow-up scene if needed) |
| 6 | D | Step 1 edge case "User invited to an existing Brand by a teammate" expanded with `/accept-invite/<token>` route + per-Brand checklist semantics | n/a |
| 7 | A | OD-5 — IdentityProvider abstraction interface enumerated; Step 1 edge case "Brand name change" routes through abstraction with concrete consistency model | n/a |
| 8 | E | Step 2 — title "How is your setup today?", new subtitle, "reframing per reviewer feedback" rationale paragraph, optional size-cohort hint | Scene 3 — title + subtitle + cohort hint updated |
| 9 | (ack) | n/a | n/a |
| 10 | F | Step 5 — row 5 has explicit "Create your loyalty program" precondition with three sub-states (programCreated false → create-program; true + first-action false → create-campaign; first-action true → done); checklist data shape updated to include `programCreated` | Scene 4 — row 5 description and CTA updated to programCreated=false sub-state |
| 11 | (ack) | OD-1 unchanged | n/a |
| 12 | (ack) | OD-2 unchanged | n/a |
| 13 | (ack) | OD-3 unchanged | n/a |
| 14 | G | Step 6 fully rewritten — `OnboardingActivationEvent` model defined, instrumentation table per step, internal `/admin/internal/onboarding-funnel` surface added; OD-4 recommendation flipped to dedicated model | n/a (the funnel surface is internal-only; not in customer-facing scenes) |

## Round 1 summary

- **14 of 14 comments addressed.**
- 1 new architectural decision added (OD-5 IdentityProvider abstraction).
- 1 existing architectural decision flipped (OD-4 → dedicated `OnboardingActivationEvent` model).
- 2 new spec sections added (Step 0, Step 1.5).
- 2 mock scenes added (signup, org-profile); 1 mock scene reframed (use-case picker title); 1 mock scene updated (checklist row 5 sub-state). Mock browser-validated at 1440×900 — all 5 scenes render cleanly, no overflow/clipping.
- Traceability matrix extended from 12 rows to 22 rows (one row per #170 source + one row per addressed reviewer comment).
- Validation Plan extended from 7 functional + 3 compliance + 2 performance items to 13 functional + 3 compliance + 2 performance items, including OD-5 abstraction integrity and per-step funnel emission tests.

The submitted commit on this round will reference this file as evidence. Threads will be replied to inline on GitHub with pointers to the section landing each change.