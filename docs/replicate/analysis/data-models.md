# Data Models — Annex Cloud (Inferred)

> All models are inferred from observed UI, forms, feature descriptions, and integration patterns. These represent the entities a replication would need to implement.

---

## Core Entities

### Member (Loyalty Program Participant)

```
Member {
  id: UUID
  email: string (unique, required)
  firstName: string
  lastName: string
  phone: string (optional)

  // Profile
  profileAttributes: JSON  // unlimited custom attributes (progressive profiling)
  tier: TierRef
  pointBalance: integer
  lifetimePoints: integer
  enrollmentDate: datetime
  lastActivityDate: datetime

  // Zero/First-party data
  surveyResponses: SurveyResponse[]
  profileCompleteness: float (0-1)

  // Segmentation
  segments: Segment[]
  rfmScore: RFMScore

  // Channels
  emailOptIn: boolean
  smsOptIn: boolean
  socialProfiles: SocialProfile[]

  // Metadata
  brandId: UUID  // for multi-brand instances
  regionId: UUID
  sourceChannel: string
  createdAt: datetime
  updatedAt: datetime
}
```

### LoyaltyEvent (Trackable Customer Action)

```
LoyaltyEvent {
  id: UUID
  memberId: UUID
  eventType: enum (PURCHASE, SOCIAL_SHARE, SURVEY_COMPLETE, REFERRAL, REVIEW,
                   RECEIPT_SCAN, PROFILE_UPDATE, GAMIFICATION_ACHIEVEMENT, CUSTOM)

  // Event data
  eventData: JSON  // flexible payload per event type
  channel: enum (WEB, MOBILE, POS, EMAIL, SMS, SOCIAL)

  // Points/Value
  pointsEarned: integer
  monetaryValue: float

  // Processing
  processedAt: datetime
  rulesApplied: Rule[]
  actionsTriggered: LoyaltyAction[]

  // Metadata
  externalTransactionId: string (for deduplication)
  brandId: UUID
  createdAt: datetime
}
```

### Program (Loyalty Program Configuration)

```
Program {
  id: UUID
  name: string
  type: enum (POINTS, TIERED, CASHBACK, COALITION, PAID, HYBRID)

  // Rules engine
  rules: Rule[]
  tiers: Tier[]

  // Configuration
  pointsCurrency: string
  pointsExpiry: ExpiryPolicy

  // Multi-brand
  brandId: UUID
  templateId: UUID  // for multi-template instances
  regions: Region[]

  // Status
  status: enum (DRAFT, ACTIVE, PAUSED, ARCHIVED)
  startDate: datetime
  endDate: datetime (optional)

  createdAt: datetime
  updatedAt: datetime
}
```

### Rule (Loyalty Rules Engine)

```
Rule {
  id: UUID
  programId: UUID
  name: string
  description: string

  // Trigger
  triggerEvent: LoyaltyEventType
  conditions: Condition[]  // AND/OR logic

  // Action
  actionType: enum (AWARD_POINTS, MULTIPLY_POINTS, AWARD_REWARD,
                    UPGRADE_TIER, SEND_NOTIFICATION, TRIGGER_WORKFLOW)
  actionConfig: JSON

  // Controls
  priority: integer
  maxUsesPerMember: integer (optional)
  budget: float (optional)
  spendToDate: float

  status: enum (ACTIVE, INACTIVE)
  validFrom: datetime
  validTo: datetime (optional)
}
```

### Tier

```
Tier {
  id: UUID
  programId: UUID
  name: string  // e.g., Bronze, Silver, Gold, Platinum
  rank: integer  // ordering

  // Entry criteria
  entryRequirement: TierRequirement  // points, spend, actions

  // Benefits
  benefits: TierBenefit[]
  pointsMultiplier: float
  exclusiveRewards: Reward[]

  // Retention
  retentionRequirement: TierRequirement (optional)
  downgradePeriod: integer (days)
}
```

### Reward

```
Reward {
  id: UUID
  type: enum (MERCHANDISE, GIFT_CARD, TRAVEL, CHARITY, EXPERIENCE, NFT, DISCOUNT, FREE_SHIPPING, CUSTOM)
  name: string
  description: string
  imageUrl: string

  // Value
  pointsCost: integer
  monetaryValue: float

  // Availability
  stock: integer (optional)
  isAvailable: boolean
  availableRegions: Region[]
  brands: string[]  // from rewards catalog

  // Tracking
  redemptionCount: integer

  createdAt: datetime
}
```

### Segment (Customer Segment)

```
Segment {
  id: UUID
  programId: UUID
  name: string
  description: string

  // Definition
  type: enum (STATIC, DYNAMIC, RFM)
  criteria: SegmentCriteria[]  // filter rules

  // RFM specific
  rfmRange: RFMRange (optional)

  // Membership
  memberCount: integer
  lastCalculated: datetime

  // Sharing
  isShared: boolean
  sharedWith: UUID[]  // other programs/brands
}
```

### Journey (Workflow — Journey Catalyst)

```
Journey {
  id: UUID
  programId: UUID
  name: string
  description: string

  // Builder
  steps: JourneyStep[]
  triggers: JourneyTrigger[]

  // AI
  aiRecommendations: boolean

  // Budget
  budget: float (optional)
  spendToDate: float

  // Segmentation
  targetSegments: Segment[]
  dynamicSegmentation: boolean

  // Performance
  metrics: JourneyMetrics

  status: enum (DRAFT, ACTIVE, PAUSED, COMPLETED)
  createdAt: datetime
  updatedAt: datetime
}
```

### Referral

```
Referral {
  id: UUID
  referrerId: UUID  // Member who referred
  refereeEmail: string
  refereeId: UUID (optional, set when referee joins)

  // Tracking
  referralCode: string (unique)
  channel: enum (EMAIL, SOCIAL, LINK)

  // Rewards
  referrerReward: Reward (optional)
  refereeReward: Reward (optional)
  referrerPointsAwarded: integer
  refereePointsAwarded: integer

  // Status
  status: enum (PENDING, JOINED, CONVERTED, EXPIRED)
  convertedAt: datetime (optional)

  createdAt: datetime
}
```

### Survey / Quiz / Contest

```
Survey {
  id: UUID
  programId: UUID
  type: enum (SURVEY, QUIZ, CONTEST)
  title: string
  description: string

  // Questions
  questions: SurveyQuestion[]

  // Incentives
  completionPoints: integer
  completionReward: Reward (optional)

  // Targeting
  targetSegments: Segment[]

  // Analytics
  responseCount: integer
  completionRate: float

  status: enum (DRAFT, ACTIVE, CLOSED)
  startDate: datetime
  endDate: datetime (optional)
}
```

### Report / Analytics

```
LoyaltyReport {
  programId: UUID
  reportType: enum (ENROLLMENT, ENGAGEMENT, REWARDS, FINANCIAL, MEMBER_ACTIVITY)
  dateRange: DateRange

  // Metrics
  metrics: {
    totalMembers: integer
    activeMembers: integer
    newEnrollments: integer
    pointsAwarded: integer
    pointsRedeemed: integer
    rewardsIssued: integer
    averageOrderValue: float
    repeatPurchaseRate: float
    customerLifetimeValue: float
    programROI: float
  }

  // Breakdown
  segmentBreakdown: SegmentMetrics[]
  channelBreakdown: ChannelMetrics[]
  tierBreakdown: TierMetrics[]

  generatedAt: datetime
}
```

---

## Form-Derived Models

### DemoRequest (from /request-demo/ form)

```
DemoRequest {
  firstName: string (required)
  lastName: string (required)
  workEmail: string (required, email format)
  companyName: string (required)
  phone: string (optional)
  companySize: enum (1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)
  message: text (optional)

  // Auto-populated
  submittedAt: datetime
  utmSource: string
  utmMedium: string
  utmCampaign: string
}
```

### NewsletterSubscription (from footer form)

```
NewsletterSubscription {
  workEmail: string (required, email format)
  privacyConsent: boolean (required)
  subscribedAt: datetime
}
```

---

## Integration Model

### Integration (Connected Platform)

```
Integration {
  id: UUID
  type: enum (CRM, ECOMMERCE, EMAIL, PAYMENT, ANALYTICS, CUSTOMER_SERVICE, CUSTOM)
  provider: string  // e.g., "salesforce", "shopify", "braze"
  name: string

  // Config
  credentials: EncryptedJSON
  webhookUrl: string (optional)
  syncFrequency: enum (REALTIME, HOURLY, DAILY, MANUAL)

  // Field mapping
  fieldMappings: FieldMapping[]

  // Status
  status: enum (CONNECTED, DISCONNECTED, ERROR)
  lastSyncAt: datetime
  lastError: string (optional)

  brandId: UUID
  createdAt: datetime
}
```

---

## Entity Relationships

```
Program ──┬── Tier (1:many)
          ├── Rule (1:many)
          ├── Segment (1:many)
          ├── Journey (1:many)
          ├── Survey (1:many)
          └── Integration (1:many)

Member ───┬── LoyaltyEvent (1:many)
          ├── Segment (many:many)
          ├── Referral (1:many as referrer)
          └── SurveyResponse (1:many)

LoyaltyEvent ─── Rule (many:many, via rules applied)
LoyaltyEvent ─── Reward (many:many, via actions triggered)

Organization (Brand) ─── Program (1:many)
Organization ────────── Integration (1:many)
```
