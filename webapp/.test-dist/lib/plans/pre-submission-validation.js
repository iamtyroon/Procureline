"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateSubmissionDeadlineIssue = exports.resolveEffectiveSubmissionWindow = exports.summarizePendingCatalogRequestBlockers = void 0;
function summarizePendingCatalogRequestBlockers(input) {
    const count = Math.max(0, input.pendingCategoryRequestCount) +
        Math.max(0, input.pendingItemRequestCount) +
        Math.max(0, input.pendingLinkedCategoryHandoffCount ?? 0);
    if (count <= 0) {
        return {
            count: 0,
            issue: null,
            message: null,
        };
    }
    const message = `You have ${count} pending requests. Cancel or wait for PO decision.`;
    return {
        count,
        issue: {
            blocksSubmission: true,
            code: "pending_catalog_requests",
            fixTarget: {
                id: "catalog-requests",
                label: "Catalog requests",
                type: "pending_requests",
            },
            message,
            severity: "error",
        },
        message,
    };
}
exports.summarizePendingCatalogRequestBlockers = summarizePendingCatalogRequestBlockers;
function resolveEffectiveSubmissionWindow(input) {
    if (input.sharedDeadline) {
        return {
            source: "shared",
            submissionEndsAt: input.sharedDeadline.submissionEndsAt,
            submissionStartsAt: input.sharedDeadline.submissionStartsAt,
            timeZone: input.sharedDeadline.timeZone,
        };
    }
    if (typeof input.departmentSubmissionStartsAt === "number" &&
        typeof input.departmentSubmissionEndsAt === "number") {
        return {
            source: "department",
            submissionEndsAt: input.departmentSubmissionEndsAt,
            submissionStartsAt: input.departmentSubmissionStartsAt,
            timeZone: "Africa/Nairobi",
        };
    }
    return {
        source: "unavailable",
        submissionEndsAt: null,
        submissionStartsAt: null,
        timeZone: "Africa/Nairobi",
    };
}
exports.resolveEffectiveSubmissionWindow = resolveEffectiveSubmissionWindow;
function evaluateSubmissionDeadlineIssue(args) {
    if (typeof args.window.submissionStartsAt !== "number" ||
        typeof args.window.submissionEndsAt !== "number") {
        return {
            blocksSubmission: true,
            code: "deadline_closed",
            fixTarget: {
                id: "deadline-summary",
                label: "Submission deadline",
                type: "deadline_summary",
            },
            message: "Submission deadline is unavailable. Contact your PO.",
            severity: "error",
        };
    }
    if (args.now < args.window.submissionStartsAt) {
        return {
            blocksSubmission: true,
            code: "deadline_not_open",
            fixTarget: {
                id: "deadline-summary",
                label: "Submission deadline",
                type: "deadline_summary",
            },
            message: "Submission window has not opened yet.",
            severity: "error",
        };
    }
    if (args.now >= args.window.submissionEndsAt) {
        return {
            blocksSubmission: true,
            code: "deadline_closed",
            fixTarget: {
                id: "deadline-summary",
                label: "Submission deadline",
                type: "deadline_summary",
            },
            message: "Submission deadline has passed. Contact your PO.",
            severity: "error",
        };
    }
    return null;
}
exports.evaluateSubmissionDeadlineIssue = evaluateSubmissionDeadlineIssue;
