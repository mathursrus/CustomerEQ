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
  programId: string
  incentivePoints: number | null
}

interface Program {
  id: string
  name: string
}

export async function GET(): Promise<NextResponse> {
  // Find the StarBrew Rewards program so we only show its surveys.
  const programsRes = await fetch(`${API_URL}/v1/programs?pageSize=50`, { headers: AUTH_HEADERS })
  if (!programsRes.ok) {
    return NextResponse.json({ error: 'Could not load programs' }, { status: programsRes.status })
  }
  const programsBody = await programsRes.json() as { data: Program[] }
  const starBrewProgram = programsBody.data?.find((p) => p.name === 'StarBrew Rewards')

  const surveysRes = await fetch(`${API_URL}/v1/surveys?pageSize=50`, { headers: AUTH_HEADERS })
  if (!surveysRes.ok) {
    return NextResponse.json({ error: 'Could not load surveys' }, { status: surveysRes.status })
  }
  const surveysBody = await surveysRes.json() as { data: Survey[] }

  const surveys = (surveysBody.data ?? []).filter((s) => {
    if (s.status !== 'ACTIVE') return false
    if (starBrewProgram) return s.programId === starBrewProgram.id
    return true
  })

  return NextResponse.json(surveys)
}
