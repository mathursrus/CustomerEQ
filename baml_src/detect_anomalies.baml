// Anomaly detection: identify unusual patterns in feedback trends

class ClusterTrend {
  cluster_label string
  cluster_description string
  daily_volumes int[] @description("Daily response counts for the past 30 days, most recent last")
  daily_avg_sentiment float[] @description("Daily average sentiment for the past 30 days")
  total_responses int
}

class Anomaly {
  cluster_label string? @description("The cluster this anomaly relates to, or null if cross-cluster")
  type string @description("One of: volume_spike, sentiment_drop, new_theme, volume_decline")
  severity string @description("One of: low, medium, high")
  summary string @description("Clear, actionable explanation of the anomaly for a CX manager")
}

class AnomalyReport {
  anomalies Anomaly[]
  overall_summary string @description("One-paragraph executive summary of the feedback health")
}

function DetectAnomalies(
  cluster_trends ClusterTrend[] @description("Trend data for all active clusters"),
  total_responses_last_30d int,
  total_responses_previous_30d int
) -> AnomalyReport {
  client GPT4oMini
  prompt #"
    You are a CX analytics expert reviewing feedback trends for anomalies.

    Overall volume: {{ total_responses_last_30d }} responses in the last 30 days (previous 30 days: {{ total_responses_previous_30d }}).

    Cluster trends (daily data for the past 30 days):
    {% for trend in cluster_trends %}

    **{{ trend.cluster_label }}** ({{ trend.total_responses }} total responses)
    {{ trend.cluster_description }}
    Daily volumes: {{ trend.daily_volumes }}
    Daily avg sentiment: {{ trend.daily_avg_sentiment }}
    {% endfor %}

    Identify anomalies:
    - **volume_spike**: Unusual increase in a cluster's daily volume (>2x recent average)
    - **sentiment_drop**: Significant sentiment decrease in a cluster
    - **new_theme**: A cluster that barely existed before but is now growing rapidly
    - **volume_decline**: A previously active cluster going quiet (could indicate a resolved issue)

    Only flag genuinely notable patterns. Don't report normal fluctuations.
    For each anomaly, write an actionable summary a CX manager can act on.

    {{ ctx.output_format }}
  "#
}

// ─── BAML Tests with Assertions ─────────────────────────────────────────────

test DetectVolumeSpike {
  functions [DetectAnomalies]
  args {
    cluster_trends [
      {
        cluster_label "Shipping Delays"
        cluster_description "Complaints about delivery times"
        daily_volumes [5 4 6 5 3 4 5 6 4 5 5 4 6 5 3 4 5 6 4 5 5 4 6 5 3 4 5 6 25 30]
        daily_avg_sentiment [-0.5 -0.4 -0.6 -0.5 -0.4 -0.5 -0.4 -0.6 -0.5 -0.4 -0.5 -0.4 -0.6 -0.5 -0.4 -0.5 -0.4 -0.6 -0.5 -0.4 -0.5 -0.4 -0.6 -0.5 -0.4 -0.5 -0.4 -0.6 -0.7 -0.8]
        total_responses 175
      }
    ]
    total_responses_last_30d 175
    total_responses_previous_30d 140
  }
}

test NoAnomaliesInStableData {
  functions [DetectAnomalies]
  args {
    cluster_trends [
      {
        cluster_label "Product Quality"
        cluster_description "Feedback about product quality"
        daily_volumes [10 11 9 10 12 10 11 9 10 12 10 11 9 10 12 10 11 9 10 12 10 11 9 10 12 10 11 9 10 12]
        daily_avg_sentiment [0.3 0.2 0.4 0.3 0.2 0.3 0.2 0.4 0.3 0.2 0.3 0.2 0.4 0.3 0.2 0.3 0.2 0.4 0.3 0.2 0.3 0.2 0.4 0.3 0.2 0.3 0.2 0.4 0.3 0.2]
        total_responses 310
      }
    ]
    total_responses_last_30d 310
    total_responses_previous_30d 300
  }
}
