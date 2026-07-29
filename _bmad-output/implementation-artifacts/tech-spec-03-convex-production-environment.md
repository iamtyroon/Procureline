---
title: 'Convex Production Environment'
status: 'review'
created: '2026-07-14'
depends_on:
  - tech-spec-01-convex-type-and-test-alignment.md
  - tech-spec-02-tenant-isolation-certification.md
---

# Tech-Spec: Convex Production Environment

## Problem

The checked-out app targets a `dev:` Convex deployment and development inbox. Production needs an isolated Convex deployment, production auth URLs, secrets, email, and service bridge configuration.

## Tasks

- [ ] Create and protect a separate production Convex deployment.
  - Systems: Convex organization/dashboard, CI secrets
  - Action: Create a production deployment; use a deploy key only in CI/dashboard; do not expose it to Vercel browser variables or reuse the developer deployment.
- [ ] Deploy validated schema/functions to production.
  - Files: `webapp/convex/schema.ts`, `webapp/convex/_generated/*`
  - Action: Run production code generation/deploy only after Specs 1–2 pass; inspect the deployed schema and run a reversible migration/backup plan before live data import.
- [ ] Configure Convex production variables.
  - Systems: Convex production environment
  - Action: Set canonical production `CONVEX_SITE_URL`, `AUTH_EMAIL_TRANSPORT=resend`, Resend sender/key values, `PROCURELINE_SERVICE_JWT_SECRET`, `PROCURELINE_CONVEX_SYNC_SECRET`, platform/admin security secrets, and `IP_HASH_SALT`. Remove `dev_inbox` mode and its secret.
- [ ] Configure auth/email URLs and test data isolation.
  - Systems: Convex Auth, Resend
  - Action: Register the production app domain/site URL and Resend sender domain; create Tenant A (University of Nairobi may be the example) and Tenant B acceptance tenants with isolated PO/DU users and run Spec 2's matrix.

## Acceptance Criteria

- [ ] Given production configuration, when inspected, then no application variable references `dev:` URLs or `AUTH_EMAIL_TRANSPORT=dev_inbox`.
- [ ] Given a production auth email flow, when a user signs up or resets a password, then links resolve to the canonical HTTPS app domain and deliver through Resend.
- [ ] Given production service calls, when Convex calls Nest and Nest syncs Convex, then both shared secrets match and invalid secrets receive 401.
- [ ] Given the two acceptance tenants, when Spec 2 runs against production, then all cross-tenant probes fail closed regardless of institution names.
