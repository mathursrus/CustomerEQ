# Issue #388 — Implementation Work List

**Title**: CD: add canary API checks to post-deploy probe covering critical paths  
**Type**: feature  
**Branch**: `feature/388-cd-add-canary-api-checks-to-post-deploy-probe-covering-critical-paths`  
**Scope**: CI/CD workflow only — no application code, no schema, no UI

---

## Scope Summary

The current `deploy.yml` health check only probes `GET /healthz`. A failing migration or misconfigured route will not be caught. This issue adds a canary step that probes a representative set of critical API endpoints after every deploy. Acceptable status codes confirm the route is registered and auth middleware is running; 500 or connection errors fail the pipeline.

No RFC or feature spec exists — the GitHub issue body is the authoritative specification.

---

## Implementation Checklist

- [ ] `.github/workflows/deploy.yml` — Add "Canary API checks" step after "Verify API health"  
  - Reuses `API_FQDN` lookup pattern from existing steps  
  - `check()` bash function: label, URL, optional method (default GET)  
  - Acceptable statuses: 200, 401, 202, 404 (any other → exit 1)  
  - **P0 endpoints** probed:  
    - `GET /healthz` → 200  
    - `GET /v1/programs` → 200 or 401  
    - `GET /v1/surveys` → 200 or 401  
    - `POST /v1/events` → 202 or 401  
  - **P1 endpoints** probed (schema-sensitive):  
    - `GET /v1/surveys/_canary_/imports` → 200 or 401 or 404  
    - `GET /v1/members/me/balance` → 200 or 401  
    - `GET /v1/analytics/cx` → 200 or 401  
  - Step is conditional on `steps.changes.outputs.build == 'true'` (same as all other deploy steps)

---

## Known Deferrals / Open Questions

- `POST /v1/members/enroll` is listed as P0 in the issue table but absent from the implementation sketch. Omitted: sending an unauthenticated POST without a valid body returns 400 (schema validation), not a signal of route-level health. The route is exercised by integration tests. Can be added later with a signed canary payload stored in Key Vault.
- Canary credentials (authenticated 200 responses) deferred: the 401-as-pass strategy is sufficient to confirm routes and middleware without requiring Key Vault-stored test credentials.
- `POST /v1/members/enroll` and `POST /v1/events` without a body may return 400 (validation error) instead of 401 — if route-level auth fires before body parsing, 401 is expected; if body parsing fires first, 400 would be expected. Monitoring first run will clarify.

---

## Validation Requirements

- `uiValidationRequired`: false  
- `mobileValidationRequired`: false  
- **Manual workflow validation**: Trigger `workflow_dispatch` on the feature branch after merge to main; confirm the "Canary API checks" step runs and all probes pass.  
- **YAML syntax**: Confirm deploy.yml passes YAML lint before commit.  
- **CI gate**: `pnpm build && pnpm typecheck && pnpm test:smoke` (no changes to application code, but gate must pass).

---

## Phase Complexity

Files to modify: **1** (`.github/workflows/deploy.yml`)  
Phase-splitting candidate: **No**
