'use client'

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

const CART_KEY = 'ceq_demo_cart'

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as CartItem[]
  } catch {
    return []
  }
}

export function addToCart(item: Omit<CartItem, 'quantity'>): void {
  const cart = getCart()
  const existing = cart.find((i) => i.id === item.id)
  if (existing) {
    existing.quantity += 1
  } else {
    cart.push({ ...item, quantity: 1 })
  }
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  window.dispatchEvent(new Event('ceq_cart_updated'))
}

export function removeFromCart(id: string): void {
  const cart = getCart().filter((i) => i.id !== id)
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  window.dispatchEvent(new Event('ceq_cart_updated'))
}

export function updateQuantity(id: string, quantity: number): void {
  if (quantity <= 0) {
    removeFromCart(id)
    return
  }
  const cart = getCart().map((i) => (i.id === id ? { ...i, quantity } : i))
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  window.dispatchEvent(new Event('ceq_cart_updated'))
}

export function clearCart(): void {
  localStorage.removeItem(CART_KEY)
  window.dispatchEvent(new Event('ceq_cart_updated'))
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
}

export function cartCount(cart: CartItem[]): number {
  return cart.reduce((sum, i) => sum + i.quantity, 0)
}
