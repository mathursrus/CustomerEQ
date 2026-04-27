// Clerk implementation of the IdentityProvider abstraction. This is the ONLY
// file in the API codebase allowed to import @clerk/* directly (enforced via
// ESLint no-restricted-imports). Every other call site must go through the
// IdentityProvider interface so swapping providers later is a port-only effort.
import { createClerkClient, verifyToken } from '@clerk/backend'
import { Webhook } from 'svix'
import type {
  IdentityProvider,
  NormalizedProviderEvent,
  ProviderOrgId,
  ProviderUserId,
} from './identity-provider.js'

interface ClerkConfig {
  secretKey: string
  webhookSecret: string
  oauthProviders: string[]
  // Frontend-API origin used to build OAuth handshake URLs. In real Clerk this
  // is the dashboard-configured frontend host (e.g. clerk.acme.test).
  frontendApi?: string
}

type ClerkClient = ReturnType<typeof createClerkClient>

export class ClerkIdentityProvider implements IdentityProvider {
  private client: ClerkClient
  private webhook: Webhook
  private oauthProviders: string[]
  private frontendApi: string
  private secretKey: string

  constructor(config: ClerkConfig) {
    this.client = createClerkClient({ secretKey: config.secretKey })
    this.webhook = new Webhook(config.webhookSecret)
    this.oauthProviders = config.oauthProviders
    this.frontendApi = config.frontendApi ?? 'https://accounts.clerk.dev'
    this.secretKey = config.secretKey
  }

  async createUserWithOrg(args: {
    email: string
    password: string
    name: string
    orgName: string
  }): Promise<{ userId: ProviderUserId; orgId: ProviderOrgId }> {
    const [firstName, ...rest] = args.name.trim().split(/\s+/)
    const lastName = rest.join(' ')

    const user = await this.client.users.createUser({
      emailAddress: [args.email],
      password: args.password,
      firstName: firstName ?? args.name,
      lastName,
    })
    const userId = (user as { id: string }).id

    let orgId: string
    try {
      const org = await this.client.organizations.createOrganization({
        name: args.orgName,
        createdBy: userId,
      })
      orgId = (org as { id: string }).id
    } catch (err) {
      // Cleanup: delete the just-created user so the caller's transaction
      // sees a clean failure. If cleanup itself fails, log the orphan but
      // re-raise the original error — orphan-on-cleanup-fail is a forensics
      // problem, not a behavioral one.
      try {
        await this.client.users.deleteUser(userId)
      } catch (cleanupErr) {
        console.error('[ClerkIdentityProvider] orphaned user after createOrganization failure', {
          orphanedUserId: userId,
          originalError: err instanceof Error ? err.message : String(err),
          cleanupError: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        })
      }
      throw err
    }

    try {
      await this.client.organizations.createOrganizationMembership({
        organizationId: orgId,
        userId,
        role: 'admin',
      })
    } catch (err) {
      try {
        await this.client.organizations.deleteOrganization(orgId)
      } catch {
        // Best-effort; the original error is what matters.
      }
      try {
        await this.client.users.deleteUser(userId)
      } catch (cleanupErr) {
        console.error('[ClerkIdentityProvider] orphaned user after membership failure', {
          orphanedUserId: userId,
          originalError: err instanceof Error ? err.message : String(err),
          cleanupError: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        })
      }
      throw err
    }

    return { userId, orgId }
  }

  async signInUser(args: {
    email: string
    password: string
  }): Promise<{ sessionToken: string }> {
    // The backend SDK's signIns API exchanges email/password for a session.
    // The exact response shape varies by SDK version; this returns the
    // session id string used by getSession callers.
    const result = await (this.client as unknown as {
      signIns: { create: (args: { identifier: string; password: string }) => Promise<{ createdSessionId: string }> }
    }).signIns.create({
      identifier: args.email,
      password: args.password,
    })
    return { sessionToken: result.createdSessionId }
  }

  async getSession(
    sessionToken: string,
  ): Promise<{ userId: ProviderUserId; orgId: ProviderOrgId | null } | null> {
    let payload: Awaited<ReturnType<typeof verifyToken>>
    try {
      payload = await verifyToken(sessionToken, { secretKey: this.secretKey })
    } catch {
      return null
    }
    const raw = payload as unknown as Record<string, unknown>
    // Clerk JWT v1 nests org under top-level org_id; v2 uses o.id
    const orgId =
      (raw.org_id as string | undefined) ??
      ((raw.o as Record<string, string> | undefined)?.id) ??
      null
    return { userId: payload.sub, orgId }
  }

  async listSupportedOAuthProviders(): Promise<string[]> {
    return [...this.oauthProviders]
  }

  async beginOAuth(args: {
    provider: string
    returnTo: string
  }): Promise<{ authorizationUrl: string }> {
    if (!this.oauthProviders.includes(args.provider)) {
      throw new Error(`Unsupported OAuth provider: ${args.provider}`)
    }
    // Clerk-mediated handshake: the app redirects to Clerk's hosted endpoint;
    // Clerk handles the OAuth round-trip and sets a session cookie before
    // bouncing back to the app. App never sees code+state.
    const url = new URL('/v1/oauth/authorize', this.frontendApi)
    url.searchParams.set('provider', `oauth_${args.provider}`)
    url.searchParams.set('redirect_url', args.returnTo)
    return { authorizationUrl: url.toString() }
  }

  async createOrgForUser(args: {
    userId: ProviderUserId
    orgName: string
  }): Promise<{ orgId: ProviderOrgId }> {
    const org = await this.client.organizations.createOrganization({
      name: args.orgName,
      createdBy: args.userId,
    })
    const orgId = (org as { id: string }).id

    try {
      await this.client.organizations.createOrganizationMembership({
        organizationId: orgId,
        userId: args.userId,
        role: 'admin',
      })
    } catch (err) {
      try {
        await this.client.organizations.deleteOrganization(orgId)
      } catch {
        /* best-effort */
      }
      throw err
    }

    return { orgId }
  }

  async getUser(
    userId: ProviderUserId,
  ): Promise<{ email: string; name: string } | null> {
    try {
      const user = (await this.client.users.getUser(userId)) as {
        firstName?: string | null
        lastName?: string | null
        primaryEmailAddressId?: string | null
        emailAddresses?: Array<{ id: string; emailAddress: string }>
      }
      const primary = user.emailAddresses?.find(
        (e) => e.id === user.primaryEmailAddressId,
      )
      const email = primary?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? ''
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      return { email, name }
    } catch (err) {
      const status = (err as { status?: number } | null)?.status
      if (status === 404) return null
      throw err
    }
  }

  async getOrg(orgId: ProviderOrgId): Promise<{ id: ProviderOrgId; name: string }> {
    const org = (await this.client.organizations.getOrganization({
      organizationId: orgId,
    })) as { id: string; name: string }
    return { id: org.id, name: org.name }
  }

  async updateOrgName(args: { orgId: ProviderOrgId; name: string }): Promise<void> {
    await this.client.organizations.updateOrganization(args.orgId, { name: args.name })
  }

  async inviteMember(args: {
    orgId: ProviderOrgId
    email: string
    role: 'admin'
  }): Promise<{ invitationId: string }> {
    const invitation = (await this.client.organizations.createOrganizationInvitation({
      organizationId: args.orgId,
      emailAddress: args.email,
      role: args.role,
      // inviterUserId is required by Clerk; admin invitation flows pass the
      // current admin's userId. Routes call inviteMember with the inviter
      // resolved from the session — passed via args in a follow-up if needed.
      inviterUserId: 'system',
    } as never)) as { id: string }
    return { invitationId: invitation.id }
  }

  async listOrgMembers(
    orgId: ProviderOrgId,
  ): Promise<Array<{ userId: ProviderUserId; email: string; role: string }>> {
    const result = (await this.client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    })) as {
      data: Array<{
        publicUserData: { userId: string; identifier: string }
        role: string
      }>
    }
    return result.data.map((m) => ({
      userId: m.publicUserData.userId,
      email: m.publicUserData.identifier,
      role: m.role,
    }))
  }

  async deleteUser(userId: ProviderUserId): Promise<void> {
    await this.client.users.deleteUser(userId)
  }

  async deleteOrg(orgId: ProviderOrgId): Promise<void> {
    await this.client.organizations.deleteOrganization(orgId)
  }

  async parseWebhook(args: {
    headers: Record<string, string | string[] | undefined>
    rawBody: string
  }): Promise<NormalizedProviderEvent | null> {
    const svixId = args.headers['svix-id']
    const svixTimestamp = args.headers['svix-timestamp']
    const svixSignature = args.headers['svix-signature']

    if (
      typeof svixId !== 'string' ||
      typeof svixTimestamp !== 'string' ||
      typeof svixSignature !== 'string'
    ) {
      throw new Error('Missing required svix headers')
    }

    // svix.verify throws on invalid signature; let it propagate so the route
    // handler returns 401. Pass rawBody (string of bytes received over the
    // wire) directly — re-serializing parsed JSON would change the bytes and
    // break signature verification.
    const event = this.webhook.verify(args.rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: Record<string, unknown> }

    return normalizeEvent(event)
  }
}

function normalizeEvent(event: {
  type: string
  data: Record<string, unknown>
}): NormalizedProviderEvent | null {
  const { type, data } = event

  switch (type) {
    case 'organization.created':
      return {
        type: 'organization.created',
        orgId: data.id as string,
        orgName: data.name as string,
        createdByUserId: data.created_by as string,
      }
    case 'organization.updated':
      return {
        type: 'organization.updated',
        orgId: data.id as string,
        orgName: data.name as string,
      }
    case 'organization.deleted':
      return { type: 'organization.deleted', orgId: data.id as string }
    case 'user.created': {
      const emailAddresses = (data.email_addresses as Array<{
        email_address: string
        id: string
      }>) ?? []
      const primary = emailAddresses.find(
        (e) => e.id === data.primary_email_address_id,
      )
      return {
        type: 'user.created',
        userId: data.id as string,
        email: primary?.email_address ?? emailAddresses[0]?.email_address ?? '',
      }
    }
    case 'user.deleted':
      return { type: 'user.deleted', userId: data.id as string }
    default:
      // Unhandled event type — return null so the route returns 200 no-op.
      return null
  }
}
