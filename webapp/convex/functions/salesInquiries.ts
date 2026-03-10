import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import {
    contactSalesSchema,
    createEnterpriseInquiryRecord,
    ENTERPRISE_INQUIRY_COOLDOWN_MS,
    getEnterpriseInquiryCooldownMessage,
    getMostRecentEnterpriseInquiryCreatedAt,
    isEnterpriseInquiryRateLimited,
} from "../../lib/validators/sales";

export const submitEnterpriseInquiry = mutation({
    args: {
        contactName: v.string(),
        email: v.string(),
        message: v.string(),
        organizationName: v.string(),
    },
    returns: v.object({
        inquiryId: v.id("salesInquiries"),
    }),
    handler: async (ctx, args) => {
        const parsed = contactSalesSchema.safeParse(args);
        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0] ?? {
                message: "Please review your inquiry details and try again.",
                path: ["contactSales"],
            };
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                field: String(firstIssue.path[0] ?? "contactSales"),
                message: firstIssue.message,
            });
        }

        const enterpriseInquiryRecord = createEnterpriseInquiryRecord({
            contactName: parsed.data.contactName,
            createdAt: Date.now(),
            email: parsed.data.email,
            message: parsed.data.message,
            organizationName: parsed.data.organizationName,
        });
        const [mostRecentEmailInquiry, mostRecentOrganizationInquiry] =
            await Promise.all([
                ctx.db
                    .query("salesInquiries")
                    .withIndex("by_email", (q) =>
                        q.eq("email", enterpriseInquiryRecord.email),
                    )
                    .order("desc")
                    .first(),
                ctx.db
                    .query("salesInquiries")
                    .withIndex("by_organizationNameKey", (q) =>
                        q.eq(
                            "organizationNameKey",
                            enterpriseInquiryRecord.organizationNameKey,
                        ),
                    )
                    .order("desc")
                    .first(),
            ]);
        const mostRecentInquiryCreatedAt = getMostRecentEnterpriseInquiryCreatedAt(
            [
                mostRecentEmailInquiry?.createdAt,
                mostRecentOrganizationInquiry?.createdAt,
            ],
        );

        if (
            isEnterpriseInquiryRateLimited({
                cooldownMs: ENTERPRISE_INQUIRY_COOLDOWN_MS,
                lastSubmittedAt: mostRecentInquiryCreatedAt,
                now: enterpriseInquiryRecord.createdAt,
            })
        ) {
            throw new ConvexError({
                code: "RATE_LIMITED",
                message: getEnterpriseInquiryCooldownMessage(
                    ENTERPRISE_INQUIRY_COOLDOWN_MS,
                ),
            });
        }

        const inquiryId = await ctx.db.insert(
            "salesInquiries",
            enterpriseInquiryRecord,
        );

        return { inquiryId };
    },
});
