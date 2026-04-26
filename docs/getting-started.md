# Getting Started with CustomerEQ

This guide helps new collaborators set up a local development environment and start contributing to CustomerEQ.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | >= 22 | [nodejs.org](https://nodejs.org/) or `nvm install 22` |
| **pnpm** | >= 9 | `corepack enable && corepack prepare pnpm@9 --activate` |
| **Docker** | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

---

## 1. Clone and Install

```bash
git clone https://github.com/mathursrus/CustomerEQ.git
cd CustomerEQ
pnpm install
```

This installs dependencies for all apps and packages in the monorepo.

---

## 2. Start Infrastructure

CustomerEQ uses PostgreSQL 16 and Redis 7 locally via Docker Compose:

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432` (user: `customerEQ`, password: `customerEQ`, db: `customerEQ`)
- **Redis** on `localhost:6379`

Verify both containers are healthy:

```bash
docker compose ps
```

---

## 3. Configure Environment

```bash
cp .env.example .env
```

The defaults in `.env.example` work for local development. You will need to add **Clerk keys** to enable authentication:

1. Create a free account at [clerk.com](https://clerk.com/)
2. Create an application and an organization
3. Copy `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` into `.env`

For webhook testing (optional), set `CEQ_SALESFORCE_WEBHOOK_SECRET` and/or `CEQ_HUBSPOT_WEBHOOK_SECRET`.

---

## 4. Set Up the Database

```bash
pnpm db:generate    # Generate the Prisma client from the schema
pnpm db:migrate     # Run all migrations
```

To explore the database visually:

```bash
pnpm db:studio      # Opens Prisma Studio at http://localhost:5555
```

Other useful database commands:

| Command | Purpose |
|---|---|
| `pnpm db:migrate:new` | Create a new migration after schema changes |
| `pnpm db:reset` | Drop and recreate the database (destructive) |
| `pnpm db:push` | Push schema changes without creating a migration |

---

## 5. Start Development

```bash
pnpm dev
```

This starts all three apps in parallel via Turborepo:

| App | URL | Description |
|---|---|---|
| **web** | `http://localhost:3000` | Next.js frontend (marketing + admin + member portals) |
| **api** | `http://localhost:4000` | Fastify REST API |
| **worker** | (background) | BullMQ event processors |

Verify the API is running:

```bash
curl http://localhost:4000/healthz
```

---

## 6. Project Structure

```
CustomerEQ/
├── apps/
│   ├── api/          # Fastify v5 REST API (loyalty engine)
│   ├── web/          # Next.js 15 frontend (App Router)
│   └── worker/       # BullMQ workers (async event processing)
├── packages/
│   ├── database/     # Prisma schema + migrations
│   ├── shared/       # Zod schemas + TypeScript types + queue constants
│   ├── config/       # Shared test utilities (factories, mocks, helpers)
│   └── ui/           # Shared Tailwind utilities
├── docs/             # Architecture, roadmap, specs
├── fraim/            # FRAIM AI workflow framework
├── docker-compose.yml
├── turbo.json        # Turborepo task config
└── pnpm-workspace.yaml
```

For full architectural details, see [`docs/architecture/architecture.md`](architecture/architecture.md).

---

## 7. Running Tests

```bash
pnpm test              # Unit tests (all packages)
pnpm test:integration  # Integration tests (real database)
pnpm test:e2e          # E2E browser tests (Playwright, requires running app)
pnpm test:all          # Unit + integration
```

### Test utilities

All mocks, factories, and helpers live in `packages/config/src/test-utils/`. Import from `@customerEQ/config/test-utils` — never define inline mocks.

Example:

```typescript
import {
  createBrand,
  createConsentedMember,
  createProgramWithRules,
  authenticatedRequest,
} from '@customerEQ/config/test-utils';
```

---

## 8. Validation (CI Gate)

Before submitting a PR, all of these must pass:

```bash
pnpm build       # Build all apps and packages
pnpm typecheck   # TypeScript strict mode — zero errors
pnpm lint        # ESLint — zero errors
pnpm test        # Vitest unit + integration tests
```

Quick smoke test:

```bash
pnpm check       # Runs typecheck + lint + test
```

---

## 9. Branch and PR Conventions

- **Branch names**: `feature/issue-{number}-{short-slug}` (e.g., `feature/issue-4-earn-points`)
- **PR descriptions** must include `Closes #N` to link the issue
- PRs merge to `develop`; `develop` merges to `main` for releases
- Never commit directly to `main`

---

## 10. Key Conventions

1. **Multi-tenant**: All tenant-scoped entities carry a `brandId`. Never accept `brandId` from request bodies — it comes from the JWT.

2. **Event-driven**: Loyalty actions flow through BullMQ queues, not direct DB writes:
   ```
   API -> enqueue event -> worker processes -> database updated
   ```

3. **Transactional points**: All earn/burn operations use a DB transaction that writes the `LoyaltyEvent` and updates `pointsBalance` atomically.

4. **No inline mocks**: All test mocks live in `packages/config/src/test-utils/`. If a mock doesn't exist, add it there first.

5. **Secrets**: Never commit secrets. Use `.env` locally (gitignored) and Azure Key Vault in production.

---

## 11. Useful Links

| Resource | Path |
|---|---|
| Architecture document | `docs/architecture/architecture.md` |
| Implementation roadmap | `docs/replicate/IMPLEMENTATION_ROADMAP.md` |
| Data models reference | `docs/replicate/analysis/data-models.md` |
| Prisma schema | `packages/database/prisma/schema.prisma` |
| API routes | `apps/api/src/routes/` |
| Shared Zod schemas | `packages/shared/src/zod/` |
| Test utilities | `packages/config/src/test-utils/` |
| Project rules | `fraim/personalized-employee/rules/project_rules.md` |

---

## Troubleshooting

**Docker containers won't start**: Make sure Docker Desktop is running and ports 5432/6379 are not in use.

**Prisma client errors after schema change**: Run `pnpm db:generate` to regenerate the client.

**Auth errors in dev**: Ensure `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` are set in `.env`. For integration tests, the auth plugin accepts `X-Test-Brand-Id` and `X-Test-User-Id` headers when `NODE_ENV=test`.

**Redis connection refused**: Verify Redis is running with `docker compose ps`. The default URL is `redis://localhost:6379`.
