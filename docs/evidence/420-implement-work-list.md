# Issue #420 — Implement Work-List

**Issue**: [#420](https://github.com/mathursrus/CustomerEQ/issues/420) — Send Survey Emails via CustomerEQ (ACS)
**Spec**: [`docs/feature-specs/420-send-via-customereq-acs.md`](../feature-specs/420-send-via-customereq-acs.md) (R7)
**RFC**: [`docs/rfcs/420-send-via-customereq-acs.md`](../rfcs/420-send-via-customereq-acs.md) (Round 2.2)
**Spike**: [`spike/420-cross-client-rendering/`](../../spike/420-cross-client-rendering/)
**Branch**: `feature/420-use-azure-communication-services-to-send-survey-emails`
**PR**: [#497](https://github.com/mathursrus/CustomerEQ/pull/497) (Draft per Rule 27)
**Issue type**: `feature` (no `implement-repro` phase needed)

## Validation Requirements

- **uiValidationRequired**: yes — RFC §5 introduces 4 new pages/sections + 4 new reusable components
- **mobileValidationRequired**: yes — email rendering must work in Gmail iOS + Apple Mail iOS (per §9.4 spike Help-needed step)
- **browser baseline**: Chrome desktop + Chrome mobile-emulator (375px) for the admin app; Gmail web / Outlook web / Apple Mail macOS / Gmail iOS / Outlook desktop / Apple Mail iOS for the rendered emails
- **manual cross-client check** is a pre-merge gate per Risk #1; screenshots go in [`docs/evidence/420-impl-ui-validation.md`](./420-impl-ui-validation.md)
- **build/test gates**: `pnpm build` must pass; `pnpm test:smoke` must pass; `pnpm test:integration` must pass; new tests required for every new contract per the §7 Test Matrix
- **codebase verification rule**: per coaching moments captured this session, **every cited file/line/function in this work-list has been verified by grep / Read at this scoping pass** — see "Verified-during-scoping" footnotes against each checklist item

## Phase-splitting decision

RFC §10 implementation order has 13 items. Counted explicit file modifications below: ~38 file touches. Per the `implementation-planning-and-scope-slicing` skill's "over 15 file modifications = Phase Splitting Candidate" rule, this work splits into 5 commit-groups against the same PR per Rule 26:

| Group | Scope | Approx. file count | Phase |
|---|---|---:|---|
| **G1** | Migration + schema.prisma + Prisma client regen | 3 | implement-code (DB) |
| **G2** | packages/shared zod + glob translator + tests | 6 | implement-tests + implement-code (shared) |
| **G3** | packages/connectors email senderAddress override + worker `managed-email-send` processor + queue producer + tests | 8 | implement-code (worker) |
| **G4** | apps/api routes (extend distributionBatches, new mark-csv-downloaded, send-progress, retry-failed, /u/:token + confirm, glob on /v1/members) + Zod inline + audit allowlists + tests | 10 | implement-code (API) |
| **G5** | apps/web shared shell + AudienceBuilder + Managed/SelfServeComposer + ConfirmModal + ManagedEmailProgress + Distribution-tile reshape + Loop Monitor + Responses-header + Wave Detail extensions + tests | 11 | implement-code (frontend) |

All groups land as separate commits on the same branch. PR stays Draft. UI work happens after G1-G4 so the frontend has real APIs to call.

## Patterns discovered during scoping

| Pattern | Location | Decision for #420 |
|---|---|---|
| Zod schemas live inline in route files, not in a `/zod/` subfolder | `apps/api/src/routes/distributionBatches.ts`, `apps/api/src/routes/members.ts`, etc. (verified via grep) | **Override RFC §3.1's reference to `packages/shared/src/zod/distributionBatches.ts`** — keep Zod inline in the route per existing pattern. Shared utility code (glob translator, mustache renderer) goes in `packages/shared/` |
| Queue-name constants in single `QUEUES` object | `packages/shared/src/queues.ts:1-16` (verified) | Add `MANAGED_EMAIL_SEND: 'managed-email-send'` to the object, matching the existing const-of-strings pattern |
| BullMQ workers in `apps/worker/src/processors/<name>.ts` | `apps/worker/src/processors/notifications.ts`, `surveyDistribute.ts` (verified) | New file: `apps/worker/src/processors/managedEmailSend.ts` |
| Worker producers in `apps/worker/src/queues/producers.ts` | Existing functions: `enqueueNotification`, `enqueueSurveyDistribute`, etc. (verified at lines 28-43) | Add `enqueueManagedEmailSend()` to the same file |
| Worker registry in `apps/worker/src/index.ts` | Existing `QUEUES.SURVEY_DISTRIBUTE` references at line 85 + 157 (verified) | Register `QUEUES.MANAGED_EMAIL_SEND` in the same shape |
| Audit-log allowlist on each route | `apps/api/src/plugins/audit.ts` (verified by existence) | New event keys: `distribution_batch.create` (extend with sendMode), `distribution_batch.csv_downloaded`, `distribution_batch.tokens_regenerated` (extend), `distribution_batch.retry_failed`, `managed_email.send_attempt`, `member.unsubscribed_surveys` — add to allowlist |
| Migrations as `<YYYYMMDD><HHMMSS>_<kebab-case>/migration.sql` | 30+ existing migrations (verified) | One new migration `<timestamp>_add_managed_email_send/migration.sql` |
| Wave Detail page exists | `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` (verified) | Extend (not replace) — preserve #378 self-serve affordances; add Composer snapshot block for MANAGED_EMAIL |
| Email connector pattern | `packages/connectors/src/email.ts:120-167` (verified) | Add optional `opts.senderAddress` parameter; backward-compatible (existing `notifications` callers unchanged) |
| TipTap absent | Confirmed by grep (no `@tiptap` imports in apps/web) | New dependency family: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-mention` |
| Survey-detail Loop Monitor pattern | `apps/web/src/components/surveys/LoopMonitor.tsx:92` (verified — 60s polling pattern) | Extend with new `lifetimeSurveySent` stat-card; the 2s send-progress polling is a separate Sending-state polling instance |

## Checklist by Group

### G1 — Migration + schema.prisma  *(impl-code; G1 must land before G2+)*

- [ ] `packages/database/prisma/schema.prisma` — Add `enum SurveySendMode { SELF_SERVE MANAGED_EMAIL }` per RFC §1.1
- [ ] `packages/database/prisma/schema.prisma` — Add `Brand.managedEmailSenderDomain String?` per RFC §1.2
- [ ] `packages/database/prisma/schema.prisma` — Add `Member.unsubscribedSurveysAt DateTime?` per RFC §1.3 (distinct from existing `Member.emailOptIn`)
- [ ] `packages/database/prisma/schema.prisma` — Add `Survey.sentCount Int @default(0)` per RFC §1.4 (no backfill, per reviewer r3291984458 and matching `Survey.responsesCount` pattern at `schema.prisma:614-615`)
- [ ] `packages/database/prisma/schema.prisma` — Extend `DistributionBatch` with `sendMode SurveySendMode @default(SELF_SERVE)` + `composerSnapshot Json?` per RFC §1.5
- [ ] `packages/database/prisma/schema.prisma` — Extend `SurveyDistribution` with `enqueuedAt`, `deliveredAt`, `failedAt`, `failureReason`, `sendMode` columns + two indexes per RFC §1.6 (sentAt stays NOT NULL per D1)
- [ ] `packages/database/prisma/schema.prisma` — Add `MemberUnsubscribeToken` model per RFC §1.7
- [ ] `packages/database/prisma/migrations/<timestamp>_add_managed_email_send/migration.sql` — Hand-edit the 14-step migration per RFC §2
- [ ] `pnpm db:generate` — Regenerate Prisma client
- [ ] `pnpm prisma migrate dev` (locally) — Verify migration applies cleanly + Prisma client compiles

### G2 — Shared utilities + tests  *(impl-tests + impl-code; G2 can run in parallel with G3 + G4)*

- [ ] `packages/shared/src/queues.ts` — Add `MANAGED_EMAIL_SEND: 'managed-email-send'` to the QUEUES object
- [ ] `packages/shared/src/distributionGlob.ts` — NEW: glob `*` → SQL LIKE `%`, glob `?` → `_`, after escaping operator-literal `%`/`_`/`\` characters; case-insensitive flag; exports `globToSqlLike(pattern: string): string` per RFC §3.7 / R17
- [ ] `packages/shared/src/distributionGlob.test.ts` — NEW: test cases `*@artistos.com`, `q2-*`, `100%off` (literal `%`), `\\foo`, `?bar`, empty pattern, leading/trailing whitespace, mixed wildcards
- [ ] `packages/shared/src/email/renderTemplate.ts` — NEW: lift `spike/420-cross-client-rendering/render-template.ts` here (the spike code that was validated in Chromium). Add unit tests for mustache substitution + link auto-styling
- [ ] `packages/shared/src/email/renderTemplate.test.ts` — NEW: mustache substitution; `rewriteLinksWithAccent` idempotency (operator-set `style=` wins); brand-logo absent case; plaintext companion render
- [ ] `packages/shared/src/types/index.ts` — Add `ManagedEmailSendPayload` interface (batchId, memberId, brandId, surveyId — keys only, full data loaded by worker)

### G3 — Connector + worker  *(impl-code)*

- [ ] `packages/connectors/src/email.ts` — Extend `sendEmailMessage(message, opts)` with `opts.senderAddress?: string`. When set, bypass `getAzureSenderAddress(env)` and use the override. Backward-compatible (verified existing call sites at lines 120-167)
- [ ] `packages/connectors/src/email.test.ts` — Add test: env-default behavior unchanged; override behavior takes precedence; missing both → throw same error
- [ ] `apps/worker/src/processors/managedEmailSend.ts` — NEW: per-RFC §4 processor. Steps: load batch+member+composerSnapshot → two-gate suppression re-check (per §13.7 / R44; **excludes** `emailOptIn` per the legitimate-interest exemption) → render via `packages/shared/src/email/renderTemplate.ts` → call `sendEmailMessage` with `opts.senderAddress` → on success: `UPDATE survey_distributions SET deliveredAt = now()` + `UPDATE surveys SET sentCount = sentCount + 1` → on failure: classify reason + `UPDATE survey_distributions SET failedAt, failureReason` → audit `managed_email.send_attempt`
- [ ] `apps/worker/src/processors/managedEmailSend.test.ts` — Tests: one per skip reason (erased / unsubscribed / no-consent / no-email); on-success delivered + sentCount; on-bounce no-retry; on-transient retry up to 3x; emailOptIn=false is NOT a skip reason
- [ ] `apps/worker/src/queues/producers.ts` — Add `enqueueManagedEmailSend(connection, payload)` matching existing `enqueueSurveyDistribute` shape
- [ ] `apps/worker/src/index.ts` — Register `QUEUES.MANAGED_EMAIL_SEND` worker with concurrency 5 (per RFC §9 / D5 with documented reasoning)
- [ ] `packages/database/prisma/seed.ts` if it exists — N/A; no seeding for #420

### G4 — API endpoints + tests  *(impl-code; G4 can run in parallel with G5 once contracts published)*

- [ ] `apps/api/src/routes/distributionBatches.ts` — Extend `POST /v1/surveys/:id/distribution-batches` per RFC §3.1: add `sendMode` discriminator + `composer` block in Zod schema; mode-branching handler; two-gate suppression at audience-resolution; `composerSnapshot` minting for MANAGED_EMAIL; one MemberUnsubscribeToken per recipient minted in same transaction; enqueue managed-email-send jobs per recipient
- [ ] `apps/api/src/routes/distributionBatches.ts` — NEW endpoint: `POST /v1/surveys/:id/distribution-batches/:batchId/mark-csv-downloaded` per RFC §3.2. Idempotent
- [ ] `apps/api/src/routes/distributionBatches.ts` — Extend `POST /.../regenerate-tokens` per RFC §3.3: overwrite `sentAt = now()` for every row in batch; audit-log carries `previousSentAt` + `newSentAt`
- [ ] `apps/api/src/routes/distributionBatches.ts` — NEW endpoint: `GET /v1/surveys/:id/distribution-batches/:batchId/send-progress` per RFC §3.4. Returns per-recipient status + `isComplete = every row has deliveredAt OR failedAt`
- [ ] `apps/api/src/routes/distributionBatches.ts` — NEW endpoint: `POST /v1/surveys/:id/distribution-batches/:batchId/retry-failed` per RFC §3.5. Re-enqueue rows with `failureReason IN ('transient_error_after_retries', 'bounce')`; excludes `skipped_*`
- [ ] `apps/api/src/routes/unsubscribe.ts` — NEW: `GET /u/:token` (public, no auth) + `POST /u/:token/confirm` (public, idempotent) per RFC §3.6
- [ ] `apps/api/src/routes/members.ts` — Extend `GET /v1/members?q=<glob>` to translate glob → SQL LIKE via `packages/shared/src/distributionGlob.ts:globToSqlLike` per RFC §3.7 / R17
- [ ] `apps/api/src/plugins/audit.ts` — Add new event keys to the allowlist: `distribution_batch.csv_downloaded`, `distribution_batch.retry_failed`, `member.unsubscribed_surveys` (verify existing keys `distribution_batch.create`, `distribution_batch.tokens_regenerated`, `managed_email.send_attempt` are added if not present)
- [ ] `apps/api/src/routes/distributionBatches.test.ts` — Tests per RFC §7.2 integration: MANAGED_EMAIL batch with suppressed members; mark-csv-downloaded idempotency; send-progress isComplete transitions; retry-failed scope
- [ ] `apps/api/src/routes/unsubscribe.test.ts` — Tests: idempotent confirm; second confirm is no-op; token verification

### G5 — Frontend + tests  *(impl-code; lands last so APIs are testable)*

- [ ] `apps/web/package.json` — Add `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-mention` deps
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` — Refactor: read `?mode=` and render `<DistributePage mode={…}/>`; default `?mode=self-serve` (preserves bookmarked-URL behavior per R5)
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/DistributePage.tsx` — NEW: mode-parameterized shell. Hosts SurveyBatchDetailsCard, AudienceBuilder, mode-specific composer, ConfirmModal, terminal state
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/SurveyBatchDetailsCard.tsx` — NEW: Survey-name-in-mail + Links-expire-on (shared across modes)
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/AudienceBuilder/AudienceBuilder.tsx` — NEW: shell + state
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/AudienceBuilder/AddFromExistingMembersCard.tsx` — NEW: wildcard search + Random Sample tab with explicit Add button per R18
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/AudienceBuilder/AddFromCustomListCard.tsx` — NEW: paste/CSV with brand-identifier-flexible parsing per R19
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/AudienceBuilder/AudienceList.tsx` — NEW: unified deduped table with Status column + suppressed-row checkbox-disabled rendering per R22
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/ManagedEmailComposer.tsx` — NEW: TipTap editor + theme-color live preview + sender + subject + body validation (must contain literal `{{survey_link}}`)
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/SelfServeComposer.tsx` — NEW: format dropdown only
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/ConfirmModal.tsx` — NEW: mode-aware confirmation summary
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/components/ManagedEmailProgress.tsx` — NEW: Sending + Sent states with 2s polling of `send-progress`; Retry-Failed control on Sent state
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx` — Extend: sendMode pill on Wave Detail; Composer snapshot block for MANAGED_EMAIL; preserve all #378 SELF_SERVE affordances (Tokens table, Edit Expiry, Regenerate Links, Download CSV)
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/page.tsx` — Extend: Distribution-tile reshape (the leftmost "Send via Email" tile gains 2 buttons per R1); Loop Monitor stat-card lifetime "Survey Sent" + mode-breakdown sub-line; Responses-section header strip with Wave-filtered Sent + Responses per R39 + R40
- [ ] `apps/web/.../AudienceBuilder.test.tsx`, `ManagedEmailComposer.test.tsx`, `ManagedEmailProgress.test.tsx` — Unit tests per RFC §7.1
- [ ] `apps/web/tests/e2e/distribute-managed.spec.ts`, `distribute-self-serve.spec.ts`, `distribute-mode-switch.spec.ts`, `distribute-suppressed.spec.ts`, `distribute-unsubscribe.spec.ts` — Playwright E2E tests per RFC §7.3 (6 scenarios)

## Acceptance — to be checked at implement-completeness-review

- [ ] All 45 spec requirements (R1..R45) have at least one passing test mapping to them per the §12 (formerly §13) Requirements Traceability table
- [ ] All 15 user scenarios (V1..V15) from RFC §7.0 are exercised by E2E + integration tests
- [ ] §7 Test Matrix all 4 suites pass: smoke, integration, e2e, BAML (N/A for #420)
- [ ] §8 Risks #1-#5 each have documented mitigation evidence in `docs/evidence/420-impl-evidence.md`
- [ ] §9.4 spike: developer's real-inbox cross-client screenshots in `spike/420-cross-client-rendering/inbox-*.png` (Help-needed step)
- [ ] §13 Observability: each log/metric/alert listed has been emitted at least once in integration tests (verifiable via test-log inspection)
- [ ] Architecture doc updated per §12.2 (mode-parameterized pattern, two-gate suppression model, managed-email-send queue)
- [ ] No production-secrets policy violations introduced (per project CLAUDE.md — verified at impl-security-review)

## External blockers

These are dependencies the implementer cannot resolve from inside the branch — not deferrals:

- **V15 cross-client real-inbox rendering**: depends on `no ACS production sender domain registered + no shared test inbox`. Spike (`spike/420-cross-client-rendering/`) is Chromium-validated; real-inbox check against Gmail web/iOS, Outlook web/desktop, Apple Mail macOS/iOS is owed during pre-merge manual validation by an operator with ACS credentials and inbox access.

## Spec-level non-goals (explicitly out of scope per spec §"Non-goals (V1+)")

These are SPEC-DECIDED non-goals — not implementer-initiated demotions. The spec author and the user agreed these surfaces are post-V0 work:

- **SSE migration path** for `send-progress` endpoint when batch sizes cross 5k or concurrent operators exceed ~10 (spec §"Non-goals" + RFC §9.1 / D3). The polling-based contract is V0; the SSE forward-compat is built into the endpoint shape so the V1 migration is non-breaking.
- **Custom-domain ACS support** (`Brand.managedEmailSenderDomain` column ships in the schema but the spec scopes V0 to the platform-default hard-coded domain per §2.3 + R25).
- **Per-survey opt-out granularity** (`Member.unsubscribedSurveysAt` is brand-wide; per-survey is V1+ per spec OQ-3 / R41).
- **ACS Event Grid webhook subscription** for per-recipient open/click/bounce telemetry (spec §"Non-goals" + RFC §13.5).
- **Per-sender-domain token-bucket rate limiter** in the worker (RFC §9.3 / D5 future lever).
- **VML conditional-comment wrapper** for the CTA button if Outlook desktop strips the styled `<a>` (RFC §8 Risk #1 escape hatch documented in `spike/420-cross-client-rendering/FINDINGS.md`).
- **Mid-flight cancel of a batch send** (spec §"Non-goals" + R34).
- **Custom email templates / brand-branded email designs** beyond `{{brand_logo}}` header (spec §"Non-goals").
- **Brand logo upload UX** in the composer (spec §"Non-goals" — V0 consumes `Brand.logoUrl`; the upload flow that populates the value is a separate Organization Settings issue).
- **Resubscribe self-serve flow** (spec §"Non-goals" — V0 requires manual `Member.unsubscribedSurveysAt = null` by brand admin).
- **Theme color-mapping legend** in the composer preview pane (mock #scene-3 lines 781–798) — explicitly marked `(design-only, no SHALL)` in spec R30e per user decision 2026-05-23.

## Forward guards (captured during this PR's address-feedback rounds)

Two rules were authored during Round 2 + Round 3 address-feedback so the gaps that surfaced on #420 cannot recur on future issues:

1. **No implementer-initiated demotion of in-scope SHALL requirements.** Round-1 PR review caught the spec/RFC author proposing a "Known V0 simplifications" framing as an implementer escape hatch for R16 / R18 / R20 / R22 / R23 / R27 / R39 / R40 / R43. No sanctioned `feature-implementation` process exists for the implementer to demote a numbered R-statement to a follow-up issue. The legitimate carve-outs are: (a) **external blockers** named verbatim with the dependency cited (V15 above); (b) **spec-level non-goals** that the spec author already decided and listed in §"Non-goals" (above). Anything else lifts in the same PR.
   - Coaching artifact: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md`.

2. **Grep before claiming backend state.** Round-2 PR review caught the implementer asserting `/send-progress` was SSE-based — based on reading spec prose at §2.6b without grepping the actual route. Reality: the endpoint is a plain GET polled at 2s, fully consistent with V0 (SSE is the V1 migration path). Spec prose is not the source of truth for capability claims; the **code, schema, or migration** is.
   - Coaching artifact: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T18-14-24-trusted-spec-prose-without-grepping-route.md`.

3. **Spec prose is not a deliverable; only R-statements are SHALL.** Round-3 mock-walkthrough audit caught the spec describing 8 substantial mock surfaces (live preview pane, progress bar, recap rows, CSV preview pane, confirm-modal summaries, etc.) only in §-prose without corresponding R-numbers. The implementer is requirements-driven and traceability-keyed; prose-only affordances slip past every gate. Compound R-statements (R32 with 6 sub-clauses bundled into one SHALL) produce the same gap from the other direction. The structural fix is FRAIM issue [#473](https://github.com/mathursrus/FRAIM/issues/473): `feature-specification` job template restructure to brief-prose + scene-by-scene R-statements + mock-to-R cross-reference table as `spec-finalize` precondition + R-granularity rule rejecting compound SHALLs at author-time.
   - Coaching artifact: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T21-51-24-mocks-are-not-summarizable-design-artifacts.md`.

## Open Questions for this phase

None at scoping time. The 6 RFC Open Decisions (D1–D6) are all resolved. V15 cross-client real-inbox check is filed under §"External blockers" above with the dependency cited verbatim — it is the only remaining Partial across the Feature + Technical-Design traceability matrices.
