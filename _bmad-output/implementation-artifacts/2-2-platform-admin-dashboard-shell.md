# Story 2.2: Platform Admin Dashboard Shell

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Platform Admin,
I want the `docs/html/admin-platform.html` dashboard shell reproduced inside the protected webapp with live data only,
so that I can monitor platform health, tenant state, and urgent issues from one trustworthy workspace.

## Acceptance Criteria

1. [Given] a Platform Admin signs in successfully through the existing protected flow [When] they open `/platform-admin` [Then] the current placeholder page is replaced with a real dashboard shell that mirrors the `docs/html/admin-platform.html` platform-admin information architecture one-to-one: left sidebar, dashboard landing view, top stat row, recent-tenants panel, system-health panel, and recent-activity or recent-alerts panel [And] the implementation uses the existing Procureline app shell, shadcn/ui primitives, Tailwind tokens, and `lucide-react` instead of prototype DOM, inline JS, or a dashboard library.
2. [Given] the Platform Admin dashboard renders on a viewport below the desktop threshold [When] the route loads [Then] it shows a desktop-required state aligned with the UX specification's desktop-only strategy instead of a degraded mobile dashboard.
3. [Given] the user requested a 1-to-1 carryover from `docs/html/admin-platform.html` [When] the production dashboard is implemented [Then] the sidebar keeps the prototype section order and labels exactly: `Overview`, `Tenant Management`, `User Management`, `Platform`, `Support`; with nav items `Dashboard`, `All Tenants`, `Subscriptions`, `Tenant Admins`, `Analytics`, `System Health`, `Audit Logs`, and `Error Monitor` [And] those destinations resolve to stable `/platform-admin/...` routes or placeholders rather than dead buttons or inline prototype view switching.
4. [Given] Story 2.2 is a dashboard-shell story rather than the full Epic 2 implementation [When] a prototype section depends on later stories, such as detailed subscriptions, analytics, support queues, incident handling, or full system-health deep dives [Then] the shell preserves that section's place in the information architecture with an honest placeholder, unavailable state, or reserved route [And] it must not fabricate counts, charts, invoice rows, or error histories from the prototype.
5. [Given] the dashboard renders [When] the shell loads live data [Then] every metric, list row, status pill, and alert must come from the real Convex-backed query layer or an explicit persisted platform snapshot source [And] the implementation must not port any of the prototype's `appData.tenants`, `appData.invoices`, `appData.activityLog`, `appData.errors`, or `appData.revenueData` mock arrays into production code.
6. [Given] the dashboard renders the stat-card row [When] live tenant data is available [Then] the top row preserves the prototype's four-card rhythm while using truthful platform signals: total tenants, active or attention state, revenue or subscription summary, and urgent issue summary [And] any card whose live source is not yet available must render an explicit `unavailable`, `awaiting source`, or `empty` state rather than a believable fake number.
7. [Given] the dashboard needs tenant-overview metrics [When] the snapshot query runs [Then] it derives tenant counts from live `tenants` records and surfaces tier or status breakdowns needed by FR8 and FR-PA2b, including Free, Starter, Professional, Enterprise, suspended, and cancelled or churned states [And] it must not invent prototype-only statuses such as `trial` or `inactive` if those values are not part of the live schema.
8. [Given] the dashboard needs revenue signals [When] live pricing or subscription data exists [Then] the shell computes MRR and ARR only from truthful platform sources such as `subscriptionTiers`, active tenant tier assignments, and any persisted subscription status records that actually exist in the repo at implementation time [And] suspended or cancelled tenants must not contribute to recurring-revenue totals unless a live persisted billing-status source explicitly marks them billable [And] Free-to-paid conversion is shown only if it can be derived from auditable live upgrade or lifecycle events [And] when those sources do not exist yet the card shows an explicit unavailable state rather than an inferred conversion percentage.
9. [Given] the dashboard needs the `Recent Tenants` panel from the prototype [When] the snapshot query runs [Then] the panel shows the latest live tenants with truthful joined-at timestamps, tier, status, and safe supporting counts such as departments or active users only where those values can be queried from the live schema [And] rows must reset to empty state when the platform has no tenants instead of keeping stale or seeded demo institutions visible.
10. [Given] the dashboard needs the `System Health` panel from the prototype [When] live platform-health signals are available from persisted health snapshots or other trustworthy platform sources [Then] the panel shows API, database, jobs, storage, and related services with healthy, warning, or critical states [And] if the latest snapshot is stale, incomplete, or missing individual service fields the affected tiles render `stale`, `partial`, or `unavailable` states instead of defaulting to green [And] if no live health source exists yet the panel keeps the exact tile structure from the prototype but renders `awaiting first health snapshot` or equivalent unavailable states instead of hard-coded all-green badges.
11. [Given] the dashboard needs recent alerts and monitoring signals [When] alertable events exist in live data sources such as `auditLogs`, `tenantIsolationEvents`, `externalServiceSyncEvents`, tenant status changes, or a dedicated platform-alert source added in this story [Then] the dashboard surfaces recent alerts with severity indicators and filtering support in the shell [And] it does not copy the prototype's seeded error list or activity feed verbatim.
12. [Given] a critical issue occurs such as failed external syncs, tenant-isolation violations, or a health-snapshot outage [When] the platform detects it through a real persisted signal [Then] the dashboard surfaces that issue in the recent-alerts area and the implementation leaves a clear extension point for the later SMS or email dispatch story without faking message delivery in Story 2.2.
13. [Given] the dashboard shows timestamps [When] any event, tenant join date, or health-snapshot timestamp is displayed [Then] the primary visible timestamp is rendered in UTC and the UI exposes the viewer's local-time equivalent in a hover tooltip or equivalent accessible affordance, satisfying FR-PA2h without relying on browser-locale-only formatting.
14. [Given] a Platform Admin customizes the dashboard shell [When] they collapse the sidebar, change severity filters, or reorder or hide dashboard widgets supported by Story 2.2 [Then] those preferences are persisted for future sessions through a real stored preference record associated with the current Platform Admin user [And] corrupted or outdated saved preferences fall back safely to the default layout instead of breaking the dashboard.
15. [Given] `/platform-admin` is the only dashboard route currently implemented for the role [When] the Platform Admin navigates through the sidebar [Then] later-story destinations such as `/platform-admin/tenants`, `/platform-admin/subscriptions`, `/platform-admin/tenant-admins`, `/platform-admin/analytics`, `/platform-admin/health`, `/platform-admin/audit-logs`, and `/platform-admin/errors` are protected by the existing role-routing system and can render truthful placeholders until their dedicated stories land.
16. [Given] platform data changes while the user remains on `/platform-admin` [When] Convex query results update [Then] the dashboard refreshes reactively through `useQuery` and does not rely on manual polling, browser refreshes, or duplicate REST fetches for the same shell snapshot.
17. [Given] the snapshot query needs cross-tenant visibility [When] it reads tenant-owned records from a platform context [Then] it uses explicit Platform Admin guard paths and audited bypass helpers where required [And] it must not reuse tenant-only helper paths that intentionally reject platform-scope access.
18. [Given] the dashboard has no live tenants, no active alerts, no seeded subscription tiers, no saved preferences, or no health snapshots yet [When] the shell loads [Then] each corresponding panel renders a specific empty or unavailable state and the page remains structurally complete instead of crashing, rendering `NaN`, or backfilling placeholder demo values.

## Tasks / Subtasks

- [ ] Task 1: Replace the `/platform-admin` placeholder with a real platform-admin dashboard shell that mirrors `docs/html/admin-platform.html` one-to-one in structure (AC: 1, 2, 3, 4, 15)
  - [ ] Keep `webapp/app/(app)/platform-admin/page.tsx` thin and move the interactive dashboard into a dedicated feature component such as `webapp/src/components/platform-admin/PlatformAdminDashboard.tsx`.
  - [ ] Reuse the existing protected app shell in `webapp/app/(app)/layout.tsx` and the existing role-guard behavior instead of creating a second platform-admin layout or copying the prototype login screen.
  - [ ] Recreate the prototype shell in the protected app: left sidebar with the same section order and labels, default dashboard landing state, header with the primary `Add Tenant` action, top four stat cards, `Recent Tenants`, `System Health`, and the final alerts or activity panel.
  - [ ] Add a desktop-required fallback aligned with the UX specification's desktop-only guidance and the dashboard patterns already used for tenant-admin and procurement-officer workspaces.

- [ ] Task 2: Create a Platform Admin dashboard snapshot contract backed by real data only (AC: 5, 6, 7, 8, 9, 10, 11, 16, 17, 18)
  - [ ] Add a focused Convex query module such as `webapp/convex/functions/platformAdminDashboard.ts` instead of overloading `users.ts`, `tenants.ts`, or tenant-admin modules.
  - [ ] Guard the query with `requirePlatformAdmin(ctx)` so only Platform Admins can load the snapshot.
  - [ ] Aggregate only from truthful live platform sources already in the schema or explicitly added as minimal support for this story, especially `tenants`, `tenantUsers`, `departments`, `subscriptionTiers`, `auditLogs`, `tenantIsolationEvents`, `externalServiceSyncEvents`, and any new `platformAdminPreferences` or `platformHealthSnapshots` structures introduced here.
  - [ ] Shape the response so later Epic 2 stories can deepen the same shell without redesigning `/platform-admin`, for example top-level groups such as `navigation`, `summaryCards`, `recentTenants`, `healthSummary`, `alerts`, `quickActions`, `preferences`, and `meta`.
  - [ ] Explicitly model `available`, `empty`, `awaiting_source`, `setup_required`, `warning`, `critical`, and `unavailable` style states so the shell never turns missing backend sources into believable business metrics.
  - [ ] Normalize alert inputs into one dashboard-friendly structure rather than stitching prototype-only error arrays into the client.

- [ ] Task 3: Add the minimal supporting platform data structures required for a DB-driven shell without pre-implementing later stories (AC: 5, 8, 10, 11, 12, 14, 18)
  - [ ] Add a small persisted preference source such as `platformAdminPreferences` keyed by `userId` for sidebar collapse state, widget layout, and alert-severity filter persistence.
  - [ ] If no truthful health source exists yet, add a minimal persisted snapshot source such as `platformHealthSnapshots` or an equivalent table with the latest API, DB, jobs, storage, and service-state summary so the dashboard can remain DB-driven without hard-coded health tiles.
  - [ ] Define a freshness rule for health snapshots and partial-service fallback behavior so stale or incomplete health records do not present as healthy.
  - [ ] Keep any new schema additions narrowly scoped to shell support; do not prematurely add full billing, incident, ticket, feature-flag, or analytics subsystems that belong to later stories.
  - [ ] Ensure stored preferences and health snapshots fail closed when records are absent or malformed, falling back to the default layout or explicit unavailable panel states.

- [ ] Task 4: Reproduce the prototype navigation and reserved-route contracts without shipping unfinished downstream features (AC: 3, 4, 15)
  - [ ] Add a small placeholder pattern such as `webapp/src/components/platform-admin/PlatformAdminRoutePlaceholder.tsx` for reserved platform-admin destinations that are not yet implemented.
  - [ ] Stabilize the route namespace for the prototype nav items using protected `/platform-admin/...` paths, for example `/platform-admin/tenants`, `/platform-admin/subscriptions`, `/platform-admin/tenant-admins`, `/platform-admin/analytics`, `/platform-admin/health`, `/platform-admin/audit-logs`, and `/platform-admin/errors`.
  - [ ] Keep CTA language explicit about state, such as `Coming soon`, `Awaiting live source`, or `Reserved for Story 2.x`, instead of implying that later Epic 2 features are already done.
  - [ ] Preserve the prototype's nav order and labels so the production shell feels recognizably the same, even when downstream views still render placeholders.

- [ ] Task 5: Implement timestamp, formatting, and preference behavior in pure helper modules so the shell stays deterministic (AC: 8, 11, 13, 14, 18)
  - [ ] Add a helper module such as `webapp/lib/platform-admin/dashboard.ts` for UTC/local timestamp presentation, severity filtering, default widget order, invalid-preference fallback, health-snapshot freshness, and any revenue-display helpers needed for the stat cards.
  - [ ] Add a snapshot builder such as `webapp/lib/platform-admin/dashboard-snapshot.ts` for alert normalization, summary-card derivation, recent-tenant shaping, revenue exclusions for non-billable tenants, and health-panel state mapping so business rules are testable outside React.
  - [ ] Reuse existing marketing-pricing helpers where appropriate for annual and monthly-equivalent formatting rather than inventing a second pricing-conversion system inside the platform dashboard.
  - [ ] Keep shell-only rules pure and deterministic so tests can prove the dashboard does not leak mock data or stale preference state.

- [ ] Task 6: Add deterministic tests for Platform Admin dashboard state derivation, route protection, and no-mock-data behavior (AC: 2, 5, 6, 8, 10, 11, 13, 14, 15, 16, 17, 18)
  - [ ] Add pure helper tests for UTC timestamp formatting plus local tooltip presentation, alert severity filtering, revenue-card fallback behavior, invalid preference fallback, and empty-state derivation in a file such as `webapp/tests/platform-admin-dashboard.test.ts`.
  - [ ] Add snapshot-builder tests proving the dashboard remains truthful when there are no tenants, no subscription tiers, no health snapshots, no alerts, or no saved preferences.
  - [ ] Add route or RBAC regression coverage if new `/platform-admin/...` subroutes are introduced so the existing role map continues to protect the namespace for `platform_admin` only.
  - [ ] Add tests proving cross-tenant data is obtained only through the proper platform-admin guard or bypass path and that tenant-only helper paths are not used for platform-shell reads.
  - [ ] Update `webapp/tests/run-tests.ts` to include the new dashboard test suite.

## Dev Notes

### Story Foundation

- Epic 2 positions Story 2.2 as the shell for the entire Platform Admin workspace: protected layout, navigation, widget containers, and initial real-time hooks that later Epic 2 stories will plug into.
- The user gave an additional hard requirement beyond the epic text: the production shell should map one-to-one to `docs/html/admin-platform.html`, but with no prototype mock data and no fake seeded business values.
- This means prototype parity is a hard requirement for information architecture, layout rhythm, panel order, and labels, while prototype login flows, inline JavaScript navigation, and demo datasets are explicitly out of bounds.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/platform-admin/page.tsx` currently renders `RoleDashboardPlaceholder` only.
- `webapp/app/(app)/layout.tsx` already provides the authenticated shell, logout flow, and `RoleGuard` enforcement for protected role routes.
- `webapp/lib/auth/roles.ts` already treats `/platform-admin` as the canonical home route for Platform Admins and protects `/platform-admin/...` through segment-aware matching.
- `webapp/convex/functions/_roleGuard.ts` already provides `requirePlatformAdmin(ctx)` and separates platform scope from tenant scope.
- `webapp/convex/functions/_tenantGuard.ts` already enforces an important rule: platform-wide cross-tenant reads must use an explicit audited bypass path when reading tenant-owned records from platform scope.
- `webapp/convex/schema.ts` currently provides these live platform-relevant tables:
  - `tenants`
  - `tenantUsers`
  - `departments`
  - `platformUsers`
  - `sessionMetadata`
  - `subscriptionTiers`
  - `tenantIsolationEvents`
  - `auditLogs`
  - `externalServiceSyncEvents`
- The current repo does **not** yet provide a complete live source for several prototype/dashboard concepts:
  - full subscription billing history
  - invoice rows
  - overdue payment ledger
  - persisted platform alert preferences
  - persisted platform health snapshots
  - infrastructure CPU/RAM/storage telemetry
  - ticket or incident queues
- Story 2.2 must therefore either add only the minimal shell-supporting structures needed for a truthful DB-driven dashboard or render an explicit unavailable state without inventing data.

### Prototype Analysis: How `admin-platform.html` Builds the Platform Admin Shell

- The prototype starts with a standalone login screen, then swaps to an app container with a fixed left sidebar and a dashboard landing page.
- The sidebar uses this exact section order and label set:
  - `Overview` → `Dashboard`
  - `Tenant Management` → `All Tenants`, `Subscriptions`
  - `User Management` → `Tenant Admins`
  - `Platform` → `Analytics`, `System Health`
  - `Support` → `Audit Logs`, `Error Monitor`
- The default dashboard view contains:
  - a page header with `Platform Dashboard` title and `Add Tenant` primary CTA
  - a four-card stat row
  - a two-column middle row with `Recent Tenants` on the left and `System Health` on the right
  - a full-width bottom panel for recent platform activity
- The prototype also contains separate views for tenants, subscriptions, tenant admins, analytics, system health, audit logs, and errors. Story 2.2 should preserve those destinations in the route map or placeholders, but not implement all of their final behavior now.
- The prototype's JavaScript drives the entire UI from mock data:
  - `appData.tenants`
  - `appData.invoices`
  - `appData.activityLog`
  - `appData.errors`
  - `appData.revenueData`
- None of those arrays are production data sources. They must be treated as prototype reference only.

### ASCII Wireframe: Required Platform Admin Dashboard Layout

```text
LEGEND
- Box positions, nav order, panel names, CTA placement, and relative emphasis are REQUIRED shell structure.
- Specific numbers and statuses shown below are SAMPLE CONTENT only unless another acceptance criterion requires a real value.
- Dynamic business data must come from live app state or explicit persisted platform snapshots, never from this ASCII block.
```

```text
+----------------------------------------------------------------------------------------------------------------------+
| Procureline Workspace                                                                                   [Log out]    |
+----------------------------------------------------------------------------------------------------------------------+
| +------------------------------------+ +--------------------------------------------------------------------------+ |
| | Procureline                        | | Platform Dashboard                                     [ + Add Tenant ]  | |
| | Platform Admin                     | | Overview of all tenants and platform metrics                            | |
| |                                    | +--------------------+ +--------------------+ +--------------------+      | |
| | OVERVIEW                           | | TOTAL TENANTS      | | ACTIVE / ATTENTION | | REVENUE SUMMARY    |      | |
| | > Dashboard                        | | 00                 | | 00                 | | MRR / ARR / --     |      | |
| |                                    | | helper / trend     | | helper / trend     | | helper / trend     |      | |
| | TENANT MANAGEMENT                  | +--------------------+ +--------------------+ +--------------------+      | |
| |   All Tenants                      | +--------------------+                                                     | |
| |   Subscriptions                    | | ALERT / ISSUE SUMM |                                                     | |
| |                                    | | 00 / status        |                                                     | |
| | USER MANAGEMENT                    | | helper / trend     |                                                     | |
| |   Tenant Admins                    | +--------------------+                                                     | |
| |                                    |                                                                              | |
| | PLATFORM                           | +---------------------------------------------------+ +------------------+ | |
| |   Analytics                        | | RECENT TENANTS                                    | | SYSTEM HEALTH    | | |
| |   System Health                    | | Institution | Plan | Status | Departments | Joined| | API      [pill] | | |
| |                                    | | row                                               | | DB       [pill] | | |
| | SUPPORT                            | | row                                               | | Jobs     [pill] | | |
| |   Audit Logs                       | | row                                               | | Storage  [pill] | | |
| |   Error Monitor                    | | row                                               | | Email    [pill] | | |
| |                                    | |                             [ View All ]           | | [View Health]   | | |
| | [PA avatar] Platform Admin         | +---------------------------------------------------+ +------------------+ | |
| | Super Administrator                |                                                                              | |
| +------------------------------------+ +--------------------------------------------------------------------------+ |
|                                        | RECENT ALERTS / RECENT ACTIVITY                                          | |
|                                        | severity pill | title | summary | UTC timestamp (local tooltip)          | |
|                                        | severity pill | title | summary | UTC timestamp (local tooltip)          | |
|                                        | severity pill | title | summary | UTC timestamp (local tooltip)          | |
|                                        |                                                     [ View All Logs ]      | |
|                                        +--------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------------------------+
```

### Prototype Behaviors To Keep vs. Prototype Shortcuts To Correct

- Keep these prototype behaviors:
  - fixed platform-admin sidebar with the same nav group order
  - dashboard as the default landing view
  - top-level stat row with four cards
  - `Recent Tenants` table placement and hierarchy
  - `System Health` tile grid placement and compact scan-first layout
  - a final alerts or activity panel spanning the full width
  - a prominent `Add Tenant` action in the dashboard header
- Correct these prototype shortcuts in production:
  - do not port the prototype login screen because Story 2.1 owns authentication
  - do not port the inline `onclick` view switching; adapt the nav into the real `/platform-admin/...` route structure
  - do not carry over `trial`, `inactive`, `paymentStatus`, invoice, or revenue arrays unless the live schema genuinely supports them
  - do not hard-code green health badges or seeded error rows
  - do not use `alert()` or any prototype-only imperative browser UX
  - do not let mock tenant usage, invoice data, or revenue trend bars slip into the production shell

### Reuse And Anti-Reinvention Guidance

- Reuse the tenant-admin and procurement-officer dashboard implementation patterns already in the repo:
  - thin App Router page
  - dedicated feature component
  - pure helper modules
  - typed snapshot builder
  - deterministic Node-based tests
  - desktop-required fallback
- Reuse the existing protected app shell in `webapp/app/(app)/layout.tsx`; do not create a second platform-admin shell outside the authenticated app.
- Reuse `requirePlatformAdmin(ctx)` for access control.
- Reuse the explicit audited bypass pattern in `webapp/convex/functions/_tenantGuard.ts` whenever the dashboard needs tenant-owned records from a platform context.
- Reuse `subscriptionTiers` plus existing pricing helpers in `webapp/lib/marketing/pricing.ts` for annual and monthly-equivalent display logic where those values are truthful.
- Reuse shadcn/ui and `lucide-react`; do not introduce a charting or dashboard framework for Story 2.2.
- Reuse the placeholder-route pattern already established by tenant-admin and PO dashboards for future views that are not implemented yet.

### Data Availability And Scope Boundaries

- Safe live platform signals available now:
  - tenant roster and tier/status from `tenants`
  - cross-tenant user counts from `tenantUsers`
  - safe department counts through `departments`
  - tier pricing catalog from `subscriptionTiers`
  - audit or anomaly signals from `auditLogs`, `tenantIsolationEvents`, and `externalServiceSyncEvents`
  - platform-user membership from `platformUsers`
- Not safely available yet in the live repo:
  - real invoice history
  - bank-transfer verification queue
  - true overdue payment balances
  - storage-usage bytes per tenant
  - infrastructure CPU and memory telemetry
  - background-job dashboards
  - support tickets and incidents
  - feature-flag analytics
- Story 2.2 should therefore:
  - compute only what the current schema can truthfully support,
  - add only minimal shell-supporting data structures when necessary, and
  - keep the rest of the prototype visually present but explicitly unavailable or empty.
- The shell must never fabricate:
  - invoice rows
  - payment-overdue counts
  - storage percentages
  - conversion rates
  - fake alerts
  - fake tenant activity

### Recommended Platform Dashboard Snapshot Shape

- Recommended top-level response groups:
  - `navigation`
  - `summaryCards`
  - `recentTenants`
  - `healthSummary`
  - `alerts`
  - `quickActions`
  - `preferences`
  - `meta`
- Recommended state vocabulary:
  - `available`
  - `empty`
  - `awaiting_source`
  - `setup_required`
  - `unavailable`
  - `warning`
  - `critical`
- Keep the snapshot contract explicit enough that later stories can populate:
  - subscriptions and billing
  - cross-tenant user management
  - free-tier monitoring
  - system health monitoring
  - security dashboard
  - support tickets
  - feature flags

### Minimal Schema Guidance

- If a persisted preference source is needed, prefer a small table such as:
  - `platformAdminPreferences`
  - fields: `userId`, `sidebarCollapsed`, `widgetOrder`, `hiddenWidgetIds`, `alertSeverityFilter`, `updatedAt`
- If no truthful health source already exists, prefer a narrow shell-supporting table such as:
  - `platformHealthSnapshots`
  - fields: `capturedAt`, `api`, `database`, `jobs`, `storage`, `email`, optional `summaryState`
- Do **not** introduce full billing, ticketing, or analytics schemas just to make Story 2.2 look complete.
- Any new persisted source added in Story 2.2 must serve the shell directly and remain forward-compatible with the deeper Epic 2 stories.

### UX And Interaction Requirements

- Follow the UX specification's bento-box dashboard direction and desktop-only platform strategy.
- Keep the dashboard scannable in a few seconds:
  - urgent summary cards first
  - recent tenants and health next
  - alerts or activity last
- Preserve the prototype's clean operational feel while adapting it to the real authenticated shell.
- Timestamps should read as operationally trustworthy:
  - UTC visible in the main UI
  - local-time tooltip on hover/focus
- Sidebar collapse and widget personalization should feel supportive, but never hide all critical operational cards by default.
- Keep accessible focus states, tooltips, and button semantics intact.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`, not only the older planning summaries:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `lucide-react` `^0.577.0`
  - `date-fns` `^2.30.0`
  - `sonner` `^2.0.7`
- Keep authorization decisions close to the data source in Convex.
- Keep page files thin and move interactive behavior into client components only where hooks or browser storage are required.
- Do not add `middleware.ts`; the repo uses `proxy.ts`.
- Keep strict TypeScript and path-alias imports.

### Library And Framework Requirements

- Next.js / React
  - Keep `/platform-admin` as the canonical Platform Admin route.
  - Follow the repo's thin-route pattern already used by the other role dashboards.
  - Use client components only where `useQuery`, local layout state, or browser storage is needed.
- Convex
  - Use `useQuery` for live reactive dashboard reads.
  - Prefer `withIndex(...)` reads or explicit targeted queries over broad scans.
  - Do not build a parallel REST dashboard endpoint for the same shell data.
- UI stack
  - Use shadcn/ui primitives already in the repo.
  - Use `lucide-react` for iconography.
  - Use `date-fns` and browser `Intl` helpers for timestamp presentation where needed.
  - Use `sonner` only if transient user feedback is required.
- Avoid charting dependencies for Story 2.2; the initial shell does not need a chart library.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/platform-admin/page.tsx`
  - `webapp/tests/run-tests.ts`
  - `webapp/convex/schema.ts` only if the minimal preference or health-snapshot sources are genuinely required
- Expected new files (recommended):
  - `webapp/src/components/platform-admin/PlatformAdminDashboard.tsx`
  - `webapp/src/components/platform-admin/PlatformAdminRoutePlaceholder.tsx`
  - `webapp/lib/platform-admin/dashboard.ts`
  - `webapp/lib/platform-admin/dashboard-snapshot.ts`
  - `webapp/convex/functions/platformAdminDashboard.ts`
  - `webapp/tests/platform-admin-dashboard.test.ts`
- Optional reserved follow-on routes if the prototype nav needs stable destinations now:
  - `webapp/app/(app)/platform-admin/tenants/page.tsx`
  - `webapp/app/(app)/platform-admin/subscriptions/page.tsx`
  - `webapp/app/(app)/platform-admin/tenant-admins/page.tsx`
  - `webapp/app/(app)/platform-admin/analytics/page.tsx`
  - `webapp/app/(app)/platform-admin/health/page.tsx`
  - `webapp/app/(app)/platform-admin/audit-logs/page.tsx`
  - `webapp/app/(app)/platform-admin/errors/page.tsx`

### Testing Requirements

- Add pure helper tests for:
  - UTC timestamp formatting plus local tooltip presentation
  - alert severity filtering
  - revenue-card fallback behavior when tiers or billing signals are missing
  - invalid preference fallback to default widget order
  - empty-state derivation for no tenants, no alerts, and no health source
- Add snapshot-builder tests for:
  - tenant counts by tier and status
  - recent-tenants ordering
  - active-user counting across tenants
  - MRR and ARR only when truthful pricing inputs exist
  - non-billable suspended or cancelled tenants excluded from recurring-revenue totals unless an explicit live source says otherwise
  - conversion-rate suppression when no auditable upgrade history exists
  - health-tile unavailable states when no snapshot source exists
  - stale or partial health snapshots never render all services as healthy
  - alert normalization and deduplication across audit and external-service sources
- Add route or RBAC regression tests for:
  - Platform Admin access to `/platform-admin`
  - non-platform roles redirect away from `/platform-admin/...`
  - reserved `/platform-admin/...` destinations remain protected by the centralized role map
- Add tests proving the dashboard query uses platform-admin-safe access patterns and does not rely on tenant-only helpers for cross-tenant reads.

### Git Intelligence Summary

- Commit `190a1b1` on March 17, 2026 delivered the tenant-admin dashboard shell, including route placeholders, a typed snapshot builder, and deterministic dashboard tests. Story 2.2 should reuse that pattern rather than inventing a new dashboard architecture.
- Commit `8e95f1a` on March 19, 2026 delivered the procurement-officer dashboard shell with dedicated helper modules, placeholder routes, and a focused Convex query. This is the closest pattern for how the platform-admin shell should be decomposed.
- The current `/platform-admin` route is still a placeholder, which makes Story 2.2 the first true platform-admin application surface in the live repo.

### Latest Tech Information

- Verified on March 22, 2026 against official documentation and the live repo:
  - Next.js App Router guidance continues to fit the repo's thin route-file pattern for protected pages.
  - Next.js authentication guidance still favors keeping authorization close to the data source, which supports using Convex guards for Platform Admin dashboard reads.
  - Convex React documentation continues to position `useQuery` as the reactive client primitive for live reads, which aligns with the shell's no-polling requirement.
  - Convex indexing guidance still recommends targeted indexed reads for predictable dashboard queries.
  - shadcn/ui documentation continues to favor local, composable component ownership over a monolithic component-library dependency, which matches the current repo.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - shadcn/ui + Tailwind styling
  - `sonner` for user feedback
  - no `alert()` or prototype-only browser feedback
- Where planning docs conflict with the current repo layout, prefer the live repo:
  - routes live under `webapp/app/(app)/...`
  - backend modules live under `webapp/convex/...`

### References

- [Sprint Status](./sprint-status.yaml)
- [Epic 2 Source](./epics/epic2/epic-02-platform-administration.md)
- [Project Context](../project-context.md)
- [PRD](../planning-artifacts/prd.md)
- [Architecture](../planning-artifacts/architecture.md)
- [UX Design](../planning-artifacts/ux-design-specification.md)
- [Platform Admin Prototype](../../docs/html/admin-platform.html)
- [Current Platform Admin Route](../../webapp/app/(app)/platform-admin/page.tsx)
- [Current Protected App Layout](../../webapp/app/(app)/layout.tsx)
- [Current Role Mapping Helpers](../../webapp/lib/auth/roles.ts)
- [Current Role Guard](../../webapp/convex/functions/_roleGuard.ts)
- [Current Tenant Guard](../../webapp/convex/functions/_tenantGuard.ts)
- [Current Tenant Functions](../../webapp/convex/functions/tenants.ts)
- [Current Convex Schema](../../webapp/convex/schema.ts)
- [Tenant Admin Dashboard Reference](../../webapp/src/components/tenant-admin/TenantAdminDashboard.tsx)
- [Tenant Admin Snapshot Builder Reference](../../webapp/lib/tenant-admin/dashboard-snapshot.ts)
- [Procurement Officer Dashboard Reference](../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [Procurement Officer Snapshot Builder Reference](../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
- [Current Pricing Helpers](../../webapp/lib/marketing/pricing.ts)
- [Current Package Versions](../../webapp/package.json)
- [Next.js App Docs](https://nextjs.org/docs/app)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Convex Indexing Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [shadcn/ui Docs](https://ui.shadcn.com/docs)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Edge-case review task: `_bmad/core/tasks/review-edge-case-hunter.xml`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic source: `_bmad-output/implementation-artifacts/epics/epic2/epic-02-platform-administration.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `docs/html/admin-platform.html`
  - `webapp/package.json`
  - `webapp/app/(app)/platform-admin/page.tsx`
  - `webapp/app/(app)/layout.tsx`
  - `webapp/src/components/auth/RoleDashboardPlaceholder.tsx`
  - `webapp/src/components/tenant-admin/TenantAdminDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/tenant-admin/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/_tenantGuard.ts`
  - `webapp/convex/functions/tenantAdminDashboard.ts`
  - `webapp/convex/functions/tenants.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/seedData.ts`
  - `webapp/lib/marketing/pricing.ts`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/proxy.test.ts`
  - `webapp/tests/tenant-isolation.test.ts`
  - `webapp/tests/run-tests.ts`
- Git context:
  - `git log -5 --pretty=format:"%h %ad %s" --date=short`
  - `git show --stat --summary --format=medium -1 190a1b1`
  - `git show --stat --summary --format=medium -1 8e95f1a`
- External validation sources:
  - `https://nextjs.org/docs/app`
  - `https://nextjs.org/docs/app/guides/authentication`
  - `https://docs.convex.dev/client/react`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://ui.shadcn.com/docs`

### Completion Notes List

- 2026-03-22: Created the implementation-ready story artifact for `2-2-platform-admin-dashboard-shell`.
- 2026-03-22: Anchored the story to the user's explicit requirement that the protected webapp dashboard match `docs/html/admin-platform.html` one-to-one in structure while remaining entirely live-data-driven.
- 2026-03-22: Documented the current platform-admin placeholder route, the repo's existing dashboard implementation patterns, and the platform-scope guard and audited bypass rules the dev agent must follow.
- 2026-03-22: Explicitly separated safe live sources from prototype-only data so the implementing dev does not port mock arrays, seeded demo rows, or fake health metrics into production.
- 2026-03-22: Added an ASCII dashboard wireframe and reserved-route guidance so the dev agent has tight visual and IA guardrails.
- 2026-03-22: Updated sprint tracking so `2-2-platform-admin-dashboard-shell` is `ready-for-dev`.

### File List

- `_bmad-output/implementation-artifacts/2-2-platform-admin-dashboard-shell.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Story Completion Status

- Story ID: `2.2`
- Story Key: `2-2-platform-admin-dashboard-shell`
- Output File: `_bmad-output/implementation-artifacts/2-2-platform-admin-dashboard-shell.md`
- Final Status: `ready-for-dev`
- Completion Note: `Implementation-ready story created for a one-to-one, DB-driven Platform Admin dashboard shell with ASCII layout guardrails`
