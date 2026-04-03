# Story 4.8: Item Catalog Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to create and manage procurement items with validated pricing, category alignment, and import tooling,
so that Departmental Users build plans from a trustworthy tenant-scoped catalog without breaking Blockly, saved plans, or downstream exports.

## Acceptance Criteria

1. [Given] a Procurement Officer opens `/po/items`, `/po/categories/items`, or the items tab from the categories workspace [When] the protected PO dashboard modal resolves [Then] a real item-management workspace renders instead of the current placeholder state [And] `/po` remains the canonical Procurement Officer shell.
2. [Given] the Procurement Officer creates an item [When] they submit the form [Then] category, item description, unit, and unit price are required [And] the save reuses the live `procurementItems` table instead of creating a parallel catalog source (FR33, FR35b).
3. [Given] an active item with the same normalized description already exists in the same category for the same tenant [When] the Procurement Officer creates or renames an item [Then] the backend rejects the operation with a deterministic duplicate error [And] the same description may still exist in another category without cross-category collision (FR33a, NFR-S1).
4. [Given] the Procurement Officer enters pricing or quantity constraints [When] unit price is zero/negative or quantity limits are invalid, including `max < min` [Then] the form and backend reject the save with stable validation errors instead of relying on UI-only checks (FR33b, FR33d).
5. [Given] the Procurement Officer chooses item defaults [When] they edit an item [Then] the UI supports the approved unit options `each`, `box`, `kg`, `liter`, `ream`, `set`, `pair`, plus a controlled custom option, and supports default procurement method plus bounded compliance flags for AGPO, PWD, and Local Content (FR33c, FR33e, FR36).
6. [Given] the tenant is on Free, Starter, Professional, or Enterprise [When] the Procurement Officer adds items past the per-category cap [Then] the system enforces Free `50`, Starter `150`, Professional `500`, and Enterprise `unlimited` active items per category [And] archived or inactive items do not consume new-item capacity [And] the modal copy includes the correct upgrade path plus `View Plans` CTA to `/pricing`.
7. [Given] the Procurement Officer uses workbook import [When] the tier, workbook row count, or remaining active-item capacity in a target category exceeds the allowed import contract [Then] Free is blocked entirely, Starter is capped at `100` rows, Professional at `1,000`, and Enterprise remains unlimited [And] valid rows still import while invalid or overflow rows return deterministic row-level failures without retry-order drift (FR33f).
8. [Given] Story 4.7 already hands category flows into item management [When] the Procurement Officer clicks `Category Items` from the category dialog [Then] the item workspace opens with category context preserved [And] draft category information is not silently lost during the handoff or if the operator backs out and returns later in the same workflow session.
9. [Given] the Procurement Officer edits an item's price or moves it to another category [When] the save succeeds [Then] the item keeps the same document ID, writes append-only price-history records when price changes, updates category assignment without recreate-and-delete, and keeps DU workspaces and saved plans resolvable by stable item identity [And] moves or renames that would create a same-category normalized duplicate are rejected deterministically before persistence (FR34a, FR34b, FR35a).
10. [Given] item reads or mutations execute [When] role and tenant boundaries apply [Then] all reads remain tenant-scoped, all writes require Procurement Officer access through the existing Convex guards, workbook processing reuses the current Convex-to-NestJS files bridge, expected failures return deterministic `ConvexError` contracts, and append-only audit entries are written for state-changing operations (NFR-S1, NFR-S7, NFR-S9).
11. [Given] an item is later archived, deactivated, or otherwise hidden from new catalog selection [When] saved DU plans or reactive workspaces still reference that item ID [Then] the system keeps the item resolvable for historical reads, blocks destructive removal that would orphan existing plans, and only removes it from new-selection flows.

## Tasks / Subtasks

- [x] Task 1: Extend the existing item domain model instead of inventing a second catalog source (AC: 2-7, 9-10)
  - [x] Extend `webapp/convex/schema.ts` on the existing `procurementItems` table with the fields Story 4.8 actually needs, such as duplicate normalization, quantity limits, compliance flags, lifecycle or revision metadata, and any ordering support required by the workspace.
  - [x] Preserve the current repo contract where `procurementItems.name` is the primary item display label feeding Blockly `ITEM_DESC`; do not split item identity into competing primary fields mid-epic.
  - [x] Add an append-only price-history table such as `procurementItemPriceHistory` so FR34b does not rely on audit metadata alone.
  - [x] Define explicit active-vs-archived counting rules so per-category caps and import capacity use the same active-item calculation.
  - [x] Add the indexes needed for tenant-scoped workspace reads and category-scoped duplicate checks, especially category item listing and tenant-plus-category normalized lookup.
  - [x] Extend `webapp/lib/security/audit.ts` with item-specific audit event names for create, update, move, import, and price change flows.

- [x] Task 2: Build item helper and validator modules that match the repo patterns already used for categories and departments (AC: 3-7, 10)
  - [x] Add `webapp/lib/procurement-officer/items.ts` for item normalization, unit-option definitions, compliance flag helpers, tier-limit rules, workbook column constants, and error mapping.
  - [x] Add `webapp/lib/validators/item.ts` using RHF + Zod v3 patterns already present in the repo, including required description/unit/category, positive price validation, quantity-limit validation, and bounded enum-like inputs.
  - [x] Reuse the existing tier-limit modal pattern rather than hardcoding item-cap copy directly inside components.

- [x] Task 3: Implement a focused Convex item-management module that owns workspace reads, writes, move semantics, and import orchestration (AC: 2-7, 9-10)
  - [x] Add a focused backend module such as `webapp/convex/functions/items.ts` for workspace reads, create, update, move or reassign, and workbook-import mutation orchestration.
  - [x] Keep authorization and tenant scoping in Convex using `requireTenantRole(ctx, ["procurement_officer"])` and current membership checks rather than route-only protection.
  - [x] Record price-history rows only when price actually changes, and keep item document IDs stable across edits and moves.
  - [x] Reject move or rename operations that would collide with an existing normalized description in the destination category, even when the source category previously allowed the same description.
  - [x] Keep referenced inactive items readable to DU and export consumers, and prevent destructive removal paths that would orphan saved plan item references.
  - [x] Reuse `appendAuditLogRequired(...)` and failure-audit patterns from Story 4.7 instead of creating a parallel logging system.

- [x] Task 4: Replace the staged items placeholder with a real PO items workspace inside the existing dashboard modal contract (AC: 1, 6-8)
  - [x] Preserve the thin route file in `webapp/app/(app)/po/items/page.tsx`; the real experience should still mount inside the `/po` dashboard shell.
  - [x] Replace the placeholder items tab in `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` with a real component such as `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx`.
  - [x] Update `webapp/lib/procurement-officer/dashboard-snapshot.ts` so the items future panel stops reporting `coming_soon` once Story 4.8 lands.
  - [x] Match the prototype's operator flow by supporting both single-item entry and bulk upload in one coherent workspace, while keeping search/filter/export reserved for Story 4.9.

- [x] Task 5: Propagate the richer item contract through DU planning, Blockly identity reconciliation, and reactive price updates without regressions (AC: 5, 8-10)
  - [x] Extend `webapp/convex/functions/plans.ts` and `webapp/convex/functions/departmentUserDashboard.ts` so DU catalog payloads include any new safe item metadata needed for planning without breaking the existing shape.
  - [x] Update `webapp/lib/blockly/du-toolbox.ts`, `webapp/lib/blockly/workspace-catalog-identity.ts`, and related save helpers so saved plans keep resolving item identity by stable IDs even after rename, move, or price change.
  - [x] Extend `webapp/src/components/blockly/BlocklyEditor.tsx` and, if needed, `webapp/src/components/blockly/BlocklyWorkspace.tsx` so active DU sessions can surface truthful price-change notices instead of silently drifting.
  - [x] Preserve the current Blockly/export contract for item description, unit of measurement, unit price, procurement method, and source of funds.

- [x] Task 6: Reuse the existing NestJS file-service bridge for workbook import and template generation rather than creating a browser-only import path (AC: 7, 10)
  - [x] Reuse `webapp/convex/actions/files.ts` and `nestjs/src/files/*` for item template generation and workbook parsing.
  - [x] Enforce row-level validation for duplicate items within category, duplicate rows within one workbook, invalid category references, invalid numeric fields, tier-cap overflow per category, remaining active-slot overflow per category, and unsupported unit/compliance values.
  - [x] Make partial imports deterministic by calculating remaining category capacity before writes and marking overflow rows consistently instead of depending on workbook processing order.
  - [x] Keep import semantics idempotent enough to avoid duplicate items on accidental retries or double-submit.

- [x] Task 7: Add deterministic tests for item CRUD, tier gating, import validation, price history, lifecycle safety, and DU/blockly regressions (AC: 1-11)
  - [x] Add helper tests for normalization, duplicate detection, unit validation, quantity-limit validation, compliance-flag normalization, tier-limit calculations, workbook-row validation, and price-history shaping.
  - [x] Add backend rule tests for archived-category edit safety, tenant-scoped duplicate enforcement, active-vs-inactive counting, per-category cap enforcement, import duplicate-key and unit-alias handling, and deterministic next-sort-order resolution.
  - [x] Update PO dashboard/workspace tests so the items modal is live and the `coming_soon` placeholder assertions are removed or narrowed to later-story surfaces only.
  - [x] Add DU/blockly regression tests proving stable item IDs survive rename, move, price changes, and later item deactivation without orphaning saved plans.
  - [x] Add workflow tests proving draft category-to-items handoff state can be resumed without silent loss during same-session back-and-forth navigation.

## Dev Notes

### Story Foundation

- Story 4.7 made categories real and left items intentionally staged. Story 4.8 should turn the live item catalog into a truthful PO-managed workspace without leaking into Story 4.9 search/export or Story 4.10 request review.
- In the live repo, items already exist as first-class planning inputs. `procurementItems` already feed DU dashboard snapshots, Blockly toolbox generation, workspace-save reconciliation, and export-oriented block fields.
- The implementation goal is not generic CRUD. The goal is a trustworthy item-management flow that preserves DU/blockly compatibility, price integrity, tier enforcement, workbook import reuse, and future export readiness.

### Previous Story Intelligence

- Story 4.7 established the immediate pattern to reuse here: helper-driven PO workspace, focused Convex module, RHF + Zod dialogs, `sonner` feedback, Excel bridge reuse, and best-effort failure audits.
- Story 4.7 also introduced the `Category Items` handoff and dashboard-modal contract. Story 4.8 should honor that exact flow instead of replacing it with a detached items page.
- Story 4.5 reinforced the rule that PO operational workspaces should open inside the existing dashboard shell rather than splinter into separate full-screen flows.
- Stories 4.2 and 4.3 established the current house style for tier-limit modals, deterministic `ConvexError` contracts, guarded mutations, and append-only audit logging.

### Prototype Intelligence From `docs/html/procurelinedb.html` And `docs/html/Procureline.html`

- The category dialog exposes an always-visible `Category Items` container with a `Manage Items` action. The real implementation should preserve an intentional handoff from category editing into item management.
- The prototype item flow combines two management modes in one surface: a compact `Add Item to Catalog` inline section and a separate bulk-upload area.
- Prototype item entry uses `Item Description`, `Unit`, `Unit Price`, `Proc Method`, and `Source Of Funds`, and explicitly notes that quarterly quantities belong to Departmental Users later.
- The prototype import parsing comments expect item-oriented workbook columns like `Item/Service Description`, `Unit Of Measurement`, `Unit Price`, `Proc Method`, and `Source Of Funds`.
- The prototype keeps a temporary `pendingNewCategory` object so new-category work can continue into item setup without losing draft state; the production implementation should solve the same problem even if the mechanism differs.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/po/items/page.tsx` currently redirects back into the PO dashboard shell; there is no live item-management workspace yet.
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` already mounts categories as a real workspace, but the `items` tab is still a placeholder empty state inside that modal.
- `webapp/lib/procurement-officer/dashboard-snapshot.ts` still labels items as `coming_soon`, so Story 4.8 needs to make that status truthful.
- `webapp/convex/schema.ts` already defines `procurementItems` with `tenantId`, `categoryId`, `name`, `description`, `unitOfMeasurement`, `unitPrice`, `procurementMethod`, `sourceOfFunds`, `sortOrder`, and `isActive`, but it does not yet model duplicate normalization, quantity limits, compliance flags, revisioning, or price history.
- `webapp/convex/functions/plans.ts` and `webapp/convex/functions/departmentUserDashboard.ts` already ship item data into DU planning surfaces, so any schema or shape changes must remain backward-compatible with those consumers.
- `webapp/lib/blockly/du-toolbox.ts` and `webapp/lib/blockly/workspace-catalog-identity.ts` already depend on stable item IDs and existing item metadata. Replacing item docs during updates would risk breaking saved workspaces.
- `webapp/src/components/blockly/BlocklyEditor.tsx` already uses live query data plus `sonner` toasts and is the most natural surface for price-change notifications in active DU sessions.
- `webapp/convex/actions/files.ts` and `nestjs/src/files/*` already provide the Excel bridge. Story 4.8 should extend that seam instead of introducing a browser-only parser or a second backend path.
- `webapp/lib/security/audit.ts` currently has category events but no item-specific audit vocabulary yet.

### Technical Requirements

- Reuse `procurementItems` as the single live item source. Do not create a second `items` or `catalogItems` table that competes with the existing planning catalog.
- Keep `procurementItems.name` as the canonical item display label that feeds current Blockly `ITEM_DESC` behavior. If the UI says "Item Description," map that to the existing stable field instead of splitting identity across two primaries.
- Enforce duplicate prevention at the tenant + category scope using normalized comparison, not raw case-sensitive strings.
- Add explicit quantity-limit fields and reject invalid ranges, especially negative values and `max < min`.
- Model compliance flags using a bounded enum-like array or equivalent safe representation; do not accept arbitrary user-provided flag strings.
- Preserve `procurementMethod` and `sourceOfFunds` because current toolbox/export consumers already depend on them, even though source-of-funds is broader than the epic's minimal FR wording.
- Add append-only price-history storage with previous price, new price, changed by, and changed at so price changes remain queryable beyond generic audit metadata.
- Preserve item document IDs across rename, move, and price updates. Do not implement move-by-delete-and-recreate or edit-by-recreate patterns.
- Reject destination-category moves or renames that would create a same-category normalized duplicate, even if the item was valid in its previous category.
- Only active categories should accept new item assignments, and existing saved plans must remain readable even if category or item lifecycle state later changes.
- Per-category limits and import remaining-capacity checks must count active items consistently; inactive or archived items may stay historically readable without consuming new-item slots.
- Keep Story 4.8 boundaries explicit:
  - live PO item management belongs here;
  - search, filter, pagination refinement, and export remain Story 4.9;
  - DU request creation remains Story 5.5;
  - PO request review remains Story 4.10.

### Architecture Compliance

- Keep page files thin and interactive state in client components under `webapp/src/components/...`, consistent with the existing PO dashboard architecture.
- Keep tenant scoping and authorization in Convex data functions using current guards, consistent with Next.js guidance that authorization checks should sit close to the data source.
- Reuse the existing dashboard modal and route redirect contract for `/po/items` and `/po/categories/items`; do not introduce a parallel PO shell.
- Reuse Convex `query` and `mutation` for catalog rules and `action` only for the existing Excel bridge, consistent with Convex guidance that queries and mutations should not call the outside world directly.
- Reuse append-only audit helpers for item operations rather than creating item-specific bespoke logging infrastructure.

### Library And Framework Requirements

- Stay on the repo's installed stack for this story unless a separately approved dependency change is required:
  - Next.js `^16.1.6` in `webapp/package.json` (latest upstream verified on 2026-04-02: `16.2.2`)
  - Convex `^1.13.2` in `webapp/package.json` (latest upstream verified on 2026-04-02: `1.34.1`)
  - Zod `^3.22.4` in `webapp/package.json` (latest upstream verified on 2026-04-02: `4.3.6`)
  - Blockly `^12.5.1` in `webapp/package.json`
  - ExcelJS `^4.4.0` in `nestjs/package.json`
- Use current repo conventions:
  - RHF + Zod + shadcn/ui for item forms and dialogs
  - `sonner` for operator and DU feedback
  - Convex `withIndex(...)` for filtered item queries
  - Next App Router leaf `page.tsx` files kept thin, with route-unique UI delegated to components
- Do not upgrade Zod to v4 or newer Convex or Next major lines inside Story 4.8. This is an implementation story, not a dependency-upgrade story.

### Reuse And Anti-Reinvention Guidance

- Reuse the PO dashboard modal contract already established by:
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- Reuse Story 4.7 category-management patterns for helper/validator structure, tier-limit modal content, workbook import handoff, failure audits, and session or draft handoff behavior.
- Reuse current DU catalog consumers instead of replacing them:
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/lib/blockly/workspace-catalog-identity.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
- Reuse the existing Story 4.7 draft-handoff approach or an equivalent session-backed mechanism so category-to-items navigation can be resumed without losing unsaved category context.
- Reuse the existing file-service bridge:
  - `webapp/convex/actions/files.ts`
  - `nestjs/src/files/files.controller.ts`
  - `nestjs/src/files/files.service.ts`
  - `nestjs/src/files/excel.service.ts`

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/po/items/page.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/lib/blockly/workspace-catalog-identity.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/lib/security/audit.ts`
  - `webapp/convex/actions/files.ts`
  - `nestjs/src/files/files.service.ts`
  - `nestjs/src/files/excel.service.ts`
- Expected new files (recommended):
  - `webapp/convex/functions/items.ts`
  - `webapp/lib/procurement-officer/items.ts`
  - `webapp/lib/validators/item.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx`
  - `webapp/tests/procurement-officer-items.test.ts`

### Testing Requirements

- Add pure helper tests for normalization, duplicate detection, unit validation, quantity-limit validation, compliance-flag normalization, tier-limit calculations, workbook-row validation, and price-history shaping.
- Add backend tests for create, update, move, import flows, per-category cap enforcement, Free-tier import block, Starter and Professional row-cap enforcement, price-history writes, audit-log writes, and unauthorized or cross-tenant failures.
- Update PO dashboard and workspace tests so the items modal is live and the `coming_soon` placeholder assertions are removed or narrowed to later-story surfaces only.
- Add DU/blockly regression tests proving stable item IDs survive rename, move, and price changes.
- Register any new test modules in `webapp/tests/run-tests.ts`.

### Git Intelligence Summary

- Commit `a5bd004` (Story 4.7) established the immediate pattern to reuse here: helper-driven PO workspace, Convex mutation module, workbook bridge reuse, draft handoff, and deterministic tests.
- Commit `b4cd44a` (Story 4.5) reinforced the dashboard-modal implementation style and focused, non-broad changes inside the existing PO shell.
- Commits `04a43d7` and `ea7ac39` (Story 4.3) reinforced the repo pattern of guarded backend rules, append-only audit logging, and thin route contracts backed by richer client workspaces.
- The repo is actively evolving nearby operator workflows, so Story 4.8 should avoid broad architectural refactors and stay tightly scoped to live item management.

### Latest Tech Information

- Verified on 2026-04-02:
  - Next.js docs list the App Router auth guide under latest version `16.2.2`, and the repo is already pinned within the `16.x` line.
  - Convex docs still recommend indexes plus `withIndex(...)` as the primary way to filter efficiently.
  - Convex docs still state that query and mutation functions are not allowed to call the outside world directly; external service work belongs in actions.
  - Next.js auth guidance still recommends performing the majority of security checks as close as possible to the data source, which matches the repo's Convex-first guard pattern.
  - Next.js page-file guidance still treats `page.tsx` as route-unique UI and the leaf of a route subtree, which supports keeping `/po/items/page.tsx` thin.
  - Blockly docs continue to support data-driven toolbox configuration plus CSS-based appearance customization, so Story 4.8 should stay compatible with the existing data-driven toolbox approach rather than mutating the DOM ad hoc.
- Because the repo is pinned to older Convex and Zod major lines than the newest releases, Story 4.8 should preserve current repo APIs and patterns rather than opportunistically upgrading libraries mid-feature.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - RHF + Zod + shadcn/ui for forms
  - append-only audit patterns
  - desktop-only UX
- Where `_bmad-output/project-context.md` or older planning docs conflict with the live repo, prefer the live repo structure and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 4 Source](../epic-04-po-department-catalog.md)
- [Story 4.7 Reference](./4-7-category-management.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [Prototype HTML](../../../../../docs/html/procurelinedb.html)
- [Prototype HTML Variant](../../../../../docs/html/Procureline.html)
- [PO Items Route](../../../../../webapp/app/(app)/po/items/page.tsx)
- [PO Dashboard](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [PO Categories Workspace](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerCategoriesWorkspace.tsx)
- [PO Dashboard Helpers](../../../../../webapp/lib/procurement-officer/dashboard.ts)
- [PO Dashboard Snapshot](../../../../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
- [Current Categories Backend Pattern](../../../../../webapp/convex/functions/categories.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [DU Dashboard Query](../../../../../webapp/convex/functions/departmentUserDashboard.ts)
- [Plans Query](../../../../../webapp/convex/functions/plans.ts)
- [DU Blockly Toolbox](../../../../../webapp/lib/blockly/du-toolbox.ts)
- [Workspace Catalog Identity](../../../../../webapp/lib/blockly/workspace-catalog-identity.ts)
- [Blockly Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Audit Vocabulary](../../../../../webapp/lib/security/audit.ts)
- [Audit Helper](../../../../../webapp/convex/functions/_audit.ts)
- [Files Bridge Action](../../../../../webapp/convex/actions/files.ts)
- [NestJS Files Controller](../../../../../nestjs/src/files/files.controller.ts)
- [NestJS Files Service](../../../../../nestjs/src/files/files.service.ts)
- [NestJS Excel Service](../../../../../nestjs/src/files/excel.service.ts)
- [Webapp Package Versions](../../../../../webapp/package.json)
- [NestJS Package Versions](../../../../../nestjs/package.json)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js Page File Convention](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [Convex Reading Data](https://docs.convex.dev/database/reading-data/)
- [Convex Actions](https://docs.convex.dev/tutorial/actions)
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
- Story source: `_bmad-output/implementation-artifacts/epics/epic4/epic-04-po-department-catalog.md`
- Previous-story source: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-7-category-management.md`

### Completion Notes List

- 2026-04-02: Created implementation-ready story context for Story 4.8 with live repo analysis, category-to-items handoff constraints, workbook-import reuse guidance, DU/blockly compatibility guardrails, and current package or doc checks.
- 2026-04-03: Implemented the live PO item workspace, item schema and price-history support, Convex item CRUD/import flows, DU Blockly price-sync propagation, and deterministic helper plus regression tests.
- 2026-04-03: Fixed code-review findings by reassigning moved Blockly items to their live category block, preserving editable archived-category selections, adding authorization recovery for archive and import flows, and extending backend plus handoff coverage around item rules.

### File List

- `_bmad-output/implementation-artifacts/epics/epic4/stories/4-8-item-catalog-management.md`
- `webapp/convex/schema.ts`
- `webapp/convex/functions/items.ts`
- `webapp/convex/functions/plans.ts`
- `webapp/convex/functions/categories.ts`
- `webapp/lib/procurement-officer/items.ts`
- `webapp/lib/validators/item.ts`
- `webapp/lib/procurement-officer/dashboard.ts`
- `webapp/lib/procurement-officer/dashboard-snapshot.ts`
- `webapp/lib/security/audit.ts`
- `webapp/lib/blockly/du-toolbox.ts`
- `webapp/lib/blockly/workspace-catalog-identity.ts`
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerCategoriesWorkspace.tsx`
- `webapp/src/components/blockly/BlocklyEditor.tsx`
- `webapp/src/components/blockly/BlocklyWorkspace.tsx`
- `webapp/tests/procurement-officer-items.test.ts`
- `webapp/tests/procurement-officer-dashboard.test.ts`
- `webapp/tests/department-user-blockly-workspace.test.ts`
- `webapp/tests/run-tests.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Story Completion Status

- Story ID: `4.8`
- Story Key: `4-8-item-catalog-management`
- Output File: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-8-item-catalog-management.md`
- Final Status: `done`
- Completion Note: `Implementation reviewed, fixes applied, and verified with green tests including Blockly move attribution coverage, archived-category edit safety, archive/import auth recovery handling, backend rule coverage, and same-session handoff coverage.`
