# Story 4.1: PO Dashboard & Onboarding Wizard

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want a concise preparation dashboard with onboarding guidance,
so that I can see what setup work is complete, what is blocking department planning, and where to go next without hunting across the product.

## Acceptance Criteria

1. [Given] a Procurement Officer signs in successfully [When] they open `/po` [Then] the current placeholder page is replaced with a real dashboard shell built for the protected app [And] the UI uses the existing Procureline tweakcn theme tokens, shadcn/ui primitives, and `lucide-react` icons instead of a new dashboard library or prototype-only markup.
2. [Given] a first-time Procurement Officer with no preparation work completed [When] the dashboard loads [Then] it shows a concise onboarding wizard/checklist with these five steps in order: Create Departments, Add Categories, Add Items, Generate Access Codes, Set Deadline (FR28a).
3. [Given] the dashboard renders checklist or readiness states [When] a step depends on live data that does not yet exist in the current repo, such as categories, items, pending request counts, or plan submissions [Then] that step or panel is labeled with an explicit `coming soon`, `awaiting later story`, `not configured`, or `unavailable` state [And] the UI must not fabricate prototype-derived counts, percentages, lists, or fake completion.
4. [Given] the Procurement Officer views the dashboard [When] the app cannot resolve a safe fiscal-year context from live tenant signals [Then] it shows the warning `Fiscal year not configured. Contact your Tenant Admin.` and keeps the rest of the dashboard honest about the missing setup dependency (FR28b).
5. [Given] the Procurement Officer views the dashboard [When] no safe shared submission deadline can be derived from the active department setup currently stored in Convex [Then] it shows the warning `Submission deadline not set. Configure before DUs can submit.` with a clear CTA toward the deadline-management destination or placeholder (FR28c).
6. [Given] the Procurement Officer views the dashboard [When] no departments exist yet [Then] the dashboard shows an empty state with a primary `Create your first department` CTA and does not render misleading readiness metrics (FR28d).
7. [Given] there is live department, access-code, and department-user data [When] the dashboard loads [Then] it surfaces concise readiness metrics and a department readiness list focused on the prep phase, such as departments configured, access-code coverage, DU assignment coverage, and deadline readiness, rather than copying the prototype's budget/compliance/system-health cards that are not backed by the current schema.
8. [Given] the user switches fiscal years [When] previous fiscal years can be inferred from live department windows or other safe dashboard signals [Then] the dashboard updates in place for the selected year without leaving `/po` and without leaking data across fiscal years (FR28h).
9. [Given] the Procurement Officer remains on the dashboard [When] live dashboard data changes in Convex [Then] the dashboard refreshes reactively through Convex queries and does not rely on manual polling, browser refresh, or separate REST fetches for the same snapshot (FR28i).
10. [Given] the PO dashboard references future workflows such as departments, categories, items, access codes, deadline settings, request review, or consolidation [When] those destinations are not implemented yet [Then] the dashboard links point to stable `/po/...` routes or placeholders that preserve information architecture without pretending the downstream feature is done.
11. [Given] the dashboard is derived from `docs/html/Procureline.html` and the UX design specification [When] the UI is implemented [Then] it keeps the prototype's role-specific visual direction, concise bento hierarchy, and prep-phase emphasis as inspiration only [And] it does not copy the prototype's fake totals, system-uptime card, full review tables, or categories manager one-to-one into production.
12. [Given] the dashboard is viewed on a viewport below the desktop threshold [When] the route loads [Then] it shows a desktop-required state consistent with the UX specification's desktop-only platform strategy instead of shipping a degraded fake mobile dashboard.

## Tasks / Subtasks

- [ ] Task 1: Replace the `/po` placeholder with a real Procurement Officer dashboard shell (AC: 1, 2, 6, 11, 12)
  - [ ] Keep `webapp/app/(app)/po/page.tsx` thin and move the interactive UI into a dedicated feature component such as `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`.
  - [ ] Reuse the existing protected app shell in `webapp/app/(app)/layout.tsx` and the current role guard behavior instead of adding a second PO layout.
  - [ ] Build the dashboard with shadcn/ui components already present in the repo (`Card`, `Badge`, `Button`, `Alert`, `Select`, `Progress`, `Skeleton`, `Tooltip`, `ScrollArea`, etc.) plus `lucide-react` icons.
  - [ ] Use the existing Procureline tweakcn theme already installed in `webapp/app/globals.css`; do not add a separate theme system, chart package, or icon package.
  - [ ] Add a desktop-required fallback state aligned with the UX spec's desktop-only guidance and the existing tenant-admin dashboard pattern.

- [ ] Task 2: Create a PO dashboard snapshot contract backed by live Convex data that exists today (AC: 3, 4, 5, 6, 7, 8, 9, 10)
  - [ ] Add a focused Convex query module such as `webapp/convex/functions/procurementOfficerDashboard.ts` instead of overloading `users.ts`.
  - [ ] Guard the query with `requireTenantRole(ctx, ["procurement_officer"])` so only Procurement Officers can load the snapshot.
  - [ ] Aggregate only from live tables that already exist in `webapp/convex/schema.ts`, especially `tenants`, `tenantUsers`, `departments`, `departmentAccessCodes`, `departmentUserProfiles`, and tenant-scoped `auditLogs` where useful.
  - [ ] Shape the response so later Epic 4 stories can extend it without redesigning `/po`, for example top-level groups such as `hero`, `summaryCards`, `setupChecklist`, `alerts`, `departmentReadiness`, `fiscalYears`, `futurePanels`, and `meta`.
  - [ ] Explicitly model `available`, `empty`, `setup_required`, `coming_soon`, and `unavailable` states so the UI stays truthful when later-story data sources are missing.
  - [ ] Do not invent `categories`, `items`, `itemRequests`, `categoryRequests`, `plans`, `consolidation`, or `fiscalYears` data in this story just to fill cards or badges.

- [ ] Task 3: Implement onboarding, fiscal-year, and readiness derivation in pure helper modules (AC: 2, 3, 4, 5, 7, 8)
  - [ ] Add a helper module such as `webapp/lib/procurement-officer/dashboard.ts` for fiscal-year labeling, checklist prioritization, readiness-state derivation, and warning copy so the logic is testable outside React.
  - [ ] Derive fiscal-year defaults from the Kenya July 1 to June 30 rule already documented in project context and architecture.
  - [ ] Derive the `Set Deadline` readiness state from active department submission windows only when the deadline can be represented safely; otherwise prefer a warning/setup-required state over a fabricated deadline.
  - [ ] Derive the `Generate Access Codes` readiness state from active departments versus active department access codes.
  - [ ] Derive a department readiness list from live prep signals already in the schema, such as department activity, DU assignment presence, access-code presence, and submission-window validity.
  - [ ] Keep categories, items, submission monitoring, request badges, and consolidation panels honest as staged future panels until their source tables and functions land in later stories.

- [ ] Task 4: Stabilize PO information architecture and future-route contracts without pre-building later stories (AC: 3, 10, 11)
  - [ ] Add a small placeholder pattern for reserved PO destinations if needed, for example `webapp/src/components/procurement-officer/ProcurementOfficerRoutePlaceholder.tsx`.
  - [ ] Stabilize the follow-on route namespace for dashboard CTAs, such as `/po/departments`, `/po/categories`, `/po/items`, `/po/access-codes`, `/po/deadlines`, `/po/requests`, and `/po/consolidation`, using placeholders where the real story has not shipped yet.
  - [ ] Keep CTA language explicit about status, for example `Open departments`, `Categories coming soon`, or `Requests go live in Story 4.10`, instead of implying those workflows are already implemented.
  - [ ] Use the prototype as inspiration for hierarchy and CTA emphasis, but trim it into a more concise production dashboard rather than porting every prototype panel.

- [ ] Task 5: Add deterministic tests for dashboard derivation, route protection, and honest unavailable states (AC: 2, 3, 4, 5, 6, 7, 8, 9, 10, 12)
  - [ ] Add pure tests for fiscal-year derivation, checklist ordering, deadline readiness, and access-code coverage in a new PO dashboard test file such as `webapp/tests/procurement-officer-dashboard.test.ts`.
  - [ ] Add snapshot-builder tests proving the dashboard stays truthful when categories, items, submissions, and requests do not yet have live sources.
  - [ ] Add route/auth regression checks if new `/po/...` subroutes are introduced, ensuring the existing `/po` route guard continues to protect the namespace for Procurement Officers only.
  - [ ] Update `webapp/tests/run-tests.ts` to include the new test suite.

## Dev Notes

### Story Foundation

- Epic 4 defines Story 4.1 as the PO control center for the prep phase, not as the place to prematurely implement all downstream catalog, request-review, or consolidation workflows.
- Sprint status marks this story as `frontend-led`, so the right bias is a strong dashboard contract, truthful states, and clean navigation into later Epic 4 stories.
- The user explicitly wants this story to be concise and to keep the dev agent aligned with the prototype and UX docs. Prefer a focused dashboard that answers `what is configured, what is blocked, what should I do next?` rather than a large operational cockpit.

### Canonical Story Key Note

- The canonical development-status key in `sprint-status.yaml` is `4-1-po-dashboard-onboarding-wizard`.
- The `recommended_execution_sequence` section currently contains a typo-like alias, `4-1-po-dashboard,onboarding-wizard`.
- Use the canonical hyphenated key for the output file, sprint status update, and any future implementation references so downstream agents do not split the story into two names.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/po/page.tsx` currently renders `RoleDashboardPlaceholder` only.
- `webapp/app/(app)/layout.tsx` already provides the authenticated shell, logout flow, and `RoleGuard` enforcement for `/po`.
- `webapp/lib/auth/roles.ts` already treats `/po` as the Procurement Officer canonical home route and protects `/po/...` via segment-aware role matching.
- `webapp/convex/functions/users.ts` already exposes `getAuthContext`, so the dashboard should not create a second role-resolution path.
- `webapp/convex/schema.ts` currently provides these live sources relevant to Story 4.1:
  - `tenants`
  - `tenantUsers`
  - `departments`
  - `departmentAccessCodes`
  - `departmentUserProfiles`
  - `auditLogs`
- The current repo does **not** yet provide live tables/functions for:
  - procurement categories
  - procurement items
  - item/category request queues
  - department plans and submission statuses
  - consolidated plan outputs
  - dedicated `fiscalYears`
- Story 4.1 must therefore be honest about missing sources and must not disguise prototype/demo data as production data.

### Reuse And Anti-Reinvention Guidance

- Reuse the tenant-admin dashboard implementation as the closest in-repo reference for:
  - desktop-required fallback behavior
  - thin route + feature component split
  - typed snapshot builder pattern
  - pure helper modules with deterministic tests
- Reuse shadcn/ui and the local component-ownership model already established in the repo.
- Reuse `lucide-react` for all dashboard iconography; do not introduce Heroicons, Tabler, Font Awesome, or custom SVG packs unless a missing icon is truly blocking.
- Reuse the existing tweakcn Procureline theme already defined in `webapp/app/globals.css`; the story should not trigger theme churn.
- Reuse Convex reactivity with `useQuery`; do not add client polling or dashboard-only REST APIs for the same data.
- Reuse the existing route-guard conventions for `/po/...` if placeholder routes are added.

### Prototype Alignment

- Use `docs/html/Procureline.html` as the visual and interaction inspiration source for the PO role.
- Prototype elements worth borrowing conceptually:
  - role-specific stat-card rhythm
  - current fiscal-year hero/CTA emphasis
  - organization/readiness framing
  - request or review badge placement
  - concise card-based hierarchy
- Prototype elements that should **not** be copied literally in Story 4.1:
  - total budget figures
  - budget utilization percentages
  - system uptime/system-status cards
  - submitted-plans review tables
  - categories manager and item manager internals
  - pending request counts or lists
  - previous-cycle figures
- The right implementation move is to adapt the prototype's visual language into a leaner production dashboard shaped by the real schema and current story scope.

### UX And Interaction Requirements

- Follow the UX specification's Procureline Green tweakcn theme and bento-box dashboard direction.
- Use shadcn/ui + Tailwind for layout and interaction primitives.
- Use `lucide-react` for iconography so the implementation stays consistent with the rest of the repo.
- Keep the PO dashboard concise. The first screen should be scannable in a few seconds and prioritize:
  - setup warnings
  - onboarding checklist
  - readiness metrics
  - the next best CTA
- Respect the UX platform strategy:
  - desktop-first
  - desktop-required fallback below the minimum viewport
  - keyboard-focus visibility and WCAG AA-friendly semantics
- Prefer a short bento grid over long management tables in Story 4.1.

### Data Availability And Scope Boundaries

- Safe live signals for this story:
  - tenant identity and status from `tenants`
  - active department counts and submission-window signals from `departments`
  - active access-code coverage from `departmentAccessCodes`
  - DU assignment/coverage from `departmentUserProfiles`
  - tenant-scoped recent activity when useful from `auditLogs`
- Not safely available yet:
  - category totals
  - item totals
  - item/category request queues
  - plan submission totals
  - overdue-submission counts
  - all-departments-submitted success totals
  - budget utilization and compliance aggregates
  - previous-cycle master-plan summaries
- Do not create hard-coded demo arrays, fake percentages, or inferred totals just to make the dashboard feel complete.
- If a panel depends on a later-story source, render a clear unavailable or staged state and keep the CTA honest.

### Recommended Dashboard Composition

- Keep the initial `/po` dashboard to a concise production bento layout, for example:
  - hero card: current prep phase summary + primary CTA
  - setup warnings card: fiscal-year/deadline blockers
  - onboarding checklist card: five required setup steps
  - readiness metrics row: departments, access-code coverage, DU assignments, deadline readiness
  - department readiness card/list: per-department prep status
  - staged future-work card: requests/submissions/consolidation panels with honest upcoming states
- This is intentionally smaller than the prototype because the story should optimize clarity and dev certainty, not prototype parity.

### Technical Requirements

- Add a dedicated snapshot query such as `getProcurementOfficerDashboardSnapshot`.
- Gate it with `requireTenantRole(ctx, ["procurement_officer"])`.
- Use indexed tenant-scoped reads wherever possible.
- Keep the response contract explicit and future-safe. Recommended groups:
  - `hero`
  - `summaryCards`
  - `setupChecklist`
  - `alerts`
  - `departmentReadiness`
  - `fiscalYears`
  - `futurePanels`
  - `meta`
- Model future panels explicitly so later stories can populate them without redesigning the dashboard:
  - `submissionMonitoring`
  - `requestInbox`
  - `consolidation`
- Keep state naming unambiguous: `available`, `empty`, `setup_required`, `coming_soon`, `unavailable`.
- Prefer pure derivation helpers over burying all business rules in React.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`, not only the older architecture summary:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `lucide-react` `^0.577.0`
  - `sonner` `^2.0.7`
  - `date-fns` `^2.30.0`
- Keep secure authorization decisions in Convex near the data source.
- Use App Router page files as thin entry points and keep interactive dashboard logic inside client components only where hooks/browser APIs are needed.
- Do not add `middleware.ts`; the repo uses `proxy.ts`.
- Keep strict TypeScript and path-alias imports.

### Library And Framework Requirements

- Next.js / React
  - Keep `/po` as the canonical dashboard route.
  - Keep page files thin.
  - Follow the repo's current App Router and client-component conventions.
- Convex
  - Use `useQuery` for live reactive dashboard reads.
  - Prefer `withIndex(...)` reads over wide table scans.
  - Do not create a parallel REST endpoint for the same dashboard data.
- UI stack
  - Use shadcn/ui components already in the repo.
  - Use `lucide-react` icons.
  - Use `sonner` if transient user feedback is needed.
  - Use `date-fns` for display formatting if new date helpers are required.
- Do not add charting, analytics, or dashboard-framework dependencies for Story 4.1.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/po/page.tsx`
  - `webapp/tests/run-tests.ts`
- Expected new files (recommended):
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerRoutePlaceholder.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/tests/procurement-officer-dashboard.test.ts`
- Optional reserved placeholder routes if dashboard CTAs need stable destinations now:
  - `webapp/app/(app)/po/departments/page.tsx`
  - `webapp/app/(app)/po/categories/page.tsx`
  - `webapp/app/(app)/po/items/page.tsx`
  - `webapp/app/(app)/po/access-codes/page.tsx`
  - `webapp/app/(app)/po/deadlines/page.tsx`
  - `webapp/app/(app)/po/requests/page.tsx`
  - `webapp/app/(app)/po/consolidation/page.tsx`

### Testing Requirements

- Add pure helper tests for:
  - Kenya fiscal-year derivation
  - checklist step ordering and priority
  - access-code coverage calculations
  - safe shared-deadline detection
  - honest unavailable-state derivation for later-story panels
- Add snapshot-builder tests for:
  - active department counts
  - active access-code counts
  - DU assignment coverage
  - missing fiscal-year/deadline warnings
  - no-departments empty state
  - no-fake-data behavior for categories/items/submissions/requests
- Add RBAC tests if new `/po/...` routes are introduced so those subroutes remain protected for Procurement Officers only.

### Git Intelligence Summary

- Commit `82818b1` implemented the tenant-admin dashboard with a typed snapshot contract, desktop fallback, and deterministic tests. Story 4.1 should reuse that architectural pattern rather than inventing a second dashboard style from scratch.
- The current `/po` route is still a placeholder, which makes Story 4.1 the first true Procurement Officer workspace surface in this repo.
- The role-routing and auth work already landed, so Story 4.1 should build on the existing protected-app conventions instead of changing route ownership.

### Latest Tech Information

- Verified on March 17, 2026 against official docs and the live repo:
  - Next.js App Router guidance still supports thin route files and recommends keeping authorization checks close to the data source, which aligns with Convex role guards for the PO dashboard.
  - Convex React docs still position `useQuery` as the reactive client primitive for live reads, which fits the dashboard's no-polling requirement.
  - Convex indexing docs still recommend indexed reads for predictable query performance, so the snapshot query should use tenant-scoped indexes where available.
  - shadcn/ui docs still emphasize local, composable components rather than a monolithic UI framework, which matches this repo's setup.
  - Lucide React docs still support importing icons as React components, which fits the project's current icon usage and tree-shakeable component model.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - shadcn/ui + Tailwind styling
  - `sonner` for user feedback
  - tenant scoping in every backend read
- Where planning docs conflict with the current repo layout, prefer the live repo:
  - actual routes are under `webapp/app/(app)/...`
  - actual backend modules are under `webapp/convex/...`

### References

- [Sprint Status](./sprint-status.yaml)
- [Epic 4 Source](./epics/epic4/epic-04-po-department-catalog.md)
- [Project Context](../project-context.md)
- [PRD](../planning-artifacts/prd.md)
- [Architecture](../planning-artifacts/architecture.md)
- [UX Design](../planning-artifacts/ux-design-specification.md)
- [PO Prototype](../../docs/html/Procureline.html)
- [Current PO Route](../../webapp/app/(app)/po/page.tsx)
- [Current Protected App Layout](../../webapp/app/(app)/layout.tsx)
- [Current Role Mapping Helpers](../../webapp/lib/auth/roles.ts)
- [Current Auth Context Query](../../webapp/convex/functions/users.ts)
- [Current Role Guard](../../webapp/convex/functions/_roleGuard.ts)
- [Current Convex Schema](../../webapp/convex/schema.ts)
- [Tenant Admin Dashboard Reference](../../webapp/src/components/tenant-admin/TenantAdminDashboard.tsx)
- [Tenant Admin Snapshot Builder Reference](../../webapp/lib/tenant-admin/dashboard-snapshot.ts)
- [Current Package Versions](../../webapp/package.json)
- [Next.js App Docs](https://nextjs.org/docs/app)
- [Next.js Authentication Docs](https://nextjs.org/docs/app/building-your-application/authentication)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Convex Indexing Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [shadcn/ui Docs](https://ui.shadcn.com/docs)
- [Lucide React Docs](https://lucide.dev/guide/packages/lucide-react)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic source: `_bmad-output/implementation-artifacts/epics/epic4/epic-04-po-department-catalog.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `docs/html/Procureline.html`
  - `webapp/package.json`
  - `webapp/app/globals.css`
  - `webapp/app/(app)/po/page.tsx`
  - `webapp/app/(app)/layout.tsx`
  - `webapp/src/components/auth/RoleDashboardPlaceholder.tsx`
  - `webapp/src/components/tenant-admin/TenantAdminDashboard.tsx`
  - `webapp/src/components/tenant-admin/TenantAdminRoutePlaceholder.tsx`
  - `webapp/lib/tenant-admin/dashboard-snapshot.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/tenantAdminDashboard.ts`
  - `webapp/convex/schema.ts`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/tenant-admin-dashboard.test.ts`
  - `webapp/tests/run-tests.ts`
- Git context:
  - `git log -5 --oneline`
- External validation sources:
  - `https://nextjs.org/docs/app`
  - `https://nextjs.org/docs/app/building-your-application/authentication`
  - `https://docs.convex.dev/client/react`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://ui.shadcn.com/docs`
  - `https://lucide.dev/guide/packages/lucide-react`

### Completion Notes List

- 2026-03-17: Created the implementation-ready story artifact for `4-1-po-dashboard-onboarding-wizard`.
- 2026-03-17: Anchored the story to the current `/po` placeholder route, the protected app shell, existing Convex tenant-role guards, and the actual schema already present in the repo.
- 2026-03-17: Explicitly instructed the implementing dev to use the existing Procureline tweakcn theme plus shadcn/ui and `lucide-react`.
- 2026-03-17: Scoped the dashboard to a concise prep-phase control center and documented which prototype sections should inspire the UI versus which ones must not be copied because the live data does not exist yet.
- 2026-03-17: Documented the canonical story key mismatch so downstream work uses `4-1-po-dashboard-onboarding-wizard` instead of the comma typo found in the recommended execution sequence.

### File List

- `_bmad-output/implementation-artifacts/4-1-po-dashboard-onboarding-wizard.md`

