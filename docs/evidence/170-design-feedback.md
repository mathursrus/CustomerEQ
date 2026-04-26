# Feedback for Issue #170 — Technical Design Workflow

## Round 1 Feedback

*Received: 2026-04-26 21:48 UTC. Reviewer: rmadhira86. PR #196.*

### Comment 1 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/170-onboarding-first-run.md`
- **Line**: 450 (IdentityProvider abstraction confidence row)
- **Comment**: "Do we need a Spike to verify?"
- **Status**: ADDRESSED
- **Theme**: Spike-before-design verification of the IdentityProvider abstraction.
- **Disposition**: Reviewer was right. Confidence "high" was overconfident. Ran a documentation-and-codebase-driven spike and surfaced two real issues plus two clean-pass methods.

#### Spike landing

Updated the RFC's "Spike Findings" section with the full results. Summary:

| Method | Result | Action |
| :--- | :--- | :--- |
| `parseWebhook` | ✅ Clean | None |
| `updateOrgName` | ✅ Clean | None |
| `createUserWithOrg` | ⚠️ Internally 3 Clerk API calls; partial-failure mode hidden | Interface kept; internal-cleanup contract documented as part of §3.1 interface comment + new row in §10 |
| `completeOAuth({ code, state })` | 🔴 Wrong shape for Clerk-mediated OAuth | **Removed** from the interface; replaced with the existing `getSession` + a new `getUser` method |

#### RFC sections updated

- §3.1 (Interface) — `completeOAuth` removed; `getUser(userId) → { email, name } | null` added; `createUserWithOrg`'s internal-cleanup contract documented inline.
- §4 (API surface) — `/api/auth/oauth/:provider/callback` row removed (Clerk owns the actual callback); `/api/auth/signup/finish` clarified to use `getUser` + `createOrgForUser`.
- §10 (Failure modes) — 3 new rows: `createUserWithOrg` partial failure with user-cleanup contract; OAuth `getSession` returning `orgId: null` (new-user routing); `createOrgForUser` failure on `/api/auth/signup/finish`.
- "Spike Findings" — populated with the 4-method audit + design impact + spike rationale.
- "Confidence Level" — bumped overall from 85 to 90; IdentityProvider abstraction row revised from "high" (overconfident) → "high *(post-spike)*" with concrete justification.

### Round 1 summary

- 1 of 1 comment addressed.
- 1 interface method removed (`completeOAuth`); 1 added (`getUser`); 1 contract clarification (`createUserWithOrg` cleanup).
- 1 API endpoint row removed (`/api/auth/oauth/:provider/callback`); 1 clarified (`/api/auth/signup/finish`).
- 3 new failure-mode rows.
- Confidence revised 85 → 90.
- No mock changes (RFC is text-only).

---

## Round 2 Feedback

*Received: 2026-04-27. Reviewer: rmadhira86. PR #196. Four inline review comments on the "Decisions for the reviewer" section (RFC lines 654–657).*

### Comment 1 — ADDRESSED (Decision #1: single vs. phased migration)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/170-onboarding-first-run.md`
- **Line**: 654
- **Comment ID**: 3144293393
- **Comment**: "Agreed"
- **Status**: ADDRESSED
- **Disposition**: Reviewer accepted the recommended default. RFC unchanged (single migration retained per §2.5).

### Comment 2 — ADDRESSED (Decision #2: `Brand.planTier` placeholder)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/170-onboarding-first-run.md`
- **Line**: 655
- **Comment ID**: 3144296220
- **Comment**: "Plan tier or method is unknown at this time. So I won't design for it yet. Suggest omitting entirely while remembering that we will have to revisit this when pricing model is finalized."
- **Status**: ADDRESSED
- **Theme**: Don't add schema fields for unfinalized features.
- **Disposition**: Reviewer reversed the recommendation (placeholder → omit). Removed `planTier String?` from Brand entirely; flagged the revisit point for the pricing-strategy job.

#### RFC sections updated for Comment 2
- §2.1 (Brand schema): `planTier String?` field removed from the Prisma snippet; "Why no Subscription model now" paragraph replaced with "No pricing/subscription column today" rationale that explicitly hands the schema decision to the pricing-strategy job.
- §2.5 (Migration list): clarified that no `planTier` column is added in this migration (cross-references §2.1).
- §13 (Out of Scope): first bullet rewritten — Step 0 plan/pricing slot is **visual placeholder only, no schema field**; pricing-strategy job lands UI + data shape together.
- Risks table item #7: severity reduced from Med → **Low**; rationale updated to "no migration to drop later — only the visual slot has to be revisited."

### Comment 3 — ADDRESSED (Decision #3: ADR scope)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/170-onboarding-first-run.md`
- **Line**: 656
- **Comment ID**: 3144297453
- **Comment**: "One ADR is fine"
- **Status**: ADDRESSED
- **Disposition**: Reviewer accepted the recommended default. ADR 0004 covers both OD-4 (activation funnel) and OD-5 (IdentityProvider abstraction). Optional ADR 0005 dropped from the architecture-updates plan.

### Comment 4 — ADDRESSED (Decision #4: worker-side emission of `first_action_triggered`)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/170-onboarding-first-run.md`
- **Line**: 657
- **Comment ID**: 3144299084
- **Comment**: "Agreed"
- **Status**: ADDRESSED
- **Disposition**: Reviewer accepted the recommended default. Worker emits `first_action_triggered` directly to `OnboardingActivationEvent` (no relay endpoint). RFC unchanged.

### Round 2 summary

- 4 of 4 comments addressed.
- 1 schema field removed (`Brand.planTier`); 0 added.
- 4 RFC sections updated for the planTier reversal (§2.1, §2.5, §13, Risks #7).
- 1 ADR slot removed from the plan (optional ADR 0005 dropped).
- "Decisions for the reviewer" section converted from open questions to RESOLVED dispositions with reviewer quotes.
- No interface changes, no mock changes, no API surface changes.
