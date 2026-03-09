# Story 1.6: Four-Layer Role-Based Access Control

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system administrator,
I want role-based access control across 4 user levels,
so that users can only access features and data appropriate to their role.

## Acceptance Criteria

1. [Given] the RBAC system is implemented [When] roles are resolved for an authenticated user [Then] four distinct application roles exist and are enforced: `platform_admin`, `tenant_admin`, `procurement_officer`, and `department_user` [And] each role has a single canonical dashboard/home route.
2. [Given] a Platform Admin user [When] they sign in or navigate within the protected app [Then] they can access `/platform-admin` features and tenant-overview capabilities [And] they are blocked from tenant-specific procurement routes such as `/tenant-admin`, `/po`, and `/du`.
3. [Given] a Tenant Admin user [When] they sign in or navigate within the protected app [Then] they can access `/tenant-admin` features [And] they cannot access `/platform-admin` or PO/DU-only routes [And] they cannot act outside their tenant context.
4. [Given] a Procurement Officer user [When] they sign in or navigate within the protected app [Then] they can access `/po` features [And] they cannot access `/platform-admin`, `/tenant-admin`, or DU-only routes [And] they remain tenant-scoped.
5. [Given] a Department User user [When] they sign in or navigate within the protected app [Then] they can access `/du` features only [And] they cannot access `/platform-admin`, `/tenant-admin`, or `/po` routes [And] the authorization model is ready to add future department-scoped checks without redesign.
6. [Given] any authenticated user attempts to access a page, handler, or Convex function outside their allowed role permissions [When] the request is processed [Then] secure server-side authorization rejects the action with unauthorized/403 semantics [And] page navigation redirects the user to their own dashboard with a clear forbidden-access notice [And] the system does not leak tenant existence or cross-role data.
7. [Given] an authenticated user has no resolvable active application role, multiple conflicting active roles, or an unknown/corrupt role value [When] authorization context is resolved [Then] access is denied by default [And] the event is treated as a misconfiguration/security condition rather than falling back to the first matching role.
8. [Given] role or activation state changes while a user still has an active session [When] they make their next protected request [Then] the latest server-side role state is enforced immediately [And] stale client state cannot preserve prior privileges.

## Tasks / Subtasks

- [x] Task 1: Establish the canonical role model and storage strategy (AC: 1, 2, 3, 4, 5)
  - [x] Add a shared role module such as `webapp/lib/auth/roles.ts` that defines canonical role keys, labels, home routes, and allowed route prefixes.
  - [x] Preserve the existing tenant role values already stored in the database: `tenant_admin`, `procurement_officer`, and `department_user`.
  - [x] Introduce an app-owned global-role table for Platform Admins, e.g. `platformUsers`, keyed by `userId` with `isActive` and `createdAt`; do not fake a tenant record to represent a platform admin.
  - [x] Define and enforce the MVP invariant for role assignment: exactly one active application role context per authenticated user at a time; if conflicting role records exist, fail closed.
  - [x] Do not attempt to modify Convex Auth's generated `users` schema directly for role storage; keep role data in app-owned tables.
  - [x] If a bootstrap path is needed for local/dev validation, add an internal-only mutation or seed mechanism for assigning `platform_admin`; do not expose platform-role assignment as a public mutation in this story.

- [x] Task 2: Build secure backend authorization context and guard helpers (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] Add a dedicated Convex authorization helper such as `webapp/convex/functions/_roleGuard.ts` that resolves the current user's authorization context from `getAuthUserId`, `getAuthSessionId`, the app-owned role tables, and the existing session-validity checks.
  - [x] Extend or refactor `webapp/convex/functions/users.ts#getAuthContext` so it can return platform-admin and tenant-role contexts from a single canonical source.
  - [x] Normalize the returned authorization context to include at minimum: `role`, `homePath`, `scope` (`platform` or `tenant`), `isActive`, `isSessionValid`, and any tenant identifier only when applicable.
  - [x] Add deny-by-default helpers such as `requireAuthenticatedUser`, `requireAnyRole`, and tenant-role assertion helpers so future Convex queries/mutations can reuse the same enforcement path.
  - [x] Ensure authenticated-but-wrong-role requests produce consistent unauthorized behavior and do not silently fall through as generic authenticated success.
  - [x] Explicitly handle and test these backend edge states: no role record, duplicate active role records, inactive role record, unknown role value, and platform-admin records accidentally combined with tenant-role records.
  - [x] Ensure tenant-only helpers hard-fail when invoked for a platform admin or for an auth context with no tenant scope.

- [x] Task 3: Apply RBAC to protected app routing and dashboard entry points (AC: 2, 3, 4, 5, 6, 7, 8)
  - [x] Add a protected `/platform-admin` page placeholder alongside the existing `/tenant-admin`, `/po`, and `/du` routes.
  - [x] Add a shared frontend role guard, or page-level guard pattern, that uses the centralized role map to protect role-specific routes and display a clear forbidden-access notice when redirecting to the correct dashboard.
  - [x] Convert `webapp/app/(app)/dashboard/page.tsx` into a neutral role-resolution entry point that redirects authenticated users to their canonical home route instead of rendering tenant-only fallback content.
  - [x] Update the authenticated app shell so wrong-role navigation is handled explicitly and does not rely on placeholder pages rendering for the wrong user.
  - [x] Keep `webapp/proxy.ts` focused on authentication and cache-header shaping; do not turn Proxy into the sole source of truth for role authorization.
  - [x] Match protected routes by full path segment boundaries, not naive string prefix checks, so `/po` does not accidentally authorize `/portal`-style paths.
  - [x] Add a safe fallback for impossible redirect states so users do not get trapped in redirect loops when the computed home route is missing or forbidden.

- [x] Task 4: Fix onboarding and post-auth redirects to use centralized role resolution (AC: 1, 2, 3, 4, 5, 7, 8)
  - [x] Update `webapp/src/components/auth/VerifyEmailForm.tsx` so it no longer hardcodes `/tenant-admin` after verification.
  - [x] Ensure login and post-verification redirects read from the same canonical auth/authorization context used everywhere else.
  - [x] Preserve Story 1.5's session-management behavior, including remember-me handling and invalid-session cleanup, while layering RBAC on top.
  - [x] Add a user-facing forbidden-access message path that is distinct from `session_expired`, `account_deactivated`, and `subscription_inactive`.
  - [x] Define the UX and backend behavior for authenticated users with no assigned application role yet: either a dedicated pending-access screen or a deterministic safe redirect, but never silent access to a protected dashboard.

- [x] Task 5: Wire RBAC into the current data-access surface without overreaching scope (AC: 2, 3, 4, 5, 6, 7, 8)
  - [x] Apply the new authorization helpers to the existing auth-context and dashboard entry flows so the role model is enforced immediately for current protected routes.
  - [x] Return `ConvexError`-based unauthorized errors from secure backend paths; page-level redirects are for UX, not the only security layer.
  - [x] Keep department-level data constraints extensible but do not fabricate department tables or fake `departmentId` references in this story before the department domain exists.
  - [x] Do not add billing, reporting, procurement CRUD, or tenant-isolation data filters beyond what is needed to establish the RBAC foundation for future stories.
  - [x] Make authorization decisions read latest database state on each protected request so role removals/deactivations take effect without requiring fresh login.

- [x] Task 6: Add automated and backend-first coverage for role resolution and denial paths (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] Add unit-style tests for role constants, route-permission mapping, home-route selection, and forbidden redirect behavior.
  - [x] Add tests for the authorization-context resolution logic covering `platform_admin`, `tenant_admin`, `procurement_officer`, `department_user`, and no-role edge cases.
  - [x] Extend current auth/proxy tests to confirm public routes remain public, protected routes stay auth-gated, and Proxy does not become a database-backed role checker.
  - [x] Add explicit automated cases for: conflicting role records, inactive role records, unknown role strings from corrupted data, route-segment matching boundaries, redirect-loop prevention, and role revocation after session establishment.
  - [x] If browser testing is unavailable, replace manual validation with deterministic backend/component tests plus a documented test matrix of expected redirects and authorization outcomes for each role-path combination.

## Dev Notes

- Story foundation and business intent:
  - Epic 1 maps this story to FR6 and establishes the platform-wide authorization foundation required before Story 1.7 tenant isolation and Story 1.8 DU access-code authentication can be implemented safely.
  - This story sits after registration, login, password reset, and session management. Reuse those completed flows; do not redesign authentication.
  - The primary outcome is a canonical role model plus reusable enforcement helpers, not a full feature implementation for every future dashboard.

- Current implementation state discovered in code:
  - `webapp/convex/schema.ts` currently supports only three tenant-scoped roles in `tenantUsers`: `tenant_admin`, `procurement_officer`, and `department_user`.
  - There is no `platform_admin` storage model yet, and there is no `/platform-admin` route in `webapp/app/(app)/`.
  - `webapp/convex/functions/users.ts#getAuthContext` currently resolves only tenant roles and assumes a tenant-scoped redirect path.
  - `webapp/src/components/auth/VerifyEmailForm.tsx` currently hardcodes `/tenant-admin` after signup verification.
  - `webapp/app/(app)/dashboard/page.tsx` still behaves as a generic tenant fallback page and does not centrally redirect by role.
  - `webapp/proxy.ts` currently performs authentication-only gating plus no-store headers, which is aligned with Next.js guidance for optimistic checks.
  - `webapp/app/(app)/layout.tsx` still performs client-side auth/session checks. That is useful for UX, but it is not a sufficient authorization boundary by itself.

- Reuse and anti-reinvention guidance:
  - Reuse the existing auth/session stack from Stories 1.2 through 1.5: `Convex Auth`, `getAuthContext`, `sessionMetadata`, `proxy.ts`, and the query-param-driven auth messaging pattern.
  - Keep the existing stored tenant role names. Do not rename `procurement_officer` to `po` or `department_user` to `du` in the database just to match short labels in the epic text.
  - Reuse `RoleDashboardPlaceholder.tsx` for the new `/platform-admin` route instead of introducing a second placeholder pattern.
  - Prefer one shared role map and one shared authorization-context builder over scattering `if (role === ...)` checks across pages and components.

- Security and scope boundaries:
  - Do not rely on client-only guards or layout-only checks as the secure RBAC boundary.
  - Do not put platform admins inside `tenantUsers` with a fake tenant, because that will corrupt future tenant-isolation assumptions.
  - Do not depend on experimental Next.js `forbidden()` or `forbidden.js` for production enforcement in this repo; use stable redirect UX for pages and explicit unauthorized errors in backend paths.
  - Do not broaden this story into full tenant-isolation filtering or department-level data enforcement beyond the role-foundation work needed for future stories.

### Technical Requirements

- Keep the canonical stored role values as:
  - `platform_admin`
  - `tenant_admin`
  - `procurement_officer`
  - `department_user`
- Introduce an app-owned global-role table for `platform_admin` users instead of overloading `tenantUsers`.
- Centralize the route map at minimum for:
  - `/platform-admin` -> `platform_admin`
  - `/tenant-admin` -> `tenant_admin`
  - `/po` -> `procurement_officer`
  - `/du` -> `department_user`
  - `/dashboard` -> neutral redirect entry point
- Authenticated-but-wrong-role behavior must be split intentionally:
  - App Router page navigation: redirect to the user's canonical dashboard/home route and show a forbidden-access notice.
  - Convex queries/mutations and any Route Handlers: return unauthorized/403 semantics via explicit errors or responses.
- Keep `proxy.ts` limited to optimistic auth checks and response headers. Do not add database-backed role checks there.
- Extend the existing auth context rather than creating a second parallel authorization state store in the browser.
- Preserve Story 1.5 session validity checks. RBAC must compose with `isSessionValid`, not bypass it.
- Tenant-bound roles must continue to derive tenant context from app-owned tables and server-side auth, not from client-provided route params.
- Department-specific checks must remain future-extensible without inventing fake department data in this story.
- Authorization must fail closed when role resolution returns zero matches, more than one active match, an inactive match, or an unknown role value.
- Route authorization must use segment-aware matching instead of naive `startsWith()` checks to avoid prefix collisions.
- For MVP, if a user can theoretically belong to multiple tenants in the future, this story must either reject that state explicitly or define a deterministic active-tenant selection rule; it must not rely on `first()` query ordering.
- Platform-admin contexts must never carry tenant-scoped fields by default, and tenant-scoped code paths must reject missing `tenantId` rather than coercing or defaulting it.

### Architecture Compliance

- Follow the actual versions installed in `webapp/package.json`, not the stale summary in `_bmad-output/project-context.md`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
- Keep the existing Next.js 16 `proxy.ts` convention. Do not reintroduce `middleware.ts`.
- Keep secure authorization checks close to the data/auth source. The Next.js layout can still improve UX, but it must not be the only enforcement point.
- Do not mutate or assume custom writable fields on Convex Auth's generated `users` or `authSessions` tables unless the library explicitly supports it in this repo's chosen pattern.
- If you add a platform-admin bootstrap helper, keep it internal-only and auditable.

### Library and Framework Requirements

- Convex Auth
  - Use `getAuthUserId` and `getAuthSessionId` from `@convex-dev/auth/server` to resolve the current actor and current session securely in backend code.
  - Continue using the existing `authSessions`-backed session validity model from Story 1.5.
  - Do not replace the current `convexAuth` setup or introduce a second auth provider.
- Convex backend
  - Use shared guard helpers plus `ConvexError` for unauthorized backend access.
  - Keep app-owned role logic in repo-owned tables and helper modules.
- Next.js App Router / Proxy
  - Use Proxy only for optimistic auth checks and cache policy.
  - Keep secure role checks in page/data access paths, not in Proxy alone.
  - Avoid the experimental `forbidden()` API for this production code path.
- Existing frontend stack
  - Reuse the current client-side auth/query flow, shadcn/ui components, and placeholder dashboard component.
  - Keep new forbidden-access messaging consistent with the existing query-param/banner UX patterns where appropriate.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/app/(app)/layout.tsx`
  - `webapp/app/(app)/dashboard/page.tsx`
  - `webapp/src/components/auth/VerifyEmailForm.tsx`
  - `webapp/proxy.ts`
- Expected new files (if needed):
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/src/components/auth/RoleGuard.tsx`
  - `webapp/app/(app)/platform-admin/page.tsx`
  - `webapp/tests/rbac.test.ts`
- Keep new RBAC helpers inside auth/Convex layers. Do not scatter role maps across marketing, billing, or password-reset modules.

### Testing Requirements

- Add automated coverage for:
  - role-to-route mapping,
  - authorization-context resolution for all four roles,
  - wrong-role redirect selection,
  - no-role edge cases,
  - public-vs-protected route registry regressions.
- Prefer extracting pure authorization logic into shared helpers so the existing lightweight test harness can cover the behavior without needing a full Convex integration harness for every case.
- Manual/browser validation must cover:
  - tenant-admin signup and verification still land on the correct dashboard,
  - a platform-admin bootstrap user lands on `/platform-admin`,
  - tenant-admin, PO, and DU users land on `/tenant-admin`, `/po`, and `/du` respectively,
  - each role is redirected away from disallowed routes with a clear notice,
  - session-expired behavior from Story 1.5 still works unchanged.
- Backend-first validation is required even if browser/manual testing is not possible:
  - pure tests for role resolution and route mapping,
  - auth-context tests for fail-closed misconfiguration states,
  - redirect outcome matrix tests for each role against each protected route family,
  - revocation/deactivation tests proving stale sessions do not retain old privileges.

### Previous Story Intelligence

- Story 1.5 already established:
  - a server-authoritative session validity model using `authSessions` plus app-owned `sessionMetadata`,
  - `getAuthContext` as the current auth decision surface,
  - `proxy.ts` as an authentication-first gate with no-store headers,
  - query-param-driven login notices and redirect reasons.
- Build RBAC on top of those decisions instead of bypassing them.
- The current app shell still uses client-side checks in `webapp/app/(app)/layout.tsx`; Story 1.6 should reduce reliance on that pattern rather than deepen it.

### Git Intelligence Summary

- Recent auth work is concentrated in:
  - `webapp/convex/auth.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/src/components/auth/*`
  - `webapp/proxy.ts`
- The most recent commit on `main` is `48b416c` (`1.4 fully done forgot password story`), which means the current codebase already has established auth patterns that this story should extend rather than replace.
- The current code already contains tenant-admin, PO, and DU placeholder dashboards, so the main structural gap is platform-admin support plus centralized authorization.

### Latest Tech Information

- Validated March 9, 2026:
  - Next.js 16 official auth guidance recommends Proxy only for optimistic, cookie-based checks and says the majority of secure authorization checks should happen close to the data source.
  - Next.js official auth guidance warns that layouts do not re-render on every client-side navigation, so layout-only auth/role checks are not sufficient.
  - Next.js `forbidden()` and `forbidden.js` exist, but the official docs mark them experimental and not recommended for production as of February 27, 2026.
  - Convex Auth official docs state that backend functions should use `getAuthUserId` and `getAuthSessionId`, that `users` and `authSessions` are library-managed tables, and that one user can have many active sessions.
  - Convex Auth official docs state `session.totalDurationMs` and `session.inactiveDurationMs` default to 30 days, which aligns with Story 1.5's current approach of layering app-owned session policy on top of Convex Auth session primitives.

### Project Context Reference

- Apply the repo's durable project-context rules where they still match the codebase:
  - strict TypeScript,
  - path-alias imports,
  - Convex-first auth/data enforcement,
  - shadcn/ui + Zod + react-hook-form for forms,
  - no client-only authorization assumptions.
- Where `_bmad-output/project-context.md` is stale, prefer the actual installed versions and file conventions in the current `webapp` codebase.

### Project Structure Notes

- Alignment with the current repo:
  - public auth screens live under `webapp/app/(auth)/...`,
  - protected role routes live under `webapp/app/(app)/...`,
  - Convex auth/data functions live under `webapp/convex/functions/...`,
  - shared auth helpers live under `webapp/lib/auth/...`.
- Detected conflicts or variances:
  - `_bmad-output/project-context.md` still summarizes older broad versions and does not reflect the actual Next.js 16 / React 19 package versions in the repo.
  - The current protected-route flow is authentication-aware but not yet role-aware.
  - The epic's shorthand `po` / `du` role labels do not match the persisted schema values `procurement_officer` / `department_user`; implementation must preserve the actual stored values.

### References

- [Epic Story Definition](_bmad-output/implementation-artifacts/epics/epic1/epic-01-foundation-authentication.md#story-16-four-layer-role-based-access-control)
- [Sprint Status Source](_bmad-output/implementation-artifacts/sprint-status.yaml)
- [PRD FR6 / FR7 / NFR-S1](_bmad-output/planning-artifacts/prd.md)
- [Architecture Auth and RBAC Decisions](_bmad-output/planning-artifacts/architecture.md)
- [UX Role Dashboards and Desktop Strategy](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Project Context Rules](_bmad-output/project-context.md)
- [Current Convex Schema](webapp/convex/schema.ts)
- [Current Auth Context Query](webapp/convex/functions/users.ts)
- [Current Session Guard Helpers](webapp/convex/functions/sessions.ts)
- [Current Protected Layout](webapp/app/(app)/layout.tsx)
- [Current Protected Dashboard Entry](webapp/app/(app)/dashboard/page.tsx)
- [Current Proxy Gate](webapp/proxy.ts)
- [Current Email Verification Redirect Logic](webapp/src/components/auth/VerifyEmailForm.tsx)
- [Current Placeholder Dashboard Component](webapp/src/components/auth/RoleDashboardPlaceholder.tsx)
- [Next.js Authentication Guide - Authorization / Proxy / Layout Checks](https://nextjs.org/docs/app/guides/authentication#authorization)
- [Next.js Authentication Guide - Optimistic Checks with Proxy](https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional)
- [Next.js Authentication Guide - Layouts and Auth Checks](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks)
- [Next.js forbidden() API Reference](https://nextjs.org/docs/app/api-reference/functions/forbidden#forbidden)
- [Next.js forbidden.js File Convention](https://nextjs.org/docs/app/api-reference/file-conventions/forbidden#forbidden-js)
- [Convex Auth Authorization Guide](https://github.com/get-convex/convex-auth/blob/main/docs/pages/authz.mdx?plain=1#L1#authorization)
- [Convex Auth getAuthSessionId](https://github.com/get-convex/convex-auth/blob/main/docs/pages/api_reference/server.mdx?plain=1#L901#getauthsessionid)
- [Convex Auth session.totalDurationMs](https://github.com/get-convex/convex-auth/blob/main/docs/pages/api_reference/server.mdx?plain=1#L1119#session-totaldurationms)
- [Convex Auth session.inactiveDurationMs](https://github.com/get-convex/convex-auth/blob/main/docs/pages/api_reference/server.mdx?plain=1#L1126#session-inactivedurationms)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Skill workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic source: `_bmad-output/implementation-artifacts/epics/epic1/epic-01-foundation-authentication.md`
- Previous story source: `_bmad-output/implementation-artifacts/epics/epic1/completed/1-5-session-management-logout.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/convex/schema.ts`
  - `webapp/convex/auth.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/app/(app)/layout.tsx`
  - `webapp/app/(app)/dashboard/page.tsx`
  - `webapp/app/(app)/platform-admin/page.tsx`
  - `webapp/app/(app)/tenant-admin/page.tsx`
  - `webapp/app/(app)/po/page.tsx`
  - `webapp/app/(app)/du/page.tsx`
  - `webapp/src/components/auth/LoginForm.tsx`
  - `webapp/src/components/auth/RoleGuard.tsx`
  - `webapp/src/components/auth/SignupForm.tsx`
  - `webapp/src/components/auth/VerifyEmailForm.tsx`
  - `webapp/lib/auth/roles.ts`
  - `webapp/lib/auth/session.ts`
  - `webapp/lib/auth/proxy.ts`
  - `webapp/lib/auth/public-routes.ts`
  - `webapp/lib/validators/auth.ts`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/proxy.test.ts`
  - `webapp/tests/session-management.test.ts`
- Recent git context: last 5 commits on `main`
- External validation sources:
  - Next.js official docs
  - Convex Auth official docs

### Completion Notes List

- Added a canonical RBAC model in `webapp/lib/auth/roles.ts` with four role keys, home routes, segment-aware route matching, forbidden redirect fallbacks, and fail-closed role-record resolution.
- Added the app-owned `platformUsers` table plus an internal-only `assignPlatformAdmin` bootstrap mutation, preserving tenant role storage in `tenantUsers`.
- Centralized backend authorization in `webapp/convex/functions/_roleGuard.ts` and refactored `webapp/convex/functions/users.ts#getAuthContext` to return one normalized auth context for platform and tenant roles.
- Updated the protected app shell and neutral dashboard entry so wrong-role navigation redirects with a forbidden notice, pending/misconfigured users land on a safe dashboard state, and post-login/post-verification flows resolve from the same auth context.
- Hardened the current data-access surface by making tenant-only lookups fail with `ConvexError` authorization semantics instead of silently returning cross-scope results.
- Added backend-first RBAC coverage in `webapp/tests/rbac.test.ts` and extended `webapp/tests/proxy.test.ts`; `npm test`, `npm run lint`, `npx convex codegen`, and `npm run build` all passed.
- Follow-up after live browser verification: added explicit login-page metadata so `/login` now reports the correct browser title instead of inheriting the auth layout signup title.

### Change Log

- 2026-03-09: Implemented four-layer RBAC foundations across Convex auth context resolution, protected route guarding, role-aware redirects, platform-admin bootstrap support, and deterministic authorization test coverage.
- 2026-03-09: Corrected `/login` page metadata after browser verification exposed the inherited signup title in the auth layout.
- 2026-03-09: Code review fixes — hardened `assignPlatformAdmin` to reject duplicate inactive records; added guard-coverage doc comment on `getAuthorizationContext`; added 6 new RBAC edge-case and happy-path tests; extracted shared `Spinner` component from duplicated inline SVGs; documented the `tenantId` type cast safety.

### File List

- `_bmad-output/implementation-artifacts/1-6-four-layer-role-based-access-control.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/.test-dist/lib/auth/roles.js`
- `webapp/.test-dist/tests/proxy.test.js`
- `webapp/.test-dist/tests/rbac.test.js`
- `webapp/.test-dist/tests/run-tests.js`
- `webapp/app/(auth)/login/page.tsx`
- `webapp/app/(app)/dashboard/page.tsx`
- `webapp/app/(app)/layout.tsx`
- `webapp/app/(app)/platform-admin/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/_roleGuard.ts`
- `webapp/convex/functions/users.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/auth/roles.ts`
- `webapp/src/components/auth/LoginForm.tsx`
- `webapp/src/components/auth/RoleGuard.tsx`
- `webapp/src/components/auth/VerifyEmailForm.tsx`
- `webapp/tests/proxy.test.ts`
- `webapp/tests/rbac.test.ts`
- `webapp/tests/run-tests.ts`
- `webapp/src/components/ui/Spinner.tsx`
