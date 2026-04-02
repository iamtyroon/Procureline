# Story 5.2: Blockly Workspace Core

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want the reserved DU planning routes to open a real Blockly workspace that preserves the block structure and interaction model from `docs/html/procurelinedb.html`,
so that I can build my procurement plan visually with the same intuitive department, category, and item editing flow that the prototype demonstrates.

## Acceptance Criteria

1. [Given] a Departmental User launches planning from `/du` via `+ New Plan`, `Resume Plan`, or a plan-row action [When] they open `/du/plans/new` or `/du/plans/[planId]` [Then] the current placeholder route is replaced with a real Blockly editor surface inside the authenticated app shell [And] the editor preserves the prototype's three-part layout: editor header, Blockly toolbox/flyout on the left, and main canvas workspace in the center (FR39).
2. [Given] the DU planning route loads below the desktop threshold [When] the page renders [Then] the route shows a desktop-required state aligned with the UX specification instead of a degraded mobile Blockly surface.
3. [Given] the Blockly editor depends on browser APIs [When] the route is rendered in Next.js App Router [Then] Blockly is loaded lazily in a client-only component with a truthful loading state [And] the route file remains thin instead of embedding Blockly setup directly in `page.tsx` (NFR-P1, architecture lazy-loading guidance).
4. [Given] the DU launches planning from the Story 5.1 dashboard handoff [When] query-state includes selected categories and fiscal year [Then] the workspace initializes with that same category selection preserved [And] the editor never falls back to a prototype-style `alert()` dead end or drops the launchpad selection silently.
5. [Given] the DU workspace initializes [When] the toolbox is built [Then] it includes a `Dept Info` source block plus only the selected procurement categories from the live tenant catalog [And] the department source block is prefilled from live DU context with read-only department metadata such as department name, vote number, and budget rather than demo literals (FR39, FR40).
6. [Given] the DU drags the department block into the workspace [When] it is rendered [Then] it uses the prototype's collapsible `department_block` grammar with:
   - always-visible header row
   - hidden-until-expanded vote number and budget rows
   - a `CATEGORIES` statement input constrained to category blocks
   - an always-visible department total field
   - the prototype-aligned department color treatment (FR39, FR43).
7. [Given] the DU drags a category block from the toolbox [When] it is dropped into the department block [Then] the category block connects only inside the department's category statement input [And] it preserves the prototype's quarterly subtotal display with `Q1`, `Q2`, `Q3`, `Q4`, and category grand total labels (FR40, FR44).
8. [Given] the DU drags an item block into a category block [When] it is rendered [Then] the item block preserves the prototype's field model:
   - always-visible header row
   - read-only item metadata rows for description, unit, unit price, procurement method, and source of funds
   - editable `Q1_QTY` through `Q4_QTY` fields
   - always-visible total quantity and total cost fields
   - prototype-aligned item color treatment (FR41, FR42, FR43).
9. [Given] the DU expands or collapses department or item blocks [When] the toggle icon is used [Then] the workspace mirrors the prototype's expand/collapse behavior and visual state classes so detailed metadata can be progressively disclosed without losing the summary row (FR43).
10. [Given] the DU changes item quantities [When] the workspace recalculates [Then] item totals, category subtotals, category grand totals, and department total update immediately in the workspace [And] the logic follows the prototype's `updateTotalsDU` traversal model while being implemented in testable helpers rather than monolithic inline DOM code (FR42, FR44).
11. [Given] the DU editor header is shown [When] department budget data exists [Then] the header displays a live budget meter that mirrors the prototype's header-centered DU budget treatment with used amount, total budget, and percentage used [And] the meter transitions through safe, warning, and over-budget visual states without waiting for save or submit actions (FR45, FR46).
12. [Given] the current plan already exists for the selected fiscal year [When] `/du/plans/[planId]` opens [Then] the workspace loads the canonical plan state into Blockly for edit or read-only view based on the live plan status and DU access mode [And] the editor does not create a second same-year plan implicitly.
13. [Given] the current repo's `plans` table only stores summary planning fields [When] Story 5.2 introduces real workspace state [Then] plan persistence is extended to support structured Blockly workspace data and editor metadata in a forward-compatible shape [And] the implementation does not lock the product into the prototype's XML-only storage model because official Blockly guidance recommends JSON serialization for new workspaces.
14. [Given] a Procurement Officer needs to access the same planning surface later [When] the shared editor foundation is created in this story [Then] the editor architecture supports a role-aware or mode-aware header and toolbar contract so a future PO entry path can reuse the same workspace foundation [And] PO mode surfaces a truthful indicator such as `(Editing as PO)` when that mode is active (FR48).
15. [Given] the DU editor performs actions such as exit, submit, request-item handoff, or export handoff [When] those flows are not fully implemented in this story [Then] the toolbar still exposes truthful actions or reserved contracts using app-native components, disabled states, and route handoffs [And] the implementation does not carry forward the prototype's `alert()` and `confirm()` UX shortcuts.
16. [Given] the DU planning routes are opened directly, refreshed, or deep-linked [When] required handoff context such as selected categories or fiscal year is missing [Then] the route fails closed into a truthful recovery or blocked state that sends the DU back through the dashboard launchpad instead of opening an unscoped empty editor.
17. [Given] the dashboard handoff or persisted plan contains category IDs [When] the editor resolves live catalog data [Then] stale, duplicate, inactive, or cross-tenant category references are sanitized out before toolbox construction [And] the DU only sees valid active categories for their tenant.
18. [Given] the department budget allocation is null, zero, or otherwise non-usable [When] the editor header renders [Then] the budget meter falls back to an honest unallocated-budget state instead of displaying misleading percentages or divide-by-zero math.
19. [Given] a DU opens `/du/plans/[planId]` [When] the referenced plan is missing, belongs to another department or tenant, is archived, or has an unsupported status [Then] the route returns a truthful not-found or blocked state and never hydrates the wrong workspace.
20. [Given] Blockly fails to import, initialize, or attach to the DOM [When] the planning route loads [Then] the user sees a clear editor-load failure state with a recovery path and the page never degrades into a blank shell.
21. [Given] a selected category has no currently active procurement items [When] the toolbox is built [Then] the category is shown as unavailable or omitted with a truthful explanation instead of inviting the DU into an empty item branch.
22. [Given] Story 5.2 is the foundation for later validation, autosave, and toolbox-management stories [When] the story is completed [Then] the workspace code is modularized so Stories 5.3, 5.4, 5.6, and 5.7 can extend validation, persistence, budget rules, and toolbox behavior without rewriting the editor shell (Epic dependency map, architecture guidance).

## Tasks / Subtasks

- [x] Task 1: Replace the DU plan-route placeholders with a real workspace shell and desktop-only planning surface (AC: 1, 2, 3, 12, 14, 15)
  - [x] Keep `webapp/app/(app)/du/plans/new/page.tsx`, `webapp/app/(app)/du/plans/[planId]/page.tsx`, and `webapp/app/(app)/du/plans/page.tsx` thin.
  - [x] Add a dedicated DU planning feature component or route-shell such as `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`.
  - [x] Add a dedicated `src/components/blockly/` area for the editor wrapper, actual Blockly surface, loading skeleton, and mode-aware header/toolbar parts.
  - [x] Reuse the authenticated app shell and existing DU route protection instead of creating a separate full-screen standalone application.

- [x] Task 2: Add Blockly as a lazily loaded browser-only dependency and initialize it with repo-aligned patterns (AC: 1, 3, 6, 7, 8, 9)
  - [x] Add the `blockly` package to `webapp/package.json` because it is currently missing from the repo.
  - [x] Create a client-only lazy wrapper using `next/dynamic` with `ssr: false` and a loading component, following official Next.js lazy-loading guidance.
  - [x] Configure the workspace with scrollbars, trashcan, grid snapping, and zoom controls consistent with the prototype's `Blockly.inject` options.
  - [x] Ensure workspace disposal and listener cleanup happen on unmount and route changes to avoid leaking listeners between editor sessions.

- [x] Task 3: Recreate the DU block grammar from `procurelinedb.html` as production block definitions (AC: 5, 6, 7, 8, 9, 14)
  - [x] Implement `department_block` with collapsible read-only metadata rows, category statement input, and total field.
  - [x] Implement `category_block` with the prototype's quarterly subtotal labels and grand total label.
  - [x] Implement `item_block` with collapsible read-only metadata rows plus editable quarter quantity fields and item totals.
  - [x] Keep block names in `snake_case` to match project-context and architecture naming rules.
  - [x] Preserve the prototype's block color language while aligning the final palette with the documented Blockly visual requirements.

- [x] Task 4: Build the DU toolbox and category handoff around the Story 5.1 dashboard contract (AC: 4, 5, 7, 8, 12, 16, 17, 21)
  - [x] Reuse the existing Story 5.1 query-state handoff for `fiscalYear` and `categories`.
  - [x] Build the DU toolbox from live `procurementCategories` and `procurementItems`, filtered to the selected categories only.
  - [x] Prefill the department block from live DU and department context rather than demo values.
  - [x] Sanitize direct-link and persisted category selections by removing duplicates, inactive categories, and tenant-invalid IDs before rendering the toolbox.
  - [x] Decide and implement the truthful UI treatment for categories that exist but currently have zero active items.
  - [x] Preserve a clear separation between source blocks in the toolbox and placed blocks already on the canvas so Story 5.7 can later refine duplicate hiding and toolbox management.

- [x] Task 5: Create testable DU workspace calculation and serialization helpers (AC: 10, 11, 13, 18, 22)
  - [x] Add pure helper modules for item totals, category totals, department totals, budget utilization, and warning-state mapping.
  - [x] Add Blockly JSON serialization and deserialization helpers using the official `Blockly.serialization.workspaces.save/load` APIs instead of XML as the primary format.
  - [x] Define a forward-compatible workspace payload shape that can later support autosave metadata, save status, and recovery timestamps.
  - [x] Add explicit guard behavior for null, zero, or invalid budget allocations so header budget math never divides by zero or implies a budget exists when it does not.
  - [x] Keep any temporary migration compatibility explicit if the prototype's XML snippets are referenced for reconstruction or QA comparison.

- [x] Task 6: Extend DU plan data contracts for real editor state without breaking Story 5.1 dashboard truthfulness (AC: 12, 13, 14, 19, 22)
  - [x] Extend the existing `plans` data model or associated functions so a canonical plan can carry structured workspace state in addition to summary fields.
  - [x] Keep tenant scoping and DU/PO authorization in Convex functions.
  - [x] Ensure the editor can load existing canonical plans into view or edit mode based on status and access mode.
  - [x] Fail closed when `planId` is missing, foreign-tenant, foreign-department, archived, or in an unsupported state.
  - [x] Keep one department plus one fiscal year equals one canonical plan as a hard invariant.

- [x] Task 7: Implement the DU editor header and truthful toolbar contracts (AC: 1, 10, 11, 14, 15, 18, 20)
  - [x] Recreate the prototype's DU header rhythm: page title, subtitle, center budget meter, and right-side toolbar.
  - [x] Provide app-native buttons for exit, request-item handoff, export handoff, and submit or reserved submit state.
  - [x] Replace prototype `alert()` and `confirm()` interactions with disabled buttons, banners, dialogs, or toasts that match the existing webapp UX stack.
  - [x] Add a clear editor-load failure state for Blockly import or initialization failures.
  - [x] Support a role-aware header contract so PO editing mode can reuse the shell later.

- [x] Task 8: Add deterministic tests for workspace bootstrapping and DU-specific editor behavior (AC: 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21)
  - [x] Add pure tests for quarter-total calculation, department/category rollups, and budget-threshold mapping.
  - [x] Add tests for category-selection handoff and toolbox filtering so only chosen categories appear for the DU.
  - [x] Add tests for plan-mode routing and truthful edit-vs-view behavior based on plan status and DU access mode.
  - [x] Add tests for direct-link recovery when `categories` or `fiscalYear` handoff is missing.
  - [x] Add tests for stale, duplicate, inactive, and foreign-tenant category IDs.
  - [x] Add tests for null or zero budget states and Blockly initialization failure fallback.
  - [x] Update `webapp/tests/run-tests.ts` to include the new DU Blockly workspace suite.

## Dev Notes

### Story Foundation

- Epic 5 positions Story 5.2 as the core authoring surface that every later validation, persistence, and budget rule depends on.
- Story 5.1 is already done and created the DU planning handoff routes plus query-state contract:
  - `webapp/app/(app)/du/plans/new/page.tsx`
  - `webapp/app/(app)/du/plans/[planId]/page.tsx`
  - `webapp/app/(app)/du/plans/page.tsx`
  - `webapp/src/components/department-user/DepartmentUserRoutePlaceholder.tsx`
- The user has explicitly directed that Story 5.2 must inspect and preserve the DU editor behavior from `docs/html/procurelinedb.html`, especially how the blocks are made and how the DU workspace behaves.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/du/plans/new/page.tsx` currently renders a reserved handoff placeholder only.
- `webapp/app/(app)/du/plans/[planId]/page.tsx` currently renders a reserved handoff placeholder only.
- `webapp/app/(app)/du/plans/page.tsx` currently renders a reserved route placeholder only.
- `webapp/src/components/department-user/DepartmentUserDashboard.tsx` already:
  - preserves selected DU categories in local state
  - hands `fiscalYear` and `categories` into `/du/plans/new`
  - enforces desktop-only rendering for the DU dashboard
- `webapp/convex/schema.ts` already includes:
  - `procurementCategories`
  - `procurementItems`
  - `plans`
  - department budget allocation on `departments`
- The current `plans` table already stores summary planning fields such as:
  - `fiscalYear`
  - `status`
  - `itemCount`
  - `estimatedBudgetUsed`
  - `selectedCategoryIds`
  - `categorySummaries`
- The current `plans` table does **not** yet store a real Blockly workspace payload.
- `webapp/node_modules/blockly` is currently missing and `webapp/package.json` does not include the Blockly dependency yet.

### Prototype Intelligence: DU Editor Layout And Flow

From `docs/html/procurelinedb.html`, the DU editor is not a generic Blockly page. It has a specific contract:

- Launch entry:
  - `openBlocklyWithSelection()` blocks launch when no category is selected.
  - `selectedCategories` drives the toolbox content.
  - direct opening without valid launch context is not handled in the prototype and must be handled in production.
- Editor layout:
  - `#blocklyEditorView` is a dedicated full-height editor panel.
  - Header contains:
    - title
    - subtitle
    - a center stats region (`editorHeaderStats`)
    - a right-aligned toolbar (`editorToolbar`)
  - The Blockly canvas lives in `#blocklyDiv`.
- DU header behavior:
  - title is customized to the department name
  - subtitle says the DU should drag items to build a quarterly plan
  - a budget meter is injected into the header center region
  - toolbar includes Exit, Request Item, Export to Excel, and Submit to PO
- Workspace initialization:
  - uses `Blockly.inject(...)`
  - enables `scrollbars`, `trashcan`, grid snapping, and zoom controls
  - attaches DU-specific listeners for totals and toolbox refresh

### Prototype Intelligence: DU Block Grammar

The DU editor in `procurelinedb.html` defines these blocks and behaviors:

- `department_block`
  - JavaScript-defined block, not JSON-only
  - header row with collapse toggle icon and department name
  - hidden-until-expanded read-only rows for vote number and budget
  - `CATEGORIES` statement input constrained to `category_block`
  - always-visible `DEPT_TOTAL`
  - custom mutation hooks used to preload budget and vote number in toolbox instances
  - collapsible CSS classes: `dept-block-collapsed` and `dept-block-expanded`

- `category_block`
  - JSON-defined block via `Blockly.defineBlocksWithJsonArray`
  - category label row
  - `ITEMS` statement input constrained to `item_block`
  - quarterly subtotal labels:
    - `CAT_Q1_TOTAL`
    - `CAT_Q2_TOTAL`
    - `CAT_Q3_TOTAL`
    - `CAT_Q4_TOTAL`
    - `CATEGORY_GRAND_TOTAL`

- `item_block`
  - JavaScript-defined block, not JSON-only
  - header row with collapse toggle icon and item description
  - hidden-until-expanded read-only rows for:
    - unit of measurement
    - unit price
    - procurement method
    - source of funds
  - always-visible editable quantity fields:
    - `Q1_QTY`
    - `Q2_QTY`
    - `Q3_QTY`
    - `Q4_QTY`
  - always-visible totals:
    - `ITEM_TOTAL_QTY`
    - `ITEM_TOTAL_COST`
  - collapsible CSS classes: `item-block-collapsed` and `item-block-expanded`

- Timing blocks also exist in the prototype, but those are part of the PO and consolidation flows.
  - Story 5.2 should not make DU delivery depend on timing blocks.
  - Shared editor architecture should still avoid preventing later PO timing-block support.

### Prototype Block Customization Inventory

These DU-specific customizations from `procurelinedb.html` should be treated as explicit implementation guidance, not optional inspiration:

- `department_block`
  - starts collapsed by default
  - swaps between right-arrow and down-arrow icons on toggle
  - keeps the header row visible at all times
  - hides `VOTE_INPUT` and `BUDGET_INPUT` while collapsed
  - uses mutation hooks to persist and restore `BUDGET` and `VOTE_NUMBER`
  - applies `dept-block-collapsed` and `dept-block-expanded` CSS classes to the SVG group
  - constrains `CATEGORIES` to `category_block`
  - exposes `DEPT_TOTAL` as the department-level rollup target

- `category_block`
  - is JSON-defined rather than imperative JavaScript-defined
  - keeps category identity in `CATEGORY_NAME`
  - exposes an `ITEMS` statement input checked to `item_block`
  - exposes quarter subtotal labels `CAT_Q1_TOTAL`, `CAT_Q2_TOTAL`, `CAT_Q3_TOTAL`, `CAT_Q4_TOTAL`
  - exposes `CATEGORY_GRAND_TOTAL` for the full category rollup
  - chains to other categories through `previousStatement` and `nextStatement`

- `item_block`
  - starts collapsed by default
  - swaps between right-arrow and down-arrow icons on toggle
  - keeps the header row visible at all times
  - keeps quantity and total rows visible while collapsed
  - hides `UNIT`, `PRICE`, `PROC_METHOD_INPUT`, and `FUNDS_SOURCE` while collapsed
  - switches between inline and stacked input presentation when collapsed vs expanded
  - uses editable `FieldNumber` inputs for `Q1_QTY`, `Q2_QTY`, `Q3_QTY`, and `Q4_QTY`
  - exposes `ITEM_TOTAL_QTY` and `ITEM_TOTAL_COST` as derived labels
  - applies `item-block-collapsed` and `item-block-expanded` CSS classes to the SVG group

- DU toolbox behavior
  - preloads the department source block from live DU context
  - filters categories strictly by `selectedCategories`
  - builds category and item source blocks dynamically from catalog data
  - tracks used blocks in workspace and refreshes the toolbox after create, delete, and move events

- DU workspace behavior
  - initializes Blockly with scrollbars, trashcan, grid snapping, and zoom controls
  - injects a DU-specific budget meter into the editor header instead of treating budget as a separate page widget
  - binds DU recalculation to workspace change events through the `updateTotalsDU` traversal model
  - supports exit and return to the DU dashboard without leaving orphaned listeners behind

### Prototype Intelligence: DU Toolbox Behavior

The DU toolbox is not static.

- `buildDUToolbox()`:
  - preloads the DU's department name, vote number, and budget into the department block
  - clears and rebuilds category sections dynamically
  - filters categories by `selectedCategories`
  - populates category blocks and item blocks from catalog data
- The prototype also tracks `usedBlocksInWorkspace` and refreshes the toolbox after block create, delete, and move events.
- The prototype does not explicitly handle stale, duplicated, or invalid selected category IDs.
- The prototype does not explicitly define how a selected category with zero active items should appear.
- Story 5.2 should preserve the selection-driven toolbox contract, but it does not need to carry forward every prototype implementation detail exactly.
- Keep the source-of-truth behavior:
  - selected categories control what the DU can start from
  - live catalog data populates the category and item source blocks

### Prototype Intelligence: DU Calculations

The prototype's `updateTotalsDU(event)` function establishes the DU calculation model:

- Ignore UI-only Blockly events.
- Traverse the top-level `department_block`.
- Walk category chains through `CATEGORIES`.
- Walk item chains through `ITEMS`.
- For each item:
  - read `UNIT_PRICE`
  - read `Q1_QTY` through `Q4_QTY`
  - compute total quantity as the sum of the four quarters
  - compute item total as `unit price * total quantity`
- Roll item totals into category quarter totals and category total.
- Roll category totals into department total.
- Update the header budget meter from department budget versus current department total.
- The production implementation must explicitly handle null, zero, or invalid budget values during this calculation path.

This traversal logic is important and should be preserved conceptually, but it should move into testable helpers and modern workspace listeners rather than staying embedded in one giant DOM-oriented function.

### Production Corrections Required

The prototype is the canonical behavior reference, but several implementation shortcuts must not carry into production:

- `openBlocklyWithSelection()` currently uses `alert(...)` for validation.
- `handleBlocklyAction()` currently uses `confirm(...)` and `alert(...)`.
- The prototype serializes the DU workspace to XML with `Blockly.Xml.workspaceToDom(...)` and `Blockly.Xml.domToText(...)`.
- The project context and official Blockly serialization guidance both point toward JSON for new implementations.
- The prototype is a monolithic HTML file with inline JS and DOM querying.
- The prototype does not define a recovery state for failed Blockly import or failed workspace injection.
- The prototype does not define a fail-closed state for foreign or invalid `planId` access.
- The production implementation must fit the repo's component, helper, and Convex function patterns.

### Previous Story Intelligence: Story 5.1 Learnings

Story 5.1 established constraints that Story 5.2 must honor:

- Keep App Router page files thin.
- Use dedicated feature components under `webapp/src/components/department-user/`.
- Preserve the Story 5.1 DU dashboard handoff contract so `/du` does not need redesign.
- Keep desktop-only enforcement consistent with the UX specification.
- Use truthful states instead of demo data.
- Respect one canonical plan per fiscal year.
- Reuse existing DU auth context and protected route structure.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `lucide-react` `^0.577.0`
  - `date-fns` `^2.30.0`
  - `sonner` `^2.0.7`
- Add the official `blockly` package to the webapp because it is not currently installed.
- Keep authorization and tenant scoping in Convex functions, not in the client.
- Use client components only where Blockly, `useQuery`, `useMutation`, browser listeners, or route state require them.
- Do not add `middleware.ts`; the repo uses `proxy.ts`.

### Library And Framework Requirements

- Next.js / React
  - Use `next/dynamic` with `ssr: false` inside a client component for Blockly.
  - Keep the route shell thin and move editor logic into dedicated components.
  - Use `startTransition` where route handoffs or heavy non-urgent client updates benefit from it.

- Blockly
  - Use the official `blockly` npm package.
  - Use JSON serialization as the primary saved workspace format for new workspaces.
  - Recreate the DU block grammar from the prototype using production component structure.
  - Use `FieldLabelSerializable` where block labels are programmatically populated and must serialize with the workspace.

- Convex
  - Extend plan functions and queries rather than introducing parallel REST endpoints.
  - Keep one canonical plan per department and fiscal year.
  - Preserve tenant filters on all plan, category, and item reads.

- UI stack
  - Use existing shadcn/ui primitives and `lucide-react`.
  - Use `sonner` or existing app-native feedback patterns for transient DU feedback.
  - Do not add a dashboard framework or a charting dependency for the budget meter.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/du/plans/new/page.tsx`
  - `webapp/app/(app)/du/plans/[planId]/page.tsx`
  - `webapp/app/(app)/du/plans/page.tsx`
  - `webapp/package.json`
  - `webapp/convex/schema.ts`
  - `webapp/tests/run-tests.ts`

- Expected new files or directories:
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyLoadingSkeleton.tsx`
  - `webapp/src/components/blockly/BlocklyBudgetHeader.tsx`
  - `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
  - `webapp/lib/blockly/block-definitions.ts`
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/blockly/blockly-serialization.ts`
  - `webapp/convex/functions/plans.ts` or equivalent plan workspace module if it does not yet exist
  - `webapp/tests/department-user-blockly-workspace.test.ts`

### Testing Requirements

- Add pure tests for:
  - item total calculations from Q1 through Q4
  - category subtotal rollups
  - department total rollups
  - budget meter threshold mapping
  - null and zero budget fallback behavior
  - selected-category toolbox filtering
  - stale, duplicate, inactive, and invalid category ID sanitization
  - canonical plan route mode mapping for edit vs view

- Add editor-contract tests for:
  - DU plan handoff from Story 5.1 query params
  - direct-link recovery when handoff params are missing
  - truthful blocked or read-only mode when DU access is not editable
  - JSON serialization helper round-trips for DU workspace state
  - workspace hydration from an existing plan payload
  - editor fallback when Blockly fails to initialize

- Add route and auth regression tests for:
  - Department User access to `/du/plans/new`
  - Department User access to `/du/plans/[planId]`
  - invalid or foreign `planId` returning not-found or blocked state
  - non-DU users being redirected or blocked from DU planning routes

### Git Intelligence Summary

- Recent commits and current story structure show an established repo pattern:
  - thin route page
  - dedicated feature component
  - helper modules for derivation logic
  - deterministic Node-based tests
- Story 5.1 already followed this pattern for the DU dashboard.
- Story 5.2 should follow the same approach so the Blockly editor feels like a native continuation of the DU dashboard rather than a separate prototype port.

### Latest Tech Information

- Official Next.js lazy-loading guidance, last updated March 25, 2026, still recommends `next/dynamic` for lazy loading Client Components and notes that `ssr: false` must be used in a Client Component context, which fits Blockly's browser-only requirements.
- Official Blockly save and load guidance, last updated September 19, 2025, recommends JSON serialization for new projects and documents `Blockly.serialization.workspaces.save(...)` and `load(...)` as the preferred APIs for workspace state.
- Official Blockly serializable label field guidance, last updated September 16, 2025, confirms `FieldLabelSerializable` is appropriate when labels are updated programmatically and need to survive serialization.
- Inference from those official docs plus the current repo state:
  - Story 5.2 should use JSON as the canonical workspace storage format.
  - If XML is referenced at all, it should be limited to prototype comparison or migration support, not primary persistence.

### Project Context Reference

- Follow the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - shadcn/ui plus Tailwind styling
  - tenant scoping in backend reads
  - Blockly block names in `snake_case`
  - lazy loading for large Blockly bundles
  - JSON serialization for new Blockly persistence

### References

- [Sprint Status](../sprint-status.yaml)
- [Epic 5 Source](../epic-05-du-blockly-planning.md)
- [Epic Index](../../epics.md)
- [Story 5.1 Source](./5-1-du-dashboard-plan-status.md)
- [Project Context](../../../../project-context.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [DU Prototype](../../../../../docs/html/procurelinedb.html)
- [Current DU Dashboard](../../../../../webapp/src/components/department-user/DepartmentUserDashboard.tsx)
- [Current DU Route Placeholder](../../../../../webapp/src/components/department-user/DepartmentUserRoutePlaceholder.tsx)
- [Current DU New Plan Route](../../../../../webapp/app/(app)/du/plans/new/page.tsx)
- [Current DU Plan Detail Route](../../../../../webapp/app/(app)/du/plans/[planId]/page.tsx)
- [Current DU Plans Index Route](../../../../../webapp/app/(app)/du/plans/page.tsx)
- [Current DU Dashboard Query](../../../../../webapp/convex/functions/departmentUserDashboard.ts)
- [Current Convex Schema](../../../../../webapp/convex/schema.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Next.js Lazy Loading Docs](https://nextjs.org/docs/app/guides/lazy-loading)
- [Blockly Save and Load Docs](https://developers.google.com/blockly/guides/configure/web/serialization)
- [Blockly Serializable Label Fields Docs](https://developers.google.com/blockly/guides/create-custom-blocks/fields/built-in-fields/label-serializable)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Dev-story workflow: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Dev-story instructions: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Dev-story checklist: `_bmad/bmm/workflows/4-implementation/dev-story/checklist.md`
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
  - `webapp/app/(app)/du/plans/new/page.tsx`
  - `webapp/app/(app)/du/plans/[planId]/page.tsx`
  - `webapp/app/(app)/du/plans/page.tsx`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/src/components/department-user/DepartmentUserRoutePlaceholder.tsx`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/convex/schema.ts`
  - `webapp/tests/run-tests.ts`
- Git context:
  - `git log -5 --oneline`
  - `git status --short`
- Implementation and validation commands:
  - `npm install blockly --legacy-peer-deps`
  - `npx convex codegen`
  - `npm test`
  - `npm run lint`
  - `npm run build`

### Implementation Plan

- Extend the Convex plan schema and plan workspace functions so the DU route can create or reopen one canonical plan per fiscal year with persisted Blockly JSON state.
- Build shared Blockly helpers for custom block definitions, toolbox/category sanitization, route-state parsing, workspace serialization, and deterministic total calculations.
- Replace the DU placeholder routes with a desktop-only workspace shell, lazy client-side Blockly surface, live budget header, and truthful toolbar or blocked states.
- Add deterministic test coverage for rollups, budget meter states, launch-context recovery, toolbox filtering, workspace mode resolution, and serialization helpers, then run repo validation commands.

### Completion Notes List

- 2026-03-29: Replaced the DU planning placeholders with a real Blockly workspace flow that keeps the App Router pages thin and moves the editor shell into dedicated department-user and blockly components.
- 2026-03-29: Added lazy client-only Blockly loading, prototype-aligned `department_block`, `category_block`, and `item_block` definitions, a live DU budget header, truthful toolbar states, and a desktop-required fallback experience.
- 2026-03-29: Extended the Convex `plans` contract with forward-compatible `workspaceState` JSON persistence plus DU plan workspace queries and mutations that enforce tenant, department, fiscal-year, and plan-status guardrails.
- 2026-03-29: Added deterministic helper coverage for rollups, budget-state mapping, category sanitization, toolbox generation, launch-context recovery, mode resolution, and workspace-record normalization.
- 2026-03-29: Regenerated Convex API types and passed `npx convex codegen`, `npm test`, `npm run lint`, and `npm run build`; also fixed a pre-existing lint issue in `webapp/convex/functions/deadlines.ts` that otherwise blocked the repo validation run.

### File List

- `_bmad-output/implementation-artifacts/epics/epic5/stories/5-2-blockly-workspace-core.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/.test-dist/lib/blockly/blockly-serialization.js`
- `webapp/.test-dist/lib/blockly/du-plan-routes.js`
- `webapp/.test-dist/lib/blockly/du-toolbox.js`
- `webapp/.test-dist/lib/blockly/du-workspace-calculations.js`
- `webapp/.test-dist/tests/department-user-blockly-workspace.test.js`
- `webapp/.test-dist/tests/run-tests.js`
- `webapp/app/(app)/du/plans/[planId]/page.tsx`
- `webapp/app/(app)/du/plans/new/page.tsx`
- `webapp/app/(app)/du/plans/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/deadlines.ts`
- `webapp/convex/functions/plans.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/blockly/block-definitions.ts`
- `webapp/lib/blockly/blockly-serialization.ts`
- `webapp/lib/blockly/du-plan-routes.ts`
- `webapp/lib/blockly/du-toolbox.ts`
- `webapp/lib/blockly/du-workspace-calculations.ts`
- `webapp/package-lock.json`
- `webapp/package.json`
- `webapp/src/components/blockly/BlocklyBudgetHeader.tsx`
- `webapp/src/components/blockly/BlocklyEditor.tsx`
- `webapp/src/components/blockly/BlocklyLoadingSkeleton.tsx`
- `webapp/src/components/blockly/BlocklyWorkspace.module.css`
- `webapp/src/components/blockly/BlocklyWorkspace.tsx`
- `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
- `webapp/tests/department-user-blockly-workspace.test.ts`
- `webapp/tests/run-tests.ts`

## Change Log

- 2026-03-29: Implemented the DU Blockly workspace core, persisted plan workspace JSON state, added deterministic helper coverage, and advanced the story to review.

### Story Completion Status

- Story ID: `5.2`
- Story Key: `5-2-blockly-workspace-core`
- Output File: `_bmad-output/implementation-artifacts/epics/epic5/stories/5-2-blockly-workspace-core.md`
- Final Status: `review`
- Completion Note: `DU Blockly workspace core implemented with lazy-loaded editor routes, live toolbox and budget calculations, JSON workspace persistence, and passing local validation`
