# Issue #292 — Slice 4 of 4: Frontend (`/admin/settings/organization`)

Branch: `feature/issue-292-org-settings-ui`
Job ID: `feature-implementation-292-slice4` (FRAIM `feature-implementation`)
RFC §: 6 (Frontend page architecture), 7 (OrganizationSwitcher integration), 7a (Q2 Brand-name decoupling)
Spec §: F1 / F1b / F2–F16 (UI + per-field traceability), Validation Plan (12 E2E scenarios)
Prereq slices on main: #299 (Slice 1, schema) · #300 (Slice 2, `@customerEQ/consent-text`) · #307 (Slice 3, API + lazy-upsert + audit allowlist)
PR target: **`Closes #292`** — Slice 4 closes the umbrella issue.

---

## Scope

### In scope (this slice)

1. **Page route** — `apps/web/src/app/(admin)/admin/settings/organization/`:
   - `page.tsx` — RSC entry; fetches GET `/v1/admin/brand/profile` server-side or hydrates from a client-side fetch on mount (apps/web's existing pattern is client-side `useEffect` + `useAuth().getToken()` — match it for consistency with `/admin/settings/themes`).
   - `components/OrganizationSettingsForm.tsx` — top-level RHF form; composes 6 sections; manages cross-section pending banner state.
   - `components/sections/IdentitySection.tsx` — F1 (read-only Clerk org name from `useOrganization()`) · F1b (editable Brand name) · F2 (logoUrl URL paste) · F3 (siteDomain) · F5 (orgSize pill radio).
   - `components/sections/DefaultsSection.tsx` — F15 (timezone) · F16 (locale).
   - `components/sections/LookAndFeelSection.tsx` — F4 (defaultThemeId radio + swatches; deep-link to `/admin/settings/themes`).
   - `components/sections/MemberIdentificationSection.tsx` — F6 (radio group; locked-state notice when `memberCount > 0`).
   - `components/sections/ConsentLegalSection.tsx` — F7 (consentMode) · F8 (consentTextDefault editor) · F9 (privacyPolicyUrl) · F10 (termsUrl).
   - `components/sections/DeveloperSupportSection.tsx` — F11–F14 (collapsed by default, copy-to-clipboard).
   - `components/ImpliedAttestationModal.tsx` — fires when `consentMode` flips to IMPLIED_ON_SUBMIT.
   - `components/ConsentTextEditor.tsx` — toolbar (`+ Privacy link` / `+ Terms link`) + textarea + live preview using `renderConsentTextReact` from `@customerEQ/consent-text`.

2. **Shared admin component (R16)** — `apps/web/src/components/admin/AdminPendingBanner.tsx`. Reusable across future settings pages with cross-section required fields. Data-state-driven (no Dismiss/Snooze).

3. **Admin layout edits** (`apps/web/src/app/(admin)/layout.tsx`):
   - Add `afterCreateOrganizationUrl="/admin/settings/organization"` (R26 — first-run landing).
   - Add `organizationProfileMode="redirect"` + `organizationProfileUrl="/admin/settings/organization"` (R6 — Manage deep-link).
   - Add `{ href: '/admin/settings/organization', label: 'Organization', section: 'Settings' }` as the **first entry** under Settings (RFC §7 sidebar).

4. **Workspace deps** (apps/web/package.json):
   - `react-hook-form: ^7.x`
   - `@hookform/resolvers: ^3.x`
   - `@customerEQ/consent-text: workspace:*`

5. **Unit tests** — **deferred to [#311](https://github.com/mathursrus/CustomerEQ/issues/311)**. apps/web has no vitest configuration today (verified: zero `.test.tsx` files under `apps/web/src/**`, no `vitest.config.*`, no `test:smoke` script in `apps/web/package.json`). The repo's web-app testing convention is **E2E-only via Playwright** (24 existing specs under `apps/web/test/e2e/`). Pure consent-text logic (parser, validator, renderer, `hasPrivacyToken`) is already vitest-tested in `packages/consent-text`. Setting up apps/web vitest just for `AdminPendingBanner` + `ConsentTextEditor` is net-new infrastructure that scopes to a separate issue (R21). The two components are validated end-to-end via E2E scenarios #9 (pending banner) and #10–#12 (consent text editor) per spec §Validation Plan.

6. **E2E tests** (Playwright) at **`apps/web/test/e2e/admin-organization-settings.spec.ts`** — 12 scenarios from spec §Validation Plan. (Per OD-2: spec referenced repo-root `tests/e2e/`; actual `playwright.config.ts` testDir is `./test/e2e`. Sibling commit aligns spec text.) **Auth pattern:** `PLAYWRIGHT_TEST=true` env var bypasses Clerk middleware (already in `apps/web/src/middleware.ts:24`); existing E2E specs (`themes-crud-pattern.spec.ts`, `admin-nav-scrollable.spec.ts`) mock `**/v1/**` and `**/clerk.**` routes via `page.route()`. Slice 4 follows the same pattern.

7. **Spec text alignment** (one sibling commit, separate file):
   - Update spec §Validation Plan path reference from `tests/e2e/admin-organization-settings.spec.ts` to `apps/web/test/e2e/admin-organization-settings.spec.ts`.
   - Update RFC §Validation Plan E2E row identically.

### Out of scope (deferred)

| Item | Why deferred | Where it lands |
|---|---|---|
| Logo file-picker UX | URL paste is the v0 contract per Slice 3 Q1 binding | [#305](https://github.com/mathursrus/CustomerEQ/issues/305) |
| Cross-cutting admin-role gate | UI inherits whatever the gate is when it lands | [#306](https://github.com/mathursrus/CustomerEQ/issues/306) |
| Sender / Reply-to fields | No SPF/DKIM verification infra | #277.C (filed, not blocking) |
| apps/web vitest setup + component unit tests | apps/web has no vitest config today; net-new infrastructure scoped to its own issue (R21) | [#311](https://github.com/mathursrus/CustomerEQ/issues/311) |
| Migration of `ThemeForm` / `AlertRuleForm` / `CampaignForm` to RHF | R21 — bundle into next substantive change to those forms (post-#241 for surveys) | Per-form follow-up issues, not on this branch |
| Cross-package import-graph CI check (R18 third-consumer enforcement) | The third consumer (Survey-creation simplification module) hasn't shipped — nothing to enforce against today | Files when Survey-creation simplification module ships |

---

## Files to add / modify

| Path | Action | Approx LOC |
|---|---|---|
| `apps/web/src/app/(admin)/admin/settings/organization/page.tsx` | add | ~50 |
| `apps/web/src/app/(admin)/admin/settings/organization/components/OrganizationSettingsForm.tsx` | add | ~180 |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/IdentitySection.tsx` | add | ~110 |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/DefaultsSection.tsx` | add | ~70 |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/LookAndFeelSection.tsx` | add | ~90 |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/MemberIdentificationSection.tsx` | add | ~90 |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/ConsentLegalSection.tsx` | add | ~120 |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/DeveloperSupportSection.tsx` | add | ~80 |
| `apps/web/src/app/(admin)/admin/settings/organization/components/ImpliedAttestationModal.tsx` | add | ~80 |
| `apps/web/src/app/(admin)/admin/settings/organization/components/ConsentTextEditor.tsx` | add | ~120 |
| `apps/web/src/app/(admin)/admin/settings/organization/lib/pendingItems.ts` | add | ~50 |
| `apps/web/src/app/(admin)/admin/settings/organization/lib/types.ts` | add | ~50 |
| `apps/web/src/components/admin/AdminPendingBanner.tsx` | add | ~70 |
| `apps/web/src/app/(admin)/layout.tsx` | modify | +5 / +1 navLink entry |
| `apps/web/package.json` | modify | +3 deps |
| `apps/web/test/e2e/admin-organization-settings.spec.ts` | add | ~400 (12 scenarios) |
| `pnpm-lock.yaml` | modify | RHF + resolvers + consent-text workspace link |
| `docs/evidence/292-slice-4-implement-work-list.md` | add (this file) | — |
| `docs/evidence/292-slice-4-feature-implementation-evidence.md` | add later | per-phase evidence |
| `docs/evidence/292-slice-4-feature-implementation-feedback.md` | add later | quality-feedback findings |
| `docs/feature-specs/277-organization-settings.md` | sibling commit | E2E path text |
| `docs/rfcs/277-organization-settings.md` | sibling commit | E2E path text |

**Approx total:** ~1,650 LOC across 17 files of code + tests (umbrella estimate was ~600; gap is the per-section split, the consent-text editor + modal, and 12 E2E scenarios).

**Phase-Splitting check:** 17 files of code/tests is over the 15-file heuristic, but every file is in one logical area (the new settings page + its single shared admin banner + its E2E suite). Splitting would mean shipping the page without sections, or sections without the editor — both are unreviewable mid-states. Single PR is the right size.

---

## Decisions — RESOLVED (2026-05-09)

User answered the two open decisions surfaced during scoping. Resolutions are binding for Slice 4 implementation.

### OD-1 — Form-state library: **React Hook Form + `@hookform/resolvers/zod`**

Adopt RHF for `/admin/settings/organization` and any future admin form. The drift with existing useState-based admin forms (`ThemeForm`, `AlertRuleForm`, `CampaignForm`, survey-builder forms) is acknowledged; those migrate when each next sees substantive change, with **#241 (Survey Admin UX epic)** as the natural rework window for the survey-side forms. No proactive migration in unrelated work (R21).

**Why RHF over native useState:** `formState.dirtyFields` does per-section dirty detection without ~100 LOC of bespoke snapshot/compare; resolver wires `zConsentText` from the shared package directly into RHF's error map (R18 single-source-of-truth between API and frontend); RFC §Architecture Analysis already added RHF + zod resolver to `architecture.md` §2 — this slice makes the doc claim real.

**How applied here:**
- `OrganizationSettingsForm.tsx` is a single `useForm()` per page; per-section dirty + Save / Cancel revealed via `formState.dirtyFields` filtered by section field paths.
- Cross-field rules (EXPLICIT-requires-{{privacy}}, IMPLIED-requires-attestation) are surfaced via the resolver's Zod schema; UI-only rules (memberIdentifierKind locked when `memberCount > 0`) are enforced at the section's render layer.
- A durable project memory captures the post-#241 migration plan so future agents touching the legacy forms know the direction.

### OD-2 — E2E test path: **`apps/web/test/e2e/admin-organization-settings.spec.ts`**

Matches actual `apps/web/playwright.config.ts` `testDir: './test/e2e'`. Spec / RFC text said `tests/e2e/` — that path has no Playwright wiring and was aspirational. Slice 4 includes a sibling commit aligning the spec + RFC text to the actual path. Workspace ownership: each app owns its UI E2E.

---

## Validation Requirements

| Mode | Required for Slice 4? | Notes |
|---|---|---|
| `unitTestsRequired` | ❌ Deferred (follow-up issue) | apps/web has no vitest config or `*.test.tsx` files today; web-app testing convention is E2E-only. Setting up vitest is net-new infrastructure scoped to a separate issue (R21). Pure consent-text logic already covered in `packages/consent-text` vitest. |
| `integrationTestsRequired` | ❌ No | Slice 3 owned the API integration tests. Slice 4 hits the API via E2E only. |
| `migrationValidationRequired` | ❌ No | Slice 1 already shipped on main (`c365833`) |
| `e2eTestsRequired` | ✅ Yes (P0 feature; R9) | All 12 spec scenarios; runs against real Docker-backed dev stack per R11a |
| `uiValidationRequired` | ✅ Yes | Project rule R18 + L1 P-HIGH preference for browser validation. Manual sweep across the three mock scenes (empty / populated-locked / IMPLIED attestation modal) before submit. |
| `mobileValidationRequired` | ❌ No | Settings is a desktop-first surface; mobile-emulator pass not required v0 |
| `securityReviewRequired` | ✅ Yes | R12 (no secrets), R13 (PII), API7 reflection (admin-typed URLs render into anchors — `renderConsentTextReact` already escapes; verify) |
| `regressionTestsRequired` | ✅ Yes | `pnpm test:smoke` repo-wide; the layout edit could regress sidebar tests on adjacent pages (themes / webhooks / developer) |
| `architectureUpdateRequired` | ✅ Yes (verification) | RHF row in `architecture.md` §2 was added pre-#292 by RFC; verify it now cites Slice 4 as first consumer |

---

## Acceptance Criteria (mapped to umbrella + spec + RFC)

| ID | Source | Slice 4 deliverable |
|---|---|---|
| AC-S4-1 | Umbrella issue Slice 4 row | `/admin/settings/organization` renders all 6 sections |
| AC-S4-2 | Umbrella issue Slice 4 row | `AdminPendingBanner` works (multi-row, no Dismiss, data-state-driven) |
| AC-S4-3 | Umbrella issue Slice 4 row | `OrganizationSwitcher` redirects on org-create (`afterCreateOrganizationUrl`) |
| AC-S4-4 | Umbrella issue Slice 4 row | E2E covers empty / populated / IMPLIED-attestation flows (≥3 of 12 scenarios — full set per spec) |
| AC-S4-5 | Umbrella issue + R18 + L1 P-HIGH | Browser-validated against a real dev session before submit |
| AC-S4-6 | Spec §Workflow step 5 + RFC §7a | Identity section renders TWO name rows: read-only Clerk org name (top) + editable Brand name (below). PATCH writes Brand only — verified by E2E spec scenario #6. |
| AC-S4-7 | Spec §Workflow step 6 | Member identification locked-state UI renders on first paint when `memberCount > 0`; mailto:SUPPORT_EMAIL wired |
| AC-S4-8 | Spec §F8 + Validation Plan #10–#12 | Consent text editor: toolbar token insertion, live preview, parser/renderer reused from `@customerEQ/consent-text` |
| AC-S4-9 | Spec §F4 + Validation Plan | Look & Feel renders all themes from GET response (4 stock themes seeded by Slice 3 lazy-upsert); `defaultThemeId` selectable; "Open Themes →" deep-link |
| AC-S4-10 | RFC §7 sidebar | Settings → Organization is the first item under Settings group |
| AC-S4-11 | Project rule R11 | `pnpm typecheck`, `pnpm lint`, `pnpm test:smoke` (repo-wide) all green pre-PR |
| AC-S4-12 | Project rule R11a + R18 + L1 P-HIGH | E2E suite passes against real dev server; tests fail loud (never skip) when API/DB/dev-server unreachable |

---

## Pattern discovery (skill output)

| Category | Pattern found | Reused |
|---|---|---|
| Admin shell layout | `apps/web/src/app/(admin)/layout.tsx` — sidebar with sections (Customer / Loyalty / CX & Feedback / Support / Settings); active-state via `pathname.startsWith(href + '/')` | Reuse — append "Organization" to Settings group as first entry |
| Admin form pattern (legacy) | `apps/web/src/components/themes/ThemeForm.tsx` — plain useState + manual fetch; ChipGroup / ColorInput primitives | Pattern reference for visual consistency only; **not** for form-state mechanics (Slice 4 adopts RHF per OD-1) |
| API client pattern | `apps/web/src/lib/config.ts` — `API_URL = process.env.NEXT_PUBLIC_API_URL \|\| 'http://localhost:4000'`; `getAuthToken(getToken)` wrapper with timeout | Reuse |
| Auth | `useAuth()` from `@clerk/nextjs` for `getToken()`; `useOrganization()` for the read-only Clerk org name (F1) | Reuse |
| Consent text | `@customerEQ/consent-text` exports `tokenize`, `segments`, `zConsentText`, `validateConsentText`, `hasPrivacyToken`, `renderConsentTextHTML`, `renderConsentTextReact` | Reuse `zConsentText` (RHF resolver), `renderConsentTextReact` (live preview), `hasPrivacyToken` (pending-fields helper) |
| Modal | `apps/web/src/components/ui/modal.tsx` exists | Reuse for `ImpliedAttestationModal` |
| Existing UI primitives | `form-group`, `status-badge`, `view-only-banner` under `apps/web/src/components/ui/` | Survey for fit before creating new primitives |
| E2E setup | `apps/web/playwright.config.ts` testDir `./test/e2e`; existing dir is empty | Slice 4 is the first E2E consumer in apps/web — set the pattern |
| Test bypass for E2E | API plugin `auth.ts` honors `X-Test-Clerk-Org-Id` header (introduced Slice 3) | Use this header in E2E to drive the lazy-upsert path without a full Clerk OAuth flow |

---

## L1 patterns to apply (validated + mistake-avoidance)

| Pattern | Where it applies in Slice 4 |
|---|---|
| Tests fail loud (R11a) | E2E + unit tests must connect to real dev server / DB; never skip on unreachable dependencies |
| FRAIM phase mentoring loop | After scoping completes, call `seekMentoring` for each phase transition — don't skip from "I have the plan" to "submit PR" |
| Per-thread PR replies at resolution time | Phase 12 — every reviewer comment thread gets a reply citing resolving commit SHA |
| Decisions block at PR body bottom | Phase 11 — surface any binding decisions that arise during implementation as a numbered block in the PR description |
| File issue before bundling unrelated fixes (R21) | Off-scope discoveries (e.g., the legacy useState-form drift) → new issue, not a side-commit on this branch |
| Three-bucket architecture-gap classification | Phase 10 — Patterns Correctly Followed / Missing from Architecture / Incorrectly Followed |
| Filing backlog issues proactively for deferred work | Any deferral surfaced mid-implementation gets an issue at decision time, not "when we get there" |
| Audit mock-vs-spec sync at every round | Sibling commit aligning spec/RFC E2E path text — sweep both spec.md and rfc.md (and the mock if any visual analog needs an update) |
| Browser validation of UI changes is non-negotiable | Phase 5 — typecheck + smoke is not enough; load the page in a real browser, exercise empty / populated / IMPLIED flows |
| RFC-claimed-files-not-verified | Verified during scoping: `react-hook-form` not in apps/web/package.json (now landing in Slice 4); `tests/e2e/` not Playwright-wired (rerouted); no `apps/web/src/components/admin/` dir (creating fresh). Surfaced as OD-1 + OD-2; nothing else in RFC §6 / §7 needs re-verification at code authoring time. |
| Decisions framed with `← recommended` get one-round answers | OD-1 + OD-2 framed with both-frames + recommended; user resolved both in one batch (one chat turn) |
| Migration validated against real DB | N/A this slice (no migration) |

---

## Path forward — decisions resolved, ready for Phase 3

All open decisions resolved (OD-1 RHF, OD-2 apps/web/test/e2e). Memory durably captures:
- `project_admin_form_lib_rhf.md` — admin forms standardize on RHF; legacy migrate post-#241
- `reference_apps_web_e2e_path.md` — apps/web/test/e2e is the canonical path

Next phase: **Phase 3 — implement-tests** (FRAIM `feature-implementation`). Author E2E spec at `apps/web/test/e2e/admin-organization-settings.spec.ts` covering 12 scenarios from spec §Validation Plan + unit tests for `AdminPendingBanner` and `ConsentTextEditor`. Tests fail-loud per R11a; E2E connects to real dev server.
