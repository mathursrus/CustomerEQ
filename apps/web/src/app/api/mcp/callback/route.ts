import { auth } from '@clerk/nextjs/server'
import { createHmac, randomBytes } from 'node:crypto'
import { prisma } from '@customerEQ/database'
import { getAuthorizedMcpBrands } from '@/lib/mcp-oauth'
import { getPublicBaseUrl } from '@/lib/request-origin'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/mcp/callback
 *
 * Step 2 of the MCP OAuth dance. This route is PROTECTED — Clerk
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
  const isPlaywright = process.env.PLAYWRIGHT_TEST === 'true'
  const testUserId = isPlaywright ? req.headers.get('x-playwright-test-user-id')?.trim() || null : null
  const testBrandId = isPlaywright ? req.headers.get('x-playwright-test-brand-id')?.trim() || null : null

  const session = testUserId ? null : await auth()
  const userId = testUserId ?? session?.userId ?? null
  if (!userId) {
    const publicBaseUrl = await getPublicBaseUrl(req)
    const signInUrl = new URL('/sign-in', publicBaseUrl)
    const callbackUrl = new URL(req.nextUrl.pathname, publicBaseUrl)
    callbackUrl.search = req.nextUrl.search
    signInUrl.searchParams.set('redirect_url', callbackUrl.toString())
    return NextResponse.redirect(signInUrl)
  }

  const rawData = req.nextUrl.searchParams.get('data')
  const selectedBrandId = req.nextUrl.searchParams.get('brandId')?.trim() || null
  if (!rawData) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Missing data parameter' }, { status: 400 })
  }

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

  const raw = (session ?? {}) as unknown as Record<string, unknown>
  const orgId = (raw.orgId as string | undefined) ?? null
  let brand =
    testBrandId
      ? await prisma.brand.findUnique({
          where: { id: testBrandId },
          select: { id: true },
        })
      : orgId
        ? await prisma.brand.findUnique({
            where: { clerkOrgId: orgId },
            select: { id: true },
          })
        : null

  if (!brand) {
    const authorizedBrands = await getAuthorizedMcpBrands(userId)

    if (selectedBrandId) {
      const selectedBrand = authorizedBrands.find((candidate) => candidate.id === selectedBrandId)
      if (selectedBrand) {
        brand = { id: selectedBrand.id }
      }
    } else if (authorizedBrands.length === 1) {
      brand = { id: authorizedBrands[0].id }
    } else if (authorizedBrands.length > 1) {
      const selectionUrl = new URL('/mcp/select-brand', await getPublicBaseUrl(req))
      selectionUrl.searchParams.set('data', rawData)
      return NextResponse.redirect(selectionUrl)
    }
  }

  if (!brand && process.env.NODE_ENV !== 'production') {
    const fallbackBrandId = process.env.MCP_BRAND_ID?.trim()
    if (fallbackBrandId) {
      brand = await prisma.brand.findUnique({
        where: { id: fallbackBrandId },
        select: { id: true },
      })
    }
  }

  if (!brand) {
    const errorUrl = new URL(params.redirect_uri)
    errorUrl.searchParams.set('error', 'access_denied')
    errorUrl.searchParams.set('error_description', 'Brand not found for your organization')
    if (params.state) errorUrl.searchParams.set('state', params.state)

    return createMcpClientRedirectResponse(errorUrl, {
      heading: 'Authentication failed',
      message: 'CustomerEQ could not determine which brand to authorize for this MCP session.',
      cta: 'Return to your MCP client',
    })
  }

  const code = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await prisma.mcpOAuthCode.create({
    data: {
      code,
      brandId: brand.id,
      clerkUserId: userId,
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      codeChallenge: params.code_challenge,
      codeChallengeMethod: params.code_challenge_method,
      expiresAt,
    },
  })

  const redirectUrl = new URL(params.redirect_uri)
  redirectUrl.searchParams.set('code', code)
  if (params.state) redirectUrl.searchParams.set('state', params.state)

  return createMcpClientRedirectResponse(redirectUrl, {
    heading: 'Authentication complete',
    message: 'CustomerEQ is returning you to your MCP client. You can close this tab if nothing happens automatically.',
    cta: 'Return to your MCP client',
  })
}

function createMcpClientRedirectResponse(
  redirectUrl: URL,
  options: {
    heading: string
    message: string
    cta: string
  },
) {
  if (redirectUrl.protocol === 'http:' || redirectUrl.protocol === 'https:') {
    return NextResponse.redirect(redirectUrl)
  }

  const target = redirectUrl.toString()
  const escapedTarget = escapeHtml(target)
  const escapedHeading = escapeHtml(options.heading)
  const escapedMessage = escapeHtml(options.message)
  const escapedCta = escapeHtml(options.cta)

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedHeading}</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      main {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      section {
        width: 100%;
        max-width: 560px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
        padding: 32px;
      }
      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.2;
      }
      p {
        margin: 16px 0 0;
        color: #475569;
        line-height: 1.6;
      }
      a {
        display: inline-block;
        margin-top: 24px;
        padding: 12px 16px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        text-decoration: none;
        font-weight: 600;
      }
      code {
        display: block;
        margin-top: 20px;
        padding: 12px;
        border-radius: 10px;
        background: #f1f5f9;
        color: #0f172a;
        font-size: 12px;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${escapedHeading}</h1>
        <p>${escapedMessage}</p>
        <a href="${escapedTarget}">${escapedCta}</a>
        <code>${escapedTarget}</code>
      </section>
    </main>
    <script>
      const target = ${JSON.stringify(target)};
      window.location.replace(target);
      window.setTimeout(() => {
        const link = document.querySelector('a');
        if (link instanceof HTMLAnchorElement) {
          link.focus();
        }
      }, 750);
    </script>
  </body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
