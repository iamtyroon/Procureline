# Story 1.9: Security Infrastructure & Input Validation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a security-conscious development team,
I want security infrastructure configured for XSS protection, CORS, input validation, and audit logging,
so that the platform meets NFR-S7 (input sanitization) and NFR-S10 (CORS restrictions) requirements.

## Acceptance Criteria

1. [Given] the current Next.js 16 + Convex Auth + Convex backend baseline from Stories 1.1 through 1.7 exists [When] Story 1.9 is implemented [Then] the codebase gains a centralized security-input layer for normalization, schema validation, and safe plain-text handling that current auth flows and later feature mutations can reuse [And] later stories do not need to invent one-off validators or sanitizers.
2. [Given] a user submits HTML, script fragments, encoded payloads, overlong strings, or malformed values through current public auth flows or any app-owned mutation updated in this story [When] the payload is processed [Then] current plain-text fields such as organization name, email, and similar auth/tenant strings are normalized and rejected if unsafe or invalid rather than silently HTML-sanitized [And] no app-owned field introduced so far stores executable markup or reflects it unsafely in the UI.
3. [Given] the application currently exposes Convex Auth HTTP routes through `webapp/convex/http.ts` and Next.js route-edge behavior through `webapp/proxy.ts` [When] Story 1.9 is implemented [Then] origin allowlisting is applied only to the real browser-callable HTTP surfaces that need it [And] the story explicitly does not require fake CORS wrappers around same-origin-only code paths or non-HTTP Convex functions.
4. [Given] a browser request targets an HTTP surface covered by this story [When] an origin is not explicitly allowlisted for the active environment [Then] browser-based cross-origin requests are denied by explicit origin/CORS rules [And] allowed development, staging, and production origins are read from one canonical server-side configuration contract instead of ad hoc string checks scattered across handlers.
5. [Given] an in-scope HTTP request arrives without an `Origin` header [When] the request is evaluated [Then] the implementation applies an explicit no-`Origin` policy for same-origin or trusted server-to-server behavior [And] the story does not leave `Origin`-less requests to accidental pass/fail behavior.
6. [Given] a security-relevant event occurs in the current scope, including rejected malicious input, blocked origin requests, or explicit platform-security bypasses already supported by the codebase [When] the event is recorded [Then] it is written to an append-only audit mechanism with stable dot-notation event names, actor identity when known, an explicit anonymous actor state when no authenticated principal exists, tenant context when applicable, outcome, and timestamp [And] Story 1.7 tenant-isolation events remain compatible instead of being replaced by a conflicting format.
7. [Given] the current signup, login, password-reset, session, RBAC, and tenant-isolation flows already work [When] the security infrastructure is added [Then] Stories 1.2 through 1.7 behavior continues without regression [And] public auth UX still shows precise validation messages without leaking sensitive implementation detail.
8. [Given] a caller submits oversized strings, repeated delimiters, encoded tags, control characters, or malformed origin values [When] the request is processed [Then] the system rejects the payload deterministically with explicit validation behavior [And] the rejection path is covered by automated tests and logged when the story marks it as a security event.
9. [Given] a security-sensitive path in this story requires audit persistence [When] the audit write fails [Then] blocked-request paths still deny access fail-closed [And] success paths that require mandatory audit evidence do not proceed silently without a recorded event.
10. [Given] the story is complete [When] automated validation runs [Then] tests cover the required malicious-payload matrix, origin allowlist behavior including missing-`Origin` requests, audit event formatting including anonymous actors, and reuse of shared validation helpers [And] the existing lightweight TypeScript test harness, linting, and build continue to pass.

## Tasks / Subtasks

- [x] Task 1: Define the canonical Story 1.9 security surface and scope boundaries (AC: 1, 3, 4, 5, 6, 7)
  - [x] Inventory current security-related modules in `webapp/convex/auth.ts`, `webapp/convex/http.ts`, `webapp/proxy.ts`, `webapp/lib/validators/auth.ts`, `webapp/convex/functions/_roleGuard.ts`, and the tenant-isolation helpers so Story 1.9 extends the real baseline instead of the earlier aspirational architecture diagrams.
  - [x] Explicitly list which current request surfaces are in scope for origin enforcement, starting with the browser-callable routes mounted from `webapp/convex/http.ts`, and which paths are out of scope because they are same-origin-only or non-HTTP Convex functions.
  - [x] Define which inputs are plain-text-only and should be normalized/rejected, versus which future fields may legitimately need HTML sanitization, so the implementation does not blindly run DOM sanitization over every string without intent.
  - [x] Keep NFR-S7 and NFR-S10 in scope; do not expand this story into rate limiting, WAF setup, full SIEM export, or non-existent procurement-domain CRUD.

- [x] Task 2: Create shared validation and input-security utilities (AC: 1, 2, 6, 7)
  - [x] Introduce a reusable security-input module for string normalization, length bounds, plain-text enforcement, and any SSR-safe sanitization wrapper needed for future rich-text fields.
  - [x] Refactor existing auth-facing validation so `webapp/lib/validators/auth.ts` remains the client-form schema source while backend mutations/functions reuse aligned normalization and server-side validation rules instead of trusting frontend Zod alone.
  - [x] Preserve the current email normalization pattern (`trim().toLowerCase()`) and password requirements already enforced in `SignupForm`, `LoginForm`, password-reset helpers, and `webapp/convex/auth.ts`.
  - [x] Make the current plain-text rule explicit in code and tests: auth/tenant text fields are rejected or normalized to safe plain text, not passed through a generic HTML sanitizer and stored.
  - [x] Ensure expected failures use the repo's current `ConvexError` pattern with precise but non-leaky error codes/messages.

- [x] Task 3: Generalize append-only audit logging without breaking Story 1.7 (AC: 6, 7, 9, 10)
  - [x] Add a canonical audit/security event storage strategy in `webapp/convex/schema.ts` and a shared Convex helper module so sensitive actions and security events use one stable write path.
  - [x] Either extend the current `tenantIsolationEvents` approach or introduce a broader `auditLogs`/`securityEvents` table with an adapter plan, but do not strand Story 1.7 on a dead-end event format.
  - [x] Existing Story 1.7 tests and consumers must keep working unchanged or through a thin compatibility adapter; Story 1.9 must not require a broad caller rewrite just to preserve existing tenant-isolation events.
  - [x] Use project-standard dot-notation event names and include actor user ID, actor role, tenant context when applicable, entity type, action, outcome, metadata, and timestamp.
  - [x] Implement the minimum required Story 1.9 event set explicitly: one event for rejected malicious input, one event for blocked origin requests, and compatibility for the existing tenant-isolation bypass/block events.
  - [x] Define how blocked-origin and similar unauthenticated security events are stored when no authenticated actor exists, using an explicit anonymous actor shape instead of skipping the audit record.
  - [x] Keep audit data append-only in public behavior: no user-facing delete/update surface and no silent success when audit persistence is required for a sensitive operation.

- [x] Task 4: Apply security infrastructure to the actual current entry points (AC: 1, 2, 3, 4, 5, 7, 8, 10)
  - [x] Add explicit origin/CORS handling to the HTTP entry points that actually exist now, starting with `webapp/convex/http.ts` and any auth/webhook-facing routes this repo exposes.
  - [x] Introduce a single server-side config helper for allowed origins, for example `ALLOWED_ORIGINS=https://app.procureline.example,https://staging.procureline.example,http://localhost:3000`, plus explicit localhost defaults in development if needed, and make tests assert that contract.
  - [x] Fail closed on missing allowlist configuration outside development. Production-like environments must not silently run with an empty or undefined allowed-origin set.
  - [x] Define explicit handling for requests with no `Origin` header so same-origin and trusted server-to-server behavior is intentional and testable.
  - [x] Update `webapp/proxy.ts` only for response-header concerns that belong at the Next.js edge layer; do not move backend authorization or data validation into Proxy.
  - [x] Treat security-header work in this story as baseline hardening only. Do not expand into a full CSP redesign unless the existing routes cannot be protected safely without it.
  - [x] Thread shared input normalization/validation into the current auth and tenant mutations/queries that accept user-controlled strings, including `webapp/convex/functions/users.ts` and `webapp/convex/functions/tenants.ts`.
  - [x] Keep plain-text fields such as organization names, emails, and auth inputs safe without introducing unsafe HTML rendering patterns or `dangerouslySetInnerHTML`.

- [x] Task 5: Add focused regression coverage and developer guardrails (AC: 2, 4, 5, 6, 7, 8, 9, 10)
  - [x] Add backend/unit coverage in the existing `webapp/tests` harness for malicious-input normalization/rejection, audit-event payload shape, and origin allowlist decisions.
  - [x] Define and test a required malicious-payload matrix at minimum covering HTML tags, encoded script-like input, oversized strings, control-character input, and malformed origin headers.
  - [x] Add tests for missing production allowlist config, missing-`Origin` requests, and anonymous blocked-origin audit events.
  - [x] Preserve and rerun the current auth/session/RBAC/tenant-isolation tests so Story 1.9 proves compatibility with Stories 1.2 through 1.7.
  - [x] Add tests or fixtures that prove shared validators are reused by current flows instead of duplicating regex/normalization logic across components and Convex functions.

## In-Scope Fields

- Current plain-text inputs in scope for Story 1.9 hardening include:
  - signup email
  - login email
  - forgot-password email
  - reset-password email and code inputs
  - organization name
  - tenant creation or rename text inputs that currently map to `tenants.name` / subdomain generation
- Password values remain in scope for validation policy and bounded handling, but are not to be logged, sanitized for storage, or reflected back in audit metadata.

## Non-Goals

- No rate limiting, bot detection, WAF, CAPTCHA, SIEM export, or full security-platform work unless needed to satisfy an explicit acceptance criterion above.
- No broad CSP redesign; only baseline header hardening that safely fits the current route surface.
- No rich-text field support. If a later story introduces true markup-capable fields, that story must explicitly define how sanitization is enabled.

## Dev Notes

### Story Foundation

- Epic 1 ties this story directly to NFR-S7 and NFR-S10, but its real platform value is broader: Story 1.9 is the security utility layer that later admin, catalog, plan, billing, and notification mutations should inherit instead of re-implementing.
- Story 1.6 already established canonical authorization context and fail-closed role handling. Story 1.7 added tenant-isolation guardrails and narrow tenant-security audit events. Story 1.9 must build on those foundations, not replace them.
- The story is backend-led even though some UX-facing validation exists. The important outcome is a reusable server-authoritative security contract across current and future inputs, HTTP origins, and audit events.

### Current Implementation State Discovered In Code

- `webapp/lib/validators/auth.ts` currently contains client-facing Zod schemas for signup, login, forgot-password, reset-password, and OTP. This is the strongest existing validation layer, but it is frontend-oriented and not yet a general backend security-input framework.
- `webapp/convex/auth.ts` already enforces password requirements in the Convex Auth password provider. Story 1.9 should reuse those rules instead of introducing a competing password-policy implementation.
- `webapp/src/components/auth/SignupForm.tsx` and `webapp/src/components/auth/LoginForm.tsx` already normalize email with `trim().toLowerCase()` before calling Convex Auth. That normalization pattern is established and should be centralized, then reused consistently.
- `webapp/convex/http.ts` currently only mounts `auth.addHttpRoutes(http)` and does not yet add explicit origin/CORS restrictions or custom security wrappers around HTTP routes.
- `webapp/proxy.ts` currently handles public-route bypass, unauthenticated redirect behavior, and protected-route cache-control headers. It does not yet set security headers and should not become the main authorization or validation boundary.
- `webapp/convex/functions/_roleGuard.ts` is the canonical auth/role gate and must remain the source of truth for who is allowed to act.
- `webapp/lib/auth/tenant-isolation.ts` and `webapp/convex/functions/_tenantGuard.ts` already introduced append-only `tenantIsolationEvents` with stable dot-notation event names (`tenant.probe_blocked`, `tenant.platform_read_allowed`) and explicit audit-write behavior. Story 1.9 should extend that event discipline into broader audit logging.
- `webapp/convex/schema.ts` currently has `tenantIsolationEvents` but no generalized `auditLogs` or `securityEvents` table.
- There is no DOMPurify or `isomorphic-dompurify` dependency in `webapp/package.json` right now, and no app-wide sanitization helper module exists yet.
- Existing error handling already expects `ConvexError` payloads, for example in `webapp/app/handleFailure.ts`.

### Reuse And Anti-Reinvention Guidance

- Reuse `webapp/lib/validators/auth.ts` for client-form shape validation and extract shared normalization helpers from the current auth flows instead of copy-pasting new regex rules into every component or mutation.
- Reuse `ConvexError` for expected validation and authorization failures. Do not switch current app-facing errors to generic `Error` throws when consistent machine-readable codes are already in use.
- Reuse Story 1.6 authorization context in `_roleGuard.ts` whenever audit events need actor role, tenant scope, or current-user identity.
- Reuse Story 1.7's dot-notation event naming and append-only audit posture. Do not create a second incompatible security logging vocabulary.
- Reuse the existing lightweight test harness in `webapp/tests/run-tests.ts`; add Story 1.9 coverage there before considering heavier test infrastructure.
- Reuse `proxy.ts` only for edge concerns such as response headers and authenticated-route cache policy. Keep security decisions that depend on authoritative data in Convex.

### Security And Scope Boundaries

- Do not claim Story 1.9 "prevents SQL injection" by itself through custom code. Convex is not a raw SQL layer; the practical Story 1.9 outcome is strict validation, normalization, safe rendering, and logging of malicious payload attempts.
- Do not blindly sanitize every string and then persist the sanitized result as if the field supported HTML. For plain-text fields already present in this codebase, prefer normalization plus rejection of unsafe/invalid payloads over silently storing mutated markup.
- Current Story 1.9 scope treats auth and tenant text fields as plain-text-only. If a future story introduces a genuine rich-text field, that story must opt into HTML sanitization explicitly instead of inheriting it implicitly from this one.
- Do not introduce `dangerouslySetInnerHTML` or rich-text rendering just to demonstrate XSS protection. There is no current product requirement for rich-text input in these auth and tenant flows.
- Do not move tenant-isolation, role enforcement, or session enforcement into Proxy or client components. Story 1.9 complements those controls; it does not replace them.
- Do not break existing auth UX. Validation messages should stay field-specific and helpful while avoiding sensitive backend leakage such as confirming whether hidden records or unauthorized origins exist.
- Keep audit writes deterministic for sensitive operations. If the design requires an audit record for a security-sensitive success path, do not silently continue when the audit write fails.
- For this story, mandatory-audit success paths must abort if their audit record cannot be persisted; deny-path logging may fail silently only when the deny behavior itself remains fail-closed.
- Rate limiting, bot detection, CSP tuning for every third-party asset, and SIEM/export pipelines are useful but out of scope unless they are the minimum implementation needed to satisfy an explicit acceptance criterion here.

### Technical Requirements

- Introduce a canonical security-input utility layer that can be consumed by both client and backend code, with explicit support for:
  - string normalization,
  - plain-text enforcement,
  - bounded lengths,
  - schema-aligned validation,
  - optional SSR-safe sanitization only where markup-capable fields are explicitly allowed in later stories.
- Preserve the current email and password behavior already implemented in auth flows.
- Ensure Convex mutations/queries that accept user-controlled strings perform server-side validation even when the caller already passed frontend Zod validation.
- Add a generalized append-only audit mechanism that preserves compatibility with `tenantIsolationEvents` and project-standard event naming.
- Centralize environment-driven origin allowlisting for the real HTTP entry points instead of hardcoding localhost-only checks in one file and forgetting staging/production parity elsewhere.
- Define the config contract used by implementation and tests. A single helper should resolve allowed origins from server-side configuration and development defaults; the story should not leave origin names or parsing rules implicit.
- Use a concrete server-side config shape, for example `ALLOWED_ORIGINS` as a comma-separated list, and ensure parsing/normalization rules are tested once centrally.
- Outside development, an empty or missing allowlist configuration is a startup/configuration error, not a silent fallback.
- Keep security event payloads structured enough for future audit review: actor user ID, actor role, source tenant when applicable, target tenant when applicable, event name, entity type, action, outcome, timestamp, and optional metadata.
- Keep audit event names stable and explicit, for example `auth.login_failed`, `security.input_rejected`, `tenant.platform_read_allowed`, not free-form prose strings.
- The minimum Story 1.9 event vocabulary must include a blocked-origin event and an input-rejected event in addition to preserving Story 1.7 tenant-isolation events.
- The audit model must support authenticated and unauthenticated security events explicitly; missing actor identity is not a reason to drop a blocked-origin event.

### Architecture Compliance

- Follow the actual installed versions in `webapp/package.json`, not the stale broad version summaries in `_bmad-output/project-context.md`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - Zod `^3.22.4`
- Keep the current Next.js 16 `proxy.ts` convention. Do not reintroduce `middleware.ts`.
- Keep secure validation and audit writes close to the data and HTTP entry points. Proxy can add headers and auth-adjacent UX behavior, but it is not the security source of truth.
- Preserve Story 1.5 session behavior and Story 1.6 authorization behavior exactly. Story 1.9 must compose with them.
- Preserve Story 1.7 tenant-isolation helper behavior and event semantics. If you generalize auditing, do it with backward-compatible naming or a migration path, not a rip-and-replace.

### Library And Framework Requirements

- Next.js App Router
  - Use `proxy.ts` only for edge response behavior and auth-adjacent checks.
  - Keep public/auth page validation in the current form components, but do not trust client validation without backend validation.
- Convex backend
  - Keep expected access or validation failures in `ConvexError` form.
  - Keep shared security helpers in backend-accessible modules that current and future feature functions can import.
  - Avoid broad table scans when building future audit-log queries; use indexes for actor/time/event lookups.
- Convex Auth
  - Reuse the existing password-provider validation hook in `webapp/convex/auth.ts`.
  - Do not fork a second authentication state model for validation or logging.
- Validation/sanitization libraries
  - Zod is already installed and in use for form validation.
  - If HTML sanitization is added, use an SSR-safe package compatible with the deployed Node runtime rather than browser-only DOM APIs in shared code.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/convex/schema.ts`
  - `webapp/convex/http.ts`
  - `webapp/proxy.ts`
  - `webapp/convex/auth.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/tenants.ts`
  - `webapp/lib/validators/auth.ts`
- Expected new files (if needed):
  - `webapp/convex/functions/auditLogs.ts` or `webapp/convex/functions/securityEvents.ts`
  - `webapp/lib/security/input.ts` or `webapp/lib/security/sanitize.ts`
  - `webapp/tests/security-infrastructure.test.ts`
- Keep shared security utilities out of UI component folders. Validation and sanitization helpers should live in `webapp/lib/...` or backend helper modules where future stories can reuse them.

### Testing Requirements

- Add automated coverage for:
  - normalized/rejected malicious payloads,
  - oversized and malformed input rejection,
  - auth-form and backend-validation rule alignment,
  - origin allowlist decisions for allowed and denied domains,
  - missing-`Origin` request handling,
  - missing production allowlist configuration,
  - audit-event payload shape and event naming,
  - anonymous security-event logging,
  - mandatory-audit failure behavior for sensitive success paths,
  - no regression in password-reset, session, RBAC, and tenant-isolation tests.
- Tests must exercise the canonical allowed-origin config helper rather than re-encoding origin strings inline per test.

## Definition of Done

- Shared security-input helper(s) exist and are reused by the current auth/tenant entry points covered by this story.
- Canonical allowed-origin config helper exists and is the only origin allowlist source used by in-scope HTTP surfaces.
- Minimum Story 1.9 event set is implemented and Story 1.7 tenant-isolation event compatibility is preserved.
- Required malicious-payload, origin-policy, audit-shape, and audit-failure tests are added to the existing harness.
- `cmd /c npm test`, `cmd /c npm run lint`, and `cmd /c npm run build` pass after implementation.
- Keep tests in the current lightweight TypeScript compile-and-run harness under `webapp/tests/...`.
- Validate the story with the repo-standard commands:
  - `cmd /c npm test`
  - `cmd /c npm run lint`
  - `cmd /c npm run build`

### Previous Story Intelligence

- Story 1.7 already created the narrow but real security event channel in `tenantIsolationEvents`. That means Story 1.9 should not start from a blank-slate audit design.
- Story 1.7 also established the pattern that some security-sensitive read paths must fail closed if required audit writes cannot be recorded. Preserve that rigor for new sensitive actions.
- Story 1.6 centralized role/session-derived actor context in `_roleGuard.ts`; use that when logging actor role and tenant scope instead of recomputing actor state ad hoc.
- Story 1.5 established `proxy.ts` and cache-control behavior for authenticated routes. If Story 1.9 adds security headers there, it must preserve those caching semantics.
- Story 1.2 and Story 1.4 proved that public auth UX depends on precise form validation and normalized emails. Do not degrade that flow with generic "invalid request" handling everywhere.

### Git Intelligence Summary

- Recent committed security/auth patterns emphasize centralization and tests:
  - commit `a0b0b5f` concentrated session, proxy, auth-validator, and backend-test work.
  - commit `a58205b` concentrated role-guard hardening and story-context preparation for tenant-isolation work.
- Current working-tree state already contains uncommitted tenant-isolation additions in:
  - `webapp/convex/functions/_tenantGuard.ts`
  - `webapp/lib/auth/tenant-isolation.ts`
  - `webapp/tests/tenant-isolation.test.ts`
  - `webapp/tests/tenant-isolation.types.test.ts`
- Story 1.9 implementation should preserve and extend those files rather than rename or discard them casually.

### Latest Tech Information

- Verified March 9, 2026 against official docs:
  - Next.js authentication guidance for App Router distinguishes optimistic checks in `proxy.ts` from secure checks near the data source and explicitly recommends a centralized data-access layer for real authorization.
  - The same Next.js guide warns that layouts do not re-run on every navigation, so security checks should not rely on layout-only enforcement.
  - Convex documentation continues to recommend `withIndex(...)` with specific index ranges for efficient queries and notes that broad `.collect()` usage without a bounded range can devolve into expensive scans.
  - Convex documentation still recommends `ConvexError` for expected application failures.
  - DOMPurify's upstream project is at version `3.3.2` as of March 5, 2026 and remains the main HTML/XSS sanitization library.
  - DOMPurify's server-side guidance still depends on a safe DOM implementation such as up-to-date `jsdom`; the project specifically recommends current `jsdom` versions and warns against unsafe alternatives.
  - `isomorphic-dompurify` currently requires newer Node runtimes in recent major versions (`>=3.0.0` requires `^20.19.0 || ^22.12.0 || >=24.0.0`), so if this repo adds it, the implementation must verify runtime compatibility with the deployment target before pinning the package.

### Project Context Reference

- Apply the durable project-context rules that still match the repo:
  - strict TypeScript,
  - path-alias imports,
  - Convex-first backend/data enforcement,
  - backend-first security checks,
  - Zod for typed form validation,
  - tests in the lightweight compile-and-run harness.
- Where `_bmad-output/project-context.md` is stale, prefer actual versions and file conventions from the live codebase.

### Project Structure Notes

- Alignment with the current repo:
  - backend auth/session/tenant logic lives under `webapp/convex/functions/...`,
  - auth UI and validation live under `webapp/src/components/auth/...` and `webapp/lib/validators/...`,
  - route-edge auth handling lives in `webapp/proxy.ts`,
  - lightweight automated coverage lives in `webapp/tests/...`.
- Detected conflicts or variances:
  - `_bmad-output/project-context.md` still advertises older broad framework versions and `middleware` terminology; the actual codebase uses Next.js 16 and `proxy.ts`.
  - the architecture doc references `convex/internal/_validators.ts` and `convex/functions/auditLogs.ts` as target patterns, but those files do not exist yet in the current repo.
  - the current audit surface is `tenantIsolationEvents`, not a generalized `auditLogs` table.

### References

- [Epic Story Definition](_bmad-output/implementation-artifacts/epics/epic1/epic-01-foundation-authentication.md#story-19-security-infrastructure--input-validation)
- [Sprint Status Source](_bmad-output/implementation-artifacts/sprint-status.yaml)
- [Previous Story Context](_bmad-output/implementation-artifacts/1-7-tenant-data-isolation.md)
- [PRD Security NFRs](_bmad-output/planning-artifacts/prd.md#security)
- [Architecture File Layout And Convex Structure](_bmad-output/planning-artifacts/architecture.md)
- [UX Inline Validation Pattern](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Project Context Rules](_bmad-output/project-context.md)
- [Tech Stack Decisions](_bmad-output/planning-artifacts/tech-stack-decisions.md)
- [Current Package Versions](webapp/package.json)
- [Current Convex Auth Setup](webapp/convex/auth.ts)
- [Current Convex HTTP Router](webapp/convex/http.ts)
- [Current Proxy](webapp/proxy.ts)
- [Current Schema](webapp/convex/schema.ts)
- [Current Role Guard](webapp/convex/functions/_roleGuard.ts)
- [Current Tenant Guard](webapp/convex/functions/_tenantGuard.ts)
- [Current Auth Validators](webapp/lib/validators/auth.ts)
- [Current Tenant Isolation Model](webapp/lib/auth/tenant-isolation.ts)
- [Current Test Harness](webapp/tests/run-tests.ts)
- [Current RBAC Tests](webapp/tests/rbac.test.ts)
- [Current Tenant Isolation Tests](webapp/tests/tenant-isolation.test.ts)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js Authorization Guidance](https://nextjs.org/docs/app/guides/authentication#authorization)
- [Next.js Proxy Guidance](https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional)
- [Next.js Layout Auth Guidance](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks)
- [Convex Indexes Guide](https://docs.convex.dev/database/reading-data/indexes/)
- [Convex Error Handling Guide](https://docs.convex.dev/functions/error-handling/)
- [DOMPurify Upstream](https://github.com/cure53/DOMPurify)
- [isomorphic-dompurify Runtime Requirements](https://github.com/kkomelin/isomorphic-dompurify)

## Change Log

- 2026-03-09: Added shared security policy, input-validation, origin-policy, and audit helper modules; generalized append-only audit persistence with tenant-isolation compatibility; hardened proxy origin handling and auth/tenant validation reuse; added an internal proxy audit bridge route; expanded the lightweight test harness; regenerated Convex bindings.
- 2026-03-09: Completed a final third security audit, closed the remaining auth-audit and blocked-origin audit gaps, and confirmed the story is ready to enter the BMAD review workflow.

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Validation checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic source: `_bmad-output/implementation-artifacts/epics/epic1/epic-01-foundation-authentication.md`
- Previous story source: `_bmad-output/implementation-artifacts/1-7-tenant-data-isolation.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/planning-artifacts/tech-stack-decisions.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/convex/auth.ts`
  - `webapp/convex/http.ts`
  - `webapp/proxy.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/_tenantGuard.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/tenants.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/lib/auth/tenant-isolation.ts`
  - `webapp/lib/validators/auth.ts`
  - `webapp/tests/run-tests.ts`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/password-reset.test.ts`
  - `webapp/tests/tenant-isolation.test.ts`
- Recent git context:
  - `git log -5 --pretty=format:"%h %ad %s" --date=short`
  - `git show --stat --oneline -1 a58205b`
  - `git show --stat --oneline -1 a0b0b5f`
  - `git status --short`
- External validation sources:
  - `https://nextjs.org/docs/app/guides/authentication`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://docs.convex.dev/functions/error-handling/`
  - `https://github.com/cure53/DOMPurify`
  - `https://github.com/kkomelin/isomorphic-dompurify`
- 2026-03-09 implementation plan:
  - inventory current auth, tenant, HTTP, proxy, validator, and tenant-isolation modules against the live codebase
  - add shared security helpers for input normalization/rejection, canonical origin policy parsing, and append-only audit logging
  - thread shared validation into auth and tenant entry points without changing existing UX-facing validator ownership
  - preserve tenant-isolation event compatibility while introducing broader security/audit events
  - expand the lightweight TypeScript harness with malicious-input, origin-policy, audit-shape, and validator-reuse coverage

### Completion Notes List

- 2026-03-09: Story created in `ready-for-dev` state with implementation guidance anchored to the current Next.js 16, Convex Auth, and tenant-isolation baseline.
- 2026-03-09: Manual checklist validation used because `_bmad/core/tasks/validate-workflow.xml` is not present in this repo even though the workflow references it.
- 2026-03-09: Added `webapp/lib/security/*` as the canonical Story 1.9 surface for plain-text validation, origin allowlisting, audit event formatting, and scope metadata.
- 2026-03-09: Generalized append-only auditing with `auditLogs`, preserved Story 1.7 compatibility by dual-writing tenant-isolation events through the shared audit path, and added a proxy-to-Convex audit bridge for blocked origin events.
- 2026-03-09: Reused shared normalization and validation in auth schemas, Convex auth profile validation, tenant registration/creation flows, and current auth UI form submissions.
- 2026-03-09: Validation complete: `cmd /c npx convex codegen`, `cmd /c npm test`, `cmd /c npm run lint`, and `cmd /c npm run build` all passed in `webapp/`.
- 2026-03-09: Final review fixes applied, `npm test` passed, and Story 1.9 was moved to `done`.

### File List

- `_bmad-output/implementation-artifacts/1-9-security-infrastructure-input-validation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/.test-dist/lib/auth/password-reset.js`
- `webapp/.test-dist/lib/auth/proxy.js`
- `webapp/.test-dist/lib/auth/tenant-isolation.js`
- `webapp/.test-dist/lib/security/audit.js`
- `webapp/.test-dist/lib/security/input.js`
- `webapp/.test-dist/lib/security/origins.js`
- `webapp/.test-dist/lib/security/policy.js`
- `webapp/.test-dist/lib/validators/auth.js`
- `webapp/.test-dist/tests/proxy.test.js`
- `webapp/.test-dist/tests/run-tests.js`
- `webapp/.test-dist/tests/security-infrastructure.test.js`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/auth.ts`
- `webapp/convex/functions/_audit.ts`
- `webapp/convex/functions/_tenantGuard.ts`
- `webapp/convex/functions/auditLogs.ts`
- `webapp/convex/functions/securityAudit.ts`
- `webapp/convex/functions/tenants.ts`
- `webapp/convex/functions/users.ts`
- `webapp/convex/http.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/auth/password-reset.ts`
- `webapp/lib/auth/proxy.ts`
- `webapp/lib/auth/tenant-isolation.ts`
- `webapp/lib/security/audit.ts`
- `webapp/lib/security/input.ts`
- `webapp/lib/security/origins.ts`
- `webapp/lib/security/policy.ts`
- `webapp/lib/validators/auth.ts`
- `webapp/proxy.ts`
- `webapp/src/components/auth/LoginForm.tsx`
- `webapp/src/components/auth/SignupForm.tsx`
- `webapp/src/components/auth/VerifyEmailForm.tsx`
- `webapp/app/api/internal/security-events/origin-blocked/route.ts`
- `webapp/tests/proxy.test.ts`
- `webapp/tests/run-tests.ts`
- `webapp/tests/security-infrastructure.test.ts`
- `webapp/tsconfig.tests.json`
- `webapp/.test-dist/lib/security/audit.js`
- `webapp/.test-dist/lib/security/input.js`
- `webapp/.test-dist/lib/security/origins.js`
- `webapp/.test-dist/lib/security/policy.js`
- `webapp/.test-dist/tests/security-infrastructure.test.js`
