"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDepartmentUserAccess = void 0;
const values_1 = require("convex/values");
const department_user_access_1 = require("../../lib/auth/department-user-access");
const _roleGuard_1 = require("./_roleGuard");
function createUnauthorizedError(message) {
    throw new values_1.ConvexError({
        code: "UNAUTHORIZED",
        message,
    });
}
async function requireDepartmentUserAccess(ctx) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["department_user"]);
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId))
        .first();
    if (!tenantUser || !tenantUser.isActive || tenantUser.role !== "department_user") {
        createUnauthorizedError("Department User access is required for this resource");
    }
    const profile = await ctx.db
        .query("departmentUserProfiles")
        .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", tenantUser._id))
        .first();
    if (!profile || !profile.isActive) {
        createUnauthorizedError("Department User access is required for this resource");
    }
    const department = await ctx.db.get(profile.departmentId);
    if (!department || department.tenantId !== authContext.tenantId || !department.isActive) {
        createUnauthorizedError("Department User access is required for this resource");
    }
    if (!(0, department_user_access_1.hasConfiguredDepartmentUserSubmissionWindow)({
        submissionEndsAt: department.submissionEndsAt,
        submissionStartsAt: department.submissionStartsAt,
    })) {
        createUnauthorizedError(department_user_access_1.DEPARTMENT_USER_SETUP_REQUIRED_MESSAGE);
    }
    const windowState = (0, department_user_access_1.evaluateDepartmentUserSubmissionWindow)({
        submissionEndsAt: department.submissionEndsAt,
        submissionStartsAt: department.submissionStartsAt,
    });
    if (windowState.accessMode === null) {
        createUnauthorizedError("Submission period has ended.");
    }
    return {
        accessMode: windowState.accessMode,
        departmentId: profile.departmentId,
        tenantId: authContext.tenantId,
        tenantUserId: tenantUser._id,
        userId: authContext.userId,
    };
}
exports.requireDepartmentUserAccess = requireDepartmentUserAccess;
