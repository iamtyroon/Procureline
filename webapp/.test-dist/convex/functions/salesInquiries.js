"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitEnterpriseInquiry = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const sales_1 = require("../../lib/validators/sales");
exports.submitEnterpriseInquiry = (0, server_1.mutation)({
    args: {
        contactName: values_1.v.string(),
        email: values_1.v.string(),
        message: values_1.v.string(),
        organizationName: values_1.v.string(),
    },
    returns: values_1.v.object({
        inquiryId: values_1.v.id("salesInquiries"),
    }),
    handler: async (ctx, args) => {
        const parsed = sales_1.contactSalesSchema.safeParse(args);
        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0] ?? {
                message: "Please review your inquiry details and try again.",
                path: ["contactSales"],
            };
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: String(firstIssue.path[0] ?? "contactSales"),
                message: firstIssue.message,
            });
        }
        const enterpriseInquiryRecord = (0, sales_1.createEnterpriseInquiryRecord)({
            contactName: parsed.data.contactName,
            createdAt: Date.now(),
            email: parsed.data.email,
            message: parsed.data.message,
            organizationName: parsed.data.organizationName,
        });
        const [mostRecentEmailInquiry, mostRecentOrganizationInquiry] = await Promise.all([
            ctx.db
                .query("salesInquiries")
                .withIndex("by_email", (q) => q.eq("email", enterpriseInquiryRecord.email))
                .order("desc")
                .first(),
            ctx.db
                .query("salesInquiries")
                .withIndex("by_organizationNameKey", (q) => q.eq("organizationNameKey", enterpriseInquiryRecord.organizationNameKey))
                .order("desc")
                .first(),
        ]);
        const mostRecentInquiryCreatedAt = (0, sales_1.getMostRecentEnterpriseInquiryCreatedAt)([
            mostRecentEmailInquiry?.createdAt,
            mostRecentOrganizationInquiry?.createdAt,
        ]);
        if ((0, sales_1.isEnterpriseInquiryRateLimited)({
            cooldownMs: sales_1.ENTERPRISE_INQUIRY_COOLDOWN_MS,
            lastSubmittedAt: mostRecentInquiryCreatedAt,
            now: enterpriseInquiryRecord.createdAt,
        })) {
            throw new values_1.ConvexError({
                code: "RATE_LIMITED",
                message: (0, sales_1.getEnterpriseInquiryCooldownMessage)(sales_1.ENTERPRISE_INQUIRY_COOLDOWN_MS),
            });
        }
        const inquiryId = await ctx.db.insert("salesInquiries", enterpriseInquiryRecord);
        return { inquiryId };
    },
});
