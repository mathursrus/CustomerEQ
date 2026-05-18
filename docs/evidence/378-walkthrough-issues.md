# Issue #378 — Manual walk-through issue log

**Session date**: 2026-05-17
**Phase**: 12 (address-feedback) — manual UI walk-through
**PR**: #385
**Mock reference**: `docs/feature-specs/mocks/378-distribute-flow.html`

Issues are logged in the order the user reports them. **Status: capturing only — no analysis, no fixes** until the user signals to start.

---

## Issues

<!-- Append new entries below as the user reports them. -->

### Distribute page — `DistributionSection` (survey detail)

**1. "Send via my email tool" tile is in the wrong position.**
- Should be on the **right side** with **three buttons shown** (matching mock).
- It is acceptable for the **Share Links** and **Embed Scripts** tiles to wrap or use "…" / "more" affordance — as shown in the mock.

**2. "Replace `{{...}}` placeholders in embed script" hint is in the wrong scope.**
- Currently rendered **outside / below** "Send via my Email tool".
- That hint only applies to the **Embed** option and should live **inside the Embed section**.

**3. The three options are missing icons.**
- All three tiles (Share Links / Embed Scripts / Send via my email tool) need icons that convey their intent.

### Distribute → Configure step — "Who gets this survey?" / audience picker

**4. "Who gets this survey?" should show both options on one line.**
- Matches mock layout — current implementation does not.

**5. When `Count` is selected, the number must not exceed total members.**
- Current implementation allows entering a count above the available member pool.

**6. Count text-box UX — cannot remove leading zero.**
- Typing in the count field doesn't let me delete the leading `0` easily.
- Functionally correct, but weak UX.

**7. Live preview is stale when Count is changed to 0.**
- Changed Count to `0` → preview still showed **2 people** and button still said "Generate 2 links".
- Changing Count to `1` filtered correctly to 1.
- There is **no real-time update** between count changes and preview/CTA.

**8. Percent / Count selector styling mismatch.**
- The `Percent` vs `Count` selection buttons do not match the mock styling.
- The **helper/descriptive text** shown below "Existing Members" in the mock is **missing** in the implementation.
- That helper text should also **change dynamically** based on the current spec (Percent vs Count + selected value).

**9. CSV upload option is missing.**
- The Custom List flow should support **CSV upload** (per mock + handoff §"Step 1"). Currently no upload affordance is visible.

### Downloaded CSV — spec change

**10. [SPEC CHANGE] Drop internal `memberID` from downloaded CSV; rename identifier column to match brand's Member ID type.**
- The downloaded CSV is a **customer-facing document** — must use the brand's language, not CustomerEQ internals.
- **Remove** CustomerEQ's internal `memberID` column from the downloaded CSV.
- **Rename** the identifier column based on the brand's **Member ID type** as configured in **Organization → Settings**:
  - `Email`
  - `Phone Number`
  - `Customer ID`
- Implications to investigate later: column-header source (brand settings lookup at generate time), all four format presets (Generic / Mailchimp / HubSpot / Klaviyo), and the live preview column header.

### Respondent tokenized page — `/survey/[id]/r/[token]`

**11. Duplicate Consent / checkbox / Submit rendered on the respondent page.**
- Page renders **two** Consent lines, **two** checkboxes, and **two** Submit buttons.
- The **inner** Submit (inside the box) is **not clickable**; the outer one is wired up.
- Transient evidence captured from dev log:
  - Concrete URL hit: `GET /survey/cmp59s122000i6f5mgzboczbh/r/FLfSUIlenfXwS_qNjRJy6cR_NkttBQn-` → 200
  - Public token-status + survey fetched 200 OK
  - User attempted submit → `POST /v1/public/surveys/cmp59s122000i6f5mgzboczbh/respond` → **201 Created** in 180 ms (so the outer button is wired through to the public-respond endpoint; the inner one is the dead UI element).
  - SSR HTML body before hydration is just `<main class="max-w-2xl mx-auto px-6 py-12"><p class="text-gray-500">Loading…</p></main>` — confirming the duplication appears only after client-side render of `RespondentForm`-like component(s).

**12. Unrelated dev warnings on `/survey/[id]/r/[token]` SSR (capturing now so they don't get lost).**
- `Route "/survey/[id]/r/[token]" used ...headers() or similar iteration. headers() should be awaited`
- `Route "/survey/[id]/r/[token]" used headers().get('Content-Security-Policy'). headers() should be awaited`
- Same warnings also fire on `/` and `/admin/surveys/[id]/distribute/batches/[batchId]` — looks like a shared layout/middleware issue, not #378-specific.
- **Flagged for triage, not necessarily a #378 fix.**

### Batch detail — Regenerate flow

**13. Regenerated CSV filename should be prefixed with `regenerated-`.**
- Convention: `regenerated-<original-download-filename>`.
- Applies to the CSV produced by the Batch detail "Regenerate links + download CSV" action.

### Global / cross-cutting styling

**14. Button styling inconsistent across pages; missing hover pointer cursor.**
- All buttons should be **visually consistent** with the rest of CustomerEQ.
- All buttons must change the cursor to a **pointer on hover**.
- Every page in the #378 flow is inconsistent.
- **User question to address during fix:** "Isn't there a global CSS for these?" — sweep should reuse the existing global button styling rather than re-introducing one-off button classes.
- **Canonical button style preference:** match the **"Generate N links"** button (on the Configure → Generate CTA). That is the target look-and-feel to standardise on.

### Custom List paste — truncation defect

**15. Pasted 100 emails → only 75 accepted; helper text claims paste limit is 10,000.**
- User pasted **100** emails into the Custom List paste box.
- System processed only **75** (silent truncation — no warning, no error).
- Helper text under the paste box says **10,000** is the accepted limit, so the actual limit being enforced contradicts the stated UX promise.
- Transient evidence captured from dev log around this attempt:
  - Multiple `POST /v1/surveys/cmp59s122000i6f5mgzboczbh/distribution-batches/preview` calls (live preview firing as the user typed/pasted).
  - Eventual `POST /v1/surveys/cmp59s122000i6f5mgzboczbh/distribution-batches` (the Generate call).
  - Log doesn't include request bodies — actual count truncation will need to be reproduced when fix work begins.

**Root-cause investigation (post-fix-1):**
- Pulled the stored `audienceSpec.identifiersRaw` from the offending batch
  (`cmpanwa5h005p8afow8bs5fci`): **4168 chars**, ending mid-paste at
  `short076@dom.io` without even a trailing comma. So the body the server
  received was only ~76 lines, not 100. The remaining ~24 emails were lost
  somewhere between the user's clipboard and the JSON body fetch.
- Of those 76 input lines, the parser stored **75 audience members**. The
  missing 1 was `user001_alpha@domainexample.com` (the first line).
- **Diagnosed bug (parser side):** the `looksLikeCsv` sniff in
  `apps/api/src/routes/distributionBatches.ts resolveCustomList` was just
  `firstLine.includes(',') && body.includes('\n')`. A paste of bare emails
  with trailing commas trivially matches → `parseCsvBody` runs →
  `parseCsvRaw` treats line 1 as a header row → first email lost.
- **Diagnosed bug (truncation side):** could not reproduce in isolation;
  likely a browser/clipboard/textarea edge case (Windows + Chromium-based
  paste of 5–6 KB into a `<textarea rows={6}>`). Not deterministic enough
  to fix at the source — instead made the symptom visible (see fix below).
- **Fix applied (parser):** introduced `bodyHasCsvHeader(body)` in
  `apps/api/src/utils/distributionListParser.ts` — CSV mode only triggers
  when the first cell of the first line is a known `HEADER_ALIASES` key
  (`email`, `email_address`, `phone`, `customer_id`, …). Bare-email pastes
  now flow through `parsePasteBody` and all rows survive. Regression test
  added in `distributionListParser.test.ts`.
- **Fix applied (UX surfacing):** API now returns `parsedRowCount =
  parsed.rows.length + parsed.unmatched.length` in the preview response,
  and the live-preview block renders "Parsed N entries from your input"
  so the operator can sanity-check the parser's row count against their
  pasted count. Any silent body-size truncation now shows up immediately
  ("Parsed 76 entries" when they thought they pasted 100).
- **Drive-by:** `willAutoEnrollCount` was always 0 in preview because the
  preview path never persists. Now derived from `members.filter(m =>
  m.memberId === '').length` so the operator sees a real prediction
  before they click Generate.
