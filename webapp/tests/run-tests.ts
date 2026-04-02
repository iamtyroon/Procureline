import { runConvexErrorHandlingTests } from "./convex-error-handling.test";
import { runEmailTransportTests } from "./email-transport.test";
import { runProcurementOfficerDepartmentTests } from "./procurement-officer-departments.test";
import { runDepartmentUserDashboardTests } from "./department-user-dashboard.test";
import { runDepartmentUserBlocklyWorkspaceTests } from "./department-user-blockly-workspace.test";
import { runDepartmentUserAccessTests } from "./department-user-access.test";
import { runDepartmentUserRequestContextTests } from "./department-user-request-context.test";
import { runPasswordResetTests } from "./password-reset.test";
import { runProcurementOfficerAccessCodeTests } from "./procurement-officer-access-codes.test";
import { runProcurementOfficerCategoryTests } from "./procurement-officer-categories.test";
import { runProcurementOfficerDeadlineTests } from "./procurement-officer-deadlines.test";
import { runPlatformAdminAuthTests } from "./platform-admin-auth.test";
import { runPlatformAdminDashboardTests } from "./platform-admin-dashboard.test";
import { runPricingFlowTests } from "./pricing-flow.test";
import { runProcurementOfficerDashboardTests } from "./procurement-officer-dashboard.test";
import { runProcurementOfficerInvitationTests } from "./procurement-officer-invitations.test";
import { runPublicAuthEntryTests } from "./public-auth-entry.test";
import { runProxyRouteTests } from "./proxy.test";
import { runRbacTests } from "./rbac.test";
import { runSalesInquiryTests } from "./sales-inquiries.test";
import { runSecurityInfrastructureTests } from "./security-infrastructure.test";
import { runServiceBridgeTests } from "./service-bridge.test";
import { runSessionManagementTests } from "./session-management.test";
import { runSignupFlowTests } from "./signup-flow.test";
import { runTenantAdminDashboardTests } from "./tenant-admin-dashboard.test";
import { runTenantAdminOnboardingTests } from "./tenant-admin-onboarding.test";
import { runTenantIsolationTests } from "./tenant-isolation.test";

async function main(): Promise<void> {
    const completedTests = [
        ...runConvexErrorHandlingTests(),
        ...runEmailTransportTests(),
        ...runProcurementOfficerDepartmentTests(),
        ...runProcurementOfficerCategoryTests(),
        ...runProcurementOfficerAccessCodeTests(),
        ...runProcurementOfficerDeadlineTests(),
        ...runDepartmentUserDashboardTests(),
        ...runDepartmentUserBlocklyWorkspaceTests(),
        ...(await runDepartmentUserAccessTests()),
        ...(await runDepartmentUserRequestContextTests()),
        ...runPasswordResetTests(),
        ...(await runPlatformAdminAuthTests()),
        ...(await runPlatformAdminDashboardTests()),
        ...runPricingFlowTests(),
        ...runProcurementOfficerDashboardTests(),
        ...(await runProcurementOfficerInvitationTests()),
        ...runPublicAuthEntryTests(),
        ...runProxyRouteTests(),
        ...runRbacTests(),
        ...runSalesInquiryTests(),
        ...runSecurityInfrastructureTests(),
        ...(await runServiceBridgeTests()),
        ...runSessionManagementTests(),
        ...runSignupFlowTests(),
        ...runTenantAdminDashboardTests(),
        ...(await runTenantAdminOnboardingTests()),
        ...runTenantIsolationTests(),
    ];

    for (const completedTest of completedTests) {
        console.log(`PASS ${completedTest}`);
    }

    console.log(`Completed ${completedTests.length} assertions.`);
}

void main();
