import type { SelfServeTier } from "../shared/marketing/pricing";

export const PENDING_ORG_NAME_STORAGE_KEY = "pendingOrgName";
export const PENDING_SELECTED_TIER_STORAGE_KEY = "pendingSelectedTier";
export const PENDING_TENANT_SETUP_RETRY_STORAGE_KEY = "pendingTenantSetupRetry";
export const PENDING_VERIFICATION_EMAIL_STORAGE_KEY = "pendingVerificationEmail";
export const PENDING_INVITE_TOKEN_STORAGE_KEY = "pendingInviteToken";
export const SIGNUP_FLOW_STEP_QUERY_PARAM = "step";
export const SIGNUP_FLOW_EMAIL_QUERY_PARAM = "email";
export const SIGNUP_FLOW_ORG_NAME_QUERY_PARAM = "organizationName";

export type SignupStep = "signup" | "verify";
export type SignupMode = "signup" | "invite" | "tenant-retry";

export interface RestoredSignupFlowState {
    email: string;
    inviteToken?: string;
    organizationName?: string;
    mode: SignupMode;
    step: SignupStep;
}

export interface PendingSignupState {
    email: string;
    inviteToken?: string;
    organizationName: string;
    selectedTier: SelfServeTier;
}

export function createPendingSignupState(
    state: PendingSignupState,
): PendingSignupState {
    return {
        email: state.email,
        inviteToken: state.inviteToken,
        organizationName: state.organizationName,
        selectedTier: state.selectedTier,
    };
}

export function restoreSignupFlowState(args: {
    inviteToken?: string;
    isAuthenticated: boolean;
    organizationNameFromQuery?: string;
    pendingTenantSetupRetry: boolean;
    pendingVerificationEmailFromQuery?: string;
    pendingVerificationEmail: string | null | undefined;
    stepFromQuery?: SignupStep;
}): RestoredSignupFlowState {
    const inviteTokenState =
        args.inviteToken !== undefined ? { inviteToken: args.inviteToken } : {};
    const organizationName = args.organizationNameFromQuery?.trim();
    const organizationNameState = organizationName
        ? { organizationName }
        : {};

    if (args.pendingTenantSetupRetry && args.isAuthenticated) {
        return {
            email: "",
            ...inviteTokenState,
            ...organizationNameState,
            mode: "tenant-retry",
            step: "signup",
        };
    }

    const pendingVerificationEmail =
        args.pendingVerificationEmail?.trim() ??
        args.pendingVerificationEmailFromQuery?.trim();
    if (
        pendingVerificationEmail &&
        (args.stepFromQuery === "verify" || args.pendingVerificationEmail)
    ) {
        return {
            email: pendingVerificationEmail,
            ...inviteTokenState,
            ...organizationNameState,
            mode: args.inviteToken ? "invite" : "signup",
            step: "verify",
        };
    }

    return {
        email: "",
        ...inviteTokenState,
        ...organizationNameState,
        mode: args.inviteToken ? "invite" : "signup",
        step: "signup",
    };
}
