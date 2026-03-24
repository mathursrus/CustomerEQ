# Developer Guide — CustomerEQ Loyalty Platform

This guide explains how to pick up and work on issues from the Annex Cloud replication analysis.

---

## Quick Start

1. **Understand the product context**: Read [REPLICATION_ANALYSIS.md](reports/REPLICATION_ANALYSIS.md)
2. **Understand the roadmap**: Read [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)
3. **Find your issue**: Browse [GITHUB_ISSUES.md](GITHUB_ISSUES.md) or the [GitHub Issues list](https://github.com/mathursrus/CustomerEQ/issues)
4. **Start with Phase 1**: All Phase 1 P0 issues should be completed before Phase 2

---

## Reference Materials

| Resource | Path | When to Use |
|---------|------|-------------|
| Replication Analysis | `docs/replicate/reports/REPLICATION_ANALYSIS.md` | Overall context and strategy |
| Use Cases | `docs/replicate/analysis/use-cases.md` | Detailed user workflows and acceptance criteria |
| Data Models | `docs/replicate/analysis/data-models.md` | Entity definitions, fields, relationships |
| Technology Stack | `docs/replicate/analysis/technology-stack.md` | Recommended tech and architectural patterns |
| Component Catalog | `docs/replicate/screenshots/component-catalog.md` | UI component designs to replicate |
| Layout Patterns | `docs/replicate/screenshots/layout-patterns.md` | Page layout templates |
| Screenshot Index | `docs/replicate/screenshots/screenshot-index.md` | Visual reference screenshots |
| Implementation Roadmap | `docs/replicate/IMPLEMENTATION_ROADMAP.md` | Phase plan, dependencies, effort estimates |
| GitHub Issues Index | `docs/replicate/GITHUB_ISSUES.md` | All issues with links, labels, priorities |

---

## How to Pick Up an Issue

### Step 1: Read the Issue
Each GitHub issue contains:
- **User Story**: Who is doing what and why
- **Description**: Detailed feature context
- **Use Case Reference**: Links to detailed use case documentation
- **Screenshots**: Visual references from the Annex Cloud analysis
- **Technical Requirements**: Components, data models, API endpoints needed
- **Dependencies**: Issues that must be completed first
- **Acceptance Criteria**: Testable checklist of what "done" means

### Step 2: Review Dependencies
Check the **Dependencies** section in the issue and the dependency comments. Do not start an issue until all its dependencies are resolved.

### Step 3: Review the Use Case
Navigate to `docs/replicate/analysis/use-cases.md` and find the use case referenced in the issue (e.g., UC-04). Read the full use case including preconditions, steps, and acceptance criteria.

### Step 4: Review Visual References
- Check `docs/replicate/screenshots/screenshot-index.md` for relevant screenshots
- Open the referenced screenshots in `docs/replicate/screenshots/` to see what Annex Cloud built
- Use `docs/replicate/screenshots/component-catalog.md` for UI component specs
- Use `docs/replicate/screenshots/layout-patterns.md` for page layout templates

### Step 5: Review Data Models
Open `docs/replicate/analysis/data-models.md` to find the relevant entity definitions. The models are inferred from Annex Cloud but represent what we need to build.

### Step 6: Implement
Follow the FRAIM `feature-implementation` job for implementation workflow:
```
/fraim feature-implementation
```

### Step 7: Verify
Use the Acceptance Criteria in the issue as your definition of done. Each criterion should have a corresponding test.

---

## Architecture Overview

### Recommended Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React + TypeScript | Component-based, shadcn/ui |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Backend | Node.js (Fastify) | API-first REST |
| Database | PostgreSQL | Members, programs, events |
| Cache | Redis | Real-time leaderboards, session |
| Event Queue | BullMQ | Loyalty event processing |
| AI/ML | OpenAI API | Sentiment analysis, personalization |
| Auth | Auth0 | JWT, SSO, RBAC |
| Integrations | Custom webhooks | CRM, email, e-commerce |
| Infrastructure | AWS | EC2/ECS, RDS, ElastiCache |

### Core Architectural Patterns

**1. Event-Driven Loyalty Engine**
Every loyalty action flows through an event queue:
```
External System → POST /events → Event Queue → Rules Engine → Actions
```

**2. API-First**
Every capability exposed via REST API with OpenAPI documentation. No direct database access from frontend.

**3. Multi-Tenant**
All data scoped by `brandId`. Middleware enforces tenant isolation on every request.

**4. Real-Time Processing**
Loyalty events processed within 60 seconds. Use BullMQ workers for async event handling.

---

## Development Workflow

### Branch Strategy
```
main ← protected, deploy to production
develop ← integration branch
feature/issue-{number}-{slug} ← feature branches
```

### Feature Branch Convention
```bash
git checkout -b feature/issue-4-earn-points
```

### Commit Convention
Follow conventional commits:
```
feat(loyalty): add points earning rules engine (#4)
fix(members): resolve enrollment duplicate email error (#3)
test(rewards): add redemption flow integration tests (#5)
```

### Pull Request Process
1. Create PR from `feature/...` to `develop`
2. Reference the issue: "Closes #4"
3. Ensure all acceptance criteria are checked off
4. Run `feature-implementation` job completion workflow

---

## Testing Standards

### For Each Issue, Write:
- **Unit tests**: Individual functions/methods
- **Integration tests**: API endpoint + database
- **E2E tests** (P0 features): Full user workflow

### Test Naming Convention
```
describe('Earn Points — Rules Engine', () => {
  it('awards points when purchase event matches rule conditions')
  it('rejects duplicate events via idempotency key')
  it('halts rule when budget cap reached')
})
```

---

## Hero Feature: Real-Time CX-to-Loyalty Campaign

**Issue #6** is the most important issue in the entire project. It's the product differentiator that justifies CustomerEQ's existence.

### What Makes It Special
- **Annex Cloud** requires separate CX tools + manual campaign setup = 82-hour average response time
- **CustomerEQ** ingests CX events (NPS scores, support tickets, reviews) and automatically triggers loyalty actions within 15 minutes

### How It Works
```
1. CX event arrives (e.g., NPS=4 from Salesforce)
2. Campaign engine evaluates: "NPS < 7 → award 500 points + send sorry message"
3. Event queued for processing
4. Rules engine executes within 15 minutes
5. Member receives points + notification
```

### Success Metrics
- Time-to-action: < 15 minutes (vs. industry 82 hours)
- Campaign trigger accuracy: > 99%
- Zero duplicate triggers per member per campaign

---

## Key Decisions to Make Early

1. **Event schema**: Define a flexible but consistent `LoyaltyEvent` schema before building the rules engine
2. **Rules engine format**: JSON-based rule conditions vs. code-based (recommend JSON for no-code flexibility)
3. **Tenant isolation**: Row-level security in PostgreSQL vs. schema-per-tenant
4. **Real-time vs. near-real-time**: Start with 5-minute processing, optimize to <1 minute later
5. **Rewards catalog**: Build minimal internal catalog first; integrate external rewards provider (Tremendous, Rybbon) in Phase 2

---

## Getting Help

- **Use case unclear?** Read the full use case in `docs/replicate/analysis/use-cases.md`
- **Annex Cloud comparison?** Check the screenshots in `docs/replicate/screenshots/`
- **Data model question?** See `docs/replicate/analysis/data-models.md`
- **Architecture question?** See `docs/replicate/analysis/technology-stack.md`
- **Need context on why we're building this?** Read the [Business Validation Report](../business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md)

---

*Generated by FRAIM application-replication-workflow | 2026-03-24*
