# Feature: "Powered by CustomerEQ" footer on every survey surface

Issue: [#413](https://github.com/mathursrus/CustomerEQ/issues/413)
Owner: manohar.madhira@outlook.com
Status: drafting (phase: spec-drafting)

> **Cross-refs:**
> - [#241](https://github.com/mathursrus/CustomerEQ/issues/241) — Survey Admin UX epic. RFC #241 §"BrandTheme to Survey element token mapping" line 474 already reserved `--ceq-text-color` (reduced opacity) for "footer 'Powered by' copy"; this issue lands the renderer side.
> - [#291](https://github.com/mathursrus/CustomerEQ/issues/291) — BrandTheme / SurveyTheme split. The theme token contract this footer consumes ships there.
> - [#36](https://github.com/mathursrus/CustomerEQ/issues/36) — Survey theming. The canonical `.powered-by` CSS pattern this spec adopts originated in the `36-theme-editor.html` mock.
> - [#75](https://github.com/mathursrus/CustomerEQ/issues/75) — CX-loyalty workflow streamlining ("white-label / embedded is the only deployment model"). This spec keeps the operator brand prominent and the platform attribution muted, consistent with that scope.
> - [#264](https://github.com/mathursrus/CustomerEQ/issues/264) — Erasure job. The footer carries no PII, so erasure has no new contract here.
> - [#378](https://github.com/mathursrus/CustomerEQ/issues/378) — Tokenized respondent route. PR #385 added `apps/web/src/app/survey/[id]/r/[token]/page.tsx` with 4 new token-error states (`expired` / `responded` / `survey-not-open` / `invalid`); all of them are respondent-reachable surfaces that #413 must cover. PR #385 also extracted host-page glue into `useSurveyResponseForm` — the impl for #413 layers on top of that hook, not the pre-#378 page-local state.

---

## Customer

The respondent (the brand's end-customer or member) who clicks a survey link, opens an embedded survey in the brand's site, or receives a survey-bearing email. Today, the respondent has no consistent signal that the underlying platform is CustomerEQ — the surfaces are operator-branded only.

Secondary customer: a prospect who, after seeing the footer, follows the link and lands on the CustomerEQ marketing site — the viral-attribution channel that drives platform awareness without any paid acquisition spend.

## Customer's Desired Outcome

> "Every survey I send under my brand carries a small, consistent 'Powered by CustomerEQ' attribution that links back to the CustomerEQ site — across direct-link, embedded, and email surfaces, and on every page state a respondent might see."

For the respondent: a subtle attribution that does not compete with the operator's brand.
For CustomerEQ: a consistent viral-attribution channel — every respondent is one click away from the marketing site.

## Customer Problem being solved

### Direct cause

Respondent-facing survey surfaces today carry no CustomerEQ attribution at all:

- **Direct link (public BYO-member-id flow)** — `apps/web/src/app/survey/[id]/page.tsx`. After #378's `useSurveyResponseForm` extraction, the page renders five branches: loading (~L122), load-error (~L130), duplicate (~L140), thank-you (~L153), active form (~L221, via `SurveyFormRenderer`). None has a footer.
- **Direct link (tokenized flow, post-#378)** — `apps/web/src/app/survey/[id]/r/[token]/page.tsx`. Renders five additional state branches: token-status-loading (~L127), four token-error states (`expired` / `responded` / `survey-not-open` / `invalid` — all rendered uniformly at ~L135-143), thank-you (~L145-165), load-failure (~L167-173), active form (~L177-203, via `SurveyFormRenderer`). None has a footer.
- **Embedded widget** — `apps/api/src/routes/public.ts` `generateWidgetJs()` (~L811-894). Renders into the host site with no attribution; the post-submission thank-you DOM swap (~L872) replaces the form without inserting a footer.
- **Email** — `apps/worker/src/processors/{surveyDistribute,notifications}.ts`. Both currently stubs (`notifications.ts` ~L35); no email-body template exists yet, but the contract for whenever it lands is undefined.

Meanwhile, adjacent member-facing mocks already include the "Powered by CustomerEQ" pattern: `mocks/23-member-portal.html` L97, `mocks/36-theme-editor.html` L386 + L402, `mocks/83-member-spin-wheel.html` L85, `mocks/84-member-scratch-card.html` L61, `mocks/85-member-mystery-box.html` L73, `mocks/101-widget-chat.html` L121. Survey surfaces are the inconsistency.

### Root design gap

The `ChromeMatrix` abstraction (`apps/web/src/components/survey-form/types.ts:44`) governs `logo / name / title` chrome — operator's brand. RFC #241 §"BrandTheme to Survey element token mapping (R31)" L474 reserved `--ceq-text-color` (reduced opacity) for "footer 'Powered by' copy" but the renderer was never updated to emit the footer. The token mapping was authored anticipating this issue; #413 closes the implementation gap.

The same RFC L504 mentioned "footer on/off" in chromeMatrix anticipation, but the TypeScript type (`types.ts:44`) intentionally never added it. Confirming: the footer is **platform policy**, not look-and-feel — operators control look-and-feel via theme tokens; attribution is the platform's.

### Why fix it now

1. The viral-attribution channel is dormant. Every respondent today is a missed prospect, with zero attribution cost.
2. Existing customer-facing mocks already imply this pattern. Survey surfaces are out of step with the rest of the product.
3. Brand-removal / white-label / paid-tier features that would gate attribution removal **do not exist** in the repo today (no `Plan`, `Tier`, `Subscription`, or billing entity — confirmed by repo grep). Landing the footer universally now establishes the default; a future paid-tier `Brand.hideCustomerEQAttribution` flag can default `false` without breaking #413's contract.

## User Experience that will solve the problem

### Footer contract (canonical)

The footer is a **single line of muted attribution copy** rendered below the survey content. On theme-aware surfaces (the React renderer), it lives inside the themed card and inherits brand typography. On non-theme-aware surfaces (the widget JS, email), it uses a neutral muted gray fallback.

**Copy** (canonical, English-only for v0 — see OD-5):

> Powered by **CustomerEQ**

The "CustomerEQ" word is an anchor link to the marketing site with UTM params identifying the channel. The "Powered by" prefix is plain text.

**Anchor target** (host sourced from the canonical `EXPORTS_POWERED_BY_URL` constant in `packages/shared/src/constants.ts` — see OD-7 for the host decision and #500 for the regression where the original `customereq.com` literal pointed at an off-product redirect):

```
{EXPORTS_POWERED_BY_URL}/?utm_source=survey_footer&utm_medium={channel}&utm_campaign=powered_by
```

…which today resolves to:

```
https://customereq.wellnessatwork.me/?utm_source=survey_footer&utm_medium={channel}&utm_campaign=powered_by
```

…where `{channel}` is one of `link` (direct-link respondent page) / `embed` (widget) / `email` (email body). The taxonomy mirrors the existing `SurveyResponse.channel` enum + `widget.js`'s `channel: 'in_app'` → mapped to `embed` for this attribution purpose. The link opens in a new tab (`target="_blank"`) with `rel="noopener noreferrer"` set.

**Themed vs neutral — which surface gets which**:

The footer style adapts to the chrome it sits inside. Surfaces driven by `SurveyFormRenderer` (the active form on both standalone and tokenized routes) pull from `BrandTheme` tokens and get the **themed** footer. All other state-cards in the respondent pages (loading / load-error / duplicate / thank-you / 4 token-error states) use Tailwind utility classes today (`bg-amber-50`, `bg-red-50`, `bg-white p-8 text-center`, etc.) — they are **not** theme-aware. The footer on those surfaces is **neutral** to match the surrounding chrome; theming the footer in isolation would create visual inconsistency. Same for the widget JS (no theme tokens piped through `generateWidgetJs` today — see Deferred follow-ups) and the email body (email-client CSS-variable support is unreliable).

Lifting the non-form state-cards into the theme-aware shell is a separate, larger refactor outside #413's scope — captured in Deferred follow-ups.

**Visual specification** (canonical mock = [`./mocks/413-survey-footer.html`](./mocks/413-survey-footer.html)):

| Property | **Themed** variant (active form via `SurveyFormRenderer`) | **Neutral** variant (page state-cards, tokenized state-cards, widget JS, email body, loading) |
|---|---|---|
| Position | Inside `ceq-survey-card`, after the form, before closing `</div>` | Inside / below the local state-card or widget container; below the email body |
| Text color | `var(--ceq-text-color)` at `opacity: 0.55` | `#6b7280` (Tailwind gray-500) |
| Anchor color | `var(--ceq-text-color)` at `opacity: 0.85`, underline on hover/focus | `#374151` (Tailwind gray-700), underline on hover/focus |
| Font family | `var(--ceq-font-family)` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Font size | `calc(var(--ceq-body-size) * 0.75)` (≈10.5–13.5 px depending on theme scale) | `11px` |
| Top border | `1px solid rgba(0,0,0,0.04)` | Same |
| Padding | `12px 0` (top/bottom) | Same |
| Alignment | `text-align: center` | Same |
| Focus state | 2px outline at `var(--ceq-primary-color)`, 2px offset | 2px outline at `#6366f1` (CustomerEQ default indigo), 2px offset |
| Effective contrast | The 0.55-opacity body text against `--ceq-background-color` MUST resolve to ≥4.5:1 (WCAG 1.4.3) at every default theme. Asserted in R6. | The `#6b7280` vs `#ffffff` background = 4.83:1, passes WCAG 1.4.3 |

The CSS pattern is a direct adoption of `mocks/36-theme-editor.html` L148–149 `.powered-by` — already established as the canonical "Powered by" footer style across 6 existing mocks. No novel components or tokens.

### Accessibility (WCAG 2.1 AA)

- **Link text**: visible text reads `Powered by CustomerEQ` with "CustomerEQ" as the anchor. Screen-reader text on the anchor: `aria-label="Powered by CustomerEQ — opens in a new tab"` so the new-tab behavior is announced. (Generic form chosen over naming the host so the announcement is stable across host changes — the host itself is the subject of the canonical `EXPORTS_POWERED_BY_URL` constant.)
- **Keyboard**: standard `<a>` tab order — the footer link is reachable via Tab after the submit button. A visible focus indicator (see above) makes the focused state unambiguous.
- **No reliance on color**: the underline-on-hover/focus is the affordance, not color alone.
- **Reduced-motion**: footer has no animations.

### Surface-by-surface coverage

| Surface | Page state(s) | File touched (impl scope) | Footer variant |
|---|---|---|---|
| **Direct link · standalone** (`/survey/[id]`) | Active questions | `apps/web/src/components/survey-form/SurveyFormRenderer.tsx` — append footer inside `ceq-survey-card`, after the form, before the closing `</div>` (~L213) | **Themed** |
| **Direct link · standalone** | Loading | `apps/web/src/app/survey/[id]/page.tsx` (~L122-128) | Neutral |
| **Direct link · standalone** | Load error | same file (~L130-138) | Neutral |
| **Direct link · standalone** | Already responded (`duplicate`) | same file (~L140-151) | Neutral |
| **Direct link · standalone** | Thank you (`submitted`) | same file (~L153-166) | Neutral |
| **Direct link · tokenized** (`/survey/[id]/r/[token]`) | Active questions | Same `SurveyFormRenderer` (#378 already wires it up) | **Themed** (inherited from the renderer change above — no per-surface code edit) |
| **Direct link · tokenized** | Token-status loading | `apps/web/src/app/survey/[id]/r/[token]/page.tsx` (~L127-133) | Neutral |
| **Direct link · tokenized** | Token-error states (`expired` / `responded` / `survey-not-open` / `invalid`) | same file (~L135-143) — all four states share one card | Neutral |
| **Direct link · tokenized** | Thank you (`submitted`) | same file (~L145-165) | Neutral |
| **Direct link · tokenized** | Load failure (fetch errored or survey null) | same file (~L167-173) | Neutral |
| **Embedded widget** | All states (active, validation, post-submit thank-you) | `apps/api/src/routes/public.ts` `generateWidgetJs()` (~L811-894) — append footer inside `ceq-survey-widget-{id}` container AFTER the form append; ALSO include the footer inside the thank-you `container.innerHTML` replacement (~L872) so the swap doesn't drop the footer | Neutral (widget is theme-unaware today — Deferred follow-up) |
| **Email** | Any survey-bearing email body (invite, reminder, thank-you, follow-up) | `apps/worker/src/processors/{surveyDistribute,notifications}.ts` — **contract only** (R5) | Neutral (email CSS-variable support is unreliable) |

**Implementation efficiency**: the **themed** variant lives in `SurveyFormRenderer` and is rendered exactly once — both `/survey/[id]` and `/survey/[id]/r/[token]` already mount the same `SurveyFormRenderer` for their active-form branch, so the active-form footer is one code change covering both routes. The **neutral** variant ships as a shared component (`SurveyFooter.tsx` neutral mode, see R11) imported by the page state-cards in both routes — so the page-state footer is also one component, ten call-sites. The widget footer is a string literal that asserts equality against the shared component's text + URL (per R11).

### UI mocks

High-fidelity mocks at [`./mocks/413-survey-footer.html`](./mocks/413-survey-footer.html). Scenes:

1. **Direct link · Active questions (standalone or tokenized)** — Indigo seed theme, **themed** footer inside the `SurveyFormRenderer` card. Same DOM for both `/survey/[id]` and `/survey/[id]/r/[token]` active-form branches.
2. **Direct link · Thank you (standalone)** — neutral state-card chrome; **neutral** footer below the thank-you message.
3. **Direct link · Already responded (standalone)** — amber state-card chrome; **neutral** footer below the amber message.
4. **Direct link · Load error (standalone)** — red error-card chrome; **neutral** footer below.
5. **Direct link · Loading (standalone or tokenized)** — spinner; **neutral** footer below.
6. **Embedded widget** — host-site context; **neutral** footer inside the widget container.
7. **Email body** — text-only HTML email; **neutral** footer with email-safe inline styles.
8. **Keyboard-focus state** — close-up of the focused anchor showing the 2px focus outline (themed variant).
9. **Direct link · Tokenized route — 4 token-error states** — `responded` uses the canonical "already responded" `h2 + p` treatment (mirrors Scene 3); the three true-error states (`expired` / `survey-not-open` / `invalid`) share the simpler single-`<p>` chrome. **Neutral** footer is byte-identical across all four (per R12 + #378 NFR-S5 timing-attack-resistance — the timing-attack constraint applies to footer bytes only, since the server returns the same uniform `{state}` payload regardless of which state and chrome differences are rendered client-side).

### Design Standards Applied

- Source: `docs/architecture/architecture.md` (CustomerEQ design system — shadcn/Tailwind v4 stack per `fraim/config.json customizations.stack.ui`).
- Token contract: `docs/rfcs/241-survey-admin-ux.md` §"BrandTheme to Survey element token mapping (R31)" — the footer copy maps to `--ceq-text-color` *at reduced opacity*. This spec consumes the contract; the mapping itself is authoritative.
- CSS pattern reference: `docs/feature-specs/mocks/36-theme-editor.html` L148–149 `.powered-by` rule — adopted verbatim.
- No novel components introduced; no theme-token additions; no new schema fields.

## Functional Requirements

| ID | Requirement | Acceptance Criterion (Given/When/Then) |
|----|---|---|
| **R1** | The shared `SurveyFormRenderer` SHALL render a **themed** footer with the text "Powered by **CustomerEQ**" below the survey form (after the submit button, before the closing `ceq-survey-card` div), using `--ceq-text-color` at 0.55 opacity for the prefix and 0.85 opacity for the anchor. This footer appears on both `/survey/[id]` (BYO-member-id flow) and `/survey/[id]/r/[token]` (tokenized flow) active-form states because both routes mount the same renderer. | Given any active survey rendered by `SurveyFormRenderer` from either route, when the page paints, the DOM contains an element with `data-survey-footer` whose visible text is "Powered by CustomerEQ", whose anchor `href` starts with `{EXPORTS_POWERED_BY_URL}/?utm_source=survey_footer&utm_medium=link`, and whose computed text color is `--ceq-text-color` at opacity 0.55. |
| **R2** | The public BYO-member-id respondent page (`apps/web/src/app/survey/[id]/page.tsx`) SHALL render a **neutral** footer on every non-form state branch: loading (~L122), load error (~L130), duplicate (~L140), thank-you (~L153). Each footer SHALL use `channel="link"` UTM. | Given each of the four non-form branches, when the branch renders, the DOM contains the neutral footer with `Powered by CustomerEQ`, an anchor with `utm_medium=link`, `target="_blank"`, and `rel="noopener noreferrer"`. |
| **R3** | The embedded widget JS (`generateWidgetJs()` in `apps/api/src/routes/public.ts`, ~L811-894) SHALL append a **neutral** footer inside the `ceq-survey-widget-{id}` container after the form append, AND SHALL include the footer inside the thank-you `container.innerHTML` replacement (~L872) so the post-submission DOM swap retains it. The widget footer SHALL use `channel="embed"` UTM. | Smoke: serve `widget.js` for a fixture survey; inject into a test host page; assert the rendered DOM has the footer element present before submission AND after a successful submission (the thank-you DOM swap MUST preserve the footer). |
| **R4** | The footer link SHALL be `{EXPORTS_POWERED_BY_URL}/?utm_source=survey_footer&utm_medium={channel}&utm_campaign=powered_by` where `{channel}` ∈ {`link`, `embed`, `email`} and `EXPORTS_POWERED_BY_URL` is the canonical CustomerEQ-host constant in `packages/shared/src/constants.ts` (today: `https://customereq.wellnessatwork.me`). The link host MUST be sourced from the constant — literals are forbidden so a future host change is a single edit. UTM params SHALL NOT carry respondent-identifiable data (no `email`, no `memberId`, no `surveyId`, no `brandId`, no IP-derived value). | Inspect the rendered anchor in each surface: `href` matches the URL pattern; the query string contains exactly `utm_source`, `utm_medium`, `utm_campaign`; no PII; `target="_blank"`; `rel="noopener noreferrer"` set. Verified by unit test asserting host equality against `EXPORTS_POWERED_BY_URL` + manual grep. |
| **R5** | **Email surfaces** — the contract is: any survey-bearing email body (invite, reminder, follow-up, thank-you) MUST include a footer block with the text "Powered by CustomerEQ" and an anchor to the same UTM URL with `utm_medium=email`. **Rendering implementation is owned by whichever future PR ships the email-template renderer** — `apps/worker/src/processors/{surveyDistribute,notifications}.ts` are currently stubs. This spec records the contract so the template author has the directive. | Future-binding: verified when email templates land. A tracking issue is filed referencing this requirement (see "Deferred follow-ups"). |
| **R6** | The footer color contract SHALL meet WCAG 2.1 AA contrast minimum (1.4.3, 4.5:1) on every default theme. Computed: `--ceq-text-color` at opacity 0.55 against `--ceq-background-color`. | Unit test in `apps/web/src/components/survey-form/footer-contrast.test.ts`: for each of the four seed themes (Indigo, Forest, Sunset, Slate from `apps/api/src/lib/default-themes.ts`), compute the effective contrast of the alpha-blended text vs background; assert ≥4.5:1. Fails the build if any theme falls below threshold. |
| **R7** | The footer SHALL be **non-toggleable**. `ChromeMatrix` SHALL NOT gain a `footer` boolean; `Survey.settings` SHALL NOT gain a `hideFooter` field; `Brand` SHALL NOT gain a `hideCustomerEQAttribution` field. The footer is required platform attribution. | Code review: this PR's diff (and any sibling PR landing under #413) introduces no field named `footer`, `hideFooter`, `hideAttribution`, `showPoweredBy`, or equivalent across `ChromeMatrix`, `Survey`, `Brand`, or `BrandTheme`. Asserted by a grep gate added to the validation script (one-line `! grep -rE 'hideFooter\\|hideAttribution\\|showPoweredBy' packages/ apps/`). |
| **R8** | The footer anchor SHALL be keyboard-focusable, SHALL render a visible focus indicator per RFC #241 §"Focus-visible outline" (2px outline at `--ceq-primary-color`, 2px offset on themed surfaces; `#6366f1` on non-themed), and SHALL carry `aria-label="Powered by CustomerEQ — opens in a new tab"`. | Vitest + RTL: render `SurveyFormRenderer`; query the footer link; assert `tabIndex` reachable (no `tabIndex=-1`), `aria-label` matches the expected string, `target="_blank"`, `rel="noopener noreferrer"`. Focus-state asserted via a `:focus-visible` style snapshot. |
| **R9** | The footer SHALL render at the same DOM position relative to the survey card across all renderer modes (preview / live) and channels (standalone / embedded React renderer). The editor preview MUST show the same footer the respondent will see. | Visual-regression: extend RFC #241 Slice 5 Playwright fixture to snapshot the renderer in preview-mode and live-mode for the same survey + theme; assert the footer is at the same y-offset and contains identical DOM. |
| **R10** | The widget JS footer SHALL be self-contained (no external CSS / fonts / scripts) and SHALL not increase the `widget.js` bundle by more than 1 KB gzipped vs the pre-change baseline. | `generateWidgetJs()` unit test asserts the output string contains the footer markup AND the gzipped size delta vs the pre-change baseline is ≤1 KB. |
| **R11** | The renderer SHALL extract the footer into a shared component (`apps/web/src/components/survey-form/SurveyFooter.tsx`) with two variants (`variant="themed"` and `variant="neutral"`). The component SHALL be consumed by: (i) `SurveyFormRenderer` for the themed active-form footer; (ii) the non-form branches in `apps/web/src/app/survey/[id]/page.tsx` for the neutral state-card footers; (iii) the non-form branches in `apps/web/src/app/survey/[id]/r/[token]/page.tsx` for the neutral tokenized state-card footers (R12) — so one component covers all 11+ React call sites (per project Rule 15 — fix at the right abstraction level). The widget JS uses a parallel template string (necessarily inline — the widget can't import React) that asserts string equality against `SURVEY_FOOTER_COPY` + `SURVEY_FOOTER_URL_BASE` constants exported from the shared component. | Code review: exactly one React component implements the footer; all React call sites import from the same path. A unit assertion compares `generateWidgetJs()` output against the exported constants to catch any string drift. |
| **R12** | The tokenized respondent page (`apps/web/src/app/survey/[id]/r/[token]/page.tsx`) SHALL render a **neutral** footer on every non-form state branch: token-status loading (~L127), the 4 token-error states (`expired` / `responded` / `survey-not-open` / `invalid` all sharing the card at ~L135-143), thank-you (~L145-165), load failure (~L167-173). Each footer SHALL use `channel="link"` UTM. The footer's presence on the 4 token-error states SHALL NOT leak any PII (NFR-S4 from #378's spec — the footer is informational and contains no respondent identifier). | Given each of the seven non-form branches on the tokenized page (token-loading + 4 token-error states + thank-you + load-failure), when the branch renders, the DOM contains the neutral footer with `Powered by CustomerEQ`, an anchor with `utm_medium=link`, `target="_blank"`, and `rel="noopener noreferrer"`. The 4 token-error footers MUST be byte-identical across the 4 states (the footer is part of the uniform body shape required by #378 NFR-S5 — timing-attack resistance against token enumeration). |

### Open Decisions Resolved in this Spec

| # | Question | Recommended | Alternative(s) | Why recommended |
|---|---|---|---|---|
| **OD-1** | **UTM params on the footer link** — what query string carries the attribution signal? | **`?utm_source=survey_footer&utm_medium={channel}&utm_campaign=powered_by`** ← recommended | (a) No UTM (plain marketing-site URL); (b) Add `&utm_content={surveyId}` for per-survey conversion attribution; (c) Add `&ref={brandId}` for per-brand attribution; (d) Sign the brand/survey IDs into a hashed token | (a) loses the attribution signal entirely — the marketing site cannot tell how prospects arrived. (b) and (c) carry `surveyId`/`brandId` — neither is PII, but both leak brand-cadence to a third-party analytics surface (the marketing site's analytics, plus any retargeting pixel), which is a CCPA-adjacent signal-leak we can avoid for free. (d) adds infra (HMAC key, rotation, replay defense) for a marketing-site signal that genuinely doesn't need it. The 3-param shape gives attribution + channel granularity without any per-brand fingerprint. |
| **OD-2** | **Brand-level "hide CustomerEQ attribution"** — should this spec add a `Brand.hideCustomerEQAttribution` (or equivalent) escape hatch now? | **NO — out of scope for #413.** ← recommended | Add `Brand.hideAttribution: boolean` default `false`; only writable via a future paid-tier admin path | The repo has **no billing / tier / plan / paid-feature infra today** — confirmed by repo grep. Designing the escape hatch without the gate that controls it produces a free-for-all flag any admin could flip via the API. Per project Rule 21 (one issue per branch), a paid-tier capability belongs in a separate issue alongside whatever billing surface gates it. Per my L1 preference *Merit over ease*: shortcuts like "let's add the flag now, gate it later" produce the precedent of shortcut-shaped reasoning the L1 corpus explicitly flags. The recommended path lands the universal footer now; a future paid-tier issue can default the flag `false`, preserving #413's contract for existing brands. |
| **OD-3** | **Email surfaces** — should this spec build the email-template renderer + footer now, or define only the contract? | **Contract only (R5); rendering rides the future email-template PR.** ← recommended | (a) Build the email-template renderer + footer now in this PR; (b) Drop email from #413 scope entirely | (a) The email-template renderer is substantial scope (template language choice, react-email vs MJML, sender config, plaintext fallback, BullMQ delivery wiring) — none of which exists today, and all of which would balloon #413's PR well beyond the issue's stated scope per my L1 preference *Tight PR scope*. (b) Contradicts the issue's explicit ACs which list email. The recommended path records the contract so the future template author has the directive, and files a follow-up tracking issue. |
| **OD-4** | **Footer link target** — new tab or same tab? | **`target="_blank" rel="noopener noreferrer"`** (new tab) ← recommended | Same-tab navigation | The respondent is either mid-survey (active questions) or just submitted feedback (thank-you state). Same-tab navigation abandons their session and (mid-survey) loses any unsaved answers. New-tab preserves respondent context, is the standard SaaS attribution pattern (Typeform / SurveyMonkey / Tally all do this), and `rel="noopener noreferrer"` mitigates the standard `target="_blank"` reverse-tabnabbing risk. |
| **OD-5** | **Footer copy localization** — should "Powered by CustomerEQ" translate via `Brand.locale`? | **English-only for v0** ← recommended | Translate via `Brand.locale` (en-US / es-ES / fr-FR / etc.) now | The repo has no app-wide i18n system today. `Brand.locale` is captured (#277) but no consumer yet renders translated copy (per `277-organization-settings.md` L56 — *"no v0 surface consumes it yet"*). Adding a translation pipeline for a three-word footer is premature investment. "Powered by **CustomerEQ**" — where the brand name is the variable — is a recognized SaaS-attribution pattern across locales (cf. "Made with Typeform" / "Powered by SurveyMonkey", both English-only on free tiers regardless of buyer locale). When an i18n epic ships, the footer joins the migration. |
| **OD-6** | **Should `ChromeMatrix` gain a `footer` toggle** per RFC #241 L504 anticipation? | **NO — footer is non-toggleable by design (R7).** ← recommended | Add `chromeMatrix.standalone.footer: boolean` + `chromeMatrix.embedded.footer: boolean` (default `true`) | Issue #413 explicitly mandates "**consistently**" across all surfaces. A toggle invites future deviation: an operator with API access could flip the flag; a future PR could default it `false`; a survey-builder UI could expose it. RFC #241's earlier "footer on/off" mention was anticipatory — the corresponding TypeScript type (`apps/web/src/components/survey-form/types.ts:44`) never landed it, which is now load-bearing for this spec. Operators control look-and-feel via theme tokens; attribution is platform policy. |
| **OD-7** | **Marketing-site domain** — which TLD does the footer link to? | **Sourced from the canonical `EXPORTS_POWERED_BY_URL` constant in `packages/shared/src/constants.ts` (today: `https://customereq.wellnessatwork.me`).** ← **RESOLVED under #500** | (a) hardcode `customereq.com`; (b) hardcode `customereq.io`; (c) env-configurable `MARKETING_SITE_URL` | **Original spec recommended `customereq.com` and was merged that way — it resolved off-product (redirected to `lp.cultideas.com/customereq`), filed as P0 bug #500.** Resolution: read from the existing `EXPORTS_POWERED_BY_URL` constant that the XLSX-export footer already uses. This collapses to a single source of truth for the CustomerEQ host across every "Powered by" surface in the codebase (survey footer, XLSX cover-block, future PDFs/emails) — a future host change is a one-line edit. Forbidding URL literals at the same time prevents this regression from recurring. The previous reasoning *"`.com` is the user-facing brand surface, `.io` is reserved for technical subdomains"* was speculative — neither domain is actually owned/configured for the product today. |

## Compliance Requirements

Per `fraim/config.json customizations.compliance.regulations`: `GDPR`, `CCPA`, `SOC2`, `PCI-DSS`. PCI-DSS is `minimal-scope` (no card data in this feature); SOC2 is `target: month-12`. GDPR + CCPA are in-scope today and bind this feature. WCAG 2.1 AA is in-scope as a project-level baseline (RFC #241 §"Focus-visible outline" already binds the renderer to it).

| Regulation | Clause | Mapped Control |
|---|---|---|
| **GDPR** | [Art. 5 §1(c) — data minimisation](https://gdpr-info.eu/art-5-gdpr/) | The footer link's UTM payload carries no respondent identifier — no email, no memberId, no IP-derived value, no surveyId, no brandId. UTM keys are literal strings (`utm_source=survey_footer`, `utm_campaign=powered_by`) plus a channel taxonomy (`utm_medium ∈ {link, embed, email}`). The recommended OD-1 option preserves data minimisation by design. OD-1 alternatives (b)/(c) — which would add `surveyId` or `brandId` — are explicitly rejected for this reason. |
| **GDPR** | [Recital 47 — legitimate-interest balancing](https://gdpr-info.eu/recitals/no-47/) | Platform-attribution footers are an established SaaS-industry-standard practice (Typeform, SurveyMonkey, Tally, Mailchimp). The respondent's expectation that a survey-tool surface carries platform signature is settled. The footer is non-intrusive: single-line, muted typography, no interaction required. Balance: brand visibility vs respondent UX disruption — disruption is minimal; the legitimate-interest test passes. |
| **GDPR** | [Art. 7 §1 — demonstrability of consent](https://gdpr-info.eu/art-7-gdpr/) | N/A — the footer is not a consent surface. Consent for survey data collection is captured by the existing consent block (R10 / R11 from #231); the footer is an outbound platform-attribution link only. |
| **CCPA** | [§1798.135 — Do Not Sell](https://oag.ca.gov/privacy/ccpa) | The footer click does not transmit respondent PII to the marketing site. Only literal UTM parameters accompany the navigation. The marketing site's own privacy policy governs the prospect-side journey from there. |
| **CCPA** | §1798.105 — right to deletion | N/A — the footer renders no PII and is not associated with any `Member` row. The erasure job (#264) has no new surface here. |
| **SOC2** | CC6.1 — logical access controls | The footer is rendered without any privileged data path; no SOC2 access-control surface change. Server-side widget rendering (`generateWidgetJs`) reads only public survey fields already exposed by the public route. |
| **SOC2** | CC4.1 — monitoring of system performance | The footer link is a static href — no runtime dependency on the marketing site. Availability of the survey-response surface is unaffected by the marketing site's availability. |
| **PCI-DSS** | All requirements | N/A — no card data flows through any survey footer surface. |
| **WCAG 2.1 AA** | [1.4.3 Contrast Minimum](https://www.w3.org/WAI/WCAG21/quickref/#contrast-minimum) | R6 asserts ≥4.5:1 effective contrast for the 0.55-opacity body text against background, validated by unit test against each seed theme. Fails the build if any theme falls below threshold. |
| **WCAG 2.1 AA** | [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG21/quickref/#keyboard) | R8 asserts the footer anchor is keyboard-focusable with a visible focus indicator. |
| **WCAG 2.1 AA** | [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/quickref/#focus-visible) | Same — focus indicator visible per RFC #241 §"Focus-visible outline" (2px outline at `--ceq-primary-color`, 2px offset). |
| **WCAG 2.1 AA** | [3.2.5 Change on Request](https://www.w3.org/WAI/WCAG21/quickref/#change-on-request) | `target="_blank"` is announced via `aria-label="Powered by CustomerEQ — opens in a new tab"` so the new-tab navigation is not surprising. |

**Compliance non-goals**:
- No new PII collection.
- No new third-party data flow (the footer link is a static href — outbound navigation only when a user clicks).
- No new data export surface.
- No new consent surface — the footer is informational, not a consent collection point.

## Validation Plan

| Layer | What | How |
|---|---|---|
| **Unit (renderer)** | `SurveyFormRenderer` emits the footer at the correct DOM position with correct text, href, target, rel, aria-label | Vitest + RTL in `apps/web/src/components/survey-form/SurveyFormRenderer.test.tsx`: render in preview-mode and live-mode; assert `[data-survey-footer]` present, anchor href matches UTM pattern with `channel=embed` (embedded) / `channel=link` (standalone), aria-label correct, `target="_blank"`, `rel="noopener noreferrer"` |
| **Unit (page states · standalone)** | The standalone respondent page renders the neutral footer on the loading / load-error / duplicate / submitted branches | Vitest + RTL in `apps/web/src/app/survey/[id]/page.test.tsx`: drive each non-form branch via mocked fetch states; assert footer present in each. UTM `medium` consistent (`link`) |
| **Unit (page states · tokenized)** | The tokenized respondent page renders the neutral footer on the token-status-loading branch, all 4 token-error branches, the submitted branch, and the load-failure branch | New test `apps/web/src/app/survey/[id]/r/[token]/page.test.tsx`: drive each of the 7 non-form branches by mocking the `/token-status` response; assert footer present with `utm_medium=link`. **Crucial:** assert the 4 token-error footers are DOM-identical (per R12 / #378 NFR-S5 timing-attack invariant) |
| **Unit (shared component)** | The shared `SurveyFooter` component renders both `variant="themed"` and `variant="neutral"` modes | Vitest + RTL in `apps/web/src/components/survey-form/SurveyFooter.test.tsx`: render in each variant; assert correct color/font/href/aria-label for each |
| **Unit (contrast)** | Footer contrast meets WCAG 1.4.3 for all four seed themes | New test `apps/web/src/components/survey-form/footer-contrast.test.ts`: for each of Indigo / Forest / Sunset / Slate (from `apps/api/src/lib/default-themes.ts`), compute the alpha-blended luminance and the resulting contrast ratio against `--ceq-background-color`; assert ≥4.5:1 |
| **Unit (widget)** | `generateWidgetJs()` emits the footer in the JS output string and the footer survives the form → thank-you DOM swap | Vitest in `apps/api/src/routes/public.widget.test.ts`: call `generateWidgetJs(fixtureSurvey, baseUrl)`; assert the returned string contains the footer markup with `channel=embed`; assert the thank-you path also renders the footer; assert size delta ≤1 KB gzipped vs the pre-change baseline (snapshot the baseline in the test) |
| **Unit (no-toggle gate)** | R7 — no `hideFooter` / `hideAttribution` / `showPoweredBy` fields exist | New script `scripts/check-no-attribution-toggle.sh`: `! grep -rE 'hideFooter\|hideAttribution\|showPoweredBy' packages/ apps/`. Wired into `pnpm test:smoke`'s lint step |
| **E2E (Playwright, direct-link)** | Respondent flow through direct-link surface renders footer on every visible state | New spec `apps/web/test/e2e/survey-footer.spec.ts`: navigate to seed survey; assert footer in active state; submit; assert footer in thank-you state; replay same surveyId; assert footer in duplicate state; navigate to expired/invalid surveyId; assert footer in error state |
| **E2E (Playwright, widget)** | Embedded widget on a host page renders footer; click navigates to marketing site with correct UTMs in a new tab | New spec `apps/web/test/e2e/widget-footer.spec.ts`: serve `widget.js` via the API; inject into a Playwright-controlled host page; assert footer present in DOM and visible (`expect(locator).toBeVisible()`); submit; assert footer present after thank-you swap; click footer link; assert `pages.context.waitForEvent('page')` resolves to a new tab with URL matching the UTM pattern |
| **Visual-regression** | Editor preview and live renderer show the same footer at the same DOM position | Reuse / extend the RFC #241 Slice 5 Playwright visual-regression fixture: snapshot preview-mode and live-mode for the same survey; assert pixel-identical footer position (y-offset) and DOM-identical footer markup |
| **Manual (browser)** | Keyboard navigation through the form lands on the footer with visible focus | Tab through the form on a locally-served survey; assert footer focus indicator appears; Enter activates the link in a new tab |
| **Manual (screen reader)** | NVDA / VoiceOver announces the footer correctly | Open the survey in NVDA (Windows) / VoiceOver (macOS); listen for "Powered by CustomerEQ — opens in a new tab, link" |
| **Compliance** | UTM payload carries no respondent identifier | Code grep + manual inspection of every footer-construction call site; confirm no `email`, `memberId`, `IP`, `surveyId`, `brandId` enter the query string |

## Requirements traceability matrix

*Per my validated pattern: matrices catch a class of AC → schema/mock-element coverage gap that prose review misses.*

### Issue ACs (verbatim from #413) → R-items

| # | Issue AC (verbatim) | R-items | Mock scene(s) | Validation hook(s) |
|---|---|---|---|---|
| **AC-1** | *"Saying 'Powered by CustomerEQ' with a link to the site"* | R1 (themed footer in renderer); R4 (UTM URL contract); R12 (tokenized route coverage) | Scenes 1, 2, 3, 4, 5, 6, 7, 8, 9 | Unit (renderer); Unit (widget); E2E (link click + UTM check) |
| **AC-2** | *"All survey distribution surfaces — direct link"* | R1 + R2 (standalone `/survey/[id]`); R12 (tokenized `/survey/[id]/r/[token]`); R11 (shared component) | Scenes 1, 2, 3, 4, 5, 9 | Unit (page-states standalone); Unit (page-states tokenized); E2E (Playwright direct-link on both routes) |
| **AC-3** | *"All survey distribution surfaces — embedded"* | R3 (widget JS); R10 (size budget) | Scene 6 | Unit (widget); E2E (Playwright widget on host) |
| **AC-4** | *"All survey distribution surfaces — send via email"* | R5 (email contract) | Scene 7 | Future-binding — verified when email-template renderer ships (deferred follow-up) |
| **AC-5** | *"All pages on the survey — Questions"* | R1 (covers both standalone and tokenized active-form via `SurveyFormRenderer`) | Scene 1 | Unit (renderer in live mode); E2E (Playwright both routes) |
| **AC-6** | *"All pages on the survey — thank you"* | R2 (standalone submitted branch); R12 (tokenized submitted branch); R9 (preview/live parity) | Scene 2 | Unit (page-states standalone + tokenized); Visual-regression |
| **AC-7** | *"All pages on the survey — already responded"* | R2 (standalone duplicate branch); R12 (tokenized `responded` token state) | Scene 3 + Scene 9 (tokenized `responded` variant) | Unit (page-states); E2E (replay submitted surveyId) |
| **AC-8** | *"All pages on the survey — expired"* | R2 (standalone load-error branch); R12 (tokenized `expired` + `survey-not-open` + `invalid` states) | Scene 4 + Scene 9 (3 of the 4 tokenized variants) | Unit (page-states); E2E (expired surveyId + expired token) |
| **AC-9** | *"...should consistently have this footer"* (consistency mandate) | R7 (non-toggleable); R12 (tokenized error footers DOM-identical for timing-attack resistance) | All 9 scenes show consistent footer markup (themed-vs-neutral chrome adapts to local card chrome only) | Unit (no-toggle gate via grep); Unit (R12 byte-identity assertion); code review |

**Coverage**: 9 / 9 issue ACs → at least one R-item + at least one mock scene + at least one validation hook. **Zero Unmet rows.**

**Loading-state coverage (Scene 5)**: not in the issue's verbatim AC list, but added defensively — the loading branch is a respondent-reachable state the issue's "consistently" mandate logically extends to. Documented as part of R2.

### R-items → Implementation surfaces → Tests

| R-id | Implementation surface | Test(s) |
|---|---|---|
| R1 | `apps/web/src/components/survey-form/SurveyFormRenderer.tsx` (new footer inside `ceq-survey-card`) + new `apps/web/src/components/survey-form/SurveyFooter.tsx` | `SurveyFormRenderer.test.tsx`; `SurveyFooter.test.tsx` |
| R2 | `apps/web/src/app/survey/[id]/page.tsx` (loading L290, error L298, duplicate L308, submitted L321 branches) | `apps/web/src/app/survey/[id]/page.test.tsx`; `apps/web/test/e2e/survey-footer.spec.ts` |
| R3 | `apps/api/src/routes/public.ts` `generateWidgetJs()` L754-894 (footer appended after form AND inside thank-you `innerHTML`) | `apps/api/src/routes/public.widget.test.ts`; `apps/web/test/e2e/widget-footer.spec.ts` |
| R4 | Shared constant exported from `SurveyFooter.tsx`; consumed by widget template string | Unit grep + manual inspection |
| R5 | **Future binding** — `apps/worker/src/processors/{surveyDistribute,notifications}.ts` when email templates land | Future test coverage; tracking issue filed |
| R6 | Default-theme contrast tests — `apps/web/src/components/survey-form/footer-contrast.test.ts` (new) | Same file |
| R7 | `scripts/check-no-attribution-toggle.sh` (new); wired into `pnpm test:smoke` | Same script |
| R8 | `SurveyFooter.tsx` markup + `:focus-visible` styles | `SurveyFooter.test.tsx` (aria, tabIndex, target, rel); visual-regression for focus state |
| R9 | Visual-regression fixture (extend RFC #241 Slice 5 fixture) | New visual-regression test |
| R10 | `public.widget.test.ts` size-budget assertion | Same file (snapshot baseline) |
| R11 | `apps/web/src/components/survey-form/SurveyFooter.tsx` (new shared component) + `SURVEY_FOOTER_COPY` / `SURVEY_FOOTER_URL_BASE` exported constants consumed by widget JS string | Code review + unit string-equality assertion comparing `generateWidgetJs()` output against the exported constants |
| R12 | `apps/web/src/app/survey/[id]/r/[token]/page.tsx` (loading L127, 4 token-error states L135-143, submitted L145-165, load-failure L167-173 branches) | `apps/web/src/app/survey/[id]/r/[token]/page.test.tsx`; E2E `apps/web/test/e2e/survey-footer-tokenized.spec.ts`; byte-identity assertion across 4 token-error variants |

### Open Decisions → spec sections

| OD-id | Resolved in | Reviewer ack needed? |
|---|---|---|
| OD-1 (UTM shape) | R4 + Compliance §GDPR Art.5 §1(c) | Yes — reviewer should confirm 3-param shape |
| OD-2 (no hide-attribution flag now) | R7 + Deferred follow-ups | Yes — confirms #413 is universal-footer scope |
| OD-3 (email = contract-only) | R5 + Deferred follow-ups | Yes — confirms email rendering rides future PR |
| OD-4 (target=_blank) | R8 + Mock scene 8 | Implicit (standard pattern) |
| OD-5 (English-only) | Deferred follow-up #3 | Implicit (standard pattern) |
| OD-6 (no chromeMatrix.footer) | R7 | Yes — confirms non-toggleable |
| OD-7 (marketing domain) | OD-7 row | **Reviewer MUST confirm** — repo has both `.com` and `.io` |

### Mock-vs-spec parity

| Mock scene | R-items referenced | Spec section |
|---|---|---|
| 1 — Active questions (themed) | R1, R4, R8 | "Footer contract" + "Surface-by-surface coverage" |
| 2 — Thank-you (themed) | R2, R9 | "Surface-by-surface coverage" |
| 3 — Already responded | R2 | Same |
| 4 — Error / Expired (neutral) | R2 | Same |
| 5 — Loading (neutral) | R2 | Same |
| 6 — Embedded widget | R3, R10 | Same |
| 7 — Email body | R5 | Same (contract-only) |
| 8 — Focus state | R8 | "Accessibility" |
| 9 — Tokenized route · 4 token-error states | R12 | "Surface-by-surface coverage" + #378 NFR-S5 cross-ref |

All 9 scenes map to at least one R-item; no scene is decorative-only. Every R-item that has a visual surface is shown in at least one scene.

## Deferred follow-ups

Tracking issues to file alongside this spec (per my L1 preference *Filing backlog issues proactively*). For each, an existing-issue search SHOULD be performed before filing to avoid duplicates.

| Issue (proposed) | Scope | Why deferred |
|---|---|---|
| **Email template renderer + footer** | Build the survey-bearing email body (invite, reminder, thank-you) with the footer per R5. Owns: template-language choice (react-email vs MJML), plaintext fallback, sender config, BullMQ wiring, footer rendering with `channel=email` | `apps/worker/src/processors/{surveyDistribute,notifications}.ts` are currently stubs (`notifications.ts` L35: *"MVP stub: log the notification (real email provider integration in post-MVP)"*). The email-template infra is substantial scope and out of #413's "footer on every surface" — the contract lives in R5; the build rides the next email-template ticket. Search for an existing tracker first (likely candidates: `gh issue list --search "email template"`, `--search "notifications stub"`) |
| **Brand-level attribution toggle (paid tier)** | If/when a paid tier ships, expose `Brand.hideCustomerEQAttribution` (or equivalent on a `Subscription` entity) as a tier-gated capability | OD-2 above — current repo has no billing / tier infra. This is a future-paid-tier capability that depends on infra that does not yet exist |
| **i18n for footer copy** | Translate "Powered by CustomerEQ" via `Brand.locale` when the repo-wide i18n epic ships | OD-5 above — no i18n consumer exists yet; `Brand.locale` is captured (#277) but unused |
| **Theme the widget JS** | Pipe `BrandTheme` tokens through `generateWidgetJs()` so the widget footer (and the rest of the widget chrome) inherits brand colors / typography, just like the React renderer does today | The widget JS today hardcodes colors (`#6366f1` indigo, `#374151` text, etc.) — this is a pre-existing inconsistency with the React renderer. The footer in this spec adopts the same hardcoded approach for consistency *with the widget*; once the widget gets themed, the footer naturally joins. Search `gh issue list --search "widget theme"` before filing |
| **FRAIM config — `competitors` array** | Add the Medallia / Annex Cloud / Yotpo / Typeform / SurveyMonkey / Tally / Google Forms / Qualtrics set to `fraim/config.json` `customizations.competitors` (or wherever the FRAIM `competitor-analysis` skill expects it) so future `feature-specification` jobs auto-load the configured set | The FRAIM mentor flagged `competitors` as not configured during this spec's competitor-analysis phase. Editing `fraim/config.json` in this PR would violate project Rule 21 (one issue per branch) — the change is off-scope from #413's footer work. Search `gh issue list --search "fraim config competitors"` before filing |
| **Theme the page state-cards (standalone + tokenized)** | Lift the standalone page's loading/load-error/duplicate/thank-you state-cards and the tokenized page's loading/token-error/thank-you/load-failure state-cards into a theme-aware shell (or pass `BrandTheme` tokens into them) so the surrounding chrome and the footer can both inherit brand colors / typography | Today these state-cards use Tailwind utility classes (`bg-amber-50`, `bg-red-50`, `bg-white p-8 text-center`) — not theme tokens. #413's footer matches the local chrome (neutral) because theming the footer alone would create visual inconsistency. Fixing the chrome itself is a separate refactor outside #413's "add the footer" scope. The footer's variant-prop API (`variant="themed" \| "neutral"`) is forward-compatible — once the chrome gets themed, those call sites flip to `variant="themed"` with no other change |
| **Shared `SurveyStateCard` for post-submit / already-responded / token-error surfaces** ([#476](https://github.com/mathursrus/CustomerEQ/issues/476)) | Extract a single `SurveyStateCard` component consumed by `survey/[id]/page.tsx`, `survey/[id]/r/[token]/page.tsx`, and `generateWidgetJs()`. Variants: `submitted` (h2 + p, Scene 2 canonical), `already-responded` (h2 + p, Scene 3 / Scene 9 `responded` canonical), and `error / expired / invalid / survey-not-open` (single p, three Scene 9 variants) | Same logical state currently rendered by four hand-rolled copies that have visibly drifted (different headings, padding, copy, text colors). Surfaced during #413 mock review (Scene 2 vs Scene 9 `responded` diverged). #413 only adds the footer to each existing call site; the consolidation onto one component is a structural refactor with its own design + test surface and is filed separately as #476 |

## Alternatives

| Alternative | Why discard |
|---|---|
| **Header instead of footer** — render "Powered by CustomerEQ" above the survey form | Conflicts with the brand-logo header (operator's brand is intentionally the first impression — see `75-cx-loyalty-workflow-streamlining.md` §"White-label / Embedded"). The existing canonical pattern in `mocks/36-theme-editor.html` and 5 other mocks puts attribution at the bottom. RFC #241 L474 token mapping already reserved the bottom slot. Reversing would re-litigate the operator-prominence policy. |
| **Watermark in the survey background** — a faint diagonal "CustomerEQ" stamp behind the form | High visual noise; impossible to make accessible (background images don't carry an accessible name); fights brand backgrounds. RFC #241 doesn't expose a watermark token, and adding one would be additive scope. |
| **One-time tooltip / nudge** instead of a persistent footer | Inconsistent with the "**every** survey ... **consistently**" wording of the issue. Non-persistent attribution doesn't deliver the viral channel either — a tooltip seen once on session N doesn't help session N+1 conversions. |
| **Server-injected footer at the API / gateway layer** instead of renderer-emitted | The respondent page is a Next.js client component; the API can't reach into its DOM. A gateway-injected approach also breaks R9 (preview/live parity) because the editor preview doesn't go through the gateway. |
| **Brand-level attribution toggle now** (`Brand.hideCustomerEQAttribution: boolean`) | See OD-2 above. |
| **Disable the footer in the editor preview** to save panel space | Violates R9 — the editor preview MUST match what the respondent sees, otherwise operators ship surveys without seeing the footer they're about to render. |
| **Carry brand fingerprint in the UTM** (`utm_content={brandId}` or hashed equivalent) | See OD-1 above. Per *data minimisation*. |

## Competitive Analysis

### Configured Competitors Analysis

*From `docs/business-development/details/phase2-deep-context-synthesis.md` + `phase7-feature-synthesis.md`.*

| Competitor | Current Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|---|---|---|---|---|---|
| **Medallia** | Enterprise XM — **white-labels heavily** at the respondent-facing layer; no "Powered by Medallia" on customer surveys at default plans; custom-domain support included | Enterprise polish; full operator branding | Enterprise pricing; no viral attribution channel from respondent surfaces back to Medallia | Enterprise CX surveys feel polished but Medallia gets no respondent-side brand recognition outside the buyer | Enterprise XM leader |
| **Annex Cloud** | Loyalty platform — surveys are secondary to loyalty; "Powered by Annex Cloud" in some member-portal-embedded configurations; tier-gated removal | Some viral attribution from loyalty surfaces | Surveys aren't the primary surface; respondent-facing surveys are inconsistent across configurations | Mixed brand recognition | Mid-market loyalty |
| **Yotpo** | Reviews + loyalty; survey-style review collection from members | Carries "Powered by Yotpo" on review widgets at lower plans; tier-removable; strong DTC recognition | Surveys are review-shaped, not CX-shaped | Strong recognition on review widgets — operates as the viral channel | DTC e-commerce reviews |
| **Salesforce CDP** | Embedded surveys are not a primary respondent surface | N/A — no comparable surface | N/A | N/A | Enterprise data platform |

### Additional Competitors Analysis

*Dominant patterns in the standalone survey-tool category.*

| Competitor | Current Solution | Strengths | Weaknesses | Customer Feedback | Market Position |
|---|---|---|---|---|---|
| **Typeform** | "Made with Typeform" footer on every free / Basic-plan survey; tier-gated removal at Business / Enterprise | High viral attribution; clean on-brand footer; one-click upgrade prompt for operators | Some operators perceive the footer as friction at moderate price points | Acknowledged industry standard; viral channel drives substantial signups | Form-builder leader |
| **SurveyMonkey** | "Powered by SurveyMonkey" footer with link to marketing site; tier-gated removal at Premier / Enterprise | Long-established pattern; expected by respondents | Footer copy slightly larger than Typeform; viewed as legacy | Brand recognition so strong it functions as a verb ("send a SurveyMonkey") | Legacy survey leader |
| **Tally** | "Made with Tally" footer on free plan; removable on paid | Modern minimal aesthetic; close to the visual treatment this spec proposes | Lower brand recognition outside indie / DTC | Loyal indie / DTC following | Indie / freemium |
| **Google Forms** | Google branding implicit in chrome (no explicit "Powered by" line) | Clean visual; Google's own URL is the brand signal | Operator brand is muted (Google chrome wins) | Free; respondents trust the Google domain itself | Free / consumer leader |
| **Qualtrics** | Enterprise — white-labeled by default at every tier | Maximum operator brand prominence | No viral channel for Qualtrics | Enterprise expectation | Enterprise XM leader |

### Competitive Positioning Strategy

#### Our Differentiation

- **Key Advantage 1**: **Theme-aware footer** that inherits operator typography and color (via `--ceq-text-color` at reduced opacity) — not a generic "Made with X" pill. Reads as part of the brand surface, not a foreign sticker. Competitors above all use platform-native styling that ignores operator typography.
- **Key Advantage 2**: **Consistent across direct-link, embed, and email**. Most competitors skip embed (Typeform's embed has a tiny pill but no footer) or skip email (SurveyMonkey email surfaces drop the footer). #413 mandates consistency.
- **Key Advantage 3**: **Theme-token integration** means the footer adapts automatically when operators change brand colors — no separate "embed footer color" setting to maintain. Lower long-term maintenance cost than per-channel footer configurations.

#### Competitive Response Strategy

- **If Typeform / Tally / SurveyMonkey ships richer footer customization at lower tiers**: hold position. CustomerEQ's theme-token integration is structurally cheaper to maintain, and the viral-channel value is unchanged.
- **If Medallia / Qualtrics introduces tiered footer removal at higher prices**: this is the future paid-tier path captured in OD-2 / Deferred follow-ups. No #413 change.

#### Market Positioning

- **Target Segment**: mid-market brands shipping CustomerEQ to authenticated members (per `75-cx-loyalty-workflow-streamlining.md` §"White-label / Embedded"). These brands accept platform attribution at default tiers if it feels native to their brand.
- **Value Proposition**: attribution that doesn't fight the brand. Same viral channel as Typeform; better visual integration via theme tokens.
- **Pricing Strategy**: default footer is universal; attribution removal lands when a paid tier exists (deferred follow-up).

### Research Sources

- Typeform plan tiers — [typeform.com/pricing](https://www.typeform.com/pricing/) (Basic plan: "Made with Typeform" footer; removed at Business+)
- SurveyMonkey plan tiers — [surveymonkey.com/pricing](https://www.surveymonkey.com/pricing/) (Premier+ removes "Powered by")
- Tally plan tiers — [tally.so/pricing](https://tally.so/pricing) (Pro removes branding)
- Medallia / Qualtrics / Annex Cloud / Yotpo: extracted from `docs/business-development/details/phase2-deep-context-synthesis.md` + `phase7-feature-synthesis.md`
- Repo grep for existing "Powered by" patterns: `mocks/{23,36,83,84,85,101}` — six pre-existing instances establish the visual language
- Research date: 2026-05-18
- Methodology: vendor pricing-page review + repo-local competitive-analysis docs + GitHub-issue and RFC cross-reference
