# ADR 0002 — Pin `pgvector/pgvector:pg16` for local and non-production Postgres

**Status**: Accepted
**Date**: 2026-04-24
**Deciders**: CustomerEQ engineering
**Establishing context**: Issue #178 — local `docker compose up -d && pnpm db:migrate` failing on `CREATE EXTENSION vector`
**Related rule**: Project rule R20

---

## Context

Migration `packages/database/prisma/migrations/20260403000000_add_kb_articles/migration.sql` runs `CREATE EXTENSION IF NOT EXISTS vector` to enable the `vector(1536)` column on the `KbArticle.embedding` field (RAG intent classification, shipped in issue #100). This extension is pgvector, which is **not** bundled with the generic `postgres:16-alpine` image that `docker-compose.yml` used.

A fresh `docker compose up -d postgres && pnpm db:migrate` consequently failed with:

```
ERROR: extension "vector" is not available
DETAIL: Could not open extension control file
  "/usr/local/share/postgresql/extension/vector.control": No such file or directory.
```

This is a first-run bootstrap failure: anyone cloning the repo onto a fresh machine cannot get past migration #14 without an out-of-band extension install.

## Decision

Use `pgvector/pgvector:pg16` (the pgvector project's official Postgres 16 image) as the `postgres` service in `docker-compose.yml`. Never downgrade this image to `postgres:16-alpine` or any other image that lacks the `vector` extension.

Production Postgres (Azure Database for PostgreSQL Flexible Server) already enables the `vector` extension via server parameters, so no production change is required. This ADR covers local development, integration testing, and ephemeral environments that use `docker-compose.yml`.

## Alternatives Considered

### A. Keep `postgres:16-alpine`, install pgvector via init script

Build pgvector inside a one-shot `docker-compose` init container or a `Dockerfile` layered on top of `postgres:16-alpine`.

- **Pros**: Retains the small alpine base image.
- **Cons**: Extra moving parts — a build step, a custom Dockerfile, or an init container. Slower first-run. More surface area to go wrong. No gain over the official pgvector image.
- **Why rejected**: Extra complexity with no benefit; pgvector's official image is maintained and pinned by the extension authors.

### B. Drop the `vector` column and implement RAG without pgvector

Swap pgvector for an alternative (e.g., serialize embeddings to JSONB, compute cosine similarity in application code, or use an external vector DB).

- **Pros**: Removes a Postgres extension dependency.
- **Cons**: Performance regression on similarity search at scale; requires reworking issue #100's RAG pipeline; no alignment with production (production already has pgvector).
- **Why rejected**: pgvector is already the production choice; local dev must mirror production to catch bugs early (project rule 11a principle).

### C. Document the extension install as a manual step

Leave the image alone; document "install pgvector manually" in a README.

- **Pros**: Zero change to compose.
- **Cons**: Every new contributor hits the same bootstrap failure. Manual extension installs are OS-specific and error-prone on Windows/macOS/Linux. Violates the "fresh clone → working dev env in one command" bar.
- **Why rejected**: Manual setup steps are a recurring source of onboarding friction and support load.

## Consequences

### Positive

- `docker compose up -d && pnpm db:migrate` works on a fresh clone without extra steps.
- Local dev and production use the same pgvector version.
- Future migrations can freely use `vector` columns and operators without re-justifying the extension.

### Negative / Costs

- Image size is slightly larger than `postgres:16-alpine` (pgvector adds ~30 MB). Negligible for local dev and CI.
- The image is maintained by the pgvector project, not the Postgres core team. Low risk — pgvector is a widely adopted extension with active releases — but it is an extra supply-chain dependency.

## Implementation

Single-line change in `docker-compose.yml`:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16  # was: postgres:16-alpine
```

Landed in PR for issue #178.
