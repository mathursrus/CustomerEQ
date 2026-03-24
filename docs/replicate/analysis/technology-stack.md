# Technology Stack Analysis — Annex Cloud

> **Note**: Technologies marked ✅ are confirmed from observed evidence. Technologies marked 🔍 are inferred from patterns.

---

## Frontend (Marketing Website)

| Technology | Status | Evidence |
|-----------|--------|----------|
| WordPress | ✅ Confirmed | `wp-includes/js/jquery/jquery-migrate.min.js` in script URLs |
| jQuery | ✅ Confirmed | jQuery Migrate 3.4.1 detected in console logs |
| TooltipPro Plus | ✅ Confirmed | `/wp-content/plugins/TooltipProPlus/assets/js/tooltip.min.js` in logs |
| Custom CSS/JS | ✅ Confirmed | Site uses custom theme on top of WordPress |
| Bootstrap | 🔍 Inferred | Grid system and responsive patterns consistent with Bootstrap |
| React/Vue/Angular | ❌ Not detected | No SPA framework detected; site is WordPress MPA |

**Architecture**: Multi-Page Application (MPA) built on WordPress CMS

---

## Analytics & Marketing

| Technology | Status | Evidence |
|-----------|--------|----------|
| HubSpot | ✅ Confirmed | `js.hs-scripts.com/9462504.js` in page scripts; forms are HubSpot embeds |
| HubSpot Analytics | ✅ Confirmed | `js.hs-analytics.net/analytics/.../9462504.js` |
| Cloudflare | ✅ Confirmed | `cdn-cgi/challenge-platform/scripts/jsd/main.js` detected |
| Google Analytics | 🔍 Inferred | Listed as a supported integration; likely used internally |

---

## Infrastructure

| Component | Details | Evidence |
|-----------|---------|----------|
| CDN | Cloudflare | Cloudflare challenge platform JS detected |
| Hosting | Cloud (likely AWS or Azure) | 12 global data centers mentioned |
| SSL | HTTPS enforced | Site uses HTTPS |
| Security | Cloudflare WAF | 403 block on basic scraper, Cloudflare challenge |

---

## SaaS Platform (Loyalty Engine — Separate from Marketing Site)

The marketing website (annexcloud.com) is the public-facing WordPress site. The actual loyalty platform is a separate SaaS application. Based on product descriptions:

| Component | Technology | Notes |
|-----------|-----------|-------|
| Architecture | SaaS, API-first, Cloud-native | Explicitly stated on platform page |
| API | REST APIs + SDKs | "API-first approach", "Integrations Overview – APIs, SDKs" |
| Data Centers | 12 global | Multi-region cloud deployment |
| Certifications | SOC 2 Type 2, ISO 27001 | Security/compliance certifications |
| Database | 🔍 Relational + NoSQL | Multi-attribute member profiles, event tracking |
| Event Processing | 🔍 Event-driven | Real-time loyalty event processing described |
| ML/AI | 🔍 Custom ML models | Predictive analytics, dynamic segmentation, fraud detection |

---

## Integration Architecture

The platform supports 125+ pre-built connectors:

### CRM
- Salesforce Service Cloud
- Salesforce Commerce Cloud
- Microsoft Dynamics Service Cloud
- HubSpot

### E-Commerce
- Adobe Commerce (Magento)
- Shopify
- BigCommerce
- commercetools

### Email / Marketing Automation
- Braze
- Klaviyo
- Mailchimp
- Constant Contact
- Emarsys
- Acoustic

### Payments
- Adyen
- Stripe

### Reviews / UGC
- Bazaarvoice

### Search / Personalization
- Bloomreach

### Customer Service
- Zendesk

### Analytics
- Google Analytics

### Enterprise
- SAP Customer Data Cloud and SCPI

### Communication
- Twilio (SMS)

---

## Architectural Patterns (SaaS Platform)

### Pattern 1: Event-Driven Loyalty Engine
- Customer actions trigger events (purchase, social share, survey completion)
- Events processed in real-time by rules engine
- Rules engine evaluates loyalty actions (award points, trigger tier upgrade, send reward)
- Journey Catalyst orchestrates multi-step workflows

### Pattern 2: API-First Integration Layer
- REST APIs for all platform capabilities
- SDKs for web and mobile
- 125+ pre-built connectors via integration middleware
- Webhook support for real-time notifications

### Pattern 3: Multi-Tenant SaaS
- Multi-template & instances for multiple brands/regions
- Role-based access (CMO, marketing manager, admin roles implied)
- Spend controls and budget management per campaign
- Global data residency (12 data centers)

### Pattern 4: Data Pipeline
- Zero/first-party data collection at touchpoints
- Progressive profiling enriches member profiles over time
- Advanced segmentation with RFM analysis
- Data export to data lake, CRM, ERP

---

## Recommended Tech Stack for Replication

Based on the analysis and the CustomerEQ business context (mid-market CX-Loyalty platform), the recommended implementation stack:

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React + TypeScript | Component-based, excellent ecosystem |
| UI Framework | Tailwind CSS + shadcn/ui | Flexible, modern, rapid development |
| Backend | Node.js (Express/Fastify) or Python (FastAPI) | API-first, scalable |
| Database | PostgreSQL + Redis | Relational for members/events + cache for real-time |
| Event Processing | BullMQ or Apache Kafka | Real-time loyalty event queue |
| AI/ML | OpenAI API + custom models | Sentiment analysis, personalization |
| Auth | Auth0 or Clerk | Enterprise SSO support |
| Integrations | Zapier/n8n or custom webhooks | Initial integrations |
| Infrastructure | AWS or Azure | Multi-region, SOC2 path |
| CMS (Marketing) | Next.js | Marketing site separate from app |
