import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@customerEQ/database'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * POST /mcp/token
 *
 * Step 3 of the MCP OAuth dance — exchanges an authorization code for
 * a long-lived Bearer token.
 *
 * Expected body (application/x-www-form-urlencoded or JSON):
 *   grant_type=authorization_code
 *   code=<code>
 *   code_verifier=<pkce_verifier>
 *   client_id=<client_id>
 *   redirect_uri=<redirect_uri>
 *
 * The issued token is a random 48-byte secret (ceq_mcp_<base64url>)
 * stored hashed (SHA-256) in the `api_keys` table, indistinguishable
 * from any other API key.  This means the existing X-Api-Key auth path
 * in the Fastify API already works for it — no code changes needed there.
 *
 * This route is public (Clerk middleware: isPublicRoute includes /mcp/*).
 */
export async function POST(req: NextRequest) {
  // ── Parse body — accept both JSON and form-encoded ───────────────────────
  let grant_type: string | null
  let code: string | null
  let code_verifier: string | null
  let client_id: string | null
  let redirect_uri: string | null

  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({})) as Record<string, string>
    grant_type    = body.grant_type    ?? null
    code          = body.code          ?? null
    code_verifier = body.code_verifier ?? null
    client_id     = body.client_id     ?? null
    redirect_uri  = body.redirect_uri  ?? null
  } else {
    // form-urlencoded (default for OAuth)
    const text = await req.text()
    const params = new URLSearchParams(text)
    grant_type    = params.get('grant_type')
    code          = params.get('code')
    code_verifier = params.get('code_verifier')
    client_id     = params.get('client_id')
    redirect_uri  = params.get('redirect_uri')
  }

  if (grant_type !== 'authorization_code') {
    return tokenError('unsupported_grant_type', 'Only authorization_code is supported')
  }
  if (!code || !code_verifier || !client_id || !redirect_uri) {
    return tokenError('invalid_request', 'Missing required parameters')
  }

  // ── Look up the authorization code ───────────────────────────────────────
  const record = await prisma.mcpOAuthCode.findUnique({ where: { code } })

  if (!record) {
    return tokenError('invalid_grant', 'Authorization code not found')
  }
  if (record.usedAt !== null) {
    return tokenError('invalid_grant', 'Authorization code already used')
  }
  if (record.expiresAt < new Date()) {
    return tokenError('invalid_grant', 'Authorization code expired')
  }
  if (record.clientId !== client_id) {
    return tokenError('invalid_grant', 'client_id mismatch')
  }
  if (record.redirectUri !== redirect_uri) {
    return tokenError('invalid_grant', 'redirect_uri mismatch')
  }

  // ── Verify PKCE ───────────────────────────────────────────────────────────
  // S256: base64url(SHA-256(ASCII(code_verifier))) must equal code_challenge.
  const computed = createHash('sha256')
    .update(code_verifier, 'ascii')
    .digest('base64url')

  if (computed !== record.codeChallenge) {
    return tokenError('invalid_grant', 'PKCE verification failed')
  }

  // ── Mark code as used (one-time-use) ─────────────────────────────────────
  await prisma.mcpOAuthCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  })

  // ── Issue a Bearer token stored as an ApiKey ──────────────────────────────
  // The token surface is identical to an admin-provisioned API key, so the
  // existing Fastify X-Api-Key auth path accepts it without changes.
  const rawToken = `ceq_mcp_${randomBytes(48).toString('base64url')}`
  const keyHash  = createHash('sha256').update(rawToken).digest('hex')

  await prisma.apiKey.create({
    data: {
      name:       `MCP OAuth — ${record.clerkUserId}`,
      keyHash,
      keyPrefix:  rawToken.slice(0, 8),
      brandId:    record.brandId,
      createdBy:  record.clerkUserId,
    },
  })

  return NextResponse.json(
    {
      access_token: rawToken,
      token_type:   'Bearer',
      expires_in: 60 * 60 * 24 * 30,
      scope: 'mcp',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}

// CORS pre-flight — MCP clients may be on any origin
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

function tokenError(error: string, error_description: string) {
  return NextResponse.json(
    { error, error_description },
    {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}
