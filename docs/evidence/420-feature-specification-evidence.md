# Issue #420 — feature-specification Evidence (Round 1)

## Summary

- **Issue**: #420 — Use Azure Communication Services to send survey emails
- **Workflow type**: `feature-specification` (FRAIM job)
- **Outcome**: Draft spec + interactive HTML mock + 6 open questions surfaced for reviewer. Round 1 — no implementation yet.

## Work Completed

### Files created in this round

- `docs/feature-specs/420-send-via-customereq-acs.md` — feature specification (largest artifact; mirrors #378's spec shape).
- `docs/feature-specs/mocks/420-send-via-customereq-acs.html` — interactive 7-scene HTML mock (Distribution tile reshape → Audience builder → Composer + live preview → Confirm modal → Sending state → Sent state → Sent-count surfacing).
- `docs/evidence/420-feature-specification-evidence.md` — this evidence document.

### Approach taken

- Used the `author-project-rules` job's lessons from #495 to dogfood the **Draft-PR-from-spec-phase** convention (Rule 27 just landed in PR #496; this is the first non-meta application).
- Chose `feature-specification` (7 phases) for the heavy spec round; will follow with `technical-design` (RFC) and `feature-implementation` (impl) on the same branch / PR per Rule 26 — all phase artifacts ship as additional commits on this PR.
- Spec shape follows the local convention established by #378 (`378-personalized-survey-links-byo-email.md`): Iteration history table, Customer / Desired Outcome / Customer Problem, §-numbered UX walk-through, Data Model with Prisma blocks, API Endpoints, Architecture/event-driven compliance, Compliance Requirements rooted in project rules 13/23, Validation Plan, Alternatives, Competitive Analysis, Design Standards Applied, Open Questions, Non-goals.

### Phases completed

| Phase | Status | Key output |
|---|---|---|
| `context-gathering` | ✅ | Mapped existing surface area (#378 distribute page, distributionBatches.ts API, ACS connector in packages/connectors/src/email.ts, distributionListParser.ts, memberResolution.ts). Identified that #420 extends #378 by adding a peer ACS-send path. |
| `spec-drafting` | ✅ | Authored spec body + 7-scene HTML mock. Spec slug per memory rule: `420-send-via-customereq-acs` (NOT the deprecated `{issue}-view.html`). |
| `competitor-analysis` | ✅ | All 8 fraim/config.json-configured competitors (SurveyMonkey, Qualtrics XM, Delighted, Medallia, HubSpot Service Hub, Typeform, AskNicely, GetFeedback) have rows in the spec's Configured Competitors table. 3 differentiation pillars articulated. |
| `spec-completeness-review` | ✅ | Verified every issue-body requirement maps to a spec section; compliance section present; design-standards-applied section present; mock file exists. |
| `spec-submission` | ✅ (this doc + Draft PR) | Evidence written; Draft PR opened per Rule 27. |
| `address-feedback` | hold-point | Will iterate inline on the Draft PR; further commits on this branch per Rule 26. |
| `retrospective` | pending | Runs after impl as the last phase artifact on this PR. |

### Open Questions for reviewer (echoed from spec)

| ID | Topic | Spec default | Question for reviewer |
|---|---|---|---|
| **OQ-1** | Sender domain fallback | Use platform `AZURE_COMMUNICATION_SERVICES_EMAIL_FROM` when `Brand.acsSenderDomain` is unset | Is the current platform value the deliberate operator-facing sender domain, or notifications-only? If the latter, require `Brand.acsSenderDomain` before enabling the Send-via-CustomerEQ tile. |
| **OQ-2** | Wildcard syntax | Glob (`*` / `?`) translated to SQL LIKE | Prefer glob (user-friendly) or raw LIKE (`%` / `_`, power-user familiar)? |
| **OQ-3** | Unsubscribe granularity | Brand-wide (`Member.unsubscribedAt`) | Per-survey instead? CAN-SPAM doesn't require either; brand-wide matches industry convention. |
| **OQ-4** | Sent-count surfacing location | Configuration Summary line | Top-of-page stat (more prominent) or under Distribution batches filter (less prominent)? |
| **OQ-5** | Rich-text editor library | TipTap (default if no preference) | Preferred editor library? Or pick during implementation? |
| **OQ-6** | #378 audience-builder reshape | Drop-in reshape (no feature flag) — merged shape degenerates to single-source if one card is empty | Acceptable, or preserve old mutually-exclusive shape behind a feature flag? |

## Validation

### How validated this round

- **Spec readability**: spec follows the local #378 convention (the only other spec at this depth in the repo); reviewer will be reading it in a familiar shape.
- **Mock validity**: HTML/CSS is well-formed, no JavaScript dependencies, reuses #378 mock's CSS-variable system. **Did NOT** open the mock in a Playwright browser this round; reviewer will open from the PR's raw HTML link and any rendering issues surface in Phase 6 (address-feedback).
- **Requirement coverage**: traceability of issue-body requirements → spec sections is enumerated in the `spec-completeness-review` Phase 4 seekMentoring findings (and in the Phase Completion table above).
- **Compliance**: 6 Rule-13-derived obligations enumerated; no compliance gap identified for V0.
- **Competitor coverage**: 8 of 8 configured competitors represented.

### Compliance Validation Plan (for impl phase)

Restated from spec §13.1–§13.6:

- Rule 13.1 (consent enforcement): integration test sends to `consentGivenAt = null` member → worker outcome `Skipped: no consent`.
- Rule 13.2 (unsubscribe suppression): integration test sends to `unsubscribedAt = <date>` member → worker outcome `Skipped: unsubscribed`.
- Rule 13.3 (CAN-SPAM/CASL mandatory footer): snapshot test asserts footer renders with brand legal name + unsubscribe link.
- Rule 13.4 (GDPR Art. 21): integration test asserts `Member.unsubscribedAt` persists across future ACS sends.
- Rule 13.5 (Art. 5(1)(c) minimization): composer validation unit-test asserts warn-on-validate when body contains email/phone patterns.
- Rule 13.6 (audit logging): snapshot test asserts batch-create, per-recipient-send, unsubscribe-confirm each write expected `AuditLog` rows.

## Quality Checks

- [x] Spec ships in `docs/feature-specs/420-send-via-customereq-acs.md` with the correct slug.
- [x] Mock filename mirrors the spec stem (memory rule: `mock filename matches spec`).
- [x] HTML mock, not Markdown code blocks (FRAIM principle "No Markdown Mocks").
- [x] Compliance Requirements section explicit (Rules 13.1–13.6).
- [x] Design Standards Applied section explicit.
- [x] Open Questions block calls out the 6 OQs.
- [x] Non-goals section enumerates 8 V1+ deferrals.
- [x] PR opens as Draft per Rule 27 (dogfooding the convention).

## Phase Completion

All 5 active spec phases complete (Phase 6 address-feedback is a hold-point pending PR review; Phase 7 retrospective runs at end-of-issue). Subsequent FRAIM jobs (`technical-design` for the RFC, `feature-implementation` for the code) will land as additional commits on the same branch / PR per Rule 26.

## Related artifacts

- Issue: https://github.com/mathursrus/CustomerEQ/issues/420
- Branch: `feature/420-use-azure-communication-services-to-send-survey-emails`
- Worktree: `C:\Github\mathursrus\CustomerEQ - Issue 420`
- PR: filled in after `gh pr create`.

## Non-FRAIM provenance note

Rule 27 (PRs Stay Draft Until Work Completion) was the immediately-preceding workflow change (PR #496 — Draft). #420 is the first feature-issue to be authored under the revised Draft-PR workflow. PR #496 itself remains Draft until #420 ships cleanly through to work-completion — confirming the workflow holds for a real-feature path before we mark the workflow rule itself Ready.
