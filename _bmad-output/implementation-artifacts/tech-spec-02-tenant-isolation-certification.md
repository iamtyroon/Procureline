---
title: 'Tenant Isolation Certification'
status: 'review'
created: '2026-07-14'
depends_on:
  - tech-spec-01-convex-type-and-test-alignment.md
---

# Tech-Spec: Tenant Isolation Certification

## Problem

PO and DU accounts resolve through tenant-scoped memberships, but the central isolation classification only covers five tables and current tests exercise a pure helper with synthetic IDs. No integration proof covers every real Convex or NestJS tenant boundary. University of Nairobi is an example Tenant A only; these guarantees apply uniformly to every tenant.

## Tasks

- [ ] Expand the complete tenant-owned inventory.
  - Files: `webapp/convex/schema.ts`, `webapp/lib/backend/auth/tenant-isolation.ts`, `webapp/convex/functions/_tenantGuard.ts`
  - Action: Classify every tenant-owned table (plans, catalog, requests, reviews, consolidations, reports, exports, audit/invitation data, files) and add tenant-first index/guard contracts. Keep platform/global data explicit.
- [ ] Enforce guarded access at public Convex boundaries.
  - Files: `webapp/convex/functions/*`, `webapp/convex/actions/*`
  - Action: Audit every public query, mutation, action, HTTP action, and signed-link path; derive actor tenant from `requireTenantRole`, verify referenced records belong to it, and preserve explicit audited platform-admin bypasses only.
- [ ] Bind Nest export/file payloads to the signed actor.
  - Files: `nestjs/src/files/files.service.ts`, `nestjs/src/files/dto/create-excel-export.dto.ts`, `nestjs/src/auth/service-token.service.ts`
  - Action: Reject payload tenant, plan, consolidation, report, or file identifiers that do not belong to the verified token tenant; retain the tenant ID through queued jobs and result retrieval.
- [ ] Add a two-tenant test matrix.
  - Files: `webapp/tests/tenant-isolation.test.ts`, new Convex integration tests, Nest integration tests, `webapp/tests/run-tests.ts`
  - Action: Seed Tenant A (for example, University of Nairobi) and Tenant B, each with PO/DU/admin and distinct data; replay Tenant B IDs, tokens, links, and DTOs under Tenant A credentials across list/read/write/delete/export/file/report endpoints.
- [ ] Improve denied-probe observability.
  - Files: `webapp/convex/functions/_tenantGuard.ts`, audit tests
  - Action: Define privacy-safe query-path security-event telemetry or documented alternative without making query behavior writable; verify mutation paths persist blocked probes.

## Acceptance Criteria

- [ ] Given a Tenant A PO, DU, or tenant admin (for example, University of Nairobi), when a Tenant B resource ID is used in every supported tenant-scoped API, then the response is unauthorized/not-found and Tenant B data is unchanged.
- [ ] Given Tenant A and Tenant B export/report/file identifiers, when Tenant A presents a signed service token plus Tenant B payload values, then Nest rejects the request and creates no job/file.
- [ ] Given platform administration, when cross-tenant data is read, then only the explicit audited bypass permits it.
- [ ] Given the deployed production Convex database, when the two-tenant matrix runs, then it proves no cross-tenant disclosure, mutation, download, or queue result leakage.

## Notes

This is a release gate, not a UI-only test. Test server endpoints with authenticated identities and real database records.
