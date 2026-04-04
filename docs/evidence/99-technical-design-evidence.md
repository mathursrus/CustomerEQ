# Feature: Customer Health Score
Issue: #99
Feature Spec: GitHub Issue #99 (no separate feature-spec file)
PR: #103

## Completeness Evidence
 - Issue tagged with label `phase:design`: Yes
 - Issue tagged with label `status:needs-review`: No (removed during label update; was previously present)
 - All files committed/synced to branch: Pending (RFC authored, not yet committed)
 - Table with following columns 
   - PR Comment
   - How Addressed

| PR Comment | How Addressed |
|---|---|
| (No PR feedback yet) | N/A |

### Traceability Matrix

| Requirement/User Story | RFC Section/Data Model | Status | Validation Plan Alignment |
|---|---|---|---|
| `healthScore` field added to Member model (0-100 integer) | Section 1.1 -- Prisma migration adds `healthScore Int?` to Member | Met | Unit test: verify field exists and accepts 0-100 values |
| Scoring formula documented and weights configurable | Section 2 -- Health Score Formula table with 5 sub-scores, weights, normalization rules. `HealthScoreWeightsSchema` Zod schema validates weights sum to 1.0 | Met | Unit test: verify formula with known inputs produces expected outputs |
| Batch job computes health scores for all active members (scheduled or on-demand) | Section 3 -- BullMQ `health-score-computation` queue, Section 3.5 scheduling (cron + on-demand endpoint) | Met | Integration test: POST recompute, verify all active members updated |
| `GET /v1/members/:id/360` includes healthScore in response | Section 4.1 -- 360 endpoint response schema includes `healthScore`, `healthBreakdown`, and `stats` | Met | Integration test: call 360 endpoint, verify healthScore present |
| `GET /v1/members` supports filtering by health score range | Section 4.2 -- `healthScoreMin`/`healthScoreMax` query params with `HealthScoreFilterSchema` | Met | Integration test: filter by range, verify only matching members returned |
| MCP tools expose health score data | Section 5 -- `get_member` auto-includes healthScore; new `get_member_360` tool | Met | Integration test: call MCP tool, verify health data in response |
| Edge case: new members with no history get neutral score | Section 2 Edge Cases -- all sub-scores default to 50, yielding healthScore = 50 | Met | Unit test: compute score for member with no events/surveys |
| Edge case: erased members excluded | Section 2 Edge Cases -- erased members skipped, healthScore remains null | Met | Unit test: verify erased member is skipped in batch computation |
| `healthScoreUpdatedAt` timestamp tracks freshness | Section 1.1 -- `healthScoreUpdatedAt DateTime?` added to Member | Met | Unit test: verify timestamp updated after computation |
| Batch job handles large member counts performantly | Section 8 -- cursor-based batching (500/batch), per-query timeouts (5s) | Met | Integration test: batch job processes 1000 members in <30s |
| Inline mode (no Redis) works for dev/test | Section 3.3 -- inline mode follows existing `QUEUE_MODE=inline` pattern | Met | Unit test: verify health score computed in inline mode |

**Traceability Matrix Result: PASS** -- All acceptance criteria from Issue #99 are met in the RFC.

### Architecture Gaps (for user review via PR)

| Gap | Description | Suggested Resolution | Blocking? |
|---|---|---|---|
| Scheduled/cron jobs not documented | Architecture doc Section 4.3 lists 3 workers but no cron/repeat pattern | Add "Scheduled Jobs" subsection after BullMQ Workers table | No |
| Computed/derived fields pattern undocumented | `healthScore` is a new category vs. `pointsBalance` (transactional counter) | Add note to Member model description distinguishing batch-computed metrics | No |
| Customer 360 aggregation endpoint undocumented | `/v1/members/:id/360` is a new aggregation pattern not in route table | Update Section 4.1 route table to include 360 endpoint | No |
| MCP server layer undocumented | `apps/mcp-server/` not described in architecture layers | Add MCP Layer subsection to Section 3 | No |

None of these gaps block the design. They should be addressed during implementation by updating the architecture document.

## Due Diligence Evidence
 - Reviewed feature spec in detail (if feature spec present): Yes (issue body serves as spec)
 - Reviewed code base in detail to understand and repro the issue: Yes (schema.prisma, members.ts, bullmq.ts, MCP tools, queues.ts, architecture.md)
 - Included detailed design, validation plan, test strategy in doc: Yes

## Prototype & Validation Evidence
 - [ ] Built simple proof-of-concept that works end-to-end -- N/A (no spike needed)
 - [ ] Manually tested complete user flow (browser/curl) -- N/A (design phase only)
 - [ ] Verified solution actually works before designing architecture -- N/A (established patterns)
 - [x] Identified minimal viable implementation
 - [x] Documented what works vs. what's overengineered

## Continuous Learning
| Learning | Agent Rule Updates |
|---|---|
| (To be filled during retrospective) | |
