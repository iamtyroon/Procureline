import assert from "node:assert/strict";
import {
    createPendingSignupState,
    restoreSignupFlowState,
} from "../lib/auth/signup-flow";

export function runSignupFlowTests(): string[] {
    const completedTests: string[] = [];

    assert.deepEqual(
        createPendingSignupState({
            email: "admin@university.ac.ke",
            organizationName: "University of Nairobi",
            selectedTier: "starter",
        }),
        {
            email: "admin@university.ac.ke",
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
            pendingTenantSetupRetry: false,
            pendingVerificationEmail: "admin@university.ac.ke",
        }),
        {
            email: "admin@university.ac.ke",
            mode: "signup",
            step: "verify",
        },
    );
    assert.deepEqual(
        restoreSignupFlowState({
            isAuthenticated: true,
            pendingTenantSetupRetry: true,
            pendingVerificationEmail: "admin@university.ac.ke",
        }),
        {
            email: "",
            mode: "tenant-retry",
            step: "signup",
        },
    );
    assert.deepEqual(
        restoreSignupFlowState({
            isAuthenticated: false,
            pendingTenantSetupRetry: true,
            pendingVerificationEmail: "admin@university.ac.ke",
        }),
        {
            email: "admin@university.ac.ke",
            mode: "signup",
            step: "verify",
        },
    );
    assert.deepEqual(
        restoreSignupFlowState({
            isAuthenticated: false,
            pendingTenantSetupRetry: false,
            pendingVerificationEmail: null,
        }),
        {
            email: "",
            mode: "signup",
            step: "signup",
        },
    );
    completedTests.push(
        "signup flow restoration returns users to verification after refresh and only enters tenant-retry mode for authenticated recovery",
    );

    return completedTests;
}
