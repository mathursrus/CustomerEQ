import { describe, it, expect } from 'vitest'
import {
  resolveHeadingSize,
  resolveBodySize,
  resolveBorderRadius,
  resolveMaxWidth,
} from './scale-resolvers'

// Issue #241 Slice 4a — RFC §"BrandTheme to Survey element token mapping"
// scale table. Locks the numeric resolution so designers can change the
// scale once here and trust the renderer to follow.

describe('resolveHeadingSize', () => {
  it.each([
    ['sm', '20px'],
    ['md', '24px'],
    ['lg', '32px'],
  ] as const)('%s → %s', (input, expected) => {
    expect(resolveHeadingSize(input)).toBe(expected)
  })
})

describe('resolveBodySize', () => {
  it.each([
    ['sm', '14px'],
    ['md', '16px'],
    ['lg', '18px'],
  ] as const)('%s → %s', (input, expected) => {
    expect(resolveBodySize(input)).toBe(expected)
  })
})

describe('resolveBorderRadius', () => {
  it.each([
    ['sm', '4px'],
    ['md', '8px'],
    ['lg', '16px'],
  ] as const)('%s → %s', (input, expected) => {
    expect(resolveBorderRadius(input)).toBe(expected)
  })
})

describe('resolveMaxWidth', () => {
  it.each([
    ['sm', '480px'],
    ['md', '640px'],
    ['lg', '800px'],
  ] as const)('%s → %s', (input, expected) => {
    expect(resolveMaxWidth(input)).toBe(expected)
  })
})
