# Project Rules — CustomerEQ

These rules are always-on constraints for all AI agents working in this repository.
Last updated: 2026-03-24

---

## 1. MVP Scope is Locked

The MVP is exactly 7 GitHub issues: #2, #3, #4, #5, #6, #7, #9.
Do not implement, design, or suggest Phase 2/3 features until all 7 MVP issues are shipped.
When in doubt about scope, check the cutoff lines in `docs/replicate/IMPLEMENTATION_ROADMAP.md`.

## 2. Issue #6 is the Hero — Protect It

Issue #6 (Real-Time CX-to-Loyalty Campaign) is the product differentiator. Every architectural and implementation decision that touches the event pipeline must preserve the <15-minute feedback-to-action SLA. Never deprioritize or descope Issue #6 in favor of other features.

## 3. Feature Parity Trap — Do Not Fall In

Never add Annex Cloud features that are outside the 7-issue MVP scope, even if they seem quick to build. The business validation report identifies this as a 70% probability critical risk. If a stakeholder requests a Phase 2/3 feature before MVP is shipped, flag it explicitly as out of scope and link to the roadmap.

## 4. Architecture Document is Authoritative

`docs/architecture/architecture.md` is the authoritative source for technology choices, patterns, and rationale. Before proposing a new technology or pattern, check whether it conflicts with an existing architectural decision. If a significant new decision is made (one-way door), add an ADR to `docs/architecture/adr/`.

## 5. Event-Driven First — No Direct Writes for Loyalty Actions

Every loyalty action (earn points, tier upgrade, campaign trigger, reward redemption) must flow through the BullMQ event queue. No direct synchronous database writes for loyalty state changes from the API layer. The sequence is always:
`API → enqueue event → worker processes → database updated`

## 6. Multi-Tenant Always — brandId on Everything

All tenant-scoped entities must carry a `brandId` column. Prisma middleware enforces tenant scoping on every query. Never accept `brandId` from a request body — it must come from the verified JWT only. If adding a new entity, check whether it is tenant-scoped and add `brandId` accordingly.

## 7. PostgreSQL Ledger Integrity — Transactions for Earn/Burn

Points earn and burn operations must always use a database transaction that writes the `LoyaltyEvent` record and updates the member's `pointsBalance` atomically. Never update `pointsBalance` outside of a transaction. Never update `pointsBalance` without a corresponding `LoyaltyEvent` record.

## 8. Shared Test Utils — No Inline Mocks

All mocks, factories, fixtures, and test helpers live in `packages/config/src/test-utils/`. Import from `@customerEQ/config/test-utils` only. Never define a mock inline in a test file. If a mock does not exist yet, add it to the shared test utils package first, then use it. This prevents mock drift across test files.

## 9. Test Coverage Requirements by Priority

- **P0 features** (MVP): unit tests + integration tests + E2E tests. All three are required before a P0 issue can be closed.
- **P1 features**: unit tests + integration tests required.
- **P2 features**: unit tests required.

## 10. Branch and PR Convention

- Branch names: `feature/issue-{number}-{short-slug}` (e.g., `feature/issue-4-earn-points`)
- PRs must reference the issue: "Closes #N" in the PR description
- PRs merge to `develop`; `develop` merges to `main` for releases
- Never commit directly to `main`

## 11. Validation Commands (CI Gate)

The following commands must all pass before any PR is merged:
```
pnpm build       # Build all apps and packages
pnpm typecheck   # TypeScript strict mode — zero errors
pnpm lint        # ESLint — zero errors
pnpm test        # Vitest unit + integration tests
```
Smoke test (pre-deploy): `pnpm build && pnpm typecheck && pnpm test`

## 12. Secrets — Never in Code or Environment Files

All secrets (database credentials, API keys, JWT secrets) must be stored in AWS Secrets Manager and injected at runtime. Never commit secrets to the repository. Never store secrets in `.env` files that are checked in. `.env.example` files are permitted with placeholder values only.

## 13. GDPR/CCPA Compliance — Baked In, Not Bolted On

Any feature that creates or modifies PII (email, name, phone, purchase history, behavioral data) must:
- Use soft deletes (never hard-delete PII records without an erasure request)
- Respect `Member.consentGivenAt` — do not process data for members who have not given consent
- Be covered by the erasure job in `apps/worker` (PII fields zeroed out on erasure request)

## 14. Playwright for All Browser Automation

Use Playwright (MCP browser tools or the Playwright test runner) for all browser-based testing and automation. Do not use requests/axios/fetch-based scrapers as a primary approach for enterprise SaaS sites — they will be blocked by WAF. Lead with Playwright, not fallback to it.

## 15. Load Business Context Before Major Work

Before starting any significant feature work, replication analysis, or architectural decision, read:
- `docs/replicate/IMPLEMENTATION_ROADMAP.md` (scope and priority)
- `docs/architecture/architecture.md` (tech decisions and rationale)
- `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md` (ICP, differentiator, risks)
