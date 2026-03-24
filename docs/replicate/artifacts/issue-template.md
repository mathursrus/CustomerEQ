# GitHub Issue Template — CustomerEQ Loyalty Platform

## Template Structure

Each issue represents one use case from the Annex Cloud replication analysis.

---

## Issue Body Template

```markdown
## User Story

As a **{actor}**, I want to **{action}** so that **{benefit}**.

## Description

{featureDescription}

## Use Case Reference

- **Use Case ID**: {useCaseId}
- **Source**: [Annex Cloud Replication Analysis](docs/replicate/reports/REPLICATION_ANALYSIS.md)
- **Use Case Doc**: [use-cases.md](docs/replicate/analysis/use-cases.md#{anchor})

## Screenshots

{screenshots}

## Technical Requirements

### Components
{components}

### Data Models
{dataModels}

### API Endpoints
{apiEndpoints}

### Dependencies
{dependencies}

## Acceptance Criteria

{acceptanceCriteria}

## Implementation Notes

{implementationNotes}

## Priority

**{priority}** — {priorityReason}

## Labels

{labels}
```

---

## Prepared Issues

### Phase 1 — P0 (MVP Core)

**Issue 1**: Member Enrollment
- **Actor**: Loyalty Member
- **User Story**: As a loyalty member, I want to enroll in a brand's loyalty program so that I can start earning points and rewards.
- **Labels**: `feature`, `member-lifecycle`, `p0`, `phase-1`
- **Dependencies**: Auth system, Program config (UC-09)

**Issue 2**: Earn Points
- **Actor**: Loyalty Member
- **User Story**: As a loyalty member, I want to earn points for trackable actions so that I am rewarded for my engagement with the brand.
- **Labels**: `feature`, `loyalty-engine`, `p0`, `phase-1`
- **Dependencies**: Member Enrollment (Issue 1), Rules Engine, Event Queue

**Issue 3**: Redeem Reward
- **Actor**: Loyalty Member
- **User Story**: As a loyalty member, I want to browse and redeem rewards using my points so that I receive value from my loyalty engagement.
- **Labels**: `feature`, `rewards`, `p0`, `phase-1`
- **Dependencies**: Earn Points (Issue 2), Rewards Catalog

**Issue 4**: Configure Loyalty Program
- **Actor**: Admin / Program Owner
- **User Story**: As an admin, I want to configure a loyalty program with rules, tiers, and rewards so that I can launch and manage my brand's loyalty initiative.
- **Labels**: `feature`, `admin`, `program-config`, `p0`, `phase-1`
- **Dependencies**: None (foundational)

**Issue 5**: Create and Launch Campaign
- **Actor**: Marketing Manager
- **User Story**: As a marketing manager, I want to create targeted campaigns with bonus point rules so that I can drive specific customer behaviors in real-time.
- **Labels**: `feature`, `campaigns`, `cx-loyalty-integration`, `p0`, `phase-1`, `hero-feature`
- **Dependencies**: Program Config (Issue 4), Segmentation, Event Queue

**Issue 6**: Loyalty Analytics Dashboard
- **Actor**: Analyst / Marketing Manager
- **User Story**: As a marketing analyst, I want to view a real-time loyalty dashboard with key metrics so that I can measure and report on program ROI.
- **Labels**: `feature`, `analytics`, `reporting`, `p0`, `phase-1`
- **Dependencies**: Earn Points (Issue 2), Redeem Reward (Issue 3)

**Issue 7**: Demo Request Form
- **Actor**: Guest
- **User Story**: As a potential customer, I want to submit a demo request so that I can schedule a call with the CustomerEQ sales team.
- **Labels**: `feature`, `marketing-site`, `lead-capture`, `p0`, `phase-1`
- **Dependencies**: None

**Issue 8**: CRM Integration (Salesforce + HubSpot)
- **Actor**: IT / Developer
- **User Story**: As a developer, I want to connect CustomerEQ to our CRM so that loyalty data flows automatically into our existing sales and marketing systems.
- **Labels**: `feature`, `integrations`, `crm`, `p1`, `phase-1`
- **Dependencies**: Member Enrollment (Issue 1), Earn Points (Issue 2)

### Phase 2 — P1 (Enhanced)

**Issue 9**: Tier Progression
- **Actor**: Loyalty Member
- **User Story**: As a loyalty member, I want to progress through program tiers so that I unlock greater rewards and benefits as my loyalty deepens.
- **Labels**: `feature`, `tiers`, `member-lifecycle`, `p1`, `phase-2`
- **Dependencies**: Earn Points (Issue 2), Program Config (Issue 4)

**Issue 10**: Advanced Segmentation
- **Actor**: Marketing Manager
- **User Story**: As a marketing manager, I want to create and manage customer segments using RFM analysis so that I can target the right members with relevant campaigns.
- **Labels**: `feature`, `segmentation`, `analytics`, `p1`, `phase-2`
- **Dependencies**: Member Enrollment (Issue 1), Earn Points (Issue 2)

**Issue 11**: Journey Builder (Journey Catalyst equivalent)
- **Actor**: Marketing Manager
- **User Story**: As a marketing manager, I want to build multi-step automated customer journeys without coding so that I can orchestrate complex loyalty workflows at scale.
- **Labels**: `feature`, `journey-builder`, `automation`, `p1`, `phase-2`, `differentiator`
- **Dependencies**: Campaign (Issue 5), Segmentation (Issue 10)

**Issue 12**: Refer A Friend
- **Actor**: Loyalty Member
- **User Story**: As a loyalty member, I want to refer friends to earn rewards so that I can grow the brand's customer base while being recognized for my advocacy.
- **Labels**: `feature`, `referral`, `advocacy`, `p1`, `phase-2`
- **Dependencies**: Member Enrollment (Issue 1)

**Issue 13**: Surveys, Quizzes & Zero-Party Data Collection
- **Actor**: Loyalty Member
- **User Story**: As a loyalty member, I want to complete surveys and quizzes to earn bonus points so that I can share my preferences and get more personalized experiences.
- **Labels**: `feature`, `surveys`, `zero-party-data`, `p1`, `phase-2`
- **Dependencies**: Member Enrollment (Issue 1), Program Config (Issue 4)

**Issue 14**: Progressive Profiling
- **Actor**: System / Loyalty Member
- **User Story**: As a marketing manager, I want the system to incrementally collect member preferences at each touchpoint so that member profiles enrich automatically over time.
- **Labels**: `feature`, `progressive-profiling`, `personalization`, `p1`, `phase-2`
- **Dependencies**: Member Enrollment (Issue 1), Surveys (Issue 13)

### Phase 3 — P2 (Advanced)

**Issue 15**: Social Loyalty
- **Actor**: Loyalty Member
- **User Story**: As a loyalty member, I want to earn points for social media actions so that I am rewarded for advocating for the brand online.
- **Labels**: `feature`, `social-loyalty`, `engagement`, `p2`, `phase-3`
- **Dependencies**: Member Enrollment (Issue 1)

**Issue 16**: Receipt Scanning
- **Actor**: Loyalty Member
- **User Story**: As a loyalty member, I want to scan purchase receipts to earn points so that I can earn loyalty rewards even from offline or in-store purchases.
- **Labels**: `feature`, `receipt-scanning`, `omnichannel`, `p2`, `phase-3`
- **Dependencies**: Member Enrollment (Issue 1), Earn Points (Issue 2)

**Issue 17**: Gamification (Badges, Challenges, Leaderboards)
- **Actor**: Loyalty Member
- **User Story**: As a loyalty member, I want to complete challenges and earn badges so that my engagement with the brand is fun and rewarding.
- **Labels**: `feature`, `gamification`, `engagement`, `p2`, `phase-3`
- **Dependencies**: Earn Points (Issue 2)

**Issue 18**: Multi-Brand / Multi-Region Management
- **Actor**: Admin
- **User Story**: As an enterprise admin, I want to manage multiple loyalty program instances across brands and regions so that I can run a unified global loyalty operation.
- **Labels**: `feature`, `multi-brand`, `enterprise`, `p2`, `phase-3`
- **Dependencies**: Program Config (Issue 4)

**Issue 19**: AI-Powered Personalization
- **Actor**: System / Marketing Manager
- **User Story**: As a marketing manager, I want the platform to use AI to recommend personalized offers and identify at-risk members so that I can proactively improve retention.
- **Labels**: `feature`, `ai-ml`, `personalization`, `p2`, `phase-3`
- **Dependencies**: Advanced Segmentation (Issue 10), Campaign (Issue 5)

**Issue 20**: Newsletter Subscription
- **Actor**: Guest
- **User Story**: As a website visitor, I want to subscribe to the CustomerEQ newsletter so that I can stay informed about loyalty industry insights.
- **Labels**: `feature`, `marketing-site`, `lead-nurture`, `p1`, `phase-1`
- **Dependencies**: None
