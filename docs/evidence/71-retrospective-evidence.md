# Evidence: Issue #71 Retrospective

## Summary
- **Issue**: #71 — Text not visible while typing in text boxes across the site
- **Workflow**: Retrospective
- **Description**: Captured learnings from a course correction during implementation — initial per-file fix was replaced with a global CSS fix after user feedback.

## Work Completed

### Retrospective Document
- Created `docs/retrospectives/manohar.madhira@outlook.com-issue-71-text-not-visible-in-text-boxes-postmortem.md`
- Includes 5 Whys root cause analysis, timeline, what went wrong/right, and lessons learned

### Prevention Measures
- Added **Project Rule #15** ("Fix at the Right Abstraction Level") to `fraim/personalized-employee/rules/project_rules.md`
- Saved feedback memory for future agent sessions

### Key Files Changed
| File | Change |
|------|--------|
| `docs/retrospectives/manohar.madhira@outlook.com-issue-71-...postmortem.md` | Created — full retrospective |
| `fraim/personalized-employee/rules/project_rules.md` | Added Rule #15 |

## Key Learnings
1. When a fix touches 3+ files with the same change, check for a global/shared solution first
2. Don't copy existing workarounds — question whether they're the right pattern
3. CSS inheritance issues belong in the stylesheet, not in component classNames

## Quality Checks
- [x] Retrospective follows template structure
- [x] 5 Whys analysis completed
- [x] Prevention measures are actionable (not "be more careful")
- [x] Project rules updated with concrete enforcement threshold (3-file rule)
- [x] Feedback memory saved for cross-session persistence
