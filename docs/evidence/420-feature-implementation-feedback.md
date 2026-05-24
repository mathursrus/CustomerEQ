# Issue #420 — feature-implementation Feedback

## Round 1 Feedback (address-feedback Phase 12)
*Received: 2026-05-23 07:44–07:46 UTC; reviewer: rmadhira86; against `420-feature-implementation-evidence.md` and RFC §11.2.*

The reviewer reviewed only `docs/evidence/420-feature-implementation-evidence.md` and reported that the **scope decisions made during implementation are not acceptable**. Two evidence-doc comments are load-bearing; four RFC-thread comments compound the rejection.

### Comment 1 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/evidence/420-feature-implementation-evidence.md`
- **Line**: 119
- **URL**: https://github.com/mathursrus/CustomerEQ/pull/497#discussion_r3292385788
- **Comment**: "This needs to be implemented now. Cannot move to v1.1"
- **Pointing at**: §"Known V0 simplifications" item 1 — TipTap composer + Mention palette punted to V1.1.
- **Resolved by**: `459235f` (TipTap MustacheEditor) + `7b8848e` (audience-builder lift) + `1df5cb2` + `da92799` + `8b462e6` (M7 confirm modals) + `cbe32db` (M8 live preview pane). All 9 prior "V0 Partial" rows lifted to "Met" across the address-feedback rounds.
- **Status**: ADDRESSED

### Comment 2 — ADDRESSED (process)
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/evidence/420-feature-implementation-evidence.md`
- **Line**: 120
- **URL**: https://github.com/mathursrus/CustomerEQ/pull/497#discussion_r3292386828
- **Comment**: "How are scope modification decisions made in feature-implementation?"
- **Pointing at**: §"Known V0 simplifications" item 2 (audience-builder Status chips / Random Sample Add) and, by extension, the existence of the entire "V0 simplifications" block.
- **Implicit ask**: cite the sanctioned `feature-implementation` mechanism that authorizes demoting SHALL requirements mid-build, or revert the demotions.
- **Resolved by**: Process answer captured in `478c809` (evidence-doc rewrite — work-list reorganized into External blockers / Spec-level non-goals / Forward guards; "Known V0 simplifications" framing removed). Coaching artifacts at `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md` document the root-cause + forcing-function fix. Structural fix at the FRAIM job-template level filed as [FRAIM #473](https://github.com/mathursrus/FRAIM/issues/473) (out of #420 scope). The sanctioned mechanism: there is no `feature-implementation` process to demote a SHALL — only external-blocker carve-outs (V15) and spec-level non-goals (per the spec author at scoping time).
- **Status**: ADDRESSED

### Comment 3 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/420-send-via-customereq-acs.md`
- **Line**: 565
- **URL**: https://github.com/mathursrus/CustomerEQ/pull/497#discussion_r3292070992
- **Comment**: "This is factually incorrect. /admin/surveys/new redirects to /admin/surveys/[id]/edit today. Verify in code."
- **Resolved by**: `849ad17` — RFC §3.3 D2 rewritten with the factually-correct precedent (verified against `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` redirect behavior) before recommending the pattern lift.
- **Status**: ADDRESSED

### Comment 4 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/420-send-via-customereq-acs.md`
- **Line**: 570
- **URL**: https://github.com/mathursrus/CustomerEQ/pull/497#discussion_r3292073383
- **Comment**: "Lift it now. Don't punt architectural shortcuts based on 1st usage. In a startup project, more cases will come. Re-architect simple concepts becomes a chore, results in tech-debt and drifts."
- **Pointing at**: RFC §11.2 mode-parameterized component pattern, currently deferred to "follow-up architecture doc entry once #420 lands and proves it."
- **Resolved by**: `9237905` (ModeRouter shell extraction) + `69f69c1` (usePollingQuery hook lift) + `ce11220` (shared distributionSuppression helper) + `7b8848e` (audience-builder shared primitive) + `da92799` (SurveyBatchDetailsCard shared card). All four §11.2 patterns landed inside this PR — not deferred to a sibling issue.
- **Status**: ADDRESSED

### Comment 5 — ADDRESSED
- **Author**: rmadhira86
- **Type**: review_comment
- **File**: `docs/rfcs/420-send-via-customereq-acs.md`
- **Line**: 571
- **URL**: https://github.com/mathursrus/CustomerEQ/pull/497#discussion_r3292074338
- **Comment**: "Not as a follow-up issue, but as an end of the feature implementation"
- **Pointing at**: same §11.2 pattern lift — must land at end of #420 implementation, not on a sibling issue.
- **Resolved by**: same commit chain as Comment 4 plus `9b51b66` (Item F.2 — `architecture.md` §6 two-gate suppression entry extended with Gate 1 canonical paths). All patterns landed on this branch / this PR per the original ask.
- **Status**: ADDRESSED

### Coaching moment captured

Per the Phase 12 corrective-feedback protocol, I captured `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-05-23T08-38-47-invented-v0-simplifications-framing-to-defer-spec-rfc-requirements.md` documenting the root cause (re-applying merit-over-ease shortcut framing under invented process language) and the forcing-function fix (any in-scope requirement the agent doesn't want to implement is an Open Decision for the reviewer at scoping time, never a unilateral mid-implementation demotion).

---

## Round 2 Feedback (address-feedback Phase 12 — manual local-environment testing)

*Received: 2026-05-23 ~21:00 UTC through 2026-05-24 ~12:30 UTC; reviewer: manohar.madhira@outlook.com (driving the browser through the full MANAGED_EMAIL flow on a local dev environment). Findings captured in-chat during silent-capture mode per the `[[log_findings_batch_fix_during_user_testing]]` rule; batched into commits when the user signaled "fix these".*

Twenty-two unique findings reported across the round (F1–F16 from first walk-through, G1, G3–G22 from second). G2 dropped as user-error during silent-capture (Wave details link DOES appear when a specific wave is selected — not a code bug). Findings landed in seventeen scoped commits across batches B1–B7, H1–H7, J1–J3, K1, L1–L2 plus one pre-batch architectural fix.

### Pre-batch architectural correction — ADDRESSED

Discovered while wiring local dev for the walkthrough: `enqueueManagedEmailSend` in `apps/api/src/queues/bullmq.ts` was a deliberate no-op under `QUEUE_MODE=inline` (logged a warning and returned a stub job). That broke the `inline ≡ redis` functional-equivalence invariant every other queue in this codebase upholds (architecture.md §2 + §3.3, inlineRuntime.ts header). User flagged: *"we need to be able to send when QUEUE_MODE is inline. From start redis was designed only when volume increases."* Fixed in `bf322ea` — extracted `dispatchManagedEmailSend` from the worker as a Job-free core, exposed via `@customerEQ/worker/processors/managedEmailSend` subpath export, added as workspace dep of `@customerEQ/api`, inline branch now calls `scheduleInline(...)` with `attempts: 3 + backoffMs: 2000` matching the BullMQ config.

### Comment F1 — ADDRESSED (B1 — spec annotations)
- **Type**: chat
- **Comment**: *"Step 1 - Shared Both Modes and Step 2 - Shared Both Modes are texts for the spec, not for production pages."*
- **Resolved by**: `632e7ae` — pills stripped from `SurveyBatchDetailsCard`, `ManagedEmailFlow`, `SelfServeFlow`. Memory rule `[[dont_copy_spec_annotations_to_ui]]` saved.
- **Status**: ADDRESSED

### Comment F2 — ADDRESSED (B1 — spec prose)
- **Type**: chat
- **Comment**: *"SELF_SERVE: flows into the CSV's surveyName column. CustomerEQ Email: provides the default Subject + the {{survey_title}} mustache. — is text for the spec."*
- **Resolved by**: `632e7ae` — behavior-by-mode prose paragraph removed from `SurveyBatchDetailsCard`.
- **Status**: ADDRESSED

### Comment F3 — ADDRESSED (B1)
- **Type**: chat
- **Comment**: *"'Shared' pill on Add from Existing Members and Add from Custom List"*
- **Resolved by**: `632e7ae` — pills removed from both audience-builder card headers.
- **Status**: ADDRESSED

### Comment F4 — ADDRESSED (B1)
- **Type**: chat
- **Comment**: *"Step 3 MODE - SPECIFIC - CUSTOMEREQ EMAIL"*
- **Resolved by**: `632e7ae` — pill removed above the Compose-email section.
- **Status**: ADDRESSED

### Comment F5 — ADDRESSED (B5 — email-preview brand plumbing)
- **Type**: chat
- **Comment**: *"{{Brand Logo}} and {{Brand Name}} are not showing in the Preview. Just shows 'Brand name'"*
- **Resolved by**: `6ec1c16` — `/v1/admin/brand/profile` returns `{ brand, themes, ... }`; ManagedEmailFlow + SelfServeFlow now unwrap `brandData.brand`. Brand profile API extended to return full theme color set. EmailPreviewCard accepts a `theme` prop and applies brand colors.
- **Status**: ADDRESSED

### Comment F6 — ADDRESSED (B6, follow-up `11867fe`)
- **Type**: chat
- **Comment**: *"I navigated away from Send via Mail to Organization Settings - when I came back I lost all the selections I had done. Prefer to have a message if work is in progress and they navigate away."*
- **Resolved by**: `b04ab6d` — beforeunload guard added to both flows + breadcrumbs to surveys list. `11867fe` — in-app document-click capture-phase intercept added so Next `Link` soft-nav also prompts. Full state-preservation across nav (sessionStorage / lifting AudienceBuilder rows) tracked as separate work item.
- **Status**: ADDRESSED

### Comment F7 — ADDRESSED (B2 — audience-builder hierarchy)
- **Type**: chat
- **Comment**: *"Visually in the Add from Existing Members, There are two 'search' boxes... Make the top options appear different from the core action buttons. Add a search icon to the Search button / just keep the search icon. Do the same changes of the top option selection of Search or Random sample to Paste or Upload CSV on the Add from Custom List"*
- **Resolved by**: `d91178b` — mode toggle re-styled as segmented tabs (`bg-indigo-100/text-indigo-800` active vs full-bleed indigo-600 fill). Search action button gains 🔍 prefix.
- **Status**: ADDRESSED

### Comment F8 — ADDRESSED (B3)
- **Type**: chat
- **Comment**: *"If I click on the Insert Token drop down appears as expected. However, it doesn't go away if I click outside the drop down list. It goes away only if I click Insert Token again"*
- **Resolved by**: `1a9da98` — InsertTokenMenu registers document mousedown + keydown (Esc) listeners while open.
- **Status**: ADDRESSED

### Comment F9 — ADDRESSED (B7 — pre-modal validation + state preservation)
- **Type**: chat
- **Comment**: *"When I clicked Send 4 emails... 'Validation failed' nestled between Email editor and Ready to send 0 emails. ... I would also expect that error would be shown before i see the modal - and errors will be user friendly. ... Also, all the fields I entered were blanked out."*
- **Resolved by**: `604e9e3` — API extractAudienceInput uses `.passthrough()` (was `.strict()`, rejected sendMode+composer extras); 422 responses now include `fieldErrors` from Zod flatten. Frontend: configure subtree wrapped in CSS `hidden` instead of conditional render (AudienceBuilder state preserves across confirm/sending/sent); submitError relocated to top of page; Send button disabled when validateComposer returns error; tests/setup mock gains `enqueueManagedEmailSend`.
- **Status**: ADDRESSED

### Comment F10 — ADDRESSED (B2)
- **Type**: chat
- **Comment**: *"The Upload CSV button has a 'download icon'."*
- **Resolved by**: `d91178b` — `⤓` (downward arrow to bar) → `↑` (upward arrow).
- **Status**: ADDRESSED

### Comment F11 — ADDRESSED (B6)
- **Type**: chat
- **Comment**: *"There are no breadcrumbs to go back to the surveys."*
- **Resolved by**: `b04ab6d` — Surveys › `<title>` › Distribute breadcrumb added at top of both ManagedEmailFlow and SelfServeFlow.
- **Status**: ADDRESSED

### Comment F12 — ADDRESSED (B4)
- **Type**: chat
- **Comment**: *"In the Loop Monitor, place the two mode count 0 via CustomerEQ and 178 via my email tool on separate lines and reduce the box width."*
- **Resolved by**: `3143b36` — subline switched from `flex-wrap` horizontal with · separator to `flex-col gap-0.5` vertical stack.
- **Status**: ADDRESSED

### Comment F13 — ADDRESSED (B4)
- **Type**: chat
- **Comment**: *"In Loop monitor, Survey Sent count is 0, even though it shows 178 via my email tool. I would expect that survey sent is sum of 'via CustomerEQ' and 'via my email tool'"*
- **Resolved by**: `3143b36` — Survey Sent value now `sentByMode.MANAGED_EMAIL + sentByMode.SELF_SERVE` (falls back to `pipeline.surveysSent` only when breakdown absent).
- **Status**: ADDRESSED

### Comment F14 — ADDRESSED (B5)
- **Type**: chat
- **Comment**: *"The email preview did not apply the survey theme colors."*
- **Resolved by**: `6ec1c16` — same B5 commit; EmailPreviewCard applies `primaryColor` to brand name span, `accentColor` to survey_link + unsubscribe, `backgroundColor`/`textColor`/`fontFamily` to the email frame.
- **Status**: ADDRESSED

### Comment F15 — ADDRESSED (B5)
- **Type**: chat
- **Comment**: *"The disclaimer showed You received this survey because you're a customer or partner of —. ... It should have shown Brand display name instead of —"*
- **Resolved by**: `6ec1c16` — same B5 commit; brand display name flows through `brandDisplayName` with "your brand" fallback when empty (was `'—'`).
- **Status**: ADDRESSED

### Comment F16 — ADDRESSED (B7)
- **Type**: chat
- **Comment**: *"When I removed {{survey_link}} from the message, I still had Send 1 email enabled. I expected it to tell me the error and not allow me to goto next step"*
- **Resolved by**: `604e9e3` — `validateComposer()` recomputed live via useEffect; Send button `disabled` reflects composer validity in addition to audience count; tooltip surfaces the specific error.
- **Status**: ADDRESSED

### Comment G1 — DEFERRED (not in our code)
- **Type**: chat
- **Comment**: *"When I switch organizations, I get the error Runtime Error: Only plain objects, and a few built-ins, can be passed to Client Components from Server Components. Classes or null prototypes are not supported."*
- **Investigation**: Stack trace is in `react-server-dom-webpack-client.browser.development.js` (browser-side dev-mode RSC decoder). Our Server Components: only `app/layout.tsx`, which passes `publishableKey={string}` to ClerkProvider. All admin pages + `(admin)/layout.tsx` are `'use client'`. Our Clerk-server usage (middleware, lib/server-auth) returns strings, not objects. Likely a known Clerk 5.7 + Next 15 dev-mode RSC payload incompatibility — same compatibility lag already documented in `middleware.ts:28-34` for an async-headers issue. We're on `@clerk/nextjs@^5.7.6`; latest is `7.4.1` (two major versions up, breaking changes).
- **Resolution**: Production builds don't render the dev overlay even if the underlying decode runs (this is dev-mode only). Fix is a Clerk major upgrade (5→7), out of #420 V0 scope. **No commit on this PR.**
- **Status**: DEFERRED (Clerk-side issue, dev-mode-only impact, out of scope)

### ~~Comment G2~~ — USER-ERROR
- **Type**: chat
- **Comment**: *"You moved Wave section to Response but lost the details link that took us to the wave detail page."*
- **Resolution**: User retracted: *"When I switched to a WAVE instead of all waves, the details button showed. So user error, not code."*
- **Status**: DROPPED (user-error, not a bug)

### Comment G3 — ADDRESSED (H1)
- **Type**: chat
- **Comment**: *"Make the Search button with the icon - that users click to search for artists, match the color pattern of Add to List on Add from Custom List"*
- **Resolved by**: `e1192f8` — SearchTab action button changed from `bg-white border-gray-300` (outline-secondary) to `bg-indigo-600 text-white shadow-sm` (primary), matching the `Add to list` CTA.
- **Status**: ADDRESSED

### Comment G4 — ADDRESSED (H2)
- **Type**: chat
- **Comment**: *"Preview shows Brand Logo and Brand Name always. Then when the body text has {{brand logo}} and {{brand name}} it again adds the logo and brand name. Expected behavior - these are added only when and user specifies the Moustache elements. Brand Name should be formatted based on format mapping."*
- **Resolved by**: `1dc1221` — removed the always-on brand-header strip from EmailPreviewCard; brand identity now appears only via mustache substitution. `{{brand_name}}` substitutes to a themed `<span>` (primaryColor + font-weight 600 + theme fontFamily). `{{brand_logo}}` substitutes to an `<img>` (or empty when logoUrl is null).
- **Status**: ADDRESSED

### Comment G5 — ADDRESSED (H7)
- **Type**: chat
- **Comment**: *"If possible - need color options for the text in the editor - no arch change. Only if TipTap provides it."*
- **Resolved by**: `b6dec99` — added official `@tiptap/extension-color` + `@tiptap/extension-text-style` (`^3.23.6`, same family as existing TipTap extensions; drop-in). Toolbar gains a 🎨 native `<input type="color">` + ✕ clear-color button.
- **Status**: ADDRESSED

### Comment G6 — ADDRESSED (H1)
- **Type**: chat
- **Comment**: *"In the Survey Sent monitor page, 'Switch to my email tool' is not relevant. Remove"*
- **Resolved by**: `e1192f8` — toggle now gated behind `flow === 'configure'`; disappears once Send is clicked (confirm / sending / sent).
- **Status**: ADDRESSED

### Comment G7 — ADDRESSED (H3 — production render parity)
- **Type**: chat
- **Comment**: *"Sent email — {{brand_logo}} was used, it just shows the link to the Brand Logo... Expected behavior: in emails {{brand logo}} renders as image, not as html link"*
- **Resolved by**: `c44d722` — `renderTemplate.ts` substitutes `{{brand_logo}}` to a themed `<img>` (was bare URL string). Aligns production render with the H2 preview rework.
- **Status**: ADDRESSED

### Comment G8 — ADDRESSED (H3)
- **Type**: chat
- **Comment**: *"Sent email — {{brand name}} is not formatted (same as G4)"*
- **Resolved by**: `c44d722` — `{{brand_name}}` substitutes to a themed `<span>` (`color: ${theme.primaryColor}; font-weight: 600; font-family: ${theme.fontFamily}`).
- **Status**: ADDRESSED

### Comment G9 — ADDRESSED (H4 — full plaintext token in queue payload)
- **Type**: chat
- **Comment**: *"The survey link is incomplete and NOT working. Only shows the first 8 characters instead of the full valid token"*
- **Resolved by**: `c4d779e` — `ManagedEmailSendPayload` gains `surveyLinkToken` + `unsubscribeToken` (the plaintext, ~100 bytes/row, well under BullMQ's 1MB payload limit). Route persists the plaintext at mint time, worker reads from payload. Worker keeps tokenPrefix fallback for retry-failed enqueues (where plaintext is unrecoverable post-mint by design).
- **Status**: ADDRESSED

### Comment G10 — ADDRESSED (H4 — same root cause as G9)
- **Type**: chat
- **Comment**: *"When I access with the provided link, I get This link is not valid. Please check that you copied the full link from your email, or contact the sender."*
- **Resolved by**: `c4d779e` — same plaintext-token fix as G9; the public `/survey/:id/r/:token` route was rejecting the prefix.
- **Status**: ADDRESSED

### Comment G11 — ADDRESSED (H5)
- **Type**: chat
- **Comment**: *"In the wave details, move the Composer Snapshot below tokens."*
- **Resolved by**: `d060b6c` — ComposerSnapshotBlock invocation moved to after the merged Tokens/Send-Log table.
- **Status**: ADDRESSED

### Comment G12 — ADDRESSED (H5)
- **Type**: chat
- **Comment**: *"Composer Token should show the preview of the email - use the same preview component, don't duplicate."*
- **Resolved by**: `d060b6c` — ComposerSnapshotBlock rewritten to delegate to `EmailPreviewCard`; `themeSnapshot` (persisted via the existing `BatchDetailResponseSchema.passthrough()`) threaded through.
- **Status**: ADDRESSED

### Comment G13 — ADDRESSED (H5 — mock deviation)
- **Type**: chat
- **Comment**: *"Change from mock - combine the Send Log with the Tokens. Include N1 sent, N2 failed, N3 skipped. Add column detail, Status can show 'Sent - Awaiting response' for success, and failed / skipped as appropriate. In large sends the page becomes too long with Send Log and Token repeating the user info. ... Actually modify G13 - we have summary on top. Add Failed and Skipped to these... Summary not required in the Tokens section or repeat the same from above."*
- **Resolved by**: `d060b6c` — merged Tokens + Send-Log into a single unified table with Status + Detail columns. Top-of-page summary gains Failed + Skipped (for MANAGED_EMAIL). RecipientSendLogBlock deleted. **Intentional deviation from the mock; recorded as such.**
- **Status**: ADDRESSED

### Comment G14 — ADDRESSED (H1)
- **Type**: chat
- **Comment**: *"In wave detail it shows <Managed>. Change this to Sent via CustomerEQ"*
- **Resolved by**: `e1192f8` — SendModePill label `Managed → Sent via CustomerEQ` and `Self-serve → Sent via my email tool` (global; LoopMonitor's now-redundant inline pill dropped in same commit).
- **Status**: ADDRESSED

### Comment G15 — ADDRESSED (J1)
- **Type**: chat
- **Comment**: *"Survey Title when changed doesn't reflect in preview. It always stays what was loaded. The value should come from Survey Title in email"*
- **Resolved by**: `c0e0bf1` — EmailPreviewCard `surveyTitle` prop sources `surveyNameInMail` (with fallback to `survey.title`/`survey.name`). Worker-side mismatch (sent email + Composer Snapshot still substituted with Subject) fixed in `d9cb620` (K1) — see G20.
- **Status**: ADDRESSED

### Comment G16 — ADDRESSED (J1)
- **Type**: chat
- **Comment**: *"Domain name only shows partial. Suggestion: reduce Sender alias text box to 1/2 its size. If domain name still overflows show it on mouse over."*
- **Resolved by**: `c0e0bf1` — alias input `w-1/2 min-w-[6rem]`; domain suffix wrapped `flex-1 truncate` with `title={@${SENDER_DOMAIN}}` tooltip.
- **Status**: ADDRESSED

### Comment G17 — ADDRESSED (J1)
- **Type**: chat
- **Comment**: *"Change Sender alias default to donotreply"*
- **Resolved by**: `c0e0bf1` — default state `'feedback' → 'donotreply'` (the username Azure ACS pre-allowlists on every verified custom domain).
- **Status**: ADDRESSED

### Comment G18 — ADDRESSED (J3 — truth-in-labeling + follow-up issue)
- **Type**: chat
- **Comment**: *"I tested with 3 non-existent emails. They all show sent in the status update."*
- **Resolution**: Real root cause — ACS's `pollUntilDone()` returns `succeeded` once ACS accepts the message for outbound MTA hand-off. Actual bounce signals arrive asynchronously via Azure Event Grid; we don't consume them. Implementing it properly = schema (acsMessageId column) + webhook endpoint + Event Grid subscription + deliveryStatus→failureReason mapping + Azure portal setup + tests. ~3–5h of code + Azure-side configuration. Out of #420 V0 scope.
- **Resolved by**: `fd6aeed` + `371f918` — truth-in-labeling explanatory header above the Wave Detail send-log table for MANAGED_EMAIL batches: *"Sent indicates accepted by the email service. Actual recipient delivery and receipts polling will come in a subsequent release."* Internal traceability lives in the commit message; the user-facing copy has no internal issue refs (per `[[no_internal_refs_on_customer_pages]]`). Bounce-handling integration filed as the follow-up tracking issue with an explicit "remove this header when shipped" task.
- **Status**: ADDRESSED (UX hedge in this PR; full integration tracked separately)

### Comment G19 — ADDRESSED (J2)
- **Type**: chat
- **Comment**: *"In the sent email the Take the survey button is now removed (please put it back). The link is not clickable."*
- **Resolved by**: `fd81f8c` — always-on themed `<a>Take the survey</a>` CTA restored in `renderTemplate.ts` (uses `theme.buttonColor + theme.buttonTextColor + theme.fontFamily`); `{{survey_link}}` substitutes to a clickable themed anchor (`color: ${theme.accentColor}`) so a standalone token in the body becomes a working link. EmailPreviewCard mirrors the CTA for parity.
- **Status**: ADDRESSED

### Comment G20 — ADDRESSED (K1)
- **Type**: chat
- **Comment**: *"The {{Survey Title}} in preview is working correctly, but when sending mail and in the Composer Snapshot in Wave detail is substituted by Subject - which is completely incorrect."*
- **Resolved by**: `d9cb620` — three-file fix. API persists `surveyNameInMail` onto the composerSnapshot JSON. Worker's `ComposerSnapshotJson` gains optional `surveyNameInMail`; reads `composer.surveyNameInMail ?? composer.subject`. Wave-Detail's `ComposerSnapshotBlock` reads with same fallback. Pre-K1 batches fall back to subject; new sends carry the correct field.
- **Status**: ADDRESSED

### Comment G21 — ADDRESSED (L1)
- **Type**: chat
- **Comment**: *"When the links expire shows why does it expire midnight UTC? It is supposed to expire midnight Brand's timezone per the previous spec and should not have changed in this spec."*
- **Resolved by**: `7874f3b` — both flows' `presetToIsoExpiry` re-routed through the canonical `addDaysInBrandTz` + `endOfDayInBrandTz` helpers from `packages/shared/src/datetime.ts` (DST-aware, validated by the #378 TZ spike). Was using `setUTCDate + setUTCHours(23,59,59,999)` which produced midnight UTC regardless of brand timezone.
- **Status**: ADDRESSED

### Comment G22 — ADDRESSED (L2)
- **Type**: chat
- **Comment**: *"Previous spec showed in the Audience preview - last response this survey and last response all surveys. I missed catching in the mock that it removed those now. Please add them back."*
- **Resolved by**: `53c8489` — `SearchMembersQuerySchema` gains optional `surveyId`; route conditionally computes `lastResponseThisSurvey` (batched groupBy) + `lastResponseAnySurvey` (from existing surveyResponses sub-select with `completedAt` added). `AudienceRow` type gains `lastResponseAnySurvey`. SearchTab + RandomSampleTab + AddFromCustomListCard plumb both fields. `AudienceList` renders two new columns with `formatResponseDate` helper (browser locale, em-dash on null).
- **Status**: ADDRESSED

### Round 2 — coaching moments captured

Six memory-rule entries saved as `feedback_*` files under `~/.claude/projects/.../memory/` (synced into MEMORY.md). They encode forcing-functions for the failure patterns this round surfaced:

1. **`feedback_acs_mailfrom_vs_sender_usernames`** — Azure "MailFrom" is the SMTP envelope return-path (bounce routing), not the From:-header allowlist. The From:-header allowlist is "Sender Usernames". `DoNotReply` is pre-allowed; anything else needs portal add. Saved after user corrected me when I sent them to the wrong portal screen for the `InvalidSenderUserName` error.
2. **`feedback_dont_copy_spec_annotations_to_ui`** — HTML mocks contain UI affordances AND reviewer commentary. Copy affordances only; annotations stay in the spec. Saved after F1–F4 (the "Step N — Shared Both Modes" strings + "Shared" pills + behavior-by-mode prose bled into production pages).
3. **`feedback_log_findings_batch_fix_during_user_testing`** — Sharpened from earlier rule. User decides what counts as a blocker, not me. If unsure, default to not-a-blocker and keep capturing. Saved after I unilaterally classified F9 a blocker and dove into source instead of logging.
4. **`feedback_dev_bypass_breaks_multi_org_isolation`** — Bypass is for MY scripted runs only. Any session where the USER will click the UI: real Clerk on web AND API, no bypass anywhere. Mixing the two is the silently-broken state. Saved after a "P0 cross-tenant data leak" turned out to be `DEV_BYPASS_AUTH=true + DEV_BRAND_ID=Hiranova` pinning the API to one brand while web ran real Clerk org-switch.
5. **`feedback_dont_build_against_live_dev_server`** — Never `pnpm web build` while `pnpm dev` is running (rewrites `.next/` chunks under the live server → "Cannot find module './<chunkId>.js'"). **Extended this round** to cover the second related gotcha: edits to `packages/shared/src/` or `apps/worker/src/` require rebuild + dev restart before re-testing (api/web import the compiled `dist/`, which doesn't hot-reload). Two-strikes rule applied.
6. **`feedback_no_internal_refs_on_customer_pages`** — Never surface GitHub issue numbers, PR links, internal slugs, repo paths, or ticket IDs in rendered UI copy. Internal traceability lives in code comments + commit messages. "In a subsequent release" is the right user-facing framing for deferred work. Saved after I added a `(#515)` hyperlink to the J3 explanatory header on the Wave Detail page.

### Round 2 — commits landed

| Batch | Commit | Findings | Notes |
|---|---|---|---|
| pre-batch | `bf322ea` | inline ≡ redis invariant for managed-email-send | architectural correction enabling local dev testing |
| B1 | `632e7ae` | F1, F2, F3, F4 | spec annotations stripped |
| B2 | `d91178b` | F7, F10 | audience-builder hierarchy + Upload-CSV icon |
| B3 | `1a9da98` | F8 | Insert Token outside-click + Esc |
| B4 | `3143b36` | F12, F13 | LoopMonitor split + sum |
| B5 | `6ec1c16` | F5, F14, F15 | brand profile API wrap fix + theme plumbing |
| B6 | `b04ab6d` | F11, F6 (partial) | breadcrumbs + beforeunload |
| B6 follow-up | `11867fe` | F6 in-app nav | document-level click capture-phase intercept |
| B7 | `604e9e3` | F9, F16 | pre-modal validation + state preservation |
| H1 | `e1192f8` | G3, G6, G14 | distribute visual tweaks |
| H2 | `1dc1221` | G4 | preview brand header rework |
| H3 | `c44d722` | G7, G8 | sent-email render parity |
| H4 | `c4d779e` | G9, G10 | full plaintext survey-link token |
| H5 | `d060b6c` | G11, G12, G13 | Wave Detail restructure |
| H7 | `b6dec99` | G5 | TipTap text color picker |
| J1 | `c0e0bf1` | G15, G16, G17 | composer UX |
| J2 | `fd81f8c` | G19 | CTA + clickable survey link |
| J3 | `fd6aeed` | G18 | truth-in-labeling header (bounce handling deferred) |
| J3 link strip | `371f918` | (rule violation cleanup) | removed internal issue link from user-facing header |
| K1 | `d9cb620` | G20 | survey_title sources from surveyNameInMail |
| L1 | `7874f3b` | G21 | expiry brand-tz midnight |
| L2 | `53c8489` | G22 | last-response columns restored |

H6 (G1) is intentionally absent — investigated, no commit on this PR (Clerk-side issue out of scope).

## Round 2 — implement-quality findings (post-feedback re-validation)

Output of `deep-code-quality-checks` against the Round 2 diff (batches B1–B7, H1–H7, J1–J3, K1, L1–L2 + security fix). 3 findings.

### #420-Q-004: `presetToIsoExpiry` duplicated across both distribute flows — QUALITY CHECK FAILURE

- **Severity**: Medium (DRY / Rule 15)
- **File**: `ManagedEmailFlow.tsx:118` + `SelfServeFlow.tsx:99`
- **Detail**: After G21/L1 routed both flows' expiry resolver through `addDaysInBrandTz` + `endOfDayInBrandTz`, the two `presetToIsoExpiry` implementations became byte-identical — copy-pasted across two sibling flow files. Rule 15 ("repeated logic across pages → extract to shared utility").
- **Status**: **ADDRESSED** — extracted to `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/expiry.ts`; both flows import it. The `PRESET_DAYS` map is now a single module-level constant. Web typecheck clean.

### #420-Q-005: `ManagedEmailFlow.tsx` grew to 872 lines — QUALITY CHECK (re-affirm acceptance)

- **Severity**: Low (file size)
- **File**: `ManagedEmailFlow.tsx` (872 lines, up from 639 at #420-Q-002)
- **Detail**: Round 2 added the in-app nav guard, live survey-title binding, sender-alias width fix, CTA, and confirm-state preservation. The file is still a single-purpose flow component (configure → confirm → sending → sent) sharing 20+ `useState` hooks.
- **Status**: **ACCEPTED with rationale** — same as #420-Q-002. Extracting the flow-states into separate files still requires lifting all state + handlers into a shared context, adding complexity without quality benefit. The presetToIsoExpiry extraction (Q-004) shaved the only genuinely-shareable logic. Flagged as a V1 split candidate if the flow gains a 5th state or the helpers gain a second consumer. Sister precedent `distribute/page.tsx` (now a thin ModeRouter shell after the §11.2 lift) confirms the split was done where it added value.

### #420-Q-006: `EmailPreviewCard.DEFAULT_THEME` inline hex literals — QUALITY CHECK (accepted)

- **Severity**: Low (hardcoded values)
- **File**: `apps/web/src/components/managed-email-composer/EmailPreviewCard.tsx:71-79`
- **Detail**: `DEFAULT_THEME` carries inline hexes (`#111827`, `#ffffff`, `#1f2937`, `#4f46e5`). #420-Q-001 established that theme hex literals should reference `FALLBACK_RESPONDENT_THEME`.
- **Status**: **ACCEPTED with rationale** — unlike #420-Q-001 (which duplicated the *respondent theme* values), `DEFAULT_THEME` here is the preview's intentionally-neutral "no brand theme available" baseline (near-black text + indigo accent), used only when the `theme` prop is null (tests / brand-with-no-theme). Coupling it to `FALLBACK_RESPONDENT_THEME` (the indigo respondent identity) would be the wrong coupling — the preview's neutral baseline is a distinct semantic concern from the respondent-theme fallback. Single consumer, client-component-local. No drift risk since it's not duplicating an existing constant's *intent*.

### Round 2 quality phase outcome

- **3 findings**: 1 ADDRESSED inline (#420-Q-004 DRY extraction); 2 ACCEPTED with rationale (#420-Q-005 file size, #420-Q-006 neutral-default hexes).
- **0 unaddressed.** Phase passes.

---

### Phase outcome (Round 2 feedback)

- **22 findings** reported by reviewer; **21 ADDRESSED**, **1 DEFERRED** (G1 — Clerk + Next 15 dev-mode RSC incompatibility, out of #420 V0 scope), **1 DROPPED** (G2 — user error, not a code bug).
- **Total commits this round**: 22 (including pre-batch architectural fix, two follow-up cleanup commits, and the J3 link strip).
- **Coaching moments captured**: 6 (saved as `feedback_*` memory files; linked in MEMORY.md).
- **Follow-up issue filed**: 1 (ACS bounce-handling Event Grid integration, with explicit "remove the J3 header" task).
- Re-validation requested via `seekMentoring(currentPhase='address-feedback', status='failure', findings={feedbackFile, roundNumber: 2, itemsAddressed: 21})`. Phase 12 is a Rule 25a hold-point — `seekMentoring(status='complete')` only fires after explicit user approval, not on agent initiative.

## Round 0 — implement-quality findings (pre-feedback, retained for traceability)

Output of `deep-code-quality-checks` skill against the #420 diff (`origin/main..HEAD`).

## QUALITY CHECK FINDINGS

### #420-Q-001: Hardcoded default-theme hex values duplicated in route fallback

- **Severity**: Medium
- **File**: `apps/api/src/routes/distributionBatches.ts` (composerSnapshot themeSnapshot fallback branch)
- **Detail**: When neither `Survey.themeId` nor `Brand.defaultThemeId` resolves to a real `BrandTheme` row, the route minted a composerSnapshot with hex literals (`#6366f1`, `#818cf8`, `#ffffff`, etc.) inline. Those literals duplicate the canonical CustomerEQ default-theme values that already live as `FALLBACK_RESPONDENT_THEME` in `packages/shared/src/default-themes.ts:102-112`. The "single source of truth" comment on that constant explicitly enumerates the 5 sites that use it — adding a 6th site that copy-pastes the values violates the DRY principle from the engineering/architecture-standards rule.
- **Status**: **ADDRESSED** — imported `FALLBACK_RESPONDENT_THEME` from `@customerEQ/shared` and reference its properties; all hex values removed from `distributionBatches.ts`. The route's fallback is now visually indistinguishable from the existing renderer fallbacks.

### #420-Q-002: `ManagedEmailFlow.tsx` exceeds 500-line monolithic threshold

- **Severity**: Low
- **File**: `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx` (639 lines)
- **Detail**: File is over the deep-code-quality-checks 500-line threshold. Has 1 exported component (`ManagedEmailFlow`) + 2 internal helper components (`Stat`, `StatusPill`).
- **Status**: **ACCEPTED with rationale** — the file is a single-purpose flow component (configure → confirm → sending → sent) that shares state via local `useState` hooks. Extracting the 4 flow-states into separate files would require lifting all 20+ state vars + handlers to a shared context, adding complexity without quality benefit. The 2 small helper components (`Stat` 17 LoC, `StatusPill` 11 LoC) live in the same module by convention since they're flow-internal presentational components with no reuse outside this flow. Sister precedent: `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/page.tsx` already exists at **1056 lines** for the same reason. Splitting can be revisited if these helpers gain a second consumer or the flow gains a 5th state. Tracked as V1 polish.

### #420-Q-003: Magic-number polling interval

- **Severity**: Low
- **File**: `apps/web/src/app/(admin)/admin/surveys/[id]/distribute/_components/ManagedEmailFlow.tsx`
- **Detail**: `2000` ms was used inline as the `setInterval` cadence for `/send-progress` polling, and `400` ms inline for audience-preview debounce. Both are tied to RFC §3.4 / §9.1 D3 decisions that should surface as named constants.
- **Status**: **ADDRESSED** — extracted as module-level constants `SEND_PROGRESS_POLL_MS = 2_000` and `PREVIEW_DEBOUNCE_MS = 400`. Both have comments tying them back to the RFC sections that justify the values.

### Scan completeness

- **Hardcoded values scan** (URLs, API keys, credentials, colors, magic numbers): 3 findings, all addressed or accepted with rationale.
- **Duplicate code scan**: no copy-paste duplication detected; `render-template.ts` legitimately exists in both `spike/` and `packages/shared/src/email/` per the explicit lift-from-spike step in the implementation work-list (the spike copy is the historical artifact; shared is the source of truth).
- **Missed reusability**: #420-Q-001 was the one finding; addressed.
- **Architecture standards compliance**: `Member.unsubscribedSurveysAt` is a Date column distinct from `Member.emailOptIn` per the Round-7 reviewer decision — separate columns for distinct semantic concerns; passes architecture-standards "single responsibility" check.
- **Security violations** (env vars used appropriately): pass — all secrets go through `process.env` reads in `packages/connectors/src/email.ts`; no hardcoded credentials in #420 diff.
- **Function/file sizes**:
  - Functions: largest is `POST /distribution-batches` handler at ~180 LoC after my G4b extension. The handler is mode-branched and has historically been long (it was 130 LoC before #420; extension grows it to 180). Tracked as V1 candidate for extracting the MANAGED_EMAIL minting into a helper.
  - Files: see #420-Q-002 above.
- **Architecture health** (no circular deps, no inverted import directions): pass — verified by `pnpm build` succeeding across all 12 packages.

## Phase outcome

- **3 findings**: 2 addressed inline (#420-Q-001, #420-Q-003); 1 accepted with rationale (#420-Q-002).
- **0 unaddressed.**
- Phase passes; ready to advance to `implement-completeness-review`.
