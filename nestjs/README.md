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
3. Install dependencies in both projects.
4. Run the applications in separate terminals:

```bash
cd webapp
npm run dev
```

```bash
cd nestjs
npm run start:dev
```

The service runs independently from `webapp/` and does not require nesting under `webapp/convex`.

## First integration targets

- `webapp/convex/actions/payments.ts`
  - subscription/payment bootstrap
- `webapp/convex/actions/files.ts`
  - Excel export/import and PDF generation requests
- `webapp/convex/actions/email.ts`
  - queued transactional email requests
- `webapp/convex/http.ts`
  - single write-back endpoint for provider and job outcomes
