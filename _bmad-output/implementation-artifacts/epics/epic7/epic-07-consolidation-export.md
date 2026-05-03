---
epic: 7
title: "PO Consolidation & Excel Export"
status: ready
priority: P0
totalStories: 6
frsConvered: ["FR58-FR66e", "FR67-FR70"]
nfrsAddressed: ["NFR-S1", "NFR-S7", "NFR-P1", "NFR-P4"]
dependencies: ["Epic 5", "Epic 6"]
createdAt: 2026-01-22
---

# Epic 7: PO Consolidation & Excel Export

## Epic Goal

POs can consolidate approved department plans into a master Annual Procurement Plan with automatic compliance calculations and export to GOK-compliant Excel format.

## User Outcome

POs (like Sarah Mwangi from the user journey) can complete consolidation in hours instead of weeks, with automatic compliance calculations and one-click export to government-standard Excel format.

## Key Transformation

**Before Procureline:** 2+ weeks of manual Excel consolidation with error-prone copy-paste.
**After Procureline:** 2-4 hours of automated consolidation with a unified workspace and automatic calculations.

## Requirements Covered

### Functional Requirements

**Consolidation Workspace (18 FRs):**
- FR58-FR60a: Consolidation workspace, automated aggregation of approved plans into a unified view
- FR61-FR64a: Grand totals, AGPO (30%), PWD (2%), Local Content (40%)
- FR65-FR66e: Quarterly subtotals, finalization, versioning, print view

**Excel Integration (10 FRs):**
- FR67-FR67f: GOK-compliant export, single department export, export history
- FR68-FR70: Excel formatting, compliance calculations, item details

### Non-Functional Requirements
- NFR-S1: Complete tenant data isolation
- NFR-S7: All user inputs sanitized
- NFR-P1: Page load time under 2 seconds
- NFR-P4: Excel export generates within 10 seconds for 500+ items

## Implementation Notes

- Consolidation uses a unified Blockly visual interface which aggregates all approved departmental plans automatically, as implemented in the prototype @procurelinedb.html

- Compliance calculations performed server-side for accuracy
- Excel generation via NestJS microservice using ExcelJS
- GOK template includes: cover page, summary, department breakdowns, compliance sheet
- All exports logged in audit trail

---

## Story Delivery Map

- `Story 7.1` achieves controlled entry into the consolidation phase. Delivery should ensure only the right PO and the right plan states can open the consolidation workspace, with enough context to understand what is ready.
- `Story 7.2` achieves the actual assembly of approved departmental plans into one institutional view. Delivery should support automated aggregation of approved plans within the workspace while preserving traceability back to source plans.
- `Story 7.3` achieves trustworthy compliance and financial totals during consolidation. Delivery should centralize calculations, surface threshold breaches immediately, and avoid duplicating business logic across UI and export layers.
- `Story 7.4` achieves a formal handoff from editable consolidation to frozen versioned output. Delivery should introduce explicit finalization rules, revision history, and safeguards against silent post-finalization changes.
- `Story 7.5` achieves exportability of the consolidated plan. Delivery should orchestrate export jobs, progress feedback, and secure retrieval of generated files without blocking the main user workflow.
- `Story 7.6` achieves standards-compliant Excel output instead of a raw data dump. Delivery should shape workbook structure, formatting, formulas, and required content so the output is acceptable to downstream government processes.

---

## Stories

### Story 7.1: Consolidation Workspace Access

As a **Procurement Officer**,
I want to access a dedicated consolidation workspace,
So that I can begin aggregating approved department plans.

**Acceptance Criteria:**

**Given** a PO navigates to Consolidation
**When** they access the workspace
**Then** system displays consolidation workspace view (FR58)
**And** shows: available departments (left), consolidation canvas (center), totals (right)

**Given** no approved plans exist
**When** PO opens consolidation
**Then** system displays message: "No approved plans available for consolidation. Approve department submissions first." (FR58a)

**Given** some departments haven't submitted or aren't approved
**When** PO opens consolidation
**Then** system displays warning listing departments not yet approved (FR58b)
**And** shows count: "X of Y departments ready"

**Given** approved plans exist
**When** PO opens the consolidation workspace
**Then** system automatically loads all approved department plans into the unified view (FR59)
**And** each department's items and totals are displayed

**Given** a PO wants to work on consolidation later
**When** they save progress
**Then** system saves consolidation as draft (FR60a)
**And** draft is available on next login

**Technical Notes:**
- Consolidation state in `consolidations` table with `fiscalYearId`, `status`, `draftData`
- Available departments from `plans` where `status: 'approved'`
- Warning list from departments without approved plans
- Draft auto-save every 60 seconds

---

### Story 7.2: Automated Department Plan Aggregation

As a **Procurement Officer**,
I want the consolidation workspace to automatically aggregate all approved department plans,
So that I can immediately view the master Annual Procurement Plan without manual assembly.

**Acceptance Criteria:**

**Given** a PO opens the consolidation workspace
**When** the workspace initializes
**Then** system automatically aggregates all approved department plans into a single unified master plan (FR60)
**And** totals update automatically based on the aggregated items

**Given** an aggregated department is in the consolidation
**When** PO reviews the plan
**Then** PO can see the origin of each item (which department it belongs to)
**And** items are grouped or tagged by their source department

**Given** a PO reviews the consolidation canvas
**When** viewing the interface
**Then** PO can expand to see department details: categories, items, quarterly totals
**And** system displays a clear visual indication of all consolidated departments

**Technical Notes:**
- The full blockly workflow for PO consolidation has been prototyped in @procurelinedb.html where it automatically aggregates all plans in a single view. The implementation should mimic this unified workspace.
- Consolidation data is derived dynamically from all `status: 'approved'` plans.
- Expansion state stored in localStorage for persistence.

---

### Story 7.3: Compliance Calculations & Totals

As a **Procurement Officer**,
I want automatic compliance calculations displayed in real-time,
So that I can ensure the plan meets GOK requirements.

**Acceptance Criteria:**

**Given** departments are consolidated
**When** calculations run
**Then** system calculates grand totals from all consolidated departments (FR61)
**And** displays: total amount, item count, department count

**Given** departments are consolidated
**When** compliance is calculated
**Then** system calculates AGPO allocation as 30% of total (FR62)
**And** displays: target amount, actual amount from flagged items, percentage achieved

**Given** AGPO allocation is below 30%
**When** viewing compliance
**Then** system displays warning: "AGPO target not met. Current: X%, Required: 30%" (FR62a)

**Given** departments are consolidated
**When** compliance is calculated
**Then** system calculates PWD set-aside as 2% of total (FR63)
**And** displays: target amount, actual amount, percentage achieved

**Given** PWD allocation is below 2%
**When** viewing compliance
**Then** system displays warning: "PWD target not met. Current: X%, Required: 2%" (FR63a)

**Given** departments are consolidated
**When** compliance is calculated
**Then** system calculates Local Content target as 40% of total (FR64)
**And** displays: target amount, actual amount, percentage achieved

**Given** Local Content is below 40%
**When** viewing compliance
**Then** system displays warning: "Local Content target not met. Current: X%, Required: 40%" (FR64a)

**Given** departments are consolidated
**When** viewing quarterly breakdown
**Then** system shows quarterly subtotals across all departments (FR65)
**And** displays: Q1, Q2, Q3, Q4 totals

**Given** all compliance targets are met
**When** viewing compliance panel
**Then** system shows green checkmarks for each target

**Technical Notes:**
- Compliance flags from items: agpo, pwd, localContent (boolean fields)
- Calculations: sum items with flag / total × 100
- Quarterly totals from sum of all department quarterly data
- Warnings use configurable thresholds from tenant settings

---

### Story 7.4: Finalization & Versioning

As a **Procurement Officer**,
I want to finalize the consolidated plan and maintain versions,
So that I can create an official record while preserving comparison capability.

**Acceptance Criteria:**

**Given** a PO is ready to finalize
**When** they click "Finalize Plan"
**Then** system marks consolidation as finalized (FR66)
**And** creates immutable snapshot

**Given** compliance targets are not met
**When** PO attempts to finalize
**Then** system prevents finalization (configurable) (FR66a)
**And** displays: "Cannot finalize. Compliance targets not met."
**And** tenant setting can override to allow finalization with warning

**Given** a PO finalizes the plan
**When** they want to add context
**Then** system allows adding notes/comments to finalized plan (FR66b)

**Given** a plan is finalized
**When** PO views it
**Then** system locks plan from editing (FR66c)
**And** shows "Finalized on [date] by [user]"
**And** edit requires unlock request to Tenant Admin

**Given** a PO wants to explore alternatives
**When** before finalizing
**Then** PO can create multiple consolidation versions for comparison (FR66d)
**And** versions are named (e.g., "Version A - All Depts", "Version B - Excl Engineering")

**Given** a PO needs to print the plan
**When** they click "Print View"
**Then** system generates print-friendly consolidation view (FR66e)
**And** view is optimized for paper with proper page breaks

**Technical Notes:**
- Finalization creates `finalizedAt` timestamp and locks record
- Finalization snapshot in `consolidationSnapshots` table
- Compliance gate controlled by `tenant.settings.requireComplianceForFinalization`
- Versions stored with `parentConsolidationId` for grouping
- Print view via CSS @media print rules

---

### Story 7.5: Excel Export

As a **Procurement Officer**,
I want to export the consolidated plan to GOK-compliant Excel,
So that I can submit the official Annual Procurement Plan.

**Acceptance Criteria:**

**Given** a PO has a finalized consolidation
**When** they click "Export to Excel"
**Then** system generates GOK-compliant Excel format (FR67)
**And** download starts automatically

**Given** consolidation is not finalized
**When** PO attempts to export
**Then** system prevents export: "Finalize the consolidation before exporting" (FR67a)

**Given** a PO wants to export before consolidation
**When** they select a single department
**Then** system allows exporting single department plan (FR67b)
**And** export includes department-level compliance calculations

**Given** a large export is generating
**When** processing takes more than 3 seconds
**Then** system displays progress indicator (FR67d)
**And** shows estimated completion time

**Given** multiple exports have been generated
**When** PO views export history
**Then** system shows history with download links (FR67e)
**And** history includes: date, user, format, download count

**Given** a PO needs compliance audit trail
**When** they export audit trail
**Then** system generates separate audit trail report (FR67f)
**And** includes all actions, changes, and timestamps

**Technical Notes:**
- Excel generation via NestJS microservice using ExcelJS
- Export files stored in Convex file storage with 30-day retention
- Progress via websocket updates from NestJS service
- History in `exportHistory` table with download tracking
- GOK template predefined with correct structure

---

### Story 7.6: Excel Formatting & Content

As a **Procurement Officer**,
I want the Excel export to be properly formatted with all required data,
So that it meets government submission requirements.

**Acceptance Criteria:**

**Given** an export is generated
**When** the Excel file is created
**Then** system includes proper headers, formatting, and formulas (FR68)
**And** follows GOK template: cover page, summary, department sheets, compliance sheet

**Given** an export is generated
**When** compliance data is included
**Then** system includes compliance calculations in exported Excel (FR69)
**And** shows: AGPO %, PWD %, Local Content % with actual vs. target

**Given** an export is generated
**When** item data is included
**Then** system includes all item details with quarterly breakdowns (FR70)
**And** each item shows: name, category, unit, price, Q1-Q4 quantities, total

**Given** the Excel is opened
**When** reviewing the structure
**Then** Excel includes:
- Cover page with institution name, fiscal year, generation date
- Summary sheet with grand totals and compliance
- Department sheets (one per department) with items
- Compliance breakdown sheet
- Audit information sheet

**Given** the Excel is opened
**When** reviewing formatting
**Then** cells use:
- Currency formatting for monetary values
- Percentage formatting for compliance
- Proper column widths
- Freeze panes for headers
- Print area configured

**Given** the Excel is shared
**When** recipient uses different Excel version
**Then** file is compatible with Excel 2010+ and Google Sheets

**Technical Notes:**
- ExcelJS configuration with predefined styles
- Template stored as XLSX resource in NestJS service
- Dynamic sheet generation per department
- Formula references for auto-calculating totals
- XLSX format for maximum compatibility

---

## Story Dependency Graph

```
Story 7.1 (Workspace Access)
    │
    └── Story 7.2 (Automated Aggregation)
            │
            └── Story 7.3 (Compliance Calculations)
                    │
                    └── Story 7.4 (Finalization)
                            │
                            └── Story 7.5 (Excel Export)
                                    │
                                    └── Story 7.6 (Excel Formatting)
```

## Definition of Done

- [ ] All 6 stories implemented and tested
- [ ] Consolidation workspace tested with 15+ departments
- [ ] Compliance calculations verified against manual calculations
- [ ] Excel export matches GOK template exactly
- [ ] Export history accessible and download links work
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
