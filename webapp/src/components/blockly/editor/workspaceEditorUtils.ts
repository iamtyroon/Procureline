import { areBlocklyWorkspaceJsonEquivalent, type BlocklyWorkspaceRecord } from "@/lib/shared/blockly/blockly-serialization";
import { readDepartmentUserWorkspaceSessionLease } from "@/lib/frontend/blockly/workspace-draft-queue";

export function isSameWorkspaceSnapshotIgnoringSavedAt(
    left: BlocklyWorkspaceRecord | null | undefined,
    right: BlocklyWorkspaceRecord | null | undefined,
): boolean {
    if (!left || !right) return false;
    return (
        left.editorMetadata.revision === right.editorMetadata.revision &&
        left.editorMetadata.lastSavedByUserId === right.editorMetadata.lastSavedByUserId &&
        left.editorMetadata.recoveredAt === right.editorMetadata.recoveredAt &&
        left.editorMetadata.saveSource === right.editorMetadata.saveSource &&
        areBlocklyWorkspaceJsonEquivalent(left.workspaceJson, right.workspaceJson)
    );
}

export function isSameWorkspaceContent(
    left: BlocklyWorkspaceRecord | null | undefined,
    right: BlocklyWorkspaceRecord | null | undefined,
): boolean {
    return Boolean(left && right && areBlocklyWorkspaceJsonEquivalent(left.workspaceJson, right.workspaceJson));
}

export function getDepartmentUserWorkspaceBrowserSessionId(args: {
    planId: string;
    userId: string;
}): string {
    const fallbackSessionId = createSessionId();
    if (typeof window === "undefined") return fallbackSessionId;
    const key = `procureline:blockly-tab-session:${args.userId}:${args.planId}`;
    try {
        const existingSessionId = window.sessionStorage.getItem(key);
        if (existingSessionId) return existingSessionId;
        const navigationEntry = window.performance
            .getEntriesByType("navigation")
            .at(0) as PerformanceNavigationTiming | undefined;
        const activeLease = readDepartmentUserWorkspaceSessionLease(args);
        const sessionId = navigationEntry?.type === "reload" && activeLease?.sessionId
            ? activeLease.sessionId
            : fallbackSessionId;
        window.sessionStorage.setItem(key, sessionId);
        return sessionId;
    } catch {
        return fallbackSessionId;
    }
}

function createSessionId(): string {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `workspace-session-${Date.now()}`;
}
