"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAuthenticatedAccessRedirect = exports.resolvePublicEntryState = exports.buildPublicEntryLandingHref = exports.buildSignInHref = exports.buildDepartmentUserContinueHref = exports.buildProcurementOfficerAccessHref = exports.buildProcurementOfficerLoginHref = exports.buildInstitutionSignupHref = exports.buildPublicEntrySelectionHref = exports.resolvePublicEntryRole = exports.isPublicEntryGuidanceRole = exports.getTrimmedSearchParam = exports.ROLE_GUIDANCE_DETAILS = exports.PUBLIC_ACCESS_CHOICES = exports.RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS = exports.PUBLIC_ENTRY_GUIDANCE_ROLES = exports.MARKETING_ACCESS_CTA = exports.INVITE_PARAM = exports.AUTH_ENTRY_SECTION_ROUTE = exports.AUTH_ENTRY_SECTION_HASH = exports.AUTH_ENTRY_SECTION_ID = exports.DEPARTMENT_USER_ACCESS_ROUTE = exports.PROCUREMENT_OFFICER_ACCESS_ROUTE = exports.AUTH_ENTRY_ROUTE = void 0;
const pricing_1 = require("../marketing/pricing");
const public_routes_1 = require("./public-routes");
const auth_1 = require("../platform-admin/auth");
exports.AUTH_ENTRY_ROUTE = "/access";
exports.PROCUREMENT_OFFICER_ACCESS_ROUTE = "/access/procurement-officer";
exports.DEPARTMENT_USER_ACCESS_ROUTE = "/access/department-user";
exports.AUTH_ENTRY_SECTION_ID = "access-paths";
exports.AUTH_ENTRY_SECTION_HASH = `#${exports.AUTH_ENTRY_SECTION_ID}`;
exports.AUTH_ENTRY_SECTION_ROUTE = `/${exports.AUTH_ENTRY_SECTION_HASH}`;
exports.INVITE_PARAM = "invite";
exports.MARKETING_ACCESS_CTA = {
    href: exports.AUTH_ENTRY_ROUTE,
    label: "Access Portal",
};
exports.PUBLIC_ENTRY_GUIDANCE_ROLES = [
    "procurement_officer",
    "department_user",
];
exports.RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS = [
    exports.INVITE_PARAM,
    "activationCode",
    "activationToken",
    "accessCode",
];
const PROCUREMENT_OFFICER_HANDOFF_PARAMS = [
    exports.INVITE_PARAM,
    "activationCode",
    "activationToken",
];
exports.PUBLIC_ACCESS_CHOICES = [
    {
        key: "institution",
        title: "Create Institution Account",
        description: "Self-serve onboarding for Free, Starter, and Professional institutions.",
        ctaLabel: "Continue to institution signup",
        defaultHref: "/signup",
        supportsSelfSignup: true,
    },
    {
        key: "procurement_officer",
        title: "Procurement Officer Access",
        description: "Use the route your Tenant Admin provisioned for your invite link or activation code.",
        ctaLabel: "View PO access guidance",
        defaultHref: exports.AUTH_ENTRY_SECTION_ROUTE,
        supportsSelfSignup: false,
    },
    {
        key: "department_user",
        title: "Department User Access",
        description: "Continue with the department-scoped access path issued by your Procurement Officer.",
        ctaLabel: "View DU access guidance",
        defaultHref: exports.AUTH_ENTRY_SECTION_ROUTE,
        supportsSelfSignup: false,
    },
    {
        key: "sign_in",
        title: "Sign In",
        description: "Use the shared email-and-password login route if your account is already active.",
        ctaLabel: "Go to sign in",
        defaultHref: "/login",
        supportsSelfSignup: false,
    },
];
exports.ROLE_GUIDANCE_DETAILS = {
    procurement_officer: {
        headline: "Procurement Officer access is provisioned by your Tenant Admin.",
        description: "Procurement Officers do not create public accounts here. Start with the invite or activation details issued by your Tenant Admin, then continue to the role-specific Procurement Officer sign-in page.",
        prerequisites: [
            "An invitation link from your Tenant Admin.",
            "A one-time activation code issued by your Tenant Admin.",
        ],
        continuationLabel: "Open Procurement Officer sign in",
        continuationDescription: "This role-specific sign-in page is reserved now so the Procurement Officer form can slot in here later without changing the public access model.",
        supportsSelfSignup: false,
    },
    department_user: {
        headline: "Department Users continue from a department-scoped access code.",
        description: "Department Users do not self-register publicly. Keep the department-scoped access code from your Procurement Officer, then continue to the role-specific Department User sign-in page.",
        prerequisites: [
            "A department-scoped access code from your Procurement Officer.",
            "The Department User sign-in page tied to that access-code flow.",
        ],
        continuationLabel: "Open Department User sign in",
        continuationDescription: "This role-specific sign-in page is reserved now so the Department User access-code form can slot in here later without another public-entry redesign.",
        supportsSelfSignup: false,
    },
};
function getSingleSearchParam(value) {
    return Array.isArray(value) ? value[0] : value;
}
function getTrimmedSearchParam(value) {
    const resolved = getSingleSearchParam(value)?.trim();
    return resolved ? resolved : undefined;
}
exports.getTrimmedSearchParam = getTrimmedSearchParam;
function buildPath(pathname, params, hash) {
    const queryString = params.toString();
    const suffix = hash ? `${hash}` : "";
    if (!queryString) {
        return `${pathname}${suffix}`;
    }
    return `${pathname}?${queryString}${suffix}`;
}
function appendRecognizedHandoffParams(params, searchParams) {
    for (const key of exports.RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS) {
        const value = getTrimmedSearchParam(searchParams[key]);
        if (value) {
            params.set(key, value);
        }
    }
}
function appendValidTierParam(params, searchParams) {
    const tier = getTrimmedSearchParam(searchParams.tier)?.toLowerCase();
    if (tier && (0, pricing_1.isSelfServeTier)(tier)) {
        params.set("tier", tier);
    }
}
function appendInstitutionHandoffParams(params, searchParams) {
    const invite = getTrimmedSearchParam(searchParams[exports.INVITE_PARAM]);
    if (invite) {
        params.set(exports.INVITE_PARAM, invite);
    }
}
function appendTierParamForRedirect(params, searchParams) {
    const tier = getTrimmedSearchParam(searchParams.tier)?.toLowerCase();
    if (tier) {
        params.set("tier", tier);
    }
}
function appendRoleParamForRedirect(params, searchParams) {
    const role = getTrimmedSearchParam(searchParams.role)?.toLowerCase();
    if (role) {
        params.set("role", role);
    }
}
function hasRecognizedHandoffParam(searchParams, keys) {
    return keys.some((key) => Boolean(getTrimmedSearchParam(searchParams[key])));
}
function isPublicEntryGuidanceRole(value) {
    return exports.PUBLIC_ENTRY_GUIDANCE_ROLES.some((role) => role === value);
}
exports.isPublicEntryGuidanceRole = isPublicEntryGuidanceRole;
function resolvePublicEntryRole(value) {
    const normalized = getTrimmedSearchParam(value)?.toLowerCase();
    if (!normalized) {
        return {
            role: null,
            shouldWarn: false,
        };
    }
    if (isPublicEntryGuidanceRole(normalized)) {
        return {
            role: normalized,
            shouldWarn: false,
        };
    }
    return {
        role: null,
        shouldWarn: true,
    };
}
exports.resolvePublicEntryRole = resolvePublicEntryRole;
function resolveEffectivePublicEntryRole(searchParams) {
    const resolvedRole = resolvePublicEntryRole(searchParams.role);
    if (!resolvedRole.role &&
        !resolvedRole.shouldWarn &&
        hasRecognizedHandoffParam(searchParams, PROCUREMENT_OFFICER_HANDOFF_PARAMS)) {
        return {
            role: "procurement_officer",
            shouldWarn: false,
        };
    }
    return resolvedRole;
}
function buildPublicEntrySelectionHref(role, searchParams, hash = "#role-guidance", pathname = exports.AUTH_ENTRY_ROUTE) {
    const params = new URLSearchParams();
    params.set("role", role);
    appendValidTierParam(params, searchParams);
    appendRecognizedHandoffParams(params, searchParams);
    return buildPath(pathname, params, hash);
}
exports.buildPublicEntrySelectionHref = buildPublicEntrySelectionHref;
function buildInstitutionSignupHref(searchParams) {
    const params = new URLSearchParams();
    appendValidTierParam(params, searchParams);
    appendInstitutionHandoffParams(params, searchParams);
    return buildPath("/signup", params);
}
exports.buildInstitutionSignupHref = buildInstitutionSignupHref;
function buildProcurementOfficerLoginHref(searchParams) {
    return buildProcurementOfficerAccessHref(searchParams);
}
exports.buildProcurementOfficerLoginHref = buildProcurementOfficerLoginHref;
function buildProcurementOfficerAccessHref(searchParams) {
    const params = new URLSearchParams();
    appendRecognizedHandoffParams(params, searchParams);
    return buildPath(exports.PROCUREMENT_OFFICER_ACCESS_ROUTE, params);
}
exports.buildProcurementOfficerAccessHref = buildProcurementOfficerAccessHref;
function buildDepartmentUserContinueHref(searchParams) {
    const params = new URLSearchParams();
    const accessCode = getTrimmedSearchParam(searchParams.accessCode);
    if (accessCode) {
        params.set("accessCode", accessCode);
    }
    return buildPath(exports.DEPARTMENT_USER_ACCESS_ROUTE, params);
}
exports.buildDepartmentUserContinueHref = buildDepartmentUserContinueHref;
function buildSignInHref(searchParams) {
    const resolvedRole = resolveEffectivePublicEntryRole(searchParams);
    if (resolvedRole.role === "procurement_officer") {
        return buildProcurementOfficerLoginHref(searchParams);
    }
    return "/login";
}
exports.buildSignInHref = buildSignInHref;
function buildPublicEntryLandingHref(searchParams) {
    const params = new URLSearchParams();
    const resolvedRole = resolveEffectivePublicEntryRole(searchParams);
    appendRoleParamForRedirect(params, searchParams);
    appendTierParamForRedirect(params, searchParams);
    appendRecognizedHandoffParams(params, searchParams);
    const hash = resolvedRole.role ? "#role-guidance" : exports.AUTH_ENTRY_SECTION_HASH;
    return buildPath(exports.AUTH_ENTRY_ROUTE, params, hash);
}
exports.buildPublicEntryLandingHref = buildPublicEntryLandingHref;
function resolvePublicEntryState(searchParams) {
    const resolvedRole = resolveEffectivePublicEntryRole(searchParams);
    const resolvedTier = (0, pricing_1.resolveSelfServeTier)(searchParams.tier);
    return {
        activeRole: resolvedRole.role,
        departmentUserContinueHref: buildDepartmentUserContinueHref(searchParams),
        departmentUserSelectionHref: buildPublicEntrySelectionHref("department_user", searchParams),
        institutionHref: buildInstitutionSignupHref(searchParams),
        procurementOfficerAccessHref: buildProcurementOfficerAccessHref(searchParams),
        procurementOfficerLoginHref: buildProcurementOfficerLoginHref(searchParams),
        procurementOfficerSelectionHref: buildPublicEntrySelectionHref("procurement_officer", searchParams),
        selectedTier: resolvedTier.tier,
        shouldWarnOnInvalidRole: resolvedRole.shouldWarn,
        shouldWarnOnInvalidTier: resolvedTier.shouldWarn,
        signInHref: buildSignInHref(searchParams),
    };
}
exports.resolvePublicEntryState = resolvePublicEntryState;
function resolveAuthenticatedAccessRedirect(authContext) {
    if (authContext === undefined) {
        return null;
    }
    if (authContext === null) {
        return public_routes_1.SESSION_EXPIRED_REDIRECT_PATH;
    }
    if (authContext.isSessionValid &&
        authContext.isRoleResolved &&
        authContext.accessState === "allowed") {
        if (authContext.requiresPlatformAdminVerification === true &&
            !(0, auth_1.isPlatformAdminAuthStageVerified)(authContext.platformAdminAuthStage ?? "not_applicable")) {
            return authContext.redirectPath;
        }
        return authContext.homePath;
    }
    return authContext.redirectPath;
}
exports.resolveAuthenticatedAccessRedirect = resolveAuthenticatedAccessRedirect;
