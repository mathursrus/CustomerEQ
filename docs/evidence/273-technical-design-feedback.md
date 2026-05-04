# Feedback for Issue #273 - Technical Design Workflow

## Round 1 Feedback
*Received: 2026-05-04 (PR #275 conversation, prior to first-pass review)*

### Comment 1 - ADDRESSED
- **Author**: manohar.madhira@outlook.com
- **Type**: design-question
- **File**: `docs/rfcs/273-baml-esm-imports.md`
- **Comment**: "The probe checking if the image is activated — should it be in CI or CD?"
- **Status**: ADDRESSED
- **Resolution**:
  - Updated RFC's "Technical Details → CI safety net" section to explicitly carve out CI vs CD responsibilities. CI probe = code-load gate (cheap, runs at PR time, no prod infra). CD `Verify API health` (already exists in `deploy.yml:119-132`) = deployed-revision gate (env/secrets/connectivity). They are complementary, not redundant.
  - Narrowed the CI probe target from `apps/api/dist/server.js` (which would run the full app's module-load tree, including any env-var reads that would false-positive in CI) to `@customerEQ/ai` directly. This is the regression class we actually had, has zero side effects, and avoids coupling the test to env-var contracts.
  - Added rationale (the empirical 16-day-skipped-CD argument for shift-left) and explicit "what CI can't catch" so the carve-out is durable.
  - Validation Plan and Test Matrix tables updated to reference the narrower probe.

### Comment 2 - ADDRESSED
- **Author**: manohar.madhira@outlook.com  
- **Type**: design-question (same conversation, derived from Comment 1's analysis)
- **File**: `docs/rfcs/273-baml-esm-imports.md`
- **Comment**: Probe-target choice — `apps/api/dist/server.js` would risk false positives from module-load-time env-var reads. Narrow to `@customerEQ/ai`.
- **Status**: ADDRESSED
- **Resolution**: See Comment 1 resolution; narrowed probe target documented in RFC + Validation Plan rows.
