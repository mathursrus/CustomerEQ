# Issue #546 Mobile Survey, Responses, and Insights Rework

Date: 2026-05-30
Branch: `feature/issue-546-mobile-survey-insights`

## FRAIM Runtime Status

FRAIM was attempted before implementation, but `mcp__fraim__fraim_connect` failed twice with `Transport closed`.
Because the runtime did not provide a session id, phase mentoring could not be advanced through `seekMentoring`.

## Scope

- Reworked mobile Surveys, survey response detail, Responses/Reviews, and Insights tabs.
- Kept login/auth flow untouched except for mobile React Query retry behavior.
- Reused the canonical survey preset shape by adding shared survey preset helpers with `isScoreField` preserved.
- Fixed mobile API mappers for actual production response shapes.

## Validation

- User-requested `@fraim` UI polish + bug bash rerun was attempted on 2026-05-30, but `mcp__fraim__fraim_connect` continued to fail with `Transport closed`.
- Manual UI polish pass was run against Metro web at `http://localhost:8083` using mocked production API responses for `/v1/surveys`, `/v1/surveys/:id/responses`, `/v1/analytics/cx/clusters`, `/v1/analytics/cx/anomalies`, and `/v1/reviews`.
- Manual bug bash found React Native Web rendered `Modal presentationStyle="pageSheet"` as a cramped sheet that left list content behind and blocked the survey creator flow; fixed by replacing these feature modals with in-screen full overlays.
- `pnpm build`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 4 pre-existing warnings in `apps/web/src/app/(admin)/admin/surveys/[id]/page.test.tsx`.
- `pnpm test:smoke`: passed.
- `npm run typecheck` in `apps/mobile`: passed.
- `pnpm --filter @customerEQ/shared typecheck`: passed.
- `pnpm --filter @customerEQ/shared build`: passed.
- `pnpm --filter @customerEQ/web typecheck`: passed.
- `npx jest __tests__/useClusters.test.ts __tests__/useSurveyDetail.test.ts __tests__/useSurveys.test.tsx __tests__/NpsSparkline.test.tsx --runInBand --forceExit` in `apps/mobile`: passed, 64 tests.
- `npm test -- --runInBand --forceExit` in `apps/mobile`: passed, 7 suites / 73 tests.
- `pnpm test:integration`: passed, 30 files / 437 tests.
- `pnpm test:baml`: passed, 2 files / 25 eval tests. `AZURE_OPENAI_BASE_URL` was set persistently at user scope; both `[Environment]::SetEnvironmentVariable(..., 'Machine')` and `setx /M` were denied by Windows registry permissions in this non-elevated process.
- `pnpm test:e2e`: passed, 177 tests.
- Expo/Metro web smoke on `http://localhost:8083`: bundle compiled and tabs rendered. Local API was not running, so API-backed screens showed the unreachable-API state.

## Known Local Environment Notes

- Full `npm test -- --runInBand` in `apps/mobile` timed out without `--forceExit`; narrowed tests pass. The existing open handle is Clerk's headless bundle.
- Metro surfaced expected local Clerk origin errors with production Clerk keys on localhost, even with dev bypass enabled, because `ClerkProvider` still loads Clerk.
