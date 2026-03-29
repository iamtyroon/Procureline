"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerDeadlineTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const deadlines_1 = require("../lib/procurement-officer/deadlines");
function runProcurementOfficerDeadlineTests() {
    const completedTests = [];
    const roundTripTimestamp = (0, deadlines_1.parseTimeZoneInputValue)("2026-08-20T15:30", "Africa/Nairobi");
    strict_1.default.equal(typeof roundTripTimestamp, "number");
    strict_1.default.equal((0, deadlines_1.formatTimeZoneInputValue)(roundTripTimestamp, "Africa/Nairobi"), "2026-08-20T15:30");
    completedTests.push("deadline timezone helpers round-trip wall-clock values without falling back to browser-local parsing");
    strict_1.default.deepEqual((0, deadlines_1.buildDeadlineFiscalYearOptions)({
        existingFiscalYearKeys: ["2024-2025"],
        now: Date.UTC(2026, 2, 27, 12, 0, 0),
        requestedFiscalYear: "2026-2027",
        timeZone: "Africa/Nairobi",
    }), ["2026-2027", "2025-2026", "2024-2025"]);
    completedTests.push("deadline fiscal-year options bootstrap from the current tenant year plus any canonical records and requested year");
    strict_1.default.equal((0, deadlines_1.classifySubmissionDeadlineChange)({
        currentEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        currentStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        nextEndsAt: Date.UTC(2026, 7, 25, 12, 0, 0),
        nextStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
    }), "extension");
    strict_1.default.equal((0, deadlines_1.classifySubmissionDeadlineChange)({
        currentEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        currentStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        nextEndsAt: Date.UTC(2026, 7, 18, 12, 0, 0),
        nextStartsAt: Date.UTC(2026, 7, 2, 12, 0, 0),
    }), "tightened");
    completedTests.push("deadline change classification distinguishes safe extensions from guarded tightening edits");
    strict_1.default.deepEqual((0, deadlines_1.getSkippedReminderOffsets)({
        deadlineAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        now: Date.UTC(2026, 7, 19, 12, 0, 0),
        reminderOffsets: [7, 3, 1],
    }), [7, 3, 1]);
    strict_1.default.deepEqual((0, deadlines_1.getSkippedReminderOffsets)({
        deadlineAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        now: Date.UTC(2026, 7, 16, 12, 0, 0),
        reminderOffsets: [7, 3, 1],
    }), [7]);
    completedTests.push("deadline reminder offset helpers skip elapsed reminder windows deterministically instead of queueing surprise catch-up mail");
    strict_1.default.equal((0, deadlines_1.hasSubmissionDeadlineConfigChanged)({
        currentEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        currentReminderOffsets: [7, 3, 1],
        currentStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        currentTimeZone: "Africa/Nairobi",
        nextEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        nextReminderOffsets: [7, 3, 1],
        nextStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        nextTimeZone: "Africa/Nairobi",
    }), false);
    strict_1.default.equal((0, deadlines_1.hasSubmissionDeadlineConfigChanged)({
        currentEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        currentReminderOffsets: [7, 3, 1],
        currentStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        currentTimeZone: "Africa/Nairobi",
        nextEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
        nextReminderOffsets: [7, 1],
        nextStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
        nextTimeZone: "Africa/Nairobi",
    }), true);
    strict_1.default.deepEqual((0, deadlines_1.evaluateReminderJobDispatch)({
        currentDeadlineVersion: 3,
        reminderJobDeadlineVersion: 2,
        reminderJobStatus: "scheduled",
    }), {
        allowSend: false,
        nextStatus: "skipped",
        reason: "superseded",
        statusMessage: "Reminder dispatch skipped because a newer deadline version is already active.",
    });
    completedTests.push("deadline config equality detects true no-op saves and reminder dispatch checks suppress superseded jobs before a stale email can send");
    const canonicalDeadline = (0, deadlines_1.resolveSubmissionDeadline)({
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
    strict_1.default.equal(canonicalDeadline.source, "canonical");
    strict_1.default.equal(canonicalDeadline.state, "available");
    strict_1.default.equal(canonicalDeadline.timeZone, "Africa/Nairobi");
    const fallbackDeadline = (0, deadlines_1.resolveSubmissionDeadline)({
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
    strict_1.default.equal(fallbackDeadline.source, "department_fallback");
    strict_1.default.equal(fallbackDeadline.state, "available");
    completedTests.push("deadline resolution prefers canonical per-fiscal-year settings but can still fall back to an already-safe shared department window during transition data");
    return completedTests;
}
exports.runProcurementOfficerDeadlineTests = runProcurementOfficerDeadlineTests;
