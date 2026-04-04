// LLM-powered KYC synthesis
// Takes Customer 360 data and produces structured behavioral analysis

class CustomerContext {
  member_status string @description("ACTIVE, INACTIVE, or ERASED")
  points_balance int
  tier_name string? @description("Current tier name or null")
  total_events int
  total_survey_responses int
  average_sentiment float? @description("Average sentiment across survey responses, -1.0 to 1.0")
  total_points_earned int
  total_points_redeemed int
  recent_event_types string[] @description("Event types from last 20 events, e.g. ['purchase', 'survey_complete']")
  recent_sentiments float[] @description("Sentiment scores from recent survey responses, newest first")
  recent_nps_scores float[] @description("NPS scores from recent survey responses, newest first")
  recent_topics string[][] @description("Topics arrays from recent survey responses")
  has_open_cases bool
  open_case_count int
  days_since_enrollment int
  days_since_last_event int? @description("Days since most recent loyalty event, or null if no events")
}

class CustomerProfileSynthesis {
  engagement_level string @description("One of: high, medium, low, dormant — based on event frequency and recency")
  sentiment_trajectory string @description("One of: improving, stable, declining — based on sentiment over time")
  preferences string[] @description("Inferred preferences from purchase patterns, redemption choices, campaign participation")
  risk_signals string[] @description("Churn indicators: declining engagement, negative sentiment trend, SLA breaches")
  recommended_actions string[] @description("Specific next-best-actions for this customer")
  summary string @description("2-3 sentence natural-language narrative of who this customer is")
}

function SynthesizeCustomerProfile(
  context: CustomerContext
) -> CustomerProfileSynthesis {
  client GPT4o
  prompt #"
    You are a customer success analyst for a loyalty program. Analyze this customer's data and produce a structured Know Your Customer (KYC) profile.

    Customer Data:
    - Status: {{ context.member_status }}
    - Points Balance: {{ context.points_balance }}
    {% if context.tier_name %}- Tier: {{ context.tier_name }}{% endif %}
    - Total Events: {{ context.total_events }}
    - Total Survey Responses: {{ context.total_survey_responses }}
    {% if context.average_sentiment %}- Average Sentiment: {{ context.average_sentiment }}{% endif %}
    - Total Points Earned: {{ context.total_points_earned }}
    - Total Points Redeemed: {{ context.total_points_redeemed }}
    - Days Since Enrollment: {{ context.days_since_enrollment }}
    {% if context.days_since_last_event %}- Days Since Last Event: {{ context.days_since_last_event }}{% endif %}
    - Open Support Cases: {{ context.open_case_count }}

    {% if context.recent_event_types %}
    Recent Event Types (newest first): {{ context.recent_event_types }}
    {% endif %}

    {% if context.recent_sentiments %}
    Recent Sentiment Scores (newest first): {{ context.recent_sentiments }}
    {% endif %}

    {% if context.recent_nps_scores %}
    Recent NPS Scores (newest first): {{ context.recent_nps_scores }}
    {% endif %}

    {% if context.recent_topics %}
    Recent Survey Topics: {{ context.recent_topics }}
    {% endif %}

    Rules:
    - engagement_level: "high" if frequent recent events (multiple per week), "medium" if regular (weekly/biweekly), "low" if infrequent (monthly or less), "dormant" if no events in 30+ days
    - sentiment_trajectory: compare recent sentiments to older ones — "improving" if trending up, "declining" if trending down, "stable" if consistent
    - preferences: infer from event types, redemption patterns, and survey topics — be specific (e.g. "experiential rewards" not "rewards")
    - risk_signals: flag declining engagement, negative sentiment trends, open SLA breaches, high points balance with no recent redemptions (disengagement signal)
    - recommended_actions: suggest 2-3 concrete, actionable steps based on the profile
    - summary: write a concise 2-3 sentence narrative — do NOT include raw PII (email, phone, full name)

    {{ ctx.output_format }}
  "#
}
