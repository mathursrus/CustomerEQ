// Tests for DiscoverClusters function
// Run with: npx baml-cli test

test DiscoverFromScratch {
  functions [DiscoverClusters]
  args {
    unassigned_feedback [
      { id "r1", text "Shipping took way too long, 3 weeks for a local order", sentiment -0.6 },
      { id "r2", text "Product quality is excellent, exactly as described", sentiment 0.8 },
      { id "r3", text "Your checkout page crashed on mobile twice", sentiment -0.4 },
      { id "r4", text "Delivery was fast but the packaging was damaged", sentiment -0.2 },
      { id "r5", text "Love the rewards program, earned enough points for a free item", sentiment 0.9 },
      { id "r6", text "Mobile app keeps logging me out, very frustrating", sentiment -0.5 },
      { id "r7", text "Great product but the price increase was disappointing", sentiment 0.1 }
    ]
    existing_clusters []
  }
}

test AssignToExistingClusters {
  functions [DiscoverClusters]
  args {
    unassigned_feedback [
      { id "r10", text "Package arrived open and items were missing", sentiment -0.7 },
      { id "r11", text "Support agent resolved my issue in under 5 minutes", sentiment 0.8 },
      { id "r12", text "The new pricing tier doesn't make sense for small teams", sentiment -0.3 }
    ]
    existing_clusters [
      { label "Shipping & Packaging", description "Issues with delivery and package condition", keywords ["shipping", "delivery", "package", "damaged"] },
      { label "Customer Support", description "Experiences with the support team", keywords ["support", "agent", "help", "ticket"] },
      { label "Pricing Concerns", description "Feedback about pricing and value", keywords ["price", "cost", "expensive", "value"] }
    ]
  }
}
