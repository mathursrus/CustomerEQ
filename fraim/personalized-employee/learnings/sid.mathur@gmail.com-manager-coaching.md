# Manager Coaching — sid.mathur@gmail.com

Patterns observed in how the user directs, intervenes, and structures work — useful for calibrating job selection, phase entry, and escalation timing.

---

## ⏳ Pending Review — 2026-03-24

### Proposed new entry

#### [P-MED] Confirm fraim/config.json is populated before starting spec jobs

**Score**: 5.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

When `fraim/config.json` is missing or does not include `compliance` and `competitors` fields, spec jobs generate per-phase warnings that require manual inference from architecture docs and project rules. This is a one-time project onboarding gap. Before starting any `feature-specification` job on a project, confirm these fields are present. If missing, prompt to run `project-onboarding` first.

---

#### [P-LOW] Intermediate commits during long jobs to aid context recovery

**Score**: 3.0
**Last seen**: 2026-03-24
**Recurrences**: 1
**First synthesized**: (pending)

Long single-session jobs (e.g., 9-section RFC in one pass) risk hitting context limits mid-execution. When context is compacted, recovery requires reading git log, re-reading the artifact, reconnecting FRAIM, and calling seekMentoring — approximately 3 tool calls. Making intermediate commits at natural phase boundaries (e.g., after each RFC section group) preserves state signals in git history and reduces recovery overhead.

---
