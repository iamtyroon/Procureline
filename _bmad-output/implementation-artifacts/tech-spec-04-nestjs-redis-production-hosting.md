---
title: 'NestJS and Redis Production Hosting'
status: 'review'
created: '2026-07-14'
depends_on:
  - tech-spec-02-tenant-isolation-certification.md
  - tech-spec-03-convex-production-environment.md
---

# Tech-Spec: NestJS and Redis Production Hosting

## Problem

NestJS/BullMQ is a persistent integration service and cannot run as a Vercel function. The repository has only development Docker configuration, and the service currently expects `NESTJS_PORT` rather than a platform-provided `PORT`.

## Tasks

- [ ] Add a production runtime artifact.
  - Files: `nestjs/Dockerfile` (new), `nestjs/package.json`
  - Action: Build with `npm ci && npm run build`; run `node dist/main.js` under a non-root production image. Do not use `Dockerfile.dev`.
- [ ] Make port and production behavior host-compatible.
  - Files: `nestjs/src/main.ts`, `nestjs/src/common/config/env.validation.ts`, `nestjs/.env.example`
  - Action: Accept platform `PORT` with an explicit `NESTJS_PORT` fallback; disable Swagger by default in production and document protected diagnostics.
- [ ] Provision managed durable Redis and configure secrets.
  - Systems: selected container host and managed Redis
  - Action: Use authenticated TLS Redis (`rediss://` where supported), persistent storage/backup, least-privilege network rules, and monitor `/api/services/health` and `/api/services/metrics`.
- [ ] Configure and verify integrations.
  - Files: `nestjs/.env.example`, payment/email module config
  - Action: Set production `CONVEX_URL`, exact bridge secrets, `REDIS_URL`, payment keys, Resend settings, canonical `NESTJS_URL`, and `SWAGGER_ENABLED=false`; configure signed provider webhooks.

## Acceptance Criteria

- [ ] Given a production deployment, when the host supplies only `PORT`, then Nest starts and its health endpoint reports healthy Redis connectivity.
- [ ] Given a queued export/email/payment job, when the Nest service restarts, then durable Redis retains/retries it according to the configured policy.
- [ ] Given a Tenant A-signed service token (University of Nairobi may be the example) with Tenant B values in its DTO, when Nest receives it, then Spec 2's tenant-bound payload enforcement rejects it.
- [ ] Given signed Stripe, IntaSend, and Resend test events, when sent to the public HTTPS service, then valid events process and invalid signatures fail.
