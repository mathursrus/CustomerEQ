import { NextResponse, type NextRequest } from 'next/server'

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata
 * MCP clients (Claude Desktop, Cursor, etc.) fetch this document to
 * discover the authorization_endpoint, token_endpoint, and supported
 * features before starting the OAuth dance.
 *
 * This route is public (see middleware.ts) — no Clerk guard.
 */
export async function GET(req: NextRequest) {
  // Always derive base from the actual request origin to avoid port/env drift in dev
  const base = req.nextUrl.origin

  const metadata = {
    issuer: base,
    authorization_endpoint: `${base}/mcp/authorize`,
    token_endpoint: `${base}/mcp/token`,
    registration_endpoint: `${base}/mcp/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp'],
  }

  return NextResponse.json(metadata, {
    headers: {
      // Allow MCP clients running on any origin to fetch this document.
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
