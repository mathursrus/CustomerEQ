# Evidence: Project Onboarding

**Workflow**: project-onboarding
**Date**: 2026-03-31
**Outcome**: FRAIM-ready state refreshed — mode and version fields confirmed

---

## Summary

Onboarded the CustomerEQ repository into a FRAIM-ready state. Confirmed existing repo context automatically, facilitated three key architectural decisions with the user (database, infrastructure, test strategy), and produced three durable artifacts.

---

## Work Completed

### Files Written

| File | Description |
|------|-------------|
| `docs/architecture/architecture.md` | Greenfield architecture document — monorepo structure, full tech stack with rationale for each choice, data architecture, API design, testing strategy, compliance architecture |
| `fraim/personalized-employee/rules/project_rules.md` | 15 durable project rules covering MVP scope lock, hero feature protection, event-driven invariants, multi-tenant enforcement, shared test-utils pattern, branch conventions, compliance requirements |
| `fraim/config.json` | Project metadata, validation commands, compliance flags, full stack configuration |

### Key Architectural Decisions Made

1. **PostgreSQL over MongoDB**: Loyalty platform is a financial ledger — ACID transactions non-negotiable. JSONB columns cover flexibility needs. User convinced after hearing the ledger integrity argument.
2. **Azure over AWS**: User has Azure credits; services are 1:1 equivalent. Azure Container Apps (API + worker), Azure Database for PostgreSQL, Azure Cache for Redis, Azure Key Vault, Azure Blob Storage, Azure Front Door.
3. **Vercel for Next.js frontend**: Retained even with Azure backend — Vercel has first-party App Router support; Azure Static Web Apps has known limitations.
4. **Shared test-utils as single mock source of truth**: All mocks/factories in `packages/config/src/test-utils/` — no inline mocks in test files.

---

## Validation

- `fraim/config.json` exists and contains approved validation commands, compliance flags, and stack metadata
- `docs/architecture/architecture.md` exists with 9 sections including ADR table
- `fraim/personalized-employee/rules/project_rules.md` exists with 15 rules
- All files committed (`7e6f1fa`) and pushed to `main`

---

## Quality Checks

- ✅ Architecture document includes rationale for every major technology choice
- ✅ PostgreSQL vs MongoDB decision documented with reasoning preserved for future agents
- ✅ Azure infra decision documented (credits + technical equivalence)
- ✅ Compliance requirements (GDPR, CCPA, SOC2, PCI) defined with implementation approach
- ✅ 15 project rules cover MVP scope, hero feature, testing standards, security, and compliance
- ✅ Validation commands align with Turborepo + pnpm monorepo structure
- ✅ All changes committed and pushed

---

## 2026-03-31 Re-onboarding Update

**Changes made:**
- `fraim/config.json`: `version` updated from `"unknown"` → `"0.1.0"`; `mode: "integrated"` added (confirms code + issues in same GitHub repo)
- `fraim/personalized-employee/rules/project_rules.md`: no changes — 16 rules confirmed current and accurate

**Confirmed automatically:**
- All 4 referenced docs exist on disk (architecture, data-models, use-cases, implementation roadmap)
- All validation commands verified against `package.json` scripts
- Stack, compliance, and local dev config unchanged

---

## Deferred (Can Be Added Later)

- Formal ADR files (`docs/architecture/adr/ADR-001` through `ADR-006`)
- Design system document (shadcn/ui + Tailwind — no doc until component library is built)
- `infra/` Terraform scaffolding (created when first deployment is needed)
- Industry/category tags for FRAIM job filtering
