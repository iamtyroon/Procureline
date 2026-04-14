# Story 5.5: Item & Category Requests (DU Side)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want to request missing items or categories from inside the planning workflow,
so that I can complete an accurate procurement plan even when the current catalog is incomplete.

## Acceptance Criteria

1. [Given] a Departmental User is in an editable Blockly planning session [When] they cannot find a required catalog item [Then] the workspace exposes a working DU request entry point inside the current `/du/plans/[planId]` flow instead of the current reserved placeholder [And] opening the request surface does not navigate away from the editor or discard the active draft state (FR37a, Story 5.4 continuity contract).
2. [Given] a Departmental User cannot find an appropriate category for the needed item [When] they open the request surface [Then] the same in-context flow also exposes a dedicated category-request path without forcing them into a PO-only workspace or another route [And] the DU can move between item-request and category-request entry points without losing entered draft request details (FR37b).
3. [Given] a DU submits an item request [When] the form validates successfully [Then] the request requires, at minimum, item name, description, estimated unit price, and justification [And] the request is anchored either to an existing active category or to an explicit category-request handoff supported by the same DU request workflow (FR37c, FR37r).
4. [Given] a DU submits a category request [When] the form validates successfully [Then] the request requires category name, description, and justification [And] text fields are normalized and sanitized with the repo's existing security-input helpers before persistence or duplicate checks are performed (FR37b, FR37c, NFR-S7).
5. [Given] a DU enters invalid, unsafe, or incomplete request data [When] they try to submit [Then] the UI shows inline form errors using the repo's existing shadcn/ui plus `react-hook-form` plus `zod` patterns [And] no request mutation is attempted until the payload is valid (FR37r, project-context form contract).
6. [Given] a DU requests an item that already exists in the tenant catalog [When] the normalized name plus category match an existing catalog record, including records currently hidden from new planning [Then] the system blocks the request and shows a truthful duplicate message such as `This item already exists in [Category Name]` instead of creating a parallel shadow request (FR37p, Stories 4.7 and 4.8 catalog identity rules).
7. [Given] a DU already has a pending request for the same normalized item or category in the same department context [When] they try to submit another one before review [Then] the system blocks the duplicate and shows a deterministic duplicate-pending message instead of creating multiple open requests for the same need (FR37q).
8. [Given] a DU submits a valid request [When] persistence succeeds [Then] the system stores the request in a canonical tenant-scoped DU request domain with status `pending` and captures requestor, department, fiscal-year, and plan context [And] the implementation records the action in audit logs and queues a PO-facing notification through the existing transactional email pipeline rather than inventing a second notification transport (FR37d, FR84a, NFR-S1, audit requirements).
9. [Given] a DU views their request history from the planning flow [When] requests exist [Then] the system shows an in-context DU request inbox with statuses such as `Pending`, `Approved`, `Denied`, `Expired`, and `Cancelled` [And] each request displays enough detail for the DU to understand what was requested, when, and what the current decision state is (FR37d).
10. [Given] a request is still pending and unreviewed [When] the originating DU opens it from their request inbox during an editable submission window [Then] they can edit the request details and resubmit them without creating a new request record [And] optimistic concurrency or revision checks prevent stale browser state from silently overwriting a newer pending request draft (FR37t, Story 5.4 stale-write guardrail).
11. [Given] a request is still pending and unreviewed [When] the originating DU cancels it before PO review [Then] the request moves to `cancelled`, no longer appears as actionable pending work for PO review, and the DU sees immediate status feedback in the same request inbox (FR37s).
12. [Given] a DU has requested an item that is not yet approved into the live catalog [When] they continue planning [Then] that request remains visible only as a request-status artifact and never as a usable toolbox block or insertable workspace item until the PO-side processing story creates or activates a real catalog record (FR37f, Story 4.10 boundary).
13. [Given] the PO later approves, denies, or expires a DU request [When] the request status changes in Convex [Then] the DU-side request inbox updates reactively, shows the current outcome plus denial or expiry reason where applicable, and emits accessible in-app feedback such as toast plus `aria-live` messaging while the DU session is open (FR37e, FR84b, FR84c, FR84e, NFR-A1).
14. [Given] the submission window closes for the DU's department or fiscal-year planning context [When] pending DU requests remain unresolved [Then] the system expires the still-pending requests automatically, prevents any further create, edit, or cancel actions for those requests, and notifies the DU that the pending requests expired with the end of the submission period (FR37g, Story 4.5 deadline management).
15. [Given] the current DU workspace can enter read-only or grace states [When] the plan is no longer editable [Then] the request UI remains truthful: the DU may still review prior request statuses, but new request creation, edits, and cancellations are disabled whenever the access-mode and deadline guards no longer allow planning changes (current `_roleGuard` and `plans.ts` DU access contract).
16. [Given] the current repo already has a PO requests route shell and dashboard modal placeholder [When] Story 5.5 lands [Then] the DU-side request data contracts and status surfaces are implementation-ready for Story 4.10 to add PO review and catalog insertion on top of them without requiring a schema rewrite or duplicate request store (Stories 4.10 and 5.5 integration boundary).
17. [Given] Story 5.5 completes [When] automated coverage runs [Then] the repo contains deterministic tests for item and category request validation, duplicate blocking against live catalog and pending requests, edit and cancel guards, request status hydration, read-only no-op behavior, deadline-driven expiration, PO notification queueing, and accessible DU-side status feedback so later review and submission stories can rely on stable request semantics.
18. [Given] a DU has one or more pending catalog requests while still editing the plan [When] the workspace and later submission guardrails inspect planning state [Then] the DU request domain exposes stable pending-request summary data from the same canonical store [And] Story 4.10 and the later submission-validation stories can block submission on unresolved requests without adding a second request cache or schema migration (FR37d, FR50c, Story 4.10 boundary).

## Tasks / Subtasks

- [x] Task 1: Add a canonical DU request domain for item and category requests instead of keeping request intent trapped in editor placeholders (AC: 3-9, 11-18)
  - [x] Extend `webapp/convex/schema.ts` with dedicated `itemRequests` and `categoryRequests` tables rather than a client-only draft store, because item requests need estimated price while category requests do not and later PO review flows need clear per-type approval rules.
  - [x] Include tenant, department, plan, fiscal-year, requestor, normalized-name, status, revision, and review-result fields needed for duplicate detection, DU ownership checks, later PO review, and reactive status rendering.
  - [x] Persist both per-requestor duplicate keys and shared cross-DU grouping keys so same-DU duplicate blocking and later FR37u-style PO consolidation can rely on stable normalized request identity without rewriting the schema.
  - [x] Add indexes for the critical read paths: by tenant plus status, by department plus status, by requestor plus status, by plan, and by normalized duplicate keys used to block duplicate pending submissions and group same-need requests later.
  - [x] Add a shared request-domain helper such as `webapp/lib/procurement/catalog-requests.ts` to centralize status unions, display labels, duplicate-key builders, validation limits, and user-facing error messages instead of scattering request logic across DU and PO components.
  - [x] Extend `webapp/lib/security/audit.ts` with request-specific audit event names so request submission, edit, cancel, expiry, approval, and denial are first-class audit actions rather than opaque generic metadata blobs.

- [x] Task 2: Implement DU-scoped request queries and mutations with tenant-safe validation and duplicate prevention (AC: 3-11, 14-18)
  - [x] Create a focused Convex function module such as `webapp/convex/functions/catalogRequests.ts` for DU-side request CRUD plus shared read models instead of overloading `plans.ts` with unrelated write logic.
  - [x] Reuse `requireTenantRole`, department profile lookup, and current DU access-mode checks so tenant, department, and editability are derived from auth context instead of trusted from client payloads.
  - [x] Reuse existing normalization and validation helpers from `webapp/lib/security/input.ts`, `webapp/lib/procurement-officer/items.ts`, and `webapp/lib/procurement-officer/categories.ts` so request duplicate checks align with the live catalog's naming and validation rules.
  - [x] Add DU mutations for `createItemRequest`, `createCategoryRequest`, `updatePendingRequest`, and `cancelPendingRequest`, with ownership and status guards that only allow the originating DU to mutate their own still-pending requests.
  - [x] Re-validate mutable request actions against live catalog and access state on every write so stale dialogs cannot submit against an archived category, a closed submission window, or a request whose status already moved out of `pending`.
  - [x] Make create, update, cancel, and notification side effects idempotent under duplicate clicks, reconnects, and Convex mutation retries so request rows and outbound emails do not duplicate.
  - [x] Add read models for DU request inbox history plus lightweight summary counts and pending-request metadata that can be consumed by the editor now and by later submit-block validation without a second store.

- [x] Task 3: Replace the reserved editor CTA with a real in-context request surface that supports both item and category requests (AC: 1-5, 8-13, 15, 17)
  - [x] Replace the current reserved `Request Item` action in `webapp/src/components/blockly/BlocklyEditor.tsx` with a working DU request trigger, preferably a single `Catalog request` surface with explicit `Item request` and `Category request` options instead of adding more persistent header clutter.
  - [x] Build the DU request UI with existing shadcn/ui dialog, tabs, form, badge, and alert primitives plus `react-hook-form` and `zodResolver`, following the same patterns already used across PO dialogs and access-code forms.
  - [x] Preserve Story 5.4 continuity guarantees: opening, closing, submitting, editing, or cancelling requests must not reset the Blockly canvas, clear queued draft recovery state, or navigate away from `/du/plans/[planId]`.
  - [x] Show a DU request inbox in the same editor flow, with status badges, timestamps, edit or cancel affordances for pending requests, and clear approved or denied outcome messaging that remains visible in read-only mode.
  - [x] Keep request-to-plan separation explicit: pending requests can be referenced as pending work in the DU request inbox, but they do not become temporary toolbox blocks or fake plan items before real catalog approval exists.

- [x] Task 4: Thread DU request status through live read models while keeping PO-side processing reserved for Story 4.10 (AC: 8-10, 12-18)
  - [x] Extend the DU workspace context returned from `webapp/convex/functions/plans.ts` only as far as needed to expose request-related read state, or add a dedicated DU request query consumed alongside the existing plan context.
  - [x] Consider adding a lightweight DU dashboard request summary if it can be done without diluting the launchpad and canonical-plan focus; if added, keep it read-only and source it from the same request tables instead of a second summary store.
  - [x] Keep the PO requests route and dashboard placeholder intact; Story 5.5 should create stable request contracts and DU visibility, not implement the PO approval workspace itself.
  - [x] Ensure future PO-side approval can write approved or denied outcomes, linked catalog record ids, review notes, and any duplicate-group rollup metadata into the same request tables so the DU inbox updates reactively without a migration.
  - [x] Expose pending-request summary state in a form that later submit-validation stories can consume directly when enforcing FR50c without reverse-engineering the inbox UI.

- [x] Task 5: Reuse existing notification and deadline infrastructure for request updates and automatic expiry (AC: 8, 13-15, 17)
  - [x] Extend `webapp/convex/actions/email.ts` with request-specific email templates or template props instead of inventing a second request-notification transport.
  - [x] Reuse the repo's existing queued email and dev inbox patterns from deadline and access-code workflows for PO submission notifications and DU approval, denial, and expiry notifications.
  - [x] Add request-expiry mechanics that respect the tenant and department submission window rules already managed by Story 4.5; if no cron infrastructure exists yet, introduce the smallest Convex scheduled-job pattern needed for request expiry rather than broad offline polling or ad hoc client timers.
  - [x] Surface reactive DU-side toasts and `aria-live` announcements only for meaningful status transitions so the request inbox stays informative without spamming users on every query refresh.
  - [x] Scope request messaging narrowly to this workflow and do not build a generalized notification center here; Epic 9 still owns broader notification-system work.

- [x] Task 6: Add deterministic coverage for request validation, tenancy, status transitions, and editor integration (AC: 1-18)
  - [x] Add pure helper tests for normalized duplicate keys, cross-DU grouping keys, pending-status display mapping, request expiry eligibility, denial-reason formatting, and safe handling of malformed request payloads.
  - [x] Add backend tests for tenant scoping, DU ownership checks, edit and cancel restrictions, duplicate blocking against both catalog and pending requests, stale dialog revalidation against current category activity and deadline state, status-transition constraints by current request status, request-expiry automation, and PO notification queueing idempotency.
  - [x] Add UI tests for the new editor request surface, including item-versus-category entry, inline validation, pending request edit and cancel affordances, read-only disabled states, stale-status handling when a pending request changes while the dialog is open, and reactive request-status feedback while the editor remains mounted.
  - [x] Prefer extending `webapp/tests/department-user-request-context.test.ts` and `webapp/tests/department-user-blockly-workspace-ui.test.tsx` before adding brand-new top-level suites; only update `webapp/tests/run-tests.ts` if new files are truly necessary.

## Dev Notes

### Story Foundation

- Epic 5 positions Story 5.5 as the first DU-side escape hatch when the catalog is incomplete. The feature is only successful if DUs can stay inside the current Blockly planning workflow, raise a missing-catalog need quickly, and understand what happened to that request later.
- This story sits between the DU editor foundation already delivered in Stories 5.2 through 5.4 and the later PO review story in 4.10. Treat it as the request-domain foundation plus DU read and write experience, not as the place to build the full PO inbox or catalog-approval workspace.
- The business value is not just request submission. It is preserving DU momentum during plan creation so catalog gaps do not force email side conversations, off-platform tracking, or lost planning context.

### Previous Story Intelligence

- Story 5.4 established the current editor shell patterns for dialogs, truthful status badges, local durability, read-only guardrails, and helper-first persistence seams. Story 5.5 should add request flows around that shell instead of refactoring the editor architecture again.
- Story 5.3 already owns validation and duplicate-prevention behavior for actual plan items on the Blockly canvas. Story 5.5 should not confuse request records with real toolbox items or bypass the current workspace validation contracts.
- Story 5.6 and Story 5.7 hardened budget summaries, toolbox ordering, search, and item-source usage. Request UI should complement those surfaces without reintroducing hidden or duplicate toolbox items.
- Story 4.5 already provides shared submission-window and deadline infrastructure plus queued email reminders. Request expiry should reuse those deadline rules instead of inventing a second deadline interpretation.
- Stories 4.7 and 4.8 already introduced category and item normalization, duplication rules, archive states, and workspace-facing item and category metadata. Request validation should align with those helpers so a DU request is checked against the same catalog identity rules the live editor uses.

### Planning And Prototype Intelligence

- The PRD explicitly says DUs can request missing items and categories, view statuses, receive approval or denial notifications, cancel pending requests, edit pending requests, and see pending requests expire at the end of the submission period (FR37a-FR37t, FR84a-FR84e).
- The PRD user journey for Michael Otieno describes the desired success path: request a missing item during plan building, have the PO review it, notify the DU, and then allow the approved item to appear in the live category for drag-and-drop planning.
- The Epic 5 source makes the workflow expectation explicit: Story 5.5 should let the DU request missing catalog entities from inside the planning experience "without forcing them out of context."
- The HTML prototype in `docs/html/procurelinedb.html` provides a useful interaction hint: the DU item-request modal includes an existing-category dropdown, an inline `+ Request New Category` path, estimated unit price, and justification fields. Production code does not need to copy that markup, but it should preserve the same low-friction request intent.

### Current Implementation State Discovered In Code

- `webapp/src/components/blockly/BlocklyEditor.tsx` already renders a reserved toolbar action labeled `Request Item`, but it only calls a placeholder handoff instead of persisting any request data.
- `webapp/convex/functions/plans.ts` already exposes DU workspace context with `availableToolbarActions` containing `request_item`, but the returned context does not include request history, pending counts, or mutation hooks.
- `webapp/convex/schema.ts` currently has no `itemRequests` or `categoryRequests` tables, so there is no canonical request store yet.
- `webapp/src/components/department-user/DepartmentUserDashboard.tsx` currently shows plan and launchpad context, but there is no DU-facing request summary card or request inbox.
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` and `webapp/app/(app)/po/requests/page.tsx` already contain request-workspace placeholders, which confirms that PO processing is intended to exist later but is not yet implemented.
- `webapp/convex/actions/email.ts` and `webapp/convex/functions/deadlines.ts` already establish the preferred pattern for queued transactional email, dev-inbox fallback, idempotency keys, and deadline-driven job handling. Story 5.5 should reuse that pattern for request notifications and expirations.
- `webapp/lib/procurement-officer/items.ts`, `webapp/lib/procurement-officer/categories.ts`, and `webapp/lib/security/input.ts` already provide normalization, plain-text sanitization, duplicate detection, quantity and price messaging, and other validation primitives that request forms should reuse instead of reimplementing.
- `webapp/tests/department-user-request-context.test.ts` and `webapp/tests/department-user-blockly-workspace-ui.test.tsx` already cover adjacent DU request and editor contracts, so Story 5.5 should extend those seams before inventing unrelated test harnesses.

### Technical Requirements

- Keep DU request entry and status review in the current DU planning flow. Do not send the DU to a PO-only route just to request a missing item or category.
- Continue treating Convex as the canonical source of truth. Request records must be durable, tenant-scoped, and reactive; do not create a browser-only request model.
- Use separate `itemRequests` and `categoryRequests` tables, matching the planning artifacts and keeping item-specific fields like estimated price off category requests.
- Every request must capture enough context for later PO review and DU status rendering: tenant, department, requestor, plan, fiscal-year, status, revision, timestamps, normalized-name keys, and review metadata.
- Every request must also persist a stable shared grouping key independent of requestor so later PO-side deduplication and consolidation of same-need requests can happen without backfilling data.
- Reuse existing item and category normalization rules so duplicate detection aligns with the live catalog, including archived or currently unavailable catalog records that still represent the same underlying entity.
- Restrict create, edit, and cancel operations to editable DU sessions only. Read-only or grace-mode sessions may still inspect request history, but they must not mutate pending requests.
- Re-validate the current access mode, request status, and any selected category activity on every write. A request dialog opened earlier must not succeed after the category is archived, the window closes, or PO review already changed the record.
- Keep pending requests outside the actual Blockly toolbox and workspace model. A request is not a plan item until the real catalog record exists and the live catalog query returns it.
- Make request writes and notification dispatch resilient to retries and duplicate clicks. Convex mutation retry semantics are helpful, but request creation and outbound notifications still need idempotent guards.
- Expose pending-request summary data in the canonical request read model so later submit-validation flows can block on unresolved requests without scraping the UI.
- Expiration must use the same submission-window semantics that determine DU editability. Do not add a second deadline system for requests.
- Request notifications should reuse the existing transactional email action plus dev inbox flow and should add only request-specific templates or props, not a brand-new transport layer.
- Use request-specific audit events for create, update, cancel, expire, approve, and deny actions so request lifecycle changes remain reviewable and future audit reporting can rely on first-class event names.
- Keep future Story 4.10 integration explicit: this story defines the DU-side request lifecycle and data contracts; PO-side review mutations should be able to layer on top of them without breaking existing DU screens.

### Detected Conflicts Or Variances

- The live editor currently advertises only `request_item`, but the PRD and epic require both item and category requests. The clean fix is to expand the DU request surface into a generic catalog-request entry point while preserving a simple toolbar footprint.
- The prototype combines item request plus inline new-category capture, while the epic's technical notes call for separate `itemRequests` and `categoryRequests` tables. The recommended resolution is separate persisted request types with a UI that can hand off smoothly between item-request and category-request tabs or states.
- The broader notification-system epic is still backlog, but FR37e and FR84b-FR84e still require request-specific decision and expiry messaging now. Scope this story to targeted request emails plus in-session toasts instead of a general notification center.
- The current DU dashboard has no request summary surface. If a summary card is added here, keep it thin and derived from the same request tables so it complements, rather than competes with, the in-editor request inbox.

### Architecture Compliance

- Keep App Router pages thin. Continue using `DepartmentUserBlocklyWorkspace` and `BlocklyEditor` as the main DU planning composition layers.
- Put authoritative request writes, duplicate enforcement, status transitions, and expiry rules in Convex functions near the schema, not inside client components.
- Follow the repo's existing helper-first pattern: shared request-domain helpers in `webapp/lib/procurement/`, editor integration in `webapp/src/components/blockly/`, and thin query adapters in `webapp/convex/functions/`.
- Use shadcn/ui primitives plus `react-hook-form`, `zodResolver`, and `sonner` for DU request forms and user feedback. Do not introduce a new form or notification stack.
- Preserve Story 5.4's editor durability rules. Request dialogs, sheets, and inbox panels must coexist with the current workspace recovery, save indicator, and leave-guard behavior.
- Preserve role boundaries. Story 5.5 should not give DUs new catalog-management powers; it only creates request records and displays request status.

### Library And Framework Requirements

- Stay on the repo's installed stack for this story unless a separate dependency decision is explicitly approved:
  - Next.js `^16.1.6` in `webapp/package.json`
  - Convex `^1.13.2`
  - Blockly `^12.5.1`
  - React `^19.2.4`
  - `react-hook-form` `^7.47.0`
  - `@hookform/resolvers` `^3.3.2`
  - `zod` `^3.22.4`
  - `sonner` `^2.0.7`
- Verified on 2026-04-12:
  - `npm view next version` -> `16.2.3`
  - `npm view convex version` -> `1.35.1`
  - `npm view zod version` -> `4.3.6`
- Do not upgrade the request-form stack in this story just because newer package versions exist. The current repo already uses `react-hook-form` 7 plus `zod` 3 patterns throughout the UI, and consistency is more valuable here than opportunistic upgrades.
- Official guidance still relevant to this story:
  - Convex React docs say mutations are automatically retried until confirmed written, and the client reconnects automatically if the internet connection drops.
  - MDN documents that `beforeunload` requires sticky activation and only shows a generic browser-controlled string. This matters because request dialogs must cooperate with the existing editor leave-guard behavior instead of trying to replace it.
  - Blockly docs continue to recommend JSON serialization for new projects, so request flows must remain sidecars around the current JSON workspace model rather than creating alternate persisted workspace payloads.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx` if a DU request summary is added
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/actions/email.ts`
  - `webapp/convex/schema.ts`
  - `webapp/lib/security/audit.ts`

- Expected new files (recommended):
  - `webapp/convex/functions/catalogRequests.ts`
  - `webapp/lib/procurement/catalog-requests.ts`
  - `webapp/src/components/blockly/CatalogRequestDialog.tsx`
  - `webapp/src/components/blockly/CatalogRequestInbox.tsx`
  - `webapp/tests/catalog-requests.test.ts` only if the existing DU request-context suite cannot absorb the pure helper and backend assertions cleanly
  - `webapp/tests/catalog-request-ui.test.tsx` only if the existing Blockly workspace UI suite cannot absorb the request-surface assertions cleanly
  - `webapp/convex/crons.ts` if request expiry is implemented with the first scheduled-job seam in this repo

- Reuse these existing seams instead of duplicating them:
  - `webapp/lib/security/input.ts`
  - `webapp/lib/procurement-officer/items.ts`
  - `webapp/lib/procurement-officer/categories.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/deadlines.ts`

### Testing Requirements

- Add pure helper tests for:
  - normalized duplicate-key creation for item and category requests
  - shared cross-DU grouping-key stability for later request consolidation
  - status-label and badge mapping
  - request expiry eligibility by submission-window state
  - malformed payload rejection and safe normalization
  - denial and expiry reason formatting for DU display

- Add backend tests for:
  - tenant and department scoping of DU request reads
  - create, edit, and cancel ownership guards
  - duplicate blocking against both live catalog and pending requests
  - stale category selection or closed submission window while a request dialog is still open
  - status-transition constraints by current request status
  - request-expiry automation
  - PO notification queueing and idempotency behavior
  - pending-request summary outputs consumed by later submit-block validation

- Add UI tests for:
  - opening the catalog-request flow from the DU editor without navigation
  - switching between item-request and category-request entry
  - inline validation and disabled states
  - request inbox status rendering and edit or cancel controls
  - read-only mode preventing request mutations
  - request dialog behavior when the underlying request is approved, denied, cancelled, or expired while still open
  - reactive approval, denial, or expiry feedback while the editor remains mounted

- Prefer extending `webapp/tests/department-user-request-context.test.ts` and `webapp/tests/department-user-blockly-workspace-ui.test.tsx`; update `webapp/tests/run-tests.ts` only if new suites are introduced.

### Git Intelligence Summary

- Recent Blockly and catalog commits show a stable repo direction:
  - `9b32f3a` implemented Story 5.4 through focused persistence helpers, schema extensions, and editor-shell updates rather than a broad rewrite.
  - `8b25c49` and `4d66927` improved validation and duplicate-item behavior through shared helpers and targeted tests.
  - `f90adf9` expanded PO catalog filtering and export guardrails through dedicated catalog helper modules instead of embedding everything in a single component.
- Inference from those commits and the live codebase:
  - Story 5.5 should follow the same pattern: small focused request-domain helpers, thin component wrappers, and targeted Convex modules.
  - Avoid a monolithic "requests system" component that mixes DU editor state, PO review logic, schema definitions, and email orchestration in one file.
  - Reuse the existing helper-first structure from the category, item, deadline, and Blockly stories so the later PO-side request-processing story can slot in cleanly.

### Latest Tech Information

- Verified on 2026-04-12:
  - Next.js latest npm version: `16.2.3`
  - Convex latest npm version: `1.35.1`
  - Zod latest npm version: `4.3.6`
- Official Convex React docs currently state:
  - mutations are automatically retried until they are confirmed written to the database;
  - the client reconnects automatically if the internet connection drops.
- Official MDN docs currently state:
  - `beforeunload` requires sticky activation;
  - the browser shows only a generic browser-controlled confirmation string.
- Official Blockly docs currently continue to recommend JSON serialization for new projects rather than XML.
- Inference:
  - Story 5.5 should extend the current editor shell and request sidecar behavior without touching the canonical Blockly JSON workspace model or the existing Convex retry semantics.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first tenant and role enforcement
  - shadcn/ui plus Tailwind styling
  - `react-hook-form` plus `zod` for forms
  - `sonner` for user notifications
  - Blockly block names in `snake_case`
  - audit events treated as first-class named actions
- Where older planning artifacts differ from the live repo layout, prefer the current repo's actual `webapp/app`, `webapp/src/components`, `webapp/lib`, and `webapp/convex` structure.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 5 Source](../epic-05-du-blockly-planning.md)
- [Story 5.4 Reference](./5-4-plan-persistence-recovery.md)
- [Story 5.6 Reference](./5-6-budget-meter-calculations.md)
- [Story 5.7 Reference](./5-7-blockly-toolbox-block-management.md)
- [Story 4.5 Reference](../../epic4/stories/4-5-submission-deadline-management.md)
- [Story 4.7 Reference](../../epic4/stories/4-7-category-management.md)
- [Story 4.8 Reference](../../epic4/stories/4-8-item-catalog-management.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [DU Prototype](../../../../../docs/html/procurelinedb.html)
- [Current DU Workspace Route](../../../../../webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx)
- [Current Blockly Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Current Toolbox Rail](../../../../../webapp/src/components/blockly/BlocklyToolboxRail.tsx)
- [Current DU Toolbox Helpers](../../../../../webapp/lib/blockly/du-toolbox.ts)
- [Current Plan Functions](../../../../../webapp/convex/functions/plans.ts)
- [Current Deadline Functions](../../../../../webapp/convex/functions/deadlines.ts)
- [Current Email Actions](../../../../../webapp/convex/actions/email.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Current Category Helpers](../../../../../webapp/lib/procurement-officer/categories.ts)
- [Current Item Helpers](../../../../../webapp/lib/procurement-officer/items.ts)
- [Current Security Input Helpers](../../../../../webapp/lib/security/input.ts)
- [Current Audit Helpers](../../../../../webapp/lib/security/audit.ts)
- [Current Webapp Package Versions](../../../../../webapp/package.json)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Blockly Serialization Docs](https://developers.google.com/blockly/guides/configure/web/serialization)
- [MDN BeforeUnloadEvent.returnValue](https://developer.mozilla.org/en-US/docs/Web/API/BeforeUnloadEvent/returnValue)

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
  - `_bmad-output/implementation-artifacts/epics/epic5/stories/5-4-plan-persistence-recovery.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `docs/html/procurelinedb.html`
  - `webapp/package.json`
  - `webapp/convex/actions/email.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/deadlines.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/schema.ts`
  - `webapp/lib/blockly/du-toolbox.ts`
  - `webapp/lib/procurement-officer/categories.ts`
  - `webapp/lib/procurement-officer/items.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/lib/security/input.ts`
  - `webapp/src/components/blockly/BlocklyEditor.tsx`
  - `webapp/src/components/blockly/BlocklyToolboxRail.tsx`
  - `webapp/src/components/department-user/DepartmentUserBlocklyWorkspace.tsx`
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/app/(app)/po/requests/page.tsx`
- Git context:
  - `git log -5 --pretty=format:"%h %ad %s" --date=short`
  - `git show --stat --oneline 9177e60`
  - `git show --stat --oneline f90adf9`
  - `git show --stat --oneline 9b32f3a`
- Tech verification:
  - `cmd /c npm view next version`
  - `cmd /c npm view convex version`
  - `cmd /c npm view zod version`
  - `https://docs.convex.dev/client/react`
  - `https://developers.google.com/blockly/guides/configure/web/serialization`
  - `https://developer.mozilla.org/en-US/docs/Web/API/BeforeUnloadEvent/returnValue`

### Completion Notes List

- 2026-04-12: Added canonical `categoryRequests` and `itemRequests` schema tables, shared DU request-domain helpers, audit events, and request-specific email template support so DU request state now lives in Convex instead of editor placeholders.
- 2026-04-12: Implemented `webapp/convex/functions/catalogRequests.ts` with tenant-safe DU request creation, edit, cancel, history reads, pending-request summary shaping, duplicate blocking against live catalog and pending requests, and deadline-driven expiry orchestration.
- 2026-04-12: Replaced the reserved editor CTA with an in-context `Catalog request` flow using a tabbed request dialog, a reactive DU inbox, optimistic revision guards, read-only truthfulness, and toast plus `aria-live` style status feedback while preserving Story 5.4 editor continuity.
- 2026-04-12: Extended deterministic DU request helper and UI coverage in `department-user-request-context.test.ts` and `department-user-blockly-workspace-ui.test.tsx`; `npm test` passed and `npm run lint` completed with one pre-existing hook-dependency warning in `src/components/blockly/BlocklyWorkspace.tsx`.

### File List

- `_bmad-output/implementation-artifacts/epics/epic5/stories/5-5-item-category-requests-du-side.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/actions/email.ts`
- `webapp/convex/crons.ts`
- `webapp/convex/functions/catalogRequests.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/blockly/workspace-catalog-identity.ts`
- `webapp/lib/procurement/catalog-requests.ts`
- `webapp/lib/security/audit.ts`
- `webapp/src/components/blockly/BlocklyEditor.tsx`
- `webapp/src/components/blockly/CatalogRequestDialog.tsx`
- `webapp/src/components/blockly/CatalogRequestInbox.tsx`
- `webapp/tests/department-user-blockly-workspace-ui.test.tsx`
- `webapp/tests/department-user-request-context.test.ts`
- `webapp/.test-dist/lib/procurement/catalog-requests.js`
- `webapp/.test-dist/lib/security/audit.js`
- `webapp/.test-dist/src/components/blockly/CatalogRequestInbox.js`
- `webapp/.test-dist/tests/department-user-blockly-workspace-ui.test.js`
- `webapp/.test-dist/tests/department-user-request-context.test.js`

### Change Log

- 2026-04-12: Implemented Story 5.5 DU-side catalog requests across Convex schema and functions, shared request-domain helpers, the Blockly editor request dialog and inbox, deadline expiry plumbing, audit and email integration, and deterministic DU request coverage.

## Story Completion Status

- Story ID: `5.5`
- Story Key: `5-5-item-category-requests-du-side`
- Output File: `_bmad-output/implementation-artifacts/epics/epic5/stories/5-5-item-category-requests-du-side.md`
- Final Status: `review`
- Completion Note: `Implemented DU-side item and category request creation, editing, cancellation, status visibility, and expiry handling inside the Blockly planning workflow with deterministic validation and UI coverage.`
