# Evidence: Feature Specification — Scratch-Off Card + SDK (#84 + #82)

## Summary
- **Issues**: #84 (Scratch-Off Card) + #82 (Embeddable SDK formalization)
- **Workflow**: feature-specification
- **Description**: Combined spec for scratch_card campaign type with canvas scratch-to-reveal interaction, plus SDK formalization for multi-component build pipeline.

## Work Completed
- `docs/feature-specs/84-scratch-off-card-campaign.md` — 15 requirements (R1-R15)
- `docs/feature-specs/mocks/84-admin-scratch-card-builder.html` — admin UI with scratchable preview
- `docs/feature-specs/mocks/84-member-scratch-card.html` — member scratch-to-reveal with gold foil, progress bar, sparkles

## Validation
- Both mocks validated in Playwright browser
- All 9 issue ACs mapped to spec requirements
- Compliance and design standards sections present

## Phase Completion
1. context-gathering — loaded issues #82 + #84, existing infra from #83, architecture doc
2. spec-drafting — 15 requirements, 2 HTML mocks, 10 edge cases, 2 open questions
3. competitor-analysis — 5 competitors analyzed (leveraged #83 research)
4. spec-completeness-review — mocks validated, requirement coverage confirmed
5. spec-submission — this evidence, PR #92
