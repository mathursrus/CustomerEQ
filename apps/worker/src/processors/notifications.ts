import type { Job } from 'bullmq'
import type { NotificationPayload } from '@customerEQ/shared'

// ---------------------------------------------------------------------------
// Test spy — importable in vitest suites via vi.spyOn or direct mock replacement.
//
// This is a plain function reference; in tests, import and wrap with vi.fn():
//   vi.mock('../processors/notifications.js', async (importActual) => {
//     const mod = await importActual<typeof import('../processors/notifications.js')>()
//     return { ...mod, mockEmailSend: vi.fn() }
//   })
//
// Or simply import mockEmailSend and reassign in beforeEach.
// ---------------------------------------------------------------------------

type EmailSendPayload = { to: string; subject: string; body: string }

// Default no-op implementation replaced by tests with vi.fn()
export const mockEmailSend: (payload: EmailSendPayload) => Promise<void> = async (_payload) => {
  // no-op stub — replaced in test environments
}

// ---------------------------------------------------------------------------
// BullMQ processor
// ---------------------------------------------------------------------------

export async function processNotification(job: Job<NotificationPayload>): Promise<{
  sent: boolean
  reason?: string
  memberId: string
  channel: string
}> {
  const { memberId, brandId, message, channel } = job.data

  // MVP stub: log the notification (real email provider integration in post-MVP)
  // In production, use process.env.EMAIL_PROVIDER to route to SendGrid/Resend
  if (process.env.EMAIL_PROVIDER === 'stub' || !process.env.EMAIL_PROVIDER) {
    // Stub: just log. Return success.
    return { sent: false, reason: 'stub_provider', memberId, channel }
  }

  // Future: implement real email send
  return { sent: true, memberId, channel }
}
