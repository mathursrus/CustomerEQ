// Tests for AnalyzeFeedback function
// Run with: npx baml-cli test

test AnalyzePositiveNPS {
  functions [AnalyzeFeedback]
  args {
    feedback_text "Absolutely love the product! The shipping was fast and the customer support team was incredibly helpful when I had a question."
    survey_type "NPS"
    numeric_score 9
    existing_clusters [
      { label "Shipping Experience", description "Feedback about delivery speed and packaging" },
      { label "Customer Support", description "Feedback about support team interactions" }
    ]
  }
}

test AnalyzeNegativeCSAT {
  functions [AnalyzeFeedback]
  args {
    feedback_text "Waited 3 weeks for my order and when it arrived the box was damaged. Called support twice and got disconnected both times. Terrible experience."
    survey_type "CSAT"
    numeric_score 1
    existing_clusters [
      { label "Shipping Delays", description "Complaints about long delivery times" },
      { label "Customer Support", description "Feedback about support team interactions" }
    ]
  }
}

test AnalyzeSarcasticFeedback {
  functions [AnalyzeFeedback]
  args {
    feedback_text "Oh sure, I just love waiting 45 minutes on hold. Really makes my day. At least the hold music was nice, I guess."
    survey_type "CES"
    numeric_score 2
    existing_clusters []
  }
}

test AnalyzeNeutralWithNewTheme {
  functions [AnalyzeFeedback]
  args {
    feedback_text "The checkout process could use some work. Had to re-enter my address twice because the form cleared when I switched tabs."
    survey_type "NPS"
    numeric_score 6
    existing_clusters [
      { label "Shipping Delays", description "Complaints about long delivery times" },
      { label "Product Quality", description "Feedback about product defects or quality" }
    ]
  }
}
