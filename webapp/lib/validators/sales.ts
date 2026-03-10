import { z } from "zod";
import {
    normalizeAuthEmail,
    normalizePlainText,
    validateEmailInput,
    validatePlainTextInput,
} from "../security/input";

export const ENTERPRISE_INQUIRY_COOLDOWN_MS = 10 * 60 * 1000;

function validateWithSharedResult(
    result:
        | { ok: true }
        | {
            issue: {
                message: string;
            };
            ok: false;
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

const contactNameSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validatePlainTextInput(value, {
            field: "contactName",
            label: "Contact name",
            maxLength: 80,
            minLength: 2,
        }),
        ctx,
    );
});

const organizationNameSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validatePlainTextInput(value, {
            field: "organizationName",
            label: "Organization name",
            maxLength: 100,
            minLength: 2,
        }),
        ctx,
    );
});

const workEmailSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(validateEmailInput(value, "email"), ctx);
});

const messageSchema = z.string().superRefine((value, ctx) => {
    validateWithSharedResult(
        validatePlainTextInput(value, {
            field: "message",
            label: "Message",
            maxLength: 1200,
            minLength: 20,
        }),
        ctx,
    );
});

export const contactSalesSchema = z.object({
    contactName: contactNameSchema,
    email: workEmailSchema,
    message: messageSchema,
    organizationName: organizationNameSchema,
});

export interface EnterpriseInquiryRecord {
    contactName: string;
    createdAt: number;
    email: string;
    message: string;
    organizationName: string;
    organizationNameKey: string;
    requestedTier: "enterprise";
    source: "pricing_page";
    status: "new";
}

export function normalizeEnterpriseInquiryEmail(email: string): string {
    return normalizeAuthEmail(email);
}

export function normalizeEnterpriseInquiryOrganizationKey(
    organizationName: string,
): string {
    return normalizePlainText(organizationName).toLowerCase();
}

export function getMostRecentEnterpriseInquiryCreatedAt(
    timestamps: Array<number | null | undefined>,
): number | null {
    const mostRecent = timestamps.reduce<number>(
        (currentMostRecent, timestamp) =>
            Math.max(currentMostRecent, timestamp ?? 0),
        0,
    );

    return mostRecent > 0 ? mostRecent : null;
}

export function createEnterpriseInquiryRecord(args: {
    contactName: string;
    createdAt: number;
    email: string;
    message: string;
    organizationName: string;
}): EnterpriseInquiryRecord {
    return {
        contactName: args.contactName.trim(),
        createdAt: args.createdAt,
        email: normalizeEnterpriseInquiryEmail(args.email),
        message: args.message.trim(),
        organizationName: args.organizationName.trim(),
        organizationNameKey: normalizeEnterpriseInquiryOrganizationKey(
            args.organizationName,
        ),
        requestedTier: "enterprise",
        source: "pricing_page",
        status: "new",
    };
}

export function isEnterpriseInquiryRateLimited(args: {
    cooldownMs?: number;
    lastSubmittedAt: number | null | undefined;
    now: number;
}): boolean {
    if (args.lastSubmittedAt == null) {
        return false;
    }

    return args.now - args.lastSubmittedAt < (args.cooldownMs ?? ENTERPRISE_INQUIRY_COOLDOWN_MS);
}

export type ContactSalesFormData = z.infer<typeof contactSalesSchema>;
