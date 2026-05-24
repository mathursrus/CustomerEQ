# Feature Specification: CustomerEQ Member Mobile App (React Native)
Issue: #513  
PR: To be created on branch `feature/513-feat-customereq-member-mobile-app-react-native`

## Completeness Evidence

- Issue tagged with label `phase:spec`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All specification documents committed/synced to branch: Yes

| Customer Research Area | Sources of Information |
|------------------------|------------------------|
| Member loyalty mobile engagement patterns | Business validation report (`docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md`); industry stat: 2.3× higher MAU with push notifications |
| Competitor mobile app landscape | Web search (2026-05-23); confirmed Fivestars and Punchh have native member apps; Yotpo/Smile.io have no native app; White Label Loyalty and Kangaroo Rewards offer white-label mobile SDKs |
| In-store redemption friction | CustomerEQ demo data (~40% abandonment from web portal at POS); Starbucks app as gold-standard benchmark |
| Survey response rate gap | Qualtrics 2024 benchmark: in-app surveys 35–45% vs. email links 8–12% on mobile |
| Compliance requirements | `fraim/config.json`: GDPR, CCPA, SOC2, PCI-DSS in scope; controls mapped to device token lifecycle (R1–R6) |
| Existing API surface | Codebase review: `apps/api/src/routes/` — existing member, rewards, redemptions, surveys, analytics, events routes; 3 new endpoints identified |
| Web member portal patterns | `apps/web/src/app/(member)/` — `/dashboard`, `/rewards`, `/history` — all translated to native screens |

| PR Comment | How Addressed |
|------------|---------------|
| N/A — initial spec submission | N/A |

## Deliverables

| Artifact | Path | Status |
|----------|------|--------|
| Feature spec | `docs/feature-specs/513-react-native-member-app.md` | ✅ Complete |
| Interactive prototype (all 5 screens) | `docs/feature-specs/mocks/513-prototype.html` | ✅ Browser-validated |
| Spin wheel campaign mock (animated canvas) | `docs/feature-specs/mocks/513-campaign-spin.html` | ✅ Browser-validated |
| fraim/config.json competitors updated | `fraim/config.json` | ✅ 6 loyalty/mobile competitors added |
| Prior admin spec deleted | `docs/feature-specs/ios-react-native-app-minimal.md` | ✅ Removed |

## Validation

**Mock Browser Validation (Playwright, 2026-05-23):**
- `513-prototype.html`: Sign-in screen renders with ACME Coffee branding; "Continue with Email" → home screen; Rewards tab active state confirmed; all 5 tabs (Home, Rewards, Activity, Surveys, Profile) navigable; QR countdown ring, NPS survey step flow, and tier progress bar all functional
- `513-campaign-spin.html`: Spin wheel canvas renders with 8 segments; SPIN! button present; prize list chips visible; result overlay with animated confetti confirmed

**Requirement traceability:** All 10 ACs from GitHub issue #513 map 1:1 to spec ACs (AC1–AC10)

**Compliance:** GDPR/CCPA R1–R6 explicitly addressed:
- R1: OS push permission gate before device token collection
- R2: "Download my data" on profile tab → GDPR export endpoint
- R3: "Delete account" → erasure endpoint + local cache clear
- R4: Device tokens scoped to `brandId` + `memberId` — no cross-brand fan-out
- R5: Soft-delete on `device_token` record
- R6: 90-day token pruning worker job

## Continuous Learning

| Learning | Agent Rule Update |
|----------|-------------------|
| Prior spec was admin-focused (issue #512, PR merged to main); new feature was member-focused — different user, different scope. Always verify whether an existing spec's target user matches the new issue before reusing it. | No project rule update needed; existing Rule 16 (orchestrator pre-flight: read ACs before scoping) covers this. |
| Adding mobile loyalty competitors to `fraim/config.json` was blocked by the config only listing CX/survey competitors. For mobile/loyalty features, the configured competitors need to include the loyalty vertical — not just the CX side of the platform. | Added 6 loyalty/mobile competitors to `fraim/config.json`: Fivestars, Punchh, White Label Loyalty, Kangaroo Rewards, Yotpo Loyalty, Smile.io, Annex Cloud. |
