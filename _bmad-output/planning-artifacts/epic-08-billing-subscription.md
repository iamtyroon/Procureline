---
epic: 8
title: "Billing & Subscription System"
status: ready
priority: P1
totalStories: 5
frsConvered: ["FR71-FR79"]
nfrsAddressed: ["NFR-S1", "NFR-S2", "NFR-S3"]
dependencies: ["Epic 1", "Epic 2", "Epic 3"]
createdAt: 2026-01-22
---

# Epic 8: Billing & Subscription System

## Epic Goal

The platform supports a complete subscription lifecycle from trial to paid tiers with multiple payment methods and proper billing management.

## User Outcome

Organizations can start with a free trial, choose appropriate subscription tiers, pay via their preferred method, and have subscriptions managed automatically aligned to fiscal year cycles.

## Requirements Covered

### Functional Requirements

**Trial & Subscription (9 FRs):**
- FR71-FR72: 14-day free trial, expiration countdown
- FR73-FR74: Subscription tier selection, payment method choice
- FR75-FR76: Invoice generation, payment processing
- FR77-FR79: Feature limits, grace period, suspension

### Non-Functional Requirements
- NFR-S1: Complete tenant data isolation
- NFR-S2: All data encrypted at rest
- NFR-S3: All data encrypted in transit

## Implementation Notes

- Payment processing via NestJS microservice
- Stripe for international cards
- IntaSend for M-Pesa (Kenya)
- Bank transfer (LPO) handled manually with Platform Admin verification
- Invoices generated as PDF via NestJS service
- Subscription aligned to Kenya fiscal year (July 1 - June 30)

---

## Stories

### Story 8.1: Trial Provisioning & Management

As a **prospective customer**,
I want to start with a free trial,
So that I can evaluate Procureline before committing to a paid subscription.

**Acceptance Criteria:**

**Given** a new user completes signup
**When** their account is created
**Then** system provisions a 14-day free trial automatically (FR71)
**And** trial includes all Professional tier features

**Given** a user is on trial
**When** they view their dashboard
**Then** system displays trial expiration countdown prominently (FR72)
**And** shows: "X days remaining in trial"

**Given** trial has 7 days remaining
**When** user logs in
**Then** system sends trial expiration warning email
**And** shows upgrade CTA prominently

**Given** trial expires
**When** user attempts to log in
**Then** system redirects to upgrade page
**And** displays: "Your trial has expired. Subscribe to continue."

**Given** trial expires
**When** user has created data during trial
**Then** data is retained for 30 days in read-only mode
**And** becomes accessible upon subscription

**Technical Notes:**
- Trial status in `tenants.status: 'trial'` with `trialEndsAt` timestamp
- Trial countdown calculated client-side from `trialEndsAt`
- Trial expiration email via cron job checking approaching dates
- Post-trial data retention via `dataRetainedUntil` field

---

### Story 8.2: Subscription Tier Selection

As a **Tenant Admin**,
I want to select a subscription tier appropriate for my organization,
So that I have access to the features we need.

**Acceptance Criteria:**

**Given** a Tenant Admin views subscription options
**When** on the upgrade page
**Then** system displays available tiers: Starter, Professional, Enterprise (FR73)
**And** shows feature comparison matrix

**Given** the tier comparison
**When** Tenant Admin reviews options
**Then** each tier shows: price, user limits, features included, feature exclusions

**Given** Tenant Admin selects a tier
**When** confirming selection
**Then** system proceeds to payment method selection
**And** displays tier summary with pricing

**Given** Enterprise tier is selected
**When** Tenant Admin proceeds
**Then** system shows "Contact Sales" instead of direct checkout
**And** creates sales inquiry with tenant details

**Given** pricing is displayed
**When** Tenant Admin views options
**Then** system shows annual pricing aligned to fiscal year
**And** displays monthly equivalent for reference

**Technical Notes:**
- Tiers defined in configuration with features, limits, pricing
- Tier selection creates `subscriptionIntent` record
- Enterprise inquiry creates `salesInquiry` record
- Pricing displayed in KES with optional USD equivalent

---

### Story 8.3: Payment Processing

As a **Tenant Admin**,
I want to pay for my subscription using my preferred method,
So that the subscription is activated smoothly.

**Acceptance Criteria:**

**Given** a Tenant Admin proceeds to payment
**When** selecting payment method
**Then** system offers: Bank Transfer (LPO), M-Pesa, Credit/Debit Card (FR74)

**Given** Tenant Admin selects Bank Transfer
**When** proceeding with payment
**Then** system generates invoice with bank details and LPO reference
**And** subscription activates upon Platform Admin verification

**Given** Tenant Admin selects M-Pesa
**When** proceeding with payment
**Then** system initiates IntaSend M-Pesa payment request
**And** Tenant Admin receives STK push on phone
**And** subscription activates upon payment confirmation

**Given** Tenant Admin selects Card Payment
**When** proceeding with payment
**Then** system displays Stripe payment form
**And** subscription activates upon successful charge

**Given** payment is successful
**When** subscription is activated
**Then** system updates tenant status to 'active' (FR76)
**And** sends confirmation email with receipt
**And** unlocks tier features immediately

**Given** payment fails
**When** error occurs
**Then** system displays clear error message
**And** allows retry with same or different method

**Technical Notes:**
- Stripe integration via @stripe/stripe-js and stripe-node
- IntaSend integration via REST API
- Bank transfer creates pending subscription awaiting verification
- Payment webhooks update subscription status
- All payment data handled by NestJS microservice (PCI compliance)

---

### Story 8.4: Invoice Management

As a **Tenant Admin**,
I want proper invoices for my payments,
So that I can maintain financial records and process institutional payments.

**Acceptance Criteria:**

**Given** a subscription is created
**When** billing cycle starts
**Then** system generates invoice aligned to fiscal year (FR75)
**And** invoice dated at start of billing period

**Given** an invoice is generated
**When** Tenant Admin views billing
**Then** system displays invoice with: invoice number, date, amount, status

**Given** an invoice exists
**When** Tenant Admin clicks download
**Then** system provides PDF with: institution details, line items, payment instructions

**Given** payment is received
**When** processing completes
**Then** system marks invoice as paid
**And** attaches payment receipt

**Given** subscription renews
**When** approaching renewal date (30 days)
**Then** system generates draft invoice for upcoming period
**And** sends notification to Tenant Admin

**Technical Notes:**
- Invoices in `invoices` table with `tenantId`, `amount`, `status`, `dueDate`
- PDF generation via NestJS with PDFKit
- Invoice numbering: [TenantCode]-[FiscalYear]-[Sequence]
- Draft invoices have `status: 'draft'` until finalized

---

### Story 8.5: Subscription Lifecycle Management

As a **system**,
I want to manage subscription status changes automatically,
So that tenants have appropriate access based on payment status.

**Acceptance Criteria:**

**Given** a tenant has a subscription
**When** accessing features
**Then** system enforces feature limits based on tier (FR77)
**And** displays upgrade prompt when limit reached

**Given** a payment fails
**When** billing cycle processes
**Then** system transitions tenant to grace period (FR78)
**And** full access maintained for 7 days
**And** warning banner displayed

**Given** grace period expires
**When** 7 days pass without payment
**Then** system suspends tenant access (FR79)
**And** redirects all users to payment page
**And** data retained but inaccessible

**Given** payment is received during suspension
**When** payment is confirmed
**Then** system immediately restores full access
**And** all data becomes accessible again

**Given** subscription is cancelled
**When** tenant requests cancellation
**Then** access maintained until end of paid period
**And** data exported upon request
**And** data deleted 90 days after expiration

**Technical Notes:**
- Subscription status: trial, active, grace, suspended, cancelled
- Status transitions via Convex cron jobs checking dates
- Feature limits checked at query level via subscription context
- Grace period: `gracePeriodEndsAt` set to payment due + 7 days
- Suspension enforced via middleware checking tenant status

---

## Story Dependency Graph

```
Story 8.1 (Trial)
    │
    └── Story 8.2 (Tier Selection)
            │
            └── Story 8.3 (Payment Processing)
                    │
                    └── Story 8.4 (Invoices)

Story 8.5 (Lifecycle) ── Parallel, interacts with all stories
```

## Definition of Done

- [ ] All 5 stories implemented and tested
- [ ] Stripe integration tested with test cards
- [ ] IntaSend M-Pesa tested in sandbox
- [ ] Bank transfer flow tested end-to-end
- [ ] Invoice PDFs render correctly
- [ ] Subscription state transitions tested
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
