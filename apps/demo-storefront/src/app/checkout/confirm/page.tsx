'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCart, clearCart, type CartItem } from '@/lib/cart'
import { getPersonaEmail } from '@/lib/persona'
import type { CheckoutResult } from '@/app/api/storefront/checkout/route'

type State =
  | { phase: 'processing' }
  | { phase: 'success'; result: CheckoutResult; items: CartItem[] }
  | { phase: 'error'; message: string }

export default function CheckoutConfirmPage() {
  const [state, setState] = useState<State>({ phase: 'processing' })

  useEffect(() => {
    async function runCheckout() {
      const email = getPersonaEmail()
      const items = getCart()

      if (!email || items.length === 0) {
        setState({ phase: 'error', message: 'No active persona or empty cart. Go back and try again.' })
        return
      }

      try {
        const res = await fetch('/api/storefront/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, items }),
        })

        const data = await res.json() as CheckoutResult & { error?: string }

        if (!res.ok) {
          setState({ phase: 'error', message: data.error ?? 'Checkout failed. Check that pnpm seed:demo has been run.' })
          return
        }

        clearCart()
        window.dispatchEvent(new Event('ceq_purchase_recorded'))
        setState({ phase: 'success', result: data, items })
      } catch {
        setState({ phase: 'error', message: 'Network error. Is the API running?' })
      }
    }

    void runCheckout()
  }, [])

  if (state.phase === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--brand-primary)' }} />
        <p className="text-sm text-gray-500">Processing your order…</p>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-red-600 mb-6">{state.message}</p>
        <Link href="/cart" className="text-sm font-semibold underline text-gray-600">
          ← Back to cart
        </Link>
      </div>
    )
  }

  const { result, items } = state

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center mb-6">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-4"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          ✓
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Order placed!</h1>
        <p className="text-sm text-gray-500 mb-4">
          Order <span className="font-mono font-semibold text-gray-700" data-testid="order-id">{result.orderId}</span>
        </p>

        <div
          className="rounded-lg p-3 mb-4 text-sm font-semibold"
          style={{ backgroundColor: '#f0faf5', color: 'var(--brand-primary)' }}
          data-testid="points-earned"
        >
          +{result.pointsEarned.toLocaleString()} StarPoints earned! ☕
        </div>

        <div className="text-left space-y-1 mb-4">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-gray-600">
              <span>{item.quantity}× {item.name}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100 mt-2">
            <span>Total</span>
            <span>${result.amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 mb-6">
        <p className="font-semibold mb-1">Demo tip: watch the pipeline</p>
        <p className="text-xs leading-relaxed">
          A <code>purchase</code> event was just fired to the CustomerEQ API.
          Check the <a href="http://localhost:3000/admin" className="underline font-medium" target="_blank" rel="noreferrer">admin dashboard</a> to
          see loyalty points accumulate in real time.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/"
          className="flex-1 text-center text-sm font-semibold text-white py-2.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--brand-primary)' }}
          data-testid="continue-shopping-link"
        >
          Continue shopping
        </Link>
        <Link
          href="/account"
          className="flex-1 text-center text-sm font-semibold text-gray-700 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          View my points
        </Link>
      </div>
    </div>
  )
}
