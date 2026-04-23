# Story 6.1: Plan Submission Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want to submit my completed plan for PO review,
so that my department's procurement needs can be included in the consolidated plan.

## Acceptance Criteria

1. [Given] a Departmental User opens an editable current-fiscal-year draft in the existing Blockly workspace [When] the plan is eligible for submission under the current repo rules [Then] the current reserved `Submit to PO` affordance is replaced with a real submission flow entry point [And] the CTA no longer falls back to the placeholder toast text from Story 5.x [And] the flow stays inside the existing DU desktop workspace shell instead of introducing a second submission page (FR49, current `/du/plans/[planId]` contract).
2. [Given] a Departmental User clicks the real submit action [When] pre-submit review opens [Then] the UI shows a confirmation step summarizing the current draft using canonical plan data already available in the repo, including item count, estimated budget used, category breakdown, and current validation or blocker copy [And] this summary is powered by the same workspace-derived totals used elsewhere in the DU editor rather than a second client-only calculation path [And] plans with zero actionable items or any already-known current-story blocker remain blocked from confirmation even before Story 6.2 expands the rule set [And] Story 6.1 does not over-implement the deeper rule set reserved for Story 6.2 (FR49, FR50g).
3. [Given] the DU confirms submission [When] the canonical submission mutation succeeds or the first successful response is lost before the browser receives it [Then] the backend transitions the plan from `draft` to `submitted`, stamps `submittedAt`, persists any required department name or code snapshots, and returns a stable success payload with the already-allocated human-readable reference number plus submission timestamp [And] the reference format is stable and server-generated, for example `CS-2526-001`, rather than derived in the browser (FR49, FR49b).
4. [Given] the DU clicks submit or confirm [When] the request is in flight, retried by the browser, repeated quickly by double-clicking, or races against PO review start [Then] the UI disables the submit control, shows a truthful loading state, and the backend prevents duplicate submission state transitions, duplicate reference-number allocation, duplicate immutable snapshots, and duplicate confirmation emails for the same submission attempt [And] workflow transitions are guarded atomically so submit or withdraw cannot succeed against stale state once review start has won the race (FR49a, FR49b, FR49d).
5. [Given] submission succeeds [When] the DU remains in the workspace or returns to `/du` [Then] the plan becomes read-only everywhere the repo already understands submitted state, including the Blockly editor route, dashboard quick stats, plans table, and current action labels [And] the DU sees truthful status copy such as `Submitted` or `Awaiting Review` without any edit affordance that the backend would reject (FR49e, existing `canDepartmentUserEditWorkspace(...)` contract).
6. [Given] a submitted plan has not yet been opened for review by a Procurement Officer [When] the DU chooses to withdraw it from a truthful submitted-state surface [Then] a canonical withdrawal mutation returns the plan to `draft`, preserves the latest editable workspace content, removes the plan from the live PO queue, restores DU editing access, and clears active submitted-state fields that would otherwise keep draft surfaces looking submitted [And] the withdraw affordance disappears as soon as review has started or the status is no longer `submitted` (FR49c).
7. [Given] a submitted plan already has `reviewStartedAt` set or otherwise no longer qualifies for withdrawal [When] a DU tries to withdraw through stale UI state, a second tab, or a bookmarked route [Then] the backend rejects the mutation deterministically and the UI refreshes back to the truthful submitted or under-review state instead of silently forking plan history (FR49c, forward compatibility with Story 6.4).
8. [Given] Story 6.3 and Story 6.4 already use `plans.status`, `submittedAt`, `reviewStartedAt`, and `planSubmissionSnapshots` in the live repo [When] Story 6.1 is implemented [Then] immutable submission baselines move to the moment of DU submission rather than first review open [And] withdrawal plus later resubmission allocates a new submission reference or sequence while preserving prior withdrawn history [And] the existing review flow is updated so Story 6.4 only fills review-start metadata and can backfill legacy snapshots if needed, but does not remain the primary owner of submission-time baselines [And] PO diff or review code resolves the active baseline from the latest non-withdrawn submission record rather than any historical snapshot (FR49, FR53a, forward compatibility with Story 6.6).
9. [Given] confirmation email delivery is part of the submission contract [When] submission succeeds [Then] the system queues one DU-facing confirmation email through the existing Convex action plus NestJS email bridge or dev-inbox fallback, uses an idempotency key tied to the specific submission event, and includes the submission reference number, timestamp, and next-step guidance [And] if email delivery fails, the submission itself remains committed while the failure is surfaced truthfully and captured in audit or operational diagnostics without triggering duplicate submission state (FR49d, existing email bridge pattern).
10. [Given] submission or withdrawal mutates canonical plan workflow state [When] either operation succeeds or is blocked [Then] append-only audit records capture the outcome, actor, tenant scope, plan identifier, and key workflow metadata using the repo's existing audit vocabulary and storage pattern instead of ad hoc console-only diagnostics (NFR-S1, project-context audit rules).
11. [Given] this story lands before Story 6.2, 6.5, and 6.6 [When] implementation is complete [Then] Story 6.1 owns the transition into `submitted`, the confirmation contract, immutable submission baseline capture, and the pre-review withdrawal path only [And] it does not implement PO decision flows, revision-request UX, or the full submission-readiness rules reserved for later stories.
12. [Given] the repo already contains deterministic Node-based regression suites for DU, PO queue, and PO review behavior [When] Story 6.1 completes [Then] automated coverage proves submit availability, pre-submit summary shaping, double-submit prevention, submission-to-read-only transition, withdraw gating, queue visibility changes, submission-time snapshot ownership, confirmation-email idempotency, and legacy review compatibility.

## Tasks / Subtasks

- [x] Task 1: Replace the reserved DU submit affordance with a real submission entry flow in the existing Blockly editor shell (AC: 1, 2, 4, 5, 11, 12)
  - [x] Replace the current `handleReservedAction(...)` submission placeholder in `webapp/src/components/blockly/BlocklyEditor.tsx` with a real pre-submit confirmation path.
  - [x] Split the current `getDepartmentUserReservedSubmitState(...)` seam in `webapp/lib/blockly/du-workspace-calculations.ts` into a truthful submission-readiness helper that uses the existing budget and validation summary state already computed for the workspace.
  - [x] Keep the submit flow inside the current desktop Blockly workspace instead of routing into a new standalone submission page or modal shell.
  - [x] Preserve current save-state, read-only, and recovery guardrails from Story 5.4 so submission cannot bypass unsynced-risk messaging or leave stale local editor state unexplained.

- [x] Task 2: Add canonical DU submit and withdraw mutations using the current plan domain rather than a story-local shadow model (AC: 3, 4, 5, 6, 7, 10, 11, 12)
  - [x] Prefer extending `webapp/convex/functions/plans.ts` or adding a focused sibling module such as `webapp/convex/functions/planSubmission.ts` only if cohesion stays clear.
  - [x] Guard all DU submission and withdrawal writes with `requireTenantRole(ctx, ["department_user"])`, derive tenant and department scope from auth context, and reject cross-tenant or cross-department plan IDs deterministically.
  - [x] Enforce legal state transitions server-side: `draft -> submitted` for Story 6.1, and `submitted -> draft` only while review has not started.
  - [x] Make submit retries idempotent from the DU perspective so a lost client response can return the already-committed success payload instead of a misleading generic failure.
  - [x] Generate the submission timestamp and human-readable reference number on the server in one race-safe mutation flow rather than from client-side counters or optimistic labels.
  - [x] Use atomic guards or compare-and-set style checks so submit and withdraw cannot both succeed against stale state during concurrent review-start races.
  - [x] Reuse the existing submitted-plan read-only contract in `webapp/lib/blockly/du-plan-routes.ts` instead of adding a second edit-lock flag on the client.

- [x] Task 3: Move immutable submission baseline ownership to submit time and reconcile the already-shipped PO queue and review flows (AC: 3, 6, 8, 11, 12)
  - [x] Extend `webapp/convex/schema.ts` with the minimum canonical metadata needed for submission references and lifecycle-safe immutable baselines, for example a human-readable `submissionReference`, submission sequence number, and any lifecycle marker required to distinguish withdrawn snapshots from active submissions.
  - [x] Capture or update `planSubmissionSnapshots` at the moment of successful submission so Story 6.4 diff behavior no longer depends on first review open.
  - [x] Define the active-baseline selection rule explicitly for withdraw and resubmit cycles so PO review always uses the latest non-withdrawn submission snapshot.
  - [x] Update `webapp/convex/functions/procurementOfficerPlanReview.ts` so review start records `reviewStartedAt` and reviewer identity without remaining the primary creator of submission snapshots for newly submitted plans.
  - [x] Keep a narrowly scoped legacy fallback in review code for older data that predates Story 6.1, but do not preserve review-start snapshot capture as the normal path.
  - [x] Verify `webapp/convex/functions/procurementOfficerSubmissions.ts` remains truthful when a DU withdraws a plan back to `draft`, including stale review-target redirects already added in Story 6.3.

- [x] Task 4: Extend DU submitted-state surfaces to show confirmation truthfully and allow withdrawal only where the backend still permits it (AC: 3, 5, 6, 7, 11, 12)
  - [x] Reuse the existing DU dashboard and plan-route action model in `webapp/lib/department-user/dashboard.ts` and `webapp/lib/department-user/dashboard-snapshot.ts` so `Submitted` continues to resolve to view-only behavior automatically after status changes.
  - [x] Add truthful post-submit confirmation copy, reference visibility, and withdrawal affordances to the minimum DU surfaces that already exist, such as the current plan workspace in view mode and the dashboard row or hero area for the active fiscal-year plan.
  - [x] Ensure withdrawal clears any stale submitted badge, timestamp, or reference presentation that would otherwise linger on draft surfaces after the revert.
  - [x] Do not reintroduce edit affordances for submitted plans; withdrawal is the only pre-review reversal path in this story.
  - [x] Keep the UX desktop-first and aligned with the current DU dashboard and Blockly workspace visual language.

- [x] Task 5: Reuse the current email and audit infrastructure for submission confirmation instead of inventing a second notification path (AC: 4, 9, 10, 12)
  - [x] Extend `webapp/convex/actions/email.ts` with the smallest truthful template support needed for plan-submission confirmation, or use the existing generic notification path only if the resulting DU copy remains clear and deterministic.
  - [x] Reuse `webapp/convex/emailTransport.ts` and its Resend `Idempotency-Key` support for safe retries and dev-inbox capture in local development.
  - [x] Define the failure contract for confirmation-email delivery explicitly: submission remains canonical, duplicate sends stay suppressed, and email failure is surfaced through audit plus truthful operator or DU feedback.
  - [x] Add submission and withdrawal audit event names to the existing audit vocabulary instead of logging opaque free-form strings.
  - [x] Keep the submit mutation as the source of user intent and use an action only for the external email side effect, consistent with current Convex guidance and existing repo patterns.

- [x] Task 6: Add deterministic regression coverage for DU submission, withdrawal, queue visibility, and review compatibility (AC: 1-12)
  - [x] Add DU-focused tests for submit-readiness labels, pre-submit summary shaping, zero-item blocking, submit button disablement while pending, post-submit read-only behavior, and withdraw gating.
  - [x] Extend `webapp/tests/department-user-dashboard.test.ts`, `webapp/tests/department-user-blockly-workspace.test.ts`, and `webapp/tests/department-user-blockly-workspace-ui.test.tsx` where those suites already cover the affected DU seams.
  - [x] Add or extend PO-side tests in `webapp/tests/procurement-officer-submissions.test.ts` and `webapp/tests/procurement-officer-review.test.ts` to prove newly submitted plans enter the queue, withdrawn plans leave it, resubmitted plans bind to the latest active baseline, and review-start snapshot ownership remains compatible with Story 6.4.
  - [x] Add backend tests for duplicate-submit rejection or idempotency, lost-response submit retry success replay, review-start withdrawal blocking, submission-time snapshot capture, confirmation-email queue idempotency, email-failure-without-state-rollback behavior, and any new reference-number sequencing contract.
  - [x] Register any new suites in `webapp/tests/run-tests.ts`.

## Dev Notes

### Story Foundation

- Epic 6 positions Story 6.1 as the DU-to-PO handoff moment: turning the current Blockly draft into a formal reviewable submission.
- In the live repo, this story is not greenfield. The DU workspace, dashboard, queue, and review route already exist, but the submit button is still intentionally reserved.
- Story 6.1 must therefore connect real DU submission state into code that already assumes submitted plans can exist, while avoiding scope creep into the deeper readiness rules of Story 6.2 or the decision flows of Stories 6.5 and 6.6.

### Downstream Story Intelligence

- There is no lower-numbered Epic 6 story file to inherit from, but downstream Epic 6 implementation already exists and creates hard compatibility requirements.
- Story 6.3 is already done and reads the live PO queue directly from `plans.status` plus `submittedAt`; this means Story 6.1 must write those canonical fields rather than invent a parallel queue model.
- Story 6.4 is already in review and currently captures `planSubmissionSnapshots` during review start; Story 6.1 should move immutable submission-baseline ownership to DU submit time and leave Story 6.4 with review-start tracking only, plus a legacy-data fallback.
- Story 6.7 is still backlog, but the DU dashboard and routing seams already understand `Submitted` status. Story 6.1 should reuse those seams rather than introducing a second submitted-state presentation path.

### Current Implementation State Discovered In Code

- `webapp/src/components/blockly/BlocklyEditor.tsx` already renders a `Submit to PO` button, but it still calls `handleReservedAction(...)` and shows placeholder text such as `Submission stays reserved until the submission flow lands.`
- `webapp/lib/blockly/du-workspace-calculations.ts` currently exposes `getDepartmentUserReservedSubmitState(...)`, which always keeps submission disabled even when the workspace summary is otherwise healthy.
- `webapp/lib/blockly/du-plan-routes.ts` already blocks editing for `submitted` and `approved` plans via `canDepartmentUserEditWorkspace(...)`; Story 6.1 should leverage that instead of adding a second client-only lock mechanism.
- `webapp/lib/department-user/dashboard.ts` and `webapp/lib/department-user/dashboard-snapshot.ts` already treat `Submitted` as a real normalized status and pivot the dashboard toward view-only actions when a current fiscal-year plan is no longer editable.
- `webapp/convex/functions/plans.ts` already owns DU plan creation, load, and draft-save behavior and is the natural canonical place for submit or withdraw mutations unless a focused sibling module is cleaner.
- `webapp/convex/schema.ts` already contains the core fields Story 6.1 needs to activate:
  - `plans.status`
  - `plans.submittedAt`
  - `plans.reviewStartedAt`
  - `plans.departmentCodeSnapshot`
  - `plans.departmentNameSnapshot`
  - `planSubmissionSnapshots`
  - `planReviewComments`
- The current schema does not yet expose a dedicated human-readable submission reference, a race-safe submission sequence contract, or clear lifecycle metadata for withdrawn submission snapshots.
- `webapp/convex/functions/procurementOfficerSubmissions.ts` already excludes `draft` plans and shapes queue rows from live canonical plan state, so reverting a plan to `draft` is enough to remove it from the queue if Story 6.1 uses the current model truthfully.
- `webapp/convex/functions/procurementOfficerPlanReview.ts` currently captures immutable snapshots on first review open. That was a workable temporary seam for Story 6.4, but it is not the right final owner of submission-time baselines.
- `webapp/convex/actions/email.ts` and `webapp/convex/emailTransport.ts` already provide the external email bridge, including Resend transport and dev-inbox fallback, but the template union does not yet include a plan-submission confirmation template.
- Repo-wide search found no existing `plan.submitted` or `plan.withdrawn` audit vocabulary, so Story 6.1 needs to add explicit event names if audit output is meant to stay queryable and consistent.

### Technical Requirements

- Keep Convex as the canonical owner of plan submission state. The browser can initiate submission and show optimistic or pending UI, but the source of truth for `submitted`, `submittedAt`, reference number, and withdraw eligibility must live in backend mutations.
- Do not derive submission reference numbers on the client and do not rely on naive queue-row counts. Use one race-safe server-owned sequence contract, either on the plan record itself or through a narrowly scoped counter table keyed by tenant, department, and fiscal year.
- Prefer storing the human-readable submission reference on the active plan and on immutable submission snapshots so later queue, review, and history surfaces do not need to reconstruct it.
- Because FR49c allows withdrawal before review begins, immutable submission history needs a lifecycle-safe representation. If `planSubmissionSnapshots` remain the canonical baseline store, add enough metadata so a withdrawn attempt can be distinguished from an active submitted baseline.
- When a withdrawn draft is later resubmitted, allocate a fresh submission sequence or reference and mark earlier snapshots as historical or withdrawn so active queue and review flows never resolve against stale baselines.
- Submission should not delete or fork the current canonical plan. The existing DU model is still one plan per department per fiscal year. Story 6.1 transitions that same plan into `submitted`; withdrawal returns the same plan to `draft`.
- Read-only behavior after submit should come from the existing status-based rules already in the repo, especially `canDepartmentUserEditWorkspace(...)`, rather than a second `isLocked` boolean living only in React state.
- The pre-submit confirmation step should reuse current persisted summary and workspace validation data. Story 6.1 should not reimplement all of FR50-FR51 if Story 6.2 is intended to deepen those rules immediately afterward.
- At minimum, Story 6.1 must block obviously empty submissions, such as plans with zero actionable items, even if richer readiness logic is deferred to Story 6.2.
- Queue, review, and withdrawal behavior must stay tenant-safe. All reads and writes should derive tenant and department from auth context and reject cross-tenant or cross-department plan access.
- A successful submit should be the only trigger for the external confirmation email. Use the existing action bridge and idempotency keys so retries are safe and duplicate sends do not occur.
- If an email side effect fails after the canonical submission commit, preserve the submission and record a truthful failure outcome rather than rolling back workflow state or retrying blindly from the client.
- Retry semantics must distinguish between "submit never committed" and "submit already committed but the client lost the response" so users do not see false negatives after a real submission.
- A withdraw should not silently remove evidence that a submission ever happened if later stories depend on historical comparisons or auditability. Preserve enough state for truthful history while ensuring active queue behavior still keys off canonical plan status.

### Detected Variance And Resolution

- The original epic text makes Story 6.2 responsible for deeper pre-submit validation, but Story 6.1 still includes a validation summary requirement.
- The clean resolution is:
  - Story 6.1 should surface the summary and blocker contract,
  - reuse the validation and budget signals already present today,
  - and leave the deeper rule set expansion, richer fix links, and full itemized readiness engine to Story 6.2.
- The live repo also shipped Story 6.4 before Story 6.1, which temporarily moved immutable submission snapshot capture to review start.
- Story 6.1 should correct that ownership by moving primary snapshot capture to submit time, while keeping legacy fallback compatibility so already-created data and tests do not break abruptly.

### Architecture Compliance

- Keep page and route files thin. Story 6.1 should primarily extend the existing DU workspace and Convex function layers instead of adding a new submission route tree.
- Reuse the current App Router structure under `webapp/app/(app)/du/...` and the current `DepartmentUserBlocklyWorkspace` shell.
- Keep authorization and state-transition rules in Convex functions, not only in UI conditions.
- Use actions only for the external confirmation email side effect. Do not call external email APIs directly from mutations or from client components.
- Preserve the existing lazy-loaded Blockly host and desktop-only DU experience. Submission is a workflow enhancement, not a reason to rewrite the editor shell.
- Maintain the existing PO-side route contracts from Stories 6.3 and 6.4. Story 6.1 should integrate with them, not replace them.

### Library And Framework Requirements

- Current repo versions from `webapp/package.json`:
  - `next`: `^16.1.6`
  - `react`: `^19.2.4`
  - `convex`: `^1.13.2`
  - `blockly`: `^12.5.1`
  - `date-fns`: `^2.30.0`
  - `sonner`: `^2.0.7`
  - `resend`: `^2.1.0`
- Official documentation verified on 2026-04-22 still supports the implementation shape this story should follow:
  - Convex mutation functions remain the transactional place for business-state changes.
  - Convex actions remain the place for outside-world calls such as email delivery.
  - Convex React `useMutation(...)` still returns an async function suitable for the current client-side DU workflow.
  - Next.js App Router still recommends `Link` for ordinary navigation and `useRouter` for client-side programmatic transitions when needed.
  - Resend still supports `Idempotency-Key` on `POST /emails`, which aligns with the repo's existing email transport pattern for safe retries.
- No dependency upgrade is required for Story 6.1. Preserve the repo's current installed versions and patterns rather than turning this into an upgrade story.

### Reuse And Anti-Reinvention Guidance

- Reuse the current DU editor and summary seams:
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/blockly/du-plan-routes.ts`
- Reuse the current DU dashboard and status presentation seams:
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
- Reuse the current PO queue and review seams rather than creating a second submission-read model:
  - `webapp/convex/functions/procurementOfficerSubmissions.ts`
  - `webapp/convex/functions/procurementOfficerPlanReview.ts`
  - `webapp/lib/procurement-officer/submissions.ts`
  - `webapp/lib/procurement-officer/review.ts`
- Reuse the current external email bridge:
  - `webapp/convex/actions/email.ts`
  - `webapp/convex/emailTransport.ts`
  - `webapp/convex/devEmailHttp.ts`
- Do not create:
  - a separate DU submission page,
  - a client-only submission history model,
  - a second PO queue table,
  - or a direct-from-client email call.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/blockly/du-plan-routes.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/procurementOfficerSubmissions.ts`
  - `webapp/convex/functions/procurementOfficerPlanReview.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/actions/email.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/tests/run-tests.ts`
- Expected new files (recommended):
  - `webapp/lib/blockly/plan-submission.ts`
  - `webapp/tests/department-user-plan-submission.test.ts`
- Optional focused backend module if `plans.ts` becomes too broad:
  - `webapp/convex/functions/planSubmission.ts`

### Testing Requirements

- Add DU helper or component tests for:
  - truthful submit-readiness labels
  - pre-submit summary shaping
  - disabled submit state while pending
  - post-submit read-only state
  - withdrawal affordance visibility rules
- Add backend tests for:
  - `draft -> submitted` transition
  - duplicate-submit or repeated-click protection
  - server-generated reference number allocation
  - submission-time snapshot capture
  - `submitted -> draft` withdrawal only while `reviewStartedAt` is null
  - blocked withdrawal once review starts
  - confirmation-email idempotency
- Extend PO-side tests for:
  - queue row appears after submit
  - queue row disappears after withdraw
  - review flow remains compatible when snapshots are already captured at submit time
  - legacy fallback still works for older review targets if a snapshot is missing
- Register any new suites in `webapp/tests/run-tests.ts`.

### Git Intelligence Summary

- Recent git history confirms that the team already landed the downstream Epic 6 workflow out of sequence:
  - `c37a16a` marks Stories 6.3 and 6.4 as done or implemented.
  - `4c1f4fe` added the Procurement Officer Requests Workspace using the existing dashboard-shell and helper-first pattern.
  - `074abab` continued extending the live DU and department planning experience rather than replacing it.
- Inference from current repo direction:
  - Story 6.1 should extend existing DU and PO seams with targeted workflow state, not introduce a new architectural slice.
  - The safest implementation path is to activate existing status-aware surfaces and normalize submit-time snapshot ownership, not to create a parallel submission subsystem.

### Latest Tech Information

- Verified on 2026-04-22 against official documentation:
  - Convex mutation docs still describe mutations as transactional business-logic entry points for database writes.
  - Convex action docs still describe actions as the correct place for external API calls and explicitly note that calling actions directly from clients is usually an anti-pattern compared with a mutation capturing user intent and scheduling the action.
  - Convex React docs still show `useMutation(...)` returning an async function that the current DU client flow can await.
  - Next.js App Router docs still position `useRouter` as the programmatic navigation hook for Client Components and recommend `Link` unless imperative routing is needed.
  - Resend docs still support `Idempotency-Key` for `POST /emails`, with a 24-hour retention window for duplicate prevention.

### Project Context Reference

- Apply the current project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first tenant and role enforcement
  - shadcn/ui plus Tailwind styling
  - `sonner` for user feedback
  - JSON Blockly persistence
  - append-only audit expectations
- Where older planning artifacts conflict with the live repo structure, prefer the live repo and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 6 Source](../epic-06-plan-submission-review.md)
- [Story 5.1 Reference](../../epic5/stories/5-1-du-dashboard-plan-status.md)
- [Story 5.4 Reference](../../epic5/stories/5-4-plan-persistence-recovery.md)
- [Story 6.3 Reference](./6-3-po-submission-queue.md)
- [Story 6.4 Reference](./6-4-plan-review-interface.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [Current DU Dashboard](../../../../../webapp/src/components/department-user/DepartmentUserDashboard.tsx)
- [Current DU Dashboard Helpers](../../../../../webapp/lib/department-user/dashboard.ts)
- [Current DU Dashboard Snapshot](../../../../../webapp/lib/department-user/dashboard-snapshot.ts)
- [Current DU Workspace Shell](../../../../../webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx)
- [Current Blockly Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Current DU Workspace Calculations](../../../../../webapp/lib/blockly/du-workspace-calculations.ts)
- [Current DU Plan Routes](../../../../../webapp/lib/blockly/du-plan-routes.ts)
- [Current Workspace Save Helpers](../../../../../webapp/lib/blockly/workspace-save.ts)
- [Current Plans Functions](../../../../../webapp/convex/functions/plans.ts)
- [Current PO Submission Queue Functions](../../../../../webapp/convex/functions/procurementOfficerSubmissions.ts)
- [Current PO Review Functions](../../../../../webapp/convex/functions/procurementOfficerPlanReview.ts)
- [Current PO Submission Helpers](../../../../../webapp/lib/procurement-officer/submissions.ts)
- [Current PO Review Helpers](../../../../../webapp/lib/procurement-officer/review.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Current Email Action Bridge](../../../../../webapp/convex/actions/email.ts)
- [Current Email Transport](../../../../../webapp/convex/emailTransport.ts)
- [Current Dev Email Capture](../../../../../webapp/convex/devEmailHttp.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Convex Mutation Functions](https://docs.convex.dev/functions/mutation-functions)
- [Convex Actions](https://docs.convex.dev/functions/actions)
- [Convex React](https://docs.convex.dev/client/react/)
- [Next.js `useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router)
- [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email)
- [Resend Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys)

## Dev Agent Record

### Agent Model Used

gpt-5

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story sources:
  - `_bmad-output/implementation-artifacts/epics/epic6/epic-06-plan-submission-review.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-3-po-submission-queue.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-4-plan-review-interface.md`
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-1-du-dashboard-plan-status.md`
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-4-plan-persistence-recovery.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Live implementation sources:
  - `webapp/package.json`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/convex/functions/procurementOfficerSubmissions.ts`
  - `webapp/convex/functions/procurementOfficerPlanReview.ts`
  - `webapp/convex/actions/email.ts`
  - `webapp/convex/emailTransport.ts`
  - `webapp/convex/devEmailHttp.ts`
  - `webapp/lib/blockly/du-plan-routes.ts`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/tests/department-user-blockly-workspace.test.ts`
  - `webapp/tests/department-user-blockly-workspace-ui.test.tsx`
  - `webapp/tests/procurement-officer-submissions.test.ts`
  - `webapp/tests/procurement-officer-review.test.ts`
  - `webapp/tests/run-tests.ts`
- Git context:
  - `git log -5 --oneline`
- Tech verification:
  - `https://docs.convex.dev/functions/mutation-functions`
  - `https://docs.convex.dev/functions/actions`
  - `https://docs.convex.dev/client/react/`
  - `https://nextjs.org/docs/app/api-reference/functions/use-router`
  - `https://resend.com/docs/api-reference/emails/send-email`
  - `https://resend.com/docs/dashboard/emails/idempotency-keys`

### Completion Notes List

- 2026-04-22: Created the implementation-ready story artifact for `6-1-plan-submission-flow`.
- 2026-04-22: Anchored the story to the live repo seam where DU submission is still reserved in `BlocklyEditor.tsx` even though Stories 6.3 and 6.4 already assume canonical submitted plan state exists.
- 2026-04-22: Clarified that immutable submission baseline capture should move from review start to submit time, while keeping a legacy fallback so downstream Epic 6 work remains compatible.
- 2026-04-22: Scoped Story 6.1 around DU submit, confirmation, withdrawal before review, email confirmation, and auditability while leaving deeper readiness validation to Story 6.2 and PO decision flows to later stories.
- 2026-04-22: Updated sprint tracking so `6-1-plan-submission-flow` is ready for development.
- 2026-04-22: Replaced the DU workspace placeholder submit action with a real in-shell review, submit, and withdraw flow backed by canonical Convex mutations and truthful readiness gating.
- 2026-04-22: Added server-owned submission references, submission sequencing, snapshot lifecycle metadata, confirmation-email queueing, and append-only audit events for submit and withdraw outcomes.
- 2026-04-22: Updated DU dashboard and workspace surfaces to show submission references, read-only submitted state, email failure notices, and pre-review withdrawal availability.
- 2026-04-22: Moved active submission-baseline ownership to submit time and updated PO review baseline selection to ignore withdrawn snapshots while preserving legacy fallback behavior.
- 2026-04-22: Verified the story with `npm test` in `webapp`, passing 319 assertions including new DU submission and PO review regression coverage.
- 2026-04-22: `npm run lint` still fails on unrelated existing repo issues in `.next/types/validator.ts` and procurement-officer workspace route typing; those were not introduced by Story 6.1.
- 2026-04-23: Fixed the submission mutation to persist the same recomputed canonical summary it validates, closed rejected-plan submit affordance mismatches, prevented auto-start review writes on approved or rejected review surfaces, backfilled legacy withdrawn submission history when snapshots were missing, and extended regression coverage around the shared transition helpers.

### File List

- `_bmad-output/implementation-artifacts/epics/epic6/stories/6-1-plan-submission-flow.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/actions/email.ts`
- `webapp/convex/functions/departmentUserDashboard.ts`
- `webapp/convex/functions/plans.ts`
- `webapp/convex/functions/procurementOfficerPlanReview.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/blockly/du-workspace-calculations.ts`
- `webapp/lib/blockly/plan-submission.ts`
- `webapp/lib/department-user/dashboard-snapshot.ts`
- `webapp/lib/plans/submission.ts`
- `webapp/lib/procurement-officer/review.ts`
- `webapp/lib/security/audit.ts`
- `webapp/src/components/blockly/BlocklyEditor.tsx`
- `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
- `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewSummaryModal.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewWorkspace.tsx`
- `webapp/tests/department-user-dashboard.test.ts`
- `webapp/tests/department-user-plan-submission.test.ts`
- `webapp/tests/procurement-officer-review.test.ts`
- `webapp/tests/run-tests.ts`

## Story Completion Status

- Story ID: `6.1`
- Story Key: `6-1-plan-submission-flow`
- Output File: `_bmad-output/implementation-artifacts/epics/epic6/stories/6-1-plan-submission-flow.md`
- Final Status: `done`
- Completion Note: `Implemented DU submit and pre-review withdrawal end to end, fixed the review findings around canonical submission persistence, closed-state PO review auto-starts, rejected-plan submit affordances, and legacy withdrawal history preservation, then verified the story with the webapp regression suite at 323 passing assertions.`
