# Story 3.4: PO Management - Lifecycle & Activity

Status: in-progress

## Story

As a **Tenant Admin**,
I want to control Procurement Officer lifecycle access and review PO activity,
so that access remains appropriate without losing departmental continuity or audit history.

## Acceptance Criteria

1. A Tenant Admin can open lifecycle actions from the existing PO management surface for an accepted PO membership, not for an outstanding invitation.
2. Deactivating a PO with departments in an active submission cycle displays an impact warning and requires explicit confirmation before proceeding.
3. Deactivation is blocked when the PO is the tenant's last active Procurement Officer, with the message `Cannot deactivate. At least one active PO required.`
4. A confirmed deactivation sets the PO tenant membership inactive, immediately prevents PO access through the existing role guard, preserves their departments and procurement data, and records an auditable lifecycle event.
5. A deactivated PO can be reactivated by a Tenant Admin; the restored membership is immediately eligible for login and tenant selection, and the restore event is audited.
6. A Tenant Admin can open a PO activity view showing paginated, tenant-scoped audit history filtered by date range, action type, and entity type; each result shows timestamp, action, details, and affected entity.
7. A Tenant Admin can unlock a locked PO account only when a stored security/lockout condition exists; the operation resets the relevant lockout state and is audited.
8. A PO email change uses a pending verified-change flow: the old email remains effective until the new email is verified, and both request and completion are auditable.
9. The tenant cannot assign or bulk-import an additional Procurement Officer while its single PO membership or a pending assignment exists; replacement must follow controlled lifecycle/transfer behavior.
10. All reads and writes derive the tenant from the authenticated Tenant Admin context and must never accept a client-selected tenant as authority.

## Tasks / Subtasks

- [ ] Extend the existing PO management screen into an operational lifecycle workspace (AC: 1-9)
  - [ ] Replace the inactive `Replace` / `Deactivate` presentation in `ProcurementOfficerManagementView.tsx` or the rendered PO directory path actually used by `TenantAdminDashboard`.
  - [ ] Differentiate active member rows from `poInvitations` rows so lifecycle operations never act on an unaccepted invitation.
  - [ ] Add confirmation dialogs, active-cycle impact messaging, disabled/blocked action states, activity filters, and paging in the existing tenant-admin shell.
- [ ] Implement tenant-scoped PO lifecycle mutations and queries in Convex (AC: 2-8, 10)
  - [ ] Reuse `requireTenantRole(ctx, ["tenant_admin"])`; obtain the PO via `tenantUsers` in the same tenant and require role `procurement_officer`.
  - [ ] Implement deactivate/reactivate commands with last-active-PO protection and active-cycle/departments impact data.
  - [ ] Preserve assigned `departments` and all existing plan/audit records; lifecycle changes affect membership access only.
  - [ ] Provide paginated PO activity lookup from `auditLogs` scoped by tenant and PO actor, with supported filters.
  - [ ] Add the minimum persisted security-lockout and pending-email-change data necessary if it does not already exist; do not overload invitation records for accepted-user lifecycle state.
- [ ] Enforce the single Procurement Officer tenant policy (AC: 9)
  - [ ] Remove bulk PO import from the Tenant Admin surface and reject bulk issuance at the backend boundary.
  - [ ] Reject any second PO assignment while the tenant already has a PO membership or valid pending invitation.
- [ ] Add audit and notification hooks for state-changing operations (AC: 2-9)
  - [ ] Append dot-notation audit events with actor, affected membership/user, before/after state, outcome, and tenant scope.
  - [ ] Route any user-facing email through the existing email action/NestJS service rather than direct provider calls in UI components.

## Dev Notes

### Delivered Context To Extend

- Story 3.3 already delivered `poInvitations`, procurement-officer onboarding, tenant-aware multi-membership selection, and the current PO directory data in `tenantAdminDashboard.ts`.
- The tenant-admin UI already presents lifecycle buttons in `TenantAdminViewContent.tsx`, while `ProcurementOfficerManagementView.tsx` is an additional PO-management component. Confirm the route's actual rendered path and extend it in place rather than creating another PO route.
- `tenantUsers.isActive` is already read by `_roleGuard.ts`; an inactive membership becomes inaccessible without destroying department ownership data.
- Departments already point to `procurementOfficerTenantUserId`; do not delete or reassign department records merely to deactivate access.
- `auditLogs` and `_audit.ts` are the existing durable audit path. Activity views should read those records rather than creating a second activity ledger.

### Technical Requirements

- Lifecycle commands must be transactional at the Convex mutation level: check active PO count and target membership immediately before patching.
- Deactivation means inactive membership plus audit metadata; do not physically delete user, invitation, department, submission, plan, or consolidation records.
- An active-cycle warning is a confirmation gate, not an automatic block. The last-active-PO rule is a hard block.
- PO email replacement must not update the active identity until proof of control of the new address has completed.
- Do not adopt the epic note's Papa Parse suggestion automatically; no CSV parser dependency is currently established. Use an existing parser if present at implementation time or add a narrowly justified dependency.

### Architecture And File Guidance

- Likely UI: `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`, `webapp/src/components/tenant-admin/po-management/ProcurementOfficerManagementView.tsx`.
- Likely backend: `webapp/convex/functions/tenantAdminDashboard.ts`, a focused tenant-admin PO lifecycle function module, `webapp/convex/schema.ts`, `webapp/convex/functions/_roleGuard.ts`, `webapp/convex/functions/_audit.ts`.
- Reuse onboarding/email behavior from `webapp/convex/functions/procurementOfficerOnboarding.ts` and `webapp/convex/actions/email.ts`.
- Keep feature components in the tenant-admin namespace and use the existing shadcn/Radix UI building blocks.

### Scope Boundaries

- Do not rebuild invitation issuance or onboarding already owned by Story 3.3.
- Do not implement a general notification center; Story 3.10 owns notification preference and inbox functionality.
- Do not assign departments to alternative POs automatically on deactivation; this story preserves data and surfaces impact.

### Manual Verification Only

- Per project direction for this story-writing batch, do not add automated test tasks or automated-test acceptance criteria.
- Manually verify active-cycle warning and confirmation, final-active-PO block, immediate access removal and restoration, preserved department records, activity filtering/paging, unlock, pending email verification behavior, single-seat assignment enforcement, absence of bulk import, and audit visibility.

### References

- [Source: ../epic-03-tenant-administration.md#Story-34-PO-Management---Lifecycle--Activity]
- [Source: ../../../../planning-artifacts/architecture.md]
- [Source: ../../../../project-context.md]
- [Source: webapp/src/components/tenant-admin/TenantAdminViewContent.tsx]
- [Source: webapp/convex/functions/tenantAdminDashboard.ts]
- [Source: webapp/convex/functions/_roleGuard.ts]
- [Source: webapp/convex/schema.ts]
- [Source: https://resend.com/docs/webhooks/introduction]

## Dev Agent Record

### Agent Model Used

GPT-5

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story intentionally specifies manual verification only; automated testing is excluded by user direction.
- Review fix applied: PO verified-email changes now queue the proof token to the proposed destination address instead of exposing it to the requesting administrator.
- Code-review follow-up: activity filters and paging are now wired in the rendered PO workspace; status remains in progress until a real PO lockout-producing authentication path and browser verification are completed.
- Product-rule follow-up: the PO management view now represents one accountable Procurement Officer per tenant; bulk import is removed and additional assignment is server-blocked.

### File List

- `webapp/convex/functions/tenantAdminOperations.ts`
- `webapp/src/components/tenant-admin/po-management/ProcurementOfficerManagementView.tsx`
