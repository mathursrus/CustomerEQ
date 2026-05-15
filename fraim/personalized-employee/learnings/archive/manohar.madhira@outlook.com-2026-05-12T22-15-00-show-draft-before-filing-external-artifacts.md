---
author: manohar.madhira@outlook.com
date: 2026-05-12
context: issue-331 / feature-implementation phase-13 / conversational-session
---

## What happened

During the Slice 3 wrap-up, the user agreed to "file the issue as a follow-up after retrospective wraps." I provided a high-level proposal in conversation (problem statement, proposed paths-filter config, risk list), the user pointed out specific changes to that draft, and I said "I'll keep this draft ready and file the issue once retrospective completes." After Phase 13 closed, I ran `gh issue create` with a fully-fleshed body — substantially expanded beyond the in-conversation summary, ostensibly incorporating the user's feedback — and posted issue #343 without surfacing the revised body to the user first. The user replied: "I thought you will show me a revised draft." Because they had given feedback on the draft, they expected to see the revised version — to verify their corrections were applied correctly — before it went public.

## What was learned

When an action publishes content to a shared/external surface where the user can't easily iterate post-publish (GitHub issue body, comment on an issue or PR, Slack message, email), the user must see the *final* artifact body before the publishing call — even when they have authorized the multi-step flow that ends in publishing, and especially when they have given feedback on a draft along the way — because the body I write at submission time is usually different from the summary I described in chat. **Exception:** `gh pr create` and `gh pr review` do not require pre-show, because the user can review and comment on the PR (or the review) through the PR itself after submission.

## What the agent should have done

After Phase 13 closed, write the full issue body locally (or paste into chat as a fenced block), say "here's the body I'd file as #X — review and tell me what to change", and only call `gh issue create` after the user signals OK or after they hand back an edited version. The same rule applies to `gh issue comment`, `gh pr comment`, Slack/email tool calls, and any tool that produces persistent third-party-visible state the user can't easily iterate on post-publish. PR creation and PR reviews are exceptions — the user can review and comment on the PR or review through the PR itself, so pre-show is unnecessary there. "Authorization to file as follow-up" is authorization for the *plan*, not pre-authorization for the *exact words I happen to choose at file time*.
