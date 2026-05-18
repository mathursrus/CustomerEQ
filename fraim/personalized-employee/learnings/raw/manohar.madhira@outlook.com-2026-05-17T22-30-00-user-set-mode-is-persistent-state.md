---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378
---

# Coaching Moment: user-set-mode-is-persistent-state

## What happened

During Phase 12 walkthrough of #378, the user explicitly set a working mode: *"Going back to logging mode - don't analyze or fix except for taking any server logs or transient info."* I acknowledged: *"Acknowledged. Logging mode — I'll capture server logs and transient info on request, no analysis or fixes."* The user's next request was *"Move the copy button to top right of the Survey link box and Embed link box. The way the Copy is positioned now, it looks like it will copy the Replace `{{...}}` text"* — an imperative-shaped sentence. I read it as an instruction to edit and went straight to `Read` + `Edit` on `DistributionSection.tsx`, edited the file, and reported "Done. Copy is now in the top-right of each tile." The user caught it next turn: *"I thought you are Log mode, why did you start fixing?"*. I had explicitly acknowledged the mode 4 turns earlier and then immediately violated it. The cost: one user correction, one re-prompt for whether to revert. The user kept the edit ("Keep it") and moved on, but the principle is general — when a user sets an explicit working mode, that mode is **state** that survives across turns, not a guideline that gets overridden by the first imperative-shaped request. The misfire shape: I treat the literal grammar of the most recent message as the dominant signal and don't re-check the modal state I'm supposed to be in.

## What was learned

**User-set working modes ("logging mode," "plan mode," "observe-only," "do not modify," etc.) are persistent session state, not turn-local guidance.** Imperative-shaped requests received while in such a mode should be **logged as walkthrough findings for later action**, not executed inline, until the user explicitly releases the mode (e.g., "you can fix now," "exit logging mode," "go ahead"). The default is *log and surface* — and prompt the user with "want me to revert and just log this?" if I notice the slip after the fact.

## What the agent should have done

1. **At the start of each turn that follows a mode declaration**, restate the active mode to myself (in thinking) before processing the user's message. If the mode is "logging," any request that would touch files becomes a "log this as a walkthrough item" candidate, not a "do this" candidate. The default response shape changes from *"Done, here's the diff"* to *"Logged as walkthrough item N: <verbatim user request>. Will action when you release logging mode."*

2. **If the user's request is genuinely urgent / blocking and shouldn't wait for mode release**, ask: *"You're in logging mode — should I make an exception and edit now, or log this for later?"* That preserves user authority over their own modal state instead of having me unilaterally decide the imperative-shaped request is important enough to override the mode.

3. **If I notice mid-turn that I'm about to violate a user-set mode**, stop, acknowledge the slip in the response, and ask whether to revert.

This is net-new — no prior L0 covers explicit modal state. Worth promoting to L1 once a second firing in any session confirms the pattern.
