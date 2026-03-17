# Tenant Admin Story Coverage Audit

Date: 2026-03-17
Scope: Audit the implemented tenant-admin workspace against Epic 3 story ownership so sprint tracking reflects code that has already landed.

## Summary

The tenant-admin implementation is no longer limited to Story 3.2's dashboard shell. The app now includes real tenant-admin routes and screens for PO Management, Departmental Users, Departments, Billing, Settings, Audit Log, and Reports, all rendered through the shared tenant-admin shell and live snapshot contract.

Only Story 3.2 is currently treated as fully delivered. Several later Epic 3 stories now have meaningful partial frontend implementation, but they should remain `backlog` in the sprint tracker because the backend workflows and acceptance-criteria depth are not delivered yet.

## Story Mapping

### Story 3.2 - Tenant Admin Dashboard

Recommended tracker status: `done`

Implemented:
- Shared tenant-admin shell with prototype-aligned sidebar, header, collapse behavior, and theme-aware layout.
- Real `/tenant-admin` dashboard with summary cards, fiscal-year selector, cycle/timeline states, recent activity, and live tenant snapshot data.
- Honest empty and stale-data states instead of prototype mock data.

Primary evidence:
- `webapp/src/components/tenant-admin/TenantAdminDashboard.tsx`
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`
- `webapp/convex/functions/tenantAdminDashboard.ts`
- `webapp/lib/tenant-admin/dashboard-snapshot.ts`

### Story 3.3 - PO Management: Add & Invite

Recommended tracker status: `backlog`
Implementation note: `frontend-complete`

Implemented:
- Real `/tenant-admin/po-management` route.
- PO management screen with directory-style card layout, Add PO CTA, and PO identity/status display.

Still missing:
- Create/invite form workflow.
- Invitation issuance, resend, activation code handling, bounce/expiry states, and persistence.

Primary evidence:
- `webapp/app/(app)/tenant-admin/po-management/page.tsx`
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`
- `webapp/convex/functions/tenantAdminDashboard.ts`

### Story 3.4 - PO Management: Lifecycle & Activity

Recommended tracker status: `backlog`
Implementation note: `frontend-complete`

Implemented:
- Edit, Replace, and Deactivate action affordances in the PO management surface.
- PO last-seen and activity-adjacent metadata in the live directory snapshot.

Still missing:
- Lifecycle mutations and safeguards.
- Last-active-PO enforcement.
- Unlock/reactivate behavior.
- Paged PO activity log with filters.

Primary evidence:
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`
- `webapp/convex/functions/tenantAdminDashboard.ts`

### Story 3.5 - Institutional Settings Configuration

Recommended tracker status: `backlog`
Implementation note: `frontend-complete`

Implemented:
- Real `/tenant-admin/settings` route.
- Institution settings and tenant-admin profile surfaces in the tenant-admin shell.

Still missing:
- Editable configuration persistence.
- Fiscal-year naming/configuration controls.
- Compliance targets, validation, branding upload, and audited save behavior.

Primary evidence:
- `webapp/app/(app)/tenant-admin/settings/page.tsx`
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`

### Story 3.6 - Billing Dashboard & Payment Methods

Recommended tracker status: `backlog`
Implementation note: `frontend-complete`

Implemented:
- Real `/tenant-admin/billing` route.
- Current plan, usage, invoice-history, and tax/payment information layout matching the tenant-admin prototype direction.

Still missing:
- Live billing provider data.
- Real invoices and download flow.
- Payment method management and warnings.

Primary evidence:
- `webapp/app/(app)/tenant-admin/billing/page.tsx`
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`

### Story 3.8 - Report Generation System

Recommended tracker status: `backlog`
Implementation note: `frontend-complete`

Implemented:
- Real `/tenant-admin/reports` route.
- Report selection cards and export staging surface in the tenant-admin shell.

Still missing:
- Parameterized generation flow.
- Tier gating, row-limit enforcement, background processing, downloads, and scheduling.

Primary evidence:
- `webapp/app/(app)/tenant-admin/reports/page.tsx`
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`

### Story 3.9 - Cross-Institutional Visibility

Recommended tracker status: `backlog`
Implementation note: `frontend-complete`

Implemented:
- Real `/tenant-admin/department-users` route.
- Real `/tenant-admin/departments` route.
- Tenant-wide read-only oversight views for departmental users and department status.
- Department and user search/filter behavior inside the tenant-admin shell.

Still missing:
- PO-based filtering, drill-down detail views, anomaly detection, GDPR export, and large-list virtualization.

Primary evidence:
- `webapp/app/(app)/tenant-admin/department-users/page.tsx`
- `webapp/app/(app)/tenant-admin/departments/page.tsx`
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`
- `webapp/convex/functions/tenantAdminDashboard.ts`

### Story 3.11 - Security & Session Management

Recommended tracker status: `backlog`
Implementation note: `frontend-complete`

Implemented:
- Real `/tenant-admin/audit-log` route.
- Searchable tenant audit-log surface with export affordance in the tenant-admin shell.

Still missing:
- Login history, active sessions, 2FA, suspicious-access alerts, and actual export delivery.

Primary evidence:
- `webapp/app/(app)/tenant-admin/audit-log/page.tsx`
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`

### Story 3.12 - Account Lifecycle & Admin Transfer

Recommended tracker status: `backlog`
Implementation note: `frontend-complete`

Implemented:
- Tenant-admin profile card and account action affordances inside Settings.

Still missing:
- Profile update persistence.
- Email change and verification flow.
- Admin transfer workflow and safeguards.
- Deletion/transfer constraints.

Primary evidence:
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`

## Stories Left Unchanged

These remain `backlog` because the current tenant-admin implementation does not yet cover meaningful acceptance-criteria depth for them:

- Story 3.1 - Tenant Admin Institution Setup Flow
- Story 3.7 - Subscription Lifecycle Management
- Story 3.10 - Notification System

## Tracker Decision

Update `sprint-status.yaml` so that:
- Story 3.2 remains the delivered tenant-admin dashboard story.
- Stories 3.3, 3.4, 3.5, 3.6, 3.8, 3.9, 3.11, and 3.12 remain `backlog`, with this audit serving as the reference that their frontend shells are already implemented.

This keeps the tracker aligned with the BMAD status model without overstating partially implemented screens as active delivery or completed stories.
