import assert from "node:assert/strict";
import {
    buildDeadlineFiscalYearOptions,
    classifySubmissionDeadlineChange,
    evaluateReminderJobDispatch,
    formatTimeZoneInputValue,
    getSkippedReminderOffsets,
    hasSubmissionDeadlineConfigChanged,
    parseTimeZoneInputValue,
    resolveSubmissionDeadline,
} from "../lib/procurement-officer/deadlines";

export function runProcurementOfficerDeadlineTests(): string[] {
    const completedTests: string[] = [];

    const roundTripTimestamp = parseTimeZoneInputValue(
        "2026-08-20T15:30",
        "Africa/Nairobi",
    );
    assert.equal(typeof roundTripTimestamp, "number");
    assert.equal(
        formatTimeZoneInputValue(roundTripTimestamp as number, "Africa/Nairobi"),
        "2026-08-20T15:30",
    );
    completedTests.push(
        "deadline timezone helpers round-trip wall-clock values without falling back to browser-local parsing",
    );

    assert.deepEqual(
        buildDeadlineFiscalYearOptions({
            existingFiscalYearKeys: ["2024-2025"],
            now: Date.UTC(2026, 2, 27, 12, 0, 0),
            requestedFiscalYear: "2026-2027",
            timeZone: "Africa/Nairobi",
        }),
        ["2026-2027", "2025-2026", "2024-2025"],
    );
    completedTests.push(
        "deadline fiscal-year options bootstrap from the current tenant year plus any canonical records and requested year",
    );

    assert.equal(
        classifySubmissionDeadlineChange({
            currentEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            currentStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            nextEndsAt: Date.UTC(2026, 7, 25, 12, 0, 0),
            nextStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        }),
        "extension",
    );
    assert.equal(
        classifySubmissionDeadlineChange({
            currentEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            currentStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            nextEndsAt: Date.UTC(2026, 7, 18, 12, 0, 0),
            nextStartsAt: Date.UTC(2026, 7, 2, 12, 0, 0),
        }),
        "tightened",
    );
    completedTests.push(
        "deadline change classification distinguishes safe extensions from guarded tightening edits",
    );

    assert.deepEqual(
        getSkippedReminderOffsets({
            deadlineAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            now: Date.UTC(2026, 7, 19, 12, 0, 0),
            reminderOffsets: [7, 3, 1],
        }),
        [7, 3, 1],
    );
    assert.deepEqual(
        getSkippedReminderOffsets({
            deadlineAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            now: Date.UTC(2026, 7, 16, 12, 0, 0),
            reminderOffsets: [7, 3, 1],
        }),
        [7],
    );
    completedTests.push(
        "deadline reminder offset helpers skip elapsed reminder windows deterministically instead of queueing surprise catch-up mail",
    );

    assert.equal(
        hasSubmissionDeadlineConfigChanged({
            currentEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            currentReminderOffsets: [7, 3, 1],
            currentStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            currentTimeZone: "Africa/Nairobi",
            nextEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            nextReminderOffsets: [7, 3, 1],
            nextStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            nextTimeZone: "Africa/Nairobi",
        }),
        false,
    );
    assert.equal(
        hasSubmissionDeadlineConfigChanged({
            currentEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            currentReminderOffsets: [7, 3, 1],
            currentStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            currentTimeZone: "Africa/Nairobi",
            nextEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            nextReminderOffsets: [7, 1],
            nextStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            nextTimeZone: "Africa/Nairobi",
        }),
        true,
    );
    assert.deepEqual(
        evaluateReminderJobDispatch({
            currentDeadlineVersion: 3,
            reminderJobDeadlineVersion: 2,
            reminderJobStatus: "scheduled",
        }),
        {
            allowSend: false,
            nextStatus: "skipped",
            reason: "superseded",
            statusMessage:
                "Reminder dispatch skipped because a newer deadline version is already active.",
        },
    );
    completedTests.push(
        "deadline config equality detects true no-op saves and reminder dispatch checks suppress superseded jobs before a stale email can send",
    );

    const canonicalDeadline = resolveSubmissionDeadline({
        deadlineRecord: {
            deadlineVersion: 2,
            fiscalYearKey: "2026-2027",
            reminderOffsets: [7, 3, 1],
            submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
            submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            timeZone: "Africa/Nairobi",
        },
        departments: [],
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        tenantTimeZone: "Africa/Nairobi",
    });
    assert.equal(canonicalDeadline.source, "canonical");
    assert.equal(canonicalDeadline.state, "available");
    assert.equal(canonicalDeadline.timeZone, "Africa/Nairobi");

    const fallbackDeadline = resolveSubmissionDeadline({
        departments: [
            {
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            },
            {
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            },
        ],
        fiscalYearKey: "2026-2027",
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        tenantTimeZone: "Africa/Nairobi",
    });
    assert.equal(fallbackDeadline.source, "department_fallback");
    assert.equal(fallbackDeadline.state, "available");
    completedTests.push(
        "deadline resolution prefers canonical per-fiscal-year settings but can still fall back to an already-safe shared department window during transition data",
    );

    return completedTests;
}
