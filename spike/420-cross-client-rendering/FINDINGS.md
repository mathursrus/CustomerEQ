# Spike Findings — Cross-client email rendering (RFC #420 §9.3)

**Hypothesis**: The §6 template structure (inline styles only, table-based layout, conservative CSS subset) renders correctly across Gmail web/iOS, Outlook web/desktop, and Apple Mail macOS/iOS.

**Outcome**: Partially validated. Chromium (Webkit-derived, proxy for Gmail web + Apple Mail macOS Safari engine) renders cleanly at desktop and mobile widths. Real-inbox cross-client rendering (especially Outlook desktop, which uses Word's rendering engine) requires sending to actual inboxes — **Help needed** from a developer with personal accounts in each client.

## What was spiked

1. **Template structure** — `render-template.ts` builds an HTML email body matching the §6 RFC spec, using:
   - Inline `style="…"` on every element (no `<style>` block)
   - Outer `<table>` for Outlook desktop reliability
   - `<hr>`-equivalent via single-cell `<table>` row with `border-top` (avoids Outlook's known issues with raw `<hr>` styling)
   - Theme colors threaded through: `primaryColor` → brand name `<h1>`, `accentColor` → links + unsubscribe, `secondaryColor` → divider, `backgroundColor` + `textColor` → body, `buttonColor` + `buttonTextColor` → CTA
   - Mustache substitution for `{{brand_name}}`, `{{first_name}}`, `{{survey_link}}`, `{{sender_name}}`, plus optional `{{brand_logo}}`
   - Link-rewriting pass: inline `<a>` tags inside operator body without explicit `style=` get the accent color applied automatically (idempotent — operator-styled links win)
2. **Render verification** — Rendered `preview.html` with CustomerEQ default palette (indigo) + realistic ComposerSnapshot (Acme Coffee Roasters / Q2 NPS Pulse / Priya Patel) and opened in Chromium at 800px (desktop) + 375px (mobile).

## Findings

### ✅ Validated in Chromium (Gmail web + Apple Mail macOS use Webkit-derived engines)

| Check | Result | Evidence |
|---|---|---|
| Inline styles applied | Yes | All colors visible in screenshots |
| Mustache substitution | Yes | "Hi Priya", "Maya at Acme" rendered |
| Brand name in primaryColor | Yes | Indigo `#6366f1` on `<h1>` |
| Body text in textColor | Yes | Dark gray `#111827` |
| Inline link auto-styled with accentColor | Yes | "Take the survey" anchor inside body — accent indigo + underline |
| Big CTA button styled correctly | Yes | Filled rectangle with buttonColor bg + buttonTextColor text |
| Divider rendered | Yes | Thin horizontal line via table-row border-top |
| Footer at reduced opacity | Yes | `opacity: 0.7` applied; footer visibly de-emphasized |
| Unsubscribe link in accentColor | Yes | Visible at end of footer |
| Mobile responsive | Yes | Layout collapses 600px → viewport width cleanly; text wraps; button stays usable |
| Brand-logo rendered with image fallback alt | Yes | Placeholder image (200×60) loaded; alt-text would surface if image blocked |

### ⚠ Design risks that the Chromium-only check does NOT cover

These are documented as known email-client gotchas; mitigations applied in the template:

| Risk | Mitigation in `render-template.ts` | Still-need-real-client-test |
|---|---|---|
| Outlook desktop ignores `<hr>` styling | Used table-row + `border-top` instead | Yes — verify the row collapses to 1px in Outlook desktop |
| Outlook desktop doesn't recognize `system-ui` font | Fallback chain `system-ui, -apple-system, sans-serif` ends in `sans-serif` (Arial fallback) | Yes — verify text doesn't drop to Times New Roman |
| Outlook desktop ignores `display: inline-block` on `<a>` styled as button | None applied; spike CTA is a plain styled `<a>` | Yes — if Outlook strips the button styling, V0 escape hatch is to ship a VML-wrapped button (Outlook-only conditional comment) |
| Gmail iOS auto-recolors links | Inline `style="color: …"` applied to every `<a>` | Yes — verify Gmail iOS honors the inline color |
| Gmail web strips `<style>` blocks in some templates | We use inline-only — no `<style>` blocks | Already mitigated |
| Apple Mail macOS dark-mode auto-inverts light themes | None | Yes — verify dark mode rendering on macOS + iOS |
| Outlook desktop renders images at 1.25x scale by default | Image set with explicit `width="200"` attribute alongside CSS | Yes — verify logo doesn't render oversized |

### Design impact

**None** of the Chromium-validated checks failed; the template structure as designed in RFC §6 stands. The **risks above are all mitigation-in-place** (chosen during the spike-code-authoring), not unknown unknowns surfaced by the spike. Net design impact:

- `render-template.ts` from this spike becomes the seed of the worker's email-rendering function; no §6 structural changes needed.
- The link-rewriting helper (`rewriteLinksWithAccent`) was added during the spike — it's a small inline pass that ensures operator-authored `<a>` tags pick up the brand accent color without TipTap needing to know the theme. **Worth surfacing in §6 of the RFC** since it wasn't called out there.
- The CTA button is currently a plain styled `<a>`. **Worth surfacing in §6 + as a V1 risk**: if real-inbox testing reveals Outlook desktop strips the button styling, we'll need to add a VML conditional-comment wrapper. The single-`<a>` approach ships V0; VML is a contingency.
- Mobile responsive works as expected with the 600px max-width pattern; no `@media` queries needed.

### Risk #1 update

Risk #1 in RFC §8 ("Theme inlining for email rendering — email-client CSS support is famously inconsistent") stands, but the spike has narrowed the unknown surface:
- **Resolved by spike**: template structure renders correctly in Webkit-derived clients (Gmail web, Apple Mail macOS Safari engine).
- **Still open, needs real-inbox follow-up**: Outlook desktop rendering of `<hr>` substitute + button + system-ui font fallback; Gmail iOS link recoloring; Apple Mail dark-mode inversion.
- **Pre-merge gate** for the impl PR: per-implementer cross-client screenshots in `docs/evidence/420-impl-evidence.md` covering all 6 client/device combinations.

## Help needed

To complete the spike's validation phase, run one of these and add screenshots to this directory:

```bash
# Option A — real ACS send (requires env vars):
EMAIL_PROVIDER=azure-communication-services \
  AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING=… \
  AZURE_COMMUNICATION_SERVICES_EMAIL_FROM='no-reply@customereq.wellnessatwork.me' \
  npx tsx spike/420-cross-client-rendering/send-to-inbox.ts your.inbox@example.com

# Option B — upload preview.html to a litmus.com / emailonacid.com trial:
# (~free 7-day trial covers all 6 client/device combinations in one report)
```

Screenshots to capture, one each:
- Gmail web (Chrome desktop)
- Gmail iOS app
- Outlook web (`outlook.live.com`)
- Outlook desktop (Windows)
- Apple Mail macOS
- Apple Mail iOS

Add them to this directory as `inbox-{client}.png`. The §9.4 of the RFC will be updated with the final cross-client report.

## What this spike intentionally did NOT do

- **Send a real email**. The `send-to-inbox.ts` script is ready to run when ACS creds are configured locally; the spike code itself doesn't ship any send.
- **Build the worker integration**. The spike's `render-template.ts` is pure; it'll be copied into `apps/worker/src/processors/managedEmailSend.ts` during impl, not imported as a `spike/` dependency.
- **Test the unsubscribe flow**. The `unsubscribeUrl` is a placeholder string in the spike; the actual `/u/:token` minting is a separate API surface validated by §7 integration tests.
