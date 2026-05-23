// Spike: sends the §6-rendered email to a single configured inbox via the EXISTING
// packages/connectors/src/email.ts:sendEmailMessage() — no schema changes, no worker
// changes. This is the path that the operator will eventually exercise for cross-client
// validation in their own inboxes.
//
// Run (requires AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING + _EMAIL_FROM in env):
//   EMAIL_PROVIDER=azure-communication-services pnpm tsx \
//     spike/420-cross-client-rendering/send-to-inbox.ts your.inbox@example.com
//
// If env vars are not set, the script falls back to EMAIL_PROVIDER=stub and just
// logs what would have been sent.

import { sendEmailMessage } from '@customerEQ/connectors'
import { renderEmailHtml, renderEmailPlainText, type BrandThemeSnapshot, type ComposerSnapshot } from './render-template'

async function main() {
  const recipient = process.argv[2]
  if (!recipient || !recipient.includes('@')) {
    console.error('Usage: pnpm tsx send-to-inbox.ts <recipient-email>')
    process.exit(1)
  }

  const theme: BrandThemeSnapshot = {
    primaryColor: '#6366f1',
    secondaryColor: '#818cf8',
    backgroundColor: '#ffffff',
    textColor: '#111827',
    accentColor: '#6366f1',
    buttonColor: '#6366f1',
    buttonTextColor: '#ffffff',
    fontFamily: 'system-ui',
  }
  const composer: ComposerSnapshot = {
    brandName: 'Acme Coffee Roasters',
    brandLogoUrl: 'https://placehold.co/200x60/png?text=Acme+Coffee',
    subject: '[Spike #420] How was your Q2 coffee delivery?',
    bodyHtml:
      '<p>Hi {{first_name}},</p>' +
      '<p>You ordered the Ethiopian Yirgacheffe in May. We&#39;d love to know how it landed.</p>' +
      '<p>Two minutes. <a href="{{survey_link}}">Take the survey</a>.</p>' +
      '<p>Thanks,<br/>{{sender_name}}</p>',
    senderName: 'Maya at Acme',
    senderEmail: 'maya@customereq.wellnessatwork.me',
    surveyTitle: 'Q2 NPS Pulse',
    unsubscribeUrl: 'https://app.customereq.example/u/abc123def456',
    surveyLink: 'https://app.customereq.example/s/r/ghi789jkl012',
    recipientFirstName: 'Priya',
    recipientLastName: 'Patel',
  }

  const html = renderEmailHtml(theme, composer)
  const plainText = renderEmailPlainText(composer)

  console.log(`Sending spike email to ${recipient}…`)
  console.log(`EMAIL_PROVIDER=${process.env.EMAIL_PROVIDER ?? 'stub (unset)'}`)
  console.log(`AZURE_COMMUNICATION_SERVICES_EMAIL_FROM=${process.env.AZURE_COMMUNICATION_SERVICES_EMAIL_FROM ?? '(unset)'}`)

  const result = await sendEmailMessage(
    { to: recipient, subject: composer.subject, plainText, html },
    {},
  )
  console.log('Result:', result)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
