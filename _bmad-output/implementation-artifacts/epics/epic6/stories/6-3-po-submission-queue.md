# Story 6.3: PO Submission Queue

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to view all submitted plans in a queue,
so that I can efficiently process department submissions.

## Acceptance Criteria

1. [Given] a Procurement Officer opens the procurement dashboard queue entry point [When] submitted or previously reviewed department plans exist for the active tenant and fiscal-year context [Then] the UI renders a real submission queue instead of the current placeholder `submission_monitoring` panel [And] each row shows at minimum department name, submission date, current status, total amount, and a clear action to open the plan for review (FR52).
2. [Given] the queue loads [When] the active tenant has plans in statuses relevant to review workflow [Then] only tenant-scoped plan records are included [And] draft plans are excluded [And] the queue uses the canonical `plans` data source or a forward-compatible submission-read model rather than hard-coded demo rows (FR52, NFR-S1).
3. [Given] multiple queue rows exist [When] the queue renders without an explicit sort override [Then] rows are ordered by submission date oldest first by default [And] the user can change sorting to department name, total amount, and status without losing deterministic ordering for equal values [And] rows missing `submittedAt` fall back to a defensible timestamp such as `updatedAt` instead of crashing or becoming unsortable.
4. [Given] a Procurement Officer needs to narrow the queue [When] filter controls are used [Then] the queue supports filtering by status, submission date range, and department [And] the chosen filter state is reflected in the URL or equivalent shareable navigation state so the view can be revisited consistently [And] date-range filtering handles same-day end boundaries correctly in tenant time-zone context rather than dropping late-day submissions.
5. [Given] the queue contains a mix of submitted, approved, and rejected plans [When] status badges render [Then] the visual treatment is truthful, scannable, and consistent with the existing Procureline dashboard language [And] no future-state status such as `Under Review` is fabricated unless backed by real data.
6. [Given] no submitted or reviewed plans match the current filters [When] the queue renders [Then] the interface shows an explicit empty state such as `No submitted plans yet. Check back after departments submit.` [And] it includes guidance about clearing filters when relevant instead of a blank table [And] if the current fiscal-year scope is empty while other fiscal years still have queue rows, the empty state explains that the current year has no matching submissions rather than implying the tenant has none at all.
7. [Given] a Departmental User submits a plan while the Procurement Officer queue is open [When] Convex data updates arrive [Then] the queue updates reactively without manual refresh or polling [And] a non-blocking notification can announce the new submission if it was not already visible in the previous result set [And] reconnects or replayed query updates do not produce duplicate notifications for the same plan.
8. [Given] queue rows are rendered from current live plan state [When] a Procurement Officer opens one row [Then] navigation hands off to the Story 6.4 review workspace using a stable route or modal contract [And] the queue does not mutate plan status just by listing records [And] if the row becomes invalid because the plan was withdrawn, reverted to draft, or is no longer accessible before navigation resolves, the user is returned to the queue with a truthful notice instead of a broken review surface.
9. [Given] the queue is implemented in the current repo [When] story scope is respected [Then] Story 6.3 does not invent approval, rejection, revision-request, or diff-review behavior owned by Stories 6.4 through 6.6 [And] it only surfaces the minimum row context needed to prioritize and enter review safely.
10. [Given] the queue may be used against live tenant data with multiple departments [When] the backend query is implemented [Then] reads are protected with procurement-officer role enforcement and tenant scoping derived from auth identity rather than client-provided tenant values (NFR-S1).
11. [Given] dates, currency, and urgency cues are shown in the queue [When] row metadata is derived [Then] submitted timestamps are formatted consistently with existing dashboard helpers, KES totals use the repo currency-display conventions, and any urgency labels are derived from real submission age or deadline context rather than arbitrary color-only decoration.
12. [Given] the story is frontend-led but connected to live data [When] implementation completes [Then] the repo includes deterministic automated coverage for queue shaping, default sorting, filter behavior, empty-state handling, modal or route state, real-time-update resilience, and tenant-safe query behavior.

## Tasks / Subtasks

- [x] Task 1: Turn the current PO dashboard submission-monitoring placeholder into a real queue entry point (AC: 1, 4, 6, 8, 9)
  - [x] Replace the `submission_monitoring` future-panel contract in `webapp/lib/procurement-officer/dashboard-snapshot.ts` with a live workspace state that reflects real queue availability instead of the current hard-coded `Unavailable`.
  - [x] Extend `webapp/lib/procurement-officer/dashboard.ts` modal-state helpers so the PO dashboard can open a dedicated submissions workspace using the same in-dashboard shell pattern already used for departments, requests, categories, access codes, and deadlines.
  - [x] Update `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` so the submissions CTA and workspace modal render a real queue surface rather than a future-workflow badge.
  - [x] Keep `/po` as the canonical Procurement Officer shell; do not introduce a separate standalone dashboard framework or a second PO layout for this story.

- [x] Task 2: Add a PO-facing submissions query shaped from the live `plans` table and department records (AC: 1, 2, 5, 6, 10, 11)
  - [x] Add a focused Convex query module such as `webapp/convex/functions/procurementOfficerSubmissions.ts` or extend an existing PO query module only if it stays cohesive.
  - [x] Guard the query with `requireTenantRole(ctx, ["procurement_officer"])` and derive `tenantId` from auth context.
  - [x] Read from the canonical `plans` table plus `departments` so queue rows can show department name, submission timestamp, status, item count, and estimated budget used without duplicating plan state into a second table.
  - [x] Guard department joins so rows still render truthfully if a department record is archived, renamed, or temporarily unavailable; the queue must not fail hard on a missing join.
  - [x] Exclude `draft` plans from queue results and include only statuses that are already real in the schema: `submitted`, `approved`, and `rejected`.
  - [x] Sort oldest submitted first by default, while still returning enough stable row data for client-side or query-level alternate sorting.
  - [x] Handle plans with missing `submittedAt` by deriving a safe fallback sort key rather than letting rows become unstable or invisible.
  - [x] Keep the data model forward-compatible with later Epic 6 stories; if additional queue metadata is needed, prefer minimal shared fields on canonical plan records rather than story-local shadow state.

- [x] Task 3: Introduce pure helper logic for queue filters, sorting, row labels, and urgency cues (AC: 3, 4, 5, 6, 11, 12)
  - [x] Add a helper module such as `webapp/lib/procurement-officer/submissions.ts` for row shaping, filter application, default sort rules, URL-state normalization, and row badge copy so behavior is testable outside React.
  - [x] Reuse existing fiscal-year, deadline, and dashboard formatting helpers where possible instead of introducing ad hoc date logic.
  - [x] Keep status labels grounded in live schema values; do not infer `under_review` or review-owner metadata until Stories 6.4 and 6.5 introduce canonical support for it.
  - [x] If urgency is displayed, derive it from a defensible signal already available in repo state, such as submission age or active submission deadline context, and keep it secondary to canonical status.
  - [x] Normalize fiscal-year empty-state logic separately from true tenant-wide emptiness so the queue can explain "no submissions for this year" without pretending the queue is globally empty.
  - [x] Normalize date-range boundaries in tenant time-zone context, especially inclusive end-of-day filtering.

- [x] Task 4: Build the submissions workspace UI using existing Procureline dashboard patterns (AC: 1, 3, 4, 5, 6, 7, 8, 11)
  - [x] Add a component such as `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionsWorkspace.tsx` that matches the existing PO workspace style used by requests, categories, items, and deadlines.
  - [x] Render filter controls for status, department, and date range with shadcn/ui inputs and selects already present in the repo.
  - [x] Render a table or list surface with clear badges, submission timestamps, amount totals, and open-review actions, keeping the design scannable on supported desktop widths.
  - [x] Show a truthful empty state and loading state that match the product’s current tone instead of silent blanks.
  - [x] Use `useQuery` for live queue reads and `sonner` or equivalent non-blocking feedback for newly arrived submissions if the UX includes toast notifications.
  - [x] De-duplicate live-update notifications so reconnects, re-sorts, or replayed query payloads do not spam repeated "new submission" toasts for the same row.
  - [x] Preserve URL or modal state for filters and sorting so a refreshed or shared view returns to the same queue posture.
  - [x] Namespace new submissions query-string keys so they cannot collide with the existing PO dashboard modal parameters.

- [x] Task 5: Define the handoff contract from queue rows into Story 6.4 review flow without prematurely implementing review logic (AC: 8, 9, 12)
  - [x] Add a stable navigation target from each queue row into the planned review workspace, for example a reserved modal/route state carrying `planId` and queue context.
  - [x] Keep the queue read-only: listing rows or opening the queue must not mark a plan as reviewed, approved, or rejected.
  - [x] If current repo routing lacks a reserved review target, add the minimum truthful placeholder contract needed so Story 6.4 can attach cleanly without changing queue semantics later.
  - [x] Handle stale-row navigation explicitly: if a row no longer resolves to a reviewable plan by the time the handoff completes, redirect back to the queue with a clear notice.

- [x] Task 6: Add deterministic regression coverage for queue shaping and PO dashboard integration (AC: 2, 3, 4, 6, 7, 10, 11, 12)
  - [x] Add pure tests for queue row shaping, default oldest-first sorting, alternate sort keys, filter-state normalization, and empty-state derivation in a file such as `webapp/tests/procurement-officer-submissions.test.ts`.
  - [x] Extend `webapp/tests/procurement-officer-dashboard.test.ts` to prove the dashboard no longer hard-codes submission monitoring as unavailable and instead exposes a live submissions workspace contract.
  - [x] Add route or modal-state regression checks for the submissions workspace so queue deep links remain protected under the Procurement Officer role.
  - [x] Update `webapp/tests/run-tests.ts` if a new submissions test suite is introduced.

## Dev Notes

### Story Foundation

- Epic 6 positions Story 6.3 as the Procurement Officer's working queue before detailed review begins.
- In the current epic delivery map, Story 6.3 should aggregate incoming submissions by status and urgency, expose enough context for prioritization, and provide a clean handoff into Story 6.4.
- This repo already has the Procurement Officer dashboard shell and several live in-dashboard workspaces. Story 6.3 should extend that same pattern rather than inventing a new PO surface.

### Current Implementation State Discovered In Code

- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` already renders a "Submission monitoring" card, but it is intentionally marked unavailable.
- `webapp/lib/procurement-officer/dashboard-snapshot.ts` currently hard-codes the `submission_monitoring` future panel with state `unavailable` and copy that says the workflow is reserved for a later story.
- `webapp/lib/procurement-officer/dashboard.ts` already provides modal-backed workspace navigation for other PO flows and is the correct seam for adding a submissions workspace state.
- `webapp/convex/functions/procurementOfficerDashboard.ts` already builds a tenant-scoped Procurement Officer snapshot, but it does not yet load queue data from `plans`.
- `webapp/convex/schema.ts` already contains a canonical `plans` table with these relevant fields:
  - `tenantId`
  - `departmentId`
  - `fiscalYear`
  - `status` (`draft`, `submitted`, `rejected`, `approved`)
  - `itemCount`
  - `estimatedBudgetUsed`
  - `submittedAt`
  - `approvedAt`
  - `rejectedAt`
- The current schema does **not** yet contain a separate `planSubmissions` table, `reviewStartedAt`, `planStatusHistory`, or revision-request records. Story 6.3 should therefore avoid inventing those semantics and instead use the current canonical plan state truthfully.
- The current schema also allows `submittedAt`, `approvedAt`, and `rejectedAt` to be optional. Queue logic must therefore tolerate partially populated status timestamps instead of assuming every non-draft row has a complete audit trail already written.

### Architecture And Data Guidance

- Use the canonical `plans` table as the queue source for this story.
- Join plan rows with `departments` so each queue entry can show department identity and remain tenant-safe.
- Treat department joins as lossy in practice: archived or missing departments should degrade to a truthful fallback label instead of breaking the queue response.
- Reuse `requireTenantRole(ctx, ["procurement_officer"])` and tenant scoping patterns from existing Convex query modules.
- Keep page files thin and put queue derivation logic in helper modules or focused Convex query modules.
- Preserve the current dashboard architecture:
  - thin App Router page at `webapp/app/(app)/po/page.tsx`
  - PO dashboard component
  - modal-backed workspace helpers in `webapp/lib/procurement-officer/dashboard.ts`
  - typed snapshot and helper modules
- Do not create a second queue-only dashboard shell or a REST endpoint for data that already lives in Convex.

### Story Boundaries And Anti-Reinvention Guidance

- Story 6.3 owns:
  - surfacing the queue,
  - sorting and filtering it,
  - real-time visibility,
  - and clean navigation into review.
- Story 6.3 does **not** own:
  - immutable submission snapshots from Story 6.1,
  - validation blocking from Story 6.2,
  - deep review UX from Story 6.4,
  - approval or rejection actions from Story 6.5,
  - revision workflows from Story 6.6,
  - end-user status tracking from Story 6.7.
- If the current repo lacks a later-story contract, add only the smallest reserved handoff needed for forward compatibility.

### UX And Interaction Requirements

- Keep the submissions workspace in the same visual family as existing PO workspaces:
  - desktop-first
  - shadcn/ui tables, badges, dialogs, and filters
  - clear empty states
  - no fabricated business metrics
- Prioritize scanability:
  - department name
  - status
  - submitted date
  - total amount
  - review action
- Filtering and sorting must feel like operational queue tools, not decorative controls.
- Queue updates should happen reactively via Convex subscriptions; do not introduce polling.
- A new-submission notification is optional but should remain non-blocking and only fire when a newly visible row appears.
- Queue filter state must coexist with the existing `/po` modal-state contract. New query parameters should be namespaced and preserved predictably across modal opens, refreshes, and deep links.
- Empty-state copy must distinguish between:
  - no submissions in the tenant at all,
  - no submissions for the selected fiscal year,
  - and no rows matching the current filters.

### Recommended Queue Row Shape

- Recommended row fields:
  - `planId`
  - `departmentId`
  - `departmentName`
  - `departmentCode`
  - `fiscalYear`
  - `status`
  - `itemCount`
  - `estimatedBudgetUsed`
  - `submittedAt`
  - `approvedAt` or `rejectedAt` where relevant
  - `statusLabel`
  - `urgencyLabel` if derived from real signals
  - `reviewHref` or equivalent reserved review handoff target
  - `sortSubmittedAt` or equivalent normalized sort key that falls back safely when `submittedAt` is null

### Library And Framework Requirements

- Stay on the repo's installed stack for this story unless a separately approved dependency change is necessary:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `sonner` `^2.0.7`
  - `date-fns` `^2.30.0`
- Use existing shadcn/ui components already present in the repo:
  - `Table`
  - `Badge`
  - `Button`
  - `Input`
  - `Select`
  - `Dialog` only if needed for reserved handoff or confirmation UX
- Do not add a grid library, charting package, or data-table dependency for this story.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/tests/procurement-officer-dashboard.test.ts`
  - `webapp/tests/run-tests.ts`
- Expected new files (recommended):
  - `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionsWorkspace.tsx`
  - `webapp/lib/procurement-officer/submissions.ts`
  - `webapp/convex/functions/procurementOfficerSubmissions.ts`
  - `webapp/tests/procurement-officer-submissions.test.ts`

### Testing Requirements

- Add pure helper tests for:
  - oldest-first default ordering
  - alternate sort keys
  - filter-by-status behavior
  - filter-by-department behavior
  - date-range filtering
  - empty-state derivation
  - status-label truthfulness
  - nullable timestamp fallback behavior
  - fiscal-year-empty versus globally-empty state derivation
  - modal-query-parameter namespacing
- Add integration-oriented tests for:
  - submissions workspace modal or route normalization
  - dashboard future-panel replacement with live submissions queue state
  - tenant-safe queue shaping from plan and department inputs
  - queue rows excluding draft plans
  - stale-row handoff fallback to the queue
  - duplicate-toast suppression during live-update replay
- Keep PO role-route protection intact for any new queue navigation path or modal contract.

### Git Intelligence Summary

- Recent git history shows the team is actively expanding Procurement Officer workspaces inside the existing `/po` shell rather than creating disconnected feature pages.
- `4c1f4fe` added the Procurement Officer Requests Workspace and its tests, which is the closest implementation pattern for Story 6.3 because it already combines Convex reads, filter controls, status badges, and operational-table actions inside the dashboard shell.
- `db5dcf2` added catalog request functionality and supporting DU/PO request flows, reinforcing the repo’s preference for focused helper modules, tenant-scoped Convex functions, and deterministic Node-based tests.
- Inference from current repo direction:
  - Story 6.3 should mirror the requests-workspace pattern for queue UX,
  - reuse dashboard modal navigation,
  - and avoid a larger routing rewrite.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first tenant and role enforcement
  - shadcn/ui plus Tailwind styling
  - `sonner` for transient user feedback
  - no client-trusted tenant identifiers
- Where older planning artifacts conflict with the current repo shape, prefer the live repo structure and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 6 Source](../epic-06-plan-submission-review.md)
- [Epic 5 Story 5.1](../../epic5/stories/5-1-du-dashboard-plan-status.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [Current PO Page](../../../../../webapp/app/(app)/po/page.tsx)
- [Current PO Dashboard](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [Current PO Dashboard Query](../../../../../webapp/convex/functions/procurementOfficerDashboard.ts)
- [Current PO Dashboard Snapshot Builder](../../../../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
- [Current PO Dashboard Navigation Helpers](../../../../../webapp/lib/procurement-officer/dashboard.ts)
- [Current PO Requests Workspace](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerRequestsWorkspace.tsx)
- [Current Plans Functions](../../../../../webapp/convex/functions/plans.ts)
- [Current Convex Schema](../../../../../webapp/convex/schema.ts)
- [Current PO Dashboard Tests](../../../../../webapp/tests/procurement-officer-dashboard.test.ts)
- [Current Test Runner](../../../../../webapp/tests/run-tests.ts)
- [Webapp Package Versions](../../../../../webapp/package.json)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story sources:
  - `_bmad-output/implementation-artifacts/epics/epic6/epic-06-plan-submission-review.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/app/(app)/po/page.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerRequestsWorkspace.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionsWorkspace.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionReviewPlaceholder.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/submissions.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/convex/functions/procurementOfficerSubmissions.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/schema.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/tests/procurement-officer-dashboard.test.ts`
  - `webapp/tests/procurement-officer-submissions.test.ts`
  - `webapp/tests/run-tests.ts`
- Git context:
  - `git log -5 --oneline`

### Completion Notes List

- 2026-04-19: Created the implementation-ready story artifact for `6-3-po-submission-queue`.
- 2026-04-19: Anchored the story to the live repo state where submission monitoring is currently an intentional placeholder inside the Procurement Officer dashboard.
- 2026-04-19: Scoped the story around the existing canonical `plans` table and dashboard-modal architecture so the queue can land without inventing later-story review semantics.
- 2026-04-19: Updated sprint tracking so `6-3-po-submission-queue` is ready for development.
- 2026-04-20: Replaced the PO dashboard submission placeholder with a live submissions workspace contract and modal-backed `/po/submissions` deep link.
- 2026-04-20: Added tenant-scoped submissions helpers and Convex queries covering row shaping, sort and filter behavior, empty states, notification de-duplication, and stale review-target fallback.
- 2026-04-20: Added deterministic regression coverage for queue routing, dashboard panel state, queue helpers, and reserved `/po/review` handoff behavior.
- 2026-04-20: Fixed review findings by preserving fiscal-year queue state across dashboard, submissions, and review routes; suppressing false "new submission" toasts on initial load and view-only changes; and hardening review-target resolution against malformed plan IDs.

## File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/app/(app)/po/review/page.tsx`
- `webapp/app/(app)/po/submissions/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/procurementOfficerDashboard.ts`
- `webapp/convex/functions/procurementOfficerSubmissions.ts`
- `webapp/lib/procurement-officer/dashboard-snapshot.ts`
- `webapp/lib/procurement-officer/dashboard-search.ts`
- `webapp/lib/procurement-officer/dashboard.ts`
- `webapp/lib/procurement-officer/submissions.ts`
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionReviewPlaceholder.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionsWorkspace.tsx`
- `webapp/tests/procurement-officer-dashboard.test.ts`
- `webapp/tests/procurement-officer-submissions.test.ts`
- `webapp/tests/run-tests.ts`

## Change Log

- 2026-04-20: Implemented Story 6.3 by shipping a live Procurement Officer submissions queue, reserved review-route handoff, tenant-safe Convex query layer, and regression coverage for queue behavior and dashboard routing.
- 2026-04-20: Cleared code-review findings by hardening submission-review lookup, preserving selected fiscal-year state in shareable URLs, and restricting queue toasts to genuinely new reactive arrivals.

### Story Completion Status

- Story ID: `6.3`
- Story Key: `6-3-po-submission-queue`
- Output File: `_bmad-output/implementation-artifacts/epics/epic6/stories/6-3-po-submission-queue.md`
- Final Status: `done`
- Completion Note: `Story 6.3 is complete after code-review fixes for shareable fiscal-year queue state, truthful live-notification behavior, hardened review-target routing, and passing regression coverage.`
