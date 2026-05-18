---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378
---

# Coaching Moment: draft-rfc-from-agent-summary-not-source

## What happened

On the technical-design RFC for #378 (PR #407), I ran a Phase 1 code-citation audit via an Explore subagent that produced a summary of 20 file:line claims from the spec. The summary was accurate at the level it reported but lossy on identifiers, surrounding code, and short-circuit branches. When I drafted the RFC in Phase 2 I leaned on that summary rather than re-opening each file, and when I "verified" again at Phase 5 submit-time I re-attested the Phase 1 findings rather than running a fresh grep+read pass. The user then asked me to "cross check each claim made in the RFC with actual code and documents." A real re-audit surfaced 5 inaccuracies — two of them structural: (F-2) the RFC framed tenant-scoping as "add new models to `TENANT_SCOPED_MODELS`" even though *no* survey-side model is in that set today (`Survey`, `SurveyDistribution`, `SurveyResponse`, `SurveyRule`, `BrandTheme`, etc. all use explicit handler-level `where: { brandId: request.brandId }`), and (F-3) the RFC declared a `distribution_batch.token_responded` audit row on the public respond route without noticing that the audit plugin short-circuits at `audit.ts:103-106` when `request.brandId` is unset, which is exactly the public-route case. The other three (F-1 schema name `RespondBodyV1` instead of the actual `PublicSurveyResponseSchema`; F-4 `actorUserId` vs the real `actorId` column; F-5 a fabricated "index entry at line 133") were all paraphrase/synthesis errors I could have avoided by copy-pasting identifiers verbatim from the source. The Phase 1 agent had even flagged F-2's signal explicitly ("No Survey or SurveyResponse scoped — confirmed not in set") and I treated that fact as background instead of as a load-bearing prompt to ask "then how *is* it scoped today, and should #378 follow that mechanism?" The user's terse follow-up was "why did you mess up?"

## What was learned

An Explore-agent summary is a fast index, never a substitute for primary-source reads at the drafting moment for load-bearing claims; and Phase 5's "submit-time claim sweep" must be a fresh grep+read pass, not a re-attestation of Phase 1 findings — the same fidelity loss that produces the summary also taints any synthesis that consumes it.

## What the agent should have done

Three concrete behaviors I should have run, in order:

1. **Identifier capture at Phase 1**: when the Explore agent reports "verified line X-Y is the schema/route/plugin", I should follow up with a single targeted `Read` of those lines and copy the exact identifier (schema variable name, table name, column name, exported symbol) into the evidence doc, not just the line range. The line range plus the surrounding "schema" word is not enough — when I draft the Zod sketch in Phase 2 I'll synthesize a plausible-but-fabricated name like `RespondBodyV1` from drafting muscle memory unless the actual name is sitting in my Phase 1 notes verbatim.

2. **Frame-check at the drafting moment for tenant-scoping / audit / queue-mode shapes**: any time a Phase 1 verification reports "X is *not* in set Y" or "X *does* short-circuit when Z", that is not a fact-only signal — it's a frame-prompting signal. I should pause at Phase 2 and explicitly ask "what alternative mechanism handles the case where X is absent, and does my design need to follow it?" For F-2 the question was "if Survey isn't in TENANT_SCOPED_MODELS, then how does Survey get tenant-scoped?" — answer: explicit handler-level `where: { brandId }` (5 grep hits in `surveys.ts`). For F-3 the question was "the audit plugin short-circuits when `request.brandId` is unset — does my public-respond route have `brandId` set when the hook fires?" — answer: no, unless the handler assigns it.

3. **Phase 5 must be a fresh sweep, not a re-attestation**: the L1 P-HIGH 9.0 *"Submit-time auto-audit of spec/RFC claims against repo"* explicitly says to grep the document body for every named file path / symbol / function / column and Read each — I bypassed this by re-pointing at the Phase 1 evidence doc and calling that "verified". When the user asked for a real cross-check, the *fresh* sweep found the 5 issues in about 15 minutes. That fresh sweep is the rule, not the exception — it has to happen at submit time for every RFC, not only when the user asks.

The umbrella rule: **the explore agent is a discovery tool, not a verification tool**. Discovery surfaces what to read; verification is reading it yourself, especially for identifiers and short-circuits that summaries elide. The cost of one extra Read per load-bearing claim is small; the cost of an RFC fix-cycle (and the trust erosion from the user having to ask for the audit they should have gotten for free) is large.
