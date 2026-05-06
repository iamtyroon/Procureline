"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEnterpriseInquiryRateLimited = exports.createEnterpriseInquiryRecord = exports.getMostRecentEnterpriseInquiryCreatedAt = exports.normalizeEnterpriseInquiryOrganizationKey = exports.normalizeEnterpriseInquiryEmail = exports.contactSalesSchema = exports.getEnterpriseInquiryCooldownMessage = exports.formatEnterpriseInquiryCooldown = exports.ENTERPRISE_INQUIRY_COOLDOWN_MS = void 0;
const zod_1 = require("zod");
const input_1 = require("../shared/security/input");
exports.ENTERPRISE_INQUIRY_COOLDOWN_MS = 10 * 60 * 1000;
function formatEnterpriseInquiryCooldown(cooldownMs = exports.ENTERPRISE_INQUIRY_COOLDOWN_MS) {
    const totalSeconds = Math.max(1, Math.ceil(cooldownMs / 1000));
    if (totalSeconds % 60 === 0) {
        const minutes = totalSeconds / 60;
        return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
    if (totalSeconds > 60) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
    }
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
}
exports.formatEnterpriseInquiryCooldown = formatEnterpriseInquiryCooldown;
function getEnterpriseInquiryCooldownMessage(cooldownMs = exports.ENTERPRISE_INQUIRY_COOLDOWN_MS) {
    return `You've recently submitted an enterprise inquiry. Please wait ${formatEnterpriseInquiryCooldown(cooldownMs)} before sending another.`;
}
exports.getEnterpriseInquiryCooldownMessage = getEnterpriseInquiryCooldownMessage;
function validateWithSharedResult(result, ctx) {
    if (result.ok) {
        return;
    }
    ctx.addIssue({
        code: zod_1.z.ZodIssueCode.custom,
        message: result.issue.message,
    });
}
const contactNameSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validatePlainTextInput)(value, {
        field: "contactName",
        label: "Contact name",
        maxLength: 80,
        minLength: 2,
    }), ctx);
});
const organizationNameSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validatePlainTextInput)(value, {
        field: "organizationName",
        label: "Organization name",
        maxLength: 100,
        minLength: 2,
    }), ctx);
});
const workEmailSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validateEmailInput)(value, "email"), ctx);
});
const messageSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validatePlainTextInput)(value, {
        field: "message",
        label: "Message",
        maxLength: 1200,
        minLength: 20,
    }), ctx);
});
exports.contactSalesSchema = zod_1.z.object({
    contactName: contactNameSchema,
    email: workEmailSchema,
    message: messageSchema,
    organizationName: organizationNameSchema,
});
function normalizeEnterpriseInquiryEmail(email) {
    return (0, input_1.normalizeAuthEmail)(email);
}
exports.normalizeEnterpriseInquiryEmail = normalizeEnterpriseInquiryEmail;
function normalizeEnterpriseInquiryOrganizationKey(organizationName) {
    return (0, input_1.normalizePlainText)(organizationName).toLowerCase();
}
exports.normalizeEnterpriseInquiryOrganizationKey = normalizeEnterpriseInquiryOrganizationKey;
function getMostRecentEnterpriseInquiryCreatedAt(timestamps) {
    const mostRecent = timestamps.reduce((currentMostRecent, timestamp) => Math.max(currentMostRecent, timestamp ?? 0), 0);
    return mostRecent > 0 ? mostRecent : null;
}
exports.getMostRecentEnterpriseInquiryCreatedAt = getMostRecentEnterpriseInquiryCreatedAt;
function createEnterpriseInquiryRecord(args) {
    return {
        contactName: args.contactName.trim(),
        createdAt: args.createdAt,
        email: normalizeEnterpriseInquiryEmail(args.email),
        message: args.message.trim(),
        organizationName: args.organizationName.trim(),
        organizationNameKey: normalizeEnterpriseInquiryOrganizationKey(args.organizationName),
        requestedTier: "enterprise",
        source: "pricing_page",
        status: "new",
    };
}
exports.createEnterpriseInquiryRecord = createEnterpriseInquiryRecord;
function isEnterpriseInquiryRateLimited(args) {
    if (args.lastSubmittedAt == null) {
        return false;
    }
    return args.now - args.lastSubmittedAt < (args.cooldownMs ?? exports.ENTERPRISE_INQUIRY_COOLDOWN_MS);
}
exports.isEnterpriseInquiryRateLimited = isEnterpriseInquiryRateLimited;
