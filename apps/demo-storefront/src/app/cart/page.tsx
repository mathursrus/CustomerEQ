'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCart, updateQuantity, removeFromCart, cartTotal, type CartItem } from '@/lib/cart'
import { getPersonaEmail, getPersona } from '@/lib/persona'

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [personaEmail, setPersonaEmail] = useState<string | null>(null)

  useEffect(() => {
    setCart(getCart())
    setPersonaEmail(getPersonaEmail())

    const handler = () => setCart(getCart())
    window.addEventListener('ceq_cart_updated', handler)
    const personaHandler = () => setPersonaEmail(getPersonaEmail())
    window.addEventListener('ceq_persona_changed', personaHandler)
    return () => {
      window.removeEventListener('ceq_cart_updated', handler)
      window.removeEventListener('ceq_persona_changed', personaHandler)
    }
  }, [])

  const persona = getPersona(personaEmail)
  const total = cartTotal(cart)

  function handleCheckout() {
    if (!personaEmail) return
    // Pass persona email and cart to confirm page via query params would be too much data.
    // Cart is in localStorage; persona is in localStorage. Just navigate.
    router.push('/checkout/confirm')
  }

  if (cart.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 text-sm mb-6">Add some drinks from the catalog.</p>
        <Link
          href="/"
          className="inline-block text-sm font-semibold text-white px-5 py-2.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          Browse Menu
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Your Cart</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        {cart.map((item) => (
          <div key={item.id} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{item.name}</p>
              <p className="text-xs text-gray-500">${item.price.toFixed(2)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold leading-none"
                aria-label={`Decrease ${item.name} quantity`}
              >
                −
              </button>
              <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold leading-none"
                aria-label={`Increase ${item.name} quantity`}
              >
                +
              </button>
            </div>
            <p className="text-sm font-semibold text-gray-900 w-14 text-right">
              ${(item.price * item.quantity).toFixed(2)}
            </p>
            <button
              onClick={() => removeFromCart(item.id)}
              className="text-gray-300 hover:text-red-400 transition-colors ml-1"
              aria-label={`Remove ${item.name}`}
            >
              ✕
            </button>
          </div>
        ))}

        <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">Total</span>
          <span className="text-base font-bold text-gray-900" data-testid="cart-total">
            ${total.toFixed(2)}
          </span>
        </div>
      </div>

      {!personaEmail && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
          Select a demo persona from the header to complete checkout.
        </div>
      )}

      {persona && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-100 text-xs text-gray-600">
          Checking out as <strong>{persona.firstName} {persona.lastName}</strong> ({persona.email})
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={!personaEmail}
        className="w-full text-sm font-semibold text-white py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        style={{ backgroundColor: 'var(--brand-primary)' }}
        data-testid="checkout-btn"
      >
        Checkout · ${total.toFixed(2)}
      </button>

      <Link href="/" className="block text-center text-xs text-gray-400 hover:text-gray-600 mt-4">
        ← Continue shopping
      </Link>
    </div>
  )
}
