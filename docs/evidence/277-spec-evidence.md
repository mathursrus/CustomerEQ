# Feature Specification: Organization Settings — single source for org configuration
Issue: #277
PR: https://github.com/mathursrus/CustomerEQ/pull/290
Branch: `feature/277-p1-organization-settings-page-single-source-for-org-configuration`
Reviewer: rmadhira86

## Summary

- **Issue**: #277 — [P1] Organization Settings page — single source for org configuration
- **Workflow type**: Feature Specification (spec phase only — implementation issue follows separately)
- **Work completed**: Full feature specification + high-fidelity HTML/CSS mock with three scenes; spec re-iterated twice in response to reviewer feedback covering 21 distinct items (13 published inline comments + 4 pending inline comments delivered via chat + 4 round-2 cleanup items).

## Work Completed

### Key files

| File | Description |
|---|---|
| `docs/feature-specs/277-organization-settings.md` | Full feature specification — six always-expanded sections (Identity, Defaults, Look & Feel, Member identification, Consent & legal, Developer & Support reference), 16 fields with traceability (F1–F16), 26 SHALL-style requirements (R1–R26), compliance analysis (GDPR + CCPA in-scope, SOC2 lightly in-scope), competitive analysis across six competitors, alternatives table, open-questions resolutions. |
| `docs/feature-specs/mocks/277-organization-settings.html` | Interactive HTML/CSS mock with three scenes: `#scene-empty` (incomplete state with multi-row pending banner), `#scene-populated` (locked member identification + IMPLIED consent + custom-label tokens), `#scene-implied-attestation` (modal capturing attestation context). Renamed from `277-view.html` per reviewer feedback to follow the `<issue>-<feature>` convention. |
| `docs/evidence/277-spec-evidence.md` | This evidence document. |

### Approach

1. Drafted initial spec + mock following the FRAIM feature-specification template.
2. After reviewer round 1 (13 published inline comments + 4 pending inline comments shared via chat), audited every claim against current GitHub issue state for #170, #190, #231, #245, #264, #276, #157.
3. Reframed spec preamble + customer-problem section to reflect actual ship state (most upstream issues did not ship a UI surface).
4. Added new "Defaults" section + Brand.timezone (F15) + Brand.locale (F16); flipped competitor-table dispositions for both fields from defer to ship-in-v0.
5. Strengthened R18 (shared consent-text module) to require a third consumer (future Survey-creation simplification module) per reviewer note.
6. Reframed L117 brand-level IMPLIED rationale around the small-org-not-bound-by-GDPR/CCPA utility argument.
7. After reviewer round 2: reshaped team-size buckets (1–10 / 11–50 / 51–300 / 301–5000 / 5000+) to remove SMB-only-positioning signal; updated mock H1 + subtitle copy; moved "no surface consumes locale yet" framing out of the user-facing helper text.
8. Mock kept in lockstep with spec across both rounds — every textual change with a visual analog was reflected in both scenes.

## Completeness Evidence

- Issue tagged with label `phase:spec`: Set during pr-submission phase.
- Issue tagged with label `status:needs-review`: Set during pr-submission phase.
- All specification documents committed/synced to branch: Yes (commits `44af6f9` initial, `839db95` round 1, `921cfc1` round 2).
- CI on head commit (`921cfc1`): all 4 checks pass (Build production images x2, Build/Lint/Test x2).

| Customer Research Area | Sources of Information |
|---|---|
| Existing codebase patterns | `apps/web/src/app/(admin)/admin/settings/themes/page.tsx`, `apps/web/src/app/(admin)/admin/settings/webhooks/page.tsx`, `packages/database/prisma/schema.prisma` (Brand model, OrgSizeCategory / MemberIdentifierKind / ConsentMode enums) |
| Architecture constraints | `docs/architecture/architecture.md`, `fraim/config.json` (GDPR / CCPA in-scope, SOC2 target M-12, PCI-DSS minimal-scope) |
| Upstream issue state (verified during round 1) | #170 (open epic, not yet broken down), #190 (closed without shipping a real page), #231 (closed — backend-only schema rework), #245 (closed for being too narrow), #264 (open — GDPR erasure job not shipped), #276 (closed — survey-level consent override + IMPLIED migration shipped), #44 (open — multi-brand-per-org, out of scope) |
| Directional mocks | `docs/feature-specs/mocks/170-view.html` Scene 2 (Step 1.5 onboarding profile), `docs/feature-specs/mocks/231-brand-identifier-kind.html` (member-identifier wizard step) — informed field set, not chrome |
| Competitive landscape | Yotpo, Smile.io, Annex Cloud, Antavo, Qualtrics XM, LoyaltyLion (desk-research from public docs + admin-UI screenshots, 2026-Q2) |
| Compliance requirements | `fraim/config.json` compliance settings, project rules R6 (multi-tenancy), R13 (GDPR/CCPA), R18 (validation end-to-end) |

| PR Comment | How Addressed |
|---|---|
| L1 — mock filename `277-view.html` should follow `<issue>-feature` like the spec | Renamed mock to `277-organization-settings.html`. Spec link references updated at L100 + L437. (`839db95`) |
| L31 — #170 / #245 / #231 not "already-shipped" | Customer + Customer Problem sections rewritten end-to-end. `> Closes` + `> Cross-refs` directives reflect actual state (open / closed-without-shipping / backend-only). (`839db95`) |
| L42 — V0 = 1 Clerk Org : 1 Brand; future = N brands | Cardinality note added to Information Architecture preamble; pointed forward to per-Brand picker when #44 lands. (`839db95`) |
| L47 — 4 default themes must be available; #157 didn't seed | IA Look & Feel row + F4 reframed: 4 default themes (Indigo/Forest/Sunset/Slate) MUST be available at first run; seed-vs-central is a technical-design decision deferred to RFC. R25 codifies. (`839db95`) |
| L75 — first-setup redirect to Settings; lazy-upsert at first save if needed | Workflow steps 1–3 + Provisioning section rewritten. New flow: Clerk OrganizationSwitcher → org-created event → redirect to `/admin/settings/organization` → first GET there lazy-upserts. PATCH path also tolerates missing row. R26 captures the redirect requirement. (`839db95`) |
| L76 — #170 not yet shipped, no existing surfaces | Dropped "first-run checklist (#170) and existing surfaces work as before" reference. Workflow assumes nothing about #170. (`839db95`) |
| L77 — every new org admin must be auto-directed to Settings | Captured in R26 + workflow step 2. Both first-class entry paths (redirect-on-create + sidebar Settings → Organization). (`839db95`) |
| L86 — locked-state UI on page load, not after interaction | Workflow step 6 rewritten to be page-load-driven. GET response includes `memberCount` (R22). IA Member identification row also explicitly says "rendered on page load (not in response to an interaction)". R10 + R22 reinforce. (`839db95`) |
| L117 — implied consent in future is at survey level — why brand-level toggle? | L117 reframed around the small-org-not-bound-by-GDPR/CCPA utility argument. Brand-level IMPLIED stays for set-once convenience (e.g., small US-state restaurant). Dropped the speculative "first candidate for `legal:attest` permission" line; if granular permissions land, both brand-level (this page) and survey-level (#276) are candidates together. (`839db95`) |
| L128 (F4) — 4 default themes must be available | Same as L47. F4 row + R25 reflect the four-themes-at-first-run contract. (`839db95`) |
| L129 (F5) — `sizeCategory` ambiguous, rename | Renamed to `teamSize` (Prisma column rename, no data shape change). Enum `OrgSizeCategory` unchanged. R24 captures. (`839db95`) |
| L213 — does an erasure job exist? | Confirmed #264 is open and not shipped. Compliance-table row + Validation-Plan row rewritten as forward-looking ACs for #264. (`839db95`) |
| L214 — module also required by Survey-creation simplification | R18 + API description + Validation Plan now require three consumers: brand-level (this page), survey-level (#276), and the future Survey-creation simplification module. Cross-package import-graph check is forward-looking on the third consumer. (`839db95`) |
| L220 (pending) — Settings page is both first-run AND persistent | Wizard-alternative rationale rewritten — page handles both audiences with one mechanic (defaults + redirect-on-create + action banner + TOC). (`839db95`) |
| L259 + L334 (pending) — timezone definitely include now | Disposition flipped from defer to ship-in-v0. F15 (`Brand.timezone`, IANA tz, default `UTC`) + R23 added. New "Defaults" section. (`839db95`) |
| Locale (chat) — include now | F16 (`Brand.locale`, BCP 47, default `en-US`) + R23 added. No v0 surface consumes it yet — captured to avoid retrofit when translation pipeline ships. (`839db95`) |
| L369 (pending) — `/admin/settings/brand` was never built; nothing to redirect | Dropped the 301 redirect language from the open-questions resolution. (`839db95`) |
| Round-2 — team-size 201+ ceiling signals SMB-only positioning | Buckets reshaped to `1–10 / 11–50 / 51–300 / 301–5000 / 5000+ / Prefer not to say` in spec + mock. F5 documents the OrgSizeCategory enum-value migration (no row-data migration since #170 never shipped). (`921cfc1`) |
| Round-2 — locale "no surface consumes this yet" belongs in spec, not mock | Removed from mock helper text in both scenes; remains in spec (F16 + IA Defaults row). (`921cfc1`) |
| Round-2 — mock H1 should read "Organization settings" | Updated H1 in both scenes from "Organization" to "Organization settings". (`921cfc1`) |
| Round-2 — mock subtitle "Everything CustomerEQ knows" misframes the page | Reworded to "Your organization's preferences and configuration" (scene-empty) and "Preferences and configuration for Acme Coffee Roasters" (scene-populated). (`921cfc1`) |

## Validation

- Requirement coverage: all reviewer feedback items mapped to either a spec edit, a new requirement (R23 / R24 / R25 / R26), or both. Traceability table above is the ground-truth mapping.
- Mock renders correctly: validated structurally (six sections in both scenes, TOCs aligned, no broken anchor hrefs introduced by the renumbering, locale + timezone dropdowns added with realistic defaults).
- CI on head commit: all 4 checks pass.
- Reviewer confirmation: "The spec looks good" (chat, post-round-2).

## Quality Checks

- All deliverables complete (spec, mock, evidence).
- Documentation clear and professional; no vague requirements (all R1–R26 are testable).
- Spec defers two technical-design decisions to RFC (default-theme seeding mechanism; consent-text shared-module placement) — explicitly tagged as such, not left ambiguous.
- Five candidate competitor-inspired fields explicitly rejected for v0 with reasons (industry, social handles, business hours, brand-level support email, per-region consent variants); two flipped to v0 inclusion (locale, timezone); one deferred to follow-up #277.C (sender / reply-to).
- Work ready for human review and merge.

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| When a feature spec cross-references prior issues (#170, #231, #245, #190, etc.), the spec's claims about ship state must be verified against current issue/PR state — not inherited from earlier drafts. Three issues this spec described as "already shipped" had not actually shipped a UI surface. Verifying each upstream issue's `state` (and confirming there's no merged PR that built the surface) takes ~30 seconds per issue and prevents a full preamble rewrite later. | Captured here; durable home would be a project rule along the lines of "verify upstream-issue ship state before describing it as shipped" — proposing as a rule update during the next sleep-on-learnings cycle. |
| Memory rule "audit mock-vs-spec at every spec round" held up well across both feedback rounds — every spec edit with a visual analog was reflected in both mock scenes in the same commit. Renumbering the section count (5 → 6) required updating not only the section IDs but also TOC anchors, scene labels in the spec's UI mocks paragraph, and R4. | Existing memory rule: `feedback_audit_mock_vs_spec_at_every_round.md`. No update needed; rule is performing as intended. |
| Replying to inline review comments via the GitHub REST API fails with `user_id can only have one pending review per pull request` if the same user has any pending (unsubmitted) review on the PR. The `replies` endpoint creates a new review under the hood. Workaround: fall back to a single top-level PR comment that maps each inline comment to its resolution; back-fill individual replies once the pending review is published. | Worth documenting as a reference memory: a quirk of the GitHub PR-review API that affects single-reviewer / single-author PRs (where one person is both reviewer and PR author). Filing during next sleep-on-learnings as a `reference_*` memory. |
