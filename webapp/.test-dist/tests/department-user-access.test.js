"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserAccessTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const department_user_access_1 = require("../lib/auth/department-user-access");
const input_1 = require("../lib/security/input");
const NOW = new Date("2026-03-13T10:00:00.000Z").getTime();
async function runDepartmentUserAccessTests() {
    const completedTests = [];
    strict_1.default.equal((0, department_user_access_1.normalizeDepartmentUserAccessCode)(" 2026 cs  x7k9 "), "2026-CS-X7K9");
    strict_1.default.equal((0, department_user_access_1.normalizeDepartmentUserAccessCode)("2026__cs---x7k9"), "2026-CS-X7K9");
    completedTests.push("department access codes normalize to a stable uppercase comparison format");
    const hashA = await (0, department_user_access_1.hashDepartmentUserAccessCode)((0, department_user_access_1.normalizeDepartmentUserAccessCode)("2026 cs x7k9"));
    const hashB = await (0, department_user_access_1.hashDepartmentUserAccessCode)((0, department_user_access_1.normalizeDepartmentUserAccessCode)("2026-CS-X7K9"));
    strict_1.default.equal(hashA, hashB);
    completedTests.push("department access code hashing is deterministic across equivalent user input variants");
    strict_1.default.deepEqual((0, department_user_access_1.evaluateDepartmentUserSubmissionWindow)({
        now: NOW - 60_000,
        submissionEndsAt: NOW + 3_600_000,
        submissionStartsAt: NOW,
    }), {
        accessMode: null,
        state: "not_started",
    });
    strict_1.default.deepEqual((0, department_user_access_1.evaluateDepartmentUserSubmissionWindow)({
        now: NOW,
        submissionEndsAt: NOW + 3_600_000,
        submissionStartsAt: NOW - 60_000,
    }), {
        accessMode: "editable",
        state: "editable",
    });
    strict_1.default.deepEqual((0, department_user_access_1.evaluateDepartmentUserSubmissionWindow)({
        now: NOW,
        submissionEndsAt: NOW - 60_000,
        submissionStartsAt: NOW - 3_600_000,
    }), {
        accessMode: "read_only_grace",
        state: "read_only_grace",
    });
    strict_1.default.deepEqual((0, department_user_access_1.evaluateDepartmentUserSubmissionWindow)({
        now: NOW,
        submissionEndsAt: NOW - (31 * 60 * 1000),
        submissionStartsAt: NOW - 3_600_000,
    }), {
        accessMode: null,
        state: "ended",
    });
    completedTests.push("department submission windows distinguish pre-start, editable, grace, and ended states");
    strict_1.default.equal((0, department_user_access_1.getDepartmentUserSubmissionWindowMessage)({
        now: NOW,
        submissionEndsAt: NOW - 60_000,
        submissionStartsAt: NOW - 3_600_000,
    }), department_user_access_1.DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE);
    strict_1.default.equal((0, department_user_access_1.getDepartmentUserSubmissionWindowMessage)({
        now: NOW,
        submissionEndsAt: NOW - (31 * 60 * 1000),
        submissionStartsAt: NOW - 3_600_000,
    }), department_user_access_1.DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE);
    completedTests.push("department submission messaging keeps the exact ended copy for both grace-window and fully-ended states");
    const lockoutState = (0, department_user_access_1.getDepartmentUserLockoutState)({
        failedAttempts: 5,
        lockedUntil: NOW + 65_000,
        now: NOW,
    });
    strict_1.default.equal(lockoutState.isLockedOut, true);
    strict_1.default.equal((0, department_user_access_1.formatDepartmentUserLockoutMessage)(lockoutState.remainingMs), "Too many failed attempts. Try again in 1m 5s.");
    completedTests.push("department-user lockouts stay scoped to the current email-code pair and surface a human-readable remaining duration");
    const tooLongAccessCode = "A".repeat(department_user_access_1.DEPARTMENT_USER_ACCESS_CODE_MAX_LENGTH + 1);
    const accessCodeValidation = (0, input_1.validateDepartmentUserAccessCodeInput)(tooLongAccessCode);
    if (accessCodeValidation.ok) {
        strict_1.default.fail("expected too-long access code validation to fail");
    }
    strict_1.default.equal(accessCodeValidation.issue.message, "Access code must be less than 65 characters");
    completedTests.push("department-user access-code validation enforces the shared maximum length guard");
    strict_1.default.equal((0, department_user_access_1.isDepartmentUserOtpProviderFailureMessage)("Could not verify code"), true);
    strict_1.default.equal((0, department_user_access_1.isDepartmentUserOtpProviderFailureMessage)("Invalid code"), true);
    strict_1.default.equal((0, department_user_access_1.isDepartmentUserOtpProviderFailureMessage)(department_user_access_1.DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE), false);
    completedTests.push("department-user OTP provider failures are classified separately from generic backend mail errors");
    strict_1.default.equal((0, department_user_access_1.scrubDepartmentUserAccessCodeFromUrl)("/access/department-user", "?accessCode=2026-CS-X7K9&role=department_user"), "/access/department-user?role=department_user");
    strict_1.default.equal((0, department_user_access_1.scrubDepartmentUserAccessCodeFromUrl)("/access/department-user", "?accessCode=2026-CS-X7K9"), "/access/department-user");
    completedTests.push("department-user access-code prefills can be scrubbed from the browser URL without losing the stable route");
    return completedTests;
}
exports.runDepartmentUserAccessTests = runDepartmentUserAccessTests;
