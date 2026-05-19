// Issue #241 Slice 4b (#336) — DiscardDraftModal RTL.
//
// Coverage per spec §5 + #333:
//   - Confirmation wires to DELETE /v1/surveys/:id.
//   - Cancel closes without firing the delete.
//   - Success redirects to /admin/surveys (parent decides; we assert
//     onDiscarded callback fires).
//   - HTTP 4xx surfaces inline (modal stays open with the error).

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DiscardDraftModal } from './DiscardDraftModal'

const SURVEY_ID = 'srv_test_4b_discard'

function setup(opts: {
  open?: boolean
  deleteFn?: (id: string) => Promise<Response>
  onDiscarded?: () => void
  onClose?: () => void
} = {}) {
  const deleteFn = opts.deleteFn ?? vi.fn(async () => new Response(null, { status: 204 }))
  const onDiscarded = opts.onDiscarded ?? vi.fn()
  const onClose = opts.onClose ?? vi.fn()
  render(
    <DiscardDraftModal
      open={opts.open ?? true}
      surveyId={SURVEY_ID}
      surveyName="Untitled survey"
      deleteSurvey={deleteFn}
      onDiscarded={onDiscarded}
      onClose={onClose}
    />,
  )
  return { deleteFn, onDiscarded, onClose }
}

describe('<DiscardDraftModal>', () => {
  it('does not render when open=false', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog naming the survey being discarded', () => {
    setup()
    expect(screen.getByRole('dialog')).toHaveTextContent('Untitled survey')
  })

  it('confirm calls deleteSurvey with the survey id, then fires onDiscarded', async () => {
    const deleteFn = vi.fn(async () => new Response(null, { status: 204 }))
    const onDiscarded = vi.fn()
    setup({ deleteFn, onDiscarded })
    fireEvent.click(screen.getByRole('button', { name: /discard|delete/i }))
    await screen.findByRole('dialog')
    expect(deleteFn).toHaveBeenCalledWith(SURVEY_ID)
    expect(onDiscarded).toHaveBeenCalledOnce()
  })

  it('cancel closes the modal without calling deleteSurvey', () => {
    const deleteFn = vi.fn()
    const onClose = vi.fn()
    setup({ deleteFn, onClose })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(deleteFn).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('HTTP failure surfaces inline (modal stays open)', async () => {
    const deleteFn = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'Cannot delete an active survey' }), { status: 409 }),
    )
    setup({ deleteFn })
    fireEvent.click(screen.getByRole('button', { name: /discard|delete/i }))
    expect(await screen.findByTestId('discard-error')).toHaveTextContent(
      /cannot delete an active survey/i,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
