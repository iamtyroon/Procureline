# Procureline Blockly Blocks - Complete Feature Analysis

## Overview

The Procureline application uses **6 custom Blockly block types** across two distinct workspaces:
- **DU (Departmental User) Editor** - For creating departmental procurement plans
- **PO (Procurement Officer) Editor** - For consolidating and reviewing submitted plans

---

## Block Types Summary

| Block Type | Icon | Color | Used By | Purpose |
|------------|------|-------|---------|---------|
| `department_block` | 🏛️ | 225 | DU & PO | Container for department procurement data |
| `category_block` | 📂 | 195 | DU & PO | Groups items by procurement category |
| `item_block` | 📦 | 160 | DU & PO | Individual procurement line items |
| `aggregate_plan_block` | 📊 | 50 | PO only | Master consolidation container |
| `planned_timing_block` | 📅 | 210 | PO only | Planned procurement schedule |
| `actual_timing_block` | ✅ | 120 | PO only | Actual execution dates |
| `variance_timing_block` | 📊 | 45 | PO only | Variance analysis |

---

## 1. DEPARTMENT BLOCK (`department_block`)

**Color:** 225 (Blue-Purple)
**Icon:** 🏛️
**Used by:** Both DU and PO workspaces

### Fields & Inputs

| Field Name | Type | Visibility | Editability | Description |
|------------|------|------------|-------------|-------------|
| `DEPT_TOGGLE_ICON` | FieldImage | Always | Clickable | Collapse/expand toggle arrow |
| `DEPT_NAME` | FieldLabelSerializable | Always | Read-only | Department name |
| `VOTE_NUMBER` | FieldLabelSerializable | Collapsed: Hidden | Read-only (set by PO) | Vote number (e.g., "V-202X-XX") |
| `BUDGET` | FieldLabelSerializable | Collapsed: Hidden | Read-only (set by PO) | Department budget in KES |
| `CATEGORIES` | StatementInput | Always | Accepts `category_block` | Container for category blocks |
| `DEPT_TOTAL` | FieldLabelSerializable | Always | Auto-calculated | Running total in KES |

### Behaviors

- **Collapsible UI:** Click toggle icon to show/hide Vote # and Budget fields
- **CSS Classes:** `dept-block-collapsed` / `dept-block-expanded`
- **Over-budget Warning:** Visual red warning + text when total exceeds budget
- **Mutation Support:** Saves/restores `budget` and `vote_number` via XML mutations

### Connection Types

- **Previous:** `["department_block", "aggregate_plan_block"]`
- **Next:** `["department_block", "aggregate_plan_block", "planned_timing_block", "actual_timing_block", "variance_timing_block"]`

---

## 2. CATEGORY BLOCK (`category_block`)

**Color:** 195 (Teal)
**Icon:** 📂
**Defined via:** JSON Array

### Fields & Inputs

| Field Name | Type | Description |
|------------|------|-------------|
| `CATEGORY_NAME` | field_label_serializable | Category name (e.g., "Office Supplies") |
| `ITEMS` | input_statement | Container for `item_block` children |
| `CAT_Q1_TOTAL` | field_label | Q1 quarterly cost subtotal |
| `CAT_Q2_TOTAL` | field_label | Q2 quarterly cost subtotal |
| `CAT_Q3_TOTAL` | field_label | Q3 quarterly cost subtotal |
| `CAT_Q4_TOTAL` | field_label | Q4 quarterly cost subtotal |
| `CATEGORY_GRAND_TOTAL` | field_label | Category total cost |

### Display Format

```
📂 Category: [CATEGORY_NAME]
   [ITEMS statement input]
Q1: [Q1] | Q2: [Q2] | Q3: [Q3] | Q4: [Q4] | Total: [GRAND_TOTAL]
```

### Connection Types

- **Previous:** `category_block`
- **Next:** `category_block`

---

## 3. ITEM BLOCK (`item_block`)

**Color:** 160 (Green)
**Icon:** 📦
**Used by:** Both DU and PO workspaces

### Fields & Inputs

| Field Name | Type | Visibility | Editability | Description |
|------------|------|------------|-------------|-------------|
| `TOGGLE_ICON` | FieldImage | Always | Clickable | Collapse/expand toggle |
| `ITEM_DESC` | FieldLabelSerializable | Always | Read-only (set by PO) | Item description |
| `UNIT_OF_MEASUREMENT` | FieldLabelSerializable | Collapsed: Hidden | Read-only | Unit (Pcs, Kg, etc.) |
| `UNIT_PRICE` | FieldLabelSerializable | Collapsed: Hidden | Read-only | Price per unit in KES |
| `PROC_METHOD` | FieldLabelSerializable | Collapsed: Hidden | Read-only | Procurement method (RFQ, OT, etc.) |
| `SOURCE_OF_FUNDS` | FieldLabelSerializable | Collapsed: Hidden | Read-only | Funding source (GOK, Donor, etc.) |
| `Q1_QTY` | FieldNumber | Always | **Editable by DU** | Quarter 1 quantity (min: 0) |
| `Q2_QTY` | FieldNumber | Always | **Editable by DU** | Quarter 2 quantity (min: 0) |
| `Q3_QTY` | FieldNumber | Always | **Editable by DU** | Quarter 3 quantity (min: 0) |
| `Q4_QTY` | FieldNumber | Always | **Editable by DU** | Quarter 4 quantity (min: 0) |
| `ITEM_TOTAL_QTY` | FieldLabelSerializable | Always | Auto-calculated | Total quantity (Q1+Q2+Q3+Q4) |
| `ITEM_TOTAL_COST` | FieldLabelSerializable | Always | Auto-calculated | Total cost (qty × price) |

### Behaviors

- **Collapsible UI:** Expanded shows Unit, Price, Method, Source fields
- **Inline Mode:** Collapsed = inline, Expanded = stacked
- **CSS Classes:** `item-block-collapsed` / `item-block-expanded`
- **Auto-calculation:** `ITEM_TOTAL_COST = (Q1+Q2+Q3+Q4) × UNIT_PRICE`

### Connection Types

- **Previous:** `item_block`
- **Next:** `item_block`

---

## 4. AGGREGATE PLAN BLOCK (`aggregate_plan_block`)

**Color:** 50 (Yellow/Gold)
**Icon:** 📊
**Used by:** PO workspace only

### Fields & Inputs

| Field Name | Type | Description |
|------------|------|-------------|
| `FINANCIAL_YEAR` | field_input | Fiscal year (e.g., "2025-2026") - **Editable** |
| `DEPARTMENTS` | input_statement | Container for `department_block` children |
| `GRAND_TOTAL` | field_label | University-wide grand total |
| `AGPO_CALCULATED` | field_label | Auto-calculated: 30% of grand total |
| `PWD_CALCULATED` | field_label | Auto-calculated: 2% of grand total |
| `LOCAL_CONTENT_CALCULATED` | field_label | Auto-calculated: 40% of grand total |

### Display Format

```
📊 ANNUAL PROCUREMENT PLAN F/Y [FINANCIAL_YEAR]
   [DEPARTMENTS statement input]
GRAND TOTAL: KES [GRAND_TOTAL]
AGPO (30%): KES [AGPO_CALCULATED]
PWD (2%): KES [PWD_CALCULATED]
LOCAL (40%): KES [LOCAL_CONTENT_CALCULATED]
```

### Auto-Calculations

| Field | Formula |
|-------|---------|
| `AGPO_CALCULATED` | `GRAND_TOTAL × 0.30` |
| `PWD_CALCULATED` | `GRAND_TOTAL × 0.02` |
| `LOCAL_CONTENT_CALCULATED` | `GRAND_TOTAL × 0.40` |

### Connection Types

- **No previous/next** (top-level block)

---

## 5-7. TIMING BLOCKS (Factory Pattern)

Three timing blocks share the same structure via `createTimingBlock()` factory:

| Block Type | Icon | Color | Purpose |
|------------|------|-------|---------|
| `planned_timing_block` | 📅 | 210 (Purple) | Planned procurement schedule |
| `actual_timing_block` | ✅ | 120 (Green) | Actual execution dates |
| `variance_timing_block` | 📊 | 45 (Orange) | Variance analysis |

### Fields (All 3 blocks share identical structure)

| Field Name | Type | Visibility | Description |
|------------|------|------------|-------------|
| `TIMING_TOGGLE_ICON` | FieldImage | Always | Collapse/expand toggle |
| `FIELD1` | FieldTextInput | Collapsed: Hidden | Time process days |
| `FIELD2` | FieldTextInput | Collapsed: Hidden | Invite/Advertisement date |
| `FIELD3` | FieldTextInput | Collapsed: Hidden | Bid Opening date |
| `FIELD4` | FieldTextInput | Collapsed: Hidden | Bid Evaluation date |
| `FIELD5` | FieldTextInput | Collapsed: Hidden | Tender Award date |
| `FIELD6` | FieldTextInput | Collapsed: Hidden | Notification of Award date |
| `FIELD7` | FieldTextInput | Collapsed: Hidden | Contract Signing date |
| `FIELD8` | FieldTextInput | Collapsed: Hidden | Total Time for Contract |
| `FIELD9` | FieldTextInput | Collapsed: Hidden | Date of Completion |

### Connection Types

- **Previous:** `["department_block", "aggregate_plan_block", "planned_timing_block", "actual_timing_block", "variance_timing_block"]`
- **Next:** Same as previous

---

## Workspace Configurations

### DU Toolbox Categories

| Category | Color | Contents |
|----------|-------|----------|
| 🏛️ Dept Info | 225 | Single `department_block` pre-filled with user's department |
| 📂 [Category Name] | 195 | Dynamically generated from `appData.categories` with filtered items |

**Dynamic Features:**
- Categories filtered by `selectedCategories` set
- Used blocks automatically hidden from toolbox
- Toolbox refreshes on block create/delete/move events (debounced 100ms)

### PO Toolbox Categories

| Category | Color | Contents |
|----------|-------|----------|
| 📊 Submitted Plans | 225 | Department blocks from approved `appData.submittedPlans` |
| 📋 Consolidation | 160 | Single `aggregate_plan_block` |
| ⏱️ Timing | 210 | Pre-chained timing blocks (planned → actual → variance) |

---

## Workspace Options

```javascript
{
    scrollbars: true,
    trashcan: true,
    grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
    zoom: { controls: true, wheel: true, startScale: 0.9 }
}
```

---

## Real-time Calculation System

### DU Calculations (`updateTotalsDU`)

1. Traverses department → categories → items hierarchy
2. For each item: `ITEM_TOTAL_COST = (Q1+Q2+Q3+Q4) × UNIT_PRICE`
3. For each category: Sums item costs + quarterly breakdowns
4. For department: Sums all category totals
5. **Budget Meter UI:** Updates progress bar with danger/warning colors
6. **Over-budget detection:** Red warning when total > budget

### PO Calculations (`updateTotalsPO`)

1. Traverses aggregate → departments → categories → items
2. Same item/category calculations as DU
3. Calculates grand total across all departments
4. Auto-calculates AGPO (30%), PWD (2%), LOCAL (40%) allocations
5. Over-budget warnings per department

---

## Export Validation (PO)

Before Excel export, the system validates:
1. Aggregate Plan block must exist
2. Department blocks must be connected to aggregate
3. Timing blocks must be attached to each department

---

# Block Interaction Flow: DU to PO Workflow

## Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROCUREMENT OFFICER (PO)                             │
│                         SYSTEM SETUP PHASE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. PO creates DEPARTMENTS in the system                                    │
│     - Sets Department Name                                                  │
│     - Assigns Vote Number (V-202X-XX)                                       │
│     - Allocates Department Budget (KES)                                     │
│                                                                             │
│  2. PO creates CATEGORY CATALOG                                             │
│     - Defines procurement categories (Office Supplies, IT Equipment, etc.)  │
│     - Creates ITEM templates within each category:                          │
│       • Item Description                                                    │
│       • Unit of Measurement                                                 │
│       • Unit Price (KES)                                                    │
│       • Procurement Method (RFQ, OT, Direct, etc.)                          │
│       • Source of Funds (GOK, Donor, Internal, etc.)                        │
│                                                                             │
│  3. PO assigns categories to departments                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DEPARTMENTAL USER (DU)                                 │
│                       PLAN CREATION PHASE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DU WORKSPACE TOOLBOX (Dynamic)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🏛️ Dept Info                                                        │   │
│  │   └── department_block (pre-filled, READ-ONLY metadata)             │   │
│  │       • DEPT_NAME: "Computer Science"                               │   │
│  │       • VOTE_NUMBER: "V-2025-001"                                   │   │
│  │       • BUDGET: "500000"                                            │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ 📂 Office Supplies                                                  │   │
│  │   ├── category_block (READ-ONLY name)                               │   │
│  │   ├── item_block: "A4 Paper" (Ream, KES 450, RFQ, GOK)              │   │
│  │   ├── item_block: "Printer Toner" (Pc, KES 3500, RFQ, GOK)          │   │
│  │   └── item_block: "Stapler" (Pc, KES 250, RFQ, GOK)                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ 📂 IT Equipment                                                     │   │
│  │   ├── category_block (READ-ONLY name)                               │   │
│  │   ├── item_block: "Laptop" (Pc, KES 85000, OT, GOK)                 │   │
│  │   └── item_block: "USB Drive" (Pc, KES 1500, RFQ, GOK)              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DU ACTIONS:                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Drag department_block to workspace                               │   │
│  │ 2. Drag category_block(s) into CATEGORIES slot                      │   │
│  │ 3. Drag item_block(s) into category ITEMS slot                      │   │
│  │ 4. SET QUARTERLY QUANTITIES (only editable fields):                 │   │
│  │    • Q1_QTY, Q2_QTY, Q3_QTY, Q4_QTY                                  │   │
│  │                                                                     │   │
│  │ 5. REAL-TIME CALCULATIONS (automatic):                              │   │
│  │    • Item Total = (Q1+Q2+Q3+Q4) × Unit Price                        │   │
│  │    • Category Totals (per quarter + grand)                          │   │
│  │    • Department Total                                               │   │
│  │    • Budget utilization meter updates                               │   │
│  │    • Over-budget warnings appear if exceeded                        │   │
│  │                                                                     │   │
│  │ 6. Optional: Request new items via "Request Item" button            │   │
│  │ 7. Export to Excel for review                                       │   │
│  │ 8. Click "Submit to PO" when complete                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  SUBMISSION DATA (saved to database):                                       │
│  • Blockly XML (complete workspace serialization)                          │
│  • Department ID & Name                                                    │
│  • Fiscal Year                                                             │
│  • Total Cost                                                              │
│  • Item Count                                                              │
│  • Status: "submitted"                                                     │
│  • Submitted By (User ID)                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROCUREMENT OFFICER (PO)                               │
│                       REVIEW & APPROVAL PHASE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PO DASHBOARD shows:                                                        │
│  • Pending submissions from departments                                    │
│  • Submission status per department                                        │
│  • Budget utilization overview                                             │
│                                                                             │
│  PO ACTIONS:                                                                │
│  • Review submitted plans                                                  │
│  • Approve or Reject with feedback                                         │
│  • Status changes to "approved" or "rejected"                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROCUREMENT OFFICER (PO)                               │
│                      CONSOLIDATION PHASE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PO WORKSPACE TOOLBOX                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📊 Submitted Plans (only APPROVED plans appear)                     │   │
│  │   ├── department_block: "Computer Science" (with nested structure)  │   │
│  │   │   ├── category_block: "Office Supplies"                         │   │
│  │   │   │   ├── item_block: "A4 Paper" (Q1:10, Q2:15, Q3:10, Q4:20)   │   │
│  │   │   │   └── item_block: "Printer Toner" (Q1:2, Q2:2, Q3:2, Q4:2)  │   │
│  │   │   └── category_block: "IT Equipment"                            │   │
│  │   │       └── item_block: "Laptop" (Q1:5, Q2:0, Q3:3, Q4:2)         │   │
│  │   │                                                                 │   │
│  │   ├── department_block: "Mathematics" (with nested structure)       │   │
│  │   └── department_block: "Physics" (with nested structure)           │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ 📋 Consolidation                                                    │   │
│  │   └── aggregate_plan_block                                          │   │
│  │       • FINANCIAL_YEAR: "2025-2026" (editable)                      │   │
│  │       • DEPARTMENTS slot (accepts department_blocks)                │   │
│  │       • Auto-calculates: GRAND_TOTAL, AGPO, PWD, LOCAL              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ⏱️ Timing (pre-chained set)                                         │   │
│  │   └── planned_timing_block                                          │   │
│  │       └── actual_timing_block                                       │   │
│  │           └── variance_timing_block                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PO CONSOLIDATION WORKFLOW:                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Drag aggregate_plan_block to workspace                           │   │
│  │ 2. Set FINANCIAL_YEAR                                               │   │
│  │                                                                     │   │
│  │ 3. Drag department_block(s) into DEPARTMENTS slot                   │   │
│  │    (These come with full nested category/item structure)            │   │
│  │                                                                     │   │
│  │ 4. ATTACH TIMING BLOCKS to each department:                         │   │
│  │    department_block                                                 │   │
│  │      └── next: planned_timing_block                                 │   │
│  │              └── next: actual_timing_block                          │   │
│  │                      └── next: variance_timing_block                │   │
│  │                                                                     │   │
│  │ 5. Fill in timing fields:                                           │   │
│  │    • Time process days                                              │   │
│  │    • Invite/Advertisement date                                      │   │
│  │    • Bid Opening date                                               │   │
│  │    • Bid Evaluation date                                            │   │
│  │    • Tender Award date                                              │   │
│  │    • Notification of Award date                                     │   │
│  │    • Contract Signing date                                          │   │
│  │    • Total Time for Contract                                        │   │
│  │    • Date of Completion                                             │   │
│  │                                                                     │   │
│  │ 6. REAL-TIME CALCULATIONS (automatic):                              │   │
│  │    • All department totals recalculated                             │   │
│  │    • Grand Total across all departments                             │   │
│  │    • AGPO allocation (30%)                                          │   │
│  │    • PWD allocation (2%)                                            │   │
│  │    • Local Content allocation (40%)                                 │   │
│  │                                                                     │   │
│  │ 7. Export to Excel (Annual Procurement Plan)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Block Nesting Hierarchy

### DU Workspace Structure

```
department_block
├── DEPT_NAME (read-only)
├── VOTE_NUMBER (read-only, hidden when collapsed)
├── BUDGET (read-only, hidden when collapsed)
├── CATEGORIES ──┬── category_block
│                │   ├── CATEGORY_NAME (read-only)
│                │   ├── ITEMS ──┬── item_block
│                │   │           │   ├── ITEM_DESC (read-only)
│                │   │           │   ├── UNIT (read-only, hidden)
│                │   │           │   ├── PRICE (read-only, hidden)
│                │   │           │   ├── METHOD (read-only, hidden)
│                │   │           │   ├── SOURCE (read-only, hidden)
│                │   │           │   ├── Q1_QTY ← EDITABLE
│                │   │           │   ├── Q2_QTY ← EDITABLE
│                │   │           │   ├── Q3_QTY ← EDITABLE
│                │   │           │   ├── Q4_QTY ← EDITABLE
│                │   │           │   ├── ITEM_TOTAL_QTY (auto)
│                │   │           │   └── ITEM_TOTAL_COST (auto)
│                │   │           │
│                │   │           └── item_block (next)
│                │   │               └── ...
│                │   │
│                │   ├── CAT_Q1_TOTAL (auto)
│                │   ├── CAT_Q2_TOTAL (auto)
│                │   ├── CAT_Q3_TOTAL (auto)
│                │   ├── CAT_Q4_TOTAL (auto)
│                │   └── CATEGORY_GRAND_TOTAL (auto)
│                │
│                └── category_block (next)
│                    └── ...
│
└── DEPT_TOTAL (auto)
```

### PO Workspace Structure

```
aggregate_plan_block
├── FINANCIAL_YEAR ← EDITABLE
├── DEPARTMENTS ──┬── department_block
│                 │   ├── [Full department structure as above]
│                 │   └── NEXT ──┬── planned_timing_block
│                 │              │   ├── FIELD1-9 ← EDITABLE
│                 │              │   └── NEXT ── actual_timing_block
│                 │              │               ├── FIELD1-9 ← EDITABLE
│                 │              │               └── NEXT ── variance_timing_block
│                 │              │                           └── FIELD1-9 ← EDITABLE
│                 │              │
│                 │              └── department_block (next, if multiple)
│                 │                  └── [continues...]
│                 │
│                 └── department_block (next)
│                     └── ...
│
├── GRAND_TOTAL (auto)
├── AGPO_CALCULATED (auto: 30%)
├── PWD_CALCULATED (auto: 2%)
└── LOCAL_CONTENT_CALCULATED (auto: 40%)
```

---

## Data Flow Summary

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   PO SETUP       │     │   DU CREATION    │     │ PO CONSOLIDATION │
│                  │     │                  │     │                  │
│ • Departments    │────▶│ • Select items   │────▶│ • Review plans   │
│ • Categories     │     │ • Set quantities │     │ • Add timing     │
│ • Item catalog   │     │ • Submit plan    │     │ • Export Excel   │
│ • Budgets        │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                         │                        │
        │                         │                        │
        ▼                         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ appData.         │     │ ProcurelineDB.   │     │ Excel Export     │
│ categories       │     │ savePlan()       │     │ (Annual Plan)    │
│ appData.         │     │                  │     │                  │
│ departments      │     │ Status:          │     │ Includes:        │
│                  │     │ • submitted      │     │ • All depts      │
│                  │     │ • approved       │     │ • All items      │
│                  │     │ • rejected       │     │ • Timing data    │
│                  │     │                  │     │ • Allocations    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## Field Editability Matrix

| Block Type | Field | DU Can Edit | PO Can Edit |
|------------|-------|-------------|-------------|
| `department_block` | DEPT_NAME | No | Yes (setup) |
| `department_block` | VOTE_NUMBER | No | Yes (setup) |
| `department_block` | BUDGET | No | Yes (setup) |
| `category_block` | CATEGORY_NAME | No | Yes (setup) |
| `item_block` | ITEM_DESC | No | Yes (setup) |
| `item_block` | UNIT_OF_MEASUREMENT | No | Yes (setup) |
| `item_block` | UNIT_PRICE | No | Yes (setup) |
| `item_block` | PROC_METHOD | No | Yes (setup) |
| `item_block` | SOURCE_OF_FUNDS | No | Yes (setup) |
| `item_block` | Q1_QTY | **Yes** | View only |
| `item_block` | Q2_QTY | **Yes** | View only |
| `item_block` | Q3_QTY | **Yes** | View only |
| `item_block` | Q4_QTY | **Yes** | View only |
| `aggregate_plan_block` | FINANCIAL_YEAR | N/A | **Yes** |
| `planned_timing_block` | FIELD1-9 | N/A | **Yes** |
| `actual_timing_block` | FIELD1-9 | N/A | **Yes** |
| `variance_timing_block` | FIELD1-9 | N/A | **Yes** |

---

## Key Design Principles

1. **Separation of Concerns:** PO manages catalog and structure; DU only sets quantities
2. **Budget Control:** Real-time warnings prevent over-budget submissions
3. **Auditability:** Complete Blockly XML serialization preserves full plan history
4. **Compliance:** Auto-calculated AGPO/PWD/Local allocations ensure regulatory compliance
5. **Progressive Disclosure:** Collapsible blocks reduce visual clutter while maintaining access to details
