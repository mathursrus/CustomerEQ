import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'

export async function getPublicBaseUrl(req: NextRequest): Promise<string> {
  const requestHeaders = await headers()
  const forwardedProto = firstHeaderValue(requestHeaders.get('x-forwarded-proto'))
  const forwardedHost = firstHeaderValue(requestHeaders.get('x-forwarded-host'))
  const host = forwardedHost ?? firstHeaderValue(requestHeaders.get('host'))
  const protocol = forwardedProto ?? (req.nextUrl.protocol.replace(/:$/, '') || 'https')

  if (host) {
    return `${protocol}://${host}`
  }

  if (
    (req.nextUrl.hostname === '0.0.0.0' || req.nextUrl.hostname === '127.0.0.1') &&
    process.env.NEXT_PUBLIC_APP_URL
  ) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }

  return req.nextUrl.origin
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim()
  return first ? first : null
}
