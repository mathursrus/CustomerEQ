# Implementation Work List — Issue #405

**Issue**: #405 — [P0] Survey Look & Feel preview empty — Brand rows created by Clerk webhook never get default themes
**Branch**: `feature/405-p0-survey-look-feel-preview-empty-brand-rows-created-by-clerk-webhook-never-get-default-themes`
**Worktree**: `C:/Github/mathursrus/CustomerEQ - Issue 405`
**Base branch**: `main`
**Issue type**: bug
**Phase 1 author**: Claude (Opus 4.7), session 2026-05-17
**Phase 1 revised**: 2026-05-17 (post-discovery scope correction)

---

## A. Root cause (corrected after Phase 2 investigation)

Original issue framing claimed the Clerk webhook creates Brand rows without seeding themes. Investigation during Phase 2 revealed:

1. The webhook **does not actually persist Brand rows in production today** — `emitActivationStep(tx as never, …)` inside its `$transaction` callback throws `TypeError: prisma.$transaction is not a function` (Prisma's `Prisma.TransactionClient` doesn't expose `$transaction`; the `as never` cast silenced TS). The transaction rolls back; no row persists. Same bug at `/api/auth/signup*` (zero callers anyway).
2. The de-facto Brand-creation path in prod is the **lazy-upsert** in `apps/api/src/routes/admin-brand-profile.ts:168-181` — runs on first `/admin/settings/organization` load. It correctly seeds 4 default themes + Indigo `defaultThemeId` via nested `createMany`.
3. Affected brands like **ArtistOS** were created **before [PR #307 / commit `c2c55b1`](https://github.com/mathursrus/CustomerEQ/commit/c2c55b1) (impl #292 Slice 3/4)** added the lazy-upsert seeding logic. Their rows were inserted manually (prod-unblock SQL per [#217 comment](https://github.com/mathursrus/CustomerEQ/issues/217#issuecomment-4361015557)). No migration ever back-filled themes for pre-existing brands — verified via `git log --all -- packages/database/prisma/migrations/`.
4. After #307 landed, the lazy-upsert's `update: {}` branch on the upsert never re-evaluates whether the brand has themes — so any pre-existing themeless brand stays themeless forever.

**Result**: ArtistOS (and any other pre-#307 brand) lives in a permanent `themes = []` / `defaultThemeId = NULL` state. `LookFeelTab.tsx:159` short-circuits the preview (`{theme && <PreviewSurvey>}`) and the radio group renders empty.

## Out-of-scope work uncovered (filed/tracked elsewhere)

The webhook nested-tx bug, theme seeding inside the webhook, default Engagement Program provisioning, `/api/auth/signup*` route retirement, `CLERK_WEBHOOK_SECRET` dev-fallback base64 fix, and Fastify-5 `FST_ERR_CTP_ALREADY_PRESENT` verification all rolled into **[#239](https://github.com/mathursrus/CustomerEQ/issues/239)** (retitled: *"[P1] Make Clerk org.created webhook actually work — auto-provision Brand+Program+themes, fix runtime + startup bugs"*). Closes #239 + #250 + #266 + #251 in that PR. Tracking comment: <https://github.com/mathursrus/CustomerEQ/issues/239#issuecomment-4470329561>.

Those items are explicitly NOT in #405's scope. #405 stays focused on closing the data hole for existing themeless brands plus defensive surfaces so future occurrences don't fail silently.

---

## B. Scope (5 points)

### In scope

| # | Group | Surfaces |
|---|---|---|
| 1 | **Backfill script** | `scripts/backfill-brand-default-themes.ts` — one-off TS script (`tsx`). Finds every Brand with zero `BrandTheme` rows; for each: creates the 4 defaults and sets `Brand.defaultThemeId` to the new Indigo. Idempotent (skips brands with ≥1 theme), supports `--dry-run`, prints summary. Run once in prod against ArtistOS and any future similar laggard. |
| 2 | **Self-heal at lazy-upsert** | `apps/api/src/routes/admin-brand-profile.ts` — after the existing upsert returns, if `brandThemeCount === 0` for the resolved brand, seed the 4 defaults + set `defaultThemeId` to Indigo. Today the seeding only fires on the upsert's `create` branch; this extends it to the `update`-branch case so any future brand created via any code path self-heals on first admin visit. |
| 3a | **UI empty state — survey editor (RBAC-neutral)** | `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/LookFeelTab.tsx` — when `themes.length === 0`, render: *"No themes are configured for this brand yet. Survey previews can't render until at least one theme exists for the brand. Contact a brand administrator to set one up."* in place of both the empty radiogroup AND the silent-skipped `<PreviewSurvey>`. No outbound link (future RBAC may grant survey-edit without org-settings access; the viewer might not be able to act on a deeplink). |
| 3b | **UI empty state — org settings (admin-only)** | `apps/web/src/app/(admin)/admin/settings/organization/components/sections/LookAndFeelSection.tsx:39-42` — replace stale *"No themes available yet — refresh after the API seeds defaults"* (false — nothing async will seed) with: *"No themes are configured for this brand yet. Use Settings → Themes to add the first one."* The existing "Open Themes →" link on this section stays. Admin viewer; prescriptive copy fine. |
| 5 | **Org Settings "Action needed" rows** | `apps/web/src/app/(admin)/admin/settings/organization/lib/pendingItems.ts` — extend `computePendingItems(values)` → `computePendingItems(values, { themesCount, hasDefaultTheme })`. Emit two new rows: *"Themes — your brand has no themes yet. Customer-facing surveys can't render until at least one theme exists."* and *"Default theme — no default theme is set. New surveys will need a theme picked manually."*. Both `jumpToSectionId: 's-lookfeel'`. Wire `profile.themes.length` and `Boolean(profile.brand.defaultThemeId)` from `OrganizationSettingsForm.tsx:252`. Reuses existing `AdminPendingBanner` + "Jump to section →" pattern. Self-clears once data is back. (Admin-only surface — `/admin/settings/organization`.) |
| 6 | **Public renderer theme-resolution fallback chain** | `apps/api/src/routes/public.ts` — when resolving the theme for the respondent-facing survey, walk the chain **Survey.themeId → Brand.defaultThemeId → `DEFAULT_THEMES[0]` (Indigo)**. Today the route only resolves the survey-level join (`Survey.themeId → BrandTheme.id`); if that's null the API returns `theme: null` and the page falls back to a hardcoded constant in `apps/web/src/app/survey/[id]/page.tsx:58-76` (a different Indigo-ish set of values from a different source of truth). That fallback masked the bug shape this PR fixes — ArtistOS-style brands have been silently sending Indigo-styled customer surveys instead of their brand identity for as long as they've existed. After this change the API always returns a fully-resolved theme; the client-side `DEFAULT_THEME` constant is removed; the canonical CustomerEQ fallback is the single seeded `Indigo` shape from `apps/api/src/lib/default-themes.ts` (one source of truth across new-brand seeding, lazy-upsert, backfill, AND respondent fallback). |
| 7 | **Remove client-side DEFAULT_THEME constant** | `apps/web/src/app/survey/[id]/page.tsx` — delete the hardcoded `DEFAULT_THEME` (lines 58-76) and the `survey?.theme ?? DEFAULT_THEME` fallback at line 176. After point 6, the API guarantees `theme` is non-null; the client renders `survey.theme` directly. Removes the divergent second source of truth. |

### Out of scope (deferred / tracked elsewhere)

| Item | Where |
|---|---|
| Webhook seeding + nested-tx fix + default Engagement Program + dead-route retire + dev-secret base64 + FST_ERR_CTP verify | #239 |
| Auto-poll `/v1/themes` after empty state surfaces | n/a — manual reload after backfill / self-heal is acceptable; one-time per affected brand |
| Convert backfill to a Prisma data migration | Migration timestamp coordination (R22c) is heavier than this one-off needs; `tsx` script matches `setup-dev-brand.ts` precedent |

### Scope-expansion note (points 6 + 7) — explicit non-precedent

Points 6 + 7 violate the standing P-HIGH "Tight PR scope — no opportunistic scope creep" / "Drafted downstream-surface scope into a P0 production hotfix instead of deferring" coaching. The user (2026-05-17 chat) directed inclusion with explicit reasoning: production customers including ArtistOS are **not live with respondent surveys yet**, so the customer-impact framing that would normally force tight scoping doesn't apply for this one specific decision. The user also explicitly noted *"This scope expansion should NOT be taken as precedent."* Future P0 hotfix scoping defaults to tight per the standing coaching unless the user issues the same non-precedent override again.

### Affected file inventory (revised)

| File | Type | Change |
|---|---|---|
| `scripts/backfill-brand-default-themes.ts` | **new** | One-off backfill (point 1) |
| `apps/api/src/lib/default-themes.ts` | (no change) | Source of truth; consumed by script + admin-brand-profile + tests |
| `apps/api/src/routes/admin-brand-profile.ts` | mod | Self-heal block after upsert (point 2) |
| `apps/api/test/integration/admin-brand-profile.test.ts` | mod | Add test: pre-existing brand with zero themes → GET → 4 themes seeded + Indigo default (point 2 verification) |
| `apps/api/test/integration/backfill-brand-default-themes.test.ts` | **new** | Backfill script behavior — happy path + idempotency + dry-run |
| `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/LookFeelTab.tsx` | mod | Empty state — RBAC-neutral copy (point 3a) |
| `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/LookFeelTab.test.tsx` | mod | Add RTL test: themes=[] → empty-state element renders, PreviewSurvey does NOT render |
| `apps/web/src/app/(admin)/admin/settings/organization/components/sections/LookAndFeelSection.tsx` | mod | Replace stale copy (point 3b) |
| `apps/web/src/app/(admin)/admin/settings/organization/lib/pendingItems.ts` | mod | Add themes-empty + default-not-set rows; widen signature (point 5) |
| `apps/web/src/app/(admin)/admin/settings/organization/lib/pendingItems.test.ts` | mod or new | Test the two new pending-item rows |
| `apps/web/src/app/(admin)/admin/settings/organization/components/OrganizationSettingsForm.tsx` | mod | Pass `themesCount` + `hasDefaultTheme` into `computePendingItems()` |
| `docs/evidence/405-implement-work-list.md` | this file | revised |
| `docs/evidence/405-feature-implementation-evidence.md` | new (Phase 5+) | validation evidence |

Total: ~12 file mods/adds. Under 15-file scope-split threshold.

### Reverted Phase 2 work (now out of scope)

The first Phase 2 pass wrote failing repro tests for the webhook seeding behavior (3 new tests in `apps/api/src/routes/identityProviderWebhook.test.ts` + a new `apps/api/test/integration/identity-provider-webhook.test.ts` file). With webhook seeding moved to #239, those changes are being reverted in this same Phase 1 revision pass — the #239 implementer will write fresh tests when they fix the nested-tx bug + add seeding together.

---

## C. Validation Requirements

| Mode | Required | Reason |
|---|---|---|
| `unitTestsRequired` | Yes | UI empty-state RTL; pendingItems unit |
| `integrationTestsRequired` | Yes | Real-DB verification of lazy-upsert self-heal + backfill script behavior — past coaching warns mock-only tests pass while prod fails |
| `uiValidationRequired` | Yes | Empty-state visual + action-needed banner; needs browser confirmation per P-HIGH preference |
| `mobileValidationRequired` | No | No mobile-specific layout change |
| `e2eRequired` | No | Empty-state path is rare in steady-state; cost/benefit doesn't warrant a Playwright add. RTL + integration + manual browser walk suffices |
| `buildRequired` | Yes | Full `pnpm build` per past coaching (lint-as-error only fires inside `next build`) |

---

## D. Open Questions / Decisions

| # | Decision | Resolution | Source |
|---|---|---|---|
| OD-1 | Webhook seeding approach | **Moved out of scope** — tracked on #239 | Scope correction 2026-05-17 |
| OD-2 | Backfill mechanism: Prisma migration vs `tsx` script | **`tsx` script** — easier dry-run, no migration-timestamp coordination, matches `setup-dev-brand.ts` precedent | Author decision |
| OD-3 | Backfill sets `Brand.defaultThemeId`? | **Yes — Indigo.** Mirrors lazy-upsert. Admins can override later. | User direction 2026-05-17 |
| OD-4 | Survey-editor empty-state copy + CTA | **RBAC-neutral, no outbound link.** Future RBAC may grant survey-edit without org-settings access; the viewer might not be able to act on a deeplink. | User direction 2026-05-17 |
| OD-5 | Org-settings empty-state copy | **Prescriptive — admin-only surface.** Keeps "Open Themes →" link. | User direction 2026-05-17 |
| OD-6 | Org-settings top-of-page "Action needed" rows for themes-empty / default-not-set | **Yes — extend `computePendingItems()` with both rows, `jumpToSectionId: 's-lookfeel'`.** Self-clears once data is back. | User direction 2026-05-17 |
| OD-7 | When `themes.length === 0`, also short-circuit the preview pane? | **Yes.** Single empty-state message instead of two side-by-side blank boxes. | Author decision |

---

## E. Phase Plan

| Phase | Action | Evidence |
|---|---|---|
| 1. implement-scoping | This document (revised) | `docs/evidence/405-implement-work-list.md` (this file) |
| 2. implement-repro | Write failing integration test for lazy-upsert self-heal (point 2). Run, capture red. | Append to evidence doc |
| 3. implement-tests | RTL tests for both empty states (3a + 3b); pendingItems unit test (5); backfill integration test (1). Authored alongside code. | tests on disk |
| 4. implement-code | Apply 1 → 2 → 3a/3b → 5. | code on disk |
| 5. implement-validate | `pnpm build && pnpm typecheck && pnpm lint && pnpm test:smoke && pnpm test:integration` + manual UI walk + script dry-run on dev DB | `docs/evidence/405-feature-implementation-evidence.md` |
| 6. implement-security-review | Backfill touches DB writes; no auth boundary change. Scan for tenant-scope bypass + secret exposure | append to evidence doc |
| 7. implement-regression | Run full smoke + integration suite | evidence doc |
| 8. implement-quality | DRY check (no copy-paste between admin-brand-profile self-heal and the backfill script — share seed payload via `DEFAULT_THEMES` import) | evidence doc |
| 9. implement-completeness-review | Walk the 5 in-scope points — confirm each is addressed | evidence doc |
| 10. implement-architecture-update | No architectural delta — preserving existing patterns. Mark N/A | evidence doc |
| 11. implement-submission | PR open against `main`. Body cites: closes #405, post-merge backfill runbook, validation evidence | PR URL |
| 12. address-feedback | Standard hold-point | per-review |
| 13. retrospective | Capture learnings (multi-path Brand-creation drift; webhook investigation that produced #239 scope expansion) | `docs/retrospectives/...` |
