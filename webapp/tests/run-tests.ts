import { runPasswordResetTests } from "./password-reset.test";
import { runProxyRouteTests } from "./proxy.test";
import { runSessionManagementTests } from "./session-management.test";

function main(): void {
    const completedTests = [
        ...runPasswordResetTests(),
        ...runProxyRouteTests(),
        ...runSessionManagementTests(),
    ];

    for (const completedTest of completedTests) {
        console.log(`PASS ${completedTest}`);
    }

    console.log(`Completed ${completedTests.length} assertions.`);
}

main();
