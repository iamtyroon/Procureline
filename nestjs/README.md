# Procureline NestJS Services

This service hosts Procureline's external integrations and heavy processing workloads. It is the canonical home for payments, file generation/import, transactional email, provider webhooks, and Redis-backed background jobs.

## What this story implements

- Authenticated REST endpoints under `/api/services/*`
- Swagger docs at `/api/services/docs`
- Signed service-token validation for trusted callers from `webapp/convex/actions/*`
- Provider foundations for Stripe, IntaSend, manual bank transfer, Resend, Excel, PDF, and BullMQ-backed retries
- A single durable NestJS-to-Convex synchronization path for webhook/job outcomes

## Local setup

1. Copy `nestjs/.env.example` to `nestjs/.env` and fill the required secrets.
2. Add the matching integration vars to `webapp/.env.local`.
3. If using `AUTH_EMAIL_TRANSPORT=dev_inbox`, set `AUTH_EMAIL_TRANSPORT` and
   `AUTH_DEV_INBOX_SECRET` to the same values in `nestjs/.env`,
   `webapp/.env.local`, and the Convex developer deployment:

```bash
cd webapp
npx convex env set AUTH_EMAIL_TRANSPORT dev_inbox
npx convex env set AUTH_DEV_INBOX_SECRET replace-me-dev-email-secret
```

4. Install dependencies in both projects.
5. Run the combined development stack from `webapp`; it starts Next.js,
   Convex, this service, and a development-only local Redis instance:

```bash
cd webapp
npm run dev
```

The service runs independently from `webapp/` and does not require nesting under `webapp/convex`.
For NestJS-only development, run `npm run start:redis` and `npm run start:dev`
in separate `nestjs` terminals.

For the shared-Convex Docker workflow used by another developer, follow
[`../DOCKER_DEVELOPMENT.md`](../DOCKER_DEVELOPMENT.md). The Docker stack uses
an official Redis container instead of `start:redis` and registers a temporary
public NestJS tunnel for Convex actions.

## First integration targets

- `webapp/convex/actions/payments.ts`
  - subscription/payment bootstrap
- `webapp/convex/actions/files.ts`
  - Excel export/import and PDF generation requests
- `webapp/convex/actions/email.ts`
  - queued transactional email requests
- `webapp/convex/http.ts`
  - single write-back endpoint for provider and job outcomes
