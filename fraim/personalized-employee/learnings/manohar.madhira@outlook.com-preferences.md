# Preferences — manohar.madhira@outlook.com

Patterns that describe how this user prefers to work, interact, and approach recurring decisions.

---

## ⏳ Pending Review — 2026-04-24

### Proposed new entries

#### [P-HIGH] Browser validation of UI changes before submit is non-negotiable

**Score**: 8.0
**Last seen**: 2026-04-20
**Recurrences**: 1
**First synthesized**: (pending)

For any UI-facing change, the user expects actual browser testing (Playwright or manual) before the implementation phase is reported as complete. Typecheck + build + smoke-test passing is not sufficient validation for React state sync, form population, rendering, or styling. On issue #153, the user's pushback ("Have you tested these?") forced full local env setup and browser validation — which then confirmed the fix worked end-to-end. Default behavior should be to set up whatever is needed (Docker, local DB, Clerk, browser) rather than relying on compile-time checks.

---

#### [P-HIGH] Tight PR scope — no opportunistic scope creep

**Score**: 8.0
**Last seen**: 2026-04-21
**Recurrences**: 1
**First synthesized**: (pending)

The user values PRs that do exactly one thing. Issue #166 was a `deploy.yml` hardening: +29/-7 on one file, with a tangentially related concern (third-party action SHA-pinning) deferred to a follow-up issue rather than smuggled in. Default stance: if a fix is discovered mid-task but outside the issue's acceptance criteria, file a separate issue, do not bundle. Related: project rule R21 (one issue per branch) formalizes the branch-level version of this preference.

---

#### [P-HIGH] Prefer systemic fixes over per-file fixes for cross-cutting issues

**Score**: 8.0
**Last seen**: 2026-03-31
**Recurrences**: 1
**First synthesized**: (pending)

When a bug affects multiple files with the same root cause, the user expects the fix to live at the shared layer — `globals.css`, a shared component, a utility, or a config — not replicated per file. On issue #71, the user's one-line pushback ("Why are you individually updating style in each file? Isn't having global style a better pattern?") triggered a full revert of a 7-file change in favor of a 5-line global CSS rule. This preference is now formalized as project rule #15.

---

#### [P-MED] Surface open decisions with recommended defaults

**Score**: 5.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: (pending)

When presenting design decisions for reviewer sign-off (RFC review, architectural tradeoffs), the user responds fastest when each open decision is framed as a small set of concrete options with one marked `← recommended`. On issue #2, both open decisions (OD-1 `packages/ui` placement, OD-2 pagination backfill scope) resolved in a single round because each had a recommended default. Default presentation format: numbered binary/ternary choice, one-line trade-off per option, explicit `← recommended` on the preferred path.

---

#### [P-MED] Thorough parallel context-gathering before design work

**Score**: 5.0
**Last seen**: 2026-03-27
**Recurrences**: 1
**First synthesized**: (pending)

For design and RFC phases, reading all relevant context files (schema, existing routes, worker code, shared types, architecture doc, feature spec, project rules, UI mocks) in parallel at the start of the phase produces better outcomes than sequential/on-demand reads. On issue #2, reading 8 key files upfront captured the `brandId`-from-JWT pattern, soft-delete approach, BullMQ split, and existing rule evaluator behavior — all of which shaped the RFC correctly on the first draft. Complementary to the existing `[P-MED] Parallel document reads at phase start` entry in `sid.mathur@gmail.com-preferences.md`.
