"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProcurementOfficerDecisionSummary = exports.buildProcurementOfficerDecisionNotificationIdempotencyKey = exports.getProcurementOfficerUndoApprovalEligibility = exports.validateProcurementOfficerRevisionDeadline = exports.normalizeProcurementOfficerFlaggedTargets = exports.normalizeProcurementOfficerDecisionComment = exports.getProcurementOfficerPlanDecisionStatusLabel = exports.PLAN_APPROVAL_UNDO_WINDOW_MS = void 0;
const deadlines_1 = require("./deadlines");
exports.PLAN_APPROVAL_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
function normalizeWhitespace(value) {
    return value.trim().replace(/\s+/g, " ");
}
function getProcurementOfficerPlanDecisionStatusLabel(decisionType) {
    switch (decisionType) {
        case "approved":
            return "Approved";
        case "revision_requested":
            return "Revision Requested";
        default:
            return "Rejected";
    }
}
exports.getProcurementOfficerPlanDecisionStatusLabel = getProcurementOfficerPlanDecisionStatusLabel;
function normalizeProcurementOfficerDecisionComment(value) {
    const normalized = normalizeWhitespace(value);
    if (normalized.length === 0) {
        return {
            message: "Decision comments cannot be blank.",
            ok: false,
        };
    }
    return {
        ok: true,
        value: normalized,
    };
}
exports.normalizeProcurementOfficerDecisionComment = normalizeProcurementOfficerDecisionComment;
function normalizeProcurementOfficerFlaggedTargets(args) {
    const validIdSet = new Set(args.validSelectionIds);
    const seenIds = new Set();
    const invalidIds = [];
    const targets = [];
    for (const descriptor of args.descriptors) {
        const normalizedId = descriptor.id.trim();
        if (normalizedId.length === 0 || seenIds.has(normalizedId)) {
            continue;
        }
        seenIds.add(normalizedId);
        if (!validIdSet.has(normalizedId)) {
            invalidIds.push(normalizedId);
            continue;
        }
        if (descriptor.type === "category") {
            const [, categoryId = ""] = normalizedId.split(":");
            if (categoryId.length === 0) {
                invalidIds.push(normalizedId);
                continue;
            }
            targets.push({
                categoryId,
                id: normalizedId,
                itemId: null,
                label: normalizeWhitespace(descriptor.label) || normalizedId,
                type: "category",
            });
            continue;
        }
        const [, categoryId = "", itemId = ""] = normalizedId.split(":");
        if (categoryId.length === 0 || itemId.length === 0) {
            invalidIds.push(normalizedId);
            continue;
        }
        targets.push({
            categoryId,
            id: normalizedId,
            itemId,
            label: normalizeWhitespace(descriptor.label) || normalizedId,
            type: "item",
        });
    }
    return {
        invalidIds,
        targets,
    };
}
exports.normalizeProcurementOfficerFlaggedTargets = normalizeProcurementOfficerFlaggedTargets;
function validateProcurementOfficerRevisionDeadline(args) {
    const normalizedInput = args.input?.trim() ?? "";
    if (normalizedInput.length === 0) {
        return {
            ok: true,
            value: null,
        };
    }
    const parsed = (0, deadlines_1.parseTimeZoneInputValue)(normalizedInput, args.timeZone);
    if (typeof parsed !== "number") {
        return {
            message: "Enter a valid revision deadline.",
            ok: false,
        };
    }
    if (parsed < args.now) {
        return {
            message: deadlines_1.DEADLINE_IN_PAST_MESSAGE,
            ok: false,
        };
    }
    return {
        ok: true,
        value: parsed,
    };
}
exports.validateProcurementOfficerRevisionDeadline = validateProcurementOfficerRevisionDeadline;
function getProcurementOfficerUndoApprovalEligibility(args) {
    if (args.status !== "approved") {
        return {
            blockedReason: "Only approved plans can be returned to submitted review.",
            canUndo: false,
            undoDeadlineAt: null,
        };
    }
    if (typeof args.approvedAt !== "number") {
        return {
            blockedReason: "Approval timestamp unavailable.",
            canUndo: false,
            undoDeadlineAt: null,
        };
    }
    if (typeof args.consolidatedAt === "number") {
        return {
            blockedReason: "Undo is blocked after consolidation begins.",
            canUndo: false,
            undoDeadlineAt: args.approvedAt + exports.PLAN_APPROVAL_UNDO_WINDOW_MS,
        };
    }
    const undoDeadlineAt = args.approvedAt + exports.PLAN_APPROVAL_UNDO_WINDOW_MS;
    if (args.now > undoDeadlineAt) {
        return {
            blockedReason: "Undo window expired 24 hours after approval.",
            canUndo: false,
            undoDeadlineAt,
        };
    }
    return {
        blockedReason: null,
        canUndo: true,
        undoDeadlineAt,
    };
}
exports.getProcurementOfficerUndoApprovalEligibility = getProcurementOfficerUndoApprovalEligibility;
function buildProcurementOfficerDecisionNotificationIdempotencyKey(args) {
    return `plan-review-decision:${args.tenantId}:${args.planId}:${args.decisionId}:${args.decisionType}:${args.recipientEmail.toLowerCase()}`;
}
exports.buildProcurementOfficerDecisionNotificationIdempotencyKey = buildProcurementOfficerDecisionNotificationIdempotencyKey;
function buildProcurementOfficerDecisionSummary(decision, timeZone) {
    if (!decision) {
        return null;
    }
    const parts = [
        `${getProcurementOfficerPlanDecisionStatusLabel(decision.decisionType)} ${(0, deadlines_1.formatDeadlineDateTime)(decision.decidedAt, timeZone)}.`,
        decision.comment,
    ];
    if (typeof decision.revisionDeadlineAt === "number") {
        parts.push(`Revision deadline ${(0, deadlines_1.formatDeadlineDateTime)(decision.revisionDeadlineAt, timeZone)}.`);
    }
    if (decision.flaggedTargets.length > 0) {
        parts.push(`${decision.flaggedTargets.length} flagged target(s).`);
    }
    return parts.join(" ");
}
exports.buildProcurementOfficerDecisionSummary = buildProcurementOfficerDecisionSummary;
