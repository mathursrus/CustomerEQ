// Spike: writes preview.html with the §6 template rendered against the default
// BrandTheme palette (the CustomerEQ defaults from schema.prisma:764-770) and a
// realistic ComposerSnapshot.
//
// Run: pnpm tsx spike/420-cross-client-rendering/render-preview.ts
// Output: spike/420-cross-client-rendering/preview.html

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderEmailHtml, renderEmailPlainText, type BrandThemeSnapshot, type ComposerSnapshot } from './render-template'

const theme: BrandThemeSnapshot = {
  primaryColor: '#6366f1', // schema.prisma:764 default — indigo-500
  secondaryColor: '#818cf8', // schema.prisma:765 default — indigo-400
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
  subject: 'How was your Q2 coffee delivery?',
  bodyHtml:
    '<p>Hi {{first_name}},</p>' +
    '<p>You ordered the Ethiopian Yirgacheffe in May. We&#39;d love to know how it landed — your feedback shapes the next quarter&#39;s roast schedule.</p>' +
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
const plain = renderEmailPlainText(composer)

const outDir = resolve(__dirname)
writeFileSync(resolve(outDir, 'preview.html'), html, 'utf8')
writeFileSync(resolve(outDir, 'preview.txt'), plain, 'utf8')

console.log('Wrote:')
console.log('  ' + resolve(outDir, 'preview.html'))
console.log('  ' + resolve(outDir, 'preview.txt'))
console.log('\nOpen preview.html in Chrome / Safari to inspect the rendered email body.')
console.log('Or upload to a litmus.com / emailonacid.com account for actual cross-client rendering.')
