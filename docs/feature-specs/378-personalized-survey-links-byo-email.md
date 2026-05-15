# Feature: Personalized Survey Links for BYO-Email Distribution

Issue: [#378](https://github.com/mathursrus/CustomerEQ/issues/378)
Owner: manohar.madhira@outlook.com
Status: **Draft (round 1) — for review.**
Last touched: 2026-05-15

---

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
5. **Reusable audience-spec primitive** — the predicate the operator builds for "Tier=Gold, status=ACTIVE, healthScore<70, no response in last 90 days" is the same predicate shape the rest of the platform already uses (`SearchMembersQuerySchema`). Operators don't learn two filter languages.

## Customer Problem being solved

The issue body enumerates four interlocking problems. Each is restated here in the language of the persona so the spec can be tested against the customer's mental model:

1. **No supported BYO-email flow.** Today brands wanting to NPS via Mailchimp have three bad options: (a) blast a single generic survey URL — loses per-recipient attribution; (b) wire up their own backend to call our APIs and per-recipient mail-merge tags — most mid-market CX operators are not engineers; (c) hand-roll URL params like `?email=jane@brand.com` — which the platform now treats as deprecated (#241 R16/D51) and which leaks PII to access logs anyway.
2. **`?member_id=` in the URL is a security and privacy liability.** For brands whose `memberIdentifierKind = 'email'`, the URL parameter *is* the customer's email. It lands in: nginx/CDN access logs (retained ~30 days by Azure default); the respondent's browser history; the `Referer` header sent to every third-party asset on the brand's thank-you page (ad pixels, web fonts, analytics scripts); ESP click-tracker query strings (often retained indefinitely for engagement analytics). This is plainly a GDPR Article 5(1)(c) data-minimization failure and a CCPA §1798.100 disclosure-via-third-parties exposure — even before anyone exploits it. Exploitation is trivial: anyone who guesses a coworker's email (or an obvious public-figure email) can POST to `/v1/public/surveys/:id/respond` and corrupt that brand's NPS, sentiment, and any closed-loop alert rule that depends on the response.
3. **No audience selector or sampling primitive.** "Send to a 10% random sample of my Gold members" / "send to 500 random members with healthScore < 70" / "send to this list of 83 emails I just copy-pasted, auto-enrolling the 4 unknown ones" — none of these exist as a first-class operation today. The closest thing is the member-list page with its filters; from there, the operator's options are export to CSV and reach for spreadsheet formulas. Sampling and explicit-list-with-auto-enroll are pure greenfield.
4. **No "one response per wave."** `Survey.responsePolicy` (`ONCE | MULTIPLE | LATEST_OVERWRITES`) governs the lifetime of a survey, not a period inside it. The operator running quarterly NPS to the same 100 members wants the survey to be `MULTIPLE` (so Q2 doesn't reject members who answered in Q1) **and** wants exactly one response per member per quarter (so Q2 isn't gamed by a member opening the link twice). There is no value of `responsePolicy` that delivers both.

The cumulative effect: the operator who wants "let me send NPS to my Gold members from Mailchimp each quarter and see the trend" finds the platform supports none of the four pieces — and accidentally trips a GDPR exposure in the process.

## User Experience that will solve the problem

The mock at [`mocks/378-distribute-flow.html`](mocks/378-distribute-flow.html) is the working artifact (interactive — walk the steps in-browser). Sections below describe the experience at the level of "specific steps the user takes"; the mock is the source of truth for visual layout, copy, and affordances.

### §1. Entry point

- **Path**: `/admin/surveys/[id]/distribute` — a new sub-route of the existing survey detail page (`/admin/surveys/[id]`) per the Standard CRUD admin pattern in `docs/architecture/architecture.md` §3.1.
- **How the operator gets there**: from the existing Distribution section on the survey detail page (#241 R26 / R27), a new **`Send via my email tool →`** primary action sits alongside the existing `Share link` and `Embed snippet` tiles. Clicking it routes to `/admin/surveys/[id]/distribute`. The Distribution section's existing copy explains: "Share link is for posting publicly. Embed is for your own site. Send via my email tool generates per-recipient links you can mail-merge from Mailchimp, HubSpot, Klaviyo, Gmail."
- **DRAFT vs. ACTIVE**: the entry point is **disabled when `Survey.status === 'DRAFT'`** with a tooltip "Activate the survey before distributing". The new sub-route returns the same DRAFT-aware notice the rest of the detail page uses (#241 R33). Once the survey is ACTIVE, the entry point is live. PAUSED and STOPPED disable the entry point with the appropriate copy ("Resume the survey to distribute" / "This survey is stopped — Restart to distribute").

### §2. The Distribute flow — four steps

The flow is a four-step wizard on a single page (sticky step-rail on the left, step body on the right), not four separate routes. Step navigation is via the step-rail or the bottom **Back / Continue** buttons. The wizard auto-saves the draft batch on every step transition — closing the browser mid-flow leaves an in-progress batch the operator can resume from a "Resume distribution" entry on the survey detail page.

Step order: **Audience → Preview → Confirm → Download**.

#### §2.1 Step 1 — Audience

The operator chooses **mode** and (for the first two modes) **filter predicate**. Three modes, mutually exclusive within one batch but composable in obvious combinations within the predicate:

- **Mode A — Percent**: "Send to X% of members matching this filter." Slider (1–100) + numeric input. Predicate panel below.
- **Mode B — Count**: "Send to exactly N members matching this filter." Numeric input + predicate panel below.
- **Mode C — Explicit list**: "Send to these specific identifiers." Two sub-modes: (i) **paste** — multi-line textarea accepting one identifier per line (emails, phone numbers, external IDs, or memberIds — kind inferred per-line from format); (ii) **upload CSV** — single-column CSV; first row treated as data unless header is named exactly `email` / `phone` / `external_id` / `member_id`. **Auto-enroll toggle**: "If I list an identifier that isn't a member yet, enroll them automatically" — checked by default; when checked, unknown identifiers route through `resolveOrEnrollMember()` with `enrolledVia = 'BULK_DISTRIBUTION'` (new enum value). When unchecked, unknown identifiers are surfaced in the Preview step as `unmatched` and excluded from the batch.

**Filter predicate** (visible in Modes A and B, hidden in C):
A horizontal chip-row mirroring the predicate the member-list page already uses. Reuses `SearchMembersQuerySchema` (`packages/shared/src/zod/member.schema.ts:90`). Operators can filter by: tier, status (ACTIVE / INACTIVE — ERASED is excluded by the audience builder as a project-rule R13 baked-in default; see Compliance §below), sentiment range, NPS range, points-balance range, health-score range, enrollment-date range, and a free-text search `q`. Each predicate filter chip shows a live count: "Tier: Gold (1,243)" updating as adjacent chips change. **Cooldown filter** — a chip "Hasn't responded in last X days" (X defaults to 30, configurable) — leverages the existing `SurveyDistribution(surveyId, memberId, sentAt)` index per #117.

**Sampling seed**: under Modes A and B, the wizard auto-generates a seed (visible, copyable) and lets the operator override it. Same seed + same predicate + same data → same sample; this is what makes "re-run the same quarterly wave with the same 100 members" deterministic. Step 3 (Confirm) surfaces the seed so the operator can record it for the next wave.

#### §2.2 Step 2 — Preview

A two-column layout: on the left, a **summary card** showing mode, filter chips, sample size (e.g. "100 members — 10% of 1,000 Gold members matching filter"); on the right, a **paginated preview table** of the first 50 selected members (name, identifier-of-record per `memberIdentifierKind`, tier, status, last-response date). At the bottom, an **`unmatched`** subsection (only visible under Mode C) listing identifiers the system could not resolve, with toggle behavior from §2.1 above (auto-enroll on → unmatched section shows zero entries because they all become new members; auto-enroll off → unmatched listed and the running count drops accordingly).

**Wave label** (required) — a single text input: "Name this wave (will appear in analytics)." Default placeholder: `<Survey name> · <Date>` (e.g., "Q2 NPS · 2026-05-15"). Stored on `DistributionBatch.label`.

**Expiry window** (required) — a select with presets (24h / 7 days / 30 days / 90 days / custom). Default: 7 days. Stored on `DistributionBatch.expiresAt`. The wizard surfaces a passive warning if expiry < 24h ("Most ESPs deliver within 1–6 hours; a tight expiry can cause missed responses").

#### §2.3 Step 3 — Confirm

A single panel showing everything that will be written, plus the cost / impact summary:
- Number of tokens to mint
- Auto-enrollments that will run (Mode C only)
- Survey name and current status (ACTIVE confirmed)
- Operator identity (auto-filled)
- Expiry window
- Sampling seed (Modes A and B)

A **`[Generate links]`** primary button at the bottom-right. Clicking it: (a) writes the `DistributionBatch` row, (b) resolves-or-enrolls the unknown identifiers per Mode C semantics, (c) mints one opaque token per `(batchId, memberId)`, (d) writes one `SurveyDistribution` row per token with `sentAt = now`, (e) returns the operator to Step 4.

**Atomicity**: the batch-creation operation is wrapped in a single `prisma.$transaction()` so a partial failure leaves the database with neither a batch nor any tokens — never half a wave.

#### §2.4 Step 4 — Download

A **success panel** confirming the batch was created. Three artifacts are downloadable from this step:

1. **CSV (full)** — columns: `memberId`, `identifier` (the value per `memberIdentifierKind`), `firstName`, `lastName`, `url`. One row per token. Filename: `<survey-slug>-<wave-label>-links.csv`.
2. **CSV (ESP-shaped)** — same data but column names matched to the operator's ESP from a small dropdown: Mailchimp / HubSpot / Klaviyo / Generic. For Mailchimp it emits `Email Address, FNAME, LNAME, SURVEY_URL`; for HubSpot `email, firstname, lastname, survey_url`; for Klaviyo `Email, First Name, Last Name, Survey URL`; for Generic the same as #1.
3. **ESP merge-tag snippet** — a copy-blob telling the operator what to paste into their template:
   - Mailchimp: `<a href="*|SURVEY_URL|*">Take our survey</a>`
   - HubSpot: `<a href="{{ contact.survey_url }}">Take our survey</a>`
   - Klaviyo: `<a href="{{ event.SurveyUrl|default:'' }}">Take our survey</a>`
   - Generic: the URL pattern itself, with the column-name placeholder syntax for the operator's tool.

A **`[Done — back to survey]`** button returns the operator to the survey detail page, where a new Distribution Batches sub-section now lists this wave (see §3).

### §3. Distribution Batches sub-section on the survey detail page

A new collapsible section on `/admin/surveys/[id]` titled **Distribution batches** (between Loop Monitor and Response per #241 R26 ordering; see Layout note below). Renders a table of all batches for this survey:

| Column | Source |
|---|---|
| Label | `DistributionBatch.label` |
| Sent at | `DistributionBatch.createdAt` |
| Audience | one-line summary, e.g. "10% of Gold (seed `a7b3`)" or "Explicit · 100 identifiers" |
| Tokens | minted count |
| Consumed | count of tokens where `consumedAt IS NOT NULL` |
| Response rate | `consumed / minted * 100%` |
| Expires | absolute date, plus relative ("in 3 days" / "expired 12 days ago") |
| Actions | `View details` · `Re-run with same audience` · `Revoke remaining` |

**Section default**: expanded when `Survey.responsesCount > 0` and at least one batch exists; collapsed when no batches; absent (section header hidden) when no batches AND `responsesCount === 0` — the section is meaningless before any distribution.

**Layout note**: section ordering on the detail page becomes:
1. Distribution (#241 R26)
2. **Distribution batches (NEW)**
3. Loop Monitor (#241 R32b)
4. Response (#241 R32)
5. Configuration summary (#241 R28)

The Distribution batches section sits between Distribution and Loop Monitor because the operator's natural flow on a live survey is: "see my share/embed surfaces → see my historical sends → see my pipeline → see my responses → see my config." Distribution batches are part of the operator's outbound activity, not the response analytics surface.

#### §3.1 Batch detail drill-down

Clicking a row's `View details` opens `/admin/surveys/[id]/distribute/batches/[batchId]`, a read-only page showing:
- All Step-3 confirm-panel content
- Tokenized URL distribution table (paginated) — columns: `memberId` (linked to Customer 360), `identifier`, `firstName`, `lastName`, `URL`, `Status` (Pending / Consumed / Expired / Revoked), `Consumed at`
- **Consumption-over-time sparkline** showing token consumption density across the window (open rate proxy)
- **Re-download** buttons: same three artifacts as Step 4 of the original flow, regenerated on demand (the underlying URLs are stable — re-download is safe and idempotent)
- **Revoke remaining** — primary action with confirmation modal; bulk-flips `consumedAt = revokedAt` on every Pending token, preventing further responses. Confirms with: "Revoke 73 unused links. The 27 members who already submitted will keep their responses. Continue?"

#### §3.2 Re-run with same audience

Clicking `Re-run with same audience` on a batch row opens the wizard pre-populated with the original audience spec (mode + predicate + seed for A/B; identifier list for C) and a new label suggestion (`<previous label> · <next quarter>`). The operator can edit anything before generating; the seed is preserved by default so deterministic re-sampling is the default for quarterly cadences. This is what makes "quarterly NPS to the same 100 members" feel like one operation, not four.

### §4. The respondent's experience

For a respondent clicking a tokenized URL, the experience matches the existing Standalone survey form (#241 R15 / R17) with three changes:

1. **URL shape**: `https://<host>/s/<surveyId>/r/<token>` instead of `https://<host>/survey/<surveyId>` or the existing `?email=` legacy. The plain `/s/<surveyId>` form remains supported (for share-link distribution) — the tokenized form is additive.
2. **Member-identification field is suppressed**: when the URL carries a valid token, the form does not ask the respondent who they are (the token resolves the member). The form shows only the questions, consent block, and submit button.
3. **Token-invalid states** (token expired, already consumed, revoked, malformed): the response form renders an error state with copy keyed to the failure mode:
   - `expired` → "This survey link has expired. If you still want to share feedback, contact `<brand support email>`."
   - `consumed` → "This survey has already been submitted. Thank you for your response!"
   - `revoked` → "This survey link is no longer active."
   - `malformed` → "This link is not valid. Please check it and try again."

   No PII (no member identifier, no batch label) is revealed in any of these states. The brand support email is sourced from `Brand.supportEmail` (existing column).

### §5. Existing surfaces that don't change

- **The anonymous `/s/<surveyId>` share-link path** (existing #241 surface) — unchanged. Tokens are additive; share links work as today.
- **The embedded widget path** (existing #241 R16 surface — data-attribute prefill / `CustomerEQ.surveys.prefill()` JS API) — unchanged. Embedded surveys consume member identity from the host page, not from a token URL.
- **The existing `POST /v1/public/surveys/:id/respond` endpoint** — receives an additional optional `token` field in the request body (when the respondent's form was loaded via a tokenized URL). When `token` is present, server-side validation supersedes any `memberId` / `email` field in the body — the token resolves the member authoritatively and a body-supplied identifier mismatch is rejected with HTTP 422.

## Data Model

### New: `DistributionBatch`

```prisma
model DistributionBatch {
  id             String           @id @default(cuid())
  surveyId       String
  survey         Survey           @relation(fields: [surveyId], references: [id])
  brandId        String           // tenant-scoped per project rule R6
  label          String           // operator-supplied wave name
  audienceSpec   Json             // mode + predicate + seed (Mode C: the resolved identifier list — not the raw paste)
  expiresAt      DateTime         // wave expiry — every token in this batch expires no later than this
  samplingSeed   String?          // null for Mode C, set for A and B
  createdBy      String           // clerk user id of the operator
  createdAt      DateTime         @default(now())
  revokedAt      DateTime?        // when set, all Pending tokens in the batch are treated as Revoked
  tokens         SurveyDistributionToken[]
  distributions  SurveyDistribution[]
  responses      SurveyResponse[]

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
  tokenHash   String              @unique // SHA-256 of the plaintext; plaintext is shown once at creation, never stored
  tokenPrefix String              // first 8 chars of plaintext, for operator-side display in batch-detail table
  expiresAt   DateTime            // copied from DistributionBatch.expiresAt; denormalized for index-only lookups
  consumedAt  DateTime?           // single-use marker; set when a response is accepted via this token
  revokedAt   DateTime?           // set when a single token or its batch is revoked

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

**Migration note** (the issue calls this out — it is a migration, not a design choice): existing rows have `batchId = NULL`, which the new unique constraint must permit. Postgres unique constraints over nullable columns allow multiple `NULL` rows by default — the existing `(surveyId, memberId)` pairs continue to be enforced via the **separate** index `(surveyId, memberId, sentAt)` for cooldown queries (this is a query index, not a uniqueness gate). For backfill: pre-#378 distribution rows do not belong to a batch and are not modified. New rows under #378 always carry `batchId`.

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

Add `BULK_DISTRIBUTION` to the enum (currently: `MANUAL_API | BULK_IMPORT | SURVEY_RESPONSE | EMBEDDED_FORM | CLERK_OAUTH`). Used by Mode C auto-enroll path in §2.1.

```prisma
enum MemberEnrolledVia {
  MANUAL_API
  BULK_IMPORT
  SURVEY_RESPONSE
  EMBEDDED_FORM
  CLERK_OAUTH
  BULK_DISTRIBUTION  // NEW — Mode C auto-enroll under #378
}
```

## API Surface

All endpoints under `/v1/surveys/:id/distribution-batches/*` are authenticated (Clerk JWT), brand-scoped via `request.brandId` (existing multiTenant plugin), and audit-logged (existing audit plugin). The respondent-facing path remains under `/v1/public/*`.

| Verb | Path | Purpose |
|---|---|---|
| `POST` | `/v1/surveys/:id/distribution-batches/preview` | Step 2 — given an audience spec, return projected count, sample table (first 50), and unmatched list. **Idempotent — no rows written.** |
| `POST` | `/v1/surveys/:id/distribution-batches` | Step 3 — create the batch, resolve-or-enroll Mode C identifiers, mint tokens, write distribution rows. Returns batch summary + plaintext tokens once (downloaded on the spot in Step 4). |
| `GET` | `/v1/surveys/:id/distribution-batches` | List all batches for the survey. |
| `GET` | `/v1/surveys/:id/distribution-batches/:batchId` | Batch detail — audience spec, token list (without plaintext — tokenPrefix only), consumption stats. |
| `GET` | `/v1/surveys/:id/distribution-batches/:batchId/export` | Re-download CSV / ESP-shaped CSV. Returns plaintext URLs because the URL **is** the token-bearing artifact the operator already received once. RBAC-gated (`survey.distribute` permission, scope: TBD in RFC). |
| `POST` | `/v1/surveys/:id/distribution-batches/:batchId/revoke` | Bulk-revoke all Pending tokens in a batch. Audit-logged. |
| `POST` | `/v1/public/surveys/:id/respond` | Existing endpoint. **Additive change:** accepts a new optional `token` field in body. When present, server validates token → resolves member → marks token consumed atomically with response write. When absent, behavior unchanged. |
| `GET` | `/v1/public/surveys/:id/token-status` | Pre-form-render check used by the standalone form when loaded at `/s/:surveyId/r/:token` — returns one of `valid` / `expired` / `consumed` / `revoked` / `invalid` so the form can render the right state without revealing whether the token was ever valid (response is the same shape regardless of the failure reason from a server-API consumer perspective; the respondent-facing copy differs per state per §4). |

**RBAC**: a new permission `survey.distribute` gates batch creation, revocation, and re-download. The existing survey-edit role acquires this permission by default. The RFC owns the permission-matrix detail; this spec records the requirement.

## Functional Requirements

Tags `R1`–`R30` are referenced from implementation tasks, tests, and the RFC's traceability matrix. Each requirement has a `Given / When / Then` acceptance criterion.

### Entry point and routing

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R1** | The survey detail page's Distribution section SHALL render a primary `Send via my email tool →` action alongside the existing Share link and Embed snippet tiles, routing to `/admin/surveys/:id/distribute`. | Given an ACTIVE survey, when the operator opens `/admin/surveys/:id`, then the Distribution section renders the action; clicking it navigates to `/admin/surveys/:id/distribute`. |
| **R2** | The `Send via my email tool →` action SHALL be disabled when `Survey.status !== 'ACTIVE'`, with a tooltip keyed to the state. | Given `status='DRAFT'`, when the section renders, then the action is disabled and the tooltip reads "Activate the survey before distributing". Given `'PAUSED'`, the tooltip reads "Resume the survey to distribute". Given `'STOPPED'`, "This survey is stopped — Restart to distribute". |
| **R3** | The Distribute flow SHALL be a single-page four-step wizard (Audience → Preview → Confirm → Download), navigable via step-rail or bottom Back / Continue buttons; closing the browser mid-flow SHALL leave a resumable in-progress batch (`DistributionBatch.status = 'DRAFT'`). | Given the operator reaches Step 2 and closes the browser, when they return to `/admin/surveys/:id`, then a "Resume distribution" entry surfaces in the Distribution batches section linking back to the wizard pre-populated to Step 2. |

### Audience step

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R4** | The Audience step SHALL offer three mutually-exclusive modes: Percent (1–100% of filter), Count (exact N of filter), Explicit list (paste or CSV upload). | Given the operator switches mode, when they click a mode card, then the previous mode's inputs hide and the chosen mode's inputs render in their place; the predicate panel shows in Modes A and B, hides in Mode C. |
| **R5** | The predicate panel SHALL reuse `SearchMembersQuerySchema` for filter fields (`tier`, `status`, `sentimentMin/Max`, `npsMin/Max`, `balanceMin/Max`, `healthScoreMin/Max`, `enrolledAfter/Before`, `q`) plus a new `noResponseInLastDays` chip. ERASED members SHALL be excluded from the predicate's status option (project rule R13). | Given the operator opens the predicate panel, when the status dropdown renders, then options are `ACTIVE` and `INACTIVE` only; `ERASED` is not selectable. Given they apply tier=Gold + healthScore<70 + noResponseInLastDays=30, when the preview projects, then the projected count matches the query the server actually runs (same predicate shape as `/v1/members?...`). |
| **R6** | Mode C SHALL accept identifiers via paste (multi-line textarea, one per line) or CSV upload (single-column; header row optional). Identifier kind SHALL be inferred per-line (email format → email; digits → phone; otherwise → external_id or memberId). | Given the operator pastes `jane@brand.com\n+15551234\nusr_abc`, when they click Continue, then the preview shows three resolved identifiers tagged with their inferred kinds. |
| **R7** | Mode C SHALL provide an **auto-enroll** toggle (default ON). When ON, unknown identifiers route through `resolveOrEnrollMember(BULK_DISTRIBUTION)` at batch-create time. When OFF, unknown identifiers are listed under `unmatched` in Preview and excluded from the batch. | Given auto-enroll is ON and the paste includes 3 unknown emails, when Step 3 confirms, then `SELECT count(*) FROM Member WHERE enrolledVia='BULK_DISTRIBUTION'` advances by 3 and 3 new tokens are minted. Given auto-enroll is OFF, the same paste results in 0 new Member rows and 0 tokens for those 3 identifiers; Preview shows them under `unmatched`. |
| **R8** | The audience builder SHALL generate a default sampling seed visible and copyable on Step 1; the operator MAY override it. The seed SHALL be stored on `DistributionBatch.samplingSeed`. The same `(seed, predicate, member-set state)` SHALL produce identical samples across batches. | Given an operator creates Batch1 with seed `a7b3c1` and predicate tier=Gold; when they later use `Re-run with same audience` and Batch2 is created with the same seed, then the resolved member-set is identical except for members enrolled or status-changed between the two runs (which is observable in the batch detail — surfaced as a diff annotation). |
| **R9** | The Preview step SHALL show, for the projected audience, mode and predicate summary, paginated sample table (first 50 rows), and an `unmatched` subsection (Mode C only). | Given a Percent mode with 10% of 1,000 Gold members, when the operator clicks Continue from Step 1, then Step 2 renders "100 of 1,000 Gold members" plus a 50-row preview table with name, identifier, tier, status, last response. |
| **R10** | The Preview step SHALL require **Wave label** (≤80 chars, default `<survey-name> · <ISO date>`) and **Expiry window** (24h / 7d / 30d / 90d / custom) before Continue is enabled. | Given the operator clears the label, when they click Continue, then the button is disabled and the label field shows an inline error "Required". |

### Confirm and generate

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R11** | The Confirm step SHALL summarize everything that will be written (token count, auto-enroll count for Mode C, label, expiry, operator identity, seed) before the operator can click `Generate links`. | Given the operator reaches Step 3, when the panel renders, then every field above is visible; the Generate button is enabled. |
| **R12** | The batch-creation operation SHALL be transactional. A failure at any step (member resolution, token minting, distribution-row write) SHALL leave the database in its pre-batch state (no DistributionBatch row, no tokens, no SurveyDistribution rows). | Given Mode C with one identifier that triggers a unique-constraint violation deep in resolveOrEnrollMember, when the transaction rolls back, then `SELECT count(*) FROM "DistributionBatch" WHERE id=:b` returns 0 and `SELECT count(*) FROM "SurveyDistributionToken" WHERE batchId=:b` returns 0. |
| **R13** | Token plaintext SHALL be shown to the operator exactly once — in Step 4 download artifacts. The server SHALL NEVER store plaintext; only `tokenHash` (SHA-256 of plaintext) and `tokenPrefix` (first 8 plaintext chars, display-only). | Given a batch is created and the operator dismisses the Download step, when they later open the batch detail page, then the token list shows tokenPrefix values only; no API path returns plaintext. |
| **R14** | Tokens SHALL be cryptographically strong: ≥192 bits of entropy, generated via `crypto.randomBytes(24)` and base64url-encoded, with no order-dependence on memberId or timestamp. | Verified via code review; sample tokens pass a chi-squared randomness check (RFC's implementation contract). |
| **R15** | The Download step SHALL provide three downloadable artifacts: (a) **CSV (full)** with columns `memberId, identifier, firstName, lastName, url`; (b) **CSV (ESP-shaped)** with one of Mailchimp / HubSpot / Klaviyo / Generic column conventions per operator selection; (c) **ESP merge-tag snippet** as a copy-blob. | Given the operator selects Mailchimp from the ESP dropdown, when they click `Download CSV`, then the CSV header reads `Email Address,FNAME,LNAME,SURVEY_URL`. |

### Token-authorized response

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R16** | URL shape SHALL be `/s/:surveyId/r/:token`. The standalone form SHALL call `GET /v1/public/surveys/:id/token-status?token=...` on mount and render: (a) the form (token=valid); (b) one of four error states (expired / consumed / revoked / malformed) — no PII in any state. | Given a valid token URL, when the form loads, then the questions render and no member-ID input field is shown (because the token resolves the member). Given an expired token URL, then "This survey link has expired. Contact `<brand support email>` to share feedback." renders; no member identifier appears on the page or in the network traffic. |
| **R17** | When a response is submitted via a tokenized URL, the API SHALL: (a) resolve the member via the token, ignoring any `memberId` / `email` field in body for identification purposes; (b) atomically write the `SurveyResponse` row with `distributionBatchId` and `distributionTokenId` populated, and mark `SurveyDistributionToken.consumedAt = now`; (c) reject second submissions with the same token via HTTP 409. The body-supplied `memberId` / `email` MAY be supplied for audit but a mismatch with the token-resolved member SHALL return HTTP 422. | Given a valid token and a response POST, when the API processes it, then `SurveyResponse.distributionBatchId` is set and `SurveyDistributionToken.consumedAt` is set within the same transaction. Given a second POST with the same token, then HTTP 409 returns and no second `SurveyResponse` row is written. Given a body identifier that does not match the token's member, then HTTP 422 returns and no row is written. |
| **R18** | An expired token SHALL be rejected at response-submit even if the form was loaded before expiry. | Given a token expires at 12:00 and the form was loaded at 11:59, when the operator submits at 12:01, then HTTP 410 returns and the form re-renders with the expired-state copy. |
| **R19** | A revoked token (single or via batch-revoke) SHALL be rejected at response-submit identically to consumed. | Given the operator revokes the batch, when a respondent submits with one of the revoked tokens, then HTTP 410 returns; the response is not written. |

### Recurring waves and one-per-wave

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R20** | A survey with `responsePolicy = 'MULTIPLE'` SHALL accept multiple lifetime responses from the same member across batches; each batch SHALL accept exactly one response per member (enforced by the token's single-use). | Given a survey with `responsePolicy='MULTIPLE'` and the same member is included in Batch Q1 and Batch Q2, when the member submits responses in both, then two `SurveyResponse` rows exist, one with `distributionBatchId = Q1` and one with `Q2`; both tokens are `consumed`. |
| **R21** | A survey with `responsePolicy = 'ONCE'` SHALL still allow tokenized distribution, but the second submit by the same member (regardless of batch) SHALL return HTTP 409 per existing #241 R8 semantics. | Given a survey with `responsePolicy='ONCE'` and the same member receives Batch Q1 and Batch Q2 tokens, when they submit in Q1 (accepted) and then submit in Q2, then Q2's submit returns HTTP 409 and the Q2 token is **not** marked consumed (the response-policy rejection happens before token consumption). The Q2 token expires naturally and is recorded as `expired` in batch analytics. |
| **R22** | The `Re-run with same audience` action SHALL pre-populate the wizard with the source batch's audience spec — mode, predicate, seed for Modes A/B; identifier list for Mode C — and a new label suggestion of the form `<source label> · <next-period suffix>`. | Given the operator clicks `Re-run with same audience` on a batch labeled `Q1 NPS · 2026-02-15`, when the wizard opens, then mode/predicate/seed are pre-filled and the label field reads `Q1 NPS · 2026-02-15 · 2026-05-15` (date is `today`). |

### Batch management

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R23** | The Distribution batches section on the survey detail page SHALL list all batches with: label, sentAt, audience summary, minted count, consumed count, response rate, expires, and per-row actions (View / Re-run / Revoke). | Given a survey with three batches, when the section renders, then three rows appear in `createdAt DESC` order. |
| **R24** | The Distribution batches section SHALL be expanded by default when at least one batch exists; hidden entirely when no batches AND no responses; collapsed when batches exist but `responsesCount === 0`. | Given a survey with zero batches and zero responses, when the detail page loads, then the section header does not render. Given one batch is created (zero responses), then the section header renders collapsed. Given responses exist, then the section is expanded by default. |
| **R25** | The Batch detail page SHALL display per-token status (Pending / Consumed / Expired / Revoked), consumption sparkline, and re-download buttons returning the same artifacts as the original Download step. | Given the operator opens a batch detail page, when the page renders, then a paginated table shows tokenPrefix + status + consumedAt for each token. |
| **R26** | `Revoke remaining` SHALL bulk-flip `revokedAt = now()` on every `consumedAt IS NULL` token in the batch (via a single UPDATE); it SHALL NOT affect tokens that are already consumed (those responses remain valid and counted). The action SHALL be audit-logged. | Given a batch with 100 tokens of which 27 are consumed, when the operator confirms `Revoke remaining`, then `SELECT count(*) WHERE batchId=:b AND revokedAt IS NOT NULL AND consumedAt IS NULL` returns 73; the 27 consumed tokens are untouched; one audit log row is written with `action='distribution_batch.revoke'`. |

### Audit and observability

| ID | Requirement | Acceptance Criterion |
|----|-------------|-----------------------|
| **R27** | Batch creation, batch revocation, and per-token consumption SHALL each write an audit-log entry via the existing audit plugin (`apps/api/src/plugins/audit.ts`), with `{ actorUserId, brandId, surveyId, batchId, action, metadata }`. | Given an operator creates a batch of 100 tokens, when the transaction commits, then one audit row exists with `action='distribution_batch.create'` and `metadata.tokenCount=100`. Given a respondent submits a tokenized response, then one audit row exists with `action='distribution_batch.token_consumed'` and `metadata.memberId` set. |
| **R28** | The per-token consumption audit row SHALL include `requestIp` (Fastify `request.ip`, respecting trust-proxy chain). If proxy chain is misconfigured and IP is unavailable, the audit row is still written with `requestIp = null` and a structured-log warning is emitted (consistent with #241 NFR-S5). | Verified via integration test. |
| **R29** | The batch creation API response SHALL include the token plaintext array exactly once (Step 4 download). The API SHALL never return plaintext in subsequent GET calls. Re-download endpoints SHALL return plaintext via the URL column (because the URL contains the token), gated by `survey.distribute` permission. | Given a batch is created, when the POST response is examined, then the response body contains a `tokens[].plaintext` field. Given any subsequent GET to the batch detail endpoint, then no plaintext field appears in the response; only `tokenPrefix`, `tokenHash IS NOT NULL` indicator, and status. |
| **R30** | A new "Distribution batches" tile SHALL appear on the operator's Loop Monitor view (#241 R32b) reflecting batches sent in the last 30 days, total tokens minted, total responses received, and a click-through to the survey's Distribution batches section. | Given a brand has sent two batches in the last 30 days for survey X, when the operator opens `/admin/surveys/:id/`, then Loop Monitor shows `2 batches · 250 sent · 87 responses`. |

## Non-Functional Requirements

### Performance

| ID | Requirement | Target |
|----|-------------|--------|
| **NFR-P1** | Batch creation API for a 1,000-token batch | p95 < 5s end-to-end (including member resolution, token minting, distribution rows) |
| **NFR-P2** | Batch creation API for a 10,000-token batch | p95 < 30s; minted in chunks of 1,000 within the same transaction |
| **NFR-P3** | Audience preview API for predicates over 100,000 members | p95 < 2s — uses the same indexed query plan as `/v1/members?...` |
| **NFR-P4** | Token-status check + response submit on tokenized URL | p95 < 300ms end-to-end (well within the existing public-survey submit p95 of #241 NFR-P2) |
| **NFR-P5** | CSV download for a 10,000-row batch | p95 < 5s; streamed response, not buffered |

### Security

| ID | Requirement | Control |
|----|-------------|---------|
| **NFR-S1** | DistributionBatch, SurveyDistributionToken, SurveyDistribution writes SHALL be brand-scoped per project rule R6 | `brandId` sourced from JWT, never request body. The Prisma tenant-scope middleware (`packages/database/src/middleware/tenantScope.ts`) covers the new models. |
| **NFR-S2** | Tokens SHALL be stored hashed at rest (SHA-256), plaintext shown once at creation | Parallels existing `ApiKey.keyHash` pattern (`apps/api/src/plugins/auth.ts:69`) |
| **NFR-S3** | Tokens SHALL be single-use; `consumedAt` write atomic with `SurveyResponse` write | Single `prisma.$transaction()` per response submit |
| **NFR-S4** | Token URLs SHALL contain no PII | Token is 32-byte base64url string; no member id, email, brand id, or batch label in URL |
| **NFR-S5** | Token-validation timing SHALL be constant-time (resistant to timing-attack token-guessing) | `crypto.timingSafeEqual()` for hash comparison; uniform error responses for `invalid` / `expired` / `consumed` / `revoked` states at the server-API level (respondent-facing copy differs but the server's error-response structure is uniform) |
| **NFR-S6** | Revoked batches SHALL reject new responses within the same request that completes the revoke (no race window) | Token-status check and consumption write share the same transactional read-snapshot |
| **NFR-S7** | Per-token consumption audit (R27 / R28) SHALL include source IP and user-agent | Same Fastify `request.ip` / `request.headers['user-agent']` capture as existing audit plugin |
| **NFR-S8** | Token plaintext SHALL only be transmitted over TLS | Enforced by the existing Azure Container Apps / Vercel HTTPS-only ingress; no plaintext fallback path |

### Reliability

| ID | Requirement | Control |
|----|-------------|---------|
| **NFR-R1** | Batch creation SHALL be atomic — partial batches MUST NOT exist | `prisma.$transaction()` per batch; failure rolls back all writes (audit row is written outside the transaction only on success) |
| **NFR-R2** | Response submission via token SHALL be idempotent | Existing #241 NFR-R2 + token single-use: a second submit with the same token returns HTTP 409 from the unique constraint on `(batchId, memberId)` and the `consumedAt IS NULL` check |
| **NFR-R3** | Batch creation under Mode C with auto-enroll SHALL handle a partial member-resolution failure gracefully — if 1 of 100 identifiers fails to resolve (malformed, hits a per-brand rate limit, etc.), the batch creation SHALL fail with a structured error listing the failing identifier(s) and no DistributionBatch row is written | Tested with a deliberate malformed identifier in a 100-row paste |
| **NFR-R4** | The Mode C resolution path SHALL re-use the existing `resolveOrEnrollMember` consent-stamping behavior — `consentGivenAt` auto-stamped to `now()` for newly-enrolled BULK_DISTRIBUTION members; existing members' consent timestamps untouched | Verified against `apps/api/src/services/memberResolution.ts:158` and `:205-212` |

### Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| **NFR-SC1** | A brand SHALL be able to create up to 10 batches per minute per survey | Throttled at the API layer (existing rate-limit plugin extended) |
| **NFR-SC2** | A single batch SHALL support up to 100,000 tokens | Token minting chunked at 1,000 per insert; bounded transaction time |
| **NFR-SC3** | Cumulative across batches, a brand SHALL be able to retain unlimited historical batches; batches expire from `Active` to `Expired` automatically but rows are retained for trending | No data retention purge in V0; Issue #200 / future data-retention initiative owns lifecycle |

### Accessibility (WCAG 2.1 AA)

| ID | Requirement | Control |
|----|-------------|---------|
| **NFR-A1** | The Distribute wizard SHALL be fully keyboard-navigable | Tab order: step-rail → step body fields → Back/Continue. Arrow keys to switch tabs in the step-rail. |
| **NFR-A2** | The Audience step's mode selector cards SHALL be radio-button semantic with `aria-checked` | `<div role="radiogroup">` over three `role="radio"` cards |
| **NFR-A3** | Color SHALL NOT be the only indicator of batch status | Status pill includes text label (`Pending` / `Consumed` / `Expired` / `Revoked`) alongside color |
| **NFR-A4** | Error states on the respondent-facing tokenized URL SHALL meet contrast and label requirements | Same standalone form chrome as #241 R15 / NFR-A4; error-state copy uses the same theme tokens as the form body |

### Observability

| ID | Requirement | Mechanism |
|----|-------------|-----------|
| **NFR-O1** | Batch creation, revocation, and token consumption SHALL emit structured logs with `surveyId`, `batchId`, `tokenId`, `actorUserId`, `requestIp` | Pino structured logger (existing pattern) |
| **NFR-O2** | Cumulative batch-level metrics (minted, consumed, expired, revoked) SHALL be queryable for the Loop Monitor tile (R30) | Materialized via simple SELECT — no separate counter table needed in V0 |
| **NFR-O3** | The audit log SHALL be the substrate for any future "distribution activity" view | Out of scope for #378; data substrate in place |

## Compliance Requirements

CustomerEQ's `fraim/config.json` declares **GDPR (in-scope)**, **CCPA (in-scope)**, **SOC2 (target month-12)**, **PCI-DSS (minimal-scope)**. Distribution batches and tokens process PII (member identifiers, in some flows email-as-identifier-of-record). The following controls apply.

### GDPR

| GDPR clause | Control / mapping |
|---|---|
| **Art. 5(1)(c) — Data minimization** | Token URLs SHALL contain no PII (NFR-S4). The URL pattern `/s/:surveyId/r/:token` ensures access logs, browser history, `Referer` headers, and ESP click-trackers see only opaque token strings. Pre-#378 URL patterns (`?email=`) are deprecated and removed (per #241 D51 — #378 inherits this). |
| **Art. 17 — Right to erasure** | The existing erasure job in `apps/worker` SHALL be extended to (a) null-out `firstName`, `lastName`, identifier fields on PII columns of the Member record (existing behavior), (b) leave `SurveyResponse.distributionBatchId` and `SurveyResponse.distributionTokenId` intact (those are not PII — they are batch lineage), (c) leave `DistributionBatch.audienceSpec` JSON intact except for Mode C resolved identifier lists, which SHALL be replaced with `[redacted]` markers. Token plaintext is not in the DB; only hashes — these are already non-reversible. |
| **Art. 25 — Privacy by design** | Tokens are opaque by construction (`crypto.randomBytes(24)`). The audience-builder excludes ERASED members from selectable status options (R5). Auto-enroll in Mode C stamps `consentGivenAt = now()` for newly-resolved members (NFR-R4), consistent with the `BULK_IMPORT` precedent in project rule R23. |
| **Art. 30 — Records of processing** | Audit log captures every batch creation, revocation, and token consumption (R27, R28) with actor, IP, and timestamp. |
| **Art. 32 — Security of processing** | Tokens stored hashed at rest (NFR-S2); single-use (NFR-S3); expirable (R18); revocable (R19); constant-time validation (NFR-S5); TLS-only transport (NFR-S8). |

### CCPA

| CCPA clause | Control / mapping |
|---|---|
| **§1798.100 — Right to know / disclosure** | Per-batch audit log discloses every recipient member at batch-creation time; per-token consumption audit discloses response provenance. A CCPA disclosure request can be answered from the audit log + `DistributionBatch.audienceSpec` + `SurveyResponse.distributionBatchId` join. |
| **§1798.105 — Right to deletion** | Same erasure-job extension as GDPR Art. 17 above. |
| **§1798.110 — Third-party disclosure** | Distribution to a brand's ESP (Mailchimp, HubSpot, Klaviyo) is conducted by the brand itself — CustomerEQ provides the CSV; the brand uploads it. CustomerEQ is not a "service provider" with respect to the ESP for this flow. The brand admin is the data controller for the recipient relationship. The spec documents this for clarity but does not encode a contract; the RFC owns any specific notice surfaced to the brand admin at download time ("By downloading, you confirm you have a lawful basis to email these recipients" — TBD). |

### SOC2 (target month-12)

| SOC2 TSP | Control / mapping |
|---|---|
| **CC6.1 — Logical access** | Survey distribution requires authenticated session + `survey.distribute` permission (R29 RBAC). The respondent-facing token flow is unauthenticated by design (the token authorizes the action). |
| **CC7.2 — System monitoring** | Audit log + structured logs (NFR-O1) feed the existing observability pipeline. Token consumption is monitored at the per-token granularity. |
| **CC8.1 — Change management** | Database migrations are forward-only per architecture §3.4; the schema changes here ship as a single migration with the four model additions/modifications in one ordered diff. |

### Project rules cross-reference (per project_rules.md)

| Rule | Touchpoint |
|---|---|
| R2 (Issue #6 hero — <15-min CX-to-loyalty SLA) | A tokenized survey response feeds the same `cx.<surveytype>_response` event path as standalone / embedded responses (#241 §4) — no detour through a separate pipeline. The token-validation overhead is bounded (NFR-P4 budgets 300ms p95 for token-status + submit) so the response remains well inside the SLA. |
| R5 (Event-driven first — no direct loyalty writes from API) | Unchanged. The response handler emits the cx event; the worker writes `LoyaltyEvent` atomically with `pointsBalance` (existing #241 R22 / NFR-R1). |
| R6 (Multi-tenant `brandId` everywhere) | All three new models (`DistributionBatch`, `SurveyDistributionToken`, `SurveyDistribution.batchId`) carry `brandId` and are added to `TENANT_SCOPED_MODELS` (NFR-S1). |
| R10 / R21 (One issue per branch) | This spec ships in the `feature/378-personalized-survey-links` branch; no off-scope work bundled (the Mode C `BULK_DISTRIBUTION` enum addition is in-scope per R7). |
| R13 (GDPR baked in) | Erasure-job extension above; ERASED member exclusion at audience-build time. |
| R22 (Prisma migration hygiene) | The migration is hand-edited (per architecture §3.4): the `SurveyDistribution` unique-constraint move requires `DROP CONSTRAINT` + `ADD CONSTRAINT` after the column add — Prisma's auto-generation does not emit a clean shape for unique-constraint relocation. Timestamp coordination per R22c. |
| R24 (FRAIM is mandated) | This spec is the deliverable of the FRAIM `feature-specification` job; RFC will be the deliverable of `technical-design`. |
| R25c (Spec "remove" / "deferred" instructions need project-rule cross-reference) | This spec adds, not removes. The one removal — the legacy `?email=` URL surface — was already removed by #241 D51 (cross-referenced); not re-litigated here. |
| R26 (One PR per phase artifact) | This spec ships in one PR; the RFC ships separately; impl phases ship separately. |

## User Experience — Design Standards Applied

The mocks at `docs/feature-specs/mocks/378-distribute-flow.html` follow CustomerEQ's existing admin-pattern conventions per `docs/architecture/architecture.md`:

- **Standard CRUD admin pattern** (architecture §3.1) — `/admin/surveys/:id/distribute` is a sub-route of the survey detail page; the wizard pattern matches the trigger-survey wizard (#79) and the historical-import flow (#262).
- **shadcn/ui + Tailwind v4** primitives — buttons, cards, inputs, dialogs match the existing admin chrome.
- **Auto-save indicator** in the wizard header matches the survey editor (#241 R4).
- **State-aware buttons** match the survey detail page's More-menu pattern (#241 R26).
- **Collapsible sections with `▼` chevron** match the survey detail page (#241 R26).
- **Tokenized URL error-state copy** uses the same theme tokens as the standalone survey form (#241 R15 / NFR-A4).

The mock files demonstrate these conventions in interactive HTML — no Markdown mocks per the FRAIM job principle "No Markdown Mocks".

## Validation Plan

### Functional validation

- **Audience preview accuracy** — pick a brand with known member data; build a predicate; compare the preview's projected count against a direct SQL query with the same predicate; counts must match.
- **Mode A determinism** — create a batch with a fixed seed and predicate; re-run with the same seed and predicate; the resolved member sets must match modulo new-since-last-run members.
- **Mode C auto-enroll** — paste a list of 10 identifiers, 7 known and 3 unknown; verify 3 new Members are created with `enrolledVia='BULK_DISTRIBUTION'` and `consentGivenAt` stamped to `now()`.
- **Token lifecycle** — create a batch, verify token is `Pending`; consume via response submit, verify `Consumed`; attempt second consume, verify HTTP 409; let a different token expire, verify `Expired`; revoke remaining, verify `Revoked`.
- **Quarterly NPS scenario (end-to-end)** — create a `responsePolicy='MULTIPLE'` survey, create Batch Q1 to 10 members, have all 10 respond, create Batch Q2 to the same 10 members (via `Re-run with same audience`), have all 10 respond. Verify: 20 `SurveyResponse` rows exist; 10 link to Q1, 10 link to Q2; each member's `LoyaltyEvent` count advanced by 2.

### Security validation

- **No PII in URL** — capture a tokenized URL, decode the token, attempt to recover any member identifier from the token bytes; must fail.
- **Token unguessability** — generate 1M tokens; verify ≥192-bit entropy via chi-squared randomness check.
- **Constant-time validation** — measure token-validation timing for `valid` / `invalid` / `expired` / `consumed` / `revoked` cases; standard deviation must be < 1ms (constant within measurement noise).
- **Cross-brand access** — Operator from Brand A attempts to read a batch ID belonging to Brand B via direct API call; must return HTTP 404 (not 403 — the existence is not disclosed). 
- **Revoke race window** — start a revoke transaction; in parallel, submit a response via one of the revoking tokens; verify the response is rejected with HTTP 410 and the audit log shows the revoke completed first.

### Compliance validation

- **GDPR Art. 17 erasure** — enroll a member via Mode C auto-enroll, create their response via the token, run the existing erasure job for that member, verify: `Member.firstName / lastName / email` are nulled; `SurveyResponse` row retained but `memberId` already-nulled; `SurveyDistributionToken` retained (token plaintext not in DB anyway, hash retained for audit lineage); `DistributionBatch.audienceSpec` Mode-C identifier list has the affected identifier replaced with `[redacted]`.
- **CCPA §1798.100 disclosure** — issue a hypothetical CCPA disclosure request for a member; verify the audit log + batch records yield: list of batches the member was included in, list of responses they submitted via tokens, full lineage Q1 → Q2 → Q3.
- **Audit log completeness** — for a single end-to-end flow (create batch, generate links, consume one token, revoke remaining), verify the audit log contains exactly the expected rows with the expected metadata.

### Browser validation

- Walk the four-step wizard from `/admin/surveys/:id/distribute` for each mode (Percent / Count / Explicit list); verify Back/Continue navigation does not POST a duplicate batch.
- Verify a tokenized URL loaded in three browsers (Chrome, Firefox, Safari) renders the form correctly and submits the response with the token.
- Verify the four token-error states each render distinct copy and visual treatment.
- Verify the Distribution batches section reflows correctly when 0, 1, and 10+ batches exist.

## Alternatives

| Alternative | Why discard? |
|---|---|
| **Continue using `?member_id=` URL params, mandate brands rotate ESP click-tracker settings** | Not in our gift to mandate. ESP click-tracker behavior, browser history retention, and `Referer`-header behavior on the brand's landing pages are outside CustomerEQ's control. The GDPR exposure persists regardless of any brand-side configuration. |
| **Encrypt the member identifier in the URL with a per-brand symmetric key** | Marginally better than plaintext but: (a) the encrypted blob is still a stable per-(brand, member) string — a leaked blob is still a per-member impersonation key indefinitely; (b) key rotation breaks all in-flight invitations; (c) URL length grows. The opaque-token approach gives strictly stronger semantics (single-use, expirable, revocable) at the same operator-perceived simplicity. |
| **Brand-side per-recipient distribution refs (Option B from #241 D51 / OQ4)** — brand POSTs `/v1/distributions` per recipient, gets back per-invitation tokens, mail-merges them | Forces every brand to write integration code. The whole point of the BYO-email flow is "no integration code." Distribution refs remain a future enhancement for the integration-heavy brand segment (also noted in #241 D51). |
| **Signed JWT in the URL** (`/s/:surveyId/r/:jwt`) | JWTs are not single-use without a server-side revocation list — which is exactly what `SurveyDistributionToken` is. The token-table approach gives the revocation list at the database row level for free; JWT adds 200+ bytes per URL with no concrete benefit. |
| **Use cookies for member identity post-click** | Browser-history `Referer` leakage on the click is unchanged; cookies don't solve the leak. They also break for respondents on shared devices. |
| **Use the existing embedded-widget data-attribute prefill for email distribution too** | Brands sending from their ESP have no host page to mount the widget on — the click goes to a CustomerEQ-hosted standalone form, not to the brand's website. The widget pattern only applies to in-product surveys (existing #241 R16). |

## Open Questions (RFC / implementation phase)

These items are unresolved at draft-time; reviewer answers will be captured here as feedback comes in.

- **OQ1** — Mode C identifier disambiguation: when a pasted line is ambiguous (e.g., `12345` could be a phone number stripped of `+` or an external_id), what is the disambiguation rule? Proposed default: prefer `Brand.memberIdentifierKind` as the tie-breaker — if the brand is `email`, an ambiguous numeric line is treated as external_id; if the brand is `phone`, treated as phone. The wizard surfaces the inferred kind per-line so the operator can correct before generating. RFC owns the exact disambiguation.
- **OQ2** — RBAC permission scope: should `survey.distribute` be a separate permission from `survey.edit`, or fold into `survey.edit` by default? Proposed: separate, because the personas can differ (a marketing manager may have edit but not distribute; a CX operator may have distribute on a survey they don't own). RFC owns the RBAC matrix.
- **OQ3** — Throttle posture for the auto-enroll path in Mode C: should the BULK_DISTRIBUTION enrollment path share the existing BULK_IMPORT throttle bucket, or a separate one? Proposed: separate, because Mode C is interactive (operator waiting on Step 3 progress); BULK_IMPORT is batch. RFC owns the rate-limit shape.
- **OQ4** — CSV upload size limit for Mode C: hard cap at 100,000 rows per upload (per NFR-SC2) or larger? Proposed: 100,000. Beyond that, the operator's natural choice is to use Percent / Count modes against a predicate.
- **OQ5** — Cross-survey one-per-period: explicitly NOT in v1 scope (per the issue's Non-goals). But the data model permits it as a follow-on — should the spec mention the natural shape? Proposed: a future `BrandFatiguePolicy` entity sets "max one survey-batch include per member per N days" enforced at audience-build time. Not RFCed here; recorded as v1.x roadmap.

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

**Spec implication:** CustomerEQ's chosen URL shape `/s/<surveyId>/r/<token>` (§1, §4 of this spec) follows the dominant industry pattern (path-borne opaque token) and tightens it on three axes the incumbents do not all satisfy: (a) single-use enforced server-side (vs. SurveyMonkey/GetFeedback which are stable URLs), (b) expirable (vs. all four), (c) no PII anywhere — not as an opt-in encryption flag like GetFeedback, not as a separate-Personal-Links-feature-on-an-enterprise-tier like Qualtrics, but as the **only** supported shape.

### Competitive Positioning Strategy

#### Our Differentiation

- **Key Advantage 1 — True BYO-ESP + tokens + sampling, in one entry-tier flow.** No competitor in the researched set ships all three: (a) CSV export of per-recipient tokenized URLs for any ESP, (b) random-%/random-N/explicit-list sampling as a first-class operator primitive, and (c) at a mid-market price point. Qualtrics has (a) but not (b) and is enterprise-priced. Delighted has (a) but PII-in-URL, no (b), and weakens to anonymous if PII isn't appended. SurveyMonkey has neither (a) at the per-recipient grain nor (b) natively.
- **Key Advantage 2 — Recurring-wave-with-one-response-per-wave as a data-model invariant, not a process.** AskNicely has recurring NPS but only on their own send infra. Qualtrics has scheduled-send but no documented one-per-wave attribution layer. CustomerEQ's `DistributionBatch` + token single-use makes "Q1 → Q2 → Q3 same 100 members, one response per quarter" an emergent property of the data model — and natively supports trending queries against `SurveyResponse.distributionBatchId`.
- **Key Advantage 3 — No PII in URL is the only shape, not an opt-in.** GetFeedback offers an *optional* encryption flag, exposed PII by default. Delighted documents PII-appending as the attribution method. Typeform's docs explicitly warn customers about their own URL-parameter pattern. CustomerEQ ships GDPR-Article-5-clean URLs out of the box, with no operator toggle to get it wrong.
- **Key Advantage 4 — One coherent surface from "I have a survey" to "I have a CSV of links."** The Distribute wizard, the Distribution batches section, batch detail, and ESP-shaped CSV all live behind one Distribution action on the survey detail page. Operators don't context-switch between a Distribution module and a Contacts module (Qualtrics) or assemble it from Workflows (HubSpot).
- **Key Advantage 5 — Loop integration.** Tokenized responses feed the existing `cx.<surveytype>_response` event into the same Loop Monitor / Response-to-Action / EarningRule pipeline as anonymous and embedded surveys (#241 §4 / R22). Competitors who treat the per-recipient survey as a separate product (Qualtrics Personal Links vs. their Loop closure module) leave a seam the operator has to bridge.

#### Competitive Response Strategy

- **If Qualtrics positions Personal Links as a discriminator** → our counter is "same primitive, available at mid-market pricing, in the same surface as the loop-closure pipeline." Their seam between Personal Links (distribution) and ticketing-loop closure is our integration.
- **If Delighted's mid-market footprint encroaches on BYO-ESP** → our counter is the PII-in-URL anti-pattern citation. We can demo two URLs side-by-side and show that the Delighted Embed pattern (with PII appended) reveals the customer's identifier in browser history; CustomerEQ's tokenized URL does not. The GDPR exposure is a sales asset, not a feature footnote.
- **If SurveyMonkey ships a "Personal Links Email Collector for external ESPs"** (plausible roadmap response) → our counter is recurring-wave-with-one-per-wave. The token single-use + batch boundary primitive is non-trivial to retrofit onto a tool whose response model assumes one-link-one-survey.
- **If HubSpot adds tokenized survey links to Service Hub** (plausible bundled play) → our counter is the explicit-list-with-auto-enroll Mode C. HubSpot Workflows can mail-merge to a HubSpot list; they can't auto-enroll an external CSV of identifiers into a CX program. CustomerEQ is positioned as the ingestion point for cohorts that originate outside the brand's CRM (operations team's escalation list, NPS pulse for a recent product launch, etc.).

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

This addition is recorded as a recommendation in the spec; the actual `fraim/config.json` edit is left for explicit user authorization (per `feature-specification` job step 3 — *"Use permission-seeking to ask: 'Found new competitor [Name]. Add to config?'"*) and is not bundled into this branch.

## Non-goals (v1)

Restated from the issue body for explicit traceability:

- **Wave scheduling / auto-recurrence** ("send every quarter automatically"). The primitives shipped here (audience spec stored on the batch, `Re-run with same audience` action) make this a natural v1.x extension; out of scope for v1.
- **ESP-native integrations** (Mailchimp/HubSpot/Klaviyo apps that auto-inject per-recipient tokens at send time). Roadmap, not v1.
- **Cross-survey fatigue policy** (orthogonal — see OQ5).
- **Anonymous / unauthenticated public-link distribution.** The existing anonymous `/s/<surveyId>` share-link path is unaffected by this spec; tokens are additive.
