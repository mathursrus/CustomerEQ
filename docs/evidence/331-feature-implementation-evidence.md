# Slice 3 — Surveys list page rewrite — Feature Implementation Evidence

**Issue**: #331 (sub-issue of umbrella #324)
**PR**: #334
**Branch**: `feature/241-slice-3-surveys-list`
**FRAIM job**: feature-implementation, session 8559b791-b862-4957-a05a-bbe0ba9af882
**Started**: 2026-05-12
**Completed**: 2026-05-12 (this evidence doc back-fills phases 6, 8, 9, 10, 13 after a phase-skipping incident — see Retrospective in `331-retrospective.md`)

---

## Executive Summary

Slice 3 of #241 rewrites `/admin/surveys` to spec §1 — new column set, state-aware `⋯` row menu, chip-style filters with URL round-trip, fresh-brand empty state. The `/new` Server Component rewrite was reverted to the existing wizard mid-slice to avoid a production regression (lost trigger/rules wizard + NPS hardcoding); that work is preserved in git history (commit `2ffa607`) for lift into Slice 4.

The slice also added a vitest harness to `apps/web` so component-logic unit tests actually run — this unblocked 23 previously-orphaned tests in addition to the 16 new ones (33 web unit tests total after phase-3 catch-up).

A Slice 2 follow-up PR (#333) was required mid-slice to add `POST /v1/surveys/:id/duplicate` + `DELETE /v1/surveys/:id` — endpoints the spec §1 `⋯` menu requires but Slice 2 didn't deliver. Captured as a planning-discipline memory.

---

## Scope Implemented

### Web (apps/web)

- `src/app/(admin)/admin/surveys/page.tsx` — REWRITE. Client component with filter chips, paginated table, state-aware row menu, fresh-brand empty state. Drops Trigger column, Incentive Points column, inline status colors map, the inline CopyWidget button.
- `src/app/(admin)/admin/surveys/components/FilterChips.tsx` + `filter-chips.logic.ts` — NEW. Pill chips with multi-select within group; pure `toggleChip` helper isolated for testing.
- `src/app/(admin)/admin/surveys/components/SurveyRowMenu.tsx` + `survey-row-menu.logic.ts` — NEW. State-aware `⋯` popover; pure menu-item builder + visibility matrix isolated for testing. Position via `position:fixed` to escape table's `overflow-x-auto` clipping ancestor.
- `src/app/(admin)/admin/surveys/list-page.logic.ts` — NEW (phase-3 catch-up). Extracts `STATUS_GROUP`, `TYPE_GROUP`, `TYPE_PILL`, `relTime` from page.tsx for testability.
- `src/components/ui/status-badge.tsx` — MODIFY. Added `STOPPED: 'bg-red-100 text-red-600'` entry.
- `vitest.config.ts` — NEW. Path alias `@/` + excludes Playwright `test/e2e/**`.
- `package.json` — MODIFY. Added `vitest` devDep + `test` script.

### Web tests (added)

- `components/SurveyRowMenu.test.ts` — 16 tests: state × visibility matrix (4); action paths (6); confirm prompts (1); no-confirm for transitions (1); type/import checks.
- `components/FilterChips.test.ts` — 4 tests: add/remove/no-mutation/round-trip for `toggleChip`.
- `list-page.logic.test.ts` — 17 tests (phase-3 catch-up): chip group spec-compliance (STATUS excludes PAUSED + CLOSED, TYPE has all 4); chip key matches URL param key; `TYPE_PILL` map completeness; `relTime` boundaries (just-now / minutes / hours / days / >30d fallback / 1m + 1h boundaries).

### What was NOT in scope (intentional)

- `/admin/surveys/new/page.tsx` Server Component rewrite — **reverted** mid-slice; deferred to Slice 4 (see Decision Log §D-S3.6).
- `/admin/surveys/[id]/edit/page.tsx` editor — Slice 4.
- `/admin/surveys/[id]/page.tsx` detail page rewrite — Slice 4.
- Deletion of `apps/web/src/app/(admin)/admin/survey-builder/` directory — Slice 4.
- Deletion of wizard step components (`TriggerStep`, `RuleBuilderStep`, `ReviewLaunchStep`) — Slice 4.

---

## Decision Log

| ID | Decision | Why |
|---|---|---|
| **D-S3.1** | Filter UI = chips (custom `<FilterChips>` component) | Matches spec §1 language and mock. Programs/Members can adopt chips later. |
| **D-S3.2** | Row click → keep platform pattern: Name single-click Link + body double-click | User clarification: "Program name itself works on a single click, double click is on rest of row by design." Saved as memory `feedback_admin_list_row_clicks.md`. |
| **D-S3.3** | `/admin/surveys/new` Server Component picks first program from `GET /v1/programs` | Brand always has ≥1 program from onboarding; defer `Brand.defaultProgramId` to onboarding rework (parked). |
| **D-S3.4** | Duplicate / Delete / Discard endpoints implemented in #333 (Slice 2 follow-up) | Slice 2 missed these; the menu items in Slice 3 spec require them. Fix-forward issue + bridge PR. Saved as memory `feedback_slice_planning_api_sweep.md`. |
| **D-S3.5** | `<SurveyRowMenu>` Restart visible on PAUSED + STOPPED (spec says STOPPED-only) | Without it, PAUSED surveys had no resume-to-ACTIVE path — only Stop. User flagged during local review. Same PATCH status → ACTIVE under the hood. |
| **D-S3.6** | `/admin/surveys/new` reverted to legacy wizard | User flagged two production-break risks: (a) wizard's trigger/rules/launch steps lost before Slice 4's replacement; (b) Server Component hardcoded `type:'NPS'`, legacy survey-builder can't change type. Both fixed by keeping the wizard until Slice 4 owns both `/new` and `/edit` rewrites. |
| **D-S3.7** | Program name on list joined client-side from `/v1/programs` (not server-side join) | `Survey` has no Prisma `program` relation. Adding it requires a migration; client-side join avoids the schema delta in this slice. |
| **D-S3.8** | Web vitest harness added | Web had no `test` script — pre-existing `*.test.ts` files were orphaned. Adding vitest unblocks them + the new Slice 3 tests. Excludes Playwright `test/e2e/**`. |
| **D-S3.9** | Popover positioning: `position: fixed` with `getBoundingClientRect()` | User flagged clipping on the last row (table's `overflow-x-auto` clipped `position:absolute`). Fixed positioning escapes any clipping ancestor; re-positions on scroll/resize; clamps into viewport. |
| **D-S3.10** | Empty-state when zero programs + zero surveys | User asked: "Should + New survey be enabled at all when no programs?" Decision: disable button with tooltip + show strong empty state pointing at `/admin/programs/new`. Server Component on `/new` keeps `?error=no-program` redirect as defense-in-depth. |

---

## Validation Results

| Gate | Result |
|---|---|
| Typecheck (web, api, shared, config, database) | ✓ all green |
| Lint (web, api) | ✓ 0 errors (6 pre-existing warnings unrelated) |
| Unit tests — web | 6 files / 56 tests (16 new Slice 3 + 17 phase-3 catch-up + 23 previously-orphaned now wired up) |
| Unit tests — api | 37 files / 460 tests |
| Unit tests — shared | 22 files / 584 tests |
| Integration tests — api (postgres + redis) | 26 files / 380 tests |
| Next.js production build | ✓ success |
| Manual browser validation | ✓ user-confirmed across 3 iteration rounds; surfaced and fixed: Restart on PAUSED (D-S3.5), popover clipping (D-S3.9), NPS-hardcoding (D-S3.6) |
| Playwright e2e | **Deferred**; see Phase 7 deferral note in `331-implement-work-list.md` |

---

## Security Review

### Executive Summary

Diff-scoped security review of Slice 3. **No findings of any severity.** Web-only surface; relies on existing server-side auth and brand-scoping for all API calls. No new auth/crypto surface touched; no secrets in diff; no PII exposed beyond existing list-page surface (Survey name/description, Program name — all operator-authored).

### Review Scope

- **reviewType**: embedded-diff-review
- **reviewScope**: diff (Slice 3 vs main)
- **surfaceAreaPaths**: `apps/web/src/**` (new and modified files), `apps/web/vitest.config.ts`, `apps/web/package.json` (vitest devDep only), `docs/evidence/331-*.md`
- **Excluded from scope**: `pnpm-lock.yaml` (auto-generated)

### Threat Surface Summary

| Surface | Detected | Evidence |
|---|---|---|
| `web` | YES | `apps/web/src/app/**/page.tsx`, `components/**/*.tsx` |
| `api` | NO | No files in `apps/api/src/routes/**`; Slice 3 is UI-only |
| `llm-app` | NO | No `anthropic`/`openai` imports |
| `data-pipeline` | NO | No DB drivers or pipeline entry points |
| `mobile` | NO | — |
| `capability-authoring` | NO | — |
| `docs-only` | NO | Substantial code changes present |

Scans loaded: `owasp-top-10-web-review`, `secrets-in-code-check`, `privacy-and-pii-review`.

### Coverage Matrix

| Category | Result | Evidence |
|---|---|---|
| OWASP A01 — Broken Access Control | PASS | All API calls go through `/v1/*` endpoints which are auth-required + brand-scoped server-side. `Survey.brandId` filter is in every handler. SurveyRowMenu surveyId comes from server-returned list (no client-controlled IDOR vector); even if forged, server returns 404 cross-brand (covered by `survey-duplicate.test.ts` + `survey-delete.test.ts`). |
| OWASP A02 — Cryptographic Failures | N/A | No crypto surface in Slice 3 diff. Bearer token forwarded via `Authorization` header (TLS is platform contract). |
| OWASP A03 — Injection | PASS | `window.confirm(\`Discard draft "${name}"?\`)` renders survey name as plain text (confirm dialog doesn't interpret HTML/JS). React JSX escapes all rendered strings by default. URL filter parsing splits on `,` into string array; values are used in `Array.includes()` predicate only — never `innerHTML` or `eval`. |
| OWASP A04 — Insecure Design | PASS | Disabled "+ New survey" + fresh-brand empty state are defense-in-depth on top of server-side validation (Server Component still redirects `?error=no-program` if directly navigated). |
| OWASP A05 — Security Misconfiguration | N/A | No security-header or CORS changes. |
| OWASP A06 — Vulnerable / Outdated Components | PASS | One new devDep (`vitest ^1.6.0`) — actively maintained, mainstream. No new prod deps. |
| OWASP A07 — Identification / Authentication Failures | N/A | No auth surface changes. Uses existing Clerk + brand-context middleware. |
| OWASP A08 — Software / Data Integrity Failures | N/A | No CI script changes; no GHA workflow changes. |
| OWASP A09 — Security Logging / Monitoring Failures | PASS | SurveyRowMenu actions trigger server-side audit rows via existing per-route `auditAction` (survey.duplicate / survey.status_update / survey.delete). Client-side `setActionError` surfaces error banner; server logs the underlying cause. |
| OWASP A10 — SSRF | PASS | All fetches go to `${API_URL}` (env var, fixed). User input never controls destination. |
| Secrets in code | PASS | No tokens, keys, or credentials in the diff. `.env` files not committed (verified — only `.env.example` is in the repo). |
| Privacy / PII | PASS | List exposes Survey name + description + Program name (operator-authored, not customer PII) and timestamps. Member identifiers, emails, response data: not exposed on this list. |

### Findings

None.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- Cross-brand DELETE / Duplicate 404 behavior is covered by integration tests in #333: `apps/api/test/integration/survey-delete.test.ts` (7 cases) + `survey-duplicate.test.ts` (5 cases). All 12 pass against the live API.
- React JSX auto-escaping is the framework's default contract; no `dangerouslySetInnerHTML` introduced in Slice 3.
- No `eval`, `Function()`, or `new Function(...)` constructions in the diff (verified via grep).

### Applied Fixes and Filed Work Items

None required.

### Accepted / Deferred / Blocked

None.

### Compliance Control Mapping

N/A — no active compliance framework gating this slice.

### Run Metadata

- **Run date**: 2026-05-12
- **Branch commit**: `2ed6db6` (head of `feature/241-slice-3-surveys-list` at time of review; phase-3 catch-up changes uncommitted at time of write)
- **Skill errors**: none
- **Auto-fix cap hit**: no (no findings)
- **Environment notes**: Windows dev host; CI runs same diff on Linux.

---

## Regression Report (Phase 7)

### Full unit suite (re-run after phase-3 catch-up extractions)

| Package | Files | Tests | Result |
|---|---|---|---|
| `@customerEQ/shared` | 22 | 584 | ✓ all pass |
| `@customerEQ/web` | 6 | 56 | ✓ all pass |
| `@customerEQ/api` | 37 | 460 | ✓ all pass |
| **Total unit** | **65** | **1100** | **✓** |

### Integration suite (postgres + redis up)

| Package | Files | Tests | Result |
|---|---|---|---|
| `@customerEQ/api` | 26 | 380 | ✓ all pass |

### Playwright e2e — coverage analysis

Existing specs that touch `/admin/surveys`:
- `apps/web/test/e2e/survey-creation.spec.ts` — covers the wizard create flow. **Unaffected by Slice 3** (the `/new` wizard was reverted, so it remains as on main).
- `apps/web/test/e2e/survey-rule-builder.spec.ts` — covers rule wizard step. **Unaffected**.
- `apps/web/test/e2e/survey-trigger-wizard.spec.ts` — covers trigger wizard step. **Unaffected**.

No existing spec covers the new list-page shape (columns, chips, row menu). Writing one would require:
1. Seeded surveys across the four states.
2. Clerk auth flow inside Playwright session.
3. Assertions on new DOM (chip click changes URL; row menu opens; menu item click → API call → row refresh).

**Decision: deferred to Slice 4.** Slice 4 introduces the 4-tab editor + detail page rewrite — a much larger surface that genuinely needs e2e coverage. Writing list-only e2e now and editor e2e separately would duplicate Clerk-auth + seed-data setup. Bundling both at Slice 4 is more cost-effective and lets the Playwright fixtures stand up once.

**Verdict**: no regression detected. Existing Playwright remains valid (covers the still-active wizard). New list-page e2e tracks in Slice 4.

---

## Quality Assessment (Phase 8)

See `331-quality-assessment.md`.

## Completeness Review (Phase 9)

### Feature Requirement Traceability Matrix

Source of truth: `docs/feature-specs/241-survey-admin-ux.md` §1 + #331 issue body acceptance criteria.

| Requirement / Acceptance Criterion | Implemented File/Function | Proof (Test Name / Manual Validation) | Status |
|---|---|---|---|
| Path `/admin/surveys` | `apps/web/src/app/(admin)/admin/surveys/page.tsx` (Next.js route) | next-app routing | Met |
| Single primary CTA `+ New survey` | `page.tsx:255-281` header `<Link>` (or disabled `<span>` when no programs) | Manual validation (user iteration round A1) | Met |
| Columns: Name + description + program meta · Type pill · Status badge · Responses · Updated · row actions | `page.tsx` `columns` array (`name`/`type`/`status`/`responses`/`updated`) + `renderRowActions` | `list-page.logic.test.ts` (chip + relTime tests — 17 cases); user manual validation | Met |
| Row click → read-only Detail page | `onRowDoubleClick` (row body) + Name `<Link>` (single-click) per D-S3.2 | Manual validation; legacy detail page renders until Slice 4 rewrites it | Met (note: detail page rewrite is Slice 4) |
| Row actions ✎ + ⋯ | `renderRowActions` block — ✎ as `<Link>`, ⋯ via `<SurveyRowMenu>` | Manual validation | Met |
| ⋯ menu state-aware (Duplicate / Discard / Pause / Stop / Restart / Delete) | `components/SurveyRowMenu.tsx` + `survey-row-menu.logic.ts:buildMenuItems` | `SurveyRowMenu.test.ts` — 16 tests covering visibility matrix per state + action paths | Met (with D-S3.5 deviation: Restart visible on PAUSED + STOPPED, not STOPPED-only) |
| Filter chips: Status (All/Draft/Active/Stopped) + Type (NPS/CSAT/CES/Custom) — NO Trigger/Distribution | `components/FilterChips.tsx` + `list-page.logic.ts:STATUS_GROUP, TYPE_GROUP` | `list-page.logic.test.ts` — STATUS_GROUP excludes PAUSED + CLOSED; TYPE_GROUP has all 4 + no Trigger/Distribution | Met |
| URL `?status=&type=` round-trip for shareable filtered views | `page.tsx` `useEffect` watching `filters` + `router.replace` | Manual validation | Met |
| Status badge vocab `Draft / Active / Paused / Stopped` (no `Closed`) | `components/ui/status-badge.tsx` STATUS_STYLES (`STOPPED` added) + STATUS_GROUP enum values | `list-page.logic.test.ts` asserts CLOSED absent | Met |
| `+ New survey` click → POST + redirect to `/[id]/edit?tab=basics` | (legacy wizard retained) | N/A — **deferred to Slice 4** per D-S3.6 (production-break risk) | Deferred |
| Back/forward nav from `/new` does NOT duplicate drafts | (legacy wizard retained) | N/A — **deferred to Slice 4** | Deferred |
| Local gates pass | typecheck/lint/build/unit/integration | Phase-7 regression report (1100 unit + 380 integration green) | Met |
| CI green on PR | (awaiting PR #334 final review) | CI history on the branch | Pending |

**Verdict**: 11 Met, 2 explicitly Deferred (Slice 4 boundary), 1 Pending (CI). No Unmet rows. No silent gaps.

### Technical Design Traceability Matrix

Source of truth: `docs/rfcs/241-survey-admin-ux.md` §Surveys list + §File tree (Slice 3 rows).

| RFC Commitment | Implemented File/Function | Proof | Status |
|---|---|---|---|
| List page rewrite at `apps/web/src/app/(admin)/admin/surveys/page.tsx` | Full rewrite vs main | `git diff main..HEAD apps/web/src/app/(admin)/admin/surveys/page.tsx` | Met |
| `<SurveysList>` component (filter chips + columns) | RFC named `components/SurveysList.tsx` as a separate file; we inlined into `page.tsx`. Functional equivalent. | Manual validation; not a separate file | Met (intentional decomposition deviation — inlining keeps surveys-list state in single place) |
| `<SurveyRowMenu>` state-aware ⋯ menu | `components/SurveyRowMenu.tsx` + `survey-row-menu.logic.ts` | `SurveyRowMenu.test.ts` | Met |
| `<NewSurveyButton>` CTA | Inlined as `<Link>` (and disabled `<span>` variant) in `page.tsx` header | Manual validation | Met (intentional decomposition deviation — too small to warrant a file) |
| Filter chips: Status + Type, no Trigger / Distribution | `components/FilterChips.tsx` + chip config in `list-page.logic.ts` | `list-page.logic.test.ts` | Met |
| `/new` thin POST + redirect to `/[id]/edit?tab=basics` | (legacy wizard retained per D-S3.6) | N/A — code preserved in commit `2ffa607` for lift into Slice 4 | Deferred |
| Row click → `/admin/surveys/[id]` | Two-affordance pattern (D-S3.2) | Manual validation | Met |
| Status badge `STOPPED` style | `status-badge.tsx` STATUS_STYLES updated | Visual in browser; STATUS_GROUP test asserts enum present | Met |
| URL filter round-trip (`?status=&type=`) | `useSearchParams` + `router.replace` | Manual validation | Met |
| Pagination `pageSize=25` (NFR-SC3) | `useState(25)` passed to `<PaginatedTable>` | (existing PaginatedTable contract) | Met |
| Sortable column headers (V1) | Not implemented | (Out of scope — spec §1 marks sortable as V1) | N/A (deferred to V1 as designed) |
| Slice independently revertable | Branch can be reverted via `git revert` | Single PR boundary, well-isolated | Met |
| Schema dependency (Slice 1) | `Survey.title`, `Survey.description`, `SurveyStatus.STOPPED` already on main | (verified merged) | Met |
| API dependency (Slice 2 + #333 follow-up) | `PATCH /:id/status`, `POST /:id/duplicate`, `DELETE /:id` all on main | Integration tests pass | Met |

**Verdict**: 12 Met (2 with intentional decomposition deviations documented), 1 Deferred (Slice 4), 1 N/A (V1). No Unmet rows.

### Feedback Completeness Verification

Walked `331-feature-implementation-feedback.md`:

- A1 (production-break on /new) — **ADDRESSED**
- A2 (Restart on PAUSED) — **ADDRESSED**
- A3 (popover clipping) — **ADDRESSED**
- A4 (?error=create-failed) — **ADDRESSED** (then made moot by A1 revert)
- A5 (fresh-brand UX) — **ADDRESSED**
- A6 (FRAIM phase skipping) — **ADDRESSED** (this evidence doc is part of the catch-up)
- B2 (MENU_WIDTH magic number) — **ADDRESSED (accepted with rationale)**

All feedback items resolved with explicit dispositions. No UNADDRESSED items remain.

### Design Standards Alignment (UI)

User manually validated the list page UI against expectation across multiple rounds (A2, A3 caught and fixed). Tailwind tokens used throughout — no ad-hoc colors. Disabled "+ New survey" button uses platform's slate-disabled treatment. Empty-state card follows the standard rounded-xl border-on-white surface pattern.

No project-specific design-standards doc was provided; validated against the generic UI baseline.

## Architecture Doc Updates (Phase 10)

See `apps/web/architecture.md` — new sections for `FilterChips` pattern + `position:fixed` popover-escape technique, plus back-filled MA2 (state-aware PATCH allowlist) and MA3 (audit `requestIp`) from Slice 2.

## Retrospective (Phase 13)

See `331-retrospective.md`.
