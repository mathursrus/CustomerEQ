export interface Product {
  id: string
  name: string
  description: string
  price: number
  category: 'drink' | 'food'
  emoji: string
}

export const PRODUCTS: Product[] = [
  {
    id: 'tall-drip',
    name: 'Tall Drip Coffee',
    description: 'Our signature dark roast, rich and smooth.',
    price: 2.75,
    category: 'drink',
    emoji: '☕',
  },
  {
    id: 'oat-latte',
    name: 'Oat Milk Latte',
    description: 'Velvety oat milk with a double shot of espresso.',
    price: 5.25,
    category: 'drink',
    emoji: '🥛',
  },
  {
    id: 'cold-brew',
    name: 'Cold Brew',
    description: 'Slow-steeped for 20 hours, served over ice.',
    price: 4.50,
    category: 'drink',
    emoji: '🧊',
  },
  {
    id: 'caramel-macchiato',
    name: 'Caramel Macchiato',
    description: 'Espresso layered with vanilla syrup and caramel drizzle.',
    price: 5.75,
    category: 'drink',
    emoji: '🍮',
  },
  {
    id: 'matcha-latte',
    name: 'Matcha Latte',
    description: 'Ceremonial-grade matcha with steamed oat milk.',
    price: 5.50,
    category: 'drink',
    emoji: '🍵',
  },
  {
    id: 'blueberry-muffin',
    name: 'Blueberry Muffin',
    description: 'Baked fresh daily with wild blueberries.',
    price: 3.25,
    category: 'food',
    emoji: '🫐',
  },
]
