---
title: 'Fix Test Build Module Mode Mismatch'
slug: 'fix-test-build-module-mode-mismatch'
created: '2026-04-28'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript 5.x'
  - 'Next.js 16'
  - 'NodeNext test compilation'
  - 'Convex'
  - '@convex-dev/auth'
files_to_modify:
  - 'webapp/tsconfig.tests.json'
  - 'webapp/package.json'
  - 'webapp/convex/auth.ts'
  - 'webapp/convex/schema.ts'
  - 'webapp/convex/functions/_roleGuard.ts'
  - 'webapp/tests/run-tests.ts'
code_patterns:
  - 'Frontend uses moduleResolution=bundler in app builds and NodeNext in test builds'
  - 'Convex/auth source files are plain .ts files imported by the test compiler'
  - 'Tests compile to .test-dist before execution'
test_patterns:
  - 'npm test runs tsc -p tsconfig.tests.json before node .test-dist/tests/run-tests.js'
  - 'Deterministic tests depend on transpiling a subset of app and lib code, not only tests'
---

# Tech-Spec: Fix Test Build Module Mode Mismatch

**Created:** 2026-04-28

## Overview

### Problem Statement

`npm test` fails before deterministic tests run because the test compiler uses `module: "NodeNext"` and `moduleResolution: "NodeNext"` while the repo package is not declared as ESM. Under that mode, plain `.ts` Convex/auth files are treated as CommonJS, but they import ESM-only packages such as `@convex-dev/auth/server`. This produces `TS1479` module-mode errors across `convex/auth.ts`, `convex/schema.ts`, and Convex guard files.

### Solution

Align the test-build module strategy with the actual runtime/dependency model so the test compiler no longer interprets Convex/auth source as CommonJS when importing ESM-only dependencies. The preferred approach is to keep application code unchanged and narrow the fix to test compilation settings plus any required package/module declarations.

### Scope

**In Scope:**
- Diagnose and document the minimal module-mode change needed for `tsconfig.tests.json` and package metadata.
- Make deterministic test compilation compatible with ESM-only auth imports.
- Verify that `TS1479` errors disappear from the previously failing Convex/auth files.
- Preserve the existing `node .test-dist/tests/run-tests.js` deterministic test workflow or replace it with an equivalent documented execution path.

**Out of Scope:**
- Fixing Convex schema/index typing errors.
- Fixing `@auth/core` dependency/type drift.
- Refactoring application business logic unrelated to module loading.

## Context for Development

### Codebase Patterns

- App builds use `webapp/tsconfig.json` with `module: "esnext"` and `moduleResolution: "bundler"`.
- Test builds override that in `webapp/tsconfig.tests.json` with `NodeNext`.
- `npm test` currently assumes TypeScript emit to `.test-dist`, then runs Node directly.
- Convex/auth files are plain `.ts` files, not `.mts`, and the package does not currently declare `"type": "module"`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `webapp/package.json` | Current test command and package module mode |
| `webapp/package-lock.json` | Locked dependency graph that may constrain module choices |
| `webapp/tsconfig.json` | Base application TS behavior |
| `webapp/tsconfig.tests.json` | Test compiler override currently causing the mismatch |
| `webapp/convex/auth.ts` | One of the first files failing with `TS1479` |
| `webapp/convex/schema.ts` | Imports `authTables` from `@convex-dev/auth/server` and fails in test compile |
| `webapp/convex/functions/_roleGuard.ts` | Representative Convex function file failing under NodeNext |
| `webapp/tests/run-tests.ts` | Entry point executed after transpilation |

### Technical Decisions

- Prefer fixing module-mode at the test-build boundary before renaming Convex files to `.mts`.
- Do not switch the whole repo to ESM unless deterministic tests and runtime scripts are confirmed compatible.
- Keep the output location `.test-dist` unless there is a concrete reason to replace the current test runner contract.
- Any change must be validated against both `npm test` and a focused compile of the previously failing files.

## Implementation Plan

### Tasks

- [ ] Task 1: Confirm the intended module strategy for deterministic tests.
  - File: `webapp/tsconfig.tests.json`
  - Action: Evaluate whether tests should compile in `NodeNext`, `ESNext`, or another mode consistent with the package and Node runner.
  - Notes: The outcome must explicitly account for ESM-only imports from `@convex-dev/auth/server`.

- [ ] Task 2: Align package/module metadata with the chosen test strategy.
  - File: `webapp/package.json`
  - Action: Add or avoid `"type": "module"` based on the selected approach; if avoiding it, ensure the compiler no longer interprets Convex/auth files as CommonJS during test builds.
  - Notes: Document the tradeoff, because this choice affects Node execution semantics in `.test-dist`.

- [ ] Task 3: Update the deterministic test compilation path.
  - File: `webapp/tsconfig.tests.json`
  - Action: Apply the minimal compiler changes required to eliminate `TS1479` for Convex/auth source while preserving test emit.
  - Notes: If the test runner must change from direct Node CJS execution to ESM-aware execution, capture that in `package.json`.

- [ ] Task 4: Adjust the test command only if required by the module decision.
  - File: `webapp/package.json`
  - Action: Update the `test` script to execute the transpiled output in a way consistent with the chosen module mode.
  - Notes: Do not change the deterministic test suite shape unless unavoidable.

- [ ] Task 5: Validate with focused and full checks.
  - File: `webapp/package.json`
  - Action: Run a focused compile against `convex/auth.ts`, `convex/schema.ts`, and `convex/functions/_roleGuard.ts`, then run `npm test`.
  - Notes: Capture any remaining failures separately if they are no longer module-mode errors.

### Acceptance Criteria

- [ ] AC 1: Given the current test command, when `tsc -p tsconfig.tests.json` runs, then `TS1479` module-mode errors no longer occur for `convex/auth.ts`, `convex/schema.ts`, or `convex/functions/_roleGuard.ts`.
- [ ] AC 2: Given the chosen module strategy, when deterministic tests are emitted to `.test-dist`, then the Node execution step can still run without requiring manual workarounds.
- [ ] AC 3: Given the package and tsconfig changes, when a developer reads the updated config, then it is clear why the test build and app build use their chosen module settings.
- [ ] AC 4: Given a focused compile of the previously failing auth/Convex files, when the compile finishes, then any remaining errors are from dependency or Convex schema typing issues rather than module-mode mismatch.

## Additional Context

### Dependencies

- `typescript`
- `node`
- `convex`
- `@convex-dev/auth`

### Testing Strategy

- Run `cmd /c npm test` from `webapp/`.
- Run a focused compile covering `convex/auth.ts`, `convex/schema.ts`, and `convex/functions/_roleGuard.ts`.
- If the test runner changes execution mode, run `node .test-dist/tests/run-tests.js` or its replacement directly once to verify runtime compatibility.

### Notes

- High risk: adding `"type": "module"` may ripple into every emitted JS file and break direct Node execution if not handled end-to-end.
- High risk: leaving `NodeNext` in place without package alignment will keep reintroducing `TS1479`.
- If the cleanest fix requires a separate test-only package boundary or alternate output extension strategy, document it explicitly rather than burying it in config churn.
