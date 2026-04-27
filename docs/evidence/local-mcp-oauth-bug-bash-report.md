# local-mcp-oauth Bug Bash Report

## Scope
Persona: local Cursor/Codex user configuring CustomerEQ MCP with `serverUrl` only.
Primary journeys: OAuth discovery, authorize redirect, sign-in handoff, callback completion page, token exchange, authenticated MCP tool listing.

## Automated Validation
- `pnpm --filter @customerEQ/web typecheck` — pass
- `pnpm --filter @customerEQ/web test:e2e -- test/e2e/mcp-oauth.spec.ts` — pass

## Manual Browser Validation
### Journey 1: Authorize -> sign-in redirect
- Result: Pass after clean dev-server restart.
- Observed URL shape is correct: `/mcp/authorize` redirects to `/sign-in?redirect_url=<callback>`.

### Journey 2: Callback handoff page
- Result: Pass.
- Desktop and mobile-width layouts both show:
  - success heading
  - fallback text telling the user they may close the tab
  - explicit `Return to your MCP client` link
  - visible callback URL for recovery/debugging

### Journey 3: External protocol launch fallback
- Result: Pass with expected browser limitation.
- Observation: automatic `cursor://...` launch is blocked in Playwright without a user gesture; this is a browser automation limitation, not a product defect.
- Fallback link is present for the real user path.

## Findings
### Fixed During Bug Bash
1. **Environment issue: stale `.next` build caused `/sign-in` 500 on the long-lived local dev server**
   - Severity: Major (local-dev blocker)
   - Classification: Environment issue
   - Symptom: runtime error overlay on sign-in, missing `.next/server/pages/_document.js`
   - Repro: use an old `next dev` process on port 3000 after many route/layout changes
   - Fix applied: stop server, remove `apps/web/.next`, restart `next dev`
   - Status: Resolved in session

### Remaining Non-Defects / Notes
1. **Custom protocol auto-launch requires user gesture in browser automation**
   - Severity: None / expected
   - Classification: Environment limitation
   - Notes: callback page fallback link covers this path

2. **`/favicon.ico` returns 404 in local dev**
   - Severity: Minor
   - Classification: Existing cosmetic issue outside MCP scope
   - Status: Not changed

## Responsive Check
- Desktop: 1280x900 — pass
- Mobile width: 390x844 — pass

## Overall Assessment
- MCP OAuth flow is working end-to-end for the intended local setup.
- No open MCP product defects remained after fixes in this session.
- The only issue found during manual testing was a stale local dev build artifact, which has been cleaned and resolved.
