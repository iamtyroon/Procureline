import {
    DEADLINE_IN_PAST_MESSAGE,
    formatDeadlineDateTime,
    parseTimeZoneInputValue,
} from "./deadlines";

export const PLAN_APPROVAL_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ProcurementOfficerPlanDecisionType =
    | "approved"
    | "rejected"
    | "revision_requested";

export type ProcurementOfficerPlanDecisionLifecycleStatus =
    | "active"
    | "superseded"
    | "undone";

export type ProcurementOfficerPlanDecisionNotificationStatus =
    | "failed"
    | "queued";

export interface ProcurementOfficerPlanFlaggedTarget {
    categoryId: string;
    id: string;
    itemId: string | null;
    label: string;
    type: "category" | "item";
}

export interface ProcurementOfficerPlanDecisionLike {
    comment: string;
    decidedAt: number;
    decisionType: ProcurementOfficerPlanDecisionType;
    flaggedTargets: readonly ProcurementOfficerPlanFlaggedTarget[];
    revisionDeadlineAt?: number | null;
}

export interface ProcurementOfficerPlanUndoApprovalEligibility {
    blockedReason: string | null;
    canUndo: boolean;
    undoDeadlineAt: number | null;
}

function normalizeWhitespace(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}

export function getProcurementOfficerPlanDecisionStatusLabel(
    decisionType: ProcurementOfficerPlanDecisionType,
): string {
    switch (decisionType) {
        case "approved":
            return "Approved";
        case "revision_requested":
            return "Revision Requested";
        default:
            return "Rejected";
    }
}

export function normalizeProcurementOfficerDecisionComment(
    value: string,
): { message?: string; ok: boolean; value?: string } {
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

export function normalizeProcurementOfficerFlaggedTargets(args: {
    descriptors: ReadonlyArray<{
        id: string;
        label: string;
        type: "category" | "item";
    }>;
    validSelectionIds: readonly string[];
}): {
    invalidIds: string[];
    targets: ProcurementOfficerPlanFlaggedTarget[];
} {
    const validIdSet = new Set(args.validSelectionIds);
    const seenIds = new Set<string>();
    const invalidIds: string[] = [];
    const targets: ProcurementOfficerPlanFlaggedTarget[] = [];

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

export function validateProcurementOfficerRevisionDeadline(args: {
    input: string | null | undefined;
    now: number;
    timeZone: string;
}): {
    message?: string;
    ok: boolean;
    value?: number | null;
} {
    const normalizedInput = args.input?.trim() ?? "";
    if (normalizedInput.length === 0) {
        return {
            ok: true,
            value: null,
        };
    }

    const parsed = parseTimeZoneInputValue(normalizedInput, args.timeZone);
    if (typeof parsed !== "number") {
        return {
            message: "Enter a valid revision deadline.",
            ok: false,
        };
    }

    if (parsed < args.now) {
        return {
            message: DEADLINE_IN_PAST_MESSAGE,
            ok: false,
        };
    }

    return {
        ok: true,
        value: parsed,
    };
}

export function getProcurementOfficerUndoApprovalEligibility(args: {
    approvedAt: number | null | undefined;
    consolidatedAt?: number | null | undefined;
    now: number;
    status: "approved" | "draft" | "rejected" | "submitted";
}): ProcurementOfficerPlanUndoApprovalEligibility {
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
            undoDeadlineAt: args.approvedAt + PLAN_APPROVAL_UNDO_WINDOW_MS,
        };
    }

    const undoDeadlineAt = args.approvedAt + PLAN_APPROVAL_UNDO_WINDOW_MS;
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

export function buildProcurementOfficerDecisionNotificationIdempotencyKey(args: {
    decisionId: string;
    decisionType: ProcurementOfficerPlanDecisionType;
    planId: string;
    recipientEmail: string;
    tenantId: string;
}): string {
    return `plan-review-decision:${args.tenantId}:${args.planId}:${args.decisionId}:${args.decisionType}:${args.recipientEmail.toLowerCase()}`;
}

export function buildProcurementOfficerDecisionSummary(
    decision: ProcurementOfficerPlanDecisionLike | null,
    timeZone: string,
): string | null {
    if (!decision) {
        return null;
    }

    const parts = [
        `${getProcurementOfficerPlanDecisionStatusLabel(decision.decisionType)} ${formatDeadlineDateTime(decision.decidedAt, timeZone)}.`,
        decision.comment,
    ];

    if (typeof decision.revisionDeadlineAt === "number") {
        parts.push(
            `Revision deadline ${formatDeadlineDateTime(decision.revisionDeadlineAt, timeZone)}.`,
        );
    }

    if (decision.flaggedTargets.length > 0) {
        parts.push(`${decision.flaggedTargets.length} flagged target(s).`);
    }

    return parts.join(" ");
}
