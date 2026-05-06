# Feature: Organization Settings page — Technical Design Evidence
Issue: [#277](https://github.com/mathursrus/CustomerEQ/issues/277)
Feature Spec: [`docs/feature-specs/277-organization-settings.md`](../feature-specs/277-organization-settings.md)
RFC: [`docs/rfcs/277-organization-settings.md`](../rfcs/277-organization-settings.md)
PR: https://github.com/mathursrus/CustomerEQ/pull/290 (spec + design ship together per repo convention)

## Completeness Evidence

- Issue tagged with label `phase:design`: **Yes** — applied during phase 2 (`design-authoring`).
- Issue tagged with label `status:needs-review`: **Yes** — applied during pr-iteration phase 4 (spec submission).
- All files committed/synced to branch: **Yes** — RFC at commits c73b586 + 28d5761; spec at 921cfc1; mock at 921cfc1; spec-evidence at 16b1dfc.

| PR Comment | How Addressed |
|---|---|
| (Initial submission — design feedback round 0) | N/A |

### Traceability Matrix

Every spec requirement R1–R26 mapped to the RFC section + data model that implements it, plus the validation-plan alignment.

| Requirement (Spec) | RFC Section / Data Model | Status | Validation Plan Alignment |
|---|---|---|---|
| **R1** — render `/admin/settings/organization` for any admin authed against an existing Clerk org | RFC §4 (route handler) + §6.1 (page route in `apps/web/src/app/(admin)/admin/settings/organization/page.tsx`) | Met | E2E test 1 (lazy-upsert on first visit) — Spec validation §1 |
| **R2** — lazy-upsert Brand row keyed by `clerkOrgId` from JWT on first GET | RFC §4.1 (lazy-upsert SQL block) + §3.7 (Provisioning subsection) | Met | API integration test: GET lazy-upserts; second call idempotent — Spec validation §API |
| **R3** — do not depend on #239 webhook for first-run reachability | RFC §7 (Clerk `afterCreateOrganizationUrl` decision) + §3.7 (webhook is additive optimization) + §11 forward-looking | Met | Implicit — redirect mechanism does not call any webhook code path |
| **R4** — six always-expanded sections, per-section Save/Cancel, Developer & Support collapsed by default | RFC §6.1 (component map: 6 section files in `sections/` directory) + §6.3 (per-section dirty state via RHF) | Met | E2E test 2 (per-section save) covers all 6 — Spec validation §2 |
| **R5** — page reachable from admin sidebar Settings as first item | RFC §7 (sidebar `navLinks` change in `apps/web/src/app/(admin)/layout.tsx` — first item under Settings group) | Met | E2E test 7 (sidebar nav + Clerk Manage redirect) — Spec validation §7 |
| **R6** — Clerk OrganizationSwitcher "Manage" deep-links to `/admin/settings/organization` | RFC §7 (`organizationProfileMode="redirect"` + `organizationProfileUrl` props on `<OrganizationSwitcher>`) | Met | E2E test 7 (asserts Manage redirect target) |
| **R7** — every save emits AuditEvent with action / brandId / actor / changedFields / before-after | RFC §9 (`brand.profile.updated` audit event with per-route metadata allowlist) | Met | API integration test: AuditEvent row written with `changedFields` matching the edit |
| **R8** — Brand.name change writes DB first, then calls IdentityProvider.updateOrgName() (best-effort, retry); name required, non-empty trim, ≤120 chars | RFC §7a (write-through pattern via `fastify.identityProvider.updateOrgName`) + §4.2 (Zod `.trim().min(1).max(120)`) | Met | E2E test 6 — Spec validation §6 (provider call mocked, force-fail asserts retry queued + UI badge) |
| **R9** — IMPLIED transition requires attestation modal capturing admin id / email / justification / checkbox; persisted to AuditEvent.metadata.attestation | RFC §4.2 (Zod `.refine` on body shape) + §9 (`brand.consent.mode_changed_to_implied` audit event) + §6.1 (`ImpliedAttestationModal.tsx`) | Met | E2E test 4 (IMPLIED attestation modal) — Spec validation §4 |
| **R10** — identifier-kind change with members → 409 `MEMBER_IDENTIFIER_KIND_LOCKED`; UI radios disabled; locked notice with mailto SUPPORT_EMAIL; data-ops migration writes AuditEvent.metadata.memberCountAtChange | RFC §4.2 (server-side count + 409 short-circuit) + §6.1 (`MemberIdentificationSection.tsx` renders disabled state on page load) + §9 (`brand.identifier_kind_changed` audit) | Met | E2E test 5 + API integration tests covering 409 path — Spec validation §5 |
| **R11** — survey distribution blocked while EXPLICIT and (a) consentTextDefault empty or (b) no `{{privacy}}` token; brand-level PATCH 400 + pending-banner row | RFC §4.2 (cross-field validator) + §6.3 (client `pendingItems` mirrors server check via `hasPrivacyToken`) | Met | E2E test 3 (EXPLICIT empty consent gate) + API test: PATCH 400 — Spec validation §3 |
| **R12** — Developer & Support reference section: Brand id, Clerk org id, createdAt, supportEmail, copy-to-clipboard, mailto for support; collapsed by default | RFC §6.1 (`DeveloperSupportSection.tsx`) + §4.1 (GET response includes `supportEmail`) | Met | E2E test 8 (read-only identifiers copy) — Spec validation §8 |
| **R13** — `brandId` only from JWT, never from request body | RFC §8 (existing `multiTenant` plugin enforces) | Met | API integration test: PATCH rejects body containing `brandId` |
| **R14** — admin-role-gated; non-admin → 403 | RFC §8 (existing `auth` plugin enforces) | Met | API integration test: PATCH non-admin → 403 |
| **R15** — page does not display, request, or persist any member PII | RFC §4.1 (GET response shape — no member fields beyond `memberCount`) | Met | Code review + integration test response-shape assertion |
| **R16** — non-dismissible action banner listing every empty/invalid required field; per-row "Jump to section"; dynamic count; no Dismiss/Snooze; client-side from form state; does not block other sections | RFC §6.2 (`AdminPendingBanner` shared component, no Dismiss affordance) + §6.3 (client-side `pendingItems` computation) | Met | E2E test 9 (pending banner discovery) — Spec validation §9 |
| **R17** — TOC pending dot indicator per pending section | RFC §6.4 (TOC entries with `pending` style applied when section has any field in `pendingItems`) | Met | E2E test 9 covers TOC dots |
| **R18** — consent-text token parser/Zod validator/HTML renderer in single shared package, consumed by Brand-level + #276 SurveyDistribution + future Survey-creation simplification module; renderer never `dangerouslySetInnerHTML` | RFC §3 (`@customereq/consent-text` package, three exports, three required consumers) | Met | Cross-package import-graph check (RFC §10 Validation Plan compliance test); unit test on renderer source asserting no `innerHTML` paths |
| **R19** — EXPLICIT save without `{{privacy}}` token → API 400 + UI banner row + section warning | RFC §4.2 (cross-field validator returns 400 with `{ error: 'CONSENT_TEXT_MISSING_PRIVACY_TOKEN' }`) + §6.3 (client mirror) | Met | E2E test 11 (consent text required-token gate) — Spec validation §11 |
| **R20** — supportEmail resolved at request time on server, returned in GET; same env var used in Member identification locked notice + Developer & Support reference | RFC §4.1 (`process.env.SUPPORT_EMAIL ?? 'support@customereq.com'` resolved per-request) | Met | API integration test: GET response carries env-resolved `supportEmail` |
| **R21** — consentTextDefault seeded with default copy on lazy-upsert (containing `{{privacy}}` token); editable thereafter | RFC §4.1 (DEFAULT_CONSENT_TEXT constant set at upsert time) | Met | E2E test 1 (lazy-upsert defaults) asserts seeded text |
| **R22** — GET returns Brand row + read-only fields + supportEmail + theme list + memberCount in single response | RFC §4.1 (`GetBrandProfileResponse` shape + `Promise.all` for parallel reads) | Met | API integration test: GET response shape |
| **R23** — Brand schema includes `timezone` (IANA, NOT NULL, default `UTC`) and `locale` (BCP 47, NOT NULL, default `en-US`); lazy-upsert prefers browser hints | RFC §1 (schema diff) + §2 (migration SQL) + §4.1 (header-hint resolution at upsert) | Met | API integration test: GET on freshly-created brand returns hint-resolved timezone/locale; falls back to UTC/en-US when no hints |
| **R24** — rename `Brand.sizeCategory` → `Brand.teamSize`; `OrgSizeCategory` enum unchanged in name | RFC §1 (schema diff) + §2 (migration SQL `ALTER TABLE … RENAME COLUMN`) | Met | Migration applied in CI; Prisma client regen confirms `teamSize` field |
| **R25** — 4 default themes (Indigo / Forest / Sunset / Slate) available at first run; mechanism (per-brand seed vs. global) is design output | RFC §5 (decision: per-brand seed at provisioning + `isStockDefault` boolean + `@@unique([brandId, name])` constraint) | Met | E2E: scene-empty assertion that 4 themes are pickable from first paint |
| **R26** — redirect admin to `/admin/settings/organization` on Clerk org-created event | RFC §7 (`afterCreateOrganizationUrl` prop) | Met | E2E test driving the OrganizationSwitcher create flow asserts redirect target |

**Result:** All 26 requirements mapped to a concrete RFC section + data model. **0 Unmet rows.** Design-completeness review passes.

### Architecture Gaps Documented for User Review

Per the architecture-gap-review phase (RFC § Architecture Analysis):

1. **Per-route audit metadata allowlist pattern** — used by RFC §9; #276 RFC introduced; not yet in `architecture.md`. Suggested: add to architecture §4.2 audit-plugin row.
2. **Lazy-upsert provisioning at GET** — RFC §3.7 + §4.1; new pattern for #277. Suggested: add to architecture §3.2 alongside the existing webhook-driven provisioning.
3. **Domain-narrow runtime packages** (`packages/consent-text`, alongside `packages/embed`) — third instance of the pattern. Suggested: add to architecture §3 architectural-layers section.
4. **React Hook Form + Zod resolver** as the form-state convention — used in #170 + this RFC; not in architecture §2 tech stack. Suggested: add a row.
5. **Clerk `afterCreateOrganizationUrl` + `organizationProfileUrl`** as post-create-landing + Manage-redirect mechanism — used in RFC §7. Suggested: add to architecture §3.1 admin-portal subsection.

These gaps are documented; **no architecture-document edits were made in this phase**. Updates land during `address-feedback` (RFC phase 7), gated by user direction in PR review.

### Architectural Patterns Incorrectly Followed

None identified.

## Due Diligence Evidence

- Reviewed feature spec in detail: **Yes** — every requirement R1–R26 traced to a concrete RFC section.
- Reviewed codebase in detail: **Yes** — verified `Brand` schema state (columns already added by #170 + #231 work), confirmed `SurveyTheme` model name (corrected from RFC draft `Theme`), inspected existing `OrganizationSwitcher` configuration in `apps/web/src/app/(admin)/layout.tsx`, confirmed migration directory format, verified `IdentityProvider` boundary pattern from #170.
- Included detailed design, validation plan, test strategy: **Yes** — RFC §1–§9 cover schema / shared package / API / frontend / authorization / audit; §10 maps spec validation plan to concrete test files.

## Prototype & Validation Evidence

- [x] Built simple proof-of-concept that works end-to-end → **Not applicable for this RFC** — design phase, no code yet. The Clerk-prop change is a one-line edit with documented behavior; the lazy-upsert pattern is a standard Prisma `upsert`.
- [x] Manually tested complete user flow → **Not applicable for design phase**. The mock at `docs/feature-specs/mocks/277-organization-settings.html` is the equivalent visual proof for the page surface; it has been verified to render the six-section layout with the new Defaults section.
- [x] Verified solution actually works before designing architecture → Confirmed via codebase inspection (Clerk SDK supports the props, Prisma supports the migration, existing `IdentityProvider` boundary supports the write-through).
- [x] Identified minimal viable implementation → 4-slice breakdown (RFC §12) is the MVI: schema migration + shared package land in parallel, then backend, then frontend.
- [x] Documented what works vs. what's overengineered → §11 forward-looking notes call out what is *not* in scope (the #239 webhook is forward-additive, not a #277 dependency; #44 multi-brand changes the page chrome but not the field set).

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| The reviewer process for this repo is spec + technical-design ship together in one PR; the implementation issue is filed only after design output decides single-PR vs. multi-PR. I conflated FRAIM's pr-iteration "submit for review" terminal with end-of-spec-phase, then proposed technical-design as a separate next step. Captured as memory `feedback_spec_and_design_ship_together.md` 2026-05-06. | Memory entry filed; no architecture rule update needed (this is a workflow rule, not a code rule). |
| The Prisma model name was `SurveyTheme`, not `Theme` — my first RFC draft used `Theme` based on the spec's "Look & Feel" section copy. Caught during architecture-gap review when checking the @@unique constraint claim. Lesson: when the RFC references a model by name, grep `schema.prisma` to confirm the exact name before assuming. | One-line addition to `feedback_audit_mock_vs_spec_at_every_round.md` (existing memory): the same end-to-end-sweep discipline that applies to spec text and mocks also applies to RFCs against the live schema. Will fold into next sleep-on-learnings cycle. |
| `OrganizationSwitcher` exposes `afterCreateOrganizationUrl` + `organizationProfileMode="redirect"` + `organizationProfileUrl` props — solving R6 (Manage redirect) and R26 (post-create landing) with three prop additions in one place, no webhook coupling. | None — Clerk-specific prop knowledge is documented in the RFC §7 and the suggested architecture-doc update. |
