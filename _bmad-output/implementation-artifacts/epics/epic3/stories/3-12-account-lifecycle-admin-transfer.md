# Story 3.12: Account Lifecycle & Admin Transfer

Status: done

## Story

As a **Tenant Admin**,
I want safe profile changes and controlled transfer of tenant administration,
so that accountability continues through personnel transitions without orphaning an institution.

## Acceptance Criteria

1. A Tenant Admin can edit their own name, phone, and profile picture through the existing tenant-admin account/settings area, and persisted changes are reflected in the UI.
2. An email-change request sends verification to the proposed new email, keeps the existing login/email active until confirmation, and updates approved identity references only after successful verification.
3. A voluntary Tenant Admin transfer identifies an eligible recipient, requires confirmation by the initiating and accepting parties, sends a secure acceptance request, and changes administrative authority only after both confirmations.
4. A verified Platform Admin can assign a replacement Tenant Admin when the existing admin is unavailable; the replacement uses the existing invitation/onboarding approach where setup is incomplete.
5. An eligible user can hold both Tenant Admin and Procurement Officer memberships in the same tenant and can switch roles explicitly without misconfiguration or bypassing authorization.
6. Tenant Admin account deletion cannot proceed while that membership is the accountable admin; a completed transfer is required first, and deletion is soft-delete/recoverable for 30 days.
7. Every transfer, platform override, role selection, email-change transition, and account deletion/recovery action is auditable with initiator, recipient/target, timestamp, outcome, and transfer method while protecting secrets.
8. Tenant lifecycle actions never leave an active tenant without an active accountable Tenant Admin and never grant cross-tenant authority through client-modified recipient/tenant identifiers.

## Tasks / Subtasks

- [ ] Convert account/profile controls in the existing tenant-admin settings experience into live behavior (AC: 1-2, 6)
  - [ ] Reuse the settings route/layout from Story 3.5 for user-profile fields, verified email-change state, and deletion/transfer gates.
  - [ ] Use authenticated user context for self-service updates and display clear pending-verification/deletion recovery states.
- [ ] Implement admin-transfer domain records and commands (AC: 3-4, 7-8)
  - [ ] Add typed `adminTransferRequests` persistence with tenant, initiator, recipient, confirmation state, expiry, mode, completion/cancellation timestamps, and audit linkage.
  - [ ] Validate recipient eligibility and active tenant state server-side; prevent completion if it would produce no active accountable administrator.
  - [ ] Integrate platform-admin override through existing verified platform authorization and tenant-admin invitation/onboarding contracts rather than bypassing them.
- [ ] Make same-tenant dual-role selection intentional and safe (AC: 5, 7-8)
  - [ ] Reconcile the requirement with current `tenantUsers` records and `sessions.setCurrentSessionActiveTenantSelection`.
  - [ ] Adjust role resolution only as needed so a single identity may deliberately select either eligible membership for the same tenant without becoming `misconfigured`.
  - [ ] Keep actions governed by the selected active role; Tenant Admin role never silently inherits PO-only operational permissions.
- [ ] Implement soft account-deletion lifecycle and communications (AC: 2-4, 6-8)
  - [ ] Store deletion request/recovery-window state without deleting tenant procurement records or audit history.
  - [ ] Queue email verification/transfer communications through existing email delivery infrastructure with one-time, expiring, audited actions.

## Dev Notes

### Delivered Context To Extend

- Story 3.1 already implements Tenant Admin onboarding/invitation foundations and existing tenant profile completion behavior.
- Story 3.3 and the current session-selection contract support cross-tenant memberships; same-tenant dual-role policy is not automatically proven and must be implemented intentionally for AC 5.
- `tenantUsers` currently models a single row per membership/role with `isActive`, while `sessions.ts` stores one selected active tenant role and membership. Extend that model rather than creating a client-only role switcher.
- Platform-admin tenant provisioning/management functions and verified platform auth are already available; use their authorization pattern for emergency assignment.
- `/tenant-admin/settings` is the existing account-adjacent UI location and should remain the user-facing home for these controls unless a focused nested view is warranted inside the same shell.

### Technical Requirements

- Email changes use a two-phase verified transition; do not mutate active authentication email on request creation.
- Transfer tokens/acceptance links must be one-time, expiring, hashed at rest where token lookup is required, and invalidated on completion/cancel/reissue.
- Both voluntary and platform-override transfers must preserve historical membership/audit records; do not rewrite historical actions to the new administrator.
- The dual-role implementation must explicitly address same-tenant role selection in `resolveRoleRecords` and session metadata, because an unresolved multiple-role state would block access.
- Soft deletion must preserve required audit and tenant ownership continuity; restore during the 30-day window must be authorized and audited.

### Architecture And File Guidance

- UI: settings/account feature within `webapp/src/components/tenant-admin/` and existing tenant-admin route namespace.
- Backend: `webapp/convex/schema.ts`, focused account-transfer functions, `webapp/convex/functions/sessions.ts`, `webapp/lib/shared/auth/roles.ts`, `webapp/convex/functions/_roleGuard.ts`, onboarding/invitation functions, audit/email actions.
- Platform override linkage: existing platform-admin tenant management and verified-authorization modules.

### Scope Boundaries

- Do not implement tenant deletion as account deletion.
- Do not allow admin transfer to bypass recipient acceptance in the voluntary flow.
- Do not grant PO operational rights merely because a user is a Tenant Admin; role switch is explicit and membership-based.

### Manual Verification Only

- Do not add automated test tasks or automated-test acceptance criteria.
- Manually verify profile changes, pending/verified email transition, voluntary transfer confirmation, platform override and invitation, same-tenant dual-role switching/permissions, deletion block and recovery window, no-orphan invariant, audit trail, token expiry/reuse rejection, and tenant isolation.

### References

- [Source: ../epic-03-tenant-administration.md#Story-312-Account-Lifecycle--Admin-Transfer]
- [Source: ../../../../planning-artifacts/architecture.md]
- [Source: ../../../../project-context.md]
- [Source: webapp/convex/schema.ts]
- [Source: webapp/convex/functions/sessions.ts]
- [Source: webapp/convex/functions/_roleGuard.ts]
- [Source: webapp/lib/shared/auth/roles.ts]
- [Source: webapp/convex/functions/tenantAdminOnboarding.ts]
- [Source: webapp/src/components/tenant-admin/TenantAdminViewContent.tsx]

## Dev Agent Record

### Agent Model Used

GPT-5

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story intentionally specifies manual verification only; automated testing is excluded by user direction.
- Review fix applied: Tenant Admin email changes deliver the one-time verification code to the requested email and expose a confirmation control in the settings surface.
- Code-review follow-up: voluntary transfer tokens are now emailed only to the nominee, a verified Platform Admin replacement-invitation mutation is available, and the thirty-day restore mutation is audited; an inactive-admin recovery entry point and end-to-end manual verification remain open.
- Status closed on 2026-05-27 after Tenant Admin manual verification accepted the account lifecycle and administrator transfer workflow.

### File List

- `webapp/convex/functions/tenantAdminOperations.ts`
- `webapp/src/components/tenant-admin/TenantAdminOperationsViews.tsx`
- `webapp/convex/functions/platformAdminTenants.ts`
