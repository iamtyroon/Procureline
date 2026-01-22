---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - path: "_bmad-output/planning-artifacts/prd.md"
    type: "prd"
  - path: "_bmad-output/planning-artifacts/architecture.md"
    type: "architecture"
  - path: "_bmad-output/planning-artifacts/ux-design-specification.md"
    type: "ux-design"
date: 2026-01-22
author: Tyroon
status: complete
totalEpics: 11
totalStories: 64
epicDocuments:
  - epic-01-foundation-authentication.md
  - epic-02-platform-administration.md
  - epic-03-tenant-administration.md
  - epic-04-po-department-catalog.md
  - epic-05-du-blockly-planning.md
  - epic-06-plan-submission-review.md
  - epic-07-consolidation-export.md
  - epic-08-billing-subscription.md
  - epic-09-notifications.md
  - epic-10-audit-compliance.md
  - epic-11-marketing-onboarding.md
---

# Procureline - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Procureline, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Total: 464 Functional Requirements across 15 Capability Areas**

#### 1. Authentication & Access Control (14 FRs)

- FR1: Users can register for a trial account using email and organization details
- FR2: Users can log in using email and password
- FR2a: System displays clear error message for invalid email format
- FR2b: System displays clear error message for incorrect password
- FR2c: System displays message if PO account is deactivated by Tenant Admin
- FR2d: System displays message if tenant subscription is expired/suspended
- FR2e: System handles session expiration gracefully with re-login prompt
- FR2f: PO can choose "Remember me" for extended session (30 days)
- FR2g: System allows concurrent login from multiple devices
- FR2h: System displays maintenance mode message when system is unavailable
- FR3: Users can reset their password via email verification
- FR4: Users can log out and terminate their session
- FR5: Departmental Users can log in using an access code provided by their PO
- FR5a: System displays clear error message for invalid access code
- FR5b: System enforces access code expiration policy (configurable by PO)
- FR5c: DU can request access code reminder from PO via system
- FR5d: System locks DU access after 5 failed login attempts (15-min lockout)
- FR5e: System prevents DU login if submission period has not started
- FR5f: System prevents DU login if submission period has ended
- FR5g: System displays appropriate message if tenant subscription is inactive
- FR5h: System displays appropriate message if DU account is deactivated
- FR6: System can enforce role-based access control across 4 user levels
- FR7: System can restrict users to only see data within their tenant

#### 2. Platform Administration (99 FRs)

**Core (FR8-FR14):**
- FR8: Platform Admin can view a dashboard of all tenants with status indicators
- FR9: Platform Admin can view individual tenant details and usage metrics
- FR10: Platform Admin can update tenant configuration settings
- FR11: Platform Admin can view system health metrics (API, database, jobs)
- FR12: Platform Admin can view and manage subscription statuses
- FR13: Platform Admin can access support ticket activity logs
- FR14: Platform Admin can monitor trial engagement and conversion metrics

**2a. Authentication & Access (FR-PA1a-PA1j):**
- FR-PA1a: Platform Admin accesses admin portal via dedicated URL
- FR-PA1b: System requires mandatory 2FA for all Platform Admin accounts
- FR-PA1c: System provides backup codes at 2FA setup for recovery
- FR-PA1d: System blocks login from suspicious locations with verification
- FR-PA1e: System enforces 30-minute idle session timeout
- FR-PA1f: System allows concurrent sessions with activity logging
- FR-PA1h: System requires immediate credential revocation workflow
- FR-PA1i: System prevents Platform Admin account deletion
- FR-PA1j: System maintains complete audit trail of Platform Admin access

**2b. Dashboard & Monitoring (FR-PA2a-PA2j):**
- FR-PA2a: Dashboard displays system health summary (API, DB, jobs, storage)
- FR-PA2b: Dashboard displays tenant overview (active, trial, suspended, churned counts)
- FR-PA2c: Dashboard displays key revenue metrics (MRR, ARR, trial conversions)
- FR-PA2d: Dashboard displays recent alerts with severity indicators
- FR-PA2e: System auto-alerts via SMS/email for critical issues (API down, DB errors)
- FR-PA2f: Dashboard provides quick action buttons (create tenant, view logs, etc.)
- FR-PA2g: System detects and alerts on metric anomalies (unusual patterns)
- FR-PA2h: Dashboard displays all timestamps in UTC with local time tooltip
- FR-PA2i: Platform Admin can customize dashboard widget layout
- FR-PA2j: Dashboard supports alert grouping and severity-based filtering

**2c. Tenant Management (FR-PA3a-PA3o):**
- FR-PA3a: Platform Admin can view list of all tenants with status filters
- FR-PA3b: Platform Admin can create new tenant with Tenant Admin email
- FR-PA3c: System validates subdomain uniqueness and format (alphanumeric, hyphens)
- FR-PA3d: System provisions tenant infrastructure automatically
- FR-PA3e: System rolls back partial tenant creation if provisioning fails
- FR-PA3f: Platform Admin can view individual tenant details and usage
- FR-PA3g: Platform Admin can update tenant configuration settings
- FR-PA3h: Platform Admin can suspend tenant (immediately blocks access)
- FR-PA3i: Platform Admin can restore suspended tenant
- FR-PA3j: Platform Admin can initiate tenant deletion (90-day soft delete, then permanent purge)
- FR-PA3k: System auto-alerts when tenant storage reaches 90% capacity
- FR-PA3l: System auto-alerts when tenant user count exceeds tier limit
- FR-PA3m: Platform Admin can change tenant subdomain with redirect
- FR-PA3n: Platform Admin can generate complete tenant data export
- FR-PA3o: Platform Admin can override tenant configuration for troubleshooting

**2d. Subscription & Billing (FR-PA4a-PA4o):**
- FR-PA4a: Platform Admin can view all subscription statuses with filters
- FR-PA4b: Platform Admin can view revenue reports (MRR, ARR, by tier)
- FR-PA4c: Platform Admin can manually verify bank transfer payments
- FR-PA4d: System reconciles M-Pesa payments daily with retry for failures
- FR-PA4e: System processes Stripe webhooks with retry queue for failures
- FR-PA4f: Platform Admin can initiate refund with approval workflow
- FR-PA4g: System calculates pro-rated refunds automatically
- FR-PA4h: Platform Admin can apply custom pricing for Enterprise contracts
- FR-PA4i: System sends payment failure notifications to Tenant Admin
- FR-PA4j: System transitions tenant to grace period after payment failure
- FR-PA4k: System suspends tenant after grace period expires (7 days)
- FR-PA4l: Platform Admin can immediately restore tenant on payment receipt
- FR-PA4m: System generates invoices automatically with retry on failure
- FR-PA4n: Platform Admin can batch update subscription statuses
- FR-PA4o: System maintains billing audit trail with reconciliation reports

**2e. User Management Cross-Tenant (FR-PA5a-PA5j):**
- FR-PA5a: Platform Admin can search for users across all tenants
- FR-PA5b: Platform Admin can view user details and tenant associations
- FR-PA5c: Platform Admin can trigger password reset for any user
- FR-PA5d: Platform Admin can unlock locked user accounts
- FR-PA5e: Platform Admin can force logout all sessions for a user
- FR-PA5f: Platform Admin can deactivate user account (security issue)
- FR-PA5g: System supports tenant-wide user lockout for security incidents
- FR-PA5h: Platform Admin can view user activity logs with filters
- FR-PA5i: Platform Admin can process GDPR data deletion requests
- FR-PA5j: System prevents actions that would orphan a tenant (no Tenant Admin)

**2f. Trial Management (FR-PA6a-PA6j):**
- FR-PA6a: Platform Admin can view all active trials with engagement metrics
- FR-PA6b: Platform Admin can view trial-to-paid conversion funnel
- FR-PA6c: Platform Admin can extend trial (max 2 extensions, 30 days total)
- FR-PA6d: Platform Admin can flag trials for sales follow-up
- FR-PA6e: System auto-archives trials with zero engagement after 7 days
- FR-PA6f: System detects trial abuse (same org, multiple trials)
- FR-PA6g: Platform Admin can convert trial to specific subscription tier
- FR-PA6h: System provides read-only access for 7 days after trial expires
- FR-PA6i: System rate-limits trial signups to prevent spam
- FR-PA6j: Platform Admin can view expired trials with reasons

**2g. System Health (FR-PA7a-PA7j):**
- FR-PA7a: Platform Admin can view real-time API metrics (latency, error rates)
- FR-PA7b: Platform Admin can view database health (connections, query performance)
- FR-PA7c: Platform Admin can view background job status and history
- FR-PA7d: Platform Admin can view infrastructure metrics (CPU, memory, storage)
- FR-PA7e: Platform Admin can view backup status and history
- FR-PA7f: System auto-alerts when API error rate exceeds 5%
- FR-PA7g: System auto-alerts when backup fails
- FR-PA7h: System displays SSL certificate expiration warnings (30 days)
- FR-PA7i: Platform Admin can schedule and announce maintenance windows
- FR-PA7j: Platform Admin can trigger manual backup

**2h. Security & Compliance (FR-PA8a-PA8j):**
- FR-PA8a: Platform Admin can view security dashboard (threats, audit status)
- FR-PA8b: Platform Admin can run tenant data isolation verification
- FR-PA8c: Platform Admin can view cross-tenant access attempt logs
- FR-PA8d: System blocks and alerts on cross-tenant data access attempts
- FR-PA8e: Platform Admin can review all access logs with filters
- FR-PA8f: System maintains immutable audit logs with integrity verification
- FR-PA8g: Platform Admin can generate compliance reports
- FR-PA8h: Platform Admin can configure IP allowlist for Platform Admin access
- FR-PA8i: System detects unusual access patterns and alerts
- FR-PA8j: Platform Admin can initiate security incident response protocol

**2i. Support & Incidents (FR-PA9a-PA9j):**
- FR-PA9a: Platform Admin can view support ticket queue with SLA indicators
- FR-PA9b: Platform Admin can assign tickets to handlers
- FR-PA9c: Platform Admin can escalate tickets with priority override
- FR-PA9d: System auto-escalates tickets approaching SLA breach
- FR-PA9e: Platform Admin can create and manage incidents
- FR-PA9f: Platform Admin can update system status page
- FR-PA9g: Platform Admin can send announcements to all or specific tenants
- FR-PA9h: Platform Admin can schedule future announcements
- FR-PA9i: Platform Admin can merge duplicate tickets
- FR-PA9j: System generates post-incident review reminders

**2j. Configuration (FR-PA10a-PA10j):**
- FR-PA10a: Platform Admin can view and update system configuration
- FR-PA10b: Platform Admin can manage feature flags (enable/disable features)
- FR-PA10c: Platform Admin can configure feature rollout by tenant percentage
- FR-PA10d: Platform Admin can update subscription tier pricing
- FR-PA10e: System supports grandfather pricing for existing customers
- FR-PA10f: Platform Admin can update email templates with preview
- FR-PA10g: Platform Admin can enable/disable third-party integrations
- FR-PA10h: System maintains configuration version history
- FR-PA10i: Platform Admin can rollback configuration changes
- FR-PA10j: Platform Admin can export/import configuration between environments

#### 3. Tenant Administration (102 FRs)

**Core (FR15-FR22):**
- FR15: Tenant Admin can view an institutional overview dashboard
- FR16: Tenant Admin can add, edit, and remove Procurement Officers
- FR17: Tenant Admin can view PO activity logs
- FR18: Tenant Admin can view department submission status across the institution
- FR19: Tenant Admin can view budget utilization summary
- FR20: Tenant Admin can view and manage billing information
- FR21: Tenant Admin can view invoices and payment history
- FR22: Tenant Admin can update institutional settings (fiscal year, compliance rules)

**3a. Onboarding & Registration (FR-TA1a-TA1j):**
- FR-TA1a: System sends invitation email when Platform Admin creates Tenant Admin
- FR-TA1b: Invitation links expire after 72 hours with resend option
- FR-TA1c: System validates password against policy (12+ chars, uppercase, number, special)
- FR-TA1d: System requires email verification before account activation
- FR-TA1e: Email verification links expire after 24 hours with auto-resend (max 3)
- FR-TA1f: System blocks dashboard access until organization profile is complete
- FR-TA1g: Organization profile requires: name, logo, primary contact, fiscal year config
- FR-TA1h: System prevents duplicate Tenant Admin emails across all tenants
- FR-TA1i: System shows "Contact Support" if tenant is deactivated during onboarding
- FR-TA1j: System supports forgot password flow using invitation email

**3b. Dashboard (FR-TA2a-TA2j):**
- FR-TA2a: Dashboard displays summary cards: Total POs, Departments, Submission Progress, Budget
- FR-TA2b: Dashboard shows current fiscal year cycle status and timeline
- FR-TA2c: Dashboard displays recent activity feed (last 20 actions)
- FR-TA2d: Dashboard provides quick action buttons (Add PO, View Reports, Settings)
- FR-TA2e: System shows onboarding guide when no POs exist yet
- FR-TA2f: System shows countdown when submission period hasn't started
- FR-TA2g: System shows "Cycle Complete" summary after submission period ends
- FR-TA2h: Dashboard displays cached data with timestamp if real-time sync fails
- FR-TA2i: System allows switching between fiscal year views when multiple exist
- FR-TA2j: Dashboard data refreshes in real-time via Convex subscriptions

**3c. PO Management (FR-TA3a-TA3o):**
- FR-TA3a: Tenant Admin can view list of all POs with status indicators
- FR-TA3b: Tenant Admin can add new PO with name, email, phone
- FR-TA3c: System sends invitation email to new PO
- FR-TA3d: System allows same email as PO in different tenants
- FR-TA3e: System rejects duplicate PO email within same tenant
- FR-TA3f: System notifies Tenant Admin if PO invitation email bounces
- FR-TA3g: PO invitations auto-expire after 7 days with Tenant Admin notification
- FR-TA3h: Tenant Admin can deactivate PO with warning about active submission cycles
- FR-TA3i: System prevents deactivating last active PO
- FR-TA3j: Tenant Admin can reactivate deactivated PO
- FR-TA3k: System soft-deletes PO data, retaining for audit trail
- FR-TA3l: Tenant Admin can view PO activity logs with pagination and filters
- FR-TA3m: Tenant Admin can unlock PO locked out from failed login attempts
- FR-TA3n: Tenant Admin can update PO email address
- FR-TA3o: Tenant Admin can bulk import POs via CSV with row-level validation

**3d. Institutional Settings (FR-TA4a-TA4k):**
- FR-TA4a: Tenant Admin can update organization name, logo, contact info
- FR-TA4b: Tenant Admin can configure fiscal year start month and naming convention
- FR-TA4c: System applies fiscal year changes to next cycle only if active cycle exists
- FR-TA4d: Tenant Admin can set default compliance rules (AGPO %, PWD %, Local Content %)
- FR-TA4e: System validates compliance percentages (0-100 each, sum ≤100)
- FR-TA4f: System warns about mid-submission compliance rule changes requiring revalidation
- FR-TA4g: Tenant Admin can configure allowed email domains for users
- FR-TA4h: System prevents removing email domain with existing users
- FR-TA4i: System validates logo uploads (PNG/JPG/SVG, max 2MB)
- FR-TA4j: Tenant Admin can configure timezone for the institution
- FR-TA4k: System logs all settings changes with before/after values and timestamp

**3e. Billing & Subscription (FR-TA5a-TA5o):**
- FR-TA5a: Tenant Admin can view current subscription tier and included features
- FR-TA5b: Tenant Admin can view usage metrics (users only)
- FR-TA5c: Tenant Admin can view invoices and payment history
- FR-TA5d: Tenant Admin can download invoices as PDF
- FR-TA5e: Tenant Admin can update payment method
- FR-TA5f: System warns when payment method expires within 30 days
- FR-TA5g: System provides 7-day grace period after payment failure
- FR-TA5h: System suspends account (read-only) after grace period
- FR-TA5i: System retains data for 90 days after suspension
- FR-TA5j: Tenant Admin can upgrade subscription with immediate feature access
- FR-TA5k: System pro-rates charges for mid-cycle upgrades
- FR-TA5l: Tenant Admin can request downgrade effective at next renewal
- FR-TA5m: System blocks downgrade if current usage exceeds new tier limits
- FR-TA5n: System sends pre-renewal notifications (30 days, 7 days)
- FR-TA5o: Enterprise tier upgrades require "Contact Sales" flow

**3f. Reporting (FR-TA6b-TA6l):**
- FR-TA6b: Tenant Admin can generate Budget reports
- FR-TA6c: Tenant Admin can generate Activity reports
- FR-TA6d: Tenant Admin can generate Audit reports
- FR-TA6e: Tenant Admin can configure report parameters (date range, departments, format)
- FR-TA6f: System processes large reports in background with email notification
- FR-TA6g: System splits reports >50MB into multiple files
- FR-TA6h: Tenant Admin can schedule recurring reports with email delivery
- FR-TA6i: System retries failed scheduled reports 3x then notifies Tenant Admin
- FR-TA6j: Reports include "Confidential" watermark with generation timestamp
- FR-TA6k: Tenant Admin can generate time-limited secure links for external sharing (72 hours)
- FR-TA6l: System provides print-optimized format with proper pagination

**3g. Cross-Institutional Visibility (FR-TA7a-TA7h):**
- FR-TA7a: Tenant Admin can view all departments across all POs
- FR-TA7b: Tenant Admin can filter departments by PO and submission status
- FR-TA7c: Tenant Admin can drill down into department details (read-only)
- FR-TA7d: Tenant Admin can view consolidated budget across institution
- FR-TA7e: System supports virtual scrolling for 100+ departments
- FR-TA7f: System flags data anomalies and suggests PO review
- FR-TA7g: System shows PO status indicators: Not Started, In Progress, Complete
- FR-TA7h: Tenant Admin can export institutional data for GDPR compliance

**3h. Notifications (FR-TA8a-TA8h):**
- FR-TA8a: Tenant Admin receives email notifications for key events
- FR-TA8b: System provides in-app notification center
- FR-TA8c: Tenant Admin can configure notification preferences
- FR-TA8d: Tenant Admin can broadcast message to all POs
- FR-TA8e: System supports digest mode for high-notification days
- FR-TA8g: System sends critical notifications via multiple channels (email + in-app)
- FR-TA8h: System excludes Tenant Admin from notifications for own actions

**3i. Security (FR-TA9a-TA9h):**
- FR-TA9a: Tenant Admin can view login history
- FR-TA9b: Tenant Admin can enable and manage 2FA
- FR-TA9c: System provides recovery codes for 2FA at setup
- FR-TA9d: Tenant Admin can view and terminate active sessions
- FR-TA9e: System alerts on suspicious login (new location/device)
- FR-TA9f: System enforces progressive lockout for failed login attempts
- FR-TA9g: System enforces password change policy (90 days) with advance warning
- FR-TA9h: Tenant Admin can view detailed audit log with export capability

**3j. Account Lifecycle (FR-TA10a-TA10h):**
- FR-TA10a: Tenant Admin can update profile information
- FR-TA10b: Tenant Admin can change email with verification
- FR-TA10c: Tenant Admin can transfer admin role (requires both party confirmation)
- FR-TA10d: Platform Admin can assign new Tenant Admin if original leaves
- FR-TA10f: System allows Tenant Admin to hold multiple roles (also PO)
- FR-TA10g: Tenant Admin must transfer role before deleting own account
- FR-TA10h: System maintains complete audit trail for admin role transfers

#### 4. Department Management (34 FRs)

**Core (FR23-FR29):**
- FR23: PO can create new departments with name, code, and budget allocation
- FR23a: System prevents duplicate department codes within tenant
- FR23b: System prevents duplicate department names within tenant
- FR23c: System validates budget is positive number
- FR23d: System warns if total department budgets exceed institution allocation
- FR23e: System validates department code format (alphanumeric, max length)
- FR24: PO can edit existing department details
- FR24a: System warns PO before editing department with active plans
- FR24b: System notifies affected DU when department budget is changed
- FR25: PO can delete departments (with confirmation)
- FR25a: System prevents deletion of department with submitted/approved plans
- FR25b: System requires deactivation of DU accounts before department deletion
- FR25c: System archives deleted department data for audit trail
- FR26: PO can generate access codes for Departmental Users
- FR26b: PO can regenerate code, automatically invalidating previous code
- FR26c: PO can set custom expiration date for access codes
- FR26d: PO can bulk generate codes for all departments at once
- FR26e: PO can send access code directly to DU via system email
- FR26f: PO can view access code usage log (login history per code)
- FR26g: PO can manually deactivate an access code
- FR26h: System generates access codes using format: [FiscalYear]-[DeptInitials]-[RandomChars]
- FR26i: PO can copy access code to clipboard with one click
- FR27: PO can assign budget allocations to departments
- FR27a: PO can bulk import departments from Excel template
- FR27b: PO can reorder departments in list view
- FR28: PO can view all departments in a list/grid view
- FR28a: System displays onboarding wizard for first-time PO with no setup
- FR28b: System displays warning if fiscal year not configured
- FR28c: System displays warning if submission deadline not set
- FR28d: System displays empty state with guidance when no departments exist
- FR28e: System displays success state when all departments have submitted
- FR28f: System highlights overdue departments with visual indicators
- FR28g: System displays notification badge for pending item requests
- FR28h: PO can view dashboard for current and previous fiscal years
- FR28i: Dashboard data refreshes in real-time via Convex subscriptions
- FR29: PO can view individual department submission status
- FR29a: PO can view submission status breakdown (Not Started/Draft/Submitted/Rejected/Approved)
- FR29b: PO can filter departments by submission status
- FR29c: PO can send reminder to individual department
- FR29d: PO can send bulk reminder to all pending departments
- FR29e: PO can view submission timeline (when each status changed)
- FR29f: PO can export submission status report to Excel

**4b. Deadline Management (FR-DL1-DL6):**
- FR-DL1: PO can set submission deadline with date and time
- FR-DL2: System prevents setting deadline in the past
- FR-DL3: PO can extend deadline (notifies all DUs)
- FR-DL4: PO can configure reminder schedule (7 days, 3 days, 1 day before)
- FR-DL5: System handles deadline in tenant's configured timezone
- FR-DL6: System displays deadline countdown on DU and PO dashboards

#### 5. Category & Item Catalog (52 FRs)

**Core (FR30-FR37):**
- FR30: PO can create procurement categories with name and description
- FR30a: System prevents duplicate category names within tenant
- FR30b: PO can assign color/icon to category for visual distinction in Blockly
- FR30c: PO can bulk import categories from Excel template
- FR30d: PO can reorder categories for display in Blockly toolbox
- FR31: PO can edit existing category details
- FR31a: System warns PO before editing category used in active plans
- FR32: PO can delete categories (with confirmation)
- FR32a: System prevents deletion of category with assigned items
- FR32b: System prevents deletion of category used in submitted/approved plans
- FR32c: PO can archive category (hidden from new plans, visible in existing)
- FR33: PO can create procurement items with description, unit, and price
- FR33a: System prevents duplicate items within same category
- FR33b: System validates unit price is positive number
- FR33c: PO can define unit types (each, box, kg, liter, etc.)
- FR33d: PO can set minimum and maximum quantity per item
- FR33e: PO can flag items as AGPO/PWD/Local Content eligible
- FR33f: PO can bulk import items from Excel template
- FR34: PO can edit existing item details
- FR34a: System notifies DUs when item price changes (toast in active sessions)
- FR34b: System maintains item price history for audit
- FR35: PO can assign items to categories
- FR35a: PO can move items between categories
- FR35b: System prevents unassigned items (category required)
- FR36: PO can set default procurement methods for items
- FR37: PO can view the complete item catalog
- FR37-CS: PO can search items by name, description, or category
- FR37-CF: PO can filter items by category, price range, or compliance flags
- FR37-CE: PO can export item catalog to Excel

**5b. Item & Category Requests (FR37a-FR37z):**
- FR37a: DU can request a new item not currently in the catalog
- FR37b: DU can request a new category not currently in the catalog
- FR37c: DU can provide justification/description for item or category request
- FR37d: DU can view status of their pending requests (pending/approved/denied)
- FR37e: DU can receive notification when request is approved or denied
- FR37f: System prevents DU from using requested items until PO approves
- FR37g: System automatically expires pending requests at end of submission period
- FR37h: PO can view a dedicated dashboard of all pending item/category requests
- FR37i: PO can receive inline notifications for new requests
- FR37j: PO can approve an item request, adding it to the catalog
- FR37k: PO can modify/edit request details before approving
- FR37l: PO can deny an item request with a reason
- FR37m: PO can approve a category request, adding it to the catalog
- FR37n: PO can deny a category request with a reason
- FR37o: System notifies DU immediately upon approval/denial
- FR37p: System prevents request for item that already exists in catalog
- FR37q: System prevents duplicate pending requests from same DU
- FR37r: System validates request form (required: name, description, estimated price)
- FR37s: DU can cancel their pending request
- FR37t: DU can edit their pending request before PO reviews
- FR37u: System consolidates duplicate requests from multiple DUs for PO review
- FR37v: PO can bulk approve multiple requests at once
- FR37w: PO can bulk deny multiple requests with single reason
- FR37x: PO can view history of processed requests
- FR37y: PO can filter requests by department, status, or date
- FR37z: PO can undo denial within 5 minutes (if DU hasn't been notified)

#### 6. Visual Blockly Planning Interface (26 FRs)

- FR38: DU can view their department's budget allocation and remaining balance
- FR38a: DU can view submission deadline with countdown
- FR38b: DU can view current plan status (No Plan/Draft/Submitted/Rejected/Approved)
- FR38c: System displays message if no budget allocated ("Contact your PO")
- FR38d: System displays message if deadline passed (read-only mode)
- FR38e: System displays message if categories/items not set up ("Setup in progress")
- FR38f: DU can view rejection comments on dashboard if plan was rejected
- FR38g: System shows appropriate empty state for first-time DU with guidance
- FR39: DU can access a visual Blockly workspace for plan creation
- FR39a: System prevents negative quantity entry
- FR39b: System enforces integer-only quantities (or decimal if unit allows)
- FR39c: System enforces maximum quantity limit per item (configurable)
- FR39d: System blocks submission (not just warns) when budget exceeded
- FR39e: System syncs changes in real-time with offline queue support
- FR39g: System warns DU before leaving page with unsaved changes
- FR39h: System maintains local backup in browser storage for crash recovery
- FR39j: DU can clear entire plan with confirmation ("Start Over")
- FR39k: System prevents duplicate items in same category
- FR39m: System displays toast notification when item removed from catalog while in use
- FR40: DU can drag category blocks onto the workspace
- FR41: DU can drag item blocks into category blocks
- FR42: DU can enter quantities for each quarter (Q1-Q4) per item
- FR43: DU can expand and collapse block details
- FR44: DU can see real-time total calculations as quantities change
- FR45: DU can see a real-time budget meter showing utilization percentage
- FR46: DU can receive visual warnings when budget is exceeded
- FR47: DU can save plan drafts for later editing
- FR48: PO can access the same Blockly interface for plan creation and editing

#### 7. Plan Submission & Review (32 FRs)

- FR49: DU can submit a completed plan for PO review
- FR49a: System prevents double-submission (button disabled after click)
- FR49b: System displays submission confirmation with timestamp and reference number
- FR49c: DU can withdraw submitted plan if PO hasn't started review
- FR49d: System sends submission confirmation email to DU
- FR49e: System locks plan from editing after submission (read-only)
- FR50: System can validate plan completeness before submission
- FR50a: System prevents submission of empty plan (at least 1 item required)
- FR50b: System prevents submission with zero-quantity items
- FR50c: System prevents submission if pending item requests exist
- FR50d: System displays itemized validation errors with links to fix
- FR50e: System prevents submission if deadline has passed
- FR50g: System displays validation summary before final submit confirmation
- FR51: System can prevent submission of over-budget plans
- FR52: PO can view a list of all submitted plans with status
- FR53: PO can view submitted plan details in read-only mode
- FR53a: PO can view plan comparison with previous submission (diff view)
- FR53b: PO can view plan comparison with previous fiscal year
- FR53c: PO can add internal comments (not visible to DU)
- FR54: PO can approve a submitted plan
- FR54a: PO can undo approval within 24 hours if not yet consolidated
- FR55: PO can reject a plan with revision comments
- FR55a: PO can flag specific items for revision (highlighted for DU)
- FR55b: PO can request minor changes without full rejection (revision request)
- FR55c: PO can set revision deadline for rejected plans
- FR56: DU can receive notification of plan approval or rejection
- FR57: DU can view revision comments and resubmit corrected plans
- FR57a: System displays rejection comments prominently on plan edit screen
- FR57b: System highlights specific items/categories flagged by PO
- FR57c: DU can view submission history with timestamps and statuses
- FR57d: System allows resubmission until deadline (no limit)
- FR57e: System extends revision period if rejection received within 24hrs of deadline
- FR57f: DU can request plan unlock from PO if approved plan has errors

#### 8. Consolidation Workspace (19 FRs)

- FR58: PO can access a consolidation workspace view
- FR58a: System displays message if no approved plans available for consolidation
- FR58b: System displays warning showing departments not yet approved
- FR59: PO can view all approved department plans as draggable blocks
- FR59a: PO can remove department block from consolidation (returns to available)
- FR59b: PO can reorder department blocks in consolidated view
- FR60: PO can drag approved department blocks into a master aggregate plan
- FR60a: PO can save consolidation as draft for later completion
- FR61: System can calculate grand totals from all consolidated departments
- FR62: System can calculate AGPO allocation (30% of total)
- FR62a: System displays warning if AGPO target (30%) not met
- FR63: System can calculate PWD set-aside (2% of total)
- FR63a: System displays warning if PWD target (2%) not met
- FR64: System can calculate Local Content target (40% of total)
- FR64a: System displays warning if Local Content target (40%) not met
- FR65: PO can view quarterly subtotals across all departments
- FR66: PO can finalize the consolidated annual procurement plan
- FR66a: System prevents finalization if compliance targets not met (configurable)
- FR66b: PO can add notes/comments to finalized plan
- FR66c: System locks finalized plan from editing (requires unlock request)
- FR66d: PO can create multiple consolidation versions for comparison
- FR66e: PO can generate print-friendly consolidation view

#### 9. Excel Integration (12 FRs)

- FR67: PO can export the consolidated plan to GOK-compliant Excel format
- FR67a: System prevents export until consolidation is finalized
- FR67b: PO can export single department plan (before consolidation)
- FR67c: PO can export to PDF format for printing
- FR67d: System displays progress indicator for large exports
- FR67e: PO can view export history with download links
- FR67f: PO can export audit trail report separately
- FR68: System can generate Excel with proper headers, formatting, and formulas
- FR69: System can include compliance calculations in exported Excel
- FR70: System can include all item details with quarterly breakdowns in export

#### 10. Billing & Subscription (9 FRs)

- FR71: System can provision a 14-day free trial on signup
- FR72: System can display trial expiration countdown
- FR73: Tenant Admin can select a subscription tier (Starter/Professional/Enterprise)
- FR74: Tenant Admin can choose a payment method (Bank Transfer/M-Pesa/Stripe)
- FR75: System can generate invoices aligned to fiscal year
- FR76: System can process payments and update subscription status
- FR77: System can enforce feature limits based on subscription tier
- FR78: System can transition tenant to grace period after failed payment
- FR79: System can suspend tenant access after grace period expires

#### 11. Notifications & Communication (10 FRs)

- FR80: System can send email notifications for plan submissions
- FR81: System can send email notifications for plan approvals/rejections
- FR82: System can send reminder emails for approaching deadlines
- FR83: System can send billing-related notifications (invoices, payment confirmations)
- FR84: PO can send custom messages to DUs via the platform
- FR84a: System can send notification to PO when DU submits item/category request
- FR84b: System can send notification to DU when request is approved (with any modifications noted)
- FR84c: System can send notification to DU when request is denied (with reason)
- FR84d: System can send reminder to PO for pending requests approaching deadline
- FR84e: System can notify DU when their pending request expires

#### 12. Audit & Compliance (5 FRs)

- FR85: System can log all user actions with timestamp and user details
- FR86: System can maintain immutable audit trail for compliance
- FR87: PO can view audit logs for their procurement activities
- FR88: Tenant Admin can generate audit reports for compliance reviews
- FR89: System can track plan version history with before/after states

#### 13. Marketing & Onboarding (5 FRs)

- FR90: Visitors can view a marketing landing page with feature descriptions
- FR91: Visitors can view pricing tiers and comparison
- FR92: Visitors can start a trial signup process
- FR93: New users can complete an onboarding flow after first login
- FR94: Users can access contextual help within the application

### Non-Functional Requirements

**Total: 39 Non-Functional Requirements across 7 Categories**

#### Performance (7 NFRs)

- NFR-P1: Blockly workspace loads within 2 seconds for plans with up to 15 departments
- NFR-P2: Block drag-and-drop operations complete within 100ms
- NFR-P3: Real-time budget calculations update within 200ms of quantity change
- NFR-P4: Excel export generates within 10 seconds for plans with 500+ items
- NFR-P5: Dashboard pages load within 1 second
- NFR-P6: Search and filter operations return results within 500ms
- NFR-P7: Concurrent user support: 50 users per tenant without degradation

#### Security (10 NFRs)

- NFR-S1: Complete tenant data isolation — no cross-tenant data access under any circumstance
- NFR-S2: All data encrypted at rest using AES-256
- NFR-S3: All data encrypted in transit using TLS 1.3
- NFR-S4: Session tokens expire after 24 hours of inactivity
- NFR-S5: Password requirements: minimum 12 characters, uppercase, lowercase, number, special character
- NFR-S6: Failed login attempts limited to 5 before temporary lockout
- NFR-S7: All user inputs sanitized against SQL injection and XSS
- NFR-S8: API rate limiting enforced per tenant tier
- NFR-S9: Immutable audit logs — append-only with no deletion capability
- NFR-S10: CORS restricted to known domains only

#### Scalability (6 NFRs)

- NFR-SC1: System supports 50 tenants with no performance degradation (MVP)
- NFR-SC2: System supports 500 tenants with <10% performance degradation (Year 2)
- NFR-SC3: Single tenant supports 200 concurrent users at peak (Growth)
- NFR-SC4: Blockly workspace handles 15 departments × 25 categories × 100 items per plan
- NFR-SC5: Database supports 1M+ procurement items across all tenants (Year 2)
- NFR-SC6: Horizontal scaling capability for application tier (Growth)

#### Reliability (7 NFRs)

- NFR-R1: System uptime of 99.5% (excluding planned maintenance)
- NFR-R2: Zero data loss for committed transactions
- NFR-R3: Automated daily backups with 30-day retention
- NFR-R4: Recovery Point Objective (RPO): 1 hour maximum data loss
- NFR-R5: Recovery Time Objective (RTO): 4 hours to full recovery
- NFR-R6: No planned maintenance during peak season (July-September)
- NFR-R7: Graceful degradation — core functions remain available if non-critical services fail

#### Accessibility (6 NFRs)

- NFR-A1: WCAG 2.1 Level AA compliance for all standard interfaces
- NFR-A2: Keyboard navigation support for all primary workflows
- NFR-A3: Screen reader compatibility for dashboard and forms
- NFR-A4: Color contrast ratio minimum 4.5:1 for text
- NFR-A5: Blockly workspace: Alternative data entry method available (form-based fallback)
- NFR-A6: All images and icons have appropriate alt text

#### Integration (6 NFRs)

- NFR-I1: Excel export produces files compatible with Microsoft Excel 2016+
- NFR-I2: Excel export matches GOK Annual Procurement Plan template format exactly
- NFR-I3: Email notifications delivered within 60 seconds of triggering event
- NFR-I4: Email delivery success rate of 99%+
- NFR-I5: API response format follows OpenAPI 3.0 specification (Growth)
- NFR-I6: Webhook events delivered within 30 seconds with 3x retry (Growth)

#### Data Governance (5 NFRs)

- NFR-D1: Audit trail retention: 7 years minimum
- NFR-D2: Data export available on tenant request within 30 days
- NFR-D3: Data deletion on tenant request within 90 days of subscription end
- NFR-D4: All data stored in African or European data centers
- NFR-D5: No data shared with third parties without explicit tenant consent

### Additional Requirements

#### From Architecture Document

**Starter Template Requirement (CRITICAL for Epic 1, Story 1):**
- Selected starter: **Convex Ents SaaS Starter** (https://github.com/get-convex/ents-saas-starter)
- Required modification: Replace Clerk authentication with Convex Auth
- Initialization sequence:
  1. Clone Convex Ents SaaS Starter
  2. Remove Clerk packages (@clerk/nextjs, @clerk/clerk-react)
  3. Install Convex Auth (@convex-dev/auth)
  4. Configure auth providers (email/password, OAuth)

**Technology Stack Requirements:**
- Frontend: Next.js 14+ (App Router), TypeScript strict, shadcn/ui, TailwindCSS
- Visual Editor: Google Blockly (lazy-loaded with next/dynamic)
- Primary Backend: Convex (database, auth, real-time, functions, storage)
- Integration Service: NestJS microservice (payments, Excel, email)
- Hosting: Vercel (frontend), Convex Cloud (backend), Railway (NestJS)

**External Integration Requirements:**
- Stripe (card payments) - webhook handling required
- IntaSend (M-Pesa payments) - Kenya-specific integration
- Resend (transactional email) - React Email templates
- ExcelJS (Excel generation) - runs in NestJS, not browser

**Data Architecture Requirements:**
- Primary Database: Convex with Ents for type-safe relationships
- Blockly Storage: JSON serialization (modern Blockly 10+)
- Audit Log Strategy: Active logs (<1 year) in Convex, archived (1-7 years) to cold storage
- Multi-tenancy: tenantId isolation on all tables

**Authentication Requirements:**
- Convex Auth with Email OTP for 2FA
- DU Access Codes: Code + Email verification flow
- JWT-based service-to-service communication (Convex → NestJS)
- Session management via Convex Auth defaults

**Infrastructure Requirements:**
- CI/CD: GitHub Actions + Vercel automatic deployments
- Environments: Development, Preview, Production
- NestJS deployment: Railway with automatic deploys

**Implementation Patterns:**
- 12 critical consistency patterns defined for AI agents
- Centralized compliance calculations in convex/functions/compliance.ts
- Audit logging via mutation wrappers
- Error handling with ConvexError codes

#### From UX Design Document

**Platform Requirements:**
- Desktop-only platform (minimum 1024px viewport width)
- No mobile or tablet support planned
- Users on mobile see "Desktop Required" message

**Visual Design Requirements:**
- Theme: Procureline Green Theme from tweakcn
- Primary Color: #18b969 (vibrant green)
- Dashboard Style: Bento Box Grid Layout
- Design System: shadcn/ui + Tailwind CSS
- Typography: Inter (sans-serif), Fira Code (monospace)
- Border Radius: 0.5rem

**Blockly Visual Requirements:**
- Department blocks: HSV 225, 70%, 80% (Blue-purple)
- Category blocks: HSV 195, 70%, 80% (Teal)
- Item blocks: HSV 160, 70%, 80% (Green)
- Aggregate blocks: HSV 50, 70%, 80% (Gold)
- Budget meter colors: Green (0-79%), Yellow (80-99%), Red (100%+)

**Accessibility Requirements:**
- WCAG 2.1 Level AA compliance
- Keyboard navigation for all workflows
- Screen reader compatibility
- Focus indicators: 2px primary-color ring
- Respects prefers-reduced-motion

**UX Success Criteria:**
- DU plan completion: under 10 minutes
- PO consolidation: under 2 hours (vs. weeks)
- Zero-training interface: 95%+ task completion without documentation
- Speed to first block: under 30 seconds

### FR Coverage Map

| FR Range | Epic | Description |
|----------|------|-------------|
| FR1-FR7 (incl. sub-FRs) | Epic 1 | Authentication & Access Control |
| FR8-FR14, FR-PA1a-PA10j | Epic 2 | Platform Administration |
| FR15-FR22, FR-TA1a-TA10h | Epic 3 | Tenant Administration |
| FR23-FR29f, FR-DL1-DL6 | Epic 4 | Department Management |
| FR30-FR37z | Epic 4 | Category & Item Catalog |
| FR38-FR48 | Epic 5 | Visual Blockly Planning Interface |
| FR49-FR57f | Epic 6 | Plan Submission & Review |
| FR58-FR66e | Epic 7 | Consolidation Workspace |
| FR67-FR70 | Epic 7 | Excel Integration |
| FR71-FR79 | Epic 8 | Billing & Subscription |
| FR80-FR84e | Epic 9 | Notifications & Communication |
| FR85-FR89 | Epic 10 | Audit & Compliance |
| FR90-FR94 | Epic 11 | Marketing & Onboarding |

**NFR Distribution:**
- NFR-S1-S10 (Security): Primarily Epic 1, cross-cutting all epics
- NFR-P1-P7 (Performance): Epic 5 (Blockly), Epic 7 (Export)
- NFR-SC1-SC6 (Scalability): Cross-cutting infrastructure
- NFR-R1-R7 (Reliability): Cross-cutting infrastructure
- NFR-A1-A6 (Accessibility): All user-facing epics
- NFR-I1-I6 (Integration): Epic 7 (Excel), Epic 9 (Email)
- NFR-D1-D5 (Data Governance): Epic 10 (Audit)

## Epic List

### Epic 1: Project Foundation & Authentication System

**Goal:** Users can securely access the platform with role-based permissions and complete tenant isolation.

**User Outcome:** All four user types (Platform Admin, Tenant Admin, PO, DU) can register, login, and access their appropriate dashboards with proper authorization.

**FRs covered:** FR1, FR2, FR2a-FR2h, FR3, FR4, FR5, FR5a-FR5h, FR6, FR7

**Implementation Notes:**
- Uses Convex Ents SaaS Starter with Clerk→Convex Auth replacement
- Implements 4-layer RBAC (Platform Admin, Tenant Admin, PO, DU)
- DU access code authentication flow
- Addresses NFR-S1 through NFR-S10

---

### Epic 2: Platform Administration

**Goal:** Platform Admin can manage the entire multi-tenant SaaS platform, monitor system health, and maintain security.

**User Outcome:** Platform Admin has complete visibility and control over all tenants, subscriptions, system health, and security compliance.

**FRs covered:** FR8-FR14, FR-PA1a-PA1j, FR-PA2a-PA2j, FR-PA3a-PA3o, FR-PA4a-PA4o, FR-PA5a-PA5j, FR-PA6a-PA6j, FR-PA7a-PA7j, FR-PA8a-PA8j, FR-PA9a-PA9j, FR-PA10a-PA10j (99 FRs total)

**Implementation Notes:**
- Bento box dashboard with system health indicators
- Tenant lifecycle management (create, suspend, restore, delete)
- Billing reconciliation and refund workflows

---

### Epic 3: Tenant Administration & Institution Setup

**Goal:** Tenant Admin can configure their institution, manage Procurement Officers, and maintain oversight of institutional procurement activities.

**User Outcome:** Tenant Admin has complete control over their institution's procurement setup and can manage all POs under their organization.

**FRs covered:** FR15-FR22, FR-TA1a-TA1j, FR-TA2a-TA2j, FR-TA3a-TA3o, FR-TA4a-TA4k, FR-TA5a-TA5o, FR-TA6b-TA6l, FR-TA7a-TA7h, FR-TA8a-TA8h, FR-TA9a-TA9h, FR-TA10a-TA10h (102 FRs total)

**Implementation Notes:**
- Fiscal year configuration (Kenya: July 1 - June 30)
- PO invitation and management workflow
- Institutional compliance rules configuration

---

### Epic 4: PO Department & Catalog Management (THE PREP PHASE)

**Goal:** PO can set up the entire procurement infrastructure for their institution before the planning period begins.

**User Outcome:** PO has fully configured departments with budgets, a complete item catalog organized by categories, access codes ready for DUs, and submission deadlines set - everything needed for DUs to begin planning.

**FRs covered:** FR23-FR29f, FR-DL1-DL6, FR30-FR37z (86 FRs total)

**Implementation Notes:**
- This is the critical "1 month before" preparation phase
- Department creation with budget allocation
- Category and item catalog management
- Access code generation and distribution
- Item/category request handling from DUs
- Deadline management with reminders

---

### Epic 5: DU Blockly Planning Interface

**Goal:** Departmental Users can create procurement plans using an intuitive visual block interface.

**User Outcome:** DU can log in with access code, drag items from the PO-created catalog into their plan, set quarterly quantities, see real-time budget tracking, and save drafts - all without any training.

**FRs covered:** FR38-FR48 (26 FRs total)

**Implementation Notes:**
- Google Blockly integration (lazy-loaded)
- Block colors: Department (blue-purple), Category (teal), Item (green)
- Real-time budget meter (green/yellow/red)
- Auto-save to IndexedDB + Convex sync
- Desktop-only (minimum 1024px viewport)

---

### Epic 6: Plan Submission & Review Workflow

**Goal:** DUs can submit completed plans and POs can review, approve, or return them with feedback.

**User Outcome:** DU can submit validated plans with one click. PO can review all submissions, approve compliant plans, or return plans with specific revision comments for DU to address.

**FRs covered:** FR49-FR57f (32 FRs total)

**Implementation Notes:**
- Pre-submission validation (budget, completeness)
- Submission confirmation with reference number
- PO review interface with approve/reject/return actions
- Revision workflow with highlighted items
- Plan comparison views (diff, previous year)

---

### Epic 7: PO Consolidation & Excel Export

**Goal:** PO can consolidate all approved department plans into a master institutional plan and export GOK-compliant documents.

**User Outcome:** PO can drag approved department blocks into a consolidation workspace, see automatic compliance calculations (AGPO 30%, PWD 2%, Local Content 40%), and export the final plan to GOK-compliant Excel format.

**FRs covered:** FR58-FR70 (31 FRs total)

**Implementation Notes:**
- Consolidation Blockly workspace with aggregate blocks
- Automatic compliance calculations (centralized in Convex)
- GOK template matching for Excel export
- ExcelJS generation via NestJS microservice

---

### Epic 8: Billing & Subscription System

**Goal:** Tenants can manage their subscriptions and payments to maintain platform access.

**User Outcome:** Tenant Admin can start a 14-day trial, select subscription tiers, pay via Bank Transfer/M-Pesa/Stripe, and manage their billing lifecycle.

**FRs covered:** FR71-FR79 (9 FRs total)

**Implementation Notes:**
- Stripe integration (card payments)
- IntaSend integration (M-Pesa - Kenya)
- Fiscal year-aligned billing
- Grace period and suspension workflows
- NestJS payment processing microservice

---

### Epic 9: Notifications & Communication

**Goal:** Users receive timely notifications about procurement activities and can communicate through the platform.

**User Outcome:** Users receive email and in-app notifications for submissions, approvals, rejections, deadlines, and billing events. POs can send custom messages to DUs.

**FRs covered:** FR80-FR84e (10 FRs total)

**Implementation Notes:**
- Resend for transactional email (React Email templates)
- In-app notification center
- Deadline reminders (7 days, 3 days, 1 day)
- Item request notifications

---

### Epic 10: Audit Trail & Compliance Reporting

**Goal:** Complete audit trails ensure regulatory compliance and enable governance reporting.

**User Outcome:** All user actions are logged immutably. POs and Tenant Admins can generate audit reports for compliance reviews with full version history.

**FRs covered:** FR85-FR89 (5 FRs total)

**Implementation Notes:**
- Immutable audit logs (append-only)
- 7-year retention requirement
- Version history with before/after states
- Convex mutation wrappers for automatic logging

---

### Epic 11: Marketing Landing & User Onboarding

**Goal:** Visitors can discover Procureline and smoothly onboard as new users.

**User Outcome:** Visitors can view the landing page, understand pricing tiers, start a trial, and complete guided onboarding that gets them productive immediately.

**FRs covered:** FR90-FR94 (5 FRs total)

**Implementation Notes:**
- Marketing landing page with feature descriptions
- Pricing tier comparison
- Trial signup flow
- Contextual onboarding (animated hints, zero-training approach)
