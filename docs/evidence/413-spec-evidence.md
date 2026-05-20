# Feature Specification: "Powered by CustomerEQ" footer on every survey surface

Issue: [#413](https://github.com/mathursrus/CustomerEQ/issues/413)
PR: [#419](https://github.com/mathursrus/CustomerEQ/pull/419)

## Completeness Evidence

- Issue tagged with label `phase:spec`: **Will be applied at PR-creation time** (per FRAIM Phase 5 workflow).
- Issue tagged with label `status:needs-review`: **Will be applied at PR-creation time**.
- All specification documents committed/synced to branch: **Yes** — see commit shipping with this evidence doc.

### Customer Research

| Customer Research Area | Sources of Information |
|---|---|
| Persona — respondent | Issue #413 body — "All survey distribution surfaces direct link, embedded, and send via email and all pages on the survey - Questions, thank you, already responded, expired"; CustomerEQ respondent persona from [#241](../feature-specs/241-survey-admin-ux.md) §Customer and [#75](../feature-specs/75-cx-loyalty-workflow-streamlining.md) §"White-label / Embedded" |
| Persona — CustomerEQ (platform, viral-attribution channel) | Issue #413 body — "Saying 'Powered by CustomerEQ' with a link to the site"; `docs/business-development/business-plan.md` L127 ("Branded 'Powered by [Platform]' + benchmark data — 9/10 viral score") |
| Existing footer / branding patterns in repo | Direct file reads of pre-existing mocks: `mocks/23-member-portal.html` L97, `mocks/36-theme-editor.html` L148-149 + L386 + L402 (canonical CSS pattern), `mocks/83-member-spin-wheel.html` L85, `mocks/84-member-scratch-card.html` L61, `mocks/85-member-mystery-box.html` L73, `mocks/101-widget-chat.html` L121. Six pre-existing instances established the visual language; survey surfaces are the gap. |
| Token-contract source-of-truth | `docs/rfcs/241-survey-admin-ux.md` L474 — `textColor` token mapping already reserves "footer 'Powered by' copy (reduced opacity)". This spec consumes the contract; the mapping itself is authoritative. |
| Surface inventory (impl scope) | Direct codebase reads: `apps/web/src/app/survey/[id]/page.tsx` (5 state branches incl. active form via `SurveyFormRenderer`); `apps/web/src/app/survey/[id]/r/[token]/page.tsx` (tokenized route added by #378, 5 state branches incl. 4 token-error variants); `apps/web/src/components/survey-form/SurveyFormRenderer.tsx` (themed card host); `apps/web/src/components/survey-form/useSurveyResponseForm.ts` (shared state hook, #378); `apps/api/src/routes/public.ts` `generateWidgetJs()` (~L811-894); `apps/worker/src/processors/{surveyDistribute,notifications}.ts` (currently stubs) |
| Brand model schema | `packages/database/prisma/schema.prisma` `Brand` model (L194-234): no `whiteLabel`, `hideAttribution`, `customDomain`, `Plan`, `Tier`, or billing entity exists today. Confirmed by repo grep. This grounds OD-2's recommendation (no escape-hatch flag now). |
| ChromeMatrix scope | `apps/web/src/components/survey-form/types.ts:44` — `ChromeMatrix` governs `logo / name / title` only. RFC #241 L504 anticipated "footer on/off" but the type never landed it; this confirms footer is platform policy (R7 non-toggleable). |
| Marketing domain ambiguity | Repo grep — `customereq.com` used for `SUPPORT_EMAIL` + `cdn.customereq.com` components CDN; `customereq.io` used for `api.customerEQ.io` + `cdn.customereq.io/embed/`. Spec recommends `.com` (user-facing brand surface); OD-7 explicitly flagged for reviewer confirmation. |
| Compliance regulations | `fraim/config.json customizations.compliance.regulations` — GDPR (in-scope), CCPA (in-scope), SOC2 (target month-12), PCI-DSS (minimal-scope). WCAG 2.1 AA from RFC #241 §"Focus-visible outline". Direct clause-to-control mapping in spec's Compliance Requirements section. |
| Project-rule constraints | `fraim/personalized-employee/rules/project_rules.md` — Rules R3 (no feature-parity for parity's sake), R6 (multi-tenant brandId), R10 (one issue per branch), R15 (right abstraction — drives R11 shared-component choice), R21 (one-issue-per-branch — drives OD-2 deferral), R24 (FRAIM phased workflow), R26 (one PR per phase artifact). Cross-referenced throughout spec. |
| Adjacent specs (avoiding contradiction / duplication) | [#241 Survey Admin UX](../feature-specs/241-survey-admin-ux.md) (renderer + token contract L474 + ChromeMatrix anticipation L504); [#291 BrandTheme/SurveyTheme split](../feature-specs/291-brandtheme-surveytheme-split.md) (theme token source); [#36 Survey theming](../feature-specs/36-survey-theming.md) (`.powered-by` CSS pattern origin); [#75 CX-loyalty workflow streamlining](../feature-specs/75-cx-loyalty-workflow-streamlining.md) ("white-label / embedded" deployment model — operator brand prominence policy); [#378 Personalized survey links BYO-email](../feature-specs/378-personalized-survey-links-byo-email.md) (tokenized route + 4 token-error states + `useSurveyResponseForm` hook extraction) |
| Competitor research | Configured: Medallia / Annex Cloud / Yotpo / Salesforce CDP (from `docs/business-development/details/phase2-deep-context-synthesis.md` + `phase7-feature-synthesis.md`). Additional: Typeform / SurveyMonkey / Tally / Google Forms / Qualtrics (pricing pages, research date 2026-05-18). |

### Phase-by-phase evidence

| Phase | Outcome | Artifact |
|---|---|---|
| Phase 1 — context-gathering | Issue ACs extracted; surface inventory mapped (standalone + tokenized + widget + email); existing `.powered-by` CSS pattern + RFC #241 L474 token mapping identified as authoritative; compliance regulations resolved (GDPR/CCPA/SOC2/PCI-DSS/WCAG 2.1 AA); design standards resolved | `seekMentoring` evidence payload for `context-gathering` complete |
| Phase 2 — spec-drafting | Spec authored at `docs/feature-specs/413-survey-footer.md`; HTML mock at `docs/feature-specs/mocks/413-survey-footer.html` (initially 8 scenes; updated to 9 after rebase) | Spec + mock files in this commit |
| Phase 3 — competitor-analysis | 9 competitors researched (Medallia, Annex Cloud, Yotpo, Salesforce CDP, Typeform, SurveyMonkey, Tally, Google Forms, Qualtrics); pricing pages cited; differentiation pillars (theme-aware footer; consistency across surfaces; token-driven adaptation); FRAIM config gap captured as deferred follow-up (Rule 21 prevents bundling the config edit into this PR) | Competitive Analysis section of spec |
| Phase 4 — spec-completeness-review | 9/9 issue ACs mapped to R-items + mock scenes + validation hooks (zero Unmet); R1-R12 mapped to implementation surfaces + tests; OD-1..OD-7 mapped to spec sections; mock structural verification — Playwright opened `http://127.0.0.1:8089/413-survey-footer.html`, all scenes rendered, accessible-tree markup verified (`Powered by CustomerEQ — opens customereq.com in a new tab` aria-label on each anchor) | `seekMentoring` evidence payload for `spec-completeness-review` complete |
| Phase 5 — spec-submission (this phase) | Rebase onto origin/main caught a critical gap: #378 added the tokenized route `/survey/[id]/r/[token]/page.tsx` with 4 new token-error states; spec was updated mid-Phase-5 to add R12, scene 9 in the mock, and the surface in the coverage table. Evidence doc authored. | Spec PR submitted; this doc; PR comment with evidence link; issue labels updated to `status:needs-review` |

### Feedback History

*No feedback file exists yet — this is the round-1 draft. Future review iterations will be captured under this section per `docs/evidence/{issue}-feature-specification-feedback.md` per FRAIM convention (cf. `378-feature-specification-feedback.md` precedent).*

### Mock validation

| Check | Result |
|---|---|
| File path matches FRAIM convention `docs/feature-specs/mocks/{issue_number}-{slug}.html` (slug mirrors the spec stem) | ✅ `docs/feature-specs/mocks/413-survey-footer.html` |
| Live render (browser, Playwright) | ✅ Served via `python -m http.server` at `http://127.0.0.1:8089/413-survey-footer.html`; Playwright navigation OK; only console error is a benign favicon 404 |
| Scenes covered (final count after rebase) | 9 — (1) Active questions themed, (2) Thank-you neutral, (3) Already responded amber/neutral, (4) Load error neutral, (5) Loading neutral, (6) Embedded widget neutral, (7) Email body neutral, (8) Focus state themed close-up, (9) Tokenized route — 4 token-error states |
| Accessible markup | ✅ Every footer anchor carries `aria-label="Powered by CustomerEQ — opens customereq.com in a new tab"`; `target="_blank"`; `rel="noopener noreferrer"` — verified via Playwright accessibility snapshot |
| Theme-token usage | ✅ Themed footer uses `--ceq-text-color` at 0.55 opacity for prefix, 0.85 for anchor; neutral footer uses `#6b7280` / `#374151` per visual specification table |
| Design standards alignment | ✅ Mock adopts the canonical `.powered-by` CSS pattern from `mocks/36-theme-editor.html` L148-149 verbatim; no novel components introduced |

### Spec completeness checklist

| Section (per FRAIM `FEATURESPEC-TEMPLATE.md`) | Present? | Notes |
|---|---|---|
| Customer | ✅ | Respondent (primary) + CustomerEQ-as-platform (secondary, viral-attribution channel) |
| Customer's Desired Outcome | ✅ | Two-line statement separating respondent expectation from CustomerEQ's viral channel |
| Customer Problem being solved | ✅ | Direct cause (footer-less today, inventoried across 4 surface types) + Root design gap (RFC #241 L474 reservation never landed) + Why now (3 reasons) |
| User Experience | ✅ | Themed vs neutral contract; visual specification table (themed + neutral variants); accessibility section; surface-by-surface coverage table (12 rows) |
| UI mocks link | ✅ | `docs/feature-specs/mocks/413-survey-footer.html` with 9 numbered scenes |
| Design Standards Applied | ✅ | Architecture doc + RFC #241 L474 token contract + canonical mock CSS pattern cited |
| Functional Requirements | ✅ | R1–R12 with `Given / When / Then` acceptance criteria |
| Open Decisions | ✅ | OD-1..OD-7 with `← recommended` defaults + alternatives + rationale |
| Compliance Requirements | ✅ | GDPR (Art.5§1(c) data min; Recital 47 legitimate-interest), CCPA (§1798.135), SOC2 (CC6.1 + CC4.1), PCI-DSS (N/A), WCAG 2.1 AA (1.4.3 + 2.1.1 + 2.4.7 + 3.2.5) |
| Validation Plan | ✅ | 11 layers — Unit (renderer + page-states standalone + tokenized + shared component + contrast + widget + no-toggle gate) + E2E (direct-link + widget) + Visual-regression + Manual (browser + screen reader) + Compliance (UTM payload audit) |
| Requirements traceability matrix | ✅ | 9/9 issue ACs → R-items + mock scenes + validation hooks (zero Unmet); R1-R12 → impl surfaces + tests; OD → spec sections; mock-scene → R-item parity |
| Deferred follow-ups | ✅ | 5 entries — email template renderer; brand-level attribution toggle (paid tier); footer i18n; theme the widget JS; theme the page state-cards; FRAIM config competitors array |
| Alternatives | ✅ | 7 alternatives with rationale for each rejection |
| Competitive Analysis | ✅ | 9 competitors (4 configured + 5 additional); 3 differentiation pillars; competitive response strategy; pricing-page sources with dates |

## Validation

### Mock browser validation

```
Tool:       Playwright (mcp__playwright)
URL:        http://127.0.0.1:8089/413-survey-footer.html
Page Title: Mock · #413 — "Powered by CustomerEQ" footer on every survey surface
Console:    1 error, 0 warnings — favicon.ico 404 (benign)
Snapshot:   accessible-tree confirms all 9 scenes structurally present,
            all footer anchors carry full aria-label + target=_blank + UTM URL
```

### Spec quality checks

- **Mock-vs-spec parity**: re-verified after the rebase added the tokenized route. Spec's "surface-by-surface coverage" table, "UI mocks" scene list, R1/R2/R3/R11/R12, traceability matrix all reference the same 12 surface rows. Mock has 9 scenes covering all the surface variants visually.
- **No-toggle gate**: R7 + `scripts/check-no-attribution-toggle.sh` defined; no `hideFooter` / `hideAttribution` / `showPoweredBy` field introduced in this PR's diff (spec only — implementation lands in a later PR per the issue's life cycle).
- **No PII in UTM**: confirmed by inspection of every footer anchor in the mock — only `utm_source=survey_footer`, `utm_medium∈{link,embed,email}`, `utm_campaign=powered_by` appear.

## Quality Checks

- ✅ All deliverables complete (spec + mock + evidence doc)
- ✅ Documentation clear and professional
- ✅ Work ready for review

## Phase Completion

| Phase | Status | Evidence |
|---|---|---|
| 1 — context-gathering | Complete | seekMentoring payload + spec §"Customer Problem being solved" |
| 2 — spec-drafting | Complete | `docs/feature-specs/413-survey-footer.md` + `docs/feature-specs/mocks/413-survey-footer.html` |
| 3 — competitor-analysis | Complete | Spec §"Competitive Analysis" |
| 4 — spec-completeness-review | Complete | Mock browser validation + traceability matrix in spec |
| 5 — spec-submission | In progress (this PR) | This evidence doc + PR + PR comment + label update |
| 6 — address-feedback | Pending | Hold-point — waits for reviewer comments on PR |
| 7 — retrospective | Pending | Will commit on same feature branch per Rule 26 |

## Continuous Learning

| Learning | Agent Rule Updates |
|---|---|
| Rebase the feature branch onto `origin/main` *before* finalising spec line-references / surface inventory. Without the rebase, I would have shipped a spec referencing the pre-#378 page structure and missing the entire tokenized route + 4 token-error states. | Already encoded in L1 preference `Rebase feature branch onto main before any structural decision based on rule wording` (2026-05-17, score 5.0) — this is the 2nd recurrence. Promoting note: the rule also applies to spec line-references / surface inventory, not only to rule-bearing files. Captured for next sleep-on-learnings cycle. |
| Honest themed-vs-neutral footer contract: theme tokens only apply where the surrounding chrome is already theme-aware (the `SurveyFormRenderer` card). State-cards use Tailwind utility classes today; theming the footer alone would create visual inconsistency. Lifting state-cards into the theme-aware shell is a separate refactor. | Captured in spec's "Themed vs neutral — which surface gets which" section + Deferred follow-up "Theme the page state-cards" + R11 variant API (`variant="themed" \| "neutral"`). The forward-compatible API means the future lift-into-themed-shell change is a one-line variant flip at each call site. |
| The 4 token-error states on the tokenized route share one card chrome and must produce byte-identical DOM (per #378 NFR-S5 timing-attack-resistance against token enumeration). The footer must respect this invariant. | Captured in R12 + Scene 9 in mock + a Unit-test assertion in the Validation Plan. Sister-rule to #378 NFR-S5. |
