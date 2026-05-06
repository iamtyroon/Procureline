import { z } from "zod";
import {
    validateEmailInput,
    validatePlainTextInput,
} from "../shared/security/input";

function validateWithSharedResult(
    result:
        | { ok: true }
        | {
              ok: false;
              issue: {
                  message: string;
              };
          },
    ctx: z.RefinementCtx,
): void {
    if (result.ok) {
        return;
    }

    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.issue.message,
    });
}

const institutionNameSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validatePlainTextInput(value, {
            field: "institutionName",
            label: "Institution name",
            maxLength: 100,
            minLength: 2,
        }),
        ctx,
    );
});

const primaryContactNameSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validatePlainTextInput(value, {
            field: "primaryContactName",
            label: "Primary contact name",
            maxLength: 100,
            minLength: 2,
        }),
        ctx,
    );
});

const primaryContactEmailSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validateEmailInput(value, "primaryContactEmail"),
        ctx,
    );
});

const primaryContactPhoneSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validatePlainTextInput(value, {
            field: "primaryContactPhone",
            label: "Primary contact phone",
            maxLength: 30,
            minLength: 7,
        }),
        ctx,
    );
});

export const tenantAdminInstitutionProfileSchema = z.object({
    fiscalYearStartMonth: z
        .number({
            invalid_type_error: "Fiscal year start month is required",
        })
        .int("Fiscal year start month must be a whole number")
        .min(1, "Fiscal year start month must be between 1 and 12")
        .max(12, "Fiscal year start month must be between 1 and 12"),
    institutionName: institutionNameSchema,
    logoUrl: z
        .string()
        .trim()
        .max(512, "Logo URL must be 512 characters or fewer")
        .optional()
        .or(z.literal("")),
    primaryContactEmail: primaryContactEmailSchema,
    primaryContactName: primaryContactNameSchema,
    primaryContactPhone: primaryContactPhoneSchema,
});

export type TenantAdminInstitutionProfileFormData = z.infer<
    typeof tenantAdminInstitutionProfileSchema
>;
