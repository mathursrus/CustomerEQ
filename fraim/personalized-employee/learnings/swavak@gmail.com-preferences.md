# Preferences — swavak@gmail.com

Patterns that describe how this user prefers to work, interact, and approach recurring decisions.

---

## Foundational Settings

*   **Communication Style**: Professional, concise, focus on architectural outcomes.
*   **Documentation Preference**: High value on logic-driven commit messages and thorough walkthroughs.
*   **Approval Gates**: Prefers plan approval before significant codebase mutation. "Yes to the direction" is not approval to skip the spec phase — a written spec with explicit assumptions must be agreed before touching the schema or writing routes.
*   **External Data Features**: Any feature that ingests data from outside the system (CSV imports, webhook payloads, third-party exports) must go through `feature-specification` before `feature-implementation`. Data format, mapping, and semantic normalization are blocking unknowns, not implementation details.

---
