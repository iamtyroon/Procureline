---
epic: 5
title: "DU Blockly Planning Interface"
status: ready
priority: P0
totalStories: 7
frsConvered: ["FR37a-FR37g", "FR38-FR38g", "FR39-FR48"]
nfrsAddressed: ["NFR-S1", "NFR-S7", "NFR-P1", "NFR-P2", "NFR-P3", "NFR-P4"]
dependencies: ["Epic 1", "Epic 4"]
createdAt: 2026-01-22
---

# Epic 5: DU Blockly Planning Interface

## Epic Goal

Departmental Users can create procurement plans using an intuitive visual Blockly interface with drag-and-drop blocks, real-time calculations, and budget validation.

## User Outcome

DUs (like Michael Otieno from the user journey) can complete their entire procurement plan in under 15 minutes using the visual block interface with zero training required. The system guides them through the process and prevents invalid entries.

## Innovation Context

This epic implements the **core innovation** of Procureline: using Google's Blockly visual programming framework for hierarchical procurement data manipulation. This is what makes Procureline unique in the market.

**The Innovation Triangle:**
1. **Visual Blockly Interface** — Makes hierarchy tangible and manipulable
2. **Real-time Validation** — Prevents errors before they happen
3. **Budget Meters** — Shows exactly where users stand in real-time

## Requirements Covered

### Functional Requirements

**DU Dashboard (8 FRs):**
- FR38: View department budget allocation and remaining balance
- FR38a-FR38g: Dashboard states, deadline countdown, plan status, error states

**Blockly Workspace (20 FRs):**
- FR39-FR39m: Workspace access, validation, sync, recovery
- FR40-FR48: Block operations, quantities, calculations, drafts

**Item & Category Requests - DU Side (7 FRs):**
- FR37a-FR37g: Request new items/categories, view status, receive notifications

### Non-Functional Requirements
- NFR-S1: Complete tenant data isolation
- NFR-S7: All user inputs sanitized
- NFR-P1: Page load time under 2 seconds
- NFR-P2: Blockly workspace responsive under 500ms
- NFR-P3: Support 50+ concurrent users per tenant
- NFR-P4: Handle plans with 15+ categories and 200+ items

## Implementation Notes

- Blockly library loaded lazily to optimize initial page load
- Custom Blockly blocks for: Department, Category, Item with Q1-Q4 fields
- Block colors: Department (#18b969 - Procureline Green), Category (#4a90d9), Item (#f5a623)
- Real-time sync via Convex subscriptions with offline queue
- Local storage backup for crash recovery
- Budget calculations performed client-side for instant feedback

---

## Stories

### Story 5.1: DU Dashboard & Plan Status

As a **Departmental User**,
I want a clear dashboard showing my department's status and budget,
So that I understand my planning context before starting work.

**Acceptance Criteria:**

**Given** a DU logs in successfully
**When** they view the dashboard
**Then** system displays department budget allocation and remaining balance (FR38)
**And** shows budget as both amount and visual progress bar

**Given** a DU views the dashboard
**When** a submission deadline is set
**Then** system displays deadline with countdown timer (FR38a)
**And** countdown shows days/hours/minutes remaining

**Given** a DU views the dashboard
**When** they have a plan in progress
**Then** system displays current plan status: No Plan, Draft, Submitted, Rejected, or Approved (FR38b)
**And** status includes visual badge with appropriate color

**Given** a DU's department has no budget allocated
**When** they view the dashboard
**Then** system displays message: "No budget allocated. Contact your Procurement Officer." (FR38c)
**And** "Create Plan" button is disabled

**Given** a DU logs in after deadline has passed
**When** they view the dashboard
**Then** system displays message: "Submission deadline has passed. Your plan is now read-only." (FR38d)
**And** plan editing is disabled

**Given** a DU's tenant has no categories/items configured
**When** they view the dashboard
**Then** system displays message: "Setup in progress. Your Procurement Officer is preparing the catalog." (FR38e)
**And** "Create Plan" button is disabled

**Given** a DU's plan was rejected
**When** they view the dashboard
**Then** system prominently displays rejection comments from PO (FR38f)
**And** includes "Edit Plan" button to address feedback

**Given** a first-time DU with no plan history
**When** they view the dashboard
**Then** system shows appropriate empty state with guidance (FR38g)
**And** includes "Start Your Plan" CTA with brief instructions

**Technical Notes:**
- Dashboard data from `getDUDashboard` query with tenantId + departmentId filters
- Budget balance calculated from `plans` table if draft exists
- Plan status from `plans.status` field
- Real-time countdown via client-side timer, synchronized with server on load

---

### Story 5.2: Blockly Workspace Core

As a **Departmental User**,
I want to access a visual Blockly workspace,
So that I can build my procurement plan using drag-and-drop blocks.

**Acceptance Criteria:**

**Given** a DU clicks "Create Plan" or "Edit Plan"
**When** the workspace loads
**Then** system displays visual Blockly workspace (FR39)
**And** workspace shows: toolbox (left), canvas (center), budget meter (top)

**Given** a DU drags a category block
**When** they drop it on the workspace
**Then** category block appears on canvas (FR40)
**And** block displays category name with appropriate color

**Given** a DU has a category on the workspace
**When** they drag an item block from toolbox
**Then** item block can be dropped into the category block (FR41)
**And** item shows: name, unit, unit price

**Given** a DU has an item in a category
**When** they enter quantities
**Then** system provides fields for Q1, Q2, Q3, Q4 quantities (FR42)
**And** tab navigation works between fields

**Given** a DU has items with quantities
**When** they want to see details
**Then** system allows expanding and collapsing block details (FR43)
**And** collapsed view shows item name + total only

**Given** quantities are entered
**When** values change
**Then** system shows real-time total calculations instantly (FR44)
**And** item total = unit price × sum of Q1-Q4
**And** category total = sum of item totals

**Given** a DU is building their plan
**When** viewing the interface
**Then** system displays real-time budget meter showing utilization percentage (FR45)
**And** meter color: green (<80%), yellow (80-99%), red (≥100%)

**Given** budget utilization exceeds 100%
**When** the threshold is crossed
**Then** system displays visual warning: red meter, warning banner (FR46)
**And** submit button shows "Over Budget - Cannot Submit"

**Given** a PO needs to create a plan
**When** they access a department's planning interface
**Then** PO can access the same Blockly interface for plan creation and editing (FR48)
**And** PO sees "(Editing as PO)" indicator

**Technical Notes:**
- Blockly initialization with custom block definitions
- Block colors: Category (#4a90d9), Item (#f5a623)
- Budget meter component with smooth animation
- Q1-Q4 stored as JSON: `{q1: number, q2: number, q3: number, q4: number}`
- Calculations performed client-side with Convex validation on save

---

### Story 5.3: Blockly Validation & Constraints

As a **Departmental User**,
I want the system to validate my entries and prevent errors,
So that my plan is always valid and ready for submission.

**Acceptance Criteria:**

**Given** a DU enters a quantity
**When** the value is negative
**Then** system prevents entry and resets to 0 (FR39a)
**And** displays brief error tooltip: "Quantity cannot be negative"

**Given** a DU enters a quantity
**When** the item unit is "each" or similar discrete unit
**Then** system enforces integer-only input (FR39b)
**And** decimal point is blocked in input

**Given** a DU enters a quantity
**When** value exceeds item's maximum quantity limit
**Then** system enforces the limit and displays: "Maximum quantity is [limit]" (FR39c)

**Given** a DU's plan exceeds budget
**When** they attempt to submit
**Then** system blocks submission (not just warns) (FR39d)
**And** displays: "Budget exceeded by [amount]. Reduce quantities to submit."

**Given** a DU drags an item that already exists in a category
**When** they attempt to drop it
**Then** system prevents duplicate and shows: "Item already in this category" (FR39k)

**Given** a PO removes an item from catalog
**When** that item is in a DU's active plan
**Then** system displays toast notification to DU: "[Item name] has been removed from catalog" (FR39m)
**And** item block shows "Removed" warning state

**Technical Notes:**
- Input validation via Blockly field validators
- Max quantity from `items.maxQty` field
- Duplicate detection via block workspace scan
- Catalog change detection via Convex subscription on `items` table
- Toast notifications via react-hot-toast or similar

---

### Story 5.4: Plan Persistence & Recovery

As a **Departmental User**,
I want my plan to be saved automatically and recoverable,
So that I never lose my work even if something goes wrong.

**Acceptance Criteria:**

**Given** a DU makes changes to their plan
**When** changes are made
**Then** system syncs changes in real-time with offline queue support (FR39e)
**And** shows "Saving..." indicator during sync
**And** shows "Saved" when complete

**Given** a DU attempts to leave the page
**When** there are unsaved changes
**Then** system displays warning: "You have unsaved changes. Are you sure you want to leave?" (FR39g)
**And** provides "Stay" and "Leave" options

**Given** a DU's browser crashes or closes unexpectedly
**When** they return to the workspace
**Then** system recovers plan from local browser storage backup (FR39h)
**And** displays: "Recovered unsaved changes. Review and save."

**Given** a DU wants to start over
**When** they click "Start Over" or "Clear Plan"
**Then** system displays confirmation: "Are you sure? This will remove all items from your plan." (FR39j)
**And** upon confirmation, clears the workspace completely

**Given** a DU has made changes
**When** they want to save without submitting
**Then** system allows saving plan as draft for later editing (FR47)
**And** draft is retrievable on next login

**Technical Notes:**
- Real-time sync via Convex mutations with optimistic updates
- Offline queue using IndexedDB or localStorage
- Local backup saved every 30 seconds and on each change
- Recovery on mount checks localStorage timestamp vs. server timestamp
- Draft status in `plans` table with `status: 'draft'`

---

### Story 5.5: Item & Category Requests (DU Side)

As a **Departmental User**,
I want to request new items or categories not in the catalog,
So that I can include everything my department needs in the plan.

**Acceptance Criteria:**

**Given** a DU is building their plan
**When** they need an item not in the catalog
**Then** system provides "Request New Item" option (FR37a)
**And** displays request form

**Given** a DU needs a new category
**When** they can't find an appropriate category
**Then** system provides "Request New Category" option (FR37b)
**And** displays request form

**Given** a DU fills out a request form
**When** submitting the request
**Then** system requires: name, description, estimated price (for items), justification (FR37c, FR37r)
**And** validates all required fields before submission

**Given** a DU has submitted requests
**When** they view their requests
**Then** system displays status: Pending, Approved, or Denied (FR37d)
**And** shows list of all their requests with current status

**Given** a DU's request is processed by PO
**When** the decision is made
**Then** system notifies DU via in-app notification and email (FR37e)
**And** notification includes: decision, item/category name, reason (if denied)

**Given** a DU has a pending item request
**When** they attempt to use that item in their plan
**Then** system prevents usage until PO approves (FR37f)
**And** shows "Pending Approval" indicator on requested items

**Given** submission deadline arrives
**When** DU has pending requests
**Then** system automatically expires pending requests (FR37g)
**And** notifies DU: "Your pending requests have expired"

**Given** a DU fills out an item request
**When** that item already exists in the catalog
**Then** system prevents request: "This item already exists in [Category Name]" (FR37p)

**Given** a DU has a pending request
**When** they submit another request for the same item
**Then** system prevents duplicate: "You already have a pending request for this item" (FR37q)

**Given** a DU has a pending request
**When** before PO reviews it
**Then** DU can cancel the request (FR37s)

**Given** a DU has a pending request
**When** before PO reviews it
**Then** DU can edit the request details (FR37t)

**Technical Notes:**
- Requests stored in `itemRequests` and `categoryRequests` tables
- Request status: 'pending', 'approved', 'denied', 'expired', 'cancelled'
- Email notifications via NestJS microservice
- Expiration via Convex cron job checking deadline
- Duplicate detection via query on DU's pending requests

---

### Story 5.6: Budget Meter & Calculations

As a **Departmental User**,
I want to see exactly how my plan affects my budget in real-time,
So that I can make informed decisions about quantities and priorities.

**Acceptance Criteria:**

**Given** a DU opens the workspace
**When** viewing the budget meter
**Then** system shows: total budget, amount used, amount remaining, percentage used (FR38, FR45)

**Given** quantities change
**When** calculations update
**Then** item total = unit price × (Q1 + Q2 + Q3 + Q4) (FR44)
**And** category total = sum of all item totals in category
**And** plan total = sum of all category totals

**Given** budget utilization reaches 80%
**When** the meter updates
**Then** meter transitions from green to yellow (FR46)
**And** shows advisory: "Approaching budget limit"

**Given** budget utilization reaches 100%
**When** the meter updates
**Then** meter transitions to red with warning banner (FR46)
**And** shows: "Budget exceeded by [amount]"

**Given** a DU removes items or reduces quantities
**When** budget returns below 100%
**Then** meter returns to appropriate color
**And** warning banner is removed

**Given** items have compliance flags (AGPO/PWD/Local)
**When** viewing budget breakdown
**Then** system shows compliance allocation percentages
**And** indicates if targets are met/unmet

**Technical Notes:**
- All calculations performed client-side for instant feedback
- Budget meter uses CSS transitions for smooth color changes
- Compliance calculations: sum of flagged items / total × 100
- Server-side validation duplicates calculations before save

---

### Story 5.7: Blockly Toolbox & Block Management

As a **Departmental User**,
I want an organized toolbox with all available categories and items,
So that I can easily find and add what I need to my plan.

**Acceptance Criteria:**

**Given** a DU opens the workspace
**When** viewing the toolbox
**Then** system displays categories in PO-configured order (FR30d)
**And** each category shows its assigned color/icon

**Given** a DU clicks on a category in the toolbox
**When** the category expands
**Then** system shows all items in that category
**And** items display: name, unit, unit price

**Given** a DU drags a category to the workspace
**When** the category is empty (no items added yet)
**Then** block shows "Drag items here" placeholder

**Given** a DU has multiple categories on the workspace
**When** they want to organize the view
**Then** categories can be reordered via drag-and-drop on canvas

**Given** the workspace has many blocks
**When** it becomes crowded
**Then** DU can zoom in/out and pan the canvas
**And** zoom controls are available in corner

**Given** a DU wants to search for items
**When** they type in the toolbox search
**Then** system filters items across all categories
**And** matching items are highlighted

**Given** a DU removes a category from the workspace
**When** the category contains items
**Then** system confirms: "Remove [Category] and all its items?"
**And** upon confirmation, removes category and all contained items

**Technical Notes:**
- Blockly toolbox configured via JSON definition
- Categories and items loaded from Convex queries
- Toolbox search via client-side filtering
- Zoom controls via Blockly built-in zoom functionality
- Canvas state (zoom, scroll position) persisted in localStorage

---

## Story Dependency Graph

```
Story 5.1 (DU Dashboard)
    │
    └── Story 5.2 (Blockly Workspace Core)
            │
            ├── Story 5.3 (Validation & Constraints)
            │
            ├── Story 5.4 (Persistence & Recovery)
            │
            ├── Story 5.5 (Item Requests)
            │
            ├── Story 5.6 (Budget Meter)
            │
            └── Story 5.7 (Toolbox)
```

## Definition of Done

- [ ] All 7 stories implemented and tested
- [ ] Blockly blocks render correctly with custom styling
- [ ] Real-time calculations verified accurate
- [ ] Offline queue tested with network disconnection
- [ ] Recovery from browser crash tested
- [ ] Performance tested: 15+ categories, 200+ items
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
