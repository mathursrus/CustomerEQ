# Layout Patterns — Annex Cloud

## Page Templates

### 1. Marketing/Landing Page (Most Common)
Used by: Homepage, Platform Overview, Capabilities Overview, Use Cases

```
┌─────────────────────────────────────────┐
│ STICKY NAV (logo + hamburger)           │
├─────────────────────────────────────────┤
│ HERO SECTION                            │
│  [H1 + subtext + CTA] | [Hero Image]   │
├─────────────────────────────────────────┤
│ STATS BAR (dark navy)                   │
│  [Stat 1] | [Stat 2] | [Stat 3]        │
├─────────────────────────────────────────┤
│ FEATURE SECTION 1                       │
│  [Image] | [H2 + features list]         │
├─────────────────────────────────────────┤
│ FEATURE SECTION 2 (alternated)          │
│  [H2 + features list] | [Image]         │
├─────────────────────────────────────────┤
│ SOCIAL PROOF / TESTIMONIALS             │
│  [Testimonial carousel]                 │
├─────────────────────────────────────────┤
│ CTA BANNER (purple)                     │
│  [H2] [Request a demo →]               │
├─────────────────────────────────────────┤
│ RESOURCES SECTION                       │
│  [Resource Card] [Resource Card] ...    │
├─────────────────────────────────────────┤
│ FOOTER                                  │
└─────────────────────────────────────────┘
```

### 2. Capability Feature Page
Used by: Gamification, Social Loyalty, Advanced Segmentation, Progressive Profiling, etc.

```
┌─────────────────────────────────────────┐
│ STICKY NAV                              │
├─────────────────────────────────────────┤
│ HERO (H1 + subtext + CTA + Image)      │
├─────────────────────────────────────────┤
│ STATS BAR (3 key metrics)               │
├─────────────────────────────────────────┤
│ VALUE PROP SECTION                      │
│  Icon grid (3-4 feature cards)          │
├─────────────────────────────────────────┤
│ HOW IT WORKS (alternating sections)     │
├─────────────────────────────────────────┤
│ CTA BANNER                              │
├─────────────────────────────────────────┤
│ FOOTER                                  │
└─────────────────────────────────────────┘
```

### 3. Demo Request / Form Page
Used by: /request-demo/

```
┌─────────────────────────────────────────┐
│ STICKY NAV                              │
├─────────────────────────────────────────┤
│ SPLIT LAYOUT                            │
│  [Benefits list + partner logos]  |  [Form]  │
├─────────────────────────────────────────┤
│ FOOTER                                  │
└─────────────────────────────────────────┘
```

---

## Grid Systems

### 3-Column Feature Grid
- Used for capability cards, feature lists
- Responsive: 3 col desktop → 2 col tablet → 1 col mobile
- Card: Icon (top) + H4 heading + paragraph

### 4-Column Use Case Grid
- Used on /use-cases/ for browsable cards
- Filterable by category
- Each card: Icon + Title + Short description + "See use case" CTA

### 2-Column Split Layout
- Image + Content (alternating sides)
- Used for feature deep-dives on platform pages

---

## Responsive Behavior

- **Mobile-first**: Hamburger nav, stacked layouts
- **Breakpoints**: ~768px (tablet), ~1024px (desktop)
- **Images**: Scale proportionally, some hidden on mobile
- **Cards**: Single column stacking on mobile
- **Navigation**: Full mega-menu on desktop, collapsed drawer on mobile

---

## Section Spacing

- **Hero sections**: Large padding (~80-100px vertical)
- **Feature sections**: Medium padding (~60px vertical)
- **CTA banners**: Medium padding (~60px vertical)
- **Footer**: Large padding, multi-column

---

## Interactive Patterns

### Carousel/Slider
- Prev/Next arrow controls
- Dot indicator tabs (numbered)
- Auto-rotation on homepage hero
- Manual control on feature carousels

### Tabs / Filter
- Horizontal tab bar for capability categories (Engage/Personalize/Retain/Advocate)
- Pill-style filter buttons on use cases page

### Accordion / Expandable
- FAQ pages use accordion pattern
- Mobile nav uses collapsible menu

### Modals
- Cookie consent uses overlay modal (bottom sheet style)
- No other modals observed in marketing pages

---

## Typography Scale

| Element | Size (approx) | Weight | Color |
|---------|--------------|--------|-------|
| H1 | 36-48px | 700 Bold | Dark navy |
| H2 | 28-36px | 700 Bold | Dark navy |
| H3 | 22-24px | 600 SemiBold | Dark navy |
| H4 | 18-20px | 600 SemiBold | Dark navy |
| Body | 16px | 400 Regular | Gray |
| Caption | 13-14px | 400 Regular | Medium gray |
| CTA label | 16px | 600 SemiBold | White/Purple |

---

## Animation & Motion

- Subtle fade-in on scroll for sections
- Carousel slide transitions
- Button hover: background darkens
- No heavy animations or parallax observed
