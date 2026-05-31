// Issue #524 — wizard component tests for the user-testing fixes:
//   F1 — Step 1 (partial coverage) lists ALL detected issues, not just missing.
//   F3 — the file input value resets on change so re-uploading the same
//        filename re-validates.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockGetToken = vi.fn(async () => 'token')
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: mockGetToken }) }))

const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

// Controlled migrations client.
const mockCreate = vi.fn()
const mockPreflight = vi.fn()
const mockSubmitCsv = vi.fn()
vi.mock('@/lib/migrations', () => {
  class MigrationInProgressError extends Error {
    conflict: unknown
    constructor(conflict: unknown) {
      super('in progress')
      this.conflict = conflict
    }
  }
  return {
    createMigration: (...a: unknown[]) => mockCreate(...a),
    getPreflightContext: (...a: unknown[]) => mockPreflight(...a),
    submitMappingCsv: (...a: unknown[]) => mockSubmitCsv(...a),
    submitMappingFromExisting: vi.fn(),
    downloadMappingTemplate: vi.fn(),
    cancelMigration: vi.fn(),
    startMigration: vi.fn(),
    MigrationInProgressError,
  }
})

import { MigrationWizard } from './MigrationWizard'

const FAKE_MIGRATION = { id: 'mig_1', status: 'PENDING_VALIDATION', totalMembers: 0 }

function contextWith(counts: {
  total: number
  withEmail: number
  withoutEmail: number
  collisionGroups: number
  invalidShape: number
}) {
  return { counts, fastPathAvailable: false, impactPreview: [] }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue(FAKE_MIGRATION)
})

describe('MigrationWizard — Step 1 issue summary (F1)', () => {
  it('lists missing, duplicate, and invalid email counts together', async () => {
    mockPreflight.mockResolvedValue(
      contextWith({ total: 6, withEmail: 4, withoutEmail: 2, collisionGroups: 1, invalidShape: 1 }),
    )
    render(<MigrationWizard />)

    // Headline reflects usable-email count.
    expect(await screen.findByText(/4 of 6 members have a usable email/i)).toBeInTheDocument()
    // All three blocking conditions are surfaced, not just missing emails.
    expect(screen.getByText(/missing an email/i)).toBeInTheDocument()
    expect(screen.getByText(/duplicate-email group/i)).toBeInTheDocument()
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
  })

  it('omits issue lines whose count is zero (only missing emails present)', async () => {
    mockPreflight.mockResolvedValue(
      contextWith({ total: 6, withEmail: 5, withoutEmail: 1, collisionGroups: 0, invalidShape: 0 }),
    )
    render(<MigrationWizard />)

    expect(await screen.findByText(/5 of 6 members have a usable email/i)).toBeInTheDocument()
    expect(screen.getByText(/missing an email/i)).toBeInTheDocument()
    expect(screen.queryByText(/duplicate-email group/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument()
  })
})

describe('MigrationWizard — re-upload same filename (F3)', () => {
  it('resets the file input value after an upload so the same file can re-validate', async () => {
    mockPreflight.mockResolvedValue(
      contextWith({ total: 6, withEmail: 5, withoutEmail: 1, collisionGroups: 0, invalidShape: 0 }),
    )
    mockSubmitCsv.mockResolvedValue({
      ok: false,
      counts: { totalRows: 6, membersMatched: 5, unmappedMembers: 1, collisions: 0, invalidShape: 0 },
      rowIssues: [],
    })
    render(<MigrationWizard />)

    // Advance to the upload step.
    fireEvent.click(await screen.findByRole('button', { name: /Next: Upload mapping/i }))

    const input = (await screen.findByLabelText(/Upload your filled mapping/i)) as HTMLInputElement
    const file = new File(['customer_id,new_email\ncust_1,a@b.com\n'], 'mapping.csv', { type: 'text/csv' })

    fireEvent.change(input, { target: { files: [file] } })

    // The fix: the onChange handler clears the input value synchronously, so
    // re-selecting the SAME filename fires onChange again (browsers otherwise
    // suppress a change event when the selected file is unchanged).
    expect(input.value).toBe('')
    // And the upload was kicked off (filename chip rendered).
    await waitFor(() => expect(screen.getByText('mapping.csv')).toBeInTheDocument())
  })
})
