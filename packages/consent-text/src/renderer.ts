import { createElement, type ReactNode } from 'react'
import { segments } from './parser.js'
import { DEFAULT_LABEL_BY_KIND } from './tokens.js'
import type { ConsentTextRenderOptions, ConsentToken } from './types.js'

const DEFAULT_REL = 'noopener noreferrer'
const DEFAULT_TARGET = '_blank'

// Defense-in-depth: regex-level allowlist already excludes " < > } { in token
// labels, but plain-text segments and consumer-supplied URLs are unconstrained.
// Every assembled-string position is escaped before concatenation.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function urlForToken(
  token: ConsentToken,
  options: ConsentTextRenderOptions,
): string {
  const url = token.kind === 'privacy' ? options.privacyPolicyUrl : options.termsUrl
  return url ?? ''
}

function labelForToken(token: ConsentToken): string {
  return token.customLabel ?? DEFAULT_LABEL_BY_KIND[token.kind]
}

export function renderConsentTextHTML(
  text: string,
  options: ConsentTextRenderOptions = {},
): string {
  const rel = options.rel ?? DEFAULT_REL
  const target = options.target ?? DEFAULT_TARGET
  const { className, brokenClassName } = options
  const parts: string[] = []
  for (const segment of segments(text)) {
    if (segment.type === 'text') {
      parts.push(escapeHtml(segment.text))
      continue
    }
    const url = urlForToken(segment.token, options)
    const label = labelForToken(segment.token)
    const broken = url === ''
    const attrs: string[] = []
    if (!broken) {
      attrs.push(
        `href="${escapeHtml(url)}"`,
        `target="${escapeHtml(target)}"`,
        `rel="${escapeHtml(rel)}"`,
      )
    }
    const cls = broken ? brokenClassName : className
    if (cls !== undefined) {
      attrs.push(`class="${escapeHtml(cls)}"`)
    }
    parts.push(`<a${attrs.length ? ' ' + attrs.join(' ') : ''}>${escapeHtml(label)}</a>`)
  }
  return parts.join('')
}

export function renderConsentTextReact(
  text: string,
  options: ConsentTextRenderOptions = {},
): ReactNode[] {
  const rel = options.rel ?? DEFAULT_REL
  const target = options.target ?? DEFAULT_TARGET
  const { className, brokenClassName } = options
  const out: ReactNode[] = []
  let key = 0
  for (const segment of segments(text)) {
    if (segment.type === 'text') {
      out.push(segment.text)
      continue
    }
    const url = urlForToken(segment.token, options)
    const label = labelForToken(segment.token)
    const broken = url === ''
    // Broken anchors omit href entirely so the browser doesn't resolve
    // empty-string href against the current document URL (which would
    // make the link appear to navigate to itself).
    const props: Record<string, string | undefined> = broken
      ? { className: brokenClassName, title: 'Link not configured' }
      : { href: url, target, rel, className }
    out.push(
      createElement(
        'a',
        { key: `consent-${key++}`, ...props },
        // String children — React auto-escapes; the unsafe HTML-injection prop is not used.
        label,
      ),
    )
  }
  return out
}
