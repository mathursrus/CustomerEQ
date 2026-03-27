// Tests for DetectAnomalies function
// Run with: npx baml-cli test

test DetectVolumeSpike {
  functions [DetectAnomalies]
  args {
    cluster_trends [
      {
        cluster_label "Shipping Delays"
        cluster_description "Complaints about long delivery times"
        daily_volumes [5, 4, 6, 3, 5, 4, 5, 6, 4, 5, 3, 5, 4, 6, 5, 4, 5, 3, 5, 4, 6, 5, 4, 5, 6, 5, 4, 22, 25, 28]
        daily_avg_sentiment [-0.3, -0.4, -0.2, -0.3, -0.5, -0.3, -0.4, -0.3, -0.2, -0.3, -0.4, -0.3, -0.2, -0.3, -0.4, -0.3, -0.2, -0.3, -0.4, -0.3, -0.2, -0.3, -0.4, -0.3, -0.2, -0.3, -0.7, -0.8, -0.9, -0.8]
        total_responses 240
      },
      {
        cluster_label "Product Quality"
        cluster_description "Feedback about product defects or quality"
        daily_volumes [2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3]
        daily_avg_sentiment [0.1, 0.0, -0.1, 0.2, 0.1, 0.0, -0.1, 0.2, 0.1, 0.0, -0.1, 0.2, 0.1, 0.0, -0.1, 0.2, 0.1, 0.0, -0.1, 0.2, 0.1, 0.0, -0.1, 0.2, 0.1, 0.0, -0.1, 0.2, 0.1, 0.0]
        total_responses 60
      }
    ]
    total_responses_last_30d 300
    total_responses_previous_30d 250
  }
}
