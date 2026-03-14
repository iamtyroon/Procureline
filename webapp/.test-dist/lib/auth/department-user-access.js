"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrubDepartmentUserAccessCodeFromUrl = exports.formatDepartmentUserLockoutMessage = exports.getDepartmentUserLockoutState = exports.isDepartmentUserOtpProviderFailureMessage = exports.getDepartmentUserSubmissionWindowMessage = exports.evaluateDepartmentUserSubmissionWindow = exports.getDepartmentUserAccessCodeSuffix = exports.hashDepartmentUserAccessCode = exports.normalizeDepartmentUserAccessCode = exports.DEPARTMENT_USER_REMINDER_PLACEHOLDER = exports.DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE = exports.SUBSCRIPTION_INACTIVE_MESSAGE = exports.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE = exports.DEACTIVATED_DEPARTMENT_USER_MESSAGE = exports.EXPIRED_ACCESS_CODE_MESSAGE = exports.DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE = exports.INVALID_ACCESS_CODE_MESSAGE = exports.DEPARTMENT_USER_SUBMISSION_GRACE_WINDOW_MS = exports.DEPARTMENT_USER_ACCESS_LOCKOUT_WINDOW_MS = exports.DEPARTMENT_USER_ACCESS_LOCKOUT_THRESHOLD = exports.DEPARTMENT_USER_ACCESS_CHALLENGE_WINDOW_MS = exports.DEPARTMENT_USER_ACCESS_CODE_MAX_LENGTH = exports.DEPARTMENT_USER_AUTH_VERIFY_FLOW = exports.DEPARTMENT_USER_AUTH_START_FLOW = exports.DEPARTMENT_USER_AUTH_PROVIDER = void 0;
exports.DEPARTMENT_USER_AUTH_PROVIDER = "department-user-access";
exports.DEPARTMENT_USER_AUTH_START_FLOW = "otp-start";
exports.DEPARTMENT_USER_AUTH_VERIFY_FLOW = "otp-verify";
exports.DEPARTMENT_USER_ACCESS_CODE_MAX_LENGTH = 64;
exports.DEPARTMENT_USER_ACCESS_CHALLENGE_WINDOW_MS = 15 * 60 * 1000;
exports.DEPARTMENT_USER_ACCESS_LOCKOUT_THRESHOLD = 5;
exports.DEPARTMENT_USER_ACCESS_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
exports.DEPARTMENT_USER_SUBMISSION_GRACE_WINDOW_MS = 30 * 60 * 1000;
exports.INVALID_ACCESS_CODE_MESSAGE = "Invalid access code";
exports.DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE = "Invalid verification code. Please try again.";
exports.EXPIRED_ACCESS_CODE_MESSAGE = "Access code expired. Contact your Procurement Officer.";
exports.DEACTIVATED_DEPARTMENT_USER_MESSAGE = "Account deactivated. Contact your Procurement Officer.";
exports.INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE = "This email can't be used for Department User access. Contact your Procurement Officer.";
exports.SUBSCRIPTION_INACTIVE_MESSAGE = "Subscription inactive. Contact your administrator.";
exports.DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE = "Submission period has ended.";
exports.DEPARTMENT_USER_REMINDER_PLACEHOLDER = "Need an access code reminder? Reminder requests will be added in a follow-up story.";
function normalizeDepartmentUserAccessCode(input) {
    return input
        .trim()
        .toUpperCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-");
}
exports.normalizeDepartmentUserAccessCode = normalizeDepartmentUserAccessCode;
async function hashDepartmentUserAccessCode(normalizedAccessCode) {
    const encoded = new TextEncoder().encode(normalizedAccessCode);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
exports.hashDepartmentUserAccessCode = hashDepartmentUserAccessCode;
function getDepartmentUserAccessCodeSuffix(normalizedAccessCode) {
    return normalizedAccessCode.slice(-4);
}
exports.getDepartmentUserAccessCodeSuffix = getDepartmentUserAccessCodeSuffix;
function evaluateDepartmentUserSubmissionWindow(args) {
    const now = args.now ?? Date.now();
    if (now < args.submissionStartsAt) {
        return {
            accessMode: null,
            state: "not_started",
        };
    }
    if (now <= args.submissionEndsAt) {
        return {
            accessMode: "editable",
            state: "editable",
        };
    }
    if (now <=
        args.submissionEndsAt + exports.DEPARTMENT_USER_SUBMISSION_GRACE_WINDOW_MS) {
        return {
            accessMode: "read_only_grace",
            state: "read_only_grace",
        };
    }
    return {
        accessMode: null,
        state: "ended",
    };
}
exports.evaluateDepartmentUserSubmissionWindow = evaluateDepartmentUserSubmissionWindow;
function getDepartmentUserSubmissionWindowMessage(args) {
    const evaluation = evaluateDepartmentUserSubmissionWindow(args);
    if (evaluation.state === "not_started") {
        return `Submission period has not started yet. Please wait until ${formatDepartmentUserDate(args.submissionStartsAt, args.locale)}.`;
    }
    if (evaluation.state === "read_only_grace") {
        return exports.DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE;
    }
    if (evaluation.state === "ended") {
        return exports.DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE;
    }
    return null;
}
exports.getDepartmentUserSubmissionWindowMessage = getDepartmentUserSubmissionWindowMessage;
function isDepartmentUserOtpProviderFailureMessage(message) {
    if (!message) {
        return false;
    }
    return (/^could not verify code$/i.test(message) ||
        /^invalid code$/i.test(message) ||
        /^expired verification code$/i.test(message));
}
exports.isDepartmentUserOtpProviderFailureMessage = isDepartmentUserOtpProviderFailureMessage;
function getDepartmentUserLockoutState(args) {
    const now = args.now ?? Date.now();
    const lockedUntil = args.lockedUntil ?? null;
    if (!lockedUntil || lockedUntil <= now) {
        return {
            isLockedOut: false,
            lockedUntil: null,
            remainingMs: 0,
        };
    }
    return {
        isLockedOut: args.failedAttempts >= exports.DEPARTMENT_USER_ACCESS_LOCKOUT_THRESHOLD,
        lockedUntil,
        remainingMs: Math.max(lockedUntil - now, 0),
    };
}
exports.getDepartmentUserLockoutState = getDepartmentUserLockoutState;
function formatDepartmentUserLockoutMessage(remainingMs) {
    const remainingSeconds = Math.max(Math.ceil(remainingMs / 1000), 1);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    if (minutes > 0 && seconds > 0) {
        return `Too many failed attempts. Try again in ${minutes}m ${seconds}s.`;
    }
    if (minutes > 0) {
        return `Too many failed attempts. Try again in ${minutes}m.`;
    }
    return `Too many failed attempts. Try again in ${seconds}s.`;
}
exports.formatDepartmentUserLockoutMessage = formatDepartmentUserLockoutMessage;
function scrubDepartmentUserAccessCodeFromUrl(pathname, search) {
    const params = new URLSearchParams(search);
    params.delete("accessCode");
    const nextSearch = params.toString();
    return nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname;
}
exports.scrubDepartmentUserAccessCodeFromUrl = scrubDepartmentUserAccessCodeFromUrl;
function formatDepartmentUserDate(timestamp, locale = "en-US") {
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(timestamp));
}
