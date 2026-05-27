# Feature Specification: Switch Member Identifier Kind — Slice 1 (Customer ID → Email)
Issue: #524
PR: this PR (`feature/524-switch-a-brand-s-member-identifier-kind-...`)

## Completeness Evidence
- Issue tagged with label `phase:spec`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All specification documents committed/synced to branch: Yes
  - `docs/feature-specs/524-switch-member-identifier-kind.md` (spec, 27 R-statements)
  - `docs/feature-specs/mocks/524-switch-member-identifier-kind.html` (8-scene HTML mock)
  - `docs/brainstorming/codebase-brainstorming-2026-05-27.md` (gap analysis backing the issue)

### Customer Research
| Customer Research Area | Sources of Information |
|---|---|
| Current locked-state behavior & dead `mailto:` | `apps/api/src/routes/admin-brand-profile.ts:322-335`, `apps/web/.../MemberIdentificationSection.tsx:89-102`, RFC `docs/rfcs/231-...md:375` |
| Member resolution / canonical key mechanics | `apps/api/src/services/memberResolution.ts:53-92,143-145`; `packages/database/prisma/schema.prisma:203,330,374` |
| Ingress paths needing catch-up | `public.ts:457`, `members.ts:117`, `apps/worker/src/processors/surveyImport.ts:23-31`, `distributionBatches.ts` |
| Reusable progress/upload patterns | `SurveyImportBatch` (`schema.prisma:910-931`); 262 import-flow mock; `usePollingQuery` (architecture.md §3.1) |
| Competitor handling of identity change | Smile.io & Yotpo help-center docs (accessed 2026-05-27; cited in spec Competitive Analysis) |

### PR Feedback
| PR Comment | How Addressed |
|---|---|
| _(none yet — awaiting human review)_ | — |

## Continuous Learning
| Learning | Agent Rule Updates |
|---|---|
| Migrating *into* EMAIL sidesteps the `surveyImport.ts` EMAIL-hardcoding wrinkle (A1); it must be carried to the first non-EMAIL-target slice. | Captured in spec scope note + issue #524 phased-delivery caveat (not a durable agent-rule change — slice-specific). |
| Identifier kind is V0-immutable by design (#231); the switch is a deferred follow-on, not a bug. | Recorded in spec "Customer Problem" + Alternatives so future agents don't treat the lock as a defect. |
