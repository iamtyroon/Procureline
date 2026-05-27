# Procureline Webapp

This package contains the Procureline product app. It is one codebase with two runtime sides:

- Next.js frontend: routes, layouts, React components, and browser-only UI behavior.
- Convex backend: database schema, queries, mutations, actions, crons, auth, and server-side domain operations.

The frontend and backend are deployed from the same package today. Keep the framework root folders in place unless there is a deliberate migration plan, because Next.js expects `app/` at the package root and Convex expects `convex/` at the package root.

## Codebase Map

```txt
webapp/
  app/                    Next.js App Router routes and layouts
  src/components/         Product React components and feature UI
  components/ui/          Shared shadcn-style UI primitives
  convex/                 Convex backend schema, functions, actions, crons, auth
  lib/                    Domain logic shared by frontend and backend
  tests/                  TypeScript tests and source-level assertions
  public files/config     Next, Tailwind, TypeScript, package scripts
```

## Runtime Boundaries

Use these rules when adding or moving code:

- Put route files, layouts, route loading states, and route-level server/client composition in `app/`.
- Put reusable product UI in `src/components/`, grouped by product area.
- Put generic UI building blocks in `components/ui/`; avoid product-specific logic there.
- Put Convex schema, queries, mutations, actions, auth, crons, and seed scripts in `convex/`.
- Put pure shared domain helpers, validators, constants, and type-safe formatting rules in `lib/`.
- Do not import browser-only code from `convex/`.
- Do not import Convex server internals directly into UI components; call Convex through generated APIs and hooks.
- If a helper needs `window`, DOM APIs, React state, or routing hooks, it is frontend code, not shared code.
- If a helper depends only on plain data and has no runtime side effects, it can live in `lib/`.

## Current Feature Areas

```txt
src/components/procurement-officer/      Procurement officer workspaces and dashboard UI
src/components/department-user/          Department user dashboard and plan workflow UI
src/components/tenant-admin/             Tenant admin views
src/components/platform-admin/           Platform admin views
src/components/blockly/                  Blockly editor/runtime UI

lib/procurement-officer/                 Procurement officer domain helpers
lib/department-user/                     Department user domain helpers
lib/tenant-admin/                        Tenant admin domain helpers
lib/platform-admin/                      Platform admin domain helpers
lib/validators/                          Shared validation schemas

convex/functions/                        Backend query/mutation functions
convex/actions/                          Backend actions for external services/files
```

## Working Locally

For a fresh clone, install packages and provision the developer's Convex deployment:

```bash
npm install
npm run convex:setup
```

`convex:setup` writes the local Convex environment values, publishes the
functions, verifies the Convex TypeScript surface, and exits after setup.

Install and configure the sibling NestJS service before starting the combined
development process:

```bash
cd ../nestjs
npm install
cp .env.example .env
```

Set `CONVEX_URL` in `nestjs/.env` to the `NEXT_PUBLIC_CONVEX_URL` value created
in `webapp/.env.local`, then return to `webapp`:

```bash
npm run dev
```

This runs all development processes:

```txt
npm run dev:frontend    Next.js dev server
npm run dev:backend     Convex dev server
npm run dev:redis       Local Redis server for queues and background jobs
npm run dev:nestjs      NestJS external services
```

The local Redis process is provided by `redis-memory-server`; on Windows it
downloads and runs a local Memurai binary during installation/first use. It is
development-only data and stops when `npm run dev` is stopped.

### Development Email Inbox

The development inbox requires the same mode and secret in three environments:

- `webapp/.env.local`, used by the Next.js `/dev/email-inbox` page.
- The Convex developer deployment, used by queries and Convex email actions.
- `nestjs/.env`, used by the NestJS email service.

Choose one local-only secret, then configure the webapp and Convex deployment:

```bash
# Add these two lines to webapp/.env.local:
# AUTH_EMAIL_TRANSPORT=dev_inbox
# AUTH_DEV_INBOX_SECRET=replace-me-dev-email-secret

npx convex env set AUTH_EMAIL_TRANSPORT dev_inbox
npx convex env set AUTH_DEV_INBOX_SECRET replace-me-dev-email-secret
```

In `nestjs/.env`, keep the matching values:

```bash
AUTH_EMAIL_TRANSPORT=dev_inbox
AUTH_DEV_INBOX_SECRET=replace-me-dev-email-secret
```

Restart `npm run dev` after changing `.env.local`. The Convex `env set` commands
target the developer deployment selected by `webapp/.env.local`.

For frontend-only work:

```bash
npm run dev:frontend-only
```

### Docker Shared-Deployment Setup

For a Docker-based handoff that connects another developer to the same Convex
development deployment and runs NestJS through a temporary public tunnel, see
[`../DOCKER_DEVELOPMENT.md`](../DOCKER_DEVELOPMENT.md). Do not run the native
`npm run dev` stack while Docker Compose is running because both bind ports
`3000`, `4001`, and `6379`.

## Verification

Use these checks before handing off larger changes:

```bash
git diff --check
cmd /c npm run build
cmd /c npm test
```

Known current blockers may stop the build or tests in Convex/generated type checking before unrelated work can fully pass. If that happens, record the first error and confirm whether the frontend compiled before the blocker.

## Refactor Guidance

Prefer incremental boundary improvements over a large folder migration:

- Keep `app/` and `convex/` at the package root for now.
- Split oversized UI files into sibling feature folders first.
- Move pure helpers into `lib/` only when they are genuinely shared.
- Avoid creating a separate frontend/backend deployment unless release ownership, security, runtime, or operational needs justify it.

This keeps onboarding simple without adding multiple package roots, duplicated configuration, or deployment orchestration.
