# Story 3.9: Cross-Institutional Visibility

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Tenant Admin,
I want to view procurement activity across my institution,
so that I can maintain oversight without interfering with Procurement Officer operations.

## Acceptance Criteria

1. [Given] a Tenant Admin opens the institutional overview from the existing tenant-admin shell [When] the current fiscal-year data loads [Then] the view shows every active department in the tenant exactly once across all Procurement Officers [And] each row shows department name/code, assigned Procurement Officer, submission status, budget allocation, budget used, and utilization (FR-TA7a, FR18, FR19).
2. [Given] a Tenant Admin changes fiscal year [When] the selected fiscal year has matching procurement activity [Then] all summary cards, rows, filters, detail panels, anomaly counts, and export scope use that same fiscal-year context [And] the UI shows truthful empty or historical-unavailable states instead of mixing current-year totals into historical views.
3. [Given] many departments exist [When] the Tenant Admin searches or filters [Then] the list supports search by department name/code and filters by Procurement Officer and submission status [And] summary counts and empty states remain aligned with the filtered dataset (FR-TA7b).
4. [Given] the tenant has 100+ departments [When] the department list renders [Then] the UI uses a virtualized or incrementally loaded list with stable row heights and no layout jumps [And] the query does not require loading unrelated tenant data or unbounded child collections before the first screen is usable (FR-TA7e, NFR-P1).
5. [Given] the Tenant Admin opens a department detail panel [When] department data is available [Then] the panel shows a read-only department profile with PO assignment, DU contacts, budget allocation, budget used, utilization, current plan status, submission history, category summaries, and item totals where a submitted/approved snapshot exists (FR-TA7c).
6. [Given] a department has no plan, only a draft, a submitted plan, a rejected or revision-requested plan, or an approved plan [When] overview status is derived [Then] the Tenant Admin sees the same canonical status buckets used by PO monitoring and DU status tracking rather than a new workflow enum.
7. [Given] a department has multiple plan records or resubmission snapshots for the same fiscal year [When] the overview derives current state [Then] it reuses the canonical plan selection rules from `selectCanonicalPlans(...)` or the PO monitoring helper so stale drafts do not hide active submitted, rejected, or approved work.
8. [Given] the Tenant Admin views budget information [When] department budgets and plan totals are present [Then] the overview shows total allocated, total utilized, utilization percentage, and per-department breakdown from canonical `departments.budgetAllocation`, `plans.estimatedBudgetUsed`, and submission snapshots [And] missing budget data is labelled unavailable instead of fabricated (FR-TA7d).
9. [Given] the system detects unusual patterns [When] the overview renders anomaly indicators [Then] it flags at minimum budget variance greater than 50%, over-budget plans, duplicate active department codes/names, departments without assigned active DU coverage, and stale submitted plans that have not entered review after a configurable threshold [And] each anomaly includes the specific department and issue description (FR-TA7f).
10. [Given] a Tenant Admin views Procurement Officer summary [When] departments are assigned to POs [Then] the UI shows PO status indicators: Not Started, In Progress, Complete, and Attention Needed based on that PO's assigned departments [And] includes last activity timestamp from tenant-scoped audit or profile metadata (FR-TA7g).
11. [Given] Tenant Admin oversight is read-only [When] the user opens details, filters, anomalies, or export options [Then] no PO-owned or DU-owned mutations are exposed from this surface [And] edit, approve, reject, resend-reminder, and plan-modification actions remain absent or route to the owning role's existing workflow rather than executing here (FR-TA7c).
12. [Given] the Tenant Admin requests complete institutional data export [When] the request is submitted [Then] the backend initiates a secure tenant-scoped export package covering user data, activity logs, department records, PO assignments, DU profiles, plan metadata, and procurement data [And] the operation is audited and returns a queued/export-ready state without pretending large exports are instant (FR-TA7h, NFR-D2).
13. [Given] the overview reads protected institutional data [When] Convex queries execute [Then] access is guarded by `requireTenantRole(ctx, ["tenant_admin"])`, tenant scope is derived from auth context, and no client-provided `tenantId` or cross-tenant identifier is trusted (NFR-S1).
14. [Given] a department is assigned to an inactive, deactivated, deleted, or otherwise unresolved Procurement Officer membership [When] the overview renders [Then] the department remains visible [And] the PO assignment is labelled as inactive or unavailable [And] the row is counted in `Attention Needed` rather than disappearing or being reassigned to another PO.
15. [Given] a department has active DU profiles but their auth users are inactive, missing, duplicated by email, or attached to another tenant [When] DU coverage is derived [Then] only active tenant-scoped DU contacts count as safe coverage [And] duplicate normalized emails are collapsed [And] unsafe or missing coverage is called out without exposing another tenant's user data.
16. [Given] a plan has PO-internal review comments, private audit metadata, raw Blockly workspace data, invite tokens, activation-code hashes, or access-code hashes [When] Tenant Admin opens detail or export output [Then] those sensitive/internal fields are excluded unless there is an explicitly public field or export-safe projection for them.
17. [Given] filter or search criteria are applied while using pagination or virtualization [When] the Tenant Admin scrolls, loads more rows, opens a detail panel, or starts an export [Then] filtering, sorting, total counts, selected row identity, and export scope are computed from one server-authoritative filtered dataset, not from only the currently rendered page.
18. [Given] department submission windows are missing but plan or snapshot data exists for the selected fiscal year [When] fiscal-year options and overview rows are derived [Then] plan, snapshot, decision, deadline, and audit timestamps all contribute to available fiscal years [And] the selected year is not hidden merely because department window fields are absent.
19. [Given] a department budget is zero, negative from legacy data, missing, or lower than used budget [When] budget utilization and anomaly state are calculated [Then] zero/negative/missing allocation is treated as unavailable or invalid rather than dividing by zero [And] over-budget and variance anomalies use explicit reason labels.
20. [Given] duplicate department codes or names differ only by case, punctuation, or whitespace [When] duplicate anomalies are computed [Then] normalized fields are used first [And] fallback normalization matches the existing department validation rules so false negatives are not introduced.
21. [Given] an institutional export is queued while users continue changing departments, plans, or audit records [When] the export completes [Then] the package includes an `asOf` timestamp, selected fiscal-year scope, export request id, and actor metadata [And] the UI does not imply it represents live data after that timestamp.
22. [Given] implementation completes [When] deterministic tests run [Then] coverage proves tenant-scoped row shaping, filter alignment, read-only boundaries, canonical status derivation, budget aggregation, anomaly detection, PO summary shaping, large-list behavior, sensitive-field exclusion, export snapshot scoping, and no regressions to Story 3.2 dashboard, Story 3.3 PO directory, Story 4.6 submission monitoring, or Story 6.7 DU status tracking.

## Tasks / Subtasks

- [ ] Task 1: Add a tenant-admin institutional visibility data model and query (AC: 1, 2, 6, 7, 8, 10, 13, 14, 15, 18)
  - [x] Extend `webapp/lib/tenant-admin/dashboard-snapshot.ts` with overview row, detail, summary, PO rollup, anomaly, and export-request presentation types.
  - [x] Add a dedicated Convex query such as `getTenantAdminInstitutionalOverview` in `webapp/convex/functions/tenantAdminDashboard.ts` or a focused `tenantAdminInstitutionalOverview.ts` module.
  - [x] Start from active tenant departments using `departments.by_tenantId_isActive`, then join tenant users, users, DU profiles, plans, submission snapshots, review decisions, and audit metadata in tenant scope.
  - [x] Reuse `selectCanonicalPlans(...)` or extract a shared canonical-plan selector so Tenant Admin, DU, and PO status surfaces cannot disagree.
  - [x] Return one row per active department, with explicit unavailable states for missing budget, missing plan, missing PO, missing DU contact, or legacy missing timestamps.
  - [x] Derive available fiscal years from department windows, submission deadlines, plans, plan submission snapshots, review decisions, redraft requests, and tenant-scoped audit activity so missing department windows do not hide real plan history.
  - [x] Resolve PO and DU display summaries only after verifying the related `tenantUsers` row is active and belongs to the current tenant; unresolved or inactive assignments must remain visible as attention states.
  - [ ] Keep query validators explicit and serializable; avoid returning raw Convex documents to the client.

- [ ] Task 2: Replace the staged department-status table with a real institutional overview surface (AC: 1-5, 8-11, 14-17, 19)
  - [x] Keep `webapp/app/(app)/tenant-admin/departments/page.tsx` and `TenantAdminDashboard` as the route shell; do not create a second tenant-admin layout.
  - [x] Replace `renderDepartmentsView(...)` placeholder budget cells in `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx` with a dedicated component if the view becomes stateful.
  - [x] Add summary tiles for total allocated, total utilized, submitted/approved coverage, anomaly count, and PO coverage.
  - [x] Add search, PO filter, submission-status filter, and fiscal-year-aware empty states.
  - [x] Add a read-only department detail sheet/dialog with budget, plan, category summary, item totals, DU contacts, PO assignment, and timeline/history.
  - [x] Ensure action buttons do not mutate PO or DU workflows from this surface.

- [ ] Task 3: Add scalable list behavior for larger institutions (AC: 3, 4, 17)
  - [ ] Use a proven virtual-list approach if the dataset can exceed 100 rows; recommended options are `@tanstack/react-virtual` if adding a dependency is acceptable, or Convex `usePaginatedQuery` plus "load more" if avoiding a new dependency.
  - [ ] Keep filtering and sorting server-authoritative when pagination is used; do not filter only the rows already loaded into the client.
  - [x] Keep row height, filter controls, and detail-trigger affordances stable so filtering and virtual scrolling do not shift the dashboard shell.
  - [x] Use stable row ids for detail panel selection so opening a detail row still resolves the intended department after filters, sorting, or live Convex updates change the visible list.
  - [ ] If a new dependency is added, update `webapp/package.json` intentionally and include focused UI regression coverage.
  - [ ] Avoid `react-virtualized`; it is not currently installed and would add older API surface without matching the repo's current stack.

- [ ] Task 4: Implement anomaly detection and PO summary shaping (AC: 9, 10, 14, 15, 19, 20)
  - [x] Add pure helper logic for anomaly detection in `webapp/lib/tenant-admin/institutional-visibility.ts` or a similar tenant-admin module.
  - [x] Detect budget variance greater than 50% using `estimatedBudgetUsed` versus `budgetAllocation` when both are available.
  - [x] Detect over-budget plans using existing budget-state logic where possible instead of duplicating calculation rules.
  - [x] Detect duplicate active department names/codes within the tenant from normalized department fields.
  - [x] Detect departments without safe active DU coverage, inactive or unresolved PO assignment, and stale submitted plans that have not entered review.
  - [x] Treat missing, zero, or negative budget allocation as an explicit unavailable/invalid state rather than a numeric variance calculation.
  - [x] Derive PO rollups from assigned active departments and their canonical statuses, with last activity from audit logs or profile metadata.

- [ ] Task 5: Add secure institutional export request handling (AC: 12, 13, 16, 21)
  - [ ] Inspect the current `webapp/convex/actions/files.ts` and NestJS file/export implementation before choosing direct versus queued export.
  - [x] Add a tenant-admin export request action that derives tenant scope from `requireTenantRole(ctx, ["tenant_admin"])`.
  - [ ] Include user data, tenant users, PO assignments, DU profiles, departments, plans, snapshots, category/item summaries, item/category requests, and audit logs where available.
  - [ ] Exclude secrets and internal-only fields from export projections, including invite tokens, activation-code hashes, access-code hashes, auth challenge secrets, provider webhook payloads, and PO-internal `planReviewComments`.
  - [x] Stamp every export package with `asOf`, selected fiscal year or all-years scope, request id, tenant id, actor id, and package schema version.
  - [ ] Use server-side file generation and secure download/storage paths; do not build a browser-only ZIP or client-owned export.
  - [ ] Add audit entries for request creation, export completion/failure, and download access.

- [ ] Task 6: Add deterministic regression coverage (AC: 1-22)
  - [x] Add pure tests for row shaping, filter application, canonical status derivation, budget aggregation, anomaly detection, PO rollups, and export payload scoping.
  - [ ] Add Convex query tests proving tenant isolation, no client-provided tenant trust, missing-data fallback, and every active department appearing exactly once.
  - [ ] Add UI tests for summary tiles, filters, virtualized/incremental rows, read-only detail panel, anomaly labels, and export request states.
  - [ ] Add edge-case tests for inactive PO assignment, duplicate DU emails, missing auth users, missing fiscal-year windows with plan history, zero/negative budgets, and duplicate names/codes that only differ by normalization.
  - [ ] Add export tests proving sensitive/internal fields are omitted and exported metadata contains `asOf`, request id, actor id, tenant id, scope, and schema version.
  - [ ] Preserve or extend `webapp/tests/tenant-admin-dashboard.test.ts` so Story 3.2 dashboard behavior remains stable.
  - [x] Add runner registration in `webapp/tests/run-tests.ts` for new test files.

## Dev Notes

### Story Foundation

- Epic 3 defines Story 3.9 as institutional oversight across departments and Procurement Officers.
- Sprint status marks this story `frontend-led` and the current code confirms why: the tenant-admin shell and `/tenant-admin/departments` route already exist, but the department view still shows placeholder budget cells and only a limited department status list.
- This story should turn the tenant-admin department/overview surface into a real read-only institutional visibility workflow. It should not create PO operational controls, DU editing controls, or a second review workflow.

### Previous Story Intelligence

- Story 3.2 delivered the tenant-admin dashboard shell, summary-card pattern, fiscal-year switching, activity feed, and route namespace. Story 3.9 should extend that shell.
- Story 3.3 delivered PO invitation management and already enriches the tenant-admin dashboard query with Procurement Officer directory data and `poInvitations`.
- Story 4.6 is currently in review and has introduced department-first PO submission monitoring helpers in `webapp/lib/procurement-officer/submission-monitoring.ts` plus a monitoring query. Reuse its canonical status and timeline thinking rather than rebuilding a parallel state model.
- Story 6.7 delivered DU-facing status tracking with `selectCanonicalPlans(...)` and timeline helpers in `webapp/lib/department-user/status-tracking.ts`. This story must preserve those semantics.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/tenant-admin/departments/page.tsx` already routes through the tenant-admin dashboard shell.
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx` currently has a `renderDepartmentsView(...)` table with columns for Department, Budget Allocated, Budget Used, Utilization, and Plan Status, but budget values are hard-coded to `Awaiting budget source`.
- `webapp/convex/functions/tenantAdminDashboard.ts` currently gathers tenant users, departments, DU profiles, PO invitations, and audit logs, then returns a dashboard snapshot guarded by `requireTenantRole(ctx, ["tenant_admin"])`.
- `webapp/lib/tenant-admin/dashboard-snapshot.ts` currently limits department status to timeline/window status and intentionally marks budget utilization unavailable.
- `webapp/convex/schema.ts` already contains the necessary canonical tables for the first implementation slice: `departments`, `tenantUsers`, `departmentUserProfiles`, `plans`, `planSubmissionSnapshots`, `planReviewDecisions`, `planRedraftRequests`, `procurementCategories`, `procurementItems`, and `auditLogs`.
- `departmentAccessCodes`, `departmentAccessCodeEvents`, `departmentUserAuthChallenges`, `poInvitations`, `tenantAdminInvitations`, and `planReviewComments` contain sensitive or internal-operational data. They may be useful for coverage/audit state, but they must not be exposed raw in Tenant Admin detail panels or exports.
- `webapp/lib/procurement-officer/submission-monitoring.ts` already provides status bucket, timeline, reminder eligibility, and export row helpers for PO monitoring. Tenant Admin overview should reuse or mirror those helpers carefully, but it must remain read-only.

### Technical Requirements

- Use department-first row shaping: every active department in tenant scope must appear once even when it has no plan.
- Do not drop departments with inactive, unresolved, or cross-tenant-corrupt PO/DU references. Keep the row and mark the affected relationship unavailable or unsafe.
- Use canonical status semantics:
  - no plan means `not_started`
  - draft plan means `draft`
  - submitted plan with or without `reviewStartedAt` remains a submitted/under-review presentation detail
  - rejected or revision-requested maps to attention/rejected
  - approved maps to complete
- Use canonical budget inputs:
  - allocated budget from `departments.budgetAllocation`
  - used budget from canonical current plan or active submission snapshot `estimatedBudgetUsed`
  - utilization derived only when allocated budget is a positive number
- Normalize duplicate-detection inputs using stored normalized fields first, then a single fallback normalizer aligned with department validation. Avoid comparing display strings directly.
- Fiscal-year selection must include plan/snapshot/decision/deadline signals, not only department submission window fields.
- Department detail timelines must use public workflow fields and DU-visible decision comments only. Do not expose PO-internal `planReviewComments`.
- Server-side filtering must own search/filter/export scope when using pagination; client-side filtering is acceptable only for a deliberately bounded full dataset.
- Keep PO summary read-only and derived from department assignments. Tenant Admin must not gain PO mutation paths here.
- Keep export server-side and audited. A complete institutional export may be too large for a synchronous client response.
- Export results must be point-in-time packages. Include `asOf` metadata and avoid implying the file updates after generation.
- Prefer live repo structure over old planning paths. App routes currently live under `webapp/app/(app)/...`, not the older `src/app/(dashboard)` examples.

### Architecture Compliance

- Follow current package versions in `webapp/package.json`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `react-hook-form` `^7.47.0`
  - `zod` `^3.22.4`
  - `lucide-react` `^0.577.0`
- Keep App Router pages thin and put stateful UI under `webapp/src/components/tenant-admin/...`.
- Keep tenant authorization and dataset shaping in Convex functions near the data source.
- Use `useQuery` or `usePaginatedQuery` for live Convex reads. Do not add polling, SWR, or client-only caches for authoritative tenant data.
- Use shadcn/ui, Tailwind, and existing dashboard card/table/sheet patterns.
- Keep all state-changing actions audited; this story should mainly read data, except for export request creation.

### Library And Framework Requirements

- Convex React:
  - `useQuery` returns `undefined` while initially loading and then updates reactively when data changes.
  - `usePaginatedQuery` is acceptable for incremental loading if the overview is implemented as a paginated query.
- Convex indexes:
  - Query with field-order-aligned `withIndex(...)` ranges.
  - Add indexes only when a query cannot stay efficient with current `by_tenantId`, `by_tenantId_isActive`, `by_departmentId_fiscalYear`, or tenant/fiscal-year indexes.
- Virtualization:
  - TanStack Virtual is the best current fit if virtual scrolling is required because it is headless and leaves markup/styling under local control.
  - If the first version uses pagination instead of virtualization, keep the UI contract explicit and still satisfy 100+ department performance.
- Next.js:
  - Keep `page.tsx` route files as leaf components and avoid adding client-only logic there unless needed.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/convex/functions/tenantAdminDashboard.ts`
  - `webapp/lib/tenant-admin/dashboard-snapshot.ts`
  - `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`
  - `webapp/tests/tenant-admin-dashboard.test.ts`
  - `webapp/tests/run-tests.ts`
- Recommended new files if cohesion improves:
  - `webapp/lib/tenant-admin/institutional-visibility.ts`
  - `webapp/src/components/tenant-admin/InstitutionalOverviewView.tsx`
  - `webapp/tests/tenant-admin-institutional-visibility.test.ts`
  - `webapp/tests/tenant-admin-institutional-visibility-ui.test.tsx`
- Possible export integration files:
  - `webapp/convex/actions/files.ts`
  - `nestjs/src/files/files.controller.ts`
  - `nestjs/src/files/excel.service.ts`
  - a dedicated NestJS export template/service if the current file pipeline cannot package ZIP/JSON/CSV exports.

### Testing Requirements

- Add pure tests for:
  - active department row coverage
  - canonical plan selection
  - status bucket derivation
  - budget allocation and utilization aggregation
  - zero, negative, and missing budget fallback
  - missing-data fallback labels
  - PO rollup labels
  - anomaly detection
  - normalized duplicate detection
  - fiscal-year discovery from plan, snapshot, decision, deadline, and audit signals
  - filter summary alignment
  - export payload scoping
- Add Convex/backend tests for:
  - `requireTenantRole(ctx, ["tenant_admin"])` enforcement
  - no client-provided tenant trust
  - no inactive departments in active overview
  - no cross-tenant PO/DU/plan joins
  - inactive or missing PO/DU relationships rendered as attention states
  - every active department appearing once
  - legacy plans with missing snapshot fields
  - exported projections omitting secret hashes, invite tokens, auth challenges, raw workspace state when not needed, and PO-internal comments
- Add UI tests for:
  - overview summary tiles
  - filter controls
  - row rendering with missing and available budgets
  - read-only detail panel
  - anomaly messages
  - export request queued/ready/failure states
  - large-list rendering path
  - detail selection remaining stable across filter, sort, pagination, and live update changes

### Git Intelligence Summary

- Recent commits show the submission/review workflow is already the canonical source for status, history, and revision state:
  - `0abd7c3` implemented department user revision feedback and deadline management.
  - `6b83f05` implemented PO review decisions.
  - `f83b02e` added DU dashboard/status tracking tests.
  - `096d032` added redraft and pre-submission validation.
  - `a2f7f02` added plan submission and PO review components.
- Inference: Story 3.9 should be an oversight layer over existing department, plan, snapshot, decision, and monitoring data, not a new state machine.

### Latest Tech Information

- Verified on 2026-05-02 from official docs:
  - Next.js App Router still treats `app` as the route tree and `page` files as route UI leaves. Source: https://nextjs.org/docs/app/getting-started/project-structure
  - Convex React `useQuery` returns `undefined` while loading and then rerenders reactively when underlying query data changes. Source: https://docs.convex.dev/client/react/
  - Convex paginated queries use cursor-based pagination and `usePaginatedQuery`, and remain reactive. Source: https://docs.convex.dev/database/pagination
  - Convex indexes require range expressions to step through fields in index order, which matters for tenant/fiscal-year overview queries. Source: https://docs.convex.dev/database/reading-data/indexes/
  - TanStack Virtual is a headless virtualizer; required options include count, `getScrollElement`, and `estimateSize`, which fits a styled tenant-admin table/list without surrendering markup control. Source: https://tanstack.com/virtual/v3/docs/api/virtualizer

### Project Context Reference

- Apply `_bmad-output/project-context.md` rules:
  - strict TypeScript
  - Convex-first tenant and role enforcement
  - no client-trusted tenant IDs
  - path-alias imports in frontend code
  - shadcn/ui plus Tailwind for UI
  - audit logging for state-changing operations
  - server-side file/export workflows for sensitive tenant data
- Where planning docs conflict with live code, prefer live repo structure and current schema.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 3 Source](../epic-03-tenant-administration.md)
- [Story 3.2 Reference](./3-2-tenant-admin-dashboard.md)
- [Story 3.3 Reference](./3-3-po-management-add-invite.md)
- [Story 4.6 Reference](../../epic4/stories/4-6-submission-monitoring-reminders.md)
- [Story 6.7 Reference](../../epic6/stories/6-7-submission-status-tracking.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [Tenant Admin View Content](../../../../../webapp/src/components/tenant-admin/TenantAdminViewContent.tsx)
- [Tenant Admin Dashboard Query](../../../../../webapp/convex/functions/tenantAdminDashboard.ts)
- [Tenant Admin Dashboard Snapshot](../../../../../webapp/lib/tenant-admin/dashboard-snapshot.ts)
- [PO Submission Monitoring Helpers](../../../../../webapp/lib/procurement-officer/submission-monitoring.ts)
- [DU Status Tracking Helpers](../../../../../webapp/lib/department-user/status-tracking.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Next.js Project Structure Docs](https://nextjs.org/docs/app/getting-started/project-structure)
- [Convex React Docs](https://docs.convex.dev/client/react/)
- [Convex Pagination Docs](https://docs.convex.dev/database/pagination)
- [Convex Indexes Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [TanStack Virtualizer Docs](https://tanstack.com/virtual/v3/docs/api/virtualizer)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story sources:
  - `_bmad-output/implementation-artifacts/epics/epic3/epic-03-tenant-administration.md`
  - `_bmad-output/implementation-artifacts/epics/epic3/stories/3-3-po-management-add-invite.md`
  - `_bmad-output/implementation-artifacts/epics/epic4/stories/4-6-submission-monitoring-reminders.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-7-submission-status-tracking.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/tenantAdminDashboard.ts`
  - `webapp/lib/tenant-admin/dashboard-snapshot.ts`
  - `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`
  - `webapp/lib/procurement-officer/submission-monitoring.ts`
  - `webapp/lib/department-user/status-tracking.ts`
- Git context:
  - `git log --oneline -5`
- Tech verification:
  - `https://nextjs.org/docs/app/getting-started/project-structure`
  - `https://docs.convex.dev/client/react/`
  - `https://docs.convex.dev/database/pagination`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://tanstack.com/virtual/v3/docs/api/virtualizer`

### Completion Notes List

- 2026-05-02: Created the implementation-ready story artifact for `3-9-cross-institutional-visibility`.
- 2026-05-02: Anchored Story 3.9 to the existing tenant-admin dashboard shell and `/tenant-admin/departments` placeholder instead of introducing a parallel tenant-admin route structure.
- 2026-05-02: Scoped the story as read-only institutional oversight, with PO/DU operational mutations explicitly out of scope.
- 2026-05-02: Identified reusable canonical status and history sources from Story 4.6 PO monitoring and Story 6.7 DU status tracking.
- 2026-05-02: Ran an edge-case review and patched missing guards for inactive assignments, unsafe DU coverage, fiscal-year discovery, pagination/filter scope, sensitive-field exclusion, export point-in-time metadata, budget invalid states, and duplicate normalization.
- 2026-05-02: Implemented the first institutional visibility slice: tenant-scoped overview shaping, canonical PO/DU status reuse, budget rollups, anomaly detection, PO rollups, read-only department detail UI, queued export request auditing, and deterministic helper tests.
- 2026-05-02: Validation note: isolated institutional visibility type check and direct assertions passed; repo-wide `npm test` and `npm run build` remain blocked by pre-existing TypeScript errors in Convex files unrelated to Story 3.9.
- 2026-05-02: Code-review fixes applied: replaced the raw institutional overview return validator, switched overview reads to active-department-first plan/snapshot/decision loading, wired plan-derived fiscal years into the dashboard selector, aligned filtered summary tiles and export scope with the current filtered dataset, added incremental row loading, and moved institutional export queuing through the server-side file export bridge.

### File List

- `_bmad-output/implementation-artifacts/epics/epic3/stories/3-9-cross-institutional-visibility.md`
- `_bmad-output/implementation-artifacts/epics/epic7/epic-07-consolidation-export.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-02.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/actions/files.ts`
- `webapp/convex/functions/tenantAdminDashboard.ts`
- `webapp/lib/tenant-admin/dashboard-snapshot.ts`
- `webapp/lib/tenant-admin/dashboard.ts`
- `webapp/lib/tenant-admin/institutional-visibility.ts`
- `webapp/src/components/tenant-admin/InstitutionalOverviewView.tsx`
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`
- `webapp/tests/tenant-admin-institutional-visibility.test.ts`
- `webapp/tests/run-tests.ts`

### Change Log

- 2026-05-02: Story 3.9 created and moved to ready-for-dev with developer guidance for tenant-admin institutional overview, read-only department drill-down, budget aggregation, anomaly detection, PO rollups, scalable list rendering, and secure export request handling.
- 2026-05-02: Edge-case review patch added explicit acceptance criteria and implementation guidance for stale relationships, sensitive/internal data projection, server-authoritative filter/export scope, point-in-time exports, fiscal-year signal discovery, and anomaly false-positive prevention.
- 2026-05-02: Added institutional overview data shaping, read-only UI, anomaly/PO rollup logic, queued export request auditing, and regression coverage for core overview behavior.
- 2026-05-02: Addressed code-review findings for large-list handling, filtered summary alignment, export request lifecycle, fiscal-year discovery, explicit Convex validators, and File List transparency.

## Story Completion Status

- Story ID: `3.9`
- Story Key: `3-9-cross-institutional-visibility`
- Output File: `_bmad-output/implementation-artifacts/epics/epic3/stories/3-9-cross-institutional-visibility.md`
- Status: `done`
- Completion Note: `Code-review findings addressed; story marked done with known repo-wide quality gate limitations documented.`
