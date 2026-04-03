import type { DepartmentUserPersistedPlanSummary } from "./du-workspace-calculations";

export function getPersistedPlanSummaryForWorkspaceSummaryChange(args: {
    allowEditModePersistedFallback: boolean;
    mode: "edit" | "view";
    persistedPlanSummary: DepartmentUserPersistedPlanSummary;
}): DepartmentUserPersistedPlanSummary | null {
    return args.mode === "view" || args.allowEditModePersistedFallback
        ? args.persistedPlanSummary
        : null;
}
