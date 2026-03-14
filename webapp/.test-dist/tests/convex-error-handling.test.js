"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runConvexErrorHandlingTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const convex_1 = require("../lib/errors/convex");
const sales_1 = require("../lib/validators/sales");
function runConvexErrorHandlingTests() {
    const completedTests = [];
    const roleAssignmentError = new Error("You already have an application role assignment");
    const organizationConflictError = new Error("An organization with this name already exists");
    strict_1.default.equal((0, convex_1.isExistingRoleAssignmentError)(roleAssignmentError), true);
    strict_1.default.equal((0, convex_1.isExistingRoleAssignmentError)(organizationConflictError), false);
    strict_1.default.equal((0, convex_1.isOrganizationNameConflictError)(organizationConflictError), true);
    strict_1.default.equal((0, convex_1.isOrganizationNameConflictError)(roleAssignmentError), false);
    completedTests.push("registerWithTenant error helpers distinguish existing-role redirects from organization-name conflicts");
    strict_1.default.equal((0, convex_1.getPublicVerificationErrorMessage)(organizationConflictError), "That organization name is already taken. Choose a different name to finish setup.");
    strict_1.default.equal((0, convex_1.isVerificationCodeFailureMessage)("Invalid verification code supplied"), true);
    strict_1.default.equal((0, convex_1.isVerificationCodeFailureMessage)("Invalid mail provider API configuration for resend pipeline"), false);
    strict_1.default.equal((0, convex_1.getPublicVerificationErrorMessage)(new Error("Invalid mail provider API configuration for resend pipeline")), "We could not complete your request right now. Please try again.");
    strict_1.default.equal((0, convex_1.getPublicVerificationErrorMessage)(new Error("[CONVEX] Request ID: abc Server Error")), "We could not complete your request right now. Please try again.");
    strict_1.default.equal((0, convex_1.getPublicDepartmentUserAccessErrorMessage)(new Error("Could not verify code")), "Invalid verification code. Please try again.");
    completedTests.push("verification error mapping only rewrites actual code failures and keeps unrelated backend issues generic");
    strict_1.default.equal((0, convex_1.getPublicInquirySubmissionErrorMessage)(new Error("[CONVEX M(functions/salesInquiries:submitEnterpriseInquiry)] [Request ID: abc] Server Error")), "We could not submit your request right now. Please try again.");
    strict_1.default.equal((0, convex_1.getPublicInquirySubmissionErrorMessage)(new Error((0, sales_1.getEnterpriseInquiryCooldownMessage)())), (0, sales_1.getEnterpriseInquiryCooldownMessage)());
    strict_1.default.equal((0, convex_1.getPublicInquirySubmissionErrorMessage)(new Error("Email must not exceed 254 characters")), "Email must not exceed 254 characters");
    strict_1.default.equal((0, convex_1.getPublicInquirySubmissionErrorMessage)(new Error("Server error while syncing email delivery pipeline")), "We could not submit your request right now. Please try again.");
    completedTests.push("enterprise inquiry errors are sanitized for the public UI while preserving safe cooldown messaging");
    return completedTests;
}
exports.runConvexErrorHandlingTests = runConvexErrorHandlingTests;
