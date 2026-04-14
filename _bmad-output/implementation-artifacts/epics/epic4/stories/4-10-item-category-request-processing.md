# Story 4.10: Item & Category Request Processing

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to review and process Departmental User item and category requests from one governed queue,
so that the tenant catalog can evolve safely without duplicating catalog logic, losing auditability, or breaking downstream DU planning flows.

## Acceptance Criteria

1. [Given] a Procurement Officer opens `/po/requests` or the requests entry point from the `/po` dashboard modal [When] the protected PO workspace resolves [Then] the app renders a real request-processing workspace instead of the current placeholder cards [And] `/po` remains the canonical Procurement Officer shell (FR37h, current dashboard-modal contract).
2. [Given] pending catalog requests exist for the tenant [When] the Procurement Officer loads the requests workspace [Then] the inbox shows a combined queue of item and category requests with request type, requested name, requesting department, requesting DU, submitted timestamp, current status, and any category or estimated-price context needed to decide [And] the query remains tenant-scoped and Procurement-Officer-only (FR37h, NFR-S1).
3. [Given] new requests are created or existing requests are processed [When] the Procurement Officer is already in the dashboard [Then] the request inbox badge, queue counts, and rows update via the existing Convex-backed PO dashboard flow instead of manual refresh or polling (FR37i).
4. [Given] multiple DUs submit materially identical requests for the same tenant [When] the PO inbox loads [Then] the system consolidates them into one truthful review cluster keyed by normalized request identity [And] the UI shows how many departments or requestors are attached [And] the underlying per-request records remain recoverable for history, notification, and later DU-side self-service flows (FR37u).
5. [Given] the Procurement Officer reviews an item request [When] they approve it with or without edits [Then] the system creates the live catalog item through the same canonical item rules already owned by Story 4.8 [And] approval may adjust name, description, unit price, category assignment, procurement method, or other bounded catalog-safe fields before save [And] the request record stores the approved snapshot and resulting item ID (FR37j, FR37k).
6. [Given] the Procurement Officer reviews a category request [When] they approve it [Then] the system creates the live category through the same canonical category rules already owned by Story 4.7 [And] the request record stores the approved snapshot and resulting category ID [And] duplicate-name or tier-limit violations surface as deterministic request-processing errors instead of bypassing category governance (FR37m).
7. [Given] the Procurement Officer denies an item or category request [When] they submit the decision [Then] the system requires a non-empty denial reason [And] the request moves to a denied state with actor, timestamp, and reason recorded [And] the denial does not create or mutate live catalog data (FR37l, FR37n).
8. [Given] the Procurement Officer approves or denies a request [When] the decision succeeds [Then] the system sends or queues DU-facing notification through the existing external email bridge and persists request-outcome metadata that later DU-side in-app surfaces can read [And] this story does not invent a second competing DU request-entry workflow while Story 5.5 is still reserved (FR37o, FR84b, FR84c).
9. [Given] the Procurement Officer selects multiple compatible requests [When] they bulk approve or bulk deny [Then] the system processes them in one governed action with deterministic partial-success reporting [And] incompatible rows are skipped with explicit reasons [And] bulk deny uses one shared reason while bulk approve still respects per-row duplicate, tier, and category rules (FR37v, FR37w).
10. [Given] the Procurement Officer needs to inspect past request handling [When] they switch to history or apply filters [Then] the workspace supports filtering by request type, department, status, and date range [And] processed records retain final decision metadata, approved object links, and denial reasons where relevant (FR37x, FR37y).
11. [Given] a request is denied [When] the denial is still inside the allowed undo window and the DU-facing denial notification has not yet been irreversibly delivered [Then] the Procurement Officer can undo the denial and restore the request to a pending review state [And] after the undo window or confirmed notification delivery the system blocks undo deterministically (FR37z).
12. [Given] the shared submission deadline passes or the request otherwise becomes non-actionable [When] pending request records are read or processed [Then] the system marks them as expired or blocked without leaving them perpetually pending [And] the PO inbox, history, and future DU-side status flows remain truthful about why the request can no longer be approved (FR37g, Story 4.5 deadline contract).
13. [Given] request reads or writes execute [When] tenant, role, audit, and integration boundaries apply [Then] all access remains tenant-scoped, all state changes require Procurement Officer authorization in Convex, all external notification work flows through actions or NestJS rather than direct query or mutation fetches, expected failures return deterministic `ConvexError` contracts, and append-only audit entries capture state-changing request operations (NFR-S1, NFR-S7, NFR-S9).
14. [Given] Story 5.5 has not yet landed [When] Story 4.10 is implemented [Then] the code establishes the shared request-domain contract, PO review workspace, and decision or notification flow without backdooring a duplicate DU request-creation UI inside Blockly [And] the existing reserved `Request Item` action in the DU editor remains truthful until the DU-side story plugs into the same request model.

## Tasks / Subtasks

- [ ] Task 1: Introduce a shared tenant-scoped catalog-request domain model instead of building separate ad hoc PO-side state (AC: 2-12)
  - [ ] Extend `webapp/convex/schema.ts` with a canonical request table such as `procurementCatalogRequests` that supports `requestType`, normalized dedupe key, requester metadata, department and fiscal-year context, status, approved or denied snapshots, linked catalog IDs, notification state, undo window metadata, and expiration fields.
  - [ ] Prefer one shared request queue contract over two divergent PO review tables so item and category requests can share filtering, dedupe, history, and notification behavior while still preserving request-type-specific payload fields.
  - [ ] Preserve one auditable row per DU submission even when the PO inbox renders grouped clusters, so dedupe never destroys requester-level history or future Story 5.5 cancel or status semantics.
  - [ ] Add the indexes needed for tenant-scoped inbox reads and fast filters, especially tenant + status, tenant + type + createdAt, tenant + department + createdAt, and tenant + dedupe key.
  - [ ] Keep the schema flexible enough for Story 5.5 to add DU edit, cancel, and self-service status behavior later without replacing the table or inventing a second request model.
  - [ ] Extend `webapp/lib/security/audit.ts` with request-specific audit event names for approve, deny, bulk approve, bulk deny, denial undo, and expiration outcomes.

- [ ] Task 2: Build request helper and validator modules that match the repo's existing PO workspace patterns (AC: 2-12, 14)
  - [ ] Add `webapp/lib/procurement-officer/requests.ts` for request normalization, consolidation-key building, filter normalization, status labels, bulk-compatibility rules, denial undo timing, and user-facing error mapping.
  - [ ] Add focused validator support such as `webapp/lib/validators/request-decision.ts` for approval edits, denial-reason validation, and bulk-decision forms using the same RHF + Zod patterns already used in category and item workspaces.
  - [ ] Keep request-specific copy and deterministic messages centralized in helpers so the UI, tests, and Convex error responses stay aligned.

- [ ] Task 3: Implement a focused Convex request-processing module that reuses existing item and category governance instead of duplicating it (AC: 2-13)
  - [ ] Add `webapp/convex/functions/requests.ts` for inbox reads, history reads, request clustering, approve, deny, bulk approve, bulk deny, denial undo, and expiry handling.
  - [ ] Reuse the existing authorization pattern with `requireTenantRole(ctx, ["procurement_officer"])` and current membership checks rather than relying on route protection.
  - [ ] For item approvals, reuse or extract shared item-create validation from `webapp/convex/functions/items.ts` so duplicates, tier caps, category-activity rules, price history, and stable ID semantics stay consistent with Story 4.8.
  - [ ] For category approvals, reuse or extract shared category-create validation from `webapp/convex/functions/categories.ts` so normalized-name uniqueness, tier limits, and sort-order handling stay consistent with Story 4.7.
  - [ ] Store the approved or denied request snapshot and resulting linked record IDs on the request row so history and later DU surfaces remain truthful after processing.
  - [ ] Prevent silent reprocessing by rejecting stale or already-finalized requests deterministically.

- [ ] Task 4: Replace the staged PO requests placeholder with a real requests workspace inside the existing dashboard shell (AC: 1-4, 9-10, 14)
  - [ ] Add the missing thin route file `webapp/app/(app)/po/requests/page.tsx` so `/po/requests` resolves through the existing protected route structure instead of relying only on string-based route mapping.
  - [ ] Add `webapp/src/components/procurement-officer/ProcurementOfficerRequestsWorkspace.tsx` and mount it from `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` in place of the current placeholder cards for the `requests` modal.
  - [ ] Update `webapp/lib/procurement-officer/dashboard.ts`, `webapp/lib/procurement-officer/dashboard-snapshot.ts`, and `webapp/convex/functions/procurementOfficerDashboard.ts` so the request inbox panel becomes live, shows truthful counts, and keeps `/po` as the canonical shell.
  - [ ] Add request filters, row selection, bulk-action affordances, history switching, and empty states without regressing the current dashboard modal behavior.

- [ ] Task 5: Reuse the existing external email bridge for request outcomes and model denial undo around delivery state instead of inventing a second notification system (AC: 8, 11-13)
  - [ ] Reuse `webapp/convex/actions/email.ts` and the existing NestJS email queue instead of adding direct email fetches from queries or mutations.
  - [ ] Add a request-decision notification path using either the existing generic-notification template or a narrowly scoped new request template if clearer copy is needed.
  - [ ] For denials, prefer delayed delivery keyed by an idempotency key and `deliverAt` equal to the undo deadline so `undo denial` can cancel the queued email cleanly before it sends.
  - [ ] Persist notification-state metadata on the request record so future DU-side in-app status rendering in Story 5.5 can consume the same truth without reverse-engineering email outcomes.

- [ ] Task 6: Handle request expiry, dashboard truthfulness, and later-story boundaries explicitly (AC: 3, 8, 10, 12, 14)
  - [ ] Tie pending-request actionability to the shared submission deadline and any current read-only or non-editable planning state so the inbox does not suggest approvals after the request window has effectively closed.
  - [ ] Make the PO dashboard badge, request panel, and request history truthful about unavailable, expired, denied, approved, and pending states rather than leaving "unavailable" staging copy behind once Story 4.10 lands.
  - [ ] Preserve the existing reserved `Request Item` toolbar affordance in `webapp/src/components/blockly/BlocklyEditor.tsx` until Story 5.5 wires the DU-side creation flow into the same shared request model.

- [ ] Task 7: Add deterministic regression coverage for request clustering, decision flows, notification timing, and dashboard routing (AC: 1-14)
  - [ ] Add helper tests for dedupe-key shaping, filter normalization, bulk compatibility, expiry evaluation, undo-window timing, and notification-state transitions.
  - [ ] Add backend tests proving tenant-scoped inbox reads, item approval creates catalog items through existing rules, category approval creates categories through existing rules, denial reason is required, bulk actions surface partial skips deterministically, undo denial respects queued-notification state, and expired requests stop processing.
  - [ ] Add dashboard and workspace tests proving `/po/requests` routes into the `/po` modal shell, the request inbox is no longer staged as unavailable, and request filters or empty states render truthfully.
  - [ ] Add email-queue integration tests around request-decision notification idempotency and denial-undo cancellation if the request workflow introduces new template names or queue semantics.
  - [ ] Register any new suites in `webapp/tests/run-tests.ts`.

## Dev Notes

### Story Foundation

- Story 4.10 is the first live activation of PO-side request review in the repo. Today the `/po` dashboard already reserves a requests modal entry point, but it intentionally renders placeholder cards because the request queue does not exist yet.
- This story is not about inventing a second catalog system. It is about adding the governance layer on top of the live category and item catalogs delivered in Stories 4.7, 4.8, and 4.9.
- Because Story 5.5 remains backlog and the DU editor still reserves the `Request Item` action, Story 4.10 should establish the shared request-domain and PO review workflow without backdooring a duplicate DU request-entry UI.

### Previous Story Intelligence

- Story 4.9 already proved the right route and workspace shape for this area: thin route files, `/po` as the canonical shell, helper-driven search or filter state, and real work happening inside dashboard-mounted modal components.
- Story 4.8 already owns the canonical item rules: duplicate prevention, tier caps, import constraints, price history, and stable item IDs. Request approval must reuse that logic rather than copy-pasting a second "create item" path.
- Story 4.7 already owns the canonical category rules: normalized uniqueness, ordering, archive safety, and delete blockers. Category request approval must reuse that logic rather than fork category creation rules inside a requests module.
- Recent Story 5.4 and 4.9 work reinforced the repo's current style: deterministic helper modules, explicit edge-case handling, and tests that protect state transitions. Request review should follow that same style, especially for bulk actions, expiry, and undo windows.

### Detected Variance And Resolution

- The sprint sequence places Story 5.5 (`item-category-requests-du-side`) before Story 4.10, but this story is being created now.
- The clean resolution is:
  - build the shared request table, PO inbox, approval or denial history, bulk handling, expiry rules, and notification-state model here;
  - keep DU request entry, DU edit or cancel flows, and DU-side request-status UI owned by Story 5.5;
  - preserve the existing reserved `Request Item` button text in `BlocklyEditor.tsx` until the DU story can attach to the shared request model.

### Current Implementation State Discovered In Code

- `webapp/lib/procurement-officer/dashboard.ts` already normalizes `/po/requests` into the dashboard modal contract, so request processing should plug into that same shell instead of inventing a new PO page architecture.
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` already renders a `requests` modal, but today it only shows placeholder future-panel cards.
- `webapp/lib/procurement-officer/dashboard-snapshot.ts` still marks `request_inbox` as unavailable and explicitly notes that request review depends on later-story request queues.
- There is no real `webapp/app/(app)/po/requests/page.tsx` route file yet, so the requests path still needs a proper route leaf if Story 4.10 is to be first-class.
- `webapp/convex/schema.ts` has live `procurementCategories`, `procurementItems`, `plans`, `departmentUserProfiles`, and audit tables, but it has no request queue table today.
- `webapp/src/components/blockly/BlocklyEditor.tsx` still reserves the DU-side request action with the explicit message `Item request handoff stays reserved until Story 5.5 lands.`
- `webapp/convex/functions/items.ts` and `webapp/convex/functions/categories.ts` already own the real create, update, import, archive, duplicate, tier-limit, and audit rules for their respective catalog domains.
- `webapp/convex/actions/email.ts` plus `nestjs/src/email/email.service.ts` already provide the durable notification bridge the request workflow should reuse for approval or denial messaging.

### Technical Requirements

- Prefer one unified request queue model for PO review rather than separate item-only and category-only review stacks. A shared request table keeps filtering, dedupe, history, expiry, and notification-state logic aligned.
- At minimum, each request record should support tenant, department, requester, request type, normalized request identity, raw request snapshot, current status, approved or denied snapshot, resulting linked catalog IDs, processed-by metadata, and notification or undo metadata.
- Treat duplicate consolidation as a read-model and workflow concern, not a destructive dedupe. The system should keep one durable row per DU submission and use the shared normalized key to group compatible rows in the PO inbox.
- Use a narrow, explicit status model from the start so request transitions stay deterministic. Recommended baseline: `pending`, `approved`, `denied`, `expired`, plus a reserved `canceled` status for Story 5.5. Finalized states should be immutable except for the bounded `denied -> pending` undo path defined in this story.
- Item approval must reuse the canonical item rules from Story 4.8, including duplicate prevention, active-category checks, per-category tier limits, price-history creation, and stable item identity.
- Category approval must reuse the canonical category rules from Story 4.7, including normalized uniqueness, active-category tier caps, sort-order assignment, and audit logging.
- Denial undo should be modeled as a real state transition with a bounded window. The most reliable implementation path is to delay the DU-facing denial email until the undo window closes, then cancel that queued email if the denial is undone in time.
- Expiry should be deterministic. A request that can no longer be acted on because the submission window closed or the request is otherwise obsolete must not remain endlessly pending in the PO queue.
- Prefer lazy expiry enforcement during inbox reads and decision mutations unless the repo already has a suitable scheduled-job pattern. This story should not block on inventing background automation just to keep expired rows truthful.
- Request-outcome metadata should be stored in a DU-consumable way so Story 5.5 can surface status later without creating a second source of truth.
- "In-app notification" for the current repo should mean durable request outcome state and dashboard-visible truth, not a new standalone DU notification center. Story 5.5 can attach DU-facing presentation to the same stored outcome metadata.

### Architecture Compliance

- Keep `webapp/app/(app)/po/requests/page.tsx` thin and route-unique, with the real interactive state living in PO workspace components and helper modules.
- Reuse the `/po` dashboard modal contract already established by the Procurement Officer shell; do not create a separate requests-only dashboard or route tree.
- Keep authorization, request processing rules, and tenant scoping in Convex near the data source using the existing role-guard pattern.
- Reuse Convex `query` and `mutation` for request reads and state transitions, and use actions only for external notification work. Official Convex guidance still treats actions as the place for outside-world calls while keeping most logic in queries and mutations.
- Reuse the current external email bridge rather than calling NestJS directly from UI code or issuing raw fetches from Convex mutations.
- Do not add a second DU entrypoint, sidebar section, or notification-center surface in this story. The only new end-user workspace here is the PO review experience and the underlying shared request state.

### Library And Framework Requirements

- Stay on the repo's installed stack for implementation work:
  - Next.js `^16.1.6` in `webapp/package.json`
  - Convex `^1.13.2` in `webapp/package.json`
  - Blockly `^12.5.1` in `webapp/package.json`
  - Zod `^3.22.4` in `webapp/package.json`
  - NestJS email service stack from `nestjs/package.json`
- Latest upstream versions verified on `2026-04-12`:
  - Next.js `16.2.3`
  - Convex `1.35.1`
- Official documentation still supports the patterns this story should follow:
  - Next.js App Router continues to treat `page.tsx` as the leaf route file, which supports a thin `/po/requests/page.tsx`.
  - Convex docs still state that queries and mutations should not call the outside world directly, and external integration work should happen in actions.
- Because the repo is intentionally pinned behind the newest releases, Story 4.10 should preserve current installed APIs and patterns rather than turn into a dependency-upgrade story.

### Reuse And Anti-Reinvention Guidance

- Reuse the live PO shell and modal routing from:
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
- Reuse canonical catalog rules from:
  - `webapp/convex/functions/items.ts`
  - `webapp/convex/functions/categories.ts`
- Reuse the existing audit helpers from:
  - `webapp/lib/security/audit.ts`
  - `webapp/convex/functions/_audit.ts`
- Reuse the external email bridge from:
  - `webapp/convex/actions/email.ts`
  - `webapp/convex/actions/_helpers.ts`
  - `nestjs/src/email/email.service.ts`
- Reuse the current reserved DU request handoff seam in `webapp/src/components/blockly/BlocklyEditor.tsx` rather than replacing it with a one-off request entry flow in this story.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/items.ts`
  - `webapp/convex/functions/categories.ts`
  - `webapp/convex/actions/email.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/tests/procurement-officer-dashboard.test.ts`
  - `webapp/tests/run-tests.ts`
- Expected new files (recommended):
  - `webapp/app/(app)/po/requests/page.tsx`
  - `webapp/convex/functions/requests.ts`
  - `webapp/lib/procurement-officer/requests.ts`
  - `webapp/lib/validators/request-decision.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerRequestsWorkspace.tsx`
  - `webapp/tests/procurement-officer-requests.test.ts`
- Optional new files only if clearer copy is worth the extra maintenance:
  - `nestjs/src/email/templates/request-decision.template.ts`

### Testing Requirements

- Add helper tests for request dedupe-key shaping, filter normalization, bulk compatibility, expiry evaluation, undo-window timing, and notification-state transitions.
- Add backend tests proving:
  - tenant-scoped inbox reads
  - unauthorized and cross-tenant rejection
  - item approval creates a live catalog item through existing rules
  - category approval creates a live category through existing rules
  - denial reason is required
  - bulk actions surface partial skips deterministically
  - denial undo cancels queued notification only while still eligible
  - expired requests can no longer be processed
  - audit entries are appended for state-changing request outcomes
- Add dashboard and workspace tests proving `/po/requests` routes into the `/po` modal shell, the request inbox is no longer staged as unavailable, and request filters or empty states render truthfully.
- Add email-queue integration tests around request-decision notification idempotency and denial-undo cancellation if the request workflow introduces new template names or queue semantics.
- Register any new suites in `webapp/tests/run-tests.ts`.

### Git Intelligence Summary

- Commit `f90adf9` added catalog filters and export guard logic using helper modules, thin routing, and dashboard-modal preservation. Story 4.10 should follow that same PO-shell pattern instead of introducing a one-off requests architecture.
- Commits `9b32f3a` and `9177e60` reinforced the repo's current preference for explicit state machines, deterministic retries, and guardrail tests. Request expiry, denial undo, and notification timing should be built with the same rigor.
- Commits `8b25c49` and `4d66927` continued hardening live Blockly behavior, which is a signal not to embed request-creation work into the DU editor during this PO-side story.

### Latest Tech Information

- Verified on `2026-04-12`:
  - Next.js latest npm version: `16.2.3`
  - Convex latest npm version: `1.35.1`
- Official Next.js App Router docs currently still describe `page.tsx` as the route leaf, which supports a thin `/po/requests/page.tsx` that delegates interactive work to client components.
- Official Convex docs currently still state that query and mutation functions are not allowed to call the outside world directly, and action functions are the right place for external integrations.
- Inference:
  - request inbox reads and decision mutations should stay in Convex functions;
  - request-decision notifications should reuse the existing `actions/email.ts` bridge rather than introducing direct service calls from mutations.

### Project Context Reference

- Apply the current project-context rules that match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first authorization and tenant enforcement
  - shadcn/ui + Tailwind for operator workflows
  - `sonner` for user feedback
  - append-only audit patterns
  - desktop-only UX
- Where older planning docs conflict with the live repo or current implementation seams, prefer the live repo structure and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 4 Source](../epic-04-po-department-catalog.md)
- [Story 4.7 Reference](./4-7-category-management.md)
- [Story 4.8 Reference](./4-8-item-catalog-management.md)
- [Story 4.9 Reference](./4-9-catalog-search-export.md)
- [Epic 5 Source](../../epic5/epic-05-du-blockly-planning.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [PO Dashboard](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [PO Dashboard Helpers](../../../../../webapp/lib/procurement-officer/dashboard.ts)
- [PO Dashboard Snapshot](../../../../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
- [PO Dashboard Query](../../../../../webapp/convex/functions/procurementOfficerDashboard.ts)
- [Category Rules](../../../../../webapp/convex/functions/categories.ts)
- [Item Rules](../../../../../webapp/convex/functions/items.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Audit Vocabulary](../../../../../webapp/lib/security/audit.ts)
- [Email Action Bridge](../../../../../webapp/convex/actions/email.ts)
- [Email Service Bridge Helpers](../../../../../webapp/convex/actions/_helpers.ts)
- [NestJS Email Service](../../../../../nestjs/src/email/email.service.ts)
- [DU Planning Context](../../../../../webapp/convex/functions/plans.ts)
- [DU Blockly Editor](../../../../../webapp/src/components/blockly/BlocklyEditor.tsx)
- [Webapp Package Versions](../../../../../webapp/package.json)
- [NestJS Package Versions](../../../../../nestjs/package.json)
- [Next.js `page.tsx` Convention](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [Convex Mutation Functions](https://docs.convex.dev/functions/mutation-functions)
- [Convex Calling External Services](https://docs.convex.dev/tutorial/actions)

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
- Previous-story sources:
  - `_bmad-output/implementation-artifacts/epics/epic4/stories/4-9-catalog-search-export.md`
  - `_bmad-output/implementation-artifacts/epics/epic4/stories/4-8-item-catalog-management.md`
  - `_bmad-output/implementation-artifacts/epics/epic4/stories/4-7-category-management.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Live implementation sources:
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/convex/functions/items.ts`
  - `webapp/convex/functions/categories.ts`
  - `webapp/convex/functions/plans.ts`
  - `webapp/convex/schema.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/convex/actions/email.ts`
  - `webapp/convex/actions/_helpers.ts`
  - `nestjs/src/email/email.service.ts`
- Git context:
  - `git log -5 --oneline`
- Tech verification:
  - `cmd /c npm view next version`
  - `cmd /c npm view convex version`
  - `https://nextjs.org/docs/app/api-reference/file-conventions/page`
  - `https://docs.convex.dev/functions/mutation-functions`
  - `https://docs.convex.dev/tutorial/actions`

### Completion Notes List

- 2026-04-12: Created implementation-ready story context for Story 4.10 using the live PO dashboard modal architecture, current category and item governance modules, the reserved DU request handoff seam, and current official Next.js and Convex guidance.
- 2026-04-12: Resolved the current sequencing variance by scoping Story 4.10 to PO-side request review, shared request-domain modeling, decision notifications, and history, while preserving Story 5.5 ownership of DU-side request creation and DU request-status UX.
- 2026-04-12: Clarified that request clustering is a grouped read model over per-request rows, added an explicit recommended status model, and constrained expiry handling so implementation stays deterministic without unnecessary background-job scope.

### Change Log

- 2026-04-12: Created implementation-ready story context for `4-10-item-category-request-processing`.

### File List

- `_bmad-output/implementation-artifacts/epics/epic4/stories/4-10-item-category-request-processing.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Story Completion Status

- Story ID: `4.10`
- Story Key: `4-10-item-category-request-processing`
- Output File: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-10-item-category-request-processing.md`
- Final Status: `ready-for-dev`
- Completion Note: `Story reviewed and tightened for deterministic request modeling, status transitions, and implementation boundaries.`
