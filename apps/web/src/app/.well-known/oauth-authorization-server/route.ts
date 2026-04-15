import { NextResponse } from 'next/server'

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata
 * MCP clients (Claude Desktop, Cursor, etc.) fetch this document to
 * discover the authorization_endpoint, token_endpoint, and supported
 * features before starting the OAuth dance.
 *
 * This route is public (see middleware.ts) — no Clerk guard.
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const metadata = {
    issuer: base,
    authorization_endpoint: `${base}/mcp/authorize`,
    token_endpoint: `${base}/mcp/token`,
    // We deliberately do not advertise a registration endpoint —
    // any client_id is accepted (see /mcp/authorize).
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    // MCP clients use Bearer tokens returned from /mcp/token
    // to authenticate calls to the SSE / HTTP MCP endpoint.
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
