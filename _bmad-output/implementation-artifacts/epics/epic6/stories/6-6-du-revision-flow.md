# Story 6.6: DU Revision Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want to see Procurement feedback, correct my plan, and resubmit it,
so that I can address review issues without rebuilding the plan from scratch.

## Acceptance Criteria

1. [Given] a Department User opens a rejected or revision-requested current fiscal-year plan from `/du` or `/du/plans/:planId` [When] the active DU-visible review decision exists in `planReviewDecisions` [Then] the DU workspace and dashboard surfaces show the canonical decision type, decision timestamp, DU-visible comment, submission reference, and revision deadline when present in a prominent read-only summary that does not expose PO-internal `planReviewComments` (FR57, FR57a, FR57d).
2. [Given] the underlying review-decision state is inconsistent for a DU plan [When] the query finds zero active DU-visible decisions for a rejected/revision-requested plan that still depends on one, or finds more than one active decision [Then] the DU-facing read path fails closed with a truthful recovery message, suppresses ambiguous feedback rendering, and emits an auditable signal instead of guessing which decision is authoritative.
3. [Given] a rejected or revision-requested plan contains `flaggedTargets` on the active `planReviewDecisions` record [When] the DU opens the editor in edit mode [Then] the system highlights the corresponding categories/items in the Blockly-adjacent summary or issue panel, provides a deterministic way to jump/focus the target, and degrades gracefully when a previously flagged catalog entity is archived or missing instead of crashing or silently dropping the warning (FR57b).
4. [Given] a DU needs to understand what changed across review cycles [When] they view status/history details [Then] the product shows truthful submission history built from `planSubmissionSnapshots`, canonical plan timestamps, and DU-visible review decisions, including submitted, withdrawn, under-review, approved/rejected, and resubmitted events where available, and allows inspection of previous submission metadata without inventing fake history or leaking private PO collaboration notes (FR57c).
5. [Given] legacy or partial submission-history records are encountered [When] a snapshot lacks full workspace or reference payloads [Then] the UI degrades to metadata-only history cards/rows and clearly marks unavailable detail instead of crashing or hiding the event entirely.
6. [Given] a rejected or revision-requested plan is editable for the current DU session [When] the DU updates the Blockly draft and clicks submit again [Then] the backend accepts canonical resubmission from the revision state, creates a new immutable submission snapshot and a new submission reference/sequence, supersedes the previously active DU-visible review decision, clears stale rejection-only fields that should no longer represent the latest state, and returns the plan to `submitted` without creating a duplicate draft or second plan for the same fiscal year (FR57d).
7. [Given] a DU began editing against one active review decision [When] a newer PO decision is created before DU resubmission commits [Then] the mutation detects the stale decision context, fails closed, and requires the DU to refresh before submitting so older edits cannot silently supersede newer PO feedback.
8. [Given] a rejected or revision-requested plan still has unresolved flagged targets [When] the DU attempts resubmission [Then] the system either blocks submission until those targets are addressed or requires an explicit reviewed override path defined in the story, but it must not silently accept a resubmission that ignores the flagged targets.
9. [Given] a rejected or revision-requested plan is no longer editable because the session is read-only, the effective revision deadline passed, or tenant/department ownership does not match [When] a DU attempts to edit or resubmit [Then] the UI and mutation fail closed with truthful guidance, no partial writes occur, and blocked attempts are audited where the plan target can be identified (NFR-S1, NFR-S7).
10. [Given] the shared submission deadline is close or already passed [When] Procurement rejects or requests revision within 24 hours of the tenant submission deadline [Then] the DU-facing revision window is automatically extended to `decision time + 48 hours`, the effective deadline is stored or derived canonically for later reads, and DU surfaces explain the extension clearly instead of showing an impossible already-expired deadline (FR57e).
11. [Given] the PO explicitly set a revision deadline in Story 6.5 or the automatic late-rejection extension applies [When] the DU views the dashboard or workspace [Then] the effective revision deadline is shown consistently in status cards, banners, and resubmission validation, and submission is blocked once that effective deadline has expired unless a newer PO decision or deadline update supersedes it (FR55c, FR57d, FR57e).
12. [Given] both a PO-set deadline and the automatic FR57e extension are present [When] the effective revision deadline is calculated [Then] the system uses one canonical precedence rule, recommended as the later of the two deadlines, and applies it consistently across PO queries, DU queries, and mutation-time validation.
13. [Given] a plan was approved but the DU later discovers an error [When] they request an unlock/reopen from the DU dashboard [Then] the implementation reuses the existing approved-plan redraft pathway (`planRedraftRequests` plus PO approve/deny redraft mutations) as the canonical fulfillment of FR57f unless a deliberate migration is made, and the UI copy makes it clear this is a request for PO approval rather than an immediate self-service unlock (FR57f).
14. [Given] the dashboard already exposes `Revision Requested` as a DU-facing label while canonical `plans.status` remains `rejected` plus `planReviewDecisions.decisionType` [When] Story 6.6 is implemented [Then] the system preserves that compact workflow model, does not introduce a second conflicting revision-state machine, and keeps dashboard, workspace, PO review, and submission mutations in sync on the same plan record.
15. [Given] Story 6.1, 6.4, 6.5, and 6.7 already own submission references, review-start metadata, review decisions, and dashboard status tracking [When] Story 6.6 adds the DU correction loop [Then] it reuses those contracts instead of recreating a new revision table, new unlock table, or parallel status history subsystem, and it does not regress withdrawal-before-review, approved-plan redraft requests, or PO decision visibility.
16. [Given] implementation completes [When] deterministic automated coverage runs [Then] tests prove rejected/revision-requested plans surface DU-visible feedback, flagged targets resolve correctly, resubmission works from the canonical revision state, deadline extension logic is enforced, approved-plan unlock requests still use the redraft flow, and no regression is introduced to Story 6.1 submission/withdrawal, Story 6.5 review decisions, or Story 6.7 status tracking.

## Tasks / Subtasks

- [ ] Task 1: Expose canonical DU revision context to dashboard and workspace queries (AC: 1, 2, 4, 5, 11, 12, 14, 15)
  - [ ] Extend `webapp/convex/functions/plans.ts` `getDepartmentUserPlanWorkspace` to return the latest active DU-visible review decision, effective revision deadline, flagged targets, and submission-history metadata needed by the editor surface.
  - [ ] Reuse `planReviewDecisions` and `planSubmissionSnapshots`; do not add a second DU revision store unless existing tables are proven insufficient.
  - [ ] Keep all reads tenant-safe by deriving department scope from the authenticated DU session and normalizing ids with `ctx.db.normalizeId(...)`.
  - [ ] Shape the returned data so the editor can distinguish `rejected` versus DU-facing `Revision Requested` without changing the canonical `plans.status` enum.
  - [ ] Add a fail-closed query path for inconsistent decision state, including zero-or-many active DU-visible decisions where exactly one authoritative decision is required.

- [ ] Task 2: Surface rejection/revision feedback and history in the DU UI (AC: 1, 3, 4, 5, 11)
  - [ ] Add a prominent revision-feedback banner or panel in `webapp/src/components/blockly/BlocklyEditor.tsx` for rejected/revision-requested plans in both `edit` and `view` modes.
  - [ ] Show decision type, comment, decision timestamp, revision deadline, and latest submission reference using the same tenant timezone/date helpers already used elsewhere.
  - [ ] Add a DU-visible submission/review history surface that reuses canonical timeline/snapshot data and avoids displaying PO-internal `planReviewComments`.
  - [ ] Keep dashboard-level rejection/revision summaries in `DepartmentUserDashboard.tsx` aligned with the richer workspace view instead of duplicating conflicting copy.
  - [ ] Provide a metadata-only fallback for legacy snapshots that cannot render full historical detail.

- [ ] Task 3: Implement flagged-target guidance for DU correction (AC: 3, 8, 16)
  - [ ] Map `planReviewDecisions.flaggedTargets` into stable DU-facing descriptors that match current Blockly/category/item identities.
  - [ ] Highlight flagged categories/items in the summary/issue surfaces and provide a direct "jump to fix" interaction where practical.
  - [ ] If a flagged target no longer exists because catalog state changed, show a degraded warning such as "Previously flagged item is unavailable" rather than dropping the signal.
  - [ ] Reuse existing validation/fix-target patterns from `webapp/lib/blockly/plan-submission.ts` where possible instead of inventing a second fix-navigation model.
  - [ ] Define whether unresolved flagged targets are a hard submit blocker or an explicit override flow, and enforce that choice consistently in UI and mutation logic.

- [ ] Task 4: Make revision-state resubmission canonical and deadline-aware (AC: 6, 7, 8, 9, 10, 11, 14, 15)
  - [ ] Review `submitDepartmentUserPlan` in `webapp/convex/functions/plans.ts`; it currently rejects any non-`draft` submission even though the DU workspace already treats rejected plans as editable.
  - [ ] Choose one canonical model and implement it consistently:
  - [ ] Preferred: keep the plan editable in canonical `rejected` state and update submission mutations/helpers to permit resubmission from that state when DU access is editable and the effective revision deadline is still valid.
  - [ ] Alternative only if clearly safer: transition a rejected plan back to a draft-like editable state while preserving the active decision context; do not create a second plan.
  - [ ] Ensure resubmission creates a new submission snapshot/reference, clears stale submission-blocking rejection state, and supersedes the prior active decision record instead of mutating history away.
  - [ ] Enforce effective revision deadlines in both query/UI affordances and mutation-time validation.
  - [ ] Require the submit mutation to validate the expected active decision identity/version so stale DU edits cannot commit after a newer PO decision is issued.

- [ ] Task 5: Implement automatic late-rejection extension and approved-plan unlock alignment (AC: 10, 11, 12, 13)
  - [ ] Add a pure helper for effective revision deadlines that combines any PO-set deadline with the FR57e automatic extension rule.
  - [ ] Decide the smallest forward-compatible persistence model:
  - [ ] Prefer storing the effective deadline on the active decision when the PO decision is created or updated.
  - [ ] If that is too invasive, derive it consistently in a shared helper used by PO decision queries, DU dashboard/workspace queries, and resubmission mutations.
  - [ ] Confirm FR57f uses the already-implemented `planRedraftRequests` flow and update DU copy where needed so "unlock request" language matches the existing PO approval workflow.
  - [ ] Do not create a brand-new `planUnlockRequests` table unless the product intentionally replaces the redraft model and all current approved-plan flows are migrated.
  - [ ] Define and test one canonical deadline-precedence rule when both a PO-set deadline and the automatic FR57e extension are present, recommended as the later deadline winning.

- [ ] Task 6: Add deterministic regression coverage and runner updates (AC: 1-16)
  - [ ] Extend DU helper tests for rejected/revision-requested feedback, effective revision deadlines, flagged-target fallback behavior, and submission history shaping.
  - [ ] Add/extend tests around `submitDepartmentUserPlan` to prove canonical resubmission from the chosen revision state and blocked behavior after deadline expiry or read-only access.
  - [ ] Add UI coverage for DU revision banners, flagged-target guidance, history/timeline rendering, and approved-plan unlock/redraft request copy.
  - [ ] Preserve or extend existing regression coverage for withdrawal before review, PO review decisions, and DU dashboard status labels.
  - [ ] Register any new focused test file in `webapp/tests/run-tests.ts`.
  - [ ] Add deterministic coverage for zero-or-many active decision failures, stale-decision submit blocking, legacy history fallback rendering, and flagged-target unresolved submission rules.

## Dev Notes

### Story Foundation

- Epic 6 defines Story 6.6 as the DU correction loop after Story 6.5's PO decision outcomes.
- This story owns:
  - DU-visible feedback in the workspace after rejection or revision request
  - flagged target guidance for corrections
  - revision-state resubmission
  - effective revision deadline enforcement and FR57e extension handling
  - alignment of FR57f with the existing approved-plan redraft/unlock request flow
- This story does not own:
  - the original submission flow from Story 6.1
  - PO-side queue/review rendering from Stories 6.3 and 6.4
  - PO decision creation from Story 6.5 except where deadline/decision helpers must be extended for consistency
  - the general DU status/timeline layer from Story 6.7 except where richer revision details need to feed it

### Previous Story Intelligence

- Story 6.5 already introduced the canonical PO decision layer:
  - `planReviewDecisions` stores decision type, comment, flagged targets, revision deadline, lifecycle status, and notification metadata
  - `approveProcurementOfficerPlanReview`, reject/revision-request mutations, and undo approval exist in `webapp/convex/functions/procurementOfficerPlanReview.ts`
  - DU-facing status tracking already uses `latestDecision.decisionType` to show `Revision Requested` without changing `plans.status`
- Story 6.7 already enriched the DU dashboard with:
  - canonical status selection via `selectCanonicalPlans(...)`
  - timeline/history helpers in `webapp/lib/department-user/status-tracking.ts`
  - rejection/revision-request summaries through the dashboard snapshot
- Story 6.6 should reuse those contracts directly. Do not create parallel decision/status models.

### Current Implementation State Discovered In Code

- The live schema already contains the main storage needed for this story:
  - `plans` retains compact status values: `draft | submitted | rejected | approved`
  - `planReviewDecisions` persists DU-visible decision comments, `flaggedTargets`, `revisionDeadlineAt`, and lifecycle state
  - `planSubmissionSnapshots` persists immutable submission history
  - `planRedraftRequests` already implements the approved-plan reopen request flow
- `webapp/lib/department-user/dashboard.ts` and `webapp/lib/blockly/du-plan-routes.ts` already treat rejected plans as DU-editable.
- `webapp/convex/functions/plans.ts` `getDepartmentUserPlanWorkspace` currently returns basic plan metadata only:
  - submission reference/timestamp
  - `reviewStartedAt`
  - status and workspace state
  - no latest review decision
  - no flagged targets
  - no revision deadline
  - no submission history payload
- `submitDepartmentUserPlan` currently blocks any non-`draft` submission with "Only draft plans can be submitted to Procurement." This conflicts with the DU UI already allowing rejected plans back into edit mode.
- `DepartmentUserDashboard` and status-tracking helpers already understand `revision_requested` as a display state, but the Blockly editor does not yet surface the actual decision context that explains what the DU must fix.
- No automatic FR57e revision-window extension logic was found in current DU or PO decision code.
- No DU-side flagged-target highlighting or "jump to fix" path was found in current editor code.
- No explicit stale-decision guard was found to stop a DU from submitting edits after a newer PO decision arrives.
- No explicit fail-closed behavior was found for inconsistent `planReviewDecisions` state such as multiple active decisions.
- FR57f's "unlock request" is already materially implemented as the approved-plan redraft request flow:
  - DU mutation: `requestDepartmentUserPlanRedraft`
  - PO mutations: approve/deny redraft request
  - this is a better base to reuse than inventing `planUnlockRequests`

### Technical Requirements

- Preserve the compact canonical workflow model already in code:
  - `plans.status === "rejected"` plus `latestDecision.decisionType === "revision_requested"` yields DU-facing "Revision Requested"
  - do not add `revision_requested` or `under_review` to `plans.status` unless a deliberate repo-wide migration is made
- Keep DU reads and writes tenant-safe:
  - derive scope from `requireTenantRole(ctx, ["department_user"])`
  - validate the department profile matches the authenticated tenant user
  - normalize ids and fail closed on malformed input
- Use `planReviewDecisions` as the DU-visible review source:
  - active decision comment is the canonical DU-visible PO feedback
  - `planReviewComments` remain PO-internal and must not leak to DU surfaces
  - `flaggedTargets` should be treated as stable descriptors, not client-only labels
- Resubmission must be snapshot-safe:
  - create a new submission snapshot/reference on each accepted resubmission
  - preserve historical rejected/revision-requested decisions through lifecycle supersession instead of destructive overwrite
  - clear only fields that should no longer describe the latest state after resubmission
- Effective revision deadline logic must be centralized:
  - it should consider any explicit PO deadline from Story 6.5
  - it should apply FR57e automatic extension when rejection/revision occurs within 24 hours of the shared submission deadline
  - it should define explicit precedence when both deadline sources are present, recommended as the later deadline winning
  - it must be shared by dashboard, workspace, and submit mutation validation
- Resubmission must be concurrency-safe:
  - submit paths should validate the expected active decision/version before commit
  - inconsistent zero-or-many active decisions should fail closed instead of selecting one implicitly
- Keep approved-plan reopen requests aligned with existing redraft code paths, terminology, and audit behavior unless the team intentionally migrates that feature wholesale.

### Architecture Compliance

- Follow live repo versions from `webapp/package.json`, not older planning summaries:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - Blockly `^12.5.1`
  - `date-fns` `^2.30.0`
  - `sonner` `^2.0.7`
  - `lucide-react` `^0.577.0`
- Keep plan workflow reads/writes in Convex functions. Do not introduce REST endpoints for DU revision handling.
- Reuse existing tenant-role enforcement in `webapp/convex/functions/_roleGuard.ts`.
- Use `ConvexError` for expected blocked transitions and append audit logs for allowed/blocked state changes where a canonical plan target exists.
- Keep the App Router page shell thin; most work should stay in existing Convex functions, DU helpers, and DU/Blockly components.
- Preserve the desktop-only DU workspace strategy already enforced in `DepartmentUserDashboard.tsx` and `DepartmentUserBlocklyWorkspace.tsx`.

### Library And Framework Requirements

- Convex React:
  - keep `useQuery(...)` as the live data source for dashboard/workspace updates
  - use `useMutation(...)` for resubmission/redraft actions
  - avoid client-only caches that can drift from the canonical revision state
- Next.js App Router:
  - `useSearchParams` remains a Client Component hook; if any new revision tabs/dialog state become query-param driven, keep that code in a Client Component and wrap static-rendered boundaries with `Suspense` where needed
- Blockly:
  - keep JSON workspace persistence
  - do not bypass existing Blockly editor/view mode architecture
  - flagged-target guidance should layer around the current editor and summary surfaces instead of mutating workspace internals in ad hoc ways
- UI:
  - use shadcn/ui primitives already present in the DU surfaces
  - use `sonner` for user feedback
  - keep status affordances truthful: do not claim resubmission is allowed when mutation-time deadline/access checks would reject it

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/lib/department-user/status-tracking.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/lib/blockly/plan-submission.ts`
  - `webapp/lib/blockly/du-plan-routes.ts`
  - `webapp/tests/run-tests.ts`
- Likely focused helper additions if cohesion improves:
  - `webapp/lib/plans/revision-deadline.ts`
  - `webapp/lib/department-user/revision-feedback.ts`
  - `webapp/tests/department-user-revision-flow.test.ts`
- Files to avoid unless clearly necessary:
  - `webapp/convex/schema.ts` for new tables; the baseline story should be able to reuse existing decision/snapshot/redraft tables
  - new API routes or NestJS endpoints

### Testing Requirements

- Add pure tests for:
  - effective revision deadline calculation, including FR57e late-rejection extension
  - deadline precedence when PO-set and automatic extension deadlines both exist
  - display-state shaping for rejected vs revision-requested plans
  - flagged-target normalization/fallback behavior when catalog entities disappear
  - submission-history shaping from `planSubmissionSnapshots` and active decisions
- Add Convex/backend tests for:
  - canonical resubmission from the chosen revision state
  - stale-decision submit blocking after a newer PO decision appears
  - blocked resubmission after deadline expiry
  - blocked resubmission for read-only or cross-department access
  - fail-closed behavior for zero active or multiple active decisions
  - decision supersession and new submission snapshot/reference creation
  - approved-plan unlock requests still using `planRedraftRequests`
- Add UI tests for:
  - DU revision banner/panel rendering
  - flagged target counts and copy
  - metadata-only fallback for partial legacy history rows
  - jump-to-fix affordances or fallback warnings
  - history/timeline rendering in revision contexts
  - approved-plan redraft/unlock request copy remaining available
- Preserve regression coverage for:
  - Story 6.1 submit/withdraw behavior
  - Story 6.5 review decision creation and active decision state
  - Story 6.7 dashboard status tracking and revision-request label behavior

### Git Intelligence Summary

- Recent Epic 6 work landed out of numeric order and already established the state contracts this story must extend:
  - `6b83f05` implemented review decision handling and DU-facing revision-request status labeling groundwork for Story 6.5
  - `f83b02e` added DU dashboard and status-tracking tests
  - `096d032` completed redraft functionality and pre-submission validation
  - `a2f7f02` added plan submission handling and PO review components
- Inference: Story 6.6 should be a reconciliation story that closes the gap between existing rejected-plan editability and missing canonical resubmission/revision feedback, not a greenfield workflow.

### Latest Tech Information

- Verified on 2026-04-29 from official docs:
  - Next.js `useSearchParams` is a Client Component hook that returns read-only URL search params; static rendering around it may require `Suspense`. Source: https://nextjs.org/docs/app/api-reference/functions/use-search-params
  - Convex React `useQuery` is reactive and returns `undefined` while loading, which matches the repo's live dashboard/workspace subscription pattern. Source: https://docs.convex.dev/client/react
  - Convex React `useMutation` returns a stable function for invoking mutations from React components. Source: https://docs.convex.dev/api/modules/react
  - Blockly continues to recommend JSON serialization for new projects, which matches the repo's persisted workspace design. Source: https://developers.google.com/blockly/guides/configure/web/serialization
  - Blockly still exposes read-only workspace behavior through the workspace API, which supports the existing DU submitted/approved/view-only flows. Source: https://developers.google.com/blockly/reference/js/blockly.workspace_class.setisreadonly_1_method

### Project Context Reference

- Apply `_bmad-output/project-context.md` rules:
  - strict TypeScript
  - Convex-first tenant and role enforcement
  - no client-trusted tenant IDs
  - shadcn/ui plus Tailwind styling
  - JSON Blockly persistence
  - no duplicate workflow/status calculators

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 6 Source](../epic-06-plan-submission-review.md)
- [Previous Story 6.5](./6-5-plan-approval-rejection.md)
- [Previous Story 6.7](./6-7-submission-status-tracking.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [Project Context](../../../../project-context.md)
- [DU Dashboard Query](../../../../../webapp/convex/functions/departmentUserDashboard.ts)
- [DU Plan Workspace Query](../../../../../webapp/convex/functions/plans.ts)
- [DU Dashboard Helpers](../../../../../webapp/lib/department-user/dashboard.ts)
- [DU Dashboard Snapshot](../../../../../webapp/lib/department-user/dashboard-snapshot.ts)
- [DU Status Tracking](../../../../../webapp/lib/department-user/status-tracking.ts)
- [DU Workspace Routes](../../../../../webapp/lib/blockly/du-plan-routes.ts)
- [DU Blockly Workspace Shell](../../../../../webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx)
- [Blockly Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Plan Redraft Functions](../../../../../webapp/convex/functions/planRedrafts.ts)
- [PO Review Functions](../../../../../webapp/convex/functions/procurementOfficerPlanReview.ts)
- [PO Decision Helpers](../../../../../webapp/lib/procurement-officer/review-decision.ts)
- [Current Convex Schema](../../../../../webapp/convex/schema.ts)
- [Webapp Package Versions](../../../../../webapp/package.json)
- [Next.js useSearchParams Docs](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Convex React API Docs](https://docs.convex.dev/api/modules/react)
- [Blockly Serialization Docs](https://developers.google.com/blockly/guides/configure/web/serialization)
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
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-5-plan-approval-rejection.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-7-submission-status-tracking.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/convex/functions/procurementOfficerPlanReview.ts`
  - `webapp/convex/functions/planRedrafts.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/lib/department-user/status-tracking.ts`
  - `webapp/lib/blockly/du-plan-routes.ts`
  - `webapp/lib/procurement-officer/review-decision.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
- Git context:
  - `git log -5 --pretty=format:"%h %s"`
- Tech verification:
  - `https://nextjs.org/docs/app/api-reference/functions/use-search-params`
  - `https://docs.convex.dev/client/react`
  - `https://docs.convex.dev/api/modules/react`
  - `https://developers.google.com/blockly/guides/configure/web/serialization`
  - `https://developers.google.com/blockly/reference/js/blockly.workspace_class.setisreadonly_1_method`

### Completion Notes List

- 2026-04-29: Created the implementation-ready story artifact for `6-6-du-revision-flow`.
- 2026-04-29: Anchored Story 6.6 to the existing `planReviewDecisions`, `planSubmissionSnapshots`, and `planRedraftRequests` contracts instead of inventing parallel workflow state.
- 2026-04-29: Identified the key live-code gap that rejected plans are DU-editable in the UI but `submitDepartmentUserPlan` still rejects all non-draft submissions, making canonical resubmission the primary implementation risk.
- 2026-04-29: Scoped FR57f to the existing approved-plan redraft request flow so the developer can extend the real code path rather than building a duplicate unlock subsystem.

### File List

- `_bmad-output/implementation-artifacts/epics/epic6/stories/6-6-du-revision-flow.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-29: Story 6.6 created and moved to ready-for-dev with implementation guidance for DU-visible revision feedback, flagged-target correction, canonical resubmission, automatic revision deadline extension, and approved-plan unlock/redraft alignment.
- 2026-04-29: Implementation completed and story status advanced to `review`.
- 2026-04-29: Review follow-ups resolved and story status advanced to `done`.

### Story Completion Status

- Story ID: `6.6`
- Story Key: `6-6-du-revision-flow`
- Output File: `_bmad-output/implementation-artifacts/epics/epic6/stories/6-6-du-revision-flow.md`
- Status: `done`
- Completion Note: `Implementation and review follow-ups completed; story marked done.`
