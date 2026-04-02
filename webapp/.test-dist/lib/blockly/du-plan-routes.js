"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepartmentUserWorkspaceAccessRefreshDelay = exports.getDepartmentUserWorkspaceAccessRefreshKey = exports.getDepartmentUserMissingLaunchContextMessage = exports.getDepartmentUserWorkspaceEditBlockedMessage = exports.canDepartmentUserEditWorkspace = exports.resolveDepartmentUserWorkspaceMode = exports.parseDepartmentUserLaunchContext = exports.DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS = void 0;
exports.DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS = 10_000;
function parseDepartmentUserLaunchContext(searchParams) {
    const fiscalYear = readSearchParam(searchParams, "fiscalYear")?.trim() ?? null;
    const rawCategories = readSearchParam(searchParams, "categories") ?? "";
    const categoryIds = Array.from(new Set(rawCategories
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)));
    return {
        categoryIds,
        fiscalYear,
        isValid: Boolean(fiscalYear) && categoryIds.length > 0,
    };
}
exports.parseDepartmentUserLaunchContext = parseDepartmentUserLaunchContext;
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
function getDepartmentUserMissingLaunchContextMessage() {
    return "This planning route needs the dashboard launchpad context. Return to /du, choose the fiscal year, and select categories before opening the editor.";
}
exports.getDepartmentUserMissingLaunchContextMessage = getDepartmentUserMissingLaunchContextMessage;
function getDepartmentUserWorkspaceAccessRefreshKey(now = Date.now(), refreshIntervalMs = exports.DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS) {
    const safeInterval = Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0
        ? refreshIntervalMs
        : exports.DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS;
    return Math.floor(Math.max(0, now) / safeInterval);
}
exports.getDepartmentUserWorkspaceAccessRefreshKey = getDepartmentUserWorkspaceAccessRefreshKey;
function getDepartmentUserWorkspaceAccessRefreshDelay(now = Date.now(), refreshIntervalMs = exports.DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS) {
    const safeInterval = Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0
        ? refreshIntervalMs
        : exports.DEPARTMENT_USER_WORKSPACE_ACCESS_REFRESH_INTERVAL_MS;
    const safeNow = Math.max(0, now);
    const elapsedInCurrentWindow = safeNow % safeInterval;
    return elapsedInCurrentWindow === 0
        ? safeInterval
        : safeInterval - elapsedInCurrentWindow;
}
exports.getDepartmentUserWorkspaceAccessRefreshDelay = getDepartmentUserWorkspaceAccessRefreshDelay;
function readSearchParam(searchParams, key) {
    if ("get" in searchParams && typeof searchParams.get === "function") {
        return searchParams.get(key);
    }
    return searchParams[key] ?? null;
}
