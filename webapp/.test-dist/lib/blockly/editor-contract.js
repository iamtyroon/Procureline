"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPlanningWorkspacePresentation = void 0;
function buildPlanningWorkspacePresentation(args) {
    const actorLabel = args.actorLabel?.trim() ||
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
        modeIndicatorLabel: isProcurementOfficer && args.mode === "edit" ? "(Editing as PO)" : null,
        readOnlyMessage: isProcurementOfficer
            ? "This plan is open in review mode because Procurement Officer editing is not active for the current session."
            : "This plan is visible for review, but quantities and structure are locked because the current DU session is no longer editable.",
    };
}
exports.buildPlanningWorkspacePresentation = buildPlanningWorkspacePresentation;
