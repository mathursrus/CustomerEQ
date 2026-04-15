import { NextResponse } from 'next/server'

/**
 * RFC 9728 — OAuth 2.0 Protected Resource Metadata
 *
 * MCP SDK v1.28+ calls this endpoint after receiving a 401 from /api/mcp.
 * It uses the metadata to discover which OAuth authorization server to use.
 *
 * The MCP SDK requests both:
 *   GET /.well-known/oauth-protected-resource            (base)
 *   GET /.well-known/oauth-protected-resource/api/mcp   (path-scoped variant)
 *
 * Both return the same document — the catch-all [...path] route handles both.
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return NextResponse.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  )
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  })
}
