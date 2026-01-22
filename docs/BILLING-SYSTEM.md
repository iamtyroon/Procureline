# Procureline Billing System Documentation

> Commercial billing strategy for Procureline - University Procurement Management SaaS

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Pricing Strategy](#2-pricing-strategy)
3. [Subscription Tiers](#3-subscription-tiers)
4. [Billing Models](#4-billing-models)
5. [Payment Processing](#5-payment-processing)
6. [Subscription Lifecycle](#6-subscription-lifecycle)
7. [Invoicing System](#7-invoicing-system)
8. [Usage Metering](#8-usage-metering)
9. [Discounts & Promotions](#9-discounts--promotions)
10. [Revenue Projections](#10-revenue-projections)
11. [Technical Implementation](#11-technical-implementation)
12. [Compliance & Legal](#12-compliance--legal)

---

## 1. Executive Summary

### Business Model
Procureline operates as a **B2B SaaS** (Software as a Service) platform targeting Kenyan universities and higher education institutions for procurement plan management.

### Revenue Streams
| Stream | Description | % of Revenue |
|--------|-------------|--------------|
| Subscription Fees | Monthly/Annual tier-based pricing | 85% |
| Setup & Onboarding | One-time implementation fee | 8% |
| Training Services | Additional training sessions | 4% |
| Custom Development | Bespoke features/integrations | 3% |

### Target Market Size (Kenya)
- **Public Universities:** 31 institutions
- **Private Universities:** 18 institutions
- **University Colleges:** 14 institutions
- **Technical Colleges:** 100+ institutions
- **Total Addressable Market (TAM):** ~165 institutions
- **Serviceable Addressable Market (SAM):** ~80 institutions (Year 1-3)

---

## 2. Pricing Strategy

### 2.1 Pricing Philosophy

**Value-Based Pricing** tied to:
- Number of departments managed
- User count
- Compliance automation value (time saved)
- Risk reduction (audit compliance)

### 2.2 Competitive Analysis

| Competitor | Model | Price Range (KES/mo) |
|------------|-------|---------------------|
| Manual Excel | N/A | Free (hidden costs: ~500K/yr in errors) |
| Generic ERP | Per-user | 200K - 1M+ |
| SAP Ariba | Enterprise | 2M+ |
| **Procureline** | Tiered | 50K - 400K |

### 2.3 Pricing Anchors

Based on:
- **Time Savings:** 40+ hours/month for PO = ~KES 80,000 value
- **Error Reduction:** Procurement errors cost avg. KES 500,000/year
- **Compliance Value:** PPRA audit failures cost KES 1M+ in penalties
- **Target:** Price at 10-15% of value delivered

---

## 3. Subscription Tiers

### 3.1 Pricing Rationale

**Why Annual Billing Only:**
- Procurement plans are created **once per fiscal year** (July - June)
- Universities budget annually - aligns with their financial planning
- Reduces administrative overhead (single invoice per year)
- Provides predictable revenue for Procureline
- Value is delivered annually, not monthly

### 3.2 Tier Overview

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| **Annual Fee** | KES 500,000 | KES 1,200,000 | KES 2,400,000 |
| **Per Month Equivalent** | ~KES 42,000 | ~KES 100,000 | ~KES 200,000 |
| **Departments** | Up to 10 | Up to 25 | Unlimited |
| **Users (DU)** | Up to 15 | Up to 50 | Unlimited |
| **Procurement Officers** | 1 | 1 | Up to 3 |
| **Storage** | 5 GB | 25 GB | 100 GB |
| **Excel Export (rows)** | Up to 500 rows | Up to 1,500 rows | Unlimited |
| **Plan Revisions** | 2 per year | 4 per year | Unlimited |
| **API Access** | No | Limited | Full |
| **Support** | Email (48hr) | Email + Chat (24hr) | Priority (4hr) + Phone |
| **Training** | Self-service | 2 sessions | Unlimited |
| **Custom Reports** | No | 3 templates | Unlimited |
| **Audit Log Retention** | 1 year | 3 years | 7 years |
| **SSO/LDAP** | No | No | Yes |
| **Dedicated Account Manager** | No | No | Yes |
| **Mid-Year Plan Support** | No | Yes | Yes |

### 3.3 Tier Positioning

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   STARTER              PROFESSIONAL           ENTERPRISE        │
│   KES 500K/yr          KES 1.2M/yr            KES 2.4M/yr       │
│                                                                 │
│   ┌─────────┐          ┌─────────┐            ┌─────────┐       │
│   │ Small   │          │ Medium  │            │ Large   │       │
│   │ College │          │ Univ.   │            │ Univ.   │       │
│   │         │          │         │            │         │       │
│   │ <10     │          │ 10-25   │            │ 25+     │       │
│   │ depts   │          │ depts   │            │ depts   │       │
│   └─────────┘          └─────────┘            └─────────┘       │
│                                                                 │
│   Technical            Regional               National          │
│   Colleges             Universities           Universities      │
│   Small Private        Mid-size Public        UoN, KU, JKUAT    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Detailed Feature Matrix

#### Core Features (All Tiers)
- [x] Blockly visual procurement planning
- [x] GOK compliance validation (AGPO 30%, PWD 2%, Local 40%)
- [x] Excel export (GOK template format)
- [x] Department management
- [x] Category management
- [x] Budget tracking
- [x] Basic reporting
- [x] Email notifications
- [x] Mobile-responsive interface

#### Professional Tier Additions
- [x] Advanced analytics dashboard
- [x] Bulk import from CSV/Excel
- [x] Custom procurement categories
- [x] Multi-year planning
- [x] Budget forecasting
- [x] Approval workflows
- [x] Document attachments
- [x] API access (read-only)

#### Enterprise Tier Additions
- [x] Multiple Procurement Officers
- [x] SSO integration (SAML, LDAP)
- [x] Custom branding
- [x] Advanced API (read/write)
- [x] Webhook integrations
- [x] Custom compliance rules
- [x] White-label option
- [x] SLA guarantee (99.9%)
- [x] Dedicated infrastructure option

---

## 4. Billing Models

### 4.1 Annual Billing (Standard)

**All subscriptions are billed annually** to align with:
- GOK Fiscal Year (July 1 - June 30)
- University budget planning cycles
- Procurement plan creation (once per year)

| Model | Price | Payment Terms |
|-------|-------|---------------|
| Annual (Standard) | Base price | Due at subscription start |
| Multi-year (2yr) | 10% discount | 50% upfront, 50% Year 2 |
| Multi-year (3yr) | 15% discount | 40/30/30 split |

### 4.2 Billing Cycle Alignment

**Fiscal Year Synchronization:**
- Kenya fiscal year: **July 1 - June 30**
- All subscriptions align to end on June 30
- Pro-rated first year for mid-year signups

**Pro-ration for Mid-Year Signup:**
```
Signup Date: October 15, 2025
Days until June 30, 2026: 258 days
Annual Rate: KES 1,200,000 (Professional)
Pro-rated Amount: KES 1,200,000 × (258/365) = KES 848,219

Year 2 onwards: Full annual fee due July 1
```

**Renewal Timeline:**
```
April 1    - Renewal reminder sent (90 days before)
May 1      - Second reminder + quote for next FY
June 1     - Final reminder + LPO request
June 15    - Grace period begins if unpaid
July 1     - New fiscal year begins / Renewal due
July 15    - Service suspended if unpaid
```

### 4.3 Billing Events

| Event | Trigger | Action |
|-------|---------|--------|
| New Subscription | Signup complete | Generate pro-rated invoice to June 30 |
| Annual Renewal | 90 days before June 30 | Send renewal quote |
| Upgrade | User initiates | Pro-rate difference to June 30 |
| Downgrade | User initiates | Apply at next fiscal year |
| Cancellation | User initiates | Access until June 30 |
| Non-payment | July 15 (15-day grace) | Suspend service |
| Late Renewal | After July 1 | Full year fee + 5% late fee |

---

## 5. Payment Processing

### 5.1 Payment Methods

#### Primary: Bank Transfer (LPO-based)
Most Kenyan universities require:
1. **Local Purchase Order (LPO)** generation
2. **Invoice submission** to finance department
3. **Bank transfer** (EFT) to vendor account

**Bank Details (Example):**
```
Account Name: Procureline Technologies Ltd
Bank: Equity Bank Kenya
Branch: University Way
Account: 1234567890123
Swift: EABORB1XXX
```

#### Secondary: M-Pesa (Paybill)
For smaller institutions and quick payments:
```
Paybill Number: 123456
Account: [Institution Code]
```

**M-Pesa Integration:**
- Daraja API integration
- Real-time payment confirmation
- Automated receipt generation

#### Tertiary: Card Payments (Stripe)
For international transactions and card-preferring clients:
- Visa/Mastercard
- 3D Secure enabled
- Multi-currency support

### 5.2 Payment Gateway Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PROCURELINE BILLING                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │   STRIPE    │    │   M-PESA    │    │   BANK      │    │
│   │   (Cards)   │    │   (Mobile)  │    │   (EFT)     │    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
│          │                  │                  │            │
│          ▼                  ▼                  ▼            │
│   ┌─────────────────────────────────────────────────┐      │
│   │           PAYMENT ORCHESTRATION LAYER            │      │
│   │  • Payment routing                               │      │
│   │  • Retry logic                                   │      │
│   │  • Reconciliation                                │      │
│   └─────────────────────────────────────────────────┘      │
│                           │                                 │
│                           ▼                                 │
│   ┌─────────────────────────────────────────────────┐      │
│   │              SUBSCRIPTION ENGINE                 │      │
│   │  • Billing cycles                                │      │
│   │  • Proration                                     │      │
│   │  • Usage tracking                                │      │
│   └─────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Payment Terms

| Institution Type | Default Terms | Extended Terms |
|-----------------|---------------|----------------|
| Private University | Net 15 | Net 30 |
| Public University | Net 30 | Net 45 |
| Government College | Net 45 | Net 60 |

### 5.4 Currency

- **Primary:** Kenya Shilling (KES)
- **Secondary:** US Dollar (USD) for international
- **Exchange Rate:** Updated daily from CBK

---

## 6. Subscription Lifecycle

### 6.1 Lifecycle Stages

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  TRIAL  │───▶│ ACTIVE  │───▶│ RENEWAL │───▶│ CHURNED │    │ LAPSED  │
│         │    │         │    │         │    │         │    │         │
│ 14 days │    │ Jul-Jun │    │ Apr-Jun │    │ Did not │    │ Grace   │
│ Free    │    │ Annual  │    │ Window  │    │ Renew   │    │ Period  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
      │              │              │              │              │
      │              │              │              │              │
      ▼              ▼              ▼              ▼              ▼
   Convert        Upgrade        Renew         Win-back      Reinstate
   or Expire      Mid-year       for Next FY   Next FY       (Jul 1-15)
```

**Annual Subscription Cycle:**
```
Jul 1  ──────────────────────────────────────────────────▶  Jun 30
│                                                              │
│  ACTIVE SUBSCRIPTION PERIOD (Fiscal Year)                    │
│                                                              │
├── Jul-Sep: Onboarding & Plan Creation                        │
├── Oct-Dec: Mid-year check-in                                 │
├── Jan-Mar: Usage review                                      │
├── Apr-Jun: Renewal discussions ◀── 90-day renewal window     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Trial Period

**Duration:** 14 days (extendable to 30 for qualified leads)

**Trial Includes:**
- Full Professional tier features
- Up to 5 departments
- Up to 10 users
- Sample data pre-loaded
- Onboarding call included
- Complete Blockly planning experience
- GOK compliance validation
- All dashboard and reporting features

**Trial Restriction:**
- **No Excel Export** - This is the only restriction
- Users can create, edit, and finalize plans but cannot export
- Export button shows upgrade prompt
- This ensures full evaluation while protecting the core deliverable

**Trial Conversion Tactics:**
1. Day 1: Welcome email + onboarding call scheduling
2. Day 3: Feature highlight email
3. Day 7: Check-in email + usage report
4. Day 10: Conversion offer email
5. Day 12: Final reminder + extension offer
6. Day 14: Trial expiry + grace period (3 days)

### 6.3 Upgrade Path

```
Starter ────────────────▶ Professional ────────────────▶ Enterprise
         Pro-rated fee                   Pro-rated fee
         Immediate access                Immediate access
```

**Mid-Year Upgrade Proration Formula:**
```
Upgrade Cost = (New Annual - Old Annual) × (Days Remaining / 365)

Example:
- Current: Starter (KES 500,000/year)
- Upgrading to: Professional (KES 1,200,000/year)
- Days remaining until June 30: 180 days

Proration = (1,200,000 - 500,000) × (180/365) = KES 345,205 due immediately
```

### 6.4 Downgrade Policy

- Downgrades take effect at next fiscal year (July 1)
- Must request by May 31 for next FY
- No partial refunds for current year
- Data exceeding new tier limits: 60-day export window
- Features disabled on July 1 of new FY

### 6.5 Cancellation

**Cancellation Policy:**
- No refunds for annual subscriptions
- Access continues until June 30
- Must notify by May 31 to prevent auto-renewal

**Cancellation Flow:**
1. User requests cancellation (before May 31)
2. Exit survey (required)
3. Retention offer presented (discount on renewal)
4. Confirmation with end date (June 30)
5. Access continues until June 30
6. Data export available until July 31
7. Data deletion on August 31

**Win-back Campaign (Next FY):**
- April (next year): "Ready to return?" email
- May: Special offer (20% off if renew)
- June: Final outreach before data deletion

---

## 7. Invoicing System

### 7.1 Invoice Format

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   PROCURELINE TECHNOLOGIES LTD                     INVOICE          │
│   P.O. Box 12345-00100                                              │
│   Nairobi, Kenya                                   INV-2025-00142   │
│   VAT PIN: P051234567A                                              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   BILL TO:                              INVOICE DATE: May 15, 2025  │
│   University of Nairobi                 DUE DATE: June 30, 2025     │
│   Finance Department                    PERIOD: FY 2025-26          │
│   P.O. Box 30197-00100                (July 1, 2025 - June 30, 2026)│
│   Nairobi, Kenya                                                    │
│   VAT PIN: P000123456B                  LPO REF: UON/FIN/2025/0234  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   DESCRIPTION                           QTY    RATE         AMOUNT  │
│   ─────────────────────────────────────────────────────────────────│
│   Procureline Enterprise Plan            1  2,400,000   2,400,000   │
│   (Annual Subscription - FY 2025-26)                                │
│   • Unlimited Departments                                           │
│   • Up to 3 Procurement Officers                                    │
│   • 100 GB Storage                                                  │
│   • Priority Support                                                │
│                                                                     │
│   ─────────────────────────────────────────────────────────────────│
│                                          SUBTOTAL:      2,400,000   │
│                                          VAT (16%):       384,000   │
│                                          ─────────────────────────  │
│                                          TOTAL DUE: KES 2,784,000   │
│                                                                     │
│   Less: Withholding Tax (5%):                          (139,200)    │
│   NET AMOUNT PAYABLE:                              KES 2,644,800    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   PAYMENT METHODS:                                                  │
│                                                                     │
│   Bank Transfer:                         M-Pesa Paybill:            │
│   Equity Bank Kenya                      Business No: 123456        │
│   A/C: 1234567890123                     Account: UON-ENT           │
│   Branch: University Way                                            │
│                                                                     │
│   Payment Terms: Due before July 1, 2025                            │
│   (5% early payment discount if paid by June 15)                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Invoice Types

| Type | Trigger | Purpose |
|------|---------|---------|
| Subscription Invoice | Billing cycle | Regular subscription fee |
| Pro-forma Invoice | On request | For LPO generation |
| Credit Note | Refund/Adjustment | Correct previous invoice |
| Debit Note | Additional charges | Usage overages |
| Receipt | Payment received | Proof of payment |

### 7.3 Invoice Numbering

**Format:** `INV-{YEAR}-{SEQUENCE}`

Example: `INV-2025-00142`

- Year resets sequence annually
- Sequence is globally unique
- Credit notes: `CN-2025-00012`
- Receipts: `RCP-2025-00089`

### 7.4 Tax Handling

**Kenya VAT (16%):**
- Applied to all subscription fees
- Exemptions require valid exemption certificate
- ETR (Electronic Tax Register) integration required

**Withholding Tax (5%):**
- Government institutions withhold 5%
- Net payment = Invoice - 5%
- WHT certificate required for reconciliation

**Example with WHT:**
```
Invoice Total:          KES 359,600
Less WHT (5%):          KES  17,980
Net Payment Expected:   KES 341,620
```

---

## 8. Usage Metering

### 8.1 Metered Components

| Component | Included (by Tier) | Overage Rate |
|-----------|-------------------|--------------|
| Departments | 10 / 25 / Unlimited | KES 20,000/dept/year |
| Users (DU) | 15 / 50 / Unlimited | KES 5,000/user/year |
| Storage | 5 / 25 / 100 GB | KES 2,000/GB/year |
| Plan Revisions | 2 / 4 / Unlimited | KES 25,000/revision |
| Excel Export Rows | 500 / 1,500 / Unlimited | Upgrade required |
| API Calls | 0 / 50K / 500K per year | KES 0.50/call |

**Excel Export Limits Explained:**
- Row limits apply per export (not cumulative)
- If plan exceeds tier limit, user must upgrade to export
- No overage purchase option - designed to encourage tier upgrades
- Enterprise tier has no row limits

### 8.2 Usage Tracking

**Annual Metrics Captured:**
```javascript
{
  "tenant_id": "T001",
  "fiscal_year": "2025-26",
  "period_start": "2025-07-01",
  "period_end": "2026-06-30",
  "metrics": {
    "departments": {
      "included": 25,
      "used": 24,
      "overage": 0
    },
    "users": {
      "included": 50,
      "active": 48,
      "overage": 0
    },
    "storage_gb": {
      "included": 25,
      "used": 18.4,
      "overage": 0
    },
    "plan_revisions": {
      "included": 4,
      "used": 2,
      "overage": 0
    },
    "api_calls": {
      "included": 50000,
      "used": 32500,
      "overage": 0
    }
  }
}
```

### 8.3 Overage Billing

**Billing Approach:** Overages invoiced at fiscal year end (June) or added to renewal invoice

**Overage Notifications:**
- 80% usage: Warning email to Tenant Admin
- 100% usage: Overage notification + upgrade recommendation
- Quarterly: Usage summary report

**Overage Caps:**
- Soft cap: 150% of included (charged overages at renewal)
- Hard cap: 200% of included (service throttled, upgrade required)

**Mid-Year Upgrade Incentive:**
If usage exceeds limits, offer pro-rated upgrade with overage fees waived

---

## 9. Discounts & Promotions

### 9.1 Standard Discounts

| Discount Type | Amount | Conditions |
|--------------|--------|------------|
| Multi-year (2yr) | 10% | 2-year commitment |
| Multi-year (3yr) | 15% | 3-year commitment |
| Nonprofit/NGO | 15% | Verified nonprofit status |
| Early Adopter | 25% | First 10 customers (locked for 2 years) |
| Referral Credit | KES 100,000 | Credit toward next renewal |
| Upfront Full Payment | 5% | Pay before July 1 |

### 9.2 Promotional Campaigns

**Launch Promotion (FY 2025-26):**
- 25% off first year subscription
- Free onboarding & training (worth KES 150,000)
- Extended 30-day trial

**Fiscal Year Promotions:**
- **April-June (Pre-FY):** Early bird 10% off for July starts
- **July (FY Start):** Free data migration from Excel

**Volume Discounts (Consortium):**
```
3-5 institutions:   10% off
6-10 institutions:  15% off
11+ institutions:   20% off + dedicated support
```

### 9.3 Coupon System

**Coupon Code Format:** `{TYPE}{AMOUNT}{RANDOM}`

Examples:
- `LAUNCH50OFF` - 50% off first payment
- `ANNUAL20PCT` - 20% off annual plan
- `REFER50K` - KES 50,000 credit

**Coupon Restrictions:**
- Single use vs. multi-use
- Expiration date
- Minimum purchase
- Tier restrictions
- New customers only

---

## 10. Revenue Projections

### 10.1 Year 1 Projections (FY 2025-26)

**Assumptions:**
- Launch: July 2025 (FY start)
- Target: 15 paying customers by June 2026
- Average deal size: KES 1,000,000/year (weighted avg)
- Trial conversion rate: 30%
- All billing is annual (aligned to fiscal year)

**Quarterly Progression:**

| Quarter | Trials | Conversions | Active Subs | Revenue (KES) |
|---------|--------|-------------|-------------|---------------|
| Q1 (Jul-Sep) | 25 | 5 | 5 | 5,000,000 |
| Q2 (Oct-Dec) | 20 | 4 | 9 | 3,200,000* |
| Q3 (Jan-Mar) | 15 | 3 | 12 | 1,800,000* |
| Q4 (Apr-Jun) | 12 | 3 | 15 | 1,200,000* |

*Pro-rated fees for mid-year signups

**FY 2025-26 Total Revenue:** KES 11,200,000 (~$86,000 USD)

**FY 2026-27 Projected (Full Year Renewals + New):**
- 15 renewals @ avg KES 1.1M = KES 16,500,000
- 12 new customers @ avg KES 1.0M = KES 12,000,000
- **Total: KES 28,500,000** (~$219,000 USD)

### 10.2 3-Year Projections

| Metric | FY 2025-26 | FY 2026-27 | FY 2027-28 |
|--------|------------|------------|------------|
| New Customers | 15 | 12 | 18 |
| Total Customers | 15 | 25 | 40 |
| Annual Revenue | 11.2M | 28.5M | 48M |
| Renewal Rate | N/A | 90% | 92% |
| Net Revenue Retention | N/A | 105% | 110% |

### 10.3 Revenue Mix Target

| Tier | Annual Fee | % of Customers | % of Revenue |
|------|-----------|---------------|--------------|
| Starter | KES 500,000 | 25% | 12% |
| Professional | KES 1,200,000 | 55% | 48% |
| Enterprise | KES 2,400,000 | 20% | 40% |

**Weighted Average Deal Size:** KES 1,070,000/year

### 10.4 Unit Economics

| Metric | Target |
|--------|--------|
| CAC (Customer Acquisition Cost) | KES 250,000 |
| ACV (Annual Contract Value) | KES 1,070,000 |
| LTV (5-year avg tenure) | KES 5,350,000 |
| LTV:CAC Ratio | 21:1 |
| Payback Period | 3 months |
| Gross Margin | 85% |

### 10.5 Seasonality Considerations

**Peak Sales Periods:**
- **April - June:** Budget planning season for next FY
- **July:** FY start - renewal season

**Slow Periods:**
- **August - September:** Post-budget, low decision-making
- **December:** Holiday season

**Strategy:** Focus sales efforts on Q3-Q4 (Jan-June) for July starts

---

## 11. Technical Implementation

### 11.1 Billing Database Schema

```sql
-- Core billing tables

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    plan_id UUID REFERENCES plans(id),
    status VARCHAR(20), -- trial, active, pending_renewal, lapsed, canceled
    fiscal_year VARCHAR(10), -- '2025-26'
    period_start DATE, -- July 1
    period_end DATE, -- June 30
    is_prorated BOOLEAN DEFAULT FALSE,
    prorated_amount DECIMAL(12,2),
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    trial_end TIMESTAMP,
    renewal_reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50), -- starter, professional, enterprise
    display_name VARCHAR(100),
    price_annual DECIMAL(12,2), -- Annual fee only
    features JSONB,
    limits JSONB, -- {departments: 10, users: 15, storage_gb: 5, plan_revisions: 2, export_rows: 500}
    export_row_limit INTEGER, -- 500 (starter), 1500 (professional), NULL (enterprise = unlimited)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Plan limits reference:
-- Starter:      export_row_limit = 500
-- Professional: export_row_limit = 1500
-- Enterprise:   export_row_limit = NULL (unlimited)
-- Trial:        export_row_limit = 0 (no export allowed)

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(20) UNIQUE,
    tenant_id UUID REFERENCES tenants(id),
    subscription_id UUID REFERENCES subscriptions(id),
    invoice_type VARCHAR(20), -- annual, prorated, overage, renewal
    fiscal_year VARCHAR(10), -- '2025-26'
    status VARCHAR(20), -- draft, sent, paid, overdue, void
    subtotal DECIMAL(12,2),
    vat_amount DECIMAL(12,2), -- 16% VAT
    withholding_tax DECIMAL(12,2), -- 5% WHT (deducted by govt institutions)
    total DECIMAL(12,2),
    net_payable DECIMAL(12,2), -- total - WHT
    currency VARCHAR(3) DEFAULT 'KES',
    due_date DATE, -- Typically June 30
    paid_at TIMESTAMP,
    period_start DATE, -- July 1
    period_end DATE, -- June 30
    lpo_reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id),
    description TEXT,
    quantity INTEGER,
    unit_price DECIMAL(12,2),
    amount DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id),
    amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'KES',
    method VARCHAR(20), -- bank_transfer, mpesa, card
    reference VARCHAR(100),
    status VARCHAR(20), -- pending, completed, failed, refunded
    paid_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    fiscal_year VARCHAR(10), -- '2025-26'
    metric VARCHAR(50), -- departments, users, storage, plan_revisions, api_calls
    quantity INTEGER,
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE annual_usage_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    fiscal_year VARCHAR(10),
    departments_used INTEGER,
    users_active INTEGER,
    storage_gb_used DECIMAL(10,2),
    plan_revisions_used INTEGER,
    api_calls_used INTEGER,
    has_overages BOOLEAN DEFAULT FALSE,
    overage_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    discount_type VARCHAR(20), -- percentage, fixed
    discount_value DECIMAL(12,2),
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    restrictions JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 11.2 Billing Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BILLING MICROSERVICE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────────┐    ┌──────────────────┐                     │
│   │  Subscription    │    │    Invoice       │                     │
│   │    Manager       │    │   Generator      │                     │
│   └────────┬─────────┘    └────────┬─────────┘                     │
│            │                       │                                │
│            ▼                       ▼                                │
│   ┌──────────────────────────────────────────┐                     │
│   │           BILLING ENGINE                  │                     │
│   │  • Proration calculator                   │                     │
│   │  • Tax calculator                         │                     │
│   │  • Discount applier                       │                     │
│   │  • Usage aggregator                       │                     │
│   └──────────────────────────────────────────┘                     │
│                       │                                             │
│                       ▼                                             │
│   ┌──────────────────────────────────────────┐                     │
│   │         PAYMENT PROCESSOR                 │                     │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │                     │
│   │  │ Stripe  │ │ M-Pesa  │ │ Manual  │    │                     │
│   │  │ Adapter │ │ Adapter │ │ (Bank)  │    │                     │
│   │  └─────────┘ └─────────┘ └─────────┘    │                     │
│   └──────────────────────────────────────────┘                     │
│                       │                                             │
│                       ▼                                             │
│   ┌──────────────────────────────────────────┐                     │
│   │         NOTIFICATION SERVICE              │                     │
│   │  • Invoice emails                         │                     │
│   │  • Payment reminders                      │                     │
│   │  • Usage alerts                           │                     │
│   │  • Renewal notices                        │                     │
│   └──────────────────────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.3 Key API Endpoints

```typescript
// Subscription Management
POST   /api/billing/subscriptions           // Create subscription
GET    /api/billing/subscriptions/:id       // Get subscription
PATCH  /api/billing/subscriptions/:id       // Update subscription
POST   /api/billing/subscriptions/:id/cancel // Cancel subscription
POST   /api/billing/subscriptions/:id/upgrade // Upgrade plan
POST   /api/billing/subscriptions/:id/pause   // Pause subscription

// Invoices
GET    /api/billing/invoices                // List invoices
GET    /api/billing/invoices/:id            // Get invoice
GET    /api/billing/invoices/:id/pdf        // Download PDF
POST   /api/billing/invoices/:id/send       // Send invoice email

// Payments
POST   /api/billing/payments                // Record payment
GET    /api/billing/payments/:id            // Get payment
POST   /api/billing/payments/mpesa/callback // M-Pesa webhook
POST   /api/billing/payments/stripe/webhook // Stripe webhook

// Usage
POST   /api/billing/usage                   // Record usage
GET    /api/billing/usage/summary           // Get usage summary

// Coupons
POST   /api/billing/coupons/validate        // Validate coupon
POST   /api/billing/coupons/apply           // Apply coupon
```

### 11.4 Webhook Events

```typescript
// Events to publish for external integrations
const billingEvents = {
  // Subscription events
  'subscription.created': { subscription_id, tenant_id, plan, fiscal_year },
  'subscription.renewed': { subscription_id, fiscal_year, amount },
  'subscription.upgraded': { subscription_id, old_plan, new_plan, prorated_amount },
  'subscription.canceled': { subscription_id, reason, effective_date },
  'subscription.trial_ending': { subscription_id, days_remaining },
  'subscription.renewal_due': { subscription_id, days_until_fy_end },

  // Payment events
  'payment.succeeded': { payment_id, invoice_id, amount, fiscal_year },
  'payment.failed': { payment_id, invoice_id, error },
  'payment.overdue': { invoice_id, days_overdue },

  // Invoice events
  'invoice.created': { invoice_id, tenant_id, amount, fiscal_year },
  'invoice.sent': { invoice_id, due_date },
  'invoice.paid': { invoice_id, payment_id },
  'invoice.overdue': { invoice_id, days_overdue },

  // Fiscal year events
  'fiscal_year.starting': { fiscal_year, renewals_pending },
  'fiscal_year.ended': { fiscal_year, revenue_total },

  // Usage events
  'usage.threshold_reached': { tenant_id, metric, percentage },
  'usage.overage': { tenant_id, metric, overage_amount }
};
```

---

## 12. Compliance & Legal

### 12.1 Regulatory Requirements

**Kenya Revenue Authority (KRA):**
- VAT registration required (PIN: P051234567A)
- Electronic Tax Invoice (eTIMS) integration
- Monthly VAT returns
- Annual tax returns

**Data Protection (DPA 2019):**
- Data processing agreements with clients
- Cross-border data transfer compliance
- Data retention policies
- Right to erasure implementation

**Consumer Protection:**
- Clear pricing disclosure
- Cancellation rights
- Refund policy publication
- Terms of service

### 12.2 Terms of Service (Key Clauses)

1. **Subscription Terms**
   - Auto-renewal unless canceled
   - 30-day cancellation notice
   - No refunds for partial periods

2. **Payment Terms**
   - Payment due within stated terms
   - Late payment fees: 2% per month
   - Service suspension after 15 days overdue

3. **Service Level Agreement**
   - 99.5% uptime guarantee (Professional)
   - 99.9% uptime guarantee (Enterprise)
   - Service credits for downtime

4. **Data Ownership**
   - Customer owns their data
   - Data export available
   - Data deletion on request

### 12.3 Refund Policy

| Scenario | Refund |
|----------|--------|
| Cancel within 14 days (new) | Full refund |
| Cancel after 14 days | No refund, access until period end |
| Service outage > 24hrs | Pro-rated credit |
| Billing error | Full correction |
| Duplicate payment | Full refund |

### 12.4 Security & Compliance

- **PCI DSS:** Card data handled by Stripe (PCI Level 1)
- **SOC 2 Type II:** Target for Year 2
- **ISO 27001:** Target for Year 3
- **Data Encryption:** AES-256 at rest, TLS 1.3 in transit

---

## Appendix A: Price Change Protocol

1. **Notification:** 60 days advance notice
2. **Grandfathering:** Existing customers locked for 12 months
3. **Communication:** Email + In-app notification
4. **Option:** Early renewal at current price

---

## Appendix B: Billing Glossary

| Term | Definition |
|------|------------|
| ACV | Annual Contract Value - total annual subscription fee |
| ARR | Annual Recurring Revenue - total yearly revenue from subscriptions |
| NRR | Net Revenue Retention - revenue retained + expansion from existing customers |
| CAC | Customer Acquisition Cost - cost to acquire one customer |
| LTV | Lifetime Value - total revenue expected from a customer over relationship |
| Churn | Customer/Revenue loss rate (measured annually for Procureline) |
| Proration | Partial year billing adjustment for mid-year signups |
| FY | Fiscal Year - July 1 to June 30 (Kenya GOK calendar) |
| WHT | Withholding Tax - 5% deducted by government institutions |
| LPO | Local Purchase Order - required by universities before payment |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-03 | - | Initial document |

---

*This document is confidential and intended for internal use only.*
