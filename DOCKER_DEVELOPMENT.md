# Docker Development With The Shared Convex Deployment

This workflow runs the local Procureline services in Docker while using one
existing Convex development deployment as the application backend and database.
Anyone using this setup can read and change the data and functions in that
shared deployment.

## What Runs In Docker

```txt
webapp           Next.js application at http://localhost:3000
convex           Convex function watcher and publisher
nestjs           External services API at http://localhost:4001
redis            BullMQ/queue Redis instance
tunnel-register  Temporary public NestJS tunnel registered as Convex NESTJS_URL
```

Convex still owns authentication, tenants, procurement officers, department
users, access codes, and the development email inbox. Docker does not copy that
data; it connects to the selected shared deployment.

## First-Time Setup

1. Install Docker Desktop and ensure `docker compose version` succeeds.
2. Receive private environment values from the deployment owner. Do not commit
   populated environment files.
3. Create local Docker env files:

```powershell
Copy-Item webapp/.env.docker.example webapp/.env.docker.local
Copy-Item nestjs/.env.docker.example nestjs/.env.docker.local
```

4. Replace placeholders in both `.env.docker.local` files with the shared
   deployment values. The Convex URLs, email inbox secret, service JWT secret,
   and sync secret must match the shared deployment/service configuration.
5. Authenticate and publish once to the shared Convex development deployment:

```powershell
docker compose run --rm convex npx convex dev --env-file .env.docker.local --once --typecheck=enable
```

This is intentionally shared backend access. Running the command can publish
Convex function changes and Joe must be invited to the applicable Convex
project/team or otherwise be granted the required development credentials. The
container stores the Convex CLI login in the `convex_home` Docker volume so the
watcher and tunnel registration service can use the same authenticated session.

## Start And Stop

Start all services:

```powershell
docker compose up --build
```

Stop them:

```powershell
docker compose down
```

Do not run native `npm run dev` at the same time as Docker Compose. Both use
ports `3000`, `4001`, and `6379`.

The `tunnel-register` service obtains a temporary public Cloudflare Quick
Tunnel URL for NestJS and writes it into the selected Convex deployment as
`NESTJS_URL`. This enables Convex actions to call the active local NestJS
container for queued email, payments, imports, and service-backed exports.
If it reports `MissingAccessToken`, rerun the first-time Convex setup command
and confirm Joe has access to the shared Convex project.

## Shared Backend Ownership

`NESTJS_URL` is a single value on the shared Convex development deployment.
Only one developer should exercise NestJS-backed workflows at a time:

1. The active developer starts `docker compose up`.
2. Wait for `tunnel-register` to log `Registered Convex NESTJS_URL=...`.
3. That developer tests queued email, payments, imports, and external-service
   exports.
4. When another developer starts their stack, their tunnel replaces the prior
   endpoint.

Login and core Convex data access do not require the NestJS tunnel. Failures in
Nest-backed flows after a stack has stopped usually mean `NESTJS_URL` points to
an expired temporary tunnel.

## Verify The Handoff

After the stack becomes ready:

```powershell
Invoke-RestMethod http://localhost:4001/api/services/health
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
docker compose logs tunnel-register
```

The Nest health response must show `redis` as `up`. The tunnel log must show
that a public URL was registered in Convex. In the web app, confirm tenant
admin, procurement officer, and department user login against existing shared
data, then check `/dev/email-inbox` after requesting a login code.

## Secret Handling

The populated `.env.docker.local` files are ignored and must never be staged.
If shared credentials are sent temporarily by email, rotate the inbox secret,
service JWT secret, sync secret, and any real provider credentials after the
handoff period.
