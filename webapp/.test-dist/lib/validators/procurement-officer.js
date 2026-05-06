"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.procurementOfficerAccessRequestSchema = exports.procurementOfficerInviteSchema = void 0;
const zod_1 = require("zod");
const invitations_1 = require("../procurement-officer/invitations");
const input_1 = require("../shared/security/input");
function validateWithSharedResult(result, ctx) {
    if (result.ok) {
        return;
    }
    ctx.addIssue({
        code: zod_1.z.ZodIssueCode.custom,
        message: result.issue.message,
    });
}
const fullNameSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validatePlainTextInput)(value, {
        field: "fullName",
        label: "Full name",
        maxLength: 100,
        minLength: 2,
    }), ctx);
});
const emailSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validateEmailInput)(value), ctx);
});
const phoneSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validatePlainTextInput)(value, {
        field: "phone",
        label: "Phone",
        maxLength: 30,
        minLength: 7,
    }), ctx);
});
const activationCodeSchema = zod_1.z
    .string()
    .min(1, "Activation code is required")
    .max(invitations_1.PROCUREMENT_OFFICER_ACTIVATION_CODE_MAX_LENGTH, `Activation code must be less than ${invitations_1.PROCUREMENT_OFFICER_ACTIVATION_CODE_MAX_LENGTH + 1} characters`)
    .transform((value) => (0, invitations_1.normalizeProcurementOfficerActivationCode)(value));
exports.procurementOfficerInviteSchema = zod_1.z.object({
    email: emailSchema,
    fullName: fullNameSchema,
    phone: phoneSchema,
});
exports.procurementOfficerAccessRequestSchema = zod_1.z
    .object({
    activationCode: activationCodeSchema.optional(),
    email: emailSchema,
    inviteToken: zod_1.z.string().trim().optional(),
})
    .superRefine((value, ctx) => {
    if (!value.inviteToken && !value.activationCode) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "An invite link or activation code is required.",
            path: ["activationCode"],
        });
    }
});
