# Rejected Proposals — manohar.madhira@outlook.com

Proposals from `sleep-on-learnings` that the user rejected. The `analyze` phase reads this file and skips re-proposing patterns whose titles semantically match these entries, so a single rejection sticks across future runs.

---

## 2026-05-03

### [P-LOW] Asked the user to confirm baseline dev-env contents that the repo's documentation already states

**Source L0**: `fraim/personalized-employee/learnings/raw/manohar.madhira@outlook.com-2026-04-20T01-30-00-dont-ask-about-baseline-dev-env.md`
**Source incident**: issue #157, 2026-04-20 — agent asked the user whether the local DB and dev server were reachable for integration/E2E tests; user pushed back. Repo's project_rules / CLAUDE.md / `.env.example` all establish the baseline.
**Reason for rejection**: Already covered by user-side feedback memory `feedback_dont_ask_about_baseline_dev_env.md`; redundant with that channel. The user-side memory has been firing in-session and doing the work — adding a parallel L1 entry is symmetric overhead without behavioral upside.
**Implication for future runs**: Do not re-propose this pattern from this or any future L0 with the same shape. If the same behavior recurs and represents a *new* failure mode (e.g., the user-side memory stops firing, or the pattern broadens beyond dev-env to other documented baselines), file a fresh L0 with a distinct title and let analyze re-evaluate against this rejection.

The source L0 file remains in `raw/` (not archived) — leaving it allows the user to reconsider on a future `review-pending` if they change their mind.

**Update 2026-05-05 (PR #285)**: The underlying behavior was reframed and promoted as a positive *preference* entry — `Treat documented baseline (CLAUDE.md / project_rules / .env.example) as given — don't ask the user to re-confirm` in `manohar.madhira@outlook.com-preferences.md` (P-MED, rec=3). The original L0 was archived to `archive/` as part of that promotion. **This rejection still stands for the mistake-pattern phrasing** — the agent-side mistake-pattern view of this behavior remains redundant with the feedback memory + the new positive preference. The two captures are complementary: the preference describes what the agent should do; the rejection blocks re-litigating it as a mistake-pattern. If `sleep-on-learnings` semantic-matches a future L0 against this entry, skip; if it semantic-matches against the preference entry instead, treat as a recurrence-bump on the preference.
