---
title: 'Auth Security Lib Boundary Split'
slug: 'auth-security-lib-boundary-split'
created: '2026-05-05'
status: 'ready-for-development'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js', 'TypeScript', 'Convex']
files_to_modify:
  - 'webapp/lib/auth/**'
  - 'webapp/lib/security/**'
  - 'webapp/lib/shared/auth/**'
  - 'webapp/lib/shared/security/**'
  - 'webapp/lib/frontend/auth/**'
  - 'webapp/lib/backend/auth/**'
  - 'webapp/lib/backend/security/**'
code_patterns:
  - 'Next headers/request-context helpers are backend-only.'
  - 'Pure role constants, public-route constants, and validation helpers can be shared only when they import no runtime APIs.'
test_patterns:
  - 'Run boundary rg checks for frontend/backend imports.'
---

# Tech-Spec: Auth Security Lib Boundary Split

**Created:** 2026-05-05

## Overview

### Problem Statement

`webapp/lib/auth` and `webapp/lib/security` mix public route metadata, role/session helpers, Next server request-context helpers, token/security utilities, and plain validation logic. This makes it unclear what can be imported by UI components, middleware, API routes, or Convex functions.

### Solution

Classify each auth/security helper by runtime, split files that combine public UI/navigation data with server request-context or security concerns, and move only verified files into `lib/shared`, `lib/frontend`, or `lib/backend`.

### Scope

**In Scope:**
- Classify every file under `webapp/lib/auth/`.
- Classify every file under `webapp/lib/security/`.
- Move shared route/role/type/validation helpers when runtime-safe.
- Move Next headers, token signing, server request-context, and audit/security backend helpers to `lib/backend`.
- Keep frontend-only entry/search/display helpers under `lib/frontend`.
- Update source and test imports.

**Out of Scope:**
- Changing authentication behavior.
- Changing session expiry rules.
- Changing Convex Auth provider configuration.
- Fixing the known CommonJS/ESM test compile blocker in `webapp/convex/auth.ts`.

### Boundary Destination Rule

This split does not create new domain-specific roots such as `auth-lib/frontend`, `security-lib/backend`, or any sibling package. All moved files must land under the canonical runtime roots with the domain as a subfolder:

```txt
webapp/lib/shared/auth/...
webapp/lib/frontend/auth/...
webapp/lib/backend/auth/...
webapp/lib/shared/security/...
webapp/lib/frontend/security/...
webapp/lib/backend/security/...
```

Use `shared` for runtime-safe constants/types/validation, `frontend` only for browser/session presentation or route-entry helpers, and `backend` for request context, token/signing, audit execution, origin enforcement, tenant isolation, or server-only helpers. `frontend/security` should remain empty unless a file is genuinely browser/UI-specific.

## Context for Development

### Initial Classification

| Current File | Initial Destination | Notes |
| ---- | ---- | ---- |
| `webapp/lib/auth/department-user-request-context.ts` | `webapp/lib/backend/auth/department-user-request-context.ts` | Imports `next/headers`. Server-only. |
| `webapp/lib/auth/department-user-request-context-token.ts` | `webapp/lib/backend/auth/department-user-request-context-token.ts` after verification | Token helper. Treat as backend/security unless it has no server-only implementation dependency. |
| `webapp/lib/auth/department-user-access.ts` | `webapp/lib/shared/auth/department-user-access.ts` after verification | Access mode/types used by DU and Blockly helpers. |
| `webapp/lib/auth/password-reset.ts` | `webapp/lib/shared/auth/password-reset.ts` after verification | Uses security input normalization. Move after dependency is shared-safe. |
| `webapp/lib/auth/proxy.ts` | `webapp/lib/backend/auth/proxy.ts` or split | Proxy/middleware-adjacent naming. Inspect for Next/middleware-only APIs before moving. |
| `webapp/lib/auth/public-entry.ts` | Split before moving | Imports app constants, marketing pricing, proxy constants, role snapshots, and platform admin auth. Separate public entry copy/data from routing/session logic. |
| `webapp/lib/auth/public-routes.ts` | `webapp/lib/shared/auth/public-routes.ts` after verification | Route constants can be shared if no Next runtime import. |
| `webapp/lib/auth/roles.ts` | Split before moving | Imports session and platform/tenant admin helpers. Extract pure role constants and dashboard path helpers to shared; runtime session checks may be frontend/backend-specific. |
| `webapp/lib/auth/session.ts` | `webapp/lib/frontend/auth/session.ts` or split | Main boundary plan lists this as frontend. Verify no backend callers require it before moving. |
| `webapp/lib/auth/signup-flow.ts` | `webapp/lib/shared/auth/signup-flow.ts` after verification | Depends on pricing types. Shared if pure data. |
| `webapp/lib/auth/tenant-isolation.ts` | `webapp/lib/backend/auth/tenant-isolation.ts` after verification | Audit/security concern. Backend-only unless purely types/constants. |
| `webapp/lib/security/audit.ts` | `webapp/lib/shared/security/audit.ts` or `webapp/lib/backend/security/audit.ts` after inspection | Event constants can be shared; audit execution belongs backend. |
| `webapp/lib/security/bridge.ts` | `webapp/lib/backend/security/bridge.ts` after verification | Security integration naming implies backend. Inspect before moving. |
| `webapp/lib/security/input.ts` | Split before moving | Imports Zod, audit outcomes, and DU access types. Keep pure input normalization shared; audit-specific validation backend if coupled. |
| `webapp/lib/security/origins.ts` | `webapp/lib/backend/security/origins.ts` after verification | Origin enforcement is backend/security. Constants may be shared only if pure. |
| `webapp/lib/security/policy.ts` | `webapp/lib/shared/security/policy.ts` after verification | Policy constants can be shared if pure. |

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `webapp/lib/auth/department-user-request-context.ts` | Known server-only pattern via `next/headers`. |
| `webapp/lib/auth/public-entry.ts` | Known mixed helper requiring split. |
| `webapp/lib/security/input.ts` | Known shared/backend boundary candidate. |
| `webapp/convex/auth.ts` | Known unrelated test blocker reference only. |
| `webapp/proxy.ts` | Likely auth/proxy consumer. |
| `webapp/app/api/**` | Backend/API route consumers. |

## Implementation Plan

### Tasks

1. Inventory auth/security imports and consumers.
   - File: all files under `webapp/lib/auth/` and `webapp/lib/security/`.
   - Action: Record imports from `next/headers`, middleware APIs, node built-ins, Convex, React, app constants, and domain helpers.
   - Action: Record consumers with `rg "@/lib/auth/|@/lib/security/" webapp`.

2. Move server request-context helpers.
   - Files: `department-user-request-context.ts`, `department-user-request-context-token.ts`.
   - Action: Move to `webapp/lib/backend/auth/`.
   - Action: Update API/server consumers only.
   - Action: Confirm no `webapp/src` UI component imports the backend path.

3. Split public auth entry/routing helpers.
   - File: `webapp/lib/auth/public-entry.ts`.
   - Action: Move pure role entry metadata and copy to `webapp/lib/shared/auth/public-entry.ts` if runtime-safe.
   - Action: Move route/search/session decisions to `webapp/lib/frontend/auth/public-entry.ts` or `webapp/lib/backend/auth/public-entry.ts` based on consumers.
   - Action: Keep `SESSION_EXPIRED_REDIRECT_PATH` import from a runtime-compatible module.

4. Split role/session helpers.
   - Files: `roles.ts`, `session.ts`, `public-routes.ts`, `signup-flow.ts`, `department-user-access.ts`.
   - Action: Move pure role constants, route maps, access-mode types, and signup tier logic to `webapp/lib/shared/auth/`.
   - Action: Move frontend session presentation helpers to `webapp/lib/frontend/auth/session.ts`.
   - Action: Move server enforcement helpers to `webapp/lib/backend/auth/`.

5. Split security helpers.
   - Files: `audit.ts`, `bridge.ts`, `input.ts`, `origins.ts`, `policy.ts`, `tenant-isolation.ts`.
   - Action: Move audit event/outcome constants and pure input normalization to `webapp/lib/shared/security/`.
   - Action: Move origin enforcement, bridge utilities, tenant isolation, and backend-only policy execution to `webapp/lib/backend/security/`.

6. Update imports and remove old files.
   - Action: Replace `@/lib/auth/...` and `@/lib/security/...` imports with boundary paths.
   - Action: Do not keep root-level re-export shims.

7. Update `webapp/lib/MIGRATION_MAP.md`.
   - Action: Mark completed auth/security moves under Already Migrated.
   - Action: Keep any unresolved mixed helper under Deferred with the remaining coupling noted.

## Acceptance Criteria

- [ ] AC 1: Given a file under `webapp/lib/shared/auth` or `webapp/lib/shared/security`, when imports are inspected, then it does not import Next server APIs, React, DOM/window APIs, node-only APIs, Convex server context, or service credentials.
- [ ] AC 2: Given `webapp/lib/backend/auth` or `webapp/lib/backend/security` is imported, when consumers are searched, then imports appear only in backend/server contexts such as `webapp/app/api`, `webapp/proxy.ts`, `webapp/convex`, or other backend helpers.
- [ ] AC 3: Given UI components are searched, when `rg "@/lib/backend/" webapp/src webapp/app --glob '!app/api/**'` runs, then no browser UI imports backend auth/security helpers.
- [ ] AC 4: Given old auth/security paths are searched, when source imports are checked, then only intentionally deferred root-level imports remain.
- [ ] AC 5: Given `cmd /c npm run build` runs, when frontend compilation reaches TypeScript, then no missing auth/security module errors are introduced.

## Additional Context

### Testing Strategy

Run:

```bash
git diff --check
rg "@/lib/frontend/" webapp/convex --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
rg "@/lib/backend/" webapp/src webapp/app --glob '!app/api/**' --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
rg "@/lib/auth/" webapp --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
rg "@/lib/security/" webapp --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
cmd /c npm run build
cmd /c npm test
```

Known unrelated blockers may remain: `webapp/convex/functions/plans.ts:543` for build and `webapp/convex/auth.ts(1,28)` for tests.
