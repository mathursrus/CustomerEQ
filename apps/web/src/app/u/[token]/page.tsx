// Issue #420 — public unsubscribe landing page. No auth.
// Routed via the email footer's "Unsubscribe" link (rendered by the worker).
// Calls GET /u/:token to get state, then POST /u/:token/confirm on operator click.

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { API_URL } from '@/lib/config'

type ViewState = 'loading' | 'valid' | 'already-confirmed' | 'invalid' | 'confirmed' | 'error'

export default function UnsubscribePage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [state, setState] = useState<ViewState>('loading')
  const [brandName, setBrandName] = useState<string | undefined>(undefined)
  const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API_URL}/u/${encodeURIComponent(token)}`, { method: 'GET' })
        if (!res.ok) {
          if (!cancelled) setState('error')
          return
        }
        const data = await res.json()
        if (cancelled) return
        setBrandName(data.brandName)
        setState(data.state as ViewState)
      } catch (err) {
        if (!cancelled) {
          setErrorDetail((err as Error).message)
          setState('error')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/u/${encodeURIComponent(token)}/confirm`, {
        method: 'POST',
      })
      if (!res.ok) {
        setState('error')
        setErrorDetail(`Confirm failed (${res.status})`)
        return
      }
      const data = await res.json()
      setState(data.state === 'confirmed' ? 'confirmed' : 'already-confirmed')
    } catch (err) {
      setErrorDetail((err as Error).message)
      setState('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-8 text-center">
      {state === 'loading' && <p className="text-sm text-gray-600">Loading…</p>}

      {state === 'valid' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-900">Unsubscribe from surveys</h1>
          <p className="mt-3 text-sm text-gray-700">
            {brandName ? (
              <>
                You&apos;ll stop receiving survey emails from{' '}
                <strong>{brandName}</strong>.
              </>
            ) : (
              <>You&apos;ll stop receiving survey emails.</>
            )}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            This applies to survey emails only. Other communications (marketing, transactional)
            are managed separately.
          </p>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="mt-6 rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Unsubscribing…' : 'Confirm unsubscribe'}
          </button>
        </>
      )}

      {state === 'confirmed' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-900">Unsubscribed</h1>
          <p className="mt-3 text-sm text-gray-700">
            {brandName ? (
              <>You&apos;ll no longer receive survey emails from <strong>{brandName}</strong>.</>
            ) : (
              <>You&apos;ll no longer receive survey emails.</>
            )}
          </p>
        </>
      )}

      {state === 'already-confirmed' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-900">Already unsubscribed</h1>
          <p className="mt-3 text-sm text-gray-700">
            You previously unsubscribed from survey emails
            {brandName ? <> from <strong>{brandName}</strong></> : null}. No further action needed.
          </p>
        </>
      )}

      {state === 'invalid' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-900">Invalid link</h1>
          <p className="mt-3 text-sm text-gray-700">
            This unsubscribe link is no longer valid. If you keep receiving emails you didn&apos;t
            sign up for, reply to the email and ask to be removed.
          </p>
        </>
      )}

      {state === 'error' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-900">Something went wrong</h1>
          <p className="mt-3 text-sm text-gray-700">
            We couldn&apos;t complete that request. Please try again, or reply to the email.
          </p>
          {errorDetail && <p className="mt-2 text-xs text-gray-500">{errorDetail}</p>}
        </>
      )}
    </main>
  )
}
