# Story 2.1: Platform Admin Authentication & 2FA

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Platform Admin,
I want secure authentication with mandatory 2FA,
so that platform administration is protected against unauthorized access.

## Acceptance Criteria

1. Given an unauthenticated visitor navigates to `/platform-admin/login` when the route resolves then they see a distinct Platform Admin login page separate from the shared `/login` experience and the route remains publicly reachable even though `/platform-admin/*` is otherwise a protected namespace (FR-PA1a).
2. Given a Platform Admin completes valid email-and-password authentication for the first time when no 2FA enrollment exists then the system blocks access to `/platform-admin` until email OTP 2FA setup is completed and backup codes are generated, shown once, and stored only as hashes in Convex (FR-PA1b, FR-PA1c).
3. Given a Platform Admin with 2FA already enrolled enters valid primary credentials when sign-in continues then the system requires a valid email OTP before granting admin access and also allows a one-time backup code recovery path with replay protection, expiry handling, and failed-attempt limits (FR-PA1b, FR-PA1c).
4. Given a login attempt originates from a new country, materially changed IP context, or another suspicious access pattern when the server detects the anomaly then the system requires additional verification before the admin session is treated as trusted and the event is logged with location metadata where available (FR-PA1d).
5. Given a Platform Admin session is authenticated when it sits idle for 30 minutes then the session is treated as expired for platform-admin access, the user is redirected to the admin login path, and any shared "remember me" behavior does not extend the privileged admin idle window (FR-PA1e).
6. Given a Platform Admin has active sessions on multiple devices or browsers when they view or revoke sessions then the system tracks concurrent sessions with enough metadata to identify activity, login context, and revocation outcome for each session (FR-PA1f).
7. Given a credential-revocation event is initiated for a Platform Admin when the revocation completes then all active admin sessions and pending step-up challenges are terminated immediately and the account must complete a password reset before regaining admin access (FR-PA1h).
8. Given any delete or account-removal path targets a Platform Admin record when the action is attempted then the system blocks the deletion, returns the message `Platform Admin accounts cannot be deleted`, and records the blocked attempt in the audit trail (FR-PA1i).
9. Given any Platform Admin authentication or session-security action occurs when it succeeds, fails, expires, or is blocked then an immutable audit record is written with timestamp, actor, outcome, session or challenge identifiers, IP address, and location fields when the deployment exposes them (FR-PA1j).
10. Given a non-platform user authenticates through the admin entry path when role resolution completes then access to the admin surface is denied, the attempt is audited, and the user is not allowed to continue into `/platform-admin` with a tenant-scoped role.

## Tasks / Subtasks

- [x] Task 1: Add dedicated Platform Admin auth entry routes and fix route classification collisions (AC: 1, 5, 10)
  - [x] Create explicit admin auth routes such as `webapp/app/platform-admin/login/page.tsx` and the follow-on 2FA route(s) needed for setup and verification.
  - [x] Update `webapp/lib/auth/public-routes.ts`, `webapp/lib/auth/roles.ts`, `webapp/proxy.ts`, and their tests so `/platform-admin/login` and the 2FA setup or verify routes are not treated as protected dashboard pages by prefix matching.
  - [x] Keep `/platform-admin` as the canonical protected admin home path while ensuring the dedicated admin auth routes remain internal-only entry points and are not surfaced through the public `/access` chooser.
  - [x] Reuse the existing auth layout shell and shadcn primitives, but give the admin login page a distinct visual treatment aligned with `docs/html/admin-platform.html` and the UX spec.

- [x] Task 2: Introduce the Platform Admin 2FA and challenge persistence model in Convex (AC: 2, 3, 4, 6, 7, 9)
  - [x] Add the minimum new schema needed for platform-admin security state, such as 2FA enrollment metadata, hashed backup codes, OTP or suspicious-login challenge records, and trusted-login baselines.
  - [x] Reuse `authSessions` plus `sessionMetadata` where possible instead of inventing a parallel session system, but extend the data model enough to carry admin-specific assurance state, activity context, and revocation metadata.
  - [x] Ensure challenge records are indexed for the exact lookups the flow needs, especially by user, session, purpose, and expiry window.
  - [x] Store backup codes hashed only, with one-time consumption semantics and rotation support.

- [x] Task 3: Implement Platform Admin step-up auth functions on top of the current Convex Auth stack (AC: 2, 3, 4, 7, 8, 9, 10)
  - [x] Add a focused module such as `webapp/convex/functions/platformAdminAuth.ts` for setup, challenge issuance, OTP verification, backup-code verification, session listing, and revoke-all behavior.
  - [x] Reuse the existing `platformUsers` role source of truth and the current `assignPlatformAdmin` internal provisioning path; do not add public platform-admin signup.
  - [x] Keep primary password auth on the current `@convex-dev/auth` implementation and layer platform-admin step-up verification on top of it instead of migrating auth providers inside this story.
  - [x] Follow the challenge-oriented pattern already used by `webapp/convex/functions/departmentUserAuth.ts` rather than building an unrelated OTP system from scratch.
  - [x] Add a shared guard such as `requireVerifiedPlatformAdmin(...)` or equivalent so privileged admin queries and mutations cannot run on a password-only or partially verified session.
  - [x] Add an explicit backend guard that blocks any attempted Platform Admin deletion now, even though the repo does not yet expose a full admin-account management UI.

- [x] Task 4: Capture suspicious-login risk signals using server-owned request context (AC: 4, 6, 9, 10)
  - [x] Read login request IP and geolocation context from a server-owned boundary, not from client-submitted form fields.
  - [x] On Vercel deployments, support the geolocation headers documented by Vercel; in local development and tests, degrade gracefully when those headers are absent.
  - [x] Compare the current login context against the last successful trusted admin login and require additional verification when the risk policy says the access looks new or suspicious.
  - [x] Audit both the detected anomaly and the follow-up verification outcome.

- [x] Task 5: Enforce the 30-minute admin idle timeout and session revocation semantics (AC: 5, 6, 7, 9)
  - [x] Refactor the existing session policy logic in `webapp/lib/auth/session.ts`, `webapp/convex/functions/sessions.ts`, and `webapp/convex/functions/_roleGuard.ts` so platform-admin sessions use a 30-minute idle policy without weakening the current tenant-user flows.
  - [x] Ensure the admin flow does not inherit the generic 30-day remember-me window from the shared login form.
  - [x] Make revocation server-authoritative by updating stored session metadata and challenge records so all active admin sessions are invalidated immediately on the next check or touch.
  - [x] Ensure a role revocation or deactivation also removes effective platform-admin access without requiring a fresh login.

- [x] Task 6: Add the minimal UI needed for setup, verification, session visibility, and blocked-account feedback without overbuilding Story 2.2 (AC: 1, 2, 3, 6, 7, 8, 10)
  - [x] Add a dedicated Platform Admin login form component instead of overloading the shared `LoginForm` with deeply nested admin-only conditionals.
  - [x] Add focused 2FA setup and verification components for OTP entry, resend behavior, backup-code fallback, and "save these codes now" messaging.
  - [x] Provide a minimal post-login security surface for concurrent-session visibility and revoke-all behavior that Story 2.2 can later absorb into the admin shell.
  - [x] Provide the blocked deletion copy required by the acceptance criteria even if the current repo only exposes it through a guarded mutation or placeholder control.

- [x] Task 7: Expand audit vocabulary, regression tests, and route protection coverage (AC: 1-10)
  - [x] Extend `webapp/lib/security/audit.ts` with Platform Admin auth and session-security event names and outcomes rather than logging them as generic free-form strings.
  - [x] Add deterministic tests for route-publicness, route-role matching, non-platform-user denial, admin idle timeout, OTP and backup-code replay protection, suspicious-login handling, revoke-all session behavior, and deletion prevention.
  - [x] Update `webapp/tests/run-tests.ts` to include the new platform-admin auth coverage.
  - [x] Preserve or improve current test coverage around `/login`, `/platform-admin`, RBAC, and shared session behavior so this story does not regress existing tenant-user access flows.

## Dev Notes

### Story Foundation

- Story 2.1 is the first user-facing Platform Admin story after Story 2.0 established the `nestjs/` service boundary.
- The current repo already recognizes the `platform_admin` role and `/platform-admin` home path, but it does not yet have a dedicated admin login route, a platform-admin 2FA flow, suspicious-login checks, or a 30-minute admin idle policy.
- The PRD and Epic 2 make Platform Admin auth stricter than ordinary tenant-user auth. This story should deliver that stricter admin posture without broadening into a full dashboard shell or a full account-management feature set from Story 2.2 onward.

### Current Implementation State Discovered In Code

- `webapp/lib/auth/roles.ts` already treats `/platform-admin` as the canonical home path for the `platform_admin` role and protects any matching prefixed route.
- `webapp/lib/auth/public-routes.ts` currently exposes only `/`, `/access`, `/signup`, `/login`, `/forgot-password`, `/reset-password`, and `/pricing` as public routes. There is no public Platform Admin auth entry path yet.
- Because `getProtectedRouteRole("/platform-admin/login")` would currently resolve to `platform_admin`, a naive new admin login route would be trapped by the protected-route matcher and `proxy.ts`.
- `webapp/app/(auth)/login/page.tsx` and `webapp/src/components/auth/LoginForm.tsx` implement one shared email-and-password sign-in experience for the non-admin public entry model.
- `webapp/lib/auth/public-entry.ts` intentionally excludes Platform Admin from the marketing `/access` chooser. This should remain true; admin login is an internal URL, not a public role selector.
- `webapp/convex/schema.ts` currently includes:
  - `platformUsers` as the global role record for platform administrators
  - `sessionMetadata` with `rememberMe`, `lastActivityAt`, `revokedAt`, and `loggedOutAt`
  - `auditLogs` as the append-only audit table
- `webapp/convex/functions/users.ts` exposes `assignPlatformAdmin` as an internal-only provisioning path and `getAuthContext` as the canonical backend auth context query.
- `webapp/convex/functions/_roleGuard.ts` resolves current auth context and already has `requirePlatformAdmin(...)`, but it does not yet require a second factor or an admin-specific assurance level.
- `webapp/lib/auth/session.ts` currently defines:
  - standard idle timeout: 24 hours
  - remember-me idle timeout: 30 days
  - no Platform Admin override
- `webapp/convex/auth.ts` already uses:
  - the `Password` provider for primary email/password auth
  - `ResendOTP` for email verification and password-reset verification
  - a challenge-style `ConvexCredentials` pattern for Department User OTP flows
- `webapp/lib/security/audit.ts` and `webapp/convex/functions/_audit.ts` already provide append-only audit primitives, but they do not yet define Platform Admin auth event names.
- `webapp/app/(app)/platform-admin/page.tsx` is still a placeholder route. Story 2.1 should not overbuild the final admin shell that Story 2.2 owns.
- There is no existing generic delete-account flow for Platform Admin in the live repo, so the deletion-prevention acceptance criterion must be implemented as a backend guardrail plus regression coverage and, if needed, a minimal UI affordance.

### Recommended Implementation Shape

- Preferred route shape:
  - `/platform-admin/login`
  - `/platform-admin/verify`
  - `/platform-admin/setup-2fa`
- If those routes live under the `/platform-admin` namespace, they must be explicitly exempted from the current protected-route prefix logic and public-route checks.
- Reuse the current `@convex-dev/auth` password login as the primary factor and add a Platform Admin-specific step-up layer before any privileged admin data access is treated as allowed.
- Recommended approach: follow the existing challenge model used in `webapp/convex/functions/departmentUserAuth.ts` instead of inventing an unrelated OTP lifecycle.
- Reuse `ResendOTP` or a closely aligned email-delivery helper for admin OTP delivery so the repo keeps one email OTP delivery path and one mail-provider configuration pattern.
- Extend the current session policy rather than replacing it. The cleanest path is to let session metadata carry admin-specific assurance and idle-policy fields so `resolveSessionState(...)` can enforce the correct timeout without depending on stale client state.
- Keep the final source of truth for admin authorization in backend helpers such as `getAuthorizationContext(...)` and a new verified-admin guard, not only in the route layer.
- Capture suspicious-login risk signals at a server-owned boundary and persist only the data needed for verification, audit, and trusted-login comparison.
- Keep the post-login UI small and forward-compatible. A minimal session list or security card is enough here; the richer admin workspace arrives in Story 2.2.

### Critical Edge Cases To Cover

- `/platform-admin/login` accidentally redirects to `/login?reason=session_expired` because the proxy still thinks it is a protected route.
- A Platform Admin signs in through the shared `/login` flow and inherits the current 30-day remember-me policy unless the story overrides the admin session contract.
- A password-only authenticated Platform Admin reaches `/platform-admin` before OTP verification completes.
- OTP delivery fails after primary credential validation and the user needs a safe retry or backup-code path.
- A backup code is reused, already consumed, or expired.
- A non-platform user authenticates through the admin entry path and must be denied admin access without corrupting their ordinary role session.
- Revocation happens while multiple sessions and pending challenges exist for the same Platform Admin.
- Local development or CI lacks Vercel geo headers. The suspicious-login flow must not block all logins simply because location metadata is unavailable.
- A role change or deactivation happens after session creation. The next auth-context refresh must fail closed.

### Reuse And Anti-Reinvention Guidance

- Reuse the existing challenge-oriented auth pattern in `webapp/convex/functions/departmentUserAuth.ts` for OTP issuance, verification, expiry, and replay handling.
- Reuse `platformUsers` as the single role source of truth for Platform Admin identity. Do not add a second admin-user table unless a field truly cannot fit the existing model.
- Reuse `sessionMetadata`, `resolveSessionState(...)`, `ensureCurrentSessionMetadata(...)`, and `touchCurrentSession(...)` instead of introducing a parallel session tracking stack.
- Reuse `appendAuditLogEntry`, `appendAuditLogBestEffort`, and `appendAuditLogFromAction` so admin auth events follow the same append-only audit pipeline as current security events.
- Reuse the shared auth layout and shadcn component stack, but split the admin form into dedicated components rather than forcing all admin-specific behavior into `LoginForm.tsx`.
- Do not migrate from `@convex-dev/auth` to Better Auth, Clerk, or another auth vendor as part of this story.
- Do not expose Platform Admin as a public self-service role in `/access`.
- Do not trust IP, country, device, or user-agent data that comes from browser JavaScript alone.

### Architecture Compliance

- Keep hard authorization checks close to the backend data source. `proxy.ts` may perform optimistic route filtering, but real admin-auth assurance must live in Convex guard logic.
- Do not rely only on `webapp/app/(app)/layout.tsx` for admin step-up enforcement. Layout checks are not sufficient on their own for every navigation or data access path.
- Keep page files thin and push interactive behavior into feature components under `webapp/src/components/...`.
- Continue using `proxy.ts`; this repo does not use `middleware.ts`.
- Respect the existing path-alias and strict TypeScript rules from project context.
- Preserve tenant-user auth behavior for `/login`, `/access`, `/tenant-admin`, `/po`, and `/du`. This story tightens Platform Admin auth; it should not destabilize the already-working tenant roles.

### Library And Framework Requirements

- Current repo versions from `webapp/package.json`:
  - `next`: `^16.1.6`
  - `react`: `^19.2.4`
  - `convex`: `^1.13.2`
  - `@convex-dev/auth`: `^0.0.90`
  - `resend`: `^2.1.0`
- Current registry versions checked on 2026-03-22:
  - `next`: `16.2.1`
  - `convex`: `1.34.0`
  - `@convex-dev/auth`: `0.0.91`
  - `resend`: `6.9.4`
- Inference: do not broaden Story 2.1 into a dependency-upgrade sprint unless a specific package change is required to unblock admin auth behavior.
- Use `useQuery(..., "skip")` and existing Convex React patterns for verification-status reads and route guards where client reactivity helps.
- If Vercel geo helpers are adopted, prefer `@vercel/functions` or direct header reads in a server-owned boundary. Keep this optional and deployment-aware.

### File Structure Requirements

- Expected existing files to modify:
  - `webapp/lib/auth/public-routes.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/lib/auth/session.ts`
  - `webapp/proxy.ts`
  - `webapp/convex/auth.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/tests/proxy.test.ts`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/session-management.test.ts`
  - `webapp/tests/run-tests.ts`
- Expected new files (recommended):
  - `webapp/app/platform-admin/login/page.tsx`
  - `webapp/app/platform-admin/verify/page.tsx`
  - `webapp/app/platform-admin/setup-2fa/page.tsx`
  - `webapp/src/components/auth/PlatformAdminLoginForm.tsx`
  - `webapp/src/components/auth/PlatformAdminTwoFactorForm.tsx`
  - `webapp/src/components/auth/PlatformAdminSecurityCard.tsx`
  - `webapp/lib/platform-admin/auth.ts`
  - `webapp/convex/functions/platformAdminAuth.ts`
  - `webapp/tests/platform-admin-auth.test.ts`
- Optional helper files:
  - `webapp/lib/platform-admin/risk.ts`
  - `webapp/lib/platform-admin/backup-codes.ts`

### Testing Requirements

- Route and proxy coverage:
  - `/platform-admin/login` and the 2FA setup or verify routes remain public
  - `/platform-admin` remains protected
  - non-platform users cannot continue into admin routes after sign-in
- Session-policy coverage:
  - Platform Admin sessions expire after 30 minutes idle
  - shared tenant-user session windows stay unchanged
  - remember-me does not extend Platform Admin privileged access
- 2FA coverage:
  - first-time setup required before admin access
  - OTP success and failure flows
  - resend and expiry behavior
  - backup-code success, replay rejection, and exhaustion behavior
- Suspicious-login coverage:
  - new trusted context versus new suspicious context
  - local-dev no-geo-header fallback
  - audit logging for anomaly detection and verification outcome
- Revocation and deletion guard coverage:
  - revoke-all invalidates all active sessions
  - pending challenges become unusable after revocation
  - platform-admin deletion attempts fail with the required message
- Regression coverage:
  - `/login`, `/access`, `/tenant-admin`, `/po`, and `/du` flows still behave as before

### Git Intelligence Summary

- Recent dashboard work in commits `190a1b1`, `8e95f1a`, and `2a9e918` shows an established pattern in this repo:
  - thin route pages
  - dedicated feature components
  - helper or snapshot modules
  - deterministic Node-based tests
- Story 2.1 should follow that pattern for the admin auth surfaces and should stop short of building the full platform-admin shell that Story 2.2 owns.
- Recent auth and RBAC work already centralized route-role logic, public-route logic, and session helpers. Story 2.1 should extend those shared helpers rather than fork them per route.

### Detected Conflicts Or Variances

- `_bmad-output/project-context.md` and `_bmad-output/planning-artifacts/tech-stack-decisions.md` contain older statements that 2FA is required for all users.
- The PRD and Epic 2 story scope are more specific for the live roadmap:
  - ordinary users use email/password today
  - Platform Admin 2FA is mandatory in Story 2.1
  - Tenant Admin self-service 2FA belongs to later tenant-admin security work
- Treat the Epic 2 and PRD Platform Admin requirement as canonical for this story. Do not silently widen mandatory 2FA to every role here.

### Latest Tech Information

- Verified on 2026-03-22 against official docs and current registry output:
  - Next.js authentication guidance still positions Proxy as an optional optimistic-check layer and recommends doing secure checks close to the data source. Story 2.1 should therefore enforce verified-admin access in Convex helpers, not only in `proxy.ts`.
  - Next.js also warns that layouts do not re-render on every navigation, so admin step-up checks cannot rely only on the current protected app layout.
  - Convex Auth is still documented as a beta feature, and its Next.js support remains under active development. Inference: keep this story tightly aligned with the auth stack already working in the repo and avoid broad auth-vendor churn.
  - Convex React docs still support `useQuery(..., "skip")`, which fits admin verification flows where challenge state should not talk to the backend until the route has the required identifiers.
  - Convex index guidance still emphasizes precise `.eq(...)` ranges and bounded `withIndex(...)` reads. Any new challenge or trusted-login tables should be indexed for exact session, user, and expiry lookups.
  - Vercel's geo-IP documentation confirms that deployed environments expose `X-Vercel-IP-Country`, `X-Vercel-IP-Country-Region`, and `X-Vercel-IP-City`, while local development does not. Story 2.1 should use those headers when available and fail gracefully when they are absent.

### Project Context Reference

- Still-applicable project rules from `_bmad-output/project-context.md`:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - shadcn/ui plus Tailwind for UI work
  - append-only audit posture
  - `proxy.ts` for route-level protection
- Where older planning or project-context notes conflict with the live repo and Epic 2 story scope, prefer:
  - the live repo implementation
  - the PRD Platform Admin requirements
  - the Epic 2 story sequence

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 2 Source](../epic-02-platform-administration.md)
- [Epics Index](../../epics.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Tech Stack Decisions](../../../../planning-artifacts/tech-stack-decisions.md)
- [Project Context](../../../../project-context.md)
- [Platform Admin Prototype](../../../../../docs/html/admin-platform.html)
- [Current Shared Login Page](../../../../../webapp/app/(auth)/login/page.tsx)
- [Current Auth Layout](../../../../../webapp/app/(auth)/layout.tsx)
- [Current Platform Admin Placeholder](../../../../../webapp/app/(app)/platform-admin/page.tsx)
- [Current Shared Login Form](../../../../../webapp/src/components/auth/LoginForm.tsx)
- [Current Public Route Registry](../../../../../webapp/lib/auth/public-routes.ts)
- [Current Role Routing Helpers](../../../../../webapp/lib/auth/roles.ts)
- [Current Session Helpers](../../../../../webapp/lib/auth/session.ts)
- [Current Proxy](../../../../../webapp/proxy.ts)
- [Current Convex Auth Setup](../../../../../webapp/convex/auth.ts)
- [Current OTP Mail Provider](../../../../../webapp/convex/ResendOTP.ts)
- [Current Users Functions](../../../../../webapp/convex/functions/users.ts)
- [Current Session Functions](../../../../../webapp/convex/functions/sessions.ts)
- [Current Role Guard](../../../../../webapp/convex/functions/_roleGuard.ts)
- [Current Audit Helper](../../../../../webapp/convex/functions/_audit.ts)
- [Current Audit Mutation](../../../../../webapp/convex/functions/auditLogs.ts)
- [Current Security Audit Vocabulary](../../../../../webapp/lib/security/audit.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Department User Challenge Reference](../../../../../webapp/convex/functions/departmentUserAuth.ts)
- [RBAC Tests](../../../../../webapp/tests/rbac.test.ts)
- [Proxy Tests](../../../../../webapp/tests/proxy.test.ts)
- [Session Tests](../../../../../webapp/tests/session-management.test.ts)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Convex Auth Docs](https://docs.convex.dev/auth/convex-auth)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Convex Indexes Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [Vercel Geo-IP Headers](https://vercel.com/kb/guide/geo-ip-headers-geolocation-vercel-functions)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic sources:
  - `_bmad-output/implementation-artifacts/epics/epic2/epic-02-platform-administration.md`
  - `_bmad-output/implementation-artifacts/epics/epics.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/planning-artifacts/tech-stack-decisions.md`
  - `_bmad-output/project-context.md`
- Previous-story source:
  - `_bmad-output/implementation-artifacts/epics/epic2/completed/2-0-nestjs-microservice-foundation-external-services.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/app/(auth)/layout.tsx`
  - `webapp/app/(auth)/login/page.tsx`
  - `webapp/app/(app)/layout.tsx`
  - `webapp/app/(app)/platform-admin/page.tsx`
  - `webapp/src/components/auth/LoginForm.tsx`
  - `webapp/src/components/auth/RoleDashboardPlaceholder.tsx`
  - `webapp/lib/auth/public-entry.ts`
  - `webapp/lib/auth/public-routes.ts`
  - `webapp/lib/auth/proxy.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/lib/auth/session.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/lib/security/input.ts`
  - `webapp/proxy.ts`
  - `webapp/convex/auth.ts`
  - `webapp/convex/ResendOTP.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/_audit.ts`
  - `webapp/convex/functions/auditLogs.ts`
  - `webapp/convex/functions/securityAudit.ts`
  - `webapp/convex/functions/departmentUserAuth.ts`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/proxy.test.ts`
  - `webapp/tests/public-auth-entry.test.ts`
  - `webapp/tests/session-management.test.ts`
- Git context:
  - `git log --oneline -5`
  - `git show --stat --name-only --format=medium -5`
- Latest-tech verification:
  - `npm view next version`
  - `npm view convex version`
  - `npm view @convex-dev/auth version`
  - `npm view resend version`
  - `https://nextjs.org/docs/app/guides/authentication`
  - `https://docs.convex.dev/auth/convex-auth`
  - `https://docs.convex.dev/client/react`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://vercel.com/kb/guide/geo-ip-headers-geolocation-vercel-functions`

### Completion Notes List

- 2026-03-22: Created the implementation-ready story artifact for `2-1-platform-admin-authentication-2fa`.
- 2026-03-22: Anchored the story to the live repo's current auth, RBAC, session, and audit helpers instead of only the epic text.
- 2026-03-22: Captured the protected-route collision risk for `/platform-admin/login`, the current 24-hour or 30-day session policy mismatch, and the lack of current platform-admin 2FA state.
- 2026-03-22: Documented a recommended path that extends the current Convex Auth stack and current challenge-based patterns instead of changing auth vendors inside the story.
- 2026-03-22: Updated sprint tracking so Story 2.1 is ready for development.
- 2026-03-22: Implemented dedicated Platform Admin login, setup, and verify routes plus a distinct admin login form and a minimal post-login security surface.
- 2026-03-22: Added Platform Admin Convex security state, challenge persistence, backup-code hashing and consumption, suspicious-login evaluation, revoke-all behavior, and deletion blocking.
- 2026-03-22: Regenerated Convex bindings, expanded admin auth regression coverage, and validated the story with `npx convex codegen`, `npm test`, `npm run lint`, and `npm run build`.

### File List

- `_bmad-output/implementation-artifacts/epics/epic2/stories/2-1-platform-admin-authentication-2fa.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/.test-dist/lib/auth/public-entry.js`
- `webapp/.test-dist/lib/auth/public-routes.js`
- `webapp/.test-dist/lib/auth/roles.js`
- `webapp/.test-dist/lib/auth/session.js`
- `webapp/.test-dist/lib/security/audit.js`
- `webapp/.test-dist/lib/platform-admin/auth.js`
- `webapp/.test-dist/lib/platform-admin/risk.js`
- `webapp/.test-dist/tests/platform-admin-auth.test.js`
- `webapp/.test-dist/tests/proxy.test.js`
- `webapp/.test-dist/tests/rbac.test.js`
- `webapp/.test-dist/tests/run-tests.js`
- `webapp/app/(app)/platform-admin/page.tsx`
- `webapp/app/(auth)/login/page.tsx`
- `webapp/app/(auth)/platform-admin/login/page.tsx`
- `webapp/app/(auth)/platform-admin/setup-2fa/page.tsx`
- `webapp/app/(auth)/platform-admin/verify/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/_roleGuard.ts`
- `webapp/convex/functions/platformAdminAuth.ts`
- `webapp/convex/functions/sessions.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/auth/public-entry.ts`
- `webapp/lib/auth/public-routes.ts`
- `webapp/lib/auth/roles.ts`
- `webapp/lib/auth/session.ts`
- `webapp/lib/platform-admin/auth.ts`
- `webapp/lib/platform-admin/request-context.ts`
- `webapp/lib/platform-admin/risk.ts`
- `webapp/lib/security/audit.ts`
- `webapp/src/components/auth/LoginForm.tsx`
- `webapp/src/components/auth/PlatformAdminLoginForm.tsx`
- `webapp/src/components/auth/PlatformAdminSecurityCard.tsx`
- `webapp/src/components/auth/PlatformAdminTwoFactorForm.tsx`
- `webapp/tests/platform-admin-auth.test.ts`
- `webapp/tests/proxy.test.ts`
- `webapp/tests/rbac.test.ts`
- `webapp/tests/run-tests.ts`

## Change Log

- 2026-03-22: Created Story 2.1 as a comprehensive implementation guide for dedicated Platform Admin authentication, mandatory email OTP 2FA, suspicious-login handling, admin-specific session policy, revocation, and audit logging.
- 2026-03-22: Incorporated current repo constraints around route protection, shared login flow, session metadata, Convex Auth beta usage, and audit vocabulary so the implementation path is realistic for the existing codebase.
- 2026-03-22: Implemented the Platform Admin authentication story end to end with dedicated admin routes, step-up auth state in Convex, server-owned suspicious-login context, hashed backup codes, and a minimal privileged security surface.
- 2026-03-22: Added admin-specific route and session regression coverage, regenerated Convex bindings, and verified the implementation with codegen, tests, linting, and a production build.

## Story Completion Status

- Story ID: `2.1`
- Story Key: `2-1-platform-admin-authentication-2fa`
- Output File: `_bmad-output/implementation-artifacts/epics/epic2/stories/2-1-platform-admin-authentication-2fa.md`
- Final Status: `review`
- Completion Note: `Dedicated Platform Admin login, OTP setup and verification, hashed backup-code recovery, suspicious-login checks, 30-minute privileged session enforcement, revoke-all controls, deletion blocking, and regression coverage are implemented and ready for review.`
