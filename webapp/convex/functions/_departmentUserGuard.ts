import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
    DEPARTMENT_USER_SETUP_REQUIRED_MESSAGE,
    evaluateDepartmentUserSubmissionWindow,
    hasConfiguredDepartmentUserSubmissionWindow,
} from "../../lib/auth/department-user-access";
import { requireTenantRole } from "./_roleGuard";

type DepartmentUserCtx = QueryCtx | MutationCtx;

function createUnauthorizedError(message: string): never {
    throw new ConvexError({
        code: "UNAUTHORIZED",
        message,
    });
}

export async function requireDepartmentUserAccess(
    ctx: DepartmentUserCtx,
): Promise<{
    accessMode: "editable" | "read_only_grace";
    departmentId: Id<"departments">;
    tenantId: Id<"tenants">;
    tenantUserId: Id<"tenantUsers">;
    userId: Id<"users">;
}> {
    const authContext = await requireTenantRole(ctx, ["department_user"]);

    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) =>
            q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId),
        )
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

    if (
        !hasConfiguredDepartmentUserSubmissionWindow({
            submissionEndsAt: department.submissionEndsAt,
            submissionStartsAt: department.submissionStartsAt,
        })
    ) {
        createUnauthorizedError(DEPARTMENT_USER_SETUP_REQUIRED_MESSAGE);
    }

    const windowState = evaluateDepartmentUserSubmissionWindow({
        submissionEndsAt: department.submissionEndsAt as number,
        submissionStartsAt: department.submissionStartsAt as number,
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
