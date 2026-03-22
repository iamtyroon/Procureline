"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const convex_error_handling_test_1 = require("./convex-error-handling.test");
const department_user_dashboard_test_1 = require("./department-user-dashboard.test");
const department_user_access_test_1 = require("./department-user-access.test");
const password_reset_test_1 = require("./password-reset.test");
const platform_admin_auth_test_1 = require("./platform-admin-auth.test");
const platform_admin_dashboard_test_1 = require("./platform-admin-dashboard.test");
const pricing_flow_test_1 = require("./pricing-flow.test");
const procurement_officer_dashboard_test_1 = require("./procurement-officer-dashboard.test");
const public_auth_entry_test_1 = require("./public-auth-entry.test");
const proxy_test_1 = require("./proxy.test");
const rbac_test_1 = require("./rbac.test");
const sales_inquiries_test_1 = require("./sales-inquiries.test");
const security_infrastructure_test_1 = require("./security-infrastructure.test");
const service_bridge_test_1 = require("./service-bridge.test");
const session_management_test_1 = require("./session-management.test");
const signup_flow_test_1 = require("./signup-flow.test");
const tenant_admin_dashboard_test_1 = require("./tenant-admin-dashboard.test");
const tenant_isolation_test_1 = require("./tenant-isolation.test");
async function main() {
    const completedTests = [
        ...(0, convex_error_handling_test_1.runConvexErrorHandlingTests)(),
        ...(0, department_user_dashboard_test_1.runDepartmentUserDashboardTests)(),
        ...(await (0, department_user_access_test_1.runDepartmentUserAccessTests)()),
        ...(0, password_reset_test_1.runPasswordResetTests)(),
        ...(await (0, platform_admin_auth_test_1.runPlatformAdminAuthTests)()),
        ...(await (0, platform_admin_dashboard_test_1.runPlatformAdminDashboardTests)()),
        ...(0, pricing_flow_test_1.runPricingFlowTests)(),
        ...(0, procurement_officer_dashboard_test_1.runProcurementOfficerDashboardTests)(),
        ...(0, public_auth_entry_test_1.runPublicAuthEntryTests)(),
        ...(0, proxy_test_1.runProxyRouteTests)(),
        ...(0, rbac_test_1.runRbacTests)(),
        ...(0, sales_inquiries_test_1.runSalesInquiryTests)(),
        ...(0, security_infrastructure_test_1.runSecurityInfrastructureTests)(),
        ...(await (0, service_bridge_test_1.runServiceBridgeTests)()),
        ...(0, session_management_test_1.runSessionManagementTests)(),
        ...(0, signup_flow_test_1.runSignupFlowTests)(),
        ...(0, tenant_admin_dashboard_test_1.runTenantAdminDashboardTests)(),
        ...(0, tenant_isolation_test_1.runTenantIsolationTests)(),
    ];
    for (const completedTest of completedTests) {
        console.log(`PASS ${completedTest}`);
    }
    console.log(`Completed ${completedTests.length} assertions.`);
}
void main();
