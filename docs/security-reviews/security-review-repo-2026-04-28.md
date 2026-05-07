---
reviewContext:
  subjectType: repository
  subjectLabel: CustomerEQ
  reviewRef: fraim-review-2026-04-28
  scopeSummary: Repo-wide FRAIM security review covering web, API, LLM, data-pipeline, privacy, secrets, and capability-authoring surfaces in CustomerEQ.
  repoIdentifier: github.com/mathursrus/CustomerEQ
  branchRef: main
  sourceInventory:
    - apps/api/src/routes/public.ts
    - apps/api/src/routes/campaignPlay.ts
    - apps/api/src/routes/support-public.ts
    - packages/shared/src/zod/webhooks.ts
    - apps/web/src/app/api/mcp/route.ts
quality:
  composite: 3.0
  gateDecision: fail
  findingSeverity:
    score: 0.0
    rationale: Five high-severity findings and two medium-severity findings remain unresolved, including multiple authentication failures on public/member-facing endpoints.
  remediationReadiness:
    score: 7.0
    rationale: All findings were dispositioned to file and converted into tracked GitHub issues during submission handoff, but no remediations have landed yet.
  coverageCompleteness:
    score: 10.0
    rationale: All applicable review categories ran without recorded skill errors; the review covered web, API, LLM, data-pipeline, secrets, privacy, and capability-authoring surfaces.
  criticalFindings: 0
  highFindings: 5
  mediumFindings: 2
  lowFindings: 0
  skillErrors: 0
  coaching: Replace email-as-identity patterns with signed member/session tokens first; that single remediation theme removes the highest-risk findings across surveys, support, and campaign play.
---

# Security Review Report

## Executive Summary

This repo-wide security review failed the gate. No critical findings were identified, but five high-severity findings remain open and several of them are unresolved authentication flaws on public/member-facing routes. The most urgent issue is a repeated pattern of treating email addresses as identity on public workflows.

Immediate escalation items:
- Replace email-based identity on public survey, support, and campaign-play flows.
- Protect the public survey trigger endpoint with real request authentication and anti-abuse controls.
- Add SSRF guardrails to outbound webhook configuration and delivery.

## Review Scope

- `reviewType`: standalone-security-review
- `reviewScope`: repo
- `target`: CustomerEQ repository on branch `main`
- `surfaceAreaPaths`: `apps`, `packages`, `fraim`, `docs`
- Referenced artifacts included route handlers, worker processors, shared schemas, web endpoints, FRAIM capability-authoring content, and repo-local evidence docs.

## Threat Surface Summary

| Surface | Evidence |
| --- | --- |
| Web | `apps/web/src/app/api/mcp/route.ts`, `apps/web/src/app/survey/[id]/page.tsx`, `apps/web/test/e2e/critical-path.spec.ts` |
| API | `apps/api/src/routes/public.ts`, `apps/api/src/routes/surveys.ts`, `apps/api/src/routes/analytics.ts`, `apps/api/src/routes/support-public.ts`, `apps/api/src/routes/campaignPlay.ts` |
| LLM App | `packages/ai/src/analysis/embeddings.ts`, `apps/api/src/routes/intent.ts`, `packages/ai/src/analysis/support.ts` |
| Data Pipeline | `apps/api/src/queues/bullmq.ts`, `apps/worker/src/processors/webhookDelivery.ts`, `apps/worker/src/processors/surveyDistribute.ts`, `packages/database/src/client.ts` |
| Capability Authoring | `fraim/personalized-employee/rules/project_rules.md`, `fraim/ai-employee/skills/**`, `docs/retrospectives/*.md` |

## Coverage Matrix

| Category | Status | Notes |
| --- | --- | --- |
| OWASP Top 10 Web | Fail | Wildcard CORS on authenticated MCP endpoint; public survey flow embeds email in browser-visible URLs. |
| OWASP API Top 10 | Fail | Public/member-facing routes rely on email as identity and expose unauthenticated business flows. |
| OWASP LLM Top 10 | Pass | LLM surfaces are present, but this run found no stronger concrete finding than the API/privacy failures already documented. |
| Capability Authoring | Pass | FRAIM repo content was in scope, but no direct security defect was identified in the reviewed capability-authoring files. |
| Secrets in Code | Pass | Pattern scan found environment-variable references and docs examples, but no committed live secret material. |
| Privacy / PII | Fail | Member email is used as an auth surrogate and embedded in survey URLs. |

## Findings

| ID | Severity | Classification | Location | Summary | Disposition |
| --- | --- | --- | --- | --- | --- |
| `b56d24312820` | High | `API2:2023` | `apps/api/src/routes/public.ts:141` | Public survey submission resolves identity from `memberEmail`, so anyone with a survey ID and member email can respond as that member. | File |
| `2b90a7043708` | High | `API6:2023` | `apps/api/src/routes/public.ts:356` | Public survey trigger is unauthenticated and can enqueue outbound email notifications for known members. | File |
| `a05db056d4cd` | High | `API2:2023` | `apps/api/src/routes/campaignPlay.ts:6` | Campaign play authenticates the member by treating the bearer token itself as the member email string. | File |
| `7e7d85da43ec` | High | `API2:2023` | `apps/api/src/routes/support-public.ts:11` | Public support conversation creation authenticates by reading member email out of the bearer token. | File |
| `e824f8cb3a5b` | High | `API7:2023` | `packages/shared/src/zod/webhooks.ts:11`; `apps/worker/src/processors/webhookDelivery.ts:63` | Webhook endpoints accept arbitrary HTTPS targets and the worker posts to them directly, creating SSRF exposure. | File |
| `0dd35a57d4c1` | Medium | `API8:2023` | `apps/web/src/app/api/mcp/route.ts:22` | Authenticated MCP endpoint replies with wildcard CORS and accepts Authorization headers from any origin. | File |
| `d920a4544e45` | Medium | `PII-URL` | `apps/api/src/routes/public.ts:402`; `apps/web/src/app/survey/[id]/page.tsx:252` | Survey links embed member email in the query string and the web app consumes that value directly. | File |

## Prioritized Remediation Queue

1. Replace email-as-identity with signed, time-bound member tokens across `campaignPlay`, `support-public`, and public survey flows.
2. Add authenticated source verification, replay protection, and rate limiting to `/v1/public/surveys/trigger`.
3. Constrain outbound webhook destinations with IP/DNS resolution checks and explicit private-range blocking.
4. Remove email query parameters from survey links and resolve the target member server-side from an opaque token.
5. Restrict MCP endpoint CORS to intended client origins after confirming the MCP/OAuth client inventory.

## Verification Evidence

- Public survey response route is explicitly public and performs member lookup by email:
  `apps/api/src/routes/public.ts:141-179`
- Public survey trigger route is explicitly public and queues outbound email notifications:
  `apps/api/src/routes/public.ts:356-423`
- Campaign play authenticates via bearer email:
  `apps/api/src/routes/campaignPlay.ts:6-22`
- Public support conversations authenticate via bearer email:
  `apps/api/src/routes/support-public.ts:11-19`
- Webhook schema allows any HTTPS URL and worker fetches it directly:
  `packages/shared/src/zod/webhooks.ts:11-24`, `apps/worker/src/processors/webhookDelivery.ts:57-72`
- MCP endpoint wildcard CORS:
  `apps/web/src/app/api/mcp/route.ts:22-27`
- Email query parameter propagated into survey page state:
  `apps/api/src/routes/public.ts:402-403`, `apps/web/src/app/survey/[id]/page.tsx:245-252`
- Secrets pattern scan found no committed live secrets:
  repo-wide regex search for common token/key formats returned env-var references and docs examples only.

## Applied Fixes and Filed Work Items

- Applied fixes: none
- Filed work items:
  - `#203` require signed member identity for public survey responses (`b56d24312820`)
  - `#204` authenticate and rate-limit the public survey trigger endpoint (`2b90a7043708`)
  - `#205` stop treating bearer tokens as member emails in campaign play (`a05db056d4cd`)
  - `#206` stop treating bearer tokens as member emails in support-public routes (`7e7d85da43ec`)
  - `#207` add SSRF guardrails to outbound webhook delivery (`e824f8cb3a5b`)
  - `#208` restrict MCP endpoint CORS to trusted origins (`0dd35a57d4c1`)
  - `#209` remove member email from survey URLs (`d920a4544e45`)
- Reason: no safe allowlisted auto-fixes applied during this review-only pass; findings were converted into tracked remediation issues for follow-up implementation.

## Accepted / Deferred / Blocked

- Accepted: none
- Deferred: none
- Blocked: none

## Compliance Control Mapping

| Finding ID | Likely Control Areas |
| --- | --- |
| `b56d24312820` | Access control, customer data integrity, GDPR/CCPA consented processing safeguards |
| `2b90a7043708` | Abuse prevention, customer communications control, change/authentication management |
| `a05db056d4cd` | Authentication and session management, tenant/customer data protection |
| `7e7d85da43ec` | Authentication and session management, support-channel privacy controls |
| `e824f8cb3a5b` | Network egress control, third-party integration security, cloud metadata protection |
| `0dd35a57d4c1` | Secure configuration management, API client trust boundaries |
| `d920a4544e45` | Privacy by design, PII minimization, log/history exposure control |

## Run Metadata

- Run date: `2026-04-28`
- Branch: `main`
- Scope label: `repo`
- Reviewed path roots: `apps`, `packages`, `fraim`, `docs`
- Approximate reviewed path count: `1314`
- High findings: `5`
- Medium findings: `2`
- Skill errors: `0`
- Auto-fix cap hit: `no`
- Environment notes:
  This was a review-and-handoff pass. Review artifacts were committed on a dedicated review branch and the filed findings were synced into GitHub issues `#203` through `#209`.
