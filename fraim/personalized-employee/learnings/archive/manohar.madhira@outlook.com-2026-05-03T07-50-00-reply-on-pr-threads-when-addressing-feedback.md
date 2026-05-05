---
author: manohar.madhira@outlook.com
date: 2026-05-03
context: issue-231 / pr-259 / feature-specification address-feedback phase
---

# Coaching Moment: reply-on-pr-threads-when-addressing-feedback

## What happened

After receiving 18 inline review comments on PR #259, the agent did the substantive work: wrote a feedback file at `docs/evidence/231-feature-specification-feedback.md`, marked each comment ADDRESSED there, made the spec edits in commit `867fdaf`, and posted cross-issue comments on #225, #239, #241, #3. But the agent did NOT post replies on the original 18 review-comment threads on the PR itself. The user asked: "Why didn't you add replies to my comments? Doesn't FRAIM specify you to do so?" The honest answer: FRAIM's `address-feedback` phase specifies marking items ADDRESSED in the feedback FILE (which the agent did) but does NOT explicitly require posting replies on GitHub review-comment threads. The gap is on the agent. From the reviewer's seat, an unanswered thread looks abandoned; the reviewer has to dig into the commit log or the feedback file to find out whether each item was addressed and how. Posting per-thread replies is the standard reviewer-courtesy practice that closes that loop in-place.

## What was learned

When addressing PR review comments, post a per-thread reply at the time of the resolution (not just in the feedback file or commit message). The reviewer's experience is the canonical UX of address-feedback work — they read the threads, not the agent's audit trail. Even when the underlying framework (FRAIM) only requires file-level tracking, follow the surrounding professional norm of the platform (GitHub PR review).

## What the agent should have done

After committing the spec edits in `867fdaf`, immediately posted 18 inline replies via `gh api -X POST repos/.../pulls/259/comments/<id>/replies -f body=...` (or the MCP `add_reply_to_pull_request_comment` tool), one per original review comment. Each reply should cite the resolving commit SHA and a one-line summary of the resolution (e.g., "Addressed in 867fdaf — R14 reversed; existing surveys migrate to MULTIPLE."). For "Agreed" comments, a brief "Acknowledged — Q3 position confirmed" reply still helps mark the thread closed. The feedback file remains the durable evidence record; the PR-thread replies are the live communication channel.
