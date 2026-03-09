"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const password_reset_test_1 = require("./password-reset.test");
const proxy_test_1 = require("./proxy.test");
const rbac_test_1 = require("./rbac.test");
const session_management_test_1 = require("./session-management.test");
function main() {
    const completedTests = [
        ...(0, password_reset_test_1.runPasswordResetTests)(),
        ...(0, proxy_test_1.runProxyRouteTests)(),
        ...(0, rbac_test_1.runRbacTests)(),
        ...(0, session_management_test_1.runSessionManagementTests)(),
    ];
    for (const completedTest of completedTests) {
        console.log(`PASS ${completedTest}`);
    }
    console.log(`Completed ${completedTests.length} assertions.`);
}
main();
