---
title: 'Production Deployment Readiness and Tenant Isolation'
slug: 'production-deployment-readiness-tenant-isolation'
created: '2026-07-14'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Next.js 16
  - Vercel
  - Convex 1.31.7 (resolved)
  - '@convex-dev/auth 0.0.92'
  - NestJS 11
  - Redis
files_to_modify:
  - webapp/package.json
  - webapp/package-lock.json
  - webapp/tsconfig.tests.json
  - webapp/convex/schema.ts
  - webapp/convex/_generated/*
  - webapp/convex/functions/_roleGuard.ts
  - webapp/convex/functions/_tenantGuard.ts
  - webapp/lib/backend/auth/tenant-isolation.ts
  - webapp/tests/tenant-isolation.test.ts
  - webapp/tests/run-tests.ts
  - nestjs/src/files/files.service.ts
  - nestjs/src/common/config/env.validation.ts
  - nestjs/src/main.ts
  - nestjs/Dockerfile
  - webapp/.env.example
  - nestjs/.env.example
code_patterns:
  - tenantId-derived authorization via requireTenantRole
  - tenant-first schema indexes and guarded record access
  - Convex generated schema types; never hand-edit generated files
  - Convex-to-NestJS signed service calls
  - provider-specific environment variables and server-side secrets
test_patterns:
  - separate Convex typecheck and deterministic Node tests
  - two-tenant integration and production smoke tests
  - tenant-scoped authorization, tampered-ID, and signed service-payload tests
---

# Tech-Spec: Production Deployment Readiness and Tenant Isolation

**Created:** 2026-07-14

## Overview

### Problem Statement

Procureline's Next.js production build succeeds, but automated tests fail in the Convex TypeScript surface, the checkout is not linked to a Vercel project, development email and Convex settings remain selected locally, and the NestJS/Redis service has no production hosting plan. Tenant isolation is represented throughout the codebase but has not yet been proven with a complete cross-tenant test suite. Any Tenant A (for example, University of Nairobi) must never see, alter, export, or receive data belonging to Tenant B, including through PO, DU, tenant-admin, file, report, email, or service-bridge paths.

### Solution

Create five implementation-ready, independently executable technical specs: Convex type alignment; tenant-isolation verification; production Convex accounts/database environments; NestJS/Redis production hosting; and Vercel production configuration/release validation. Treat passing tenant isolation tests and production-environment checks as required release gates.

### Scope

**In Scope:**

- Spec 1: Repair Convex schema and generated-type alignment so the webapp test gate passes.
- Spec 2: Add end-to-end tenant-isolation authorization tests using Tenant A (for example, University of Nairobi) and Tenant B.
- Spec 3: Provision and configure Convex production deployment, production auth/email/secrets, and data migration verification.
- Spec 4: Deploy NestJS and Redis outside Vercel with HTTPS, persistent Redis, secrets, health checks, and service-auth validation.
- Spec 5: Link the webapp to Vercel, configure production variables/domains/webhooks, deploy preview, validate release gates, and promote production.

**Out of Scope:**

- Changing product features or tenant role permissions beyond closing verified isolation gaps.
- Moving the Convex database or NestJS service into Vercel.
- Executing a production deployment or creating provider accounts in this specification workflow.

## Context for Development

### Codebase Patterns

- `requireTenantRole` resolves the active authenticated membership on every request and supplies the server-derived `tenantId`; PO and DU memberships are stored in `tenantUsers`, while DU profiles also bind a department.
- `_tenantGuard` fails closed for direct cross-tenant records and makes platform-admin access an explicit audited bypass. Its central classification currently covers only five tenant-owned tables, not the full tenant-owned schema.
- Convex schema composition with `authTables` currently collapses generated data-model types because the resolved Convex/Auth packages are incompatible; `NodeNext` tests also interpret plain Convex `.ts` files as CommonJS while they import ESM-only packages.
- Convex actions sign NestJS requests with actor role and tenant claims. Nest verifies the token, but its file/export DTO boundary does not independently enforce that payload IDs/tenant IDs match the signed actor.
- The Next.js app is `webapp/`; Convex functions and schema are co-located in `webapp/convex/`; the integration service is the sibling `nestjs/` package. Production hosting is Vercel + Convex Cloud + a separate persistent NestJS/Redis service.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `webapp/package.json` | Next.js build/test entry points |
| `webapp/convex/schema.ts` | Convex schema and generated-type source |
| `webapp/convex/_generated/` | Generated Convex API/data-model types |
| `webapp/lib/backend/auth/tenant-isolation.ts` | Central tenant access decisions |
| `webapp/convex/functions/_roleGuard.ts` | Authenticated tenant/role guard |
| `webapp/convex/functions/_tenantGuard.ts` | Record-level tenant enforcement and isolation auditing |
| `webapp/convex/actions/_helpers.ts` | Signed actor context sent to NestJS |
| `webapp/tests/tenant-isolation.test.ts` | Existing pure-helper coverage to expand into integration coverage |
| `nestjs/src/auth/service-token.service.ts` | NestJS signed-service token verification |
| `nestjs/src/files/files.service.ts` | Export/file boundary requiring tenant-claim enforcement |
| `nestjs/src/common/config/env.validation.ts` | Production service configuration contract |
| `nestjs/src/main.ts` | Port and Swagger production behavior |
| `webapp/.env.example` | Webapp environment contract |
| `nestjs/.env.example` | Service environment contract |
| `compose.yaml` | Local-only service topology |

### Technical Decisions

- A Vercel production deployment is not eligible until the local test gate and tenant-isolation release tests pass.
- Tenant context must come from authenticated server-side claims/guard results, never a client-controlled `tenantId`.
- The same production URL and secret values must be configured in the service that consumes them: Vercel, Convex, NestJS host, or Resend.
- Create a separate Convex production deployment and never reuse the active `dev:` deployment; do not ship development inbox configuration to production.
- Vercel will host only Next.js. NestJS/BullMQ must run as a long-lived Node service against durable authenticated Redis; add a production artifact and map provider `PORT` to the service port.
- Establish a generic Tenant A-versus-Tenant B integration matrix (University of Nairobi may be the example) for PO, DU, tenant-admin, report/export/file, and service-bridge access before production promotion.

## Implementation Plan

### Tasks

- [ ] Implement [`tech-spec-01-convex-type-and-test-alignment.md`](tech-spec-01-convex-type-and-test-alignment.md).
- [ ] Implement [`tech-spec-02-tenant-isolation-certification.md`](tech-spec-02-tenant-isolation-certification.md).
- [ ] Implement [`tech-spec-03-convex-production-environment.md`](tech-spec-03-convex-production-environment.md).
- [ ] Implement [`tech-spec-04-nestjs-redis-production-hosting.md`](tech-spec-04-nestjs-redis-production-hosting.md).
- [ ] Implement [`tech-spec-05-vercel-production-release.md`](tech-spec-05-vercel-production-release.md).

Implement in numerical order. Specs 1 and 2 are mandatory gates for Specs 3–5; Spec 5 may only promote after every verification check is green.

### Acceptance Criteria

- [ ] AC 1: Given all five specs, when a fresh developer reads each file, then every task names its target files, exact action, dependencies, and verification command.
- [ ] AC 2: Given Tenant A (for example, University of Nairobi) and Tenant B with separate PO and DU accounts, when any tenant-scoped endpoint receives the other tenant's ID or token, then it returns unauthorized/not-found, discloses no data, and leaves the target data unchanged.
- [ ] AC 3: Given the production release workflow, when production promotion is attempted, then it is blocked until Convex type checks, deterministic tests, two-tenant integration tests, service-bridge checks, and preview smoke tests pass.

## Additional Context

### Dependencies

- Access to Vercel, Convex, DNS, Resend, and the selected NestJS/Redis hosting provider is required to execute the final production rollout.

### Testing Strategy

- Run `npm run build` and `npm test` in `webapp/`.
- Test Tenant A (University of Nairobi may be the example) and Tenant B against every tenant-scoped read/write/export/attachment/service route.
- Run production smoke tests on a Vercel preview before promotion.

### Notes

The current `npm run build` passed on 2026-07-14; `npm test` failed with Convex module-mode and generated-schema/index typing errors.

The five standalone specifications are linked from the implementation plan above.
