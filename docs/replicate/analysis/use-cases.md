# Use Cases — Annex Cloud Replication

> Extracted from site analysis, interaction analysis, feature pages, and data models.
> Organized by user role and functional area.

---

## User Roles

| Role | Description |
|------|-------------|
| **Marketing Manager** | Creates and manages loyalty programs, campaigns, journeys. Primary operator of the platform. |
| **Loyalty Member** | End customer enrolled in a brand's loyalty program. |
| **Admin / Program Owner** | Configures program rules, tiers, rewards catalog. Has full platform access. |
| **Analyst** | Views reports and dashboards. Read-only access to analytics. |
| **IT / Developer** | Manages integrations, API keys, data feeds. |
| **Guest (Unauthenticated)** | Visitor to the marketing website who may request a demo or subscribe. |

---

## UC-01: Request a Demo (Guest)

**Actor**: Guest visitor
**Page**: `/request-demo/`
**Screenshot**: `screenshots/forms/request-demo.png`

**Preconditions**: User visits the marketing site and clicks "Request a demo"

**Steps**:
1. User navigates to `/request-demo/`
2. User views the demo request form with partner trust logos
3. User fills in: First Name, Last Name, Work Email, Company Name, Phone, Company Size, Message
4. User submits the form
5. System sends confirmation email
6. Sales team receives lead notification via HubSpot

**Postconditions**: Lead created in HubSpot CRM; user receives confirmation

**Acceptance Criteria**:
- [ ] Form validates required fields (First Name, Last Name, Work Email, Company Name)
- [ ] Email format validation on Work Email field
- [ ] Company Size is a dropdown selection
- [ ] Privacy policy link is present and links to `/privacy-policy/`
- [ ] Success message shown after submission
- [ ] Form prevents duplicate submissions

---

## UC-02: Newsletter Subscription (Guest)

**Actor**: Guest visitor
**Location**: Footer (all pages)

**Steps**:
1. User enters work email in footer newsletter input
2. User clicks "Subscribe Now"
3. System confirms privacy policy consent
4. System subscribes user to newsletter via HubSpot

**Acceptance Criteria**:
- [ ] Email validation on input
- [ ] Privacy policy consent text displayed
- [ ] Success/error feedback shown

---

## UC-03: Member Enrollment (Loyalty Member)

**Actor**: Loyalty Member
**Trigger**: First visit to brand loyalty program microsite

**Steps**:
1. Member visits brand loyalty program microsite/portal
2. Member creates account (email + password or SSO)
3. System creates Member record with initial profile
4. System awards enrollment bonus points (if configured)
5. Member receives welcome email

**Acceptance Criteria**:
- [ ] Email uniqueness enforced
- [ ] Optional social login (Google, Facebook)
- [ ] Enrollment bonus points awarded per program rules
- [ ] Welcome email sent with points balance
- [ ] Member redirected to loyalty dashboard

---

## UC-04: Earn Points (Loyalty Member)

**Actor**: Loyalty Member
**Trigger**: Trackable customer action

**Steps**:
1. Member completes action (purchase, social share, survey, review, referral, etc.)
2. System receives event (via integration webhook or API call)
3. Rules engine evaluates applicable rules
4. System awards points per matching rules
5. Member receives notification (email/SMS/push)
6. Member dashboard updates point balance

**Event Types**:
- Purchase (POS, e-commerce)
- Social media share/follow/post
- Survey/Quiz completion
- Product review
- Referral conversion
- Receipt scan
- Profile completion
- Gamification achievement

**Acceptance Criteria**:
- [ ] Points awarded in real-time (< 15 minutes)
- [ ] Duplicate event prevention (idempotency)
- [ ] Points history logged with event details
- [ ] Notification sent per member preferences
- [ ] Dashboard balance updates immediately

---

## UC-05: Redeem Reward (Loyalty Member)

**Actor**: Loyalty Member

**Steps**:
1. Member views available rewards in rewards catalog
2. Member filters by type (merchandise, gift card, travel, etc.)
3. Member selects reward
4. System verifies sufficient point balance
5. Member confirms redemption
6. System deducts points and issues reward
7. Member receives reward confirmation + delivery details

**Acceptance Criteria**:
- [ ] Rewards catalog shows only affordable rewards prominently
- [ ] Point cost and estimated value displayed per reward
- [ ] Insufficient balance prevents redemption with helpful message
- [ ] Reward delivery method shown (digital vs. physical)
- [ ] Redemption appears in member history

---

## UC-06: Tier Progression (Loyalty Member)

**Actor**: Loyalty Member
**Trigger**: Member reaches tier threshold

**Steps**:
1. Member accumulates points/spend toward next tier
2. System evaluates tier criteria in real-time
3. System upgrades member tier
4. Member receives tier upgrade notification
5. New tier benefits activate immediately
6. Member dashboard shows new tier status and benefits

**Acceptance Criteria**:
- [ ] Tier progress bar visible in member dashboard
- [ ] Upgrade notification sent immediately
- [ ] New benefits applied retroactively if configured
- [ ] Tier history maintained
- [ ] Downgrade logic enforced per retention policy

---

## UC-07: Complete Survey / Quiz (Loyalty Member)

**Actor**: Loyalty Member

**Steps**:
1. Member sees survey invitation (in-app, email, or microsite)
2. Member opens survey and views questions
3. Member answers questions progressively
4. System saves answers as zero-party data to member profile
5. System awards completion points/reward
6. Member profile enriched with new attributes

**Acceptance Criteria**:
- [ ] Survey can be paused and resumed
- [ ] Points awarded only on completion
- [ ] Answers stored as member profile attributes
- [ ] Survey shown once per member (unless configured for repeat)
- [ ] Data used in subsequent segmentation

---

## UC-08: Refer a Friend (Loyalty Member)

**Actor**: Loyalty Member

**Steps**:
1. Member accesses referral section
2. System generates unique referral code/link
3. Member shares link via email or social media
4. Friend clicks referral link
5. Friend enrolls in loyalty program
6. System detects referral attribution
7. Both referrer and referee receive rewards

**Acceptance Criteria**:
- [ ] Unique referral code per member
- [ ] Referral link tracks across channels
- [ ] Conversion detected within configurable window
- [ ] Both parties notified upon reward
- [ ] Referral status visible in member dashboard (Pending/Converted)
- [ ] Fraud prevention: same email/device detection

---

## UC-09: Configure Loyalty Program (Admin)

**Actor**: Admin / Program Owner

**Steps**:
1. Admin creates new loyalty program
2. Admin selects program type (Points, Tiered, Cashback, etc.)
3. Admin configures rules (point earning actions, multipliers)
4. Admin sets up tiers with entry criteria and benefits
5. Admin configures rewards catalog
6. Admin sets spending controls and budgets
7. Admin activates program

**Acceptance Criteria**:
- [ ] Program configuration wizard with step-by-step flow
- [ ] Rules engine supports AND/OR condition logic
- [ ] Point multipliers configurable by product category, channel, time period
- [ ] Tier names and criteria fully customizable
- [ ] Budget alerts and caps enforceable
- [ ] Preview mode before activation

---

## UC-10: Create and Launch Campaign (Marketing Manager)

**Actor**: Marketing Manager

**Steps**:
1. Manager creates new campaign
2. Manager selects target segment(s)
3. Manager sets campaign rules (bonus points, special rewards)
4. Manager sets budget and spend controls
5. Manager configures notification messages (email/SMS/push)
6. Manager previews campaign
7. Manager schedules or immediately launches campaign
8. System sends notifications to target members
9. Manager monitors campaign performance in real-time

**Acceptance Criteria**:
- [ ] Segment selection from existing dynamic/static segments
- [ ] Budget cap enforced in real-time
- [ ] A/B test configuration available
- [ ] Preview shows estimated reach before launch
- [ ] Real-time performance dashboard during campaign
- [ ] Campaign can be paused mid-flight

---

## UC-11: Build Customer Journey (Marketing Manager — Journey Catalyst)

**Actor**: Marketing Manager

**Steps**:
1. Manager opens Journey Catalyst no-code builder
2. Manager defines journey trigger (event or segment entry)
3. Manager adds steps (wait, send message, award points, branch by condition)
4. AI suggests next optimal steps
5. Manager configures spend controls
6. Manager activates journey
7. System processes members through journey automatically
8. Manager views journey performance metrics

**Acceptance Criteria**:
- [ ] No-code drag-and-drop builder
- [ ] AI recommendations displayed as suggestions
- [ ] Dynamic segmentation updates member eligibility in real-time
- [ ] Spend controls halt journey when budget reached
- [ ] Journey performance shows conversion at each step
- [ ] Clone/replicate existing journeys

---

## UC-12: Segment Members (Marketing Manager)

**Actor**: Marketing Manager

**Steps**:
1. Manager navigates to Segmentation section
2. Manager creates new segment (static or dynamic)
3. Manager sets criteria (RFM scores, attributes, behaviors, tier, spend, etc.)
4. System calculates segment membership
5. Manager previews segment size
6. Manager saves and names segment
7. Segment available for campaigns, journeys, and surveys

**Acceptance Criteria**:
- [ ] RFM dashboard with pre-built segments
- [ ] Arbitrary attribute filtering (AND/OR/NOT logic)
- [ ] Real-time member count preview
- [ ] Segment can be shared across programs/brands
- [ ] Segment membership recalculated on schedule or real-time

---

## UC-13: View Loyalty Analytics (Analyst / Manager)

**Actor**: Analyst or Marketing Manager

**Steps**:
1. User navigates to Reporting section
2. User selects report type (enrollment, engagement, rewards, financial)
3. User sets date range
4. System displays dashboard with key metrics
5. User drills down by segment, tier, channel
6. User exports data to CSV or pushes to data lake

**Key Metrics**:
- Total/Active members
- New enrollments
- Points awarded/redeemed
- Rewards issued
- AOV, repeat purchase rate
- CLV, program ROI
- Engagement rate by channel

**Acceptance Criteria**:
- [ ] Dashboard loads in < 3 seconds
- [ ] Date range picker with presets (7d, 30d, 90d, custom)
- [ ] Segment and tier drill-down
- [ ] CSV export
- [ ] Data push to external systems via API/webhook
- [ ] Scheduled report emails

---

## UC-14: Configure Integration (IT / Developer)

**Actor**: IT / Developer

**Steps**:
1. Developer navigates to Integrations section
2. Developer selects integration type (CRM, e-commerce, etc.)
3. Developer selects specific platform (Salesforce, Shopify, etc.)
4. Developer enters credentials / API keys
5. Developer maps loyalty fields to integration fields
6. Developer tests connection
7. System begins syncing data per configured frequency

**Acceptance Criteria**:
- [ ] 125+ pre-built connectors listed and searchable
- [ ] Credential storage is encrypted
- [ ] Field mapping UI with drag-and-drop
- [ ] Test connection button with real-time feedback
- [ ] Sync logs and error reporting
- [ ] Webhook URL generation for outbound events

---

## UC-15: Progressive Profiling (Loyalty Member)

**Actor**: Loyalty Member
**Trigger**: Each engagement touchpoint

**Steps**:
1. Member engages with brand (purchase, opens email, visits site)
2. System evaluates member's profile completeness
3. System presents 1-2 targeted questions at the right moment
4. Member answers voluntarily to earn bonus points
5. System saves answers as profile attributes
6. Member's segment membership updates based on new data

**Acceptance Criteria**:
- [ ] Questions are contextually relevant to the touchpoint
- [ ] Maximum 1-2 questions per session
- [ ] Bonus points incentive clearly shown
- [ ] Questions not repeated after answered
- [ ] Profile completeness percentage tracked

---

## UC-16: Social Loyalty Action (Loyalty Member)

**Actor**: Loyalty Member

**Steps**:
1. Member sees social loyalty CTA (follow, share, post, review)
2. Member connects social account (one-time OAuth)
3. Member completes social action
4. System verifies action via social platform API
5. System awards points for verified action
6. Member can track social engagement points in history

**Acceptance Criteria**:
- [ ] OAuth connection for major platforms (Instagram, Facebook, Twitter/X, TikTok)
- [ ] Action verification before points award
- [ ] One-time award per action type (unless recurring configured)
- [ ] Social sharing generates referral attribution

---

## UC-17: Receipt Scanning (Loyalty Member)

**Actor**: Loyalty Member

**Steps**:
1. Member uploads receipt photo via mobile/web
2. System uses OCR to extract purchase details
3. System validates receipt authenticity (date, amount, store)
4. System awards points based on purchase amount/items
5. Member views credited points in dashboard

**Acceptance Criteria**:
- [ ] Image upload (JPEG, PNG, PDF)
- [ ] OCR processing within 60 seconds
- [ ] Duplicate receipt detection
- [ ] Manual review queue for failed OCR
- [ ] Points awarded only after validation

---

## UC-18: Gamification Engagement (Loyalty Member)

**Actor**: Loyalty Member

**Steps**:
1. Member views available challenges, badges, and leaderboards
2. Member participates in challenge (e.g., "Make 3 purchases in a month")
3. System tracks progress toward challenge completion
4. System awards badge and bonus points on completion
5. Leaderboard updates member's position
6. Member shares achievement (optional)

**Acceptance Criteria**:
- [ ] Progress tracking per challenge
- [ ] Badge library visible in member profile
- [ ] Leaderboard shows top N members (privacy controls)
- [ ] Challenge expiration enforced
- [ ] Achievement sharing generates social loyalty credit

---

## UC-19: Multi-Brand / Multi-Region Management (Admin)

**Actor**: Admin / Program Owner

**Steps**:
1. Admin creates multiple program instances from shared template
2. Admin customizes each instance per brand/region (name, colors, rules)
3. Admin manages unified dashboard across all instances
4. System enforces region-specific compliance (GDPR, CCPA)
5. Admin views consolidated and per-brand reporting

**Acceptance Criteria**:
- [ ] Template inheritance with per-instance overrides
- [ ] Region-specific data residency controls
- [ ] Consolidated analytics view with brand filter
- [ ] Brand-specific admin roles with appropriate scope

---

## UC-20: AI-Powered Personalization (System / Marketing Manager)

**Actor**: System (automated) with oversight from Marketing Manager

**Steps**:
1. System continuously analyzes member behavior data
2. AI models generate personalized offer recommendations per member
3. AI identifies at-risk members (churn prediction)
4. AI flags suspicious activity (fraud detection)
5. Manager reviews AI recommendations
6. Manager approves or overrides AI suggestions
7. System executes approved personalized actions

**Acceptance Criteria**:
- [ ] AI recommendations surfaced in campaign builder
- [ ] Churn risk score visible in member profile
- [ ] Fraud alerts with supporting evidence
- [ ] Manager can accept/reject individual AI recommendations
- [ ] AI model performance metrics visible (accuracy, lift)
