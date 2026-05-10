import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.DEMO_API_URL ?? 'http://localhost:4000'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get('authorization')
  const body = await request.text()

  const res = await fetch(`${API_URL}/v1/public/support/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body,
  })

  const data = await res.json() as unknown
  return NextResponse.json(data, { status: res.status })
}
