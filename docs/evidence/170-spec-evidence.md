# Evidence — Issue #170: Onboarding & First-Run Experience (Feature Spec)

## Summary

- **Issue**: [#170](https://github.com/mathursrus/CustomerEQ/issues/170) — `[Epic] Onboarding & First-Run Experience`
- **Workflow type**: feature-specification (FRAIM job, 7 phases)
- **Branch**: `feature/170-epic-onboarding-first-run-experience` (existing; restored to origin after a prior branch-scope course-correction during session #179)
- **Scope delivered by this PR**: the shared-spine feature spec + interactive mocks + traceability. Archetype connect flows (#171 API/SDK, #172 static-site, #173 multi-app) are each separately specified in their own sub-issues.

## Work Completed

### New / updated files (3)

| File | Purpose |
| :--- | :--- |
| `docs/feature-specs/170-onboarding-first-run.md` (new) | Full feature spec: customer, desired outcome, problem being solved, 6-step UX flow, UI mocks index, design standards, compliance (GDPR/CCPA/SOC2/PCI-DSS), 4 open architectural decisions (OD-1..OD-4), out-of-scope + forward-compatibility notes for future paywall/subscription tiering, validation plan, alternatives, competitive analysis, and a requirement-traceability matrix. |
| `docs/feature-specs/mocks/170-view.html` (new) | Single interactive HTML/CSS mock file with three anchor-linked scenes: `#scene-use-case-picker`, `#scene-checklist-expanded`, `#scene-activated`. Tailwind-like design tokens inlined; accessible (ARIA on checklist, keyboard-nav on cards). |
| `docs/evidence/170-spec-evidence.md` (this file) | Phase-5 submission evidence. |

### Approach

Executed all 7 phases of the FRAIM `feature-specification` job in sequence:

1. **context-gathering** — read issue #170 + sub-issues #171/#172/#173 + hero workflow #6 + business validation report + replication/competitor analyses + existing admin/Clerk/Brand code (via Explore agent). Surfaced FRAIM server reporting stale config for `designSystem` and `compliance` despite the #183 onboarding PR landing both — treated as server-side cache, proceeded with local truth.
2. **spec-drafting** — fetched `templates/specs/FEATURESPEC-TEMPLATE.md`; authored the spec aligned to the template; created the HTML mocks; included a "Forward-compatibility: pricing / subscription tiering" section capturing the 2026-04-24 user constraint that pricing is not finalized and some sections may move behind a paywall. Validated mocks in Playwright at 1440×900.
3. **competitor-analysis** — ran analysis from disk only (`docs/replicate/` + `docs/business-development/`); produced positioning against Annex Cloud, Qualtrics, Yotpo/Smile.io, and the "do-nothing" fragmented-stack alternative. Flagged Yotpo/Smile.io as "disk evidence thin" and recommended a follow-up public-doc survey. Proposed adding four competitors to `fraim/config.json` but deferred the write until user approval.
4. **spec-completeness-review** — ran requirement coverage traceability. Caught a real gap: my initial 5-step checklist included "Choose how you use CustomerEQ" and dropped "first survey live", deviating from #170's explicit milestone list. Rewrote Step 5 to match #170 verbatim (`brand created → data source connected → first event received → first survey live → first action triggered`), demoted "choose path" to a step-2 precondition, and re-validated the updated mock in Playwright. Appended a 12-row traceability matrix to the spec.
5. **spec-submission** — this document.
6. **address-feedback** — pending reviewer comments.
7. **retrospective** — pending PR merge.

### Scope decisions documented in the spec

- **Epic owns the shared spine only.** Archetype connect flows (#171/#172/#173) get their own specs + mocks. This epic provides:
  - `OnboardingState` model (named; full schema is RFC territory).
  - The 5-step shared checklist with specific flags each archetype must set.
  - A shared verification UI shell with a 30s timeout policy and ≥3 failure-mode hints per archetype.
  - The use-case picker.
  - TTFV instrumentation via `AuditEvent`.
- **Paywall forward-compatibility is first-class.** `isPathAvailable(path, brand)` helper routing, configurable app-count cap for #173, no hard-coded "all paths always available" JSX. No SKUs, tier names, or prices invented.
- **Clerk auto-provisioning via webhook + middleware fallback.** OD-1 recommends both paths implemented.

### Open architectural decisions batched for reviewer

| ID | Decision | Recommendation |
| :--- | :--- | :--- |
| OD-1 | Clerk→Brand auto-provision: Svix-signed webhook vs first-login middleware? | Both. Webhook primary; middleware as fallback for delivery lag. |
| OD-2 | #173 multi-app model: new `Application` vs extend `ExternalSignalSource.sourceType`? | Extend. Reuses existing source health/monitoring. |
| OD-3 | `OnboardingState` persistence: new 1:1 model vs fields on `Brand`? | New 1:1 model. |
| OD-4 | TTFV instrumentation: `AuditEvent` piggyback vs dedicated model? | `AuditEvent` for MVP. |
| (Phase 3) | Add 4 competitors to `fraim/config.json.competitors`? | Proposed in spec; not yet written. Requires user approval. |

## Validation

### Mock browser-validation

- Tool: Playwright MCP, viewport 1440×900.
- Full-page screenshot taken at `/170-view.html` after initial draft — all three scenes render cleanly (no overflow, no clipping, no accessibility-blocker contrast, no horizontal scroll).
- Re-screenshot after Phase-4 checklist rewrite — Scene 2 shows corrected 5-row checklist with `brand created → data source connected → first event received → first survey live → first action triggered` milestones, inline `<code>` pills ("Onboarding key", "POST /v1/events") fit without line-wrap, 2-of-5 complete state is legible.
- Console: 1 error (favicon 404 — harmless, common for file-served mocks).
- Responsive check: not performed at mobile viewport for this round; noted as a follow-up if required by reviewer (all three scenes use simple grid-based layouts that should reflow, but unverified).

### Requirement coverage

12-row traceability matrix at the tail of the spec (before Validation Plan) maps every #170 scope item, every #170 AC, every sub-issue contract, and the user's 2026-04-24 paywall constraint to a specific spec section. All 12 rows marked ✅ covered.

### Compliance

Per-regulation control tables for GDPR, CCPA, SOC2 (target month-12), and PCI-DSS (minimal scope — out of scope for this epic). Each table has a "where enforced" column pointing at concrete repo locations (Clerk sign-up ToS, Zod schemas on `/v1/admin/onboarding/*`, erasure-job updates, `AuditEvent.create` from the checklist endpoint, Prisma migrations, Svix signature verification in the Clerk webhook handler).

### Design standards

Spec's "Design Standards Applied" section points at `docs/architecture/architecture.md` per `fraim/config.json.customizations.designSystem`. Mocks follow the shadcn/ui + Tailwind visual language of the existing admin surface. A dedicated design-system document does not yet exist; flagged as a follow-up.

## Quality Checks

- ✅ All 3 deliverables complete and named per repo conventions.
- ✅ Spec matches `templates/specs/FEATURESPEC-TEMPLATE.md` structure with expected sections.
- ✅ Mocks are real HTML/CSS (project rule 14 — no markdown mocks).
- ✅ Every AC in #170 plus every sub-issue contract has a spec section (traceability matrix).
- ✅ Compliance section addresses every regulation in `fraim/config.json`.
- ✅ Open decisions (OD-1..OD-4 + config proposal) batched into a single reviewer checklist.
- ✅ Forward-compatibility for paywall is explicit and follows the "no invented tiers/prices" guardrail from `project_pricing_not_finalized.md` memory.
- ✅ Mock browser-validated at 1440×900.
- ⚠️ Mobile viewport not validated this round — flagged.
- ⚠️ Yotpo/Smile.io competitor research is disk-only; public-doc follow-up recommended.

## Phase Completion

- Phase 1 `context-gathering` — complete
- Phase 2 `spec-drafting` — complete
- Phase 3 `competitor-analysis` — complete (config proposal deferred)
- Phase 4 `spec-completeness-review` — complete (caught and fixed a real coverage gap in Step 5)
- Phase 5 `spec-submission` — in progress (this document)
- Phase 6 `address-feedback` — pending reviewer comments
- Phase 7 `retrospective` — pending PR merge
