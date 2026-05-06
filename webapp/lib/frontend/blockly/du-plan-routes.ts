export {
    canDepartmentUserEditWorkspace,
    getDepartmentUserWorkspaceEditBlockedMessage,
    resolveDepartmentUserWorkspaceMode,
    type DepartmentUserPlanStatus,
    type DepartmentUserPlanWorkspaceMode,
} from "@/lib/shared/blockly/du-plan-rules";

export const DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS = 10_000;

export interface ParsedDepartmentUserLaunchContext {
    categoryIds: string[];
    fiscalYear: string | null;
    isValid: boolean;
}

interface ReadonlyURLSearchParamsLike {
    get(name: string): string | null;
}

export function parseDepartmentUserLaunchContext(
    searchParams:
        | URLSearchParams
        | ReadonlyURLSearchParamsLike
        | Record<string, string | null | undefined>,
): ParsedDepartmentUserLaunchContext {
    const fiscalYear = readSearchParam(searchParams, "fiscalYear")?.trim() ?? null;
    const rawCategories = readSearchParam(searchParams, "categories") ?? "";
    const categoryIds = Array.from(
        new Set(
            rawCategories
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
        ),
    );

    return {
        categoryIds,
        fiscalYear,
        isValid: Boolean(fiscalYear) && categoryIds.length > 0,
    };
}

export function getDepartmentUserMissingLaunchContextMessage(): string {
    return "This planning route needs the dashboard launchpad context. Return to /du, choose the fiscal year, and select categories before opening the editor.";
}

export function getDepartmentUserWorkspaceAccessRefreshKey(
    now = Date.now(),
    refreshIntervalMs = DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS,
): number {
    const safeInterval =
        Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0
            ? refreshIntervalMs
            : DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS;

    return Math.floor(Math.max(0, now) / safeInterval);
}

export function getDepartmentUserWorkspaceAccessRefreshDelay(
    now = Date.now(),
    refreshIntervalMs = DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS,
): number {
    const safeInterval =
        Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0
            ? refreshIntervalMs
            : DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS;
    const safeNow = Math.max(0, now);
    const elapsedInCurrentWindow = safeNow % safeInterval;

    return elapsedInCurrentWindow === 0
        ? safeInterval
        : safeInterval - elapsedInCurrentWindow;
}

function readSearchParam(
    searchParams:
        | URLSearchParams
        | ReadonlyURLSearchParamsLike
        | Record<string, string | null | undefined>,
    key: string,
): string | null {
    if ("get" in searchParams && typeof searchParams.get === "function") {
        return searchParams.get(key);
    }

    return (searchParams as Record<string, string | null | undefined>)[key] ?? null;
}
