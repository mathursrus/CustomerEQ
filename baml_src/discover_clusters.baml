// Batch clustering: discover themes from unassigned feedback

class FeedbackItem {
  id string
  text string
  sentiment float
}

class ClusterDefinition {
  label string @description("Short, descriptive cluster label, e.g. 'Shipping Delays'")
  description string @description("One-sentence description of what feedback in this cluster is about")
  keywords string[] @description("3-5 representative keywords for this cluster")
}

class ClusterAssignment {
  feedback_id string
  cluster_label string @description("The label of the cluster this feedback belongs to")
}

class MergeRecommendation {
  from_labels string[] @description("Labels of clusters that should be merged")
  into_label string @description("The label for the merged cluster")
  reason string
}

class ClusteringResult {
  new_clusters ClusterDefinition[] @description("Newly discovered clusters from the unassigned feedback")
  assignments ClusterAssignment[] @description("Assignment of each feedback item to a cluster (new or existing)")
  merge_recommendations MergeRecommendation[] @description("Suggestions for merging similar existing clusters")
}

function DiscoverClusters(
  unassigned_feedback FeedbackItem[] @description("Feedback items not yet assigned to a cluster"),
  existing_clusters ClusterDefinition[] @description("Currently known clusters")
) -> ClusteringResult {
  client GPT4o
  prompt #"
    You are a customer experience analyst performing thematic analysis on customer feedback.

    {{ if existing_clusters }}
    Existing feedback clusters:
    {% for cluster in existing_clusters %}
    - {{ cluster.label }}: {{ cluster.description }} (keywords: {{ cluster.keywords }})
    {% endfor %}
    {{ else }}
    No existing clusters yet. Discover the natural themes in this feedback.
    {{ endif }}

    Unassigned feedback to analyze:
    {% for item in unassigned_feedback %}
    [{{ item.id }}] (sentiment: {{ item.sentiment }}) {{ item.text }}
    {% endfor %}

    Tasks:
    1. Identify natural themes/clusters in the unassigned feedback. Create new cluster definitions for themes not covered by existing clusters.
    2. Assign each feedback item to either an existing cluster or a new cluster you've defined.
    3. If any existing clusters are very similar and should be merged, recommend merges.

    Keep clusters specific and actionable (e.g. "Checkout Process Confusion" not just "UX Issues").
    Aim for 3-10 total clusters per brand. Don't over-fragment.

    {{ ctx.output_format }}
  "#
}

// ─── BAML Tests with Assertions ─────────────────────────────────────────────

test DiscoverFromScratch {
  functions [DiscoverClusters]
  args {
    unassigned_feedback [
      { id "f1" text "Shipping took way too long, 3 weeks!" sentiment -0.7 }
      { id "f2" text "Package arrived damaged, box was crushed" sentiment -0.8 }
      { id "f3" text "Love the product quality, really premium feel" sentiment 0.9 }
      { id "f4" text "Price is too high for what you get" sentiment -0.4 }
      { id "f5" text "Delivery was super fast, impressed" sentiment 0.8 }
    ]
    existing_clusters []
  }
  @@assert( {{ this.new_clusters|length >= 2 }} )
  @@assert( {{ this.assignments|length == 5 }} )
}

test AssignToExistingClusters {
  functions [DiscoverClusters]
  args {
    unassigned_feedback [
      { id "f1" text "My package was late again, this is the third time" sentiment -0.6 }
      { id "f2" text "Support agent was rude and unhelpful" sentiment -0.9 }
    ]
    existing_clusters [
      { label "Shipping Delays" description "Complaints about delivery times" keywords ["shipping" "delivery" "late"] }
      { label "Customer Support" description "Issues with support interactions" keywords ["support" "agent" "help"] }
    ]
  }
  @@assert( {{ this.assignments|length == 2 }} )
  @@assert( {{ this.new_clusters|length == 0 }} )
}
