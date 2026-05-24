# Story 2.5: Tenant Configuration & Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Platform Admin,
I want to manage tenant settings, suspend, restore, and delete tenants,
so that I can handle tenant lifecycle and troubleshooting needs.

## Acceptance Criteria

1. Tenant detail exposes editable configuration settings (FR10, FR-PA3g).
2. Suspend immediately blocks tenant access, shows Account suspended on login attempts, and logs reason (FR-PA3h).
3. Restore immediately restores access and logs the action (FR-PA3i).
4. Deletion starts a 90-day soft-delete period and schedules permanent purge after retention (FR-PA3j).
5. Storage and user-count threshold breaches at 90% alert Platform Admin (FR-PA3k, FR-PA3l).
6. Subdomain changes create a 30-day redirect from old to new subdomain (FR-PA3m).
7. Complete tenant data export can be requested and returns a download link (FR-PA3n).
8. Temporary config overrides are time-limited and audited (FR-PA3o).

## Tasks / Subtasks

- [x] Build tenant detail tabs for overview, configuration, lifecycle, alerts, redirects, and export.
- [x] Add guarded Convex mutations for config edits, suspend, restore, soft-delete, subdomain redirect, and override expiry.
- [x] Wire tenant access checks so suspended or soft-deleted tenants fail closed.
- [x] Use existing file-generation queue patterns for tenant data export where practical.

## Dev Notes

### Story Foundation

This story is part of Epic 2 Platform Administration and must extend the existing Platform Admin product surface rather than creating a parallel admin app. Primary route: `/platform-admin/tenants/[tenantId]`.

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

GPT-5 Codex

### Debug Log References

- `_bmad/core/tasks/workflow.xml`
- `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- `_bmad-output/implementation-artifacts/epics/epic2/epic-02-platform-administration.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `npx tsc --noEmit`
- `npx eslint convex/functions/platformAdminTenants.ts src/components/platform-admin/PlatformAdminTenantList.tsx src/components/platform-admin/PlatformAdminTenantProvisioningForm.tsx src/components/platform-admin/PlatformAdminTenantManagementView.tsx --ext .ts,.tsx`
- `npm run lint` (fails on pre-existing unrelated lint errors outside changed files)

### Completion Notes List

- 2026-05-24: Created implementation-ready story context for `2-5-tenant-configuration-management`.
- 2026-05-24: Marked automated tests as not required per product-owner instruction while retaining manual acceptance validation guidance.
- 2026-05-24: Implemented tenant management detail UI for configuration, lifecycle actions, alerts, redirects, temporary overrides, and export requests.
- 2026-05-24: Added guarded Convex mutations for settings edits, suspend, restore, soft-delete with 90-day purge metadata, subdomain redirect creation, override expiry, and export link generation.
- 2026-05-24: Existing tenant access guard already fails closed for non-active tenants; lifecycle changes now drive that status path immediately.
- 2026-05-24: Addressed code-review findings by adding suspended-login messaging, numeric settings validation, active-only overrides/redirect resolution, and generated tenant data export links.

### File List

- `_bmad-output/implementation-artifacts/epics/epic2/stories/2-5-tenant-configuration-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/app/(app)/platform-admin/tenants/[tenantId]/page.tsx`
- `webapp/convex/functions/_roleGuard.ts`
- `webapp/convex/functions/platformAdminTenants.ts`
- `webapp/convex/functions/tenantAdminDashboard.ts`
- `webapp/convex/functions/tenants.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/shared/auth/roles.ts`
- `webapp/lib/shared/auth/session.ts`
- `webapp/lib/shared/platform-admin/dashboard-snapshot.ts`
- `webapp/lib/shared/platform-admin/tenant-list.ts`
- `webapp/lib/shared/tenant-admin/dashboard-snapshot.ts`
- `webapp/lib/shared/security/audit.ts`
- `webapp/src/components/auth/LoginForm.tsx`
- `webapp/src/components/platform-admin/PlatformAdminTenantManagementView.tsx`
- `webapp/src/components/platform-admin/PlatformAdminTenantList.tsx`

## Change Log

- 2026-05-24: Created Story 2.5 as ready for implementation.
- 2026-05-24: Implemented Story 2.5 tenant configuration and lifecycle management; status set to review.
- 2026-05-24: Fixed senior review findings and marked Story 2.5 done.

## Senior Developer Review (AI)

- Fixed: Suspended tenants now redirect login attempts with `account_suspended`, and shared login displays "Account suspended."
- Fixed: Tenant settings mutations reject invalid fiscal months, storage limits, user limits, and budget ceilings.
- Fixed: Data export requests generate a complete JSON tenant export download link instead of a placeholder route.
- Fixed: Active subdomain redirects and temporary overrides are now filtered to unexpired records, with resolver/query support for effective configuration and redirect lookup.
- Verification: `webapp npx tsc --noEmit` passed; targeted ESLint passed for changed files.

## Story Completion Status

- Story ID: `2.5`
- Story Key: `2-5-tenant-configuration-management`
- Output File: `_bmad-output/implementation-artifacts/epics/epic2/stories/2-5-tenant-configuration-management.md`
- Final Status: `done`
- Completion Note: `Implemented guarded tenant detail management, lifecycle controls, suspended-login messaging, threshold alerts, active redirects, temporary overrides, and generated tenant data exports.`
