"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot = exports.buildPlanSubmissionPersistenceRecord = exports.buildPlanSubmissionEmailIdempotencyKey = exports.selectPreviousActivePlanSubmissionSnapshot = exports.resolveLatestActivePlanSubmissionSnapshot = exports.buildPlanSubmissionSequenceKey = exports.getNextPlanSubmissionSequence = exports.formatPlanSubmissionReference = exports.compactFiscalYearForSubmissionReference = exports.normalizePlanSubmissionLifecycleStatus = void 0;
function normalizePlanSubmissionLifecycleStatus(value) {
    return value === "withdrawn" ? "withdrawn" : "active";
}
exports.normalizePlanSubmissionLifecycleStatus = normalizePlanSubmissionLifecycleStatus;
function compactFiscalYearForSubmissionReference(fiscalYear) {
    const match = /^(\d{4})-(\d{4})$/.exec(fiscalYear.trim());
    if (!match) {
        return fiscalYear.replace(/\s+/gu, "").toUpperCase();
    }
    const startYear = match[1] ?? "";
    const endYear = match[2] ?? "";
    return `${startYear.slice(-2)}${endYear.slice(-2)}`;
}
exports.compactFiscalYearForSubmissionReference = compactFiscalYearForSubmissionReference;
function formatPlanSubmissionReference(args) {
    const normalizedDepartmentCode = args.departmentCode
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/gu, "-")
        .replace(/^-+|-+$/gu, "") || "DEPT";
    const normalizedSequence = Math.max(1, Math.trunc(Number.isFinite(args.submissionSequence) ? args.submissionSequence : 1));
    return `${normalizedDepartmentCode}-${compactFiscalYearForSubmissionReference(args.fiscalYear)}-${String(normalizedSequence).padStart(3, "0")}`;
}
exports.formatPlanSubmissionReference = formatPlanSubmissionReference;
function getNextPlanSubmissionSequence(snapshots) {
    const highestKnownSequence = snapshots.reduce((highest, snapshot) => {
        const nextSequence = snapshot.submissionSequence ?? 0;
        return nextSequence > highest ? nextSequence : highest;
    }, 0);
    return highestKnownSequence + 1;
}
exports.getNextPlanSubmissionSequence = getNextPlanSubmissionSequence;
function buildPlanSubmissionSequenceKey(args) {
    if (typeof args.submissionSequence === "number" && args.submissionSequence > 0) {
        return `${args.tenantId}:${args.planId}:sequence:${args.submissionSequence}`;
    }
    return `${args.tenantId}:${args.planId}:submitted-at:${args.submittedAt ?? "no-submission"}`;
}
exports.buildPlanSubmissionSequenceKey = buildPlanSubmissionSequenceKey;
function resolveLatestActivePlanSubmissionSnapshot(snapshots) {
    const activeSnapshots = snapshots.filter((snapshot) => normalizePlanSubmissionLifecycleStatus(snapshot.lifecycleStatus) === "active");
    if (activeSnapshots.length === 0) {
        return null;
    }
    return [...activeSnapshots].sort((left, right) => {
        const leftSequence = left.submissionSequence ?? 0;
        const rightSequence = right.submissionSequence ?? 0;
        if (leftSequence !== rightSequence) {
            return rightSequence - leftSequence;
        }
        const leftSubmittedAt = left.submittedAt ?? 0;
        const rightSubmittedAt = right.submittedAt ?? 0;
        if (leftSubmittedAt !== rightSubmittedAt) {
            return rightSubmittedAt - leftSubmittedAt;
        }
        return right.capturedAt - left.capturedAt;
    })[0] ?? null;
}
exports.resolveLatestActivePlanSubmissionSnapshot = resolveLatestActivePlanSubmissionSnapshot;
function selectPreviousActivePlanSubmissionSnapshot(args) {
    const eligibleSnapshots = args.snapshots.filter((snapshot) => {
        if (normalizePlanSubmissionLifecycleStatus(snapshot.lifecycleStatus) !== "active") {
            return false;
        }
        if (typeof args.currentSubmissionSequence === "number" &&
            args.currentSubmissionSequence > 0 &&
            typeof snapshot.submissionSequence === "number" &&
            snapshot.submissionSequence > 0) {
            return snapshot.submissionSequence < args.currentSubmissionSequence;
        }
        if (args.currentSubmittedAt === null || snapshot.submittedAt === null) {
            return false;
        }
        return snapshot.submittedAt < args.currentSubmittedAt;
    });
    if (eligibleSnapshots.length === 0) {
        return null;
    }
    return resolveLatestActivePlanSubmissionSnapshot(eligibleSnapshots);
}
exports.selectPreviousActivePlanSubmissionSnapshot = selectPreviousActivePlanSubmissionSnapshot;
function buildPlanSubmissionEmailIdempotencyKey(args) {
    return `plan-submission:${args.planId}:${args.submissionSequence}`;
}
exports.buildPlanSubmissionEmailIdempotencyKey = buildPlanSubmissionEmailIdempotencyKey;
function buildPlanSubmissionPersistenceRecord(args) {
    const categorySummaries = args.categorySummaries
        .map((summary) => ({
        amount: summary.amount,
        categoryId: summary.categoryId.trim(),
        categoryName: summary.categoryName,
        itemCount: summary.itemCount,
    }))
        .filter((summary) => summary.categoryId.length > 0);
    return {
        categorySummaries,
        estimatedBudgetUsed: Math.max(0, args.estimatedBudgetUsed),
        itemCount: Math.max(0, args.itemCount),
        selectedCategoryIds: Array.from(new Set([
            ...args.existingSelectedCategoryIds
                .map((categoryId) => categoryId.trim())
                .filter((categoryId) => categoryId.length > 0),
            ...categorySummaries.map((summary) => summary.categoryId),
        ])),
    };
}
exports.buildPlanSubmissionPersistenceRecord = buildPlanSubmissionPersistenceRecord;
function shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot(args) {
    return (!args.activeSnapshotExists &&
        args.planStatus === "submitted" &&
        (typeof args.submittedAt === "number" ||
            (args.submissionReference?.trim().length ?? 0) > 0));
}
exports.shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot = shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot;
