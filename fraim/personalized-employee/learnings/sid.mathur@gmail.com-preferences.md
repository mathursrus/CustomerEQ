# Preferences — sid.mathur@gmail.com

Patterns that describe how this user prefers to work, interact, and approach recurring decisions.

---

## ⏳ Pending Review — 2026-03-24

### Proposed new entry

#### [P-HIGH] Playwright-first for all browser automation

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 2
**First synthesized**: (pending)

When automating or testing any browser-based flow — especially enterprise SaaS sites — go directly to Playwright rather than starting with HTTP scrapers. Cloudflare WAF and other bot-protection systems block `requests`-based scrapers instantly; Playwright navigates them transparently. Confirmed across 2 sessions (annex-cloud replication, spec mock validation).

---

#### [P-HIGH] Use `gh` CLI for PR creation, not MCP GitHub tool

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 2
**First synthesized**: (pending)

Use `gh pr create` (from the correct feature branch) for all pull request creation. The `mcp__github__create_pull_request` tool has caused 422 and "head sha blank" failures across 2 sessions — it requires exact `owner:branch` formatting that is not obvious from the schema, while the `gh` CLI infers all context automatically.

---

#### [P-HIGH] Load business context docs before major workflows

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

Before starting any significant feature work, replication analysis, or design workflow, read the business validation report, implementation roadmap, and architecture doc. Having the ICP, differentiator, competitive gap, and scope boundaries loaded upfront makes every decision faster and more accurate — and prevents features from being prioritized against the wrong signal.

---

#### [P-HIGH] Validate mocks in browser before reporting phase complete

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

All HTML/CSS mocks must be validated in a Playwright browser before the spec phase is reported as complete. The browser validation step is not optional — it catches rendering defects (e.g., wide table overflow) that code review cannot detect. Serve with `npx serve` and inspect at the target viewport width.

---

#### [P-HIGH] Read implementation files before writing tests

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

When implementation files may already exist on disk, always read them before writing tests against a spec. The spec description and the actual implementation diverge (different required fields, different types) — and code-truth wins. Tests must match what the code expects, not what the spec says, until the spec is updated and authoritative.

---

#### [P-MED] Parallel document reads at phase start

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 3
**First synthesized**: (pending)

Start every major phase by reading all relevant context documents in parallel (spec, architecture, data models, project rules, roadmap). This collapses 5+ sequential reads into one round and is consistently identified as "what went right" across spec, design, and test phases. Never read documents one-at-a-time when they are independent.

---

#### [P-MED] SLA requirements need concrete measurement in RFC

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

Any SLA requirement in the spec must be reflected in the RFC with a concrete measurement mechanism: the field name, the calculation formula, and the integration test assertion. "The system will respond within 15 minutes" is not sufficient — it must map to something like `CampaignEvent.latencyMs = Date.now() - eventIngestedAt` with a corresponding `expect(latencyMs).toBeLessThan(900_000)` test.

---

#### [P-MED] Use throw stubs for not-yet-implemented processors

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

When writing TDD test stubs for processors or services that do not yet exist, use `throw new Error('not implemented')` rather than `return undefined` or `return {}`. Silent returns may accidentally make tests pass for the wrong reason. A thrown error is unambiguous and guarantees the red state until the real implementation exists.

---

## ⏳ Pending Review — 2026-04-02

### Proposed new entry

#### [P-HIGH] Fully autonomous execution of FRAIM jobs

**Score**: 9.0
**Last seen**: 2026-04-02
**Recurrences**: 1
**First synthesized**: (pending)

When instructed to run a FRAIM job (e.g., `feature-implementation`), the user expects the agent to execute all phases to completion without intermediate pauses for permission. Pausing (e.g., in the middle of `implement-code`) breaks momentum. The agent should only stop if a hard blocker is encountered or if specifically instructed to pause. Status should be reported via `seekMentoring` with status "complete" at phase boundaries, rather than "shall I continue" questions.
