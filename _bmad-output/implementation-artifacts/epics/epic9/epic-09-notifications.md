---
epic: 9
title: "Notifications & Communication"
status: ready
priority: P1
totalStories: 4
frsConvered: ["FR80-FR84e"]
nfrsAddressed: ["NFR-P5", "NFR-S1"]
dependencies: ["Epic 1", "Epic 4", "Epic 5", "Epic 6"]
createdAt: 2026-01-22
---

# Epic 9: Notifications & Communication

## Epic Goal

Users receive timely notifications about important events and POs can communicate effectively with DUs through the platform.

## User Outcome

No important events are missed: submissions are acknowledged, deadlines are reminded, approvals/rejections are communicated, and billing alerts keep subscriptions active.

## Requirements Covered

### Functional Requirements

**Notifications (10 FRs):**
- FR80: Plan submission notifications
- FR81: Plan approval/rejection notifications
- FR82: Deadline reminder notifications
- FR83: Billing notifications
- FR84-FR84e: Custom messages, item request notifications

### Non-Functional Requirements
- NFR-P5: Dashboard pages load within 1 second
- NFR-S1: Complete tenant data isolation

## Implementation Notes

- Email delivery via Resend through NestJS microservice
- In-app notifications via Convex subscriptions
- Notification preferences stored per user
- Critical notifications bypass "do not disturb" settings
- All notifications logged for audit trail

---

## Story Delivery Map

- `Story 9.1` achieves notification coverage for core plan-state changes. Delivery should connect submission and review events to template-driven email and in-app messages with enough context for recipients to act.
- `Story 9.2` achieves deadline awareness before users miss a window. Delivery should schedule reminder triggers, respect tenant-configured timelines, and present countdown messaging in a way that supports action rather than noise.
- `Story 9.3` achieves reliable communication around billing state. Delivery should tie invoice, payment, grace-period, and suspension events to the correct tenant-admin channels so financial state changes are not silent.
- `Story 9.4` achieves the conversational layer around custom requests and PO-to-DU communication. Delivery should support targeted notifications, approval or denial outcomes, and custom messages without creating untraceable side channels.

---

## Stories

### Story 9.1: Plan Workflow Notifications

As a **platform user**,
I want to receive notifications about plan submissions and decisions,
So that I stay informed about the procurement planning process.

**Acceptance Criteria:**

**Given** a DU submits their plan
**When** submission is processed
**Then** system sends email notification to assigned PO (FR80)
**And** email includes: department name, submission time, plan summary, link to review

**Given** a DU submits their plan
**When** submission is processed
**Then** system sends in-app notification to PO
**And** notification appears in PO's notification center

**Given** a PO approves a plan
**When** approval is saved
**Then** system sends email notification to DU (FR81)
**And** email includes: approval confirmation, any comments, next steps

**Given** a PO rejects a plan
**When** rejection is saved
**Then** system sends email notification to DU (FR81)
**And** email includes: rejection reason, flagged items, revision deadline

**Given** plan status changes
**When** user is logged in
**Then** in-app notification appears immediately
**And** notification badge updates

**Technical Notes:**
- Notifications triggered via Convex functions on status change
- Email templates stored in NestJS service
- In-app notifications in `notifications` table with Convex subscription
- PO assignment from department's `assignedPoId` field

---

### Story 9.2: Deadline & Reminder Notifications

As a **platform user**,
I want to receive reminders about approaching deadlines,
So that I complete my tasks on time.

**Acceptance Criteria:**

**Given** a submission deadline is approaching
**When** 7 days remain
**Then** system sends reminder email to all DUs who haven't submitted (FR82)
**And** email includes: deadline date/time, days remaining, link to plan

**Given** a submission deadline is approaching
**When** 3 days remain
**Then** system sends second reminder email to non-submitting DUs
**And** email urgency is increased ("Action Required")

**Given** a submission deadline is approaching
**When** 1 day remains
**Then** system sends final reminder email
**And** email marked as "URGENT: Deadline Tomorrow"

**Given** PO has pending item requests
**When** deadline is approaching (3 days)
**Then** system sends reminder to PO about unprocessed requests (FR84d)
**And** email lists pending requests with counts

**Given** a DU has pending item request
**When** submission deadline passes
**Then** system notifies DU that request expired (FR84e)
**And** email explains request can be resubmitted next cycle

**Given** a revision deadline is approaching
**When** DU has rejected plan
**Then** system sends reminder about revision deadline

**Technical Notes:**
- Reminders via Convex cron job running daily at configured time
- Reminder schedule from tenant settings or defaults (7, 3, 1 days)
- Email urgency via subject prefix and email styling
- "Do not resend" tracking to prevent duplicate reminders

---

### Story 9.3: Billing Notifications

As a **Tenant Admin**,
I want to receive billing notifications,
So that I can manage payments and maintain uninterrupted service.

**Acceptance Criteria:**

**Given** an invoice is generated
**When** billing cycle starts
**Then** system sends invoice notification to Tenant Admin (FR83)
**And** email includes: invoice PDF attachment, amount, due date, payment link

**Given** payment is received
**When** payment is confirmed
**Then** system sends payment confirmation email (FR83)
**And** email includes: receipt, subscription status, next billing date

**Given** payment fails
**When** billing attempt fails
**Then** system sends payment failure notification
**And** email includes: reason (if available), grace period info, payment link

**Given** subscription is about to renew
**When** 30 days before renewal
**Then** system sends pre-renewal notification
**And** email includes: renewal date, amount, payment method on file

**Given** grace period is ending
**When** 2 days remain
**Then** system sends urgent payment reminder
**And** email warns of upcoming suspension

**Technical Notes:**
- Billing notifications from NestJS payment service webhooks
- Invoice PDF attached to email
- Payment failure reasons from Stripe/IntaSend error codes
- Critical billing notifications sent to all Tenant Admins

---

### Story 9.4: Item Request & Custom Notifications

As a **platform user**,
I want notifications about item requests and receive custom messages,
So that requests are processed promptly and important communications are received.

**Acceptance Criteria:**

**Given** a DU submits an item/category request
**When** request is created
**Then** system sends notification to PO (FR84a)
**And** notification includes: request type, item name, requesting department

**Given** a PO approves an item request
**When** approval is saved
**Then** system notifies DU with any modifications noted (FR84b)
**And** notification shows: original request, approved details, any changes

**Given** a PO denies an item request
**When** denial is saved
**Then** system notifies DU with reason (FR84c)
**And** notification includes: denial reason, suggestion (if any)

**Given** a PO wants to message DUs
**When** they compose a custom message
**Then** system allows sending custom messages to individual or all DUs (FR84)
**And** message delivered via email and in-app

**Given** a custom message is sent
**When** DU receives it
**Then** message appears in notification center
**And** shows: sender, timestamp, message content

**Given** notification preferences exist
**When** notifications are generated
**Then** system respects user's notification preferences
**And** critical notifications always delivered

**Technical Notes:**
- Item request notifications triggered on request status change
- Custom messages stored in `messages` table with delivery tracking
- Preference overrides for critical notifications
- Notification center UI component with unread count

---

## Story Dependency Graph

```
Story 9.1 (Plan Workflow) ── Independent
Story 9.2 (Deadlines) ── Depends on deadline configuration
Story 9.3 (Billing) ── Depends on billing system
Story 9.4 (Item Requests) ── Depends on request system
```

## Definition of Done

- [ ] All 4 stories implemented and tested
- [ ] Email delivery verified via Resend
- [ ] In-app notifications appear in real-time
- [ ] Notification preferences honored
- [ ] Cron jobs tested for deadline reminders
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
