# Issue #531 — UI Polish Validation

## Scope

The fix changes **submission payload shape only** for the Audience Builder. No visual surface changes, no copy changes, no new UI affordances. The two `submitAudience` consumers (`ManagedEmailFlow.tsx`, `SelfServeFlow.tsx`) forward the payload unchanged.

## Findings

- No visual diff in the changed UI surface (Audience Builder shell + Search/Custom/Random cards).
- Hover, focus, suppression-status disabled state, dedup "Added" chip — all unchanged.
- Per `ui-baseline-validation` checklist: no copy reflows, no new spacing decisions, no theme touches.

## Status

**0 P0/P1 findings.** Polish check N/A for this PR — payload-shape fix only, no rendered-surface changes.

Manual end-to-end validation (browser network capture + composer-to-send flow) is recorded in `531-feature-implementation-evidence.md` under "Pending validation modes" and will land before phase `implement-submission`.
