# Spike: Cross-client email rendering for #420

Resolves ambiguity **A1** from RFC §9.2. Validates that the §6 HTML template
structure (inline styles, table-based layout, conservative CSS subset) renders
correctly across major email clients.

## Run

```bash
# Render preview.html from the template:
npx tsx render-preview.ts

# Send to a real inbox (requires AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING + EMAIL_FROM):
EMAIL_PROVIDER=azure-communication-services npx tsx send-to-inbox.ts your.inbox@example.com
```

## Files

- `render-template.ts` — pure rendering function. Will become the basis of
  `apps/worker/src/processors/managedEmailSend.ts:renderEmailHtml()`.
- `render-preview.ts` — CLI that writes `preview.html` + `preview.txt` from one
  hard-coded BrandTheme palette (CustomerEQ defaults per `schema.prisma:764-770`).
- `send-to-inbox.ts` — CLI that wraps the EXISTING
  `packages/connectors/src/email.ts:sendEmailMessage()` to send the rendered email
  to a configured inbox. No schema, API, or worker changes.
- `preview.html` / `preview.txt` — last rendered output.
- `preview-chrome-desktop-800.png` / `preview-chrome-mobile-375.png` — Chromium
  rendering at desktop + mobile widths.
- `FINDINGS.md` — spike conclusions + design impact.
