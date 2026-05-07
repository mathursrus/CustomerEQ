import { NextResponse } from 'next/server'

const API_URL = process.env.DEMO_API_URL ?? 'http://localhost:4000'
const BRAND_ID = process.env.DEMO_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'
const API_KEY = process.env.DEMO_API_KEY

const AUTH_HEADERS: Record<string, string> = API_KEY
  ? { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY }
  : { 'Content-Type': 'application/json', 'X-Test-Brand-Id': BRAND_ID, 'X-Test-User-Id': 'demo-admin' }

interface Survey {
  id: string
  name: string
  type: string
  status: string
  incentivePoints: number | null
}

export async function GET(): Promise<NextResponse> {
  const res = await fetch(`${API_URL}/v1/surveys?status=ACTIVE&pageSize=20`, {
    headers: AUTH_HEADERS,
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Could not load surveys' }, { status: res.status })
  }

  const body = await res.json() as { data: Survey[] }
  const surveys = (body.data ?? []).filter((s) => s.status === 'ACTIVE')
  return NextResponse.json(surveys)
}
