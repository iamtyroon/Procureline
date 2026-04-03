# Story 5.7: Blockly Toolbox & Block Management

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want the Blockly toolbox and workspace organization tools to stay usable as my catalog grows,
so that I can find items quickly, reorganize my plan safely, and keep large plans manageable without losing context.

## Acceptance Criteria

1. [Given] a DU opens an editable or read-only Blockly planning workspace [When] the toolbox renders [Then] categories appear in PO-configured order with Story 4.7 visual metadata [And] items inside each category follow Story 4.8 sort order instead of falling back to ad hoc alphabetical-only behavior (FR30d, FR40, current catalog contract).
2. [Given] the DU opens a toolbox category [When] its flyout renders [Then] each available item source block shows the current item name, unit, and unit price from the live catalog [And] archived or zero-active-item categories are surfaced truthfully as unavailable for fresh planning instead of appearing as misleading empty branches (FR41, Story 4.7, Story 4.8).
3. [Given] the DU needs to find an item quickly [When] they type into the toolbox search control [Then] matching items are filtered or highlighted across the selected categories [And] clearing the search restores the normal grouped toolbox without losing workspace state.
4. [Given] a DU drags a category block onto the workspace [When] no child items have been attached yet [Then] the category block shows a truthful empty-state hint such as `Drag items here` until the first item is nested [And] the hint clears automatically once the category contains an item.
5. [Given] a category is already placed on the workspace [When] toolbox content refreshes after block create, move, or delete events [Then] the toolbox reduces clutter by hiding or disabling duplicate category source blocks [And] removed categories become available again when their workspace instance is deleted [And] this lifecycle affordance does not replace the hard duplicate-prevention rules owned by Story 5.3.
6. [Given] the workspace contains multiple category blocks under the department block [When] the DU drags a category to a new position in that chain [Then] the category order updates in the live workspace without breaking block connections [And] the resulting order is preserved in saved Blockly JSON and restored on reload.
7. [Given] the workspace becomes crowded [When] the DU zooms or pans [Then] visible zoom controls, wheel zoom, and panning work reliably using Blockly-native configuration [And] the interaction does not require re-injecting the workspace or resetting placed blocks (FR39, NFR-P2).
8. [Given] the DU returns to the same plan on the same browser [When] the editor loads [Then] the last local zoom scale and canvas position for that plan are restored from browser storage [And] this viewport state remains local UI metadata rather than overwriting canonical plan data in Convex.
9. [Given] a DU removes a category block that still contains item blocks [When] the delete or trash action is triggered [Then] the UI shows an app-native confirmation explaining that the category and its nested items will be removed [And] cancel leaves the workspace unchanged [And] confirm removes the full nested branch cleanly.
10. [Given] a category or item is added, moved, or removed [When] the workspace settles after that interaction [Then] department totals, category totals, budget or compliance summaries, and toolbox source availability all refresh in the same interaction cycle so the DU never sees stale planning posture after reorganization (FR44, FR45, Story 5.6 contract).
11. [Given] an existing saved plan references archived categories or inactive items [When] the workspace and toolbox context are rebuilt for that plan [Then] those historical selections remain resolvable and visible in the existing-plan context [And] new source blocks still obey current active-catalog rules so Story 5.7 does not regress Story 4.7 and Story 4.8 lifecycle safety.
12. [Given] the workspace is open in read-only mode [When] toolbox-management features render [Then] search and category context remain visible for comprehension [And] drag-drop, reorder, and destructive block-removal actions are blocked truthfully instead of appearing interactive but failing silently.
13. [Given] the DU launches a brand-new plan from the launchpad [When] no categories are selected [Then] the workflow fails closed with a truthful blocked state instead of opening an empty editor [And] Story 5.7 keeps toolbox-management features aligned with that launch contract instead of allowing a blank workspace path to masquerade as valid planning context.
14. [Given] an existing plan is reopened for edit or read-only review [When] the workspace hydrates from saved Blockly JSON [Then] used-source tracking is rebuilt from the loaded category and item block identities before toolbox refresh runs [And] already-placed categories or items do not briefly reappear as available source blocks during hydration.
15. [Given] multiple categories can contain items with similar or identical display names over time [When] toolbox source usage, search results, or refresh logic decide whether a source block is already represented on the workspace [Then] that decision is anchored to stable category and item IDs rather than display text alone so Story 5.7 does not create false duplicate hiding or false source availability when names collide.
16. [Given] frequent Blockly events fire during drag-and-drop interactions [When] toolbox refresh logic responds to create, delete, or move events [Then] the implementation ignores UI-only events and debounces structural refresh work so the toolbox does not flicker, thrash, or regress interaction performance during normal editing.
17. [Given] plans can reach documented DU planning scale [When] toolbox search, source-lifecycle refresh, reordering, and viewport persistence run repeatedly [Then] the implementation avoids full Blockly reinjection for normal interactions and stays aligned with existing performance budgets for load time and block interaction latency (NFR-P1, NFR-P2, NFR-SC4).
18. [Given] Story 5.7 extends the current Blockly foundation rather than replacing it [When] implementation completes [Then] the repo contains deterministic automated coverage for toolbox ordering, search behavior, category empty-state hints, category reorder persistence, delete confirmation flows, viewport restore behavior, hydration-safe used-source lifecycle refresh, identity-collision edge cases, and read-only guardrails.

## Tasks / Subtasks

- [ ] Task 1: Extend the DU toolbox model into a first-class organization layer instead of keeping a static one-shot builder (AC: 1-5, 11-18)
  - [ ] Refactor `webapp/lib/blockly/du-toolbox.ts` so the toolbox builder can express ordered categories, ordered item blocks, unavailable states, search-aware filtering, and used-source lifecycle hints from one deterministic source of truth.
  - [ ] Preserve the current selected-category gating from the DU launchpad; Story 5.7 improves organization, not catalog scope.
  - [ ] Reuse `buildCategoryToolboxStyle(...)` from `webapp/lib/procurement-officer/categories.ts` so category icon and color styling continue to flow from PO-managed catalog metadata.
  - [ ] Keep the toolbox definition JSON-first, and choose one supported search approach: either a supported Blockly toolbox-search plugin or filtered JSON regeneration from app state, but not DOM scraping or mutation after render.
  - [ ] Preserve archived-category and zero-active-item semantics from Stories 4.7 and 4.8 so existing plans remain resolvable while fresh selection stays truthful.
  - [ ] Replace any text-only used-block tracking assumptions from the prototype with ID-based category and item source tracking so same-name collisions across categories do not corrupt toolbox availability.

- [ ] Task 2: Upgrade the editor-side toolbox rail from a static summary card into a usable block-management surface (AC: 1-5, 12-18)
  - [ ] Extend `webapp/src/components/blockly/BlocklyEditor.tsx` or extract a focused companion such as `webapp/src/components/blockly/BlocklyToolboxRail.tsx` so the current side rail can host search input, category counts, unavailable-state messaging, and used-source status.
  - [ ] Keep the current app-native shell, badges, and status language from Stories 5.2 and 5.6; do not replace the editor chrome with a second dashboard or modal layout.
  - [ ] Make search and lifecycle feedback accessible through visible labels, clear empty-state copy, and keyboard-reachable controls.
  - [ ] In read-only mode, keep the rail informative while disabling controls that imply block insertion or destructive changes.
  - [ ] Keep launchpad-to-editor workflow truthfulness intact: if the editor is entered without valid selected-category context for a new plan, the DU should still see the existing blocked-state recovery path rather than a half-configured toolbox panel.

- [ ] Task 3: Add workspace event handling for category reorder, used-source refresh, and truthful destructive actions (AC: 4-10, 12-18)
  - [ ] Extend `webapp/src/components/blockly/BlocklyWorkspace.tsx` so internal workspace events for create, move, and delete can refresh toolbox availability without forcing a full Blockly reinjection.
  - [ ] Preserve native Blockly statement-chain movement for category reordering under the department block instead of adding a second drag-and-drop library.
  - [ ] Intercept category-branch removal so deleting a category that still owns item blocks routes through an app-native confirmation flow before the nested branch is removed.
  - [ ] Keep non-destructive item and category moves on the canvas cheap: no route refresh, no workspace recreation, no save-loop storms.
  - [ ] Debounce toolbox refresh work and ignore UI-only Blockly events, mirroring the intent of the prototype's `duWorkspaceChangeListener()` without carrying over its DOM-coupled implementation.
  - [ ] Rebuild used-source state after workspace hydration for existing plans before the first interactive refresh so already-placed blocks do not leak back into the toolbox during initial load.

- [ ] Task 4: Extend block definitions and workspace helpers so empty-state and lifecycle signals live with the blocks they describe (AC: 4-6, 9-10, 14-18)
  - [ ] Update `webapp/lib/blockly/block-definitions.ts` so category blocks can render and clear an empty placeholder or warning affordance when they contain no item blocks.
  - [ ] Keep current `department_block`, `category_block`, and `item_block` naming and field contracts stable so saved JSON workspaces, rollup helpers, and tests do not break.
  - [ ] If additional serialized state is required for placeholder or lifecycle behavior, make it forward-compatible with `webapp/lib/blockly/blockly-serialization.ts`.
  - [ ] Ensure item and category removal still leaves `workspace-catalog-identity` reconciliation truthful for remaining blocks and does not orphan IDs inside the saved workspace tree.

- [ ] Task 5: Add plan-local viewport persistence without conflating UI state with canonical plan content (AC: 7-8, 12-18)
  - [ ] Add a focused helper such as `webapp/lib/blockly/workspace-ui-state.ts` to persist zoom scale and canvas position in browser storage keyed by plan and current user.
  - [ ] Restore that UI state on workspace mount after Blockly injection succeeds, and keep failure handling graceful if storage is missing or malformed.
  - [ ] Do not push viewport-only UI state into the canonical `plans.workspaceState` contract unless there is a compelling repo-wide reason; Story 5.4 still owns broader recovery semantics.

- [ ] Task 6: Preserve story boundaries and cross-story contracts so toolbox polish does not mutate into validation or recovery rewrites (AC: 5, 10-18)
  - [ ] Reuse `webapp/lib/blockly/workspace-save.ts`, `webapp/lib/blockly/du-workspace-calculations.ts`, and `webapp/lib/blockly/workspace-catalog-identity.ts` rather than creating parallel rollup or persistence paths.
  - [ ] Keep hard duplicate-prevention, quantity validation, and submission blocking in Stories 5.3 and 5.6; Story 5.7 may add organization affordances, but it must not replace those guardrails with UI-only hiding logic.
  - [ ] Keep current DU launchpad and plan-route behavior from Stories 5.1 and 5.2 intact so this story does not regress category-selection handoff, canonical-plan routing, or read-only workspace access.
  - [ ] Preserve export and submit workflow truthfulness from the current editor shell: toolbox-management changes must not break reserved toolbar actions, existing plan hydration, or the current save-and-review path just because organization logic changes.

- [ ] Task 7: Add deterministic guardrail tests for toolbox organization, lifecycle, and viewport behavior (AC: 1-18)
  - [ ] Extend `webapp/tests/department-user-blockly-workspace.test.ts` with coverage for category order preservation, toolbox search behavior, category empty-state hints, used-source hide or disable logic, reorder persistence, and category-removal confirmation.
  - [ ] Add pure helper coverage for any search-filter shaping, plan-keyed viewport storage, and category lifecycle refresh helpers introduced by this story.
  - [ ] Add regression tests proving archived categories or inactive items remain visible for existing plans while remaining unavailable for fresh toolbox sourcing.
  - [ ] Add editor tests proving read-only mode keeps context visible but blocks reorder and destructive actions honestly.
  - [ ] Add edge-case tests for ID-vs-name source tracking, hydration-safe used-source rebuild, no-selected-category launch blocking, and debounced refresh behavior under rapid Blockly move events.
  - [ ] Update `webapp/tests/run-tests.ts` if any new helper or suite modules are introduced.

## Dev Notes

### Story Foundation

- Epic 5 positions Story 5.7 as the maintainability and scalability layer on top of the DU Blockly editor after the core workspace and budget-awareness foundation already exists.
- In the live repo:
  - Story 5.2 delivered the DU Blockly workspace shell, JSON persistence, and the current toolbox builder.
  - Story 5.6 delivered shared rollups, budget or compliance feedback, and server-side recomputation from workspace JSON.
  - Story 4.7 delivered ordered, styled categories with archive-safe DU visibility rules.
  - Story 4.8 delivered richer item metadata, sort order, and stable item identity for DU planning.
- Story 5.7 should therefore improve toolbox organization, block lifecycle, and workspace ergonomics without rewriting validation (Story 5.3) or crash-recovery/autosave architecture (Story 5.4).

### Previous Story Intelligence

- Story 5.6 already proved the current DU editor can be extended safely through shared helper layers such as `du-workspace-calculations.ts`, `workspace-save.ts`, and `workspace-catalog-identity.ts`; Story 5.7 should reuse those seams instead of adding a second calculation or persistence path.
- Story 5.2 established the current Blockly host architecture:
  - thin App Router pages;
  - `DepartmentUserBlocklyWorkspace` route shell;
  - `BlocklyEditor` for chrome and save orchestration;
  - `BlocklyWorkspace` for actual Blockly injection and event handling.
- Story 4.7 established that category order and category styling are real tenant-managed data, not a UI convenience. Story 5.7 must honor those persisted fields in the DU toolbox.
- Story 4.8 established stable item IDs, per-category item ordering, and live price metadata. Story 5.7 should treat those catalog contracts as authoritative when shaping toolbox search and used-source lifecycle behavior.
- Important boundary: Story 5.3 still owns hard duplicate-prevention and entry-validation rules. Story 5.7 may hide or disable noisy source blocks for usability, but it must not rely on toolbox hiding as the only enforcement mechanism.

### Prototype Intelligence From `docs/html/procurelinedb.html`

- The prototype DU flow already scopes toolbox contents using `selectedCategories`, which matches the live launchpad-to-editor contract and must remain intact.
- The prototype includes `buildDUToolbox()` plus a toolbox refresh path after block create, move, and delete events. Story 5.7 should preserve that lifecycle idea, but express it through the current React-plus-helper architecture rather than monolithic DOM scripting.
- The prototype injects Blockly with native zoom controls and wheel zoom enabled. Story 5.7 should keep leaning on supported Blockly viewport controls instead of inventing a parallel canvas interaction layer.
- The prototype does not provide production-grade toolbox search, destructive-action confirmations, or browser-restored viewport state. Those gaps are exactly where Story 5.7 should add product-ready behavior.
- The prototype explicitly blocks DU launch when `selectedCategories.size === 0`. Story 5.7 should preserve that workflow truthfulness and avoid introducing a path where toolbox-management features quietly open against an empty new-plan context.
- The prototype refreshes DU toolbox availability through a debounced listener that reacts only to block create, delete, and move events. The production story should preserve that event-scope discipline, while replacing DOM-coupled refresh logic with typed helper-driven behavior.
- The prototype tracks used toolbox sources through `usedBlocksInWorkspace`, keyed by category name and item description. That is useful product intent, but it also reveals a production edge case: same-name collisions across categories would break source availability unless Story 5.7 upgrades tracking to stable IDs.
- The prototype clears used-source tracking on brand-new launch, but existing-plan edit flow needs the inverse behavior: Story 5.7 must rebuild used-source state from hydrated workspace data before the first toolbox refresh.

### Current Implementation State Discovered In Code

- `webapp/lib/blockly/du-toolbox.ts` already orders categories and items, preserves unavailable-category messaging, and applies category styling, but it still returns a mostly static toolbox definition with no search model, no used-source lifecycle shaping, and no read-only-specific organization behavior.
- `webapp/src/components/blockly/BlocklyEditor.tsx` already exposes a side rail for selected categories and department source context, but it is currently informational only. It does not yet host toolbox search, used-source state, or richer organization controls.
- `webapp/src/components/blockly/BlocklyWorkspace.tsx` already lazy-loads Blockly, injects the workspace with scrollbars, trashcan, and zoom controls, recalculates rollups on workspace events, and updates the toolbox when props change, but it does not yet refresh toolbox availability off internal create or move or delete events in a Story 5.7-specific way, and it does not restore viewport state from local storage.
- `webapp/lib/blockly/block-definitions.ts` currently defines `department_block`, `category_block`, and `item_block` with current Story 5.2 fields, but category blocks do not yet render the explicit `Drag items here` empty hint required by the epic.
- `webapp/lib/blockly/workspace-save.ts` and `webapp/convex/functions/plans.ts` currently persist canonical workspace JSON and summary data, but there is no dedicated local UI-state helper for per-plan zoom or pan restoration.
- Deletion currently relies on standard Blockly deletion or trashcan behavior. There is no category-specific confirmation flow before removing a nested category-plus-items branch.
- Current DU toolbox generation and workspace identity helpers are already ID-aware, which is good, but the story should now state explicitly that any new used-source tracking or search result logic must stay ID-anchored and not regress toward the prototype's text-keyed approach.
- Current new-plan route handling already fails closed when launch context is missing. Story 5.7 should keep that contract intact while enhancing the toolbox workflow rather than bypassing it with editor-local fallback state.

### Technical Requirements

- Keep `buildDepartmentUserToolbox(...)` as the single source of truth for DU toolbox structure. Do not create a second disconnected toolbox-generation path inside components.
- Preserve current selected-category gating from the DU dashboard launchpad. Story 5.7 organizes the toolbox; it does not broaden DU access to non-selected categories.
- Preserve category order from Story 4.7 and item order from Story 4.8. Once explicit sort order exists, the DU toolbox should not silently drift back to name-only ordering.
- Keep toolbox structure JSON-first, which aligns with official Blockly guidance for toolbox definitions.
- If toolbox search is implemented through a plugin, prefer the supported Blockly toolbox-search plugin over ad hoc DOM mutation. If it is implemented in app code, regenerate filtered JSON toolbox contents from the same underlying builder.
- Do not use toolbox hiding as the only duplicate-prevention mechanism. Hard validity rules for duplicate items, invalid quantities, and submission blocking still belong in Story 5.3 and Story 5.6.
- Keep category and item identity anchored to existing document IDs and the current `workspace-catalog-identity` helpers so reorder, search, or deletion features do not orphan saved workspaces.
- Keep historical plan visibility truthful:
  - archived categories or inactive items may remain visible in existing saved plans;
  - but fresh source blocks must still respect active-catalog rules for new planning.
- Use app-native confirmations, banners, dialogs, or toasts for destructive actions. Do not reintroduce prototype-style `alert()` or `confirm()` flows.
- Persist viewport-only UI state locally per plan and per user. Do not conflate zoom or pan restoration with canonical plan data unless there is a later product decision to do so.
- Avoid full Blockly reinjection for normal interactions such as search changes, category reorder, delete confirmation, and used-source refresh. Reinjection should stay a recovery path, not the steady-state update strategy.
- Keep read-only plans informative and stable: context, search, and category organization can remain visible, but no control should imply editing when editing is not allowed.
- Preserve Story 5.6 rollup truthfulness: reorder and block-lifecycle changes must continue to drive the same budget and compliance summary pipeline already in place.

### Architecture Compliance

- Keep page files thin and continue using the current DU planning shell:
  - `DepartmentUserBlocklyWorkspace`
  - `BlocklyEditor`
  - `BlocklyWorkspace`
- Keep authorization, tenant scoping, and canonical plan access in Convex functions; Story 5.7 is a client-heavy organization story, not a route-auth rewrite.
- Reuse existing Blockly JSON serialization and helper modules instead of introducing XML persistence or a second workspace representation.
- Preserve the current lazy Blockly-loading pattern in client components, consistent with Next.js guidance and Story 5.2.
- Keep future-story boundaries explicit:
  - Story 5.3 owns validation and duplicate prevention;
  - Story 5.4 owns broader autosave, recovery, and offline semantics;
  - Story 5.5 owns request-item handoff completion;
  - Story 6.1 owns real submission.

### Library And Framework Requirements

- Stay on the repo's installed stack for this story unless a separately approved dependency change is required:
  - Next.js `^16.1.6` in `webapp/package.json`
  - Convex `^1.13.2`
  - Blockly `^12.5.1`
  - React `^19.2.4`
  - `sonner` `^2.0.7`
- Use the current repo conventions:
  - dynamic Blockly loading with `next/dynamic` in client components;
  - shadcn/ui plus Tailwind for product UI;
  - helper-first logic for serialization, search shaping, and workspace state;
  - Convex queries and mutations for canonical state, browser storage only for local UI state.
- If a supported search plugin is added, keep it tightly scoped to Blockly toolbox behavior.
- Do not add a general drag-and-drop library for category reordering when native Blockly statement movement already handles the canvas-side ordering model.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/lib/blockly/block-definitions.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/blockly/blockly-serialization.ts`
  - `webapp/lib/blockly/workspace-catalog-identity.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
  - `webapp/src/components/blockly/BlocklyWorkspace.module.css`
  - `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
  - `webapp/tests/department-user-blockly-workspace.test.ts`

- Expected new files (recommended):
  - `webapp/lib/blockly/workspace-ui-state.ts`
  - `webapp/lib/blockly/toolbox-search.ts` if search shaping is extracted from `du-toolbox.ts`
  - `webapp/src/components/blockly/BlocklyToolboxRail.tsx` if the current editor sidebar is split into a focused component
  - `webapp/tests/blockly-workspace-ui-state.test.ts` if viewport persistence logic grows beyond lightweight inline coverage

### Testing Requirements

- Add pure helper tests for:
  - ordered toolbox shaping from category and item `sortOrder`;
  - toolbox search filtering and reset behavior;
  - used-source hide or disable logic;
  - category empty-state placeholder shaping;
  - per-plan viewport storage and malformed-storage fallback handling.
- Add workspace and editor regression tests for:
  - category reorder persistence through saved Blockly JSON;
  - category removal confirmation when nested items exist;
  - toolbox refresh after create, move, and delete events;
  - read-only mode keeping context visible while blocking editing controls honestly;
  - viewport restore on reopen without full workspace reinjection.
- Add DU lifecycle regression tests proving archived categories and inactive items remain visible for existing plans but unavailable for fresh toolbox sourcing.
- Keep existing rollup, budget, and compliance coverage green so Story 5.7 does not regress Story 5.6 behavior while reorganizing the workspace.
- Update `webapp/tests/run-tests.ts` if new suites are added.

### Git Intelligence Summary

- Recent git history reinforces the repo's current house style:
  - `a95f45e` expanded Story 4.8 item-management tests and touched DU Blockly identity seams, which is directly relevant because Story 5.7 must keep toolbox behavior aligned with stable item identity.
  - `a5bd004` established category-management ordering, styling, archive semantics, and DU launchpad/toolbox integration that Story 5.7 must extend rather than replace.
  - `b4cd44a` reinforced the team's pattern of focused feature modules, thin route contracts, and deterministic tests instead of broad architectural rewrites.
- Inference from the live repo state:
  - Story 5.7 should be implemented as a focused enhancement to current Blockly helpers and components, not as a second editor shell or a generic state-management rewrite.

### Latest Tech Information

- Verified on 2026-04-03:
  - Next.js official App Router docs remain current within the `16.x` line that the repo already uses.
  - Blockly toolbox docs still recommend JSON toolbox definitions and document category toolbox styling through `cssConfig`.
  - Blockly zoom docs still document native `controls`, `wheel`, `startScale`, `maxScale`, `minScale`, `scaleSpeed`, and `pinch` options for workspace scaling.
  - Blockly category-toolbox APIs still support disabling or hiding categories programmatically, which is relevant for used-source lifecycle shaping.
  - The supported `@blockly/toolbox-search` package on npm is current at `3.1.0`.
- Inference from official Blockly docs plus the current repo:
  - Story 5.7 can safely implement toolbox search either by adding the supported Blockly toolbox-search category plugin or by rebuilding filtered JSON toolbox contents from app state.
  - The lower-risk path is whichever option best preserves the current `buildDepartmentUserToolbox(...)` source of truth without DOM mutation.
- Keep repo versions stable for implementation:
  - Next.js `^16.1.6`
  - Convex `^1.13.2`
  - Blockly `^12.5.1`
- Do not opportunistically upgrade Convex, Next.js, or Blockly major lines inside Story 5.7. This is a workflow story, not an upgrade story.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and tenant enforcement
  - shadcn/ui plus Tailwind styling
  - desktop-only DU workspace behavior
  - Blockly block names in `snake_case`
  - JSON serialization for Blockly persistence
- Where older planning artifacts conflict with the live repo structure, prefer the current repo's file layout and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 5 Source](../epic-05-du-blockly-planning.md)
- [Story 5.2 Reference](./5-2-blockly-workspace-core.md)
- [Story 5.6 Reference](./5-6-budget-meter-calculations.md)
- [Story 4.7 Reference](../../epic4/stories/4-7-category-management.md)
- [Story 4.8 Reference](../../epic4/stories/4-8-item-catalog-management.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [DU Prototype](../../../../../docs/html/procurelinedb.html)
- [Current DU Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Current Blockly Host](../../../../../webapp/src/components/blockly/BlocklyWorkspace.tsx)
- [Current DU Workspace Route Shell](../../../../../webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx)
- [Current DU Dashboard](../../../../../webapp/src/components/department-user/DepartmentUserDashboard.tsx)
- [Current DU Toolbox Builder](../../../../../webapp/lib/blockly/du-toolbox.ts)
- [Current Block Definitions](../../../../../webapp/lib/blockly/block-definitions.ts)
- [Current Workspace Save Helpers](../../../../../webapp/lib/blockly/workspace-save.ts)
- [Current Workspace Identity Helpers](../../../../../webapp/lib/blockly/workspace-catalog-identity.ts)
- [Current Plan Functions](../../../../../webapp/convex/functions/plans.ts)
- [Current DU Dashboard Query](../../../../../webapp/convex/functions/departmentUserDashboard.ts)
- [Current DU Dashboard Snapshot](../../../../../webapp/lib/department-user/dashboard-snapshot.ts)
- [Current Category Helpers](../../../../../webapp/lib/procurement-officer/categories.ts)
- [Webapp Package Versions](../../../../../webapp/package.json)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Next.js Lazy Loading Guide](https://nextjs.org/docs/app/guides/lazy-loading)
- [Blockly Toolboxes Docs](https://developers.google.com/blockly/guides/configure/web/toolbox)
- [Blockly Category Appearance Docs](https://developers.google.com/blockly/guides/configure/web/toolboxes/appearance)
- [Blockly Disable/Hide Categories Docs](https://developers.google.com/blockly/guides/configure/web/toolboxes/disable-categories)
- [Blockly Zoom Docs](https://developers.google.com/blockly/guides/configure/web/zoom)
- [Blockly Toolbox Search Plugin](https://www.npmjs.com/package/@blockly/toolbox-search)

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
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-2-blockly-workspace-core.md`
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-6-budget-meter-calculations.md`
  - `_bmad-output/implementation-artifacts/epics/epic4/stories/4-7-category-management.md`
  - `_bmad-output/implementation-artifacts/epics/epic4/stories/4-8-item-catalog-management.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `docs/html/procurelinedb.html`
  - `webapp/package.json`
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/lib/blockly/block-definitions.ts`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/blockly/workspace-catalog-identity.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/categories.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
  - `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/tests/department-user-blockly-workspace.test.ts`
- Git context:
  - `git log -5 --oneline`
  - `git show --stat --oneline a95f45e`
  - `git show --stat --oneline a5bd004`
- Tech verification sources:
  - Next.js official docs
  - Blockly official docs
  - npm package page for `@blockly/toolbox-search`

### Completion Notes List

- 2026-04-03: Created implementation-ready story context for Story 5.7 with live repo analysis, explicit boundaries against Story 5.3 and Story 5.4, official Blockly toolbox and zoom guidance, and current DU editor extension seams.

### File List

- `_bmad-output/implementation-artifacts/epics/epic5/stories/5-7-blockly-toolbox-block-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Story Completion Status

- Story ID: `5.7`
- Story Key: `5-7-blockly-toolbox-block-management`
- Output File: `_bmad-output/implementation-artifacts/epics/epic5/stories/5-7-blockly-toolbox-block-management.md`
- Final Status: `ready-for-dev`
- Completion Note: `Ultimate context engine analysis completed - comprehensive developer guide created.`
