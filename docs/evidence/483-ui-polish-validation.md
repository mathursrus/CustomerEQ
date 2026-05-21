# UI Polish Validation — Issue #483

## Scope

Issue #483 removes `organizationProfileMode="navigation"` and `organizationProfileUrl="/admin/settings/organization"` from `<OrganizationSwitcher />` in `apps/web/src/app/(admin)/layout.tsx`. The component is rendered by `@clerk/nextjs`; the fix changes which UI Clerk renders when the user clicks **Manage**, not how the OrganizationSwitcher trigger itself appears.

## Findings

| Surface | Outcome | Notes |
| --- | --- | --- |
| Admin sidebar — Organization Switcher trigger (top-left) | **No visual change.** | The trigger button is rendered entirely by Clerk's `<OrganizationSwitcher />`. The two removed props only affect what happens *after* a click — they do not affect the trigger's rendered DOM/styling. `appearance.elements.organizationSwitcherTrigger` is unchanged. |
| Organization Switcher dropdown menu | **No visual change** in our code. | Clerk owns the dropdown content. The Manage entry is rendered by Clerk's UI; with `organizationProfileMode` no longer overridden to "navigation", Clerk's default `"modal"` is in effect and clicking Manage opens Clerk's hosted Organization Profile modal — which Clerk also fully owns visually. No CustomerEQ-side surface changes. |
| `/admin/settings/organization` page | **No visual change.** | This route is untouched by the fix. The Identity section's read-only Organization name row, helper text ("Rename via the organization menu in the top-left → Manage"), and Brand name input continue to render exactly as before. Test scenario 6 in `admin-organization-settings.spec.ts` (asserting the helper-text regex) remains valid. |
| Sidebar navigation links | **No visual change.** | `navLinks` array (layout.tsx:8–30) untouched. `Settings → Organization` link still points at `/admin/settings/organization`. |

Severity gate: no P0 / P1 / P2 findings.

## Baseline checks (generic standards — no design-spec was scoped for this bug)

- **Overlap / clipping**: N/A — no rendered geometry changes in our DOM.
- **Spacing consistency**: N/A — `appearance.elements.rootBox` and `organizationSwitcherTrigger` are unchanged.
- **Typography hierarchy**: N/A.
- **Contrast**: N/A.
- **Focus visibility**: N/A — the trigger button keyboard affordance is unchanged.
- **Affordance discoverability**: **Improved.** Before the fix, the Manage affordance existed but led to a dead-end page (circular reference back to itself). After the fix, Manage opens the surface (Clerk's hosted modal) that admins actually need for rename + invite. This is the bug being closed, but from a polish perspective it is also a discoverability improvement — no further work needed.
- **Responsive breakpoints**: N/A — no layout dimensions changed.

## Decision

No UI polish defects introduced. No blocking findings. Phase passes.
