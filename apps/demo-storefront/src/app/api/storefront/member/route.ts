import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.DEMO_API_URL ?? 'http://localhost:4000'
const BRAND_ID = process.env.DEMO_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'
const API_KEY = process.env.DEMO_API_KEY

const TEST_HEADERS: Record<string, string> = API_KEY
  ? { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY }
  : { 'Content-Type': 'application/json', 'X-Test-Brand-Id': BRAND_ID, 'X-Test-User-Id': 'demo-admin' }

export interface MemberData {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  pointsBalance: number
  tier: string | null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email query param required' }, { status: 400 })
  }

  const res = await fetch(
    `${API_URL}/v1/members?q=${encodeURIComponent(email)}&pageSize=1`,
    { headers: TEST_HEADERS },
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Member lookup failed' }, { status: res.status })
  }

  const body = await res.json() as { data: MemberData[] }
  const member = body.data?.[0] ?? null

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  return NextResponse.json(member)
}
