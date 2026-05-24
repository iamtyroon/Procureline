# Story 2.13: System Configuration & Feature Flags

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Platform Admin,
I want to manage system configuration and feature flags,
so that I can control platform behavior and roll out features safely.

## Acceptance Criteria

1. System configuration is viewable and updatable (FR-PA10a).
2. Feature flags can be enabled or disabled globally (FR-PA10b).
3. Feature rollout by tenant percentage is supported (FR-PA10c).
4. Subscription tier pricing can be updated (FR-PA10d).
5. Existing customers keep grandfather pricing after changes (FR-PA10e).
6. Email templates can be edited with preview (FR-PA10f).
7. Third-party integrations can be enabled or disabled (FR-PA10g).
8. Configuration version history is maintained (FR-PA10h).
9. Configuration changes can be rolled back (FR-PA10i).
10. Configuration can be exported/imported between environments (FR-PA10j).

## Tasks / Subtasks

- [x] Add configuration route/navigation and settings sections.
- [x] Add system config, feature flag, rollout, integration, and config-version records.
- [x] Implement deterministic percentage rollout using tenant ID hashing and overrides.
- [x] Wire pricing updates to subscription tiers while preserving grandfather pricing.
- [x] Add email template preview/editing through existing React Email/NestJS email stack.
- [x] Add export/import and rollback with validation and audit logs.

## Dev Notes

### Story Foundation

This story is part of Epic 2 Platform Administration and must extend the existing Platform Admin product surface rather than creating a parallel admin app. Primary route: `/platform-admin/configuration`.

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
- `_bmad-output/implementation-artifacts/epics/epic2/stories/2-13-system-configuration-feature-flags.md`
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

- 2026-05-24: Addressed senior review findings for feature rollout overrides, email preview, import/export, rollback history, and grandfather pricing evidence; moved story to done.
- 2026-05-24: Implemented story and moved to review.
- 2026-05-24: Created Story 2.13 as ready for implementation.

## Senior Developer Review (AI)

- 2026-05-24: Fixed review findings by adding tenant override persistence for feature flags, import controls, export payloads, email-template preview, rollback version entries, rollout bounds validation, and grandfather price snapshots before tier price updates. Targeted TypeScript and ESLint validation passed.

## Story Completion Status

- Story ID: `2.13`
- Story Key: `2-13-system-configuration-feature-flags`
- Output File: `_bmad-output/implementation-artifacts/epics/epic2/stories/2-13-system-configuration-feature-flags.md`
- Final Status: `done`
- Completion Note: `Implemented guarded platform-admin UI, Convex operations, schema support, scheduled maintenance hooks, and audit coverage; automated tests were not added per product-owner instruction.`
