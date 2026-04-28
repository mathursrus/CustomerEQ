# Feature: Streamline End-to-End CX-to-Loyalty Workflows

Issue: #75
Owner: swavaktp

---

## Customer

**Primary**: Mid-market B2B brand operator (Marketing Manager, Admin / Program Owner) using CustomerEQ to run a loyalty program for their end customers.

**Secondary**: Loyalty Member — the end customer enrolled in a brand's loyalty program who experiences these workflows directly.

---

## Deployment Models & Member Identity

CustomerEQ is B2B infrastructure. End members interact with the **operator's brand** — not CustomerEQ directly. Two deployment models govern how member identity and the member-facing experience are structured. All workflows in this spec default to **Model A** unless explicitly noted.

### Model A — White-label / Embedded (Primary)

The operator owns the member relationship and identity. CustomerEQ's loyalty engine runs transparently behind the operator's digital property; members never encounter the CustomerEQ name.

- **Auth**: The operator's backend authenticates the member and passes a signed JWT to CustomerEQ's API. CustomerEQ maps the external member ID to an internal `memberId`. No separate CustomerEQ account is created.
- **Member surface**: Embeddable React components integrated into the brand's existing web/app property, **or** a CustomerEQ-hosted portal at a brand-configured domain (e.g., `rewards.delta.com`). Only operator branding is visible in either case.
- **Enrollment**: Triggered by the operator's backend via `POST /members`. The member already has a brand account; no member-initiated signup occurs within CustomerEQ.
- **Survey delivery**: Sent from the brand's email domain (e.g., `noreply@delta.com`) using the operator's sending infrastructure. CustomerEQ generates survey content and tracks responses via webhook callback.
- **Target operator**: Mid-market to enterprise brands with an existing member identity system (CRM, e-commerce platform, airline loyalty system, etc.).

### Model B — Hosted Standalone (Outlier)

The operator outsources the full member experience to CustomerEQ. CustomerEQ hosts the portal under the operator's brand — members never see "CustomerEQ."

- **Auth**: CustomerEQ manages member accounts. Operators bulk-provision members via API or allow self-enrollment at the hosted portal.
- **Member surface**: Hosted at `[slug].customereq.com` or a custom CNAME, fully branded as the operator's program (e.g., "Acme Rewards").
- **Enrollment**: Member self-enrolls at the hosted portal, or is pre-provisioned by the operator via bulk import (`POST /members/import`).
- **Survey delivery**: Sent via CustomerEQ's sending domain with the operator's display name (e.g., "From: Acme Rewards &lt;noreply@mail.customereq.com&gt;").
- **Target operator**: Small operators (< 50 employees) with no existing member portal or loyalty infrastructure — full CX/loyalty outsourced to CustomerEQ.

### Comparison

| Aspect | Model A — White-label / Embedded | Model B — Hosted Standalone |
|--------|----------------------------------|-----------------------------|
| Member sees | Operator's existing property (delta.com, Acme app) | Operator-branded portal at CustomerEQ-hosted URL |
| Member account | Existing brand account (JWT passthrough) | CustomerEQ-managed, brand-skinned |
| Enrollment | API call from operator backend | Self-enrollment or operator bulk import |
| Survey sender | Operator's email domain | CustomerEQ sending domain, operator display name |
| Integration effort | Moderate (SDK/API integration by operator dev team) | Low (no-code operator wizard) |
| CustomerEQ visible to member | Never | Never |
| Primary use case | Mid-market → enterprise | SMB with no existing member portal |

---

## Customer's Desired Outcome

**Member (end customer):**
- A new member can enroll, earn their first points, and discover a reward **without needing documentation or support**.
- A CX feedback event (NPS survey, CSAT, review) triggers a visible, personalized loyalty campaign **within 15 minutes**.
- No member-facing workflow has an unhandled loading, empty, or error state.

**Marketing Manager (operator):**
- I can see CX health and loyalty program health **in a single dashboard** — not two disconnected tools.
- When I want to send a survey, the platform tells me **when** to send it, **what type** to use, and **why** — based on what's happening in my loyalty program.
- I can define what loyalty action happens for each survey response **in the same flow** as building the survey — no cross-tool hand-off.
- I can see the full loop — survey sent → response received → campaign triggered → loyalty outcome — **on one screen**, with real-time latency data.

---

## Customer Problem Being Solved

The MVP consists of 7 independent issues (#2–#9), each built in isolation. Without a unified workflow analysis, the following problems will surface at integration time:

**Member-facing problems:**
1. **Enrollment → Earn gap**: Members complete enrollment but the path to earning first points is unclear — no onboarding nudge, no contextual CTA.
2. **Hero flow opacity**: The platform's differentiator (CX event → loyalty campaign in <15 min, Issue #6) is invisible to the member — they don't see that their feedback triggered anything.
3. **Reward discovery dead end**: Members with points don't know rewards exist until they stumble upon the catalog.
4. **Missing UI states**: Loading spinners, empty states, and error messages are unspecified across all 7 MVP issues — each issue owner will implement them inconsistently.

**Operator-facing problems (marketing manager):**
5. **Two disconnected tools in one portal**: CX surveys live in one section; loyalty programs live in another. A marketing manager has no single view that connects "how are my members feeling?" with "what is my loyalty program doing about it?" They must manually correlate data across both tools to make decisions.
6. **No decision support for survey creation**: The platform gives no guidance on *when* to send a survey, *what type* to send, or *how to connect* the survey response to a loyalty action. The manager must figure this out externally, then configure it across two separate workflows.
7. **Response-to-action is a manual hand-off**: After collecting CX feedback, the manager must separately navigate to the campaign builder, recall which members responded, and manually configure what happens next. The connection between "received NPS = 6" and "trigger win-back campaign" is never expressed in one place.
8. **Operator setup maze**: Admins must configure program rules, tiers, rewards catalog, and campaigns in sequence with no guided flow or preview mode.
9. **SLA risk**: The <15-minute feedback-to-action commitment is only enforced in the worker queue (Issue #6). The member-facing confirmation that a campaign was triggered is not defined anywhere.

---

## User Experience That Will Solve the Problem

### Workflow 1: Enrollment → First Earn (Member)

**R1** — The enrollment confirmation screen SHALL display a "Your first earn opportunity" card with a specific action (e.g., "Complete your profile to earn 50 points").

**R2** — The member dashboard SHALL show an "Getting Started" checklist on first login until all onboarding steps are completed or dismissed.

**R3** — The system SHALL send a welcome email within 5 minutes of enrollment containing: current points balance, the top 3 ways to earn, and a link to the rewards catalog. **[Model A]** The email is sent via the operator's email infrastructure using a CustomerEQ-generated template and the operator's configured sender domain. **[Model B]** The email is sent from CustomerEQ's sending domain using the operator's configured display name.

*Given* a member completes enrollment,
*When* they land on the dashboard for the first time,
*Then* they see a non-dismissable Getting Started checklist with at least 3 earn actions and estimated points per action.

**Steps in workflow:**

**[Model A — White-label / Embedded]**
1. Operator backend calls `POST /members` with external member ID + JWT → CustomerEQ creates loyalty profile, emits `member.enrolled` event
2. Operator's portal surfaces the loyalty dashboard (embedded component or hosted at brand domain) → Getting Started checklist visible on first render
3. Member clicks first earn action → context-appropriate earn flow within the operator's surface (purchase link, profile form, survey)
4. System awards points via worker queue → dashboard balance updates within 60 seconds
5. Member sees updated balance + earn notification

**[Model B — Hosted Standalone]**
1. Member submits enrollment form at hosted portal → confirmation screen shows points balance + first earn CTA
2. Member lands on loyalty dashboard → Getting Started checklist visible in main content area
3. Member clicks first earn action → context-appropriate earn flow (purchase link, profile form, survey)
4. System awards points via worker queue → dashboard balance updates within 60 seconds
5. Member sees updated balance + "You earned X points!" toast notification

**UI Mock**: [75-member-onboarding-flow.html](mocks/75-member-onboarding-flow.html)

---

### Workflow 2: Purchase → Points Credited (Member)

**R4** — After a purchase event is received, the member SHALL receive an in-app notification within 15 minutes confirming points awarded, the triggering action, and their new balance.

**R5** — The points history page SHALL display each earn event with: timestamp, action type, points awarded, and rule that triggered it.

**R6** — If a purchase event is received but no rule matches, the system SHALL log the event and display it in history as "Ineligible action — no matching rule" rather than silently dropping it.

*Given* a purchase event is received from a CRM or webhook,
*When* the rules engine evaluates and awards points,
*Then* the member sees a notification within 15 min and the history entry appears within 60 seconds.

---

### Workflow 3: Feedback Submission → Campaign Triggered (Hero — Issue #6)

**R7** — After a member submits a CX feedback event (NPS, CSAT, review), the member SHALL see a confirmation message stating: "Thanks for your feedback — we've added [X] bonus points to your account" or "A special offer is on its way to you."

**R8** — The system SHALL display a campaign notification to the member within 15 minutes of the feedback event being ingested, **regardless of channel** (email, in-app, SMS).

**R9** — The marketing manager SHALL be able to preview exactly what a member will see when their feedback triggers a campaign, before activating the campaign.

**R10** — Campaign trigger latency SHALL be visible in the analytics dashboard as a metric (P50 and P95 feedback-to-notification time).

*Given* a member submits an NPS survey response,
*When* the CX event is ingested and the campaign rule matches,
*Then* the member receives a campaign notification within 15 minutes and sees "feedback received" confirmation on the survey thank-you screen.

---

### Workflow 4: Reward Discovery → Redemption (Member)

**R11** — The member dashboard SHALL display a "Redeem Now" CTA when the member has enough points for at least one reward, showing the specific reward name and cost.

**R12** — The rewards catalog SHALL default to showing rewards the member can afford first, sorted by value descending.

**R13** — Rewards the member cannot yet afford SHALL be visible but visually de-emphasized, with a "X more points needed" label and an earn shortcut CTA.

**R14** — After redemption, the member SHALL see a confirmation screen with: reward name, delivery method, estimated delivery time, and updated points balance.

*Given* a member has 500 points,
*When* they open the rewards catalog,
*Then* rewards costing ≤500 points appear first with "Redeem" buttons; rewards costing >500 points appear below with "X more points needed."

---

### Workflow 5: Tier Progress Visibility (Member)

**R15** — The member dashboard SHALL display a persistent tier progress widget showing: current tier name, points toward next tier, percentage progress, and the top benefit unlocked at the next tier.

**R16** — On tier upgrade, the system SHALL display a full-screen congratulations modal before the member's next page navigation, listing the new benefits.

---

### Workflow 6: Program Configuration → Go Live (Admin)

**R17** — Program setup SHALL be structured as a sequential wizard with 5 named steps: (1) Program Details, (2) Earn Rules, (3) Tiers, (4) Rewards Catalog, (5) Review & Activate.

**R18** — Each wizard step SHALL show a completion indicator and allow navigation back to any previous step without losing data.

**R19** — The Review & Activate step SHALL display a summary of all configured settings and require explicit confirmation before activation.

**R20** — A "Preview as Member" mode SHALL be available from the Review step, showing a simulated member dashboard with the configured program rules applied.

---

### Workflow 7: Campaign Creation → Activation (Marketing Manager)

**R21** — The campaign builder SHALL have a dedicated "CX-Triggered" campaign type that prompts the manager to: select a CX event type (NPS, CSAT, review), set a score threshold, and define the loyalty action (points, reward, message).

**R22** — Before activating a campaign, the manager SHALL see an estimated reach count (number of members who would currently qualify based on their last CX score).

**R23** — After launch, the campaign dashboard SHALL show in real-time: members triggered (count), notifications sent, rewards issued, and current P95 latency.

---

### Workflow 8: Analytics Review → Decision (Manager / Analyst)

**R24** — The analytics dashboard SHALL include a "CX-to-Loyalty Performance" widget with: total campaigns triggered this period, avg feedback-to-action latency, and members retained after campaign (vs. control group).

**R25** — Every dashboard widget SHALL have a defined empty state (e.g., "No campaigns run yet — create your first CX campaign") and a loading skeleton, not a blank white area.

---

### Workflow 9: CRM Integration Setup (IT / Developer)

**R26** — The integration setup flow SHALL include a "Test Connection" step that sends a synthetic test event and confirms it is received and processed correctly before saving credentials.

**R27** — After a successful test, the integration setup SHALL show a sample member record from the connected CRM to confirm field mapping is correct.

---

## Marketing Manager Workflows (Operator Perspective)

> The following workflows address the core operator problem: **CX and loyalty are currently two disconnected tools in one portal.** A marketing manager has no unified view connecting member sentiment to loyalty program health, no decision support for survey strategy, and no single place to define what happens when a member gives a specific response.
>
> These workflows close that gap by introducing a unified CX+Loyalty operator experience.

**UI Mock**: [75-marketing-manager-flow.html](mocks/75-marketing-manager-flow.html)

---

### Workflow 10: Unified CX+Loyalty Dashboard (Marketing Manager)

**The problem today**: The manager opens CustomerEQ and sees two separate sections — "Customer Experience" and "Loyalty Programs" — with no connection between them. They must mentally stitch together NPS scores from one view and redemption rates from another to understand program health.

**R28** — The marketing manager's home dashboard SHALL display a unified "Program Health" view with two side-by-side panels: **CX Health** (avg NPS, active surveys, response rate, at-risk segment size) and **Loyalty Health** (active members, points issued this week, redemption rate, campaigns active).

**R29** — The unified dashboard SHALL surface an "Insights" section that automatically connects CX signals to loyalty outcomes, e.g. "Members who completed the post-purchase survey earned 2.3× more points this month" or "18 detractors (NPS < 7) have not redeemed a reward in 30 days — consider a win-back campaign."

**R30** — From any CX metric on the dashboard (e.g. "18 detractors"), the manager SHALL be able to click through directly to a pre-filtered campaign builder scoped to that segment — without navigating to a separate tool.

*Given* a marketing manager logs into CustomerEQ,
*When* they land on the home dashboard,
*Then* they see CX health and loyalty health in the same view, with at least one AI-generated insight connecting a CX signal to a loyalty opportunity.

---

### Workflow 11: Survey Strategy — When, What Type, and Why (Marketing Manager)

**The problem today**: The manager must decide externally when to send a survey and what type to use. CustomerEQ provides no decision support. Surveys are disconnected from loyalty moments (tier upgrades, redemptions, purchase milestones).

**R31** — The "Create Survey" flow SHALL open with a **Survey Trigger** step before any survey content is configured. The trigger step SHALL offer three categories:
  - **Loyalty moment** (e.g., after tier upgrade, after first redemption, after N purchases, after enrollment)
  - **CX moment** (e.g., after a support interaction, X days after last purchase, when member goes inactive)
  - **Scheduled / recurring** (e.g., quarterly NPS pulse to all active members)

**R32** — After selecting a trigger, the system SHALL recommend a survey type with a one-line rationale:
  - Loyalty moment → **CSAT** ("How satisfied were you with [tier upgrade/reward redemption]?") — measures the quality of the specific loyalty interaction
  - Churn risk / inactivity → **NPS** ("How likely are you to recommend us?") — measures overall relationship health
  - Post-support / high-effort interaction → **CES** (Customer Effort Score) — measures friction
  - Scheduled pulse → **NPS** — standard relationship benchmarking

**R33** — The trigger step SHALL show a live preview of the estimated send volume: "Based on your current program, this trigger would reach ~240 members per month."

**R34** — The manager SHALL be able to override the recommended survey type with a one-click option, with the rationale displayed as a tooltip rather than hidden.

*Given* a manager clicks "Create Survey,"
*When* they reach the trigger step,
*Then* they see 3 trigger categories, selecting one surfaces a recommended survey type with rationale and estimated reach — all before they write a single survey question.

---

### Workflow 12: Response-to-Action Rule Builder — Closing the CX-to-Loyalty Loop (Marketing Manager)

**The problem today**: After a survey is configured, the manager must separately navigate to the campaign builder, recall which members responded with which score, and manually build a campaign. The connection between "NPS response" and "loyalty action" is never expressed in one place. This is what makes CX and loyalty feel like two disconnected tools.

**R35** — The survey builder SHALL include a **"What happens next?"** step (after survey content is configured but before launch) where the manager defines response-to-action rules inline, without leaving the survey flow:
  - Score range → loyalty action mapping (e.g., NPS 0–6 → "Win-back campaign: 100 bonus points + personal apology message"; NPS 7–8 → "Engagement nudge: 25 points + new feature highlight"; NPS 9–10 → "Referral campaign: invite a friend, earn 200 points")
  - Each rule shows: trigger condition, loyalty action type, estimated member count, and expected cost in points

**R36** — The response-to-action rules SHALL be saved as a named **CX Playbook** that can be reused across future surveys (e.g., "Standard NPS Playbook," "Post-Redemption CSAT Playbook").

**R37** — Once a survey with response-to-action rules is live, the manager SHALL see a real-time **Loop Monitor** showing the full pipeline:
  - Surveys sent → Responses received (with score distribution) → Rules matched → Campaigns triggered → Loyalty outcomes (points awarded, redemptions, retention rate)
  - This is a single screen — the manager never needs to cross-reference two separate tools to understand whether the loop is working.

**R38** — If a response-to-action rule has triggered 0 campaigns within 48 hours of the first responses arriving, the system SHALL surface a warning: "No campaigns triggered yet — check your rule conditions or member consent settings."

*Given* a manager has built a survey with response-to-action rules and launched it,
*When* they open the Loop Monitor,
*Then* they see a single pipeline view: surveys sent → responses → rules matched → campaigns triggered → loyalty outcomes, all on one screen.

---

### Workflow 13: Survey Results as a Loyalty Signal (Marketing Manager)

**R39** — Survey response data (score + free-text sentiment) SHALL be visible on each member's loyalty profile, enabling the manager to see "Alex gave NPS 6 last month — currently in Bronze tier, last redeemed 45 days ago" in one place.

**R40** — The segmentation builder SHALL support CX attributes as filter criteria: segment by NPS score range, CSAT score, last survey date, and survey completion status — alongside existing loyalty attributes (tier, points balance, last redemption date).

*Given* a manager opens the segmentation builder,
*When* they add filter criteria,
*Then* CX attributes (NPS score, last survey response date, sentiment) appear in the same filter panel as loyalty attributes (tier, points, redemption history).

---

## Friction Inventory

| # | Location | Friction | Priority | Resolving Requirement |
|---|----------|----------|----------|-----------------------|
| F1 | Post-enrollment | No earn CTA after signup | P0 | R1, R2 |
| F2 | Member dashboard | No empty state defined | P0 | R25 |
| F3 | Hero flow (Issue #6) | Member gets no confirmation that feedback was received | P0 | R7, R8 |
| F4 | Rewards catalog | Unaffordable rewards shown equally with affordable | P1 | R12, R13 |
| F5 | Tier widget | No progress bar in current specs | P1 | R15 |
| F6 | Campaign builder | No CX-triggered campaign type wizard | P0 | R21 |
| F7 | Program setup | No wizard flow — all settings on one page | P1 | R17, R18 |
| F8 | Analytics | No latency metric for hero SLA | P0 | R10, R24 |
| F9 | CRM setup | No test-connection step | P1 | R26, R27 |
| F10 | Points history | Silent drop of ineligible events | P1 | R6 |
| F11 | Operator home | CX and loyalty shown as two disconnected sections | P0 | R28, R29, R30 |
| F12 | Survey creation | No decision support for when/what type of survey | P0 | R31, R32, R33 |
| F13 | Survey + campaign builder | Response-to-action is a manual cross-tool hand-off | P0 | R35, R36, R37 |
| F14 | Member profile | CX signals not visible alongside loyalty data | P1 | R39 |
| F15 | Segmentation builder | CX attributes not available as filter criteria | P1 | R40 |

---

## Compliance Requirements

Based on `fraim/config.json` compliance settings (GDPR, CCPA, SOC2 target, PCI minimal scope):

**GDPR / CCPA**
- **R-C1**: CX feedback data (NPS scores, CSAT ratings, free-text comments) is PII-adjacent. It SHALL be stored with `brandId` scoping and subject to the member erasure job in `apps/worker`. Free-text survey responses must be zeroed on erasure request.
- **R-C2**: The welcome email (R3) and campaign notification (R8) SHALL include an unsubscribe link and reference the brand's privacy policy URL.
- **R-C3**: Members who have not given consent (`consentGivenAt IS NULL`) SHALL NOT receive campaign notifications triggered by CX events. The campaign trigger logic SHALL check `Member.consentGivenAt` before enqueueing any notification. **[Model A]** Consent is typically captured at the operator's brand level; the operator SHALL pass `consentGivenAt` as a parameter in the `POST /members` enrollment call. CustomerEQ SHALL NOT treat a null `consentGivenAt` as implicit consent in any model.
- **R-C4**: The CRM integration (Workflow 9) SHALL never store raw CRM credentials in the database in plaintext. Credentials must be stored via Azure Key Vault and referenced by secret name only.

**SOC2 (target)**
- **R-C5**: All loyalty actions triggered by CX events SHALL produce an immutable audit log entry (`LoyaltyEvent` record) with: timestamp, memberId, brandId, triggering event source, action taken, and agent identity.
- **R-C6**: The feedback-to-action latency metric (R10) SHALL be derived from the audit log timestamps, ensuring the audit log is the authoritative source of truth for SLA compliance.

**PCI (minimal scope)**
- **R-C7**: Rewards involving monetary value (gift cards, cashback) SHALL display the monetary value clearly and be handled through a PCI-compliant redemption flow. No card numbers or payment credentials may pass through CustomerEQ systems.

**Compliance Validation**:
- [ ] Erasure job in `apps/worker` covers CX feedback text fields
- [ ] Campaign trigger queries filter on `consentGivenAt IS NOT NULL`
- [ ] `LoyaltyEvent` audit records exist for all campaign-triggered actions
- [ ] CRM credentials stored in Key Vault, not in `integrations` table

---

## Validation Plan

**Member workflows — Browser validation** (Playwright):
- [ ] New member enrollment → assert Getting Started checklist visible on first dashboard load
- [ ] Submit NPS feedback → assert campaign notification appears within 15 minutes
- [ ] Points balance → assert "Redeem Now" CTA appears when affordable reward exists
- [ ] Tier progress widget → assert progress bar reflects correct points-to-next-tier
- [ ] Program setup wizard → assert all 5 steps navigable and Preview mode renders

**Marketing manager workflows — Browser validation** (Playwright):
- [ ] Operator home dashboard → assert CX Health panel and Loyalty Health panel appear side-by-side
- [ ] Operator home dashboard → assert at least one AI insight connecting a CX metric to a loyalty action is visible
- [ ] Clicking a CX metric (e.g. "34 detractors") → assert navigates to pre-filtered campaign/segment builder
- [ ] Create Survey step 1 → assert 3 trigger category cards appear before any survey content is shown
- [ ] Selecting "Loyalty Moment" trigger → assert system surfaces a recommended survey type with rationale
- [ ] Estimated reach badge → assert shows member count estimate before proceeding to content
- [ ] Response-to-action step → assert rules are configurable inline without navigating away from survey builder
- [ ] Launch survey with rules → assert Loop Monitor pipeline is visible (surveys sent → responses → rules matched → campaigns → outcomes)
- [ ] Segmentation builder → assert CX attributes (NPS score, survey date) appear in same filter panel as loyalty attributes

**API validation**:
- [ ] POST a CX feedback event → assert `LoyaltyEvent` record created within 15 min (poll `GET /events/{id}`)
- [ ] POST enrollment for member without consent → assert campaign notifications are NOT sent
- [ ] GET rewards catalog → assert affordable rewards appear before unaffordable
- [ ] GET operator dashboard → assert response includes both `cxHealth` and `loyaltyHealth` sections
- [ ] POST survey with response rules → assert matching `CampaignTrigger` records created per rule

**SLA validation**:
- [ ] Run 50 synthetic CX events → assert P95 latency < 15 minutes in campaign dashboard

---

## Alternatives

| Alternative | Why Discarded |
|-------------|---------------|
| Document friction as GitHub comments on each MVP issue | Scattered — no single owner, no prioritization, no cross-issue view of the member journey |
| Wait until after MVP ships and fix UX in a polish sprint | Hero SLA confirmation (R7, R8) and consent check (R-C3) are P0 blockers — they cannot wait |
| Build a full design system first | Out of MVP scope; shadcn/tailwind v4 generic baseline is sufficient |
| Hire a UX designer to run a formal usability study | No users yet; this spec is the lightweight substitute until real user data exists |

---

## Competitive Analysis

*Research date: March 31, 2026. Sources: official product pages, G2, Capterra, user reviews (2025–2026).*

### Competitor Matrix

| Competitor | CX→Loyalty Automation | Member Confirmation UX | Operator Self-Serve | Target Market | Pricing |
|------------|----------------------|------------------------|---------------------|---------------|---------|
| **Annex Cloud** | 40+ integrations; AI-based triggers; ~82hr avg latency; no real-time CX loop | Email/notification triggers; reward dashboard; UX details not public | ❌ Requires implementation services; 8–12 week deployment; $20K–$50K integration cost | Enterprise, mid-market | $15K–$75K+/yr |
| **Yotpo** | NPS/CSAT tools + email triggers; review → points automation; AI sentiment tagging | Transactional emails; on-screen coupon codes; customizable notifications | ⚠️ Self-serve for standard setups; complex configs need support; ~$3,500 specialist hire common | SMB–mid-market (Shopify-first) | $368/mo Pro+ |
| **Smile.io** | Basic: review points via REVIEWS.io integration; Shopify Flow for custom triggers | Automatic email on earn/redeem; coupon in "Your Rewards" panel | ✅ Fully self-serve; no-code; setup in minutes | SMB–early mid-market | Free tier; paid from ~$49/mo |
| **Loyalty Lion** | NPS collection + "At Risk" segmentation; post-purchase review requests; not real-time CX automation | Reward available email (throttled); on-site notification; intelligent email frequency limits | ✅ Free tier self-serve; Classic+ has dedicated onboarding manager | SMB–mid-market (Shopify) | Free–$159/mo; enterprise custom |
| **Antavo** | API-driven; Workflows editor; AI (Timi AI); no dedicated NPS/CSAT — feedback via gamified surveys | Reward claim email on redemption; workflow-assigned coupons; modern implementations route through customer's marketing system | ✅ No-code Workflows editor; Blueprint templates; IT-free program changes | Enterprise–mid-market | Custom enterprise pricing |

### Key Findings

**CX-to-Loyalty Automation Gap (our hero)**
- No competitor offers automatic, sub-15-minute CX feedback → loyalty campaign triggering out of the box
- Yotpo is closest (NPS + triggers) but focuses on email collection, not real-time campaign firing
- Annex Cloud has the integrations but requires 8–12 weeks of professional services to configure them
- Loyalty Lion does NPS collection and "At Risk" segmentation — but not automated campaign response

**Member Confirmation UX**
- Yotpo and Smile.io have the most clearly documented member confirmation UX (transactional emails, on-screen codes)
- Annex Cloud and Loyalty Lion document capabilities but not specific UX flows — a signal of operator complexity
- **Gap we fill**: R7, R8 specify that the member SEES the feedback loop closed ("your feedback triggered a reward") — no competitor explicitly confirms this is visible to the member

**Operator Self-Serve**
- Smile.io and Antavo are leaders in no-code self-serve
- Annex Cloud requires implementation services — a direct moat we can exploit for mid-market
- Yotpo is self-serve for basics but requires external help at scale (complex configs, multi-product stack)

**Mid-Market Pain Points We Solve**
| Pain Point | Competitor Affected | Our Solution |
|------------|--------------------|----|
| 82hr+ feedback-to-action latency | All (Annex Cloud worst) | <15 min SLA with dashboard proof (R10, R24) |
| Requires implementation services | Annex Cloud, Yotpo (complex) | Self-serve campaign wizard (R21) |
| No member-visible CX loop closure | All competitors | "Feedback received → campaign triggered" confirmation (R7, R8) |
| No SLA transparency for operators | All competitors | P50/P95 latency metric in dashboard (R10) |
| Unaffordable reward discovery confusion | Smile.io, Loyalty Lion | Affordable-first catalog with earn shortcut CTAs (R12, R13) |

### Competitive Positioning Strategy

**Our 3 Differentiation Pillars**:
1. **Real-time CX loop (<15 min)**: Industry average is 82 hours. CustomerEQ is the only platform that closes the feedback-to-loyalty loop automatically, in real time.
2. **Self-serve mid-market operator UX**: The CX-triggered campaign wizard (R21) and program setup wizard (R17) require zero engineering — Annex Cloud's equivalent takes 8–12 weeks and $20–50K.
3. **Verifiable SLA**: The latency dashboard metric (R10, R24) gives operators proof of the <15-min commitment. No competitor offers an operator-facing SLA dashboard.

**Objection Handling**:
- *"Yotpo already does NPS + loyalty"* → Yotpo collects NPS but does not auto-trigger loyalty campaigns from scores. The operator must manually set up email sequences; there is no <15-min campaign trigger.
- *"Annex Cloud has more integrations"* → Annex Cloud's integrations require 8–12 weeks of professional services. CustomerEQ's CRM integration wizard (R26, R27) is self-serve with a test-connection step.
- *"Antavo's Workflows editor is no-code"* → Antavo's no-code editor is powerful but requires a cross-functional implementation team (Marketing + IT + Finance). CustomerEQ targets marketing managers working alone.

**If a competitor adds real-time CX triggering**: Our moat shifts to operator simplicity and mid-market pricing. Annex Cloud's complexity and enterprise pricing ($15K–$75K+/yr) make self-serve CX campaigns structurally infeasible for mid-market buyers even if they add the feature.

**Target Segment**: Mid-market brands (50–5,000 employees) with an existing CX feedback tool (Qualtrics, Medallia, SurveyMonkey) who want to convert detractors and passives into loyalists automatically — without an implementation project.

### Research Sources
- Official product pages: annexcloud.com, yotpo.com, smile.io, loyaltylion.com, antavo.com (March 2026)
- G2 and Capterra user reviews (2025–2026)
- `docs/replicate/analysis/use-cases.md` — full UC inventory from Annex Cloud replication study
- `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md`
