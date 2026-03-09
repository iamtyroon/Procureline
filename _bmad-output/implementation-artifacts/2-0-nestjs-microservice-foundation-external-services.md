# Story 2.0: NestJS Microservice Foundation & External Services

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **development team**,
I want a NestJS microservice providing payment processing, file generation, and email services,
so that all epics have access to critical external integrations and heavy processing capabilities.

## Acceptance Criteria

1. **Given** the platform requires external service integration **when** the NestJS microservice is initialized **then** the project structure follows NestJS modular best practices **and** includes an auth boundary, payments module, files module, emails module, queue infrastructure, and shared config/logging layers.
2. **Given** Procureline needs a stable integration boundary **when** the microservice starts **then** it exposes authenticated REST endpoints under `/api/services/*` with OpenAPI documentation **and** the implementation follows the project architecture rule that app code reaches NestJS through trusted server-side seams, not ad hoc browser-side fetches, while provider webhooks remain the only unauthenticated public entry points.
3. **Given** user context must survive cross-service calls **when** Convex or Next.js server-side code calls NestJS **then** NestJS validates a signed Procureline service token issued by a server-side Procureline caller **and** request-scoped user identity exposes `userId`, `tenantId` when present, and `role` for audit logging **and** browser clients do not call NestJS directly with raw Convex session tokens as the standard app flow.
4. **Given** payment processing is required **when** the payments foundation is built **then** Stripe, IntaSend, and manual bank-transfer workflows each have isolated service wrappers, DTOs, controller seams, and webhook/callback entry points **and** later stories can extend those foundations without replacing them.
5. **Given** invoices, reports, and Excel workflows depend on server-side file processing **when** the files foundation is built **then** PDF generation, Excel import/export, and template directories exist behind service abstractions **and** the implementation avoids browser-side Excel/PDF generation for heavy workloads.
6. **Given** transactional email is required across registration, billing, alerts, and invitations **when** the email foundation is built **then** Resend-backed delivery, React Email templates, and webhook handling seams exist **and** the service supports later story-specific template expansion without redesigning the module boundary.
7. **Given** webhook events arrive from external providers **when** Stripe or IntaSend callbacks are received **then** signatures are verified, raw payload handling is preserved where required, duplicate events are rejected idempotently using a persisted processed-event contract, and resulting product-state changes are written back through one explicit NestJS-to-Convex synchronization path rather than provider-specific ad hoc updates.
8. **Given** some jobs are CPU-heavy or retry-oriented **when** long-running processing is needed **then** Redis-backed queues are configured with retry, prioritization, progress tracking, and explicit failed-job handling **and** the chosen queue package matches current NestJS guidance instead of locking the repo to a stale integration path **and** request-time behavior is defined for Redis-unavailable conditions.
9. **Given** Procureline already has audit and security guardrails in `webapp/convex` **when** the NestJS service is introduced **then** cross-service calls preserve audit actor context, error responses follow the existing standardized `success/data` or `success/error` envelope, and service secrets are validated on boot.
10. **Given** authenticated internal routes, provider webhooks, and operational endpoints have different risk profiles **when** rate limiting and request policies are configured **then** internal service routes, webhooks, and health/metrics endpoints have explicit per-route behavior instead of a single blanket throttle policy.
11. **Given** the microservice is added to a repo that currently only contains `webapp/` **when** Story 2.0 is implemented **then** the new service lands in a clean top-level `nestjs/` project with its own package manifest, env example, tests, and run/build scripts **and** it does not destabilize the current Next.js + Convex workflow.
12. **Given** the foundation story is complete **when** automated validation runs **then** unit tests cover token validation, provider wrappers, config validation, queue registration, and failed-job behavior, integration tests cover authenticated REST entry points plus webhook signature paths and Convex write-back flows, and the service builds cleanly in isolation.

## Tasks / Subtasks

- [x] Scaffold a new top-level `nestjs/` service project and baseline runtime (AC: 1, 10, 11)
  - [x] Create `nestjs/package.json`, `nestjs/tsconfig*.json`, `nestjs/nest-cli.json`, `nestjs/.env.example`, `nestjs/.gitignore`, and `nestjs/README.md`.
  - [x] Add `src/main.ts`, `src/app.module.ts`, global config/bootstrap, global validation pipe, exception filter, and a health endpoint.
  - [x] Use a global prefix of `/api/services` and generate Swagger/OpenAPI docs from the live controllers.
  - [x] Keep the current repo structure intact: `webapp/` remains independent and the new service is not nested inside `webapp/convex`.

- [x] Establish the service-to-service auth and request-context model (AC: 2, 3, 9, 11)
  - [x] Implement a NestJS auth module with a guard that validates Procureline-issued service JWTs and exposes `userId`, `role`, and optional `tenantId` on the request.
  - [x] Add decorators such as `@CurrentUserId()`, `@CurrentTenantId()`, and `@CurrentRole()` for controller ergonomics.
  - [x] Define the canonical token contract shared with `webapp/convex/actions/*` so later stories do not invent inconsistent headers or payloads, including issuer, audience, claims, expiry window, and signing secret ownership.
  - [x] Do not make browser clients call NestJS directly with raw Convex session tokens as the primary path; route app-owned operations through trusted server-side callers.

- [x] Build the shared platform module layer (AC: 1, 2, 8, 9, 10)
  - [x] Add config validation for all required env vars and fail fast on boot.
  - [x] Add structured logging, request correlation IDs, and a common error/response envelope that matches project-context guidance.
  - [x] Add rate limiting using the current NestJS-supported throttling package and expose explicit 429 behavior with separate policies for internal authenticated routes, public provider webhooks, and operational endpoints such as `/health` or `/metrics`.
  - [x] Add queue registration with Redis-backed workers and a minimal job abstraction for retries/progress.
  - [x] Define the request-body strategy early so webhook routes that require raw payloads are not broken by global JSON parsing.

- [x] Create the payments foundation without overreaching into later business stories (AC: 4, 7, 8, 9, 11)
  - [x] Implement `payments/` with provider-specific services for Stripe, IntaSend, and bank-transfer verification.
  - [x] Add DTOs, controller seams, and placeholder domain methods for subscription create/update, payment verification, and invoice-related hooks.
  - [x] Add webhook endpoints that preserve raw request bodies where signatures require them and record provider event IDs for idempotency.
  - [x] Define where processed provider events are persisted and how replay protection works across retries, duplicate callbacks, and partial downstream failure.
  - [x] Define the single write-back contract from NestJS to Convex for payment-state changes, invoice generation outcomes, and other durable product updates.
  - [x] Keep subscription lifecycle rules extensible for Story 2.6, Story 2.7, and Epic 8 instead of hardcoding final billing policies here.

- [x] Create the files foundation for PDF and Excel processing (AC: 5, 8, 10, 11)
  - [x] Implement `files/` with separate Excel and PDF services plus template directories.
  - [x] Keep heavy file generation in NestJS; do not move Excel/PDF processing into the browser or Convex runtime.
  - [x] Add DTOs/interfaces for future report and export jobs.
  - [x] Provide at least one smoke-tested example export/import path to prove the module wiring is real.

- [x] Create the email foundation for transactional delivery (AC: 6, 8, 9, 11)
  - [x] Implement `email/` with a Resend service, template rendering helpers, and webhook/callback verification seams.
  - [x] Add starter React Email templates for a generic transactional notification and a billing/support placeholder so later stories extend existing patterns.
  - [x] Ensure email sending can be queued for retryable workloads.
  - [x] Define idempotency behavior for retryable email jobs so failures do not create duplicate user-visible notifications.

- [x] Create the Procureline caller seam from `webapp/` to `nestjs/` (AC: 2, 3, 9, 10)
  - [x] Add a new `webapp/convex/actions/` surface for outbound calls to NestJS.
  - [x] Reuse current audit and auth context rules from `_roleGuard.ts`, `_audit.ts`, and `auditLogs.ts` when creating service tokens and recording failures.
  - [x] Centralize `NESTJS_URL` and signing-secret config; do not scatter fetch logic across UI components.
  - [x] Define the matching inbound Convex-facing callback or client contract that NestJS uses when webhook/job processing must persist durable product state.
  - [x] Document the first integration targets even if some later stories have not yet wired UI screens to them.

- [x] Add focused tests and developer documentation (AC: 10, 11)
  - [x] Unit-test env validation, auth guard behavior, queue module registration, and provider wrapper edge cases.
  - [x] Integration-test authenticated REST routes, OpenAPI bootstrap, Stripe raw-body signature handling, IntaSend callback verification seams, and Convex write-back behavior after successful provider events.
  - [x] Add a short setup guide for local development showing how `webapp` and `nestjs` run together.
  - [x] Keep test/build commands explicit for the new service instead of assuming a monorepo task runner already exists.
  - [x] Add at least one failure-mode test each for duplicate webhook delivery, Redis unavailability, and partial downstream failure after provider success.

## Dev Notes

### Story Foundation

- This is the first story in Epic 2 and the first backlog story in `sprint-status.yaml`; it unlocks the technical backbone for platform administration, billing, reporting, notifications, and later operational stories.
- The epic text expects a NestJS microservice with payments, files, email, and background processing, but the live repository still contains only `webapp/` with Next.js 16 and Convex. Story 2.0 is therefore both a service bootstrap story and an integration-contract story.
- This is a backend-led foundation story. It should deliver durable seams, not full end-user billing or report workflows. Detailed subscription policies belong to Story 2.6, Story 2.7, and Epic 8.
- Epic 2 still depends on Epic 1 completion in the planning artifacts. Story 2.0 can scaffold the service boundary now, but any auth-dependent production wiring must not assume unfinished Story 1.8 or in-review Story 1.9 behavior has already stabilized.

### Current Implementation State Discovered In Code

- The repo currently has a single application package at `webapp/package.json`; there is no top-level workspace package and no `nestjs/` directory yet.
- `webapp/convex/auth.ts`, `webapp/convex/functions/_roleGuard.ts`, `webapp/convex/functions/_tenantGuard.ts`, `webapp/convex/functions/_audit.ts`, and `webapp/convex/functions/auditLogs.ts` already provide real auth context, tenant isolation, and append-only audit primitives.
- `webapp/convex/http.ts` currently exposes only Convex Auth HTTP routes. There is no existing external-services gateway or webhook surface in the repo yet.
- `webapp/convex/schema.ts` already contains `subscriptionTiers`, `tenantIsolationEvents`, and `auditLogs`, which later billing/reporting integrations should reuse instead of inventing parallel storage concepts.
- `webapp/README.md` is stale starter-template documentation that still references Clerk. Do not treat it as an implementation source of truth for Story 2.0.
- The architecture artifacts consistently place the new service at repo root as `nestjs/` and describe Convex-to-NestJS communication as the canonical integration path.

### Reuse And Anti-Reinvention Guidance

- Reuse the current audit/event vocabulary from `webapp/lib/security/audit.ts` and `webapp/convex/functions/_audit.ts`; NestJS requests should preserve actor context instead of creating a second incompatible audit model.
- Reuse project-standard error envelopes from `_bmad-output/project-context.md`: success responses return `{ success: true, data }`; failures return `{ success: false, error }`.
- Reuse Convex as the system of record for product data and authorization context. NestJS is an integration worker and orchestration boundary, not a second application database.
- Reuse `subscriptionTiers` and current tenant/platform-user records from Convex for billing context; do not create a shadow tenant store inside NestJS.
- Reuse React Email for templates because the architecture and epic artifacts already commit to it; do not introduce a different mail templating stack.
- Prefer BullMQ through NestJS's current queue integration instead of reviving legacy Bull 4 examples from older planning notes.
- Reuse one explicit NestJS-to-Convex write-back path for durable state changes. Do not let Stripe, IntaSend, file jobs, and email jobs each invent a different callback mechanism.

### Architecture Compliance

- Respect the live repo split:
  - `webapp/` remains Next.js 16 + React 19 + Convex Auth.
  - `nestjs/` becomes the dedicated external-services project.
- Follow the existing security model:
  - auth and role truth live in Convex,
  - NestJS trusts only signed server-to-server tokens,
  - webhooks bypass user auth but must verify provider signatures.
- Keep external calls off the browser when they require secrets, retries, or audit actor context.
- Keep multi-tenant boundaries explicit: user-scoped service tokens must carry `tenantId` only when relevant, and platform-admin flows must remain auditable.
- Preserve the repo's current append-only audit posture and avoid introducing mutable operational logs as the only source of truth for sensitive events.

### Security And Scope Boundaries

- Do not expose Stripe, IntaSend, Resend, or Redis credentials to the Next.js client.
- Do not make the NestJS service a general-purpose public backend for all app reads and writes. Convex remains the primary app backend.
- Do not implement full billing workflow logic, refund policies, free-tier abuse logic, or support tooling here. Story 2.0 delivers provider/module foundations and integration seams only.
- Do not create direct database persistence inside NestJS unless a later story explicitly requires a dedicated store. Current architecture assumes Convex is primary and NestJS calls back into Convex or works from request payloads.
- Do not skip idempotency for webhook processing. Stripe and payment callbacks must be safe against replay and duplicate delivery.
- Do not rely on synchronous request/response loops for long-running exports or retries; use queued jobs.
- Do not leave duplicate-event storage implicit. The implementation must define where processed provider events live and how that state survives retries and restarts.
- Do not let “provider succeeded but Convex update failed” become an undefined state. The story must drive an explicit reconciliation path for split-brain outcomes.

### Technical Requirements

- New service project:
  - Create a top-level `nestjs/` project with its own `package.json`, `src/`, `test/`, and env contract.
  - Use Node 20 LTS for the NestJS runtime.
- Bootstrap:
  - Global prefix: `/api/services`
  - Swagger/OpenAPI docs enabled
  - Global validation pipe for DTOs
  - Structured exception handling and health endpoint
- Auth:
  - Signed service JWTs for trusted callers from `webapp/convex/actions/*`
  - Request decorators for actor context
  - Clear unauthenticated/unauthorized failure codes
- Providers:
  - Stripe module wrapper
  - IntaSend module wrapper for M-Pesa and callback verification
  - Manual bank-transfer verification seam
  - Resend delivery wrapper
  - ExcelJS and PDF generation services
- Queue:
  - Redis-backed queue with retry and progress reporting
  - Queue consumers isolated from controllers
  - Explicit failed-job / dead-letter handling and documented behavior when Redis is unavailable
- Config:
  - Validate required env vars on startup
  - Include at minimum `NESTJS_PORT`, `CONVEX_URL`, `PROCURELINE_SERVICE_JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_KEY`, `RESEND_API_KEY`, `REDIS_URL`
- Webhooks:
  - Stripe signature validation must use the raw request payload
  - IntaSend callback verification must follow provider docs and remain idempotent
- Integration seam:
  - Add `webapp/convex/actions/` for outbound service calls and token creation
  - Centralize `NESTJS_URL` and auth headers there
  - Define a single durable write-back path from NestJS to Convex for webhook and job outcomes

### Library And Framework Requirements

- Web framework
  - NestJS current v11 series for new service work.
  - Use `@nestjs/config` for configuration, `@nestjs/swagger` for OpenAPI, and `@nestjs/throttler` for rate limiting.
- Queueing
  - Prefer `@nestjs/bullmq` + BullMQ for Redis-backed jobs.
- Payments
  - Use the official Stripe Node SDK.
  - Use IntaSend's official docs and supported SDK/API flow for M-Pesa collections and callbacks.
- Email
  - Use Resend with React Email templates.
- Files
  - Use ExcelJS for spreadsheet generation/parsing.
  - Use a server-side PDF library from the planned stack; keep the PDF surface abstracted so later stories can swap implementation details if template complexity requires it.
- Convex integration
  - Keep `ConvexError` on the Convex side for expected failures.
  - Use indexed Convex queries and explicit actions for NestJS calls.

### File Structure Requirements

- New top-level service structure expected:

```text
nestjs/
|-- package.json
|-- nest-cli.json
|-- tsconfig.json
|-- tsconfig.build.json
|-- .env.example
|-- src/
|   |-- main.ts
|   |-- app.module.ts
|   |-- health/
|   |-- auth/
|   |-- payments/
|   |-- files/
|   |-- email/
|   |-- queue/
|   `-- common/
`-- test/
```

- New or updated `webapp/` files expected:
  - `webapp/convex/actions/payments.ts`
  - `webapp/convex/actions/files.ts`
  - `webapp/convex/actions/email.ts`
  - `webapp/lib/...` helper for service JWT creation/config if needed
  - `webapp/.env.example` for `NESTJS_URL` and service-auth config
- Keep provider-specific code inside the NestJS service, not mixed into `webapp/convex/functions/*`.

### Testing Requirements

- NestJS unit tests:
  - auth guard token validation
  - DTO validation failures
  - config/env validation
  - queue registration and provider wrapper behavior
- NestJS integration tests:
  - authenticated `/api/services/*` endpoints
  - Swagger bootstrap
  - Stripe webhook raw-body verification path
  - IntaSend callback path
  - health endpoint
  - duplicate webhook replay protection
  - provider-success / Convex-write-failure reconciliation behavior
- `webapp` integration seam tests:
  - Convex action token creation and outbound request formatting
  - standardized error mapping back into `ConvexError`-friendly shapes where appropriate
  - NestJS callback/write-back contract handling
- Build/test commands must be explicit for the new service, for example:
  - `cd nestjs && npm test`
  - `cd nestjs && npm run build`
  - `cd webapp && npm run build`

### Critical Edge Cases

- Stripe sends the same event more than once, or sends a later lifecycle event before local billing state exists.
- IntaSend callbacks may arrive after a user retries payment, creating multiple candidate payment attempts for the same invoice.
- Two admins may attempt manual bank-transfer verification for the same payment, or manual verification may race with an automatic provider callback.
- A provider operation can succeed while the Convex write-back fails; the service must leave behind enough durable state to reconcile instead of silently drifting.
- Redis may be unavailable when a request needs queue-backed work; request-time fallback or fail-fast behavior must be explicit and tested.
- Retryable email jobs can create duplicate user-visible messages unless idempotency or delivery-state checks are defined.
- Webhook routes require raw-body handling and should not inherit the same middleware/throttle assumptions as ordinary JSON API routes.
- Queue fairness must prevent one noisy tenant or provider backlog from starving unrelated work.

### Git Intelligence Summary

- Recent work concentrated on auth, RBAC, tenant isolation, and audit foundations:
  - `a2ef84f` moved active work from Story 1.7 to Story 1.9 and touched tenant-isolation and schema paths.
  - `a58205b` completed Story 1.6 and updated Epic 2 planning artifacts.
  - `a0b0b5f` hardened sessions, proxy behavior, and login-related flows.
- The useful pattern for Story 2.0 is centralization: auth/session/audit logic was pushed into shared helpers rather than spread across UI code. Follow that same pattern for NestJS integration.
- No previous Story 2.x implementation file exists, so there is no same-epic story intelligence to inherit yet.

### Latest Tech Information

- Verified on March 9, 2026 against official docs and official package pages:
  - Next.js App Router authentication guidance still recommends using `proxy.ts` only for optimistic checks and keeping real authorization near the data layer; that supports `webapp -> Convex action -> NestJS` instead of browser-direct secret-bearing calls.
  - Convex docs still recommend indexed reads with `withIndex(...)` and `ConvexError` for expected application failures; new service integration actions should preserve those patterns.
  - NestJS official docs currently center OpenAPI via `@nestjs/swagger`, rate limiting via `@nestjs/throttler`, and queue integration via `@nestjs/bullmq`; prefer those packages over older tutorials that target legacy Bull integration.
  - The official Stripe Node SDK package page shows version `19.1.0` published on March 5, 2026; Stripe's webhook docs still require the raw request body for signature verification.
  - The official BullMQ package page shows version `5.63.0` published on February 20, 2026.
  - The official Resend Node SDK package page shows version `6.5.2` published on February 23, 2026, and current Resend docs support webhook management and idempotency-key usage.
  - IntaSend's official docs emphasize collections/checkout flows and callback-based verification for payments; the M-Pesa path should be modeled as an async callback workflow, not a synchronous "payment always completes now" assumption.

### Project Context Reference

- Still-applicable project rules from `_bmad-output/project-context.md`:
  - strict TypeScript,
  - path-alias discipline inside `webapp`,
  - Convex as the primary backend,
  - standardized NestJS response envelopes,
  - backend-first authorization and audit enforcement.
- Stale or conflicting project-context details should yield to the live repo and updated planning docs:
  - the project now runs Next.js 16 and React 19 in `webapp`,
  - there is no NestJS project yet,
  - direct browser calls to integration services should not become the default pattern.

### Project Structure Notes

- Current repo alignment:
  - `webapp/` is the only active application package.
  - `webapp/convex/` already contains auth, audit, tenant, and security primitives that Story 2.0 should extend.
- Required new alignment after Story 2.0:
  - a top-level `nestjs/` service project,
  - explicit local run/build/test instructions for both projects,
  - documented env contracts for service-to-service communication.
- Detected conflicts or variances:
  - the epic story text mentions direct Next.js-to-NestJS session-token validation, while project-context guidance prefers Convex-to-NestJS JWT service auth. Treat the JWT service-auth approach as canonical and document any direct-call exceptions explicitly if they are later required.
  - planning docs mention Railway/Render/Vercel deployment options, but this story should stay deployment-ready rather than choosing hosting-specific implementation details beyond env/setup compatibility.

### References

- [Sprint Status](_bmad-output/implementation-artifacts/sprint-status.yaml)
- [Epic 2 Source](_bmad-output/implementation-artifacts/epics/epic2/epic-02-platform-administration.md)
- [Epic Breakdown](_bmad-output/implementation-artifacts/epics/epics.md)
- [Architecture](_bmad-output/planning-artifacts/architecture.md)
- [PRD](_bmad-output/planning-artifacts/prd.md)
- [Tech Stack Decisions](_bmad-output/planning-artifacts/tech-stack-decisions.md)
- [UX Design](_bmad-output/planning-artifacts/ux-design-specification.md)
- [Project Context](_bmad-output/project-context.md)
- [Current Webapp Package](`webapp/package.json`)
- [Current Convex Schema](`webapp/convex/schema.ts`)
- [Current Convex Auth](`webapp/convex/auth.ts`)
- [Current Convex HTTP Router](`webapp/convex/http.ts`)
- [Current Audit Mutation](`webapp/convex/functions/auditLogs.ts`)
- [Current Audit Helper](`webapp/convex/functions/_audit.ts`)
- [Current Role Guard](`webapp/convex/functions/_roleGuard.ts`)
- [Current Tenant Guard](`webapp/convex/functions/_tenantGuard.ts`)
- [Current Tenant Functions](`webapp/convex/functions/tenants.ts`)
- [Current User Functions](`webapp/convex/functions/users.ts`)
- [Current Security Audit Vocabulary](`webapp/lib/security/audit.ts`)
- [Starter README To Ignore Where It Conflicts](`webapp/README.md`)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Convex Indexes Guide](https://docs.convex.dev/database/reading-data/indexes/)
- [Convex Error Handling Guide](https://docs.convex.dev/functions/error-handling/)
- [NestJS OpenAPI Docs](https://docs.nestjs.com/openapi/introduction)
- [NestJS Rate Limiting Docs](https://docs.nestjs.com/security/rate-limiting)
- [NestJS Queues Docs](https://docs.nestjs.com/techniques/queues)
- [Stripe Webhooks Docs](https://docs.stripe.com/webhooks?lang=node)
- [Stripe Node SDK](https://www.npmjs.com/package/stripe)
- [BullMQ Package](https://www.npmjs.com/package/bullmq)
- [Resend Node SDK](https://www.npmjs.com/package/resend)
- [Resend Node Sending Docs](https://resend.com/docs/send-with-nodejs)
- [Resend Webhooks Docs](https://resend.com/docs/dashboard/webhooks/introduction)
- [IntaSend Docs](https://developers.intasend.com/docs/accept-payments)

## Change Log

- 2026-03-09: Created Story 2.0 as the next ready-for-dev story, anchored to the live `webapp/` codebase and Epic 2 planning artifacts.
- 2026-03-09: Resolved the main architecture ambiguity by treating Convex-issued service JWTs as the canonical NestJS auth boundary instead of default browser-direct service calls.
- 2026-03-09: Incorporated current official guidance for NestJS queues/throttling/OpenAPI, Stripe webhook raw-body handling, Convex indexed reads, and current official package versions where they materially affect the implementation plan.
- 2026-03-09: Tightened the story with explicit write-back, idempotency, throttling-class, queue-failure, and provider-edge-case requirements so the foundation is less ambiguous during implementation.
- 2026-03-09: Implemented the NestJS external-services foundation, Convex caller seam, durable sync contract, and automated verification for build/test/codegen coverage.
- 2026-03-09: Triple-check pass corrected the service-bridge audit actor mapping to use the canonical Convex `userId` and re-ran codegen, builds, and tests.
- 2026-03-09: Final review-validation pass confirmed the review fixes, corrected a stale PDF filename test expectation, and re-ran NestJS/webapp verification.
- 2026-03-09: Review remediation pass fixed missing payment-verification claims, claim-stuck failure handling after enqueue/provider errors, overly broad fallback idempotency keys, and `rediss://` queue connection parsing before re-running NestJS build/test verification.

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Dev-story workflow: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Dev-story instructions: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Validation checklist: `_bmad/bmm/workflows/4-implementation/dev-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic sources:
  - `_bmad-output/implementation-artifacts/epics/epics.md`
  - `_bmad-output/implementation-artifacts/epics/epic2/epic-02-platform-administration.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/planning-artifacts/tech-stack-decisions.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/README.md`
  - `webapp/convex/schema.ts`
  - `webapp/convex/auth.ts`
  - `webapp/convex/http.ts`
  - `webapp/convex/functions/auditLogs.ts`
  - `webapp/convex/functions/securityAudit.ts`
  - `webapp/convex/functions/tenants.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/_audit.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/_tenantGuard.ts`
  - `webapp/lib/security/audit.ts`
- Git context:
  - `git log --oneline -5`
  - `git show --stat --name-only --format=medium -5`
- External validation sources:
  - `https://nextjs.org/docs/app/guides/authentication`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://docs.convex.dev/functions/error-handling/`
  - `https://docs.nestjs.com/openapi/introduction`
  - `https://docs.nestjs.com/security/rate-limiting`
  - `https://docs.nestjs.com/techniques/queues`
  - `https://docs.stripe.com/webhooks?lang=node`
  - `https://www.npmjs.com/package/stripe`
  - `https://www.npmjs.com/package/bullmq`
  - `https://www.npmjs.com/package/resend`
  - `https://resend.com/docs/send-with-nodejs`
  - `https://resend.com/docs/dashboard/webhooks/introduction`
  - `https://developers.intasend.com/docs/accept-payments`
- Verification commands:
  - `cmd /c npx convex codegen`
  - `cd nestjs && npm run build`
  - `cd nestjs && npm test`
  - `cd webapp && npm test`
  - `cd webapp && npm run build`

### Completion Notes List

- 2026-03-09: Identified `2-0-nestjs-microservice-foundation-external-services` as the first backlog story in sprint order.
- 2026-03-09: Confirmed there is no previous Story 2.x implementation file and no existing `nestjs/` project in the repo.
- 2026-03-09: Scaffolded a top-level `nestjs/` service with authenticated `/api/services/*` routes, Swagger bootstrap, structured envelopes, rate limiting, correlation IDs, and Redis-backed queue registration.
- 2026-03-09: Implemented payment, file, and email module foundations plus a single Convex write-back path using persisted `externalServiceSyncEvents` records for claim/complete/fail synchronization.
- 2026-03-09: Added `webapp/convex/actions/*` outbound callers, centralized service-token creation/config helpers, and audit-friendly failure handling for cross-service calls.
- 2026-03-09: Verified the implementation with `npx convex codegen`, `cd nestjs && npm run build`, `cd nestjs && npm test`, `cd webapp && npm test`, and `cd webapp && npm run build`.
- 2026-03-09: Double-check pass found one pre-existing repo lint failure in `webapp/lib/security/origins.ts:112`; it is outside the Story 2.0 diff and does not block the verified NestJS/Convex foundation changes.
- 2026-03-09: Triple-check pass tightened the service-bridge audit actor mapping to use the canonical Convex `userId` from the auth-context query before re-running verification.
- 2026-03-09: Final review-validation pass found one stale expectation in `nestjs/test/pdf.service.spec.ts`, aligned it with the current whitespace-normalization behavior, and confirmed all NestJS tests pass.
- 2026-03-09: Fixed the code-review findings by making payment verification claim before complete, failing claimed sync events when enqueue/provider work aborts, using per-request fallback event keys unless an explicit idempotency key is supplied, preserving `rediss://` TLS/db settings, and adding regression coverage for the repaired paths.

### Review Follow-ups (AI)

- [x] **[AI-Review][High]** Update IntaSend webhook signature validation to correctly ingest standard raw buffers rather than `JSON.stringify`.
- [x] **[AI-Review][Medium]** Ensure cross-service NestJS failures without JSON bodies are safely caught instead of skipping audit telemetry.
- [x] **[AI-Review][Medium]** Track previously uncommitted Convex HTTP and webhook setup files in the story File List.
- [ ] **[AI-Review][Low]** Establish stricter queue fairness logic (round-robin/tenant limits) instead of a single flat platform queue if we experience backpressure.
- [ ] **[AI-Review][Low]** Run broader end-to-end and provider-backed smoke testing beyond the current unit/integration harness before treating the external-services foundation as fully hardened in production.
- [x] **[AI-Review][Low]** Note that `constantTimeEqual` operates on UTF-16 values rather than byte strings in `convex/externalServicesHttp.ts`.

### File List

- `_bmad-output/implementation-artifacts/2-0-nestjs-microservice-foundation-external-services.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `nestjs/.env.example`
- `nestjs/.gitignore`
- `nestjs/README.md`
- `nestjs/jest.config.ts`
- `nestjs/nest-cli.json`
- `nestjs/package-lock.json`
- `nestjs/package.json`
- `nestjs/src/app.module.ts`
- `nestjs/src/auth/auth.module.ts`
- `nestjs/src/auth/service-auth.guard.ts`
- `nestjs/src/auth/service-token.service.ts`
- `nestjs/src/common/config/app-config.ts`
- `nestjs/src/common/config/env.validation.ts`
- `nestjs/src/common/constants/service-auth.ts`
- `nestjs/src/common/contracts/envelope.ts`
- `nestjs/src/common/decorators/current-role.decorator.ts`
- `nestjs/src/common/decorators/current-tenant-id.decorator.ts`
- `nestjs/src/common/decorators/current-user-id.decorator.ts`
- `nestjs/src/common/decorators/current-user.decorator.ts`
- `nestjs/src/common/filters/http-exception.filter.ts`
- `nestjs/src/common/interceptors/success-envelope.interceptor.ts`
- `nestjs/src/common/logging/app.logger.ts`
- `nestjs/src/common/logging/request-context.ts`
- `nestjs/src/common/middleware/correlation-id.middleware.ts`
- `nestjs/src/common/types/request-user.ts`
- `nestjs/src/common/utils/jwt.ts`
- `nestjs/src/email/dto/send-email.dto.ts`
- `nestjs/src/email/email-dispatch.service.ts`
- `nestjs/src/email/email.controller.ts`
- `nestjs/src/email/email.module.ts`
- `nestjs/src/email/email.service.ts`
- `nestjs/src/email/resend.provider.ts`
- `nestjs/src/email/template-renderer.service.ts`
- `nestjs/src/email/templates/billing-support.template.ts`
- `nestjs/src/email/templates/generic-notification.template.ts`
- `nestjs/src/files/dto/create-excel-export.dto.ts`
- `nestjs/src/files/dto/create-pdf.dto.ts`
- `nestjs/src/files/dto/import-excel.dto.ts`
- `nestjs/src/files/excel.service.ts`
- `nestjs/src/files/files.controller.ts`
- `nestjs/src/files/files.module.ts`
- `nestjs/src/files/files.service.ts`
- `nestjs/src/files/pdf.service.ts`
- `nestjs/src/files/templates/.gitkeep`
- `nestjs/src/files/templates/excel/.gitkeep`
- `nestjs/src/files/templates/pdf/.gitkeep`
- `nestjs/src/health/health.controller.ts`
- `nestjs/src/health/health.module.ts`
- `nestjs/src/main.ts`
- `nestjs/src/payments/dto/create-subscription.dto.ts`
- `nestjs/src/payments/dto/manual-bank-transfer.dto.ts`
- `nestjs/src/payments/dto/verify-payment.dto.ts`
- `nestjs/src/payments/payments.controller.ts`
- `nestjs/src/payments/payments.module.ts`
- `nestjs/src/payments/payments.service.ts`
- `nestjs/src/payments/providers/bank-transfer.provider.ts`
- `nestjs/src/payments/providers/intasend.provider.ts`
- `nestjs/src/payments/providers/stripe.provider.ts`
- `nestjs/src/queue/platform-queue.processor.ts`
- `nestjs/src/queue/platform-workers.module.ts`
- `nestjs/src/queue/queue.constants.ts`
- `nestjs/src/queue/queue.module.ts`
- `nestjs/src/queue/queue.service.ts`
- `nestjs/src/queue/redis-probe.service.ts`
- `nestjs/src/sync/convex-sync.module.ts`
- `nestjs/src/sync/convex-sync.service.ts`
- `nestjs/test/app.e2e.spec.ts`
- `nestjs/test/email.service.spec.ts`
- `nestjs/test/env.validation.spec.ts`
- `nestjs/test/files.service.spec.ts`
- `nestjs/test/payments.service.spec.ts`
- `nestjs/test/providers.spec.ts`
- `nestjs/test/queue.service.spec.ts`
- `nestjs/test/service-token.service.spec.ts`
- `nestjs/tsconfig.build.json`
- `nestjs/tsconfig.json`
- `webapp/.env.example`
- `webapp/.test-dist/lib/services/external-service-client.js`
- `webapp/app/pricing/page.tsx`
- `webapp/.test-dist/lib/services/procureline-service-auth.js`
- `webapp/.test-dist/tests/run-tests.js`
- `webapp/.test-dist/tests/service-bridge.test.js`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/actions/_helpers.ts`
- `webapp/convex/actions/email.ts`
- `webapp/convex/actions/files.ts`
- `webapp/convex/actions/payments.ts`
- `webapp/convex/externalServicesHttp.ts`
- `webapp/convex/functions/externalServices.ts`
- `webapp/convex/http.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/services/external-service-client.ts`
- `webapp/lib/services/procureline-service-auth.ts`
- `webapp/tests/run-tests.ts`
- `webapp/tests/service-bridge.test.ts`
- `webapp/tsconfig.tests.json`

### Story Completion Status

- Story ID: `2.0`
- Story Key: `2-0-nestjs-microservice-foundation-external-services`
- Output File: `_bmad-output/implementation-artifacts/2-0-nestjs-microservice-foundation-external-services.md`
- Final Status: `done`
- Completion Note: `NestJS external-services foundation implemented, reviewed, and remediated. High/medium review issues around sync ordering, stuck claims, fallback idempotency, and Redis TLS parsing are fixed with passing NestJS build/test coverage; broader end-to-end/provider smoke testing remains a recommended follow-up before relying on it as fully hardened.`
