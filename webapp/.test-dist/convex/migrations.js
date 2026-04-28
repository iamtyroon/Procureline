"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillProcurementItemCatalogSearch = exports.backfillTenantProfileComplete = exports.backfillDepartmentNormalization = exports.removeLegacyFields = void 0;
const server_1 = require("./_generated/server");
const departments_1 = require("../lib/procurement-officer/departments");
const items_1 = require("../lib/procurement-officer/items");
exports.removeLegacyFields = (0, server_1.internalMutation)({
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
exports.backfillDepartmentNormalization = (0, server_1.internalMutation)({
    handler: async (ctx) => {
        const departments = await ctx.db.query("departments").collect();
        let updatedCount = 0;
        for (const department of departments) {
            const normalizedCode = (0, departments_1.normalizeDepartmentCode)(department.code);
            const normalizedName = (0, departments_1.normalizeDepartmentName)(department.name);
            const voteNumber = department.voteNumber ?? department.code;
            const normalizedVoteNumber = (0, departments_1.normalizeDepartmentVoteNumber)(voteNumber);
            const needsUpdate = department.normalizedCode !== normalizedCode ||
                department.normalizedName !== normalizedName ||
                department.voteNumber !== voteNumber ||
                department.normalizedVoteNumber !== normalizedVoteNumber;
            if (!needsUpdate) {
                continue;
            }
            await ctx.db.patch(department._id, {
                normalizedCode,
                normalizedName,
                normalizedVoteNumber,
                voteNumber,
            });
            updatedCount += 1;
        }
        return `Backfilled normalization for ${updatedCount} department(s).`;
    },
});
exports.backfillTenantProfileComplete = (0, server_1.internalMutation)({
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
exports.backfillProcurementItemCatalogSearch = (0, server_1.internalMutation)({
    handler: async (ctx) => {
        const [categories, items] = await Promise.all([
            ctx.db.query("procurementCategories").collect(),
            ctx.db.query("procurementItems").collect(),
        ]);
        const categoriesById = new Map(categories.map((category) => [String(category._id), category]));
        let updatedCount = 0;
        for (const item of items) {
            const categoryName = categoriesById.get(String(item.categoryId))?.name ?? "Unknown category";
            const description = (0, items_1.normalizeProcurementItemDisplayName)(item.description ?? item.name) ||
                item.name;
            const catalogSearchText = (0, items_1.buildProcurementItemCatalogSearchText)({
                categoryName,
                description,
                name: item.name,
            });
            if (item.categoryNameSnapshot === categoryName &&
                item.catalogSearchText === catalogSearchText) {
                continue;
            }
            await ctx.db.patch(item._id, {
                catalogSearchText,
                categoryNameSnapshot: categoryName,
            });
            updatedCount += 1;
        }
        return `Backfilled catalog search fields for ${updatedCount} procurement item(s).`;
    },
});
