# Feedback for Issue #524 — feature-specification Workflow

## Round 1 Feedback
*Received: 2026-05-27 (conversational, on mock review)*

### Comment 1 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational review of mock
- **File**: `docs/feature-specs/mocks/524-switch-member-identifier-kind.html` (Scene 2)
- **Comment**: "In Scene 2, there is a possibility that an organization with Member ID may have enrolled with emails for all the members — especially if they want to take care of sending emails for surveys etc. This scenario doesn't call that out. What happens when all members have emails?"
- **How addressed**:
  - **Spec** (`docs/feature-specs/524-switch-member-identifier-kind.md`):
    - Added **R28** — when all existing members have a populated, valid, unique `Member.email`, the flow SHALL offer a fast path that uses those emails without requiring a CSV upload (with an optional "override via CSV" affordance).
    - Modified **R4** — the mapping template SHALL pre-fill the `new_email` column with each member's existing `Member.email` where populated (not just blanks).
    - Added context in "User Experience" explaining the three data-state branches (all-emails-on-file / partial / none) and which scenes cover them.
    - Added acceptance criterion for R28 and an entry under "Error States" for the case where existing emails fail validation.
  - **Mock** (`docs/feature-specs/mocks/524-switch-member-identifier-kind.html`):
    - Added **Scene 2A — Fast path** (all members have email): summary card showing emails on file, primary "Use existing emails", secondary "Upload override CSV instead".
    - Modified the original **Scene 2 (now 2B — Partial / missing)**: explicit "Partial coverage" framing; template description notes pre-fill from existing emails; only members without an email need the admin to fill them in.
- **Coaching moment**: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-28T06-18-25-enumerate-existing-data-as-mapping-source.md` — the lesson is to enumerate every existing column that could supply the mapping data before designing a data-mapping/import wizard.
- **Status**: ADDRESSED in commit `1a0d637`.

## Round 2 Feedback
*Received: 2026-05-27 (conversational, on mock review)*

### Comment 1 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational review of mock
- **File**: `docs/feature-specs/mocks/524-switch-member-identifier-kind.html` (entire flow — cutover semantics)
- **Comment**: "What happens when activity has to be done by the brand? E.g. if they had embedded surveys and they need to switch to providing emails instead of member id, or if their integrations were sending purchase events using the memberid."
- **How addressed**:
  - **Spec** (`docs/feature-specs/524-switch-member-identifier-kind.md`):
    - Added a new "Brand-side cutover lifecycle" subsection in User Experience covering pre-migration impact preview → in-flight catch-up → post-flip grace window → grace expiry.
    - Added **R30** (data-driven impact preview before confirm, listing real integration surfaces using the current identifier).
    - Added **R31** (grace window after kind flip; default 30 days, configurable 7–90).
    - Added **R32** (during grace, dual-key resolution accepts old or new identifier; extends R19/R20 from "during re-key" to "during re-key + grace").
    - Added **R33** (old-key usage telemetry during grace, per ingress source).
    - Added **R34** (admin grace-status panel with deadline, per-ingress usage, ability to extend).
    - Added **R35** (after grace expiry, old-key inbound requests are rejected with a specific error code).
    - New acceptance criteria for R30/R32/R33/R35.
    - New error state: integrations still on the old key after grace expiry.
  - **Mock** (`docs/feature-specs/mocks/524-switch-member-identifier-kind.html`):
    - Added pre-migration impact preview to the Confirm scene (Scene 5) showing which surfaces use the current identifier today.
    - Added new **Scene 7B — Grace window** showing the deadline, old-key usage breakdown by ingress, and the "extend grace" affordance.
    - Added new **Scene 7C — Grace expired** showing the cutover-complete state.
- **Coaching moment**: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-28T06-39-52-design-for-brand-side-cutover-not-just-system-catchup.md` — spec the external-actor cutover with the same rigor as the internal data migration.
- **Status**: ADDRESSED in commit `3cb95c9`.

## Round 3 Feedback
*Received: 2026-05-28 (inline PR review comments on commit `4d90049`)*

11 inline review comments across the spec. Mapped one-to-one to addressed changes:

| # | Line | Comment summary | How addressed |
|---|---|---|---|
| RC1 | L47 | Need a higher-level R that the engine is direction-agnostic so future EMAIL↔PHONE↔CUSTOMER_ID lanes don't cause rework | Added **R0** at the top of Functional Requirements under a new "Engine architecture" group, plus a new AC. |
| RC2 | L58 | "Should this be R5 or R12?" on R29's tail reference | R29 now references **both**: R12 for per-row issue display + R5 for the upload path. |
| RC3 | L70 | Attestation should be logged for audit | **R13** strengthened to record admin identity + timestamp + verbatim attestation text and persist alongside the migration audit row. **R25** strengthened to capture the verbatim attestation text and to require grace-window extensions be appended to audit too. New AC added. |
| RC4 | L85 | "Would this list all entry points or only used ones?" | **R30** clarified: only surfaces with non-zero activity in the last 30d are listed, ordered by most-recent-activity first; zero-activity surfaces are omitted. Scene 5 copy updated. |
| RC5 | L86 | "Who decides the grace period and where?" | **R31** simplified — fixed 30-day initial window (not configurable at confirm time), extension via R34. (See also RC11.) |
| RC6 | L90 | Pre-expiry warning ~7 days before grace ends | Added **R37** — brand-wide admin banner + section panel upgrade when ≤7 days remain AND any ingress is still using the old key. New AC added. New mock **Scene 7Bw** added showing the warning state. |
| RC7 | L179 | "P1 is fine" | Open Questions section converted to "Resolved Decisions": Priority = **P1** (unit + integration). |
| RC8 | L180 | "Not needed on successful migrations" (rollback) | Resolved Decisions: post-success rollback **not in scope**; failure-rollback via R23 remains. |
| RC9 | L181 | "We don't need quarantine for now" | Resolved Decisions: **100% coverage required (R8); no quarantine.** |
| RC10 | L183 | "Simple action with a log. Attestation not required" (extend grace) | **R34** updated — extend is a simple admin action, audit-logged via R25, **no attestation gate**. Resolved in decisions. |
| RC11 | L182 | "Use 30 and allow extension" | **R31** simplified (already covered in RC5 row). Resolved Decisions: grace = 30 days fixed + extension. |

Files touched:
- `docs/feature-specs/524-switch-member-identifier-kind.md` — R0 + R37 added; R13/R25/R29/R30/R31/R34 strengthened; new ACs; Open Questions → Resolved Decisions; lifecycle subsection updated.
- `docs/feature-specs/mocks/524-switch-member-identifier-kind.html` — Scene 5 ordering clarifier; new Scene 7Bw (pre-expiry warning) with brand-wide admin banner pattern; nav updated.

Note: this round was normal review iteration (clarifications + small gap finds), not a corrective miss — deferring coaching-moment capture to the spec-phase retrospective.

- **Status**: ADDRESSED in commit `1965a3b`.

## Round 4 Feedback
*Received: 2026-05-28 (conversational, on mock + spec review)*

### Comment 1 — ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: conversational review of mock + spec
- **File**: `docs/feature-specs/524-switch-member-identifier-kind.md` (R28) + `docs/feature-specs/mocks/524-switch-member-identifier-kind.html` (Scene 2A)
- **Comment**: "In Mapping intake, in R28, if admin decides to take the Override path, the process should be same as R4. Include this in spec and also name the 'Upload Override CSV' appropriately."
- **How addressed**:
  - **Spec R28**: spelled out that the override path routes into the **same flow as R4 → R5 → R6–R12** — download mapping template (already pre-filled from existing emails per R4), let the admin edit any rows, upload, run pre-flight validation. No separate override pipeline. Stated explicitly: "the override is just the normal upload path entered from the fast-path scene with a fully pre-filled template."
  - **Spec User Experience (Step 1, fast path branch)**: renamed the affordance and clarified it routes into the same flow as Scene 2B.
  - **Mock Scene 2A**: renamed the button from "Upload override CSV instead" → **"Edit mapping before migrating"**. Updated the supporting copy in the green modal-info to use the new name and explain that the template will come pre-filled.
- **Status**: ADDRESSED in commit `634a903`.
