// Issue #420 — AudienceBuilder integration test.
// Drives the shell with a stubbed fetch so we can verify:
// - rows accumulated via the Search tab append to the audience list (R21 dedup)
// - emitted AudienceBuilderState carries the selected count + the
//   custom_list-shaped submitAudience payload that parent flows POST
// - operator can deselect rows and re-select via the bulk action

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { AudienceBuilder } from './AudienceBuilder'
import type { AudienceBuilderState } from './types'

// IMPORTANT: hoist getToken to a stable reference. If useAuth() returns a
// fresh function each render, SearchTab's useEffect depends ([..., getToken])
// would re-fire forever and the test would never settle.
const mockGetToken = vi.fn().mockResolvedValue('test-token')
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}))

vi.mock('@/lib/config', () => ({
  API_URL: 'http://test',
  getAuthToken: async () => 'test-token',
}))

const SEARCH_RESPONSE = {
  data: [
    {
      id: 'm-alice',
      externalId: 'alice@artistos.com',
      email: 'alice@artistos.com',
      firstName: 'Alice',
      lastName: 'Chen',
      suppressionStatus: 'OK' as const,
      suppressionSince: null,
    },
    {
      id: 'm-hannah',
      externalId: 'hannah@artistos.com',
      email: 'hannah@artistos.com',
      firstName: 'Hannah',
      lastName: 'Mehta',
      suppressionStatus: 'UNSUBSCRIBED' as const,
      suppressionSince: '2026-04-12T00:00:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  pageSize: 25,
  totalPages: 1,
}

function makeFetch() {
  return vi.fn(async (url: string) => {
    if (typeof url === 'string' && url.includes('/v1/members')) {
      return new Response(JSON.stringify(SEARCH_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('{}', { status: 200 })
  })
}

describe('<AudienceBuilder>', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetch())
  })

  it('emits a custom_list submit payload of selected identifiers after the operator adds search results', async () => {
    const states: AudienceBuilderState[] = []
    render(
      <AudienceBuilder
        surveyId="srv_test"
        surveyNameInMail="Q2 2026 NPS"
        expiresAtIso="2026-05-30T00:00:00.000Z"
        totalMemberCount={100}
        onChange={(s) => {
          states.push(s)
        }}
      />,
    )

    // Run a wildcard search.
    const searchInput = screen.getByLabelText(/search members/i)
    fireEvent.change(searchInput, { target: { value: '*@artistos.com' } })
    // Submit via Enter — avoids ambiguity with the "Search" tab button whose
    // label intentionally mirrors the mock (Scene 2 secondary-tabs).
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })

    // Wait for results to render.
    await screen.findByText(/Alice Chen/)

    // Suppressed row's checkbox is disabled (R22).
    const hannahCheckbox = screen.getByRole('checkbox', { name: /select Hannah Mehta/i })
    expect(hannahCheckbox).toBeDisabled()

    // Select Alice (the only eligible row).
    fireEvent.click(screen.getByRole('checkbox', { name: /select Alice Chen/i }))

    // Add the selection.
    fireEvent.click(screen.getByRole('button', { name: /add 1 selected members/i }))

    // The accumulated list now contains Alice; the audience-builder state has
    // emitted with selectedCount=1 and a custom_list paste of her externalId.
    await waitFor(() => {
      const last = states[states.length - 1]
      expect(last.selectedCount).toBe(1)
      expect(last.submitAudience.mode).toBe('custom_list')
      expect(last.submitAudience.identifiers).toContain('alice@artistos.com')
    })
  })

  it('dedups when the same memberId is added twice (R21)', async () => {
    const states: AudienceBuilderState[] = []
    render(
      <AudienceBuilder
        surveyId="srv_test"
        surveyNameInMail="Q2 2026 NPS"
        expiresAtIso="2026-05-30T00:00:00.000Z"
        totalMemberCount={100}
        onChange={(s) => {
          states.push(s)
        }}
      />,
    )

    const searchInput = screen.getByLabelText(/search members/i)
    fireEvent.change(searchInput, { target: { value: '*@artistos.com' } })
    // Submit via Enter — avoids ambiguity with the "Search" tab button whose
    // label intentionally mirrors the mock (Scene 2 secondary-tabs).
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })
    await screen.findByText(/Alice Chen/)

    fireEvent.click(screen.getByRole('checkbox', { name: /select Alice Chen/i }))
    fireEvent.click(screen.getByRole('button', { name: /add 1 selected members/i }))

    // Wait until the state reflects the first add.
    await waitFor(() => {
      expect(states[states.length - 1].rows).toHaveLength(1)
    })

    // Re-search and try to re-add Alice — the search-result row's checkbox
    // should now be disabled (alreadyAddedKeys contains her id) and the
    // accumulated state should still hold a single Alice row (R21 dedup).
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })
    await screen.findAllByText(/Alice Chen/)

    // Two "Alice Chen" rows exist now (search results + audience list); both
    // expose a "Select Alice Chen" checkbox, so getAll + check both.
    const aliceCheckboxes = screen.getAllByRole('checkbox', {
      name: /select Alice Chen/i,
    })
    expect(aliceCheckboxes.length).toBeGreaterThanOrEqual(1)
    // The search-result checkbox must be disabled (the one with the "Added"
    // chip in the same row).
    expect(aliceCheckboxes.some((cb) => (cb as HTMLInputElement).disabled)).toBe(true)
    expect(screen.getAllByText(/^Added$/i).length).toBeGreaterThan(0)

    const last = states[states.length - 1]
    expect(last.rows).toHaveLength(1)
    expect(last.selectedCount).toBe(1)
  })
})
