# Feature: Historical Survey Data Import

Issue: #262  
Owner: swavak@gmail.com  
Status: **READY FOR IMPLEMENTATION — all open questions resolved**

---

## Customer

**CustomerEQ admin / operator** — the brand employee responsible for setting up CustomerEQ when their company switches from an existing survey tool. This is not the end-consumer respondent; it is the internal operator managing the platform.

---

## Customer's Desired Outcome

When a brand migrates to CustomerEQ, their analytics dashboard should reflect the full history of customer sentiment — not start from zero. Existing customers who already submitted NPS or CSAT responses should be recognised as known members with a history, so the first interaction with CustomerEQ doesn't feel like meeting a stranger.

---

## Customer Problem Being Solved

**Problem 1 — Blank analytics on day one.**  
A brand that has collected 2 years of NPS data in SurveyMonkey switches to CustomerEQ. The analytics dashboard shows zero responses, zero trend data, no NPS baseline. The brand cannot demonstrate ROI to leadership, cannot see deterioration in CX over time, and cannot use historical data to seed AI clustering or anomaly detection. The dashboard looks broken on day one, which erodes confidence in the platform.

**Problem 2 — Lost member continuity.**  
A customer who gave NPS=3 (detractor) 90 days ago is still a flight risk today. Without the historical import, CustomerEQ has no signal about this person. When they next interact, the platform treats them as a neutral new member rather than an at-risk returning one. Opportunities to trigger winback campaigns or prioritise support escalation are missed.

**Problem 3 — Manual re-entry is not an option.**  
Clients with thousands of historical responses cannot feasibly re-enter them manually. They need an automated path to bring data across in bulk.

---

## ⚠️ Open Questions

### OQ-1: What survey tools do target clients currently use? ✅ ANSWERED

**Answer (2026-05-03):** Top use case is **Google Reviews**. Second is **Excel** with standard/common header columns — clients will have some columns and not others, and may have a few extra ones.

**Architectural direction:** Build an extensible **source adapter library**. Each source type defines its own column mapping and normalisation rules server-side. The import UI asks "what source is this from?", selects the appropriate adapter, and runs it. Google Reviews becomes adapter v1; Excel (flexible/lenient) becomes adapter v2. Over time the library grows without re-engineering the core pipeline.

**Critical implication for Google Reviews:** Google Reviews exports do **not** include email addresses. The current member-matching strategy (match by email) breaks for this source. Google Reviews provides: reviewer display name, star rating (1–5), review text, date. The adapter design must resolve:

> **OQ-1a (new):** For Google Reviews respondents with no email, do we: (a) skip loyalty-member linkage and store as anonymous historical records, or (b) attempt fuzzy name matching against existing members? Option (a) is safe and auditable; option (b) is risky and error-prone.

**Recommended:** Option (a) — anonymous historical records for Google Reviews, with a `sourceKey` (reviewer display name + review date hash) for deduplication. Member linkage remains email-only for sources that provide it (Excel, SurveyMonkey, etc.).

---

### OQ-2: Column mapping approach — fixed template or mapping wizard? ✅ ANSWERED (direction)

**Answer (2026-05-03):** Neither a single rigid template nor a full mapping wizard. Use the **source adapter library** approach described in OQ-1: each source type has a server-side adapter that knows its column schema. The UI presents a source selector; the adapter handles the mapping. Extensible by adding new adapters without UI changes.

**Build effort by adapter:**
- Google Reviews adapter: ~2–3 days (fixed schema, normalise 1–5 → 0–10, no email)
- Excel flexible adapter: ~2–3 days (lenient header matching, tolerate unknown columns, skip missing optionals)
- Future adapters (SurveyMonkey, Typeform, Qualtrics): ~1–2 days each once the framework exists

---

### OQ-3: What does "connect historical data with future surveys" mean? ✅ ANSWERED

**Answer (2026-05-03):** Analytics continuity only for v1. Historical responses appear in trend charts, NPS baselines, clustering, and anomaly detection. No effect on loyalty tier, health score, or campaigns.

**Rationale:** Many historical records (especially Google Reviews) have no member linkage, so feeding them into the loyalty engine is not reliably possible. If the analytics data shows clear signal that warrants revisiting this, loyalty engine integration becomes a future feature at that point.

**What we build:** Import data → run through sentiment pipeline → surface in analytics. No changes to loyalty engine, health score computation, or campaign trigger evaluation.

---

## User Experience

### UX Flow

**Step 1 — Admin navigates to a survey's detail page.**  
They see a new "Import Historical Data" button in the page header.

**Step 2 — Admin clicks the button.**  
A modal opens with:
- A source selector: *"Where is this data from?"* — dropdown with Google Reviews, Excel, and future adapters.
- Source-specific instructions shown inline (e.g. for Google Reviews: "Export your reviews from Google Business Profile → Manage reviews → Export").
- A file picker (accepts `.csv` or `.xlsx` depending on source).
- A "Start Import" button.

**Step 3 — Admin uploads the file.**  
On submit:
- File is validated for size (≤10 MB) and source-specific required columns.
- A batch record is created with `sourceType` recorded.
- Rows are enqueued for async processing through the appropriate adapter.
- The modal shows a confirmation with the batch ID and row count.

**Step 4 — Admin monitors progress.**  
The survey detail page gets an "Import History" tab showing:
- Each import batch: filename, source type, status (pending / processing / complete / failed), total rows, processed rows, failed rows, started timestamp.
- A "Refresh" button for in-progress batches.
- If there are failed rows, a count and a way to view the error details.

**Step 5 — Import completes.**  
Historical responses appear in the Responses tab (tagged "historical · Google Reviews" or "historical · Excel") and in the CX analytics dashboard alongside live responses.

---

### Source Adapter: Google Reviews (v1)

Google Business Profile exports a CSV with these columns (as of 2025):

| Google column | Maps to | Notes |
|---------------|---------|-------|
| `Reviewer` | `verbatimAuthor` (display only) | Not used for member matching — no email available |
| `Star Rating` | `score` | Normalised: ×2 → 0–10 scale |
| `Review` | `verbatim` | Run through sentiment analysis |
| `Date` | `completed_at` | ISO 8601 parse |
| *(none)* | `channel` | Hardcoded to `review` |
| `Review ID` (if present) | `externalId` | Deduplication key |

**Member matching:** No email available. Records are stored as anonymous historical responses with `memberId = null` and `sourceKey = SHA256(Reviewer + Date)` for deduplication. Anonymous records contribute to analytics (NPS trend, sentiment clustering) but are excluded from loyalty engine calculations. *(OQ-1a resolved: anonymous records — no fuzzy name matching.)*

---

### Source Adapter: Excel / Generic CSV (v2)

Lenient column matcher. Recognises common header name variants (case-insensitive, underscore/space/hyphen tolerant):

| CustomerEQ field | Recognised header variants |
|-----------------|---------------------------|
| `email` | `email`, `email address`, `respondent_email`, `customer_email` |
| `score` | `score`, `nps`, `nps_score`, `rating`, `csat`, `ces` |
| `verbatim` | `verbatim`, `comment`, `feedback`, `response`, `open_ended` |
| `completed_at` | `completed_at`, `date`, `submitted_at`, `response_date`, `timestamp` |
| `channel` | `channel`, `source`, `medium` |
| `external_id` | `external_id`, `respondent_id`, `id`, `response_id` |

Unknown columns are silently ignored. Missing optional columns use defaults. `email` is still required for member matching in this adapter.

Score normalisation: if max score in column ≤ 5, auto-normalise ×2. If max ≤ 7, normalise ×1.43. Otherwise assume 0–10.

---

## Compliance Requirements

**GDPR / CCPA (Project Rule 13)**

| Requirement | Control |
|-------------|---------|
| Imported member stubs must not be included in campaign targeting until explicit consent is given | `consentGivenAt = null` on stub creation; campaign trigger evaluation must gate on `consentGivenAt IS NOT NULL` |
| Imported responses must be covered by the erasure job | `apps/worker` erasure job must zero PII fields on `SurveyResponse` records where `memberId` links to an erased member |
| Soft delete only | No hard-delete of `SurveyImportBatch` or imported `SurveyResponse` records; use `deletedAt` pattern if removal is ever needed |
| Verbatim text is PII | `SurveyResponse.answers` (contains verbatim) must be included in erasure scope |

**Data provenance**  
Imported data must be clearly distinguished from live data in the UI (tagged "historical") so operators and any downstream audit can identify its source and that it was not collected via CustomerEQ's own survey widget.

---

## Validation Plan

1. **CSV parsing** — Upload a well-formed CSV: verify rows appear as `SurveyResponse` records with `importBatchId` set.
2. **Member matching** — Upload a CSV with an email matching an existing member: verify the response links to that member, not a new stub.
3. **Stub creation** — Upload a CSV with an unknown email: verify a new member stub is created with `consentGivenAt = null`.
4. **Validation errors** — Upload a CSV with one malformed row (bad email, score out of range): verify that row is logged in the batch error log, the batch does not abort, and the valid rows process normally.
5. **Analytics continuity** — After import, open the CX analytics page: verify NPS trend includes historical data points at the correct dates.
6. **Consent gate** — Verify stub members created by import are excluded from campaign trigger evaluation.
7. **Size limit** — Upload a file > 10 MB: verify a 413 error with a clear message.
8. **Empty file** — Upload a file with headers only and no rows: verify a clear validation error.
9. **Missing required column** — Upload a CSV missing `email`: verify a 422 error listing the missing column.

---

## Alternatives

| Alternative | Why discard? |
|-------------|-------------|
| **Manual entry via the survey response form** | Not scalable for hundreds or thousands of rows; would require admins to operate on behalf of respondents, which is confusing and error-prone. |
| **API batch endpoint (JSON, not CSV)** | CSV is the universal export format from every survey tool. A JSON endpoint would require clients to write code, not suitable for non-technical operators. |
| **Automated connector (direct SurveyMonkey API pull)** | Requires OAuth per tool, ongoing maintenance of multiple connectors, and deals with pagination and rate limits. High build cost for an onboarding-only workflow. Good future-state but wrong scope for initial release. |
| **Retroactive campaign triggers on imported data** | Breaks the product contract that loyalty actions are always real-time responses to current customer behaviour. Retroactive points awards would confuse members and create support burden. |

---

## Competitive Analysis

### How competitors handle this

| Competitor | Approach | Strengths | Weaknesses |
|------------|----------|-----------|------------|
| **Medallia** | Full data migration service (professional services engagement, weeks to months) | Handles any format, schema mapping included | Very expensive; not self-serve; not available at CustomerEQ's price point |
| **Qualtrics** | CSV import via admin UI with column-mapping wizard | Self-serve, handles raw exports from other tools | Complex UI; schema mapping is unintuitive for non-technical users |
| **Delighted (Typeform)** | Accepts historical NPS data via CSV with fixed template (`email, score, date, comment`) | Simple, fixed template approach, well-documented | No CSAT/CES import; no member matching to existing contacts |
| **SurveyMonkey Engage** | No native historical import | N/A | Gap — customers have to start fresh |

### Our Differentiation

The key CustomerEQ advantage for this feature is **member continuity**: we don't just import scores as anonymous data points — we link them to loyalty members, so historical sentiment feeds directly into the health score and member profile. Competitors either treat historical imports as raw analytics data (no member linkage) or require expensive professional services.

### Competitive Positioning

- **Target segment**: Brands switching from standalone survey tools who want sentiment history to inform their loyalty engine — not just populate a chart.
- **Value proposition**: "Bring your history, connect it to your loyalty members — one CSV upload."
- **Option A (fixed template) is a valid v1**: Delighted uses this approach and customers adapt. Professional services consultants can help clients reformat if needed.

---

## Open Questions Summary

All open questions resolved. Implementation may begin.

| ID | Question | Resolution |
|----|----------|------------|
| OQ-1 | Which tools do first clients export from? | Google Reviews (v1), Excel flexible (v2) |
| OQ-1a | Google Reviews — anonymous records or fuzzy name matching? | Anonymous records (`memberId = null`) |
| OQ-2 | Fixed template vs mapping wizard? | Source adapter library — server-side per-source mapping |
| OQ-3 | Analytics only vs loyalty engine influence? | Analytics only for v1; loyalty engine integration is a future feature |
