---
title: 'Procurement Officer Lib Boundary Split'
slug: 'procurement-officer-lib-boundary-split'
created: '2026-05-05'
status: 'ready-for-development'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js', 'TypeScript', 'Convex']
files_to_modify:
  - 'webapp/lib/procurement-officer/**'
  - 'webapp/lib/department-user/**'
  - 'webapp/lib/frontend/procurement-officer/**'
  - 'webapp/lib/shared/procurement-officer/**'
  - 'webapp/lib/shared/department-user/**'
  - 'webapp/lib/backend/procurement-officer/**'
code_patterns:
  - 'Move only after checking imports for React, Next routing, DOM/window, node/server, Convex, and plain-data-only dependencies.'
  - 'Do not keep re-export shims for moved files unless a task explicitly introduces a temporary compatibility path.'
test_patterns:
  - 'Run boundary rg checks after every move group.'
  - 'Run cmd /c npm run build and record known unrelated blockers.'
---

# Tech-Spec: Procurement Officer Lib Boundary Split

**Created:** 2026-05-05

## Overview

### Problem Statement

`webapp/lib/procurement-officer` and `webapp/lib/department-user` contain mixed runtime code. Some files are browser/UI helpers, some are backend-only helpers, and some are pure domain calculations. Moving these folders wholesale would risk browser imports of backend code or Convex imports of frontend code.

### Solution

Classify each procurement and department-user helper file one by one, split mixed-runtime files first, then move only files with a verified destination into `webapp/lib/shared`, `webapp/lib/frontend`, or `webapp/lib/backend`.

### Scope

**In Scope:**
- Classify every file under `webapp/lib/procurement-officer/`.
- Classify every file under `webapp/lib/department-user/`.
- Move verified frontend-only helpers to `webapp/lib/frontend/...`.
- Move verified plain-data helpers to `webapp/lib/shared/...`.
- Move verified backend-only helpers to `webapp/lib/backend/...`.
- Update source and test imports to the new paths.
- Update `webapp/lib/MIGRATION_MAP.md`.

**Out of Scope:**
- UI behavior changes.
- Convex schema or function behavior changes.
- Rewriting procurement workflows.
- Moving already migrated `dashboard-search.ts`, `catalog-filters.ts`, `item-backend.ts`, or `webhook.ts` again if the main boundary migration has already moved them.

### Boundary Destination Rule

This split does not create a new domain-specific root such as `procurement-officer-lib/frontend` or `department-user-lib/backend`. All moved files must land under the canonical runtime roots with the domain as a subfolder:

```txt
webapp/lib/shared/procurement-officer/...
webapp/lib/frontend/procurement-officer/...
webapp/lib/backend/procurement-officer/...
webapp/lib/shared/department-user/...
webapp/lib/frontend/department-user/...
webapp/lib/backend/department-user/...
```

Use `shared` for runtime-safe data/types/calculations, `frontend` for browser/React/routing/UI helpers, and `backend` for Convex-adjacent, webhook, service, token, or server-only helpers.

## Context for Development

### Initial Classification

| Current File | Initial Destination | Notes |
| ---- | ---- | ---- |
| `webapp/lib/procurement-officer/dashboard-search.ts` | `webapp/lib/frontend/procurement-officer/dashboard-search.ts` | Already planned in main boundary migration. URL/search-param helper. |
| `webapp/lib/procurement-officer/catalog-filters.ts` | `webapp/lib/frontend/procurement-officer/catalog-filters.ts` | Already planned in main boundary migration. Catalog UI filtering/search state. |
| `webapp/lib/procurement-officer/item-backend.ts` | `webapp/lib/backend/procurement-officer/item-backend.ts` | Already planned in main boundary migration. Imports `ConvexError`. |
| `webapp/lib/procurement-officer/webhook.ts` | `webapp/lib/backend/procurement-officer/webhook.ts` | Already planned in main boundary migration. Imports `node:crypto`. |
| `webapp/lib/procurement-officer/categories.ts` | Split before moving | Imports `lucide-react`, auth role helpers, and input normalization. Extract icon/UI metadata to frontend; keep pure category rules shared. |
| `webapp/lib/procurement-officer/access-codes.ts` | `webapp/lib/shared/procurement-officer/access-codes.ts` after verification | Appears plain data, but depends on dashboard types and input normalization. Move after dependencies are shared. |
| `webapp/lib/procurement-officer/consolidation.ts` | `webapp/lib/shared/procurement-officer/consolidation.ts` after verification | Depends on dashboard types. Move after dashboard types are split. |
| `webapp/lib/procurement-officer/dashboard.ts` | Split before moving | Imports tenant-admin dashboard and dashboard-search. Extract plain types/calculations to shared; route/search composition belongs frontend. |
| `webapp/lib/procurement-officer/dashboard-snapshot.ts` | `webapp/lib/shared/procurement-officer/dashboard-snapshot.ts` after verification | Depends on dashboard/submissions types and copy. Move after those are shared. |
| `webapp/lib/procurement-officer/deadlines.ts` | `webapp/lib/shared/procurement-officer/deadlines.ts` after verification | Used by PO and DU helpers. Keep date formatting pure and runtime-safe. |
| `webapp/lib/procurement-officer/departments.ts` | Split before moving | Imports auth role helper and security input normalization. Extract schema/plain formatting to shared; route/access messaging may be frontend. |
| `webapp/lib/procurement-officer/invitations.ts` | `webapp/lib/shared/procurement-officer/invitations.ts` after verification | Depends on public-entry helpers. Move after auth/public-entry classification. |
| `webapp/lib/procurement-officer/items.ts` | Split before moving | Imports auth roles and security normalization. Extract catalog item pure helpers to shared. |
| `webapp/lib/procurement-officer/requests.ts` | `webapp/lib/shared/procurement-officer/requests.ts` after verification | Depends on shared procurement catalog requests. |
| `webapp/lib/procurement-officer/review.ts` | `webapp/lib/shared/procurement-officer/review.ts` after verification | Depends on Blockly calculations and plans submission helpers. Move only after those dependencies are shared. |
| `webapp/lib/procurement-officer/review-decision.ts` | `webapp/lib/shared/procurement-officer/review-decision.ts` after verification | Depends on deadlines. |
| `webapp/lib/procurement-officer/submission-monitoring.ts` | Split before moving | Depends on DU status tracking and plan revision deadlines. Keep derived status calculations shared; notification/service concerns backend if found. |
| `webapp/lib/procurement-officer/submissions.ts` | `webapp/lib/shared/procurement-officer/submissions.ts` after verification | Depends on departments/deadlines. Move after dependencies are shared. |
| `webapp/lib/department-user/dashboard.ts` | `webapp/lib/shared/department-user/dashboard.ts` after verification | Depends on auth access mode and PO deadlines. |
| `webapp/lib/department-user/dashboard-snapshot.ts` | `webapp/lib/shared/department-user/dashboard-snapshot.ts` after verification | Depends on DU dashboard/status helpers. |
| `webapp/lib/department-user/revision-feedback.ts` | `webapp/lib/shared/department-user/revision-feedback.ts` after verification | Depends on Blockly and PO deadlines. Move after those are shared. |
| `webapp/lib/department-user/status-tracking.ts` | `webapp/lib/shared/department-user/status-tracking.ts` after verification | Depends on PO deadlines and plan submission helpers. |

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `webapp/lib/MIGRATION_MAP.md` | Canonical boundary migration status. |
| `webapp/lib/procurement-officer/categories.ts` | Known mixed helper with `lucide-react` import. |
| `webapp/lib/procurement-officer/item-backend.ts` | Backend-only pattern because it imports Convex runtime types/errors. |
| `webapp/lib/procurement-officer/webhook.ts` | Backend-only pattern because it imports `node:crypto`. |
| `webapp/src/components/procurement-officer/**` | Main frontend import consumers. |
| `webapp/convex/**` | Backend import consumers. Must not import `@/lib/frontend`. |

## Implementation Plan

### Tasks

1. Inventory imports.
   - File: all files under `webapp/lib/procurement-officer/` and `webapp/lib/department-user/`.
   - Action: For each file, record whether it imports React, `lucide-react`, Next APIs, DOM/window APIs, Convex/server APIs, node built-ins, or only plain-data helpers.

2. Split `webapp/lib/procurement-officer/categories.ts`.
   - Action: Move icon/UI metadata that imports `lucide-react` to `webapp/lib/frontend/procurement-officer/categories.ts`.
   - Action: Move pure category status, validation, and formatting helpers to `webapp/lib/shared/procurement-officer/categories.ts`.
   - Action: Update consumers to import from the runtime-appropriate path.

3. Split `webapp/lib/procurement-officer/dashboard.ts`.
   - Action: Move route/search-param composition to `webapp/lib/frontend/procurement-officer/dashboard.ts`.
   - Action: Move plain dashboard data types/calculations to `webapp/lib/shared/procurement-officer/dashboard.ts`.
   - Action: Update imports in `webapp/src/components/procurement-officer/**` and any tests.

4. Split `webapp/lib/procurement-officer/departments.ts` and `webapp/lib/procurement-officer/items.ts`.
   - Action: Move pure validators, formatting, and data transformations to `webapp/lib/shared/procurement-officer/`.
   - Action: Keep route/access messaging or UI-only presentation in `webapp/lib/frontend/procurement-officer/`.
   - Action: Ensure backend/Convex files import only shared helpers.

5. Move verified plain procurement helpers.
   - Files: `access-codes.ts`, `consolidation.ts`, `dashboard-snapshot.ts`, `deadlines.ts`, `invitations.ts`, `requests.ts`, `review.ts`, `review-decision.ts`, `submission-monitoring.ts`, `submissions.ts`.
   - Action: Move each file to `webapp/lib/shared/procurement-officer/` only after its dependencies no longer point at frontend/backend-only modules.

6. Move verified department-user helpers.
   - Files: `dashboard.ts`, `dashboard-snapshot.ts`, `revision-feedback.ts`, `status-tracking.ts`.
   - Action: Move each file to `webapp/lib/shared/department-user/` only after its dependencies are shared-safe.

7. Update imports and remove old files.
   - Action: Replace stale `@/lib/procurement-officer/...` and `@/lib/department-user/...` imports with `@/lib/shared/...`, `@/lib/frontend/...`, or `@/lib/backend/...`.
   - Action: Do not leave re-export shims in the old locations.

8. Update `webapp/lib/MIGRATION_MAP.md`.
   - Action: Move completed files from Deferred/Planned sections into Already Migrated.
   - Action: Leave unresolved mixed files listed under Deferred with a reason.

## Acceptance Criteria

- [ ] AC 1: Given any moved procurement officer helper, when its imports are inspected, then it imports only runtime-compatible modules for its new `lib/shared`, `lib/frontend`, or `lib/backend` destination.
- [ ] AC 2: Given any moved department-user helper, when its imports are inspected, then it imports only runtime-compatible modules for its new destination.
- [ ] AC 3: Given `webapp/convex` is searched, when imports are checked, then no file imports from `@/lib/frontend/`.
- [ ] AC 4: Given `webapp/src` is searched, when imports are checked, then browser UI components do not import from `@/lib/backend/`.
- [ ] AC 5: Given stale root-level procurement imports are searched, when `rg "@/lib/procurement-officer/" webapp` runs, then only intentionally deferred files remain.
- [ ] AC 6: Given stale root-level department-user imports are searched, when `rg "@/lib/department-user/" webapp` runs, then only intentionally deferred files remain.

## Additional Context

### Testing Strategy

Run:

```bash
git diff --check
rg "@/lib/frontend/" webapp/convex --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
rg "@/lib/backend/" webapp/src webapp/app --glob '!app/api/**' --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
cmd /c npm run build
cmd /c npm test
```

Known unrelated blockers may remain: `webapp/convex/functions/plans.ts:543` for build and `webapp/convex/auth.ts(1,28)` for tests.
