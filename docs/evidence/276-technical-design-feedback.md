# Feedback for Issue #276 — technical-design Workflow

## Round 1 Feedback
*Received: 2026-05-05 04:31–05:23 UTC, reviewer: rmadhira86, on PR #282 against commit `e563c2bc`*

### Comment 1 — ADDRESSED (scope re-cut)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/276-survey-level-consent-override.md`
- **Line**: 20 (RFC §"Customer")
- **Comment**: "Why is the API part of a one-time migration spec? Wouldn't this API design also be part of #241 for end-to-end flow?"
- **Resolution**: Accepted. Same scope-ownership logic that put the UX in #241 puts the PATCH endpoint + audit-log payload there too — the API only ever gets called by the survey-editor UX, and #241 is shipping that UX immediately. Re-scoped #276 to **schema + resolver + data migration only**; PATCH endpoint contract, audit-log payload, attestation guard, and the per-route audit-plugin extension all move to #241. Spec R5/R6/R8 deferred to #241 (R5/R6 = PATCH contract; R8 = audit log). RFC sections "PATCH endpoint contract" + "Audit log payload" replaced with one-paragraph deferral notes. Also reduces #276's surface for unblocking production: the data migration unblocks every existing survey under IMPLIED_ON_SUBMIT; survey owners who urgently need to tighten a specific survey to EXPLICIT can either wait for #241 (priority) or use ad-hoc admin SQL (same escape hatch admins use today for brand defaults).

### Comment 2 — ADDRESSED (deferred to #241 per Comment 1)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/276-survey-level-consent-override.md`
- **Line**: 169 (RFC §"Audit log payload" / Option A vs B)
- **Comment**: "Suggest a spike for this"
- **Resolution**: Agreed in principle — the audit-plugin Option A vs B choice does need a spike against the existing plugin's shape before committing. With the scope narrowing in Comment 1, this entire audit-log section moves to #241; the spike becomes #241's responsibility. Captured as a follow-on note in the moved section so #241's design author picks it up.

### Comment 3 — ADDRESSED (recommended kept)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/276-survey-level-consent-override.md`
- **Line**: 300 (Decision #1 — Migration split)
- **Comment**: "Two files. Schema change is permanent. Migration is a one-time activity"
- **Resolution**: Confirms the recommended answer. RFC's "Schema migration" + "Data migration" sections already separate; the rationale ("schema is permanent, data migration is one-time") is now folded directly into the section's intro sentence so future readers see the design reasoning.

### Comment 4 — ADDRESSED (recommended kept; deferred per Comment 1)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/276-survey-level-consent-override.md`
- **Line**: 301 (Decision #2 — Audit-plugin shape)
- **Comment**: "Option A"
- **Resolution**: Confirms the recommended answer (Option A — per-route metadata allowlist). Per Comment 1, the audit-plugin work moves to #241; #241's design author should land Option A unless the spike from Comment 2 surfaces a blocker. Captured as a binding decision-note in the deferred section so #241 doesn't re-litigate.

### Comment 5 — ADDRESSED (override accepted)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/276-survey-level-consent-override.md`
- **Line**: 302 (Decision #3 — `consentReason` max length)
- **Comment**: "500 should be enough."
- **Resolution**: Override accepted. Schema column changed from unbounded TEXT to `String @db.VarChar(500)` in the Prisma model + the SQL migration. The system-reason text written by the data migration ("Production hotfix #276 — pre-existing survey defaulting to IMPLIED_ON_SUBMIT to restore response collection. Override may be tightened by survey owner via #241 UX once shipped.") is 191 chars, well under 500. Trimmed any 2000-char references in the RFC.

### Comment 6 — ADDRESSED (recommended kept)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/276-survey-level-consent-override.md`
- **Line**: 303 (Decision #4 — Resolver source label)
- **Comment**: "Don't add"
- **Resolution**: Confirms the recommended answer. No `consentModeSource` label added; the existing source label on `text` continues to describe text-source only.
