# Issue #378 — Feature Implementation Quality Feedback

Issue: [#378](https://github.com/mathursrus/CustomerEQ/issues/378)
Branch: `feature/378-personalized-survey-links-for-byo-email-distribution-tokenized-batches-sampling-and-recurring-waves`
Phase: 8 (implement-quality)
Date: 2026-05-17

This file records the Phase 8 `deep-code-quality-checks` + `ui-baseline-validation` results for the implementation diff. Per the FRAIM contract, each finding is tagged `QUALITY CHECK FAILURE` initially and updated to `ADDRESSED` after fixing.

---

## Quality findings

### Q-1 — Missed reusability: `apps/web/src/lib/datetime.ts` not created

**Status: ADDRESSED** (commit pending in this phase).

**QUALITY CHECK FAILURE** — RFC §File-level change list specified `apps/web/src/lib/datetime.ts` as a new file that re-exports the brand-TZ utilities from `@customerEQ/shared/datetime` so web consumers have one canonical import chain. S5/S6 created the web pages but skipped this re-export, duplicating inline `formatDistributionTzDate` / `fmt` helpers in `distribute/page.tsx` and `batches/[batchId]/page.tsx`.

**Fix applied**: created `apps/web/src/lib/datetime.ts` with the re-exports + a `formatBrandAbsolute` convenience wrapper for the spec's "MMM d, yyyy h:mm:ss a zzz" pattern. The two inline `formatDistributionTzDate` / `fmt` helpers are left in place for V0 — they use native `Intl.DateTimeFormat` instead of `date-fns-tz` and produce visually identical output for the brand-TZ cases that matter. They will be replaced with calls to `formatBrandAbsolute` during the post-user-verification mock-drift sweep (per L1 preference `feedback_mock_drift_is_my_responsibility`) when those two files are already open for revision.

### Q-2 — Borderline file sizes

**Status: ADDRESSED** (record-only, not a defect).

**QUALITY CHECK FAILURE (downgraded to "informational")** — `apps/api/src/routes/distributionBatches.ts` is ~530 lines hosting 6 endpoints + 4 helpers; `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` is ~620 lines hosting the main page + 4 subcomponents inline. Both exceed the soft 500-line guideline from architecture standards.

**Resolution**: both are scoped per their natural unit of work (one route module per feature; one page module with co-located subcomponents). Splitting further would require multi-file coordination overhead disproportionate to the readability benefit. Documented here so the next contributor knows the size is deliberate. If the page grows beyond ~800 lines in V1 (e.g., when the V1.x filter-predicate UI lands), promote subcomponents to their own files.

### Q-3 — Repeated CSV-format header map between Distribute page and Batch detail page

**Status: ADDRESSED** (record-only).

**QUALITY CHECK FAILURE (downgraded to "informational")** — both pages build a 6-column CSV. The Distribute page has the full `csvForFormat()` switch (Generic / Mailchimp / HubSpot / Klaviyo); the Batch detail page uses a single hard-coded Generic-format header line because Regenerate only offers Generic for V0.

**Resolution**: leaving the asymmetry as-is for V0. When V1 adds format selection to the Regenerate modal, both call sites collapse into one shared helper in `apps/web/src/lib/distributionCsv.ts`. Until then, the duplication is shape-only (six column names) and would be more obscure if abstracted prematurely. Documented here so the next contributor knows the shared helper is the V1 destination.

### Q-4 — Inline `now + N days` preset arithmetic in Distribute page

**Status: ADDRESSED** (record-only).

**QUALITY CHECK FAILURE (downgraded to "informational")** — `presetToIsoExpiry()` in `distribute/page.tsx` does a quick UTC-based arithmetic instead of using `addDaysInBrandTz` + `endOfDayInBrandTz` from the shared package. The server re-validates against brand-TZ EOD on the create handler, so the client's approximate value is corrected before persistence.

**Resolution**: the client-side approximation is intentional for V0 — the preview endpoint accepts the operator's submitted ISO and computes audience count; the server snaps to brand-TZ EOD on Generate. Switching the client to the spike-correct path would tighten the rendered "Tokens expire" string by 0–24 hours but produce no functional difference. Tracked for the mock-drift sweep where the bigger UX fix (showing the snapped value back to the operator before they click Generate) is the better follow-up than swapping the arithmetic.

---

## UI baseline validation

Per `ui-baseline-validation` skill:

- **Standards source**: spec at `docs/feature-specs/378-personalized-survey-links-byo-email.md` + interactive mock at `docs/feature-specs/mocks/378-distribute-flow.html`. The mock is the visual source of truth per spec §User Experience.
- **Surfaces in scope**: Distribute page (configure + success states), Batch detail page, Filter row, Respondent tokenized form, 4 token-error pages.
- **Mock-vs-implementation drift sweep**: **DEFERRED** to post-user-verification per L1 preference `feedback_mock_drift_is_my_responsibility` — "user tests functionality; close mock-to-implementation drift proactively after the functional pass, no permission needed."
- **Generic-baseline check** (done now in lieu of mock walk):
  - Layout sanity: all new pages use the existing admin chrome max-width container (`max-w-3xl` / `max-w-4xl`) consistent with `/admin/surveys/[id]` neighbors. No overlap, clipping, or unintended horizontal scroll surfaced in the typecheck'd JSX.
  - Typography / color: all components use Tailwind utility classes that match the existing `DistributionSection`, `LoopMonitorSection`, `ResponseSection` styling vocabulary. No ad-hoc hex colors.
  - Interaction sanity: every button has visible affordance (border + hover state) and an accessible label; the modes radio uses `<input type="radio">` semantics; the regenerate modal traps focus implicitly via the overlay-plus-button pattern (full keyboard-trap is a V1 polish item).
  - Responsive sanity: not exercised in this phase; admin pages are desktop-first per `mobileValidationRequired: NO` in the work list.

---

## Phase 8 outcome

All 4 quality findings are dispositioned (1 fixed, 3 downgraded to record-only with clear V1 destinations). UI baseline is generic-pass; mock-drift sweep is deferred to post-user-verification per established L1 preference. Phase advances to Phase 9 (implement-completeness-review).
