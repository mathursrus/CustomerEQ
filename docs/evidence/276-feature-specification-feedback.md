# Feedback for Issue #276 — feature-specification Workflow

## Round 1 Feedback
*Received: 2026-05-05 02:44–03:01 UTC, reviewer: rmadhira86, on PR #282*

### Comment 1 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/evidence/276-feature-specification-evidence.md`
- **Line**: 23
- **Comment**: "While this is good start, the mock is only informational for #241. Actual details of the user experience should be handled by #241. So add it as a comment and reference for it. We will be prioritizing this user experience immediately. It is acceptable for new survey experience to be incomplete for now."
- **Resolution**: Restructured the spec to scope UX work to #241. Added a banner at the top of `mocks/276-view.html` marking it informational only — input to #241, not a #276 deliverable. Updated the evidence doc accordingly.

### Comment 2 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 9 (Customer section)
- **Comment**: "The owner would be a marketing manager or another manager who owns the Survey. An admin would own brand and programs, while the roles may overlap."
- **Resolution**: Updated the Customer section to lead with "marketing manager / survey owner"; admins are now framed as brand/program owners with possible role overlap.

### Comment 3 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 18 (Customer's Desired Outcome section)
- **Comment**: "Ideally the override will also carry a reason for the override."
- **Resolution**: Added a new outcome bullet stating that the override captures a free-text reason alongside the attester + timestamp. Threaded through R1 (schema), R5 (PATCH contract), R7 (migration sets a fixed system reason), R8 (audit surface).

### Comment 4 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 33 (UX section, Persona A)
- **Comment**: "These can be added as a work item for #241 to implement and keep this issue focused on data migration of existing surveys."
- **Resolution**: Removed the Persona A step-by-step UI walkthrough. Replaced with a short paragraph stating that the data-model + backend land here; survey-editor UX belongs to #241, with the mock as informational input.

### Comment 5 — ADDRESSED (deferred to #241)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 38 (UX section)
- **Comment**: "Ideally only one of the two modes should be shown. Need not show the option which is same as the Brand."
- **Resolution**: Captured as a UX note in the spec's "UX deferred to #241" section. The actual radio-rendering decision lives in #241. The mock currently shows all three options because that's the worst-case (most-cluttered) shape; #241 will refine it to only show the override option that differs from the brand.

### Comment 6 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 44 (Persona A step 4 — attestation modal)
- **Comment**: "It should also capture the reason"
- **Resolution**: Reason is now part of R5 (PATCH endpoint contract requires both attestation + reason when overriding to a more permissive mode). The attestation modal in the mock has been updated to include a reason text field.

### Comment 7 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 45 (Persona A step 5 — column writes)
- **Comment**: "And Survey.consentReason - the text used for override"
- **Resolution**: Added `Survey.consentReason: String?` to the schema in R1. Required when `consentMode != null` AND mode is more permissive than brand; nullable otherwise. Migration sets it to `'__migration_276__: pre-existing survey defaulting to IMPLIED_ON_SUBMIT'` for backfilled rows.

### Comment 8 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 46 (Persona A step 6 — badge)
- **Comment**: "Include reason"
- **Resolution**: Updated R8 to require the badge / audit-trail surface (in #241) to display the reason text alongside attester + timestamp. Mock updated.

### Comment 9 — ADDRESSED (no change needed — confirmation of recommended)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 86 (Open Decisions table — Q1)
- **Comment**: "Null is fine."
- **Resolution**: Q1 recommended answer (nullable column) confirmed. No change to the spec.

### Comment 10 — ADDRESSED (no change needed — confirmation of recommended)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 87 (Open Decisions table — Q2)
- **Comment**: "Reuse"
- **Resolution**: Q2 recommended answer (reuse `consentSuppressedAttestedBy/At`) confirmed. No change to the spec.

### Comment 11 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/feature-specs/276-survey-level-consent-override.md`
- **Line**: 88 (Open Decisions table — Q3)
- **Comment**: "All Surveys across all organizations."
- **Resolution**: Q3 flipped from recommended ("all rows created before #231 PR1 deploy timestamp") to alternative (a) "all rows unconditionally across all organizations". Updated R7 (migration) to drop the timestamp boundary; the migration now sets `consentMode = IMPLIED_ON_SUBMIT` on every Survey row where `consentMode IS NULL` and writes the migration attribution into `consentSuppressedAttestedBy/At` + `consentReason`. Idempotency guard (`WHERE consentMode IS NULL`) preserved per #270 lessons.
