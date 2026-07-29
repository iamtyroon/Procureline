---
title: 'Convex Type and Test Alignment'
status: 'review'
created: '2026-07-14'
depends_on: []
---

# Tech-Spec: Convex Type and Test Alignment

## Problem

`webapp/npm test` stops before tests execute. `convex` resolves to 1.31.7 while `@convex-dev/auth` is 0.0.92; `defineSchema({ ...authTables })` fails, collapsing generated types to `SystemIndexes`. The NodeNext test compiler also treats plain Convex `.ts` files as CommonJS while they import ESM-only packages.

## Tasks

- [ ] Inspect resolved packages with `npm ls convex @convex-dev/auth --all` in `webapp/`.
  - Files: `webapp/package.json`, `webapp/package-lock.json`
  - Action: Pin an officially compatible Convex/Auth pair; remove caret drift where it permits incompatible upgrades. Do not use casts.
- [ ] Restore schema and generated types.
  - Files: `webapp/convex/schema.ts`, `webapp/convex/_generated/*`
  - Action: Correct any supported schema-composition change required by the chosen pair, then regenerate with `npx convex dev --once --typecheck=enable`. Never hand-edit generated files.
- [ ] Separate backend typechecking from Node deterministic tests.
  - Files: `webapp/tsconfig.tests.json`, `webapp/package.json`, `webapp/tests/run-tests.ts`
  - Action: Keep Convex in its ESM-supported typecheck path and prevent the NodeNext test compile from compiling Convex backend files as CommonJS; preserve deterministic test execution.
- [ ] Resolve only post-regeneration real errors.
  - Files: `webapp/convex/functions/_roleGuard.ts`, `_departmentUserGuard.ts`, representative failing functions
  - Action: Fix genuine schema/API mismatches revealed after type recovery.

## Acceptance Criteria

- [ ] Given a clean install, when `npx convex dev --once --typecheck=enable` runs, then `schema.ts` accepts `authTables` and generated types expose declared custom indexes.
- [ ] Given the test configuration, when `npm test` runs, then no TS1479 CommonJS-to-ESM errors occur and deterministic tests execute.
- [ ] Given `_roleGuard.ts` and `_departmentUserGuard.ts`, when typechecked, then tenant indexes infer concrete IDs rather than `SystemIndexes`/`Id<string>`.
- [ ] Given the webapp, when `npm run build` and `npm test` run, then both exit zero.

## Risks and Verification

Package changes can alter Convex/Auth runtime behavior. Test a preview Convex deployment after codegen; retain lockfile review in the change set.
