import { vi } from 'vitest'

const sentEmails: Array<{ to: string; subject: string; body: string }> = []

export const mockEmailSend = vi.fn(async (to: string, subject: string, body: string) => {
  sentEmails.push({ to, subject, body })
  return { messageId: `mock_msg_${Date.now()}` }
})

export function assertEmailSent(to?: string): void {
  if (sentEmails.length === 0) {
    throw new Error('Expected at least one email to be sent but none were')
  }
  if (to) {
    const found = sentEmails.some((e) => e.to === to)
    if (!found) {
      throw new Error(`Expected email to be sent to ${to} but got: ${sentEmails.map((e) => e.to).join(', ')}`)
    }
  }
}

export function clearEmailMock(): void {
  sentEmails.length = 0
  mockEmailSend.mockClear()
}

export function getSentEmails() {
  return [...sentEmails]
}
