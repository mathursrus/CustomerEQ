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
- **Status**: ADDRESSED in commit `<spec-fast-path-commit>`.
