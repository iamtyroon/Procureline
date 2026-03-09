import { runPasswordResetTests } from "./password-reset.test";
import { runProxyRouteTests } from "./proxy.test";
import { runRbacTests } from "./rbac.test";
import { runSecurityInfrastructureTests } from "./security-infrastructure.test";
import { runSessionManagementTests } from "./session-management.test";
import { runTenantIsolationTests } from "./tenant-isolation.test";

function main(): void {
    const completedTests = [
        ...runPasswordResetTests(),
        ...runProxyRouteTests(),
        ...runRbacTests(),
        ...runSecurityInfrastructureTests(),
        ...runSessionManagementTests(),
        ...runTenantIsolationTests(),
    ];

    for (const completedTest of completedTests) {
        console.log(`PASS ${completedTest}`);
    }

    console.log(`Completed ${completedTests.length} assertions.`);
}

main();
