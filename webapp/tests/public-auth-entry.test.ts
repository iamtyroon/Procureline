import assert from "node:assert/strict";
import {
    AUTH_ENTRY_ROUTE,
    DEPARTMENT_USER_ACCESS_ROUTE,
    MARKETING_ACCESS_CTA,
    PROCUREMENT_OFFICER_ACCESS_ROUTE,
    PUBLIC_ACCESS_CHOICES,
    RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS,
    buildPublicEntryLandingHref,
    resolveAuthenticatedAccessRedirect,
    resolvePublicEntryState,
} from "../lib/auth/public-entry";
import { scrubDepartmentUserAccessCodeFromUrl } from "../lib/auth/department-user-access";
import { SESSION_EXPIRED_REDIRECT_PATH } from "../lib/auth/proxy";

function toUrl(path: string): URL {
    return new URL(path, "https://example.test");
}

export function runPublicAuthEntryTests(): string[] {
    const completedTests: string[] = [];

    const neutralState = resolvePublicEntryState({});
    assert.equal(neutralState.activeRole, null);
    assert.equal(neutralState.institutionHref, "/signup");
    assert.equal(neutralState.signInHref, "/login");
    completedTests.push(
        "public access entry defaults to a neutral hub while keeping institution signup and shared sign-in on their existing routes",
    );

    const starterTierState = resolvePublicEntryState({
        invite: "tenant-admin-token",
        tier: "starter",
    });
    assert.equal(
        starterTierState.institutionHref,
        "/signup?tier=starter&invite=tenant-admin-token",
    );
    assert.equal(starterTierState.shouldWarnOnInvalidTier, false);

    const invalidTierState = resolvePublicEntryState({
        invite: "tenant-admin-token",
        tier: "enterprise",
    });
    assert.equal(
        invalidTierState.institutionHref,
        "/signup?invite=tenant-admin-token",
    );
    assert.equal(invalidTierState.shouldWarnOnInvalidTier, true);
    completedTests.push(
        "public access preserves valid self-serve tier intent and opaque invite context into signup while still failing closed on unsupported tier values",
    );

    const procurementOfficerState = resolvePublicEntryState({
        activationCode: "ACT-001",
        ignored: "drop-me",
        invite: "po-invite-token",
        role: "procurement_officer",
    });
    const procurementOfficerUrl = toUrl(
        procurementOfficerState.procurementOfficerLoginHref,
    );
    const procurementOfficerAccessUrl = toUrl(
        procurementOfficerState.procurementOfficerAccessHref,
    );
    const procurementOfficerSelectionUrl = toUrl(
        procurementOfficerState.procurementOfficerSelectionHref,
    );
    assert.equal(procurementOfficerState.activeRole, "procurement_officer");
    assert.equal(procurementOfficerUrl.pathname, PROCUREMENT_OFFICER_ACCESS_ROUTE);
    assert.equal(
        procurementOfficerAccessUrl.pathname,
        PROCUREMENT_OFFICER_ACCESS_ROUTE,
    );
    assert.equal(procurementOfficerSelectionUrl.pathname, AUTH_ENTRY_ROUTE);
    assert.equal(procurementOfficerSelectionUrl.hash, "#role-guidance");
    assert.equal(procurementOfficerUrl.searchParams.get("invite"), "po-invite-token");
    assert.equal(procurementOfficerUrl.searchParams.get("activationCode"), "ACT-001");
    assert.equal(
        procurementOfficerAccessUrl.searchParams.get("invite"),
        "po-invite-token",
    );
    assert.equal(procurementOfficerUrl.searchParams.get("ignored"), null);
    assert.equal(
        procurementOfficerState.signInHref,
        "/access/procurement-officer?invite=po-invite-token&activationCode=ACT-001",
    );
    completedTests.push(
        "procurement officer handoff preserves only the recognized opaque invite context while routing sign-in intent to the dedicated Procurement Officer access flow",
    );

    const implicitProcurementOfficerState = resolvePublicEntryState({
        activationToken: "po-activation-token",
    });
    assert.equal(
        implicitProcurementOfficerState.activeRole,
        "procurement_officer",
    );
    assert.equal(
        implicitProcurementOfficerState.signInHref,
        "/access/procurement-officer?activationToken=po-activation-token",
    );
    completedTests.push(
        "recognized procurement officer handoff params auto-select the PO guidance path even when the link omits an explicit role query",
    );

    const invalidRoleState = resolvePublicEntryState({
        role: "platform_admin",
    });
    assert.equal(invalidRoleState.activeRole, null);
    assert.equal(invalidRoleState.shouldWarnOnInvalidRole, true);
    completedTests.push(
        "unsupported role query values fail closed back to the neutral access hub instead of exposing hidden states",
    );

    const genericLandingUrl = toUrl(buildPublicEntryLandingHref({}));
    const implicitPoLandingUrl = toUrl(
        buildPublicEntryLandingHref({
            activationToken: "po-activation-token",
        }),
    );
    const invalidLandingUrl = toUrl(
        buildPublicEntryLandingHref({
            role: "platform_admin",
            tier: "enterprise",
        }),
    );
    assert.equal(genericLandingUrl.pathname, AUTH_ENTRY_ROUTE);
    assert.equal(genericLandingUrl.hash, "#access-paths");
    assert.equal(implicitPoLandingUrl.hash, "#role-guidance");
    assert.equal(
        implicitPoLandingUrl.searchParams.get("activationToken"),
        "po-activation-token",
    );
    assert.equal(invalidLandingUrl.hash, "#access-paths");
    assert.equal(invalidLandingUrl.searchParams.get("role"), "platform_admin");
    assert.equal(invalidLandingUrl.searchParams.get("tier"), "enterprise");
    completedTests.push(
        "public access landing links preserve query context while keeping /access as the dedicated role-aware hub",
    );

    const departmentUserState = resolvePublicEntryState({
        accessCode: "DU-2026-ABC",
        role: "department_user",
    });
    const departmentUserUrl = toUrl(
        departmentUserState.departmentUserContinueHref,
    );
    const departmentUserSelectionUrl = toUrl(
        departmentUserState.departmentUserSelectionHref,
    );
    assert.equal(departmentUserState.activeRole, "department_user");
    assert.equal(departmentUserUrl.pathname, DEPARTMENT_USER_ACCESS_ROUTE);
    assert.equal(departmentUserSelectionUrl.pathname, AUTH_ENTRY_ROUTE);
    assert.equal(departmentUserSelectionUrl.hash, "#role-guidance");
    assert.equal(
        departmentUserUrl.searchParams.get("accessCode"),
        "DU-2026-ABC",
    );
    completedTests.push(
        "department user guidance exposes a distinct continuation route contract without opening public self-signup",
    );

    assert.equal(
        scrubDepartmentUserAccessCodeFromUrl(
            "/access/department-user",
            "?accessCode=DU-2026-ABC&role=department_user",
        ),
        "/access/department-user?role=department_user",
    );
    completedTests.push(
        "department user deep links can prefill the code and then scrub it from the browser URL without changing the continuation route",
    );

    const institutionChoice = PUBLIC_ACCESS_CHOICES.find(
        (choice) => choice.key === "institution",
    );
    const procurementOfficerChoice = PUBLIC_ACCESS_CHOICES.find(
        (choice) => choice.key === "procurement_officer",
    );
    const departmentUserChoice = PUBLIC_ACCESS_CHOICES.find(
        (choice) => choice.key === "department_user",
    );
    const signInChoice = PUBLIC_ACCESS_CHOICES.find(
        (choice) => choice.key === "sign_in",
    );

    assert.equal(institutionChoice?.defaultHref, "/signup");
    assert.equal(signInChoice?.defaultHref, "/login");
    assert.equal(procurementOfficerChoice?.supportsSelfSignup, false);
    assert.equal(departmentUserChoice?.supportsSelfSignup, false);
    assert.equal(AUTH_ENTRY_ROUTE, "/access");
    assert.equal(MARKETING_ACCESS_CTA.href, AUTH_ENTRY_ROUTE);
    assert.ok(
        MARKETING_ACCESS_CTA.label.includes("Access"),
        "expected the marketing CTA label to surface the role-aware access hub",
    );
    assert.equal(RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS.includes("invite"), true);
    completedTests.push(
        "access entry metadata keeps tenant-admin signup and sign-in links intact while preventing PO and DU self-signup messaging",
    );

    assert.equal(resolveAuthenticatedAccessRedirect(undefined), null);
    assert.equal(
        resolveAuthenticatedAccessRedirect(null),
        SESSION_EXPIRED_REDIRECT_PATH,
    );
    assert.equal(
        resolveAuthenticatedAccessRedirect({
            accessState: "allowed",
            homePath: "/po",
            isRoleResolved: true,
            isSessionValid: true,
            redirectPath: "/po",
        }),
        "/po",
    );
    assert.equal(
        resolveAuthenticatedAccessRedirect({
            accessState: "pending_access",
            homePath: "/dashboard",
            isRoleResolved: false,
            isSessionValid: true,
            redirectPath: "/dashboard?reason=pending_access",
        }),
        "/dashboard?reason=pending_access",
    );
    completedTests.push(
        "authenticated visitors to the public access hub are redirected to their existing in-app destination instead of staying on the public chooser",
    );

    return completedTests;
}
