'use client'

import { addToCart } from '@/lib/cart'
import type { Product } from '@/lib/products'

interface Props {
  product: Product
  onAdded?: () => void
}

export function ProductCard({ product, onAdded }: Props) {
  function handleAdd() {
    addToCart({ id: product.id, name: product.name, price: product.price })
    onAdded?.()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="text-4xl text-center py-2">{product.emoji}</div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{product.description}</p>
      </div>
      <div className="flex items-center justify-between mt-auto">
        <span className="font-bold text-gray-900">${product.price.toFixed(2)}</span>
        <button
          onClick={handleAdd}
          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          style={{ backgroundColor: 'var(--brand-primary)' }}
          aria-label={`Add ${product.name} to cart`}
          data-testid={`add-to-cart-${product.id}`}
        >
          Add to cart
        </button>
      </div>
    </div>
  )
}
