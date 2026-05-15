import { auth } from '@clerk/nextjs/server'

export function isServerAuthBypassed(): boolean {
  return process.env.PLAYWRIGHT_TEST === 'true' || process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'
}

export async function getServerAuthToken(): Promise<string | null> {
  if (isServerAuthBypassed()) {
    return null
  }

  const { getToken } = await auth()
  return await getToken()
}

export async function getServerUserId(): Promise<string | null> {
  if (isServerAuthBypassed()) {
    return null
  }

  const session = await auth()
  return session.userId ?? null
}
