# UI Polish / Baseline Validation — Issue #524 (Switch Member Identifier Kind, Slice 1)

`uiValidationRequired: true`. Target journeys: Org Settings → Member identification → guided wizard (entry → choose/prepare → upload/validate → confirm/attest → progress → complete → grace → pre-expiry banner → expired/failed). Breakpoint baseline: desktop admin. Design system: existing admin Tailwind utilities (the mock's CSS class names are not used; components mirror `MemberIdentificationSection` / `OrganizationSettingsForm` styling).

## Validation method
Static UI baseline review of the implemented components against the 9-scene mock (`docs/feature-specs/mocks/524-switch-member-identifier-kind.html`) + `next build` (passes, includes lint-as-error). **Live Clerk-authenticated browser click-through is the user's functional pass** (Rule 18: the admin wizard is gated by real Clerk auth; Playwright cannot authenticate it, and dev-bypass is reserved for scripted non-UI runs). All endpoint behavior the UI depends on is covered by the 10 integration tests against live Postgres.

## Scene-by-scene affordance coverage (mock → implementation)
| Scene | Affordance | Implemented |
|---|---|---|
| 1 Entry | "Switch identifier method →" replaces dead mailto; radios stay disabled | ✅ `MemberIdentificationSection` |
| 2A Fast path | target radios (Email/Phone-disabled), success banner, 4 stat cards, "Use existing emails", "Edit mapping before migrating", Cancel | ✅ `MigrationWizard` |
| 2B Partial | info banner (withEmail/total), "Download template (CSV)", "Next: Upload mapping" | ✅ |
| 3 Upload-clean | file chip ✓Validated, 4 stat cards, "Next: Review & confirm" | ✅ |
| 4 Upload-errors | file chip "N blocking issues", stat cards, per-row issues table, Next disabled | ✅ |
| 5 Confirm | impact-preview table, "What happens next", attestation checkbox, danger "Migrate N members" disabled until checked | ✅ |
| 6 Migrating | progress bar, 4 stat cards, live note | ✅ `MigrationProgressPanel` (polled) |
| 7 Complete / 7B Grace / 7Bw Pre-expiry | grace badge + deadline + per-ingress table + "Extend grace +30"; ≤7d danger state | ✅ `GraceStatusPanel` + brand-wide `UsageWarningBanner` |
| 7C Expired | cutover-complete | ✅ `GraceExpiredPanel` |
| 8 Failed | rolled-back warn, stat cards, per-member error rows (R24), Retry | ✅ `MigrationFailedPanel` (errorRows) |

## Intentional divergences from the mock (RFC-faithful)
- **`/v1/events` not shown** in impact preview / grace tables. Mock lists it, but RFC §M proves it is internal-id-keyed and migration-stable; the tables are data-driven off the API which omits it. Correct.
- Ingress labels use the contract names ("Public survey responses", "Manual API enroll", "Custom List distribution batches"), not the mock's Acme-specific captions.
- No internal issue numbers / PR links / repo paths in any rendered copy (Phone shows "Available in a subsequent release").

## Findings
| ID | Severity | Finding | Disposition |
|---|---|---|---|
| P-1 | Low → fixed | `[id]` status page polled every 2s indefinitely on terminal states (`enabled: true`). | Fixed: `enabled` now derived from status — polls only while PROCESSING / in grace, stops on terminal. |
| P-2 | Low | The Member identification *section* renders an inline migration snapshot (not polled); live progress lives on the linked `[id]` page. | Accepted for Slice 1 — the section links to the live detail page ("View migration progress →"). |

**No P0/P1 findings.** Phase not blocked.
