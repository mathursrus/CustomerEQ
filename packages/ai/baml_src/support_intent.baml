class SupportIntent {
  intent string                  @description("snake_case intent label, e.g. shipping_question, refund_request, order_status, account_login, billing_dispute, returns, complaint, other")
  topic string                   @description("snake_case topic label, e.g. international_shipping, refunds, password_reset")
  sensitivity "low" | "medium" | "high"
  customer_sentiment "positive" | "neutral" | "negative"
  confidence float               @description("0.0 - 1.0")
}

class SupportHistoryMessage {
  role "CUSTOMER" | "AI" | "AGENT"
  content string
}

function ClassifySupportIntent(message: string, history: SupportHistoryMessage[]) -> SupportIntent {
  client GPT4oMini
  prompt #"
    You are classifying a customer support message for triage.

    Given the latest customer message and the prior conversation history,
    output a strict JSON object matching the SupportIntent schema.

    Guidelines:
    - Use snake_case for intent and topic.
    - sensitivity = "high" for: refunds, account cancellation, billing disputes,
      legal complaints, anything involving money owed to the customer, anything PII-sensitive.
    - sensitivity = "low" for FAQ-style queries (shipping, hours, store locations).
    - confidence is your calibrated belief, not a fixed value.

    Conversation history (oldest first):
    {{ history }}

    Latest customer message:
    {{ message }}

    {{ ctx.output_format }}
  "#
}

test classifyShipping {
  functions [ClassifySupportIntent]
  args {
    message "Do you ship to Canada?"
    history []
  }
}

test classifyRefund {
  functions [ClassifySupportIntent]
  args {
    message "I want a refund for order #1234"
    history []
  }
}
