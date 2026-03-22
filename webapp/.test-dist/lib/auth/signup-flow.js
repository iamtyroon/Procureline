"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreSignupFlowState = exports.createPendingSignupState = exports.SIGNUP_FLOW_ORG_NAME_QUERY_PARAM = exports.SIGNUP_FLOW_EMAIL_QUERY_PARAM = exports.SIGNUP_FLOW_STEP_QUERY_PARAM = exports.PENDING_INVITE_TOKEN_STORAGE_KEY = exports.PENDING_VERIFICATION_EMAIL_STORAGE_KEY = exports.PENDING_TENANT_SETUP_RETRY_STORAGE_KEY = exports.PENDING_SELECTED_TIER_STORAGE_KEY = exports.PENDING_ORG_NAME_STORAGE_KEY = void 0;
exports.PENDING_ORG_NAME_STORAGE_KEY = "pendingOrgName";
exports.PENDING_SELECTED_TIER_STORAGE_KEY = "pendingSelectedTier";
exports.PENDING_TENANT_SETUP_RETRY_STORAGE_KEY = "pendingTenantSetupRetry";
exports.PENDING_VERIFICATION_EMAIL_STORAGE_KEY = "pendingVerificationEmail";
exports.PENDING_INVITE_TOKEN_STORAGE_KEY = "pendingInviteToken";
exports.SIGNUP_FLOW_STEP_QUERY_PARAM = "step";
exports.SIGNUP_FLOW_EMAIL_QUERY_PARAM = "email";
exports.SIGNUP_FLOW_ORG_NAME_QUERY_PARAM = "organizationName";
function createPendingSignupState(state) {
    return {
        email: state.email,
        inviteToken: state.inviteToken,
        organizationName: state.organizationName,
        selectedTier: state.selectedTier,
    };
}
exports.createPendingSignupState = createPendingSignupState;
function restoreSignupFlowState(args) {
    const inviteTokenState = args.inviteToken !== undefined ? { inviteToken: args.inviteToken } : {};
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
    const pendingVerificationEmail = args.pendingVerificationEmail?.trim() ??
        args.pendingVerificationEmailFromQuery?.trim();
    if (pendingVerificationEmail &&
        (args.stepFromQuery === "verify" || args.pendingVerificationEmail)) {
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
exports.restoreSignupFlowState = restoreSignupFlowState;
