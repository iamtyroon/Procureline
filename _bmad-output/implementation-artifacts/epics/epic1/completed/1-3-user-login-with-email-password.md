# Story 1.3: User Login with Email & Password

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a registered tenant customer for an institution/organization user,
I want to log in using my email and password,
so that I can access my dashboard and perform my role-specific tasks.

## Acceptance Criteria

1. [Given] a registered user with verified email [When] they enter correct email and password [Then] they are authenticated and redirected to their role-appropriate dashboard [And] a session is created (FR2)
2. [Given] a user enters invalid email format [When] they attempt to login [Then] system displays "Invalid email format" error (FR2a)
3. [Given] a user enters incorrect password [When] they attempt to login [Then] system displays "Incorrect password" error (FR2b)
4. [Given] a PO whose account is deactivated by Tenant Admin [When] they attempt to login [Then] system displays "Account deactivated. Contact your administrator." (FR2c)
5. [Given] a user whose tenant subscription is expired/suspended [When] they attempt to login [Then] system displays "Subscription inactive. Contact your administrator." (FR2d)
6. [Given] a user with an expired session [When] they attempt to access a protected page [Then] system redirects to login with "Session expired. Please log in again." (FR2e)
7. [Given] system is in maintenance mode [When] any user attempts to login [Then] system displays maintenance mode message with expected return time (FR2h)

## Tasks / Subtasks

- [x] Task 1: Create Login UI Form (AC: 1, 2, 3)
  - [x] Implement email and password fields using shadcn/ui components (Input, Label, Button).
  - [x] Add client-side validation for email format using zod.
  - [x] Implement pending state for the login button during submission.
- [x] Task 2: Implement Authentication Action (AC: 1, 3)
  - [x] Invoke Convex Auth `signIn` action with email and password provider.
  - [x] Handle 'Invalid credentials' error appropriately and display to the user.
- [x] Task 3: Implement Role-Based Redirects (AC: 1)
  - [x] Create or update post-login redirection logic based on user role (`platform_admin`, `tenant_admin`, `po`, `du`).
- [x] Task 4: Implement Account and Tenant Status Checks (AC: 4, 5)
  - [x] Check if the user account is active before allowing login completion.
  - [x] Check if the tenant subscription is active before allowing login completion.
  - [x] Return appropriate error messages for deactivated accounts and suspended subscriptions.
- [x] Task 5: Handle Session Expiration and Maintenance Mode (AC: 6, 7)
  - [x] Create Next.js middleware or route protection wrapper to check session validity and redirect to login on expiry.
  - [x] Verify maintenance mode status (if applicable) and prevent login if active.

## Dev Notes

- Relevant architecture patterns and constraints:
  - Use Convex Auth (@convex-dev/auth) for backend authentication. Replace Clerk completely.
  - Next.js 16 App Router foundation.
  - RBAC: Role-based redirects based on the `role` field in the user document. Basic redirection needed here before the full RBAC story.
  - Theme: Use Procureline Green theme (`#18b969`) with shadcn/ui and Tailwind CSS.
  - Validation: Sanitize input and validate format at the API/action edge.
- Source tree components to touch:
  - `webapp/src/app/(auth)/login/page.tsx`
  - Auth actions/functions in frontend or `convex/` logic if custom verifications are needed for tenant status.
  - Navigation/redirection middleware or hooks.

### Project Structure Notes

- Alignment with unified project structure: Ensure the login form sits correctly in the `(auth)` group.
- Using `nts-saas-starter` patterns where appropriate but substituting in Convex Auth specific implementations.

### References

- User roles and login requirements [Source: c:\Users\Tyroon\Downloads\project\Procureline\_bmad-output\planning-artifacts\prd.md#Functional Requirements]
- Architecture specific constraints [Source: c:\Users\Tyroon\Downloads\project\Procureline\_bmad-output\planning-artifacts\architecture.md#Authentication Requirements]
- Specific AC taken directly from Epic. [Source: c:\Users\Tyroon\Downloads\project\Procureline\_bmad-output\implementation-artifacts\epics\epic1\epic-01-foundation-authentication.md#Story 1.3: User Login with Email & Password]

## Dev Agent Record

### Agent Model Used

gemini-2.5-pro

### Debug Log References

N/A

### Completion Notes List

- Story fully expanded with AC directly mapping back to Epic FRs. Tasks broken down by technical architecture.
- Added a database-driven Tenant/Organization dropdown to the `LoginForm` allowing users to select their active organization during sign-in. Added a `listActive` query in `convex/functions/tenants.ts`.
- Fixed a hydration mismatch error in `ModeToggle` component (`next-themes`) by deferring render until mount.
- Fixed a React rendering error in `LoginForm` by wrapping the `authContext` check and router redirects in a `useEffect`.
- Updated marketing and auth component links to point to `/login` instead of `/signin` to prevent 404s.

### File List

- `c:\Users\Tyroon\Downloads\project\Procureline\_bmad-output\implementation-artifacts\epics\epic1\stories\1-3-user-login-with-email-password.md`
- `webapp/src/components/auth/LoginForm.tsx` (New/Modified)
- `webapp/src/components/auth/SignupForm.tsx` (Modified)
- `webapp/app/(auth)/login/page.tsx` (New)
- `webapp/lib/validators/auth.ts` (Modified)
- `webapp/convex/functions/users.ts` (Modified)
- `webapp/convex/functions/tenants.ts` (Modified)
- `webapp/middleware.ts` (Modified)
- `webapp/app/(app)/dashboard/page.tsx` (Modified)
- `webapp/src/components/marketing/Navbar.tsx` (Modified)
- `webapp/src/components/mode-toggle.tsx` (Modified)
- `webapp/app/DashboardButtons.tsx` (Modified)
