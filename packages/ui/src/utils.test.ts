import { describe, it, expect } from 'vitest'
import { cn } from './utils.js'

describe('cn — Tailwind class name merging', () => {
  it('merges simple class strings', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles conditional classes via clsx object syntax', () => {
    expect(cn('base', { 'text-red-500': true, 'text-blue-500': false })).toBe('base text-red-500')
  })

  it('handles undefined and null inputs', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra')
  })

  it('handles empty string input', () => {
    expect(cn('')).toBe('')
  })

  it('handles no arguments', () => {
    expect(cn()).toBe('')
  })

  it('merges responsive variants correctly', () => {
    const result = cn('text-sm', 'md:text-lg')
    expect(result).toContain('text-sm')
    expect(result).toContain('md:text-lg')
  })
})
