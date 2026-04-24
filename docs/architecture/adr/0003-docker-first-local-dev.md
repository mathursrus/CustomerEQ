# ADR 0003 — Docker-First Local Development for Postgres and Redis

**Status**: Accepted
**Date**: 2026-04-24
**Deciders**: CustomerEQ engineering
**Establishing context**: Issue #179 — FRAIM project-onboarding. Recurring bootstrap failure where a host-installed Postgres service silently intercepted `localhost:5432` connections, leaving Prisma talking to a different database than `docker compose` had started.
**Related rule**: Project rule R19

---

## Context

New contributors on Windows and macOS frequently arrive with a host-installed Postgres (e.g., `postgresql-x64-16` on Windows, Homebrew's `postgresql@16` on macOS). When `docker compose up -d postgres` starts the container on the same `:5432`, both services appear to bind `0.0.0.0:5432`; the host service — running first as a persistent system service — actually accepts connections to `localhost`. Prisma's `DATABASE_URL=postgresql://...@localhost:5432/customerEQ` silently connects to the **host** Postgres, not the container.

The symptom observed during issue #179 onboarding:

- `docker compose up -d` reports `customerEQ-postgres` as healthy.
- `pnpm db:migrate` reports a partially applied migration state and a P3009 failed-migration error.
- `docker exec customerEQ-postgres psql ... -c "\dt"` shows an empty database.
- The partial state lives in the host Postgres, invisible to the container.

This produces confusing "DB drift" where the Docker DB is fresh but Prisma sees stale migration history. Diagnosing the collision is not obvious to anyone new to the repo.

## Decision

PostgreSQL and Redis run **exclusively** via `docker compose` for local development. Host-installed database services must be stopped, and their startup type set to Manual (Windows) or launchd/launchctl disabled (macOS/Linux), so they do not contend for ports 5432 and 6379. The canonical bring-up sequence is:

```
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed   # when available
pnpm dev
```

Applies to local development, integration test runs, and Playwright e2e runs. Production databases are managed infrastructure and are out of scope for this ADR.

## Alternatives Considered

### A. Allow host-installed Postgres, detect and work around it

Write a `pnpm dev:doctor` script that detects port 5432 collisions and prints remediation steps.

- **Pros**: Zero disruption to contributors who already have a host Postgres.
- **Cons**: Detection is best-effort; on Windows both host and container can appear to bind the port, making the "winner" non-deterministic. The `db:migrate` symptom surfaces far downstream of the root cause. Adds permanent tooling to paper over an avoidable conflict.
- **Why rejected**: Trades a one-time setup instruction for a permanent diagnostic surface. The simple rule "stop the host service" is cheaper for everyone in the long run.

### B. Remap the Docker services to non-default ports (e.g., 55432, 56379)

Change `docker-compose.yml` to publish `55432:5432` and `56379:6379`; update `.env.example` to match.

- **Pros**: Zero conflict with any host install, no admin action required.
- **Cons**: Every tool that assumes default ports (`psql`, Redis CLI, Prisma Studio shortcuts, third-party GUI tools, docs, copy-pasted commands from Stack Overflow) now needs local adjustment. Drift against production port assumptions. Onboarding docs fragment.
- **Why rejected**: The cost of non-default ports is paid by every contributor on every task; the cost of stopping a host service is paid once per machine.

### C. Support both Docker and host-installed Postgres as first-class options

Document both paths; make `DATABASE_URL` a per-contributor choice.

- **Pros**: Maximum flexibility.
- **Cons**: Two supported setups means two support burdens, two sets of bug reports, and two paths to keep in sync with production parity. The silent-intercept failure mode above is exactly what this path produces.
- **Why rejected**: "One supported setup" is less friction for the repo overall, even if individual contributors lose a preference.

## Consequences

### Positive

- Deterministic local environment: `DATABASE_URL=postgresql://...@localhost:5432/customerEQ` always points at the compose container.
- Single source of truth for the Postgres/Redis stack (`docker-compose.yml`), so local dev mirrors production configuration (pgvector extension, Redis version, etc.).
- Eliminates a recurring, confusing failure mode.
- Simplifies onboarding docs — one recommended setup path.

### Negative / Costs

- Contributors with a pre-existing host Postgres must stop it (and optionally set it to Manual startup). This is a one-time per-machine step; the FRAIM onboarding retrospective for issue #179 will include the Windows command (`sc config postgresql-x64-16 start= demand`) as a reference.
- Contributors running multiple local projects that each assume port 5432 must migrate those projects to Docker as well (per R19), or use Docker with per-project networks and different published ports outside this repo.
- Docker Desktop is now a hard prerequisite for local dev.

## Implementation

- Project rule R19 (Docker-first local dev) in `fraim/personalized-employee/rules/project_rules.md`.
- ADR 0002 (pgvector image pin) is the other half of this story — see it for the image choice.
- `.env.example` continues to document `DATABASE_URL` on `localhost:5432`; no change required.
- Future work (not covered by this ADR): add a `scripts/dev-doctor.mjs` that checks for port 5432 collisions before bringing up compose. Optional, non-blocking.
