# Story 11.3: Public Role-Based Auth Entry

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **public visitor who needs access**,
I want a clear role-based auth entry page,
so that I can choose the correct path to create or access my account without confusion.

## Scope

- Create a public access hub at `/access` that helps visitors self-select the correct entry path.
- Route institution signup to the existing self-serve `/signup` flow.
- Route existing eligible users to the existing `/login` flow.
- Provide clear prerequisite guidance for Procurement Officer and Department User access without exposing unsafe self-signup.
- Preserve valid public-entry query context such as self-serve tier intent and recognized role-entry handoff params.
- Redirect already authenticated users away from the public entry hub to the correct in-app destination.
- Update the public-route registry and marketing entry points so the access hub is reachable from the public site.

## Out Of Scope

- Implementing Procurement Officer invitation redemption mechanics.
- Implementing Department User access-code authentication mechanics from Story 1.8.
- Changing the existing tenant-signup verification flow or email/password login behavior beyond entry-point linking.
- Adding platform-admin public onboarding.

## Acceptance Criteria

**AC1: Public auth hub route**

**Given** a visitor navigates to `/access`  
**When** the page renders  
**Then** the page is publicly reachable without authentication  
**And** it presents four clearly differentiated choices:

- Create Institution Account
- Procurement Officer Access
- Department User Access
- Sign In

**AC2: Institution self-serve path**

**Given** a visitor selects "Create Institution Account"  
**When** they continue  
**Then** they are routed to `/signup`  
**And** the messaging makes it clear that Free, Starter, and Professional are the only self-serve institution tiers.

**Given** a visitor reaches `/access` with a valid self-serve `tier` query param  
**When** they choose the institution-account path  
**Then** the selected tier is preserved into `/signup`  
**And** unsupported tier values fall back safely instead of creating an invalid signup state.

**AC3: Procurement Officer access guidance**

**Given** a visitor selects "Procurement Officer Access"  
**When** they view that path  
**Then** the page explains that Procurement Officers must already have either:

- an invitation link from their Tenant Admin
- a one-time activation code issued by their Tenant Admin

**And** the UI does not offer Procurement Officer public self-signup  
**And** the path offers a safe next step for already activated users to continue to `/login`.

**Given** a visitor lands on the public entry flow with recognized Procurement Officer invite context  
**When** they continue from the PO path  
**Then** the invite context is preserved for the next handoff step  
**And** the page does not discard activation information before later PO mechanics are implemented.

**AC4: Department User access guidance**

**Given** a visitor selects "Department User Access"  
**When** they view that path  
**Then** the page explains that Department Users need a department-scoped access code from their Procurement Officer  
**And** the UI does not offer Department User public self-signup  
**And** the page keeps the user on a role-specific DU guidance path that Story 1.8 can later extend into full access-code authentication without changing the public entry model.

**Given** a Department User finishes reading the guidance  
**When** they want to proceed  
**Then** the page offers an explicit DU continuation CTA or stable handoff route  
**And** the DU path is not a dead-end even before Story 1.8 finishes the full access-code implementation.

**AC5: Existing account sign-in**

**Given** a visitor selects "Sign In"  
**When** they continue  
**Then** they are routed to `/login`  
**And** this path remains the shared standard login route for existing eligible accounts.

**AC6: Marketing entry-point integration**

**Given** the public marketing surface needs a role-aware entry point  
**When** users encounter the relevant "Sign In / Join" or equivalent public access CTA  
**Then** the CTA routes to `/access` instead of forcing PO or DU users through tenant-admin or generic login assumptions  
**And** existing dedicated `/signup` pricing CTAs for self-serve tiers remain unchanged.

**AC7: Responsive and accessible presentation**

**Given** a visitor uses mobile, desktop, keyboard navigation, or assistive technology  
**When** they interact with the public auth hub  
**Then** the role options remain readable, actionable, and semantically grouped  
**And** the selected role guidance is announced and reachable without relying on hover-only interactions.

**AC8: Guardrails and route safety**

**Given** the public auth hub is introduced  
**When** proxy/public-route logic is evaluated  
**Then** `/access` is treated as a public route  
**And** protected dashboards remain protected  
**And** the implementation does not add any public route that implies a tenant-wide shared onboarding key or bypasses the existing role and tenant guard model.

**AC9: Authenticated-user handling**

**Given** an already authenticated user lands on `/access` directly or from a public CTA  
**When** the page evaluates their auth state  
**Then** the user is redirected to their correct post-login destination  
**And** authenticated users are not left on the public role-selection page unnecessarily.

## Tasks / Subtasks

- [x] Add a public access route model for Story 11.3 (AC: 1, 3, 4, 5, 8)
  - [x] Create a small pure helper module, for example `webapp/lib/auth/public-entry.ts`, to define role-card metadata, allowed role query values, and safe next-step resolution.
  - [x] Keep role labels aligned with persisted role values from `webapp/lib/auth/roles.ts` (`procurement_officer`, `department_user`) rather than inventing new storage names.
  - [x] Define which public-entry query params are preserved (`role`, valid self-serve `tier`, and recognized opaque invite/access handoff params).
  - [x] Fail closed on unsupported role query params by falling back to the neutral `/access` view.
  - [x] Fail closed on unsupported tier values by falling back to the default institution path without losing page stability.

- [x] Create the public access hub page outside the narrow `(auth)` layout (AC: 1, 3, 4, 7, 9)
  - [x] Implement `webapp/app/access/page.tsx` as the public hub page.
  - [x] Keep the page outside `webapp/app/(auth)/layout.tsx`, because that layout currently constrains pages to `max-w-md` and is too narrow for a four-choice entry hub.
  - [x] Use role cards plus an explanatory detail panel or stacked sections for PO/DU guidance.
  - [x] Support deep-linkable role state such as `/access?role=procurement_officer` and `/access?role=department_user` without requiring extra placeholder routes.
  - [x] If the visitor is already authenticated, redirect them to the correct home path (or neutral dashboard fallback if role resolution is incomplete).

- [x] Wire the safe downstream entry points (AC: 2, 3, 4, 5)
  - [x] Route institution signup to the existing `/signup` page and preserve valid self-serve tier intent when present.
  - [x] Route standard sign-in to the existing `/login` page.
  - [x] For Procurement Officer guidance, provide clear copy for invitation-link and activation-code prerequisites plus a login CTA for already activated users.
  - [x] Preserve recognized PO invite context across the next-step CTA instead of dropping it on the public hub.
  - [x] For Department User guidance, provide clear copy for department access-code prerequisites and preserve a stable DU guidance state that Story 1.8 can later extend.
  - [x] Provide an explicit DU continuation CTA or stable route contract so the DU branch cannot become a dead-end.

- [x] Update public-site entry points to expose `/access` (AC: 6)
  - [x] Audit marketing components that currently assume only `/signup` or `/login`, especially `webapp/src/components/marketing/Navbar.tsx`, `webapp/src/components/marketing/Hero.tsx`, and `webapp/src/components/marketing/Footer.tsx`.
  - [x] Introduce or relabel the public role-aware CTA as "Sign In / Join" or equivalent where it best fits the current marketing UI.
  - [x] Do not break the self-serve pricing CTA behavior added in Story 11.2.

- [x] Register the new public route in proxy/auth configuration (AC: 1, 8)
  - [x] Add `/access` to `webapp/lib/auth/public-routes.ts`.
  - [x] Confirm proxy/public-route behavior remains separate from role-protected prefixes.

- [x] Add focused regression tests (AC: 1, 5, 6, 8, 9)
  - [x] Add pure tests for role resolution and invalid query-param fallback.
  - [x] Add tests for valid/invalid `tier` passthrough from `/access` into `/signup`.
  - [x] Add tests for recognized PO invite-context passthrough so opaque handoff params are not dropped.
  - [x] Add tests asserting the DU branch exposes a concrete continuation CTA or route contract.
  - [x] Extend `webapp/tests/proxy.test.ts` to cover `/access` as a public route.
  - [x] Add tests ensuring tenant-admin signup still uses `/signup` and existing sign-in still uses `/login`.
  - [x] Add tests for authenticated-user redirects away from `/access`.
  - [x] Add a lightweight rendering or helper-level test to assert PO/DU paths do not expose self-signup copy.

## Implementation Checklist

- Build the entry hub at `webapp/app/access/page.tsx`, not inside the current `(auth)` layout.
- Add `/access` to the public-route registry before testing navigation behavior.
- Centralize role-entry and passthrough logic in a pure helper instead of embedding it directly in the page.
- Reuse existing self-serve tier resolution from `webapp/lib/marketing/pricing.ts`.
- Preserve valid `tier` query params when handing institution signup off to `/signup`.
- Preserve recognized opaque PO invite or activation params instead of dropping them on the hub page.
- Route standard sign-in to `/login` without introducing role-specific login forks.
- Redirect already authenticated users to their correct home path instead of showing the public entry screen.
- Ensure the DU branch has a visible continuation CTA or stable route contract and is not just informational text.
- Keep PO and DU paths guidance-only for this story; do not introduce public self-signup for those roles.

## Anti-Patterns To Avoid

- Do not rebuild signup or login flows that already exist.
- Do not create a second allow-list for self-serve tiers when pricing helpers already define one.
- Do not lose query params during role selection and CTA handoff.
- Do not leave authenticated users stranded on `/access`.
- Do not make the DU path a dead end while waiting for Story 1.8.

## Dev Notes

### Story Foundation

- Story 11.3 is the bridge between the public marketing surface from Story 11.1 and the real auth mechanics already delivered in Stories 1.2 and 1.3.
- This is a frontend-led routing and explanatory-UX story. It should not invent unfinished backend auth mechanics for Procurement Officers or Department Users.
- The most important product constraint is safety: Tenant Admins may self-serve, but Procurement Officers and Department Users must only enter through provisioned role-specific paths.
- The story should correct the current public-entry ambiguity without regressing the working signup, verification, pricing-tier, and login flows already in the repo.

### Current Implementation State Discovered In Code

- `webapp/app/(auth)/signup/page.tsx` already resolves allowed self-serve tiers and renders `SignupFlow`.
- `webapp/app/(auth)/login/page.tsx` already renders the shared standard email/password login flow.
- `webapp/src/components/auth/SignupForm.tsx`, `SignupFlow.tsx`, and `VerifyEmailForm.tsx` already persist pending signup state, selected tier, and verification recovery details. Story 11.3 must reuse those flows rather than fork them.
- `webapp/lib/auth/public-routes.ts` currently allows only `/`, `/signup`, `/login`, `/forgot-password`, `/reset-password`, and `/pricing`; `/access` does not exist yet.
- `webapp/proxy.ts` uses `PUBLIC_ROUTES` to determine optimistic public access at the edge, so the new entry page must be registered there.
- The current auth layout in `webapp/app/(auth)/layout.tsx` centers content in a `max-w-md` container. That is a poor fit for a four-way public role-selection page.
- Marketing components currently link directly to `/signup` or `/login`:
  - `webapp/src/components/marketing/Navbar.tsx`
  - `webapp/src/components/marketing/Hero.tsx`
  - `webapp/src/components/marketing/Footer.tsx`
- The repo uses `webapp/app/...` rather than the older `webapp/src/app/...` path shown in some planning artifacts. Follow the live repo structure.

### Recommended Route Model

- Add a new public hub at `webapp/app/access/page.tsx`.
- Keep `/access` outside the `(auth)` route group so it does not inherit the narrow centered-card layout.
- Represent PO and DU path selection as a safe, deep-linkable state on the same page using a validated query param such as `role=procurement_officer` or `role=department_user`.
- Allow `/access` to preserve a valid self-serve `tier` query param when the visitor eventually chooses institution signup.
- Preserve recognized PO/DU handoff params as opaque values instead of parsing or mutating them on the public entry page.
- Keep the real downstream routes unchanged:
  - Tenant Admin self-serve: `/signup`
  - Existing account login: `/login`
- Do not create broken placeholder routes for PO or DU authentication in this story unless they render useful guidance immediately. Story 1.8 should be able to extend the DU guidance state into real access-code auth without forcing a public-entry redesign.
- If the viewer is already authenticated, `/access` should behave like a redirect surface, not a second onboarding choice screen.

### Reuse And Anti-Reinvention Guidance

- Reuse the existing auth pages rather than cloning login or signup into role-specific variants.
- Reuse `webapp/lib/auth/roles.ts` for canonical role labels and naming consistency.
- Reuse existing tier helpers from `webapp/lib/marketing/pricing.ts` for valid self-serve tier resolution instead of creating a second allow-list.
- Reuse the current card/button primitives from shadcn/ui instead of adding a new component library.
- Reuse the public-route registry and proxy test pattern already established in `webapp/lib/auth/public-routes.ts` and `webapp/tests/proxy.test.ts`.
- Reuse the validation style already used in `webapp/lib/validators/auth.ts` and `webapp/lib/security/input.ts` for any query-param or public-entry helpers.
- Reuse the existing auth-context/home-path helpers for redirecting authenticated users instead of inventing a new destination map.
- Do not reintroduce public self-signup language for PO or DU roles, and do not imply a shared tenant-wide onboarding secret.

### Architecture Compliance

- Public auth entry should remain a public page, but real authorization still lives in Convex-backed role and tenant logic.
- The story must preserve the existing separation:
  - public pages in `webapp/app/...`,
  - auth forms in `webapp/app/(auth)/...`,
  - protected role dashboards in `webapp/app/(app)/...`,
  - route classification in `webapp/lib/auth/public-routes.ts`,
  - role semantics in `webapp/lib/auth/roles.ts`.
- Because current package reality differs from some older architecture snippets, prefer the live repo:
  - page files under `webapp/app/...`,
  - path alias `@/*` resolves from the `webapp/` root,
  - React 19 + Next.js 16 conventions are already active.

### Security And Scope Boundaries

- Do not let PO or DU visitors create accounts through the tenant-admin self-serve signup form.
- Do not expose platform-admin onboarding on any public path.
- Do not weaken the current proxy/public-route boundary; `/access` should be public, but `/platform-admin`, `/tenant-admin`, `/po`, and `/du` must stay protected.
- Do not add client-only assumptions that bypass the role guard or tenant isolation rules already established in Stories 1.6 and 1.7.
- Keep copy precise and non-leaky: explain prerequisites without exposing internal invite-generation mechanics or sensitive tenant state.
- Do not drop opaque invitation or activation context that arrived through a public deep link.
- Do not leave authenticated users on a public entry page where they could be confused into restarting onboarding.

### Technical Requirements

- New route:
  - `webapp/app/access/page.tsx`
- Supporting helper module:
  - recommended `webapp/lib/auth/public-entry.ts`
- Public route registration:
  - update `webapp/lib/auth/public-routes.ts`
- Marketing integration touch points:
  - `webapp/src/components/marketing/Navbar.tsx`
  - `webapp/src/components/marketing/Hero.tsx`
  - `webapp/src/components/marketing/Footer.tsx`
  - optionally other public CTA surfaces if the final UX chooses them
- Query-param behavior:
  - validate supported role values
  - preserve valid self-serve `tier` intent for institution signup
  - preserve recognized PO/DU handoff params as opaque passthrough values
  - ignore/fallback on unsupported values
  - keep the default neutral `/access` state usable without query params
- Content behavior:
  - institution path clearly names Free, Starter, and Professional as self-serve
  - PO path names invitation link and one-time activation code prerequisites
  - DU path names department-scoped access code prerequisite
  - DU path offers a concrete continuation CTA or stable route contract
  - standard sign-in path routes to `/login`
  - authenticated viewers are redirected to the correct in-app destination

### Library And Framework Requirements

- Use Next.js App Router patterns already present in the repo.
- Treat `searchParams` as the async page prop shape used by the current Next.js version already in this codebase.
- Use shadcn/ui `Card`, `Button`, and existing typography/layout primitives where appropriate.
- Keep the page server-first unless an interaction truly requires `'use client'`; if only query-param-driven rendering is needed, prefer server rendering plus plain links over extra client state.
- Keep helper logic pure and testable so it can be covered in the existing Node-based `webapp/tests/*.test.ts` harness.

### File Structure Requirements

- Expected new files:
  - `webapp/app/access/page.tsx`
  - `webapp/lib/auth/public-entry.ts`
  - `webapp/tests/public-auth-entry.test.ts`
- Expected updates:
  - `webapp/lib/auth/public-routes.ts`
  - `webapp/tests/proxy.test.ts`
  - `webapp/tests/run-tests.ts`
  - one or more public marketing components that surface the new CTA

### Testing Requirements

- Helper tests:
  - allowed role query values resolve correctly
  - invalid role query values fall back safely
  - valid `tier` values are preserved into institution signup
  - invalid `tier` values fail closed safely
  - recognized PO/DU handoff params remain intact through the next-step CTA
  - PO and DU guidance metadata never advertise self-signup
- Route/public-access tests:
  - `/access` is classified as public
  - protected dashboard prefixes remain non-public
- UI behavior checks:
  - institution CTA routes to `/signup`
  - sign-in CTA routes to `/login`
  - authenticated users are redirected away from `/access`
  - DU branch exposes a visible non-dead-end continuation action
  - role-specific guidance remains readable at mobile and desktop breakpoints
- Regression checks:
  - no change to pricing-tier preselection behavior from Story 11.2
  - no change to existing login and signup route behavior

### Critical Edge Cases

- A visitor lands directly on `/access?role=department_user` or `/access?role=procurement_officer`; the page must render the correct guidance without requiring prior navigation.
- A visitor lands on `/access?tier=starter` or `/access?tier=professional`; the institution CTA must preserve that intent.
- A visitor passes an unsupported `role` query param; the page must not crash or expose hidden states.
- A visitor passes an unsupported `tier` or malformed invite param; the page must ignore it safely without breaking the entry flow.
- A visitor opens a PO invite deep link on the public entry page; the implementation must not discard opaque activation context before handoff.
- Marketing links should not accidentally send existing tenant admins to a generic PO/DU explanation when they simply need `/login`.
- An already authenticated user reaches `/access`; they should be redirected rather than seeing duplicate public-entry choices.
- The new access hub must not inherit the `max-w-md` auth-card layout unless the design is intentionally reworked to fit that constraint.
- If future Story 1.8 introduces a dedicated DU route, Story 11.3 should not force another public CTA rewrite; keep the entry abstraction stable now.

### Previous Story Intelligence

**From Story 11.2**

- Pricing and signup already preserve self-serve tier intent through query params, verification, and tenant creation. Story 11.3 must leave that flow intact.
- The pricing story deliberately keeps Enterprise outside self-serve signup. Story 11.3 should follow the same product rule for role access: not every role gets a public signup path.
- Recent fixes tightened fallback handling and public-flow error messaging. Keep the same fail-safe tone here: clear for the user, but not overly specific about backend internals.

**From Stories 1.2 and 1.3**

- Tenant-admin signup is already real and production-shaped; route to it rather than recreating a new public registration page.
- Standard login is already the canonical entry for existing eligible accounts; do not split it into role-specific login pages in this story.
- Signup and verification flows already use sessionStorage to preserve recovery state. Story 11.3 should not interfere with those storage keys or invent parallel state.
- Existing auth-context helpers already know where authenticated users belong after sign-in; the public entry page should reuse that instead of inventing a second redirect matrix.

### Git Intelligence Summary

- Recent public-entry-adjacent work was concentrated in Story 11.2:
  - `507afa8` added pricing-route deep linking, self-serve tier propagation, sales inquiry handling, and public signup-flow recovery improvements.
  - `d06f0c1` tightened pricing/signup public-flow fixes and related validation behavior.
- The useful pattern from those commits is centralization:
  - public-flow resolution logic lives in pure helper modules such as `webapp/lib/marketing/pricing.ts`,
  - route pages stay thin,
  - tests cover helper behavior directly in the lightweight Node harness.
- Story 11.3 should follow that same pattern by centralizing role-entry mapping in a pure helper instead of burying all logic directly inside the page component.

### Latest Tech Information

- Verified on March 11, 2026 against official documentation:
  - Next.js App Router docs continue to treat `searchParams` on page files as an async prop shape in current versions, which matches the existing repo pattern already used in `webapp/app/(auth)/signup/page.tsx` and `webapp/app/pricing/page.tsx`.
  - Next.js route-group guidance confirms route groups are for organization only and do not affect the URL path, which supports placing `/access` outside `(auth)` while keeping the URL clean.
  - Next.js `redirect` remains the correct server-side primitive for route entrypoints like the current `/pricing` deep-link page; Story 11.3 does not need a redirect, but should stay consistent with App Router server patterns.
  - Convex error-handling guidance still recommends `ConvexError` for expected application failures; if this story adds any shared helper that later touches Convex-backed routes, keep expected-error semantics aligned with that pattern.
  - shadcn/ui card primitives remain the appropriate low-level building block for grouped public-entry choices in a Tailwind-based app like this one.

### Project Context Reference

- Keep to strict TypeScript and path-alias usage.
- Prefer server-rendered pages by default.
- Use shadcn/ui plus Tailwind for consistent UI.
- Preserve the role and tenant safety posture already established in the repo.
- Where `_bmad-output/project-context.md` conflicts with the live repo, prefer the live repo versions and file paths.

### Project Structure Notes

- Current repo alignment:
  - public auth forms live in `webapp/app/(auth)/...`
  - public marketing pages live directly under `webapp/app/...`
  - protected role routes live under `webapp/app/(app)/...`
  - public-route classification lives in `webapp/lib/auth/public-routes.ts`
- Detected conflict or variance to call out explicitly:
  - older planning artifacts often reference `webapp/src/app/...`, but the real project uses `webapp/app/...`
  - the current `(auth)` layout is intentionally narrow and should not be reused blindly for a multi-option access hub
  - the epic shorthand `PO` and `DU` should map back to real persisted values `procurement_officer` and `department_user`

### References

- [Sprint Status](./sprint-status.yaml)
- [Epic 11 Source](./epics/epic11/epic-11-marketing-onboarding.md)
- [Story 11.2](./epics/epic11/completed/11-2-pricing-page-tier-comparison.md)
- [Story 11.1](./epics/epic11/completed/11-1-marketing-landing-page.md)
- [Epic 1 Source](./epics/epic1/epic-01-foundation-authentication.md)
- [Story 1.2](./epics/epic1/completed/1-2-tenant-admin-registration-free-tier-signup.md)
- [Story 1.3](./epics/epic1/completed/1-3-user-login-with-email-password.md)
- [Project Context](../project-context.md)
- [Architecture](../planning-artifacts/architecture.md)
- [PRD](../planning-artifacts/prd.md)
- [UX Design](../planning-artifacts/ux-design-specification.md)
- [Current Signup Page](../../webapp/app/(auth)/signup/page.tsx)
- [Current Login Page](../../webapp/app/(auth)/login/page.tsx)
- [Current Auth Layout](../../webapp/app/(auth)/layout.tsx)
- [Current Landing Page](../../webapp/app/page.tsx)
- [Current Pricing Redirect Page](../../webapp/app/pricing/page.tsx)
- [Current Public Routes](../../webapp/lib/auth/public-routes.ts)
- [Current Proxy](../../webapp/proxy.ts)
- [Current Signup Flow](../../webapp/src/components/auth/SignupFlow.tsx)
- [Current Signup Form](../../webapp/src/components/auth/SignupForm.tsx)
- [Current Verify Email Form](../../webapp/src/components/auth/VerifyEmailForm.tsx)
- [Current Login Form](../../webapp/src/components/auth/LoginForm.tsx)
- [Current Role Helpers](../../webapp/lib/auth/roles.ts)
- [Current Marketing Pricing Helpers](../../webapp/lib/marketing/pricing.ts)
- [Current Proxy Tests](../../webapp/tests/proxy.test.ts)
- [Current Signup Tests](../../webapp/tests/signup-flow.test.ts)
- [Current Pricing Tests](../../webapp/tests/pricing-flow.test.ts)
- [Next.js Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Next.js redirect](https://nextjs.org/docs/app/api-reference/functions/redirect)
- [Next.js page searchParams](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional)
- [Convex Auth](https://docs.convex.dev/auth)
- [Convex Error Handling](https://docs.convex.dev/functions/error-handling)
- [shadcn/ui Card](https://ui.shadcn.com/docs/components/card)

## Change Log

- 2026-03-11: Created Story 11.3 as a dedicated implementation-ready story artifact from Epic 11 and current repo state.
- 2026-03-11: Chose `/access` as the canonical public role-aware auth entry route so signup and login can stay intact while PO/DU guidance remains safe and extendable.
- 2026-03-11: Anchored the story to the live `webapp/app/...` structure and called out the current `(auth)` layout width constraint so the dev agent does not accidentally build the hub inside the wrong layout.
- 2026-03-11: Added repo-specific test, proxy, and marketing-surface guidance so implementation can extend existing patterns instead of inventing new auth-entry plumbing.
- 2026-03-11: Enhanced the story after edge-case review to cover self-serve tier passthrough, PO invite-context preservation, DU non-dead-end continuation, and authenticated-user redirects.
- 2026-03-11: Implemented the public `/access` hub, centralized passthrough helpers, and authenticated-user redirects while keeping signup and login on their existing routes.
- 2026-03-11: Updated marketing entry points to use the role-aware `/access` CTA and added focused helper/proxy regression coverage plus lint and test validation.

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Workflow engine: `_bmad/core/tasks/workflow.xml`
- Create-story workflow: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Create-story instructions: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Create-story checklist: `_bmad/bmm/workflows/4-implementation/create-story/checklist.md`
- Sprint source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic sources:
  - `_bmad-output/implementation-artifacts/epics/epic11/epic-11-marketing-onboarding.md`
  - `_bmad-output/implementation-artifacts/epics/epic1/epic-01-foundation-authentication.md`
- Previous story sources:
  - `_bmad-output/implementation-artifacts/epics/epic11/completed/11-1-marketing-landing-page.md`
  - `_bmad-output/implementation-artifacts/epics/epic11/completed/11-2-pricing-page-tier-comparison.md`
  - `_bmad-output/implementation-artifacts/epics/epic1/completed/1-2-tenant-admin-registration-free-tier-signup.md`
  - `_bmad-output/implementation-artifacts/epics/epic1/completed/1-3-user-login-with-email-password.md`
- Planning sources:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
  - `_bmad-output/project-context.md`
- Current implementation sources:
  - `webapp/package.json`
  - `webapp/app/page.tsx`
  - `webapp/app/pricing/page.tsx`
  - `webapp/app/access/page.tsx`
  - `webapp/app/(auth)/layout.tsx`
  - `webapp/app/(auth)/signup/page.tsx`
  - `webapp/app/(auth)/login/page.tsx`
  - `webapp/src/components/auth/SignupFlow.tsx`
  - `webapp/src/components/auth/SignupForm.tsx`
  - `webapp/src/components/auth/VerifyEmailForm.tsx`
  - `webapp/src/components/auth/LoginForm.tsx`
  - `webapp/src/components/auth/PublicAccessGate.tsx`
  - `webapp/src/components/marketing/Navbar.tsx`
  - `webapp/src/components/marketing/Hero.tsx`
  - `webapp/src/components/marketing/Footer.tsx`
  - `webapp/lib/auth/public-entry.ts`
  - `webapp/lib/auth/public-routes.ts`
  - `webapp/lib/auth/roles.ts`
  - `webapp/lib/auth/signup-flow.ts`
  - `webapp/lib/marketing/pricing.ts`
  - `webapp/lib/security/input.ts`
  - `webapp/lib/validators/auth.ts`
  - `webapp/proxy.ts`
  - `webapp/tests/proxy.test.ts`
  - `webapp/tests/public-auth-entry.test.ts`
  - `webapp/tests/pricing-flow.test.ts`
  - `webapp/tests/signup-flow.test.ts`
  - `webapp/tests/rbac.test.ts`
  - `webapp/tests/run-tests.ts`
- Git context:
  - `git log --pretty=format:"%h %ad %s" --date=short -5`
  - `git show --stat --format=medium 507afa8`
  - `git show --stat --format=medium d06f0c1`
- Validation commands:
  - `npm.cmd test`
  - `npm.cmd run lint`
- External validation sources:
  - `https://nextjs.org/docs/app/building-your-application/routing/route-groups`
  - `https://nextjs.org/docs/app/api-reference/functions/redirect`
  - `https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional`
  - `https://docs.convex.dev/auth`
  - `https://docs.convex.dev/functions/error-handling`
  - `https://ui.shadcn.com/docs/components/card`

### Completion Notes List

- 2026-03-11: Identified `11-3-public-role-based-auth-entry` in sprint status and confirmed it was still in `backlog`.
- 2026-03-11: Loaded Epic 11, Epic 1, prior completed stories, project context, architecture, UX, current auth pages, marketing pages, route registry, and regression tests before drafting the story.
- 2026-03-11: Chose a stable `/access` public-entry route that reuses existing `/signup` and `/login` pages while safely handling unfinished PO/DU downstream mechanics.
- 2026-03-11: Flagged the current `(auth)` layout width constraint so implementation does not accidentally place the multi-choice hub in a `max-w-md` container.
- 2026-03-11: Marked the story ready for development after generating this implementation-ready context document.
- 2026-03-11: Added explicit guardrails for tier passthrough, preserved invite context, authenticated-user redirects, and a non-dead-end DU continuation path.
- 2026-03-11: Implemented `webapp/lib/auth/public-entry.ts` to centralize role-state validation, safe tier passthrough, PO invite-context preservation, DU continuation routing, and authenticated-user redirect resolution.
- 2026-03-11: Built `webapp/app/access/page.tsx` outside the `(auth)` layout with four role choices, accessible deep-linkable guidance panels, and a client auth gate that redirects authenticated users to their existing destinations.
- 2026-03-11: Updated `Navbar`, `Hero`, and `Footer` to expose the new `/access` role-aware CTA while preserving self-serve institution signup elsewhere.
- 2026-03-11: Added `webapp/tests/public-auth-entry.test.ts`, extended proxy coverage for `/access`, and passed `npm.cmd test` plus `npm.cmd run lint`.
- 2026-03-11: Regenerated the tracked `.test-dist` test-build outputs that this repo's Node test harness emits for helper and proxy coverage.
- 2026-03-11: Fixed the pre-review audit findings by preserving Procurement Officer invite context across shared sign-in actions and adding `/access/department-user` as a distinct public Department User continuation route contract.

### File List

- `_bmad-output/implementation-artifacts/11-3-public-role-based-auth-entry.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `webapp/app/access/page.tsx`
- `webapp/app/access/department-user/page.tsx`
- `webapp/.test-dist/app/constants.js`
- `webapp/.test-dist/lib/auth/public-entry.js`
- `webapp/.test-dist/lib/auth/public-routes.js`
- `webapp/.test-dist/tests/proxy.test.js`
- `webapp/.test-dist/tests/public-auth-entry.test.js`
- `webapp/.test-dist/tests/run-tests.js`
- `webapp/lib/auth/public-entry.ts`
- `webapp/lib/auth/public-routes.ts`
- `webapp/src/components/auth/PublicAccessGate.tsx`
- `webapp/src/components/marketing/Footer.tsx`
- `webapp/src/components/marketing/Hero.tsx`
- `webapp/src/components/marketing/Navbar.tsx`
- `webapp/tests/proxy.test.ts`
- `webapp/tests/public-auth-entry.test.ts`
- `webapp/tests/run-tests.ts`

### Story Completion Status

- Story ID: `11.3`
- Story Key: `11-3-public-role-based-auth-entry`
- Output File: `_bmad-output/implementation-artifacts/11-3-public-role-based-auth-entry.md`
- Final Status: `review`
- Completion Note: `Implemented the /access public auth hub, updated marketing entry points, and validated the new helper and proxy coverage with passing test and lint runs`
