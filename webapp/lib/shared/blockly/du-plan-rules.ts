import type { DepartmentUserAccessMode } from "@/lib/shared/auth/department-user-access";

export type DepartmentUserPlanWorkspaceMode = "edit" | "view";
export type DepartmentUserPlanStatus = "approved" | "draft" | "rejected" | "submitted";

export function resolveDepartmentUserWorkspaceMode(args: {
    accessMode?: DepartmentUserAccessMode | null;
    requestedMode?: string | null;
    status: DepartmentUserPlanStatus;
}): DepartmentUserPlanWorkspaceMode {
    const requestedMode = args.requestedMode === "edit" ? "edit" : "view";
    const canEdit = canDepartmentUserEditWorkspace(args);

    if (!canEdit) {
        return "view";
    }

    return requestedMode;
}

export function canDepartmentUserEditWorkspace(args: {
    accessMode?: DepartmentUserAccessMode | null;
    status: DepartmentUserPlanStatus;
}): boolean {
    return (
        args.accessMode === "editable" &&
        (args.status === "draft" || args.status === "rejected")
    );
}

export function getDepartmentUserWorkspaceEditBlockedMessage(args: {
    accessMode?: DepartmentUserAccessMode | null;
    status: DepartmentUserPlanStatus;
}): string {
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
