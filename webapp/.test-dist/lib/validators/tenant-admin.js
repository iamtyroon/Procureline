"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantAdminInstitutionProfileSchema = void 0;
const zod_1 = require("zod");
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
const institutionNameSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validatePlainTextInput)(value, {
        field: "institutionName",
        label: "Institution name",
        maxLength: 100,
        minLength: 2,
    }), ctx);
});
const primaryContactNameSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validatePlainTextInput)(value, {
        field: "primaryContactName",
        label: "Primary contact name",
        maxLength: 100,
        minLength: 2,
    }), ctx);
});
const primaryContactEmailSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validateEmailInput)(value, "primaryContactEmail"), ctx);
});
const primaryContactPhoneSchema = zod_1.z.string().superRefine((value, ctx) => {
    validateWithSharedResult((0, input_1.validatePlainTextInput)(value, {
        field: "primaryContactPhone",
        label: "Primary contact phone",
        maxLength: 30,
        minLength: 7,
    }), ctx);
});
exports.tenantAdminInstitutionProfileSchema = zod_1.z.object({
    fiscalYearStartMonth: zod_1.z
        .number({
        invalid_type_error: "Fiscal year start month is required",
    })
        .int("Fiscal year start month must be a whole number")
        .min(1, "Fiscal year start month must be between 1 and 12")
        .max(12, "Fiscal year start month must be between 1 and 12"),
    institutionName: institutionNameSchema,
    logoUrl: zod_1.z
        .string()
        .trim()
        .max(512, "Logo URL must be 512 characters or fewer")
        .optional()
        .or(zod_1.z.literal("")),
    primaryContactEmail: primaryContactEmailSchema,
    primaryContactName: primaryContactNameSchema,
    primaryContactPhone: primaryContactPhoneSchema,
});
