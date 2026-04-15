import { auth } from '@clerk/nextjs/server'
import { createHmac, randomBytes } from 'node:crypto'
import { prisma } from '@customerEQ/database'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/mcp/callback
 *
 * Step 2 of the MCP OAuth dance.  This route is PROTECTED — Clerk
 * middleware will redirect unauthenticated requests to /sign-in, which
 * then returns here after the user authenticates.
 *
 * Flow:
 *   1. Verify the HMAC signature on `data` (prevents replay / forgery).
 *   2. Check the timestamp is < 10 minutes old.
 *   3. Resolve Clerk orgId → brandId via the `brands` table.
 *   4. Store a short-lived (5 min) McpOAuthCode in Postgres.
 *   5. Redirect to redirect_uri?code=<code>&state=<original_state>.
 */
export async function GET(req: NextRequest) {
  // ── 1. Get authenticated Clerk session ──────────────────────────────────
  const session = await auth()
  if (!session.userId) {
    // Unlikely (Clerk middleware should catch this), but be safe.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawData = req.nextUrl.searchParams.get('data')
  if (!rawData) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Missing data parameter' }, { status: 400 })
  }

  // ── 2. Verify HMAC signature ─────────────────────────────────────────────
  const secret = process.env.MCP_OAUTH_STATE_SECRET ?? 'dev-insecure-mcp-state-secret'
  const dotIdx = rawData.lastIndexOf('.')
  if (dotIdx === -1) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Malformed data' }, { status: 400 })
  }
  const payloadB64 = rawData.slice(0, dotIdx)
  const receivedSig = rawData.slice(dotIdx + 1)
  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url')
  if (receivedSig !== expectedSig) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Invalid signature' }, { status: 400 })
  }

  // ── 3. Decode and validate payload ───────────────────────────────────────
  let params: {
    client_id: string
    redirect_uri: string
    state: string
    code_challenge: string
    code_challenge_method: string
    ts: number
  }
  try {
    params = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'))
  } catch {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Invalid payload encoding' }, { status: 400 })
  }

  const tenMinutes = 10 * 60 * 1000
  if (Date.now() - params.ts > tenMinutes) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Authorization request expired' }, { status: 400 })
  }

  // ── 4. Resolve Clerk org → brandId ──────────────────────────────────────
  // Prefer orgId from the session (present when user is in a Clerk org).
  // Fall back to userId for dev environments without orgs enabled.
  const raw = session as unknown as Record<string, unknown>
  const orgId = (raw.orgId as string | undefined) ?? null
  const tenantKey = orgId ?? (process.env.NODE_ENV !== 'production' ? session.userId : null)

  if (!tenantKey) {
    const errorUrl = new URL(params.redirect_uri)
    errorUrl.searchParams.set('error', 'access_denied')
    errorUrl.searchParams.set('error_description', 'No organization membership found')
    if (params.state) errorUrl.searchParams.set('state', params.state)
    return NextResponse.redirect(errorUrl)
  }

  const brand = await prisma.brand.findUnique({
    where: { clerkOrgId: tenantKey },
    select: { id: true },
  })

  if (!brand) {
    const errorUrl = new URL(params.redirect_uri)
    errorUrl.searchParams.set('error', 'access_denied')
    errorUrl.searchParams.set('error_description', 'Brand not found for your organization')
    if (params.state) errorUrl.searchParams.set('state', params.state)
    return NextResponse.redirect(errorUrl)
  }

  // ── 5. Generate and store the one-time authorization code ────────────────
  const code = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  await prisma.mcpOAuthCode.create({
    data: {
      code,
      brandId:             brand.id,
      clerkUserId:         session.userId,
      clientId:            params.client_id,
      redirectUri:         params.redirect_uri,
      codeChallenge:       params.code_challenge,
      codeChallengeMethod: params.code_challenge_method,
      expiresAt,
    },
  })

  // ── 6. Redirect to the MCP client ────────────────────────────────────────
  const redirectUrl = new URL(params.redirect_uri)
  redirectUrl.searchParams.set('code', code)
  if (params.state) redirectUrl.searchParams.set('state', params.state)

  return NextResponse.redirect(redirectUrl)
}
