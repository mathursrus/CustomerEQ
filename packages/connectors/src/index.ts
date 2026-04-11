import type { ProviderConnector } from './types.js'
import { fetchGoogleBusinessProfileReviews } from './google.js'
import { fetchLinkedInComments } from './linkedin.js'
import { fetchRedditPosts } from './reddit.js'
import { fetchXSearchResults } from './x.js'

/**
 * Registry of provider-specific connectors.
 * GENERIC_WEBHOOK and GENERIC_API sources use the existing samplePayloads fallback.
 */
export const CONNECTORS: Partial<Record<string, ProviderConnector>> = {
  GOOGLE_BUSINESS_PROFILE: fetchGoogleBusinessProfileReviews,
  LINKEDIN_ORG: fetchLinkedInComments,
  REDDIT: fetchRedditPosts,
  X: fetchXSearchResults,
}

export { type ProviderConnector, type ConnectorContext, type ConnectorResult } from './types.js'
export { ConnectorAuthError, ConnectorRateLimitError } from './types.js'
