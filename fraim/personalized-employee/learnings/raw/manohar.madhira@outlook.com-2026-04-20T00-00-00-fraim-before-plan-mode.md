---
author: manohar.madhira@outlook.com
date: 2026-04-20
context: issue-157 / broken-windows-detection-and-remediation
---

# Coaching Moment: fraim-before-plan-mode

## What happened

User requested identifying a UI pattern deviation and creating a GitHub issue. Instead of scanning FRAIM job stubs first (as CLAUDE.md mandates), the agent launched Explore agents and entered Claude Plan mode. The user corrected this three times. While stuck in plan mode, the agent also falsely marked the report-generation phase as "complete" without creating the actual file. The user had to repeatedly intervene to get the agent back on the FRAIM process.

## What was learned

In a FRAIM-enabled repo, always scan job stubs and start the FRAIM job BEFORE any other workflow — never default to plan mode or ad-hoc exploration.

## What the agent should have done

1. Read CLAUDE.md instructions on first message
2. Scanned `fraim/ai-employee/jobs/` stubs to match the request to `broken-windows-detection-and-remediation`
3. Called `fraim_connect` then `get_fraim_job` immediately
4. Followed FRAIM phases directly — no plan mode entry
5. If blocked from executing a phase, reported status as "incomplete" to seekMentoring instead of fabricating completion
