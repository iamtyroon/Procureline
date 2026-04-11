# Story 4.9: Catalog Search & Export

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to search, filter, and export the item catalog,
so that I can quickly find items and share the catalog externally without losing tenant safety, filter fidelity, or dashboard workflow continuity.

## Acceptance Criteria

1. [Given] a Procurement Officer opens `/po/items` or `/po/categories/items` and the tenant catalog contains many rows [When] the items workspace loads inside the existing `/po` dashboard modal [Then] the catalog browser renders as a paginated results experience instead of one unbounded table [And] the default page size is `50` rows [And] the workspace still keeps quick add, advanced edit, bulk import, and category handoff available in the same operator flow (FR37).
2. [Given] the Procurement Officer enters text in the catalog search box [When] the input settles after a debounce window [Then] results update without a full page reload [And] matches are found by item name, item description, and category name [And] changing the search term resets the visible result window to the first page or first result slice instead of leaving the operator on a stale page (FR37-CS).
3. [Given] the Procurement Officer narrows the catalog [When] they apply filters [Then] the workspace supports combined filters for category multi-select, price range minimum/maximum, and compliance flags (AGPO, PWD, Local Content) [And] the active filters are visible and clearable [And] the same state is encoded in URL query parameters so the filtered workspace can be refreshed or shared truthfully (FR37-CF).
4. [Given] the Procurement Officer is browsing current or archived catalog entries [When] search and filters run [Then] results remain tenant-scoped, continue to surface truthful category and archived badges from the live `procurementItems` source, and do not require the client to repeatedly load and scan the full tenant catalog on every keystroke (FR37, NFR-P6, NFR-S1).
5. [Given] a Free or Starter tenant opens the catalog workspace [When] they click `Export to Excel` [Then] the system blocks the export before file generation [And] displays the required upgrade modal explaining that catalog export is available in Professional and Enterprise tiers [And] includes a `View Plans` CTA linking to `/pricing` (FR37-CE).
6. [Given] a Professional tenant clicks `Export to Excel` [When] the currently filtered result set exceeds `10,000` rows [Then] the system blocks the export before calling the file service [And] shows the exact filtered count with guidance to refine filters or upgrade to Enterprise [And] when the filtered result set is `10,000` rows or fewer the system exports the full filtered dataset, not just the current page, using the current filters as applied in the workspace (FR37-CE).
7. [Given] a Professional or Enterprise tenant exports the catalog [When] the export succeeds [Then] the workbook includes at minimum `Item Name`, `Category`, `Description`, `Unit`, `Price`, `Qty Limits`, and `Compliance Flags` [And] the exported rows match the same filtered result set the operator is viewing [And] Enterprise has no export row limit enforced (FR37-CE).
8. [Given] catalog search, filtering, or export executes [When] authorization, auditability, and integrations apply [Then] all reads and writes remain Procurement-Officer-only and tenant-scoped in Convex, export generation reuses the current Convex-to-NestJS file bridge instead of a browser-only workbook path, expected failures return deterministic user-facing errors, and successful export attempts are captured in the audit trail (NFR-S1, NFR-S7, NFR-S9).
9. [Given] the item workspace restores state from URL query parameters or modal redirects [When] a page number, filter value, category id, price bound, or compliance flag is missing, malformed, duplicated, stale, or no longer valid for the tenant [Then] the workspace normalizes the state to safe defaults, ignores unsupported values, preserves only whitelisted item-workspace params, and does not crash, hang, or show another tenant's data.
10. [Given] the Procurement Officer types quickly, changes filters repeatedly, archives or edits items, or starts export while the catalog is changing [When] overlapping queries or mutations resolve out of order [Then] stale result sets do not overwrite newer search state [And] pagination falls back to the nearest valid result page if the current page becomes empty [And] export re-validates the filtered dataset snapshot immediately before generation so the downloaded workbook matches the final authorized filter set.
11. [Given] the current filter set resolves to zero rows [When] the Procurement Officer reaches the results table or clicks export [Then] the workspace shows a truthful empty state with clear-filter guidance [And] export is blocked with a deterministic "no rows to export" response instead of generating a misleading empty workbook.

## Tasks / Subtasks

- [x] Task 1: Extend the live catalog data contract for searchability and export-safe counting instead of creating a parallel search model (AC: 2-4, 6-8)
  - [x] Add the minimum schema support needed in `webapp/convex/schema.ts` for performant catalog search, such as a denormalized search field or category-name snapshot plus a `searchIndex(...)` path filtered by `tenantId`, rather than depending on client-side full-table scans.
  - [x] Backfill any new search-related fields for existing `procurementItems` records via `webapp/convex/migrations.ts` or an equivalent migration path so Story 4.9 does not only work for newly created items.
  - [x] Update create, update, import, archive, and category-rename flows so search text or category snapshot fields stay in sync after Story 4.8 item management and Story 4.7 category edits.
  - [x] Extend `webapp/lib/security/audit.ts` with a catalog-export audit event name instead of overloading generic item mutation events.

- [x] Task 2: Add a backend catalog browse contract with authoritative filtering, bounded search, and paginated result delivery (AC: 1-4, 8-11)
  - [x] Keep a lightweight summary query for categories, counts, and tier/export eligibility, but move result browsing into a dedicated backend path in `webapp/convex/functions/items.ts` that accepts search text, category filters, price range, compliance flags, and pagination inputs.
  - [x] Use indexed or search-index-backed query paths for browse/search behavior; do not keep the current "load all rows then filter in the component" pattern for large catalogs.
  - [x] Ensure category-name search works truthfully even though items live in `procurementItems`, likely by querying a denormalized category-search field maintained with the item record.
  - [x] Preserve current row shaping from Story 4.8, including category labels, archived badges, compliance summaries, and stable item identity, so the results table remains compatible with the existing edit/archive actions.
  - [x] Return enough metadata for the UI to show filtered counts, empty states, and export eligibility without having to reconstruct totals on the client.
  - [x] Normalize malformed browse inputs on the backend as well as the client, including invalid category ids, unsupported compliance flags, negative price bounds, and impossible pagination values, so query-string tampering cannot break the workspace.
  - [x] Ensure the export path re-checks the final authorized filter set and row count immediately before workbook generation, and returns a deterministic no-results or over-limit failure when the dataset changes between browse and export.

- [x] Task 3: Extend the existing items workspace UI with search, combined filters, shareable URL state, and pagination without breaking Story 4.8 flows (AC: 1-4, 9-11)
  - [x] Update `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx` to add a debounced search input, filter controls, active-filter summary, empty states, and pagination controls while preserving quick add, advanced editor, bulk upload, and category handoff affordances.
  - [x] Extend `webapp/lib/procurement-officer/dashboard.ts`, `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`, and `webapp/src/components/procurement-officer/ProcurementOfficerWorkspaceRouteRedirect.tsx` so modal routing preserves item-workspace query params instead of discarding them during `/po/items` or `/po/categories/items` redirects.
  - [x] Keep page files thin and route-unique, leaving interactive query-string state and filter behavior in client components or helper modules rather than pushing ad hoc logic into route files.
  - [x] Reset pagination predictably when search text or filters change, and preserve shareable deep-link behavior on refresh.
  - [x] Whitelist and normalize item-workspace query params during redirect and restore, ignoring stale or unsupported values rather than replaying arbitrary search params into the dashboard shell.
  - [x] Prevent stale debounced responses from overwriting newer search or filter state, and move the operator to the nearest valid page when edits, archives, or filters shrink the current result page to zero rows.

- [x] Task 4: Reuse the current Convex-to-NestJS export bridge for filtered catalog export with tier gating and audit coverage (AC: 5-11)
  - [x] Add an export initiation flow in the PO items workspace that shows the right tier-limit modal copy for Free and Starter tenants, and the Professional `10,000`-row cap before any workbook generation starts.
  - [x] Generate export rows from the full filtered dataset on the backend or action path, not from only the currently visible page of results.
  - [x] Reuse `webapp/convex/actions/files.ts`, `nestjs/src/files/files.service.ts`, and `nestjs/src/files/excel.service.ts` for workbook creation rather than introducing a browser-only XLSX generator.
  - [x] Shape exported rows to the Story 4.9 contract without inventing a second item-description source; if `description` mirrors `name` in the current data model, keep the export truthful to that live contract.
  - [x] Append a catalog-export audit entry with filter metadata, row count, and tier context for successful or failed export attempts as appropriate.
  - [x] Block export when the normalized filtered dataset is empty, and keep the failure copy distinct from tier-gating or over-limit failures so operators understand why no workbook was generated.

- [x] Task 5: Add deterministic regression coverage for search, URL state, pagination, tier gates, and filtered export shaping (AC: 1-8)
  - [x] Add helper tests for filter parsing, query-string serialization, result-count or row-limit gating, search-text shaping, and export-row mapping.
  - [x] Add backend tests covering tenant-scoped search, category-name search hits, combined filters, page-reset behavior, Free/Starter export blocking, Professional row-cap blocking, Enterprise unlimited export, and deterministic error contracts.
  - [x] Add UI tests proving the items workspace keeps quick-add/import visible while search, filters, and pagination are active, and that deep links restore the same filter state after reload or redirect into the dashboard shell.
  - [x] Register any new test modules in `webapp/tests/run-tests.ts` and extend NestJS tests only if the export row-shaping contract changes beyond the current generic workbook helper behavior.

## Dev Notes

### Story Foundation

- Story 4.8 made the PO item workspace real, but the catalog browser is still a simple table with category-chip narrowing and no search, pagination, or export. Story 4.9 should extend that exact live workspace rather than replacing it with a separate catalog page.
- The goal here is operational usability once catalogs grow, not new item CRUD. Search, filtering, URL persistence, and export fidelity belong here; item creation, editing, movement, archival, and import already belong to Story 4.8 and should remain intact.
- The epic specifically calls out large-catalog ergonomics and filtered export. That means the implementation must keep the UI truthful while avoiding a "load the full tenant catalog into the browser and filter in React" fallback that would undermine the story's purpose.

### Previous Story Intelligence

- Story 4.8 established the immediate pattern to reuse: the items experience lives inside the shared PO dashboard modal, the route file remains thin, item management is driven by focused Convex functions, and workbook generation or parsing goes through the current Convex-to-NestJS file bridge.
- Story 4.8 also made the item workspace dependent on stable `procurementItems` IDs and session-backed category handoff. Story 4.9 should not disturb that identity or the category-to-items modal flow just to add browse ergonomics.
- Story 5.3 and Story 5.4 show the repo's current implementation style for complex interactive state: helper modules, deterministic tests, and explicit handling of persisted client state instead of burying brittle logic inside one giant component.

### Current Implementation State Discovered In Code

- `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx` currently renders quick add, workbook upload, category chips, and one unpaginated table sourced from `workspace.rows`.
- `webapp/convex/functions/items.ts#getItemsWorkspace` currently loads all tenant categories and all tenant items, then shapes rows for the workspace. That was acceptable for Story 4.8 CRUD activation, but it is the wrong scaling path for Story 4.9's large-catalog browse contract.
- `webapp/convex/schema.ts` has `procurementItems` indexes for tenant and category lookups, but it does not yet define a search index for catalog search by item or category text.
- `webapp/lib/procurement-officer/dashboard.ts` currently only preserves `modal` and `section` query params for PO workspace navigation. Story 4.9's shareable filter URLs will need a safe way to preserve item-workspace query params through redirect and modal navigation.
- `webapp/src/components/procurement-officer/ProcurementOfficerWorkspaceRouteRedirect.tsx` currently resolves `/po/items` and `/po/categories/items` into the dashboard modal without preserving arbitrary search params, so deep-linking a filtered catalog would currently lose state.
- `webapp/convex/actions/files.ts`, `nestjs/src/files/files.service.ts`, and `nestjs/src/files/excel.service.ts` already support generic workbook export from rows. Story 4.9 should reuse that bridge rather than inventing a second export service.
- `webapp/lib/security/audit.ts` already includes category and item mutation events but does not yet include a dedicated catalog-export event.

### Technical Requirements

- Keep `procurementItems` as the single live catalog source. Do not introduce a shadow `catalogSearchResults`, `catalogExports`, or browser-only source of truth.
- Search must match item name, item description, and category name. Because category name is not a native searchable field on the item query path, plan for a truthful denormalized search projection or equivalent backend-safe approach.
- Preserve tenant scoping and Procurement Officer authorization entirely in Convex. Search and export must never trust client-provided tenant identifiers.
- Default page size should be `50` rows. Prefer gapless or cursor-based pagination semantics over client-side array slicing of the full dataset.
- Normalize invalid or stale URL query state safely. Unknown category ids, unsupported compliance flags, malformed price bounds, duplicate params, and impossible page values must degrade to safe defaults rather than surfacing runtime errors or inconsistent state.
- Free and Starter tenants must be blocked from catalog export before workbook generation. Professional must be blocked above `10,000` filtered rows. Enterprise remains unlimited.
- Export must use the current filter state but must export the complete filtered dataset, not just the currently visible result page.
- Export must re-check the final authorized filter snapshot immediately before workbook generation so rapid catalog changes or out-of-order requests cannot produce a workbook that no longer matches the operator's validated dataset.
- A zero-result filter state should not generate an empty workbook. Surface a deterministic empty-state/export-block response instead.
- Keep current workspace truthfulness for archived rows, category labels, and stable edit/archive actions. Search and filters should not silently hide archived state if the row remains part of the displayed catalog contract.
- Preserve Story 4.9 boundaries:
  - catalog search, pagination, and export belong here;
  - item CRUD and workbook import stay in Story 4.8;
  - DU request creation remains Story 5.5;
  - PO request review remains Story 4.10.

### Architecture Compliance

- Keep `webapp/app/(app)/po/items/page.tsx` thin. The page should continue redirecting into the existing `/po` dashboard shell, with richer client behavior living in PO workspace components and helper modules.
- Follow current Next.js guidance for route query state: use `useSearchParams` in Client Components for live query-string state and keep route-unique page concerns in `page.tsx`. If a Server Component page needs search params later, pass them explicitly instead of relying on layouts for modal state.
- Follow current Convex guidance for pagination and indexed reads. Prefer paginated query contracts plus indexed or search-index-backed filtering rather than collecting all matching docs in the browser.
- Keep external workbook generation in Convex actions plus NestJS services. Queries and mutations should continue to own authorization, filter shaping, and row-limit enforcement.
- Do not turn Story 4.9 into a dependency-upgrade story. The repo is intentionally behind the latest Next.js, Convex, and Zod releases, and this story should preserve installed APIs unless a bug fix absolutely requires otherwise.

### Library And Framework Requirements

- Stay on the repo's installed versions for implementation work:
  - Next.js `^16.1.6` in `webapp/package.json`
  - Convex `^1.13.2` in `webapp/package.json`
  - Zod `^3.22.4` in `webapp/package.json`
  - Blockly `^12.5.1` in `webapp/package.json`
  - ExcelJS `^4.4.0` in `nestjs/package.json`
- Latest upstream versions verified on `2026-04-06` via npm registry:
  - Next.js `16.2.2`
  - Convex `1.34.1`
  - Zod `4.3.6`
  - ExcelJS `4.4.0`
- Use current repo conventions:
  - `useSearchParams`, `useRouter`, and route-safe query merging for shareable filter URLs
  - Convex-first auth and data enforcement
  - `sonner` for operator feedback
  - RHF + Zod + shadcn/ui for any new filter or export forms
  - Existing files bridge for Excel generation
- Do not upgrade webapp Zod to v4 or replace the current Convex item-management surface during this story.

### Reuse And Anti-Reinvention Guidance

- Reuse the live PO items workspace and modal shell:
  - `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerWorkspaceRouteRedirect.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
- Reuse the existing item helper surface in `webapp/lib/procurement-officer/items.ts` for tier rules, compliance flags, and row shaping. Add search/filter or query-string helpers near this module instead of scattering constants inside components.
- Reuse existing route-to-modal normalization patterns in `webapp/lib/procurement-officer/dashboard.ts` and keep any new filter query params explicitly whitelisted there instead of forwarding arbitrary search params through redirects.
- Reuse `webapp/convex/functions/items.ts` as the single backend ownership point for PO catalog operations instead of splitting search/export into unrelated modules unless the file becomes unmanageably large.
- Reuse the existing file-service bridge:
  - `webapp/convex/actions/files.ts`
  - `nestjs/src/files/files.service.ts`
  - `nestjs/src/files/excel.service.ts`
- Reuse the current upgrade-path conventions and `/pricing` CTA pattern rather than inventing new billing copy for export gating.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerWorkspaceRouteRedirect.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/items.ts`
  - `webapp/convex/functions/items.ts`
  - `webapp/convex/functions/categories.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/actions/files.ts`
  - `webapp/convex/migrations.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/tests/procurement-officer-items.test.ts`
  - `webapp/tests/run-tests.ts`
- Expected new files (recommended if the implementation benefits from clearer separation):
  - `webapp/lib/procurement-officer/catalog-filters.ts`
  - `webapp/tests/procurement-officer-catalog-search.test.ts`

### Testing Requirements

- Add helper tests for filter parsing, query-string encoding or decoding, row-limit gating, export row shaping, and search normalization.
- Add backend tests proving tenant-scoped search by item name, description, and category name, combined filter behavior, pagination reset semantics, zero-result export blocking, Professional export row-cap enforcement, Enterprise unlimited export, and deterministic unauthorized or invalid-input failures.
- Extend PO items workspace tests so debounced search, filter chips, pagination transitions, stale-response suppression, and export gating all work without hiding the quick-add/import surfaces from Story 4.8.
- Add redirect/deep-link coverage proving `/po/items?...` and `/po/categories/items?...` preserve item-workspace query params when the operator lands inside the `/po` modal shell.
- Add edge-case tests for malformed query params, stale category ids after rename or archive, invalid price ranges, and page fallback after archive or filter changes remove the current page's last row.
- Only extend NestJS workbook tests if Story 4.9 changes workbook column shape or formatting expectations beyond the current generic row-export helper.

### Git Intelligence Summary

- The most recent 5.3 and 5.4 commits heavily reinforced deterministic helper modules, test-first hardening, and explicit handling of workspace-derived state. Story 4.9 should follow that style instead of burying search or pagination logic deep inside JSX.
- Recent Blockly and workspace commits also show the repo is actively stabilizing client-side reactive state. Any item-catalog URL-state work should be careful not to create brittle one-off query-string logic that diverges from the team's current patterns.
- Story 4.8 already landed the live PO item workspace, schema extensions, import flow, and DU identity guardrails. Story 4.9 should stay tightly scoped to operational browse and export behavior on top of that foundation.

### Latest Tech Information

- Verified on `2026-04-06`:
  - Next.js docs still define `useSearchParams` as a Client Component hook for reading the current URL query string and note that Pages can receive a `searchParams` prop directly when server-side access is needed.
  - Next.js docs still define `page.tsx` as route-unique UI and the leaf of a route subtree, which supports keeping `/po/items/page.tsx` thin while richer state stays in client workspace components.
  - Convex docs still recommend `searchIndex(...)` plus `withSearchIndex(...)` for full-text search with filter fields such as tenant scoping.
  - Convex docs still recommend `paginationOptsValidator` with paginated query functions and `usePaginatedQuery` in React components for reactive, cursor-managed pagination.
  - The repo's installed ExcelJS version already matches the latest upstream version, so Story 4.9 can reuse the current export bridge without a package upgrade.
- Because the repo is pinned behind the newest Next.js, Convex, and Zod releases, preserve the current installed APIs and patterns instead of opportunistically upgrading libraries mid-story.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first authorization and tenant enforcement
  - RHF + Zod + shadcn/ui for operator forms
  - `sonner` feedback
  - append-only audit patterns
  - desktop-only UX
- Where older planning docs conflict with the live repo or installed package versions, prefer the live repo structure and package manifests.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 4 Source](../epic-04-po-department-catalog.md)
- [Story 4.8 Reference](./4-8-item-catalog-management.md)
- [Story 5.3 Reference](../../epic5/stories/5-3-blockly-validation-constraints.md)
- [Story 5.4 Reference](../../epic5/stories/5-4-plan-persistence-recovery.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [PO Items Route](../../../../../webapp/app/(app)/po/items/page.tsx)
- [PO Workspace Redirect](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerWorkspaceRouteRedirect.tsx)
- [PO Dashboard](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [PO Items Workspace](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx)
- [PO Dashboard Helpers](../../../../../webapp/lib/procurement-officer/dashboard.ts)
- [PO Item Helpers](../../../../../webapp/lib/procurement-officer/items.ts)
- [PO Items Backend](../../../../../webapp/convex/functions/items.ts)
- [PO Categories Backend](../../../../../webapp/convex/functions/categories.ts)
- [Schema](../../../../../webapp/convex/schema.ts)
- [Migrations](../../../../../webapp/convex/migrations.ts)
- [Files Bridge Action](../../../../../webapp/convex/actions/files.ts)
- [NestJS Files Service](../../../../../nestjs/src/files/files.service.ts)
- [NestJS Excel Service](../../../../../nestjs/src/files/excel.service.ts)
- [Audit Vocabulary](../../../../../webapp/lib/security/audit.ts)
- [PO Item Tests](../../../../../webapp/tests/procurement-officer-items.test.ts)
- [Webapp Package Versions](../../../../../webapp/package.json)
- [NestJS Package Versions](../../../../../nestjs/package.json)
- [Next.js `useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Next.js `page.tsx` Convention](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [Convex Full Text Search](https://docs.convex.dev/search/text-search)
- [Convex Pagination](https://docs.convex.dev/database/pagination)

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
- Previous-story source: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-8-item-catalog-management.md`

### Completion Notes List

- 2026-04-06: Created implementation-ready story context for Story 4.9 with live repo analysis, category-name search guardrails, URL-state preservation requirements, filtered export tier gating, and current Convex or Next.js guidance for paginated catalog browsing.
- 2026-04-08: Added denormalized catalog search fields, backfill migration, category-rename synchronization, and a tenant-scoped search index for `procurementItems`.
- 2026-04-08: Split the PO items workspace into summary plus paginated browse contracts, added URL-backed filter normalization, preserved modal deep links, and kept quick add, advanced edit, workbook import, and category handoff in the same dashboard flow.
- 2026-04-08: Reused the Convex-to-NestJS file bridge for filtered catalog export with Free or Starter gating, Professional row-limit enforcement, export snapshot revalidation, and catalog-export audit entries.
- 2026-04-08: Added deterministic regression coverage for catalog query params, search and filter shaping, pagination fallback, export gating, and dashboard redirect preservation. `npm test` passes and `npx convex codegen` passes. `npm run lint` still reports pre-existing unrelated Blockly lint errors in `webapp/lib/blockly/workspace-catalog-identity.ts`.

### Change Log

- 2026-04-08: Implemented Story 4.9 catalog search, filter, pagination, export, routing preservation, audit coverage, and regression tests.

### File List

- `_bmad-output/implementation-artifacts/epics/epic4/stories/4-9-catalog-search-export.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/actions/files.ts`
- `webapp/convex/functions/categories.ts`
- `webapp/convex/functions/items.ts`
- `webapp/convex/migrations.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/procurement-officer/catalog-filters.ts`
- `webapp/lib/procurement-officer/dashboard.ts`
- `webapp/lib/procurement-officer/item-backend.ts`
- `webapp/lib/procurement-officer/items.ts`
- `webapp/lib/security/audit.ts`
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerItemsWorkspace.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerWorkspaceRouteRedirect.tsx`
- `webapp/tests/procurement-officer-dashboard.test.ts`
- `webapp/tests/procurement-officer-items.test.ts`

### Story Completion Status

- Story ID: `4.9`
- Story Key: `4-9-catalog-search-export`
- Output File: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-9-catalog-search-export.md`
- Final Status: `review`
- Completion Note: `Catalog search, filter, pagination, export, audit coverage, and regression validation are implemented and ready for review.`
