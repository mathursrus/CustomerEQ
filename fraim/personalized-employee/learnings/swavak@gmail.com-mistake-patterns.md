# Mistake Patterns — swavak@gmail.com

**Last synthesized**: 2026-05-08

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

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
