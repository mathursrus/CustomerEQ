# Standing Work List: Issue 121 (Case Detail Page Crash)

## Architectural & Codebase Context
- **Issue Type:** Bug
- **Target Component:** `apps/web/src/app/(admin)/admin/alerts/cases/[id]/page.tsx`
- **Pattern Discovered:** Next.js App Router client component fetching data from the API (`/v1/cases/:id`). The crash is highly likely due to strict property access (like `.length` or `.map()`) on potentially undefined/null fields in the returned `caseData` (e.g., `topics`, `channelsNotified`, `notes`, or invalid dates in `slaTarget`).

## Implementation Checklist
- [ ] **Phase 2: Reproduce** - Trigger the exact error in the browser or check the API response to identify which fields are null/undefined.
- [ ] **Phase 3: Test (if applicable)** - Identify if API tests cover this scenario or need a new fix.
- [ ] **Phase 4: Code** - Update `apps/web/src/app/(admin)/admin/alerts/cases/[id]/page.tsx` with defensively robust rendering logic (e.g., optional chaining `?.length`, coalescing `?? []`).
- [ ] **Phase 4: Code (Server)** - Assess if the Fastify API or Database queries are omitting arrays and fix if necessary.
- [ ] **Phase 5: Validate** - Manually confirm the fix using the UI.

## Validation Requirements
- **uiValidationRequired:** Yes
- **mobileValidationRequired:** No 
- **Journey:** Admin -> Cases -> Click Case row -> Verify the detailed view loads.
- **Evidence Artifact:** Must record findings in `docs/evidence/121-ui-polish-validation.md`.
