import { NextRequest, NextResponse } from 'next/server'
import type { CartItem } from '@/lib/cart'

const API_URL = process.env.DEMO_API_URL ?? 'http://localhost:4000'
const BRAND_ID = process.env.DEMO_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'

const TEST_HEADERS = {
  'Content-Type': 'application/json',
  'X-Test-Brand-Id': BRAND_ID,
  'X-Test-User-Id': 'demo-admin',
}

interface CheckoutBody {
  email: string
  items: CartItem[]
}

export interface CheckoutResult {
  orderId: string
  amount: number
  pointsEarned: number
  memberId: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json() as CheckoutBody
  const { email, items } = body

  if (!email || !items?.length) {
    return NextResponse.json({ error: 'email and items required' }, { status: 400 })
  }

  // Look up member by email
  const memberRes = await fetch(
    `${API_URL}/v1/members?q=${encodeURIComponent(email)}&pageSize=1`,
    { headers: TEST_HEADERS },
  )
  if (!memberRes.ok) {
    return NextResponse.json({ error: 'Member lookup failed' }, { status: 500 })
  }
  const memberBody = await memberRes.json() as { data: Array<{ id: string }> }
  const member = memberBody.data?.[0]
  if (!member) {
    return NextResponse.json({ error: 'Member not found — run pnpm seed:demo first' }, { status: 404 })
  }

  const amount = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const orderId = `CEQ-${Date.now().toString(36).toUpperCase()}`

  const eventRes = await fetch(`${API_URL}/v1/events`, {
    method: 'POST',
    headers: TEST_HEADERS,
    body: JSON.stringify({
      eventType: 'purchase',
      memberId: member.id,
      payload: {
        orderId,
        amount: Math.round(amount * 100) / 100,
        currency: 'USD',
        items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
        channel: 'online',
      },
      idempotencyKey: `demo-checkout-${orderId}`,
    }),
  })

  if (!eventRes.ok) {
    const err = await eventRes.json().catch(() => ({})) as { message?: string }
    return NextResponse.json(
      { error: err.message ?? 'Failed to record purchase event' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    orderId,
    amount: Math.round(amount * 100) / 100,
    pointsEarned: 500,
    memberId: member.id,
  } satisfies CheckoutResult)
}
