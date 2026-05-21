# Implement Work List — Issue #483

> Bug: `OrganizationSwitcher` → **Manage** routes to `/admin/settings/organization` (circular). Production admins cannot rename the Clerk Org or invite members.

Issue: https://github.com/mathursrus/CustomerEQ/issues/483
Branch: `feature/483-bug-org-switcher-manage-routes-to-settings-organization-circular-users-cannot-rename-org-or-invite-members`
Worktree: `C:\Github\mathursrus\CustomerEQ - Issue 483`
Type: **bug**

---

## 1. Root cause (one-paragraph)

`apps/web/src/app/(admin)/layout.tsx` (lines 57–69) configures Clerk's `<OrganizationSwitcher />` with `organizationProfileMode="navigation"` and `organizationProfileUrl="/admin/settings/organization"`. Together those props tell Clerk to route the dropdown's **Manage** action to our internal Brand-settings page instead of opening Clerk's hosted Organization Profile UI. Since Clerk's hosted profile is the *only* UI that exposes "rename organization" and "invite members," the override removes both capabilities from the admin app. The intended Brand-rollout behavior — newly-created orgs forwarding to Brand setup — is owned by a *different* prop (`afterCreateOrganizationUrl`) and is not the cause of the bug.

RFC #277 §7 / §7a documented `organizationProfileMode="redirect"` (a value that doesn't exist in Clerk 5.7.6) with the intent that admins would still find rename/invite via "Clerk's own UI affordances inside the switcher dropdown" — but in Clerk 5.x there *is* no second affordance once `organizationProfileMode` is set to "navigation". The two props were substituted to "navigation" + an internal URL during the Issue #292 Slice 4 impl (commit 90d2068), with no in-product path left to Clerk's rename UI.

## 2. Fix (single file)

`apps/web/src/app/(admin)/layout.tsx`:
- Remove `organizationProfileMode="navigation"`.
- Remove `organizationProfileUrl="/admin/settings/organization"`.
- Keep `afterCreateOrganizationUrl="/admin/settings/organization"` (preserves first-run forward to Brand setup — the Issue #292 contract).
- Keep `afterSelectOrganizationUrl="/admin/members"` (unchanged returning-admin landing).
- Keep `hidePersonal` and `appearance` (unchanged).

Result: Clerk's default `organizationProfileMode="modal"` takes effect; clicking **Manage** opens Clerk's hosted Organization Profile modal where rename + invite members work natively. New-org create flow is unaffected.

## 3. Files touched (≤ 15 — single-file fix; no split required)

| Path | Change |
| --- | --- |
| `apps/web/src/app/(admin)/layout.tsx` | Remove 2 props from `<OrganizationSwitcher />`; keep the rest. |
| `apps/web/src/app/(admin)/layout.test.tsx` | **NEW** — Vitest+RTL test that captures props passed to `<OrganizationSwitcher />` and asserts `organizationProfileMode !== 'navigation'`, no `organizationProfileUrl`, and `afterCreateOrganizationUrl === '/admin/settings/organization'`. |
| `docs/evidence/483-implement-work-list.md` | (this file) |
| `docs/evidence/483-feature-implementation-evidence.md` | Phase outputs (validate, regression, etc.) appended as phases complete. |

`apps/web/src/app/(admin)/admin/settings/organization/components/sections/IdentitySection.tsx` — helper text "Rename via the organization menu in the top-left → Manage" stays accurate after the fix (Manage now actually opens a rename surface). **No change required.**

`apps/web/test/e2e/admin-organization-settings.spec.ts` — scenario 6 line 338–341 asserts the IdentitySection helper text mentions "organization (switcher|menu).*manage" — still valid after the fix. **No change required.** No existing E2E exercises the Manage action, so no E2E test breaks.

## 4. Pattern discovery

- **Clerk mocking pattern:** existing apps/web tests mock `@clerk/nextjs` per-test via `vi.mock('@clerk/nextjs', () => ({ useAuth: ... }))`. See `apps/web/src/app/(admin)/admin/surveys/[id]/page.test.tsx:34` and `…/components/ResponseSection.test.tsx:20`. The new layout test follows that pattern but exports `OrganizationSwitcher` as a stub that records props.
- **Vitest+RTL config:** `apps/web/vitest.config.ts` is jsdom, `include: ['src/**/*.test.{ts,tsx}']`, with `vitest.setup.ts` registering jest-dom matchers. The new test must live under `apps/web/src/...` to be picked up.
- **No new constants / env vars / utilities required.** Pure prop change.
- **No architecture-doc update required** — this is a one-line behavioral correction inside a component the RFC already covers; no new pattern or boundary.

## 5. Validation Requirements

| Requirement | Required? | How |
| --- | --- | --- |
| `uiValidationRequired` | **Yes** | The bug is a routing/UX behavior in the admin layout. Per Project Rule 18, validate end-to-end in a browser: sign in, click **Manage**, confirm Clerk's modal opens; rename succeeds; invite member flow visible. |
| `mobileValidationRequired` | No | The OrganizationSwitcher renders identically across viewports; no emulator-specific behavior. |
| Unit (vitest) | **Yes** | New `apps/web/src/app/(admin)/layout.test.tsx` proves the fix without depending on a running Clerk session. |
| Integration (API) | No | No backend / API change. |
| E2E (Playwright) | **No new spec required.** | Adding an E2E that exercises Clerk's real Manage modal needs a real Clerk session (out-of-band for `PLAYWRIGHT_TEST=true` bypass). Manual browser validation per Rule 18 is the substitute and is documented in the evidence doc. Existing `admin-organization-settings.spec.ts` continues to pass unchanged. |
| Smoke gate | **Yes** | `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke` must be green before submission. |

## 6. Known deferrals / open questions

- None. The fix removes two props and adds one test. No new code paths, no migrations, no API contracts.

## 7. Acceptance criteria mapping (from Issue #483)

| AC | Where it's satisfied |
| --- | --- |
| Clicking **Manage** opens Clerk's Organization Profile UI (not `/admin/settings/organization`). | layout.tsx prop change — manual browser verification recorded in evidence doc. |
| Admin can rename the org from that UI; new name reflected in the trigger and on `/admin/settings/organization` Identity row. | Manual browser verification. `IdentitySection.tsx` already reads `useOrganization().organization.name`, so the new name flows through. |
| Admin can invite another member. | Manual browser verification — confirmed via Clerk's modal "Members" tab. |
| Creating a new org still forwards to `/admin/settings/organization`. | `afterCreateOrganizationUrl` preserved — manual browser verification. |
| `/admin/settings/organization` sidebar link still works and renders the Brand form unchanged. | No code change touches that route; existing `admin-organization-settings.spec.ts` Scenario 7 already covers the link. |
| Existing E2E coverage in `admin-organization-settings.spec.ts` still passes. | Run smoke + targeted E2E. |
