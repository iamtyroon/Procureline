---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - path: "_bmad-output/product-brief-Procureline-2025-12-26.md"
    type: "product-brief"
  - path: "docs/BILLING-SYSTEM.md"
    type: "technical-documentation"
  - path: "landing.html"
    type: "prototype"
  - path: "Procureline.html"
    type: "prototype"
  - path: "admin-tenant.html"
    type: "prototype"
  - path: "admin-platform.html"
    type: "prototype"
documentCounts:
  briefs: 1
  research: 0
  technicalDocs: 1
  prototypes: 4
  projectDocs: 0
workflowType: 'prd'
lastStep: 11
workflowComplete: true
completedAt: '2026-01-03'
lastModified: '2026-01-18'
projectType: 'greenfield'
classification:
  technicalType: 'SaaS B2B Platform'
  domain: 'Enterprise Procurement'
  complexity: 'Medium-High'
  initialMarket: 'Kenyan universities'
requirementCounts:
  functionalRequirements: 464
  nonFunctionalRequirements: 39
  capabilityAreas: 15
revisionHistory:
  - date: '2026-01-18'
    author: 'Tyroon'
    summary: 'Comprehensive edge case coverage for all 4 user roles'
    details:
      - 'DU workflow: 68 FRs (Login, Dashboard, Build Plan, Validation, Submission, Post-Submission, Item Requests)'
      - 'PO workflow: 101 FRs (Login, Dashboard, Departments, Categories, Items, Access Codes, Deadlines, Monitoring, Review, Consolidation, Export)'
      - 'Tenant Admin workflow: 102 FRs (Onboarding, Dashboard, PO Management, Settings, Billing, Reporting, Visibility, Notifications, Security, Lifecycle)'
      - 'Platform Admin workflow: 99 FRs (Authentication, Dashboard, Tenants, Billing, Users, Trials, Health, Security, Support, Configuration)'
      - 'Updated User Journeys, RBAC Matrix, and Annual Procurement Cycle'
---

# Product Requirements Document - Procureline

**Author:** Tyroon
**Date:** 2026-01-03

## Executive Summary

**Procureline** is a multi-tenant SaaS platform that transforms procurement management for organizations of all types — from universities to enterprises to government agencies. The platform addresses a critical gap where the majority of institutions still rely on manual, Excel-based procurement systems that create operational chaos, compliance risks, and massive time waste.

### The Problem

Organizations managing procurement across multiple departments face severe operational challenges:

- **Manual Excel Workflows** — Procurement Officers spend 40%+ of their time on manual data consolidation and error correction
- **Version Control Chaos** — Scattered email attachments with no single source of truth
- **Compliance Burden** — Manual calculation of regulatory requirements is error-prone and audit-stressful
- **Limited Visibility** — Departments work in isolation without real-time budget validation
- **Slow Cycles** — Complete procurement cycles take 4-6 weeks instead of 1-2 weeks

### The Solution

Procureline delivers a purpose-built procurement platform centered on a breakthrough innovation: a **visual Blockly-based interface** for drag-and-drop procurement planning. This transforms hierarchical procurement data (Department → Category → Item) into intuitive, manipulable visual blocks — eliminating cognitive overload, auto-calculating totals, and enforcing compliance in real-time.

### What Makes This Special

1. **Visual Blockly Interface** — The only procurement platform using visual block programming for hierarchical data. Users see structure, not spreadsheets. Zero training required.

2. **Speed of Consolidation** — Procurement Officers drag approved department plans into a master consolidation workspace, completing in hours what previously took weeks of copy-paste chaos.

3. **Automatic Audit Trails** — Every action is logged, compliance percentages are calculated automatically, and audit-ready documentation is generated with every plan.

4. **Compliance as Configuration** — GOK compliance (AGPO 30%, PWD 2%, Local Content 40%) built-in for Kenyan market, with architecture supporting additional compliance modules for other regions/industries.

5. **Excel as Integration Layer** — Bidirectional import/export preserves existing workflows and outputs government-standard reports.

## Project Classification

| Attribute | Value |
|-----------|-------|
| **Technical Type** | SaaS B2B Platform |
| **Domain** | Enterprise Procurement |
| **Complexity** | Medium-High |
| **Project Context** | Greenfield - new project |
| **Initial Market** | Kenyan universities (beachhead) |
| **Expansion Markets** | Enterprises, NGOs, government agencies, any organization with multi-department procurement |

The platform features a 4-layer user hierarchy (Platform Admin → Tenant Admin → Procurement Officer → Departmental User) with complete data isolation between tenants, role-based access control, and subscription-based pricing aligned to fiscal year cycles.

## Success Criteria

### User Success

**Procurement Officer (Primary Hero User):**
| Metric | Current State | Target State | Success Indicator |
|--------|---------------|--------------|-------------------|
| Consolidation Time | 2+ weeks | 2-4 hours | 95%+ time savings |
| Error Correction | 40%+ of time | Near zero | Upstream validation eliminates rework |
| Audit Preparation | Days of scrambling | Instant generation | One-click audit-ready reports |
| Strategic Work Time | Minimal | Significant | Time freed for vendor analysis, negotiations |

**Departmental Users:**
| Metric | Current State | Target State | Success Indicator |
|--------|---------------|--------------|-------------------|
| Plan Submission Time | Hours with errors | Under 15 minutes | Drag-and-drop completion |
| Validation Errors | Frequent | Zero | System prevents invalid entries |
| Training Required | Extensive | None | Intuitive Blockly interface |
| Revision Requests | Multiple rounds | Minimal | Real-time budget validation |

**"Aha!" Moments:**
- PO: First consolidated plan exported in hours instead of weeks
- DU: Completing a valid procurement plan in 10 minutes with zero training
- Both: Real-time budget meters showing exactly where they stand

### Business Success

**Year 1 (FY 2025-26):**
| Metric | Target |
|--------|--------|
| Paying Tenants | 5 universities |
| Trial Signups | 15-25 per quarter |
| Trial → Paid Conversion | 30%+ |
| Average Contract Value | KES 1,000,000/year |
| Year 1 ARR | KES 11.2M |

**Year 2-3 Growth:**
| Metric | Year 2 | Year 3 |
|--------|--------|--------|
| Total Customers | 25 | 40 |
| Renewal Rate | 90%+ | 90%+ |
| Net Revenue Retention | 105%+ | 105%+ |
| Market Expansion | Kenya universities | East Africa + enterprises |

### Technical Success

| Metric | Target | Rationale |
|--------|--------|-----------|
| System Uptime | 99.5%+ | Critical during procurement season |
| Page Load Time | <2 seconds | Blockly workspace responsiveness |
| Concurrent Users | 50+ per tenant | Peak submission periods |
| Data Isolation | 100% tenant separation | Multi-tenant security |
| Excel Export Accuracy | 100% GOK compliance | Regulatory requirement |
| Audit Trail Completeness | Every action logged | Compliance requirement |

### Measurable Outcomes

**90-Day Validation Metrics:**
- 3+ universities complete trial signup
- 1+ university converts to paid subscription
- PO consolidation time under 4 hours (vs. 2+ weeks baseline)
- Zero critical bugs in production
- Trial → first plan creation under 30 minutes

**Success Connected to Differentiator:**
The Blockly interface succeeds when:
- Users complete plans without reading documentation
- Consolidation happens through drag-and-drop, not copy-paste
- Compliance calculations are automatic and trusted
- Excel exports match government templates exactly

## Product Scope

### MVP - Minimum Viable Product

**Core Platform (Must Have):**
1. **Multi-Tenant Infrastructure** — 4-layer user hierarchy with complete data isolation
2. **Platform Admin Portal** — Tenant management, subscriptions, system health
3. **Tenant Admin Portal** — PO management, billing, institutional settings
4. **Procurement Officer Workspace** — Dashboard, department management, categories, consolidation
5. **Departmental User Workspace** — Simplified dashboard, plan submission
6. **Visual Blockly Planning Engine** — Drag-and-drop blocks, real-time calculations, validation
7. **Excel Integration** — Bidirectional import/export, GOK-compliant templates
8. **Marketing & Onboarding** — Landing page, 14-day trial, signup flow

**MVP Success Gate:**
- All 4 portals functional and tested
- Blockly handles 10+ departments × 15+ categories per plan
- GOK compliance calculations accurate to 2 decimal places
- End-to-end flow completable in under 30 minutes

### Growth Features (Post-MVP)

| Feature | Business Value |
|---------|----------------|
| Approval Workflows | Email notifications, multi-level approvals |
| Advanced Analytics | Trend reporting, budget forecasting |
| Multi-year Planning | Historical comparison, projection |
| API Access | ERP integration for enterprises |
| SSO/LDAP | Enterprise security requirements |

### Vision (Future)

| Capability | Timeline |
|------------|----------|
| Custom Compliance Modules | Phase 2 — Other regions/industries |
| Full Procurement Lifecycle | Phase 3 — RFQ, vendor management, PO tracking |
| AI Budget Optimization | Long-term — Predictive suggestions |
| Mobile Companion | Long-term — Approval on-the-go |
| East Africa Expansion | Year 2-3 — Regional growth |

### Annual Procurement Cycle & Operational Workflow

The platform operates on a defined annual cycle aligned to the Kenya fiscal year (July 1 - June 30):

**Phase 1: PO Preparation (1 month before fiscal year start — June)**

Before Departmental Users can submit plans, the Procurement Officer must complete system setup:

| Task | Description | Estimated Time |
|------|-------------|----------------|
| Create Departments | Set up all organizational departments with codes and budget allocations | 2-4 hours |
| Define Categories | Create procurement categories relevant to the institution | 2-4 hours |
| Populate Item Catalog | Add all procurement items to categories with descriptions, units, and unit prices | 1-2 weeks |
| Generate Access Codes | Create and distribute DU access codes | 1 hour |
| Set Submission Deadline | Configure the deadline for department plan submissions | 10 minutes |

**Critical Requirement:** The PO preparation phase must be completed before the fiscal year begins. DUs cannot create valid plans without a fully populated item catalog.

**Phase 2: Department Submission (First 2-4 weeks of fiscal year — July)**

- DUs log in and build plans using the pre-configured categories and items
- DUs can request new items/categories not in catalog; PO reviews and approves/denies
- Pending item requests automatically expire at submission deadline
- Real-time validation ensures budget compliance
- PO monitors submission progress and item requests on dashboard

**Phase 3: Review & Consolidation (Week 3-4 of fiscal year)**

- PO reviews and approves/rejects department submissions
- Approved plans consolidated into master Annual Procurement Plan
- GOK-compliant Excel export generated for official submission

**Phase 4: Execution & Monitoring (Remainder of fiscal year)**

- Plan serves as reference for procurement activities
- Quarterly reviews against plan (future feature)

## User Journeys

### Journey 1: Sarah Mwangi — From Excel Hell to Procurement Hero

Sarah is a Procurement Officer at Pwani University who has spent the last eight years mastering the art of procurement chaos. Every fiscal year, she sends out Excel templates to 12 department heads, then spends the next three weeks chasing submissions, fixing formula errors, and manually consolidating hundreds of line items into a master plan. Last year, she worked until 11 PM for two straight weeks during consolidation season, missing her daughter's school play.

It's July 1st — the start of a new fiscal year — and Sarah logs into Procureline for the first time after her university signed up for a trial. Instead of emailing Excel templates, she clicks "Create Departments" and sets up all 12 departments in 20 minutes, each with an auto-generated access code. She sends a single email: "Log in with your code. Build your plan. The system handles the rest."

Over the next week, Sarah watches her dashboard light up as department plans arrive. No more email attachments. No more "which version is correct?" Each submission is automatically validated — budget limits enforced, quarterly allocations checked, category totals calculated. When Computer Science submits with an over-budget request, the system flags it instantly. Sarah sends it back with one click and a note: "Reduce Q3 laptop allocation by 5 units."

The breakthrough moment comes on Day 10. All 12 departments have submitted valid plans. Sarah opens the Consolidation Workspace, drags each department block into the master aggregate plan, and watches in amazement as the system calculates everything: KES 47.3M total budget, AGPO allocation of KES 14.2M (30%), PWD set-aside of KES 946K (2%), Local Content target of KES 18.9M (40%). She clicks "Export" and downloads a perfectly formatted, audit-ready Excel document.

It's 3:47 PM. Sarah picks up her phone and calls her husband: "I'll be home for dinner. Yes, really."

---

### Journey 2: Michael Otieno — The Reluctant Submitter Who Became a Fan

Michael is the Head of Computer Science at Pwani University, and procurement planning is his least favorite responsibility. He's a researcher at heart — published in three journals last year — but every fiscal year he loses two days to wrestling with Sarah's Excel templates. Last year, he submitted four times before passing validation. The forms were confusing, the formulas broke when he added rows, and he could never remember which column was Q1 vs Q2.

This year, Michael receives a different email from Sarah: a link to Procureline and an access code. Skeptical but hopeful, he logs in during his morning coffee break. No installation. No Excel. Just a clean interface showing his department's KES 4.2M budget allocation and an empty planning workspace.

Michael clicks "New Plan" and sees something unexpected: colorful blocks he can drag and drop. He pulls an "ICT Equipment" category block onto the workspace, then drags individual item blocks inside it — laptops, projectors, networking gear. For each item, he simply enters quantities for Q1 through Q4. The system already knows the unit prices and calculates totals automatically. A budget meter at the top fills up in real-time: 67%... 78%... 89%.

When Michael accidentally allocates more laptops than the budget allows, the block flashes red and a friendly warning appears: "Budget exceeded by KES 340,000. Adjust quantities to continue." No broken formulas. No cryptic Excel errors. He reduces the laptop count and the block turns green again.

While building his plan, Michael realizes he needs specialized research software that isn't in the catalog — "MATLAB Academic License." Instead of emailing Sarah or waiting for the next meeting, he clicks "Request New Item," fills in the details (description, estimated unit price, justification: "Required for final year computational research projects"), and submits. A notification badge appears on Sarah's dashboard within seconds.

The next morning, Sarah reviews the request, adjusts the unit price based on the latest vendor quote, and clicks "Approve." Michael gets an instant notification: "Your item request 'MATLAB Academic License' has been approved." The item now appears in his ICT Equipment category, and he drags it into his plan immediately.

Fifteen minutes after logging in, Michael clicks "Submit for Review." The system validates everything automatically and sends it to Sarah. No revision requests come back. For the first time in eight years, Michael submitted a valid procurement plan on the first try.

He forwards the Procureline link to his colleague in Electrical Engineering with a message: "You need to try this. I just got two days of my life back."

---

### Journey 3: Dr. Amina Hassan — The Tenant Admin Who Gained Visibility

Dr. Amina Hassan is the Deputy Vice-Chancellor (Administration) at Pwani University. She oversees procurement compliance and reports to the University Council quarterly. For years, she's relied on Sarah to provide procurement summaries, but the data always arrives late and she never has real-time visibility into where the university stands.

When Procureline is proposed, Dr. Amina is intrigued by the "Tenant Admin" role. After the university's Platform Admin creates her account, she receives an invitation email. She clicks the link, sets a strong password (the system enforces 12+ characters with uppercase, numbers, and special characters), verifies her email, and completes the organization profile with Pwani University's logo and fiscal year configuration.

On first login, she sees a clean dashboard — separate from Sarah's operational view. Summary cards show Total POs (1), Departments (12), Submission Progress (8 of 12), and Budget Utilization (74.4%). The current fiscal year timeline shows submission deadline in 6 days with a countdown timer. She can see which departments are lagging without asking Sarah for a report.

Dr. Amina clicks into "Manage POs" and sees Sarah's profile with status indicators and activity logs. She tests adding a backup PO — her assistant James — for when Sarah takes leave. The system sends James an invitation email automatically. She notes she can deactivate or reactivate POs as needed, and even unlock accounts if someone gets locked out from failed login attempts.

In "Institutional Settings," she configures the allowed email domains (@pu.ac.ke), sets the fiscal year to start in July, and reviews the compliance rules (AGPO 30%, PWD 2%, Local Content 40% — all GOK standard). The system logs every change she makes with before/after values.

In "Billing," she reviews the subscription: Professional tier at KES 100,000/month, next invoice due August 1st. She downloads previous invoices as PDF for her records and notes the payment method is bank transfer with LPO. The system warned her last month when the university's payment card was about to expire — she appreciated the 30-day advance notice.

The breakthrough comes during a Council meeting when a member asks about procurement compliance. Instead of saying "I'll get back to you," Dr. Amina opens Procureline on her laptop, shows the real-time dashboard, and drills down into department details (read-only access — she can see everything but can't modify plans). She generates an Activity report on the spot, and the system even watermarks it "Confidential" with the generation timestamp. The Council Chair comments: "This is the transparency we've been asking for."

Before leaving for a two-week conference, Dr. Amina enables 2FA on her account (the system provides recovery codes) and reviews her active sessions. She trusts the system will alert her if there's a suspicious login from an unexpected location. She also schedules a weekly Budget report to be emailed to her automatically — even when traveling, she'll have visibility.

When renewal time comes, Dr. Amina doesn't hesitate to approve the subscription. She downloads the invoice, broadcasts a "Thank you" message to all POs, and logs the upgrade from Starter to Professional tier that she requested last quarter (the system pro-rated the charges). The visibility alone is worth it — but the security features and reporting capabilities made it essential.

---

### Journey 4: Kevin Njoroge — The Platform Admin Who Keeps It All Running

Kevin is a DevOps engineer at Procureline and the sole Platform Admin. His job is to ensure 47 university tenants (and growing) have a seamless experience. Security is paramount — he accesses the Platform Admin portal via a dedicated URL, authenticates with mandatory 2FA (he keeps his backup codes in a secure password manager), and the system enforces a 30-minute idle timeout.

Kevin starts every morning with a coffee and the Platform Admin dashboard. Today's summary cards show: 47 active tenants, 5 trials in progress, 2 suspended (payment issues), MRR of KES 4.2M. The system health panel is all green: API latency 142ms, DB connections at 34% capacity, zero failed background jobs. But there's an alert with a yellow severity indicator: Moi University's storage is at 92% of their tier limit. Kevin clicks into their tenant details — they've uploaded 2.3GB of Excel archives on a Starter tier (5GB limit). He flags this for the sales team and the system auto-sent a notification to their Tenant Admin about the approaching limit.

A support ticket appears in his queue with "High" SLA indicator — Kenyatta University can't log in. Kevin checks the SLA timer (4 hours remaining) and opens the tenant record. Subscription status: active, paid through December. He reviews the access logs filtered by authentication failures and spots the issue: their IT team changed the institutional email domain and users are trying old addresses. He updates the allowed domain configuration in tenant settings (the system logs the change with before/after values) and closes the ticket with a resolution note. The system updates the ticket SLA as "Met."

At 2 PM, his phone buzzes with an SMS alert — the system detected an anomaly: trial signups spiked 10x in the last hour. Kevin checks the trial management dashboard and sees multiple signups from the same email domain pattern (spam attempt). The system already rate-limited new signups from that domain. He marks them for review and confirms the abuse detection worked. A legitimate trial also came in: Strathmore University. He reviews their auto-provisioned tenant (the system handled subdomain configuration and infrastructure automatically) and checks engagement metrics — they've already created 3 departments and built a test plan. Great engagement! He flags them "Hot Lead" for sales follow-up using the quick action button.

Mid-afternoon, Kevin needs to apply a security patch. He schedules a maintenance window for 2 AM Saturday using the announcement system — the system will auto-notify all affected tenants and update the status page. He also tests the announcement preview to make sure it looks right.

Later, a payment reconciliation alert arrives: three bank transfer payments need manual verification. Kevin opens the billing dashboard, matches payment references to invoices, and confirms each. The system immediately restores one tenant that was in grace period — no data loss, seamless experience for the Tenant Admin.

Before leaving, Kevin runs his daily security checks. He opens the security dashboard and runs the tenant data isolation verification — all 47 tenants confirmed isolated, no cross-tenant access attempts detected. He reviews the immutable audit log integrity check (passed), confirms all SSL certificates are valid for 60+ days, and triggers a manual backup just to be safe. The backup queue shows green — yesterday's automated backup completed at 100%.

One final task: a feature flag update. The product team wants to enable the new "Budget Forecasting" feature for 10% of tenants as an A/B test. Kevin opens configuration, sets the feature flag rollout to 10% (the system randomly selects qualifying tenants), and saves. The configuration version history logs the change, and he notes he can rollback instantly if issues arise.

Kevin updates the system status page to "All Systems Operational" and logs off. The session terminates after his 30-minute idle timeout — exactly as designed.

---

### Journey Requirements Summary

| Capability Area | Revealed By Journey |
|-----------------|---------------------|
| **Department Management** | Sarah (PO) |
| **Access Code System** | Sarah (PO), Michael (DU) |
| **Submission Tracking** | Sarah (PO), Dr. Amina (Tenant Admin) |
| **Validation Engine** | Sarah (PO), Michael (DU) |
| **Blockly Planning Interface** | Michael (DU), Sarah (PO) |
| **Real-time Budget Meters** | Michael (DU), Sarah (PO) |
| **Item/Category Requests** | Michael (DU), Sarah (PO) |
| **Consolidation Workspace** | Sarah (PO) |
| **Compliance Calculations** | Sarah (PO), Dr. Amina (Tenant Admin) |
| **Excel Export** | Sarah (PO) |
| **Tenant Admin Dashboard** | Dr. Amina (Tenant Admin) |
| **PO Management** | Dr. Amina (Tenant Admin) |
| **Institutional Settings** | Dr. Amina (Tenant Admin) |
| **Billing & Subscription** | Dr. Amina (Tenant Admin) |
| **Report Generation** | Dr. Amina (Tenant Admin) |
| **Cross-Institutional Visibility** | Dr. Amina (Tenant Admin) |
| **2FA & Security** | Dr. Amina (Tenant Admin) |
| **Broadcast Messaging** | Dr. Amina (Tenant Admin) |
| **Multi-tenant Infrastructure** | Kevin (Platform Admin) |
| **System Health Monitoring** | Kevin (Platform Admin) |
| **Trial Management** | Kevin (Platform Admin) |
| **Subscription & Billing Ops** | Kevin (Platform Admin) |
| **Support Ticketing & SLA** | Kevin (Platform Admin) |
| **Security & Compliance** | Kevin (Platform Admin) |
| **Feature Flag Management** | Kevin (Platform Admin) |
| **Announcement System** | Kevin (Platform Admin) |
| **Configuration Management** | Kevin (Platform Admin) |

## Innovation & Novel Patterns

### Core Innovation: Visual Block Programming for Procurement Data

Procureline introduces a breakthrough approach to procurement planning by repurposing **Google's Blockly visual programming framework** — originally designed for teaching code — as an interface for **hierarchical data manipulation**.

**Why This Is Novel:**

| Traditional Approach | Procureline Innovation |
|---------------------|------------------------|
| Spreadsheet rows and columns | Visual blocks that nest and connect |
| Hidden data hierarchy | Visible structure (Dept → Category → Item) |
| Formulas that break | Auto-calculating blocks that can't break |
| Validation after submission | Real-time validation as you build |
| Copy-paste consolidation | Drag-and-drop aggregation |

**The Innovation Triangle:**

The breakthrough isn't any single element — it's the synergy of three components working together:

1. **Visual Blockly Interface** — Makes hierarchy tangible and manipulable
2. **Real-time Validation** — Prevents errors before they happen (budget meters, block warnings)
3. **Instant Consolidation** — Drag-and-drop aggregation replaces weeks of manual work

**Together, they enable:** A procurement workflow that's impossible to break, impossible to miscalculate, and delightfully fast.

### Market Context & Competitive Landscape

**Existing Procurement Solutions:**
- SAP Ariba, Coupa, Jaggaer — Enterprise-focused, complex, expensive, form-heavy
- Excel templates — Ubiquitous but error-prone, no validation, manual consolidation
- Local solutions — Basic digitization of forms, no innovation in interaction model

**Procureline's Unique Position:**
- First procurement platform using visual block programming
- Purpose-built for multi-department consolidation workflows
- Designed for emerging markets (Kenya-first, accessible pricing)
- Zero-training interface vs. weeks of enterprise software training

**No Direct Competitor** uses Blockly or visual programming for procurement data.

### Validation Approach

**Innovation Risk:** Users might not understand or accept the block-based paradigm.

**Validation Strategy:**

| Validation Method | Success Criteria | Timeline |
|-------------------|------------------|----------|
| **User Testing (DU)** | Complete plan in <15 min with zero training | Pre-launch |
| **User Testing (PO)** | Complete consolidation in <4 hours | Pre-launch |
| **Trial Conversion** | 30%+ trial-to-paid conversion | 90 days |
| **Time Savings** | 90%+ reduction in consolidation time | First fiscal cycle |
| **Error Reduction** | Zero validation errors at submission | Ongoing |

**Key Validation Questions:**
1. Do users intuitively understand the block nesting paradigm?
2. Does the visual interface reduce cognitive load vs. spreadsheets?
3. Do POs trust the automatic compliance calculations?
4. Is consolidation truly faster, or just different?

### Risk Mitigation

**Risk 1: Block Paradigm Rejection**
- *Mitigation:* Provide Excel import as fallback entry method
- *Mitigation:* Include optional onboarding tutorial (skippable)
- *Fallback:* If Blockly fails user testing, pivot to structured forms with same validation engine

**Risk 2: Performance at Scale**
- *Mitigation:* Collapsible blocks reduce visual complexity
- *Mitigation:* Lazy loading for large plans (10+ departments)
- *Validation:* Load testing with 15 departments × 20 categories × 50 items

**Risk 3: Mobile/Tablet Limitations**
- *Mitigation:* MVP is desktop-first (matches PO workflow)
- *Future:* Mobile companion for approvals only (not block manipulation)

**Risk 4: Blockly Library Dependency**
- *Mitigation:* Blockly is open-source (Apache 2.0), actively maintained by Google
- *Mitigation:* Abstract block rendering to allow future migration if needed

## SaaS B2B Platform Requirements

### Project-Type Overview

Procureline is a **multi-tenant SaaS B2B platform** serving institutional customers (universities, enterprises, government agencies) with procurement planning needs. The platform follows enterprise SaaS best practices with complete tenant isolation, role-based access control, and tiered subscription pricing.

### Multi-Tenant Architecture

**Tenant Isolation Model:**

| Aspect | Implementation |
|--------|----------------|
| **Data Isolation** | Complete separation — no cross-tenant data access possible |
| **Subdomain** | Each tenant gets custom subdomain (e.g., `pwani.procureline.co.ke`) |
| **Database Strategy** | Shared database with tenant_id foreign key on all tables |
| **User Management** | Independent per tenant — same email can exist in different tenants |
| **Configuration** | Per-tenant settings (fiscal year, compliance rules, branding) |

**Tenant Lifecycle:**
1. **Trial** — 14-day free trial, auto-provisioned on signup
2. **Active** — Paid subscription, full access
3. **Grace Period** — 7 days after failed payment, read-only access
4. **Suspended** — Payment overdue, no access, data retained 90 days
5. **Churned** — Subscription cancelled, data archived then deleted

### Role-Based Access Control (RBAC)

**4-Layer User Hierarchy:**

| Layer | Role | Scope |
|-------|------|-------|
| 1 | Platform Admin | Full system access, all tenants |
| 2 | Tenant Admin | Institutional management, billing |
| 3 | Procurement Officer | Full procurement workflow |
| 4 | Departmental User | Own department only |

**Permission Matrix:**

| Action | Platform Admin | Tenant Admin | PO | DU |
|--------|:--------------:|:------------:|:--:|:--:|
| Manage Tenants | ✓ | - | - | - |
| View System Health | ✓ | - | - | - |
| Manage Billing | ✓ | ✓ | - | - |
| Add/Remove POs | - | ✓ | - | - |
| Create Departments | - | - | ✓ | - |
| Manage Categories | - | - | ✓ | - |
| Create Plans | - | - | ✓ | ✓ |
| Submit Plans | - | - | - | ✓ |
| Review Submissions | - | - | ✓ | - |
| Consolidate Plans | - | - | ✓ | - |
| Export Excel | - | - | ✓ | - |
| View Own Department | - | - | ✓ | ✓ |
| View All Departments | - | ✓ | ✓ | - |
| Request Items/Categories | - | - | - | ✓ |
| Approve/Deny Requests | - | - | ✓ | - |
| View Request Dashboard | - | - | ✓ | - |
| View Own Requests | - | - | - | ✓ |
| Withdraw Submitted Plan | - | - | - | ✓ |
| View Institutional Dashboard | - | ✓ | - | - |
| Generate Reports | - | ✓ | - | - |
| Manage Institutional Settings | - | ✓ | - | - |
| Broadcast to POs | - | ✓ | - | - |
| View Audit Logs | ✓ | ✓ | View Own | - |
| Manage 2FA | ✓ | ✓ | - | - |
| Transfer Admin Role | - | ✓ | - | - |
| Unlock PO Accounts | - | ✓ | - | - |
| Suspend/Restore Tenants | ✓ | - | - | - |
| View Revenue Reports | ✓ | - | - | - |
| Process Refunds | ✓ | - | - | - |
| Verify Payments | ✓ | - | - | - |
| Cross-Tenant User Search | ✓ | - | - | - |
| Manage Trials | ✓ | - | - | - |
| Run Data Isolation Check | ✓ | - | - | - |
| Manage Support Tickets | ✓ | - | - | - |
| Send Announcements | ✓ | - | - | - |
| Manage Feature Flags | ✓ | - | - | - |
| Update System Config | ✓ | - | - | - |
| Schedule Maintenance | ✓ | - | - | - |
| Trigger Manual Backup | ✓ | - | - | - |

### Subscription Tiers

**Pricing Structure (Kenya Fiscal Year Aligned):**

| Tier | Monthly | Annual | Departments | Users | Storage | Support |
|------|---------|--------|-------------|-------|---------|---------|
| **Starter** | KES 41,667 | KES 500,000 | ≤10 | ≤50 | 5GB | Email |
| **Professional** | KES 100,000 | KES 1,200,000 | ≤25 | ≤150 | 25GB | Priority |
| **Enterprise** | KES 200,000 | KES 2,400,000 | Unlimited | Unlimited | 100GB | Dedicated |

**Tier Feature Comparison:**

| Feature | Starter | Professional | Enterprise |
|---------|:-------:|:------------:|:----------:|
| Blockly Planning Interface | ✓ | ✓ | ✓ |
| Excel Import/Export | ✓ | ✓ | ✓ |
| GOK Compliance Calculations | ✓ | ✓ | ✓ |
| Consolidation Workspace | ✓ | ✓ | ✓ |
| Audit Trails | ✓ | ✓ | ✓ |
| Analytics Dashboard | - | ✓ | ✓ |
| Multi-year Comparison | - | ✓ | ✓ |
| API Access | - | - | ✓ |
| SSO/LDAP Integration | - | - | ✓ |
| Custom Compliance Modules | - | - | ✓ |
| Dedicated Account Manager | - | - | ✓ |

**Payment Methods:**
- Bank Transfer with LPO (primary for universities)
- M-Pesa (mobile money)
- Stripe (card payments)

### Integration Requirements

**MVP Integrations:**

| Integration | Type | Priority | Description |
|-------------|------|----------|-------------|
| **Excel Export** | File | MVP | GOK-compliant Annual Procurement Plan format |
| **Excel Import** | File | MVP | Parse existing Excel plans into Blockly blocks |
| **Email** | Notification | MVP | Submission alerts, revision requests, reminders |

**Post-MVP Integrations:**

| Integration | Type | Priority | Description |
|-------------|------|----------|-------------|
| **REST API** | API | Growth | Programmatic access for ERP integration |
| **SSO/SAML** | Auth | Growth | Enterprise single sign-on |
| **LDAP/AD** | Auth | Growth | Active Directory user sync |
| **Webhook** | Event | Growth | Real-time event notifications |

### Compliance & Audit Requirements

**GOK Compliance Module (Configurable):**

| Compliance Rule | Calculation | Applicability |
|-----------------|-------------|---------------|
| **AGPO** | 30% of total budget | Access to Government Procurement Opportunities |
| **PWD** | 2% of total budget | Persons with Disabilities set-aside |
| **Local Content** | 40% of total budget | Local supplier preference |

**Audit Trail Requirements:**
- Every action logged with timestamp, user, and before/after state
- Immutable audit log (append-only)
- Exportable audit reports for compliance reviews
- Retention: 7 years minimum (aligned with financial record requirements)

**Data Governance:**
- All data stored in Kenya-based cloud infrastructure (or regional compliance)
- GDPR-style data subject rights (export, deletion on request)
- Encryption at rest and in transit (AES-256, TLS 1.3)

### Technical Architecture Considerations

**Scalability Requirements:**

| Metric | MVP Target | Growth Target |
|--------|------------|---------------|
| Concurrent Users per Tenant | 50 | 200 |
| Total Tenants | 50 | 500 |
| Plans per Tenant | 100 | 1,000 |
| Items per Plan | 500 | 2,000 |
| Blockly Workspace Load | <2s | <1s |

**Availability & Performance:**
- Target Uptime: 99.5% (allows ~44 hours downtime/year)
- Planned Maintenance: Off-peak hours (weekends, nights Kenya time)
- Peak Season: July-September (fiscal year start) — no maintenance windows

**Security Requirements:**
- Authentication: Email/password with optional 2FA for users, mandatory 2FA for Platform Admin
- Session Management: JWT with refresh tokens, 24-hour expiry
- Rate Limiting: API calls limited per tenant tier
- Input Validation: All user inputs sanitized, SQL injection prevention
- CORS: Restricted to known domains

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Chosen Approach:** Platform MVP
Build the multi-tenant foundation with the core Blockly innovation, establishing a scalable base for future expansion while delivering immediate value to early adopters.

**Why Platform MVP:**
- Multi-tenant architecture is foundational — can't be retrofitted easily
- Blockly interface is the core differentiator — must be proven early
- Universities need complete workflow from day one (partial solutions won't work)
- Platform foundation enables rapid feature addition post-MVP

**Resource Requirements:**

| Role | Count | Focus |
|------|-------|-------|
| Full-Stack Developer | 2 | Core platform, Blockly integration |
| Frontend Developer | 1 | UI/UX, Blockly customization |
| DevOps/Backend | 1 | Multi-tenant infrastructure, billing |
| Product/Design | 1 | UX refinement, user testing |

**Estimated MVP Timeline:** 4-5 months

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**

| Journey | MVP Support Level |
|---------|-------------------|
| Sarah (PO) — Consolidation | Full support |
| Michael (DU) — Plan submission | Full support |
| Dr. Amina (Tenant Admin) — Visibility | Full support |
| Kevin (Platform Admin) — Operations | Full support |

**Must-Have Capabilities (MVP):**

| Capability | Priority | Rationale |
|------------|----------|-----------|
| Multi-tenant infrastructure | Critical | Foundation for everything |
| Email/password authentication | Critical | Basic access control |
| 4-layer role hierarchy | Critical | Core permission model |
| Department CRUD | Critical | PO workflow essential |
| Category/Item catalog | Critical | Planning data structure |
| Blockly planning interface | Critical | Core differentiator |
| Real-time budget validation | Critical | Key user value |
| Plan submission workflow | Critical | DU→PO handoff |
| Consolidation workspace | Critical | PO "aha moment" |
| Excel export (GOK format) | Critical | Output requirement |
| Landing page + trial signup | Critical | Customer acquisition |
| Basic billing (manual) | High | Revenue enablement |
| Email notifications | High | Workflow communication |
| Tenant Admin dashboard | Medium | Visibility for decision-makers |
| Platform Admin basics | Medium | Operational necessity |

**MVP Exclusions (Explicitly Out of Scope):**

| Feature | Reason for Exclusion |
|---------|---------------------|
| Excel import | Can be manual initially; add in Phase 2 |
| Analytics dashboard | Nice-to-have; basic metrics sufficient |
| Multi-year comparison | Requires historical data; Phase 2 |
| API access | Enterprise feature; Phase 2 |
| SSO/LDAP | Enterprise feature; Phase 2 |
| Approval workflows | Email sufficient initially |
| Mobile app | Desktop-first; PO workflow is desktop |
| Custom compliance modules | GOK hardcoded initially; Phase 3 |

### Post-MVP Features

**Phase 2: Growth (Months 6-12)**

| Feature | Business Value | Effort |
|---------|----------------|--------|
| Excel Import | Migrate existing plans easily | Medium |
| Analytics Dashboard | Usage insights, trend reporting | Medium |
| Approval Workflows | Email notifications, multi-level approvals | Medium |
| Multi-year Comparison | Historical analysis, budgeting insights | Low |
| API Access (Beta) | Enable ERP integrations | High |
| Enhanced Audit Reports | Detailed compliance documentation | Low |
| In-app Notifications | Real-time updates | Low |

**Phase 3: Expansion (Year 2+)**

| Feature | Business Value | Effort |
|---------|----------------|--------|
| SSO/SAML Integration | Enterprise security requirement | High |
| Custom Compliance Modules | Expand beyond GOK (other countries) | High |
| REST API (Production) | Full programmatic access | High |
| Webhook Events | Real-time integration triggers | Medium |
| Mobile Companion | Approvals on-the-go | High |
| AI Budget Suggestions | Predictive optimization | High |
| White-label Option | Reseller partnerships | High |

**Phase 4: Vision (Year 3+)**

| Feature | Business Value |
|---------|----------------|
| Full Procurement Lifecycle | RFQ, vendor management, PO tracking |
| East Africa Expansion | Uganda, Tanzania, Rwanda markets |
| Enterprise Tier Enhancements | Advanced analytics, dedicated infrastructure |
| Marketplace | Third-party integrations and add-ons |

### MVP Success Gates

Before proceeding to Phase 2, MVP must achieve:

| Gate | Criteria | Measurement |
|------|----------|-------------|
| **Functional Completeness** | All 4 portals working end-to-end | QA sign-off |
| **Performance** | Blockly loads in <2s with 10 departments | Load testing |
| **Scale** | Handles 50 concurrent users per tenant | Stress testing |
| **User Validation** | 3+ universities complete trial signup | Analytics |
| **Revenue** | 1+ university converts to paid | Billing system |
| **Time Savings** | PO consolidation <4 hours | User feedback |

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Blockly performance at scale | Medium | High | Lazy loading, collapsible blocks, early load testing |
| Multi-tenant data leakage | Low | Critical | Strict tenant_id enforcement, security audit |
| Excel export compatibility | Medium | Medium | Test with actual GOK templates early |
| Browser compatibility | Low | Medium | Target Chrome/Edge; progressive enhancement |

**Market Risks:**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Universities slow to adopt SaaS | Medium | High | Offer on-premise option for Enterprise tier (future) |
| Budget approval delays | High | Medium | Align sales with fiscal year cycle (April-June) |
| Competitor emergence | Low | Medium | Speed to market; patent visual block approach |
| Price sensitivity | Medium | Medium | Starter tier for smaller institutions |

**Resource Risks:**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Key developer leaves | Medium | High | Document everything; pair programming |
| Scope creep | High | Medium | Strict MVP boundaries; PM discipline |
| Underestimated complexity | Medium | High | Buffer timeline by 20%; weekly scope reviews |

### Minimum Viable Launch

**If resources are constrained, absolute minimum launch requires:**

1. Single-tenant deployment (skip multi-tenant initially)
2. PO + DU roles only (skip Tenant Admin and Platform Admin)
3. Blockly interface with manual save (skip real-time sync)
4. Excel export only (skip import)
5. Manual billing (skip automated payments)

This "Minimum Minimum" could launch in 2-3 months with 2 developers, but would require significant post-launch work to reach full MVP.

**Recommendation:** Full MVP is worth the investment for sustainable growth.

## Functional Requirements

> **Capability Contract Notice:** Every feature built must trace back to a requirement below. Capabilities not listed here will not exist in the final product.

### 1. Authentication & Access Control

- FR1: Users can register for a trial account using email and organization details
- FR2: Users can log in using email and password
- FR2a: System displays clear error message for invalid email format
- FR2b: System displays clear error message for incorrect password
- FR2c: System displays message if PO account is deactivated by Tenant Admin
- FR2d: System displays message if tenant subscription is expired/suspended
- FR2e: System handles session expiration gracefully with re-login prompt
- FR2f: PO can choose "Remember me" for extended session (30 days)
- FR2g: System allows concurrent login from multiple devices
- FR2h: System displays maintenance mode message when system is unavailable
- FR3: Users can reset their password via email verification
- FR4: Users can log out and terminate their session
- FR5: Departmental Users can log in using an access code provided by their PO
- FR5a: System displays clear error message for invalid access code
- FR5b: System enforces access code expiration policy (configurable by PO)
- FR5c: DU can request access code reminder from PO via system
- FR5d: System locks DU access after 5 failed login attempts (15-min lockout)
- FR5e: System prevents DU login if submission period has not started
- FR5f: System prevents DU login if submission period has ended
- FR5g: System displays appropriate message if tenant subscription is inactive
- FR5h: System displays appropriate message if DU account is deactivated
- FR6: System can enforce role-based access control across 4 user levels
- FR7: System can restrict users to only see data within their tenant

### 2. Platform Administration

> **Note:** Original FRs (FR8-FR14) retained below, with detailed edge case coverage in subsections 2a-2j. Single Platform Admin model for MVP; multiple admin support planned for scale.

- FR8: Platform Admin can view a dashboard of all tenants with status indicators
- FR9: Platform Admin can view individual tenant details and usage metrics
- FR10: Platform Admin can update tenant configuration settings
- FR11: Platform Admin can view system health metrics (API, database, jobs)
- FR12: Platform Admin can view and manage subscription statuses
- FR13: Platform Admin can access support ticket activity logs
- FR14: Platform Admin can monitor trial engagement and conversion metrics

#### 2a. Authentication & Access

- FR-PA1a: Platform Admin accesses admin portal via dedicated URL
- FR-PA1b: System requires mandatory 2FA for all Platform Admin accounts
- FR-PA1c: System provides backup codes at 2FA setup for recovery
- FR-PA1d: System blocks login from suspicious locations with verification
- FR-PA1e: System enforces 30-minute idle session timeout
- FR-PA1f: System allows concurrent sessions with activity logging
- FR-PA1h: System requires immediate credential revocation workflow
- FR-PA1i: System prevents Platform Admin account deletion
- FR-PA1j: System maintains complete audit trail of Platform Admin access

#### 2b. Dashboard & Monitoring

- FR-PA2a: Dashboard displays system health summary (API, DB, jobs, storage)
- FR-PA2b: Dashboard displays tenant overview (active, trial, suspended, churned counts)
- FR-PA2c: Dashboard displays key revenue metrics (MRR, ARR, trial conversions)
- FR-PA2d: Dashboard displays recent alerts with severity indicators
- FR-PA2e: System auto-alerts via SMS/email for critical issues (API down, DB errors)
- FR-PA2f: Dashboard provides quick action buttons (create tenant, view logs, etc.)
- FR-PA2g: System detects and alerts on metric anomalies (unusual patterns)
- FR-PA2h: Dashboard displays all timestamps in UTC with local time tooltip
- FR-PA2i: Platform Admin can customize dashboard widget layout
- FR-PA2j: Dashboard supports alert grouping and severity-based filtering

#### 2c. Tenant Management

- FR-PA3a: Platform Admin can view list of all tenants with status filters
- FR-PA3b: Platform Admin can create new tenant with Tenant Admin email
- FR-PA3c: System validates subdomain uniqueness and format (alphanumeric, hyphens)
- FR-PA3d: System provisions tenant infrastructure automatically
- FR-PA3e: System rolls back partial tenant creation if provisioning fails
- FR-PA3f: Platform Admin can view individual tenant details and usage
- FR-PA3g: Platform Admin can update tenant configuration settings
- FR-PA3h: Platform Admin can suspend tenant (immediately blocks access)
- FR-PA3i: Platform Admin can restore suspended tenant
- FR-PA3j: Platform Admin can initiate tenant deletion (90-day soft delete, then permanent purge)
- FR-PA3k: System auto-alerts when tenant storage reaches 90% capacity
- FR-PA3l: System auto-alerts when tenant user count exceeds tier limit
- FR-PA3m: Platform Admin can change tenant subdomain with redirect
- FR-PA3n: Platform Admin can generate complete tenant data export
- FR-PA3o: Platform Admin can override tenant configuration for troubleshooting

#### 2d. Subscription & Billing

- FR-PA4a: Platform Admin can view all subscription statuses with filters
- FR-PA4b: Platform Admin can view revenue reports (MRR, ARR, by tier)
- FR-PA4c: Platform Admin can manually verify bank transfer payments
- FR-PA4d: System reconciles M-Pesa payments daily with retry for failures
- FR-PA4e: System processes Stripe webhooks with retry queue for failures
- FR-PA4f: Platform Admin can initiate refund with approval workflow
- FR-PA4g: System calculates pro-rated refunds automatically
- FR-PA4h: Platform Admin can apply custom pricing for Enterprise contracts
- FR-PA4i: System sends payment failure notifications to Tenant Admin
- FR-PA4j: System transitions tenant to grace period after payment failure
- FR-PA4k: System suspends tenant after grace period expires (7 days)
- FR-PA4l: Platform Admin can immediately restore tenant on payment receipt
- FR-PA4m: System generates invoices automatically with retry on failure
- FR-PA4n: Platform Admin can batch update subscription statuses
- FR-PA4o: System maintains billing audit trail with reconciliation reports

#### 2e. User Management (Cross-Tenant)

- FR-PA5a: Platform Admin can search for users across all tenants
- FR-PA5b: Platform Admin can view user details and tenant associations
- FR-PA5c: Platform Admin can trigger password reset for any user
- FR-PA5d: Platform Admin can unlock locked user accounts
- FR-PA5e: Platform Admin can force logout all sessions for a user
- FR-PA5f: Platform Admin can deactivate user account (security issue)
- FR-PA5g: System supports tenant-wide user lockout for security incidents
- FR-PA5h: Platform Admin can view user activity logs with filters
- FR-PA5i: Platform Admin can process GDPR data deletion requests
- FR-PA5j: System prevents actions that would orphan a tenant (no Tenant Admin)

#### 2f. Trial Management

- FR-PA6a: Platform Admin can view all active trials with engagement metrics
- FR-PA6b: Platform Admin can view trial-to-paid conversion funnel
- FR-PA6c: Platform Admin can extend trial (max 2 extensions, 30 days total)
- FR-PA6d: Platform Admin can flag trials for sales follow-up
- FR-PA6e: System auto-archives trials with zero engagement after 7 days
- FR-PA6f: System detects trial abuse (same org, multiple trials)
- FR-PA6g: Platform Admin can convert trial to specific subscription tier
- FR-PA6h: System provides read-only access for 7 days after trial expires
- FR-PA6i: System rate-limits trial signups to prevent spam
- FR-PA6j: Platform Admin can view expired trials with reasons

#### 2g. System Health

- FR-PA7a: Platform Admin can view real-time API metrics (latency, error rates)
- FR-PA7b: Platform Admin can view database health (connections, query performance)
- FR-PA7c: Platform Admin can view background job status and history
- FR-PA7d: Platform Admin can view infrastructure metrics (CPU, memory, storage)
- FR-PA7e: Platform Admin can view backup status and history
- FR-PA7f: System auto-alerts when API error rate exceeds 5%
- FR-PA7g: System auto-alerts when backup fails
- FR-PA7h: System displays SSL certificate expiration warnings (30 days)
- FR-PA7i: Platform Admin can schedule and announce maintenance windows
- FR-PA7j: Platform Admin can trigger manual backup

#### 2h. Security & Compliance

- FR-PA8a: Platform Admin can view security dashboard (threats, audit status)
- FR-PA8b: Platform Admin can run tenant data isolation verification
- FR-PA8c: Platform Admin can view cross-tenant access attempt logs
- FR-PA8d: System blocks and alerts on cross-tenant data access attempts
- FR-PA8e: Platform Admin can review all access logs with filters
- FR-PA8f: System maintains immutable audit logs with integrity verification
- FR-PA8g: Platform Admin can generate compliance reports
- FR-PA8h: Platform Admin can configure IP allowlist for Platform Admin access
- FR-PA8i: System detects unusual access patterns and alerts
- FR-PA8j: Platform Admin can initiate security incident response protocol

#### 2i. Support & Incidents

- FR-PA9a: Platform Admin can view support ticket queue with SLA indicators
- FR-PA9b: Platform Admin can assign tickets to handlers
- FR-PA9c: Platform Admin can escalate tickets with priority override
- FR-PA9d: System auto-escalates tickets approaching SLA breach
- FR-PA9e: Platform Admin can create and manage incidents
- FR-PA9f: Platform Admin can update system status page
- FR-PA9g: Platform Admin can send announcements to all or specific tenants
- FR-PA9h: Platform Admin can schedule future announcements
- FR-PA9i: Platform Admin can merge duplicate tickets
- FR-PA9j: System generates post-incident review reminders

#### 2j. Configuration

- FR-PA10a: Platform Admin can view and update system configuration
- FR-PA10b: Platform Admin can manage feature flags (enable/disable features)
- FR-PA10c: Platform Admin can configure feature rollout by tenant percentage
- FR-PA10d: Platform Admin can update subscription tier pricing
- FR-PA10e: System supports grandfather pricing for existing customers
- FR-PA10f: Platform Admin can update email templates with preview
- FR-PA10g: Platform Admin can enable/disable third-party integrations
- FR-PA10h: System maintains configuration version history
- FR-PA10i: Platform Admin can rollback configuration changes
- FR-PA10j: Platform Admin can export/import configuration between environments

> **Future Enhancement:** Platform Admin can add custom fields to item blocks per tenant request.

### 3. Tenant Administration

> **Note:** Original FRs (FR15-FR22) retained below, with detailed edge case coverage in subsections 3a-3j.

- FR15: Tenant Admin can view an institutional overview dashboard
- FR16: Tenant Admin can add, edit, and remove Procurement Officers
- FR17: Tenant Admin can view PO activity logs
- FR18: Tenant Admin can view department submission status across the institution
- FR19: Tenant Admin can view budget utilization summary
- FR20: Tenant Admin can view and manage billing information
- FR21: Tenant Admin can view invoices and payment history
- FR22: Tenant Admin can update institutional settings (fiscal year, compliance rules)

#### 3a. Onboarding & Registration

- FR-TA1a: System sends invitation email when Platform Admin creates Tenant Admin
- FR-TA1b: Invitation links expire after 72 hours with resend option
- FR-TA1c: System validates password against policy (12+ chars, uppercase, number, special)
- FR-TA1d: System requires email verification before account activation
- FR-TA1e: Email verification links expire after 24 hours with auto-resend (max 3)
- FR-TA1f: System blocks dashboard access until organization profile is complete
- FR-TA1g: Organization profile requires: name, logo, primary contact, fiscal year config
- FR-TA1h: System prevents duplicate Tenant Admin emails across all tenants
- FR-TA1i: System shows "Contact Support" if tenant is deactivated during onboarding
- FR-TA1j: System supports forgot password flow using invitation email

#### 3b. Dashboard

- FR-TA2a: Dashboard displays summary cards: Total POs, Departments, Submission Progress, Budget
- FR-TA2b: Dashboard shows current fiscal year cycle status and timeline
- FR-TA2c: Dashboard displays recent activity feed (last 20 actions)
- FR-TA2d: Dashboard provides quick action buttons (Add PO, View Reports, Settings)
- FR-TA2e: System shows onboarding guide when no POs exist yet
- FR-TA2f: System shows countdown when submission period hasn't started
- FR-TA2g: System shows "Cycle Complete" summary after submission period ends
- FR-TA2h: Dashboard displays cached data with timestamp if real-time sync fails
- FR-TA2i: System allows switching between fiscal year views when multiple exist
- FR-TA2j: Dashboard data refreshes in real-time via Convex subscriptions

#### 3c. PO Management

- FR-TA3a: Tenant Admin can view list of all POs with status indicators
- FR-TA3b: Tenant Admin can add new PO with name, email, phone
- FR-TA3c: System sends invitation email to new PO
- FR-TA3d: System allows same email as PO in different tenants
- FR-TA3e: System rejects duplicate PO email within same tenant
- FR-TA3f: System notifies Tenant Admin if PO invitation email bounces
- FR-TA3g: PO invitations auto-expire after 7 days with Tenant Admin notification
- FR-TA3h: Tenant Admin can deactivate PO with warning about active submission cycles
- FR-TA3i: System prevents deactivating last active PO
- FR-TA3j: Tenant Admin can reactivate deactivated PO
- FR-TA3k: System soft-deletes PO data, retaining for audit trail
- FR-TA3l: Tenant Admin can view PO activity logs with pagination and filters
- FR-TA3m: Tenant Admin can unlock PO locked out from failed login attempts
- FR-TA3n: Tenant Admin can update PO email address
- FR-TA3o: Tenant Admin can bulk import POs via CSV with row-level validation

#### 3d. Institutional Settings

- FR-TA4a: Tenant Admin can update organization name, logo, contact info
- FR-TA4b: Tenant Admin can configure fiscal year start month and naming convention
- FR-TA4c: System applies fiscal year changes to next cycle only if active cycle exists
- FR-TA4d: Tenant Admin can set default compliance rules (AGPO %, PWD %, Local Content %)
- FR-TA4e: System validates compliance percentages (0-100 each, sum ≤100)
- FR-TA4f: System warns about mid-submission compliance rule changes requiring revalidation
- FR-TA4g: Tenant Admin can configure allowed email domains for users
- FR-TA4h: System prevents removing email domain with existing users
- FR-TA4i: System validates logo uploads (PNG/JPG/SVG, max 2MB)
- FR-TA4j: Tenant Admin can configure timezone for the institution
- FR-TA4k: System logs all settings changes with before/after values and timestamp

> **Future Enhancement:** Platform Admin can configure custom compliance categories per tenant upon request.

#### 3e. Billing & Subscription

- FR-TA5a: Tenant Admin can view current subscription tier and included features
- FR-TA5b: Tenant Admin can view usage metrics (users only)
- FR-TA5c: Tenant Admin can view invoices and payment history
- FR-TA5d: Tenant Admin can download invoices as PDF
- FR-TA5e: Tenant Admin can update payment method
- FR-TA5f: System warns when payment method expires within 30 days
- FR-TA5g: System provides 7-day grace period after payment failure
- FR-TA5h: System suspends account (read-only) after grace period
- FR-TA5i: System retains data for 90 days after suspension
- FR-TA5j: Tenant Admin can upgrade subscription with immediate feature access
- FR-TA5k: System pro-rates charges for mid-cycle upgrades
- FR-TA5l: Tenant Admin can request downgrade effective at next renewal
- FR-TA5m: System blocks downgrade if current usage exceeds new tier limits
- FR-TA5n: System sends pre-renewal notifications (30 days, 7 days)
- FR-TA5o: Enterprise tier upgrades require "Contact Sales" flow

#### 3f. Reporting

- FR-TA6b: Tenant Admin can generate Budget reports
- FR-TA6c: Tenant Admin can generate Activity reports
- FR-TA6d: Tenant Admin can generate Audit reports
- FR-TA6e: Tenant Admin can configure report parameters (date range, departments, format)
- FR-TA6f: System processes large reports in background with email notification
- FR-TA6g: System splits reports >50MB into multiple files
- FR-TA6h: Tenant Admin can schedule recurring reports with email delivery
- FR-TA6i: System retries failed scheduled reports 3x then notifies Tenant Admin
- FR-TA6j: Reports include "Confidential" watermark with generation timestamp
- FR-TA6k: Tenant Admin can generate time-limited secure links for external sharing (72 hours)
- FR-TA6l: System provides print-optimized format with proper pagination

#### 3g. Cross-Institutional Visibility

- FR-TA7a: Tenant Admin can view all departments across all POs
- FR-TA7b: Tenant Admin can filter departments by PO and submission status
- FR-TA7c: Tenant Admin can drill down into department details (read-only)
- FR-TA7d: Tenant Admin can view consolidated budget across institution
- FR-TA7e: System supports virtual scrolling for 100+ departments
- FR-TA7f: System flags data anomalies and suggests PO review
- FR-TA7g: System shows PO status indicators: Not Started, In Progress, Complete
- FR-TA7h: Tenant Admin can export institutional data for GDPR compliance

#### 3h. Notifications

- FR-TA8a: Tenant Admin receives email notifications for key events
- FR-TA8b: System provides in-app notification center
- FR-TA8c: Tenant Admin can configure notification preferences
- FR-TA8d: Tenant Admin can broadcast message to all POs
- FR-TA8e: System supports digest mode for high-notification days
- FR-TA8g: System sends critical notifications via multiple channels (email + in-app)
- FR-TA8h: System excludes Tenant Admin from notifications for own actions

#### 3i. Security

- FR-TA9a: Tenant Admin can view login history
- FR-TA9b: Tenant Admin can enable and manage 2FA
- FR-TA9c: System provides recovery codes for 2FA at setup
- FR-TA9d: Tenant Admin can view and terminate active sessions
- FR-TA9e: System alerts on suspicious login (new location/device)
- FR-TA9f: System enforces progressive lockout for failed login attempts
- FR-TA9g: System enforces password change policy (90 days) with advance warning
- FR-TA9h: Tenant Admin can view detailed audit log with export capability

#### 3j. Account Lifecycle

- FR-TA10a: Tenant Admin can update profile information
- FR-TA10b: Tenant Admin can change email with verification
- FR-TA10c: Tenant Admin can transfer admin role (requires both party confirmation)
- FR-TA10d: Platform Admin can assign new Tenant Admin if original leaves
- FR-TA10f: System allows Tenant Admin to hold multiple roles (also PO)
- FR-TA10g: Tenant Admin must transfer role before deleting own account
- FR-TA10h: System maintains complete audit trail for admin role transfers

### 4. Department Management

- FR23: PO can create new departments with name, code, and budget allocation
- FR23a: System prevents duplicate department codes within tenant
- FR23b: System prevents duplicate department names within tenant
- FR23c: System validates budget is positive number
- FR23d: System warns if total department budgets exceed institution allocation
- FR23e: System validates department code format (alphanumeric, max length)
- FR24: PO can edit existing department details
- FR24a: System warns PO before editing department with active plans
- FR24b: System notifies affected DU when department budget is changed
- FR25: PO can delete departments (with confirmation)
- FR25a: System prevents deletion of department with submitted/approved plans
- FR25b: System requires deactivation of DU accounts before department deletion
- FR25c: System archives deleted department data for audit trail
- FR26: PO can generate access codes for Departmental Users
- FR26b: PO can regenerate code, automatically invalidating previous code
- FR26c: PO can set custom expiration date for access codes
- FR26d: PO can bulk generate codes for all departments at once
- FR26e: PO can send access code directly to DU via system email
- FR26f: PO can view access code usage log (login history per code)
- FR26g: PO can manually deactivate an access code
- FR26h: System generates access codes using format: [FiscalYear]-[DeptInitials]-[RandomChars] (e.g., "2526-CS-A3X9")
- FR26i: PO can copy access code to clipboard with one click
- FR27: PO can assign budget allocations to departments
- FR27a: PO can bulk import departments from Excel template
- FR27b: PO can reorder departments in list view
- FR28: PO can view all departments in a list/grid view
- FR28a: System displays onboarding wizard for first-time PO with no setup
- FR28b: System displays warning if fiscal year not configured
- FR28c: System displays warning if submission deadline not set
- FR28d: System displays empty state with guidance when no departments exist
- FR28e: System displays success state when all departments have submitted
- FR28f: System highlights overdue departments with visual indicators
- FR28g: System displays notification badge for pending item requests
- FR28h: PO can view dashboard for current and previous fiscal years
- FR28i: Dashboard data refreshes in real-time via Convex subscriptions
- FR29: PO can view individual department submission status
- FR29a: PO can view submission status breakdown (Not Started/Draft/Submitted/Rejected/Approved)
- FR29b: PO can filter departments by submission status
- FR29c: PO can send reminder to individual department
- FR29d: PO can send bulk reminder to all pending departments
- FR29e: PO can view submission timeline (when each status changed)
- FR29f: PO can export submission status report to Excel

### 4b. Deadline Management

- FR-DL1: PO can set submission deadline with date and time
- FR-DL2: System prevents setting deadline in the past
- FR-DL3: PO can extend deadline (notifies all DUs)
- FR-DL4: PO can configure reminder schedule (7 days, 3 days, 1 day before)
- FR-DL5: System handles deadline in tenant's configured timezone
- FR-DL6: System displays deadline countdown on DU and PO dashboards

### 5. Category & Item Catalog

- FR30: PO can create procurement categories with name and description
- FR30a: System prevents duplicate category names within tenant
- FR30b: PO can assign color/icon to category for visual distinction in Blockly
- FR30c: PO can bulk import categories from Excel template
- FR30d: PO can reorder categories for display in Blockly toolbox
- FR31: PO can edit existing category details
- FR31a: System warns PO before editing category used in active plans
- FR32: PO can delete categories (with confirmation)
- FR32a: System prevents deletion of category with assigned items
- FR32b: System prevents deletion of category used in submitted/approved plans
- FR32c: PO can archive category (hidden from new plans, visible in existing)
- FR33: PO can create procurement items with description, unit, and price
- FR33a: System prevents duplicate items within same category
- FR33b: System validates unit price is positive number
- FR33c: PO can define unit types (each, box, kg, liter, etc.)
- FR33d: PO can set minimum and maximum quantity per item
- FR33e: PO can flag items as AGPO/PWD/Local Content eligible
- FR33f: PO can bulk import items from Excel template
- FR34: PO can edit existing item details
- FR34a: System notifies DUs when item price changes (toast in active sessions)
- FR34b: System maintains item price history for audit
- FR35: PO can assign items to categories
- FR35a: PO can move items between categories
- FR35b: System prevents unassigned items (category required)
- FR36: PO can set default procurement methods for items
- FR37: PO can view the complete item catalog
- FR37-CS: PO can search items by name, description, or category
- FR37-CF: PO can filter items by category, price range, or compliance flags
- FR37-CE: PO can export item catalog to Excel

### 5b. Item & Category Requests

- FR37a: DU can request a new item not currently in the catalog
- FR37b: DU can request a new category not currently in the catalog
- FR37c: DU can provide justification/description for item or category request
- FR37d: DU can view status of their pending requests (pending/approved/denied)
- FR37e: DU can receive notification when request is approved or denied
- FR37f: System prevents DU from using requested items until PO approves
- FR37g: System automatically expires pending requests at end of submission period
- FR37h: PO can view a dedicated dashboard of all pending item/category requests
- FR37i: PO can receive inline notifications for new requests
- FR37j: PO can approve an item request, adding it to the catalog
- FR37k: PO can modify/edit request details before approving
- FR37l: PO can deny an item request with a reason
- FR37m: PO can approve a category request, adding it to the catalog
- FR37n: PO can deny a category request with a reason
- FR37o: System notifies DU immediately upon approval/denial
- FR37p: System prevents request for item that already exists in catalog
- FR37q: System prevents duplicate pending requests from same DU
- FR37r: System validates request form (required: name, description, estimated price)
- FR37s: DU can cancel their pending request
- FR37t: DU can edit their pending request before PO reviews
- FR37u: System consolidates duplicate requests from multiple DUs for PO review
- FR37v: PO can bulk approve multiple requests at once
- FR37w: PO can bulk deny multiple requests with single reason
- FR37x: PO can view history of processed requests
- FR37y: PO can filter requests by department, status, or date
- FR37z: PO can undo denial within 5 minutes (if DU hasn't been notified)

### 6. Visual Blockly Planning Interface

- FR38: DU can view their department's budget allocation and remaining balance
- FR38a: DU can view submission deadline with countdown
- FR38b: DU can view current plan status (No Plan/Draft/Submitted/Rejected/Approved)
- FR38c: System displays message if no budget allocated ("Contact your PO")
- FR38d: System displays message if deadline passed (read-only mode)
- FR38e: System displays message if categories/items not set up ("Setup in progress")
- FR38f: DU can view rejection comments on dashboard if plan was rejected
- FR38g: System shows appropriate empty state for first-time DU with guidance
- FR39: DU can access a visual Blockly workspace for plan creation
- FR39a: System prevents negative quantity entry
- FR39b: System enforces integer-only quantities (or decimal if unit allows)
- FR39c: System enforces maximum quantity limit per item (configurable)
- FR39d: System blocks submission (not just warns) when budget exceeded
- FR39e: System syncs changes in real-time with offline queue support
- FR39g: System warns DU before leaving page with unsaved changes
- FR39h: System maintains local backup in browser storage for crash recovery
- FR39j: DU can clear entire plan with confirmation ("Start Over")
- FR39k: System prevents duplicate items in same category
- FR39m: System displays toast notification when item removed from catalog while in use
- FR40: DU can drag category blocks onto the workspace
- FR41: DU can drag item blocks into category blocks
- FR42: DU can enter quantities for each quarter (Q1-Q4) per item
- FR43: DU can expand and collapse block details
- FR44: DU can see real-time total calculations as quantities change
- FR45: DU can see a real-time budget meter showing utilization percentage
- FR46: DU can receive visual warnings when budget is exceeded
- FR47: DU can save plan drafts for later editing
- FR48: PO can access the same Blockly interface for plan creation and editing

### 7. Plan Submission & Review

- FR49: DU can submit a completed plan for PO review
- FR49a: System prevents double-submission (button disabled after click)
- FR49b: System displays submission confirmation with timestamp and reference number
- FR49c: DU can withdraw submitted plan if PO hasn't started review
- FR49d: System sends submission confirmation email to DU
- FR49e: System locks plan from editing after submission (read-only)
- FR50: System can validate plan completeness before submission
- FR50a: System prevents submission of empty plan (at least 1 item required)
- FR50b: System prevents submission with zero-quantity items
- FR50c: System prevents submission if pending item requests exist
- FR50d: System displays itemized validation errors with links to fix
- FR50e: System prevents submission if deadline has passed
- FR50g: System displays validation summary before final submit confirmation
- FR51: System can prevent submission of over-budget plans
- FR52: PO can view a list of all submitted plans with status
- FR53: PO can view submitted plan details in read-only mode
- FR53a: PO can view plan comparison with previous submission (diff view)
- FR53b: PO can view plan comparison with previous fiscal year
- FR53c: PO can add internal comments (not visible to DU)
- FR54: PO can approve a submitted plan
- FR54a: PO can undo approval within 24 hours if not yet consolidated
- FR55: PO can reject a plan with revision comments
- FR55a: PO can flag specific items for revision (highlighted for DU)
- FR55b: PO can request minor changes without full rejection (revision request)
- FR55c: PO can set revision deadline for rejected plans
- FR56: DU can receive notification of plan approval or rejection
- FR57: DU can view revision comments and resubmit corrected plans
- FR57a: System displays rejection comments prominently on plan edit screen
- FR57b: System highlights specific items/categories flagged by PO
- FR57c: DU can view submission history with timestamps and statuses
- FR57d: System allows resubmission until deadline (no limit)
- FR57e: System extends revision period if rejection received within 24hrs of deadline
- FR57f: DU can request plan unlock from PO if approved plan has errors

### 8. Consolidation Workspace

- FR58: PO can access a consolidation workspace view
- FR58a: System displays message if no approved plans available for consolidation
- FR58b: System displays warning showing departments not yet approved
- FR59: PO can view all approved department plans as draggable blocks
- FR59a: PO can remove department block from consolidation (returns to available)
- FR59b: PO can reorder department blocks in consolidated view
- FR60: PO can drag approved department blocks into a master aggregate plan
- FR60a: PO can save consolidation as draft for later completion
- FR61: System can calculate grand totals from all consolidated departments
- FR62: System can calculate AGPO allocation (30% of total)
- FR62a: System displays warning if AGPO target (30%) not met
- FR63: System can calculate PWD set-aside (2% of total)
- FR63a: System displays warning if PWD target (2%) not met
- FR64: System can calculate Local Content target (40% of total)
- FR64a: System displays warning if Local Content target (40%) not met
- FR65: PO can view quarterly subtotals across all departments
- FR66: PO can finalize the consolidated annual procurement plan
- FR66a: System prevents finalization if compliance targets not met (configurable)
- FR66b: PO can add notes/comments to finalized plan
- FR66c: System locks finalized plan from editing (requires unlock request)
- FR66d: PO can create multiple consolidation versions for comparison
- FR66e: PO can generate print-friendly consolidation view

### 9. Excel Integration

- FR67: PO can export the consolidated plan to GOK-compliant Excel format
- FR67a: System prevents export until consolidation is finalized
- FR67b: PO can export single department plan (before consolidation)
- FR67c: PO can export to PDF format for printing
- FR67d: System displays progress indicator for large exports
- FR67e: PO can view export history with download links
- FR67f: PO can export audit trail report separately
- FR68: System can generate Excel with proper headers, formatting, and formulas
- FR69: System can include compliance calculations in exported Excel
- FR70: System can include all item details with quarterly breakdowns in export

### 10. Billing & Subscription

> **Cross-Reference:** See Section 2d (Platform Admin Subscription & Billing) and Section 3e (Tenant Admin Billing & Subscription) for role-specific billing requirements.

- FR71: System can provision a 14-day free trial on signup
- FR72: System can display trial expiration countdown
- FR73: Tenant Admin can select a subscription tier (Starter/Professional/Enterprise)
- FR74: Tenant Admin can choose a payment method (Bank Transfer/M-Pesa/Stripe)
- FR75: System can generate invoices aligned to fiscal year
- FR76: System can process payments and update subscription status
- FR77: System can enforce feature limits based on subscription tier
- FR78: System can transition tenant to grace period after failed payment
- FR79: System can suspend tenant access after grace period expires

### 11. Notifications & Communication

- FR80: System can send email notifications for plan submissions
- FR81: System can send email notifications for plan approvals/rejections
- FR82: System can send reminder emails for approaching deadlines
- FR83: System can send billing-related notifications (invoices, payment confirmations)
- FR84: PO can send custom messages to DUs via the platform
- FR84a: System can send notification to PO when DU submits item/category request
- FR84b: System can send notification to DU when request is approved (with any modifications noted)
- FR84c: System can send notification to DU when request is denied (with reason)
- FR84d: System can send reminder to PO for pending requests approaching deadline
- FR84e: System can notify DU when their pending request expires

### 12. Audit & Compliance

- FR85: System can log all user actions with timestamp and user details
- FR86: System can maintain immutable audit trail for compliance
- FR87: PO can view audit logs for their procurement activities
- FR88: Tenant Admin can generate audit reports for compliance reviews
- FR89: System can track plan version history with before/after states

### 13. Marketing & Onboarding

- FR90: Visitors can view a marketing landing page with feature descriptions
- FR91: Visitors can view pricing tiers and comparison
- FR92: Visitors can start a trial signup process
- FR93: New users can complete an onboarding flow after first login
- FR94: Users can access contextual help within the application

## Non-Functional Requirements

### Performance

| NFR | Requirement | Measurement | Priority |
|-----|-------------|-------------|----------|
| NFR-P1 | Blockly workspace loads within 2 seconds for plans with up to 15 departments | Load time measured from navigation click to interactive workspace | Critical |
| NFR-P2 | Block drag-and-drop operations complete within 100ms | User action to visual update latency | Critical |
| NFR-P3 | Real-time budget calculations update within 200ms of quantity change | Input change to displayed total | Critical |
| NFR-P4 | Excel export generates within 10 seconds for plans with 500+ items | Export button click to download start | High |
| NFR-P5 | Dashboard pages load within 1 second | First contentful paint | High |
| NFR-P6 | Search and filter operations return results within 500ms | Query to results display | Medium |
| NFR-P7 | Concurrent user support: 50 users per tenant without degradation | Response times remain within targets at load | Critical |

### Security

| NFR | Requirement | Measurement | Priority |
|-----|-------------|-------------|----------|
| NFR-S1 | Complete tenant data isolation — no cross-tenant data access under any circumstance | Security audit; penetration testing | Critical |
| NFR-S2 | All data encrypted at rest using AES-256 | Encryption verification | Critical |
| NFR-S3 | All data encrypted in transit using TLS 1.3 | SSL/TLS certificate validation | Critical |
| NFR-S4 | Session tokens expire after 24 hours of inactivity | Session management testing | High |
| NFR-S5 | Password requirements: minimum 12 characters, uppercase, lowercase, number, special character | Validation testing | High |
| NFR-S6 | Failed login attempts limited to 5 before temporary lockout | Security testing | High |
| NFR-S7 | All user inputs sanitized against SQL injection and XSS | Security scan; penetration testing | Critical |
| NFR-S8 | API rate limiting enforced per tenant tier | Load testing | High |
| NFR-S9 | Immutable audit logs — append-only with no deletion capability | Audit verification | Critical |
| NFR-S10 | CORS restricted to known domains only | Security configuration audit | High |

### Scalability

| NFR | Requirement | Measurement | Priority |
|-----|-------------|-------------|----------|
| NFR-SC1 | System supports 50 tenants with no performance degradation | Load testing | MVP |
| NFR-SC2 | System supports 500 tenants with <10% performance degradation | Capacity planning; load testing | Year 2 |
| NFR-SC3 | Single tenant supports 200 concurrent users at peak | Stress testing | Growth |
| NFR-SC4 | Blockly workspace handles 15 departments × 25 categories × 100 items per plan | Performance testing | MVP |
| NFR-SC5 | Database supports 1M+ procurement items across all tenants | Database capacity testing | Year 2 |
| NFR-SC6 | Horizontal scaling capability for application tier | Architecture review | Growth |

### Reliability

| NFR | Requirement | Measurement | Priority |
|-----|-------------|-------------|----------|
| NFR-R1 | System uptime of 99.5% (excluding planned maintenance) | Monitoring; uptime reporting | Critical |
| NFR-R2 | Zero data loss for committed transactions | Backup verification; recovery testing | Critical |
| NFR-R3 | Automated daily backups with 30-day retention | Backup logs | Critical |
| NFR-R4 | Recovery Point Objective (RPO): 1 hour maximum data loss | Backup frequency | High |
| NFR-R5 | Recovery Time Objective (RTO): 4 hours to full recovery | Disaster recovery testing | High |
| NFR-R6 | No planned maintenance during peak season (July-September) | Maintenance schedule policy | High |
| NFR-R7 | Graceful degradation — core functions remain available if non-critical services fail | Chaos testing | Medium |

### Accessibility

| NFR | Requirement | Measurement | Priority |
|-----|-------------|-------------|----------|
| NFR-A1 | WCAG 2.1 Level AA compliance for all standard interfaces | Accessibility audit | High |
| NFR-A2 | Keyboard navigation support for all primary workflows | Manual testing | High |
| NFR-A3 | Screen reader compatibility for dashboard and forms | Assistive technology testing | High |
| NFR-A4 | Color contrast ratio minimum 4.5:1 for text | Automated accessibility scan | High |
| NFR-A5 | Blockly workspace: Alternative data entry method available (form-based fallback) | Functional testing | Medium |
| NFR-A6 | All images and icons have appropriate alt text | Accessibility audit | High |

### Integration

| NFR | Requirement | Measurement | Priority |
|-----|-------------|-------------|----------|
| NFR-I1 | Excel export produces files compatible with Microsoft Excel 2016+ | Compatibility testing | Critical |
| NFR-I2 | Excel export matches GOK Annual Procurement Plan template format exactly | Template comparison | Critical |
| NFR-I3 | Email notifications delivered within 60 seconds of triggering event | Email delivery monitoring | High |
| NFR-I4 | Email delivery success rate of 99%+ | Email analytics | High |
| NFR-I5 | API response format follows OpenAPI 3.0 specification | API documentation validation | Growth |
| NFR-I6 | Webhook events delivered within 30 seconds with 3x retry | Integration testing | Growth |

### Data Governance

| NFR | Requirement | Measurement | Priority |
|-----|-------------|-------------|----------|
| NFR-D1 | Audit trail retention: 7 years minimum | Data retention policy | Critical |
| NFR-D2 | Data export available on tenant request within 30 days | Process verification | High |
| NFR-D3 | Data deletion on tenant request within 90 days of subscription end | Process verification | High |
| NFR-D4 | All data stored in African or European data centers | Infrastructure audit | High |
| NFR-D5 | No data shared with third parties without explicit tenant consent | Privacy policy; audit | Critical |

