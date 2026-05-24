# Story 2.7: Payment Verification & Processing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Platform Admin,
I want to verify and process payments across all methods,
so that billing is accurate and tenants maintain access appropriately.

## Acceptance Criteria

1. Bank transfers can be manually marked verified and update tenant subscription state (FR-PA4c).
2. M-Pesa reconciliation runs daily and retries failures up to 3 times (FR-PA4d).
3. Stripe webhooks process through retry queue and update subscriptions automatically (FR-PA4e).
4. Refund initiation triggers approval workflow and pro-rated calculation (FR-PA4f, FR-PA4g).
5. Enterprise custom pricing overrides standard tier pricing (FR-PA4h).
6. Failed payments notify Tenant Admin and move tenant to a 7-day grace period (FR-PA4i, FR-PA4j).
7. Grace-period expiry suspends tenant automatically; verified payment restores suspended tenant immediately (FR-PA4k, FR-PA4l).
8. Invoice generation runs with retry on failure (FR-PA4m).
9. Batch subscription status update is available (FR-PA4n).
10. Every billing action writes billing audit and reconciliation records (FR-PA4o).

## Tasks / Subtasks

- [x] Extend NestJS payment modules for Stripe, IntaSend, bank transfers, refunds, and invoices.
- [x] Preserve service-to-service auth boundaries from Story 2.0.
- [x] Add Convex billing records, reconciliation records, grace-period fields, and audit events.
- [x] Wire platform UI controls for verification, refunds, custom pricing, and batch status updates.

## Dev Notes

### Story Foundation

This story is part of Epic 2 Platform Administration and must extend the existing Platform Admin product surface rather than creating a parallel admin app. Primary route: `/platform-admin/subscriptions`.

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
- `nestjs/src/payments/dto/billing-operations.dto.ts`
- `nestjs/src/payments/payments.controller.ts`
- `nestjs/src/payments/payments.service.ts`
- `webapp/convex/functions/platformAdminSubscriptions.ts`
- `webapp/src/components/platform-admin/PlatformAdminSubscriptionsView.tsx`
- `webapp/convex/schema.ts`
- `webapp/lib/shared/security/audit.ts`
- `webapp/convex/crons.ts`

### Completion Notes List

- 2026-05-24: Created implementation-ready story context for `2-7-payment-verification-processing`.
- 2026-05-24: Marked automated tests as not required per product-owner instruction while retaining manual acceptance validation guidance.
- 2026-05-24: Added platform billing mutations for manual bank-transfer verification, provider payment recording, failed-payment grace period handling, refund approval requests with prorating, enterprise custom pricing, invoice queueing, reconciliation queueing, batch status updates, and grace-period expiry.
- 2026-05-24: Added daily scheduled billing maintenance to queue M-Pesa reconciliation with three attempts and suspend expired grace-period tenants.
- 2026-05-24: Extended NestJS service-auth payment endpoints for reconciliation, refund approval, and invoice generation using the existing Convex sync event boundary.
- 2026-05-24: Validation: `npx convex codegen --typecheck=disable` passed; `webapp npm run lint` is blocked by pre-existing ESLint failures outside this story; `nestjs npm run lint` passed.
- 2026-05-24: Senior review fixes applied: provider webhook durable changes now update subscription state, queued billing reconciliations are processed on schedule with attempt tracking, and billing mutations validate direct-call input.

### File List

- `_bmad-output/implementation-artifacts/epics/epic2/stories/2-7-payment-verification-processing.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `nestjs/src/payments/dto/billing-operations.dto.ts`
- `nestjs/src/payments/payments.controller.ts`
- `nestjs/src/payments/payments.service.ts`
- `webapp/app/(app)/platform-admin/subscriptions/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/crons.ts`
- `webapp/convex/functions/externalServices.ts`
- `webapp/convex/functions/platformAdminSubscriptions.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/backend/platform-admin/dashboard-access-token.ts`
- `webapp/lib/shared/security/audit.ts`
- `webapp/src/components/platform-admin/PlatformAdminSubscriptionsView.tsx`

## Change Log

- 2026-05-24: Created Story 2.7 as ready for implementation.
- 2026-05-24: Implemented payment verification and processing controls and moved story to review.
- 2026-05-24: Applied senior review fixes and moved story to done.

## Story Completion Status

- Story ID: `2.7`
- Story Key: `2-7-payment-verification-processing`
- Output File: `_bmad-output/implementation-artifacts/epics/epic2/stories/2-7-payment-verification-processing.md`
- Final Status: `done`
- Completion Note: `Implemented and review-fixed platform billing verification, reconciliation processing, refund, invoice, custom-pricing, grace-period, batch status, and provider webhook subscription update workflows.`

## Senior Developer Review (AI)

- 2026-05-24: Fixed all review findings for Story 2.7.
- Added provider webhook durable subscription update changes for Stripe and IntaSend callbacks through the existing NestJS-to-Convex sync boundary.
- Added Convex-side processing for due billing reconciliation records with attempt tracking and scheduled execution.
- Kept M-Pesa daily reconciliation queued by billing maintenance and added a 30-minute processor for due billing reconciliation work.
- Added backend validation for direct mutation calls that record provider payments, failed payments, refunds, and bank-transfer verification.
- Validation: `npx convex codegen --typecheck=disable` passed; targeted ESLint for touched webapp files passed; `nestjs npm run lint` passed. Full `webapp npm run lint` remains blocked by pre-existing unrelated lint errors.
