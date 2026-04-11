import { internalMutation } from "./_generated/server";
import {
  normalizeDepartmentCode,
  normalizeDepartmentName,
} from "../lib/procurement-officer/departments";
import {
  buildProcurementItemCatalogSearchText,
  normalizeProcurementItemDisplayName,
} from "../lib/procurement-officer/items";

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

export const backfillProcurementItemCatalogSearch = internalMutation({
  handler: async (ctx) => {
    const [categories, items] = await Promise.all([
      ctx.db.query("procurementCategories").collect(),
      ctx.db.query("procurementItems").collect(),
    ]);
    const categoriesById = new Map(
      categories.map((category) => [String(category._id), category] as const),
    );
    let updatedCount = 0;

    for (const item of items) {
      const categoryName =
        categoriesById.get(String(item.categoryId))?.name ?? "Unknown category";
      const description =
        normalizeProcurementItemDisplayName(item.description ?? item.name) ||
        item.name;
      const catalogSearchText = buildProcurementItemCatalogSearchText({
        categoryName,
        description,
        name: item.name,
      });

      if (
        item.categoryNameSnapshot === categoryName &&
        item.catalogSearchText === catalogSearchText
      ) {
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
