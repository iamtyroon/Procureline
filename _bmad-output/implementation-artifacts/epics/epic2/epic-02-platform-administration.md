---
epic: 2
title: "Platform Administration"
status: ready
priority: P0
totalStories: 14
frsConvered: ["FR8-FR14", "FR-PA1a-PA10j"]
nfrsAddressed: ["NFR-S1", "NFR-S9", "NFR-R1", "NFR-R3", "NFR-R7"]
dependencies: ["Epic 1"]
createdAt: 2026-01-22
---

# Epic 2: Platform Administration

## Epic Goal

Platform Admin can manage the entire multi-tenant SaaS platform, monitor system health, and maintain security.

## User Outcome

Platform Admin has complete visibility and control over all tenants, subscriptions, system health, and security compliance.

## Requirements Covered

### Functional Requirements (99 FRs)

**Core (FR8-FR14):**
- FR8: Platform Admin can view a dashboard of all tenants with status indicators
- FR9: Platform Admin can view individual tenant details and usage metrics
- FR10: Platform Admin can update tenant configuration settings
- FR11: Platform Admin can view system health metrics (API, database, jobs)
- FR12: Platform Admin can view and manage subscription statuses
- FR13: Platform Admin can access support ticket activity logs
- FR14: Platform Admin can monitor Free tier usage and upgrade conversion metrics

**Sub-sections:**
- FR-PA1a-PA1j: Authentication & Access (10 FRs)
- FR-PA2a-PA2j: Dashboard & Monitoring (10 FRs)
- FR-PA3a-PA3o: Tenant Management (15 FRs)
- FR-PA4a-PA4o: Subscription & Billing (15 FRs)
- FR-PA5a-PA5j: User Management Cross-Tenant (10 FRs)
- FR-PA6a-PA6j: Free Tier Management (10 FRs)
- FR-PA7a-PA7j: System Health (10 FRs)
- FR-PA8a-PA8j: Security & Compliance (10 FRs)
- FR-PA9a-PA9j: Support & Incidents (10 FRs)
- FR-PA10a-PA10j: Configuration (10 FRs)

### Non-Functional Requirements
- NFR-S1: Complete tenant data isolation
- NFR-S9: Immutable audit logs
- NFR-R1: System uptime of 99.5%
- NFR-R3: Automated daily backups with 30-day retention
- NFR-R7: Graceful degradation

## Implementation Notes

- Platform Admin portal accessible via dedicated URL (/platform-admin)
- Mandatory 2FA for all Platform Admin accounts
- All actions logged to immutable audit trail
- Bento box dashboard design per UX specification

## Epic 1 Dependency

**Prerequisites:**
- ✅ Epic 1 must be 100% complete before starting Epic 2
- Next.js 16 + React 19 + Convex stack validated and running
- Authentication system (Convex Auth) fully functional
- RBAC system with all 4 roles implemented
- Tenant isolation enforced at database level

**What You'll Inherit from Epic 1:**
- `_roleGuard.ts` helper for role-based access in Convex functions
- `RoleGuard` React component for frontend route protection
- `_tenantGuard.ts` helper for tenant filtering
- Platform Admin role already defined in users table
- Security infrastructure (XSS protection, CORS, audit logging)

**Developer Notes:**
- All Platform Admin routes require `role: 'platform_admin'` check
- Platform Admin bypasses tenant filtering (can view all tenants)
- All Platform Admin actions MUST be logged via audit system from Story 1.9

---

## Stories

### Story 2.0: NestJS Microservice Foundation & External Services

As a **development team**,
I want a NestJS microservice providing payment processing, file generation, and email services,
So that all epics have access to critical external integrations and heavy processing capabilities.

**Acceptance Criteria:**

**Given** the platform requires external service integration
**When** the NestJS microservice is initialized
**Then** project structure follows NestJS best practices with modular architecture
**And** includes: auth module, payments module, files module, emails module

**Given** Next.js frontend needs to call NestJS services
**When** API gateway is configured
**Then** REST API is exposed at `/api/services/*` with OpenAPI documentation
**And** all endpoints require authentication via Convex session token validation

**Given** Convex session tokens must be validated
**When** Next.js calls NestJS
**Then** NestJS validates token by calling Convex auth endpoint
**And** extracts userId and tenantId from token
**And** rejects requests with invalid/expired tokens

**Given** payment processing is required
**When** Stripe integration is configured
**Then** Stripe SDK is installed and initialized with API keys
**And** supports: creating subscriptions, processing payments, managing customers
**And** webhook endpoints handle: payment_intent.succeeded, subscription_updated, invoice.paid

**Given** M-Pesa payment processing is needed (Kenya market)
**When** IntaSend integration is configured
**Then** IntaSend SDK is installed and initialized
**And** supports: M-Pesa STK Push, payment verification, callback handling
**And** webhook endpoints handle: payment notifications and status updates

**Given** bank transfer payments are used (LPO-based)
**When** manual verification is needed
**Then** system provides API for Platform Admin to mark payments as verified
**And** updates tenant subscription status accordingly

**Given** invoices and reports need generation
**When** PDF generation is configured
**Then** PDFKit or Puppeteer is installed
**And** supports: invoice templates, report templates, watermarks, multi-page documents

**Given** Excel import/export is required across multiple epics
**When** Excel processing is configured
**Then** ExcelJS library is installed
**And** supports: reading uploaded files, generating downloads, data validation, template creation

**Given** email sending is required
**When** Resend integration is configured
**Then** Resend SDK is installed with API key
**And** supports: transactional emails, templates, bounce/complaint webhooks
**And** email templates use React Email for consistent branding

**Given** webhook events are received from external services
**When** webhook endpoints are hit
**Then** system validates webhook signatures (Stripe: stripe-signature, IntaSend: API key)
**And** processes events idempotently (checks for duplicate event IDs)
**And** retries failed processing with exponential backoff (3 attempts max)

**Given** file processing tasks are CPU-intensive
**When** background jobs are needed
**Then** Bull queue with Redis is configured for job processing
**And** supports: retry logic, job prioritization, progress tracking

**Given** the microservice needs error tracking
**When** exceptions occur
**Then** errors are logged with context (userId, tenantId, request details)
**And** critical errors trigger alerts to Platform Admin

**Given** the microservice is deployed
**When** environment variables are configured
**Then** includes: DATABASE_URL (Convex), STRIPE_SECRET_KEY, INTASEND_API_KEY, RESEND_API_KEY, REDIS_URL
**And** validates all required env vars on startup

**Given** API rate limiting is needed
**When** endpoints are exposed
**Then** rate limiting is configured: 100 req/min per user, 1000 req/min per tenant
**And** returns 429 with retry-after header when exceeded

**Technical Notes:**

**Project Structure:**
```
nestjs-services/
├── src/
│   ├── auth/
│   │   ├── auth.guard.ts          # Validates Convex tokens
│   │   ├── convex-auth.service.ts # Calls Convex to verify tokens
│   │   └── decorators/            # @UserId(), @TenantId() decorators
│   ├── payments/
│   │   ├── stripe.service.ts      # Stripe SDK wrapper
│   │   ├── intasend.service.ts    # IntaSend SDK wrapper
│   │   ├── bank-transfer.service.ts
│   │   ├── webhooks.controller.ts # Payment webhooks
│   │   └── dto/                   # Payment DTOs
│   ├── files/
│   │   ├── pdf.service.ts         # PDF generation
│   │   ├── excel.service.ts       # Excel import/export
│   │   └── templates/             # PDF/Excel templates
│   ├── emails/
│   │   ├── resend.service.ts      # Resend SDK wrapper
│   │   ├── templates/             # React Email templates
│   │   └── dto/
│   └── common/
│       ├── filters/               # Exception filters
│       ├── interceptors/          # Logging, transform
│       └── pipes/                 # Validation pipes
├── .env.example
└── package.json
```

**Authentication Flow:**
```typescript
// auth.guard.ts
@Injectable()
export class ConvexAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) throw new UnauthorizedException();

    // Call Convex to validate token
    const user = await this.convexAuthService.validateToken(token);

    request.user = user; // { userId, tenantId, role }
    return true;
  }
}
```

**Stripe Integration:**
```typescript
// stripe.service.ts
@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  async createSubscription(customerId: string, priceId: string) {
    return await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
    });
  }

  async handleWebhook(signature: string, body: Buffer) {
    const event = this.stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Process event and call Convex mutations to update subscription status
  }
}
```

**IntaSend Integration:**
```typescript
// intasend.service.ts
@Injectable()
export class IntaSendService {
  private client: IntaSend;

  constructor() {
    this.client = new IntaSend(
      process.env.INTASEND_PUBLISHABLE_KEY,
      process.env.INTASEND_SECRET_KEY,
      true // test mode
    );
  }

  async initiateMpesaPayment(phoneNumber: string, amount: number) {
    const collection = this.client.collection();
    return await collection.mpesaStkPush({
      phone_number: phoneNumber,
      amount: amount,
      currency: 'KES',
      api_ref: generateRef(),
    });
  }
}
```

**Excel Generation:**
```typescript
// excel.service.ts
@Injectable()
export class ExcelService {
  async generateDepartmentTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Departments');

    sheet.columns = [
      { header: 'Department Name', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 15 },
      { header: 'Budget', key: 'budget', width: 15 },
    ];

    return await workbook.xlsx.writeBuffer();
  }

  async importDepartments(file: Express.Multer.File): Promise<Department[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);

    const sheet = workbook.getWorksheet(1);
    const departments: Department[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        departments.push({
          name: row.getCell(1).value,
          code: row.getCell(2).value,
          budget: row.getCell(3).value,
        });
      }
    });

    return departments;
  }
}
```

**Email Templates:**
```typescript
// emails/templates/po-invitation.tsx (React Email)
export function POInvitationEmail({ orgName, loginUrl, code }) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>You've been invited to {orgName}</Heading>
          <Text>
            You've been added as a Procurement Officer. Use the access code
            below to log in and get started.
          </Text>
          <Section>
            <Text style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {code}
            </Text>
          </Section>
          <Button href={loginUrl}>Log In Now</Button>
        </Container>
      </Body>
    </Html>
  );
}
```

**Deployment:**
- Deploy as separate service (Vercel, Railway, or Fly.io)
- Environment variables managed via deployment platform
- Health check endpoint at `/health`
- Metrics exposed at `/metrics` (Prometheus format)
- CORS configured to accept requests from Next.js app domain only

**Dependencies:**
```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@nestjs/bull": "^10.0.0",
    "stripe": "^14.0.0",
    "intasend-node": "^1.0.0",
    "resend": "^2.0.0",
    "exceljs": "^4.4.0",
    "pdfkit": "^0.14.0",
    "react-email": "^2.0.0",
    "bull": "^4.12.0",
    "redis": "^4.6.0",
    "axios": "^1.6.0"
  }
}
```

**Testing Requirements:**
- Unit tests for all services
- Integration tests for payment webhooks with test events
- E2E tests for critical flows (subscription creation, invoice generation)
- Mock external services (Stripe, IntaSend) in test environment

---

### Story 2.1: Platform Admin Authentication & 2FA

As a **Platform Admin**,
I want secure authentication with mandatory 2FA,
So that the platform administration is protected against unauthorized access.

**Acceptance Criteria:**

**Given** a Platform Admin navigating to the admin portal
**When** they access the dedicated admin URL (/platform-admin/login)
**Then** they see a distinct admin login page (FR-PA1a)

**Given** a Platform Admin logging in for the first time
**When** they complete password authentication
**Then** system requires 2FA setup before granting access (FR-PA1b)
**And** system provides backup codes for recovery (FR-PA1c)

**Given** a Platform Admin with 2FA configured
**When** they enter correct password
**Then** system prompts for 2FA code (Email OTP)
**And** access is granted only after valid 2FA verification

**Given** a login attempt from a suspicious location (new country/IP)
**When** the system detects the anomaly
**Then** additional verification is required before access (FR-PA1d)
**And** the attempt is logged

**Given** a Platform Admin session idle for 30 minutes
**When** they attempt any action
**Then** session is expired and re-authentication required (FR-PA1e)

**Given** a Platform Admin logged in on multiple devices
**When** sessions are active concurrently
**Then** all sessions are tracked with activity logging (FR-PA1f)

**Given** a security incident requiring credential revocation
**When** Platform Admin initiates revocation
**Then** all sessions are immediately terminated (FR-PA1h)
**And** password reset is required for re-access

**Given** an attempt to delete a Platform Admin account
**When** the action is requested
**Then** system prevents deletion (FR-PA1i)
**And** displays "Platform Admin accounts cannot be deleted"

**Given** any Platform Admin action
**When** the action is completed
**Then** complete audit trail is maintained (FR-PA1j)
**And** includes timestamp, action, IP address, and outcome

**Technical Notes:**
- Dedicated auth flow separate from tenant users
- 2FA via Email OTP (Convex Auth)
- Store backup codes hashed in database
- IP geolocation for suspicious login detection

---

### Story 2.2: Platform Admin Dashboard Shell

As a **Platform Admin**,
I want a comprehensive dashboard showing system overview,
So that I can quickly assess platform health and take action on critical issues.

**Acceptance Criteria:**

**Given** a Platform Admin logs in successfully
**When** they land on the dashboard
**Then** they see a Bento box grid layout with key metrics (FR8)

**Given** the dashboard is displayed
**When** system health data is loaded
**Then** health summary shows API, DB, jobs, storage status (FR-PA2a)
**And** each metric has green/yellow/red indicator

**Given** the dashboard is displayed
**When** tenant data is loaded
**Then** tenant overview shows counts by tier: Free, Starter, Professional, Enterprise; and status: suspended, churned (FR-PA2b)

**Given** the dashboard is displayed
**When** revenue data is loaded
**Then** key metrics show MRR, ARR, Free-to-paid conversion rate (FR-PA2c)

**Given** the dashboard is displayed
**When** alerts exist
**Then** recent alerts display with severity indicators (FR-PA2d)
**And** alerts can be filtered by severity (FR-PA2j)

**Given** a critical system issue occurs (API down, DB errors)
**When** the issue is detected
**Then** Platform Admin receives SMS/email alert immediately (FR-PA2e)

**Given** the dashboard is displayed
**When** quick actions are needed
**Then** buttons for common actions are visible: Create Tenant, View Logs, etc. (FR-PA2f)

**Given** metrics are being monitored
**When** unusual patterns are detected (anomalies)
**Then** system generates alert automatically (FR-PA2g)

**Given** any timestamp is displayed
**When** user views the time
**Then** it shows UTC with local time tooltip on hover (FR-PA2h)

**Given** a Platform Admin with preferences
**When** they customize widget layout
**Then** preferences are saved for future sessions (FR-PA2i)

**Technical Notes:**
- Bento grid: 4 columns on desktop, responsive
- Real-time updates via Convex subscriptions
- Alert severity: critical (red), warning (yellow), info (blue)
- Dashboard state persisted in user preferences

---

### Story 2.3: Tenant List & Overview

As a **Platform Admin**,
I want to view all tenants with filtering and status indicators,
So that I can quickly find and assess any tenant's status.

**Acceptance Criteria:**

**Given** a Platform Admin navigates to tenant management
**When** the tenant list loads
**Then** all tenants are displayed with status indicators (FR-PA3a)
**And** list shows: name, subdomain, status, plan, created date, user count

**Given** the tenant list is displayed
**When** Platform Admin applies filters
**Then** list can be filtered by tier (Free, Starter, Professional, Enterprise) and status (active, suspended, churned)
**And** list can be searched by name or subdomain

**Given** a Platform Admin clicks on a tenant
**When** the detail view opens
**Then** individual tenant details and usage metrics are shown (FR9)
**And** includes: user count, storage used, last activity, subscription details

**Given** the tenant list has many entries
**When** scrolling through the list
**Then** pagination or virtual scrolling handles large datasets efficiently

**Technical Notes:**
- DataTable component with sorting, filtering, pagination
- Status badges: Active (green), Trial (blue), Suspended (red), Churned (gray)
- Click row to navigate to tenant detail page

---

### Story 2.4: Tenant Creation & Provisioning

As a **Platform Admin**,
I want to create new tenants with automatic provisioning,
So that new institutions can be onboarded quickly and reliably.

**Acceptance Criteria:**

**Given** a Platform Admin initiates tenant creation
**When** they fill in the creation form
**Then** form requires: organization name, subdomain, Tenant Admin email (FR-PA3b)

**Given** a subdomain is entered
**When** validation runs
**Then** system validates uniqueness and format (alphanumeric, hyphens only) (FR-PA3c)
**And** displays real-time availability check

**Given** valid tenant details are submitted
**When** creation is processed
**Then** system provisions tenant infrastructure automatically (FR-PA3d)
**And** creates tenant record with default settings
**And** sends invitation email to Tenant Admin

**Given** provisioning encounters an error
**When** the process fails partway
**Then** system rolls back partial creation (FR-PA3e)
**And** displays error message with details
**And** no orphaned data remains

**Given** tenant creation succeeds
**When** provisioning completes
**Then** Platform Admin sees success confirmation
**And** new tenant appears in tenant list with "Pending" status until Tenant Admin accepts

**Technical Notes:**
- Subdomain validation: ^[a-z0-9][a-z0-9-]*[a-z0-9]$, 3-63 chars
- Provisioning creates: tenant record, default settings, invitation record
- Use database transaction for atomic creation
- Invitation email via Resend/NestJS

---

### Story 2.5: Tenant Configuration & Management

As a **Platform Admin**,
I want to manage tenant settings, suspend, restore, and delete tenants,
So that I can handle tenant lifecycle and troubleshooting needs.

**Acceptance Criteria:**

**Given** a Platform Admin views a tenant's details
**When** they access configuration
**Then** they can update tenant configuration settings (FR10, FR-PA3g)

**Given** a Platform Admin needs to suspend a tenant
**When** they click "Suspend Tenant"
**Then** tenant access is immediately blocked (FR-PA3h)
**And** all tenant users see "Account suspended" on login attempt
**And** action is logged with reason

**Given** a suspended tenant needs restoration
**When** Platform Admin clicks "Restore Tenant"
**Then** tenant access is immediately restored (FR-PA3i)
**And** all users can log in again
**And** action is logged

**Given** a Platform Admin initiates tenant deletion
**When** they confirm the deletion
**Then** tenant enters 90-day soft delete period (FR-PA3j)
**And** tenant data is marked for deletion but retained
**And** after 90 days, permanent purge occurs automatically

**Given** a tenant approaches storage limit
**When** storage reaches 90% capacity
**Then** system auto-alerts Platform Admin (FR-PA3k)

**Given** a tenant exceeds user count for their tier
**When** the limit is exceeded
**Then** system auto-alerts Platform Admin (FR-PA3l)

**Given** a tenant needs subdomain change
**When** Platform Admin updates subdomain
**Then** old subdomain redirects to new one (FR-PA3m)
**And** redirect remains active for 30 days

**Given** a data export is needed
**When** Platform Admin requests export
**Then** complete tenant data export is generated (FR-PA3n)
**And** download link is provided

**Given** troubleshooting requires config override
**When** Platform Admin applies override
**Then** tenant configuration can be temporarily overridden (FR-PA3o)
**And** override is logged and time-limited

**Technical Notes:**
- Soft delete: set `deletedAt` timestamp, scheduled job for purge
- Storage alerts via Convex scheduled function
- Subdomain redirect via middleware

---

### Story 2.6: Subscription Status Management

As a **Platform Admin**,
I want to view and manage all subscription statuses,
So that I can monitor revenue and handle subscription issues.

**Acceptance Criteria:**

**Given** a Platform Admin accesses subscription management
**When** the subscription list loads
**Then** all subscription statuses are visible with filters (FR12, FR-PA4a)
**And** can filter by: tier, status, payment method, date range

**Given** a Platform Admin needs revenue insights
**When** they access revenue reports
**Then** reports show MRR, ARR, revenue by tier (FR-PA4b)
**And** data can be exported to CSV

**Given** subscription data is displayed
**When** Platform Admin views details
**Then** each subscription shows: tenant, tier, status, next billing date, amount

**Technical Notes:**
- Revenue calculations: MRR = sum of monthly equivalents, ARR = MRR × 12
- Tier breakdown chart using Recharts
- Real-time data via Convex subscriptions

---

### Story 2.7: Payment Verification & Processing

As a **Platform Admin**,
I want to verify and process payments across all methods,
So that billing is accurate and tenants maintain access appropriately.

**Acceptance Criteria:**

**Given** a bank transfer payment is received
**When** Platform Admin verifies the payment
**Then** payment can be manually marked as verified (FR-PA4c)
**And** tenant subscription is updated accordingly

**Given** M-Pesa payments need reconciliation
**When** daily reconciliation runs
**Then** system reconciles M-Pesa payments automatically (FR-PA4d)
**And** failures are retried up to 3 times

**Given** a Stripe webhook is received
**When** processing the webhook
**Then** system processes with retry queue for failures (FR-PA4e)
**And** subscription status updates automatically

**Given** a refund is needed
**When** Platform Admin initiates refund
**Then** approval workflow is triggered (FR-PA4f)
**And** pro-rated refunds are calculated automatically (FR-PA4g)

**Given** an Enterprise contract needs custom pricing
**When** Platform Admin applies custom pricing
**Then** custom pricing overrides standard tier pricing (FR-PA4h)

**Given** a payment fails
**When** the failure is processed
**Then** notification is sent to Tenant Admin (FR-PA4i)
**And** tenant transitions to grace period (FR-PA4j)

**Given** grace period expires (7 days)
**When** no payment is received
**Then** tenant is suspended automatically (FR-PA4k)

**Given** payment is received for suspended tenant
**When** Platform Admin verifies
**Then** tenant can be immediately restored (FR-PA4l)

**Given** invoice generation is triggered
**When** system generates invoice
**Then** invoices are created automatically with retry on failure (FR-PA4m)

**Given** multiple subscriptions need status update
**When** Platform Admin uses batch update
**Then** subscription statuses can be updated in bulk (FR-PA4n)

**Given** any billing action occurs
**When** the action completes
**Then** billing audit trail is maintained with reconciliation reports (FR-PA4o)

**Technical Notes:**
- Payment methods: Stripe (cards), IntaSend (M-Pesa), Bank Transfer (manual)
- Grace period: 7 days from payment failure
- Webhook handling via NestJS microservice
- All payment actions logged for audit

---

### Story 2.8: Cross-Tenant User Management

As a **Platform Admin**,
I want to search and manage users across all tenants,
So that I can handle security issues and support requests efficiently.

**Acceptance Criteria:**

**Given** a Platform Admin needs to find a user
**When** they use the user search
**Then** users can be searched across all tenants (FR-PA5a)
**And** search works by email, name, or tenant

**Given** a user is found in search results
**When** Platform Admin views details
**Then** user details and tenant associations are shown (FR-PA5b)

**Given** a user needs password reset
**When** Platform Admin triggers reset
**Then** password reset email is sent to user (FR-PA5c)

**Given** a user is locked out
**When** Platform Admin unlocks the account
**Then** lockout is cleared immediately (FR-PA5d)
**And** user can attempt login again

**Given** a security issue requires session termination
**When** Platform Admin forces logout
**Then** all sessions for the user are terminated (FR-PA5e)

**Given** a security threat is identified
**When** Platform Admin deactivates user
**Then** user account is immediately deactivated (FR-PA5f)
**And** user cannot log in

**Given** a tenant-wide security incident
**When** Platform Admin initiates tenant lockout
**Then** all users in tenant are locked out (FR-PA5g)

**Given** activity logs are needed
**When** Platform Admin views user activity
**Then** logs are shown with filters (FR-PA5h)
**And** can filter by date, action type

**Given** a GDPR deletion request is received
**When** Platform Admin processes the request
**Then** user data is deleted per GDPR requirements (FR-PA5i)
**And** deletion is logged for compliance

**Given** an action would orphan a tenant
**When** Platform Admin attempts the action
**Then** system prevents orphaning (no Tenant Admin) (FR-PA5j)
**And** displays appropriate error message

**Technical Notes:**
- Cross-tenant search requires Platform Admin role check
- GDPR deletion: anonymize or delete personal data, retain audit logs
- Orphan prevention: check if user is sole Tenant Admin before deactivation

---

### Story 2.9: Free Tier Management & Usage Monitoring

As a **Platform Admin**,
I want to manage Free tier tenants and monitor their usage against tier limits,
So that I can identify upgrade candidates and ensure fair platform usage.

**Acceptance Criteria:**

**Given** a Platform Admin accesses Free tier management
**When** the Free tier tenant list loads
**Then** all Free tier tenants with usage metrics are shown (FR-PA6a)
**And** metrics include: departments used/limit, categories used/limit, items per category max, logins, last activity

**Given** a Platform Admin views Free tier usage
**When** they access the usage dashboard
**Then** system displays tier limit utilization for all Free tier tenants (FR-PA6b)
**And** shows: tenant name, departments (X/10), categories (X/20), items per category (max X/50)
**And** color codes: green (<70%), yellow (70-90%), red (>90%)

**Given** a Free tier tenant approaches limits
**When** any resource exceeds 90% utilization
**Then** tenant is automatically flagged as "upgrade candidate" (FR-PA6c)
**And** Platform Admin sees "Upgrade Candidate" badge next to tenant
**And** system tracks when tenant first hit 90% threshold

**Given** a Platform Admin identifies an upgrade candidate
**When** they want to encourage upgrade
**Then** Platform Admin can flag tenant for sales outreach (FR-PA6d)
**And** tenant record is marked with "Sales Follow-up" status
**And** notes can be added to explain upgrade opportunity

**Given** a Free tier tenant has zero activity for 90 days
**When** the system checks engagement
**Then** tenant is auto-flagged as "inactive" (FR-PA6e)
**And** Platform Admin sees "Inactive" badge
**And** tenant remains accessible (no deletion or suspension)

**Given** Free tier abuse is suspected
**When** system detects same organization or email domain with multiple Free tier accounts
**Then** abuse is flagged for Platform Admin review (FR-PA6f)
**And** displays: suspected duplicate accounts, matching criteria (email domain, org name)

**Given** a Free tier tenant is ready to upgrade
**When** Platform Admin converts to paid tier
**Then** tenant upgrades to specified tier (Starter/Professional/Enterprise) (FR-PA6g)
**And** tier limits are immediately updated
**And** tenant is notified of upgrade and new features

**Given** a Free tier tenant exceeds tier limits
**When** Platform Admin views the tenant
**Then** system displays which limits are exceeded and by how much (FR-PA6h)
**And** shows: "Departments: 12/10 (exceeded by 2)"
**And** Platform Admin can see this occurred due to downgrade from higher tier

**Given** Free tier signups are monitored
**When** unusual signup volume is detected (>50 signups in 1 hour)
**Then** rate-limiting prevents spam (FR-PA6i)
**And** Platform Admin receives alert about unusual activity

**Given** conversion metrics are needed
**When** Platform Admin views Free tier conversion report
**Then** system shows: total Free tier tenants, upgrade candidates, converted to paid, inactive (FR-PA6j)
**And** displays conversion rate: (converted / (converted + active Free)) × 100%

**Technical Notes:**
- Free tier is permanent (NO time limit, NO expiration)
- Tier limits for Free tier:
  - Departments: 10 max
  - Categories: 20 max
  - Items per category: 50 max
  - DU editor: 5 category blocks, 15 items per block
  - Export rows: 300 max
  - Bulk import: NOT available
  - Catalog export: NOT available
  - Audit reports: NOT available
- Usage metrics calculated via Convex queries:
  - `db.query("tenants").filter(q => q.eq(q.field("tier"), "free")).collect()`
  - For each tenant, query departments, categories, items counts
- Upgrade candidate flagging:
  - Tracked via `upgradeCandidate: boolean` field on tenant
  - `upgradeCandidateSince: timestamp` to track when flagged
- Engagement tracking: login count, last activity timestamp, resource creation dates
- Inactive detection: Convex cron job checks `lastActivityAt` field (90 days)
- Abuse detection: match by organization name (fuzzy) or email domain
- Conversion metrics:
  - `totalFree = count where tier = "free"`
  - `upgradeCandidates = count where upgradeCandidate = true`
  - `converted = count of tier changes from "free" to paid (from audit logs)`
  - `inactive = count where lastActivityAt > 90 days ago`
- Conversion rate visualization with Recharts
- Sales follow-up tracked via `salesFollowUp: { status, notes, flaggedBy, flaggedAt }` on tenant

---

### Story 2.10: System Health Monitoring

As a **Platform Admin**,
I want to monitor all system health metrics,
So that I can proactively address issues before they impact users.

**Acceptance Criteria:**

**Given** a Platform Admin accesses system health
**When** the health dashboard loads
**Then** real-time API metrics are shown (latency, error rates) (FR11, FR-PA7a)

**Given** database health is monitored
**When** metrics are displayed
**Then** database health shows connections, query performance (FR-PA7b)

**Given** background jobs are running
**When** Platform Admin views job status
**Then** job status and history are displayed (FR-PA7c)

**Given** infrastructure is monitored
**When** metrics are displayed
**Then** CPU, memory, storage metrics are shown (FR-PA7d)

**Given** backups are configured
**When** Platform Admin views backup status
**Then** backup status and history are displayed (FR-PA7e)

**Given** API error rate exceeds 5%
**When** threshold is breached
**Then** system auto-alerts Platform Admin (FR-PA7f)

**Given** a backup fails
**When** failure is detected
**Then** system auto-alerts Platform Admin (FR-PA7g)

**Given** SSL certificate is monitored
**When** expiration is within 30 days
**Then** warning is displayed prominently (FR-PA7h)

**Given** maintenance is needed
**When** Platform Admin schedules maintenance
**Then** maintenance window can be scheduled and announced (FR-PA7i)
**And** users see maintenance notice

**Given** a manual backup is needed
**When** Platform Admin triggers backup
**Then** manual backup is initiated (FR-PA7j)
**And** progress and completion status shown

**Technical Notes:**
- Metrics from Convex dashboard API (if available) or custom tracking
- Alert thresholds configurable
- Maintenance mode: set flag, display banner to all users
- Backup status from Convex Cloud

---

### Story 2.11: Security Dashboard & Compliance

As a **Platform Admin**,
I want a security overview and compliance tools,
So that I can ensure the platform meets security requirements and respond to incidents.

**Acceptance Criteria:**

**Given** a Platform Admin accesses security
**When** the security dashboard loads
**Then** security overview shows threats, audit status (FR-PA8a)

**Given** tenant isolation needs verification
**When** Platform Admin runs verification
**Then** tenant data isolation verification executes (FR-PA8b)
**And** results show pass/fail per tenant

**Given** cross-tenant access is attempted
**When** the attempt occurs
**Then** logs capture the attempt (FR-PA8c)
**And** access is blocked and alert generated (FR-PA8d)

**Given** access logs are needed
**When** Platform Admin reviews logs
**Then** all access logs are viewable with filters (FR-PA8e)

**Given** audit log integrity is critical
**When** logs are stored
**Then** immutable audit logs with integrity verification exist (FR-PA8f)

**Given** compliance reports are needed
**When** Platform Admin generates reports
**Then** compliance reports are generated (FR-PA8g)
**And** can be exported for auditors

**Given** IP restrictions are needed
**When** Platform Admin configures allowlist
**Then** IP allowlist for Platform Admin access is enforced (FR-PA8h)

**Given** unusual access patterns occur
**When** system detects anomalies
**Then** alerts are generated (FR-PA8i)

**Given** a security incident occurs
**When** Platform Admin initiates response
**Then** security incident response protocol is available (FR-PA8j)
**And** includes: lockdown options, notification tools, audit export

**Technical Notes:**
- Audit logs: append-only table with hash chain for integrity
- Cross-tenant attempt: log and block in _tenantGuard helper
- Compliance reports: PDF generation via NestJS
- IP allowlist: check in auth middleware

---

### Story 2.12: Support Tickets & Incidents

As a **Platform Admin**,
I want to manage support tickets and system incidents,
So that I can ensure timely resolution and keep users informed.

**Acceptance Criteria:**

**Given** a Platform Admin accesses support
**When** the ticket queue loads
**Then** tickets are shown with SLA indicators (FR13, FR-PA9a)

**Given** a ticket needs assignment
**When** Platform Admin assigns ticket
**Then** ticket is assigned to handler (FR-PA9b)

**Given** a ticket needs escalation
**When** Platform Admin escalates
**Then** priority is overridden and escalated (FR-PA9c)

**Given** a ticket approaches SLA breach
**When** threshold is reached
**Then** system auto-escalates (FR-PA9d)

**Given** a system incident occurs
**When** Platform Admin creates incident
**Then** incident is created and tracked (FR-PA9e)

**Given** users need status updates
**When** Platform Admin updates status page
**Then** system status page is updated (FR-PA9f)
**And** users see current status

**Given** announcements are needed
**When** Platform Admin sends announcement
**Then** announcement reaches all or specific tenants (FR-PA9g)

**Given** future announcement is planned
**When** Platform Admin schedules it
**Then** announcement is scheduled for future delivery (FR-PA9h)

**Given** duplicate tickets exist
**When** Platform Admin merges them
**Then** tickets are merged with history preserved (FR-PA9i)

**Given** an incident is resolved
**When** resolution time passes
**Then** system generates post-incident review reminder (FR-PA9j)

**Technical Notes:**
- SLA tracking: define SLA per ticket priority, calculate breach time
- Status page: simple public page showing system status
- Announcements: in-app banner + email option
- Post-incident review: scheduled reminder 24-48 hours after resolution

---

### Story 2.13: System Configuration & Feature Flags

As a **Platform Admin**,
I want to manage system configuration and feature flags,
So that I can control platform behavior and roll out features safely.

**Acceptance Criteria:**

**Given** a Platform Admin accesses configuration
**When** they view settings
**Then** system configuration is viewable and updatable (FR-PA10a)

**Given** a feature needs toggling
**When** Platform Admin manages feature flags
**Then** features can be enabled/disabled globally (FR-PA10b)

**Given** a gradual rollout is needed
**When** Platform Admin configures rollout
**Then** feature rollout by tenant percentage is supported (FR-PA10c)

**Given** pricing changes are needed
**When** Platform Admin updates pricing
**Then** subscription tier pricing can be updated (FR-PA10d)

**Given** existing customers have current pricing
**When** pricing is updated
**Then** grandfather pricing is applied to existing customers (FR-PA10e)

**Given** email templates need updates
**When** Platform Admin edits templates
**Then** templates are updated with preview available (FR-PA10f)

**Given** integrations need management
**When** Platform Admin toggles integration
**Then** third-party integrations can be enabled/disabled (FR-PA10g)

**Given** configuration changes are made
**When** changes are saved
**Then** configuration version history is maintained (FR-PA10h)

**Given** a configuration change causes issues
**When** Platform Admin needs rollback
**Then** configuration changes can be rolled back (FR-PA10i)

**Given** configuration needs migration
**When** Platform Admin exports/imports
**Then** configuration can be exported/imported between environments (FR-PA10j)

**Technical Notes:**
- Feature flags: store in config table with tenant override support
- Percentage rollout: hash tenant ID to determine inclusion
- Config versioning: store snapshots on each change
- Email templates: React Email components in NestJS
- Grandfather pricing: store original price on subscription record

---

## Story Dependency Graph

```
Story 2.0 (NestJS Foundation) ──── CRITICAL FOUNDATION
    │
    ├── Story 2.1 (PA Auth & 2FA)
    │       │
    │       └── Story 2.2 (Dashboard Shell)
    │               │
    │               ├── Story 2.3 (Tenant List)
    │               │       │
    │               │       ├── Story 2.4 (Tenant Creation)
    │               │       │
    │               │       └── Story 2.5 (Tenant Management)
    │               │
    │               ├── Story 2.10 (System Health)
    │               │
    │               ├── Story 2.11 (Security Dashboard)
    │               │
    │               ├── Story 2.12 (Support & Incidents)
    │               │
    │               └── Story 2.13 (Configuration)
    │
    ├── Story 2.6 (Subscription Status) ──── Requires Story 2.0 (billing APIs)
    │       │
    │       └── Story 2.7 (Payment Processing) ──── Requires Story 2.0 (Stripe, IntaSend)
    │
    ├── Story 2.8 (User Management)
    │
    └── Story 2.9 (Trial Management)
```

**Implementation Order Recommendation:**
1. **Story 2.0** (NestJS Foundation) - 3-5 days - **MUST BE FIRST**
2. Story 2.1 (PA Auth & 2FA) - 1-2 days
3. Story 2.2 (Dashboard Shell) - 1 day
4. Stories 2.3-2.5 (Tenant Management) - 2-3 days
5. Story 2.6-2.7 (Billing) - 3-4 days (payment integration complexity)
6. Stories 2.8-2.13 (remaining features) - 5-7 days

## Definition of Done

- [ ] All 14 stories implemented and tested
- [ ] Story 2.0: NestJS microservice deployed and operational
- [ ] Platform Admin portal fully functional
- [ ] All CRUD operations for tenants working
- [ ] Payment processing integrated (Stripe, IntaSend, Bank Transfer)
- [ ] System health monitoring operational
- [ ] Audit logging comprehensive and immutable
- [ ] Security features (2FA, IP allowlist) working
- [ ] Feature flags system operational
- [ ] Code reviewed and merged to main branch
