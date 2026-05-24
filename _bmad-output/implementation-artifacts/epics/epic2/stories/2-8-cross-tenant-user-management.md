# Story 2.8: Cross-Tenant User Management

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Platform Admin,
I want to search and manage users across all tenants,
so that I can handle security issues and support requests efficiently.

## Acceptance Criteria

1. Users can be searched across tenants by email, name, or tenant (FR-PA5a).
2. User details show all tenant associations (FR-PA5b).
3. Platform Admin can trigger password reset email (FR-PA5c).
4. Locked accounts can be unlocked (FR-PA5d).
5. All sessions for a user can be force-terminated (FR-PA5e).
6. User account can be deactivated for security, blocking login (FR-PA5f).
7. Tenant-wide lockout locks all tenant users (FR-PA5g).
8. User activity logs are filterable by date and action type (FR-PA5h).
9. GDPR deletion deletes or anonymizes personal data while retaining audit evidence (FR-PA5i).
10. Actions that would leave a tenant without a Tenant Admin are blocked (FR-PA5j).

## Tasks / Subtasks

- [ ] Build cross-tenant user search and detail UI.
- [ ] Add guarded Convex search queries that avoid tenant-scoped data leakage.
- [ ] Add account operations for reset, unlock, force logout, deactivate, tenant lockout, and GDPR handling.
- [ ] Centralize orphan prevention and reuse existing session/audit storage.

## Dev Notes

### Story Foundation

This story is part of Epic 2 Platform Administration and must extend the existing Platform Admin product surface rather than creating a parallel admin app. Primary route: `/platform-admin/tenant-admins`.

### Current Implementation Context

- Story 2.0 is done and established the NestJS external-service boundary for payments, email, file generation, and background work.
- Story 2.1 is done and established dedicated Platform Admin authentication, verified-admin guardrails, session security, and audit vocabulary.
- Story 2.2 is done and established the protected Platform Admin shell, dashboard layout, sidebar routes, and placeholder pages for follow-on Epic 2 work.
- Story 2.3 is marked done in sprint status and the current repo contains `PlatformAdminTenantList`, `/platform-admin/tenants`, and tenant-detail placeholder surfaces. Treat those as extension points where relevant.
- Keep hard authorization in Convex/server-side helpers. UI route protection is not sufficient for Platform Admin operations.

### Implementation Guidance

- Use `requireVerifiedPlatformAdmin` or the current verified Platform Admin guard before any privileged read or write.
- Use existing `auditLogs`, `_audit` helpers, and `AUDIT_EVENT_NAMES`; add typed event names rather than free-form strings.
- Preserve tenant isolation. Platform Admin may bypass tenant filtering only through explicit platform-admin guarded code paths.
- Keep route pages thin and put interactive UI under `webapp/src/components/platform-admin/`.
- Prefer Convex queries/mutations for application state and NestJS only where Story 2.0 service responsibilities apply: payments, email, file generation, and heavy background jobs.
- Do not add a new auth provider, billing provider, queue system, chart library, or design system for this story.
- User requested no automated tests for these stories. Do not add mandatory test tasks to the implementation checklist.

### Architecture Compliance

- Frontend: Next.js App Router, React, TypeScript, shadcn/ui/Tailwind, lucide icons where useful.
- Backend/data: Convex functions and schema with exact indexes for platform-admin list/detail queries; use bounded pagination for cross-tenant lists.
- External services: reuse the existing NestJS service boundary and Convex action patterns when calling payments, emails, exports, or queues.
- Security: every mutation must validate Platform Admin role, capture actor, require reason/confirmation for destructive actions, and write audit evidence.
- UX: extend the existing Platform Admin shell rather than creating a separate admin app or marketing-style page.

### File Structure Requirements

Expected files or areas to inspect/modify:

- `webapp/app/(app)/platform-admin/*`
- `webapp/src/components/platform-admin/*`
- `webapp/convex/functions/*`
- `webapp/convex/schema.ts`
- `webapp/lib/security/audit.ts`
- `nestjs/src/*`

### Validation Requirements

Automated tests are not required for this story per product-owner instruction.

Manual acceptance validation should still confirm:

- The Platform Admin route is reachable from the existing shell and blocked for non-platform roles.
- Each acceptance criterion has a real UI or backend behavior, not only placeholder copy.
- Privileged reads and writes fail closed without a verified Platform Admin session.
- Audit records are written for sensitive reads, writes, failures, and blocked attempts.
- Existing tenant-user flows for `/tenant-admin`, `/po`, `/du`, and shared login are not visibly regressed.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 2 Source](../epic-02-platform-administration.md)
- [Story 2.1](2-1-platform-admin-authentication-2fa.md)
- [Story 2.2](../completed/2-2-platform-admin-dashboard-shell.md)
- [Story 2.0](../completed/2-0-nestjs-microservice-foundation-external-services.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- `_bmad/core/tasks/workflow.xml`
- `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- `_bmad-output/implementation-artifacts/epics/epic2/epic-02-platform-administration.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- 2026-05-24: Created implementation-ready story context for `2-8-cross-tenant-user-management`.
- 2026-05-24: Marked automated tests as not required per product-owner instruction while retaining manual acceptance validation guidance.

### File List

- `_bmad-output/implementation-artifacts/epics/epic2/stories/2-8-cross-tenant-user-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-24: Created Story 2.8 as ready for implementation.

## Story Completion Status

- Story ID: `2.8`
- Story Key: `2-8-cross-tenant-user-management`
- Output File: `_bmad-output/implementation-artifacts/epics/epic2/stories/2-8-cross-tenant-user-management.md`
- Final Status: `ready-for-dev`
- Completion Note: `Implementation-ready story guide created from Epic 2 source with tests explicitly not required.`
