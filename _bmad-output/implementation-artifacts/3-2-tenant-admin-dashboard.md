# Story 3.2: Tenant Admin Dashboard

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Tenant Admin,
I want to see a comprehensive dashboard with real-time institutional metrics,
so that I can monitor my organization's procurement activities at a glance.

## Acceptance Criteria

1. [Given] a Tenant Admin logs in successfully [When] they open `/tenant-admin` [Then] the placeholder page is replaced by a real dashboard shell showing summary cards for Total POs, Departments, Submission Progress, and Budget Utilization [And] each card exposes the current value plus an explicit trend, status, or empty-state cue instead of a generic placeholder (FR-TA2a, FR18, FR19).
2. [Given] a Tenant Admin views the dashboard during an active fiscal year [When] the dashboard loads [Then] it shows the current fiscal-year cycle state with a visual timeline [And] it displays the current submission deadline with a countdown timer (FR-TA2b).
3. [Given] tenant activity has occurred [When] a Tenant Admin views the dashboard [Then] the dashboard shows a recent-activity feed limited to the latest 20 tenant-scoped events [And] each item includes actor, action, timestamp, and affected entity details sourced from the existing audit infrastructure (FR-TA2c).
4. [Given] a Tenant Admin wants to move quickly [When] they view the dashboard actions area [Then] the UI exposes quick actions for Add PO, View Reports, and Settings [And] the UI contextually highlights the most relevant next action based on onboarding/setup state without implementing downstream stories out of scope here (FR-TA2d).
5. [Given] a newly created tenant has no Procurement Officers configured [When] the dashboard loads [Then] it shows an onboarding checklist that includes Add PO, Configure Settings, and Review Billing [And] the checklist clearly communicates what is blocked vs. what is merely recommended (FR-TA2e).
6. [Given] the tenant is before the submission period start [When] the dashboard loads [Then] it shows a countdown to submission start instead of an active-cycle deadline message (FR-TA2f).
7. [Given] the tenant is after the submission period end [When] the dashboard loads [Then] it shows a cycle-complete summary with the best available key metrics and completion messaging rather than an active countdown (FR-TA2g).
8. [Given] real-time sync is temporarily unavailable or the client reconnects with stale data [When] the dashboard cannot obtain a fresh reactive payload [Then] it falls back to the latest cached snapshot, shows `Last updated: [timestamp]`, and avoids presenting the stale snapshot as live data (FR-TA2h).
9. [Given] a Tenant Admin has access to multiple fiscal years [When] they change the fiscal-year selector [Then] the dashboard updates all cards, timeline copy, and activity filters for the selected period without leaving the `/tenant-admin` route (FR-TA2i).
10. [Given] dashboard-relevant data changes inside the tenant [When] queries resolve successfully [Then] the dashboard refreshes via Convex reactivity and does not rely on manual polling or browser refreshes (FR-TA2j).
11. [Given] the implementation is deriving from `docs/html/admin-tenant.html` [When] the dashboard is built [Then] it keeps that prototype's overall visual direction and information hierarchy as inspiration rather than a literal copy [And] it adapts the UI to the real authenticated app shell, route structure, and available data contracts already in the repo.
12. [Given] the tenant has no usable tenant-wide submission timeline yet because departments are missing, windows are unconfigured, or department windows cannot safely collapse into one headline date [When] the dashboard loads [Then] it shows a setup-required timeline state instead of a misleading countdown or fake deadline.
13. [Given] a selected fiscal year has no dashboard data yet [When] the Tenant Admin switches to that period [Then] the dashboard shows an explicit empty-period state [And] it does not reuse stale metrics from another fiscal year or tenant just to keep the UI populated.
14. [Given] a dashboard section visible in the prototype depends on data that is not yet stored in the database, such as invoice history or billing snapshots [When] Story 3.2 renders that section or CTA [Then] it must show an explicit unavailable/coming-soon/empty state and must never render mock, seeded demo, hard-coded, inferred, or prototype-carried data unless that value is returned by the real live query layer.

## Tasks / Subtasks

- [ ] Task 1: Replace the current tenant-admin placeholder with a real dashboard shell (AC: 1, 2, 4, 5, 6, 7, 9)
  - [ ] Keep `webapp/app/(app)/tenant-admin/page.tsx` thin and move the UI into a dedicated feature component such as `webapp/src/components/tenant-admin/TenantAdminDashboard.tsx`.
  - [ ] Build the dashboard with the existing shadcn/ui primitives and the UX spec's bento-box information architecture instead of introducing a charting or dashboard library.
  - [ ] Use `docs/html/admin-tenant.html` as a layout and visual-reference source for card hierarchy, sidebar mindset, and section composition, but adapt it to the existing protected app shell rather than copying the prototype DOM or fake screens one-to-one.
  - [ ] Include the four required summary cards, a fiscal-year status/timeline panel, a recent-activity panel, and a quick-actions/onboarding panel in the first delivered layout.
  - [ ] Preserve the existing authenticated app shell in `webapp/app/(app)/layout.tsx` and the role-protected `/tenant-admin` route contract established by Story 1.6.

- [ ] Task 2: Create a tenant-admin dashboard data contract that works with current data and later stories (AC: 1, 2, 3, 5, 6, 7, 9, 10)
  - [ ] Add a focused Convex query module such as `webapp/convex/functions/tenantAdminDashboard.ts` rather than overloading unrelated auth modules.
  - [ ] Gate the query with `requireTenantRole(...["tenant_admin"])` so only tenant admins can load the snapshot.
  - [ ] Aggregate available metrics from existing tables now: Procurement Officer count from `tenantUsers`, department count from `departments`, recent activity from `auditLogs`, and tenant metadata from `tenants`.
  - [ ] Return stable placeholder or `null`/empty values for metrics whose underlying source tables do not exist yet, especially submission-progress and budget-utilization details that will be completed by later stories.
  - [ ] Shape the response so later stories can extend it without breaking the initial dashboard UI contract, for example by returning `snapshotGeneratedAt`, `selectedFiscalYear`, `sourceState`, and strongly typed metric groups.
  - [ ] Explicitly distinguish between `zero`, `empty`, `unconfigured`, and `unavailable` data states so the UI never turns missing backend data into believable fake business metrics.
  - [ ] Do not surface prototype-only billing, invoice, settings, usage, submission, or PO-detail values unless they come from actual queryable data sources in the live schema and functions.
  - [ ] Do not introduce tenant-admin-only mock fixtures, seeded dashboard summaries, client-side fake arrays, or fallback constants just to make the UI feel full.

- [ ] Task 3: Implement period-aware dashboard states and onboarding cues (AC: 2, 4, 5, 6, 7, 9)
  - [ ] Add a tenant-admin dashboard helper module such as `webapp/lib/tenant-admin/dashboard.ts` for fiscal-year labeling, timeline state, onboarding priority, and display formatting so these rules are testable outside React.
  - [ ] Default fiscal-year logic to the Kenya July 1 to June 30 cycle from project context and architecture guidance.
  - [ ] Derive explicit cycle states for the hero/timeline area: `setup_required`, `before_start`, `active_submission`, or `cycle_complete`.
  - [ ] If no safe tenant-wide submission window can be derived from the currently available department data, prefer `setup_required` over inventing a synthetic start/end date.
  - [ ] Highlight quick actions based on missing setup prerequisites, especially the zero-PO case and missing institutional/fiscal-year context.
  - [ ] Keep downstream workflow buttons honest: use reserved routes, placeholders, or coming-soon treatments where later stories have not yet landed instead of fake completed experiences.
  - [ ] Define what the dashboard does when multiple POs exist: do not let a single-PO prototype card silently become misleading; either show an aggregated summary or a clearly labeled primary/most-recent PO surface.

- [ ] Task 4: Add recent-activity and resilience behavior without fighting Convex reactivity (AC: 3, 8, 10)
  - [ ] Source recent activity from the existing audited event stream rather than inventing a second dashboard-only activity log.
  - [ ] Limit the recent-activity feed to the latest 20 tenant-scoped items with safe display formatting for actor, action, entity, and time.
  - [ ] Build a small client-side dashboard snapshot cache helper, for example `webapp/lib/tenant-admin/dashboard-cache.ts`, that stores the last successful payload plus timestamp for stale-data fallback.
  - [ ] Use Convex `useQuery` for live data; do not add manual polling, interval refetching, or redundant REST fetches for the same snapshot.
  - [ ] Show a clear stale-data banner when cached fallback is being displayed, and clear that banner once a fresh reactive payload succeeds.
  - [ ] Key any cached snapshot by both `tenantId` and `selectedFiscalYear` so one tenant's or one period's data can never appear in another tenant/year context after navigation or role changes.
  - [ ] Render safe empty/fallback labels when audit log rows have missing optional metadata instead of assuming every activity item has a full actor/entity payload.

- [ ] Task 5: Create routing and placeholder contracts for follow-on tenant-admin work (AC: 4, 5)
  - [ ] Stabilize reserved quick-action destinations for at least PO management, reports, and settings under the `/tenant-admin/...` namespace so downstream stories extend the same IA instead of redirecting elsewhere later.
  - [ ] Reuse existing placeholder or access-coming-soon patterns where needed instead of building unfinished downstream features in Story 3.2.
  - [ ] Ensure route access remains inside the tenant-admin prefix so `RoleGuard` continues enforcing Story 1.6 behavior automatically.

- [ ] Task 6: Add deterministic test coverage for dashboard state derivation, access control, and fallback behavior (AC: 1, 3, 5, 6, 7, 8, 9, 10)
  - [ ] Add pure tests for fiscal-year state resolution, onboarding-priority selection, quick-action highlighting, and stale-snapshot metadata handling.
  - [ ] Add backend-shaping tests for the dashboard snapshot builder so PO counts, department counts, recent activity truncation, and missing-data placeholders are deterministic.
  - [ ] Add route/auth regression checks confirming the tenant-admin route still requires a resolved tenant-admin role and still redirects non-tenant-admin users away.
  - [ ] Add tests proving the dashboard uses cached data only as a fallback and still prefers fresh Convex query results when they are available.
  - [ ] Add edge-case tests for: no POs, no departments, no activity rows, selected fiscal year with no data, unconfigured/inconsistent submission windows, multiple active POs, and cache isolation by tenant plus fiscal year.

## Dev Notes

### Story Foundation

- Epic 3 positions Story 3.2 as the first real tenant-admin operating surface and explicitly says delivery should combine the dashboard shell, aggregated metrics, real-time updates, onboarding cues, and period-aware summaries.
- This is a frontend-led story in sprint status, so the correct implementation bias is to stabilize the dashboard contract and UX now while leaving later feature stories to deepen the underlying data sources.
- Story 3.2 sits ahead of Story 3.3 (PO management), Story 3.5 (institutional settings), Story 3.6/3.7 (billing), Story 3.8 (reports), and Story 3.9 (cross-institutional visibility). The dashboard should prepare for those stories, not pre-implement them.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/tenant-admin/page.tsx` currently renders `RoleDashboardPlaceholder` with static text only.
- `webapp/app/(app)/layout.tsx` already provides the protected app shell, authenticated header, logout flow, and `RoleGuard` wrapping for role-specific routes.
- `webapp/lib/auth/roles.ts` already maps `tenant_admin` to `/tenant-admin` and protects all `/tenant-admin/...` sub-routes through segment-aware prefix matching.
- `webapp/convex/functions/users.ts` already exposes `getAuthContext`, so the dashboard should not add a second role-resolution path.
- `webapp/convex/schema.ts` already has enough baseline tenant data to start this dashboard:
  - `tenants`
  - `tenantUsers`
  - `departments`
  - `auditLogs`
  - `sessionMetadata`
- The repo does not yet have plan-submission, budget-allocation, reporting, billing-dashboard, or institutional-settings tables/functions that can fully power every tenant-admin metric. Story 3.2 must therefore use a stable dashboard contract with explicit "not available yet" or empty-state behavior where later stories have not shipped.

### Reuse And Anti-Reinvention Guidance

- Reuse the existing app shell and role protection; do not create a second tenant-admin layout outside `webapp/app/(app)/layout.tsx`.
- Reuse `auditLogs` for recent activity; do not introduce a dashboard-only activity table.
- Reuse current shadcn/ui primitives such as `Card`, `Badge`, `Button`, `Progress`, `Select`, `Skeleton`, and `Alert` before considering any new dependency.
- Reuse existing auth context and tenant-role helpers; do not duplicate tenant-admin access checks in client-only code.
- Reuse the current "coming soon" route/CTA pattern for quick-action destinations whose full implementations belong to later stories.
- Reuse the project's test style by keeping derivation logic in pure helper modules that can be exercised by the Node-based test harness instead of burying all logic in React components.

### Prototype Alignment

- Use `docs/html/admin-tenant.html` as a visual and structural inspiration source for the tenant-admin experience.
- The intended inspiration points are:
  - high-level dashboard composition
  - bento-style summary cards
  - PO visibility affordances
  - quick-action emphasis
  - recent activity placement
  - billing/settings/audit information architecture for later stories
- Do not copy the prototype literally:
  - do not port its fake values
  - do not port its prototype-only auth screen
  - do not recreate standalone sidebar behavior that conflicts with the real app shell
  - do not assume every prototype section is already implementable in Story 3.2
- If a section exists in the prototype but its live data source does not exist yet, preserve the information architecture with an honest empty or unavailable state instead of simulated numbers.
- For this story, "no mock data" is a hard rule: if the value is not returned from the real database/query path, the UI must render an empty, unavailable, or setup-required state instead.

### Data Availability And Scope Boundaries

- This dashboard must be honest about what data exists today.
- Safe/available sources now:
  - active Procurement Officer count from `tenantUsers` filtered to `role === "procurement_officer"` and `isActive === true`
  - department count from `departments`
  - recent activity from `auditLogs`
  - tenant status/tier/name from `tenants`
- Not fully available yet:
  - true submission-progress metrics across department plans
  - true budget-utilization totals
  - institution settings and fiscal-year customization UI
  - billing/invoice data surfaces
  - generated report lists or report history
- Story 3.2 should therefore define a stable snapshot shape that can carry:
  - current computed values when the data exists,
  - explicit `null`, zero, or "pending source" placeholders when it does not,
  - UX messaging that distinguishes "no activity yet" from "feature data will arrive in a later story."
- Do not invent permanent database tables purely to fake submission or budget numbers for this story.
- Do not render prototype-derived invoice rows, payment methods, PO profile details, usage bars, submission counts, or synthetic dashboard summaries unless those values are sourced from actual live queries.
- Empty state is preferred over mock fullness.

### Edge Cases To Handle Explicitly

- Tenant has zero Procurement Officers: onboarding and quick actions must bias toward PO creation without rendering a fake PO summary card.
- Tenant has multiple active Procurement Officers: the UI must not imply there is only one PO just because the prototype showed a single primary PO card.
- Tenant has zero departments: summary and progress cards must show valid empty states, not divide-by-zero or `0/0` style metrics.
- Tenant has no audit activity: recent-activity panel must show a friendly empty state rather than a blank container.
- Audit events may have missing optional metadata: activity rendering must fall back to generic actor/entity labels safely.
- Department submission windows may be missing or inconsistent: timeline must show `setup_required` instead of a fabricated tenant-wide deadline.
- Selected fiscal year may have no records at all: cards, activity, and timeline must reset into an empty-period state instead of reusing the previous year's values.
- Cached snapshot fallback must never leak across tenant changes, role changes, or fiscal-year switches.
- Prototype sections like billing, invoice history, and settings may not yet have live data backing: Story 3.2 must keep them honest with unavailable states or defer them behind downstream routes.

### Technical Requirements

- Create a dedicated dashboard snapshot query, for example `getTenantAdminDashboardSnapshot`, in a new Convex domain module.
- Protect the query with tenant-admin-only access using the existing backend guard system.
- Keep the snapshot contract explicit. Recommended top-level groups:
  - `summaryCards`
  - `cycleState`
  - `activityFeed`
  - `quickActions`
  - `onboardingChecklist`
  - `meta`
- Add a fiscal-year selector contract even if only the current/default year is initially available. This prevents a later breaking redesign when historical periods are added.
- Base fiscal-year defaults on the Kenya July-June rule from project context and architecture. If tenant-specific fiscal-year settings are not implemented yet, use the project default and label it clearly.
- Recent activity should be tenant-scoped, newest first, capped at 20 items, and safe for display without leaking unrelated tenants.
- Cached fallback behavior should be client-side only and based on the last successful dashboard snapshot plus timestamp; it must never override a fresh live result.
- Stale fallback should be additive resilience, not the primary fetch path.

### UX And Interaction Requirements

- Follow the UX specification's bento-box dashboard direction for Tenant Admin with fast scannability over dense tables.
- The dashboard should answer "where do we stand?" in under a few seconds, which means the highest-value metrics and timeline state must appear above the fold.
- Keep the design desktop-first, consistent with the UX specification's platform strategy.
- Avoid introducing chart-heavy or analytics-heavy patterns that make the first tenant-admin dashboard feel like a BI tool.
- The onboarding checklist should feel action-oriented and supportive, not punitive.
- Quick actions should be prominent, but they must not mislead users into believing later stories are already complete.

### Architecture Compliance

- Follow the actual versions installed in `webapp/package.json`, not only the older high-level summaries:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `sonner` `^2.0.7`
  - `date-fns` `^2.30.0`
- Keep the current Next.js `proxy.ts` convention intact; do not add `middleware.ts`.
- Keep secure authorization and tenant scoping in Convex, not in route params or client assumptions.
- Prefer App Router server/page boundaries with small client components only where hooks, local cache, or interactive selectors are needed.

### Library And Framework Requirements

- Next.js / React
  - Keep `/tenant-admin` as the canonical route.
  - Keep page files thin and move interactive behavior into client components.
  - Continue following the repo's current async `searchParams` page pattern where route params or query params are needed.
- Convex
  - Use `useQuery` for live dashboard data.
  - Use indexed lookups and tenant-scoped filtering inside the snapshot query.
  - Keep the query deterministic and fast; avoid multiple broad scans when a targeted index or capped query can be used.
- UI stack
  - Use the existing shadcn/ui component set.
  - Use `sonner` for any user notifications triggered by selector changes or refresh-state messaging.
  - Use `date-fns` for countdown/date formatting if new helper formatting is needed.
- Do not add a charting dependency for Story 3.2 unless the existing component stack cannot express the required visual states, which is unlikely for this first dashboard shell.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/tenant-admin/page.tsx`
  - `webapp/convex/schema.ts` only if a small supporting index is genuinely required for efficient dashboard reads
  - `webapp/convex/functions/users.ts` only if the existing auth context contract needs a small tenant-admin convenience extension
- Expected new files (recommended):
  - `webapp/src/components/tenant-admin/TenantAdminDashboard.tsx`
  - `webapp/src/components/tenant-admin/TenantAdminSummaryCard.tsx`
  - `webapp/src/components/tenant-admin/TenantAdminRecentActivity.tsx`
  - `webapp/src/components/tenant-admin/TenantAdminQuickActions.tsx`
  - `webapp/lib/tenant-admin/dashboard.ts`
  - `webapp/lib/tenant-admin/dashboard-cache.ts`
  - `webapp/convex/functions/tenantAdminDashboard.ts`
  - `webapp/tests/tenant-admin-dashboard.test.ts`
- Reserved future routes that may be introduced now as placeholders if needed:
  - `webapp/app/(app)/tenant-admin/po-management/page.tsx`
  - `webapp/app/(app)/tenant-admin/reports/page.tsx`
  - `webapp/app/(app)/tenant-admin/settings/page.tsx`
- Keep tenant-admin feature logic grouped under a dedicated tenant-admin feature area instead of mixing it into auth components or marketing components.

### Testing Requirements

- Add pure helper tests for:
  - fiscal-year labeling and current/previous period selection
  - cycle-state derivation (`before_start`, `active_submission`, `cycle_complete`)
  - onboarding checklist priority and quick-action emphasis
  - cached snapshot freshness and stale-banner display metadata
- Add snapshot-builder tests for:
  - active PO counting
  - department counting
  - recent-activity truncation to 20 items
  - placeholder handling when submission/budget sources are not yet available
- Add route/auth regression tests for:
  - tenant admins can access `/tenant-admin`
  - procurement officers, department users, and platform admins are redirected away
  - pending-access and misconfigured users remain handled by the existing dashboard auth flow
- Add resilience tests for:
  - cached fallback rendering only when live query data is absent
  - removal of stale-data banners once live data returns
  - stable fiscal-year selector behavior when only one year is currently available

### Git Intelligence Summary

- Commit `83f07c3` (March 12, 2026) added the public access hub and role-aware public entry flow. The protected app shell remains intentionally minimal, which makes Story 3.2 the first true tenant-admin workspace implementation.
- Commit `507afa8` (March 10, 2026) delivered a large pricing/signup surface using a pattern of thin routes, reusable helper modules, and deterministic test coverage. Story 3.2 should follow that same pattern instead of putting all logic into one page component.
- Commit `3181fec` (March 9, 2026) introduced the audit/security foundations. The recent-activity panel should build on that audit work rather than creating a second event source.
- Commit `c782b50` (March 9, 2026) established the NestJS external-service foundation. Story 3.2 should acknowledge later billing/report integrations, but it should not call those services just to fake dashboard completeness before the tenant-admin billing/report stories exist.

### Latest Tech Information

- Verified March 14, 2026 against official documentation and the live repo:
  - Next.js App Router documentation continues to support the current page/file conventions already used in this repo, including route-page `searchParams` handling and server-first page composition.
  - Next.js authentication guidance continues to recommend keeping secure authorization decisions close to the data source, which supports using Convex guards for tenant-admin dashboard access instead of proxy-only enforcement.
  - Convex React documentation continues to position `useQuery` as the reactive data primitive for client components, which aligns with the dashboard's no-polling requirement.
  - Convex database guidance continues to recommend indexed reads via `withIndex(...)`, so dashboard aggregates should prefer explicit tenant/index access patterns over broad table scans.
  - shadcn/ui documentation continues to favor composable local components over a monolithic dashboard framework, which matches the project's current architecture and makes Story 3.2 a poor place to add a new dashboard UI dependency.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first data and auth enforcement
  - RHF + Zod for forms when inputs are present
  - shadcn/ui + Tailwind for UI
  - audit logging on state-changing operations
- Where `_bmad-output/project-context.md` conflicts with the live repo, prefer the live repo and current package versions.

### Project Structure Notes

- Current protected app routes live under `webapp/app/(app)/...`.
- Shared auth logic lives under `webapp/lib/auth/...` and `webapp/convex/functions/...`.
- Existing feature components already follow a split between `components/ui`, `src/components/auth`, and `src/components/marketing`.
- A dedicated `src/components/tenant-admin` feature area is the cleanest fit for Story 3.2 and avoids scattering dashboard-specific UI across auth or generic layout folders.

### References

- [Sprint Status](./sprint-status.yaml)
- [Epic 3 Source](./epics/epic3/epic-03-tenant-administration.md)
- [Project Context](../project-context.md)
- [PRD](../planning-artifacts/prd.md)
- [Architecture](../planning-artifacts/architecture.md)
- [UX Design](../planning-artifacts/ux-design-specification.md)
- [Tenant Admin Prototype](../../docs/html/admin-tenant.html)
- [Current Tenant Admin Route](../../webapp/app/(app)/tenant-admin/page.tsx)
- [Current Protected App Layout](../../webapp/app/(app)/layout.tsx)
- [Current Dashboard Entry Route](../../webapp/app/(app)/dashboard/page.tsx)
- [Current Role Guard](../../webapp/src/components/auth/RoleGuard.tsx)
- [Current Role Mapping Helpers](../../webapp/lib/auth/roles.ts)
- [Current Auth Context Query](../../webapp/convex/functions/users.ts)
- [Current Convex Schema](../../webapp/convex/schema.ts)
- [Current Audit Events Table Surface](../../webapp/convex/functions/auditLogs.ts)
- [Current Package Versions](../../webapp/package.json)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
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
- Epic source: `_bmad-output/implementation-artifacts/epics/epic3/epic-03-tenant-administration.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/app/(app)/tenant-admin/page.tsx`
  - `webapp/app/(app)/dashboard/page.tsx`
  - `webapp/app/(app)/layout.tsx`
  - `webapp/src/components/auth/RoleDashboardPlaceholder.tsx`
  - `webapp/src/components/auth/RoleGuard.tsx`
  - `webapp/lib/auth/roles.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/users.ts`
  - `webapp/convex/functions/tenants.ts`
  - `webapp/convex/functions/auditLogs.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/lib/security/audit.ts`
  - `webapp/app/page.tsx`
  - `webapp/app/access/page.tsx`
  - `webapp/src/components/marketing/Pricing.tsx`
  - `webapp/src/components/auth/LoginForm.tsx`
  - `webapp/src/components/auth/SignupForm.tsx`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/public-auth-entry.test.ts`
  - `webapp/tests/run-tests.ts`
- Git context:
  - `git log -5 --pretty=format:"%h %s"`
  - `git show --stat --summary --format=medium -1 83f07c3`
  - `git show --stat --summary --format=medium -1 507afa8`
  - `git show --stat --summary --format=medium -1 c782b50`
  - `git show --stat --summary --format=medium -1 3181fec`
- External validation sources:
  - `https://nextjs.org/docs/app`
  - `https://nextjs.org/docs/app/guides/authentication`
  - `https://docs.convex.dev/client/react`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://ui.shadcn.com/docs`

### Completion Notes List

- 2026-03-14: Created the implementation-ready story artifact for `3-2-tenant-admin-dashboard` from Epic 3, sprint status, architecture, PRD, UX design, project context, current code structure, and recent git history.
- 2026-03-14: Identified that `/tenant-admin` is still a placeholder route and that Story 3.2 is the first true tenant-admin application surface in the repo.
- 2026-03-14: Anchored the story to the existing protected app shell, role guard, Convex auth context, audit-log infrastructure, and current schema instead of assuming future tenant-admin modules already exist.
- 2026-03-14: Explicitly documented the gap between current available data sources and later dashboard metrics so the implementing dev can ship a truthful dashboard shell without inventing fake production data.
- 2026-03-14: Updated sprint tracking so `3-2-tenant-admin-dashboard` is `ready-for-dev` and Epic 3 is marked `in-progress`.

### File List

- `_bmad-output/implementation-artifacts/3-2-tenant-admin-dashboard.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Story Completion Status

- Story ID: `3.2`
- Story Key: `3-2-tenant-admin-dashboard`
- Output File: `_bmad-output/implementation-artifacts/3-2-tenant-admin-dashboard.md`
- Final Status: `ready-for-dev`
- Completion Note: `Ultimate context engine analysis completed - comprehensive developer guide created`
