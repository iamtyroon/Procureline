# Story 5.1: DU Dashboard & Plan Status

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Departmental User,
I want the same DU dashboard and planning launchpad experience from `docs/html/procurelinedb.html` inside the protected webapp,
so that I can see my department context, understand my plan status, and start or resume planning from one screen.

## Acceptance Criteria

1. [Given] a Departmental User signs in successfully [When] they open `/du` [Then] the current placeholder page is replaced with a real dashboard shell that mirrors the `docs/html/procurelinedb.html` DU information architecture one-to-one: quick-stats row, plan launchpad, annual plans table, efficiency leaderboard, recent announcements, and Procurement Officer support context [And] the implementation uses the existing Procureline tweakcn theme, shadcn/ui primitives, and `lucide-react` rather than prototype-only DOM or a dashboard library.
2. [Given] the DU dashboard renders on a viewport below the desktop threshold [When] the route loads [Then] it shows a desktop-required state consistent with the UX specification instead of a degraded mobile dashboard.
3. [Given] the dashboard loads with live DU context [When] budget data is available for the DU's department [Then] the top-left quick-stat card shows budget utilization, used budget, total budget, and an expandable category breakdown panel [And] the card keeps the prototype's visual rhythm from `procurelinedb.html` rather than collapsing into a generic summary tile (FR38).
4. [Given] the DU dashboard loads [When] a valid submission window exists for the DU's department [Then] the deadline card shows the active fiscal-year submission countdown with the radial gauge treatment from the prototype [And] the card switches to an urgent visual state when the remaining time is 7 days or less [And] the countdown is derived from live submission-window data instead of the prototype's hard-coded `45` day demo value (FR38a).
5. [Given] the DU dashboard loads [When] the department belongs to a future fiscal cycle whose submission window has not opened yet [Then] the deadline card shows a truthful `Submission window has not opened yet.` style state with the upcoming fiscal-year context if available [And] planning CTAs remain disabled until the access mode becomes editable [And] the UI does not present a misleading active countdown.
6. [Given] the dashboard loads [When] the DU has no budget allocated yet [Then] the dashboard shows `No budget allocated. Contact your Procurement Officer.` [And] the launchpad CTA to create a plan is disabled [And] the rest of the dashboard remains visually complete without inventing budget figures (FR38c).
7. [Given] the current submission window has ended or the authenticated DU is in read-only grace mode [When] the dashboard loads [Then] it shows `Submission deadline has passed. Your plan is now read-only.` [And] the launchpad and plan-edit affordances are disabled or downgraded to view-only states [And] the UI does not offer an editable planning path that conflicts with the backend access mode (FR38d).
8. [Given] categories and items have not been configured yet for the DU's tenant [When] the dashboard loads [Then] the launchpad keeps the prototype section and controls visible but shows `Setup in progress. Your Procurement Officer is preparing the catalog.` [And] category selection plus `+ New Plan` are disabled until a truthful catalog source exists (FR38e).
9. [Given] each department can own only one procurement plan per fiscal year [When] the DU dashboard loads for a fiscal year with an existing canonical plan [Then] the quick-stat card, plans table, and launchpad all reflect that single plan [And] the primary CTA shifts to `Resume Plan`, `View Plan`, or an equivalent truthful action instead of offering a second same-year plan path [And] Story 5.1 must not permit or imply duplicate plans for the same department and fiscal year.
10. [Given] the DU has a current plan state [When] the dashboard loads [Then] the second quick-stat card and the plans table show the real plan status using the allowed DU states `No Plan`, `Draft`, `Submitted`, `Rejected`, or `Approved` [And] status badges, item counts, and action affordances match that state [And] `Edit` is only enabled for states that are genuinely editable in the live workflow (FR38b).
11. [Given] the DU's latest plan was rejected [When] the dashboard loads [Then] rejection comments are surfaced prominently on the dashboard with a clear revision-oriented CTA [And] if the DU is still editable the CTA is `Edit Plan` or equivalent [And] if the DU is read-only the CTA downgrades to a truthful non-editing action such as `View Rejection` or `View Plan` rather than inviting an action the backend will reject (FR38f).
12. [Given] the DU has never created a plan before [When] the dashboard loads [Then] the annual plans table and launchpad show a guided first-time empty state with concise instructions and a clear `Start Your Plan` CTA while preserving the prototype's layout and card order (FR38g).
13. [Given] categories are available [When] the DU uses the launchpad [Then] the category pills support select, deselect, select-all, clear-all, per-category item counts, and a running selected-count display just like the prototype [And] the chosen category set is handed off intact to the future Blockly workspace flow instead of being discarded when the DU clicks `+ New Plan`.
14. [Given] the DU clicks `+ New Plan` from the launchpad [When] at least one category is selected and planning is currently allowed [Then] the webapp navigates into the Story 5.2 workspace entry path or reserved handoff contract with the selected categories preserved [And] the DU is not blocked by a dead-end placeholder, browser `alert()`, or demo-only behavior from the HTML prototype.
15. [Given] the lower dashboard panels render [When] leaderboard, announcement, support-contact, or historical-plan sources are not fully live yet in the current repo [Then] those panels remain present to preserve prototype parity but show explicit `empty`, `coming soon`, `setup required`, or `unavailable` states [And] the implementation must not render hard-coded demo rankings, announcement rows, Procurement Officer contact details, or fake plan rows copied from the prototype.
16. [Given] live DU dashboard data changes while the user remains on `/du` [When] Convex data updates resolve successfully [Then] the dashboard refreshes reactively via `useQuery` without browser refresh, manual polling, or duplicate REST fetches for the same snapshot [And] any still-valid in-progress launchpad selections are preserved rather than being silently cleared by an unrelated refresh.
17. [Given] the authenticated user reaches `/du` but their DU profile is missing a valid `departmentId` or required department linkage [When] the dashboard query resolves [Then] the route shows a truthful blocked-state message explaining that department setup is incomplete [And] no tenant data is guessed or backfilled from unrelated records [And] the user is not shown a broken dashboard shell that appears live.
18. [Given] the dashboard is derived from `docs/html/procurelinedb.html` [When] the production UI is implemented [Then] it preserves the prototype's DU-specific hierarchy and visual composition exactly where that behavior is valid [And] it corrects prototype shortcuts and bugs such as hard-coded deadline values, `alert()`-based UX, missing PO-contact wiring, DU announcements sourced from the PO dashboard object, and the split between `existingPlans` and `plans` that leaves the prototype table under-populated.

## Tasks / Subtasks

- [x] Task 1: Replace the `/du` placeholder with a dedicated Department User dashboard surface that matches the prototype one-to-one (AC: 1, 2, 10, 13, 15)
  - [x] Keep `webapp/app/(app)/du/page.tsx` thin and move the interactive UI into a dedicated feature component such as `webapp/src/components/department-user/DepartmentUserDashboard.tsx`.
  - [x] Reuse the existing authenticated app shell in `webapp/app/(app)/layout.tsx` and the existing `/du` role guard flow instead of adding a second DU layout.
  - [x] Build the dashboard with shadcn/ui primitives already used elsewhere in the repo, especially `Card`, `Badge`, `Button`, `Progress`, `Alert`, `Separator`, `Skeleton`, `Collapsible`, `Tooltip`, and `ScrollArea`, plus `lucide-react`.
  - [x] Keep the DU prototype's panel order and overall composition: quick-stats row, launchpad, plans table, leaderboard, announcements, support context.
  - [x] Add the same desktop-required fallback pattern already established in the tenant-admin and procurement-officer dashboards.

- [x] Task 2: Create a DU dashboard snapshot contract and add the minimum truthful live data sources required for production parity (AC: 3, 4, 5, 6, 7, 9, 15, 16, 17)
  - [x] Add a focused Convex query module such as `webapp/convex/functions/departmentUserDashboard.ts` instead of overloading unrelated auth or PO modules.
  - [x] Guard the query with `requireTenantRole(ctx, ["department_user"])` so only Departmental Users can load the snapshot.
  - [x] Use `authContext.departmentId`, `authContext.departmentAccessMode`, `departments`, `departmentUserProfiles`, `tenantUsers`, and any safe tenant-scoped audit/activity source that already exists.
  - [x] If the live repo still lacks the minimum shared procurement fields required for a truthful DU dashboard, add them now using names and shapes that align with Epic 4 and Epic 5 instead of inventing dashboard-only side structures. At minimum, assess and add only what is necessary for dashboard truthfulness, such as department budget and the base plan-summary table surface.
  - [x] If a `plans` table is added in this story, shape it for forward compatibility with Stories 5.2 and 5.4 rather than copying the prototype's IndexedDB-only XML contract. Follow the architecture/project-context preference for structured Blockly persistence and explicit status metadata.
  - [x] Return a typed snapshot with stable top-level groups such as `heroSupport`, `quickStats`, `launchpad`, `plans`, `leaderboard`, `announcements`, and `meta` so later Epic 5 stories can extend the dashboard without redesigning `/du`.
  - [x] Explicitly distinguish `available`, `empty`, `setup_required`, `coming_soon`, `read_only`, and `unavailable` states so missing backend sources never become believable fake business data.

- [x] Task 3: Implement budget, deadline, and plan-state derivation in pure helper modules (AC: 3, 4, 5, 6, 7, 9, 10, 11, 12, 18)
  - [x] Add a helper module such as `webapp/lib/department-user/dashboard.ts` for fiscal-year labeling, urgency thresholds, status-badge mapping, launchpad state, and dashboard copy so the logic is testable outside React.
  - [x] Reuse the Kenya July 1 to June 30 fiscal-year logic documented in project context and architecture.
  - [x] Derive the deadline card from live department submission-window data and `departmentAccessMode`; do not ship the prototype's fixed `45` day countdown.
  - [x] Derive read-only states from the existing backend access-mode logic in `webapp/lib/auth/department-user-access.ts` instead of recreating deadline rules in the UI.
  - [x] Normalize plan statuses and action affordances so the dashboard can truthfully express `No Plan`, `Draft`, `Submitted`, `Rejected`, and `Approved`.
  - [x] Surface rejection comments and revision guidance as first-class dashboard state instead of treating rejection as a generic non-editable table row.

- [x] Task 4: Recreate the prototype launchpad behavior and connect it cleanly to the upcoming Blockly workspace (AC: 8, 9, 12, 13, 14, 16, 18)
  - [x] Implement the category-pill selection experience with selected styling, item counts, select-all, clear-all, and selected-count feedback modeled directly on `docs/html/procurelinedb.html`.
  - [x] Replace the prototype's `alert()` validation with inline guidance and disabled CTA behavior appropriate for the protected webapp.
  - [x] Preserve the selected categories in a stable handoff to the Story 5.2 workspace route or reserved route contract, such as query-state, search params, or a typed local draft cache.
  - [x] Keep the launchpad visible even when setup is incomplete, but switch it into honest disabled/setup-required states rather than hiding the entire section.
  - [x] Do not build the full Blockly editor in Story 5.1, but do ensure the DU dashboard does not have to be reworked structurally when Story 5.2 lands.

- [x] Task 5: Stabilize the plans table, leaderboard, announcements, and PO support panels without copying prototype demo data (AC: 9, 10, 11, 12, 15, 17, 18)
  - [x] Recreate the prototype plans table with `Fiscal Year`, `Status`, `Items`, and `Actions` columns, including always-available view affordance plus gated edit affordance.
  - [x] Recreate the prototype leaderboard and announcements panels as real production components, but show honest unavailable/empty states if their live source is not implemented yet.
  - [x] Add a truthful DU support context surface for the assigned Procurement Officer, using live role/profile data where available and a clear unavailable state where it is not.
  - [x] Correct the prototype's data-shape issues so the plans table reads from a single canonical dashboard snapshot instead of parallel `existingPlans` and `plans` arrays.
  - [x] Keep the prototype's visual direction, but do not carry forward its missing data wiring, hard-coded placeholders, or silent null fallbacks as production behavior.

- [x] Task 6: Add deterministic tests for DU dashboard state derivation, route protection, and prototype-correction regressions (AC: 2, 4, 5, 6, 7, 9, 10, 11, 13, 14, 15, 16, 17, 18)
  - [x] Add pure tests for deadline urgency thresholds, read-only state derivation, budget-card state mapping, plan-status action gating, and category-launchpad selection rules in a file such as `webapp/tests/department-user-dashboard.test.ts`.
  - [x] Add snapshot-builder tests proving the dashboard never fabricates budget, leaderboard, announcement, or support-contact values when the live source is absent.
  - [x] Add tests proving the production implementation no longer hard-codes the prototype's `45` day countdown.
  - [x] Add route/auth regression checks for `/du` and any reserved `/du/...` handoff routes so only `department_user` can access them.
  - [x] Update `webapp/tests/run-tests.ts` to include the new Department User dashboard test suite.

## Dev Notes

### Story Foundation

- Epic 5 defines Story 5.1 as the DU entry point that explains planning context before Blockly editing begins.
- The user has given an additional direction beyond the epic text: the DU dashboard in the protected webapp must match `docs/html/procurelinedb.html` one-to-one in structure and feel.
- This means prototype parity is a hard requirement for layout, hierarchy, and interactions, but prototype bugs and demo shortcuts are not acceptable in production.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/du/page.tsx` currently renders `RoleDashboardPlaceholder` only.
- `webapp/app/(app)/layout.tsx` already provides the protected shell, role guard, logout flow, and notification/header context for authenticated routes.
- `webapp/lib/auth/roles.ts` already maps Departmental Users to `/du` and protects `/du/...` through segment-aware route matching.
- `webapp/convex/functions/_roleGuard.ts` already resolves `departmentId` and `departmentAccessMode` for Departmental Users through live department submission-window logic.
- `webapp/lib/auth/department-user-access.ts` already provides the canonical `editable` vs `read_only_grace` decision logic and should be reused rather than duplicated.
- `webapp/convex/schema.ts` currently includes:
  - `tenants`
  - `tenantUsers`
  - `departments`
  - `departmentUserProfiles`
  - `departmentAccessCodes`
  - `auditLogs`
- The current schema does **not** yet include the full Epic 4/Epic 5 DU dashboard data surface expected by the prototype and planning docs, especially:
  - procurement categories
  - procurement items
  - DU plan records
  - DU dashboard announcement sources
  - leaderboard metrics
  - department budget allocation fields in the live schema
- Story 5.1 therefore needs to do one of two things per panel:
  - add the minimum shared live data shape required for truthful production behavior, or
  - render an explicit unavailable/setup-required state without fabricating data.

### Prototype Analysis: How `procurelinedb.html` Builds the DU Dashboard

- The DU dashboard markup begins at `#duDashboardView` in `docs/html/procurelinedb.html`.
- Its top row has three quick-stat cards:
  - `Budget Utilization` with used/total budget and an expandable "Budget by category" breakdown.
  - `Items in Plan` with item count and status text.
  - `Submission Deadline` with a radial gauge, days remaining, and fiscal-year copy.
- Its main bento grid contains:
  - `Plan Launchpad` with category pills, `Select All`, `Clear All`, selected-count feedback, and a `+ New Plan` CTA.
  - `Annual Procurement Plans` table with fiscal year, status, item count, and actions.
  - `Department Efficiency Leaderboard`.
  - `Recent Announcements`.
- The prototype also shows Procurement Officer support context in the authenticated nav area (`duOfficerNav`).
- The prototype's category selection is held in a `selectedCategories` set and passed into the Blockly toolbox builder so the future editor only exposes the chosen categories.
- The prototype toggles into the Blockly editor with `openBlocklyWithSelection()` and then customizes the editor header for the DU flow.

### ASCII Wireframe: Required DU Dashboard Layout

```text
LEGEND
- Box positions, panel names, row structure, CTA placement, and relative emphasis are REQUIRED UI structure.
- Specific values shown inside the wireframe, like "0%", "KES 50.0M", "45d", "No plans available", and category names/counts, are SAMPLE CONTENT unless a separate acceptance criterion says that exact copy is required.
- Prototype-derived labels that are structural UI labels are REQUIRED, for example:
  "Budget Utilization", "Items in Plan", "Submission Deadline", "Plan Launchpad",
  "Annual Procurement Plans", "Department Efficiency Leaderboard", "Recent Announcements",
  "Select All", "Clear All", and "+ New Plan".
- Dynamic business data must come from live app state, not from this ASCII block.
```

```text
+----------------------------------------------------------------------------------------------------------------------+
| Procureline     [ Computer Science ]                                  [ PO Support ] [Planning Support Active]      |
|                                                                                         [bell] [MK] Mary Kamau      |
+----------------------------------------------------------------------------------------------------------------------+

+--------------------------------------+--------------------------------------+--------------------------------------+
| BUDGET UTILIZATION                   | ITEMS IN PLAN                        | SUBMISSION DEADLINE                  |
|                                      |                                      |                                      |
| 0%                                   | 0                                    |      ___green radial gauge___        |
| -- / KES 50.0M                       | Not Started                          |         45d                          |
|                                      |                                      |      Time remaining for this cycle   |
| ----------------------------------   |                                      |      FY 2025-2026 Submission         |
| Budget by category  [View breakdown] |                                      |                                      |
+--------------------------------------+--------------------------------------+--------------------------------------+

+---------------------------------------------------------+------------------------------------------------------------+
| Plan Launchpad                                          | Annual Procurement Plans                                   |
| Select categories, then launch a new procurement plan.  |                                                            |
|                                         [Select All]    |                                             [+ New Plan]  |
|                                         [Clear All]     | Fiscal Year          Status          Items         Actions |
|                                         [+ New Plan]    | --------------------------------------------------------  |
|                                                         | |                 No plans available                    | |
| [Office Supplies     | 30 items]                        | --------------------------------------------------------  |
| [Sports Equipment    | 30 items]                        |                                                            |
| [Maintenance Tools   | 30 items]                        |                                                            |
| [Communication Equip | 30 items]                        |                                                            |
| [Medical Supplies    | 30 items]                        |                                                            |
| [Printing Services   | 30 items]                        |                                                            |
| [Vehicle Maintenance | 30 items]                        |                                                            |
| [IT Equipment        | 30 items]                        |                                                            |
| [Laboratory Equip.   | 30 items]                        |                                                            |
| [Furniture           | 30 items]                        |                                                            |
| [Stationery          | 30 items]                        |                                                            |
| [Cleaning Supplies   | 30 items]                        |                                                            |
| [Electrical Equip.   | 30 items]                        |                                                            |
|                                                         |                                                            |
| 0 categories selected                       Select > Launch                                                        |
+---------------------------------------------------------+------------------------------------------------------------+

+---------------------------------------------------------+------------------------------------------------------------+
| Department Efficiency Leaderboard                       | Recent Announcements                                       |
|                                           Top performers |                                                   View All |
|                                                         |                                                            |
|               No leaderboard data                       |                 No announcements                           |
|                                                         |                                                            |
+---------------------------------------------------------+------------------------------------------------------------+
```

### ASCII Wireframe Notes

- Keep this exact macro layout: top navigation strip, 3-card stats row, 2-column middle row, 2-column bottom row.
- The left middle `Plan Launchpad` card is the most interaction-heavy area and should visually dominate the left side.
- The right middle `Annual Procurement Plans` card should be taller and table-oriented, even when empty.
- The bottom row is two equal cards: leaderboard on the left, announcements on the right.
- The deadline card should read as visually different from the first two stat cards because of the radial countdown treatment.
- The header must preserve the DU context chips: department chip near the brand, PO support cluster on the right, then user identity/logout.
- Treat the ASCII block as a layout and composition contract, not as authority for seeded values.
- Any exact copy that must be preserved is already called out in the acceptance criteria or in the prototype-parity notes above.
- When layout and live data conflict, preserve the layout and replace the sample value with a truthful live value, empty state, or unavailable state.

### ASCII Legend: UI Structure vs Sample Content

- The ASCII block defines required screen structure, panel order, visual hierarchy, and action placement.
- The ASCII block does not define hard-coded business data.
- Treat values such as `0%`, `0`, `45d`, `KES 50.0M`, `Computer Science`, `Mary Kamau`, `30 items`, and `No plans available` as sample prototype content unless the live app truly resolves to those same values.
- Do not hard-code sample names, departments, counts, totals, countdowns, announcements, leaderboard entries, or procurement-support text just because they appear in the ASCII sketch.
- If live data exists, render the live value.
- If live data does not exist yet, preserve the same UI shell but show the correct empty or unavailable state defined by this story.
- The source of truth for implementation is: acceptance criteria first, prototype-parity notes second, ASCII layout third.

### Prototype Behaviors To Keep vs. Prototype Bugs To Correct

- Keep these prototype behaviors:
  - the overall DU dashboard hierarchy and panel composition
  - category-pill launchpad interaction
  - quick stats row with the distinctive deadline card treatment
  - plans table layout and action column rhythm
  - lower bento panels for leaderboard and announcements
- Correct these prototype issues in production:
  - `daysToDeadline` is hard-coded to `45` at login bootstrap and must be replaced with live derivation
  - `alert()` is used for launchpad validation and must be replaced with inline or disabled-state UX
  - DU announcements are rendered from `appData.poDashboard.announcements` instead of a DU-safe source
  - Procurement Officer contact data is wired in render logic but never actually populated
  - login bootstrap stores plan rows in `existingPlans`, while the plans table renders from `plans`, leaving the prototype internally inconsistent
  - the prototype uses IndexedDB and Blockly XML for demo persistence, which conflicts with the architecture and project-context requirement to favor structured app data in the real webapp

### Additional Clarifications From Edge-Case Review

- Treat `one department + one fiscal year = one canonical plan` as a hard business rule for Story 5.1.
- If that canonical plan already exists, the DU dashboard must pivot from plan creation to truthful continuation or view actions instead of implying a second same-year plan can be created.
- Distinguish three deadline states in the UI:
  - submission window not yet open
  - submission window currently active
  - submission window closed or read-only grace
- If a rejected plan is shown during a read-only period, preserve the rejection feedback but do not surface an editing CTA the backend will refuse.
- Reactive dashboard refreshes must preserve launchpad selections that are still valid in the refreshed catalog snapshot.
- If auth resolves a DU without a valid department linkage, show a blocked setup state instead of attempting to guess the department context.

### Reuse And Anti-Reinvention Guidance

- Reuse the existing tenant-admin and procurement-officer dashboard implementation pattern:
  - thin App Router page
  - dedicated feature component
  - typed snapshot builder
  - pure helper modules
  - deterministic Node-based tests
  - desktop fallback below the minimum viewport
- Reuse the existing protected app shell in `webapp/app/(app)/layout.tsx`; do not create a second DU layout or a standalone dashboard shell outside the authenticated app.
- Reuse `requireTenantRole`, `getAuthContext`, and `department-user-access` helpers for authorization and submission-window truth.
- Reuse shadcn/ui and `lucide-react`; do not introduce charting, dashboard-framework, or animation-library dependencies for this story.
- Reuse the coming-soon/unavailable-state patterns already established in the Tenant Admin and PO dashboards for panels whose backend sources have not landed yet.

### Prototype Parity Requirement

- `docs/html/procurelinedb.html` is the canonical design reference for this story, not just loose inspiration.
- The production DU dashboard should feel recognizably identical in:
  - panel order
  - card emphasis
  - launchpad interaction model
  - plans-table structure
  - lower-panel composition
  - deadline-card presence and urgency treatment
- The production implementation must still adapt the prototype into:
  - the existing authenticated webapp shell
  - live Convex-backed data
  - truthful empty/unavailable states
  - the UX spec's desktop-only strategy

### Data Availability And Scope Boundaries

- Safe live signals already available now:
  - DU role and `departmentId` from the existing auth context
  - live submission-window state via `departmentAccessMode`
  - department identity and active window timestamps from `departments`
  - tenant-scoped DU profile linkage from `departmentUserProfiles`
  - tenant-role linkage via `tenantUsers`
- Not fully available yet in the live repo:
  - category and item catalog data
  - department budget allocation
  - DU plan summaries/history
  - leaderboard metrics
  - announcement feed dedicated to the DU dashboard
  - Procurement Officer support metadata beyond currently available membership links
- Story 5.1 should therefore:
  - add only the minimum shared live fields/tables necessary for truthful DU dashboard parity, and
  - keep any still-missing sections honest with explicit empty/unavailable states rather than mock fullness.
- Do not ship prototype-carried demo numbers, fake rankings, fake deadlines, fake announcement rows, or fabricated contact cards just to keep the dashboard visually populated.

### Recommended DU Dashboard Snapshot Shape

- Recommended top-level response groups:
  - `quickStats`
  - `launchpad`
  - `plans`
  - `leaderboard`
  - `announcements`
  - `heroSupport`
  - `meta`
- Recommended state vocabulary:
  - `available`
  - `empty`
  - `setup_required`
  - `read_only`
  - `coming_soon`
  - `unavailable`
- Keep the snapshot contract explicit enough that Stories 5.2 through 5.7 can extend the DU experience without rethinking `/du`.

### Minimal Schema Guidance

- If schema updates are needed for truthful delivery, prefer names that align with the planning artifacts rather than inventing dashboard-only fields.
- Likely shared candidates to assess:
  - department budget allocation on `departments`
  - optional DU-facing metadata such as a vote/reference code only if truly required for current parity
  - a base `plans` table or equivalent canonical DU plan-summary source with `tenantId`, `departmentId`, `fiscalYear`, `status`, summary totals, and timestamps
- If a plan persistence shape is introduced now, it must align with the architecture/project-context guidance for structured Blockly persistence and must not lock the repo into the prototype's XML-only demo model.

### UX And Interaction Requirements

- Follow the UX specification's desktop-only platform strategy and bento-box dashboard direction.
- Keep the dashboard scannable above the fold: quick context first, launchpad second, plans and follow-up panels after that.
- Keep launchpad interactions supportive, not punitive: inline guidance and honest disabled states are better than alerts.
- Preserve keyboard focus states and accessible semantics for category-pill toggles, launchpad controls, and plans-table actions.
- Maintain the prototype's DU-specific tone: this is a practical planning surface, not a generic admin dashboard.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`, not only the older planning summaries:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `lucide-react` `^0.577.0`
  - `date-fns` `^2.30.0`
  - `sonner` `^2.0.7`
- Keep secure authorization and tenant scoping in Convex.
- Keep page files thin and move interactive dashboard behavior into client components only where hooks or browser state are required.
- Do not add `middleware.ts`; the repo uses `proxy.ts`.

### Library And Framework Requirements

- Next.js / React
  - Keep `/du` as the canonical Department User dashboard route.
  - Follow the repo's thin-route pattern used by the tenant-admin and PO dashboards.
  - Use client components only where `useQuery`, local selection state, or browser storage/handoff is needed.
- Convex
  - Use `useQuery` for live reactive dashboard reads.
  - Use indexed tenant/department-scoped reads where possible.
  - Do not build a parallel REST dashboard endpoint.
- UI stack
  - Use shadcn/ui primitives already in the repo.
  - Use `lucide-react` icons.
  - Use `sonner` if transient DU feedback is needed.
  - Use `date-fns` for countdown/date formatting if additional helpers are required.
- Do not add a charting dependency for the budget card; existing primitives are sufficient.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/du/page.tsx`
  - `webapp/tests/run-tests.ts`
  - `webapp/convex/schema.ts` only if minimal truthful DU-dashboard data fields or tables are genuinely required
- Expected new files (recommended):
  - `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
  - `webapp/src/components/department-user/DepartmentUserRoutePlaceholder.tsx` if reserved DU follow-on routes are needed now
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/lib/department-user/dashboard-snapshot.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/tests/department-user-dashboard.test.ts`
- Optional reserved follow-on routes if the launchpad handoff or plan-table actions need stable destinations now:
  - `webapp/app/(app)/du/plans/page.tsx`
  - `webapp/app/(app)/du/plans/new/page.tsx`
  - `webapp/app/(app)/du/plans/[planId]/page.tsx`

### Testing Requirements

- Add pure helper tests for:
  - fiscal-year and countdown labeling
  - deadline urgency thresholds
  - read-only vs editable DU access states
  - budget-card state derivation
  - launchpad selection and CTA enabling rules
  - plan-status badge and action gating
- Add snapshot-builder tests for:
  - no-budget state
  - no-catalog setup-in-progress state
  - rejected-plan comment visibility
  - empty plan-history state
  - truthful unavailable states for leaderboard, announcements, and PO support when the live source is absent
  - no hard-coded 45-day deadline fallback
- Add route/auth regression tests for:
  - Department User access to `/du`
  - non-DU redirects away from `/du`
  - any reserved `/du/...` sub-routes remaining protected

### Git Intelligence Summary

- Recent commits show that both `/tenant-admin` and `/po` have already moved from placeholders into dedicated dashboard feature components backed by typed snapshot builders and deterministic tests.
- Commit `8e95f1a` implemented the Procurement Officer dashboard shell, which is the closest current pattern for dashboard feature architecture inside the protected app.
- Commit `190a1b1` completed the Tenant Admin dashboard UX, reinforcing the thin-route plus feature-component plus helper-module pattern.
- Story 5.1 should follow those established dashboard patterns so the DU workspace feels like part of the same product family rather than a separate prototype port.

### Latest Tech Information

- Verified on March 21, 2026 against official documentation and the live repo:
  - Next.js App Router documentation continues to support thin route files with most interactive work moved into dedicated components.
  - Next.js authentication guidance still favors keeping authorization close to data access, which aligns with Convex role guards for DU dashboard data.
  - Convex React documentation continues to position `useQuery` as the reactive client primitive for live reads, which matches the dashboard's no-polling requirement.
  - Convex indexing guidance still recommends targeted `withIndex(...)` access patterns for predictable reads.
  - shadcn/ui documentation continues to favor local, composable component ownership instead of a monolithic dashboard framework.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - shadcn/ui + Tailwind styling
  - `sonner` for user feedback
  - tenant scoping in backend reads
  - reuse of the Kenya fiscal-year model
- Where planning docs conflict with the current repo layout, prefer the live repo and current package versions.

### References

- [Sprint Status](./sprint-status.yaml)
- [Epic 5 Source](./epics/epic5/epic-05-du-blockly-planning.md)
- [Epic 4 Source](./epics/epic4/epic-04-po-department-catalog.md)
- [Project Context](../project-context.md)
- [PRD](../planning-artifacts/prd.md)
- [Architecture](../planning-artifacts/architecture.md)
- [UX Design](../planning-artifacts/ux-design-specification.md)
- [DU Prototype](../../docs/html/procurelinedb.html)
- [Current DU Route](../../webapp/app/(app)/du/page.tsx)
- [Current Protected App Layout](../../webapp/app/(app)/layout.tsx)
- [Current Role Mapping Helpers](../../webapp/lib/auth/roles.ts)
- [Current Department User Access Helpers](../../webapp/lib/auth/department-user-access.ts)
- [Current Auth Context Query](../../webapp/convex/functions/users.ts)
- [Current Role Guard](../../webapp/convex/functions/_roleGuard.ts)
- [Current Convex Schema](../../webapp/convex/schema.ts)
- [Tenant Admin Dashboard Reference](../../webapp/src/components/tenant-admin/TenantAdminDashboard.tsx)
- [Tenant Admin Snapshot Builder Reference](../../webapp/lib/tenant-admin/dashboard-snapshot.ts)
- [Procurement Officer Dashboard Reference](../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [Procurement Officer Snapshot Builder Reference](../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
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
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic sources:
  - `_bmad-output/implementation-artifacts/epics/epic5/epic-05-du-blockly-planning.md`
  - `_bmad-output/implementation-artifacts/epics/epic4/epic-04-po-department-catalog.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `docs/html/procurelinedb.html`
  - `webapp/package.json`
  - `webapp/app/(app)/du/page.tsx`
  - `webapp/app/(app)/tenant-admin/page.tsx`
  - `webapp/app/(app)/po/page.tsx`
  - `webapp/app/(app)/layout.tsx`
  - `webapp/src/components/auth/RoleDashboardPlaceholder.tsx`
  - `webapp/src/components/tenant-admin/TenantAdminDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerRoutePlaceholder.tsx`
  - `webapp/lib/tenant-admin/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/lib/auth/department-user-access.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/convex/schema.ts`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/run-tests.ts`
- Git context:
  - `git log -5 --oneline`
- External validation sources:
  - `https://nextjs.org/docs/app`
  - `https://nextjs.org/docs/app/guides/authentication`
  - `https://docs.convex.dev/client/react`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://ui.shadcn.com/docs`

### Completion Notes List

- 2026-03-21: Created the implementation-ready story artifact for `5-1-du-dashboard-plan-status`.
- 2026-03-21: Anchored the story to the user's explicit requirement that the protected webapp DU dashboard match `docs/html/procurelinedb.html` one-to-one in layout and behavior.
- 2026-03-21: Documented the prototype's exact DU dashboard composition plus the production corrections needed to avoid carrying over hard-coded deadlines, `alert()` UX, missing support contact wiring, and split plan-state arrays.
- 2026-03-21: Tied the story to the live `/du` placeholder route, existing Convex role guards, current dashboard implementation patterns, and the current schema gaps that must be handled truthfully.
- 2026-03-21: Updated sprint tracking so `5-1-du-dashboard-plan-status` is ready for development and Epic 5 is marked in progress.
- 2026-03-22: Replaced the `/du` placeholder with a production Department User dashboard component, desktop-only fallback, prototype-aligned launchpad, and truthful blocked/setup/read-only states.
- 2026-03-22: Added the DU dashboard helper and snapshot modules, the new Convex dashboard query, minimal shared DU schema fields/tables, and reserved `/du/plans/...` handoff routes for Story 5.2.
- 2026-03-22: Preserved one-plan-per-fiscal-year behavior, live deadline derivation, rejection messaging, Procurement Officer support wiring, and category handoff through query-state instead of prototype `alert()` behavior.
- 2026-03-22: Added deterministic DU dashboard tests, regenerated Convex bindings, and verified the implementation with `npm test` and `npm run lint`.

### File List

- `_bmad-output/implementation-artifacts/5-1-du-dashboard-plan-status.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/app/(app)/du/page.tsx`
- `webapp/app/(app)/layout.tsx`
- `webapp/app/(app)/du/plans/page.tsx`
- `webapp/app/(app)/du/plans/new/page.tsx`
- `webapp/app/(app)/du/plans/[planId]/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/_roleGuard.ts`
- `webapp/convex/functions/departmentUserDashboard.ts`
- `webapp/convex/schema.ts`
- `webapp/convex/seedData.ts`
- `webapp/lib/department-user/dashboard.ts`
- `webapp/lib/department-user/dashboard-snapshot.ts`
- `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
- `webapp/src/components/department-user/DepartmentUserRoutePlaceholder.tsx`
- `webapp/tests/department-user-dashboard.test.ts`
- `webapp/tests/run-tests.ts`
- `webapp/tsconfig.tests.json`
- `webapp/.test-dist/tests/run-tests.js`

### Senior Developer Review (AI)

- 2026-03-22: Changes requested during review were fixed automatically and re-verified.
- Resolved the failing lint path in `webapp/convex/seedData.ts` by removing redundant unreachable checks while keeping the helper safety intact.
- Restored Procurement Officer support visibility across supported desktop widths in `webapp/app/(app)/layout.tsx` so the DU hero context no longer disappears on laptop-sized desktops.
- Replaced the DU dashboard's loose `any` snapshot handling with a structured Convex return validator and typed component props in `webapp/convex/functions/departmentUserDashboard.ts` and `webapp/src/components/department-user/DepartmentUserDashboard.tsx`.
- Updated the lower DU dashboard panels to render live leaderboard and announcement rows when those sources become available instead of always forcing empty placeholders.
- Verification: `npm test`
- Verification: `npm run lint`

### Change Log

- 2026-03-22: Implemented the DU dashboard, typed snapshot/query pipeline, minimal shared DU planning schema, reserved DU plan handoff routes, and deterministic dashboard regression coverage.
- 2026-03-22: Fixed review findings by restoring a green lint run, tightening the DU snapshot contract, rendering live lower-panel rows, and exposing PO support context on supported desktop widths.

### Story Completion Status

- Story ID: `5.1`
- Story Key: `5-1-du-dashboard-plan-status`
- Output File: `_bmad-output/implementation-artifacts/5-1-du-dashboard-plan-status.md`
- Final Status: `done`
- Completion Note: `Production DU dashboard implementation completed, review findings resolved, and verification reconfirmed with passing lint and test runs`
