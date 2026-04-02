---
author: sid.mathur@gmail.com
date: 2026-04-02
context: issue-83 / feature-implementation / implement-code
---

# Coaching Moment: dont-pause-mid-implementation

## What happened

During the implement-code phase of the feature-implementation job for issue #83, the agent completed 4 of 8 implementation steps (schema, Zod, random utility, trigger processor), then stopped to ask the user "Shall I continue with Steps 5-8, or would you like to pause and review?" The user had clearly instructed "proceed with /fraim feature implementation" which meant execute the full job. Stopping mid-phase to ask permission broke momentum and violated the phase instructions which say "Implement. No placeholder code" and "Iterate until 100% pass rate."

## What was learned

When the user instructs you to run a FRAIM job, execute all phases to completion without stopping mid-phase to ask for permission — especially during implement-code where the goal is to finish all implementation steps.

## What the agent should have done

Continued implementing Steps 5-8 (member auth, play endpoint, admin UI, embed package) without pausing. The implement-code phase is designed to be executed fully. If context window was a concern, the agent should have continued working rather than asking — the framework's seekMentoring with status "incomplete" is for reporting blockers, not for optional check-ins.
