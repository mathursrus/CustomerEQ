/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { beginSend, pollUntilDone, EmailClient } = vi.hoisted(() => ({
  beginSend: vi.fn(),
  pollUntilDone: vi.fn(),
  EmailClient: vi.fn(),
}))

vi.mock('@azure/communication-email', () => ({
  EmailClient,
}))

import { deliverNotification, resetEmailClientCache, sendEmailMessage } from './email.js'

describe('email connector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetEmailClientCache()
    EmailClient.mockImplementation(() => ({ beginSend }))
    beginSend.mockResolvedValue({ pollUntilDone })
    pollUntilDone.mockResolvedValue({ id: 'operation-123', status: 'Succeeded' })
  })

  it('returns stub_provider when EMAIL_PROVIDER is not configured', async () => {
    const result = await deliverNotification(
      {
        memberId: 'member-001',
        brandId: 'brand-001',
        message: 'Hello',
        channel: 'email',
      },
      {
        env: {},
        resolveRecipientEmail: async () => 'member@example.com',
      },
    )

    expect(result).toEqual(expect.objectContaining({
      sent: false,
      reason: 'stub_provider',
      provider: 'stub',
    }))
    expect(EmailClient).not.toHaveBeenCalled()
  })

  it('returns recipient_missing when the member has no email address', async () => {
    const result = await deliverNotification(
      {
        memberId: 'member-001',
        brandId: 'brand-001',
        message: 'Hello',
        channel: 'email',
      },
      {
        env: { EMAIL_PROVIDER: 'azure-communication-services' },
        resolveRecipientEmail: async () => null,
      },
    )

    expect(result).toEqual(expect.objectContaining({
      sent: false,
      reason: 'recipient_missing',
    }))
    expect(EmailClient).not.toHaveBeenCalled()
  })

  it('sends email through Azure Communication Services with the configured sender domain', async () => {
    const result = await deliverNotification(
      {
        memberId: 'member-001',
        brandId: 'brand-001',
        message: 'Welcome aboard.',
        channel: 'email',
        metadata: {
          subject: 'Welcome to CustomerEQ',
        },
      },
      {
        env: {
          EMAIL_PROVIDER: 'azure-communication-services',
          AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING: 'endpoint=https://customereq.communication.azure.com/;accesskey=test',
          AZURE_COMMUNICATION_SERVICES_EMAIL_FROM: 'no-reply@customereq.wellnessatwork.me',
        },
        resolveRecipientEmail: async () => 'member@example.com',
      },
    )

    expect(EmailClient).toHaveBeenCalledWith('endpoint=https://customereq.communication.azure.com/;accesskey=test')
    expect(beginSend).toHaveBeenCalledWith({
      senderAddress: 'no-reply@customereq.wellnessatwork.me',
      content: {
        subject: 'Welcome to CustomerEQ',
        plainText: 'Welcome aboard.',
      },
      recipients: {
        to: [{ address: 'member@example.com' }],
      },
    })
    expect(result).toEqual(expect.objectContaining({
      sent: true,
      provider: 'azure-communication-services',
      recipient: 'member@example.com',
      operationId: 'operation-123',
    }))
  })

  it('uses metadata.to without a member lookup when present', async () => {
    await deliverNotification(
      {
        memberId: 'member-001',
        brandId: 'brand-001',
        message: 'Survey link',
        channel: 'email',
        metadata: {
          to: 'direct@example.com',
          surveyLink: 'https://example.com/survey',
        },
      },
      {
        env: {
          EMAIL_PROVIDER: 'azure-communication-services',
          AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING: 'endpoint=https://customereq.communication.azure.com/;accesskey=test',
          AZURE_COMMUNICATION_SERVICES_EMAIL_FROM: 'no-reply@customereq.wellnessatwork.me',
        },
        resolveRecipientEmail: async () => {
          throw new Error('resolver should not be called')
        },
      },
    )

    expect(beginSend).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({
        subject: "We'd love your feedback",
      }),
      recipients: {
        to: [{ address: 'direct@example.com' }],
      },
    }))
  })

  it('throws when Azure provider is selected without a connection string', async () => {
    await expect(sendEmailMessage(
      {
        to: 'member@example.com',
        subject: 'Test',
        plainText: 'Hello',
      },
      {
        env: {
          EMAIL_PROVIDER: 'azure-communication-services',
          AZURE_COMMUNICATION_SERVICES_EMAIL_FROM: 'no-reply@customereq.wellnessatwork.me',
        },
      },
    )).rejects.toThrow('AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING is required')
  })
})
