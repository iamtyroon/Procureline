---
title: 'Fix Auth Dependency Type Drift'
slug: 'fix-auth-dependency-type-drift'
created: '2026-04-28'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - '@auth/core'
  - '@convex-dev/auth'
  - 'TypeScript 5.x'
  - 'Node.js'
files_to_modify:
  - 'webapp/package.json'
  - 'webapp/package-lock.json'
  - 'webapp/convex/auth.ts'
  - 'webapp/convex/ResendOTP.ts'
  - 'webapp/convex/ResendPasswordReset.ts'
  - 'webapp/convex/functions/sessions.ts'
code_patterns:
  - 'Auth stack is shared across Convex auth config, session helpers, and email/token flows'
  - 'Type failures include missing exports from @auth/core and missing optional provider-related types'
  - 'Current repo depends on lockfile-resolved packages rather than a workspace toolchain'
test_patterns:
  - 'Dependency/type drift shows up as node_modules declaration failures during tsc'
  - 'Focused auth compile should isolate package alignment from business-logic errors'
---

# Tech-Spec: Fix Auth Dependency Type Drift

**Created:** 2026-04-28

## Overview

### Problem Statement

After the module-mode and Convex schema issues, the remaining test-compile failures include auth package declaration mismatches such as missing exports from `@auth/core`, missing `nodemailer` and `@simplewebauthn/*` type packages, and incompatible declarations consumed by `@convex-dev/auth`. These errors indicate that the installed auth dependency graph is not coherent for the repo's current TypeScript build.

### Solution

Normalize the auth dependency graph so the installed versions of `@auth/core`, `@convex-dev/auth`, and any required optional peer/type packages are mutually compatible with the repo's TypeScript configuration and current Convex auth usage.

### Scope

**In Scope:**
- Audit the exact installed auth-related package versions from `package-lock.json`.
- Identify which auth packages are incompatible or missing for the repo's current code.
- Update dependencies and lockfile so TypeScript can resolve the required auth declarations.
- Validate representative auth entry points after dependency alignment.

**Out of Scope:**
- Broad authentication feature redesign.
- Session/business-logic refactors unless required by a legitimate upstream package API change.
- Convex schema/index typing fixes except where auth package alignment overlaps.

## Context for Development

### Codebase Patterns

- Auth concerns span Convex auth configuration, session loading, password reset, and email/token helpers.
- The repo uses direct package imports in Convex files rather than wrapping all auth dependencies behind one adapter.
- The test compile currently surfaces node_modules declaration failures before most app-level auth code is type-checked cleanly.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `webapp/package.json` | Declared auth-related dependencies |
| `webapp/package-lock.json` | Exact resolved auth dependency tree |
| `webapp/convex/auth.ts` | Primary Convex auth configuration entry point |
| `webapp/convex/functions/sessions.ts` | Session helper file failing in the compile output |
| `webapp/convex/ResendOTP.ts` | Example file failing on auth-adjacent imports |
| `webapp/convex/ResendPasswordReset.ts` | Example file failing on auth-adjacent imports |
| `webapp/convex/functions/_roleGuard.ts` | Downstream consumer of auth/session state |

### Technical Decisions

- Treat `package-lock.json` as the source of truth for what is actually installed before changing versions.
- Prefer restoring a coherent dependency set over suppressing node_modules errors with broad compiler flags.
- Install missing peer/type packages only when they are genuinely required by the resolved auth libraries.
- Keep application-level auth code changes minimal unless upstream package APIs force explicit updates.

## Implementation Plan

### Tasks

- [ ] Task 1: Inventory the resolved auth dependency graph.
  - File: `webapp/package-lock.json`
  - Action: Identify the installed versions of `@auth/core`, `@convex-dev/auth`, and any related packages implicated by the current errors.
  - Notes: Capture which packages require missing exports or missing peer/type packages.

- [ ] Task 2: Determine the supported package set for the repo's auth usage.
  - File: `webapp/package.json`
  - Action: Choose a compatible set of versions for `@auth/core`, `@convex-dev/auth`, and required auxiliary packages.
  - Notes: Avoid mixing versions that expect different `@auth/core` declaration shapes.

- [ ] Task 3: Update dependencies and lockfile.
  - File: `webapp/package.json`
  - Action: Add, remove, or pin auth-related dependencies and refresh `package-lock.json`.
  - Notes: Include any missing peer/type packages such as mailer or WebAuthn dependencies only if the resolved packages require them for type-checking.

- [ ] Task 4: Validate representative auth entry points.
  - File: `webapp/convex/auth.ts`
  - Action: Confirm the main Convex auth setup compiles against the updated dependency set.
  - Notes: Repeat spot checks in `convex/functions/sessions.ts`, `convex/ResendOTP.ts`, and `convex/ResendPasswordReset.ts`.

- [ ] Task 5: Apply only necessary source adjustments after dependency alignment.
  - File: `webapp/convex/functions/sessions.ts`
  - Action: Update imports or types if the chosen supported package set requires minor code changes.
  - Notes: Do not refactor behavior unless the dependency/API change makes it necessary.

### Acceptance Criteria

- [ ] AC 1: Given the updated auth dependency graph, when TypeScript checks auth-related source, then missing-export errors from `@auth/core` no longer occur.
- [ ] AC 2: Given the installed auth packages, when TypeScript resolves their declarations, then missing module errors for required auth peer/type packages are eliminated.
- [ ] AC 3: Given representative auth files such as `convex/auth.ts` and `convex/functions/sessions.ts`, when TypeScript checks them, then remaining errors are limited to unrelated repo issues rather than auth dependency drift.
- [ ] AC 4: Given the updated `package.json` and `package-lock.json`, when another developer installs dependencies and runs the same compile commands, then they reproduce the stabilized auth type environment without manual patching.

## Additional Context

### Dependencies

- `@auth/core`
- `@convex-dev/auth`
- Any required peer/type packages surfaced by the lockfile and compile output

### Testing Strategy

- Run focused type checks on:
  - `webapp/convex/auth.ts`
  - `webapp/convex/functions/sessions.ts`
  - `webapp/convex/ResendOTP.ts`
  - `webapp/convex/ResendPasswordReset.ts`
- Run `npm test` after the dependency graph is updated.
- If dependency changes are substantial, remove `node_modules` and reinstall once to verify lockfile reproducibility.

### Notes

- High risk: auth package upgrades may change expected declaration shapes without obvious runtime code changes.
- High risk: adding missing optional packages blindly can mask the real version incompatibility instead of fixing it.
- Dependency alignment should be done after or alongside the module-mode and Convex schema fixes, because those earlier failures currently obscure the full auth error set.
