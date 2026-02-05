# Technology Stack Decisions - Procureline

**Author:** Tyroon
**Date:** 2026-01-18
**Status:** Approved
**Track:** Enterprise Greenfield

---

## Executive Summary

This document captures the technology stack decisions for Procureline, a multi-tenant SaaS procurement platform. These decisions were made through a structured discovery session and will inform the system architecture.

---

## Architecture Overview

```
                                 ┌─────────────────────────────────────┐
                                 │           PROCURELINE               │
                                 │      Enterprise Architecture        │
                                 └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          Next.js 16 (App Router)                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │    │
│  │  │   Blockly    │  │   Shadcn/ui  │  │  TailwindCSS │  │  TypeScript │  │    │
│  │  │  Workspace   │  │  Components  │  │   Styling    │  │    Strict   │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    Vercel                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRIMARY BACKEND                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           Convex Cloud                                   │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │    │
│  │  │  Real-time   │  │   Convex     │  │   Convex     │  │   Convex    │  │    │
│  │  │   Database   │  │     Auth     │  │   Functions  │  │   Storage   │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                 Convex Cloud                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            INTEGRATION MICROSERVICE                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         NestJS Microservice                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │    │
│  │  │   Stripe     │  │   IntaSend   │  │   Resend     │  │   Excel     │  │    │
│  │  │  Payments    │  │    M-Pesa    │  │    Email     │  │  Generation │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                              Railway / Render                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Decisions

### 1. Frontend Stack

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Framework** | Next.js 16 (App Router) | SSR, React 19 support, async APIs, excellent ecosystem, Vercel-native |
| **Language** | TypeScript (strict mode) | Type safety, better DX, reduced runtime errors |
| **UI Library** | Shadcn/ui + Radix | Accessible, customizable, modern design system |
| **Styling** | TailwindCSS | Utility-first, rapid development, consistent design |
| **Visual Builder** | Google Blockly | Core innovation - visual block programming for procurement |
| **State Management** | Convex React hooks | Real-time reactivity built into data layer |
| **Forms** | React Hook Form + Zod | Type-safe validation, excellent performance |

### 2. Backend Stack

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Primary Backend** | Convex | Real-time database, serverless functions, integrated auth |
| **Integration Service** | NestJS | Complex integrations, scheduled jobs, enterprise patterns |
| **Runtime** | Node.js 20 LTS | Stable, TypeScript support, large ecosystem |
| **API Style** | Convex functions + REST (NestJS) | Convex for real-time, REST for integrations |

### 3. Database & Storage

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Primary Database** | Convex Database | Real-time sync, automatic scaling, TypeScript-native |
| **Data Model** | Document-oriented with relations | Flexible for Blockly JSON, queryable for reporting |
| **Blockly Storage** | JSON documents with version history | Native Convex versioning, full audit trail |
| **File Storage** | Convex File Storage | Integrated, simple API, handles Excel exports/uploads |
| **Caching** | Convex built-in | Automatic query caching and invalidation |

### 4. Authentication & Security

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Auth Provider** | Convex Auth | Integrated, supports email/password + OAuth |
| **2FA Policy** | Required for ALL users | Enterprise security requirement |
| **Session Management** | JWT (Convex-issued) | Stateless, scalable, secure |
| **API Security** | JWT verification in NestJS | Single auth source, Convex as identity provider |
| **Tenant Isolation** | Application-level with tenant_id | Enforced at Convex function level |

### 5. Infrastructure & Deployment

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Frontend Hosting** | Vercel | Native Next.js support, edge network, auto-scaling |
| **Backend Hosting** | Convex Cloud | Managed, serverless, auto-scaling |
| **Microservice Hosting** | Railway or Render | Simple container deployment, auto-scaling |
| **CDN** | Vercel Edge Network | Built-in with Vercel deployment |
| **DNS** | Cloudflare | DDoS protection, fast DNS, free tier available |

### 6. Integrations

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Card Payments** | Stripe | Global standard, excellent API, webhook reliability |
| **M-Pesa Payments** | IntaSend | Kenya-focused, STK push, LPO/invoicing support |
| **Email** | Resend | Modern API, React Email support, reliable delivery |
| **Excel Generation** | ExcelJS (in NestJS) | Full XLSX support, GOK template compatibility |
| **SMS (future)** | Africa's Talking | Kenya coverage, reliable, developer-friendly |

### 7. Monitoring & Observability

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Frontend Analytics** | Vercel Analytics | Built-in, Core Web Vitals, no extra cost |
| **Backend Monitoring** | Convex Dashboard | Built-in function metrics, error tracking |
| **Error Tracking** | Convex + Vercel (MVP) | Upgrade to Sentry post-MVP if needed |
| **Uptime Monitoring** | BetterStack (free tier) | Simple uptime checks, alerts |
| **Log Aggregation** | Convex logs (MVP) | Built-in, upgrade to Axiom post-MVP if needed |

---

## Data Residency & Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Kenya Data Protection Act** | User consent flows, data export capability |
| **Data Location** | Convex Cloud (US) + CDN edge caching |
| **Audit Trail** | Convex versioning + custom audit log collection |
| **Retention** | 7 years for audit logs, configurable per data type |
| **Encryption** | TLS 1.3 in transit, AES-256 at rest (Convex default) |

**Note:** Convex Cloud is US-based. For strict Kenya data residency requirements, evaluate:
- Convex self-hosted (future option)
- Hybrid approach with sensitive data in local PostgreSQL

---

## Cost Estimation (MVP)

| Service | Tier | Estimated Monthly Cost |
|---------|------|------------------------|
| Vercel | Pro | $20 |
| Convex | Pro | $25 |
| Railway (NestJS) | Starter | $5-20 |
| Resend | Free tier (3K emails) | $0 |
| IntaSend | Transaction fees only | Variable |
| Stripe | Transaction fees only | Variable |
| Cloudflare | Free | $0 |
| BetterStack | Free tier | $0 |
| **Total Fixed** | | **~$50-65/month** |

---

## Architecture Principles

1. **Serverless-First** — Minimize infrastructure management, maximize scalability
2. **Real-Time by Default** — Convex provides real-time sync out of the box
3. **TypeScript Everywhere** — End-to-end type safety from DB to UI
4. **Single Source of Truth** — Convex as the authoritative data layer
5. **Microservice for Complexity** — NestJS handles integrations that don't fit serverless
6. **Progressive Enhancement** — Start simple, add complexity only when needed

---

## Migration Path

### If Convex Limitations Emerge:

| Scenario | Migration Path |
|----------|----------------|
| Need SQL queries | Add read replica with PostgreSQL sync |
| Data residency | Convex self-hosted or hybrid with Supabase |
| Scale limits | Convex enterprise tier or hybrid architecture |
| Feature gaps | NestJS microservice absorbs more responsibility |

---

## Decision Log

| Date | Decision | Made By | Rationale |
|------|----------|---------|-----------|
| 2026-02-03 | Upgrade to Next.js 16 | Tyroon + Team | Latest stable, async APIs, React 19 support |
| 2026-01-18 | Next.js frontend | Tyroon | Best React framework for SaaS |
| 2026-01-18 | Convex primary backend | Tyroon | Real-time, TypeScript-native, serverless |
| 2026-01-18 | NestJS microservice | Tyroon | Complex integrations, enterprise patterns |
| 2026-01-18 | Mandatory 2FA | Tyroon | Enterprise security requirement |
| 2026-01-18 | Stripe + IntaSend payments | Tyroon | Global cards + Kenya M-Pesa coverage |
| 2026-01-18 | Resend email | Tyroon | Modern, React Email support |
| 2026-01-18 | JSON Blockly storage | Tyroon | Native versioning, audit trail |

---

## Next.js 16 Migration Notes

### Breaking Changes
- **Async Request APIs**: `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are now async
- All code accessing these APIs must use `await`
- Automated codemod available: `npx @next/codemod@canary upgrade latest`

### New Features
- **React 19.2** support with improved performance
- **Turbopack** stable for faster builds
- **Cache Components** mode (experimental in 16.0.0, stable in canary)
- Improved error handling and debugging

### Migration Strategy
1. Start with Convex Ents SaaS Starter (Next.js 14)
2. Upgrade packages: `npm install next@16 react@latest react-dom@latest`
3. Run codemod to fix async API usage
4. Test all Convex integration points
5. Verify authentication flows work correctly

**Implementation**: See Epic 1, Story 1.1 for detailed migration steps.

---

## Security Implementation

### Core Security Features (Story 1.9)
- **XSS Protection**: DOMPurify for input sanitization
- **CORS**: Restricted to known domains (production, staging, localhost)
- **Input Validation**: React Hook Form + Zod + Convex validators
- **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options
- **Audit Logging**: Security events tracked in Convex database

### Compliance
- **Encryption at Rest**: AES-256 (Convex default) ✅
- **Encryption in Transit**: TLS 1.3 ✅
- **Session Security**: HTTP-only secure cookies, 24-hour timeout
- **Password Policy**: 12+ chars, complexity requirements
- **Failed Login Protection**: 5-attempt lockout

**Implementation**: See Epic 1, Story 1.9 for complete security infrastructure setup.

---

## Next Steps

1. **Architecture Document** — Create detailed system architecture based on these decisions
2. **Data Model Design** — Define Convex schema with tenant isolation
3. **Security Architecture** — Detail auth flows, RBAC implementation
4. **Integration Design** — NestJS microservice API contracts
5. **Blockly Integration** — Custom block definitions, serialization format

---

*Document generated by BMad Master during Tech Stack Discovery Session*
