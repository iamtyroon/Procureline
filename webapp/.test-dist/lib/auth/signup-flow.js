"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreSignupFlowState = exports.createPendingSignupState = exports.PENDING_VERIFICATION_EMAIL_STORAGE_KEY = exports.PENDING_TENANT_SETUP_RETRY_STORAGE_KEY = exports.PENDING_SELECTED_TIER_STORAGE_KEY = exports.PENDING_ORG_NAME_STORAGE_KEY = void 0;
exports.PENDING_ORG_NAME_STORAGE_KEY = "pendingOrgName";
exports.PENDING_SELECTED_TIER_STORAGE_KEY = "pendingSelectedTier";
exports.PENDING_TENANT_SETUP_RETRY_STORAGE_KEY = "pendingTenantSetupRetry";
exports.PENDING_VERIFICATION_EMAIL_STORAGE_KEY = "pendingVerificationEmail";
function createPendingSignupState(state) {
    return {
        email: state.email,
        organizationName: state.organizationName,
        selectedTier: state.selectedTier,
    };
}
exports.createPendingSignupState = createPendingSignupState;
function restoreSignupFlowState(args) {
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
exports.restoreSignupFlowState = restoreSignupFlowState;
