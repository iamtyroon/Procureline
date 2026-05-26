# Story 3.11: Security & Session Management

Status: in-progress

## Story

As a **Tenant Admin**,
I want security visibility, multi-factor protection, and session control,
so that I can protect institutional procurement access and respond to suspicious use.

## Acceptance Criteria

1. A Tenant Admin security view displays their login/security history with date/time, available IP/location fields, device/browser information, pagination, and search/filter behavior; unavailable enrichment is labeled rather than fabricated.
2. A Tenant Admin can enroll a TOTP authenticator by obtaining a setup secret/QR representation and confirming a valid one-time code before enrollment becomes active.
3. Confirmed TOTP enrollment produces ten single-use recovery codes, stores only safe hashes, and requires confirmation that the codes were saved before completing setup.
4. A Tenant Admin can view active sessions with device and last-activity context and terminate any non-current session; termination immediately makes that session invalid.
5. Login from a detected new device or location records a security event, queues a security email, and creates a high-priority notification compatible with Story 3.10.
6. Repeated failed login attempts apply progressive lockout windows: 5 failures equals 15 minutes, 10 failures equals 1 hour, and 15 failures equals 24 hours, with the active duration displayed safely to the attempting user.
7. Password age tracking gives a warning seven days before the 90-day change requirement and blocks protected access after the policy grace condition until a password change completes.
8. The security/audit view includes logins, settings changes, and security events and offers a tenant-authorized export without disclosing other tenants or sensitive secrets.
9. All security operations are authenticated, audited, resistant to session/self-revocation mistakes, and do not expose TOTP secrets, raw recovery codes after issuance, session tokens, or password material in logs/UI.

## Tasks / Subtasks

- [ ] Implement the security UI within the tenant-admin workspace (AC: 1-9)
  - [ ] Add a security view/route consistent with the current tenant-admin shell, or extend the settings account-security area when that is the established frontend.
  - [ ] Render login history, 2FA enrollment/recovery acknowledgement, active session controls, policy warnings, and export action using explicit empty/loading/error states.
- [ ] Extend existing authentication and session data safely (AC: 1-7, 9)
  - [ ] Reuse `sessionMetadata`, `functions/sessions.ts`, and `_roleGuard.ts`; implement non-current session revocation by marking the selected stored session invalid.
  - [ ] Add tenant-admin security enrollment/attempt/policy records only where existing platform-admin-only security state cannot be safely shared.
  - [ ] Persist hashed recovery-code representations and one-time consumption state; reveal plaintext recovery codes only at initial enrollment.
- [ ] Integrate security alerts, audit, and export (AC: 1, 5, 8-9)
  - [ ] Append structured security/audit events using existing audit infrastructure and safe redaction rules.
  - [ ] Queue security notifications through Story 3.10's notification boundary when available and existing email service for outbound delivery.
  - [ ] Build tenant-scoped security export using established report/export authorization patterns rather than a public dump endpoint.
- [ ] Enforce lockout and password-age policy in the actual authentication gate (AC: 6-7)
  - [ ] Apply the lockout check before sign-in succeeds and record success/failure progression safely.
  - [ ] Apply password-age redirect/block logic through the protected access context, not just by hiding UI.

## Dev Notes

### Delivered Context To Extend

- `sessions.ts` and `lib/shared/auth/session.ts` already resolve session status, idle windows, logout metadata, current session, and selected tenant membership.
- `_roleGuard.ts` resolves access on every guarded call; session revocation and policy blocks must be enforced through this backend path.
- Existing platform-admin verification/security functionality must not be reused blindly because its role and verification assumptions are platform-specific; follow its patterns only where compatible.
- `securityAudit.ts`, `auditLogs.ts`, and `_audit.ts` already provide audit foundations. The current tenant-admin audit route can be extended for permitted security records/export.

### Technical Requirements

- The epic suggests `otplib`, but no TOTP library is presently confirmed for tenant admins. Choose a compatible maintained implementation during development and never store raw TOTP secrets without appropriate protection.
- Location data must be derived only where reliable IP enrichment exists and privacy/security policy permits; show `Unavailable` rather than guessed location.
- Session termination must exclude the current session in the UI and backend command contract.
- The project context says 2FA is mandatory for all users, while delivered application code currently makes dedicated platform-admin 2FA visible. This story should implement Tenant Admin enrollment/enforcement without changing other roles beyond its authorized scope.
- Never include raw session IDs/tokens, TOTP secrets, recovery codes, full IP detail where not appropriate, or password fields in auditable metadata.

### Architecture And File Guidance

- UI: new focused tenant-admin security component/route integrated into `TenantAdminDashboard`, plus existing audit surface as appropriate.
- Backend: `webapp/convex/functions/sessions.ts`, `_roleGuard.ts`, security/audit modules, `webapp/convex/schema.ts`, notification/email boundary.
- Existing references: platform-admin authentication components/functions for UI/security pattern review only, with tenant-admin authorization enforced separately.

### Scope Boundaries

- Do not expose institutional users' full personal security history to a Tenant Admin unless specifically required and policy-scoped; this story is framed around Tenant Admin account access.
- Do not duplicate the general notification inbox; emit security events into Story 3.10 integration.
- Do not falsely report device geolocation where no stored source exists.

### Manual Verification Only

- Do not add automated test tasks or automated-test acceptance criteria.
- Manually verify login history/redaction, TOTP setup and recovery consumption, non-current session termination, new-device alert integration, all progressive lockouts, password-age warning/block behavior, export scoping, and absence of secret leakage.

### References

- [Source: ../epic-03-tenant-administration.md#Story-311-Security--Session-Management]
- [Source: ../../../../planning-artifacts/architecture.md]
- [Source: ../../../../project-context.md]
- [Source: webapp/convex/functions/sessions.ts]
- [Source: webapp/lib/shared/auth/session.ts]
- [Source: webapp/convex/functions/_roleGuard.ts]
- [Source: webapp/convex/functions/securityAudit.ts]
- [Source: webapp/convex/functions/auditLogs.ts]

## Dev Agent Record

### Agent Model Used

GPT-5

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story intentionally specifies manual verification only; automated testing is excluded by user direction.
- Review fixes applied: TOTP enrollment now persists encrypted usable secret material, enrolled sessions require a Tenant Admin verification route, and session termination protects the actual authenticated session ID.
- Code-review follow-up: TOTP setup now requires recovery-code acknowledgement, recovery codes are consumable once, progressive verification lockouts are enforced in the role guard, and password-age access blocking is wired; new-device alert/export coverage and full manual verification remain open.

### File List

- `webapp/convex/schema.ts`
- `webapp/convex/functions/_roleGuard.ts`
- `webapp/convex/functions/tenantAdminOperations.ts`
- `webapp/lib/shared/auth/roles.ts`
- `webapp/lib/shared/auth/session.ts`
- `webapp/src/components/auth/TenantAdminTwoFactorVerifyForm.tsx`
- `webapp/app/(auth)/tenant-admin/verify/page.tsx`
- `webapp/src/components/tenant-admin/TenantAdminOperationsViews.tsx`
