# Issue #508 — Fix Google Reviews Integration: Implementation Work List

## Issue Type
Bug / Enablement — Google Business Profile integration was intentionally put into mock mode while API quota was 0. Quota is now approved (> 0). This work list covers: (a) diagnosing what's broken in prod, (b) reproducing locally, and (c) fixing both code and prod config.

---

## Prod Validation Findings (implement-repro pre-work)

Evidence collected against prod (`customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io`):

| Finding | Detail |
|---|---|
| `CEQ_GOOGLE_CLIENT_ID` | **MISSING** from API container env — OAuth authorize returns HTTP 500 |
| `CEQ_GOOGLE_CLIENT_SECRET` | **MISSING** from API container env |
| `CEQ_OAUTH_CALLBACK_BASE_URL` | **MISSING** — defaults to `http://localhost:4000` (wrong for prod) |
| `CEQ_ADMIN_UI_BASE_URL` | **MISSING** — defaults to `http://localhost:3000` (wrong for prod) |
| `CEQ_MOCK_GOOGLE_REVIEWS` | Not set (so mock mode is OFF) — real API path would be hit if creds were present |
| Prod attempt (23:19 UTC today) | 2 sources created, both OAuth authorize calls returned 500 |

Root cause chain: Missing `CEQ_GOOGLE_CLIENT_ID` → `oauth.ts:87` `reply.status(500)` → user sees error.
Even if creds were added, the callback URL would be wrong (`localhost:4000`) so Google would refuse the redirect.

---

## Reproduction Locally

To reproduce the full flow locally with real credentials:
1. Ensure `.env` has `CEQ_GOOGLE_CLIENT_ID`, `CEQ_GOOGLE_CLIENT_SECRET` (already set as Windows env vars)
2. Start local API: `pnpm dev` in `apps/api`
3. Hit `GET /v1/admin/integrations/oauth/google/authorize?sourceId=<id>` → should return 200 with authorizationUrl
4. Follow the OAuth URL → completes → callback hits localhost → tokens stored
5. Hit `GET /v1/admin/integrations/oauth/google/locations?sourceId=<id>` → real GBP API call
6. Trigger sync → connector fetches real reviews

---

## Implementation Checklist

### Code Fixes

- [ ] `packages/connectors/src/google.ts` — Remove `CEQ_MOCK_GOOGLE_REVIEWS` mock block (lines 103–121). The mock data (MOCK_REVIEWS constant) can also be removed entirely.
- [ ] `apps/api/src/routes/oauth.ts` — Remove `CEQ_MOCK_GOOGLE_REVIEWS` mock block in the locations endpoint (lines 287–300).
- [ ] `apps/api/src/routes/oauth.ts` — Change HTTP 500 → **503** for "missing platform credentials" error (line 85–88). A misconfigured platform credential is a service-availability issue, not an internal error.

### Prod Config Fixes (Key Vault → Container App binding)

- [ ] Add `CEQ_GOOGLE_CLIENT_ID` secret to Key Vault → bind to API container (plain env var, not sensitive)
- [ ] Add `CEQ_GOOGLE_CLIENT_SECRET` secret to Key Vault `customereq-kv` → bind to API container via `keyVaultUrl` (sensitive — follow Issue #200 pattern)
- [ ] Add `CEQ_OAUTH_CALLBACK_BASE_URL=https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io` to API container env
- [ ] Add `CEQ_ADMIN_UI_BASE_URL=https://customereq-web.salmonsea-4eb14bdc.eastus.azurecontainerapps.io` to API container env
- [ ] Register prod callback URL in GCP OAuth client: `https://customereq-api.salmonsea-4eb14bdc.eastus.azurecontainerapps.io/v1/integrations/oauth/google/callback`

### Tests

- [ ] `packages/connectors/src/google.test.ts` — Add test confirming mock mode is gone: calling with `CEQ_MOCK_GOOGLE_REVIEWS=true` should NOT return mock data (i.e. still hit real API flow)
- [ ] `apps/api/src/routes/oauth.test.ts` (if exists) — Verify missing-credentials path returns 503 not 500

### Validation

- [ ] Local smoke run: `pnpm test:smoke` — must pass after mock removal
- [ ] Manual validation: OAuth flow end-to-end in local dev (see "Reproduction Locally" above)
- [ ] Manual validation: locations picker returns real GBP locations
- [ ] Manual validation: sync fetches real reviews and creates survey responses
- [ ] `uiValidationRequired: true` — Full OAuth connect flow in browser (local first, then prod post-deploy)
- [ ] `mobileValidationRequired: false`

---

## Validation Requirements

- `uiValidationRequired: true` — OAuth connect flow, locations picker, and integration card in admin UI must all be tested in browser (Playwright or manual)
- `mobileValidationRequired: false`

---

## Deferrals / Open Questions

- **GCP callback URL registration**: Must be done manually in GCP Console before prod OAuth can succeed. Not automatable from code. Verify that the GCP client already has `http://localhost:4000/v1/integrations/oauth/google/callback` registered for local dev.
- **canonicalUrl format**: Connector uses `placeid=${locationId}` which puts the API resource name (`locations/xxx`) in the URL instead of the Google Maps Place ID. This is a cosmetic issue — the URL doesn't resolve properly. Deferred to a follow-up issue; not blocking enablement.
- **Error code 500→503**: Minor change, non-breaking. Included in this PR since it's a one-liner.
