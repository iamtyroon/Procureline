---
title: 'Blockly Lib Boundary Split'
slug: 'blockly-lib-boundary-split'
created: '2026-05-05'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js', 'TypeScript', 'Google Blockly']
files_to_modify:
  - 'webapp/lib/blockly/**'
  - 'webapp/lib/shared/blockly/**'
  - 'webapp/lib/frontend/blockly/**'
code_patterns:
  - 'Blockly runtime/editor APIs belong in frontend helpers.'
  - 'Workspace JSON parsing, validation, calculations, and DTO contracts can be shared only if they do not import Blockly runtime, DOM, React, or Next APIs.'
test_patterns:
  - 'Keep deterministic calculations covered by tests where present.'
---

# Tech-Spec: Blockly Lib Boundary Split

**Created:** 2026-05-05

## Overview

### Problem Statement

`webapp/lib/blockly` contains both Blockly runtime/editor helpers and pure workspace domain helpers. Because Blockly is browser-heavy and bundle-sensitive, importing runtime code from shared/backend paths would create runtime and build risks.

### Solution

Split Blockly helpers by runtime: keep editor/runtime/toolbox/UI state helpers in `webapp/lib/frontend/blockly`, and move runtime-safe workspace serialization, validation, plan submission, catalog identity, and calculations to `webapp/lib/shared/blockly`.

### Scope

**In Scope:**
- Classify every file under `webapp/lib/blockly/`.
- Move pure JSON/DTO/calculation helpers to `lib/shared/blockly`.
- Move Blockly runtime/editor/toolbox/UI helpers to `lib/frontend/blockly`.
- Update component, test, and domain imports.
- Ensure Convex/backend code does not import frontend Blockly helpers.

**Out of Scope:**
- Changing Blockly block behavior or UI.
- Changing saved workspace JSON shape.
- Changing plan submission rules.
- Loading Blockly in backend/server contexts.

### Boundary Destination Rule

This split does not create a new domain-specific root such as `blockly-lib/frontend` or `blockly-lib/shared`. All moved files must land under the canonical runtime roots with `blockly` as a subfolder:

```txt
webapp/lib/shared/blockly/...
webapp/lib/frontend/blockly/...
webapp/lib/backend/blockly/...
```

Use `shared` for runtime-safe workspace JSON, DTOs, validation, calculations, and plan-state rules. Use `frontend` for Blockly runtime/editor/toolbox/UI/event helpers. `backend/blockly` should remain empty unless a future file is proven server-only; Blockly runtime code must not be imported by backend or Convex code.

## Context for Development

### Initial Classification

| Current File | Initial Destination | Notes |
| ---- | ---- | ---- |
| `webapp/lib/blockly/block-definitions.ts` | `webapp/lib/frontend/blockly/block-definitions.ts` | Main boundary plan lists as frontend. Verify whether it imports Blockly runtime or UI block definitions. |
| `webapp/lib/blockly/du-toolbox.ts` | `webapp/lib/frontend/blockly/du-toolbox.ts` | Main boundary plan lists as frontend. Imports category toolbox style. |
| `webapp/lib/blockly/workspace-runtime.ts` | `webapp/lib/frontend/blockly/workspace-runtime.ts` | Main boundary plan lists as frontend. Runtime/editor concern. |
| `webapp/lib/blockly/workspace-ui-state.ts` | `webapp/lib/frontend/blockly/workspace-ui-state.ts` after verification | UI state concern. |
| `webapp/lib/blockly/workspace-events.ts` | `webapp/lib/frontend/blockly/workspace-events.ts` after verification | Event/runtime concern. |
| `webapp/lib/blockly/du-editor-fallback.ts` | `webapp/lib/frontend/blockly/du-editor-fallback.ts` after verification | Editor fallback likely UI-facing. |
| `webapp/lib/blockly/blockly-serialization.ts` | `webapp/lib/shared/blockly/blockly-serialization.ts` after verification | Shared if it only parses/serializes JSON and does not import Blockly runtime. |
| `webapp/lib/blockly/du-workspace-calculations.ts` | `webapp/lib/shared/blockly/du-workspace-calculations.ts` after verification | Depends on serialization, catalog identity, compliance, validation, plan submission, draft queue types. |
| `webapp/lib/blockly/editor-contract.ts` | `webapp/lib/shared/blockly/editor-contract.ts` after verification | Contract/types can be shared if no runtime imports. |
| `webapp/lib/blockly/plan-submission.ts` | `webapp/lib/shared/blockly/plan-submission.ts` after verification | Depends on calculations, draft queue types, validation. |
| `webapp/lib/blockly/workspace-catalog-identity.ts` | `webapp/lib/shared/blockly/workspace-catalog-identity.ts` after verification | Depends on serialization and procurement compliance. |
| `webapp/lib/blockly/workspace-draft-queue.ts` | Split before moving | Queue state may be frontend if tied to local browser saves; pure type/calculation portions can be shared. |
| `webapp/lib/blockly/workspace-save.ts` | Split before moving | Save orchestration may be frontend/runtime-specific; pure save payload creation can be shared. |
| `webapp/lib/blockly/workspace-validation.ts` | `webapp/lib/shared/blockly/workspace-validation.ts` after verification | Depends on procurement item helpers. Move after those helpers are shared-safe. |
| `webapp/lib/blockly/du-plan-routes.ts` | `webapp/lib/frontend/blockly/du-plan-routes.ts` or split | Route/editability messaging may be frontend; pure access-mode rules can be shared. |

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `webapp/src/components/blockly/**` | Main frontend consumers. |
| `webapp/lib/blockly/workspace-runtime.ts` | Known frontend/runtime target. |
| `webapp/lib/blockly/du-workspace-calculations.ts` | Shared calculation candidate. |
| `webapp/lib/blockly/workspace-save.ts` | Known mixed candidate. |
| `webapp/lib/procurement/compliance.ts` | Shared dependency once main boundary migration moves it. |
| `webapp/lib/procurement-officer/items.ts` | Dependency that must be split before shared Blockly validation can move safely. |

## Implementation Plan

### Tasks

1. [x] Inventory Blockly imports and consumers.
   - File: all files under `webapp/lib/blockly/`.
   - Action: Record imports from Blockly runtime packages, React, DOM/window, Next APIs, Convex, procurement helpers, and plan helpers.
   - Action: Record consumers with `rg "@/lib/blockly/" webapp`.

2. [x] Move frontend runtime helpers.
   - Files: `block-definitions.ts`, `du-toolbox.ts`, `workspace-runtime.ts`, `workspace-ui-state.ts`, `workspace-events.ts`, `du-editor-fallback.ts`.
   - Action: Move verified frontend-only files to `webapp/lib/frontend/blockly/`.
   - Action: Update component imports.

3. [x] Split route/editability helper.
   - File: `du-plan-routes.ts`.
   - Action: Move route construction/search behavior to `webapp/lib/frontend/blockly/du-plan-routes.ts`.
   - Action: Move pure access-mode/editability rules to `webapp/lib/shared/blockly/du-plan-rules.ts` if needed by non-frontend code.

4. [x] Split draft/save helpers.
   - Files: `workspace-draft-queue.ts`, `workspace-save.ts`.
   - Action: Move browser state, debounce, or local queue helpers to `webapp/lib/frontend/blockly/`.
   - Action: Move pure save payload and workspace summary transformations to `webapp/lib/shared/blockly/`.

5. [x] Move shared JSON/calculation helpers.
   - Files: `blockly-serialization.ts`, `du-workspace-calculations.ts`, `editor-contract.ts`, `plan-submission.ts`, `workspace-catalog-identity.ts`, `workspace-validation.ts`.
   - Action: Move to `webapp/lib/shared/blockly/` only after dependencies point at `webapp/lib/shared/...` paths.
   - Action: Update tests and domain consumers.

6. [x] Update imports and remove old files.
   - Action: Replace `@/lib/blockly/...` imports with boundary paths.
   - Action: Do not leave root-level re-export shims.

7. [x] Update `webapp/lib/MIGRATION_MAP.md`.
   - Action: Mark completed Blockly moves under Already Migrated.
   - Action: Keep unresolved mixed helpers under Deferred with the coupling reason.

## Acceptance Criteria

- [ ] AC 1: Given a file under `webapp/lib/shared/blockly`, when imports are inspected, then it does not import Blockly runtime/editor APIs, React, DOM/window APIs, Next APIs, Convex server context, or node-only APIs.
- [ ] AC 2: Given a file under `webapp/lib/frontend/blockly`, when consumers are searched, then it is not imported by `webapp/convex` or backend helpers.
- [ ] AC 3: Given workspace JSON helpers are moved, when existing workspace serialization tests or source assertions run, then saved workspace shape is unchanged.
- [ ] AC 4: Given old Blockly paths are searched, when `rg "@/lib/blockly/" webapp` runs, then only intentionally deferred root-level imports remain.
- [ ] AC 5: Given `cmd /c npm run build` runs, when frontend compilation reaches TypeScript, then no missing Blockly module errors are introduced.

## Additional Context

### Testing Strategy

Run:

```bash
git diff --check
rg "@/lib/frontend/blockly" webapp/convex --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
rg "@/lib/blockly/" webapp --glob '!node_modules/**' --glob '!.next/**' --glob '!.test-dist/**'
cmd /c npm run build
cmd /c npm test
```

Known unrelated blockers may remain: `webapp/convex/functions/plans.ts:543` for build and `webapp/convex/auth.ts(1,28)` for tests.

## Review Notes

- Adversarial review completed.
- Findings: 10 total, 4 real boundary findings fixed, 6 noise/low-risk findings reviewed.
- Resolution approach: auto-fix requested by user.
