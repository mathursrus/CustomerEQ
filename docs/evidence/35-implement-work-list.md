# Implementation Work List — #35 Survey Builder + #36 Survey Theming

Issue: #35, #36
Branch: `spec/35-36-survey-builder-theming`
Type: Feature (both)

> **Scope Note:** Combined implementation — 2 features, ~20 files. Approved for full execution since #36 depends on #35's question schema changes.

---

## Phase 1: Database & Shared Schema (Foundation)

- [ ] `packages/database/prisma/schema.prisma` — Add `SurveyTheme` model, `QuestionTemplate` model, add `themeId` FK to Survey
- [ ] `packages/database/prisma/schema.prisma` — Run `prisma generate` to update client
- [ ] `packages/shared/src/zod/survey.schema.ts` — Extend `SurveyQuestionSchema` with `config`, `skipRules` fields; add new question types
- [ ] `packages/shared/src/zod/survey.schema.ts` — Add `CreateSurveyThemeSchema`, `UpdateSurveyThemeSchema`
- [ ] `packages/shared/src/zod/survey.schema.ts` — Add `QuestionTemplateSchema`
- [ ] `packages/shared/src/index.ts` — Export new schemas

## Phase 2: API Routes

- [ ] `apps/api/src/routes/surveys.ts` — Update `POST /v1/surveys` to accept extended question schema
- [ ] `apps/api/src/routes/surveys.ts` — Add `PATCH /v1/surveys/:id` endpoint for updating survey questions (builder save)
- [ ] `apps/api/src/routes/themes.ts` — NEW: CRUD routes for survey themes (GET list, POST create, GET detail, PATCH update, DELETE, POST set-default)
- [ ] `apps/api/src/routes/templates.ts` — NEW: CRUD routes for question templates (GET list, POST create, DELETE)
- [ ] `apps/api/src/routes/public.ts` — Update public survey fetch to include resolved theme
- [ ] `apps/api/src/server.ts` — Register new route files

## Phase 3: Frontend — Survey Builder (#35)

- [ ] `apps/web/src/app/(admin)/admin/surveys/new/page.tsx` — Replace simple form with survey builder (or redirect to builder)
- [ ] `apps/web/src/app/(admin)/admin/surveys/builder/page.tsx` — NEW: Full survey builder page (3-panel: palette, canvas, config)
- [ ] `apps/web/src/app/(admin)/admin/surveys/[id]/edit/page.tsx` — NEW: Edit existing survey (loads builder with existing questions)
- [ ] `apps/web/src/app/survey/[id]/page.tsx` — Update public survey to render all new question types + evaluate skip logic client-side

## Phase 4: Frontend — Survey Theming (#36)

- [ ] `apps/web/src/app/(admin)/admin/settings/themes/page.tsx` — NEW: Theme list page
- [ ] `apps/web/src/app/(admin)/admin/settings/themes/new/page.tsx` — NEW: Theme editor with live preview
- [ ] `apps/web/src/app/(admin)/admin/settings/themes/[id]/page.tsx` — NEW: Edit theme
- [ ] `apps/web/src/app/survey/[id]/page.tsx` — Apply theme CSS variables from resolved theme
- [ ] `apps/web/src/app/(admin)/layout.tsx` — Add "Settings > Themes" to admin sidebar nav

## Phase 5: Tests

- [ ] `packages/shared/src/zod/survey.schema.test.ts` — Update tests for extended question schema, theme schema
- [ ] `apps/api/src/routes/surveys.test.ts` — Update tests for new question types, survey update endpoint
- [ ] `apps/api/test/integration/survey-lifecycle.test.ts` — Update for extended question flow
- [ ] `apps/web/test/e2e/survey-creation.spec.ts` — Update existing E2E tests for builder flow
- [ ] `apps/web/test/e2e/survey-theming.spec.ts` — NEW: E2E tests for theme creation and application

---

## Validation Requirements

- `uiValidationRequired`: true — survey builder is a complex interactive UI
- `mobileValidationRequired`: false — admin builder is desktop-focused; public survey page needs responsive check
- Browser baseline: Chrome latest
- Target journeys:
  1. Admin creates survey with builder (add questions, set skip logic, save)
  2. Admin creates and applies theme to survey
  3. Respondent completes themed survey with skip logic on public page
  4. Existing pre-baked surveys continue to work (backward compatibility)
- Evidence artifact: `docs/evidence/35-ui-polish-validation.md`

## Key Decisions

1. **Builder as separate page** (`/admin/surveys/builder`) rather than replacing `/admin/surveys/new` — keeps creation flow simple for quick NPS/CSAT, builder for custom
2. **SurveyTheme as separate model** (not embedded in Survey.settings) — enables theme reuse across surveys
3. **QuestionTemplate as separate model** — enables question library
4. **Skip logic evaluated client-side** — no server round-trips during survey taking
5. **CSS custom properties** for theming — clean, performant, SSR-compatible

## Open Questions (Resolved)

- Migration: No data migration needed — existing question shape is valid subset of new schema
- Default questions: Keep DEFAULT_QUESTIONS for quick creation; builder for custom surveys
