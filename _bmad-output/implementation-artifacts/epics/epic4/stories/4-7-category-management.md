# Story 4.7: Category Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to create and manage procurement categories,
so that the tenant catalog stays organized for DU planning, Blockly surfaces reflect the intended hierarchy, and category lifecycle changes do not break existing plans.

## Acceptance Criteria

1. [Given] a Procurement Officer opens `/po/categories` [When] the current protected PO workspace resolves through the existing dashboard-modal contract [Then] the route renders a real category-management workspace instead of the current empty placeholder state [And] `/po` remains the canonical Procurement Officer shell (FR30, FR28, current repo pattern).
2. [Given] the Procurement Officer creates or edits a category [When] they submit the category form [Then] the workspace accepts `name` as required and `description` as optional [And] the backend stores tenant-scoped normalized identity for uniqueness checks instead of relying on UI-only validation (FR30, FR30a).
3. [Given] the Procurement Officer configures Blockly-facing visual settings [When] they edit a category [Then] they can assign a category color and icon treatment for visual distinction [And] the workspace shows a truthful preview of how the category will appear in the Blockly toolbox using the same metadata shape the DU toolbox builder consumes (FR30b).
4. [Given] a category name already exists for the same tenant [When] the Procurement Officer attempts create or rename [Then] the backend rejects the operation with a deterministic `Category name already exists` style error [And] cross-tenant names remain isolated (FR30a, NFR-S1).
5. [Given] the tenant is on Free, Starter, Professional, or Enterprise [When] the Procurement Officer attempts to create categories past the plan limit [Then] the system enforces the live tier caps of Free `20`, Starter `60`, Professional `200`, and Enterprise `unlimited` [And] the modal copy includes the correct upgrade path plus `View Plans` CTA to `/pricing` (FR30 tier limits, FR77, live pricing catalog).
6. [Given] the Procurement Officer wants to bulk add categories [When] they download or upload the category workbook [Then] the flow reuses the existing Convex-to-NestJS Excel bridge, supports the approved template columns `Name`, `Description`, and `Color`, validates each row independently, preserves successful rows, and returns row-level failures plus a summary instead of failing the whole file blindly (FR30c, Story 2.0 dependency).
7. [Given] the Procurement Officer opens the categories workspace with existing data [When] the list renders [Then] categories are presented in a compact management list that surfaces at least the category name and live item count per row [And] the empty state keeps the prototype's clear `+ New` recovery path instead of a dead-end placeholder.
8. [Given] the Procurement Officer reorders categories [When] they save the updated order [Then] the persisted order is reflected in the PO workspace, DU launchpad category list, and Blockly toolbox category sequence for new planning sessions [And] order is not left to alphabetical fallback once explicit category ordering exists (FR30d).
9. [Given] the Procurement Officer opens create or edit category flow [When] they need to continue into item management from that dialog [Then] the UI preserves the prototype's one-flow handoff by exposing a `Category Items` action in both modes [And] draft category context is preserved across the handoff instead of being lost if the category is not yet finally saved.
10. [Given] the Procurement Officer edits a category already referenced by draft, submitted, rejected, or approved plans [When] they open the edit flow [Then] the workspace displays an active-plan impact warning before save [And] the implementation keeps category document IDs stable so existing plan references do not orphan or drift silently (FR31a).
11. [Given] the Procurement Officer attempts to delete a category that still has assigned items [When] the delete mutation runs [Then] the backend blocks deletion with guidance to reassign or remove items first [And] the UI surfaces the blocker honestly instead of pretending the category is safe to remove (FR32a).
12. [Given] the Procurement Officer attempts to delete a category used in draft, rejected, submitted, or approved plans [When] the delete mutation runs [Then] the backend blocks hard deletion with a deterministic active-plan error [And] the UI directs the operator toward archive or reassignment instead of allowing plan references to break silently.
13. [Given] the Procurement Officer archives a category [When] the archive succeeds [Then] that category disappears from new DU plan selection and new toolbox seeds [And] it remains visible in existing plans, current plan read models, and historical references with an archived indicator instead of being silently stripped out of saved selections (FR32c).
14. [Given] archived categories are excluded from new-plan availability [When] category tier caps are enforced for create or import [Then] only non-archived categories count against the usable catalog limit [And] archiving a category frees capacity for a replacement without deleting history.
15. [Given] a DU already has an existing draft, rejected, submitted, or approved plan that references an archived category [When] that plan is opened or summarized [Then] the category remains resolvable by ID for that plan context [And] the story does not regress current launchpad, toolbox, summary, or budget-breakdown behavior by dropping inactive categories from previously selected plans (FR32c plus current repo reality).
16. [Given] categories are exposed to Departmental Users before Blockly launch [When] the DU launchpad renders category selection pills [Then] each selectable category shows an accurate item count from the managed catalog [And] the count stays aligned with PO category/item maintenance so the launchpad matches the prototype's selection UX.
17. [Given] a category has zero active items available for new planning [When] the DU launchpad or toolbox seed is built [Then] the category is either disabled for new selection or clearly marked unavailable before Blockly opens [And] the user is not led into an empty planning path.
18. [Given] Blockly category appearance is derived from stored category metadata [When] the toolbox is built [Then] category-specific color and icon styling is generated using supported Blockly category toolbox configuration and CSS hooks rather than ad-hoc DOM mutation [And] user-provided style values are normalized and sanitized before they reach the toolbox config (FR30b, NFR-S7).
19. [Given] category create, update, reorder, import, archive, or delete changes state [When] those operations succeed or fail [Then] append-only audit entries are written using the current audit helpers and new category-specific audit vocabulary, and expected failures return `ConvexError` contracts without leaking internal details (NFR-S9, current audit pattern).
20. [Given] two Procurement Officers act on category ordering or lifecycle state concurrently [When] one user saves against stale category data [Then] the backend rejects the stale mutation with a deterministic refresh-required error instead of silently overwriting newer state.
21. [Given] category reads or mutations are executed [When] tenant or role boundaries apply [Then] all reads remain tenant-scoped and all mutations require Procurement Officer access through the existing role guard and tenant membership checks, without trusting client-supplied tenant identifiers (NFR-S1, current Convex auth pattern).

## Tasks / Subtasks

- [ ] Task 1: Extend the existing category domain model instead of inventing a second catalog table (AC: 2-5, 8-21)
  - [ ] Build a focused Convex module such as `webapp/convex/functions/categories.ts` for workspace reads, create, update, reorder, archive, delete, and import orchestration, mirroring the department and access-code domain shape.
  - [ ] Extend `webapp/convex/schema.ts` on the existing `procurementCategories` table instead of creating a new `categories` table. Add the fields this story actually needs, such as `normalizedName`, visual metadata for category color/icon, and archive metadata that preserves lifecycle truth.
  - [ ] Keep current downstream availability behavior anchored to the live table, likely continuing to drive DU visibility from `isActive` while adding explicit archive metadata for auditability and operator feedback.
  - [ ] Add the indexes required for tenant-scoped uniqueness and efficient workspace reads, especially a tenant-plus-normalized-name index for duplicate prevention.
  - [ ] Add whatever versioning or stale-write guard is required for reorder and lifecycle mutations so concurrent PO saves fail safely instead of last-write-wins by accident.
  - [ ] Extend `webapp/lib/security/audit.ts` with category-specific audit event names for create, update, reorder, import, archive, and delete outcomes.
  - [ ] Reuse `appendAuditLogRequired(...)` from `webapp/convex/functions/_audit.ts` and the existing authenticated actor pattern instead of creating a parallel audit path.

- [ ] Task 2: Build category validation, tier-limit, and workspace helper modules that match existing PO patterns (AC: 2-7, 13-21)
  - [ ] Add `webapp/lib/procurement-officer/categories.ts` for name normalization, color/icon normalization, tier-limit helpers, archive/delete blocker summaries, workspace row shaping, and user-facing error mapping.
  - [ ] Add `webapp/lib/validators/category.ts` with RHF + Zod validation for category form inputs, including required name, optional description, sanitized color, and normalized icon value.
  - [ ] Mirror the department-tier modal pattern with category-specific caps and pricing guidance instead of hardcoding copy inside the component.
  - [ ] Make tier-limit helpers explicit about whether archived categories count toward limits, and keep create/import enforcement aligned to that same rule.
  - [ ] Keep all deterministic messages centralized in the helper layer so UI, tests, and Convex error contracts stay aligned.

- [ ] Task 3: Replace the staged category placeholder in the PO dashboard with a real modal workspace (AC: 1-5, 7-10)
  - [ ] Preserve the thin route files in `webapp/app/(app)/po/categories/page.tsx` and `webapp/app/(app)/po/categories/items/page.tsx`; the real experience should still mount inside the `/po` dashboard modal contract.
  - [ ] Replace the `Categories` placeholder tab in `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` with a real component such as `webapp/src/components/procurement-officer/ProcurementOfficerCategoriesWorkspace.tsx`.
  - [ ] Keep the workspace visually aligned with the existing PO dashboard, bento-card language, shadcn/ui primitives, and `sonner` feedback patterns established in Stories 4.2, 4.3, and 4.5.
  - [ ] Match the prototype's compact management affordance: a `+ New` entry point, a concise category list/card treatment, honest empty state copy, and per-row item counts that make catalog density visible at a glance.
  - [ ] Support create, edit, archive, delete, reorder, and import flows from one coherent workspace instead of scattering them across multiple route-level pages.
  - [ ] Preserve a non-dead-end category dialog by carrying draft category context through a `Category Items` handoff, even if Story 4.8 still owns the full item-management implementation behind that handoff.
  - [ ] Add explicit unsaved-draft handling around the category-to-items handoff and modal close paths so draft category data is either preserved or intentionally discarded with confirmation.
  - [ ] Keep the `items` tab honest: it may stay staged for Story 4.8, but the categories story must stop labeling category management itself as `coming soon`.
  - [ ] Prefer lightweight reorder controls or native drag handling over introducing a new drag-and-drop dependency solely for category ordering.

- [ ] Task 4: Propagate category ordering and lifecycle state through DU launchpad and Blockly consumers without regressions (AC: 8, 13-18)
  - [ ] Extend `webapp/convex/functions/departmentUserDashboard.ts` and `webapp/lib/department-user/dashboard-snapshot.ts` so the DU launchpad receives category ordering and archive-aware visibility instead of defaulting to alphabetical-only active categories.
  - [ ] Keep the DU category-selection pill experience informative by flowing item counts from catalog reads into launchpad rows, matching the prototype's pre-Blockly selection affordance.
  - [ ] Prevent zero-active-item categories from creating empty DU planning flows by disabling them for fresh selection or surfacing an explicit unavailable state before Blockly launch.
  - [ ] Extend `webapp/convex/functions/plans.ts` and `webapp/lib/blockly/du-toolbox.ts` so Blockly toolbox category order follows persisted category order and category appearance can consume color/icon metadata safely.
  - [ ] Replace the current hard-coded toolbox category color strategy with per-category styling derived from normalized category metadata using supported Blockly toolbox configuration such as category `colour`, `categorystyle`, and/or `cssConfig`, plus stable CSS hooks for icon rendering.
  - [ ] Preserve current selected-category gating so new Blockly sessions still seed only the categories the DU chose on the launchpad; Story 4.7 should improve catalog fidelity without widening the DU toolbox unexpectedly.
  - [ ] Patch `sanitizeDepartmentUserWorkspaceCategorySelection(...)` and related DU helpers so archived categories remain visible for existing plans while staying unavailable for fresh selection in new plans.
  - [ ] Keep selected category IDs, plan category summaries, and toolbox identity resolution anchored to existing category document IDs so archiving or renaming does not invalidate saved plans.

- [ ] Task 5: Add bulk import and workbook-template support through the existing file-service bridge (AC: 6, 15-21)
  - [ ] Reuse `webapp/convex/actions/files.ts` plus `nestjs/src/files/*` for Excel workbook generation/import rather than parsing Excel in the browser.
  - [ ] Provide a downloadable category template whose columns match the approved import contract: `Name`, `Description`, `Color`.
  - [ ] Implement row-level validation and partial success semantics in Convex after the workbook is parsed, including duplicate-name, duplicate-within-file, tier-cap, invalid-color, and blank-name errors.
  - [ ] Ensure the import path remains idempotent enough to avoid duplicate categories from accidental retries or double submission.

- [ ] Task 6: Add deterministic tests for category CRUD, ordering, archive semantics, and dashboard/toolbox regressions (AC: 1-21)
  - [ ] Add helper tests for category normalization, validation, tier-limit state, reorder persistence shaping, archive visibility rules, and Blockly category-style generation.
  - [ ] Add backend tests for create, duplicate-name rejection, duplicate-within-file import rejection, update warnings, tier-cap enforcement, reorder, stale reorder rejection, import partial success, item-assignment delete blockers, active-plan delete blockers including draft-plan references, archive behavior, unauthorized access, and audit-log writes.
  - [ ] Update `webapp/tests/procurement-officer-dashboard.test.ts` so the category panel no longer asserts `coming_soon` for Story 4.7 and instead verifies modal routing into a live categories workspace while items remain intentionally staged for Story 4.8.
  - [ ] Add DU regression tests proving archived categories remain visible on existing plans while new plan launchpad selection excludes them, and zero-item categories cannot start an empty new-plan flow.
  - [ ] Add Blockly/toolbox regression tests proving category order and visual metadata shape flow through `buildDepartmentUserToolbox(...)` without breaking existing item-block generation.
  - [ ] Register any new test modules in `webapp/tests/run-tests.ts`.

## Dev Notes

### Story Foundation

- Epic 4 positions Story 4.7 as the category-governance layer that unlocks Story 4.8 item management and stabilizes the DU catalog before deeper planning expands.
- In the live repo, categories are no longer hypothetical. The schema, DU launchpad, plan persistence, and Blockly toolbox already consume `procurementCategories`, so this story must formalize and extend that domain instead of creating a new one.
- The real implementation goal is not just "CRUD for categories." The goal is to make category structure operator-managed, tenant-safe, ordered, visually distinct in Blockly, and safe to archive without breaking existing plans.

### Previous Story Intelligence

- Story 4.5 preserved the `/po` dashboard modal contract and turned a staged dashboard card into a real workspace without breaking the canonical shell. Story 4.7 should follow that same shape for categories rather than introducing a second PO page architecture.
- Story 4.3 established the repo pattern of focused domain modules, thin route contracts, RHF + Zod dialogs, `sonner` feedback, and helper-heavy UI logic. Reuse that pattern for categories.
- Story 4.2 already shipped the tier-limit modal pattern, audit logging expectations, and guarded delete flow style that category management should mirror.
- Story 5.2 already depends on live category records to seed the DU launchpad and Blockly workspace. Story 4.7 must preserve those integrations while adding ordering, lifecycle, and visual metadata.

### Prototype Intelligence From `docs/html/procurelinedb.html`

- The HTML prototype already frames category management as a compact PO dashboard card with a `+ New` CTA and a dense list of category rows, each showing live item count. The implementation story should preserve that quick-scan operator workflow instead of drifting toward a detached admin table.
- The prototype's category modal is not a dead end. In both create and edit mode it exposes a `Category Items` action, which means the real story should explicitly preserve the handoff contract into item management and protect draft category context during that pivot.
- The prototype carries unsaved create flow state through a temporary `pendingNewCategory` object before final save. The production implementation does not need to copy that exact mechanism, but it should intentionally solve the same UX problem: PO should not lose in-progress category setup just because they need to jump into the item workflow.
- The prototype DU launchpad renders category-selection pills with item counts before Blockly opens. Story 4.7 should therefore treat category maintenance as affecting both PO management and the DU pre-planning selection surface, not only the toolbox internals.
- The prototype DU toolbox builder only exposes categories that the DU selected and avoids re-offering blocks already placed in the workspace. Story 4.7 should not regress that scoped-seeding behavior while improving category metadata and ordering.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/po/categories/page.tsx` and `webapp/app/(app)/po/categories/items/page.tsx` currently only redirect into the dashboard modal contract.
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` still renders the categories modal as a placeholder empty state and keeps the `items` tab nested under the same modal.
- `webapp/lib/procurement-officer/dashboard-snapshot.ts` still marks the `categories` future panel as `coming_soon`, so Story 4.7 must remove that staging for categories while keeping Story 4.8 staging honest for items.
- `webapp/convex/schema.ts` already defines `procurementCategories` and `procurementItems`. The current category table is minimal: `tenantId`, `name`, optional `description`, `isActive`, `sortOrder`, `createdAt`, and `updatedAt`.
- The current schema does not yet include tenant-scoped normalized category names, visual metadata, or archive audit fields, so Story 4.7 must extend the existing table deliberately.
- `docs/html/procurelinedb.html` already encodes the intended product flow for category management: category rows show item counts, the category modal always exposes a manage-items action, and DU category pills show item counts before Blockly launch.
- `webapp/convex/functions/plans.ts` already loads categories and items from `procurementCategories` and `procurementItems`, maps `sortOrder`, and uses category document IDs in `plans.selectedCategoryIds` plus `plans.categorySummaries`.
- `webapp/convex/functions/departmentUserDashboard.ts` currently maps categories into the DU dashboard without `sortOrder`, `color`, `icon`, or archive metadata, and `webapp/lib/department-user/dashboard-snapshot.ts` sorts launchpad categories alphabetically.
- `webapp/lib/blockly/du-toolbox.ts` already respects category `sortOrder`, but it hardcodes a single category color (`#4a90d9`) and does not yet apply category-specific icon treatment.
- `webapp/lib/blockly/du-toolbox.ts` and `webapp/lib/department-user/dashboard.ts` both drop inactive categories from selection flows. That is a direct FR32c hazard because archived categories would disappear from existing plans unless Story 4.7 patches the selection logic.
- `webapp/lib/security/audit.ts` currently has audit event names for departments and access codes, but nothing yet for category lifecycle events.
- The Excel service bridge already exists through `webapp/convex/actions/files.ts` and `nestjs/src/files/*`, so category import should extend that seam instead of creating a new upload stack.
- Current launchpad/toolbox flows can still produce empty planning experiences if a visible category has no active items, so Story 4.7 needs an explicit guard for zero-item categories when exposing fresh DU choices.

### Technical Requirements

- Extend the existing `procurementCategories` table rather than introducing a competing table name or duplicate category source.
- Enforce category-name uniqueness per tenant with normalized comparison, not case-sensitive raw-string comparison.
- Treat category order as first-class state. Once Story 4.7 lands, DU launchpad and Blockly ordering should not silently fall back to alphabetic order.
- Model archive behavior as "hidden from new plan selection, preserved for existing plan references." Do not implement archive in a way that strips saved category IDs from draft, rejected, submitted, or approved plans.
- Make delete stricter than archive whenever any plan reference still exists, including draft and rejected plans, so editable plan sessions do not lose category identity.
- Count only usable non-archived categories when enforcing tier caps for new category creation/import, unless a future product decision explicitly changes that rule.
- Keep delete behavior stricter than archive behavior:
  - delete blocked if any items still point at the category;
  - delete blocked if any draft, rejected, submitted, or approved plans reference the category.
- Preserve referential integrity for `plans.selectedCategoryIds`, `plans.categorySummaries`, and `procurementItems.categoryId`.
- Reject stale reorder or lifecycle writes when the client is acting on outdated category state instead of allowing silent last-write-wins behavior.
- Normalize and validate category color before it reaches UI or toolbox config. Prefer a deterministic hex format for storage if that is the chosen repo convention.
- Normalize icon input into a bounded, safe representation. Do not allow arbitrary HTML injection, raw SVG blobs, or unsanitized class names from user input.
- Keep all expected failures as deterministic `ConvexError` responses with stable error codes/messages.

### Architecture Compliance

- Keep page files thin and interactive state in client components under `webapp/src/components/...`.
- Keep authorization and tenant scoping in Convex functions near the data, consistent with the current repo pattern and Next.js guidance to keep secure checks close to the data source.
- Reuse the existing `requireTenantRole(ctx, ["procurement_officer"])` and tenant-membership checks rather than inventing route-only protections.
- Keep the Blockly configuration data-driven. Generate toolbox styling from category metadata instead of mutating Blockly DOM nodes after render.
- Reuse the existing Convex-to-NestJS service bridge for Excel template generation/import.
- Reuse append-only audit helpers; do not bypass audit writes for category state changes.

### Library And Framework Requirements

- Stay on the repo's installed frontend stack for this story unless a separately approved dependency change is required:
  - Next.js `^16.1.6` (latest upstream checked locally on 2026-04-02: `16.2.2`)
  - Convex `^1.13.2` (latest upstream checked locally on 2026-04-02: `1.34.1`)
  - `react-hook-form` `^7.47.0` (latest upstream checked locally on 2026-04-02: `7.72.0`)
  - `zod` `^3.22.4` (latest upstream checked locally on 2026-04-02: `4.3.6`)
  - `blockly` `^12.5.1` (latest upstream checked locally on 2026-04-02: `12.5.1`)
- Use the current repo conventions:
  - RHF + Zod + shadcn/ui for forms and dialogs
  - `sonner` for user feedback
  - Convex `query`/`mutation` for data rules and `action` only for the Excel bridge
- Do not upgrade to newer major library lines inside Story 4.7 just because newer versions exist. This story should be an implementation story, not an upgrade story.

### Blockly Guidance

- The DU toolbox already uses JSON category toolbox definitions in `webapp/lib/blockly/du-toolbox.ts`; keep that approach.
- Official Blockly guidance supports category toolbox definitions, per-category colors, themes, and custom CSS classes through `cssConfig`, with a dedicated icon `span` (`blocklyToolboxCategoryIcon`) available in category rows.
- For this story, prefer one stable metadata-to-toolbox mapping strategy:
  - store normalized category color/icon metadata on the category record;
  - translate that metadata into toolbox `colour`, `categorystyle`, and/or `cssConfig`;
  - render icons through stable CSS classes rather than string-building raw markup.
- Keep user-provided values sanitized before they influence CSS class names or toolbox config.

### Reuse And Anti-Reinvention Guidance

- Reuse the PO modal-workspace contract already established by:
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- Reuse the department/access-code workspace structure for:
  - summary header card,
  - dialog-driven CRUD,
  - tier-limit modal,
  - helper-based error mapping.
- Reuse the existing Excel bridge:
  - `webapp/convex/actions/files.ts`
  - `nestjs/src/files/files.controller.ts`
  - `nestjs/src/files/files.service.ts`
  - `nestjs/src/files/excel.service.ts`
- Reuse the current DU category consumers instead of replacing them:
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/lib/blockly/du-toolbox.ts`
- Extend `webapp/lib/security/audit.ts` and `webapp/convex/functions/_audit.ts` rather than creating category-specific audit tables or one-off logging utilities.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/po/categories/page.tsx`
  - `webapp/app/(app)/po/categories/items/page.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/convex/actions/files.ts`
- Expected new files (recommended):
  - `webapp/convex/functions/categories.ts`
  - `webapp/lib/procurement-officer/categories.ts`
  - `webapp/lib/validators/category.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerCategoriesWorkspace.tsx`
  - `webapp/tests/procurement-officer-categories.test.ts`

### Testing Requirements

- Add pure tests for:
  - category-name normalization and duplicate detection inputs
  - color normalization and validation
  - icon normalization/sanitization
  - tier-limit state and modal copy
  - tier-limit counting with archived categories excluded
  - reorder helper behavior
  - stale reorder guard behavior
  - archive-preserved category selection for existing plans
  - zero-item category availability rules for new DU planning
  - Blockly category style / CSS-config generation
- Add backend tests for:
  - create category
  - duplicate-name rejection
  - duplicate rows inside one import file
  - update with active-plan warning metadata
  - reorder persistence
  - stale reorder rejection
  - tier-limit enforcement
  - import partial success and row-level failures
  - delete blocked by items
  - delete blocked by draft/rejected/submitted/approved plans
  - archive behavior
  - unauthorized or cross-tenant access
  - audit-log writes
- Add dashboard and DU regression tests for:
  - category panel no longer `coming_soon`
  - category modal routing through `/po?modal=categories`
  - category workspace rows show live item counts and correct empty state fallback
  - draft category context survives the category-to-items handoff contract
  - DU launchpad ordering reflects persisted category order
  - DU category pills show accurate item counts from the managed catalog
  - zero-item categories are disabled or clearly unavailable for new planning
  - archived categories stay visible on existing plans
  - new plan selection excludes archived categories
- Add Blockly/toolbox regressions for:
  - per-category order
  - per-category styling shape
  - no breakage to existing item block definitions

### Git Intelligence Summary

- Commit `b4cd44a` completed Story 4.5 using the current repo house style: focused backend module, thin route contract, dashboard-mounted workspace, and deterministic tests. Story 4.7 should mirror that shape.
- Commits `04a43d7` and `ea7ac39` from Story 4.3 reinforced the pattern of helper-heavy PO workspaces, server-owned mutation rules, and end-to-end guarded flows instead of UI-only logic.
- Commit `56988fe` from Story 4.2 established the reusable tier-limit modal, CRUD helper, and audit-driven department-management pattern that category management should extend rather than copy loosely.
- Commit `76e6ac0` is unrelated to category management except that it confirms the repo is still actively evolving nearby operator-support surfaces; avoid broad refactors while implementing Story 4.7.

### Latest Tech Information

- Verified on 2026-04-02 using local `npm view` lookups and official docs:
  - Next.js latest is `16.2.2`, while the repo is pinned to `^16.1.6`.
  - Convex latest is `1.34.1`, while the repo is pinned to `^1.13.2`.
  - `react-hook-form` latest is `7.72.0`, while the repo is pinned to `^7.47.0`.
  - `zod` latest is `4.3.6`, while the repo is pinned to `^3.22.4`.
  - `blockly` latest is `12.5.1`, which matches the repo's installed major line.
- Official Next.js authentication guidance still recommends performing secure authorization checks as close as possible to the data source, which supports keeping category authorization in Convex instead of relying on route-only guards.
- Convex documentation still emphasizes reactive data flow and index-aware query design. That supports continuing to use reactive `useQuery` consumers and deliberate tenant-scoped indexes for uniqueness checks.
- Official Blockly toolbox docs support JSON category toolboxes, category colors/themes, and `cssConfig`-driven category-row customization, which is the safest foundation for category color/icon rendering in this story.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - RHF + Zod + shadcn/ui for forms
  - append-only audit patterns
  - desktop-first UX
- Where `_bmad-output/project-context.md` or older architecture text conflicts with the live repo, prefer the live repo structure and installed versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 4 Source](../epic-04-po-department-catalog.md)
- [Story 4.2 Reference](./4-2-department-crud-operations.md)
- [Story 4.3 Reference](./4-3-access-code-generation-management.md)
- [Story 4.5 Reference](./4-5-submission-deadline-management.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [PO Categories Route](../../../../../webapp/app/(app)/po/categories/page.tsx)
- [PO Category Items Route](../../../../../webapp/app/(app)/po/categories/items/page.tsx)
- [PO Dashboard](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [PO Dashboard Helpers](../../../../../webapp/lib/procurement-officer/dashboard.ts)
- [PO Dashboard Snapshot](../../../../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
- [Departments Backend Pattern](../../../../../webapp/convex/functions/departments.ts)
- [Department Workspace Pattern](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDepartmentsWorkspace.tsx)
- [Access-Code Workspace Pattern](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerAccessCodesWorkspace.tsx)
- [Department Helpers Pattern](../../../../../webapp/lib/procurement-officer/departments.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [DU Dashboard Query](../../../../../webapp/convex/functions/departmentUserDashboard.ts)
- [Plans Query](../../../../../webapp/convex/functions/plans.ts)
- [DU Dashboard Snapshot](../../../../../webapp/lib/department-user/dashboard-snapshot.ts)
- [DU Dashboard Helpers](../../../../../webapp/lib/department-user/dashboard.ts)
- [DU Blockly Toolbox](../../../../../webapp/lib/blockly/du-toolbox.ts)
- [Audit Vocabulary](../../../../../webapp/lib/security/audit.ts)
- [Audit Helper](../../../../../webapp/convex/functions/_audit.ts)
- [Files Bridge Action](../../../../../webapp/convex/actions/files.ts)
- [NestJS Files Controller](../../../../../nestjs/src/files/files.controller.ts)
- [NestJS Files Service](../../../../../nestjs/src/files/files.service.ts)
- [NestJS Excel Service](../../../../../nestjs/src/files/excel.service.ts)
- [Current Webapp Package Versions](../../../../../webapp/package.json)
- [Current NestJS Package Versions](../../../../../nestjs/package.json)
- [Next.js Authentication Guide](https://nextjs.org/docs/pages/guides/authentication)
- [Next.js Page File Convention](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [Convex Reading Data](https://docs.convex.dev/database/reading-data)
- [Convex Mutations](https://docs.convex.dev/functions/mutation-functions)
- [Blockly Category Toolbox](https://developers.google.com/blockly/guides/configure/web/toolboxes/category)
- [Blockly Category Appearance](https://developers.google.com/blockly/guides/configure/web/toolboxes/appearance)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story source: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-7-category-management.md`
- Primary implementation context sources:
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/functions/departments.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/actions/files.ts`
  - `nestjs/src/files/files.controller.ts`
  - `nestjs/src/files/files.service.ts`
  - `nestjs/src/files/excel.service.ts`

### Completion Notes List

- 2026-04-02: Created implementation-ready story context for Story 4.7 with live repo analysis, cross-story guardrails, DU archive-preservation requirements, Blockly styling guidance, and Excel import reuse notes.
- 2026-04-02: Implemented the live category workspace, category helper/validator layer, Convex category CRUD and import flows, DU launchpad ordering/availability updates, Blockly category styling hooks, and regression tests for the new category behavior.
- 2026-04-02: Addressed AI review findings by adding draft-discard confirmation for category handoffs, row-level import failure summaries, truthful icon previews, failure-path category audit entries, and stronger helper coverage for import validation and draft handling.
- 2026-04-02: Addressed the second AI review round by wiring outer-workspace draft-close confirmation, enforcing workbook description-length validation, auditing pre-mutation auth failures, and separating live item counts from delete-blocker assignment counts.

### File List

- `_bmad-output/implementation-artifacts/epics/epic4/stories/4-7-category-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/functions/categories.ts`
- `webapp/convex/functions/departmentUserDashboard.ts`
- `webapp/convex/functions/plans.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/blockly/du-toolbox.ts`
- `webapp/lib/department-user/dashboard-snapshot.ts`
- `webapp/lib/procurement-officer/categories.ts`
- `webapp/lib/procurement-officer/dashboard-snapshot.ts`
- `webapp/lib/procurement-officer/dashboard.ts`
- `webapp/lib/security/audit.ts`
- `webapp/lib/validators/category.ts`
- `webapp/src/components/blockly/BlocklyEditor.tsx`
- `webapp/src/components/blockly/BlocklyWorkspace.module.css`
- `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerCategoriesWorkspace.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- `webapp/tests/department-user-blockly-workspace.test.ts`
- `webapp/tests/department-user-dashboard.test.ts`
- `webapp/tests/procurement-officer-categories.test.ts`
- `webapp/tests/procurement-officer-dashboard.test.ts`
- `webapp/tests/run-tests.ts`

### Story Completion Status

- Story ID: `4.7`
- Story Key: `4-7-category-management`
- Output File: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-7-category-management.md`
- Final Status: `done`
- Completion Note: `Story 4.7 category management is implemented, review findings have been fixed, and the feature has been reverified locally.`

## Senior Developer Review (AI)

### Review Date

- 2026-04-02

### Outcome

- Review findings fixed for the category draft close flow, row-level import reporting, Blockly icon preview fidelity, failure-path audit logging, and missing regression coverage around import validation and draft handling.
- Follow-up review findings fixed for outer categories-workspace draft close handling, workbook description validation parity, auth/tenant failure-path category audits, and truthful live item counts in the PO workspace.
- Story status is now `done` based on the completed implementation, follow-up fixes, and local verification pass.

### Verification

- `cmd /c npm test` in `webapp` passed with `240` assertions on 2026-04-02 after the fixes landed.

## Change Log

- 2026-04-02: Applied AI review fixes for draft-close confirmation, row-level import summaries, truthful category icon previews, failure-path category audits, and expanded category helper tests.
- 2026-04-02: Applied second-pass AI review fixes for outer modal draft preservation/discard confirmation, workbook description validation, pre-mutation auth failure audits, and live active-item counts in category rows.
