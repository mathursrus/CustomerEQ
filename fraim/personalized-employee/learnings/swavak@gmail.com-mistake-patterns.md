# Mistake Patterns — swavak@gmail.com

Patterns of agent errors, incorrect approaches, and recurring failure modes observed during sessions.

---

## ⏳ Pending Review — 2026-04-07

### Proposed new entry

#### [P-HIGH] Committing to old branch on session resume

**Score**: 8.0
**Last seen**: 2026-04-07
**Recurrences**: 1
**First synthesized**: (pending)

On session resume, if untracked files from a previous task or a new issue are found, the agent may immediately stage and commit them without verifying that the current branch corresponds to the task's scope. This results in work being committed to the wrong feature branch (e.g., committing #80 work to #79's branch). Before making any commit on a resumed session, always run `git branch` and verify the branch matches the current issue number.

---

#### [P-HIGH] Merging PR with failing CI

**Score**: 9.0
**Last seen**: 2026-04-07
**Recurrences**: 1
**First synthesized**: (pending)

Merging a Pull Request while CI checks (Build, Lint, Test) are failing allows broken code into the main branch, which can break deployment pipelines and prevent features from reaching production. A failing CI build is a hard gate. Even minor TypeScript errors or lint issues must be fixed and verified as green on CI before the internal merge command is executed.

---
