# Feature: Member Enrollment

Issue: #3
Owner: Claude (FRAIM feature-specification job)
Date: 2026-03-28
Priority: P0 — Critical path, MVP blocking
Labels: `member-lifecycle` `loyalty-engine` `p0` `phase-1`

---

## Customer

**Loyalty Member** — A customer of a mid-market brand ($10M–$500M revenue) who has been invited or driven to that brand's CustomerEQ loyalty portal. They may arrive via a post-purchase email link, an in-store QR code, or a direct marketing campaign.

**Secondary actor**: The **Admin / Program Owner** who has already configured the loyalty program (Issue #2) and set any enrollment bonus point rules that the system will apply at the moment of enrollment.

---

## Customer's Desired Outcome

The member wants to join the brand's loyalty program **in under 2 minutes** and immediately see their starting points balance (including any enrollment bonus), so they feel rewarded for signing up and motivated to engage further.

---

## Customer Problem Being Solved

Without enrollment, a customer has no identity in the loyalty system — they cannot earn points, redeem rewards, or receive personalized campaigns. Enrollment is the **zero moment of truth** for the loyalty program: a frictionless, trustworthy sign-up experience determines whether a new member engages or abandons.

Pain points addressed:
- Lengthy multi-step forms that cause drop-off before the member sees any value
- No immediate feedback — member doesn't know if enrollment succeeded or what they earned
- Re-prompting for consent after the fact, which creates friction and legal risk

---

## User Experience That Will Solve the Problem

### Flow Overview

```
Loyalty Portal Landing Page
      ↓
  Enrollment Page (/enroll)
  [Email + Password  |  Sign in with Google  |  Sign in with Facebook]
      ↓
  Profile Completion Step
  [First Name, Last Name, Phone (optional), Opt-ins, Consent checkbox]
      ↓
  System creates Member record + fires enrollment event
      ↓
  Welcome Screen — shows points balance (+ enrollment bonus if awarded)
      ↓
  Member Dashboard (/dashboard)
```

### Step-by-Step Workflow

**Step 1 — Landing / Entry**
- Member arrives at `/{brandSlug}/enroll` (e.g., `/acme-rewards/enroll`).
- Page displays the program name, brand logo, and a short value proposition headline (e.g., "Join Acme Rewards — Earn points on every purchase").
- Two entry options side-by-side: **Continue with Email** and **Continue with Google** / **Continue with Facebook** (SSO).

**Step 2a — Email + Password path**
- Member enters email address and a password (Clerk password policy: min 8 chars, 1 uppercase, 1 number).
- Inline validation: email format check, password strength indicator.
- If email already exists → show "Already have an account? [Sign in]" error state.

**Step 2b — SSO path (Google / Facebook)**
- Member clicks SSO button → OAuth popup/redirect via Clerk.
- On return: if SSO account has no matching CustomerEQ member record, proceed to Step 3.
- If SSO account is already enrolled → redirect directly to dashboard.

**Step 3 — Profile Completion**
- Member provides: First Name (required), Last Name (required), Phone (optional).
- Email opt-in toggle (default: off — member must actively opt in per GDPR/CCPA).
- SMS opt-in toggle (default: off).
- **Consent checkbox** (required to proceed): "I agree to the [Privacy Policy] and [Terms of Service]" — links open in new tab.
- Submit button: "Join the Program".

**Step 4 — Confirmation / Welcome Screen**
- Displays: "Welcome to [Program Name], [First Name]! 🎉"
- Points balance card: shows enrollment bonus if awarded (e.g., "You've earned 500 welcome points!") or "0 points — start earning today!" if no enrollment bonus is configured.
- CTA: "Go to my Dashboard" → navigates to `/dashboard`.

### UI Mock

→ [View enrollment mock](mocks/3-enrollment-view.html)

### Design Standards Applied

Generic UI baseline: **Tailwind CSS v4 + shadcn/ui** (Radix UI primitives). All components follow the shared `packages/ui` component library conventions. Color tokens, typography scale, spacing, and border-radius match the project design baseline. The mock uses Tailwind utility classes directly — no inline styles.

---

## Requirements

### Functional Requirements (SHALL)

| ID | Requirement | Acceptance Criteria (Given / When / Then) |
|----|-------------|-------------------------------------------|
| R1 | The system SHALL allow a member to create an account via email and password. | Given a valid email and password that meets policy, When the member submits the form, Then a Clerk user and a `Member` DB record are created. |
| R2 | The system SHALL allow a member to create an account via Google or Facebook SSO. | Given the member clicks an SSO button and authorizes the OAuth flow, When Clerk returns a user token, Then a `Member` DB record is created if one does not already exist. |
| R3 | The system SHALL enforce email uniqueness per brand (`brandId` scope). | Given an email already enrolled under the same `brandId`, When a second enrollment attempt is made with the same email, Then the system returns a 409 error and prompts the member to sign in. |
| R4 | The system SHALL require explicit consent capture before creating a Member record. | Given a member has not checked the consent checkbox, When the member attempts to submit the profile form, Then the form is invalid and submission is blocked. |
| R5 | The system SHALL record `consentGivenAt` (datetime) and `consentVersion` (string identifying the policy version) on the Member record at enrollment time. | Given the member submits with consent checked, When the Member record is created, Then `consentGivenAt = now()` and `consentVersion` matches the current deployed policy version. |
| R6 | The system SHALL derive `brandId` from the verified JWT / program context. | Given any enrollment request, When the API processes the request, Then `brandId` is set from `request.auth.brandId` — never from the request body. |
| R7 | The system SHALL publish an `ENROLLMENT` event to the BullMQ queue after creating the Member record. | Given a Member record is created, When the API responds 201, Then an `ENROLLMENT` event is in the BullMQ queue with `memberId` and `brandId`. |
| R8 | The BullMQ worker SHALL evaluate enrollment bonus rules and award points atomically. | Given the program has an enrollment bonus rule (e.g., "Award 500 points on ENROLLMENT"), When the worker processes the event, Then a `LoyaltyEvent` record and an updated `pointsBalance` are written in a single transaction. |
| R9 | The system SHALL send a welcome email to the member after successful enrollment. | Given the ENROLLMENT event is processed, When the worker completes, Then an email is dispatched containing the member's name, program name, and current points balance. |
| R10 | The system SHALL redirect the member to the loyalty dashboard after enrollment. | Given the welcome screen is shown, When the member clicks "Go to my Dashboard", Then they are routed to `/dashboard` authenticated. |
| R11 | The system SHALL write an `AuditEvent` record for each new Member creation. | Given any enrollment (email or SSO), When the Member record is created, Then an `AuditEvent` with `action=MEMBER_CREATED` and `actorId=memberId` is written. |

### Data / State Requirements

| ID | Requirement |
|----|-------------|
| R12 | `Member.email` SHALL be unique within a `brandId` scope (composite unique index on `[email, brandId]`). |
| R13 | `Member.pointsBalance` SHALL only be modified inside a database transaction that also writes a `LoyaltyEvent` record. |
| R14 | `Member.emailOptIn` and `Member.smsOptIn` SHALL default to `false` and only be set to `true` by explicit member action. |
| R15 | `Member.deletedAt` SHALL be used for soft deletes. Hard deletion of Member records is forbidden except as part of a GDPR erasure request. |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| R16 | Enrollment form submission SHALL complete (API responds) in under 3 seconds under normal load. |
| R17 | Enrollment bonus point award SHALL complete (event processed) within 15 minutes of Member creation (consistent with platform SLA). |
| R18 | The enrollment page SHALL be fully accessible: keyboard navigable, ARIA labels on all form inputs, meets WCAG 2.1 AA. |
| R19 | The enrollment form SHALL be responsive and fully usable on mobile viewports (≥ 375px wide). |

### Open Questions

- **OQ-1**: Should `phone` be required or optional? UC-03 marks it optional; confirm with product owner.
- **OQ-2**: Should social login be present in MVP v1 or deferred? Clerk supports it natively but adds OAuth app setup per brand. Recommend shipping email-only first with SSO as a follow-up.
- **OQ-3**: What is the `consentVersion` format? Recommend semver-style string (e.g., `"privacy-v1.0"`) stored in a `SystemConfig` table and read at enrollment time.
- **OQ-4**: Does the enrollment page live on the CustomerEQ-hosted portal or is it embeddable as a widget on the brand's own site? MVP assumption: CustomerEQ-hosted portal only.

---

## API Design

### POST /v1/auth/enroll

```
POST /v1/auth/enroll
Authorization: Bearer <clerk-program-public-token>
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "SecurePass1",      // omit for SSO path
  "clerkToken": "tok_xxx",        // present for SSO path (Clerk returns this post-OAuth)
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+1-555-0100",         // optional
  "emailOptIn": false,
  "smsOptIn": false,
  "consentGiven": true,
  "consentVersion": "privacy-v1.0"
}

→ 201 Created
{
  "memberId": "mbr_xxx",
  "email": "jane@example.com",
  "firstName": "Jane",
  "pointsBalance": 0,             // will update async when enrollment bonus processed
  "programName": "Acme Rewards",
  "enrollmentBonusPending": true  // flag: bonus will arrive within 15 min
}

→ 409 Conflict  (email already enrolled)
{
  "error": "EMAIL_ALREADY_ENROLLED",
  "message": "This email is already enrolled in this program."
}

→ 422 Unprocessable Entity  (consent not given)
{
  "error": "CONSENT_REQUIRED",
  "message": "You must accept the privacy policy and terms to enroll."
}
```

### GET /v1/members/me

```
GET /v1/members/me
Authorization: Bearer <member-jwt>

→ 200 OK
{
  "id": "mbr_xxx",
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "pointsBalance": 500,
  "tier": null,
  "enrollmentDate": "2026-03-28T10:00:00Z",
  "emailOptIn": false,
  "smsOptIn": false
}
```

### Data Flow Diagram

```mermaid
sequenceDiagram
    participant Browser
    participant Next.js (web)
    participant Fastify API
    participant Clerk
    participant PostgreSQL
    participant BullMQ
    participant Worker

    Browser->>Next.js (web): Submit enrollment form
    Next.js (web)->>Clerk: Create user (email+pass or SSO)
    Clerk-->>Next.js (web): Clerk user token
    Next.js (web)->>Fastify API: POST /v1/auth/enroll (+ Clerk token)
    Fastify API->>Clerk: Verify token → extract userId
    Fastify API->>PostgreSQL: BEGIN; INSERT Member; COMMIT
    Fastify API->>BullMQ: Enqueue ENROLLMENT event {memberId, brandId}
    Fastify API-->>Next.js (web): 201 Created {memberId, enrollmentBonusPending}
    Next.js (web)-->>Browser: Show Welcome Screen
    BullMQ->>Worker: Process ENROLLMENT event
    Worker->>PostgreSQL: BEGIN; INSERT LoyaltyEvent; UPDATE Member.pointsBalance; COMMIT
    Worker->>Email Service: Send welcome email
```

---

## Compliance Requirements

> **Note**: Formal compliance regulations are inferred from project context (`docs/architecture/architecture.md` and `fraim/personalized-employee/rules/project_rules.md`) since a formal `fraim/config.json` compliance list is not yet configured. The following controls are required.

### GDPR (EU General Data Protection Regulation)

| Control | Requirement | Implementation |
|---------|-------------|----------------|
| Lawful basis | Processing requires explicit consent at enrollment. | `Member.consentGivenAt` and `Member.consentVersion` recorded at creation time. |
| Privacy notice | Member must see and accept privacy policy before data is collected. | Consent checkbox links to `/privacy-policy`; submission blocked without it. |
| Data minimisation | Only collect fields necessary for loyalty program operation. | Phone is optional; no unnecessary PII collected at enrollment. |
| Right to erasure | Member data must be erasable on request. | Soft delete only (`Member.deletedAt`); erasure job in `apps/worker` zeroes out PII fields (`email`, `firstName`, `lastName`, `phone`) and marks `Member.erasedAt`. |
| Data portability | Member can export their data. | `GET /v1/members/:id/export` returns JSON of all member data. |

### CCPA / CPRA (California Consumer Privacy Act)

| Control | Requirement | Implementation |
|---------|-------------|----------------|
| Right to know | Member must be told what data is collected at point of collection. | Privacy policy linked in enrollment consent checkbox. |
| Right to delete | Member can request deletion of their personal information. | Same erasure infrastructure as GDPR. |
| Opt-out of sale | Do Not Sell My Personal Information option must be accessible. | Footer link on portal pages; `Member.doNotSellOptOut` flag (Phase 1 addition). |
| Opt-in for minors | No enrollment for members under 16 without parental consent. | Age attestation TBD — OQ-5 (deferred to policy review). |

### SOC2 Type 2 (Target Month 12 — Controls from Day 1)

| Control | Requirement | Implementation |
|---------|-------------|----------------|
| Access control | Member accounts must be authenticated before accessing any protected resource. | All API routes except `/v1/public/*` and `/v1/auth/*` require Clerk JWT. |
| Audit logging | All member creation events must be logged. | `AuditEvent` record written on every `MEMBER_CREATED` action (R11). |
| Data encryption | PII at rest must be encrypted. | Azure Database for PostgreSQL has encryption at rest enabled. |
| Secrets management | No secrets in code or env files. | All secrets (Clerk keys, DB credentials) in Azure Key Vault. |

### Compliance Validation

- [ ] Confirm `consentGivenAt` is populated on every Member record created via integration test
- [ ] Confirm consent checkbox is required (E2E: attempt to submit without checking → verify blocked)
- [ ] Confirm `brandId` is never accepted from request body (unit test on API route handler)
- [ ] Confirm `AuditEvent` written on enrollment (integration test)
- [ ] Confirm soft delete works: delete member → `deletedAt` is set, record not hard-deleted

---

## Validation Plan

### How to Know the Feature Is Working

1. **Browser (E2E — Playwright)**
   - Navigate to `/{brandSlug}/enroll`
   - Complete the email+password enrollment flow end-to-end
   - Assert: welcome screen shown, points balance displayed
   - Assert: `/dashboard` accessible after enrollment
   - Assert: attempting to re-enroll with same email shows error

2. **API (Integration — Vitest + Supertest)**
   - `POST /v1/auth/enroll` with valid payload → assert 201, Member record in DB
   - `POST /v1/auth/enroll` with duplicate email → assert 409
   - `POST /v1/auth/enroll` without `consentGiven: true` → assert 422
   - `GET /v1/members/me` with member JWT → assert correct member data returned

3. **Worker (Unit — Vitest)**
   - Enrollment event processed → LoyaltyEvent and pointsBalance updated atomically
   - No enrollment bonus rule → no LoyaltyEvent created, pointsBalance remains 0
   - Enrollment bonus rule present → LoyaltyEvent with correct pointsEarned, pointsBalance updated

4. **Database (Integration)**
   - Confirm composite unique index on `[email, brandId]` prevents duplicate enrollment
   - Confirm `brandId` is always populated (NOT NULL constraint)
   - Confirm `consentGivenAt` is NOT NULL after enrollment

---

## Alternatives

| Alternative | Why Discard? |
|-------------|-------------|
| **In-store / POS enrollment only** (no web portal) | Limits reach to only physical touchpoints; online enrollment is industry standard. |
| **Admin manually creates member records** | Does not scale; puts operational burden on the brand admin; breaks the self-serve model. |
| **OAuth-only enrollment (no email+password)** | Requires members to have a Google or Facebook account; excludes members without social accounts; adds OAuth app setup complexity per brand for MVP. Deferred to OQ-2. |
| **Collect full profile at enrollment** (address, DOB, preferences) | Increases form abandon rate; better practice is to collect minimal data at signup and enrich progressively via Issue #14 (Progressive Profiling, Phase 2). |
| **Sync enrollment bonus points synchronously** (no queue) | Violates project Rule #5 (Event-Driven First); creates a tight coupling between API response time and the rules engine; prevents future horizontal scaling of the worker. |

---

## Competitive Analysis

> Research conducted: 2026-03-28. Methodology: web search of public product pages, help docs, G2 reviews, and vendor comparison blogs. Sources cited below.

### Configured Competitors Analysis

| Competitor | Current Enrollment Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|------------|------------------------------|-----------|------------|-------------------|-----------------|
| **Annex Cloud** | Multi-channel web portal: email or SSO (not confirmed), multi-step wizard. Issues physical/digital loyalty credentials. Welcome email with "wow factor" design and enrollment bonus. | Enterprise-grade: multi-channel (online, in-store, POS), 125+ integrations, configurable templates. | UI is dated; enrollment forms collect too many fields upfront (address, DOB, preferences). Long wizard = high drop-off. | Drop-off rates noted on long forms. Praised for enterprise customisability. | Enterprise-focused; dominant in large retail. Too expensive for mid-market. |
| **Yotpo Loyalty** | Widget-based; relies on Shopify customer accounts. Passwordless sign-up via email verification code (6-digit OTP). Auto-enrollment on purchase or account creation. Configurable enrollment bonus. | Frictionless: no password, no separate account. Seamless Shopify checkout integration. Behavior-based earning (social, reviews, referrals). | Platform-locked: best features only available in Shopify ecosystem. No standalone hosted portal. No explicit GDPR consent workflow in widget. | High NPS from Shopify brands. Mixed reviews from non-Shopify brands. | Strong in D2C e-commerce / Shopify ecosystem. |
| **Smile.io** | Auto-enrolls customers when they create a store account. Minimal fields. Customizable widget and panel (colors, fonts, logo). Pre-translated into 6 languages. Points-on-signup bonus shown prominently in panel. | Cleanest UX; fastest to launch ("minutes, no coding"). SMB-sweet-spot pricing. Fully customizable panel branding. | Limited enterprise configurability. No real-time CX integration. No standalone hosted portal. No GDPR consent management. | Praised for simplicity. Criticised for limited analytics and poor support at scale. | SMB-focused; market leader for small D2C brands. |
| **LoyaltyLion** | Auto-enrollment on store account creation; no separate form. Loyalty popup/widget for on-site enrollment. Customizable sign-up messaging. Point awards for enrollment activity. A/B testing of reward structures built-in. | Strong analytics and churn-prediction focus. A/B testing built in. Customizable messaging. | No SSO (Google/Facebook). No standalone portal. Weak on GDPR consent patterns. | Praised for analytics depth. Criticised for complex setup. | Mid-market; analytics-first positioning. |
| **Zinrelo / TrueLoyal** | Three methods: website (API/JS), store enrollment, CSV batch import. Session authentication via JavaScript. Google SSO + SAML enterprise SSO supported. Points for 100+ activities including profile completion. | Developer-friendly: strong API + JS customization. Google SSO + enterprise SAML. 100+ activity types for earning. | No hosted portal; requires developer resources to embed. Heavy on API; poor no-code experience. | Praised by developers. Criticised by marketers for complexity. | Enterprise/developer-focused. Recently rebranded from Zinrelo. |

### Additional Competitors Analysis

| Competitor | Current Enrollment Solution | Strengths | Weaknesses | Market Position |
|------------|-----------------------------|-----------|------------|-----------------|
| **Shopify Loyalty (native)** | Built into Shopify checkout and customer accounts. Zero-friction enrollment at checkout. | Lowest friction of all: happens at purchase, no extra form. Free / included in Shopify. | Shopify-only. No loyalty program depth (no tiers, no campaigns). | Growing threat to SMB loyalty vendors in Shopify ecosystem. |
| **Salesforce Loyalty Management** | Enterprise cloud enrollment tied to Salesforce CRM. SSO via Salesforce. Deep CRM integration. | Best-in-class CRM integration; enterprise compliance features. | Extremely expensive; 12–18 month implementation. Not viable for mid-market. | Enterprise / Salesforce ecosystem only. |

### Competitive Positioning Strategy

#### Our 5 Differentiation Pillars

1. **Mid-market-priced, enterprise-grade compliance**: The only mid-market platform with GDPR/CCPA consent as a first-class UX element — explicit checkbox, policy versioning, and `consentGivenAt` stored in the database. Annex Cloud has compliance but charges enterprise prices; Smile.io and LoyaltyLion lack it entirely.

2. **Standalone hosted portal (not widget-only)**: All major SMB competitors (Smile.io, Yotpo, LoyaltyLion) are widget-only and require the brand to run its own storefront. CustomerEQ ships a hosted portal (`/{brandSlug}/enroll`) that works for any brand regardless of e-commerce platform. This is the only viable option for mid-market B2B and hospitality brands not on Shopify.

3. **Progressive profiling over front-loaded interrogation**: We collect only `firstName`, `lastName`, `email` at enrollment. Annex Cloud collects address, DOB, and preferences in the wizard. This 3-field approach follows industry research showing 30–50% higher sign-up rates with minimal initial forms. Additional attributes are collected later via Issue #14 (Progressive Profiling, Phase 2).

4. **Enrollment bonus immediately visible**: Welcome screen shows the points balance (or pending-bonus state) before the member navigates away. Smile.io does this well in its widget; Annex Cloud buries it in a welcome email. First moment of value is in-browser, not in an inbox.

5. **Event-driven architecture unlocks real-time bonus delivery**: Enrollment bonus is processed via BullMQ within 15 minutes — the same SLA as the hero feature (Issue #6). Competitors process enrollment bonuses in batch or synchronously. This primes members for the real-time feedback loop that differentiates the platform.

#### Competitive Response Strategy

- **If a customer says "Smile.io is simpler"**: Agree on the SMB simplicity point. Counter that Smile.io requires Shopify, has no GDPR compliance, and cannot connect CX signals (NPS scores, support tickets) to loyalty actions. CustomerEQ is not a widget — it's a platform.
- **If a customer says "Yotpo has passwordless"**: Note that OQ-2 (SSO / passwordless) is on the roadmap. Clerk supports email magic links and passwordless natively — this can be enabled post-MVP without an architectural change.
- **If a customer says "Annex Cloud has more features"**: Agree — Annex Cloud has more features for enterprise clients at enterprise prices. Mid-market brands paying $75K+/yr for Annex Cloud and receiving less than 20% utilisation of those features are the ICP. CustomerEQ delivers the 80% they actually use, at mid-market pricing.

#### Market Positioning

- **Target Segment**: Mid-market brands ($10M–$500M revenue) on any e-commerce platform or no platform, who outgrow Smile.io but are priced out of Annex Cloud.
- **Value Proposition**: Enterprise-grade loyalty enrollment (hosted portal, SSO, GDPR/CCPA, multi-brand) with SMB-level setup speed and UX clarity.
- **Pricing Strategy**: Not public at this stage. Pricing must undercut Annex Cloud's enterprise tier while exceeding Smile.io's feature depth. This positions CustomerEQ firmly in the mid-market whitespace.

### Research Sources

- Annex Cloud product pages and replication analysis: `docs/replicate/reports/REPLICATION_ANALYSIS.md`
- Use case analysis: `docs/replicate/analysis/use-cases.md`
- [Yotpo Loyalty Opt-In Strategies](https://support.yotpo.com/docs/loyalty-opt-in) — 2026-03-28
- [Yotpo vs LoyaltyLion vs Smile.io Comparison](https://www.yotpo.com/blog/yotpo-vs-loyaltylion-vs-smileio/) — 2026-03-28
- [Smile.io Platform Overview](https://smile.io/) — 2026-03-28
- [LoyaltyLion Customer Sign-Up Page](https://help.loyaltylion.com/en/articles/2734155-customer-sign-up-page) — 2026-03-28
- [TrueLoyal/Zinrelo Enrollment Methods](https://help.trueloyal.com/docs/enrolling-members-to-the-loyalty-program) — 2026-03-28
- [Loyalty UX Best Practices — Voucherify](https://www.voucherify.io/blog/loyalty-programs-ux-and-ui-best-practices) — 2026-03-28
- [Progressive Profiling Best Practices — Emarsys](https://emarsys.com/learn/blog/5-progressive-profiling-best-practices-for-driving-customer-loyalty/) — 2026-03-28
- [GDPR & UX Compliance — Econsultancy](https://econsultancy.com/best-practice-ux-gdpr-marketing-consent/) — 2026-03-28
