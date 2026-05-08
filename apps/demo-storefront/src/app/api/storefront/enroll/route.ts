import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.DEMO_API_URL ?? 'http://localhost:4000'
const BRAND_ID = process.env.DEMO_BRAND_ID ?? 'cmn689ibu000089tqad1g234t'
const API_KEY = process.env.DEMO_API_KEY

const AUTH_HEADERS: Record<string, string> = API_KEY
  ? { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY }
  : { 'Content-Type': 'application/json', 'X-Test-Brand-Id': BRAND_ID, 'X-Test-User-Id': 'demo-admin' }

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { email, firstName, lastName } = await request.json() as {
    email: string
    firstName: string
    lastName: string
  }

  if (!email || !firstName) {
    return NextResponse.json({ error: 'email and firstName are required' }, { status: 400 })
  }

  // Find the StarBrew Rewards program
  const programsRes = await fetch(`${API_URL}/v1/programs?pageSize=50`, { headers: AUTH_HEADERS })
  if (!programsRes.ok) {
    return NextResponse.json({ error: 'Could not load programs' }, { status: 500 })
  }
  const programsBody = await programsRes.json() as { data: Array<{ id: string; name: string }> }
  const program = programsBody.data?.find((p) => p.name === 'StarBrew Rewards')
  if (!program) {
    return NextResponse.json({ error: 'StarBrew Rewards program not found. Run seed:demo first.' }, { status: 404 })
  }

  const res = await fetch(`${API_URL}/v1/members/enroll`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      memberId: email,
      email,
      firstName,
      lastName: lastName || '',
      programId: program.id,
      consentGivenAt: new Date().toISOString(),
      consentVersion: '1.0',
    }),
  })

  const data = await res.json() as Record<string, unknown>

  if (!res.ok && res.status !== 409) {
    return NextResponse.json({ error: (data.message ?? data.error ?? 'Enrollment failed') as string }, { status: res.status })
  }

  return NextResponse.json({ memberId: data.memberId ?? email, email, firstName, lastName })
}
