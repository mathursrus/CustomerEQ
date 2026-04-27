export type ProviderUserId = string
export type ProviderOrgId = string

export type NormalizedProviderEvent =
  | { type: 'organization.created'; orgId: ProviderOrgId; orgName: string; createdByUserId: ProviderUserId }
  | { type: 'organization.updated'; orgId: ProviderOrgId; orgName: string }
  | { type: 'organization.deleted'; orgId: ProviderOrgId }
  | { type: 'user.created'; userId: ProviderUserId; email: string }
  | { type: 'user.deleted'; userId: ProviderUserId }

export interface IdentityProvider {
  // Internally three provider calls (createUser + createOrganization + addMembership
  // for Clerk per scripts/onboard-org.mjs). On any sub-step failure, the
  // implementation MUST clean up partial state — e.g. delete the just-created
  // user if org-create fails — so the caller sees a binary success/failure.
  // This contract is part of the interface, not an implementation detail.
  createUserWithOrg(args: {
    email: string
    password: string
    name: string
    orgName: string
  }): Promise<{ userId: ProviderUserId; orgId: ProviderOrgId }>

  signInUser(args: { email: string; password: string }): Promise<{ sessionToken: string }>

  // Returns null when token is invalid/expired. Returns `{ userId, orgId: null }`
  // for a freshly-OAuth'd user that doesn't have an organization yet — caller
  // detects this and routes to /signup/finish.
  getSession(
    sessionToken: string,
  ): Promise<{ userId: ProviderUserId; orgId: ProviderOrgId | null } | null>

  // Provider mediates the OAuth handshake. App does NOT receive code+state —
  // beginOAuth returns the provider's entry-point URL, the browser is redirected
  // through it, and the provider sets a session cookie before redirecting back.
  // After redirect-back, getSession reads that session.
  listSupportedOAuthProviders(): Promise<Array<'google' | 'github' | 'microsoft' | string>>
  beginOAuth(args: { provider: string; returnTo: string }): Promise<{ authorizationUrl: string }>

  // For the new-user-without-org path: after a fresh OAuth sign-up, the
  // session has a userId but no orgId. Caller calls createOrgForUser on
  // /signup/finish to provision the org.
  createOrgForUser(args: {
    userId: ProviderUserId
    orgName: string
  }): Promise<{ orgId: ProviderOrgId }>

  // Profile fetch — used by the OAuth path to pre-fill the name/email on
  // /signup/finish and by erasure to confirm we have the right user.
  getUser(userId: ProviderUserId): Promise<{ email: string; name: string } | null>

  getOrg(orgId: ProviderOrgId): Promise<{ id: ProviderOrgId; name: string }>
  updateOrgName(args: { orgId: ProviderOrgId; name: string }): Promise<void>

  inviteMember(args: {
    orgId: ProviderOrgId
    email: string
    role: 'admin'
  }): Promise<{ invitationId: string }>
  listOrgMembers(
    orgId: ProviderOrgId,
  ): Promise<Array<{ userId: ProviderUserId; email: string; role: string }>>

  deleteUser(userId: ProviderUserId): Promise<void>
  deleteOrg(orgId: ProviderOrgId): Promise<void>

  // Verifies the webhook signature inside the implementation; nothing outside
  // the abstraction sees the raw provider event shape. Returns null when the
  // event type is not one we act on (caller treats as 200 no-op).
  //
  // CONTRACT: `rawBody` MUST be the raw bytes received over the wire, NOT a
  // re-serialized parsed JSON object. Svix verifies the exact bytes that were
  // signed; re-stringified JSON differs (key order, whitespace) and verification
  // fails. The route handler is responsible for capturing raw body via Fastify's
  // `addContentTypeParser` (see PR 2 webhook route).
  parseWebhook(args: {
    headers: Record<string, string | string[] | undefined>
    rawBody: string
  }): Promise<NormalizedProviderEvent | null>
}

declare module 'fastify' {
  interface FastifyInstance {
    identityProvider: IdentityProvider
  }
}
