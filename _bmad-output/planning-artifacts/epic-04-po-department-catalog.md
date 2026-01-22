---
epic: 4
title: "PO Department & Catalog Management (THE PREP PHASE)"
status: ready
priority: P0
totalStories: 10
frsConvered: ["FR23-FR29f", "FR-DL1-FR-DL6", "FR30-FR37", "FR37-CS", "FR37-CF", "FR37-CE", "FR37h-FR37z"]
nfrsAddressed: ["NFR-S1", "NFR-S7", "NFR-P1", "NFR-P2", "NFR-P3"]
dependencies: ["Epic 1", "Epic 2", "Epic 3"]
createdAt: 2026-01-22
---

# Epic 4: PO Department & Catalog Management (THE PREP PHASE)

## Epic Goal

Procurement Officers can fully set up their institution's procurement infrastructure including departments, categories, items, access codes, and deadlines before the fiscal year begins.

## User Outcome

POs (like Sarah Mwangi from the user journey) can complete all preparation work in approximately 1 month before the fiscal year starts, enabling DUs to submit valid plans. This is the critical PREP PHASE that must be completed before Department Submission can begin.

## Annual Cycle Context

**Phase 1: PO Preparation (1 month before fiscal year start - June)**
| Task | Description | Estimated Time |
|------|-------------|----------------|
| Create Departments | Set up all organizational departments with codes and budget allocations | 2-4 hours |
| Define Categories | Create procurement categories relevant to the institution | 2-4 hours |
| Populate Item Catalog | Add all procurement items to categories with descriptions, units, and unit prices | 1-2 weeks |
| Generate Access Codes | Create and distribute DU access codes | 1 hour |
| Set Submission Deadline | Configure the deadline for department plan submissions | 10 minutes |

**Critical Requirement:** The PO preparation phase MUST be completed before the fiscal year begins. DUs cannot create valid plans without a fully populated item catalog.

## Requirements Covered

### Functional Requirements

**Department Management (42 FRs):**
- FR23-FR23e: Create departments with validation
- FR24-FR24b: Edit departments with notifications
- FR25-FR25c: Delete departments with safeguards
- FR26, FR26b-FR26i: Access code generation and management
- FR27-FR27b: Budget allocation and bulk import
- FR28-FR28i: PO Dashboard
- FR29-FR29f: Submission monitoring

**Deadline Management (6 FRs):**
- FR-DL1 through FR-DL6: Submission deadline configuration

**Category & Item Catalog (29 FRs):**
- FR30-FR32c: Category management
- FR33-FR36: Item catalog management
- FR37, FR37-CS, FR37-CF, FR37-CE: Catalog view and export

**Item Request Processing - PO Side (19 FRs):**
- FR37h-FR37z: PO review and approval of item/category requests

### Non-Functional Requirements
- NFR-S1: Complete tenant data isolation
- NFR-S7: All user inputs sanitized against SQL injection and XSS
- NFR-P1: Page load time under 2 seconds
- NFR-P2: Blockly workspace responsive under 500ms
- NFR-P3: Support 50+ concurrent users per tenant

## Implementation Notes

- All catalog operations must maintain audit trail
- Access codes use format: [FiscalYear]-[DeptInitials]-[RandomChars]
- Item price changes notify active DU sessions via Convex subscriptions
- Excel import/export via NestJS microservice using ExcelJS
- Dashboard uses real-time Convex subscriptions for live updates

---

## Stories

### Story 4.1: PO Dashboard & Onboarding Wizard

As a **Procurement Officer**,
I want a comprehensive dashboard with onboarding guidance,
So that I can monitor my setup progress and quickly access key functions.

**Acceptance Criteria:**

**Given** a first-time PO logs in
**When** no departments/categories/items have been created
**Then** system displays onboarding wizard with setup checklist (FR28a)
**And** checklist shows: Create Departments, Add Categories, Add Items, Generate Access Codes, Set Deadline

**Given** a PO views the dashboard
**When** fiscal year is not configured
**Then** system displays warning: "Fiscal year not configured. Contact your Tenant Admin." (FR28b)

**Given** a PO views the dashboard
**When** submission deadline is not set
**Then** system displays warning: "Submission deadline not set. Configure before DUs can submit." (FR28c)

**Given** a PO views the dashboard
**When** no departments exist
**Then** system displays empty state with "Create your first department" CTA (FR28d)

**Given** a PO views the dashboard
**When** all departments have submitted valid plans
**Then** system displays success state: "All departments submitted!" with progress summary (FR28e)

**Given** a PO views the dashboard
**When** some departments are past deadline without submission
**Then** system highlights overdue departments with red visual indicators (FR28f)

**Given** a PO views the dashboard
**When** pending item/category requests exist
**Then** system displays notification badge with count (FR28g)
**And** clicking badge navigates to request review screen

**Given** a PO has historical data
**When** they want to view previous cycles
**Then** system allows switching between current and previous fiscal years (FR28h)

**Given** a PO views the dashboard
**When** data changes (DU submissions, item requests)
**Then** dashboard refreshes in real-time via Convex subscriptions (FR28i)

**Technical Notes:**
- Create `getPODashboard` query aggregating departments, submissions, requests
- Onboarding wizard state tracked via `poOnboardingProgress` field
- Real-time updates via Convex subscriptions
- Fiscal year dropdown populates from `fiscalYears` table

---

### Story 4.2: Department CRUD Operations

As a **Procurement Officer**,
I want to create, edit, and manage departments,
So that I can set up the organizational structure for procurement planning.

**Acceptance Criteria:**

**Given** a PO accesses the Departments section
**When** they click "Create Department"
**Then** system displays form for: name, code, budget allocation (FR23)
**And** all fields are required

**Given** a PO creates a department
**When** the code already exists in the tenant
**Then** system prevents creation with "Department code already exists" error (FR23a)

**Given** a PO creates a department
**When** the name already exists in the tenant
**Then** system prevents creation with "Department name already exists" error (FR23b)

**Given** a PO enters budget allocation
**When** value is zero or negative
**Then** system validates and displays "Budget must be a positive number" (FR23c)

**Given** a PO creates a department
**When** total department budgets exceed institution allocation
**Then** system displays warning (not blocking): "Total department budgets exceed institution allocation by [amount]" (FR23d)

**Given** a PO enters a department code
**When** code contains invalid characters or exceeds length
**Then** system validates: alphanumeric only, max 10 characters (FR23e)

**Given** a PO edits an existing department
**When** the department has active plans (draft or submitted)
**Then** system displays warning: "This department has active plans. Changes may affect DU." (FR24a)

**Given** a PO changes department budget
**When** the change is saved and DU is logged in
**Then** system sends in-app notification to affected DU (FR24b)

**Given** a PO wants to delete a department
**When** they click delete
**Then** system requires confirmation dialog with department name (FR25)

**Given** a PO attempts to delete a department
**When** department has submitted or approved plans
**Then** system prevents deletion: "Cannot delete department with submitted plans" (FR25a)

**Given** a PO attempts to delete a department
**When** DU accounts are active for that department
**Then** system requires deactivating DUs first (FR25b)
**And** displays list of affected DU emails

**Given** a department is deleted
**When** deletion is processed
**Then** system archives department data for audit trail (FR25c)
**And** data is soft-deleted, not permanently removed

**Technical Notes:**
- Departments stored in `departments` table with `tenantId`, `code`, `name`, `budget`, `isActive`
- Soft delete via `deletedAt` timestamp
- Budget change notifications via Convex subscriptions to active DU sessions
- Department code index for uniqueness validation

---

### Story 4.3: Access Code Generation & Management

As a **Procurement Officer**,
I want to generate and manage access codes for Departmental Users,
So that DUs can securely access their department's planning interface.

**Acceptance Criteria:**

**Given** a PO views a department
**When** they click "Generate Access Code"
**Then** system generates code in format: [FiscalYear]-[DeptInitials]-[RandomChars] (e.g., "2526-CS-A3X9") (FR26, FR26h)

**Given** a department already has an access code
**When** PO regenerates the code
**Then** system invalidates previous code immediately (FR26b)
**And** displays warning: "Previous code will be invalidated"

**Given** a PO generates an access code
**When** they set the expiration
**Then** system allows custom expiration date selection (FR26c)
**And** default expiration is end of submission period

**Given** a PO has multiple departments without codes
**When** they click "Bulk Generate Codes"
**Then** system generates codes for all departments at once (FR26d)
**And** displays summary of generated codes

**Given** a PO generates an access code
**When** they want to send to DU
**Then** system allows sending code via email directly (FR26e)
**And** email includes: code, department name, expiration date, login URL

**Given** a PO wants to monitor code usage
**When** they view access code details
**Then** system shows login history: date/time, IP address, success/failure (FR26f)

**Given** a PO wants to disable access
**When** they manually deactivate a code
**Then** system immediately prevents logins with that code (FR26g)
**And** displays "Code deactivated" confirmation

**Given** a PO generates or views an access code
**When** they click the copy button
**Then** system copies code to clipboard (FR26i)
**And** shows "Copied!" feedback

**Technical Notes:**
- Access codes stored in `accessCodes` table with `departmentId`, `code`, `expiresAt`, `isActive`
- Code format: [FY last 2 digits of start + end years]-[Dept code first 2 chars uppercase]-[4 random alphanumeric]
- Login history in `accessCodeLogins` table
- Email sending via Resend through NestJS microservice

---

### Story 4.4: Budget Allocation & Department Import

As a **Procurement Officer**,
I want to allocate budgets and bulk import departments,
So that I can quickly set up large organizational structures.

**Acceptance Criteria:**

**Given** a PO views department list
**When** they update budget allocation for a department
**Then** system saves the new budget (FR27)
**And** updates any budget utilization calculations

**Given** a PO wants to import departments
**When** they click "Import from Excel"
**Then** system provides downloadable Excel template (FR27a)
**And** template includes columns: Department Name, Code, Budget

**Given** a PO uploads a completed Excel file
**When** the file is processed
**Then** system validates each row independently
**And** displays row-level errors for invalid entries
**And** successfully imports valid rows
**And** shows import summary: X created, Y failed

**Given** a PO views the department list
**When** they want to reorder departments
**Then** system allows drag-and-drop reordering (FR27b)
**And** new order is persisted and reflected in DU interfaces

**Given** a PO views all departments
**When** accessing the list view
**Then** system displays departments in configured order (FR28)
**And** shows: name, code, budget, submission status, DU email, last activity

**Technical Notes:**
- Excel import via NestJS microservice with ExcelJS
- Department order stored as `displayOrder` integer field
- Import validation includes: required fields, uniqueness checks, format validation
- Template download as static file from NestJS service

---

### Story 4.5: Submission Deadline Management

As a **Procurement Officer**,
I want to set and manage submission deadlines,
So that DUs know when their plans are due and the system can enforce timelines.

**Acceptance Criteria:**

**Given** a PO accesses deadline settings
**When** they set a submission deadline
**Then** system accepts date and time input (FR-DL1)
**And** displays deadline in 24-hour format

**Given** a PO sets a deadline
**When** the date/time is in the past
**Then** system prevents setting with "Deadline cannot be in the past" error (FR-DL2)

**Given** a deadline is set
**When** the PO needs to extend it
**Then** system allows extending the deadline (FR-DL3)
**And** sends notification to all DUs about the extension

**Given** a PO configures deadline
**When** they set reminder preferences
**Then** system allows configuring reminders: 7 days, 3 days, 1 day before deadline (FR-DL4)
**And** reminders are sent via email and in-app notification

**Given** a tenant has configured timezone
**When** deadline is set and displayed
**Then** system handles all times in tenant's configured timezone (FR-DL5)

**Given** a deadline is set
**When** viewing PO or DU dashboards
**Then** system displays countdown timer showing days/hours remaining (FR-DL6)

**Technical Notes:**
- Deadline stored in `fiscalYears` table with `submissionDeadline` timestamp
- Reminders via Convex cron jobs checking approaching deadlines
- Timezone handling via date-fns-tz library
- Countdown calculated client-side with real-time updates

---

### Story 4.6: Submission Monitoring & Reminders

As a **Procurement Officer**,
I want to monitor department submission progress and send reminders,
So that I can ensure all departments submit their plans on time.

**Acceptance Criteria:**

**Given** a PO views submission monitoring
**When** they access the submission status view
**Then** system displays all departments with individual status (FR29)
**And** shows progress bar: X of Y departments submitted

**Given** a PO views submissions
**When** filtering by status
**Then** system shows status breakdown: Not Started, Draft, Submitted, Rejected, Approved (FR29a)
**And** allows filtering by each status (FR29b)

**Given** a PO identifies a lagging department
**When** they want to send a reminder
**Then** system allows sending reminder to individual department (FR29c)
**And** reminder email includes: department name, deadline, login URL

**Given** multiple departments haven't submitted
**When** PO clicks "Send Bulk Reminder"
**Then** system sends reminders to all pending departments at once (FR29d)
**And** shows confirmation: "Reminders sent to X departments"

**Given** a PO views a specific department
**When** they access submission history
**Then** system shows timeline: when each status changed, with timestamps (FR29e)

**Given** a PO needs to report on status
**When** they click "Export Status Report"
**Then** system generates Excel with: department, status, last updated, DU contact (FR29f)

**Technical Notes:**
- Submission status derived from `plans` table status field
- Email reminders via Resend through NestJS
- Status history in `planStatusHistory` table
- Export via NestJS microservice

---

### Story 4.7: Category Management

As a **Procurement Officer**,
I want to create and manage procurement categories,
So that items can be organized logically for DU planning.

**Acceptance Criteria:**

**Given** a PO accesses Category Management
**When** they create a new category
**Then** system accepts: name (required), description (optional) (FR30)

**Given** a PO creates a category
**When** the name already exists in the tenant
**Then** system prevents creation with "Category name already exists" error (FR30a)

**Given** a PO creates or edits a category
**When** they configure visual settings
**Then** system allows assigning color and icon for Blockly visual distinction (FR30b)
**And** preview shows how category will appear in Blockly toolbox

**Given** a PO wants to import categories
**When** they upload an Excel file
**Then** system bulk imports categories with validation (FR30c)
**And** template includes: Name, Description, Color (hex code)

**Given** a PO views the category list
**When** they want to control order in Blockly
**Then** system allows reordering categories (FR30d)
**And** order is reflected in DU Blockly toolbox

**Given** a PO edits a category
**When** the category is used in active plans
**Then** system displays warning about active plan impact (FR31a)

**Given** a PO wants to delete a category
**When** items are assigned to it
**Then** system prevents deletion: "Cannot delete category with assigned items. Reassign or delete items first." (FR32a)

**Given** a PO wants to delete a category
**When** it's used in submitted/approved plans
**Then** system prevents deletion: "Cannot delete category used in active plans" (FR32b)

**Given** a PO wants to hide a category without deleting
**When** they archive the category
**Then** system hides it from new plans but keeps it visible in existing plans (FR32c)
**And** displays "Archived" badge on category

**Technical Notes:**
- Categories stored in `categories` table with `tenantId`, `name`, `description`, `color`, `icon`, `displayOrder`, `isArchived`
- Color as hex string, icon as emoji or icon name
- Archive flag filters categories from toolbox query while keeping for existing plans

---

### Story 4.8: Item Catalog Management

As a **Procurement Officer**,
I want to create and manage procurement items with detailed specifications,
So that DUs have a complete catalog to build their plans from.

**Acceptance Criteria:**

**Given** a PO accesses Item Catalog
**When** they create a new item
**Then** system accepts: description (required), unit (required), unit price (required), category (required) (FR33)

**Given** a PO creates an item
**When** an item with same name exists in the same category
**Then** system prevents creation: "Item already exists in this category" (FR33a)

**Given** a PO enters a unit price
**When** value is zero or negative
**Then** system validates: "Unit price must be a positive number" (FR33b)

**Given** a PO creates an item
**When** selecting unit type
**Then** system provides options: each, box, kg, liter, ream, set, pair, or custom (FR33c)

**Given** a PO configures item constraints
**When** setting quantity limits
**Then** system allows setting minimum and maximum quantity per item (FR33d)

**Given** a PO creates or edits an item
**When** configuring compliance
**Then** system allows flagging as: AGPO eligible, PWD eligible, Local Content eligible (FR33e)
**And** multiple flags can be selected

**Given** a PO wants to bulk add items
**When** they upload Excel file
**Then** system bulk imports with template: Name, Category, Unit, Price, Min Qty, Max Qty, AGPO, PWD, Local (FR33f)

**Given** a PO edits an item price
**When** DU sessions are active with that item in their plan
**Then** system sends toast notification to affected DUs (FR34a)
**And** DU sees updated price in their workspace

**Given** item prices change
**When** changes are saved
**Then** system maintains price history with: previous price, new price, change date, changed by (FR34b)

**Given** a PO wants to reorganize items
**When** they move an item to a different category
**Then** system updates the category assignment (FR35a)
**And** item appears in new category immediately

**Given** a PO creates an item
**When** no category is selected
**Then** system prevents creation: "Category is required" (FR35b)

**Given** a PO configures an item
**When** setting procurement method
**Then** system allows setting default method: Open Tender, Restricted Tender, Direct, Quotation, etc. (FR36)

**Technical Notes:**
- Items stored in `items` table with `categoryId`, `description`, `unit`, `unitPrice`, `minQty`, `maxQty`, `complianceFlags`, `procurementMethod`
- Price history in `itemPriceHistory` table
- Compliance flags as JSON array: ["agpo", "pwd", "local"]
- Item move = update `categoryId` field

---

### Story 4.9: Catalog Search & Export

As a **Procurement Officer**,
I want to search, filter, and export the item catalog,
So that I can quickly find items and share the catalog externally.

**Acceptance Criteria:**

**Given** a PO views the item catalog
**When** there are many items
**Then** system displays complete catalog with pagination (FR37)

**Given** a PO needs to find an item
**When** they use the search box
**Then** system searches by: item name, description, or category name (FR37-CS)
**And** results update as they type (debounced)

**Given** a PO wants to narrow results
**When** they apply filters
**Then** system filters by: category (multi-select), price range (min-max), compliance flags (AGPO/PWD/Local) (FR37-CF)
**And** filters can be combined

**Given** a PO needs to export the catalog
**When** they click "Export to Excel"
**Then** system generates Excel file with all items and current filters applied (FR37-CE)
**And** export includes: Item Name, Category, Description, Unit, Price, Qty Limits, Compliance Flags

**Technical Notes:**
- Search via Convex full-text search index on items
- Filters as query parameters for shareable URLs
- Export via NestJS microservice using ExcelJS
- Pagination: 50 items per page default

---

### Story 4.10: Item & Category Request Processing

As a **Procurement Officer**,
I want to review and process item/category requests from Departmental Users,
So that the catalog can be extended based on departmental needs.

**Acceptance Criteria:**

**Given** DUs have submitted item/category requests
**When** PO accesses the request dashboard
**Then** system displays dedicated view of all pending requests (FR37h)
**And** shows: request type, requester (department), item/category name, description, estimated price

**Given** new requests are submitted
**When** PO is logged in
**Then** system displays inline notification for new requests (FR37i)
**And** notification badge updates in real-time

**Given** PO reviews an item request
**When** they approve it
**Then** system adds item to catalog immediately (FR37j)
**And** notifies requesting DU: "Your item request '[name]' has been approved"

**Given** PO reviews an item request
**When** they want to modify before approving
**Then** system allows editing: name, description, price, category assignment (FR37k)

**Given** PO reviews an item request
**When** they deny it
**Then** system requires entering a denial reason (FR37l)
**And** notifies DU with the reason

**Given** PO reviews a category request
**When** they approve it
**Then** system adds category to catalog (FR37m)
**And** notifies requesting DU

**Given** PO reviews a category request
**When** they deny it
**Then** system requires entering a denial reason (FR37n)
**And** notifies DU with the reason

**Given** PO approves or denies a request
**When** decision is saved
**Then** system notifies DU immediately via in-app and email (FR37o)

**Given** multiple similar requests exist from different DUs
**When** PO views the dashboard
**Then** system consolidates duplicate requests and shows: "3 departments requested this" (FR37u)

**Given** PO has multiple requests to process
**When** they select multiple requests
**Then** system allows bulk approve with single click (FR37v)

**Given** PO has multiple requests to deny
**When** they select multiple and click deny
**Then** system allows bulk deny with single shared reason (FR37w)

**Given** PO wants to review past decisions
**When** they access request history
**Then** system shows all processed requests with: decision, date, reason (if denied) (FR37x)

**Given** PO views the request list
**When** there are many requests
**Then** system allows filtering by: department, status (pending/approved/denied), date range (FR37y)

**Given** PO denies a request
**When** within 5 minutes and DU hasn't been notified yet
**Then** system allows undoing the denial (FR37z)

**Technical Notes:**
- Requests in `itemRequests` and `categoryRequests` tables
- Status: pending, approved, denied
- Consolidation query groups by item name with LOWER normalization
- Bulk operations via Convex batch mutations
- Undo window tracked via `processedAt` timestamp + notification queue delay

---

## Story Dependency Graph

```
Story 4.1 (Dashboard)
    │
    ├── Story 4.2 (Department CRUD) ────┐
    │                                    │
    ├── Story 4.3 (Access Codes) ────────┤
    │                                    │
    ├── Story 4.4 (Budget & Import) ─────┤── Story 4.6 (Submission Monitoring)
    │                                    │
    └── Story 4.5 (Deadline Management) ─┘

Story 4.7 (Categories)
    │
    └── Story 4.8 (Items) ────── Story 4.9 (Search & Export)

Story 4.10 (Request Processing) ── Requires Categories & Items
```

## Definition of Done

- [ ] All 10 stories implemented and tested
- [ ] Unit tests for all Convex functions
- [ ] Integration tests for Excel import/export
- [ ] Access code generation tested for uniqueness
- [ ] Real-time subscriptions verified
- [ ] Bulk operations tested with 100+ items
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
