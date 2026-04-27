import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { ClerkIdentityProvider } from '../auth/clerk-identity-provider.js'

const identityProviderPlugin: FastifyPluginAsync = async (fastify) => {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is not configured')
  }
  // Webhook secret is required in production but optional in dev/test so
  // local startup doesn't fail when webhooks aren't being exercised.
  const webhookSecret =
    process.env.CLERK_WEBHOOK_SECRET ??
    (process.env.NODE_ENV === 'production'
      ? (() => {
          throw new Error('CLERK_WEBHOOK_SECRET is required in production')
        })()
      : 'whsec_dev_placeholder_not_used_for_verification')

  // Comma-separated list, e.g. "google,github,microsoft". Empty list ⇒ no
  // OAuth row rendered on /signup; admin can still email/password.
  const oauthProviders = (process.env.CLERK_OAUTH_PROVIDERS ?? 'google,github')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const provider = new ClerkIdentityProvider({
    secretKey,
    webhookSecret,
    oauthProviders,
    frontendApi: process.env.CLERK_FRONTEND_API,
  })

  fastify.decorate('identityProvider', provider)
}

export default fp(identityProviderPlugin, {
  name: 'identityProvider',
})
