---
epic: 3
title: "Tenant Administration & Institution Setup"
status: ready
priority: P0
totalStories: 12
frsConvered: ["FR15", "FR16", "FR17", "FR18", "FR19", "FR20", "FR21", "FR22", "FR-TA1a-TA1j", "FR-TA2a-TA2j", "FR-TA3a-TA3o", "FR-TA4a-TA4k", "FR-TA5a-TA5o", "FR-TA6b-TA6l", "FR-TA7a-TA7h", "FR-TA8a-TA8h", "FR-TA9a-TA9h", "FR-TA10a-TA10h"]
nfrsAddressed: ["NFR-S1", "NFR-S2", "NFR-S3", "NFR-S4", "NFR-S5", "NFR-S6", "NFR-S7", "NFR-P1", "NFR-P3"]
dependencies: ["Epic 1", "Epic 2"]
createdAt: 2026-01-22
---

# Epic 3: Tenant Administration & Institution Setup

## Epic Goal

Tenant Admins can fully manage their institution including PO management, billing, reporting, and cross-institutional visibility.

## User Outcome

Tenant Admins (like Dr. Amina Hassan from the user journey) can onboard, manage POs, configure institutional settings, handle billing, generate reports, and maintain security for their organization.

## Requirements Covered

### Functional Requirements
- FR15: Tenant Admin can add and manage Procurement Officers
- FR16: Tenant Admin can invite POs via email
- FR17: Tenant Admin can view PO activity logs
- FR18: Tenant Admin can view department submission status across the institution
- FR19: Tenant Admin can view budget utilization summary
- FR20: Tenant Admin can view and manage billing information
- FR21: Tenant Admin can view invoices and payment history
- FR22: Tenant Admin can update institutional settings (fiscal year, compliance rules)
- FR-TA1a through FR-TA1j: Onboarding & Registration (10 FRs)
- FR-TA2a through FR-TA2j: Dashboard (10 FRs)
- FR-TA3a through FR-TA3o: PO Management (15 FRs)
- FR-TA4a through FR-TA4k: Institutional Settings (11 FRs)
- FR-TA5a through FR-TA5o: Billing & Subscription (15 FRs)
- FR-TA6b through FR-TA6l: Reporting (11 FRs)
- FR-TA7a through FR-TA7h: Cross-Institutional Visibility (8 FRs)
- FR-TA8a through FR-TA8h: Notifications (7 FRs)
- FR-TA9a through FR-TA9h: Security (8 FRs)
- FR-TA10a through FR-TA10h: Account Lifecycle (7 FRs)

### Non-Functional Requirements
- NFR-S1: Complete tenant data isolation
- NFR-S2: All data encrypted at rest using AES-256
- NFR-S3: All data encrypted in transit using TLS 1.3
- NFR-S4: Session tokens expire after 24 hours of inactivity
- NFR-S5: Password requirements (12+ chars, uppercase, lowercase, number, special)
- NFR-S6: Failed login attempts limited to 5 before temporary lockout
- NFR-S7: All user inputs sanitized against SQL injection and XSS
- NFR-P1: Page load time under 2 seconds
- NFR-P3: Support 50+ concurrent users per tenant

## Implementation Notes

- Tenant Admin portal is separate from PO and DU interfaces
- **CRITICAL DEPENDENCY:** Requires Epic 2 Story 2.0 (NestJS Microservice Foundation)
- Billing integration uses NestJS microservice with Stripe/IntaSend (from Story 2.0)
- Reports generated via NestJS microservice using ExcelJS (from Story 2.0)
- Email sending via Resend through NestJS (from Story 2.0)
- Real-time updates via Convex subscriptions throughout dashboard
- All settings changes are logged with before/after values

## Epic Dependencies

**Epic 1 Prerequisites:**
- ✅ Epic 1 complete (authentication, RBAC, tenant isolation)
- Tenant Admin role functional from Story 1.2
- Email verification working

**Epic 2 Prerequisites:**
- ✅ **Epic 2 Story 2.0 MUST be complete** (NestJS Microservice Foundation)
- Payment processing (Stripe, IntaSend, Bank Transfer)
- Excel generation/import capabilities
- PDF report generation
- Email sending via Resend

**What You'll Use from Epic 1:**
- Tenant Admin authentication and role checks
- Tenant isolation guards for all data access
- Email OTP system for PO invitations
- Security infrastructure and audit logging

**What You'll Use from Epic 2 Story 2.0:**
- Billing APIs for subscription management (Stories 3.6, 3.7)
- Excel generation for report exports (Story 3.8)
- Email sending for notifications and invitations (Stories 3.3, 3.4, 3.10)
- PDF generation for invoices and reports (Stories 3.6, 3.8)

---

## Stories

### Story 3.1: Tenant Admin Onboarding Flow

As a **newly invited Tenant Admin**,
I want to complete my account setup through a guided onboarding process,
So that I can start managing my institution on Procureline.

**Acceptance Criteria:**

**Given** a Platform Admin creates a new tenant with a Tenant Admin email
**When** the tenant is provisioned
**Then** system sends invitation email to the Tenant Admin (FR-TA1a)
**And** the invitation link expires after 72 hours (FR-TA1b)
**And** Tenant Admin can request a resend if link expires

**Given** a Tenant Admin clicks the invitation link
**When** they set their password
**Then** system validates password meets policy (12+ chars, uppercase, number, special) (FR-TA1c)
**And** displays specific validation errors for unmet requirements

**Given** a Tenant Admin completes password setup
**When** account is created
**Then** system sends email verification link (FR-TA1d)
**And** verification link expires after 24 hours (FR-TA1e)
**And** system auto-resends verification (max 3 times) if not verified

**Given** a Tenant Admin verifies their email
**When** they attempt to access the dashboard
**Then** system blocks access until organization profile is complete (FR-TA1f)
**And** redirects to organization profile setup wizard

**Given** a Tenant Admin is on the organization profile setup
**When** they complete the required fields
**Then** system requires: organization name, logo (optional), primary contact, fiscal year config (FR-TA1g)
**And** upon completion, grants full dashboard access

**Given** a new Tenant Admin attempts to register
**When** their email already exists in another tenant
**Then** system prevents duplicate emails across all tenants (FR-TA1h)
**And** displays "Email already in use" error

**Given** a Tenant Admin's tenant is deactivated by Platform Admin during onboarding
**When** they attempt to continue onboarding
**Then** system displays "Tenant deactivated. Contact Support." message (FR-TA1i)

**Given** a Tenant Admin forgets their password before completing onboarding
**When** they use the forgot password flow
**Then** system supports password reset using the invitation email (FR-TA1j)

**Technical Notes:**
- Create `tenantAdminInvitations` table with `tenantId`, `email`, `token`, `expiresAt`, `status`
- Organization profile stored in `tenants` table with `profileComplete: boolean`
- Use Convex Auth for email verification flow
- Implement `completeOnboarding` mutation that checks all requirements

---

### Story 3.2: Tenant Admin Dashboard

As a **Tenant Admin**,
I want to see a comprehensive dashboard with real-time institutional metrics,
So that I can monitor my organization's procurement activities at a glance.

**Acceptance Criteria:**

**Given** a Tenant Admin logs in successfully
**When** they view the dashboard
**Then** system displays summary cards: Total POs, Departments, Submission Progress, Budget Utilization (FR-TA2a, FR18, FR19)
**And** cards show current values with trend indicators

**Given** a Tenant Admin views the dashboard
**When** during an active fiscal year
**Then** system shows current fiscal year cycle status with visual timeline (FR-TA2b)
**And** displays submission deadline with countdown timer

**Given** a Tenant Admin views the dashboard
**When** activity has occurred
**Then** system displays recent activity feed showing last 20 actions (FR-TA2c)
**And** activity items include: user, action, timestamp, affected entity

**Given** a Tenant Admin views the dashboard
**When** looking for quick actions
**Then** system provides quick action buttons: Add PO, View Reports, Settings (FR-TA2d)
**And** buttons are contextually highlighted based on onboarding status

**Given** a new Tenant Admin with no POs configured
**When** they view the dashboard
**Then** system shows onboarding guide with setup checklist (FR-TA2e)
**And** checklist includes: Add PO, Configure Settings, Review Billing

**Given** a Tenant Admin views the dashboard
**When** before submission period starts
**Then** system shows countdown to submission period start date (FR-TA2f)

**Given** a Tenant Admin views the dashboard
**When** after submission period ends
**Then** system shows "Cycle Complete" summary with key metrics (FR-TA2g)

**Given** a network connectivity issue occurs
**When** real-time sync fails
**Then** system displays cached data with "Last updated: [timestamp]" indicator (FR-TA2h)

**Given** a Tenant Admin with multiple fiscal years of data
**When** they want to compare periods
**Then** system allows switching between fiscal year views via dropdown (FR-TA2i)

**Given** a Tenant Admin views the dashboard
**When** data changes (PO actions, submissions)
**Then** dashboard data refreshes in real-time via Convex subscriptions (FR-TA2j)
**And** no page refresh required

**Technical Notes:**
- Dashboard components use Convex `useQuery` hooks for real-time subscriptions
- Create `getDashboardMetrics` query aggregating tenant data
- Cache layer for dashboard with 5-minute TTL as fallback
- Activity feed from `auditLogs` table filtered by tenantId
- Fiscal year switching via query parameter or state

---

### Story 3.3: PO Management - Add & Invite

As a **Tenant Admin**,
I want to add and invite Procurement Officers to my organization,
So that they can manage departments and procurement activities.

**Acceptance Criteria:**

**Given** a Tenant Admin navigates to PO Management
**When** they view the PO list
**Then** system displays all POs with status indicators (Active, Pending, Deactivated) (FR-TA3a, FR15)
**And** list shows name, email, status, last activity date

**Given** a Tenant Admin clicks "Add PO"
**When** they fill in the form
**Then** system requires name, email, and phone (FR-TA3b)
**And** validates email format and phone format

**Given** a Tenant Admin submits a new PO
**When** the PO is created
**Then** system sends invitation email to the PO (FR-TA3c, FR16)
**And** invitation includes organization name and setup instructions

**Given** a Tenant Admin adds a PO
**When** the email exists as a PO in a different tenant
**Then** system allows the same email (cross-tenant allowed) (FR-TA3d)
**And** PO must complete separate onboarding for this tenant

**Given** a Tenant Admin adds a PO
**When** the email already exists as PO in the same tenant
**Then** system rejects with "Email already registered in this organization" (FR-TA3e)

**Given** a PO invitation email bounces
**When** the bounce is detected
**Then** system notifies Tenant Admin via in-app notification and email (FR-TA3f)
**And** marks invitation status as "Bounced"

**Given** a PO invitation is sent
**When** 7 days pass without acceptance
**Then** invitation auto-expires (FR-TA3g)
**And** system notifies Tenant Admin that invitation expired
**And** Tenant Admin can resend invitation

**Technical Notes:**
- Create `poInvitations` table with `tenantId`, `email`, `token`, `expiresAt`, `status`
- Email sending via Resend API through NestJS microservice
- Bounce detection via Resend webhook integration
- Cron job to check expired invitations and notify

---

### Story 3.4: PO Management - Lifecycle & Activity

As a **Tenant Admin**,
I want to manage PO lifecycle including deactivation, reactivation, and activity monitoring,
So that I can maintain proper access control and oversight.

**Acceptance Criteria:**

**Given** a Tenant Admin wants to deactivate a PO
**When** there is an active submission cycle with that PO's departments
**Then** system displays warning about active cycle impact (FR-TA3h)
**And** requires confirmation to proceed
**And** upon deactivation, PO cannot log in

**Given** a Tenant Admin attempts to deactivate a PO
**When** it is the last active PO in the tenant
**Then** system prevents deactivation (FR-TA3i)
**And** displays "Cannot deactivate. At least one active PO required."

**Given** a Tenant Admin views a deactivated PO
**When** they want to restore access
**Then** system allows reactivating the PO (FR-TA3j)
**And** PO can immediately log in after reactivation

**Given** a PO is deactivated
**When** the deactivation is processed
**Then** system soft-deletes PO data, retaining for audit trail (FR-TA3k)
**And** PO's departments and data remain accessible to other POs

**Given** a Tenant Admin wants to view PO activity
**When** they access a PO's activity log
**Then** system shows paginated activity log with filters (FR-TA3l, FR17)
**And** filters include: date range, action type, entity type
**And** log shows: timestamp, action, details, affected entity

**Given** a PO is locked out from failed login attempts
**When** they contact their Tenant Admin
**Then** Tenant Admin can unlock the PO account (FR-TA3m)
**And** PO can immediately attempt login again

**Given** a Tenant Admin needs to update a PO's email
**When** they change the email address
**Then** system sends verification to new email (FR-TA3n)
**And** old email remains active until new email verified

**Given** a Tenant Admin has multiple POs to add
**When** they use bulk import
**Then** system accepts CSV file with name, email, phone columns (FR-TA3o)
**And** validates each row independently
**And** displays row-level errors for invalid entries
**And** successfully imports valid rows

**Technical Notes:**
- Soft delete via `isActive: boolean` and `deletedAt: timestamp` fields
- Activity logs from `auditLogs` table with `actorId` filter
- CSV parsing with validation using Papa Parse library
- Bulk import creates invitations for all valid entries

---

### Story 3.5: Institutional Settings Configuration

As a **Tenant Admin**,
I want to configure my institution's settings including branding, fiscal year, and compliance rules,
So that the platform operates according to my organization's requirements.

**Acceptance Criteria:**

**Given** a Tenant Admin navigates to Institutional Settings
**When** they update organization details
**Then** system allows updating: organization name, logo, primary contact info (FR-TA4a)
**And** changes are saved immediately

**Given** a Tenant Admin configures fiscal year
**When** they set the start month and naming convention
**Then** system saves the fiscal year configuration (FR-TA4b)
**And** naming convention options include: "FY2025-26", "2025/2026", custom format

**Given** a Tenant Admin changes fiscal year settings
**When** there is an active fiscal year cycle
**Then** system applies changes to next cycle only (FR-TA4c)
**And** displays "Changes will apply to next fiscal year" message

**Given** a Tenant Admin configures compliance rules
**When** they set AGPO %, PWD %, and Local Content %
**Then** system saves these as default compliance targets (FR-TA4d, FR22)
**And** these values are used for automatic compliance calculations

**Given** a Tenant Admin enters compliance percentages
**When** values are outside valid range
**Then** system validates each is 0-100 (FR-TA4e)
**And** validates combined percentages don't exceed 100%
**And** displays specific validation errors

**Given** a Tenant Admin changes compliance rules
**When** during an active submission period
**Then** system warns that existing plans may need revalidation (FR-TA4f)
**And** requires confirmation to proceed

**Given** a Tenant Admin configures email domains
**When** they add allowed domains (e.g., @pu.ac.ke)
**Then** system restricts user registration to those domains (FR-TA4g)
**And** validates domain format

**Given** a Tenant Admin attempts to remove an email domain
**When** existing users have emails in that domain
**Then** system prevents removal (FR-TA4h)
**And** displays "Cannot remove domain. X users have this domain."

**Given** a Tenant Admin uploads a logo
**When** the file is processed
**Then** system validates: PNG/JPG/SVG format, max 2MB size (FR-TA4i)
**And** displays preview before saving
**And** rejects invalid files with specific error

**Given** a Tenant Admin configures timezone
**When** they select from timezone dropdown
**Then** system saves the institutional timezone (FR-TA4j)
**And** all timestamps in reports use this timezone

**Given** any settings change is made
**When** the change is saved
**Then** system logs the change with: before value, after value, timestamp, actor (FR-TA4k)
**And** this log is viewable in audit trail

**Technical Notes:**
- Settings stored in `tenants` table with JSON `settings` field
- Logo upload to Convex file storage with validation
- Compliance percentages stored as integers (0-100)
- Settings change logging via `auditLogs` table with `before`/`after` fields
- Email domain validation via regex and uniqueness check

---

### Story 3.6: Billing Dashboard & Payment Methods

As a **Tenant Admin**,
I want to view my subscription details and manage payment methods,
So that I can ensure uninterrupted service for my organization.

**Acceptance Criteria:**

**Given** a Tenant Admin navigates to Billing
**When** they view the subscription overview
**Then** system displays: current tier (Free/Starter/Professional/Enterprise), included features, renewal date (FR-TA5a, FR20)
**And** shows tier comparison if not on highest tier
**And** displays "Current Plan" badge on active tier

**Given** a Tenant Admin views billing
**When** they check usage metrics
**Then** system displays current usage with tier limits (FR-TA5b):
**And** shows "Departments: X/10 used (Free tier)" with progress bar
**And** shows "Categories: X/20 used (Free tier)" with progress bar
**And** shows "Items per category: Max X/50 (Free tier)" with progress bar
**And** shows "DU editor blocks: Max X/5 category blocks, X/15 items per block (Free tier)" with progress bar
**And** shows "Export limit: 300 rows per export (Free tier)"
**And** shows "Bulk import: Not available (Free tier)"
**And** shows "Catalog export: Not available (Free tier)"
**And** shows "Audit reports: Not available (Free tier)"
**And** all metrics use color coding: green (<70%), yellow (70-90%), red (>90%)

**Given** a Tenant Admin on Free tier is approaching limits
**When** any resource exceeds 90% utilization
**Then** system displays upgrade CTA: "Approaching limit. Upgrade to continue growing"
**And** CTA links to tier comparison with next tier highlighted

**Given** a Tenant Admin wants to upgrade
**When** they view tier comparison
**Then** system displays feature matrix table:
**And** table shows: Free (10/20/50), Starter (30/60/150), Professional (100/200/500), Enterprise (unlimited)
**And** table includes: departments, categories, items/category, export rows, bulk import, catalog export, audit reports
**And** highlights differences between current and target tier

**Given** a Tenant Admin views payment history
**When** invoices exist
**Then** system displays list of all invoices with: date, amount, status (FR-TA5c, FR21)
**And** invoices are sorted newest first

**Given** a Tenant Admin wants to download an invoice
**When** they click download on an invoice
**Then** system generates PDF with: invoice details, line items, payment info (FR-TA5d)
**And** PDF includes organization logo and "PAID" watermark if applicable

**Given** a Tenant Admin wants to update payment method
**When** they access payment settings
**Then** system allows adding/updating: credit card (via Stripe), bank transfer (LPO), M-Pesa (IntaSend) (FR-TA5e)
**And** validates payment method details

**Given** a Tenant Admin has a payment method on file
**When** the card expires within 30 days
**Then** system displays warning banner on billing page (FR-TA5f)
**And** sends email notification to Tenant Admin

**Technical Notes:**
- Billing data from NestJS microservice via API calls
- Payment methods stored securely via Stripe/IntaSend tokenization
- Invoice PDF generation via NestJS with ExcelJS/PDFKit
- Payment method expiration check via cron job
- Display tier features from static configuration
- Tier usage metrics calculated via Convex queries:
  - Departments: `db.query("departments").withIndex("by_tenant", q => q.eq("tenantId", tenantId).eq("isActive", true)).collect().length`
  - Categories: `db.query("categories").withIndex("by_tenant", q => q.eq("tenantId", tenantId).eq("isArchived", false)).collect().length`
  - Items per category: Max count from all categories via grouped query
  - DU editor usage: Tracked via `planBlockCounts` table per plan
- Tier limit definitions stored in `config/tiers.ts`:
  ```typescript
  export const TIER_LIMITS = {
    free: { departments: 10, categories: 20, itemsPerCategory: 50, exportRows: 300, duCategoryBlocks: 5, duItemsPerBlock: 15 },
    starter: { departments: 30, categories: 60, itemsPerCategory: 150, exportRows: 1000, duCategoryBlocks: 20, duItemsPerBlock: 50 },
    professional: { departments: 100, categories: 200, itemsPerCategory: 500, exportRows: 10000, duCategoryBlocks: 50, duItemsPerBlock: 100 },
    enterprise: { departments: null, categories: null, itemsPerCategory: null, exportRows: null, duCategoryBlocks: null, duItemsPerBlock: null }
  };
  ```
- Color coding thresholds: <70% green, 70-90% yellow, >90% red
- Upgrade CTA displayed when any metric exceeds 90%

---

### Story 3.7: Subscription Lifecycle Management

As a **Tenant Admin**,
I want to manage my subscription including upgrades, downgrades, and handle payment issues,
So that my organization's subscription remains appropriate for our needs.

**Acceptance Criteria:**

**Given** a payment fails
**When** the billing cycle processes
**Then** system provides 7-day grace period with full access (FR-TA5g)
**And** sends daily reminder emails during grace period

**Given** grace period expires without payment
**When** the 7 days pass
**Then** system suspends account to read-only mode (FR-TA5h)
**And** displays "Subscription suspended" banner with payment link

**Given** a tenant is suspended
**When** 90 days pass without payment
**Then** system retains data but marks for deletion review (FR-TA5i)
**And** sends final warning email before data deletion

**Given** a Tenant Admin on Starter tier
**When** they click "Upgrade to Professional"
**Then** system processes upgrade with immediate feature access (FR-TA5j)
**And** unlocks Professional tier features instantly

**Given** a Tenant Admin upgrades mid-billing-cycle
**When** the upgrade is processed
**Then** system pro-rates charges for the remaining period (FR-TA5k)
**And** shows clear breakdown of pro-rated amount

**Given** a Tenant Admin wants to downgrade
**When** they request downgrade
**Then** system schedules downgrade for next renewal date (FR-TA5l)
**And** maintains current tier until renewal

**Given** a Tenant Admin requests downgrade
**When** current usage exceeds new tier limits
**Then** system blocks downgrade (FR-TA5m)
**And** displays "Current usage (X users) exceeds new tier limit (Y users)"

**Given** a subscription is approaching renewal
**When** 30 days and 7 days remain
**Then** system sends pre-renewal notification emails (FR-TA5n)
**And** includes renewal amount and date

**Given** a Tenant Admin on Professional tier
**When** they want Enterprise tier
**Then** system shows "Contact Sales" button instead of direct upgrade (FR-TA5o)
**And** clicking opens contact form with pre-filled tenant info

**Technical Notes:**
- Subscription state machine: active → grace → suspended → churned
- Grace period tracked via `gracePeriodEndsAt` timestamp
- Pro-ration calculation: (days remaining / total days) × tier price difference
- Downgrade scheduling via `pendingDowngrade` field
- Enterprise tier requires manual Platform Admin intervention

---

### Story 3.8: Report Generation System

As a **Tenant Admin**,
I want to generate comprehensive reports on procurement activities,
So that I can present data to stakeholders and maintain compliance records.

**Acceptance Criteria:**

**Given** a Tenant Admin navigates to Reports
**When** they select report type
**Then** system offers: Activity reports, Audit reports (FR-TA6b, FR-TA6c, FR-TA6d)

**Given** a Free or Starter tier Tenant Admin attempts to generate Audit reports
**When** they select Audit reports
**Then** system blocks access with modal: "Audit reports available in Professional tier"
**And** modal displays: "Upgrade to Professional or Enterprise to access audit reporting"
**And** modal includes "View Plans" CTA linking to billing page

**Given** a Professional or Enterprise tier Tenant Admin generates any report
**When** they configure parameters
**Then** system allows setting: date range, departments (all or selected), format (Excel only) (FR-TA6e)
**And** shows preview of included data scope

**Given** a Free tier Tenant Admin generates a report
**When** filtered results exceed 300 rows
**Then** system blocks export with modal: "Free tier limit: 300 rows per export"
**And** modal displays current filtered count and suggests: "Refine filters or upgrade to Starter (1,000 rows)"

**Given** a Starter tier Tenant Admin generates a report
**When** filtered results exceed 1,000 rows
**Then** system blocks export with modal: "Starter tier limit: 1,000 rows per export"
**And** modal displays current filtered count and suggests: "Refine filters or upgrade to Professional (10,000 rows)"

**Given** a Professional tier Tenant Admin generates a report
**When** filtered results exceed 10,000 rows
**Then** system blocks export with modal: "Professional tier limit: 10,000 rows per export"
**And** modal displays current filtered count and suggests: "Refine filters or upgrade to Enterprise for unlimited exports"

**Given** an Enterprise tier Tenant Admin generates a report
**When** they configure parameters
**Then** system generates report with unlimited rows

**Given** a Tenant Admin generates a large report
**When** the report will take >30 seconds
**Then** system processes in background with progress indicator (FR-TA6f)
**And** sends email notification when complete with download link

**Given** a report exceeds 50MB
**When** generation completes
**Then** system splits into multiple Excel files (FR-TA6g)
**And** provides ZIP download with all parts

**Given** a Tenant Admin wants regular reports
**When** they configure scheduled report
**Then** system allows: frequency (daily/weekly/monthly), time, recipients (FR-TA6h)
**And** auto-delivers reports via email at scheduled time

**Given** a scheduled report fails
**When** delivery fails 3 times
**Then** system retries 3x with exponential backoff (FR-TA6i)
**And** notifies Tenant Admin of failure after 3rd attempt

**Given** any report is generated
**When** the report is rendered
**Then** system includes "Confidential" watermark with generation timestamp (FR-TA6j)
**And** watermark includes generating user's name

**Given** a Tenant Admin needs to share a report externally
**When** they generate a secure link
**Then** system creates time-limited link (72 hours) (FR-TA6k)
**And** link includes download count tracking
**And** expires automatically after 72 hours

**Technical Notes:**
- Report generation via NestJS microservice using ExcelJS (Excel only, NO PDF support)
- Background processing via Convex scheduled functions
- Report storage in Convex file storage with expiration
- Secure links via signed URLs with expiration
- Scheduled reports via Convex cron jobs
- Report types available:
  - Activity reports: All tiers (with row limits)
  - Audit reports: Professional+ tier only (with row limits)
  - Budget reports: NOT available (not planned for development)
  - Submission status exports: NOT available (not planned for development)
- Tier-based row limits enforced before generation:
  - Free: 300 rows per export max
  - Starter: 1,000 rows per export max
  - Professional: 10,000 rows per export max
  - Enterprise: unlimited rows
- Row count validation via filtered query before calling NestJS service
- Audit report access check: tenant tier must be Professional or Enterprise

---

### Story 3.9: Cross-Institutional Visibility

As a **Tenant Admin**,
I want to view all procurement activities across my institution,
So that I can maintain oversight without interfering with PO operations.

**Acceptance Criteria:**

**Given** a Tenant Admin navigates to Institutional Overview
**When** they view departments
**Then** system displays all departments across all POs (FR-TA7a)
**And** shows: department name, assigned PO, submission status, budget

**Given** a Tenant Admin views the department list
**When** there are many departments
**Then** system provides filters: by PO, by submission status (FR-TA7b)
**And** supports search by department name/code

**Given** a Tenant Admin clicks on a department
**When** they view details
**Then** system shows read-only view of department data (FR-TA7c)
**And** includes: categories, items, budget allocation, submission history
**And** Tenant Admin cannot modify any data

**Given** a Tenant Admin views budget information
**When** across the institution
**Then** system displays consolidated budget view (FR-TA7d)
**And** shows: total allocated, total utilized, by department breakdown

**Given** an institution has 100+ departments
**When** Tenant Admin views the list
**Then** system uses virtual scrolling for performance (FR-TA7e)
**And** loads data incrementally as user scrolls

**Given** the system detects unusual data patterns
**When** displaying department information
**Then** system flags anomalies (e.g., budget variance >50%, duplicate entries) (FR-TA7f)
**And** suggests PO review with specific issue description

**Given** a Tenant Admin views PO summary
**When** looking at overall status
**Then** system shows PO status indicators: Not Started, In Progress, Complete (FR-TA7g)
**And** includes last activity timestamp for each PO

**Given** a Tenant Admin needs GDPR compliance
**When** they request data export
**Then** system generates complete institutional data export (FR-TA7h)
**And** includes all user data, activity logs, and procurement data

**Technical Notes:**
- Read-only access enforced at query level (no mutations accessible)
- Virtual scrolling via react-virtualized or similar
- Anomaly detection via statistical analysis queries
- GDPR export as ZIP with JSON/CSV files
- Status indicators derived from submission counts and deadlines

---

### Story 3.10: Notification System

As a **Tenant Admin**,
I want to receive and manage notifications about important events,
So that I stay informed without being overwhelmed.

**Acceptance Criteria:**

**Given** important events occur in the tenant
**When** events are triggered (PO added, submission received, payment due)
**Then** system sends email notifications to Tenant Admin (FR-TA8a)
**And** email includes event details and action link

**Given** a Tenant Admin logs into the platform
**When** they view the interface
**Then** system displays notification bell with unread count (FR-TA8b)
**And** clicking opens notification center with history

**Given** a Tenant Admin wants to customize notifications
**When** they access notification preferences
**Then** system allows configuring: email on/off per event type, in-app on/off (FR-TA8c)
**And** provides "Notify for all" and "Critical only" presets

**Given** a Tenant Admin wants to communicate with POs
**When** they compose a broadcast message
**Then** system sends message to all POs via email and in-app (FR-TA8d)
**And** tracks delivery status and read receipts

**Given** many events occur in a single day
**When** notification threshold is exceeded (>10 in 24h)
**Then** system switches to digest mode (FR-TA8e)
**And** sends single daily summary instead of individual emails

**Given** a critical event occurs (payment failure, security alert)
**When** the event is triggered
**Then** system sends via multiple channels: email AND in-app (FR-TA8g)
**And** marks as high priority in notification center

**Given** a Tenant Admin performs an action
**When** that action would normally trigger a notification
**Then** system excludes Tenant Admin from receiving notification for own actions (FR-TA8h)

**Technical Notes:**
- Notifications stored in `notifications` table with `recipientId`, `type`, `read`, `data`
- Email sending via Resend through NestJS microservice
- Digest mode via cron job that batches notifications
- Broadcast message stored in `broadcastMessages` table
- Critical notifications bypass digest mode

---

### Story 3.11: Security & Session Management

As a **Tenant Admin**,
I want comprehensive security controls and visibility into account access,
So that I can protect my institution's sensitive procurement data.

**Acceptance Criteria:**

**Given** a Tenant Admin navigates to Security settings
**When** they view login history
**Then** system displays: date/time, IP address, location (city/country), device/browser (FR-TA9a)
**And** history is paginated and searchable

**Given** a Tenant Admin wants to enable 2FA
**When** they initiate 2FA setup
**Then** system supports TOTP via authenticator app (FR-TA9b)
**And** requires entering code to confirm setup

**Given** a Tenant Admin completes 2FA setup
**When** setup is confirmed
**Then** system provides recovery codes (10 single-use codes) (FR-TA9c)
**And** requires user to confirm they saved the codes

**Given** a Tenant Admin views active sessions
**When** multiple sessions exist
**Then** system displays all active sessions with device info (FR-TA9d)
**And** allows terminating any session except current one

**Given** a login occurs from new location or device
**When** the login is detected
**Then** system sends security alert email (FR-TA9e)
**And** shows alert in notification center

**Given** a user fails login multiple times
**When** threshold is exceeded
**Then** system enforces progressive lockout: 5 fails = 15 min, 10 fails = 1 hour, 15 fails = 24 hours (FR-TA9f)
**And** displays lockout duration to user

**Given** a Tenant Admin's password is 90+ days old
**When** they log in
**Then** system prompts for password change with 7-day advance warning (FR-TA9g)
**And** blocks access after grace period if not changed

**Given** a Tenant Admin wants to review security events
**When** they access the audit log
**Then** system shows detailed log with export capability (FR-TA9h)
**And** log includes: all logins, setting changes, security events

**Technical Notes:**
- Login history in `loginAttempts` table with geolocation via IP lookup
- 2FA via `otplib` library for TOTP generation/validation
- Recovery codes stored hashed in database
- Session management via Convex Auth session table
- Password age tracked via `passwordChangedAt` timestamp

---

### Story 3.12: Account Lifecycle & Admin Transfer

As a **Tenant Admin**,
I want to manage my account and transfer admin responsibilities when needed,
So that institutional administration continues smoothly through personnel changes.

**Acceptance Criteria:**

**Given** a Tenant Admin accesses their profile
**When** they update profile information
**Then** system allows changing: name, phone, profile picture (FR-TA10a)
**And** changes are reflected immediately

**Given** a Tenant Admin wants to change their email
**When** they submit new email
**Then** system sends verification to new email (FR-TA10b)
**And** old email remains active until new email verified
**And** upon verification, updates email across all references

**Given** a Tenant Admin wants to transfer admin role
**When** they initiate transfer to another user
**Then** system requires confirmation from both parties (FR-TA10c)
**And** sends acceptance request to new admin
**And** transfer completes only when both confirm

**Given** a Tenant Admin leaves the organization unexpectedly
**When** Platform Admin is notified
**Then** Platform Admin can assign a new Tenant Admin (FR-TA10d)
**And** new admin receives invitation to complete setup

**Given** a Tenant Admin is also needed as PO
**When** they are assigned PO role
**Then** system allows holding both Tenant Admin and PO roles simultaneously (FR-TA10f)
**And** user sees role switcher in navigation

**Given** a Tenant Admin wants to delete their account
**When** they initiate deletion
**Then** system requires transferring admin role first (FR-TA10g)
**And** blocks deletion until transfer is complete

**Given** an admin role transfer occurs
**When** the transfer completes
**Then** system maintains complete audit trail (FR-TA10h)
**And** logs: initiator, recipient, timestamp, method (voluntary/admin-assigned)

**Technical Notes:**
- Admin transfer via `adminTransferRequests` table with `status` field
- Dual-role users have both roles in `users.roles` array
- Email change requires verification before update
- Platform Admin override via special mutation with audit logging
- Account deletion is soft-delete with 30-day recovery window

---

## Story Dependency Graph

```
Story 3.1 (Onboarding)
    │
    ├── Story 3.2 (Dashboard)
    │       │
    │       ├── Story 3.9 (Visibility)
    │       │
    │       └── Story 3.10 (Notifications)
    │
    ├── Story 3.3 (PO Add/Invite)
    │       │
    │       └── Story 3.4 (PO Lifecycle)
    │
    ├── Story 3.5 (Settings)
    │
    ├── Story 3.6 (Billing Dashboard)
    │       │
    │       └── Story 3.7 (Subscription Lifecycle)
    │
    ├── Story 3.8 (Reports)
    │
    ├── Story 3.11 (Security)
    │
    └── Story 3.12 (Account Lifecycle)
```

## Definition of Done

- [ ] All 12 stories implemented and tested
- [ ] Unit tests for all Convex functions
- [ ] Integration tests for billing flows
- [ ] Security review for admin transfer and 2FA
- [ ] All FR and NFR acceptance criteria verified
- [ ] Report generation performance tested
- [ ] Code reviewed and merged to main branch
