import { internalMutation } from "./_generated/server";
import {
    normalizeDepartmentCode,
    normalizeDepartmentName,
} from "../lib/procurement-officer/departments";

export const removeLegacyFields = internalMutation({
    handler: async (ctx) => {
        const tenantUsers = await ctx.db.query("tenantUsers").collect();

        for (const tu of tenantUsers) {
            // Create a clean object with only the properties allowed by the new schema
            const cleanTu = {
                userId: tu.userId,
                tenantId: tu.tenantId,
                role: tu.role,
                isActive: tu.isActive,
            };

            // Replace the entire document to strip out organizationName and createdAt
            await ctx.db.replace(tu._id, cleanTu);
        }

        return `Cleaned up ${tenantUsers.length} tenantUsers`;
    },
});

export const backfillDepartmentNormalization = internalMutation({
    handler: async (ctx) => {
        const departments = await ctx.db.query("departments").collect();
        let updatedCount = 0;

        for (const department of departments) {
            const normalizedCode = normalizeDepartmentCode(department.code);
            const normalizedName = normalizeDepartmentName(department.name);
            const needsUpdate =
                department.normalizedCode !== normalizedCode ||
                department.normalizedName !== normalizedName;

            if (!needsUpdate) {
                continue;
            }

            await ctx.db.patch(department._id, {
                normalizedCode,
                normalizedName,
            });
            updatedCount += 1;
        }

        return `Backfilled normalization for ${updatedCount} department(s).`;
    },
});

export const backfillTenantProfileComplete = internalMutation({
    handler: async (ctx) => {
        const tenants = await ctx.db.query("tenants").collect();
        let updatedCount = 0;

        for (const tenant of tenants) {
            if (Object.prototype.hasOwnProperty.call(tenant, "profileComplete")) {
                continue;
            }

            await ctx.db.patch(tenant._id, {
                profileComplete: false,
            });
            updatedCount += 1;
        }

        return `Backfilled profileComplete for ${updatedCount} tenant(s).`;
    },
});
