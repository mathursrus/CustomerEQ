# Issue #540 — Feature Implementation Feedback (Quality Check)

## Run summary

- `deep-code-quality-checks` on the diff for `feature/540-...` branch (3-finding bundle: F1 worker URL resolver, F2 logo `<img>`, F3 sent-count semantics).
- 0 quality issues found.
- 0 quality issues remaining unaddressed.

## Checks performed — all pass, no findings to record

- **Hardcoded values:** Two URL literals in the diff. (a) `'https://customereq.wellnessatwork.me'` in `.github/workflows/deploy.yml` — matches the existing sender-domain fallback at `apps/api/src/routes/distributionBatches.ts:564` and the convention set by the API's `SUPPORT_EMAIL=support@customereq.wellnessatwork.me` step on the line directly above. Inline literal is the established pattern for non-secret public values; not worth extracting to a workflow-level `env:`. (b) The placeholder string `'https://app.customereq.example'` has been **removed** from the worker code — the chore of this finding.
- **Duplicate code:** The `resolveFrontendBaseUrl()` precedence pattern (`process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL`) is a one-off in the worker; no other process consumes both vars. The sender-domain resolver at `distributionBatches.ts:564` uses a different (3-tier) chain and a different env var; the two cases share a shape but not parameters — DRY extraction would over-generalize.
- **Missed reusability:** None. The new function follows the existing "lazy env-read at call site" pattern used elsewhere in the worker (e.g., `process.env.AZURE_COMMUNICATION_SERVICES_*` reads in the connectors).
- **Quality standards compliance (architecture standards rule):**
  - Secrets — none introduced. The deploy.yml line writes a non-secret env var; no Key Vault binding needed (correct per `CLAUDE.md` Production Secrets Policy: that policy applies to API keys, JWT secrets, DB URLs, etc. — not to public origins).
  - Tenant scoping — F3's new `tx.survey.update({ where: { id: surveyId } })` runs inside the existing transaction where `surveyId` was already resolved against `brandId`. No new authz boundary.
  - Pure functions — `resolveFrontendBaseUrl()` is pure (modulo env). `renderEmailHtml`'s logo-fragment build remains a pure string operation.
- **Monolithic files:** `distributionBatches.ts` ~1390 LOC (pre-existing, also flagged in the #531 quality phase — out of scope). My F3 addition is +12 net LOC inside an existing function. No new monolith concern introduced.
- **Complex logic:** No new nesting depth. `resolveFrontendBaseUrl()` has one `if` guard and one transform — straightforward. F2 is a single template-string change. F3 adds one conditional with a single Prisma call.
- **Architecture health:** No new cross-package imports. No new dependencies. No circular dependency risk.
- **Comments:** Every non-obvious decision (F1's lazy evaluation, F1's throw-vs-default rationale, F2's per-attribute Outlook reasoning, F3's mint-time semantic shift) is captured inline so future readers don't have to reconstruct the why from git history.

## Bonus observation — not a finding, worth noting for follow-up

The `mark-csv-downloaded` handler is now thinner (it no longer touches `Survey.sentCount`). Looking at its remaining purpose — record `SurveyDistribution.sentAt` audit timestamps — it might one day be redundant if those timestamps are no longer consumed (currently `surveyDistribution.sentAt < now` is the dedup criterion *inside this handler itself*; no external consumers grep'd up). That's a future cleanup decision, not in scope here. Tracked only as a comment in the handler, not filed as an issue.

## Blocking condition status

- Quality issues `ADDRESSED`: 0 / 0.
- Quality issues `UNADDRESSED`: 0.
- **Phase passes.**
