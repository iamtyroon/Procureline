# Story 7.4: Finalization

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to finalize the consolidated plan,
so that I can lock the official record and make it ready for export.

## Acceptance Criteria

1. Given the tenant has one Procurement Officer and that PO has a draft consolidation with at least one approved source department, when they click `Finalize Plan`, then the system validates the current source plans, marks the consolidation as finalized, records `finalizedAt` and `finalizedByTenantUserId`, and creates an immutable snapshot of draft data, workspace state, source plan ids, totals, compliance summary, and notes (FR66).
2. Given any selected source department no longer has a canonical approved plan for the selected fiscal year, when finalization is attempted, then finalization is blocked with actionable stale-source feedback and no snapshot is created.
3. Given the Blockly consolidation workspace has calculated totals and compliance values, when finalization succeeds, then the immutable snapshot preserves those displayed calculated values without applying any additional compliance gate or pass/fail validation.
4. Given a consolidation is finalized, when the PO views it, then the workspace is read-only, editable draft controls are disabled, and the UI shows `Finalized on [date] by [user]` (FR66c).
5. Given a consolidation is finalized, when the PO attempts to edit workspace state, selected departments, fiscal year, notes, source data, or draft metadata, then the backend rejects the mutation because finalized consolidations are immutable.
   - Product correction on 2026-05-18: finalized consolidations now expose an explicit `Edit Draft` action so the PO can return the current official record to draft mode, change it, and finalize again. Direct draft saves while still finalized remain rejected.
6. Given finalization succeeds, when the PO views the consolidation workspace, then export affordances become available for Story 7.5 to use; Story 7.4 does not generate Excel files.
7. Given the PO clicks `Finalize Plan` multiple times, refreshes during finalization, or a stale client retries finalization, then the backend treats the operation idempotently or rejects it with a clear already-finalized/revision-conflict response without creating duplicate snapshots.
8. Given finalization succeeds, then append-only audit events capture tenant, actor, fiscal year, consolidation id, source count, status transition, calculated totals/compliance snapshot presence, and timestamp.
9. Given implementation completes, then Story 7.4 has delivered finalization success, stale-source blocking, duplicate-finalization protection, calculated value preservation without compliance gating, immutable finalized snapshots, read-only UI state, export-ready state, and audit logging.

## Tasks / Subtasks

- [ ] Task 1: Extend consolidation data model for finalization and immutable snapshots (AC: 1, 3, 4, 5, 6, 7, 8)
  - [ ] Extend `webapp/convex/schema.ts` without breaking existing Story 7.1 drafts.
  - [ ] Add fields needed on `consolidations`: `finalizedAt`, `finalizedByTenantUserId`, and status transition from `draft` to `finalized`.
  - [ ] Add a tenant-scoped immutable `consolidationSnapshots` table or equivalent append-only schema for finalized records.
  - [ ] Store snapshot source plan ids, selected source department ids, draft data, compact Blockly workspace state, calculated totals/compliance values from Blockly, finalization notes, schema version, and actor/timestamps.
  - [ ] Preserve the product rule that each tenant has one PO and one active consolidation for a fiscal year; do not add named versions, sibling versions, or comparison groups.

- [ ] Task 2: Add guarded Convex mutations and queries for finalization (AC: 1-8)
  - [ ] Extend `webapp/convex/functions/consolidations.ts` with focused functions such as `finalizeProcurementOfficerConsolidation` plus read queries that return draft or finalized consolidation state.
  - [ ] Reuse `requireTenantRole(ctx, ["procurement_officer"])`; derive tenant and actor server-side.
  - [ ] Reuse `loadConsolidationBase`, `buildConsolidationReadiness`, and stale-source validation patterns from Story 7.1.
  - [ ] Reject finalization if the draft revision changed, if no approved source departments are selected, or if selected sources no longer match canonical approved plans.
  - [ ] Prevent duplicate snapshots when finalization is submitted twice by checking current consolidation status and snapshot existence inside the same mutation.
  - [ ] Ensure snapshot creation and consolidation status update happen in one Convex mutation so partial finalization state cannot be created.
  - [ ] Ensure draft save mutations cannot patch finalized records.

- [ ] Task 3: Preserve calculated Blockly totals and compliance values (AC: 3, 8)
  - [ ] Read the calculated totals and compliance values already produced by the consolidation Blockly workspace/state.
  - [ ] Persist those calculated values in the finalized snapshot for later export.
  - [ ] Do not add compliance targets, blocking validation, override policy, override reason fields, or pass/fail gates in Story 7.4.
  - [ ] Do not duplicate AGPO/PWD/local-content formulas in finalization code; finalization only snapshots the calculated values already present in the consolidation state.

- [ ] Task 4: Update consolidation workspace UI for finalization and read-only state (AC: 1, 3, 4, 5, 6)
  - [ ] Update `webapp/src/components/procurement-officer/ProcurementOfficerConsolidationWorkspace.tsx` to show finalized status banner, finalization action, calculated totals/compliance snapshot, and read-only finalized view.
  - [ ] Keep the existing three-zone operator layout from Story 7.1; do not create a second consolidation page or modal-only workflow.
  - [ ] Disable autosave and editing controls for finalized records.
  - [ ] Show export-ready state after finalization so Story 7.5 can attach export behavior; do not implement Excel generation in Story 7.4.
  - [ ] Use `sonner` toasts and shadcn/ui dialogs; no `alert()` or browser confirm dialogs.

## Dev Notes

### Story Foundation

- Epic 7 goal: POs consolidate approved department plans into a master Annual Procurement Plan with compliance calculations and GOK-compliant downstream export.
- Story 7.4 owns the lifecycle transition from editable draft to immutable official record. Story 7.1 already delivered the protected `/po/consolidation` route, approved-only readiness, durable draft persistence, lazy Blockly shell, summary-only department blocks, virtualized details panel, and Blockly-calculated totals/compliance values.
- This story must not implement Excel export or workbook formatting. Story 7.5 owns export orchestration and secure retrieval; Story 7.6 owns workbook structure and formatting.
- Product rule: each tenant has only one Procurement Officer and one consolidated plan version for a fiscal year. Do not build named versions, comparison versions, finalized comments, unlock workflows, or print view.

### Previous Story Intelligence

- Reuse the Story 7.1 files and patterns:
  - `webapp/convex/functions/consolidations.ts`
  - `webapp/lib/procurement-officer/consolidation.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerConsolidationWorkspace.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerConsolidationBlocklyShell.tsx`
- Story 7.1 intentionally did not patch `plans.consolidatedAt`; Story 7.4 may own that lifecycle decision, but only at successful finalization and only if it does not break approval undo safeguards in `webapp/lib/procurement-officer/review-decision.ts`.
- Existing draft saves use optimistic revision checks and stale-source validation. Finalization must use the same or stricter preconditions.
- Recent commit `21222c0` optimized consolidation UI with summary-only department blocks and a virtualized details panel. Keep that performance shape; do not rehydrate every source plan as full Blockly blocks in the main canvas.

### Explicit Non-Scope

- No named versions or version comparison.
- No finalized comments.
- No print view.
- No Tenant Admin unlock request flow.
- No Excel export generation.
- No compliance target validation, compliance blocking, override setting, or override reason.

### Technical Requirements

- Finalization must be server-authoritative. Client UI state can request finalization, but Convex must revalidate tenant, PO role, draft status, revision, and selected approved sources.
- Immutable means the finalized snapshot is append-only. After finalization, the PO cannot add comments or mutate notes through Story 7.4.
- A finalized consolidation should block draft save mutations, workspace edits, source list changes, fiscal-year changes, notes changes, and metadata changes.
- Compliance values are already automatically calculated in the Blockly workspace. Finalization must preserve those calculated values without adding a gate.
- Finalization should record enough snapshot data for later Excel export to operate from the official record, even if live source plans change later.
- Use Kenya fiscal-year keys already normalized by Story 7.1 helpers. Do not accept arbitrary client fiscal years.
- All state-changing operations must write append-only audit logs.

### Architecture Compliance

- Next.js App Router page files should remain thin route leaves; put route-specific UI in `webapp/src/components/procurement-officer/`.
- Convex remains the primary backend for tenant-scoped state, finalization, snapshots, and audit events.
- NestJS and ExcelJS are not needed in this story.
- Derive tenant context from auth in Convex. Never accept `tenantId` from the client.
- Use shadcn/ui, Tailwind, lucide-react, and sonner patterns already present in the PO workspace.
- Use JSON Blockly persistence. Do not introduce XML workspace storage.

### Library And Framework Requirements

- Installed repo versions observed on 2026-05-18:
  - Next.js `^16.1.6` installed, npm latest `16.2.6`
  - React `^19.2.4` installed, npm latest `19.2.6`
  - Convex `^1.13.2` installed, npm latest `1.39.1`
  - Blockly `^12.5.1` installed and npm latest `12.5.1`
  - TypeScript `^5.3.3`
  - Zod `^3.22.4`
  - `sonner` `^2.0.7`
  - `lucide-react` `^0.577.0`
- Do not upgrade dependencies as part of this story unless the user explicitly asks. The version drift is a follow-up risk, not Story 7.4 scope.
- Official docs checked on 2026-05-18:
  - Next.js App Router uses file-system routing with `page` files as route UI.
  - Convex queries are for reads and mutations are for transactional writes.
  - Blockly recommends JSON serialization as the actively developed save/load format.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/consolidations.ts`
  - `webapp/lib/procurement-officer/consolidation.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerConsolidationWorkspace.tsx`

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 7 Source](../epic-07-consolidation-export.md)
- [Previous Story 7.1](7-1-consolidation-workspace-access.md)
- [Project Context](../../../../project-context.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [UX Design Specification](../../../../planning-artifacts/ux-design-specification.md)
- [Consolidation Backend](../../../../../webapp/convex/functions/consolidations.ts)
- [Consolidation Helpers](../../../../../webapp/lib/procurement-officer/consolidation.ts)
- [Consolidation Workspace UI](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerConsolidationWorkspace.tsx)
- [Consolidation Blockly Shell](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerConsolidationBlocklyShell.tsx)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Review Decision Helpers](../../../../../webapp/lib/procurement-officer/review-decision.ts)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Convex Query Functions](https://docs.convex.dev/functions/query-functions)
- [Convex Mutation Functions](https://docs.convex.dev/functions/mutation-functions)
- [Blockly Serialization](https://developers.google.com/blockly/guides/configure/web/serialization)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Dev-story workflow: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Dev-story instructions: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Dev-story checklist: `_bmad/bmm/workflows/4-implementation/dev-story/checklist.md`
- Targeted verification: `npx tsc --noEmit --project tsconfig.json --pretty false 2>&1 | Select-String -Pattern 'consolidation|Consolidation|schema.ts\\(|audit.ts'`
- Targeted lint: `npx eslint src/components/procurement-officer/ProcurementOfficerConsolidationWorkspace.tsx src/components/procurement-officer/ProcurementOfficerConsolidationBlocklyShell.tsx lib/procurement-officer/consolidation.ts convex/functions/consolidations.ts tests/procurement-officer-consolidation.test.ts`
- Full test gate: `npm test` blocked before story assertions by existing repo-wide Convex generated type/CommonJS-ESM errors outside Story 7.4 files.
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story source: `_bmad-output/implementation-artifacts/epics/epic7/epic-07-consolidation-export.md`
- Previous story source: `_bmad-output/implementation-artifacts/epics/epic7/stories/7-1-consolidation-workspace-access.md`
- Current implementation sources:
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/consolidations.ts`
  - `webapp/lib/procurement-officer/consolidation.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerConsolidationWorkspace.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerConsolidationBlocklyShell.tsx`
  - `webapp/package.json`
- Git context:
  - `git log -5 --pretty=format:'%h %s'`
  - `git show --stat --oneline -1 HEAD`
- Tech verification:
  - `npm view next version`
  - `npm view convex version`
  - `npm view blockly version`
  - `npm view react version`
  - official Next.js, Convex, Blockly, and MDN docs listed in References

### Completion Notes List

- 2026-05-18: Created implementation-ready story context for Story 7.4 with finalization, immutable snapshots, calculated value preservation, export-ready state, audit logging, and explicit boundaries excluding Excel export.
- 2026-05-18: Simplified Story 7.4 to match product rules: one PO per tenant, one consolidation version, no named versions, no finalized comments, no print view.
- 2026-05-18: Updated sprint tracking so `7-4-finalization-versioning` is ready for development.
- 2026-05-18: Implemented Story 7.4 finalization path in code: consolidation schema fields, immutable `consolidationSnapshots`, guarded finalization mutation, finalized read model, read-only UI, export-ready affordance, aggregate value snapshot preservation, audit event, and source-level tests.
- 2026-05-18: Kept story in-progress because the mandatory full `npm test` regression gate is currently blocked by pre-existing repository-wide Convex generated type and CJS/ESM errors; targeted Story 7.4 TypeScript scan returned no matching errors and targeted ESLint returned warnings only.
- 2026-05-18: Added product correction from Tyroon: finalized consolidations now have an explicit Edit Draft flow, backend reopen mutation, and audit event so POs can edit and finalize again without creating named versions.

### File List

- `_bmad-output/implementation-artifacts/epics/epic7/stories/7-4-finalization-versioning.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/schema.ts`
- `webapp/convex/functions/consolidations.ts`
- `webapp/lib/procurement-officer/consolidation.ts`
- `webapp/lib/shared/security/audit.ts`
- `webapp/src/components/procurement-officer/ProcurementOfficerConsolidationBlocklyShell.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerConsolidationWorkspace.tsx`
- `webapp/tests/procurement-officer-consolidation.test.ts`

### Change Log

- 2026-05-18: Created Story 7.4 Finalization developer guide and moved story status to ready-for-dev.
- 2026-05-18: Removed version comparison, finalized comments, and print view scope from Story 7.4.
- 2026-05-18: Removed compliance target validation and override flow from Story 7.4 because compliance values are automatically calculated in Blockly.
- 2026-05-18: Added finalization implementation and validation notes; story remains in-progress pending resolution of the repo-wide full test gate.
- 2026-05-18: Added finalized-to-draft edit flow and latest-snapshot lookup for refinalization cycles.

## Story Completion Status

- Story ID: `7.4`
- Story Key: `7-4-finalization-versioning`
- Output File: `_bmad-output/implementation-artifacts/epics/epic7/stories/7-4-finalization-versioning.md`
- Final Status: `in-progress`
- Completion Note: `Implementation added; full review handoff is blocked until the repo-wide npm test typecheck gate is repaired.`
