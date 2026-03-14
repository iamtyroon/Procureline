# Story 1.8: DU Access Code Authentication

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want to log in using an access code provided by my Procurement Officer,
so that I can access my department's procurement planning interface without a traditional account setup.

## Acceptance Criteria

1. [Given] a Departmental User reaches the public DU access route from Story 11.3 and has a valid department-scoped access code [When] they enter the access code and their email on the DU sign-in page [Then] the system validates the code and the department access window [And] prompts for email OTP verification [And] after successful OTP verification the user is signed in, linked to the correct tenant and department context, and redirected to `/du` (FR5).
2. [Given] a Departmental User enters an invalid access code [When] they submit the DU access form [Then] the system displays `Invalid access code` and no DU auth challenge or session is created (FR5a).
3. [Given] a Departmental User enters an expired or inactive access code [When] they submit the DU access form [Then] the system displays `Access code expired. Contact your Procurement Officer.` and the request is audited without revealing unrelated tenant data (FR5b).
4. [Given] the same email plus access-code combination fails validation 5 times consecutively [When] another attempt is made before the cooldown ends [Then] the system blocks the attempt for 15 minutes, shows the remaining lockout time, and does not lock the entire department code for other users (FR5d).
5. [Given] a DU enters a valid code before the department submission period starts [When] the request is evaluated [Then] the system displays `Submission period has not started yet. Please wait until [date].` and does not issue a DU session (FR5e).
6. [Given] a DU enters a valid code after the department submission period ends [When] the request is evaluated [Then] the system displays `Submission period has ended.` [And] the implementation honors the Epic 1 grace rule by allowing at most a 30-minute read-only grace window after the deadline instead of normal editing access (FR5f plus Epic 1 grace handling).
7. [Given] the tenant tied to the DU access code is suspended or cancelled [When] the user attempts DU sign-in [Then] the system surfaces the existing subscription-inactive messaging path and does not create or continue a DU session (FR5g).
8. [Given] a DU profile for the verified email and department has been deactivated [When] the user attempts DU sign-in with an otherwise valid code [Then] the system displays `Account deactivated. Contact your Procurement Officer.` and does not create or continue a DU session (FR5h).
9. [Given] a returning DU already has a bound department-user profile for the verified email and department [When] they attempt DU sign-in again [Then] the same email can continue through OTP verification for that department [And] a mismatched email is rejected without reassigning the stored DU identity to a different department or tenant (Epic 1 technical notes).
10. [Given] a verified DU email already belongs to an incompatible active application role or to a DU record bound to a different department or tenant [When] the DU sign-in flow evaluates the verified identity [Then] the system fails closed, displays `This email can't be used for Department User access. Contact your Procurement Officer.`, and does not create, move, or reuse a DU session or role assignment for the wrong scope (Story 1.6 single-active-role invariant).
11. [Given] Epic 1 also includes FR5c (`DU can request access code reminder from PO via system`) [When] this story is implemented [Then] the story explicitly defers outbound reminder delivery to a follow-up story, while preserving only a narrow reminder-request extension point or UX placeholder so FR5c is not silently dropped from the epic backlog.

## Tasks / Subtasks

- [x] Task 1: Add the minimal DU-auth domain model that later department stories can extend instead of replace (AC: 1, 3, 4, 5, 6, 8)
  - [x] Add a minimal tenant-owned `departments` table in `webapp/convex/schema.ts` with the smallest fields needed for DU authentication and later Epic 4 reuse: `tenantId`, a parent Procurement Officer reference, department name/code, active state, and the DU submission window fields used by this story.
  - [x] Add an app-owned DU access-code table such as `departmentAccessCodes` or `accessCodes` with `tenantId`, `departmentId`, an indexed normalized code hash, a user-facing code label or suffix, `expiresAt`, `isActive`, and audit-friendly timestamps.
  - [x] Add an app-owned DU profile table such as `departmentUserProfiles` that binds a `tenantUserId` to `departmentId`, stores the normalized verified email used as the permanent DU identifier, and tracks active/deactivated DU state without overloading the shared `tenantUsers` role table with DU-only fields.
  - [x] Add an app-owned DU login-attempt or lockout table keyed by `(normalizedEmail, accessCodeId)` so failed-attempt tracking stays email-specific and does not create a department-wide denial of service.
  - [x] Add canonical indexes for tenant scope, code lookup, department lookup, profile-by-tenant-user, profile-by-department-email, and active lockout lookup; do not rely on broad scans or plaintext code matching.

- [x] Task 2: Build a centralized backend DU access service on top of the existing auth, session, RBAC, tenant-isolation, and audit foundations (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
  - [x] Create a focused Convex module such as `webapp/convex/functions/departmentUserAuth.ts` that owns DU access-code validation, OTP challenge initiation/finalization, DU profile linking, and lockout handling.
  - [x] Reuse Story 1.7 tenant-isolation helpers and Story 1.6 authorization helpers so every DU lookup remains tenant-scoped and fail-closed.
  - [x] Normalize DU emails with the existing security helpers and normalize access codes into a canonical comparison form before hashing/lookup.
  - [x] Validate these checks in a single deterministic backend flow before OTP issuance: code exists, code is active, code not expired, tenant active, department active, DU submission window valid, DU profile not deactivated, current attempt not locked out, and the email does not collide with an incompatible existing application role assignment.
  - [x] Keep cross-tenant failures on safe not-found style outcomes at the backend where appropriate, while still returning the user-facing FR5/FR5a/FR5b messages from the DU auth surface.
  - [x] Record success and deny-path audit/security events using the existing audit helpers and stable dot-notation event naming rather than inventing a second audit path, for example `du.access_code.challenge_started`, `du.access_code.challenge_verified`, `du.access_code.invalid`, `du.access_code.locked_out`, and `du.access_code.deactivated`.

- [x] Task 3: Replace the current DU placeholder route with the real public DU authentication experience (AC: 1, 2, 3, 4, 5, 6, 7, 10, 11)
  - [x] Replace the placeholder implementation in `webapp/app/access/department-user/page.tsx` with the real DU access flow while preserving `PublicAccessGate` and the public-route contract introduced in Story 11.3.
  - [x] Add a dedicated DU auth component, for example `webapp/src/components/auth/DepartmentUserAccessForm.tsx`, instead of forcing DU users through the shared `LoginForm`.
  - [x] Preserve the existing `accessCode` query-param passthrough from `webapp/lib/auth/public-entry.ts` so deep-linked DU entry still prefills the code when present, but scrub the access code from the browser URL immediately after prefill and ensure it is not reused in analytics, referrers, or user-facing error logs.
  - [x] Keep the DU flow on the role-specific `/access/department-user` route; do not redirect DU users into `/signup` or the generic `/login` page.
  - [x] Implement a two-step DU UX: access-code and email entry first, OTP verification second, with clear empty, error, lockout, and deadline-window states that match the repo's current auth-message style.
  - [x] Use one neutral fail-closed collision message for incompatible-role and wrong-scope DU collisions: `This email can't be used for Department User access. Contact your Procurement Officer.` Do not expose whether the conflicting record is a PO, tenant admin, platform admin, or DU from another department.
  - [x] Add a clearly labeled non-blocking reminder affordance or placeholder note on the DU auth surface that preserves room for FR5c follow-up work without implying outbound reminder delivery already exists in this story.

- [x] Task 4: Integrate the DU OTP path with Convex Auth without creating a parallel session system (AC: 1, 7, 8, 9)
  - [x] Keep Convex Auth as the only source of authenticated session creation; do not invent custom cookies, JWTs, or browser-only auth state for DUs.
  - [x] Preferred implementation: add a dedicated DU-capable provider or provider-backed flow in `webapp/convex/auth.ts` that can issue a normal Convex Auth session after email OTP verification without requiring the user to create or manage a password.
  - [x] If a provider extension is needed, use the official Convex Auth server helpers and provider APIs rather than bypassing the auth library; the flow may use `signInViaProvider`/`createAccount`-style server primitives where appropriate.
  - [x] Introduce a short-lived server-tracked DU auth challenge or equivalent opaque bridge state so the verified email is bound to the previously validated access-code context before the DU role records are created or reused.
  - [x] Keep the sequencing explicit and deterministic: validate code and email -> create DU auth challenge -> verify OTP against that challenge -> create or reuse the DU membership/profile -> initialize the normal session metadata path from Story 1.5 -> redirect through the role-aware auth context to `/du`.

- [x] Task 5: Materialize DU identity and later-proof the authorization surface (AC: 1, 6, 8, 9, 10)
  - [x] Keep `tenantUsers` as the canonical shared role-assignment table from Story 1.6 and create the `department_user` membership only after OTP verification succeeds.
  - [x] Add a DU-specific backend helper such as `requireDepartmentUserAccess(...)` that composes `requireTenantRole(...)` with the DU profile record and returns the resolved `departmentId` for future DU stories.
  - [x] Make the authenticated DU auth context expose a canonical `departmentId` plus the resolved `tenantId`. If `departmentId` is not stored directly on `tenantUsers`, then the DU profile/association record introduced by this story is mandatory and becomes the authoritative source for resolving `departmentId`.
  - [x] Fail closed if a `department_user` role exists without a matching DU profile, or if a DU profile points to a missing/foreign department.
  - [x] Fail closed if the verified DU email already belongs to an incompatible active application role or to a DU record in a different department or tenant. Story 1.6's single-active-role invariant still applies.
  - [x] Standardize collision failures on one neutral backend error contract that maps to the user-facing message `This email can't be used for Department User access. Contact your Procurement Officer.` and does not leak which conflicting record caused the deny path.
  - [x] Preserve Story 1.5 concurrent-session behavior: multiple DU sessions may exist, but abuse detection should audit unusually high concurrent usage for the same access code instead of silently ignoring it.
  - [x] Expose a backend-readable DU access mode such as `editable` vs `read_only_grace` so later DU pages can honor the Epic 1 grace-period rule without re-deriving the window logic.

- [x] Task 6: Add deterministic test coverage for DU code validation, OTP handoff, lockout, and auth regressions (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
  - [x] Add pure helper tests for code normalization, code-hash lookup behavior, deadline-window evaluation, grace-mode calculation, and lockout timing.
  - [x] Add backend-first tests for first-time DU access, returning DU access, mismatched returning email, inactive DU profile, expired code, invalid code, inactive tenant, before-start window, after-end window, and lockout reset after a successful verification.
  - [x] Add tests proving lockout is scoped to `(normalizedEmail, accessCodeId)` and does not block a different email using the same department code.
  - [x] Extend current public-entry tests so `/access/department-user` remains the stable DU continuation route and authenticated users are still redirected away from the public entry flow.
  - [x] Add regression tests that confirm Stories 1.3 through 1.7 still behave correctly: generic `/login` remains email/password for existing eligible roles, role resolution still uses the current auth context, tenant isolation still guards cross-tenant DU access, and session-expiry behavior remains unchanged.
  - [x] Add tests for incompatible-role collisions, deactivated DU messaging, grace-mode read-only access after deadline, and access-code URL scrubbing after the initial DU form prefill.

## Dev Notes

### Story Foundation

- Epic 1 maps this story to FR5 and FR5a through FR5h. This is the first story that makes the Department User path actually usable after Story 11.3 reserved the public DU route.
- Story 1.8 depends directly on Story 1.5 session management, Story 1.6 RBAC, Story 1.7 tenant isolation, and Story 11.3's `/access/department-user` route contract.
- The implementation goal is not just "a form that accepts a code." The goal is a production-shaped DU authentication flow that safely binds a verified identity to a department and tenant without introducing a second auth system.
- The hierarchy for this story is explicit and must stay explicit in the implementation: `tenant` -> `procurement_officer` -> `department` -> `department_user`. Departments are first-class records under both a tenant and a parent Procurement Officer, and Departmental Users inherit their effective tenant scope through the department they belong to.

### Current Implementation State Discovered In Code

- `webapp/app/access/department-user/page.tsx` is still a placeholder page that only preserves the `accessCode` query param and renders `RoleAccessComingSoon`.
- `webapp/lib/auth/public-entry.ts` already treats `/access/department-user` as the stable DU continuation route and preserves the `accessCode` query param through the public access hub.
- `webapp/lib/auth/public-routes.ts` already registers `/access/department-user` as a public route, so Story 1.8 should extend that route instead of introducing a new public DU URL.
- `webapp/src/components/auth/LoginForm.tsx` is the shared email/password sign-in for existing eligible accounts. It should remain unchanged for tenant-admin, procurement-officer, and other shared-login users.
- `webapp/convex/schema.ts` currently has no `departments`, `accessCodes`, DU profile, or DU login-attempt tables. The only app-owned role table is `tenantUsers`, and it has no current field or linked association that resolves a canonical DU `departmentId`.
- `webapp/convex/auth.ts` currently configures only the `Password` provider. The repo does not yet expose a DU-specific passwordless provider or challenge flow.
- `webapp/convex/functions/sessions.ts`, `webapp/convex/functions/_roleGuard.ts`, `webapp/convex/functions/_tenantGuard.ts`, and `webapp/convex/functions/auditLogs.ts` already provide the server-authoritative session, role, tenant, and audit foundations this story should reuse.
- `webapp/lib/security/input.ts` and `webapp/lib/validators/auth.ts` already provide shared email and OTP input validation that the DU flow should extend rather than duplicate.

### Reuse And Anti-Reinvention Guidance

- Reuse Story 11.3's DU route and query-param helpers; do not create a second public DU path.
- Reuse Story 1.6's `tenantUsers` role model and guard helpers; do not invent a separate role store for DUs.
- Reuse Story 1.7's fail-closed tenant-isolation and audit patterns; DU access validation must remain tenant-scoped from the start.
- Reuse Story 1.5's session metadata and redirect model so successful DU auth ends in the same `getAuthContext` and protected-app shell behavior as the rest of the application.
- Reuse the existing security helpers for email and OTP validation. Do not hand-roll regexes or duplicate the current auth validation rules inside the DU form.
- Reuse the current public-entry UX language and message style. Do not send DUs through generic "sign up" copy or tenant-admin terminology.
- Keep the current shared `/login` route focused on email-and-password users. DU auth remains on `/access/department-user` and must not fork or dilute the existing login path.

### Security And Scope Boundaries

- Do not store plaintext department access codes in the database. Store a normalized hash plus a non-sensitive display suffix or label for operator-facing views.
- Do not broaden this story into the full PO department-management UI, full access-code generation UI, or full deadline-management screens from Epic 4. A narrow seed/internal setup path or test fixture support is acceptable if needed for this story.
- Do not require DUs to create a password, visit `/signup`, or use the shared `/login` path to complete DU authentication.
- Do not implement a browser-only OTP or session system. Convex Auth must remain the session authority.
- Do not lock an entire department code because one email failed repeatedly. Lockout is per `(normalizedEmail, accessCodeId)` as required by the Epic 1 technical notes.
- Do not let a verified DU email silently move between departments or tenants. Returning DU email plus department binding must remain stable unless a future PO-managed reassignment story explicitly changes it.
- Any missing or corrupted tenant, department, code, or DU profile linkage is a fail-closed security condition and should be audited.
- Do not leave raw access codes lingering in the browser address bar after prefill or leak them through analytics, referrer headers, or verbose client/server logs.
- The broader requirements set still includes FR5c (`DU can request access code reminder from PO via system`), but this story explicitly defers outbound reminder delivery to follow-up scope. Story 1.8 only needs a narrow reminder-request extension point or placeholder note so FR5c remains visible in the backlog and is not mistaken as completed here.

### Technical Requirements

- Add the smallest reusable domain model needed for DU auth now:
  - `departments`
  - `departmentAccessCodes` or `accessCodes`
  - `departmentUserProfiles`
  - `departmentUserLoginAttempts` or `loginAttempts`
- Hierarchy requirements:
  - each department is a first-class record under a tenant and a parent Procurement Officer,
  - each DU belongs to exactly one department for this story's authenticated access context,
  - the DU's effective tenant scope is derived through that department,
  - authenticated DU context must resolve both `departmentId` and `tenantId`.
- Bootstrap/setup requirements:
  - because Epic 4 department and access-code management screens do not exist yet, this story must define a narrow internal-only setup path, seed path, or test fixture path for creating departments and DU access codes in development and automated tests,
  - that bootstrap path must stay internal-only and must not become a public workaround that bypasses the future PO-managed provisioning flow.
- Access-code storage requirements:
  - normalize user-entered codes before lookup,
  - store and compare a hash, not raw code,
  - keep the user-facing format from the epic (`[FiscalYear]-[DeptInitials]-[RandomChars]`),
  - support explicit expiration and active/inactive toggling.
- DU identity requirements:
  - first successful verified access creates a `tenantUsers` record with role `department_user`,
  - a matching DU profile or equivalent mandatory association binds that role record to the department and normalized verified email,
  - returning access reuses the existing DU role/profile instead of creating duplicates,
  - deactivation lives in the app-owned DU profile path, not in auth-provider-only state,
  - if the implementation keeps `tenantUsers` free of DU-specific fields, then the DU profile is required and cannot be optional because it is the authoritative department binding.
- OTP/auth requirements:
  - the DU flow must end with a normal Convex Auth session,
  - the DU auth bridge between "code validated" and "OTP verified" must be short-lived and server-tracked,
  - the verified email and validated code context must be bound together before role/profile creation.
- Deadline-window requirements:
  - before start => explicit "not started yet" message,
  - active window => normal DU sign-in,
  - after end => explicit "submission period has ended" message,
  - the backend must surface a durable read-only grace mode flag for the 30-minute post-deadline window so later DU stories can honor the rule without re-deriving it.
- Lockout requirements:
  - 5 failed attempts => 15-minute lockout,
  - successful verification resets the failure counter,
  - the same department code may still be used by another email unless that email-code pair is independently locked.
- Role-collision requirements:
  - if the verified email already belongs to a non-DU active application role, the flow must fail closed with an explicit unsupported-account path instead of creating a second active role,
  - if the verified email already belongs to a DU record in a different department or tenant, the flow must fail closed and require an explicit future reassignment path rather than auto-moving the user,
  - all incompatible-role and wrong-scope collisions must map to the same neutral user-facing message: `This email can't be used for Department User access. Contact your Procurement Officer.`,
  - collision handling must not reveal whether the conflict came from a PO, tenant admin, platform admin, or another DU record.
- Audit requirements:
  - log invalid/expired/deactivated/locked/out-of-window attempts,
  - log successful DU access completion,
  - follow the existing dot-notation audit naming pattern and existing append helpers,
  - use stable event names for this story's core transitions, for example `du.access_code.challenge_started`, `du.access_code.challenge_verified`, `du.access_code.invalid`, `du.access_code.expired`, `du.access_code.locked_out`, `du.access_code.deactivated`, and `du.access_code.tenant_inactive`.

### Architecture Compliance

- Follow the actual versions installed in `webapp/package.json`, not the older broad summaries in `_bmad-output/project-context.md`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
- Keep the current Next.js 16 `proxy.ts` convention. Do not reintroduce `middleware.ts`.
- Keep secure DU auth checks close to Convex data and auth state. The public DU page can shape UX, but backend validation remains the security boundary.
- Keep `tenantUsers` as the shared role-assignment layer and layer DU-specific department binding on top of it. This avoids corrupting the cross-role model established in Story 1.6.
- Keep tenant isolation in Convex-backed helpers, not in client-only query params or route conventions.

### Library And Framework Requirements

- Convex Auth
  - Keep Convex Auth as the final session issuer for DU sign-in.
  - Use the official server helpers (`getAuthUserId`, `getAuthSessionId`) and provider-backed flows rather than inventing a parallel auth mechanism.
  - Official Convex Auth server docs expose `signInViaProvider` and `createAccount`, which are the right extension points if a DU-specific provider-backed flow is added.
  - Official Convex Auth docs also expose `signIn.maxFailedAttemptsPerHour` with a default of 10 failed attempts per hour; that is not sufficient to satisfy FR5d's stricter `(email + code)` 5-attempt, 15-minute lockout, so the DU-specific lockout remains app-owned.
- Convex database and functions
  - Use indexed lookups (`withIndex(...)`) for code hashes, tenant-user membership, and DU profile resolution.
  - Use `ConvexError` for expected backend failures and keep deny-path behavior deterministic.
- Next.js App Router
  - Keep the DU public route server-first where possible; use a small client component for the interactive DU form and OTP step.
  - Continue treating page `searchParams` as the async App Router prop shape used by the current repo.
- Existing frontend stack
  - Use the existing shadcn/ui components, RHF, and Zod patterns already used in the auth screens.
  - Keep the DU experience visually aligned with the current public access and auth surfaces.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/access/department-user/page.tsx`
  - `webapp/convex/auth.ts`
  - `webapp/convex/schema.ts`
  - `webapp/lib/auth/public-entry.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/_roleGuard.ts`
- Expected new files (recommended):
  - `webapp/src/components/auth/DepartmentUserAccessForm.tsx`
  - `webapp/lib/auth/department-user-access.ts`
  - `webapp/convex/functions/departmentUserAuth.ts`
  - `webapp/tests/department-user-access.test.ts`
- Optional new backend helpers if needed:
  - `webapp/convex/functions/_departmentUserGuard.ts`
  - a narrowly scoped challenge helper module for DU OTP handoff
- Keep DU-auth logic in auth, backend, and route modules. Do not scatter the domain rules across marketing components or unrelated dashboard placeholders.

### Testing Requirements

- Add helper tests for:
  - access-code normalization,
  - code-hash lookup behavior,
  - deadline-window and grace-mode resolution,
  - lockout timing and reset behavior.
- Add backend-first tests for:
  - valid first-time DU access,
  - valid returning DU access,
  - invalid code,
  - expired/inactive code,
  - inactive tenant,
  - inactive/deactivated DU profile,
  - before-start and after-end windows,
  - mismatched returning email,
  - fail-closed missing-department or missing-profile states.
- Add route/UI regression tests for:
  - `/access/department-user` remains public,
  - `accessCode` query passthrough still works,
  - authenticated users still redirect away from the public DU route,
  - generic `/login` behavior for other roles is unchanged.
  - incompatible-role and wrong-scope collisions both render the same neutral user-facing message without leaking record-type details,
  - any FR5c reminder affordance shown by this story is clearly marked as deferred follow-up behavior rather than a completed outbound reminder flow.
- Add auth/session regression coverage showing:
  - DU completion ends in the normal role-aware auth context,
  - Story 1.5 session-expiry handling still applies,
  - Story 1.6 role resolution still denies wrong-role access,
  - Story 1.7 tenant-isolation helpers still block cross-tenant probes.

### Previous Story Intelligence

- Story 11.3 already established `/access/department-user` as the stable public DU continuation contract and preserves `accessCode` across the public access hub.
- Story 1.7 already centralized fail-closed tenant isolation, audited bypass rules, and tenant-scoped helper patterns. DU access must be layered on top of those helpers from day one.
- Story 1.6 already established `tenantUsers` as the canonical tenant-role table and `getAuthContext` as the canonical role-resolution surface. Story 1.8 should extend that model, not fork it.
- Story 1.5 already established session metadata, current-session validity, and the post-auth redirect model. Successful DU auth should flow into that same session lifecycle rather than inventing a separate path.

### Git Intelligence Summary

- Commit `83f07c3` (March 12, 2026) created the current public access hub, the `/access/department-user` placeholder route, and the centralized `public-entry.ts` helper. Story 1.8 should build directly on that public-entry contract.
- Commit `3181fec` (March 9, 2026) introduced the current security input validation and audit logging modules. DU access should reuse those helpers for email, OTP, and deny-path auditing rather than writing a new security layer.
- Recent auth work is concentrated in:
  - `webapp/convex/auth.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/_tenantGuard.ts`
  - `webapp/lib/auth/public-entry.ts`
- The current repo pattern is clear: centralize backend enforcement in pure/shared helpers, keep route pages thin, and back behavior with deterministic tests in `webapp/tests`.

### Latest Tech Information

- Verified March 12, 2026 against official documentation:
  - Next.js App Router page files continue to use `searchParams` as an async prop shape in current docs, which matches the existing repo pattern already used by `/access` and `/pricing`.
  - Next.js authentication guidance continues to recommend keeping secure authorization close to the data source, while Proxy is for optimistic checks and shaping request behavior. That supports keeping DU access validation in Convex helpers, not in `proxy.ts`.
  - Convex Auth server docs continue to expose `getAuthUserId`, `getAuthSessionId`, `createAccount`, and `signInViaProvider`, which are the official extension points if the DU OTP flow needs a dedicated provider-backed auth path.
  - Convex Auth server docs still expose global sign-in rate limiting with `signIn.maxFailedAttemptsPerHour`, defaulting to 10 failed attempts per hour. Story 1.8 still needs its own app-owned FR5d lockout because the requirement is stricter and scoped to `(email + access code)`.
  - Convex database docs continue to recommend `withIndex(...)` queries so access-code and DU-profile lookups should be built on explicit indexes, not full-table filtering.

### Project Context Reference

- Apply the durable project-context rules that still match the live repo:
  - strict TypeScript,
  - path-alias imports,
  - Convex-first auth and data enforcement,
  - RHF + Zod + shadcn/ui for forms,
  - backend-first security decisions.
- Where `_bmad-output/project-context.md` conflicts with the live repo, prefer the live repo structure and current package versions.

### Project Structure Notes

- Current repo alignment:
  - public auth entry routes live under `webapp/app/access/...`,
  - shared auth pages live under `webapp/app/(auth)/...`,
  - protected DU landing lives under `webapp/app/(app)/du/page.tsx`,
  - backend auth/session/role/tenant helpers live under `webapp/convex/functions/...`,
  - shared auth/security helpers live under `webapp/lib/auth/...` and `webapp/lib/security/...`.
- Detected gaps this story must close:
  - the public DU route exists but is still only a placeholder,
  - there is no department or access-code schema yet,
  - there is no DU-specific passwordless auth bridge in the current Convex Auth configuration,
  - there is no current department binding for `department_user` memberships.

### References

- [Sprint Status](./sprint-status.yaml)
- [Epic 1 Source](./epics/epic1/epic-01-foundation-authentication.md)
- [Story 11.3 Public Entry](./11-3-public-role-based-auth-entry.md)
- [Project Context](../project-context.md)
- [PRD](../planning-artifacts/prd.md)
- [Architecture](../planning-artifacts/architecture.md)
- [UX Design](../planning-artifacts/ux-design-specification.md)
- [Current Package Versions](../../webapp/package.json)
- [Current DU Public Route](../../webapp/app/access/department-user/page.tsx)
- [Current Public Access Hub](../../webapp/app/access/page.tsx)
- [Current Public Entry Helpers](../../webapp/lib/auth/public-entry.ts)
- [Current Public Route Registry](../../webapp/lib/auth/public-routes.ts)
- [Current Auth Config](../../webapp/convex/auth.ts)
- [Current Convex Schema](../../webapp/convex/schema.ts)
- [Current Role Guard](../../webapp/convex/functions/_roleGuard.ts)
- [Current Session Helpers](../../webapp/convex/functions/sessions.ts)
- [Current Tenant Guard](../../webapp/convex/functions/_tenantGuard.ts)
- [Current Login Form](../../webapp/src/components/auth/LoginForm.tsx)
- [Current Shared Auth Validators](../../webapp/lib/validators/auth.ts)
- [Current Shared Security Input Helpers](../../webapp/lib/security/input.ts)
- [Current Audit Helpers](../../webapp/lib/security/audit.ts)
- [Current Audit Mutation Surface](../../webapp/convex/functions/auditLogs.ts)
- [Next.js Page `searchParams` Docs](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Convex Database Indexes](https://docs.convex.dev/database/reading-data/indexes/)
- [Convex Error Handling](https://docs.convex.dev/functions/error-handling/)
- [Convex Auth Server API](https://raw.githubusercontent.com/get-convex/convex-auth/main/docs/pages/api_reference/server.mdx)

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
  - `_bmad-output/implementation-artifacts/epics/epic1/epic-01-foundation-authentication.md`
  - `_bmad-output/implementation-artifacts/11-3-public-role-based-auth-entry.md`
- Previous story sources:
  - `_bmad-output/implementation-artifacts/epics/epic1/completed/1-5-session-management-logout.md`
  - `_bmad-output/implementation-artifacts/epics/epic1/completed/1-6-four-layer-role-based-access-control.md`
  - `_bmad-output/implementation-artifacts/epics/epic1/completed/1-7-tenant-data-isolation.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/app/access/page.tsx`
  - `webapp/app/access/department-user/page.tsx`
  - `webapp/app/(auth)/login/page.tsx`
  - `webapp/app/(app)/du/page.tsx`
  - `webapp/convex/auth.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/_tenantGuard.ts`
  - `webapp/convex/functions/auditLogs.ts`
  - `webapp/convex/functions/securityAudit.ts`
  - `webapp/lib/auth/public-entry.ts`
  - `webapp/lib/auth/public-routes.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/lib/auth/session.ts`
  - `webapp/lib/auth/tenant-isolation.ts`
  - `webapp/lib/security/input.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/lib/validators/auth.ts`
  - `webapp/src/components/auth/LoginForm.tsx`
  - `webapp/src/components/auth/PublicAccessGate.tsx`
  - `webapp/tests/public-auth-entry.test.ts`
- Git context:
  - `git log -5 --pretty=format:"%h %ad %s" --date=short`
  - `git show --stat --format=medium -1 HEAD`
  - `git show --stat --format=medium 3181fec`
- External validation sources:
  - `https://nextjs.org/docs/app/api-reference/file-conventions/page`
  - `https://nextjs.org/docs/app/guides/authentication`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://docs.convex.dev/functions/error-handling/`
  - `https://raw.githubusercontent.com/get-convex/convex-auth/main/docs/pages/api_reference/server.mdx`

### Completion Notes List

- 2026-03-12: Identified `1-8-du-access-code-authentication` in sprint status as the next backlog story needing a dedicated implementation artifact.
- 2026-03-12: Loaded Epic 1, Story 11.3, the project context, PRD, architecture, UX design, prior auth stories, current auth/session/tenant helpers, and the DU public route implementation before drafting the story.
- 2026-03-12: Anchored the story to the existing `/access/department-user` route contract so implementation extends Story 11.3 instead of redesigning public entry.
- 2026-03-12: Explicitly called out that the current repo has no department, access-code, DU-profile, or DU-lockout schema yet, so Story 1.8 must create the minimal reusable domain model now.
- 2026-03-12: Documented that Convex Auth must remain the session authority for the DU flow and that FR5d lockout must stay app-owned instead of relying only on global auth-provider rate limiting.
- 2026-03-13: Implemented the DU access-code authentication data model, including `departments`, hashed `departmentAccessCodes`, `departmentUserProfiles`, DU login-attempt tracking, and short-lived DU auth challenges for OTP handoff.
- 2026-03-13: Added `webapp/convex/functions/departmentUserAuth.ts` and wired a dedicated credentials-backed DU flow into `webapp/convex/auth.ts` so access-code validation, OTP verification, DU profile binding, lockout checks, and audit logging all stay in the existing Convex auth/session model.
- 2026-03-13: Replaced the `/access/department-user` placeholder with a two-step DU auth experience that preserves deep-link code prefill, scrubs `accessCode` from the browser URL after hydration, surfaces fail-closed collision and lifecycle messages, and keeps the FR5c reminder affordance explicitly deferred.
- 2026-03-13: Extended DU authorization resolution with `requireDepartmentUserAccess(...)`, department-aware auth context support in `_roleGuard.ts`, and tenant-isolation metadata for the new DU-owned tables.
- 2026-03-13: Added deterministic DU helper and route regression coverage, regenerated Convex types with `npx convex codegen --typecheck disable`, and verified the implementation with `npm test` and `npm run lint`.
- 2026-03-14: Applied code-review fixes for FR5d and AC 6 by keying DU login attempts on `(normalizedEmail, accessCodeHash)` so invalid access codes are rate-limited, catching thrown OTP verification failures so failed attempts are recorded before lockout messaging is returned, and restoring the exact `Submission period has ended.` copy during grace-mode messaging.
- 2026-03-14: Added an explicit `du.access_code.data_integrity_blocked` audit path for active DU role/profile integrity failures, kept those failures fail-closed to the neutral DU collision message, and blocked silent repair of corrupted existing DU role bindings during sign-in finalization.
- 2026-03-14: Manually smoke-tested the live DU route over the running Next.js dev server at `/access/department-user` and exercised the live Convex `startAccessChallenge` action against the dev deployment to confirm invalid-code attempts lock on the 5th try for the same email+code pair while a different email using the same invalid code still receives only `Invalid access code`.
- 2026-03-14: Removed the root `next/font/google` dependency from `webapp/app/layout.tsx` so `npm run build` no longer depends on fetching Inter from Google Fonts during CI or offline validation; production build and lint now both pass locally.

### File List

- `_bmad-output/implementation-artifacts/1-8-du-access-code-authentication.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/app/layout.tsx`
- `webapp/app/access/department-user/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/auth.ts`
- `webapp/convex/functions/_departmentUserGuard.ts`
- `webapp/convex/functions/_roleGuard.ts`
- `webapp/convex/functions/departmentUserAuth.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/auth/department-user-access.ts`
- `webapp/lib/auth/tenant-isolation.ts`
- `webapp/lib/errors/convex.ts`
- `webapp/lib/security/audit.ts`
- `webapp/lib/security/input.ts`
- `webapp/lib/validators/auth.ts`
- `webapp/src/components/auth/DepartmentUserAccessForm.tsx`
- `webapp/tests/convex-error-handling.test.ts`
- `webapp/tests/department-user-access.test.ts`
- `webapp/tests/public-auth-entry.test.ts`
- `webapp/tests/run-tests.ts`

### Story Completion Status

- Story ID: `1.8`
- Story Key: `1-8-du-access-code-authentication`
- Output File: `_bmad-output/implementation-artifacts/1-8-du-access-code-authentication.md`
- Final Status: `review`
- Completion Note: `DU access-code authentication review fixes applied, including invalid-code brute-force lockout coverage, OTP failure lockout enforcement, exact AC 6 messaging, data-integrity auditing, and manual runtime verification`
