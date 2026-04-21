# local-mcp-oauth Standing Work List

## Scope
Bug: local MCP OAuth callback/authentication for Cursor against `http://localhost:3000/api/mcp`.

## Checklist
- [ ] Confirm current OAuth discovery/register/authorize/callback/token endpoints and runtime URLs match local origin.
- [ ] Reproduce the failing callback and capture exact server-side error from the active dev server.
- [ ] Repair Prisma/local database drift affecting `mcp_oauth_codes` so callback code issuance is stable.
- [ ] Verify brand resolution path for signed-in users with one or multiple authorized Clerk orgs.
- [ ] Verify callback redirects back to the MCP client with `code` and original `state`.
- [ ] Verify token exchange succeeds and MCP route accepts bearer auth.
- [ ] Clean local Prisma migration state so future local boots do not regress.

## Quality Requirements
- Follow existing Next.js App Router route patterns under `apps/web/src/app`.
- Keep MCP client setup to `serverUrl` only; no manual extra user config.
- Prefer real brand resolution from Clerk/org membership over env fallbacks.
- Fix at the right abstraction level; avoid client-specific hacks.

## Validation Requirements
- `uiValidationRequired`: true
- `mobileValidationRequired`: false
- Manual browser validation required for sign-in -> callback -> redirect-to-client flow.
- HTTP validation required for discovery, register, authorize, callback, token, and authenticated MCP call.
- Evidence source: active `apps/web/next-dev.log` and `apps/web/next-dev.err.log` from a fresh server process.
