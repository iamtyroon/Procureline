export const BLOCKLY_WORKSPACE_FORMAT = "blockly_json" as const;
export const BLOCKLY_WORKSPACE_SCHEMA_VERSION = 1 as const;

export type BlocklyWorkspaceSaveSource = "workspace_seed" | "workspace_sync";

export interface BlocklyWorkspaceEditorMetadata {
    lastSavedAt: number;
    lastSavedByUserId: string;
    recoveredAt: number | null;
    revision: number;
    saveSource: BlocklyWorkspaceSaveSource;
}

export interface BlocklyWorkspaceRecord {
    editorMetadata: BlocklyWorkspaceEditorMetadata;
    format: typeof BLOCKLY_WORKSPACE_FORMAT;
    schemaVersion: typeof BLOCKLY_WORKSPACE_SCHEMA_VERSION;
    workspaceJson: Record<string, unknown>;
}

type BlocklyModule = typeof import("blockly");
type BlocklyWorkspace = import("blockly").WorkspaceSvg;

export function createEmptyBlocklyWorkspaceJson(): Record<string, unknown> {
    return {
        blocks: {
            blocks: [],
            languageVersion: 0,
        },
    };
}

export function createBlocklyWorkspaceRecord(args?: {
    lastSavedAt?: number;
    lastSavedByUserId?: string;
    recoveredAt?: number | null;
    revision?: number;
    saveSource?: BlocklyWorkspaceSaveSource;
    workspaceJson?: Record<string, unknown>;
}): BlocklyWorkspaceRecord {
    return {
        editorMetadata: {
            lastSavedAt: args?.lastSavedAt ?? Date.now(),
            lastSavedByUserId: args?.lastSavedByUserId ?? "system",
            recoveredAt: args?.recoveredAt ?? null,
            revision: args?.revision ?? 1,
            saveSource: args?.saveSource ?? "workspace_seed",
        },
        format: BLOCKLY_WORKSPACE_FORMAT,
        schemaVersion: BLOCKLY_WORKSPACE_SCHEMA_VERSION,
        workspaceJson: args?.workspaceJson ?? createEmptyBlocklyWorkspaceJson(),
    };
}

export function isBlocklyWorkspaceRecord(value: unknown): value is BlocklyWorkspaceRecord {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    const editorMetadata =
        typeof record.editorMetadata === "object" && record.editorMetadata !== null
            ? (record.editorMetadata as Record<string, unknown>)
            : null;

    return (
        record.format === BLOCKLY_WORKSPACE_FORMAT &&
        record.schemaVersion === BLOCKLY_WORKSPACE_SCHEMA_VERSION &&
        typeof record.workspaceJson === "object" &&
        record.workspaceJson !== null &&
        editorMetadata !== null &&
        typeof editorMetadata.lastSavedAt === "number" &&
        typeof editorMetadata.lastSavedByUserId === "string" &&
        (typeof editorMetadata.recoveredAt === "number" ||
            editorMetadata.recoveredAt === null) &&
        typeof editorMetadata.revision === "number" &&
        (editorMetadata.saveSource === "workspace_seed" ||
            editorMetadata.saveSource === "workspace_sync")
    );
}

export function normalizeBlocklyWorkspaceRecord(
    value: unknown,
    fallback?: {
        lastSavedAt?: number;
        lastSavedByUserId?: string;
        recoveredAt?: number | null;
        revision?: number;
        saveSource?: BlocklyWorkspaceSaveSource;
    },
): BlocklyWorkspaceRecord {
    if (!isBlocklyWorkspaceRecord(value)) {
        return createBlocklyWorkspaceRecord(fallback);
    }

    return createBlocklyWorkspaceRecord({
        lastSavedAt: value.editorMetadata.lastSavedAt,
        lastSavedByUserId: value.editorMetadata.lastSavedByUserId,
        recoveredAt: value.editorMetadata.recoveredAt,
        revision: value.editorMetadata.revision,
        saveSource: value.editorMetadata.saveSource,
        workspaceJson: value.workspaceJson,
    });
}

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
    args.Blockly.serialization.workspaces.load(record.workspaceJson, args.workspace);
}
