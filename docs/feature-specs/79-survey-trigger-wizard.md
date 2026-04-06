# Feature: Survey Trigger Wizard — Decision Support for When and What Type of Survey to Send

Issue: #79
Owner: swavaktp

---

## Customer

**Primary**: Marketing Manager at a mid-market brand using CustomerEQ to run a loyalty program. They own CX measurement strategy but do not have a research background — they need the platform to guide them.

**Secondary**: Program Admin who wants to ensure surveys are tied to specific loyalty lifecycle moments rather than sent ad-hoc.

---

## Customer's Desired Outcome

When I want to send a survey, the platform tells me **when** to send it, **what type** to use, and **why** — based on what's happening in my loyalty program — so that I can make the right CX measurement decision without needing a research background.

After completing this wizard step, I know:
1. Which event in my loyalty program will trigger the survey send
2. What survey type is recommended and why (with the ability to override)
3. Approximately how many members will receive it in the next 30 days

---

## Customer Problem Being Solved

Today, CustomerEQ gives no guidance on when to send a survey or what type to use. The manager must:
1. Decide externally (based on intuition or a research background) what trigger and survey type to use
2. Navigate to the survey builder and configure content — with no context about the trigger
3. Separately configure a campaign/loyalty action for each response tier — in a completely different workflow

This creates two concrete gaps:
- **Survey strategy gap**: Without guidance, managers default to batch quarterly NPS sends, which have low response rates and capture no loyalty-moment context
- **Disconnection gap**: The survey has no tie to the loyalty moment that would make the feedback meaningful (e.g., a tier upgrade)

The Survey Trigger Wizard closes the strategy gap by inserting a **Step 1** before survey content creation that guides trigger selection, recommends the right survey type, and shows projected reach — all before a single question is written.

---

## User Experience That Will Solve the Problem

### UX Flow

1. **Marketing manager clicks "+ New Survey"** from the Surveys list or the unified dashboard
2. **Survey creation opens at Step 1: Survey Trigger** (this issue). The survey builder (Step 2) is not shown yet.
3. **Step 1 presents three trigger category cards** (full-width grid):
   - ⭐ **Loyalty Moment** — after a key loyalty event (tier upgrade, first redemption, milestone purchase, enrollment)
   - 📉 **CX Risk Moment** — when a member shows churn signals (inactive X days, NPS drop, after support interaction)
   - 📅 **Scheduled / Recurring** — regular pulse (quarterly NPS, monthly CSAT, annual satisfaction)
4. **Manager clicks a category** → category card highlights; a **sub-trigger picker** appears below showing specific options within that category (e.g., for Loyalty Moment: "Tier Upgrade", "First Redemption", "5th Purchase", "1-Year Anniversary", "Profile Completed")
5. **Manager selects a specific sub-trigger** → system immediately shows a **recommendation box**:
   - Recommended survey type (CSAT / NPS / CES)
   - One-line rationale explaining the recommendation
   - "Use a different type instead ↓" link that expands an inline type picker (NPS / CSAT / CES / Custom) — no navigation required
6. **Reach estimate badge** appears below the recommendation: _"Based on your current program, this trigger would reach ~47 members in the next 30 days"_ with a delivery preview breakdown (email / in-app / SMS)
7. **Manager clicks "Continue: Design Questions →"** — proceeds to the existing survey builder (Step 2)
8. The selected trigger and survey type are **persisted on the survey record** and shown in:
   - The survey summary card on the survey list page
   - The survey detail/analytics page header
   - The Review & Launch step (Step 4)

**UI Mock**: [79-survey-trigger-wizard.html](mocks/79-survey-trigger-wizard.html)

**Design Standards**: Generic UI baseline applied — indigo (`#6366f1`) primary, zinc neutrals, 12px border-radius cards, matching the existing CustomerEQ admin shell established in `75-marketing-manager-flow.html`.

### Trigger → Survey Type Recommendation Mapping

| Trigger Category | Specific Trigger | Recommended Type | Rationale |
|-----------------|-----------------|-----------------|-----------|
| Loyalty Moment | Tier Upgrade | CSAT | Measures quality of the specific upgrade experience — moment-level quality, not overall relationship health |
| Loyalty Moment | First Redemption | CSAT | Captures the reward experience at peak satisfaction — ideal for product-specific feedback |
| Loyalty Moment | N-th Purchase | CSAT | Measures the purchase interaction quality at a defined milestone |
| Loyalty Moment | Enrollment | CES | Measures how easy the enrollment process was — friction is the key signal at this stage |
| Loyalty Moment | Anniversary | NPS | After 1 year, an overall relationship health check is appropriate |
| CX Risk Moment | Member Inactive X Days | NPS | Measures overall relationship health to understand churn risk |
| CX Risk Moment | NPS Drop Detected | NPS | Follow-up NPS confirms whether the drop was transient or structural |
| CX Risk Moment | After Support Interaction | CES | Customer Effort Score measures friction — the primary signal after a support touchpoint |
| Scheduled | Quarterly Pulse | NPS | Standard relationship benchmarking cadence |
| Scheduled | Monthly CSAT | CSAT | Tracks satisfaction trend across a shorter window |
| Scheduled | Annual Program | NPS | Annual strategic health check of the overall program |

### Wizard Step Structure (Full Survey Creation Flow)

| Step | Name | Scope |
|------|------|-------|
| 1 | Survey Trigger | **This issue — trigger selection, type recommendation, reach estimate** |
| 2 | Survey Content | Existing survey builder (#35) |
| 3 | Response Rules | Response-to-action loyalty rules (future issue) |
| 4 | Review & Launch | Confirm trigger, type, questions, rules, schedule |

### Requirements (R31–R34 from #75)

**R31** — The "Create Survey" flow SHALL open with a **Survey Trigger** step (Step 1) before any survey content is configured. The trigger step SHALL display three category cards:
- Loyalty Moment (after tier upgrade, after first redemption, after N purchases, after enrollment)
- CX Risk Moment (member inactive for X days, after support interaction, NPS drop)
- Scheduled / Recurring (quarterly NPS pulse, monthly CSAT)

*Given* a manager clicks "+ New Survey",
*When* the survey creation page loads,
*Then* Step 1 (Survey Trigger) is shown first — no question editor is visible until Step 1 is completed.

**R32** — After selecting a specific sub-trigger, the system SHALL display a recommended survey type with a one-line rationale, using the mapping table above.

*Given* a manager selects "Tier Upgrade" from the Loyalty Moment category,
*When* the sub-trigger is selected,
*Then* the recommendation box shows "CSAT — Customer Satisfaction Score" with the rationale: "After a tier upgrade, members are at peak engagement. A CSAT survey measures satisfaction with the upgrade experience specifically."

**R33** — The trigger step SHALL display a live estimated reach: _"Based on your current program, this trigger would reach ~N members in the next 30 days"_ with a delivery channel breakdown (email / in-app / SMS counts).

*Given* a manager has selected a specific sub-trigger,
*When* the reach estimate is computed,
*Then* the badge shows the projected member count based on the program's historical event frequency over the past 30 days, with channel opt-in breakdown.

**R34** — The manager SHALL be able to override the recommended survey type with one click. The override UI SHALL be inline (no navigation). The original rationale SHALL remain visible as a tooltip or collapsed text, not hidden.

*Given* a manager clicks "Use a different type instead ↓",
*When* the override picker appears,
*Then* the manager can select NPS, CSAT, CES, or Custom; the rationale is shown as a note beneath the selection, not removed.

### Additional Requirements

**R35** — The selected trigger category, sub-trigger, and final survey type (recommended or overridden) SHALL be persisted on the survey record and displayed in the survey list, detail page, and Review & Launch step.

*Given* a manager completes Step 1 and proceeds,
*When* they view the survey summary later,
*Then* the trigger label (e.g., "Loyalty Moment: Tier Upgrade") and type (e.g., "CSAT") are visible.

**R36** — The reach estimate SHALL be computed server-side using the program's historical event frequency (events of the selected type in the last 30 days). If historical data is insufficient (< 7 days of history), the system SHALL display "Estimated reach unavailable — not enough historical data" rather than a potentially misleading number.

**R37** — Sub-trigger options for "Loyalty Moment" SHALL be dynamically loaded from the program's configured earn rules and tiers — not a static list. If no earn rules are configured, the category SHALL be shown but the sub-trigger picker SHALL display "No loyalty moments configured yet — [Set up earn rules]" with a link to program setup.

### Error States

| State | Behavior |
|-------|----------|
| No trigger selected and manager clicks Continue | Show inline validation: "Please select a trigger before continuing" |
| No sub-trigger selected within a category | Show inline validation on the sub-trigger picker: "Select a specific moment" |
| Reach estimate API fails | Show "Reach estimate unavailable" in the badge area — do not block Continue |
| Program has no earn rules (dynamic sub-triggers empty) | Show "No loyalty moments configured" with link — category is still selectable but Continue is blocked until a different category is chosen |
| Override picker open but no type selected | Disable Continue — require selection |

---

## Compliance Requirements

No PII is collected or exposed in this wizard step. The reach estimate computation uses aggregate member counts only — no individual member data is returned to the frontend. No HIPAA, SOC2, or GDPR-specific controls apply to this UI feature beyond the platform-level controls already in place.

---

## Validation Plan

1. **Browser validation** (Playwright E2E):
   - Navigate to "+ New Survey" → confirm Step 1 loads first (no question editor visible)
   - Select "Loyalty Moment" → confirm sub-trigger picker appears
   - Select "Tier Upgrade" → confirm recommendation box shows "CSAT" with rationale
   - Confirm reach badge appears with a number or the "unavailable" fallback
   - Click "Use a different type instead ↓" → confirm inline picker appears, rationale stays visible
   - Select override type → click Continue → confirm Step 2 (survey builder) loads
   - Complete flow → confirm trigger + type appear in the survey summary

2. **API validation** (integration test):
   - `GET /v1/analytics/reach-estimate?trigger=tier_upgrade` returns `{ estimatedCount: N, channels: { email: N, inApp: N, sms: N } }`
   - With no historical data: returns `{ estimatedCount: null, reason: "insufficient_history" }`

3. **Unit validation**:
   - `getTriggerRecommendation(triggerKey)` returns correct type + rationale for all 11 trigger combinations
   - Edge case: unknown trigger key returns `{ type: 'nps', rationale: '...', isDefault: true }`

---

## Alternatives

| Alternative | Why Discard? |
|-------------|-------------|
| Show survey type selector on the existing survey builder page (no wizard step) | Doesn't address the core problem — manager still has no guidance on *when* to send or *why* a type fits the moment. Survey type in isolation is not actionable. |
| Pop-up / modal for trigger selection instead of a full wizard step | A modal can't show the full sub-trigger picker + recommendation + reach estimate + override inline. The content is too rich for a modal; a full step is warranted. |
| AI chatbot-style guided flow | Higher engineering complexity, slower interaction, and doesn't match the existing admin UI pattern (wizard steps are already established). |
| Static documentation / tooltip explaining survey types | Passive. Managers won't read it. The platform should make the right choice obvious and contextual, not document-based. |

---

## Competitive Analysis

### Configured Competitors Analysis

| Competitor | Current Solution | Strengths | Weaknesses |
|------------|-----------------|-----------|------------|
| Qualtrics | Advanced survey type selection with methodology guides | Extremely detailed methodology docs; supports every survey type | Requires CX research expertise to navigate; no loyalty program integration |
| Typeform | Simple "Create new form" → pick template | Beautiful UX, low friction | No trigger-based distribution; no recommendation engine; no loyalty integration |
| SurveyMonkey | Template picker by use case (NPS, CSAT, etc.) | Use-case templates help beginners | No event-triggered distribution; no loyalty moment context; no reach estimates |
| Medallia | Journey-based survey triggers tied to CX events | Strong enterprise journey mapping; CX event integration | Complex setup requiring professional services; no native loyalty integration |

### Additional Competitors Analysis

| Competitor | Current Solution | Strengths | Weaknesses |
|------------|-----------------|-----------|------------|
| Delighted | Trigger-based NPS (Shopify purchase, Zendesk ticket) | Simple setup; smart defaults (NPS after purchase) | Single survey type (NPS); no loyalty program awareness; no override with rationale |
| Yotpo | Post-purchase review + loyalty in one platform | Native integration between reviews and loyalty points | Reviews only; no NPS/CSAT/CES decision support |

### Competitive Positioning Strategy

#### Our Differentiation
- **Loyalty-moment context**: No competitor ties survey trigger recommendations to the loyalty program lifecycle (tier upgrades, redemptions, milestone purchases). CustomerEQ is the only platform where a loyalty event drives survey strategy.
- **Rationale transparency**: We show *why* we recommend a type, not just what to pick. This educates managers over time, not just in this moment.
- **Reach estimate before commitment**: Managers see projected impact before designing a single question — preventing wasted effort on unreachable segments.

#### Market Positioning
- **Target Segment**: Mid-market loyalty operators who want CX measurement embedded in loyalty workflows, not as a separate tool
- **Value Proposition**: The platform recommends the right survey at the right loyalty moment — so managers with no research background can measure what matters without guesswork

### Research Sources
- Qualtrics, SurveyMonkey, Typeform, Delighted, Medallia product documentation — April 2026
- Issue #75 spec (`docs/feature-specs/75-cx-loyalty-workflow-streamlining.md`) — R31–R34
- Existing mock `docs/feature-specs/mocks/75-marketing-manager-flow.html` Scenario 5
