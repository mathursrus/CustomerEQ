// One-shot smoke check for the Azure Communication Services email connector.
// Run: pnpm tsx --env-file=.env scripts/test-acs-connection.ts <recipient-email>
//
// Reads AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING +
// AZURE_COMMUNICATION_SERVICES_EMAIL_FROM from env (never hard-coded). Uses the
// same sendEmailMessage entry point that apps/worker and apps/api inline runtime
// invoke, so a green result here means the production code path will reach ACS.

import { sendEmailMessage } from '@customerEQ/connectors'

const recipient = process.argv[2]
if (!recipient || !recipient.includes('@')) {
  console.error('Usage: tsx scripts/test-acs-connection.ts <recipient-email>')
  process.exit(2)
}

const provider = process.env.EMAIL_PROVIDER ?? '(unset)'
const hasConn = Boolean(process.env.AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING?.trim())
const fromAddress = process.env.AZURE_COMMUNICATION_SERVICES_EMAIL_FROM?.trim() ?? '(unset)'
console.log(`[acs-smoke] EMAIL_PROVIDER=${provider}`)
console.log(`[acs-smoke] connection-string-set=${hasConn}`)
console.log(`[acs-smoke] from=${fromAddress}`)
console.log(`[acs-smoke] to=${recipient}`)
if (provider !== 'azure-communication-services' && provider !== 'azure') {
  console.error('[acs-smoke] FAIL: EMAIL_PROVIDER must be azure-communication-services')
  process.exit(1)
}
if (!hasConn || fromAddress === '(unset)') {
  console.error('[acs-smoke] FAIL: connection string or FROM not set in env')
  process.exit(1)
}

async function main(): Promise<void> {
  const subject = `CustomerEQ ACS smoke ${new Date().toISOString()}`
  const plainText = `This is a one-shot smoke check from scripts/test-acs-connection.ts.\nIf you received this, the connector + sender domain + key are wired correctly.`
  const html = `<p>This is a one-shot smoke check from <code>scripts/test-acs-connection.ts</code>.</p><p>If you received this, the connector + sender domain + key are wired correctly.</p>`

  const started = Date.now()
  try {
    const result = await sendEmailMessage({ to: recipient, subject, plainText, html })
    const elapsedMs = Date.now() - started
    if (!result.sent) {
      console.error(`[acs-smoke] FAIL: send returned sent=false (reason=${result.reason ?? 'unknown'}, provider=${result.provider}) after ${elapsedMs}ms`)
      process.exit(1)
    }
    console.log(`[acs-smoke] OK: provider=${result.provider} operationId=${result.operationId ?? '(none)'} elapsedMs=${elapsedMs}`)
    console.log('[acs-smoke] Check the recipient inbox (and spam folder) — propagation typically < 60s.')
  } catch (err) {
    const elapsedMs = Date.now() - started
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[acs-smoke] FAIL: ${msg} (after ${elapsedMs}ms)`)
    process.exit(1)
  }
}

void main()
