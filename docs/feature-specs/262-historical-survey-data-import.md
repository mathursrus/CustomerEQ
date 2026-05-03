# Feature: Historical Survey Data Import

Issue: #262  
Owner: swavak@gmail.com  
Status: **DRAFT — Awaiting answers to Open Questions before implementation**

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

## ⚠️ Open Questions — Must Be Answered Before UX Is Designed

These are blocking unknowns. The implementation will be wrong if we proceed without them.

### OQ-1: What survey tools do target clients currently use?

Each tool exports with completely different column names and semantics. Without knowing which tools are in scope, we cannot design the column mapping.

**Known format examples (to be validated with clients):**

| Tool | Score column name | Respondent ID | Date column |
|------|------------------|---------------|-------------|
| SurveyMonkey | `How likely are you to recommend...` (long text) | `Respondent ID` | `Start Date` |
| Typeform | `nps_score` or custom alias | `token` | `Submitted at` |
| Qualtrics | `NPS_1`, `NPS_GROUP` | `ResponseId` | `RecordedDate` |
| Custom Excel | Anything | Anything | Anything |

**Question for owner:** Which tools do the first 3–5 target clients use? Can we get one anonymised sample export?

---

### OQ-2: Column mapping approach — fixed template or mapping wizard?

Two design approaches:

| Approach | Description | Build effort | Client effort |
|----------|-------------|--------------|---------------|
| **A. Fixed template** | We publish a CSV template (e.g. `email, score, verbatim, completed_at`). Client reformats their export before uploading. | Low (1–2 days) | High — client must reformat; non-technical clients may struggle |
| **B. Mapping wizard** | Client uploads their raw export. A UI step shows their column names and lets them drag/map to CustomerEQ fields. | High (1–2 weeks) | Low — no reformatting needed |

**Recommended path:** Start with **Option A (fixed template)** for the first client — it validates the pipeline without the mapping UI investment. Only build Option B if clients consistently struggle to reformat.

**Question for owner:** Is Option A acceptable for the initial release, or do we know already that clients cannot reformat their own data?

---

### OQ-3: What does "connect historical data with future surveys" mean?

Two interpretations, with different implementation implications:

| Interpretation | Meaning | What we build |
|---------------|---------|--------------|
| **Analytics continuity only** | Historical responses appear in trend charts, NPS baselines, clustering, and anomaly detection. No effect on loyalty tier or campaigns. | Import data → run through sentiment pipeline → surface in analytics. No changes to loyalty engine. |
| **Loyalty signal influence** | A member's historical NPS=3 should increase their winback campaign priority or lower their health score going forward. | Import data → score feeds into member health score calculation → loyalty rules can reference it. Significant additional scope. |

**Question for owner:** Is this analytics continuity only, or should historical sentiment influence the real-time loyalty engine?

---

## User Experience (Draft — Subject to OQ answers)

*This section describes the UX assuming Option A (fixed template) and analytics continuity only. It will be updated once OQs are answered.*

### UX Flow

**Step 1 — Admin navigates to a survey's detail page.**  
They see a new "Import Historical Data" button in the page header.

**Step 2 — Admin clicks the button.**  
A modal opens with:
- A brief explanation: *"Upload a CSV of historical responses. Download our template to see the required format."*
- A link to download the CSV template (`email` required; `score`, `verbatim`, `completed_at`, `channel`, `external_id` optional).
- A file picker (accepts `.csv`).
- A "Start Import" button.

**Step 3 — Admin uploads the file.**  
On submit:
- File is validated for size (≤10 MB) and required `email` column.
- A batch record is created.
- Rows are enqueued for async processing.
- The modal shows a confirmation with the batch ID and row count.

**Step 4 — Admin monitors progress.**  
The survey detail page gets an "Import History" tab showing:
- Each import batch: filename, status (pending / processing / complete / failed), total rows, processed rows, failed rows, started timestamp.
- A "Refresh" button for in-progress batches.
- If there are failed rows, a count and a way to view the error details.

**Step 5 — Import completes.**  
Historical responses appear in the Responses tab (tagged "historical") and in the CX analytics dashboard alongside live responses.

### CSV Template Format

```
email,score,verbatim,completed_at,channel,external_id
jane@example.com,9,"Great service",2025-11-15,email,SM_12345
john@example.com,4,,2025-10-02,link,
```

**Column definitions:**

| Column | Required | Format | Notes |
|--------|----------|--------|-------|
| `email` | Yes | Valid email | Used to match existing Member or create stub |
| `score` | No | 0–10 decimal | NPS: 0–10; CSAT: normalise to 0–10 before import |
| `verbatim` | No | Free text | Open-ended response text; run through sentiment analysis |
| `completed_at` | No | ISO 8601 date | Defaults to import date if missing |
| `channel` | No | `email` / `link` / `sms` | Defaults to `link` |
| `external_id` | No | String ≤ 200 chars | Respondent ID from source system; stored for deduplication reference |

**Score normalisation note (OQ-3 dependency):** If a client's data is on a 1–5 CSAT scale, they must normalise to 0–10 before uploading (e.g., multiply by 2). We do not auto-detect scale in Option A. This should be documented in the template download.

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

| ID | Question | Blocks | Owner |
|----|----------|--------|-------|
| OQ-1 | Which tools do first clients export from? Sample export available? | Column definitions, template design | Customer / Sales |
| OQ-2 | Fixed template (Option A) or mapping wizard (Option B) for v1? | UX scope, build timeline | Product owner |
| OQ-3 | Analytics continuity only, or should historical sentiment influence loyalty engine? | Technical scope (significant if yes) | Product owner |
