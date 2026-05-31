'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  /** Wrapper element. Defaults to a <div>. */
  as?: ElementType
  className?: string
  /** Stagger entrance by this many ms after the element scrolls into view. */
  delay?: number
}

/**
 * Scroll-triggered entrance animation.
 *
 * Renders hidden (faded + nudged down) until it scrolls into the viewport,
 * then animates into place once via IntersectionObserver. Falls back to
 * fully-visible immediately when:
 *   - the user prefers reduced motion, or
 *   - IntersectionObserver is unavailable (SSR / old browsers).
 *
 * The animation itself lives in globals.css (.reveal / .reveal-visible) so the
 * initial hidden state is applied during SSR and there is no flash of
 * unstyled (already-visible) content before hydration.
 */
export function Reveal({ children, as, className = '', delay = 0 }: RevealProps) {
  const Tag = as ?? 'div'
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
