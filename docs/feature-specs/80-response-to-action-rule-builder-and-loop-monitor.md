# Feature: Response-to-Action Rule Builder and Loop Monitor

Issue: #80
Owner: swavak@gmail.com

---

## Customer

**Primary**: Marketing Manager at a mid-market brand using CustomerEQ to run a loyalty program. They own the CX-to-loyalty strategy and need a single workflow — not two separate tools — to close the feedback loop. They do not have a technical or research background; they need the platform to guide them from survey response to loyalty outcome without leaving the survey creation flow.

**Secondary**: Program Admin who needs confidence that every live survey with defined rules is actually triggering the expected campaigns, and needs a way to audit the pipeline without opening the campaign builder separately.

---

## Customer's Desired Outcome

When I build a survey, I can define — right there in the wizard — exactly what loyalty action fires for each response score tier. I can save that set of rules as a reusable playbook so I never have to rebuild it for the next survey. Once the survey is live, I have a single screen that shows me the full loop from "survey sent" to "loyalty outcome," including latency, so I never have to cross-reference the campaign builder or the analytics dashboard to know whether the loop is working.

After completing this feature, the manager knows:
1. Which loyalty action fires for each score range (e.g., NPS 0–6 → Win-back campaign)
2. The estimated member count and point cost for each rule before launch
3. Whether the pipeline is working post-launch — on one screen, with P50/P95 latency and a 48-hour warning if nothing has triggered

---

## Customer Problem Being Solved

Today, CustomerEQ requires a marketing manager to perform a five-step manual hand-off to close the CX-to-loyalty loop:
1. Build a survey in the survey builder
2. Note the survey ID
3. Navigate to the campaign builder
4. Recall which score ranges they want to act on
5. Build one campaign per score tier — with no reference back to the survey

This cross-tool hand-off means:
- Rules are frequently forgotten or misconfigured because there is no in-context prompt to define them while building the survey
- The manager has no way to see whether the loop is working without opening both the survey analytics page and the campaign dashboard in separate tabs
- There is no 48-hour early-warning when a rule is silently failing (e.g., wrong score range, no member consent)
- Playbooks built for one survey cannot be reused — every new survey requires rebuilding from scratch

Issue #80 solves this by inserting Step 3 ("What happens next?") and Step 4 ("Review & Launch") into the survey wizard established in #79, and by adding a Loop Monitor view to the survey detail page post-launch — so the manager never leaves the survey context to close the loop.

---

## Requirements

### R35 — Rule Builder Step ("What happens next?")

The survey wizard SHALL include a **Step 3: "What happens next?"** screen — positioned after survey content (Step 2) and before review (Step 4) — where the manager defines response-to-action rules entirely inline without navigating to the campaign builder.

Each rule row SHALL display:
- **Score range selector**: a from/to range picker constrained to the survey type's valid scale (NPS: 0–10, CSAT: 1–5, CES: 1–7), rendered as a colored score pill (red for low, amber for mid, green for high)
- **Action type picker**: a dropdown limited to the six supported `actionType` values: `award_points`, `award_reward`, `send_message`, `spin_wheel`, `scratch_card`, `mystery_box`
- **Action config panel**: contextual inline form that appears when an action type is selected — for `award_points` shows a points input; for `award_reward` shows a reward selector; for `send_message` shows subject + body; for mechanic types (`spin_wheel`, `scratch_card`, `mystery_box`) shows a campaign name field that maps to an existing campaign record
- **Estimated member count**: a live badge showing how many members from the current program have a last-recorded score in this range, computed server-side from `SurveyResponse.score` history for this survey type
- **Expected point cost**: a computed field showing `estimated_member_count × points_per_action` (displayed for `award_points` only; shown as "variable" for reward or mechanic types)

The manager SHALL be able to add multiple rules (via "+ Add rule" button), remove individual rules, and reorder rows. The system SHALL validate that score ranges do not overlap across rules and SHALL display an inline error if overlap is detected.

**Acceptance criteria (R35):**

*Given* a manager has completed Step 2 (survey content) and clicked "Continue: What happens next? →",
*When* Step 3 loads,
*Then* the rule builder is displayed with one pre-populated example rule row appropriate to the survey type (NPS default: Detractors 0–6 → `award_points` 100 pts), an "+ Add rule" button, and the survey type's valid score range clearly labeled.

*Given* a manager selects score range 0–6 and action type `award_points` with 100 points,
*When* the estimated member count is computed,
*Then* the badge displays a member count derived from the program's historical `SurveyResponse.score` distribution for this survey type, or "Insufficient data" if fewer than 10 historical responses exist.

*Given* a manager defines two rules with overlapping score ranges (e.g., 0–6 and 5–8),
*When* they attempt to proceed to Step 4,
*Then* an inline validation error is shown on the overlapping rule rows: "Score ranges must not overlap — adjust the range on one rule."

---

### R36 — CX Playbooks

The system SHALL allow the manager to save the current set of response-to-action rules as a named **CX Playbook** that can be loaded into any future survey of the same type.

A CX Playbook SHALL store:
- A manager-defined name (e.g., "Standard NPS Playbook", "Post-Redemption CSAT Playbook")
- The survey type it applies to (`NPS`, `CSAT`, or `CES`)
- The ordered list of rules — each rule containing: `scoreMin`, `scoreMax`, `actionType`, `actionConfig` (as JSON), and a `ruleLabel` (optional display name)
- `brandId` — playbooks are brand-scoped, not program-scoped, so they can be reused across loyalty programs within the same brand
- `createdAt` and `updatedAt` timestamps

The Step 3 screen SHALL display a **"Load Playbook" dropdown** above the rule builder. When a playbook is loaded, the current rules are replaced by the playbook's rules after a confirmation prompt ("Replace current rules with Standard NPS Playbook?"). The manager SHALL be able to edit the loaded rules before proceeding — loading a playbook does not lock the rules.

Saving a playbook SHALL be available via a **"Save as Playbook"** button adjacent to the rule list. If a playbook with the same name already exists for this brand, the system SHALL prompt: "A playbook named 'Standard NPS Playbook' already exists — overwrite it or save as a new name?"

**API surface (R36):**
- `POST /v1/cx-playbooks` — create a playbook; body: `{ name, surveyType, brandId, rules[] }`
- `GET /v1/cx-playbooks?surveyType=NPS` — list playbooks for the authenticated brand, filtered by survey type
- `PUT /v1/cx-playbooks/:id` — overwrite an existing playbook's rules
- `DELETE /v1/cx-playbooks/:id` — remove a playbook (soft-delete; does not affect surveys already using the rules)

**Acceptance criteria (R36):**

*Given* a manager clicks "Save as Playbook" with the name "Standard NPS Playbook" and the survey type is NPS,
*When* the save is confirmed,
*Then* a `POST /v1/cx-playbooks` request is made, the response returns the new playbook record, and the "Load Playbook" dropdown on Step 3 immediately includes the new playbook name.

*Given* a manager clicks "Load Playbook" and selects "Standard NPS Playbook",
*When* they confirm the replacement prompt,
*Then* the rule rows are replaced with the playbook's rules, each row is editable, and the "Save as Playbook" button reflects that the current rules originate from a named playbook.

*Given* a manager requests `GET /v1/cx-playbooks?surveyType=CSAT`,
*When* the brand has two NPS playbooks and one CSAT playbook,
*Then* only the one CSAT playbook is returned.

---

### R37 — Loop Monitor

Once a survey with response-to-action rules is live (status = `ACTIVE`), the survey detail page SHALL display a **Loop Monitor** section — a single pipeline view of the full CX-to-loyalty loop — so the manager never needs to open the campaign builder or analytics dashboard separately.

The Loop Monitor pipeline SHALL display five sequential stages with live counts and a connecting arrow between each stage:

| Stage | Label | Data source |
|-------|-------|-------------|
| 1 | Surveys Sent | Count of survey distribution events for this survey |
| 2 | Responses Received | `SurveyResponse` count for this survey, with a score distribution sparkline |
| 3 | Rules Matched | Count of responses that matched at least one rule in the active rule set |
| 4 | Campaigns Triggered | Count of `CampaignEvent` records linked to campaigns spawned by this survey's rules |
| 5 | Loyalty Outcomes | Total points awarded + rewards issued from those CampaignEvents, and a 30-day retention rate delta for responding members vs. non-responding members |

Each stage SHALL be clickable to expand a detail panel. The "Campaigns Triggered" stage detail panel SHALL list each campaign with its trigger condition, member count triggered, and the action executed.

The Loop Monitor SHALL auto-refresh every 60 seconds while the survey detail page is open. A "Last updated" timestamp SHALL be shown.

**API surface (R37):**
- `GET /v1/surveys/:id/loop-monitor` — returns the five-stage pipeline data as a single response object

Example response shape:
```json
{
  "surveyId": "clx...",
  "generatedAt": "2026-04-06T12:00:00Z",
  "pipeline": {
    "surveysSent": 1240,
    "responsesReceived": 312,
    "scoreDistribution": { "0-6": 58, "7-8": 147, "9-10": 107 },
    "rulesMatched": 295,
    "campaignsTriggered": 289,
    "loyaltyOutcomes": {
      "pointsAwarded": 43350,
      "rewardsIssued": 12,
      "retentionDelta": 0.08
    }
  }
}
```

**Acceptance criteria (R37):**

*Given* a survey is in `ACTIVE` status with two response-to-action rules configured,
*When* a manager opens the survey detail page,
*Then* the Loop Monitor section is visible below the survey summary, showing all five pipeline stages with live counts, and no link to the campaign builder is required to see the full pipeline.

*Given* the Loop Monitor is displayed,
*When* a manager clicks the "Campaigns Triggered" stage,
*Then* a detail panel expands showing each linked campaign's name, trigger condition (score range), member count triggered, and action type.

*Given* a survey is in `DRAFT` status,
*When* a manager opens the survey detail page,
*Then* the Loop Monitor section is not shown; a placeholder reads "Loop Monitor will be available once the survey is live."

---

### R38 — 48-Hour Warning

The system SHALL detect when a response-to-action rule has matched 0 campaigns triggered in the 48-hour window after the first response to a live survey arrives, and SHALL surface a visible warning in the Loop Monitor.

The warning SHALL state: "No campaigns triggered yet for rule '[rule label]' — check your rule conditions or member consent settings." The warning SHALL be displayed as an amber banner within the Loop Monitor section, directly adjacent to the affected pipeline stage (Campaigns Triggered), and SHALL include a "Review rules" CTA that navigates the manager to the survey's rule editor.

The 48-hour clock starts from the timestamp of the first `SurveyResponse` record for the survey, not from the survey launch date. This accounts for surveys with a slow start.

A background worker (existing queue infrastructure) SHALL be scheduled to evaluate this condition hourly for all active surveys. If the condition is resolved (at least one campaign is triggered after the warning fires), the warning SHALL be automatically cleared.

**Acceptance criteria (R38):**

*Given* a survey has been live for more than 48 hours and has received at least 5 responses but the "Campaigns Triggered" stage shows 0,
*When* the Loop Monitor is displayed,
*Then* an amber warning banner is shown with the message: "No campaigns triggered yet — check your rule conditions or member consent settings." with a "Review rules" CTA.

*Given* the 48-hour warning has been fired for a survey,
*When* a campaign is subsequently triggered (CampaignEvent count > 0 for this survey's rules),
*Then* the warning banner is removed from the Loop Monitor on the next auto-refresh.

*Given* the 48-hour evaluator worker runs and finds a survey meeting the warning criteria,
*When* the survey's first response timestamp is less than 48 hours ago,
*Then* no warning is generated — the worker takes no action.

---

### R39 — Review & Launch Step

The survey wizard SHALL include a **Step 4: "Review & Launch"** screen — the final step before a survey is activated — that presents a complete summary of all wizard decisions and requires explicit confirmation before the survey status is set to `ACTIVE`.

The Review & Launch screen SHALL display:
- **Survey identity**: survey name, type (NPS/CSAT/CES), and trigger (category + sub-trigger from Step 1)
- **Content summary**: total question count, first question preview, and incentive points if configured (from Step 2)
- **Response rules summary**: a read-only table of all configured rules — score range | action type | estimated reach | estimated point cost per rule — and a **total estimated point budget** summing all rules' expected point costs
- **Budget warning**: if the total estimated point cost for 30-day projected responses exceeds the program's `budgetCap`, an amber banner SHALL warn: "Estimated point cost ($X) may exceed your campaign budget cap ($Y) — review before launching"
- **Launch button**: labeled "Launch Survey" — clicking this sets the survey status to `ACTIVE`, seeds the associated campaign records (one `Campaign` record per rule), and redirects to the survey detail page where the Loop Monitor is visible

The Review & Launch step SHALL be reachable via both the wizard stepper (clicking "Step 4") and the "Continue: Review & Launch →" button from Step 3. Clicking "Back" from Step 4 returns to Step 3 with all rules intact.

**Acceptance criteria (R39):**

*Given* a manager has completed Steps 1–3 and clicked "Continue: Review & Launch →",
*When* Step 4 loads,
*Then* the review screen shows all four sections (survey identity, content summary, rules summary, total budget estimate) and the "Launch Survey" button is enabled.

*Given* the manager views the rules summary table on Step 4 and one rule has `award_points` with 100 points and an estimated reach of 58 members,
*When* the total budget estimate is computed,
*Then* the expected point cost for that rule is shown as 5,800 pts (58 × 100), and all rules' costs are summed into a "Total estimated point cost" row at the bottom of the table.

*Given* a manager clicks "Launch Survey",
*When* the API call succeeds,
*Then* the survey status transitions from `DRAFT` to `ACTIVE`, one `Campaign` record is created per rule with `triggerType = "cx.survey_response"` and `triggerCondition = { surveyId, scoreMin, scoreMax }`, and the manager is redirected to the survey detail page showing the Loop Monitor in its initial empty state.

---

### R40 — Loop Monitor Latency Metrics

The Loop Monitor SHALL display P50 and P95 feedback-to-campaign latency metrics computed from `CampaignEvent.latencyMs` for all events associated with this survey's campaigns.

The latency metrics SHALL be shown in a dedicated "Latency" row beneath the main pipeline, formatted as:

> **Response → Campaign latency**: P50: 2.3s | P95: 11.7s | Target: <900s (15 min)

If fewer than 10 `CampaignEvent` records exist (insufficient data for percentile calculation), the latency row SHALL display "Latency data not yet available — check back after more responses arrive."

The P95 latency value SHALL be color-coded:
- Green: P95 < 900 seconds (within the platform's 15-minute SLA, R8 from #75)
- Amber: P95 900–1800 seconds (approaching limit)
- Red: P95 > 1800 seconds (SLA breach)

The `GET /v1/surveys/:id/loop-monitor` response SHALL include a `latency` object:

```json
"latency": {
  "p50Ms": 2300,
  "p95Ms": 11700,
  "sampleSize": 289,
  "slaStatus": "ok"
}
```

**Acceptance criteria (R40):**

*Given* a survey has 289 triggered campaign events with `latencyMs` values recorded,
*When* the Loop Monitor is displayed,
*Then* the latency row shows computed P50 and P95 values in seconds, with a green indicator if P95 is under 900 seconds.

*Given* P95 latency for a survey's campaigns exceeds 1800 seconds,
*When* the Loop Monitor is displayed,
*Then* the P95 value is shown in red and a tooltip reads: "P95 exceeds the 15-minute SLA — investigate the campaign worker queue."

*Given* the survey has fewer than 10 CampaignEvent records,
*When* the Loop Monitor is displayed,
*Then* the latency row shows "Latency data not yet available" and no percentile values are displayed.

---

## User Experience

### 4-Step Wizard Flow

The full survey creation wizard has four steps. Steps 1 and 2 were established in Issue #79. Issue #80 adds Steps 3 and 4.

**Step 1 — Survey Trigger** (delivered in #79): The manager selects a trigger category (Loyalty Moment / CX Risk Moment / Scheduled), a specific sub-trigger, and reviews the recommended survey type with rationale and reach estimate.

**Step 2 — Survey Content** (existing survey builder, #35): The manager writes survey questions. The wizard chrome wraps the existing question editor.

**Step 3 — What Happens Next? (Rule Builder)**:
- The step header reads: "Define what loyalty action fires for each response score."
- A "Load Playbook" dropdown appears at the top right of the rule builder panel. It is labeled "Load a saved playbook" and lists all playbooks for the current brand filtered to the survey's type.
- Below the dropdown, a rule list renders with one default row pre-populated (appropriate to the survey type). Each row contains: a score range pill picker, an action type dropdown, an action config panel (contextual), an estimated reach badge, and a delete icon.
- An "+ Add rule" button sits below the rule list.
- A "Save as Playbook" link sits at the bottom of the rule panel.
- The right sidebar (matching the wizard chrome from #79) shows a summary of Steps 1 and 2 in collapsed read-only form.
- A "Continue: Review & Launch →" button is at the bottom. If no rules are configured, clicking it shows an inline warning: "Add at least one rule, or skip rules to launch without automation."
- A "Skip for now" text link allows launching without rules (survey goes live with status `ACTIVE`, no campaigns created).

**Step 4 — Review & Launch**:
- A full-width review layout (no sidebar — full content area used).
- Four cards stacked vertically: Trigger summary, Content summary, Rules summary (table), Budget estimate.
- A large "Launch Survey" primary button at the bottom. A "Back to rules" ghost button sits to its left.
- A confirmation toast appears after successful launch: "Survey launched — Loop Monitor is now active."

### Loop Monitor (Post-Launch View)

The Loop Monitor appears as a section on the survey detail page, below the survey header and response rate KPI row, and above the individual response feed.

Visually it is a horizontal pipeline of five connected stage blocks, each block containing:
- Stage label (e.g., "Campaigns Triggered")
- Large numeric count in bold
- A small sub-label (e.g., "out of 312 responses")
- A chevron arrow pointing to the next stage

Below the pipeline row is the latency metric strip (P50 / P95 / SLA status) and, when applicable, the 48-hour amber warning banner.

Each stage block is clickable. Clicking expands a detail drawer below the pipeline (not a modal) showing the relevant records for that stage.

The Loop Monitor is only shown when `survey.status === "ACTIVE"`. In `DRAFT` or `PAUSED` states, a placeholder card reads: "Loop Monitor activates when the survey is live."

**Link to mock**: `docs/feature-specs/mocks/80-response-to-action-rule-builder.html`

---

## Error States

| State | Trigger | User Sees | System Does |
|-------|---------|-----------|-------------|
| No rules configured + "Continue" clicked | Manager clicks "Continue: Review & Launch →" with zero rule rows | Inline warning below the rule list: "Add at least one rule or use 'Skip for now' to launch without automation." Continue button remains disabled until resolved. | No navigation. No API call. |
| Rule with 0 estimated reach | Rule score range covers a range with no historical responses in the program | Amber tooltip on the reach badge: "No members have scored in this range — this rule may never trigger." Rule is still saveable. | No block on saving. Warning logged server-side. |
| Score range overlap | Two rules have overlapping ranges (e.g., 0–6 and 5–8) | Inline validation error on both overlapping rows: "Score ranges must not overlap." "Continue" button disabled. | No API call until conflict resolved. |
| Playbook load conflict | Manager loads a playbook that contains an action type not supported by the current program configuration (e.g., `spin_wheel` but no spin-wheel campaign exists) | Warning banner: "Playbook loaded, but the 'Spin Wheel' action requires an active spin-wheel campaign — configure one before launching." | Rules are loaded. Affected row is flagged with a warning icon. Continue is not blocked. |
| Loop Monitor 48-hour warning | Rule has matched 0 campaigns after 48h of first responses | Amber banner in Loop Monitor: "No campaigns triggered yet for rule '[label]' — check your rule conditions or member consent settings." + "Review rules" CTA | Background worker flags the survey rule. Warning persists until at least one CampaignEvent is recorded. |
| Loop Monitor data unavailable | `GET /v1/surveys/:id/loop-monitor` returns a 5xx | In the Loop Monitor section: "Pipeline data temporarily unavailable — retrying in 60 seconds." Auto-retry countdown shown. | Frontend retries once after 60 seconds. If second request fails, an error card with a "Reload" button is shown. |
| Budget cap exceeded (Step 4) | Total estimated point cost > program budgetCap | Amber banner on the Review & Launch step: "Estimated point cost (X pts) may exceed your campaign budget cap (Y pts) — review before launching." | Launch button remains enabled (warning is advisory, not blocking). |
| Launch API failure | `POST /v1/surveys/:id/launch` returns a 4xx or 5xx | Toast: "Survey could not be launched — please try again. If this persists, contact support." | Survey status remains `DRAFT`. No campaigns are created. No partial state. |

---

## Compliance Requirements

**GDPR / CCPA — Consent gate**: Loyalty actions triggered by CX survey responses must pass through the same member consent gate as the existing survey response pipeline (established in the existing `SurveyResponse` model). A `CampaignEvent` SHALL only be created for a member if their consent record allows marketing communications. No additional consent capture is required by this feature — it inherits the existing gate.

**Data minimization**: The `CxPlaybook` model stores only rule definitions (score ranges, action types, action configs) and a brand-scoped name. No member PII is stored in a playbook. Playbook names are brand-internal operational data and are not surfaced to end members.

**Aggregate-only estimates**: The estimated member count and expected point cost shown in Step 3 and Step 4 are computed from aggregate score distribution data, not from individual member identifiers. No individual member data is returned to the frontend during rule configuration.

**Loop Monitor data retention**: `CampaignEvent.latencyMs` values used for P50/P95 computation are already part of the existing Campaign data model. No new PII fields are introduced. Loop Monitor API responses contain only aggregate counts, distributions, and computed percentiles — not member-level data.

**SOC 2 — Audit trail**: Creating or overwriting a `CxPlaybook` SHALL generate an audit log entry (brand ID, actor user ID, playbook name, timestamp, action: create/update/delete) consistent with the platform's existing audit logging pattern.

---

## Design Standards

Generic UI baseline applied throughout. Indigo primary (`#6366f1`), zinc neutrals, 12px border-radius cards — consistent with the wizard chrome established in Issue #79's `TriggerStep` component and the existing CustomerEQ admin shell.

**Score pills**: The score range pill in each rule row uses the same three-color convention as the existing `score-pill` CSS class in `75-marketing-manager-flow.html`:
- Red (`#fee2e2` / `#dc2626`): low scores (NPS 0–6, CSAT 1–2, CES 1–2)
- Amber (`#fef9c3` / `#854d0e`): mid scores (NPS 7–8, CSAT 3, CES 3–4)
- Green (`#dcfce7` / `#15803d`): high scores (NPS 9–10, CSAT 4–5, CES 5–7)

**Pipeline blocks** in the Loop Monitor use a light indigo background (`#eef2ff`) with an indigo border (`#c7d2fe`) for the active/highlighted state. Arrow connectors between stages are rendered using an indigo chevron (`›`) in 20px font.

**Warning banners** use the amber alert style (`background: #fff7ed`, `border: 1px solid #fed7aa`, `color: #9a3412`) consistent with the existing `.alert-card` CSS class.

**Wizard step indicator**: Step 3 and Step 4 are added to the existing four-step stepper. Completed steps show a filled indigo circle with a checkmark. Active step shows an indigo-outlined circle. Future steps show a zinc-outlined circle.

---

## Validation Plan

### Browser Validation (Playwright E2E)

1. **Wizard Step 3 — rule builder loads**:
   - Create a new survey, complete Steps 1 and 2, reach Step 3
   - Assert: rule builder is visible, one default rule row is pre-populated appropriate to the selected survey type
   - Assert: "Load Playbook" dropdown is present

2. **Rule creation and validation**:
   - Add a second rule row; configure score range 7–8 and action `award_points` 25 pts
   - Assert: reach badge updates within 2 seconds
   - Change the first rule's range to 5–8 (causing overlap with second rule)
   - Assert: inline validation error appears on both rows; "Continue" is disabled
   - Fix the overlap (restore to 0–6); assert error clears; "Continue" is enabled

3. **Playbook save and load**:
   - Configure two rules; click "Save as Playbook"; enter name "Test NPS Playbook"; confirm
   - Assert: toast confirms save; playbook name appears in "Load Playbook" dropdown
   - Clear rules; click "Load Playbook" → select "Test NPS Playbook"; confirm
   - Assert: rule rows match the saved playbook; rows are editable

4. **Wizard Step 4 — Review & Launch**:
   - Proceed to Step 4; assert all four summary cards are visible
   - Assert: rules table shows correct estimated reach and point cost per rule, and a total
   - Click "Back to rules"; assert Step 3 loads with rules intact
   - Return to Step 4; click "Launch Survey"
   - Assert: redirect to survey detail page; Loop Monitor placeholder is visible while status transitions

5. **Loop Monitor pipeline**:
   - Seed test data: 312 survey responses, 289 campaign events with latencyMs values
   - Open the survey detail page
   - Assert: Loop Monitor shows all five stage counts matching seeded data
   - Assert: P50 and P95 latency values are displayed and color-coded correctly
   - Click "Campaigns Triggered" stage; assert detail drawer opens listing campaign names and member counts

6. **48-hour warning**:
   - Seed a survey that has been active > 48 hours with responses but 0 campaign events
   - Open Loop Monitor
   - Assert: amber warning banner is visible with the correct message and "Review rules" CTA
   - Seed one CampaignEvent for this survey's campaign; trigger auto-refresh
   - Assert: warning banner is cleared

### API Validation (curl / integration tests)

```bash
# Create a CX Playbook
curl -X POST /v1/cx-playbooks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "name": "Standard NPS Playbook", "surveyType": "NPS", "rules": [
    { "scoreMin": 0, "scoreMax": 6, "actionType": "award_points", "actionConfig": { "points": 100 }, "ruleLabel": "Detractor win-back" },
    { "scoreMin": 9, "scoreMax": 10, "actionType": "award_points", "actionConfig": { "points": 50 }, "ruleLabel": "Promoter reward" }
  ]}'
# Expected: 201 with playbook record including id

# List playbooks (filtered by type)
curl /v1/cx-playbooks?surveyType=NPS -H "Authorization: Bearer $TOKEN"
# Expected: 200 array containing the created playbook; no CSAT playbooks in result

# Get loop monitor
curl /v1/surveys/$SURVEY_ID/loop-monitor -H "Authorization: Bearer $TOKEN"
# Expected: 200 with pipeline object containing all five stage counts + latency object

# Verify 48-hour warning flag is included when conditions met
# Expected: pipeline.warning.type = "no_campaigns_triggered_48h" when applicable
```

---

## Alternatives

| Alternative | Why Discarded |
|-------------|---------------|
| Keep response-to-action configuration in the campaign builder only (no wizard step) | This is the status quo that creates the cross-tool hand-off problem. The manager loses survey context when they navigate away. Research on comparable SaaS workflows shows in-context rule definition increases rule completion rates by reducing the number of steps and the need to hold context across tools. |
| Modal dialog for rule configuration instead of a full wizard step | A modal cannot accommodate the full rule builder: score range picker, action config panel, estimated reach badge, playbook load/save, and field-level validation all require sufficient vertical space. A cramped modal increases error rates and forces scrolling within a scroll — poor UX for a complex form. |
| AI-generated rules ("suggest rules for me") as the primary flow | AI suggestion is a valid future enhancement but is insufficient as the primary UX because: (a) managers need to understand and own the rules before launch; (b) suggested rules require a training corpus of prior survey outcomes that may not exist for new accounts; (c) it does not address the playbook reuse requirement (R36). Deferring AI suggestions to a future iteration allows R35–R36 to ship with a deterministic, auditable experience. |
| Embed the Loop Monitor in the main analytics dashboard rather than the survey detail page | The analytics dashboard is program-scoped (all surveys, all campaigns). The Loop Monitor must be survey-scoped — it shows the pipeline for one specific survey's rules. Embedding it in the main dashboard would require filtering that recreates the survey detail page experience. Placing it on the survey detail page gives the manager direct, zero-navigation access from the survey context. |

---

## Competitive Analysis

### Competitor Comparison Table

| Competitor | CX-to-Loyalty Automation | Rule Builder | Playbook Reuse | Loop/Pipeline View | 48h Warning |
|------------|--------------------------|--------------|----------------|--------------------|-------------|
| **Delighted** | None natively. NPS collected; action is manual or via Zapier to a third-party tool. | No inline rule builder — requires external automation (Zapier, HubSpot Workflows). | No playbook concept. Rules must be recreated per integration. | No pipeline view — response data stays in Delighted; campaign data stays in the connected tool. | No. |
| **Typeform** | None natively. Typeform collects responses; loyalty actions require Typeform Logic + external webhook to a loyalty tool. | Logic conditions can route responses, but cannot award loyalty points or trigger loyalty campaigns without a third-party integration. | Logic flows can be duplicated, but there is no "playbook" concept scoped to a loyalty action type. | No pipeline view. Analytics show response data only. | No. |
| **Medallia** | Enterprise-grade closed-loop alerting for support/service recovery, but loyalty action integration requires custom professional services configuration. | Rule-based action routing exists (Action Management module), but it is a separate tool in the platform and requires a project team to configure. The survey builder and action rules are not in the same workflow. | Saved workflows ("Action Plans") can be templated, but templates are service-managed, not self-service. | Medallia Athena provides a pipeline view, but it is an enterprise analytics module — not a summary card on the survey page. Requires a separate license tier. | Escalation alerts exist but are based on score thresholds, not on the absence of triggered actions. |
| **Qualtrics** | XM Automation Hub connects survey responses to downstream actions, but the rule configuration is in a separate "Workflows" section, not inline with the survey builder. | Visual workflow builder (XM Flows) supports conditional branching to CRM/loyalty integrations. Powerful but requires workflow expertise; steep learning curve for marketing managers. | Workflow templates can be saved and reused, but they are program-wide templates, not survey-type-scoped playbooks. | No single-screen loop view. Monitoring requires switching between XM Discover (CX analytics) and the connected loyalty tool dashboard. | No native equivalent. Qualtrics ticket alerts exist for detractor recovery, but not for the absence of triggered automation. |
| **LoyaltyLion** | LoyaltyLion does not have a native survey product. It integrates with Yotpo Reviews and Okendo for post-purchase feedback, then uses those review events to trigger loyalty point rewards. | No survey rule builder — point awards for reviews are configured as a single earn rule (e.g., "submitted a review → +50 points"), not as a score-range-to-action mapping. | No playbook concept — earn rules are program-wide settings, not survey-specific configurations. | No loop monitor. The operator sees points awarded in the loyalty analytics dashboard, disconnected from review sentiment data. | No. |
| **Yotpo** | Yotpo Loyalty & Referrals integrates with Yotpo Reviews and SMSBump to create a response-to-action loop, but only for reviews (star ratings). Survey-type CX signals (NPS, CSAT, CES) are not natively supported. | Point-for-review rules exist but are static — all reviews trigger the same earn action regardless of star rating. No score-range-to-action mapping is available. | No playbook concept. Rules are global earn rule settings. | Yotpo Analytics dashboard shows reviews and loyalty data side by side, which is closer to a loop view than most competitors — but it is not a per-survey pipeline and does not show latency. | No. |

### Competitive Positioning

**Where CustomerEQ leads:**

1. **In-context rule definition**: CustomerEQ is the only platform that places the CX-to-loyalty rule builder inside the survey wizard itself — eliminating the cross-tool hand-off that all competitors require. Qualtrics has the closest analogue (XM Flows), but it is a separate module with a separate learning curve.

2. **Score-range-to-action granularity**: All competitors (Yotpo, LoyaltyLion, Delighted) treat loyalty actions as binary — "submitted feedback → earn points" — without mapping score ranges to differentiated actions. CustomerEQ's rule builder allows distinct actions for detractors (NPS 0–6), passives (NPS 7–8), and promoters (NPS 9–10), enabling winback automation for detractors and referral incentives for promoters in the same survey.

3. **CX Playbooks for mid-market operators**: No surveyed competitor has a self-service "playbook" abstraction that saves a complete CX-to-loyalty rule set for reuse across future surveys within the same brand. Qualtrics has workflow templates but they are admin-managed. For a mid-market marketing manager who wants to standardize their NPS response strategy without rebuilding it for every survey, CustomerEQ's playbook feature is novel.

4. **Single-screen Loop Monitor with latency SLA tracking**: Medallia and Qualtrics offer pipeline analytics, but they are enterprise modules — separate screens, separate licenses. CustomerEQ surfaces the full feedback-to-campaign-to-loyalty-outcome pipeline on the survey detail page with no navigation required, and adds P50/P95 latency tracking against an explicit 15-minute SLA — a commitment no surveyed competitor makes publicly.

**Where competitors lead:**

- **Medallia / Qualtrics** are significantly more powerful for large enterprise CX programs (journey-level analysis, NLP at scale, integration with Salesforce Service Cloud). CustomerEQ targets mid-market operators who do not need this complexity and cannot afford the professional services required to configure it.
- **Yotpo** has deeper post-purchase review integration for e-commerce brands, particularly on Shopify. If a brand's CX feedback is exclusively star-rating reviews (not NPS/CSAT/CES surveys), Yotpo may be more appropriate.

**Positioning statement**: CustomerEQ is the first loyalty platform where CX measurement and loyalty automation are configured in the same workflow, monitored on the same screen, and reusable across surveys — without requiring a CX research background, workflow expertise, or professional services.
