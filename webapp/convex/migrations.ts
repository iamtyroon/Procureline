import { internalMutation } from "./_generated/server";

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
