import { EmailClient } from '@azure/communication-email'
import type { NotificationPayload } from '@customerEQ/shared'
import pino from 'pino'

const logger = pino({ name: 'email-connector' })

type EmailProvider = 'stub' | 'sendgrid' | 'resend' | 'azure' | 'azure-communication-services'

type LoggerLike = Pick<typeof logger, 'info' | 'warn' | 'error'>

type EmailSendResult = {
  sent: boolean
  reason?: string
  provider: EmailProvider
  operationId?: string
}

type EmailMessage = {
  to: string
  subject: string
  plainText: string
  html?: string
}

type NotificationDeliveryOptions = {
  env?: NodeJS.ProcessEnv
  logger?: LoggerLike
  resolveRecipientEmail: (payload: NotificationPayload) => Promise<string | null>
}

export type NotificationDeliveryResult = {
  sent: boolean
  reason?: string
  provider: EmailProvider
  memberId: string
  channel: NotificationPayload['channel']
  recipient?: string
  operationId?: string
}

let cachedAzureConnectionString: string | null = null
let cachedAzureClient: EmailClient | null = null

function getProvider(env: NodeJS.ProcessEnv): EmailProvider {
  const raw = (env.EMAIL_PROVIDER ?? 'stub').trim().toLowerCase()
  switch (raw) {
    case 'azure':
    case 'azure-communication-services':
      return raw
    case 'sendgrid':
    case 'resend':
    case 'stub':
    case '':
      return raw === '' ? 'stub' : raw
    default:
      return 'stub'
  }
}

function getAzureConnectionString(env: NodeJS.ProcessEnv): string | null {
  return env.AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING?.trim()
    || env.ACS_CONNECTION_STRING?.trim()
    || null
}

function getAzureSenderAddress(env: NodeJS.ProcessEnv): string | null {
  return env.AZURE_COMMUNICATION_SERVICES_EMAIL_FROM?.trim()
    || env.ACS_EMAIL_FROM?.trim()
    || null
}

function getAzureClient(connectionString: string): EmailClient {
  if (!cachedAzureClient || cachedAzureConnectionString !== connectionString) {
    cachedAzureClient = new EmailClient(connectionString)
    cachedAzureConnectionString = connectionString
  }
  return cachedAzureClient
}

function readMetadata(payload: NotificationPayload): Record<string, unknown> {
  return payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata
    : {}
}

function deriveNotificationSubject(payload: NotificationPayload): string {
  const metadata = readMetadata(payload)
  if (typeof metadata.subject === 'string' && metadata.subject.trim().length > 0) {
    return metadata.subject.trim()
  }
  if (typeof metadata.programName === 'string' && metadata.programName.trim().length > 0) {
    return `Welcome to ${metadata.programName.trim()}`
  }
  if (typeof metadata.surveyLink === 'string' && metadata.surveyLink.trim().length > 0) {
    return "We'd love your feedback"
  }
  return 'CustomerEQ notification'
}

function deriveNotificationHtml(payload: NotificationPayload): string | undefined {
  const metadata = readMetadata(payload)
  return typeof metadata.html === 'string' && metadata.html.trim().length > 0
    ? metadata.html
    : undefined
}

function readRecipientFromMetadata(payload: NotificationPayload): string | null {
  const metadata = readMetadata(payload)
  if (typeof metadata.to === 'string' && metadata.to.includes('@')) {
    return metadata.to.trim()
  }
  return null
}

export function resetEmailClientCache(): void {
  cachedAzureClient = null
  cachedAzureConnectionString = null
}

export async function sendEmailMessage(
  message: EmailMessage,
  opts: { env?: NodeJS.ProcessEnv; logger?: LoggerLike; senderAddress?: string } = {},
): Promise<EmailSendResult> {
  const env = opts.env ?? process.env
  const log = opts.logger ?? logger
  const provider = getProvider(env)

  if (provider === 'stub') {
    return { sent: false, reason: 'stub_provider', provider }
  }

  if (provider === 'sendgrid' || provider === 'resend') {
    return { sent: false, reason: `provider_not_implemented:${provider}`, provider }
  }

  const connectionString = getAzureConnectionString(env)
  if (!connectionString) {
    throw new Error('AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING is required when EMAIL_PROVIDER=azure-communication-services')
  }

  // Issue #420 — when opts.senderAddress is set (the MANAGED_EMAIL per-batch composer
  // path), bypass env resolution. Backward-compatible for existing notification callers.
  const senderAddress = opts.senderAddress?.trim() || getAzureSenderAddress(env)
  if (!senderAddress) {
    throw new Error('AZURE_COMMUNICATION_SERVICES_EMAIL_FROM is required when EMAIL_PROVIDER=azure-communication-services (or pass opts.senderAddress)')
  }

  const client = getAzureClient(connectionString)
  const poller = await client.beginSend({
    senderAddress,
    content: {
      subject: message.subject,
      plainText: message.plainText,
      ...(message.html ? { html: message.html } : {}),
    },
    recipients: {
      to: [{ address: message.to }],
    },
  })
  const response = await poller.pollUntilDone()
  const status = String(response.status ?? '')
  if (status.toLowerCase() !== 'succeeded') {
    throw new Error(`Azure Communication Services email send did not succeed (status=${status || 'unknown'})`)
  }

  const operationId = typeof response.id === 'string' ? response.id : undefined
  log.info({ provider, to: message.to, operationId }, 'notification.email_sent')
  return { sent: true, provider, operationId }
}

export async function deliverNotification(
  payload: NotificationPayload,
  opts: NotificationDeliveryOptions,
): Promise<NotificationDeliveryResult> {
  const env = opts.env ?? process.env
  const log = opts.logger ?? logger
  const provider = getProvider(env)

  if (payload.channel !== 'email') {
    return {
      sent: false,
      reason: 'channel_not_supported',
      provider,
      memberId: payload.memberId,
      channel: payload.channel,
    }
  }

  if (provider === 'stub') {
    return {
      sent: false,
      reason: 'stub_provider',
      provider,
      memberId: payload.memberId,
      channel: payload.channel,
    }
  }

  const recipient = readRecipientFromMetadata(payload) ?? await opts.resolveRecipientEmail(payload)
  if (!recipient) {
    log.warn({ memberId: payload.memberId }, 'notification.recipient_missing')
    return {
      sent: false,
      reason: 'recipient_missing',
      provider,
      memberId: payload.memberId,
      channel: payload.channel,
    }
  }

  const sendResult = await sendEmailMessage({
    to: recipient,
    subject: deriveNotificationSubject(payload),
    plainText: payload.message,
    html: deriveNotificationHtml(payload),
  }, { env, logger: log })

  return {
    ...sendResult,
    memberId: payload.memberId,
    channel: payload.channel,
    recipient,
  }
}
