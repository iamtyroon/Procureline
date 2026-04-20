# Story 6.4: Plan Review Interface

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to review submitted plan details with comparison tools,
so that I can make informed approval or rejection decisions.

## Acceptance Criteria

1. [Given] a Procurement Officer opens `/po/review?planId=...` from the live submissions queue [When] the target plan exists, belongs to the active tenant, and is not in `draft` status [Then] the current Story 6.3 placeholder is replaced with a real review workspace that shows department, fiscal year, current plan status, submitted timestamp, item count, and total amount from canonical plan data [And] the review header resolves department context truthfully even if the linked department record is missing or archived by falling back to canonical captured plan metadata instead of crashing or rendering blanks [And] the route keeps the existing back-to-queue contract and preserved query state from Story 6.3 (FR53).
2. [Given] a Procurement Officer lands on `/po/review` with a missing, malformed, withdrawn, or cross-tenant `planId` [When] the review target check runs [Then] the user is redirected back to the submissions queue with a truthful notice [And] the selected fiscal year plus namespaced queue filters from Story 6.3 remain intact instead of being dropped or replaced with a broken review surface.
3. [Given] a submitted or reviewed plan has a valid `workspaceState` [When] the review workspace loads [Then] it renders the existing Blockly-based plan hierarchy in read-only mode using shared renderer/runtime code instead of a second custom tree implementation [And] categories, items, quarterly quantities, totals, and summary rollups remain visible [And] no edit affordance or draft autosave path is active in this review flow (FR53).
4. [Given] the plan's detailed Blockly snapshot is missing, stale, or cannot hydrate safely because required catalog metadata, categories, or items were archived after submission [When] the review workspace renders [Then] it falls back to persisted summary data such as `categorySummaries`, `itemCount`, and `estimatedBudgetUsed` with an explicit "detailed block rendering unavailable" state [And] the user still gets a truthful reviewable summary instead of an exception, blank screen, or fake reconstructed plan.
5. [Given] a Procurement Officer opens a plan for the first time in the review flow [When] the review target resolves successfully, including concurrent first-open attempts by multiple Procurement Officers [Then] the backend records canonical review-start metadata such as `reviewStartedAt` and first-reviewer identity in a compare-and-set, tenant-safe, idempotent way [And] repeated route visits, page refreshes, or losing the concurrency race do not overwrite the original metadata [And] that metadata becomes the source of truth for later withdrawal-blocking and "under review" behavior owned by Stories 6.5 through 6.7 rather than client-only state (FR53, forward compatibility with FR49c and FR57).
6. [Given] a previous submission baseline exists for the same department plan [When] the Procurement Officer opens the comparison view [Then] the UI highlights added items, removed items, quantity changes, and category/total deltas between the current review target and the prior submitted baseline [And] the prior baseline comes from an immutable submission snapshot captured before later plan mutations rather than from live mutable plan records [And] if no previous-submission baseline exists yet, the comparison tab shows an honest empty state instead of fabricating diffs (FR53a).
7. [Given] a previous-fiscal-year plan or snapshot exists for the same department [When] the Procurement Officer opens the year-over-year comparison view [Then] the UI shows category and total deltas grounded in canonical plan data for the prior fiscal year [And] the comparison safely supports either a full `workspaceState` baseline or a summary-only historical baseline such as `categorySummaries` without crashing or hiding valid deltas [And] if no prior fiscal-year baseline exists, the UI explains that comparison is unavailable for this department instead of implying historical data exists (FR53b).
8. [Given] Procurement Officers need private collaboration notes [When] one Procurement Officer adds an internal comment in the review workspace [Then] the note is saved in a tenant-scoped internal-review store, includes author and timestamp metadata, appears reactively to other Procurement Officers reviewing the same plan, and never appears in DU-facing queries or views [And] blank or whitespace-only comments are rejected by the canonical mutation contract so audit history stays meaningful (FR53c, NFR-S1).
9. [Given] a Procurement Officer identifies specific categories or items that may need revision [When] they click rows, blocks, or summary entries inside the review workspace [Then] the UI supports flag-candidate selection and a visible review side panel summarizing the current selection [And] the selection is revalidated whenever comparison tabs, summary fallback mode, or rendered node sets change so stale targets cannot silently point at the wrong item [And] this story does not yet create DU-visible revision flags, approval decisions, or rejection outcomes owned by Story 6.5.
10. [Given] Story 6.4 is the review-surface story rather than the decision story [When] implementation completes [Then] the review route mutates only canonical review metadata and internal notes [And] it does not approve, reject, request revision, rewrite DU plan content, or fabricate `under_review` status labels in the queue before Story 6.5 introduces real decision logic.
11. [Given] the current repo shipped Story 6.3 before Stories 6.1, 6.2, 6.5, and 6.6 [When] Story 6.4 is implemented [Then] it introduces the smallest canonical comparison source needed for current and future diff behavior using forward-compatible naming and schema design [And] it does not depend on ad hoc client snapshots, duplicated summary blobs, or review-only shadow plan models that later stories would have to unwind.
12. [Given] this story touches protected routes, live Convex data, a read-only Blockly surface, and internal collaboration state [When] implementation is complete [Then] the repo includes deterministic automated coverage for review-target resolution, tenant-safe access, idempotent review-start tracking, read-only workspace behavior, summary fallback, comparison empty states, internal comment visibility, and no-autosave/no-status-mutation regressions.

## Tasks / Subtasks

- [x] Task 1: Replace the reserved `/po/review` placeholder with a real Procurement Officer review workspace (AC: 1, 2, 3, 4, 9, 10)
  - [x] Replace `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionReviewPlaceholder.tsx` with a production component such as `ProcurementOfficerPlanReviewWorkspace.tsx` instead of layering review logic on top of the existing placeholder card copy.
  - [x] Keep `webapp/app/(app)/po/review/page.tsx` as the canonical review route entry point and preserve the Story 6.3 queue-to-review handoff shape rather than introducing a second review shell.
  - [x] Reuse the existing queue return-path helpers in `webapp/lib/procurement-officer/submissions.ts` so the Back action continues to preserve `poFiscalYear` and namespaced queue filters.
  - [x] Resolve review-header department context from the joined department record when available, but fall back to captured plan metadata such as `departmentName` or an explicit archived-department label when the join target no longer exists.
  - [x] Apply the same desktop-required fallback strategy already used by the Procurement Officer dashboard if the route is reached below the supported desktop width.

- [x] Task 2: Add a tenant-safe review query/mutation seam for live review data and idempotent review-start tracking (AC: 1, 2, 5, 8, 10, 11, 12)
  - [x] Reuse or extend `webapp/convex/functions/procurementOfficerSubmissions.ts` for stale-target resolution only if it remains cohesive; otherwise add a focused module such as `webapp/convex/functions/procurementOfficerPlanReview.ts`.
  - [x] Guard all review reads and writes with `requireTenantRole(ctx, ["procurement_officer"])` and derive tenant scope from auth identity rather than client-provided values.
  - [x] Normalize the incoming `planId` with `ctx.db.normalizeId("plans", args.planId)` and keep the existing redirect-to-queue behavior for malformed or unavailable targets.
  - [x] Add canonical review metadata on the plan model or a clearly-related review record, at minimum supporting `reviewStartedAt` and reviewer identity in a way later stories can reuse without renaming or migrating the contract.
  - [x] Ensure the review-start write uses first-writer-wins semantics so repeated route visits, page refreshes, reactive re-renders, or simultaneous first-open attempts do not overwrite the original start time or reviewer identity or create duplicate events.

- [x] Task 3: Reuse the existing plan workspace and Blockly view-mode infrastructure instead of building a second renderer (AC: 3, 4, 5, 10, 12)
  - [x] Prefer extending the shared workspace context in `webapp/convex/functions/plans.ts` or extracting a shared helper module so Procurement Officer review and Department User viewing do not fork into incompatible plan-shaping pipelines.
  - [x] Populate the shared context with `meta.actor = "procurement_officer"` and `mode = "view"` so the existing validator and renderer contracts stay consistent with the live repo's direction.
  - [x] Reuse `webapp/src/components/blockly/BlocklyWorkspace.tsx` with `editorMode="view"` and the existing `buildDepartmentUserBlocklyInjectionOptions` read-only path instead of re-parsing `workspaceJson` into a bespoke table/tree renderer.
  - [x] Remove or hide Department User-specific toolbar actions such as submit/request-item/edit flows from the Procurement Officer review surface while preserving read-only navigation, expand/collapse behavior, and summary visibility.
  - [x] If additional raw category/item extraction is needed for side panels or diffs, promote a narrow export from the existing Blockly calculation helpers instead of creating a third independent workspace parser.
  - [x] Detect catalog-hydration gaps caused by archived categories or items before mounting the detailed Blockly surface and switch cleanly into the summary fallback instead of letting the renderer fail mid-load.

- [x] Task 4: Introduce a forward-compatible comparison source and pure diff helpers for previous-submission and previous-fiscal-year views (AC: 6, 7, 11, 12)
  - [x] Add a pure helper module such as `webapp/lib/procurement-officer/review.ts` for baseline selection, item/category diff shaping, tab-state normalization, and comparison empty-state messaging so the logic is testable outside React.
  - [x] Do not rely on client-only cached snapshots for diff behavior; if a new table is needed, name and shape it for future story reuse, for example a canonical submission-history or snapshot store compatible with Stories 6.1 and 6.6.
  - [x] Capture the current submission baseline immutably at submit time or review-start time before any later plan mutation can change the source data used by previous-submission comparisons.
  - [x] Support previous-submission comparison when a prior baseline exists for the same plan lifecycle, including item additions, removals, quantity changes, and category/total deltas.
  - [x] Support previous-fiscal-year comparison for the same department using canonical plan or snapshot data, falling back to an honest empty state when no historical record exists.
  - [x] Shape comparison helpers so they can diff either detailed `workspaceState` baselines or summary-only historical baselines without assuming every record has full Blockly JSON.
  - [x] Keep comparison calculations grounded in canonical plan identifiers and normalized quantities so archived catalog items and renamed categories do not silently disappear from diffs.

- [x] Task 5: Add internal comment persistence and flag-candidate selection without prematurely implementing approval/rejection flows (AC: 8, 9, 10, 12)
  - [x] Add a canonical internal-review comments store such as `planReviewComments` with tenant scope, plan scope, author metadata, timestamps, and explicit internal visibility semantics.
  - [x] Build a review side rail or tabbed panel that shows internal comments reactively and allows Procurement Officers to add notes using `sonner` for transient success/error feedback.
  - [x] Reject blank or whitespace-only internal comments in both UI validation and Convex mutation validation so empty notes cannot enter the review log.
  - [x] Support category/item flag-candidate selection in the review UI and keep that state visible in a dedicated side panel so Story 6.5 can attach decision workflows cleanly.
  - [x] Revalidate selected flag-candidate targets against the currently visible node set whenever tabs, baselines, or summary-fallback state change, and surface a stale-selection notice instead of silently keeping invalid selections.
  - [x] Keep flag-candidate state internal to Procurement Officers for this story; do not write DU-visible revision requests, flagged-item highlights, or plan decisions yet.
  - [x] If review-specific query params or local persistence keys are introduced, namespace them away from the existing `poSubmissions*` keys to avoid breaking queue and dashboard deep links.

- [x] Task 6: Add deterministic regression coverage for review routing, read-only behavior, comparisons, and comment visibility (AC: 2, 3, 4, 5, 6, 7, 8, 10, 11, 12)
  - [x] Add a test file such as `webapp/tests/procurement-officer-review.test.ts` covering stale-plan redirects, queue-return preservation, review-start idempotency under concurrent first-open attempts, archived-department fallback, and internal-comment authorization.
  - [x] Add pure tests for diff shaping, immutable previous-submission baseline selection, comparison empty states, summary fallback when `workspaceState` is unavailable, archived-catalog hydration fallback, summary-only prior-year baselines, stale flag-selection revalidation, and any namespaced review search-param normalization in `webapp/lib/procurement-officer/review.ts`.
  - [x] Add coverage proving the review route reuses read-only Blockly/view-mode behavior and does not trigger DU draft save or status-mutating logic when the Procurement Officer is only viewing a plan.
  - [x] Add coverage proving blank internal comments are rejected at the canonical mutation boundary.
  - [x] Extend route-protection regression coverage so `/po/review` remains Procurement Officer-only alongside `/po/submissions`.
  - [x] Update `webapp/tests/run-tests.ts` if a new review-focused test suite is introduced.

## Dev Notes

### Story Foundation

- Epic 6 positions Story 6.4 as the Procurement Officer's actual review workspace immediately after Story 6.3's submission queue.
- The delivery intent is not another queue card or placeholder. The point of Story 6.4 is a usable read-only plan-review surface with trustworthy comparisons and private review collaboration before Story 6.5 adds approval/rejection actions.
- Story 6.4 must therefore stay sharply scoped around review context, not decision outcomes:
  - Story 6.4 owns: read-only plan rendering, comparison views, review-start tracking, internal comments, and flag-candidate selection.
  - Story 6.5 owns: approve/reject/revision-request mutations, DU-facing decision messages, and outcome transitions.
  - Story 6.6 owns: DU-side correction/resubmission flow.
  - Story 6.7 owns: end-to-end DU status visibility.

### Previous Story Intelligence

- Story 6.3 already created the live submissions queue and reserved `/po/review` handoff contract.
- The queue now uses canonical `plans` data, preserves fiscal-year context in namespaced search params, and deliberately avoids fabricating `Under Review` or decision states before later stories introduce canonical support.
- `webapp/lib/procurement-officer/submissions.ts` already provides:
  - namespaced query keys (`poSubmissions*`)
  - `buildProcurementOfficerSubmissionReviewHref(...)`
  - `buildProcurementOfficerSubmissionModalPath(...)`
  - stale-route fallback patterns that Story 6.4 should preserve.
- `webapp/convex/functions/procurementOfficerSubmissions.ts` already resolves a tenant-safe review target and redirects invalid targets back to the queue. Story 6.4 should extend this seam, not bypass it.
- The live queue and placeholder already assume joined display metadata can be absent on older or archived records. Story 6.4 should keep review rendering resilient when department joins no longer resolve.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/po/review/page.tsx` currently renders `ProcurementOfficerSubmissionReviewPlaceholder`.
- `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionReviewPlaceholder.tsx` already:
  - reads `planId` from search params,
  - calls `api.functions.procurementOfficerSubmissions.getProcurementOfficerSubmissionReviewTarget`,
  - redirects invalid targets back to the submission queue with a preserved notice and preserved queue state,
  - shows only a reserved Story 6.4 card when the plan exists.
- `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionsWorkspace.tsx` already pushes into `/po/review` with preserved `poFiscalYear` and `poSubmissions*` params.
- `webapp/convex/functions/plans.ts` already contains a shared `planWorkspaceContextValidator` whose `meta.actor` union includes `"procurement_officer"` and whose `mode` union already supports `"view"`, but the live query implementations are still Department User-only.
- `webapp/src/components/blockly/BlocklyWorkspace.tsx` already supports `editorMode: "edit" | "view"`.
- `webapp/lib/blockly/workspace-runtime.ts` already maps `editorMode === "view"` to `readOnly: true`, while `BlocklyWorkspace` already suppresses queued workspace saves when `editorMode !== "edit"`.
- `webapp/lib/blockly/du-workspace-calculations.ts` and `webapp/lib/blockly/workspace-save.ts` already know how to:
  - derive plan summaries from persisted Blockly workspace records,
  - fall back to summary-only representations,
  - preserve category rollups, totals, budget state, and validation context.

### Current Schema Reality And Gaps

- The current `plans` table in `webapp/convex/schema.ts` already contains:
  - `tenantId`
  - `departmentId`
  - `fiscalYear`
  - `status` (`draft`, `submitted`, `rejected`, `approved`)
  - `itemCount`
  - `estimatedBudgetUsed`
  - `selectedCategoryIds`
  - `categorySummaries`
  - `workspaceState`
  - `rejectionComment`
  - `submittedAt`
  - `approvedAt`
  - `rejectedAt`
- The current schema does **not** yet contain:
  - `reviewStartedAt`
  - reviewer identity fields for canonical "under review" tracking
  - internal review comments storage
  - immutable submission-history or snapshot records for previous-submission diffs
  - a dedicated revision-flag or review-selection store
- Story 6.4 must therefore add only the smallest canonical review metadata needed for truthful review behavior and future compatibility. It should not create a review-only shadow plan model that duplicates the canonical `plans` table.
- If the review experience needs department display names after archival or deletion, capture or reuse canonical plan-level metadata instead of trusting every live department join to exist forever.

### Preferred Review Architecture

- Keep `/po/review` as the only canonical Procurement Officer plan-review route.
- Replace the placeholder component rather than stacking more logic inside it.
- Reuse the queue's existing target-resolution helper so malformed or stale review links continue to return gracefully to the queue.
- Prefer one shared plan-shaping seam for DU and PO read-only views:
  - extend `plans.ts` shared context support for Procurement Officers, or
  - extract a shared helper used by both DU and PO query modules.
- Reuse `BlocklyWorkspace` in `view` mode as the plan renderer of record.
- Reuse the existing Blockly summary and fallback helpers so summary-only rendering and degraded states stay consistent with the live repo.
- Treat archived catalog entities as an expected degradation path: validate whether detailed Blockly hydration is still safe before mounting the renderer and prefer truthful summary fallback when it is not.
- If a new comments table is introduced, keep it canonical and plainly named, for example `planReviewComments`, instead of hiding review state inside opaque JSON blobs on `plans`.

### Review Comparison Guidance

- Previous-submission comparison is currently blocked by missing immutable submission history in the live repo.
- Story 6.4 should solve that truthfully, not cosmetically:
  - if a new canonical snapshot store is needed now, choose naming and fields that Stories 6.1 and 6.6 can reuse directly;
  - capture the baseline before later mutations can change the same plan record, so "previous submission" means an immutable historical submission rather than "whatever the plan looks like now";
  - if no prior baseline exists yet for an existing tenant, show a truthful empty comparison state;
  - never fabricate diffs from client-only memory or local browser state.
- Previous-fiscal-year comparison should prefer canonical prior-year plans for the same department and fiscal year lineage.
- Comparison helpers must accept both detailed Blockly baselines and summary-only historical baselines so older records remain reviewable.
- If raw category/item extraction from `workspaceState.workspaceJson` is required for diffing, promote a narrow shared helper from the existing Blockly calculation modules instead of writing a second JSON traversal with different rules.

### UX And Interaction Requirements

- Follow the UX specification's PO journey for plan review:
  - dashboard or queue indicates pending review,
  - PO opens a department,
  - sees a read-only plan,
  - expands and collapses categories,
  - checks totals and items,
  - adds comments or prepares decision context.
- Keep the review surface desktop-first and scannable:
  - header context for department, fiscal year, status, timestamps, totals
  - main read-only plan surface
  - comparison tabs or segmented views
  - internal-comment and flag-candidate side rail
- Reuse the existing shadcn/ui visual family used by the Procurement Officer dashboard and queue. Do not introduce a separate dashboard framework or a second visual language.
- Keep empty states explicit:
  - no previous submission baseline
  - no previous fiscal year baseline
  - no internal comments yet
  - detailed workspace unavailable, summary-only fallback
- If review context changes make a previously selected flag target invalid, surface that clearly and clear or quarantine the stale selection rather than silently retargeting it.
- If decision buttons are shown for future handoff context, they must be clearly reserved or routed into Story 6.5 contracts rather than mutating review state in Story 6.4.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`, not only older planning summaries:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - Blockly `^12.5.1`
  - `date-fns` `^2.30.0`
  - `sonner` `^2.0.7`
  - `lucide-react` `^0.577.0`
- Keep all tenant and role enforcement in Convex.
- Keep page files thin and interactive work inside focused client components.
- Respect the existing App Router structure inside `webapp/app/(app)/po/...`.
- Do not add a parallel REST endpoint for review data that already lives in Convex.
- Respect the project's audit and tenant-isolation expectations when introducing review metadata or comments.

### Library And Framework Requirements

- Next.js / React
  - `useSearchParams` in App Router remains a client hook returning read-only search params. If Story 6.4 introduces additional query-driven review tabs or filters in a statically rendered tree, wrap the client subtree using it in a `Suspense` boundary per current Next.js guidance.
  - Keep the review page aligned with the repo's thin-route pattern.
- Convex
  - Use `useQuery` for live review-target reads and internal-comment streams.
  - Use `useMutation` for internal comments and review-start writes.
  - Preserve the live queue's tenant-safe query patterns and index-driven reads.
- Blockly
  - Use official read-only workspace support through the existing `editorMode="view"` path and `readOnly` injection option.
  - Keep toolbox definitions JSON-based, matching current Blockly guidance and the existing repo runtime.
- UI stack
  - Use shadcn/ui primitives already present in the repo: `Card`, `Badge`, `Button`, `Tabs`, `Dialog`, `Textarea`, `Table`, `ScrollArea`, `Separator`, and related layout primitives.
  - Use `sonner` for transient save/error feedback.
  - Use `lucide-react` icons already established in the `/po` shell.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/po/review/page.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionReviewPlaceholder.tsx`
  - `webapp/convex/functions/procurementOfficerSubmissions.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/schema.ts`
  - `webapp/tests/run-tests.ts`
- Expected new files (recommended):
  - `webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewWorkspace.tsx`
  - `webapp/lib/procurement-officer/review.ts`
  - `webapp/tests/procurement-officer-review.test.ts`
- Optional new focused backend module if shared cohesion remains clean:
  - `webapp/convex/functions/procurementOfficerPlanReview.ts`

### Testing Requirements

- Add pure tests for:
  - previous-submission diff shaping
  - previous-fiscal-year diff shaping
  - comparison empty states
  - summary fallback when `workspaceState` is unavailable
  - summary fallback when archived catalog entities prevent safe detailed hydration
  - immutable snapshot selection for previous-submission comparisons
  - summary-only prior-year baseline handling
  - stale flag-selection revalidation
  - any namespaced review search-param normalization
- Add backend/query tests for:
  - invalid or cross-tenant `planId` redirect behavior
  - idempotent `reviewStartedAt` behavior under concurrent first-open attempts
  - internal-comment visibility limited to Procurement Officers in the same tenant
  - blank-comment rejection at the canonical mutation boundary
  - no review target for `draft` plans
- Add route/workspace regression tests for:
  - `/po/review` staying Procurement Officer-only
  - preserved queue return params
  - archived-department header fallback
  - read-only workspace path not scheduling draft saves
  - no plan-status mutation during review-only loading

### Git Intelligence Summary

- Recent git history shows the team is actively expanding Procurement Officer functionality inside the existing `/po` shell rather than creating disconnected feature pages.
- `4c1f4fe` added the Procurement Officer Requests Workspace and deterministic tests, reinforcing the existing pattern of:
  - thin App Router pages
  - focused feature components
  - helper modules in `lib/`
  - Convex-first protected reads/writes
  - Node-based regression tests
- `db5dcf2` added catalog request functionality and approval flows, which is directly relevant to Story 6.4 because it demonstrates how PO-only internal workflow state should stay tenant-scoped, explicit, and auditable.
- Inference from current repo direction:
  - Story 6.4 should extend the current PO route and workspace ecosystem,
  - reuse existing queue and review-target infrastructure,
  - and avoid a larger routing rewrite or a separate review application.

### Latest Tech Information

- Verified on 2026-04-20 against current official documentation and the live repo:
  - Next.js App Router documentation currently describes `useSearchParams` as a client hook returning read-only query state and recommends `Suspense` boundaries around client subtrees that depend on it during static rendering.
  - Convex React documentation continues to position `useQuery` as the reactive subscription primitive: it returns `undefined` while first loading and rerenders automatically when underlying query data changes. That is the right fit for live internal comments and review-target updates.
  - Blockly official documentation continues to support read-only workspaces through injected configuration options and runtime workspace read-only APIs, which aligns with the repo's existing `editorMode="view"` path.
  - Blockly documentation also continues to recommend JSON toolbox definitions, which matches the existing workspace runtime helper and avoids introducing XML-only review tooling.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first tenant and role enforcement
  - shadcn/ui + Tailwind styling
  - `sonner` for transient user feedback
  - audit-aware state changes
  - no client-trusted tenant identifiers
- Where older planning artifacts conflict with the current repo shape, prefer the live repo and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 6 Source](../epic-06-plan-submission-review.md)
- [Previous Story 6.3](./6-3-po-submission-queue.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [Current PO Review Page](../../../../../webapp/app/(app)/po/review/page.tsx)
- [Current PO Submissions Page](../../../../../webapp/app/(app)/po/submissions/page.tsx)
- [Current PO Dashboard](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [Current PO Review Placeholder](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerSubmissionReviewPlaceholder.tsx)
- [Current PO Submissions Workspace](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerSubmissionsWorkspace.tsx)
- [Current PO Submission Helpers](../../../../../webapp/lib/procurement-officer/submissions.ts)
- [Current Plans Functions](../../../../../webapp/convex/functions/plans.ts)
- [Current PO Submissions Functions](../../../../../webapp/convex/functions/procurementOfficerSubmissions.ts)
- [Current Blockly Workspace](../../../../../webapp/src/components/blockly/BlocklyWorkspace.tsx)
- [Current Blockly Runtime Helper](../../../../../webapp/lib/blockly/workspace-runtime.ts)
- [Current Blockly Summary Helpers](../../../../../webapp/lib/blockly/du-workspace-calculations.ts)
- [Current Workspace Save Helpers](../../../../../webapp/lib/blockly/workspace-save.ts)
- [Current Convex Schema](../../../../../webapp/convex/schema.ts)
- [Current PO Dashboard Tests](../../../../../webapp/tests/procurement-officer-dashboard.test.ts)
- [Current PO Submissions Tests](../../../../../webapp/tests/procurement-officer-submissions.test.ts)
- [Current Test Runner](../../../../../webapp/tests/run-tests.ts)
- [Webapp Package Versions](../../../../../webapp/package.json)
- [Next.js useSearchParams Docs](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Convex React Docs](https://docs.convex.dev/client/react/)
- [Convex Overview Reactivity Docs](https://docs.convex.dev/understanding/)
- [Blockly Workspace Creation Docs](https://developers.google.com/blockly/guides/get-started/workspace-creation)
- [Blockly Read-Only Workspace API](https://developers.google.com/blockly/reference/js/blockly.workspace_class.setisreadonly_1_method)
- [Blockly Toolbox Docs](https://developers.google.com/blockly/guides/configure/web/toolbox)

## Dev Agent Record

### Agent Model Used

gpt-5

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Dev-story workflow: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Dev-story instructions: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Dev-story checklist: `_bmad/bmm/workflows/4-implementation/dev-story/checklist.md`
- Story sources:
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-4-plan-review-interface.md`
  - `_bmad-output/implementation-artifacts/epics/epic6/stories/6-3-po-submission-queue.md`
  - `_bmad-output/project-context.md`
- Implementation sources:
  - `webapp/app/(app)/po/review/page.tsx`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/procurementOfficerPlanReview.ts`
  - `webapp/convex/schema.ts`
  - `webapp/lib/procurement-officer/review.ts`
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewWorkspace.tsx`
  - `webapp/tests/procurement-officer-review.test.ts`
  - `webapp/tests/run-tests.ts`
- Validation commands:
  - `cmd /c npx convex codegen --typecheck disable`
  - `cmd /c npm test`
  - `cmd /c npm run lint`

### Completion Notes List

- 2026-04-20: Replaced the `/po/review` placeholder route with a real Procurement Officer review workspace that preserves Story 6.3 queue return state and desktop-only fallback behavior.
- 2026-04-20: Added canonical review metadata fields, immutable submission snapshots, and tenant-scoped internal review comments so review tracking and comparisons use durable server-side records.
- 2026-04-20: Reused the shared Blockly view-mode surface with truthful summary fallback when archived catalog metadata prevents safe detailed hydration.
- 2026-04-20: Added pure review helpers for baseline selection, comparison shaping, render-state fallback, comment normalization, and selection revalidation.
- 2026-04-20: Added deterministic automated coverage for comparison logic, summary fallback, review-start idempotency, blank-comment rejection, and stale selection revalidation.
- 2026-04-20: Validation passed via `npx convex codegen --typecheck disable`, `npm test`, and `npm run lint`; lint still reports one pre-existing warning in `webapp/src/components/blockly/BlocklyWorkspace.tsx` for `react-hooks/exhaustive-deps`.
- 2026-04-20: Review target selection is currently driven by summary and comparison rows; direct Blockly block-click selection was not added in this story and remains a follow-up consideration if stricter parity is required.

### File List

- `webapp/app/(app)/po/review/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/plans.ts`
- `webapp/convex/functions/procurementOfficerPlanReview.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/procurement-officer/review.ts`
- `webapp/src/components/procurement-officer/ProcurementOfficerPlanReviewWorkspace.tsx`
- `webapp/tests/procurement-officer-review.test.ts`
- `webapp/tests/run-tests.ts`
- `_bmad-output/implementation-artifacts/epics/epic6/stories/6-4-plan-review-interface.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-20: Implemented the Procurement Officer review workspace, including read-only Blockly rendering, comparison tabs, review header context, internal comments, and a review side panel for flag-candidate selection.
- 2026-04-20: Added canonical review backend support with immutable submission snapshots, first-writer-wins review-start metadata, tenant-scoped comments, and shared workspace-shaping exports for PO review queries.
- 2026-04-20: Added review helper tests and wired the new suite into the deterministic test runner, then regenerated Convex API types and revalidated lint/test coverage.

### Story Completion Status

- Story ID: `6.4`
- Story Key: `6-4-plan-review-interface`
- Output File: `_bmad-output/implementation-artifacts/epics/epic6/stories/6-4-plan-review-interface.md`
- Final Status: `review`
- Completion Note: `Implemented and validated; ready for code review with one noted follow-up around optional direct Blockly block-click selection parity.`
