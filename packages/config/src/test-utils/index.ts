// DB utilities
export { setupTestDb, getTestPrisma } from './db/setup.js'
export { teardownTestDb } from './db/teardown.js'
export { seedTestDb } from './db/seed.js'

// Factories
export { createBrand } from './factories/brand.factory.js'
export { createProgram, createProgramWithRules } from './factories/program.factory.js'
export { createMember, createConsentedMember } from './factories/member.factory.js'
export { createLoyaltyEvent, createCxEvent } from './factories/event.factory.js'
export { createReward } from './factories/reward.factory.js'
export { createCampaign, createNpsCampaign } from './factories/campaign.factory.js'
export { createRedemption } from './factories/redemption.factory.js'

// Mocks
export { mockClerkAuth, mockClerkVerifyToken } from './mocks/clerk.mock.js'
export { InMemoryQueue, createMockQueue } from './mocks/bullmq.mock.js'
export { createMockRedis } from './mocks/redis.mock.js'
export { salesforceNpsPayload, hubspotTicketPayload, invalidSignatureHeaders } from './mocks/integrations.mock.js'
export { mockEmailSend, assertEmailSent, clearEmailMock, getSentEmails } from './mocks/email.mock.js'

// Helpers
export { authenticatedRequest, unauthenticatedRequest, setTestApp, getTestApp } from './helpers/api.helper.js'
export { toHavePointsBalance, toHaveRedemption, toHaveLoyaltyEventCount } from './helpers/assert.helper.js'
