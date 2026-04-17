import { NextResponse, type NextRequest } from 'next/server'
import { getPublicBaseUrl } from '@/lib/request-origin'

/**
 * Catch-all for path-scoped RFC 9728 requests.
 * MCP SDK sends: GET /.well-known/oauth-protected-resource/api/mcp
 * The path suffix is the resource path — same metadata regardless of suffix.
 */
export async function GET(req: NextRequest) {
  const base = await getPublicBaseUrl(req)

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
