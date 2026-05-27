# Story 3.6: Billing Dashboard & Payment Methods

Status: done

## Story

As a **Tenant Admin**,
I want accurate subscription, usage, invoice, and payment-method visibility,
so that I can keep institutional service active and make informed billing decisions.

## Acceptance Criteria

1. The existing `/tenant-admin/billing` view displays the tenant's current tier, included features, renewal/next billing date where available, active-plan badge, and a truthful tier-comparison path.
2. The billing view displays live tenant usage against the applicable tier limits for departments, categories, maximum items per category, DU editor block limits where supported by persisted data, export row limits, bulk-import capability, catalog-export capability, and audit-report capability.
3. Usage indicators apply the required thresholds: green below 70%, yellow from 70% through 90%, and red above 90%; unavailable metrics state why they are unavailable rather than showing invented values.
4. When any supported usage metric exceeds 90%, the Tenant Admin sees an upgrade call to action leading to tier comparison with the next valid tier highlighted.
5. Tier comparison renders the configured Free, Starter, Professional, and Enterprise limits/features from one canonical tier contract and marks the current tier.
6. The Tenant Admin can view tenant-owned invoices/payment records sorted newest first with date, amount, provider/method, and status.
7. Invoice download returns an institution-branded PDF with invoice details and a paid watermark only when payment status justifies it; the download is tenant-authorized and audited.
8. Payment settings expose the supported paths already present in the services layer: Stripe card billing, IntaSend/M-Pesa, and bank transfer/LPO; secrets or raw card details are never persisted in Convex.
9. A payment-method-expiry warning appears when reliable provider data indicates expiry within 30 days and queues one deduplicated Tenant Admin email notification.
10. All billing data and actions are tenant-scoped and role-checked; UI state must not substitute for backend authorization or provider verification.

## Tasks / Subtasks

- [ ] Replace the billing placeholder with live tenant billing UI (AC: 1-9)
  - [ ] Extend `renderBillingView` in the existing dashboard shell or extract a dedicated tenant-admin billing view linked from it.
  - [ ] Render plan overview, tier matrix, usage cards, warning CTA, invoice history/download, and payment-method controls with empty/loading/error states.
- [ ] Create a tenant-admin billing read contract in Convex (AC: 1-6, 9-10)
  - [ ] Read tenant billing fields and `billingRecords` only for the authenticated tenant administrator's tenant.
  - [ ] Calculate usage from existing active departments/categories/items and available plan/workspace data; explicitly model unsupported metric sources.
  - [ ] Reuse `subscriptionTiers` as the tier source instead of duplicating limits in frontend constants.
- [ ] Connect billing operations to delivered integrations (AC: 7-10)
  - [ ] Reuse `webapp/convex/actions/payments.ts` and NestJS `payments` endpoints for checkout/payment operations.
  - [ ] Reuse the existing external-service sync/write-back pattern for webhook-driven billing updates.
  - [ ] Add tenant-authorized invoice listing/download generation path based on existing NestJS invoice support and audit it.
  - [ ] Persist only provider references/status metadata; provider tokenization owns sensitive payment credentials.
- [ ] Implement warning delivery and audit behavior (AC: 9-10)
  - [ ] Queue payment-expiry warning using the existing email action/NestJS delivery service with an idempotency key.
  - [ ] Record billing reads that expose sensitive detail and state-changing/payment actions through the existing audit model.

## Dev Notes

### Delivered Context To Extend

- `renderBillingView` already exists in `TenantAdminViewContent.tsx` and currently states invoices/payment history will populate when tenant billing stories land.
- The schema already contains subscription fields on `tenants`, `subscriptionTiers`, `billingRecords`, reconciliation/refund tables, and service sync events.
- Platform-admin billing functionality in `platformAdminSubscriptions.ts` establishes status normalization, billing record shape, grace-period persistence, payment events, invoice queueing, and maintenance patterns. Tenant-admin functions must expose only the caller's tenant and only allowed self-service actions.
- `actions/payments.ts`, NestJS `PaymentsController`, and `PaymentsService` already provide subscription checkout, verification, manual transfer, invoices, provider webhooks, idempotency, and Convex write-back.

### Technical Requirements

- Treat provider/webhook state as asynchronous; UI must represent pending, failed, and updated states truthfully.
- Stripe and IntaSend callbacks must remain signature-verified in NestJS. Never move provider credential handling into client components.
- Do not claim DU editor usage or expiry information if it is not actually persisted/retrievable; provide an explicit unavailable state until the backing contract exists.
- Invoice access must be authorization checked before file delivery, and download/audit metadata must not leak across tenants.

### Architecture And File Guidance

- UI: `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx` or `TenantAdminBillingView.tsx` in the same feature directory.
- Convex: focused tenant-admin billing functions, `webapp/convex/actions/payments.ts`, `webapp/convex/functions/externalServices.ts`, `webapp/convex/schema.ts`.
- Services: `nestjs/src/payments/payments.controller.ts`, `nestjs/src/payments/payments.service.ts`, existing provider modules.
- Cross-reference rather than modify platform-admin billing permission boundaries in `platformAdminSubscriptions.ts`.

### Scope Boundaries

- Story 3.6 surfaces billing and payment-method control; upgrades/downgrades, grace/suspension behavior, and Enterprise contact flow belong to Story 3.7.
- Do not build mock invoices, static provider success states, or payment-method storage outside provider tokenization.

### Manual Verification Only

- Do not add automated test tasks or automated-test acceptance criteria.
- Manually verify plan/limits display, supported and unavailable usage metrics, CTA thresholds, invoices/download authorization, each payment method path, pending/failure states, expiry warning deduplication, audit events, and cross-tenant denial.

### References

- [Source: ../epic-03-tenant-administration.md#Story-36-Billing-Dashboard--Payment-Methods]
- [Source: ../../../../planning-artifacts/architecture.md]
- [Source: ../../../../project-context.md]
- [Source: webapp/src/components/tenant-admin/TenantAdminViewContent.tsx]
- [Source: webapp/convex/schema.ts]
- [Source: webapp/convex/actions/payments.ts]
- [Source: webapp/convex/functions/platformAdminSubscriptions.ts]
- [Source: nestjs/src/payments/payments.controller.ts]
- [Source: nestjs/src/payments/payments.service.ts]
- [Source: https://docs.stripe.com/billing/subscriptions/webhooks]

## Dev Agent Record

### Agent Model Used

GPT-5

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story intentionally specifies manual verification only; automated testing is excluded by user direction.
- Code-review follow-up: payment-provider selection, tenant-scoped invoice generation requests, and available invoice downloads are wired; final generated PDF delivery and provider expiry warning evidence remain open.
- Browser-feedback follow-up: supported payment paths are displayed as visible selectable method cards rather than a compact dropdown, without changing provider-backed checkout behavior.
- Status closed on 2026-05-27 after Tenant Admin manual verification accepted the billing and payment-method workflow.

### File List

- `webapp/convex/actions/payments.ts`
- `webapp/convex/functions/tenantAdminOperations.ts`
- `webapp/src/components/tenant-admin/TenantAdminOperationsViews.tsx`
