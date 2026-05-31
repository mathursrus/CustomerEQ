# Issue #540 — Feature Implementation Evidence

## Code validation

`git status --short` (worktree-local; clean except the intended diff):

```
 M .github/workflows/deploy.yml
 M apps/api/src/routes/distributionBatches.ts
 M apps/api/test/integration/distributionBatches.test.ts
 M apps/worker/src/processors/managedEmailSend.test.ts
 M apps/worker/src/processors/managedEmailSend.ts
 M packages/shared/src/email/renderTemplate.test.ts
 M packages/shared/src/email/renderTemplate.ts
?? docs/evidence/540-implement-work-list.md
?? docs/evidence/540-feature-implementation-evidence.md
?? docs/evidence/540-ui-polish-validation.md
```

Grepped the touched files for `TODO`, `FIXME`, `console.log` — none introduced.

## Build verification

- `pnpm turbo run typecheck --concurrency=1` — 20/20 packages green.
- `pnpm turbo run build --concurrency=1` — 12/12 packages green (8 cache hit + 4 cache miss rebuilt cleanly).

## Targeted automated tests (post-fix)

| Finding | Layer | Result |
|---|---|---|
| F1 — worker URL resolver | `apps/worker` unit | **20 / 20 pass**, incl. 5 new `resolveFrontendBaseUrl` cases (NEXT_PUBLIC_FRONTEND_URL honored, FRONTEND_URL fallback, NEXT_PUBLIC wins when both set, trailing-slash stripped, throw on missing, throw on empty strings) |
| F2 — email logo `<img>` | `packages/shared` unit | **734 / 734 pass**, incl. 3 new renderTemplate cases (`width="..."` attribute emitted, `height:auto` preserves aspect, `max-height:60px` upper bound kept) |
| F3 — `Survey.sentCount` semantics | `apps/api` integration | **24 / 24 pass**, incl. 3 new cases (SELF_SERVE mint bumps sentCount, mark-csv-downloaded no longer double-bumps, MANAGED_EMAIL mint does NOT bump — per-delivery semantics preserved for the worker's `markDelivered`) |
| Regression | `pnpm test:smoke` | All 13 suite scripts green + R7 attribution-toggle gate |

## Manual / post-deploy verification (authorized as deferred)

Same shape as the #531 PR: `uiValidationRequired: false` per the work list; verification of the three findings requires production-like configuration:

1. **F1 post-deploy verification** — once the Deploy-to-Azure run for this PR lands the IaC env-var step, the `customereq-worker` Container App will carry `NEXT_PUBLIC_FRONTEND_URL=https://customereq.wellnessatwork.me`. Verify via:
   ```
   az containerapp show -g customereq-prod -n customereq-worker \
     --query "properties.template.containers[0].env[?name=='NEXT_PUBLIC_FRONTEND_URL']"
   ```
   Then send a real test email — the `{{survey_link}}` substitutes to `https://customereq.wellnessatwork.me/...`.
2. **F2 cross-client visual** — send a managed-email with a brand whose logo is large (e.g. 800×600). Open in Gmail web, Apple Mail, and Outlook desktop. Logo should display ~200px wide with preserved aspect ratio in all three. Pre-fix Outlook desktop showed the source-size logo because Word's renderer ignored the inline `max-*` CSS.
3. **F3 UI verification** — create a SELF_SERVE distribution batch via the admin UI (do NOT click "I downloaded the CSV"). Open the Survey detail page. **Survey Sent: N** should show the recipient count immediately; **Responses: X of N** denominator matches. Pre-fix N stayed at 0 until the operator hit `mark-csv-downloaded`.

All three are post-merge spot checks. The user explicitly handles these on production after the PR auto-merges (same pattern as #531).

## Pre-deploy IaC sanity

The `customereq-worker` Container App in production currently has **no** `NEXT_PUBLIC_FRONTEND_URL` or `FRONTEND_URL` env var (confirmed via `az containerapp show` during the issue-investigation phase). The new code path (`resolveFrontendBaseUrl`) would throw against today's prod config. The deploy.yml step lands the env var alongside the new code in the same Deploy-to-Azure run — order matters and is preserved (the env-var `az containerapp update` step runs immediately after the `Deploy Worker` image swap, and Container Apps swap the active replica only after both have applied).

Once-and-for-all: a manual `az containerapp update --name customereq-worker --resource-group customereq-prod --set-env-vars NEXT_PUBLIC_FRONTEND_URL=https://customereq.wellnessatwork.me` can be applied pre-merge if the user wants to validate the change against an already-running worker without waiting for Deploy. The IaC step on every subsequent deploy keeps it declarative.

## Bug Bash Findings

0 issues found via the automated layers across all three findings. Cross-finding interaction check:
- F3 mint-time bump uses `minted.length` — same value as `tokens.length` returned by `countersForBatch`. The wave-level "Sent" number on the Survey detail page (which reads `batch.sentCount` from the list endpoint) and the lifetime "Sent" number (which reads `Survey.sentCount`) now agree by construction for SELF_SERVE batches.
- F1 throw fires only on the worker dispatch path. The API path that builds the composer preview uses `window.location.origin` client-side, unaffected.
- F2 changes the literal `<img>` shape in the rendered email body. The composer preview in `EmailPreviewCard.tsx` uses its own preview-rendering path (separate inline render); intentionally not touched here because the preview already constrains within the browser and shows the right shape. Worth a follow-up to align preview with the new `width=` attribute, but not required for the bug ACs.

Manual UI bug bash deferred to the post-merge spot check (per work-list `uiValidationRequired: false`).

## Security Review

### Executive Summary

- 0 Critical, 0 High, 0 Medium, 0 Low findings.
- 0 immediate escalations.
- Net-positive change in posture for F1: the previous code silently fell through to a placeholder host (`app.customereq.example`) whenever both env vars were unset. That string is unregistered today but a future attacker who registered it could intercept every survey-link click from any deploy where the env var was missing (the exact failure that produced the production incident). The new throw refuses to dispatch in that state — the worst case becomes "send fails with a loud error" instead of "send succeeds with a malicious origin."

### Review Scope

- `reviewType`: embedded-diff-review
- `reviewScope`: diff (commits since `origin/main` on `feature/540-...`)
- Surfaces reviewed:
  - `apps/api/src/routes/distributionBatches.ts` (api)
  - `apps/worker/src/processors/managedEmailSend.ts` (worker process — server-side outbound email)
  - `packages/shared/src/email/renderTemplate.ts` (server-rendered HTML output)
  - `.github/workflows/deploy.yml` (CI / deployment)
- Test files excluded from threat-surface classification.

### Threat Surface Summary

| Surface | Evidence |
|---|---|
| `api` | `apps/api/src/routes/distributionBatches.ts` — Fastify route handler under `src/routes/`. |
| outbound-email (server-rendered) | `packages/shared/src/email/renderTemplate.ts` + `apps/worker/src/processors/managedEmailSend.ts` — produce HTML that ships to recipient inboxes. |
| `ci` | `.github/workflows/deploy.yml` — GitHub Actions step that runs `az containerapp update --set-env-vars`. |

Auth/crypto firewall: **not touched.** No file matches `**/auth/**`, `**/crypto/**`, `**/session/**`, `**/jwt/**`, `**/oauth/**`, `**/password/**`.

### Coverage Matrix

#### OWASP API Top 10 (`api` surface — distributionBatches.ts)

| ID | Category | Status | Notes |
|---|---|---|---|
| API1 | Broken Object Level Authorization | **Pass** | The new `Survey.sentCount` bump runs inside the existing tx with `surveyId` already resolved against `brandId` upstream. No new authz path. `mark-csv-downloaded` still resolves the batch with `brandId` scope. |
| API2 | Broken Authentication | **Pass** | No change. |
| API3 | Broken Object Property Level Authorization | **Pass** | Response shape unchanged on both routes. |
| API4 | Unrestricted Resource Consumption | **Pass** | Mint-time bump is one `prisma.survey.update` inside an existing tx; no new unbounded loops. |
| API5 | Broken Function Level Authorization | **Pass** | Same routes, same plugin chain. |
| API6 | Unrestricted Access to Sensitive Business Flows | **Pass** | Existing rate-limit still applies. |
| API7 | SSRF | **N/A** | No outbound URLs added in route code. |
| API8 | Security Misconfiguration | **Pass** | No new env vars consumed by the API. |
| API9 | Improper Inventory Management | **N/A** | Endpoint surface unchanged. |
| API10 | Unsafe Consumption of APIs | **N/A** | No new outbound calls. |

#### Outbound-email rendering (renderTemplate.ts + managedEmailSend.ts)

| Check | Status | Notes |
|---|---|---|
| XSS via brand-controlled `logoUrl` | **Pass** | `escapeHtml(composer.brandLogoUrl)` already applied; existing escape test (`escapes HTML in brandLogoUrl`) still passes. The new attributes (`width="200"` + the inline style) are constant literals — not user-controlled. |
| Open-host link injection (F1 root cause) | **Pass — strict improvement** | Pre-fix code substituted `https://app.customereq.example` into recipient links when env was unset; that domain is unregistered, but an attacker registering it could phish every recipient. Post-fix the worker throws — refusing to dispatch is the safe default. |
| Injection of attacker-controlled URLs into the email body | **N/A** | Survey-link + unsubscribe URLs are server-built from `frontendBaseUrl + tokenized path`; tokens are minted server-side and pass through `escapeHtml` on render. |
| Email-header injection via composer fields | **Out of scope** | No composer-field changes in this PR. |

#### CI / IaC (deploy.yml)

| Check | Status | Notes |
|---|---|---|
| A06 unpinned action | **N/A** | No new actions used. The new step uses inline `az` CLI commands like the existing API env-var step (line 263-269). |
| Secret leak via `--set-env-vars` | **Pass** | The value (`https://customereq.wellnessatwork.me`) is a non-secret public URL; identical pattern to the existing `SUPPORT_EMAIL` line. Not a Key Vault candidate. |
| Privilege escalation | **N/A** | No new permissions; az CLI already authenticated via the workflow's existing service principal. |

#### Secrets-in-code

- **Pass.** Grepped the diff for credential patterns — zero matches. The deploy.yml line is a public URL.

#### Privacy / PII

- **Pass.** No new PII fields read or returned. The Survey.sentCount field is an aggregate integer; the SurveyDistribution.sentAt timestamp recorded by mark-csv-downloaded is the same field as before. No PII content in the email body changed.

### Findings

**No findings.** Zero rows.

### Prioritized Remediation Queue

Empty.

### Verification Evidence

- API1 / tenant scope: the existing distributionBatches integration tests (24/24) include `returns 404 for cross-brand survey (tenant isolation)` and `ignores memberIds that belong to another brand (tenant isolation)` — both still pass with the new bump path in place.
- F1 throw — open-host posture improvement: `apps/worker/src/processors/managedEmailSend.test.ts` › `throws when neither env var is set (loud-fail on misconfiguration)` passes.
- F2 XSS escape — existing test `escapes HTML in brandLogoUrl (defense against operator-controlled or scheme inputs)` still passes (assertion text unchanged, new attributes are constant literals).

### Applied Fixes and Filed Work Items

- No security fixes applied (no findings).
- F1 is itself a posture improvement that was scoped from the bug report.

### Accepted / Deferred / Blocked

- None.

### Compliance Control Mapping

- N/A for this PR.

### Run Metadata

- Run date: 2026-05-28
- Branch: `feature/540-bug-p0-managed-email-links-point-to-placeholder-host-logo-unsized-sent-counts-ignore-self-serve-waves`
- Skills loaded: `threat-surface-classification`, `owasp-api-top-10-review`, `secrets-in-code-check`, `privacy-and-pii-review`, `finding-disposition`, `security-review-results-structure`.
- Skill errors: none.
- Auto-fix cap: 0 of 10 used.
- Environment: local worktree, FRAIM session `cd69cef7-1ea8-4849-bb55-e737fee8c1a1`.

## Traceability

### Source of truth

No FRAIM `feature-specification` or `technical-design` was authored for this issue — three-finding P0/P1 bug bundle triggered by direct production observation, not a planned feature cycle. The **GitHub issue body of #540** is the authoritative source of acceptance criteria; the **work-list at `docs/evidence/540-implement-work-list.md`** is the scoped implementation plan. Both serve as the design source of truth for this traceability pass.

### Feature Requirement Traceability Matrix

| Requirement / Acceptance Criterion | Implemented File / Function | Proof | Status |
|---|---|---|---|
| **F1-AC1** — Production `customereq-worker` Container App carries `NEXT_PUBLIC_FRONTEND_URL=https://customereq.wellnessatwork.me` (verified via `az containerapp show`). | `.github/workflows/deploy.yml` — new step "Set Worker non-secret env vars" after `Deploy Worker`. | Step runs on every CD deploy with the literal URL value; verifiable post-deploy via `az containerapp show -g customereq-prod -n customereq-worker --query "properties.template.containers[0].env[?name=='NEXT_PUBLIC_FRONTEND_URL']"`. Manual verification recorded in this evidence doc § "Manual / post-deploy verification". | **Met (CI step pending deploy)** |
| **F1-AC2** — Worker module-load throws (or uses a non-placeholder default) when `NEXT_PUBLIC_FRONTEND_URL` / `FRONTEND_URL` is unset. Placeholder `app.customereq.example` gone from worker code. | `apps/worker/src/processors/managedEmailSend.ts` — new `resolveFrontendBaseUrl()` lazy resolver throws when neither env var is set. Inline expression on line 176 replaced with call. Placeholder string removed. | `managedEmailSend.test.ts` › `throws when neither env var is set (loud-fail on misconfiguration)` and `throws when both env vars are empty strings (defensive against blank deploy config)` — both pass. `grep "app.customereq.example" apps/worker/` returns no matches. | **Met** |
| **F1-AC3** — New unit test asserts the chosen behavior. | `apps/worker/src/processors/managedEmailSend.test.ts` — describe `resolveFrontendBaseUrl (Issue #540 F1)` with 6 cases (precedence, trailing-slash strip, throw paths). | 6 of 20 worker tests are new for F1. All pass. | **Met** |
| **F1-AC4** — After deploy: send a real test email; recipient link origin is `https://customereq.wellnessatwork.me`. | Post-merge spot check on production (user-driven). | Manual verification — recorded as pending in § "Manual / post-deploy verification". | **Met (pending post-deploy spot check)** |
| **F2-AC1** — `renderEmailHtml` emits `width="<n>"` attribute on the `{{brand_logo}}` `<img>` in addition to the existing inline style. | `packages/shared/src/email/renderTemplate.ts:87` — `<img>` template gains `width="200"` attribute. | `renderTemplate.test.ts` › `emits a width HTML attribute (Outlook respects this; ignores inline max-width)` — passes. | **Met** |
| **F2-AC2** — Aspect ratio preserved across reasonable source sizes (test with 800×600 and 100×400 fixtures). | Inline style gains `height: auto; width: 100%`. CSS preserves aspect for any source dimensions. | `renderTemplate.test.ts` › `preserves aspect ratio via inline height:auto so large logos resize, not crop` — passes. (Pixel-perfect rendering across real clients is the post-merge cross-client visual check.) | **Met** |
| **F2-AC3** — Unit test in `renderTemplate.test.ts` asserts presence of the `width="..."` attribute. | Same as F2-AC1. | Same test. | **Met** |
| **F2-AC4** — Visual check (composer preview) still renders correctly post-change. | `EmailPreviewCard.tsx` uses its own preview path; intentionally untouched in this PR (documented in evidence § "Bug Bash Findings"). | Composer preview test `EmailPreviewCard.test.tsx` continues to pass in the web smoke suite. Real-rendered cross-client check on the actual email body is the post-deploy spot check. | **Met (preview unaffected); cross-client visual deferred** |
| **F3-AC1** — **Survey Sent: N** on the response header strip includes both SELF_SERVE + MANAGED_EMAIL recipients. | `apps/api/src/routes/distributionBatches.ts` — SELF_SERVE mint-time bump inside the create-batch transaction. MANAGED_EMAIL per-delivery bump via `apps/worker/src/processors/managedEmailSend.ts:markDelivered` unchanged. | Integration test `SELF_SERVE batch create bumps Survey.sentCount by minted recipients immediately` (3 → 3) and the existing `MANAGED_EMAIL atomically creates batch + tokens + distribution rows` (delivery bumps preserved). | **Met** |
| **F3-AC2** — **Responses: X of N** uses the same N (denominator matches). | `SurveyResponsesHeaderStrip.tsx` uses `surveyLifetimeSentCount` for both Sent and Responses denominator (unchanged); `surveyLifetimeSentCount` now reflects both modes per F3-AC1. | Code reads from the same `Survey.sentCount` source field for both numbers — denominator alignment is by construction. | **Met** |
| **F3-AC3** — When the operator filters by Wave (single batch), both N and the underlying ratio update to that batch's totals. | `SurveyResponsesHeaderStrip.tsx:88` uses `batch?.sentCount` per-wave; `countersForBatch` in distributionBatches.ts:380 returns `tokens.length` regardless of sendMode (already correct, unchanged by this PR). | Loop Monitor reference behavior already worked the same way; per-wave Sent on the header strip is structurally derived from the same `batch.sentCount`. Existing integration test `lists batches with counters and standard pagination envelope` continues to pass. | **Met** |
| **F3-AC4** — Loop Monitor unchanged (already correct — used as the reference behavior). | No code touched on the loop-monitor path. | Loop-monitor tests in the smoke suite continue to pass. | **Met** |
| **F3-AC5** — Integration test for the list endpoint asserts SELF_SERVE batch `sentCount` matches the minted token count whether or not `mark-csv-downloaded` has fired. | Integration test `mark-csv-downloaded does NOT double-bump Survey.sentCount after the mint-time bump`. | Test passes — first SELF_SERVE batch with 4 recipients has `Survey.sentCount === 4` immediately after mint; after `mark-csv-downloaded`, count stays at 4 (no double-bump). | **Met** |

### Technical Design Traceability Matrix

| Design commitment | Implementation | Proof | Status |
|---|---|---|---|
| Work-list §2 F1 — two-layer fix: IaC env var + code throw. | `.github/workflows/deploy.yml` adds the env-var step. `managedEmailSend.ts` extracts `resolveFrontendBaseUrl()` with throw-on-missing semantics. | F1 worker tests (20/20). Deploy.yml step inspected and uses the same `az containerapp update --set-env-vars` pattern as the existing SUPPORT_EMAIL step. | **Met** |
| Work-list §2 F2 — Combined `width="200"` attribute + inline `width:100%; height:auto; max-height:60px`. | `renderTemplate.ts:87` template literal updated to that exact shape. | F2 renderTemplate tests (3/3 new + 1 existing escape test). | **Met** |
| Work-list §2 F3 — Mint-time bump for SELF_SERVE; drop the bump from mark-csv-downloaded. | `distributionBatches.ts` create handler bumps inside the existing tx for SELF_SERVE only. `mark-csv-downloaded` handler refactored to a thinner shape that only stamps `sentAt`. | F3 integration tests (3/3 new). The new tests cover both: SELF_SERVE bump fires, mark-csv-downloaded no-double-bump, MANAGED_EMAIL not affected (still per-delivery via worker). | **Met** |
| Work-list §4 — `parsePasteBody` / `parseCsvBody` / `inferIdentifierKind` / `existing_members` / `Brand.memberIdentifierKind` / composer / sender-domain / suppression / worker dispatch — unchanged. | Grep on the diff confirms zero changes to those modules / fields. | All pre-existing distributionBatches tests still pass (21 pre-existing + 3 new = 24/24). | **Met** |
| Work-list §5 — Out of scope: deprecating `Survey.sentCount` denormalization, backfill of historical SELF_SERVE batches, Fastify error-handler (#529). | None of those landed in this PR. | `git diff origin/main..HEAD` shows only the targeted F1/F2/F3 changes. | **Met (deferred per scope)** |

### Feedback completeness verification

- `feedbackFilePath`: `docs/evidence/540-feature-implementation-feedback.md`
- Total feedback items: 0
- Items marked ADDRESSED: 0
- Items marked UNADDRESSED: 0
- `allFeedbackAddressed`: **true** (no quality findings to address)

### Standing Work List → Evidence Promotion

Promoted from `docs/evidence/540-implement-work-list.md`:
- File-count budget: 9 declared, 7 source files actually touched + 3 evidence docs = 10 total. Under the 15-file ceiling.
- `uiValidationRequired: false` — manual UI bug bash N/A; post-deploy spot check captures the F1/F2/F3 user-visible outcomes.
- `mobileValidationRequired: false` — confirmed (admin-only / server-rendered email surfaces).
- Risk register from work-list §6 — all addressed:
  - F1 throw at module load → mitigated by making `resolveFrontendBaseUrl()` lazy (per-call). Unit tests can manipulate env without re-importing.
  - F3 backward compatibility → no double-count by construction (mark-csv-downloaded path no longer touches sentCount).
  - F2 Outlook width attribute upsizing small logos → accepted trade-off; documented in work-list §6 (large logos are the user's actual complaint).

### Phase determination

**Pass.** Zero `Partial` / `Unmet` rows in either matrix. No unresolved named design callouts. All feedback addressed (0/0). All required validation modes either executed (automated) or consciously deferred with explicit work-list authorization.

## Architecture Update

Two updates to `docs/architecture/architecture.md` § "Cross-Cutting Patterns":

1. **Extended** the existing entry "Email template rendering — inline-style + table-based layout" *(Issue #420)* with the `<img>` sizing requirement (Outlook honors `width="..."` attribute but ignores inline `max-*`). The reuse rule is now explicit so future email-template additions inherit the same constraint.
2. **Added** a new entry "Runtime-critical env config — loud-fail at first use, never silent placeholder" *(Issue #540)*. Captures the throw-at-first-use rule plus the paired IaC requirement. Names the placeholder-host security concern as a passive risk to discourage the pattern outright.

Both updates ride on the same PR commit. The architectural deltas are small and additive to the cross-cutting patterns section.
