# Validated Patterns — swavak@gmail.com

**Last synthesized**: 2026-05-08

Durable judgment calls and successful unusual-but-correct decisions worth reproducing.

---

#### [VP-HIGH] Read codebase before designing — prevents designing against wrong assumptions

**Score**: 11.9
**Last seen**: 2026-04-21
**Recurrences**: 2
**First synthesized**: 2026-05-08

Before drafting an RFC or technical design, reading relevant codebase files (auth plugin, existing routes, Prisma schema, worker code) surfaces all significant gaps before they become design assumptions. Fired in Issue #3 (caught auth plugin gap and missing slug fields before writing RFC) and Issue #156 (confirmed `slaBreachedAt` already existed, preventing a redundant migration). This pattern has prevented rework in both backend design and implementation phases across multiple issues.

---

#### [VP-HIGH] Branch verification before first commit fires correctly at session resume

**Score**: 11.9
**Last seen**: 2026-04-21
**Recurrences**: 2
**First synthesized**: 2026-05-08

When resuming a session where unrelated files are staged or a different issue's branch is checked out, verifying the current branch before staging any work prevents cross-contamination. Fired correctly in Issue #155 (session started on issue-156 branch; caught before staging any changes) and Issue #156 (only staged the two new RFC files, leaving pre-existing modified files from other issues unstaged). The mistake-patterns entry for this behavior is actively working as a self-check.

---

#### [VP-MED] Use unauthenticatedRequest() for public route integration tests

**Score**: 4.4
**Last seen**: 2026-04-02
**Recurrences**: 1
**First synthesized**: 2026-05-08

When writing integration tests for a route that is unauthenticated (e.g., `POST /v1/members/enroll`), the correct request helper is `unauthenticatedRequest()`, not the standard authenticated one. Recognized immediately in Issue #3 implementation when enrollment tests were first written — the fix was applied before any tests were committed with the wrong helper.

---

#### [VP-MED] Explicitly surface open questions in RFC rather than resolving with assumptions

**Score**: 4.3
**Last seen**: 2026-03-31
**Recurrences**: 1
**First synthesized**: 2026-05-08

When two significant design decisions (enrollment URL slug anchor, auth strategy for new members) could not be resolved with confidence from the codebase alone, documenting them as open questions in the RFC rather than guessing led to a single focused feedback round that resolved both cleanly (Issue #3 technical design). Speculative resolution would have required broader rework once the user's actual preference was known.

---
