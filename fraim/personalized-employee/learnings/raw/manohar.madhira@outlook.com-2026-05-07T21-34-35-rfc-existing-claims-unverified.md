---
author: manohar.madhira@outlook.com
date: 2026-05-07
context: issue-292 / feature-implementation Slice 3 / authored under #277 PR #290
---

# Coaching Moment: rfc-existing-claims-unverified

## What happened

While entering Slice 3 implement-scoping for issue #292, I read the RFC at `docs/rfcs/277-organization-settings.md` (committed in PR #290 / `906cdb4`, authored by an earlier session of the same FRAIM identity) and ran primary-source verification against four of its supporting-infrastructure claims. The RFC asserted, in the prose voice of "existing pattern" / "reuses pattern from #N" / "applied":

- §4.3: logo upload "persists to existing asset path" — apps/api has zero `@fastify/multipart` dependency and no asset-upload pattern outside one unrelated reference in `public.ts`.
- §7a: name-change retry uses "the existing event pipeline (`enqueueIdentityProviderRetry`)" — zero matches across `apps/api/src` and `packages/shared/src`.
- §9: "Per-route audit metadata allowlist (this RFC reuses [the pattern from #276 RFC])" — `apps/api/src/plugins/audit.ts` has zero allowlist logic; logs only `{ method, path, statusCode }`. #276 was spec/RFC only, never implemented.
- §8: "Admin-role gate (existing pattern; rejects non-admin with 403)" — no per-route role check exists across `apps/api/src/routes`; all `/v1/*` admin routes treat any authenticated user with a `brandId` as admin.
- §4.1: response includes `process.env.SUPPORT_EMAIL` — zero matches across `apps/api/src`.
- §Architecture Analysis: claimed five architecture-doc rows "applied (L491–L495)" — I have not yet verified the architecture.md was actually edited.

I surfaced these as four open decisions for the user. The user pushed back: *"This is very bad — how can RFC claim so many things wrong? What is the point of RFC if it hallucinates and assumes?"* and instructed me to run `analyze-why-you-messed-up` and capture the learning before any further work, plus *"For the first question on logo upload — first verify how file upload is working in the Survey Builder — to make sure that it is really an issue and not your miss again."* The L228 mistake-pattern *"Asserted facts about file/config/external-state contents without reading the primary source first"* (score 8.0, 3 recurrences) was loaded into L1 context when the RFC was authored. It did not fire at the design layer because L228's concrete-check language enumerates "modify X / extend Y" RFC table rows, not the "existing X / reuses Y / applied" phrasings the RFC actually used.

## What was learned

Any RFC sentence containing "existing X" / "the existing Y" / "reuses pattern from #N" / "already shipped" / "already applied" / "the pattern from #N" is a primary-source claim that must carry a verifying citation (file path + line number) produced in the same drafting pass — otherwise the row is aspirational, not designed, and forces the implementing session (or worse, the user) to discover the gap.

## What the agent should have done

At RFC drafting time, every "existing"/"reuses"/"applied" sentence should have triggered an immediate Read or Grep against the named file/symbol/queue. Each such row should carry a citation column (e.g., `apps/api/src/plugins/audit.ts:64–117`) or be rewritten as one of: (a) "This RFC introduces X (net-new — list as scope)", (b) "Verified absent in codebase; defer or include — list as Decision for the reviewer". The "Patterns Correctly Followed" table specifically must not ship any row without a verifying file:line. Concrete pre-submit checklist: grep the RFC body for the four trigger-phrase shapes ("existing", "reuses", "already", "the pattern from") and produce a citation-or-rewrite for every match before the technical-design phase reports complete. This is sister-pattern to the validated "Traceability matrix catches gaps that pure design review misses" — same shape (structured forcing-function), different surface (RFC body claims rather than spec → source ACs). At session start, when entering an implementation phase against an RFC the agent itself authored in a prior session, run the same verifying-grep pass on the RFC's "existing/reuses/applied" language before drafting the work list — and surface any gaps before asking the user for decisions.
