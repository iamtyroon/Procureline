"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSubmissionDeadline = exports.buildDeadlineFiscalYearOptions = exports.isDepartmentWindowInFiscalYear = exports.isSubmissionDeadlineAvailable = exports.evaluateReminderJobDispatch = exports.formatDeadlineCountdown = exports.hasSubmissionDeadlineConfigChanged = exports.classifySubmissionDeadlineChange = exports.getSkippedReminderOffsets = exports.getReminderDeliveryTimestamp = exports.haveReminderOffsetsChanged = exports.normalizeReminderOffsets = exports.getCurrentFiscalYearKey = exports.getFiscalYearForTimestampInTimeZone = exports.formatDeadlineDate = exports.formatDeadlineDateTime = exports.parseTimeZoneInputValue = exports.formatTimeZoneInputValue = exports.normalizeFiscalYearStartMonth = exports.resolveDeadlineTimeZone = exports.DEADLINE_TIGHTEN_CONFIRMATION_MESSAGE = exports.DEADLINE_NO_DEPARTMENTS_MESSAGE = exports.DEADLINE_ORDER_MESSAGE = exports.DEADLINE_IN_PAST_MESSAGE = exports.DEADLINE_REMINDER_OFFSETS = exports.DEFAULT_FISCAL_YEAR_START_MONTH = exports.DEFAULT_DEADLINE_TIME_ZONE = void 0;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
exports.DEFAULT_DEADLINE_TIME_ZONE = "Africa/Nairobi";
exports.DEFAULT_FISCAL_YEAR_START_MONTH = 7;
exports.DEADLINE_REMINDER_OFFSETS = [7, 3, 1];
exports.DEADLINE_IN_PAST_MESSAGE = "Deadline cannot be in the past";
exports.DEADLINE_ORDER_MESSAGE = "Submission deadline must be after the submission start.";
exports.DEADLINE_NO_DEPARTMENTS_MESSAGE = "Create at least one active department before configuring a submission deadline.";
exports.DEADLINE_TIGHTEN_CONFIRMATION_MESSAGE = "Confirm this change before shortening or tightening the shared submission window.";
function isValidTimeZone(timeZone) {
    if (!timeZone || typeof timeZone !== "string") {
        return false;
    }
    try {
        new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
        return true;
    }
    catch {
        return false;
    }
}
function resolveDeadlineTimeZone(args) {
    if (isValidTimeZone(args?.deadlineTimeZone)) {
        return {
            timeZone: args?.deadlineTimeZone,
            usesFallback: false,
        };
    }
    if (isValidTimeZone(args?.tenantTimeZone)) {
        return {
            timeZone: args?.tenantTimeZone,
            usesFallback: false,
        };
    }
    return {
        timeZone: exports.DEFAULT_DEADLINE_TIME_ZONE,
        usesFallback: true,
    };
}
exports.resolveDeadlineTimeZone = resolveDeadlineTimeZone;
function normalizeFiscalYearStartMonth(value) {
    if (!Number.isInteger(value) || !value || value < 1 || value > 12) {
        return exports.DEFAULT_FISCAL_YEAR_START_MONTH;
    }
    return value;
}
exports.normalizeFiscalYearStartMonth = normalizeFiscalYearStartMonth;
function getTimeZoneParts(timestamp, timeZone) {
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
function pad(value) {
    return String(value).padStart(2, "0");
}
function parseWallTimeInput(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
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
function formatTimeZoneInputValue(timestamp, timeZone) {
    if (typeof timestamp !== "number") {
        return "";
    }
    const parts = getTimeZoneParts(timestamp, timeZone);
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
exports.formatTimeZoneInputValue = formatTimeZoneInputValue;
function parseTimeZoneInputValue(input, timeZone) {
    const target = parseWallTimeInput(input);
    if (!target) {
        return null;
    }
    let timestamp = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, 0, 0);
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const actual = getTimeZoneParts(timestamp, timeZone);
        const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0, 0);
        const targetUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, 0, 0);
        const delta = targetUtc - actualUtc;
        if (delta === 0) {
            return timestamp;
        }
        timestamp += delta;
    }
    const finalParts = getTimeZoneParts(timestamp, timeZone);
    if (finalParts.year !== target.year ||
        finalParts.month !== target.month ||
        finalParts.day !== target.day ||
        finalParts.hour !== target.hour ||
        finalParts.minute !== target.minute) {
        return null;
    }
    return timestamp;
}
exports.parseTimeZoneInputValue = parseTimeZoneInputValue;
function formatDeadlineDateTime(timestamp, timeZone, options) {
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
        ...(options?.includeTimeZoneName ? { timeZoneName: "short" } : {}),
        year: "numeric",
    }).format(new Date(timestamp));
}
exports.formatDeadlineDateTime = formatDeadlineDateTime;
function formatDeadlineDate(timestamp, timeZone) {
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
exports.formatDeadlineDate = formatDeadlineDate;
function getFiscalYearForTimestampInTimeZone(args) {
    const parts = getTimeZoneParts(args.timestamp, args.timeZone);
    const fiscalYearStartMonth = normalizeFiscalYearStartMonth(args.fiscalYearStartMonth);
    const startYear = parts.month >= fiscalYearStartMonth ? parts.year : parts.year - 1;
    const endYear = startYear + 1;
    return {
        endYear,
        key: `${startYear}-${endYear}`,
        label: `${startYear}/${String(endYear).slice(-2)}`,
        startYear,
    };
}
exports.getFiscalYearForTimestampInTimeZone = getFiscalYearForTimestampInTimeZone;
function getCurrentFiscalYearKey(args) {
    return getFiscalYearForTimestampInTimeZone({
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: args.timeZone,
        timestamp: args.now ?? Date.now(),
    }).key;
}
exports.getCurrentFiscalYearKey = getCurrentFiscalYearKey;
function normalizeReminderOffsets(offsets) {
    const supported = new Set(exports.DEADLINE_REMINDER_OFFSETS);
    return Array.from(new Set((offsets ?? []).filter((value) => Number.isInteger(value) && supported.has(value)))).sort((left, right) => right - left);
}
exports.normalizeReminderOffsets = normalizeReminderOffsets;
function haveReminderOffsetsChanged(args) {
    const current = normalizeReminderOffsets(args.currentReminderOffsets);
    const next = normalizeReminderOffsets(args.nextReminderOffsets);
    if (current.length !== next.length) {
        return true;
    }
    return current.some((offset, index) => offset !== next[index]);
}
exports.haveReminderOffsetsChanged = haveReminderOffsetsChanged;
function getReminderDeliveryTimestamp(args) {
    return args.deadlineAt - args.offsetDays * DAY_MS;
}
exports.getReminderDeliveryTimestamp = getReminderDeliveryTimestamp;
function getSkippedReminderOffsets(args) {
    const now = args.now ?? Date.now();
    return normalizeReminderOffsets(args.reminderOffsets).filter((offsetDays) => getReminderDeliveryTimestamp({
        deadlineAt: args.deadlineAt,
        offsetDays,
    }) <= now);
}
exports.getSkippedReminderOffsets = getSkippedReminderOffsets;
function classifySubmissionDeadlineChange(args) {
    if (typeof args.currentStartsAt !== "number" ||
        typeof args.currentEndsAt !== "number") {
        return "initial_setup";
    }
    if (args.currentStartsAt === args.nextStartsAt &&
        args.currentEndsAt === args.nextEndsAt) {
        return "unchanged";
    }
    if (args.nextEndsAt > args.currentEndsAt) {
        return "extension";
    }
    if (args.nextEndsAt < args.currentEndsAt ||
        args.nextStartsAt > args.currentStartsAt) {
        return "tightened";
    }
    return "edited";
}
exports.classifySubmissionDeadlineChange = classifySubmissionDeadlineChange;
function hasSubmissionDeadlineConfigChanged(args) {
    return (args.currentStartsAt !== args.nextStartsAt ||
        args.currentEndsAt !== args.nextEndsAt ||
        args.currentTimeZone !== args.nextTimeZone ||
        haveReminderOffsetsChanged({
            currentReminderOffsets: args.currentReminderOffsets,
            nextReminderOffsets: args.nextReminderOffsets,
        }));
}
exports.hasSubmissionDeadlineConfigChanged = hasSubmissionDeadlineConfigChanged;
function formatDeadlineCountdown(args) {
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
exports.formatDeadlineCountdown = formatDeadlineCountdown;
function evaluateReminderJobDispatch(args) {
    if (args.reminderJobStatus !== "scheduled") {
        return {
            allowSend: false,
            nextStatus: null,
            reason: "inactive",
            statusMessage: "Reminder dispatch skipped because the job is no longer active.",
        };
    }
    if (typeof args.currentDeadlineVersion !== "number" ||
        args.currentDeadlineVersion !== args.reminderJobDeadlineVersion) {
        return {
            allowSend: false,
            nextStatus: "skipped",
            reason: "superseded",
            statusMessage: "Reminder dispatch skipped because a newer deadline version is already active.",
        };
    }
    return {
        allowSend: true,
        nextStatus: null,
        reason: "ready",
    };
}
exports.evaluateReminderJobDispatch = evaluateReminderJobDispatch;
function isSubmissionDeadlineAvailable(record) {
    return (typeof record?.submissionStartsAt === "number" &&
        typeof record.submissionEndsAt === "number" &&
        record.submissionEndsAt > record.submissionStartsAt);
}
exports.isSubmissionDeadlineAvailable = isSubmissionDeadlineAvailable;
function isDepartmentWindowInFiscalYear(args) {
    if (typeof args.department.submissionStartsAt !== "number" ||
        typeof args.department.submissionEndsAt !== "number" ||
        args.department.submissionEndsAt <= args.department.submissionStartsAt) {
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
exports.isDepartmentWindowInFiscalYear = isDepartmentWindowInFiscalYear;
function buildDeadlineFiscalYearOptions(args) {
    const options = new Set();
    if (typeof args.now === "number") {
        options.add(getCurrentFiscalYearKey({
            fiscalYearStartMonth: args.fiscalYearStartMonth,
            now: args.now,
            timeZone: args.timeZone,
        }));
    }
    for (const fiscalYearKey of args.existingFiscalYearKeys ?? []) {
        if (typeof fiscalYearKey === "string" && fiscalYearKey.trim().length > 0) {
            options.add(fiscalYearKey.trim());
        }
    }
    if (typeof args.requestedFiscalYear === "string" &&
        args.requestedFiscalYear.trim().length > 0) {
        options.add(args.requestedFiscalYear.trim());
    }
    return Array.from(options).sort((left, right) => right.localeCompare(left));
}
exports.buildDeadlineFiscalYearOptions = buildDeadlineFiscalYearOptions;
function resolveSubmissionDeadline(args) {
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
            formattedDeadlineAt: formatDeadlineDateTime(args.deadlineRecord?.submissionEndsAt, recordTimeZone.timeZone, { includeTimeZoneName: true }),
            formattedStartAt: formatDeadlineDateTime(args.deadlineRecord?.submissionStartsAt, recordTimeZone.timeZone, { includeTimeZoneName: true }),
            reminderOffsets: normalizeReminderOffsets(args.deadlineRecord?.reminderOffsets),
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
    const activeDepartments = (args.departments ?? []).filter((department) => department.isActive);
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
    const inScopeDepartments = activeDepartments.filter((department) => isDepartmentWindowInFiscalYear({
        department,
        fiscalYearKey: args.fiscalYearKey,
        fiscalYearStartMonth: args.fiscalYearStartMonth,
        timeZone: fallbackTimeZone.timeZone,
    }));
    const fallbackDepartments = inScopeDepartments.length > 0 ? inScopeDepartments : activeDepartments;
    if (fallbackDepartments.some((department) => typeof department.submissionStartsAt !== "number" ||
        typeof department.submissionEndsAt !== "number")) {
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
    const starts = new Set(fallbackDepartments.map((department) => department.submissionStartsAt));
    const ends = new Set(fallbackDepartments.map((department) => department.submissionEndsAt));
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
    if (typeof submissionStartsAt !== "number" ||
        typeof submissionEndsAt !== "number" ||
        submissionEndsAt <= submissionStartsAt) {
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
        formattedDeadlineAt: formatDeadlineDateTime(submissionEndsAt, fallbackTimeZone.timeZone, { includeTimeZoneName: true }),
        formattedStartAt: formatDeadlineDateTime(submissionStartsAt, fallbackTimeZone.timeZone, { includeTimeZoneName: true }),
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
exports.resolveSubmissionDeadline = resolveSubmissionDeadline;
