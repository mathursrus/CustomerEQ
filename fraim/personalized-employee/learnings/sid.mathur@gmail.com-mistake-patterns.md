# Mistake Patterns — sid.mathur@gmail.com

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

---

## ⏳ Pending Review — 2026-05-24

### Proposed new entry

#### [P-HIGH] Auth block during mobile validate accepted as partial validation

**Score**: 9.0
**Last seen**: 2026-05-24
**Recurrences**: 1
**First synthesized**: (pending)

When `mobileValidationRequired: true` or `uiValidationRequired: true`, the scope of validation is **the feature screens listed in the issue ACs** — not the auth gate in front of them. If sign-in fails during the validate phase, this is a **phase blocker**, not an environmental limitation to note and continue past. The agent must either (a) find valid Clerk credentials, (b) implement a dev auth bypass (e.g., `EXPO_PUBLIC_DEV_BYPASS_AUTH`, mirroring the web app's `NEXT_PUBLIC_DEV_BYPASS_AUTH` pattern), or (c) call `seekMentoring` with `status: "incomplete"` and explicitly state which screens were not validated. Advancing past `implement-validate` with only an auth-gate screenshot is invalid. End-of-phase gate: a screenshot or visual record must exist for every screen named in the issue ACs before the phase can be marked complete.

---

## ⏳ Pending Review — 2026-03-24

### Proposed new entry

#### [P-HIGH] HTTP scraper used before Playwright on enterprise SaaS

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

Running a `requests`-based HTTP scraper as the first attempt against an enterprise SaaS site (e.g., Cloudflare-protected) returns 0 pages with 403 and requires full fallback to Playwright. This pattern causes wasted effort and adds latency. Playwright should be the first tool used for any enterprise browser automation task — not a fallback.

---

#### [P-HIGH] MCP GitHub PR creation tool causes repeated failures

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 2
**First synthesized**: (pending)

`mcp__github__create_pull_request` has failed in 2 separate sessions: once with 422 (malformed `head` field, requires `owner:branch` format not shown in schema) and once with "Head sha can't be blank" (branch not yet pushed). Each failure caused 2–3 wasted retry tool calls before fallback to `gh pr create`. This tool is unreliable — do not use it.

---

#### [P-HIGH] Tests written against spec before reading actual implementation

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

Writing test files using the spec description as the source of truth, when implementation files already exist on disk, results in schema mismatches (missing required fields, wrong types) that require complete rewrites of the test files. Always glob for existing `*.ts` source files in target directories and read them before writing any tests.

---

#### [P-HIGH] `git push origin <branch>` fails silently in git worktrees

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

In a git worktree, `git push origin <branch-name>` fails with "src refspec does not match any" because the branch ref is stored in the parent `.git/worktrees/` directory rather than `refs/heads/`. The correct form is always `git push origin HEAD:<branch-name>`, which works in both normal checkouts and worktrees. Detect worktrees early by running `cat .git` — if the output starts with `gitdir:`, you are in a worktree.

---

#### [P-MED] Wide HTML table without overflow wrapper

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

HTML mock tables with more than 4–5 columns cause column clipping at standard Playwright viewport widths when no overflow wrapper is present. Any mock table with more than 4 columns must be wrapped in `<div style="overflow-x:auto">` with `min-width` set on the table element. Apply this by default when authoring, not as a fix after browser validation.

---

#### [P-MED] Observability omitted from initial RFC for event-driven systems

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

For event-driven or queue-based systems with SLA commitments, the initial RFC draft omitted the observability section (structured log schema, alert thresholds, DLQ strategy). This was caught during architecture gap-review and required an extra revision pass. Observability must be included as a required default section in any RFC that involves queues, async processing, or SLA commitments.

---

#### [P-MED] PR created before confirming branch is on GitHub

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

PR creation attempts (both MCP tool and `gh` CLI) fail with confusing errors ("Head sha can't be blank", branch not found) when the branch has not yet been pushed to GitHub. Before any PR creation call, verify the branch is visible via `gh api repos/<owner>/<repo>/branches/<branch>` and confirm it returns 200. Only proceed with PR creation after this check passes.

---

## ⏳ Pending Review — 2026-04-04

### Proposed new entries

#### [P-HIGH] Declaring auth flow verified without clean-state E2E test

**Score**: 9.0
**Last seen**: 2026-03-26
**Recurrences**: 1
**First synthesized**: (pending)

Verifying authentication (Sign In/Up) using only `curl` status codes or by navigating whilst a residual browser session is active is invalid. This pattern misses critical failures like missing public routes in middleware or deprecated redirect props (e.g., Clerk `afterSignInUrl`). Auth must always be validated via a full Playwright flow starting from a cleared cookie/session state, and all auth-related deprecation warnings in the console must be treated as blockers.

---

#### [P-HIGH] UI commits pushed without browser validation

**Score**: 8.0
**Last seen**: 2026-03-26
**Recurrences**: 1
**First synthesized**: (pending)

Assuming UI pages are correct because unit tests pass and the build compiles is a recurring failure mode. TypeScript and unit tests cannot catch rendering crashes (e.g., TypeErrors in rating components). Every commit that adds or modifies a user-accessible page must be verified in a Playwright browser (screenshot + console check) before pushing.

---

#### [P-HIGH] Pausing mid-phase to ask for implementation permission

**Score**: 8.5
**Last seen**: 2026-04-02
**Recurrences**: 1
**First synthesized**: (pending)

When running a FRAIM job (e.g., feature-implementation), stopping mid-phase (e.g., `implement-code`) to ask if the user wants to continue breaks momentum and violates the instruction to implement fully. The agent must proceed through all implementation steps to completion unless a hard blocker is encountered. `seekMentoring` should be used for reporting status or blockers, not for optional "shall I continue" check-ins during an active phase.

---

#### [P-HIGH] Deferring tests due to "missing environment" (fake blockers)

**Score**: 9.0
**Last seen**: 2026-04-02
**Recurrences**: 1
**First synthesized**: (pending)

Avoidance of testing by citing a lack of a running server or database is a failure of persistence. If a test requires a dev server or a database, the agent has the tools to start them (`pnpm dev`, `docker-compose`, or local DB commands). Never defer E2E or integration tests in a PR response; set up the required environment and write/run the tests instead.

---

#### [P-HIGH] Testing HTML mocks instead of real application code

**Score**: 9.5
**Last seen**: 2026-04-02
**Recurrences**: 1
**First synthesized**: (pending)

Retreating to test static HTML mocks (`file:///...`) when the real application (`http://localhost:3000`) has auth or setup issues is a critical failure. HTML mocks are for design review only. E2E tests must target the real code. If auth blocks the test, use established patterns (e.g., `mockClerkAuth`) to fix the test environment rather than testing the wrong target.

---

#### [P-HIGH] E2E tests that mock the entire API (Integration Gap)

**Score**: 8.0
**Last seen**: 2026-04-02
**Recurrences**: 1
**First synthesized**: (pending)

Using `page.route()` to mock all API responses in E2E tests creates a false sense of security and hides schema mismatches or missing required database fields (e.g., `triggerCondition` required by Prisma but optional in Zod). At least one E2E or Supertest per feature must hit the real API/DB to verify the full stack integration.

---

#### [P-MED] UI Preview does not match campaign type

**Score**: 6.0
**Last seen**: 2026-04-03
**Recurrences**: 1
**First synthesized**: (pending)

When adding new variants to a builder (e.g., mystery box vs. scratch card), reusing shared preview conditions without variant-specific content causes user confusion. Variants must have matching, interactive previews. E2E tests must verify that the preview *content* changes when the type is switched, not just the existence of a preview container.

---

#### [P-HIGH] Orchestrator dropping UI scope from agent prompts

**Score**: 9.0
**Last seen**: 2026-04-04
**Recurrences**: 1
**First synthesized**: (pending)

When orchestrating parallel implementation, focusing agent prompts solely on backend deliverables (API/DB) while dropping explicit UI requirements leads to "operationally invisible" features. Orchestrators must cross-reference original issue ACs at every gate and explicitly mandate ALL deliverable types (backend + frontend + tests) in downstream prompts.

