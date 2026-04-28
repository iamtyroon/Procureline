# Story 6.5: Plan Approval & Rejection

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to approve or reject submitted plans with detailed feedback,
so that departments know their status and how to fix issues.

## Acceptance Criteria

1. [Given] a Procurement Officer is reviewing a submitted plan from `/po/review?planId=...` or the existing review summary modal [When] they approve the plan [Then] the backend tenant-safely transitions the canonical `plans` record from `submitted` to `approved`, records `approvedAt`, clears any rejection/redraft residue that should not survive approval, and makes the plan available to future consolidation workflows (FR54).
2. [Given] the target plan is missing, malformed, cross-tenant, `draft`, already `approved`, already `rejected`, or otherwise outside the submitted-review state [When] a PO attempts approval or rejection [Then] the mutation fails closed with a truthful error and does not partially update plan, department, review comment, notification, or audit state (NFR-S1, NFR-S7).
3. [Given] a plan has been approved and has not yet been consolidated [When] the approval is still within the 24-hour undo window [Then] the PO can undo approval and the plan returns to `submitted` with the original review metadata preserved for continued review (FR54a).
4. [Given] an approved plan has been consolidated, the 24-hour undo window has expired, or the plan is no longer in an approved state [When] the PO attempts undo approval [Then] the system blocks the undo with a clear reason and leaves the approved plan untouched.
5. [Given] a submitted plan needs changes [When] the PO chooses reject/send back [Then] the system requires non-blank revision comments, stores the canonical DU-visible rejection comment, records `rejectedAt`, clears incompatible approval fields, returns the plan to a DU-editable rejected/revision state, and saves a PO-internal review comment for the same decision (FR55).
6. [Given] the PO selected flag candidates in Story 6.4's review side panel [When] the PO rejects or requests revision [Then] specific category/item revision targets are persisted in a canonical tenant-scoped decision store and later DU-facing flows can highlight those exact targets without relying on client-only selection state (FR55a, forward dependency for Story 6.6).
7. [Given] the PO wants minor changes without treating the plan as fully rejected [When] they choose "Request revision" [Then] the system supports a distinct revision-request outcome with required comments, optional flagged targets, and a clear status label such as `Revision Requested` in PO/DU-facing surfaces without fabricating a full approval or consolidation-ready state (FR55b).
8. [Given] the PO rejects or requests revision [When] they set a revision deadline [Then] the deadline is validated against the tenant timezone, cannot be in the past, is stored on the canonical revision decision, and is communicated to the DU-facing status payload (FR55c).
9. [Given] a plan is approved, rejected, or revision-requested [When] the decision succeeds [Then] the system creates or queues both in-app and email notification records for the Department User containing the decision, PO comments, flagged targets when present, revision deadline when present, and next steps (FR56).
10. [Given] notification delivery is not fully wired for production email in this repo yet [When] a decision is made [Then] the decision still persists an idempotent notification intent or dev-email record so later notification workers can send exactly once, and UI must not claim email delivery unless a queued/sent record exists.
11. [Given] any approval, rejection, revision request, or undo-approval decision changes workflow state [When] the mutation commits [Then] the system appends audit logs with actor, tenant, plan, department, previous status, next status, comment/deadline metadata, and decision outcome; blocked transition attempts are audited where an existing plan target can be identified (FR85-FR89).
12. [Given] the review summary modal already contains partial approval and send-back behavior [When] Story 6.5 is implemented [Then] that existing surface is either completed and tested or replaced with a cohesive decision panel inside `ProcurementOfficerPlanReviewWorkspace`, but the implementation must not leave two divergent decision flows with different validation, mutation contracts, or labels.
13. [Given] the current live code has `approveProcurementOfficerPlanReview` and `rejectProcurementOfficerPlanReview` mutations [When] implementing this story [Then] those mutations must be reviewed against all acceptance criteria and either hardened in place or refactored into a shared decision module rather than duplicated elsewhere.
14. [Given] the story touches protected review state, plan workflow status, DU notifications, and future consolidation eligibility [When] implementation completes [Then] deterministic automated coverage exists for tenant-safe transitions, rejected comments, revision targets, revision deadlines, undo approval window rules, notification intent creation, audit logging, and UI action-state regressions.

## Tasks / Subtasks

- [ ] Task 1: Define the canonical review-decision data contract (AC: 1, 3, 5, 6, 7, 8, 9, 11, 13)
  - [ ] Decide whether `plans.status` remains the compact workflow enum (`draft`, `submitted`, `rejected`, `approved`) with separate revision-decision records, or whether a new explicit status value is needed; avoid broad status migrations unless required.
  - [ ] Add a tenant-scoped decision/revision store if needed, recommended as `planReviewDecisions` or `planRevisionRequests`, with plan, department, fiscal year, decision type, comment, flagged targets, deadline, actor, timestamps, notification intent fields, and audit-friendly metadata.
  - [ ] Persist flagged targets as stable descriptors from Story 6.4 selection IDs, not as display text only.
  - [ ] Preserve existing `planReviewComments` for internal notes, but do not treat internal comments as the sole DU-visible rejection/revision source.
  - [ ] Keep all Convex schema fields indexed for the reads Story 6.6 and 6.7 will need: by `planId`, by `tenantId/departmentId/fiscalYear`, and by current unresolved decision status if applicable.

- [ ] Task 2: Harden approve and reject mutations into a complete transition layer (AC: 1, 2, 5, 7, 8, 11, 13)
  - [ ] Review `webapp/convex/functions/procurementOfficerPlanReview.ts` existing `approveProcurementOfficerPlanReview` and `rejectProcurementOfficerPlanReview` mutations for all blocked-state and tenant-safety cases.
  - [ ] Extract pure transition helpers into `webapp/lib/procurement-officer/review-decision.ts` or extend `review.ts` if the module remains cohesive.
  - [ ] Ensure approval only accepts `submitted` plans and clears incompatible rejection/redraft fields without deleting immutable snapshots or review-start metadata.
  - [ ] Ensure rejection requires a normalized non-blank DU-visible comment and does not silently overload "rejection" for minor revision if a separate revision-request path is implemented.
  - [ ] Validate optional budget adjustment behavior currently present in `rejectProcurementOfficerPlanReview`; keep it only if product intent is explicit, tenant-safe, audited, and reflected clearly in UI copy.
  - [ ] Add mutation return payloads that give the UI truthful next state, timestamp, notification status, and any blocked reason.

- [ ] Task 3: Implement undo approval with consolidation-safe guards (AC: 3, 4, 11, 14)
  - [ ] Add a pure helper that computes approval undo eligibility from `approvedAt`, current time, plan status, and consolidation/finalization markers.
  - [ ] If consolidation markers do not exist yet, add the smallest forward-compatible schema field or helper check that defaults to "not consolidated" without pretending consolidation has been implemented.
  - [ ] Add a Convex mutation such as `undoProcurementOfficerPlanApproval` guarded by `requireTenantRole(ctx, ["procurement_officer"])`.
  - [ ] Preserve `reviewStartedAt`, `reviewStartedBy*`, immutable snapshots, internal comments, and submission identity when returning to `submitted`.
  - [ ] Append allowed and blocked audit entries for undo attempts where the plan exists in the current tenant.

- [ ] Task 4: Complete DU-visible revision decision and flagged-target support (AC: 5, 6, 7, 8, 9)
  - [ ] Build or extend a decision modal/panel that accepts decision type, required comment, optional revision deadline, and selected flagged targets from Story 6.4.
  - [ ] Revalidate selected flagged targets against the current plan summary before mutation; stale targets must be blocked or removed with an explicit notice.
  - [ ] Store revision deadline using tenant timezone-aware validation helpers from `webapp/lib/procurement-officer/deadlines.ts`.
  - [ ] Make rejected/revision-requested plans expose enough query data for DU dashboard and Story 6.6: comment, flagged targets, deadline, reviewer identity if available, and decision timestamp.
  - [ ] Keep the plan content itself unchanged during decision creation; Story 6.6 owns DU correction and resubmission.

- [ ] Task 5: Wire notification intent creation without overclaiming email delivery (AC: 9, 10, 11)
  - [ ] Reuse existing email/action conventions in `webapp/convex/actions/email.ts`, `devEmailMessages`, and catalog request notification patterns where practical.
  - [ ] Create idempotency keys per plan decision so repeated retries cannot queue duplicate DU notifications.
  - [ ] Persist notification status on the decision record or associated notification table.
  - [ ] Include decision, comment, flagged targets, revision deadline, fiscal year, department, and next-step link in the notification payload.
  - [ ] UI copy should distinguish "notification queued" from "email sent" unless delivery is actually confirmed.

- [ ] Task 6: Consolidate the PO decision UI into one coherent path (AC: 1, 5, 7, 8, 9, 12)
  - [ ] Inspect `webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewSummaryModal.tsx`; it already calls approval/rejection mutations and redraft decisions.
  - [ ] Decide whether decision actions belong in the full `/po/review` workspace, the summary modal, or both through a shared component; do not duplicate business rules.
  - [ ] Rename user-facing copy if needed: "Approve & Send to Editor" is misleading if the actual outcome is consolidation eligibility or approved status.
  - [ ] Disable decision actions while mutations are pending and after the plan leaves `submitted`.
  - [ ] Surface revision-target count, comment requirement, deadline validation errors, and notification outcome in the UI.
  - [ ] Preserve Story 6.3 queue return params and Story 6.4 read-only workspace behavior.

- [ ] Task 7: Add deterministic tests and update the runner (AC: 2, 3, 4, 5, 6, 8, 9, 11, 14)
  - [ ] Add pure tests for transition eligibility, undo approval window calculation, deadline validation, flagged-target normalization, decision idempotency keys, and notification payload shaping.
  - [ ] Extend `webapp/tests/procurement-officer-review.test.ts` or add `webapp/tests/procurement-officer-review-decisions.test.ts`.
  - [ ] Add tests that approval/rejection only accept `submitted` plans and reject malformed/cross-tenant/draft/closed targets.
  - [ ] Add tests that rejection/revision comments are required and trimmed before persistence.
  - [ ] Add tests that approval undo is blocked after 24 hours or after consolidation markers indicate the plan has been used downstream.
  - [ ] Add tests that decision UI labels and disabled states do not expose conflicting approval/rejection flows.
  - [ ] Register any new test suite in `webapp/tests/run-tests.ts`.

## Dev Notes

### Story Foundation

- Epic 6 defines Story 6.5 as the decisive review outcome layer after Story 6.4's review workspace.
- Story 6.5 owns:
  - approval transition and consolidation eligibility
  - rejection/send-back transition
  - minor revision-request outcome if distinct from full rejection
  - approval undo window
  - DU-visible comments, flagged targets, revision deadline, notifications, and audit entries
- Story 6.5 must not reimplement:
  - the submission queue from Story 6.3
  - read-only review rendering, comparison tabs, internal comments, or flag-candidate selection from Story 6.4
  - DU correction/resubmission UX from Story 6.6
  - full status timeline visualization from Story 6.7

### Previous Story Intelligence

- Story 6.4 implemented the canonical `/po/review` workspace and added:
  - `reviewStartedAt`, `reviewStartedByTenantUserId`, and `reviewStartedByUserId` on `plans`
  - `planSubmissionSnapshots` for immutable submission baselines
  - `planReviewComments` for PO-internal notes
  - read-only `BlocklyWorkspace` usage through `editorMode="view"`
  - summary fallback when archived catalog data prevents safe Blockly hydration
  - selectable category/item flag candidates in the review side panel
  - `webapp/lib/procurement-officer/review.ts` pure helpers for baseline comparison, review target resolution, comment normalization, budget adjustment normalization, and selection revalidation
- Use these contracts directly. Do not create a second review target resolver or client-only decision model.

### Current Implementation State Discovered In Code

- `webapp/convex/functions/procurementOfficerPlanReview.ts` already contains partial Story 6.5-like mutations:
  - `approveProcurementOfficerPlanReview`
  - `rejectProcurementOfficerPlanReview`
  - `addProcurementOfficerPlanReviewComment`
  - `startProcurementOfficerPlanReview`
- The current approval mutation changes status to `approved`, sets `approvedAt`/`lastApprovedAt`, clears rejected and redraft fields, and optionally stores an internal review comment.
- The current rejection mutation changes status to `rejected`, sets `rejectedAt` and `rejectionComment`, inserts an internal review comment, and can optionally update department budget allocation with an audit entry.
- These existing mutations are useful starting points, but they do not yet satisfy the full story:
  - no approval undo mutation was found
  - no canonical flagged-target/revision-decision table was found
  - no revision deadline model was found
  - no DU notification intent creation was found for plan decisions
  - approval/rejection audit coverage appears incomplete compared with redraft and budget audit patterns
  - summary modal copy currently says "Approve & Send to Editor", which does not match the PRD wording of approval/consolidation eligibility
- `webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewSummaryModal.tsx` already exposes approve/send-back actions and redraft decisions, while the full `ProcurementOfficerPlanReviewWorkspace.tsx` still presents selected flag candidates as "for later decision workflows." Story 6.5 must resolve that split.

### Schema Reality And Gaps

- Current `plans` fields relevant to this story include:
  - `status`: `draft | submitted | rejected | approved`
  - `rejectionComment`
  - `submittedAt`, `reviewStartedAt`, `approvedAt`, `rejectedAt`, `lastApprovedAt`
  - `lastApprovedSnapshotId`
  - `departmentCodeSnapshot`, `departmentNameSnapshot`
  - `submissionReference`, `submissionSequence`
  - redraft fields such as `redraftApprovedAt`, `redraftCycle`, `redraftReason`, `redraftRequestedAt`
- Existing related tables:
  - `planSubmissionSnapshots`
  - `planReviewComments`
  - `planRedraftRequests`
  - `auditLogs`
  - `devEmailMessages`
- Missing or incomplete for Story 6.5:
  - canonical DU-visible decision/revision request records
  - persisted flagged revision targets
  - revision deadline
  - approval undo eligibility marker or consolidation guard
  - notification intent/status for plan decisions
  - complete audit entries for plan approval/rejection/revision/undo transitions

### Architecture Compliance

- Follow the live `webapp/package.json` versions, not older planning text:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - Blockly `^12.5.1`
  - `date-fns` `^2.30.0`
  - `sonner` `^2.0.7`
  - `lucide-react` `^0.577.0`
- Keep all review-decision reads and writes in Convex. Do not add REST endpoints for plan decisions.
- Guard every mutation with `requireTenantRole(ctx, ["procurement_officer"])` and derive tenant scope from auth identity.
- Normalize ids with `ctx.db.normalizeId(...)` and fail closed on malformed ids.
- Use `ConvexError` with consistent codes for expected blocked transitions.
- Use existing audit helpers from `webapp/convex/functions/_audit.ts` and event constants in `webapp/lib/security/audit.ts`; add new constants if needed.
- Use shadcn/ui primitives and `sonner` for decision UI feedback.

### Latest Tech Information

- Verified on 2026-04-28 from official docs:
  - Next.js `useSearchParams` is a Client Component hook returning read-only query params; statically rendered routes that use it should wrap the client subtree in `Suspense` to avoid production build failures. Source: https://nextjs.org/docs/app/api-reference/functions/use-search-params
  - Convex React `useQuery` returns `undefined` while loading, rerenders reactively as underlying data changes, and accepts `"skip"` to conditionally disable a query. Source: https://docs.convex.dev/client/react/
  - Convex `useMutation` returns a stable function suitable for dependency arrays and executing Convex mutations from React components. Source: https://docs.convex.dev/api/modules/react
  - Blockly still recommends JSON serialization for new projects and JSON toolbox definitions over XML, which matches the existing repo's persisted Blockly workspace design. Sources: https://developers.google.com/blockly/guides/configure/web/serialization and https://developers.google.com/blockly/guides/configure/web/toolbox

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/procurementOfficerPlanReview.ts`
  - `webapp/lib/procurement-officer/review.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewWorkspace.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewSummaryModal.tsx`
  - `webapp/tests/procurement-officer-review.test.ts`
  - `webapp/tests/run-tests.ts`
- Expected new files if the implementation is clearer with focused modules:
  - `webapp/lib/procurement-officer/review-decision.ts`
  - `webapp/tests/procurement-officer-review-decisions.test.ts`
- Optional new Convex module only if `procurementOfficerPlanReview.ts` becomes too broad:
  - `webapp/convex/functions/procurementOfficerPlanDecisions.ts`

### Testing Requirements

- Run at minimum from `webapp/`:
  - `cmd /c npm test`
  - `cmd /c npm run lint`
  - `cmd /c npx convex codegen --typecheck disable` if schema or Convex functions change
- Required deterministic test coverage:
  - status transition helpers for approve, reject, revision request, and undo approval
  - blocked malformed/cross-tenant/draft/closed target decisions
  - 24-hour undo window and consolidation guard
  - required comment normalization for rejection/revision
  - flagged-target persistence and stale-target rejection
  - revision deadline validation
  - notification intent idempotency
  - audit metadata shape for allowed and blocked transitions
  - UI action labels and disabled states for submitted vs. closed plans

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 6 Source](../epic-06-plan-submission-review.md)
- [Previous Story 6.4](./6-4-plan-review-interface.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [PO Review Workspace](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewWorkspace.tsx)
- [PO Review Summary Modal](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewSummaryModal.tsx)
- [PO Review Convex Functions](../../../../../webapp/convex/functions/procurementOfficerPlanReview.ts)
- [Plan Redraft Functions](../../../../../webapp/convex/functions/planRedrafts.ts)
- [Review Helpers](../../../../../webapp/lib/procurement-officer/review.ts)
- [Submission Helpers](../../../../../webapp/lib/plans/submission.ts)
- [Audit Constants](../../../../../webapp/lib/security/audit.ts)
- [Current Convex Schema](../../../../../webapp/convex/schema.ts)
- [Current PO Review Tests](../../../../../webapp/tests/procurement-officer-review.test.ts)
- [Current Test Runner](../../../../../webapp/tests/run-tests.ts)
- [Webapp Package Versions](../../../../../webapp/package.json)
- [Next.js useSearchParams Docs](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Convex React Docs](https://docs.convex.dev/client/react/)
- [Convex React API Docs](https://docs.convex.dev/api/modules/react)
- [Blockly Serialization Docs](https://developers.google.com/blockly/guides/configure/web/serialization)
- [Blockly Toolbox Docs](https://developers.google.com/blockly/guides/configure/web/toolbox)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Story Completion Status

- Story ID: `6.5`
- Story Key: `6-5-plan-approval-rejection`
- Output File: `_bmad-output/implementation-artifacts/epics/epic6/stories/6-5-plan-approval-rejection.md`
- Status: `ready-for-dev`
- Completion Note: `Ultimate context engine analysis completed - comprehensive developer guide created`
