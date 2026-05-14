import { b } from '../generated/baml_client/index.js'

export interface KBChunkForReply {
  id: string
  articleId: string
  chunkIndex: number
  content: string
  similarity: number
}

export interface Customer360 {
  memberId: string
  email: string | null
  currentTier: string | null
  pointsBalance: number | null
  recentOrderSummary: string | null
}

export interface DraftSupportReplyInput {
  message: string
  history: Array<{ role: 'CUSTOMER' | 'AI' | 'AGENT'; content: string }>
  kbChunks: KBChunkForReply[]
  customer360: Customer360 | null
  brandVoice: string
}

export interface DraftSupportReplyResult {
  reply: string
  citedChunkIds: string[]
  confidence: number
  shouldEscalate: boolean
  reason: string | null
}

export async function draftSupportReply(
  input: DraftSupportReplyInput,
): Promise<DraftSupportReplyResult> {
  const raw = await b.DraftSupportReply(
    input.message,
    input.history,
    input.kbChunks.map((c) => ({
      id: c.id,
      article_id: c.articleId,
      chunk_index: c.chunkIndex,
      content: c.content,
      similarity: c.similarity,
    })),
    input.customer360
      ? {
          member_id: input.customer360.memberId,
          email: input.customer360.email,
          current_tier: input.customer360.currentTier,
          points_balance: input.customer360.pointsBalance,
          recent_order_summary: input.customer360.recentOrderSummary,
        }
      : null,
    input.brandVoice,
  )
  return {
    reply: raw.reply,
    citedChunkIds: raw.cited_chunk_ids,
    confidence: raw.confidence,
    shouldEscalate: raw.should_escalate,
    reason: raw.reason ?? null,
  }
}
