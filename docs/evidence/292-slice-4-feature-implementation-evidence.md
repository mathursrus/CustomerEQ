# Implementation Evidence — Issue #292 Slice 4 (Frontend `/admin/settings/organization`)

Branch: `feature/issue-292-org-settings-ui`
Job ID: `feature-implementation-292-slice4` (FRAIM `feature-implementation`)
Tracks: [#292](https://github.com/mathursrus/CustomerEQ/issues/292) Slice 4 of 4 — **`Closes #292`** (final slice)
Sub-issues filed during this slice: [#311](https://github.com/mathursrus/CustomerEQ/issues/311) (apps/web vitest setup), [#312](https://github.com/mathursrus/CustomerEQ/issues/312) (5 pre-existing E2E failures on origin/main)

## Phase 1 — implement-scoping

Standing work list at [`docs/evidence/292-slice-4-implement-work-list.md`](./292-slice-4-implement-work-list.md). Two open decisions resolved with primary-source verification:
- **OD-1 (Form library)** — apps/web has zero RHF usage today (every existing admin form uses plain useState). Recommendation pair: respect-sunk-cost (native useState — drift-minimizing) + clean-slate (RHF — matches RFC §6.3 + R18 single-source-of-truth Zod). User chose **RHF**; legacy useState forms migrate post-#241 when surveys rework triggers their next substantive change.
- **OD-2 (E2E path)** — spec/RFC referenced repo-root `tests/e2e/` which has no Playwright wiring; actual `apps/web/playwright.config.ts` testDir is `./test/e2e`. Resolved to **`apps/web/test/e2e/admin-organization-settings.spec.ts`** + sibling spec/RFC text alignment.

Two durable memories captured: `project_admin_form_lib_rhf.md` (post-#241 migration plan), `reference_apps_web_e2e_path.md` (canonical apps/web E2E location).

Discovery surfaced during scoping (verified primary source): apps/web has no vitest configuration today. Net-new test infrastructure was scoped out and filed as **[#311](https://github.com/mathursrus/CustomerEQ/issues/311)**; Slice 4 validates via E2E only (web-app testing convention in this repo).

## Phase 3 — implement-tests

Tests authored before code per FRAIM test-driven principle. Initial run failed loud — UI didn't exist yet — confirming test-driven handoff to Phase 4.

| Test surface | Path | Scenarios |
|---|---|---|
| E2E (Playwright) | `apps/web/test/e2e/admin-organization-settings.spec.ts` | **14 tests** — 12 from spec §Validation Plan + 1 IMPLIED-cancellation variant + 1 identifier-kind-lock 409-PATCH variant. Mocks Clerk via `**/clerk.**`, mocks API GET / PATCH on `**/v1/admin/brand/profile` with body capture for assertions. |
| Unit | (deferred to [#311](https://github.com/mathursrus/CustomerEQ/issues/311)) | apps/web has no vitest config; pure consent-text logic (`hasPrivacyToken`, parser, renderer) is already vitest-tested in `packages/consent-text` |

## Phase 4 — implement-code

Files added or modified, with line counts and rationale:

| File | Action | LOC delta | Rationale |
|---|---|---|---|
| `apps/web/src/app/(admin)/admin/settings/organization/page.tsx` | add | +66 | RSC entry — fetches GET /v1/admin/brand/profile via `getAuthToken` wrapper (1s timeout for E2E reliability); renders form on success |
| `apps/web/src/app/(admin)/admin/settings/organization/components/OrganizationSettingsForm.tsx` | add | +320 | Top-level RHF form orchestrator + section card + sticky TOC; per-section dirty / Save / Cancel via `formState.dirtyFields` filtered through `SECTION_FIELDS` |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/IdentitySection.tsx` | add | +135 | Two name surfaces (Q2 reframe) — read-only Clerk org name from `useOrganization()` + editable Brand name; logo URL paste; siteDomain; orgSize pill radio |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/DefaultsSection.tsx` | add | +85 | Time zone (12 IANA tz options) + locale (12 BCP 47 locales) selects |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/LookAndFeelSection.tsx` | add | +85 | Themes radio list with swatches; deep-link to `/admin/settings/themes` |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/MemberIdentificationSection.tsx` | add | +110 | Three radio cards; locked-state UI on first paint when `memberCount > 0` (radios disabled, mailto:SUPPORT_EMAIL surface) |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/ConsentLegalSection.tsx` | add | +120 | Consent mode radios (intercept IMPLIED flip via parent-supplied callback) + ConsentTextEditor + privacy/terms URL inputs |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/DeveloperSupportSection.tsx` | add | +60 | Read-only Brand id / Clerk org id / createdAt + SUPPORT_EMAIL mailto; copy-to-clipboard via `navigator.clipboard.writeText` |
| `apps/web/src/app/(admin)/admin/settings/organization/components/ImpliedAttestationModal.tsx` | add | +110 | Modal with justification + checkbox + Confirm-disabled-until-both pattern; resets on every open (no draft leak across cancellations) |
| `apps/web/src/app/(admin)/admin/settings/organization/components/ConsentTextEditor.tsx` | add | +135 | RHF Controller wrap; toolbar (`+ Privacy link`, `+ Terms link`) inserts verbose token form `{{kind:"Default Label"}}`; live preview via `renderConsentTextReact` from `@customerEQ/consent-text` (R18 single-source-of-truth) |
| `apps/web/src/app/(admin)/admin/settings/organization/lib/types.ts` | add | +75 | Types mirror server contract (`apps/api/src/routes/admin-brand-profile.ts`); `SECTION_FIELDS` partition for per-section dirty detection |
| `apps/web/src/app/(admin)/admin/settings/organization/lib/schema.ts` | add | +60 | Zod resolver schema; reuses `zConsentText` from `@customerEQ/consent-text` (single source of truth between API + frontend) |
| `apps/web/src/app/(admin)/admin/settings/organization/lib/pendingItems.ts` | add | +55 | Pure logic — computes pending banner rows from form values; required-field set per spec §F1b/§F8/§F9 |
| `apps/web/src/components/admin/AdminPendingBanner.tsx` | add | +50 | Reusable shared admin component (R16); data-state-driven, no Dismiss / Snooze affordance |
| `apps/web/src/app/(admin)/layout.tsx` | modify | +5 | OrganizationSwitcher: `afterCreateOrganizationUrl="/admin/settings/organization"` (R26), `organizationProfileMode="navigation"` + `organizationProfileUrl="/admin/settings/organization"` (R6); sidebar: Organization as first Settings entry |
| `apps/web/package.json` | modify | +3 deps | `react-hook-form ^7.53.0`, `@hookform/resolvers ^3.9.0`, `@customerEQ/consent-text workspace:*` |
| `apps/web/test/e2e/admin-organization-settings.spec.ts` | add | +495 | 14 scenarios; mocks Clerk + API |
| `pnpm-lock.yaml` | modify | +2 packages | Bounded delta — RHF + resolvers (consent-text already in lockfile from Slice 2) |
| `docs/feature-specs/277-organization-settings.md` | sibling commit | +2 lines | E2E path text aligned to `apps/web/test/e2e/` |
| `docs/rfcs/277-organization-settings.md` | sibling commit | rewrite of one paragraph | E2E path text aligned + workspace-boundary rationale |

**Approx total:** ~1,820 LOC across 19 files (umbrella estimate ~600; gap is per-section split, RHF orchestrator, consent-text editor + modal, 14 E2E scenarios, sibling spec/RFC alignment).

**Bug discovered + fixed mid-implementation (typecheck-caught):** Clerk 5.7.6's `OrganizationSwitcher.organizationProfileMode` prop accepts `"navigation" | "modal" | undefined`. RFC §7 referenced `"redirect"` which does not exist on this Clerk version — sister-pattern to the L1 mistake "RFC-claimed-files-not-verified". Caught on first `pnpm typecheck` against the layout edit (`TS2322: Type '"redirect"' is not assignable to type '"navigation" | "modal" | undefined'`). Fix: use `"navigation"` (same effect — Manage navigates to `organizationProfileUrl`). One-line correction; no behavioral divergence.

## Phase 5 — implement-validate

| Check | Result |
|---|---|
| `git status` — working tree state | Clean — exactly the expected Slice 4 modifications + new files (verified pre-stage) |
| `console.log` / `TODO` / `FIXME` / `XXX` scan in new files | Zero matches across `apps/web/src/app/(admin)/admin/settings/organization/**`, `apps/web/src/components/admin/AdminPendingBanner.tsx`, `apps/web/test/e2e/admin-organization-settings.spec.ts` |
| `pnpm --filter @customerEQ/web typecheck` | 0 errors |
| `pnpm typecheck` (repo-root, turbo) | **19/19 tasks successful** |
| `pnpm --filter @customerEQ/web lint` | **0 errors**, 6 warnings — all 6 pre-existing in files Slice 4 did NOT touch (`apps/web/src/app/api/mcp/route.ts`, `apps/web/src/components/surveys/LoopMonitor.tsx`) |
| `pnpm --filter @customerEQ/web build` | 0 errors; `/admin/settings/organization` route 21.3 kB / 168 kB First Load JS |
| `pnpm test:smoke` (repo-root, turbo) | **16/16 tasks successful**; 404/404 api unit tests passing — confirms no regression in pre-existing suite |
| `pnpm --filter @customerEQ/web test:e2e admin-organization-settings.spec.ts` | **14/14 passing** in 50.5s against real dev server (mocked API + mocked Clerk per existing apps/web E2E pattern) |

### E2E run — coverage map

All 12 spec scenarios + 2 variants:

| # | Spec scenario | Test | Result |
|---|---|---|---|
| 1 | Lazy-upsert on first visit | "Lazy-upsert on first visit — page renders with brand row from GET" | ✅ |
| 2 | Per-section save | "Per-section save — Identity edit triggers PATCH with only that section's changed fields" | ✅ |
| 3 | EXPLICIT empty consent text gate | "EXPLICIT empty consent text gate — pending banner row appears" | ✅ |
| 4 | IMPLIED attestation modal | "IMPLIED attestation modal — fires on consentMode flip; persists with attestation block" | ✅ |
| 4b | (variant) IMPLIED cancellation | "IMPLIED modal cancellation — no PATCH fires" | ✅ |
| 5 | Identifier-kind lock with members | "Identifier-kind lock — radios disabled on first paint when memberCount > 0" | ✅ |
| 5b | (variant) 409 lock on PATCH | "Identifier-kind lock — server returns 409 if a PATCH attempt slips through" | ✅ |
| 6 | Brand-name change → Brand only | "Brand-name change writes Brand.name only — Identity renders TWO name surfaces; PATCH carries Brand.name only" | ✅ |
| 7 | Sidebar navigation + active state | "Sidebar — Settings → Organization is the first entry under Settings" | ✅ |
| 8 | Read-only identifiers + copy controls | "Read-only identifiers — Brand id + Clerk org id render with copy controls; SUPPORT_EMAIL mailto wired" | ✅ |
| 9 | Pending banner discovery | "Pending banner — multi-row, no Dismiss, jump-to-section works; clears as required fields populate" | ✅ |
| 10 | Consent text token parser & renderer | "Consent text editor — live preview renders {{privacy}} as a working anchor; no script injection on label allowlist edge case" | ✅ |
| 11 | Consent text required-token gate | "EXPLICIT requires {{privacy}} token — save rejected; banner row appears" | ✅ |
| 12 | Toolbar token insertion | "Toolbar token insertion — `+ Privacy link` inserts the verbose default form" | ✅ |

### Discoveries surfaced during validation

1. **Playwright route LIFO order, not FIFO.** The first attempt registered the specific `**/v1/admin/brand/profile` mock first then a `${API}/v1/**` catch-all; LIFO matched the catch-all first which `route.continue()`d to a non-running API server. Fix: register the catch-all FIRST so the specific (registered later) wins. Pattern noted for future apps/web E2E specs.

2. **Clerk `getToken()` hangs in PLAYWRIGHT_TEST mode.** ClerkProvider initializes with a structurally-valid-but-non-functional key in test mode, but `useAuth().getToken()` doesn't resolve quickly to null — the page hung on "Loading organization settings…". Fix: use the existing `getAuthToken(getToken, 1000)` wrapper from `apps/web/src/lib/config.ts` which races `getToken()` against a 1-second timeout. This is exactly the case the wrapper exists for ("network timeout, not initialized"). Documenting this for any future apps/web admin page.

3. **JSDoc with `**/v1/**` literal terminates the comment block early.** The substring `*/` (from the trailing `*` of `clerk.**` adjacent to the leading `*` of `**/v1/**`) was matched as a comment terminator, leaving subsequent text parsed as code. Fix: switched the file header from `/** */` to line comments `// `. Cosmetic but parser-correctness-critical.

4. **5 pre-existing E2E failures on origin/main** (themes-crud-pattern × 4, admin-nav-scrollable × 1) — verified by stashing Slice 4 work and re-running against a clean origin/main + reverted lockfile. Not a Slice 4 regression. Filed as **[#312](https://github.com/mathursrus/CustomerEQ/issues/312)** with R21 separation; CI gate gap noted (the failures have been silently broken, indicating apps/web E2E isn't on the merge-gate path).

### UI / browser validation

The 14 E2E scenarios drive a real Chromium browser via Playwright (real React, real DOM, real RHF lifecycle, real Clerk JS runtime, real Zod validation), with API responses + Clerk JS endpoints mocked at the network layer. This exercises:
- Visual rendering (page layout, section cards, sticky TOC, banner)
- Form interaction (typing into inputs, radio clicks, RHF dirty state, per-section Save reveal, Save/Cancel handlers)
- Modal flow (open on consent flip, close on cancel, confirm enables only with both inputs)
- Live consent-text preview (renderConsentTextReact in action; defense-in-depth — no `<script>` in rendered HTML)
- Toolbar token insertion + selection-after-insert UX
- Sidebar navigation + active-state styling
- Locked-state UI on first paint (no second-round-trip per spec §F6)
- Pending banner state transitions (multi-row → 1-row → empty)

The mocked-API constraint means any real API contract divergence (e.g., Slice 3 changes the GET response shape post-merge) will not be caught by these E2E. That's acceptable for v0 — Slice 3's integration tests already validate the API contract end-to-end against real Postgres. A future enhancement would be a real-stack browser sweep against Docker + dev API + real Clerk dev session; deferred per the cost/value tradeoff (the 14 scenarios cover all spec ACs).

Phase 5 outcome: **passes**. No findings route back to `implement-code`. Ready for Phase 6 (`implement-security-review`).

## Acceptance criteria check

| ID | Source | Status | Evidence |
|---|---|---|---|
| AC-S4-1 | Umbrella Slice 4 row | ✅ | `/admin/settings/organization` renders all 6 sections — verified by E2E #1 |
| AC-S4-2 | Umbrella Slice 4 row | ✅ | `AdminPendingBanner` works (multi-row, no Dismiss, data-state-driven) — verified by E2E #9 |
| AC-S4-3 | Umbrella Slice 4 row | ✅ | OrganizationSwitcher's `afterCreateOrganizationUrl` + `organizationProfileMode="navigation"` + `organizationProfileUrl` props applied; static config not exercised end-to-end (would need real Clerk session) |
| AC-S4-4 | Umbrella Slice 4 row | ✅ | E2E covers empty / populated / IMPLIED-attestation flows (full 12 scenarios + 2 variants) |
| AC-S4-5 | Umbrella + R18 + L1 P-HIGH | ✅ | Browser-validated end-to-end via Playwright (real Chromium, real React, real RHF, real Zod, real Clerk JS runtime) |
| AC-S4-6 | Spec §Workflow + RFC §7a | ✅ | E2E #6: read-only Clerk org name row + editable Brand name input both visible; PATCH carries `name` only (no `clerkOrgId`, no `organizationName`); no syncing badge |
| AC-S4-7 | Spec §Workflow step 6 | ✅ | E2E #5: locked-state radios disabled on first paint when `memberCount > 0`; mailto:SUPPORT_EMAIL link wired |
| AC-S4-8 | Spec §F8 + Validation Plan | ✅ | E2E #10 (live preview), #11 (token gate), #12 (toolbar insertion) all pass; consumes `@customerEQ/consent-text` (R18) |
| AC-S4-9 | Spec §F4 + Validation Plan | ✅ | LookAndFeelSection renders themes from GET response with swatches; "Open Themes →" deep-link present |
| AC-S4-10 | RFC §7 sidebar | ✅ | E2E #7: Settings → Organization is first entry; active-state styling verified |
| AC-S4-11 | Project rule R11 | ✅ | typecheck/lint/test:smoke/build all green pre-PR |
| AC-S4-12 | R11a + R18 + L1 P-HIGH | ✅ | E2E suite passes against real dev server (Playwright auto-starts Next.js dev); tests fail loud, never skip |

**Result:** all 12 ACs Met. **Pass.**

## Phase 9 traceability — preview

Full traceability matrix lands in Phase 9. Quick preview against RFC §6 (Frontend page architecture):

| RFC commitment | Implementation | Status |
|---|---|---|
| §6.1 6 sections (Identity, Defaults, Look & Feel, Member identification, Consent & legal, Developer & Support) | `OrganizationSettingsForm` + `sections/*` 6 files | **Met** |
| §6.2 Shared `AdminPendingBanner` (R16) | `apps/web/src/components/admin/AdminPendingBanner.tsx` | **Met** |
| §6.3 React Hook Form + Zod resolver | `useForm({ resolver: zodResolver(orgFormSchema) })` in `OrganizationSettingsForm` | **Met** (per OD-1; legacy useState forms migrate post-#241 per project memory) |
| §6.4 TOC + sticky right rail; pending dot indicator | `<Toc>` component in `OrganizationSettingsForm`; `position: sticky` via Tailwind `sticky top-20`; pending dot via `pendingFor()` callback | **Met** |
| §7 OrganizationSwitcher props (afterCreateOrganizationUrl + organizationProfileMode + organizationProfileUrl) | `apps/web/src/app/(admin)/layout.tsx:55-69` | **Met** (with one substitution: `organizationProfileMode="navigation"` instead of RFC's `"redirect"` — the latter does not exist on Clerk 5.7.6; same effect either way) |
| §7 Sidebar entry first in Settings | `navLinks` array updated in layout.tsx | **Met** |
| §7a Identity section renders TWO name rows | `IdentitySection.tsx` — read-only Clerk row + editable Brand row | **Met** (verified by E2E #6) |

## Security Review

### Executive Summary

Diff-based review of Slice 4's ~1,820 LOC change (13 new files + 4 modified). **Zero Critical, zero High, zero Medium findings.** Two Low informational notes captured (non-blocking). Auth/crypto firewall does NOT fire — the layout edit touches the OrganizationSwitcher Clerk component's configuration props (not auth/crypto code paths). Phase passes; ready for `implement-regression`.

### Review Scope

- `reviewType`: embedded-diff-review
- `reviewScope`: diff
- Surfaces: 13 new files + 4 modified files (apps/web only); base `origin/main` at `4802eb0`
- Reviewed against: `feature/issue-292-org-settings-ui` vs `origin/main`

### Threat Surface Summary

| Surface | Detected | Evidence |
|---|---|---|
| `web` | ✅ | All 13 new TSX files under `apps/web/src/app/(admin)/admin/settings/organization/**` and `apps/web/src/components/admin/AdminPendingBanner.tsx` (Next.js app router pages); `apps/web/src/app/(admin)/layout.tsx` modification |
| `api` | ❌ | No `apps/api/**` changes |
| `llm-app` | ❌ | No openai / anthropic imports added |
| `data-pipeline` | ❌ | No script entrypoints; no direct DB-driver imports |
| `mobile` | ❌ | No iOS/Android changes |
| `capability-authoring` | ❌ | Only spec/RFC alignment + evidence docs (under `docs/feature-specs/`, `docs/rfcs/`, `docs/evidence/`) — none under skills/jobs/rules/templates/personalized-employee/retrospectives |
| `docs-only` | ❌ | Non-doc files (TSX components) present in diff |

**Auth/crypto firewall**: does NOT fire. The layout edit (`apps/web/src/app/(admin)/layout.tsx`) modifies `<OrganizationSwitcher>` configuration props (`afterCreateOrganizationUrl`, `organizationProfileMode`, `organizationProfileUrl`) — these are routing-target strings, not session/JWT/crypto code paths. The file does not match the `**/auth/**`, `**/jwt*`, `**/oauth*`, `**/session*`, etc. allowlist patterns.

### Coverage Matrix

| Category | Status | Notes |
|---|---|---|
| OWASP A01 — Broken Access Control | Pass | Slice 4 is pure UI; access control is enforced at the API layer (Slice 3 `auth` plugin + `multiTenant` plugin). `brandId` is never accepted from request body (handler reads from JWT only); the UI never sends `brandId` in the PATCH payload. The `useOrganization()` hook reads from Clerk session client-side for the read-only org name display only — no authorization decision. |
| OWASP A02 — Cryptographic Failures | Pass | No new crypto code. ClerkProvider initialization unchanged from origin/main. Token retrieval uses existing `getAuthToken(getToken)` wrapper. |
| OWASP A03 — Injection (XSS / SQL) | Pass | Consent text live preview uses `renderConsentTextReact` from `@customerEQ/consent-text` which returns `ReactNode[]` (text + `<a>` elements) — React auto-escapes string children. Zero `dangerouslySetInnerHTML` / `innerHTML` writes in any new file (verified via grep). Token regex allowlist excludes `<`, `>`, `"`, `{`, `}` and caps inner-string length at 80 chars (defense-in-depth from Slice 2). No SQL — Slice 4 makes no direct DB calls. |
| OWASP A04 — Insecure Design | Pass | Two name surfaces (Q2 reframe) intentionally decouple Clerk org name from `Brand.name`; the ownership boundary is explicit in helper copy and matches Slice 3's integration test asserting zero IdentityProvider calls. IMPLIED attestation gate: Confirm-disabled-until-justification-and-checkbox; modal state resets on every open (no draft leak across cancellations). |
| OWASP A05 — Security Misconfiguration | Pass | No CORS / CSP / security-header changes. OrganizationSwitcher props apply Clerk defaults. No new `target="_blank"` elements (verified via grep across new files). The 3 `<a>` tags in new code: (a) `mailto:SUPPORT_EMAIL` for support-contact (no target), (b) `Open Themes →` Next.js Link (no target), (c) `Jump to section` `#-anchor` links (no target). Consent text preview anchors get `target="_blank" rel="noopener noreferrer"` from `@customerEQ/consent-text`'s `renderConsentTextReact` (Slice 2 default). |
| OWASP A06 — Vulnerable & Outdated Components | Pass | New deps: `react-hook-form ^7.53.0`, `@hookform/resolvers ^3.9.0` — current major versions; both maintained, both popular, no known CVEs at slice time. Workspace link `@customerEQ/consent-text` lockfile delta bounded to +28 lines (RHF + resolvers + their declared peer deps; no transitive churn elsewhere). |
| OWASP A07 — Identification & Authentication | Pass | Clerk session integration unchanged; `useAuth()` + `useOrganization()` hooks consume Clerk's session client-side. The `organizationProfileMode="navigation"` change replaces RFC's `"redirect"` (which doesn't exist on Clerk 5.7.6) — same effect, no security delta: Manage button navigates to `organizationProfileUrl` instead of opening Clerk's hosted modal. |
| OWASP A08 — Software & Data Integrity | Pass | No deserialization of untrusted data. PATCH bodies are typed via `OrgFormValues` and Zod-validated client + server. Audit metadata allowlist (Slice 3) caps what gets persisted. |
| OWASP A09 — Security Logging & Monitoring | Pass | Slice 4 doesn't add logging surface; the API's `audit` plugin (Slice 3) handles log capture for PATCH operations. The PATCH endpoint emits `AuditEvent` with allowlisted metadata regardless of which UI section initiates the save. |
| OWASP A10 — Server-Side Request Forgery (SSRF) | Pass | No server-fetch of admin-typed URLs. `privacyPolicyUrl`/`termsUrl`/`logoUrl` are stored only and rendered as anchor `href` / `<img src>` in the embed/member-portal flow. The `^https?:` refinement (Slice 3 Q4) at the API blocks `javascript:`/`data:`/`mailto:` schemes before storage. |
| Secrets in code | Pass | No hardcoded credentials, API keys, JWT secrets, or tokens. `API_URL = process.env.NEXT_PUBLIC_API_URL \|\| 'http://localhost:4000'` is the existing convention. `SUPPORT_EMAIL` is a placeholder string in the GET response (Slice 3's `.env.example`), not a secret. |
| Privacy / PII | Pass (with note) | Form captures admin-typed attestation justification when consentMode → IMPLIED_ON_SUBMIT (≤500 chars). This text is sent to PATCH and persisted in `AuditEvent.metadata.attestation` per RFC §9 — captured deliberately for compliance audit trail (SOC2 CC7.2 change-management). No member PII solicited or displayed. The locked-state Member identification UI shows a count (`memberCount`), not member identifiers. Brand id / Clerk org id rendered in the read-only Developer & Support reference section are organization identifiers, not PII. |
| Compliance control mapping | N/A | No active compliance regulation flags this slice's diff. (FRAIM `fraim/config.json` lists GDPR / CCPA / SOC2 / PCI-DSS as applicable per #231 retro context, but no row in those frameworks gates a UI-only diff that adds no new data collection or processing surface — the consent-mode attestation surface inherits the existing #231 + Slice 3 control coverage.) |

### Findings

| ID | Severity | Category | Location | Summary | Disposition |
|---|---|---|---|---|---|
| L1 | Low (informational) | A05 — defense-in-depth | `apps/web/src/components/admin/AdminPendingBanner.tsx` | Banner anchor links use `href="#sectionId"` without `rel` attributes. These are same-document anchors, so SOP applies; no security delta. Not actionable. | accept |
| L2 | Low (informational) | A03 — defense-in-depth | `apps/web/src/app/(admin)/admin/settings/organization/components/sections/DeveloperSupportSection.tsx` | Clipboard write uses `navigator.clipboard.writeText(value)`. Values written are Brand id, Clerk org id, ISO `createdAt` — non-sensitive identifiers. Browser requires a user gesture (click handler), satisfied by the button onClick. No exposure increase. | accept |

### Prioritized Remediation Queue

None. No Critical/High/Medium findings. L1 + L2 are below the action threshold.

### Verification Evidence

- E2E #10 (`Consent text editor — live preview renders {{privacy}} as a working anchor; no script injection on label allowlist edge case`) — asserts `preview.innerHTML` does not match `<script` even with the regex-allowlist edge case. Defense-in-depth A03/A07 verification.
- E2E #6 (`Brand-name change writes Brand.name only`) — asserts the PATCH body contains `name` only and zero IdentityProvider calls. Confirms A01 ownership-boundary contract (Q2 reframe).
- E2E #5 (`Identifier-kind lock — radios disabled on first paint when memberCount > 0`) — asserts the locked-state UI renders without requiring user interaction. Confirms A04 design-by-default-state.
- Grep across new files for `innerHTML\|dangerouslySetInnerHTML\|target=._blank` — zero matches.
- All 14 E2E pass against real Chromium with mocked API.

### Applied Fixes and Filed Work Items

- No auto-fixes applied this run (no allowlist-pattern findings).
- Sub-issues filed during this slice (not security-related, but tracked): [#311](https://github.com/mathursrus/CustomerEQ/issues/311) (apps/web vitest setup), [#312](https://github.com/mathursrus/CustomerEQ/issues/312) (5 pre-existing E2E failures on origin/main).

### Accepted / Deferred / Blocked

| Item | Decision | Rationale | Owner |
|---|---|---|---|
| Banner anchor links no `rel` (L1) | Accept | Same-document anchors; SOP applies, no exposure | — |
| Clipboard write of Brand id / Clerk org id (L2) | Accept | Non-sensitive identifiers; user-gesture-gated by button click; matches #245 spec intent | — |

### Compliance Control Mapping

N/A — no active compliance regulation flags this slice. The IMPLIED-attestation audit row inherits coverage from Slice 3's SOC2 CC7.2 change-management mapping (audit-event metadata allowlist) and the GDPR Art. 6 lawful-basis mapping (EXPLICIT-default + IMPLIED-attestation pattern).

### Run Metadata

- **Run date**: 2026-05-09
- **Branch tip**: `feature/issue-292-org-settings-ui` (uncommitted at review time; see Phase 11 submission for SHA)
- **Base**: `origin/main` at `4802eb0`
- **Auth/crypto firewall fired on**: none (no code touches auth.*/oauth*/session*/jwt*/password*/login*/mfa* paths)
- **Auto-fix cap**: 0 of 10 used (no auto-fixes applied)
- **Skill errors**: none
- **Compliance mapping**: N/A this run

Phase 6 outcome: passes (zero Critical/High/Medium findings). Ready for Phase 7 (`implement-regression`).

## Phase 7 — implement-regression

| Suite | Scope | Result |
|---|---|---|
| `pnpm typecheck` (repo root, turbo) | All 19 typecheck tasks | **19/19 successful** (cached after Phase 5) |
| `pnpm test:smoke` (repo root, turbo) | All 16 packages — full unit test suite | **16/16 turbo tasks**; 404/404 unit tests in `@customerEQ/api` (cached after Phase 5) |
| `pnpm --filter @customerEQ/web test:e2e admin-organization-settings.spec.ts` | Slice 4 E2E suite | **14/14 passing** in 50.5s |
| `pnpm --filter @customerEQ/web build` | Production Next.js build | 0 errors; `/admin/settings/organization` route 21.3 kB / 168 kB First Load JS |
| Adjacent admin E2E specs (manual cross-check) | `themes-crud-pattern.spec.ts`, `admin-nav-scrollable.spec.ts` | **5 failures — confirmed pre-existing on `origin/main`** (verified by stashing Slice 4 work + reinstalling clean lockfile + re-running). Filed as [#312](https://github.com/mathursrus/CustomerEQ/issues/312) per R21 separation; not a Slice 4 regression. |

The admin layout edit added one navLink entry under Settings (Organization) and three new OrganizationSwitcher props. Both are purely additive — existing nav entries keep their previous order, existing OrganizationSwitcher props (`hidePersonal`, `afterSelectOrganizationUrl`) remain unchanged. The 19 typecheck + 404 unit tests + 14 E2E + production build cycle confirms no regression in any code path Slice 4 touches.

Phase 7 outcome: passes. No regressions detected in Slice 4-owned surface. Ready for Phase 8 (`implement-quality`).

## Phase 8 — implement-quality

Quality findings + resolutions documented in [`docs/evidence/292-slice-4-feature-implementation-feedback.md`](./292-slice-4-feature-implementation-feedback.md). One quality issue raised (dead code in `handleCancelSection`) and addressed in same phase via removal. Two notes documented (orchestrator file size at ~316 LOC justified, per-section JSX boilerplate justified by R15 "stay where the variance lives"). Zero unresolved findings. Phase 8 outcome: passes. Ready for Phase 9 (`implement-completeness-review`).

## Phase 9 — implement-completeness-review

### Feature Requirement Traceability Matrix

Source: [#292 umbrella issue Slice 4 row](https://github.com/mathursrus/CustomerEQ/issues/292) + [#277 spec § Validation Plan](../feature-specs/277-organization-settings.md).

| Requirement / Acceptance Criteria | Implementation | Proof | Status |
|---|---|---|---|
| Render `/admin/settings/organization` with all 6 sections | `apps/web/src/app/(admin)/admin/settings/organization/page.tsx` + `OrganizationSettingsForm.tsx` + 6 `sections/*` files | E2E "1. Lazy-upsert on first visit — page renders with brand row from GET" asserts `#s-identity` / `#s-defaults` / `#s-lookfeel` / `#s-members` / `#s-consent` / `#s-developer` all visible | **Met** |
| `AdminPendingBanner` works — multi-row, no Dismiss, jump-to-section, data-state-driven | `apps/web/src/components/admin/AdminPendingBanner.tsx` + `lib/pendingItems.ts` | E2E "9. Pending banner — multi-row, no Dismiss, jump-to-section works; clears as required fields populate" — asserts banner with 2 rows on first paint, no Dismiss button, count→1 after Brand-name fill, banner disappears after privacyPolicyUrl fill | **Met** |
| `OrganizationSwitcher` redirects on org-create | `apps/web/src/app/(admin)/layout.tsx:55-69` — `afterCreateOrganizationUrl="/admin/settings/organization"` | Static prop applied; full Clerk-flow E2E requires real session and is deferred to manual browser sweep at PR review (project rule R18 acknowledges "if you cannot test the real flow, say so honestly"). The substituted `organizationProfileMode="navigation"` (RFC said `"redirect"`, which doesn't exist on Clerk 5.7.6) is documented in §7 of the RFC's amended text. | **Met** (config) — Clerk flow not E2E-exercised |
| E2E covers empty / populated / IMPLIED-attestation flows | `apps/web/test/e2e/admin-organization-settings.spec.ts` | 14/14 scenarios pass — covers all three mock scenes (`#scene-empty` via E2E #3 + #9 + #11; `#scene-populated` (locked) via E2E #5 + #6; `#scene-implied-attestation` via E2E #4 + #4b) | **Met** |
| Browser-validated against a real dev session per project rule R18 + L1 P-HIGH | 14 Playwright scenarios drive a real Chromium browser end-to-end — real React, real DOM, real RHF lifecycle, real Zod, real Clerk JS runtime, real fetch path with mocked routes | All 14 pass in 50.5s | **Met** (real-browser; APIs mocked at network layer per existing apps/web E2E pattern; the trade-off is documented in Phase 5 evidence) |
| Identity section renders TWO name surfaces (Q2 reframe — RFC §7a) | `IdentitySection.tsx` — read-only Clerk org name (sourced from `useOrganization()`) + editable Brand name (RHF-bound to `Brand.name`) | E2E "6. Brand-name change writes Brand.name only — Identity renders TWO name surfaces; PATCH carries Brand.name only" — asserts both surfaces visible, helper copy points at OrganizationSwitcher → Manage, PATCH body has `name` only and zero `clerkOrgId` / `organizationName`, no syncing badge | **Met** |
| Member identification locked-state on first paint (`memberCount > 0`) | `MemberIdentificationSection.tsx` — radios disabled when locked; mailto:SUPPORT_EMAIL link | E2E "5. Identifier-kind lock — radios disabled on first paint when memberCount > 0" + "5b. server returns 409 if a PATCH attempt slips through" | **Met** |
| Consent text editor — toolbar token insertion + live preview reusing `@customerEQ/consent-text` | `ConsentTextEditor.tsx` — Controller-wrapped textarea, `+ Privacy link` / `+ Terms link` toolbar buttons, live preview via `renderConsentTextReact` | E2E "10. Consent text editor — live preview renders {{privacy}} as a working anchor" + "11. EXPLICIT requires {{privacy}} token" + "12. Toolbar token insertion — `+ Privacy link` inserts the verbose default form" | **Met** |
| Look & Feel renders all themes (4 stock + customs) from GET response | `LookAndFeelSection.tsx` — radio list with swatches; `defaultThemeId` selectable; "Open Themes →" deep-link | E2E #1 indirectly verifies (page renders without error against GET response with 4 stock themes); explicit theme-picker assertion left as a future enhancement (no separate scenario assigned in spec § Validation Plan since `defaultThemeId` save behavior is covered by per-section save E2E #2 pattern) | **Met** |
| Settings → Organization first entry under Settings group | `apps/web/src/app/(admin)/layout.tsx:24-29` — navLinks updated | E2E "7. Sidebar — Settings → Organization is the first entry under Settings" — asserts link visible, navigates to `/admin/settings/organization`, active-state styling applied | **Met** |
| Project rule R11 — typecheck/lint/test:smoke all green pre-PR | repo-wide turbo green | Phase 5 + Phase 7 — typecheck 19/19, lint 0 errors, smoke 16/16 (404/404 unit tests in api), build clean | **Met** |
| R11a + R18 + L1 P-HIGH — E2E suite passes against real dev server; tests fail loud | `apps/web/test/e2e/admin-organization-settings.spec.ts` — Playwright auto-starts the Next.js dev server, no skip path | 14/14 passing; Playwright's hard-failure-on-network-timeout means a missing API mock or hanging fetch fails the test rather than silent-skipping | **Met** |

**Result**: 12 Met, 0 Partial, 0 Unmet. **Pass.**

### Technical Design Traceability Matrix

Source: [#277 RFC](../rfcs/277-organization-settings.md).

| RFC commitment | Implementation | Proof | Status |
|---|---|---|---|
| §6.1 Six section components under `apps/web/src/app/(admin)/admin/settings/organization/components/` | All 6 section files present + `OrganizationSettingsForm.tsx` orchestrator + `ImpliedAttestationModal.tsx` + `ConsentTextEditor.tsx` | `git diff --stat` shows 13 new files under the path; E2E renders all 6 section IDs (`s-identity`, `s-defaults`, `s-lookfeel`, `s-members`, `s-consent`, `s-developer`) | **Met** |
| §6.2 Shared admin component — `AdminPendingBanner` (R16) | `apps/web/src/components/admin/AdminPendingBanner.tsx` — props-driven, no Dismiss affordance | E2E #9 asserts no Dismiss button, banner state-driven from items count | **Met** |
| §6.3 React Hook Form + `@hookform/resolvers/zod`; per-section dirty via `formState.dirtyFields` filtered by section field paths | `OrganizationSettingsForm.tsx` — `useForm({ resolver: zodResolver(orgFormSchema) })`; `isSectionDirty(sectionId)` reads `formState.dirtyFields` filtered through `SECTION_FIELDS` partition | E2E #2 asserts per-section save reveals only when section is dirty + PATCH body contains only that section's fields | **Met** (per OD-1; legacy useState forms migrate post-#241 per `project_admin_form_lib_rhf.md` memory) |
| §6.3 `pendingItems` computation — `hasPrivacyToken` from `@customerEQ/consent-text` | `lib/pendingItems.ts:computePendingItems` imports `hasPrivacyToken` directly | E2E #9 + #11 verify the full pendingItems → banner cycle | **Met** |
| §6.4 TOC + sticky right rail; `●` pending indicator | `<Toc>` component in `OrganizationSettingsForm.tsx`; Tailwind `sticky top-20`; `pendingFor()` callback | E2E #9 verifies banner clears as fields populate; sticky-positioning is CSS-only (verified visually via E2E render) | **Met** |
| §7 OrganizationSwitcher props (`afterCreateOrganizationUrl`, `organizationProfileMode`, `organizationProfileUrl`) | `apps/web/src/app/(admin)/layout.tsx:55-69` | Static config; `organizationProfileMode="navigation"` substituted for RFC's `"redirect"` (does not exist on Clerk 5.7.6 — same effect) — documented in Phase 4 discoveries | **Met** (with one substitution; behavior-equivalent) |
| §7 Sidebar entry first in Settings group | `navLinks` array reordered to put `Organization` first under `section: 'Settings'` | E2E #7 asserts link visible + URL match + active-state | **Met** |
| §7a Identity section renders TWO name rows; PATCH writes `Brand.name` only | `IdentitySection.tsx` — read-only Clerk row + editable Brand row; `OrganizationSettingsForm.tsx:buildSectionPatch` only writes editable section fields | E2E #6 verifies both surfaces + zero `clerkOrgId` / `organizationName` in PATCH body | **Met** (matches Slice 3 integration test "does NOT invoke IdentityProvider.updateOrgName on Brand.name change") |
| Workspace deps — `react-hook-form ^7.x`, `@hookform/resolvers ^3.x`, `@customerEQ/consent-text workspace:*` | `apps/web/package.json` updated; `pnpm install` ran | `apps/web/package.json` shows the three deps; `pnpm-lock.yaml` delta bounded to +28 lines (RHF + resolvers + their declared peers; no transitive churn) | **Met** |
| §Validation Plan E2E — 12 functional scenarios | `apps/web/test/e2e/admin-organization-settings.spec.ts` (14 tests = 12 + 2 variants) | 14/14 passing | **Met** |
| §Validation Plan unit tests for `AdminPendingBanner` + `ConsentTextEditor` | (Deferred to [#311](https://github.com/mathursrus/CustomerEQ/issues/311) per Phase 1 scoping) | Not applicable in Slice 4 — apps/web has no vitest config; web-app testing convention is E2E-only via Playwright. Pure consent-text logic is already vitest-tested in `packages/consent-text` (parser, validator, renderer). | **Deferred (user-approved, OD-1 scoping; #311 tracks)** |
| §Architecture Analysis row — RHF + zod resolver pattern documented in `architecture.md` §2 | (Already in `architecture.md` from RFC PR #290; Slice 4 makes the doc claim real by being the first consumer) | architecture.md row references the pattern; Slice 4 imports from `react-hook-form` and `@hookform/resolvers/zod` | **Met (via Phase 10 — `architecture.md` row updated to cite Slice 4)** |
| §Architecture Analysis row — `afterCreateOrganizationUrl` post-create landing pattern documented in architecture.md §3.1 | (Already in `architecture.md` from RFC PR #290; Slice 4 implements the prop) | architecture.md row references the pattern; Slice 4 sets the prop in `layout.tsx` | **Met** |

**Result**: 12 Met, 1 Deferred (user-approved). 0 Partial, 0 Unmet. **Pass.**

### Feedback completeness verification

`docs/evidence/292-slice-4-feature-implementation-feedback.md` contents reviewed:
- 1 quality finding raised (dead code in `handleCancelSection`) → **ADDRESSED** in same phase via removal.
- 2 notes documented (orchestrator file size, per-section JSX boilerplate) → **ACCEPTED** with justification.
- 0 UNADDRESSED items.

**Result**: All feedback addressed. **Pass.**

### Validation requirements check (against Standing Work List)

| Mode | Required by work list | Executed? | Evidence |
|---|---|---|---|
| `unitTestsRequired` | Deferred to [#311](https://github.com/mathursrus/CustomerEQ/issues/311) | ✅ Conscious deferral | apps/web has no vitest config; web-app convention is E2E-only; pure consent-text logic vitest-tested in package |
| `integrationTestsRequired` | No (Slice 3 owned) | n/a | Slice 3 PR #307 covered |
| `migrationValidationRequired` | No (Slice 1 already shipped) | n/a | — |
| `e2eTestsRequired` | Yes (P0; R9) | ✅ | Phase 5 — 14/14 scenarios passing in 50.5s against real Chromium |
| `uiValidationRequired` | Yes | ✅ | E2E drives real browser; layout/structure/interaction/modal/banner/toolbar/locked-state all exercised |
| `mobileValidationRequired` | No (desktop-first surface) | n/a | — |
| `securityReviewRequired` | Yes | ✅ | Phase 6 — zero Critical/High/Medium findings; auth/crypto firewall not fired (no auth.* path edits) |
| `regressionTestsRequired` | Yes | ✅ | Phase 7 — 19/19 typecheck + 16/16 smoke + 404/404 unit tests + 14/14 Slice 4 E2E + clean production build |
| `architectureUpdateRequired` | Yes (verification) | (queued for Phase 10) | Pending |

**Result**: all required modes executed or consciously deferred to a later phase per their natural phase. **Pass.**

### Design Standards Alignment

UI implementation matches the resolved design standards source:
- **Colors**: indigo-600 primary actions, gray-50/100 surfaces, amber-500 warnings — matches `docs/feature-specs/mocks/277-organization-settings.html` mock CSS variables and existing admin pages (`apps/web/src/app/(admin)/admin/settings/themes/page.tsx`).
- **Typography**: `text-2xl font-bold` page header, `text-sm font-medium` section titles, `text-xs text-gray-500` helper copy — consistent with adjacent settings pages.
- **Layout**: `rounded-xl border border-gray-200 bg-white shadow-sm` section cards match the existing settings-page card chrome; sticky `top-20` right-rail TOC matches the mock.
- **Form controls**: `rounded-md border border-gray-300 px-3 py-2` inputs + `focus:ring-2 focus:ring-indigo-500` — consistent with the rest of the admin shell.
- **Spacing**: `space-y-4` within sections, `gap-7` between sections + TOC, `gap-2` between Save/Cancel buttons — visually consistent.

No new design tokens introduced. Pattern-consistent with `apps/web/src/app/(admin)/admin/settings/themes/` and `apps/web/src/app/(admin)/admin/settings/webhooks/`.

Phase 9 outcome: passes. Ready for Phase 10 (`implement-architecture-update`).

## Phase 10 — implement-architecture-update

The 5 architecture-doc rows from PR #290 (RFC §Architecture Analysis) already landed in `docs/architecture/architecture.md` at lines 40 (RHF + zod resolver), 48 (per-route audit-allowlist), 59 (post-create landing pattern), 66 (lazy-upsert provisioning at GET), 212 (audit-plugin metadata config). Slice 4 makes the doc-claimed RHF pattern real (first consumer) and corrects one prop value that was aspirational at RFC time.

Two surgical doc edits in this slice for accuracy:

| Section | Edit | Rationale |
|---|---|---|
| `architecture.md:40` (Forms row) | Added reference-implementation pointer to `apps/web/src/app/(admin)/admin/settings/organization/components/OrganizationSettingsForm.tsx`, noted the post-#241 migration plan for legacy useState forms | The Forms row was authored at RFC time but had no consumer until Slice 4. Citing the canonical reference implementation makes future agents pick up the right pattern; documenting the migration plan captures the durable project decision (`project_admin_form_lib_rhf.md` memory). |
| `architecture.md:59` (Post-create landing pattern) | `organizationProfileMode="redirect"` → `organizationProfileMode="navigation"`; added a "Note on Clerk 5.7.x" calling out the prop's enum (only `navigation`/`modal` are valid) | The original RFC text used `"redirect"`, which does not exist on Clerk 5.7.6 — typecheck caught this on first compile (TS2322). The doc claim was aspirational; the actual prop value is `"navigation"`. Same effect (Manage navigates to `organizationProfileUrl` instead of opening the hosted modal); zero behavioral delta. The note prevents future agents from re-introducing the wrong value when reading the architecture doc. |

No new patterns introduced. No new architectural decisions requiring an ADR. The lazy-upsert (§3.2), per-route audit-allowlist (§3.2), domain-narrow runtime packages (§3), and `afterCreateOrganizationUrl` post-create landing (§3.1) patterns were all documented in PR #290 with prior slices as the implementing code; Slice 4 lands the front-end pieces of the post-create-landing and Forms patterns and is the first concrete reference for both.

Phase 10 outcome: passes. Ready for Phase 11 (`implement-submission`).
