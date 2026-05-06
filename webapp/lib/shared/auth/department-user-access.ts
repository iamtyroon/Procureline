export const DEPARTMENT_USER_AUTH_PROVIDER = "department-user-access" as const;
export const DEPARTMENT_USER_AUTH_START_FLOW = "otp-start" as const;
export const DEPARTMENT_USER_AUTH_VERIFY_FLOW = "otp-verify" as const;

export const DEPARTMENT_USER_ACCESS_CODE_MAX_LENGTH = 64;
export const DEPARTMENT_USER_ACCESS_CHALLENGE_WINDOW_MS = 15 * 60 * 1000;
export const DEPARTMENT_USER_ACCESS_LOCKOUT_THRESHOLD = 5;
export const DEPARTMENT_USER_ACCESS_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const DEPARTMENT_USER_SUBMISSION_GRACE_WINDOW_MS = 30 * 60 * 1000;

export const INVALID_ACCESS_CODE_MESSAGE = "Invalid access code";
export const DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE =
    "Invalid verification code. Please try again.";
export const EXPIRED_ACCESS_CODE_MESSAGE =
    "Access code expired. Contact your Procurement Officer.";
export const DEACTIVATED_DEPARTMENT_USER_MESSAGE =
    "Account deactivated. Contact your Procurement Officer.";
export const DEPARTMENT_USER_SETUP_REQUIRED_MESSAGE =
    "Department setup is incomplete. Contact your Procurement Officer.";
export const INCOMPATIBLE_DEPARTMENT_USER_EMAIL_MESSAGE =
    "This email can't be used for Department User access. Contact your Procurement Officer.";
export const SUBSCRIPTION_INACTIVE_MESSAGE =
    "Subscription inactive. Contact your administrator.";
export const DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE =
    "Submission period has ended.";
export const DEPARTMENT_USER_REMINDER_PLACEHOLDER =
    "Need an access code reminder? Reminder requests will be added in a follow-up story.";

export type DepartmentUserAccessMode = "editable" | "read_only_grace";
export type DepartmentUserSubmissionWindowState =
    | "editable"
    | "ended"
    | "not_started"
    | "read_only_grace";

export interface DepartmentUserWindowEvaluation {
    accessMode: DepartmentUserAccessMode | null;
    state: DepartmentUserSubmissionWindowState;
}

export interface DepartmentUserLockoutState {
    isLockedOut: boolean;
    lockedUntil: number | null;
    remainingMs: number;
}

export function hasConfiguredDepartmentUserSubmissionWindow(args: {
    submissionEndsAt?: number | null;
    submissionStartsAt?: number | null;
}): boolean {
    return (
        typeof args.submissionStartsAt === "number" &&
        typeof args.submissionEndsAt === "number" &&
        args.submissionEndsAt > args.submissionStartsAt
    );
}

export function normalizeDepartmentUserAccessCode(input: string): string {
    return input
        .trim()
        .toUpperCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-");
}

export async function hashDepartmentUserAccessCode(
    normalizedAccessCode: string,
): Promise<string> {
    const encoded = new TextEncoder().encode(normalizedAccessCode);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest), (value) =>
        value.toString(16).padStart(2, "0"),
    ).join("");
}

export function getDepartmentUserAccessCodeSuffix(
    normalizedAccessCode: string,
): string {
    return normalizedAccessCode.slice(-4);
}

export function evaluateDepartmentUserSubmissionWindow(args: {
    now?: number;
    submissionEndsAt: number;
    submissionStartsAt: number;
}): DepartmentUserWindowEvaluation {
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

    if (
        now <=
        args.submissionEndsAt + DEPARTMENT_USER_SUBMISSION_GRACE_WINDOW_MS
    ) {
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

export function getDepartmentUserSubmissionWindowMessage(args: {
    locale?: string;
    now?: number;
    submissionEndsAt: number;
    submissionStartsAt: number;
    timeZone?: string;
}): string | null {
    const evaluation = evaluateDepartmentUserSubmissionWindow(args);

    if (evaluation.state === "not_started") {
        return `Submission period has not started yet. Please wait until ${formatDepartmentUserDate(
            args.submissionStartsAt,
            args.locale,
            args.timeZone,
        )}.`;
    }

    if (evaluation.state === "read_only_grace") {
        return DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE;
    }

    if (evaluation.state === "ended") {
        return DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE;
    }

    return null;
}

export function isDepartmentUserOtpProviderFailureMessage(
    message: string | null,
): boolean {
    if (!message) {
        return false;
    }

    return (
        /^could not verify code$/i.test(message) ||
        /^invalid code$/i.test(message) ||
        /^expired verification code$/i.test(message)
    );
}

export function getDepartmentUserLockoutState(args: {
    failedAttempts: number;
    lockedUntil?: number | null;
    now?: number;
}): DepartmentUserLockoutState {
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
        isLockedOut: args.failedAttempts >= DEPARTMENT_USER_ACCESS_LOCKOUT_THRESHOLD,
        lockedUntil,
        remainingMs: Math.max(lockedUntil - now, 0),
    };
}

export function formatDepartmentUserLockoutMessage(remainingMs: number): string {
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

export function scrubDepartmentUserAccessCodeFromUrl(
    pathname: string,
    search: string,
): string {
    const params = new URLSearchParams(search);
    params.delete("accessCode");

    const nextSearch = params.toString();
    return nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname;
}

function formatDepartmentUserDate(
    timestamp: number,
    locale: string = "en-US",
    timeZone?: string,
): string {
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        ...(timeZone ? { timeZone } : {}),
        year: "numeric",
    }).format(new Date(timestamp));
}
