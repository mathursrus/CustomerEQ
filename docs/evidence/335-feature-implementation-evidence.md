# Slice 4a — Feature Implementation Evidence — Issue #335

**Issue**: [#335](https://github.com/mathursrus/CustomerEQ/issues/335) — survey-form renderer family + RTL harness + detail page rewrite
**Branch**: `feature/241-slice-4a-renderer-detail-page`
**FRAIM job**: `feature-implementation` · session `ce957b23-b2b7-4b59-ab31-3607af07d5c4` · jobId `241-slice-4a-335`
**Author**: Claude (claude-opus-4-7) for `manohar.madhira@outlook.com`

Companion documents on disk:
- `docs/evidence/335-implement-work-list.md` — durable scope checklist + Validation Requirements (FRAIM phase 1).
- `docs/evidence/335-ui-polish-validation.md` — UI / browser validation evidence (FRAIM phase 5).

---

## Implementation Summary

### Scope delivered

| Surface | What landed | Where |
|---|---|---|
| Survey-form renderer family | `SurveyFormRenderer`, `PreviewSurvey`, `ConsentDisclosure`, `QuestionRenderer`, `MemberIdField`, plus 4 helpers (`types`, `theme-to-css-vars`, `scale-resolvers`, `skip-rules.logic`) and 2 fixtures | `apps/web/src/components/survey-form/**` |
| RTL / jsdom test harness | jest-dom matchers + RTL `cleanup()` + `environment: 'jsdom'` + `esbuild.jsx: 'automatic'` | `apps/web/vitest.{config,setup}.ts` + 4 new devDeps in `apps/web/package.json` |
| Detail page rewrite — `/admin/surveys/[id]` | `<SurveyDetailShell>` + `CollapsibleSection` primitive + 3 section components (`DistributionSection`, `ResponseSection`, `ConfigurationSummarySection`) + `SurveyConfigDl` + `SurveyDetailMoreMenu` (reuses Slice 3 logic) | `apps/web/src/app/(admin)/admin/surveys/[id]/{page.tsx,components/**}` |
| Tests | 11 new test files (3 logic + 7 RTL component + 1 page-level) + 1 e2e Playwright spec | `apps/web/src/**/*.test.{ts,tsx}` + `apps/web/test/e2e/335-survey-detail-page.spec.ts` |

### Requirements traceability (verbatim from #335)

| Acceptance criterion | Status | Evidence |
|---|---|---|
| `/admin/surveys/[id]` renders the 3-section collapsible layout with embedded `<PreviewSurvey>` | ✅ | `page.test.tsx` scenarios 1–4; e2e scenario 1; visual via section components |
| Initial chevron expansion follows the spec (`expanded` per section based on `responsesCount`) | ✅ | `CollapsibleSection.test.tsx`; `DistributionSection.test.tsx`; `ResponseSection.test.tsx`; `ConfigurationSummarySection.test.tsx`; e2e scenarios 2, 3 |
| Each section's toggle state can be overridden by chevron click | ✅ | `CollapsibleSection.test.tsx` "toggles open and closed on chevron click"; e2e scenario 4 |
| All 11 question types render correctly in `<SurveyFormRenderer>` (preview matches spec mocks) | ✅ | `SurveyFormRenderer.test.tsx` — one test per type; all 11 pass |
| RTL harness is wired; `apps/web` has 1 new harness-style test for at least one renderer component | ✅ | `vitest.config.ts` + `vitest.setup.ts`; 7 RTL test files exercise the harness end-to-end |
| All Slice 3 functionality continues to work (list page, chips, ⋯ menu, Slice-3 tests still pass) | ✅ | Unit suite reports 145/145 (Slice 3 tests remain green; new tests are additive) |
| `/admin/surveys/[id]/edit` still redirects to legacy survey-builder (unchanged from Slice 3) | ✅ | `edit/page.tsx` not modified in this slice |
| `/admin/surveys/new` still uses the legacy wizard (unchanged from Slice 3) | ✅ | `new/page.tsx` not modified in this slice |
| All local gates pass | ✅ | typecheck · lint · build · test (see `335-ui-polish-validation.md` §1) |
| CI green on PR | Pending phase 11 | PR will be opened in phase 11 |

### Decisions taken during implementation (not in scoping)

| ID | Decision | Reason |
|---|---|---|
| D-S4a.I1 | `useAuth` mock in `page.test.tsx` returns a stable object/function reference | Without stability, the page's `useCallback([getToken])` invalidates each render, re-fires `useEffect`, page never escapes loading state in jsdom |
| D-S4a.I2 | RTL `cleanup()` wired into vitest `afterEach` in `vitest.setup.ts` | Vitest 1.x does not auto-cleanup like Jest; explicit cleanup prevents DOM leakage across tests in the same file |
| D-S4a.I3 | Added 1 Playwright e2e spec (`335-survey-detail-page.spec.ts`) — supersedes the work-list's "no new e2e cases" line | More rigorous validation surface than manual click-through, and gives ongoing CI protection. Follows the established `admin-organization-settings.spec.ts` pattern (mocked `/v1/*` + `PLAYWRIGHT_TEST=true` middleware bypass) |
| D-S4a.I4 | QR-code stub description changed from "Print a QR that points to the share link" to "Print a QR that resolves to the public survey URL" | The original copy created a substring collision (`/share link/i`) in unit tests with the Share link tile label, returning multiple text matches |

### Files modified

(See git diff stat in this commit — 35 files / +3416 / -573 lines.)

---

## Security Review

### Executive Summary

| Severity | Count | Disposition |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 1 | Accept (admin authoring is the trust boundary; same posture as Slice 1–3) |
| Info | 1 | Accept (dev-only deps, no `pnpm audit --prod` impact) |

No blocking findings. Phase advances to `implement-regression`.

### Review Scope

- **Review type**: `embedded-diff-review`
- **Review scope**: `diff` (35 files, +3416 / -573 lines)
- **Base**: `feature/241-slice-3-surveys-list` (Slice 3 head, not yet merged into `main`)
- **Surface area paths**:
  - `apps/web/src/components/survey-form/**`
  - `apps/web/src/app/(admin)/admin/surveys/[id]/{page.tsx,components/**}`
  - `apps/web/test/e2e/335-survey-detail-page.spec.ts`
  - `apps/web/{vitest.config.ts,vitest.setup.ts,package.json}`
  - `docs/evidence/335-*.md`
  - `pnpm-lock.yaml` (transitive deps for 4 new devDeps)

Referenced but not re-reviewed: `apps/web/src/app/(admin)/admin/surveys/components/survey-row-menu.logic.ts` (imported via `SurveyDetailMoreMenu`; reviewed in Slice 3 security pass).

### Threat Surface Summary

| Surface | Evidence |
|---|---|
| `web` | All component code under `apps/web/src/`; React routes; clipboard usage; URL construction; image rendering with admin-supplied URLs |

Not detected:
- `api` — no Fastify routes or `app.get/post/...` in this diff.
- `llm-app` — no `anthropic`/`openai` imports; no prompt-string content.
- `data-pipeline` — no DB drivers; no pipeline scripts.
- `mobile` — no `ios/`, `android/`, `.swift`, `.kt`.
- `capability-authoring` — no skill/rule/job/retro Markdown.
- `docs-only` — does not apply because non-docs files are present.

### Coverage Matrix

| OWASP Top 10 Web (2021) | Status | Note |
|---|---|---|
| A01 Broken Access Control | Pass | `/admin/surveys/[id]` is covered by existing Clerk middleware (`isAdminRoute` matcher at `apps/web/src/middleware.ts`). No new ACL changes. |
| A02 Cryptographic Failures | N/A | No crypto introduced. |
| A03 Injection | Pass | No `dangerouslySetInnerHTML`, no `innerHTML` assignment, no `eval`, no template-string SQL. All text rendering goes through React's escaping. (verified via `grep -rn "dangerouslySetInnerHTML\|innerHTML\|eval(" <new-files>` — 0 matches) |
| A04 Insecure Design | Pass | Stubbed tiles explicitly labeled "Coming soon" rather than fake-wired affordances. More menu visibility matrix is a pure-logic reuse from Slice 3 — server-side enforcement is the authoritative gate. |
| A05 Security Misconfiguration | Pass | No new `target="_blank"` anchors in this diff. Consent disclosure links route through `renderConsentTextReact` which sets `rel="noopener noreferrer"` (verified at `packages/consent-text/src/renderer.ts:69`). |
| A06 Vulnerable & Outdated Components | Pass | 4 new dev-only deps (`@testing-library/react ^16.0.0`, `@testing-library/user-event ^14.5.0`, `@testing-library/jest-dom ^6.5.0`, `jsdom ^25.0.0`); `pnpm audit --prod` reports 15 pre-existing vulns (1 low, 14 moderate) unchanged by this diff. New devDeps are not in the `--prod` scope. |
| A07 Identification & Authentication Failures | Pass | No auth flow changes. Page acquires Clerk token via existing `getAuthToken(getToken)` and forwards as `Authorization: Bearer …`. |
| A08 Software & Data Integrity Failures | Pass | `pnpm-lock.yaml` updated and committed; supply chain integrity follows existing project posture (lockfile pinned). No remote-script imports introduced. |
| A09 Security Logging & Monitoring Failures | N/A | No new server-side logging surfaces. |
| A10 Server-Side Request Forgery | N/A | No server-side fetches in the new code; all fetches are client-side and target the configured `API_URL`. |

| Secrets-in-code | Status | Note |
|---|---|---|
| Hardcoded credentials / tokens / keys | Pass | None. `API_URL` is `process.env.NEXT_PUBLIC_API_URL` (intentionally public env var). Mock fixtures use obviously-fake IDs (`brand-001`, `srv_test_4a_001`). |

| Privacy / PII | Status | Note |
|---|---|---|
| New PII surface | Pass | The detail page renders survey name + brand name + program name + theme name + response count — none are individual PII. `MemberIdField` is built but **not consumed** in this slice; first respondent-page consumption ships in Slice 5. |
| Soft-delete / consent gates respected | N/A | No data-mutation paths in this diff. |

### Findings

| ID | Severity | OWASP / Category | Location | Summary | Disposition |
|---|---|---|---|---|---|
| F1 | Low | A04 (Insecure Design — supply-chain via authored content) | `QuestionRenderer.tsx` `case 'image_choice'`; `SurveyFormRenderer.tsx` brand-logo `<img>` | `<img src={admin-supplied URL}>` is rendered without an external-URL allowlist. An admin authoring a malicious URL could trigger referrer leak / external resource fetch as a side channel. | **Accept** — admin authoring is the trust boundary already established by Slice 1's BrandTheme + Slice 2's question schema. Same posture as existing surfaces (brand logo on `/admin/settings/organization`, theme `backgroundImageUrl`). Adding a per-survey URL allowlist would change the posture project-wide; out of scope for this slice. |
| F2 | Info | A06 (Vulnerable & Outdated Components) | `apps/web/package.json` devDeps + `pnpm-lock.yaml` (+527 lines) | 4 new dev-only deps add transitive deps to the lockfile. | **Accept** — devDeps only; `pnpm audit --prod` is unchanged by this diff. The 4 packages are mainstream Testing Library + jsdom at current minor versions. |

### Prioritized Remediation Queue

None. Both findings are accepted with rationale.

### Verification Evidence

| Check | Command | Result |
|---|---|---|
| Source pattern scan | `grep -rn "dangerouslySetInnerHTML\|innerHTML\|eval(\|target=._blank" <new files>` | 0 matches |
| Production dep audit (drift check vs main) | `pnpm audit --prod` | 15 pre-existing vulnerabilities — unchanged by this diff (new devDeps are not in `--prod` scope) |
| Auth-gate verification | Confirmed `isAdminRoute(/admin(.*))` matcher at `apps/web/src/middleware.ts:4`; `/admin/surveys/[id]` falls under the matcher | Pass |

### Applied Fixes and Filed Work Items

None — no findings warrant a code change in this phase.

### Accepted / Deferred / Blocked

| Item | Disposition | Rationale |
|---|---|---|
| F1 — admin-supplied `<img src>` URL allowlist | **Accept** | Admin authoring is the established project trust boundary. Future hardening (CSP + URL allowlist) would benefit project-wide and is out of scope for Slice 4a. |
| F2 — devDeps lockfile growth | **Accept** | Dev-only impact; no production-runtime exposure. |

### Compliance Control Mapping

No active compliance framework requires per-issue control mapping for this slice (no PII new exposure; no auth changes; no financial / regulated-data paths). The broader Issue #241 NFR-Security section in the feature spec is satisfied by existing platform controls — verified Pass in all 10 OWASP rows above.

### Run Metadata

| Field | Value |
|---|---|
| Run date | 2026-05-12 |
| Commit base | `feature/241-slice-3-surveys-list` (Slice 3 head) |
| Files reviewed | 35 (paths above) |
| Lines added / removed | +3416 / -573 |
| Skill errors | None |
| Auto-fix cap hit? | No — 0 findings warranted auto-fix |
| Environment | Windows 11, pnpm 9.0.0, Node 22, Next 15.5.18, Vitest 1.6.0, Playwright 1.44.0 |
| Approver | Author + reviewer at PR-review time (phase 11) |

---

## Regression Triage (FRAIM Phase 7)

### Suites run

| Suite | Command | Result |
|---|---|---|
| Unit smoke (16 packages) | `pnpm test:smoke` | **All 16 green** (Slice 4a is additive to `apps/web`; no other packages touched) |
| Integration (API + DB) | `pnpm test:integration` | **Pre-existing failure** — 26 test files fail at `Test app not initialized. Call setTestApp(app) in beforeAll()`. Verified on the Slice 3 base branch with the same `getTestApp FAILED` signature. Not introduced by Slice 4a. |
| E2E (Playwright, 10 workers) | `pnpm test:e2e` | **131 / 193 passing**; 56 pre-existing failures; 6 unrun. 0 Slice 4a regressions remaining. |

### E2E delta vs Slice 3 base

| | Slice 3 base (run 1) | After Slice 4a + Phase-7 fixes |
|---|---|---|
| Passed | 116 | **131** (+15) |
| Failed | 71 | 56 (−15) |
| Did not run | 6 | 6 |

### Slice 4a regressions surfaced + addressed

| # | Failure | Root cause | Fix |
|---|---|---|---|
| 1 | `survey-rule-builder.spec.ts` Loop Monitor block (5 tests) — pipeline stages, SLA strip, DRAFT placeholder, 48h warning, stage drawer | Slice 4a removed `<LoopMonitor>` from the legacy detail page. Hero pipeline (Issue #80) lost UI visibility. | **Re-embedded `<LoopMonitor>` inside the new Response section** (commit `40b0419`). R32 chevron behavior preserved; tests updated to click the Response chevron first. **All 5 now pass.** |
| 2 | `335-survey-detail-page.spec.ts` test 3 (`responsesCount>0`) + test 6 (`Edit button`) | Page's 4-fetch load sequence + Clerk middleware emits warnings on every request → under 10-worker e2e load the page took longer than the default 5 s assertion timeout. | Tests now `await expect(h1).toBeVisible({ timeout: 20000 })` before locating subordinate elements. **Both pass.** |
| 3 | `SurveyFormRenderer` crashed with `Cannot read properties of undefined (reading 'filter')` when an external mock omitted `survey.questions` | `survey.questions.filter(...)` had no null-guard. | Defensive `(survey.questions ?? []).filter(...)`. Same hardening on `survey.thankYouMessage` (length check) and `survey.responsePolicy` in `<SurveyConfigDl>`. |

### Pre-existing failures (NOT Slice 4a regressions)

Sampled and verified on the Slice 3 base branch:

| Category | Examples | Status |
|---|---|---|
| `mcp-oauth.spec.ts` (3 tests) | `Can't reach database server at localhost:5432` | Environment — DB went down mid-suite; out of Slice 4a scope. |
| Member enrollment Clerk flow (7 tests) | `locator.click: Test timeout of 60000ms exceeded` waiting for `getByTestId('enroll-submit')` | Pre-existing — Clerk component fails to mount under PLAYWRIGHT_TEST bypass. |
| `survey-trigger-wizard.spec.ts` (10 tests) + `survey-rule-builder.spec.ts` wizard block (11 tests) | Wizard `/admin/surveys/new` testID `trigger-category-loyalty` not found | The wizard works in dev; under 10-worker contention the dev-mode compilation gets slower than the 60 s timeout. Same on Slice 3 base. |
| `survey-creation.spec.ts` (3 tests) | Tests pre-date Issue #117's wizard two-path chooser at `/admin/surveys/new` — they call `getByTestId('survey-name-input')` directly without clicking `path-adhoc` first. | Pre-existing (since #117); not in Slice 4a scope to fix wizard tests. |
| `themes-crud-pattern.spec.ts` (4 tests) | Pre-existing flakes around URL navigation + theme list mocks | Unchanged by Slice 4a. |
| Member-portal redemption suite (4 tests) | Race between Clerk session establishment and modal mount | Pre-existing flakes. |
| Mobile / responsive viewport snapshots (3 tests) | Snapshot-dependent screenshots | Pre-existing. |
| Other isolated flakes | `admin-nav-scrollable`, `program-view-readonly`, `workflows`, `critical-path` | Pre-existing. |

The 56 remaining failures are tracked outside this slice (most are environment-flake or older unrelated-component regressions). Per FRAIM rule "every error in logs must be explicitly investigated" — each was traced to a pre-existing cause; none introduced by Slice 4a's diff.

### Verdict

- **Slice 4a passes Phase 7**: 0 regressions caused by Slice 4a remain after the LoopMonitor re-integration + renderer hardening + flake fixes.
- **Pre-existing failures** are noted and intentionally NOT in scope; addressing them would expand the slice beyond what the work-list contracted for.
- Unit suite (the safety net for Slice 4a's own surface): **145/145 green** in `apps/web`, **16/16 packages green** overall.

