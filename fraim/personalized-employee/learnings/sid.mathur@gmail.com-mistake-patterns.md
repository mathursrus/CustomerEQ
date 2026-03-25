# Mistake Patterns — sid.mathur@gmail.com

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

---

## ⏳ Pending Review — 2026-03-24

### Proposed new entry

#### [P-HIGH] HTTP scraper used before Playwright on enterprise SaaS

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

Running a `requests`-based HTTP scraper as the first attempt against an enterprise SaaS site (e.g., Cloudflare-protected) returns 0 pages with 403 and requires full fallback to Playwright. This pattern causes wasted effort and adds latency. Playwright should be the first tool used for any enterprise browser automation task — not a fallback.

---

#### [P-HIGH] MCP GitHub PR creation tool causes repeated failures

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 2
**First synthesized**: (pending)

`mcp__github__create_pull_request` has failed in 2 separate sessions: once with 422 (malformed `head` field, requires `owner:branch` format not shown in schema) and once with "Head sha can't be blank" (branch not yet pushed). Each failure caused 2–3 wasted retry tool calls before fallback to `gh pr create`. This tool is unreliable — do not use it.

---

#### [P-HIGH] Tests written against spec before reading actual implementation

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

Writing test files using the spec description as the source of truth, when implementation files already exist on disk, results in schema mismatches (missing required fields, wrong types) that require complete rewrites of the test files. Always glob for existing `*.ts` source files in target directories and read them before writing any tests.

---

#### [P-HIGH] `git push origin <branch>` fails silently in git worktrees

**Score**: 8.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

In a git worktree, `git push origin <branch-name>` fails with "src refspec does not match any" because the branch ref is stored in the parent `.git/worktrees/` directory rather than `refs/heads/`. The correct form is always `git push origin HEAD:<branch-name>`, which works in both normal checkouts and worktrees. Detect worktrees early by running `cat .git` — if the output starts with `gitdir:`, you are in a worktree.

---

#### [P-MED] Wide HTML table without overflow wrapper

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

HTML mock tables with more than 4–5 columns cause column clipping at standard Playwright viewport widths when no overflow wrapper is present. Any mock table with more than 4 columns must be wrapped in `<div style="overflow-x:auto">` with `min-width` set on the table element. Apply this by default when authoring, not as a fix after browser validation.

---

#### [P-MED] Observability omitted from initial RFC for event-driven systems

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

For event-driven or queue-based systems with SLA commitments, the initial RFC draft omitted the observability section (structured log schema, alert thresholds, DLQ strategy). This was caught during architecture gap-review and required an extra revision pass. Observability must be included as a required default section in any RFC that involves queues, async processing, or SLA commitments.

---

#### [P-MED] PR created before confirming branch is on GitHub

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

PR creation attempts (both MCP tool and `gh` CLI) fail with confusing errors ("Head sha can't be blank", branch not found) when the branch has not yet been pushed to GitHub. Before any PR creation call, verify the branch is visible via `gh api repos/<owner>/<repo>/branches/<branch>` and confirm it returns 200. Only proceed with PR creation after this check passes.

---
