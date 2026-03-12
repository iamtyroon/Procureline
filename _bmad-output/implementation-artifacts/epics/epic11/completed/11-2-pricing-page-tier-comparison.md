# Story 11.2: Pricing Experience & Tier Comparison

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **visitor**,
I want to see pricing options and compare tiers,
So that I can choose the right plan for my organization.

## Scope

- Single pricing surface on landing page (`/#pricing`)
- `/pricing` route exists only as a deep-link entrypoint to that surface
- Tier selection must carry through signup and tenant provisioning
- Enterprise path must use an in-app Contact Sales form (not mailto)
- KES/USD currency toggle
- Monthly equivalent pricing breakdown

## Out of Scope

- Standalone `/pricing` UI page


## Acceptance Criteria

**AC1: Pricing entrypoint and deep-link**

**Given** a visitor navigates to `/pricing`  
**When** the route resolves  
**Then** system navigates to the landing pricing section (`/#pricing`)  
**And** the browser lands with the pricing section visible without manual scrolling.

**AC2: Tier comparison surface**

**Given** a visitor views pricing  
**When** reviewing tiers  
**Then** the page displays Free, Starter, Professional, and Enterprise  
**And** each tier shows price, limits, and included features.

**AC3: Comparison clarity**

**Given** a visitor compares plans  
**When** scanning tier cards  
**Then** plan differences are clearly distinguishable (limits/features/CTA)  
**And** critical feature text is not truncated in a way that hides meaning.

**AC4: Pricing display model**

**Given** a visitor views prices  
**When** reading amounts  
**Then** pricing is shown in USD with annual billing context  
**And** the copy states fiscal-year alignment (July to June).

**AC5: Tier preselection to signup**

**Given** a visitor clicks Free, Starter, or Professional CTA  
**When** routed to signup  
**Then** selected tier is captured from query params  
**And** preserved through email verification flow  
**And** used during tenant creation so persisted tenant tier matches selection.

**AC6: Enterprise contact-sales workflow**

**Given** a visitor clicks Enterprise CTA  
**When** they proceed  
**Then** an in-app Contact Sales form is shown  
**And** submission creates a `salesInquiry` record  
**And** visitor receives success/error feedback.

**AC7: Pricing FAQ**

**Given** a visitor has pricing questions  
**When** viewing pricing  
**Then** an FAQ block is available in or directly below pricing  
**And** covers billing cycle, tier differences, upgrade path, and enterprise onboarding.

**AC8: Failure and edge handling**

**Given** tier query params are missing or invalid  
**When** signup loads  
**Then** system falls back to `free` safely and logs a validation-safe warning path.

**Given** a visitor lands on `/pricing` with tracking params  
**When** redirected to `/#pricing`  
**Then** supported campaign params are preserved.

## Technical Requirements

- Read and validate `tier` from signup route query params.
- Persist selected tier during verification handoff (parallel to `pendingOrgName`).
- Extend `registerWithTenant` to accept validated selected tier.
- Ensure tenant creation no longer hardcodes `free` for public signup path.
- Add `salesInquiry` table and mutation/action for Contact Sales submissions.
- Replace Enterprise `mailto:` CTA with in-app form trigger/path.
- Add FAQ component/content to pricing surface.
- Update story tasks/checklist and sprint evidence after implementation.

## Implementation Notes

- Keep pricing cards data-driven from subscription tier source.
- Maintain fallback behavior if tier catalog query is unavailable.
- Use strict allow-list for selectable self-serve tiers: `free`, `starter`, `professional`.
- Enterprise must never route into self-serve tenant signup.

## Tasks / Subtasks

- [x] Route `/pricing` to landing-page pricing anchor (`/#pricing`) (AC1)
- [x] Preserve selected query params on `/pricing` deep-link redirect where applicable (AC8)
- [x] Ensure pricing section includes 4 tiers with limits and features (AC2)
- [x] Remove/adjust feature truncation that can hide comparison detail (AC3)
- [x] Keep pricing in USD annual with fiscal-year context copy (AC4)
- [x] Parse and validate `tier` in signup route (AC5, AC8)
- [x] Persist selected tier across signup and verify-email steps (AC5)
- [x] Pass selected tier into tenant registration and persist on tenant record (AC5)
- [x] Implement Enterprise Contact Sales form UI (AC6)
- [x] Create backend `salesInquiry` schema + create mutation/action (AC6)
- [x] Add pricing FAQ section (AC7)
- [x] Add tests for tier propagation, enterprise flow, redirect behavior, and invalid-tier fallback (AC1, AC5, AC6, AC8)

### Review Follow-ups (AI)

- [x] Keep the pricing loading skeleton separate from fallback-catalog handling so the outage banner only appears after an actual timeout/offline/empty-catalog condition.
- [x] Narrow public OTP error mapping so unrelated backend `invalid` failures are not rewritten as bad verification-code errors.
- [x] Add a verified-user recovery path for organization-name conflicts by routing back into tenant setup retry instead of restarting account signup.

## Test Checklist

- [x] `/pricing` lands on pricing section on desktop and mobile
- [x] `/pricing?utm_source=x` keeps supported params after redirect
- [x] `signup?tier=starter` results in tenant tier `starter`
- [x] `signup?tier=professional` results in tenant tier `professional`
- [x] `signup?tier=invalid` falls back to `free`
- [x] Enterprise CTA does not create signup tenant directly
- [x] Contact Sales creates `salesInquiry` and returns confirmation
- [x] FAQ renders and is readable across breakpoints

## Definition of Done (Story 11.2)

- All ACs pass with evidence in PR notes or test artifacts.
- No regression to Story 11.1 landing behavior.
- Story and sprint status updated to reflect real implementation state.

## Dev Agent Record

### Debug Log

- 2026-03-10: Resolved post-review regressions in pricing loading, public verification error mapping, and verified-user organization setup recovery.
- 2026-03-10: Fixed signup verification recovery persistence, removed heuristic signup-to-OTP routing, and expanded regression coverage for pricing/signup persistence paths.
- 2026-03-10: Added the missing KES planning toggle, monthly-equivalent pricing breakdown, and stabilized signup-flow callback identities before final rendered-flow verification.
- 2026-03-10: Manual verification confirmed redirect preservation, pricing rendering across breakpoints, tier fallback/selection behavior, and enterprise inquiry success, so the story is complete.

### Completion Notes

- Pricing now preserves the skeleton state while the live Convex catalog is still loading and only falls back after timeout, offline detection, or a definitively empty catalog.
- Verification error sanitization now maps only actual OTP/code failures to the user-facing code message, leaving unrelated backend issues as generic outages.
- Verified users who lose an organization-name race can now go back to a tenant-setup retry form that reuses `registerWithTenant` without creating a second account.
- Added regression coverage for the pricing loading/fallback split and the narrowed verification-code error classifier.
- Pending signup state now persists the verification email alongside organization name and selected tier so refreshes return visitors to verification instead of restarting signup.
- Signup now relies on the auth provider result rather than broad error-message matching before moving into the verification step.
- Enterprise inquiry persistence logic is shared through tested helpers, and the story record now mirrors the actual changed implementation files.
- Pricing cards now support both USD and KES planning views using the PRD's fixed 130 KES/USD rate and show monthly-equivalent guidance without dropping the annual fiscal-year context.
- Signup-flow callback identities are now stable so the post-verification tenant-registration effect does not retrigger on unrelated parent rerenders.

## File List

- `webapp/app/(auth)/signup/page.tsx`
- `webapp/app/pricing/page.tsx`
- `webapp/convex/functions/salesInquiries.ts`
- `webapp/convex/functions/users.ts`
- `webapp/convex/schema.ts`
- `webapp/lib/auth/signup-flow.ts`
- `webapp/lib/errors/convex.ts`
- `webapp/lib/marketing/pricing.ts`
- `webapp/lib/security/input.ts`
- `webapp/lib/validators/auth.ts`
- `webapp/lib/validators/sales.ts`
- `webapp/src/components/auth/SignupFlow.tsx`
- `webapp/src/components/auth/SignupForm.tsx`
- `webapp/src/components/auth/VerifyEmailForm.tsx`
- `webapp/src/components/marketing/Pricing.tsx`
- `webapp/tests/convex-error-handling.test.ts`
- `webapp/tests/pricing-flow.test.ts`
- `webapp/tests/run-tests.ts`
- `webapp/tests/sales-inquiries.test.ts`
- `webapp/tests/signup-flow.test.ts`

## Change Log

- 2026-03-10: Addressed three code-review findings covering pricing fallback state, OTP error sanitization, and post-verification organization retry flow.
- 2026-03-10: Fixed signup verification-step persistence, removed heuristic OTP routing from signup errors, expanded pricing/signup regression coverage, and reconciled the story file list with the implementation diff.
- 2026-03-10: Added the KES planning toggle and monthly-equivalent pricing breakdown, stabilized signup-flow callbacks for verification recovery, and returned the story to review pending final rendered-flow checklist verification.
- 2026-03-10: Marked story done after manual confirmation of the remaining rendered-flow checklist items.
