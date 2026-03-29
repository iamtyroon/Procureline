# Story 4.5: Submission Deadline Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to set and manage submission deadlines,
so that Departmental Users see one truthful shared submission window, dashboards show accurate countdowns, and downstream DU access plus reminder behavior stay consistent across the tenant.

## Acceptance Criteria

1. [Given] a Procurement Officer opens `/po/deadlines` [When] the current PO route resolves through the modal-backed `/po` workspace contract [Then] the route renders a real deadline-management workspace instead of the current alert-only placeholder modal [And] it preserves `/po` as the canonical Procurement Officer shell (FR-DL1, FR28, Story 4.1 patterns).
2. [Given] active departments already exist for the selected fiscal year [When] the Procurement Officer configures the submission window [Then] the workspace accepts both submission start and submission deadline as date-and-time inputs in 24-hour format [And] the preview clearly shows the selected fiscal year, timezone, and impacted department count before save (FR-DL1, FR-DL5, FR-DL6).
3. [Given] active departments exist but no safe submission windows have been configured yet [When] the deadline workspace loads for first-time setup [Then] the Procurement Officer can still select a supported fiscal year using a bootstrap strategy that is not derived only from pre-existing department windows [And] the default selection is deterministic, such as the current tenant fiscal year unless a canonical deadline record already exists for another requested year.
4. [Given] the Procurement Officer enters a deadline or start time that is already in the past [When] they submit the form [Then] the backend fails closed with a deterministic `Deadline cannot be in the past` style validation error [And] no department window or reminder schedule is updated (FR-DL2).
5. [Given] the Procurement Officer enters a start and end combination where the deadline is not strictly after the start time [When] they submit the form [Then] validation blocks the save with an explicit date-ordering error [And] the repo does not persist an invalid shared window that would break current DU auth or dashboard derivation.
6. [Given] the tenant has one or more active departments in scope [When] the Procurement Officer saves a valid shared submission window [Then] the system updates the canonical tenant-level deadline settings for that fiscal year [And] it fans the same window into every active in-scope department record so the existing shared-deadline helpers, DU auth guards, and DU dashboard logic keep one authority instead of splitting across competing sources (FR-DL1, FR-DL6 plus current repo reality).
7. [Given] no active departments exist for the targeted fiscal year [When] the Procurement Officer attempts to save deadline settings [Then] the save is blocked with honest guidance to create departments first [And] the workspace does not pretend a deadline was successfully configured for zero departments (FR28d, FR-DL1, current dashboard truthfulness rules).
8. [Given] a shared deadline already exists for the selected fiscal year [When] the Procurement Officer moves the deadline later than the current value [Then] the system treats the change as an extension, persists the new shared window, records extension metadata for auditability, and queues immediate DU-facing communication about the extension instead of silently changing the date (FR-DL3).
9. [Given] a shared deadline already exists [When] the Procurement Officer changes the deadline earlier or otherwise mutates the current window in a way that could surprise active Departmental Users [Then] the workspace must not silently tighten access or create hidden lockouts; it requires one explicit guarded confirmation path with deterministic messaging and full audit coverage, or the backend blocks the change if that guarded path is not supplied.
10. [Given] the Procurement Officer configures reminder preferences [When] they choose reminder offsets [Then] the workspace supports the product-approved schedule of 7 days, 3 days, and 1 day before the deadline [And] the saved state is durable, deduplicated, and scoped to the selected fiscal year instead of being recomputed from browser-only local state (FR-DL4).
11. [Given] reminder preferences are enabled for a valid shared deadline [When] the system accepts the configuration [Then] reminder jobs are scheduled idempotently through the existing server-owned delivery path so the same deadline save or extension does not create duplicate reminder emails from retries, refreshes, or repeated queue claims (FR-DL4, FR82, current queue architecture).
12. [Given] reminder jobs were previously scheduled for an older deadline version or reminder-offset set [When] the Procurement Officer saves a changed deadline or reminder configuration [Then] superseded reminder work is either canceled or made dispatch-safe by version checks [And] only the latest saved configuration can still produce outgoing reminder communication.
13. [Given] one or more approved reminder offsets are already in the past at save time [When] the Procurement Officer saves the deadline configuration [Then] those elapsed offsets are skipped deterministically with explicit UI feedback and audit visibility [And] the system does not send surprise catch-up reminders immediately unless product copy and backend rules explicitly support that behavior.
14. [Given] the tenant has a configured timezone for deadline handling [When] the Procurement Officer views, saves, extends, or previews a deadline [Then] the workspace shows that timezone explicitly and all rendered dates plus times use that timezone instead of the operator's browser-local timezone [And] the saved canonical timestamps remain durable and comparable on the backend (FR-DL5).
15. [Given] the tenant does not yet expose an authoritative configured timezone in live data [When] the deadline workspace loads [Then] it stays honest about the missing configuration and uses one explicit fallback strategy documented in code and UI copy rather than silently mixing browser-local timestamps into canonical deadline state (FR-DL5 plus current repo gap).
16. [Given] fiscal-year selection or derivation depends on a submission timestamp near a year boundary [When] the system maps the deadline to a fiscal year [Then] it uses the same explicit tenant deadline timezone or documented fallback timezone that the workspace displays [And] it does not classify fiscal years purely from browser locale or raw UTC month boundaries that can drift from tenant intent.
17. [Given] a valid shared deadline exists [When] Procurement Officers and Departmental Users view their dashboards [Then] both dashboards display a live countdown tied to the same shared window and fiscal year [And] the countdown updates truthfully over time rather than relying on a hard-coded day fallback or stale placeholder values (FR-DL6, FR28c, FR38a).
18. [Given] less than 24 hours remain before the deadline [When] Procurement Officers or Departmental Users view countdown surfaces [Then] the UI switches to truthful sub-day copy such as hours and minutes remaining instead of rounding up to a misleading `1d left` label.
19. [Given] Story 4.3 already defaults access-code expiration from the safe shared deadline [When] Story 4.5 lands [Then] that existing expiration-default behavior continues to work from the new authoritative deadline source without breaking current access-code generation, rotation, or manual-expiration fallback paths.
20. [Given] Story 1.8 and the DU dashboard already gate access from `departments.submissionStartsAt` and `departments.submissionEndsAt` [When] Story 4.5 is implemented [Then] it must extend that authority rather than creating a second disconnected deadline-check path, so DU login, read-only grace handling, and dashboard messaging remain consistent.
21. [Given] the repo does not yet have a full generic in-app notifications center [When] deadline extensions or reminder moments need in-app visibility [Then] Story 4.5 implements the lightest truthful in-app announcement pattern that fits the current dashboard architecture, for example reactive dashboard banners or announcements, instead of inventing a separate global notifications subsystem.
22. [Given] deadline configuration, extension, reminder scheduling, or downstream notification queueing changes system state [When] those operations succeed or fail [Then] append-only audit entries are written using the current audit helper conventions and queue failure states are surfaced safely without leaking provider internals (NFR-S9, FR-DL3, FR-DL4).
23. [Given] the Procurement Officer retries quickly, refreshes, or loses connectivity during a deadline save or extension [When] the operation is retried [Then] duplicate submissions are prevented client-side and the backend remains idempotent enough to avoid double fan-out, duplicate reminder schedules, or duplicate extension emails.

## Tasks / Subtasks

- [x] Task 1: Add a focused deadline domain model that fits the live repo instead of inventing a disconnected `fiscalYears` subsystem (AC: 2-16, 19-23)
  - [x] Add a dedicated Convex module such as `webapp/convex/functions/deadlines.ts` or `webapp/convex/functions/submissionDeadlines.ts` for read, create, update, extension, and reminder-scheduling orchestration instead of overloading `procurementOfficerDashboard.ts`.
  - [x] Add a canonical tenant-scoped deadline settings record keyed by tenant and fiscal year, with fields such as `tenantId`, `fiscalYearKey`, `submissionStartsAt`, `submissionEndsAt`, `timeZone`, `reminderOffsets`, `deadlineVersion`, `createdAt`, `updatedAt`, and extension-tracking metadata.
  - [x] Add the indexes needed for tenant-plus-fiscal-year lookup, deterministic reminder dedupe, and safe lookup of the latest active reminder schedule metadata from day one.
  - [x] Keep the existing `departments.submissionStartsAt` and `departments.submissionEndsAt` fields as the downstream DU-enforcement surface, and fan the canonical shared window into those records on save so current DU auth and dashboards remain aligned.
  - [x] If tenant timezone is not already available, add one authoritative timezone field in the smallest sensible place, either on `tenants` or the new deadline settings record, instead of relying on browser-local time.
  - [x] Define a deterministic fiscal-year bootstrap source for first-time setup, for example current tenant fiscal year plus any existing canonical deadline records, so the selector does not depend only on already-safe department windows.
  - [x] Record enough extension metadata to distinguish first-time save vs extension and to support truthful audit plus DU announcement copy later.

- [x] Task 2: Build the Procurement Officer deadline workspace inside the current `/po` dashboard contract (AC: 1-18, 21, 23)
  - [x] Keep `webapp/app/(app)/po/deadlines/page.tsx` thin and preserve the current modal-backed route contract.
  - [x] Replace the current alert-only deadline modal in `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` with a real workspace component such as `webapp/src/components/procurement-officer/ProcurementOfficerDeadlinesWorkspace.tsx`.
  - [x] Reuse the repo-standard `react-hook-form` + Zod + shadcn/ui dialog or workspace patterns already used in the departments and access-codes workspaces.
  - [x] Show selected fiscal year, timezone, impacted departments, existing shared window state, reminder selections, skipped elapsed reminders if any, and a live preview before save.
  - [x] Allow first-time fiscal-year selection even when no safe deadline window exists yet, using the deterministic bootstrap rule from Task 1.
  - [x] Show explicit extension confirmation copy when the new deadline moves later than the current shared deadline.
  - [x] Show explicit guarded confirmation copy when a save would shorten or otherwise tighten an existing shared window.
  - [x] Keep the experience desktop-first and visually aligned with the existing PO dashboard and tweakcn styling.

- [x] Task 3: Reuse and extend existing deadline derivation logic instead of rewriting dashboard and DU behavior from scratch (AC: 6, 14-20)
  - [x] Reuse and evolve `webapp/lib/procurement-officer/dashboard.ts`, `webapp/lib/procurement-officer/dashboard-snapshot.ts`, and `webapp/convex/functions/procurementOfficerDashboard.ts` so summary cards, alerts, and readiness metrics read from the canonical shared deadline source cleanly.
  - [x] Reuse the tenant-admin countdown patterns in `webapp/lib/tenant-admin/dashboard.ts` and `webapp/src/components/tenant-admin/TenantAdminDashboard.tsx` for live ticking countdown behavior instead of inventing another timer implementation.
  - [x] Reuse the DU-side deadline presentation logic in `webapp/lib/department-user/dashboard.ts` and `webapp/src/components/department-user/DepartmentUserDashboard.tsx`, but patch it to render time and timezone truthfully once Story 4.5 introduces exact deadline timestamps.
  - [x] Update countdown helpers so surfaces switch to hours-and-minutes behavior when less than 24 hours remain, instead of rounding up to a misleading day count.
  - [x] Update fiscal-year derivation helpers so year classification uses the explicit deadline timezone or documented fallback timezone, not raw UTC-only month boundaries.
  - [x] Keep `webapp/convex/functions/departmentUserAuth.ts` and `webapp/lib/auth/department-user-access.ts` on the existing department-window authority so sign-in, grace-mode gating, and setup-required states do not fork.
  - [x] Update `webapp/convex/functions/accessCodes.ts` and `webapp/lib/procurement-officer/access-codes.ts` only where needed so default expiration continues to derive from the safe shared deadline after Story 4.5.

- [x] Task 4: Implement reminder and extension communication through the existing email and queue infrastructure, plus a lightweight in-app signal (AC: 8, 10-13, 21-23)
  - [x] Reuse the current Convex action plus NestJS email bridge in `webapp/convex/actions/email.ts`, `nestjs/src/email/email.service.ts`, and the BullMQ queue stack instead of sending reminders directly from the browser.
  - [x] Extend the existing email template union and renderer with the minimum new deadline-related templates needed, for example a deadline-extension notification and an approaching-deadline reminder.
  - [x] Schedule reminder delivery durably and idempotently, using the current queue plus sync-event patterns rather than React timers or best-effort client alarms.
  - [x] Add one explicit strategy for superseded reminder work, such as canceling obsolete delayed jobs or checking `deadlineVersion` and active schedule metadata before dispatch so stale reminders cannot send.
  - [x] Define and implement deterministic handling for elapsed reminder offsets at save time, and surface the skipped-or-sent-now decision honestly in UI copy and audit records.
  - [x] Implement the lightest truthful in-app announcement mechanism for deadline extensions and active reminders, for example reactive dashboard notices keyed from deadline metadata, instead of a brand-new notifications center.
  - [x] Keep queue failure states sanitized, recoverable, and visible to the PO workspace without duplicating scheduled jobs or extension notifications.

- [ ] Task 5: Add deterministic coverage for validation, timezone handling, dashboard countdowns, reminder dedupe, and downstream regressions (AC: 2-23)
  - [x] Add pure tests for bootstrap fiscal-year selection, timezone-aware fiscal-year derivation, timezone-aware deadline formatting, past-date rejection, start-before-end validation, reminder-offset calculation, elapsed-offset skipping, extension detection, and countdown sub-day formatting.
  - [ ] Add backend tests for first-time deadline save, extension flows, no-active-department blocking, department-window fan-out, idempotent reminder scheduling, stale reminder suppression after deadline changes, unauthorized access, and audit-log writes.
  - [x] Add PO dashboard regression tests proving shared-deadline readiness, countdown copy, and modal routing remain truthful after Story 4.5.
  - [x] Add DU dashboard and DU auth regression tests proving the canonical deadline fan-out still drives sign-in gating, read-only grace, and deadline countdown display correctly.
  - [x] Add email and queue contract tests across webapp and NestJS so extension and reminder templates, idempotency keys, and failure handling remain deterministic.
  - [x] Update `webapp/tests/run-tests.ts` and any NestJS test registration needed so deadline guardrail coverage runs in the standard suites.

### Review Follow-ups (AI)

- [x] [AI-Review][High] Locked `finalizeReminderJobQueueing` and `failReminderJobQueueing` behind internal-only mutations and added internal reminder dispatch/cancellation handling so reminder-job state can no longer be patched from the public API.
- [x] [AI-Review][High] Made unchanged deadline saves idempotent so no-op retries no longer increment `deadlineVersion`, rewrite announcements, or recreate reminder jobs.
- [x] [AI-Review][High] Stopped marking superseded reminder jobs as cancelled before queue removal succeeds and added a pre-send deadline-version check so stale reminders are suppressed even when BullMQ removal loses the race.
- [x] [AI-Review][High] Updated DU fiscal-year derivation and snapshot building to honor the tenant-configured deadline timezone and fiscal-year start month instead of hard-coded July/Nairobi assumptions.
- [x] [AI-Review][Medium] Surfaced reminder/extension queue failures back to the PO workspace so operators get warning toasts instead of false success.

## Dev Notes

### Story Foundation

- Epic 4 defines Story 4.5 as the controlled-submission-window story that comes directly after dashboard, departments, and access-code management.
- In the live repo, shared-deadline readiness already influences dashboard hero copy, access-code expiration defaults, DU login gating, and DU countdown presentation.
- The implementation goal is not just "save one timestamp." The goal is to establish one canonical shared submission window per tenant and fiscal year that the PO workspace, DU access flow, dashboard countdowns, and reminder behavior can all trust.

### Previous Story Intelligence

- Story 4.1 established `/po` as the canonical Procurement Officer shell and already surfaces the exact warning copy `Submission deadline not set. Configure before DUs can submit.` Deadline management should plug into that shell rather than creating a second deadline page architecture.
- Story 4.2 deliberately made `departments.submissionStartsAt` and `departments.submissionEndsAt` optional so department creation no longer had to fabricate deadline values before Story 4.5 existed. Story 4.5 now owns populating those fields truthfully.
- Story 4.3 already reuses the safe shared deadline to default access-code expirations and explicitly falls back to manual future expiration when deadline data is unsafe. Story 4.5 must preserve and strengthen that behavior, not bypass it.
- Story 1.8 already enforces DU access windows, lockout handling, and read-only grace based on department submission dates. Story 4.5 must extend that exact authority rather than creating a parallel deadline validation path.
- The current DU dashboard already has a real deadline card and countdown presentation. Story 4.5 should reuse that work and make it more precise, not replace it with a second countdown model.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/po/deadlines/page.tsx` currently only redirects back into the dashboard modal contract.
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` currently renders the deadline workspace as a placeholder metrics-and-alerts panel rather than a real management surface.
- `webapp/lib/procurement-officer/dashboard.ts` currently derives a shared deadline only by inspecting every active department's `submissionStartsAt` and `submissionEndsAt` values and requiring them to match exactly.
- `webapp/lib/procurement-officer/dashboard-snapshot.ts` already uses that derived shared deadline to drive readiness cards, hero copy, and blockers.
- `webapp/lib/procurement-officer/access-codes.ts` and `webapp/convex/functions/accessCodes.ts` already reuse the safe shared deadline as the default access-code expiration when available.
- `webapp/lib/auth/department-user-access.ts`, `webapp/convex/functions/departmentUserAuth.ts`, `webapp/lib/department-user/dashboard.ts`, and `webapp/convex/functions/departmentUserDashboard.ts` all currently depend on department submission-window fields for DU access gating and countdown presentation.
- The live schema currently has no `fiscalYears` table and no dedicated deadline settings table, so the epic note about storing deadlines in `fiscalYears` does not match current repo reality.
- The live schema currently has no tenant timezone field and no dedicated notification or reminder scheduling records for deadlines.
- The current PO dashboard fiscal-year selector becomes "safe" only when it can derive years from department windows, which is insufficient for first-time deadline setup and must be extended deliberately.
- The repo already has a durable queue and Convex sync architecture in:
  - `webapp/convex/actions/email.ts`
  - `webapp/convex/functions/externalServices.ts`
  - `nestjs/src/email/email.service.ts`
  - `nestjs/src/queue/queue.service.ts`
  - `nestjs/src/queue/platform-queue.processor.ts`
- The existing email template union only supports:
  - `generic-notification`
  - `billing-support`
  - `access-code-delivery`
- Current PO date handling is inconsistent:
  - access-code dialogs use `datetime-local` plus browser-local conversion helpers,
  - several dashboard labels use `Intl.DateTimeFormat`,
  - no current shared helper makes timezone handling explicit for PO deadline editing.
- Current fiscal-year derivation uses UTC month boundaries in shared helpers, so Story 4.5 must decide fiscal-year ownership in the same timezone model it uses for deadline editing.
- Current DU countdown behavior rounds remaining time up to whole days, so same-day deadline copy needs an explicit sub-day improvement path.

### Critical Implementation Traps

- Do not add a disconnected `fiscalYears` deadline source and leave DU auth or dashboard helpers reading stale department windows.
- Do not rely on browser-local `datetime-local` parsing as the canonical saved deadline without explicitly resolving the intended tenant timezone.
- Do not schedule reminders with React timers, local storage, or any other client-owned mechanism. Reminder delivery must be durable and server-owned.
- Do not let first-time deadline setup depend on "safe fiscal years" that only appear after deadlines already exist.
- Do not silently tighten an active shared deadline in a way that unexpectedly locks out DUs or invalidates current operator assumptions without guarded UX and full audit coverage.
- Do not leave old delayed reminder work active after a deadline edit or reminder-preference change.
- Do not compute fiscal-year ownership in UTC while displaying deadline intent in another timezone.
- Do not show `1d left` when only minutes or hours remain.
- Do not implement a full global notifications center here. Story 4.5 needs only the lightest truthful in-app deadline signal that fits the current dashboards.
- Do not break Story 4.3's access-code default-expiration behavior by switching deadline reads to a new source that access-code flows cannot see.
- Do not allow partial fan-out where the canonical deadline settings update but some departments keep old submission dates.

### Recommended Implementation Shape

- Keep one canonical tenant-scoped deadline settings record per fiscal year.
- On successful save or extension, fan the canonical start and end timestamps into every active in-scope department so current DU auth and dashboard logic remain authoritative without a risky rewrite.
- Allow deadline setup to bootstrap fiscal-year selection from current tenant fiscal-year context and existing canonical deadline records, not only from already-valid department windows.
- Reuse the modal-backed PO workspace pattern and the access-code or department dialog conventions for forms, toasts, and deterministic loading-state handling.
- Reuse tenant-admin countdown behavior for live ticking countdown labels and DU deadline-card presentation for downstream display semantics.
- Prefer a lightweight deadline-announcement pattern keyed from deadline metadata or last-updated timestamps over a new notifications subsystem.
- Reuse the current email queue and sync-event pipeline for extension and reminder emails, with idempotency keys derived from tenant, fiscal year, reminder offset, and current deadline version.
- Ensure delayed reminder dispatch is safe against superseded saves by canceling or version-gating older jobs before they can send.

### Data Model Guidance

- Recommended new canonical table:
  - `submissionDeadlines`
  - fields: `tenantId`, `fiscalYearKey`, `submissionStartsAt`, `submissionEndsAt`, `timeZone`, `reminderOffsets`, `deadlineVersion`, `createdAt`, `updatedAt`, `createdByTenantUserId`, `updatedByTenantUserId`, plus optional extension metadata such as `previousSubmissionEndsAt`, `lastExtendedAt`, and `lastExtensionReason`
- Recommended indexes:
  - `(tenantId, fiscalYearKey)`
  - an index supporting reminder lookup or dedupe if reminder jobs are materialized as records
  - an index or schedule record shape supporting lookup of the currently active reminder schedule for a specific deadline version
- Recommended tenant or config timezone field:
  - if tenant-level settings own timezone, add a single authoritative `timeZone`
  - if deadline settings own timezone, keep it explicit per fiscal year and do not infer from browser locale
- Recommended fiscal-year ownership rule:
  - derive and store `fiscalYearKey` from the same explicit timezone model used for deadline entry and preview
  - do not infer fiscal years from raw UTC month boundaries if the tenant-facing timezone differs
- Recommended fan-out rule:
  - all active departments in scope receive the same `submissionStartsAt` and `submissionEndsAt`
  - save must fail or roll back cleanly if the fan-out cannot be completed consistently
- Recommended reminder representation:
  - store enabled reminder offsets durably, for example `[7, 3, 1]`
  - derive durable, idempotent delivery jobs from that stored configuration rather than recomputing from UI state alone
  - mark reminder work with the active `deadlineVersion` so stale jobs can be suppressed safely
  - skip elapsed offsets deterministically and record that outcome instead of sending surprise catch-up reminders by default

### Timezone And Date Guidance

- The repo does not currently expose tenant timezone configuration, but FR-DL5 requires explicit timezone handling.
- Make timezone handling visible in UI and code. Avoid browser-local ambiguity.
- If the chosen implementation keeps using `Intl.DateTimeFormat`, always pass the intended `timeZone`.
- If Story 4.5 introduces a timezone utility library, do so deliberately; the current repo does not yet install `date-fns-tz`, so do not assume it already exists.
- Keep persisted timestamps canonical on the backend and render display labels from explicit timezone-aware helpers.
- Use that same explicit timezone when deriving `fiscalYearKey` for deadline records and selector behavior.
- Define countdown formatting tiers explicitly: days for multi-day windows, then hours/minutes once less than 24 hours remain.

### Reminder And Notification Guidance

- Immediate extension communication should reuse the existing Convex-to-NestJS email queue path.
- Approaching-deadline reminders should be scheduled durably and idempotently, ideally through the existing BullMQ plus Convex sync-event flow.
- Reminder saves that replace an older schedule must retire or suppress stale delayed jobs deterministically.
- Elapsed reminder offsets should be recorded as skipped unless product requirements later approve immediate catch-up sends with explicit copy.
- Keep in-app signals lightweight and dashboard-native:
  - PO dashboard can surface reminder state or recent extension banners
  - DU dashboard can surface a deadline-updated announcement using the same lightweight, timestamp-based truthfulness approach already used for budget-change announcements
- Avoid claiming synchronous email delivery success; queued feedback is acceptable and consistent with current bridge behavior.

### Validation And Error Guidance

- Reuse `ConvexError` for expected failures.
- Keep deterministic user-facing copy for:
  - deadline in the past
  - invalid date ordering
  - no active departments
  - no bootstrap fiscal-year available for first-time setup
  - missing timezone configuration or explicit fallback usage
  - elapsed reminder offset skipped
  - duplicate reminder scheduling prevented
  - queue or bridge failure
  - stale or unauthorized deadline update attempts
- Keep unexpected queue or bridge errors generic and recoverable; do not leak raw provider payloads, queue internals, or stack traces into the UI.
- Reset workspace loading state after both success and failure.

### Reuse And Anti-Reinvention Guidance

- Reuse the current PO dashboard modal-navigation helpers in `webapp/lib/procurement-officer/dashboard.ts`.
- Reuse form and dialog patterns from:
  - `webapp/src/components/procurement-officer/DepartmentFormDialog.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerAccessCodesWorkspace.tsx`
- Reuse current shared-deadline derivation helpers rather than copying the same "safe shared window" logic into a second helper tree.
- Extend the current fiscal-year selector logic carefully so first-time deadline setup and canonical deadline reads share one deterministic year-selection rule.
- Reuse the current queue and sync-event stack instead of inventing a direct reminder-sending service.
- Reuse DU deadline presentation helpers rather than creating a separate countdown card implementation.

### UX And Interaction Requirements

- Keep the workspace visually aligned with the existing Procurement Officer dashboard and tweakcn theme.
- The first usable deadline screen should answer:
  - what the current shared submission window is,
  - which fiscal year it applies to,
  - what timezone it uses,
  - how many departments will be affected,
  - which reminders are configured,
  - which configured reminder offsets will be skipped because they have already elapsed,
  - whether the next save is an initial setup or an extension.
- Use early warnings before blocking states, consistent with the UX spec's calm-through-clarity guidance around deadlines.
- Keep all deadline and reminder messaging explicit, visible, and operator-friendly.
- Respect the desktop-only platform strategy from the UX specification.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `react-hook-form` `^7.47.0`
  - `zod` `^3.22.4`
  - `resend` `^2.1.0`
  - `date-fns` `^2.30.0`
- Keep route files thin and secure authorization decisions in Convex near the data.
- Keep App Router conventions and the current `proxy.ts` pattern; do not reintroduce `middleware.ts`.
- Keep queue, delivery, and external-sync ownership on the server side.
- Account for the fact that the current NestJS queue abstraction does not yet expose delayed-job configuration or cancellation hooks, so Story 4.5 may need a small queue-service extension to schedule and supersede reminders safely.

### Library And Framework Requirements

- Next.js / React
  - Keep `/po/deadlines` as the stable route contract.
  - Keep interactive deadline editing in client components and route files thin.
- Convex / Convex Auth
  - Use `useQuery` for reactive workspace reads.
  - Keep deadline authorization in tenant-scoped Convex functions.
  - Keep indexed queries in declared field order.
- Forms and UI
  - Use RHF + Zod + shadcn/ui for deadline forms.
  - Use `sonner` for feedback.
- Email and queueing
  - Use the existing Convex action plus NestJS REST plus BullMQ pipeline.
  - Preserve idempotency semantics end-to-end.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/po/deadlines/page.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/convex/functions/accessCodes.ts`
  - `webapp/lib/procurement-officer/access-codes.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/convex/functions/departmentUserAuth.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/actions/email.ts`
  - `nestjs/src/email/dto/send-email.dto.ts`
  - `nestjs/src/email/template-renderer.service.ts`
  - `nestjs/src/email/email.service.ts`
  - `nestjs/src/queue/queue.service.ts`
- Expected new files (recommended):
  - `webapp/convex/functions/deadlines.ts`
  - `webapp/lib/procurement-officer/deadlines.ts`
  - `webapp/lib/validators/deadline.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDeadlinesWorkspace.tsx`
  - `webapp/tests/procurement-officer-deadlines.test.ts`
  - `nestjs/src/email/templates/deadline-reminder.template.ts`
  - `nestjs/src/email/templates/deadline-extension.template.ts`

### Git Intelligence Summary

- Commit `04a43d7` finished Story 4.3 with the house pattern of a focused domain backend, thin route contract, dashboard-mounted workspace, and deterministic tests. Story 4.5 should mirror that shape.
- Commit `ea7ac39` implemented access-code generation and reinforced the current style of server-owned queueing, idempotent delivery, and explicit partial-state handling.
- Commit `56988fe` from Story 4.2 established the current department and dashboard patterns that Story 4.5 must extend rather than bypass.
- Commit `13ce990` continued the repo pattern of keeping route files thin and domain rules in Convex helpers or focused component modules.

### Latest Tech Information

- Verified on March 27, 2026 against the live repo, official docs, and current package metadata:
  - the repo uses Next.js `^16.1.6`, while `npm view next version` returns `16.2.1`;
  - the repo uses Convex `^1.13.2`, while `npm view convex version` returns `1.34.1`;
  - the repo uses `@convex-dev/auth` `^0.0.90`, while `npm view @convex-dev/auth version` returns `0.0.91`;
  - the repo uses `react-hook-form` `^7.47.0`, while `npm view react-hook-form version` returns `7.72.0`;
  - the repo uses `zod` `^3.22.4`, while `npm view zod version` returns `4.3.6`;
  - the repo uses `resend` `^2.1.0`, while `npm view resend version` returns `6.9.4`;
  - `npm view date-fns-tz version` returns `3.2.0`, but the repo does not currently install it.
- Next.js authentication guidance still favors keeping authorization checks close to the data source, which supports keeping deadline authorization in Convex instead of route-only logic.
- Convex React docs still position `useQuery` as the reactive client primitive, so deadline workspaces and countdown views should stay on reactive reads rather than manual refetching.
- Convex indexing docs still require deliberate field-order-aware index usage, so deadline config and reminder lookup indexes need to be designed up front.
- Resend's send-email docs still document `Idempotency-Key`, with a 24-hour expiry and 256-character maximum, which matches the repo's current queue-and-sync idempotency direction for deadline reminders and extension emails.

### Testing Requirements

- Add pure tests for:
  - bootstrap fiscal-year selection when departments exist but no windows exist
  - deadline validation
  - timezone-aware fiscal-year derivation
  - timezone-aware display formatting
  - reminder-offset derivation
  - elapsed reminder offset skipping
  - extension detection
  - shared-window fan-out shaping
  - countdown sub-day formatting
- Add backend tests for:
  - first-time deadline save
  - extension flow
  - past-date rejection
  - invalid date ordering
  - no-active-department blocking
  - reminder scheduling dedupe
  - stale reminder suppression after deadline updates
  - unauthorized or stale-record access
  - audit-log writes
- Add dashboard regression tests proving:
  - PO deadline readiness updates reactively
  - DU countdowns stay truthful
  - access-code expiration defaults still reuse the safe shared deadline
- Add email and queue tests proving:
  - reminder and extension templates use the expected contract
  - idempotency keys prevent duplicate queueing
  - queue failures stay recoverable and sanitized

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - RHF + Zod + shadcn/ui for forms
  - append-only audit patterns
  - desktop-first UX
- Where `_bmad-output/project-context.md` or older architecture notes conflict with the live repo, prefer the live repo structure and installed package versions.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 4 Source](../epic-04-po-department-catalog.md)
- [Story 4.1 Reference](./4-1-po-dashboard-onboarding-wizard.md)
- [Story 4.2 Reference](./4-2-department-crud-operations.md)
- [Story 4.3 Reference](./4-3-access-code-generation-management.md)
- [Story 1.8 Reference](../../epic1/completed/1-8-du-access-code-authentication.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [PO Deadlines Route](../../../../../webapp/app/(app)/po/deadlines/page.tsx)
- [PO Dashboard](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [PO Dashboard Helpers](../../../../../webapp/lib/procurement-officer/dashboard.ts)
- [PO Dashboard Snapshot Builder](../../../../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
- [PO Dashboard Query](../../../../../webapp/convex/functions/procurementOfficerDashboard.ts)
- [Access-Code Helpers](../../../../../webapp/lib/procurement-officer/access-codes.ts)
- [Access-Code Backend](../../../../../webapp/convex/functions/accessCodes.ts)
- [DU Access Helpers](../../../../../webapp/lib/auth/department-user-access.ts)
- [DU Dashboard Helpers](../../../../../webapp/lib/department-user/dashboard.ts)
- [DU Dashboard Query](../../../../../webapp/convex/functions/departmentUserDashboard.ts)
- [DU Auth Backend](../../../../../webapp/convex/functions/departmentUserAuth.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Email Action](../../../../../webapp/convex/actions/email.ts)
- [External Sync Events](../../../../../webapp/convex/functions/externalServices.ts)
- [NestJS Email Service](../../../../../nestjs/src/email/email.service.ts)
- [NestJS Email DTO](../../../../../nestjs/src/email/dto/send-email.dto.ts)
- [NestJS Queue Service](../../../../../nestjs/src/queue/queue.service.ts)
- [Queue Processor](../../../../../nestjs/src/queue/platform-queue.processor.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Next.js Page File Convention](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Convex Indexing Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [Resend Send Email API Docs](https://resend.com/docs/api-reference/emails/send-email)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story source: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-5-submission-deadline-management.md`
- Primary implementation sources:
  - `webapp/app/(app)/po/deadlines/page.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/lib/procurement-officer/access-codes.ts`
  - `webapp/convex/functions/accessCodes.ts`
  - `webapp/lib/auth/department-user-access.ts`
  - `webapp/lib/department-user/dashboard.ts`
  - `webapp/convex/functions/departmentUserAuth.ts`
  - `webapp/convex/functions/departmentUserDashboard.ts`
  - `webapp/convex/schema.ts`
  - `webapp/convex/actions/email.ts`
  - `nestjs/src/email/email.service.ts`
  - `nestjs/src/email/dto/send-email.dto.ts`
  - `nestjs/src/queue/queue.service.ts`
  - `nestjs/src/queue/platform-queue.processor.ts`

### Completion Notes List

- 2026-03-27: Added a canonical `submissionDeadlines` model plus reminder-job tracking, tenant timezone support, guarded deadline updates, and department-window fan-out in `webapp/convex/functions/deadlines.ts` and `webapp/convex/schema.ts`.
- 2026-03-27: Replaced the PO deadline placeholder with a real `/po` modal workspace, added timezone-aware fiscal-year bootstrap and preview helpers, and wired live countdown updates into both PO and DU dashboards.
- 2026-03-27: Extended the Convex-to-NestJS email pipeline with delayed reminder scheduling, reminder cancellation, and new deadline reminder/extension templates while keeping queue behavior idempotent.
- 2026-03-27: Added deadline helper regressions plus dashboard and email/queue coverage; `webapp` and `nestjs` test/lint suites passed, while direct Convex mutation harness coverage for deadline save flows remains a follow-up gap.

### File List

- `webapp/convex/functions/deadlines.ts`
- `webapp/convex/schema.ts`
- `webapp/convex/actions/email.ts`
- `webapp/convex/functions/accessCodes.ts`
- `webapp/convex/functions/departmentUserAuth.ts`
- `webapp/convex/functions/departmentUserDashboard.ts`
- `webapp/convex/functions/procurementOfficerDashboard.ts`
- `webapp/convex/_generated/api.d.ts`
- `webapp/lib/procurement-officer/deadlines.ts`
- `webapp/lib/procurement-officer/dashboard.ts`
- `webapp/lib/procurement-officer/dashboard-snapshot.ts`
- `webapp/lib/procurement-officer/access-codes.ts`
- `webapp/lib/validators/deadline.ts`
- `webapp/lib/department-user/dashboard.ts`
- `webapp/lib/department-user/dashboard-snapshot.ts`
- `webapp/lib/auth/department-user-access.ts`
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerDeadlinesWorkspace.tsx`
- `webapp/src/components/department-user/DepartmentUserDashboard.tsx`
- `webapp/tests/procurement-officer-deadlines.test.ts`
- `webapp/tests/procurement-officer-dashboard.test.ts`
- `webapp/tests/department-user-dashboard.test.ts`
- `webapp/tests/run-tests.ts`
- `nestjs/src/email/dto/send-email.dto.ts`
- `nestjs/src/email/email.controller.ts`
- `nestjs/src/email/email.service.ts`
- `nestjs/src/email/template-renderer.service.ts`
- `nestjs/src/email/templates/deadline-extension.template.ts`
- `nestjs/src/email/templates/deadline-reminder.template.ts`
- `nestjs/src/queue/queue.service.ts`
- `nestjs/test/email-template-renderer.service.spec.ts`
- `nestjs/test/email.service.spec.ts`
- `nestjs/test/queue.service.spec.ts`
- `_bmad-output/implementation-artifacts/epics/epic4/stories/4-5-submission-deadline-management.md`

### Change Log

- 2026-03-27: Implemented canonical submission deadline management, fiscal-year bootstrap, reminder scheduling/cancellation, timezone-aware countdowns, and PO/DU dashboard integration for Story 4.5.
- 2026-03-27: Added deadline-specific helper, dashboard, and NestJS queue/email tests and revalidated the `webapp` and `nestjs` lint/test suites.
- 2026-03-27: Senior developer review requested changes for reminder-job authorization, retry/idempotency handling, stale-reminder cancellation safety, DU fiscal-year derivation, and queue-failure surfacing.
- 2026-03-27: Fixed all senior-review findings by making deadline saves idempotent, adding stale-reminder dispatch suppression, locking reminder mutations behind internal APIs, surfacing queue warnings in the PO workspace, and revalidating both test suites.
- 2026-03-29: Marked Story 4.5 done after final validation, including automated test suites and a Playwright browser check of the live deadline workspace and no-op save behavior.

### Senior Developer Review (AI)

- Reviewer: Codex
- Date: 2026-03-27
- Outcome: Passed After Fixes
- Summary: Review findings were addressed with internal-only reminder mutations, no-op save idempotency, dispatch-time stale-reminder suppression, tenant-aware DU fiscal-year derivation, and warning surfacing for queue failures.
- Findings:
  - Resolved: Reminder-job status writes now flow through internal-only mutations and protected service endpoints.
  - Resolved: Unchanged saves now return without incrementing versions or recreating reminder work.
  - Resolved: Superseded reminders are only marked cancelled after confirmed queue removal, and reminder dispatch is guarded by the latest deadline version before send.
  - Resolved: DU dashboards now derive fiscal years and announcements using the tenant-configured fiscal-year start month and deadline timezone.
  - Resolved: Partial queue failures now return warning counts to the PO workspace instead of being swallowed behind a success toast.
- Validation:
  - `pnpm --dir webapp test`
  - `pnpm --dir nestjs test -- --runInBand`

### Story Completion Status

- Story ID: `4.5`
- Story Key: `4-5-submission-deadline-management`
- Output File: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-5-submission-deadline-management.md`
- Final Status: `done`
- Completion Note: `Implemented, fixed, and validated end-to-end enough to close the story, including passing webapp/NestJS test suites and a Playwright browser verification of the live deadline workflow.`
