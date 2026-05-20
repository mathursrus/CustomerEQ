# Implementation Work List — Issue #413

**Issue type**: feature
**Spec**: [`docs/feature-specs/413-survey-footer.md`](../feature-specs/413-survey-footer.md)
**Mock**: [`docs/feature-specs/mocks/413-survey-footer.html`](../feature-specs/mocks/413-survey-footer.html)
**Branch**: `feature/413-every-survey-should-have-a-footer`
**Status**: implement-scoping complete; durable working memory for the remaining 11 phases

---

## Scope

Add a "Powered by CustomerEQ" footer to every survey-bearing surface, with a themed variant inside the `SurveyFormRenderer` card and a neutral variant on state-cards / widget JS / email contract. Mock is the spec.

**In scope (per spec R1–R12)**
- Themed footer inside `SurveyFormRenderer` (Scene 1) — direct-link active + tokenized active + editor preview (R9 preview/live parity)
- Neutral footer on `survey/[id]/page.tsx` state-cards (Scenes 2/3/4/5)
- Neutral footer on `survey/[id]/r/[token]/page.tsx` state-cards (Scene 9 — 4 token-error states + loading + post-submit)
- Neutral footer in `generateWidgetJs()` — AFTER form append AND inside the thank-you `container.innerHTML` swap (Scene 6, R3)
- Email contract only (Scene 7, R5) — no template build now; the footer markup is documented in the spec and rides whenever the email-template renderer ships
- No-toggle gate script (R7)
- UTM contract (R4) — `utm_source=survey_footer`, `utm_medium∈{link,embed,email}`, `utm_campaign=powered_by`
- A11y: `aria-label`, `target="_blank"`, `rel="noopener noreferrer"`, focus-visible outline (R8)

**Out of scope — deferred to other issues (DO NOT TOUCH IN THIS PR)**
- **Sharing footer markup between React and widget JS** → #476. The widget JS string gets a duplicated copy of the neutral footer HTML; do not extract a shared helper, do not import React into the widget JS, do not pre-build a `SurveyStateCard` component. Per L1 *Tight PR scope*.
- **Consolidating post-submit / already-responded chrome** → #476. The mock shows the canonical h2+p treatment (Scene 2 / Scene 3 / Scene 9 responded), but #413's implementation only ADDS the footer below the existing call sites' chrome. Scene 9 responded will keep its current single-`<p>` chrome in this PR; the h2 addition is #476's job. Mock-vs-implementation drift on this point is intentional and is documented in the mock's top note and Scene 9's note.
- **Theming the state-cards** → existing "theme the page state-cards" deferred follow-up. State-cards keep their current Tailwind utility chrome (`bg-white`, `bg-amber-50`, `bg-red-50`); the footer is the neutral variant under them.
- **Theming the widget JS** → existing "theme the widget JS" deferred follow-up. Widget JS keeps its hardcoded colors; the footer uses the neutral palette.
- **Email template renderer** → existing "email template renderer + footer" deferred follow-up. R5 is contract-only.
- **i18n of footer copy** → existing "i18n for footer copy" deferred follow-up. English only ships.

---

## Complexity check (per implementation-planning-and-scope-slicing skill)

~12 file modifications expected (see checklist below). **Under the 15-file threshold** — no phase splitting needed.

---

## Checklist

### Constants + tokens (1 new shared file)

- [ ] **NEW** `apps/web/src/components/survey-form/footer-tokens.ts` — single source of truth for footer link copy, accessible name, UTM params, and rel/target attributes. Both the React `PoweredByFooter` and the widget JS string helper read from this (the widget reads it at build time of the JS string in `generateWidgetJs()`, not at runtime). Prevents drift across the React and widget surfaces within this PR.
  - Exports: `POWERED_BY_PREFIX = 'Powered by '`, `POWERED_BY_LINK_TEXT = 'CustomerEQ'`, `POWERED_BY_ARIA_LABEL = 'Powered by CustomerEQ — opens customereq.com in a new tab'`, `buildFooterHref(medium: 'link'|'embed'|'email'): string` (returns URL with UTM params per R4).
  - **Note on scope boundary with #476**: this file does not pre-build a shared HTML/JSX renderer; it only exports primitive copy + a URL-builder. #476 can later layer a shared HTML-string helper on top.

### Themed footer — React component (1 new + 1 new test)

- [ ] **NEW** `apps/web/src/components/survey-form/PoweredByFooter.tsx` — React component with `variant: 'themed' | 'neutral'` prop and `channel: 'link' | 'embed' | 'email'` prop (`channel` chooses the UTM `medium`).
  - Themed variant: uses `--ceq-text-color` at 0.55 opacity (prefix) and 0.85 opacity (anchor); font-size `calc(var(--ceq-body-size, 16px) * 0.75)`; `border-top: 1px solid rgba(0,0,0,0.04)`; per mock CSS L90-117.
  - Neutral variant: `#6b7280` prefix / `#374151` anchor; `font-size: 11px`; system-ui font-stack; per mock CSS L122-135.
  - Both: `text-align: center`, `padding: 12px 16px`, `data-survey-footer` attribute, focus-visible 2px outline per WCAG 2.4.7.
- [ ] **NEW** `apps/web/src/components/survey-form/PoweredByFooter.test.tsx` — unit tests for variant rendering, UTM contract, a11y attributes, no-PII assertion on the href, focus-visible behavior. Co-located per existing pattern (`ConsentDisclosure.test.tsx`).

### Themed footer — wire into SurveyFormRenderer (1 edit + 1 edit)

- [ ] **EDIT** `apps/web/src/components/survey-form/SurveyFormRenderer.tsx` — add `<PoweredByFooter variant="themed" channel="link" />` after `</form>` (L212) and before the closing `</div>` of `ceq-survey-card` (L213). Mock Scene 1 anchors this position. Non-toggleable (no chrome-matrix gate per R7).
- [ ] **EDIT** `apps/web/src/components/survey-form/SurveyFormRenderer.test.tsx` — assert footer is rendered for both preview and live modes (R9 parity), is non-toggleable (chrome-matrix has no `footer` field), and inherits theme tokens via the parent card's CSS var context.

### Neutral footer — standalone respondent page (1 edit)

- [ ] **EDIT** `apps/web/src/app/survey/[id]/page.tsx` — add `<PoweredByFooter variant="neutral" channel="link" />` inside the 4 state-card branches (loading L122-128, load-error L130-138, duplicate L140-151, submitted L153-166). Footer sits inside the card, below the message text. Do NOT modify the state-card chrome itself; do NOT add an h2 to any branch that lacks one (the canonical h2+p consolidation is #476's job).

### Neutral footer — tokenized respondent page (1 edit)

- [ ] **EDIT** `apps/web/src/app/survey/[id]/r/[token]/page.tsx` — add `<PoweredByFooter variant="neutral" channel="link" />` inside:
  - the loading branch L127-132 (no card chrome; wrap in the same `rounded-lg border bg-white p-8 text-center` or attach below the loading text per Scene 5)
  - the 4 token-error states L135-143 (single shared card; footer goes inside, below `<p>{ERROR_COPY[tokenState]}</p>`)
  - the submitted branch L145-165 (below the thank-you `<p>` and the optional Continue link)
  - the load-failure branch L167-173
- [ ] **R12 invariant**: the footer DOM/bytes MUST be identical across the four token-error states (`expired` / `responded` / `invalid` / `survey-not-open`). Since the four states share one render path (`<p>{ERROR_COPY[tokenState]}</p>` → footer below), this is structurally satisfied — but it MUST be locked down with a unit/snapshot test (see Tests section below). This test is non-negotiable per the user's enforcement directive.

### Neutral footer — widget JS (1 edit)

- [ ] **EDIT** `apps/api/src/routes/public.ts` `generateWidgetJs()` (~L811-953) — add neutral footer HTML in TWO places (R3):
  - Inside the `ceq-survey-widget-{id}` container, AFTER `form` is appended (~L893) — so the active widget shows the footer.
  - Inside the thank-you `container.innerHTML = '<div>…✓…Thank you!…</div>'` replacement (~L950) — so the footer survives the post-submit DOM swap. Append the neutral footer HTML string to the innerHTML being assigned.
- [ ] The widget reads copy/href from `footer-tokens.ts` at API-server-process startup (import once at the top of `public.ts`, inline the values into the generated JS string via template literal — same shape as the rest of `generateWidgetJs()`). UTM medium = `embed`.
- [ ] **Scope-boundary callout** (per user directive + #476): the widget JS keeps a duplicated copy of the footer HTML. Do not extract a shared `renderFooterHtml()` helper into a package consumed by both React and widget. This duplication is intentional and is the subject of #476.

### Email contract (R5) — no implementation, spec-only

- [ ] **N/A — contract only.** Confirm the spec's R5 narrative + Scene 7 in the mock describe the email footer markup. No code change in this PR. Add a single-line N/A note in the implementation evidence doc with a forward-pointer to the "email template renderer + footer" deferred follow-up.

### No-toggle gate (R7) — new script

- [ ] **NEW** `scripts/check-no-attribution-toggle.sh` — bash script that greps the repo for `hideFooter`, `hideAttribution`, `showPoweredBy`, `disableFooter`, `attributionEnabled` (and similar toggle-shaped identifiers) and exits non-zero if any are found outside this script itself and `docs/`. R7 enforcement.
- [ ] Wire the script into root `package.json` as `"check:no-attribution-toggle"` and add it to a CI gate that runs on every PR. Smoke test suite is the right home (it runs on every PR per Rule 11).

### Tests (Phase 3 will own — listed here for scoping)

- [ ] `PoweredByFooter.test.tsx` — variant rendering, UTM contract, a11y, no-PII in href.
- [ ] `SurveyFormRenderer.test.tsx` — footer present in preview AND live (R9); no chrome-matrix gate (R7).
- [ ] **R12 byte-identity snapshot** — new test file under `apps/web/src/app/survey/[id]/r/[token]/` (e.g., `page.r12-byte-identity.test.tsx`) that renders the page in each of the 4 token-error states, queries the footer subtree via `[data-survey-footer]`, and asserts `outerHTML` is byte-identical across all four. **This is the user-mandated enforcement test for the timing-attack invariant.**
- [ ] `survey/[id]/page.test.tsx` (or extend existing) — footer present in each of the 4 state-card branches.
- [ ] `apps/api/test/integration/public-survey.test.ts` — extend with:
  - assertion that `generateWidgetJs()` output contains the footer HTML in BOTH the active and thank-you paths
  - widget bundle size delta vs pre-#413 baseline ≤1 KB gzipped (R10) — capture pre-#413 size now as a constant in the test
- [ ] New E2E `apps/web/test/e2e/413-footer-presence.spec.ts` — Playwright walks each surface in a real browser and asserts the footer is visible + the link has the right href + opens in a new tab.
- [ ] Script test — invoke `scripts/check-no-attribution-toggle.sh` as part of `pnpm test:smoke` (or wire into a `pnpm check:no-attribution-toggle` package.json script and add to the smoke npm-script chain).

---

## Validation Requirements

| Requirement | Required? | Reason | Evidence target |
|---|---|---|---|
| `uiValidationRequired` | **Yes** | Every R-item is UI-facing | [`docs/evidence/413-ui-polish-validation.md`](./413-ui-polish-validation.md) (to be authored in Phase 5) |
| `mobileValidationRequired` | **No** | Spec doesn't enumerate mobile-emulator-only requirements; responsive checks at mobile breakpoint via browser DevTools cover the mock | — |
| Browser baseline | Chromium (Playwright default) + Firefox + WebKit (Playwright suite) | Matches existing `apps/web/test/e2e/` test runs | E2E run output |
| Target breakpoints | Desktop (1280px) + tablet (768px) + mobile (375px) for responsive sanity | The footer must read at all three; the themed variant scales font-size off `--ceq-body-size`, the neutral variant is a fixed 11px | Playwright screenshots at each breakpoint |
| Browser screen-reader check | NVDA or VoiceOver on the focused anchor — accessible name matches `aria-label` | WCAG 2.4.7 + a11y R-item | Manual check note in evidence doc |
| Build / typecheck / lint / smoke (Rule 11) | All four must pass before submit | Project gate | Command output in evidence doc |
| `pnpm test:smoke` (unit tests) | Must pass on every PR | Project Rule 11 | CI output |
| `pnpm test:integration` (API tests against real DB) | Must pass for the `public-survey.test.ts` additions | Real-DB assertion for widget bundle + footer presence | Local run output (DB must be up — Docker compose) |
| `pnpm test:e2e` (Playwright) | Must pass with dev server up | Real browser walk of the 9 mock scenes | E2E artifact + screenshots |
| BAML evals | **N/A** | This issue has no LLM-bearing code | — |
| R12 byte-identity assertion | **Yes (user-mandated)** | Footer bytes identical across the 4 tokenized error states — prevents timing-attack state leak | Snapshot test + screenshot in evidence doc |
| No-toggle gate (R7) | **Yes** | Project-level invariant: no future PR may add an attribution-suppression flag | `scripts/check-no-attribution-toggle.sh` in CI |
| Widget bundle size delta ≤1 KB gzipped (R10) | **Yes** | The widget is served to host sites; bloat hits every page that embeds | Integration-test assertion + size comparison in evidence doc |
| Mock-conformance sweep | **Yes — Phase-11 submit gate** | Per L1 (Mock-to-implementation drift is the agent's responsibility; Mock is the Spec) — walk every visible element in `docs/feature-specs/mocks/413-survey-footer.html` before declaring ready | Diff notes in evidence doc |

---

## Open Decisions / In-Flight Questions

| # | Question | Default | Resolved? |
|---|---|---|---|
| OD-A | Where does `footer-tokens.ts` live: `apps/web/src/components/survey-form/` (co-located, web-only) or `packages/shared/src/`? | Co-located in `apps/web/src/components/survey-form/`. The constants are tiny + web-and-API-only, and the widget JS imports them via the API server bundle (which can resolve into `apps/web/`-adjacent files — but actually NO, `apps/api` cannot import from `apps/web`). **Revised default**: put the constants in `packages/shared/src/footer.ts` so both `apps/web` (React) and `apps/api` (widget JS string) can import without a cross-app dependency. Avoid the bundle-bloat concern by exporting only literal strings + a tiny URL builder (no React, no DOM). | Pending — confirm at top of Phase 4 before writing the new file |
| OD-B | Should the `<PoweredByFooter>` component live in `packages/ui/` (shared) or `apps/web/src/components/survey-form/` (co-located with the other survey-form components)? | Co-located in `apps/web/src/components/survey-form/` — matches the location of `SurveyFormRenderer`, `ConsentDisclosure`, etc. `packages/ui` today only exports the `cn()` utility per architecture doc §3.6; promoting components there is a separate refactor. | Resolved |
| OD-C | Snapshot test for the R12 byte-identity assertion — what's the right unit-test shape? | Vitest + `@testing-library/react` `render()` for each of the 4 token states in turn, query `container.querySelector('[data-survey-footer]')`, then `expect(footer1.outerHTML).toEqual(footer2.outerHTML)` for all pairs. Don't use snapshot files — inline assertion is more diff-readable. | Resolved |
| OD-D | Widget bundle size baseline — what's the current size of `generateWidgetJs()` output? | Capture in Phase 3 (implement-tests) by running the existing widget endpoint in an integration test, gzipping the response, and recording the size. Bake the baseline as a constant in the test file with a comment ("Baseline captured 2026-05-20 pre-#413"). The R10 budget is +1 KB gzipped from this baseline. | **Resolved (Phase 3)**: 2193 bytes gzipped against the existing fixture survey (1 NPS question, `TestBrand` brand). R10 budget = 2193 + 1024 = **3217 bytes** for the post-#413 widget. Test: `apps/api/src/routes/public.test.ts` describe `'Issue #413 — widget footer'` > `'R10 — widget gzipped size stays within baseline + 1 KB budget'`. |
| OD-E | Email footer markup — what HTML/CSS shape does R5 commit to, even though no email is rendered now? | The spec's "Surface-by-surface coverage" table + Scene 7 in the mock already define the email-safe inline-styled neutral footer markup. R5 is satisfied by the spec; no code lands in this PR. Add the N/A note in evidence doc and move on. | Resolved |

---

## Quality requirements derived from codebase-pattern-discovery

- **Test co-location**: Component tests live next to the component (`Foo.test.tsx` next to `Foo.tsx`). Matches `ConsentDisclosure.test.tsx`, `SurveyFormRenderer.test.tsx`, `useSurveyResponseForm.test.ts`.
- **Inline-styled survey-form components**: The survey-form family uses inline `style={{}}` with CSS-variable references (`var(--ceq-*)`) rather than Tailwind utility classes. `PoweredByFooter` (themed variant) MUST follow this pattern — Tailwind classes there would not pick up the theme tokens. Reference: `SurveyFormRenderer.tsx` L80-214.
- **State-card chrome (Tailwind)**: State-cards on `survey/[id]/page.tsx` and `r/[token]/page.tsx` use Tailwind utility classes (`bg-white`, `bg-amber-50`, `rounded-lg`, `border`). `PoweredByFooter` (neutral variant) sits INSIDE these cards but should use plain `style={{}}` with hardcoded gray hex values per Scene 2/3/4/5/9 mock CSS — do NOT introduce Tailwind classes that would need new globals.css entries.
- **No new utility libraries**: All work uses standard React + `@testing-library/react` + Vitest + Playwright. No new dependencies. The widget JS continues to be a hand-rolled string in `generateWidgetJs()`.
- **No environment variables**: This feature has no runtime config. The UTM URL is a hardcoded string constant per the spec's R4 + immutability stance; do not introduce a `POWERED_BY_URL` env var.
- **Architecture (no new layers / no ADR)**: This feature stays within the existing Presentation layer (apps/web) + API layer (apps/api widget JS) + Email contract (apps/worker — N/A this PR). No new package, no new architectural pattern. Phase 10 (`implement-architecture-update`) will mark N/A.

---

## Sequencing for Phase 4 (implement-code)

Per principle "Prototype-First" + "Orchestration":

1. Land OD-A decision (constants file location) before any code.
2. Create `packages/shared/src/footer.ts` (or revised location) with copy + URL builder.
3. Create `PoweredByFooter.tsx` (themed + neutral variants) — fill in the test bodies in the Phase-3-authored `PoweredByFooter.test.tsx`.
4. Wire into `SurveyFormRenderer.tsx` — themed footer. Visually verify in editor preview.
5. Wire into `survey/[id]/page.tsx` 4 branches — neutral footer.
6. Wire into `survey/[id]/r/[token]/page.tsx` 4+ branches — neutral footer + fill in the test bodies in the Phase-3-authored `page.r12-byte-identity.test.tsx`.
7. Wire into `generateWidgetJs()` — neutral footer in active + thank-you paths. Fill in the 6 `it.todo` bodies in `public.test.ts` (footer presence in both paths + UTM + R7 + R8). Re-run the R10 baseline test and confirm new gzipped size ≤ 3217 bytes.
8. Add `pnpm check:no-attribution-toggle` to the smoke runner (`scripts/test-suite-runner.mjs` `smokeSuites` — script + grep gate already live in Phase 3).
9. Browser-verify every Scene from the mock (per L1 mock-conformance sweep).
10. Phase 5 onward.

---

## Phase 3 outcomes (implement-tests, completed 2026-05-20)

| Artifact | Path | Status |
|---|---|---|
| R7 no-toggle gate script | `scripts/check-no-attribution-toggle.sh` | **Live + passing.** Wrapped via `pnpm check:no-attribution-toggle`. Greps clean against current repo. |
| Widget bundle baseline + R10 test + footer-presence todos | `apps/api/src/routes/public.test.ts` (describe `'Issue #413 — widget footer'`) | **Live + passing.** Baseline = 2193 bytes gzipped; budget = 3217 bytes. 1 passing + 6 todo. |
| `<PoweredByFooter>` unit test scaffold | `apps/web/src/components/survey-form/PoweredByFooter.test.tsx` | **Live (24 todos).** Test strategy declared via `describe + it.todo`. Phase 4 fills in bodies. |
| R12 byte-identity test scaffold | `apps/web/src/app/survey/[id]/r/[token]/page.r12-byte-identity.test.tsx` | **Live (6 todos).** Enforces the user-mandated timing-attack invariant; Phase 4 fills in bodies. |
| `pnpm check:no-attribution-toggle` script in root `package.json` | `package.json` | **Live.** Standalone command; CI wiring deferred to Phase 4 step 8 above. |

Typecheck: `pnpm --filter @customerEQ/api typecheck` ✓ ; `pnpm --filter @customerEQ/web typecheck` ✓.

The Phase 3 commit captures all five artifacts together so Phase 4 starts with a known-good test bed.

---

## Cross-references

- **Spec**: `docs/feature-specs/413-survey-footer.md`
- **Mock (canonical, post-#476 forward-looking on Scene 9 responded)**: `docs/feature-specs/mocks/413-survey-footer.html`
- **Spec-evidence doc** (Phase 1-5 of feature-specification): `docs/evidence/413-spec-evidence.md`
- **Forward-pointer for chrome consolidation**: [#476](https://github.com/mathursrus/CustomerEQ/issues/476) — out of scope here.
- **Canonical `.powered-by` CSS pattern**: `docs/feature-specs/mocks/36-theme-editor.html` L148-149.
- **Sister-spec for tokenized route surfaces**: `docs/feature-specs/378-personalized-survey-links-byo-email.md` (NFR-S5 timing-attack invariant — R12 derives from this).
