---
epic: 1
title: "Project Foundation & Authentication System"
status: in-progress
priority: P0
totalStories: 9
storiesCompleted: ["1.1"]
frsConvered: ["FR1", "FR2", "FR2a-FR2h", "FR3", "FR4", "FR5", "FR5a-FR5h", "FR6", "FR7"]
nfrsAddressed: ["NFR-S1", "NFR-S2", "NFR-S3", "NFR-S4", "NFR-S5", "NFR-S6", "NFR-S7", "NFR-S10"]
dependencies: []
createdAt: 2026-01-22
updatedAt: 2026-02-16
---

## Epic 1: Project Foundation & Authentication System

### Epic Goal

Users can securely access the platform with role-based permissions and complete tenant isolation.

## User Outcome

All four user types (Platform Admin, Tenant Admin, PO, DU) can register, login, and access their appropriate dashboards with proper authorization.

## Requirements Covered

### Functional Requirements
- FR1: Users can register for a Free tier account using email and organization details
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
- Configure Procureline Green theme (#18b969) https://tweakcn.com/themes/cmfptwtsz000o04l18powb22i

## Implementation Notes

### ✅ CURRENT STATE (Updated 2026-02-16)

**Completed:**
- ✅ **Story 1.1** - Project Initialization with Convex Ents Starter (Next.js 16 + Convex Auth)

**Next Steps:**
1. **Epic 11 Story 11.1** - Marketing Landing Page (`webapp/src/app/page.tsx`) - **NEXT**
2. **Story 1.2** - Tenant Admin Registration (hooks into landing page "Create Free Account" CTA)
3. Stories 1.3-1.9 - Remaining authentication infrastructure

**Why This Order:**
- Story 1.1 complete: Backend foundation (Convex Ents + Next.js 16 + Convex Auth) is ready
- Landing page provides immediate visual validation and marketing presence
- "Create Free Account" button on landing page routes to Story 1.2 signup form
- Frontend and backend can now be developed in parallel

---

- This epic establishes the foundational infrastructure for all subsequent epics
- All authentication flows use Convex Auth with Email OTP for 2FA
- DU access code authentication is unique to this platform
- Tenant isolation must be enforced at the database query level via Convex functions

## Tech Stack Validation Results

**Validation Date:** 2026-02-03
**Status:** ✅ VALIDATED - Convex Ents Starter + Next.js 16 Compatible

### Spike Test Results

A 30-minute validation spike confirmed the upgrade path is clean:

| Component | Baseline | Upgraded | Status |
|-----------|----------|----------|--------|
| Next.js | 14.1.0 | 16.1.6 | ✅ Compatible |
| React | 18.2.0 | 19.2.4 | ✅ Compatible |
| Convex | 1.13.2 | 1.13.2 | ✅ Works with Next.js 16 |
| TypeScript | - | - | ✅ Zero compilation errors |
| Build Time | - | 6.3s | ✅ Turbopack working |

### Key Findings from Spike

1. **No Breaking Changes**
   - Zero async API errors in starter template
   - TypeScript compilation clean
   - Convex integration intact
   - No manual code changes needed

2. **Codemod Behavior**
   - `npx @next/codemod@canary upgrade latest` reports "already on target version"
   - Starter template doesn't use async APIs that need migration
   - Manual async API usage will be needed when implementing Story 1.2-1.8

3. **Minor Notes**
   - Middleware convention deprecated → use "proxy" (address in Story 1.1)
   - Clerk removal already planned (Story 1.1)
   - 28 npm vulnerabilities in baseline (standard for starter templates)

### Developer Guidance

**Before Starting Story 1.1:**
- Ensure clean git working directory
- Node.js 18+ required
- npm/pnpm/yarn available

**Expected Story 1.1 Duration:**
- Clone + dependencies: ~5 minutes
- Clerk removal: ~10 minutes
- Next.js 16 upgrade: ~5 minutes
- Convex Auth setup: ~30 minutes
- Theme configuration: ~15 minutes
- **Total: ~1-1.5 hours**

**Known Issues (Non-Blockers):**
- Clerk publishableKey error expected until Convex Auth configured
- Some peer dependency warnings during upgrade (normal)
- Browserslist outdated warning (run `npx update-browserslist-db@latest` if needed)

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
**And** Next.js 16 is installed with App Router structure in place
**And** async API migrations are applied (params, searchParams, cookies, headers are now async)
**And** all Convex integration points verified working with Next.js 16
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

# Upgrade to Next.js 16
npm install next@16 react@latest react-dom@latest

# Apply Next.js 16 async API migrations
npx @next/codemod@canary upgrade latest

# Initialize Convex
npx convex dev

# Verify all integrations working
npm run dev
```

**Breaking Changes in Next.js 16:**
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are now async
- All code accessing these APIs must use `await`
- Codemod handles most migrations automatically

---

### Story 1.2: Tenant Admin Registration & Free Tier Signup

**Prerequisite:** Epic 11 Story 11.1 (Landing Page) - "Create Free Account" CTA routes here
**Target:** `webapp/src/app/(auth)/signup/page.tsx`

As a **prospective tenant customer for an institution/organization**,
I want to register for a Free tier account using my email and organization details,
So that I can start using Procureline with permanent free access and usage-based limits.

**Acceptance Criteria:**

**Given** a visitor clicks "Create Free Account" on the landing page (Epic 11 Story 11.1)
**When** they are routed to the signup page
**Then** system displays signup form pre-selected for "Free Forever" tier

**Given** a visitor on the signup page
**When** they enter valid email, password, and organization name
**Then** a new tenant is created with Free tier status
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
- Entry point: Landing page "Create Free Account" button → `/signup`
- Creates `tenants` table entry with `tier: 'free'`, `status: 'active'`
- Creates `users` table entry with `role: 'tenant_admin'`, `tenantId: tenant._id`
- Email verification via Convex Auth email provider
- After verification, redirect to onboarding flow (Epic 11 Story 11.3)

---

### Story 1.3: User Login with Email & Password

As a **registered tenant customer for an institution/organization user**,
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

**Access Code Logic (Security & Tenant Isolation):**
- Codes are bound to DEPARTMENT, not individual users
- First login: Creates user record with email stored as permanent identifier
- Return login: Code + email must match stored email for that user
- Email changes require PO approval (security audit logged)
- One code supports multiple DUs (each identified by unique email)

**Session Management:**
- Each DU can have multiple concurrent sessions (cross-device support per FR2g)
- Track active sessions per code to detect abuse (alert if >10 concurrent sessions)
- DU sessions follow same 24-hour inactivity timeout as other roles (NFR-S4)

**Submission Period Grace Handling:**
- DUs can login up to 30 minutes after period ends (read-only mode)
- Show countdown warning when <1 hour remains in submission period
- Auto-logout after grace period expires with clear messaging

**Lockout Strategy (FR5d):**
- Failed attempts tracked per (email + code) combination
- Lockout affects only the failing email address, NOT the entire department code
- 5 attempts → 15-minute lockout for that email, then reset counter
- Prevents department-wide DOS while maintaining security

---

### Story 1.9: Security Infrastructure & Input Validation

As a **security-conscious development team**,
I want security infrastructure configured for XSS protection, CORS, input validation, and audit logging,
So that the platform meets NFR-S7 (input sanitization) and NFR-S10 (CORS restrictions) requirements.

**Acceptance Criteria:**

**Given** the application is deployed
**When** security infrastructure is configured
**Then** XSS sanitization is enabled for all user inputs
**And** CORS is restricted to known domains only (NFR-S10)
**And** input validation middleware is in place
**And** audit logging captures security-relevant events

**Given** a user submits a form with HTML/JavaScript in input fields
**When** the input is processed
**Then** malicious scripts are sanitized before storage
**And** output is safely rendered without XSS execution (NFR-S7)

**Given** a request originates from an unauthorized domain
**When** the request attempts to access the API
**Then** CORS policy blocks the request
**And** only configured domains (production, staging, localhost) are allowed

**Given** a user attempts SQL injection via input fields
**When** the input is processed by Convex
**Then** parameterized queries prevent SQL injection
**And** malicious input is logged as a security event (NFR-S7)

**Given** an admin performs a sensitive action (create PO, deactivate user, etc.)
**When** the action completes
**Then** the action is logged in the audit trail with: userId, action type, timestamp, tenant context

**Technical Notes:**

**XSS Protection:**
```typescript
// Frontend sanitization
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: []
  });
}
```

**CORS Configuration:**
```typescript
// convex/http.ts
import { httpRouter } from "convex/server";

const http = httpRouter();

// Configure CORS for auth endpoints
http.route({
  path: "/auth/*",
  method: "POST",
  handler: async (request, { runMutation }) => {
    // CORS headers
    const origin = request.headers.get("origin");
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "http://localhost:3001"
    ];

    if (!allowedOrigins.includes(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    // ... rest of handler
  }
});

export default http;
```

**Next.js Middleware:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline';"
  );

  return response;
}
```

**Convex Input Validation:**
```typescript
// convex/_validators.ts
import { v } from "convex/values";

export const emailValidator = v.string(); // Convex validates format
export const sanitizedString = v.string(); // Must sanitize on frontend first

// Example mutation with validation
export const createDepartment = mutation({
  args: {
    name: sanitizedString,
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Additional validation
    if (args.name.length < 2 || args.name.length > 100) {
      throw new Error("Department name must be 2-100 characters");
    }

    // ... rest of handler
  }
});
```

**Audit Logging:**
```typescript
// convex/auditLog.ts
export const logSecurityEvent = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    details: v.optional(v.string()),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      ...args,
      timestamp: Date.now(),
      tenantId: (await ctx.db.get(args.userId))?.tenantId,
    });
  }
});
```

**Security Review Checklist:**
- [ ] DOMPurify installed and configured
- [ ] All form inputs sanitized on frontend before submission
- [ ] CORS configured for development and production domains
- [ ] Security headers configured in Next.js middleware
- [ ] Convex validators defined for all mutation inputs
- [ ] Audit logging implemented for sensitive actions
- [ ] SQL injection testing performed (Convex handles via parameterization)
- [ ] XSS testing performed on all input fields

---

## Story Dependency Graph

```
Story 1.1 (Project Init)
    │
    ├── Story 1.9 (Security Infrastructure) ──── Foundation for all stories
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

**Implementation Order (Updated 2026-02-16):**

**✅ Phase 1: Backend Foundation (COMPLETE)**
- ✅ Story 1.1 (Project Init with Next.js 16 + Convex Auth + Ents)

**Phase 2: Visual Foundation (NEXT)**
1. **Epic 11 Story 11.1** - Marketing Landing Page (`webapp/src/app/page.tsx`)
   - Port from `docs/html/landing.html`
   - Provides immediate visual feedback
   - "Create Free Account" CTA ready for Story 1.2

**Phase 3: Core Infrastructure**
2. Story 1.9 (Security Infrastructure - sets up foundations)

**Phase 4: Authentication Flows**
3. Story 1.2 (Tenant Admin Registration - hooks into landing page CTA)
4. Stories 1.3-1.5 (Login, Password Reset, Session Management)

**Phase 5: Authorization & Isolation**
5. Story 1.6 (RBAC)
6. Story 1.7 (Tenant Isolation)
7. Story 1.8 (DU Access Codes)

## Definition of Done

- [ ] All 9 stories implemented and tested
- [ ] Unit tests for all Convex functions
- [ ] Integration tests for auth flows
- [ ] Security review completed
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
