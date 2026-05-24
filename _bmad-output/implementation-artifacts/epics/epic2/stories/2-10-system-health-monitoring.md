# Story 2.10: System Health Monitoring

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Platform Admin,
I want to monitor all system health metrics,
so that I can proactively address issues before they impact users.

## Acceptance Criteria

1. Health dashboard shows real-time API latency and error rates (FR11, FR-PA7a).
2. Database health shows connection and query-performance signals (FR-PA7b).
3. Background job status and history are displayed (FR-PA7c).
4. Infrastructure CPU, memory, and storage metrics are displayed when available (FR-PA7d).
5. Backup status and history are displayed (FR-PA7e).
6. API error rate over 5% alerts Platform Admin (FR-PA7f).
7. Backup failure alerts Platform Admin (FR-PA7g).
8. SSL expiration within 30 days is prominent (FR-PA7h).
9. Maintenance windows can be scheduled and announced to users (FR-PA7i).
10. Manual backup can be initiated with progress and completion status (FR-PA7j).

## Tasks / Subtasks

- [x] Build the platform health route using existing dashboard health patterns.
- [x] Add health snapshot tables/functions for API, DB, jobs, infra, backups, SSL, and alerts.
- [x] Connect NestJS health and queue status through authenticated service calls where needed.
- [x] Add maintenance mode state and app-wide banner integration.

## Dev Notes

### Story Foundation

This story is part of Epic 2 Platform Administration and must extend the existing Platform Admin product surface rather than creating a parallel admin app. Primary route: `/platform-admin/health`.

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

### Completion Notes List

- 2026-05-24: Implemented guarded Platform Admin operations UI and Convex functions for this story as part of the coordinated Epic 2 platform-admin slice.
- 2026-05-24: Validation run: `npx convex codegen --typecheck=disable` passed; targeted ESLint for changed platform-admin files passed. Full `npm run lint` remains blocked by pre-existing unrelated lint errors in Blockly/plans/tenant-admin files.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/epics/epic2/stories/2-10-system-health-monitoring.md`
- `webapp/app/(app)/platform-admin/tenant-admins/page.tsx`
- `webapp/app/(app)/platform-admin/free-tier/page.tsx`
- `webapp/app/(app)/platform-admin/health/page.tsx`
- `webapp/app/(app)/platform-admin/security/page.tsx`
- `webapp/app/(app)/platform-admin/support/page.tsx`
- `webapp/app/(app)/platform-admin/configuration/page.tsx`
- `webapp/app/(app)/layout.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/platformAdminOperations.ts`
- `webapp/convex/crons.ts`
- `webapp/lib/shared/platform-admin/dashboard-snapshot.ts`
- `webapp/src/components/platform-admin/PlatformAdminDashboardParts.tsx`
- `webapp/src/components/platform-admin/PlatformAdminOperationsViews.tsx`

## Change Log

- 2026-05-24: Addressed senior review findings for health metrics, backup status, SSL visibility, alerts, and maintenance banner integration; moved story to done.
- 2026-05-24: Implemented story and moved to review.
- 2026-05-24: Created Story 2.10 as ready for implementation.

## Senior Developer Review (AI)

- 2026-05-24: Fixed review findings by deriving health signals from available operational snapshots/events, recording manual backup completion/progress, surfacing API/backup alerts, adding SSL configuration support, advancing maintenance-window lifecycle, and displaying active maintenance globally. Targeted TypeScript and ESLint validation passed.

## Story Completion Status

- Story ID: `2.10`
- Story Key: `2-10-system-health-monitoring`
- Output File: `_bmad-output/implementation-artifacts/epics/epic2/stories/2-10-system-health-monitoring.md`
- Final Status: `done`
- Completion Note: `Implemented guarded platform-admin UI, Convex operations, schema support, scheduled maintenance hooks, and audit coverage; automated tests were not added per product-owner instruction.`
