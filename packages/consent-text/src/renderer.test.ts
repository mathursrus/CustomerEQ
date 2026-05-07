import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderConsentTextHTML, renderConsentTextReact } from './renderer.js'

const RENDERER_SOURCE = readFileSync(
  fileURLToPath(new URL('./renderer.ts', import.meta.url)),
  'utf8',
)

describe('renderer source — defense-in-depth (R18)', () => {
  it('does not contain the substring "innerHTML" anywhere', () => {
    // RFC §3 explicit safety contract: the renderer must never use innerHTML.
    expect(RENDERER_SOURCE).not.toMatch(/innerHTML/)
  })

  it('does not contain the substring "dangerouslySetInnerHTML" anywhere', () => {
    expect(RENDERER_SOURCE).not.toMatch(/dangerouslySetInnerHTML/)
  })

  it('does not contain "document.write"', () => {
    expect(RENDERER_SOURCE).not.toMatch(/document\.write/)
  })
})

describe('renderConsentTextHTML', () => {
  it('returns the input verbatim (no tokens) when there are no tokens', () => {
    expect(renderConsentTextHTML('hello world')).toBe('hello world')
  })

  it('returns empty string for empty input', () => {
    expect(renderConsentTextHTML('')).toBe('')
  })

  it('replaces {{privacy}} with an <a> using the default label', () => {
    const html = renderConsentTextHTML('See our {{privacy}}.', {
      privacyPolicyUrl: 'https://example.com/privacy',
    })
    expect(html).toContain('<a ')
    expect(html).toContain('href="https://example.com/privacy"')
    expect(html).toContain('>Privacy Policy</a>')
  })

  it('replaces {{terms}} with an <a> using the default label', () => {
    const html = renderConsentTextHTML('Read {{terms}}.', {
      termsUrl: 'https://example.com/terms',
    })
    expect(html).toContain('href="https://example.com/terms"')
    expect(html).toContain('>Terms and Conditions</a>')
  })

  it('uses the explicit customLabel when present', () => {
    const html = renderConsentTextHTML('See our {{privacy:"my notice"}}.', {
      privacyPolicyUrl: 'https://example.com/p',
    })
    expect(html).toContain('>my notice</a>')
  })

  it('HTML-escapes ampersands in plain-text segments', () => {
    const html = renderConsentTextHTML('A & B')
    expect(html).toBe('A &amp; B')
  })

  it('HTML-escapes < and > in plain-text segments (defense-in-depth)', () => {
    const html = renderConsentTextHTML('Read 1 < 2 > 0')
    expect(html).not.toContain('<')
    expect(html).not.toContain('>')
    expect(html).toContain('&lt;')
    expect(html).toContain('&gt;')
  })

  it('HTML-escapes ampersand inside a customLabel (defense-in-depth even though regex already excludes < > " { })', () => {
    const html = renderConsentTextHTML('See {{privacy:"R&D Policy"}}.', {
      privacyPolicyUrl: 'https://example.com/p',
    })
    expect(html).toContain('R&amp;D Policy')
    expect(html).not.toContain('R&D Policy')
  })

  it('HTML-escapes the URL when assembling the href attribute', () => {
    // The URL itself is consumer-supplied and may contain & in query strings;
    // we must escape it for HTML attribute context.
    const html = renderConsentTextHTML('See {{privacy}}.', {
      privacyPolicyUrl: 'https://example.com/p?a=1&b=2',
    })
    expect(html).toContain('href="https://example.com/p?a=1&amp;b=2"')
  })

  it('renders an empty href when no URL is provided', () => {
    const html = renderConsentTextHTML('See {{privacy}}.')
    expect(html).toContain('href=""')
  })

  it('emits rel="noopener noreferrer" by default', () => {
    const html = renderConsentTextHTML('See {{privacy}}.', {
      privacyPolicyUrl: 'https://example.com/p',
    })
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('respects a custom rel option', () => {
    const html = renderConsentTextHTML('See {{privacy}}.', {
      privacyPolicyUrl: 'https://example.com/p',
      rel: 'nofollow',
    })
    expect(html).toContain('rel="nofollow"')
    expect(html).not.toContain('rel="noopener noreferrer"')
  })

  it('emits target="_blank" by default and respects override', () => {
    expect(
      renderConsentTextHTML('See {{privacy}}.', {
        privacyPolicyUrl: 'https://example.com/p',
      }),
    ).toContain('target="_blank"')
    expect(
      renderConsentTextHTML('See {{privacy}}.', {
        privacyPolicyUrl: 'https://example.com/p',
        target: '_self',
      }),
    ).toContain('target="_self"')
  })

  it('attaches a className when provided', () => {
    const html = renderConsentTextHTML('See {{privacy}}.', {
      privacyPolicyUrl: 'https://example.com/p',
      className: 'consent-link',
    })
    expect(html).toContain('class="consent-link"')
  })
})

describe('renderConsentTextReact', () => {
  it('returns an empty array for empty input', () => {
    expect(renderConsentTextReact('')).toEqual([])
  })

  it('returns a single string node for token-free input', () => {
    const nodes = renderConsentTextReact('hello world')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toBe('hello world')
  })

  it('returns interleaved string + element nodes', () => {
    const nodes = renderConsentTextReact('See {{privacy}}.', {
      privacyPolicyUrl: 'https://example.com/p',
    })
    expect(nodes).toHaveLength(3)
    expect(nodes[0]).toBe('See ')
    expect(typeof nodes[1]).toBe('object')
    expect(nodes[2]).toBe('.')
  })

  it('renders the anchor with default label and the supplied URL', () => {
    const nodes = renderConsentTextReact('{{privacy}}', {
      privacyPolicyUrl: 'https://example.com/p',
    })
    const anchor = nodes[0] as { type: string; props: { href: string; children: string } }
    expect(anchor.type).toBe('a')
    expect(anchor.props.href).toBe('https://example.com/p')
    expect(anchor.props.children).toBe('Privacy Policy')
  })

  it('renders the anchor with the explicit customLabel when provided', () => {
    const nodes = renderConsentTextReact('{{privacy:"my notice"}}', {
      privacyPolicyUrl: 'https://example.com/p',
    })
    const anchor = nodes[0] as { props: { children: string } }
    expect(anchor.props.children).toBe('my notice')
  })

  it('passes rel + target on rendered anchor by default', () => {
    const nodes = renderConsentTextReact('{{privacy}}', {
      privacyPolicyUrl: 'https://example.com/p',
    })
    const anchor = nodes[0] as { props: { rel: string; target: string } }
    expect(anchor.props.rel).toBe('noopener noreferrer')
    expect(anchor.props.target).toBe('_blank')
  })

  it('does NOT use dangerouslySetInnerHTML on rendered anchors (children is a string)', () => {
    const nodes = renderConsentTextReact('{{privacy}}', {
      privacyPolicyUrl: 'https://example.com/p',
    })
    const anchor = nodes[0] as { props: Record<string, unknown> }
    expect(anchor.props.dangerouslySetInnerHTML).toBeUndefined()
    expect(typeof anchor.props.children).toBe('string')
  })
})
