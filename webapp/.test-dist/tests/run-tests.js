"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const convex_error_handling_test_1 = require("./convex-error-handling.test");
const password_reset_test_1 = require("./password-reset.test");
const pricing_flow_test_1 = require("./pricing-flow.test");
const public_auth_entry_test_1 = require("./public-auth-entry.test");
const proxy_test_1 = require("./proxy.test");
const rbac_test_1 = require("./rbac.test");
const sales_inquiries_test_1 = require("./sales-inquiries.test");
const security_infrastructure_test_1 = require("./security-infrastructure.test");
const service_bridge_test_1 = require("./service-bridge.test");
const session_management_test_1 = require("./session-management.test");
const signup_flow_test_1 = require("./signup-flow.test");
const tenant_isolation_test_1 = require("./tenant-isolation.test");
async function main() {
    const completedTests = [
        ...(0, convex_error_handling_test_1.runConvexErrorHandlingTests)(),
        ...(0, password_reset_test_1.runPasswordResetTests)(),
        ...(0, pricing_flow_test_1.runPricingFlowTests)(),
        ...(0, public_auth_entry_test_1.runPublicAuthEntryTests)(),
        ...(0, proxy_test_1.runProxyRouteTests)(),
        ...(0, rbac_test_1.runRbacTests)(),
        ...(0, sales_inquiries_test_1.runSalesInquiryTests)(),
        ...(0, security_infrastructure_test_1.runSecurityInfrastructureTests)(),
        ...(await (0, service_bridge_test_1.runServiceBridgeTests)()),
        ...(0, session_management_test_1.runSessionManagementTests)(),
        ...(0, signup_flow_test_1.runSignupFlowTests)(),
        ...(0, tenant_isolation_test_1.runTenantIsolationTests)(),
    ];
    for (const completedTest of completedTests) {
        console.log(`PASS ${completedTest}`);
    }
    console.log(`Completed ${completedTests.length} assertions.`);
}
void main();
