# Procureline Shared Development Handoff: Tyroon and Joe

This guide lets Joe run Procureline from Docker while connecting to Tyroon's
existing Convex development deployment and its current data.

Joe will not receive a copy of the database. He will access the same live
development tenants, procurement officers, department users, department access
codes, email inbox messages, and Convex functions that Tyroon uses.

## Important Rules

- Joe's work changes the shared Convex development deployment and its data.
- Never commit populated `.env.local`, `.env`, or `.env.docker.local` files.
- Joe should use Docker Compose for this handoff, not native `npm run dev`.
- Only one developer at a time should test NestJS-backed workflows such as
  queued email, payments, imports, and service-backed exports.
- If temporary secrets are shared for this setup, rotate them after the
  collaboration period.

## What Docker Runs

| Service | Purpose | Address |
| --- | --- | --- |
| `webapp` | Next.js frontend | `http://localhost:3000` |
| `convex` | Convex watcher and function publisher | Shared cloud deployment |
| `nestjs` | External services API | `http://localhost:4001` |
| `redis` | Queue and background-job storage | Internal plus port `6379` |
| `tunnel-register` | Publishes NestJS to Convex through a temporary tunnel | Temporary HTTPS URL |

Convex owns authentication and the application records. The temporary tunnel
is required because cloud-hosted Convex actions cannot call Joe's local
`localhost:4001` directly.

## Part 1: What Tyroon Must Do

### 1. Review and Push the Docker Workflow

From the repository root, inspect the pending changes and make sure no local
secret files are staged:

```powershell
git status --short
```

Do not commit any of these files:

```txt
webapp/.env.local
nestjs/.env
webapp/.env.docker.local
nestjs/.env.docker.local
```

Commit and push the Docker workflow files:

```powershell
git add .dockerignore DOCKER_DEVELOPMENT.md compose.yaml docker nestjs webapp
git status --short
git commit -m "Add Docker shared deployment development workflow"
git push
```

Before committing, confirm that the staged list does not include local secret
files or an exported Convex backup ZIP.

### 2. Grant Joe Shared Convex Access

Joe must have access to the same Convex project and development deployment:

```txt
Deployment: vibrant-bulldog-86
```

The preferred approach is to invite Joe's own Convex account to the Procureline
project/team. If Tyroon instead signs into Convex on Joe's machine using
Tyroon's account, Joe receives broad account access, not only access to this
project.

### 3. Prepare Joe's Private Environment Files

Tyroon must give Joe two populated files outside git:

```txt
webapp/.env.docker.local
nestjs/.env.docker.local
```

Start from the tracked templates:

```txt
webapp/.env.docker.example
nestjs/.env.docker.example
```

#### `webapp/.env.docker.local`

```env
CONVEX_DEPLOYMENT=dev:vibrant-bulldog-86
NEXT_PUBLIC_CONVEX_URL=https://vibrant-bulldog-86.convex.cloud
CONVEX_SITE_URL=https://vibrant-bulldog-86.convex.site
NEXT_PUBLIC_CONVEX_SITE_URL=https://vibrant-bulldog-86.convex.site

NEXT_PUBLIC_APP_URL=http://localhost:3000
LOCAL_NESTJS_URL=http://nestjs:4001

AUTH_EMAIL_TRANSPORT=dev_inbox
AUTH_DEV_INBOX_SECRET=<dev-inbox-secret-2026>

PROCURELINE_SERVICE_JWT_SECRET=<shared-service-jwt-secret>
PROCURELINE_CONVEX_SYNC_SECRET=<shared-convex-sync-secret>
```

#### `nestjs/.env.docker.local`

```env
NESTJS_PORT=4001
NESTJS_HOST=0.0.0.0
NESTJS_URL=http://localhost:4001
SWAGGER_ENABLED=true

CONVEX_URL=https://vibrant-bulldog-86.convex.cloud
PROCURELINE_SERVICE_JWT_SECRET=<shared-service-jwt-secret>
PROCURELINE_CONVEX_SYNC_SECRET=<shared-convex-sync-secret>

STRIPE_SECRET_KEY=<shared-test-stripe-secret>
STRIPE_WEBHOOK_SECRET=<shared-test-stripe-webhook-secret>
INTASEND_PUBLISHABLE_KEY=<shared-test-intasend-publishable-key>
INTASEND_SECRET_KEY=<shared-test-intasend-secret-key>

AUTH_EMAIL_TRANSPORT=dev_inbox
AUTH_DEV_INBOX_SECRET=<shared-dev-inbox-secret>

REDIS_URL=redis://redis:6379
```

The two service bridge secrets and the dev inbox secret must match the values
used by the shared Convex deployment. Placeholder values such as
`replace-me-*` are not enough for full backend workflow testing.

### 4. Tell Joe Which Roles and Codes to Test

Tyroon should privately provide:

- The tenant admin login email or test account Joe should use.
- The procurement officer login email or test account Joe should use.
- The department user login email and currently active department access code.
- The expected tenant and department names so Joe can confirm he is viewing the
  shared records rather than an empty deployment.

Do not put passwords, login codes, or secrets in this tracked guide.

## Part 2: Exact Setup Steps for Joe

### 1. Install Required Tools

Install:

- Git
- Docker Desktop for Windows

Start Docker Desktop, then verify Docker Compose:

```powershell
docker compose version
```

### 2. Clone or Pull Procureline

For a fresh checkout:

```powershell
git clone <repository-url>
cd Procureline
```

For an existing checkout:

```powershell
cd <path-to-Procureline>
git pull
```

### 3. Add the Private Environment Files

Joe places the two files supplied by Tyroon at:

```txt
Procureline/webapp/.env.docker.local
Procureline/nestjs/.env.docker.local
```

Confirm they exist:

```powershell
Test-Path webapp/.env.docker.local
Test-Path nestjs/.env.docker.local
```

Both commands should output `True`.

### 4. Authenticate the Dockerized Convex CLI

From the Procureline repository root, run:

```powershell
docker compose run --rm convex npx convex dev --env-file .env.docker.local --once --typecheck=enable
```

Joe signs in with a Convex account that has access to Tyroon's Procureline
project. The output should reference:

```txt
vibrant-bulldog-86
```

If it provisions a different deployment, stop. Joe is not connected to
Tyroon's shared data.

The authenticated Convex CLI session is stored in the Docker named volume
`procureline-dev_convex_home`. It allows the `convex` and `tunnel-register`
containers to reuse the authenticated session after container restarts.

### 5. Start Procureline

Run:

```powershell
docker compose up --build
```

Keep that terminal open. Wait for logs showing:

```txt
Next.js ready on port 3000
NestJS services listening on http://localhost:4001
Convex functions ready
Registered Convex NESTJS_URL=https://...
```

The tunnel URL is temporary. When Joe starts his stack, NestJS-backed Convex
actions are routed to Joe's container until another developer registers a new
tunnel.

### 6. Verify Services

Open another PowerShell window in the repository root:

```powershell
Invoke-RestMethod http://localhost:4001/api/services/health
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
docker compose logs tunnel-register
```

Expected NestJS health output includes:

```json
{
  "dependencies": {
    "redis": "up"
  }
}
```

Expected tunnel logs include:

```txt
Registered Convex NESTJS_URL=https://...
```

### 7. Verify Shared Login and Data

Joe opens:

```txt
http://localhost:3000
```

Test in this order:

1. Request a login/OTP code and view it at
   `http://localhost:3000/dev/email-inbox`.
2. Sign in as the tenant admin account Tyroon supplied and confirm the
   expected tenant data appears.
3. Sign in as the procurement officer account and confirm the expected
   departments appear.
4. Sign in as the department user with the currently active department access
   code and confirm the expected department workspace loads.
5. Test a NestJS-backed operation, such as queued email or a supported export,
   after the tunnel registration log appears.

If the tenant, departments, or access codes are missing, Joe is likely using
the wrong Convex deployment or the wrong role/code records.

## Part 3: Daily Working Rules

### Start Work

```powershell
cd <path-to-Procureline>
git pull
docker compose up --build
```

Wait for tunnel registration before testing NestJS-backed workflows.

### Stop Work

```powershell
docker compose down
```

Do not normally run:

```powershell
docker compose down -v
```

The `-v` option deletes Joe's persisted Convex CLI authentication and Redis
development volume, which forces re-authentication later.

### Do Not Run Both Development Modes

Do not run this while Docker Compose is running:

```powershell
cd webapp
npm run dev
```

The native stack and Docker stack both use ports `3000`, `4001`, and `6379`.

### One Active NestJS Tunnel at a Time

Both developers may work on shared Convex data, but the shared deployment has
only one `NESTJS_URL`. The last developer whose `tunnel-register` container
successfully starts owns service-backed operations until another tunnel is
registered.

## Troubleshooting

### Joe Sees No Tenant, PO, or Department Data

Check the Convex configuration in `webapp/.env.docker.local`. It must point to:

```txt
dev:vibrant-bulldog-86
https://vibrant-bulldog-86.convex.cloud
https://vibrant-bulldog-86.convex.site
```

Joe must not use a newly provisioned personal development deployment.

### Department User Login Says Invalid Code

The department access code must be active in the shared deployment and belong
to the intended department. Tyroon should confirm or issue a fresh code from
the shared tenant and send it privately to Joe.

### Development Inbox Is Disabled or Empty

Confirm both private env files use matching values:

```env
AUTH_EMAIL_TRANSPORT=dev_inbox
AUTH_DEV_INBOX_SECRET=<same-shared-secret>
```

The same mode and secret must also exist in the shared Convex deployment.

### `MissingAccessToken` from `tunnel-register`

Joe has not authenticated Convex inside Docker, or his account does not have
access to the project. Run again:

```powershell
docker compose run --rm convex npx convex dev --env-file .env.docker.local --once --typecheck=enable
```

### Redis or NestJS Health Fails

Check service logs:

```powershell
docker compose logs redis nestjs
```

NestJS health must report Redis as `up` before queued or background operations
can be trusted.

### NestJS-Backed Operations Fail but Login Works

Login and tenant data use Convex directly. Payments, queued email, imports, and
service-backed exports additionally require the active public NestJS tunnel:

```powershell
docker compose logs tunnel-register
```

Restart the stack if the previous temporary tunnel expired:

```powershell
docker compose down
docker compose up --build
```

## Security Cleanup After Handoff

After Joe no longer needs shared access, Tyroon should:

1. Remove or reduce Joe's Convex project access.
2. Rotate `AUTH_DEV_INBOX_SECRET`.
3. Rotate `PROCURELINE_SERVICE_JWT_SECRET`.
4. Rotate `PROCURELINE_CONVEX_SYNC_SECRET`.
5. Rotate any real Stripe, IntaSend, or email provider secrets that were
   shared.
6. Confirm the shared deployment's `NESTJS_URL` is no longer pointing to an
   abandoned temporary tunnel.
