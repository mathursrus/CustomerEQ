// Per-response feedback analysis
// Called for each survey response with open-ended text

class ExistingCluster {
  label string
  description string
}

class FeedbackAnalysis {
  sentiment float @description("Sentiment score from -1.0 (very negative) to 1.0 (very positive)")
  confidence float @description("Confidence in the sentiment score, 0.0 to 1.0")
  topics string[] @description("Key topics/themes mentioned in the feedback, e.g. ['shipping delays', 'product quality']")
  summary string @description("One-sentence summary of the feedback")
  assigned_cluster_label string? @description("Label of the existing cluster this feedback belongs to, or null if none fit")
  suggested_new_cluster_label string? @description("If no existing cluster fits, suggest a label for a new cluster, or null")
}

function AnalyzeFeedback(
  feedback_text string,
  survey_type string @description("One of: NPS, CSAT, CES, CUSTOM"),
  numeric_score int? @description("The numeric score given (e.g. NPS 0-10, CSAT 1-5)"),
  existing_clusters ExistingCluster[] @description("Currently known feedback clusters for this brand")
) -> FeedbackAnalysis {
  client ClaudeFast
  prompt #"
    You are a customer experience analyst. Analyze this survey response and extract structured insights.

    Survey type: {{ survey_type }}
    {{ if numeric_score }}Numeric score: {{ numeric_score }}{{ endif }}

    Customer feedback:
    ---
    {{ feedback_text }}
    ---

    {{ if existing_clusters }}
    Known feedback clusters for this brand:
    {{ ctx.output_format }}

    {% for cluster in existing_clusters %}
    - {{ cluster.label }}: {{ cluster.description }}
    {% endfor %}

    If this feedback clearly belongs to one of the existing clusters, set assigned_cluster_label to that cluster's label.
    If it doesn't fit any existing cluster well, set assigned_cluster_label to null and suggest a new cluster label.
    {{ else }}
    There are no existing clusters yet. Suggest a cluster label for this feedback.
    {{ endif }}

    Be nuanced about sentiment - understand sarcasm, backhanded compliments, and context.
    Extract specific topics mentioned, not generic categories.

    {{ ctx.output_format }}
  "#
}
