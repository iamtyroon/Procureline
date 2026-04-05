import path from "node:path";
import Module from "node:module";

function registerTestPathAlias(): void {
    const moduleResolver = Module as unknown as {
        _resolveFilename: (
            request: string,
            parent: unknown,
            isMain: boolean,
            options?: unknown,
        ) => string;
    };
    const originalResolveFilename = moduleResolver._resolveFilename;

    moduleResolver._resolveFilename = function resolveFilename(
        request,
        parent,
        isMain,
        options,
    ): string {
        if (request.startsWith("@/")) {
            const mappedRequest = path.join(__dirname, "..", request.slice(2));
            return originalResolveFilename.call(
                this,
                mappedRequest,
                parent,
                isMain,
                options,
            );
        }

        return originalResolveFilename.call(
            this,
            request,
            parent,
            isMain,
            options,
        );
    };
}

async function main(): Promise<void> {
    registerTestPathAlias();

    const { runBlocklyWorkspaceValidationTests } = await import(
        "./blockly-workspace-validation.test.js"
    );
    const { runComplianceTests } = await import("./compliance.test.js");
    const { runConvexErrorHandlingTests } = await import(
        "./convex-error-handling.test.js"
    );
    const { runEmailTransportTests } = await import("./email-transport.test.js");
    const { runProcurementOfficerDepartmentTests } = await import(
        "./procurement-officer-departments.test.js"
    );
    const { runDepartmentUserDashboardTests } = await import(
        "./department-user-dashboard.test.js"
    );
    const { runDepartmentUserBlocklyWorkspaceTests } = await import(
        "./department-user-blockly-workspace.test.js"
    );
    const { runDepartmentUserBlocklyWorkspaceUiTests } = await import(
        "./department-user-blockly-workspace-ui.test.js"
    );
    const { runDepartmentUserAccessTests } = await import(
        "./department-user-access.test.js"
    );
    const { runDepartmentUserRequestContextTests } = await import(
        "./department-user-request-context.test.js"
    );
    const { runPasswordResetTests } = await import("./password-reset.test.js");
    const { runProcurementOfficerAccessCodeTests } = await import(
        "./procurement-officer-access-codes.test.js"
    );
    const { runProcurementOfficerCategoryTests } = await import(
        "./procurement-officer-categories.test.js"
    );
    const { runProcurementOfficerDeadlineTests } = await import(
        "./procurement-officer-deadlines.test.js"
    );
    const { runPlatformAdminAuthTests } = await import(
        "./platform-admin-auth.test.js"
    );
    const { runPlatformAdminDashboardTests } = await import(
        "./platform-admin-dashboard.test.js"
    );
    const { runPricingFlowTests } = await import("./pricing-flow.test.js");
    const { runProcurementOfficerDashboardTests } = await import(
        "./procurement-officer-dashboard.test.js"
    );
    const { runProcurementOfficerItemTests } = await import(
        "./procurement-officer-items.test.js"
    );
    const { runProcurementOfficerInvitationTests } = await import(
        "./procurement-officer-invitations.test.js"
    );
    const { runPublicAuthEntryTests } = await import(
        "./public-auth-entry.test.js"
    );
    const { runProxyRouteTests } = await import("./proxy.test.js");
    const { runRbacTests } = await import("./rbac.test.js");
    const { runSalesInquiryTests } = await import("./sales-inquiries.test.js");
    const { runSecurityInfrastructureTests } = await import(
        "./security-infrastructure.test.js"
    );
    const { runServiceBridgeTests } = await import("./service-bridge.test.js");
    const { runSessionManagementTests } = await import(
        "./session-management.test.js"
    );
    const { runSignupFlowTests } = await import("./signup-flow.test.js");
    const { runTenantAdminDashboardTests } = await import(
        "./tenant-admin-dashboard.test.js"
    );
    const { runTenantAdminOnboardingTests } = await import(
        "./tenant-admin-onboarding.test.js"
    );
    const { runTenantIsolationTests } = await import("./tenant-isolation.test.js");

    const completedTests = [
        ...runBlocklyWorkspaceValidationTests(),
        ...runComplianceTests(),
        ...runConvexErrorHandlingTests(),
        ...runEmailTransportTests(),
        ...runProcurementOfficerDepartmentTests(),
        ...runProcurementOfficerCategoryTests(),
        ...(await runProcurementOfficerItemTests()),
        ...runProcurementOfficerAccessCodeTests(),
        ...runProcurementOfficerDeadlineTests(),
        ...runDepartmentUserDashboardTests(),
        ...(await runDepartmentUserBlocklyWorkspaceTests()),
        ...runDepartmentUserBlocklyWorkspaceUiTests(),
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
