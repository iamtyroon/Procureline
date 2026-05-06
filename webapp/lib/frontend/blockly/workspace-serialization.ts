import {
    createBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceJson,
    normalizeBlocklyWorkspaceRecord,
    type BlocklyWorkspaceRecord,
    type BlocklyWorkspaceSaveSource,
} from "@/lib/shared/blockly/blockly-serialization";

type BlocklyModule = typeof import("blockly");
type BlocklyWorkspace = import("blockly").WorkspaceSvg;

export function serializeBlocklyWorkspace(args: {
    Blockly: BlocklyModule;
    lastSavedAt?: number;
    lastSavedByUserId: string;
    previousRecord?: BlocklyWorkspaceRecord | null;
    saveSource?: BlocklyWorkspaceSaveSource;
    workspace: BlocklyWorkspace;
}): BlocklyWorkspaceRecord {
    const previousRevision = args.previousRecord?.editorMetadata.revision ?? 0;
    const workspaceJson = args.Blockly.serialization.workspaces.save(args.workspace) as Record<
        string,
        unknown
    >;

    return createBlocklyWorkspaceRecord({
        lastSavedAt: args.lastSavedAt ?? Date.now(),
        lastSavedByUserId: args.lastSavedByUserId,
        recoveredAt: args.previousRecord?.editorMetadata.recoveredAt ?? null,
        revision: previousRevision + 1,
        saveSource: args.saveSource ?? "workspace_sync",
        workspaceJson,
    });
}

export function loadBlocklyWorkspace(args: {
    Blockly: BlocklyModule;
    record: BlocklyWorkspaceRecord | null | undefined;
    workspace: BlocklyWorkspace;
}): void {
    const record = normalizeBlocklyWorkspaceRecord(args.record);
    args.Blockly.serialization.workspaces.load(
        normalizeBlocklyWorkspaceJson(record.workspaceJson),
        args.workspace,
    );
}

export function createSerializedBlocklyWorkspaceSnapshot(args: {
    Blockly: BlocklyModule;
    currentUserId: string;
    previousRecord?: BlocklyWorkspaceRecord | null;
    workspace: BlocklyWorkspace;
}): BlocklyWorkspaceRecord {
    return serializeBlocklyWorkspace({
        Blockly: args.Blockly,
        lastSavedByUserId: args.currentUserId,
        previousRecord: args.previousRecord,
        workspace: args.workspace,
    });
}
