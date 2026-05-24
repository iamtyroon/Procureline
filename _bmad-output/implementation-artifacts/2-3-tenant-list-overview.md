# Story 2.3: Tenant List Overview

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Platform Admin,
I want a searchable, filterable overview of all tenants,
so that I can quickly inspect tenant state, identify operational issues, and drill into the right tenant without relying on dashboard summary cards.

## Acceptance Criteria

1. Given a verified Platform Admin opens `/platform-admin/tenants`, when the page loads, then the existing Story 2.2 placeholder is replaced with a real tenant roster view under the protected platform-admin namespace.
2. Given the tenant roster renders, when live tenant records exist, then the list shows only real Convex-backed tenants with name, subdomain, tier, status, joined timestamp, profile completion state, primary contact where available, department count, active user count, and clear operational attention indicators.
3. Given no tenant records exist, when the page loads, then the page renders a specific empty state and does not seed, invent, or retain prototype tenant rows.
4. Given a Platform Admin searches tenants, when they type a tenant name, subdomain, or primary contact email, then the roster filters client-side or query-backed against the live snapshot without manual page refresh.
5. Given a Platform Admin applies filters, when tier, status, profile completion, or attention-state filters are selected, then the table updates predictably and exposes an obvious way to clear filters.
6. Given many tenants exist, when the list exceeds the first page, then the view supports deterministic pagination or cursor-based paging with stable sorting, and does not load unbounded cross-tenant detail unnecessarily.
7. Given tenant records change while the Platform Admin remains on the page, when Convex query results update, then the list reflects the changes reactively through `useQuery` rather than polling or a duplicate REST endpoint.
8. Given the list reads cross-tenant data, when it reads tenant-owned aggregates such as `tenantUsers` or `departments`, then it uses explicit Platform Admin guard paths and audited bypass semantics consistent with Story 2.2.
9. Given the user clicks a tenant row or a view action, when the tenant detail story is not implemented yet, then the action routes to a truthful reserved detail placeholder or disabled state, not a dead button or fake details drawer.
10. Given the `Add Tenant` action is visible from Story 2.2, when it points into `/platform-admin/tenants`, then the tenant list makes the creation path clear as reserved for Story 2.4 unless this story implements only a non-mutating CTA placeholder.
11. Given timestamps are shown, when joined or activity timestamps are rendered, then UTC is visible in the primary UI and local-time equivalents are available via hover/focus tooltip or equivalent accessible affordance.
12. Given tenant tier and status values are displayed, when values are missing, unknown, or not in the live schema union, then the UI falls back to explicit unknown/unavailable labels and never maps them to a believable healthy state.
13. Given the roster includes operational attention indicators, when status is suspended/cancelled, profile is incomplete, health data is stale, or tier usage cannot be calculated, then the row shows a truthful indicator based only on live or explicitly unavailable data.
14. Given Platform Admin actions are audited, when the tenant list snapshot is loaded or a platform-scope tenant row is inspected, then audit logs or tenant-isolation events capture the platform-admin read context where the repo’s existing bypass pattern requires it.
15. Given the user is not a Platform Admin, when they navigate to `/platform-admin/tenants`, then existing role-routing protection blocks access consistently with `/platform-admin`.

## Tasks / Subtasks

- [x] Task 1: Replace the tenant-list placeholder with a real protected page (AC: 1, 9, 10, 15)
  - [x] Keep `webapp/app/(app)/platform-admin/tenants/page.tsx` thin.
  - [x] Add a dedicated feature component such as `webapp/src/components/platform-admin/PlatformAdminTenantList.tsx`.
  - [x] Reuse the Story 2.2 platform-admin shell patterns, shadcn/ui primitives, Tailwind tokens, and `lucide-react`.
  - [x] Keep tenant creation and tenant detail flows honest as Story 2.4/2.5 reserved states unless a non-mutating route placeholder is needed.

- [x] Task 2: Add a truthful tenant-list snapshot contract (AC: 2, 3, 6, 7, 8, 12, 13, 14)
  - [x] Add or extend a focused Convex query module, preferably `webapp/convex/functions/platformAdminTenants.ts`, instead of overloading tenant-scoped functions.
  - [x] Guard every tenant-list read with `requirePlatformAdmin(ctx)`.
  - [x] Reuse the audited platform-admin cross-tenant read pattern from `platformAdminDashboard.ts` and `_tenantGuard.ts` before reading tenant-owned aggregate records.
  - [x] Aggregate only from live schema sources: `tenants`, `tenantUsers`, `departments`, `subscriptionTiers`, `platformHealthSnapshots`, `auditLogs`, `tenantIsolationEvents`, and `externalServiceSyncEvents` where relevant.
  - [x] Shape the response for stable UI use: `rows`, `summary`, `filters`, `pagination`, `meta`, and explicit availability states.

- [x] Task 3: Implement search, filters, sorting, and paging (AC: 4, 5, 6, 12, 13)
  - [x] Support search by tenant name, subdomain, and primary contact email.
  - [x] Support filters for tier, tenant status, profile completion, and attention state.
  - [x] Provide clear filter chips or controls and a single clear-all action.
  - [x] Sort deterministically by newest joined first by default, with stable secondary sort by tenant name or id.
  - [x] Use cursor-based or bounded paging when the live query can grow beyond a safe page size.

- [x] Task 4: Build tenant roster UI states and row affordances (AC: 2, 3, 9, 10, 11, 12, 13)
  - [x] Render a dense operational table suited to repeated platform-admin scanning rather than a marketing-style card grid.
  - [x] Show tier/status badges, subdomain, department count, active user count, joined timestamp, and contact metadata where available.
  - [x] Use explicit unavailable/unknown/awaiting-source labels when data is missing.
  - [x] Provide accessible timestamp tooltips with UTC primary text and local-time detail.
  - [x] Route row actions to stable reserved detail/provisioning placeholders until deeper tenant lifecycle stories land.

- [x] Task 5: Add deterministic helper modules without adding tests (AC: 2, 4, 5, 6, 11, 12, 13, 15)
  - [x] Add pure helpers such as `webapp/lib/platform-admin/tenant-list.ts` or shared equivalents for row shaping, search matching, filter predicates, attention-state derivation, timestamp labels, and pagination metadata.
  - [x] Keep helper behavior simple enough to review directly in implementation.
  - [x] Do not add new test files and do not update `webapp/tests/run-tests.ts` for this story.

## Dev Notes

### Story Foundation

- Epic 2 defines Story 2.3 as cross-tenant visibility at list level: searchable tenant index, operational health and tier status summary, filters, and a path to drill into detail.
- Story 2.2 already created the protected platform-admin dashboard shell, sidebar route map, `/platform-admin/tenants` placeholder, audited dashboard read-access token flow, live tenant summary cards, and reusable platform-admin dashboard patterns.
- This story should deepen the `All Tenants` route only. Tenant creation belongs to Story 2.4, tenant configuration/detail management belongs to Story 2.5, subscription controls belong to Story 2.6, and payment verification belongs to Story 2.7.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/platform-admin/tenants/page.tsx` currently renders `PlatformAdminRoutePlaceholder` with `Reserved for Story 2.3`.
- `webapp/src/components/platform-admin/PlatformAdminRoutePlaceholder.tsx` provides the existing reserved-route placeholder pattern.
- `webapp/src/components/platform-admin/PlatformAdminDashboard.tsx` already links `Add Tenant` and `View All` to `/platform-admin/tenants`.
- `webapp/convex/functions/platformAdminDashboard.ts` demonstrates the current platform-admin-safe pattern:
  - `requirePlatformAdmin(ctx)` gates reads and writes.
  - `issuePlatformAdminDashboardReadAccess` audits platform bypass reads for `tenants`, `tenantUsers`, and `departments`.
  - `getPlatformAdminDashboardSnapshot` verifies a short-lived read-access token before returning cross-tenant dashboard data.
- `webapp/convex/functions/tenants.ts` currently exposes tenant-scoped `getById` and mutation-based platform-admin `getByIdForPlatformAdmin`, but it is not a list-overview API.
- `webapp/convex/schema.ts` currently provides the tenant-list sources this story can safely use:
  - `tenants`: name, subdomain, tier, status, profileComplete, primary contact fields, fiscal/year/timezone/logo metadata, createdAt.
  - `tenantUsers`: tenantId, role, isActive.
  - `departments`: tenantId and isActive.
  - `subscriptionTiers`: tier metadata and active pricing catalog.
  - `platformHealthSnapshots`, `auditLogs`, `tenantIsolationEvents`, and `externalServiceSyncEvents` for truthful operational context where needed.

### Reuse And Anti-Reinvention Guidance

- Reuse Story 2.2 decomposition:
  - thin App Router page
  - dedicated client feature component
  - focused Convex query/mutation module
  - pure helper/snapshot modules
  - explicit unavailable states instead of fake business data
- Reuse `requirePlatformAdmin(ctx)` from `webapp/convex/functions/_roleGuard.ts`.
- Reuse the audited platform-admin bypass semantics from `webapp/convex/functions/_tenantGuard.ts`; do not bypass tenant isolation with unaudited broad scans.
- Reuse timestamp presentation behavior from the platform-admin dashboard helpers so UTC/local behavior remains consistent.
- Use shadcn/ui and `lucide-react`; do not add a table/grid dependency for this story.
- Keep search/filter behavior boring and deterministic. The first version should favor correctness, tenant isolation, and scannability over advanced analytics.

### Data Availability And Scope Boundaries

- Safe live fields for the roster:
  - tenant identity: `name`, `subdomain`
  - tenant commercial state: `tier`, `status`
  - setup state: `profileComplete`, primary contact fields, onboarding timestamp where present
  - joined date: `createdAt`
  - aggregate counts: active departments and active users, derived from `departments` and `tenantUsers`
- Do not fabricate:
  - invoice totals
  - overdue balances
  - payment method labels
  - storage percentages
  - detailed health percentages
  - conversion probabilities
  - support ticket counts
- It is acceptable to show `Awaiting source`, `Unavailable`, or `Reserved for Story 2.x` for deeper data not yet modeled.

### Architecture Compliance

- Follow installed versions in `webapp/package.json`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.92`
  - `lucide-react` `^0.577.0`
  - `date-fns` `^2.30.0`
  - `sonner` `^2.0.7`
- Keep authorization decisions close to the Convex data source.
- Use `useQuery` for reactive data; avoid a parallel REST endpoint.
- Keep route files thin and interactive behavior inside client components only where hooks or browser state require it.
- Continue using `proxy.ts`/existing route protection patterns; do not add `middleware.ts`.
- Preserve strict TypeScript and path-alias imports.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/platform-admin/tenants/page.tsx`
- Expected new files:
  - `webapp/src/components/platform-admin/PlatformAdminTenantList.tsx`
  - `webapp/convex/functions/platformAdminTenants.ts`
  - `webapp/lib/platform-admin/tenant-list.ts` or shared equivalent under `webapp/lib/shared/platform-admin/`
- Optional reserved route if needed:
  - `webapp/app/(app)/platform-admin/tenants/[tenantId]/page.tsx`

### Validation Requirements

- No new tests are to be made in this story.
- Do not create `webapp/tests/platform-admin-tenant-list.test.ts`.
- Do not modify `webapp/tests/run-tests.ts`.
- Validate through implementation review and existing checks only:
  - confirm `/platform-admin/tenants` remains protected for `platform_admin` only through the existing route/role map.
  - confirm platform-admin tenant-list reads call `requirePlatformAdmin(ctx)`.
  - confirm tenant-owned aggregate reads use the audited bypass pattern instead of tenant-scoped helpers.
- Run targeted validation from `webapp`:
  - `npm run lint`

### Git Intelligence Summary

- Recent commits are focused on tenant-admin report generation and consolidation Excel export, so there is no newer tenant-list implementation pattern in the last five commits.
- The strongest local implementation precedent remains Story 2.2’s platform-admin dashboard shell and earlier tenant-admin/procurement-officer dashboard snapshot patterns.

### Project Context Reference

- Apply the project-context rules that match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - shadcn/ui + Tailwind styling
  - no `alert()` or prototype-only browser feedback
  - tenant isolation on every data read
- Where planning docs conflict with the live repo, prefer the live repo:
  - routes live under `webapp/app/(app)/...`
  - Convex modules live under `webapp/convex/functions/...`
  - reusable frontend helpers currently include `webapp/lib/shared/platform-admin/...`

### References

- [Sprint Status](./sprint-status.yaml)
- [Epic 2 Source](./epics/epic2/epic-02-platform-administration.md)
- [Previous Story 2.2](./2-2-platform-admin-dashboard-shell.md)
- [Project Context](../project-context.md)
- [PRD](../planning-artifacts/prd.md)
- [Architecture](../planning-artifacts/architecture.md)
- [UX Design](../planning-artifacts/ux-design-specification.md)
- [Current Tenant Placeholder](../../webapp/app/(app)/platform-admin/tenants/page.tsx)
- [Platform Admin Dashboard](../../webapp/src/components/platform-admin/PlatformAdminDashboard.tsx)
- [Platform Admin Dashboard Query](../../webapp/convex/functions/platformAdminDashboard.ts)
- [Current Tenant Functions](../../webapp/convex/functions/tenants.ts)
- [Current Role Guard](../../webapp/convex/functions/_roleGuard.ts)
- [Current Tenant Guard](../../webapp/convex/functions/_tenantGuard.ts)
- [Current Convex Schema](../../webapp/convex/schema.ts)
- [Current Package Versions](../../webapp/package.json)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic source: `_bmad-output/implementation-artifacts/epics/epic2/epic-02-platform-administration.md`
- Previous story source: `_bmad-output/implementation-artifacts/2-2-platform-admin-dashboard-shell.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/app/(app)/platform-admin/tenants/page.tsx`
  - `webapp/src/components/platform-admin/PlatformAdminRoutePlaceholder.tsx`
  - `webapp/src/components/platform-admin/PlatformAdminDashboard.tsx`
  - `webapp/convex/functions/platformAdminDashboard.ts`
  - `webapp/convex/functions/tenants.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/_tenantGuard.ts`
  - `webapp/convex/schema.ts`
  - `webapp/package.json`
- Git context:
  - `git log --oneline -5`
- Dev-story workflow:
  - `_bmad/core/tasks/workflow.xml`
  - `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
  - `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Validation:
  - `cd webapp; npm run lint` (TypeScript passed; repo-wide ESLint failed on pre-existing unrelated files)
  - `cd webapp; npx eslint 'app/(app)/platform-admin/tenants/page.tsx' 'app/(app)/platform-admin/tenants/[tenantId]/page.tsx' 'src/components/platform-admin/PlatformAdminTenantList.tsx' 'convex/functions/platformAdminTenants.ts' 'lib/shared/platform-admin/tenant-list.ts' --ext .ts,.tsx`

### Completion Notes List

- 2026-05-24: Created the implementation-ready story artifact for `2-3-tenant-list-overview`.
- 2026-05-24: Anchored the story to the existing Story 2.2 platform-admin shell, reserved route, dashboard snapshot pattern, live tenant schema, and audited platform-admin bypass behavior.
- 2026-05-24: Scoped the story to list-level visibility only and explicitly reserved tenant creation, detailed tenant management, subscription control, and payment operations for later Epic 2 stories.
- 2026-05-24: Implemented the tenant roster page with a thin route, dedicated client component, guarded Convex snapshot query, audited tenant-list read-access mutation, deterministic shared helper shaping, search/filter controls, bounded pagination, UTC/local timestamp affordances, and reserved tenant detail/provisioning states.
- 2026-05-24: Followed the story-specific instruction not to add new tests; validation used TypeScript from `npm run lint` and targeted ESLint for the new and changed story files.
- 2026-05-24: Addressed code-review feedback by scoping platform-admin read tokens to their audited read surface, so tenant-list snapshots require a `tenant_list` token issued by the tenant-list audit mutation.

### File List

- `_bmad-output/implementation-artifacts/2-3-tenant-list-overview.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/app/(app)/platform-admin/tenants/page.tsx`
- `webapp/app/(app)/platform-admin/tenants/[tenantId]/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/functions/platformAdminTenants.ts`
- `webapp/lib/backend/platform-admin/dashboard-access-token.ts`
- `webapp/lib/shared/platform-admin/tenant-list.ts`
- `webapp/src/components/platform-admin/PlatformAdminTenantList.tsx`
- `webapp/tests/platform-admin-dashboard.test.ts`

### Story Completion Status

- Story ID: `2.3`
- Story Key: `2-3-tenant-list-overview`
- Output File: `_bmad-output/implementation-artifacts/2-3-tenant-list-overview.md`
- Final Status: `done`
- Completion Note: `Tenant list overview implemented, review feedback fixed, and validated against story constraints`
