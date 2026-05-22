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

## 24. FRAIM is the Mandated Workflow for All Agent Work

All AI agents operating in this repository — autonomous, semi-autonomous, or human-supervised — MUST execute work through the FRAIM workflow (discovery catalog under `fraim/` in this repo; runtime via the `mcp__fraim__*` tools). **No deviations.**

- For tasks that map to a FRAIM job (`feature-implementation`, `technical-design`, `feature-specification`, `code-refactoring`, `pr-iteration`, `test-execution`, `issue-preparation`, `retrospective`, etc.), execute every phase the job defines, in order, with the required deliverables on disk under `docs/evidence/` (or wherever the job specifies).
- For tasks that do not map cleanly to a FRAIM job, surface the gap to the user before starting and request guidance. Do not proceed ad-hoc.
- The MCP discovery + runtime tools are the canonical entry points: `mcp__fraim__list_fraim_jobs`, `mcp__fraim__get_fraim_job`, `mcp__fraim__get_fraim_file`, `mcp__fraim__seekMentoring`. `seekMentoring` is the **only** sanctioned way to advance phase state.
- Skipping a phase ("nothing to do here" / "the spec doesn't mention this") is not allowed without explicit user authorization. Phases that don't apply (e.g., `implement-repro` for a feature) must be marked N/A with the reason in the evidence doc, not silently dropped.
- Phases marked "wait for external signal" are hold-points — see Rule 25a.

Why: prior incidents (most recently #335 Slice 4a / PR #340) show that agents who skip or shortcut FRAIM phases produce work that fails review — silent removals of hero-feature UI, missed regression triage, incomplete traceability, retrospectives that don't capture review iterations. FRAIM's phased discipline is the safeguard. The cost of running the full workflow is bounded; the cost of skipping a phase is unbounded (rework, broken trust, incidents).

## 25. Default to Wait + Verify (Operational Hold-Point Discipline)

This rule exists because in a single session of Slice 4a of #241 (PR #340) the agent made 7 distinct mistakes that share one root: it optimized for "advance and report done" rather than "wait and verify." The mistakes ranged from auto-completing FRAIM hold-points, to destroying a working tree with `git checkout <base> -- .`, to silently removing UI tied to Rule 2 (hero pipeline), to writing test mocks that broke `useCallback` deps. Each was individually recoverable; the pattern was not. Five sub-rules pre-empt that pattern.

**25a. Hold-points never auto-complete.** Before calling `seekMentoring(status='complete')` on a FRAIM phase, check the phase intent: is it a hold-point (waits for external signal — user feedback, PR review, CI result)? If yes, the only valid `status='complete'` trigger is an explicit user signal like "proceed," "check the PR," "PR merged," "approved." Auto-advancing because "I have nothing to do right now" is wrong. FRAIM's `address-feedback` phase is the canonical hold-point — it waits for review comments, not the agent's patience.

**25b. Destructive action requires a written alternative.** Before any destructive command — `git checkout <branch> -- .`, `git reset --hard`, `git rm`, `Remove-Item -Recurse`, deleting evidence files, force-pushing — the tool call's description field must name one alternative the agent considered and rejected, with the reason. If no alternative can be named, the agent stops and looks harder. `git stash` + branch swap is almost always a safer substitute for `git checkout <branch> -- .`. `git worktree add` is the safer substitute for "I just want to test something on a different branch quickly."

**25c. Spec / RFC / work-list "deferred" or "remove" instructions require project-rule cross-reference before commit.** Before treating any "deferred to sibling sub-issue" or "remove from this slice" instruction as license to delete UI, capability, or component, answer in the scoping artifact: does this touch the loyalty event pipeline (Rule 2)? existing user flows (Rule 18)? tenant scoping (Rule 6)? hero-feature visibility (Rule 2)? If any answer is yes, surface the trade-off to the user with the rule cross-reference before committing the removal. Local spec language is not authoritative when it conflicts with project rules.

**25d. Trace fixtures and mocks through the production consumer before writing.** Before committing any test fixture or mock to disk, trace one full round-trip: what code does the production consumer execute against this fixture? What hooks (`useEffect`, `useCallback`) capture parts as deps? Is the mock-object reference stable across calls? Does the token / format match the canonical regex? Skipping this trace produces test fixtures that look fine in isolation but cause infinite render loops or token-syntax mismatches when wired up.

**25e. Failure triage uses surgical diff, not whole-tree reset.** Never start fixing a failing test before confirming whether the same test failed on the base branch. The diff is mechanical and safe:
- WRONG: `git checkout <base-branch> -- .` (overwrites the whole working tree).
- RIGHT: `git stash` then `git checkout <base-branch>` (clean swap, returns via `git stash pop`).
- ALSO RIGHT: `git worktree add /tmp/base <base-branch>` (truly side-by-side, no impact on current tree).
- ALSO RIGHT: `git show <base-branch>:<path>` if only reading.

The success criterion for Rule 25 is not "the agent catches the mistake before the user flags it" — that is still after-the-fact apology. The success criterion is "the rule pre-empts the wrong action before it is taken."

## 26. All Phase Artifacts Ship in One PR Per Issue (No "Chore-Issue" Splits)

Rules 10 and 21 say *one issue per branch*. Rule 26 adds the orthogonal constraint: **all phase artifacts for that issue ship in one PR** (with multiple phase-aligned commits as needed), not one PR per "sub-thing the agent noticed" and not one PR per phase.

The default for any FRAIM-tracked issue is:
- One issue number `{N}` spans spec → RFC → impl → Phase 13 (retro + work-list cleanup) → coaching-moment capture.
- One isolated worktree (`{REPO} - Issue {N}`, created by `~/.fraim/scripts/prep-issue.sh`).
- One feature branch (`feature/{N}-{slug}`).
- **One PR** for the whole issue, containing one commit per phase artifact as needed (spec, RFC, impl, evidence, retro, coaching-moment capture) plus any architecture / evidence / test updates surfaced along the way. Merge + cleanup runs via the `work-completion` job (`resolution-merge` → `resolution-verification` → `resolution-cleanup`). Additional commits within a single issue ride on the same feature branch in the **same worktree** — never in spawned chore worktrees, never on spawned chore-issues, never on sibling PRs.

**How to read Rule 26.** The unit of shipping is the **issue**, not the phase. A FRAIM-tracked issue produces multiple artifacts as it moves through phases, but all of them share one branch and one PR — they appear in that PR's commit history, not in sibling PRs. If a Phase 13 retro lands two days after the impl commit, it lands as another commit on the same `feature/{N}-...` branch and pushes to the same open PR. The PR closes (via `work-completion`) only after every phase artifact for the issue has landed on it. The forbidden phrases below all share the same fabrication shape — "this phase / sub-thing deserves its own issue + branch + PR" — and the rule is silent on no phase deserving that.

**Forbidden patterns:**
- Filing a separate "chore-issue" for the Phase 13 retro of an already-shipped issue (e.g., issue #349 created solely to host the retro for #343, with its own worktree, branch, and PR #350).
- Filing a separate issue for coaching-moment capture from a wrap-up session (e.g., issue #344 / PR #345 splitting Slice 3 coaching moments off the parent slice work).
- Spawning a fresh worktree (`Issue {M}`) for a follow-up retrospective expansion that belongs on the original feature branch (e.g., issue #354 / PR #355 splitting Slice 4a retro expansion off #335).
- Using the phrase *"chore-issue for #N"*, *"Phase 13 cleanup chore-issue for #N"*, *"chore-issue body"*, or *"Follows the convention used by [other chore PRs]"* as justification. These are the fabrication shape — they appear in no FRAIM job stub, skill, rule, or `seekMentoring` response. If you cannot quote the authorizing rule verbatim from `mcp__fraim__seekMentoring` or `get_fraim_file` *this turn*, the default in this rule applies.

**Allowed exceptions (each requires a written reason in the PR body):**
- **Post-merge regression discovered after `work-completion` finished** → legitimately a new issue. Rule 25 stay-on-PR only applies before merge. Cite the merge SHA and the failing CI run / production signal that surfaced it. (Example: post-#346 `workflow_run` failure → #347 was legitimate; the chain that grew on top — #349, #351 — compounded into a Rule 26 violation by adding three additional worktrees for one logical workstream.)
- **Cross-cutting fix discovered mid-feature that is off-scope** → file a new issue per Rule 21. The trigger is "different acceptance criteria," not "I want a clean diff."
- **Operational/ops artifact (e.g., DB recovery script) outside the original issue's ACs** → allowed only if the ops need would block merge of the bugfix and was not in scope of the original issue.

**Cited authority (verbatim from FRAIM):**
- `issue-preparation` Phases 1–2 — outcomes name *"an isolated issue worktree"* and *"feature branch exists, is checked out in the isolated worktree, and tracks origin."*
- `issue-preparation` Phase 1 Step 5 — *"Do not fall back to manual in-place branch creation."*
- `issue-preparation` Phase 2 Step 4 — *"Do not hand-roll git branch steps."*

These specify the per-issue topology (one worktree, one branch) authoritatively. The single-PR-per-issue cadence (with phase artifacts arriving as additional commits on that PR's branch) and the work-completion merge+cleanup come from `work-completion` job phases (`resolution-merge` → `resolution-verification` → `resolution-cleanup`), which are scoped to the one parent issue, not to spawned chore-issues.

## 27. Merging PRs — Use `gh pr ready`, Not `gh pr merge` (Issue #498)

The repository uses an auto-draft / auto-merge workflow (`.github/workflows/auto-draft.yml` and `.github/workflows/auto-merge.yml`). When a PR is marked as ready for review, CI runs exactly once; if it passes the PR is squash-merged automatically.

**Correct merge procedure:**
```
gh pr ready <PR-number>
# Wait for CI to pass and auto-merge to complete (check with: gh pr view <PR>)
```

**Forbidden:**
- `gh pr merge` — bypasses the CI pre-validation gate; auto-merge won't fire.
- Clicking "Merge pull request" directly on a draft PR (merge button is hidden until ready-for-review triggers CI).

The `resolution-merge` FRAIM phase must use `gh pr ready`, not `gh pr merge`. This phase is a hold-point: only call `seekMentoring(status='complete')` after confirming the PR shows as merged on `main` (via `gh pr view <PR>` or `git log origin/main`).

**Why this rule exists:** between 2026-05-12 and 2026-05-15, four "chore-issue" PRs (#345, #350, #355, #373) and one regression chain (#343 → #347 → #349 → #351) shipped under fabricated FRAIM justifications — each created a redundant worktree and PR for what FRAIM's defaults specified ride on the parent issue. PR #350 confessed: *"the worktrees at Issue 343, Issue 347, Issue 349, Issue 351 can all be removed locally"* — four worktrees for one CI/CD workstream. The cost was operational noise, erosion of the one-issue-one-PR mental model, and two on-disk retrospectives that encoded the fabrication as a "win" and would re-teach the wrong lesson to future agents (corrected by the same PR that landed this rule).

**Priority order when this rule applies to your current turn:**
1. **FRAIM-verified-this-turn** — a FRAIM rule fetched via `seekMentoring` or `get_fraim_file` *this conversational turn* and quoted verbatim wins.
2. **Default-when-FRAIM-is-silent** — this rule's default (one issue / one branch / one PR for all phase artifacts, with multiple phase-aligned commits as needed) applies.
3. **Unverified agent paraphrase of FRAIM** — never authoritative. Treat any "I'm pretty sure FRAIM says…" without a fresh fetch as Priority-3 instinct, not Priority-1 rule. This is the exact failure shape that produced the four fabrications named above.
