# Issue #420 — technical-design Evidence (RFC Round 1)

## Summary

- **Issue**: #420 — Send Survey Emails via CustomerEQ (ACS)
- **Workflow**: `technical-design` (FRAIM job)
- **Outcome**: RFC drafted at `docs/rfcs/420-send-via-customereq-acs.md`. No spike needed. Five open decisions (D1–D5) for reviewer.

## Phase completion

| Phase | Status | Notes |
|---|---|---|
| requirements-analysis | ✅ | Spec R1..R45 + architecture §3.2/§3.3/§3.4/§4.3 loaded |
| design-authoring | ✅ | No spike — phaseOutcome = default. RFC drafted. |
| technical-spike | N/A | Skipped (no high-uncertainty items) |
| architecture-gap-review | ✅ | Gap-analysis added to RFC §11 |
| design-completeness-review | ✅ (this doc) | Traceability matrix below |

## Traceability Matrix

| Requirement (Spec) | RFC Section / Data Model | Status |
|---|---|---|
| R1 Distribution tile two-button | RFC §5 (DistributionSection.tsx reshape — frontend hierarchy) | Met |
| R2 DRAFT/PAUSED/STOPPED tooltips | RFC §5 (preserved from #378 R2) | Met |
| R3 Embed snippet + Share link tiles unchanged | RFC §5 (no change cited) | Met |
| R4 3-column desktop / 1-column mobile | RFC §5 (preserves existing #241 responsive baseline) | Met |
| R5 Bookmarked URL default to mode=self-serve | RFC §3.1 (handler default) | Met |
| R6 Configure ordering Common→Audience→Composer→Action | RFC §5 (DistributePage shell) | Met |
| R7 Switch-mode link preserves state | RFC §5 (DistributePage state ownership) | Met |
| R8 Survey title + expiry editable until commit | RFC §5 (`SurveyBatchDetailsCard.tsx` controlled inputs) | Met |
| R9 Audience list visible during dispatch | RFC §5 (`ManagedEmailProgress.tsx`) | Met |
| R10 Ephemeral page state | RFC §5 (no draft persistence; closing tab loses state) | Met |
| R11 Survey name in mail input | RFC §3.1 body schema + §5 SurveyBatchDetailsCard | Met |
| R12 Links expire on presets | RFC §3.1 body schema | Met |
| R13 EOD-in-Brand.timezone snap | RFC §1.4 (preserved from #378 §2.2) | Met |
| R14 Common fields flow into both modes | RFC §3.1 body schema (CSV column / Subject default) | Met |
| R15 Wave label auto-derive | RFC §3.1 (auto-derived; not editable here) | Met |
| R16 Audience builder two add-cards side-by-side | RFC §5 (AudienceBuilder/* + AudienceList.tsx) | Met |
| R17 Glob → SQL LIKE translation | RFC §3.7 + `packages/shared/src/distributionGlob.ts` (new) | Met |
| R18 Random Sample explicit Add button | RFC §5 (`AddFromExistingMembersCard.tsx`) | Met |
| R19 Email-format parser relaxation | RFC §3.1 (audience resolution via Member.email lookup) | Met |
| R20 25/50 pagination + persisted checkbox state | RFC §5 (AudienceList.tsx) | Met |
| R21 Dedup with Source-chip resolution | RFC §3.1 (single deduped audience array) | Met |
| R22 Suppressed members disabled + Status chip | RFC §5 (AudienceList.tsx) + §3.1 (suppression-aware response shape) | Met |
| R23 Deselect + bulk actions | RFC §5 (AudienceList.tsx) | Met |
| R24 Sender block (name + alias) | RFC §5 (`ManagedEmailComposer.tsx`) + §3.1 body schema | Met |
| R25 Sender-domain resolution + warn event | RFC §3.1 (resolution order + structured log) | Met |
| R26 No brand-logo upload here | RFC §5 + §6 (logo from Brand.logoUrl only) | Met |
| R27 Body editor + mustache palette | RFC §5 (`ManagedEmailComposer.tsx`) + §6 (mustache token set) | Met |
| R28 Default body brand-logo + brand-name header | RFC §6 (template) | Met |
| R29 Theme palette resolution | RFC §6 (theme resolution order + inline-style rendering) | Met |
| R30 Auto-appended footer copy + unsubscribe link | RFC §6 + §3.6 (/u/:token endpoint) | Met |
| R31 Mode-specific primary CTA + validation gate | RFC §3.1 (validation) + §5 (button) | Met |
| R32 Confirm modal with summary | RFC §5 (`ConfirmModal.tsx`) | Met |
| R33 Self-serve Success + Managed-email Sending→Sent | RFC §5 (SelfServeSuccess.tsx + ManagedEmailProgress.tsx) | Met |
| R34 No mid-flight cancel in V0 | RFC §3.1 (no cancel endpoint) | Met |
| R35 Browser-close-safe dispatch | RFC §4 (BullMQ jobs persist independently of UI) | Met |
| R36 Survey.sentCount column | RFC §1.4 (new column) | Met |
| R37 Self-serve sentCount on CSV download | RFC §3.2 (`mark-csv-downloaded` endpoint) + §3.3 (Regenerate re-increments) | Met |
| R38 Managed-email sentCount per-recipient on worker confirm | RFC §4 (worker step 5) | Met |
| R39 Loop Monitor lifetime stat-card | RFC §5 (survey-detail page extension) | Met |
| R40 Responses header strip with Wave-filtered Sent | RFC §5 (survey-detail page extension) | Met |
| R41 Member.unsubscribedSurveysAt column | RFC §1.3 (new column) | Met |
| R42 MemberUnsubscribeToken table + /u/:token/confirm | RFC §1.7 + §3.6 | Met |
| R43 Audience builder surfaces suppressed | RFC §5 (AudienceList.tsx) + §3.1 (response shape) | Met |
| R44 Worker pre-dispatch second-gate check | RFC §4 (step 2; exclusion of emailOptIn noted) | Met |
| R45 AuditLog writes per event | RFC §3.1 / §3.2 / §3.3 / §3.5 / §3.6 / §4 (allowlists per handler) | Met |

**Result**: All 45 requirements Met. No Unmet rows. Phase passes.

### Validation alignment

Spec §Validation Plan items map directly to RFC §7:
- 9 Playwright E2E scenarios → RFC §7.3
- API integration tests → RFC §7.2
- Compliance snapshot tests (Rule 13.1–13.6) → RFC §7.1 worker unit tests + §7.2 integration tests
- BAML evals → N/A (no AI in this path)

### Architecture gaps (documented in RFC §11; reviewer call needed)

- **SSE infrastructure** — only if reviewer picks SSE on D3 (default polling per RFC).
- **Mode-parameterized React page component pattern** — new component-design pattern; worth a one-liner in architecture §3.1.
- **Two-gate compliance suppression model** — new pattern worth naming in architecture §6 (Compliance).
- **Polling-based progress UI** — borderline; documented in Loop Monitor pattern; doesn't need an explicit architecture entry.

No "incorrectly-followed" patterns identified.
