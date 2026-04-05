# Story 5.3: Blockly Validation & Constraints

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want the Blockly workspace to prevent invalid quantities, duplicate items, and stale catalog mistakes while I build,
so that my plan stays truthful, fixable, and ready for later submission without procurement guesswork.

## Acceptance Criteria

1. [Given] a Departmental User edits any quarterly quantity field in the Blockly workspace [When] the entered value is negative, blank, non-numeric, or otherwise invalid for the field contract [Then] the field normalizes safely to `0` and the user sees brief inline feedback such as `Quantity cannot be negative` instead of a silent failure or a broken total state (FR39a, NFR-S7).
2. [Given] a procurement item uses a discrete unit from the live catalog vocabulary, including `each`, `box`, `ream`, `set`, `pair`, and any custom or unknown unit that does not resolve to a decimal-safe family [When] the Departmental User enters a quarterly quantity [Then] the field accepts whole numbers only and blocks decimal precision at entry time [And] decimal-friendly units such as `kg` and `liter` still allow fractional values through the same shared validator contract (FR39b, Story 4.8 unit rules).
3. [Given] a procurement item exposes configured quantity limits from the existing catalog schema [When] the Departmental User enters or hydrates a value outside that supported range [Then] the workspace enforces `maxQuantity` directly with truthful feedback such as `Maximum quantity is [limit]` [And] any configured non-zero `minQuantity` is preserved in the shared validation contract as a truthful issue or future-rule input instead of being dropped on the floor or silently applied at the wrong scope [And] the current repo's existing `minQuantity` and `maxQuantity` metadata are threaded into the DU editor instead of duplicated in a second validation store (FR39c, Story 4.8 item schema).
4. [Given] the plan is over budget [When] the reserved submit affordance or a later submit-readiness contract is evaluated [Then] the same shared validation state used by Story 5.6 marks the plan as blocked for submission and surfaces the real over-budget reason [And] Story 5.3 does not fake the final submit workflow before Story 6.1 lands (FR39d, FR46, Story 5.6 boundary).
5. [Given] a Departmental User drags, pastes, or hydrates an item block into a category that already contains the same live procurement item [When] the workspace resolves that operation [Then] newly introduced duplicates are prevented or immediately reversed and the user sees `Item already in this category` [And] if a legacy saved workspace already contains the duplicate, the plan stays intact long enough to warn and fix it rather than silently deleting saved work during hydration [And] the rule is enforced by stable item identity within the category, not by display text alone (FR39k, Story 4.8 stable item IDs).
6. [Given] different categories may legitimately contain items with the same visible name or description [When] duplicate-prevention logic runs [Then] it keys off category plus item identity so valid cross-category matches are not blocked and historical saved plans do not become false duplicates because names collide (Story 5.7 identity rules).
7. [Given] a Procurement Officer archives, removes, or deactivates an item from the live catalog while a Departmental User still has that item on the canvas [When] reactive catalog data refreshes [Then] the DU sees a toast or equivalent app-native notice, the affected block enters a removed or unavailable warning state, and the plan remains visibly fixable instead of silently dropping the item from the workspace or totals (FR39m, FR34a).
8. [Given] live catalog metadata that affects validation changes while the workspace is open, including unit type, quantity limits, or lifecycle state [When] the editor receives the reactive update [Then] existing blocks are revalidated without full workspace reinjection [And] warnings appear when the newer rules make a block invalid and clear again when the catalog becomes permissive enough for the block to be valid [And] the DU sees the updated validation posture within the current performance budget for editor interactions (NFR-P2, NFR-P3, Story 5.6 recalculation seam).
9. [Given] a draft or read-only plan is reopened with stale catalog references or legacy saved values [When] the workspace hydrates [Then] invalid values are normalized safely, warnings remain truthful, and the UI does not imply the plan is valid merely because editing is disabled or because the saved snapshot predates newer catalog rules (current read-only contract, Story 5.6 persisted-summary truthfulness).
10. [Given] validation feedback appears during block editing [When] accessibility needs apply [Then] warnings, helper text, blocked reasons, and state changes do not rely on color alone and meaningful changes are exposed through accessible copy plus `aria-live` announcements rather than firing noisy messages on every keystroke (NFR-A1, UX accessibility guidance).
11. [Given] draft-save logic now evaluates Blockly JSON on the server [When] validation-sensitive workspace state is derived from serialized data, including moments when duplicate-reversal or catalog-refresh events overlap with debounced persistence [Then] the client and Convex reuse the same validation contract for quantities, duplicates, removed items, `minQuantity` truthfulness, and submit-readiness rules [And] persisted validation state reflects the settled post-guardrail workspace instead of a transient client-only snapshot or duplicated rule implementation (architecture centralized-logic guidance, Story 5.6 save-path pattern).
12. [Given] Story 5.3 completes [When] automated coverage runs [Then] the repo contains deterministic tests for negative input normalization, discrete-versus-decimal unit behavior, max-quantity enforcement, duplicate prevention, removed-item invalidation, read-only truthfulness, and shared submit-block reasons so later submission and recovery stories build on a stable validation foundation.

## Tasks / Subtasks

- [x] Task 1: Introduce one shared DU workspace validation contract instead of scattering ad hoc checks across components (AC: 1-12)
  - [x] Add a focused helper such as `webapp/lib/blockly/workspace-validation.ts` that can evaluate live Blockly blocks and serialized workspace JSON into one issue model plus submit-readiness contract.
  - [x] Keep budget blocking integrated with the current Story 5.6 budget state instead of creating a second competing submit-readiness pipeline for over-budget plans.
  - [x] Reuse existing item-domain messages and unit-normalization helpers from `webapp/lib/procurement-officer/items.ts` where they already express catalog truth, rather than hardcoding a second vocabulary of item-validation strings in the Blockly layer.

- [x] Task 2: Thread live item-validation metadata all the way into the DU Blockly surface (AC: 2, 3, 7, 8, 9, 11)
  - [x] Extend the DU plan workspace item contracts so `maxQuantity`, `minQuantity`, `isActive`, and any validation-relevant lifecycle metadata already present in Convex actually reach the client-side Blockly helpers.
  - [x] Update `webapp/lib/blockly/workspace-catalog-identity.ts` so catalog synchronization refreshes unit, limit, and active-state metadata alongside price and compliance fields.
  - [x] If Blockly needs hidden fields to persist validation-relevant metadata across save and hydration, add them in `webapp/lib/blockly/block-definitions.ts` in a forward-compatible way instead of inventing a sidecar store disconnected from the blocks.

- [x] Task 3: Add quantity-field validators that enforce unit semantics and quantity limits at the point of entry (AC: 1, 2, 3, 8, 9, 10)
  - [x] Use Blockly-supported field validation patterns on the existing `Q1_QTY` through `Q4_QTY` fields so negative values, disallowed decimals, and over-limit entries are blocked or normalized immediately inside the block editor.
  - [x] Preserve current live totals and collapse behavior from Story 5.2 while adding validation feedback that does not break keyboard navigation or read-only rendering.
  - [x] Route hydrated or pasted quantity values that bypass keystroke-time validators, including decimal leftovers on discrete units or malformed numeric payloads, through the same shared normalization contract instead of leaving the save path to rediscover them later.
  - [x] Keep the validation helper extensible so Story 6.2 can later add deeper submission-completeness checks without rewriting quarter-field validation from scratch.

- [x] Task 4: Enforce structural duplicate and stale-item guardrails in workspace event handling, not just in toolbox presentation (AC: 5, 6, 7, 8, 11)
  - [x] Extend the current Blockly event pipeline so create, move, paste, and hydration flows can detect a duplicate item inside the same category and reverse or block the invalid structural change deterministically.
  - [x] Keep Story 5.7 toolbox hiding as an ergonomics enhancement only; duplicate prevention must still hold if source-hiding regresses, a saved workspace is pasted, or a legacy plan reopens with conflicting state.
  - [x] Treat duplicates already present in older saved workspaces as fixable validation findings first, not silent deletions during hydration, so users can see and repair the problem without losing saved intent.
  - [x] Mark removed or inactive catalog items as validation issues without silently deleting the block from the user's plan, preserving a fixable workspace instead of a disappearing one.

- [x] Task 5: Surface truthful validation feedback in the editor shell and save path without stealing scope from later stories (AC: 4, 7, 8, 9, 10, 11)
  - [x] Extend `webapp/src/components/blockly/BlocklyWorkspace.tsx` and `webapp/src/components/blockly/BlocklyEditor.tsx` so item-level validation issues produce app-native toasts, block warnings, and reserved-submit reasons that stay consistent with current budget feedback.
  - [x] Keep `webapp/lib/blockly/workspace-save.ts` and `webapp/convex/functions/plans.ts` anchored to the shared serialized-workspace summary contract so server-side draft persistence reuses the same validation results instead of drifting into a second save-path rule set.
  - [x] Ensure debounced draft persistence never snapshots a transient pre-reversal duplicate state or stale pre-refresh validation result when workspace guardrails and reactive catalog updates fire close together.
  - [x] Keep malformed outer payloads failing closed as they already do, but do not silently strip legitimate DU work from drafts merely because business-rule issues need correction; instead preserve the workspace and surface truthful validation state for later fixing.
  - [x] Preserve story boundaries explicitly:
    - Story 5.4 still owns autosave, offline queue, and broader recovery behavior.
    - Story 6.1 still owns the real submit mutation and final confirmation flow.

- [x] Task 6: Add deterministic guardrail tests for quantity, duplicate, lifecycle, and submit-readiness behavior (AC: 1-12)
  - [x] Extend `webapp/tests/department-user-blockly-workspace.test.ts` with coverage for negative normalization, discrete-unit integer enforcement, decimal-safe unit behavior, max-quantity blocking, duplicate-item rejection, and removed-item warning states.
  - [x] Add direct pure-helper coverage for any new shared validation module so client-side and server-side validation stay aligned.
  - [x] Add regression tests proving read-only or reopened plans still surface truthful validation state and reserved-submit blocking after hydration.
  - [x] Update `webapp/tests/run-tests.ts` if any new suite is introduced.

## Dev Notes

### Story Foundation

- Epic 5 positions Story 5.3 as the guardrail layer that makes the DU Blockly workspace hard to misuse after Story 5.2 delivered the editing surface and Story 5.6 delivered budget/compliance feedback.
- In the current execution sequence, Story 5.7 is already in review and Story 5.6 is done, so Story 5.3 must strengthen validity rules without undoing the newer toolbox-organization or budget-summary work that already landed nearby.
- This story should make invalid plan states harder to create and easier to correct, while deliberately avoiding scope theft from:
  - Story 5.4 autosave and recovery
  - Story 5.5 request-item workflow completion
  - Story 6.1 real plan submission
  - Story 6.2 deeper submission-completeness validation

### Previous Story Intelligence

- Story 5.2 established the core DU Blockly shell, JSON serialization, block grammar, live rollup path, and route-guard contract. Story 5.3 should extend that foundation rather than replace the editor architecture.
- Story 5.6 already centralized budget and compliance rollups and moved server-side draft persistence away from trusting client-supplied totals. Story 5.3 should reuse that helper-first pattern for validation rules rather than building a second editor-state machine.
- Story 5.7 already improved toolbox search, source-usage tracking, delete confirmation, and viewport persistence. It explicitly states that source hiding is not the hard duplicate-prevention mechanism. Story 5.3 now needs to supply the actual enforcement.
- Story 4.8 already introduced the most important catalog-side validation data:
  - bounded unit vocabulary and unit normalization helpers
  - `minQuantity` and `maxQuantity`
  - stable item IDs
  - `isActive` and price-change metadata
  - deterministic item-domain validation copy

### Prototype Intelligence From `docs/html/procurelinedb.html`

- The prototype already uses `Blockly.FieldNumber(0, 0)` on DU quarter inputs, which prevents negative numeric input but does not solve discrete-vs-decimal rules, dynamic max limits, duplicate prevention, or removed-catalog invalidation.
- The prototype's `updateTotalsDU(...)` traversal proves the intended real-time feedback model: ignore UI-only events, walk the department-category-item chain, update totals immediately, and apply over-budget warnings directly on the department block.
- The prototype's toolbox logic only hides used blocks by category name or item description. That is useful UX intent, but it is not durable enough to satisfy FR39k in production because it can be bypassed by hydration, name collisions, or future editor changes.
- The prototype does not define a production-ready removed-item flow. Story 5.3 should therefore keep the user-visible intent from the PRD and live stories, not the gaps in the HTML prototype.

### Current Implementation State Discovered In Code

- `webapp/lib/blockly/block-definitions.ts` currently defines `Q1_QTY` through `Q4_QTY` as `Blockly.FieldNumber(0, 0)` inputs. This means:
  - negative numeric input is already partially guarded,
  - but decimal policy is still static,
  - max-quantity enforcement is still absent,
  - and there is no item-specific validator contract yet.
- `webapp/lib/blockly/du-workspace-calculations.ts` currently:
  - sanitizes non-negative numbers when recomputing rollups,
  - owns the shared budget state,
  - and exposes reserved-submit blocking for `over_budget`, `unallocated`, and `view` modes,
  - but it does not yet express duplicate-item or removed-item validation issues.
- `webapp/lib/blockly/workspace-catalog-identity.ts` already refreshes live item metadata such as names, descriptions, compliance flags, unit of measurement, price, procurement method, and source of funds, but it does not currently sync `maxQuantity`, `minQuantity`, or item lifecycle warnings into the block state.
- `webapp/src/components/blockly/BlocklyWorkspace.tsx` already has the right extension seam for this story:
  - lazy Blockly initialization,
  - live recalculation on change events,
  - structural refresh hooks,
  - debounced persistence,
  - and a non-reinjection event pipeline.
- `webapp/src/components/blockly/BlocklyEditor.tsx` already keeps a live `aria-live` announcement region and reserved-submit messaging, so Story 5.3 should extend that existing feedback surface instead of inventing a new notification stack.
- `webapp/lib/blockly/du-toolbox.ts` already hides used source blocks by stable category or item IDs. That helps organization, but it must not become the only duplicate-prevention mechanism.
- `webapp/convex/functions/plans.ts` already returns DU workspace catalog items with `maxQuantity`, `minQuantity`, `isActive`, and `lastPriceChangedAt`, but the current Blockly helper types and component props are not yet consuming the full validation-relevant shape.
- `webapp/lib/procurement-officer/items.ts` already defines reusable item-domain messages and helpers, including:
  - supported unit vocabulary,
  - quantity-range error strings,
  - compliance normalization,
  - and the existing catalog price-change notice.
  Story 5.3 should reuse this vocabulary where it reflects current product truth.

### Technical Requirements

- Reuse the current DU Blockly architecture and helper boundaries:
  - `BlocklyEditor`
  - `BlocklyWorkspace`
  - `workspace-save`
  - `workspace-catalog-identity`
  - `du-workspace-calculations`
- Do not create a second detached validation state store in React only. Validation rules should be derivable from live blocks and serialized workspace JSON.
- Keep over-budget logic anchored to the current Story 5.6 budget-state contract; do not fork submission blocking into a separate implementation for Story 5.3.
- Enforce duplicates by stable identity, not by label text. Same-name items across categories must remain valid.
- Preserve a fixable workspace when catalog items become inactive or unavailable. The user should see the problem and correct it, not lose the block silently.
- Keep feedback app-native:
  - no `alert()`
  - no `confirm()`
  - no DOM-scraped custom tooltips outside the current UI stack
- Assumption for this story unless product direction changes later:
  - `maxQuantity` applies to each quarter quantity input because the current DU editing model exposes quarter-level fields and there is no separate annual-cap field in the live schema.
  - `minQuantity` must remain available to validation shaping and persisted truthfulness, but this story should not invent a quarter-level hard-stop rule unless product direction explicitly clarifies that scope.
  - The shared validation helper should remain extensible so later submission stories can add cross-quarter or whole-plan completeness checks without redoing the field-level validation layer.
- Safe default for unit precision:
  - `kg` and `liter` may allow decimal quantities.
  - Discrete units such as `each`, `box`, `ream`, `set`, and `pair` stay integer-only.
  - Unknown or custom units fail safe to integer-only unless the existing normalization rules explicitly map them into a decimal-friendly family.
- Validation issue state must be reversible:
  - if an item is reactivated, a limit is relaxed, or a unit change makes the current value valid again, stale warnings should clear without requiring workspace reinjection.
- Story 5.3 should not require a schema rewrite to duplicate quantity-limit metadata that already exists on `procurementItems`.

### Architecture Compliance

- Keep authorization and tenant scoping in Convex, not in client-only guard code.
- Keep page files thin and route structure unchanged; this story is an editor-behavior enhancement, not a routing story.
- Preserve JSON Blockly persistence. Do not introduce XML or a second serialization format for validation.
- Follow the repo's helper-first pattern: pure modules for rule evaluation, components for presentation, Convex for authoritative persistence and access control.
- Preserve the existing lazy Blockly-loading pattern and browser-only component boundaries documented in Story 5.2 and current Next.js guidance.

### Library And Framework Requirements

- Stay on the repo's installed stack unless a separate dependency change is explicitly approved:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - Blockly `^12.5.1`
  - `sonner` `^2.0.7`
  - `zod` `^3.22.4`
- Verified on 2026-04-05:
  - `npm view next version` returns `16.2.2`
  - `npm view convex version` returns `1.34.1`
  - local `npm view blockly version` timed out twice in this workspace, so do not treat Story 5.3 as a dependency-upgrade story on that basis
- Official Blockly guidance remains directly relevant to this story:
  - number fields support `min`, `max`, and `precision`
  - validators can normalize or reject field values
  - connection checks can restrict legal block relationships
  - warning text can be attached directly to blocks
- Inference from those sources plus the live repo:
  - Story 5.3 should implement quantity and structural rules with Blockly-native validators, connection checks, warnings, and helper-driven event handling rather than custom DOM inputs or modal-based validation for every field edit.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/lib/blockly/block-definitions.ts`
  - `webapp/lib/blockly/workspace-catalog-identity.ts`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/blockly/workspace-events.ts`
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyWorkspace.module.css`
  - `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
  - `webapp/convex/functions/plans.ts`
  - `webapp/lib/procurement-officer/items.ts`
  - `webapp/tests/department-user-blockly-workspace.test.ts`

- Expected new files (recommended):
  - `webapp/lib/blockly/workspace-validation.ts`
  - `webapp/tests/blockly-workspace-validation.test.ts` if the validation helper grows beyond lightweight inline coverage

### Testing Requirements

- Add pure helper tests for:
  - negative-value normalization
  - discrete-unit integer enforcement
  - decimal-safe unit behavior
  - max-quantity enforcement
  - duplicate detection by stable item identity
  - removed or inactive-item issue shaping
- Add editor or workspace regression tests for:
  - duplicate create or move reversal
  - legacy duplicate hydration surfacing a fixable issue without deleting saved work
  - read-only validation truthfulness
  - catalog-removal toast or warning handling
  - warning-state clearing after reactivation or limit relaxation
  - reserved-submit reasons that merge budget and validation state honestly
- Add persistence-path tests proving the server-side draft-save flow can derive the same validation posture from serialized Blockly JSON.
- Add persistence timing tests proving debounced save records the settled post-guardrail workspace after duplicate reversal or reactive catalog refreshes.
- Keep Story 5.6 budget and compliance tests green so Story 5.3 does not regress the current calculation foundation while adding guardrails.

### Git Intelligence Summary

- Recent DU Blockly work continues to reinforce a consistent repo house style:
  - `caf9721` added shared budget/compliance calculations, server-side summary recomputation, and editor feedback surfaces.
  - `0108dee` added toolbox search, source-usage lifecycle tracking, delete confirmation, and viewport persistence without replacing the editor shell.
- Inference from those commits and the current codebase:
  - Story 5.3 should land as focused helper and component extensions inside the existing DU editor flow.
  - A broad rewrite of the Blockly shell, persistence model, or route structure would cut across the direction of the last two DU editor stories and raise unnecessary regression risk.

### Latest Tech Information

- Verified on 2026-04-05 with current official documentation and registry checks:
  - Next.js still treats pages and layouts as Server Components by default and reserves Client Components for browser APIs and interactive state, which remains the right pattern for the Blockly editor surface.
  - Blockly number-field docs document `min`, `max`, and `precision` constraints for numeric inputs.
  - Blockly validator docs document local and class validators as the supported mechanism for normalizing or rejecting field values.
  - Blockly connection-check docs document `setCheck(...)` for restricting valid block connections.
  - Blockly warning-text docs still document `setWarningText(text, id?)`, which fits item-level and department-level validation feedback already used in the current codebase.
- Inference:
  - Story 5.3 should solve quantity-entry and duplicate-structure rules with Blockly-native field and block APIs, not with overlay forms or DOM mutation outside Blockly.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - shadcn/ui plus Tailwind styling
  - `sonner` for transient user feedback
  - Blockly block names in `snake_case`
  - JSON serialization for Blockly persistence
- Where older planning artifacts conflict with the live repo structure, prefer the live repo's current file layout and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 5 Source](../epic-05-du-blockly-planning.md)
- [Story 5.2 Reference](./5-2-blockly-workspace-core.md)
- [Story 5.6 Reference](./5-6-budget-meter-calculations.md)
- [Story 5.7 Reference](./5-7-blockly-toolbox-block-management.md)
- [Story 4.8 Reference](../../epic4/stories/4-8-item-catalog-management.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [DU Prototype](../../../../../docs/html/procurelinedb.html)
- [Current Block Definitions](../../../../../webapp/lib/blockly/block-definitions.ts)
- [Current Workspace Identity Helpers](../../../../../webapp/lib/blockly/workspace-catalog-identity.ts)
- [Current Workspace Calculations](../../../../../webapp/lib/blockly/du-workspace-calculations.ts)
- [Current Workspace Save Helpers](../../../../../webapp/lib/blockly/workspace-save.ts)
- [Current Workspace Event Helpers](../../../../../webapp/lib/blockly/workspace-events.ts)
- [Current DU Toolbox Builder](../../../../../webapp/lib/blockly/du-toolbox.ts)
- [Current DU Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Current Blockly Host](../../../../../webapp/src/components/blockly/BlocklyWorkspace.tsx)
- [Current DU Workspace Route Shell](../../../../../webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx)
- [Current Plan Functions](../../../../../webapp/convex/functions/plans.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Current Item Domain Helpers](../../../../../webapp/lib/procurement-officer/items.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Next.js Server And Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Blockly Number Fields](https://developers.google.com/blockly/guides/create-custom-blocks/fields/built-in-fields/number)
- [Blockly Validators](https://developers.google.com/blockly/guides/create-custom-blocks/fields/validators)
- [Blockly Connection Checks](https://developers.google.com/blockly/guides/create-custom-blocks/inputs/connection-checks)
- [Blockly setWarningText Reference](https://developers.google.com/blockly/reference/js/blockly.blocksvg_class.setwarningtext_1_method)

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
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-7-blockly-toolbox-block-management.md`
  - `_bmad-output/implementation-artifacts/epics/epic4/stories/4-8-item-catalog-management.md`
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
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/lib/blockly/du-workspace-calculations.ts`
  - `webapp/lib/blockly/workspace-catalog-identity.ts`
  - `webapp/lib/blockly/workspace-events.ts`
  - `webapp/lib/blockly/workspace-save.ts`
  - `webapp/lib/procurement-officer/items.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyWorkspace.tsx`
  - `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
  - `webapp/tests/department-user-blockly-workspace.test.ts`
- Git context:
  - `git log -5 --oneline`
  - `git show --stat --oneline caf9721`
  - `git show --stat --oneline 0108dee`
- Latest-tech verification:
  - `cmd /c npm view next version`
  - `cmd /c npm view convex version`
  - `cmd /c npm view blockly version` (timed out locally)
  - official Next.js and Blockly documentation pages listed above

### Completion Notes List

- 2026-04-05: Created implementation-ready story context for `5-3-blockly-validation-constraints` using live repo analysis, DU Blockly prototype review, recent Epic 5 story learnings, and current official Blockly or Next.js guidance.
- 2026-04-05: Anchored the story to the current DU editor seams that already exist in `BlocklyWorkspace`, `BlocklyEditor`, `workspace-save`, and `workspace-catalog-identity` so the next implementation extends the live product instead of reinventing the editor stack.
- 2026-04-05: Clarified the boundary that toolbox hiding from Story 5.7 is ergonomic only and that Story 5.3 must deliver the actual duplicate-prevention and quantity-validation contract.
- 2026-04-05: Updated sprint tracking so Story 5.3 is ready for development.
- 2026-04-05: Patched the story after an edge-case review to cover legacy duplicate hydration, reversible warning clearing, `minQuantity` truthfulness, and debounced save timing against transient invalid states.
- 2026-04-05: Implemented a shared Blockly workspace validation contract that normalizes quarter quantities, enforces integer-only versus decimal-safe units, preserves `minQuantity` truthfulness, and merges validation blockers with the Story 5.6 budget state.
- 2026-04-05: Threaded `maxQuantity`, `minQuantity`, and active-state metadata through the toolbox, hidden item-block fields, live catalog synchronization, and workspace rollups so client and persisted JSON revalidation reuse the same rule inputs.
- 2026-04-05: Added duplicate guardrails and warning feedback that reverse new same-category duplicates, preserve legacy duplicates as fixable warnings during hydration, announce catalog lifecycle changes through app-native toasts, and keep reserved-submit messaging truthful.
- 2026-04-05: Added deterministic pure-helper and Blockly workspace regression coverage for quantity normalization, duplicate detection, inactive-item blocking, read-only truthfulness, and shared submit-block reasons.
- 2026-04-05: Follow-up fixes after code review now preserve one-cycle inline quantity-normalization feedback, scope catalog-change toasts to items actually on the canvas, and surface a truthful validation-unavailable notice when only persisted plan summaries remain.
- 2026-04-05: `cmd /c npm test` passed after the Story 5.3 changes. `cmd /c npm run lint` still reports pre-existing type errors in `webapp/convex/functions/items.ts` and `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx` that were outside this story's edit scope.

### File List

- `_bmad-output/implementation-artifacts/epics/epic5/stories/5-3-blockly-validation-constraints.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/.test-dist/lib/blockly/du-toolbox.js`
- `webapp/.test-dist/lib/blockly/du-workspace-calculations.js`
- `webapp/.test-dist/lib/blockly/workspace-catalog-identity.js`
- `webapp/.test-dist/lib/blockly/workspace-validation.js`
- `webapp/.test-dist/lib/procurement-officer/items.js`
- `webapp/.test-dist/tests/blockly-workspace-validation.test.js`
- `webapp/.test-dist/tests/run-tests.js`
- `webapp/lib/blockly/block-definitions.ts`
- `webapp/lib/blockly/du-toolbox.ts`
- `webapp/lib/blockly/du-workspace-calculations.ts`
- `webapp/lib/blockly/workspace-catalog-identity.ts`
- `webapp/lib/blockly/workspace-validation.ts`
- `webapp/lib/procurement-officer/items.ts`
- `webapp/src/components/blockly/BlocklyEditor.tsx`
- `webapp/src/components/blockly/BlocklyWorkspace.tsx`
- `webapp/tests/department-user-blockly-workspace.test.ts`
- `webapp/tests/blockly-workspace-validation.test.ts`
- `webapp/tests/run-tests.ts`

### Change Log

- 2026-04-05: Added shared Blockly validation helpers, quantity-field validators, hidden item metadata threading, duplicate reversal, lifecycle warnings, truthful submit blocking, and matching regression coverage for Story 5.3.
- 2026-04-05: Addressed code-review follow-ups for transient quantity feedback, workspace-scoped catalog notices, persisted-summary validation truthfulness, and expanded Blockly regression coverage.

### Story Completion Status

- Story ID: `5.3`
- Story Key: `5-3-blockly-validation-constraints`
- Output File: `_bmad-output/implementation-artifacts/epics/epic5/stories/5-3-blockly-validation-constraints.md`
- Final Status: `review`
- Completion Note: `Story 5.3 now ships shared Blockly validation, duplicate guardrails, lifecycle warnings, truthful submit blocking, and deterministic regression coverage; repo lint is still blocked by unrelated pre-existing type errors outside this story's files.`
