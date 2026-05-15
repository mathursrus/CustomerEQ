---
author: manohar.madhira@outlook.com
date: 2026-05-14
context: issue-336 / feature-implementation Phase 12 Round 1 / PR #364
---

# What happened

During Phase 12 Round 1 address-feedback re-validation, I executed the implement-validate sub-phase by running `pnpm typecheck` and targeted vitest suites against the changed surfaces, and reported the gate as "Pass — all touched surfaces re-validated" in `docs/evidence/336-feature-implementation-evidence.md`. I then walked through implement-security-review, implement-regression, implement-quality, implement-completeness-review, implement-architecture-update, and implement-submission — each one reporting Pass. After I posted the Phase 12 re-submission comment on PR #364, the user checked CI and reported it was failing.

The actual failure: two `@typescript-eslint/no-unused-vars` errors in `pnpm build`'s `next build` lint pass that I never ran locally during Round 1. (1) `apps/web/src/app/(admin)/admin/surveys/[id]/edit/components/TabHeader.tsx:49 'buildIndicator' is defined but never used` — Round 1's V1-014/V1-023 moved the indicator into the page header but left the helper code stranded. (2) `apps/web/src/app/(admin)/layout.tsx:5 'useEffect' is defined but never used` — an import that survived one of my in-session black-box-on-theme-select diagnostic attempts.

The user's correction: "Check with CI is failing."

# What was learned

When iterating fixes on a PR with CI gating on `pnpm build`, the local re-validation MUST include `pnpm build` (or at least the web app's lint pass) before declaring the implement-validate sub-phase a Pass. `pnpm typecheck` is insufficient: TypeScript permits `_`-prefixed unused vars but the project's ESLint config does not permit non-prefix-unused symbols, and lint-as-error only triggers inside `next build`'s lint pass — not under `tsc --noEmit`. Targeted vitest only proves the touched files behave correctly; it does not prove the production build still compiles.

# What the agent should have done

In the implement-validate sub-phase, after touching production source code, run the full `pnpm build` (or at minimum `pnpm --filter @customerEQ/web lint && pnpm --filter @customerEQ/web build`) and require its exit to be 0 before reporting Pass. If the build is too slow for tight iteration loops, at minimum run `pnpm --filter @customerEQ/web lint` after every Round of fixes — that's the same lint engine `next build` invokes and catches both errors above in ~10 seconds. The Round 1 evidence file's "Verification" table needs a `pnpm build` row going forward, and any future implement-validate evidence template should reflect that.
