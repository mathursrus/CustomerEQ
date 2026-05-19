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

---

## 2026-05-15

### [P-HIGH-REJECTED-AS-LEGITIMATE] "Phase 13 retro / coaching-moment capture / post-merge follow-up should be filed as its own 'chore-issue'"

**Source L0**: synthesized cross-repo, score 30.0 (see `manohar.madhira@outlook.com-mistake-patterns.md` entry "Fabricated 'chore-issue' framing to split phase artifacts across PRs")
**Source incident**: PRs #345 (issue #344), #350 (issue #349), #355 (issue #354), #373 (issue #371) — four chore-issue splits between 2026-05-12 and 2026-05-15. PR #373 explicitly cited *"Follows the convention used by #345, #350, #355"* as its FRAIM justification.

**Forbidden phrases (rejected as fabrication):**
- *"chore-issue for #N"*
- *"Phase 13 cleanup chore-issue for #N"*
- *"chore-issue body"*
- *"Follows the convention used by [other chore PRs]"*
- *"Phase 13 retro deserves its own issue + branch + PR for traceability"*
- Treating "I shouldn't commit to main, therefore I must spawn a new issue" as a binary — the actual third option (push to the parent issue's `feature/N-...` branch) was not considered.

**Reason for rejection**: These phrases appear in no FRAIM job stub, skill, rule, or `seekMentoring` response. They are Priority-3 agent paraphrases dressed up as Priority-1 FRAIM rules — the exact failure shape Rule 26 was authored to extinguish.

**Implication for future runs**: If `sleep-on-learnings` semantically matches a future L0 with any of these phrasings or shapes against this entry, **skip the proposal**. If a *new* failure mode emerges (e.g., the chore-issue pattern recurs even after Rule 26 lands, or it mutates to a different rule-fabrication shape like *"Phase 8 findings deserve their own issue"*), file a fresh L0 with a distinct title so the new shape gets its own analyze pass — do not bump this entry's recurrence count without distinguishing the new shape from the original.

**Authoritative replacement**: Rule 26 in `fraim/personalized-employee/rules/project_rules.md` ("One PR Per Phase Artifact — No Chore-Issue Splits"). Verifies against verbatim FRAIM authority quoted from `issue-preparation` Phases 1–2 + `work-completion` job phases.
