"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentUserWorkspaceEditBlockedMessage = exports.canDepartmentUserEditWorkspace = exports.resolveDepartmentUserWorkspaceMode = void 0;
function resolveDepartmentUserWorkspaceMode(args) {
    const requestedMode = args.requestedMode === "edit" ? "edit" : "view";
    const canEdit = canDepartmentUserEditWorkspace(args);
    if (!canEdit) {
        return "view";
    }
    return requestedMode;
}
exports.resolveDepartmentUserWorkspaceMode = resolveDepartmentUserWorkspaceMode;
function canDepartmentUserEditWorkspace(args) {
    return (args.accessMode === "editable" &&
        (args.status === "draft" || args.status === "rejected"));
}
exports.canDepartmentUserEditWorkspace = canDepartmentUserEditWorkspace;
function getDepartmentUserWorkspaceEditBlockedMessage(args) {
    if (args.accessMode !== "editable") {
        return "This plan is no longer editable from the current Department User session.";
    }
    if (args.status === "submitted") {
        return "Submitted plans are read-only for Department Users until they are returned for revision.";
    }
    if (args.status === "approved") {
        return "Approved plans are read-only and can no longer be edited as department drafts.";
    }
    return "This plan is not editable from the current Department User session.";
}
exports.getDepartmentUserWorkspaceEditBlockedMessage = getDepartmentUserWorkspaceEditBlockedMessage;
