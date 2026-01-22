---
epic: 1
title: "Project Foundation & Authentication System"
status: ready
priority: P0
totalStories: 8
frsConvered: ["FR1", "FR2", "FR2a-FR2h", "FR3", "FR4", "FR5", "FR5a-FR5h", "FR6", "FR7"]
nfrsAddressed: ["NFR-S1", "NFR-S2", "NFR-S3", "NFR-S4", "NFR-S5", "NFR-S6", "NFR-S7", "NFR-S10"]
dependencies: []
createdAt: 2026-01-22
---

# Epic 1: Project Foundation & Authentication System

## Epic Goal

Users can securely access the platform with role-based permissions and complete tenant isolation.

## User Outcome

All four user types (Platform Admin, Tenant Admin, PO, DU) can register, login, and access their appropriate dashboards with proper authorization.

## Requirements Covered

### Functional Requirements
- FR1: Users can register for a trial account using email and organization details
- FR2: Users can log in using email and password
- FR2a-FR2h: Login error handling, session management, concurrent logins
- FR3: Users can reset their password via email verification
- FR4: Users can log out and terminate their session
- FR5: Departmental Users can log in using an access code provided by their PO
- FR5a-FR5h: Access code validation, expiration, lockout, period restrictions
- FR6: System can enforce role-based access control across 4 user levels
- FR7: System can restrict users to only see data within their tenant

### Non-Functional Requirements
- NFR-S1: Complete tenant data isolation
- NFR-S2: All data encrypted at rest using AES-256
- NFR-S3: All data encrypted in transit using TLS 1.3
- NFR-S4: Session tokens expire after 24 hours of inactivity
- NFR-S5: Password requirements (12+ chars, uppercase, lowercase, number, special)
- NFR-S6: Failed login attempts limited to 5 before temporary lockout
- NFR-S7: All user inputs sanitized against SQL injection and XSS
- NFR-S10: CORS restricted to known domains only

### Architecture Requirements
- Use Convex Ents SaaS Starter as foundation
- Replace Clerk authentication with Convex Auth
- Implement 4-layer RBAC (Platform Admin, Tenant Admin, PO, DU)
- Configure Procureline Green theme (#18b969)

## Implementation Notes

- This epic establishes the foundational infrastructure for all subsequent epics
- All authentication flows use Convex Auth with Email OTP for 2FA
- DU access code authentication is unique to this platform
- Tenant isolation must be enforced at the database query level via Convex functions

---

## Stories

### Story 1.1: Project Initialization with Convex Ents Starter

As a **development team**,
I want the project initialized with Convex Ents SaaS Starter and Convex Auth configured,
So that we have a solid foundation with authentication, database, and multi-tenancy patterns ready for development.

**Acceptance Criteria:**

**Given** a fresh development environment
**When** the project is initialized
**Then** the Convex Ents SaaS Starter is cloned and configured
**And** Clerk packages (@clerk/nextjs, @clerk/clerk-react) are removed
**And** Convex Auth (@convex-dev/auth) is installed and configured
**And** Next.js 14+ App Router structure is in place
**And** shadcn/ui and Tailwind CSS are configured with Procureline Green theme (#18b969)
**And** TypeScript strict mode is enabled
**And** the Convex development environment connects successfully
**And** basic schema.ts with Ents is created (users, tenants tables)
**And** environment variables template (.env.example) is created

**Technical Notes:**
```bash
# Initialization sequence
git clone https://github.com/get-convex/ents-saas-starter.git procureline
cd procureline
npm uninstall @clerk/nextjs @clerk/clerk-react
npm install @convex-dev/auth
npx convex dev
```

---

### Story 1.2: Tenant Admin Registration & Trial Signup

As a **prospective customer**,
I want to register for a trial account using my email and organization details,
So that I can start using Procureline with a 14-day free trial.

**Acceptance Criteria:**

**Given** a visitor on the signup page
**When** they enter valid email, password, and organization name
**Then** a new tenant is created with 14-day trial status
**And** a Tenant Admin user is created and linked to the tenant
**And** password meets policy (12+ chars, uppercase, lowercase, number, special)
**And** email verification is sent
**And** user cannot access dashboard until email is verified

**Given** a visitor enters an email that already exists
**When** they submit the registration form
**Then** system displays "Email already registered" error
**And** no duplicate account is created

**Given** a visitor enters invalid email format
**When** they submit the registration form
**Then** system displays clear validation error for email field

**Given** a visitor enters password that doesn't meet policy
**When** they submit the registration form
**Then** system displays specific password requirements not met

**Technical Notes:**
- Creates `tenants` table entry with `status: 'trial'`, `trialEndsAt: now + 14 days`
- Creates `users` table entry with `role: 'tenant_admin'`, `tenantId: tenant._id`
- Email verification via Convex Auth email provider

---

### Story 1.3: User Login with Email & Password

As a **registered user**,
I want to log in using my email and password,
So that I can access my dashboard and perform my role-specific tasks.

**Acceptance Criteria:**

**Given** a registered user with verified email
**When** they enter correct email and password
**Then** they are authenticated and redirected to their role-appropriate dashboard
**And** a session is created

**Given** a user enters invalid email format
**When** they attempt to login
**Then** system displays "Invalid email format" error (FR2a)

**Given** a user enters incorrect password
**When** they attempt to login
**Then** system displays "Incorrect password" error (FR2b)

**Given** a PO whose account is deactivated by Tenant Admin
**When** they attempt to login
**Then** system displays "Account deactivated. Contact your administrator." (FR2c)

**Given** a user whose tenant subscription is expired/suspended
**When** they attempt to login
**Then** system displays "Subscription inactive. Contact your administrator." (FR2d)

**Given** a user with an expired session
**When** they attempt to access a protected page
**Then** system redirects to login with "Session expired. Please log in again." (FR2e)

**Given** system is in maintenance mode
**When** any user attempts to login
**Then** system displays maintenance mode message with expected return time (FR2h)

**Technical Notes:**
- Role-based redirect: Platform Admin → /platform-admin, Tenant Admin → /tenant-admin, PO → /po, DU → /du
- Check tenant.status before allowing login
- Check user.isActive before allowing login

---

### Story 1.4: Password Reset via Email

As a **registered user**,
I want to reset my password via email verification,
So that I can regain access to my account if I forget my password.

**Acceptance Criteria:**

**Given** a user on the login page
**When** they click "Forgot Password" and enter their registered email
**Then** a password reset email is sent within 60 seconds
**And** the reset link expires after 24 hours

**Given** a user clicks a valid reset link
**When** they enter a new password meeting policy requirements
**Then** password is updated successfully
**And** all existing sessions are invalidated
**And** user is redirected to login page with success message

**Given** a user clicks an expired reset link
**When** they attempt to reset password
**Then** system displays "Reset link expired. Please request a new one."

**Given** a user enters an unregistered email for password reset
**When** they submit the request
**Then** system displays generic "If email exists, reset link sent" (security: no email enumeration)

**Technical Notes:**
- Use Convex Auth password reset flow
- Store reset token with expiration in database
- Invalidate all sessions on password change for security

---

### Story 1.5: Session Management & Logout

As a **logged-in user**,
I want to manage my session and log out securely,
So that my account remains secure when I'm done using the platform.

**Acceptance Criteria:**

**Given** a logged-in user
**When** they click "Log out"
**Then** their session is terminated immediately
**And** they are redirected to the login page
**And** attempting to use back button shows login page, not cached content (FR4)

**Given** a user session that has been inactive for 24 hours
**When** they attempt any action
**Then** session is automatically expired
**And** user is redirected to login with "Session expired" message (NFR-S4)

**Given** a user who selects "Remember me" during login
**When** they close and reopen browser within 30 days
**Then** they remain logged in without re-authentication (FR2f)

**Given** a user logged in on multiple devices
**When** they log in from a new device
**Then** system allows concurrent sessions (FR2g)
**And** each session is tracked independently

**Technical Notes:**
- Implement session table to track active sessions
- "Remember me" extends session to 30 days
- Default session timeout: 24 hours of inactivity
- Use HTTP-only secure cookies

---

### Story 1.6: Four-Layer Role-Based Access Control

As a **system administrator**,
I want role-based access control across 4 user levels,
So that users can only access features and data appropriate to their role.

**Acceptance Criteria:**

**Given** the RBAC system is implemented
**When** roles are defined
**Then** four distinct roles exist: Platform Admin, Tenant Admin, PO, DU
**And** each role has specific permission sets defined

**Given** a Platform Admin user
**When** they log in
**Then** they can access platform administration features
**And** they can view all tenants
**And** they cannot access tenant-specific procurement features

**Given** a Tenant Admin user
**When** they log in
**Then** they can access tenant administration features
**And** they can manage POs within their tenant
**And** they cannot access other tenants' data
**And** they cannot access platform administration

**Given** a Procurement Officer user
**When** they log in
**Then** they can access PO features (departments, categories, items, consolidation)
**And** they cannot access tenant administration features
**And** they cannot access other tenants' data

**Given** a Departmental User
**When** they log in
**Then** they can only access their department's planning interface
**And** they cannot access PO or admin features
**And** they cannot see other departments' data

**Given** any user attempts to access a route outside their role permissions
**When** the request is processed
**Then** system returns 403 Forbidden
**And** user is redirected to their appropriate dashboard

**Technical Notes:**
- Roles stored in users table: `role: 'platform_admin' | 'tenant_admin' | 'po' | 'du'`
- Create `_roleGuard.ts` helper for Convex functions
- Create `RoleGuard` React component for frontend protection
- Create Next.js middleware for route protection
- DU also has `departmentId` field linking to their department

---

### Story 1.7: Tenant Data Isolation

As a **tenant user**,
I want complete data isolation between tenants,
So that my organization's data is never visible to other organizations.

**Acceptance Criteria:**

**Given** the multi-tenancy system is implemented
**When** any data query is executed
**Then** tenantId filter is automatically applied
**And** users can only see data belonging to their tenant (FR7)

**Given** a user attempts to access data from another tenant via URL manipulation
**When** the request is processed
**Then** system returns 404 Not Found (not 403, to prevent tenant enumeration)
**And** the attempt is logged for security audit

**Given** a Convex query or mutation is written
**When** it accesses tenant-scoped data
**Then** it must include tenantId filtering via the _tenantGuard helper
**And** TypeScript compilation fails if tenantId filter is missing (NFR-S1)

**Given** a Platform Admin user
**When** they access tenant data
**Then** they can view data across all tenants (for admin purposes)
**And** this access is logged in the audit trail

**Technical Notes:**
- All tenant-scoped tables must have `tenantId` field with index
- Create `_tenantGuard.ts` helper that extracts tenantId from auth context
- All queries use `.withIndex("by_tenant", q => q.eq("tenantId", tenantId))`
- Platform Admin bypasses tenant filter but actions are logged

---

### Story 1.8: DU Access Code Authentication

As a **Departmental User**,
I want to log in using an access code provided by my Procurement Officer,
So that I can access my department's procurement planning interface without a traditional account setup.

**Acceptance Criteria:**

**Given** a DU with a valid access code
**When** they enter the access code on the DU login page
**Then** system validates the code
**And** prompts for email verification (OTP)
**And** upon OTP verification, DU is logged in and linked to their department (FR5)

**Given** a DU enters an invalid access code
**When** they submit the form
**Then** system displays "Invalid access code" error (FR5a)

**Given** a DU enters an expired access code
**When** they submit the form
**Then** system displays "Access code expired. Contact your Procurement Officer." (FR5b)

**Given** a DU fails login 5 times consecutively
**When** they attempt another login
**Then** system locks access for 15 minutes (FR5d)
**And** displays lockout message with remaining time

**Given** a DU attempts to log in before submission period starts
**When** they enter a valid access code
**Then** system displays "Submission period has not started yet. Please wait until [date]." (FR5e)

**Given** a DU attempts to log in after submission period ends
**When** they enter a valid access code
**Then** system displays "Submission period has ended." (FR5f)

**Given** a DU's tenant subscription is inactive
**When** they attempt to log in
**Then** system displays appropriate subscription status message (FR5g)

**Given** a DU's account has been deactivated
**When** they attempt to log in
**Then** system displays "Account deactivated. Contact your Procurement Officer." (FR5h)

**Technical Notes:**
- Access codes stored in `accessCodes` table with `departmentId`, `code`, `expiresAt`, `isActive`
- Code format: `[FiscalYear]-[DeptInitials]-[RandomChars]` (e.g., "2025-CS-X7K9")
- First-time DU: creates user record linked to department
- Returning DU: validates code matches existing user's department
- Track failed attempts in `loginAttempts` table for lockout logic

---

## Story Dependency Graph

```
Story 1.1 (Project Init)
    │
    ├── Story 1.2 (Registration) ─────┐
    │                                  │
    ├── Story 1.3 (Login) ────────────┼── Story 1.5 (Session/Logout)
    │                                  │
    ├── Story 1.4 (Password Reset) ───┘
    │
    ├── Story 1.6 (RBAC) ─────────────── Story 1.7 (Tenant Isolation)
    │
    └── Story 1.8 (DU Access Codes) ──── Requires 1.6 & 1.7
```

## Definition of Done

- [ ] All 8 stories implemented and tested
- [ ] Unit tests for all Convex functions
- [ ] Integration tests for auth flows
- [ ] Security review completed
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
