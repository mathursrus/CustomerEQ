import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import {
  MustacheSuggestionList,
  filterMustacheTokens,
} from './MustacheSuggestionList'

describe('filterMustacheTokens', () => {
  it('returns the full palette when query is empty', () => {
    expect(filterMustacheTokens('')).toHaveLength(6)
  })

  it('matches by token id substring (case-insensitive)', () => {
    const results = filterMustacheTokens('NAME')
    const ids = results.map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining(['first_name', 'last_name', 'brand_name', 'sender_name']))
    expect(ids).not.toContain('survey_link')
  })

  it('matches by token label substring', () => {
    const results = filterMustacheTokens('survey')
    const ids = results.map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining(['survey_link', 'survey_title']))
  })

  it('returns empty array when nothing matches', () => {
    expect(filterMustacheTokens('zzzzzz')).toHaveLength(0)
  })
})

describe('<MustacheSuggestionList>', () => {
  it('renders every passed item as an option button with the {{id}} chip', () => {
    render(
      <MustacheSuggestionList
        items={[
          {
            id: 'survey_link',
            label: 'Survey link',
            description: 'per-recipient',
            required: true,
          },
          { id: 'first_name', label: 'First name', description: 'recipient first name' },
        ]}
        command={() => undefined}
      />,
    )
    expect(screen.getByRole('listbox', { name: /mustache token palette/i })).toBeInTheDocument()
    expect(screen.getByText('{{survey_link}}')).toBeInTheDocument()
    expect(screen.getByText('{{first_name}}')).toBeInTheDocument()
    expect(screen.getByText(/required/i)).toBeInTheDocument()
  })

  it('renders an empty-state notice when no items match', () => {
    render(<MustacheSuggestionList items={[]} command={() => undefined} />)
    expect(screen.getByText(/no matching tokens/i)).toBeInTheDocument()
  })

  it('fires command(id,label) when an option is clicked', () => {
    const command = vi.fn()
    render(
      <MustacheSuggestionList
        items={[{ id: 'brand_name', label: 'Brand name', description: 'd' }]}
        command={command}
      />,
    )
    fireEvent.click(screen.getByRole('option', { name: /brand_name/ }))
    expect(command).toHaveBeenCalledTimes(1)
    expect(command).toHaveBeenCalledWith({ id: 'brand_name', label: 'Brand name' })
  })

  it('marks the first option active on mount via aria-selected', () => {
    render(
      <MustacheSuggestionList
        items={[
          { id: 'survey_link', label: 'Survey link', description: 'd' },
          { id: 'first_name', label: 'First name', description: 'd' },
        ]}
        command={() => undefined}
      />,
    )
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
  })
})
