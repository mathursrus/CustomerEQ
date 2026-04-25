# Feature: Upgrade Node 20 → 22 in Dockerfiles (api, web, worker)
Issue: #177
Feature Spec: None — Issue body is the source of truth (no `docs/feature-specs/177-*.md`). User explicitly opted out of a functional spec for this infra-bump issue.
PR: To be linked at design-submission phase.

## Completeness Evidence
 - Issue tagged with label `phase:design`: To be added at submission
 - Issue tagged with label `status:needs-review`: To be added at submission
 - All files committed/synced to branch: Pending submission
 - PR Comment table:

| PR Comment | How Addressed |
| :--- | :--- |
| (None yet — RFC just authored.) | — |

### Traceability Matrix

Source: GitHub issue #177 body — the "Validation checklist" items are the acceptance criteria for this issue, plus the implicit "Proposed change" requirement that all three Dockerfiles are bumped to `node:22-slim`. Each AC is mapped to the RFC section that implements or validates it.

| Requirement / Acceptance Criterion (from Issue #177) | RFC Section / Data Model | Status | Validation Plan Alignment |
| :--- | :--- | :--- | :--- |
| **Proposed change**: bump `Dockerfile.api`, `Dockerfile.web`, `Dockerfile.worker` from `FROM node:20-slim` to `FROM node:22-slim` (builder + runner stages each — 6 lines total) | Technical Details → Inventory of Node 20 references (rows 1–3 of the file table covering both stages) | Met | Validation Plan: docker-build CI job exercises all three Dockerfiles end-to-end against `node:22-slim`; existing CI build/typecheck/test runs against Node 22; deploy-time `/healthz` is the last-line guard. |
| **AC1 — `package.json` engines field (if any) allows Node 22** | Technical Details → Inventory (row "package.json line 7"): `"node": ">=20.0.0"` → `"node": ">=22.0.0"`, plus row "package.json line 36": `"@types/node": "^20.0.0"` → `"^22.0.0"`. Rationale in "Customer Problem" — engines floor should track the production image so contributors on older Node fail fast. | Met | `pnpm install --frozen-lockfile` resolves successfully against the new floor on Node 22 (CI step "Install dependencies"); `pnpm typecheck` validates `@types/node ^22` (CI step "Type check"). |
| **AC2 — Build succeeds locally for all three images** | Technical Details → CI/CD Impact: proposes adding a new `docker-build` CI job that runs `docker build -f Dockerfile.api`, `Dockerfile.worker`, `Dockerfile.web` on every PR. RFC notes the web Dockerfile takes two `NEXT_PUBLIC_*` build-args (`Dockerfile.web:5–8`) and shows how to pass dummies for a build-only validation. | Met | Validation Plan rows for `docker build` against `node:22-slim` and `pnpm db:generate` inside Node 22 builder; new `docker-build` CI job (proposed) runs on PR. |
| **AC3 — API, web, worker start and pass smoke tests** | Technical Details → Failure Modes (Prisma engine load, Sharp libvips load); Validation Plan row "Container starts and `/healthz` returns 200" tied to existing `deploy.yml:102–115` post-deploy `/healthz` retry loop. | Met (with caveat documented in Test Matrix) | Existing `/healthz` check verifies Database + Redis connectivity on the running container; CI Docker-build verifies the image *builds*; image-boot smoke is explicitly out of scope for this PR (called out in Test Matrix and Risks; deploy-time `/healthz` is the residual guard). |
| **AC4 — Any native deps (bcrypt, sharp, etc.) rebuild cleanly on Node 22** | Technical Details → Dependency Compatibility Analysis: zero direct native deps confirmed by audit; transitive natives enumerated (Prisma engine, Sharp via Next 15, ioredis, BullMQ, BAML) with per-package Node 22 risk rating and rationale. | Met | Prisma engine: `pnpm db:generate` step in builder stage of all three Dockerfiles (`Dockerfile.api:25`, `Dockerfile.worker:25`, `Dockerfile.web:33`) — caught by new docker-build CI job. Sharp: `pnpm turbo run build --filter=@customerEQ/web` — caught by same job. ioredis 5.10.1 + BullMQ: pure JS in our usage, no ABI concerns. |
| **AC5 — Deploy to staging/prod and verify** | Out of scope for the design phase per FRAIM; staging deploy belongs to the implementation/deploy phase. Risks table flags it: "Image builds in CI but fails to start as a container — existing `deploy.yml:102` `/healthz` check is the last-line guard." | Met (deferred to deploy phase) | Manual gate: staging deploy must succeed before promoting to prod; existing `/healthz` retry loop in `deploy.yml:102–115` is the operational signal. |

**Result**: Pass — every AC in the issue body has a corresponding section in the RFC. No Unmet rows. The Validation Plan and Test Matrix in the RFC cover each AC with build, typecheck, image-build, or deploy-time validation.

### Architectural Gaps Documented for User Review

These are the gaps surfaced by the architecture-gap-review phase (RFC "Architecture Analysis" section). They do not block this completeness review. Resolution happens in the address-feedback phase after the user weighs in via the PR.

| Gap | Why it's needed | Suggested resolution (in RFC) |
| :--- | :--- | :--- |
| `architecture.md` §2 has no stated Node LTS upgrade cadence | Without it, the next bump (Node 22 → 24, ~April 2027) will be re-litigated from scratch. The current `>= 20` line will keep drifting from reality. | Add one-sentence convention to §2 row 28 in this PR: "Track upstream Node LTS — bump within ~6 months of EOL." |
| Single-source-of-truth for the Node version (currently 8 places: 6 Dockerfile FROMs + 1 CI workflow + 1 engines field) | The version has already drifted in spirit before — `@types/node ^20.0.0` was a soft drift while the runtime stayed at Node 20. With 8 places to update, the next contributor doing this kind of bump will likely miss one. | **Out of scope for this RFC.** Would require build-time templating (e.g., `.node-version` consumed by a render step). Acceptable to keep small-N duplication and rely on the audit checklist. Flagged here so the user can decide whether to file a follow-up issue. |

## Due Diligence Evidence
 - Reviewed feature spec in detail (if feature spec present): N/A — no feature spec exists for #177; issue body is the spec, and the user explicitly opted out of a functional spec for this issue.
 - Reviewed codebase in detail to understand and repro the issue: Yes — full Node-version-pin audit ran across the worktree (Dockerfiles, CI workflows, every `package.json` engines field, `.nvmrc`/`.tool-versions`/devcontainer/Volta surfaces, native-dep scan covering bcrypt/sharp/better-sqlite3/lmdb/argon2/etc., `process.version` checks, V8 flag references, Azure deployment configs, docs). Audit found 8 surfaces total with explicit Node 20 references and zero direct native deps.
 - Included detailed design, validation plan, test strategy in doc: Yes — RFC has Inventory (file:line table), Dependency Compatibility Analysis (per-package), CI/CD Impact (with proposed `docker-build` CI job), Failure Modes, Validation Plan (7 rows), Test Matrix (with explicit out-of-scope rationale for pre-existing test gaps), Risks & Mitigations (7 entries), Architecture Analysis (3-bucket), and Architecture Updates (2 doc-only edits).

## Prototype & Validation Evidence
 - [x] Built simple proof-of-concept that works end-to-end — N/A by spike-first criteria. Node 22 has been GA since April 2024; the Node base-image swap is a routine LTS-tracking bump with zero direct native deps in our tree. The audit confirmed there is no genuine technical uncertainty to spike against.
 - [x] Manually tested complete user flow (browser/curl) — N/A; no user-facing behavior changes. The new `docker-build` CI job is the validation surface and is exercisable on PR.
 - [x] Verified solution actually works before designing architecture — Verified at the audit level: zero direct native deps means no node-gyp rebuild risk; transitive Prisma engine and Sharp prebuilt binaries already support Node 22 in the versions we ship; ioredis/BullMQ are pure-JS. The "verification" for this kind of bump is the audit, not a working demo.
 - [x] Identified minimal viable implementation — 8 file edits, ~10 lines changed, plus one new CI job. Bundled into a single PR because the changes are tightly coupled (image bump + CI verification of image bump) and unbundling them defeats the purpose of catching the bump on PR rather than on prod deploy.
 - [x] Documented what works vs. what's overengineered — Test Matrix explicitly scopes *out* three pre-existing gaps (no e2e in CI, no real-Redis integration tests, no image-boot smoke) with rationale. They are real gaps but not necessary for shipping the Node 22 bump safely; recommended to file as a separate issue.

## Continuous Learning

| Learning | Agent Rule Updates |
| :--- | :--- |
| For LTS-tracking infra bumps with no direct native deps, the spike-first principle correctly resolves to "no spike needed." The validation surface is the audit + a CI image-build job, not a proof-of-concept. Recording this so future infra bumps don't get blocked on spikes that have nothing to spike against. | No new rule needed. Existing FRAIM "Spike-First" principle already permits skipping when there is no genuine uncertainty; this RFC documents the rationale explicitly so reviewers can confirm the skip. |
| When a runtime/base-image bump touches both production (Dockerfile) and CI (`actions/setup-node`), the highest residual risk is that the production image is *only* built on prod deploy. Adding the same image-build to CI is the single highest-leverage test addition for any base-image bump. | No new rule. Documented in this RFC's Risks table and Test Matrix so the pattern is reusable for the next Node/Postgres/Redis base-image bump. |
| The `engines.node` floor and the production Dockerfile base image are two halves of the same decision and should be moved together. Today they are at `>=20.0.0` and `node:20-slim` respectively; without bumping both, contributors can develop on Node 18/20 while the prod image is Node 22 and miss runtime regressions locally. | Captured in the RFC's "Customer Problem" section as the secondary motivation for bumping `engines`. No separate rule update — this is a reusable observation, not a project-wide enforcement candidate. |
| Evidence docs from past issues (#28 deploy evidence) are immutable historical records. References to old base images in those docs should NOT be rewritten when the runtime is upgraded. The evidence is the snapshot, not the current state. | Not a new rule, but worth flagging — the audit deliberately did not propose touching `docs/evidence/28-deploy-evidence.md:58` even though it mentions `node:20-alpine`. |
