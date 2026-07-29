---
title: 'Vercel Production Release'
status: 'review'
created: '2026-07-14'
depends_on:
  - tech-spec-01-convex-type-and-test-alignment.md
  - tech-spec-02-tenant-isolation-certification.md
  - tech-spec-03-convex-production-environment.md
  - tech-spec-04-nestjs-redis-production-hosting.md
---

# Tech-Spec: Vercel Production Release

## Problem

The Next.js webapp builds locally but is not linked to a Vercel project, has no production environment configured, and must not be promoted before its external Convex/NestJS dependencies and isolation gates are validated.

## Tasks

- [ ] Link the Vercel project.
  - Systems: Vercel project settings
  - Action: Import the repository, set Root Directory to `webapp`, install command `npm ci`, build command `npm run build`, and use supported Node 20+.
- [ ] Configure Vercel Production environment variables.
  - Files: `webapp/.env.example`, Vercel settings
  - Action: Set canonical `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NESTJS_URL`, bridge/security secrets, Resend webhook settings, TOTP/admin secrets, `ALLOWED_ORIGINS`, and audit proxy token. Do not set dev-inbox values or deployment keys.
- [ ] Configure domain, email, and webhook surfaces.
  - Systems: DNS, Vercel, Resend, payment providers
  - Action: Attach canonical HTTPS app domain; verify Resend sending-domain DNS; configure Vercel Resend endpoint and Nest payment/email endpoint URLs with signing secrets.
- [ ] Validate preview then promote.
  - Systems: Vercel deployments
  - Action: Deploy preview first; run build, test, two-tenant isolation, login/reset, UON PO/DU workflow, report/export/file, Convex-to-Nest, Redis job, webhook, and HTTPS smoke tests. Promote the validated preview, not a rebuilt artifact.

## Acceptance Criteria

- [ ] Given Vercel production configuration, when the build runs, then it succeeds without development endpoints or secrets.
- [ ] Given the public production domain, when Tenant A users (for example, University of Nairobi) authenticate as PO or DU, then their data remains scoped to Tenant A and Tenant B probes satisfy Spec 2.
- [ ] Given release validation, when any type, integration, tenant-isolation, webhook, or service-health gate fails, then production promotion does not occur.
- [ ] Given a validated preview, when promoted, then production points to the same verified deployment artifact and post-deploy logs show no critical errors.
