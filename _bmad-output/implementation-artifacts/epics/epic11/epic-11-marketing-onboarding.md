---
epic: 11
title: "Marketing Landing & User Onboarding"
status: in-progress
priority: P0
totalStories: 4
frsConvered: ["FR90-FR94"]
nfrsAddressed: ["NFR-P5"]
dependencies: ["Epic 1 Story 1.1 - Project initialization complete"]
createdAt: 2026-01-22
updatedAt: 2026-03-09
---

# Epic 11: Marketing Landing & User Onboarding

## Epic Goal

Visitors can learn about Procureline, understand pricing tiers, and reach the correct public onboarding or access path for their role. New users receive guided onboarding for quick time-to-value.

## User Outcome

The path from "What is Procureline?" to "I'm using Procureline" is smooth, informative, and friction-free. Users understand the value proposition, can compare tiers, and can reach the right auth path for institution signup, Procurement Officer access, or Department User access.

## Requirements Covered

### Functional Requirements

**Marketing & Onboarding (5 FRs):**

- FR90: Marketing landing page with feature descriptions
- FR91: Pricing tiers and comparison
- FR92: Public self-serve signup process for Free, Starter, and Professional tiers
- FR93: Onboarding flow after first login
- FR94: Contextual help within application

### Non-Functional Requirements

- NFR-P5: Dashboard pages load within 1 second

## Implementation Notes

### ✅ CURRENT STATE (Updated 2026-02-16)

**Prerequisites Complete:**
- ✅ Epic 1 Story 1.1 - Project initialization complete (Convex Ents + Next.js 16 + Convex Auth)

**Ready to Start:**
- Story 11.1 can now be implemented with full backend support available
- Public auth entry and signup flows can connect to working Convex Auth

---

- Landing page as static Next.js pages for SEO
- Landing-page pricing experience with interactive tier comparison
- Public auth entry flow integrated with Epic 1 authentication
- Onboarding wizard tracks progress per user
- Contextual help via tooltip system and help drawer

Onboarding model for this epic:
- Tenant Admin: public self-serve signup for Free, Starter, or Professional tiers
- Procurement Officer: public-facing access flow using invitation link or one-time activation code issued by a Tenant Admin
- Department User: public-facing access flow using a department-scoped access code issued by a Procurement Officer
- Platform Admin: internal-only, not part of public onboarding
- Enterprise: manual contact-sales or assisted provisioning path, not public self-serve signup

---

## Story Delivery Map

- `Story 11.1` achieves first-contact understanding of the product. Delivery should convert the marketing narrative, pricing cues, and core calls to action into a polished landing page that makes the next step obvious.
- `Story 11.2` achieves pricing clarity and self-selection. Delivery should turn plan definitions into a comparison surface that routes self-serve tiers to signup and Enterprise prospects to a manual sales path.
- `Story 11.3` achieves clean public entry into the right auth path. Delivery should present role-aware choices, explain prerequisites for PO and DU access, and route users into the correct downstream authentication flows without exposing unsafe signup paths.
- `Story 11.4` achieves guided activation after account access is established. Delivery should tailor onboarding copy, help surfaces, and progress persistence so each role can become productive quickly after first login.

---

## Stories

### Story 11.1: Marketing Landing Page ⭐ START HERE

**Priority:** P0 - FIRST STORY TO IMPLEMENT (Frontend-First Strategy)
**Target:** `webapp/src/app/page.tsx`
**Source:** Port from `docs/html/landing.html` (already updated with USD billing)

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
- **Pricing section with 4-tier grid** (Free, Starter, Professional, Enterprise in USD)
- **"Free Forever" trial banner** (not 14-day trial)
- CTA buttons ("Create Free Account", "View Pricing", "Sign In / Join")

**Given** a visitor views the landing page
**When** they want to see the product
**Then** page includes demo video or animated GIF of Blockly interface

**Given** a visitor views the landing page
**When** on mobile device
**Then** page is fully responsive and readable

**Given** the landing page
**When** search engines index it
**Then** page has proper SEO metadata: title, description, OG tags

**Given** a visitor clicks "Create Free Account"
**When** navigating to signup
**Then** system routes to `/signup` (Epic 1 Story 1.2 - Tenant Admin Registration)

**Given** a visitor clicks "Sign In / Join"
**When** navigating to authentication entry
**Then** system routes to a public auth entry page
**And** that page offers distinct paths for institution signup, Procurement Officer access, Department User access, and standard sign-in

**Technical Notes:**

- **Implementation order:** This is the FIRST story - provides immediate visual feedback
- Port existing `docs/html/landing.html` to Next.js `webapp/src/app/page.tsx`
- Landing page as Next.js static page for optimal SEO
- Animations via Framer Motion for engagement
- Demo content via embedded video or animated images
- CTA buttons link to `/signup` (Epic 1 Story 1.2), `/pricing`, and the public auth entry page
- SEO via Next.js metadata API
- **Billing:** All pricing in USD, annual billing aligned to Kenya Fiscal Year (July 1 - June 30)

---

### Story 11.2: Pricing Experience & Tier Comparison

As a **visitor**,
I want to see pricing options and compare tiers,
So that I can choose the right plan for my organization.

**Acceptance Criteria:**

**Given** a visitor navigates to `/pricing`
**When** the route resolves
**Then** system deep-links the visitor to the landing page pricing section (`/#pricing`)
**And** displays pricing tiers and comparison (FR91)

**Given** a visitor views pricing
**When** reviewing tiers
**Then** page displays four tiers: Free, Starter, Professional, Enterprise
**And** each tier shows: price, user limits, features included

**Given** a visitor views pricing
**When** comparing tiers
**Then** the pricing surface clearly indicates plan differences (limits and features)
**And** comparison can be represented as card-based side-by-side tiers

**Given** pricing is displayed
**When** visitor views amounts
**Then** prices are shown in USD with annual billing context
**And** fiscal-year alignment is communicated

**Given** a visitor selects the Free, Starter, or Professional tier
**When** clicking "Get Started" on a tier
**Then** system routes to signup with tier pre-selected
**And** selected tier is preserved through verification and applied during tenant creation

**Given** Enterprise tier
**When** visitor clicks "Get Started"
**Then** system shows an in-app "Contact Sales" form instead of signup
**And** form submission creates a `salesInquiry` record

**Given** a visitor has questions
**When** viewing the pricing section
**Then** FAQ section addresses common pricing questions

**Given** invalid or unsupported tier query params
**When** signup flow continues
**Then** system safely falls back to Free tier

**Technical Notes:**

- Pricing section rendered on landing page
- `/pricing` route redirects/deep-links to `/#pricing`
- Tier data from configuration file
- Currency toggle is optional and can be deferred
- FAQ section with accordion component
- Contact Sales creates `salesInquiry` record
- Tier preselection from pricing CTA must persist across signup and verification workflows

---

### Story 11.3: Public Role-Based Auth Entry

As a **public visitor who needs access**,
I want a clear role-based auth entry page,
So that I can choose the correct path to create or access my account without confusion.

**Acceptance Criteria:**

**Given** a visitor navigates to the public auth entry page
**When** the page loads
**Then** system displays clear access choices for:

- Create Institution Account
- Procurement Officer Access
- Department User Access
- Sign In

**Given** a visitor selects "Create Institution Account"
**When** they continue
**Then** system routes them to the tenant signup flow
**And** signup supports Free, Starter, and Professional tier self-serve institution creation

**Given** a visitor selects "Procurement Officer Access"
**When** they view that path
**Then** system explains they must have either:

- an invitation link from their Tenant Admin
- a one-time activation code issued by their Tenant Admin

**Given** a visitor selects "Department User Access"
**When** they view that path
**Then** system explains they need a department access code from their Procurement Officer
**And** they are routed toward the DU access-code login flow defined in Epic 1

**Given** a visitor selects "Sign In"
**When** they continue
**Then** system routes them to the standard email/password login flow for existing eligible accounts

**Given** a visitor attempts to join without the required credential
**When** they are on the PO or DU path
**Then** system does not offer public self-signup for those roles
**And** instead explains the prerequisite invite or access-code requirement

**Technical Notes:**

- This story owns the public routing and explanatory UX, not the downstream auth mechanics
- PO onboarding credentials must be tenant-scoped and person-specific
- DU access must remain department-scoped
- The public auth entry must not introduce or imply a tenant-wide shared onboarding key

---

### Story 11.4: First-Login Onboarding & Contextual Help

As a **newly authenticated user**,
I want a guided onboarding experience,
So that I can quickly understand how to use Procureline.

**Acceptance Criteria:**

**Given** a user completes signup or account activation
**When** they log in for the first time
**Then** system displays onboarding flow (FR93)
**And** flow guides through initial setup

**Given** the onboarding flow
**When** user progresses through steps
**Then** flow includes:

- Welcome message with value proposition
- Role-aware onboarding copy based on the authenticated user's role
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

## Revised Dependency Graph

```
Story 11.1 (Landing Page)
  -> Story 11.2 (Pricing)
    -> Story 11.3 (Public Auth Entry)
      -> Story 11.4 (Onboarding & Help)
```

## Definition of Done

- [ ] All 4 stories implemented and tested
- [ ] Landing page loads quickly (<2s)
- [ ] SEO metadata verified with testing tools
- [ ] Pricing experience accurate and responsive (landing section + `/pricing` deep-link)
- [ ] Signup flow tested end-to-end
- [ ] Onboarding tour completes smoothly
- [ ] Contextual help renders correctly
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
