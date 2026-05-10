'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { getPersonaEmail } from '@/lib/persona'

export function SupportChat() {
  const [email, setEmail] = useState('')
  const chatEl = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setEmail(getPersonaEmail() ?? '')
    const handler = () => setEmail(getPersonaEmail() ?? '')
    window.addEventListener('ceq_persona_changed', handler)
    return () => window.removeEventListener('ceq_persona_changed', handler)
  }, [])

  // Sync token attribute whenever persona changes
  useEffect(() => {
    if (chatEl.current) chatEl.current.setAttribute('token', email)
  }, [email])

  function handleLoad() {
    if (chatEl.current) return // already mounted
    const el = document.createElement('ceq-support-chat')
    el.setAttribute('api-base', '')
    el.setAttribute('brand-id', '')
    el.setAttribute('token', getPersonaEmail() ?? '')
    el.style.setProperty('--ceq-primary-color', '#00704A')
    document.body.appendChild(el)
    chatEl.current = el
  }

  return (
    <Script
      src="/ceq-support-chat.js"
      strategy="afterInteractive"
      onLoad={handleLoad}
    />
  )
}
