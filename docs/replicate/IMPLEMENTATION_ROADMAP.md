# Implementation Roadmap — CustomerEQ Loyalty Platform

Based on the Annex Cloud replication analysis. Informed by the CustomerEQ business validation report.
**Date**: 2026-03-24

---

## Strategic Context

CustomerEQ's differentiation is not feature parity with Annex Cloud — it's the **real-time CX-to-loyalty feedback loop** that Annex Cloud lacks. The build order reflects this:

1. Build the foundational loyalty engine (earn/burn/tier)
2. Add the hero differentiator: real-time feedback-to-action automation
3. Layer on engagement features (gamification, referral, surveys)
4. Add enterprise/scale features last

---

## Phase 0 — Foundation (Weeks 1-4)
*Infrastructure and cross-cutting concerns. No user-facing features yet.*

| # | Concern | Description | Dependencies |
|---|---------|-------------|-------------|
| F-01 | Authentication & Auth | User/admin login, JWT, role-based access | None |
| F-02 | Multi-tenant data architecture | Customer-isolated database schema | F-01 |
| F-03 | Event queue infrastructure | BullMQ/Kafka for loyalty event processing | F-02 |
| F-04 | Core data models | Member, Program, Rule, Event, Reward, Segment schemas | F-02 |
| F-05 | API skeleton | REST API with OpenAPI spec, versioning | F-01, F-04 |
| F-06 | Frontend scaffolding | React + TypeScript + Tailwind + routing | None |

---

## Phase 1 — Core Features (Months 1-4)
*MVP: The minimum viable loyalty platform with hero differentiator*

### P0 — Critical Path

| Issue # | Use Case | Title | Actor | Dependencies |
|---------|----------|-------|-------|-------------|
| #1 | UC-09 | Configure Loyalty Program | Admin | F-01 to F-06 |
| #2 | UC-03 | Member Enrollment | Loyalty Member | #1, F-01 |
| #3 | UC-04 | Earn Points | Loyalty Member | #1, #2, F-03 |
| #4 | UC-05 | Redeem Reward | Loyalty Member | #3 |
| #5 | UC-10 | Create & Launch Campaign ⭐ | Marketing Manager | #1, #3 |
| #6 | UC-13 | Loyalty Analytics Dashboard | Analyst | #3, #4 |
| #7 | UC-01 | Demo Request Form | Guest | F-06 |
| #20 | UC-02 | Newsletter Subscription | Guest | F-06 |

**⭐ Hero Feature**: Issue #5 (Campaign) is the real-time CX feedback-to-action differentiator. This is what sets CustomerEQ apart from Annex Cloud.

### P1 — Phase 1 Enhancement

| Issue # | Use Case | Title | Actor | Dependencies |
|---------|----------|-------|-------|-------------|
| #8 | UC-14 | CRM Integration (Salesforce + HubSpot) | IT/Developer | #2, #3 |

**Phase 1 Success Criteria**:
- [ ] Admin can configure a loyalty program in < 30 minutes
- [ ] Members can enroll, earn points, and redeem rewards
- [ ] Campaign triggers loyalty action within 15 minutes of CX event
- [ ] Analytics dashboard shows program ROI metrics
- [ ] Demo request form live on marketing site
- [ ] Salesforce + HubSpot integration working

---

## Phase 2 — Enhanced Features (Months 4-8)
*Deepen the program with personalization and engagement tools*

### P1 — Core Enhancements

| Issue # | Use Case | Title | Actor | Dependencies |
|---------|----------|-------|-------|-------------|
| #9 | UC-06 | Tier Progression | Loyalty Member | #3, #1 |
| #10 | UC-12 | Advanced Segmentation (RFM) | Marketing Manager | #2, #3 |
| #11 | UC-11 | Journey Builder (no-code) | Marketing Manager | #5, #10 |
| #12 | UC-08 | Refer A Friend | Loyalty Member | #2 |
| #13 | UC-07 | Surveys, Quizzes & Contests | Loyalty Member | #2, #1 |
| #14 | UC-15 | Progressive Profiling | System | #2, #13 |

**Phase 2 Success Criteria**:
- [ ] Members advance through tiers automatically
- [ ] Marketing can create segments in < 5 minutes using RFM
- [ ] Journey builder allows multi-step workflows without code
- [ ] Referral program tracks attribution end-to-end
- [ ] Survey responses stored as member profile attributes

---

## Phase 3 — Advanced Features (Months 8-14)
*Expand to enterprise-grade and advanced engagement*

### P2 — Advanced

| Issue # | Use Case | Title | Actor | Dependencies |
|---------|----------|-------|-------|-------------|
| #15 | UC-16 | Social Loyalty | Loyalty Member | #2 |
| #16 | UC-17 | Receipt Scanning | Loyalty Member | #2, #3 |
| #17 | UC-18 | Gamification (Badges, Leaderboards) | Loyalty Member | #3 |
| #18 | UC-19 | Multi-Brand / Multi-Region | Admin | #1 |
| #19 | UC-20 | AI-Powered Personalization | System | #10, #5 |

**Phase 3 Success Criteria**:
- [ ] Social actions verified and credited within 60 seconds
- [ ] Receipt OCR accuracy > 95% on common receipt formats
- [ ] Gamification drives measurable engagement lift
- [ ] Multi-brand admin can manage 5+ brands from one dashboard
- [ ] AI churn prediction achieves > 70% accuracy

---

## Dependency Graph

```
F-01 (Auth) ──────────────────────────────────────────────────┐
F-02 (Multi-tenant) ─────────────────────────────────────────┐│
F-03 (Event Queue) ─────────────────────────────────────────┐││
F-04 (Data Models) ─────────────────────────────────────────┤││
F-05 (API) ──────────────────────────────────────────────────┤││
F-06 (Frontend) ────────────────────────────────────────────┐└┘│
                                                            │  │
#1 Configure Program ←──────────────────────────────────────┘  │
  ↓                                                            │
#2 Member Enrollment ←──────────────────────────────────────── ┘
  ↓
#3 Earn Points ← #8 CRM Integration
  ↓
#4 Redeem Reward
#5 Campaign ⭐ (Hero)
#6 Analytics Dashboard
  ↓
#9 Tier Progression
#10 Advanced Segmentation
  ↓
#11 Journey Builder
#12 Refer A Friend ← #2
#13 Surveys ← #2
#14 Progressive Profiling ← #13
  ↓
#15 Social Loyalty
#16 Receipt Scanning
#17 Gamification
#18 Multi-Brand ← #1
#19 AI Personalization ← #10, #5
```

---

## GitHub Labels to Create

### Priority Labels
| Label | Color | Description |
|-------|-------|-------------|
| `p0` | `#d73a4a` | Critical path, MVP blocking |
| `p1` | `#e4b429` | High priority, Phase 1-2 |
| `p2` | `#0075ca` | Medium priority, Phase 3 |

### Feature Category Labels
| Label | Color | Description |
|-------|-------|-------------|
| `loyalty-engine` | `#7B2FBE` | Core loyalty mechanics |
| `member-lifecycle` | `#5319e7` | Member enrollment, tier, profile |
| `rewards` | `#fbca04` | Rewards catalog and redemption |
| `campaigns` | `#0e8a16` | Campaign creation and management |
| `cx-loyalty-integration` | `#e11d48` | CustomerEQ hero differentiator |
| `analytics` | `#1d76db` | Reporting and dashboards |
| `integrations` | `#84b6eb` | CRM and platform connectors |
| `journey-builder` | `#7057ff` | No-code workflow automation |
| `segmentation` | `#006b75` | Customer segmentation |
| `gamification` | `#f9d0c4` | Badges, leaderboards, challenges |
| `ai-ml` | `#e4e669` | AI/ML features |
| `marketing-site` | `#bfd4f2` | Public-facing website |
| `admin` | `#cfd3d7` | Admin configuration |

### Phase Labels
| Label | Color | Description |
|-------|-------|-------------|
| `phase-1` | `#c2e0c6` | Phase 1: Core MVP |
| `phase-2` | `#bfd4f2` | Phase 2: Enhanced |
| `phase-3` | `#fef2c0` | Phase 3: Advanced |

---

## Effort Estimates

| Phase | Issues | Estimated Effort | Team Size |
|-------|--------|-----------------|-----------|
| Foundation | 6 tasks | 4 weeks | 2 engineers + 1 DevOps |
| Phase 1 Core | 8 issues | 12 weeks | 2 full-stack + 1 frontend |
| Phase 2 Enhanced | 6 issues | 16 weeks | 3 engineers |
| Phase 3 Advanced | 5 issues | 20 weeks | 4 engineers + 1 ML |
| **Total** | **25** | **~52 weeks** | **Scales 2→4 engineers** |

---

*See [REPLICATION_ANALYSIS.md](reports/REPLICATION_ANALYSIS.md) for full context.*
*See [INDEX.md](INDEX.md) for all artifacts.*
