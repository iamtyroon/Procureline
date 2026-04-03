# Story 5.6: Budget Meter & Calculations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want the Blockly workspace to show live budget and compliance posture as I edit quantities,
so that I can correct my plan before submission and trust that every saved total matches the real procurement rules.

## Acceptance Criteria

1. [Given] a Departmental User opens an editable or read-only Blockly plan workspace [When] the editor header renders [Then] the budget surface shows the department's total allocation, amount used, amount remaining, and utilization percentage from live plan plus department data [And] it keeps the prototype's header-centered budget rhythm instead of moving budget feedback into a detached page or modal (FR38, FR45).
2. [Given] an item quantity, item price, or category composition changes inside the workspace [When] recalculation runs [Then] item totals, per-quarter category subtotals, category grand totals, and department total update in the same interaction cycle [And] the budget header reflects the new department total without waiting for a manual save (FR44, NFR-P3).
3. [Given] the used amount is below 80% of budget [When] the budget meter updates [Then] it remains in a safe visual state with supportive copy and no warning banner (FR45, FR46).
4. [Given] budget utilization reaches 80% or higher but remains below 100% [When] the meter updates [Then] the UI transitions into a warning state with yellow styling plus explicit advisory copy such as `Approaching budget limit` [And] the warning is not conveyed by color alone (FR46, NFR-A1).
5. [Given] budget utilization reaches or exceeds 100% [When] recalculation completes [Then] the workspace enters an over-budget state with red styling, a visible warning banner, and the computed `Budget exceeded by [amount]` message [And] the state is derived from the same rollup data that drives the header totals instead of a second competing calculation path (FR46, FR39d).
6. [Given] a Departmental User removes items or reduces quantities [When] the department total falls back below the threshold [Then] the warning banner and over-budget styling clear automatically and the meter returns to the correct safe or warning state without requiring a page refresh (FR46).
7. [Given] the department budget allocation is null, zero, or otherwise unusable [When] the workspace budget header renders [Then] the UI shows a truthful unallocated-budget state, avoids divide-by-zero math, and does not imply that planning is within budget merely because usage is low (FR38c, current repo behavior).
8. [Given] the shared editor toolbar still contains a reserved submit affordance ahead of Story 6.1 [When] the plan is over budget or otherwise non-submittable [Then] that affordance reflects the blocked state honestly through disabled treatment and/or blocked-state labeling such as `Over Budget - Cannot Submit` [And] the visible copy maps to the real blocking reason instead of implying every disabled state is budget-related [And] Story 5.6 does not fake final submission behavior before the real submission workflow lands (FR39d, FR46, Story 6 dependency).
9. [Given] the workspace is saved, reopened, or rendered in read-only mode [When] the plan snapshot is loaded from Convex [Then] the budget summary shown in the editor remains consistent with the persisted `estimatedBudgetUsed` and category totals that the DU dashboard already consumes [And] Story 5.6 does not create a second unsynchronized budget summary model (FR38, current `/du` dashboard contract).
10. [Given] procurement items carry compliance flags from Story 4.8 [When] the DU views the planning workspace [Then] the editor shows live AGPO, PWD, and Local Content allocation values plus percentages and target-met or target-unmet status [And] the thresholds are 30%, 2%, and 40% respectively per the PRD and architecture guidance [And] zero-total plans or other zero-denominator cases resolve to a truthful non-NaN empty-state percentage contract.
11. [Given] a procurement item may carry multiple compliance flags [When] compliance totals are calculated [Then] the implementation treats each configured flag independently and documents that one eligible item can contribute to more than one compliance tally [And] duplicate or unsupported flags are normalized deterministically so the same item is never double-counted accidentally [And] the UI labels remain clear enough that operators do not confuse those parallel tallies with mutually exclusive budgeting buckets.
12. [Given] the current repo already exposes item compliance flags in catalog data [When] compliance logic is implemented for the DU workspace [Then] the math lives in one shared pure calculation layer that later submission and consolidation stories can reuse [And] the implementation does not duplicate AGPO or PWD or Local Content percentages inside multiple components, Convex functions, or ad hoc utility files (architecture centralized-calculation rule).
13. [Given] the DU workspace currently computes rollups only on the client [When] draft data is saved through Convex [Then] the backend duplicates or validates the persisted budget and compliance summaries from the serialized Blockly workspace payload instead of trusting client-supplied totals blindly [And] malformed, legacy-schema, negative, or non-numeric serialized values are rejected or normalized deterministically before persistence [And] invalid or stale client summaries are corrected or rejected deterministically (Epic 5 technical note, security guardrail).
14. [Given] the plan is open while catalog prices or item metadata change [When] the relevant selected catalog items update reactively [Then] the workspace recalculates budget and compliance posture against the refreshed item metadata and preserves the existing toast notice about catalog pricing changes instead of leaving stale totals on screen (FR34a, Story 5.2 current behavior).
15. [Given] the DU is in read-only mode because the plan is submitted, approved, or the session is no longer editable [When] the editor loads [Then] the user can still see the live budget and compliance summary for that saved plan [And] the story does not hide or degrade the informational calculations simply because editing is disabled (FR38, Story 5.2 read-only contract).
16. [Given] budget and compliance indicators are visible during block manipulation [When] accessibility needs apply [Then] warning state text, compliance pass/fail labels, progress semantics, and any live updates are exposed through accessible copy and screen-reader-friendly markup instead of relying on color, iconography, or animation alone [And] live-region announcements are limited to meaningful state changes instead of firing on every keystroke or recalculation tick (NFR-A1, UX accessibility guidance).
17. [Given] plans can reach the documented DU planning scale [When] recalculation runs repeatedly during editing [Then] the calculation path stays inside the performance budget for real-time feedback and avoids unnecessary workspace reinjection or full-route rerenders on each quantity change [And] threshold classification uses one shared currency-rounding contract so client and server do not disagree at 79.99%, 80%, 99.99%, or 100% boundaries (NFR-P2, NFR-P3, NFR-SC4).
18. [Given] Story 5.6 extends Story 5.2 rather than replacing it [When] implementation is complete [Then] the repo has deterministic automated coverage for budget thresholds, compliance percentages, server-side validation of saved summaries, unallocated states, read-only rendering, malformed-workspace handling, legacy persisted-plan fallback, and catalog-price-change recalculation so later stories can build on a stable calculation foundation.

## Tasks / Subtasks

- [x] Task 1: Refactor the DU workspace calculation core into a reusable, richer rollup pipeline (AC: 2-7, 9-18)
  - [x] Extend `webapp/lib/blockly/du-workspace-calculations.ts` so it returns a first-class budget plus compliance snapshot alongside item, category, and department rollups.
  - [x] Keep the current block-traversal logic grounded in the live `department_block -> category_block -> item_block` grammar from Story 5.2 instead of inventing a parallel plan representation only for this story.
  - [x] Add a normalization path that can derive the same rollup model from serialized Blockly JSON so the server can validate persisted summaries without depending on browser-only Blockly instances.
  - [x] Preserve the existing unallocated-budget safeguards and warning-state mapping, but add explicit advisory text and over-budget amount derivation to the returned state contract.
  - [x] Define one shared currency-rounding and threshold-classification contract so 80% and 100% boundary behavior matches between client and server calculations.
  - [x] Reject or normalize non-finite and negative quantity or price inputs before they can poison rollup totals.

- [x] Task 2: Introduce a shared compliance calculation module instead of scattering threshold math (AC: 10-13, 16, 18)
  - [x] Add a shared pure helper module such as `webapp/lib/procurement/compliance.ts` or an equivalently centralized path that owns AGPO, PWD, and Local Content thresholds and percentage calculations.
  - [x] Keep the compliance helper usable from both Blockly-editor code and future server-side validation paths.
  - [x] Make the multi-flag behavior explicit and deterministic so one item can contribute to multiple compliance tallies when that is how the catalog flags are configured.
  - [x] Do not duplicate threshold constants in React components, Convex functions, or tests; import them from the shared module everywhere.
  - [x] Normalize duplicate or unsupported compliance flags before tallying so each recognized scheme is counted at most once per item.
  - [x] Define the zero-total compliance contract explicitly so empty or all-zero plans return truthful percentages and target state without divide-by-zero behavior.

- [x] Task 3: Upgrade the DU editor shell to surface truthful budget and compliance feedback during editing (AC: 1, 3-8, 10, 14-16)
  - [x] Extend `webapp/src/components/blockly/BlocklyBudgetHeader.tsx` so it renders safe, warning, over-budget, and unallocated states with explicit copy, not only color and icons.
  - [x] Add a companion compliance summary surface, likely a new component such as `webapp/src/components/blockly/BlocklyComplianceSummary.tsx`, that fits the current editor header or rail without breaking the Story 5.2 shell.
  - [x] Update `webapp/src/components/blockly/BlocklyEditor.tsx` so the reserved submit button becomes budget-aware and surfaces truthful blocked-state copy before Story 6.1 implements actual submission, including non-budget block reasons when they apply.
  - [x] Keep read-only plans informative: the header and compliance summary should still render from persisted state even when the workspace cannot be edited.
  - [x] Reuse existing shadcn/ui primitives, `sonner`, and the current editor-card language instead of introducing a separate dashboard pattern just for this story.
  - [x] Ensure assistive announcements are throttled or state-change-driven so frequent quantity edits do not spam screen readers.

- [x] Task 4: Make draft persistence and Convex plan summaries server-trustworthy (AC: 9, 12-15, 18)
  - [x] Extend `webapp/convex/functions/plans.ts` so `saveDepartmentUserWorkspaceDraft` recalculates or validates budget and compliance summaries from the serialized workspace payload before patching the plan record.
  - [x] If needed, extend `webapp/convex/schema.ts` with a forward-compatible persisted compliance snapshot on `plans` so later stories can reuse saved compliance posture without reparsing everywhere.
  - [x] Keep tenant scoping and DU editability checks in Convex exactly where they already live; Story 5.6 must not move trust decisions into the client.
  - [x] Preserve compatibility with current `categorySummaries`, `estimatedBudgetUsed`, and `workspaceState` fields so `/du` dashboard truthfulness does not regress.
  - [x] Add a safe-parse path for malformed or older `workspaceState` payloads so save failures are deterministic and do not partially patch plan summaries.
  - [x] Recompute against one deterministic item-metadata snapshot per save attempt so persisted totals do not reflect mixed catalog versions mid-request.

- [x] Task 5: Keep live workspace calculations aligned with reactive catalog updates and existing plan context (AC: 2, 9, 14, 15, 17)
  - [x] Ensure item price changes and metadata refreshes continue to flow through the existing `props.items` reactive path in `BlocklyEditor` and `BlocklyWorkspace`.
  - [x] Recalculate budget and compliance posture when selected item metadata changes while the plan is open, not only when the DU types into quantity fields.
  - [x] Preserve the existing archived-category and unavailable-category handling from Story 4.7 and Story 5.2 so calculation updates do not silently drop categories needed for older saved plans.
  - [x] Avoid full workspace disposal or costly reinjection during normal recalculation; keep updates within the current listener-driven workspace flow.
  - [x] Define the fallback path for selected items that no longer resolve from the live catalog so archived or unavailable entries remain represented truthfully in totals and UI state.

- [x] Task 6: Add deterministic guardrail tests for budget and compliance behavior (AC: 2-18)
  - [x] Extend `webapp/tests/department-user-blockly-workspace.test.ts` with coverage for budget threshold transitions, over-budget amount messaging, unallocated states, and compliance percentage calculation.
  - [x] Add tests proving the server-side plan-save path recalculates or validates summaries from workspace state instead of trusting client rollup inputs.
  - [x] Add tests for price-change-triggered recalculation and the persisted read-only rendering path.
  - [x] If a new compliance helper module is added, give it direct pure-unit coverage for AGPO 30%, PWD 2%, and Local Content 40% thresholds plus multi-flag item scenarios.
  - [x] Update `webapp/tests/run-tests.ts` if new suites are introduced.
  - [x] Add tests for threshold-boundary rounding, malformed or legacy workspace payloads, unsupported compliance flags, and read-only plans that must fall back to recomputed compliance state.
  - [x] Add accessibility-focused assertions proving live announcements happen on meaningful state transitions rather than every recalculation.

## Dev Notes

### Story Foundation

- Epic 5 positions Story 5.6 as the real-time budget-awareness layer that helps DUs self-correct before submission.
- In the live repo, Story 5.2 already delivered the first version of that layer:
  - `du-workspace-calculations.ts` computes item, category, and department rollups.
  - `BlocklyBudgetHeader.tsx` renders used, budget, remaining, and percentage.
  - `BlocklyWorkspace.tsx` recalculates totals on workspace changes.
- Story 5.6 therefore must extend and harden the current implementation rather than recreate the budget meter from scratch.

### Previous Story Intelligence

- Story 5.2 established the core DU planning shell, lazy Blockly loading, block grammar, and client-side rollup path. Story 5.6 should preserve that architecture and enrich it with stronger budget plus compliance state rather than rewrite the editor shell.
- Story 5.2 also preserved the toolbar as a truthful reserved contract for later work. Story 5.6 should make that reserved submit affordance budget-aware without pretending the full submission workflow already exists.
- Story 5.1 already uses `plans.estimatedBudgetUsed` and `plans.categorySummaries` to populate the DU dashboard quick stats. Story 5.6 must keep those persisted summaries consistent with the workspace rollups so `/du` and `/du/plans/[planId]` stay in sync.
- Story 4.8 introduced item-level `complianceFlags`, `unitPrice`, and `lastPriceChangedAt`. Story 5.6 should build on that catalog contract instead of inventing new compliance metadata on plans or blocks.

### Prototype Intelligence From `docs/html/procurelinedb.html`

- The HTML prototype injects a DU budget meter into the editor header center region, not into a separate sidebar. It shows used amount, total budget, percentage, and a fill bar that changes warning or danger class as totals change.
- The prototype's DU `updateTotalsDU` flow recalculates the department total and then updates the budget meter UI immediately after block traversal.
- The prototype also applies over-budget styling directly to the department block SVG group, which means Story 5.6 should preserve strong visual feedback inside the workspace, not only in surrounding chrome.
- Compliance totals appear more explicitly in the PO aggregate-plan path of the prototype, where AGPO, PWD, and Local Content values are derived from the running grand total. Story 5.6 should reuse those same threshold ideas for DU-side visibility while avoiding the prototype's monolithic DOM-centric implementation style.
- The prototype relies on imperative DOM updates and hard-coded classes. The real implementation should keep the behavior but express it through typed React plus pure helper modules.

### Current Implementation State Discovered In Code

- `webapp/lib/blockly/du-workspace-calculations.ts` currently provides:
  - item, category, and department rollups,
  - budget threshold mapping for `safe`, `warning`, `over_budget`, and `unallocated`,
  - direct mutation of Blockly block fields after traversal.
- `webapp/src/components/blockly/BlocklyBudgetHeader.tsx` currently renders the basic meter but does not yet provide:
  - explicit advisory copy for warning state,
  - a visible over-budget banner,
  - compliance indicators,
  - accessibility text beyond the visible labels.
- `webapp/src/components/blockly/BlocklyEditor.tsx` currently keeps a reserved `Submit` button regardless of budget posture; it is not yet disabled or relabeled when the plan is over budget.
- `webapp/src/components/blockly/BlocklyWorkspace.tsx` recalculates budget state on block changes and on reactive catalog refreshes, which is the right extension seam for Story 5.6.
- `webapp/convex/functions/plans.ts` currently trusts client-supplied `estimatedBudgetUsed`, `itemCount`, and `categorySummaries` in `saveDepartmentUserWorkspaceDraft`; it does not yet re-derive them from `workspaceState`.
- `webapp/convex/schema.ts` currently stores `itemCount`, `estimatedBudgetUsed`, `categorySummaries`, and `workspaceState` on plans, but it does not yet store any compliance snapshot.
- The live `webapp` repo does not currently include a centralized compliance-calculation module even though the planning artifacts and architecture expect one.

### Technical Requirements

- Extend the existing DU rollup path; do not build a separate budget engine disconnected from Blockly traversal.
- Keep budget threshold semantics aligned with the epic and UX docs:
  - safe: below 80%
  - warning: 80% through 99%
  - over budget: 100% and above
- Preserve truthful unallocated behavior for `null`, `0`, or invalid budget allocations; no divide-by-zero math and no fake `0% used` success state.
- Use one shared rounding strategy for currency math and threshold comparisons so client and server classify boundary percentages identically.
- Recalculate on both quantity edits and reactive catalog changes such as price updates.
- Introduce centralized compliance helpers for:
  - AGPO 30%
  - PWD 2%
  - Local Content 40%
- Do not hardcode these percentages in more than one place.
- Treat unknown compliance flags as non-fatal input and ignore or normalize them explicitly rather than letting them corrupt tally logic.
- Define the zero-total compliance contract explicitly so empty plans never emit `NaN`, `Infinity`, or misleading pass/fail labels.
- Add a server-side calculation or validation path for draft saves so plan summaries persisted in Convex are no longer client-trust-only.
- Safe-parse serialized workspace input and reject or normalize malformed, legacy, negative, or non-numeric values before summary persistence.
- Keep read-only workspaces fully informative even when editing is blocked.
- Treat multi-flag items consistently:
  - one item may count toward multiple compliance tallies when the catalog flags say it is eligible for multiple schemes;
  - UI copy should make that behavior clear.
- Preserve totals truthfully when reactive catalog refreshes cannot resolve an existing saved item by using the current archived or unavailable-item fallback path instead of silently dropping it.
- Limit accessibility announcements to meaningful state changes so high-frequency recalculation remains usable with screen readers.
- Keep the budget/compliance state contract future-friendly for Story 6.1 submission checks and Epic 7 consolidation work.

### Architecture Compliance

- Keep route files thin and continue using the current component stack:
  - `DepartmentUserBlocklyWorkspace`
  - `BlocklyEditor`
  - `BlocklyWorkspace`
- Keep secure validation and tenant scoping in Convex functions; do not push trust into the client.
- Reuse Blockly JSON serialization from `webapp/lib/blockly/blockly-serialization.ts`; do not introduce XML persistence or a second workspace format.
- Follow the architecture rule that compliance calculations must be centralized and reusable, not duplicated per feature.
- Keep the editor client-only and continue using the existing lazy-loading pattern; Story 5.6 is not a route-architecture rewrite.
- Preserve the current shared planning-shell contract so Procurement Officer reuse can still land later without a second editor stack.

### Library And Framework Requirements

- Stay on the repo's installed stack for this story unless a separately approved dependency change is required:
  - Next.js `^16.1.6` with latest upstream verified locally on 2026-04-03 as `16.2.2`
  - Convex `^1.13.2` with latest upstream verified locally on 2026-04-03 as `1.34.1`
  - Blockly `^12.5.1`, verified locally on 2026-04-03 and already current at `12.5.1`
  - React `^19.2.4`
  - `react-hook-form` `^7.47.0`
  - `zod` `^3.22.4`
- Use the current repo conventions:
  - shadcn/ui and Tailwind for UI
  - `sonner` for transient feedback
  - pure helper modules for calculation logic
  - Convex `query` and `mutation` for state and validation
- Do not add a charting library or a second state-management layer just to render budget or compliance indicators.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/src/components/blockly/BlocklyBudgetHeader.tsx`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/blockly/blockly-serialization.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/schema.ts` if a persisted compliance snapshot is added
  - `webapp/tests/department-user-blockly-workspace.test.ts`

- Expected new files (recommended):
  - `webapp/lib/procurement/compliance.ts`
  - `webapp/src/components/blockly/BlocklyComplianceSummary.tsx`
  - `webapp/tests/compliance.test.ts` if the shared compliance helper grows beyond lightweight inline coverage

### Testing Requirements

- Add pure tests for:
  - safe, warning, over-budget, and unallocated meter states
  - over-budget amount messaging
  - category and department rollup consistency
  - AGPO, PWD, and Local Content percentage calculations
  - multi-flag item contribution behavior
  - read-only rendering inputs

- Add backend tests for:
  - draft-save validation or recalculation from `workspaceState`
  - correction or rejection of stale client summaries
  - tenant-scoped plan access during summary recomputation

- Add editor regression tests for:
  - submit-affordance disabled or relabeled when over budget
  - recalculation after reactive item price changes
  - persisted budget/compliance summary remaining truthful after reload
  - unallocated-budget copy and no divide-by-zero behavior

### Git Intelligence Summary

- Recent commits show the current repo house style is still helper-heavy, workspace-oriented, and test-first:
  - `a95f45e` refined Story 4.8 item functionality and tests, which is directly relevant because Story 5.6 must consume item pricing and compliance flags from that catalog layer.
  - `a5bd004` implemented Story 4.7 category management with strong validation and reuse patterns, reinforcing the expectation that DU workspace logic should extend existing catalog structures rather than duplicate them.
  - `b4cd44a` completed deadline management with focused domain modules plus deterministic tests, which matches the pattern Story 5.6 should follow for calculation-heavy behavior.
- Even where the last five commits are not DU-specific, they reinforce a clear project norm:
  - thin routes,
  - dedicated feature helpers,
  - deterministic tests,
  - truthful empty or blocked states,
  - no prototype-style browser alerts as product behavior.

### Latest Tech Information

- Verified locally on 2026-04-03 with `npm view`:
  - Next.js latest: `16.2.2`
  - Convex latest: `1.34.1`
  - Blockly latest: `12.5.1`
- Official Blockly save/load guidance, last updated July 25, 2025, still recommends JSON serialization via `Blockly.serialization.workspaces.save(...)` and `load(...)` for new projects.
- Official Next.js lazy-loading guidance still supports `next/dynamic` with `ssr: false` for browser-only client code, which remains the correct pattern for Blockly.
- Inference from the current repo plus architecture guidance:
  - Story 5.6 should build on the existing JSON workspace state already persisted in `plans.workspaceState`;
  - server-side validation should consume that JSON shape rather than adding a second serialized representation.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and tenant enforcement
  - shadcn/ui plus Tailwind styling
  - `sonner` for user feedback
  - Blockly block names in `snake_case`
  - JSON serialization for new Blockly persistence
- Where `_bmad-output/project-context.md` or older architecture text conflicts with the live repo structure, prefer the live repo's current file layout and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 5 Source](../epic-05-du-blockly-planning.md)
- [Epic Index](../../epics.md)
- [Story 5.1 Reference](./5-1-du-dashboard-plan-status.md)
- [Story 5.2 Reference](./5-2-blockly-workspace-core.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [DU Prototype](../../../../../docs/html/procurelinedb.html)
- [Current Plan Functions](../../../../../webapp/convex/functions/plans.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Current Blockly Rollups](../../../../../webapp/lib/blockly/du-workspace-calculations.ts)
- [Current Blockly Serialization](../../../../../webapp/lib/blockly/blockly-serialization.ts)
- [Current Workspace Save Helpers](../../../../../webapp/lib/blockly/workspace-save.ts)
- [Current Toolbox Helpers](../../../../../webapp/lib/blockly/du-toolbox.ts)
- [Current Workspace Identity Helpers](../../../../../webapp/lib/blockly/workspace-catalog-identity.ts)
- [Current Blockly Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Current Budget Header](../../../../../webapp/src/components/blockly/BlocklyBudgetHeader.tsx)
- [Current Blockly Workspace Host](../../../../../webapp/src/components/blockly/BlocklyWorkspace.tsx)
- [Current DU Workspace Route Shell](../../../../../webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx)
- [Current DU Dashboard Snapshot](../../../../../webapp/lib/department-user/dashboard-snapshot.ts)
- [Current Item Helper Contract](../../../../../webapp/lib/procurement-officer/items.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Next.js Lazy Loading Docs](https://nextjs.org/docs/app/guides/lazy-loading)
- [Blockly Save and Load Docs](https://developers.google.com/blockly/guides/get-started/save-and-load)

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
  - `_bmad-output/implementation-artifacts/epics/epic5/epic-05-du-blockly-planning.md`
  - `_bmad-output/implementation-artifacts/epics/epics.md`
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-1-du-dashboard-plan-status.md`
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-2-blockly-workspace-core.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `docs/html/procurelinedb.html`
  - `webapp/package.json`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/lib/blockly/block-definitions.ts`
  - `webapp/lib/blockly/blockly-serialization.ts`
  - `webapp/lib/blockly/du-plan-routes.ts`
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/blockly/editor-contract.ts`
  - `webapp/lib/blockly/workspace-catalog-identity.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/items.ts`
  - `webapp/src/components/blockly/BlocklyBudgetHeader.tsx`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
  - `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
  - `webapp/tests/department-user-blockly-workspace.test.ts`
- Git context:
  - `git log -5 --oneline`
  - `git status --short`
- Tech verification commands:
  - `cmd /c npm view next version`
  - `cmd /c npm view convex version`
  - `cmd /c npm view blockly version`

### Completion Notes List

- 2026-04-03: Rebuilt the DU Blockly calculation core into a shared budget-and-compliance summary pipeline that works from both live Blockly blocks and serialized workspace JSON.
- 2026-04-03: Added a centralized procurement compliance helper, upgraded the budget header plus editor shell, and introduced a new compliance summary panel with accessible state-driven copy and announcements.
- 2026-04-03: Hardened `saveDepartmentUserWorkspaceDraft` so Convex now derives persisted summaries from `workspaceState` instead of trusting client totals, and added deterministic guardrail coverage for thresholds, malformed payloads, and reserved submit-state messaging.
- 2026-04-03: `npm test` passed and file-scoped `eslint` passed for all touched Story 5.6 files; full `npm run lint` remains blocked by pre-existing unrelated TypeScript issues in `webapp/convex/functions/items.ts` and `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx`.
- 2026-04-03: Code review follow-up fixes now fail closed on malformed outer workspace payloads, preserve truthful reopened/read-only budget totals from persisted plan summaries, and stop trusting client-selected category context during draft saves.

### File List

- `_bmad-output/implementation-artifacts/epics/epic5/stories/5-6-budget-meter-calculations.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/functions/plans.ts`
- `webapp/lib/blockly/block-definitions.ts`
- `webapp/lib/blockly/du-workspace-calculations.ts`
- `webapp/lib/blockly/workspace-catalog-identity.ts`
- `webapp/lib/blockly/workspace-save.ts`
- `webapp/lib/procurement/compliance.ts`
- `webapp/src/components/blockly/BlocklyBudgetHeader.tsx`
- `webapp/src/components/blockly/BlocklyComplianceSummary.tsx`
- `webapp/src/components/blockly/BlocklyEditor.tsx`
- `webapp/src/components/blockly/BlocklyWorkspace.module.css`
- `webapp/src/components/blockly/BlocklyWorkspace.tsx`
- `webapp/tests/compliance.test.ts`
- `webapp/tests/department-user-blockly-workspace.test.ts`
- `webapp/tests/run-tests.ts`

### Story Completion Status

- Story ID: `5.6`
- Story Key: `5-6-budget-meter-calculations`
- Output File: `_bmad-output/implementation-artifacts/epics/epic5/stories/5-6-budget-meter-calculations.md`
- Final Status: `done`
- Completion Note: `Shared budget and compliance calculations, live DU editor feedback, server-side summary recomputation, malformed-workspace rejection, and persisted-plan fallback behavior are implemented and covered by deterministic tests.`

## Senior Developer Review (AI)

### Reviewer

- Reviewer: `Codex`
- Date: `2026-04-03`
- Outcome: `Approved after fixes`

### Findings Resolved

- Fixed malformed outer `workspaceState` handling so draft saves now fail closed instead of normalizing invalid payloads into blank seeded plans.
- Fixed reopened/read-only plan rendering so persisted `estimatedBudgetUsed` and category summary totals remain truthful even when Blockly workspace structure is missing from the saved snapshot.
- Fixed server-side draft persistence to rebuild selected category context from the persisted plan plus recalculated workspace categories instead of trusting stale client category selections.
- Added deterministic regression coverage for the new persistence patch helper, malformed outer workspace rejection, and persisted-plan fallback summary behavior.

### Verification

- `npm test` from `webapp/`

## Change Log

- 2026-04-03: Resolved review findings for Story 5.6, updated persistence validation and reload fallback logic, reran automated tests, and approved the story.
