# Story 6.2: Pre-Submission Validation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want the system to validate my plan before submission,
so that I know my plan is complete and valid before PO reviews it.

## Acceptance Criteria

1. [Given] a Departmental User opens an editable draft plan [When] the workspace summary is calculated or the user opens the submit review step [Then] the system evaluates one canonical pre-submission validation result covering plan completeness, zero-quantity items, pending catalog requests, deadline status, malformed or unavailable workspace data, and budget compliance [And] both the toolbar disabled state and confirmation dialog use that same result rather than separate client/backend rule sets (FR50, FR51).
2. [Given] a DU attempts to submit an empty plan [When] validation runs in the client preview or backend submit mutation [Then] submission is blocked with copy equivalent to `Plan must have at least 1 item` [And] no submission reference, snapshot, email, queue row, or status transition is created (FR50a).
3. [Given] a DU has one or more plan items whose total quantity across Q1-Q4 is zero [When] validation runs [Then] submission is blocked for each offending item with copy equivalent to `[Item name] has zero quantity. Enter quantity or remove item.` [And] the item remains visible in the itemized issue list with a fix target when a block id or category path is known (FR50b, FR50d).
4. [Given] a DU has pending item or category requests for the same tenant, department, fiscal year, and current plan [When] validation runs [Then] submission is blocked with copy equivalent to `You have [X] pending requests. Cancel or wait for PO decision.` [And] item requests with linked pending category handoff records also block submission [And] cancelled, denied, approved, expired, unrelated-tenant requests, and pending requests from another plan do not block the current plan (FR50c, NFR-S1).
5. [Given] validation finds multiple issues [When] the submit review dialog opens or the submit button is disabled [Then] all blocking issues are shown as an itemized list, grouped enough for scanning, with fix links or focus/scroll targets for workspace items, pending requests, deadline information, and budget summary where the target exists [And] duplicate or overlapping issues for the same item are grouped or de-duplicated [And] clicking a valid fix target scrolls to and highlights the problem area without mutating the plan [And] stale or missing fix targets degrade to a clear unavailable-target message instead of a dead click (FR50d).
6. [Given] the department submission window has not opened or has already closed for the plan fiscal year [When] validation runs [Then] submission is blocked with copy equivalent to `Submission window has not opened yet.` before open or `Submission deadline has passed. Contact your PO.` at or after close [And] the backend enforces the same check using canonical deadline data so stale UI or a second tab cannot submit outside the window (FR50e).
7. [Given] validation passes [When] the DU opens the submit review step [Then] the dialog displays a validation summary with total items, total amount, budget utilization percent, deadline status, pending-request clear state, and validation pass state [And] final submission still requires an explicit confirm click (FR50g).
8. [Given] the plan exceeds budget or has no usable budget allocation [When] validation runs [Then] submission remains blocked with the existing budget copy such as `Budget exceeded by [amount]. Reduce items to submit.` or the current unallocated-budget message [And] budget validation remains derived from the canonical workspace summary, not a new browser-only calculator (FR51).
9. [Given] a DU bypasses the UI, has stale validation state, double-clicks, or submits while request/deadline data changes [When] `submitDepartmentUserPlan` runs [Then] the mutation preserves Story 6.1 idempotent replay for an already-submitted plan with `submittedAt` and `submissionReference` before running new draft-only blockers [And] recomputes the full validation result transactionally before patching draft `plans`, inserting `planSubmissionSnapshots`, scheduling email, or appending successful audit events [And] blocked attempts append a queryable `plan.submission_blocked` audit event with the primary reason and issue codes.
10. [Given] Story 6.1 already owns submission references, immutable submission snapshots, email queueing, DU withdrawal, and active baseline selection [When] Story 6.2 is implemented [Then] it extends the existing validation helper and submit mutation only [And] it does not create a second submission table, change PO queue semantics, approve/reject plans, or move snapshot ownership away from submit time.
11. [Given] the PO queue and review workspace from Stories 6.3 and 6.4 consume canonical submitted plans [When] a validation failure occurs [Then] draft plans remain absent from the PO queue and no review metadata is touched [And] existing submitted, reviewed, approved, and rejected plans keep their current behavior.
12. [Given] implementation is complete [When] the repo test runner executes [Then] deterministic coverage proves client helper validation, backend mutation blocking, deadline boundary handling, pending-request filtering, itemized fix-target shaping, validation-summary display, no side effects on blocked submit, and compatibility with existing Story 6.1/6.3/6.4 tests.

## Tasks / Subtasks

- [x] Task 1: Extend the shared pre-submission validation model instead of adding another rule path (AC: 1, 2, 3, 5, 8, 10, 12)
  - [x] Extend `webapp/lib/blockly/workspace-validation.ts` or a focused sibling helper so zero-total item checks become blocking validation issues.
  - [x] Add issue metadata needed for submit-review UX: stable issue code, item/category labels, block id when available, category id, severity, blocks-submission flag, and optional fix target.
  - [x] Keep existing duplicate-item, inactive-item, quantity-normalization, budget, and summary-unavailable behavior intact.
  - [x] Update `webapp/lib/blockly/plan-submission.ts` so `buildDepartmentUserPlanSubmissionReviewSummary(...)` returns itemized issues plus high-level blocker messages without losing current copy.
  - [x] Preserve `getDepartmentUserPlanSubmitState(...)` as the one helper used by both `BlocklyEditor.tsx` and backend submit validation.

- [x] Task 2: Add pending catalog-request blockers using existing request tables and helper semantics (AC: 1, 4, 5, 9, 10, 12)
  - [x] Reuse `categoryRequests` and `itemRequests` from `webapp/convex/schema.ts`; do not introduce a new pending-request store.
  - [x] Query pending requests by tenant, department, fiscal year, and exact current `planId` in the backend submit path.
  - [x] Count only status `pending`; exclude cancelled, approved, denied, expired, unrelated request records, and same-department requests tied to another plan.
  - [x] Include linked pending category handoff records created through item requests so dependent unresolved category work cannot be bypassed.
  - [x] Surface the pending-request count and a fix target suitable for the existing catalog-request dialog or workspace request area.
  - [x] Add pure helper tests for pending-request summary wording, status filtering, exact-plan scoping, and linked category handoff blocking.

- [x] Task 3: Enforce submission deadline blockers from canonical deadline data (AC: 1, 5, 6, 7, 9, 12)
  - [x] Use the current department deadline fields and shared deadline records already maintained by `webapp/convex/functions/deadlines.ts`.
  - [x] Prefer a small shared helper in `webapp/lib/department-user/dashboard.ts` or a focused deadline-validation helper if it avoids duplicating date-window logic.
  - [x] Define one `resolveEffectiveSubmissionWindow(...)` rule for conflicts between shared `submissionDeadlines` records and copied department fields; prefer the newest canonical deadline version when available and fall back to department fields only when no shared record exists.
  - [x] Block submit when the current time is before `submissionStartsAt` or greater than or equal to the applicable `submissionEndsAt`; include the configured timezone where existing helpers already expose it.
  - [x] Keep before-window behavior aligned with current access-mode/dashboard rules; do not reopen edit access outside the established deadline contract.
  - [x] Add boundary tests for before open, during window, exactly at close, after close, missing deadline data, shared-vs-department mismatch, and stale UI submission.

- [x] Task 4: Update DU submit-review UX to show all validation results with fix links (AC: 1, 3, 5, 7, 8, 12)
  - [x] Update `webapp/src/components/blockly/BlocklyEditor.tsx` submit-review dialog to render itemized issues, pass states, and fix actions.
  - [x] Implement scroll/focus/highlight behavior for known Blockly block ids or category sections using the existing workspace DOM/runtime hooks where possible.
  - [x] Add non-workspace fix targets for pending requests, deadline information, and budget meter sections.
  - [x] De-duplicate overlapping issue rows for the same item and show all reason codes without repeating the same fix action.
  - [x] Handle stale fix targets by showing a clear "target no longer available; refresh validation" state instead of silently doing nothing.
  - [x] Preserve existing explicit confirm behavior and the current `Review & Submit` flow from Story 6.1.
  - [x] Ensure disabled submit copy remains concise while the dialog or inline alert carries the full issue list.

- [x] Task 5: Harden `submitDepartmentUserPlan` with full server-side validation before side effects (AC: 2, 3, 4, 6, 8, 9, 10, 11, 12)
  - [x] Preserve the existing Story 6.1 already-submitted replay branch before applying draft-only validation blockers, so a lost-response retry cannot fail because deadline or request state changed after the successful submit.
  - [x] In `webapp/convex/functions/plans.ts`, recompute workspace summary, zero-quantity issues, pending-request blockers, deadline blockers, and budget blockers immediately before changing plan state.
  - [x] Ensure blocked submissions do not patch `plans`, insert `planSubmissionSnapshots`, allocate a new sequence, schedule email, or create PO-visible queue state.
  - [x] Append a blocked audit event with issue codes and primary message; keep successful audit events unchanged.
  - [x] Keep all tenant and department scope derived from auth via `requireTenantRole(ctx, ["department_user"])`.

- [x] Task 6: Add regression coverage and wire it into the deterministic runner (AC: 1-12)
  - [x] Extend `webapp/tests/department-user-plan-submission.test.ts` for zero-quantity blockers, issue-list shaping, validation summary, and submit-state copy.
  - [x] Add or extend backend-oriented tests for pending request blockers, deadline blockers, no side effects on blocked submit, and audit metadata shape.
  - [x] Extend `webapp/tests/department-user-blockly-workspace-ui.test.tsx` for fix-link rendering and scroll/highlight behavior if test infrastructure supports DOM assertions.
  - [x] Re-run existing Story 6.1, 6.3, and 6.4 suites to prove compatibility.
  - [x] Update `webapp/tests/run-tests.ts` if a new suite is introduced.

## Dev Notes

### Story Foundation

- Epic 6 defines Story 6.2 as the pre-flight enforcement layer before a draft can enter PO review.
- Story 6.1 is already done and owns the actual submit transition, reference number, immutable submission snapshot, confirmation email, withdrawal before review, and active submission baseline.
- Story 6.2 must therefore deepen the validation contract that feeds Story 6.1 instead of moving or duplicating submission ownership.

### Previous Story Intelligence

- Story 6.1 added `webapp/lib/blockly/plan-submission.ts`, `submitDepartmentUserPlan`, `withdrawDepartmentUserPlanSubmission`, `planSubmissionSnapshots`, submission email state, and regression tests.
- Story 6.1 already blocks empty plans, over-budget plans, unallocated-budget plans, unsaved drafts, malformed workspace summaries, inactive catalog items, and duplicate catalog items through shared helper paths.
- Story 6.1 intentionally left the richer FR50-FR51 rule set to this story. The main known gaps are deadline enforcement, pending request enforcement, zero-total item blocking, and itemized fix-target UX.
- Story 6.3 is done and reads the PO queue from canonical `plans.status`, `submittedAt`, and summary fields. Blocked validation must leave plans in `draft` so the queue remains truthful.
- Story 6.4 is in review and uses `reviewStartedAt` plus immutable submission snapshots. Story 6.2 should not touch review metadata except by preventing invalid submissions from ever creating snapshots.

### Current Implementation State Discovered In Code

- `webapp/lib/blockly/workspace-validation.ts` currently produces item-level issues for duplicate catalog items, inactive items, invalid quantities, whole-number requirements, max quantity, and minimum-quantity warnings.
- `workspace-validation.ts` does not currently block items whose normalized Q1-Q4 total is zero.
- `webapp/lib/blockly/plan-submission.ts` currently builds submit-state and review-summary objects from workspace summary, budget state, save state, and validation state.
- `webapp/convex/functions/plans.ts` currently recomputes the workspace summary inside `submitDepartmentUserPlan` before it patches canonical submission state.
- `submitDepartmentUserPlan` currently uses `getDepartmentUserPlanSubmitState(...)`, then patches `plans`, inserts `planSubmissionSnapshots`, appends audit events, and schedules the existing email action.
- `categoryRequests` and `itemRequests` already exist with `tenantId`, `departmentId`, `planId`, `fiscalYear`, requestor fields, and `status`.
- Department and shared deadline infrastructure already exists through `departments.submissionStartsAt`, `departments.submissionEndsAt`, `submissionDeadlines`, and `webapp/convex/functions/deadlines.ts`.
- The DU dashboard already derives deadline presentation from existing helpers in `webapp/lib/department-user/dashboard.ts` and `webapp/lib/department-user/dashboard-snapshot.ts`.

### Technical Requirements

- Validation must be canonical and shared. The same issue model should drive disabled state, submit-review display, and backend mutation blocking.
- Backend validation is mandatory. UI validation is helpful but cannot be trusted for deadline, pending-request, tenant, department, or final workspace state.
- Use Convex mutations for the transactional submission decision. Convex mutations are the correct place for database writes and business logic, and they commit writes together or not at all.
- Keep external email calls in actions/scheduled actions. Convex actions remain the appropriate outside-world boundary; Story 6.2 should not change Story 6.1's email action pattern.
- Treat validation warnings separately from blockers. Existing quantity normalization and minimum-quantity hints can remain warnings unless the FR explicitly requires a block.
- Zero-total items are blockers even if each individual quarter field is syntactically valid.
- Pending request blockers must be scoped to the active tenant, department, plan, and fiscal year. Do not block a plan because of another tenant's or another plan's pending request.
- Pending request blockers must include linked pending category handoff records created through item requests when the unresolved category is needed by the current plan.
- Deadline blockers must use server time in the backend. Client-rendered deadline state is only presentation.
- Deadline validation must treat `now >= submissionEndsAt` as closed, `now < submissionStartsAt` as not open, and must define how shared deadline records override copied department fields.
- Already-submitted idempotent replay must run before draft-only validation blockers so successful submissions do not become false failures on client retry.
- Blocked submit attempts must have no submission side effects: no reference allocation, no snapshot, no email, no PO queue entry, no status transition.
- Audit metadata should include stable issue codes so future reporting can count validation failures without parsing user-facing copy.

### Architecture Compliance

- Keep App Router pages thin. This story should primarily edit shared helpers, the Blockly editor component, and Convex functions.
- Preserve Convex-first tenant and role enforcement with `requireTenantRole(ctx, ["department_user"])`.
- Continue using JSON Blockly workspace persistence and existing summary helpers.
- Use shadcn/ui and existing Procureline workspace styling; do not add a new validation UI framework.
- Use `sonner` for transient success/error feedback, but render validation issues in durable UI inside the submit-review flow.
- Keep PO queue and review contracts unchanged.

### Library And Framework Requirements

- Current repo versions from `webapp/package.json`:
  - `next`: `^16.1.6`
  - `react`: `^19.2.4`
  - `convex`: `^1.13.2`
  - `blockly`: `^12.5.1`
  - `date-fns`: `^2.30.0`
  - `sonner`: `^2.0.7`
  - `zod`: `^3.22.4`
- Latest documentation checked on 2026-04-27:
  - Convex mutations are transactional and are the right boundary for database-backed business-state changes.
  - Convex actions can call third-party services and should remain the outside-world boundary for email side effects.
  - Convex React `useMutation(...)` returns an async function suitable for the current confirm-submit flow.
  - Next.js App Router `useRouter` from `next/navigation` remains the correct client hook for programmatic route replacement after successful submit or withdrawal; keep hrefs sanitized.
  - Blockly still supports read-only workspace mode, which matters because invalid submissions must not affect Story 6.4's read-only review behavior.

### Reuse And Anti-Reinvention Guidance

- Reuse:
  - `webapp/lib/blockly/workspace-validation.ts`
  - `webapp/lib/blockly/plan-submission.ts`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/catalogRequests.ts`
  - `webapp/lib/procurement/catalog-requests.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
- Do not create:
  - a second submission mutation,
  - a second validation summary calculator,
  - a separate pre-submission page,
  - a shadow pending-request table,
  - or client-only validation that the backend does not enforce.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/lib/blockly/workspace-validation.ts`
  - `webapp/lib/blockly/plan-submission.ts`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/convex/functions/plans.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/tests/department-user-plan-submission.test.ts`
  - `webapp/tests/department-user-blockly-workspace-ui.test.tsx`
  - `webapp/tests/run-tests.ts`
- Possible focused helper files if cohesion improves:
  - `webapp/lib/plans/pre-submission-validation.ts`
  - `webapp/tests/department-user-pre-submission-validation.test.ts`

### Testing Requirements

- Add pure tests for:
  - zero-total item detection
  - overlapping issue de-duplication for the same item
  - blocker message de-duplication
  - itemized issue shaping
  - fix-target generation
  - budget pass/fail summary
  - pending-request count summary
  - deadline pass/fail summary
- Add backend tests for:
  - empty plan blocked with no side effects
  - zero-total items blocked with no side effects
  - pending request blocked with no side effects
  - linked category handoff request blocked with no side effects
  - pending request for another plan does not block current plan
  - before-window submission blocked with no side effects
  - deadline passed blocked with no side effects
  - exact close timestamp blocked with no side effects
  - shared deadline record takes precedence over stale department deadline fields
  - over-budget still blocked through existing helper
  - valid plan still submits through Story 6.1 flow
  - already-submitted idempotent replay still returns the existing submission payload
- Add UI tests for:
  - submit review shows all blockers
  - fix links render for known workspace issues
  - stale fix links show an unavailable-target fallback
  - validation summary renders only when blockers are clear
  - confirm remains explicit

### Git Intelligence Summary

- Recent commits show Epic 6 work landed out of numeric order: Story 6.3 and Story 6.4 were implemented before Story 6.1, and Story 6.1 later reconciled submit-time snapshot ownership.
- The latest relevant commit `a2f7f02` added plan submission handling and PO review components, confirming the current direction is to extend existing DU/PO seams rather than add separate workflow surfaces.
- Inference: Story 6.2 should be a targeted hardening story around validation helpers and the existing `submitDepartmentUserPlan` mutation, not a new submission subsystem.

### Latest Tech Information

- Convex docs currently state mutations insert/update/remove data, check auth, perform business logic, and run transactionally. Use this to keep all submit-blocking decisions inside `submitDepartmentUserPlan`.
- Convex docs currently separate actions as the mechanism for third-party calls. Preserve Story 6.1's scheduled email action pattern.
- Convex React docs currently state `useMutation` returns an async function and that queries are reactive. The current `BlocklyEditor.tsx` confirm-submit flow can keep awaiting the mutation and relying on reactive refresh.
- Next.js App Router docs currently recommend `Link` for normal navigation and `useRouter` for programmatic changes inside Client Components. Keep existing `router.replace(...)` usage after successful submit/withdrawal.
- Blockly docs continue to expose read-only workspace mode. Validation must not compromise the view-only surfaces used by submitted plans and PO review.

### Project Context Reference

- Apply the project context rules:
  - strict TypeScript
  - path-alias imports in app/client code
  - Convex-first tenant and role checks
  - no client-trusted tenant IDs
  - JSON Blockly persistence
  - append-only audit expectations
  - `sonner` for transient feedback
  - shadcn/ui plus Tailwind styling

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 6 Source](../epic-06-plan-submission-review.md)
- [Previous Story 6.1](./6-1-plan-submission-flow.md)
- [Downstream Story 6.3](./6-3-po-submission-queue.md)
- [Downstream Story 6.4](./6-4-plan-review-interface.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [Current Plan Submission Helper](../../../../../webapp/lib/blockly/plan-submission.ts)
- [Current Workspace Validation Helper](../../../../../webapp/lib/blockly/workspace-validation.ts)
- [Current Workspace Summary Helpers](../../../../../webapp/lib/blockly/du-workspace-calculations.ts)
- [Current Blockly Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Current Plans Functions](../../../../../webapp/convex/functions/plans.ts)
- [Current Catalog Request Functions](../../../../../webapp/convex/functions/catalogRequests.ts)
- [Current Deadline Functions](../../../../../webapp/convex/functions/deadlines.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Current Submission Tests](../../../../../webapp/tests/department-user-plan-submission.test.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Convex Mutations](https://docs.convex.dev/functions/mutation-functions)
- [Convex Actions](https://docs.convex.dev/functions/actions)
- [Convex React](https://docs.convex.dev/client/react/)
- [Next.js App Router useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router)
- [Blockly Read-Only Workspace API](https://developers.google.com/blockly/reference/js/blockly.workspace_class.setisreadonly_1_method)

## Dev Agent Record

### Agent Model Used

gpt-5.1-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story sources:
  - `_bmad-output/implementation-artifacts/epics/epic6/epic-06-plan-submission-review.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-1-plan-submission-flow.md`
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
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/catalogRequests.ts`
  - `webapp/convex/functions/deadlines.ts`
  - `webapp/lib/blockly/plan-submission.ts`
  - `webapp/lib/blockly/workspace-validation.ts`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/plans/submission.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/tests/department-user-plan-submission.test.ts`
  - `webapp/tests/run-tests.ts`
- Git context:
  - `git log -5 --oneline`
- Tech verification:
  - `https://docs.convex.dev/functions/mutation-functions`
  - `https://docs.convex.dev/functions/actions`
  - `https://docs.convex.dev/client/react/`
  - `https://nextjs.org/docs/app/api-reference/functions/use-router`
  - `https://developers.google.com/blockly/reference/js/blockly.workspace_class.setisreadonly_1_method`

### Completion Notes List

- 2026-04-27: Created the implementation-ready story artifact for `6-2-pre-submission-validation`.
- 2026-04-27: Anchored the story to the existing Story 6.1 submission engine rather than defining a parallel submission path.
- 2026-04-27: Identified the main implementation gaps as zero-total item blocking, pending request blocking, deadline blocking, itemized fix-target UX, and backend no-side-effect guarantees.
- 2026-04-27: Updated sprint tracking so `6-2-pre-submission-validation` is ready for development.
- 2026-04-27: Implemented zero-quantity blocking in the shared Blockly workspace validator with item/category metadata and fix targets.
- 2026-04-27: Extended the shared plan-submission helper to return de-duplicated itemized issues, validation summary state, supplemental blockers, and concise submit-state copy.
- 2026-04-27: Added canonical pending-request and deadline validation helpers, then enforced them in `submitDepartmentUserPlan` before any submission side effects.
- 2026-04-27: Updated the DU submit review UI to show itemized validation issues and fix actions for workspace blocks, budget summary, and pending requests.
- 2026-04-27: Fixed PO review mutation return literal types so the production build passes while verifying Story 6.2.
- 2026-04-27: Verified with `npm test` and `npm run build` from `webapp`.
- 2026-04-28: Addressed senior review findings by preserving submitted-plan retry replay before draft-only blockers, correcting linked pending-request counts, and adding category/deadline fix-target handling.
- 2026-04-28: Re-verified with `npm test` and `npm run build` from `webapp`.

### File List

- `_bmad-output/implementation-artifacts/epics/epic6/stories/6-2-pre-submission-validation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/functions/plans.ts`
- `webapp/convex/functions/procurementOfficerPlanReview.ts`
- `webapp/lib/blockly/plan-submission.ts`
- `webapp/lib/blockly/workspace-validation.ts`
- `webapp/lib/plans/pre-submission-validation.ts`
- `webapp/src/components/blockly/BlocklyEditor.tsx`
- `webapp/tests/blockly-workspace-validation.test.ts`
- `webapp/tests/department-user-blockly-workspace-ui.test.tsx`
- `webapp/tests/department-user-plan-submission.test.ts`

### Change Log

- 2026-04-27: Story 6.2 implementation completed and moved to review; pre-submission validation now blocks zero-quantity items, pending catalog requests, deadline-window violations, budget issues, empty plans, and malformed validation states through the existing submit flow.
- 2026-04-27: Regression coverage added for zero-quantity issue shaping, pending-request blocker summaries, shared-vs-department deadline precedence, and exact close-time blocking.
- 2026-04-28: Review fixes completed for submitted retry replay ordering, pending linked-category handoff count de-duplication, and submit-review fix-target coverage.

## Story Completion Status

- Story ID: `6.2`
- Story Key: `6-2-pre-submission-validation`
- Output File: `_bmad-output/implementation-artifacts/epics/epic6/stories/6-2-pre-submission-validation.md`
- Final Status: `done`
- Completion Note: `Implemented, reviewed, fixed, and verified pre-submission validation hardening for Story 6.2`
