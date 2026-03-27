# Story 4.3: Access Code Generation & Management

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Procurement Officer,
I want to manage, rotate, deactivate, and distribute the canonical department codes that Departmental Users use to sign in,
so that Departmental Users can enter the planning workflow securely while the repo treats `department code` and `access code` as the same business value and uses one shared code-generation algorithm.

## Acceptance Criteria

1. [Given] a Procurement Officer opens `/po/access-codes` [When] the current protected PO workspace resolves through the existing dashboard-modal contract [Then] the route renders a real access-code management workspace instead of the current coverage-only placeholder cards [And] it keeps `/po` as the canonical Procurement Officer shell (FR26, FR28).
2. [Given] Story 4.2 currently generates legacy department codes from department-name tokens, for example `Computer Science 2025 tyroon` becoming `CS2T` [When] Story 4.3 lands [Then] it removes that old generation logic from the create-department flow and any related shared helpers [And] it replaces it with one canonical generator that outputs the exact repo-wide format `[FiscalYear]-[DeptInitials]-[RandomChars]`, for example `2025-CS-A7K9` [And] that same plaintext value becomes the department's canonical `code` and the DU login/access code (FR26, FR26h).
3. [Given] a department already has one or more active codes [When] the Procurement Officer regenerates or rotates the code [Then] all previously active codes for that department are invalidated before the new code becomes usable [And] the UI shows a destructive confirmation that the old code stops working immediately (FR26b).
4. [Given] the tenant currently has a safe shared submission deadline derived from live department windows [When] the access-code generation dialog opens [Then] the expiration field defaults to that live shared deadline [And] the Procurement Officer can still override it with a custom future expiration [And] the backend revalidates on submit that the chosen expiration is still in the future before issuing the code (FR26c plus Story 4.1/4.2 deadline derivation rules).
5. [Given] Story 4.5 has not yet configured a safe shared submission deadline [When] the access-code generation dialog opens [Then] the UI stays honest that no default expiration can be derived from live deadline data [And] it requires an explicit future expiration instead of fabricating or silently writing submission-window values (FR26c, FR-DL1 through FR-DL6 scope boundary).
6. [Given] multiple active departments do not currently have a valid active code [When] the Procurement Officer triggers `Bulk Generate Codes` [Then] the system fills those missing codes in one guarded flow by reusing the same canonical generator that replaced the old Story 4.2 logic [And] each generated value follows `[FiscalYear]-[DeptInitials]-[RandomChars]`, for example `2025-CS-A7K9` style [And] it returns a department-by-department summary that distinguishes success, skip, and failure outcomes [And] it does not silently rotate departments that already have active codes unless the user explicitly confirms that broader scope [And] when zero eligible departments remain the UI shows an honest no-op summary instead of a misleading success or generic failure (FR26d).
7. [Given] the Procurement Officer wants to email a code to a Departmental User [When] the live repo does not yet guarantee a pre-linked DU directory for every department [Then] the send flow accepts a validated recipient email and may optionally surface already-known department-user emails for convenience [And] it does not pretend every department already has a required DU assignment record [And] it blocks known incompatible or role-collision email targets that the existing DU auth rules would later reject (FR26e plus current repo reality).
8. [Given] the Procurement Officer sends an access code by email [When] the request succeeds [Then] delivery is queued through the existing Convex-to-NestJS email bridge with a deterministic idempotency key [And] the email includes the department name, access code, expiration, and the current DU login URL [And] the backend revalidates that the referenced code is still the current active usable code before queueing delivery [And] the UI shows safe queued or sent feedback instead of implying synchronous SMTP completion (FR26e).
9. [Given] the email bridge, queue, or downstream template rendering fails [When] the Procurement Officer sends a code [Then] the code-management UI resets loading state, keeps the generated code state consistent, and surfaces a sanitized recoverable error without duplicating code issuance or silently sending multiple emails.
10. [Given] the Procurement Officer views the access-code workspace [When] departments already have current or historical code records [Then] the list shows truthful live state per department, including at minimum active or missing coverage, the canonical department/access code value or an agreed masked treatment, expiration, issued or rotated timestamps, delivery status if known, and last-activity summary [And] the workspace must not invent a second plaintext access-code column that can drift from `departments.code`.
11. [Given] the Procurement Officer needs to copy a code [When] the canonical department/access code is visible in the create or management surface [Then] the UI copies that same value to the clipboard and shows `Copied!` feedback [And] the implementation must not persist an extra duplicate plaintext access-code field just to support convenience copy actions (FR26i plus the shared-code product decision).
12. [Given] the Procurement Officer manually deactivates a code [When] the mutation succeeds [Then] the code becomes unusable for DU sign-in immediately [And] the access-code workspace plus the existing dashboard coverage metrics refresh reactively through Convex without a manual page reload (FR26g, FR28i).
13. [Given] a Departmental User attempts sign-in after Story 4.3 lands [When] they use an active, expired, deactivated, or rotated code [Then] the existing DU auth rules from Story 1.8 still enforce lockout, tenant isolation, submission-window gating, and role-collision protections [And] Story 4.3 must not create a parallel DU access-validation path.
14. [Given] the Procurement Officer opens access-code details for a department [When] login attempts have been recorded against a real access code [Then] the system shows append-only login history with truthful date and time, success or failure outcome, and request-origin details such as IP address when those headers were safely captured [And] any missing request-origin value is displayed honestly as unavailable instead of being fabricated [And] the history view is paginated or otherwise bounded so large event volumes do not force unbounded renders (FR26f).
15. [Given] Story 4.3 needs request-origin metadata for login history [When] the public DU route captures request context [Then] it uses the existing signed-request-context pattern already proven in platform-admin security flows or an equally server-signed approach [And] backend history records never trust raw browser-supplied IP or user-agent strings without signature verification [And] an expired or missing request-context token degrades to truthful `origin unavailable` logging instead of blocking an otherwise valid DU auth flow.
16. [Given] the Procurement Officer opens the workspace for a deleted, archived, foreign-tenant, or no-longer-authorized department [When] they attempt generate, bulk generate, email, rotate, or deactivate actions [Then] the backend fails closed with deterministic `NOT_FOUND`, `FORBIDDEN`, or `UNAUTHORIZED` style contracts [And] the UI closes stale state or redirects through the repo's existing protected-app recovery path instead of pretending the mutation succeeded.
17. [Given] the user double-clicks, retries quickly, or refreshes after network delay [When] generation, rotation, deactivation, bulk generation, or email delivery is already pending [Then] duplicate submissions are prevented client-side [And] server-side logic remains idempotent enough to avoid duplicate active codes or duplicate outbound emails from rapid retries.
18. [Given] access-code generation, rotation, deactivation, or delivery changes system state [When] those mutations complete [Then] append-only audit events are written using the existing audit helper conventions [And] the access-code-specific history model remains separate from but consistent with the broader audit trail (NFR-S9, FR26b, FR26e, FR26g).

## Tasks / Subtasks

- [x] Task 1: Add a dedicated access-code domain backend and reconcile the current schema with Story 4.3 scope (AC: 2-6, 10-18)
  - [x] Create a focused Convex module such as `webapp/convex/functions/accessCodes.ts` for list, rotate, deactivate, resend, and bulk-fill operations instead of stuffing that behavior into the dashboard snapshot or department CRUD modules.
  - [x] Remove the current legacy department-code generator that compresses department-name tokens into outputs such as `CS2T`, and replace it with one documented shared generator that always emits `[FiscalYear]-[DeptInitials]-[RandomChars]`, for example `2025-CS-A7K9`.
  - [x] Keep `departments.code` and the DU-auth hash pipeline synchronized because product now treats them as the same canonical code rather than two different identifiers.
  - [x] Extend `webapp/convex/schema.ts` so `departmentAccessCodes` can carry operator-facing metadata needed for Story 4.3, such as issuer tracking, revocation metadata, and last-delivery metadata, without storing plaintext codes.
  - [x] Add a new append-only history table such as `departmentAccessCodeEvents` for per-code usage tracking, with fields like `tenantId`, `departmentId`, `accessCodeId`, `event`, `outcome`, `occurredAt`, optional request-origin metadata, and any safe actor or email hints needed for PO review.
  - [x] Lift or reuse the existing generation and rotation logic already present in `webapp/convex/seedData.ts` and `webapp/convex/functions/departmentUserAuth.ts` so Story 4.3 extends one canonical hash and normalization pipeline instead of inventing a second one.
  - [x] Keep code persistence hash-only by reusing `normalizeDepartmentUserAccessCode(...)`, `hashDepartmentUserAccessCode(...)`, and `getDepartmentUserAccessCodeSuffix(...)` from `webapp/lib/auth/department-user-access.ts`.
  - [x] Make bulk generation deterministic under partial-failure conditions by returning per-department success, skip, and failure results, and by defining the no-eligible-departments path explicitly.
  - [x] Enforce all PO-side mutations with `requireTenantRole(ctx, ["procurement_officer"])` and tenant-scoped reads or indexes.

- [x] Task 2: Build the Procurement Officer access-code workspace inside the current `/po` information architecture (AC: 1, 4-12, 16-17)
  - [x] Replace the current access-code placeholder content inside `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` with a real workspace component such as `webapp/src/components/procurement-officer/ProcurementOfficerAccessCodesWorkspace.tsx`.
  - [x] Keep `webapp/app/(app)/po/access-codes/page.tsx` thin and preserve the current modal-backed navigation contract from `resolveProcurementOfficerWorkspaceNavigation(...)`.
  - [x] Patch the existing create-department modal from Story 4.2 so its `Generate` and `Email` actions call the new canonical generator instead of the old `CS2T`-style logic.
  - [x] Reuse the same canonical code language and value already exposed in the create-department flow so the `/po/departments` and `/po/access-codes` surfaces are visibly managing the same thing.
  - [x] Add a rotate or regenerate dialog that uses the repo-standard `react-hook-form` + Zod + shadcn/ui pattern already used in Story 4.2 dialog components, and ensure any missing-code repair path reuses the same new shared generator.
  - [x] Revalidate on submit that any defaulted or manually entered expiration is still a future timestamp, even if the dialog has been open across clock time or data refreshes.
  - [x] Add an explicit reveal or copy surface that only shows plaintext immediately after generation or rotation, and a masked list view for all later renders.
  - [x] Add guarded actions for bulk generation, send-by-email, and manual deactivation using the current tweakcn dashboard language, `lucide-react` icons, and `sonner` feedback patterns.
  - [x] Surface honest partial-success, no-eligible-target, stale-code, and incompatible-recipient states so operators can recover without guessing what happened.
  - [x] Keep the workspace desktop-first and aligned with the current PO dashboard instead of creating a second page design language.

- [x] Task 3: Integrate request-context capture and DU auth history without forking the current DU sign-in system (AC: 13-15, 18)
  - [x] Add a signed request-context helper for DU access, patterned after `webapp/lib/platform-admin/request-context.ts` and `webapp/lib/platform-admin/request-context-token.ts`, so request-origin metadata can be captured from Next.js headers safely.
  - [x] Thread that signed request-context token through `webapp/app/access/department-user/page.tsx`, `webapp/src/components/auth/DepartmentUserAccessForm.tsx`, `webapp/convex/auth.ts`, and `webapp/convex/functions/departmentUserAuth.ts` for both challenge start and verify steps where needed.
  - [x] Record per-code history events from the existing DU auth flow for successful verification and for code-specific deny paths such as expired, deactivated, locked, or out-of-window attempts when an actual access code record is known.
  - [x] Treat expired, missing, or unverifiable request-context tokens as a logging degradation path rather than an auth blocker, and persist a truthful `origin unavailable` state when signed metadata cannot be trusted.
  - [x] Bound PO login-history reads with explicit pagination or limits from the first implementation so high-volume departments stay reviewable.
  - [x] Preserve Story 1.8 lockout, collision, deadline, and tenant-isolation behavior exactly; Story 4.3 may extend logging and PO observability, but it must not replace the DU auth authority.

- [x] Task 4: Reuse the current Convex-to-NestJS email bridge for access-code delivery instead of bypassing it (AC: 7-9, 18)
  - [x] Extend `webapp/convex/actions/email.ts` and the NestJS email DTO or renderer path so access-code delivery uses the existing service-JWT bridge, queueing, and idempotency architecture.
  - [x] Add or extend a NestJS email template under `nestjs/src/email/templates/` that is specific enough for access-code delivery, including the department name, expiration, and DU login CTA.
  - [x] Keep the delivery call server-owned through Convex actions and NestJS; do not send access-code emails directly from the browser.
  - [x] Reject send attempts for stale, rotated, expired, deactivated, or otherwise no-longer-current codes before queueing email, even if the UI is still showing an older reveal state.
  - [x] Reuse existing incompatible-email and role-collision checks where available so known-undeliverable sign-in targets are blocked before the bridge call.
  - [x] Reuse the existing external-service error contract and audit bridge patterns so bridge failures are deterministic, sanitized, and safe to retry.

- [x] Task 5: Add deterministic regression coverage for generation rules, email delivery, history logging, and reactive dashboard updates (AC: 1-18)
  - [x] Add pure tests for access-code format generation, suffix masking, fiscal-year resolution, expiration-default derivation, deadline-missing fallback behavior, and bulk-generation selection rules.
  - [x] Add backend tests for generate, rotate, duplicate active-code invalidation, manual deactivation, bulk generation, zero-eligible bulk requests, partial-failure bulk summaries, unauthorized or foreign-tenant access, stale-code email rejection, incompatible-recipient rejection, and audit-log writes.
  - [x] Add DU auth regression tests proving Story 4.3 request-context and history additions do not break the existing access-code sign-in, lockout, or deadline-window behavior, and that expired request-context tokens degrade gracefully to missing-origin history instead of failing valid auth.
  - [x] Add PO dashboard or workspace tests proving access-code coverage updates reactively after generate, deactivate, and rotate actions.
  - [x] Add email-bridge tests across `webapp/convex/actions/email.ts` and the NestJS email module so template selection, idempotency, stale-code rejection, and queueing stay deterministic.
  - [x] Update `webapp/tests/run-tests.ts` and any NestJS test registration needed so the new guardrail coverage runs in the standard suites.

## Dev Notes

### Story Foundation

- Epic 4 defines Story 4.3 as the department-level DU code-management and generator-replacement story that sits directly after Department CRUD and before Deadline Management.
- The live repo already has department-scoped DU authentication from Story 1.8, but it still lacks a Procurement Officer management surface for rotating, emailing, deactivating, bulk-filling missing codes, reviewing those codes, and replacing the current legacy create-modal generator.
- The implementation goal is not to reinvent DU auth. The goal is to expose a secure PO-side operator workflow on top of the already-shipped hash-based DU auth system while honoring the product clarification that the department code and DU access code are the same canonical value.

### Previous Story Intelligence

- Story 4.2 already established `/po` as the canonical Procurement Officer workspace and reserved `/po/access-codes` as a modal-backed destination inside the current dashboard flow.
- Story 4.2 already introduced the create-department modal UI, `Admin Email`, and `Generate` to `Email` affordance, but its current generation logic is the legacy implementation Story 4.3 must remove.
- Story 4.3 owns the replacement generator, and both the create-department modal and the dedicated access-code workspace must use that exact same code-generation style: `[FiscalYear]-[DeptInitials]-[RandomChars]` such as `2025-CS-A7K9`.
- Story 4.2 also made `submissionStartsAt` and `submissionEndsAt` optional, which means Story 4.3 must be honest when deadline-derived defaults are not safe yet.
- Story 1.8 already established the current DU auth pipeline around normalized access-code hashing. Under the updated product decision, Story 4.3 must hash the same canonical department code value DU auth accepts and must not create a second divergent plaintext access-code record.
- Story 1.8 also already owns DU access validation, collision handling, lockout rules, and submission-window gating. Story 4.3 must build around those guarantees, not fork them.
- Story 4.1 already made dashboard access-code coverage a live readiness metric. Story 4.3 should extend that existing read model rather than creating a second contradictory coverage system.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/po/access-codes/page.tsx` currently only redirects into the dashboard modal contract.
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx` currently shows access-code coverage as a placeholder summary, not a real management workspace.
- `webapp/convex/schema.ts` already includes:
  - `departments`
  - `departmentAccessCodes`
  - `departmentUserProfiles`
  - `departmentUserLoginAttempts`
  - `departmentUserAuthChallenges`
  - `auditLogs`
- The current `departmentAccessCodes` table stores only `tenantId`, `departmentId`, `codeHash`, `codeSuffix`, `expiresAt`, `isActive`, and timestamps. It does not yet store PO-facing issuance or revocation metadata, delivery metadata, or per-code login history.
- The product direction for this repo is now explicit: `departments.code` and the DU access code are the same business value, so any generation or rotation flow must update the canonical department code and the auth hash together.
- The currently implemented create-modal generator is the old token-compression logic that can produce values such as `CS2T`; Story 4.3 must remove that logic and replace it everywhere with the new canonical format.
- The story now also requires one explicit fiscal-year derivation rule for canonical code prefixes so implementations do not disagree during tenant-specific or year-boundary generation windows.
- `webapp/convex/functions/departmentUserAuth.ts` already performs normalized code lookup, expiration checks, tenant status checks, submission-window gating, lockout handling, OTP challenge creation, and audit logging for the DU path.
- `webapp/convex/seedData.ts` already contains a narrow helper, `issueDepartmentAccessCodeForEmail`, that rotates existing active codes for a department and returns the plaintext code once. Story 4.3 should lift that logic into production ownership rather than duplicating it.
- `webapp/convex/actions/email.ts` plus `webapp/convex/actions/_helpers.ts` already provide a Convex-to-NestJS service bridge with JWT auth and idempotent queueing.
- `nestjs/src/email/` already exists, but its template contract currently only supports `generic-notification` and `billing-support`. Access-code delivery likely needs a dedicated template or explicit extension of that existing union.
- `webapp/lib/platform-admin/request-context.ts` and `webapp/lib/platform-admin/request-context-token.ts` already show a safe signed-header pattern for capturing IP and user-agent data from Next.js server components. Story 4.3 can reuse that approach for DU login-history capture.
- `departmentUserProfiles` are created or reused after successful DU auth; they are not a guaranteed department-by-department invitation directory today. Email-delivery UX must reflect that truth.

### Critical Implementation Traps

- Do not let `departments.code` and the DU-auth hash drift apart by generating or rotating only one side of the shared code.
- Do not keep the old token-compression generator that emits values like `CS2T`.
- Do not invent a second code format or a second generation algorithm after replacing the legacy logic; all flows must converge on `2025-CS-A7K9` style output.
- Do not store raw access codes in `departmentAccessCodes` just to make later re-copy convenient.
- Do not replace or bypass `webapp/convex/functions/departmentUserAuth.ts` with a new PO-owned sign-in validator.
- Do not fabricate a deadline-derived default expiration if Story 4.5 has not yet produced a safe shared deadline.
- Do not trust a default expiration chosen when the dialog opened; revalidate it when the mutation is submitted.
- Do not treat `departmentUserProfiles` as the only valid email-delivery source for FR26e; some departments may need a manually entered recipient email.
- Do not queue delivery for a code that has gone stale, rotated, expired, or been deactivated after the reveal surface rendered.
- Do not treat an expired DU request-context token as grounds to reject an otherwise valid login if the auth path can proceed without trusted origin metadata.
- Do not send access-code emails directly from the browser or by copy-pasting direct Resend calls into the PO workspace.
- Do not silently bulk-rotate every department when the safer initial scope is uncovered departments or explicitly confirmed selections.
- Do not leave bulk-generate behavior ambiguous when zero departments are eligible or when only part of the batch succeeds.
- Do not weaken Story 4.1 dashboard reactivity by introducing a separate local-only access-code cache that drifts from Convex.

### Recommended Implementation Shape

- Keep `/po/access-codes` as the canonical entry, but render the real workflow inside the existing dashboard modal contract unless a concrete blocker appears.
- Add a dedicated domain backend module such as `webapp/convex/functions/accessCodes.ts` and a shared UI helper module such as `webapp/lib/procurement-officer/access-codes.ts`.
- Add a workspace component such as `webapp/src/components/procurement-officer/ProcurementOfficerAccessCodesWorkspace.tsx` with focused dialogs for rotate, deactivate, bulk-fill missing codes, and send-by-email.
- Extract the canonical generator into a shared helper and replace the old Story 4.2 create-modal implementation with it so every flow produces the exact same `[FiscalYear]-[DeptInitials]-[RandomChars]` output.
- Treat the canonical department code as the shared business value and keep the auth-side representation hash-based; do not add a second plaintext access-code store just because the department record already has the visible code.
- Model login history explicitly with a dedicated append-only table instead of overloading generic audit-log queries for every PO workspace render.
- Capture request-origin data through a signed Next.js server-side token, then verify that token in Convex before writing access-code history.
- Reuse the existing email bridge and NestJS templates so Story 4.3 extends the shared external-service architecture already present in the repo.

### Data Model Guidance

- Recommended `departmentAccessCodes` additions:
  - `issuedByTenantUserId`
  - `revokedAt?`
  - `revokedByTenantUserId?`
  - `lastDeliveredAt?`
  - `lastDeliveredToEmail?`
  - `lastDeliveredMessageId?`
- Shared-code synchronization rule:
  - any generate or rotate mutation updates the canonical `departments.code`
  - the same plaintext is normalized and hashed into the DU auth tables
  - no second human-facing access-code value should exist for the same department
- Canonical format rule:
  - every generated or rotated code must use `[FiscalYear]-[DeptInitials]-[RandomChars]`
  - example shape: `2025-CS-A7K9`
  - no alternate prefixes, separators, or suffix patterns are allowed
- Recommended shared helper input:
  - a single fiscal-year resolver used by generate and bulk-generate mutations
- Recommended new append-only table:
  - `departmentAccessCodeEvents`
  - Candidate fields:
    - `tenantId`
    - `departmentId`
    - `accessCodeId`
    - `event`
    - `outcome`
    - `normalizedEmail?`
    - `ipAddress?`
    - `ipCountry?`
    - `userAgent?`
    - `occurredAt`
- Keep `codeHash` and `codeSuffix` in auth-side storage; the only plaintext business code should be the canonical department `code` value already shared with the PO workflows.
- If a future product decision absolutely requires later plaintext re-view after refresh, that must use a deliberate encrypted-at-rest design with secret rotation and explicit review. Do not downgrade to plaintext persistence as a convenience shortcut in this story.

### Email Delivery Guidance

- Preferred path: extend `webapp/convex/actions/email.ts` and the NestJS email template union rather than adding another direct-Resend code path.
- Reuse service-JWT auth from `webapp/lib/services/procureline-service-auth.ts` and bridge request construction from `webapp/lib/services/external-service-client.ts`.
- Use deterministic idempotency keys per send request so retries do not create duplicate queue jobs or duplicate emails.
- Include the department name, expiration, access code, and DU login URL in the email content.
- Revalidate that the code being sent is still the active usable record for the department immediately before queueing the email.
- Block known incompatible or role-collision recipient emails before enqueueing delivery when the repo can already detect that incompatibility.
- Keep delivery feedback honest: queued or sent-to-queue is acceptable; synchronous inbox confirmation is not.

### Login History Guidance

- FR26f requires truthful date/time, success/failure, and IP-style origin details per code. The current repo does not persist those records yet.
- Reuse the signed request-context pattern already proven for platform-admin flows so DU sign-in can contribute safe history metadata without trusting unsigned client input.
- If the signed token is expired, missing, or unverifiable by the time verify runs, log the event without trusted origin details instead of turning that logging gap into an authentication outage.
- History should be per access code and append-only. Avoid overwriting a single `lastLogin` field as the sole source of truth.
- History reads should be paginated or otherwise bounded; do not require unbounded event fetches to open department details.
- Only record per-code failures when the backend can resolve an actual access-code record. Fully invalid unknown-code attempts may remain audit-only rather than pretending they belong to a real code.

### Validation And Error Guidance

- Reuse `ConvexError` for expected failures and keep PO-facing messages deterministic.
- Keep user-facing copy explicit for:
  - not found or stale record conditions
  - unauthorized access recovery
  - deadline-default unavailability
  - email bridge or queue failure
  - stale-code email rejection
  - incompatible recipient rejection
  - manual deactivation success
  - no-eligible bulk generation
  - partial bulk-generation results
  - bulk-generation summaries
- Keep unexpected backend and bridge failures generic and recoverable; do not leak stack traces, service tokens, or raw provider responses into the UI.
- Reset loading states after both success and failure. A failed generation, rotation, or send action must never leave the access-code workspace permanently disabled.

### Reuse And Anti-Reinvention Guidance

- Reuse `normalizeDepartmentUserAccessCode`, `hashDepartmentUserAccessCode`, and `getDepartmentUserAccessCodeSuffix` from `webapp/lib/auth/department-user-access.ts`.
- Reuse the create-department code-generation and email-entry patterns from Story 4.2 so the PO does not see two competing code concepts.
- Reuse the current dashboard modal-navigation helpers in `webapp/lib/procurement-officer/dashboard.ts`.
- Reuse Story 4.2 dialog patterns from:
  - `webapp/src/components/procurement-officer/DepartmentFormDialog.tsx`
  - `webapp/src/components/procurement-officer/DeleteDepartmentDialog.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDepartmentsWorkspace.tsx`
- Reuse the current external-service bridge and NestJS email module instead of making Story 4.3 another one-off email stack.
- Reuse existing audit helpers in `webapp/convex/functions/_audit.ts` and event naming conventions from `webapp/lib/security/audit.ts`.

### UX And Interaction Requirements

- Keep the access-code workspace visually aligned with the current Procurement Officer dashboard, tweakcn theme, and shadcn/ui primitives.
- The first usable access-code screen should answer:
  - which departments have valid active coverage,
  - which departments still need a code,
  - which codes are expired or deactivated,
  - whether the deadline-derived default expiration is safe,
  - what the PO should do next.
- Use explicit confirmation before rotate or deactivate actions.
- Use `sonner` toasts or equivalent repo-standard feedback for generate, rotate, deactivate, and email actions.
- Keep the experience desktop-first; do not add a fake mobile CRUD surface that contradicts the UX specification.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `react-hook-form` `^7.47.0`
  - `zod` `^3.22.4`
  - `resend` `^2.1.0`
- Keep page files thin and put interactive state in client components.
- Keep secure authorization and persistence decisions in Convex near the data.
- Keep App Router conventions and the current `proxy.ts` pattern; do not reintroduce `middleware.ts`.
- Keep external-service calls in Convex actions or NestJS modules, not in React components.

### Library And Framework Requirements

- Next.js / React
  - Keep `/po/access-codes` and `/access/department-user` as the stable route contracts.
  - Use server components to read signed request context, then pass only the token into client components.
- Convex / Convex Auth
  - Use `useQuery` for reactive workspace data.
  - Keep `departmentUserAuth.ts` as the DU auth authority.
  - Use explicit indexes for tenant, department, and access-code history lookups.
- Forms and UI
  - Use RHF + Zod + shadcn/ui dialogs and forms.
  - Use `lucide-react` icons and `sonner` for feedback.
- Email bridge
  - Use the existing Convex action + NestJS REST + service JWT path.
  - Respect idempotent send semantics all the way through the bridge.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/po/access-codes/page.tsx`
  - `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
  - `webapp/lib/procurement-officer/dashboard.ts`
  - `webapp/lib/procurement-officer/dashboard-snapshot.ts`
  - `webapp/convex/functions/procurementOfficerDashboard.ts`
  - `webapp/convex/functions/departmentUserAuth.ts`
  - `webapp/convex/auth.ts`
  - `webapp/app/access/department-user/page.tsx`
  - `webapp/src/components/auth/DepartmentUserAccessForm.tsx`
  - `webapp/convex/schema.ts`
  - `webapp/convex/actions/email.ts`
  - `webapp/lib/security/audit.ts`
  - `nestjs/src/email/dto/send-email.dto.ts`
  - `nestjs/src/email/template-renderer.service.ts`
- Expected new files (recommended):
  - `webapp/convex/functions/accessCodes.ts`
  - `webapp/lib/procurement-officer/access-codes.ts`
  - `webapp/lib/auth/department-user-request-context.ts`
  - `webapp/lib/auth/department-user-request-context-token.ts`
  - `webapp/src/components/procurement-officer/ProcurementOfficerAccessCodesWorkspace.tsx`
  - `webapp/src/components/procurement-officer/GenerateAccessCodeDialog.tsx`
  - `webapp/src/components/procurement-officer/DeactivateAccessCodeDialog.tsx`
  - `webapp/tests/procurement-officer-access-codes.test.ts`
  - `nestjs/src/email/templates/access-code-delivery.template.ts`

### Git Intelligence Summary

- Commit `56988fe` added the Story 4.2 department-management backend, workspace dialogs, validation helpers, and deterministic tests. Story 4.3 should mirror that pattern: focused domain backend, thin route, dashboard modal workspace, and pure helper tests.
- Commit `13ce990` completed Story 3.3 and reinforced the current house style of thin routes, deterministic tests, and backend-owned validation logic.
- Commit `3b5d1bc` established invitation-management rigor around validation, resend behavior, and access recovery. Story 4.3 should bring the same seriousness to access-code rotation and delivery paths.

### Latest Tech Information

- Verified on March 26, 2026 against official docs and live package metadata:
  - the repo uses Next.js `^16.1.6`, while `npm view next version` returns `16.2.1`;
  - the repo uses Convex `^1.13.2`, while `npm view convex version` returns `1.34.0`;
  - the repo uses `@convex-dev/auth` `^0.0.90`, while `npm view @convex-dev/auth version` returns `0.0.91`;
  - the repo uses `react-hook-form` `^7.47.0`, while `npm view react-hook-form version` returns `7.72.0`;
  - the repo uses `zod` `^3.22.4`, while `npm view zod version` returns `4.3.6`;
  - the repo uses `resend` `^2.1.0`, while `npm view resend version` returns `6.9.4`.
- Next.js authentication guidance continues to favor keeping real authorization checks near the data layer, which supports leaving PO and DU access enforcement in Convex instead of moving it into route-only logic.
- Next.js App Router docs continue to use the async `searchParams` prop shape on page files, which matches the current `/access/department-user` route implementation.
- Convex React docs continue to position `useQuery` as the reactive client primitive, so the PO access-code workspace should stay on reactive reads rather than manual refetching.
- Convex indexing docs still require indexed fields to be queried in declared order, so access-code lookup and history queries need deliberate index design from the start.
- Convex Auth server docs still expose `createAccount` and `signInViaProvider`, which confirms the existing DU auth flow is using official extension points and should be extended rather than replaced.
- Resend's send-email API docs continue to support idempotency keys, which aligns with the existing queue-and-bridge architecture and should inform Story 4.3 email delivery semantics.

### Testing Requirements

- Add pure helper tests for:
  - canonical code format generation using `[FiscalYear]-[DeptInitials]-[RandomChars]`,
  - removal of the old token-compression behavior that produced values like `CS2T`,
  - synchronization between canonical department code and DU auth normalization,
  - safe suffix masking,
  - fiscal-year resolution,
  - expiration-default derivation,
  - deadline-missing fallback behavior,
  - bulk-generation targeting rules,
  - delivery-status helper mapping.
- Add backend tests for:
  - create-modal generator replacement removes the old `CS2T` logic,
  - missing-code backfill reuses the shared canonical generator,
  - rotate existing access code,
  - shared-code synchronization into `departments.code`,
  - deactivate code,
  - bulk generate uncovered departments,
  - zero eligible departments,
  - partial-failure batch handling,
  - unauthorized or foreign-tenant access,
  - stale-code delivery rejection,
  - incompatible-recipient rejection,
  - history event writes,
  - audit-log writes,
  - safe not-found handling.
- Add DU auth regressions proving:
  - signed request-context verification works,
  - expired request-context tokens degrade gracefully,
  - success/failure events are recorded without breaking lockout,
  - deadline-window and collision behavior from Story 1.8 remains unchanged.
- Add PO dashboard or workspace tests proving:
  - access-code coverage updates reactively,
  - expired or deactivated codes stop counting,
  - rotate and deactivate actions update department readiness truthfully.
- Add email-bridge tests proving:
  - access-code delivery uses the expected template contract,
  - idempotency is preserved,
  - stale code cannot be emailed after rotation or expiry,
  - queue failures stay recoverable and sanitized.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript,
  - path-alias imports,
  - Convex-first auth and data enforcement,
  - RHF + Zod + shadcn/ui for forms,
  - append-only audit patterns,
  - desktop-first UX.
- Where `_bmad-output/project-context.md` or older architecture diagrams conflict with the live repo, prefer the live repo structure and current installed versions.

### Project Structure Notes

- Current repo alignment:
  - PO protected routes live under `webapp/app/(app)/po/...`
  - DU public access lives under `webapp/app/access/department-user/page.tsx`
  - shared PO dashboard state lives under `webapp/lib/procurement-officer/...`
  - DU auth enforcement lives in `webapp/convex/functions/departmentUserAuth.ts`
  - service-bridge actions live under `webapp/convex/actions/`
  - transactional email infrastructure lives under `nestjs/src/email/`
- Detected gaps this story must close:
  - no real PO access-code management workspace yet,
  - no per-code login-history table yet,
  - no signed DU request-context helper yet,
  - no dedicated access-code email template in the current bridge.

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 4 Source](../epic-04-po-department-catalog.md)
- [Story 4.1 Reference](./4-1-po-dashboard-onboarding-wizard.md)
- [Story 4.2 Reference](./4-2-department-crud-operations.md)
- [Story 1.8 Reference](../../epic1/completed/1-8-du-access-code-authentication.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [PO Access Codes Route](../../../../../webapp/app/(app)/po/access-codes/page.tsx)
- [PO Dashboard](../../../../../webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx)
- [PO Dashboard Helpers](../../../../../webapp/lib/procurement-officer/dashboard.ts)
- [PO Dashboard Snapshot Builder](../../../../../webapp/lib/procurement-officer/dashboard-snapshot.ts)
- [PO Dashboard Query](../../../../../webapp/convex/functions/procurementOfficerDashboard.ts)
- [Departments Backend Reference](../../../../../webapp/convex/functions/departments.ts)
- [DU Access Form](../../../../../webapp/src/components/auth/DepartmentUserAccessForm.tsx)
- [DU Public Access Route](../../../../../webapp/app/access/department-user/page.tsx)
- [DU Auth Backend](../../../../../webapp/convex/functions/departmentUserAuth.ts)
- [Current Auth Config](../../../../../webapp/convex/auth.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Access-Code Seed Helper](../../../../../webapp/convex/seedData.ts)
- [Audit Event Definitions](../../../../../webapp/lib/security/audit.ts)
- [Audit Helpers](../../../../../webapp/convex/functions/_audit.ts)
- [External Service Email Action](../../../../../webapp/convex/actions/email.ts)
- [External Service Bridge Helpers](../../../../../webapp/convex/actions/_helpers.ts)
- [Service JWT Helpers](../../../../../webapp/lib/services/procureline-service-auth.ts)
- [NestJS Email DTO](../../../../../nestjs/src/email/dto/send-email.dto.ts)
- [NestJS Email Controller](../../../../../nestjs/src/email/email.controller.ts)
- [NestJS Email Service](../../../../../nestjs/src/email/email.service.ts)
- [NestJS Email Template Renderer](../../../../../nestjs/src/email/template-renderer.service.ts)
- [Platform Admin Request Context Pattern](../../../../../webapp/lib/platform-admin/request-context.ts)
- [Platform Admin Request Context Token Pattern](../../../../../webapp/lib/platform-admin/request-context-token.ts)
- [Current Package Versions](../../../../../webapp/package.json)
- [Next.js Page File Convention](https://nextjs.org/docs/app/api-reference/file-conventions/page)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Convex Indexing Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [Convex Auth Server API](https://raw.githubusercontent.com/get-convex/convex-auth/main/docs/pages/api_reference/server.mdx)
- [shadcn/ui Dialog Docs](https://ui.shadcn.com/docs/components/dialog)
- [Resend Send Email API Docs](https://resend.com/docs/api-reference/emails/send-email)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Dev-story workflow: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Dev-story instructions: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Dev-story checklist: `_bmad/bmm/workflows/4-implementation/dev-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story source: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-3-access-code-generation-management.md`
- Project context: `_bmad-output/project-context.md`
- Verification commands:
  - `cd webapp && npx convex codegen`
  - `cd webapp && npm test`
  - `cd webapp && npm run lint`
  - `cd nestjs && npm test`
  - `cd nestjs && npm run lint`

### Completion Notes List

- 2026-03-26: Added a dedicated `webapp/convex/functions/accessCodes.ts` domain module, canonical access-code helpers, schema extensions, audit vocabulary, and append-only access-code history records for generate, rotate, deactivate, bulk, and delivery tracking flows.
- 2026-03-26: Replaced the PO access-code placeholder with a full management workspace, aligned the department create-modal generation and email actions with the canonical code format, and preserved the existing modal-backed `/po/access-codes` navigation contract.
- 2026-03-26: Threaded signed DU request-context metadata through the access flow, logged bounded per-code login outcomes without changing Story 1.8 auth authority, and reused the Convex-to-NestJS email bridge with an access-code delivery template plus delivery-state bookkeeping.
- 2026-03-26: Reverified the story with `cd webapp && npx convex codegen`, `cd webapp && npm test`, `cd webapp && npm run lint`, `cd nestjs && npm test`, and `cd nestjs && npm run lint`.

### Change Log

- 2026-03-26: Implemented Story 4.3 access-code management backend, PO workspace UI, DU request-context and login-history extensions, access-code delivery bridge support, and regression coverage across webapp and NestJS suites.

### File List

- `_bmad-output/implementation-artifacts/epics/epic4/stories/4-3-access-code-generation-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `nestjs/src/email/dto/send-email.dto.ts`
- `nestjs/src/email/template-renderer.service.ts`
- `nestjs/src/email/templates/access-code-delivery.template.ts`
- `nestjs/test/email-template-renderer.service.spec.ts`
- `webapp/app/access/department-user/page.tsx`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/actions/email.ts`
- `webapp/convex/auth.ts`
- `webapp/convex/functions/accessCodes.ts`
- `webapp/convex/functions/departmentUserAuth.ts`
- `webapp/convex/functions/departments.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/auth/department-user-request-context-token.ts`
- `webapp/lib/auth/department-user-request-context.ts`
- `webapp/lib/procurement-officer/access-codes.ts`
- `webapp/lib/procurement-officer/departments.ts`
- `webapp/lib/security/audit.ts`
- `webapp/src/components/auth/DepartmentUserAccessForm.tsx`
- `webapp/src/components/procurement-officer/DepartmentFormDialog.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerAccessCodesWorkspace.tsx`
- `webapp/src/components/procurement-officer/ProcurementOfficerDashboard.tsx`
- `webapp/tests/department-user-request-context.test.ts`
- `webapp/tests/procurement-officer-access-codes.test.ts`
- `webapp/tests/procurement-officer-departments.test.ts`
- `webapp/tests/run-tests.ts`

### Story Completion Status

- Story ID: `4.3`
- Story Key: `4-3-access-code-generation-management`
- Output File: `_bmad-output/implementation-artifacts/epics/epic4/stories/4-3-access-code-generation-management.md`
- Final Status: `review`
- Completion Note: `Implemented Story 4.3 access-code backend and schema support, replaced the PO placeholder with a real access-code management workspace, extended DU login history with signed request context, reused the existing email bridge for delivery, and reverified the webapp and NestJS suites locally.`
