# Project Rules - CustomerEQ

These rules are always-on constraints for all AI agents working in this repository.
Last updated: 2026-04-24

---

## 1. Post-MVP Scope Discipline

The original 7-issue MVP (#2, #3, #4, #5, #6, #7, #9) established the foundation and hero workflow for CustomerEQ.
The repository is now allowed to design and implement post-MVP features when they clearly extend the unified CX-to-loyalty platform and do not undermine the differentiator.
When in doubt about scope, use `docs/replicate/IMPLEMENTATION_ROADMAP.md` as a prioritization guide rather than a hard stop, and prefer features that deepen CustomerEQ's CX signal ingestion, orchestration, and measurable business impact.

## 2. Issue #6 is the Hero - Protect It

Issue #6 (Real-Time CX-to-Loyalty Campaign) is the product differentiator. Every architectural and implementation decision that touches the event pipeline must preserve the <15-minute feedback-to-action SLA. Never deprioritize or descope Issue #6 in favor of other features.

## 3. Feature Parity Trap - Still Do Not Fall In

Do not add Annex Cloud-style features just for checklist parity. Post-MVP work must still strengthen CustomerEQ's differentiated position: unified CX signal ingestion, real-time actioning, customer intelligence, and ROI visibility.
If a requested feature is mostly parity with weak strategic value, flag that tradeoff explicitly and tie the recommendation back to the roadmap and business validation report.

## 4. Architecture Document is Authoritative

`docs/architecture/architecture.md` is the authoritative source for technology choices, patterns, and rationale. Before proposing a new technology or pattern, check whether it conflicts with an existing architectural decision. If a significant new decision is made (one-way door), add an ADR to `docs/architecture/adr/`.

## 5. Event-Driven First - No Direct Writes for Loyalty Actions

Every loyalty action (earn points, tier upgrade, campaign trigger, reward redemption) must flow through the BullMQ event queue. No direct synchronous database writes for loyalty state changes from the API layer. The sequence is always:
`API -> enqueue event -> worker processes -> database updated`

## 6. Multi-Tenant Always - brandId on Everything

All tenant-scoped entities must carry a `brandId` column. Prisma middleware enforces tenant scoping on every query. Never accept `brandId` from a request body - it must come from the verified JWT only. If adding a new entity, check whether it is tenant-scoped and add `brandId` accordingly.

## 7. PostgreSQL Ledger Integrity - Transactions for Earn/Burn

Points earn and burn operations must always use a database transaction that writes the `LoyaltyEvent` record and updates the member's `pointsBalance` atomically. Never update `pointsBalance` outside of a transaction. Never update `pointsBalance` without a corresponding `LoyaltyEvent` record.

## 8. Shared Test Utils - No Inline Mocks

All mocks, factories, fixtures, and test helpers live in `packages/config/src/test-utils/`. Import from `@customerEQ/config/test-utils` only. Never define a mock inline in a test file. If a mock does not exist yet, add it to the shared test utils package first, then use it. This prevents mock drift across test files.

## 9. Test Coverage Requirements by Priority

- **P0 features**: unit tests + integration tests + E2E tests. All three are required before a P0 issue can be closed.
- **P1 features**: unit tests + integration tests required.
- **P2 features**: unit tests required.

## 10. Branch and PR Convention

- **Every branch must be tied to a GitHub issue.** File the issue first, then branch.
- Branch names: `feature/issue-{number}-{short-slug}` (e.g., `feature/issue-4-earn-points`).
- PRs must reference the issue: "Closes #N" in the PR description.
- PRs merge to `main` via the feature branch. The repo does not use a `develop` branch.
- Never commit directly to `main`.
- One issue per branch. Unrelated fixes — even small ones — get their own issue and branch (see R21).

## 11. Validation Commands (CI Gate)

The following commands must all pass before any PR is merged:
```
pnpm build       # Build all apps and packages
pnpm typecheck   # TypeScript strict mode - zero errors
pnpm lint        # ESLint (typescript-eslint) - zero errors, warnings OK
pnpm test:smoke  # All unit tests across all packages
```
Smoke test (pre-deploy): `pnpm build && pnpm typecheck && pnpm test:smoke`

Full validation (pre-release):
```
pnpm test:smoke        # Unit tests (fast, no API keys)
pnpm test:integration  # API integration tests (needs DB)
pnpm test:baml         # BAML eval tests (calls real LLM - needs OPENAI_API_KEY)
pnpm test:e2e          # Playwright browser tests (needs dev server)
```

## 11a. Tests Must Never Skip - Fail Loudly

Tests must NEVER silently skip when dependencies are missing. If a test requires an API key, database connection, or external service, it must **fail with a clear error message** explaining what's missing - not skip or pass vacuously. This applies to:
- BAML eval tests: must fail if `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is not set
- Integration tests: must fail if `DATABASE_URL` is not reachable
- E2E tests: must fail if the dev server is not running

The principle: a green test suite means everything was actually verified, not that tests were skipped.

## 12. Secrets - Never in Code or Environment Files

All secrets (database credentials, API keys, JWT secrets) must be stored in AWS Secrets Manager and injected at runtime. Never commit secrets to the repository. Never store secrets in `.env` files that are checked in. `.env.example` files are permitted with placeholder values only.

## 13. GDPR/CCPA Compliance - Baked In, Not Bolted On

Any feature that creates or modifies PII (email, name, phone, purchase history, behavioral data) must:
- Use soft deletes (never hard-delete PII records without an erasure request)
- Respect `Member.consentGivenAt` - do not process data for members who have not given consent
- Be covered by the erasure job in `apps/worker` (PII fields zeroed out on erasure request)

## 14. Playwright for All Browser Automation

Use Playwright (MCP browser tools or the Playwright test runner) for all browser-based testing and automation. Do not use requests/axios/fetch-based scrapers as a primary approach for enterprise SaaS sites - they will be blocked by WAF. Lead with Playwright, not fallback to it.

## 15. Fix at the Right Abstraction Level

Before implementing a fix that touches more than 3 files with the same change, stop and ask: "Should this live in a shared layer instead?" Specifically:
- **CSS/styling issues** affecting multiple pages -> fix in `globals.css` or a shared component, not per-file Tailwind classes.
- **Repeated logic** across pages -> extract to a shared utility or hook.
- **Configuration** scattered across files -> centralize in a config file or environment variable.

The test: if a new page would need the same fix applied manually, the abstraction level is wrong. Default to the highest level that works.

## 16. Orchestrator Pre-Flight: Full Scope From Source of Truth

Before launching implementation agents for any issue, the orchestrator MUST:
1. **Read the GitHub issue acceptance criteria** - these are the source of truth, not derived artifacts.
2. **Read the feature spec** (including UI mocks section) - verify all deliverable types are covered.
3. **Cross-reference the RFC/technical design** against the issue ACs - if any AC is missing from the RFC, fail the design review before proceeding.
4. **List ALL deliverables in the agent prompt** - backend (API, models, queues, MCP tools) AND frontend (admin pages, UI components, navigation changes) AND tests.
5. **Read traceability matrices from sub-agents** - verify the requirement rows match the original issue ACs, not a subset.

This rule exists because a prior failure shipped 4 features with complete backends but zero admin UI. The agents did exactly what they were told; the orchestrator scoped out the UI.

## 17. Load Business Context Before Major Work

Before starting any significant feature work, replication analysis, or architectural decision, read:
- `docs/replicate/IMPLEMENTATION_ROADMAP.md` (scope and priority)
- `docs/architecture/architecture.md` (tech decisions and rationale)
- `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md` (ICP, differentiator, risks)

## 18. Validate User Flows End-to-End — Not API Shortcuts

Never claim a user-facing feature is "validated" based solely on API-level tests (curl with test headers, Playwright without auth). For any flow the user initiates from the browser:
1. Trace the exact user path: what does the click trigger, what URL does the browser hit, how does auth get there?
2. Browser redirects (`window.location.href`, OAuth callbacks, email links) cannot carry Bearer tokens — endpoints must be public or auth must be passed via query param/cookie/signed state.
3. If you cannot test the real flow (e.g., Playwright can't auth with Clerk), say so honestly. Partial validation is not validation.
4. When Playwright fails to authenticate, treat it as a signal about the real user flow — don't dismiss it as a "Playwright limitation."

## 19. Docker-First Local Development

PostgreSQL and Redis run exclusively via `docker compose` for local development. Host-installed database services (e.g., Windows `postgresql-x64-16`) must be stopped and set to Manual startup so they do not contend for port 5432 with the compose container. The canonical bring-up sequence is `docker compose up -d && pnpm install && pnpm db:migrate`. See ADR 0003.

## 20. pgvector Postgres Image Is Pinned

The `postgres` service in `docker-compose.yml` uses `pgvector/pgvector:pg16` — never downgrade to `postgres:16-alpine` or a generic upstream Postgres image. Migration `20260403000000_add_kb_articles` runs `CREATE EXTENSION vector`, which requires pgvector to be installed on the server. See ADR 0002.

## 21. Branch Scope Hygiene — One Issue Per Branch

Unrelated fixes — dev-environment patches, infrastructure tweaks, small cross-cutting cleanups — get their own issue and branch. Do not bundle off-topic commits onto an active feature branch, even when the change is small or the branch is convenient. If a fix is discovered mid-feature and is not in the feature's acceptance criteria, file a new issue, branch off `main`, and PR it separately. This rule is a direct corollary of rule 10.

## 22. Prisma Migration Hygiene

Three constraints apply to every migration, generated or hand-written:

**22a. Column identifiers must match Prisma's camelCase quoting.** Prisma always generates SQL with quoted camelCase identifiers (e.g., `"memberId"`, `"surveyId"`, `"importBatchId"`). Hand-written DDL that uses snake_case (e.g., `"member_id"`) will fail at deploy with `column does not exist`. Before writing any column reference in a hand-written migration, run: `grep -r "column_name" packages/database/prisma/migrations/ | head -5` on an analogous existing migration to verify exact casing.

**22b. Migration drafts must be deleted the moment a canonical replacement is written.** If a spike migration is created during exploratory work and later superseded by a canonical replacement, delete the draft in the same commit that creates the replacement. Never leave two migration directories that touch the same table in `prisma/migrations/` simultaneously. Before committing any migration, run: `ls packages/database/prisma/migrations/ | grep <feature-slug>` to confirm exactly one directory exists for this feature.

**22c. Timestamps are a coordination contract between concurrent PRs.** When a feature branch has been in flight for more than a few days, check `git log origin/main --oneline -- packages/database/prisma/migrations/` before finalising a migration timestamp. If another PR has claimed the same `YYYYMMDDNNNNNN` prefix, rename your migration to a later timestamp before pushing.

## 23. Bulk Import Consent Contract Differs From Live-Response Consent

Rule 13 (GDPR/CCPA) requires respecting `Member.consentGivenAt` before processing data. This gate applies to **live survey responses** where consent is captured in real time. It does **not** apply to **bulk historical import processors**: the integrator has already verified consent at export time, and `resolveOrEnrollMember(BULK_IMPORT)` auto-stamps consent for newly enrolled members. Bulk import processors must set `memberId` after successful member resolution unconditionally — do not gate it on `member.consentGivenAt`.
