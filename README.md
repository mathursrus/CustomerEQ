# CustomerEQ

CX-to-Loyalty platform: capture customer signals (surveys, reviews, support cases, social), turn them into health scores and segments, and drive loyalty programs (points, tiers, rewards, campaigns) off the back of them.

## Repo layout

Monorepo managed by `pnpm` workspaces + `turbo`.

```
apps/
  api/             Fastify API server          (port 4000)
  web/             Next.js admin UI            (port 3000)
  worker/          BullMQ worker (12 queues)   (no port)
  demo-storefront/ Next.js demo storefront     (port 3002)
  mcp-server/      MCP server exposing CustomerEQ as tools to AI agents
packages/
  database/        Prisma schema + client (consumed by api/worker)
  shared/          Domain types/utilities shared across apps
  ai/              BAML-backed LLM prompts and evals (sentiment, classify-intent, etc.)
  config/          Shared TS/ESLint config
  connectors/      External integration clients (Google Business Profile, LinkedIn, etc.)
  consent-text/    Consent-text token parser + HTML/React renderers
  embed/           Public-facing web components (CeqSupportChat, CeqSpinWheel)
  ui/              Shared React UI primitives
prisma/            Migration history (lives under packages/database)
```

The 12 worker queues (started by `apps/worker/src/index.ts`):
`loyalty-events`, `campaign-triggers`, `notifications`, `sentiment-analysis`, `feedback-clustering`, `embedding-generation`, `health-score-computation`, `survey-distribute`, `external-signal-sync`, `external-signal-ingestion`, `webhook-delivery`, `sla-breach-check`.

## Tech stack

- **Runtime:** Node 22+, pnpm 9, TypeScript
- **Web:** Next.js (admin UI), Lit-style web components for embeds
- **API:** Fastify
- **DB:** Postgres 16 + `pgvector` extension (pgvector image used in `docker-compose.yml`)
- **ORM:** Prisma 5
- **Queue:** BullMQ on Redis 7 (or `inline` mode — synchronous, no Redis)
- **Auth:** Clerk (wrapped behind an `IdentityProvider` interface — only `apps/api/src/auth/clerk-identity-provider.ts` may import `@clerk/*` directly)
- **AI:** BAML prompts compiled to TS, backed by Azure OpenAI
- **Build:** Turbo for orchestration, tsc/Next.js for compilation

## Local setup

You need Docker (for Postgres + Redis), Node 22+, and pnpm 9.

### 1. Install + boot infrastructure

```bash
pnpm install
docker compose up -d        # postgres on :5432, redis on :6379
cp .env.example .env
```

Edit `.env`. The bare minimum to boot the API (auth-protected routes will reject without real Clerk keys, but the server starts and `/healthz` works):

```env
DATABASE_URL="postgresql://customerEQ:customerEQ@localhost:5432/customerEQ"
REDIS_URL="redis://localhost:6379"
QUEUE_MODE="redis"            # or "inline" if you want to skip Redis entirely

# Real values — generate yourself
CEQ_OAUTH_STATE_SECRET="<openssl rand -hex 32>"
CLERK_WEBHOOK_SECRET="whsec_<openssl rand -base64 32>"   # see Gotcha #4

# Placeholders OK to start — replace with real Clerk keys to actually log in
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."

API_PORT=4000
API_HOST=0.0.0.0
EMAIL_PROVIDER="stub"
CEQ_OAUTH_CALLBACK_BASE_URL="http://localhost:4000"
CEQ_ADMIN_UI_BASE_URL="http://localhost:3000"
```

### 2. Symlink `.env` into each app and the database package

Most tools in this repo auto-load `.env` from their own CWD only — they do **not** walk up to the repo root. That includes Prisma (`packages/database/`), Next.js (`apps/web/`, `apps/demo-storefront/`), and `dotenv-cli` (used by api/worker dev scripts). Symlink the root `.env` into each:

```bash
ln -s ../../.env packages/database/.env
for app in api web worker demo-storefront mcp-server; do
  ln -s ../../.env "apps/$app/.env"
done
```

If you skip this, you'll see errors like:
- Prisma: `Environment variable not found: DATABASE_URL`
- `@clerk/nextjs: Missing publishableKey` (cascades into spurious `headers() should be awaited` errors via Next.js's `/_not-found` fallback)

### 3. Build internal packages

The API and worker import compiled output from internal packages (`@customerEQ/database/dist/index.js` etc.). They must be built before either app can boot:

```bash
pnpm build
```

11 internal packages will compile. (The `@customerEQ/web` Next.js production build can fail on auth-protected pages without real Clerk keys — that's fine, `pnpm dev` doesn't need it.)

### 4. Apply migrations

**Use `pnpm db:migrate` — not `pnpm db:push`.** See Gotcha #2.

```bash
pnpm db:migrate
pnpm db:generate              # regenerate Prisma client
```

### 5. Run

```bash
pnpm dev
```

Turbo runs all four apps in parallel:
- API → http://localhost:4000
- Web → http://localhost:3000
- Worker (no port — 12 BullMQ queues)
- Demo storefront → http://localhost:3002

To run just one: `pnpm --filter @customerEQ/api dev` (or `web`, `worker`, `demo-storefront`).

### Verify

```bash
pnpm healthz
# {"status":"ok","services":{"database":"ok","redis":"ok","api":"ok"},...}
```

## Setup gotchas

These are real failure modes encountered on a clean clone — fixes documented above are referenced by number.

1. **`Command "prisma" not found`** — you skipped `pnpm install`. Workspace deps haven't been hoisted yet.

2. **`type "public.vector" does not exist` on `pnpm db:push`** — pgvector is enabled inside a migration (`packages/database/prisma/migrations/20260403000000_add_kb_articles/migration.sql`), but `db push` skips migrations. The schema also uses `Unsupported("public.vector(1536)")` which `db push` can't materialize from the model alone. **Always use `pnpm db:migrate`** for first-run.

3. **`P3005: database schema is not empty`** — happens if a previous failed `db push` left half-built tables. Reset:
   ```bash
   docker exec customerEQ-postgres psql -U customerEQ -d customerEQ \
     -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION vector;"
   pnpm db:migrate
   ```

4. **`Base64Coder: incorrect characters for decoding` on API boot** — the in-code dev fallback for `CLERK_WEBHOOK_SECRET` (`whsec_dev_placeholder_not_used_for_verification`) is not valid base64; recent svix versions reject it in the constructor before any webhook is ever exercised. Set a real base64 placeholder in `.env`:
   ```bash
   echo "CLERK_WEBHOOK_SECRET=\"whsec_$(openssl rand -base64 32)\"" >> .env
   ```

5. **`Cannot find module '@customerEQ/database/dist/index.js'`** — internal packages export from `dist/`. Run `pnpm build` once before `pnpm dev`.

6. **`Environment variable not found: DATABASE_URL` from Prisma** — see step 2; Prisma doesn't search up the directory tree for `.env`.

7. **`@clerk/nextjs: Missing publishableKey`** in the web app, often accompanied by a flood of `headers() should be awaited` errors — same root cause: Next.js only auto-loads `.env` from `apps/web/`, not the repo root. Step 2's symlinks fix it. The async-headers errors are cascading: when Clerk throws during render, Next renders `/_not-found` which has its own sync-headers bug. They go away once the publishable key is found.

8. **`ENOENT: ... .next/server/pages/_document.js`** when navigating in the web app — stale `.next` cache from a previous failed `next build`. Clear it:
   ```bash
   rm -rf apps/web/.next apps/demo-storefront/.next
   ```
   Then restart `pnpm dev`.

9. **`Only plain objects, and a few built-ins, can be passed to Client Components from Server Components ... {}`** after signing in via Clerk — this is `@clerk/nextjs@5.x` paired with `next@15` passing un-awaited Promises (which serialize as `{}`) across the Server→Client boundary. Fix is to use `@clerk/nextjs@^6.x` (the Next 15-compatible major). Already pinned in `apps/web/package.json`. If you see this after a fresh clone, run `pnpm install` and clear `apps/web/.next`. The same root cause produces the `headers() should be awaited` errors in middleware — also fixed by v6.

## Common commands

```bash
pnpm dev                    # all apps
pnpm build                  # build all packages (turbo-cached)
pnpm typecheck              # tsc --noEmit across the workspace
pnpm lint                   # eslint
pnpm test                   # all unit tests
pnpm test:smoke             # unit tests, no API keys needed (PR gate)
pnpm test:integration       # API tests against real DB (needs DATABASE_URL)
pnpm test:baml              # BAML evals against real LLM (needs OPENAI_API_KEY)
pnpm test:e2e               # Playwright (web app must be running)
pnpm healthz                # curl /healthz against running API

pnpm db:migrate             # apply migrations
pnpm db:migrate:new         # create a new migration from schema diff
pnpm db:reset               # drop + recreate + re-run migrations + seed
pnpm db:generate            # regenerate Prisma client
pnpm db:studio              # Prisma Studio (DB browser)
pnpm seed:demo              # seed demo data
```

## Environment variables

Required (see step 1):
- `DATABASE_URL`, `REDIS_URL`, `QUEUE_MODE`
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`
- `CEQ_OAUTH_STATE_SECRET`, `CEQ_OAUTH_CALLBACK_BASE_URL`, `CEQ_ADMIN_UI_BASE_URL`
- `API_PORT`, `API_HOST`, `EMAIL_PROVIDER`

Feature-gated (only needed when exercising that path):
- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_BASE_URL` — BAML evals + live LLM analysis
- `AZURE_APPLICATION_INSIGHTS_CONNECTION_STRING` — observability
- `CEQ_SALESFORCE_WEBHOOK_SECRET`, `CEQ_HUBSPOT_WEBHOOK_SECRET` — CRM webhooks
- `CEQ_REDDIT_*`, `CEQ_X_BEARER_TOKEN`, `CEQ_GOOGLE_*`, `CEQ_LINKEDIN_*` — social ingestion
- `SENDGRID_API_KEY` / `RESEND_API_KEY` — real email delivery (default `EMAIL_PROVIDER=stub`)

App-specific examples worth checking:
- `apps/mcp-server/.env.example`
- `apps/demo-storefront/.env.example`

## Testing rules

(From `CLAUDE.md` — these are enforced.)

- **Tests must never skip.** A test that can't run (missing key, DB unreachable) must **fail with a clear error**, not skip.
- `pnpm test:smoke` — must pass on every PR; no API keys required.
- `pnpm test:baml` — requires `OPENAI_API_KEY`; fails (does not skip) if missing.
- `pnpm test:integration` — requires `DATABASE_URL`.
- `pnpm test:e2e` — requires dev server running.

## Production secrets policy

All production app secrets live in Azure Key Vault `customereq-kv` and are pulled into Container Apps via Key Vault references with system-assigned managed identities. ACR pulls also use managed identity. **Never** introduce plain `value:` secrets, `--secrets KEY=plain-value`, or admin-credential ACR pulls — see `CLAUDE.md` and `scripts/migrate-secrets-to-keyvault.sh` for the canonical pattern.

## Architecture notes

A knowledge graph of the codebase lives under `graphify-out/` (run `/graphify .` to regenerate). Highlights from the most recent build (1,635 nodes, 2,433 edges, 286 communities):

- **God nodes:** Fastify route handlers (`GET()`/`POST()`/`update()`), `getAuthToken()`, `CustomerEQ MCP Server`, `CeqSupportChat`, `ClerkIdentityProvider`. These are the cross-cutting integration points.
- **Largest communities:** API routes & plugins, worker job runtime, admin web pages & wizards, member-facing pages, anomaly detection + AI client, identity provider & auth, external review integrations (Google Business Profile, LinkedIn).
- **Embed surface:** Two web components shipped to customer storefronts — `CeqSupportChat` (SSE-driven support chat) and `CeqSpinWheel` (gamified loyalty campaign).

Open `graphify-out/graph.html` in a browser for the interactive view; `graphify-out/GRAPH_REPORT.md` for the audit + suggested-questions report.

## FRAIM

The `fraim/` directory contains repo-specific overrides for the FRAIM agent system. Job and skill discovery happens via the `mcp__fraim__*` MCP tools — directories like `fraim/ai-employee/jobs/` referenced in the generic adapter block of `CLAUDE.md` do **not** exist in this repo. See the "FRAIM — Repository Override (CustomerEQ)" section of `CLAUDE.md`.
