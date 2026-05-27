# Issue #420 — Mock-walkthrough UX audit (Item M)

**Date**: 2026-05-23
**Branch**: `feature/420-use-azure-communication-services-to-send-survey-emails`
**Mock**: `docs/feature-specs/mocks/420-send-via-customereq-acs.html` (1344 lines, 11 scenes)
**Spec**: `docs/feature-specs/420-send-via-customereq-acs.md` (R1–R45)
**Procedure**: per Phase-12 handoff §"Item M"; `[[always_open_html_mocks]]` + `[[mock_drift_is_my_responsibility]]`.

## Audit method

The handoff procedure called for side-by-side visual comparison against the dev server. Dev was started and `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` + `PLAYWRIGHT_TEST=true` were set on the web process so Clerk-protected `/admin/...` routes render. **The dev DB is empty** and the API auth bypass requires at least one Brand row, so survey-scoped routes (every scene except `/admin/surveys` list) render the `Loading…` skeleton: API calls return 401 because the auth-bypass path requires a seeded Brand. `pnpm seed:demo` was attempted and fails at the same `401 Authorization header is required` on `POST /v1/programs` — it needs an MCP API key or a separately-seeded Brand row.

**Primary evidence is therefore source-vs-mock code reading** — every drift item below cites the exact mock line and the exact implementation file:line so a reviewer can re-verify without running anything. Where rendering was feasible (entry tile shell, distribute-page shell), Playwright snapshots are saved under `.playwright-mcp/`. Visual confirmation against seeded data is **owed before merge** and is filed below as the only "needs visual" follow-up per scene.

**Severity vocabulary** (per handoff procedure):
- **verbiage** — copy text differs (e.g., default subject string).
- **icon** — emoji or pictogram glyph differs.
- **layout** — structural shape differs (cards vs inline, column counts, ordering).
- **color** — semantic color class differs.
- **affordance** — interactive element present/absent/styled-as-different-CTA.
- **missing** — entire subcomponent absent from implementation.
- **mock-drift** — the implementation is correct per spec; **the mock is wrong** and the mock file is the closure target.

**Scope vocabulary**:
- **#420-owed** — touched by Items A–E or D/D.2 this PR; closure obligation falls on this PR per `[[mock_drift_is_my_responsibility]]`.
- **#378-preexisting** — surface unchanged by #420; documented but closure may belong to a separate cleanup.
- **mock-update** — mock file should change, not impl.

---

## Scene 1 · Distribution entry tile (`#scene-1`, mock lines 307–367)

**Impl**: `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx`

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 1.1 | "Send via CustomerEQ" button uses primary-filled style instead of outline-primary (mock spec-note `308` explicit: *"Leftmost tile has two equal-weight peer buttons (both outline-primary). Neither path is 'primary' — the operator's situation determines which is right."*) | line 341–342: both buttons `class="btn outline-primary"` | `DistributionSection.tsx:141` (managed-email link) uses `bg-indigo-600 ... text-white` (filled primary); `:147` (self-serve link) uses outline. | **affordance** (presents one path as preferred, contradicting spec §1 R1) | **#420-owed** |
| 1.2 | Tile icon | line 338: `📨 Send via Email` | `DistributionSection.tsx:131` `📧 Send via Email` | icon | **#420-owed** |
| 1.3 | Tile body copy framing | line 339: *"Reach members by email — either let CustomerEQ deliver, or download per-recipient links for your own email tool. Both paths share the same audience builder and common fields."* | `DistributionSection.tsx:134` *"CustomerEQ sends the emails for you, or generate per-recipient links for your own ESP."* | verbiage (loses "Both paths share the same audience builder" framing) | **#420-owed** |

---

## Scene 2 · Distribute page · SELF_SERVE (`#scene-2`, mock lines 370–537)

**Impl**: `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/SelfServeFlow.tsx` + `SurveyBatchDetailsCard.tsx` + `audience-builder/`

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 2.1 | Step-1 label text | mock line 395: `STEP 1 · SHARED · BOTH MODES — Define batch attributes` (uppercase, single line) | `SurveyBatchDetailsCard.tsx:42` chip: `Step 1 · Shared · Both modes`; heading: `Survey Batch details` — heading text matches mock h3 but chip suffix `— Define batch attributes` is missing | verbiage (minor — chip-vs-heading split is intentional, but suffix wording lost) | **#420-owed** |
| 2.2 | "Generate N links" CTA missing trailing arrow glyph | mock line 531: `Generate 6 links →` | `SelfServeFlow.tsx:426` `Generate ${audience?.selectedCount ?? 0} links` (no arrow) | verbiage | **#420-owed** |
| 2.3 | Pre-submit recap line above CTA | mock line 530 send-bar: *"Ready to generate **6 links**. Survey name: **Q2 2026 NPS**. Expires **2026-05-28 23:59 PT**. Format: **Generic**."* | `SelfServeFlow.tsx:417–428` — bare CTA with no summary | affordance (loses last-chance recap before commit) | **#420-owed** |
| 2.4 | Format dropdown wording in field help | mock line 521: *"The CSV's column headers + `mergeTagUrl` wrapping are tuned to the chosen format. Format dropdown is also surfaced on the Success state for re-download."* | `SelfServeFlow.tsx:405–408` — copy reads *"You can re-pick the format on the Success state for re-download."* | verbiage (minor) | **#420-owed** |

Note: the spec mock's mid-page side-card "2 matching members are suppressed" warning, suppressed-row title-tooltip text, and the lifted-paragraph "Why suppressed members are shown but disabled" explainer live inside `AudienceBuilder`; not separately audited here — covered by the Item-E audience-builder test suite.

---

## Scene 2B · Custom List · non-email brand (`#scene-2b`, mock lines 540–619)

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 2B.1 | Group-header rows in audience list ("Existing — matched on external_id", "Existing — matched on email lookup", "⚠ Suppressed — existing members matched but cannot be sent to", "⚠ Emails not found — cannot be auto-enrolled because Brand identifier is `<non-email>`") | mock lines 586, 592, 597, 602 | `AudienceBuilder` source (`distribute/_components/audience-builder/`) — need to verify visually. Reading shows a flat unified list; grouping headers may not be rendered. | layout / missing (needs visual confirmation against seeded non-email brand) | **#420-owed (Item E)** |
| 2B.2 | "Recovery for unmatched: add `<email>` via Members → New with the corresponding `<external_id>` first." | mock line 608 | Not surfaced in implementation source | missing | **#420-owed (Item E)** |

These are scoped to the audience builder lifted in Item E — defer formal closure until visual verification is possible against a seeded non-email brand. **Not blocking** the audit's other closures because every other Item-E test passes (29 tests in commit `7b8848e`).

---

## Scene 3 · Distribute page · CUSTOMEREQ EMAIL (`#scene-3`, mock lines 622–810)

**Impl**: `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx`

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 3.1 | h1 information architecture | mock line 639: h1 = `Send via CustomerEQ` + mode pill, with breadcrumb being the survey | `ManagedEmailFlow.tsx:291–292` eyebrow = `Send via CustomerEQ`; h1 = `{survey.title ?? survey.name}` — survey name promoted to h1 | layout (acceptable design evolution? — but diverges from mock) | **#420-owed (review)** |
| 3.2 | Step-2 chip wording | mock line 418: `Step 2 · Select members` (just the step counter) | `ManagedEmailFlow.tsx:318` `Step 2 · Shared · Both modes` chip + h2 `Select members` | verbiage (chip text adds "Shared · Both modes" qualifier — arguably an improvement on the mock) | **#420-owed** |
| 3.3 | Step-3 / composer chip wording | mock implicit (no step label on composer); composer h3 = `Sender`, then separate h3 `Email` | `ManagedEmailFlow.tsx:334` single chip `Step 3 · Mode-specific · CustomerEQ Email` with h2 `Compose email` | layout (consolidates sender+email into one section; arguably cleaner) | **#420-owed (review)** |
| 3.4 | Default Subject template | mock line 708: `Quick question: Q2 2026 NPS` | `ManagedEmailFlow.tsx:75` `DEFAULT_SUBJECT_PREFIX = 'A quick survey from'` → `"A quick survey from Q2 2026 NPS"` | verbiage | **#420-owed** |
| 3.5 | Default Body template — missing `{{brand_logo}}` + `{{brand_name}}` header block | mock lines 726–728: body starts `{{brand_logo}}\n{{brand_name}}\n\nHi {{first_name}}...` | `ManagedEmailFlow.tsx:73` `DEFAULT_BODY` is `<p>Hi {{first_name}},</p>...` — no brand_logo/brand_name header tokens | verbiage (loses default branded header block; mock line 737 field-help describes this default explicitly) | **#420-owed** |
| 3.6 | Default Body copy — wording differs | mock lines 729–736 | `ManagedEmailFlow.tsx:73` says *"We'd love your feedback on your recent experience with {{brand_name}}"* + *"Two minutes. [Take the survey]({{survey_link}})"*; mock says *"We'd love your feedback on {{survey_title}}. It takes about 2 minutes."* + bare `{{survey_link}}` line | verbiage | **#420-owed** |
| 3.7 | Toolbar buttons | mock line 713–724: B / I / 🔗 / • List / {{survey_link}} {{first_name}} {{last_name}} {{survey_title}} {{sender_name}} {{brand_name}} {{brand_logo}} (7 mustache buttons) | `MustacheEditor` toolbar (separate component) — need to verify count. Mention palette is implemented but toolbar count not confirmed. | affordance (needs visual confirm) | **#420-owed** |
| 3.8 | Auto-appended footer preview ("not editable") | mock lines 740–744: shows *"You received this survey because you're a customer or partner of {{brand_name}}. Unsubscribe from future survey emails from {{brand_name}}."* in a footer-preview block under the body editor | `ManagedEmailFlow.tsx` — no footer preview visible in the composer surface | **missing** (substantial — operators have no visibility into the legally-required unsubscribe footer the worker auto-appends) | **#420-owed** |
| 3.9 | Live email preview pane (right column) | mock lines 747–800 — `<div class="preview-card">` showing rendered "Live preview · 'Alice Chen'" with theme banner, email-frame, theme color legend | `ManagedEmailFlow.tsx` has no live preview pane | **missing** (substantial — spec §2.3 "Configure → preview → send" affordance; loss of WYSIWYG confidence before commit) | **#420-owed (NEEDS USER DISCUSSION — large scope)** |
| 3.10 | Send-bar recap before CTA | mock line 803: *"Ready to send **6 emails** from **Acme CX Team <feedback@customereq.wellnessatwork.me>**. Survey name: **Q2 2026 NPS**. Links expire **2026-05-28 23:59 PT**."* | `ManagedEmailFlow.tsx:409–418` bare CTA only | affordance (matches drift 2.3) | **#420-owed** |
| 3.11 | Theme color-mapping legend | mock lines 781–798 — shows which BrandTheme column drives which rendered element + resolution-order note (`Survey.themeId` → `Brand.defaultThemeId` → CustomerEQ default) | No legend surface anywhere | missing (educational affordance; ties to live preview) | **#420-owed (deferred to drift 3.9)** |

---

## Scene 4 · Confirmation modals (`#scene-4`, mock lines 813–852)

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 4.1 | SELF_SERVE confirmation modal **completely missing** | mock lines 818–833: modal h3 `⚠ Generate 6 tokenized links?` + Self-Serve mode tag + summary (Survey name / Links expire / Format / Recipients) + strong-warning *"⚠ The plaintext URLs are shown only once. Save the CSV immediately. Re-downloading later requires regenerating all tokens (which invalidates the URLs in this batch)."* + Cancel / Yes-generate buttons | `SelfServeFlow.tsx:417–428` — the Generate button calls `handleGenerate` directly, no confirm step | **missing** (entire confirmation modal); spec §2.5a explicit | **#420-owed (substantial)** |
| 4.2 | MANAGED_EMAIL confirmation rendered as inline section, not centered modal | mock lines 835–849: `<div class="modal">` backdrop + h3 `⚠ Send 6 emails?` + summary lines + warning "you cannot cancel a send in progress" + Cancel / Yes-send-N buttons | `ManagedEmailFlow.tsx:422–451` renders an inline `<div role="dialog">` (not a centered modal); header `Confirm send`; warning text differs (`Recipients can't be recalled after dispatch begins`); summary lines (From/Subject/Survey-name/Links-expire) absent — only sender alias is shown | layout / verbiage (inline-vs-modal is a UX-call; missing summary is more concrete) | **#420-owed** |

---

## Scene 5A · SELF_SERVE Success — Download CSV (`#scene-5a`, mock lines 856–922)

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 5A.1 | Sent-semantics explainer (blue box) | mock lines 881–884: *"📤 **Sent semantics for this mode:** Self-serve hands the operator a CSV they paste into their own email tool — the platform marks each member's `SurveyDistribution.sentAt` at the moment of **CSV download**..."* + Regenerate behavior follow-up | `SelfServeFlow.tsx:454–470` — no semantics explainer | missing (operator confusion risk re Sent counter) | **#420-owed** |
| 5A.2 | CSV preview pane | mock lines 900–911 — right column showing first ~6 rows of the CSV ("preview-head 📄 CSV preview (Generic format)" + `csv-body` + footer "6 rows · 1 batch · Survey.sentCount += 6") | `SelfServeFlow.tsx:472–493` — no preview | missing (loss of preview-before-download confidence) | **#420-owed (NEEDS USER DISCUSSION — moderate scope)** |
| 5A.3 | Done-back-to-survey CTA styling | mock line 916: `<a class="btn primary">Done — back to survey →</a>` | `SelfServeFlow.tsx:495–499` `<button class="text-sm text-indigo-600 hover:underline">Done — back to survey →` (text link, not primary button) | affordance (mock treats this as the page's terminal primary CTA) | **#420-owed** |
| 5A.4 | Filename hint surface | mock line 898: `Filename: Q2-2026-NPS-2026-05-21-links.csv` | `SelfServeFlow.tsx:284–285` builds filename but doesn't surface it pre-download | affordance (minor) | **#420-owed** |

---

## Scene 5B · CUSTOMEREQ EMAIL Sending (`#scene-5b`, mock lines 925–971)

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 5B.1 | Progress headline `Sending… 4 of 6 complete` | mock line 947 | `ManagedEmailFlow.tsx:455–457` h2 = `Sending…` (no count) | verbiage / missing | **#420-owed** |
| 5B.2 | Progress bar (visual `progress-bar` with `width: 66%`) | mock lines 948 | `ManagedEmailFlow.tsx:458–479` shows 4 `Stat` tiles; no progress bar | missing (loss of at-a-glance % indicator) | **#420-owed** |
| 5B.3 | "Retry failed (1)" affordance available **during** sending (next to progress bar) | mock line 949 | `ManagedEmailFlow.tsx:467–478` shows retry only on the `sent` (terminal) state | affordance (mock has retry available pre-completion; impl gates to terminal) | **#420-owed (review — gating may be intentional)** |
| 5B.4 | Reassurance copy *"You can leave this page; sending continues in the background."* + "Skip ahead to Sent state →" affordance | mock lines 964–967 | Neither line present | missing | **#420-owed** |
| 5B.5 | Per-recipient table — `Sent / failed at` timestamp column | mock line 953 has 4-col table: Name · Identifier · Status · Sent/failed at | `SendProgressTable` (`apps/web/src/components/surveys/SendProgressTable.tsx`) — need to verify column count. Per `RecipientSendLogBlock.tsx:91–95`, the same table is reused on Wave Detail. | needs visual confirm | **#420-owed** |

---

## Scene 5C · CUSTOMEREQ EMAIL Sent (`#scene-5c`, mock lines 975–1021)

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 5C.1 | Page header text | mock line 991: `Q2 2026 NPS — sent` + mode pill | `ManagedEmailFlow.tsx:455–457` h2 = `Sent` only; no survey-name | verbiage | **#420-owed** |
| 5C.2 | Sub-line `Batch ... · 6 recipients · 5 sent · 1 failed.` | mock line 992 | Not present (replaced by Stat tiles, which is fine — but the sub-line summarizes everything in one human-readable line) | verbiage | **#420-owed (minor)** |
| 5C.3 | Top progress-banner `summary-warn` styling for partial-failure case | mock lines 996–999: amber-warn banner `✓ Sent 5 of 6 emails. 1 failed.` + Retry-failed button | `ManagedEmailFlow.tsx:454` plain section, no banner | affordance (loss of warning emphasis when there are failures) | **#420-owed** |
| 5C.4 | Footer line "Survey Sent count is now **5 (managed) + previous**" link to Distribution batches | mock line 1014 | Not present | missing (post-action context link) | **#420-owed** |

---

## Scene 6 · Survey detail (Loop Monitor + Responses) (`#scene-6`, mock lines 1024–1146)

### Loop Monitor surfaces (mock 1045–1075)

**Impl**: `apps/web/src/components/surveys/LoopMonitor.tsx`

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 6.1 | Loop Monitor card layout — 4 stat cards in 4-col grid | mock lines 1049–1069: Survey Sent / Responses Received / Closed-loop Actions / P75 Time-to-Action | `LoopMonitor.tsx:118–134` renders 5 funnel stages with `›` separators: Survey Sent → Responses Received → Rules Matched → Campaigns Triggered → Loyalty Outcomes. Different KPIs (Closed-loop Actions + P75 Time-to-Action are absent; Rules Matched + Campaigns Triggered are extra) | layout (substantial structural divergence) | **#241 R32b territory — out of #420 scope** (note in audit, do not close in this PR) |
| 6.2 | R39 per-mode breakdown — pills inline on the card subline | mock line 1053: *"5 via CustomerEQ <span class='pill mode-managed-acs'>Managed</span> · 6 via my email tool <span class='pill mode-self-serve'>Self-serve</span>"* (pills inline) | `LoopMonitor.tsx:124–128` subline: *"K via CustomerEQ · M via my email tool"* — no pills inline (pills only show in the click-drawer at `:222–232`) | icon / affordance (subline lacks mode pills the mock places inline) | **#420-owed (Item B)** |
| 6.3 | Lifetime-anchor note ("Loop Monitor stays lifetime-wide regardless of Wave filter") | mock lines 1071–1073: surface-muted note | `LoopMonitor.tsx` — no such note rendered | missing (operator-education affordance) | **#420-owed (minor)** |

### Responses header strip (mock 1077–1104)

**Impl**: `apps/web/src/app/(admin)/admin/surveys/[id]/components/SurveyResponsesHeaderStrip.tsx`

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 6.4 | **MOCK-DRIFT**: mock says `(lifetime · not affected by Wave filter)` for Sent | mock line 1087 | `SurveyResponsesHeaderStrip.tsx:73` correctly says `lifetime · changes with Wave filter` (matches **spec R40** at `docs/feature-specs/420-send-via-customereq-acs.md:804`: *"Both Sent and Responses values SHALL update when the Wave filter changes"*) | **mock-drift** (impl is correct per spec; mock contradicts spec R40 — confirmed in the Round-6 clarification at spec lines 382–384) | **mock-update** |
| 6.5 | Responses caption wording | mock line 1092: `(36% · changes with the Wave filter on the right)` | `SurveyResponsesHeaderStrip.tsx:110–113` `(X% · response filters apply)` | verbiage | **#420-owed** |
| 6.6 | Wave-dropdown first option text | mock line 1098: `All waves & direct responses` (ampersand) | `SurveyResponsesHeaderStrip.tsx:135` `All waves and direct responses` (word) | verbiage (tiny) | **#420-owed (cosmetic)** |
| 6.7 | Wave-dropdown option format | mock lines 1099–1100: `Q2 2026 NPS · 2026-05-21 · 5 sent · 2 responded (CustomerEQ Email)` (label · date · N sent · M responded + mode parenthetical) | `SurveyResponsesHeaderStrip.tsx:138–140` `{b.label} · {date} · {respondedCount} / {sentCount}` (no "sent"/"responded" words; no mode parenthetical) | verbiage / affordance (loses mode disambiguation in the option text — esp. relevant for survey-detail "which wave was managed vs self-serve?") | **#420-owed** |
| 6.8 | Extra affordance: "Details →" link next to dropdown when batch selected | (not in mock) | `SurveyResponsesHeaderStrip.tsx:146–153` | **addition** (impl adds an affordance not in mock — judgment call: keep as enhancement, or remove for mock parity) | **#420-owed (review)** |

### Configuration summary footnote (mock 1136–1138)

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 6.9 | Footnote *"Configuration Summary is what was configured on this survey. Stat counters (Sent / Responses / Closed-loop Actions) live in the Loop Monitor and Response section above — not here."* | mock lines 1136–1138 | `ConfigurationSummarySection.tsx` (not re-read in this audit — flag as needing verification) | needs verification | **#420-owed (minor)** |

---

## Scene 7A · Wave detail · SELF_SERVE (`#scene-7a`, mock lines 1149–1263)

**Impl**: `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/batches/[batchId]/page.tsx`

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 7A.1 | Counter strip — 5 big cards in grid (Sent · Awaiting · Responded · Failed · Expired) | mock lines 1172–1198 (5-col grid, each card with uppercase label + 24px number + caption) | `page.tsx:279–291` renders 4 inline `<span>` text spans: `Sent: N`, `Responded: N`, `Awaiting: N`, `Expired: N`. No big cards. No `Failed` field shown (n/a-for-self-serve case lost). | layout (substantial — loss of at-a-glance KPIs) | **#378-preexisting** (Wave Detail counters predate #420) — *but* Item D added the mode pill in this area, so the layout pass is partially in #420 scope |
| 7A.2 | Self-serve Sent-semantics explainer (blue box) | mock lines 1200–1202: *"**Sent semantics on this batch (Self-serve):** incremented when the operator downloaded the CSV..."* | `page.tsx` — no explainer | missing | **#420-owed (R36–R40 context)** |
| 7A.3 | Audience Spec table — missing "Format chosen", "Created by" rows | mock lines 1207–1215: Mode · Members-at-send · Members-now · Survey-name-in-mail · Links-expire-on · Format-chosen · Created | `page.tsx:294–304` shows description + 2 counts + "Created at {time} by {createdBy}"; missing dedicated rows for surveyNameInMail, expiresAt (in separate section below), Format-chosen | layout / missing (Format-chosen entirely absent) | **#378-preexisting** |
| 7A.4 | Regenerate-behavior explanation paragraph under tokens table | mock line 1250: *"Regenerate behavior preserved from #378 §3.1: clicking Regenerate Links mints fresh tokens for every member in this batch (responded members keep their `respondedAt`; their token is replaced but their response stays attributed to them), invalidates the previous URLs, downloads a new CSV. Survey `sentCount` + this batch's Sent counter re-increment to reflect the new dispatch handoff."* | `page.tsx:430–439` shows a different modal warning copy; no inline-table explanation | verbiage / missing | **#378-preexisting** (modal copy was #378's design; mock-update may apply) |
| 7A.5 | "⚠ No platform-side send log for Self-serve batches" warning box | mock lines 1255–1257 amber-warning | `page.tsx` — not present | missing (operator-confusion guard re per-recipient log absence) | **#420-owed (semantics)** |

---

## Scene 7B · Wave detail · CUSTOMEREQ EMAIL (`#scene-7b`, mock lines 1266–1341)

**Impl**: same `page.tsx` + `ComposerSnapshotBlock.tsx` + `RecipientSendLogBlock.tsx`

| # | Drift | Mock | Impl | Severity | Scope |
|---|---|---|---|---|---|
| 7B.1 | **MOCK INCOMPLETE**: mock body ends at Audience Spec (line 1335) — no depiction of Composer Snapshot or Recipient Send Log blocks even though scene-note (line 1267) promises *"Composer snapshot + per-recipient delivery log are visible because the platform dispatched the emails."* | mock lines 1266–1341 | Items D + D.2 implemented `ComposerSnapshotBlock` + `RecipientSendLogBlock` (commits `1df5cb2` + `da92799`). No drift; mock is incomplete. | **mock-drift / mock-update** | **mock-update** (extend mock to depict the two new blocks) |
| 7B.2 | Managed Sent-semantics explainer | mock lines 1318–1320: *"**Sent semantics on this batch (CustomerEQ Email):** incremented per-recipient as the platform confirms email delivery."* | `page.tsx` — no explainer | missing (mirror of 7A.2) | **#420-owed** |
| 7B.3 | Counter strip — same 5-card layout as 7A but with Failed showing actual count, "via CustomerEQ Email confirmed delivery" caption on Sent | mock lines 1288–1314 | Same flat inline `<span>` layout as 7A; Failed is rendered but as inline text only | layout (mirror of 7A.1) | **#420-owed (Item D context — managed-specific Failed should display)** |
| 7B.4 | Scene-note mentions *"Resend (V1.x candidate; out of V0 scope per Non-goals)"* | mock line 1267 (scene-note) | This is **scene-note text in the mock itself**, not implementation drift — but the V0/V1.x framing is exactly what the Round-1 coaching moment warned against. The mock-note's V0/V1 framing predates Phase 12 and the user has not yet flagged it. | **mock-update (process)** | **mock-update** (suggest re-wording scene-note to avoid V0/V1 framing) |

---

## Closure status (final, 2026-05-23)

Updated 2026-05-23 after M1–M8 + spec patch + mock-update landed. Commits on this branch:
- `0ae6360` — **spec patch**: R32 → R32a–f split; R30a–e added for live preview pane (R30e marks the color-mapping legend `(design-only, no SHALL)` per user); R31a added for pre-submit recap rows; Mock-to-R cross-reference table appended.
- `8b462e6` — **M7** confirm modals (R32a–f) for both SELF_SERVE + MANAGED_EMAIL.
- `cbe32db` — **M8** Scene 3 right-column live email preview pane (R30a–d) + brand context name/logoUrl plumbing + 9 EmailPreviewCard tests.

## Earlier closure status

Updated 2026-05-23 after M1–M6 + mock-update landed. Commits on this branch:
- `fcf60e9` — M1 (Scene 1 outline-primary peers + icon + copy)
- `4ae9f0b` — M2 (Scene 6 Responses caption + dropdown + sendMode plumbing)
- `7f0198b` — M3 (Scene 2/3/5A recaps + arrows + Done primary)
- `97b41ff` — M4 (Scene 3 composer defaults)
- `1be11e1` — M5 (Scene 6 LoopMonitor pills inline + lifetime-anchor note)
- `7d36b3a` — M6 (Wave Detail Sent-semantics + Self-serve no-platform-log warning)
- `8d4181b` — Mock-update (Scene 6 R40 caption + Scene 7B Composer/SendLog blocks + V0/V1 framing removed from 7B scene-note)

**CLOSED**: 1.1, 1.2, 1.3, 2.2, 2.3, 3.4, 3.5, 3.6, **3.8** (drift 3.9's preview pane shows the footer), **3.9** (M8), 3.10, **4.1** (M7), **4.2** (M7), 5A.3, 6.2, 6.3, 6.4 (mock), 6.5, 6.6, 6.7, 7A.2, 7A.5, 7B.1 (mock), 7B.2, 7B.4 (mock).

**Spec-side closures (commit `0ae6360`)**: R32 split into R32a–f; R30a–e added (R30e explicitly marks the color-mapping legend `(design-only, no SHALL)` per user); R31a added; Mock-to-R cross-reference table appended.

**DEFERRED per user 2026-05-23** (user will revisit during manual testing — not closed in this PR):
- 5A.2 — CSV preview pane on Success state
- 5B.1 / 5B.2 / 5B.4 / 5B.5 — Sending headline + progress bar + reassurance copy + per-recipient table column verification
- 5C.1 / 5C.2 / 5C.3 / 5C.4 — Sent state header + summary line + amber banner + post-action context
- (User said: *"2,5,6,7 I will revisit when I do manual testing"*; 3.8 was on that deferred list but is now closed because drift 3.9's preview pane renders the auto-appended footer.)

**Out-of-scope (design-only or pre-existing surfaces — not in #420)**:
- 3.11 — Theme color-mapping legend (user 2026-05-23: not for V0 → R30e marks this `(design-only, no SHALL)`).
- 6.1 — Loop Monitor 4-card vs 5-stage layout (#241 R32b territory).
- 6.8 — "Details →" link addition (mock parity vs UX improvement — judgment call kept).
- 6.9 — Configuration-summary footnote (needs verification but pre-existing #241 surface).
- 7A.1 / 7A.3 / 7A.4 / 7B.3 — Wave Detail counter-strip layout, Audience Spec missing rows (#378-preexisting).

**STILL OPEN — visual confirmation owed against seeded data**:
- 2B.1 / 2B.2 — Custom-list against non-email-keyed brand (audience-builder Item-E surface)
- 3.7 — Composer mustache toolbar button count
- 5B.5 — Per-recipient table column count

## Closure plan (original; superseded above)

### Mock-update items (fix the MOCK file, not implementation)

These are documented per `[[mock_drift_is_my_responsibility]]` but the closure target is the mock file. Will land as **one commit**: `docs(#420): mock-walkthrough updates — Scene 6 R40 wording, Scene 7B depict D+D.2 blocks`.

- **6.4** — Scene 6 mock line 1087: change `(lifetime · not affected by Wave filter)` to `(lifetime · changes with Wave filter)` per spec R40.
- **7B.1** — Extend Scene 7B mock past line 1335 to depict Composer Snapshot + Recipient Send Log blocks (the surfaces that landed in commits `1df5cb2` + `da92799`).
- **7B.4** — Scene 7B scene-note: re-word *"Resend (V1.x candidate; out of V0 scope per Non-goals)"* to avoid V0/V1 framing per Round-1 coaching moment.

### Small drift — close proactively this session

One commit per drift class. Each commit followed by `pnpm --filter @customerEQ/web build`.

**Commit `impl(#420-M1): Scene 1 entry tile — both buttons outline-primary, copy + icon align with mock`**
- 1.1 — both buttons outline-primary (drop the primary-filled style on "Send via CustomerEQ →")
- 1.2 — icon `📧` → `📨`
- 1.3 — body copy align with mock framing

**Commit `impl(#420-M2): Scene 6 Responses header strip — caption + dropdown verbiage align with spec R40 wording`**
- 6.5 — responses caption: `(X% · response filters apply)` → `(X% · changes with the Wave filter on the right)` when wave=`all`, `(X% · response filters apply)` otherwise
- 6.6 — `All waves and direct responses` → `All waves & direct responses`
- 6.7 — dropdown option format: `{label} · {date} · {sent} sent · {responded} responded ({mode})`

**Commit `impl(#420-M3): Scene 5/2 pre-submit recaps + Generate CTA arrow`**
- 2.2 — `Generate N links` → `Generate N links →`
- 2.3 — add pre-submit recap line on SELF_SERVE
- 3.10 — add pre-submit recap line on MANAGED_EMAIL
- 5A.3 — `Done — back to survey →` promoted to primary button styling

**Commit `impl(#420-M4): Scene 3 composer — default subject + default body align with spec mock`**
- 3.4 — default subject prefix
- 3.5 — default body inserts `{{brand_logo}}` + `{{brand_name}}` header
- 3.6 — default body copy matches mock line 729–736

**Commit `impl(#420-M5): Scene 6 LoopMonitor — pills inline on Survey-Sent subline + lifetime-anchor note`**
- 6.2 — pills inline in the `surveysSentByMode` subline (not just in the drawer)
- 6.3 — render the "Loop Monitor stays lifetime-wide" note

**Commit `impl(#420-M6): Scene 7A/B Sent-semantics explainer blocks`**
- 7A.2 + 7A.5 + 7B.2 — render the mode-conditional Sent-semantics explainer + (for SELF_SERVE) the "no platform-side send log" warning box

### Drift items that need user discussion before closure

These are substantial enough that I want explicit confirmation before sinking the build effort, per `[[merit_over_ease]]` — *not* deferred per the no-V0-framing rule, but presented for design-call confirmation. None of them block the Item M audit itself.

- **3.9** — Live email preview pane (Scene 3 right column). ~3–4 hours to build (theme resolution + Brand.logoUrl wiring + mustache substitution preview). Mock devotes lines 747–800 to this; the spec §2.3 explicitly names it. **Recommend closing in this PR** — but flagging because of size.
- **5A.2** — CSV preview pane on Success state. ~2 hours. Mock dedicates the right column to it.
- **4.1** — SELF_SERVE confirm modal. ~1 hour. Spec §2.5a is explicit; the "plaintext URLs are shown only once" warning is currently absent until *after* generation lands.
- **3.8** — Auto-appended footer preview in composer. ~30 min. Legal/compliance-adjacent (unsubscribe footer the worker auto-appends).
- **3.11** — Theme color-mapping legend. Coupled with 3.9.
- **5B.2** — Progress bar visual on Sending state. ~30 min. Loss of % indicator.
- **5C.3** — Sent-state amber warning banner for partial-failure case. ~20 min.
- **5B.4** — Reassurance copy "You can leave this page; sending continues in the background." ~10 min.

### Pre-existing #378 surfaces (out of #420 scope but documented)

- 7A.1 / 7A.3 / 7A.4 / 7B.3 — Wave Detail counter-strip layout, Audience Spec missing rows, Regenerate explanation. These predate #420 and weren't lifted by Items A–E. Documented for a future cleanup; not closing in this PR unless the user directs.

---

## Visual confirmation owed

The following Playwright snapshots are owed once a Brand row and at least one Survey + one DistributionBatch (one each mode) are seeded:

- `/admin/surveys/[id]` (Scene 6) — Loop Monitor card layout + Responses header strip rendering.
- `/admin/surveys/[id]/distribute?mode=self-serve` (Scene 2) — audience builder + format dropdown.
- `/admin/surveys/[id]/distribute?mode=managed-email` (Scene 3) — composer.
- `/admin/surveys/[id]/distribute/batches/[batchId]` (Scenes 7A + 7B) — Wave Detail with `SendModePill` (md), `ComposerSnapshotBlock`, `RecipientSendLogBlock`.

The implementation diffs land **per the closure plan above** even without these snapshots — every drift item cites mock line and impl file:line, so the diff is reviewable on its own. Visual confirmation is a verification step (`[[validate_phase_must_run_build]]` + visual walk-through is the goal), not a precondition for the code changes themselves.
