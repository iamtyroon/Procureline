import { runConvexErrorHandlingTests } from "./convex-error-handling.test";
import { runPasswordResetTests } from "./password-reset.test";
import { runPricingFlowTests } from "./pricing-flow.test";
import { runProxyRouteTests } from "./proxy.test";
import { runRbacTests } from "./rbac.test";
import { runSalesInquiryTests } from "./sales-inquiries.test";
import { runSecurityInfrastructureTests } from "./security-infrastructure.test";
import { runServiceBridgeTests } from "./service-bridge.test";
import { runSessionManagementTests } from "./session-management.test";
import { runSignupFlowTests } from "./signup-flow.test";
import { runTenantIsolationTests } from "./tenant-isolation.test";

async function main(): Promise<void> {
    const completedTests = [
        ...runConvexErrorHandlingTests(),
        ...runPasswordResetTests(),
        ...runPricingFlowTests(),
        ...runProxyRouteTests(),
        ...runRbacTests(),
        ...runSalesInquiryTests(),
        ...runSecurityInfrastructureTests(),
        ...(await runServiceBridgeTests()),
        ...runSessionManagementTests(),
        ...runSignupFlowTests(),
        ...runTenantIsolationTests(),
    ];

    for (const completedTest of completedTests) {
        console.log(`PASS ${completedTest}`);
    }

    console.log(`Completed ${completedTests.length} assertions.`);
}

void main();
