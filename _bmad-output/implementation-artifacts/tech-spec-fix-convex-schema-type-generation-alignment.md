---
title: 'Fix Convex Schema Type Generation Alignment'
slug: 'fix-convex-schema-type-generation-alignment'
created: '2026-04-28'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Convex 1.13.2'
  - '@convex-dev/auth 0.0.90'
  - 'TypeScript 5.x'
files_to_modify:
  - 'webapp/package.json'
  - 'webapp/package-lock.json'
  - 'webapp/convex/schema.ts'
  - 'webapp/convex/_generated/dataModel.d.ts'
  - 'webapp/convex/_generated/server.d.ts'
  - 'webapp/convex/functions/_roleGuard.ts'
  - 'webapp/convex/functions/_departmentUserGuard.ts'
  - 'webapp/convex/functions/departmentUserDashboard.ts'
code_patterns:
  - 'Convex tables use custom secondary indexes heavily across guards and queries'
  - 'Schema composes local tables with authTables from @convex-dev/auth/server'
  - 'Generated Convex types are consumed broadly by guard and feature functions'
test_patterns:
  - 'Schema and index typing failures surface first during TypeScript compile'
  - 'Focused compile should verify that custom indexes are no longer reduced to SystemIndexes'
---

# Tech-Spec: Fix Convex Schema Type Generation Alignment

**Created:** 2026-04-28

## Overview

### Problem Statement

The repo's Convex typing is not aligned with the installed schema/auth packages. Even though custom indexes are declared in `convex/schema.ts`, TypeScript reports `.withIndex("by_userId")`, `.withIndex("by_userId_tenantId")`, `.withIndex("by_departmentId")`, and similar calls as invalid, as if only system indexes existed. The highest-signal root error is the schema-level incompatibility around `authTables` and `defineSchema`, which causes downstream generated types to collapse and produces broad index and `Id<"...">` typing failures.

### Solution

Stabilize the Convex schema type graph by making the installed `convex` and `@convex-dev/auth` packages type-compatible, regenerating Convex types, and then validating that query code once again recognizes declared secondary indexes and concrete table IDs.

### Scope

**In Scope:**
- Identify the exact version or typing mismatch between `convex` and `@convex-dev/auth`.
- Update dependency versions or schema composition so `defineSchema({ ...authTables, ... })` type-checks cleanly.
- Regenerate Convex generated types after the schema is valid.
- Validate representative query files that currently fail on custom indexes and typed IDs.

**Out of Scope:**
- Fixing Node/ESM test module-mode mismatch beyond what is required to run codegen/compile.
- Fixing unrelated auth dependency issues in `@auth/core` and optional providers.
- Refactoring guard/business logic except where types must be updated to match regenerated Convex output.

## Context for Development

### Codebase Patterns

- The schema composes `authTables` from `@convex-dev/auth/server` into a single `defineSchema(...)` call.
- Guard and feature queries rely on named indexes from the schema rather than raw scans.
- Many backend functions depend on strongly typed `Id<"table">` values returned by Convex generated types.
- Once schema typing breaks, the error fan-out is very large across `convex/functions/*`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `webapp/package.json` | Installed `convex` and `@convex-dev/auth` versions |
| `webapp/package-lock.json` | Exact resolved dependency versions |
| `webapp/convex/schema.ts` | Schema composition root and secondary index declarations |
| `webapp/convex/_generated/dataModel.d.ts` | Generated table and `Id` typing output |
| `webapp/convex/_generated/server.d.ts` | Generated server/query helper typings |
| `webapp/convex/functions/_roleGuard.ts` | Representative file failing on `by_userId` and `by_userId_tenantId` |
| `webapp/convex/functions/_departmentUserGuard.ts` | Representative file failing on `by_tenantUserId` |
| `webapp/convex/functions/departmentUserDashboard.ts` | Representative feature query failing on `by_departmentId` and `by_planId_submittedAt` |

### Technical Decisions

- Treat the schema compatibility error as the root issue and the `.withIndex(...)` errors as cascades until proven otherwise.
- Regenerate Convex types only after the schema compiles cleanly enough for codegen to produce stable output.
- Prefer version alignment or officially supported schema composition changes over local type casts that hide the incompatibility.
- Only use targeted casts as a last resort, and only if the underlying schema/codegen contract is confirmed correct.

## Implementation Plan

### Tasks

- [ ] Task 1: Reproduce the schema-level incompatibility in isolation.
  - File: `webapp/convex/schema.ts`
  - Action: Run a focused TypeScript check against the schema import graph and capture the first non-cascade compatibility errors involving `authTables`, `defineSchema`, or private `indexes` declarations.
  - Notes: The goal is to confirm the exact root mismatch before changing versions.

- [ ] Task 2: Align Convex package versions.
  - File: `webapp/package.json`
  - Action: Determine a compatible `convex` and `@convex-dev/auth` pairing and update dependencies accordingly.
  - Notes: Use the lockfile and current code shape to avoid speculative upgrades that force unrelated API rewrites.

- [ ] Task 3: Refresh installed dependencies and regenerate Convex artifacts.
  - File: `webapp/package-lock.json`
  - Action: Update the lockfile and rerun the appropriate Convex generation step so `_generated/*` matches the resolved schema/auth package pair.
  - Notes: Do not hand-edit generated files.

- [ ] Task 4: Validate representative index and ID typing recovery.
  - File: `webapp/convex/functions/_roleGuard.ts`
  - Action: Confirm `.withIndex("by_userId")`, `.withIndex("by_userId_tenantId")`, and related calls now infer the correct query builder methods and typed IDs.
  - Notes: Repeat spot checks in `_departmentUserGuard.ts` and `departmentUserDashboard.ts`.

- [ ] Task 5: Apply only necessary follow-up code fixes after regeneration.
  - File: `webapp/convex/functions/_departmentUserGuard.ts`
  - Action: Adjust any backend code that still fails after regeneration because the regenerated types reveal real mismatches.
  - Notes: Keep these edits minimal and evidence-driven.

### Acceptance Criteria

- [ ] AC 1: Given `webapp/convex/schema.ts`, when TypeScript checks the schema after dependency alignment, then the schema no longer fails with the `private property 'indexes'` incompatibility involving `authTables`.
- [ ] AC 2: Given representative Convex query files, when TypeScript checks `.withIndex(...)` calls, then custom secondary indexes declared in the schema are recognized instead of collapsing to `SystemIndexes`.
- [ ] AC 3: Given typed backend code using `Id<"table">`, when TypeScript checks those files, then the common `Id<string>` to `Id<"...">` mismatch cascades are materially reduced or removed.
- [ ] AC 4: Given regenerated Convex types, when developers inspect `_generated/dataModel.d.ts` and `_generated/server.d.ts`, then the output reflects the actual tenant, department, plan, and auth table indexes used by the codebase.

## Additional Context

### Dependencies

- `convex`
- `@convex-dev/auth`
- Convex generated type artifacts in `webapp/convex/_generated`

### Testing Strategy

- Run a focused compile against `webapp/convex/schema.ts`.
- Regenerate Convex types with the repo's established codegen command.
- Run focused type checks on:
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/_departmentUserGuard.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
- Run `npm test` after the schema and generated types are stable.

### Notes

- High risk: changing Convex package versions may affect runtime APIs, codegen output, and auth table structure together.
- High risk: using casts to suppress the schema incompatibility without fixing codegen will leave the backend type graph untrustworthy.
- If a supported package pairing still fails, the next likely issue is stale generated artifacts or mixed package instances in `node_modules`.
