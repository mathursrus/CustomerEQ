# CustomerEQ — Living Test Plan

**Last updated:** 2026-05-19
**Owner:** swavak@gmail.com
**Epic:** #427 (test strategy & observability)

---

## 1. Three-Tier Test Model

| Tier | Workflow | Cadence | SLA | Requires |
|------|----------|---------|-----|----------|
| **Smoke** | `ci.yml` | Every PR | < 15 min wall clock | No API keys, no DB (integration subset excepted) |
| **Nightly regression** | `nightly-regression.yml` | 02:00 UTC daily | < 15 min | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_BASE_URL` |
| **Weekly ops** | `security-audit.yml` | Monday 09:00 UTC | — | npm registry access |

### Design principles

- **Smoke** must never require API keys for LLM services. A PR author without `OPENAI_API_KEY` must get full CI signal.
- **Nightly** is the home for anything that calls real LLMs, costs money per run, or is slow but not blocking.
- **Weekly** is for ops/hygiene tasks — security scans, dep freshness, license checks.
- All tiers **fail loudly** on missing dependencies (Rule 11a). No silent skips, no vacuous passes.
- All tiers grow over time. Add new suites to the right tier via a PR that updates this doc.

---

## 2. Current Test Inventory

### 2a. Smoke tier (`ci.yml` → `pnpm test:smoke`)

Representative test per package run in the smoke suite. Full suites run in `pnpm test:all`.

| Suite | File | Type |
|-------|------|------|
| `api-unit` | `src/routes/healthz.test.ts` | Unit |
| `api-integration` | `test/integration/public-survey.test.ts` | Integration (real DB) |
| `web-unit` | `src/components/survey-form/SurveyFormRenderer.test.tsx` | Unit |
| `web-e2e` | `test/e2e/demo-request.spec.ts` | E2E (Playwright) |
| `demo-storefront-e2e` | `test/e2e/checkout.spec.ts` | E2E (Playwright) |
| `worker-unit` | `src/processors/loyaltyEvents.test.ts` | Unit |
| `mcp-server-unit` | `src/api-client.test.ts` | Unit |
| `ai-unit` | `src/analysis/sentiment.test.ts` | Unit (mock client) |
| `connectors-unit` | `src/google.test.ts` | Unit |
| `consent-text-unit` | `src/validator.test.ts` | Unit |
| `database-unit` | `src/middleware/tenantScope.test.ts` | Unit |
| `shared-unit` | `src/random.test.ts` | Unit |
| `ui-unit` | `src/utils.test.ts` | Unit |

### 2b. Nightly regression tier (`nightly-regression.yml`)

| Suite | Command | Type | Cost |
|-------|---------|------|------|
| `baml-evals` | `pnpm test:baml` | LLM eval (Azure OpenAI) | ~2m50s / ~2 eval files |

**Eval files:** `baml_src/evals/classify-intent.eval.ts`, `baml_src/evals/analyze-feedback.eval.ts`

### 2c. Weekly ops tier (`security-audit.yml`)

| Suite | Command | Purpose |
|-------|---------|---------|
| `pnpm-audit` | `pnpm audit --audit-level=high` | npm vulnerability scan |

---

## 3. Full Test File Inventory (as of 2026-05-19)

| Package | Unit | Integration | E2E | BAML eval | Total files |
|---------|------|-------------|-----|-----------|-------------|
| `@customerEQ/api` | 38 | 27 | — | — | 65 |
| `@customerEQ/web` | 27 | — | 22 | — | 49 |
| `@customerEQ/worker` | 11 | — | — | — | 11 |
| `@customerEQ/ai` | 7 | — | — | 2 | 9 |
| `@customerEQ/shared` | 20 | — | — | — | 20 |
| `@customerEQ/connectors` | 4 | — | — | — | 4 |
| `@customerEQ/consent-text` | 3 | — | — | — | 3 |
| `@customerEQ/database` | 1 | — | — | — | 1 |
| `@customerEQ/demo-storefront` | — | — | 1 | — | 1 |
| `@customerEQ/mcp-server` | 1 | — | — | — | 1 |
| `@customerEQ/ui` | 1 | — | — | — | 1 |
| **Total** | **113** | **27** | **23** | **2** | **165** |

Growth since March 2026 bootstrap report: 251 individual tests → 165 test files (significant expansion, especially API integration and web E2E).

---

## 4. CI Wall-Time Baselines (as of 2026-05-19)

Measured across recent runs post-CI/CD sprint (#391).

### Per-PR smoke (parallel jobs)

| Job | Typical duration | Runs in parallel with |
|-----|-----------------|----------------------|
| `Lint` | ~2m48s | `Build & Test` |
| `Build & Test` | ~12m | `Lint` |
| `Build production images` | ~1m30s (warm cache) | after `Build & Test` |
| **Time to first signal (lint fail)** | **~2m48s** | |
| **Time to full green** | **~12m** | |

### Nightly regression

| Job | Typical duration |
|-----|-----------------|
| `BAML evals` | ~2m50s |

### Weekly ops

| Job | Typical duration |
|-----|-----------------|
| `pnpm audit` | ~1m (network-bound) |

### CI/CD sprint improvement summary

| Metric | Before sprint | After sprint | Delta |
|--------|--------------|--------------|-------|
| Wall clock to all-green | ~15m27s | ~12m | **-3m30s (−22%)** |
| Time to first lint signal | ~15m27s | ~2m48s | **−12m39s** |
| LLM calls per PR | 1 eval file (unbounded spend) | 0 | **Eliminated** |
| Doc-only PR cost | ~15m27s | 0s | **−100%** |
| pnpm audit per PR | ~1m (+ outage risk) | 0 | **Moved to weekly** |

---

## 5. Coverage Baselines

Last measured: 2026-03-26 (bootstrap report). **Stale — refresh needed.** See [docs/bootstrap/test-coverage-report.md](../bootstrap/test-coverage-report.md) for the snapshot.

Codecov is integrated in `ci.yml` (uploads on every run) but no threshold is enforced. Coverage can drop to 0% without CI failure — tracked in #397.

| Package | Statements (Mar 2026) | Grade | Trend |
|---------|----------------------|-------|-------|
| `@customerEQ/shared` | 76.5% | B- | Unknown — refresh needed |
| `@customerEQ/ai` | 69.0% | C+ | Unknown — refresh needed |
| `@customerEQ/api` | 9.8% | F | Likely improved — 27 integration tests added since |
| `@customerEQ/worker` | — | — | Unknown |

**Action:** run `pnpm test -- --coverage` across all packages and update this table. Gate via #397 (Codecov threshold) once targets are set.

### Coverage targets (proposed)

| Package | Current | Target | Priority |
|---------|---------|--------|----------|
| `@customerEQ/api` | ~9.8% | 60% | P0 — hero pipeline routes |
| `@customerEQ/worker` | Unknown | 60% | P0 — loyalty event processors |
| `@customerEQ/shared` | 76.5% | 80% | P1 |
| `@customerEQ/ai` | 69.0% | 75% | P1 |
| `@customerEQ/web` | Unknown | 50% | P1 |
| Others | Unknown | 70% | P2 |

---

## 6. Gap Analysis

### P0 — Critical gaps

| Gap | Current state | Risk | Action |
|-----|--------------|------|--------|
| API integration tests missing from smoke | Only 1 file (`public-survey.test.ts`) runs in smoke | Integration regressions invisible on most PRs | Add `test:integration` to CI gate (#396) |
| Coverage threshold not enforced | Codecov uploads but no gate | Coverage silently degrades | Implement #397 |
| E2E failures open (5 specs) | `program-view-readonly`, `critical-path`, `workflows`, `external-signals-mobile`, `sidebar Integrations` failing (#360, #361) | P0 feature coverage broken | Fix open E2E failures before adding new specs |

### P1 — Important gaps

| Gap | Current state | Action |
|-----|--------------|--------|
| No flakiness tracking | No history of intermittent failures | Phase 3 dashboard (#427) |
| BAML eval coverage | Only 2 of 6 BAML functions have eval files | Add evals for `analyze_feedback`, `detect_anomalies`, `discover_clusters`, `synthesize_profile` |
| Worker processors coverage | 11 unit tests but no integration-level processor tests | Add integration tests for loyalty event processors |
| Node.js 20 deprecation | All actions use Node 20 — forced to Node 24 by June 2 | Fix #434 before June 2 deadline |

### P2 — Backlog

| Gap | Action |
|-----|--------|
| Test results dashboard | Phase 3 of epic #427 |
| LLM eval cost tracking | Add to nightly run summary once dashboard exists |
| License / dep-freshness checks | Add to weekly ops tier |
| Nightly full integration suite | Move `test:integration` full run to nightly tier |

---

## 7. Adding Tests — Decision Guide

**Which tier does my new test belong in?**

```
Does it call a real LLM or external paid API?
  YES → Nightly regression tier
  NO  → continues...

Does it require a real database?
  YES → Integration (runs in smoke via vitest.integration.config.ts if fast,
        or nightly if slow)
  NO  → continues...

Does it require a running browser?
  YES → E2E — add to smoke if < 30s, nightly if slow/flaky
  NO  → Unit — always smoke tier
```

**Rule 9 reminder:** P0 features require unit + integration + E2E. P1 requires unit + integration. P2 requires unit. This applies to feature work; the tiers above govern where those tests run in CI.

---

## 8. Maintenance

- **This doc is the source of truth for test strategy.** Update it when tiers change, new suites are added, or coverage targets are revised.
- **Coverage table:** refresh after any significant feature work by running `pnpm test -- --coverage`.
- **Inventory table:** regenerate by running `find . -path "*/node_modules" -prune -o -name "*.test.*" -print | grep -v node_modules | wc -l` from the repo root.
- **Wall-time baselines:** update after any CI structure change using `gh run list --workflow=ci.yml --limit=10`.
