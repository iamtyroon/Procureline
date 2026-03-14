import assert from "node:assert/strict";
import {
    getPublicDepartmentUserAccessErrorMessage,
    getPublicInquirySubmissionErrorMessage,
    getPublicVerificationErrorMessage,
    isVerificationCodeFailureMessage,
    isExistingRoleAssignmentError,
    isOrganizationNameConflictError,
} from "../lib/errors/convex";
import { getEnterpriseInquiryCooldownMessage } from "../lib/validators/sales";

export function runConvexErrorHandlingTests(): string[] {
    const completedTests: string[] = [];

    const roleAssignmentError = new Error(
        "You already have an application role assignment",
    );
    const organizationConflictError = new Error(
        "An organization with this name already exists",
    );

    assert.equal(isExistingRoleAssignmentError(roleAssignmentError), true);
    assert.equal(isExistingRoleAssignmentError(organizationConflictError), false);
    assert.equal(isOrganizationNameConflictError(organizationConflictError), true);
    assert.equal(isOrganizationNameConflictError(roleAssignmentError), false);
    completedTests.push(
        "registerWithTenant error helpers distinguish existing-role redirects from organization-name conflicts",
    );

    assert.equal(
        getPublicVerificationErrorMessage(organizationConflictError),
        "That organization name is already taken. Choose a different name to finish setup.",
    );
    assert.equal(
        isVerificationCodeFailureMessage("Invalid verification code supplied"),
        true,
    );
    assert.equal(
        isVerificationCodeFailureMessage(
            "Invalid mail provider API configuration for resend pipeline",
        ),
        false,
    );
    assert.equal(
        getPublicVerificationErrorMessage(
            new Error("Invalid mail provider API configuration for resend pipeline"),
        ),
        "We could not complete your request right now. Please try again.",
    );
    assert.equal(
        getPublicVerificationErrorMessage(new Error("[CONVEX] Request ID: abc Server Error")),
        "We could not complete your request right now. Please try again.",
    );
    assert.equal(
        getPublicDepartmentUserAccessErrorMessage(
            new Error("Could not verify code"),
        ),
        "Invalid verification code. Please try again.",
    );
    completedTests.push(
        "verification error mapping only rewrites actual code failures and keeps unrelated backend issues generic",
    );

    assert.equal(
        getPublicInquirySubmissionErrorMessage(
            new Error(
                "[CONVEX M(functions/salesInquiries:submitEnterpriseInquiry)] [Request ID: abc] Server Error",
            ),
        ),
        "We could not submit your request right now. Please try again.",
    );
    assert.equal(
        getPublicInquirySubmissionErrorMessage(
            new Error(getEnterpriseInquiryCooldownMessage()),
        ),
        getEnterpriseInquiryCooldownMessage(),
    );
    assert.equal(
        getPublicInquirySubmissionErrorMessage(
            new Error("Email must not exceed 254 characters"),
        ),
        "Email must not exceed 254 characters",
    );
    assert.equal(
        getPublicInquirySubmissionErrorMessage(
            new Error("Server error while syncing email delivery pipeline"),
        ),
        "We could not submit your request right now. Please try again.",
    );
    completedTests.push(
        "enterprise inquiry errors are sanitized for the public UI while preserving safe cooldown messaging",
    );

    return completedTests;
}
