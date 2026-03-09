---
epic: 6
title: "Plan Submission & Review"
status: ready
priority: P0
totalStories: 7
frsConvered: ["FR49-FR57f"]
nfrsAddressed: ["NFR-S1", "NFR-S7", "NFR-P1", "NFR-P3"]
dependencies: ["Epic 4", "Epic 5"]
createdAt: 2026-01-22
---

# Epic 6: Plan Submission & Review

## Epic Goal

DUs can submit their completed plans for PO review, and POs can efficiently review, approve, or reject plans with detailed feedback.

## User Outcome

The submission and review process is streamlined: DUs get immediate feedback and clear guidance on revisions, while POs can quickly process submissions with comparison tools and flagging capabilities.

## Requirements Covered

### Functional Requirements

**Plan Submission - DU Side (14 FRs):**
- FR49-FR49e: Submit plan, prevent double-submission, confirmation, withdrawal, locking
- FR50-FR50g: Validation before submission
- FR51: Budget validation blocking

**Plan Review - PO Side (11 FRs):**
- FR52-FR55c: View submissions, approve, reject, flag items, revision requests

**Revision Flow - DU Side (7 FRs):**
- FR56-FR57f: Notifications, view comments, resubmit, unlock requests

### Non-Functional Requirements
- NFR-S1: Complete tenant data isolation
- NFR-S7: All user inputs sanitized
- NFR-P1: Page load time under 2 seconds
- NFR-P3: Support 50+ concurrent users per tenant

## Implementation Notes

- Submission creates immutable snapshot of plan
- Plan status: draft → submitted → (approved | rejected) → (resubmitted) → approved
- PO comments stored separately from plan data
- Diff view compares current vs. previous submission
- All status changes logged in audit trail

---

## Story Delivery Map

- `Story 6.1` achieves the moment a DU turns a draft into a formal submission. Delivery should provide clear submission UX, immutable state transition rules, and confirmation records that the PO queue can trust.
- `Story 6.2` achieves pre-flight enforcement before a plan can be submitted. Delivery should consolidate completeness, budget, and structural validation into one place so invalid plans are stopped before they enter review.
- `Story 6.3` achieves the PO's working queue for incoming plans. Delivery should aggregate submissions by status and urgency, give enough context for prioritization, and support efficient navigation into review.
- `Story 6.4` achieves a usable PO review workspace. Delivery should render submitted plans in a way that preserves hierarchy, highlights issues, and supports review actions without corrupting the original DU submission.
- `Story 6.5` achieves decisive review outcomes. Delivery should encode approval, rejection, and return-for-revision transitions along with required comments, notifications, and audit entries.
- `Story 6.6` achieves the DU correction loop after PO feedback. Delivery should reopen the right plan state, preserve the review context, and help the DU address issues without rebuilding the plan from scratch.
- `Story 6.7` achieves transparent status visibility after submission. Delivery should expose end-to-end status history, timestamps, and next-step messaging so DUs and POs can track progress without manual follow-up.

---

## Stories

### Story 6.1: Plan Submission Flow

As a **Departmental User**,
I want to submit my completed plan for PO review,
So that my department's procurement needs can be included in the consolidated plan.

**Acceptance Criteria:**

**Given** a DU has a complete plan
**When** they click "Submit for Review"
**Then** system initiates submission process (FR49)
**And** displays pre-submission validation summary

**Given** a DU clicks submit
**When** the submission is processing
**Then** system prevents double-submission by disabling button (FR49a)
**And** shows loading indicator

**Given** submission succeeds
**When** the process completes
**Then** system displays confirmation with timestamp and reference number (FR49b)
**And** reference format: [DeptCode]-[FiscalYear]-[Sequence] (e.g., "CS-2526-001")

**Given** a DU has submitted their plan
**When** PO hasn't started review yet
**Then** DU can withdraw the submission (FR49c)
**And** plan returns to draft status
**And** withdraw option disappears once PO opens plan

**Given** submission succeeds
**When** confirmation is displayed
**Then** system sends confirmation email to DU (FR49d)
**And** email includes: reference number, submission time, next steps

**Given** a plan is submitted
**When** the submission is processed
**Then** system locks plan from editing (read-only) (FR49e)
**And** DU sees "Submitted - Awaiting Review" status
**And** edit button is disabled

**Technical Notes:**
- Submission creates new entry in `planSubmissions` table with snapshot
- Reference number generated via sequence counter per department
- Withdrawal allowed while `reviewStartedAt` is null
- Lock enforced via `status: 'submitted'` check in edit mutation

---

### Story 6.2: Pre-Submission Validation

As a **Departmental User**,
I want the system to validate my plan before submission,
So that I know my plan is complete and valid before PO reviews it.

**Acceptance Criteria:**

**Given** a DU attempts to submit
**When** the plan has validation issues
**Then** system validates plan completeness (FR50)
**And** displays all issues before allowing submission

**Given** a DU submits an empty plan
**When** validation runs
**Then** system prevents submission: "Plan must have at least 1 item" (FR50a)

**Given** a DU has items with all zero quantities
**When** validation runs
**Then** system prevents submission: "[Item name] has zero quantity. Enter quantity or remove item." (FR50b)

**Given** a DU has pending item/category requests
**When** validation runs
**Then** system prevents submission: "You have [X] pending requests. Cancel or wait for PO decision." (FR50c)

**Given** validation finds multiple issues
**When** displaying errors
**Then** system shows itemized list with links to fix each issue (FR50d)
**And** clicking link scrolls to and highlights the problem area

**Given** a DU attempts to submit after deadline
**When** validation runs
**Then** system prevents submission: "Submission deadline has passed. Contact your PO." (FR50e)

**Given** validation passes
**When** DU is ready to submit
**Then** system displays validation summary with plan overview (FR50g)
**And** shows: total items, total amount, budget utilization %
**And** requires "Confirm" click to final submit

**Given** a DU's plan exceeds budget
**When** they attempt to submit
**Then** system prevents submission: "Budget exceeded by [amount]. Reduce items to submit." (FR51)

**Technical Notes:**
- Validation runs as Convex function checking all rules
- Validation results cached during session
- Link-to-fix uses element IDs for scroll targeting
- Deadline check compares current time vs. `fiscalYears.submissionDeadline`

---

### Story 6.3: PO Submission Queue

As a **Procurement Officer**,
I want to view all submitted plans in a queue,
So that I can efficiently process department submissions.

**Acceptance Criteria:**

**Given** a PO navigates to Submissions
**When** there are submitted plans
**Then** system displays list of all submitted plans with status (FR52)
**And** shows: department name, submission date, status, total amount

**Given** a PO views the queue
**When** filtering options are available
**Then** system allows filtering by: status (Submitted/Approved/Rejected), date range, department

**Given** a PO views the queue
**When** plans exist
**Then** system sorts by submission date (oldest first) by default
**And** allows sorting by: department name, amount, status

**Given** no plans are submitted yet
**When** PO views the queue
**Then** system displays empty state: "No submitted plans yet. Check back after departments submit."

**Given** plans are submitted in real-time
**When** a new submission arrives
**Then** queue updates automatically via Convex subscription
**And** shows notification: "New submission from [Department]"

**Technical Notes:**
- Queue from `planSubmissions` table with `tenantId` filter
- Real-time updates via Convex subscription
- Status filter via query parameter
- Sort state stored in URL for shareability

---

### Story 6.4: Plan Review Interface

As a **Procurement Officer**,
I want to review submitted plan details with comparison tools,
So that I can make informed approval or rejection decisions.

**Acceptance Criteria:**

**Given** a PO selects a submitted plan
**When** they open it for review
**Then** system displays plan details in read-only mode (FR53)
**And** shows: all categories, items, quantities, totals
**And** marks `reviewStartedAt` timestamp (prevents DU withdrawal)

**Given** a PO reviews a resubmitted plan
**When** previous submission exists
**Then** system provides diff view comparing current vs. previous (FR53a)
**And** highlights: added items (green), removed items (red), changed quantities (yellow)

**Given** a PO reviews a plan
**When** previous fiscal year data exists
**Then** system allows comparing with previous fiscal year (FR53b)
**And** shows year-over-year changes

**Given** a PO reviews a plan
**When** they want to make notes
**Then** system allows adding internal comments not visible to DU (FR53c)
**And** comments are saved and visible to other POs

**Given** a PO is reviewing
**When** they identify specific items needing attention
**Then** they can click on items to select them for flagging

**Technical Notes:**
- Read-only view uses same Blockly renderer without edit capability
- Diff calculation compares `planSubmissions` snapshots
- Internal comments in `planReviewComments` table with `isInternal: true`
- Previous year lookup via `fiscalYearId` relationship

---

### Story 6.5: Plan Approval & Rejection

As a **Procurement Officer**,
I want to approve or reject plans with detailed feedback,
So that departments know their status and how to fix issues.

**Acceptance Criteria:**

**Given** a PO reviews a satisfactory plan
**When** they click "Approve"
**Then** system marks plan as approved (FR54)
**And** plan becomes available for consolidation
**And** DU is notified

**Given** a PO approves a plan
**When** within 24 hours and plan isn't consolidated
**Then** PO can undo approval (FR54a)
**And** plan returns to submitted status

**Given** a PO identifies issues with a plan
**When** they click "Reject"
**Then** system requires revision comments (FR55)
**And** comment is sent to DU

**Given** a PO rejects a plan
**When** identifying specific problem items
**Then** PO can flag specific items for revision (FR55a)
**And** flagged items are highlighted for DU

**Given** a PO wants minor changes
**When** full rejection isn't warranted
**Then** PO can request revision without full rejection (FR55b)
**And** plan status shows "Revision Requested"

**Given** a PO rejects a plan
**When** setting expectations
**Then** PO can set revision deadline (FR55c)
**And** deadline is communicated to DU

**Given** a plan is approved or rejected
**When** the decision is made
**Then** DU receives notification via email and in-app (FR56)
**And** notification includes: decision, comments, deadline (if applicable)

**Technical Notes:**
- Approval updates `plans.status` to 'approved' and `approvedAt` timestamp
- Undo approval allowed while `consolidatedAt` is null
- Rejection creates entry in `planRevisionRequests` with comments
- Flagged items stored as array of item IDs in revision request
- Revision deadline stored in `planRevisionRequests.deadlineAt`

---

### Story 6.6: DU Revision Flow

As a **Departmental User**,
I want to see rejection feedback and resubmit my corrected plan,
So that I can address PO concerns and get my plan approved.

**Acceptance Criteria:**

**Given** a DU's plan was rejected
**When** they view their plan
**Then** system displays rejection comments prominently (FR57a)
**And** comments appear in highlighted banner at top

**Given** a DU views a rejected plan
**When** specific items were flagged
**Then** system highlights those items/categories (FR57b)
**And** flagged items have red border/indicator

**Given** a DU views their plan history
**When** multiple submissions exist
**Then** system shows submission history with timestamps and statuses (FR57c)
**And** allows viewing previous submission details

**Given** a DU addresses rejection feedback
**When** they want to resubmit
**Then** system allows resubmission until deadline (no limit) (FR57d)
**And** each resubmission gets new reference number

**Given** a DU receives rejection within 24 hours of deadline
**When** viewing their plan
**Then** system extends revision period automatically (FR57e)
**And** displays: "Revision period extended to [new deadline]"

**Given** a DU's plan is approved but has errors
**When** they discover the issue
**Then** DU can request plan unlock from PO (FR57f)
**And** request includes reason for unlock

**Given** a DU receives notification
**When** their plan is approved or rejected
**Then** they view comments and can take appropriate action (FR57)
**And** approved plans show celebration state

**Technical Notes:**
- Rejection comments from `planRevisionRequests` table
- Flagged items rendered with CSS highlight class
- Submission history from `planSubmissions` with `departmentId` filter
- Extension logic: if rejection time + 24h > deadline, extend to rejection time + 48h
- Unlock request creates entry in `planUnlockRequests` table

---

### Story 6.7: Submission Status Tracking

As a **Departmental User**,
I want to track my submission status in real-time,
So that I know where my plan is in the review process.

**Acceptance Criteria:**

**Given** a DU has submitted a plan
**When** they view their dashboard
**Then** system shows current status: Submitted, Under Review, Approved, or Rejected

**Given** a PO opens a plan for review
**When** the DU checks status
**Then** status updates to "Under Review"
**And** shows: "Being reviewed by [PO name]"

**Given** status changes
**When** DU is on the dashboard
**Then** status updates in real-time via Convex subscription

**Given** a plan is approved
**When** DU views their dashboard
**Then** system shows celebration state with "Plan Approved!" message
**And** displays approval date and any PO comments

**Given** a plan timeline
**When** DU wants to see history
**Then** system shows timeline: Draft → Submitted → Under Review → Approved/Rejected

**Technical Notes:**
- Status from `plans.status` and `reviewStartedAt` fields
- Real-time updates via Convex subscription on plans table
- Timeline component renders status history from `planStatusHistory`
- Celebration state triggers confetti animation (optional)

---

## Story Dependency Graph

```
Story 6.1 (Submission Flow)
    │
    ├── Story 6.2 (Pre-Submission Validation)
    │
    └── Story 6.3 (PO Queue) ────── Story 6.4 (Review Interface)
                                        │
                                        └── Story 6.5 (Approve/Reject)
                                                │
                                                └── Story 6.6 (DU Revision)

Story 6.7 (Status Tracking) ── Parallel to all stories
```

## Definition of Done

- [ ] All 7 stories implemented and tested
- [ ] Submission workflow tested end-to-end
- [ ] Diff view correctly highlights changes
- [ ] Notifications delivered via email and in-app
- [ ] Revision deadline enforcement tested
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
