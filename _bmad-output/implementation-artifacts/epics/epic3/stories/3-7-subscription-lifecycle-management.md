# Story 3.7: Subscription Lifecycle Management

Status: in-progress

## Story

As a **Tenant Admin**,
I want to manage subscription transitions and resolve payment interruptions,
so that institutional access matches the purchased plan and business continuity rules.

## Acceptance Criteria

1. When a verified billing failure is recorded, the tenant enters a seven-day `grace_period`, retains full application access during that window, displays payment-recovery guidance, and receives deduplicated daily reminders.
2. When the grace period expires without verified recovery, the tenant enters suspended read-only access rather than silent data loss, and the Tenant Admin sees a subscription-suspended banner with a valid payment/recovery path.
3. When a tenant remains suspended for 90 days, the system retains its data, records it for deletion review, and sends a final warning; this story does not physically purge tenant procurement data.
4. An eligible Tenant Admin can upgrade Free to Starter or Starter to Professional with immediate feature availability after successful provider confirmation.
5. A mid-cycle paid upgrade shows a clear prorated amount/basis before confirmation and records the resulting billing state after provider success.
6. A downgrade request is scheduled for the next renewal date; current paid capabilities remain until the effective date.
7. A downgrade is blocked when current live usage exceeds any target-tier limit, with specific current-versus-allowed values for each blocking resource.
8. Renewal reminders are delivered at 30 days and 7 days before a due renewal with amount and date when billing data is available, with idempotency preventing duplicates.
9. Professional-to-Enterprise transition is not an online checkout; it displays `Contact Sales` and submits prefilled tenant context through the approved support/contact path.
10. All subscription mutations are tenant-admin authorized, provider/payment changes are auditable, and platform-admin operational controls remain independently authorized.

## Tasks / Subtasks

- [ ] Add tenant-side subscription lifecycle UI within the billing experience (AC: 1-9)
  - [ ] Extend the Story 3.6 billing workspace with current state banners, upgrade/downgrade dialogs, proration disclosure, scheduled-change display, usage-block details, renewal messaging, and Enterprise contact action.
  - [ ] Maintain truthful pending/provider-failure states; no optimistic plan unlock before durable provider confirmation.
- [ ] Implement tenant-authorized lifecycle functions and schema additions (AC: 1-10)
  - [ ] Reuse existing tenant subscription fields/status values and add only required pending downgrade, reminder, deletion-review, or proration metadata.
  - [ ] Use canonical tier limits and current usage contract from Story 3.6 to assess downgrade eligibility.
  - [ ] Restrict self-service transitions to allowed tenant operations; do not expose platform batch/status override mutations.
- [ ] Extend delivered billing service workflows (AC: 1, 4-6, 10)
  - [ ] Reuse `actions/payments.ts`, NestJS Payments service/provider integration, signature-verified webhooks, and Convex durable-change processing.
  - [ ] Support idempotent upgrade/proration intent metadata and effective-date downgrade processing.
- [ ] Schedule lifecycle maintenance and communications (AC: 1-3, 8-9)
  - [ ] Extend existing billing cron maintenance for grace expiration, due downgrade application, renewal reminders, and 90-day deletion-review marking.
  - [ ] Queue emails through the delivered email service and audit state transitions/reminders without duplicating notifications.

## Dev Notes

### Delivered Context To Extend

- `tenants` already stores `subscriptionStatus`, amount/currency/cycle/method, next billing date, grace-period end, and last payment failure.
- `platformAdminSubscriptions.ts` already writes active/grace/suspended subscription state and has scheduled maintenance plus reconciliation; tenant-side behavior should build on the same data model without giving tenant admins platform privileges.
- `externalServices.ts` already translates provider events into tenant subscription updates and creates the seven-day grace period on payment failure.
- `crons.ts` already runs subscription billing maintenance daily and reconciliation processing at intervals.

### Technical Requirements

- Align the lifecycle with existing stored status names: `active`, `trialing`, `past_due`, `grace_period`, `suspended`, and `cancelled`; avoid introducing a separate `churned` state unless the full existing status consumers are migrated.
- A payment failure can arrive asynchronously through Stripe or IntaSend; writebacks must be idempotent and provider-confirmed.
- Reconcile the epic's read-only suspension requirement with `_roleGuard.ts`, which currently denies a suspended tenant entirely. Implementation must introduce an explicit subscription-suspended read-only authorization mode or document an intentional product correction before claiming AC 2.
- Scheduled deletion review is not data purge. Actual purge requires separate retention approval and platform authorization.

### Architecture And File Guidance

- UI: tenant-admin billing feature established by Story 3.6.
- Convex: `webapp/convex/schema.ts`, tenant-admin billing/subscription functions, `webapp/convex/functions/externalServices.ts`, `webapp/convex/crons.ts`.
- Services: `nestjs/src/payments/` providers/controller/service; existing email action and NestJS templates for reminders.
- Guard implications: `webapp/convex/functions/_roleGuard.ts` and shared auth route behavior must reflect read-only suspension requirements consistently.

### Scope Boundaries

- Do not recreate platform-admin subscription operations in the tenant interface.
- Do not implement destructive deletion after suspension.
- Do not treat Enterprise custom pricing as instant self-service checkout.

### Manual Verification Only

- No automated test tasks or automated-test acceptance criteria are to be included.
- Manually verify provider-confirmed upgrade, prorated disclosure, scheduled downgrade, limit-blocked downgrade, grace reminders, read-only suspension handling, 90-day review marker/final warning, renewal reminders, Enterprise contact path, audit history, and tenant isolation.

### References

- [Source: ../epic-03-tenant-administration.md#Story-37-Subscription-Lifecycle-Management]
- [Source: ../../../../planning-artifacts/architecture.md]
- [Source: ../../../../project-context.md]
- [Source: webapp/convex/schema.ts]
- [Source: webapp/convex/functions/platformAdminSubscriptions.ts]
- [Source: webapp/convex/functions/externalServices.ts]
- [Source: webapp/convex/functions/_roleGuard.ts]
- [Source: webapp/convex/crons.ts]
- [Source: nestjs/src/payments/payments.service.ts]
- [Source: https://docs.stripe.com/billing/subscriptions/webhooks]

## Dev Agent Record

### Agent Model Used

GPT-5

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story intentionally specifies manual verification only; automated testing is excluded by user direction.
- Code-review follow-up: paid upgrades now disclose computed proration and hand off to the existing provider checkout action, while downgrades remain renewal scheduled; live provider-confirmed transition verification remains open.

### File List

- `webapp/convex/functions/tenantAdminOperations.ts`
- `webapp/src/components/tenant-admin/TenantAdminOperationsViews.tsx`
- `webapp/convex/actions/payments.ts`
