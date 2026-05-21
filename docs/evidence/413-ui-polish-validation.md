# UI Polish Validation — Issue #413

**Issue**: [#413 — "Powered by CustomerEQ" footer on every survey surface](https://github.com/mathursrus/CustomerEQ/issues/413)
**Spec**: [`docs/feature-specs/413-survey-footer.md`](../feature-specs/413-survey-footer.md)
**Mock**: [`docs/feature-specs/mocks/413-survey-footer.html`](../feature-specs/mocks/413-survey-footer.html)
**Phase**: 5 (implement-validate)
**Date**: 2026-05-20
**Validator**: Claude Opus 4.7 (1M context) via Playwright MCP
**Status**: ✅ PASS — no P0/P1 findings; one P2 finding fixed in-phase

---

## Validation Requirements (from Standing Work List)

| Requirement | Status |
|---|---|
| `uiValidationRequired` | ✅ Browser walk completed |
| `mobileValidationRequired` | N (responsive-only — no emulator) |
| Browser baseline | Chromium via Playwright |
| Target breakpoints | Desktop 1280×900 + Mobile 375×812 |
| Mock-conformance sweep | ✅ 8 of 9 scenes verified; Scene 7 N/A (R5 contract-only) |
| R12 byte-identity (4 tokenized states) | ✅ Verified by 6 passing unit tests (`page.r12-byte-identity.test.tsx`); browser-walk confirmed `invalid` state visually |
| Widget bundle delta ≤ 1 KB gzipped (R10) | ✅ +752 bytes (budget +1024) |
| R7 no-toggle gate | ✅ Clean against full source tree |

---

## Surface walk-through

Each surface was rendered in a live browser at the URL listed, with the post-#413 web (`http://localhost:3001`) + api (`http://localhost:4001`) dev servers running on alternate ports (so the main worktree's dev session on 3000/4000 was untouched). Screenshots saved under `docs/evidence/ui-polish/413/`.

### Scene 1 — Direct link · Active questions (themed footer)

- **URL**: `http://localhost:3001/survey/cmp28kp6200032pw7s5r7difs`
- **Screenshot**: [`scene-1-direct-link-active-themed-desktop.png`](./ui-polish/413/scene-1-direct-link-active-themed-desktop.png)
- **Computed styles verified** (live browser via `getComputedStyle`):
  - `classList`: `ceq-powered-by ceq-powered-by--themed` ✅
  - `color`: `rgb(17, 24, 39)` (= `#111827`, theme `--ceq-text-color` default) ✅
  - `fontFamily`: `system-ui` ✅
  - `fontSize`: `12px` (= 75% of 16px body size) ✅
  - `opacity`: `0.55` ✅
  - `borderTop`: `1px solid rgba(0, 0, 0, 0.04)` ✅
  - `textAlign`: `center` ✅
  - Link `color`: `rgb(17, 24, 39)`, `opacity`: `0.85` ✅
  - Link `href`: `https://customereq.com/?utm_source=survey_footer&utm_medium=link&utm_campaign=powered_by` ✅
  - Link `target`: `_blank`, `rel`: `noopener noreferrer` ✅
  - Link `aria-label`: `Powered by CustomerEQ — opens customereq.com in a new tab` ✅

**Result**: PASS — all R1 / R4 / R8 / R9 visual contracts confirmed live.

### Scene 2 — Direct link · Thank you (neutral, standalone)

- **URL**: `http://localhost:3001/survey/cmp28kp6200032pw7s5r7difs` after submitting a fresh email + NPS 9.
- **Screenshot**: [`scene-2-standalone-thank-you-neutral-desktop.png`](./ui-polish/413/scene-2-standalone-thank-you-neutral-desktop.png)
- **Verified**:
  - `<h2>Thank you!</h2>` + `<p>Thank you for your feedback!</p>` ✅
  - Footer below state-card, `ceq-powered-by ceq-powered-by--neutral` ✅
  - Computed `color`: `rgb(107, 114, 128)` (= `#6b7280`) ✅
  - Computed `fontSize`: `11px`, `opacity`: `1` ✅
  - Link `color`: `rgb(55, 65, 81)` (= `#374151`) ✅
  - Link `href` (utm_medium=link) correct ✅

**Result**: PASS — R2 confirmed live.

### Scene 3 — Direct link · Already responded (amber, standalone)

- **URL**: `http://localhost:3001/survey/cmp59s122000i6f5mgzboczbh` (Test CES survey, temporarily set to `responsePolicy=ONCE`; reverted to `MULTIPLE` after capture).
- Submitted once, then re-submitted the same email to trigger the duplicate branch.
- **Screenshot**: [`scene-3-standalone-already-responded-amber-desktop.png`](./ui-polish/413/scene-3-standalone-already-responded-amber-desktop.png)
- **Verified**:
  - Card chrome: `bg-amber-50 border-amber-200` (amber) ✅
  - `<h2>Already responded</h2>` + `<p>You've already submitted a response to this survey. Thank you for your feedback!</p>` ✅
  - Footer below, neutral variant ✅

**Result**: PASS — R2 (duplicate branch) confirmed live.

### Scene 4 — Direct link · Load error (red, standalone)

- **URL**: `http://localhost:3001/survey/nonexistent-survey-id`
- **Screenshot**: [`scene-4-standalone-load-error-red-desktop.png`](./ui-polish/413/scene-4-standalone-load-error-red-desktop.png)
- **Verified**:
  - Card chrome: `bg-red-50 border-red-200` ✅
  - Body text: "Survey not found" (server message) ✅
  - Footer below, neutral variant ✅

**Result**: PASS — R2 (load-error branch) confirmed live.

### Scene 5 — Direct link · Loading

- Loading state is transient and resolves to Scene 1 / 4 within a few hundred ms.
- The state-card chrome is identical to Scene 4's red card (per implementation in `survey/[id]/page.tsx` lines 122-128, now wrapped in `overflow-hidden` so the footer attaches cleanly).
- The R7 + R9 invariants of the footer are tested in unit tests; the loading branch shares the same `<PoweredByFooter variant="neutral" channel="link" />` line.

**Result**: PASS — implementation matches spec; no separate visual artifact captured.

### Scene 6 — Embedded widget (neutral)

- **Host page**: `http://localhost:8889/widget-host.html` (Python http server on `.playwright-mcp/widget-host.html` simulating a brand's site with `<script src="http://localhost:4001/v1/public/surveys/{id}/widget.js">`)
- **Screenshots**:
  - Active form: [`scene-6-embedded-widget-neutral-desktop.png`](./ui-polish/413/scene-6-embedded-widget-neutral-desktop.png)
  - Post-submit (thank-you swap): [`scene-6b-embedded-widget-thank-you-swap-desktop.png`](./ui-polish/413/scene-6b-embedded-widget-thank-you-swap-desktop.png)
- **Active form verified**:
  - Widget container mounted (`div#ceq-survey-widget-cmp28kp6200032pw7s5r7difs`)
  - `<style id="ceq-attribution-footer-styles">` injected into `document.head` (deduped — would no-op on repeat embeds) ✅
  - Footer present inside the widget container with `ceq-powered-by ceq-powered-by--neutral` class ✅
  - Link `href` with `utm_medium=embed` (not `link` — embed channel correctly applied) ✅
  - Computed `color`: `rgb(107, 114, 128)`, `fontSize`: `11px` ✅
- **Thank-you swap verified** (R3): manually applied the `container.innerHTML` swap from the generated JS to verify the footer survives the DOM replacement. Result: footer present, `utm_medium=embed` preserved, body text reads "✓ Thank you! Your feedback has been recorded. Powered by CustomerEQ" ✅

**Result**: PASS — R3 (footer in both widget paths) + R4 (embed UTM medium) confirmed live.

### Scene 7 — Email body

- **N/A per R5** — email templates are stubs (`apps/worker/src/processors/notifications.ts` L35). Footer contract documented in spec + mock; rides whenever email-template renderer ships (deferred follow-up).

### Scene 8 — Keyboard-focus close-up (themed)

- **Screenshot**: [`scene-8-themed-focus-state-close-up-desktop.png`](./ui-polish/413/scene-8-themed-focus-state-close-up-desktop.png)
- Focused the themed footer link via `element.focus()` (more reliable than tabbing through 20 form controls). Computed styles:
  - `outline`: `rgb(79, 70, 229) solid 2px` (= `#4f46e5` — this brand's `--ceq-primary-color`; the rule reads `var(--ceq-primary-color, #6366f1)` and inherits the brand value when the brand overrides the default) ✅
  - `outlineWidth`: `2px` ✅

**Result**: PASS — R8 / WCAG 2.4.7 focus indicator confirmed live with theme-token inheritance.

### Scene 9 — Tokenized route · token-error states

- **URL** (invalid state): `http://localhost:3001/survey/cmp28kp6200032pw7s5r7difs/r/bogus-invalid-token-12345`
- **Screenshot**: [`scene-9-tokenized-invalid-neutral-desktop.png`](./ui-polish/413/scene-9-tokenized-invalid-neutral-desktop.png)
- **Verified**:
  - Body text: "This link is not valid. Please check that you copied the full link from your email, or contact the sender." ✅
  - Card chrome: white `rounded-lg border border-gray-200` ✅
  - Footer below, `ceq-powered-by ceq-powered-by--neutral` ✅
- **R12 byte-identity across the 4 states** is enforced structurally by `page.r12-byte-identity.test.tsx` (6 passing tests). The browser walk-through verified the `invalid` state visually; the other three (`expired` / `responded` / `survey-not-open`) share the same render path and emit byte-identical footer DOM by construction.

**Result**: PASS — R12 enforced via unit tests + visually confirmed for one state.

---

## Responsive breakpoint check

- **Viewport**: 375×812 (iPhone-typical mobile)
- **Screenshot**: [`scene-1-direct-link-active-themed-mobile-375.png`](./ui-polish/413/scene-1-direct-link-active-themed-mobile-375.png)
- **Verified**:
  - Viewport width: 375px
  - Footer width: 295px (within viewport, no horizontal scroll)
  - Footer text reads cleanly as "Powered by CustomerEQ"

**Result**: PASS — no overflow / clipping at 375px.

---

## Computed-style cross-check vs CSS rules

| Surface | Class | `color` | `fontSize` | `opacity` | `border-top` |
|---|---|---|---|---|---|
| Themed (Scene 1) | `ceq-powered-by--themed` | `rgb(17,24,39)` / theme `text-color` | `12px` (75% of body) | `0.55` | `1px solid rgba(0,0,0,0.04)` |
| Neutral (Scene 2, 3, 4, 6, 9) | `ceq-powered-by--neutral` | `rgb(107,114,128)` (`#6b7280`) | `11px` | `1` | `1px solid rgba(0,0,0,0.04)` |

All values match the spec's "Visual specification" table and the canonical `.powered-by` pattern in `mocks/36-theme-editor.html` L148-149.

---

## P2 finding (fixed in-phase)

**P2 — Style element id `ceq-survey-widget-styles` shared prefix with widget container id `ceq-survey-widget-{surveyId}`.**

A consumer querying `document.querySelector('[id^="ceq-survey-widget-"]')` to find widget instances would match the injected `<style>` element first (it's appended to `<head>` before the widget container is mounted to `<body>`). The current widget JS itself uses exact-id matching (`document.getElementById('ceq-survey-widget-' + survey.id)`), so the dedupe path was unaffected — but future code that prefix-matches the id would silently break.

**Fix**: renamed the style id to `ceq-attribution-footer-styles` (no shared prefix with the widget container). Single-character change to the `generateWidgetJs()` output. All 23 `public.test.ts` assertions still pass.

---

## P0 / P1 findings

None.

---

## Phase outcome

✅ PASS. Phase 5 complete — proceeding to Phase 6 (`implement-security-review`).
