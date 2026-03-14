import assert from "node:assert/strict";
import {
    DEPARTMENT_USER_ACCESS_CODE_MAX_LENGTH,
    DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE,
    DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE,
    evaluateDepartmentUserSubmissionWindow,
    formatDepartmentUserLockoutMessage,
    getDepartmentUserLockoutState,
    getDepartmentUserSubmissionWindowMessage,
    hashDepartmentUserAccessCode,
    isDepartmentUserOtpProviderFailureMessage,
    normalizeDepartmentUserAccessCode,
    scrubDepartmentUserAccessCodeFromUrl,
} from "../lib/auth/department-user-access";
import { validateDepartmentUserAccessCodeInput } from "../lib/security/input";

const NOW = new Date("2026-03-13T10:00:00.000Z").getTime();

export async function runDepartmentUserAccessTests(): Promise<string[]> {
    const completedTests: string[] = [];

    assert.equal(
        normalizeDepartmentUserAccessCode(" 2026 cs  x7k9 "),
        "2026-CS-X7K9",
    );
    assert.equal(
        normalizeDepartmentUserAccessCode("2026__cs---x7k9"),
        "2026-CS-X7K9",
    );
    completedTests.push(
        "department access codes normalize to a stable uppercase comparison format",
    );

    const hashA = await hashDepartmentUserAccessCode(
        normalizeDepartmentUserAccessCode("2026 cs x7k9"),
    );
    const hashB = await hashDepartmentUserAccessCode(
        normalizeDepartmentUserAccessCode("2026-CS-X7K9"),
    );
    assert.equal(hashA, hashB);
    completedTests.push(
        "department access code hashing is deterministic across equivalent user input variants",
    );

    assert.deepEqual(
        evaluateDepartmentUserSubmissionWindow({
            now: NOW - 60_000,
            submissionEndsAt: NOW + 3_600_000,
            submissionStartsAt: NOW,
        }),
        {
            accessMode: null,
            state: "not_started",
        },
    );
    assert.deepEqual(
        evaluateDepartmentUserSubmissionWindow({
            now: NOW,
            submissionEndsAt: NOW + 3_600_000,
            submissionStartsAt: NOW - 60_000,
        }),
        {
            accessMode: "editable",
            state: "editable",
        },
    );
    assert.deepEqual(
        evaluateDepartmentUserSubmissionWindow({
            now: NOW,
            submissionEndsAt: NOW - 60_000,
            submissionStartsAt: NOW - 3_600_000,
        }),
        {
            accessMode: "read_only_grace",
            state: "read_only_grace",
        },
    );
    assert.deepEqual(
        evaluateDepartmentUserSubmissionWindow({
            now: NOW,
            submissionEndsAt: NOW - (31 * 60 * 1000),
            submissionStartsAt: NOW - 3_600_000,
        }),
        {
            accessMode: null,
            state: "ended",
        },
    );
    completedTests.push(
        "department submission windows distinguish pre-start, editable, grace, and ended states",
    );

    assert.equal(
        getDepartmentUserSubmissionWindowMessage({
            now: NOW,
            submissionEndsAt: NOW - 60_000,
            submissionStartsAt: NOW - 3_600_000,
        }),
        DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE,
    );
    assert.equal(
        getDepartmentUserSubmissionWindowMessage({
            now: NOW,
            submissionEndsAt: NOW - (31 * 60 * 1000),
            submissionStartsAt: NOW - 3_600_000,
        }),
        DEPARTMENT_USER_SUBMISSION_ENDED_MESSAGE,
    );
    completedTests.push(
        "department submission messaging keeps the exact ended copy for both grace-window and fully-ended states",
    );

    const lockoutState = getDepartmentUserLockoutState({
        failedAttempts: 5,
        lockedUntil: NOW + 65_000,
        now: NOW,
    });
    assert.equal(lockoutState.isLockedOut, true);
    assert.equal(formatDepartmentUserLockoutMessage(lockoutState.remainingMs), "Too many failed attempts. Try again in 1m 5s.");
    completedTests.push(
        "department-user lockouts stay scoped to the current email-code pair and surface a human-readable remaining duration",
    );

    const tooLongAccessCode = "A".repeat(
        DEPARTMENT_USER_ACCESS_CODE_MAX_LENGTH + 1,
    );
    const accessCodeValidation = validateDepartmentUserAccessCodeInput(
        tooLongAccessCode,
    );
    if (accessCodeValidation.ok) {
        assert.fail("expected too-long access code validation to fail");
    }
    assert.equal(
        accessCodeValidation.issue.message,
        "Access code must be less than 65 characters",
    );
    completedTests.push(
        "department-user access-code validation enforces the shared maximum length guard",
    );

    assert.equal(
        isDepartmentUserOtpProviderFailureMessage("Could not verify code"),
        true,
    );
    assert.equal(
        isDepartmentUserOtpProviderFailureMessage("Invalid code"),
        true,
    );
    assert.equal(
        isDepartmentUserOtpProviderFailureMessage(
            DEPARTMENT_USER_INVALID_VERIFICATION_CODE_MESSAGE,
        ),
        false,
    );
    completedTests.push(
        "department-user OTP provider failures are classified separately from generic backend mail errors",
    );

    assert.equal(
        scrubDepartmentUserAccessCodeFromUrl(
            "/access/department-user",
            "?accessCode=2026-CS-X7K9&role=department_user",
        ),
        "/access/department-user?role=department_user",
    );
    assert.equal(
        scrubDepartmentUserAccessCodeFromUrl(
            "/access/department-user",
            "?accessCode=2026-CS-X7K9",
        ),
        "/access/department-user",
    );
    completedTests.push(
        "department-user access-code prefills can be scrubbed from the browser URL without losing the stable route",
    );

    return completedTests;
}
