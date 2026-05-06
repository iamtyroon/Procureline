import {
    deriveSharedSubmissionDeadline,
    getProcurementFiscalYearForDate,
    type ProcurementSubmissionDeadlineRecord,
    type ProcurementDepartmentWindowRecord,
} from "./dashboard";
import { normalizePlainText } from "../shared/security/input";

export const CANONICAL_ACCESS_CODE_RANDOM_LENGTH = 4;
export const CANONICAL_ACCESS_CODE_MAX_LENGTH = 24;
export const ACCESS_CODE_FORMAT_MESSAGE =
    "Access code must use the canonical format YYYY-DEPT-AB12.";
export const ACCESS_CODE_EXPIRATION_REQUIRED_MESSAGE =
    "Choose a future expiration before issuing this access code.";
export const ACCESS_CODE_EXPIRATION_PAST_MESSAGE =
    "Access code expiration must still be in the future.";
export const ACCESS_CODE_NOT_FOUND_MESSAGE = "Access code not found";
export const ACCESS_CODE_DEACTIVATED_MESSAGE = "Access code deactivated";
export const ACCESS_CODE_NO_ELIGIBLE_BULK_MESSAGE =
    "No eligible departments need access codes right now.";
export const ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE =
    "This email can't be used for Department User access. Contact your Procurement Officer.";
export const ACCESS_CODE_DELIVERY_GENERIC_ERROR_MESSAGE =
    "We could not queue that access-code email right now. Please try again.";
export const ACCESS_CODE_LOGIN_URL_PATH = "/access/department-user";
export const ACCESS_CODE_SYNC_REPAIR_REQUIRED_MESSAGE =
    "Rotate this department code from Access Codes before emailing it.";
export const DEVELOPMENT_PROCURELINE_APP_URL = "http://localhost:3000";

export type AccessCodeDeliveryStatus =
    | "failed"
    | "none"
    | "queued"
    | "sent";
export type AccessCodeBulkGenerationOutcome =
    | "failed"
    | "generated"
    | "skipped";

export interface AccessCodeBulkGenerationResult {
    departmentId: string;
    departmentName: string;
    outcome: AccessCodeBulkGenerationOutcome;
    reason?: string;
}

export interface AccessCodeBulkGenerationFeedback {
    failedCount: number;
    generatedCount: number;
    items: Array<{
        departmentId: string;
        departmentName: string;
        detail: string;
        outcome: AccessCodeBulkGenerationOutcome;
    }>;
    skippedCount: number;
    summary: string;
    title: string;
}

interface AccessCodeValidationErrorEnvelope {
    code?: unknown;
    field?: unknown;
    message?: unknown;
}

export interface AccessCodeExpirationDefault {
    deadlineAt: number | null;
    label: string;
    state: "available" | "setup_required";
}

export interface AccessCodeBulkGenerationCandidate {
    departmentId: string;
    hasActiveCode: boolean;
    isActive: boolean;
}

export function normalizeCanonicalDepartmentAccessCode(input: string): string {
    return input
        .trim()
        .toUpperCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/[^A-Z0-9-]/g, "");
}

export function buildDepartmentAccessCodeInitials(name: string): string {
    const sanitized = normalizePlainText(name)
        .toUpperCase()
        .replace(/[^A-Z0-9 ]+/g, " ")
        .trim();
    const parts = sanitized.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
        return parts
            .map((part) => part[0] ?? "")
            .join("")
            .slice(0, 6);
    }

    const compact = sanitized.replace(/\s+/g, "");
    if (compact.length >= 2) {
        return compact.slice(0, Math.min(compact.length, 6));
    }

    return "DEPT";
}

export function resolveAccessCodeFiscalYearLabel(
    input: Date | number = Date.now(),
): string {
    const key = getProcurementFiscalYearForDate(input).key;
    return key.split("-")[0] ?? String(new Date(input).getUTCFullYear());
}

export function sanitizeAccessCodeRandomChars(value: string): string {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, CANONICAL_ACCESS_CODE_RANDOM_LENGTH);
}

export function generateAccessCodeRandomChars(
    length: number = CANONICAL_ACCESS_CODE_RANDOM_LENGTH,
): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(length));

    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function buildCanonicalDepartmentAccessCode(args: {
    departmentName: string;
    fiscalYear?: string;
    now?: Date | number;
    randomChars?: string;
}): string {
    const fiscalYear =
        args.fiscalYear ?? resolveAccessCodeFiscalYearLabel(args.now ?? Date.now());
    const initials = buildDepartmentAccessCodeInitials(args.departmentName);
    const randomChars = sanitizeAccessCodeRandomChars(
        args.randomChars ??
            generateAccessCodeRandomChars(CANONICAL_ACCESS_CODE_RANDOM_LENGTH),
    );

    return normalizeCanonicalDepartmentAccessCode(
        `${fiscalYear}-${initials}-${randomChars}`,
    );
}

export function validateCanonicalDepartmentAccessCode(value: string): {
    message: string;
    ok: boolean;
} {
    const normalized = normalizeCanonicalDepartmentAccessCode(value);

    if (
        normalized.length === 0 ||
        normalized.length > CANONICAL_ACCESS_CODE_MAX_LENGTH ||
        !/^\d{4}-[A-Z0-9]{2,6}-[A-Z0-9]{4}$/.test(normalized)
    ) {
        return {
            message: ACCESS_CODE_FORMAT_MESSAGE,
            ok: false,
        };
    }

    return {
        message: "",
        ok: true,
    };
}

export function maskCanonicalDepartmentAccessCode(code: string): string {
    const normalized = normalizeCanonicalDepartmentAccessCode(code);
    const [fiscalYear, departmentInitials, randomChars] = normalized.split("-");

    if (!fiscalYear || !departmentInitials || !randomChars) {
        return "Unavailable";
    }

    const revealedSuffix = randomChars.slice(-2);
    const maskedPrefix = "*".repeat(Math.max(randomChars.length - revealedSuffix.length, 0));

    return `${fiscalYear}-${departmentInitials}-${maskedPrefix}${revealedSuffix}`;
}

export function deriveAccessCodeExpirationDefault(args: {
    deadlineRecord?: ProcurementSubmissionDeadlineRecord | null;
    departments: readonly ProcurementDepartmentWindowRecord[];
    fiscalYearKey?: string;
    fiscalYearStartMonth?: number | null;
    tenantTimeZone?: string | null;
}): AccessCodeExpirationDefault {
    const fiscalYearKey =
        args.fiscalYearKey ??
        getProcurementFiscalYearForDate(Date.now(), {
            fiscalYearStartMonth: args.fiscalYearStartMonth,
            timeZone: args.tenantTimeZone,
        }).key;
    const sharedDeadline = deriveSharedSubmissionDeadline({
        deadlineRecord: args.deadlineRecord,
        departments: args.departments,
        fiscalYearKey,
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        now: Date.now(),
        tenantTimeZone: args.tenantTimeZone,
    });

    return {
        deadlineAt: sharedDeadline.deadlineAt,
        label:
            sharedDeadline.state === "available"
                ? `${sharedDeadline.label} (${sharedDeadline.timeZone})`
                : "Manual expiration required",
        state: sharedDeadline.state,
    };
}

export function validateAccessCodeExpiration(args: {
    expirationAt?: number | null;
    now?: number;
}): { message: string; ok: boolean } {
    if (typeof args.expirationAt !== "number") {
        return {
            message: ACCESS_CODE_EXPIRATION_REQUIRED_MESSAGE,
            ok: false,
        };
    }

    if (args.expirationAt <= (args.now ?? Date.now())) {
        return {
            message: ACCESS_CODE_EXPIRATION_PAST_MESSAGE,
            ok: false,
        };
    }

    return {
        message: "",
        ok: true,
    };
}

export function getAccessCodeExpirationFormError(error: unknown): {
    field: "expiresAt";
    message: string;
} | null {
    if (!(error instanceof Error)) {
        return null;
    }

    const message = error.message.trim();
    if (
        message === ACCESS_CODE_EXPIRATION_REQUIRED_MESSAGE ||
        message === ACCESS_CODE_EXPIRATION_PAST_MESSAGE
    ) {
        return {
            field: "expiresAt",
            message,
        };
    }

    const payloadStart = message.indexOf("{");
    const payloadEnd = message.lastIndexOf("}");
    if (payloadStart < 0 || payloadEnd <= payloadStart) {
        return null;
    }

    try {
        const payload = JSON.parse(
            message.slice(payloadStart, payloadEnd + 1),
        ) as AccessCodeValidationErrorEnvelope;
        if (
            payload.code !== "VALIDATION_FAILED" ||
            typeof payload.message !== "string"
        ) {
            return null;
        }

        if (
            payload.field === "expirationAt" ||
            payload.field === "expiresAt"
        ) {
            return {
                field: "expiresAt",
                message: payload.message,
            };
        }
    } catch {
        return null;
    }

    return null;
}

export function selectDepartmentsForBulkAccessCodeGeneration(args: {
    candidates: readonly AccessCodeBulkGenerationCandidate[];
    includeDepartmentsWithActiveCodes?: boolean;
}): string[] {
    return args.candidates
        .filter((candidate) => candidate.isActive)
        .filter((candidate) =>
            args.includeDepartmentsWithActiveCodes
                ? true
                : !candidate.hasActiveCode,
        )
        .map((candidate) => candidate.departmentId);
}

export function mapAccessCodeDeliveryStatusLabel(
    status: AccessCodeDeliveryStatus,
): string {
    switch (status) {
        case "queued":
            return "Queued";
        case "sent":
            return "Sent";
        case "failed":
            return "Retry needed";
        default:
            return "Not sent";
    }
}

export function resolveProcurelineAppUrl(args?: {
    appUrl?: string;
    nodeEnv?: string;
    vercelUrl?: string;
}): string {
    const nodeEnv =
        args?.nodeEnv ??
        (typeof process.env.NODE_ENV === "string"
            ? process.env.NODE_ENV
            : "development");
    const rawAppUrl =
        args?.appUrl ??
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.APP_URL;
    const rawVercelUrl = args?.vercelUrl ?? process.env.VERCEL_URL;
    const candidate =
        typeof rawAppUrl === "string" && rawAppUrl.trim().length > 0
            ? rawAppUrl.trim()
            : typeof rawVercelUrl === "string" && rawVercelUrl.trim().length > 0
              ? `https://${rawVercelUrl.trim().replace(/^https?:\/\//, "")}`
              : nodeEnv === "development" || nodeEnv === "test"
                ? DEVELOPMENT_PROCURELINE_APP_URL
                : null;

    if (!candidate) {
        throw new Error(
            "Configure NEXT_PUBLIC_APP_URL or VERCEL_URL before queueing access-code emails.",
        );
    }

    return candidate.replace(/\/+$/, "");
}

export function buildAbsoluteAccessCodeLoginUrl(args?: {
    appUrl?: string;
    loginPath?: string;
    nodeEnv?: string;
    vercelUrl?: string;
}): string {
    const appUrl = resolveProcurelineAppUrl({
        appUrl: args?.appUrl,
        nodeEnv: args?.nodeEnv,
        vercelUrl: args?.vercelUrl,
    });
    const loginPath =
        typeof args?.loginPath === "string" && args.loginPath.trim().length > 0
            ? args.loginPath.trim()
            : ACCESS_CODE_LOGIN_URL_PATH;

    return new URL(loginPath, `${appUrl}/`).toString();
}

export function buildAccessCodeBulkGenerationFeedback(args: {
    noEligibleDepartments: boolean;
    results: readonly AccessCodeBulkGenerationResult[];
    summary: string;
}): AccessCodeBulkGenerationFeedback {
    const generatedCount = args.results.filter(
        (result) => result.outcome === "generated",
    ).length;
    const skippedCount = args.results.filter(
        (result) => result.outcome === "skipped",
    ).length;
    const failedCount = args.results.filter(
        (result) => result.outcome === "failed",
    ).length;

    if (args.noEligibleDepartments) {
        return {
            failedCount,
            generatedCount,
            items: [],
            skippedCount,
            summary: args.summary,
            title: "No departments needed new access codes",
        };
    }

    return {
        failedCount,
        generatedCount,
        items: args.results.map((result) => ({
            departmentId: result.departmentId,
            departmentName: result.departmentName,
            detail:
                result.outcome === "generated"
                    ? "Generated a new canonical access code."
                    : result.reason?.trim() ||
                      (result.outcome === "failed"
                          ? "Generation failed."
                          : "Skipped because the department already has active coverage."),
            outcome: result.outcome,
        })),
        skippedCount,
        summary: args.summary,
        title:
            failedCount > 0
                ? "Bulk generation finished with follow-up needed"
                : "Bulk generation finished",
    };
}
