"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSignupFlowTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const signup_flow_1 = require("../lib/shared/auth/signup-flow");
function runSignupFlowTests() {
    const completedTests = [];
    strict_1.default.deepEqual((0, signup_flow_1.createPendingSignupState)({
        email: "admin@university.ac.ke",
        inviteToken: undefined,
        organizationName: "University of Nairobi",
        selectedTier: "starter",
    }), {
        email: "admin@university.ac.ke",
        inviteToken: undefined,
        organizationName: "University of Nairobi",
        selectedTier: "starter",
    });
    completedTests.push("signup state persistence keeps the pending verification email, organization name, and selected tier together for recovery");
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        isAuthenticated: false,
        organizationNameFromQuery: undefined,
        pendingTenantSetupRetry: false,
        pendingVerificationEmailFromQuery: undefined,
        pendingVerificationEmail: "admin@university.ac.ke",
        stepFromQuery: undefined,
    }), {
        email: "admin@university.ac.ke",
        mode: "signup",
        step: "verify",
    });
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        inviteToken: "invite-token-123",
        isAuthenticated: false,
        organizationNameFromQuery: "University of Nairobi",
        pendingTenantSetupRetry: false,
        pendingVerificationEmailFromQuery: "invited.admin@university.ac.ke",
        pendingVerificationEmail: "invited.admin@university.ac.ke",
        stepFromQuery: "verify",
    }), {
        email: "invited.admin@university.ac.ke",
        inviteToken: "invite-token-123",
        organizationName: "University of Nairobi",
        mode: "invite",
        step: "verify",
    });
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        inviteToken: undefined,
        isAuthenticated: false,
        organizationNameFromQuery: "Maseno University",
        pendingTenantSetupRetry: false,
        pendingVerificationEmailFromQuery: "admin@maseno.ac.ke",
        pendingVerificationEmail: null,
        stepFromQuery: "verify",
    }), {
        email: "admin@maseno.ac.ke",
        organizationName: "Maseno University",
        mode: "signup",
        step: "verify",
    });
    completedTests.push("signup flow restoration can resume verification from query params when password reset returns in a fresh browser without sessionStorage state");
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        inviteToken: undefined,
        isAuthenticated: true,
        organizationNameFromQuery: undefined,
        pendingTenantSetupRetry: true,
        pendingVerificationEmailFromQuery: undefined,
        pendingVerificationEmail: "admin@university.ac.ke",
        stepFromQuery: undefined,
    }), {
        email: "",
        mode: "tenant-retry",
        step: "signup",
    });
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        inviteToken: undefined,
        isAuthenticated: false,
        organizationNameFromQuery: undefined,
        pendingTenantSetupRetry: true,
        pendingVerificationEmailFromQuery: undefined,
        pendingVerificationEmail: "admin@university.ac.ke",
        stepFromQuery: undefined,
    }), {
        email: "admin@university.ac.ke",
        mode: "signup",
        step: "verify",
    });
    strict_1.default.deepEqual((0, signup_flow_1.restoreSignupFlowState)({
        inviteToken: undefined,
        isAuthenticated: false,
        organizationNameFromQuery: undefined,
        pendingTenantSetupRetry: false,
        pendingVerificationEmailFromQuery: undefined,
        pendingVerificationEmail: null,
        stepFromQuery: undefined,
    }), {
        email: "",
        mode: "signup",
        step: "signup",
    });
    completedTests.push("signup flow restoration returns users to verification after refresh, preserves invite-mode verification context, and only enters tenant-retry mode for authenticated recovery");
    strict_1.default.equal(signup_flow_1.PENDING_INVITE_TOKEN_STORAGE_KEY, "pendingInviteToken");
    completedTests.push("signup flow stores invited tenant-admin context with a dedicated pending invite token key");
    return completedTests;
}
exports.runSignupFlowTests = runSignupFlowTests;
