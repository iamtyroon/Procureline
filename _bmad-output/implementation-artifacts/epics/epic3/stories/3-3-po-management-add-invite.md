# Story 3.3: PO Management - Add & Invite

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Tenant Admin,
I want to add and invite Procurement Officers to my organization,
so that they can manage departments and procurement activities.

## Acceptance Criteria

1. [Given] a Tenant Admin opens `/tenant-admin/po-management` [When] the page loads [Then] the existing tenant-admin dashboard shell stays intact [And] the PO management view shows a real directory that combines active or inactive Procurement Officers with pending invitation records instead of only the current read-only placeholder cards (FR-TA3a, FR15).
2. [Given] a Tenant Admin clicks `Add PO` [When] the add dialog or form opens [Then] the form requires full name, email, and phone [And] it validates the inputs with the repo-standard RHF + Zod form pattern before any Convex mutation runs (FR-TA3b).
3. [Given] a Tenant Admin submits a valid new Procurement Officer invitation [When] the backend accepts it [Then] the system creates a tenant-scoped invitation record with both an invite-link credential and a one-time activation code [And] it sends the email invitation [And] it returns a copyable activation code for manual sharing in the same UI flow (FR-TA3c, FR16).
4. [Given] the invited email already belongs to a Procurement Officer or other tenant-scoped user in a different tenant [When] the new invitation is created for this tenant [Then] the invitation is allowed [And] the eventual onboarding flow can activate a second tenant membership for the same auth identity instead of treating the user as globally misconfigured (FR-TA3d).
5. [Given] a Tenant Admin tries to invite an email that already has a Procurement Officer membership in the same tenant, already has another tenant-scoped membership in the same tenant, or already has a still-valid pending invitation for the same tenant [When] they submit the form [Then] the system rejects the request with a same-organization duplicate error instead of creating parallel pending credentials or silently attaching a second tenant-scoped role inside one tenant (FR-TA3e).
6. [Given] a Procurement Officer invitation is resent [When] the Tenant Admin requests fresh credentials [Then] the previous pending invite link and activation code are invalidated immediately [And] only the most recently issued pending invitation remains redeemable even if an older link is still open in a browser tab [And] the UI updates to show the latest pending status and issue time (FR-TA3g).
7. [Given] seven days pass without acceptance [When] invitation state is evaluated by the backend, the PO management query, or a redemption mutation [Then] the invitation is treated as expired server-authoritatively at every boundary [And] the Tenant Admin sees an expired state with a resend action instead of a still-valid pending badge (FR-TA3g).
8. [Given] the invitation email hard-bounces or is suppressed [When] the bounce webhook is verified and processed [Then] the invitation status changes to `bounced` [And] duplicated or replayed provider events do not double-notify or corrupt invitation state [And] the Tenant Admin receives a scoped in-app warning on the PO management surface plus a tenant-admin email notification without requiring the full Story 3.10 notification center to exist yet (FR-TA3f).
9. [Given] a Procurement Officer follows the public auth entry path [When] they continue from either a valid invite link or a manually entered activation code plus email [Then] the reserved `/access/procurement-officer` route becomes the real onboarding entry point [And] it preserves the opaque invite or activation context already supported by the public-entry helpers [And] it rejects conflicting handoff states where invite-link and manual-code credentials are presented together without a single unambiguous redemption path (FR-TA3c).
10. [Given] a Procurement Officer completes the onboarding flow [When] the invitation is redeemed successfully [Then] the system activates only the invited tenant membership, invalidates the redeemed invite credentials, and records the acceptance in audit logs [And] it must not activate any unrelated tenant or reusable institution-wide key (FR-TA3c, FR16).
11. [Given] the same auth user may end up with more than one active tenant membership after accepting a second-tenant PO invitation [When] auth context resolves the user after sign-in or invite redemption [Then] the session resolves the intended tenant membership from invite or activation context, or persisted session membership metadata, instead of letting `resolveRoleRecords(...)` mark the account as misconfigured for having multiple active `tenantUsers` records [And] if the stored membership selection is stale, revoked, or no longer active the system fails closed into reselection or re-entry rather than silently picking the wrong tenant (FR-TA3d).
12. [Given] Story 3.4 owns replace, deactivate, reactivate, unlock, and lifecycle controls [When] Story 3.3 ships [Then] the existing `Edit`, `Replace`, and `Deactivate` actions in the prototype-inspired PO management view are either disabled or clearly marked as follow-on actions so this story does not silently implement later lifecycle behavior early.
13. [Given] Story 3.2 already delivered the tenant-admin dashboard shell and current PO-management route [When] Story 3.3 is implemented [Then] it extends that existing UI and route namespace rather than replacing the dashboard shell, changing the tenant-admin IA, or introducing a second dashboard framework.
14. [Given] the implementation follows the live repo rather than the planning docs alone [When] invitation emails, bounce handling, and auth handoff are built [Then] the story reuses the current Convex-first auth and Resend patterns where possible, keeps the email integration swappable for future NestJS extraction, and avoids introducing mock PO data or fake invitation statuses.
15. [Given] the PO management surface merges accepted members with invitation history [When] an invitation has already been accepted and a real `tenantUsers` Procurement Officer row now exists for the same tenant and email [Then] the directory suppresses stale accepted invitation rows from the actionable list and surfaces one authoritative current person entry instead of duplicates.

## Tasks / Subtasks

- [x] Task 1: Turn the existing `/tenant-admin/po-management` placeholder actions into a real invitation management surface (AC: 1, 2, 3, 6, 7, 8, 12, 13, 14)
  - [x] Keep `webapp/app/(app)/tenant-admin/po-management/page.tsx` thin and continue rendering through the existing `TenantAdminDashboard` shell instead of creating a parallel tenant-admin page layout.
  - [x] Reuse `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx` as the current PO-management entry point, but extract dedicated PO-management subcomponents if the current inline view becomes unwieldy.
  - [x] Replace the current inert `Add PO` button with a real add-and-invite dialog or drawer that uses `react-hook-form`, `zodResolver`, and shadcn/ui form primitives.
  - [x] Update the visible PO directory so it merges active or inactive `tenantUsers` procurement officers with pending or expired invitation records from the new invitation table. Do not try to force pending invitations into `tenantUsers`, because `tenantUsers` requires a real `userId` and cannot truthfully represent an unaccepted invite.
  - [x] Collapse invitation history into one authoritative current row per person for the main actionable list: accepted invitations should not remain as duplicate actionable entries once a real Procurement Officer membership exists for the same tenant and normalized email.
  - [x] Keep `Edit`, `Replace`, and `Deactivate` clearly staged for Story 3.4 unless a small non-destructive edit path is intentionally added for invited-but-not-yet-accepted rows only.

- [x] Task 2: Add a dedicated Procurement Officer invitation and onboarding backend contract (AC: 1, 3, 4, 5, 6, 7, 8, 10, 11)
  - [x] Add a dedicated backend module such as `webapp/convex/functions/procurementOfficerOnboarding.ts` rather than overloading `tenantAdminDashboard.ts` or `users.ts`.
  - [x] Add a `poInvitations` table to `webapp/convex/schema.ts` with the minimum fields needed for real issuance and lifecycle tracking, including tenant scope, normalized email, invite token hash, activation code hash, activation code suffix, expiry, resend metadata, creator metadata, and server-authoritative status.
  - [x] Include an issuance discriminator such as `issueVersion`, `issuedAt`, or a replacement-chain pointer so resend invalidation remains enforceable even if an older invite tab or copied credential is used after a newer invite has been issued.
  - [x] Include status coverage for at least `pending`, `accepted`, `expired`, `bounced`, and `revoked`, plus one-time notification markers such as `bounceNotifiedAt` or `expiredNotifiedAt` if needed to avoid duplicate tenant-admin alerts.
  - [x] Add the indexes required for efficient lookup by invite token hash, activation code hash, and `(tenantId, normalizedEmail)` so invite redemption and duplicate detection do not degrade into full scans.
  - [x] Extend the tenant-admin dashboard snapshot query, or add a narrow PO-management query, so the frontend can read invitation state, pending counts, and last-issued metadata without inventing client-side placeholder rows.

- [x] Task 3: Implement invitation issuance, resend, expiry, and audit behavior using the repo’s existing secure patterns (AC: 3, 5, 6, 7, 10, 14)
  - [x] Mirror the current tenant-admin invitation pattern in `webapp/convex/functions/tenantAdminOnboarding.ts`: store only hashed invite tokens, invalidate superseded pending credentials on resend, and append audit events for issued, resent, accepted, bounced, and expired invitations.
  - [x] Generate one-time activation codes using a normalized, human-shareable format plus hashed persistence and suffix-only display rules similar to the department-user access-code helpers.
  - [x] Use the current server-side Resend integration seam already present in the repo, and include stable email tags plus an `Idempotency-Key` so invitation sends and resends can be correlated and deduplicated safely.
  - [x] Treat seven-day expiry as backend truth. Expiry can be reconciled by mutation, scheduled cleanup, or query-time patching, but the UI must never trust a stale client timestamp to decide whether a pending credential is still valid.
  - [x] Re-check both expiry and latest-issuance validity inside the final redemption mutation so an expired or superseded credential cannot succeed merely because it was rendered as valid moments earlier.

- [x] Task 4: Upgrade the reserved `/access/procurement-officer` route into the real Procurement Officer invite and activation experience (AC: 9, 10, 11, 14)
  - [x] Replace the current `RoleAccessComingSoon` implementation in `webapp/app/access/procurement-officer/page.tsx` with a real role-specific onboarding form component such as `webapp/src/components/auth/ProcurementOfficerAccessForm.tsx`.
  - [x] Support both invite-link entry and manual activation-code entry without requiring the email invitation to be the only successful path.
  - [x] Preserve the recognized `invite`, `activationCode`, and `activationToken` handoff params already modeled in `webapp/lib/auth/public-entry.ts` instead of inventing a second public-entry contract.
  - [x] Define a single server-validated handoff policy for conflicting params: either one credential family wins explicitly, or the request is rejected with deterministic guidance. Do not silently guess between invite-link and manual-code redemption.
  - [x] Reuse the existing Convex Auth account and OTP verification patterns where possible. Do not create a second unrelated auth system just for Procurement Officers.
  - [x] If the invited email already belongs to an existing auth user, allow secure sign-in or account attachment to continue the invitation instead of forcing the tenant-admin onboarding behavior that blocks any pre-existing application role assignment.

- [x] Task 5: Extend auth-context resolution so cross-tenant same-email PO onboarding is actually possible (AC: 4, 9, 10, 11)
  - [x] Update `webapp/lib/auth/roles.ts` and `webapp/convex/functions/_roleGuard.ts` so multiple active tenant memberships for one auth user are no longer treated as automatically misconfigured.
  - [x] Persist enough session-scoped membership context, likely in `sessionMetadata`, to remember which tenant membership the Procurement Officer intended to access after invite redemption or activation-code entry.
  - [x] Validate the stored session membership selection on every authorization-context read. If the selected membership no longer exists or is inactive, require reselection or fresh invite continuation instead of silently falling back to another tenant.
  - [x] Keep same-tenant duplicate-role protection intact: the change should allow cross-tenant reuse of the same email, not duplicate PO memberships within one tenant.
  - [x] Make the same-tenant policy explicit for pre-existing non-PO tenant-scoped memberships on the same email: Story 3.3 should reject the invite rather than auto-attaching an additional tenant-scoped role inside one tenant.
  - [x] Ensure existing tenant-admin, platform-admin, and department-user flows still resolve cleanly after the multi-membership change.

- [x] Task 6: Add bounce handling through a verified Resend webhook route and scoped tenant-admin alerts (AC: 8, 14)
  - [x] Add a Next.js route handler such as `webapp/app/api/webhooks/resend/route.ts` for invitation-delivery webhooks.
  - [x] Verify the raw request body with Resend’s webhook verification flow before mutating any invitation state.
  - [x] Update invitation records on `email.bounced` or suppression-style events, and surface those states in the PO-management UI with a real warning treatment instead of a silent failure.
  - [x] Use a durable idempotency mechanism such as `externalServiceSyncEvents` or an equivalent provider-event key log so duplicate or replayed webhooks do not double-notify or regress invitation state.
  - [x] Deliver the required tenant-admin notification in a scoped way for this story, for example via a targeted warning banner plus tenant-admin email, without prematurely building the full Story 3.10 notification center.

- [x] Task 7: Add deterministic regression coverage for invitation lifecycle, public handoff, and multi-membership auth resolution (AC: 1-15)
  - [x] Add pure tests for activation-code normalization and hashing, duplicate detection rules, resend invalidation, and seven-day expiry handling.
  - [x] Add backend tests covering same-tenant duplicate rejection, cross-tenant same-email allowance, invite redemption, activation-code redemption, stale older-link rejection after resend, and once-only audit/event behavior.
  - [x] Add auth-context and RBAC tests proving the repo no longer fails closed as `misconfigured` when a user has multiple valid tenant memberships selected through the PO invite flow, and that stale stored membership selections fail closed instead of silently picking another tenant.
  - [x] Add route or component tests for `/access/procurement-officer`, including invite-link prefill, manual activation-code entry, invalid credential messaging, conflicting handoff param rejection, and the transition from pending invitation to active tenant membership.
  - [x] Add webhook-handler tests that verify invalid signatures fail closed, valid bounce events patch the right invitation row, replayed deliveries are deduplicated, and accepted invitations do not regress back to actionable bounce states.

## Dev Notes

### Story Foundation

- Epic 3 positions Story 3.3 as the controlled onboarding point for Procurement Officers and explicitly says delivery must support both email invites and one-time activation codes.
- Sprint status marks this story `full-stack`, and that is accurate: the current frontend surface exists, but the backend invitation model, public PO access route, and auth-context resolution needed for cross-tenant same-email support do not.
- Story 3.4 owns the dangerous lifecycle work after onboarding. Story 3.3 should get Procurement Officers into the tenant safely, not silently absorb replace, deactivate, reactivate, unlock, or activity-log features out of order.

### Current Implementation State Discovered In Code

- `webapp/app/(app)/tenant-admin/po-management/page.tsx` already routes to `TenantAdminDashboard view="po-management"`.
- `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx` already renders a prototype-aligned PO-management view with `Add PO`, `Edit`, `Replace`, and `Deactivate` controls, but those controls are currently inert and only operate on active `directory.procurementOfficers` data.
- `webapp/convex/functions/tenantAdminDashboard.ts` currently builds the PO directory from `tenantUsers`, `departments`, `departmentUserProfiles`, and `auditLogs` only. There is no current backend representation for pending PO invitations.
- `webapp/convex/schema.ts` currently has `tenantAdminInvitations`, `tenantAdminOnboardingStates`, `tenantUsers`, `departments`, `departmentAccessCodes`, `departmentUserAuthChallenges`, `sessionMetadata`, `auditLogs`, and `externalServiceSyncEvents`, but it does not yet have a `poInvitations` table or any PO-specific onboarding state.
- `webapp/app/access/procurement-officer/page.tsx` is still a reserved placeholder route, while `webapp/lib/auth/public-entry.ts` already preserves `invite`, `activationCode`, and `activationToken` for the Procurement Officer path.
- `webapp/app/(auth)/login/page.tsx` and `webapp/src/components/auth/LoginForm.tsx` do not currently implement a PO-specific onboarding or membership-selection experience. The shared login page ignores the `role=procurement_officer` query today.
- `webapp/convex/functions/tenantAdminOnboarding.ts` and `webapp/lib/tenant-admin/invitations.ts` already show the house pattern for invitation hashing, resend invalidation, access-message resolution, and audit logging.
- `webapp/convex/functions/departmentUserAuth.ts` and `webapp/lib/auth/department-user-access.ts` already show the house pattern for hashed human-entered codes, one-time auth challenges, lockout handling, and OTP verification.
- `webapp/lib/auth/roles.ts` currently treats `activeTenantUsers.length > 1` as `misconfigured`. This is directly incompatible with FR-TA3d and must be addressed in Story 3.3.

### Critical Implementation Trap

- Pending PO invites cannot be represented by `tenantUsers` because `tenantUsers` requires a real `userId`.
- Cross-tenant same-email PO onboarding cannot work if the app keeps treating more than one active tenant membership as misconfigured.
- Reusing the tenant-admin onboarding duplicate-role guard unchanged will block a valid Story 3.3 success case.
- The shared `/login` route is not a truthful PO onboarding implementation surface today; the reserved `/access/procurement-officer` route is the safer place to land this story.
- Resend invalidation is not just a UI concern. The final redemption mutation must reject expired or superseded credentials even when an older invite tab is still open.
- Session-scoped tenant selection must be validated every time auth context is loaded; stale session metadata must never silently route the user into another tenant.

### Reuse And Anti-Reinvention Guidance

- Reuse the existing tenant-admin dashboard shell and current PO-management route; do not rebuild a separate tenant-admin management page.
- Reuse tenant-admin invitation patterns for token hashing, resend invalidation, and audit logging rather than inventing a second invitation style from scratch.
- Reuse department-user access-code patterns for human-entered activation-code normalization, hashing, suffix display, and one-time challenge thinking.
- Reuse the existing public-entry handoff params and route-selection helpers in `webapp/lib/auth/public-entry.ts`.
- Reuse the existing Convex Auth + Resend OTP approach where possible. Do not introduce a new external auth provider or a second account system for POs.
- Reuse `sessionMetadata` for tenant-membership selection if session-scoped tenant context is needed. Do not invent a parallel session store.

### Prototype Alignment

- `docs/html/admin-tenant.html` already contains the visual and interaction inspiration for PO management:
  - add/create Procurement Officer dialog
  - empty-state CTA when no PO exists
  - active PO summary card
  - replace/deactivate controls that belong to Story 3.4
- The production implementation should preserve the existing tenant-admin layout and bento-card rhythm from the current app shell.
- The story should not copy the prototype’s fake local-state behavior, hard-coded names, or modal-only success path. Use the visual direction, not the fake data model.

### Auth And Membership Guidance

- The current app resolves exactly one active app role or membership. Story 3.3 is the first story that explicitly requires one auth identity to be valid in more than one tenant context.
- Recommended direction:
  - keep `tenantUsers` as the truth for memberships,
  - allow multiple active `tenantUsers` rows for the same `userId` when they belong to different tenants,
  - store the currently selected tenant membership in `sessionMetadata`,
  - seed that session selection from invite-link redemption or activation-code flow,
  - update `getAuthorizationContext(...)` to resolve the selected membership instead of failing closed as `misconfigured`.
- Same-tenant duplicate protection must remain strict. A user should not gain two PO memberships in the same tenant.
- Treat other same-tenant tenant-scoped memberships the same way for Story 3.3: if the email is already attached to that tenant, reject the new PO invite and leave any role-conversion or multi-role policy to a later explicitly designed story.

### Email And Webhook Guidance

- Planning docs mention NestJS for email delivery, but the live repo already has direct Resend integrations in `webapp/convex/ResendOTP.ts` and `webapp/convex/ResendPasswordReset.ts`.
- Use the live repo’s current email seam first. Keep the invitation-email sender isolated enough that it can be moved behind NestJS later without rewriting the PO-management UI or invitation schema.
- There is currently no Resend webhook route for bounce handling in the app. Story 3.3 should add one and verify signatures before mutating invitation state.
- Bounce processing must be idempotent. Replayed provider events must not resend tenant-admin alerts or move an accepted invitation back into an actionable failed state.

### Data Model Guidance

- Recommended `poInvitations` shape:
  - `tenantId`
  - `email`
  - `normalizedEmail`
  - `inviteTokenHash`
  - `activationCodeHash`
  - `activationCodeSuffix`
  - `issueVersion` or equivalent latest-issuance discriminator
  - `status` (`pending`, `accepted`, `expired`, `bounced`, `revoked`)
  - `expiresAt`
  - `resentCount`
  - `createdByTenantUserId`
  - optional `acceptedByUserId`
  - optional `acceptedAt`
  - optional `lastEmailSentAt`
  - optional `providerMessageId`
  - optional `bounceReason`
  - optional once-only notification markers such as `bounceNotifiedAt` and `expiredNotifiedAt`
  - `createdAt`
  - `updatedAt`
- Recommended session metadata extension if needed:
  - optional `activeTenantId`
  - optional `activeTenantUserId`
  - optional `activeTenantRole`
- Keep invite tokens and activation codes hashed at rest. Only suffixes should be rendered back to the Tenant Admin after initial issuance.
- If a handoff request presents more than one credential family, reject it unless the backend can prove a single deterministic interpretation.

### UI And Interaction Requirements

- Keep `/tenant-admin/po-management` inside the existing desktop-first tenant-admin shell.
- The first usable screen should answer:
  - who is active,
  - who is still pending,
  - who bounced or expired,
  - what action the Tenant Admin can take next.
- The Add PO flow should return the activation code immediately after issuance with an explicit copy affordance, because unreliable email delivery is part of the story premise.
- Pending, bounced, expired, and active states must be visually distinct. Do not flatten everything into a single generic “status” badge.
- Replace and Deactivate should remain visibly present only if they are clearly staged for Story 3.4; otherwise hide them until lifecycle support exists.
- The main list should not show both an accepted historical invitation row and a live Procurement Officer row as separate current entries for the same tenant/email person.

### Architecture Compliance

- Follow the versions actually installed in `webapp/package.json`:
  - Next.js `^16.1.6`
  - React `^19.2.4`
  - Convex `^1.13.2`
  - `@convex-dev/auth` `^0.0.90`
  - `resend` `^2.1.0`
  - `react-hook-form` `^7.47.0`
  - `zod` `^3.22.4`
- Keep secure authorization and tenant resolution in Convex near the data source.
- Keep page files thin and move interactive behavior into components.
- Keep the repo’s `proxy.ts` convention. Do not introduce `middleware.ts`.
- Prefer App Router route handlers only for verified webhook processing and similar HTTP boundary work.

### File Structure Requirements

- Expected primary files to modify:
  - `webapp/app/(app)/tenant-admin/po-management/page.tsx`
  - `webapp/src/components/tenant-admin/TenantAdminViewContent.tsx`
  - `webapp/convex/functions/tenantAdminDashboard.ts`
  - `webapp/convex/schema.ts`
  - `webapp/app/access/procurement-officer/page.tsx`
  - `webapp/lib/auth/public-entry.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/convex/functions/_roleGuard.ts`
  - `webapp/convex/functions/users.ts`
- Expected new files (recommended):
  - `webapp/convex/functions/procurementOfficerOnboarding.ts`
  - `webapp/lib/procurement-officer/invitations.ts`
  - `webapp/src/components/auth/ProcurementOfficerAccessForm.tsx`
  - `webapp/src/components/tenant-admin/po-management/ProcurementOfficerInviteDialog.tsx`
  - `webapp/src/components/tenant-admin/po-management/ProcurementOfficerInvitationList.tsx`
  - `webapp/app/api/webhooks/resend/route.ts`
  - `webapp/tests/procurement-officer-invitations.test.ts`
- Optional supporting files if the multi-membership work needs isolation:
  - `webapp/lib/auth/tenant-membership.ts`
  - `webapp/lib/procurement-officer/access.ts`

### Testing Requirements

- Add pure tests for activation-code normalization, hashing, suffix display, and duplicate detection.
- Add backend invitation tests for issue, resend invalidation, seven-day expiry, bounce-state transitions, and audit logging.
- Add cross-tenant same-email tests proving a second tenant membership is allowed while same-tenant duplicates remain blocked.
- Add auth-context tests proving multiple active tenant memberships no longer collapse into `misconfigured` once session-scoped tenant selection is present.
- Add route or component tests for `/access/procurement-officer` invite-link and activation-code flows.
- Add webhook route tests for raw-body signature verification, bounce processing, duplicate deliveries, and fail-closed behavior.
- Add regression coverage for stale membership-selection metadata, conflicting public handoff params, and duplicate directory-row suppression after invitation acceptance.

### Git Intelligence Summary

- Commit `3b5d1bc` implemented tenant-admin onboarding with hashed invitation persistence, resend invalidation, onboarding route-gating, and strong deterministic tests. Story 3.3 should mirror those patterns instead of inventing a new invitation architecture.
- Commit `32c8696` tightened platform-admin security and request-context handling. Treat that as a reminder to keep PO invitation and membership attachment flows explicit, auditable, and fail-closed.
- Commit `e213972` established the current pattern of thin protected routes, dedicated feature components, and placeholder subroutes inside a dashboard shell. Story 3.3 should extend the existing tenant-admin namespace the same way.

### Latest Tech Information

- Verified on March 23, 2026 against official docs, the live repo, and current published package metadata:
  - the repo uses Next.js `^16.1.6`, while `npm view next version` returns `16.2.1`;
  - the repo uses Convex `^1.13.2`, while `npm view convex version` returns `1.34.0`;
  - the repo uses `@convex-dev/auth` `^0.0.90`, while `npm view @convex-dev/auth version` returns `0.0.91`;
  - the repo uses `resend` `^2.1.0`, while `npm view resend version` returns `6.9.4`.
- Next.js authentication guidance recommends secure authorization checks in a Data Access Layer and only optional optimistic checks in `proxy.ts`. Inference: keep PO invite authorization in Convex and use `proxy.ts` only for lightweight route redirects if needed.
- Convex React docs still position `useQuery` as the reactive client primitive, so the PO-management directory should stay on reactive Convex reads instead of manual polling or duplicate REST fetches.
- Convex index docs require `withIndex(...)` ranges to follow index-field order and recommend `first`, `unique`, `take`, or pagination when no range is used. Inference: `poInvitations` needs dedicated lookup indexes from day one.
- Resend’s send-email API supports `tags` and `Idempotency-Key`. Inference: include invitation and tenant identifiers in outbound email metadata so resend, bounce, and audit reconciliation can stay deterministic.
- Resend webhook docs require verifying the raw request body with the Svix headers and signing secret before processing. Do not parse JSON first and then attempt verification.
- Resend’s test-email docs provide `bounced@resend.dev` for safe bounce-path testing during development.

### Project Context Reference

- Apply the project-context rules that still match the live repo:
  - strict TypeScript
  - path-alias imports
  - Convex-first auth and data enforcement
  - RHF + Zod for forms
  - shadcn/ui + Tailwind for UI
  - audit logging on state-changing operations
- Where planning artifacts conflict with the current repo, prefer the live repo and current file layout:
  - authenticated app routes live under `webapp/app/(app)/...`
  - Convex backend modules live under `webapp/convex/...`
  - the tenant-admin dashboard shell already exists and should be extended, not replaced

### References

- [Sprint Status](../../../sprint-status.yaml)
- [Epic 3 Source](../epic-03-tenant-administration.md)
- [Story 3.1 Reference](./3-1-tenant-admin-institution-setup-flow.md)
- [Story 3.2 Reference](./3-2-tenant-admin-dashboard.md)
- [PRD](../../../../planning-artifacts/prd.md)
- [Architecture](../../../../planning-artifacts/architecture.md)
- [UX Design](../../../../planning-artifacts/ux-design-specification.md)
- [Project Context](../../../../project-context.md)
- [Tenant Admin PO Route](../../../../../webapp/app/(app)/tenant-admin/po-management/page.tsx)
- [Tenant Admin Dashboard Shell](../../../../../webapp/src/components/tenant-admin/TenantAdminDashboard.tsx)
- [Tenant Admin View Content](../../../../../webapp/src/components/tenant-admin/TenantAdminViewContent.tsx)
- [Tenant Admin Dashboard Query](../../../../../webapp/convex/functions/tenantAdminDashboard.ts)
- [Tenant Admin Dashboard Snapshot Builder](../../../../../webapp/lib/tenant-admin/dashboard-snapshot.ts)
- [Current Schema](../../../../../webapp/convex/schema.ts)
- [Current Public Entry Helpers](../../../../../webapp/lib/auth/public-entry.ts)
- [Current PO Access Route Placeholder](../../../../../webapp/app/access/procurement-officer/page.tsx)
- [Current Shared Login Page](../../../../../webapp/app/(auth)/login/page.tsx)
- [Current Shared Login Form](../../../../../webapp/src/components/auth/LoginForm.tsx)
- [Current Role Resolution Helpers](../../../../../webapp/lib/auth/roles.ts)
- [Current Role Guard Backend Helpers](../../../../../webapp/convex/functions/_roleGuard.ts)
- [Tenant Admin Invitation Helpers](../../../../../webapp/lib/tenant-admin/invitations.ts)
- [Tenant Admin Onboarding Backend](../../../../../webapp/convex/functions/tenantAdminOnboarding.ts)
- [Department User Access Helpers](../../../../../webapp/lib/auth/department-user-access.ts)
- [Department User Auth Flow](../../../../../webapp/convex/functions/departmentUserAuth.ts)
- [Audit Event Definitions](../../../../../webapp/lib/security/audit.ts)
- [Tenant Admin Prototype](../../../../../docs/html/admin-tenant.html)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Convex React Docs](https://docs.convex.dev/client/react)
- [Convex Indexing Docs](https://docs.convex.dev/database/reading-data/indexes/)
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend Verify Webhooks Requests](https://resend.com/docs/webhooks/verify-webhooks-requests)
- [Resend Test Emails](https://resend.com/docs/dashboard/emails/send-test-emails)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Completion Notes List

- 2026-03-23: Created the implementation-ready story artifact for `3-3-po-management-add-invite`.
- 2026-03-23: Anchored the story to the live tenant-admin dashboard shell, existing public-entry handoff params, current invitation and audit patterns, and the reserved Procurement Officer access route already in the repo.
- 2026-03-23: Called out the hidden architecture blocker that the current auth model treats multiple active tenant memberships as `misconfigured`, which directly conflicts with FR-TA3d and must be addressed during implementation.
- 2026-03-23: Scoped Story 3.3 to add-and-invite behavior only, explicitly keeping replace or deactivate lifecycle work staged for Story 3.4.
- 2026-03-24: Hardened the story against edge cases around resend races, conflicting handoff params, stale tenant selection, webhook replay, same-tenant duplicate-role ambiguity, and duplicate directory rows after acceptance.
- 2026-03-24: Implemented the Procurement Officer invitation surface, Convex invitation lifecycle, public Procurement Officer access flow, bounce processing, and session-scoped tenant membership selection.
- 2026-03-24: Verified the story with `npx convex codegen`, `npm run lint`, and `npm test`, including new Procurement Officer invitation helper tests and updated RBAC coverage for multi-membership resolution.
- 2026-03-24: Cleared the review follow-ups by adding dashboard-based tenant membership reselection, scrubbing PO handoff credentials from the browser URL, and preserving revoked or expired invitation states during late bounce processing.

### File List

- `_bmad-output/implementation-artifacts/epics/epic3/stories/3-3-po-management-add-invite.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/app/(app)/dashboard/page.tsx`
- `webapp/app/access/procurement-officer/page.tsx`
- `webapp/app/api/webhooks/resend/route.ts`
- `webapp/convex/_generated/api.d.ts`
- `webapp/convex/auth.ts`
- `webapp/convex/functions/_roleGuard.ts`
- `webapp/convex/functions/procurementOfficerOnboarding.ts`
- `webapp/convex/functions/sessions.ts`
- `webapp/convex/functions/tenantAdminDashboard.ts`
- `webapp/convex/functions/users.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/auth/roles.ts`
- `webapp/lib/auth/session.ts`
- `webapp/lib/errors/convex.ts`
- `webapp/lib/procurement-officer/invitations.ts`
- `webapp/lib/procurement-officer/webhook.ts`
- `webapp/lib/security/audit.ts`
- `webapp/lib/tenant-admin/dashboard-snapshot.ts`
- `webapp/lib/validators/procurement-officer.ts`
- `webapp/src/components/auth/ProcurementOfficerAccessForm.tsx`
- `webapp/src/components/tenant-admin/TenantAdminDashboard.tsx`
- `webapp/src/components/tenant-admin/po-management/ProcurementOfficerManagementView.tsx`
- `webapp/tests/procurement-officer-invitations.test.ts`
- `webapp/tests/rbac.test.ts`
- `webapp/tests/run-tests.ts`

### Change Log

- 2026-03-24: Added Procurement Officer invitation persistence, invite resend invalidation, OTP challenge handling, bounce processing, and acceptance auditing in Convex.
- 2026-03-24: Replaced the placeholder PO management surface with a real invitation workflow, merged invitation history into the directory view, and activated the `/access/procurement-officer` entry path.
- 2026-03-24: Added focused regression coverage for invitation helpers, signed webhook verification, and multi-membership RBAC behavior, then verified the repo with lint and the full test suite.
- 2026-03-24: Applied the Senior Developer Review fixes for membership reselection, URL credential scrubbing, and late-bounce state preservation, then regenerated Convex bindings and reran the full automated test suite.

### Senior Developer Review (AI)

- Date: 2026-03-24
- Reviewer: Codex
- Outcome: Approved after follow-up fixes
- Findings fixed:
  - Added a real workspace-selection path on `/dashboard` for pending multi-membership sessions and validated the selected membership before persisting it to `sessionMetadata`.
  - Scrubbed `invite`, `activationToken`, and `activationCode` query params from the Procurement Officer continuation URL after the page consumes them.
  - Preserved `revoked` and `expired` invitation states when late Resend bounce events arrive so stale invitations do not regress into actionable bounce warnings.
- Verification:
  - `cmd /c npx convex codegen --typecheck disable`
  - `cmd /c npm test`

### Story Completion Status

- Story ID: `3.3`
- Story Key: `3-3-po-management-add-invite`
- Output File: `_bmad-output/implementation-artifacts/epics/epic3/stories/3-3-po-management-add-invite.md`
- Final Status: `done`
- Completion Note: `Implemented Procurement Officer invitation management, access handoff, bounce handling, cross-tenant membership selection, cleared the review follow-ups for reselection and URL safety, and reverified the story with regenerated Convex bindings plus the full automated test suite.`
