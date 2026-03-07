# Story 1.2: Tenant Admin Registration & Free Tier Signup

Status: in-progress

## Story

As a **prospective customer**,
I want to register for a Free tier account using my email and organization details,
So that I can start using Procureline with permanent free access and usage-based limits.

## Acceptance Criteria

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

## Tasks / Subtasks

- [x] Set up email verification provider for Convex Auth (AC: 1)
  - [x] Create ResendOTP.ts custom email provider
  - [x] Configure Resend API with AUTH_RESEND_KEY
  - [x] Implement 8-digit OTP token generation using @oslojs/crypto
  - [x] Create email template for verification code
  - [x] Configure Password provider with `verify: ResendOTP` in convex/auth.ts

- [x] Create signup page with email verification flow (AC: 1, 2, 3, 4)
  - [x] Create webapp/app/(auth)/signup/page.tsx
  - [x] Implement multi-step form (Step 1: Email/Password/Org, Step 2: OTP verification)
  - [x] Use React Hook Form for form state management
  - [x] Create Zod validation schema for signup form
  - [x] Handle step transitions based on email verification requirement

- [x] Implement tenant creation mutation (AC: 1)
  - [x] Create webapp/convex/functions/tenants.ts
  - [x] Implement `create` mutation with tenant name validation
  - [x] Set tier to 'free' and status to 'active'
  - [x] Generate unique subdomain from organization name
  - [x] Validate subdomain uniqueness
  - [x] Add createdAt timestamp

- [x] Implement user creation with tenant linkage (AC: 1)
  - [x] Create webapp/convex/functions/users.ts
  - [x] Implement user creation via registerWithTenant mutation
  - [x] Link user to tenant via tenantUsers junction table
  - [x] Set role to 'tenant_admin'
  - [x] Set isActive to true
  - [x] Store email and organization name

- [x] Implement password policy validation (AC: 1, 4)
  - [x] Create lib/validators/auth.ts with signupSchema
  - [x] Frontend validation: min 12 chars, uppercase, lowercase, number, special
  - [x] Backend validation: same rules via validatePasswordRequirements in auth.ts
  - [x] Display specific error messages for each requirement
  - [x] Use Zod password validation with regex patterns

- [x] Implement email uniqueness check (AC: 2)
  - [x] Convex Auth handles duplicate check during signUp flow
  - [x] Display "Email already registered" error on frontend
  - [x] Prevent duplicate account creation

- [x] Implement email format validation (AC: 3)
  - [x] Use Zod email() validator on frontend
  - [x] Display "Invalid email format" error

- [x] Configure dashboard access control (AC: 1)
  - [x] Block dashboard access until authenticated
  - [x] Redirect to signup page if not authenticated
  - [x] Check authentication in convexAuthNextjsMiddleware

- [x] Create email verification UI (AC: 1)
  - [x] Build OTP input form with 8-digit code field
  - [x] Implement code submission to Convex Auth
  - [x] Handle verification success (redirect to dashboard)
  - [x] Handle verification failure (show error, allow retry)
  - [x] Add "Resend code" functionality with 60s cooldown

- [ ] Testing and validation
  - [ ] [AI-Review][High] Test successful signup with valid data
  - [ ] [AI-Review][High] Test duplicate email rejection
  - [ ] [AI-Review][High] Test invalid email format
  - [ ] [AI-Review][High] Test weak password rejection
  - [ ] [AI-Review][High] Test email verification flow end-to-end
  - [ ] [AI-Review][High] Test dashboard access control

## Dev Notes

### Architecture Requirements

**Authentication Flow (from [architecture.md#authentication-security](../../_bmad-output/planning-artifacts/architecture.md)):**
- Convex Auth with email/password authentication
- Email verification via Resend OTP (8-digit code)
- Session management via Convex Auth (HTTP-only cookies, 24-hour expiry)
- Custom claims: `tenantId`, `role` added during user creation

**Multi-Tenancy Pattern (from [architecture.md#data-architecture](../../_bmad-output/planning-artifacts/architecture.md)):**
- All tenant-scoped tables have `tenantId` field with index
- Use Convex Ents `.edge("tenant")` for type-safe relationships
- Tenant isolation enforced at query level (applied in Story 1.7)

**Free Tier Model (from [prd.md#subscription-tiers](../../_bmad-output/planning-artifacts/prd.md)):**
- Permanent free access (no time limit)
- Usage limits: 10 departments, 20 categories, 50 items/category
- No credit card required for signup
- Upgrade triggered when limits approached

### Previous Story Intelligence (Story 1.1)

**✅ Foundation Established:**
- Convex Ents SaaS Starter cloned to `webapp/` directory
- Clerk removed, Convex Auth installed (@convex-dev/auth)
- Next.js 16.1.6 + React 19.2.4 configured
- Basic schema created: `tenants` and `users` tables with Ents
- Procureline Green theme (#18b969) applied
- Convex dev deployment: dev:vibrant-bulldog-86

**Key Files Modified in Story 1.1:**
- `webapp/convex/auth.ts` - Convex Auth setup with Password provider
- `webapp/convex/auth.config.js` - Password provider config
- `webapp/convex/schema.ts` - Tenants + users schema with Ents
- `webapp/app/ConvexClientProvider.tsx` - ConvexAuthNextjsProvider configured
- `webapp/middleware.ts` - Convex Auth middleware ready

**Patterns Established:**
- File location: `webapp/src/app/` for Next.js pages
- Path aliases: `@/*` maps to `webapp/src/*`
- TypeScript strict mode enabled with `noUncheckedIndexedAccess`
- Convex functions in `webapp/convex/functions/`

**Dev Notes from Story 1.1:**
- Theme color #18b969 visible in Sign up button
- Dev server runs on http://localhost:3000
- Convex dashboard: https://dashboard.convex.dev/d/vibrant-bulldog-86
- TypeScript errors in old starter code expected (will be replaced)

### Latest Technical Specifics (2024)

**Convex Auth Email Verification Implementation:**

Based on latest Convex Auth documentation (https://github.com/get-convex/convex-auth), the email verification flow requires:

1. **Custom Email Provider Setup:**

```typescript
// webapp/convex/ResendOTP.ts
import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const ResendOTP = Resend({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    const length = 8;
    return generateRandomString(random, alphabet, length);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    const { error } = await resend.emails.send({
      from: "Procureline <onboarding@procureline.co.ke>",
      to: [email],
      subject: `Welcome to Procureline - Verify Your Email`,
      text: `Your verification code is: ${token}`,
      html: `<h2>Welcome to Procureline!</h2><p>Your verification code is: <strong>${token}</strong></p>`,
    });
    if (error) {
      throw new Error("Could not send verification email");
    }
  },
});
```

2. **Configure Password Provider:**

```typescript
// webapp/convex/auth.ts (UPDATE)
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password({ verify: ResendOTP })],
});
```

3. **Multi-Step Signup Form Pattern:**

The form has two steps:
- **Step 1:** Email, password, organization name → triggers email verification
- **Step 2:** Enter 8-digit OTP code → completes signup

The `signIn("password", formData)` function returns boolean indicating immediate success. If email needs verification, it returns false and user proceeds to Step 2.

**Dependencies to Install:**
```bash
npm install resend @oslojs/crypto
```

**Environment Variables Required:**
```bash
AUTH_RESEND_KEY=re_xxxxxxxxxxxx  # Get from Resend dashboard
```

### Technical Requirements

**Password Policy Enforcement:**

Use Zod schema with regex for comprehensive validation:

```typescript
// webapp/src/lib/validators/auth.ts
import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  organizationName: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be less than 100 characters"),
});

export type SignupFormData = z.infer<typeof signupSchema>;
```

**Tenant Creation Logic:**

```typescript
// webapp/convex/functions/tenants.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate subdomain from org name (lowercase, alphanumeric, hyphens)
    const subdomain = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check subdomain uniqueness
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
      .first();

    if (existing) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "An organization with this name already exists",
      });
    }

    // Create tenant
    const tenantId = await ctx.db.insert("tenants", {
      name: args.name,
      subdomain,
      tier: "free",
      status: "active",
      createdAt: Date.now(),
    });

    return tenantId;
  },
});
```

**User Creation with Tenant Linkage:**

Update Convex Auth callback to create user and link to tenant:

```typescript
// webapp/convex/auth.ts (UPDATE callbacks)
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password({ verify: ResendOTP })],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      // This callback is called after email verification succeeds
      // Create tenant and link user
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();

      if (existingUser) {
        // User already exists (email verified)
        return;
      }

      // Extract organization name from session or args (passed during signIn)
      const organizationName = args.profile?.organizationName;

      if (!organizationName) {
        throw new ConvexError({
          code: "VALIDATION_FAILED",
          message: "Organization name is required",
        });
      }

      // Create tenant
      const tenantId = await ctx.runMutation(api.functions.tenants.create, {
        name: organizationName,
      });

      // Create user and link to tenant
      await ctx.db.insert("users", {
        email: args.email,
        name: args.profile?.name,
        role: "tenant_admin",
        tenantId,
        isActive: true,
        createdAt: Date.now(),
      });
    },
  },
});
```

### Architecture Compliance

**File Structure Requirements (from [architecture.md#project-structure](../../_bmad-output/planning-artifacts/architecture.md)):**

```
webapp/
├── src/
│   ├── app/
│   │   └── (auth)/
│   │       ├── layout.tsx              # Auth layout (centered card)
│   │       └── signup/
│   │           └── page.tsx            # Multi-step signup form
│   ├── components/
│   │   └── auth/
│   │       ├── SignupForm.tsx          # Step 1: Email/Password/Org
│   │       └── VerifyEmailForm.tsx     # Step 2: OTP verification
│   └── lib/
│       └── validators/
│           └── auth.ts                 # Zod schemas
├── convex/
│   ├── ResendOTP.ts                    # Custom email provider
│   ├── auth.ts                         # Convex Auth config (UPDATE)
│   └── functions/
│       ├── tenants.ts                  # Tenant CRUD
│       └── users.ts                    # User CRUD (future)
```

**Error Handling Pattern (from [architecture.md#api-communication-patterns](../../_bmad-output/planning-artifacts/architecture.md)):**

Use ConvexError with specific error codes:

```typescript
// Email already exists
throw new ConvexError({
  code: "ALREADY_EXISTS",
  field: "email",
  message: "Email already registered",
});

// Validation failed
throw new ConvexError({
  code: "VALIDATION_FAILED",
  field: "password",
  message: "Password does not meet policy requirements",
});
```

Frontend error handling:

```typescript
try {
  await signIn("password", formData);
} catch (error) {
  if (error instanceof ConvexError) {
    const { code, message, field } = error.data;
    if (field) {
      form.setError(field, { message });
    } else {
      toast.error(message);
    }
  } else {
    toast.error("An unexpected error occurred");
  }
}
```

### Library & Framework Requirements

**Dependencies (from [architecture.md#frontend-architecture](../../_bmad-output/planning-artifacts/architecture.md)):**
- React Hook Form (form state management)
- Zod (validation schemas)
- Resend (email delivery)
- @oslojs/crypto (OTP generation)
- @convex-dev/auth (authentication)

**UI Components (from [architecture.md#styling-solution](../../_bmad-output/planning-artifacts/architecture.md)):**
- shadcn/ui components: Button, Input, Form, Card, Label
- Use existing components from `webapp/src/components/ui/`
- Procureline Green theme (#18b969) already applied

### Testing Requirements

**Testing Standards (from [architecture.md#test-organization](../../_bmad-output/planning-artifacts/architecture.md)):**

**Unit Tests:**
- Validation schemas (Zod): test all password policy rules
- Subdomain generation: test special characters, duplicates
- Email format validation

**Integration Tests:**
- Full signup flow: email → password → org → verification → dashboard
- Error scenarios: duplicate email, weak password, invalid email
- Email verification: code submission, retry, expiration

**E2E Tests (Playwright):**
- Happy path: complete signup and login
- Error path: invalid credentials, email verification failure

**Test Co-location:**
- Component tests: same folder as component (SignupForm.test.tsx)
- Convex function tests: convex/__tests__/tenants.test.ts

### Security Infrastructure

**Input Sanitization (from [architecture.md#security](../../_bmad-output/planning-artifacts/architecture.md)):**
- All user inputs sanitized on frontend using DOMPurify (Story 1.9)
- Email and org name validated with Zod
- Password never stored in plaintext (Convex Auth handles hashing)

**Session Management:**
- HTTP-only secure cookies (Convex Auth default)
- 24-hour inactivity timeout (NFR-S4)
- CSRF protection via Convex Auth

**Email Security:**
- Verification code expires after 15 minutes (Convex Auth default)
- Max 3 resend attempts per hour
- Rate limiting on signup endpoint (Story 1.9)

### Git Intelligence Summary

**Recent Commits Context:**
- No code commits for Story 1.1 yet (still in review status)
- Most recent commit: Documentation updates and epic creation
- Project uses BMad workflow with structured stories in `_bmad-output/implementation-artifacts/`

**File Patterns Established:**
- Story files: `{epic}-{story}-{title}.md` format
- Code location: `webapp/` directory for all application code
- Convex functions: `webapp/convex/functions/` organized by domain

### Project Context Reference

**Critical Implementation Rules (68 rules from project-context.md):**

This story must follow ALL 68 rules documented in [project-context.md](../../project-context.md), including:

**TypeScript & Code Quality:**
- Strict mode enabled, no `any` types
- Explicit return types for all functions
- Path aliases: `@/*` for `src/*`

**Convex Patterns:**
- Use Convex Ents for all relationships
- All queries/mutations must have `args` validation using `v` validators
- Error handling via ConvexError with specific codes

**Security:**
- NEVER log passwords or sensitive data
- All inputs validated on frontend AND backend
- Email addresses stored lowercase

**Naming Conventions:**
- camelCase for variables, functions, file names
- PascalCase for React components
- kebab-case for URLs and routes

**Form Handling:**
- React Hook Form + Zod for all forms
- Frontend validation before submission
- Backend validation in Convex mutations
- Display specific field errors

**Testing:**
- Co-locate tests with source files
- Test all validation rules
- Test error scenarios
- E2E test critical paths

### Story Completion Status

**Acceptance Criteria Checklist:**
- [ ] AC1: Valid signup creates tenant (Free tier, active status) + Tenant Admin user
- [ ] AC2: Email verification sent and required before dashboard access
- [ ] AC3: Password meets policy (12+ chars, uppercase, lowercase, number, special)
- [ ] AC4: Duplicate email rejected with clear error message
- [ ] AC5: Invalid email format rejected with validation error
- [ ] AC6: Weak password rejected with specific requirements shown

**Definition of Ready:**
- ✅ All dependencies identified (Resend, @oslojs/crypto)
- ✅ Architecture patterns documented
- ✅ File structure defined
- ✅ Latest Convex Auth patterns researched
- ✅ Error handling patterns specified
- ✅ Testing requirements outlined

**Definition of Done:**
- [ ] All tasks completed and tested
- [ ] Email verification flow works end-to-end
- [ ] Password policy enforced on frontend and backend
- [ ] Duplicate email prevention working
- [ ] Free tier tenant created successfully
- [ ] User linked to tenant via Ents relationship
- [ ] Dashboard access blocked until email verified
- [ ] Unit tests passing
- [ ] E2E tests passing
- [ ] Code reviewed (Story 1.2 → code-review workflow)
- [ ] Sprint status updated to 'done'

### References

- [Source: epic-01-foundation-authentication.md#story-12] Story requirements and acceptance criteria
- [Source: architecture.md#authentication-security] Convex Auth decision and email verification pattern
- [Source: architecture.md#data-architecture] Tenants and users schema with Ents
- [Source: architecture.md#freemium-tier-enforcement] Free tier model and usage limits
- [Source: architecture.md#api-communication-patterns] Error handling with ConvexError
- [Source: architecture.md#frontend-architecture] React Hook Form + Zod pattern
- [Source: prd.md#subscription-tiers] Free tier details (permanent, usage-based)
- [Source: project-context.md] 68 critical implementation rules
- [Story 1.1 Completion Notes](../../_bmad-output/implementation-artifacts/epics/epic1/stories/1-1-project-initialization-with-convex-ents-starter.md) - Foundation established
- [Convex Auth Documentation](https://github.com/get-convex/convex-auth/blob/main/docs/pages/config/passwords.mdx) - Email verification setup
- [Convex Auth Example Repo](https://github.com/get-convex/convex-auth-example) - Reference implementation

## Dev Agent Record

### Agent Model Used

Gemini Experimental

### Debug Log References

- Fixed Convex Auth missing `JWT_PRIVATE_KEY` during OTP verification
- Fixed `Missing flow param` error by passing `flow: "email-verification"` to Password sign-in
- Fixed user lookup in `registerWithTenant` to use `getAuthUserId(ctx)` instead of email index

### Completion Notes List

- ✅ **Authentication:** Configured Convex Auth with Password and custom ResendOTP verify provider
- ✅ **Frontend:** Multi-step signup UI built using `react-hook-form` and `zod`
- ✅ **Backend:** Created `tenants.ts` and `users.ts` mutations to bootstrap Free tier organizations and Tenant Admin roles
- ✅ **Security:** All password, email uniqueness, and access control policies (middleware) strictly enforced
- 🟡 **Testing:** Test coverage is pending (marked as AI Follow-ups for next run)
- 🟡 **Schema refinement:** Redundant `organizationName` dropped from `tenantUsers`

### File List

- `webapp/app/(auth)/signup/page.tsx`
- `webapp/src/components/auth/SignupForm.tsx`
- `webapp/src/components/auth/VerifyEmailForm.tsx`
- `webapp/lib/validators/auth.ts`
- `webapp/convex/auth.ts`
- `webapp/convex/ResendOTP.ts`
- `webapp/convex/functions/tenants.ts`
- `webapp/convex/functions/users.ts`
- `webapp/convex/schema.ts`
- `webapp/middleware.ts`
- `webapp/app/layout.tsx`
- `webapp/app/ConvexClientProvider.tsx`
