---
epic: 11
title: "Marketing Landing & User Onboarding"
status: ready
priority: P1
totalStories: 3
frsConvered: ["FR90-FR94"]
nfrsAddressed: ["NFR-P5"]
dependencies: ["Epic 1", "Epic 8"]
createdAt: 2026-01-22
---

# Epic 11: Marketing Landing & User Onboarding

## Epic Goal

Visitors can learn about Procureline, understand pricing tiers, and start using the Free tier seamlessly. New users receive guided onboarding for quick time-to-value.

## User Outcome

The path from "What is Procureline?" to "I'm using Procureline" is smooth, informative, and friction-free. Users understand the value proposition, can compare tiers, and get productive quickly after signup.

## Requirements Covered

### Functional Requirements

**Marketing & Onboarding (5 FRs):**
- FR90: Marketing landing page with feature descriptions
- FR91: Pricing tiers and comparison
- FR92: Free tier signup process
- FR93: Onboarding flow after first login
- FR94: Contextual help within application

### Non-Functional Requirements
- NFR-P5: Dashboard pages load within 1 second

## Implementation Notes

- Landing page as static Next.js pages for SEO
- Pricing page with interactive tier comparison
- Trial signup flow integrated with Epic 1 authentication
- Onboarding wizard tracks progress per user
- Contextual help via tooltip system and help drawer

---

## Stories

### Story 11.1: Marketing Landing Page

As a **visitor**,
I want to understand what Procureline offers,
So that I can decide if it's right for my organization.

**Acceptance Criteria:**

**Given** a visitor navigates to procureline.co.ke
**When** the landing page loads
**Then** system displays marketing landing page with feature descriptions (FR90)

**Given** a visitor views the landing page
**When** scrolling through content
**Then** page includes:
- Hero section with value proposition
- Problem statement (Excel chaos, manual consolidation)
- Solution overview (Blockly interface, automatic compliance)
- Feature highlights with visuals
- Customer testimonials (when available)
- CTA buttons ("Start Free Trial", "See Pricing")

**Given** a visitor views the landing page
**When** they want to see the product
**Then** page includes demo video or animated GIF of Blockly interface

**Given** a visitor views the landing page
**When** on mobile device
**Then** page is fully responsive and readable

**Given** the landing page
**When** search engines index it
**Then** page has proper SEO metadata: title, description, OG tags

**Given** a visitor clicks "Start Free"
**When** navigating to signup
**Then** system routes to Free tier signup page

**Technical Notes:**
- Landing page as Next.js static page for optimal SEO
- Animations via Framer Motion for engagement
- Demo content via embedded video or animated images
- CTA buttons link to `/signup` and `/pricing`
- SEO via Next.js metadata API

---

### Story 11.2: Pricing Page & Tier Comparison

As a **visitor**,
I want to see pricing options and compare tiers,
So that I can choose the right plan for my organization.

**Acceptance Criteria:**

**Given** a visitor navigates to Pricing
**When** the page loads
**Then** system displays pricing tiers and comparison (FR91)

**Given** a visitor views pricing
**When** reviewing tiers
**Then** page displays three tiers: Starter, Professional, Enterprise
**And** each tier shows: price, user limits, features included

**Given** a visitor views pricing
**When** comparing features
**Then** page includes feature comparison matrix
**And** clearly indicates what's included/excluded per tier

**Given** pricing is displayed
**When** visitor views amounts
**Then** prices shown in KES with optional USD toggle
**And** annual pricing with monthly equivalent shown

**Given** a visitor selects a tier
**When** clicking "Get Started" on a tier
**Then** system routes to signup with tier pre-selected

**Given** Enterprise tier
**When** visitor clicks "Get Started"
**Then** system shows "Contact Sales" form instead of signup

**Given** a visitor has questions
**When** viewing pricing page
**Then** FAQ section addresses common pricing questions

**Technical Notes:**
- Pricing page as Next.js static page
- Tier data from configuration file
- Currency toggle via client-side state
- FAQ section with accordion component
- Contact Sales creates `salesInquiry` record

---

### Story 11.3: Trial Signup & User Onboarding

As a **new user**,
I want a guided onboarding experience,
So that I can quickly understand how to use Procureline.

**Acceptance Criteria:**

**Given** a visitor wants to start using the Free tier
**When** they access the signup page
**Then** system displays Free tier signup process (FR92)
**And** form collects: email, password, organization name, role

**Given** a user completes signup
**When** they log in for the first time
**Then** system displays onboarding flow (FR93)
**And** flow guides through initial setup

**Given** the onboarding flow
**When** user progresses through steps
**Then** flow includes:
- Welcome message with value proposition
- Role selection (Tenant Admin, PO - determines flow)
- Quick tour of key features
- First action prompt (e.g., "Create your first department")
- Success celebration

**Given** a user completes onboarding
**When** they access the application
**Then** onboarding doesn't repeat unless requested
**And** "Restart Tutorial" option available in settings

**Given** a user encounters unfamiliar features
**When** they need help
**Then** system provides contextual help tooltips (FR94)
**And** "?" icons reveal feature explanations

**Given** a user needs more help
**When** they click help icon in navigation
**Then** system opens help drawer with:
- Current page documentation
- Video tutorials (if available)
- Contact support link
- FAQ section

**Given** onboarding progress
**When** user partially completes onboarding
**Then** system saves progress
**And** resumes from last step on next login

**Technical Notes:**
- Signup form validation with real-time feedback
- Onboarding state in `userOnboarding` table with step progress
- Contextual help via tooltip component with help text from content file
- Help drawer component with content loaded from MDX or API
- Tour implemented via react-joyride or similar

---

## Story Dependency Graph

```
Story 11.1 (Landing Page)
    │
    └── Story 11.2 (Pricing)
            │
            └── Story 11.3 (Signup & Onboarding)
```

## Definition of Done

- [ ] All 3 stories implemented and tested
- [ ] Landing page loads quickly (<2s)
- [ ] SEO metadata verified with testing tools
- [ ] Pricing page accurate and responsive
- [ ] Signup flow tested end-to-end
- [ ] Onboarding tour completes smoothly
- [ ] Contextual help renders correctly
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
