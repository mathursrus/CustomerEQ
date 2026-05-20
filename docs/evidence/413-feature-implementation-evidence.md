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
| 6 — `implement-security-review` | ✅ Complete | `87b068a`* | Security Review section below |
| 7 — `implement-regression` | ✅ Complete | this commit | Regression Test Run section below |

\* Commit SHAs above re-numbered after the in-Phase-7 rebase onto current `origin/main` (the branch picked up 8 upstream commits since the original branch point — including PR #428 "BAML evals out of smoke" + PR #429 "demo-storefront out of smoke" + PR #420 "Azure Communication Services email delivery", all of which my smoke run depends on). Original pre-rebase SHAs: 1469205 / dc74e92 / 7264d79 / 9af65ba / 40b54fb. New SHAs visible via `git log`.
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

## Security Review

### Executive Summary

- **Total findings**: 0 Critical, 0 High, 0 Medium, 1 Low (Informational).
- **Immediate escalations**: None.
- **Disposition**: 1 informational note accepted (documented threat-model boundary with #476).
- **Highest-priority next action**: proceed to `implement-regression`.

### Review Scope

- **Review type**: embedded-diff-review (per FRAIM Phase 6 spec).
- **Review scope**: `diff` (this branch's added commits since branching from `main`).
- **Target**: `feature/413-every-survey-should-have-a-footer` commits `7264d79` (Phase 4 impl) + `9af65ba` (Phase 5 style-id rename). Phase 1 + Phase 3 + Phase 5 evidence commits are docs-only.
- **Surface area paths reviewed**:
  - `packages/shared/src/footer.ts` (new — 67 lines, primitives + URL builder)
  - `apps/web/src/components/survey-form/PoweredByFooter.tsx` (new — 51 lines, React component)
  - `apps/web/src/components/survey-form/SurveyFormRenderer.tsx` (added import + 1 JSX line)
  - `apps/web/src/app/survey/[id]/page.tsx` (added footer to 4 state-card branches)
  - `apps/web/src/app/survey/[id]/r/[token]/page.tsx` (added footer to 5 branches)
  - `apps/api/src/routes/public.ts` (added 4 imports + footer CSS string + footer HTML string + 2 widget-JS insertion sites + 1 style-injection block; renamed style id in Phase 5)
  - `apps/web/src/app/globals.css` (added 9 CSS rules for `.ceq-powered-by` class family)
  - `scripts/check-no-attribution-toggle.sh` (new — R7 grep gate)
  - `scripts/test-suite-runner.mjs` (wired the R7 gate as first smoke step)

### Threat Surface Summary

| Surface | Evidence |
|---|---|
| `web` | `apps/web/src/**/*.tsx`, `apps/web/src/app/globals.css` — React components + global stylesheet |
| `api` | `apps/api/src/routes/public.ts` — Fastify-routed endpoint that generates the widget JS string |
| `llm-app` | None — no LLM imports |
| `data-pipeline` | None |
| `mobile` | None |
| `capability-authoring` | None — no skill/job/rule files touched |
| `docs-only` | N/A (non-docs files present) |

### Coverage Matrix

| Scan | Surface | Result |
|---|---|---|
| `owasp-top-10-web-review` | `web` | Pass |
| `owasp-api-top-10-review` | `api` | Pass |
| `secrets-in-code-check` | both | Pass (no secrets, tokens, or env-derived URLs introduced) |
| `privacy-and-pii-review` | both | Pass (R4 + GDPR Art.5 §1(c) enforced by tests) |
| `compliance-control-mapping-security` | both | See "Compliance Control Mapping" below |

### Findings

**SEC-413-LOW-1 (Informational)** — `apps/api/src/routes/public.ts` `generateWidgetJs()` lines 996-1001 + 1025

- **Severity**: Low / Informational.
- **OWASP**: A03 (Injection) — informational only; no actual injection vector present.
- **Summary**: The widget JS string concatenates a hardcoded footer HTML string into the existing `container.innerHTML = '<div>…thank-you…</div>'` swap and uses `container.insertAdjacentHTML('beforeend', ...)` for the form-append path. These DOM-mutation APIs would be a Critical injection vector if any user-controlled data flowed into the string — they do not. The footer HTML is assembled at server-process startup time from literal constants (`POWERED_BY_PREFIX`, `POWERED_BY_LINK_TEXT`, `POWERED_BY_ARIA_LABEL`, `buildFooterHref('embed')`) defined in `packages/shared/src/footer.ts`. No respondent input, survey content, or brand data reaches the footer string.
- **Existing XSS protection**: The pre-existing `surveyJson` injection (lines 825-830) already escapes `<`, `>`, `&`, `'`, U+2028, U+2029 before interpolation. My addition uses a separate static string that doesn't go through that path because it has no dynamic content to escape.
- **Defense-in-depth**: The structural concatenation pattern in the thank-you swap is locked by the unit test `expect(js).toMatch(/Your feedback has been recorded\.<\/p><\/div>'\s*\+\s*'<p class="ceq-powered-by/)` so future PRs can't accidentally interpolate user data into this position.
- **Disposition**: `accept`. Rationale: no exploitable surface; the static-string property is preserved by the test.

### Prioritized Remediation Queue

None. No actionable findings.

### Verification Evidence

| R-item | Surface | Test | Result |
|---|---|---|---|
| R4 — UTM contract / no PII in href | `packages/shared/src/footer.ts` `buildFooterHref()` | `PoweredByFooter.test.tsx` "UTM contract (R4)" (7 sub-tests, including "href contains exactly the three UTM params and nothing else (no respondent fingerprint)") | Pass |
| R4 — widget href / no respondent data | `apps/api/src/routes/public.ts` widget JS | `public.test.ts` "R4 — footer link href contains no respondent-specific data" (parses href, asserts exactly 3 UTM keys, defense-in-depth checks for `email`/`memberid`/`brandid` substrings) | Pass |
| R7 — no toggle in source tree | repo-wide grep | `scripts/check-no-attribution-toggle.sh` (run as smoke pre-step in `scripts/test-suite-runner.mjs`) | Pass |
| R7 — no toggle in generated widget JS | `apps/api/src/routes/public.ts` | `public.test.ts` "R7 — widget JS contains no toggle-shaped identifier" (regex over generated string) | Pass |
| R8 — `target="_blank"` + `rel="noopener noreferrer"` | All surfaces | `PoweredByFooter.test.tsx` "sets target=\"_blank\" + rel=\"noopener noreferrer\"" + `public.test.ts` R8 widget assertion | Pass |
| R12 — byte-identical footer across 4 tokenized error states | `apps/web/src/app/survey/[id]/r/[token]/page.tsx` | `page.r12-byte-identity.test.tsx` (6 assertions, user-mandated) | Pass |
| GDPR Art.5 §1(c) data minimisation | `buildFooterHref()` | `PoweredByFooter.test.tsx` "utm_source is always the literal 'survey_footer' (no surveyId / brandId / identifier)" | Pass |
| WCAG 2.4.7 focus indicator | `globals.css` `:focus-visible` rules | `[413-ui-polish-validation.md](./413-ui-polish-validation.md)` Scene 8 — live browser confirmed 2px outline at theme primary color | Pass |

### Applied Fixes and Filed Work Items

None applied this phase (no actionable findings). #476 (shared SurveyStateCard component) was filed before this issue's implementation began — see "Accepted / Deferred / Blocked" below.

### Accepted / Deferred / Blocked

| Item | State | Rationale |
|---|---|---|
| Widget JS keeps duplicated footer HTML (not extracted to shared renderer) | Accepted | Intentional scope discipline. Cross-surface DOM consolidation is filed as [#476](https://github.com/mathursrus/CustomerEQ/issues/476). Duplicating ~5 lines of static HTML now does not introduce a security risk; consolidating it would expand the diff and tangle two issues per Rule 21. |
| Email surface — footer markup is contract-only (no template renderer ships here) | Deferred | R5 per spec; email template renderer is a separate deferred follow-up. No security implication today (no email rendering code path is added or modified). |
| Brand-level paid-tier attribution toggle | Deferred | Documented in `Deferred follow-ups` in the spec; would require its own design + RFC + issue. The R7 gate enforces that no such toggle slips in before the deliberate paid-tier work. |

### Compliance Control Mapping

| Regulation / Control | How #413 satisfies it |
|---|---|
| **GDPR Art.5 §1(c) — data minimisation** | The footer href carries exactly three UTM parameters with literal values. No respondent identifier (email, surveyId, brandId, memberId) is appended. Enforced by `PoweredByFooter.test.tsx` UTM-contract suite (7 assertions) + `public.test.ts` widget no-PII assertion. |
| **GDPR Recital 47 — legitimate interest** | Attribution-only footer pointing to the platform's home page is the long-established viral-channel pattern (cf. Mailchimp, Typeform, SurveyMonkey). Does not process additional PII; uses no cookies; does not require respondent consent under the legitimate-interest basis. |
| **CCPA §1798.135 — opt-out signal** | The footer does not collect, sell, or share consumer personal information. Not subject to the opt-out requirement. |
| **SOC2 CC6.1 — logical access** | No change to access controls. The footer is a static, non-interactive surface that does not introduce a new authentication boundary. |
| **WCAG 2.1 AA — 2.4.7 focus visible** | `:focus-visible` rule in `globals.css` paints a 2px outline at `var(--ceq-primary-color, #6366f1)` with 2px offset; visually verified in `413-ui-polish-validation.md` Scene 8. |
| **WCAG 2.1 AA — 1.4.3 contrast** | Themed text uses `var(--ceq-text-color)` at 0.55 opacity for prefix and 0.85 for anchor; against the typical theme background (`#ffffff` or near-white), the contrast at 0.85 opacity meets AA for body text. Themes that override `--ceq-text-color` to a low-contrast value are flagged by the editor's contrast check (separate concern). Neutral variant uses `#6b7280` on white (4.66:1) and `#374151` on white (10.6:1) — both pass AA. |

### Run Metadata

- **Run date**: 2026-05-20
- **Commit at review time**: `9af65ba`
- **Skills loaded**: `threat-surface-classification`, `owasp-top-10-web-review` (heuristic walk, no scanner run), `owasp-api-top-10-review` (heuristic walk), `secrets-in-code-check`, `privacy-and-pii-review`, `finding-disposition`, `security-review-results-structure`
- **Auto-fix cap**: 10 (not hit — 0 auto-fixes applied)
- **Auth/crypto firewall triggered**: No (no auth/crypto files touched)
- **Notes**: Diff is small (4 production files modified + 2 new files + 1 new script + 1 stylesheet append) and contains no dynamic data flow into DOM-mutation APIs. Manual review sufficient; no scanner runs gated on this phase.

---

## Regression Test Run

`pnpm test:smoke` against the post-rebase branch — full smoke chain green.

### Run command + result

```
$ DATABASE_URL="postgresql://customerEQ:customerEQ@localhost:5432/customerEQ" pnpm test:smoke
```

- Exit code: 0
- Suites run: 12 (in declared order — R7 gate + 12 unit/integration/e2e suites)
- Individual `✓` checkmarks across all suites: 126
- `FAIL` lines: 0

### Suite-by-suite

| # | Suite | Type | Result |
|---|---|---|---|
| pre | `check R7: no attribution-toggle identifier in source tree` | repo-wide grep gate | ✅ OK |
| 1 | `api-unit` (healthz) | vitest unit | ✅ 3 passed |
| 2 | `api-integration` (public-survey + widget) | vitest integration vs real Postgres | ✅ (includes all 7 new #413 widget-footer assertions + R10 budget) |
| 3 | `web-unit` (SurveyFormRenderer) | vitest unit | ✅ 21 passed (17 pre-#413 + 4 new #413 footer assertions) |
| 4 | `web-e2e` (demo-request) | Playwright (Chromium) | ✅ 3 passed (29s) |
| 5 | `worker-unit` (loyaltyEvents) | vitest unit | ✅ |
| 6 | `mcp-server-unit` (api-client) | vitest unit | ✅ 8 passed |
| 7 | `ai-unit` (sentiment) | vitest unit | ✅ 6 passed |
| 8 | `connectors-unit` (google) | vitest unit | ✅ |
| 9 | `consent-text-unit` (validator) | vitest unit | ✅ 23 passed |
| 10 | `database-unit` (tenantScope) | vitest unit | ✅ 2 passed |
| 11 | `shared-unit` (random) | vitest unit | ✅ 9 passed |
| 12 | `ui-unit` (utils) | vitest unit | ✅ 7 passed |

### Rebase performed mid-Phase 7

The first three smoke attempts failed on pre-existing fresh-worktree infrastructure issues that have already been fixed upstream since the branch was cut:

| Attempt | Failure | Root cause | Resolution |
|---|---|---|---|
| 1 | `web-e2e` browser missing | Playwright Chromium binary not installed in fresh worktree | Ran `pnpm exec playwright install chromium` |
| 2 | `demo-storefront-e2e` global-setup `Environment variable not found: DATABASE_URL` | `apps/demo-storefront/test/e2e/global-setup.cjs` invokes `tsx scripts/setup-dev-brand.ts` without `--env-file=.env` (pre-existing bug — root `package.json` script DOES use `--env-file`, but this caller doesn't). Issue #429 ("remove demo-storefront from CI smoke") already addressed it on `main`. | Rebased onto `origin/main` — PR #429 removed the failing suite from smoke. |
| 3 | `connectors` build: `Cannot find module '@azure/communication-email'` | Post-rebase: PR #420 ("Azure Communication Services email delivery") added a new dep that wasn't in my pre-rebase `pnpm-lock.yaml` | Re-ran `pnpm install` after the rebase. |

Also picked up via the rebase: PR #428 ("BAML evals out of smoke / nightly regression tier") — the BAML eval test fails without `AZURE_OPENAI_API_KEY` which isn't provisioned in any local `.env`. PR #428 moved it to the nightly tier where the key IS available; this kept smoke green for #413's run as well.

The rebase ran cleanly with no conflicts. The R7 gate I added (`scripts/test-suite-runner.mjs` first step, before `buildPrereqs`) survived the merge intact.

### Triage classification

| Failure | Classification | Action |
|---|---|---|
| `web-e2e` Chromium missing | Environment | Standard fresh-worktree setup; `pnpm exec playwright install chromium` is the canonical fix |
| `demo-storefront-e2e` DATABASE_URL | Pre-existing infra bug | Already fixed upstream by PR #429; rebase resolved |
| `connectors` build missing dep | Stale lockfile post-rebase | Standard `pnpm install` |
| `ai-baml-evals` API-key missing | Pre-existing infra config | Already fixed upstream by PR #428; rebase resolved |

No regressions introduced by #413. All four pre-existing issues that surfaced were either upstream-fixed (picked up via rebase) or are standard fresh-worktree setup steps.

### Test count touching #413's R-items

- `PoweredByFooter.test.tsx`: 15 passing (DOM + className + UTM + a11y + R7 type-level)
- `SurveyFormRenderer.test.tsx`: 4 new passing (R1 attachment, R9 preview/live parity, R7 chrome-matrix-irrelevant, R4 utm_medium=link)
- `page.r12-byte-identity.test.tsx`: 6 passing (user-mandated timing-attack invariant for the 4 tokenized error states)
- `public.test.ts`: 7 new passing (R3 form-append + thank-you-swap, R4 UTM + no-PII, R7 no-toggle in generated JS, R8 a11y attrs, R10 +1KB gzipped budget)

**Total #413 test surface: 32 new tests, 0 todo, 0 skipped, 0 flaky.**

---

## Phase 9 (`implement-completeness-review`) — checklist

*To be populated in Phase 9.*
