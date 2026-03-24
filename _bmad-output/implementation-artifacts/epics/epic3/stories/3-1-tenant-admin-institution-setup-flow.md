# Story 3.1: Tenant Admin Institution Setup Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new Tenant Admin,
I want to complete my account and institution setup through a guided onboarding flow,
so that I can reach the tenant-admin workspace only after my institution is properly configured.

## Acceptance Criteria

1. [Given] a visitor chooses the institution self-serve path [When] they continue into `/signup` with a valid self-serve tier (`free`, `starter`, `professional`) [Then] the current public signup flow remains the canonical self-serve entry point and still uses the existing Convex Auth password flow (FR-TA1a).
2. [Given] a self-serve Tenant Admin account is created [When] email verification is required [Then] the system sends verification through the existing auth-provider path [And] the overall verification window is treated as 24 hours [And] the user can manually resend if the verification credential expires [And] the system can auto-resend at most 3 times without looping forever (FR-TA1a, FR-TA1d, FR-TA1e).
3. [Given] a Platform Admin provisions a Tenant Admin manually [When] the invitation is issued [Then] the system creates a tenant-admin invitation record tied to the target tenant and email [And] sends a tenant-scoped invitation link that expires after 72 hours [And] resend invalidates the previous pending invitation so only the newest invitation remains valid (FR-TA1b, FR-TA1c).
4. [Given] a manually provisioned Tenant Admin opens a valid invitation link [When] onboarding starts [Then] the public flow preserves the opaque `invite` context [And] the invited email is read-only [And] the password step enforces the current 12+ character password policy with uppercase, lowercase, number, and special character rules (FR-TA1c, FR-TA1d).
5. [Given] a self-serve or invited Tenant Admin verifies their email [When] auth context resolves their role and tenant [Then] the app blocks dashboard access until institution profile completion and redirects them to a dedicated protected route such as `/tenant-admin/onboarding` instead of `/tenant-admin` (FR-TA1f, FR-TA1g).
6. [Given] a Tenant Admin is still onboarding [When] they attempt to open `/tenant-admin` or any other tenant-admin route besides onboarding [Then] the role guard redirects them back to the onboarding route [And] once onboarding is complete the onboarding route redirects forward to `/tenant-admin`.
7. [Given] the Tenant Admin reaches the institution-profile step [When] they complete setup [Then] the system requires institution name, primary contact details, and fiscal-year configuration [And] accepts an optional logo field without making it a blocker [And] saving the form marks the tenant profile complete and unlocks the tenant-admin dashboard (FR-TA1g, FR-TA1h).
8. [Given] onboarding attempts to create or attach a Tenant Admin identity [When] the email already belongs to an existing app account with an application-role assignment [Then] onboarding is blocked with a clear `Email already in use` style error and no duplicate tenant-admin membership is created across tenants (FR-TA1i).
9. [Given] a tenant becomes inactive during onboarding [When] the user tries to continue from invite, verification, or the protected onboarding route [Then] the flow fails closed and shows `Tenant deactivated. Contact Support.` rather than silently bouncing them into the dashboard (FR-TA1j).
10. [Given] a Tenant Admin forgets their password before finishing onboarding [When] they use the existing forgot-password and reset-password flow [Then] the reset path works for both self-serve and invited Tenant Admins and returns them to the correct continuation point without creating a second account (FR-TA1k).
11. [Given] Story 3.2 already delivered the real tenant-admin dashboard [When] Story 3.1 is implemented [Then] it must unlock that existing route namespace and must not replace the dashboard shell, fake dashboard data, or bypass the current protected-app model.
12. [Given] Story 2.4 platform-side provisioning UI is not yet implemented [When] Story 3.1 delivers manual invite redemption [Then] it provides the shared invitation persistence and redemption contract that Story 2.4 can call later without requiring platform-admin provisioning screens in this story.

## Tasks / Subtasks

- [x] Task 1: Extend the tenant onboarding data model without destabilizing current auth flows (AC: 2, 3, 5, 7, 8, 9)
  - [x] Update `webapp/convex/schema.ts` so `tenants` can represent onboarding state directly, including a `profileComplete` flag and the minimal institution-profile fields Story 3.1 needs now.
  - [x] Add a narrow `tenantAdminInvitations` table for the manual path with tenant scope, normalized email, token hash, expiry, resend metadata, and lifecycle status.
  - [x] Add only the minimum extra support state needed for verification-window or auto-resend tracking if the current auth-provider state is insufficient; do not mutate Convex Auth internals or create a parallel account system.

- [x] Task 2: Create backend onboarding and invitation functions as a dedicated tenant-admin module (AC: 2, 3, 4, 5, 7, 8, 9, 10, 12)
  - [x] Add a focused module such as `webapp/convex/functions/tenantAdminOnboarding.ts` instead of overloading `users.ts` with every onboarding concern.
  - [x] Implement invitation issue, lookup, redemption, resend, and completion mutations or queries with tenant-scoped validation and clear `ConvexError` codes.
  - [x] Refactor shared tenant-admin account-attachment logic so self-serve and invite flows can reuse one secure backend path for role-assignment checks and audit logging.
  - [x] Write append-only audit events for invitation issued, invitation resent, invitation accepted, onboarding completed, and onboarding blocked for inactive tenant.

- [x] Task 3: Adapt the public signup flow to support both self-serve and invited Tenant Admin onboarding without creating a second auth stack (AC: 1, 2, 3, 4, 8, 10)
  - [x] Extend `webapp/app/(auth)/signup/page.tsx`, `webapp/src/components/auth/SignupFlow.tsx`, and `SignupForm.tsx` so `/signup` can resolve invited Tenant Admin mode from the existing `invite` query param while preserving the current self-serve tier behavior.
  - [x] Reuse the current Convex Auth password provider and OTP verification flow for both self-serve and invited onboarding; do not fork to a separate auth provider or vendor.
  - [x] Keep self-serve institution signup restricted to Free, Starter, and Professional tiers, and keep Enterprise/manual onboarding out of the self-serve branch.
  - [x] Preserve the public-entry passthrough behavior from Story 11.3 so deep links carrying `invite` are not dropped before they reach `/signup`.

- [x] Task 4: Add a protected tenant-admin onboarding route and route-guard contract (AC: 5, 6, 7, 9, 11)
  - [x] Add a thin protected page such as `webapp/app/(app)/tenant-admin/onboarding/page.tsx` and move the interactive UI into a dedicated component such as `webapp/src/components/tenant-admin/TenantAdminOnboardingFlow.tsx`.
  - [x] Add a small helper module such as `webapp/lib/tenant-admin/onboarding.ts` to define the canonical onboarding route, stage names, and redirect rules so they are testable outside React.
  - [x] Extend `webapp/convex/functions/_roleGuard.ts` and `webapp/lib/auth/roles.ts` with a tenant-admin onboarding stage similar to the existing Platform Admin verification-stage contract: incomplete tenant admins may access onboarding only; complete tenant admins route to `/tenant-admin`.
  - [x] Keep `/dashboard` as the neutral post-auth landing route while `getAuthContext` resolves incomplete tenant admins toward onboarding automatically, so the current `VerifyEmailForm` redirect to `/dashboard` can remain simple.

- [x] Task 5: Deliver the institution-profile completion experience with minimal but truthful persistence (AC: 5, 6, 7, 11)
  - [x] Build a guided onboarding form that separates already-completed account steps from remaining institution-profile requirements.
  - [x] Prefill safe values where available, especially organization name from self-serve signup and tenant name for invited admins, while allowing correction before completion.
  - [x] Keep the required form scope tight for Story 3.1: institution name, primary contact details, and fiscal-year configuration are required; logo is optional and must not force a full branding pipeline if skipped.
  - [x] Mark the tenant profile complete only after required fields store successfully, then redirect to `/tenant-admin` and allow the existing dashboard to load normally.

- [x] Task 6: Wire resend, expiry, and password-reset behavior around the existing email-verification and auth stack (AC: 2, 3, 4, 9, 10)
  - [x] Keep the current `ResendOTP`-driven verification model unless there is a proven blocker; do not rewrite Story 1.2’s auth foundation just to satisfy onboarding copy.
  - [x] If the 24-hour verification-window requirement needs extra orchestration, implement it as onboarding-layer tracking plus scheduled resend calls against the existing auth APIs rather than replacing the provider.
  - [x] Use the already-available password reset action and reset form so invited or self-serve Tenant Admins recover through the same secure path.
  - [x] Keep invitation expiry and resend semantics server-authoritative, including invalidation of superseded invite links.

- [x] Task 7: Add deterministic regression coverage for onboarding state, route protection, and failure cases (AC: 1-12)
  - [x] Add signup-flow tests for invite-mode resolution from the `invite` query param and safe restoration of pending onboarding state.
  - [x] Add route and RBAC tests proving incomplete tenant admins are redirected to `/tenant-admin/onboarding`, complete tenant admins can access `/tenant-admin`, and non-tenant-admin roles remain blocked from the tenant-admin namespace.
  - [x] Add backend tests for invitation expiry, resend invalidation, duplicate-email rejection, profile-completion persistence, inactive-tenant blocking, and password-reset continuation for onboarding users.
  - [x] Update `webapp/tests/run-tests.ts` so onboarding coverage becomes part of the standard deterministic test run.

## Dev Notes

### Story Foundation

- Story 1.2 already shipped a working self-serve Tenant Admin signup flow.
- Story 3.2 already shipped the tenant-admin dashboard shell and protected route namespace.
- Story 3.1 therefore inserts a truthful institution-setup gate between those delivered pieces while also adding the manual invitation redemption path that future Platform Admin provisioning will depend on.

### Current Implementation State Discovered In Code

- `webapp/app/(auth)/signup/page.tsx`, `SignupFlow.tsx`, `SignupForm.tsx`, and `VerifyEmailForm.tsx` already implement the public signup plus OTP verification flow.
- `webapp/convex/functions/users.ts` currently exposes `registerWithTenant`, which creates a new tenant plus an active `tenant_admin` membership after verification.
- `webapp/convex/schema.ts` currently stores tenant records with no onboarding or profile-completion state.
- `webapp/app/(app)/dashboard/page.tsx` already redirects authenticated users to the home path returned by `getAuthContext`.
- `webapp/convex/functions/_roleGuard.ts` and `webapp/lib/auth/roles.ts` already own canonical role and route-access decisions, including the stage-based Platform Admin verification contract from Story 2.1.
- `webapp/lib/auth/public-entry.ts` and `webapp/app/constants.ts` already preserve an opaque `invite` query param through public-entry handoff routes.
- `webapp/app/(app)/tenant-admin/page.tsx` and `TenantAdminDashboard.tsx` already provide the real tenant-admin dashboard that Story 3.1 should unlock after onboarding completes.

### Critical Design Tension To Resolve Cleanly

- The live auth stack uses short-lived OTP verification codes via `webapp/convex/ResendOTP.ts`.
- Epic 3 and the PRD describe longer-lived onboarding windows and invitation links for Tenant Admin setup.
- Do not solve that tension by replacing the working Convex Auth password-plus-OTP foundation from Story 1.2.
- Preferred interpretation:
  - invitation link validity belongs to the onboarding layer,
  - account verification delivery still reuses the current provider path,
  - the 24-hour verification window is modeled around successive provider OTP sends,
  - and any auto-resend tracking lives in app-owned onboarding state rather than inside Convex Auth internals.

### Recommended Implementation Shape

- Self-serve path:
  - keep `/signup` as the public entry,
  - keep current tier handling from `webapp/lib/marketing/pricing.ts`,
  - keep `signIn("password", formData)` plus OTP verification,
  - update tenant creation so the new tenant starts with `profileComplete: false`,
  - redirect authenticated incomplete tenant admins to `/tenant-admin/onboarding`.
- Manual invite path:
  - deep-link back into `/signup?invite=...`,
  - resolve invite context before rendering the password step,
  - create or attach the auth user only for the invited email,
  - require email verification through the same auth foundation,
  - then redirect to the protected onboarding route for profile completion.
- Protected onboarding gate:
  - extend auth context with a tenant-admin onboarding stage or equivalent boolean,
  - reuse the route-decision pattern already used for Platform Admin verification,
  - allow `/tenant-admin/onboarding` while incomplete,
  - redirect every other tenant-admin route back to onboarding until complete,
  - redirect complete users away from onboarding to `/tenant-admin`.

### Data Model Guidance

- `tenants` should gain only the minimum onboarding fields needed now, for example:
  - `profileComplete: boolean`
  - `primaryContactName?: string`
  - `primaryContactEmail?: string`
  - `primaryContactPhone?: string`
  - `fiscalYearStartMonth?: number`
  - `logoStorageId?: Id<"_storage">` or another narrow optional logo reference
  - `onboardingCompletedAt?: number`
- Recommended `tenantAdminInvitations` shape:
  - `tenantId`
  - `email`
  - `normalizedEmail`
  - `tokenHash`
  - `status` (`pending`, `accepted`, `expired`, `revoked`)
  - `expiresAt`
  - `createdAt`
  - `updatedAt`
  - `resentCount`
  - optional `acceptedAt`
  - optional `createdByPlatformUserId`
- Store hashed invitation tokens rather than raw tokens if possible.

### Auth And Routing Contract

- `getAuthorizationContext(...)` remains the source of truth.
- `RoleGuard` continues to consume `evaluateRoleRouteAccess(...)`.
- Recommended tenant-admin onboarding helper contract:
  - `TENANT_ADMIN_ONBOARDING_ROUTE = "/tenant-admin/onboarding"`
  - `TenantAdminOnboardingStage = "required" | "complete"`
  - helper such as `isTenantAdminOnboardingRoute(pathname)`
- Recommended auth-context behavior for incomplete Tenant Admins:
  - `homePath` and `redirectPath` resolve to `/tenant-admin/onboarding`
  - protected tenant-admin routes other than onboarding redirect there
  - `/dashboard` remains allowed as neutral entry but quickly redirects to the onboarding home path

### Scope Boundaries And Anti-Reinvention Guidance

- Reuse the existing self-serve signup flow, password policy, Convex Auth provider, forgot-password route, and dashboard shell.
- Reuse the `invite` query-param preservation pattern from Story 11.3.
- Reuse the protected app shell in `webapp/app/(app)/layout.tsx`; do not create a one-off onboarding shell outside the authenticated app unless there is a hard blocker.
- Do not build Platform Admin tenant-creation screens in Story 3.1; provide the redemption contract that Story 2.4 can call later.
- Do not overbuild Story 3.5 institutional settings or later billing/account stories into this onboarding story.

### UX And Interaction Requirements

- Keep the public invite/self-serve branch aligned with the existing auth-card experience for `/signup`.
- Keep the protected onboarding route aligned with the tenant-admin visual language already present in the repo.
- The onboarding form should show progress clearly:
  - account created or invited,
  - email verified,
  - institution profile remaining,
  - dashboard unlocked.
- Respect the product's desktop-first protected-app strategy on the tenant-admin onboarding route.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `resend` `^2.1.0`
  - `react-hook-form` `^7.47.0`
  - `zod` `^3.22.4`
- Keep real authorization checks in Convex near the data source.
- Keep route files thin and move interactive behavior into feature components.
- Keep `proxy.ts`; do not introduce `middleware.ts`.

### Latest Tech Information

- Verified on March 22, 2026 against official docs and the live repo:
  - the repo currently uses Next.js `^16.1.6`, while `npm view next version` returns `16.2.1`;
  - the repo currently uses Convex `^1.13.2`, while `npm view convex version` returns `1.34.0`;
  - the repo currently uses `@convex-dev/auth` `^0.0.90`, while `npm view @convex-dev/auth version` returns `0.0.91`;
  - the repo currently uses `resend` `^2.1.0`, while `npm view resend version` returns `6.9.4`.
- Next.js authentication guidance still recommends keeping real authorization checks close to the data layer, which matches the current Convex-owned auth-context pattern.
- Convex React docs still position `useQuery` as the reactive client primitive for live reads.
- Convex indexing guidance still favors explicit `withIndex(...)` reads for predictable invitation-token, email, and tenant-user lookup performance.
- shadcn/ui docs continue to emphasize composable open-code components, which matches this repo's local component ownership.
- Inference: do not expand Story 3.1 into a dependency-upgrade sprint unless an upgrade is strictly necessary to unblock onboarding behavior.

### Testing Requirements

- Add signup-flow tests for invite-mode resolution from the `invite` query param and safe restoration of pending onboarding state.
- Add backend onboarding tests for invitation creation, expiry, resend invalidation, duplicate-email rejection, successful profile completion, and inactive-tenant blocking.
- Add RBAC and route tests for incomplete tenant-admin redirects to `/tenant-admin/onboarding`, complete tenant-admin access to `/tenant-admin`, and continued denial for other roles.
- Add password-reset continuation tests ensuring onboarding users can recover without losing or duplicating tenant context.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 3 Source](../epic-03-tenant-administration.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [Current Signup Page](../../../../../webapp/app/(auth)/signup/page.tsx)
- [Current Signup Flow](../../../../../webapp/src/components/auth/SignupFlow.tsx)
- [Current Signup Form](../../../../../webapp/src/components/auth/SignupForm.tsx)
- [Current Verify Email Form](../../../../../webapp/src/components/auth/VerifyEmailForm.tsx)
- [Current Public Entry Helper](../../../../../webapp/lib/auth/public-entry.ts)
- [Current Invite Param Constant](../../../../../webapp/app/constants.ts)
- [Current Dashboard Entry Route](../../../../../webapp/app/(app)/dashboard/page.tsx)
- [Current Tenant Admin Route](../../../../../webapp/app/(app)/tenant-admin/page.tsx)
- [Current Tenant Admin Dashboard](../../../../../webapp/src/components/tenant-admin/TenantAdminDashboard.tsx)
- [Current Protected App Layout](../../../../../webapp/app/(app)/layout.tsx)
- [Current Role Guard](../../../../../webapp/src/components/auth/RoleGuard.tsx)
- [Current Role Routing Helpers](../../../../../webapp/lib/auth/roles.ts)
- [Current Role Guard Backend Helpers](../../../../../webapp/convex/functions/_roleGuard.ts)
- [Current Users Functions](../../../../../webapp/convex/functions/users.ts)
- [Current Tenant Functions](../../../../../webapp/convex/functions/tenants.ts)
- [Current Auth Configuration](../../../../../webapp/convex/auth.ts)
- [Current Resend OTP Provider](../../../../../webapp/convex/ResendOTP.ts)
- [Current Convex Schema](../../../../../webapp/convex/schema.ts)
- [Current Public Error Helpers](../../../../../webapp/lib/errors/convex.ts)
- [Public Access Story Reference](../../../epic11/completed/11-3-public-role-based-auth-entry.md)
- [Tenant Admin Dashboard Story Reference](./3-2-tenant-admin-dashboard.md)
- [Platform Admin Auth Story Reference](../../../epic2/stories/2-1-platform-admin-authentication-2fa.md)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Convex Indexing Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [shadcn/ui Docs](https://ui.shadcn.com/docs)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Completion Notes List

- 2026-03-22: Created the implementation-ready story artifact for `3-1-tenant-admin-institution-setup-flow`.
- 2026-03-22: Anchored the story to the live repo's current self-serve signup, OTP verification, protected dashboard redirect, and tenant-admin dashboard shell instead of treating onboarding as greenfield work.
- 2026-03-22: Resolved the main implementation risk by directing the dev agent to layer invitation and onboarding state around the existing Convex Auth OTP flow rather than rewriting the authentication foundation from Story 1.2.
- 2026-03-22: Documented a route-guard approach that reuses the stage-based auth pattern already present for Platform Admin verification.
- 2026-03-22: Implemented tenant onboarding schema extensions, invitation persistence, verification-window tracking, and the dedicated `tenantAdminOnboarding` Convex module.
- 2026-03-22: Added invite-aware `/signup` handling, protected tenant-admin onboarding routing, the institution-profile completion flow, and password-reset continuation back into onboarding.
- 2026-03-22: Verified the story with `npm test`, `npm run lint`, and `npx convex codegen` from `webapp/`.

### File List

- `_bmad-output/implementation-artifacts/epics/epic3/stories/3-1-tenant-admin-institution-setup-flow.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/app/(app)/tenant-admin/onboarding/page.tsx`
- `webapp/app/(auth)/forgot-password/page.tsx`
- `webapp/app/(auth)/reset-password/page.tsx`
- `webapp/app/(auth)/signup/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/_roleGuard.ts`
- `webapp/convex/functions/auth.ts`
- `webapp/convex/functions/tenantAdminOnboarding.ts`
- `webapp/convex/functions/tenants.ts`
- `webapp/convex/functions/users.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/auth/password-reset.ts`
- `webapp/lib/auth/public-entry.ts`
- `webapp/lib/auth/roles.ts`
- `webapp/lib/auth/signup-flow.ts`
- `webapp/lib/errors/convex.ts`
- `webapp/lib/platform-admin/request-context-token.ts`
- `webapp/lib/security/audit.ts`
- `webapp/lib/tenant-admin/invitations.ts`
- `webapp/lib/tenant-admin/onboarding.ts`
- `webapp/lib/validators/tenant-admin.ts`
- `webapp/src/components/auth/ForgotPasswordForm.tsx`
- `webapp/src/components/auth/ResetPasswordForm.tsx`
- `webapp/src/components/auth/SignupFlow.tsx`
- `webapp/src/components/auth/SignupForm.tsx`
- `webapp/src/components/auth/VerifyEmailForm.tsx`
- `webapp/src/components/tenant-admin/TenantAdminOnboardingFlow.tsx`
- `webapp/tests/password-reset.test.ts`
- `webapp/tests/public-auth-entry.test.ts`
- `webapp/tests/rbac.test.ts`
- `webapp/tests/run-tests.ts`
- `webapp/tests/signup-flow.test.ts`
- `webapp/tests/tenant-admin-onboarding.test.ts`

### Change Log

- 2026-03-22: Added tenant-admin invitation, verification-window, and onboarding persistence plus invite redemption/completion mutations in Convex.
- 2026-03-22: Extended the public signup, verification, and password-reset flows for invited tenant-admin onboarding while preserving the existing password provider and OTP verification path.
- 2026-03-22: Added protected tenant-admin onboarding routing, the institution-profile completion UI, and deterministic regression coverage for invitation, routing, and continuation behavior.

### Story Completion Status

- Story ID: `3.1`
- Story Key: `3-1-tenant-admin-institution-setup-flow`
- Output File: `_bmad-output/implementation-artifacts/epics/epic3/stories/3-1-tenant-admin-institution-setup-flow.md`
- Final Status: `done`
- Completion Note: `Implemented self-serve plus invited tenant-admin onboarding, protected institution-profile completion, verification-window orchestration, and deterministic regression coverage.`
