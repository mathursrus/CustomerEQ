// Intent classification for customer support messages
// Used by Phase C: Support Foundation for routing and KB article suggestion

class IntentClassification {
  primary_intent string @description("One of: billing, shipping, product_question, complaint, feature_request, praise, general_inquiry, account_management, returns_refunds")
  confidence float @description("Confidence score 0.0 to 1.0")
  urgency string @description("One of: low, medium, high, critical")
  suggested_article_ids string[] @description("Up to 3 KB article IDs most relevant to this intent")
  response_outline string @description("Brief outline of how to respond to this message")
  reasoning string @description("Brief explanation of why this intent was chosen")
}

class KBArticleSummary {
  id string
  title string
  category string
}

function ClassifyIntent(
  message: string @description("The customer's message to classify"),
  kb_articles: KBArticleSummary[] @description("Available KB articles for this brand")
) -> IntentClassification {
  client GPT4oMini
  prompt #"
    You are a customer support intent classifier for a loyalty and CX platform.
    Analyze the customer message and determine their intent.

    Customer message:
    ---
    {{ message }}
    ---

    {% if kb_articles %}
    Available knowledge base articles:
    {% for article in kb_articles %}
    - ID: {{ article.id }} | Title: {{ article.title }} | Category: {{ article.category }}
    {% endfor %}

    Select up to 3 most relevant article IDs for suggested_article_ids.
    {% else %}
    No knowledge base articles available. Leave suggested_article_ids empty.
    {% endif %}

    Classify the intent, assess urgency, and suggest a response approach.

    {{ ctx.output_format }}
  "#
}
