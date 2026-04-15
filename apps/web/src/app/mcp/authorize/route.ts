import { createHmac } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /mcp/authorize
 *
 * Step 1 of the MCP OAuth dance.  The MCP client redirects the user's
 * browser here with standard PKCE parameters.  We:
 *   1. Validate that required params are present.
 *   2. Pack them into a short-lived HMAC-signed blob.
 *   3. Redirect to Clerk sign-in, setting the signed blob as the
 *      after-sign-in redirect URL so the Clerk callback lands on
 *      /api/mcp/callback?data=<signed>.
 *
 * This route is public (Clerk middleware: isPublicRoute includes /mcp/*).
 * The /api/mcp/callback route is protected — Clerk enforces sign-in there.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const clientId           = searchParams.get('client_id')
  const redirectUri        = searchParams.get('redirect_uri')
  const state              = searchParams.get('state') ?? ''
  const codeChallenge      = searchParams.get('code_challenge')
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? 'S256'
  const responseType       = searchParams.get('response_type')

  // Basic param validation
  if (!clientId || !redirectUri || !codeChallenge || responseType !== 'code') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing required OAuth parameters' },
      { status: 400 },
    )
  }

  if (codeChallengeMethod !== 'S256') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Only S256 code_challenge_method is supported' },
      { status: 400 },
    )
  }

  // Sign the OAuth params so the callback can verify they weren't tampered
  // with in transit (e.g. if someone crafts a direct link to /api/mcp/callback).
  const secret  = process.env.MCP_OAUTH_STATE_SECRET ?? 'dev-insecure-mcp-state-secret'
  const payload = JSON.stringify({
    client_id:             clientId,
    redirect_uri:          redirectUri,
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: codeChallengeMethod,
    // Timestamp — the callback will reject blobs older than 10 minutes.
    ts: Date.now(),
  })
  const payloadB64 = Buffer.from(payload, 'utf-8').toString('base64url')
  const sig        = createHmac('sha256', secret).update(payloadB64).digest('base64url')
  const signedData = `${payloadB64}.${sig}`

  const base    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const callbackUrl = `${base}/api/mcp/callback?data=${encodeURIComponent(signedData)}`

  // Redirect to Clerk sign-in.  After the user authenticates, Clerk will
  // redirect them back to callbackUrl which is our protected callback route.
  const signInUrl = new URL('/sign-in', base)
  signInUrl.searchParams.set('redirect_url', callbackUrl)

  return NextResponse.redirect(signInUrl)
}
