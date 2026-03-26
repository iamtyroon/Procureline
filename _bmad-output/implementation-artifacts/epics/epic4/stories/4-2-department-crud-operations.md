# Story 4.2: Department CRUD Operations

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to create, edit, and manage departments,
so that I can establish a truthful departmental structure, budget baseline, and ownership model before Departmental Users begin planning.

## Acceptance Criteria

1. [Given] a Procurement Officer opens `/po/departments` [When] the route resolves through the current protected PO workspace contract [Then] the existing dashboard shell remains intact [And] the departments destination renders a real management workspace instead of the current placeholder-only modal or redirect experience (FR23, FR28).
2. [Given] a Procurement Officer clicks `Create Department` [When] the form opens [Then] it requires `name`, `code`, and `budget allocation` [And] it uses the repo-standard `react-hook-form` + Zod + shadcn/ui form pattern before any Convex mutation runs (FR23).
3. [Given] a Procurement Officer submits a department code that already exists for the same tenant [When] the backend validates the payload [Then] creation is blocked with the exact user-facing message `Department code already exists` [And] the uniqueness check is case-insensitive and whitespace-normalized so visually different variants do not bypass the constraint (FR23a).
4. [Given] a Procurement Officer submits a department name that already exists for the same tenant [When] the backend validates the payload [Then] creation is blocked with the exact user-facing message `Department name already exists` [And] the uniqueness check is case-insensitive and whitespace-normalized within the tenant boundary (FR23b).
5. [Given] a Procurement Officer enters a budget allocation that is zero, negative, `NaN`, or otherwise invalid [When] they submit the form [Then] validation blocks the mutation and shows `Budget must be a positive number` (FR23c).
6. [Given] a Procurement Officer enters a department code [When] the value contains non-alphanumeric characters or exceeds 10 characters after normalization [Then] validation blocks submission [And] the saved code format remains uppercase alphanumeric only, max 10 characters (FR23e).
7. [Given] the tenant is on the Free, Starter, or Professional tier [When] the current active department count already matches the tier limit of 10, 30, or 100 respectively [Then] creation is blocked server-authoritatively [And] the UI shows a tier-limit modal with the correct limit, upgrade guidance, and a safe `View Plans` CTA that routes to the current pricing or upgrade handoff instead of an unauthorized tenant-admin-only route (FR23 plus Epic 4 tier limits).
8. [Given] the tenant is on the Enterprise tier [When] any number of active departments already exist [Then] the create flow does not enforce a numeric department-count cap (Epic 4 tier limits).
9. [Given] a Procurement Officer edits an existing department [When] the department already has downstream planning activity, including draft, submitted, rejected, or approved plan records [Then] the UI surfaces a clear impact warning before save [And] the edit flow remains available unless a separate hard blocker applies (FR24a).
10. [Given] a Procurement Officer changes a department budget allocation [When] the update succeeds and a Departmental User for that department is actively using the app [Then] the DU receives a lightweight in-app budget-change notification or equivalent live warning/toast signal in the current repo patterns without waiting for the later full notification-center epic (FR24b).
11. [Given] a Procurement Officer chooses to delete a department [When] they trigger the destructive action [Then] the UI requires an explicit confirmation dialog that includes the department name before the mutation can proceed (FR25).
12. [Given] a department has any `submitted` or `approved` plan record [When] a Procurement Officer attempts to delete it [Then] the delete mutation fails closed with a clear `Cannot delete department with submitted plans` style error and the department remains available for audit and downstream review (FR25a).
13. [Given] a department still has active Departmental User assignments [When] a Procurement Officer attempts to delete it [Then] the delete mutation is blocked until those DUs are deactivated first [And] the UI surfaces the affected DU email addresses so the Procurement Officer understands exactly what must be resolved (FR25b).
14. [Given] a department is deleted successfully [When] the system applies the mutation [Then] the department is soft-deleted or archived for auditability rather than hard-removed [And] downstream queries exclude it from active setup metrics while preserving historical references, audit logs, and related records (FR25c, NFR-S9).
15. [Given] the departments workspace loads [When] departments exist [Then] the list or table shows truthful operational visibility for each department, including at minimum name, code, budget allocation, DU-assignment signal, access-code signal, planning-state signal, and last-updated context, without inventing prototype-only totals or statuses that are not backed by current live data (FR28, Story 4 delivery map).
16. [Given] a Procurement Officer creates, edits, or deletes a department [When] the mutation completes [Then] the existing Procurement Officer dashboard and department-related read models refresh reactively through Convex rather than relying on manual browser refresh or duplicate REST fetches (NFR-P1, FR28i).
17. [Given] Story 4.5 owns explicit deadline management [When] Story 4.2 creates or edits departments [Then] the department CRUD flow must not require the user to configure submission dates just to save the department [And] any missing submission-window state is treated honestly as `setup required` until the deadline story lands (FR23, FR-DL1 through FR-DL6 scope boundary).
18. [Given] Epic 4 requires a non-blocking over-allocation warning [When] the system has a truthful tenant-level procurement-budget ceiling available in live data [Then] the create or edit flow surfaces the `Total department budgets exceed institution allocation by [amount]` warning without blocking save [And] when no authoritative ceiling exists yet the UI stays honest and does not fabricate the warning delta (FR23d).
19. [Given] a Procurement Officer opens an edit or delete flow for a department [When] that department has already been soft-deleted, moved out of scope, or can no longer be found by the backend [Then] the mutation fails safely with a clear `Department not found` style error [And] the UI closes or refreshes the stale workspace state instead of leaving the user on a broken form.
20. [Given] a create, edit, or delete request fails because of an unexpected backend, network, or transient infrastructure issue [When] the UI receives the error [Then] it resets loading state, preserves unsaved form input when appropriate, and shows a safe generic error message instead of exposing raw backend internals or leaving the submit action stuck indefinitely.
21. [Given] the Procurement Officer loses authorization, tenant access, or subscription eligibility during a CRUD action [When] a mutation or query returns an auth or access failure [Then] the workspace fails closed, does not apply partial optimistic state, and routes the user through the repo's existing protected-app access handling instead of pretending the mutation succeeded.
22. [Given] a Procurement Officer double-clicks submit or retries while a create, edit, or delete mutation is already pending [When] the UI is in a loading state [Then] duplicate submissions are prevented client-side [And] the backend remains idempotent enough to avoid duplicate department creation from rapid retries or repeated network delivery.

## Tasks / Subtasks

- [x] Task 1: Add a dedicated department domain backend and reconcile the current schema with Story 4.2 scope (AC: 2-9, 11-18)
  - [x] Add a focused Convex module such as `webapp/convex/functions/departments.ts` instead of overloading `procurementOfficerDashboard.ts` with CRUD mutations.
  - [x] Extend `webapp/convex/schema.ts` so department records support case-insensitive uniqueness, soft delete, and audit-friendly lifecycle tracking. Recommended additions include normalized name/code keys plus `deletedAt` and `deletedByTenantUserId`.
  - [x] Reconcile the current hidden blocker in the live schema: `submissionStartsAt` and `submissionEndsAt` are currently required even though Story 4.5 owns deadline management. Make those fields optional or safely nullable, then update all dependent read paths to fail closed without forcing deadline setup during department creation.
  - [x] Add the indexes needed for tenant-scoped uniqueness and efficient CRUD reads, such as `(tenantId, normalizedCode)` and `(tenantId, normalizedName)` or equivalent current-repo naming.
  - [x] Implement create, list, update, and soft-delete mutations or queries guarded by `requireTenantRole(ctx, ["procurement_officer"])`.
  - [x] Enforce tier limits server-authoritatively from the tenant tier, not from client-provided limits or stale dashboard counts.
  - [x] Keep over-allocation warning logic truthful: only compute the FR23d warning when a real tenant-level budget ceiling exists in live data; otherwise do not invent a ceiling or delta.

- [x] Task 2: Build the Procurement Officer departments workspace inside the current `/po` information architecture (AC: 1, 2, 7-11, 15-17)
  - [x] Keep `webapp/app/(app)/po/departments/page.tsx` thin and preserve the current protected PO namespace rather than introducing a second layout or dashboard shell.
  - [x] Replace the current placeholder-only departments experience with a real workspace component such as `webapp/src/components/procurement-officer/ProcurementOfficerDepartmentsWorkspace.tsx`, mounted through the existing dashboard modal or equivalent current workspace contract.
  - [x] Add a create and edit form dialog using shadcn/ui `Dialog`, `Form`, `Input`, and any required shared form primitives plus `zodResolver`.
  - [x] Add a delete confirmation dialog using the existing shadcn/ui destructive-action pattern; the confirmation copy must include the department name.
  - [x] Provide truthful row-level status visibility for each department using live data only: DU assignment, access-code coverage, plan-state summary, and last activity or last updated context.
  - [x] Keep desktop-first behavior aligned with the existing PO dashboard and UX specification. Do not build a fake mobile CRUD experience.

- [x] Task 3: Reuse current dashboard and DU read models instead of forking a second department state system (AC: 9, 10, 14-17)
  - [x] Extend `webapp/lib/procurement-officer/dashboard-snapshot.ts`, `webapp/lib/procurement-officer/dashboard.ts`, and `webapp/convex/functions/procurementOfficerDashboard.ts` only where necessary so the existing dashboard reacts honestly after department CRUD mutations.
  - [x] Update `webapp/lib/auth/department-user-access.ts`, `webapp/convex/functions/departmentUserDashboard.ts`, and any related PO or DU helpers so missing submission windows remain blocked or `setup_required` rather than forcing placeholder dates or accidental DU access.
  - [x] Preserve the current `/po/departments` route contract and modal-backed navigation helpers unless there is a proven UX or implementation blocker.
  - [x] Keep access-code management, deadline management, budget import, and drag-and-drop reordering clearly staged for Stories 4.3, 4.5, and 4.4 instead of silently absorbing them here.

- [x] Task 4: Implement delete safeguards, budget-change signals, audit logging, and failure-path handling using existing repo patterns (AC: 9-14, 19-22)
  - [x] Reuse `webapp/convex/functions/_audit.ts` plus `webapp/lib/security/audit.ts` to write append-only audit entries for department created, updated, budget updated, and soft-deleted actions.
  - [x] Resolve active DU deletion blockers by joining `departmentUserProfiles`, `tenantUsers`, and `users` so the UI can surface the affected email addresses truthfully.
  - [x] Resolve submitted or approved plan deletion blockers from the existing `plans` table without scanning unrelated tenants.
  - [x] Implement the FR24b budget-change signal as the lightest truthful live mechanism that fits the current repo, for example a dedicated dashboard-snapshot notice or toast-triggering flag, rather than a full generic notifications subsystem.
  - [x] Add safe not-found handling for stale edit or delete attempts so deleted or missing departments do not leave the workspace in a broken state.
  - [x] Add client-side pending-state guards plus backend duplicate-protection logic so rapid retries cannot create duplicate department rows.
  - [x] Map expected backend failures into deterministic user-facing errors and keep unexpected failures generic, sanitized, and recoverable.

- [ ] Task 5: Add deterministic regression coverage for validation, tier enforcement, schema changes, reactive updates, and error handling (AC: 1-22)
  - [x] Add pure tests for department name/code normalization, uniqueness rules, positive-budget validation, tier-limit resolution, and soft-delete filtering.
  - [ ] Add backend tests for create, edit, duplicate rejection, tier-limit blocking, delete-with-active-DUs blocking, delete-with-submitted-or-approved-plans blocking, and audit-log writes.
  - [x] Add dashboard and DU regression tests proving missing submission windows remain honest `setup required` or blocked states after Story 4.2 schema changes.
  - [ ] Add PO route and workspace tests ensuring `/po/departments` remains protected for Procurement Officers and that the current modal-backed navigation does not regress.
  - [x] Update `webapp/tests/run-tests.ts` so the new department coverage runs in the standard deterministic test suite.
  - [ ] Add failure-path tests for stale-record edits, generic backend failures, unauthorized mutation responses, pending-state reset after failure, and duplicate-submit prevention.

## Dev Notes

### Story Foundation

- Epic 4 defines Story 4.2 as the departmental structure story the rest of the PO workflow depends on.
- The delivery-map intent is broader than "show a form": this story establishes ownership, lifecycle safety, and truthful department-level status visibility before access codes, deadlines, and imports arrive in later stories.
- Sprint status marks Story 4.2 as `full-stack`, and that matches the current repo: the PO shell and route namespace already exist, but the CRUD backend, live workspace, uniqueness rules, and deletion safeguards do not.

### Previous Story Intelligence

- Story 4.1 already established `/po` as the canonical Procurement Officer dashboard and reserved `/po/departments`, `/po/access-codes`, `/po/deadlines`, `/po/categories`, `/po/items`, `/po/requests`, and `/po/consolidation` as stable destinations.
- Story 4.1 also moved several PO destinations into a dashboard-modal navigation contract via `resolveProcurementOfficerWorkspaceNavigation(...)`. Department CRUD should grow that existing workspace rather than creating a second contradictory PO information architecture without a strong reason.
- The current PO dashboard snapshot already depends on live department, access-code, and department-user data. Department mutations in Story 4.2 must preserve those read models and keep them reactive.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/po/departments/page.tsx` currently redirects back into the `/po` workspace contract instead of providing a real departments management surface.
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` currently exposes a departments modal with readiness summaries only; it does not implement CRUD actions yet.
- `webapp/convex/schema.ts` already includes:
  - `departments`
  - `departmentAccessCodes`
  - `departmentUserProfiles`
  - `plans`
  - `procurementCategories`
  - `procurementItems`
- The live `departments` table currently stores `tenantId`, `procurementOfficerTenantUserId`, `name`, `code`, `budgetAllocation`, `isActive`, `submissionStartsAt`, `submissionEndsAt`, `createdAt`, and `updatedAt`.
- Hidden blocker: the live schema currently requires `submissionStartsAt` and `submissionEndsAt`, but Story 4.5 owns deadline management. Story 4.2 should not force fake dates just to create a department.
- `webapp/lib/auth/department-user-access.ts` and `webapp/convex/functions/departmentUserDashboard.ts` currently assume numeric submission-window fields. Any schema relaxation in Story 4.2 must update those downstream consumers so they fail closed cleanly.
- `webapp/convex/subscriptionTiers.ts`, `webapp/convex/seedData.ts`, and `webapp/lib/marketing/pricing.ts` already define the active department caps the story needs:
  - Free: 10
  - Starter: 30
  - Professional: 100
  - Enterprise: unlimited
- The current repo does not expose an authoritative tenant-level procurement-budget ceiling field, so FR23d cannot truthfully compute an over-allocation warning unless Story 4.2 introduces or reuses a real source for that data.
- There is no `webapp/convex/functions/departments.ts` backend module yet.

### Critical Implementation Traps

- Do not satisfy Story 4.2 by hardcoding placeholder departments or local client-only arrays inside the departments modal.
- Do not keep required submission-window timestamps on creation by injecting fake or copied dates. That would contaminate Story 4.5 and make dashboard readiness dishonest.
- Do not route the tier-limit modal to a tenant-admin-only billing page that a Procurement Officer cannot access. Use the safe public pricing or approved upgrade handoff already present in the repo.
- Do not hard-delete departments. The current schema already feeds PO and DU dashboards, plan records, access-code records, and audit logs; hard deletion would create avoidable data-integrity and auditability risk.
- Do not implement a generic notification center for FR24b. Story 4.2 needs a narrow live budget-change signal only.

### Recommended Implementation Shape

- Keep `/po/departments` as the canonical department-management entry point, but continue resolving it through the current dashboard and workspace contract unless implementation pressure proves that a dedicated page is materially better.
- Add a dedicated domain backend module, `webapp/convex/functions/departments.ts`, as the source of truth for list, create, update, delete, and tier-limit logic.
- Add a reusable helper module such as `webapp/lib/procurement-officer/departments.ts` for normalization, tier-limit messaging, safe upgrade CTA routing, and workspace-derived UI state.
- Prefer a dialog-driven CRUD flow inside the departments workspace because that aligns with the current PO dashboard and the tenant-admin invitation-management pattern already present in the repo.
- Make submission-window fields optional or nullable now, then keep dashboard and DU access helpers honest about missing windows by treating them as `setup required`, not configured.
- Implement soft delete by preserving the row and excluding it from active department reads. The safest current-repo direction is `isActive = false` plus explicit deletion metadata rather than row removal.

### Data Model Guidance

- Recommended `departments` extensions:
  - `normalizedName`
  - `normalizedCode`
  - `deletedAt?`
  - `deletedByTenantUserId?`
  - `lastBudgetChangedAt?`
  - `lastBudgetChangedByTenantUserId?`
- Recommended `departments` field adjustment:
  - `submissionStartsAt?: number`
  - `submissionEndsAt?: number`
- Recommended indexes:
  - `(tenantId, normalizedCode)`
  - `(tenantId, normalizedName)`
  - a tenant + active-state index if the current dashboard and limit checks would benefit from it
- If FR23d needs a live institution allocation source in this story, prefer an optional tenant-scoped field owned by the tenant record rather than inferring a fake ceiling from current department sums.

### Validation And Error Guidance

- Reuse `webapp/lib/security/input.ts` for shared plain-text sanitation and normalization before persistence.
- Use explicit `ConvexError` codes for expected failures, for example:
  - `ALREADY_EXISTS`
  - `NOT_FOUND`
  - `FORBIDDEN`
  - `VALIDATION_FAILED`
  - `QUOTA_EXCEEDED`
  - `UNAUTHORIZED`
- Keep user-facing strings deterministic for the epic-critical validations:
  - `Department code already exists`
  - `Department name already exists`
  - `Budget must be a positive number`
  - `Department not found`
  - a clear same-tenant tier-limit message naming the current tier and cap
- Sanitize internal backend details before surfacing them in the UI. Do not leak raw stack traces or opaque Convex request identifiers into the departments workspace.
- For unexpected failures, prefer a safe fallback message such as `We could not save the department right now. Please try again.` and keep the form recoverable.
- Reset loading and disabled states after both success and failure. A failed mutation must never leave the workspace permanently blocked.
- Preserve user-entered create or edit form values after recoverable failures so the Procurement Officer does not lose work because of a transient error.

### Reuse And Anti-Reinvention Guidance

- Reuse the current Procurement Officer dashboard shell and modal-workspace navigation helpers.
- Reuse the RHF + Zod + shadcn/ui dialog-form pattern already implemented in `webapp/src/components/tenant-admin/po-management/ProcurementOfficerManagementView.tsx`.
- Reuse audit helpers in `webapp/convex/functions/_audit.ts` and event-shape conventions from `webapp/lib/security/audit.ts`.
- Reuse current pricing catalog and public pricing route for upgrade messaging instead of inventing a PO-only billing surface.
- Reuse the existing dashboard snapshot builders and status-badge patterns instead of creating a second disconnected department summary system.
- Reuse current tenant role guards. Do not trust client-provided tenant or tier data.

### UX And Interaction Requirements

- Keep the departments surface aligned with the current Procureline tweakcn theme, shadcn/ui primitives, and `lucide-react` iconography already used in the PO dashboard.
- The first usable departments screen should answer:
  - which departments exist,
  - which ones still lack DU assignment,
  - which ones still lack access-code coverage,
  - which ones already have plan activity,
  - what action the Procurement Officer should take next.
- Use inline validation for form fields and `sonner` toasts for mutation feedback.
- Use a confirmation dialog for delete, not an inline destructive click.
- Keep destructive and tier-limit messaging explicit and actionable.
- Respect the UX spec's desktop-only strategy; do not introduce a degraded mobile CRUD surface.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `react-hook-form` `^7.47.0`
  - `zod` `^3.22.4`
  - `lucide-react` `^0.577.0`
  - `sonner` `^2.0.7`
- Keep secure authorization decisions in Convex near the data source.
- Keep route files thin and interactive state in components.
- Keep `proxy.ts`; do not introduce `middleware.ts`.
- Keep App Router conventions and path-alias imports.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/po/departments/page.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/lib/auth/department-user-access.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/schema.ts`
- Expected new files (recommended):
  - `webapp/convex/functions/departments.ts`
  - `webapp/lib/procurement-officer/departments.ts`
  - `webapp/lib/validators/department.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDepartmentsWorkspace.tsx`
  - `webapp/src/components/procurement-officer/DepartmentFormDialog.tsx`
  - `webapp/src/components/procurement-officer/DeleteDepartmentDialog.tsx`
  - `webapp/tests/procurement-officer-departments.test.ts`

### Git Intelligence Summary

- Commit `13ce990` completed Story 3.3 and reinforced the current house style of thin routes, focused feature components, deterministic tests, and Convex-owned role or membership logic.
- Commit `3b5d1bc` implemented tenant-admin onboarding with strong invitation-state validation and route-guard discipline. Story 4.2 should mirror that seriousness around validation, fail-closed state handling, and audit logging.
- Commit `e213972` established the current platform-admin shell and placeholder-route pattern. Story 4.2 should extend the live PO namespace cleanly instead of replacing the current shell patterns.

### Latest Tech Information

- Verified on March 24, 2026 against official docs, the live repo, and current package metadata:
  - the repo uses Next.js `^16.1.6`, while `npm view next version` returns `16.2.1`;
  - the repo uses Convex `^1.13.2`, while `npm view convex version` returns `1.34.0`;
  - the repo uses `@convex-dev/auth` `^0.0.90`, while `npm view @convex-dev/auth version` returns `0.0.91`;
  - the repo uses `react-hook-form` `^7.47.0`, while `npm view react-hook-form version` returns `7.72.0`;
  - the repo uses `zod` `^3.22.4`, while `npm view zod version` returns `4.3.6`.
- Next.js App Router and authentication guidance continues to favor thin route files and keeping real authorization checks in a data-access layer. Inference: keep department authorization in Convex and use `proxy.ts` only for light route decisions.
- Convex React docs continue to position `useQuery` as the reactive client primitive for live reads. Inference: the departments workspace should stay on reactive Convex queries instead of manual polling.
- Convex index docs still require `withIndex(...)` clauses to follow index field order exactly. Inference: department uniqueness and list queries need deliberate index design from the start.
- The official Zod site now describes Zod 4 as stable, but the current repo is still on Zod 3.22.4. Inference: do not turn Story 4.2 into a Zod-major-version migration unless a blocker truly requires it.

### Testing Requirements

- Add pure tests for name and code normalization, positive-budget validation, tier-limit copy resolution, and soft-delete filtering.
- Add backend tests for:
  - create department
  - duplicate code rejection
  - duplicate name rejection
  - tier-limit blocking by tenant tier
  - edit with plan-warning metadata
  - delete blocked by active DUs
  - delete blocked by submitted or approved plans
  - successful soft delete with audit logging
- Add Procurement Officer dashboard regression tests proving department CRUD updates remain reactive and that missing submission windows stay honest after schema changes.
- Add Departmental User regression tests proving missing or invalid department windows still fail closed instead of granting early access after Story 4.2.
- Add route and RBAC tests proving `/po/departments` remains protected for Procurement Officers only.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 4 Source](../epic-04-po-department-catalog.md)
- [Story 4.1 Reference](./4-1-po-dashboard-onboarding-wizard.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [PO Departments Route](../../../../../webapp/app/(app)/po/departments/page.tsx)
- [PO Dashboard](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [PO Dashboard Helpers](../../../../../webapp/lib/procurement-officer/dashboard.ts)
- [PO Dashboard Snapshot Builder](../../../../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
- [PO Dashboard Query](../../../../../webapp/convex/functions/procurementOfficerDashboard.ts)
- [Department User Access Helpers](../../../../../webapp/lib/auth/department-user-access.ts)
- [Department User Dashboard Query](../../../../../webapp/convex/functions/departmentUserDashboard.ts)
- [Role Guard Backend](../../../../../webapp/convex/functions/_roleGuard.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Audit Helpers](../../../../../webapp/convex/functions/_audit.ts)
- [Audit Event Definitions](../../../../../webapp/lib/security/audit.ts)
- [Security Input Validation](../../../../../webapp/lib/security/input.ts)
- [Procurement Officer Invitation Management Reference](../../../../../webapp/src/components/tenant-admin/po-management/ProcurementOfficerManagementView.tsx)
- [Pricing Catalog Helpers](../../../../../webapp/lib/marketing/pricing.ts)
- [Subscription Tier Seed Data](../../../../../webapp/convex/seedData.ts)
- [Next.js App Docs](https://nextjs.org/docs/app)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/building-your-application/authentication)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Convex Indexing Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [React Hook Form Docs](https://react-hook-form.com/)
- [Zod Docs](https://zod.dev/)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Dev-story workflow: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Dev-story instructions: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Dev-story checklist: `_bmad/bmm/workflows/4-implementation/dev-story/checklist.md`
- Story source: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-2-department-crud-operations.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Implementation verification:
  - `npx convex codegen`
  - `npx tsc --noEmit`
  - `npm test`
  - `npx eslint . --ext .ts,.tsx`
  - `npm run lint`

### Completion Notes List

- 2026-03-24: Added `webapp/convex/functions/departments.ts` plus schema and seed updates to support tenant-scoped normalized uniqueness, soft delete, tier enforcement, audit metadata, and truthful over-allocation warnings backed only by live tenant budget ceilings.
- 2026-03-24: Replaced the placeholder PO departments modal with a reactive CRUD workspace, including RHF plus Zod create or edit dialogs, destructive delete confirmation, tier-limit upgrade guidance, and live row-level setup visibility.
- 2026-03-24: Updated DU access and dashboard flows to treat missing submission windows as `setup required` instead of inventing dates, and added a lightweight live budget-change announcement pattern for active DUs.
- 2026-03-24: Added deterministic coverage for department helper validation and DU regressions, then reverified with `npx convex codegen`, `npx tsc --noEmit`, `npm test`, `npx eslint . --ext .ts,.tsx`, and `npm run lint`.

### Change Log

- 2026-03-24: Implemented Story 4.2 department CRUD backend, PO workspace UI, DU setup-required handling, audit events, and regression coverage.
- 2026-03-26: Addressed code-review follow-ups for tier-limit guidance, live over-allocation warnings in the form flow, protected-app auth recovery, indexed uniqueness checks, and expanded regression coverage.

### File List

- `_bmad-output/implementation-artifacts/epics/epic4/stories/4-2-department-crud-operations.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/app/(app)/dashboard/page.tsx`
- `webapp/convex/functions/_departmentUserGuard.ts`
- `webapp/convex/functions/_roleGuard.ts`
- `webapp/convex/functions/departmentUserAuth.ts`
- `webapp/convex/functions/departmentUserDashboard.ts`
- `webapp/convex/functions/departments.ts`
- `webapp/convex/functions/tenantAdminOnboarding.ts`
- `webapp/convex/functions/tenants.ts`
- `webapp/convex/migrations.ts`
- `webapp/convex/schema.ts`
- `webapp/convex/seedData.ts`
- `webapp/lib/auth/department-user-access.ts`
- `webapp/lib/department-user/dashboard.ts`
- `webapp/lib/errors/convex.ts`
- `webapp/lib/procurement-officer/departments.ts`
- `webapp/lib/security/audit.ts`
- `webapp/lib/validators/department.ts`
- `webapp/src/components/procurement-officer/DeleteDepartmentDialog.tsx`
- `webapp/src/components/procurement-officer/DepartmentFormDialog.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerDepartmentsWorkspace.tsx`
- `webapp/tests/department-user-access.test.ts`
- `webapp/tests/department-user-dashboard.test.ts`
- `webapp/tests/procurement-officer-departments.test.ts`
- `webapp/tests/run-tests.ts`

### Story Completion Status

- Story ID: `4.2`
- Story Key: `4-2-department-crud-operations`
- Output File: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-2-department-crud-operations.md`
- Final Status: `review`
- Completion Note: `Implemented the department CRUD backend and PO workspace, hardened DU setup-required behavior around optional submission windows, added budget-change and audit signals, and reverified the delivered coverage locally.`
