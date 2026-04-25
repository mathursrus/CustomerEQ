# Evidence: Broken Windows Detection — Issue #157

## Summary
- **Issue:** #157 — Standardize list → view → edit navigation pattern across CRUD entities
- **Workflow:** broken-windows-detection-and-remediation
- **Description:** Identified 3 route-based CRUD entities that deviate from the Programs list → view → edit navigation pattern

## Work Completed

### Key Files Created
- `docs/bootstrap/broken-windows-report-2026-04-20.md` — Full broken windows report with pattern analysis, deviations, and remediation plan

### Approach
1. **Codebase pattern discovery** — Scanned all 12 admin list display pages, identified the Programs pattern as dominant for route-based CRUD entities
2. **Broken window detection** — Found 3 entities deviating from the pattern:
   - **Alert Rules** (`alerts/rules/page.tsx:138`) — direct-to-edit, no view-only route
   - **Campaigns** (`campaigns/CampaignActions.tsx:36`) — direct-to-edit, no view-only route
   - **Themes** (`settings/themes/[id]/page.tsx`) — combined view+edit, no mode separation
3. **Remediation planning** — Prioritized fixes with specific file-level actions per entity
4. **Report generation** — Created comprehensive report at `docs/bootstrap/broken-windows-report-2026-04-20.md`

### Entities Already Following Pattern
- Programs (reference implementation)
- Surveys
- Members (view-only detail — correct)

### Out of Scope (confirmed with user)
- Inline-editing entities (KB Articles, Support Rules, Integrations) — deferred

## Validation
- Verified route structures via file system glob for all entities
- Confirmed navigation links via grep of href patterns and router.push calls
- Cross-referenced with Programs reference implementation routes

## Quality Checks
- [x] All 3 broken windows documented with exact file paths and line numbers
- [x] Acceptance criteria defined per entity in GitHub issue
- [x] Pattern standard table included for future CRUD entities
- [x] Report follows established format from prior `broken-windows-report-2026-03-26.md`

## Phase Completion
- [x] Phase 1: codebase-pattern-discovery
- [x] Phase 2: broken-window-detection
- [x] Phase 3: remediation-planning
- [x] Phase 4: broken-windows-report-generation
- [x] Phase 5: broken-windows-submission (this phase)
