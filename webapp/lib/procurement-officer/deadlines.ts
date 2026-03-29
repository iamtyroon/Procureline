const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const DEFAULT_DEADLINE_TIME_ZONE = "Africa/Nairobi";
export const DEFAULT_FISCAL_YEAR_START_MONTH = 7;
export const DEADLINE_REMINDER_OFFSETS = [7, 3, 1] as const;

export const DEADLINE_IN_PAST_MESSAGE = "Deadline cannot be in the past";
export const DEADLINE_ORDER_MESSAGE =
    "Submission deadline must be after the submission start.";
export const DEADLINE_NO_DEPARTMENTS_MESSAGE =
    "Create at least one active department before configuring a submission deadline.";
export const DEADLINE_TIGHTEN_CONFIRMATION_MESSAGE =
    "Confirm this change before shortening or tightening the shared submission window.";

export type DeadlineReminderOffset = (typeof DEADLINE_REMINDER_OFFSETS)[number];
export type SubmissionDeadlineChangeType =
    | "edited"
    | "extension"
    | "initial_setup"
    | "tightened"
    | "unchanged";
export type SubmissionDeadlineReminderJobStatus =
    | "cancelled"
    | "failed"
    | "scheduled"
    | "skipped";
export type SubmissionDeadlineState = "available" | "setup_required";
export type SubmissionDeadlineSource =
    | "canonical"
    | "department_fallback"
    | "none";
export type SubmissionDeadlineReason =
    | "inconsistent_windows"
    | "invalid_window"
    | "missing_window"
    | "no_departments";

export interface DeadlineWindowRecord {
    isActive: boolean;
    submissionEndsAt?: number | null;
    submissionStartsAt?: number | null;
}

export interface SubmissionDeadlineRecordLike {
    announcementIssuedAt?: number | null;
    announcementMessage?: string | null;
    announcementTitle?: string | null;
    deadlineVersion?: number | null;
    fiscalYearKey: string;
    reminderOffsets?: readonly number[] | null;
    submissionEndsAt: number;
    submissionStartsAt: number;
    timeZone?: string | null;
    updatedAt?: number | null;
}

export interface ResolvedSubmissionDeadline {
    announcementIssuedAt: number | null;
    announcementMessage: string | null;
    announcementTitle: string | null;
    countdownLabel: string;
    countdownTargetAt: number | null;
    deadlineVersion: number;
    fiscalYearKey: string;
    formattedDeadlineAt: string;
    formattedStartAt: string;
    reminderOffsets: number[];
    reason: SubmissionDeadlineReason;
    source: SubmissionDeadlineSource;
    state: SubmissionDeadlineState;
    submissionEndsAt: number | null;
    submissionStartsAt: number | null;
    timeZone: string;
    timeZoneUsesFallback: boolean;
    updatedAt: number | null;
}

interface TimeZoneParts {
    day: number;
    hour: number;
    minute: number;
    month: number;
    second: number;
    year: number;
}

interface ParsedWallTimeInput {
    day: number;
    hour: number;
    minute: number;
    month: number;
    year: number;
}

function isValidTimeZone(timeZone: string | null | undefined): boolean {
    if (!timeZone || typeof timeZone !== "string") {
        return false;
    }

    try {
        new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

export function resolveDeadlineTimeZone(args?: {
    deadlineTimeZone?: string | null;
    tenantTimeZone?: string | null;
}): {
    timeZone: string;
    usesFallback: boolean;
} {
    if (isValidTimeZone(args?.deadlineTimeZone)) {
        return {
            timeZone: args?.deadlineTimeZone as string,
            usesFallback: false,
        };
    }

    if (isValidTimeZone(args?.tenantTimeZone)) {
        return {
            timeZone: args?.tenantTimeZone as string,
            usesFallback: false,
        };
    }

    return {
        timeZone: DEFAULT_DEADLINE_TIME_ZONE,
        usesFallback: true,
    };
}

export function normalizeFiscalYearStartMonth(value?: number | null): number {
    if (!Number.isInteger(value) || !value || value < 1 || value > 12) {
        return DEFAULT_FISCAL_YEAR_START_MONTH;
    }

    return value;
}

function getTimeZoneParts(timestamp: number, timeZone: string): TimeZoneParts {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
        minute: "2-digit",
        month: "2-digit",
        second: "2-digit",
        timeZone,
        year: "numeric",
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const values = new Map(parts.map((part) => [part.type, part.value]));

    return {
        day: Number(values.get("day")),
        hour: Number(values.get("hour")),
        minute: Number(values.get("minute")),
        month: Number(values.get("month")),
        second: Number(values.get("second")),
        year: Number(values.get("year")),
    };
}

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

function parseWallTimeInput(value: string): ParsedWallTimeInput | null {
    const match =
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
    if (!match) {
        return null;
    }

    return {
        day: Number(match[3]),
        hour: Number(match[4]),
        minute: Number(match[5]),
        month: Number(match[2]),
        year: Number(match[1]),
    };
}

export function formatTimeZoneInputValue(
    timestamp: number | null | undefined,
    timeZone: string,
): string {
    if (typeof timestamp !== "number") {
        return "";
    }

    const parts = getTimeZoneParts(timestamp, timeZone);
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function parseTimeZoneInputValue(
    input: string,
    timeZone: string,
): number | null {
    const target = parseWallTimeInput(input);
    if (!target) {
        return null;
    }

    let timestamp = Date.UTC(
        target.year,
        target.month - 1,
        target.day,
        target.hour,
        target.minute,
        0,
        0,
    );

    for (let attempt = 0; attempt < 4; attempt += 1) {
        const actual = getTimeZoneParts(timestamp, timeZone);
        const actualUtc = Date.UTC(
            actual.year,
            actual.month - 1,
            actual.day,
            actual.hour,
            actual.minute,
            0,
            0,
        );
        const targetUtc = Date.UTC(
            target.year,
            target.month - 1,
            target.day,
            target.hour,
            target.minute,
            0,
            0,
        );
        const delta = targetUtc - actualUtc;
        if (delta === 0) {
            return timestamp;
        }

        timestamp += delta;
    }

    const finalParts = getTimeZoneParts(timestamp, timeZone);
    if (
        finalParts.year !== target.year ||
        finalParts.month !== target.month ||
        finalParts.day !== target.day ||
        finalParts.hour !== target.hour ||
        finalParts.minute !== target.minute
    ) {
        return null;
    }

    return timestamp;
}

export function formatDeadlineDateTime(
    timestamp: number | null | undefined,
    timeZone: string,
    options?: {
        includeTimeZoneName?: boolean;
    },
): string {
    if (typeof timestamp !== "number") {
        return "Not configured";
    }

    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        hour: "2-digit",
        hour12: false,
        minute: "2-digit",
        month: "short",
        timeZone,
        ...(options?.includeTimeZoneName ? { timeZoneName: "short" as const } : {}),
        year: "numeric",
    }).format(new Date(timestamp));
}

export function formatDeadlineDate(
    timestamp: number | null | undefined,
    timeZone: string,
): string {
    if (typeof timestamp !== "number") {
        return "Not configured";
    }

    return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        timeZone,
        year: "numeric",
    }).format(new Date(timestamp));
}

export function getFiscalYearForTimestampInTimeZone(args: {
    fiscalYearStartMonth?: number | null;
    timeZone: string;
    timestamp: number;
}): {
    endYear: number;
    key: string;
    label: string;
    startYear: number;
} {
    const parts = getTimeZoneParts(args.timestamp, args.timeZone);
    const fiscalYearStartMonth = normalizeFiscalYearStartMonth(
        args.fiscalYearStartMonth,
    );
    const startYear =
        parts.month >= fiscalYearStartMonth ? parts.year : parts.year - 1;
    const endYear = startYear + 1;

    return {
        endYear,
        key: `${startYear}-${endYear}`,
        label: `${startYear}/${String(endYear).slice(-2)}`,
        startYear,
    };
}

export function getCurrentFiscalYearKey(args: {
    fiscalYearStartMonth?: number | null;
    now?: number;
    timeZone: string;
}): string {
    return getFiscalYearForTimestampInTimeZone({
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.timeZone,
        timestamp: args.now ?? Date.now(),
    }).key;
}

export function normalizeReminderOffsets(
    offsets: readonly number[] | null | undefined,
): number[] {
    const supported = new Set<number>(DEADLINE_REMINDER_OFFSETS);
    return Array.from(
        new Set(
            (offsets ?? []).filter(
                (value): value is number =>
                    Number.isInteger(value) && supported.has(value),
            ),
        ),
    ).sort((left, right) => right - left);
}

export function haveReminderOffsetsChanged(args: {
    currentReminderOffsets?: readonly number[] | null;
    nextReminderOffsets?: readonly number[] | null;
}): boolean {
    const current = normalizeReminderOffsets(args.currentReminderOffsets);
    const next = normalizeReminderOffsets(args.nextReminderOffsets);

    if (current.length !== next.length) {
        return true;
    }

    return current.some((offset, index) => offset !== next[index]);
}

export function getReminderDeliveryTimestamp(args: {
    deadlineAt: number;
    offsetDays: number;
}): number {
    return args.deadlineAt - args.offsetDays * DAY_MS;
}

export function getSkippedReminderOffsets(args: {
    deadlineAt: number;
    now?: number;
    reminderOffsets: readonly number[];
}): number[] {
    const now = args.now ?? Date.now();
    return normalizeReminderOffsets(args.reminderOffsets).filter(
        (offsetDays) => getReminderDeliveryTimestamp({
            deadlineAt: args.deadlineAt,
            offsetDays,
        }) <= now,
    );
}

export function classifySubmissionDeadlineChange(args: {
    currentEndsAt?: number | null;
    currentStartsAt?: number | null;
    nextEndsAt: number;
    nextStartsAt: number;
}): SubmissionDeadlineChangeType {
    if (
        typeof args.currentStartsAt !== "number" ||
        typeof args.currentEndsAt !== "number"
    ) {
        return "initial_setup";
    }

    if (
        args.currentStartsAt === args.nextStartsAt &&
        args.currentEndsAt === args.nextEndsAt
    ) {
        return "unchanged";
    }

    if (args.nextEndsAt > args.currentEndsAt) {
        return "extension";
    }

    if (
        args.nextEndsAt < args.currentEndsAt ||
        args.nextStartsAt > args.currentStartsAt
    ) {
        return "tightened";
    }

    return "edited";
}

export function hasSubmissionDeadlineConfigChanged(args: {
    currentEndsAt?: number | null;
    currentReminderOffsets?: readonly number[] | null;
    currentStartsAt?: number | null;
    currentTimeZone?: string | null;
    nextEndsAt: number;
    nextReminderOffsets?: readonly number[] | null;
    nextStartsAt: number;
    nextTimeZone: string;
}): boolean {
    return (
        args.currentStartsAt !== args.nextStartsAt ||
        args.currentEndsAt !== args.nextEndsAt ||
        args.currentTimeZone !== args.nextTimeZone ||
        haveReminderOffsetsChanged({
            currentReminderOffsets: args.currentReminderOffsets,
            nextReminderOffsets: args.nextReminderOffsets,
        })
    );
}

export function formatDeadlineCountdown(args: {
    deadlineAt: number | null | undefined;
    now?: number;
}): string {
    if (typeof args.deadlineAt !== "number") {
        return "Not configured";
    }

    const delta = args.deadlineAt - (args.now ?? Date.now());
    if (delta <= 0) {
        return "Closed";
    }

    if (delta < HOUR_MS) {
        const minutes = Math.max(1, Math.ceil(delta / MINUTE_MS));
        return `${minutes}m left`;
    }

    if (delta < DAY_MS) {
        const hours = Math.floor(delta / HOUR_MS);
        const minutes = Math.ceil((delta % HOUR_MS) / MINUTE_MS);
        if (hours <= 0) {
            return `${Math.max(minutes, 1)}m left`;
        }

        return `${hours}h ${Math.max(minutes, 0)}m left`;
    }

    return `${Math.ceil(delta / DAY_MS)}d left`;
}

export function evaluateReminderJobDispatch(args: {
    currentDeadlineVersion?: number | null;
    reminderJobDeadlineVersion: number;
    reminderJobStatus: SubmissionDeadlineReminderJobStatus;
}): {
    allowSend: boolean;
    nextStatus: SubmissionDeadlineReminderJobStatus | null;
    reason: "inactive" | "ready" | "superseded";
    statusMessage?: string;
} {
    if (args.reminderJobStatus !== "scheduled") {
        return {
            allowSend: false,
            nextStatus: null,
            reason: "inactive",
            statusMessage: "Reminder dispatch skipped because the job is no longer active.",
        };
    }

    if (
        typeof args.currentDeadlineVersion !== "number" ||
        args.currentDeadlineVersion !== args.reminderJobDeadlineVersion
    ) {
        return {
            allowSend: false,
            nextStatus: "skipped",
            reason: "superseded",
            statusMessage:
                "Reminder dispatch skipped because a newer deadline version is already active.",
        };
    }

    return {
        allowSend: true,
        nextStatus: null,
        reason: "ready",
    };
}

export function isSubmissionDeadlineAvailable(
    record: Pick<
        SubmissionDeadlineRecordLike,
        "submissionEndsAt" | "submissionStartsAt"
    > | null | undefined,
): boolean {
    return (
        typeof record?.submissionStartsAt === "number" &&
        typeof record.submissionEndsAt === "number" &&
        record.submissionEndsAt > record.submissionStartsAt
    );
}

export function isDepartmentWindowInFiscalYear(args: {
    department: DeadlineWindowRecord;
    fiscalYearKey: string;
    fiscalYearStartMonth?: number | null;
    timeZone: string;
}): boolean {
    if (
        typeof args.department.submissionStartsAt !== "number" ||
        typeof args.department.submissionEndsAt !== "number" ||
        args.department.submissionEndsAt <= args.department.submissionStartsAt
    ) {
        return false;
    }

    const startYear = getFiscalYearForTimestampInTimeZone({
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.timeZone,
        timestamp: args.department.submissionStartsAt,
    }).key;
    const endYear = getFiscalYearForTimestampInTimeZone({
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.timeZone,
        timestamp: args.department.submissionEndsAt,
    }).key;

    return startYear === args.fiscalYearKey && endYear === args.fiscalYearKey;
}

export function buildDeadlineFiscalYearOptions(args: {
    existingFiscalYearKeys?: readonly string[];
    fiscalYearStartMonth?: number | null;
    now?: number;
    requestedFiscalYear?: string | null;
    timeZone: string;
}): string[] {
    const options = new Set<string>();

    if (typeof args.now === "number") {
        options.add(
            getCurrentFiscalYearKey({
                fiscalYearStartMonth: args.fiscalYearStartMonth,
                now: args.now,
                timeZone: args.timeZone,
            }),
        );
    }

    for (const fiscalYearKey of args.existingFiscalYearKeys ?? []) {
        if (typeof fiscalYearKey === "string" && fiscalYearKey.trim().length > 0) {
            options.add(fiscalYearKey.trim());
        }
    }

    if (
        typeof args.requestedFiscalYear === "string" &&
        args.requestedFiscalYear.trim().length > 0
    ) {
        options.add(args.requestedFiscalYear.trim());
    }

    return Array.from(options).sort((left, right) => right.localeCompare(left));
}

export function resolveSubmissionDeadline(args: {
    deadlineRecord?: SubmissionDeadlineRecordLike | null;
    departments?: readonly DeadlineWindowRecord[];
    fiscalYearKey: string;
    fiscalYearStartMonth?: number | null;
    now?: number;
    tenantTimeZone?: string | null;
}): ResolvedSubmissionDeadline {
    const recordTimeZone = resolveDeadlineTimeZone({
        deadlineTimeZone: args.deadlineRecord?.timeZone,
        tenantTimeZone: args.tenantTimeZone,
    });
    const fallbackTimeZone = resolveDeadlineTimeZone({
        tenantTimeZone: args.tenantTimeZone,
    });

    if (isSubmissionDeadlineAvailable(args.deadlineRecord)) {
        return {
            announcementIssuedAt: args.deadlineRecord?.announcementIssuedAt ?? null,
            announcementMessage: args.deadlineRecord?.announcementMessage ?? null,
            announcementTitle: args.deadlineRecord?.announcementTitle ?? null,
            countdownLabel: formatDeadlineCountdown({
                deadlineAt: args.deadlineRecord?.submissionEndsAt,
                now: args.now,
            }),
            countdownTargetAt: args.deadlineRecord?.submissionEndsAt ?? null,
            deadlineVersion: Math.max(args.deadlineRecord?.deadlineVersion ?? 1, 1),
            fiscalYearKey: args.fiscalYearKey,
            formattedDeadlineAt: formatDeadlineDateTime(
                args.deadlineRecord?.submissionEndsAt,
                recordTimeZone.timeZone,
                { includeTimeZoneName: true },
            ),
            formattedStartAt: formatDeadlineDateTime(
                args.deadlineRecord?.submissionStartsAt,
                recordTimeZone.timeZone,
                { includeTimeZoneName: true },
            ),
            reminderOffsets: normalizeReminderOffsets(
                args.deadlineRecord?.reminderOffsets,
            ),
            reason: "no_departments",
            source: "canonical",
            state: "available",
            submissionEndsAt: args.deadlineRecord?.submissionEndsAt ?? null,
            submissionStartsAt: args.deadlineRecord?.submissionStartsAt ?? null,
            timeZone: recordTimeZone.timeZone,
            timeZoneUsesFallback: recordTimeZone.usesFallback,
            updatedAt: args.deadlineRecord?.updatedAt ?? null,
        };
    }

    const activeDepartments = (args.departments ?? []).filter(
        (department) => department.isActive,
    );
    if (activeDepartments.length === 0) {
        return {
            announcementIssuedAt: null,
            announcementMessage: null,
            announcementTitle: null,
            countdownLabel: "Not configured",
            countdownTargetAt: null,
            deadlineVersion: 0,
            fiscalYearKey: args.fiscalYearKey,
            formattedDeadlineAt: "Not configured",
            formattedStartAt: "Not configured",
            reminderOffsets: [],
            reason: "no_departments",
            source: "none",
            state: "setup_required",
            submissionEndsAt: null,
            submissionStartsAt: null,
            timeZone: fallbackTimeZone.timeZone,
            timeZoneUsesFallback: fallbackTimeZone.usesFallback,
            updatedAt: null,
        };
    }

    const inScopeDepartments = activeDepartments.filter((department) =>
        isDepartmentWindowInFiscalYear({
            department,
            fiscalYearKey: args.fiscalYearKey,
            fiscalYearStartMonth: args.fiscalYearStartMonth,
            timeZone: fallbackTimeZone.timeZone,
        }),
    );
    const fallbackDepartments =
        inScopeDepartments.length > 0 ? inScopeDepartments : activeDepartments;

    if (
        fallbackDepartments.some(
            (department) =>
                typeof department.submissionStartsAt !== "number" ||
                typeof department.submissionEndsAt !== "number",
        )
    ) {
        return {
            announcementIssuedAt: null,
            announcementMessage: null,
            announcementTitle: null,
            countdownLabel: "Not configured",
            countdownTargetAt: null,
            deadlineVersion: 0,
            fiscalYearKey: args.fiscalYearKey,
            formattedDeadlineAt: "Not configured",
            formattedStartAt: "Not configured",
            reminderOffsets: [],
            reason: "missing_window",
            source: "none",
            state: "setup_required",
            submissionEndsAt: null,
            submissionStartsAt: null,
            timeZone: fallbackTimeZone.timeZone,
            timeZoneUsesFallback: fallbackTimeZone.usesFallback,
            updatedAt: null,
        };
    }

    const starts = new Set(
        fallbackDepartments.map((department) => department.submissionStartsAt as number),
    );
    const ends = new Set(
        fallbackDepartments.map((department) => department.submissionEndsAt as number),
    );

    if (starts.size !== 1 || ends.size !== 1) {
        return {
            announcementIssuedAt: null,
            announcementMessage: null,
            announcementTitle: null,
            countdownLabel: "Not configured",
            countdownTargetAt: null,
            deadlineVersion: 0,
            fiscalYearKey: args.fiscalYearKey,
            formattedDeadlineAt: "Not configured",
            formattedStartAt: "Not configured",
            reminderOffsets: [],
            reason: "inconsistent_windows",
            source: "none",
            state: "setup_required",
            submissionEndsAt: null,
            submissionStartsAt: null,
            timeZone: fallbackTimeZone.timeZone,
            timeZoneUsesFallback: fallbackTimeZone.usesFallback,
            updatedAt: null,
        };
    }

    const submissionStartsAt = Array.from(starts)[0] ?? null;
    const submissionEndsAt = Array.from(ends)[0] ?? null;
    if (
        typeof submissionStartsAt !== "number" ||
        typeof submissionEndsAt !== "number" ||
        submissionEndsAt <= submissionStartsAt
    ) {
        return {
            announcementIssuedAt: null,
            announcementMessage: null,
            announcementTitle: null,
            countdownLabel: "Not configured",
            countdownTargetAt: null,
            deadlineVersion: 0,
            fiscalYearKey: args.fiscalYearKey,
            formattedDeadlineAt: "Not configured",
            formattedStartAt: "Not configured",
            reminderOffsets: [],
            reason: "invalid_window",
            source: "none",
            state: "setup_required",
            submissionEndsAt: null,
            submissionStartsAt: null,
            timeZone: fallbackTimeZone.timeZone,
            timeZoneUsesFallback: fallbackTimeZone.usesFallback,
            updatedAt: null,
        };
    }

    return {
        announcementIssuedAt: null,
        announcementMessage: null,
        announcementTitle: null,
        countdownLabel: formatDeadlineCountdown({
            deadlineAt: submissionEndsAt,
            now: args.now,
        }),
        countdownTargetAt: submissionEndsAt,
        deadlineVersion: 0,
        fiscalYearKey: args.fiscalYearKey,
        formattedDeadlineAt: formatDeadlineDateTime(
            submissionEndsAt,
            fallbackTimeZone.timeZone,
            { includeTimeZoneName: true },
        ),
        formattedStartAt: formatDeadlineDateTime(
            submissionStartsAt,
            fallbackTimeZone.timeZone,
            { includeTimeZoneName: true },
        ),
        reminderOffsets: [],
        reason: "no_departments",
        source: "department_fallback",
        state: "available",
        submissionEndsAt,
        submissionStartsAt,
        timeZone: fallbackTimeZone.timeZone,
        timeZoneUsesFallback: fallbackTimeZone.usesFallback,
        updatedAt: null,
    };
}
