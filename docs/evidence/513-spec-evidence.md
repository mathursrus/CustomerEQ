# Feature Specification: CustomerEQ Mobile App for CX Managers (React Native)
Issue: #513  
PR: https://github.com/mathursrus/CustomerEQ/pull/514  
Branch: `feature/513-feat-customereq-member-mobile-app-react-native`

## Completeness Evidence

- Issue tagged with label `phase:spec`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All specification documents committed/synced to branch: Yes

| Customer Research Area | Sources of Information |
|------------------------|------------------------|
| CX manager mobile engagement gap | No existing mobile dashboard for CustomerEQ operators; web-only today |
| Competitor mobile operator apps | Web search (2026-05-23): Medallia has full mobile app; Qualtrics read-only; Delighted/AskNicely web-only; no mid-market competitor offers AI clustering + review reply in mobile |
| Push notification value for operators | Anomaly alert latency: clusters can spike for hours before operator opens web dashboard; push closes that gap |
| Existing API surface | Codebase review: `/v1/analytics/cx`, `/v1/feedback/clusters`, `/v1/anomalies`, `/v1/surveys` routes already exist; 3 new endpoints identified |
| Google Reviews integration | Issue #509 merged: Google Places API fallback implemented; `GET /v1/reviews` and `POST /v1/reviews/:id/reply` scoped for new mobile endpoints |
| Web admin patterns | `apps/web/src/app/(dashboard)/` — survey results, cluster views, anomaly panel — all translated to mobile screens |

| PR Comment | How Addressed |
|------------|---------------|
| N/A — initial spec submission (v2, corrected persona) | N/A |

## Deliverables

| Artifact | Path | Status |
|----------|------|--------|
| Feature spec | `docs/feature-specs/513-react-native-cx-manager-app.md` | ✅ Complete |
| Interactive prototype (5 screens + 3 sheets) | `docs/feature-specs/mocks/513-prototype.html` | ✅ Browser-validated |
| Anomaly alert deep-dive mock | `docs/feature-specs/mocks/513-anomaly-alert.html` | ✅ Browser-validated |
| fraim/config.json competitors updated | `fraim/config.json` | ✅ 7 loyalty/mobile competitors added |
| Prior member-app spec deleted | `docs/feature-specs/513-react-native-member-app.md` | ✅ Removed |
| Prior campaign-spin mock deleted | `docs/feature-specs/mocks/513-campaign-spin.html` | ✅ Removed |
| Coaching moment captured | `fraim/personalized-employee/learnings/raw/...product-owner-not-end-consumer-persona.md` | ✅ Written |

## Scope Correction (v2)

The initial spec (v1) incorrectly targeted the end-consumer loyalty member persona. The corrected spec targets the **B2B product owner / CX manager** — the CustomerEQ subscriber who monitors surveys, clustering, and reviews.

**MVP focus**: Surveys, Results/Analytics, AI Clustering, Google Reviews  
**Coming soon**: Loyalty Program Management, Support Queue

## Validation

**Mock Browser Validation (manual, 2026-05-23/24):**
- `513-prototype.html`: Home screen renders NPS hero card (score 62) with sparkline and anomaly banner; all 5 bottom tabs navigable; Survey detail sheet opens with multi-question accordion (NPS distribution, Stars anomaly delta, MC bar chart, open-text word chips); Q2 checkout rating row styled red as anomaly source; Cluster detail sheet opens with AI summary, sentiment bar, and quotes; Review reply sheet opens, character count updates, Submit shows toast; Profile shows Coming Soon section with locked Loyalty/Support cards; **Survey creation**: 3-step sheet opens from `+` button — Step 1 (name + type grid), Step 2 (4-question builder with add/delete), Step 3 (interactive preview — NPS 0-10 buttons highlight green/amber/red by zone, star picker updates, choice buttons highlight, publish fires toast)
- `513-anomaly-alert.html`: Push notification banner renders and auto-dismisses; red alert header with 3 stat cards; 14-day trend chart canvas renders with spike dot highlighted; multi-question breakdown section shows Q1 NPS (62, no anomaly), Q2 Stars (2.1★ vs 3.8★ baseline, ↓46%, anomaly source banner), Q3 MC (Checkout Speed 42% red bar leading); AI root cause rows visible; 3 action buttons rendered

**Requirement traceability:** All 10 ACs from GitHub issue #513 map 1:1 to spec ACs (AC1–AC10)

**Compliance:** brandId JWT scoping addressed in all 3 new endpoints per Rule 6

## Continuous Learning

| Learning | Agent Rule Update |
|----------|-------------------|
| Confused B2B operator persona with B2C end-consumer persona. CustomerEQ is a B2B SaaS — "the customer of CustomerEQ" means the brand/business subscriber, not their loyalty members. | Coaching moment written: `fraim/personalized-employee/learnings/raw/...-product-owner-not-end-consumer-persona.md`. Existing Rule 16 (orchestrator pre-flight: read ACs before scoping) should be extended to also verify the user type (operator vs. end-consumer) before scoping any user-facing feature. |
