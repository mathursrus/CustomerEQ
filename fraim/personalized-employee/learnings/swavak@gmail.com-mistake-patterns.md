# Mistake Patterns — swavak@gmail.com

**Last synthesized**: 2026-05-22 (1 new entry added)

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

---

#### [P-HIGH] Committing fixes directly to main without an issue or branch

**Score**: 9.0
**Last seen**: 2026-05-18
**Recurrences**: 1
**First synthesized**: 2026-05-18

During the CI/CD Turbo cache epic (2026-05-18), multiple fixes were committed directly to `main` without creating GitHub issues or feature branches: the BAML eval flakiness fix, the migration verify script fix (`steps_count` column), the MCP route ESLint suppression, and the CI metrics doc update. All of these violated Rules 10, 21, and 24. The agent treated them as "small" or "urgent" and bypassed the workflow. Before making any code change — regardless of size or urgency — create a GitHub issue, branch off main, and follow FRAIM. There are no exceptions for small fixes.

---

#### [P-HIGH] Merging PR with failing CI

**Score**: 9.0
**Last seen**: 2026-04-07
**Recurrences**: 1
**First synthesized**: 2026-05-08

Merging a Pull Request while CI checks (Build, Lint, Test) are failing allows broken code into the main branch, which can break deployment pipelines and prevent features from reaching production. A failing CI build is a hard gate. Even minor TypeScript errors or lint issues must be fixed and verified as green on CI before the internal merge command is executed.

---

#### [P-HIGH] Committing to old branch on session resume

**Score**: 8.0
**Last seen**: 2026-04-07
**Recurrences**: 1
**First synthesized**: 2026-05-08

On session resume, if untracked files from a previous task or a new issue are found, the agent may immediately stage and commit them without verifying that the current branch corresponds to the task's scope. This results in work being committed to the wrong feature branch (e.g., committing #80 work to #79's branch). Before making any commit on a resumed session, always run `git branch` and verify the branch matches the current issue number.

---

#### [P-HIGH] Credential encryption for customer-facing secrets framed as deferred TODO

**Score**: 7.1
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: 2026-05-08

When a feature design stores webhook URLs, API tokens, or signing secrets for customer-configured external integrations, framing credential encryption as "for MVP, store plaintext with a TODO" is insufficient. Any field that, if leaked, gives an attacker access to a customer's external system is a pre-onboarding hard gate by definition. In RFC risks tables, classify credential encryption as a hard gate rather than a deferred item.

---

#### [P-HIGH] Wizard step handleNext validation not gated on isViewOnly

**Score**: 6.5
**Last seen**: 2026-04-09
**Recurrences**: 1
**First synthesized**: 2026-05-08

When view-only mode is added to a wizard built for create/edit, each step's `handleNext()` handler continues to validate required fields unconditionally. If a field is null or empty in view-only state (e.g., `startDate: null` → empty string from loader), validation fires and blocks forward navigation entirely with no visible workaround. Every wizard step with required-field validation must begin with `if (isViewOnly) { onNext(); return; }`.

---

#### [P-HIGH] Passing undefined as event handler to disable view-only interactivity

**Score**: 6.5
**Last seen**: 2026-04-09
**Recurrences**: 1
**First synthesized**: 2026-05-08

Passing `undefined` as an event handler (e.g., `onStepClick={isViewOnly ? undefined : goToStep}`) silently removes all navigation affordance in view-only mode. The stepper's `isClickable = isCompleted && !!onStepClick` pattern means all steps become non-interactive. Instead, always wire the handler and use a semantic prop (`allStepsClickable`) that separates "allow navigation" from "allow editing."

---

#### [P-HIGH] Multi-role feature spec missing operator perspective in first draft

**Score**: 6.1
**Last seen**: 2026-04-01
**Recurrences**: 1
**First synthesized**: 2026-05-08

When a spec issue lists multiple user roles, the natural attractor is to anchor on the end user (member) and treat the operator as secondary. Without an explicit check at context-gathering, the first draft may cover only one role entirely — requiring significant rework (13 new requirements, a second HTML mock, 5 new friction items in Issue #75). At context-gathering, list all roles in the issue and verify at least one workflow is drafted per role before moving to spec-drafting.

---

#### [P-HIGH] URL slug anchored at wrong entity level

**Score**: 6.0
**Last seen**: 2026-03-31
**Recurrences**: 1
**First synthesized**: 2026-05-08

When designing URL slugs, the recommendation was `Brand.slug` (brand-level) when the URL targets a specific `Program` (program-level). The mistake arose from analyzing competitor patterns rather than asking "what is the user actually navigating to?" Before recommending a slug field, identify which model the URL action targets and verify that model has (or should have) a unique slug field in the Prisma schema.

---

#### [P-MED] Architecture doc update deferred to feedback round when RFC introduces new pattern

**Score**: 4.4
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: 2026-05-08

When an RFC introduces a pattern not yet documented in `docs/architecture/architecture.md` (e.g., outbound webhook signing, BullMQ repeating jobs), the architecture doc update was placed in the feedback-round commit rather than the initial RFC commit. This costs an additional feedback round. Include architecture doc updates in the same commit as the RFC when a new pattern is being introduced.

---

#### [P-MED] P0 gaps discovered in spec not filed as issues during submission

**Score**: 3.8
**Last seen**: 2026-04-01
**Recurrences**: 1
**First synthesized**: 2026-05-08

When a feature spec's friction inventory identifies P0 items not covered by an existing open GitHub issue, those sub-issues were not filed until the user explicitly asked "what's the next step?" after merge (Issue #75: three net-new P0 features). During spec submission, scan the friction inventory for P0 items without a corresponding open issue and file them before closing the job.

---

#### [P-HIGH] Consent gate logic copied from live-response context to bulk import context unchanged

**Score**: 7.5
**Last seen**: 2026-05-10
**Recurrences**: 1
**First synthesized**: 2026-05-10

When implementing a bulk import processor that shares member-resolution logic with a live-response processor, the `consentGivenAt` gate was copied unchanged. The gate is correct for live responses (we wait for explicit consent before linking a response to a member). For bulk imports, the integrator has already verified consent at export time, so gating `memberId` assignment on `consentGivenAt` silently leaves all imported responses unlinked from their members. Before copying any consent-gating logic from one ingestion context to another, explicitly ask: "Has consent already been verified by the upstream party?" If yes, do not apply the `consentGivenAt` gate.

---

#### [P-HIGH] Hand-written migration column names not verified against Prisma's camelCase convention

**Score**: 7.0
**Last seen**: 2026-05-10
**Recurrences**: 1
**First synthesized**: 2026-05-10

Prisma generates SQL migrations with quoted camelCase column identifiers (e.g., `"memberId"`, `"surveyId"`). When a migration is written by hand instead of generated by `prisma migrate dev`, the natural tendency is to write snake_case identifiers (e.g., `"member_id"`), which do not match Prisma's schema-level names. This causes `column does not exist` failures at deploy time. Before writing any DDL column reference in a hand-written migration, grep an existing generated migration in `packages/database/prisma/migrations/` for the exact quoted identifier casing.

---

#### [P-HIGH] Migration draft not deleted when canonical replacement is written

**Score**: 6.5
**Last seen**: 2026-05-10
**Recurrences**: 1
**First synthesized**: 2026-05-10

When an exploratory spike migration is created and later superseded by a canonical replacement, the draft file was not deleted. The filesystem does not know which migration is authoritative — both ran during `prisma migrate deploy`, causing a P3018 "relation already exists" error. The fix requires a discovery round to understand the cause. The draft must be deleted in the same commit that creates the canonical replacement. Before committing any migration, confirm that only one migration directory exists for the feature by running `ls packages/database/prisma/migrations/ | grep <feature-slug>`.

---

#### [P-HIGH] Editing a file on the wrong branch (target file doesn't exist on current branch)

**Score**: 6.0
**Last seen**: 2026-05-10
**Recurrences**: 1
**First synthesized**: 2026-05-10

When a file only exists on a feature branch (e.g., `apps/worker/src/processors/surveyImport.ts`), attempting to edit it while on `main` results in the Edit tool creating an untracked orphan file — not modifying the feature branch version. The Edit tool reports success but the change is a no-op for the intended purpose. Before editing any file to fix a bug on a feature branch, verify the file exists on the current branch with `git show HEAD:<path>`. If it doesn't, switch to the correct branch first.

---

#### [P-MED] Duplicate TypeScript type definition instead of importing from @customerEQ/shared

**Score**: 3.8
**Last seen**: 2026-04-02
**Recurrences**: 1
**First synthesized**: 2026-05-08

When writing client components in `apps/web/`, local TypeScript interfaces were defined for API response shapes (`EnrollResponse` in two adjacent files) instead of importing `EnrollMemberResponse` from `@customerEQ/shared`. The shared package has Zod-derived types for all API response shapes. Before defining any new interface for an API response in `apps/web/`, grep `packages/shared/src/zod/` for an existing type.

---

#### [P-MED] Clerk E2E placeholder key using HSTS-preloaded TLD

**Score**: 3.8
**Last seen**: 2026-04-02
**Recurrences**: 1
**First synthesized**: 2026-05-08

To bypass Clerk middleware in Playwright E2E tests, a placeholder publishable key using the `*.lcl.dev` TLD was used. Chromium has `lcl.dev` HSTS-preloaded, causing `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` and requiring multiple fix iterations. For Clerk E2E bypass, always use a `.fake` or `.invalid` TLD (RFC 2606 reserved — guaranteed not HSTS-preloaded): e.g., `pk_test_<base64url(host + '$')>` where host ends in `.fake`.

---

#### [P-HIGH] Jumping to implementation on external data features without a spec

**Score**: 8.0
**Last seen**: 2026-05-03
**Recurrences**: 1
**First synthesized**: 2026-05-18

When a feature ingests data from an external system (CSV, third-party export, API), the data shape is a blocking unknown. In Issue #262, the agent assumed a fixed column schema (`email`, `score`, `verbatim`) and wrote ~600 lines across 10 files before the user caught it — the primary use case (Google Reviews) has no `email` field at all. The correct trigger: any feature with an external data source goes to `feature-specification` first, regardless of how the user framed the approval. Directional "yes" from the user is not scope approval for schema design.

---

#### [P-HIGH] Git Bash on Windows silently expands POSIX paths in CLI arguments

**Score**: 8.0
**Last seen**: 2026-05-18
**Recurrences**: 1
**First synthesized**: 2026-05-18

When a bash provisioning script passes absolute POSIX paths (e.g., `/app/apps/api/docker-entrypoint-migrate.sh`) to CLI tools (Azure CLI, Docker) under Windows Git Bash, Git Bash silently translates them to `C:/Program Files/Git/app/...` before the command executes. In Issue #386, this stored the wrong entrypoint command in the ACA Job — it would have failed in production without the PATCH fix. Fix: add `export MSYS_NO_PATHCONV=1` as the first line after the shebang in any `.sh` script that passes POSIX-absolute paths to CLI tools and may be run on Windows Git Bash.

---

#### [P-MED] Stale worktrees for closed issues exhaust disk space during issue preparation

**Score**: 7.9
**Last seen**: 2026-05-18
**Recurrences**: 2
**First synthesized**: 2026-05-18

Worktrees for merged and closed issues left on disk accumulate `node_modules` and build artifacts (4 GB+ per worktree), causing `prep-issue.sh` to fail mid-checkout when the drive is near capacity. This occurred in both Issue #386 (pnpm store overflow) and Issue #387 (stale worktrees for closed issues 120/121/175 caused disk-full at 33 MB free). Fix: during `work-completion`, always remove the worktree directory for the issue being closed — don't leave it to accumulate.

---

#### [P-MED] `az role assignment create` returns `MissingSubscription` — use `az rest` fallback

**Score**: 5.0
**Last seen**: 2026-05-18
**Recurrences**: 1
**First synthesized**: 2026-05-18

In Issue #386, every variant of `az role assignment create` (with/without `--assignee-object-id`, explicit `--subscription`, at ACR or subscription scope) returned `MissingSubscription` despite the subscription being active and correct. `az role assignment list` at the same scope succeeded. The reliable fallback: use `az rest PUT https://management.azure.com/{scope}/providers/Microsoft.Authorization/roleAssignments/{guid}?api-version=2022-04-01` directly, bypassing the CLI wrapper.

---

#### [P-MED] Declaring self-hosted cache healthy without verifying artifact writes

**Score**: 5.0
**Last seen**: 2026-05-22
**Recurrences**: 1
**First synthesized**: 2026-05-22

A Container App can show `Healthy` / `Running` while its storage backend is misconfigured (wrong container name, wrong connection string). In this scenario CI runs without error but every task shows `Cached: 0 cached` — the signal is invisible without explicitly checking blob count. In Issue #457 (2026-05-22), after fixing `ABS_CONNECTION_STRING`, the Container App showed `Healthy` with 1 replica and the first CI run completed successfully. Blob count check afterward showed 0 artifacts — `STORAGE_PATH` was still wrong (defaulting to `turborepocache` instead of `turbo-cache`). Required a second fix round. After any cache server fix, run a CI workflow and then check blob count in the storage container before declaring the cache operational.

---
