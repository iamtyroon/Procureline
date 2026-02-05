# Test Design - System Level
## Procureline: Multi-Tenant SaaS Procurement Platform

**Generated:** 2026-02-03
**Test Architect:** Murat (TEA - Test Engineer & Automation)
**Project Classification:** Enterprise Greenfield, Multi-Tenant SaaS, Medium-High Complexity
**Phase:** Solutioning (Phase 3) - Pre-Implementation Testability Review

---

## Executive Summary

This document presents the system-level testability review and test strategy for Procureline, a multi-tenant SaaS procurement planning platform for Kenyan universities. The review evaluates the architecture (Next.js 16 / Convex / NestJS / Blockly) against testability criteria, identifies 9 Architecturally Significant Requirements (ASRs) from 39 NFRs, and defines a comprehensive test strategy across unit/integration/E2E levels.

**Overall Testability Score: 7/10 - ACCEPTABLE with CONCERNS**

**Key Findings:**
- ✅ Strong multi-tenant isolation enables parallel-safe testing
- ✅ Convex database provides excellent state control and observability
- ⚠️ **BLOCKER:** Clerk→Convex Auth migration must complete before auth tests
- ⚠️ External payment/email dependencies require mocking strategies
- ⚠️ Distributed observability gap (3 deployment platforms, no unified logging)

**Gate Recommendation: ⚠️ APPROVE with CONDITIONS**
- Architecture approved for implementation (testability concerns are infrastructure, not design flaws)
- Clerk→Convex Auth migration REQUIRED before Epic 1 (Foundation & Authentication)
- NestJS test endpoints RECOMMENDED for payment fault injection

---

## 1. Architecture Testability Review

### 1.1 Technology Stack

| Layer | Technology | Testability Impact |
|-------|-----------|-------------------|
| **Frontend** | Next.js 16 (App Router), TypeScript strict, shadcn/ui | React Server Components testable via Playwright E2E |
| **Visual Editor** | Google Blockly (lazy-loaded) | JSON data model enables fixture-based testing |
| **Primary Backend** | Convex (database, auth, real-time, functions) | Strong testability - local dev mode, test client, reactive queries |
| **Integration Service** | NestJS microservice (payments, Excel, email) | HTTP-based - easily mockable with Supertest |
| **Deployment** | Vercel (frontend), Convex Cloud (backend), Railway (NestJS) | Distributed system - observability gap flagged |
| **External Integrations** | Stripe, IntaSend (M-Pesa), Resend (email), ExcelJS | Require test mode APIs and mocking |

### 1.2 Controllability Assessment (7/10)

**✅ STRONG: Multi-Tenant Test Isolation**
- Architecture uses `tenantId` filtering on all Convex tables via Ents
- Test factories can create isolated tenant contexts
- Convex functions support `ctx.db` seeding for controlled test state
- Each tenant is a natural test boundary

**✅ STRONG: Convex Database Control**
- Convex offers `convex dev` with local ephemeral database
- Test data can be seeded via Convex mutations
- Database state is queryable and resettable per test run
- No complex database migration concerns during test cycles

**⚠️ CONCERN: External Payment Dependencies**
- Stripe and IntaSend (M-Pesa) integrations require mocking strategies
- NestJS microservice layer complicates the payment testing boundary
- **Mitigation:** NestJS must expose test endpoints for fault injection (e.g., `/test/stripe/fail`, `/test/mpesa/timeout`)
- **Mitigation:** Use Stripe test mode API keys, IntaSend sandbox environment

**⚠️ CONCERN: Email Dependency (Resend)**
- Email OTP flows for 2FA require email interception
- **Mitigation:** Resend offers test mode - use test API keys
- **Mitigation:** Consider Mailhog/Mailpit for E2E tests to capture emails locally

**✅ ACCEPTABLE: Blockly Visual Editor**
- Lazy-loaded with `next/dynamic` - can be mocked in tests
- JSON-based data model enables controlled test fixture creation
- No runtime compilation - just JSON serialization/deserialization

**⚠️ CONCERN: Convex Ents Starter Template Migration**
- Starter uses Clerk Auth, but architecture specifies Convex Auth
- During migration, auth boundaries may shift
- **Mitigation:** Complete Clerk→Convex Auth migration BEFORE writing auth-related tests
- **Mitigation:** Document auth test patterns in `project-context.md` to prevent agent inconsistency

### 1.3 Observability Assessment (6/10)

**✅ STRONG: Convex Real-time Capabilities**
- Convex queries are reactive - test assertions can observe state changes
- Convex dashboard provides live function logs and database inspection
- TypeScript strict mode enables compile-time observability

**⚠️ CONCERN: Distributed Tracing Gap**
- Architecture spans 3 deployment platforms (Vercel, Convex Cloud, Railway)
- No unified logging/tracing strategy mentioned (e.g., Sentry, LogRocket, OpenTelemetry)
- **Mitigation:** Add observability tooling for production debugging
- **Mitigation:** E2E tests should capture HAR files, console logs, and network traces

**✅ ACCEPTABLE: Deterministic Test Results**
- Convex functions are deterministic (no Date.now(), Math.random() in queries/mutations)
- React Server Components + App Router have predictable rendering
- Blockly JSON is deterministic (no random IDs if using controlled factories)

**⚠️ CONCERN: NFR Validation Metrics**
- Performance: No mention of performance monitoring (e.g., Vercel Analytics, Convex metrics)
- Security: Audit logs are immutable (good), but no mention of security event monitoring
- **Mitigation:** Integrate Vercel Speed Insights for frontend performance
- **Mitigation:** Convex audit log queries should be exposed for test validation

### 1.4 Reliability Assessment (7/10)

**✅ STRONG: Convex Parallel-Safe Testing**
- Convex Ents with `tenantId` isolation ensures parallel test safety
- Each test can use a unique tenant - no cross-contamination
- Convex dev environment supports concurrent clients

**✅ STRONG: Component Isolation**
- Frontend (Next.js) and backend (Convex) are loosely coupled via Convex Client SDK
- NestJS microservice is HTTP-based - easily mockable
- External dependencies (Stripe, IntaSend, Resend) have SDK interfaces

**⚠️ CONCERN: Convex Real-time Subscriptions in Tests**
- Reactive queries may cause race conditions in tests if not managed
- **Mitigation:** Use Playwright `page.waitForFunction()` for Convex state assertions
- **Mitigation:** Avoid hard waits - use Convex query subscriptions as test synchronization points

**⚠️ CONCERN: Shared Test Data (GOK Templates)**
- Architecture mentions GOK procurement template compliance
- If test data relies on shared Excel templates, tests may become brittle
- **Mitigation:** Version-control GOK template fixtures in `tests/fixtures/gok-templates/`
- **Mitigation:** Tests should generate valid Excel files programmatically using ExcelJS

**✅ ACCEPTABLE: Cleanup Discipline**
- Convex database can be wiped between test runs
- Playwright fixtures support auto-cleanup
- Vercel ephemeral preview deployments enable isolated test environments

---

## 2. Architecturally Significant Requirements (ASRs)

ASRs are the 9 NFRs (from 39 total) that drove architectural decisions and require specialized testing strategies.

### 2.1 Tier 1 ASRs (Critical - Shaped Core Architecture)

#### **ASR-1: Multi-Tenant Data Isolation (Security)**
- **NFR:** "Complete tenant data isolation - no cross-tenant data leakage"
- **Architectural Impact:**
  - All Convex tables use `tenantId` field via Ents
  - Every query/mutation filters by `ctx.tenant.id`
  - Platform Admin role has cross-tenant access, all others tenant-scoped
- **Test Strategy:**
  - E2E negative tests: Attempt cross-tenant access with JWT manipulation
  - Integration tests: Validate `tenantId` filtering on all Convex queries
  - Security scan: ZAP/Burp to detect IDOR vulnerabilities
- **Validation Criteria:** 0 cross-tenant data leakage incidents, 100% of queries filtered by `tenantId`

#### **ASR-2: Authentication & Authorization (Security)**
- **NFR:** "Email-based 2FA for admins/POs, access code login for DUs"
- **Architectural Impact:**
  - Convex Auth replaces Clerk (starter template migration)
  - Email OTP via Resend for 2FA flows
  - 4-layer RBAC: Platform Admin, Tenant Admin, PO, DU
- **Test Strategy:**
  - Integration tests: Email OTP generation/verification (mocked Resend)
  - E2E tests: Full 2FA flow with email interception (Mailhog/Resend test mode)
  - Role-based access tests: 4 roles × critical features = matrix testing
- **Validation Criteria:** 2FA functional, 0 unauthorized access incidents, all 4 roles validated

#### **ASR-3: Blockly Performance (Performance)**
- **NFR:** "Blockly editor loads <2 seconds, interactions <100ms"
- **Architectural Impact:**
  - Lazy-loaded with `next/dynamic` to avoid bundle bloat
  - JSON-based block data model (no runtime compilation)
  - Desktop-only UI (min 1024px viewport)
- **Test Strategy:**
  - Performance tests: Playwright Performance API to measure Blockly load time
  - Lighthouse CI: Monitor bundle size and LCP metrics
  - Interaction tests: Measure drag/drop latency
- **Validation Criteria:** Blockly load <2s, interactions <100ms, bundle size <500KB

#### **ASR-4: Excel Integration (Integration)**
- **NFR:** "Export Excel 2016+ compatible files, match GOK templates"
- **Architectural Impact:**
  - NestJS microservice handles ExcelJS operations (offloaded from Next.js)
  - GOK template compliance requires specific Excel formatting
- **Test Strategy:**
  - Integration tests: Generate Excel → parse with ExcelJS → validate schema
  - GOK compliance tests: Compare exported structure to GOK fixture
  - Compatibility tests: Open generated Excel in Excel 2016 (manual QA)
- **Validation Criteria:** Excel 2016+ compatible, 100% GOK template match, 0 formatting errors

#### **ASR-5: Scalability to 500 Tenants (Scalability)**
- **NFR:** "Support 50→500 tenants, 200 concurrent users, 1M+ items"
- **Architectural Impact:**
  - Convex database with Ents for query optimization
  - Vercel Edge Functions + Convex Cloud for horizontal scaling
  - NestJS on Railway with auto-scaling configuration
- **Test Strategy:**
  - Load tests (k6): 200 concurrent users across 10 tenants for 10 minutes
  - Stress tests: Seed 1M catalog items, query with pagination
  - Smoke tests: Seed 500 tenants, query random tenant
- **Validation Criteria:** p95 latency <500ms at 200 users, 1M items queryable, error rate <1%

#### **ASR-6: Audit Trail Immutability (Data Governance)**
- **NFR:** "Immutable audit logs, 7-year retention, Kenya data residency"
- **Architectural Impact:**
  - Convex audit log tables with no update/delete operations
  - All state-changing operations log actor, timestamp, before/after snapshots
- **Test Strategy:**
  - Integration tests: Attempt `db.patch()` on audit table → verify throws error
  - Mutation coverage tests: All mutations write audit logs
  - Retention tests: Verify no TTL configured on audit tables
- **Validation Criteria:** 100% mutation audit coverage, 0 audit log updates allowed, 7-year retention verified

### 2.2 Tier 2 ASRs (Important - Influenced Design Patterns)

#### **ASR-7: 99.5% Uptime (Reliability)**
- **NFR:** "99.5% uptime, 1hr RPO, 4hr RTO"
- **Test Strategy:** Error handling tests, retry logic, circuit breakers, health checks
- **Validation Criteria:** All error handlers present, retries functional, health checks pass

#### **ASR-8: GOK Compliance (Integration + Business)**
- **NFR:** "AGPO 30%, PWD 2%, Local Content 40% tracking"
- **Test Strategy:** Business logic unit tests for compliance calculations
- **Validation Criteria:** 100% calculation accuracy, Blockly constraints validated

#### **ASR-9: Real-time Collaboration (Performance + UX)**
- **NFR:** "Real-time plan status updates for DUs and POs"
- **Test Strategy:** Multi-context E2E tests using 2 Playwright browser contexts
- **Validation Criteria:** Real-time sync latency <1s, 100% state consistency

---

## 3. Test Levels Strategy

### 3.1 Recommended Test Distribution

```
Unit Tests:        60%  (Business logic, helpers, utilities, validators)
Integration Tests: 30%  (Convex functions, NestJS endpoints, database operations)
E2E Tests:         10%  (Critical user journeys, auth flows, payment flows)
```

**Rationale:**
- High integration test ratio (30%) due to Convex reactive queries and multi-tenant data access patterns requiring database validation
- Moderate E2E ratio (10%) focused on ASR-driven critical paths (auth, tenant isolation, payment flows, Excel export)
- Unit tests (60%) cover GOK compliance calculations, RBAC logic, Blockly constraint validation

### 3.2 Unit Tests (60% of test suite)

| Component | What to Test | Example | Tool |
|-----------|-------------|---------|------|
| **GOK Compliance Calculations** | AGPO 30%, PWD 2%, Local Content 40% logic | `calculateComplianceScore(vendors)` | Vitest |
| **RBAC Authorization Helpers** | Role-based access logic (4 roles) | `canAccessTenant(user, tenantId)` | Vitest |
| **Blockly Constraint Validators** | Procurement plan validation rules | `validatePlanBlocks(jsonBlocks)` | Vitest |
| **Date/Fiscal Year Utilities** | Kenya fiscal year logic (Jul 1 - Jun 30) | `getFiscalYear(date)` | Vitest |
| **Currency/Number Formatters** | KES formatting, number parsing | `formatCurrency(amount)` | Vitest |
| **Excel Template Generators** | GOK template structure (no ExcelJS I/O) | `generateGOKTemplate(data)` | Vitest |
| **Form Validation Schemas** | Zod schemas for inputs | `tenantFormSchema.parse()` | Vitest |

**Anti-pattern:** Avoid unit testing React components - use E2E instead for UI validation.

### 3.3 Integration Tests (30% of test suite)

| Component | What to Test | Example | Tool |
|-----------|-------------|---------|------|
| **Convex Queries** | Multi-tenant data filtering, joins | `ctx.db.query("plans").filter(q => q.eq("tenantId", ctx.tenant.id))` | Convex Test Client + Vitest |
| **Convex Mutations** | State changes, audit log writes | `createPlan(ctx, {name, budget})` → verify plan + audit log entry | Convex Test Client + Vitest |
| **Convex Auth Flows** | Email OTP generation, verification | `sendOTP(email)` → verify Resend API call (mocked) | Convex Test Client + Vitest |
| **NestJS Payment Endpoints** | Stripe/IntaSend integration | `POST /payments/stripe/checkout` → verify session creation (mocked Stripe SDK) | Supertest + Jest |
| **NestJS Excel Export** | ExcelJS file generation | `POST /excel/export` → parse output with ExcelJS, validate schema | Supertest + Jest + ExcelJS |
| **NestJS Email Triggers** | Resend email dispatch | `POST /email/send-notification` → verify Resend API call (mocked) | Supertest + Jest |
| **Convex File Storage** | Upload/download operations | `ctx.storage.store(file)` → verify file retrieval | Convex Test Client + Vitest |

**Key Integration Test Patterns:**
- Use **Convex test utilities** (`ConvexTestingHelper` from Convex docs)
- Mock external APIs (Stripe, IntaSend, Resend) at SDK boundary
- Use Resend/Stripe test mode API keys where possible
- Validate tenant isolation at database layer (negative access tests)

### 3.4 E2E Tests (10% of test suite)

| User Journey | ASR Coverage | Critical Path | Tool |
|--------------|--------------|---------------|------|
| **Platform Admin Onboards Tenant** | Multi-tenant isolation, Auth | Create tenant → assign admin → verify isolation | Playwright |
| **Tenant Admin Creates PO User** | RBAC, Auth | Create PO account → send Email OTP → verify login | Playwright + Mailhog |
| **PO Creates Department Catalog** | Real-time sync, RBAC | Add items → verify DU sees items in Blockly | Playwright (2 contexts) |
| **DU Builds Plan in Blockly** | Blockly performance, GOK compliance | Drag blocks → validate constraints → verify save <2s | Playwright Performance API |
| **PO Consolidates Plans** | Excel integration | Select plans → export Excel → validate GOK template | Playwright + ExcelJS parsing |
| **Tenant Admin Pays Invoice** | Payment integration (Stripe/M-Pesa) | Select plan → checkout → webhook → verify subscription | Playwright + Stripe test mode |
| **Platform Admin Views Audit Logs** | Audit immutability, cross-tenant access | Filter by tenant → verify logs immutable | Playwright |
| **DU Submits Plan for Approval** | Real-time sync, notifications | Submit → verify PO notification + status update | Playwright (2 contexts) |

**E2E Test Patterns:**
- Use **Playwright fixtures** for tenant/user setup and cleanup
- **Email interception:** Mailhog for OTP capture (or Resend test mode)
- **Payment testing:** Stripe test mode with webhook forwarding (Stripe CLI)
- **Real-time sync:** Use 2 Playwright browser contexts to simulate PO + DU
- **Performance validation:** Playwright Performance API for Blockly <2s load
- **Visual regression:** Playwright screenshots for Blockly canvas, Excel export preview

### 3.5 Test Exclusions (Do NOT Test at Each Level)

**❌ Unit Test Anti-Patterns:**
- React components (use E2E instead)
- Database queries (use integration tests)
- API endpoints (use integration tests)
- Mocking Convex `ctx` (use real Convex test client at integration level)

**❌ Integration Test Anti-Patterns:**
- Full user journeys (use E2E instead)
- UI interactions (use E2E instead)
- Testing business logic already covered by unit tests (no duplication)

**❌ E2E Test Anti-Patterns:**
- GOK compliance calculations (use unit tests)
- RBAC permission logic (use unit tests)
- Database query optimization (use integration tests)
- Testing every CRUD operation E2E (too slow - use integration tests)

### 3.6 Coverage Targets by Level

| Test Level | Code Coverage Target | Rationale |
|------------|---------------------|-----------|
| Unit | ≥90% | Pure business logic is deterministic and fast to test |
| Integration | ≥80% | Covers all Convex functions, NestJS endpoints |
| E2E | N/A (journey-based) | Focus on ASR-critical paths, not line coverage |

**Overall Target:** ≥85% combined code coverage (validated via CI pipeline)

---

## 4. NFR Testing Approach

Mapping the 39 NFRs (7 categories) to automated testing strategies.

### 4.1 Security NFRs (10 requirements)

**Key Requirements:**
- Multi-tenant isolation (no cross-tenant data leakage)
- Email-based 2FA for admins/POs
- Encryption at rest and in transit
- Rate limiting (100 req/min per user)
- Immutable audit logs

| NFR | Test Type | Tool | Validation Method |
|-----|-----------|------|-------------------|
| **Tenant Isolation** | E2E Negative Tests | Playwright | Attempt cross-tenant access with JWT manipulation, verify 403/404 |
| **2FA Email OTP** | Integration + E2E | Vitest + Playwright + Mailhog | Generate OTP → intercept email → validate code → verify login |
| **Encryption in Transit** | Integration | Supertest | Verify HTTPS enforcement, TLS 1.2+ on NestJS endpoints |
| **Encryption at Rest** | Manual Audit | N/A (Convex Cloud managed) | Convex Cloud provides encryption at rest - verify in dashboard |
| **Rate Limiting** | Load Test | k6 | Send 101 requests in 1 min → verify 429 response |
| **Audit Log Immutability** | Integration | Vitest (Convex test client) | Attempt `db.patch()` on audit table → verify throws error |
| **OWASP Top 10** | E2E Security Scan | Playwright + ZAP/Burp | SQL injection, XSS, CSRF tests on form inputs |
| **Session Timeout** | E2E | Playwright | Idle 30 min → verify auto-logout |
| **Password/Secret Handling** | Static Analysis | CodeQL / Semgrep | Scan for hardcoded secrets, insecure crypto |
| **Role-Based Access Control** | Integration + E2E | Vitest + Playwright | Verify 4 roles cannot access unauthorized routes/data |

**Security Gate Criteria:**
- ✅ PASS: 0 critical vulnerabilities, tenant isolation validated, 2FA functional
- ⚠️ CONCERNS: 1-2 medium vulnerabilities, rate limiting partially implemented
- ❌ FAIL: Any critical vulnerability, tenant data leakage detected, 2FA broken

### 4.2 Performance NFRs (7 requirements)

**Key Requirements:**
- Blockly editor loads <2 seconds
- Blockly interactions <100ms (drag/drop, add block)
- Page load <3 seconds (desktop)
- Support 50 concurrent users per tenant

| NFR | Test Type | Tool | Validation Method |
|-----|-----------|------|-------------------|
| **Blockly Load Time <2s** | Performance Test | Playwright Performance API | `performance.measure('blockly-load')` → assert <2000ms |
| **Blockly Interaction <100ms** | Performance Test | Playwright | `page.dispatchEvent('drag')` → measure response time |
| **Page Load <3s** | Performance Test | Lighthouse CI | Lighthouse score ≥90, LCP <3s |
| **50 Concurrent Users/Tenant** | Load Test | k6 | Simulate 50 VUs for 5 min → p95 response time <500ms |
| **API Response Time <500ms** | Load Test | k6 | p95 latency for Convex queries/mutations <500ms |
| **Real-time Sync Latency <1s** | E2E | Playwright (2 contexts) | PO creates item → measure time until DU sees update |

**Performance Gate Criteria:**
- ✅ PASS: All SLOs met (Blockly <2s, interactions <100ms, p95 <500ms)
- ⚠️ CONCERNS: 1-2 SLOs missed by <20% (e.g., Blockly loads in 2.3s)
- ❌ FAIL: Any SLO missed by >20% or multiple SLOs failed

**k6 Load Test Script Pattern:**
```javascript
// tests/performance/tenant-concurrent-users.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50, // 50 concurrent users
  duration: '5m',
  thresholds: {
    http_req_duration: ['p95<500'], // 95th percentile <500ms
    http_req_failed: ['rate<0.01'],  // Error rate <1%
  },
};

export default function () {
  const res = http.get('https://procureline.convex.cloud/query/plans');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

### 4.3 Scalability NFRs (6 requirements)

**Key Requirements:**
- Scale from 50 to 500 tenants
- Support 200 concurrent users system-wide
- Handle 1M+ catalog items

| NFR | Test Type | Tool | Validation Method |
|-----|-----------|------|-------------------|
| **500 Tenants** | Smoke Test | k6 + Data Seeding | Seed 500 tenants → query random tenant → verify <500ms |
| **200 Concurrent Users** | Load Test | k6 | 200 VUs across 10 tenants for 10 min → p95 <500ms, error rate <1% |
| **1M+ Catalog Items** | Stress Test | k6 + Convex Seeding | Seed 1M items → query with pagination → verify <500ms per page |
| **Database Query Performance** | Integration | Vitest (Convex test client) | Query 100K items with filters → measure execution time |
| **Pagination Efficiency** | Integration | Vitest | Fetch 1000 pages of 1000 items → verify constant query time |

**Scalability Gate Criteria:**
- ✅ PASS: 200 concurrent users supported, 1M items queryable with <500ms latency
- ⚠️ CONCERNS: Performance degrades at 150+ users or 800K+ items
- ❌ FAIL: System fails at <100 users or <500K items

### 4.4 Reliability NFRs (7 requirements)

**Key Requirements:**
- 99.5% uptime (43.8 hours downtime/year)
- 1-hour RPO (Recovery Point Objective)
- 4-hour RTO (Recovery Time Objective)
- Automated daily backups

| NFR | Test Type | Tool | Validation Method |
|-----|-----------|------|-------------------|
| **99.5% Uptime** | Monitoring | Vercel Analytics + Convex Dashboard | Track uptime over 30 days → verify ≥99.5% |
| **Error Handling** | Integration + E2E | Vitest + Playwright | Trigger network errors, timeouts → verify graceful degradation |
| **Retry Logic** | Integration | Vitest | Mock transient failure → verify exponential backoff retry |
| **Circuit Breaker** | Integration | Vitest | Fail NestJS endpoint 5x → verify circuit opens, requests fail fast |
| **Health Checks** | Integration | Supertest | `GET /health` on NestJS → verify 200 + DB connection status |
| **Backup Verification** | Manual + Scripted | Convex CLI | `convex export` → restore to staging → verify data integrity |
| **Disaster Recovery** | Manual Runbook | N/A | Simulate Convex Cloud outage → test 4hr RTO failover process |

**Reliability Gate Criteria:**
- ✅ PASS: All error handlers present, retries functional, health checks pass
- ⚠️ CONCERNS: 1-2 error scenarios not handled, retries missing on non-critical paths
- ❌ FAIL: No error handling, health checks fail, backup process broken

### 4.5 Accessibility NFRs (6 requirements)

**Key Requirements:**
- WCAG 2.1 Level AA compliance
- Keyboard navigation for all features
- Screen reader support (NVDA/JAWS)
- High contrast mode

| NFR | Test Type | Tool | Validation Method |
|-----|-----------|------|-------------------|
| **WCAG 2.1 AA Compliance** | Automated Scan | Axe DevTools / Pa11y CI | Scan all pages → 0 violations |
| **Keyboard Navigation** | E2E | Playwright | Navigate entire app with `Tab`/`Enter`/`Esc` → verify no mouse needed |
| **Screen Reader Support** | Manual + Automated | NVDA + Axe | Test critical flows with NVDA → verify announcements |
| **High Contrast Mode** | Visual Regression | Playwright | Enable Windows High Contrast → screenshot comparison |
| **Focus Management** | E2E | Playwright | Verify focus trap in modals, logical tab order |
| **Alt Text on Images** | Static Analysis | Axe / ESLint | Verify all `<img>` have `alt` attribute |

**Accessibility Gate Criteria:**
- ✅ PASS: 0 Axe violations, keyboard navigation functional, screen reader tested
- ⚠️ CONCERNS: 1-5 minor violations, keyboard navigation has 1-2 gaps
- ❌ FAIL: >5 violations, critical features not keyboard accessible

### 4.6 Integration NFRs (6 requirements)

**Key Requirements:**
- Excel 2016+ compatibility
- GOK template format matching
- Email delivery <60 seconds
- Stripe/IntaSend payment success rate >99%

| NFR | Test Type | Tool | Validation Method |
|-----|-----------|------|-------------------|
| **Excel 2016+ Compatibility** | Integration | Vitest + ExcelJS | Generate Excel → parse with ExcelJS → validate schema/formulas |
| **GOK Template Matching** | Integration | Vitest + ExcelJS | Export plan → compare structure to GOK fixture → assert match |
| **Email Delivery <60s** | E2E | Playwright + Mailhog | Trigger email → poll Mailhog → assert received within 60s |
| **Stripe Payment Success** | E2E | Playwright + Stripe Test Mode | Complete checkout → verify webhook → assert subscription active |
| **M-Pesa Payment (IntaSend)** | E2E | Playwright + IntaSend Sandbox | Initiate M-Pesa → simulate STK push → verify payment confirmation |
| **Webhook Resilience** | Integration | Supertest | Send duplicate webhook → verify idempotency (no double-charge) |

**Integration Gate Criteria:**
- ✅ PASS: All integrations functional, email delivery <60s, payment success rate 100% in test mode
- ⚠️ CONCERNS: Email delivery 60-90s, 1-2 edge cases fail (e.g., duplicate webhook)
- ❌ FAIL: Excel export broken, email delivery >90s, payment flow fails

### 4.7 Data Governance NFRs (5 requirements)

**Key Requirements:**
- 7-year audit log retention
- Kenya data residency
- GDPR-style data export/deletion

| NFR | Test Type | Tool | Validation Method |
|-----|-----------|------|-------------------|
| **7-Year Retention** | Manual Verification | Convex Dashboard | Verify audit log tables have no TTL configured |
| **Kenya Data Residency** | Manual Audit | Convex Cloud Settings | Verify Convex region set to `eu-west-1` (closest to Kenya) |
| **Data Export** | Integration | Vitest | Trigger export → verify JSON contains user data |
| **Data Deletion** | Integration | Vitest | Trigger deletion → verify soft delete (user record anonymized, audit logs retained) |
| **Audit Log Coverage** | Static Analysis | Custom Script | Scan all mutations → verify audit log write |

**Data Governance Gate Criteria:**
- ✅ PASS: All mutations audited, export/deletion functional, region verified
- ⚠️ CONCERNS: 1-2 mutations missing audit logs, export incomplete
- ❌ FAIL: No audit logging, data residency in wrong region, deletion violates 7-year retention

### 4.8 NFR Testing Toolchain Summary

| Category | Primary Tools | Secondary Tools |
|----------|--------------|-----------------|
| **Security** | Playwright, Vitest, ZAP/Burp | CodeQL, Semgrep |
| **Performance** | k6, Playwright Performance API, Lighthouse CI | Vercel Speed Insights |
| **Scalability** | k6, Convex Seeding Scripts | Artillery |
| **Reliability** | Vitest, Playwright, Convex CLI | Sentry, LogRocket |
| **Accessibility** | Axe DevTools, Pa11y CI, Playwright | NVDA, JAWS |
| **Integration** | Vitest + ExcelJS, Playwright, Mailhog | Stripe CLI, Postman |
| **Data Governance** | Vitest, Custom Scripts | Convex Dashboard |

---

## 5. Testability Concerns & Risk Mitigation

Consolidating concerns from the testability review and NFR analysis, prioritized by risk impact.

### 5.1 HIGH PRIORITY (Blocks Test Development)

**CONCERN-1: Clerk→Convex Auth Migration Incomplete**
- **Impact:** Auth tests cannot stabilize until migration completes
- **Affected ASRs:** ASR-2 (Authentication & Authorization)
- **Risk Score:** 9/9 (Probability: 3, Impact: 3)
- **Evidence:** Architecture specifies Convex Auth, but starter template uses Clerk
- **Mitigation:**
  1. Complete Clerk→Convex Auth migration BEFORE writing auth-related tests
  2. Document auth patterns in `project-context.md` to prevent agent inconsistency
  3. Create auth test fixtures AFTER migration stabilizes
- **Gate Decision:** ❌ BLOCKS implementation-readiness gate until migrated

**CONCERN-2: Email Interception Strategy Undefined**
- **Impact:** Cannot test 2FA flows, email OTP, or notification delivery
- **Affected ASRs:** ASR-2 (Authentication), NFR (Email delivery <60s)
- **Risk Score:** 6/9 (Probability: 2, Impact: 3)
- **Evidence:** No email interception tool specified in architecture
- **Mitigation:**
  1. **Option A (Recommended):** Use Resend test mode API keys + webhook capture
  2. **Option B:** Deploy Mailhog locally for E2E tests
  3. Add Playwright helper: `await interceptEmail(email)` → returns OTP code
- **Gate Decision:** ⚠️ CONCERNS - Can proceed with mocked emails, but real E2E tests blocked

**CONCERN-3: External Payment Mocking Undefined**
- **Impact:** Payment E2E tests blocked without Stripe/IntaSend test strategy
- **Affected ASRs:** ASR (Payment integration), NFR (Payment success >99%)
- **Risk Score:** 6/9 (Probability: 2, Impact: 3)
- **Evidence:** No test mode configuration documented for NestJS microservice
- **Mitigation:**
  1. NestJS must expose test fault injection endpoints: `/test/stripe/fail`, `/test/mpesa/timeout`
  2. Use Stripe test mode API keys (`sk_test_...`) and Stripe CLI for webhook forwarding
  3. Use IntaSend sandbox environment for M-Pesa STK push testing
  4. Document payment test patterns in NestJS README
- **Gate Decision:** ⚠️ CONCERNS - Can proceed with Stripe/IntaSend sandboxes, but fault injection needed

### 5.2 MEDIUM PRIORITY (Reduces Test Quality)

**CONCERN-4: Distributed Observability Gap**
- **Impact:** Production debugging difficult, E2E test failures hard to diagnose
- **Affected ASRs:** ASR-7 (99.5% uptime), NFR (Reliability)
- **Risk Score:** 4/9 (Probability: 2, Impact: 2)
- **Evidence:** No unified logging/tracing across Vercel + Convex Cloud + Railway
- **Mitigation:**
  1. Integrate Sentry or LogRocket for error tracking across all platforms
  2. E2E tests should capture HAR files, console logs, and Convex function logs on failure
  3. Playwright reporter: `reporter: [['html'], ['json', { outputFile: 'test-results.json' }]]`
  4. Add Convex function tracing: `console.log()` statements in critical paths
- **Gate Decision:** ⚠️ CONCERNS - Can proceed, but post-release debugging will be painful

**CONCERN-5: Convex Reactive Query Race Conditions**
- **Impact:** Flaky E2E tests due to real-time sync timing issues
- **Affected ASRs:** ASR-9 (Real-time collaboration)
- **Risk Score:** 4/9 (Probability: 2, Impact: 2)
- **Evidence:** Convex reactive queries update asynchronously, tests may check state too early
- **Mitigation:**
  1. Use Playwright `page.waitForFunction()` to poll Convex state:
     ```typescript
     await page.waitForFunction(() => {
       const state = window.convexClient.query('plans.get', { id: '123' });
       return state?.status === 'approved';
     });
     ```
  2. Avoid hard `page.waitForTimeout()` - always wait for observable state changes
  3. Document pattern in `tests/helpers/convex-waiters.ts`
- **Gate Decision:** ✅ PASS with mitigation - Playwright supports this pattern

**CONCERN-6: GOK Template Fixture Management**
- **Impact:** Excel export tests become brittle if templates change
- **Affected ASRs:** ASR-4 (Excel integration), NFR (GOK compliance)
- **Risk Score:** 3/9 (Probability: 1, Impact: 3)
- **Evidence:** GOK procurement templates are external, may change with government policy
- **Mitigation:**
  1. Version-control GOK template fixtures in `tests/fixtures/gok-templates/`
  2. Generate Excel files programmatically using ExcelJS (don't rely on binary fixtures)
  3. Create GOK template validator script: `validateGOKFormat(excelBuffer)`
  4. Document GOK template updates in test suite CHANGELOG
- **Gate Decision:** ✅ PASS with mitigation - Fixtures can be version-controlled

### 5.3 LOW PRIORITY (Nice to Have)

**CONCERN-7: Blockly Visual Regression Testing**
- **Impact:** Blockly UI changes undetected without visual regression
- **Affected ASRs:** ASR-3 (Blockly performance)
- **Risk Score:** 2/9 (Probability: 1, Impact: 2)
- **Evidence:** No visual regression strategy mentioned in architecture
- **Mitigation:**
  1. Use Playwright screenshot comparison for Blockly canvas:
     ```typescript
     await expect(page.locator('.blockly-workspace')).toHaveScreenshot();
     ```
  2. Acceptable pixel diff threshold: 0.1% (to allow anti-aliasing variance)
  3. Store baseline screenshots in `tests/baselines/blockly/`
- **Gate Decision:** ✅ PASS - Optional enhancement, not critical for MVP

**CONCERN-8: Multi-Tenant Test Data Isolation**
- **Impact:** Parallel tests may interfere if tenant IDs collide
- **Affected ASRs:** ASR-1 (Multi-tenant isolation)
- **Risk Score:** 2/9 (Probability: 1, Impact: 2)
- **Evidence:** No test data strategy mentioned
- **Mitigation:**
  1. Use `faker.datatype.uuid()` for unique tenant IDs in tests
  2. Playwright fixtures auto-cleanup tenants after each test:
     ```typescript
     export const tenantFixture = base.extend({
       tenantId: async ({ }, use) => {
         const id = faker.datatype.uuid();
         await createTenant(id);
         await use(id);
         await deleteTenant(id); // Cleanup
       },
     });
     ```
  3. Run tests in parallel with `fullyParallel: true` in Playwright config
- **Gate Decision:** ✅ PASS with mitigation - Standard Playwright pattern

### 5.4 Risk Summary & Gate Recommendation

| Concern | Risk Score | Blocks Gate? | Mitigation Status |
|---------|-----------|--------------|-------------------|
| CONCERN-1: Clerk→Convex Auth | 9/9 | ❌ YES | Must complete before implementation |
| CONCERN-2: Email Interception | 6/9 | ⚠️ Partial | Can use Resend test mode |
| CONCERN-3: Payment Mocking | 6/9 | ⚠️ Partial | Can use Stripe/IntaSend sandboxes |
| CONCERN-4: Observability Gap | 4/9 | No | Post-MVP enhancement |
| CONCERN-5: Reactive Query Races | 4/9 | No | Mitigated with Playwright waiters |
| CONCERN-6: GOK Fixture Mgmt | 3/9 | No | Mitigated with version control |
| CONCERN-7: Visual Regression | 2/9 | No | Optional |
| CONCERN-8: Test Data Isolation | 2/9 | No | Mitigated with fixtures |

**Overall Testability Gate Decision: ⚠️ CONCERNS**

**Reasoning:**
- CONCERN-1 (Clerk→Convex Auth) is a **blocker** - auth tests cannot proceed until migration completes
- CONCERN-2 and CONCERN-3 can proceed with test mode APIs, but fault injection capability is missing
- All other concerns have clear mitigations that can be implemented during test framework setup

**Recommendation for Implementation-Readiness Gate:**
1. ✅ **Approve architecture for implementation** (concerns are test-infrastructure, not design flaws)
2. ⚠️ **Require Clerk→Convex Auth migration completion** before starting auth-heavy epics (Epic 1: Foundation & Authentication)
3. ⚠️ **Recommend NestJS test endpoint additions** for payment fault injection (not blocking, but highly valuable)
4. ✅ **All other concerns mitigated** via standard test patterns (Playwright fixtures, waiters, version control)

---

## 6. Implementation Roadmap

### 6.1 Phase 1: Test Framework Setup (Before Epic 1)

**Objectives:**
- Initialize Playwright test framework with fixtures
- Set up Vitest for unit/integration tests
- Configure CI pipeline (GitHub Actions)
- Resolve CONCERN-1 (Clerk→Convex Auth migration)

**Deliverables:**
1. `tests/` directory structure:
   ```
   tests/
   ├── unit/              # Vitest unit tests (60%)
   ├── integration/       # Vitest + Convex/NestJS integration tests (30%)
   ├── e2e/               # Playwright E2E tests (10%)
   ├── fixtures/          # Test data, GOK templates, factories
   ├── helpers/           # Convex waiters, auth helpers, email interceptors
   └── performance/       # k6 load tests
   ```
2. Playwright config with tenant fixtures, parallel execution
3. Convex test client setup (local dev mode)
4. NestJS Supertest setup
5. CI pipeline with test execution, coverage reporting
6. **Clerk→Convex Auth migration COMPLETE** ✅

**Exit Criteria:**
- All 8 testability concerns mitigated or waived
- Sample E2E test passes (smoke test: load homepage)
- CI pipeline green
- Auth migration verified and documented

### 6.2 Phase 2: Epic-Level Test Development (During Sprints)

**For each epic:**
1. Run `/bmad:bmm:workflows:testarch-test-design` in Epic-Level Mode
2. Generate epic-specific test plan (e.g., `test-design-epic-1.md`)
3. Write ATDD tests BEFORE implementation (red-green-refactor)
4. Execute `/bmad:bmm:workflows:dev-story` with test-first approach
5. Run `/bmad:bmm:workflows:code-review` to validate test coverage
6. Execute `/bmad:bmm:workflows:testarch-trace` for requirements traceability

**Epic 1 Priority (Foundation & Authentication - 9 Stories):**
- ASR-2 validation: 2FA flows, RBAC, tenant isolation
- Security NFR validation: XSS/SQL injection, session timeout, CORS
- **Story 1.9 Security Tests:**
  - XSS protection: Test DOMPurify sanitization on all input fields
  - CORS: Verify unauthorized domains blocked
  - Input validation: Test Convex validators reject malformed data
  - Audit logging: Verify security events captured correctly
  - Security headers: Test CSP, X-Frame-Options via Playwright
- Integration tests: Convex Auth, email OTP, tenant creation
- **Next.js 16 Async APIs:** Test params/searchParams await patterns
- E2E tests: Platform Admin onboards tenant, Tenant Admin creates PO

### 6.3 Phase 3: NFR Validation (Before Release)

**Objectives:**
- Execute full NFR test suite
- Run `/bmad:bmm:workflows:testarch-nfr` for gate decision
- Perform load testing (k6), security scanning (ZAP), accessibility audit (Axe)

**Gate Criteria:**
- Security: 0 critical vulnerabilities, tenant isolation validated
- Performance: Blockly <2s, p95 latency <500ms, 200 concurrent users supported
- Scalability: 500 tenants, 1M items queryable
- Reliability: 99.5% uptime target, all error handlers present
- Accessibility: WCAG 2.1 AA compliance, 0 Axe violations
- Integration: Excel/email/payment flows functional
- Data Governance: Audit logs immutable, 7-year retention verified

**Deliverables:**
- NFR test report (from `/bmad:bmm:workflows:testarch-nfr`)
- Load test results (k6 HTML report)
- Security scan report (ZAP/Burp)
- Accessibility audit (Axe DevTools)
- Requirements traceability matrix (from `/bmad:bmm:workflows:testarch-trace`)

---

## 7. Appendix

### 7.1 Knowledge Base References

This test design was informed by the following TEA knowledge base fragments:

- `nfr-criteria.md`: NFR validation via automated tests (Security, Performance, Reliability, Maintainability)
- `test-levels-framework.md`: Unit/Integration/E2E selection guidance
- `risk-governance.md`: Risk scoring (probability × impact), gate decision engine
- `test-quality.md`: Test quality standards (deterministic, isolated, <300 lines, <1.5 min, explicit assertions)

### 7.2 Related Documents

- [Architecture.md](./architecture.md): Complete architectural decisions document
- [PRD.md](./prd.md): Product Requirements Document (464 FRs, 39 NFRs)
- [Epics.md](./epics.md): 11 epics, 64 stories
- [bmm-workflow-status.yaml](./bmm-workflow-status.yaml): Workflow progress tracking

### 7.3 Next Steps

1. **Immediate:** Present this test design to Architect for implementation-readiness gate review
2. **After gate approval:** Execute Phase 1 (Test Framework Setup)
3. **Before Epic 1:** Verify Clerk→Convex Auth migration complete
4. **During sprints:** Run epic-level test-design workflow for each epic
5. **Before release:** Execute NFR validation workflow

---

**Document Status:** ✅ COMPLETE - Ready for Implementation-Readiness Gate Review
**Testability Score:** 7/10 - ACCEPTABLE with CONCERNS
**Gate Recommendation:** ⚠️ APPROVE with CONDITIONS (Clerk→Convex Auth migration required)

**Generated by:** Murat (TEA - Test Engineer & Automation)
**Workflow:** test-design (System-Level Mode)
**Date:** 2026-02-03
