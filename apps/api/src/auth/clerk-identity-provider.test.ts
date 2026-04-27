/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'

const clerkMock = vi.hoisted(() => ({
  users: {
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    getUser: vi.fn(),
  },
  organizations: {
    createOrganization: vi.fn(),
    getOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    deleteOrganization: vi.fn(),
    createOrganizationMembership: vi.fn(),
    getOrganizationMembershipList: vi.fn(),
    createOrganizationInvitation: vi.fn(),
  },
  sessions: {
    verifyToken: vi.fn(),
  },
}))

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => clerkMock),
  verifyToken: vi.fn(),
}))

const svixVerify = vi.hoisted(() => vi.fn())
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({ verify: svixVerify })),
}))

import { ClerkIdentityProvider } from './clerk-identity-provider.js'
import { verifyToken } from '@clerk/backend'

const mockedVerifyToken = vi.mocked(verifyToken)

const loggerMock = { error: vi.fn() }

function buildProvider() {
  return new ClerkIdentityProvider({
    secretKey: 'sk_test_123',
    webhookSecret: 'whsec_test_123',
    oauthProviders: ['google', 'github'],
    logger: loggerMock,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ClerkIdentityProvider', () => {
  // ---------------------------------------------------------------------------
  // createUserWithOrg — 3-step internal flow + cleanup contract
  // ---------------------------------------------------------------------------

  describe('createUserWithOrg', () => {
    it('returns userId and orgId on full happy path', async () => {
      clerkMock.users.createUser.mockResolvedValueOnce({ id: 'user_new' })
      clerkMock.organizations.createOrganization.mockResolvedValueOnce({ id: 'org_new' })
      clerkMock.organizations.createOrganizationMembership.mockResolvedValueOnce({
        id: 'mem_new',
      })

      const provider = buildProvider()
      const result = await provider.createUserWithOrg({
        email: 'admin@acme.test',
        password: 'pw1234567890',
        name: 'Admin Person',
        orgName: 'Acme',
      })

      expect(result).toEqual({ userId: 'user_new', orgId: 'org_new' })
      expect(clerkMock.users.createUser).toHaveBeenCalledWith({
        emailAddress: ['admin@acme.test'],
        password: 'pw1234567890',
        firstName: 'Admin',
        lastName: 'Person',
      })
      expect(clerkMock.organizations.createOrganization).toHaveBeenCalledWith({
        name: 'Acme',
        createdBy: 'user_new',
      })
      expect(clerkMock.organizations.createOrganizationMembership).toHaveBeenCalledWith({
        organizationId: 'org_new',
        userId: 'user_new',
        role: 'admin',
      })
    })

    it('cleans up the just-created user when createOrganization fails', async () => {
      clerkMock.users.createUser.mockResolvedValueOnce({ id: 'user_orphan' })
      clerkMock.organizations.createOrganization.mockRejectedValueOnce(
        new Error('rate-limited'),
      )
      clerkMock.users.deleteUser.mockResolvedValueOnce(undefined)

      const provider = buildProvider()
      await expect(
        provider.createUserWithOrg({
          email: 'a@b.test',
          password: 'pw1234567890',
          name: 'A B',
          orgName: 'Acme',
        }),
      ).rejects.toThrow('rate-limited')

      // User cleanup MUST have run per the interface contract
      expect(clerkMock.users.deleteUser).toHaveBeenCalledWith('user_orphan')
      expect(clerkMock.organizations.createOrganizationMembership).not.toHaveBeenCalled()
    })

    it('cleans up org + user when createOrganizationMembership fails', async () => {
      clerkMock.users.createUser.mockResolvedValueOnce({ id: 'user_o2' })
      clerkMock.organizations.createOrganization.mockResolvedValueOnce({ id: 'org_o2' })
      clerkMock.organizations.createOrganizationMembership.mockRejectedValueOnce(
        new Error('membership-failed'),
      )
      clerkMock.organizations.deleteOrganization.mockResolvedValueOnce(undefined)
      clerkMock.users.deleteUser.mockResolvedValueOnce(undefined)

      const provider = buildProvider()
      await expect(
        provider.createUserWithOrg({
          email: 'a@b.test',
          password: 'pw1234567890',
          name: 'A B',
          orgName: 'Acme',
        }),
      ).rejects.toThrow('membership-failed')

      expect(clerkMock.organizations.deleteOrganization).toHaveBeenCalledWith('org_o2')
      expect(clerkMock.users.deleteUser).toHaveBeenCalledWith('user_o2')
    })

    it('logs the orphaned-user metadata via the injected logger when cleanup itself fails (does not rethrow cleanup error)', async () => {
      // Per interface contract: orphan is logged at ERROR via the injected
      // logger; the original error is re-raised. Cleanup-failure must not
      // mask the real cause.
      clerkMock.users.createUser.mockResolvedValueOnce({ id: 'user_double_fail' })
      clerkMock.organizations.createOrganization.mockRejectedValueOnce(
        new Error('original-cause'),
      )
      clerkMock.users.deleteUser.mockRejectedValueOnce(new Error('cleanup-failed'))

      const provider = buildProvider()
      await expect(
        provider.createUserWithOrg({
          email: 'a@b.test',
          password: 'pw1234567890',
          name: 'A B',
          orgName: 'Acme',
        }),
      ).rejects.toThrow('original-cause')

      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({
          orphanedUserId: 'user_double_fail',
          originalError: 'original-cause',
          cleanupError: 'cleanup-failed',
        }),
        expect.stringMatching(/orphaned/i),
      )
    })
  })

  // ---------------------------------------------------------------------------
  // getSession — v1/v2 JWT shapes + new-user-without-org case
  // ---------------------------------------------------------------------------

  describe('getSession', () => {
    it('returns userId + orgId from a v1 JWT (top-level org_id)', async () => {
      mockedVerifyToken.mockResolvedValueOnce({
        sub: 'user_v1',
        org_id: 'org_v1',
      } as never)

      const provider = buildProvider()
      const result = await provider.getSession('jwt_v1')

      expect(result).toEqual({ userId: 'user_v1', orgId: 'org_v1' })
    })

    it('returns userId + orgId from a v2 JWT (nested o.id)', async () => {
      mockedVerifyToken.mockResolvedValueOnce({
        sub: 'user_v2',
        o: { id: 'org_v2' },
      } as never)

      const provider = buildProvider()
      const result = await provider.getSession('jwt_v2')

      expect(result).toEqual({ userId: 'user_v2', orgId: 'org_v2' })
    })

    it('returns { userId, orgId: null } for a fresh OAuth user without an org', async () => {
      mockedVerifyToken.mockResolvedValueOnce({ sub: 'user_oauth_fresh' } as never)

      const provider = buildProvider()
      const result = await provider.getSession('jwt_oauth_fresh')

      expect(result).toEqual({ userId: 'user_oauth_fresh', orgId: null })
    })

    it('returns null when verifyToken throws', async () => {
      mockedVerifyToken.mockRejectedValueOnce(new Error('expired'))

      const provider = buildProvider()
      const result = await provider.getSession('expired_jwt')

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // parseWebhook — Svix signature verification + event normalization
  // ---------------------------------------------------------------------------

  describe('parseWebhook', () => {
    it('returns normalized organization.created event on valid signature', async () => {
      svixVerify.mockReturnValueOnce({
        type: 'organization.created',
        data: { id: 'org_wh_1', name: 'Wh Org', created_by: 'user_wh_1' },
      })

      const provider = buildProvider()
      const result = await provider.parseWebhook({
        headers: {
          'svix-id': 'msg_1',
          'svix-timestamp': '1700000000',
          'svix-signature': 'v1,abc',
        },
        rawBody: '{"type":"organization.created","data":{}}',
      })

      expect(result).toEqual({
        type: 'organization.created',
        orgId: 'org_wh_1',
        orgName: 'Wh Org',
        createdByUserId: 'user_wh_1',
      })
    })

    it('returns normalized organization.updated event', async () => {
      svixVerify.mockReturnValueOnce({
        type: 'organization.updated',
        data: { id: 'org_upd', name: 'Renamed' },
      })

      const provider = buildProvider()
      const result = await provider.parseWebhook({
        headers: { 'svix-id': 'm', 'svix-timestamp': 't', 'svix-signature': 's' },
        rawBody: '{}',
      })

      expect(result).toEqual({
        type: 'organization.updated',
        orgId: 'org_upd',
        orgName: 'Renamed',
      })
    })

    it('returns normalized organization.deleted event', async () => {
      svixVerify.mockReturnValueOnce({
        type: 'organization.deleted',
        data: { id: 'org_del' },
      })

      const provider = buildProvider()
      const result = await provider.parseWebhook({
        headers: { 'svix-id': 'm', 'svix-timestamp': 't', 'svix-signature': 's' },
        rawBody: '{}',
      })

      expect(result).toEqual({ type: 'organization.deleted', orgId: 'org_del' })
    })

    it('returns normalized user.created event', async () => {
      svixVerify.mockReturnValueOnce({
        type: 'user.created',
        data: {
          id: 'user_wh',
          email_addresses: [{ email_address: 'wh@user.test', id: 'em_1' }],
          primary_email_address_id: 'em_1',
        },
      })

      const provider = buildProvider()
      const result = await provider.parseWebhook({
        headers: { 'svix-id': 'm', 'svix-timestamp': 't', 'svix-signature': 's' },
        rawBody: '{}',
      })

      expect(result).toEqual({
        type: 'user.created',
        userId: 'user_wh',
        email: 'wh@user.test',
      })
    })

    it('returns normalized user.deleted event', async () => {
      svixVerify.mockReturnValueOnce({
        type: 'user.deleted',
        data: { id: 'user_to_delete' },
      })

      const provider = buildProvider()
      const result = await provider.parseWebhook({
        headers: { 'svix-id': 'm', 'svix-timestamp': 't', 'svix-signature': 's' },
        rawBody: '{}',
      })

      expect(result).toEqual({ type: 'user.deleted', userId: 'user_to_delete' })
    })

    it('throws when svix signature verification fails', async () => {
      svixVerify.mockImplementationOnce(() => {
        throw new Error('Invalid signature')
      })

      const provider = buildProvider()
      await expect(
        provider.parseWebhook({
          headers: {
            'svix-id': 'msg_bad',
            'svix-timestamp': '1700000000',
            'svix-signature': 'v1,bogus',
          },
          rawBody: '{}',
        }),
      ).rejects.toThrow('Invalid signature')
    })

    it('throws when required svix headers are missing', async () => {
      const provider = buildProvider()
      await expect(
        provider.parseWebhook({
          headers: { 'svix-id': 'msg_x' /* missing timestamp + signature */ },
          rawBody: '{}',
        }),
      ).rejects.toThrow(/svix/i)
      expect(svixVerify).not.toHaveBeenCalled()
    })

    it('returns null for event types we do not act on', async () => {
      svixVerify.mockReturnValueOnce({
        type: 'session.created', // not in our normalized union
        data: { id: 'sess_x' },
      })

      const provider = buildProvider()
      const result = await provider.parseWebhook({
        headers: { 'svix-id': 'm', 'svix-timestamp': 't', 'svix-signature': 's' },
        rawBody: '{}',
      })

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // OAuth methods
  // ---------------------------------------------------------------------------

  describe('listSupportedOAuthProviders', () => {
    it('returns the configured OAuth providers list', async () => {
      const provider = buildProvider()
      const list = await provider.listSupportedOAuthProviders()
      expect(list).toEqual(['google', 'github'])
    })
  })

  describe('beginOAuth', () => {
    it('returns the provider authorization URL with returnTo encoded', async () => {
      const provider = buildProvider()
      const result = await provider.beginOAuth({
        provider: 'google',
        returnTo: '/admin/onboarding/profile',
      })

      // URL shape: Clerk hosted handshake endpoint + provider + returnTo param.
      // Exact host is implementation detail; the test asserts the meaningful parts.
      expect(result.authorizationUrl).toMatch(/google/)
      expect(result.authorizationUrl).toMatch(/onboarding%2Fprofile|onboarding\/profile/)
    })

    it('rejects an unsupported provider', async () => {
      const provider = buildProvider()
      await expect(
        provider.beginOAuth({ provider: 'myspace', returnTo: '/' }),
      ).rejects.toThrow(/unsupported|provider/i)
    })
  })

  describe('createOrgForUser', () => {
    it('creates a new org and adds the user as admin', async () => {
      clerkMock.organizations.createOrganization.mockResolvedValueOnce({ id: 'org_for_u' })
      clerkMock.organizations.createOrganizationMembership.mockResolvedValueOnce({
        id: 'mem_for_u',
      })

      const provider = buildProvider()
      const result = await provider.createOrgForUser({
        userId: 'user_oauth',
        orgName: 'Acme OAuth Org',
      })

      expect(result).toEqual({ orgId: 'org_for_u' })
      expect(clerkMock.organizations.createOrganization).toHaveBeenCalledWith({
        name: 'Acme OAuth Org',
        createdBy: 'user_oauth',
      })
      expect(clerkMock.organizations.createOrganizationMembership).toHaveBeenCalledWith({
        organizationId: 'org_for_u',
        userId: 'user_oauth',
        role: 'admin',
      })
    })

    it('cleans up org when membership fails', async () => {
      clerkMock.organizations.createOrganization.mockResolvedValueOnce({ id: 'org_clean' })
      clerkMock.organizations.createOrganizationMembership.mockRejectedValueOnce(
        new Error('mem-fail'),
      )
      clerkMock.organizations.deleteOrganization.mockResolvedValueOnce(undefined)

      const provider = buildProvider()
      await expect(
        provider.createOrgForUser({ userId: 'u', orgName: 'X' }),
      ).rejects.toThrow('mem-fail')
      expect(clerkMock.organizations.deleteOrganization).toHaveBeenCalledWith('org_clean')
    })
  })

  describe('getUser', () => {
    it('returns email + name for an existing user', async () => {
      clerkMock.users.getUser.mockResolvedValueOnce({
        id: 'user_exists',
        firstName: 'Ada',
        lastName: 'Lovelace',
        primaryEmailAddressId: 'em_1',
        emailAddresses: [{ id: 'em_1', emailAddress: 'ada@nelson.test' }],
      })

      const provider = buildProvider()
      const result = await provider.getUser('user_exists')

      expect(result).toEqual({ email: 'ada@nelson.test', name: 'Ada Lovelace' })
    })

    it('returns null when the user is not found', async () => {
      clerkMock.users.getUser.mockRejectedValueOnce(
        Object.assign(new Error('not found'), { status: 404 }),
      )

      const provider = buildProvider()
      const result = await provider.getUser('user_missing')

      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Org lifecycle, members, erasure — happy path tests
  // ---------------------------------------------------------------------------

  describe('getOrg', () => {
    it('returns id + name for an existing org', async () => {
      clerkMock.organizations.getOrganization.mockResolvedValueOnce({
        id: 'org_g',
        name: 'Get Me',
      })

      const provider = buildProvider()
      const result = await provider.getOrg('org_g')
      expect(result).toEqual({ id: 'org_g', name: 'Get Me' })
    })
  })

  describe('updateOrgName', () => {
    it('calls updateOrganization with new name', async () => {
      clerkMock.organizations.updateOrganization.mockResolvedValueOnce({ id: 'org_u' })

      const provider = buildProvider()
      await provider.updateOrgName({ orgId: 'org_u', name: 'Renamed Inc' })

      expect(clerkMock.organizations.updateOrganization).toHaveBeenCalledWith('org_u', {
        name: 'Renamed Inc',
      })
    })
  })

  describe('inviteMember', () => {
    it('returns invitationId on success', async () => {
      clerkMock.organizations.createOrganizationInvitation.mockResolvedValueOnce({
        id: 'inv_1',
      })

      const provider = buildProvider()
      const result = await provider.inviteMember({
        orgId: 'org_inv',
        email: 'invitee@acme.test',
        role: 'admin',
      })

      expect(result).toEqual({ invitationId: 'inv_1' })
    })
  })

  describe('listOrgMembers', () => {
    it('returns userId + email + role for each member', async () => {
      clerkMock.organizations.getOrganizationMembershipList.mockResolvedValueOnce({
        data: [
          {
            publicUserData: {
              userId: 'user_a',
              identifier: 'a@acme.test',
            },
            role: 'admin',
          },
          {
            publicUserData: {
              userId: 'user_b',
              identifier: 'b@acme.test',
            },
            role: 'basic_member',
          },
        ],
      })

      const provider = buildProvider()
      const result = await provider.listOrgMembers('org_list')
      expect(result).toEqual([
        { userId: 'user_a', email: 'a@acme.test', role: 'admin' },
        { userId: 'user_b', email: 'b@acme.test', role: 'basic_member' },
      ])
    })
  })

  describe('deleteUser', () => {
    it('calls Clerk users.deleteUser', async () => {
      clerkMock.users.deleteUser.mockResolvedValueOnce(undefined)

      const provider = buildProvider()
      await provider.deleteUser('user_del')

      expect(clerkMock.users.deleteUser).toHaveBeenCalledWith('user_del')
    })

    it('rethrows on failure (caller decides retry policy)', async () => {
      clerkMock.users.deleteUser.mockRejectedValueOnce(new Error('500 from Clerk'))

      const provider = buildProvider()
      await expect(provider.deleteUser('user_x')).rejects.toThrow('500 from Clerk')
    })
  })

  describe('deleteOrg', () => {
    it('calls Clerk organizations.deleteOrganization', async () => {
      clerkMock.organizations.deleteOrganization.mockResolvedValueOnce(undefined)

      const provider = buildProvider()
      await provider.deleteOrg('org_del')

      expect(clerkMock.organizations.deleteOrganization).toHaveBeenCalledWith('org_del')
    })
  })

})
