# Story 1.7: Tenant Data Isolation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tenant user,
I want complete data isolation between tenants,
so that my organization's data is never visible to other organizations.

## Acceptance Criteria

1. [Given] the multi-tenancy foundation from Stories 1.2 through 1.6 is in place [When] any tenant-scoped Convex query or mutation reads or writes tenant-owned data, including single-record, list, batch, count, and existence-check paths [Then] the effective tenant scope is derived server-side from the authenticated actor [And] tenant users can only access data that belongs to their own tenant.
2. [Given] a tenant user attempts to access another tenant's data through URL manipulation, direct document IDs, forged request payloads, or a record whose tenant ownership metadata is missing or corrupt [When] the request is processed [Then] the system responds with safe not-found semantics instead of revealing whether the target record exists [And] the attempt is recorded as a tenant-isolation security event.
3. [Given] a developer adds or updates a Convex function that touches tenant-owned tables [When] they implement the data access path [Then] they must use centralized tenant-guard helpers and tenant-scoped indexes instead of ad hoc filtering or direct raw-ID reads [And] the approved helper surface introduced in this story makes unsupported unscoped access a TypeScript failure for the tenant-owned tables covered by that helper API.
4. [Given] a Platform Admin performs an explicitly allowed cross-tenant read for support or platform operations [When] the request is processed [Then] the bypass is intentional, read-only, limited to platform-admin paths, and logged in the audit trail [And] tenant-only helper paths still reject platform-admin contexts by default.
5. [Given] tenant-isolation guardrails are introduced before the broader procurement tables exist [When] the current auth, tenant, and session flows are updated [Then] Story 1.2 through Story 1.6 behavior continues to work without regression [And] the codebase gains reusable tenant-isolation patterns that later stories must extend instead of replacing.
6. [Given] a user's tenant membership is revoked, deactivated, or changed while they still have an active session [When] they make their next tenant-scoped request [Then] the latest server-side tenant relationship is enforced immediately [And] stale session state cannot preserve prior tenant visibility.

## Tasks / Subtasks

- [x] Task 1: Define the canonical tenant-isolation model and current table classification (AC: 1, 3, 5)
  - [x] Identify which current tables are tenant-scoped, platform-scoped, or global-only in `webapp/convex/schema.ts`; at minimum treat `tenantUsers` as tenant-scoped, `platformUsers` as platform-scoped, and `sessionMetadata` / `subscriptionTiers` as non-tenant tables that must not be forced into fake tenant ownership.
  - [x] Introduce a single tenant-isolation helper surface such as `webapp/convex/functions/_tenantGuard.ts` that builds on Story 1.6's auth context and becomes the only approved backend entry point for tenant-owned data access.
  - [x] Define the MVP rule that all future tenant-owned tables must include a real `tenantId` field plus a canonical tenant index and must be accessed through the tenant-guard helper layer.

- [x] Task 2: Implement backend tenant-guard and not-found semantics (AC: 1, 2, 3, 4)
  - [x] Reuse `requireTenantRole`, `requirePlatformAdmin`, and `getAuthorizationContext` from Story 1.6 instead of introducing a parallel auth/tenant state model.
  - [x] Add helper functions that distinguish tenant-only access, explicit platform-admin bypass access, and safe not-found responses for cross-tenant probes.
  - [x] Ensure tenant-only helper paths hard-fail for platform-admin contexts unless a platform-admin-specific bypass helper is used intentionally.
  - [x] Fail closed when a supposedly tenant-owned record has no `tenantId`, an invalid `tenantId`, or tenant ownership metadata that cannot be verified against the current auth context.
  - [x] Apply the same tenant-isolation rules to collection and aggregate paths such as list queries, multi-ID loads, counts, and existence checks so those paths cannot leak cross-tenant presence indirectly.
  - [x] Centralize the "404-style, do not enumerate tenant existence" behavior so future route handlers and page loaders can reuse the same outcome instead of mixing `403` and `404` inconsistently.

- [x] Task 3: Harden the current Convex data-access surface without inventing future domains (AC: 1, 2, 3, 4, 5, 6)
  - [x] Update `webapp/convex/functions/tenants.ts#getById` so callers cannot read arbitrary tenant records by supplying another tenant's ID.
  - [x] For tenant-owned tables covered by this story, ban direct raw `ctx.db.get(id)` access from feature functions unless the read first passes through a tenant-guard helper that validates ownership or applies explicit platform-admin read bypass rules.
  - [x] Review current tenant-aware queries and mutations in `webapp/convex/functions/users.ts`, `webapp/convex/functions/sessions.ts`, and related helpers to confirm they derive tenant context from the server-side auth path and not from client input.
  - [x] If a current or future mutation accepts arrays, nested objects, or multiple tenant-owned IDs, require validation of every referenced tenant-owned identifier rather than only checking the top-level auth context once.
  - [x] Preserve public registration and pre-role flows such as `registerWithTenant` and `isEmailVerified`; they run before a tenant role exists and must not be broken by the new guard layer.
  - [x] Do not fabricate departments, categories, items, plans, or billing entities in this story just to demonstrate tenant isolation. Establish the guardrails on the tables and functions that already exist.

- [x] Task 4: Add minimal auditability for isolation-sensitive access paths (AC: 2, 4)
  - [x] Introduce the smallest append-only audit/security event mechanism needed to record blocked cross-tenant probes and allowed platform-admin cross-tenant reads.
  - [x] Use stable event names and a minimum event payload that includes actor user ID, actor role, source tenant context when applicable, target tenant context when known, table or entity type, record identifier when known, attempted action, outcome, and timestamp, while keeping the scope narrow to tenant-isolation events in this story.
  - [x] Ensure audit writes do not leak the protected target back to tenant users in the response path.
  - [x] Define failure behavior for audit writes: blocked cross-tenant probes must still deny access even if logging fails, and explicit platform-admin bypass reads must not silently proceed without the configured audit trail.

- [x] Task 5: Establish index and helper patterns that prevent unscoped tenant queries (AC: 1, 3, 5)
  - [x] Add or normalize canonical tenant indexes for the current tenant-scoped tables without breaking existing callers; preserve any still-used legacy index names during migration.
  - [x] Prefer helper functions that require tenant context up front and internally issue `withIndex(...)` queries, rather than exposing raw table-query patterns everywhere.
  - [x] Where "TypeScript compilation fails if tenantId filter is missing" is claimed, scope that guarantee to the helper API introduced in this story and back it with compile-checked tests or fixtures instead of relying on code review alone.
  - [x] Make the typed helper surface strong enough that tenant-owned resource access uses branded or wrapper-mediated types instead of plain raw document IDs wherever this story introduces new helper APIs.

- [x] Task 6: Add regression coverage for tenant isolation, platform bypass, and not-found behavior (AC: 1, 2, 3, 4, 5, 6)
  - [x] Add backend-first tests covering same-tenant access, cross-tenant access denial, platform-admin bypass, inactive/misconfigured auth contexts, and unchanged session behavior from Story 1.5.
  - [x] Add tests proving that blocked cross-tenant reads produce safe not-found semantics while unauthenticated or wrong-role requests still produce unauthorized behavior.
  - [x] Add compile-checked coverage for the new helper API so unsupported unscoped tenant access patterns fail the test/build pipeline.
  - [x] Add explicit regression cases for corrupted or missing `tenantId` values on tenant-owned records and for tenant membership being revoked between two otherwise valid protected requests.

## Dev Notes

### Story Foundation

- Epic 1 ties this story directly to FR7 and NFR-S1: complete tenant data isolation is a hard security boundary, not an optional optimization.
- This story is the data-layer counterpart to Story 1.6. Story 1.6 established "who are you and what role do you have"; Story 1.7 establishes "what tenant-owned records are you allowed to see once that role is known."
- Story 1.8 DU access-code authentication and every later tenant feature depend on these guardrails being correct before more tables and dashboards are added.
- The primary outcome is a reusable tenant-isolation enforcement layer plus regression coverage, not a broad rollout of procurement CRUD.

### Current Implementation State Discovered In Code

- Story 1.6 already centralized role resolution in `webapp/convex/functions/_roleGuard.ts` and established the canonical role map in `webapp/lib/auth/roles.ts`.
- `webapp/convex/schema.ts` currently has only one app-owned tenant-scoped relation table, `tenantUsers`, plus the root `tenants` table. `platformUsers` is global to platform admins, while `sessionMetadata` and `subscriptionTiers` are not tenant-owned tables.
- `webapp/convex/functions/users.ts#getCurrentUserTenant` already derives tenant context from `requireTenantRole(ctx)` and then queries `tenantUsers` by `(userId, tenantId)`. This is the current safe pattern to extend.
- `webapp/convex/functions/tenants.ts#getById` currently accepts an arbitrary `tenantId` argument and returns the tenant document directly with no tenant-ownership check. That is the clearest current isolation gap in the codebase.
- There is no app-owned audit/security event table yet for recording blocked cross-tenant probes or platform-admin bypass access.

### Reuse And Anti-Reinvention Guidance

- Reuse Story 1.6's `getAuthorizationContext`, `requireTenantRole`, and `requirePlatformAdmin`. Do not introduce a second auth context, a second role map, or client-side tenant resolution.
- Reuse the existing fail-closed posture from `resolveRoleRecords(...)` in `webapp/lib/auth/roles.ts`. Tenant isolation must inherit the same "misconfigured means blocked" rule.
- Reuse the existing session-validity model from Story 1.5 through `loadCurrentSessionState(...)`; isolation checks must compose with session enforcement instead of bypassing it.
- Prefer one centralized `_tenantGuard.ts` module over repeated `if (tenantId !== authContext.tenantId)` checks scattered across feature functions.
- Extend existing Convex patterns and tests rather than inventing a NestJS service, route-middleware layer, or client-only filter for tenant isolation.

### Security And Scope Boundaries

- Never trust a client-provided `tenantId` as proof of access. The authenticated server-side context is authoritative.
- Cross-tenant probe handling must not disclose whether the target tenant or record exists. Tenant users should observe not-found semantics, not a helpful authorization message that confirms the target is real.
- Unauthenticated access and wrong-role access are still authorization failures. Do not flatten all failures into 404; only return safe not-found semantics for authenticated cross-tenant probes against tenant-owned resources.
- Platform-admin cross-tenant access must be explicit, auditable, and rare. Tenant-only helpers should reject platform-admin contexts by default.
- Platform-admin bypass in this story is read-only. Do not use the bypass helper surface for cross-tenant writes, deletes, or state-changing mutations.
- Missing or corrupted ownership metadata on a tenant-owned record is a security condition. Treat it as blocked access and log it; do not guess a tenant or fall back to permissive behavior.
- Do not solve this story by pushing tenant logic into `proxy.ts`, App Router layout guards, or URL conventions. Enforce it in Convex queries/mutations and shared backend helpers.
- Do not fabricate future procurement tables just to "show" tenant isolation. Build the enforcement primitives now so later stories can adopt them immediately.

### Technical Requirements

- Introduce a dedicated backend tenant guard module, e.g. `webapp/convex/functions/_tenantGuard.ts`, that builds on Story 1.6's authorization context instead of replacing it.
- Classify current tables explicitly:
  - `tenantUsers`: tenant-scoped.
  - `tenants`: tenant-root record, readable by same-tenant users and explicitly by platform admins.
  - `platformUsers`: platform-scoped only.
  - `sessionMetadata` and `subscriptionTiers`: global/non-tenant-owned; do not add fake `tenantId` fields to these tables.
- All current and future tenant-owned tables must have a real `tenantId` field plus a canonical tenant index. For already-existing tables, preserve any still-used legacy index names if you add a new canonical name.
- Provide centralized helpers for:
  - resolving the current tenant context,
  - asserting that a requested tenant-owned resource belongs to the authenticated tenant,
  - performing explicit platform-admin bypass reads,
  - returning safe not-found outcomes for blocked cross-tenant probes,
  - validating collection, batch, and nested-reference access paths with the same tenant rules used for single-record reads.
- The centralized helper surface must make direct raw-ID reads of tenant-owned records an anti-pattern. Prefer helper-mediated resource loads that validate ownership before returning documents.
- Do not claim "compile-time failure if tenant filtering is missing" unless the helper API introduced in this story actually enforces that pattern via types and the test/build pipeline proves it.
- Platform-admin bypass helpers must be read-only by contract and naming; if a future story needs cross-tenant writes, that must be specified and reviewed separately.
- Introduce the smallest append-only audit mechanism necessary to record:
  - blocked cross-tenant probe attempts,
  - allowed platform-admin cross-tenant reads.
- Audit events in this story must carry a minimum consistent shape: actor user ID, actor role, source tenant context when applicable, target tenant context when known, target entity/table, target record ID when known, attempted action, outcome, and timestamp.
- Define what happens when audit logging itself fails so isolation or bypass behavior remains deterministic under partial failure.
- Keep audit event naming compatible with the repo's dot-notation pattern so Story 1.9 can extend the same mechanism instead of replacing it.

### Architecture Compliance

- Follow the actual installed versions in `webapp/package.json`, not the stale broad version summaries in `_bmad-output/project-context.md`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
- Keep secure authorization and tenant checks close to the data source, consistent with Story 1.6 and current Next.js guidance. Proxy/layout checks can improve UX but are not the security boundary.
- Keep the current Next.js 16 `proxy.ts` convention. Do not reintroduce `middleware.ts`.
- Preserve Story 1.5's session rules and Story 1.6's role model exactly. Tenant isolation must compose with them, not redefine them.
- Treat `platform_admin` bypass as a distinct path layered on top of the 1.6 authorization context. Do not collapse tenant and platform scopes into one loosely typed helper.
- Maintain the repo's existing backend pattern: expected access failures use explicit backend errors; user-facing "not found" behavior should be a deliberate tenant-isolation outcome, not an accidental missing record check.

### Library And Framework Requirements

- Convex backend
  - Use `getAuthUserId` / `getAuthSessionId` indirectly through the current shared guard/session helpers unless a new helper has a strong reason to call them directly.
  - Prefer `withIndex(...)` on tenant indexes for tenant-owned table access instead of broad table scans followed by `.filter(...)`.
  - Keep shared guard helpers in Convex modules and reuse `ConvexError`-style backend failure semantics for true authorization errors.
- Next.js App Router
  - Keep this story backend-led. Only add App Router `notFound()` handling where an actual page-level tenant resource lookup exists or is introduced as part of this scope.
  - For future page loaders, align not-found UX with the backend tenant-isolation outcome rather than exposing a role-based banner that confirms cross-tenant existence.
- Convex Auth
  - Continue treating auth-owned tables as library-managed. Do not patch auth tables with custom tenant-isolation fields when app-owned tables already model the necessary scope.
  - One user can have multiple sessions; tenant isolation must be keyed to the current authorized user/context, not to a hand-maintained client cache.
- Testing/tooling
  - The repo's lightweight test harness already compiles TypeScript before running tests. Use that to enforce any new type-level tenant-guard guarantees.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/tenants.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/_roleGuard.ts`
- Expected new files (if needed):
  - `webapp/convex/functions/_tenantGuard.ts`
  - `webapp/convex/functions/auditLogs.ts` or a narrowly scoped security-event module
  - `webapp/tests/tenant-isolation.test.ts`
- Keep tenant-isolation helpers in backend/auth layers. Do not scatter table-classification constants and access rules across marketing, UI placeholder, or form modules.
- If you add shared type helpers, place them close to existing auth helpers (`webapp/lib/auth/...`) only when they are truly frontend-backend shared. Otherwise keep them in Convex.

### Testing Requirements

- Add backend-first automated coverage for:
  - same-tenant reads succeeding,
  - cross-tenant reads failing with safe not-found semantics,
  - list, batch, count, and existence-check paths preserving the same tenant boundary,
  - unauthenticated requests failing as unauthorized,
  - wrong-role or misconfigured contexts failing closed,
  - explicit platform-admin bypass reads succeeding and being audited,
  - corrupted or missing ownership metadata failing closed,
  - tenant membership revocation taking effect on the next protected request.
- Add regression coverage proving the new tenant guard does not break:
  - Story 1.2 tenant registration,
  - Story 1.3 / 1.4 / 1.5 auth-session flows,
  - Story 1.6 role resolution for platform and tenant roles.
- Add compile-checked tests or fixtures for the typed helper surface so unsupported unscoped tenant access patterns fail the TypeScript/test pipeline.
- Add coverage for nested and array inputs containing tenant-owned references so every referenced ID is validated, not just the outer request context.
- If browser validation is used, keep it minimal and scenario-driven:
  - tenant user cannot read another tenant's resource by manipulated ID,
  - platform admin can intentionally access the same record through an admin-only path,
  - user-facing navigation does not reveal whether the foreign tenant exists.

### Previous Story Intelligence

- Story 1.6 already created the canonical backend authorization surface in `webapp/convex/functions/_roleGuard.ts`. Build tenant isolation on top of it instead of creating a second guard hierarchy.
- Story 1.6 also established a fail-closed model for ambiguous roles, inactive role records, and platform-vs-tenant conflicts. Tenant isolation must preserve that posture.
- Story 1.5 introduced the session-metadata model and current-session guard helpers. Do not bypass those helpers just because tenant isolation is mostly data-layer work.
- Story 1.2 and Story 1.3 introduced the tenant creation and login flows in `webapp/convex/functions/users.ts`, `webapp/convex/functions/tenants.ts`, and the auth UI. Keep those flows intact while tightening backend access control.

### Git Intelligence Summary

- Recent auth/security work is concentrated in:
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/tests/rbac.test.ts`
- Commit `a0b0b5f` shows the current pattern for story hardening: centralize backend enforcement, add deterministic tests, and keep UI redirects as UX rather than the only security layer.
- Commit `fa83609` introduced `tenants.ts`, `users.ts`, signup/login forms, and the current tenant model. Story 1.7 should harden those paths, not replace them.
- The current codebase still has a narrow tenant surface, which is an advantage: fix isolation now before departments, plans, categories, and billing data multiply the attack surface.

### Latest Tech Information

- Validated March 9, 2026 against official docs:
  - Next.js 16 auth guidance says secure authorization checks should happen close to the data source, while Proxy is only for optimistic checks and layouts do not re-run on every client transition. This supports keeping tenant isolation in Convex guards, not in `proxy.ts` or layout code.
  - Next.js App Router's `notFound()` remains the stable page-level primitive for resource-missing behavior and is the correct future UI counterpart for cross-tenant "pretend it does not exist" flows.
  - Convex docs continue to recommend indexes for efficient queries and note that `withIndex(...)` narrows the search space using the index rather than scanning the full table and filtering afterward.
  - Convex docs still distinguish expected backend failures via `ConvexError`, which fits the existing repo pattern for unauthorized or invalid access paths.
  - Convex Auth server helpers still expose `getAuthUserId` and `getAuthSessionId`, and the library-managed auth/session tables remain the source of current user/session identity rather than app-owned browser state.

### Project Context Reference

- Apply the durable project-context rules that still match the current repo:
  - strict TypeScript,
  - path-alias imports,
  - Convex-first data and auth enforcement,
  - backend-first security checks,
  - tests co-located in the lightweight TypeScript compile-and-run harness.
- Where `_bmad-output/project-context.md` is stale, prefer the actual `webapp/package.json` versions and the current Next.js 16 / React 19 file conventions already present in the repo.

### Project Structure Notes

- Alignment with the current repo:
  - backend auth/session/tenant logic lives under `webapp/convex/functions/...`,
  - protected app routing and UX guards live under `webapp/app/(app)/...` and `webapp/lib/auth/...`,
  - test coverage lives under `webapp/tests/...`.
- Detected conflicts or variances:
  - `_bmad-output/project-context.md` still advertises older broad framework versions and should not override the real versions in `webapp/package.json`.
  - Current tenant isolation is only partially established: `users.ts#getCurrentUserTenant` is scoped correctly, while `tenants.ts#getById` still trusts arbitrary tenant IDs.
  - The repo does not yet contain the later procurement tables anticipated by the architecture docs, so this story must establish reusable tenant-guard infrastructure without inventing those tables prematurely.

### References

- [Epic Story Definition](_bmad-output/implementation-artifacts/epics/epic1/epic-01-foundation-authentication.md#story-17-tenant-data-isolation)
- [Sprint Status Source](_bmad-output/implementation-artifacts/sprint-status.yaml)
- [PRD FR7 / NFR-S1 / Multi-Tenant Scope](_bmad-output/planning-artifacts/prd.md)
- [Architecture Multi-Tenancy / Auth / Query Patterns](_bmad-output/planning-artifacts/architecture.md)
- [UX Desktop Strategy And Role Context](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Project Context Rules](_bmad-output/project-context.md)
- [Current Package Versions](webapp/package.json)
- [Current Convex Schema](webapp/convex/schema.ts)
- [Current Role Guard](webapp/convex/functions/_roleGuard.ts)
- [Current User/Tenant Functions](webapp/convex/functions/users.ts)
- [Current Session Guards](webapp/convex/functions/sessions.ts)
- [Current Tenant Functions](webapp/convex/functions/tenants.ts)
- [Current Role Map And Protected Route Logic](webapp/lib/auth/roles.ts)
- [Current RBAC Test Harness](webapp/tests/rbac.test.ts)
- [Next.js Authentication Guide - Authorization](https://nextjs.org/docs/app/guides/authentication#authorization)
- [Next.js Authentication Guide - Optimistic Checks With Proxy](https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional)
- [Next.js Authentication Guide - Layouts And Auth Checks](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks)
- [Next.js notFound Function](https://nextjs.org/docs/app/api-reference/functions/not-found)
- [Convex Read Data With Indexes](https://docs.convex.dev/database/reading-data/indexes/)
- [Convex Error Handling](https://docs.convex.dev/functions/error-handling/)
- [Convex Auth Server API](https://raw.githubusercontent.com/get-convex/convex-auth/main/docs/pages/api_reference/server.mdx)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Skill workflow: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Validation checklist: `_bmad/bmm/workflows/4-implementation/dev-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic source: `_bmad-output/implementation-artifacts/epics/epic1/epic-01-foundation-authentication.md`
- Previous story source: `_bmad-output/implementation-artifacts/1-6-four-layer-role-based-access-control.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/_tenantGuard.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/convex/functions/tenants.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/lib/auth/tenant-isolation.ts`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/tenant-isolation.test.ts`
  - `webapp/tests/tenant-isolation.types.test.ts`
- Recent git context:
  - `git log -5 --pretty=format:"%h %ad %s" --date=short`
  - `git show --stat --oneline -1 a0b0b5f`
  - `git show --stat --oneline -1 fa83609`
- Validation commands:
  - `cmd /c npm test`
  - `cmd /c npm run lint`
  - `cmd /c npm run build`

### Implementation Plan

- Centralize tenant-isolation policy in `webapp/lib/auth/tenant-isolation.ts` so runtime guards and compile-checked tests use the same decision logic.
- Add `webapp/convex/functions/_tenantGuard.ts` as the backend-only guard surface for same-tenant reads, explicit platform-admin bypass reads, current-tenant membership lookups, and batch tenant-ID validation.
- Normalize canonical tenant indexes and add a narrow append-only `tenantIsolationEvents` table before hardening the existing `tenants.ts` and `users.ts` access paths.
- Back the helper surface with runtime assertion tests, branded-ID compile checks, and full repo validation via test, lint, and build.

### Completion Notes List

- Added canonical tenant-isolation table classification, event naming, collection/count/existence helpers, and branded-ID compile contracts in `webapp/lib/auth/tenant-isolation.ts`.
- Added `webapp/convex/functions/_tenantGuard.ts` to centralize same-tenant reads, explicit audited platform-admin bypass reads, current membership lookups, and multi-ID tenant validation on top of Story 1.6's auth context.
- Hardened `webapp/convex/functions/tenants.ts#getById` to stop arbitrary tenant reads and introduced an explicit platform-admin bypass read path that writes audit events before returning cross-tenant data.
- Normalized canonical tenant indexes on `tenantUsers`, added append-only `tenantIsolationEvents`, and switched `users.ts#getCurrentUserTenant` to the new helper-backed membership lookup.
- Added regression coverage for same-tenant access, cross-tenant masking, missing metadata, platform bypass, stale membership, collection semantics, and branded-ID compile failures.
- Verified the implementation with `cmd /c npm test`, `cmd /c npm run lint`, and `cmd /c npm run build`.

### File List

- `_bmad-output/implementation-artifacts/1-7-tenant-data-isolation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/schema.ts`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/_tenantGuard.ts`
- `webapp/convex/functions/tenants.ts`
- `webapp/convex/functions/users.ts`
- `webapp/lib/auth/tenant-isolation.ts`
- `webapp/tests/run-tests.ts`
- `webapp/tests/tenant-isolation.test.ts`
- `webapp/tests/tenant-isolation.types.test.ts`

### Change Log

- 2026-03-09: Implemented Story 1.7 tenant-isolation guardrails, audited platform-admin bypass reads, canonical tenant indexes, and regression coverage; promoted story status to `review`.
