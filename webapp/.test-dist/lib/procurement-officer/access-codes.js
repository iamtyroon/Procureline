"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAccessCodeBulkGenerationFeedback = exports.buildAbsoluteAccessCodeLoginUrl = exports.resolveProcurelineAppUrl = exports.mapAccessCodeDeliveryStatusLabel = exports.selectDepartmentsForBulkAccessCodeGeneration = exports.getAccessCodeExpirationFormError = exports.validateAccessCodeExpiration = exports.deriveAccessCodeExpirationDefault = exports.maskCanonicalDepartmentAccessCode = exports.validateCanonicalDepartmentAccessCode = exports.buildCanonicalDepartmentAccessCode = exports.generateAccessCodeRandomChars = exports.sanitizeAccessCodeRandomChars = exports.resolveAccessCodeFiscalYearLabel = exports.buildDepartmentAccessCodeInitials = exports.normalizeCanonicalDepartmentAccessCode = exports.DEVELOPMENT_PROCURELINE_APP_URL = exports.ACCESS_CODE_SYNC_REPAIR_REQUIRED_MESSAGE = exports.ACCESS_CODE_LOGIN_URL_PATH = exports.ACCESS_CODE_DELIVERY_GENERIC_ERROR_MESSAGE = exports.ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE = exports.ACCESS_CODE_NO_ELIGIBLE_BULK_MESSAGE = exports.ACCESS_CODE_DEACTIVATED_MESSAGE = exports.ACCESS_CODE_NOT_FOUND_MESSAGE = exports.ACCESS_CODE_EXPIRATION_PAST_MESSAGE = exports.ACCESS_CODE_EXPIRATION_REQUIRED_MESSAGE = exports.ACCESS_CODE_FORMAT_MESSAGE = exports.CANONICAL_ACCESS_CODE_MAX_LENGTH = exports.CANONICAL_ACCESS_CODE_RANDOM_LENGTH = void 0;
const dashboard_1 = require("./dashboard");
const input_1 = require("../security/input");
exports.CANONICAL_ACCESS_CODE_RANDOM_LENGTH = 4;
exports.CANONICAL_ACCESS_CODE_MAX_LENGTH = 24;
exports.ACCESS_CODE_FORMAT_MESSAGE = "Access code must use the canonical format YYYY-DEPT-AB12.";
exports.ACCESS_CODE_EXPIRATION_REQUIRED_MESSAGE = "Choose a future expiration before issuing this access code.";
exports.ACCESS_CODE_EXPIRATION_PAST_MESSAGE = "Access code expiration must still be in the future.";
exports.ACCESS_CODE_NOT_FOUND_MESSAGE = "Access code not found";
exports.ACCESS_CODE_DEACTIVATED_MESSAGE = "Access code deactivated";
exports.ACCESS_CODE_NO_ELIGIBLE_BULK_MESSAGE = "No eligible departments need access codes right now.";
exports.ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE = "This email can't be used for Department User access. Contact your Procurement Officer.";
exports.ACCESS_CODE_DELIVERY_GENERIC_ERROR_MESSAGE = "We could not queue that access-code email right now. Please try again.";
exports.ACCESS_CODE_LOGIN_URL_PATH = "/access/department-user";
exports.ACCESS_CODE_SYNC_REPAIR_REQUIRED_MESSAGE = "Rotate this department code from Access Codes before emailing it.";
exports.DEVELOPMENT_PROCURELINE_APP_URL = "http://localhost:3000";
function normalizeCanonicalDepartmentAccessCode(input) {
    return input
        .trim()
        .toUpperCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/[^A-Z0-9-]/g, "");
}
exports.normalizeCanonicalDepartmentAccessCode = normalizeCanonicalDepartmentAccessCode;
function buildDepartmentAccessCodeInitials(name) {
    const sanitized = (0, input_1.normalizePlainText)(name)
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
exports.buildDepartmentAccessCodeInitials = buildDepartmentAccessCodeInitials;
function resolveAccessCodeFiscalYearLabel(input = Date.now()) {
    const key = (0, dashboard_1.getProcurementFiscalYearForDate)(input).key;
    return key.split("-")[0] ?? String(new Date(input).getUTCFullYear());
}
exports.resolveAccessCodeFiscalYearLabel = resolveAccessCodeFiscalYearLabel;
function sanitizeAccessCodeRandomChars(value) {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, exports.CANONICAL_ACCESS_CODE_RANDOM_LENGTH);
}
exports.sanitizeAccessCodeRandomChars = sanitizeAccessCodeRandomChars;
function generateAccessCodeRandomChars(length = exports.CANONICAL_ACCESS_CODE_RANDOM_LENGTH) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
exports.generateAccessCodeRandomChars = generateAccessCodeRandomChars;
function buildCanonicalDepartmentAccessCode(args) {
    const fiscalYear = args.fiscalYear ?? resolveAccessCodeFiscalYearLabel(args.now ?? Date.now());
    const initials = buildDepartmentAccessCodeInitials(args.departmentName);
    const randomChars = sanitizeAccessCodeRandomChars(args.randomChars ??
        generateAccessCodeRandomChars(exports.CANONICAL_ACCESS_CODE_RANDOM_LENGTH));
    return normalizeCanonicalDepartmentAccessCode(`${fiscalYear}-${initials}-${randomChars}`);
}
exports.buildCanonicalDepartmentAccessCode = buildCanonicalDepartmentAccessCode;
function validateCanonicalDepartmentAccessCode(value) {
    const normalized = normalizeCanonicalDepartmentAccessCode(value);
    if (normalized.length === 0 ||
        normalized.length > exports.CANONICAL_ACCESS_CODE_MAX_LENGTH ||
        !/^\d{4}-[A-Z0-9]{2,6}-[A-Z0-9]{4}$/.test(normalized)) {
        return {
            message: exports.ACCESS_CODE_FORMAT_MESSAGE,
            ok: false,
        };
    }
    return {
        message: "",
        ok: true,
    };
}
exports.validateCanonicalDepartmentAccessCode = validateCanonicalDepartmentAccessCode;
function maskCanonicalDepartmentAccessCode(code) {
    const normalized = normalizeCanonicalDepartmentAccessCode(code);
    const [fiscalYear, departmentInitials, randomChars] = normalized.split("-");
    if (!fiscalYear || !departmentInitials || !randomChars) {
        return "Unavailable";
    }
    const revealedSuffix = randomChars.slice(-2);
    const maskedPrefix = "*".repeat(Math.max(randomChars.length - revealedSuffix.length, 0));
    return `${fiscalYear}-${departmentInitials}-${maskedPrefix}${revealedSuffix}`;
}
exports.maskCanonicalDepartmentAccessCode = maskCanonicalDepartmentAccessCode;
function deriveAccessCodeExpirationDefault(args) {
    const sharedDeadline = (0, dashboard_1.deriveSharedSubmissionDeadline)(args.departments);
    return {
        deadlineAt: sharedDeadline.deadlineAt,
        label: sharedDeadline.state === "available"
            ? sharedDeadline.label
            : "Manual expiration required",
        state: sharedDeadline.state,
    };
}
exports.deriveAccessCodeExpirationDefault = deriveAccessCodeExpirationDefault;
function validateAccessCodeExpiration(args) {
    if (typeof args.expirationAt !== "number") {
        return {
            message: exports.ACCESS_CODE_EXPIRATION_REQUIRED_MESSAGE,
            ok: false,
        };
    }
    if (args.expirationAt <= (args.now ?? Date.now())) {
        return {
            message: exports.ACCESS_CODE_EXPIRATION_PAST_MESSAGE,
            ok: false,
        };
    }
    return {
        message: "",
        ok: true,
    };
}
exports.validateAccessCodeExpiration = validateAccessCodeExpiration;
function getAccessCodeExpirationFormError(error) {
    if (!(error instanceof Error)) {
        return null;
    }
    const message = error.message.trim();
    if (message === exports.ACCESS_CODE_EXPIRATION_REQUIRED_MESSAGE ||
        message === exports.ACCESS_CODE_EXPIRATION_PAST_MESSAGE) {
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
        const payload = JSON.parse(message.slice(payloadStart, payloadEnd + 1));
        if (payload.code !== "VALIDATION_FAILED" ||
            typeof payload.message !== "string") {
            return null;
        }
        if (payload.field === "expirationAt" ||
            payload.field === "expiresAt") {
            return {
                field: "expiresAt",
                message: payload.message,
            };
        }
    }
    catch {
        return null;
    }
    return null;
}
exports.getAccessCodeExpirationFormError = getAccessCodeExpirationFormError;
function selectDepartmentsForBulkAccessCodeGeneration(args) {
    return args.candidates
        .filter((candidate) => candidate.isActive)
        .filter((candidate) => args.includeDepartmentsWithActiveCodes
        ? true
        : !candidate.hasActiveCode)
        .map((candidate) => candidate.departmentId);
}
exports.selectDepartmentsForBulkAccessCodeGeneration = selectDepartmentsForBulkAccessCodeGeneration;
function mapAccessCodeDeliveryStatusLabel(status) {
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
exports.mapAccessCodeDeliveryStatusLabel = mapAccessCodeDeliveryStatusLabel;
function resolveProcurelineAppUrl(args) {
    const nodeEnv = args?.nodeEnv ??
        (typeof process.env.NODE_ENV === "string"
            ? process.env.NODE_ENV
            : "development");
    const rawAppUrl = args?.appUrl ??
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.APP_URL;
    const rawVercelUrl = args?.vercelUrl ?? process.env.VERCEL_URL;
    const candidate = typeof rawAppUrl === "string" && rawAppUrl.trim().length > 0
        ? rawAppUrl.trim()
        : typeof rawVercelUrl === "string" && rawVercelUrl.trim().length > 0
            ? `https://${rawVercelUrl.trim().replace(/^https?:\/\//, "")}`
            : nodeEnv === "development" || nodeEnv === "test"
                ? exports.DEVELOPMENT_PROCURELINE_APP_URL
                : null;
    if (!candidate) {
        throw new Error("Configure NEXT_PUBLIC_APP_URL or VERCEL_URL before queueing access-code emails.");
    }
    return candidate.replace(/\/+$/, "");
}
exports.resolveProcurelineAppUrl = resolveProcurelineAppUrl;
function buildAbsoluteAccessCodeLoginUrl(args) {
    const appUrl = resolveProcurelineAppUrl({
        appUrl: args?.appUrl,
        nodeEnv: args?.nodeEnv,
        vercelUrl: args?.vercelUrl,
    });
    const loginPath = typeof args?.loginPath === "string" && args.loginPath.trim().length > 0
        ? args.loginPath.trim()
        : exports.ACCESS_CODE_LOGIN_URL_PATH;
    return new URL(loginPath, `${appUrl}/`).toString();
}
exports.buildAbsoluteAccessCodeLoginUrl = buildAbsoluteAccessCodeLoginUrl;
function buildAccessCodeBulkGenerationFeedback(args) {
    const generatedCount = args.results.filter((result) => result.outcome === "generated").length;
    const skippedCount = args.results.filter((result) => result.outcome === "skipped").length;
    const failedCount = args.results.filter((result) => result.outcome === "failed").length;
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
            detail: result.outcome === "generated"
                ? "Generated a new canonical access code."
                : result.reason?.trim() ||
                    (result.outcome === "failed"
                        ? "Generation failed."
                        : "Skipped because the department already has active coverage."),
            outcome: result.outcome,
        })),
        skippedCount,
        summary: args.summary,
        title: failedCount > 0
            ? "Bulk generation finished with follow-up needed"
            : "Bulk generation finished",
    };
}
exports.buildAccessCodeBulkGenerationFeedback = buildAccessCodeBulkGenerationFeedback;
