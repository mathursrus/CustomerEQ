# Feature Specification: Social Review Ingestion and External Signal Hub
Issue: #113  
PR: https://github.com/mathursrus/CustomerEQ/pull/114

## Completeness Evidence

- Issue tagged with label `phase:spec`: Yes
- Issue tagged with label `status:needs-review`: Yes
- All specification documents committed/synced to branch: Yes

### Customer Research Areas

| Customer Research Area | Sources of Information |
|---|---|
| User problem and desired workflow | GitHub issue `#113`; existing CustomerEQ architecture; current `/admin/integrations`, CX analytics, and Customer 360 code paths |
| Current product constraints | `docs/architecture/architecture.md`; `packages/database/prisma/schema.prisma`; `apps/api/src/routes/members.ts`; `apps/web/src/app/(admin)/admin/integrations/page.tsx` |
| Business and prioritization context | `docs/replicate/IMPLEMENTATION_ROADMAP.md`; `docs/business-development/business-validation-report-cx-loyalty-platform-2026-03-24.md`; updated `fraim/personalized-employee/rules/project_rules.md` |
| Competitive landscape | Current official product and documentation pages for Sprout Social, Yext, Brandwatch, Sprinklr, Bazaarvoice, Birdeye, Podium, Yotpo, Meltwater, and Reputation.com reviewed on 2026-04-07 |

### Feedback History

No feedback file existed at `docs/evidence/113-spec-feedback.md` at submission time.

### PR Comments and Disposition

| PR Comment | How Addressed |
|---|---|
| None yet | Initial submission package |

## Work Completed

- Updated `fraim/personalized-employee/rules/project_rules.md` to replace the locked-MVP rule with post-MVP scope discipline while preserving the differentiation guardrails.
- Created `docs/feature-specs/113-social-review-ingestion.md`.
- Created `docs/feature-specs/mocks/113-view.html`.
- Ran the FRAIM `feature-specification` workflow through context gathering, spec drafting, competitor analysis, and completeness review.

## Validation

| Check | Result |
|---|---|
| Issue-to-requirement coverage | Completed. The issue asks were mapped to requirements `R1-R3`, `R6-R9`, and the UX/compliance sections. |
| Compliance section present | Yes. The spec includes an inferred GDPR/CCPA section with tenant-scope and data-minimization constraints. |
| Design standards section present | Yes. The spec includes `Design Standards Applied` and references the generic UI baseline. |
| HTML mock exists | Yes. `docs/feature-specs/mocks/113-view.html` was created. |
| Mock local render | Local HTTP render returned `200` when served at `http://127.0.0.1:8876/113-view.html`. |
| Browser-tool visual validation | Partial. Playwright navigation was blocked by environment profile-directory permissions (`EPERM` on `.playwright-mcp`), so validation fell back to local HTTP render plus source inspection. |

## Quality Checks

- Deliverables required for spec phase were produced.
- Requirements are written in SHALL-style and include acceptance criteria.
- Edge cases, alternatives, competitive analysis, and validation steps are documented.
- The draft is ready for human review, with one explicit follow-up decision still open around native X support versus generic connector coverage.

## Phase Completion

| Phase | Evidence |
|---|---|
| `context-gathering` | Loaded issue `#113`, roadmap, architecture, business validation, and repo rules; identified the original MVP-scope conflict before the user explicitly overrode it. |
| `spec-drafting` | Drafted the feature spec and HTML mock. |
| `competitor-analysis` | Expanded the spec with a competitor matrix, differentiation strategy, fallback paths, and research sources. |
| `spec-completeness-review` | Confirmed mock existence, requirement coverage, compliance coverage, and design standards section; documented the Playwright environment limitation. |

## Continuous Learning

| Learning | Agent Rule Updates (what agent rule file was updated to ensure the learning is durable) |
|---|---|
| CustomerEQ is now operating in a post-MVP phase and should allow scoped post-MVP specification/implementation work without tripping a hard MVP lock. | Updated `fraim/personalized-employee/rules/project_rules.md` |
