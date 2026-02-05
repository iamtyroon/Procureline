---
epic: 10
title: "Audit Trail & Compliance"
status: ready
priority: P1
totalStories: 3
frsConvered: ["FR85-FR89"]
nfrsAddressed: ["NFR-S1", "NFR-S9"]
dependencies: ["Epic 1", "Epic 2"]
createdAt: 2026-01-22
---

# Epic 10: Audit Trail & Compliance

## Epic Goal

The platform maintains complete, immutable audit trails for all user actions and supports compliance review requirements.

## User Outcome

Organizations have full visibility into all platform activities for internal governance and external audit requirements. Every action is logged, traceable, and exportable.

## Requirements Covered

### Functional Requirements

**Audit & Compliance (5 FRs):**
- FR85: Log all user actions with timestamp and user details
- FR86: Maintain immutable audit trail
- FR87: PO can view audit logs for procurement activities
- FR88: Tenant Admin can generate audit reports
- FR89: Track plan version history with before/after states

### Non-Functional Requirements
- NFR-S1: Complete tenant data isolation
- NFR-S9: Immutable audit logs — append-only with no deletion

## Implementation Notes

- Audit logs in append-only `auditLogs` table
- No delete mutations for audit logs
- Logs include: actor, action, target, before/after state, timestamp, IP address
- Version history for plans stored as JSON snapshots
- Export capability for compliance reviews

---

## Stories

### Story 10.1: Comprehensive Action Logging

As a **system administrator**,
I want all user actions logged with full context,
So that there is a complete record of platform activity for audit purposes.

**Acceptance Criteria:**

**Given** any user performs an action
**When** the action is executed
**Then** system logs the action with timestamp and user details (FR85)
**And** log includes: userId, action type, target entity, timestamp, IP address

**Given** an action modifies data
**When** the change is made
**Then** log includes before and after states (FR89)
**And** states stored as JSON for full traceability

**Given** audit logs are created
**When** anyone attempts to delete or modify them
**Then** system prevents deletion or modification (FR86)
**And** logs are append-only

**Given** a user action fails
**When** error occurs
**Then** system logs the failed attempt
**And** includes error reason in log

**Given** the audit log
**When** viewing log entries
**Then** each entry contains:
- Actor (user ID, role, email)
- Action (create, read, update, delete, login, logout, submit, approve, reject)
- Target (entity type, entity ID)
- Context (tenant ID, department ID if applicable)
- Timestamp (server time in UTC)
- Client info (IP address, user agent)

**Technical Notes:**
- `auditLogs` table with no delete mutation defined
- Logging via wrapper function on all mutations
- Before/after snapshots for update operations
- IP address from request headers
- Log retention: indefinite (configurable per tenant for export)

---

### Story 10.2: Audit Log Viewing

As a **Procurement Officer**,
I want to view audit logs for my procurement activities,
So that I can track changes and investigate issues.

**Acceptance Criteria:**

**Given** a PO navigates to Audit Logs
**When** they view the log
**Then** system displays logs filtered to their activities (FR87)
**And** shows only their tenant's data

**Given** a PO views audit logs
**When** filtering options are available
**Then** system allows filtering by: date range, action type, entity type

**Given** a PO views audit logs
**When** searching for specific events
**Then** system allows searching by entity ID or actor

**Given** a PO views a log entry
**When** clicking for details
**Then** system shows full context including before/after states

**Given** plan changes are logged
**When** viewing plan history
**Then** PO can see version history with all changes (FR89)
**And** can compare any two versions

**Given** a log entry involves sensitive data
**When** displaying the entry
**Then** system masks sensitive fields (passwords, tokens)

**Technical Notes:**
- PO view filtered by `tenantId` from auth context
- Additional filter by actions relevant to PO role
- Version comparison via JSON diff library
- Sensitive field masking via field configuration

---

### Story 10.3: Audit Report Generation

As a **Tenant Admin**,
I want to generate audit reports for compliance reviews,
So that I can satisfy internal and external audit requirements.

**Acceptance Criteria:**

**Given** a Tenant Admin navigates to Reports
**When** they select Audit Report
**Then** system allows generating comprehensive audit report (FR88)

**Given** a Tenant Admin configures audit report
**When** setting parameters
**Then** system allows: date range, action types, users, entity types

**Given** a Tenant Admin generates a report
**When** the report is created
**Then** system includes all matching audit log entries
**And** report is formatted for compliance review

**Given** an audit report is generated
**When** downloading the report
**Then** system provides: CSV (raw data), Excel (with formatted sheets)

**Given** a large audit report is requested
**When** generation takes time
**Then** system processes in background
**And** notifies Tenant Admin when complete

**Given** an audit report
**When** reviewing the document
**Then** report includes:
- Executive summary with totals
- Detailed log entries
- User activity summary
- Entity change history
- Timestamp of generation
- "Confidential" watermark

**Given** an external auditor needs access
**When** Tenant Admin generates report
**Then** system provides option to create secure, time-limited link

**Technical Notes:**
- Report generation via NestJS microservice using ExcelJS
- CSV for raw data, Excel for formatted reports with sheets
- Large reports (>10k entries) processed in background
- Secure links via signed URLs with 72-hour expiration
- Report includes generation metadata for authenticity

---

## Story Dependency Graph

```
Story 10.1 (Action Logging) ── Foundation for all
    │
    ├── Story 10.2 (Log Viewing)
    │
    └── Story 10.3 (Report Generation)
```

## Definition of Done

- [ ] All 3 stories implemented and tested
- [ ] Audit logs verified as append-only
- [ ] All mutation types logged correctly
- [ ] Before/after states captured accurately
- [ ] Report generation tested with large datasets
- [ ] All FR and NFR acceptance criteria verified
- [ ] Code reviewed and merged to main branch
