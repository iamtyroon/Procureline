# Story 3.5: Institutional Settings Configuration

Status: done

## Story

As a **Tenant Admin**,
I want to configure institutional identity, fiscal-year, compliance, domain, and timezone settings,
so that Procureline applies my institution's approved operating rules consistently.

## Acceptance Criteria

1. The existing `/tenant-admin/settings` surface becomes editable for organization name, logo, and primary contact details, and successful changes immediately render from persisted tenant-scoped data.
2. The fiscal year is fixed to `1 July` through `30 June`; a Tenant Admin can configure its display naming convention, including `FY2025-26`, `2025/2026`, and an explicitly validated custom format.
3. A fiscal-year configuration change made while an active cycle exists is stored as a next-cycle setting, with an explicit message that the current cycle is unchanged.
4. A Tenant Admin can set default AGPO, PWD, and Local Content targets; each accepts only `0` through `100`, and the combined-value rule from the approved requirement is enforced with field-level feedback.
5. When compliance targets change during an active submission period, the UI warns that existing plans may require revalidation and requires confirmation before persisting the next setting version.
6. A Tenant Admin can maintain an allowed-email-domain list; new domains are normalized and validated, and removing a domain is blocked when existing tenant users use that domain.
7. Logo upload accepts only PNG, JPG/JPEG, or SVG up to 2 MB, shows a preview before commit, and persists the resulting file reference only after validation succeeds.
8. A Tenant Admin can set the institution timezone; tenant-facing timestamps and later generated reports consume the saved timezone rather than a browser-local implicit default.
9. Every saved settings mutation writes a tenant-scoped audit entry containing actor, setting group, before/after values safe for audit viewing, timestamp, and outcome.
10. Settings reads and mutations require an authenticated `tenant_admin` membership and cannot be performed against another tenant through modified client input.

## Tasks / Subtasks

- [ ] Convert the delivered settings layout into persisted settings forms (AC: 1-8)
  - [ ] Extend `renderSettingsView` or its extracted focused component without changing the tenant-admin shell/navigation.
  - [ ] Use existing form and feedback primitives for profile, fiscal-year, compliance, domain, branding, and timezone groups.
  - [ ] Display pending-next-cycle values independently from current-cycle effective values.
- [ ] Define a stable tenant-settings persistence model (AC: 1-10)
  - [ ] Extend the existing typed `tenants` fields for profile/logo/timezone only where suitable; use a versioned tenant-scoped settings structure for compliance, fiscal-year pending/effective state, and domain policy rather than an untyped JSON blob.
  - [ ] Store normalized allowed domains with uniqueness constraints and queryable linkage to tenant membership/user email checks.
  - [ ] Provide read and update functions protected by `requireTenantRole(ctx, ["tenant_admin"])`.
- [ ] Implement validated branding upload and audit behavior (AC: 7, 9)
  - [ ] Use Convex storage upload flow and persist a validated storage/file reference; do not trust MIME type or extension from client alone.
  - [ ] Ensure audit metadata does not expose raw files, secrets, or unnecessary personal information.
- [ ] Integrate settings into downstream behavior safely (AC: 2-5, 8)
  - [ ] Surface saved timezone/fiscal-year settings through a shared settings contract that reports and dashboard features can consume.
  - [ ] Feed compliance defaults into the existing calculation/model boundary; do not duplicate compliance computation inside the settings UI.

## Dev Notes

### Delivered Context To Extend

- `/tenant-admin/settings` already renders through `TenantAdminDashboard` and `renderSettingsView` in `TenantAdminViewContent.tsx`; its text states that persistence belongs to this story.
- The `tenants` table already has `name`, `primaryContactName`, `primaryContactEmail`, `primaryContactPhone`, `fiscalYearStartMonth`, `timeZone`, and `logoUrl`. Do not duplicate these with competing profile fields.
- The current schema does not show complete institutional compliance/domain/pending-cycle persistence; this story owns the minimum typed extension required.
- Audit infrastructure is already implemented in `auditLogs` / `_audit.ts` and must be reused.

### Technical Requirements

- Keep effective settings distinct from scheduled future settings whenever active-cycle rules require delayed effect.
- Use server-side normalization/validation for domains and numeric thresholds even if client validation is present.
- Existing product calculation hierarchy must remain coherent: compliance configuration changes targets, not the aggregation model or exported totals.
- Use UTC timestamps in persistence and apply configured tenant timezone only at display/report formatting boundaries.
- Settings save actions should be granular enough for clear before/after audit records and meaningful error feedback.

### Architecture And File Guidance

- UI: `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx` or a focused component in `webapp/src/components/tenant-admin/`.
- Backend/schema: `webapp/convex/schema.ts`, a focused `webapp/convex/functions/tenantAdminSettings.ts` module, and existing audit helpers.
- Shared types/validation should live beside existing tenant-admin shared models under `webapp/lib/shared/tenant-admin/`.
- Storage integration must follow Convex file-storage conventions already used for generated assets/reports.

### Scope Boundaries

- Do not redesign onboarding; Story 3.1 only provides existing baseline profile fields.
- Do not implement report generation again; Story 3.8 consumes timezone/settings contracts where relevant.
- Do not alter workbook compliance formulas as part of configuring target values.

### Manual Verification Only

- Do not add automated test tasks or automated-test acceptance criteria for this story.
- Manually verify every settings group, validation failure, next-cycle scheduling behavior, active-submission warning, domain-removal block, logo preview/rejection, timezone display use, cross-tenant protection, and before/after audit entries.

### References

- [Source: ../epic-03-tenant-administration.md#Story-35-Institutional-Settings-Configuration]
- [Source: ../../../../planning-artifacts/architecture.md]
- [Source: ../../../../project-context.md]
- [Source: webapp/src/components/tenant-admin/TenantAdminViewContent.tsx]
- [Source: webapp/convex/schema.ts]
- [Source: webapp/convex/functions/_audit.ts]
- [Source: https://docs.convex.dev/file-storage]

## Dev Agent Record

### Agent Model Used

GPT-5

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story intentionally specifies manual verification only; automated testing is excluded by user direction.
- Code-review follow-up: validated Convex logo storage, fiscal display controls, next-cycle confirmation, and active-user domain removal protection are implemented; rendered/manual verification remains outstanding.
- Browser-feedback follow-up: timezone editing is constrained to IANA dropdown choices with server validation, fiscal-year format choices display a current-cycle preview, and the fiscal-year boundary is enforced as the fixed 1 July through 30 June institutional cycle.
- Browser-feedback follow-up: the dashboard fiscal-year selector is identified as a reporting-period view and displays the active July-to-June cycle separately, so selecting a future period is not presented as changing institutional settings.
- Browser-feedback follow-up: empty future dashboard periods are no longer selectable; the current period remains available and prior periods are listed only when backed by stored records.
- Status closed on 2026-05-26 after product review accepted the IANA timezone selector, fixed July-to-June fiscal-year boundary, and current-period dashboard behavior.

### File List

- `webapp/convex/schema.ts`
- `webapp/convex/functions/tenantAdminOperations.ts`
- `webapp/src/components/tenant-admin/TenantAdminOperationsViews.tsx`
