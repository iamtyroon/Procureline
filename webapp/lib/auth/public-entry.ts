import { INVITE_PARAM } from "../../app/constants";
import {
    isSelfServeTier,
    resolveSelfServeTier,
    type SelfServeTier,
} from "../marketing/pricing";
import { SESSION_EXPIRED_REDIRECT_PATH } from "./proxy";
import type { AuthContextSnapshot } from "./roles";
import { isPlatformAdminAuthStageVerified } from "../platform-admin/auth";

export const AUTH_ENTRY_ROUTE = "/access";
export const PROCUREMENT_OFFICER_ACCESS_ROUTE = "/access/procurement-officer";
export const DEPARTMENT_USER_ACCESS_ROUTE = "/access/department-user";
export const AUTH_ENTRY_SECTION_ID = "access-paths";
export const AUTH_ENTRY_SECTION_HASH = `#${AUTH_ENTRY_SECTION_ID}`;
export const AUTH_ENTRY_SECTION_ROUTE = `/${AUTH_ENTRY_SECTION_HASH}`;

export const MARKETING_ACCESS_CTA = {
    href: AUTH_ENTRY_ROUTE,
    label: "Access Portal",
} as const;

export const PUBLIC_ENTRY_GUIDANCE_ROLES = [
    "procurement_officer",
    "department_user",
] as const;

export const RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS = [
    INVITE_PARAM,
    "activationCode",
    "activationToken",
    "accessCode",
] as const;
const PROCUREMENT_OFFICER_HANDOFF_PARAMS = [
    INVITE_PARAM,
    "activationCode",
    "activationToken",
] as const;

export type PublicEntryGuidanceRole =
    (typeof PUBLIC_ENTRY_GUIDANCE_ROLES)[number];
export type PublicAccessChoiceKey =
    | "institution"
    | PublicEntryGuidanceRole
    | "sign_in";
export type PublicEntrySearchParamValue = string | string[] | undefined;
export type PublicEntrySearchParams = Record<
    string,
    PublicEntrySearchParamValue
>;

export interface PublicAccessChoice {
    ctaLabel: string;
    defaultHref: string;
    description: string;
    key: PublicAccessChoiceKey;
    supportsSelfSignup: boolean;
    title: string;
}

export interface RoleGuidanceDetail {
    continuationDescription: string;
    continuationLabel: string;
    description: string;
    headline: string;
    prerequisites: readonly string[];
    supportsSelfSignup: false;
}

export interface ResolvedPublicEntryState {
    activeRole: PublicEntryGuidanceRole | null;
    departmentUserContinueHref: string;
    departmentUserSelectionHref: string;
    institutionHref: string;
    procurementOfficerAccessHref: string;
    procurementOfficerLoginHref: string;
    procurementOfficerSelectionHref: string;
    selectedTier: SelfServeTier;
    shouldWarnOnInvalidRole: boolean;
    shouldWarnOnInvalidTier: boolean;
    signInHref: string;
}

export const PUBLIC_ACCESS_CHOICES: readonly PublicAccessChoice[] = [
    {
        key: "institution",
        title: "Create Institution Account",
        description:
            "Self-serve onboarding for Free, Starter, and Professional institutions.",
        ctaLabel: "Continue to institution signup",
        defaultHref: "/signup",
        supportsSelfSignup: true,
    },
    {
        key: "procurement_officer",
        title: "Procurement Officer Access",
        description:
            "Use the route your Tenant Admin provisioned for your invite link or activation code.",
        ctaLabel: "View PO access guidance",
        defaultHref: AUTH_ENTRY_SECTION_ROUTE,
        supportsSelfSignup: false,
    },
    {
        key: "department_user",
        title: "Department User Access",
        description:
            "Continue with the department-scoped access path issued by your Procurement Officer.",
        ctaLabel: "View DU access guidance",
        defaultHref: AUTH_ENTRY_SECTION_ROUTE,
        supportsSelfSignup: false,
    },
    {
        key: "sign_in",
        title: "Sign In",
        description:
            "Use the shared email-and-password login route if your account is already active.",
        ctaLabel: "Go to sign in",
        defaultHref: "/login",
        supportsSelfSignup: false,
    },
] as const;

export const ROLE_GUIDANCE_DETAILS: Readonly<
    Record<PublicEntryGuidanceRole, RoleGuidanceDetail>
> = {
    procurement_officer: {
        headline: "Procurement Officer access is provisioned by your Tenant Admin.",
        description:
            "Procurement Officers do not create public accounts here. Start with the invite or activation details issued by your Tenant Admin, then continue to the role-specific Procurement Officer sign-in page.",
        prerequisites: [
            "An invitation link from your Tenant Admin.",
            "A one-time activation code issued by your Tenant Admin.",
        ],
        continuationLabel: "Open Procurement Officer sign in",
        continuationDescription:
            "This role-specific sign-in page is reserved now so the Procurement Officer form can slot in here later without changing the public access model.",
        supportsSelfSignup: false,
    },
    department_user: {
        headline: "Department Users continue from a department-scoped access code.",
        description:
            "Department Users do not self-register publicly. Keep the department-scoped access code from your Procurement Officer, then continue to the role-specific Department User sign-in page.",
        prerequisites: [
            "A department-scoped access code from your Procurement Officer.",
            "The Department User sign-in page tied to that access-code flow.",
        ],
        continuationLabel: "Open Department User sign in",
        continuationDescription:
            "This role-specific sign-in page is reserved now so the Department User access-code form can slot in here later without another public-entry redesign.",
        supportsSelfSignup: false,
    },
};

function getSingleSearchParam(
    value: PublicEntrySearchParamValue,
): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export function getTrimmedSearchParam(
    value: PublicEntrySearchParamValue,
): string | undefined {
    const resolved = getSingleSearchParam(value)?.trim();
    return resolved ? resolved : undefined;
}

function buildPath(
    pathname: string,
    params: URLSearchParams,
    hash?: string,
): string {
    const queryString = params.toString();
    const suffix = hash ? `${hash}` : "";

    if (!queryString) {
        return `${pathname}${suffix}`;
    }

    return `${pathname}?${queryString}${suffix}`;
}

function appendRecognizedHandoffParams(
    params: URLSearchParams,
    searchParams: PublicEntrySearchParams,
): void {
    for (const key of RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS) {
        const value = getTrimmedSearchParam(searchParams[key]);
        if (value) {
            params.set(key, value);
        }
    }
}

function appendValidTierParam(
    params: URLSearchParams,
    searchParams: PublicEntrySearchParams,
): void {
    const tier = getTrimmedSearchParam(searchParams.tier)?.toLowerCase();
    if (tier && isSelfServeTier(tier)) {
        params.set("tier", tier);
    }
}

function appendInstitutionHandoffParams(
    params: URLSearchParams,
    searchParams: PublicEntrySearchParams,
): void {
    const invite = getTrimmedSearchParam(searchParams[INVITE_PARAM]);
    if (invite) {
        params.set(INVITE_PARAM, invite);
    }
}

function appendTierParamForRedirect(
    params: URLSearchParams,
    searchParams: PublicEntrySearchParams,
): void {
    const tier = getTrimmedSearchParam(searchParams.tier)?.toLowerCase();
    if (tier) {
        params.set("tier", tier);
    }
}

function appendRoleParamForRedirect(
    params: URLSearchParams,
    searchParams: PublicEntrySearchParams,
): void {
    const role = getTrimmedSearchParam(searchParams.role)?.toLowerCase();
    if (role) {
        params.set("role", role);
    }
}

function hasRecognizedHandoffParam(
    searchParams: PublicEntrySearchParams,
    keys: readonly string[],
): boolean {
    return keys.some((key) => Boolean(getTrimmedSearchParam(searchParams[key])));
}

export function isPublicEntryGuidanceRole(
    value: string,
): value is PublicEntryGuidanceRole {
    return PUBLIC_ENTRY_GUIDANCE_ROLES.some((role) => role === value);
}

export function resolvePublicEntryRole(
    value: PublicEntrySearchParamValue,
): {
    role: PublicEntryGuidanceRole | null;
    shouldWarn: boolean;
} {
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

function resolveEffectivePublicEntryRole(
    searchParams: PublicEntrySearchParams,
): {
    role: PublicEntryGuidanceRole | null;
    shouldWarn: boolean;
} {
    const resolvedRole = resolvePublicEntryRole(searchParams.role);
    if (
        !resolvedRole.role &&
        !resolvedRole.shouldWarn &&
        hasRecognizedHandoffParam(searchParams, PROCUREMENT_OFFICER_HANDOFF_PARAMS)
    ) {
        return {
            role: "procurement_officer",
            shouldWarn: false,
        };
    }

    return resolvedRole;
}

export function buildPublicEntrySelectionHref(
    role: PublicEntryGuidanceRole,
    searchParams: PublicEntrySearchParams,
    hash: string = "#role-guidance",
    pathname: string = AUTH_ENTRY_ROUTE,
): string {
    const params = new URLSearchParams();
    params.set("role", role);
    appendValidTierParam(params, searchParams);
    appendRecognizedHandoffParams(params, searchParams);
    return buildPath(pathname, params, hash);
}

export function buildInstitutionSignupHref(
    searchParams: PublicEntrySearchParams,
): string {
    const params = new URLSearchParams();
    appendValidTierParam(params, searchParams);
    appendInstitutionHandoffParams(params, searchParams);
    return buildPath("/signup", params);
}

export function buildProcurementOfficerLoginHref(
    searchParams: PublicEntrySearchParams,
): string {
    const params = new URLSearchParams();
    params.set("role", "procurement_officer");
    appendRecognizedHandoffParams(params, searchParams);
    return buildPath("/login", params);
}

export function buildProcurementOfficerAccessHref(
    searchParams: PublicEntrySearchParams,
): string {
    const params = new URLSearchParams();
    appendRecognizedHandoffParams(params, searchParams);
    return buildPath(PROCUREMENT_OFFICER_ACCESS_ROUTE, params);
}

export function buildDepartmentUserContinueHref(
    searchParams: PublicEntrySearchParams,
): string {
    const params = new URLSearchParams();
    const accessCode = getTrimmedSearchParam(searchParams.accessCode);
    if (accessCode) {
        params.set("accessCode", accessCode);
    }

    return buildPath(DEPARTMENT_USER_ACCESS_ROUTE, params);
}

export function buildSignInHref(
    searchParams: PublicEntrySearchParams,
): string {
    const resolvedRole = resolveEffectivePublicEntryRole(searchParams);

    if (resolvedRole.role === "procurement_officer") {
        return buildProcurementOfficerLoginHref(searchParams);
    }

    return "/login";
}

export function buildPublicEntryLandingHref(
    searchParams: PublicEntrySearchParams,
): string {
    const params = new URLSearchParams();
    const resolvedRole = resolveEffectivePublicEntryRole(searchParams);

    appendRoleParamForRedirect(params, searchParams);
    appendTierParamForRedirect(params, searchParams);
    appendRecognizedHandoffParams(params, searchParams);

    const hash = resolvedRole.role ? "#role-guidance" : AUTH_ENTRY_SECTION_HASH;
    return buildPath(AUTH_ENTRY_ROUTE, params, hash);
}

export function resolvePublicEntryState(
    searchParams: PublicEntrySearchParams,
): ResolvedPublicEntryState {
    const resolvedRole = resolveEffectivePublicEntryRole(searchParams);
    const resolvedTier = resolveSelfServeTier(searchParams.tier);

    return {
        activeRole: resolvedRole.role,
        departmentUserContinueHref: buildDepartmentUserContinueHref(searchParams),
        departmentUserSelectionHref: buildPublicEntrySelectionHref(
            "department_user",
            searchParams,
        ),
        institutionHref: buildInstitutionSignupHref(searchParams),
        procurementOfficerAccessHref: buildProcurementOfficerAccessHref(searchParams),
        procurementOfficerLoginHref: buildProcurementOfficerLoginHref(searchParams),
        procurementOfficerSelectionHref: buildPublicEntrySelectionHref(
            "procurement_officer",
            searchParams,
        ),
        selectedTier: resolvedTier.tier,
        shouldWarnOnInvalidRole: resolvedRole.shouldWarn,
        shouldWarnOnInvalidTier: resolvedTier.shouldWarn,
        signInHref: buildSignInHref(searchParams),
    };
}

export function resolveAuthenticatedAccessRedirect(
    authContext:
        | Pick<
              AuthContextSnapshot,
              | "accessState"
              | "homePath"
              | "isRoleResolved"
              | "isSessionValid"
              | "platformAdminAuthStage"
              | "redirectPath"
              | "requiresPlatformAdminVerification"
          >
        | null
        | undefined,
): string | null {
    if (authContext === undefined) {
        return null;
    }

    if (authContext === null) {
        return SESSION_EXPIRED_REDIRECT_PATH;
    }

    if (
        authContext.isSessionValid &&
        authContext.isRoleResolved &&
        authContext.accessState === "allowed"
    ) {
        if (
            authContext.requiresPlatformAdminVerification === true &&
            !isPlatformAdminAuthStageVerified(
                authContext.platformAdminAuthStage ?? "not_applicable",
            )
        ) {
            return authContext.redirectPath;
        }

        return authContext.homePath;
    }

    return authContext.redirectPath;
}
