import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConsentDisclosure } from './ConsentDisclosure'

// Issue #241 Slice 4a — R12 / R13 / R14 contract:
// - Renders the consent paragraph with privacy / terms links when tokens are
//   present in the text.
// - Returns null (renders nothing) when both the survey override and brand
//   default are blank.

describe('<ConsentDisclosure>', () => {
  it('renders the privacy and terms links when both tokens are present', () => {
    render(
      <ConsentDisclosure
        text='I agree to the {{privacy:"Privacy Policy"}} and {{terms:"Terms"}}.'
        privacyPolicyUrl="https://example.com/privacy"
        termsUrl="https://example.com/terms"
      />,
    )
    const privacy = screen.getByRole('link', { name: 'Privacy Policy' })
    expect(privacy).toBeInTheDocument()
    expect(privacy).toHaveAttribute('href', 'https://example.com/privacy')

    const terms = screen.getByRole('link', { name: 'Terms' })
    expect(terms).toBeInTheDocument()
    expect(terms).toHaveAttribute('href', 'https://example.com/terms')
  })

  it('renders the privacy link but no terms link when termsUrl is null', () => {
    render(
      <ConsentDisclosure
        text='Agree to {{privacy:"Privacy Policy"}}.'
        privacyPolicyUrl="https://example.com/privacy"
        termsUrl={null}
      />,
    )
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', 'https://example.com/privacy')
    expect(screen.queryByRole('link', { name: 'Terms' })).toBeNull()
  })

  it('returns null (renders nothing visible) when text is empty per R13', () => {
    const { container } = render(
      <ConsentDisclosure text="" privacyPolicyUrl={null} termsUrl={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('returns null when text is whitespace-only per R13', () => {
    const { container } = render(
      <ConsentDisclosure text="   " privacyPolicyUrl={null} termsUrl={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
