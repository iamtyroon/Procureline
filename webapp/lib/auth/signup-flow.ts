import type { SelfServeTier } from "../marketing/pricing";

export const PENDING_ORG_NAME_STORAGE_KEY = "pendingOrgName";
export const PENDING_SELECTED_TIER_STORAGE_KEY = "pendingSelectedTier";
export const PENDING_TENANT_SETUP_RETRY_STORAGE_KEY = "pendingTenantSetupRetry";
export const PENDING_VERIFICATION_EMAIL_STORAGE_KEY = "pendingVerificationEmail";

export type SignupStep = "signup" | "verify";
export type SignupMode = "signup" | "tenant-retry";

export interface RestoredSignupFlowState {
    email: string;
    mode: SignupMode;
    step: SignupStep;
}

export interface PendingSignupState {
    email: string;
    organizationName: string;
    selectedTier: SelfServeTier;
}

export function createPendingSignupState(
    state: PendingSignupState,
): PendingSignupState {
    return {
        email: state.email,
        organizationName: state.organizationName,
        selectedTier: state.selectedTier,
    };
}

export function restoreSignupFlowState(args: {
    isAuthenticated: boolean;
    pendingTenantSetupRetry: boolean;
    pendingVerificationEmail: string | null | undefined;
}): RestoredSignupFlowState {
    if (args.pendingTenantSetupRetry && args.isAuthenticated) {
        return {
            email: "",
            mode: "tenant-retry",
            step: "signup",
        };
    }

    const pendingVerificationEmail = args.pendingVerificationEmail?.trim();
    if (pendingVerificationEmail) {
        return {
            email: pendingVerificationEmail,
            mode: "signup",
            step: "verify",
        };
    }

    return {
        email: "",
        mode: "signup",
        step: "signup",
    };
}
