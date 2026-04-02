import type { DepartmentUserPlanWorkspaceMode } from "./du-plan-routes";

export type PlanningWorkspaceActor = "department_user" | "procurement_officer";

export interface PlanningWorkspacePresentation {
    actorBadgeLabel: string;
    actorLabel: string;
    badgeLabel: string;
    modeIndicatorLabel: string | null;
    readOnlyMessage: string;
}

export function buildPlanningWorkspacePresentation(args: {
    actor: PlanningWorkspaceActor;
    actorLabel?: string | null;
    mode: DepartmentUserPlanWorkspaceMode;
}): PlanningWorkspacePresentation {
    const actorLabel =
        args.actorLabel?.trim() ||
        (args.actor === "procurement_officer"
            ? "Procurement Officer"
            : "Department User");
    const isProcurementOfficer = args.actor === "procurement_officer";

    return {
        actorBadgeLabel: actorLabel,
        actorLabel,
        badgeLabel: isProcurementOfficer
            ? "Shared Planning Workspace"
            : "DU Blockly Workspace",
        modeIndicatorLabel:
            isProcurementOfficer && args.mode === "edit" ? "(Editing as PO)" : null,
        readOnlyMessage: isProcurementOfficer
            ? "This plan is open in review mode because Procurement Officer editing is not active for the current session."
            : "This plan is visible for review, but quantities and structure are locked because the current DU session is no longer editable.",
    };
}
