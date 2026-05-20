# Feature Implementation Evidence — Issue #413

**Issue**: [#413 — "Powered by CustomerEQ" footer on every survey surface](https://github.com/mathursrus/CustomerEQ/issues/413)
**Spec**: [`docs/feature-specs/413-survey-footer.md`](../feature-specs/413-survey-footer.md)
**Mock**: [`docs/feature-specs/mocks/413-survey-footer.html`](../feature-specs/mocks/413-survey-footer.html)
**Branch**: `feature/413-every-survey-should-have-a-footer`
**FRAIM job**: `feature-implementation`

This doc is the durable record of FRAIM phases 4-onwards. Phase 1 (scoping) lives in [`413-implement-work-list.md`](./413-implement-work-list.md); Phase 5 (UI polish) lives in [`413-ui-polish-validation.md`](./413-ui-polish-validation.md). This file collects the cross-phase summary + Bug Bash findings + Phase 6 (security) findings as the work moves through the remaining phases.

---

## Implementation summary

| Phase | Status | Commit | Artifact |
|---|---|---|---|
| 1 — `implement-scoping` | ✅ Complete | `1469205` | [`413-implement-work-list.md`](./413-implement-work-list.md) |
| 3 — `implement-tests` | ✅ Complete | `dc74e92` | Test scaffolds + R10 baseline + R7 gate |
| 4 — `implement-code` | ✅ Complete | `7264d79` | PoweredByFooter + wiring across 4 surfaces |
| 5 — `implement-validate` | ✅ Complete (this commit) | — | [`413-ui-polish-validation.md`](./413-ui-polish-validation.md) + this doc's Bug Bash section |
| 6 — `implement-security-review` | Pending | — | Findings appended here |
| 7 — `implement-regression` | Pending | — | — |
| 8 — `implement-quality` | Pending | — | — |
| 9 — `implement-completeness-review` | Pending | — | — |
| 10 — `implement-architecture-update` | Pending | — | — |
| 11 — `implement-submission` | Pending | — | — |
| 12 — `address-feedback` | Hold-point | — | — |
| 13 — `retrospective` | Pending | — | `docs/retrospectives/manohar.madhira@outlook.com-issue-413-*-postmortem.md` |

---

## R-item coverage (12 of 12)

| R-item | Spec line | Implementation | Test |
|---|---|---|---|
| R1 — themed footer in `SurveyFormRenderer` | Direct link · active | `SurveyFormRenderer.tsx` (after `</form>`, before `</div>`) | `SurveyFormRenderer.test.tsx` "Issue #413 attribution footer" (4 tests) |
| R2 — neutral footer on standalone state-cards | Direct link · 4 branches | `survey/[id]/page.tsx` 4 branches | `SurveyFormRenderer.test.tsx` R7 non-toggleable + manual browser walk (Phase 5) |
| R3 — neutral footer in widget JS, both paths | Embedded widget | `generateWidgetJs()` form-append + thank-you `innerHTML` swap | `public.test.ts` "Issue #413 — widget footer" (2 R3 tests) |
| R4 — UTM contract | All surfaces | `buildFooterHref(channel)` in `packages/shared/src/footer.ts` | `PoweredByFooter.test.tsx` UTM (7 tests) + `public.test.ts` R4 (2 tests) |
| R5 — email body (contract-only) | Email | N/A — email templates are stubs | Spec contract; ride email-template renderer (deferred follow-up) |
| R6 — anchor uses `<a>` with accessible name | All surfaces | `PoweredByFooter.tsx` + `generateWidgetJs()` widget HTML | All tests assert link + aria-label |
| R7 — non-toggleable | All surfaces | No `hidden` prop on `PoweredByFooter`; no chrome-matrix gate in `SurveyFormRenderer`; widget JS contains no toggle identifier | `scripts/check-no-attribution-toggle.sh` (R7 gate) + 3 tests across `PoweredByFooter.test.tsx` / `SurveyFormRenderer.test.tsx` / `public.test.ts` |
| R8 — a11y: target/rel/aria-label/focus-visible | All surfaces | `PoweredByFooter.tsx` + widget JS string + `globals.css` `:focus-visible` rule | `PoweredByFooter.test.tsx` shared/contract (3 tests) + browser-walk Scene 8 |
| R9 — preview/live parity | Editor preview vs live | Single render path in `SurveyFormRenderer` (no `mode` branch on footer) | `SurveyFormRenderer.test.tsx` "emits the same footer DOM in preview mode and live mode" |
| R10 — widget bundle ≤ 1 KB gzipped delta | Embedded widget | Footer HTML + CSS inlined into `generateWidgetJs()` output | `public.test.ts` "R10 — widget gzipped size stays within baseline + 1 KB budget" — actual delta +752 bytes / budget +1024 ✅ |
| R11 — themed/neutral variant API | All surfaces | `<PoweredByFooter variant="themed" \| "neutral" channel=...>` | `PoweredByFooter.test.tsx` variant classes (2 tests) |
| R12 — byte-identical footer across 4 tokenized states | Tokenized respondent | Single render path in `survey/[id]/r/[token]/page.tsx` `if (tokenState && tokenState !== 'valid')` branch | `page.r12-byte-identity.test.tsx` (6 tests, **user-mandated enforcement**) |

---

## Test count summary

- `apps/web/src/components/survey-form/PoweredByFooter.test.tsx`: 15 passing
- `apps/web/src/components/survey-form/SurveyFormRenderer.test.tsx`: 21 passing (17 pre-#413 + 4 new)
- `apps/web/src/app/survey/[id]/r/[token]/page.r12-byte-identity.test.tsx`: 6 passing (user-mandated R12 enforcement)
- `apps/api/src/routes/public.test.ts`: 23 passing (16 pre-#413 + 7 new for R3/R4/R7/R8/R10)

Total new tests added in #413: **32**. Total touching #413: **65 passing, 0 todo, 0 skipped**.

---

## Bug Bash Findings

Per FRAIM Phase 5 step 7 (`systematic-browser-testing`): navigated the application, tested edge cases and adjacent flows beyond the direct test coverage. Findings recorded by severity below.

### P0 / Critical: 0

### P1 / High: 0

### P2 / Medium: 1 (fixed in-phase)

**[P2-1] Style-element id prefix collision with widget container id**

- **Surface**: Embedded widget (Scene 6).
- **Discovery**: While verifying the widget's footer attachment via `document.querySelector('[id^="ceq-survey-widget-"]')` in DevTools, the selector returned the injected `<style id="ceq-survey-widget-styles">` element first (it's appended to `<head>` before the widget container is mounted to `<body>`), not the actual widget container.
- **Risk**: The widget JS itself uses exact-id matching (`document.getElementById('ceq-survey-widget-' + survey.id)`) for dedupe, so the current dedupe path is unaffected. But any future consumer that prefix-matches the widget id (e.g., a host page wanting to find all CustomerEQ widgets) would silently get false positives.
- **Fix**: Renamed the style id from `ceq-survey-widget-styles` → `ceq-attribution-footer-styles`. No shared prefix; semantically more descriptive of what the styles actually scope. One-line edit in `generateWidgetJs()`.
- **Verification**: All 23 `public.test.ts` assertions still pass after the rename; widget bundle size unchanged (still 2945 bytes gzipped).

### P3 / Low: 0

### Edge cases explored (no findings)

| Case | Method | Result |
|---|---|---|
| Submit with empty email | Click Submit without filling email | Validation gates submission; footer remains visible on form (R1) — no leak / no error state |
| Submit then re-submit same email (ONCE policy) | Two POSTs with same email, response policy `ONCE` | Triggers duplicate branch (Scene 3 amber); footer below the amber card (R2) |
| Navigate to non-existent survey ID | `/survey/nonexistent-survey-id` | Renders Scene 4 load-error card with footer below (R2) |
| Navigate with bogus tokenized URL | `/survey/{realId}/r/bogus-invalid-token-12345` | Renders `invalid` token-state card with footer below (R12 byte-identical via shared render path) |
| Widget on a cross-origin host | Served via `python -m http.server 8889` against api on `:4001` | Footer mounted, embed UTM medium applied (R3 + R4) |
| Mobile viewport 375×812 | Resize via Playwright + re-render Scene 1 | Footer renders within viewport, no overflow / clipping; reads as "Powered by CustomerEQ" |
| Keyboard focus on themed link | `link.focus()` + `getComputedStyle` | 2px outline at `var(--ceq-primary-color)` (= brand's `#4f46e5` here, inheriting via the CSS-var fallback contract); R8 / WCAG 2.4.7 satisfied |

---

## Pre-existing concerns surfaced (out of scope for #413)

| Observation | Pre-#413? | Action |
|---|---|---|
| Widget JS submit returns 422 from `http://localhost:8889` host page | Yes — schema validation rejects test payload, not a CORS issue (CORS regex allows `/localhost/`) | Documented in [`413-ui-polish-validation.md`](./413-ui-polish-validation.md) Scene 6 — used manual `innerHTML` swap to verify the post-submit footer markup |
| Web lint emits 4 warnings (3 `any`-type warnings in `LoopMonitor.tsx`, 1 `Unused eslint-disable`) | Yes (all in files I didn't touch) | Out of scope; left as-is |

---

## Phase 6 (`implement-security-review`) — findings

*To be populated in Phase 6.*

---

## Phase 9 (`implement-completeness-review`) — checklist

*To be populated in Phase 9.*
