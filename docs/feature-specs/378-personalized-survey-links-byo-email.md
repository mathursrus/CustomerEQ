# Feature: Personalized Survey Links for BYO-Email Distribution

Issue: [#378](https://github.com/mathursrus/CustomerEQ/issues/378)
Owner: manohar.madhira@outlook.com
Status: **Iterating (round 2 — UX simplification per chat feedback; for reviewer signoff).**
Last touched: 2026-05-15

---

## Iteration history

| Round | Date | Trigger | Outcome |
|---|---|---|---|
| R1 | 2026-05-15 | FRAIM `feature-specification` job phases 1–5 → PR #385 opened with initial spec, mock, evidence | 4-step wizard + filter predicate + sampling-seed UI + Revoke remaining + Re-run-with-same-audience + 3 download cards + standalone Distribution batches section |
| R2 | 2026-05-15 | Pre-document-review UX iteration via chat (feedback file: `docs/evidence/378-feature-specification-feedback.md`) | Collapsed to single short page; dropped filter predicate (V1.x); dropped seed UI (internal only); dropped Confirm step; replaced Revoke remaining with Edit Expiry (both directions); deferred Re-run-with-same-audience to V1 separate scoping; standalone batches section became filter row between Loop Monitor and Response (filter applies to Response only); 3 download cards became 1 dropdown + 1 button; respondent-form mock scene dropped (duplicated by #241 R28 Configuration Summary preview); error-state copy drops `Brand.supportEmail` reference, uses "contact the sender"; token-state vocabulary made operator-friendly (`Awaiting response` / `Responded` / `Expired`; no `Revoked` state). Captured in 20 inline feedback comments + 3 `← recommended` Qs answered. |
| R2.1 | 2026-05-15 | Post-mock-review iteration on Round-2 mock (Round-2 feedback Comments R2-1 through R2-6) | Mock-fidelity sweep: org-switcher chip removed from all scenes; Existing Members card body rendered visibly in the mock; Custom List paste parser extended to accept `Name <email>` format with comma/semicolon/newline separators (R6 amendment); preview table columns updated to `Name / Identifier / Last response · this survey / Last response · all surveys` — Tier column dropped (R12 amendment); Success state surfaces explanatory line *"Users will be able to respond only once in this wave"* (R16 + §2.5 amendment). Weak-POV question R2-2 resolved: **Decision A — mutually exclusive modes (no merge-and-dedup)** — sharper V0 semantics; combinable / hybrid re-evaluated in V1.x. |
| R3 | 2026-05-16 | 30 inline PR review comments on PR #385 (10 themes captured in feedback file Round 3) | **Brand timezone propagation** (R3-A): expiry defaults to EOD `Brand.timezone`; all displayed timestamps in brand TZ; Edit Expiry picker permits time selection + shows TZ label. **CSV/paste permissiveness** (R3-B): paste prefers `Brand.memberIdentifierKind` (closes Round-1 OQ1); CSV upload via 11 MB multipart body (no Azure Storage needed — verified against #262 Import Survey results pattern); header-inference for column detection. **Pagination** (R3-C): paste cap 10,000 / CSV cap 100,000; Custom List preview shows all rows up to 500, paginates beyond; Existing Members preview keeps first-50 cap (random samples aren't visually verifiable at scale). **UI fixes** (R3-D): drop the faulty "with predicate removed" rationale; mock URLs use a standard CustomerEQ domain (no brand subdomains yet); filename uses `<Survey.name>-<date>-links.csv`; Generate button transitions to loading state with estimated time. **Re-download semantics** (Q1 resolved as 1c): re-download **regenerates** tokens — all members get new URLs; the previous URLs become invalid. Strong warnings at (a) success-state initial download and (b) re-download confirmation. Operator-error-recovery is the use case. **`<No batch>` filter option** (R3-E): filter row dropdown includes share-link/embed responses (`distributionBatchId IS NULL`). **Trigger endpoint retirement designed** (Q4 resolved as 4a): V0 retires `POST /v1/public/surveys/trigger` and migrates `examples/acme-coffee-demo`; the production code edits will land in impl-phase commits on this same PR (per Rule 26 — all artifacts ship in one PR for the issue). **OQ resolutions** (R3-I): OQ-S1 / S2 confirmed agreed; OQ-S3 moves to V1.x nice-to-have; OQ-S4 refined ("explicit columns win except when empty"); Round-1 OQ1 closed by R3-B; `fraim/config.json.competitors` addition designed (R3-30 supersedes Round-1 Decision 1a; config edit lands in impl-phase commit on this PR). **V1.x respondent-edit-prior-response** noted in Non-goals. **Validation plan** rewritten per R3-H. **Note**: an earlier draft of this round bundled the code/config edits into the spec-phase commit; this was reverted per Rule 26 phase discipline — spec describes the design, impl-phase commits land the code on the same branch / PR. |
| R3.1 | 2026-05-17 | Post-Round-3 PR pushback: "`app.customereq.io` is NOT the correct domain. Check how the Survey distribution URLs are created." | **URL shape correction** — Round 3 R3-9 reply was wrong on two axes. Audited the actual URL-construction sites in code (`apps/api/src/routes/developer.ts:9,43`, `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx:109`, `apps/api/src/routes/public.ts:656-657`, `apps/worker/src/processors/loyaltyEvents.ts:333`, `apps/demo-storefront/src/app/survey/[id]/page.tsx:8`): every site constructs URLs as `${configured-frontend-host}/survey/{id}`. **No `app.` subdomain anywhere** — host is the request origin or `NEXT_PUBLIC_FRONTEND_URL`, same as the admin UI. **Path is `/survey/<id>`**, not the invented `/s/<id>`. Current deployed host value is `customereq.wellnessatwork.me` (naming may change later, nothing registered). Tokenized form extends the existing path to `/survey/<surveyId>/r/<token>`: path segment beats query param (e.g., a discarded `?t=<token>` proposal) because the same query-string-as-credential leakage arguments (logs, `Referer`, URL-cleaners, browser history, autofill) that justify retiring `?email=` apply identically to a bearer token in a query param — the leaky shape is the query string itself, not the PII payload. Industry convention also lands on path segments (SurveyMonkey `/r/<token>`, GetFeedback `/r/<token>`, Typeform `/to/<form>/<token>`). All URL examples in §2.6, §3.1, §4, §6, mock scenes 1/4/6, GDPR Art. 5(1)(c), Alternatives table, and the R17/R19 acceptance criteria updated. |

## Customer

The primary persona is the **marketing manager** at a mid-market brand on CustomerEQ. They run quarterly NPS / CSAT / CES programs and send those surveys from their own ESP (Mailchimp, HubSpot, Klaviyo) or from Gmail mail-merge — because that is where their list, their domain reputation, their template system, and their unsubscribe registry live. They do not want CustomerEQ to send the email; they want CustomerEQ to give them per-recipient links they can mail-merge into their existing send.

A secondary persona is the **CX operator** running a one-off pulse to a specific cohort ("the 80 customers who escalated a support case last quarter — please ask them how we did"). Their need is the same primitive, scaled down: an explicit list of identifiers in, a CSV of links out.

A tertiary persona is the **respondent** — the customer who clicks the link from the brand's email. They never see the token; they see the form, fill it in, and submit. A leaked link is one-use; a guessed link is not a valid link.

The brand admin who configured the survey, the brand's `memberIdentifierKind`, and the brand's themes is the same persona as in [#241](241-survey-admin-ux.md) — out of scope here.

## Customer's Desired Outcome

1. **One coherent flow from "I have a survey" to "I have a CSV of per-recipient URLs in my email tool"** — without leaving the dashboard or touching the API.
2. **No PII in any survey URL** — the link a customer clicks reveals nothing about who they are. Acceptance signal for the compliance reviewer: nginx access logs, browser history, `Referer` headers, and ESP click-trackers contain only opaque tokens.
3. **A leaked or guessed URL cannot be used to submit a response as another member** — each token authorizes exactly one (member, batch, survey) submission and expires.
4. **Repeated waves to the same audience** — quarterly NPS to the same 100 members, each wave open for 7 days, one response per member per wave, history retained for trending Q1 → Q2 → Q3.
5. **Quick to navigate, not a multi-step elaborate flow** — operators come here to get one job done (generate per-recipient links and download a CSV). The surface should be a single short page, not a step-by-step wizard with confirmation screens duplicating preview information.

> **V1.x desired outcome (deferred — separate scoping):** reusable audience-spec primitive — the predicate the operator builds for "Tier=Gold, status=ACTIVE, healthScore<70, no response in last 90 days" reuses the platform's `SearchMembersQuerySchema`. In V0 the audience is just "Existing Members" (random sample by count or percent) or "Custom List" (paste / CSV); end-to-end data wiring for the filter predicates (sentiment, health-score, NPS ranges, last-response cooldown) is not yet production-ready, and surfacing those filters in V0 would over-promise capability. See **Non-goals**.

## Customer Problem being solved

The issue body enumerates four interlocking problems. Each is restated here in the language of the persona so the spec can be tested against the customer's mental model:

1. **No supported BYO-email flow.** Today brands wanting to NPS via Mailchimp have three bad options: (a) blast a single generic survey URL — loses per-recipient attribution; (b) wire up their own backend to call our APIs and per-recipient mail-merge tags — most mid-market CX operators are not engineers; (c) hand-roll URL params like `?email=jane@brand.com` — which the platform now treats as deprecated (#241 R16/D51) and which leaks PII to access logs anyway.
2. **`?member_id=` in the URL is a security and privacy liability.** For brands whose `memberIdentifierKind = 'email'`, the URL parameter *is* the customer's email. It lands in: nginx/CDN access logs (retained ~30 days by Azure default); the respondent's browser history; the `Referer` header sent to every third-party asset on the brand's thank-you page (ad pixels, web fonts, analytics scripts); ESP click-tracker query strings (often retained indefinitely for engagement analytics). This is plainly a GDPR Article 5(1)(c) data-minimization failure and a CCPA §1798.100 disclosure-via-third-parties exposure — even before anyone exploits it. Exploitation is trivial: anyone who guesses a coworker's email (or an obvious public-figure email) can POST to `/v1/public/surveys/:id/respond` and corrupt that brand's NPS, sentiment, and any closed-loop alert rule that depends on the response.
3. **No audience selector or sampling primitive.** "Send to a 10% random sample of my members" / "send to exactly 500 random members" / "send to this list of 83 emails I just copy-pasted, auto-enrolling the 4 unknown ones" — none of these exist as a first-class operation today. The closest thing is the member-list page with its filters; from there, the operator's options are export to CSV and reach for spreadsheet formulas. Random-sample-by-count-or-percent and explicit-list-with-auto-enroll are pure greenfield. (Note: filter-by-attribute audience targeting — Gold tier, low health score, etc. — is a V1.x extension on top of the V0 primitives; see Non-goals.)
4. **No "one response per wave."** `Survey.responsePolicy` (`ONCE | MULTIPLE | LATEST_OVERWRITES`) governs the lifetime of a survey, not a period inside it. The operator running quarterly NPS to the same 100 members wants the survey to be `MULTIPLE` (so Q2 doesn't reject members who answered in Q1) **and** wants exactly one response per member per quarter (so Q2 isn't gamed by a member opening the link twice). There is no value of `responsePolicy` that delivers both.

The cumulative effect: the operator who wants "let me send NPS to my Gold members from Mailchimp each quarter and see the trend" finds the platform supports none of the four pieces — and accidentally trips a GDPR exposure in the process.

## User Experience that will solve the problem

The mock at [`mocks/378-distribute-flow.html`](mocks/378-distribute-flow.html) is the working artifact (interactive — walk the steps in-browser). Sections below describe the experience at the level of "specific steps the user takes"; the mock is the source of truth for visual layout, copy, and affordances.

### §1. Entry point

- **Path**: `/admin/surveys/[id]/distribute` — a new sub-route of the existing survey detail page (`/admin/surveys/[id]`) per the Standard CRUD admin pattern in `docs/architecture/architecture.md` §3.1.
- **How the operator gets there**: from the existing Distribution section on the survey detail page (#241 R26 / R27), a new **`Send via my email tool →`** primary action sits alongside the existing `Share link` and `Embed snippet` tiles. Tile copy: *"Generate per-recipient links for mail-merge applications like Mailchimp, or use the links to send individual mails."* Clicking it routes to `/admin/surveys/[id]/distribute`.
- **DRAFT vs. ACTIVE**: the entry point is **disabled when `Survey.status === 'DRAFT'`** with a tooltip "Activate the survey before distributing". Once the survey is ACTIVE, the entry point is live. PAUSED disables with "Resume the survey to distribute"; STOPPED disables with "This survey is stopped — Restart to distribute".

### §2. The Distribute page — single short page

The Distribute surface is a **single page** at `/admin/surveys/[id]/distribute`. No tabs, no step-rail, no Back / Continue pagination, no separate Confirm screen. Operators come here to do one job — generate per-recipient links and download a CSV — and the page is shaped around that job, top to bottom.

The page has **two visual states** on the same route:
1. **Configure** — mode chooser + mode-specific inputs + common fields + live preview + `Generate links` button
2. **Success** — generated-success banner + format dropdown + Download CSV button + `Done — back to survey` link

Clicking `Generate links` transitions State 1 → State 2 in place (no route change, no loading screen interstitial). Closing the browser before clicking Generate discards the in-progress configuration (no resumable draft batches in V0 — there's nothing to resume to since there's no multi-step state).

#### §2.1 Configure state — Who gets this survey?

The mode chooser is the first interactive element. Two mutually-exclusive modes presented as radio cards:

- **Existing Members · `N` total** — random sample from the brand's existing member roster. Choose **Percent** (1–100% of `N`) or **Count** (exact integer ≤ `N`). The card is **hidden entirely when `N = 0`** — for a brand that has never enrolled any members, Custom List is the only path and surfacing Existing Members as a disabled option is noise.
- **Custom List** — operator supplies identifiers directly. Two sub-modes (toggleable within the card):
  - **Paste** — multi-line textarea accepting the operator's natural mail-list shape. Up to **10,000 entries**. Each entry can be (a) a bare value matching `Brand.memberIdentifierKind` (email if brand is `email`-keyed, phone if `phone`-keyed, external_id if `external_id`-keyed, memberId fallback), or (b) the RFC-822-style `Display Name <email@example.com>` form (when the brand is email-keyed). Entries are separated by **newline, comma, or semicolon** — operators can paste a single comma-separated line copied from an email "To:" header, a one-per-line list, or any mix. **Identifier-kind resolution**: an entry first attempts to match the brand's primary kind; for ambiguous patterns (e.g., `12345` could be phone or external_id), `Brand.memberIdentifierKind` is the tie-breaker (resolves Round-1 OQ1). When the `Name <email>` form is used and the address resolves to an unknown identifier under auto-enroll (see below), the parsed display name populates `firstName` / `lastName` on the newly-enrolled member (last whitespace-separated token → `lastName`; everything before → `firstName`; single-token names → `firstName` only).
  - **Upload CSV** — operator-friendly: header-and-data inference, the same pattern `POST /v1/surveys/:id/import` already uses for historical survey responses (see `apps/api/src/routes/surveys.ts:912`). The upload is `multipart/form-data` with an **11 MB body limit** (matches the existing import endpoint's `bodyLimit`) — sufficient for ~100,000 rows of typical email-list data at ~70 bytes/row. **No Azure Storage involved**; CSV parsed in-memory from the request body. Up to **100,000 entries**. Column detection inspects the header row first (any of `email` / `e-mail` / `mail` → email; `phone` / `phone_number` / `mobile` → phone; `external_id` / `customer_id` / `customer id` → external_id; `member_id` / `memberId` → memberId; `first_name` / `firstname` / `given name` → firstName; `last_name` / `lastname` / `surname` / `family name` → lastName) and falls back to per-cell format inference when the header is absent or ambiguous. **`Brand.memberIdentifierKind` is the tie-breaker** — if a row has *both* an email column and a phone column and the brand is email-keyed, the email column wins as the identifier; the phone column is passed through as profile data. Multi-column CSVs with `firstName` / `lastName` columns are accepted; explicit columns win over bracketed-name form except when empty (OQ-S4, resolved).
  - **Auto-enroll checkbox** — *"Auto-enroll members not in this brand"* (default ON). When ON, unknown identifiers route through `resolveOrEnrollMember()` with `enrolledVia = 'BULK_DISTRIBUTION'` at generate time. When OFF, unknown identifiers are listed under `unmatched` in the preview and excluded from the wave.
  - **Mode is mutually exclusive with Existing Members** (Decision A, Round 2 R2-2): one batch = one source. The operator who wants "Gold members + 5 specific escalations" runs two batches against the same survey — each appears in the Distribution batches filter as its own wave. Combinable / hybrid modes deferred to V1.x where the filter-predicate primitive will live.

**V0 explicitly excludes filter predicates** (tier / status / sentiment / NPS / health-score / enrollment-date / response-cooldown chips). Those filter dimensions are not all production-ready end-to-end; surfacing them in V0 would mis-promise capability. The predicate primitive is recorded in Non-goals for V1.x.

**Sampling seed is not surfaced in the UI.** Operators don't care about seeds — they care about outcomes ("did this wave go to the right members?"). The column `DistributionBatch.samplingSeed` is still written on every Existing Members batch as internal infrastructure (the V1 "Generate new tokens for same audience" affordance will use it to re-sample deterministically), but neither the configure page nor the batch detail page show it.

#### §2.2 Configure state — Common fields

Below the mode chooser, two fields apply to either mode:

- **Survey name in mail** — a single text input. Default value: the **respondent-facing** `Survey.title` (#241 R7 — the new nullable column for the respondent's form heading), **not** the admin-only `Survey.name`. The operator may edit before generating. Stored on `DistributionBatch.surveyNameInMail`; flows into the downloaded CSV's `surveyName` column so the brand's mail-merge template can reference it (e.g., `*|SURVEY_NAME|*` in Mailchimp).
- **Links expire on** — a select with presets (24 hours / 7 days / 30 days / 90 days / Custom date+time). Default: 7 days from now, snapped to **end-of-day in `Brand.timezone`** (the brand's timezone, captured in `schema.prisma:212` under #277 Organization Settings, default `"UTC"`). Custom Date+Time opens a date-and-time picker; helper text directly below the picker reads *"All times in `<Brand.timezone>`"* (e.g., *"All times in America/Los_Angeles"*). Stored on `DistributionBatch.expiresAt` as a UTC timestamp; displayed everywhere else in `Brand.timezone`. Editable later from the batch detail page (§3.1) while the survey is open.

A **wave label** is auto-derived as `<Survey.title> · <ISO date>` (e.g., "Q2 customer satisfaction · 2026-05-15") and stored on `DistributionBatch.label` for operator-facing analytics naming on the survey detail page filter and batch detail header. The label is **not** surfaced as an editable field on the configure page in V0 — the survey-name-in-mail field plus today's date is a sufficient operator mental anchor, and one fewer input keeps the page short. If the operator needs to rename a wave later, it can be edited from the batch detail page header.

#### §2.3 Configure state — Live preview

A compact preview block updates live as the operator changes inputs above:

- **One-line summary**: *"`N` members will receive this wave"* (Existing Members mode) or *"`N` members will receive this wave · `K` will be auto-enrolled"* (Custom List mode with auto-enroll ON and unknown identifiers detected) or *"`N` members will receive this wave · `K` identifiers are unrecognized and will be skipped"* (Custom List mode with auto-enroll OFF and unknown identifiers).
- **Preview table**, four columns:
  1. **Name** — `Member.firstName + ' ' + Member.lastName` if resolved; the parsed display name from `Name <email>` paste if auto-enrolling; `(new)` annotation for newly-enrolling members; blank if neither
  2. **Identifier** — identifier-of-record per `Brand.memberIdentifierKind`
  3. **Last response · this survey** — most recent `SurveyResponse.completedAt` for `(memberId, surveyId)`, or `—` if none. Displayed in `Brand.timezone`.
  4. **Last response · all surveys** — most recent `SurveyResponse.completedAt` for `memberId` across all surveys, or `—` if none. Displayed in `Brand.timezone`.
  Tier is **not** a preview column in V0 (consistent with the V0 decision to drop tier-based filter predicates — Round 2 Comment R2-4).
  **Pagination policy**:
  - **Existing Members mode**: first **50 rows** shown; paginate to see more. A random 5,000-member sample isn't visually verifiable row-by-row, so verification is by the summary counter ("`N` members will receive this wave"), not by scrolling.
  - **Custom List mode**: **all rows shown by default up to 500**; paginate beyond. Custom List operators are typing or pasting specific identifiers and want to spot typos / missing entries; hiding rows behind pagination defeats that. Above 500, pagination kicks in to keep the page responsive.
  For Custom List, the table groups resolved-members on top and the `unmatched` subsection below.
- **No "Tokens to mint" separate counter** — tokens-to-mint always equals the audience count shown in the summary line (true with or without the V1.x filter predicate). One number, one mental anchor — no need to duplicate.

#### §2.4 Configure state — Generate

A single `Generate `N` links` primary button at the bottom-right of the configure area. Disabled until: (a) mode is chosen and its required input is non-empty, (b) survey-name-in-mail is non-empty, (c) the resolved member count is ≥ 1.

Clicking the button starts a transaction that: (a) writes the `DistributionBatch` row, (b) resolves-or-enrolls Custom List identifiers per the auto-enroll toggle, (c) mints one opaque token per `(batchId, memberId)`, (d) writes one `SurveyDistribution` row per token with `sentAt = now`, (e) transitions the page in place to the Success state.

The whole operation is wrapped in a single `prisma.$transaction()` — partial failures leave the database in its pre-batch state (no batch row, no tokens, no distribution rows).

**During generation** (the wait between click and Success state), the button transitions to a loading state showing:
- Button label changes to *"Generating `N` links… (~`X` seconds)"* where `X` is an estimated time derived from member count (rule of thumb: 50ms per member; 100-member batch → ~5s estimate, 10,000-member batch → ~8 min estimate). The estimate is intentionally conservative so the operator doesn't expect sub-second response on large batches.
- Below the button, a non-blocking progress line shows current step: *"Resolving identifiers… `K` of `N`"*, then *"Minting tokens…"*, then *"Writing distribution rows…"*. Each step has a known unit-cost; the progress reflects rows-processed.
- The button is disabled (no double-click); cancel is not offered in V0 (the transaction is short enough that abort isn't necessary, and partial-batch atomicity per NFR-R1 makes mid-flight cancel meaningless).
- The configure inputs above are not editable during generation (visually muted, `disabled`-styled).

Mock Scene 2 shows the configure state; Scene 2b (added in Round 3) shows the loading state mid-generation; Scene 3 shows the Success state.

#### §2.5 Success state — Download

The configure inputs are replaced in place by a success surface:

- **Success banner**: *"✓ Generated `N` links — `<wave label>`. Tokens expire `<absolute date+time>` `<Brand.timezone>`."* (e.g., *"Tokens expire 2026-05-22 11:59 PM PT."*)
- **One-wave-one-response explanatory line** (directly under the success banner, info-styled): *"Users will be able to respond only once in this wave. A leaked or re-clicked link gets the 'already submitted' state."* This pre-sets operator expectation about the respondent-side semantics that token single-use enforces (R20 / R22, §4 error states).
- **STRONG WARNING banner** (between the info line and the download controls, amber-styled — distinct from the info color of the line above): *"⚠ Save this CSV now. The plaintext URLs are shown only once. Re-downloading later requires regenerating all tokens — which invalidates the URLs in this batch."* The warning is sized and styled to draw the eye; the download button is positioned immediately below it so the action of saving is in the same field of focus.
- **Format dropdown** — single select with `Generic` as the default top item, then `Mailchimp` / `HubSpot` / `Klaviyo` below. The choice tunes the CSV's column headers and the merge-tag syntax inside the `mergeTagUrl` column (see §2.6).
- **Single `⬇ Download CSV` button** — generates and downloads the CSV in the chosen format. The CSV is materialized on click using the in-memory plaintext URLs returned by `POST /v1/surveys/:id/distribution-batches` (this single response is the only server transmission of plaintext per NFR-S2).
- **`Done — back to survey →`** link.

There is **no separate "merge-tag snippet" card** in V0 — the CSV's `mergeTagUrl` column contains the rendered URL inline, so the operator just maps that column in their mail tool's link merge tag.

### Why re-download regenerates tokens (Q1.1c — operator-error recovery design)

Server-side, plaintext tokens are **not stored** — only their SHA-256 hashes are at rest, per NFR-S2 (mirrors `ApiKey.keyHash` precedent at `apps/api/src/plugins/auth.ts:69`). The plaintext URLs exist only in the response body of `POST /v1/surveys/:id/distribution-batches`, the single transmission. Subsequent GETs cannot reconstruct them.

So re-download from the batch detail page (§3.1) can't return the same URLs. The V0 design (Q1.1c, locked Round 3) is:
- **Re-download = regenerate**: the operator triggers a new minting transaction that creates **new tokens** for every existing `(batchId, memberId)` pair in the batch. The old hashes are replaced; the old URLs become invalid (their hashes no longer exist in the table).
- **Intended use case**: operator-error recovery — *"I lost the CSV before pasting into Mailchimp; my recipients have not seen any email yet."* Regenerating gives them a fresh CSV without forcing a brand-new audience build.
- **Anti-use case**: *"I want a second copy of the same URLs I emailed last week."* This is irrecoverable by design; the email was the one-time transmission of the URLs.
- **The regenerate action is gated by a confirmation modal** with a second strong warning (see §3.1 Re-download). The operator must explicitly acknowledge that the previous URLs will stop working.

#### §2.6 CSV shape

The downloaded CSV has six columns (column-naming varies by chosen format; semantics are identical):

| Column (Generic) | Column (Mailchimp) | Column (HubSpot) | Column (Klaviyo) | Source |
|---|---|---|---|---|
| `memberId` | `memberId` | `member_id` | `Member ID` | `Member.id` — opaque, useful for downstream operator audit; never exposed to recipient |
| `identifier` | `Email Address` (or `Phone Number` etc.) | `email` (or `phone` etc.) | `Email` (or `Phone` etc.) | Member's identifier-of-record per `Brand.memberIdentifierKind` |
| `firstName` | `FNAME` | `firstname` | `First Name` | `Member.firstName` |
| `lastName` | `LNAME` | `lastname` | `Last Name` | `Member.lastName` |
| `surveyName` | `SURVEY_NAME` | `survey_name` | `Survey Name` | `DistributionBatch.surveyNameInMail` (same value on every row in the batch — see Open Question OQ-S1) |
| `mergeTagUrl` | `SURVEY_URL` | `survey_url` | `Survey URL` | The token URL, rendered with merge-tag wrapping if the chosen format expects it. **Generic format**: bare URL (`https://customereq.wellnessatwork.me/survey/srv_q2nps_a1b2/r/Xk8mP3qB...`). **Mailchimp / HubSpot / Klaviyo formats**: bare URL too — the *merge-tag* syntax (`*\|SURVEY_URL\|*` / `{{ contact.survey_url }}` / `{{ event.SurveyUrl }}`) is operator-side template syntax pointing at the column, not stored in the cell. |

Filename: `<sanitized-Survey.name>-<YYYY-MM-DD>-links.csv` (e.g., `Q2-NPS-Loyalty-2026-05-15-links.csv`). The internal `Survey.name` is sanitized for filesystem use (spaces → hyphens, non-`[A-Za-z0-9-]` characters removed) — operator-facing label rather than a separate "slug" column.

### §3. Distribution batches filter on the survey detail page

The post-wave discovery surface is a **filter row** — not a standalone analytics section. It sits **between Loop Monitor and Response** (#241 R32b and R32) on the survey detail page and lets the operator narrow the Response section below to a specific batch's responses.

**Layout note**: detail page ordering becomes:
1. Distribution (#241 R26)
2. Loop Monitor (#241 R32b)
3. **Distribution batches filter (NEW)**
4. Response (#241 R32)
5. Configuration summary (#241 R28)

The filter is positioned between Loop Monitor (lifetime pipeline / SLA — batch-independent per the issue #6 hero pipeline framing) and Response (the analytics surface that benefits from per-batch slicing). Selecting a batch narrows **Response only**; Loop Monitor stays lifetime-wide. This matches the operator's mental model: lifetime pipeline = "is the loop closing across all sends," per-batch response analytics = "how did *this* wave do?"

**Filter row shape**:
- Compact horizontal row with a `Wave:` label and a select control.
- Select default: `All waves and direct responses` (Response shows everything — `distributionBatchId IS NULL` rows from share link / embed widget responses, plus all batch-attributed rows).
- Select options (sorted `createdAt DESC`):
  - `<wave label> · <sent date in Brand.timezone> · <N responded / N sent>` per batch — each option carries a `Details →` link to the batch detail page
  - `Direct responses (share link / embed)` — scopes Response to `distributionBatchId IS NULL`. Responses that arrived via the share-link path or the embed widget (no batch) end up under this option. **Important**: this option is shown only when at least one such response exists; hidden when all responses are batch-attributed. This is per R3-12 — brands posting a survey publicly AND sending tokenized links via their ESP get both populations co-existing, and the operator needs to slice by source.
- Selecting an option: Response section below re-queries with `distributionBatchId = :batchId` (for a specific batch) or `distributionBatchId IS NULL` (for direct responses).
- The filter row is **hidden entirely when no batches exist AND no direct responses exist** for this survey — there's nothing to filter on. As soon as one batch is created OR one direct response arrives, the row appears.

#### §3.1 Batch detail page

Clicking `Details →` opens `/admin/surveys/[id]/distribute/batches/[batchId]`, a focused page for one wave:

**Header**: wave label + status pill (Active / Expired) + summary counters (sent / awaiting response / responded / expired).

**Audience Spec block** (read-only — what audience was chosen at send time):
- Mode (e.g., `Existing Members · Count = 100` or `Custom List · 47 identifiers (4 auto-enrolled)`)
- **Members in audience at send time: `N`** + **Members in audience now: `M`** — two side-by-side counters. `M ≤ N` accounts for members who left the brand, were erased, or otherwise dropped out since send. The delta is implicit (operator infers from the two numbers). This pre-explains why a future V1 "Generate new tokens for same audience" run will hit `M`, not `N` — without it operators may think the system made an error. **`now` is the current moment in `Brand.timezone`** — the displayed counts reflect the brand's local time of last query (refreshed on page load).
- Created at + by whom — timestamp displayed in `Brand.timezone` (e.g., *"2026-05-15 10:24 AM PT by manohar.madhira@outlook.com"*).

**Expiry control** (separate from Audience Spec — it's mutable):
- Label: *"Links expire on: `<absolute date and time>` `<Brand.timezone>` · [Edit]"* (e.g., *"Links expire on: 2026-05-22 11:59 PM PT · [Edit]"*).
- Clicking `[Edit]` opens an inline **date + time picker** (Round 3 R3-21). New value may be **earlier or later** than the current value (Comment 18 / Q-R1.A — both directions while the survey is open). Helper text directly below the picker reads *"All times in `<Brand.timezone>`"*. Constraints: new `expiresAt ≥ now()` (in brand TZ); survey must be `ACTIVE`. The change propagates to all tokens in the batch (single transaction).
- Edit is **disabled** when the survey is not ACTIVE or when the batch has already fully expired.

**Tokens table** (paginated):
| Column | Notes |
|---|---|
| Member | Name (linked to Customer 360) |
| Identifier | Email / phone / external_id per `Brand.memberIdentifierKind` |
| Token prefix | First 8 chars of plaintext, display-only |
| Status | One of `Awaiting response` / `Responded` / `Expired` |
| Responded at | Timestamp when status transitioned to Responded, else `—` |

**Consumption-over-time sparkline** — small inline visual showing response density across the wave window (open-rate proxy). Cosmetic; not a load-bearing analytics surface.

**Regenerate links + download** — single dropdown (Generic / Mailchimp / HubSpot / Klaviyo) + a `⬇ Regenerate links + download CSV` button (renamed from "Re-download" to reflect the actual behavior per Q1.1c), RBAC-gated by `survey.distribute`.

Because plaintext URLs are not stored at rest (NFR-S2), a literal "re-download" of the original URLs is not possible. Instead, this action triggers a **token regeneration** transaction that:
1. Mints new tokens for every `(batchId, memberId)` pair in the batch (same audience; new opaque URLs)
2. Replaces `tokenHash` + `tokenPrefix` for each row; `consumedAt` history is preserved (responded members stay responded — their previous URL was already consumed)
3. Returns the new plaintext URLs once in the response body for the CSV download
4. Audit-logs the regeneration with `action='distribution_batch.tokens_regenerated'`, `metadata.regeneratedCount`, `actorUserId`

Clicking the button surfaces a **confirmation modal** with a second strong warning:
> ⚠ **Regenerating links will invalidate the previous URLs.**
>
> Use this only if the previous emails have NOT been sent yet. If recipients have already received emails with the previous URLs, they will see "This link is not valid" and won't be able to respond.
>
> This action exists for operator-error recovery (e.g., you lost the CSV before pasting it into your email tool). It is **not** a way to get a second copy of links you already distributed.
>
> [Cancel] [Yes, regenerate `N` links]

After confirmation, the action runs and downloads the new CSV immediately. Operators who already sent emails and clicked Regenerate by mistake have no recovery path within V0 — the previous URLs are gone. Audit-log + an in-app notification flag this clearly so the operator understands the consequence.

**No Revoke action** — the V0 spec replaces "Revoke remaining" with Edit Expiry. The operator's natural goal when they want to "cut off" a wave is to set the expiry to a near-future moment. Per Comment 12, Revoke remaining was over-scoped for V0; Edit Expiry is the constructive control.

**No Re-run action in V0** — the "Generate new tokens for the same audience on expired tokens" affordance (taking the operator back to the configure page pre-populated with the prior audience, deterministic via the internal seed) is a **V1 feature requiring its own scoping**. See **Non-goals (v1)**.

### §4. The respondent's experience

For a respondent clicking a tokenized URL, the experience matches the existing Standalone survey form (#241 R15 / R17) with three changes:

1. **URL shape**: `https://<host>/survey/<surveyId>/r/<token>` — extends the existing `/survey/<surveyId>` share-link path (the same path the admin's "Copy survey link" button produces, constructed against the configured `NEXT_PUBLIC_FRONTEND_URL` per `apps/web/src/app/(admin)/admin/surveys/[id]/components/DistributionSection.tsx:109` and `apps/api/src/routes/developer.ts:43`) by appending an `/r/<token>` segment for tokenized access. Replaces the existing `?email=<encoded>` legacy query-param pattern from the retired trigger endpoint — the bearer-token-in-query-string shape leaks identically to PII-in-query-string (logs, `Referer`, URL-cleaners, browser history) so the token rides as a path segment instead. The plain `/survey/<surveyId>` form (no `/r/...`) remains supported for share-link distribution — the tokenized form is additive.
2. **Member-identification field is suppressed**: when the URL carries a valid token, the form does not ask the respondent who they are (the token resolves the member). The form shows only the questions, consent block, and submit button. The respondent-form preview that operators see lives in the existing **Configuration Summary** section of the survey detail page (#241 R28 — "Survey preview" header). #378 does not duplicate it.
3. **Token-invalid states** — the response form renders an error state with copy keyed to the failure mode. No PII (no member identifier, no batch label, no email) is revealed in any state. Brand-side `Brand.supportEmail` is **not** referenced (we don't have a guaranteed support surface to point respondents at); copy says *"contact the sender"* — the brand that sent the mail-merged email is the recipient's natural contact:

   | State | Server response | Respondent-facing copy |
   |---|---|---|
   | `expired` (token's `expiresAt < now`) | HTTP 410 | *"This survey link has expired. If you still want to share feedback, please contact the sender."* |
   | `responded` (token's `consumedAt IS NOT NULL`) | HTTP 409 | *"This survey has already been submitted. Thank you for your response!"* |
   | `survey-not-open` (survey status is DRAFT / PAUSED / STOPPED; supersedes the prior V1 "revoked" state since V0 has no revoke action) | HTTP 410 | *"This survey is no longer open. If you still want to share feedback, please contact the sender."* |

   **Support-email follow-up** (R3-16): the "contact the sender" copy is the V0 fallback — the brand has no documented `Brand.supportEmail` surface today. Backlog issue [#403](https://github.com/mathursrus/CustomerEQ/issues/403) captures the schema column + Organization Settings UI to add the field; once that lands, the four error states above conditionally render *"contact `{{Brand.supportEmail}}`"* when present, falling back to *"contact the sender"* otherwise. Not a blocker for #378 V0.
   | `invalid` (token does not resolve — malformed, never minted, mistyped) | HTTP 410 | *"This link is not valid. Please check that you copied the full link from your email, or contact the sender."* |

   The server's HTTP response shape is uniform across states (the response body's `state` field is the same enum-shape regardless of which failure occurred) to prevent token-existence-leaking timing attacks. The respondent-facing copy varies per state per the table above.

### §5. Existing surfaces that change in V0

- **The anonymous `/survey/<surveyId>` share-link path** (existing #241 surface) — unchanged. Tokens are additive; share links work as today.
- **The embedded widget path** (existing #241 R16 surface — data-attribute prefill / `CustomerEQ.surveys.prefill()` JS API) — unchanged. Embedded surveys consume member identity from the host page, not from a token URL.
- **The existing `POST /v1/public/surveys/:id/respond` endpoint** — receives an additional optional `token` field in the request body (when the respondent's form was loaded via a tokenized URL). When `token` is present, server-side validation supersedes any `memberId` / `email` field in the body — the token resolves the member authoritatively and a body-supplied identifier mismatch is rejected with HTTP 422.
- **`POST /v1/public/surveys/trigger` — RETIRED in V0** (Round 3 R3-15 / R3-23, decision 4a). The legacy "fire-on-event" survey trigger endpoint at `apps/api/src/routes/public.ts:602-679` will be deleted in the impl-phase commits of this issue (on the same branch / PR per Rule 26). It builds outbound URLs of shape `/survey/<surveyId>?email=<encoded>` (line 657) — a path that conflicts with #378's no-PII-in-URL invariant and was already half-retired (the page handler stopped reading the URL param since #241 Slice 5 per the comment at `public.ts:248`). Rather than tokenize the trigger flow (option 4a-revised), the V0 design deletes the endpoint outright and updates the in-tree caller (the acme-coffee-demo storefront) to call the new tokenized batches API. **In-tree consequence**: impl-phase commits will edit `examples/acme-coffee-demo/lib/customereq.js:124` + `server.js:11` + `README.md:16,60` to migrate to `POST /v1/surveys/:id/distribution-batches`. **Out-of-tree consequence**: any external integrator calling the public `/v1/public/surveys/trigger` endpoint will receive HTTP 404 after merge. The user confirmed no real external users exist at Round 3.

## Data Model

### New: `DistributionBatch`

```prisma
model DistributionBatch {
  id                 String           @id @default(cuid())
  surveyId           String
  survey             Survey           @relation(fields: [surveyId], references: [id])
  brandId            String           // tenant-scoped per project rule R6
  label              String           // operator-facing wave name, auto-derived as <Survey.title> · <ISO date>
  surveyNameInMail   String           // respondent-facing survey name flowing into CSV's `surveyName` column; defaults to Survey.title at create-time
  audienceSpec       Json             // mode + memberCount-at-send-time; Custom List: resolved identifier list. No filter predicate in V0.
  expiresAt          DateTime         // wave expiry — every token in this batch expires no later than this; editable via PATCH .../expiry while survey is ACTIVE
  samplingSeed       String?          // internal infrastructure for V1 "Generate new tokens for same audience" — null for Custom List, set for Existing Members. Never surfaced in V0 UI.
  createdBy          String           // clerk user id of the operator
  createdAt          DateTime         @default(now())
  tokens             SurveyDistributionToken[]
  distributions      SurveyDistribution[]
  responses          SurveyResponse[]

  @@index([surveyId, createdAt])
  @@index([brandId, expiresAt])
  @@map("distribution_batches")
}
```

### New: `SurveyDistributionToken`

```prisma
model SurveyDistributionToken {
  id          String              @id @default(cuid())
  batchId     String
  batch       DistributionBatch   @relation(fields: [batchId], references: [id], onDelete: Cascade)
  memberId    String
  member      Member              @relation(fields: [memberId], references: [id])
  brandId     String              // tenant-scoped
  tokenHash   String              @unique // SHA-256 of the plaintext; plaintext is shown once at creation (download), never stored
  tokenPrefix String              // first 8 chars of plaintext, for operator-side display in batch-detail table
  expiresAt   DateTime            // copied from DistributionBatch.expiresAt; updated atomically when Edit Expiry runs on the parent batch
  consumedAt  DateTime?           // single-use marker; set when a response is accepted via this token

  @@unique([batchId, memberId])  // one token per member per batch — the issue's stated invariant
  @@index([tokenHash])
  @@index([batchId, consumedAt])
  @@map("survey_distribution_tokens")
}
```

### Modified: `SurveyDistribution`

The existing model's `@@unique([surveyId, memberId])` constraint **moves** to `@@unique([batchId, memberId])`. The model gains a `batchId` FK; the existing `(surveyId, memberId, sentAt)` index stays for cooldown queries.

```prisma
model SurveyDistribution {
  id        String              @id @default(cuid())
  surveyId  String
  survey    Survey              @relation(fields: [surveyId], references: [id])
  memberId  String
  member    Member              @relation(fields: [memberId], references: [id])
  brandId   String
  sentAt    DateTime            @default(now())
  batchId   String?             // null for legacy rows; required for rows written under #378
  batch     DistributionBatch?  @relation(fields: [batchId], references: [id], onDelete: Cascade)

  @@unique([batchId, memberId]) // REPLACES @@unique([surveyId, memberId])
  @@index([surveyId, memberId, sentAt]) // cooldown window query, unchanged
  @@map("survey_distributions")
}
```

**Migration note** (the issue calls this out — it is a migration, not a design choice): existing rows have `batchId = NULL`, which the new unique constraint must permit. **Postgres unique constraints treat each NULL as distinct — the constraint enforces uniqueness only when both columns are non-null.** Multiple `(NULL, memberId)` rows are therefore allowed and required (a single member can have many share-link / embed responses over time, each writing a `SurveyDistribution` row with `batchId = NULL`).

**No pseudo-batch is created for share-link or embed responses** (R3-17): the existing share-link path writes `SurveyDistribution` rows with `batchId = NULL`; the unique constraint passes because NULL ≠ NULL in Postgres. The existing `(surveyId, memberId, sentAt)` query index handles cooldown lookups for both batch and non-batch rows (this is a query index, not a uniqueness gate). For backfill: pre-#378 distribution rows are not modified. New rows under #378 from tokenized waves always carry `batchId`; new rows from share-link / embed paths always carry `batchId = NULL`.

The Distribution batches filter row's *Direct responses (share link / embed)* option (§3) is the operator-facing surface that slices on `batchId IS NULL` to disambiguate the two sources for downstream analytics.

### Modified: `SurveyResponse`

Add a nullable `distributionBatchId`:

```prisma
model SurveyResponse {
  // ... existing fields per schema.prisma:752-790
  distributionBatchId String?
  distributionBatch   DistributionBatch? @relation(fields: [distributionBatchId], references: [id])
  distributionTokenId String?            // optional: links the response to the specific token that authorized it
  distributionToken   SurveyDistributionToken? @relation(fields: [distributionTokenId], references: [id])
}
```

`distributionBatchId` is the column that enables "NPS by wave" reporting and Q1→Q2→Q3 trending.

### Modified: `MemberEnrolledVia` enum

Add `BULK_DISTRIBUTION` to the enum (currently: `MANUAL_API | BULK_IMPORT | SURVEY_RESPONSE | EMBEDDED_FORM | CLERK_OAUTH`). Used by the Custom List auto-enroll path in §2.1.

```prisma
enum MemberEnrolledVia {
  MANUAL_API
  BULK_IMPORT
  SURVEY_RESPONSE
  EMBEDDED_FORM
  CLERK_OAUTH
  BULK_DISTRIBUTION  // NEW — Custom List auto-enroll under #378
}
```

## API Surface

All endpoints under `/v1/surveys/:id/distribution-batches/*` are authenticated (Clerk JWT), brand-scoped via `request.brandId` (existing multiTenant plugin), and audit-logged (existing audit plugin). The respondent-facing path remains under `/v1/public/*`.

| Verb | Path | Purpose |
|---|---|---|
| `POST` | `/v1/surveys/:id/distribution-batches/preview` | Live preview — given an audience spec (mode + count/percent or identifier list + auto-enroll flag), return projected count, first-50 sample table, and unmatched list. **Idempotent — no rows written.** Called repeatedly by the configure page as the operator changes inputs. |
| `POST` | `/v1/surveys/:id/distribution-batches` | Generate links — create the batch, resolve-or-enroll Custom List identifiers, mint tokens, write distribution rows. Single transaction. Returns batch summary + plaintext token URLs **once** (returned in response body for the immediate download; never returned by any subsequent endpoint). |
| `GET` | `/v1/surveys/:id/distribution-batches` | List all batches for the survey. Used by the detail-page filter row. Includes per-batch counters: `sentCount`, `respondedCount`, `awaitingCount`, `expiredCount`. |
| `GET` | `/v1/surveys/:id/distribution-batches/:batchId` | Batch detail — audience spec, member-count-at-send-time + member-count-now, expiry, token list (`tokenPrefix` only — never plaintext), consumption stats. |
| `POST` | `/v1/surveys/:id/distribution-batches/:batchId/regenerate-tokens` | **Regenerate links** (replaces the prior idempotent re-download per Q1.1c — Round 3). Mints new tokens for every `(batchId, memberId)` pair; replaces `tokenHash` + `tokenPrefix`; preserves `consumedAt` history. Returns plaintext URLs **once** in response body (CSV materialized from this response, identical shape to initial Generate). Body: `{ "format": "generic\|mailchimp\|hubspot\|klaviyo", "confirmAcknowledge": true }` — `confirmAcknowledge` is server-side proof that the operator accepted the strong-warning modal. Returns HTTP 422 `code='REGENERATION_NOT_ACKNOWLEDGED'` if missing. RBAC-gated (`survey.distribute`). Audit-logged with `action='distribution_batch.tokens_regenerated'`. |
| `PATCH` | `/v1/surveys/:id/distribution-batches/:batchId/expiry` | Edit Expiry Date — accepts `{ "expiresAt": "<ISO datetime>" }`. New value may be earlier or later than the current value (Comment 18 / Q-R1.A). Constraints: `new expiresAt ≥ now()`; `Survey.status === 'ACTIVE'`. Updates `DistributionBatch.expiresAt` + all child `SurveyDistributionToken.expiresAt` in a single transaction. Audit-logged. |
| `POST` | `/v1/public/surveys/:id/respond` | Existing endpoint. **Additive change:** accepts a new optional `token` field in body. When present, server validates token → resolves member → marks token consumed atomically with response write. When absent, behavior unchanged. |
| `GET` | `/v1/public/surveys/:id/token-status` | Pre-form-render check used by the standalone form when loaded at `/survey/:surveyId/r/:token` — returns one of `valid` / `expired` / `responded` / `survey-not-open` / `invalid` so the form can render the right state per §4. Response body shape is uniform across failure states; the respondent-facing copy differs per state. |
| ~~`POST` `/v1/public/surveys/trigger`~~ | **Retired in V0** (R3-15 / R3-23, decision 4a). Impl-phase commits on this PR delete the implementation at `apps/api/src/routes/public.ts:602-679` and the index entry at `public.ts:133`. The in-tree caller `examples/acme-coffee-demo` migrates to `POST /v1/surveys/:id/distribution-batches`. External callers will receive HTTP 404 after merge. |

**RBAC**: a new permission `survey.distribute` gates batch creation, expiry edits, and regenerate-tokens. The existing survey-edit role acquires this permission by default. OQ-S2 (resolved): Edit Expiry and Regenerate both use `survey.distribute`; no finer-grained gate in V0.

**Removed from V1 draft**: `POST /.../revoke` endpoint (Revoke remaining action — per Comment 12, dropped from V0; replaced by Edit Expiry Date). `GET /.../export` (idempotent re-download) — replaced by Regenerate (Q1.1c, can't be idempotent without storing plaintext).

## Functional Requirements

Tags `R1`–`R28` are referenced from implementation tasks, tests, and the RFC's traceability matrix. Each requirement has a `Given / When / Then` acceptance criterion.

### Entry point and routing

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R1** | The survey detail page's Distribution section SHALL render a primary `Send via my email tool →` action alongside the existing Share link and Embed snippet tiles, routing to `/admin/surveys/:id/distribute`. The tile description copy SHALL be: *"Generate per-recipient links for mail-merge applications like Mailchimp, or use the links to send individual mails."* | Given an ACTIVE survey, when the operator opens `/admin/surveys/:id`, then the Distribution section renders the action with the prescribed description; clicking it navigates to `/admin/surveys/:id/distribute`. |
| **R2** | The `Send via my email tool →` action SHALL be disabled when `Survey.status !== 'ACTIVE'`, with a tooltip keyed to the state. | Given `status='DRAFT'`, when the section renders, then the action is disabled and the tooltip reads "Activate the survey before distributing". Given `'PAUSED'`, "Resume the survey to distribute". Given `'STOPPED'`, "This survey is stopped — Restart to distribute". |
| **R3** | The Distribute surface SHALL be a single page (no tabs, no step-rail, no Back/Continue, no separate Confirm screen) with two visual states on the same route: **Configure** (mode chooser + inputs + live preview + Generate button) and **Success** (banner + format dropdown + Download CSV + Done link). Clicking `Generate links` transitions State 1 → State 2 in place; no route change. | Given the operator clicks `Generate links` while configured, when the transaction commits, then the URL stays at `/admin/surveys/:id/distribute` and the page renders the Success state inline. Given the operator closes the browser mid-configure, when they return, then no resumable draft batch exists (V0 has no resumable wizard state). |

### Configure state — Audience

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R4** | The mode chooser SHALL present exactly two radio-card options: **Existing Members · `N` total** and **Custom List**. The Existing Members card SHALL be **hidden entirely** when the brand has zero non-ERASED members (`N === 0`). | Given a brand with 1,243 members, when the page renders, then both cards are visible; the Existing Members card shows "1,243 total". Given a brand with 0 members, then only the Custom List card renders. |
| **R5** | The Existing Members card SHALL offer a Percent / Count toggle with a single numeric input. Percent accepts 1–100; Count accepts 1–`N`. The resolved audience count SHALL update live in the preview as the toggle or input changes. | Given the operator selects Percent at 10 against `N=1,243`, when the preview updates, then the summary line reads "124 members will receive this wave". Given they switch to Count and enter 100, then the summary line reads "100 members will receive this wave". |
| **R6** | The Custom List card SHALL accept identifiers via paste or CSV upload. **Paste shape**: up to **10,000 entries**, separated by newline, comma, or semicolon. Each entry may be (a) a bare value matching `Brand.memberIdentifierKind` (email if email-keyed, phone if phone-keyed, external_id if external_id-keyed, memberId fallback), or (b) RFC-822-style `Display Name <value>` form. **`Brand.memberIdentifierKind` is the tie-breaker for ambiguous patterns** (closes Round-1 OQ1 per R3-18). When the `Name <value>` form is parsed and the value resolves to an unknown identifier under auto-enroll ON, the parsed display name SHALL populate `firstName` / `lastName` on the newly-enrolled member (last whitespace-separated token → `lastName`; everything before → `firstName`; single-token names → `firstName` only). **CSV upload shape**: `multipart/form-data` body, **11 MB cap** (matches `apps/api/src/routes/surveys.ts:912` import endpoint's `bodyLimit`). Up to **100,000 entries**. **Header-and-data inference** like the survey-import endpoint: column detection inspects the header row (any of `email` / `e-mail` / `mail`; `phone` / `phone_number` / `mobile`; `external_id` / `customer_id` / `customer id`; `member_id` / `memberId`; `first_name` / `firstName` / `given_name`; `last_name` / `lastName` / `surname` / `family_name`) and falls back to per-cell format inference when header is absent or unclear. `Brand.memberIdentifierKind` is again the tie-breaker when multiple identifier-shaped columns are present. Multi-column CSVs with explicit `firstName` / `lastName` columns are accepted; **explicit columns win over bracketed-name form, except when the explicit columns are empty** (OQ-S4 resolved per R3-28). Modes are **mutually exclusive** with Existing Members (Decision A, Round 2 R2-2). | Given a brand with `memberIdentifierKind='email'` and a paste of `Jane Mitchell <jane@brand.com>, +15551234; usr_abc`, when the preview updates, then `jane@brand.com` is parsed as email (with name Jane Mitchell), and the other two entries appear under `unmatched` since they don't match the brand's primary kind. Given a brand with `memberIdentifierKind='phone'` and a paste of `+15551234`, then it's parsed as phone. Given a CSV with header `email,first_name,last_name` and one row `jane@brand.com,Jane,Mitchell`, then a new Member is enrolled with `email='jane@brand.com'`, `firstName='Jane'`, `lastName='Mitchell'`. Given a CSV with header `email,first_name,last_name` and a row where `first_name` and `last_name` are blank but the email column contains `Jane Mitchell <jane@brand.com>`, then the bracketed name takes effect (OQ-S4 refinement). Given a paste of 10,001 entries, then the API returns HTTP 422 `code='PASTE_TOO_LARGE'`. Given a CSV upload of 101 MB body, then Fastify returns HTTP 413. |
| **R7** | The Custom List card SHALL include an auto-enroll checkbox (default ON), copy: *"Auto-enroll members not in this brand"*. When ON, unknown identifiers route through `resolveOrEnrollMember()` with `enrolledVia='BULK_DISTRIBUTION'` at generate time. When OFF, unknown identifiers appear in the preview under `unmatched` and are excluded from the wave. | Given auto-enroll ON and the paste includes 3 unknown emails, when Generate succeeds, then `SELECT count(*) FROM Member WHERE enrolledVia='BULK_DISTRIBUTION'` advances by 3 and 3 tokens are minted for them. Given auto-enroll OFF, the same paste mints 0 tokens for those identifiers and the preview shows them under `unmatched`. |
| **R8** | The configure page SHALL **not** surface a sampling-seed input, control, or display. `DistributionBatch.samplingSeed` continues to be written on every Existing Members batch (random base64url string) as internal infrastructure for the V1 "Generate new tokens for same audience" affordance; it is never visible in the V0 UI or returned in API responses to non-admin consumers. | Given the operator views any configure-state surface or batch detail page in V0, when they inspect the rendered DOM and the JSON of any API call, then no `samplingSeed` field appears. Given the database after Generate, then `DistributionBatch.samplingSeed IS NOT NULL` for Existing Members batches and `IS NULL` for Custom List batches. |
| **R9** | The configure page SHALL **not** offer audience predicate filters (tier / status / sentiment / NPS / health-score / enrollment-date / response-cooldown) in V0. The V0 audience is mode-only (Existing Members random sample, or Custom List). ERASED members SHALL be automatically excluded from the Existing Members pool (project rule R13). | Given the page renders, when the operator inspects the configure surface, then no predicate chips, filter inputs, or "Add filter" affordances are visible. Given an Existing Members batch is generated against a brand with ERASED members in the roster, then no ERASED member receives a token. |

### Configure state — Common fields, preview, generate

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R10** | Below the mode chooser SHALL be a **Survey name in mail** field (required, ≤80 chars), defaulting to the respondent-facing `Survey.title` (#241 R7 — *not* the admin-only `Survey.name`). The value flows into the downloaded CSV's `surveyName` column. | Given a survey with `title='Q2 Customer Satisfaction'` and `name='Q2-NPS-internal-2026'`, when the page renders, then the Survey-name-in-mail field is pre-filled with `Q2 Customer Satisfaction`. Given the operator clears the field, then `Generate links` is disabled and an inline error reads "Required". |
| **R11** | Below Survey-name-in-mail SHALL be a **Links expire on** select with presets `24 hours / 7 days / 30 days / 90 days / Custom date+time`. Preset selections SHALL resolve to **end-of-day in `Brand.timezone`** for the selected day (e.g., picking "7 days" at 14:00 PT on 2026-05-15 resolves to 2026-05-22T23:59:59 in `Brand.timezone`, stored as UTC). The "Custom date+time" option opens a date-and-time picker; helper text below the picker reads *"All times in `<Brand.timezone>`"*. Stored on `DistributionBatch.expiresAt` as a UTC timestamp; displayed elsewhere in `Brand.timezone`. Editable later from the batch detail page (R26). | Given a brand with `timezone='America/Los_Angeles'` and the operator selects "7 days" at 14:00 on 2026-05-15 local, when Generate succeeds, then `DistributionBatch.expiresAt` is `2026-05-22T23:59:59-07:00` stored as the equivalent UTC. Given the operator picks Custom and selects `2026-05-22 09:00`, when the helper text renders, then it reads "All times in America/Los_Angeles" and the stored UTC matches. Given `Brand.timezone='UTC'` (default), the same flow resolves to UTC EOD. |
| **R12** | The live preview block SHALL show, updating as inputs change: (a) one summary line — *"`N` members will receive this wave"* or *"`N` members will receive this wave · `K` will be auto-enrolled"* (Custom List + auto-enroll ON + unknowns detected) or *"`N` members will receive this wave · `K` identifiers are unrecognized and will be skipped"* (Custom List + auto-enroll OFF + unknowns); (b) a preview table with exactly **four columns**: **Name** / **Identifier** / **Last response · this survey** / **Last response · all surveys** — timestamps displayed in `Brand.timezone`. Tier SHALL NOT be a preview column in V0 (consistent with R9's removal of tier-based filter predicates). (c) for Custom List, an `unmatched` subsection listing skipped identifiers. **Pagination policy** (R3-3, R3-4, R3-20 resolved): for **Existing Members** mode, first 50 rows shown; paginate for the rest (random samples aren't visually verifiable row-by-row, so the cap stays). For **Custom List** mode, all rows shown by default up to 500; paginate beyond (operators want to spot typos / missing entries in their own list — hiding behind pagination defeats verification). There SHALL NOT be a separate "Tokens to mint" counter — tokens-to-mint always equals the audience count (no separate number needed, with or without a filter predicate). | Given Existing Members at Count=200, when the preview renders, then 50 rows show with pagination controls for the remaining 150. Given Custom List with paste of 400 entries, then all 400 rows render in the table without pagination. Given Custom List with CSV upload of 600 entries, then the first 500 render and pagination controls appear for the remaining 100. Given a member with no response to **this** survey but a response to a sibling survey 2 days ago, when that member appears in the preview under `Brand.timezone='America/Los_Angeles'`, then column 3 reads `—` and column 4 reads the sibling-survey timestamp in PT. |
| **R13** | The page SHALL have one primary `Generate `N` links` button at the bottom-right of the configure area. Disabled state SHALL gate on: (a) a mode is chosen, (b) the mode's required input is non-empty, (c) Survey-name-in-mail is non-empty, (d) resolved member count ≥ 1. **During generation, the button SHALL transition to a loading state** (R3-22): label changes to *"Generating `N` links… (~`X` seconds)"* where `X` is conservatively derived from member count (rule of thumb: 50ms / member → 100-member batch shows ~5s, 10,000-member batch shows ~8 min); a progress line below the button updates by step ("Resolving identifiers… `K` of `N`" → "Minting tokens…" → "Writing distribution rows…"). The button is disabled (no double-submit); configure inputs are visually muted. The page transitions to the Success state in place (no route change) on commit. | Given all gates pass with a 47-member preview, when the button label renders, then it reads "Generate 47 links" and is enabled. Given the operator clicks Generate on a 1,000-member batch, when generation runs, then the button label reads "Generating 1,000 links… (~50 seconds)" and a progress line below cycles through the three steps. Given Survey-name-in-mail is empty, then the button is disabled with a tooltip pointing at the empty field. |
| **R14** | The Generate operation SHALL be transactional. A failure at any step (member resolution, token minting, distribution-row write) SHALL leave the database in its pre-batch state. | Given Custom List with one identifier that triggers a unique-constraint violation deep in `resolveOrEnrollMember`, when the transaction rolls back, then `SELECT count(*) FROM "DistributionBatch" WHERE id=:b` returns 0 and `SELECT count(*) FROM "SurveyDistributionToken" WHERE batchId=:b` returns 0. |
| **R15** | Token plaintext SHALL be transmitted to the operator exactly once — in the response body of `POST /v1/surveys/:id/distribution-batches`, consumed by the Success-state download. The server SHALL store only `tokenHash` (SHA-256 of plaintext) and `tokenPrefix` (first 8 plaintext chars, display-only). Tokens SHALL be ≥192 bits of entropy via `crypto.randomBytes(24)`, base64url-encoded. | Given a batch is created, when the POST response is examined, then the response body contains a `tokens[].plaintext` field. Given any subsequent GET to the batch detail endpoint, then no plaintext field appears in the response; only `tokenPrefix` + state. Sample tokens pass a chi-squared randomness check. |

### Success state — Download

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R16** | The Success state SHALL render, in this vertical order: (a) success banner with expiry shown in `Brand.timezone` (e.g., *"✓ Generated 100 links — Q2 customer satisfaction · 2026-05-15. Tokens expire 2026-05-22 11:59 PM PT."*); (b) info-styled explanatory line *"Users will be able to respond only once in this wave. A leaked or re-clicked link gets the 'already submitted' state."*; (c) **amber-styled STRONG WARNING banner**: *"⚠ Save this CSV now. The plaintext URLs are shown only once. Re-downloading later requires regenerating all tokens — which invalidates the URLs in this batch."*; (d) a single **format dropdown** (`Generic` (default) / `Mailchimp` / `HubSpot` / `Klaviyo`); (e) a single **`⬇ Download CSV`** button positioned immediately below the warning so save-action is in the same visual focus; (f) a `Done — back to survey →` link. No separate "merge-tag snippet" card — column-naming is baked into the CSV per format. | Given the page is in Success state under brand timezone PT, when it renders, then the banner shows "2026-05-22 11:59 PM PT", the info line is below it, the amber warning is below that, and the dropdown + Download CSV button are directly below the warning. Given the operator clicks Download CSV with format = Mailchimp, then the CSV downloads with Mailchimp column headers. |
| **R17** | The downloaded CSV SHALL have six columns (semantics fixed; column-naming varies by format): `memberId`, `identifier`, `firstName`, `lastName`, `surveyName`, `mergeTagUrl`. The `mergeTagUrl` column SHALL contain the bare token URL (`https://<host>/survey/:surveyId/r/:token`) — operators wrap with merge-tag syntax in their email template referring to the column. | Given the operator selects Mailchimp and clicks Download, when the CSV is parsed, then the header reads `memberId,Email Address,FNAME,LNAME,SURVEY_NAME,SURVEY_URL` and the `SURVEY_URL` column holds bare URLs. |
| **R18** | The Success-state Download is **the single transmission of plaintext URLs** per NFR-S2. The batch detail page (R23) SHALL NOT offer an idempotent re-download — only a **Regenerate tokens + download** action (Q1.1c resolved per R3-14). Regenerate mints new tokens for every `(batchId, memberId)` pair in the batch, invalidating the prior URLs; it is gated by `survey.distribute` permission AND by an explicit confirmation modal (R29). The intended use case is operator-error recovery (lost the CSV before pasting into the email tool, recipients have not yet seen the email). | Given the operator returns to the batch detail page and looks for a "Re-download" action, then no such action exists. Given they click "Regenerate links + download CSV", when the confirmation modal appears, then it shows the strong-warning copy from R29; on confirm, a new CSV downloads with **new** URLs; the previous URLs (already sent to recipients) are now invalid. |

### Token-authorized response

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R19** | URL shape SHALL be `/survey/:surveyId/r/:token`. The standalone form SHALL call `GET /v1/public/surveys/:id/token-status?token=...` on mount and render one of: (a) the form (state=`valid`); (b) the expired / responded / survey-not-open / invalid error states per §4. No PII appears in any state. | Given a valid token URL, when the form loads, then the questions render and no member-ID input field is shown. Given an expired token URL, then *"This survey link has expired. If you still want to share feedback, please contact the sender."* renders; no member identifier appears on the page or in the network traffic. |
| **R20** | When a response is submitted via a tokenized URL, the API SHALL: (a) resolve the member via the token, ignoring any `memberId` / `email` field in body for identification; (b) atomically write the `SurveyResponse` row with `distributionBatchId` and `distributionTokenId` populated, and mark `SurveyDistributionToken.consumedAt = now`; (c) reject second submissions with the same token via HTTP 409; (d) reject submissions when the parent survey is not ACTIVE via HTTP 410 with state=`survey-not-open`. The body-supplied identifier MAY be present for audit but a mismatch with the token-resolved member SHALL return HTTP 422. | Given a valid token and a response POST, when the API processes it, then both writes complete in one transaction. Given a second POST with the same token, then HTTP 409 returns and no second `SurveyResponse` row is written. Given the survey is in STOPPED state and a respondent submits a token that was minted while it was ACTIVE, then HTTP 410 returns with state=`survey-not-open` and no row is written. |
| **R21** | An expired token SHALL be rejected at response-submit even if the form was loaded before expiry (server-side check on `token.expiresAt > now()` is authoritative). | Given a token expires at 12:00 and the form was loaded at 11:59, when the operator submits at 12:01, then HTTP 410 returns with state=`expired` and the form re-renders with the expired-state copy. |

### Recurring waves and one-per-wave

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R22** | A survey with `responsePolicy = 'MULTIPLE'` SHALL accept multiple lifetime responses from the same member across batches; each batch SHALL accept exactly one response per member (enforced by the token's single-use). | Given a survey with `responsePolicy='MULTIPLE'` and the same member is included in Batch Q1 and Batch Q2 (both via separate Custom List uploads since V0 has no Re-run), when the member submits responses in both, then two `SurveyResponse` rows exist, one with `distributionBatchId = Q1` and one with `Q2`; both tokens are `responded`. |
| **R22b** | A survey with `responsePolicy = 'ONCE'` SHALL still allow tokenized distribution, but the second submit by the same member (regardless of batch) SHALL return HTTP 409 per existing #241 R8 semantics. | Given a survey with `responsePolicy='ONCE'` and the same member receives Q1 and Q2 tokens, when they submit in Q1 (accepted) and then in Q2, then Q2's submit returns HTTP 409; Q2's token is **not** marked responded (response-policy rejection happens before token consumption); Q2's token expires naturally. |
| **R22c** | A survey with `responsePolicy = 'LATEST_OVERWRITES'` SHALL accept the new response, update the prior `SurveyResponse` row in place, and overwrite `distributionBatchId` / `distributionTokenId` to the new batch and token. Prior token's `consumedAt` is **not** rolled back (consumption is monotonic). | Given `responsePolicy='LATEST_OVERWRITES'` and the same member in Q1 then Q2, when both submissions complete, then `SELECT count(*) FROM SurveyResponse WHERE memberId=:m AND surveyId=:s` is 1; row's `distributionBatchId = Q2`; Q1 token is still recorded as `responded`. |

### Batch discovery and detail

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R23** | The survey detail page SHALL render a **Distribution batches filter row** between Loop Monitor (#241 R32b) and Response (#241 R32). The filter selector default option is **"All waves and direct responses"** (Response shows everything). Other options (R3-12): one per batch in `createdAt DESC` order with format `<wave label> · <sent date in Brand.timezone> · <N responded / N sent>` (each carries a `Details →` link to batch detail page); AND a **"Direct responses (share link / embed)"** option — shown only when ≥1 response with `distributionBatchId IS NULL` exists — that scopes Response to `distributionBatchId IS NULL`. The filter row SHALL be hidden entirely when zero batches AND zero direct responses exist for this survey. Loop Monitor SHALL render unchanged regardless of filter state (lifetime pipeline view per #241 R32b). | Given a survey with three batches Q1/Q2/Q3 + 0 direct responses, when the detail page renders, then a filter row appears with default "All waves and direct responses" and the dropdown lists Q3 / Q2 / Q1; no "Direct responses" option appears. Given a survey with two batches + 5 direct (share-link) responses, then the dropdown also includes "Direct responses (share link / embed)" as a selectable option; selecting it filters Response to `distributionBatchId IS NULL`. Given a survey with zero batches AND zero direct responses, then no filter row renders. Loop Monitor's numbers stay constant across all selections. |
| **R24** | The batch detail page at `/admin/surveys/:id/distribute/batches/:batchId` SHALL display: header (wave label + status pill + counters), Audience Spec block (read-only — mode + **two member counts**: at-send-time and now), Expiry control (separately editable per R26), Tokens table (paginated; Name / Identifier / Token prefix / Status / Responded at), Consumption sparkline, and Re-download dropdown + button. | Given the operator opens the batch detail page for a batch with `at-send-time=100` and `now=96`, when the page renders, then the Audience Spec block reads "Members in audience at send time: 100 · Members in audience now: 96" with no further explanation needed. |
| **R25** | The Tokens table on the batch detail page SHALL use operator-friendly state vocabulary: `Awaiting response` / `Responded` / `Expired`. Internal column names (`consumedAt`, `tokenHash`) remain unchanged in the schema; only the UI surface uses the friendly terms. There SHALL be no `Revoked` state in V0 (no revoke action). | Given a token with `consumedAt IS NULL AND expiresAt > now()`, when the row renders, then status reads "Awaiting response". Given `consumedAt IS NOT NULL`, then "Responded". Given `consumedAt IS NULL AND expiresAt < now()`, then "Expired". |
| **R26** | The batch detail page SHALL render the batch's expiry as an editable control labeled *"Links expire on: `<absolute date and time>` `<Brand.timezone>` · [Edit]"* (e.g., *"Links expire on: 2026-05-22 11:59 PM PT · [Edit]"*). Clicking `[Edit]` opens an inline **date+time picker** (R3-21) with helper text *"All times in `<Brand.timezone>`"* directly below. The operator MAY set the new expiry **earlier or later** than the current value (Q-R1.A). API constraints: new `expiresAt ≥ now()` (compared in brand TZ); `Survey.status === 'ACTIVE'`. The change propagates to all tokens in the batch in a single transaction. The control SHALL be **disabled** when the survey is not ACTIVE or the batch has already fully expired. | Given a brand with `timezone='America/Los_Angeles'` and a batch with current expiry shown as "2026-05-22 11:59 PM PT" with survey ACTIVE, when the operator opens the picker and selects "2026-05-18 5:00 PM" (shortening), then `PATCH` returns 200 and `DistributionBatch.expiresAt` + every child `SurveyDistributionToken.expiresAt` is set to the UTC-equivalent of 2026-05-18 17:00 PT. Given the operator attempts to set expiry to a past moment, then HTTP 422 returns with `code='EXPIRES_AT_MUST_BE_FUTURE'`. Given the survey is STOPPED, then the `[Edit]` button is disabled with tooltip "Restart the survey to edit expiry". |
| **R27** | The batch detail page SHALL NOT include a `Revoke remaining` action. The constructive control is Edit Expiry per R26. The batch detail page SHALL NOT include a `Re-run with same audience` action in V0 — this is V1 scope. | Given the operator opens a batch detail page in V0, when the page renders, then no Revoke button and no Re-run button appear. |
| **R29** | The batch detail page SHALL provide a **Regenerate links + download CSV** action (Q1.1c — R3-14). The button is gated by `survey.distribute` permission AND by a confirmation modal. Clicking the button surfaces a modal with the **strong-warning copy**: *"Regenerating links will invalidate the previous URLs. Use this only if the previous emails have NOT been sent yet. If recipients have already received emails with the previous URLs, they will see 'This link is not valid' and won't be able to respond. This action exists for operator-error recovery (e.g., you lost the CSV before pasting it into your email tool). It is NOT a way to get a second copy of links you already distributed."*. Modal buttons: `Cancel` (closes without action) and `Yes, regenerate `N` links`. On confirm, the API endpoint mints new tokens for every `(batchId, memberId)` pair: replaces `tokenHash` + `tokenPrefix`; preserves `consumedAt` (responded members stay responded). Returns plaintext URLs once in response body for immediate CSV download. Audit-logged with `action='distribution_batch.tokens_regenerated'`. Body of the request MUST include `confirmAcknowledge: true` proving the operator passed the modal; missing flag returns HTTP 422 `code='REGENERATION_NOT_ACKNOWLEDGED'`. | Given the operator clicks Regenerate, when the modal opens, then the warning copy is rendered verbatim as above. Given the operator cancels, then no API call is made and no state changes. Given the operator confirms (with `Yes, regenerate 100 links`), then the API returns 200, `SELECT count(*) FROM SurveyDistributionToken WHERE batchId=:b AND tokenHash IN (:newHashes)` is 100, `count() WHERE batchId=:b AND tokenHash IN (:oldHashes)` is 0, the audit log has one `tokens_regenerated` row with `metadata.regeneratedCount=100`, and a new CSV downloads with new URLs. Given a respondent then tries to submit using one of the old URLs, then HTTP 410 `state='invalid'` returns. Given the operator's previous responses (already consumed) had `consumedAt IS NOT NULL`, those rows' `consumedAt` is preserved (consumption is monotonic — those responses are still recorded). |

### Audit and observability

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R28** | Batch creation, expiry edits, and per-token response-submit SHALL each write an audit-log entry via the existing audit plugin (`apps/api/src/plugins/audit.ts`), with `{ actorUserId, brandId, surveyId, batchId, action, metadata }`. Audit row for response-submit SHALL include `requestIp` (Fastify `request.ip`, trust-proxy-aware; null with structured-log warning if unavailable, consistent with #241 NFR-S5). | Given an operator creates a batch of 100 tokens, when the transaction commits, then one audit row exists with `action='distribution_batch.create'` and `metadata.tokenCount=100`. Given a respondent submits a tokenized response, then one audit row exists with `action='distribution_batch.token_responded'`, `metadata.memberId` set, `metadata.requestIp` populated when available. Given an operator edits a batch's expiry from 2026-05-22 to 2026-05-18, then one audit row exists with `action='distribution_batch.expiry_edit'`, `metadata.fromExpiresAt`, `metadata.toExpiresAt`. |

## Non-Functional Requirements

### Performance

| ID | Requirement | Target |
|----|-------------|--------|
| **NFR-P1** | Batch creation API for a 1,000-token batch | p95 < 5s end-to-end (including member resolution, token minting, distribution rows) |
| **NFR-P2** | Batch creation API for a 10,000-token batch | p95 < 30s; minted in chunks of 1,000 within the same transaction |
| **NFR-P3** | Audience preview API for a brand with 100,000 members (Existing Members mode random sample) | p95 < 2s — uses the same indexed query plan as `/v1/members?status<>'ERASED'` followed by deterministic sample-by-seed |
| **NFR-P4** | Token-status check + response submit on tokenized URL | p95 < 300ms end-to-end (well within the existing public-survey submit p95 of #241 NFR-P2) |
| **NFR-P5** | CSV download for a 10,000-row batch | p95 < 5s; streamed response, not buffered |

### Security

| ID | Requirement | Control |
|----|-------------|---------|
| **NFR-S1** | DistributionBatch, SurveyDistributionToken, SurveyDistribution writes SHALL be brand-scoped per project rule R6 | `brandId` sourced from JWT, never request body. The Prisma tenant-scope middleware (`packages/database/src/middleware/tenantScope.ts`) covers the new models. |
| **NFR-S2** | Tokens SHALL be stored hashed at rest (SHA-256), plaintext shown once at creation | Parallels existing `ApiKey.keyHash` pattern (`apps/api/src/plugins/auth.ts:69`) |
| **NFR-S3** | Tokens SHALL be single-use; `consumedAt` write atomic with `SurveyResponse` write | Single `prisma.$transaction()` per response submit |
| **NFR-S4** | Token URLs SHALL contain no PII | Token is 32-byte base64url string; no member id, email, brand id, or batch label in URL |
| **NFR-S5** | Token-validation timing SHALL be constant-time (resistant to timing-attack token-guessing) | `crypto.timingSafeEqual()` for hash comparison; uniform error-response body shape across `invalid` / `expired` / `responded` / `survey-not-open` states at the server-API level (respondent-facing copy differs per state but the server's body structure does not) |
| **NFR-S6** | Edit Expiry to a shorter window SHALL be applied atomically — once the `PATCH .../expiry` transaction commits, no token whose new `expiresAt` is in the past will accept a response, even if a concurrent response submit was in flight when the edit ran | The expiry-edit transaction updates `DistributionBatch.expiresAt` + all child `SurveyDistributionToken.expiresAt` in one statement; the response-submit transaction's `expiresAt > now()` check uses the row's current value, which the edit's commit has already updated. No second-level race window. |
| **NFR-S7** | Per-token consumption audit (R27 / R28) SHALL include source IP and user-agent | Same Fastify `request.ip` / `request.headers['user-agent']` capture as existing audit plugin |
| **NFR-S8** | Token plaintext SHALL only be transmitted over TLS | Enforced by the existing Azure Container Apps / Vercel HTTPS-only ingress; no plaintext fallback path |

### Reliability

| ID | Requirement | Control |
|----|-------------|---------|
| **NFR-R1** | Batch creation SHALL be atomic — partial batches MUST NOT exist | `prisma.$transaction()` per batch; failure rolls back all writes (audit row is written outside the transaction only on success) |
| **NFR-R2** | Response submission via token SHALL be idempotent | Existing #241 NFR-R2 + token single-use: a second submit with the same token returns HTTP 409 from the unique constraint on `(batchId, memberId)` and the `consumedAt IS NULL` check |
| **NFR-R3** | Batch creation under Custom List with auto-enroll SHALL handle a partial member-resolution failure gracefully — if 1 of 100 identifiers fails to resolve (malformed, hits a per-brand rate limit, etc.), the batch creation SHALL fail with a structured error listing the failing identifier(s) and no DistributionBatch row is written | Tested with a deliberate malformed identifier in a 100-row paste |
| **NFR-R4** | The Custom List resolution path SHALL re-use the existing `resolveOrEnrollMember` consent-stamping behavior — `consentGivenAt` auto-stamped to `now()` for newly-enrolled BULK_DISTRIBUTION members; existing members' consent timestamps untouched | Verified against `apps/api/src/services/memberResolution.ts:158` and `:205-212` |

### Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| **NFR-SC1** | A brand SHALL be able to create up to 10 batches per minute per survey | Throttled at the API layer (existing rate-limit plugin extended) |
| **NFR-SC2** | A single batch SHALL support up to 100,000 tokens | Token minting chunked at 1,000 per insert; bounded transaction time |
| **NFR-SC3** | Cumulative across batches, a brand SHALL be able to retain unlimited historical batches; batches expire from `Active` to `Expired` automatically but rows are retained for trending | No data retention purge in V0; Issue #200 / future data-retention initiative owns lifecycle |

### Accessibility (WCAG 2.1 AA)

| ID | Requirement | Control |
|----|-------------|---------|
| **NFR-A1** | The Distribute configure page SHALL be fully keyboard-navigable | Tab order: mode cards → mode-specific input → Survey-name-in-mail → Links-expire-in → Generate button. Arrow keys switch between mode cards when focus is on either card. |
| **NFR-A2** | The mode selector cards SHALL be radio-button semantic with `aria-checked` | `<div role="radiogroup">` over two `role="radio"` cards (or one card when Existing Members is hidden per R4). |
| **NFR-A3** | Color SHALL NOT be the only indicator of token / batch status | Status pill includes text label (`Awaiting response` / `Responded` / `Expired`) alongside color. |
| **NFR-A4** | Error states on the respondent-facing tokenized URL SHALL meet contrast and label requirements | Same standalone form chrome as #241 R15 / NFR-A4; error-state copy uses the same theme tokens as the form body. |

### Observability

| ID | Requirement | Mechanism |
|----|-------------|-----------|
| **NFR-O1** | Batch creation, expiry edits, and token response-submit SHALL emit structured logs with `surveyId`, `batchId`, `tokenId`, `actorUserId`, `requestIp` | Pino structured logger (existing pattern) |
| **NFR-O2** | Cumulative batch-level counters (`sentCount`, `respondedCount`, `awaitingCount`, `expiredCount`) SHALL be queryable for the filter row's per-option display | Materialized via simple SELECT — no separate counter table needed in V0 |
| **NFR-O3** | The audit log SHALL be the substrate for any future "distribution activity" view | Out of scope for #378; data substrate in place |

## Compliance Requirements

CustomerEQ's `fraim/config.json` declares **GDPR (in-scope)**, **CCPA (in-scope)**, **SOC2 (target month-12)**, **PCI-DSS (minimal-scope)**. Distribution batches and tokens process PII (member identifiers, in some flows email-as-identifier-of-record). The following controls apply.

### GDPR

| GDPR clause | Control / mapping |
|---|---|
| **Art. 5(1)(c) — Data minimization** | Token URLs SHALL contain no PII (NFR-S4). The URL pattern `/survey/:surveyId/r/:token` ensures access logs, browser history, `Referer` headers, and ESP click-trackers see only opaque token strings. Pre-#378 URL patterns (`?email=`) are deprecated and removed (per #241 D51 — #378 inherits this). |
| **Art. 17 — Right to erasure** | The existing erasure job in `apps/worker` SHALL be extended to (a) null-out `firstName`, `lastName`, identifier fields on PII columns of the Member record (existing behavior), (b) leave `SurveyResponse.distributionBatchId` and `SurveyResponse.distributionTokenId` intact (those are not PII — they are batch lineage), (c) leave `DistributionBatch.audienceSpec` JSON intact except for Mode C resolved identifier lists, which SHALL be replaced with `[redacted]` markers. Token plaintext is not in the DB; only hashes — these are already non-reversible. |
| **Art. 25 — Privacy by design** | Tokens are opaque by construction (`crypto.randomBytes(24)`). ERASED members are automatically excluded from the Existing Members audience pool (R9). Auto-enroll in Custom List stamps `consentGivenAt = now()` for newly-resolved members (NFR-R4), consistent with the `BULK_IMPORT` precedent in project rule R23. |
| **Art. 30 — Records of processing** | Audit log captures every batch creation, expiry edit, and token response-submit (R28) with actor, IP, and timestamp. |
| **Art. 32 — Security of processing** | Tokens stored hashed at rest (NFR-S2); single-use (NFR-S3); expirable, with operator-controlled shorten / extend via Edit Expiry (R26 + NFR-S6); constant-time validation (NFR-S5); TLS-only transport (NFR-S8). Revoke-remaining is intentionally **not** offered in V0 — Edit Expiry covers the operator's "cut off responses" need by allowing shortening to a near-future time. |

### CCPA

| CCPA clause | Control / mapping |
|---|---|
| **§1798.100 — Right to know / disclosure** | Per-batch audit log discloses every recipient member at batch-creation time; per-token response-submit audit discloses response provenance. A CCPA disclosure request can be answered from the audit log + `DistributionBatch.audienceSpec` + `SurveyResponse.distributionBatchId` join. |
| **§1798.105 — Right to deletion** | Same erasure-job extension as GDPR Art. 17 above. |
| **§1798.110 — Third-party disclosure** | Distribution to a brand's ESP (Mailchimp, HubSpot, Klaviyo) is conducted by the brand itself — CustomerEQ provides the CSV; the brand uploads it. CustomerEQ is not a "service provider" with respect to the ESP for this flow. The brand admin is the data controller for the recipient relationship. The spec documents this for clarity but does not encode a contract; the RFC owns any specific notice surfaced to the brand admin at download time ("By downloading, you confirm you have a lawful basis to email these recipients" — TBD). |

### SOC2 (target month-12)

| SOC2 TSP | Control / mapping |
|---|---|
| **CC6.1 — Logical access** | Survey distribution requires authenticated session + `survey.distribute` permission. The respondent-facing token flow is unauthenticated by design (the token authorizes the action). |
| **CC7.2 — System monitoring** | Audit log + structured logs (NFR-O1) feed the existing observability pipeline. Token consumption is monitored at the per-token granularity. |
| **CC8.1 — Change management** | Database migrations are forward-only per architecture §3.4; the schema changes here ship as a single migration with the four model additions/modifications in one ordered diff. |

### Project rules cross-reference (per project_rules.md)

| Rule | Touchpoint |
|---|---|
| R2 (Issue #6 hero — <15-min CX-to-loyalty SLA) | A tokenized survey response feeds the same `cx.<surveytype>_response` event path as standalone / embedded responses (#241 §4) — no detour through a separate pipeline. The token-validation overhead is bounded (NFR-P4 budgets 300ms p95 for token-status + submit) so the response remains well inside the SLA. |
| R5 (Event-driven first — no direct loyalty writes from API) | Unchanged. The response handler emits the cx event; the worker writes `LoyaltyEvent` atomically with `pointsBalance` (existing #241 R22 / NFR-R1). |
| R6 (Multi-tenant `brandId` everywhere) | All three new models (`DistributionBatch`, `SurveyDistributionToken`, `SurveyDistribution.batchId`) carry `brandId` and are added to `TENANT_SCOPED_MODELS` (NFR-S1). |
| R10 / R21 (One issue per branch) | This spec ships in the `feature/378-personalized-survey-links` branch; no off-scope work bundled (the Custom List `BULK_DISTRIBUTION` enum addition is in-scope per R7). |
| R13 (GDPR baked in) | Erasure-job extension above; ERASED member exclusion at audience-build time. |
| R22 (Prisma migration hygiene) | The migration is hand-edited (per architecture §3.4): the `SurveyDistribution` unique-constraint move requires `DROP CONSTRAINT` + `ADD CONSTRAINT` after the column add — Prisma's auto-generation does not emit a clean shape for unique-constraint relocation. Timestamp coordination per R22c. |
| R24 (FRAIM is mandated) | This spec is the deliverable of the FRAIM `feature-specification` job; RFC will be the deliverable of `technical-design`. |
| R25c (Spec "remove" / "deferred" instructions need project-rule cross-reference) | This spec adds, not removes. The one removal — the legacy `?email=` URL surface — was already removed by #241 D51 (cross-referenced); not re-litigated here. |
| R26 (One PR per phase artifact) | This spec ships in one PR; the RFC ships separately; impl phases ship separately. |

## User Experience — Design Standards Applied

The mocks at `docs/feature-specs/mocks/378-distribute-flow.html` follow CustomerEQ's existing admin-pattern conventions per `docs/architecture/architecture.md`:

- **Standard CRUD admin pattern** (architecture §3.1) — `/admin/surveys/:id/distribute` is a sub-route of the survey detail page. **The page is single-state-on-one-route**, not a multi-step wizard like the trigger-survey wizard (#79) or the historical-import flow (#262) — those flows have distinct phases each touching different data; this flow has one job (generate links + download CSV) and the page is shaped to complete it without navigation.
- **shadcn/ui + Tailwind v4** primitives — buttons, cards, inputs, dialogs match the existing admin chrome.
- **State-aware tile + button copy** matches the survey detail page's More-menu pattern (#241 R26).
- **Single-page in-place transition** (Configure → Success) — same route, no loading interstitial, no second URL. Matches the inline-edit pattern used on Programs (#157 — view/edit on `[id]`).
- **Tokenized URL error-state copy** uses the same theme tokens as the standalone survey form (#241 R15 / NFR-A4).

The mock files demonstrate these conventions in interactive HTML — no Markdown mocks per the FRAIM job principle "No Markdown Mocks".

## Validation Plan

*Strengthened per R3-24 in Round 3 — adds re-download (regenerate) flow, full response-side coverage, brand-timezone display verification, and audit-log completeness.*

### Functional validation

**Audience & mode selection**:
- **Audience preview accuracy (Existing Members)** — pick a brand with `N` non-ERASED members; configure Existing Members at Count=`K`; verify the preview's `K` members are a deterministic subset of the brand's roster (seeded internally via `samplingSeed`); verify column 4 ("Last response · all surveys") populates from cross-survey response history.
- **Existing Members hidden at zero** — create a brand with zero members; load the configure page; verify the Existing Members mode card does not render and only Custom List is offered.
- **Custom List paste — brand identifier kind tie-breaker** — for a brand with `memberIdentifierKind='email'`, paste a mix of `+15551234`, `usr_abc`, `jane@brand.com`; verify only `jane@brand.com` resolves; the others land under `unmatched`. Repeat for `memberIdentifierKind='phone'` → only `+15551234` resolves.
- **Custom List paste — Name <email> form** — paste `Jane Mitchell <jane@brand.com>` with auto-enroll ON against an unknown email; verify new Member with `firstName='Jane'`, `lastName='Mitchell'`. Paste `Madonna <m@example.com>` (single-token name); verify `firstName='Madonna'`, `lastName=NULL`.
- **Custom List paste — separators** — paste a comma-separated single line of 50 entries; verify all 50 parsed independently. Paste a mix of newline / comma / semicolon separators; verify all parse correctly.
- **Custom List paste — cap** — paste exactly 10,000 entries; verify Generate succeeds. Paste 10,001 entries; verify HTTP 422 `code='PASTE_TOO_LARGE'`.
- **Custom List CSV upload — header inference** — upload a CSV with header `Email,First Name,Last Name` (case + spaces); verify columns detected and rows parsed. Upload header `Customer ID,Email`; verify `Customer ID` recognized as external_id alias. Upload no-header CSV with email-shaped first column; verify per-cell inference.
- **Custom List CSV upload — body limit** — upload a 10 MB CSV; verify accepted. Upload 12 MB; verify HTTP 413.
- **Custom List CSV upload — multi-column name precedence (OQ-S4)** — CSV header `email,first_name,last_name`, row with both `first_name='Jane'` filled and `email='Carlos <c@example.com>'`; verify Jane wins (explicit column non-empty). Same CSV with `first_name=` empty and `email='Carlos <c@example.com>'`; verify Carlos wins (fallback).
- **Custom List auto-enroll** — paste 10 identifiers, 7 known and 3 unknown; with auto-enroll ON, verify 3 new Members are created with `enrolledVia='BULK_DISTRIBUTION'` and `consentGivenAt` stamped to `now()`; with auto-enroll OFF, verify 0 new Members and the unknown identifiers appear under `unmatched`.
- **Survey-name-in-mail default** — load the configure page for a survey with `title='Q2 Customer Satisfaction'` and `name='Q2-NPS-internal-2026'`; verify the field is pre-filled with the respondent-facing `title`, not `name`.

**Brand-timezone display**:
- **Expiry default snap** — for a brand with `timezone='America/Los_Angeles'`, on the configure page select the "7 days" preset at 14:00 PT on 2026-05-15; verify `DistributionBatch.expiresAt` resolves to 2026-05-22 23:59:59 PT (stored as the equivalent UTC).
- **Success banner / batch detail TZ display** — generate a batch; verify the Success state banner shows expiry in `Brand.timezone` with TZ label (e.g., "2026-05-22 11:59 PM PT"). Verify batch detail Created-at + Audience Spec "now" counter + Expiry control all display in `Brand.timezone`.
- **Edit Expiry — date+time picker + TZ label** — open Edit Expiry; verify the picker permits both date and time selection; helper text below reads "All times in `<Brand.timezone>`"; new expiry stored as UTC equivalent.

**Generate flow**:
- **Generate button loading state** — click Generate on a 100-member batch; verify button transitions to "Generating 100 links… (~5 seconds)" with progress line cycling through "Resolving identifiers…" / "Minting tokens…" / "Writing distribution rows…". On commit, page transitions to Success state in place (no route change).
- **Generate atomicity** — inject a deliberate failure mid-mint (e.g., one identifier triggers a Postgres constraint violation); verify no `DistributionBatch` row written, no tokens, no SurveyDistribution rows; the entire transaction rolls back.

**Token lifecycle (response side — R3-24 coverage)**:
- **Token lifecycle states** — create a batch, verify each token's state is `Awaiting response`; respond via token, verify state transitions to `Responded`; attempt second response via same token, verify HTTP 409 `state='responded'`; let a separate token expire (`expiresAt < now()`), verify state becomes `Expired` and HTTP 410 on submit.
- **Survey-not-open error state** — load a tokenized URL in browser; have an admin transition the survey to STOPPED; respondent submits; verify HTTP 410 `state='survey-not-open'`; respondent-facing copy reads "This survey is no longer open. If you still want to share feedback, please contact the sender."
- **Invalid token error state** — load `/survey/<surveyId>/r/INVALID_BYTES`; verify form renders the invalid-state copy ("This link is not valid. Please check that you copied the full link from your email, or contact the sender."); response body shape is uniform with the other error states (no token-existence leak).
- **No PII in any error state** — load each of the four error states; inspect rendered DOM, page-title, and network responses; verify no `memberId`, identifier, batch label, or survey title appears anywhere.
- **Response submission atomicity** — submit via valid token; verify `SurveyResponse` row written AND `SurveyDistributionToken.consumedAt = now` set in one transaction (audit by killing the API mid-write and checking neither row exists).
- **Body-identifier-mismatch rejection** — submit with `token=<valid>` AND `email='different@example.com'` (where the token's member's email is `correct@example.com`); verify HTTP 422 with `code='IDENTIFIER_MISMATCH'`; no rows written.
- **responsePolicy interaction (R22 / R22b / R22c)** — for MULTIPLE: same member responds in batch Q1 then Q2; verify two SurveyResponse rows. For ONCE: same member responds in Q1 (accepted) then attempts Q2 (rejected with HTTP 409). For LATEST_OVERWRITES: same member responds Q1 then Q2; verify exactly one SurveyResponse row, distributionBatchId=Q2; Q1 token's consumedAt preserved.

**Edit Expiry**:
- **Edit Expiry — both directions** — create a batch with 7-day expiry; shorten to 1 day, verify `DistributionBatch.expiresAt` and all child tokens updated atomically; extend back to 30 days, verify same. Attempt to set expiry in the past (in brand TZ), verify HTTP 422 `code='EXPIRES_AT_MUST_BE_FUTURE'`. Attempt Edit Expiry while survey is STOPPED, verify the UI control is disabled and `PATCH` returns HTTP 409.
- **Edit Expiry → race window with response submit (NFR-S6)** — `PATCH .../expiry` shortening expiry to `now() + 1 second`; in parallel, submit a response via one of the batch's tokens; verify the response is accepted if it arrives before the edit commit completes, rejected with HTTP 410 if after — never partially.

**Regenerate tokens (R29 — Q1.1c flow)**:
- **Regenerate happy path** — operator clicks Regenerate, confirms in the modal; verify (a) new CSV downloads immediately, (b) every previous token's `tokenHash` is replaced with a new value, (c) every previous URL submitted via the new endpoint now returns HTTP 410 `state='invalid'`, (d) `consumedAt` timestamps for already-responded tokens are preserved (those responses remain recorded), (e) audit log has one row with `action='distribution_batch.tokens_regenerated'`, `metadata.regeneratedCount`.
- **Regenerate without acknowledge flag** — call the API directly with `confirmAcknowledge: false`; verify HTTP 422 `code='REGENERATION_NOT_ACKNOWLEDGED'`; no rows mutated.
- **Regenerate cancel** — operator clicks Regenerate, then Cancel in the modal; verify no API call made and no DB state changes.
- **Regenerate after recipients already responded** — operator generates 10 tokens, 3 members respond; operator regenerates; verify the 3 responses remain valid (consumedAt preserved); the remaining 7 members' URLs are now invalid. Document this in the audit log so post-hoc the operator understands what happened.

**Filter row**:
- **Filter row appearance** — survey with 0 batches AND 0 direct responses: filter row not rendered. Survey with 1 batch + 0 direct: filter row appears with default "All waves and direct responses" and 1 batch option (no "Direct responses" option). Survey with 1 batch + 5 direct responses: dropdown also includes "Direct responses (share link / embed)" option. Selecting any option, verify Response section re-queries; verify Loop Monitor numbers unchanged regardless.
- **Filter row sort + display** — with 3 batches Q1/Q2/Q3 sent across 3 quarters, verify dropdown lists them in createdAt DESC order with sent dates in `Brand.timezone`.

**Member count at send time vs now**:
- **Member-count at-send-time vs now** — create an Existing Members batch with Count=100. Manually erase 4 members. Open batch detail. Verify Audience Spec block reads "Members in audience at send time: 100 · Members in audience now: 96".

**Trigger endpoint retirement (R3-15 / 4a)**:
- **`POST /v1/public/surveys/trigger` returns 404** — after merge, verify the endpoint returns HTTP 404. Verify the `/v1/public/` index endpoint does not list the URL.
- **Demo storefront migrated** — exercise the acme-coffee-demo "Simulate ticket resolved" flow; verify it calls `POST /v1/surveys/:id/distribution-batches` (Custom List of one identifier) and a tokenized URL is generated.

**`fraim/config.json` competitors**:
- **Config update** — verify `fraim/config.json.competitors` contains the 8-vendor block in this PR. Verify a subsequent `feature-specification` competitor-analysis phase invocation reads from config rather than re-researching.

**Quarterly NPS scenario**:
- **Quarterly NPS (V0 manual continuity)** — create a `responsePolicy='MULTIPLE'` survey. Wave 1: Custom List of 10 identifiers, have all 10 respond. Wave 2 (3 months later): Custom List of the **same 10 identifiers**, have all 10 respond. Verify: 20 `SurveyResponse` rows, 10 link to wave 1 batch, 10 link to wave 2 batch; each member's `LoyaltyEvent` count advanced by 2. (V0 has no Re-run primitive; operator maintains the identifier list externally.)

**Audit log completeness**:
- **Full lifecycle audit** — for a single batch's lifetime: create batch, generate links, one member responds, operator edits expiry, operator regenerates tokens. Verify audit log has exactly five rows: `distribution_batch.create`, `distribution_batch.token_responded`, `distribution_batch.expiry_edit`, `distribution_batch.tokens_regenerated`, with the correct actor / IP / metadata on each.

### Security validation

- **No PII in URL** — capture a tokenized URL, decode the base64url token, attempt to recover any member identifier from the bytes; must fail.
- **No PII in error states** — load each of the four token-failure states (expired / responded / survey-not-open / invalid); inspect rendered DOM, page-title, network responses; verify no `memberId`, identifier, batch label, or survey title leaks.
- **Token unguessability** — generate 1M tokens; verify ≥192-bit entropy via chi-squared randomness check.
- **Constant-time validation** — measure server-side token-validation timing for `valid` / `invalid` / `expired` / `responded` / `survey-not-open` cases; standard deviation must be < 1ms (constant within measurement noise).
- **Cross-brand access** — Operator from Brand A attempts to read a batch ID belonging to Brand B via direct API call; must return HTTP 404 (not 403 — existence is not disclosed).
- **Edit Expiry race** — `PATCH .../expiry` shortening a batch's expiry to `now() + 1 second` while a respondent's `POST /respond` is in flight against one of that batch's tokens; verify the response is rejected with HTTP 410 if it arrives after the edit commits, or accepted if before — never partially.

### Compliance validation

- **GDPR Art. 17 erasure** — enroll a member via Custom List auto-enroll, create their response via the token, run the existing erasure job for that member, verify: `Member.firstName / lastName / email` are nulled; `SurveyResponse` row retained but `memberId` nulled; `SurveyDistributionToken` retained (plaintext not in DB anyway; hash retained for audit lineage); `DistributionBatch.audienceSpec` Custom List identifier list has the affected identifier replaced with `[redacted]`.
- **CCPA §1798.100 disclosure** — issue a hypothetical CCPA disclosure request for a member; verify the audit log + batch records yield: list of batches the member was included in, list of responses they submitted via tokens, full lineage across waves.
- **Audit log completeness** — for a single end-to-end flow (create batch, generate links, one member responds, operator edits expiry), verify the audit log contains exactly the expected rows: `distribution_batch.create`, `distribution_batch.token_responded`, `distribution_batch.expiry_edit`.

### Browser validation

- Load `/admin/surveys/:id/distribute` for a survey; verify the configure page renders in a single short viewport (no scroll on a 13-inch laptop when the preview shows ≤3 rows); switch modes; verify the Existing Members mode card hides when the brand has zero members.
- Click `Generate links`; verify the same URL renders the Success state inline with banner + dropdown + Download button.
- Click Download for each format (Generic / Mailchimp / HubSpot / Klaviyo); verify each CSV has the correct column-naming.
- Load a tokenized URL in Chrome, Firefox, Safari; verify the form renders without a member-ID input and submits successfully.
- Force each of the four token-error states (Expired, Responded, Survey-not-open, Invalid); verify each renders distinct copy and visual treatment + no PII anywhere.
- On a survey detail page with 3 batches, verify the filter row appears between Loop Monitor and Response; select a wave; verify Response re-queries and Loop Monitor does not change. Verify each filter option has a working `Details →` link to its batch detail page.
- On a batch detail page, exercise Edit Expiry in both directions while the survey is ACTIVE; verify the disabled state when survey transitions to STOPPED.

## Alternatives

| Alternative | Why discard? |
|---|---|
| **Continue using `?member_id=` URL params, mandate brands rotate ESP click-tracker settings** | Not in our gift to mandate. ESP click-tracker behavior, browser history retention, and `Referer`-header behavior on the brand's landing pages are outside CustomerEQ's control. The GDPR exposure persists regardless of any brand-side configuration. |
| **Encrypt the member identifier in the URL with a per-brand symmetric key** | Marginally better than plaintext but: (a) the encrypted blob is still a stable per-(brand, member) string — a leaked blob is still a per-member impersonation key indefinitely; (b) key rotation breaks all in-flight invitations; (c) URL length grows. The opaque-token approach gives strictly stronger semantics (single-use, expirable, revocable) at the same operator-perceived simplicity. |
| **Brand-side per-recipient distribution refs (Option B from #241 D51 / OQ4)** — brand POSTs `/v1/distributions` per recipient, gets back per-invitation tokens, mail-merges them | Forces every brand to write integration code. The whole point of the BYO-email flow is "no integration code." Distribution refs remain a future enhancement for the integration-heavy brand segment (also noted in #241 D51). |
| **Signed JWT in the URL** (`/survey/:surveyId/r/:jwt`) | JWTs are not single-use without a server-side revocation list — which is exactly what `SurveyDistributionToken` is. The token-table approach gives the revocation list at the database row level for free; JWT adds 200+ bytes per URL with no concrete benefit. |
| **Use cookies for member identity post-click** | Browser-history `Referer` leakage on the click is unchanged; cookies don't solve the leak. They also break for respondents on shared devices. |
| **Use the existing embedded-widget data-attribute prefill for email distribution too** | Brands sending from their ESP have no host page to mount the widget on — the click goes to a CustomerEQ-hosted standalone form, not to the brand's website. The widget pattern only applies to in-product surveys (existing #241 R16). |

## Open Questions (RFC / implementation phase)

### Resolved in Round 3 (PR review 2026-05-16 — 30 inline comments)

- **OQ1 (Round 1) — Custom List identifier disambiguation**: **CLOSED** per R3-18 — paste/CSV parsers prefer `Brand.memberIdentifierKind` as the tie-breaker for ambiguous patterns. Captured in R6.
- **OQ-S1 — CSV `surveyName` column shape**: **RESOLVED** per R3-25 ("Agreed") — separate column. Captured in §2.6 + R17.
- **OQ-S2 — RBAC for Edit Expiry**: **RESOLVED** per R3-26 ("Agreed") — same permission as `survey.distribute` (also gates Regenerate per R29). Captured in API surface RBAC note.
- **OQ-S3 — Stalled / low-response-rate batch indicator**: **DEFERRED to V1.x nice-to-have** per R3-27. Not in V0 spec; surfaces only if operator feedback identifies the use case.
- **OQ-S4 — Multi-column CSV name-precedence**: **RESOLVED with refinement** per R3-28 — explicit `firstName`/`lastName` columns win **only when non-empty**; bracketed-name form is the fallback for empty explicit columns. Captured in R6.
- **Re-download semantics** (Q1 from agent): **RESOLVED 1c** — re-download regenerates all tokens; strong warnings at success-download AND regenerate-confirmation. R18, R29, §2.5, §3.1.
- **Paste / CSV size caps** (Q2 / Q3): **RESOLVED** — paste 10,000 entries; CSV 100,000 entries / 11 MB body. R6 + NFR-SC2.
- **Trigger endpoint retirement** (Q4 / R3-15 / R3-23): **RESOLVED 4a** — endpoint deleted in this PR; demo storefront updated to use the new batches API. §5 + code changes in `apps/api/src/routes/public.ts` and `examples/acme-coffee-demo/`.

### Resolved in Round 2.1 (post-mock-review chat feedback 2026-05-15)

- **R2-2 — Mutually exclusive vs combinable modes**: **resolved Decision A — mutually exclusive (current)**. One batch = one source. Operators who need "Gold + this specific list" run two batches against the same survey. Combinable / hybrid re-evaluated in V1.x alongside filter predicates and same-audience re-run. Captured in R4 + R6 + §2.1.
- **R2-3 — Custom List paste format**: **resolved** — parser accepts `Name <email>` RFC-822-style + bare identifiers; separators are newline, comma, or semicolon. Captured in R6.
- **R2-4 — Preview table columns**: **resolved** — Name / Identifier / Last response · this survey / Last response · all surveys. Tier column dropped. Captured in R12.
- **R2-5 — Success-state copy**: **resolved** — *"Users will be able to respond only once in this wave"* line under the success banner. Captured in R16 + §2.5.
- **R2-6 — Mock fidelity**: org-switcher chip removed from all mock scenes; Existing Members card body rendered visibly. Spec unchanged (mock-only fix).

### Resolved in Round 2 (chat feedback 2026-05-15)

- **OQ-R1.Q1 (was Q1 in round 1)** — Survey-name-in-mail surface: **resolved 1a** — CSV gets two columns: `surveyName` + `mergeTagUrl`. Default value for `surveyNameInMail` is the respondent-facing `Survey.title`, not the admin-only `Survey.name`. Captured in R10, R17 + Data Model. Feedback Comments 1, 5, 6.
- **OQ-R1.Q2 (was Q2 in round 1)** — Re-run defaults: **resolved 2c, but deferred to V1** — re-running to the same audience is a V1 feature requiring its own scoping. V0 ships without any Re-run primitive. The internal `samplingSeed` column is retained so V1 can implement deterministic re-sampling without schema churn. Feedback Comments 7, 15, 20.
- **OQ-R1.Q3 (was Q3 in round 1)** — Existing Members mode when zero members: **resolved 3a** — mode card hidden entirely; only Custom List renders when `brand.memberCount = 0`. R4. Feedback Comment 8.
- **OQ-R1.A** — Edit Expiry direction: **resolved A1** — both extend and shorten while the survey is open. R26 + NFR-S6.
- **OQ-R1.B** — Distribution batches filter scope: **resolved B1** — filter applies to Response section only; Loop Monitor remains lifetime-wide. R23.

### Round-1 OQs — re-evaluated against V0 scope

- ~~**OQ1 (Round 1) — Custom List identifier disambiguation**~~ **CLOSED** in Round 3 — `Brand.memberIdentifierKind` is the tie-breaker (R3-18). Captured in R6.
- **OQ2 (Round 1) — RBAC permission scope**: should `survey.distribute` be a separate permission from `survey.edit`, or fold into `survey.edit` by default? **Carries forward to RFC**. Proposed: separate, because the personas can differ (marketing manager may edit but not distribute; CX operator may distribute on a survey they don't own).
- **OQ3 (Round 1) — BULK_DISTRIBUTION throttle posture**: share the existing BULK_IMPORT rate-limit bucket, or a separate one? **Carries forward to RFC**. Proposed: separate, because Custom List auto-enroll is interactive (operator waiting on the configure page); BULK_IMPORT is batch.
- **OQ4 (Round 1) — CSV upload size limit**: hard cap at 100,000 rows or larger? **Carries forward to RFC**. Proposed: 100,000 (per NFR-SC2). Beyond that, V1's filter-predicate audience is the natural path.
- **OQ5 (Round 1) — Cross-survey one-per-period**: explicitly NOT in V1 scope (per the issue's Non-goals). **Closed** — future `BrandFatiguePolicy` entity is the natural shape; not in this spec.

### New OQs surfaced in Round 2

- ~~**OQ-S1 — CSV `surveyName` column shape**~~ **RESOLVED** in Round 3 — separate column.
- ~~**OQ-S2 — RBAC for Edit Expiry**~~ **RESOLVED** in Round 3 — same permission as `survey.distribute`.
- ~~**OQ-S3 — Stalled / low-response-rate batch indicator**~~ **DEFERRED to V1.x nice-to-have** in Round 3.
- ~~**OQ-S4 — Multi-column CSV name-precedence**~~ **RESOLVED** in Round 3 with refinement — explicit columns win **only when non-empty**.

## Competitive Analysis

CustomerEQ's `fraim/config.json` does not have a `competitors` list configured at the time of this draft. The competitor set below was researched directly for #378 against the closest CX-survey and CX-platform vendors in the mid-market and enterprise tiers. Recommended additions to `fraim/config.json.competitors` are listed under "Config recommendations" at the bottom of this section.

### Configured Competitors Analysis

| Competitor | BYO-email per-recipient links | Link shape (PII in URL?) | Sampling primitive | Recurring waves with one-per-wave | Tier (mid-market lens) |
|---|---|---|---|---|---|
| **SurveyMonkey** | **No** as a designed flow. Per-recipient unique links live inside SurveyMonkey's own Email Invitation Collector; CSV export is for *recipients*, not for tokenized links. Operators wanting external distribution are funnelled to the generic Web Link collector — which has no per-recipient tracking. | `www.surveymonkey.com/r/<token>` — opaque path token, up to 100 chars, alphanumeric + `-`/`_`. **No PII in URL by default.** | **Not native.** Vendor's own guidance is "use Excel `RAND()` and sort" — a manual workaround. | Not documented as a native scheduled-wave primitive. | Email Invitation Collector is on Advantage Annual+. |
| **Qualtrics XM** | **Yes — explicitly documented.** "Personal Links" generate a list of unique, single-use survey links that the brand exports and distributes via any third-party mail system. | Exact token shape not publicly documented; embedded data (name, email) is bound to the contact server-side, not in the URL. **No PII in URL by design.** | Three modes: entire contact list / individual contacts / "a small sample" of the list. Random-percent and exact-N are not in the public docs as distinct knobs. | Distributions module supports scheduled / reminder sends; recurring-wave-with-one-response-per-wave is not publicly documented as a first-class primitive. | CoreXM, enterprise pricing (sales-quoted; reported $1.5k–$5k+ per seat / year). |
| **Delighted** (Qualtrics-owned, mid-market NPS) | **Yes** via the Embed / Link platforms — paste Delighted's HTML or link into Mailchimp / HubSpot / any ESP. | Token shape not publicly documented. The Embed integration is **anonymous by default**; attribution requires the brand to **append identifiers to the link** themselves — i.e., **PII-in-URL is the documented attribution pattern.** Quote: *"by appending those details to the end of your survey links within the HTML."* | Not native. Audience = whichever list the ESP sends to. | "Autopilot" recurring NPS exists on Delighted's own send infra; for the BYO-ESP Embed path the brand controls cadence themselves. | Mailchimp integration on Free plan; HubSpot on paid. |
| **Medallia Agile Research** (formerly Crowdtech) | **Yes** — "Send with your own email system" is a documented channel: Distribute → Email → copy the per-recipient "Survey URL." | Token shape not extractable from the public docs (rendered behind a browser-check shim). | Not extractable from public docs. | "Inviting contacts more than once for the same survey" is a documented capability; specifics not extractable. | Enterprise; no public pricing. |
| **HubSpot Service Hub** (Feedback Surveys) | **No** with per-recipient tokens. Email-delivery surveys go through HubSpot's own marketing-email tool; the "Share" alternative produces **one shared URL**, not per-recipient links. | Single shared URL on a HubSpot-hosted standalone page. Some workflows allow the `{{ contact.survey_link }}` token inside HubSpot emails but the token shape is not externally documented. | Audience = HubSpot list. No documented random-%/random-N primitive in the survey tool. | Not native to feedback surveys; users assemble via Workflows. | Service Hub Professional+, plus Marketing access for email delivery. |

### Additional Competitors Analysis

| Competitor | BYO-email | Link shape (PII in URL?) | Sampling | Recurring waves | Notes |
|---|---|---|---|---|---|
| **Typeform** | **Yes** — paste link in any ESP. Typeform is a form product more than a survey-distribution product. | `form.typeform.com/to/<FORM_ID>` short path token; personalization rides as `#k=v` URL **fragment** (e.g., `#name=Bruce%20Wayne&age=18`). **PII-in-URL by design.** Typeform's own docs warn: *"You are responsible for any information you share via URL parameters. Be especially careful with personal data (like names and email addresses)."* This is **the anti-pattern #378 is moving away from.** | None — Typeform doesn't manage audiences. | None native. | Most directly cited as PII-in-URL anti-pattern evidence; their own docs are the warning. |
| **AskNicely** | Not documented as a primary path. Mailchimp/Salesforce/Zapier syncing exists for contact import; tokenized-CSV-for-BYO-send is not publicly documented. | Not publicly documented. | Throttling ("don't survey same customer too often") is documented; random-N / random-% sampling is not. | **Yes — native** recurring/quarterly cadence as a built-in trigger. | Closest to CustomerEQ on the recurring-NPS dimension; weakest on BYO-email. |
| **GetFeedback** (SurveyMonkey-owned, Salesforce-native) | Partial — Salesforce-mediated (Process Builder / Flow sends links from Salesforce). Generic-ESP CSV export is not the headline path. | `www.getfeedback.com/r/<token>?ContactID={!Contact.Id}&FirstName={!FirstName}` → rendered as `…/r/xxxxxxxx?ContactID=0030X000001XXXX&FirstName=Tym`. Path token is opaque, **but** Salesforce IDs and PII are appended as **plaintext query params by default.** An optional encryption flag is offered to "hide personal data" — opt-in, not default. | Audience driven by the Salesforce report/list the flow runs on; no in-product random-% primitive. | Built via Salesforce scheduled flows, not as a first-class survey feature. | Salesforce-bundled / enterprise. |

### Industry-standard URL pattern (cited evidence)

Live evidence from three vendor docs converges on `/r/<opaque-token>` as the dominant path shape:

1. **SurveyMonkey** — `www.surveymonkey.com/r/<token>`; opaque ending up to 100 chars, alphanumeric + `-`/`_`. [help.surveymonkey.com/en/surveymonkey/send/custom-survey-links/](https://help.surveymonkey.com/en/surveymonkey/send/custom-survey-links/)
2. **GetFeedback** — `www.getfeedback.com/r/xxxxxxxx`; same `/r/<token>` path shape. Per-respondent data optionally encrypted to keep PII out of the visible URL (opt-in). [help.surveymonkey.com/en/getfeedback/salesforce/salesforce-merge-fields/](https://help.surveymonkey.com/en/getfeedback/salesforce/salesforce-merge-fields/)
3. **Typeform** — `form.typeform.com/to/<FORM_ID>`; short opaque form ID in path. Personalization rides as `#k=v` fragment — flagged by Typeform's own docs as a PII-exposure risk. [www.typeform.com/developers/create/url-parameters/](https://www.typeform.com/developers/create/url-parameters/)
4. **Qualtrics Personal Links** — single-use per-recipient links generated server-side and exported as a spreadsheet; exact token shape not in public docs but the docs are explicit they are "unique and single-use." [www.qualtrics.com/support/survey-platform/distributions-module/email-distribution/personal-links/](https://www.qualtrics.com/support/survey-platform/distributions-module/email-distribution/personal-links/)

**Spec implication:** CustomerEQ's chosen URL shape `/survey/<surveyId>/r/<token>` (§1, §4 of this spec) follows the dominant industry pattern (path-borne opaque token) and tightens it on three axes the incumbents do not all satisfy: (a) single-use enforced server-side (vs. SurveyMonkey/GetFeedback which are stable URLs), (b) expirable (vs. all four), (c) no PII anywhere — not as an opt-in encryption flag like GetFeedback, not as a separate-Personal-Links-feature-on-an-enterprise-tier like Qualtrics, but as the **only** supported shape.

### Competitive Positioning Strategy

#### Our Differentiation

- **Key Advantage 1 — True BYO-ESP + tokens + sampling, in one entry-tier flow.** No competitor in the researched set ships all three: (a) CSV export of per-recipient tokenized URLs for any ESP, (b) random-%/random-N/explicit-list sampling as a first-class operator primitive, and (c) at a mid-market price point. Qualtrics has (a) but not (b) and is enterprise-priced. Delighted has (a) but PII-in-URL, no (b), and weakens to anonymous if PII isn't appended. SurveyMonkey has neither (a) at the per-recipient grain nor (b) natively.
- **Key Advantage 2 — Recurring-wave-with-one-response-per-wave as a data-model invariant, not a process.** AskNicely has recurring NPS but only on their own send infra. Qualtrics has scheduled-send but no documented one-per-wave attribution layer. CustomerEQ's `DistributionBatch` + token single-use makes "Q1 → Q2 → Q3 same 100 members, one response per quarter" an emergent property of the data model — and natively supports trending queries against `SurveyResponse.distributionBatchId`.
- **Key Advantage 3 — No PII in URL is the only shape, not an opt-in.** GetFeedback offers an *optional* encryption flag, exposed PII by default. Delighted documents PII-appending as the attribution method. Typeform's docs explicitly warn customers about their own URL-parameter pattern. CustomerEQ ships GDPR-Article-5-clean URLs out of the box, with no operator toggle to get it wrong.
- **Key Advantage 4 — One coherent surface from "I have a survey" to "I have a CSV of links."** The single-page Distribute surface, the Distribution batches filter on the survey detail page, the batch detail page, and the ESP-shaped CSV all live behind one Distribution action on the survey detail page. Operators don't context-switch between a Distribution module and a Contacts module (Qualtrics) or assemble it from Workflows (HubSpot).
- **Key Advantage 5 — Loop integration.** Tokenized responses feed the existing `cx.<surveytype>_response` event into the same Loop Monitor / Response-to-Action / EarningRule pipeline as anonymous and embedded surveys (#241 §4 / R22). Competitors who treat the per-recipient survey as a separate product (Qualtrics Personal Links vs. their Loop closure module) leave a seam the operator has to bridge.

#### Competitive Response Strategy

- **If Qualtrics positions Personal Links as a discriminator** → our counter is "same primitive, available at mid-market pricing, in the same surface as the loop-closure pipeline." Their seam between Personal Links (distribution) and ticketing-loop closure is our integration.
- **If Delighted's mid-market footprint encroaches on BYO-ESP** → our counter is the PII-in-URL anti-pattern citation. We can demo two URLs side-by-side and show that the Delighted Embed pattern (with PII appended) reveals the customer's identifier in browser history; CustomerEQ's tokenized URL does not. The GDPR exposure is a sales asset, not a feature footnote.
- **If SurveyMonkey ships a "Personal Links Email Collector for external ESPs"** (plausible roadmap response) → our counter is recurring-wave-with-one-per-wave. The token single-use + batch boundary primitive is non-trivial to retrofit onto a tool whose response model assumes one-link-one-survey.
- **If HubSpot adds tokenized survey links to Service Hub** (plausible bundled play) → our counter is the explicit-list-with-auto-enroll Custom List mode. HubSpot Workflows can mail-merge to a HubSpot list; they can't auto-enroll an external CSV of identifiers into a CX program. CustomerEQ is positioned as the ingestion point for cohorts that originate outside the brand's CRM (operations team's escalation list, NPS pulse for a recent product launch, etc.).

#### Market Positioning

- **Target Segment**: mid-market CX/marketing operators ($10M–$500M revenue brands) who already own an ESP / CRM relationship and don't want CustomerEQ to compete with it on send infrastructure. The persona explicitly wants to send *from their own domain*; the competitor set that does this well is enterprise-priced.
- **Value Proposition**: BYO-ESP tokenized survey distribution with sampling and recurring-wave attribution, at the same tier as the rest of CustomerEQ's CX-loyalty workflow — not as an enterprise add-on.
- **Pricing Strategy**: The feature ships in the standard tier; there is no per-batch metering at v1. Future ESP-native integrations (Mailchimp / HubSpot app store apps, see Non-goals) are the natural upsell surface, not the primitive itself.

### Research Sources

| Vendor | Source | Date observed |
|---|---|---|
| SurveyMonkey custom links | https://help.surveymonkey.com/en/surveymonkey/send/custom-survey-links/ | 2026-05-15 |
| SurveyMonkey Email Invitation Collector | https://help.surveymonkey.com/en/surveymonkey/send/email-invitation-collector/ | 2026-05-15 |
| SurveyMonkey random sampling guidance | https://www.surveymonkey.com/curiosity/how-to-create-a-random-sample-in-excel/ | 2026-05-15 |
| Qualtrics Personal Links | https://www.qualtrics.com/support/survey-platform/distributions-module/email-distribution/personal-links/ | 2026-05-15 |
| Qualtrics Anonymous Link | https://www.qualtrics.com/support/survey-platform/distributions-module/web-distribution/anonymous-link/ | 2026-05-15 |
| Delighted Mailchimp integration | https://delighted.com/our-integrations/mailchimp | 2026-05-15 |
| Delighted Embed platform | https://delighted.com/embed-platform | 2026-05-15 |
| Delighted HubSpot integration | https://delighted.com/our-integrations/hubspot | 2026-05-15 |
| Medallia "send with your own email system" | https://docs.medallia.com/en/medallia-agile-research/distribution/emails/sending-email-invitations-with-your-own-platform | 2026-05-15 |
| Medallia inviting contacts more than once | https://docs.medallia.com/en/medallia-agile-research/distribution/contact-lists/inviting-contacts-more-than-once-for-the-same-survey | 2026-05-15 |
| Typeform URL parameters (developer) | https://www.typeform.com/developers/create/url-parameters/ | 2026-05-15 |
| Typeform URL parameters (help center) | https://help.typeform.com/hc/en-us/articles/360052676612-Using-URL-parameters-formerly-Hidden-Fields | 2026-05-15 |
| HubSpot create a custom survey | https://knowledge.hubspot.com/customer-feedback/create-a-custom-survey | 2026-05-15 |
| AskNicely NPS software | https://www.asknicely.com/nps-software | 2026-05-15 |
| AskNicely integrations | https://www.asknicely.com/integrations | 2026-05-15 |
| GetFeedback Salesforce merge fields | https://help.surveymonkey.com/en/getfeedback/salesforce/salesforce-merge-fields/ | 2026-05-15 |
| GetFeedback distribution overview | https://www.getfeedback.com/help/introduction-to-survey-distribution/ | 2026-05-15 |

**Research methodology**: direct review of each vendor's publicly indexed documentation pages (help centers, developer docs, integration pages). Where information was not in public docs (Qualtrics exact token shape, Medallia internals behind a browser-check shim, AskNicely BYO-export specifics), the table records "not publicly documented" rather than inferred behavior. No competitor was contacted for sales-quoted detail; the analysis is positioned for an open-source RFC, not for a sales-objection-handling sheet.

### Config recommendations

The following additions to `fraim/config.json.competitors` would let the next FRAIM `feature-specification` job auto-load the relevant competitors for any CX-survey feature, instead of re-researching:

```json
"competitors": [
  { "name": "SurveyMonkey",  "url": "https://www.surveymonkey.com",  "segment": "survey-platform",      "tier": "mid-market" },
  { "name": "Qualtrics XM",  "url": "https://www.qualtrics.com",     "segment": "cx-platform",          "tier": "enterprise" },
  { "name": "Delighted",     "url": "https://delighted.com",         "segment": "nps-focused",          "tier": "mid-market" },
  { "name": "Medallia",      "url": "https://www.medallia.com",      "segment": "cx-platform",          "tier": "enterprise" },
  { "name": "HubSpot Service Hub", "url": "https://www.hubspot.com/products/service", "segment": "cx-platform-bundle", "tier": "mid-market" },
  { "name": "Typeform",      "url": "https://www.typeform.com",      "segment": "form-platform",        "tier": "mid-market" },
  { "name": "AskNicely",     "url": "https://www.asknicely.com",     "segment": "nps-focused",          "tier": "mid-market" },
  { "name": "GetFeedback",   "url": "https://www.getfeedback.com",   "segment": "cx-platform-salesforce-native", "tier": "enterprise" }
]
```

**Update in Round 3** (R3-29 verification + R3-30 directive "Check and add"): the user authorized the config addition for this issue (supersedes the prior Round-1 Decision 1a, which deferred the change). The 8-vendor block lands during impl-phase commits on this same PR per Rule 26 (all artifacts ship in one PR). Future `feature-specification` competitor-analysis phase invocations will auto-load these competitors once the config edit ships.

## Non-goals (v1)

Restated from the issue body and amplified with Round-2 deferments. Each deferred capability has a clear "what V0 ships instead" so operators have a path today, and a written placeholder so V1 has a starting point.

| Non-goal | What V0 ships instead | V1 placeholder |
|---|---|---|
| **Wave scheduling / auto-recurrence** (*"send every quarter automatically"*) | Operator manually creates a new batch each cycle. | Future enhancement on top of the existing batch primitive; no V0 schema change blocks this. |
| **ESP-native integrations** (Mailchimp / HubSpot / Klaviyo apps that auto-inject per-recipient tokens at send time) | CSV export + operator-side mail-merge (V0's primary flow). | Roadmap; out of scope for V1 spec. |
| **Cross-survey fatigue policy** (*"max one survey-batch include per member per N days across all surveys"*) | None. Per-survey cooldown is implicit via the operator choosing not to re-include a recently-surveyed member. | Future `BrandFatiguePolicy` entity (OQ5 round-1, closed). |
| **Anonymous / unauthenticated public-link distribution** (the existing `/survey/<surveyId>` share-link path) | **Unaffected.** Tokens are additive — share links work exactly as today. | n/a (existing surface, not deferred). |
| **Audience predicate filters** (tier / status / sentiment / NPS / health-score / enrollment-date / response-cooldown) — Round 2 Comment 2c | V0 audience is mode-only: Existing Members (random sample by Count or Percent) or Custom List (paste / CSV). | **V1.x — separate scoping.** The predicate primitive reuses `SearchMembersQuerySchema` (see Customer's Desired Outcome bullet 5). Will require end-to-end data wiring for the filter dimensions (sentiment, health score, NPS, cooldown index) that is not production-ready in V0. **File a new issue when V1.x is scoped.** |
| **Re-run with same audience** — Round 2 Comments 7, 15, 20 | V0 has no Re-run primitive. Operators who want quarterly continuity to the same N members maintain their own identifier list externally and paste it into Custom List each wave. | **V1 — separate scoping.** Feature shape: "Generate new tokens for the same audience on an expired batch" — opens the configure page pre-populated with the prior audience, deterministic via the internal `DistributionBatch.samplingSeed` (preserved in V0 schema specifically to enable this). At Re-run time, present "Same audience or fresh sample?" as a one-question prompt (Q-R1.Q2 / 2c). **File a new issue when V1 is scoped.** |
| **Revoke remaining tokens** — Round 2 Comment 12 | V0 has no Revoke primitive. Operators who want to cut off a wave use Edit Expiry to shorten the expiry to a near-future time (R26). | Not a V1 commitment. Edit Expiry covers the practical need; reconsider only if operator feedback surfaces a use case that shortening can't address. |
| **Respondent-side edit of prior response on MULTIPLE / LATEST_OVERWRITES surveys** — Round 3 R3-7 | V0 tokens are single-use; consumption is monotonic. Once a respondent submits, that token is `Responded` and re-visit shows the "already submitted" state — even on a MULTIPLE-policy or LATEST_OVERWRITES survey where a new wave would issue a fresh token. | **V1.x extension**: when a respondent re-clicks a token URL on a MULTIPLE or LATEST_OVERWRITES survey, fetch the prior response from `SurveyResponse` and present an editable form pre-filled with their answers. The submit then updates-in-place (LATEST_OVERWRITES) or appends-as-new (MULTIPLE — though this needs careful per-wave semantics). Out of V0 scope; the token-consumption model in V0 makes the simple case (re-click → "already submitted") fast and correct; the editable-prior-response variant is a UX expansion that needs its own spec round. |
| **`fraim/config.json.competitors` not committed** | **N/A — applied in this PR.** Round-3 R3-30 supersedes the prior Round-1 Decision 1a (which deferred the config update). The 8-vendor block lands in this same PR per the user's "Check and add" directive. | n/a |
- **Anonymous / unauthenticated public-link distribution.** The existing anonymous `/survey/<surveyId>` share-link path is unaffected by this spec; tokens are additive.
