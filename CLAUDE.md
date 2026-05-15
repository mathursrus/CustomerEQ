<!-- FRAIM_AGENT_ADAPTER_START -->
## FRAIM

This repository uses FRAIM.

- The FRAIM discovery catalog lives under `fraim/`.
- Jobs under `fraim/ai-employee/jobs/` and `fraim/ai-manager/jobs/` are FRAIM's primary execution units. Treat them like first-class workflows when deciding how to execute work.
- Skills under `fraim/ai-employee/skills/` are reusable capabilities that jobs compose.
- Rules under `fraim/ai-employee/rules/` are always-on constraints and conventions.
- Repo-specific overrides and learning artifacts live under `fraim/personalized-employee/` and take precedence over synced baseline content.
- Before acting on any user request, scan the job stubs under `fraim/ai-employee/jobs/` and `fraim/ai-manager/jobs/` to identify the most appropriate job. Read stub filenames and their Intent/Outcome sections to match the request to the right job.
- Once you identify the relevant job, call `get_fraim_job({ job: "<job-name>" })` to get the full phased instructions.
- For deeper capability detail, call `get_fraim_file({ path: "skills/<category>/<skill-name>.md" })` or `get_fraim_file({ path: "rules/<category>/<rule-name>.md" })`.
- Read `fraim/personalized-employee/rules/project_rules.md` if it exists before doing work.
- When users ask for next step recommendations, use recommend-next-job skill under `fraim/ai-employee/skills/` to gather context before suggesting jobs.

> [!IMPORTANT]
> **Job stubs are for discovery only.** When a user @mentions or references any file under `fraim/ai-employee/jobs/` or `fraim/ai-manager/jobs/`, do NOT attempt to execute the job from the stub content. The stub only shows intent and phase names. Always call `get_fraim_job({ job: "<job-name>" })` first to get the full phased instructions before doing any work.
<!-- FRAIM_AGENT_ADAPTER_END -->

## FRAIM — Repository Override (CustomerEQ)

The generic adapter block above points at `fraim/ai-employee/jobs/` and `fraim/ai-manager/jobs/` stub directories. **These directories do not exist in this repo.** For discovery, use the FRAIM MCP tools directly:

- `mcp__fraim__list_fraim_jobs()` — list all available FRAIM jobs by category.
- `mcp__fraim__get_fraim_job({ job: "<name>" })` — fetch full phased instructions for a job.
- `mcp__fraim__get_fraim_file({ path: "skills/<category>/<skill>.md" | "rules/<category>/<rule>.md" })` — fetch skill or rule content.
- `mcp__fraim__fraim_connect(...)` — start a FRAIM session (required once per conversation before other MCP calls).

Personalized overrides still live on disk under `fraim/personalized-employee/` and take precedence over synced baseline content. Always read `fraim/personalized-employee/rules/project_rules.md` before acting.

## Production Secrets Policy (Issue #200)

All production app secrets are sourced from Azure Key Vault `customereq-kv` via Container Apps Key Vault references. Container Apps must pull images from ACR `customereqcr` using their system-assigned managed identity. Violating this puts secrets back in plain text inside Container App config and re-introduces shared admin credentials for ACR — both of which Issue #200 was opened to fix.

**Required pattern for any secret a container needs:**
- The secret value lives in Key Vault `customereq-kv`.
- The container app's `secrets:` entry uses `keyVaultUrl: https://customereq-kv.vault.azure.net/secrets/<name>` plus `identity: system` — never a plain `value:`.
- The container's env var uses `secretRef: <secret-name>` — never plain `value:` for sensitive data.
- The container app's managed identity holds `Key Vault Secrets User` on the vault.

**Required pattern for ACR pulls:**
- `registries:` entry uses `identity: system` — never `username` + `passwordSecretRef`.
- The container app's managed identity holds `AcrPull` on the registry.

**Forbidden — do not introduce these in any IaC, deploy script, workflow, or ad-hoc command:**
- `az containerapp update --secrets KEY=plain-value` for any production secret.
- A `secrets:` block with `value:` (instead of `keyVaultUrl:`) in `*.bicep` / `*.yml` / `*.json` for any production app.
- An env var entry with a plain `value:` for anything sensitive (API keys, DB URLs, JWT secrets, signing keys, etc.).
- `az containerapp registry set --username ... --password ...` against a production app.
- Re-enabling `customereqcr`'s admin user.

**Adding a new secret:**
1. Add the value to Key Vault: `az keyvault secret set --vault-name customereq-kv --name <name> --value <value>`.
2. Bind it on the container app: `az containerapp secret set --name <app> --resource-group customereq-prod --secrets <name>=keyvaultref:https://customereq-kv.vault.azure.net/secrets/<name>,identityref:system`.
3. Reference it from env: `az containerapp update --name <app> --resource-group customereq-prod --set-env-vars KEY=secretref:<name>`.
4. The migration script `scripts/migrate-secrets-to-keyvault.sh` is the canonical reference for this pattern — read it before doing anything custom.

**Drift detection:** `./scripts/migrate-secrets-to-keyvault.sh --dry-run` is idempotent; if it reports any change to a production app, that's drift, investigate before letting it proceed.

## Fresh Worktree / Prisma Client (Issue #383)

Root `package.json` has `"postinstall": "pnpm db:generate"`. **Do not remove it.**

It exists because `~/.fraim/scripts/prep-issue.sh` runs `pnpm install` in a new worktree *before* the gitignored `.env` files are copied in. Without this hook, `@prisma/client`'s own postinstall runs `prisma generate` with no `DATABASE_URL` and the generated client ends up missing the `PrismaClient` / `Prisma` named exports — `pnpm build` then fails in `apps/worker` and any test-utils that import them. `prisma generate` itself does not need `DATABASE_URL` (the schema's `env("DATABASE_URL")` is only resolved when the client *connects*), so the hook works correctly regardless of env state.

The upstream fix — having `prep-issue.sh` copy `.env` files into new worktrees — is tracked at FRAIM-org issues #233 (filed 2026-03-30) and #414 (filed 2026-05-15), both still open. Once one of those merges and propagates through `npx fraim sync --global`, this hook becomes belt-and-braces but is still cheap (~500ms per install) and keeps the repo working for anyone on an older FRAIM CLI.

## Testing Rules

- **Tests must never skip.** If a test cannot run (missing API key, DB unreachable, server down), it must **fail with a clear error** — not skip or pass vacuously.
- `pnpm test:smoke` — all unit tests, no API keys needed. Must pass on every PR.
- `pnpm test:baml` — BAML eval tests calling real LLMs (GPT-4o). Requires `OPENAI_API_KEY`. Fails if key is missing.
- `pnpm test:integration` — API tests against real DB. Requires `DATABASE_URL`.
- `pnpm test:e2e` — Playwright browser tests. Requires dev server running.
