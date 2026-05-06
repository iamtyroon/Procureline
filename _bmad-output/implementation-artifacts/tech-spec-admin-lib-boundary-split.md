---
title: 'Admin Lib Boundary Split'
slug: 'admin-lib-boundary-split'
created: '2026-05-05'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js', 'TypeScript', 'Convex']
files_to_modify:
  - 'webapp/lib/tenant-admin/**'
  - 'webapp/lib/platform-admin/**'
  - 'webapp/lib/shared/tenant-admin/**'
  - 'webapp/lib/shared/platform-admin/**'
  - 'webapp/lib/frontend/tenant-admin/**'
  - 'webapp/lib/frontend/platform-admin/**'
  - 'webapp/lib/backend/tenant-admin/**'
  - 'webapp/lib/backend/platform-admin/**'
code_patterns:
  - 'Next headers helpers are backend-only.'
  - 'Dashboard snapshots and pricing/risk data may be shared only after imports are runtime-safe.'
test_patterns:
  - 'Run boundary rg checks for frontend/backend imports.'
---

# Tech-Spec: Admin Lib Boundary Split

**Created:** 2026-05-05

## Overview

### Problem Statement

`webapp/lib/tenant-admin` and `webapp/lib/platform-admin` contain admin dashboard helpers, onboarding helpers, request-context/token helpers, risk/auth helpers, and cache helpers under one root-level `lib` namespace. The runtime boundary is unclear, especially where Next server APIs and backend-only onboarding/token utilities sit beside plain dashboard data helpers.

### Solution

Classify tenant-admin and platform-admin helpers one by one, split mixed server/shared files, move verified dashboard/domain data helpers to `lib/shared`, frontend presentation helpers to `lib/frontend`, and request-context/token/backend helpers to `lib/backend`.

### Scope

**In Scope:**
- Classify every file under `webapp/lib/tenant-admin/`.
- Classify every file under `webapp/lib/platform-admin/`.
- Move already planned backend onboarding helper to `lib/backend/tenant-admin/onboarding.ts` if not already moved.
- Move verified dashboard/snapshot data helpers to shared paths.
- Move request-context, token, cache, and server-only admin helpers to backend paths.
- Update source and test imports.

**Out of Scope:**
- Changing admin dashboard behavior.
- Changing platform admin auth/session behavior.
- Changing onboarding business rules.
- Changing cache semantics beyond import paths.

### Boundary Destination Rule

This split does not create a new domain-specific root such as `admin-lib/frontend`, `tenant-admin-lib/backend`, or `platform-admin-lib/shared`. All moved files must land under the canonical runtime roots with the admin domain as a subfolder:

```txt
webapp/lib/shared/tenant-admin/...
webapp/lib/frontend/tenant-admin/...
webapp/lib/backend/tenant-admin/...
webapp/lib/shared/platform-admin/...
webapp/lib/frontend/platform-admin/...
webapp/lib/backend/platform-admin/...
```

Use `shared` for runtime-safe dashboard data, types, constants, and pure admin domain calculations. Use `frontend` for browser/React/routing/UI helpers. Use `backend` for Next server request context, token/signing, cache, onboarding backend, security, service, or Convex-adjacent helpers.

## Context for Development

### Initial Classification

| Current File | Initial Destination | Notes |
| ---- | ---- | ---- |
| `webapp/lib/tenant-admin/onboarding-backend.ts` | `webapp/lib/backend/tenant-admin/onboarding.ts` | Already planned in main boundary migration. Imports audit/security/platform risk helpers. |
| `webapp/lib/tenant-admin/onboarding.ts` | `webapp/lib/shared/tenant-admin/onboarding.ts` after verification | Likely pure onboarding state/types. |
| `webapp/lib/tenant-admin/invitations.ts` | `webapp/lib/shared/tenant-admin/invitations.ts` after verification | Invitation domain data. Verify no backend token/service imports. |
| `webapp/lib/tenant-admin/institutional-visibility.ts` | `webapp/lib/shared/tenant-admin/institutional-visibility.ts` after verification | Depends on PO submission monitoring and tenant dashboard date helpers. |
| `webapp/lib/tenant-admin/dashboard.ts` | Split before moving | Imports `date-fns`. Pure dashboard calculations can be shared; UI copy can remain shared if runtime-safe. |
| `webapp/lib/tenant-admin/dashboard-snapshot.ts` | `webapp/lib/shared/tenant-admin/dashboard-snapshot.ts` after verification | Depends on dashboard and institutional visibility. |
| `webapp/lib/tenant-admin/dashboard-cache.ts` | `webapp/lib/backend/tenant-admin/dashboard-cache.ts` after verification | Cache helper. Treat as backend unless proven pure. |
| `webapp/lib/platform-admin/request-context.ts` | `webapp/lib/backend/platform-admin/request-context.ts` | Imports `next/headers`. Server-only. |
| `webapp/lib/platform-admin/request-context-token.ts` | `webapp/lib/backend/platform-admin/request-context-token.ts` after verification | Token helper. Backend/security. |
| `webapp/lib/platform-admin/dashboard-access-token.ts` | `webapp/lib/backend/platform-admin/dashboard-access-token.ts` after verification | Token/access helper. Backend/security unless proven pure constants only. |
| `webapp/lib/platform-admin/auth.ts` | Split before moving | Auth stage constants may be shared; request/session enforcement may be backend/frontend-specific. |
| `webapp/lib/platform-admin/risk.ts` | Split before moving | Exports `sha256Hex` used by backend onboarding; risk DTOs may be shared, crypto/hash helpers backend. |
| `webapp/lib/platform-admin/dashboard.ts` | `webapp/lib/shared/platform-admin/dashboard.ts` after verification | Imports shared pricing presentation. Move after pricing is in shared path. |
| `webapp/lib/platform-admin/dashboard-snapshot.ts` | `webapp/lib/shared/platform-admin/dashboard-snapshot.ts` after verification | Depends on dashboard. |

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `webapp/lib/platform-admin/request-context.ts` | Known backend-only pattern via `next/headers`. |
| `webapp/lib/tenant-admin/onboarding-backend.ts` | Known backend-only helper from main boundary migration. |
| `webapp/lib/platform-admin/risk.ts` | Known mixed helper because `sha256Hex` is used by backend onboarding. |
| `webapp/src/components/tenant-admin/**` | Tenant admin frontend consumers. |
| `webapp/src/components/platform-admin/**` | Platform admin frontend consumers. |
| `webapp/app/api/**` | Allowed backend consumers. |

## Implementation Plan

### Tasks

1. Inventory admin imports and consumers.
   - File: all files under `webapp/lib/tenant-admin/` and `webapp/lib/platform-admin/`.
   - Action: Record imports from `next/headers`, node crypto, cache APIs, React/UI, pricing/shared helpers, auth/security helpers, and dashboard consumers.
   - Action: Record consumers with `rg "@/lib/tenant-admin/|@/lib/platform-admin/" webapp`.

2. Move backend-only admin helpers.
   - Files: `tenant-admin/onboarding-backend.ts`, `platform-admin/request-context.ts`, `platform-admin/request-context-token.ts`, `platform-admin/dashboard-access-token.ts`, `tenant-admin/dashboard-cache.ts`.
   - Action: Move verified backend-only files to `webapp/lib/backend/tenant-admin/` or `webapp/lib/backend/platform-admin/`.
   - Action: Rename `onboarding-backend.ts` to `webapp/lib/backend/tenant-admin/onboarding.ts`.
   - Action: Update API, Convex, and backend-helper imports.

3. Split platform admin auth/risk helpers.
   - Files: `platform-admin/auth.ts`, `platform-admin/risk.ts`.
   - Action: Move pure auth stage constants, risk types, and dashboard-safe helpers to `webapp/lib/shared/platform-admin/`.
   - Action: Move hash/token/security helpers such as `sha256Hex` to `webapp/lib/backend/platform-admin/risk.ts` if they depend on backend runtime or security concerns.
   - Action: Update `tenant-admin/onboarding-backend` imports to the new backend/shared paths.

4. Move tenant admin shared dashboard/domain helpers.
   - Files: `onboarding.ts`, `invitations.ts`, `institutional-visibility.ts`, `dashboard.ts`, `dashboard-snapshot.ts`.
   - Action: Move each verified runtime-safe file to `webapp/lib/shared/tenant-admin/`.
   - Action: Split any frontend-only presentation or route/search logic to `webapp/lib/frontend/tenant-admin/`.

5. Move platform admin shared dashboard helpers.
   - Files: `dashboard.ts`, `dashboard-snapshot.ts`.
   - Action: Move each verified runtime-safe file to `webapp/lib/shared/platform-admin/`.
   - Action: Ensure pricing imports use `@/lib/shared/marketing/pricing` if the main migration has moved pricing.

6. Update imports and remove old files.
   - Action: Replace `@/lib/tenant-admin/...` and `@/lib/platform-admin/...` imports with boundary paths.
   - Action: Do not leave root-level re-export shims.

7. Update `webapp/lib/MIGRATION_MAP.md`.
   - Action: Mark completed admin moves under Already Migrated.
   - Action: Keep unresolved mixed helpers under Deferred with the coupling reason.

## Acceptance Criteria

- [x] AC 1: Given a file under `webapp/lib/backend/platform-admin` or `webapp/lib/backend/tenant-admin`, when consumers are searched, then browser UI components do not import it.
- [x] AC 2: Given a file under `webapp/lib/shared/platform-admin` or `webapp/lib/shared/tenant-admin`, when imports are inspected, then it does not import Next server APIs, React, DOM/window APIs, node-only APIs, Convex server context, or service credentials.
- [x] AC 3: Given `platform-admin/request-context.ts` is moved, when imports are inspected, then it lives under `webapp/lib/backend/platform-admin/` because it imports `next/headers`.
- [x] AC 4: Given `tenant-admin/onboarding-backend.ts` is moved, when imports are inspected, then consumers use `@/lib/backend/tenant-admin/onboarding`.
- [x] AC 5: Given stale admin imports are searched, when source imports are checked, then only intentionally deferred root-level imports remain.
- [x] AC 6: Given `cmd /c npm run build` runs, when frontend compilation reaches TypeScript, then no missing admin helper module errors are introduced.

## Additional Context

### Testing Strategy

Run:

```bash
git diff --check
rg "@/lib/backend/" webapp/src webapp/app --glob '!app/api/**' --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
rg "@/lib/tenant-admin/" webapp --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
rg "@/lib/platform-admin/" webapp --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
cmd /c npm run build
cmd /c npm test
```

Known unrelated blockers may remain: `webapp/convex/functions/plans.ts:543` for build and `webapp/convex/auth.ts(1,28)` for tests.

## Review Notes

- Adversarial review completed.
- Findings: 10 total, 6 fixed or documented, 4 skipped as known unrelated/noise.
- Resolution approach: auto-fix.
- Fixed: shared tenant-admin no longer imports root procurement-officer monitoring; pricing moved to `webapp/lib/shared/marketing/pricing.ts`; empty root admin/marketing directories removed where present; dashboard cache frontend placement documented; migration map updated.
- Skipped: known unrelated build/test blockers and Git line-ending warnings.
