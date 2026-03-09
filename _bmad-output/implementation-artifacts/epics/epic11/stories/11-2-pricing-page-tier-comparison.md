# Story 11.2: Pricing Experience & Tier Comparison

Status: ready-for-dev

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

## Out of Scope

- Standalone `/pricing` UI page
- KES/USD currency toggle
- Monthly equivalent pricing breakdown

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
- [ ] Preserve selected query params on `/pricing` deep-link redirect where applicable (AC8)
- [ ] Ensure pricing section includes 4 tiers with limits and features (AC2)
- [ ] Remove/adjust feature truncation that can hide comparison detail (AC3)
- [ ] Keep pricing in USD annual with fiscal-year context copy (AC4)
- [ ] Parse and validate `tier` in signup route (AC5, AC8)
- [ ] Persist selected tier across signup and verify-email steps (AC5)
- [ ] Pass selected tier into tenant registration and persist on tenant record (AC5)
- [ ] Implement Enterprise Contact Sales form UI (AC6)
- [ ] Create backend `salesInquiry` schema + create mutation/action (AC6)
- [ ] Add pricing FAQ section (AC7)
- [ ] Add tests for tier propagation, enterprise flow, redirect behavior, and invalid-tier fallback (AC1, AC5, AC6, AC8)

## Test Checklist

- [ ] `/pricing` lands on pricing section on desktop and mobile
- [ ] `/pricing?utm_source=x` keeps supported params after redirect
- [ ] `signup?tier=starter` results in tenant tier `starter`
- [ ] `signup?tier=professional` results in tenant tier `professional`
- [ ] `signup?tier=invalid` falls back to `free`
- [ ] Enterprise CTA does not create signup tenant directly
- [ ] Contact Sales creates `salesInquiry` and returns confirmation
- [ ] FAQ renders and is readable across breakpoints

## Definition of Done (Story 11.2)

- All ACs pass with evidence in PR notes or test artifacts.
- No regression to Story 11.1 landing behavior.
- Story and sprint status updated to reflect real implementation state.
