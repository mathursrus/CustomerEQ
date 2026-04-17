# local-mcp-oauth Bug Bash Evidence

## Summary
- Issue: local MCP OAuth / CustomerEQ MCP validation
- Workflow type: bug bash / user testing
- Completed work: added MCP end-to-end regression coverage, manually validated the local OAuth journey, documented findings, and fixed the stale local dev-server build issue discovered during manual testing.

## Work Completed
- Updated `apps/web/src/app/api/mcp/callback/route.ts` to support test-only authenticated callback injection in `PLAYWRIGHT_TEST` mode while preserving normal runtime behavior.
- Restored the stable path-scoped protected-resource route at `apps/web/src/app/.well-known/oauth-protected-resource/[...path]/route.ts`.
- Added `apps/web/test/e2e/mcp-oauth.spec.ts` covering:
  - OAuth metadata discovery
  - protected-resource metadata
  - unauthenticated Bearer challenge
  - dynamic client registration response shape
  - authorize redirect behavior
  - callback handoff page generation
  - authorization-code exchange
  - code reuse rejection
  - authenticated MCP tool listing
- Removed unnecessary local scratch/test artifacts created during debugging.
- Wrote the manual bug bash report to `docs/evidence/local-mcp-oauth-bug-bash-report.md`.

## Validation
- `pnpm --filter @customerEQ/web typecheck` — passed
- `pnpm --filter @customerEQ/web test:e2e -- test/e2e/mcp-oauth.spec.ts` — passed
- Manual browser validation:
  - `/mcp/authorize` redirected to `/sign-in` with encoded callback payload
  - callback success page rendered with fallback guidance and client-return link
  - desktop and mobile-width callback layouts both rendered cleanly

## Findings
- Resolved environment issue: stale `apps/web/.next` artifacts on the long-lived `3000` dev server caused `/sign-in` to 500 until the server was cleaned and restarted.
- No remaining MCP product defects were found after fixes.
- Non-defect observation: automated browsers require a user gesture for `cursor://` launches; the fallback link covers the real-user path.

## Quality Checks
- MCP regression coverage now exists for the routes added/changed in this session.
- Manual and automated evidence are consistent.
- Work is ready for your review.

## Submission Status
- Committed on `feature/issue-144-mcp-oauth-local`
- Pushed to `origin/feature/issue-144-mcp-oauth-local`
- Opened for remote review as PR `#145`
- Follow-up DB setup reliability bug filed as `#144`
