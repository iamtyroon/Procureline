# Sprint Change Proposal: Remove Epic 7 Stories 7.2 and 7.3

**Date:** 2026-05-18

## 1. Issue Summary

Story 7.2 is no longer needed as a separate delivery slice because automated department plan aggregation does not need to remain in the backlog independently. Story 7.3 is also no longer needed because compliance calculations and totals have already been completed manually.

This change was triggered during Epic 7 backlog review after Story 7.1 reached `done` and Stories 7.2 and 7.3 still remained as `backlog` items in `sprint-status.yaml`.

## 2. Impact Analysis

**Epic Impact:** Epic 7 remains active and still covers PO consolidation, finalization, export, and Excel formatting. The active story count changes from 6 to 4.

**Story Impact:** Story 7.2 and Story 7.3 are removed from planned work. Later stories keep their existing IDs to avoid unnecessary renumbering churn: 7.4 Finalization & Versioning, 7.5 Excel Export, and 7.6 Excel Formatting & Content.

**Artifact Conflicts:** Epic 7 source documentation, Story 7.1 notes, and sprint tracking referenced 7.2 and 7.3 as pending work. These references needed cleanup so future implementation agents do not recreate unnecessary stories.

**Technical Impact:** No application code changes are required. This is a backlog and implementation-artifact cleanup. Export and finalization stories still need to respect the completed aggregation/compliance behavior.

## 3. Recommended Approach

**Recommended path:** Direct Adjustment.

Remove Stories 7.2 and 7.3 from the Epic 7 source and sprint tracking while preserving the remaining story IDs. This has low effort and low technical risk because it does not alter runtime behavior or require code rollback.

**MVP impact:** No MVP reduction is intended. The underlying consolidation and compliance capabilities remain part of Epic 7; only redundant planned story slices are removed.

## 4. Detailed Change Proposals

### Stories

**Artifact:** `_bmad-output/implementation-artifacts/epics/epic7/epic-07-consolidation-export.md`

**OLD:** Epic 7 listed 6 stories, including:

- Story 7.2: Automated Department Plan Aggregation
- Story 7.3: Compliance Calculations & Totals

**NEW:** Epic 7 lists 4 active stories:

- Story 7.1: Consolidation Workspace Access
- Story 7.4: Finalization & Versioning
- Story 7.5: Excel Export
- Story 7.6: Excel Formatting & Content

**Rationale:** Story 7.2 is unnecessary as a separate backlog item, and Story 7.3 has already been completed manually.

### Sprint Status

**Artifact:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

**OLD:** Story entries, story surface definitions, and phase-6 sequence included:

- `7-2-automated-department-plan-aggregation`
- `7-3-compliance-calculations-totals`

**NEW:** Those entries are removed from development status, story surfaces, and recommended execution sequence.

**Rationale:** Sprint tracking should only show actionable remaining work.

### Story 7.1 Notes

**Artifact:** `_bmad-output/implementation-artifacts/epics/epic7/stories/7-1-consolidation-workspace-access.md`

**OLD:** Several notes referred to Story 7.2 and Story 7.3 as future owners.

**NEW:** Notes now refer to existing implementation detail and manually completed compliance/totals behavior instead of pending future stories.

**Rationale:** Completed story context should not direct future agents toward removed backlog items.

## 5. Implementation Handoff

**Scope classification:** Minor.

**Route to:** Development team / implementation agents.

**Success criteria:**

- Story 7.2 and Story 7.3 no longer appear as active backlog items.
- Epic 7 total active story count is 4.
- Story 7.4 remains the next Epic 7 backlog story.
- No code rollback or runtime behavior changes are introduced.

