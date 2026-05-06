# Feature: Organization Settings — single source for org configuration

Issue: #277
Owner: Claude (claude-opus-4-7)
Status: ready-for-review (phase:spec-submission)

> **Closes:** #190 (brand settings page — name/logo/website/theme/size), #245 (brand/org identity surface).
> **Cross-refs:** #170 Step 1.5 (onboarding profile capture), #231 (member identifier kind, consent mode, consent text, privacy/terms URLs), #239 (Clerk-webhook-driven Brand provisioning), #44 (multi-brand-under-one-org — out of scope).

---

## Customer

A new admin who just created a Clerk organization (via signup or the in-app `OrganizationSwitcher`) and now needs to configure their CustomerEQ organization — and any returning admin who needs to revisit those settings later.

Today this admin has no surface at all to configure their org: `/admin/settings/` only contains `themes/` and `webhooks/`. Org-level fields shipped under #231 (identifier kind, consent mode, consent text, privacy / terms URLs) are presently only set via direct DB `UPDATE`. The Step 1.5 onboarding fields specified in #170 (logo, website, default theme, size category) have a capture form but no review/edit surface. The Brand id and Clerk org id required to debug Gap-1-style issues are only reachable through browser DevTools (`window.Clerk?.organization?.id`).

## Customer's Desired Outcome

> "I can find one page that shows everything CustomerEQ knows about my organization, edit any of it, and trust that what I save is what shows up to my customers and to anyone integrating my application."

Concretely:

- Reach a working `Organization` settings page on first run *without* a manual DB seed.
- See every Brand-row field that has admin-editable semantics on that one page — **no DB-only fields remain for org-level configuration**.
- Edits persist and the right downstream surfaces (member portal header, embedded survey, consent forms, embed snippets, email defaults) reflect them.
- Authorization-gated fields (IMPLIED consent, identifier-kind once members exist) cannot be changed without the gate.

## Customer Problem being solved

Org-level configuration is fragmented across three already-shipped issues (#170 onboarding capture, #231 identifier/consent backend, #245 identity surface) and one prior settings issue (#190). Each issue assumed a settings page existed; none of them built it. The result is:

1. **No first-run path** for the just-shipped #231 fields. A new admin running an EXPLICIT survey distribution silently ships the empty `consentTextDefault` because the schema has a sane default but no UI gate.
2. **DevTools as a feature surface.** A primitive-dev customer needing their Clerk org id (e.g., to apply a Gap-1-style workaround) has to open the browser inspector. This is not a real product.
3. **Field-by-field ticket churn.** Every new org-level field becomes a separate UI ticket because the page itself doesn't exist yet. Closing #277 stops the churn — new fields slot into existing sections.
4. **Skip-and-add-later from #170 Step 1.5 dead-ends.** That flow's "you can revisit `/admin/settings/brand` any time" promise is currently a 404.

## User Experience that will solve the problem

### Information architecture

A single page at **`/admin/settings/organization`** organizes every Brand-row-backed org field into five always-expanded sections with a sticky right-rail table-of-contents. Each section saves independently — only the section being edited goes "dirty" (Save / Cancel revealed); the rest of the page stays clean. No page-level commit, no wizard chrome.

| # | Section | Brand fields (current) | Notes |
|---|---|---|---|
| 1 | **Identity** | `name`, `logoUrl`, `siteDomain`, `sizeCategory` | Name change writes through `IdentityProvider.updateOrgName()` (OD-5 from #170) — DB is source of truth, provider call is best-effort with retry. Logo helper text is generic ("used on customer-facing surfaces — member portals, emails, surveys"). Size is `OrgSizeCategory` enum — optional, internal-only ("helps us optimize your experience, not shown anywhere else"). Size lives in Identity (not in a separate Defaults section) because it is admin-profile metadata, not a downstream-rendering default. |
| 2 | **Look & Feel** | `defaultThemeId` | Theme list loads **all `Theme` rows for the brand** (stock + custom), not just the four stock seeded at provisioning per #157. Top action bar deep-links to `/admin/settings/themes` ("Customize the stock themes or create a new one"). Bottom helper documents downstream surfaces ("colors and fonts will be used on all customer-facing surfaces — surveys, member portals, rich-format emails"). Section name is generic to allow future Look & Feel extensions (icons, typography, branding tokens) to slot in without a rename. |
| 3 | **Member identification** | `memberIdentifierKind` | Inline radio group, three options (EMAIL / PHONE / CUSTOMER_ID). Bottom note: "this option cannot be changed after a member is enrolled in your organization." When `Member.count(brandId) > 0`: radios render `disabled`; locked notice surfaces the current member count and a `mailto:` link to `SUPPORT_EMAIL` env var. **No self-serve change path** — managed migration only via data ops. **Not a wizard step.** |
| 4 | **Consent & legal** | `consentMode`, `consentTextDefault`, `privacyPolicyUrl`, `termsUrl` | EXPLICIT default. IMPLIED switch behind attestation modal. Consent text editor seeds with sensible default copy (not empty placeholder), exposes `+ Privacy link` and `+ Terms link` toolbar buttons that emit `{{privacy:"Privacy Policy"}}` / `{{terms:"Terms and Conditions"}}` Mustache-style tokens with optional inline label override. Live preview renders the rendered output as members will see it (with checkbox in EXPLICIT, plain paragraph in IMPLIED). Empty `consentTextDefault` or missing `{{privacy}}` token blocks EXPLICIT distribution. **Brand-wide default; surveys may override** — see API → SurveyDistribution overrides below for parser/validator/renderer reuse. |
| 5 | **Developer & Support reference** *(read-only, collapsed by default)* | `id` (Brand id), `clerkOrgId`, `createdAt`, `SUPPORT_EMAIL` *(env-derived, not on `Brand`)* | Copy-to-clipboard on each. Solves the #245 DevTools-required problem and centralizes the support contact. Section is collapsed on first render — admins do not need to interact with it for normal operation. Title and helper explicitly state "no action required from admins." Support contact resolves from a `SUPPORT_EMAIL` env var (default `support@customereq.com`); when an in-app support-ticket form lands post-MVP this becomes a deep-link to that form, with the env var as fallback. |

Each editable field row uses the standard pattern: label, helper text, control, current-state badge if it affects downstream behavior (e.g., "Attested 2026-04-30 · jordan@…" on `consentMode`), inline error, save-success toast.

The page sits as the **first item under "Settings"** in the admin sidebar, ahead of Integrations / Webhooks / Themes / Developer. The Clerk `OrganizationSwitcher`'s "Manage" link is overridden to land here. The Developer page's "Your Organization" mini-block (Brand id + name) gets an "Open settings" link to this page.

#### Required-field discovery (pending banner + TOC dots)

Required fields span sections. An admin who lands on the page, edits Identity, saves, and leaves should not need to scroll into Consent & legal to discover that Privacy URL is empty — and they should not have to learn this from a downstream survey-publish error.

The page renders a **non-dismissible action banner at the top of the main panel** that lists every empty or invalid required field across all sections, with one row per missing field. Header is generic ("Action needed — N settings incomplete") and dynamic; row copy carries the field's specific consequence and a `Jump to section →` anchor. The banner is **data-state-driven** — it has no Dismiss/Snooze button, so admins cannot acknowledge-and-ignore a real config gap. Computed client-side from form state on every change; disappears automatically when all required fields resolve.

In parallel, the **right-rail TOC marks each section with a `●` indicator** when it has one or more pending required fields. Field-level inline errors (red border + `Required.` text) render alongside, independent of the banner — the banner is the cross-section "what do I need to fix anywhere?" surface; the inline errors are the in-section "this specific field is invalid" surface.

Required-field set in v0:
- F1 `name` — always required (non-empty, trimmed, ≤120 chars)
- F8 `consentTextDefault` — required when `consentMode = EXPLICIT`; must additionally contain at least one `{{privacy}}` or `{{privacy:"…"}}` token in EXPLICIT mode
- F9 `privacyPolicyUrl` — required when `consentMode = EXPLICIT`; **also** required (regardless of consent mode) whenever the consent text contains a `{{privacy}}` token, since otherwise the rendered link is broken

The banner does not block navigation and does not disable Save buttons in unrelated sections. Admins can fix Identity, save, and leave the page even with the banner showing — the existing #231 publish-time gate still catches the survey-publish path. The banner exists to surface the gap proactively at config time, not to gate everything.

The banner + TOC-dot pattern should land in a shared admin-shell component (e.g., `packages/ui/admin-pending-banner` — exact placement is a technical-design call) so other settings-style pages with cross-section required fields (Themes, Integrations, future Compliance) can adopt it without rebuilding.

### Workflow

1. Admin signs up (or switches into a freshly created org). Clerk org is created; CustomerEQ Brand row is **lazy-upserted on the first authenticated GET against `/v1/admin/brand/profile`** (no dependency on the #239 webhook — see Provisioning below).
2. Admin lands on `/admin` post-onboarding. The first-run checklist (#170) and the existing surfaces work as before. Sidebar shows "Organization" under Settings.
3. Admin clicks **Settings → Organization**. Page renders with current Brand values. The non-dismissible action banner at the top of the main panel lists every empty/invalid required field across all sections, each with a "Jump to section" link; the right-rail TOC marks each section with pending fields via a `●` indicator. Field-level inline errors render alongside (red border + "Required." text). Sections that affect downstream behavior also show contextual badges in their headers (e.g., consent mode "Attested 2026-04-30 · jordan@…").
4. Admin edits a section (say, uploads a logo and sets a website domain). The section enters dirty state and reveals **Save / Cancel** in its footer. Clicks **Save**.
   - Server validates payload (Zod), runs the appropriate `IdentityProvider` write if applicable, persists to `Brand`, emits `AuditEvent { action: "brand.profile.updated", changedFields: [...] }`.
   - On success, an inline toast confirms; the section returns to clean state and any current-state badges update. The pending banner re-renders from form state — rows clear automatically when their required field resolves.
5. Admin attempts to switch `consentMode` from EXPLICIT to IMPLIED_ON_SUBMIT.
   - Modal: "Switching to Implied requires legal review. Confirm that you have legal sign-off and that your privacy policy discloses implied consent on survey submission."
   - Modal captures admin name (auto-populated from session), free-text justification, and a checkbox attestation. On confirm, `Brand.consentMode = IMPLIED_ON_SUBMIT` and an `AuditEvent { action: "brand.consent.mode_changed_to_implied", attestedBy, justification }` is written. The section's badge updates to show the attestation date and admin.
6. Admin attempts to change `memberIdentifierKind` from EMAIL to PHONE.
   - **If `Member.count(brandId) === 0`:** save proceeds with no extra confirmation.
   - **If members exist:** the radio control is locked (`disabled`); there is **no self-serve change path** in the UI. A neutral notice card below the radios shows the current member count and a `mailto:` link to the resolved `SUPPORT_EMAIL`: "{count}+ members are already enrolled. The member identifier kind cannot be changed once members exist. Contact CustomerEQ Support to request a managed migration." A direct `PATCH /v1/admin/brand/profile` rejects with HTTP 409 (`MEMBER_IDENTIFIER_KIND_LOCKED`) regardless of body. When data ops runs the supported migration server-side, that pathway writes `AuditEvent { action: "brand.identifier_kind_changed", before, after, memberCountAtChange, actor: "data-ops" }`. The earlier "re-type org name confirmation modal" approach is rejected — see Alternatives.

### UI mocks

High-fidelity mocks at [`./mocks/277-view.html`](./mocks/277-view.html). Scenes:

- **`#scene-empty`** — incomplete state: org `name` cleared and `privacyPolicyUrl` empty to demonstrate the multi-row pending banner with two missing required fields. Generic banner header ("Action needed — 2 settings incomplete"); each row carries its own consequence + "Jump to section" link. Right-rail TOC marks **Identity** and **Consent & legal** with `●` pending dots. Identity name input renders inline `Required.` field-level error in red. Consent text seeded with default copy containing `{{privacy}}` token; preview renders the privacy link as `broken` (dashed underline) because the URL is empty. Member identification editable (zero members enrolled). Developer & Support reference is collapsed by default.
- **`#scene-populated`** — fully-configured page. Identity section is **dirty** (Save Identity / Cancel revealed) to demonstrate the dirty-state pattern; all other sections are clean. Look & Feel shows a mix of custom + stock themes (loaded from all `Theme` rows for the brand, not just the seeded four). Member identification is **locked** (`Member.count = 1,284`) — radios `disabled`, neutral locked notice with member count + `mailto:` Contact-support button. Consent mode = IMPLIED_ON_SUBMIT with attestation badge ("Attested 2026-04-30 · jordan@…"). Consent text demonstrates a custom-label token (`{{privacy:"privacy notice"}}`) alongside a bare token (`{{terms}}` falling back to the default "Terms and Conditions" label). Preview renders the IMPLIED form (no checkbox, plain paragraph). Developer & Support reference is expanded.
- **`#scene-implied-attestation`** — modal that fires when the admin attempts to switch consent mode to IMPLIED_ON_SUBMIT. Captures attestation context (admin name read-only from session), free-text justification, and an explicit checkbox confirmation. Confirm button stays disabled until checkbox + reason are populated. Identifier-kind change has **no equivalent modal** — that pathway is locked behind `mailto:SUPPORT_EMAIL`.

### Provisioning mechanism

**Decision: lazy-upsert on first authenticated read.** Implementation: `GET /v1/admin/brand/profile` runs an `upsert` keyed by `clerkOrgId` from the verified JWT. If the row exists, it returns; if not, it creates a row with `name = jwt.org_name`, all other fields default. Same write path is idempotent for repeat reads.

Why not the #239 Clerk webhook? Both work, neither is sufficient alone:

- **Webhook** wins on background flows (e.g., a CLI hitting `/v1/members/enroll` *before* any admin has hit the web app for that org would otherwise 404).
- **Lazy-upsert** wins on simplicity and survives webhook delivery failures, which we have no SLA for from Clerk.
- Spec choice: ship lazy-upsert with #277. Track the webhook as a parallel optimization under #239 — it can land independently and its presence simply means the row is already there when the admin first navigates to Organization. No coordination required.

This explicitly resolves the open question in the issue ("webhook-driven vs. lazy-upsert vs. both"). Both, in that order: lazy-upsert is the foundation; webhook is an enhancement.

### Authorization & lock semantics

| Field | Free to edit when | Gated when | Gate |
|---|---|---|---|
| Identity / Look & Feel / URLs | Always (admin role) | — | — |
| `consentMode = IMPLIED_ON_SUBMIT` | — | Always (every transition INTO IMPLIED) | Attestation modal: name (session), justification (free text), explicit checkbox confirmation. Persisted to `AuditEvent.metadata.attestation`. |
| `memberIdentifierKind` change | `Member.count(brandId) === 0` | `Member.count(brandId) > 0` | Self-serve change disabled. Radios render `disabled`. Locked notice shows `{count}+ members are already enrolled` and a `mailto:SUPPORT_EMAIL` link. `PATCH /v1/admin/brand/profile` rejects with HTTP 409 (`MEMBER_IDENTIFIER_KIND_LOCKED`). Migration is performed server-side by data ops; that pathway stamps `AuditEvent.metadata.memberCountAtChange`. |
| `consentTextDefault` empty OR missing `{{privacy}}` token while `consentMode = EXPLICIT` | — | Survey distribution endpoints reject publish; brand-level `PATCH` rejects save with 400 | Pending banner row + section warning + downstream survey-publish gate (existing #231 code path). |

Role gating is `admin` only — same as `/admin/settings/themes` today. Not yet using a granular permission system (no permission to grant beyond admin); when one lands (epic TBD), the IMPLIED-consent toggle is the first candidate for a separate `legal:attest` permission split from generic admin.

**Support contact (`SUPPORT_EMAIL` env var).** The `mailto:` link in the locked-state Member identification notice and the support row in the Developer & Support reference section both source from a `SUPPORT_EMAIL` env var (default `support@customereq.com`). The env var is resolved at request time on the server (returned in `GET /v1/admin/brand/profile`), not embedded at build, so it can change without redeployment. When an in-app support-ticket form lands post-MVP, the `mailto:` becomes a deep-link to that form with the env var as a fallback.

### Field inventory — per-field traceability

| # | Field | Schema source | Source issue | Section | Behavior |
|---|---|---|---|---|---|
| F1 | `name` | `Brand.name` | #190, #170 | Identity | Text, required, **non-empty after trim**, ≤120 chars. Empty input renders inline `Required.` red error and adds the field to the page-level pending banner; Save Identity stays disabled. Save calls `IdentityProvider.updateOrgName()` (OD-5) — DB written first, provider call best-effort with retry-on-fail (queued via existing event pipeline). |
| F2 | `logoUrl` | `Brand.logoUrl` | #190, #170 | Identity | Upload (PNG/SVG/JPEG, ≤2 MB, min 64×64), preview before commit. Stored under existing asset path; URL persisted. Helper text is generic ("used on customer-facing surfaces — member portals, emails, surveys"). |
| F3 | `siteDomain` | `Brand.siteDomain` | #190, #170 | Identity | Text input. Validated as valid hostname (no scheme, no path); used by widget snippet / email footers. |
| F4 | `defaultThemeId` | `Brand.defaultThemeId` | #190, #157 | Look & Feel | Theme list loads **all `Theme` rows for this brand** (stock + custom) — server returns the full list in `GET /v1/admin/brand/profile.themes`. Top action bar deep-links to `/admin/settings/themes` for "Customize the stock themes or create a new one". No live preview panel on this page; preview lives on the Themes page. Selected row shows colored swatches (3 representative tokens) next to the theme name. |
| F5 | `sizeCategory` | `Brand.sizeCategory` *(`OrgSizeCategory`)* | #170 | Identity | Pill radio group: 1–10 / 11–50 / 51–200 / 201+ / "Prefer not to say". Optional, internal-only ("helps us optimize your experience, not shown anywhere else"). Lives in Identity (not in a separate Defaults section). |
| F6 | `memberIdentifierKind` | `Brand.memberIdentifierKind` *(`MemberIdentifierKind`)* | #231 | Member identification | Radio group: EMAIL (default, recommended) / PHONE (E.164) / CUSTOMER_ID. Lock semantics per Authorization table — **no self-serve change path** when `Member.count(brandId) > 0`; UI radios `disabled`, locked notice with member count + `mailto:SUPPORT_EMAIL`, API returns 409. |
| F7 | `consentMode` | `Brand.consentMode` *(`ConsentMode`)* | #231 | Consent & legal | Radio: EXPLICIT (default) / IMPLIED_ON_SUBMIT. IMPLIED requires attestation modal. |
| F8 | `consentTextDefault` | `Brand.consentTextDefault` | #231 | Consent & legal | Multi-line text, 0–500 chars. **Seeded with default copy on lazy-upsert** (not empty placeholder): *"By submitting this response, you agree we may use your feedback to improve our products and follow up if needed. See our `{{privacy}}` for details."* Supports `{{privacy}}` and `{{terms}}` Mustache-style tokens that render as hyperlinks to F9 / F10. **Both accept an optional inline label override**: bare form `{{privacy}}` falls back to fixed default labels ("Privacy Policy", "Terms and Conditions"); explicit form `{{privacy:"my privacy notice"}}` renders the inner string as the link label. **Inner-string allowlist:** any character except `"` `<` `>` `}` `{` and control chars; ≤80 chars per token. Renderer emits `<a href={URL}>{label}</a>` with `textContent`-equivalent label injection (no HTML; never `dangerouslySetInnerHTML`). **EXPLICIT validation:** text must contain at least one `{{privacy}}` or `{{privacy:"…"}}` token; if absent, save is rejected (400) and a pending-banner row appears ("Add a privacy link to your consent text"). **IMPLIED validation:** text optional; if empty, soft warning surfaces in the preview but does not block save. UI exposes `+ Privacy link` / `+ Terms link` toolbar buttons; clicking inserts the verbose form `{{kind:"Default Label"}}` with the inner label pre-selected for immediate override; if text was selected first, the selection is wrapped instead. Live preview below the textarea renders the rendered output in the active consent-mode form (with checkbox in EXPLICIT, plain paragraph in IMPLIED). **Survey-level override:** the parser, Zod validator, and HTML renderer are reused at the SurveyDistribution-override level (see API). |
| F9 | `privacyPolicyUrl` | `Brand.privacyPolicyUrl` | #231 | Consent & legal | URL input. Required when `consentMode = EXPLICIT`. **Also required (regardless of consent mode) whenever the consent text contains a `{{privacy}}` token** — otherwise the rendered link is broken. Empty/invalid in either case adds a row to the pending banner with the specific consequence and renders the preview link with a `broken` (dashed) underline. |
| F10 | `termsUrl` | `Brand.termsUrl` | #231 | Consent & legal | URL input, labeled **"Terms and Conditions URL"** in the UI (column name unchanged). Optional. Helper text: "Optionally referenced in your consent text via the Terms link button." |
| F11 | `id` (Brand id) | `Brand.id` *(read-only)* | #245 | Developer & Support reference | Copy-to-clipboard. |
| F12 | `clerkOrgId` | `Brand.clerkOrgId` *(read-only)* | #245 | Developer & Support reference | Copy-to-clipboard. Solves the DevTools-only-discoverable problem. |
| F13 | `createdAt` | `Brand.createdAt` *(read-only)* | #245 | Developer & Support reference | Display only. |
| F14 | Support contact | `SUPPORT_EMAIL` env var (default `support@customereq.com`) | NEW (#277) | Developer & Support reference (and Member identification locked notice) | Resolved at request time from the `SUPPORT_EMAIL` env var; returned by `GET /v1/admin/brand/profile`. Rendered as a `mailto:` link in (a) the Developer & Support reference section and (b) the locked-state notice in Member identification when members exist. **Not stored on `Brand`** — identical for every brand on this deployment. Post-MVP becomes a deep-link to the in-app support-ticket form with the env var as fallback. |

**No new schema migration.** Every field is already a column on `Brand` after #190, #231, #170 and the original Brand model. This spec is UI + a thin profile API + a shared consent-text parser/validator/renderer package + the `SUPPORT_EMAIL` env var.

### API

Two endpoints under the existing admin surface:

- `GET /v1/admin/brand/profile` — returns the current Brand row, the read-only fields (Brand id, Clerk org id, createdAt), the resolved `SUPPORT_EMAIL`, the brand's full `Theme` list (so Look & Feel can render without a second round-trip), and `Member.count(brandId)` (so the client can render the locked-state notice without a second round-trip). Lazy-upserts the row if absent (see Provisioning).
- `PATCH /v1/admin/brand/profile` — accepts a partial body, validates with Zod, persists, emits `AuditEvent`. Returns the new row.
  - **Identifier-kind lock:** if the request body changes `memberIdentifierKind` and `Member.count(brandId) > 0`, server returns `409 MEMBER_IDENTIFIER_KIND_LOCKED` regardless of body flags. Migration is performed only via a separate data-ops pathway (internal, out of scope for #277).
  - **Consent text validation:** the Zod schema parses `consentTextDefault` against the token regex (`{{(privacy|terms)(?::"([^"\<\>\}\{]{1,80})")?}}`), enforces the inner-string allowlist + ≤80-char cap per token, and rejects with HTTP 400 if `consentMode = EXPLICIT` and no `{{privacy}}` token is present. The same Zod validator is exported for reuse at the SurveyDistribution-override level.
  - **IMPLIED transition:** writing `consentMode = IMPLIED_ON_SUBMIT` requires an `attestation` block (admin id, free-text justification, attestation flag); absence → 400.

Logo upload is a separate `POST /v1/admin/brand/logo` (multipart) that returns the persisted URL; the page chains the URL into the next PATCH so the upload + the field write are one user-visible save.

`brandId` is **never** taken from the request body — always from the verified JWT (project rule R6).

**Reusable consent text parser/validator/renderer.** The token parser, Zod validator, and HTML renderer for `{{privacy}}` / `{{terms}}` (with optional custom labels) live in a single shared package — exact placement is a technical-design call (e.g., `packages/consent-text` or under `@customereq/config/consent`). SurveyDistribution-level overrides (#231 schema: `SurveyDistribution.consentMode`, `SurveyDistribution.consentTextOverride`) MUST consume the same module — no duplicated regex, no duplicated validator, no duplicated renderer. This is a R18 requirement, not a "nice to have" — survey-level overrides shipping later under #231 should slot in without re-implementing token logic.

## Compliance Requirements (if applicable)

`fraim/config.json` lists **GDPR (in-scope), CCPA (in-scope), SOC2 (target month-12), PCI-DSS (minimal-scope)** for CustomerEQ overall. This page's surface is load-bearing for the consent-mode and consent-text fields shipped under #231 (the GDPR/CCPA load), is **lightly in-scope for SOC2** (audit-trail completeness on org-config changes), and is **out of scope for PCI-DSS** (no cardholder data on this surface).

| Obligation | Source | Control on this page |
|---|---|---|
| Lawful basis (Art. 6) | GDPR | EXPLICIT consent mode is the documented default. IMPLIED transition gated by attestation modal capturing legal-review confirmation, persisted in `AuditEvent.metadata.attestation`. |
| Transparency (Art. 13) | GDPR | `privacyPolicyUrl` and `termsUrl` are first-class editable fields; their values are surfaced on every consent-bearing UI (embedded survey form, member-portal) via the `{{privacy}}` / `{{terms}}` token render path. Privacy URL is required when `consentMode = EXPLICIT` *and* whenever the consent text contains a `{{privacy}}` token. |
| Data minimization (Art. 5(1)(c)) | GDPR | The page captures org-level config only. No member PII is solicited or displayed. The Developer & Support reference section shows only Brand/Clerk org identifiers and the platform-level `SUPPORT_EMAIL`, not member or admin PII. |
| Right to know / right to delete (CCPA §1798.100, §1798.105) | CCPA | Brand-level changes are auditable via `AuditEvent`; the existing erasure pipeline does not touch Brand-level fields (no PII), so no extra control needed here. |
| Audit trail (CC7.2 — change management) | SOC2 (target M-12) | Every save emits `AuditEvent { action, brandId, changedFields, actor, before/after for changed fields }`. The IMPLIED-attestation event additionally carries `attestation: { admin, justification, attestedAt }`. The identifier-kind data-ops migration writes `AuditEvent.metadata.memberCountAtChange` with `actor: "data-ops"` so the audit trail is identical regardless of pathway. |
| Logical access (CC6.1) | SOC2 (target M-12) | All editable fields are admin-role-gated. `brandId` only from JWT (R6 / R13). Non-admin requests rejected at 403. |
| Cardholder data scope | PCI-DSS (minimal) | **Out of scope.** The page does not display, request, or persist any cardholder data, payment tokens, or PCI-relevant identifiers. |
| In-app safety | CustomerEQ (defense-in-depth) | The consent text token renderer **never** uses HTML-injection-equivalent for the inner-string label (R18). Inner-string allowlist (no `"` `<` `>` `}` `{`) at both the Zod validator and the renderer; redundant by design. |

**Compliance Validation** (see Validation Plan below): Playwright assertions and an integration test for the IMPLIED-attestation `AuditEvent` payload; cross-package import-graph check that the consent-text parser/validator/renderer is shared (no duplicate or divergent renderer that could miss the allowlist); regression-guard snapshot test asserting the rendered survey-form HTML contains no script-tag-equivalent injection from inner-string allowlist test cases.

## Design Standards Applied

- Source: `docs/architecture/architecture.md` (authoritative tech/UX patterns) + the existing `/admin/settings/themes` and `/admin/settings/webhooks` pages for layout (white card on `bg-gray-50`, `text-2xl font-bold` page header, indigo-600 primary actions, `rounded-lg` controls).
- Mock CSS variables match `docs/feature-specs/mocks/170-view.html` (`--primary: #4f46e5`, `--bg: #f7f7f8`, `--surface: #ffffff`, `--border: #e4e4e7`, `--radius: 10px`, system font stack) so the Step-1.5 onboarding handoff and the post-onboarding edit surface are visually continuous — the admin shouldn't experience the switch from "onboarding form" to "settings page" as a different product.
- The directional mocks `170-view.html` Scene 2 (Step 1.5 onboarding profile) and `231-brand-identifier-kind.html` (member-identifier wizard step) informed the field set but not the chrome. The settings page **deliberately drops** the wizard frame ("step N of M", progress dots, Back/Continue), the elaborate theme-preview panel, and the yellow lock-note box used in those mocks — see Alternatives. The settings page is a return surface; those mocks were first-run wizard surfaces.

## Validation Plan

### Functional (E2E, Playwright)

1. **Lazy-upsert on first visit.** Sign up a new admin → navigate to `/admin/settings/organization` → assert page renders with the new Brand row present (verify via DB query in test setup), all defaults, no console errors.
2. **Per-section save.** For each of the five sections, edit one field, click Save → assert: (a) toast appears, (b) DB row updated, (c) corresponding `AuditEvent` row written with `changedFields` matching the edit.
3. **EXPLICIT empty consent text gate.** Set `consentMode = EXPLICIT`, leave `consentTextDefault` empty → attempt to publish a survey via the survey-distribution flow → assert publish is rejected with the documented error message. Then fill `consentTextDefault` → assert publish succeeds.
4. **IMPLIED attestation modal.** Switch `consentMode` to IMPLIED_ON_SUBMIT → assert modal appears, blocks the change, requires attestation checkbox + justification → on confirm, persists with `AuditEvent.metadata.attestation` populated. Close modal without confirming → assert no change persisted.
5. **Identifier-kind lock with members present.** Seed a Member, then visit `/admin/settings/organization` → assert (a) all `memberIdentifierKind` radios render with `disabled` attribute, (b) the locked notice surfaces the member count and a working `mailto:` link to the configured `SUPPORT_EMAIL`. Then send `PATCH /v1/admin/brand/profile` with a different `memberIdentifierKind` → assert HTTP 409 with `{ error: "MEMBER_IDENTIFIER_KIND_LOCKED", memberCount }`. With zero members, the field is editable and saves normally.
6. **Brand-name change writes through `IdentityProvider`.** Change `name` → assert DB updated first, then `IdentityProvider.updateOrgName()` mock asserted called with `{ orgId, newName }`. Force the provider call to fail → assert DB still updated, retry queued, UI surfaces a "syncing with identity provider" badge.
7. **Sidebar navigation + Clerk Manage redirect.** Click Settings → Organization → assert URL `/admin/settings/organization` and active-state styling. Click Clerk OrganizationSwitcher's "Manage" → assert redirect to `/admin/settings/organization`, not the Clerk-hosted UI.
8. **Read-only identifiers copy.** Click each copy-to-clipboard control → assert clipboard contents match the displayed value. Click the `SUPPORT_EMAIL` row's mailto → assert the link href matches the env-resolved value.
9. **Pending banner discovery.** Land on `/admin/settings/organization` with `name = ""` and `privacyPolicyUrl = ""` → assert (a) banner renders at top with two rows, header "Action needed — 2 settings incomplete", (b) each row has a working "Jump to section" anchor, (c) the right-rail TOC marks Identity and Consent & legal with `●` pending dots, (d) Identity name input has `Required.` field-level error in red. Fill `name` → assert banner re-renders with one row, header count "1 setting incomplete", and the Identity TOC dot clears. Fill `privacyPolicyUrl` → assert banner disappears entirely and all dots clear. Banner has no Dismiss button (assertion: no element with `aria-label="Dismiss"` or matching dismiss-pattern is present).
10. **Consent text token parser & renderer.** For each of `{{privacy}}`, `{{privacy:"data policy"}}`, `{{terms}}`, `{{terms:"términos"}}` → assert the parser identifies the token, extracts kind + (optional) custom label, and the renderer emits `<a href={URL}>{label}</a>` with the label inserted via `textContent`-equivalent (no HTML). Reject `{{privacy:"<script>"}}` and `{{privacy:"x".repeat(81)}}` at the validator. Assert mixed text — token + plain prose + token — round-trips cleanly. Assert that the parser is exported from a single shared package and consumed by both brand-level and SurveyDistribution-level code paths (no duplication; verified by grep / build-time import-graph check).
11. **Consent text required-token gate.** With `consentMode = EXPLICIT` and consent text *without* a `{{privacy}}` token, attempt save → assert HTTP 400, banner row "Add a privacy link to your consent text" surfaces, section-level inline warning appears under the textarea. Insert `{{privacy}}` (either form) → assert save succeeds and the banner row clears.
12. **Toolbar token insertion.** In the consent text editor with no selection, click `+ Privacy link` → assert textarea contains `{{privacy:"Privacy Policy"}}` and the substring `Privacy Policy` is selected. With a selection of `our data policy`, click `+ Privacy link` → assert textarea contains `{{privacy:"our data policy"}}` and the cursor sits immediately after the closing `}}`. Click `+ Terms link` once with no selection → assert `{{terms:"Terms and Conditions"}}` inserted with `Terms and Conditions` selected.

### API (integration)

- `GET /v1/admin/brand/profile` returns the lazy-upserted row plus `themes`, `memberCount`, and `supportEmail`; second call is idempotent.
- `PATCH /v1/admin/brand/profile` rejects body containing `brandId` (must come from JWT only — R6).
- `PATCH` rejects unauthorized roles (non-admin → 403).
- `PATCH` writing `consentMode = IMPLIED_ON_SUBMIT` requires `attestation` block; absence → 400.
- `PATCH` rejects an identifier-kind change when `Member.count > 0` regardless of body flags → 409 `MEMBER_IDENTIFIER_KIND_LOCKED`.
- `PATCH` rejects consent text containing a token with an inner string outside the allowlist (e.g., `{{privacy:"<x>"}}`) → 400.
- `PATCH` rejects EXPLICIT-mode save when consent text contains no `{{privacy}}` token (any form) → 400.
- `PATCH` rejects an empty trimmed `name` → 400.

### Compliance Validation

- Integration test asserts the `AuditEvent` row for an IMPLIED transition contains the full attestation payload (admin id, admin email, free-text justification, `attestedAt`).
- Snapshot test on the embedded survey form: when `consentMode = EXPLICIT` + `consentTextDefault` is set, the survey form's consent UI renders with that exact text, the `{{privacy}}` token resolves to a working `privacyPolicyUrl` link, and (regression guard) the rendered HTML contains no `<script>`-equivalent injection from the inner-string allowlist test cases.
- Erasure-job audit: confirm the existing GDPR erasure pipeline does NOT touch `Brand` rows (Brand fields are not PII).
- Cross-package import-graph check: verify the shared consent-text parser/validator/renderer module is imported by both the brand-level (`PATCH /v1/admin/brand/profile`) and SurveyDistribution-level (#231) code paths. No duplicate token regex or label-rendering logic anywhere else in the repo (R18).

## Alternatives — design choices considered and discarded

| Alternative | Why discarded |
|---|---|
| **Wizard-style multi-step page** (continue the #231 mock's "step 3 of 5" framing into a full 5-step wizard for the whole page). | Settings is a *return* surface, not a *first-run* surface. Wizards are right for one-time linear flows (which #170 onboarding is); they're wrong when an admin returns six months later to update one field. The unified page handles both: first-run admins see all sections with sensible defaults + a non-dismissible action banner pointing at any missing required field; returning admins jump to one section via the right-rail TOC. |
| **Dual surface — onboarding wizard + a separate edit page.** | We already have the #170 Step 1.5 onboarding wizard. Adding a *separate* settings wizard would duplicate that flow and create the exact field-by-field-ticket churn this issue is closing. |
| **Block lazy-upsert; require the #239 webhook.** | Couples #277 to a separate work stream; opens us to webhook-delivery-failure 404s for any background flow that hits the API before the webhook fires. Lazy-upsert is the strictly safer foundation; the webhook is an additive optimization. |
| **Block first-run access until admin completes Org Settings.** | Conflates Settings (revisitable, full-fidelity) with Onboarding (linear, milestoned). The #170 Step 1.5 form is the right onboarding gate; the Settings page is for *any time*. |
| **Auto-populate `consentTextDefault` with boilerplate at provisioning.** | Issue #225 explicitly deferred this. The compromise we ship instead: a sensible **default** (not a placeholder) is seeded on lazy-upsert, containing the `{{privacy}}` token. It is editable and overrideable; the admin gets a working starting point but is never "stuck with" auto-generated legal copy they didn't review. Better than empty-and-blocked because admins reach a working consent surface immediately; better than empty-and-warned because the default has the privacy link wired up out of the box. |
| **Single page-level Save (one button at the bottom).** | The page covers five discrete concerns (identity, look & feel, identification, consent, developer reference). A single Save would force admins to mentally batch unrelated edits and would mean the IMPLIED-attestation modal interrupts an unrelated identity-section edit. Per-section Save (revealed only when a section is dirty) is a cleaner mental model and matches existing settings pages. |
| **Render `memberIdentifierKind` as a dropdown.** | The three options have material trade-offs that the radio group's helper text can explain inline. A dropdown hides the trade-offs. |
| **Move the developer reference section to `/admin/developer`.** | The Developer page is the right place for API keys; the Brand id, Clerk org id, and support contact are *organization* identifiers, not developer credentials. Cross-link from Developer → Organization, not the other way. The section is collapsed by default so admins doing normal work do not see it. |
| **Identifier-kind self-serve confirmation modal** (re-type org name + AuditEvent stamp). | Originally specified, then dropped. Admins changing identifier kind on a populated brand is high-blast-radius — Phone-keyed members won't match Email-keyed members, and admins are unlikely to grasp the data-ops cost from one modal. Locking the UI behind support contact removes the foot-gun and centralizes migration with data ops who can run it transactionally. The 1-second perceived friction of "contact support" is the right friction for this irreversible-with-data change. |
| **Bare `{{privacy}}` tokens with fixed labels, defer custom labels to v1.** | Custom labels cost ~half a day with tests (parser regex, toolbar select-on-insert, char allowlist, length cap). Deferring means migrating saved consent strings later or supporting both shapes in parallel — either is more debt than the upfront cost. Custom labels also serve admins in non-English markets and legal-sensitive verticals (finance, healthcare) immediately. Both forms (`{{privacy}}` and `{{privacy:"…"}}`) are supported in v0; the bare form is legitimate shorthand for the default label. |
| **XML-tag-style placeholders** (`<privacy>Privacy Policy</privacy>`). | Considered (issue feedback). Higher collision risk: admins paste consent copy that may contain `<` (HTML, encoded entities) but rarely `{{`. Mustache `{{…}}` is the dominant template syntax in SaaS marketing tools (Mailchimp, HubSpot, Customer.io, Klaviyo) — admins recognize it instantly. Toolbar buttons mean admins never type `{{` themselves, regardless of which syntax we picked. |
| **Banner scoped per-feature** ("Settings incomplete for survey distribution"). | First-cut framing; replaced. Tying banner copy to one downstream consequence creates an inconsistency where blanking the org name (always required, no specific feature consequence) shows only field-level red text but not banner attention. The generic "Action needed — N settings incomplete" framing scales to any required field added later, with the per-row body carrying the specific consequence. |
| **Banner with Dismiss / Snooze button.** | Lets admins acknowledge-and-ignore a real config gap, and they almost certainly will. The banner exists to surface gaps with downstream impact (broken `{{privacy}}` link, blocked survey publish, missing required identity). Dismissing it would silence the only proactive signal. The banner is data-state-driven instead — disappears automatically when all required fields resolve, never when "dismissed." |
| **Banner gates the page (e.g., disable Save buttons in unrelated sections until banner clears).** | Conflates "this page has pending fields" with "you cannot do anything else." Admins editing Identity should be able to save Identity even with Consent gaps unresolved. Banner is informational + jump-to surface; it does not block other sections. |
| **Live theme preview panel inside Look & Feel** (carried over from #170 Step 1.5). | Settings is a picking surface, not a previewing surface. Preview already lives on `/admin/settings/themes/{id}`; deep-link there from each theme row instead of duplicating the preview. Reduces visual noise on a page that already has 5 sections. |
| **Render member-identifier helper as a yellow lock-note box** (carried over from #231 mock). | Yellow warning-box shouts during normal browsing; the gate matters only at the moment of a change attempt. Replaced with a calm inline note ("This option cannot be changed after a member is enrolled"), and the locked state when members exist is shown as a neutral notice card (not a warning) since it is informational, not a warning. |

## Competitive Analysis

Desk research as of 2026-Q2 across six relevant competitors. Goal: validate the v0 field set against what the field carries, identify any load-bearing additions, and call out parity fields we deliberately reject.

### Competitors scanned

- **Yotpo (Loyalty + Reviews)** — closest competitor on CX-loyalty unification; ICP overlap.
- **Smile.io** — SMB-focused loyalty; relevant for the size-1-10 / 11-50 ICP.
- **Annex Cloud** — explicit "feature parity trap" guard (R3); review their Org settings to confirm we are not replicating low-value parity fields.
- **Antavo** — enterprise loyalty; strong on configurability per-brand.
- **Qualtrics XM** — pure CX; org settings will inform which CX-specific fields belong here vs. elsewhere.
- **LoyaltyLion** — Shopify-native loyalty; baseline SMB org-settings shape.

### Configured Competitors Analysis

The three competitors most directly comparable to CustomerEQ's positioning — Yotpo, Smile.io, and Annex Cloud — were analyzed first, since their ICPs overlap most with the mid-market CX→loyalty target.

#### Yotpo (Loyalty + Reviews + SMS)

**Org-settings shape (public docs + admin-screenshot review):**
- **Brand identity:** name, logo (uploaded once at signup, editable), brand color, accent color (theming is at the email/widget level, with sensible defaults rolled up to a brand-level token).
- **Sender / reply-to:** `defaultSenderName` + `replyToEmail` are first-class; SPF/DKIM verification flow ships alongside.
- **Locale + timezone:** `defaultLocale` (drop-down across ~30 locales) and `defaultTimezone` (IANA tz). Default sender language tracks locale.
- **Member identification:** implicit — Yotpo keys members by email, with phone as a Loyalty+SMS bolt-on. There is no admin-facing "identifier kind" toggle; the email-first model is hard-wired and a sales conversation is required to switch.
- **Consent / legal:** Yotpo exposes a brand-level SMS consent text + opt-in language, plus a privacy-policy URL field. Email consent is GDPR-aware (re-permission flows ship as workflows). Implied vs. explicit is region-derived (EU-US split), not admin-toggled.
- **Identifiers:** Yotpo `appKey` + `secret` are surfaced under a separate **Settings → API** page. A brand id (separate from the customer-visible storefront name) is exposed but de-emphasized.
- **Other fields surfaced:** currency (auto-detected from Shopify when integrated), business hours (used by the SMS-throttling rules), industry vertical (used internally for benchmarking).

**Takeaway for #277:** Yotpo confirms `defaultSenderName` / `replyToEmail` and `defaultLocale` / `defaultTimezone` belong on a settings page. Yotpo's identifier-kind-is-implicit model is *not* the right fit for CustomerEQ — our bring-your-own-application model means admins genuinely choose between EMAIL, PHONE, and CUSTOMER_ID. Yotpo's separate API page validates the choice to keep the **Developer & Support reference** *on* the org settings page (centralized self-serve recoverability) rather than scattering ids across pages.

#### Smile.io (SMB loyalty)

**Org-settings shape:**
- **Brand identity:** name, logo, brand color, accent color. Settings are streamlined for SMBs — fewer knobs, more sensible defaults.
- **Sender / reply-to:** customizable sender name + reply-to email; reply-to defaults to the merchant's account email if unset.
- **Locale + timezone:** `defaultLocale` (smaller set than Yotpo, ~12 locales); timezone follows the integrated platform (Shopify, BigCommerce).
- **Member identification:** locked to the integrated platform's customer ID (Shopify customer ID, BigCommerce customer ID). Email is exposed but is a derived attribute, not the primary key.
- **Consent / legal:** simplified — privacy URL field, no per-brand consent-text editor; consent UX is hard-coded into the loyalty signup widget.
- **Identifiers:** API key visible under **Account → API**.

**Takeaway for #277:** Smile.io's "platform-derived identifier" pattern reinforces that CustomerEQ's `memberIdentifierKind` toggle is a real differentiator for non-Shopify-shaped customers (the bring-your-own-application ICP). Smile.io's hard-coded consent UX is the parity trap we explicitly avoid (R3) — admins who need GDPR-compliant copy customization have nowhere to set it. CustomerEQ's `consentTextDefault` editor is strictly stronger.

#### Annex Cloud (Enterprise loyalty)

**Org-settings shape:**
- **Brand identity:** name, logo, color palette, **multi-brand support** (an Org has N Brands; #44 territory).
- **Industry, social handles, business hours, regional offices, contact persons, vendor contact:** Annex Cloud's settings page is the canonical case of the parity trap — many of these fields exist for vendor-side reporting / account management, not customer-facing surfaces.
- **Sender / reply-to / locale / timezone:** all present, per-brand under multi-brand mode.
- **Member identification:** flexible — supports multiple identifier kinds and even composite keys; configuration is professional-services-led, not admin self-serve.
- **Consent / legal:** detailed, multi-region; supports per-region consent text variants. Privacy + terms URLs are first-class.
- **Identifiers:** brand id, account id, region id, and integration ids are all surfaced on a dedicated **Account information** page.

**Takeaway for #277:** Annex Cloud is the textbook example of R3 (no parity-for-parity). Our deliberate omissions — industry category, social handles, business hours, regional offices — are right. Their per-region consent text variants point to a future enhancement we should *not* ship in v0 (single brand-wide default + survey-level overrides per #231 is sufficient until we have a multi-region customer who asks). Their dedicated "Account information" page validates our **Developer & Support reference** section.

### Additional Competitors Analysis

#### Antavo (Enterprise loyalty)

- **Brand identity:** brand info, brand colors (token-based, exposes typography tokens admins can override).
- **Locale + timezone + currency:** all three first-class.
- **Sender + reply-to:** standard.
- **Member identification:** offers a member-id schema configuration — admins pick the identifier kind (email / phone / external-id) at provisioning time. Lock semantics similar to ours.
- **Consent / legal:** GDPR-by-design, with consent-text editor supporting placeholders for legal links.
- **Identifiers:** brand id + tenant id exposed.
- **Business hours:** present but used for campaign scheduling, not admin notifications.

**Takeaway for #277:** Antavo's identifier-schema-at-provisioning model is essentially what we ship — strong validation. Their typography/branding tokens would belong in the future Look & Feel extensions we deliberately reserved space for in section #2.

#### Qualtrics XM (CX-only)

- **Brand identity:** account name, logo, primary color (theme is more elaborate; lives on its own page).
- **Locale + timezone:** first-class; surveys honor brand timezone for response analytics.
- **Sender + reply-to:** standard for distribution emails.
- **Member identification:** XM Directory uses email by default; "Anonymous Link" responses are a separate concept (no member identification).
- **Consent / legal:** privacy-by-design messaging in survey distribution; consent text is configurable per-survey, not brand-wide.
- **Identifiers:** Datacenter id, brand id, account id all exposed under a **Developer info** section.

**Takeaway for #277:** Qualtrics's per-survey consent text supports our spec's "survey-level override" requirement (R18) — we ship the brand-default + future survey override as a package, with the parser/validator/renderer reused.

#### LoyaltyLion (Shopify-native)

- **Brand identity:** minimal — name, logo, colors. Most settings deferred to Shopify.
- **Locale + timezone + currency:** auto-from-Shopify.
- **Sender + reply-to:** customizable.
- **Member identification:** locked to Shopify customer ID.
- **Consent / legal:** privacy URL field; no per-brand consent text editor.
- **Identifiers:** API key visible under **Settings → Integrations**.

**Takeaway for #277:** LoyaltyLion is the simplest-shape end of the spectrum — most config flows from the integrated platform. CustomerEQ's bring-your-own-application ICP means we cannot rely on the platform-as-source-of-truth shortcut; we need first-class fields for what LoyaltyLion delegates.

### Candidate competitor-inspired fields (proposed for inclusion or explicit rejection)

Updated dispositions after the analysis above:

| Field | Competitor pattern | Strategic value for CustomerEQ | Disposition |
|---|---|---|---|
| `defaultLocale` | Yotpo, Smile, Antavo, Qualtrics, Annex Cloud — **5 of 6 confirmed**. Drives default email + survey copy language. | High. CX-to-loyalty SLA (#6) means survey + alert copy must be reader-friendly without per-survey overrides. International ICP coverage. | **Defer to follow-up issue #277.A**, file alongside #277 as an additive Identity-section field. *Not* in #277 v0 because: (a) every consent text in v0 is English-default; (b) shipping locale without an end-to-end translation pipeline (survey copy, email copy, member portal) is half a feature; (c) the field-by-field-ticket churn this spec eliminates is for fields with existing wiring — locale has none yet. We earn the right to add it once translation infra ships. |
| `defaultTimezone` | Yotpo, Smile (via Shopify), Antavo, Qualtrics — **4 of 6 confirmed**. | High. Hero #6's <15 min SLA reporting + business-hours-aware Alert escalation depends on a brand-default tz. | **Defer to follow-up issue #277.B**, file alongside. *Not* in #277 v0 because: (a) the existing `<15 min` SLA reporting is in absolute UTC today; (b) admins do not have a place where they need to read a tz-aware value yet (member-portal joined-at, survey response timestamps are all UTC-displayed); (c) the alert-escalation flow that would consume this lands in a separate epic. |
| `defaultSenderName` + `replyToEmail` | Yotpo, Smile, Antavo, LoyaltyLion — **4 of 6 confirmed**. | Medium-high. CustomerEQ already sends from a generic address; surfacing a brand-owned sender / reply-to is a win for the alert + campaign flows. | **Defer to follow-up issue #277.C**, file alongside. The current generic-sender works; bringing brand-owned sender requires SPF/DKIM verification flow + reply-routing infra that's a separate sub-epic. The settings page has a slot for it once that infra ships. |
| `supportEmail` (admin-configured per-brand) | Annex Cloud, Antavo — **2 of 6 confirmed**. | Medium. Could be used on member-portal "contact us" if we offer per-brand support routing. | **Reject for v0.** Distinct from the platform-level `SUPPORT_EMAIL` env var (F14) — that is *CustomerEQ's* support inbox, not the brand's customer-support inbox. A brand-level customer-support email is not load-bearing for any v0 feature; admins who want it can add it via the Themes editor's email footer field. R3 (no parity-for-parity). Re-evaluate when the member-portal "contact us" flow lands. |
| `industryCategory` | Antavo, Annex Cloud — **2 of 6**. | Low. Mostly used for vendor-side analytics, not customer-facing. | **Reject.** R3 (no parity-for-parity). |
| `socialHandles` | Annex Cloud — **1 of 6**. | Low. Pure parity. | **Reject.** R3. |
| `businessHours` | Antavo, Qualtrics XM (campaign scheduling) — **2 of 6**. | Low at MVP — neither the alert-escalation flow nor SMS distribution (we don't send SMS yet) honors business hours. | **Reject for v0.** Re-evaluate when alert escalation surfaces a real need. |
| `currency` | Yotpo (auto from Shopify), Smile (auto from Shopify), Antavo, LoyaltyLion (auto) — **4 of 6**. | Medium-low. Loyalty programs (#23/#83) display point-to-currency conversions; without a brand currency, this defaults to USD. | **Defer.** Loyalty currency-display is currently USD-only; when programs add multi-currency support, the field lands then. |
| Per-region consent text variants | Annex Cloud — **1 of 6**. | Medium. EU vs. US consent variants matter for multi-region brands. | **Reject for v0.** Single brand-wide default plus per-survey override (already specified) covers the common case. Multi-region variants fit a later compliance epic. |

**Net new fields for #277 v0: zero.** The three highest-confidence competitor patterns (`defaultLocale`, `defaultTimezone`, sender/reply-to) all defer because their downstream consumers don't exist yet — adding them now is the same field-by-field-ticket churn this spec eliminates *for fields with existing wiring*. We file them as follow-up issues #277.A / #277.B / #277.C against the page, with the stated condition that each lands when its consumer ships.

### Competitive Positioning Strategy

- **Our differentiation:** every org-level field on this page is load-bearing for either (a) the unified CX→loyalty event pipeline (#6 hero), (b) compliance posture (#231 consent fields, #277 token-based consent text editor), or (c) integrator self-serve recoverability (Brand/Clerk id visibility, support contact, #245). Competitors typically expose 3–4× more org-level fields, most of them parity (industry, social handles, business hours that aren't wired to anything). We deliberately don't.
- **Where we are stronger than the field:** consent text editor with `{{privacy}}` / `{{terms}}` token system (Yotpo, Smile, LoyaltyLion all hard-code the consent UX or expose a single freeform string with no link templating); explicit `memberIdentifierKind` choice with managed-migration support (Yotpo and LoyaltyLion lock you into platform-derived ids; Annex Cloud and Antavo support choice but require professional services); first-class developer reference + support contact on the same page (most competitors split these across "API" and "Account" pages).
- **Where we are deliberately weaker:** locale, timezone, sender/reply-to, currency. We are weaker because we have no consumer for these fields yet — shipping them on the page without consumers is the parity trap. We file them as additive follow-ups to land when consumers ship.
- **Response strategy:** if a competitor ships an org-setting we don't have *and* it ties to a CustomerEQ differentiator (event pipeline, consent / compliance, self-serve recoverability), file as an additive issue against the existing page (no new ticket-churn). If it's parity, R3 says no.

### Research Sources

This analysis is desk-research from public documentation and admin-UI screenshots in vendor blogs, sales decks, and onboarding videos as of 2026-Q2. It is **not** first-hand UI inspection of any competitor's admin console — that would require trial accounts on each platform, which is in scope for a follow-up validation pass before any of #277.A / #277.B / #277.C ship.

- Yotpo: Yotpo Help Center articles on brand setup, sender configuration, and SMS opt-in language. Yotpo product-marketing screenshots.
- Smile.io: Smile.io support docs (smile.io/help) on brand customization and email senders. Public-facing onboarding videos.
- Annex Cloud: Annex Cloud's product documentation (publicly indexed PDFs and KB articles) on brand and account configuration.
- Antavo: Antavo developer docs (developer.antavo.com) on member schema and identifier configuration. Antavo customer-case-study materials.
- Qualtrics XM: Qualtrics official support site on brand setup, account hierarchy, and developer ids.
- LoyaltyLion: LoyaltyLion help center on integrations and brand setup, plus public Shopify-app-listing screenshots.
- CustomerEQ-internal: positioning per `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md`; differentiator framing per project rule R3.

## Open questions resolved by this spec

| Issue's open question | Resolution in this spec |
|---|---|
| Provisioning mechanism: webhook (#239) vs. lazy-upsert vs. both | **Lazy-upsert ships in #277. Webhook (#239) is an additive optimization, independent.** |
| URL path: `/admin/settings/organization` vs. `/admin/settings/brand` | **`/admin/settings/organization`** — matches user-facing "Organization" copy per the issue. `Brand` stays as the internal model name. Old `/admin/settings/brand` (referenced in #170 Step 1.5 / #190 / #245) redirects 301 to the new path. |
| Default for `consentTextDefault` when null | **Seed a working default on lazy-upsert** containing the `{{privacy}}` token. EXPLICIT survey distribution remains blocked while either (a) the text is empty, or (b) the text contains no `{{privacy}}` token; the existing #231 gate plus a brand-level 400 + pending-banner row enforce this in both directions. The seeded default ships admins to a working starting point; they are not auto-locked into legal copy. |
| Authorization for IMPLIED consent and identifier-kind change | **Attestation modal for IMPLIED** (admin name + free-text justification + checkbox; persisted to `AuditEvent`). **Identifier-kind change is locked when `Member.count > 0`** — no self-serve UI path, radios `disabled`, API returns 409 `MEMBER_IDENTIFIER_KIND_LOCKED`, locked notice surfaces a `mailto:SUPPORT_EMAIL` contact. Data-ops performs migration server-side. Both are admin-role-gated; granular legal-attest permission deferred. |
| Consent text placeholder syntax (custom-label support in v0?) | **Mustache-style `{{privacy}}` / `{{terms}}` tokens with optional inline label override `{{privacy:"my privacy notice"}}`. Both forms supported in v0.** Toolbar inserts the verbose form with the inner label pre-selected for immediate override; bare form is shorthand for the default label. Inner-string allowlist (no `"` `<` `>` `}` `{`); ≤80 chars per token. Renderer never uses HTML-injection-equivalent for the inner string. Parser/Zod validator/HTML renderer live in a single shared package and are reused at the SurveyDistribution-override level. |
| Discovery surface for missing required fields | **Non-dismissible page-level banner at the top of the main panel** lists every empty/invalid required field across all sections, generic framing, with per-row "Jump to section" links. **Right-rail TOC marks each pending section with a `●` indicator.** Field-level inline errors render alongside, independent of the banner. Banner is data-state-driven, has no Dismiss/Snooze button, and disappears when all required fields resolve. Component lives in shared admin UI for reuse on other settings pages. |
| Support contact surface (locked notices, developer reference) | **Single `SUPPORT_EMAIL` env var (default `support@customereq.com`), resolved at request time on the server**, returned in `GET /v1/admin/brand/profile`, used in (a) the locked Member identification notice and (b) the Developer & Support reference section. Not stored on `Brand`. Post-MVP becomes a deep-link to an in-app support-ticket form with the env var as fallback. |
| Forward-compatibility with multi-brand-under-one-org (#44) | **Out of scope for #277; current scope is 1 org = 1 Brand.** This spec assumes the single-Brand-per-Clerk-org invariant. When #44 lands, this page becomes the per-Brand settings page (with a Brand picker above the sections); the field set does not change. No schema decisions in #277 lock #44 out. |

## Requirements traceability

All requirements are SHALL-style; one behavior per row. Tags are the contract for tests and implementation review.

| Tag | Requirement |
|---|---|
| R1 | The system SHALL render `/admin/settings/organization` for any admin authenticated against an existing Clerk org, regardless of whether the Brand row pre-existed. |
| R2 | The system SHALL lazy-upsert a Brand row keyed by `clerkOrgId` from the verified JWT on the first authenticated `GET /v1/admin/brand/profile`. |
| R3 | The system SHALL NOT depend on the #239 Clerk webhook for the page to be reachable on first run. |
| R4 | The page SHALL render five always-expanded sections (Identity, Look & Feel, Member identification, Consent & legal, Developer & Support reference) with per-section Save / Cancel actions revealed only when the section is dirty. The Developer & Support reference section SHALL be collapsed by default. |
| R5 | The page SHALL be reachable from the admin sidebar's Settings section as the first item. |
| R6 | The Clerk OrganizationSwitcher's "Manage" link SHALL deep-link to `/admin/settings/organization` instead of the Clerk-hosted Manage UI. |
| R7 | Each save SHALL emit an `AuditEvent` with `action`, `brandId`, `actor`, `changedFields`, and `before`/`after` values for the changed fields. |
| R8 | A change to `Brand.name` SHALL write the DB row first and then call `IdentityProvider.updateOrgName()` (best-effort, retry on failure). `name` SHALL be required, non-empty after trim, ≤120 chars. |
| R9 | A transition of `consentMode` to `IMPLIED_ON_SUBMIT` SHALL require an attestation modal capturing admin id, admin email (from session), free-text justification, and a checkbox confirmation, persisted to `AuditEvent.metadata.attestation`. |
| R10 | A change to `memberIdentifierKind` while `Member.count(brandId) > 0` SHALL be rejected with HTTP 409 `MEMBER_IDENTIFIER_KIND_LOCKED` from `PATCH /v1/admin/brand/profile`. The UI radios SHALL render `disabled`, and a locked notice SHALL display the current member count and a `mailto:` link to the resolved `SUPPORT_EMAIL`. The change is performable only via a separate data-ops pathway, which SHALL stamp `AuditEvent.metadata.memberCountAtChange`. |
| R11 | Survey distribution SHALL remain blocked while `consentMode = EXPLICIT` and either (a) `consentTextDefault` is empty, or (b) `consentTextDefault` contains no `{{privacy}}` token in any form (existing #231 behavior plus the token-presence check). The page SHALL surface this block as both a pending-banner row and an inline warning on the Consent section. |
| R12 | The **Developer & Support reference** section SHALL display Brand id, Clerk org id, createdAt, and the support contact (`SUPPORT_EMAIL` env var) as read-only with copy-to-clipboard controls (mailto for the support contact). The section SHALL be collapsed by default. |
| R13 | The page SHALL accept `brandId` only from the verified JWT, never from the request body (project rule R6 of CustomerEQ). |
| R14 | All editable fields SHALL be admin-role-gated; non-admin requests SHALL receive 403. |
| R15 | The page SHALL NOT display, request, or persist any member PII; only Brand-level configuration. |
| R16 | The page SHALL render a non-dismissible action banner at the top of the main panel listing every empty or invalid required field across all sections, with a "Jump to section" link per row and a dynamic count in the header. The banner SHALL have no Dismiss/Snooze affordance and SHALL disappear automatically when no required fields remain pending. The banner SHALL NOT block navigation, SHALL NOT disable Save buttons in unrelated sections, and SHALL be computed client-side from form state on every change. |
| R17 | The right-rail table-of-contents SHALL mark every section with one or more pending required fields using a `●` indicator. |
| R18 | The `Brand.consentTextDefault` token parser, Zod validator, and HTML renderer SHALL live in a single shared package and SHALL be consumed by both `Brand`-level (this page) and `SurveyDistribution`-level (#231 overrides) code paths. The renderer SHALL inject token labels via `textContent`-equivalent (no HTML), and SHALL never `dangerouslySetInnerHTML` for any label or token output. |
| R19 | EXPLICIT-mode save of `consentTextDefault` SHALL be rejected by both the API (HTTP 400) and the UI (banner row + section warning) when the text contains no `{{privacy}}` token in either bare or labeled form. |
| R20 | The support contact (`SUPPORT_EMAIL`) SHALL be resolved at request time on the server (not embedded at build) so it can change without redeployment. The Developer & Support reference section and the Member identification locked-state notice SHALL both source the same env var. |
| R21 | `Brand.consentTextDefault` SHALL be seeded with a sensible default copy on lazy-upsert (containing a `{{privacy}}` token), not left as an empty string. The seeded default is editable; admins are not auto-locked into the seeded copy. |
| R22 | `GET /v1/admin/brand/profile` SHALL return the Brand row, the read-only fields, the resolved `SUPPORT_EMAIL`, the brand's full `Theme` list, and `Member.count(brandId)` in a single response, so the page can render its pending banner, locked-state notices, and theme picker without secondary round-trips. |

## References

- Closes: #190, #245
- Source for fields: #170 (Step 1.5), #231 (identifier kind, consent mode/text, privacy/terms URLs)
- Cross-ref: #239 (additive webhook), #44 (multi-brand-per-org — deferred), #46 (compliance epic — distinct surface), #189 (team management — distinct surface)
- Directional mocks (informed field set, not chrome): `docs/feature-specs/mocks/170-view.html` Scene 2 (Step 1.5 onboarding profile), `docs/feature-specs/mocks/231-brand-identifier-kind.html` (wizard-style member identifier step)
- Architecture: `docs/architecture/architecture.md`
- Existing settings layout reference: `apps/web/src/app/(admin)/admin/settings/themes/page.tsx`, `apps/web/src/app/(admin)/admin/settings/webhooks/page.tsx`
- Brand schema: `packages/database/prisma/schema.prisma` (model `Brand`, enums `MemberIdentifierKind`, `ConsentMode`, `OrgSizeCategory`)
- Mock for this spec: `docs/feature-specs/mocks/277-view.html` (scenes: `#scene-empty`, `#scene-populated`, `#scene-implied-attestation`)
