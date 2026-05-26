# Story 3.10: Notification System

Status: in-progress

## Story

As a **Tenant Admin**,
I want a controlled notification inbox, preferences, and PO broadcast facility,
so that I receive actionable information without unnecessary communication volume.

## Acceptance Criteria

1. Tenant events including PO onboarding/lifecycle events, submission receipt events, and payment-due/failure events can create Tenant Admin notifications with event detail and a tenant-safe action link.
2. The tenant-admin shell displays a notification bell with unread count and opens an in-app notification center containing tenant-scoped history, priority, read state, timestamp, and actionable navigation.
3. A Tenant Admin can set email and in-app delivery preferences per supported event type and can apply `Notify for all` or `Critical only` presets.
4. A Tenant Admin can compose a broadcast for the tenant's active POs; accepted delivery channels are email and in-app, with recipient-level delivery status and read state where applicable.
5. If non-critical immediate notifications exceed ten for the recipient in a rolling 24-hour window, eligible email events are batched into a daily digest while in-app history remains complete.
6. Critical payment-failure and security-alert notifications bypass digest suppression, appear high priority in the inbox, and use both email and in-app delivery when configured requirements demand it.
7. A Tenant Admin is not sent self-action informational notifications for their own routine actions; critical/security consequences and explicit broadcast delivery confirmations are not accidentally suppressed.
8. Notification creation, preference changes, broadcast submission, delivery/retry outcomes, and read-state actions are tenant-scoped and auditable where state changes or sensitive communications require traceability.

## Tasks / Subtasks

- [ ] Add the tenant-admin notification surface to the existing shell (AC: 2-7)
  - [ ] Extend `TenantAdminDashboard` navigation/header with notification bell, unread badge, center panel/page, preference controls, and broadcast composer.
  - [ ] Provide loading, empty, digest, critical, unread/read, and failed-delivery presentation states.
- [ ] Define typed notification persistence and domain contracts (AC: 1-8)
  - [ ] Add tenant-scoped notification, preference, broadcast, recipient-delivery, and digest bookkeeping tables/indexes as necessary.
  - [ ] Store safe action targets rather than arbitrary URLs; resolve navigation within approved tenant-admin routes.
  - [ ] Provide tenant-admin query/mutation functions guarded through the existing role guard and audit helpers.
- [ ] Connect existing event producers rather than duplicating workflows (AC: 1, 5-8)
  - [ ] Integrate with existing PO invite/lifecycle, plan workflow, billing, and security event completion points.
  - [ ] Preserve existing targeted email paths from earlier stories while routing new inbox/preference logic through one notification-dispatch boundary.
- [ ] Implement outbound email, digest, and broadcast delivery (AC: 3-8)
  - [ ] Extend `queueTransactionalEmail` and matching NestJS template validation only for required notification templates.
  - [ ] Use idempotency keys for event delivery/digest runs and schedule digest processing through Convex cron or established job infrastructure.
  - [ ] Ensure provider retries or at-least-once webhook behavior never results in duplicate in-app records or broadcasts.

## Dev Notes

### Delivered Context To Extend

- Existing workflows already queue transactional emails from Convex via `actions/email.ts` into NestJS; that delivery pipeline is the foundation, not a new client-to-Resend call.
- The current email template union differs between `webapp/convex/actions/email.ts` and `nestjs/src/email/dto/send-email.dto.ts` (`plan-submission-confirmation` exists only on the Convex side). Resolve contract alignment before adding notification-specific templates.
- Story 3.3 already requires scoped PO invitation bounce notifications without implementing the full inbox; migrate or bridge those events into this center without breaking the existing behavior.
- Audit-backed tenant activity already appears in the dashboard; notifications are actionable recipient communications, not a replacement for the audit ledger.

### Technical Requirements

- All notifications include `tenantId` and recipient identity/membership scope and must be filtered by authenticated recipient access.
- Use deterministic event/idempotency keys so retried email delivery and replayed integration events remain safe.
- Store preferences by notification event category and channel; critical delivery override behavior must be explicit and visible to users.
- Broadcasting is limited to active Procurement Officers in the same tenant; invitations that are not accepted are not active PO recipients unless the product explicitly distinguishes invite messages.
- Resend documentation states webhook delivery is at least once and not guaranteed in order; delivery/read bookkeeping must tolerate duplicates and out-of-order events.

### Architecture And File Guidance

- Shell/UI: `webapp/src/components/tenant-admin/TenantAdminDashboard.tsx`, focused components under `webapp/src/components/tenant-admin/`, and new route(s) only inside the existing tenant-admin namespace.
- Backend: `webapp/convex/schema.ts`, a focused notification functions module, event producers already in tenant/PO/billing/security modules, `webapp/convex/actions/email.ts`, `webapp/convex/crons.ts`.
- Service email contract: `nestjs/src/email/dto/send-email.dto.ts` and relevant email templates/service.

### Scope Boundaries

- Do not convert the audit log into the notification store.
- Do not implement external SMS/push channels; this story requires email and in-app only.
- Do not send informational self-action alerts merely to populate the inbox.

### Manual Verification Only

- Do not add automated test tasks or automated-test acceptance criteria.
- Manually verify event-created inbox/email notifications, bell unread state, preferences/presets, PO broadcast delivery/read states, digest threshold behavior, critical bypass, self-action suppression, retries/idempotency, and tenant isolation.

### References

- [Source: ../epic-03-tenant-administration.md#Story-310-Notification-System]
- [Source: ../../../../planning-artifacts/architecture.md]
- [Source: ../../../../project-context.md]
- [Source: webapp/src/components/tenant-admin/TenantAdminDashboard.tsx]
- [Source: webapp/convex/actions/email.ts]
- [Source: webapp/convex/crons.ts]
- [Source: nestjs/src/email/dto/send-email.dto.ts]
- [Source: https://resend.com/docs/webhooks/introduction]

## Dev Agent Record

### Agent Model Used

GPT-5

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story intentionally specifies manual verification only; automated testing is excluded by user direction.
- Review fix applied: immediate notifications, broadcasts, billing reminders, and daily digest delivery now schedule messages through the existing NestJS email boundary.
- Code-review follow-up: routine self-action delivery is suppressed and tenant-admin recipient preferences now govern generated inbox/email messages; PO recipient inbox visibility still requires completion/verification.

### File List

- `webapp/convex/functions/tenantAdminOperations.ts`
- `webapp/convex/crons.ts`
- `webapp/convex/schema.ts`
