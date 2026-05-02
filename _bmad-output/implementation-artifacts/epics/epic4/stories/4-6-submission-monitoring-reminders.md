# Story 4.6: Submission Monitoring & Reminders

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to monitor department submission progress and send reminders,
so that I can identify lagging departments early, follow up without manual cross-checking, and keep the shared submission window on track for the selected fiscal year.

## Acceptance Criteria

1. [Given] a Procurement Officer opens submission monitoring for the selected fiscal year from the canonical `/po` shell [When] active departments, canonical plan records, and deadline data are loaded [Then] the workspace shows every in-scope active department exactly once, including departments with no plan yet, and surfaces a truthful progress summary such as `X of Y departments submitted` plus counts for `Not Started`, `Draft`, `Submitted`, `Rejected`, and `Approved` (FR29, FR29a).
2. [Given] a department has multiple plan-like records for the same fiscal year because of later approved redraft flows or stale historical records [When] monitoring rows are derived [Then] the workspace reuses the repo’s canonical-per-fiscal-year selection rules instead of double-counting the department or showing contradictory statuses.
3. [Given] a department has no current-fiscal-year plan, only a draft, an active submitted plan under review, a rejected plan, or an approved plan [When] the row status is derived [Then] the monitoring view maps that state to one canonical PO-facing status bucket and does not invent a parallel state machine that conflicts with the dashboard, review modal, or DU status tracking.
4. [Given] the Procurement Officer filters by status, department, or date range [When] filters are applied [Then] the row set, summary counts, empty state, and export scope all stay aligned to the same filtered dataset and preserve the selected fiscal-year context (FR29a, FR29b, FR29f).
5. [Given] a department row is opened for detail [When] the Procurement Officer views submission history [Then] the product shows a truthful timeline assembled from canonical `plans`, `planSubmissionSnapshots`, `reviewStartedAt`, `planReviewDecisions`, approval timestamps, and redraft-request metadata where relevant, without depending on a nonexistent `planStatusHistory` table or fabricating missing events (FR29e).
6. [Given] older or partial records lack some timestamps or snapshot payloads [When] the history view is built [Then] the UI degrades to metadata-only entries, marks unavailable detail explicitly, and does not crash or hide the department entirely.
7. [Given] the shared submission deadline is configured for the selected fiscal year [When] the workspace identifies lagging departments [Then] it classifies reminder-eligible targets deterministically using the correct due date for that department state, meaning the shared submission deadline for pre-review states and the effective revision deadline for rejected or revision-requested plans when that later Epic 6 state exists, and it does not queue reminders for departments already approved, departments outside the selected fiscal year, inactive departments, departments without safe DU access coverage, or departments without a reachable active DU contact.
8. [Given] the Procurement Officer sends a reminder to one department [When] the target still belongs to the tenant, has one or more active DU recipients under the chosen recipient policy, has safe DU access coverage, and remains reminder-eligible at mutation time [Then] the backend queues one durable reminder batch through the existing email bridge, records a reminder event for auditability, and returns a truthful queued or partial-failure result instead of pretending delivery already happened (FR29c).
9. [Given] the Procurement Officer sends a bulk reminder [When] multiple departments are eligible [Then] the system queues reminders for every eligible department exactly once for that request, skips ineligible departments with explicit reasons, and reports queued, skipped, and failed counts so the operator can see partial outcomes immediately (FR29d).
10. [Given] the Procurement Officer retries quickly, refreshes, or opens two tabs [When] the same individual or bulk reminder request is triggered more than once for the same departments and deadline state [Then] idempotency rules prevent duplicate reminder emails for the same reminder action window while still allowing a later deliberate follow-up send under a new request identity.
11. [Given] a department changes state while the reminder request is being processed, such as submitting a plan, being archived, losing its DU profile, or moving outside the selected fiscal-year scope [When] queueing reaches that department [Then] the mutation revalidates eligibility per department and skips stale targets rather than sending outdated reminders.
12. [Given] the shared deadline is missing, already expired, or inconsistent with department-level window data [When] the Procurement Officer attempts to send reminders [Then] the product fails closed with truthful guidance, because reminders must not be sent from an unsafe or already-closed submission window.
13. [Given] the Procurement Officer exports the submission status report [When] the export is generated [Then] the output contains the filtered departments and the approved fields `department`, `status`, `last updated`, and `DU contact`, and it uses the existing NestJS Excel export path instead of inventing a browser-only CSV or ad hoc file format (FR29f).
14. [Given] implementation completes [When] deterministic automated coverage runs [Then] tests prove full department coverage including no-plan rows, status-bucket shaping, timeline fallback behavior, manual individual reminders, bulk reminder dedupe, stale-target skipping, deadline gating, export scope alignment, and no regression to Story 4.5 deadline reminders, Story 6.3 submission queue review, Story 6.5 review decisions, or Story 6.7 DU status tracking.

## Tasks / Subtasks

- [ ] Task 1: Build a canonical monitoring dataset that covers every active department, not just non-draft plans (AC: 1-4, 11, 14)
  - [ ] Extend `webapp/convex/functions/procurementOfficerSubmissions.ts` with a monitoring query that starts from active departments in scope, then joins canonical plan state per department for the selected fiscal year.
  - [ ] Reuse `selectCanonicalPlans(...)` style fiscal-year selection rules or extract a shared helper so the PO monitoring view and DU dashboard do not diverge when multiple plan records exist.
  - [ ] Derive one canonical status bucket per row: `not_started`, `draft`, `submitted`, `rejected`, or `approved`, while keeping `reviewStartedAt` or pending redraft details as secondary metadata instead of a competing top-level state.
  - [ ] Keep all reads tenant-scoped via `requireTenantRole(ctx, ["procurement_officer"])` and declared Convex indexes in field order.
  - [ ] Ensure summary counts and filtering are computed from the same canonical row set so row totals, badges, and progress bars cannot disagree.

- [ ] Task 2: Add a real PO submission monitoring workspace inside the existing `/po` shell (AC: 1-6)
  - [ ] Replace the current lightweight submitted-plans card flow with a dedicated workspace component such as `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionMonitoringWorkspace.tsx`, or expand the current panel into that role without leaving the `/po` shell.
  - [ ] Update modal/navigation helpers in `webapp/lib/procurement-officer/dashboard.ts` and `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` so submission monitoring is a first-class workspace, not a future-panel placeholder.
  - [ ] Surface summary metrics, per-status filters, department filters, date filters, row-level actions, and empty states that stay consistent with the underlying query.
  - [ ] Add a department detail surface showing canonical history/timeline data assembled from `planSubmissionSnapshots`, review timestamps, decisions, and redraft metadata.
  - [ ] Keep the workspace desktop-first and visually aligned with the existing PO dashboard language from Stories 4.1 through 4.5.

- [ ] Task 3: Implement reminder eligibility, individual sends, and bulk sends through the existing email pipeline (AC: 7-12, 14)
  - [ ] Add focused reminder mutations or actions in a PO domain module that accept selected department ids plus fiscal-year context and revalidate each target server-side before queueing.
  - [ ] Reuse `webapp/convex/actions/email.ts`, NestJS `EmailService`, and the existing Resend-backed idempotent queue path rather than sending mail directly from the browser.
  - [ ] Add one or more explicit reminder email templates that include department name, the correct due-date label for that department state, tenant branding, and DU entry URL, while preserving the current template union and queue contract.
  - [ ] Define one deterministic idempotency strategy for manual reminders, for example request-scope keys per department and reminder reason, so quick retries do not duplicate mail but deliberate future reminders can still be sent.
  - [ ] Define one explicit recipient policy when a department resolves to multiple active DU contacts, recommended as notifying every active department-scoped DU after deduplicating email addresses, and test that the policy is deterministic.
  - [ ] Skip or fail closed for departments with no active DU profile, no resolved DU email, or no safe DU access coverage, and report those skips back to the operator instead of silently dropping them.
  - [ ] Do not piggyback manual reminders onto Story 4.5’s automatic deadline-reminder jobs; keep those automatic and manual reminder flows distinct while reusing the same delivery infrastructure.

- [ ] Task 4: Add audit coverage and truthful operator feedback for reminder operations (AC: 8-12, 14)
  - [ ] Append audit entries for individual and bulk reminder attempts, including queued, skipped, failed, and blocked outcomes per request.
  - [ ] Define sanitized operator feedback for: no eligible departments, missing deadline, expired deadline, stale target, no DU contact, duplicate reminder prevented, and queue failure.
  - [ ] Surface partial success explicitly in the workspace so operators can distinguish `queued`, `skipped`, and `failed` counts.
  - [ ] Ensure cross-tenant or archived-department targets cannot be queued even if a stale client still holds their ids.

- [ ] Task 5: Implement filtered status export using the existing server-side file pipeline (AC: 4, 13, 14)
  - [ ] Reuse the current Convex-to-NestJS file export path in `webapp/convex/actions/files.ts` and `nestjs/src/files/*` for the status report instead of building a separate client download path.
  - [ ] Generate export rows from the same filtered monitoring dataset used by the UI so exports cannot disagree with what the Procurement Officer is looking at.
  - [ ] Include only the approved report fields and use the tenant timezone for rendered timestamps.
  - [ ] Check the live NestJS queue/export implementation before choosing queued versus direct export flow; current queue tests already show unsupported `file.export`/`file.import` paths, so Story 4.6 must either extend that processor or keep the export path on the supported direct flow.

- [ ] Task 6: Add deterministic regression coverage and runner updates (AC: 1-14)
  - [ ] Add pure tests for canonical status-bucket derivation, full-department coverage including no-plan rows, reminder-eligibility calculation, idempotency key shaping, and timeline fallback rendering.
  - [ ] Add backend tests for individual reminder queueing, bulk reminder partial success, stale-target revalidation, expired-deadline blocking, no-contact skips, and tenant-scope enforcement.
  - [ ] Add UI tests for status filters, progress summaries, empty states, history modal fallback rows, and partial reminder-result banners or toasts.
  - [ ] Add export tests proving the file payload matches the filtered monitoring dataset and uses the required columns only.
  - [ ] Preserve regression coverage for Story 4.5 deadline configuration and automatic reminder jobs, Story 6.3 PO review queue behavior, Story 6.5 review decision states, and Story 6.7 DU status history shaping.
  - [ ] Update `webapp/tests/run-tests.ts` and any NestJS test registration needed so the new monitoring/reminder/export coverage runs in the standard suites.

## Dev Notes

### Story Foundation

- Epic 4 defines Story 4.6 as the operational collection-phase view for Procurement Officers after departments, access codes, and deadlines exist.
- In the live repo, parts of this capability already exist in fragments:
  - the PO dashboard shows aggregate submission progress
  - the PO submitted-plans panel shows only non-draft plans
  - Story 4.5 already owns canonical deadlines and automatic pre-deadline reminder infrastructure
  - Stories 6.3, 6.5, and 6.7 already own deeper submission review, decision state, and DU-facing history
- Story 4.6 should unify those pieces into one truthful PO monitoring workflow rather than creating a second plan-state or reminder subsystem.

### Previous Story Intelligence

- Story 4.5 established one canonical tenant submission window per fiscal year in `submissionDeadlines`, plus durable deadline reminder queueing and cancellation behavior. Story 4.6 should reuse that deadline authority when deciding whether reminders may be sent.
- Story 4.5 also established the repo’s current PO dashboard pattern: keep `/po` as the canonical shell, use thin route contracts, and push stateful work into focused Convex functions plus workspace components.
- Story 6.5 introduced canonical `planReviewDecisions` for approved, rejected, and revision-requested review outcomes.
- Story 6.7 already shapes DU-facing timeline/history from `planSubmissionSnapshots`, `reviewStartedAt`, review decisions, and revision-deadline helpers. Story 4.6 should reuse the same historical sources for PO monitoring instead of inventing `planStatusHistory`.

### Current Implementation State Discovered In Code

- `webapp/convex/functions/procurementOfficerDashboard.ts` and `webapp/lib/procurement-officer/dashboard-snapshot.ts` already compute submission progress counts for the selected fiscal year, but that snapshot is dashboard-summary level only.
- `webapp/src/components/procurement-officer/ProcurementOfficerSubmittedPlansPanel.tsx` currently renders only submitted, rejected, and approved plans from `getProcurementOfficerSubmissionQueue`; departments with no plan or draft-only plans are invisible there.
- `webapp/convex/functions/procurementOfficerSubmissions.ts` currently filters out `draft` plans entirely, so it cannot satisfy FR29’s need to monitor all departments or FR29a’s `Not Started` and `Draft` buckets.
- The older epic text claims a `planStatusHistory` table, but the live schema does not contain one. Canonical status history currently comes from `plans`, `planSubmissionSnapshots`, `planReviewDecisions`, `reviewStartedAt`, approval timestamps, and redraft requests.
- Story 4.5 already provides:
  - `submissionDeadlines`
  - `submissionDeadlineReminderJobs`
  - `deadline-reminder` and `deadline-extension` email templates
  - idempotent email queueing via `webapp/convex/actions/email.ts` and NestJS `EmailService`
- There is no manual PO reminder workflow yet for FR29c or FR29d.
- `webapp/lib/auth/department-user-access.ts` still contains placeholder copy that access-code reminder requests are a follow-up story, which is separate from PO submission reminders and should not be conflated.
- The live NestJS queue tests currently report unsupported `file.export` and `file.import` jobs in `PlatformQueueProcessor`, so queued file-export assumptions need verification before 4.6 chooses its export path.

### Technical Requirements

- Treat department coverage as the canonical outer loop:
  - every active in-scope department must appear exactly once
  - plan state is joined onto the department row, not the other way around
- Keep one monitoring status model for PO operations:
  - recommended buckets: `not_started`, `draft`, `submitted`, `rejected`, `approved`
  - keep `reviewStartedAt` as extra detail, not a sixth conflicting filter bucket, unless the team explicitly expands the product contract
- Reuse canonical history sources already present in the repo:
  - `planSubmissionSnapshots`
  - `reviewStartedAt`
  - `planReviewDecisions`
  - `approvedAt`, `rejectedAt`, `submittedAt`
  - `planRedraftRequests` where approved-plan reopen state matters
- Manual reminder eligibility must be computed from:
  - the selected fiscal year
  - active department scope
  - canonical shared deadline state from Story 4.5
  - effective revision deadline state when a rejected or revision-requested plan has a later canonical due date
  - canonical row status
  - safe DU access coverage
  - active DU contact availability
- Recipient selection must be deterministic:
  - if a department resolves to multiple active DU contacts, the story must either notify all deduplicated active recipients or define one canonical recipient rule explicitly
  - the UI and audit output must reflect that policy truthfully
- Reminder queueing must be concurrency-safe:
  - revalidate each department before queueing
  - use idempotency keys that block accidental duplicate sends for the same request
  - allow later intentional reminder sends under a new request identity
- Export output must come from the same filtered dataset as the UI and must not silently broaden scope.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `date-fns` `^2.30.0`
  - `resend` `^2.1.0`
  - `lucide-react` `^0.577.0`
- Keep interactive workflow state in client components, but keep authorization, dataset shaping, reminder eligibility, and audit writes in Convex functions near the data.
- Keep route files thin and preserve the current `/po` dashboard-shell architecture.
- Reuse existing NestJS email and file services instead of introducing direct browser downloads or browser-owned mail sends.

### Library And Framework Requirements

- Convex React:
  - use `useQuery(...)` for live monitoring data
  - use `useMutation(...)` or `action` entry points for reminder and export initiation
  - keep index usage aligned with declared field order
- Next.js App Router:
  - preserve thin `page.tsx` contracts
  - keep modal/workspace routing inside the current PO shell patterns
- Resend / NestJS email flow:
  - reuse idempotency support and scheduled/cancel-safe delivery patterns already used by Story 4.5
  - keep queued result reporting truthful; queued is not delivered
- Excel export:
  - prefer the existing NestJS Excel service path
  - do not add a browser-only export implementation for this story

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/convex/functions/procurementOfficerSubmissions.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/submissions.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerSubmittedPlansPanel.tsx`
  - `webapp/convex/actions/email.ts`
  - `webapp/convex/actions/files.ts`
  - `nestjs/src/email/email.service.ts`
  - `nestjs/src/files/files.controller.ts`
  - `nestjs/src/files/excel.service.ts`
  - `webapp/tests/procurement-officer-dashboard.test.ts`
  - `webapp/tests/run-tests.ts`
- Recommended new files if cohesion improves:
  - `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionMonitoringWorkspace.tsx`
  - `webapp/lib/procurement-officer/submission-monitoring.ts`
  - `webapp/tests/procurement-officer-submission-monitoring.test.ts`

### Testing Requirements

- Add pure tests for:
  - department-first row shaping
  - canonical status-bucket derivation
  - selected-fiscal-year filtering
  - reminder eligibility and skip reasons
  - manual reminder idempotency-key generation
  - history fallback shaping when timestamps are partial
- Add backend tests for:
  - every active department appearing once
  - draft-only and no-plan departments remaining visible
  - individual reminder queueing
  - bulk reminder partial success
  - rejected or revision-requested reminder targeting using the effective revision deadline instead of the stale shared deadline
  - multi-recipient department reminder policy and email dedupe behavior
  - stale target revalidation
  - expired or missing deadline blocking
  - no DU contact skips
  - no safe access coverage skips
  - cross-tenant target rejection
- Add UI tests for:
  - per-status filters and counts
  - lagging-department highlighting
  - detail timeline fallback rows
  - queued/skipped/failed reminder result copy
  - export button disabled states when deadline context is unsafe
- Add integration or contract tests for:
  - status-report export payload shape
  - email queue request payloads for manual reminders
  - partial failure handling from the queue bridge

### Git Intelligence Summary

- Commit `0abd7c3` recently implemented DU revision feedback and deadline management, which means 4.6 must coexist with review-decision and revision-deadline data that did not exist in the original Epic 4 planning text.
- Commit `6b83f05` implemented review decision handling and UI components for Story 6.5, establishing `planReviewDecisions` as the canonical review-state source.
- Commit `f83b02e` added DU dashboard and status-tracking tests, reinforcing that history shaping and revision labels already have deterministic coverage that 4.6 should reuse.
- Commit `096d032` added redraft functionality and pre-submission validation, so submission monitoring should not misclassify approved-plan redraft scenarios as simple draft/no-plan states.

### Latest Tech Information

- Verified on 2026-05-02 from official docs and current package metadata:
  - Next.js App Router `page` files are still the leaf route component and remain Server Components by default. Source: https://nextjs.org/docs/app/api-reference/file-conventions/page
  - Convex React `useQuery` remains reactive and returns `undefined` while first loading, which matches the repo’s live dashboard subscription pattern. Source: https://docs.convex.dev/client/react/
  - Convex indexes still require range expressions to step through fields in index order, which matters if 4.6 adds new monitoring indexes. Source: https://docs.convex.dev/database/reading-data/indexes/
  - Resend scheduled emails can be cancelled through the official email cancel API, which fits the repo’s existing reminder-cancellation strategy from Story 4.5. Source: https://resend.com/docs/api-reference/emails/cancel-email
  - Resend idempotency keys are retained for 24 hours and must be unique per logical email request, which is directly relevant to manual reminder dedupe. Source: https://resend.com/docs/dashboard/emails/idempotency-keys

### Project Context Reference

- Apply `_bmad-output/project-context.md` rules that still match the live repo:
  - strict TypeScript
  - Convex-first tenant and role enforcement
  - path-alias imports
  - shadcn/ui plus Tailwind for operator surfaces
  - append-only audit behavior
  - desktop-first workflow UX
- Where older planning artifacts conflict with the live schema or current PO/DU workflow code, prefer the live repo.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 4 Source](../epic-04-po-department-catalog.md)
- [Previous Story 4.5](./4-5-submission-deadline-management.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [PO Dashboard Query](../../../../../webapp/convex/functions/procurementOfficerDashboard.ts)
- [PO Submission Queue Query](../../../../../webapp/convex/functions/procurementOfficerSubmissions.ts)
- [PO Dashboard Helpers](../../../../../webapp/lib/procurement-officer/dashboard.ts)
- [PO Dashboard Snapshot](../../../../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
- [PO Submission Helpers](../../../../../webapp/lib/procurement-officer/submissions.ts)
- [PO Dashboard UI](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [PO Submitted Plans Panel](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerSubmittedPlansPanel.tsx)
- [DU Dashboard Query](../../../../../webapp/convex/functions/departmentUserDashboard.ts)
- [DU Status Tracking](../../../../../webapp/lib/department-user/status-tracking.ts)
- [Deadline Functions](../../../../../webapp/convex/functions/deadlines.ts)
- [Email Action](../../../../../webapp/convex/actions/email.ts)
- [Files Action](../../../../../webapp/convex/actions/files.ts)
- [Convex Schema](../../../../../webapp/convex/schema.ts)
- [NestJS Email Service](../../../../../nestjs/src/email/email.service.ts)
- [NestJS Files Controller](../../../../../nestjs/src/files/files.controller.ts)
- [NestJS Excel Service](../../../../../nestjs/src/files/excel.service.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Next.js Page File Convention](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [Convex React Docs](https://docs.convex.dev/client/react/)
- [Convex Indexes Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [Resend Cancel Email Docs](https://resend.com/docs/api-reference/emails/cancel-email)
- [Resend Idempotency Keys Docs](https://resend.com/docs/dashboard/emails/idempotency-keys)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story sources:
  - `_bmad-output/implementation-artifacts/epics/epic4/epic-04-po-department-catalog.md`
  - `_bmad-output/implementation-artifacts/epics/epic4/stories/4-5-submission-deadline-management.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/convex/schema.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/convex/functions/procurementOfficerSubmissions.ts`
  - `webapp/convex/functions/deadlines.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/convex/actions/email.ts`
  - `webapp/convex/actions/files.ts`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/submissions.ts`
  - `webapp/lib/department-user/status-tracking.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerSubmittedPlansPanel.tsx`
  - `nestjs/src/email/email.service.ts`
  - `nestjs/src/files/files.controller.ts`
  - `nestjs/src/files/excel.service.ts`
- Git context:
  - `git log -5 --pretty=format:"%h %s"`
- Tech verification:
  - `https://nextjs.org/docs/app/api-reference/file-conventions/page`
  - `https://docs.convex.dev/client/react/`
  - `https://docs.convex.dev/database/reading-data/indexes/`
  - `https://resend.com/docs/api-reference/emails/cancel-email`
  - `https://resend.com/docs/dashboard/emails/idempotency-keys`

### Completion Notes List

- 2026-05-02: Created the implementation-ready story artifact for `4-6-submission-monitoring-reminders`.
- 2026-05-02: Anchored Story 4.6 to the live PO dashboard, canonical deadline/reminder infrastructure from Story 4.5, and canonical review/history sources from Epic 6 instead of the older `planStatusHistory` assumption.
- 2026-05-02: Identified the main live gap that current submission monitoring excludes departments with no plan or draft-only plans, making department-first row shaping the core requirement for this story.
- 2026-05-02: Flagged the current NestJS queue/export mismatch so Excel status-report delivery can be implemented on a verified path instead of assuming unsupported queue jobs already work.
- 2026-05-02: Began implementation with a new department-first monitoring helper module, a canonical monitoring Convex query, dashboard workspace wiring, server-side Excel export, and first-pass manual reminder queueing.
- 2026-05-02: Added deterministic tests for canonical monitoring selection, PO-facing status buckets, reminder eligibility, timeline fallback shaping, idempotency-key generation, and export row shaping.
- 2026-05-02: Addressed AI code review findings: fixed NestJS reminder template compilation, added date-range filtering, switched reminder dedupe to a server-side retry window, enforced safe DU access-code coverage, reported stale reminder targets, and restricted monitoring exports to Procurement Officers.

### File List

- `_bmad-output/implementation-artifacts/epics/epic4/stories/4-6-submission-monitoring-reminders.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/lib/procurement-officer/submission-monitoring.ts`
- `webapp/convex/functions/procurementOfficerSubmissions.ts`
- `webapp/convex/actions/files.ts`
- `webapp/convex/actions/email.ts`
- `webapp/src/components/procurement-officer/ProcurementOfficerSubmissionMonitoringWorkspace.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- `webapp/tests/procurement-officer-submission-monitoring.test.ts`
- `webapp/tests/run-tests.ts`
- `nestjs/src/email/dto/send-email.dto.ts`
- `nestjs/src/email/template-renderer.service.ts`
- `nestjs/src/email/templates/submission-reminder.template.ts`
- `nestjs/test/email-template-renderer.service.spec.ts`

### Senior Developer Review (AI)

- Review result: Approved after fixes.
- Fixed high-severity compile blocker in `nestjs/src/email/templates/submission-reminder.template.ts` by replacing JSX and the missing `@react-email/components` dependency with the repo's existing `React.createElement` email-template pattern.
- Fixed monitoring filter/export alignment by adding last-updated date range filters to `ProcurementOfficerSubmissionMonitoringWorkspace`; export now receives the same filtered department id scope as the rendered rows.
- Fixed reminder duplicate risk by deriving idempotency keys from tenant, fiscal year, department, status, due date, recipient, and a server-side retry window instead of client-generated random request keys.
- Fixed reminder safety by requiring active, unrevoked, unexpired department access-code coverage in reminder eligibility.
- Fixed stale target transparency by returning explicit `stale_target` skipped results for selected department ids no longer present in the revalidated monitoring dataset.
- Fixed export authorization by requiring a Procurement Officer actor before calling the NestJS Excel service.
- Verification: `nestjs` `npm test -- --runInBand` passed, `nestjs` `npm run build` passed. `webapp` `npm test` remains blocked by pre-existing Convex generated typing/ESM failures before story tests execute.

### Change Log

- 2026-05-02: Story 4.6 created and moved to ready-for-dev with implementation guidance for department-first monitoring, canonical history shaping, manual reminder queueing, bulk reminder dedupe, and status-report export alignment.
- 2026-05-02: Story 4.6 moved to in-progress and gained the first implementation slice for monitoring, export, and manual reminder plumbing.
- 2026-05-02: AI code review issues fixed and story moved to done.

### Story Completion Status

- Story ID: `4.6`
- Story Key: `4-6-submission-monitoring-reminders`
- Output File: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-6-submission-monitoring-reminders.md`
- Status: `done`
- Completion Note: `AI code review findings fixed; NestJS build/tests pass. Webapp suite remains blocked by pre-existing Convex generated typing/ESM errors.`
