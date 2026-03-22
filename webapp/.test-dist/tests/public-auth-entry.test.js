"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPublicAuthEntryTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const public_entry_1 = require("../lib/auth/public-entry");
const department_user_access_1 = require("../lib/auth/department-user-access");
const proxy_1 = require("../lib/auth/proxy");
function toUrl(path) {
    return new URL(path, "https://example.test");
}
function runPublicAuthEntryTests() {
    const completedTests = [];
    const neutralState = (0, public_entry_1.resolvePublicEntryState)({});
    strict_1.default.equal(neutralState.activeRole, null);
    strict_1.default.equal(neutralState.institutionHref, "/signup");
    strict_1.default.equal(neutralState.signInHref, "/login");
    completedTests.push("public access entry defaults to a neutral hub while keeping institution signup and shared sign-in on their existing routes");
    const starterTierState = (0, public_entry_1.resolvePublicEntryState)({
        invite: "tenant-admin-token",
        tier: "starter",
    });
    strict_1.default.equal(starterTierState.institutionHref, "/signup?tier=starter&invite=tenant-admin-token");
    strict_1.default.equal(starterTierState.shouldWarnOnInvalidTier, false);
    const invalidTierState = (0, public_entry_1.resolvePublicEntryState)({
        invite: "tenant-admin-token",
        tier: "enterprise",
    });
    strict_1.default.equal(invalidTierState.institutionHref, "/signup?invite=tenant-admin-token");
    strict_1.default.equal(invalidTierState.shouldWarnOnInvalidTier, true);
    completedTests.push("public access preserves valid self-serve tier intent and opaque invite context into signup while still failing closed on unsupported tier values");
    const procurementOfficerState = (0, public_entry_1.resolvePublicEntryState)({
        activationCode: "ACT-001",
        ignored: "drop-me",
        invite: "po-invite-token",
        role: "procurement_officer",
    });
    const procurementOfficerUrl = toUrl(procurementOfficerState.procurementOfficerLoginHref);
    const procurementOfficerAccessUrl = toUrl(procurementOfficerState.procurementOfficerAccessHref);
    const procurementOfficerSelectionUrl = toUrl(procurementOfficerState.procurementOfficerSelectionHref);
    strict_1.default.equal(procurementOfficerState.activeRole, "procurement_officer");
    strict_1.default.equal(procurementOfficerUrl.pathname, "/login");
    strict_1.default.equal(procurementOfficerAccessUrl.pathname, public_entry_1.PROCUREMENT_OFFICER_ACCESS_ROUTE);
    strict_1.default.equal(procurementOfficerSelectionUrl.pathname, public_entry_1.AUTH_ENTRY_ROUTE);
    strict_1.default.equal(procurementOfficerSelectionUrl.hash, "#role-guidance");
    strict_1.default.equal(procurementOfficerUrl.searchParams.get("role"), "procurement_officer");
    strict_1.default.equal(procurementOfficerUrl.searchParams.get("invite"), "po-invite-token");
    strict_1.default.equal(procurementOfficerUrl.searchParams.get("activationCode"), "ACT-001");
    strict_1.default.equal(procurementOfficerAccessUrl.searchParams.get("invite"), "po-invite-token");
    strict_1.default.equal(procurementOfficerUrl.searchParams.get("ignored"), null);
    strict_1.default.equal(procurementOfficerState.signInHref, "/login?role=procurement_officer&invite=po-invite-token&activationCode=ACT-001");
    completedTests.push("procurement officer handoff preserves only the recognized opaque invite context across both the shared login helper and the reserved role-specific sign-in route");
    const implicitProcurementOfficerState = (0, public_entry_1.resolvePublicEntryState)({
        activationToken: "po-activation-token",
    });
    strict_1.default.equal(implicitProcurementOfficerState.activeRole, "procurement_officer");
    strict_1.default.equal(implicitProcurementOfficerState.signInHref, "/login?role=procurement_officer&activationToken=po-activation-token");
    completedTests.push("recognized procurement officer handoff params auto-select the PO guidance path even when the link omits an explicit role query");
    const invalidRoleState = (0, public_entry_1.resolvePublicEntryState)({
        role: "platform_admin",
    });
    strict_1.default.equal(invalidRoleState.activeRole, null);
    strict_1.default.equal(invalidRoleState.shouldWarnOnInvalidRole, true);
    completedTests.push("unsupported role query values fail closed back to the neutral access hub instead of exposing hidden states");
    const genericLandingUrl = toUrl((0, public_entry_1.buildPublicEntryLandingHref)({}));
    const implicitPoLandingUrl = toUrl((0, public_entry_1.buildPublicEntryLandingHref)({
        activationToken: "po-activation-token",
    }));
    const invalidLandingUrl = toUrl((0, public_entry_1.buildPublicEntryLandingHref)({
        role: "platform_admin",
        tier: "enterprise",
    }));
    strict_1.default.equal(genericLandingUrl.pathname, public_entry_1.AUTH_ENTRY_ROUTE);
    strict_1.default.equal(genericLandingUrl.hash, "#access-paths");
    strict_1.default.equal(implicitPoLandingUrl.hash, "#role-guidance");
    strict_1.default.equal(implicitPoLandingUrl.searchParams.get("activationToken"), "po-activation-token");
    strict_1.default.equal(invalidLandingUrl.hash, "#access-paths");
    strict_1.default.equal(invalidLandingUrl.searchParams.get("role"), "platform_admin");
    strict_1.default.equal(invalidLandingUrl.searchParams.get("tier"), "enterprise");
    completedTests.push("public access landing links preserve query context while keeping /access as the dedicated role-aware hub");
    const departmentUserState = (0, public_entry_1.resolvePublicEntryState)({
        accessCode: "DU-2026-ABC",
        role: "department_user",
    });
    const departmentUserUrl = toUrl(departmentUserState.departmentUserContinueHref);
    const departmentUserSelectionUrl = toUrl(departmentUserState.departmentUserSelectionHref);
    strict_1.default.equal(departmentUserState.activeRole, "department_user");
    strict_1.default.equal(departmentUserUrl.pathname, public_entry_1.DEPARTMENT_USER_ACCESS_ROUTE);
    strict_1.default.equal(departmentUserSelectionUrl.pathname, public_entry_1.AUTH_ENTRY_ROUTE);
    strict_1.default.equal(departmentUserSelectionUrl.hash, "#role-guidance");
    strict_1.default.equal(departmentUserUrl.searchParams.get("accessCode"), "DU-2026-ABC");
    completedTests.push("department user guidance exposes a distinct continuation route contract without opening public self-signup");
    strict_1.default.equal((0, department_user_access_1.scrubDepartmentUserAccessCodeFromUrl)("/access/department-user", "?accessCode=DU-2026-ABC&role=department_user"), "/access/department-user?role=department_user");
    completedTests.push("department user deep links can prefill the code and then scrub it from the browser URL without changing the continuation route");
    const institutionChoice = public_entry_1.PUBLIC_ACCESS_CHOICES.find((choice) => choice.key === "institution");
    const procurementOfficerChoice = public_entry_1.PUBLIC_ACCESS_CHOICES.find((choice) => choice.key === "procurement_officer");
    const departmentUserChoice = public_entry_1.PUBLIC_ACCESS_CHOICES.find((choice) => choice.key === "department_user");
    const signInChoice = public_entry_1.PUBLIC_ACCESS_CHOICES.find((choice) => choice.key === "sign_in");
    strict_1.default.equal(institutionChoice?.defaultHref, "/signup");
    strict_1.default.equal(signInChoice?.defaultHref, "/login");
    strict_1.default.equal(procurementOfficerChoice?.supportsSelfSignup, false);
    strict_1.default.equal(departmentUserChoice?.supportsSelfSignup, false);
    strict_1.default.equal(public_entry_1.AUTH_ENTRY_ROUTE, "/access");
    strict_1.default.equal(public_entry_1.MARKETING_ACCESS_CTA.href, public_entry_1.AUTH_ENTRY_ROUTE);
    strict_1.default.ok(public_entry_1.MARKETING_ACCESS_CTA.label.includes("Access"), "expected the marketing CTA label to surface the role-aware access hub");
    strict_1.default.equal(public_entry_1.RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS.includes("invite"), true);
    completedTests.push("access entry metadata keeps tenant-admin signup and sign-in links intact while preventing PO and DU self-signup messaging");
    strict_1.default.equal((0, public_entry_1.resolveAuthenticatedAccessRedirect)(undefined), null);
    strict_1.default.equal((0, public_entry_1.resolveAuthenticatedAccessRedirect)(null), proxy_1.SESSION_EXPIRED_REDIRECT_PATH);
    strict_1.default.equal((0, public_entry_1.resolveAuthenticatedAccessRedirect)({
        accessState: "allowed",
        homePath: "/po",
        isRoleResolved: true,
        isSessionValid: true,
        redirectPath: "/po",
    }), "/po");
    strict_1.default.equal((0, public_entry_1.resolveAuthenticatedAccessRedirect)({
        accessState: "pending_access",
        homePath: "/dashboard",
        isRoleResolved: false,
        isSessionValid: true,
        redirectPath: "/dashboard?reason=pending_access",
    }), "/dashboard?reason=pending_access");
    completedTests.push("authenticated visitors to the public access hub are redirected to their existing in-app destination instead of staying on the public chooser");
    return completedTests;
}
exports.runPublicAuthEntryTests = runPublicAuthEntryTests;
