import { runConvexErrorHandlingTests } from "./convex-error-handling.test";
import { runDepartmentUserDashboardTests } from "./department-user-dashboard.test";
import { runDepartmentUserAccessTests } from "./department-user-access.test";
import { runPasswordResetTests } from "./password-reset.test";
import { runPlatformAdminAuthTests } from "./platform-admin-auth.test";
import { runPricingFlowTests } from "./pricing-flow.test";
import { runProcurementOfficerDashboardTests } from "./procurement-officer-dashboard.test";
import { runPublicAuthEntryTests } from "./public-auth-entry.test";
import { runProxyRouteTests } from "./proxy.test";
import { runRbacTests } from "./rbac.test";
import { runSalesInquiryTests } from "./sales-inquiries.test";
import { runSecurityInfrastructureTests } from "./security-infrastructure.test";
import { runServiceBridgeTests } from "./service-bridge.test";
import { runSessionManagementTests } from "./session-management.test";
import { runSignupFlowTests } from "./signup-flow.test";
import { runTenantAdminDashboardTests } from "./tenant-admin-dashboard.test";
import { runTenantIsolationTests } from "./tenant-isolation.test";

async function main(): Promise<void> {
    const completedTests = [
        ...runConvexErrorHandlingTests(),
        ...runDepartmentUserDashboardTests(),
        ...(await runDepartmentUserAccessTests()),
        ...runPasswordResetTests(),
        ...(await runPlatformAdminAuthTests()),
        ...runPricingFlowTests(),
        ...runProcurementOfficerDashboardTests(),
        ...runPublicAuthEntryTests(),
        ...runProxyRouteTests(),
        ...runRbacTests(),
        ...runSalesInquiryTests(),
        ...runSecurityInfrastructureTests(),
        ...(await runServiceBridgeTests()),
        ...runSessionManagementTests(),
        ...runSignupFlowTests(),
        ...runTenantAdminDashboardTests(),
        ...runTenantIsolationTests(),
    ];

    for (const completedTest of completedTests) {
        console.log(`PASS ${completedTest}`);
    }

    console.log(`Completed ${completedTests.length} assertions.`);
}

void main();
