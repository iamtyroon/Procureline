---
project_name: 'Procureline'
user_name: 'Tyroon'
date: '2026-01-19'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'style_rules', 'critical_rules', 'architecture_patterns']
status: 'complete'
rule_count: 68
optimized_for_llm: true
tech_stack_version: 3
architecture_version: 1
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 14+ | App Router, Server Components default |
| TypeScript | 5.x | Strict mode enabled |
| React | 18/19 | Concurrent features |
| Convex | latest | Primary backend - Database + Auth + Functions + Storage |
| NestJS | 10.x | Integration microservice (payments, Excel, email) |
| shadcn/ui | latest | Tailwind-based components |
| Tailwind CSS | 3.x | JIT compilation |
| Google Blockly | latest | Visual block editor |
| ExcelJS | latest | Excel generation (in NestJS) |
| Zod | 3.x | Schema validation |
| react-hook-form | 7.x | Form handling |
| date-fns | latest | Date formatting |
| Resend | latest | Transactional email |
| Stripe | latest | Card payments |
| IntaSend | latest | M-Pesa payments (Kenya) |

### Architecture Pattern

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Next.js    │───▶│    Convex    │───▶│   NestJS     │
│   (Vercel)   │    │   (Primary)  │    │ (Integrations)│
│              │    │              │    │              │
│ • Blockly UI │    │ • Database   │    │ • Stripe     │
│ • SSR/SSG    │    │ • Auth       │    │ • IntaSend   │
│ • React      │    │ • Real-time  │    │ • Resend     │
│              │    │ • Functions  │    │ • Excel I/O  │
└──────────────┘    └──────────────┘    └──────────────┘
     Vercel           Convex Cloud       Railway/Render
```

### Version Constraints
- Node.js 18+ required
- Convex uses its own runtime for functions
- NestJS runs on Node.js 20 LTS

---

## Critical Implementation Rules

### TypeScript Rules

**Configuration Requirements:**
- Strict mode enabled - no implicit `any`
- `noUncheckedIndexedAccess: true` for safer array access
- Path aliases configured: `@/*` maps to `src/*`

**Import Conventions:**
- ALWAYS use path aliases: `import { Button } from '@/components/ui/button'`
- NEVER use deep relative imports: `../../../components` is forbidden
- Group imports: external → internal → convex → types → styles

**Type Patterns:**
- Use `interface` for object shapes, `type` for unions/intersections
- Export types alongside their implementations
- Zod schemas are the source of truth - infer types with `z.infer<typeof schema>`
- Convex schemas define database types - use `Doc<"tableName">` for document types

**Error Handling:**
- Convex mutations should throw `ConvexError` for expected errors
- Client code catches errors with try/catch around `useMutation` calls
- Use Zod `.safeParse()` for input validation before Convex calls

### Next.js & React Rules

**Server vs Client Components:**
- Components are Server Components by default
- Add `'use client'` ONLY when needed (hooks, browser APIs, Blockly, Convex hooks)
- Blockly components MUST be client components
- Convex hooks (`useQuery`, `useMutation`) require client components

**Convex Integration:**
- Wrap app with `ConvexProvider` in layout
- Use `useQuery()` for reactive data fetching - NO manual refetching needed
- Use `useMutation()` for data mutations
- Convex queries are automatically real-time - UI updates instantly

**Server Actions:**
- Use ONLY for non-Convex operations (rare)
- Most mutations go through Convex functions instead
- Place in `src/actions/*.ts` if needed for third-party integrations

**Route Handlers (API Routes):**
- Use ONLY for webhooks (Stripe, IntaSend callbacks)
- Use ONLY for streaming responses if needed
- Place in `src/app/api/` directory
- Verify webhook signatures before processing

### Convex Rules

**Function Types:**
- `query` - Read-only, cached, reactive, runs on every relevant data change
- `mutation` - Write operations, runs once, can call other mutations
- `action` - For external API calls (NestJS, Stripe, email), NOT reactive

**Client Usage:**
```typescript
// In client components
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const plans = useQuery(api.plans.list, { tenantId });
const createPlan = useMutation(api.plans.create);
```

**Schema Definition:**
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  plans: defineTable({
    tenantId: v.id("tenants"),
    departmentId: v.id("departments"),
    blocklyData: v.string(), // JSON serialized
    status: v.union(v.literal("draft"), v.literal("submitted"), v.literal("approved")),
    createdAt: v.number(),
  }).index("by_tenant", ["tenantId"]),
});
```

**Multi-Tenancy:**
- EVERY tenant-scoped table has `tenantId` field
- ALWAYS filter queries by `tenantId` in Convex functions
- Get `tenantId` from authenticated user's identity
- NEVER trust client-provided `tenantId` - derive from auth

**Auth Integration:**
```typescript
// In Convex functions
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const myQuery = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const tenantId = identity.tenantId; // Custom claim
    // ... query with tenantId filter
  },
});
```

### NestJS Microservice Rules

**When to Use NestJS (vs Convex):**
- Payment processing (Stripe, IntaSend)
- Excel file generation and parsing
- Email sending via Resend
- Complex scheduled jobs
- Third-party API integrations with retries

**Communication Pattern:**
- Convex actions call NestJS REST endpoints
- NestJS verifies requests using shared secret or JWT
- NestJS can call Convex HTTP actions for data access

**API Response Format (MANDATORY):**
```typescript
// Success response - ALL NestJS endpoints MUST use this format
{
  success: true,
  data: {
    // Actual response data
  }
}

// Error response
{
  success: false,
  error: {
    code: "PAYMENT_FAILED",  // Use standard error codes
    message: "Card declined",
    details?: { ... }  // Optional additional info
  }
}
```

**API Endpoint Naming:**
- Endpoints: kebab-case, plural (`/api/payment-intents`, `/api/excel-exports`)
- Route params: camelCase (`/api/tenants/:tenantId`)
- Query params: camelCase (`?fiscalYear=2025-2026`)
- Custom headers: X-Prefix (`X-Tenant-Id`)

**API Security:**
- All NestJS endpoints require JWT verification
- JWTs issued by Convex Auth
- Verify `tenantId` claim matches request context

**JWT Structure for Service Calls:**
```typescript
{
  sub: "user_id",
  tenantId: "tenant_id",
  role: "PO" | "DU" | "TenantAdmin" | "PlatformAdmin",
  departmentId?: "dept_id", // For DU users
  iat: timestamp,
  exp: timestamp
}
```

### Testing Rules

**Test Organization:**
- Co-locate tests with source files: `Component.tsx` → `Component.test.tsx`
- Convex function tests in `convex/__tests__/`
- E2E tests in `e2e/` directory (Playwright)

**Test Naming:**
- File: `{ComponentName}.test.tsx` or `{function-name}.test.ts`
- Describe blocks: Component/function name
- Test cases: `it('should {expected behavior} when {condition}')`

**Testing Patterns:**
- Use Convex testing utilities for function tests
- Mock Convex client for React component tests
- Test NestJS with supertest
- Blockly tests: mock workspace, test calculations separately

**What to Test:**
- All Convex mutations (happy path + error cases)
- Form validation with Zod schemas
- Budget calculation logic
- Role-based UI visibility
- Blockly serialization/deserialization
- NestJS integration endpoints

### Naming Conventions

**Convex (Database):**
- Tables: `camelCase`, plural (`users`, `plans`, `customFieldDefinitions`)
- Fields: `camelCase` (`tenantId`, `createdAt`, `blocklyData`)
- Indexes: `by_{field}` pattern (`by_tenant`, `by_department`)

**TypeScript/React:**
- Components: `PascalCase` (`BlocklyWorkspace`, `PlanCard`)
- Component files: `PascalCase.tsx` (`BlocklyWorkspace.tsx`)
- Utility files: `kebab-case.ts` (`excel-generator.ts`)
- Functions: `camelCase` (`submitPlan`, `getCategoriesWithItems`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_ITEMS_PER_CATEGORY`)
- Zod schemas: `camelCase` + Schema (`planSchema`, `itemInputSchema`)

**Convex Functions:**
- Files: `camelCase.ts` (`plans.ts`, `departments.ts`)
- Functions: `camelCase` (`create`, `list`, `getById`)
- Internal functions: prefix with `_` (`_validateTenant`)

**Blockly:**
- Block types: `snake_case` (`department_block`, `category_block`, `item_block`)
- Block fields: `UPPER_SNAKE_CASE` (`DEPT_NAME`, `UNIT_PRICE`, `Q1_QTY`)
- Block colors: HSV format `{ h: 210, s: 0.7, v: 0.8 }`

**Audit Log Events:**
- Event names: `dot.notation.lowercase` (`plan.created`, `plan.submitted`, `department.updated`)
- Entity prefix: singular noun (`plan.`, `user.`, `department.`)
- Action suffix: past tense verb (`.created`, `.updated`, `.deleted`, `.submitted`, `.approved`)

### Audit Logging Pattern

**MANDATORY: Log all state-changing operations:**
```typescript
// convex/functions/auditLogs.ts
export const log = mutation({
  args: {
    event: v.string(),        // "plan.submitted"
    entityType: v.string(),   // "plan"
    entityId: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await ctx.db.insert("auditLogs", {
      tenantId: identity.tenantId,
      userId: identity.subject,
      event: args.event,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata ?? {},
      timestamp: Date.now(),
    });
  },
});
```

### Fiscal Year & Date Handling

**Kenya Fiscal Year: July 1 - June 30**

```typescript
// lib/utils/fiscal-year.ts
export function getFiscalYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  if (month >= 6) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

export function getCurrentFiscalYear(): string {
  return getFiscalYear(new Date());
}

export function isFiscalYearActive(fiscalYear: string): boolean {
  return fiscalYear === getCurrentFiscalYear();
}
```

**Date Storage & Display:**
- Storage: Always UTC ISO 8601 (`new Date().toISOString()`)
- Display: Use date-fns with consistent format
- Format for display: `format(date, 'dd MMM yyyy')` → "01 Jul 2025"
- Format with time: `format(date, 'dd MMM yyyy HH:mm')` → "01 Jul 2025 10:30"

### Compliance Calculations

**CENTRALIZED: All compliance calculations in `convex/functions/compliance.ts`**

```typescript
// NEVER duplicate these constants or calculations
const AGPO_YOUTH_WOMEN_PERCENT = 30;
const AGPO_PWD_PERCENT = 2;
const LOCAL_CONTENT_PERCENT = 40;

export const calculateCompliance = query({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    // ... centralized calculation logic
    return {
      totalValue,
      agpo: { value, percent, threshold: AGPO_YOUTH_WOMEN_PERCENT, compliant },
      pwd: { value, percent, threshold: AGPO_PWD_PERCENT, compliant },
      localContent: { value, percent, threshold: LOCAL_CONTENT_PERCENT, compliant },
      overallCompliant,
    };
  },
});
```

**Anti-Pattern:**
```typescript
// WRONG: Duplicate compliance calculation
const agpoPercent = (agpoValue / total) * 100; // Use centralized function instead!
```

### UI Patterns

**Forms:**
- ALWAYS use: `react-hook-form` + `zodResolver` + shadcn/ui `Form`
- NEVER use uncontrolled inputs or manual validation

**User Feedback:**
- Use `sonner` toast for notifications: `toast.success()`, `toast.error()`
- NEVER use `alert()` or `console.log()` for user feedback

**Loading States:**
- Convex queries: check if result is `undefined` (loading)
- Mutations: use returned promise or `isPending` from custom hook
- Show `<Loader2 className="animate-spin" />` during loading

**Currency Display:**
- Format: `KES 1,500,000.00`
- Use helper: `formatCurrency(amount)` from `@/lib/utils/currency`

**Real-Time Updates:**
- Convex provides automatic real-time sync
- NO manual polling or refetching needed
- UI updates automatically when data changes

### Critical Don't-Miss Rules

**Multi-Tenancy Anti-Patterns:**
- NEVER query without tenant context - verify in every Convex function
- NEVER expose `tenantId` selection to users - derive from auth identity
- NEVER allow cross-tenant data access except for Platform Admin
- NEVER hardcode tenant IDs in code
- ALWAYS check `identity.tenantId` matches requested resource

**Blockly-Specific Rules:**
- ALWAYS use JSON serialization (not XML) for storage
- ALWAYS include metadata (savedAt, savedBy, fiscalYear) in saved workspaces
- NEVER modify Blockly workspace directly - use Blockly's API methods
- ALWAYS recalculate totals when blocks change (use workspace change listeners)
- LAZY LOAD Blockly component - it's a large bundle

**Security Rules:**
- NEVER log sensitive data (passwords, tokens, full JWT)
- NEVER expose Convex deployment URL/keys to unauthorized parties
- ALWAYS validate role before sensitive operations (don't trust UI alone)
- ALWAYS verify webhook signatures (Stripe, IntaSend)
- 2FA is MANDATORY for all users

**Convex-Specific Security:**
- NEVER use `internalMutation` from client-callable functions
- ALWAYS check auth in every query/mutation that accesses tenant data
- Use `ctx.auth.getUserIdentity()` at the start of every function

**GOK Compliance Rules:**
- Excel exports MUST match government template structure exactly
- AGPO percentages: 30% youth/women, 2% PWD, 40% local
- Fiscal year format: `YYYY-YYYY` (e.g., `2025-2026`)
- Vote numbers are required for department identification

**Performance Gotchas:**
- Blockly bundles are large - lazy load the editor component
- Excel generation runs in NestJS - stream for large plans
- Convex queries are reactive - avoid unnecessary recomputation in components
- Use `useMemo` for expensive Blockly calculations derived from query data

**Role-Based Access Matrix:**

| Action | Platform Admin | Tenant Admin | PO | DU |
|--------|---------------|--------------|----|----|
| View/manage all tenants | ✅ | ❌ | ❌ | ❌ |
| Manage POs | ❌ | ✅ | ❌ | ❌ |
| Manage DUs | ❌ | ✅ | ❌ | ❌ |
| View DU plans | ❌ | ✅ | ✅ | ❌ |
| View consolidated plans | ❌ | ✅ | ✅ | ❌ |
| View/manage departments | ❌ | ❌ | ✅ | ❌ |
| View/manage categories & items | ❌ | ❌ | ✅ | ❌ |
| Review & approve plans | ❌ | ❌ | ✅ | ❌ |
| Consolidate plans | ❌ | ❌ | ✅ | ❌ |
| Export consolidated plans | ❌ | ❌ | ✅ | ❌ |
| Create department plan | ❌ | ❌ | ❌ | ✅ |
| Export own dept plan | ❌ | ❌ | ❌ | ✅ |

---

## Integration Patterns

### Convex → NestJS Communication

**ALWAYS pass JWT for user context preservation (audit trails):**

```typescript
// convex/actions/payments.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const createPaymentIntent = action({
  args: {
    tenantId: v.id("tenants"),
    amount: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Create JWT with user context for audit trail
    const jwt = await createServiceJwt({
      sub: identity.subject,
      tenantId: args.tenantId,
      role: identity.role,
    });

    const response = await fetch(`${process.env.NESTJS_URL}/api/payment-intents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
      },
      body: JSON.stringify({ amount: args.amount, currency: args.currency }),
    });

    const result = await response.json();

    // Handle standardized NestJS response format
    if (!result.success) {
      throw new ConvexError({ code: result.error.code, message: result.error.message });
    }
    return result.data;
  },
});
```

**Error Code Standard:**
```typescript
type ErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "TENANT_NOT_FOUND"
  | "DEPARTMENT_NOT_FOUND"
  | "PLAN_NOT_FOUND"
  | "VALIDATION_FAILED"
  | "QUOTA_EXCEEDED"
  | "DEADLINE_PASSED"
  | "ALREADY_EXISTS"
  | "PAYMENT_FAILED"
  | "EXPORT_FAILED";

// Usage
throw new ConvexError({
  code: "VALIDATION_FAILED",
  field: "budget",
  message: "Budget exceeds department allocation"
});
```

### Webhook Handling

```typescript
// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature")!;
  const body = await req.text();

  // Verify signature FIRST
  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  // Process event...
}
```

---

## File Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, signup)
│   ├── (dashboard)/       # Authenticated pages
│   │   ├── platform-admin/
│   │   ├── tenant-admin/
│   │   ├── po/            # Procurement Officer
│   │   └── du/            # Departmental User
│   └── api/               # Webhooks only
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── blockly/           # Blockly workspace components
│   └── shared/            # Shared components
├── lib/
│   ├── utils/             # Utility functions
│   └── validators/        # Zod schemas
└── convex/                # Convex backend
    ├── schema.ts          # Database schema
    ├── auth.ts            # Auth configuration
    ├── plans.ts           # Plan functions
    ├── departments.ts     # Department functions
    └── actions/           # External API actions
```

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Reference `_bmad-output/planning-artifacts/tech-stack-decisions.md` for technology rationale
- Reference `_bmad-output/planning-artifacts/architecture.md` for detailed architectural decisions

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `architecture.md` | Complete architectural decisions, patterns, project structure |
| `tech-stack-decisions.md` | Technology selection rationale |
| `prd.md` | Product requirements (464 FRs, 39 NFRs) |

---

*Last Updated: 2026-01-19*
*Tech Stack Version: 3 (Convex + NestJS)*
*Architecture Version: 1*
