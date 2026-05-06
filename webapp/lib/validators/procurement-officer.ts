import { z } from "zod";
import {
    PROCUREMENT_OFFICER_ACTIVATION_CODE_MAX_LENGTH,
    normalizeProcurementOfficerActivationCode,
} from "../procurement-officer/invitations";
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

const fullNameSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validatePlainTextInput(value, {
            field: "fullName",
            label: "Full name",
            maxLength: 100,
            minLength: 2,
        }),
        ctx,
    );
});

const emailSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(validateEmailInput(value), ctx);
});

const phoneSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validatePlainTextInput(value, {
            field: "phone",
            label: "Phone",
            maxLength: 30,
            minLength: 7,
        }),
        ctx,
    );
});

const activationCodeSchema = z
    .string()
    .min(1, "Activation code is required")
    .max(
        PROCUREMENT_OFFICER_ACTIVATION_CODE_MAX_LENGTH,
        `Activation code must be less than ${
            PROCUREMENT_OFFICER_ACTIVATION_CODE_MAX_LENGTH + 1
        } characters`,
    )
    .transform((value) => normalizeProcurementOfficerActivationCode(value));

export const procurementOfficerInviteSchema = z.object({
    email: emailSchema,
    fullName: fullNameSchema,
    phone: phoneSchema,
});

export const procurementOfficerAccessRequestSchema = z
    .object({
        activationCode: activationCodeSchema.optional(),
        email: emailSchema,
        inviteToken: z.string().trim().optional(),
    })
    .superRefine((value, ctx) => {
        if (!value.inviteToken && !value.activationCode) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "An invite link or activation code is required.",
                path: ["activationCode"],
            });
        }
    });

export type ProcurementOfficerInviteFormData = z.infer<
    typeof procurementOfficerInviteSchema
>;
export type ProcurementOfficerAccessRequestData = z.infer<
    typeof procurementOfficerAccessRequestSchema
>;
