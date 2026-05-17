class SupportResolution {
  resolved bool                @description("true only when the customer's issue is clearly handled or the customer indicated they no longer need help")
  confidence float             @description("0.0 - 1.0; bias toward NOT resolving when ambiguous — false positives award points incorrectly")
  reason string                @description("one sentence rationale for the decision")
}

function ClassifyResolution(messages: SupportHistoryMessage[], hours_since_last: float) -> SupportResolution {
  client GPT4oMini
  prompt #"
    You are deciding whether a customer support conversation has been
    resolved, based on the message history. A conversation is RESOLVED
    when the customer's question has been answered AND the customer
    either (a) explicitly acknowledged ("thanks, that worked"), (b) stopped
    replying for >24h after a clear answer, or (c) marked it themselves.

    A conversation is NOT resolved when: the answer was partial; the customer
    raised a follow-up; the agent promised to follow up later; the question
    requires action that's still pending (e.g. "I'll process your refund").

    Bias toward NOT resolved when ambiguous. False positives award loyalty
    points incorrectly. Confidence below 0.7 should never be acted on.

    Hours since the last message: {{ hours_since_last }}

    Messages (oldest first):
    {{ messages }}

    {{ ctx.output_format }}
  "#
}

test resolutionEmptyHistory {
  functions [ClassifyResolution]
  args {
    messages []
    hours_since_last 26.0
  }
}
