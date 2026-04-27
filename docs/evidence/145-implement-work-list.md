# 145 Implement Work List

## Scope
Bug: MCP OAuth deployment hardening and Codex/Cursor loopback callback compatibility for `https://customereq.wellnessatwork.me/api/mcp`.

## Checklist
- [x] Reproduce the `redirect_uri mismatch` token-exchange failure for loopback callbacks.
- [x] Add regression coverage for equivalent `localhost` and `127.0.0.1` loopback callback URIs.
- [x] Patch token exchange logic to accept equivalent loopback callback hosts without weakening non-loopback validation.
- [x] Align local MCP server base URL resolution with shared git/branch-derived port rules.
- [x] Remove stale Clerk middleware duplication and fix active middleware for Clerk v7.
- [x] Fix current Clerk component/hook type drift blocking `@customerEQ/web` typecheck.
- [ ] Restore local workspace `next` binary resolution so `pnpm build` runs cleanly.
- [ ] Run repo validation gates: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test:smoke`.
- [ ] Deploy the validated build and confirm prod MCP OAuth works end to end.

## Quality Requirements
- Keep MCP setup at `serverUrl` only.
- Preserve strict redirect URI matching for non-loopback callbacks.
- Do not hardcode ports; derive local defaults from shared git/branch logic.
- Keep prod API base URLs env-driven.

## Validation Requirements
- `uiValidationRequired`: true
- `mobileValidationRequired`: false
- Required manual validation: OAuth authorize -> callback -> token exchange -> authenticated MCP tool call.
- Required automated validation: web typecheck, MCP regression tests, repo build/typecheck/lint/smoke gates.
