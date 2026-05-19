class SupportKBChunk {
  id string
  article_id string
  chunk_index int
  content string
  similarity float
}

class SupportCustomer360 {
  member_id string
  email string?
  current_tier string?
  points_balance int?
  recent_order_summary string?
}

class SupportReply {
  reply string                       @description("the actual reply text. May be empty if should_escalate is true.")
  cited_chunk_ids string[]           @description("ids of SupportKBChunks actually used to ground the reply")
  confidence float                   @description("0.0 - 1.0 calibrated confidence in the reply's correctness")
  should_escalate bool               @description("true if the reply requires human review (sensitive action, missing info, etc.)")
  reason string?                     @description("required when should_escalate is true")
}

function DraftSupportReply(
  message: string,
  history: SupportHistoryMessage[],
  kb_chunks: SupportKBChunk[],
  customer360: SupportCustomer360?,
  brand_voice: string,
) -> SupportReply {
  client GPT4o
  prompt #"
    You are drafting a customer support reply. You MUST ground the reply in
    the provided KB chunks. Do not fabricate prices, URLs, policies, dates,
    or product details that are not in the chunks. If the chunks do not
    cover the question, set should_escalate=true and leave reply empty
    (or set it to a polite "let me hand you to a human" message).

    Brand voice: {{ brand_voice }}

    {% if customer360 %}
    Customer context:
    - Tier: {{ customer360.current_tier }}
    - Points: {{ customer360.points_balance }}
    {% endif %}

    Conversation history (oldest first):
    {{ history }}

    KB chunks (most relevant first):
    {{ kb_chunks }}

    Latest customer message:
    {{ message }}

    Cite the chunk IDs you used in cited_chunk_ids. {{ ctx.output_format }}
  "#
}

test draftShippingReply {
  functions [DraftSupportReply]
  args {
    message "Do you ship to Canada?"
    history []
    kb_chunks []
    customer360 null
    brand_voice "Friendly and concise."
  }
}
