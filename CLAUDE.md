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

## Testing Rules

- **Tests must never skip.** If a test cannot run (missing API key, DB unreachable, server down), it must **fail with a clear error** — not skip or pass vacuously.
- `pnpm test:smoke` — all unit tests, no API keys needed. Must pass on every PR.
- `pnpm test:baml` — BAML eval tests calling real LLMs (GPT-4o). Requires `OPENAI_API_KEY`. Fails if key is missing.
- `pnpm test:integration` — API tests against real DB. Requires `DATABASE_URL`.
- `pnpm test:e2e` — Playwright browser tests. Requires dev server running.
