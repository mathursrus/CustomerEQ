'use client'

import { useState } from 'react'
import { PRODUCTS } from '@/lib/products'
import { ProductCard } from '@/components/ProductCard'

const BRAND_NAME = process.env.NEXT_PUBLIC_DEMO_BRAND_NAME ?? 'Demo Brand'

export default function CatalogPage() {
  const [toastProduct, setToastProduct] = useState<string | null>(null)

  function handleAdded(name: string) {
    setToastProduct(name)
    setTimeout(() => setToastProduct(null), 2000)
  }

  const drinks = PRODUCTS.filter((p) => p.category === 'drink')
  const food = PRODUCTS.filter((p) => p.category === 'food')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{BRAND_NAME}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Order ahead, earn StarPoints, and redeem rewards.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Drinks
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {drinks.map((p) => (
            <ProductCard key={p.id} product={p} onAdded={() => handleAdded(p.name)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Food
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {food.map((p) => (
            <ProductCard key={p.id} product={p} onAdded={() => handleAdded(p.name)} />
          ))}
        </div>
      </section>

      {toastProduct && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 animate-fade-in"
          role="status"
          aria-live="polite"
        >
          ✓ {toastProduct} added to cart
        </div>
      )}
    </div>
  )
}
