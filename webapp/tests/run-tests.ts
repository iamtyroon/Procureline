import { runPasswordResetTests } from "./password-reset.test";
import { runProxyRouteTests } from "./proxy.test";
import { runRbacTests } from "./rbac.test";
import { runSecurityInfrastructureTests } from "./security-infrastructure.test";
import { runServiceBridgeTests } from "./service-bridge.test";
import { runSessionManagementTests } from "./session-management.test";
import { runTenantIsolationTests } from "./tenant-isolation.test";

async function main(): Promise<void> {
    const completedTests = [
        ...runPasswordResetTests(),
        ...runProxyRouteTests(),
        ...runRbacTests(),
        ...runSecurityInfrastructureTests(),
        ...(await runServiceBridgeTests()),
        ...runSessionManagementTests(),
        ...runTenantIsolationTests(),
    ];

    for (const completedTest of completedTests) {
        console.log(`PASS ${completedTest}`);
    }

    console.log(`Completed ${completedTests.length} assertions.`);
}

void main();
