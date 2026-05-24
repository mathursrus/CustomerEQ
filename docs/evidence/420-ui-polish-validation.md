# Issue #420 — UI Polish Validation

## Validation context

- **uiValidationRequired**: yes (per `docs/evidence/420-implement-work-list.md`)
- **mobileValidationRequired**: yes (Gmail iOS / Apple Mail iOS rendering — covered by spike + §9.4 Help-needed)
- **Surfaces validated this phase**:
  - `/u/:token` public unsubscribe page (new) — at `localhost:3000/u/test-token`
  - Survey-detail Distribution tile reshape (in `DistributionSection.tsx`) — verified at code-review since `/admin/*` is sign-in gated; existing DistributionSection tests (9/9) pass after the tile reshape (which is structural evidence the React tree didn't break)
  - ManagedEmailFlow.tsx — verified at code-review; live rendering deferred to operator session

## Baseline UX findings (`ui-baseline-validation` skill applied)

| Surface | Check | Result |
|---|---|---|
| `/u/:token` invalid-link state | Layout sanity (overlap, clipping, horizontal scroll) | **Pass** — centered card layout, no overflow |
| `/u/:token` invalid-link state | Typography hierarchy (h1 / body / detail) | **Pass** — heading > body > muted-detail visually distinct |
| `/u/:token` invalid-link state | Color contrast on primary content | **Pass** — gray-900 text on white background, indigo CTA, red-700 not used here |
| `/u/:token` confirm CTA | Discoverable affordance + focus visibility | **Pass** — `bg-indigo-600` button with hover state; keyboard-tabbable (`<button>` element) |
| `/u/:token` `confirmed` and `already-confirmed` states | Render without errors | **Verified at code-review** — terminal states are read-only text; no interactive elements to break |
| Distribution tile reshape | Existing test suite | **9/9 passing** — `DistributionSection.test.tsx` continues to pass post-reshape (tile structure changed but existing test expectations on labels + state behavior hold) |
| ManagedEmailFlow.tsx | Rules-of-hooks compliance | **Pass** — structural split into wrapper components (`ManagedEmailWrapper`, `SelfServeFlow`) avoids conditional-hook calls |
| ManagedEmailFlow.tsx | Form validation surfaces | **Pass at code-review** — composerError state surfaces inline; submitError surfaces in red banner; both clear on user retry |
| ManagedEmailFlow.tsx | Sending state polling cleanup | **Pass at code-review** — `useEffect` cleanup clears the interval + sets cancelled flag |

## Screenshots captured

- `docs/evidence/420-unsubscribe-page-invalid-state.png` — `/u/:token` rendered with `state=invalid`

## Findings requiring follow-up

| Severity | Finding | Action |
|---|---|---|
| **P2** | Composer body field uses a `<textarea>` instead of a TipTap rich-text editor with Mention palette for mustache tokens | Track as V1 polish per RFC §9.1 / D4 |
| **P2** | Audience-builder Status chips for suppressed recipients not surfaced in V0 UI (data path is wired) | Track as V1 polish per R22 |
| **P2** | Sending-state recipient table at scale (>100 recipients) not perf-validated visually | Add scrolling viewport test in V1 (component already has `max-h-96 overflow-y-auto`) |
| **P3** | Unsubscribe `valid` state — has not been visually verified at the unsubscribe-confirm transition (requires a real token + DB row); state machine verified at code-review | Cover in integration test post-validate |

**No P0 or P1 findings.** Phase passes.

## What was NOT validated this phase

- **Authenticated admin flows** (Distribution tile reshape, ManagedEmailFlow steps from configure→sent) — sign-in gated; requires authenticated Clerk session + seeded brand/survey data. Validation continues in operator session.
- **Real-inbox cross-client email rendering** (Gmail web/iOS, Outlook web/desktop, Apple Mail macOS/iOS) — covered by the technical-design §9.3 spike (Chromium-validated) + §9.4 Help-needed real-inbox follow-up.
- **Mobile-emulator validation of the admin flows** — same blocker as authenticated admin; covered in operator session.

These gaps are documented in the implementation-work-list as known follow-ups.

---

## Round 2 — operator-driven UI validation (2026-05-24)

Closes the "operator session" gaps named above. Reviewer (manohar.madhira@outlook.com) drove the full MANAGED_EMAIL flow end-to-end in a local dev environment with real Clerk auth + a seeded Brand (Hiranova Services, 14 surveys, 106 members) + real Azure Communication Services credentials wired through to live email delivery to an actual inbox. 22 findings reported across the round, captured in `docs/evidence/420-feature-implementation-feedback.md` Round 2 with per-finding commit map.

### Surfaces validated this round

| Surface | Verdict |
|---|---|
| `/admin/surveys/[id]/distribute?mode=managed-email` — configure step (Survey Batch details + Audience Builder + Composer) | **Pass after batches B1–B7 + H1–H7 + J1–J3 + K1 + L1–L2** |
| `/admin/surveys/[id]/distribute?mode=managed-email` — confirm modal (R32a–f) | **Pass after B7** — state-preservation fix lifted the configure subtree from conditional-unmount to CSS-hide so the AudienceBuilder's internal state survives the confirm cycle |
| `/admin/surveys/[id]/distribute?mode=managed-email` — sending / sent state with live SendProgressTable polling | **Pass** — operator confirmed real ACS dispatch landed in the actual inbox (Yahoo inbox; "Looks good" 2026-05-24) |
| `/admin/surveys/[id]/distribute/batches/[batchId]` — Wave Detail (Audience Spec + Expiry + merged Tokens/Send-Log + Composer Snapshot via EmailPreviewCard) | **Pass after H5 restructure** |
| `/admin/surveys/[id]` — Loop Monitor send-mode breakdown (R39) | **Pass after B4 + H1** — split-counts vertical + Survey Sent = sum of modes + SendModePill label updated globally to "Sent via CustomerEQ" / "Sent via my email tool" |
| Sent-email cross-mode rendering (recipient inbox view) | **Pass after H3 + J2 + K1** — Take-the-survey CTA restored, `{{survey_link}}` clickable themed anchor, `{{brand_logo}}` as `<img>`, `{{brand_name}}` themed span, `{{survey_title}}` sources from operator's `surveyNameInMail` (not Subject) |
| EmailPreviewCard live preview pane (R30a–d + composer parity) | **Pass after H2** — no double-rendered brand header; only via mustache; theme-styled |
| Audience-builder Search / Random Sample / Custom List tabs | **Pass after B2 + L2** — mode-toggle vs action-button hierarchy fixed (segmented tabs vs primary action); Upload-CSV icon direction corrected; Last-response (this survey) + Last-response (any survey) columns restored |
| Composer (TipTap MustacheEditor) | **Pass after B3 + H7** — Insert Token dropdown closes on outside-click/Esc; text color picker added via official `@tiptap/extension-color` |
| Breadcrumb / in-flow navigation guard | **Pass after B6 + B6 follow-up** — Surveys › `<title>` › Distribute breadcrumb at top of both flows; in-app `<Link>` click intercept prompts on unsaved-changes nav |
| Wave Detail send-log delivery-state header | **Pass after J3** — truth-in-labeling header notes "Sent indicates accepted by the email service. Actual recipient delivery and receipts polling will come in a subsequent release" (no internal-ref leakage per `[[no_internal_refs_on_customer_pages]]`) |

### Mobile-emulator + cross-client email rendering

- Operator did not run a Chrome mobile-emulator pass against the admin UI this round. Admin flow is desktop-first in V0; mobile-emulator validation is captured as a follow-up.
- Cross-client email rendering: operator confirmed Yahoo inbox delivery (one client). Gmail / Outlook / Apple Mail visual fidelity is the §9.4 spike's "Help-needed real-inbox follow-up" — out of #420 V0 scope.

### Operator sign-off

User stated *"Looks good"* on 2026-05-24 after the K1 + L1 + L2 fixes landed. User-as-reviewer accepted the operator-driven UI surfaces.

**Phase passes for Round 2.** No P0/P1 UI findings open. The two carry-overs (mobile-emulator admin pass + cross-client email rendering) remain follow-ups outside #420 V0 scope, plus the one DEFERRED finding (G1 — Clerk 5.7 + Next 15 dev-mode RSC incompatibility, requires Clerk 5→7 major upgrade).
