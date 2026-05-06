import assert from "node:assert/strict";
import {
    createPendingSignupState,
    PENDING_INVITE_TOKEN_STORAGE_KEY,
    restoreSignupFlowState,
} from "../lib/shared/auth/signup-flow";

export function runSignupFlowTests(): string[] {
    const completedTests: string[] = [];

    assert.deepEqual(
        createPendingSignupState({
            email: "admin@university.ac.ke",
            inviteToken: undefined,
            organizationName: "University of Nairobi",
            selectedTier: "starter",
        }),
        {
            email: "admin@university.ac.ke",
            inviteToken: undefined,
            organizationName: "University of Nairobi",
            selectedTier: "starter",
        },
    );
    completedTests.push(
        "signup state persistence keeps the pending verification email, organization name, and selected tier together for recovery",
    );

    assert.deepEqual(
        restoreSignupFlowState({
            isAuthenticated: false,
            organizationNameFromQuery: undefined,
            pendingTenantSetupRetry: false,
            pendingVerificationEmailFromQuery: undefined,
            pendingVerificationEmail: "admin@university.ac.ke",
            stepFromQuery: undefined,
        }),
        {
            email: "admin@university.ac.ke",
            mode: "signup",
            step: "verify",
        },
    );
    assert.deepEqual(
        restoreSignupFlowState({
            inviteToken: "invite-token-123",
            isAuthenticated: false,
            organizationNameFromQuery: "University of Nairobi",
            pendingTenantSetupRetry: false,
            pendingVerificationEmailFromQuery: "invited.admin@university.ac.ke",
            pendingVerificationEmail: "invited.admin@university.ac.ke",
            stepFromQuery: "verify",
        }),
        {
            email: "invited.admin@university.ac.ke",
            inviteToken: "invite-token-123",
            organizationName: "University of Nairobi",
            mode: "invite",
            step: "verify",
        },
    );
    assert.deepEqual(
        restoreSignupFlowState({
            inviteToken: undefined,
            isAuthenticated: false,
            organizationNameFromQuery: "Maseno University",
            pendingTenantSetupRetry: false,
            pendingVerificationEmailFromQuery: "admin@maseno.ac.ke",
            pendingVerificationEmail: null,
            stepFromQuery: "verify",
        }),
        {
            email: "admin@maseno.ac.ke",
            organizationName: "Maseno University",
            mode: "signup",
            step: "verify",
        },
    );
    completedTests.push(
        "signup flow restoration can resume verification from query params when password reset returns in a fresh browser without sessionStorage state",
    );

    assert.deepEqual(
        restoreSignupFlowState({
            inviteToken: undefined,
            isAuthenticated: true,
            organizationNameFromQuery: undefined,
            pendingTenantSetupRetry: true,
            pendingVerificationEmailFromQuery: undefined,
            pendingVerificationEmail: "admin@university.ac.ke",
            stepFromQuery: undefined,
        }),
        {
            email: "",
            mode: "tenant-retry",
            step: "signup",
        },
    );
    assert.deepEqual(
        restoreSignupFlowState({
            inviteToken: undefined,
            isAuthenticated: false,
            organizationNameFromQuery: undefined,
            pendingTenantSetupRetry: true,
            pendingVerificationEmailFromQuery: undefined,
            pendingVerificationEmail: "admin@university.ac.ke",
            stepFromQuery: undefined,
        }),
        {
            email: "admin@university.ac.ke",
            mode: "signup",
            step: "verify",
        },
    );
    assert.deepEqual(
        restoreSignupFlowState({
            inviteToken: undefined,
            isAuthenticated: false,
            organizationNameFromQuery: undefined,
            pendingTenantSetupRetry: false,
            pendingVerificationEmailFromQuery: undefined,
            pendingVerificationEmail: null,
            stepFromQuery: undefined,
        }),
        {
            email: "",
            mode: "signup",
            step: "signup",
        },
    );
    completedTests.push(
        "signup flow restoration returns users to verification after refresh, preserves invite-mode verification context, and only enters tenant-retry mode for authenticated recovery",
    );

    assert.equal(PENDING_INVITE_TOKEN_STORAGE_KEY, "pendingInviteToken");
    completedTests.push(
        "signup flow stores invited tenant-admin context with a dedicated pending invite token key",
    );

    return completedTests;
}
