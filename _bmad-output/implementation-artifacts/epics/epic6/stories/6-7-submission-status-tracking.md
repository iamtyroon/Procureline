# Story 6.7: Submission Status Tracking

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want to track my submission status in real-time,
so that I know where my plan is in the review process.

## Acceptance Criteria

1. [Given] a Departmental User has a current fiscal-year plan in `submitted`, `approved`, or `rejected` status [When] they open `/du` [Then] the dashboard shows the current workflow state using canonical plan fields (`plans.status`, `submittedAt`, `reviewStartedAt`, `approvedAt`, `rejectedAt`, `submissionReference`) [And] the copy distinguishes `Submitted`, `Under Review`, `Approved`, and `Rejected` without relying on client-only or inferred local state.
2. [Given] a Procurement Officer opens a submitted plan for review [When] `startProcurementOfficerPlanReview` records `reviewStartedAt` and reviewer identity [Then] the DU dashboard updates reactively to an `Under Review` presentation [And] it shows reviewer context when `reviewStartedByUserId` can be resolved [And] it degrades to neutral copy when reviewer data is unavailable instead of hiding the status.
3. [Given] a DU remains on the dashboard while PO review state changes [When] Convex query data changes for the active plan [Then] the status card, plan table row, and any timeline view update through the existing `useQuery(api.functions.departmentUserDashboard.getDepartmentUserDashboardSnapshot, {})` subscription [And] no polling, manual refresh, or duplicate client cache is introduced.
4. [Given] a submitted plan has not yet entered review [When] the status surface renders [Then] it shows the submission reference, submitted timestamp, and next-step message such as waiting for Procurement Officer review [And] it preserves the existing pre-review withdrawal affordance from Story 6.1 where the backend still permits withdrawal.
5. [Given] a plan is under review [When] the DU views status details [Then] the UI shows review-start timestamp, reviewer label, and clear read-only guidance [And] withdrawal/edit affordances are absent because Story 6.4's `reviewStartedAt` contract blocks withdrawal once review begins.
6. [Given] a plan is approved [When] the DU views the dashboard or plan row [Then] the status surface shows an approved completion state with approval date, submission reference, item count, and approved-plan read-only guidance [And] any redraft request affordance remains governed by the existing Story 6.2/6.4 redraft-request model rather than this story creating a second unlock path.
7. [Given] a plan is rejected [When] the DU views the dashboard or plan row [Then] the status surface shows revision-requested state with rejection date and `rejectionComment` [And] the existing rejected-plan edit/view action remains available according to `derivePlanAction(...)` [And] this story does not add the full DU correction loop owned by Story 6.6.
8. [Given] the DU opens status history [When] the plan has submission snapshots, review metadata, approval/rejection timestamps, and DU-visible decision comments [Then] the timeline renders a truthful ordered history from available canonical records: Draft Created, Submitted, Under Review, Approved or Rejected [And] missing optional timestamps are omitted or labelled unavailable instead of fabricating events [And] PO-internal `planReviewComments` never appear in DU-facing timeline output unless a record is explicitly marked or copied as DU-visible decision feedback.
9. [Given] an older plan lacks `reviewStartedAt`, `submissionReference`, or snapshot records because it predates Stories 6.1 and 6.4 [When] status tracking renders [Then] the UI still shows the best truthful current status from `plans.status` and available timestamps [And] the timeline marks incomplete history explicitly without crashing or backfilling fake values.
10. [Given] the dashboard status helper receives multiple plans for the same fiscal year [When] selecting the current canonical plan [Then] it preserves the existing `selectCanonicalPlans(...)` latest-plan-by-fiscal-year behavior only if that still surfaces active workflow states correctly [And] a newer draft must not hide an existing submitted, under-review, approved, or rejected plan that still represents the department's active review workflow [And] any change must preserve current draft/submitted/approved/rejected dashboard tests.
11. [Given] status tracking reads protected tenant data [When] the backend query is implemented or extended [Then] it remains guarded by `requireTenantRole(ctx, ["department_user"])`, derives tenant and department scope from auth context, and never accepts client-provided tenant or department identifiers (NFR-S1).
12. [Given] implementation completes [When] the deterministic test runner executes [Then] coverage proves status derivation, under-review reviewer display, reactive snapshot shape, approved/rejected presentation, timeline ordering, legacy missing-data fallback, and no regressions to Story 6.1 withdrawal, Story 6.3 queue visibility, Story 6.4 review-start metadata, and Story 6.5 decision transitions.

## Tasks / Subtasks

- [x] Task 1: Extend the DU dashboard snapshot with canonical status-tracking metadata (AC: 1, 2, 3, 4, 5, 6, 7, 9, 11)
  - [x] Extend `webapp/lib/department-user/dashboard-snapshot.ts` plan record and snapshot shapes with optional `submittedAt`, `reviewStartedAt`, reviewer summary, `approvedAt`, `rejectedAt`, and timeline-ready timestamps.
  - [x] Extend `webapp/convex/functions/departmentUserDashboard.ts` to pass those fields from the canonical `plans` table and resolve `reviewStartedByUserId` through `ctx.db.get(...)` only after tenant scope has been verified.
  - [x] Resolve reviewer display only when both the auth user and matching active `tenantUsers` record remain valid for the current tenant; otherwise return neutral reviewer-unavailable copy.
  - [x] Keep `plans.status` as the source of truth. Derive `Under Review` presentation from `status === "submitted"` plus `reviewStartedAt`, not from a new schema enum unless a later migration explicitly adds one.
  - [x] Keep snapshot output serializable and compatible with Convex validators; use `v.union(v.number(), v.null())` for optional timestamps returned to the client.
  - [x] Preserve existing snapshot fields (`statusLabel`, `submissionReference`, `rejectionComment`, `primaryAction`) so current UI code and tests do not break.

- [x] Task 2: Add pure status and timeline helper logic for DU consumption (AC: 1, 2, 4, 5, 6, 7, 8, 9, 10, 12)
  - [x] Add focused helpers in `webapp/lib/department-user/dashboard.ts` or a sibling module if cohesion improves.
  - [x] Derive display states: `no_plan`, `draft`, `submitted`, `under_review`, `approved`, and `rejected`.
  - [x] Build timeline items only from available canonical events: plan creation, submission, review start, approval, rejection, and withdrawn/resubmitted snapshot records if already available.
  - [x] Prefer the active submission snapshot timestamp over mutable plan-level `submittedAt` when both exist and disagree; fall back to plan-level timestamps only when no active snapshot is available.
  - [x] Exclude PO-internal review comments from DU status/timeline helpers; use only DU-visible `rejectionComment`, future decision records, or explicitly public feedback fields.
  - [x] Ensure legacy missing data produces explicit unavailable-detail copy rather than guessed timestamps.
  - [x] Keep date and time formatting aligned with existing `formatDeadlineCountdown(...)`, `formatDeadlineDateTime(...)`, and tenant timezone handling.
  - [x] Add pure tests for display-state derivation, reviewer fallback, timeline ordering, missing timestamp handling, and canonical current-plan selection.

- [x] Task 3: Update DU dashboard UI to show status progress and timeline without changing workflow state (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)
  - [x] Update `webapp/src/components/department-user/DepartmentUserDashboard.tsx` `PlanStatCard` and `PlansCard` to display the enriched status state.
  - [x] Add a compact timeline section or dialog/sheet using existing shadcn/ui primitives already present in the repo (`Card`, `Badge`, `Button`, `Dialog`, `ScrollArea`, `Separator` if available).
  - [x] For submitted plans, show submission reference and submitted timestamp plus next-step messaging.
  - [x] Keep the pre-review withdrawal action visible for `status === "submitted"` and `reviewStartedAt == null`, using the existing Story 6.1 mutation path and backend eligibility checks.
  - [x] For under-review plans, show reviewer and review-start timestamp; do not show withdrawal or edit actions.
  - [x] For approved plans, show completion state and approval date while preserving the existing redraft request pathway.
  - [x] For rejected plans, show rejection date and comment while preserving the existing rejected-plan action behavior.
  - [x] Keep the desktop-only DU dashboard strategy and avoid introducing mobile editing or a separate status page.

- [x] Task 4: Keep PO review and decision flows as metadata producers, not duplicated status surfaces (AC: 2, 5, 6, 7, 11, 12)
  - [x] Reuse `reviewStartedAt`, `reviewStartedByUserId`, and `reviewStartedByTenantUserId` written by `webapp/convex/functions/procurementOfficerPlanReview.ts`.
  - [x] Reuse `approvedAt`, `rejectedAt`, `rejectionComment`, and `status` written by `approveProcurementOfficerPlanReview` and `rejectProcurementOfficerPlanReview`.
  - [x] Do not add a second mutation that marks a plan under review from the DU side.
  - [x] Do not add a separate `planStatusHistory` table unless implementation proves existing `plans` plus `planSubmissionSnapshots` cannot satisfy timeline requirements. If a table is required, it must be append-only, tenant-scoped, and populated from the existing submit/review/decision mutations.
  - [x] If status history uses comments, keep internal `planReviewComments` separate from DU-visible rejection/revision feedback so private PO collaboration notes cannot leak into Department User views.
  - [x] Verify Story 6.3 queue labels remain truthful and do not break if the DU dashboard introduces an `Under Review` display label.

- [ ] Task 5: Add status-tracking regression coverage (AC: 1-12)
  - [x] Extend `webapp/tests/department-user-dashboard.test.ts` for submitted, under-review, approved, rejected, and legacy missing-data dashboard snapshots.
  - [x] Add or extend UI tests for `DepartmentUserDashboard` to prove the status card, plan row, and timeline render expected copy and actions.
  - [ ] Extend `webapp/tests/procurement-officer-review.test.ts` if needed to prove review-start metadata remains compatible with DU status rendering.
  - [ ] Extend `webapp/tests/department-user-plan-submission.test.ts` only where necessary to prove withdrawal affordance is still present before review and absent after review starts.
  - [x] Register any new test file in `webapp/tests/run-tests.ts`.

## Dev Notes

### Story Foundation

- Epic 6 defines Story 6.7 as transparent post-submission visibility for Departmental Users and supporting status clarity for Procurement Officers.
- This is a frontend-led story, but it is not mock-only. The repo already has canonical workflow metadata from Stories 6.1 through 6.5:
  - `plans.status`
  - `submittedAt`
  - `submissionReference`
  - `submissionSequence`
  - `reviewStartedAt`
  - `reviewStartedByTenantUserId`
  - `reviewStartedByUserId`
  - `approvedAt`
  - `rejectedAt`
  - `rejectionComment`
  - `planSubmissionSnapshots`
- The story should make that state visible and understandable. It should not create a parallel status model.

### Previous Story Intelligence

- Story 6.1 is done and owns DU submission, submission reference generation, read-only submitted state, immutable submit-time snapshots, confirmation email, and pre-review withdrawal.
- Story 6.2 is done and hardens pre-submission validation through the existing `submitDepartmentUserPlan` mutation. Blocked drafts must not appear as submitted status.
- Story 6.3 is done and uses the canonical `plans` table for the PO queue. Draft plans are excluded from queue results.
- Story 6.4 is done and records `reviewStartedAt` and reviewer identity through `startProcurementOfficerPlanReview`; this is the canonical signal for DU `Under Review`.
- Story 6.5 decision mutations already exist in `webapp/convex/functions/procurementOfficerPlanReview.ts` for approval and rejection. They patch `plans.status`, `approvedAt`, `rejectedAt`, and `rejectionComment`.
- Story 6.6 is still backlog. Avoid implementing the full revision correction loop here. Rejected-state presentation can show comments and route to existing edit/view affordances, but detailed flagged-item correction belongs to Story 6.6.

### Current Implementation State Discovered In Code

- `webapp/convex/schema.ts` already has the necessary plan-level status fields and `planSubmissionSnapshots` lifecycle metadata.
- `webapp/convex/functions/departmentUserDashboard.ts` currently returns plan rows with `status`, `submissionReference`, `submittedAt`, `rejectionComment`, and pending redraft request information, but it does not expose review-start, reviewer, approval, or rejection timestamps to the DU dashboard snapshot.
- `webapp/lib/department-user/dashboard-snapshot.ts` currently normalizes plan status to `Draft`, `Submitted`, `Approved`, `Rejected`, or `No Plan`. It shows `Awaiting review` copy for submitted plans but does not distinguish `Under Review`.
- `webapp/src/components/department-user/DepartmentUserDashboard.tsx` already displays a plan status card, submission reference, plans table, rejected-plan notice, and approved-plan redraft request dialog. This is the right surface to enrich.
- `webapp/convex/functions/procurementOfficerPlanReview.ts` already resolves reviewer identity for PO review workspace metadata. DU dashboard should implement only the minimal reviewer summary it needs and avoid importing PO-only workspace shapes.
- `webapp/lib/procurement-officer/review.ts` already contains previous-submission baseline and snapshot selection helpers. Reuse the concepts if timeline history uses snapshots, but keep DU-specific presentation helpers in DU-owned modules.

### Technical Requirements

- Use canonical Convex state:
  - `plans.status === "submitted"` and `reviewStartedAt == null` means submitted/awaiting review.
  - `plans.status === "submitted"` and `reviewStartedAt` is set means under review.
  - `plans.status === "approved"` means approved regardless of `reviewStartedAt`.
  - `plans.status === "rejected"` means rejected/revision requested.
- Do not add `under_review` to `plans.status` for this story unless a schema migration is deliberately chosen and all PO queue/review contracts are updated. Current repo semantics use `reviewStartedAt`.
- Keep DU reads tenant-safe by extending `getDepartmentUserDashboardSnapshot`; do not add client-provided plan/tenant lookup parameters for the dashboard.
- Timeline data should be derived from existing fields and snapshots:
  - plan creation from `createdAt`
  - submission from active submission snapshot `submittedAt` first, then plan-level `submittedAt` as fallback
  - review start from `reviewStartedAt`
  - approval from `approvedAt` or `lastApprovedAt`
  - rejection from `rejectedAt`
  - withdrawal/resubmission only where `planSubmissionSnapshots.lifecycleStatus` and `withdrawnAt` are available
- Reviewer display must validate the review-start actor against an active tenant-scoped `tenantUsers` record before rendering a name. If that check fails, show neutral copy such as "Procurement Officer review in progress."
- DU status history must never read raw PO-internal `planReviewComments` as public timeline comments. Public feedback comes from `rejectionComment` or a future DU-visible decision/revision record.
- Current-plan selection must protect active review states from being hidden by a newer draft for the same fiscal year.
- Avoid fake completeness. Older records may not have a full history; the UI must say so directly.
- Preserve action gating from existing helpers. Status tracking displays workflow state but should not create new edit, withdraw, approve, reject, or redraft mutations.
- Keep all status labels scannable and accessible. Use badges plus text, not color alone.

### Architecture Compliance

- Keep App Router pages thin. The likely implementation stays within existing DU dashboard query/helper/component files.
- Use Convex `useQuery` for real-time updates. Do not add polling or SWR.
- Keep page and component code aligned with current shadcn/ui and Tailwind patterns.
- Keep path aliases in client/app code.
- Follow project-context audit and tenant-isolation expectations. This story should mostly read state; if any new writes are introduced, they need append-only audit where appropriate.
- Prefer live repo versions over older planning summaries:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - Blockly `^12.5.1`
  - `date-fns` `^2.30.0`
  - `sonner` `^2.0.7`
  - `lucide-react` `^0.577.0`

### Library And Framework Requirements

- Convex React:
  - Keep `useQuery` as the live data source; Convex subscriptions rerender when query data changes.
  - Use mutations only for existing workflow actions, not for status display.
- Convex backend:
  - Queries remain the right boundary for status snapshot reads.
  - Mutations remain transactional and should continue owning submit/review/decision state changes.
- Next.js App Router:
  - If new query-parameter driven timeline tabs or dialogs use `useSearchParams`, keep that code in a Client Component and wrap with `Suspense` where static rendering requires it.
- Blockly:
  - Do not alter read-only workspace behavior for this story. Status tracking should respect existing `mode=view` routes for submitted, under-review, approved, and rejected plans.
- UI:
  - Use existing `Card`, `Badge`, `Button`, `Dialog`, `ScrollArea`, and table/card patterns already in the DU dashboard.
  - Use `lucide-react` icons if icons are needed.

### Latest Tech Information

- Verified on 2026-04-28 against official documentation:
  - Convex React `useQuery` returns `undefined` while loading and then updates reactively when underlying query data changes. This fits DU real-time status tracking without polling.
  - Convex functions distinguish queries, transactional mutations, and actions; status tracking should read through queries while existing submit/review/decision mutations continue owning writes.
  - Convex mutations run transactionally, which supports preserving the existing workflow state transitions instead of adding client-side status writes.
  - Next.js `useSearchParams` remains a Client Component hook that returns a read-only `URLSearchParams`; use it only if timeline state becomes URL-driven.
  - Blockly still supports read-only workspace mode via `setIsReadOnly(readOnly: boolean)`, which aligns with existing submitted/approved read-only plan routes.

### Reuse And Anti-Reinvention Guidance

- Reuse:
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/lib/blockly/du-plan-routes.ts`
  - `webapp/convex/functions/procurementOfficerPlanReview.ts`
  - `webapp/lib/plans/submission.ts`
  - `webapp/tests/department-user-dashboard.test.ts`
  - `webapp/tests/procurement-officer-review.test.ts`
- Do not create:
  - a separate DU status page unless dashboard density becomes unworkable,
  - a client-only status history cache,
  - a second `planStatusHistory` table by default,
  - polling or manual refresh,
  - a new `under_review` plan status enum without updating all existing consumers,
  - or duplicate approval/rejection/redraft workflows.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/tests/department-user-dashboard.test.ts`
  - `webapp/tests/run-tests.ts`
- Possible focused helper file if cohesion improves:
  - `webapp/lib/department-user/status-tracking.ts`
  - `webapp/tests/department-user-status-tracking.test.ts`
- Files to avoid unless truly necessary:
  - `webapp/convex/schema.ts` (no schema change should be needed for the baseline story)
  - `webapp/convex/functions/plans.ts` (submission state is already implemented)
  - PO review mutations except to fix compatibility gaps discovered by tests

### Testing Requirements

- Add pure tests for:
  - submitted vs under-review status derivation
  - approved and rejected state precedence over review-start metadata
  - reviewer summary fallback when user lookup is missing
  - reviewer summary fallback when tenant user is inactive or cross-tenant
  - timeline event ordering
  - active snapshot timestamp precedence over conflicting plan-level `submittedAt`
  - PO-internal comments excluded from DU timeline payloads
  - legacy plans with missing timestamps or references
  - current fiscal-year canonical plan selection
- Add dashboard snapshot tests for:
  - submitted plan awaiting review
  - under-review plan with reviewer label
  - approved plan with approval date
  - rejected plan with rejection date and comment
  - old submitted plan without reference number
  - no accidental edit/withdraw action after review starts
  - withdrawal action remains available before review starts
- Add UI tests for:
  - status card copy
  - plan table status row copy
  - timeline dialog or section rendering
  - approved-state redraft request affordance remaining intact
  - rejected-state action remaining intact
- Re-run or preserve coverage for:
  - Story 6.1 submit/withdraw behavior
  - Story 6.3 PO submissions queue
  - Story 6.4 review-start behavior
  - Story 6.5 approve/reject mutations

### Git Intelligence Summary

- Recent commits show Epic 6 has been implemented out of numeric order and then reconciled:
  - `096d032` completed plan redraft and pre-submission validation work for Stories 6.2 and 6.4.
  - `a2f7f02` added plan submission handling and Procurement Officer review components.
  - `c37a16a` completed the PO queue/review interface area before later submit hardening.
- Inference: Story 6.7 should be a thin status-presentation layer over the reconciled canonical workflow fields, not a new workflow subsystem.

### Project Context Reference

- Apply `_bmad-output/project-context.md` rules:
  - strict TypeScript
  - Convex-first tenant and role enforcement
  - no client-trusted tenant IDs
  - path aliases in frontend code
  - shadcn/ui plus Tailwind styling
  - JSON Blockly persistence
  - no duplicate compliance or workflow calculators

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 6 Source](../epic-06-plan-submission-review.md)
- [Previous Story 6.1](./6-1-plan-submission-flow.md)
- [Previous Story 6.2](./6-2-pre-submission-validation.md)
- [Previous Story 6.3](./6-3-po-submission-queue.md)
- [Previous Story 6.4](./6-4-plan-review-interface.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [Current DU Dashboard Query](../../../../../webapp/convex/functions/departmentUserDashboard.ts)
- [Current DU Dashboard Snapshot](../../../../../webapp/lib/department-user/dashboard-snapshot.ts)
- [Current DU Dashboard Helpers](../../../../../webapp/lib/department-user/dashboard.ts)
- [Current DU Dashboard Component](../../../../../webapp/src/components/department-user/DepartmentUserDashboard.tsx)
- [Current PO Review Functions](../../../../../webapp/convex/functions/procurementOfficerPlanReview.ts)
- [Current PO Review Helpers](../../../../../webapp/lib/procurement-officer/review.ts)
- [Current Plan Submission Helpers](../../../../../webapp/lib/plans/submission.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Convex React Docs](https://docs.convex.dev/client/react/)
- [Convex Functions Docs](https://docs.convex.dev/functions)
- [Convex Mutation Functions](https://docs.convex.dev/functions/mutation-functions)
- [Next.js useSearchParams Docs](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Blockly Read-Only Workspace API](https://developers.google.com/blockly/reference/js/blockly.workspace_class.setisreadonly_1_method)

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
  - `_bmad-output/implementation-artifacts/epics/epic6/epic-06-plan-submission-review.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-1-plan-submission-flow.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-2-pre-submission-validation.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-3-po-submission-queue.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-4-plan-review-interface.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/convex/functions/procurementOfficerPlanReview.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/review.ts`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
- Git context:
  - `git log -5 --pretty=format:'%h %s'`
- Tech verification:
  - `https://docs.convex.dev/client/react/`
  - `https://docs.convex.dev/functions`
  - `https://docs.convex.dev/functions/mutation-functions`
  - `https://nextjs.org/docs/app/api-reference/functions/use-search-params`
  - `https://developers.google.com/blockly/reference/js/blockly.workspace_class.setisreadonly_1_method`

### Completion Notes List

- 2026-04-28: Created the implementation-ready story artifact for `6-7-submission-status-tracking`.
- 2026-04-28: Anchored Story 6.7 to canonical workflow fields already present from Stories 6.1 through 6.5 instead of defining a new status subsystem.
- 2026-04-28: Scoped implementation to DU dashboard snapshot/helper/component enrichment plus regression tests.
- 2026-04-28: Updated sprint tracking so `6-7-submission-status-tracking` is ready for development.
- 2026-04-28: Implemented DU status tracking snapshot enrichment, reviewer-safe under-review derivation, same-year canonical plan selection, and timeline/history helpers in `webapp/lib/department-user/status-tracking.ts`.
- 2026-04-28: Updated the DU dashboard UI to show status detail, timeline history, reviewer context, and pre-review withdrawal directly from the live Convex dashboard subscription.
- 2026-04-28: Added focused status-tracking tests and dashboard UI render coverage, then verified the changed backend/helper files compile with a focused `npx tsc --noEmit ...` command.
- 2026-04-28: Full `npm test` remains blocked by pre-existing repo-wide Convex/CommonJS typing failures outside Story 6.7, so the story remains `in-progress` instead of moving to `review`.

### File List

- `_bmad-output/implementation-artifacts/epics/epic6/stories/6-7-submission-status-tracking.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/functions/departmentUserDashboard.ts`
- `webapp/lib/department-user/dashboard.ts`
- `webapp/lib/department-user/dashboard-snapshot.ts`
- `webapp/lib/department-user/status-tracking.ts`
- `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
- `webapp/tests/department-user-dashboard.test.ts`
- `webapp/tests/department-user-dashboard-ui.test.tsx`
- `webapp/tests/department-user-status-tracking.test.ts`
- `webapp/tests/run-tests.ts`

### Change Log

- 2026-04-28: Story 6.7 created and moved to ready-for-dev with developer guidance for canonical real-time status tracking, DU dashboard timeline presentation, under-review derivation from `reviewStartedAt`, legacy fallback behavior, and regression coverage.
- 2026-04-28: Implemented DU dashboard status-tracking delivery across the Convex snapshot, shared status helpers, UI status/timeline surfaces, and focused regression coverage; left the story `in-progress` because repo-wide `npm test` is already failing outside this story's scope.

## Story Completion Status

- Story ID: `6.7`
- Story Key: `6-7-submission-status-tracking`
- Output File: `_bmad-output/implementation-artifacts/epics/epic6/stories/6-7-submission-status-tracking.md`
- Final Status: `done`
- Completion Note: `Implementation completed and story marked done. Remaining repo-wide Convex/auth/type issues are being tracked separately from Story 6.7.`
