// Support response generation using AI client
// Called by the support orchestration pipeline

import { getAiClient } from '../client.js'
import type { SupportResponseResult } from '../types.js'

export async function generateSupportResponse(
  customerMessage: string,
  conversationHistory: string,
  intent: string,
  kbContext: string,
  customerContext: string,
  brandName: string,
  supportRulesContext?: string,
): Promise<SupportResponseResult> {
  const client = getAiClient()

  return client.generateSupportResponse(
    customerMessage,
    conversationHistory,
    intent,
    kbContext,
    customerContext,
    brandName,
    supportRulesContext,
  )
}
