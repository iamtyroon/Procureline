# Story 1.4: Password Reset via Email

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a registered user,
I want to reset my password via email verification,
so that I can regain access to my account if I forget my password.

## Acceptance Criteria

1. [Given] a user on the login page [When] they click "Forgot Password" and enter their registered email [Then] a password reset email is sent within 60 seconds [And] the reset link expires after 24 hours
2. [Given] a user clicks a valid reset link [When] they enter a new password meeting policy requirements [Then] password is updated successfully [And] all existing sessions are invalidated [And] user is redirected to login page with success message
3. [Given] a user clicks an expired reset link [When] they attempt to reset password [Then] system displays "Reset link expired. Please request a new one."
4. [Given] a user enters an unregistered email for password reset [When] they submit the request [Then] system displays generic "If email exists, reset link sent" (no email enumeration)

## Tasks / Subtasks

- [ ] Task 1: Configure Convex Auth reset provider (AC: 1, 2, 3, 4)
- [ ] Add password reset provider config in `webapp/convex/auth.ts` using `Password({ reset: ... })`.
- [ ] Implement reset email sender/provider module (Resend-based) in `webapp/convex/` and wire required env vars.
- [ ] Ensure reset token/code validity window is 24 hours and resend behavior is rate-limited.

- [ ] Task 2: Implement forgot-password request UI and flow trigger (AC: 1, 4)
- [ ] Create route/page `webapp/app/(auth)/forgot-password/page.tsx`.
- [ ] Add form for email entry and submit using Convex Auth `signIn("password", formData)` with `flow=reset`.
- [ ] Always show a generic success message for both existing and non-existing emails.

- [ ] Task 3: Implement reset verification UI (AC: 2, 3)
- [ ] Create route/page `webapp/app/(auth)/reset-password/page.tsx` handling reset token/code and new password.
- [ ] Submit new password via Convex Auth with `flow=reset-verification` and matching email/token inputs.
- [ ] Enforce password policy parity with current `validatePasswordRequirements` in `webapp/convex/auth.ts`.
- [ ] Handle expired/invalid token path with explicit user-facing error state.

- [ ] Task 4: Invalidate active sessions on successful password reset (AC: 2)
- [ ] Confirm Convex Auth reset flow revokes active sessions; if not, add explicit sign-out/revocation mutation logic.
- [ ] Add redirect to `/login` with success query/message after completion.

- [ ] Task 5: Wire routing and login integration (AC: 1, 2, 3)
- [ ] Keep `Forgot password?` link from `LoginForm` pointing to the new route.
- [ ] Add reset page route guard/flow parsing so link/code entry reaches the correct step.

- [ ] Task 6: Test coverage (AC: 1, 2, 3, 4)
- [ ] Unit test form validation for email and password policy paths.
- [ ] Integration test happy path reset flow, expired link, invalid code, and non-enumeration response.
- [ ] Verify post-reset login with new password succeeds and old sessions are no longer valid.

## Dev Notes

- Story foundation and business intent:
- FR3 requires password reset through email verification.
- Must keep security posture aligned with Epic 1 and NFR-S rules (no account enumeration, strong password policy, session safety).

- Architecture and implementation constraints:
- Current auth stack is Convex Auth (`@convex-dev/auth`) with Password provider in `webapp/convex/auth.ts`.
- Next.js app is on `16.1.6`; routing is App Router.
- Existing login form already links to `/forgot-password`, but route is not implemented yet.
- Keep tenant isolation and auth checks server-authoritative; never trust client-only checks.

- Latest technical guidance (validated March 7, 2026):
- Convex Auth password reset uses Password provider `reset` option and a two-step flow:
- Step 1: `flow=reset` (request reset)
- Step 2: `flow=reset-verification` (submit code/link + `newPassword`)
- Next.js 16 deprecates `middleware.ts` naming in favor of `proxy.ts`; when touching auth edge logic, follow proxy conventions and matcher scoping.

- Files likely involved:
- `webapp/convex/auth.ts`
- `webapp/convex/ResendOTP.ts` or new reset-specific provider module
- `webapp/app/(auth)/forgot-password/page.tsx` (new)
- `webapp/app/(auth)/reset-password/page.tsx` (new)
- `webapp/src/components/auth/LoginForm.tsx`
- `webapp/lib/validators/auth.ts`
- `webapp/proxy.ts` or existing auth boundary file if migration still pending

### Architecture Compliance

- Use Convex Auth as single auth system; do not introduce parallel auth stacks.
- Keep password policy consistent with existing server-side `validatePasswordRequirements`.
- Preserve no-enumeration behavior for reset requests.
- Keep route and function naming aligned with current project conventions.

### Library and Framework Requirements

- `@convex-dev/auth` (current project dependency: `^0.0.90`) for all reset flow operations.
- `next` (current project dependency: `^16.1.6`) App Router pages for auth screens.
- `resend` for transactional reset email delivery, using provider integration pattern already used in project.
- `react-hook-form` + `zod` for client validation and form state.

### File Structure Requirements

- Auth pages stay under `webapp/app/(auth)/...`.
- Convex provider/auth files remain under `webapp/convex/...`.
- Validators remain in `webapp/lib/validators/...`.
- Do not place password reset logic under dashboard routes.

### Testing Requirements

- Add/extend tests for:
- reset request success response (always generic),
- reset verification success,
- expired/invalid token behavior,
- password policy failures,
- session invalidation expectations.
- Validate login redirect behavior after successful reset.

### Previous Story Intelligence

- Story 1.3 established login flow and error handling patterns in `LoginForm`.
- Session-expiry messaging already uses query-param approach; reuse this pattern for reset success feedback.
- Authentication logic and UI conventions already use shadcn + RHF + zod; keep consistency.
- Recent fixes addressed hydration and auth-context redirect timing. Avoid introducing redirect side effects outside guarded effects.

### Git Intelligence Summary

- Recent commits concentrated auth and tenant work in:
- `webapp/app/(auth)/*`
- `webapp/src/components/auth/*`
- `webapp/convex/auth.ts`, `webapp/convex/functions/users.ts`, `webapp/middleware.ts`
- Use the same layering pattern:
- UI form -> Convex Auth action -> role/session checks -> route redirect.
- Avoid broad schema churn; most recent schema commit removed duplicate indexes.

### Latest Tech Information

- Convex Auth docs indicate reset is implemented through Password provider `reset` config and `flow` values (`reset`, `reset-verification`) in `signIn`.
- Reset by link requires route handling for second-step rendering; reset by code requires email + code + new password payload.
- Next.js 16 upgrade docs state `middleware` naming is deprecated in favor of `proxy`; Node.js runtime is default for `proxy`.

### Project Context Reference

- Follow `_bmad-output/project-context.md` rules for:
- strict TypeScript,
- Convex-first mutations/queries,
- role and tenant checks on server side,
- audit-friendly security behavior,
- consistent folder conventions and test placement.

### References

- [Epic Story Definition](_bmad-output/implementation-artifacts/epics/epic1/epic-01-foundation-authentication.md#story-14-password-reset-via-email)
- [PRD FR3 + Security NFRs](_bmad-output/planning-artifacts/prd.md)
- [Architecture Auth Stack](_bmad-output/planning-artifacts/architecture.md)
- [Project Context Rules](_bmad-output/project-context.md)
- [Convex Auth Password Reset Config](https://github.com/get-convex/convex-auth/blob/main/docs/pages/config/passwords.mdx?plain=1#L145#email-reset-setup)
- [Convex Auth Password Provider `reset` API](https://github.com/get-convex/convex-auth/blob/main/docs/pages/api_reference/providers/Password.mdx?plain=1#L232#reset)
- [Next.js 16 middleware -> proxy migration](https://nextjs.org/docs/app/guides/upgrading/version-16#middleware-to-proxy)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Previous story source: `_bmad-output/implementation-artifacts/epics/epic1/completed/1-3-user-login-with-email-password.md`
- Recent git context: last 5 commits in repository

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story status set to `ready-for-dev`.
- Story aligned to existing auth stack and current repo structure.

### File List

- `_bmad-output/implementation-artifacts/1-4-password-reset-via-email.md`
