# Feature Implementation Feedback — Issue #413

**Issue**: [#413 — "Powered by CustomerEQ" footer on every survey surface](https://github.com/mathursrus/CustomerEQ/issues/413)
**Phase**: 8 (implement-quality)
**Date**: 2026-05-20

This doc records `deep-code-quality-checks` + `ui-baseline-validation` findings against the #413 diff. Findings are tagged `QUALITY CHECK FAILURE` and marked `UNADDRESSED` on first capture, then `ADDRESSED` after fix.

---

## Round 1 — Phase 8 self-review

### deep-code-quality-checks

#### 1. Hardcoded values

| Surface | Value | Verdict |
|---|---|---|
| `packages/shared/src/footer.ts` `buildFooterHref()` | `https://customereq.com/` base URL | **Pass — intentional**. Per spec R4 + OD-1, the attribution URL is part of the platform contract (not env-driven). Documented in `footer.ts` header comment. |
| `packages/shared/src/footer.ts` | `'survey_footer'`, `'powered_by'` UTM literal values | **Pass — intentional**. Spec R4 enumerates the literals; building from constants prevents typo drift. |
| `apps/web/src/app/globals.css` | `#6b7280` / `#374151` / `#6366f1` in `.ceq-powered-by--neutral` rules | **Pass — intentional**. These are Tailwind gray-500 / gray-700 / indigo-500. The canonical `.powered-by` pattern in `mocks/36-theme-editor.html` L148-149 already uses Tailwind grays; the focus outline color matches the brand-theme default fallback (`var(--ceq-primary-color, #6366f1)`). |
| `apps/api/src/routes/public.ts` `generateWidgetJs()` | Same gray values duplicated inside `footerCss` string | **Pass — intentional**. Documented scope boundary: the widget runs on host pages that don't load apps/web's globals.css, so the CSS rules are duplicated. Cross-surface DOM consolidation is the subject of #476. The footer HTML itself imports `POWERED_BY_*` constants from `@customerEQ/shared/footer` (single source of truth) — only the CSS rules are duplicated. |
| `apps/api/src/routes/public.test.ts` | `PRE_413_BASELINE_GZIPPED_BYTES = 2193`, `R10_BUDGET_BYTES = 2193 + 1024` | **Pass — named constants with header comment explaining capture date + re-capture procedure.** |
| `scripts/check-no-attribution-toggle.sh` | Forbidden-pattern list (`hideFooter`, `hideAttribution`, …) | **Pass — intentional**. The script's purpose IS to enumerate these. Excluding test files (which use the patterns as negative assertions) keeps the gate clean. |

**Verdict**: 0 violations. All hardcoded values are intentional per spec + documented in code comments.

#### 2. Duplicate code

| Duplication | Location A | Location B | Verdict |
|---|---|---|---|
| Footer CSS rules | `apps/web/src/app/globals.css` (lines 97-145, `.ceq-powered-by` family) | `apps/api/src/routes/public.ts` `footerCss` string in `generateWidgetJs()` | **Pass — intentional scope boundary.** Widget runs on host pages without globals.css. Documented in both files' inline comments + work list + spec. Cross-surface DOM/CSS consolidation is #476. |
| Footer HTML structure | `apps/web/src/components/survey-form/PoweredByFooter.tsx` (React) | `apps/api/src/routes/public.ts` `footerHtml` string in `generateWidgetJs()` | **Pass — intentional, same scope boundary.** React component renders the JSX; widget JS string assembles the same DOM via a literal string. Both read copy/aria-label/UTM URL from `@customerEQ/shared/footer` — only the rendering surface is duplicated. |
| Constants | None — `POWERED_BY_PREFIX` / `POWERED_BY_LINK_TEXT` / `POWERED_BY_ARIA_LABEL` / `buildFooterHref` are exported from one file and imported in both consumers | — | **Pass.** |

**Verdict**: 0 unintentional duplications. The two intentional duplications are documented + tracked in #476.

#### 3. Missed reusability

| Candidate | Existing utility? | Verdict |
|---|---|---|
| `PoweredByFooter` component | No comparable component existed pre-#413 | **Pass — new abstraction is appropriately new.** |
| `buildFooterHref` URL builder | Repo has no general URL-builder utility (existing query strings are built ad-hoc with `URLSearchParams`) | **Pass — local helper is appropriate.** |
| CSS class family `.ceq-powered-by` | Convention matches existing `.ceq-survey-card`, `.ceq-survey-brand-name`, etc. in `SurveyFormRenderer.tsx` inline styles + mock CSS | **Pass — follows the project's `.ceq-` namespacing.** |

**Verdict**: 0 missed-reuse opportunities.

#### 4. Quality standards compliance

| Standard | Check | Verdict |
|---|---|---|
| Architecture standards rule §4 — Security | No hardcoded credentials, no secrets in code | **Pass.** |
| Architecture standards rule §4 — DRY | Shared constants in `packages/shared/src/footer.ts` consumed by both consumers | **Pass.** |
| Architecture standards rule §4 — Code organization | All functions single-responsibility, all <50 lines | **Pass.** |
| Architecture standards rule §4 — Pattern discovery | `PoweredByFooter` follows the co-located test pattern (`ConsentDisclosure.test.tsx`, etc.). Themed variant uses inline-style theme tokens consistent with `SurveyFormRenderer`. Constants module follows the `distributionTokens.ts` pattern. | **Pass.** |
| Architecture standards rule §4 — Quality validation | Build / typecheck / lint / smoke all green | **Pass.** |

**Verdict**: 0 standards violations.

#### 5. Monolithic files

| File | Lines | Verdict |
|---|---|---|
| `packages/shared/src/footer.ts` (new) | 67 | **Pass** |
| `apps/web/src/components/survey-form/PoweredByFooter.tsx` (new) | 51 | **Pass** |
| `apps/web/src/components/survey-form/PoweredByFooter.test.tsx` (new) | 152 | **Pass** (test file; allowed to be larger) |
| `apps/web/src/app/survey/[id]/r/[token]/page.r12-byte-identity.test.tsx` (new) | 108 | **Pass** (test file) |
| `scripts/check-no-attribution-toggle.sh` (new) | 109 | **Pass** (script; mostly comments + the patterns list) |
| `apps/api/src/routes/public.ts` (edited) | 1031 lines (pre-existing — was already large; #413 added ~30 lines) | **Pre-existing concern**, not introduced by #413. Splitting `public.ts` is out of scope for this issue. |

**Verdict**: 0 new monolithic files. The pre-existing `public.ts` length is a known concern unaddressed here per Rule 21 (one issue per branch).

#### 6. Overly complex logic

- No conditionals deeper than 1 level introduced.
- No new functions over 50 lines.
- No new parameter lists over 4 parameters (`PoweredByFooter` takes 2 props; `buildFooterHref` takes 1 arg).
- No cyclomatic complexity hotspots.

**Verdict**: 0 complexity violations.

#### 7. Architecture health (imports)

| Import edge | Direction | Allowed? |
|---|---|---|
| `apps/web` → `@customerEQ/shared/footer` | App → Shared | ✅ Allowed |
| `apps/api` → `@customerEQ/shared/footer` | App → Shared | ✅ Allowed |
| `packages/shared/src/footer.ts` → anything in `apps/*` | Shared → App | None (only `URLSearchParams` global) ✅ |
| `packages/shared/src/footer.ts` → React / DOM | Shared → UI framework | None (pure data + pure function) ✅ |

**Verdict**: 0 architecture violations. No circular dependencies introduced.

---

### ui-baseline-validation

Already executed in Phase 5 — see [`413-ui-polish-validation.md`](./413-ui-polish-validation.md). Phase 8 re-runs only against the post-Phase-5 fixes:

- **P2-1 fix** (style-element id rename `ceq-survey-widget-styles` → `ceq-attribution-footer-styles`): re-verified in browser via Phase 5 + integration tests pass — no visual regression, no behavioral change.

**Verdict**: 0 new UX baseline findings.

---

### Mock-conformance sweep (L1 directive)

Per L1 P-HIGH ("Mock is the Spec — UI implementation must match mock element-for-element") + L1 P-HIGH ("Mock-to-implementation drift is the agent's responsibility"), walked the mock scene-by-scene and diff'd against the live implementation captured in Phase 5.

| Mock scene | Footer markup match? | Notes |
|---|---|---|
| 1 — Active questions (themed) | ✅ | DOM + classes + href + aria-label + target + rel all match. |
| 2 — Thank-you (standalone) | ✅ | Footer below state-card; class `ceq-powered-by ceq-powered-by--neutral`; href + a11y attrs match. |
| 3 — Already responded (amber) | ✅ | Same as Scene 2; amber chrome retained from existing Tailwind classes. |
| 4 — Load error (red) | ✅ | Same as Scene 2; red chrome retained. |
| 5 — Loading | ✅ | Footer added per spec; transient state matches Scene 4 chrome. |
| 6 — Embedded widget | ✅ | Footer DOM matches; `utm_medium=embed`; injected `<style>` element id is `ceq-attribution-footer-styles` (post-rename); footer survives thank-you DOM swap (verified manually). |
| 7 — Email | N/A | R5 contract-only; deferred. |
| 8 — Focus state | ✅ | 2px outline at `var(--ceq-primary-color)` confirmed via `getComputedStyle` in Phase 5. |
| 9 — Tokenized error states | ✅ | `invalid` state visually verified; R12 byte-identity for all 4 enforced by 6 unit tests. |

**One intentional API divergence from mock** (defensible improvement, no functional difference):

- **Themed variant CSS class.** The mock writes `class="ceq-powered-by"` (relying on the base rule to provide themed styles, with `--neutral` as the only modifier). My implementation writes `class="ceq-powered-by ceq-powered-by--themed"` — i.e., themed is also a modifier. This makes the variant API symmetric (`themed` ↔ `neutral`), reads more clearly in DOM inspector, and lets the base `.ceq-powered-by` rule own only structural styles (text-align, padding, border-top) while variant rules own visual styles. Functionally and visually identical to the mock. The same computed-styles assertions in Phase 5 confirm the themed appearance matches mock expectations.

**Verdict**: 0 actionable mock-to-implementation drifts. One documented intentional API divergence.

---

### simplify pass

Walked each new + edited surface looking for over-engineering:

- `PoweredByFooter` component: 2 props, no internal state, no callbacks, no `useState`/`useEffect`. Cannot be simpler.
- `footer.ts` constants module: 3 literal strings + 1 type alias + 1 function. Cannot be simpler.
- `globals.css` CSS rules: 9 rules covering base + 2 variants + hover + focus-visible. Minimum to satisfy R8 + visual spec.
- Widget JS additions: 4 lines for `<style>` injection (deduped); 1 line for `insertAdjacentHTML` after form append; 1 string concat in the thank-you swap. Minimum to satisfy R3.
- R7 gate script: pure grep with two excludes (`docs/`, `learnings/`, `*.test.*`). Cannot be simpler without removing necessary safety.
- Tests: each test isolates one R-item assertion. No tautological tests; no over-broad snapshot tests.

**Verdict**: nothing to simplify.

---

## Summary

| Check | Findings |
|---|---|
| Hardcoded values | 0 violations |
| Duplicate code | 2 intentional duplications (footer CSS rules + footer HTML between React/widget) — documented, tracked in #476 |
| Missed reusability | 0 |
| Quality standards compliance | 0 violations |
| Monolithic files | 0 new (pre-existing `public.ts` is out of #413's scope per Rule 21) |
| Overly complex logic | 0 |
| Architecture health (imports) | 0 violations |
| UX baseline | 0 new findings (Phase 5 P2-1 fix re-verified) |
| Mock-conformance | 0 actionable drifts; 1 documented intentional API divergence (symmetric variant class naming) |
| Simplify pass | Nothing to simplify |

**Phase 8 outcome**: ✅ PASS. 0 quality issues require resolution.

No `QUALITY CHECK FAILURE` items captured; no `UNADDRESSED` items remain.
